import fs from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Store } from "../src/cache.js";
import { runCheck } from "../src/check.js";
import updateNotifier, { UpdateNotifier, type Options } from "../src/index.js";
import { useTemporaryHome } from "./helpers.js";

useTemporaryHome();

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("environmental failure injection", () => {
  const failures: Array<[string, () => Promise<Response>]> = [
    ["network unreachable", async () => Promise.reject(new Error("ENOTFOUND"))],
    ["registry 500", async () => new Response("", { status: 500 })],
    ["malformed JSON", async () => new Response("<html>")],
    ["missing dist-tags", async () => new Response("{}")],
  ];

  for (const [label, response] of failures) {
    it(`survives ${label}`, async () => {
      vi.stubGlobal("fetch", vi.fn(response));
      const notifier = new UpdateNotifier({ pkg: { name: "demo", version: "1.0.0" } });
      notifier.config!.set("lastUpdateCheck", 123);
      await expect(runCheck(notifier)).resolves.toBeUndefined();
      expect(notifier.config!.get("lastUpdateCheck")).toBe(123);
    });
  }

  it("survives a corrupt cache", () => {
    const store = new Store("update-notifier-demo");
    fs.writeFileSync(store.path, "{ broken");
    expect(() => updateNotifier({ pkg: { name: "demo", version: "1.0.0" } })).not.toThrow();
  });

  it("reports an inaccessible config directory on exit without throwing", () => {
    const error = Object.assign(new Error("denied"), { code: "EACCES" });
    vi.spyOn(fs, "mkdirSync").mockImplementation(() => {
      throw error;
    });
    const listeners: Array<() => void> = [];
    vi.spyOn(process, "on").mockImplementation(((event: string, listener: () => void) => {
      if (event === "exit") listeners.push(listener);
      return process;
    }) as typeof process.on);
    const errors: string[] = [];
    vi.spyOn(console, "error").mockImplementation((message) => void errors.push(String(message)));

    let notifier: UpdateNotifier | undefined;
    expect(() => {
      notifier = updateNotifier({ pkg: { name: "demo", version: "1.0.0" } });
    }).not.toThrow();
    expect(notifier!.config).toBeUndefined();
    expect(listeners).toHaveLength(1);
    listeners[0]!();
    expect(errors.join("\n")).toContain("update check failed");
  });

  it("swallows cache write permission failures after initialization", () => {
    const store = new Store("demo");
    const error = Object.assign(new Error("denied"), { code: "EACCES" });
    vi.spyOn(fs, "writeFileSync").mockImplementation(() => {
      throw error;
    });
    expect(() => store.set("value", 1)).not.toThrow();
  });

  it("survives options that cannot be serialized for the detached child", () => {
    const options: Options & { circular?: unknown } = {
      pkg: { name: "demo", version: "1.0.0" },
      updateCheckInterval: 0,
    };
    options.circular = options;
    const notifier = new UpdateNotifier(options);
    notifier.config!.set("lastUpdateCheck", 0);
    expect(() => notifier.check()).not.toThrow();
  });
});
