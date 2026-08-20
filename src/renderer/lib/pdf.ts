import * as pdfjs from "pdfjs-dist";
import type { PDFDocumentProxy, PDFPageProxy, RenderTask } from "pdfjs-dist";
import { detectMargins, robustMargins, type Bounds } from "../../core/crop";

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
