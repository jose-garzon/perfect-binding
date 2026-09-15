/**
 * What the preview caption says about the side on show. Pure and DOM-free, so
 * the wording is tested rather than eyeballed.
 */
import type { SheetSide } from "../../core/imposition";

/**
 * Which source pages the side carries. A padding slot has no source page behind
 * it, and a saddle-stitched side routinely carries two pages from opposite ends
 * of the document — so a range is only written where the two are adjacent.
 */
export function sourcePages(side: SheetSide): string {
  const on = [side.left, side.right].filter((p): p is number => p !== null).sort((a, b) => a - b);
  if (on.length === 0) return "blank";
  if (on.length === 1) return `page ${on[0]}`;
  return on[1] === on[0]! + 1 ? `pages ${on[0]}–${on[1]}` : `pages ${on[0]}, ${on[1]}`;
}
