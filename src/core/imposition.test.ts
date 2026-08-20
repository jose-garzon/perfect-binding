import { test, expect, describe } from "bun:test";
import {
  impose,
  assemble,
  sheetCount,
  blankCount,
  padToSheet,
  type SheetSide,
} from "./imposition";

const pair = (s: SheetSide) => [s.left, s.right];

describe("padding", () => {
  test("rounds up to whole sheets", () => {
    expect(padToSheet(1)).toBe(4);
    expect(padToSheet(4)).toBe(4);
    expect(padToSheet(5)).toBe(8);
    expect(sheetCount(9)).toBe(3);
    expect(blankCount(9)).toBe(3);
  });
});

describe("saddle stitch", () => {
  test("8 pages nest onto 2 sheets", () => {
    const sides = impose({ binding: "saddle", pageCount: 8 });
    expect(sides.map(pair)).toEqual([
      [8, 1],
      [2, 7],
      [6, 3],
      [4, 5],
    ]);
  });

  test("folded order matches the source", () => {
    for (const n of [4, 8, 12, 20, 40]) {
      const sides = impose({ binding: "saddle", pageCount: n });
      expect(assemble(sides, { binding: "saddle" })).toEqual(
        Array.from({ length: n }, (_, i) => i + 1),
      );
    }
  });

  test("odd page counts get blank slots at the back", () => {
    const sides = impose({ binding: "saddle", pageCount: 5 });
    expect(sides.map(pair)).toEqual([
      [null, 1],
      [2, null],
      [null, 3],
      [4, 5],
    ]);
  });

  test("signatures stay self-contained and stack in order", () => {
    const sides = impose({ binding: "saddle", pageCount: 16, sheetsPerSignature: 2 });
    expect(sides.map(pair)).toEqual([
      [8, 1],
      [2, 7],
      [6, 3],
      [4, 5],
      [16, 9],
      [10, 15],
      [14, 11],
      [12, 13],
    ]);
    expect(assemble(sides, { binding: "saddle", sheetsPerSignature: 2 })).toEqual(
      Array.from({ length: 16 }, (_, i) => i + 1),
    );
  });

  test("a partial last signature still round-trips", () => {
    const sides = impose({ binding: "saddle", pageCount: 24, sheetsPerSignature: 4 });
    expect(assemble(sides, { binding: "saddle", sheetsPerSignature: 4 })).toEqual(
      Array.from({ length: 24 }, (_, i) => i + 1),
    );
  });
});

describe("perfect binding", () => {
  test("8 pages cut-stack onto 2 sheets", () => {
    const sides = impose({ binding: "perfect", pageCount: 8 });
    expect(sides.map(pair)).toEqual([
      [1, 5],
      [2, 6],
      [3, 7],
      [4, 8],
    ]);
  });

  test("cut stack reassembles in order", () => {
    for (const n of [4, 8, 16, 32, 100]) {
      const sides = impose({ binding: "perfect", pageCount: n });
      expect(assemble(sides, { binding: "perfect" })).toEqual(
        Array.from({ length: n }, (_, i) => i + 1),
      );
    }
  });

  test("left pile is the first half of the book", () => {
    const sides = impose({ binding: "perfect", pageCount: 12 });
    expect(sides.map((s) => s.left)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(sides.map((s) => s.right)).toEqual([7, 8, 9, 10, 11, 12]);
  });
});

describe("output shape", () => {
  test("sides alternate front/back per sheet", () => {
    const sides = impose({ binding: "saddle", pageCount: 12 });
    expect(sides.map((s) => `${s.sheet}${s.side[0]}`)).toEqual([
      "0f", "0b", "1f", "1b", "2f", "2b",
    ]);
  });

  test("long-edge duplex rotates only the back sides", () => {
    const sides = impose({ binding: "perfect", pageCount: 8, duplexFlip: "long" });
    expect(sides.map((s) => s.rotate180)).toEqual([false, true, false, true]);
  });

  test("short-edge duplex rotates nothing", () => {
    const sides = impose({ binding: "perfect", pageCount: 8, duplexFlip: "short" });
    expect(sides.every((s) => !s.rotate180)).toBe(true);
  });

  test("rtl mirrors every slot", () => {
    const ltr = impose({ binding: "saddle", pageCount: 8 });
    const rtl = impose({ binding: "saddle", pageCount: 8, rtl: true });
    expect(rtl.map(pair)).toEqual(ltr.map((s) => [s.right, s.left]));
  });

  test("no page is placed twice", () => {
    const sides = impose({ binding: "saddle", pageCount: 37 });
    const placed = sides.flatMap(pair).filter((p) => p !== null);
    expect(new Set(placed).size).toBe(37);
  });
});
