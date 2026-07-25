import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";

const DEFAULT_REGISTRY = "https://registry.npmjs.org/";
const ABBREVIATED = "application/vnd.npm.install-v1+json; q=1.0, application/json; q=0.8, */*";

function environmentValue(value: string, env: NodeJS.ProcessEnv): string {
  return value.replace(/\$\{([^}]+)\}/g, (_match, name: string) => env[name] ?? "");
}

function parseNpmrc(source: string, env: NodeJS.ProcessEnv): Map<string, string> {
  const entries = new Map<string, string>();
  for (const line of source.split(/\r?\n/)) {
    const match = /^\s*([^#;=\s]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (match) entries.set(match[1]!, environmentValue(match[2]!, env));
  }
  return entries;
}

function npmConfiguration(source: string, env: NodeJS.ProcessEnv): Map<string, string> {
  const entries = parseNpmrc(source, env);
  for (const [name, value] of Object.entries(env)) {
    if (value === undefined || !name.toLowerCase().startsWith("npm_config_")) continue;
    entries.set(name.slice("npm_config_".length), environmentValue(value, env));
  }
  return entries;
}

function readFile(file: string | undefined): string {
  if (!file) return "";
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    // npm configuration files are optional at every precedence level.
    return "";
  }
}

function findProjectNpmrc(start = process.cwd()): string | undefined {
  let directory = path.resolve(start);
  while (true) {
    const candidate = path.join(directory, ".npmrc");
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(directory);
    if (parent === directory) return undefined;
    directory = parent;
  }
}

function loadedNpmrc(env: NodeJS.ProcessEnv): string {
  const prefix = env.npm_config_prefix ?? env.PREFIX;
  const globalConfig =
    env.npm_config_globalconfig ??
    (prefix
      ? path.join(prefix, "etc", "npmrc")
      : process.platform === "win32"
        ? env.APPDATA && path.join(env.APPDATA, "npm", "etc", "npmrc")
        : "/etc/npmrc");
  const userConfig = env.npm_config_userconfig ?? path.join(os.homedir(), ".npmrc");
  return [readFile(globalConfig || undefined), readFile(userConfig), readFile(findProjectNpmrc())]
    .filter(Boolean)
    .join("\n");
}

function withTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}

function findEnvironment(env: NodeJS.ProcessEnv, name: string): string | undefined {
  const entry = Object.entries(env).find(([key]) => key.toLowerCase() === name.toLowerCase());
  return entry?.[1];
}

export function resolveRegistry(
  packageName: string,
  env: NodeJS.ProcessEnv = process.env,
  npmrc: string = loadedNpmrc(env),
): string {
  const entries = npmConfiguration(npmrc, env);
  const scope = packageName.startsWith("@") ? packageName.split("/")[0] : undefined;
  const scoped = scope
    ? entries.get(`${scope}:registry`) ??
      findEnvironment(env, `npm_config_${scope}:registry`) ??
      findEnvironment(env, `npm_config_${scope}_registry`)
    : undefined;
  const registry =
    scoped ?? findEnvironment(env, "npm_config_registry") ?? entries.get("registry") ?? DEFAULT_REGISTRY;
  return withTrailingSlash(environmentValue(registry, env));
}

function authorization(registry: string, entries: Map<string, string>, env: NodeJS.ProcessEnv): string | undefined {
  const url = new URL(registry);
  let pathname = url.pathname.endsWith("/") ? url.pathname : `${url.pathname}/`;

  while (true) {
    const key = `//${url.host}${pathname}`;
    const token = entries.get(`${key}:_authToken`) ?? entries.get(`${key.replace(/\/$/, "")}:_authToken`);
    if (token) return `Bearer ${environmentValue(token, env)}`;

    const legacy = entries.get(`${key}:_auth`) ?? entries.get(`${key.replace(/\/$/, "")}:_auth`);
    if (legacy) return `Basic ${environmentValue(legacy, env)}`;

    const username = entries.get(`${key}:username`) ?? entries.get(`${key.replace(/\/$/, "")}:username`);
    const encodedPassword = entries.get(`${key}:_password`) ?? entries.get(`${key.replace(/\/$/, "")}:_password`);
    if (username && encodedPassword) {
      const password = Buffer.from(environmentValue(encodedPassword, env), "base64").toString("utf8");
      return `Basic ${Buffer.from(`${username}:${password}`, "utf8").toString("base64")}`;
    }

    if (pathname === "/") break;
    pathname = new URL("..", `https://${url.host}${pathname}`).pathname;
    if (!pathname.endsWith("/")) pathname += "/";
  }

  const legacy = entries.get("_auth");
  return legacy ? `Basic ${environmentValue(legacy, env)}` : undefined;
}

export type FetchLatestOptions = {
  timeoutMs?: number;
  env?: NodeJS.ProcessEnv;
  npmrc?: string;
};

export async function fetchLatest(
  packageName: string,
  distTag: string,
  { timeoutMs = 30_000, env = process.env, npmrc = loadedNpmrc(env) }: FetchLatestOptions = {},
): Promise<string> {
  const registry = resolveRegistry(packageName, env, npmrc);
  const packageUrl = new URL(encodeURIComponent(packageName).replace(/^%40/, "@"), registry);
  const entries = npmConfiguration(npmrc, env);
  const auth = authorization(registry, entries, env);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error("registry request timed out")), timeoutMs);
  timer.unref?.();

  try {
    const headers: Record<string, string> = { accept: ABBREVIATED };
    if (auth) headers.authorization = auth;
    const response = await fetch(packageUrl, { headers, signal: controller.signal, keepalive: true });
    if (!response.ok) throw new Error(`registry responded ${response.status}`);

    const body = (await response.json()) as { "dist-tags"?: Record<string, unknown> };
    const version = body["dist-tags"]?.[distTag];
    if (typeof version !== "string" || !version) {
      throw new Error(`no version published under dist-tag "${distTag}"`);
    }
    return version;
  } finally {
    clearTimeout(timer);
  }
}
