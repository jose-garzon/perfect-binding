/**
 * Update notices. The app never downloads or installs anything — it asks the
 * GitHub releases API whether a newer tag exists and lets the renderer show a
 * bar with a link. This is the only outbound request the app makes; the PDF
 * itself never leaves the machine, and the check can be switched off.
 */
const { app, net } = require("electron");
const path = require("node:path");
const fs = require("node:fs/promises");

const RELEASES_API = "https://api.github.com/repos/jose-garzon/perfect-binding/releases/latest";
const RELEASES_PAGE = "https://github.com/jose-garzon/perfect-binding/releases/latest";
const INTERVAL = 24 * 60 * 60 * 1000; // once a day is plenty for a desktop tool
const TIMEOUT = 6000;

const DEFAULTS = { updateChecks: true, lastCheck: 0, skipped: null };

function settingsPath() {
  return path.join(app.getPath("userData"), "settings.json");
}

async function readSettings() {
  try {
    return { ...DEFAULTS, ...JSON.parse(await fs.readFile(settingsPath(), "utf8")) };
  } catch {
    return { ...DEFAULTS }; // missing or corrupt: fall back, never throw
  }
}

async function writeSettings(patch) {
  const next = { ...(await readSettings()), ...patch };
  await fs.mkdir(path.dirname(settingsPath()), { recursive: true });
  await fs.writeFile(settingsPath(), JSON.stringify(next, null, 2));
  return next;
}

/** -1, 0, or 1. Numeric fields only; a prerelease suffix sorts below its release. */
function compareVersions(a, b) {
  const parse = (v) => {
    const [core, pre] = String(v).replace(/^v/, "").split("-");
    return { nums: core.split(".").map((n) => parseInt(n, 10) || 0), pre: pre || "" };
  };
  const x = parse(a);
  const y = parse(b);
  for (let i = 0; i < Math.max(x.nums.length, y.nums.length); i++) {
    const d = (x.nums[i] || 0) - (y.nums[i] || 0);
    if (d) return Math.sign(d);
  }
  if (x.pre === y.pre) return 0;
  if (!x.pre) return 1;
  if (!y.pre) return -1;
  return x.pre < y.pre ? -1 : 1;
}

/**
 * Resolves the newer release, or null when there is nothing to say — already
 * current, checks are off, checked recently, or the network did not answer.
 * `force` skips the interval and the "don't show me this one again" mark.
 */
async function checkForUpdate({ force = false } = {}) {
  if (process.env.PB_NO_UPDATE_CHECK) return null;

  const settings = await readSettings();
  if (!force) {
    if (!settings.updateChecks) return null;
    if (Date.now() - settings.lastCheck < INTERVAL) return null;
  }

  let release;
  try {
    const res = await net.fetch(RELEASES_API, {
      headers: { Accept: "application/vnd.github+json", "User-Agent": "perfect-binding" },
      signal: AbortSignal.timeout(TIMEOUT),
    });
    if (!res.ok) throw new Error(`github answered ${res.status}`);
    release = await res.json();
  } catch (e) {
    // Offline is the normal case for this app, not an error worth surfacing.
    console.log("update check skipped:", e && e.message);
    return null;
  }

  await writeSettings({ lastCheck: Date.now() });

  const latest = String(release.tag_name || "").replace(/^v/, "");
  if (!latest) return null;
  if (compareVersions(latest, app.getVersion()) <= 0) return null;
  if (!force && settings.skipped === latest) return null;

  return { version: latest, url: release.html_url || RELEASES_PAGE, current: app.getVersion() };
}

module.exports = { checkForUpdate, readSettings, writeSettings, compareVersions, RELEASES_PAGE };
