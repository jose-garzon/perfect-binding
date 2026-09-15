/**
 * The app's settings file: one JSON document under the user-data directory,
 * shared by the update notices and the print preferences. A missing or corrupt
 * file is not an error — it reads back as the defaults, so a bad write can
 * never stop the app from starting.
 */
const path = require("node:path");
const fs = require("node:fs/promises");

/**
 * Printer choice and job options as the print panel asks for them. `null` means
 * "not chosen yet": no printer is assumed, and the driver picks the paper.
 * Duplex is a request made of the printer, and is unrelated to the imposition's
 * own duplex-flip setting, which describes how the printer already behaves.
 */
const PRINT_DEFAULTS = {
  deviceName: null,
  copies: 1,
  duplex: "shortEdge", // "simplex" | "shortEdge" | "longEdge"
  color: true,
  paperName: null,
  scale: 100, // percent; anything but 100 refits the finished imposition
};

const DEFAULTS = {
  updateChecks: true,
  lastCheck: 0,
  skipped: null,
  print: { ...PRINT_DEFAULTS },
};

function settingsPath() {
  // electron is resolved per call, not at load: a module cached before
  // `electron` was mocked (as `bun test` does across files) still sees the mock.
  const { app } = require("electron");
  return path.join(app.getPath("userData"), "settings.json");
}

async function readSettings() {
  try {
    const stored = JSON.parse(await fs.readFile(settingsPath(), "utf8"));
    // `print` is merged a level deeper so a file written by an older version,
    // or one missing a field, still answers with every key the app reads.
    return { ...DEFAULTS, ...stored, print: { ...PRINT_DEFAULTS, ...stored.print } };
  } catch {
    return { ...DEFAULTS, print: { ...PRINT_DEFAULTS } }; // missing or corrupt: fall back, never throw
  }
}

async function writeSettings(patch) {
  const current = await readSettings();
  const next = { ...current, ...patch };
  if (patch && patch.print) next.print = { ...current.print, ...patch.print };
  await fs.mkdir(path.dirname(settingsPath()), { recursive: true });
  await fs.writeFile(settingsPath(), JSON.stringify(next, null, 2));
  return next;
}

module.exports = { readSettings, writeSettings, settingsPath, DEFAULTS, PRINT_DEFAULTS };
