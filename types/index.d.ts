export type Spacing = {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
};

export type BorderStyle = {
  topLeft: string;
  top: string;
  topRight: string;
  right: string;
  bottomRight: string;
  bottom: string;
  bottomLeft: string;
  left: string;
  horizontal?: string;
  vertical?: string;
};

export type BoxOptions = {
  borderColor?: string;
  borderStyle?: "single" | "double" | "round" | "bold" | "singleDouble" | "doubleSingle" | "classic" | "arrow" | "none" | BorderStyle;
  dimBorder?: boolean;
  padding?: number | Spacing;
  margin?: number | Spacing;
  float?: "left" | "right" | "center";
  backgroundColor?: string;
  align?: "left" | "right" | "center";
  textAlignment?: "left" | "right" | "center";
  title?: string;
  titleAlignment?: "left" | "right" | "center";
  width?: number;
  height?: number;
  fullscreen?: boolean | ((width: number, height: number) => [number, number]);
};

/**
 * Matches the union `@types/update-notifier` declares, which is what every TypeScript
 * consumer compiles against — `update-notifier` itself ships no declarations. The
 * runtime is wider: `diff` returns premajor/preminor/prepatch, exactly as upstream's
 * `semver.diff` does. Declaring that wider truth would make this unassignable to
 * `UpdateInfo` and break drop-in use, so the incumbent's gap is reproduced on purpose.
 */
export type Update = {
  latest: string;
  current: string;
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

export type ConfigStore = {
  readonly path: string;
  readonly size: number;
  all: Record<string, unknown>;
  // Defaults to `any`, not `unknown`, to match `configstore`: callers do arithmetic on
  // the result without narrowing.
  get<T = any>(key: string): T | undefined;
  set(key: string, value: unknown): void;
  set(values: Record<string, unknown>): void;
  has(key: string): boolean;
  delete(key: string): void;
  clear(): void;
};

export type UpdateNotifier = {
  config?: ConfigStore;
  update?: Update;
  _packageName: string;
  _shouldNotifyInNpmScript?: boolean;
  check(): void;
  fetchInfo(): Promise<Update>;
  notify(options?: NotifyOptions): UpdateNotifier;
};

export default function updateNotifier(options?: Options): UpdateNotifier;
