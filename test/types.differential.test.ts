import { describe, expect, it } from "vitest";
import type { Update } from "../src/index.js";
import { diff } from "../src/version.js";

/**
 * `update-notifier` ships no type declarations of its own. Everyone who consumes it
 * from TypeScript compiles against `@types/update-notifier`, so that package — not the
 * runtime — is the contract a drop-in replacement has to satisfy. This is the `type`
 * union it declares.
 *
 * Copied rather than depended on: `@types/update-notifier` declares the module
 * `update-notifier`, which `test/oracles.d.ts` already declares for the runtime oracle,
 * and the two would collide. The published types are also v6 while the dev dependency
 * is v7.3.1.
 *
 * Checked verbatim against `@types/update-notifier@6.0.8` (published 2023-11-16, the
 * latest) on 2026-08-01 — it reads:
 *   readonly type: "latest" | "major" | "minor" | "patch" | "prerelease" | "build";
 * If that package ever moves, re-check this by hand; nothing here can detect it.
 */
type UpstreamUpdateType = "latest" | "major" | "minor" | "patch" | "prerelease" | "build";

type UpstreamUpdateInfo = {
  latest: string;
  current: string;
  type: UpstreamUpdateType;
  name: string;
};

describe("type-level compatibility with @types/update-notifier", () => {
  it("declares Update so it is assignable to UpdateInfo", () => {
    // Compile-time assertion. `tsc --noEmit` fails here if `Update.type` widens, which
    // is what broke `tsc --build` in facebook/docusaurus: their beforeCli.mjs annotates
    // the notifier result with `import('update-notifier').UpdateInfo`, and a `string`
    // is not assignable to that union.
    const ours = {
      latest: "2.0.0",
      current: "1.0.0",
      type: "major",
      name: "pkg",
    } satisfies Update;

    const asUpstream: UpstreamUpdateInfo = ours;
    expect(asUpstream.type).toBe("major");
  });

  it("keeps every Update field assignable, not just type", () => {
    const roundTrip = (update: Update): UpstreamUpdateInfo => update;
    const value = roundTrip({
      latest: "1.2.3",
      current: "1.0.0",
      type: "minor",
      name: "pkg",
    });
    expect(value).toEqual({ latest: "1.2.3", current: "1.0.0", type: "minor", name: "pkg" });
  });
});

describe("the values diff() can actually produce", () => {
  // The declared union is narrower than the runtime, and deliberately so: upstream has
  // the same gap. `semver.diff` — which update-notifier uses and this package mirrors —
  // returns premajor/preminor/prepatch, none of which @types/update-notifier lists.
  // Matching the incumbent's declaration is what makes the package a drop-in; this test
  // pins the gap so it stays a known, deliberate one.
  const prereleaseCases: Array<[string, string, string]> = [
    ["1.0.0", "2.0.0-alpha.1", "premajor"],
    ["1.0.0", "1.1.0-alpha.1", "preminor"],
    ["1.0.0", "1.0.1-alpha.1", "prepatch"],
  ];

  it.each(prereleaseCases)("diff(%s, %s) is %s, which the union omits", (from, to, expected) => {
    const result = diff(from, to);
    expect(result).toBe(expected);
    expect(["latest", "major", "minor", "patch", "prerelease", "build"]).not.toContain(result);
  });

  it.each([
    ["1.0.0", "2.0.0", "major"],
    ["1.0.0", "1.1.0", "minor"],
    ["1.0.0", "1.0.1", "patch"],
    ["1.0.0-alpha.1", "1.0.0-alpha.2", "prerelease"],
  ])("diff(%s, %s) is %s, which the union covers", (from, to, expected) => {
    expect(diff(from, to)).toBe(expected);
  });
});
