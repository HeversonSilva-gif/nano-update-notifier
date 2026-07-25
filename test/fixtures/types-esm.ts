import updateNotifier, { type Options, type UpdateNotifier } from "nano-update-notifier";

const options: Options = { pkg: { name: "demo", version: "1.0.0" } };
const notifier: UpdateNotifier = updateNotifier(options);
notifier.notify({ defer: false });
