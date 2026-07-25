import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

export function isInCi(env: NodeJS.ProcessEnv = process.env): boolean {
  return (
    env.CI !== "0" &&
    env.CI !== "false" &&
    ("CI" in env || "CONTINUOUS_INTEGRATION" in env || Object.keys(env).some((key) => key.startsWith("CI_")))
  );
}

export function isNpmOrYarn(env: NodeJS.ProcessEnv = process.env): boolean {
  const userAgent = env.npm_config_user_agent;
  return (
    Boolean(userAgent?.startsWith("npm")) ||
    Boolean(userAgent?.startsWith("yarn")) ||
    Boolean(env.npm_package_json?.endsWith("package.json"))
  );
}

export function isDisabled(
  env: NodeJS.ProcessEnv = process.env,
  argv: string[] = process.argv,
): boolean {
  return (
    "NO_UPDATE_NOTIFIER" in env ||
    env.NODE_ENV === "test" ||
    argv.includes("--no-update-notifier") ||
    isInCi(env)
  );
}

type GlobalInstallPaths = {
  moduleDirectory?: string;
  npmPackages?: string;
  yarnPackages?: string;
};

function npmPrefix(): string {
  const configured = Object.entries(process.env).find(([key]) => /^npm_config_prefix$/i.test(key))?.[1];
  if (configured) return configured;
  if (process.env.PREFIX) return process.env.PREFIX;
  if (process.platform === "win32") return process.env.APPDATA ? path.join(process.env.APPDATA, "npm") : path.dirname(process.execPath);
  return path.dirname(path.dirname(process.execPath));
}

function defaultGlobalPaths(): Required<GlobalInstallPaths> {
  const prefix = path.resolve(npmPrefix());
  const npmPackages = path.join(prefix, process.platform === "win32" ? "node_modules" : "lib/node_modules");
  const windowsYarn = process.env.LOCALAPPDATA
    ? path.join(process.env.LOCALAPPDATA, "Yarn", "Data", "global", "node_modules")
    : "";
  const yarnPackages =
    windowsYarn && fs.existsSync(path.dirname(path.dirname(windowsYarn)))
      ? windowsYarn
      : path.join(os.homedir(), ".config", "yarn", "global", "node_modules");

  return {
    moduleDirectory:
      typeof __dirname === "string" ? __dirname : path.dirname(fileURLToPath(import.meta.url)),
    npmPackages,
    yarnPackages,
  };
}

function isPathInside(child: string, parent: string): boolean {
  const relation = path.relative(path.resolve(parent), path.resolve(child));
  return Boolean(relation && relation !== ".." && !relation.startsWith(`..${path.sep}`) && !path.isAbsolute(relation));
}

export function isInstalledGlobally(paths: GlobalInstallPaths = {}): boolean {
  const defaults = defaultGlobalPaths();
  const moduleDirectory = paths.moduleDirectory ?? defaults.moduleDirectory;
  const npmPackages = paths.npmPackages ?? defaults.npmPackages;
  const yarnPackages = paths.yarnPackages ?? defaults.yarnPackages;

  try {
    return isPathInside(moduleDirectory, npmPackages) || isPathInside(moduleDirectory, yarnPackages);
  } catch {
    // A missing or inaccessible global package directory means this install is local.
    return false;
  }
}
