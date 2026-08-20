import { PDFDocument, degrees, rgb, type PDFPage, type PDFEmbeddedPage } from "pdf-lib";
import { impose, type Binding, type DuplexFlip, type SheetSide } from "./imposition";
import { paperById, type PaperSize } from "./paper";
import { toBox, type Bounds } from "./crop";

export interface BuildOptions {
  /** "none" = margin surgery only, one source page per output page. */
  binding: Binding | "none";
  /** Paper id from PAPER_SIZES, or "source" to keep the document's own size. */
  paperId: string;
  /** Whitespace to cut, as page fractions. One entry per page, or one for all. */
  crop?: Bounds | Bounds[] | null;
  /** Outer white border in points. */
  outerMargin?: number;
  /** Total gap left at the spine between the two pages, in points. */
  gutter?: number;
  duplexFlip?: DuplexFlip;
  sheetsPerSignature?: number;
  rtl?: boolean;
  /** Dashed line down the fold (saddle) or the cut (perfect). */
  guideLine?: boolean;
  /** Corner trim marks. */
  cropMarks?: boolean;
  onProgress?: (done: number, total: number) => void;
}

export interface BuildResult {
  bytes: Uint8Array;
  /** Output page count. */
  pages: number;
  /** Physical sheets of paper when printed duplex. */
  sheets: number;
  blanks: number;
  layout: SheetSide[];
}

const GUIDE = rgb(0.72, 0.74, 0.78);

export async function buildBooklet(
  input: ArrayBuffer | Uint8Array,
  opts: BuildOptions,
): Promise<BuildResult> {
  const src = await PDFDocument.load(input, { ignoreEncryption: true });
  const pageCount = src.getPageCount();
  if (pageCount === 0) throw new Error("This PDF has no pages.");

  const out = await PDFDocument.create();
  out.setProducer("Perfect Binding");
  out.setCreator("Perfect Binding");

  // Pages with no content stream (genuinely blank ones) cannot be embedded,
  // so they are dropped here and rendered as empty slots downstream.
  const printable = Array.from({ length: pageCount }, (_, i) => i).filter(
    (i) => src.getPage(i).node.Contents() !== undefined,
  );
  const boxes = printable.map((i) => {
    const b = cropFor(opts.crop, i);
    const { width, height } = src.getPage(i).getSize();
    return b ? toBox(b, width, height) : undefined;
  });
  const embeds = await out.embedPages(
    printable.map((i) => src.getPage(i)),
    boxes as any,
  );
  /** 1-based source page -> embedded page, or null if the page was blank. */
  const embedded: Array<PDFEmbeddedPage | null> = Array(pageCount).fill(null);
  printable.forEach((srcIndex, k) => {
    embedded[srcIndex] = embeds[k]!;
  });
  const sample = embeds[0];
  if (!sample) throw new Error("Every page in this PDF is blank.");

  const outerMargin = opts.outerMargin ?? 0;
  const gutter = opts.gutter ?? 0;

  if (opts.binding === "none") {
    const total = pageCount;
    for (let i = 0; i < total; i++) {
      const ep = embedded[i];
      const size = sheetSize(opts.paperId, ep ?? sample, false);
      const page = out.addPage([size.width, size.height]);
      if (ep) {
        place(page, ep, {
          x: outerMargin,
          y: outerMargin,
          width: size.width - outerMargin * 2,
          height: size.height - outerMargin * 2,
        });
      }
      opts.onProgress?.(i + 1, total);
    }
    const bytes = await out.save();
    return { bytes, pages: total, sheets: Math.ceil(total / 2), blanks: 0, layout: [] };
  }

  const layout = impose({
    binding: opts.binding,
    pageCount,
    sheetsPerSignature: opts.sheetsPerSignature,
    duplexFlip: opts.duplexFlip,
    rtl: opts.rtl,
  });

  const size = sheetSize(opts.paperId, sample, true);
  const half = size.width / 2;

  for (let i = 0; i < layout.length; i++) {
    const side = layout[i]!;
    const page = out.addPage([size.width, size.height]);

    const slotHeight = size.height - outerMargin * 2;
    const slotWidth = half - outerMargin - gutter / 2;
    const slots = [
      { page: side.left, x: outerMargin },
      { page: side.right, x: half + gutter / 2 },
    ];
    for (const slot of slots) {
      if (slot.page === null) continue;
      const ep = embedded[slot.page - 1];
      if (!ep) continue;
      place(page, ep, {
        x: slot.x,
        y: outerMargin,
        width: slotWidth,
        height: slotHeight,
      });
    }

    if (opts.guideLine) drawGuideLine(page, half, size.height);
    if (opts.cropMarks) drawCropMarks(page, size, outerMargin);
    if (side.rotate180) page.setRotation(degrees(180));

    opts.onProgress?.(i + 1, layout.length);
  }

  const bytes = await out.save();
  const blanks = layout.reduce(
    (n, s) => n + (s.left === null ? 1 : 0) + (s.right === null ? 1 : 0),
    0,
  );
  return { bytes, pages: layout.length, sheets: layout.length / 2, blanks, layout };
}

function cropFor(crop: BuildOptions["crop"], i: number): Bounds | null {
  if (!crop) return null;
  const b = Array.isArray(crop) ? crop[i] : crop;
  if (!b) return null;
  if (!b.left && !b.top && !b.right && !b.bottom) return null;
  return b;
}

/** Output sheet dimensions: landscape for booklets, portrait otherwise. */
function sheetSize(paperId: string, sample: PDFEmbeddedPage, landscape: boolean) {
  if (paperId === "source") {
    // Two source pages side by side, or the source page as-is.
    return landscape
      ? { width: sample.width * 2, height: sample.height }
      : { width: sample.width, height: sample.height };
  }
  const paper: PaperSize = paperById(paperId);
  return landscape
    ? { width: paper.height, height: paper.width }
    : { width: paper.width, height: paper.height };
}

interface Slot {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Scales a page to fill its slot without distortion, then centres it. */
function place(page: PDFPage, ep: PDFEmbeddedPage, slot: Slot) {
  if (slot.width <= 0 || slot.height <= 0) return;
  const scale = Math.min(slot.width / ep.width, slot.height / ep.height);
  const w = ep.width * scale;
  const h = ep.height * scale;
  page.drawPage(ep, {
    x: slot.x + (slot.width - w) / 2,
    y: slot.y + (slot.height - h) / 2,
    xScale: scale,
    yScale: scale,
  });
}

function drawGuideLine(page: PDFPage, x: number, height: number) {
  page.drawLine({
    start: { x, y: 0 },
    end: { x, y: height },
    thickness: 0.5,
    color: GUIDE,
    dashArray: [3, 3],
  });
}

function drawCropMarks(page: PDFPage, size: { width: number; height: number }, inset: number) {
  const len = 12;
  const m = Math.max(inset * 0.6, 6);
  const marks: Array<[number, number, number, number]> = [
    [0, m, len, m], [m, 0, m, len],
    [size.width - len, m, size.width, m], [size.width - m, 0, size.width - m, len],
    [0, size.height - m, len, size.height - m],
    [m, size.height - len, m, size.height],
    [size.width - len, size.height - m, size.width, size.height - m],
    [size.width - m, size.height - len, size.width - m, size.height],
  ];
  for (const [x1, y1, x2, y2] of marks) {
    page.drawLine({
      start: { x: x1, y: y1 },
      end: { x: x2, y: y2 },
      thickness: 0.4,
      color: GUIDE,
    });
  }
}
