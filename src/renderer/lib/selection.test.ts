import { test, expect } from "bun:test";
import { keptPages } from "./selection";

test("kept pages are ascending and skip removals", () => {
  expect(keptPages(6, new Set([2, 5]))).toEqual([1, 3, 4, 6]);
});

test("each source's selection is independent of the others", () => {
  const a = new Set([1, 2]);
  const b = new Set<number>();
  expect(keptPages(3, a)).toEqual([3]);
  expect(keptPages(3, b)).toEqual([1, 2, 3]);
});
