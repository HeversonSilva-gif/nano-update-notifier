#!/usr/bin/env node
"use strict";
const process = require("node:process");
const updateNotifier = require("../dist/index.cjs");

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

console.log(`${name} ${version} (CommonJS) — real work happens here`);

notifier.notify({
  message: process.env.DEMO_MESSAGE || undefined,
  isGlobal: process.env.DEMO_GLOBAL === "1",
});
