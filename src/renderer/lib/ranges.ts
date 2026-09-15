/**
 * The page-range syntax behind the Pages field: a text form of the kept-page
 * selection, e.g. `1-4, 9, 12-`. Pure and DOM-free, so the leniency lives in
 * one tested place.
 */

export type ParseResult =
  | { ok: true; pages: number[] }
  | { ok: false; error: string };

const SEPARATORS = /[,;\n]+/;

/**
 * Reads a range list into an ascending, deduplicated page list. Tolerates
 * whitespace, open-ended ranges (`12-`, `-4`), overlaps, and descending pairs.
 * A selection that resolves to no pages is an error, not an empty list.
 */
export function parseRanges(text: string, pageCount: number): ParseResult {
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, error: "Enter at least one page." };

  const kept = new Set<number>();
  for (const raw of trimmed.split(SEPARATORS)) {
    const token = raw.trim();
    if (!token) continue;

    const match = /^(\d*)\s*(?:[-–—]\s*(\d*))?$/.exec(token);
    if (!match || (!match[1] && match[2] === undefined)) {
      return { ok: false, error: `"${token}" is not a page or a range.` };
    }
    const open = match[2] !== undefined; // the token carried a dash
    const startText = match[1] ?? "";
    const endText = match[2] ?? "";
    if (open && !startText && !endText) {
      return { ok: false, error: `"${token}" is not a page or a range.` };
    }

    let start = startText ? Number(startText) : 1;
    let end = open ? (endText ? Number(endText) : pageCount) : start;
    if (start < 1 || end < 1) {
      return { ok: false, error: `Pages start at 1, so "${token}" cannot be used.` };
    }
    if (start > end) [start, end] = [end, start];
    if (start > pageCount) {
      return {
        ok: false,
        error: `"${token}" is past the last page (${pageCount}).`,
      };
    }
    for (let p = start; p <= Math.min(end, pageCount); p++) kept.add(p);
  }

  if (kept.size === 0) return { ok: false, error: "Enter at least one page." };
  return { ok: true, pages: [...kept].sort((a, b) => a - b) };
}

/** Writes an ascending page list back as a range list: `1-4, 9, 12-20`. */
export function formatRanges(kept: Iterable<number>): string {
  const pages = [...new Set(kept)].sort((a, b) => a - b);
  const parts: string[] = [];
  let i = 0;
  while (i < pages.length) {
    const start = pages[i]!;
    let end = start;
    while (i + 1 < pages.length && pages[i + 1] === end + 1) {
      end = pages[++i]!;
    }
    parts.push(start === end ? `${start}` : `${start}-${end}`);
    i++;
  }
  return parts.join(", ");
}

/** A printer page range, 0-based and inclusive, as Electron's print API takes it. */
export interface PageRange {
  from: number;
  to: number;
}

/**
 * Maps sheets of paper onto the output pages that carry them, for printing.
 *
 * Everything in the app is counted in sheets, but a printer is told which pages
 * of the built document to run. A two-up sheet is two output pages — sheet `n`
 * is pages `2n-1` and `2n`, 0-based `2n-2` and `2n-1` — while a margins-only
 * job puts one source page on one output page, so the two counts coincide.
 * Adjacent sheets are coalesced, so `1-10` leaves as one range and not ten.
 */
export function sheetsToPageRanges(sheets: Iterable<number>, twoUp: boolean): PageRange[] {
  const sorted = [...new Set(sheets)].filter((n) => n >= 1).sort((a, b) => a - b);

  const out: PageRange[] = [];
  let i = 0;
  while (i < sorted.length) {
    const start = sorted[i]!;
    let end = start;
    while (i + 1 < sorted.length && sorted[i + 1] === end + 1) {
      end = sorted[++i]!;
    }
    out.push(twoUp
      ? { from: 2 * start - 2, to: 2 * end - 1 }
      : { from: start - 1, to: end - 1 });
    i++;
  }
  return out;
}
