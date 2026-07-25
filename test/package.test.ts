import { execFileSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import type { AddressInfo } from "node:net";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

describe("published entry points", () => {
  it("loads the ESM default export", () => {
    const output = execFileSync(
      process.execPath,
      ["--input-type=module", "--eval", "import('./dist/index.js').then(module => console.log(typeof module.default))"],
      { cwd: root, encoding: "utf8" },
    );
    expect(output.trim()).toBe("function");
  });

  it("loads the CommonJS export as a callable function", () => {
    const output = execFileSync(
      process.execPath,
      ["--eval", "console.log(typeof require('./dist/index.cjs'))"],
      { cwd: root, encoding: "utf8" },
    );
    expect(output.trim()).toBe("function");
  });

  it("ships types and the detached checker", () => {
    for (const file of ["index.d.ts", "index.d.cts", "check.cjs"]) {
      expect(fs.existsSync(path.join(root, "dist", file)), file).toBe(true);
    }
  });
});

describe("exit behaviour", () => {
  for (const fixture of ["short-lived-cli.mjs", "short-lived-cli.cjs"]) {
    it(`${fixture} exits while a detached check is in flight`, () => {
      const home = fs.mkdtempSync(path.join(os.tmpdir(), "nun-exit-"));
      const started = Date.now();
      try {
        execFileSync(process.execPath, [path.join(root, "test", "fixtures", fixture)], {
          env: {
            ...process.env,
            CI: "0",
            NODE_ENV: "development",
            XDG_CONFIG_HOME: home,
            npm_config_registry: "http://127.0.0.1:9/",
          },
          stdio: "ignore",
          timeout: 10_000,
        });
      } finally {
        fs.rmSync(home, { recursive: true, force: true });
      }
      expect(Date.now() - started).toBeLessThan(5000);
    });
  }
});

describe("detached check integration", () => {
  it("fetches in the worker and exposes the cached update on the next run", async () => {
    const server = http.createServer((_request, response) => {
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({ "dist-tags": { latest: "2.0.0" } }));
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));

    const home = fs.mkdtempSync(path.join(os.tmpdir(), "nun-worker-"));
    const previous = {
      CI: process.env.CI,
      NODE_ENV: process.env.NODE_ENV,
      NO_UPDATE_NOTIFIER: process.env.NO_UPDATE_NOTIFIER,
      XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME,
      npm_config_registry: process.env.npm_config_registry,
    };
    const name = `nano-update-notifier-worker-${process.pid}`;
    const cache = path.join(home, "configstore", `update-notifier-${name}.json`);

    try {
      const port = (server.address() as AddressInfo).port;
      process.env.CI = "0";
      process.env.NODE_ENV = "development";
      delete process.env.NO_UPDATE_NOTIFIER;
      process.env.XDG_CONFIG_HOME = home;
      process.env.npm_config_registry = `http://127.0.0.1:${port}/`;

      const updateNotifier = (await import("../dist/index.js")).default;
      updateNotifier({ pkg: { name, version: "1.0.0" }, updateCheckInterval: 0 });

      const deadline = Date.now() + 5000;
      while (Date.now() < deadline) {
        if (fs.existsSync(cache)) {
          const content = JSON.parse(fs.readFileSync(cache, "utf8")) as { update?: unknown };
          if (content.update) break;
        }
        await new Promise((resolve) => setTimeout(resolve, 25));
      }

      const notifier = updateNotifier({ pkg: { name, version: "1.0.0" } });
      expect(notifier.update).toEqual({
        latest: "2.0.0",
        current: "1.0.0",
        type: "major",
        name,
      });
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
      for (const [key, value] of Object.entries(previous)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
      fs.rmSync(home, { recursive: true, force: true });
    }
  }, 10_000);
});
