import { test, expect, describe } from "bun:test";
import { formatRanges, parseRanges } from "./ranges";

const pages = (text: string, count = 20) => {
  const r = parseRanges(text, count);
  return r.ok ? r.pages : r.error;
};

describe("parseRanges", () => {
  test("reads pages, ranges, and open ends", () => {
    expect(pages("1-4, 9, 12-")).toEqual([1, 2, 3, 4, 9, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
    expect(pages("-3", 10)).toEqual([1, 2, 3]);
    expect(pages("7", 10)).toEqual([7]);
  });

  test("tolerates whitespace and stray separators", () => {
    expect(pages("  2 - 4 ,,; 6  ", 10)).toEqual([2, 3, 4, 6]);
  });

  test("normalises overlaps, duplicates, and descending pairs", () => {
    expect(pages("5-2, 3, 3-4", 10)).toEqual([2, 3, 4, 5]);
  });

  test("clamps a range that runs past the last page", () => {
    expect(pages("8-99", 10)).toEqual([8, 9, 10]);
  });

  test("rejects text that is not a range", () => {
    expect(pages("banana")).toBe('"banana" is not a page or a range.');
    expect(pages("1-4, banana")).toBe('"banana" is not a page or a range.');
    expect(pages("-")).toBe('"-" is not a page or a range.');
  });

  test("rejects page zero", () => {
    expect(pages("0", 10)).toBe('Pages start at 1, so "0" cannot be used.');
    expect(pages("0-3", 10)).toBe('Pages start at 1, so "0-3" cannot be used.');
  });

  test("rejects a range wholly past the document", () => {
    expect(pages("50", 20)).toBe('"50" is past the last page (20).');
  });

  test("rejects an empty selection", () => {
    expect(pages("", 10)).toBe("Enter at least one page.");
    expect(pages("   ", 10)).toBe("Enter at least one page.");
  });
});

describe("formatRanges", () => {
  test("compresses runs and leaves singles alone", () => {
    expect(formatRanges([1, 2, 3, 4, 9, 12, 13])).toBe("1-4, 9, 12-13");
    expect(formatRanges([2, 4, 6])).toBe("2, 4, 6");
    expect(formatRanges([])).toBe("");
  });

  test("sorts and deduplicates", () => {
    expect(formatRanges([3, 1, 2, 2])).toBe("1-3");
  });

  test("round-trips through the parser", () => {
    const kept = [1, 2, 3, 4, 7, 8, 9, 20];
    const round = parseRanges(formatRanges(kept), 20);
    expect(round.ok && round.pages).toEqual(kept);
  });
});
