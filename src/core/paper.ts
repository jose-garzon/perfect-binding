/** Paper sizes in PDF points (1 pt = 1/72 in). */
export interface PaperSize {
  id: string;
  label: string;
  /** Portrait dimensions. Sheets are printed landscape, i.e. swapped. */
  width: number;
  height: number;
}

export const PAPER_SIZES: PaperSize[] = [
  { id: "a4", label: "A4 · 210 × 297 mm", width: 595.28, height: 841.89 },
  { id: "letter", label: "Letter · 8.5 × 11 in", width: 612, height: 792 },
  { id: "legal", label: "Legal · 8.5 × 14 in", width: 612, height: 1008 },
  { id: "a3", label: "A3 · 297 × 420 mm", width: 841.89, height: 1190.55 },
  { id: "tabloid", label: "Tabloid · 11 × 17 in", width: 792, height: 1224 },
  { id: "a5", label: "A5 · 148 × 210 mm", width: 419.53, height: 595.28 },
];

export function paperById(id: string): PaperSize {
  return PAPER_SIZES.find((p) => p.id === id) ?? PAPER_SIZES[0]!;
}

export const MM = 72 / 25.4;
export const mm = (v: number) => v * MM;
export const toMm = (pt: number) => pt / MM;
