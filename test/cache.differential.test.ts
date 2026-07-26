import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

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
