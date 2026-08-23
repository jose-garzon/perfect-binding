import * as pdfjs from "pdfjs-dist";
import type { PDFDocumentProxy, PDFPageProxy, RenderTask } from "pdfjs-dist";
import { detectMargins, inkCoverage, robustMargins, type Bounds } from "../../core/crop";

// The worker file is copied next to index.html by the dev server and the build.
pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdf.worker.min.mjs", document.baseURI).href;

/**
 * Loads a PDF from bytes or from a blob: URL. pdf.js takes ownership of any
 * buffer it is handed, so bytes are always copied first.
 */
export function loadPdf(source: Uint8Array | string): Promise<PDFDocumentProxy> {
  const params = typeof source === "string" ? { url: source } : { data: new Uint8Array(source) };
  return pdfjs.getDocument(params).promise;
}

/** Releases the document and its worker. */
export function closePdf(doc: PDFDocumentProxy | null | undefined): void {
  doc?.loadingTask.destroy().catch(() => {});
}

/** pdf.js refuses to paint a canvas that is already being painted. */
const inFlight = new WeakMap<HTMLCanvasElement, RenderTask>();

export async function renderPage(
  page: PDFPageProxy,
  canvas: HTMLCanvasElement,
  targetWidth: number,
): Promise<void> {
  const previous = inFlight.get(canvas);
  if (previous) {
    previous.cancel();
    await previous.promise.catch(() => {});
  }

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const base = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale: (targetWidth * dpr) / base.width });
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  canvas.style.width = `${Math.ceil(viewport.width / dpr)}px`;
  canvas.style.height = `${Math.ceil(viewport.height / dpr)}px`;
  const ctx = canvas.getContext("2d", { alpha: false })!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const task = page.render({ canvas, canvasContext: ctx, viewport } as never);
  inFlight.set(canvas, task);
  try {
    await task.promise;
  } catch (err) {
    // A cancelled render is the expected outcome of a fast re-render.
    if ((err as Error)?.name !== "RenderingCancelledException") throw err;
  } finally {
    if (inFlight.get(canvas) === task) inFlight.delete(canvas);
  }
}

/* ── thumbnails ───────────────────────────────────────────────────────────── */

/**
 * Thumbnail work shares the pdf.js worker with the margin scan and the preview,
 * both of which the user is waiting on. A queue of depth one keeps the contact
 * sheet strictly in the background: tiles render one at a time, and a tile that
 * scrolls away before its turn simply never runs.
 */
let queue: Promise<unknown> = Promise.resolve();

const THUMB_LIMIT = 200;
/** page number -> bitmap, in insertion order, oldest evicted first. */
let thumbs = new Map<number, ImageBitmap>();
let thumbsFor: PDFDocumentProxy | null = null;

function cacheFor(doc: PDFDocumentProxy): Map<number, ImageBitmap> {
  if (thumbsFor !== doc) {
    for (const bitmap of thumbs.values()) bitmap.close();
    thumbs = new Map();
    thumbsFor = doc;
  }
  return thumbs;
}

/** Drops every cached bitmap. Called when a document is closed or replaced. */
export function clearThumbnails(): void {
  for (const bitmap of thumbs.values()) bitmap.close();
  thumbs = new Map();
  thumbsFor = null;
}

/**
 * Renders one source page small, cached as a bitmap. Resolves to null when the
 * work was cancelled before it ran or while it was running.
 */
export function renderThumbnail(
  doc: PDFDocumentProxy,
  pageNumber: number,
  width: number,
  signal?: AbortSignal,
): Promise<ImageBitmap | null> {
  const cache = cacheFor(doc);
  const hit = cache.get(pageNumber);
  if (hit) {
    // Refresh its place in the eviction order.
    cache.delete(pageNumber);
    cache.set(pageNumber, hit);
    return Promise.resolve(hit);
  }

  const run = queue.then(async () => {
    if (signal?.aborted) return null;
    const cached = cacheFor(doc).get(pageNumber);
    if (cached) return cached;

    const page = await doc.getPage(pageNumber);
    try {
      const base = page.getViewport({ scale: 1 });
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const viewport = page.getViewport({ scale: (width * dpr) / base.width });
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.ceil(viewport.width));
      canvas.height = Math.max(1, Math.ceil(viewport.height));
      const ctx = canvas.getContext("2d", { alpha: false })!;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvas, canvasContext: ctx, viewport } as never).promise;
      if (signal?.aborted) return null;
      const bitmap = await createImageBitmap(canvas);
      const store = cacheFor(doc);
      store.set(pageNumber, bitmap);
      while (store.size > THUMB_LIMIT) {
        const oldest = store.keys().next();
        if (oldest.done) break;
        store.get(oldest.value)?.close();
        store.delete(oldest.value);
      }
      return bitmap;
    } catch (err) {
      if ((err as Error)?.name === "RenderingCancelledException") return null;
      throw err;
    } finally {
      page.cleanup();
    }
  });

  // The queue must survive a failed tile, so it chains on the settled promise.
  queue = run.catch(() => {});
  return run;
}

/* ── scanning ─────────────────────────────────────────────────────────────── */

export interface CropScan {
  /** One entry per source page. */
  perPage: Bounds[];
  /** A single crop that suits the whole document. */
  shared: Bounds;
}

/**
 * Renders every page small and measures its whitespace. Pages are sampled when
 * the document is long, since margins rarely change page to page.
 */
export async function scanMargins(
  doc: PDFDocumentProxy,
  onProgress?: (done: number, total: number) => void,
  signal?: AbortSignal,
): Promise<CropScan> {
  const total = doc.numPages;
  const step = total > 60 ? Math.ceil(total / 60) : 1;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { alpha: false, willReadFrequently: true })!;

  const sampled = new Map<number, Bounds>();
  let done = 0;
  for (let n = 1; n <= total; n += step) {
    if (signal?.aborted) throw new DOMException("Scan cancelled", "AbortError");
    const page = await doc.getPage(n);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: Math.min(1, 400 / base.width) });
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvas, canvasContext: ctx, viewport } as never).promise;
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    sampled.set(n, detectMargins(data, canvas.width, canvas.height));
    page.cleanup();
    onProgress?.(++done, Math.ceil(total / step));
  }

  // Fill unsampled pages from the nearest page that was measured.
  const keys = [...sampled.keys()];
  const perPage: Bounds[] = [];
  for (let n = 1; n <= total; n++) {
    const near = sampled.get(n) ?? sampled.get(keys.reduce((a, b) =>
      Math.abs(b - n) < Math.abs(a - n) ? b : a))!;
    perPage.push(near);
  }
  return { perPage, shared: robustMargins([...sampled.values()]) };
}

/** How little ink a page may carry and still count as blank. */
const BLANK_FLOOR = 0.0008;

/**
 * Measures every page and reports which ones are blank. This is a full pass on
 * purpose: `scanMargins` samples long documents, and `detectMargins` reports the
 * same "no margins" for a blank page and a full-bleed one, so neither can be
 * trusted to decide what gets removed.
 */
export async function scanBlanks(
  doc: PDFDocumentProxy,
  onProgress?: (done: number, total: number) => void,
  signal?: AbortSignal,
): Promise<number[]> {
  const total = doc.numPages;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { alpha: false, willReadFrequently: true })!;

  const blank: number[] = [];
  for (let n = 1; n <= total; n++) {
    if (signal?.aborted) throw new DOMException("Scan cancelled", "AbortError");
    const page = await doc.getPage(n);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: Math.min(1, 300 / base.width) });
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvas, canvasContext: ctx, viewport } as never).promise;
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    if (inkCoverage(data, canvas.width, canvas.height) < BLANK_FLOOR) blank.push(n);
    page.cleanup();
    onProgress?.(n, total);
  }
  return blank;
}
