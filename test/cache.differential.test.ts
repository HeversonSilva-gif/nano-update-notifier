import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

type Probe = { homedir: string; upstream: string | null; nano: string | null };

describe("config path differential", () => {
  it("resolves the same config path as update-notifier when XDG_CONFIG_HOME is unset", () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "nun-path-"));
    try {
      const env: NodeJS.ProcessEnv = {
        ...process.env,
        CI: "0",
        NODE_ENV: "development",
        HOME: home,
        USERPROFILE: home,
        // Somewhere no correct implementation resolves to, so a reintroduced
        // platform branch fails this test instead of passing by coincidence.
        APPDATA: path.join(home, "AppData", "Roaming"),
        npm_config_registry: "http://127.0.0.1:9/",
      };
      delete env.XDG_CONFIG_HOME;
      delete env.NO_UPDATE_NOTIFIER;

      const output = execFileSync(
        process.execPath,
        [path.join(root, "test", "fixtures", "config-path-probe.mjs")],
        { env, encoding: "utf8", timeout: 20_000 },
      );
      const probe = JSON.parse(output) as Probe;

      expect(probe.homedir, "the child did not pick up the redirected home").toBe(home);
      expect(probe.upstream).not.toBeNull();
      expect(probe.nano).toBe(probe.upstream);
    } finally {
      fs.rmSync(home, { recursive: true, force: true });
    }
  });
});

describe("cache interoperability", () => {
  const previous = {
    CI: process.env.CI,
    NODE_ENV: process.env.NODE_ENV,
    NO_UPDATE_NOTIFIER: process.env.NO_UPDATE_NOTIFIER,
    XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME,
  };
  let home = "";
  let upstream: typeof import("update-notifier").default;

  // One directory for the whole block: xdg-basedir computes its config path at module
  // load, so the oracle binds to whatever XDG_CONFIG_HOME held on first import.
  beforeAll(async () => {
    home = fs.mkdtempSync(path.join(os.tmpdir(), "nun-interop-"));
    process.env.CI = "0";
    process.env.NODE_ENV = "development";
    delete process.env.NO_UPDATE_NOTIFIER;
    process.env.XDG_CONFIG_HOME = home;
    upstream = (await import("update-notifier")).default;
  });

  beforeEach(() => {
    fs.rmSync(path.join(home, "configstore"), { recursive: true, force: true });
  });

  afterAll(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    fs.rmSync(home, { recursive: true, force: true });
  });

  it("honours an opt-out written by update-notifier", async () => {
    const ours = (await import("../src/index.js")).default;
    const name = `interop-optout-${process.pid}`;

    const theirs = upstream({ pkg: { name, version: "1.0.0" } });
    theirs.config!.set("optOut", true);

    const mine = ours({ pkg: { name, version: "1.0.0" } });
    expect(mine.config!.path).toBe(theirs.config!.path);
    expect(mine.config!.get("optOut")).toBe(true);
  });

  it("reads an update cached by update-notifier", async () => {
    const ours = (await import("../src/index.js")).default;
    const name = `interop-update-${process.pid}`;
    const update = { latest: "2.0.0", current: "0.1.0", type: "major", name };

    const theirs = upstream({ pkg: { name, version: "1.0.0" } });
    theirs.config!.set("optOut", false);
    theirs.config!.set("update", update);

    const mine = ours({ pkg: { name, version: "1.0.0" } });
    expect(mine.update).toEqual({ ...update, current: "1.0.0" });
  });
});
