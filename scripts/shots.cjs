/**
 * README screenshots. Boots the packaged renderer, waits for the webfonts to
 * land, and captures the two views the README shows. Run with
 *   bun run shots
 */
const { app, BrowserWindow } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const { applyCsp } = require("../electron/csp.cjs");
const { samplePdf } = require("./sample-pdf.cjs");

const OUT = path.join(__dirname, "..", "assets", "screenshots");
const SIZE = { width: 1400, height: 900 };

app.commandLine.appendSwitch("disable-gpu-compositing");
app.commandLine.appendSwitch("force-device-scale-factor", "2"); // retina-sharp PNGs

app.whenReady().then(async () => {
  applyCsp();
  fs.mkdirSync(OUT, { recursive: true });

  const win = new BrowserWindow({
    ...SIZE,
    show: true,
    backgroundColor: "#faf8f4",
    webPreferences: { preload: path.join(__dirname, "..", "electron", "preload.cjs") },
  });
  await win.loadFile(path.join(__dirname, "..", "dist", "index.html"));

  // Fonts arrive after first paint, and the landing type is the whole point of
  // that shot, so wait for them before the shutter.
  await win.webContents.executeJavaScript("document.fonts.ready.then(() => true)");
  // The cover centres itself in whatever height it is given, so measure it in a
  // window too short to centre in — there the scroll height is the content
  // height — then grow the viewport to fit the whole page in one shot.
  win.setContentSize(SIZE.width, 480);
  await settle(win);
  const cover = await win.webContents.executeJavaScript(
    "Math.ceil(document.querySelector('.cover')?.scrollHeight || document.body.scrollHeight)");
  win.setContentSize(SIZE.width, Math.min(cover + 96, 2200));
  await settle(win);
  await shoot(win, "home.png");
  win.setContentSize(SIZE.width, SIZE.height);

  const pdf = await samplePdf(40, { pad: false });
  const b64 = Buffer.from(pdf).toString("base64");
  await win.webContents.executeJavaScript(`(() => {
    const bin = atob(${JSON.stringify(b64)});
    const file = new File([Uint8Array.from(bin, (c) => c.charCodeAt(0))], "sample.pdf",
      { type: "application/pdf" });
    const dt = new DataTransfer();
    dt.items.add(file);
    document.querySelector('.dropzone')
      .dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
    return true;
  })()`);

  if (!await waitFor(win, "document.querySelector('.sheet canvas')?.width > 300", 30000)) {
    throw new Error("preview never rendered");
  }
  await settle(win);
  await shoot(win, "editing.png");

  // margin trimming on: the crop panel and the enlarged print area
  await win.webContents.executeJavaScript(
    `[...document.querySelectorAll('.switch')].find(l => l.innerText.includes('Trim page margins'))
       .querySelector('input').click(), true`);
  if (!await waitFor(win, "!!document.querySelector('.crop-preview canvas')?.width", 30000)) {
    throw new Error("crop panel never appeared");
  }
  // the crop panel sits below the fold in the sidebar
  await win.webContents.executeJavaScript(
    "document.querySelector('.crop-preview').scrollIntoView({ block: 'center' }), true");
  await settle(win);
  await shoot(win, "trim.png");

  app.exit(0);
}).catch((e) => {
  console.error("SHOTS FAILED:", e && e.stack || String(e));
  app.exit(1);
});

async function shoot(win, name) {
  const img = await win.webContents.capturePage();
  const file = path.join(OUT, name);
  fs.writeFileSync(file, img.toPNG());
  console.log(`${name} (${(fs.statSync(file).size / 1024).toFixed(0)} KB)`);
}

/** One more frame after the state settles, so nothing is caught mid-render. */
function settle(win) {
  return win.webContents.executeJavaScript(
    "new Promise(r => requestAnimationFrame(() => setTimeout(() => r(true), 400)))");
}

async function waitFor(win, expr, timeout) {
  const until = Date.now() + timeout;
  while (Date.now() < until) {
    if (await win.webContents.executeJavaScript(expr)) return true;
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
}
