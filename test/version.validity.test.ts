import semver from "semver";
import { describe, expect, it } from "vitest";
import { parse } from "../src/version.js";

describe("semver validity", () => {
  const invalid = [
    "01.2.3",
    "1.02.3",
    "1.2.03",
    "1.2.3-01",
    "1.2.3-alpha..1",
    "1.2.3-.alpha",
    "1.2.3-alpha.",
    "1.2.3+build..1",
    "9007199254740992.0.0",
  ];

  for (const version of invalid) {
    it(`rejects ${version} like semver`, () => {
      expect(semver.valid(version)).toBeNull();
      expect(parse(version)).toBeNull();
    });
  }

  it("retains valid leading zeroes in build metadata", () => {
    expect(parse("1.2.3+build.001")?.build).toEqual(["build", "001"]);
  });
});
