import { test, expect, describe } from "bun:test";
import { sourcePages } from "./caption";
import type { SheetSide } from "../../core/imposition";

const side = (left: number | null, right: number | null): SheetSide =>
  ({ sheet: 0, side: "front", left, right, rotate180: false });

describe("the source pages named in the caption", () => {
  test("adjacent pages are written as a range", () => {
    expect(sourcePages(side(3, 4))).toBe("pages 3–4");
  });

  test("a saddle-stitched side names both ends", () => {
    expect(sourcePages(side(18, 3))).toBe("pages 3, 18");
  });

  test("a padding slot leaves one page", () => {
    expect(sourcePages(side(3, null))).toBe("page 3");
    expect(sourcePages(side(null, 7))).toBe("page 7");
  });

  test("a wholly blank side says so", () => {
    expect(sourcePages(side(null, null))).toBe("blank");
  });
});
