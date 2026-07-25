import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";

type Data = Record<string, unknown>;
type PathPart = string | number;

function configDirectory(): string {
  if (process.env.XDG_CONFIG_HOME) return process.env.XDG_CONFIG_HOME;
  if (process.platform === "win32") {
    return process.env.APPDATA ?? path.join(os.homedir(), "AppData", "Roaming");
  }
  return path.join(os.homedir(), ".config");
}

function pathParts(value: string): PathPart[] {
  const parts: PathPart[] = [];
  let current = "";

  const pushCurrent = (): void => {
    if (current) parts.push(current);
    current = "";
  };

  for (let index = 0; index < value.length; index++) {
    const character = value[index]!;
    if (character === "\\" && index + 1 < value.length) {
      current += value[++index]!;
    } else if (character === ".") {
      pushCurrent();
    } else if (character === "[") {
      const end = value.indexOf("]", index + 1);
      const candidate = end === -1 ? "" : value.slice(index + 1, end);
      if (/^\d+$/.test(candidate)) {
        pushCurrent();
        parts.push(Number(candidate));
        index = end;
      } else {
        current += character;
      }
    } else {
      current += character;
    }
  }
  pushCurrent();
  return parts;
}

function isSafePart(part: PathPart): boolean {
  return typeof part === "number" || !["__proto__", "prototype", "constructor"].includes(part);
}

function getPath(data: unknown, key: string): unknown {
  let current = data;
  for (const part of pathParts(key)) {
    if (!isSafePart(part) || (typeof current !== "object" && !Array.isArray(current)) || current === null) {
      return undefined;
    }
    current = (current as Record<PathPart, unknown>)[part];
  }
  return current;
}

function setPath(data: Data, key: string, value: unknown): void {
  const parts = pathParts(key);
  if (parts.length === 0 || parts.some((part) => !isSafePart(part))) return;

  let current: Record<PathPart, unknown> = data;
  for (let index = 0; index < parts.length - 1; index++) {
    const part = parts[index]!;
    const next = parts[index + 1]!;
    const existing = current[part];
    if (typeof existing !== "object" || existing === null) {
      current[part] = typeof next === "number" ? [] : {};
    }
    current = current[part] as Record<PathPart, unknown>;
  }
  current[parts.at(-1)!] = value;
}

function deletePath(data: Data, key: string): void {
  const parts = pathParts(key);
  if (parts.length === 0 || parts.some((part) => !isSafePart(part))) return;
  let current: Record<PathPart, unknown> = data;
  for (const part of parts.slice(0, -1)) {
    const next = current[part];
    if (typeof next !== "object" || next === null) return;
    current = next as Record<PathPart, unknown>;
  }
  delete current[parts.at(-1)!];
}

function clone(data: Data): Data {
  return JSON.parse(JSON.stringify(data)) as Data;
}

function assertSerializable(value: unknown): void {
  try {
    if (JSON.stringify(value) === undefined) throw new TypeError("Value is not JSON serializable");
  } catch (error) {
    throw error instanceof TypeError ? error : new TypeError("Value is not JSON serializable");
  }
}

function permissionError(error: unknown): boolean {
  const code = (error as NodeJS.ErrnoException | undefined)?.code;
  return code === "EACCES" || code === "EPERM";
}

export class Store {
  readonly path: string;
  #data: Data;
  #temporaryCounter = 0;

  constructor(name: string, defaults: Data = {}) {
    this.path = path.join(configDirectory(), "configstore", `${name}.json`);
    fs.mkdirSync(path.dirname(this.path), { recursive: true });
    this.#data = this.#read();

    const missing = Object.fromEntries(Object.entries(defaults).filter(([key]) => !(key in this.#data)));
    if (Object.keys(missing).length > 0) {
      this.#data = { ...missing, ...this.#data };
      this.#write(true);
    }
  }

  get all(): Data {
    return clone(this.#data);
  }

  set all(value: Data) {
    if (!value || Array.isArray(value) || typeof value !== "object") {
      throw new TypeError("Config must be an object");
    }
    assertSerializable(value);
    this.#data = clone(value);
    this.#write();
  }

  get size(): number {
    return Object.keys(this.#data).length;
  }

  #read(): Data {
    try {
      const parsed = JSON.parse(fs.readFileSync(this.path, "utf8")) as unknown;
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Data) : {};
    } catch (error) {
      if (permissionError(error)) throw error;
      // Missing and corrupt stores both represent a cold cache and are safe to replace.
      return {};
    }
  }

  #write(throwOnPermission = false): void {
    const temporary = `${this.path}.${process.pid}.${this.#temporaryCounter++}.tmp`;
    try {
      fs.writeFileSync(temporary, JSON.stringify(this.#data, null, "\t"), { mode: 0o600 });
      fs.renameSync(temporary, this.path);
    } catch (error) {
      try {
        fs.rmSync(temporary, { force: true });
      } catch {
        // The temporary file is already gone or inaccessible.
      }
      if (throwOnPermission && permissionError(error)) throw error;
      // A failed cache write must not change the host CLI's exit status.
    }
  }

  get<T = unknown>(key: string): T | undefined {
    return getPath(this.#data, key) as T | undefined;
  }

  set(key: string, value: unknown): void;
  set(values: Data): void;
  set(keyOrValues: string | Data, value?: unknown): void {
    if (typeof keyOrValues === "string") {
      assertSerializable(value);
      setPath(this.#data, keyOrValues, value);
    } else {
      assertSerializable(keyOrValues);
      for (const [key, entry] of Object.entries(keyOrValues)) setPath(this.#data, key, entry);
    }
    this.#write();
  }

  has(key: string): boolean {
    return getPath(this.#data, key) !== undefined;
  }

  delete(key: string): void {
    deletePath(this.#data, key);
    this.#write();
  }

  clear(): void {
    this.#data = {};
    this.#write();
  }
}
