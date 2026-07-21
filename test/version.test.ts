import { describe, expect, it } from "vitest";
import { compare, gt, parse } from "../src/version.js";

describe("parse", () => {
  it("splits core, prerelease, and build", () => {
    expect(parse("1.2.3-beta.4+build.7")).toEqual({
      major: 1,
      minor: 2,
      patch: 3,
      prerelease: ["beta", 4],
      build: ["build", "7"],
    });
  });

  it("returns null for garbage", () => {
    expect(parse("not-a-version")).toBeNull();
  });
});

describe("compare", () => {
  it("orders by major, minor, then patch", () => {
    expect(compare("2.0.0", "1.9.9")).toBe(1);
    expect(compare("1.2.0", "1.10.0")).toBe(-1);
    expect(compare("1.0.1", "1.0.1")).toBe(0);
  });

  it("ranks a prerelease below its release", () => {
    expect(compare("1.0.0-beta", "1.0.0")).toBe(-1);
  });

  it("compares numeric prerelease identifiers numerically", () => {
    expect(compare("1.0.0-beta.2", "1.0.0-beta.11")).toBe(-1);
  });

  it("ranks numeric identifiers below alphanumeric ones", () => {
    expect(compare("1.0.0-1", "1.0.0-alpha")).toBe(-1);
  });

  it("ignores build metadata", () => {
    expect(compare("1.0.0+a", "1.0.0+b")).toBe(0);
  });
});

describe("gt", () => {
  it("is true only when strictly greater", () => {
    expect(gt("1.0.1", "1.0.0")).toBe(true);
    expect(gt("1.0.0", "1.0.0")).toBe(false);
  });
});
