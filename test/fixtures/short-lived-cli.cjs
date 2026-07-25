const updateNotifier = require("../../dist/index.cjs");

updateNotifier({
  pkg: { name: "nano-update-notifier-exit-probe", version: "0.0.1" },
  updateCheckInterval: 0,
});
