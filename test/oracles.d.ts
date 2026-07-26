declare module "update-notifier" {
  type Options = {
    pkg?: { name?: string; version?: string };
    packageName?: string;
    packageVersion?: string;
    shouldNotifyInNpmScript?: boolean;
  };

  type Update = { latest: string; current: string; type: string; name: string };

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
