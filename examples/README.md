# Playground

A place to run `nano-update-notifier` by hand and watch what it actually does.

Nothing here is published: `package.json` ships only `dist`, so this folder stays
out of the tarball.

## Run it

```sh
npm run build
node examples/try-it.mjs
```

`try-it.mjs` starts a throwaway npm registry on localhost, points a fake CLI at it,
and walks through the behaviour worth seeing:

1. **Cold cache** — first run prints no box and exits in under 100 ms. The check
   happens in a detached worker.
2. **Warm cache** — the next run renders the notification.
3. **CommonJS** — the same result through `require()`.
4. **Custom message** — `{packageName}`, `{currentVersion}`, `{latestVersion}`,
   `{updateCommand}`.
5. **Global install** — `npm i -g` wording.
6. **Opt-outs** — `--no-update-notifier`, `NO_UPDATE_NOTIFIER`, CI, npm scripts, and
   non-TTY output each stay silent.
7. **Dead registry** — no error, no hang, no change in exit code.

Everything writes to a temp `XDG_CONFIG_HOME` that is deleted at the end, so your
real update-check cache in `~/.config/configstore` is never touched.

## Poke at it yourself

Run the registry on its own and drive the demo CLI directly:

```sh
node examples/fake-registry.mjs
# in another terminal, with the port it printed:
npm_config_registry=http://127.0.0.1:PORT/ NODE_ENV=development node examples/demo-cli.mjs
```

The demo CLI reads a few environment variables:

| Variable | Default | Purpose |
| --- | --- | --- |
| `DEMO_PKG_NAME` | `demo-cli` | package name to check |
| `DEMO_PKG_VERSION` | `1.0.0` | version to compare against the registry |
| `DEMO_INTERVAL` | `0` | `updateCheckInterval` in ms |
| `DEMO_DIST_TAG` | `latest` | dist-tag to resolve |
| `DEMO_MESSAGE` | — | custom message template |
| `DEMO_GLOBAL` | — | `1` forces the global install wording |

Pass `--force-tty` when you redirect or pipe the output — notifications only render
on a TTY, which is the library behaving correctly, not a bug.

## Against a real package

To watch it hit the public registry, skip the fake one:

```sh
DEMO_PKG_NAME=npm DEMO_PKG_VERSION=1.0.0 NODE_ENV=development node examples/demo-cli.mjs --force-tty
```

Run it twice. The first run only fills the cache; the second shows the box. This
writes to your real config store under the name `update-notifier-npm`.
