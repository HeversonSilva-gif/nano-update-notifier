import updateNotifier, { type Options, type UpdateNotifier } from "nano-update-notifier";

const options: Options = { pkg: { name: "demo", version: "1.0.0" } };
const notifier: UpdateNotifier = updateNotifier(options);
notifier.notify({ defer: false });

// The names `@types/update-notifier` exports. Consumers import these directly —
// `@serwist/cli` writes `import updateNotifier, { type Package } from "update-notifier"`
// — so a drop-in replacement has to answer to them, not only to our own spelling.
import type {
  Package,
  Settings,
  UpdateInfo,
  NotifyOptions,
  UpdateNotifier as UpstreamUpdateNotifier,
} from "nano-update-notifier";

const pkg: Package = { name: "demo", version: "1.0.0" };
const settings: Settings = { pkg, updateCheckInterval: 1000 };
const alsoNotifier: UpstreamUpdateNotifier = updateNotifier(settings);
const notifyOptions: NotifyOptions = { defer: false };
alsoNotifier.notify(notifyOptions);

// The aliases must be the same types, not parallel look-alikes: assigning across the two
// spellings has to compile in both directions.
const backToOurs: Options = settings;
const backToUpstream: Settings = options;
const info: UpdateInfo | undefined = alsoNotifier.update;
void backToOurs;
void backToUpstream;
void info;
