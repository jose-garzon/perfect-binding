import { test, expect } from "bun:test";

// The module pulls in `electron` at require time, which does not exist under
// `bun test` — but the version comparison is pure, so it is worth pinning.
const { compareVersions } = require("./updates.cjs") as {
  compareVersions: (a: string, b: string) => number;
};

test("orders release versions by number, not by string", () => {
  expect(compareVersions("0.10.0", "0.9.0")).toBe(1);
  expect(compareVersions("1.0.0", "0.99.99")).toBe(1);
  expect(compareVersions("0.2.0", "0.2.0")).toBe(0);
  expect(compareVersions("0.1.9", "0.2.0")).toBe(-1);
});

test("tolerates a leading v and missing fields", () => {
  expect(compareVersions("v0.2.0", "0.2.0")).toBe(0);
  expect(compareVersions("0.2", "0.2.0")).toBe(0);
  expect(compareVersions("v1", "0.9.9")).toBe(1);
});

test("sorts a prerelease below its own release", () => {
  expect(compareVersions("0.2.0-beta.1", "0.2.0")).toBe(-1);
  expect(compareVersions("0.2.0", "0.2.0-beta.1")).toBe(1);
  expect(compareVersions("0.2.0-beta.1", "0.2.0-beta.2")).toBe(-1);
  // a prerelease is still newer than the release before it
  expect(compareVersions("0.2.0-beta.1", "0.1.0")).toBe(1);
});
