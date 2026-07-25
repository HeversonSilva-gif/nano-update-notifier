import updateNotifier = require("nano-update-notifier");

const notifier = updateNotifier({ pkg: { name: "demo", version: "1.0.0" } });
notifier.notify({ defer: false });
