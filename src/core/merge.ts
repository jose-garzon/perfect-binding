import { PDFDocument } from "pdf-lib";

export interface MergeSource {
  bytes: Uint8Array;
  /** Kept pages, 1-based. Normalised to an ascending set. */
  pages: number[];
}

/**
 * Composes one PDF from the kept pages of several sources: source order is
 * kept, and pages run ascending within each source. Sources are read, never
 * modified.
 */
export async function mergeSources(sources: MergeSource[]): Promise<Uint8Array> {
  const out = await PDFDocument.create();
  out.setProducer("Perfect Binding");
  out.setCreator("Perfect Binding");
  for (const { bytes, pages } of sources) {
    const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const count = src.getPageCount();
    const indices = [...new Set(pages)]
      .filter((p) => Number.isInteger(p) && p >= 1 && p <= count)
      .sort((a, b) => a - b)
      .map((p) => p - 1);
    if (indices.length === 0) continue;
    const copied = await out.copyPages(src, indices);
    for (const page of copied) out.addPage(page);
  }
  if (out.getPageCount() === 0) throw new Error("No pages are selected.");
  return out.save();
}
