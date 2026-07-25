import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { startRegistry } from "./fake-registry.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");
const PACKAGE = "demo-cli";

if (!fs.existsSync(path.join(root, "dist", "index.js"))) {
  console.error("dist/ is missing — run `npm run build` first.");
  process.exit(1);
}

const registry = await startRegistry();
const configHome = fs.mkdtempSync(path.join(os.tmpdir(), "nun-playground-"));
const cacheFile = path.join(configHome, "configstore", `update-notifier-${PACKAGE}.json`);

function childEnvironment(extra = {}) {
  const env = { ...process.env };
  // A dev machine can carry any of these, and they all suppress notifications.
  for (const key of Object.keys(env)) {
    if (key.startsWith("CI_") || key === "CI" || key === "CONTINUOUS_INTEGRATION") delete env[key];
  }
  delete env.NO_UPDATE_NOTIFIER;
  delete env.npm_config_user_agent;
  delete env.npm_package_json;

  return {
    ...env,
    NODE_ENV: "development",
    FORCE_COLOR: "1",
    XDG_CONFIG_HOME: configHome,
    npm_config_registry: registry.url,
    DEMO_PKG_NAME: PACKAGE,
    DEMO_PKG_VERSION: "1.0.0",
    ...extra,
  };
}

function run(script, { args = [], env = {} } = {}) {
  return new Promise((resolve) => {
    const started = Date.now();
    const child = spawn(process.execPath, [path.join(here, script), ...args], {
      cwd: root,
      env: childEnvironment(env),
      stdio: ["ignore", "inherit", "inherit"],
    });
    child.on("close", (code) => resolve({ code, elapsed: Date.now() - started }));
  });
}

function seedCache(update) {
  fs.mkdirSync(path.dirname(cacheFile), { recursive: true });
  fs.writeFileSync(cacheFile, JSON.stringify({ optOut: false, lastUpdateCheck: Date.now(), update }));
}

async function waitForCachedUpdate(timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const cached = JSON.parse(fs.readFileSync(cacheFile, "utf8"));
      if (cached.update) return cached;
    } catch {
      // The detached worker has not written the cache yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return undefined;
}

function heading(text) {
  console.log(`\n${text}`);
  console.log("─".repeat(Math.min(72, text.length)));
}

heading("Setup");
console.log(`fake registry : ${registry.url} (every package resolves to 9.9.9)`);
console.log(`config home   : ${configHome}`);
console.log(`cache file    : ${cacheFile}`);

heading("1. First run — cold cache, no notification, must not block exit");
const first = await run("demo-cli.mjs", { args: ["--force-tty"] });
console.log(`exited in ${first.elapsed} ms with code ${first.code}`);
console.log("No box above: the check runs in a detached worker and lands in the cache.");

const cached = await waitForCachedUpdate();
if (!cached) {
  console.error("\nThe detached worker never wrote an update to the cache.");
  await registry.close();
  fs.rmSync(configHome, { recursive: true, force: true });
  process.exit(1);
}
console.log(`\nWorker wrote: ${JSON.stringify(cached.update)}`);
console.log(`Registry saw ${registry.requests.length} request(s): ${registry.requests.join(", ")}`);

heading("2. Second run — the cached update is rendered on exit");
await run("demo-cli.mjs", { args: ["--force-tty"] });

heading("3. The same update through the CommonJS entry point");
seedCache(cached.update);
await run("demo-cli.cjs", { args: ["--force-tty"] });

heading("4. Custom message template");
seedCache(cached.update);
await run("demo-cli.mjs", {
  args: ["--force-tty"],
  env: { DEMO_MESSAGE: "{packageName} {currentVersion} → {latestVersion}\nRun {updateCommand}" },
});

heading("5. Global install wording");
seedCache(cached.update);
await run("demo-cli.mjs", { args: ["--force-tty"], env: { DEMO_GLOBAL: "1" } });

heading("6. Opt-outs — each must print the CLI's own line and nothing else");
for (const scenario of [
  { label: "--no-update-notifier flag", args: ["--force-tty", "--no-update-notifier"] },
  { label: "NO_UPDATE_NOTIFIER=1", args: ["--force-tty"], env: { NO_UPDATE_NOTIFIER: "1" } },
  { label: "CI=true", args: ["--force-tty"], env: { CI: "true" } },
  { label: "npm script", args: ["--force-tty"], env: { npm_config_user_agent: "npm/10.0.0 node/v20" } },
  { label: "output is not a TTY", args: [] },
]) {
  seedCache(cached.update);
  console.log(`\n> ${scenario.label}`);
  await run("demo-cli.mjs", scenario);
}

heading("7. Dead registry — silent failure, still exits immediately");
const dead = await run("demo-cli.mjs", {
  args: ["--force-tty"],
  env: { DEMO_PKG_NAME: "demo-cli-offline", npm_config_registry: "http://127.0.0.1:9/" },
});
console.log(`exited in ${dead.elapsed} ms with code ${dead.code} — no error, no hang`);

heading("Done");
console.log("Nothing was published, installed, or written outside the temp config home.");

await registry.close();
fs.rmSync(configHome, { recursive: true, force: true });
