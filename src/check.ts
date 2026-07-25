import process from "node:process";
import { UpdateNotifier, type Options } from "./index.js";

export async function runCheck(notifier: UpdateNotifier): Promise<void> {
  try {
    const update = await notifier.fetchInfo();
    if (!notifier.config) return;

    notifier.config.set("lastUpdateCheck", Date.now());
    if (update.type && update.type !== "latest") {
      notifier.config.set("update", update);
    }
  } catch {
    // A failed background check leaves the old timestamp in place so the next run retries.
  }
}

export async function runDetachedCheck(serializedOptions = process.argv[2]): Promise<void> {
  const selfDestruct = setTimeout(() => process.exit(0), 30_000);
  try {
    const options = JSON.parse(serializedOptions ?? "{}") as Options;
    await runCheck(new UpdateNotifier(options));
  } catch {
    // This detached worker has no caller to report malformed options or cache failures to.
  } finally {
    clearTimeout(selfDestruct);
  }
  process.exit(0);
}
