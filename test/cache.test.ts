import fs from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { Store } from "../src/cache.js";
import { useTemporaryHome } from "./helpers.js";

useTemporaryHome();

describe("Store", () => {
  it("seeds defaults and persists across instances", () => {
    const store = new Store("demo", { lastUpdateCheck: 42 });
    store.set("update", { latest: "2.0.0" });

    const next = new Store("demo");
    expect(next.get("lastUpdateCheck")).toBe(42);
    expect(next.get("update")).toEqual({ latest: "2.0.0" });
  });

  it("supports the public ConfigStore surface", () => {
    const store = new Store("demo");
    store.set("nested.value", 1);
    store.set({ second: 2, third: 3 });

    expect(store.get("nested.value")).toBe(1);
    expect(store.has("nested.value")).toBe(true);
    expect(store.size).toBe(3);
    expect(store.all).toEqual({ nested: { value: 1 }, second: 2, third: 3 });

    store.delete("nested.value");
    expect(store.has("nested.value")).toBe(false);
    store.all = { replaced: true };
    expect(store.all).toEqual({ replaced: true });
    store.clear();
    expect(store.all).toEqual({});
  });

  it("supports escaped dots and array indexes in paths", () => {
    const store = new Store("demo");
    store.set("literal\\.dot.items[0].name", "first");
    expect(store.get("literal\\.dot.items[0].name")).toBe("first");
  });

  it("recovers from corrupt JSON", () => {
    const store = new Store("demo");
    fs.writeFileSync(store.path, "{ broken");
    expect(new Store("demo").all).toEqual({});
  });

  it("uses atomic writes without leaving temporary files", () => {
    const store = new Store("demo");
    store.set("value", 1);
    expect(fs.readdirSync(requireDirectory(store.path)).some((file) => file.endsWith(".tmp"))).toBe(
      false,
    );
  });

  it("surfaces permission failures during construction for the notifier to handle", () => {
    const error = Object.assign(new Error("denied"), { code: "EACCES" });
    vi.spyOn(fs, "mkdirSync").mockImplementation(() => {
      throw error;
    });
    expect(() => new Store("demo")).toThrow(error);
    vi.restoreAllMocks();
  });
});

function requireDirectory(file: string): string {
  return file.slice(0, Math.max(file.lastIndexOf("/"), file.lastIndexOf("\\")));
}
