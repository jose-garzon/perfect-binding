/**
 * The document the smoke test and the README screenshots both run on: plain
 * body text, enough pages to make a real signature, and padded into the
 * megabytes because that is where a PDF routed through React props breaks.
 */
const { PDFDocument, StandardFonts, rgb } = require("pdf-lib");

async function samplePdf(n = 40, { pad = true } = {}) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.TimesRoman);
  for (let i = 1; i <= n; i++) {
    const page = doc.addPage([595.28, 841.89]);
    page.drawText(`Chapter page ${i}`, { x: 150, y: 620, size: 26, font });
    for (let l = 0; l < 26; l++) {
      page.drawText("The quick brown fox jumps over the lazy dog, again and again.",
        { x: 150, y: 580 - l * 20, size: 11, font, color: rgb(0.15, 0.15, 0.15) });
    }
  }
  if (pad) {
    const filler = require("node:crypto").randomBytes(3 * 1024 * 1024); // incompressible
    await doc.attach(filler, "filler.bin", { mimeType: "application/octet-stream" });
  }
  return doc.save();
}

module.exports = { samplePdf };
