import { afterEach, describe, expect, it, vi } from "vitest";
import { runCheck } from "../src/check.js";
import { UpdateNotifier } from "../src/index.js";
import { useTemporaryHome } from "./helpers.js";

useTemporaryHome();

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("runCheck", () => {
  it("stores a newer update and advances the timestamp", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ "dist-tags": { latest: "2.0.0" } }))),
    );
    const notifier = new UpdateNotifier({ pkg: { name: "demo", version: "1.0.0" } });
    notifier.config!.set("lastUpdateCheck", 123);

    await runCheck(notifier);

    expect(notifier.config!.get("update")).toEqual({
      latest: "2.0.0",
      current: "1.0.0",
      type: "major",
      name: "demo",
    });
    expect(Number(notifier.config!.get("lastUpdateCheck"))).toBeGreaterThan(123);
  });

  it("does not cache a result whose type equals the dist-tag", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ "dist-tags": { latest: "1.0.0" } }))),
    );
    const notifier = new UpdateNotifier({ pkg: { name: "demo", version: "1.0.0" } });
    await runCheck(notifier);
    expect(notifier.config!.get("update")).toBeUndefined();
  });

  it("leaves the timestamp untouched when the registry fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("offline"))));
    const notifier = new UpdateNotifier({ pkg: { name: "demo", version: "1.0.0" } });
    notifier.config!.set("lastUpdateCheck", 123);
    await expect(runCheck(notifier)).resolves.toBeUndefined();
    expect(notifier.config!.get("lastUpdateCheck")).toBe(123);
  });
});
