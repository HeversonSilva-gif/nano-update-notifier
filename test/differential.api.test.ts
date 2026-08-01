import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import ours, { UpdateNotifier, type Update } from "../src/index.js";

let upstream: typeof import("update-notifier").default;
let home = "";
const originalTty = Object.getOwnPropertyDescriptor(process.stdout, "isTTY");
const originalEnvironment = {
  CI: process.env.CI,
  NODE_ENV: process.env.NODE_ENV,
  NO_COLOR: process.env.NO_COLOR,
  NO_UPDATE_NOTIFIER: process.env.NO_UPDATE_NOTIFIER,
  XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME,
};

beforeAll(async () => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), "nun-differential-"));
  delete process.env.CI;
  delete process.env.NO_UPDATE_NOTIFIER;
  process.env.NODE_ENV = "development";
  process.env.NO_COLOR = "1";
  process.env.XDG_CONFIG_HOME = home;
  upstream = (await import("update-notifier")).default;
});

beforeEach(() => {
  fs.rmSync(path.join(home, "configstore"), { recursive: true, force: true });
  delete process.env.NO_UPDATE_NOTIFIER;
});

afterAll(() => {
  fs.rmSync(home, { recursive: true, force: true });
  for (const [key, value] of Object.entries(originalEnvironment)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  if (originalTty) Object.defineProperty(process.stdout, "isTTY", originalTty);
  else delete (process.stdout as Partial<NodeJS.WriteStream>).isTTY;
});

function seed(name: string, update: unknown): void {
  const file = path.join(home, "configstore", `update-notifier-${name}.json`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ optOut: false, lastUpdateCheck: Date.now(), update }));
}

describe("API differential", () => {
  const cases = [
    { name: "demo", version: "1.0.0", latest: "2.0.0", type: "major" },
    { name: "demo", version: "1.0.0", latest: "1.1.0", type: "minor" },
    { name: "demo", version: "1.0.0", latest: "1.0.1", type: "patch" },
    { name: "@scope/demo", version: "1.0.0", latest: "2.0.0", type: "major" },
  ];

  for (const fixture of cases) {
    it(`matches the cached update shape for ${fixture.name} ${fixture.type}`, () => {
      const cached = { latest: fixture.latest, current: "0.1.0", type: fixture.type, name: fixture.name };
      seed(fixture.name, cached);
      const theirs = upstream({ pkg: { name: fixture.name, version: fixture.version } }).update;
      seed(fixture.name, cached);
      const mine = ours({ pkg: { name: fixture.name, version: fixture.version } }).update;
      expect(mine).toEqual(theirs);
    });
  }

  it("matches deprecated option normalization and public compatibility fields", () => {
    const theirs = upstream({ packageName: "demo", packageVersion: "1.0.0" });
    const mine = ours({ packageName: "demo", packageVersion: "1.0.0" });
    expect(mine._packageName).toBe(theirs._packageName);
    expect(mine._shouldNotifyInNpmScript).toBe(theirs._shouldNotifyInNpmScript);
    expect(Boolean(mine.config)).toBe(Boolean(theirs.config));
  });

  it("matches ConfigStore operations used through the public config property", () => {
    const theirs = upstream({ pkg: { name: "theirs", version: "1.0.0" } }).config!;
    const mine = ours({ pkg: { name: "mine", version: "1.0.0" } }).config!;
    theirs.set("nested.value", 1);
    mine.set("nested.value", 1);
    expect(mine.get("nested.value")).toEqual(theirs.get("nested.value"));
    expect(mine.has("nested.value")).toEqual(theirs.has("nested.value"));
    expect(mine.size).toEqual(theirs.size);
  });

  it("renders the default notification identically without color", () => {
    Object.defineProperty(process.stdout, "isTTY", { configurable: true, value: true });
    const update = {
      latest: "2.0.0",
      current: "1.0.0",
      type: "major",
      name: "demo",
    } satisfies Update;
    const theirs = upstream({ pkg: { name: "demo", version: "1.0.0" } });
    const mine = new UpdateNotifier({ pkg: { name: "demo", version: "1.0.0" } });
    theirs.update = { ...update };
    mine.update = { ...update };

    const output: string[] = [];
    vi.spyOn(console, "error").mockImplementation((message) => void output.push(String(message)));
    theirs.notify({ defer: false, isGlobal: false });
    const expected = output.pop();
    mine.notify({ defer: false, isGlobal: false });
    expect(output.pop()).toBe(expected);
    vi.restoreAllMocks();
  });

  it("throws the same constructor error", () => {
    expect(() => ours({ pkg: { name: "demo" } })).toThrow("pkg.name and pkg.version required");
    expect(() => upstream({ pkg: { name: "demo" } })).toThrow("pkg.name and pkg.version required");
  });
});
