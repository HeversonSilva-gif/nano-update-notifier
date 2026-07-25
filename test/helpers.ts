import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach } from "vitest";

const ENV_KEYS = [
  "APPDATA",
  "CI",
  "CONTINUOUS_INTEGRATION",
  "FORCE_COLOR",
  "NO_COLOR",
  "NO_UPDATE_NOTIFIER",
  "NODE_ENV",
  "XDG_CONFIG_HOME",
  "npm_config_registry",
  "npm_config_user_agent",
  "npm_package_json",
] as const;

/** Redirects config files and restores every ambient variable touched by tests. */
export function useTemporaryHome(): { readonly path: string } {
  let home = "";
  let original: Partial<Record<(typeof ENV_KEYS)[number], string>> = {};

  beforeEach(() => {
    original = Object.fromEntries(
      ENV_KEYS.flatMap((key) => (process.env[key] === undefined ? [] : [[key, process.env[key]!]])),
    );
    home = fs.mkdtempSync(path.join(os.tmpdir(), "nun-"));

    for (const key of ENV_KEYS) delete process.env[key];
    process.env.XDG_CONFIG_HOME = home;
    process.env.NODE_ENV = "development";
    process.env.NO_COLOR = "1";
  });

  afterEach(() => {
    for (const key of ENV_KEYS) delete process.env[key];
    Object.assign(process.env, original);
    fs.rmSync(home, { recursive: true, force: true });
  });

  return {
    get path() {
      return home;
    },
  };
}
