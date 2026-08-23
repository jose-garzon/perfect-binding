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
