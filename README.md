# nano-update-notifier

Update notifications for Node.js CLI applications, with no runtime dependencies.

It implements the public API and observable behaviour of `update-notifier@7.3.1`,
so an existing call site keeps working once the import is changed.

## Install

```sh
npm install nano-update-notifier
```

Node.js 18 or newer is required. ESM and CommonJS entry points are both included,
along with TypeScript declarations for each.

## Usage

```js
import updateNotifier from 'nano-update-notifier';

updateNotifier({pkg: packageJson}).notify();
```

```js
const updateNotifier = require('nano-update-notifier');

updateNotifier({pkg: require('./package.json')}).notify();
```

Coming from `update-notifier`, only the import changes:

```diff
-import updateNotifier from 'update-notifier';
+import updateNotifier from 'nano-update-notifier';
```

## API

```js
const notifier = updateNotifier({
  pkg: {name: 'my-cli', version: '1.0.0'},
  updateCheckInterval: 86_400_000,
  shouldNotifyInNpmScript: false,
  distTag: 'latest',
});

notifier.notify({
  defer: true,
  message: 'Update {packageName} with {updateCommand}',
  isGlobal: false,
  boxenOptions: {padding: 1, borderStyle: 'round'},
});
```

`updateNotifier(options)` returns a notifier. `notifier.update` holds the cached
update, if any, as `{latest, current, type, name}`. `notify()` returns the notifier
so calls can be chained.

The deprecated `packageName` and `packageVersion` options are still accepted.

`notifier.config` exposes the ConfigStore operations consumers rely on: `get`,
`set`, `has`, `delete`, `clear`, `all`, `size`, and `path`.

## Behaviour

The version check runs in a detached process and never holds the host CLI open. A
successful check is cached and shown on the next run.

Notifications are suppressed outside a TTY, in CI, during tests, when
`NO_UPDATE_NOTIFIER` is present, and when `--no-update-notifier` is passed. npm and
Yarn scripts are suppressed unless `shouldNotifyInNpmScript` is enabled.

Network, registry, cache, and permission failures are swallowed. The only error
raised is `pkg.name and pkg.version required`, from the constructor.

Project, user, and global `.npmrc` files are honoured, including scoped registries,
registry environment overrides, bearer tokens, and basic authentication.

## Differences from `update-notifier`

- The cache starts cold after switching over rather than reading the existing
  ConfigStore file. This delays the first possible notification by one check
  interval; application output and exit behaviour are unchanged.
- A box wider than the terminal is not reflowed. `boxen` wraps the text to fit;
  here the box keeps its width and the terminal wraps it. The default notification
  is 43 columns wide, so this surfaces only in very narrow terminals or with a long
  custom `message`.

## Development

```sh
npm ci
npm run verify
```

`verify` builds the package, checks its types, runs every test, and enforces the
zero-dependency and size limits.

`npm run demo` starts a throwaway registry and walks a fake CLI through the cold
cache, the notification, every opt-out, and a dead registry. See
[`examples/`](examples/).

## License

MIT
