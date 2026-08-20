import { test, expect, describe } from "bun:test";
import { detectMargins, unionMargins, robustMargins, toBox, type Bounds } from "./crop";

/** Paints a white page with one black rectangle, in pixel coordinates. */
function page(w: number, h: number, rect?: { x: number; y: number; w: number; h: number }) {
  const data = new Uint8ClampedArray(w * h * 4).fill(255);
  if (rect) {
    for (let y = rect.y; y < rect.y + rect.h; y++) {
      for (let x = rect.x; x < rect.x + rect.w; x++) {
        const i = (y * w + x) * 4;
        data[i] = data[i + 1] = data[i + 2] = 0;
      }
    }
  }
  return { data, w, h };
}

const round = (b: Bounds) =>
  Object.fromEntries(Object.entries(b).map(([k, v]) => [k, Math.round(v * 100) / 100]));

describe("detectMargins", () => {
  test("finds a centred content block", () => {
    const p = page(100, 100, { x: 20, y: 10, w: 60, h: 70 });
    const b = detectMargins(p.data, p.w, p.h, { padding: 0, noiseFloor: 0 });
    expect(round(b)).toEqual({ left: 0.2, top: 0.1, right: 0.2, bottom: 0.2 });
  });

  test("a blank page reports no crop", () => {
    const p = page(50, 50);
    expect(detectMargins(p.data, p.w, p.h)).toEqual({ left: 0, top: 0, right: 0, bottom: 0 });
  });

  test("padding gives content breathing room", () => {
    const p = page(100, 100, { x: 30, y: 30, w: 40, h: 40 });
    const b = detectMargins(p.data, p.w, p.h, { padding: 0.05, noiseFloor: 0 });
    expect(round(b)).toEqual({ left: 0.25, top: 0.25, right: 0.25, bottom: 0.25 });
  });

  test("crop never exceeds 45% of a side", () => {
    const p = page(100, 100, { x: 49, y: 49, w: 2, h: 2 });
    const b = detectMargins(p.data, p.w, p.h, { noiseFloor: 0 });
    expect(Math.max(b.left, b.top, b.right, b.bottom)).toBeLessThanOrEqual(0.45);
  });

  test("noise floor ignores speckle but keeps real ink", () => {
    const p = page(200, 200, { x: 60, y: 60, w: 80, h: 80 });
    const speck = (10 * 200 + 10) * 4; // one stray dark pixel near the corner
    p.data[speck] = p.data[speck + 1] = p.data[speck + 2] = 0;
    const b = detectMargins(p.data, p.w, p.h, { padding: 0, noiseFloor: 0.02 });
    expect(round(b)).toEqual({ left: 0.3, top: 0.3, right: 0.3, bottom: 0.3 });
  });

  test("light grey below threshold counts as paper", () => {
    const p = page(100, 100, { x: 10, y: 10, w: 80, h: 80 });
    for (let i = 0; i < p.data.length; i += 4) {
      if (p.data[i] === 0) p.data[i] = p.data[i + 1] = p.data[i + 2] = 250;
    }
    expect(detectMargins(p.data, p.w, p.h, { threshold: 245 })).toEqual({
      left: 0, top: 0, right: 0, bottom: 0,
    });
  });

  test("transparent pixels are treated as paper", () => {
    const p = page(100, 100, { x: 10, y: 10, w: 80, h: 80 });
    for (let i = 0; i < p.data.length; i += 4) p.data[i + 3] = 0;
    expect(detectMargins(p.data, p.w, p.h)).toEqual({ left: 0, top: 0, right: 0, bottom: 0 });
  });
});

describe("combining pages", () => {
  const pages: Bounds[] = [
    { left: 0.2, top: 0.2, right: 0.2, bottom: 0.2 },
    { left: 0.1, top: 0.3, right: 0.2, bottom: 0.2 },
    { left: 0, top: 0, right: 0, bottom: 0 }, // full-bleed cover
  ];

  test("union keeps the safest crop", () => {
    expect(unionMargins(pages)).toEqual({ left: 0, top: 0, right: 0, bottom: 0 });
  });

  test("robust ignores a single outlier page", () => {
    const many = [...Array(20)].map(() => pages[0]!).concat(pages[2]!);
    expect(robustMargins(many)).toEqual(pages[0]!);
  });

  test("empty input means no crop", () => {
    expect(unionMargins([])).toEqual({ left: 0, top: 0, right: 0, bottom: 0 });
    expect(robustMargins([])).toEqual({ left: 0, top: 0, right: 0, bottom: 0 });
  });
});

describe("toBox", () => {
  test("flips to PDF coordinates", () => {
    const box = toBox({ left: 0.1, top: 0.25, right: 0.1, bottom: 0.5 }, 100, 200);
    expect(box).toEqual({ left: 10, bottom: 100, right: 90, top: 150 });
  });
});
