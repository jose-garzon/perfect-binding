/** Dev server: serves the renderer with HMR for `bun run dev`. */
import index from "./src/renderer/index.html";

const WORKER = "node_modules/pdfjs-dist/build/pdf.worker.min.mjs";

const server = Bun.serve({
  port: Number(process.env.PORT ?? 3123),
  routes: {
    "/": index,
    "/pdf.worker.min.mjs": () =>
      new Response(Bun.file(WORKER), { headers: { "content-type": "text/javascript" } }),
    // index.html declares @font-face outside the bundle, so dev serves the files.
    "/fonts/:file": (req) => {
      const name = req.params.file;
      if (!/^[\w.-]+\.woff2$/.test(name)) return new Response("not found", { status: 404 });
      return new Response(Bun.file(`src/renderer/fonts/${name}`),
        { headers: { "content-type": "font/woff2" } });
    },
  },
  development: { hmr: true, console: true },
});

console.log(`Perfect Binding dev server → ${server.url}`);
