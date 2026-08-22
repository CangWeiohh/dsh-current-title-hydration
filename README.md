# dsh-current-title-hydration

A removable DSH Desktop compatibility plugin that keeps the **currently selected** session title from falling back to the workspace basename after a hard refresh.

## Problem

For a cold session, DSH's `session.list` intentionally reads title projections from a zero-I/O cache. When the cache omits a valid `title` projection, the client falls back to:

```text
session title → cwd basename → session ID
```

For a session in a directory named `DSH`, that fallback appears as `DSH`, even though the durable `session/title` event still contains the real title.

## Behavior

This plugin:

1. watches the client session list;
2. does nothing when the selected session already has a title projection;
3. when it does not, requests only that selected session's last durable `session/title` event through a local, loopback-only read endpoint;
4. applies the title to the existing projection store, using DSH's normal sequence ordering;
5. stores a small browser-local cache as a fast path for the next refresh.

It does **not** modify DSH core bundles, session logs, projection-cache files, recall snapshots, or workspace data. It does not hydrate every sidebar row.

## Installation

From the plugin directory:

```bash
APP="/Applications/DSH Desktop.app/Contents/Resources/app"
export DSH_HOME="$HOME/Library/Application Support/dsh-desktop/harness"
"$APP/node_modules/node/bin/node" \
  "$APP/node_modules/@deepseek-ai/dsh/lib/bin.js" \
  plugin --profile web add "$PWD"
```

Restart DSH Desktop after installation. The plugin can be removed with:

```bash
APP="/Applications/DSH Desktop.app/Contents/Resources/app"
export DSH_HOME="$HOME/Library/Application Support/dsh-desktop/harness"
"$APP/node_modules/node/bin/node" \
  "$APP/node_modules/@deepseek-ai/dsh/lib/bin.js" \
  plugin --profile web remove dsh-current-title-hydration
```

## Verification

1. Open a titled session and wait for the sidebar/header to display the expected title.
2. Hard-refresh the DSH Desktop web view.
3. The selected session should retain or quickly restore its durable title instead of displaying the cwd basename.

Run static and unit checks with:

```bash
npm run check
```

(Use the Node runtime packaged with DSH Desktop if a standalone Node/npm installation is unavailable.)
