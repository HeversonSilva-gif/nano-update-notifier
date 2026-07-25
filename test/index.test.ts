import { afterEach, describe, expect, it, vi } from "vitest";
import updateNotifier, { UpdateNotifier } from "../src/index.js";
import { useTemporaryHome } from "./helpers.js";

useTemporaryHome();
const originalTty = Object.getOwnPropertyDescriptor(process.stdout, "isTTY");

function setTty(value: boolean): void {
  Object.defineProperty(process.stdout, "isTTY", { configurable: true, value });
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  if (originalTty) Object.defineProperty(process.stdout, "isTTY", originalTty);
  else delete (process.stdout as Partial<NodeJS.WriteStream>).isTTY;
});

describe("constructor", () => {
  it("matches the upstream validation error", () => {
    expect(() => new UpdateNotifier({ pkg: { version: "1.0.0" } })).toThrow(
      "pkg.name and pkg.version required",
    );
    expect(() => new UpdateNotifier({ pkg: { name: "demo" } })).toThrow(
      "pkg.name and pkg.version required",
    );
  });

  it("accepts deprecated options and exposes the upstream compatibility fields", () => {
    const notifier = new UpdateNotifier({
      packageName: "demo",
      packageVersion: "1.0.0",
      shouldNotifyInNpmScript: true,
    });
    expect(notifier._packageName).toBe("demo");
    expect(notifier._shouldNotifyInNpmScript).toBe(true);
    expect(notifier.config?.get("lastUpdateCheck")).toBeTypeOf("number");
  });

  it("does not create a store when disabled", () => {
    process.env.NO_UPDATE_NOTIFIER = "";
    expect(new UpdateNotifier({ pkg: { name: "demo", version: "1.0.0" } }).config).toBeUndefined();
  });
});

describe("check", () => {
  it("adopts a cached update, rewrites current, and consumes the cache entry", () => {
    const seed = new UpdateNotifier({ pkg: { name: "demo", version: "0.9.0" } });
    seed.config!.set("update", { latest: "2.0.0", current: "0.9.0", type: "major", name: "demo" });

    const notifier = updateNotifier({ pkg: { name: "demo", version: "1.0.0" } });
    expect(notifier.update).toEqual({ latest: "2.0.0", current: "1.0.0", type: "major", name: "demo" });
    expect(notifier.config!.get("update")).toBeUndefined();
  });

  it("honours the public optOut cache flag", () => {
    const notifier = new UpdateNotifier({ pkg: { name: "demo", version: "1.0.0" } });
    notifier.config!.set("optOut", true);
    notifier.config!.set("update", { latest: "2.0.0" });
    notifier.check();
    expect(notifier.update).toBeUndefined();
    expect(notifier.config!.has("update")).toBe(true);
  });
});

describe("fetchInfo", () => {
  it("returns the upstream update shape", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ "dist-tags": { latest: "2.1.0" } }))),
    );
    const notifier = new UpdateNotifier({ pkg: { name: "demo", version: "1.0.0" } });
    await expect(notifier.fetchInfo()).resolves.toEqual({
      latest: "2.1.0",
      current: "1.0.0",
      type: "major",
      name: "demo",
    });
  });
});

describe("notify", () => {
  function updated(): UpdateNotifier {
    const notifier = new UpdateNotifier({ pkg: { name: "demo", version: "1.0.0" } });
    notifier.update = { latest: "2.0.0", current: "1.0.0", type: "major", name: "demo" };
    return notifier;
  }

  it("is silent outside a TTY", () => {
    const errors: string[] = [];
    vi.spyOn(console, "error").mockImplementation((message) => void errors.push(String(message)));
    setTty(false);
    updated().notify({ defer: false });
    expect(errors).toEqual([]);
  });

  it("writes only to stderr and returns this", () => {
    const errors: string[] = [];
    const stdout: string[] = [];
    vi.spyOn(console, "error").mockImplementation((message) => void errors.push(String(message)));
    vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      stdout.push(String(chunk));
      return true;
    });
    setTty(true);

    const notifier = updated();
    expect(notifier.notify({ defer: false })).toBe(notifier);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("2.0.0");
    expect(stdout).toEqual([]);
  });

  it("supports custom templates and global install commands", () => {
    const errors: string[] = [];
    vi.spyOn(console, "error").mockImplementation((message) => void errors.push(String(message)));
    setTty(true);
    updated().notify({
      defer: false,
      isGlobal: true,
      message: "{packageName}: {currentVersion} -> {latestVersion}; {updateCommand}",
      boxenOptions: { margin: 0, borderStyle: "classic" },
    });
    expect(errors.join("\n")).toContain("npm i -g demo");
  });

  it("suppresses notifications in npm scripts unless explicitly enabled", () => {
    process.env.npm_config_user_agent = "npm/10 node/v22";
    setTty(true);
    const errors: string[] = [];
    vi.spyOn(console, "error").mockImplementation((message) => void errors.push(String(message)));

    updated().notify({ defer: false });
    expect(errors).toEqual([]);

    const enabled = new UpdateNotifier({
      pkg: { name: "demo-enabled", version: "1.0.0" },
      shouldNotifyInNpmScript: true,
    });
    enabled.update = { latest: "2.0.0", current: "1.0.0", type: "major", name: "demo-enabled" };
    enabled.notify({ defer: false });
    expect(errors).toHaveLength(1);
  });

  it("defers output until process exit by default", () => {
    setTty(true);
    const listeners: Array<() => void> = [];
    vi.spyOn(process, "on").mockImplementation(((event: string, listener: () => void) => {
      if (event === "exit") listeners.push(listener);
      return process;
    }) as typeof process.on);
    const errors: string[] = [];
    vi.spyOn(console, "error").mockImplementation((message) => void errors.push(String(message)));

    updated().notify();
    expect(errors).toEqual([]);
    expect(listeners).toHaveLength(1);
    listeners[0]!();
    expect(errors).toHaveLength(1);
  });
});
