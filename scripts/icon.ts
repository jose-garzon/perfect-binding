/** Rasterises assets/icon.svg into the PNGs electron-builder packages. */
import { Resvg } from "@resvg/resvg-js";

const svg = await Bun.file("assets/icon.svg").text();

// 1024 is what electron-builder wants for the .icns/.ico it derives; the
// smaller sizes are the Linux icon set.
const sizes = [1024, 512, 256, 128, 64, 32];

for (const size of sizes) {
  const png = new Resvg(svg, { fitTo: { mode: "width", value: size } }).render().asPng();
  const path = size === 1024 ? "assets/icon.png" : `assets/icons/${size}x${size}.png`;
  await Bun.write(path, png);
  console.log(`${path} (${(png.byteLength / 1024).toFixed(0)} KB)`);
}
