#!/usr/bin/env node
import process from "node:process";
import updateNotifier from "../dist/index.js";

// Redirecting this script's output would hide the notification, which only renders
// on a TTY. The flag lets the driver capture output without changing the library.
if (process.argv.includes("--force-tty")) {
  Object.defineProperty(process.stdout, "isTTY", { configurable: true, value: true });
}

const name = process.env.DEMO_PKG_NAME ?? "demo-cli";
const version = process.env.DEMO_PKG_VERSION ?? "1.0.0";

const notifier = updateNotifier({
  pkg: { name, version },
  updateCheckInterval: Number(process.env.DEMO_INTERVAL ?? 0),
  distTag: process.env.DEMO_DIST_TAG ?? "latest",
});

console.log(`${name} ${version} (ESM) — real work happens here`);

notifier.notify({
  message: process.env.DEMO_MESSAGE || undefined,
  isGlobal: process.env.DEMO_GLOBAL === "1",
});
