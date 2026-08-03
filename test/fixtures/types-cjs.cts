import updateNotifier = require("nano-update-notifier");

const notifier = updateNotifier({ pkg: { name: "demo", version: "1.0.0" } });
notifier.notify({ defer: false });

// A CommonJS consumer reaches the types through the namespace, because the entry point is
// `export =`. `workbox-cli` does exactly this: `params.pkg as updateNotifier.Package`.
// Before this was declared, `dist/index.d.cts` exported the function and nothing else, so
// every named type was unreachable from `require`-mode resolution while the ESM entry had
// all of them.
const pkg: updateNotifier.Package = { name: "demo", version: "1.0.0" };
const options: updateNotifier.Options = { pkg, distTag: "next" };
const settings: updateNotifier.Settings = options;
const notifyOptions: updateNotifier.NotifyOptions = { defer: true };
const typed: updateNotifier.UpdateNotifier = updateNotifier(settings);
const update: updateNotifier.UpdateInfo | undefined = typed.update;
const alsoUpdate: updateNotifier.Update | undefined = update;
const info: updateNotifier.PackageInformation = pkg;

typed.notify(notifyOptions);
void alsoUpdate;
void info;
