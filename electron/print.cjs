/**
 * Printing the built booklet without exporting it.
 *
 * `webContents.print` prints a rendered page, not a buffer, so the renderer's
 * page images are written to a private temporary folder, laid out in a hidden
 * window as a plain HTML page, printed, and then removed. The user
 * is never shown a save dialog and nothing is left anywhere they can browse to.
 */
const { app, BrowserWindow } = require("electron");
const path = require("node:path");
const fs = require("node:fs/promises");
const crypto = require("node:crypto");

/** Every job of this run shares one directory, removed whole when the app quits. */
let jobDir = null;
/** Files still on disk, so a quit mid-job does not leave one behind. */
const live = new Set();

async function ensureJobDir() {
  if (jobDir) return jobDir;
  jobDir = path.join(app.getPath("temp"), `perfect-binding-${process.pid}-${Date.now()}`);
  await fs.mkdir(jobDir, { recursive: true, mode: 0o700 });
  return jobDir;
}

/** Best-effort: a file that is already gone is the outcome we wanted. */
async function discard(file) {
  live.delete(file);
  await fs.rm(file, { recursive: true, force: true }).catch(() => {});
}

app.on("will-quit", () => {
  // Synchronous on purpose: the process is going away and an awaited unlink
  // would not be given the chance to finish.
  const fsSync = require("node:fs");
  for (const file of live) {
    try { fsSync.rmSync(file, { recursive: true, force: true }); } catch { /* going away anyway */ }
  }
  live.clear();
  if (jobDir) {
    try { fsSync.rmSync(jobDir, { recursive: true, force: true }); } catch { /* ditto */ }
    jobDir = null;
  }
});

/** The printers this machine reports, the platform's default marked. */
async function listPrinters() {
  const win = BrowserWindow.getAllWindows()[0];
  if (!win) return [];
  try {
    const printers = await win.webContents.getPrintersAsync();
    return printers.map((p) => ({
      name: p.name,
      displayName: p.displayName || p.name,
      description: p.description || "",
      status: p.status,
      isDefault: Boolean(p.isDefault),
    }));
  } catch {
    // No print backend (a Linux box with no CUPS, say). An empty list is a
    // state the panel knows how to show, not an error worth throwing.
    return [];
  }
}

const DUPLEX = new Set(["simplex", "shortEdge", "longEdge"]);

/**
 * Maps the print panel's preferences onto Electron's print options. Scale and
 * margins are pinned so the driver refits nothing: the imposition's geometry is
 * already final by the time it gets here.
 */
function toPrintOptions(options = {}) {
  const {
    deviceName, copies, duplex, color, paperName, scale, pageRanges, silent = true,
  } = options;

  const out = {
    silent,
    printBackground: true,
    margins: { marginType: "none" },
    scaleFactor: clampScale(scale),
    copies: Math.max(1, Math.round(Number(copies) || 1)),
    color: color !== false,
  };
  if (deviceName) out.deviceName = deviceName;
  if (DUPLEX.has(duplex)) out.duplexMode = duplex;
  if (paperName) out.pageSize = paperName;
  if (Array.isArray(pageRanges) && pageRanges.length > 0) out.pageRanges = pageRanges;
  return out;
}

function clampScale(scale) {
  const n = Number(scale);
  if (!Number.isFinite(n)) return 100;
  return Math.min(200, Math.max(10, Math.round(n)));
}

/**
 * The page the hidden window prints: one image per output page, each filling a
 * sheet of exactly its own size, so nothing is refit on the way out.
 */
function printDocument(pages) {
  const { width, height } = pages[0];
  const imgs = pages.map((_, i) => `<img src="${i}.png">`).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><style>
@page { size: ${width}pt ${height}pt; margin: 0; }
html, body { margin: 0; padding: 0; background: #fff; }
img { display: block; width: ${width}pt; height: ${height}pt; break-after: page; }
img:last-child { break-after: auto; }
</style></head><body>${imgs}</body></html>`;
}

/**
 * Prints the given pages, rasterized by the renderer. Chromium's PDF viewer
 * cannot be printed from `webContents.print` — it comes out blank — so the job
 * is a plain local HTML page of images. Resolves `{ ok }`, or
 * `{ ok: false, reason }` — a cancelled system dialog included, which is a
 * refusal and not a failure.
 */
async function printPages(pages, options = {}) {
  if (!Array.isArray(pages) || pages.length === 0) return { ok: false, reason: "There is nothing built to print." };

  const silent = options.silent !== false;
  if (silent) {
    // Never fall through to the platform default: a saved printer that has been
    // unplugged or renamed must be reported, not quietly replaced.
    if (!options.deviceName) return { ok: false, reason: "No printer has been chosen." };
    const printers = await listPrinters();
    if (printers.length > 0 && !printers.some((p) => p.name === options.deviceName)) {
      return { ok: false, reason: `The printer "${options.deviceName}" is not available.` };
    }
  }

  const root = await ensureJobDir();
  const dir = path.join(root, crypto.randomUUID());
  await fs.mkdir(dir, { mode: 0o700 });
  live.add(dir);
  await Promise.all(pages.map((p, i) =>
    fs.writeFile(path.join(dir, `${i}.png`), Buffer.from(p.png), { mode: 0o600 })));
  const file = path.join(dir, "job.html");
  await fs.writeFile(file, printDocument(pages), { mode: 0o600 });

  const parent = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
  const win = new BrowserWindow({
    show: false,
    parent: parent ?? undefined,
    webPreferences: {
      // The window loads a static local page of ours and nothing else.
      // No preload, no node, no scripts, no remote origin.
      javascript: false,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      partition: "print-job",
    },
  });

  // The window exists to render one local file. It never navigates anywhere.
  win.webContents.on("will-navigate", (e) => e.preventDefault());
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));

  const close = async () => {
    if (!win.isDestroyed()) win.destroy();
    await discard(dir);
  };

  try {
    await win.loadFile(file);
  } catch (e) {
    await close();
    return { ok: false, reason: `The booklet could not be prepared for printing. ${e.message}` };
  }

  return new Promise((resolve) => {
    let settled = false;
    const finish = async (result) => {
      if (settled) return;
      settled = true;
      await close();
      resolve(result);
    };

    try {
      // Pages arrive already narrowed to what was asked for.
      const { pageRanges: _, ...rest } = options;
      win.webContents.print(toPrintOptions(rest), (success, reason) => {
        // A cancelled dialog reports failure with reason "cancelled"; the user
        // meant that, so it is not surfaced as something going wrong.
        if (success) finish({ ok: true });
        else if (reason === "cancelled") finish({ ok: false, cancelled: true });
        else finish({ ok: false, reason: reason || "The printer refused the job." });
      });
    } catch (e) {
      finish({ ok: false, reason: e.message || "The job could not be sent to the printer." });
    }
  });
}

module.exports = { printPages, printDocument, listPrinters, toPrintOptions, clampScale };
