import os from "node:os";
import upstream from "update-notifier";
import nano from "../../dist/index.js";

const pkg = { name: "config-path-probe", version: "1.0.0" };

console.log(
  JSON.stringify({
    homedir: os.homedir(),
    upstream: upstream({ pkg }).config?.path ?? null,
    nano: nano({ pkg }).config?.path ?? null,
  }),
);
