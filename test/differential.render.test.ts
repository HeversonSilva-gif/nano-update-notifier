import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { UpdateNotifier, type NotifyOptions } from "../src/index.js";

// chalk resolves its colour level once, at import time, so colour has to be forced
// before update-notifier is pulled in.
let upstream: typeof import("update-notifier").default;
let home = "";

const original = {
  isTTY: Object.getOwnPropertyDescriptor(process.stdout, "isTTY"),
  columns: Object.getOwnPropertyDescriptor(process.stdout, "columns"),
  environment: {
    CI: process.env.CI,
    FORCE_COLOR: process.env.FORCE_COLOR,
    NODE_ENV: process.env.NODE_ENV,
    NO_COLOR: process.env.NO_COLOR,
    NO_UPDATE_NOTIFIER: process.env.NO_UPDATE_NOTIFIER,
    XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME,
  },
};

const UPDATE = { latest: "2.0.0", current: "1.0.0", type: "major", name: "demo" };

beforeAll(async () => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), "nun-render-"));
  delete process.env.CI;
  delete process.env.NO_COLOR;
  delete process.env.NO_UPDATE_NOTIFIER;
  process.env.NODE_ENV = "development";
  process.env.FORCE_COLOR = "1";
  process.env.XDG_CONFIG_HOME = home;
  Object.defineProperty(process.stdout, "isTTY", { configurable: true, value: true });
  Object.defineProperty(process.stdout, "columns", { configurable: true, value: 80 });
  upstream = (await import("update-notifier")).default;
});

afterAll(() => {
  fs.rmSync(home, { recursive: true, force: true });
  for (const [key, value] of Object.entries(original.environment)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  for (const [key, descriptor] of [
    ["isTTY", original.isTTY],
    ["columns", original.columns],
  ] as const) {
    if (descriptor) Object.defineProperty(process.stdout, key, descriptor);
    else delete (process.stdout as Partial<NodeJS.WriteStream>)[key];
  }
});

function render(notify: () => void): string {
  const captured: string[] = [];
  const spy = vi.spyOn(console, "error").mockImplementation((message) => void captured.push(String(message)));
  try {
    notify();
  } finally {
    spy.mockRestore();
  }
  return captured.join("\n");
}

const cases: Array<[string, NotifyOptions]> = [
  ["default", {}],
  ["local install", { isGlobal: false }],
  ["global install", { isGlobal: true }],
  ["custom message", { message: "New {packageName} {currentVersion} -> {latestVersion}: {updateCommand}" }],
  ["multi-line custom message", { message: "{packageName}\n{currentVersion} -> {latestVersion}\n{updateCommand}" }],
  ["emoji and CJK message", { message: "🚀 {packageName} 更新 {latestVersion} 👩🏽‍💻" }],
  ["boxen double red", { boxenOptions: { padding: 1, margin: 1, borderStyle: "double", borderColor: "red" } }],
  ["boxen classic no margin", { boxenOptions: { padding: 1, margin: 0, borderStyle: "classic" } }],
  ["boxen with title", { boxenOptions: { padding: 1, margin: 1, borderStyle: "round", title: "Update", titleAlignment: "center" } }],
  ["boxen fixed width", { boxenOptions: { padding: 1, margin: 1, width: 50, textAlignment: "center" } }],
  ["boxen fixed height", { boxenOptions: { padding: 1, margin: 1, height: 4 } }],
  ["boxen float right", { boxenOptions: { padding: 1, margin: 1, float: "right", borderStyle: "round" } }],
  ["boxen dim border and background", { boxenOptions: { padding: 1, margin: 1, dimBorder: true, backgroundColor: "blue" } }],
  ["boxen borderless", { boxenOptions: { padding: 1, margin: 1, borderStyle: "none" } }],
];

describe("notification rendering differential with colour enabled", () => {
  for (const [label, options] of cases) {
    it(label, () => {
      const theirs = upstream({ pkg: { name: "demo", version: "1.0.0" } });
      theirs.update = { ...UPDATE };
      const expected = render(() => theirs.notify({ defer: false, isGlobal: false, ...structuredClone(options) }));

      const mine = new UpdateNotifier({ pkg: { name: "demo", version: "1.0.0" } });
      mine.update = { ...UPDATE };
      const actual = render(() => mine.notify({ defer: false, isGlobal: false, ...structuredClone(options) }));

      expect(actual).toBe(expected);
    });
  }
});
