/**
 * End-to-end smoke test: boots the packaged renderer, drops a generated PDF on
 * it, and checks that a preview sheet actually renders. Run with
 *   bun run smoke
 */
const { app, BrowserWindow } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const { PDFDocument, StandardFonts, rgb } = require("pdf-lib");
const { applyCsp } = require("../electron/csp.cjs");

const OUT = process.env.PB_SMOKE_OUT || "/tmp/pb-smoke.png";
const errors = [];

/**
 * A deliberately chunky document: the renderer must never route PDF bytes
 * through React props, so a few megabytes here catches that regression.
 */
async function samplePdf(n = 40) {
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
  // Padding keeps the file in the megabytes, which is where a PDF routed
  // through React props starts breaking the development build.
  const filler = require("node:crypto").randomBytes(3 * 1024 * 1024); // incompressible
  await doc.attach(filler, "filler.bin", { mimeType: "application/octet-stream" });
  return doc.save();
}

app.commandLine.appendSwitch("disable-gpu-compositing");

app.whenReady().then(async () => {
  applyCsp(process.env.PB_DEV_URL);
  const win = new BrowserWindow({
    width: 1360, height: 900, show: true,
    webPreferences: { preload: path.join(__dirname, "..", "electron", "preload.cjs") },
  });
  win.webContents.on("console-message", (e) => {
    const level = typeof e === "object" && e.level !== undefined ? e.level : "";
    const text = typeof e === "object" ? e.message : "";
    if (String(level) === "error" || String(level) === "3") errors.push(text);
    if (process.env.PB_SMOKE_VERBOSE) console.log("[renderer]", level, text);
  });
  win.webContents.on("render-process-gone", (_e, d) => fail(`renderer gone: ${d.reason}`));

  // PB_DEV_URL runs the same checks against the hot-reloading dev server.
  if (process.env.PB_DEV_URL) await win.loadURL(process.env.PB_DEV_URL);
  else await win.loadFile(path.join(__dirname, "..", "dist", "index.html"));

  const mounted = await win.webContents.executeJavaScript(
    `document.querySelector('#root')?.childElementCount > 0 && document.body.innerText.slice(0, 80)`);
  if (!mounted) fail("renderer did not mount");
  console.log("mounted:", JSON.stringify(mounted));

  const pdf = await samplePdf();
  console.log("sample pdf:", (pdf.length / 1024).toFixed(0), "KB");
  // The packaged app must refuse inline scripts; the dev server needs them for HMR.
  const inlineRan = await win.webContents.executeJavaScript(`(() => {
    const el = document.createElement('script');
    el.textContent = 'window.__inline = 1';
    document.head.appendChild(el);
    el.remove();
    return window.__inline === 1;
  })()`);
  const expectInline = Boolean(process.env.PB_DEV_URL);
  console.log("csp: inline script", inlineRan ? "allowed" : "blocked");
  if (inlineRan !== expectInline) {
    fail(`content-security-policy wrong: inline script ${inlineRan ? "allowed" : "blocked"}`);
  }
  errors.length = 0; // the blocked-script report above is the expected outcome

  const b64 = Buffer.from(pdf).toString("base64");
  await win.webContents.executeJavaScript(`(() => {
    const bin = atob(${JSON.stringify(b64)});
    const u8 = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    const file = new File([u8], "sample.pdf", { type: "application/pdf" });
    const dt = new DataTransfer();
    dt.items.add(file);
    const zone = document.querySelector('.dropzone');
    zone.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
    return true;
  })()`);

  const state = await waitFor(win, `(() => {
    const c = document.querySelector('.sheet canvas');
    if (!c || c.width === 300) return null;
    const ctx = c.getContext('2d');
    const px = ctx.getImageData(0, 0, c.width, c.height).data;
    let ink = 0;
    for (let i = 0; i < px.length; i += 4) if (px[i] < 240) ink++;
    return {
      canvas: [c.width, c.height],
      inkPixels: ink,
      stats: [...document.querySelectorAll('.stat')].map(s => s.innerText.replace('\\n', ': ')),
      label: document.querySelector('.sheet-label')?.innerText,
    };
  })()`, 25000);

  if (!state) {
    const diag = await win.webContents.executeJavaScript(
      `({ error: document.querySelector('.error')?.innerText || null,
          label: document.querySelector('.sheet-label')?.innerText,
          stats: [...document.querySelectorAll('.stat')].map(s => s.innerText.replace('\\n',': ')) })`);
    console.error("diagnostics:", JSON.stringify(diag, null, 2));
    fail("no preview sheet rendered within 25s");
  }
  console.log("preview:", JSON.stringify(state, null, 2));
  if (state.inkPixels < 200) fail(`preview looks blank (${state.inkPixels} inked pixels of ${state.canvas[0] * state.canvas[1]})`);
  if (state.canvas[0] <= state.canvas[1]) fail("sheet is not landscape");
  if (!/^Sheet 1 /.test(state.label || "")) fail(`unexpected sheet label: ${state.label}`);

  await shoot(win, OUT);

  // 2. turn on margin trimming and check the crop panel + a bigger print area
  await win.webContents.executeJavaScript(
    `[...document.querySelectorAll('.switch')].find(l => l.innerText.includes('Trim page margins'))
       .querySelector('input').click(), true`);
  const cropped = await waitFor(win, `(() => {
    const box = document.querySelector('.crop-box');
    const mini = document.querySelector('.crop-preview canvas');
    const c = document.querySelector('.sheet canvas');
    if (!box || !mini || !mini.width || !c || c.width === 300) return null;
    // wait until the preview has actually been rebuilt with the new crop
    const px = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let ink = 0;
    for (let i = 0; i < px.length; i += 4) if (px[i] < 240) ink++;
    if (ink === ${state.inkPixels}) return null;
    return { ink, inset: box.style.left, trimmed: [...document.querySelectorAll('.stat')].pop().innerText };
  })()`, 25000);
  if (!cropped) fail("crop panel never appeared");
  console.log("cropped:", JSON.stringify(cropped));
  if (cropped.ink <= state.inkPixels) {
    fail(`trimming did not enlarge the content (${state.inkPixels} -> ${cropped.ink})`);
  }
  await shoot(win, OUT.replace(/\.png$/, "-crop.png"));

  // 3. switch to perfect binding and confirm the layout changes
  await win.webContents.executeJavaScript(
    `[...document.querySelectorAll('.card')].find(b => b.innerText.includes('Perfect binding')).click(), true`);
  const perfect = await waitFor(win, `(() => {
    const label = document.querySelector('.sheet-label')?.innerText;
    const c = document.querySelector('.sheet canvas');
    return label && c && c.width !== 300 && !document.querySelector('.sheet .fold')
      ? { label, guide: !!document.querySelector('.sheet .fold') } : null;
  })()`, 20000);
  if (!perfect) fail("perfect binding layout never rendered");
  console.log("perfect:", JSON.stringify(perfect));
  await shoot(win, OUT.replace(/\.png$/, "-perfect.png"));

  if (errors.length) fail(`console errors:\n${errors.join("\n")}`);
  console.log("SMOKE OK");
  app.exit(0);
}).catch((e) => fail(e && e.stack || String(e)));

async function shoot(win, file) {
  const img = await win.webContents.capturePage();
  fs.writeFileSync(file, img.toPNG());
  console.log("screenshot:", file);
}

async function waitFor(win, expr, timeout) {
  const until = Date.now() + timeout;
  while (Date.now() < until) {
    const v = await win.webContents.executeJavaScript(expr);
    if (v) return v;
    await new Promise((r) => setTimeout(r, 250));
  }
  return null;
}

let failed = false;
function fail(msg) {
  if (failed) return;
  failed = true;
  console.error("SMOKE FAIL:", msg);
  process.exitCode = 1;
  if (errors.length) console.error("console errors:", errors.join("\n"));
  app.exit(1);
  throw new Error(msg);
}
