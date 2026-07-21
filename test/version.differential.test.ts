import semver from "semver";
import { describe, expect, it } from "vitest";
import { compare, diff } from "../src/version.js";

function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

const PRERELEASE_TAGS = ["alpha", "beta", "rc", "next", "canary", "0", "1", "11", "2"];

function generate(random: () => number): string {
  const core = [0, 1, 2].map(() => Math.floor(random() * 4)).join(".");
  if (random() < 0.5) return core;

  const count = 1 + Math.floor(random() * 2);
  const tags = Array.from(
    { length: count },
    () => PRERELEASE_TAGS[Math.floor(random() * PRERELEASE_TAGS.length)]!,
  );
  return `${core}-${tags.join(".")}`;
}

describe("differential against semver", () => {
  const random = seeded(20_260_721);
  const pairs = Array.from({ length: 5000 }, () => [generate(random), generate(random)] as const);

  it("compare matches semver.compare on every generated pair", () => {
    const divergences = pairs.filter(([a, b]) => compare(a, b) !== semver.compare(a, b));
    expect(divergences).toEqual([]);
  });

  it("diff matches semver.diff on every generated pair", () => {
    const divergences = pairs.filter(([a, b]) => diff(a, b) !== semver.diff(a, b));
    expect(divergences).toEqual([]);
  });
});
