import { test, expect, afterAll } from "bun:test";
import { mkdtemp, rm, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mock } from "bun:test";

// `settings.cjs` asks electron for the user-data directory. Under `bun test`
// there is no electron app, so the module is given a temporary one.
const dir = await mkdtemp(join(tmpdir(), "pb-settings-"));
mock.module("electron", () => ({ app: { getPath: () => dir } }));

const { readSettings, writeSettings, PRINT_DEFAULTS } = require("./settings.cjs") as {
  readSettings: () => Promise<any>;
  writeSettings: (patch: any) => Promise<any>;
  PRINT_DEFAULTS: Record<string, unknown>;
};

const file = join(dir, "settings.json");

afterAll(() => rm(dir, { recursive: true, force: true }));

test("a missing file reads back as the defaults", async () => {
  const s = await readSettings();
  expect(s.updateChecks).toBe(true);
  expect(s.skipped).toBe(null);
  expect(s.print).toEqual(PRINT_DEFAULTS);
});

test("update preferences round-trip", async () => {
  await writeSettings({ updateChecks: false, skipped: "1.2.0", lastCheck: 42 });
  const s = await readSettings();
  expect(s.updateChecks).toBe(false);
  expect(s.skipped).toBe("1.2.0");
  expect(s.lastCheck).toBe(42);
});

test("print preferences round-trip without disturbing the update ones", async () => {
  await writeSettings({ print: { deviceName: "Brother-HL", copies: 3 } });
  const s = await readSettings();
  expect(s.print.deviceName).toBe("Brother-HL");
  expect(s.print.copies).toBe(3);
  // untouched print fields keep their defaults, and so does everything else
  expect(s.print.duplex).toBe("shortEdge");
  expect(s.print.scale).toBe(100);
  expect(s.updateChecks).toBe(false);
  expect(s.skipped).toBe("1.2.0");
});

test("an update write leaves the print block alone", async () => {
  await writeSettings({ lastCheck: 99 });
  const s = await readSettings();
  expect(s.lastCheck).toBe(99);
  expect(s.print.deviceName).toBe("Brother-HL");
  expect(s.print.copies).toBe(3);
});

test("a file from an older version gains the print defaults", async () => {
  await writeFile(file, JSON.stringify({ updateChecks: true, lastCheck: 7, skipped: null }));
  const s = await readSettings();
  expect(s.print).toEqual(PRINT_DEFAULTS);
  expect(s.lastCheck).toBe(7);
});

test("a corrupt file falls back rather than throwing", async () => {
  await writeFile(file, "{ this is not json");
  const s = await readSettings();
  expect(s.updateChecks).toBe(true);
  expect(s.print).toEqual(PRINT_DEFAULTS);
  // and a write over a corrupt file repairs it
  await writeSettings({ print: { copies: 2 } });
  expect(JSON.parse(await readFile(file, "utf8")).print.copies).toBe(2);
});
