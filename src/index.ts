import { spawn } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { box, reset, style, type BoxOptions } from "./box.js";
import { Store } from "./cache.js";
import { isDisabled, isInstalledGlobally, isNpmOrYarn } from "./env.js";
import { fetchLatest } from "./registry.js";
import { interpolate } from "./template.js";
import { diff, gt } from "./version.js";

const ONE_DAY = 1000 * 60 * 60 * 24;

export type Update = {
  latest: string;
  current: string;
  /**
   * Matches the union `@types/update-notifier` declares, which is what every
   * TypeScript consumer compiles against — `update-notifier` itself ships no types.
   * The runtime is wider: `diff` returns premajor/preminor/prepatch too, exactly as
   * upstream's `semver.diff` does. Declaring the wider truth would make this type
   * unassignable to `UpdateInfo` and break drop-in use, so the incumbent's gap is
   * reproduced deliberately rather than fixed. Pinned by test/types.differential.test.ts.
   */
  type: "latest" | "major" | "minor" | "patch" | "prerelease" | "build";
  name: string;
};

export type PackageInformation = {
  name?: string;
  version?: string;
};

export type Options = {
  pkg?: PackageInformation;
  packageName?: string;
  packageVersion?: string;
  updateCheckInterval?: number;
  shouldNotifyInNpmScript?: boolean;
  distTag?: string;
};

export type NotifyOptions = {
  defer?: boolean;
  message?: string;
  isGlobal?: boolean;
  boxenOptions?: BoxOptions;
};

export class UpdateNotifier {
  config: Store | undefined;
  update: Update | undefined;
  _packageName: string;
  _shouldNotifyInNpmScript: boolean | undefined;

  #options: Options;
  #packageVersion: string;
  #updateCheckInterval: number;
  #isDisabled: boolean;

  constructor(options: Options = {}) {
    options.pkg ??= {};
    options.distTag ??= "latest";
    options.pkg = {
      name: options.pkg.name ?? options.packageName,
      version: options.pkg.version ?? options.packageVersion,
    };

    if (!options.pkg.name || !options.pkg.version) {
      throw new Error("pkg.name and pkg.version required");
    }

    this.#options = options;
    this._packageName = options.pkg.name;
    this.#packageVersion = options.pkg.version;
    this.#updateCheckInterval =
      typeof options.updateCheckInterval === "number" ? options.updateCheckInterval : ONE_DAY;
    this.#isDisabled = isDisabled();
    this._shouldNotifyInNpmScript = options.shouldNotifyInNpmScript;

    if (this.#isDisabled) return;

    try {
      this.config = new Store(`update-notifier-${this._packageName}`, {
        optOut: false,
        lastUpdateCheck: Date.now(),
      });
    } catch {
      const configHome = process.env.XDG_CONFIG_HOME ?? process.env.APPDATA ?? "the local config directory";
      const message =
        ` ${this._packageName} update check failed \n` +
        " Try running with sudo or get access \n" +
        ` to the local update config store via \n ${configHome} `;
      process.on("exit", () => {
        console.error(box(message, { textAlignment: "center", borderStyle: "round" }));
      });
    }
  }

  check(): void {
    if (!this.config || this.config.get("optOut") || this.#isDisabled) return;

    this.update = this.config.get<Update>("update");
    if (this.update) {
      this.update.current = this.#packageVersion;
      this.config.delete("update");
    }

    const lastUpdateCheck = Number(this.config.get("lastUpdateCheck") ?? 0);
    if (Date.now() - lastUpdateCheck < this.#updateCheckInterval) return;

    try {
      const moduleDirectory =
        typeof __dirname === "string" ? __dirname : path.dirname(fileURLToPath(import.meta.url));
      const childEntry = path.join(moduleDirectory, "check.cjs");
      const child = spawn(process.execPath, [childEntry, JSON.stringify(this.#options)], {
        detached: true,
        stdio: "ignore",
        windowsHide: true,
      });
      child.on("error", () => {
        // Asynchronous spawn failures are environmental and cannot affect the host CLI.
      });
      child.unref();
    } catch {
      // Serialization and synchronous spawn failures only postpone the next update check.
    }
  }

  async fetchInfo(): Promise<Update> {
    const distTag = this.#options.distTag ?? "latest";
    const latest = await fetchLatest(this._packageName, distTag);
    return {
      latest,
      current: this.#packageVersion,
      // Widening back down: the value is whatever semver reports, which can fall
      // outside the declared union. See the note on Update["type"].
      type: (diff(this.#packageVersion, latest) ?? distTag) as Update["type"],
      name: this._packageName,
    };
  }

  notify(options: NotifyOptions = {}): this {
    const suppressForNpm = !this._shouldNotifyInNpmScript && isNpmOrYarn();
    if (
      !process.stdout.isTTY ||
      suppressForNpm ||
      !this.update ||
      !gt(this.update.latest, this.update.current)
    ) {
      return this;
    }

    const globallyInstalled = options.isGlobal ?? isInstalledGlobally();
    const updateCommand = globallyInstalled
      ? `npm i -g ${this._packageName}`
      : `npm i ${this._packageName}`;
    const defaultTemplate =
      "Update available " +
      style("{currentVersion}", undefined, true) +
      reset(" → ") +
      style("{latestVersion}", "green") +
      " \nRun " +
      style("{updateCommand}", "cyan") +
      " to update";
    const template = options.message || defaultTemplate;
    options.boxenOptions ??= {
      padding: 1,
      margin: 1,
      textAlignment: "center",
      borderColor: "yellow",
      borderStyle: "round",
    };

    const message = box(
      interpolate(template, {
        packageName: this._packageName,
        currentVersion: this.update.current,
        latestVersion: this.update.latest,
        updateCommand,
      }),
      options.boxenOptions,
    );

    if (options.defer === false) {
      console.error(message);
    } else {
      process.on("exit", () => {
        console.error(message);
      });
    }
    return this;
  }
}

export default function updateNotifier(options: Options = {}): UpdateNotifier {
  const notifier = new UpdateNotifier(options);
  notifier.check();
  return notifier;
}
