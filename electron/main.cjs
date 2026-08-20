const { app, BrowserWindow, dialog, ipcMain, shell, Menu } = require("electron");
const path = require("node:path");
const fs = require("node:fs/promises");
const { applyCsp } = require("./csp.cjs");
const updates = require("./updates.cjs");

const DEV_URL = process.env.PB_DEV_URL;

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 940,
    minHeight: 620,
    backgroundColor: "#f7f6f3",
    // Linux and Windows read the window icon from here; macOS uses the bundle's.
    icon: path.join(__dirname, "..", "assets", "icons", "512x512.png"),
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.once("ready-to-show", () => win.show());

  if (DEV_URL) {
    win.loadURL(DEV_URL);
  } else {
    win.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }

  // External links open in the user's browser, never inside the app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  return win;
}

ipcMain.handle("save-pdf", async (event, suggestedName, bytes) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    title: "Save booklet",
    defaultPath: suggestedName,
    filters: [{ name: "PDF", extensions: ["pdf"] }],
  });
  if (canceled || !filePath) return false;
  await fs.writeFile(filePath, Buffer.from(bytes));
  return true;
});

/* ── update notices ───────────────────────────────────────────────────────
   The renderer never touches the network — it asks here, and gets back either
   a newer version or null. See electron/updates.cjs. */
ipcMain.handle("updates:check", (_e, { force } = {}) => updates.checkForUpdate({ force }));

ipcMain.handle("updates:enabled", async (_e, value) => {
  const settings = value === undefined
    ? await updates.readSettings()
    : await updates.writeSettings({ updateChecks: Boolean(value) });
  return settings.updateChecks;
});

ipcMain.handle("updates:skip", (_e, version) => updates.writeSettings({ skipped: version || null }));

ipcMain.handle("open-release-page", (_e, url) => {
  // Only ever hand the browser a github.com URL, whatever the renderer asks for.
  const target = new URL(url || updates.RELEASES_PAGE);
  if (target.protocol !== "https:" || !/(^|\.)github\.com$/.test(target.hostname)) return false;
  shell.openExternal(target.href);
  return true;
});

app.whenReady().then(() => {
  applyCsp(DEV_URL);
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    ...(process.platform === "darwin" ? [{ role: "appMenu" }] : []),
    {
      label: "File",
      submenu: [
        { label: "Check for Updates…", click: () => checkForUpdatesFromMenu() },
        { type: "separator" },
        process.platform === "darwin" ? { role: "close" } : { role: "quit" },
      ],
    },
    { role: "editMenu" },
    { role: "viewMenu" },
    { role: "windowMenu" },
  ]));
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

/** The menu item forces a check, so it answers even when checks are switched off. */
async function checkForUpdatesFromMenu() {
  const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
  if (!win) return;
  const update = await updates.checkForUpdate({ force: true });
  if (update) {
    win.webContents.send("updates:found", update);
    return;
  }
  await dialog.showMessageBox(win, {
    type: "info",
    message: `Perfect Binding ${app.getVersion()} is up to date.`,
    detail: "If you are offline, try again once you have a connection.",
    buttons: ["OK"],
  });
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
