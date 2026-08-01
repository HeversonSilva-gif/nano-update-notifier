declare module "update-notifier" {
  type Options = {
    pkg?: { name?: string; version?: string };
    packageName?: string;
    packageVersion?: string;
    shouldNotifyInNpmScript?: boolean;
  };

  // `type` mirrors the union in `@types/update-notifier`, which is what TypeScript
  // consumers actually compile against — the runtime package ships no declarations.
  // It was `string` here until 2026-08-01, and that is why 300 tests agreed with a
  // `Update["type"]` that facebook/docusaurus could not build against: the oracle
  // reproduced the bug instead of catching it.
  type Update = {
    latest: string;
    current: string;
    type: "latest" | "major" | "minor" | "patch" | "prerelease" | "build";
    name: string;
  };

  type Config = {
    readonly size: number;
    readonly path: string;
    get(key: string): unknown;
    set(key: string, value: unknown): void;
    has(key: string): boolean;
  };

  type Notifier = {
    config?: Config;
    update?: Update;
    _packageName: string;
    _shouldNotifyInNpmScript?: boolean;
    notify(options?: { defer?: boolean; isGlobal?: boolean }): Notifier;
  };

  export default function updateNotifier(options?: Options): Notifier;
}
