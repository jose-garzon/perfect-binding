import { test, expect } from "bun:test";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { mergeSources } from "./merge";

/** A PDF whose pages carry their own label as text and a distinct width. */
async function sample(tag: string, pages: number, width = 400): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 1; i <= pages; i++) {
    const page = doc.addPage([width, 600]);
    page.drawText(`${tag}${i}`, { x: 20, y: 20, size: 12, font });
  }
  return doc.save();
}

async function widths(bytes: Uint8Array): Promise<number[]> {
  const doc = await PDFDocument.load(bytes);
  return doc.getPages().map((p) => p.getWidth());
}

const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

test("merges the example selection in source order", async () => {
  const a = await sample("a", 20, 300);
  const b = await sample("b", 40, 400);
  const c = await sample("c", 20, 500);
  const out = await mergeSources([
    { bytes: a, pages: range(1, 10) },
    { bytes: b, pages: [...range(10, 15), ...range(25, 30)] },
    { bytes: c, pages: [2, ...range(10, 15)] },
  ]);
  const w = await widths(out);
  expect(w.length).toBe(29);
  expect(w.slice(0, 10).every((x) => x === 300)).toBe(true);
  expect(w.slice(10, 22).every((x) => x === 400)).toBe(true);
  expect(w.slice(22).every((x) => x === 500)).toBe(true);
});

test("pages are ascending and deduplicated within a source", async () => {
  const a = await sample("a", 5);
  const out = await mergeSources([{ bytes: a, pages: [3, 1, 3, 99] }]);
  expect((await widths(out)).length).toBe(2);
});

test("keeps mixed page sizes", async () => {
  const out = await mergeSources([
    { bytes: await sample("a", 2, 200), pages: [1] },
    { bytes: await sample("b", 2, 600), pages: [2] },
  ]);
  expect(await widths(out)).toEqual([200, 600]);
});

test("refuses an empty job", async () => {
  const a = await sample("a", 3);
  expect(mergeSources([{ bytes: a, pages: [] }])).rejects.toThrow("No pages are selected.");
});

test("leaves the source bytes untouched", async () => {
  const a = await sample("a", 3);
  const copy = a.slice();
  await mergeSources([{ bytes: a, pages: [1, 2] }]);
  expect(a).toEqual(copy);
});
