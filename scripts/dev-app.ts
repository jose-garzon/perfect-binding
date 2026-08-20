/** Waits for the dev server, then launches Electron pointed at it. */
import { spawn } from "node:child_process";

const url = process.env.PB_DEV_URL ?? `http://localhost:${process.env.PORT ?? 3123}`;

for (let i = 0; i < 100; i++) {
  try {
    const res = await fetch(url, { method: "HEAD" });
    if (res.ok || res.status < 500) break;
  } catch {
    await Bun.sleep(150);
  }
}

const electron = (await import("electron")).default as unknown as string;
const child = spawn(electron, ["electron/main.cjs"], {
  stdio: "inherit",
  env: { ...process.env, PB_DEV_URL: url },
});
child.on("exit", (code) => process.exit(code ?? 0));
