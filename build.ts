/** Production bundle of the renderer into dist/. */
import { rm, cp, mkdir } from "node:fs/promises";

await rm("dist", { recursive: true, force: true });
await mkdir("dist", { recursive: true });

const result = await Bun.build({
  entrypoints: ["src/renderer/index.html"],
  outdir: "dist",
  minify: true,
  sourcemap: "linked",
  // Electron loads the bundle over file://, so every asset must be relative.
  publicPath: "./",
  define: { "process.env.NODE_ENV": '"production"' },
});

if (!result.success) {
  for (const log of result.logs) console.error(log);
  process.exit(1);
}

await cp("node_modules/pdfjs-dist/build/pdf.worker.min.mjs", "dist/pdf.worker.min.mjs");

const bytes = result.outputs.reduce((n, o) => n + o.size, 0);
console.log(`Built ${result.outputs.length} files → dist/ (${(bytes / 1e6).toFixed(1)} MB)`);
