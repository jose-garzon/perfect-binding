import { test, expect, describe } from "bun:test";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { buildBooklet } from "./build";

/** A source document whose pages are numbered, at A4 portrait. */
async function sourcePdf(n: number, w = 595.28, h = 841.89): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 1; i <= n; i++) {
    const page = doc.addPage([w, h]);
    page.drawText(String(i), { x: w / 2, y: h / 2, size: 48, font });
    page.drawRectangle({ x: 40, y: 40, width: w - 80, height: h - 80, borderWidth: 1,
      borderColor: rgb(0, 0, 0) });
  }
  return doc.save();
}

const sizesOf = async (bytes: Uint8Array) => {
  const doc = await PDFDocument.load(bytes);
  return doc.getPages().map((p) => p.getSize());
};

describe("buildBooklet", () => {
  test("saddle stitch emits one landscape page per sheet side", async () => {
    const out = await buildBooklet(await sourcePdf(8), { binding: "saddle", paperId: "a4" });
    expect(out.pages).toBe(4);
    expect(out.sheets).toBe(2);
    expect(out.blanks).toBe(0);
    const sizes = await sizesOf(out.bytes);
    expect(sizes).toHaveLength(4);
    for (const s of sizes) expect(s.width).toBeGreaterThan(s.height);
  });

  test("counts the blanks added as padding", async () => {
    const out = await buildBooklet(await sourcePdf(5), { binding: "saddle", paperId: "a4" });
    expect(out.pages).toBe(4);
    expect(out.blanks).toBe(3);
  });

  test("perfect binding lays pages out as a cut stack", async () => {
    const out = await buildBooklet(await sourcePdf(8), { binding: "perfect", paperId: "letter" });
    expect(out.layout.map((s) => [s.left, s.right])).toEqual([
      [1, 5], [2, 6], [3, 7], [4, 8],
    ]);
  });

  test("long-edge duplex rotates back sides in the output pdf", async () => {
    const out = await buildBooklet(await sourcePdf(8), {
      binding: "saddle", paperId: "a4", duplexFlip: "long",
    });
    const doc = await PDFDocument.load(out.bytes);
    expect(doc.getPages().map((p) => p.getRotation().angle)).toEqual([0, 180, 0, 180]);
  });

  test("margins-only mode keeps one page per page", async () => {
    const out = await buildBooklet(await sourcePdf(6), {
      binding: "none", paperId: "a4",
      crop: { left: 0.1, top: 0.1, right: 0.1, bottom: 0.1 },
    });
    expect(out.pages).toBe(6);
    const sizes = await sizesOf(out.bytes);
    for (const s of sizes) expect(s.height).toBeGreaterThan(s.width);
  });

  test("source paper keeps the document's own dimensions", async () => {
    const out = await buildBooklet(await sourcePdf(4, 300, 500), {
      binding: "saddle", paperId: "source",
    });
    const sizes = await sizesOf(out.bytes);
    for (const s of sizes) {
      expect(Math.round(s.width)).toBe(600);
      expect(Math.round(s.height)).toBe(500);
    }
  });

  test("guides and crop marks do not change the page count", async () => {
    const plain = await buildBooklet(await sourcePdf(4), { binding: "saddle", paperId: "a4" });
    const marked = await buildBooklet(await sourcePdf(4), {
      binding: "saddle", paperId: "a4", guideLine: true, cropMarks: true, outerMargin: 18,
    });
    expect(marked.pages).toBe(plain.pages);
    expect(marked.bytes.byteLength).toBeGreaterThan(0);
  });

  test("reports progress up to the total", async () => {
    const seen: number[] = [];
    const out = await buildBooklet(await sourcePdf(12), {
      binding: "saddle", paperId: "a4",
      onProgress: (done, total) => seen.push(done / total),
    });
    expect(seen).toHaveLength(out.pages);
    expect(seen.at(-1)).toBe(1);
  });

  test("a per-page crop array is accepted", async () => {
    const crop = Array.from({ length: 4 }, (_, i) => ({
      left: i * 0.02, top: 0.05, right: 0.05, bottom: 0.05,
    }));
    const out = await buildBooklet(await sourcePdf(4), {
      binding: "perfect", paperId: "a4", crop,
    });
    expect(out.pages).toBe(2);
  });

  test("blank source pages become empty slots instead of crashing", async () => {
    const doc = await PDFDocument.load(await sourcePdf(3));
    doc.insertPage(1, [595.28, 841.89]); // a page with no content stream at all
    const out = await buildBooklet(await doc.save(), { binding: "saddle", paperId: "a4" });
    expect(out.pages).toBe(2); // 4 pages, the second of which is blank
    expect(out.layout.map((s) => [s.left, s.right])).toEqual([[4, 1], [2, 3]]);
  });

  test("rejects a document with no usable pages", async () => {
    const doc = await PDFDocument.create();
    doc.addPage([200, 200]);
    expect(buildBooklet(await doc.save(), { binding: "saddle", paperId: "a4" })).rejects.toThrow(
      "blank",
    );
  });
});
