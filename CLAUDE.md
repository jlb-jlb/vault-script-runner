# CLAUDE.md

Guidance for working in this repository.

## What this is

**Vault Script Runner** — a desktop-only Obsidian plugin that runs local scripts
with prompted parameters. The plugin is script-agnostic: scripts are discovered
from a catalog JSON hosted on GitHub, downloaded on demand, version-tracked, and
run through configurable presets. It is published in the Obsidian community
plugins directory (id `vault-script-runner`, repo `jlb-jlb/vault-script-runner`).

## Repository layout

- `main.js` — the entire plugin. **Hand-written plain JavaScript, no build step.**
  Edit it directly; there is no TypeScript/bundler. After editing, verify with
  `node --check main.js`.
- `manifest.json` — plugin metadata. `version` must match the GitHub release tag.
- `versions.json` — maps each plugin version to its `minAppVersion`.
- `styles.css` — all styling. Never hardcode inline styles in `main.js`; add a
  class here and use Obsidian CSS variables (e.g. `var(--text-muted)`).
- `catalog/catalog.json` — the script catalog the plugin fetches at runtime.
- `catalog/*.py` — the scripts served alongside the catalog.
- `README.md` — user docs and the required security/privacy disclosures.
- `LICENSE` — GPL-3.0.
- `data.json`, `.venv/`, `scripts/` — runtime/local only, git-ignored. `data.json`
  is per-machine plugin settings; `scripts/` is where downloaded scripts land.

## Architecture (main.js)

One file with: the `Plugin` subclass (settings load/save, catalog fetch/install,
template variable building, venv setup, process running), a `PluginSettingTab`,
a couple of `Modal`s (script picker, output), and module-level helpers near the
bottom. Catalog presets and locally-created presets both live in
`settings.scripts`; catalog install records live in `settings.installedScripts`.

Template variables (`{{vault}}`, `{{scriptPath}}`, `{{activeFile}}`, `{{venvPython}}`,
`{{downloads}}`, …) are documented in `README.md` and built in `buildVariables` /
`addVenvVariables`. Path-like variables also expose `.basename/.stem/.dirname/.ext`.

## Conventions (Obsidian plugin guidelines — keep these)

- Build DOM with `createEl`/`createDiv`/`createSpan`; **never** `innerHTML`/
  `outerHTML`/`insertAdjacentHTML`. Render untrusted text via the `text:` option.
- Use `this.app`, never the global `app`/`window.app`.
- Sentence case in UI labels ("Run in shell", not "Run In Shell").
- No `console.log`, no `var`, no default command hotkeys, no inline styles.
- `isDesktopOnly: true` — the plugin uses Node `fs`/`child_process`. These are
  intentional and disclosed in the README; keep those disclosures accurate.
- Cross-platform: use `path`, handle win32 vs posix (see `getVenvPythonPath`),
  forward slashes in default path templates, and the Python interpreter fallback
  (`python`/`py`/`python3`) in venv creation.

## Known constraint

`removeCommandById` ([main.js](main.js)) calls `this.app.commands.removeCommand`,
an undocumented API, to refresh per-script palette commands. There is no public
API for this. It is guarded; keep it guarded and do not reintroduce direct
`commands.commands[...]` manipulation.

## Releasing

Use the `releasing-vault-script-runner` skill. In short: bump `version` in
`manifest.json` and add a matching `versions.json` entry, commit and push to
`main`, then:

```
gh release create <version> main.js manifest.json styles.css \
  --title "<version>" --notes "..." --target main
```

Tag == title == manifest `version`, **no `v` prefix**. Assets are always exactly
`main.js`, `manifest.json`, `styles.css`. Obsidian installs from the release whose
tag matches the manifest version. End commit messages with the Co-Authored-By
trailer; only commit/push/release when the user asks.

## Adding a catalog script

Use the `authoring-vault-script-runner-scripts` skill. Write `catalog/<name>.py`
(stdlib-first, `argparse`, `--vault` anchored, refuses to write outside the vault),
add an entry to `catalog/catalog.json` with a `preset`, bump that script's own
`version`, and push to `main` (the plugin fetches the catalog live).
