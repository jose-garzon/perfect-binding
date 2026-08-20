/**
 * Page-order math for booklet imposition.
 *
 * Everything here is pure: it maps a source page count onto physical sheet
 * sides, each side holding two source pages side by side. `null` means a blank
 * slot (padding).
 */

export type Binding = "saddle" | "perfect";

/** Which paper edge the printer flips around when printing duplex. */
export type DuplexFlip = "short" | "long";

export interface ImposeOptions {
  binding: Binding;
  /** Number of pages in the source document. */
  pageCount: number;
  /**
   * Saddle stitch only. Fold this many sheets into one nested signature, then
   * start a new one. 0 or undefined = a single signature for the whole book.
   */
  sheetsPerSignature?: number;
  /** Printer duplex behaviour. "long" needs back sides rotated 180°. */
  duplexFlip?: DuplexFlip;
  /** Right-to-left reading order (Arabic, Hebrew, manga). */
  rtl?: boolean;
}

export interface SheetSide {
  /** 0-based index of the physical sheet. */
  sheet: number;
  side: "front" | "back";
  /** 1-based source page numbers, or null for a blank slot. */
  left: number | null;
  right: number | null;
  /** Rotate the whole side 180° when placing it on paper. */
  rotate180: boolean;
}

/** Pages that fit on one sheet: 2 per side, 2 sides. */
export const PAGES_PER_SHEET = 4;

export function padToSheet(pageCount: number): number {
  return Math.ceil(pageCount / PAGES_PER_SHEET) * PAGES_PER_SHEET;
}

/** Total sheets of paper a job consumes. */
export function sheetCount(pageCount: number): number {
  return padToSheet(pageCount) / PAGES_PER_SHEET;
}

/** Blank pages appended to reach a whole number of sheets. */
export function blankCount(pageCount: number): number {
  return padToSheet(pageCount) - pageCount;
}

export function impose(opts: ImposeOptions): SheetSide[] {
  const { binding, pageCount } = opts;
  if (pageCount <= 0) return [];

  const sides =
    binding === "saddle"
      ? saddleSides(pageCount, opts.sheetsPerSignature ?? 0)
      : perfectSides(pageCount);

  const rotate = opts.duplexFlip === "long";
  const total = padToSheet(pageCount);

  return sides.map((s, i) => {
    const left = keep(s.left, pageCount, total);
    const right = keep(s.right, pageCount, total);
    return {
      sheet: Math.floor(i / 2),
      side: s.side,
      left: opts.rtl ? right : left,
      right: opts.rtl ? left : right,
      rotate180: rotate && s.side === "back",
    };
  });
}

/** Padding pages exist in the layout but have no source page behind them. */
function keep(page: number, pageCount: number, total: number): number | null {
  return page >= 1 && page <= pageCount && page <= total ? page : null;
}

type RawSide = { side: "front" | "back"; left: number; right: number };

/**
 * Saddle stitch: sheets are nested inside each other and stapled through the
 * fold, so the outermost sheet carries the first and last pages.
 */
function saddleSides(pageCount: number, sheetsPerSignature: number): RawSide[] {
  const total = padToSheet(pageCount);
  const sheets = total / PAGES_PER_SHEET;
  const group = sheetsPerSignature > 0 ? Math.min(sheetsPerSignature, sheets) : sheets;

  const out: RawSide[] = [];
  for (let start = 0; start < sheets; start += group) {
    const n = Math.min(group, sheets - start);
    const first = start * PAGES_PER_SHEET; // 0-based page offset of this signature
    const last = first + n * PAGES_PER_SHEET - 1;
    for (let i = 0; i < n; i++) {
      out.push({ side: "front", left: last + 1 - 2 * i, right: first + 1 + 2 * i });
      out.push({ side: "back", left: first + 2 + 2 * i, right: last - 2 * i });
    }
  }
  return out;
}

/**
 * Perfect binding, printed as a cut stack: sheets stay flat, get sliced down
 * the middle, and the right-hand pile is stacked under the left-hand pile
 * before the spine is glued.
 */
function perfectSides(pageCount: number): RawSide[] {
  const total = padToSheet(pageCount);
  const sheets = total / PAGES_PER_SHEET;
  const half = total / 2;

  const out: RawSide[] = [];
  for (let i = 0; i < sheets; i++) {
    out.push({ side: "front", left: 2 * i + 1, right: half + 2 * i + 1 });
    out.push({ side: "back", left: 2 * i + 2, right: half + 2 * i + 2 });
  }
  return out;
}

/**
 * Reading order after the job is folded (or cut) and assembled. Used to verify
 * that an imposition round-trips. Assumes left-to-right output.
 */
export function assemble(
  sides: SheetSide[],
  opts: { binding: Binding; sheetsPerSignature?: number },
): (number | null)[] {
  if (opts.binding === "perfect") {
    return [...sides.map((s) => s.left), ...sides.map((s) => s.right)];
  }

  const sheets = sides.length / 2;
  const group = opts.sheetsPerSignature && opts.sheetsPerSignature > 0
    ? Math.min(opts.sheetsPerSignature, sheets)
    : sheets;

  const pages: (number | null)[] = [];
  for (let start = 0; start < sheets; start += group) {
    const n = Math.min(group, sheets - start);
    const sig: (number | null)[] = new Array(n * PAGES_PER_SHEET).fill(null);
    for (let i = 0; i < n; i++) {
      const front = sides[(start + i) * 2]!;
      const back = sides[(start + i) * 2 + 1]!;
      sig[2 * i] = front.right;
      sig[2 * i + 1] = back.left;
      sig[sig.length - 1 - 2 * i] = front.left;
      sig[sig.length - 2 - 2 * i] = back.right;
    }
    pages.push(...sig);
  }
  return pages;
}
