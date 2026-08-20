/**
 * Whitespace detection. Works on raw RGBA pixels so it stays testable and
 * independent of canvas/DOM.
 */

export interface Bounds {
  /** Fractions of page width/height, measured from the top-left. */
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export const FULL_PAGE: Bounds = { left: 0, top: 0, right: 0, bottom: 0 };

export interface DetectOptions {
  /**
   * How dark a pixel must be to count as content, 0-255. Higher tolerates
   * scanner grey; lower keeps faint content.
   */
  threshold?: number;
  /** Extra breathing room kept around detected content, as a page fraction. */
  padding?: number;
  /**
   * Ignore rows/columns whose ink covers less than this fraction of the page.
   * Kills scan speckle and page-edge shadows.
   */
  noiseFloor?: number;
}

/**
 * Returns the whitespace margins around the content of one rendered page.
 * `data` is RGBA, row-major, as produced by CanvasRenderingContext2D.
 */
export function detectMargins(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  opts: DetectOptions = {},
): Bounds {
  const threshold = opts.threshold ?? 245;
  const padding = opts.padding ?? 0.005;
  const noiseFloor = opts.noiseFloor ?? 0.002;

  const rowInk = new Uint32Array(height);
  const colInk = new Uint32Array(width);

  for (let y = 0; y < height; y++) {
    const row = y * width * 4;
    for (let x = 0; x < width; x++) {
      const i = row + x * 4;
      const a = data[i + 3]!;
      if (a === 0) continue; // transparent renders as paper
      // Perceptual-ish luminance, blended onto white for partial alpha.
      const lum = 0.299 * data[i]! + 0.587 * data[i + 1]! + 0.114 * data[i + 2]!;
      const onWhite = lum * (a / 255) + 255 * (1 - a / 255);
      if (onWhite < threshold) {
        rowInk[y]!++;
        colInk[x]!++;
      }
    }
  }

  const top = firstInk(rowInk, width, noiseFloor);
  if (top < 0) return { ...FULL_PAGE };
  const bottom = lastInk(rowInk, width, noiseFloor);
  const left = firstInk(colInk, height, noiseFloor);
  const right = lastInk(colInk, height, noiseFloor);

  return {
    left: clamp(left / width - padding),
    top: clamp(top / height - padding),
    right: clamp(1 - (right + 1) / width - padding),
    bottom: clamp(1 - (bottom + 1) / height - padding),
  };
}

function firstInk(ink: Uint32Array, span: number, noiseFloor: number): number {
  const min = Math.max(1, Math.floor(span * noiseFloor));
  for (let i = 0; i < ink.length; i++) if (ink[i]! >= min) return i;
  return -1;
}

function lastInk(ink: Uint32Array, span: number, noiseFloor: number): number {
  const min = Math.max(1, Math.floor(span * noiseFloor));
  for (let i = ink.length - 1; i >= 0; i--) if (ink[i]! >= min) return i;
  return ink.length - 1;
}

const clamp = (v: number) => Math.min(0.45, Math.max(0, v));

/**
 * Merges per-page margins into one crop the whole document can share, keeping
 * the smallest margin seen on each edge so nothing gets clipped.
 */
export function unionMargins(all: Bounds[]): Bounds {
  if (all.length === 0) return { ...FULL_PAGE };
  return all.reduce((acc, b) => ({
    left: Math.min(acc.left, b.left),
    top: Math.min(acc.top, b.top),
    right: Math.min(acc.right, b.right),
    bottom: Math.min(acc.bottom, b.bottom),
  }));
}

/**
 * Same idea, but tolerant of outliers: takes a low percentile per edge so a
 * single full-bleed page (a cover, a photo) doesn't cancel the crop.
 */
export function robustMargins(all: Bounds[], percentile = 0.1): Bounds {
  if (all.length === 0) return { ...FULL_PAGE };
  const at = (key: keyof Bounds) => {
    const vals = all.map((b) => b[key]).sort((a, b) => a - b);
    const i = Math.min(vals.length - 1, Math.floor(vals.length * percentile));
    return vals[i]!;
  };
  return { left: at("left"), top: at("top"), right: at("right"), bottom: at("bottom") };
}

/** Converts fractional margins to a PDF-space box (origin bottom-left). */
export function toBox(b: Bounds, width: number, height: number) {
  return {
    left: b.left * width,
    bottom: b.bottom * height,
    right: width - b.right * width,
    top: height - b.top * height,
  };
}
