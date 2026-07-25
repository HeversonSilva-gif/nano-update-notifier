import path from "node:path";
import { describe, expect, it } from "vitest";
import { isDisabled, isInCi, isInstalledGlobally, isNpmOrYarn } from "../src/env.js";

describe("isInCi", () => {
  it("matches is-in-ci environment semantics", () => {
    expect(isInCi({ CI: "true" })).toBe(true);
    expect(isInCi({ CI: "" })).toBe(true);
    expect(isInCi({ CI: "0" })).toBe(false);
    expect(isInCi({ CI: "false" })).toBe(false);
    expect(isInCi({ CONTINUOUS_INTEGRATION: "1" })).toBe(true);
    expect(isInCi({ CI_VENDOR_NAME: "1" })).toBe(true);
    expect(isInCi({ GITHUB_ACTIONS: "true" })).toBe(false);
  });
});

describe("isDisabled", () => {
  it("honours every upstream opt-out", () => {
    expect(isDisabled({ NO_UPDATE_NOTIFIER: "" }, [])).toBe(true);
    expect(isDisabled({ NO_UPDATE_NOTIFIER: "0" }, [])).toBe(true);
    expect(isDisabled({ NODE_ENV: "test" }, [])).toBe(true);
    expect(isDisabled({}, ["node", "cli.js", "--no-update-notifier"])).toBe(true);
    expect(isDisabled({ CI: "0" }, ["node", "cli.js"])).toBe(false);
  });
});

describe("isNpmOrYarn", () => {
  it("matches the package-manager markers used upstream", () => {
    expect(isNpmOrYarn({ npm_config_user_agent: "npm/10 node/v22" })).toBe(true);
    expect(isNpmOrYarn({ npm_config_user_agent: "yarn/1.22 node/v22" })).toBe(true);
    expect(isNpmOrYarn({ npm_config_user_agent: "pnpm/10 node/v22" })).toBe(false);
    expect(isNpmOrYarn({ npm_package_json: path.join("work", "package.json") })).toBe(true);
    expect(isNpmOrYarn({})).toBe(false);
  });
});

describe("isInstalledGlobally", () => {
  it("recognises npm and Yarn global package roots", () => {
    expect(
      isInstalledGlobally({
        moduleDirectory: path.join("C:\\npm", "node_modules", "demo"),
        npmPackages: path.join("C:\\npm", "node_modules"),
        yarnPackages: path.join("C:\\yarn", "global", "node_modules"),
      }),
    ).toBe(true);
    expect(
      isInstalledGlobally({
        moduleDirectory: path.join("C:\\work", "demo"),
        npmPackages: path.join("C:\\npm", "node_modules"),
        yarnPackages: path.join("C:\\yarn", "global", "node_modules"),
      }),
    ).toBe(false);
  });
});
