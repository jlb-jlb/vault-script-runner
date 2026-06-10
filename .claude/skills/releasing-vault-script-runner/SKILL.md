---
name: releasing-vault-script-runner
description: Cut a new GitHub release of the Vault Script Runner Obsidian plugin. Use when the user wants to release, publish, ship, or tag a new plugin version — e.g. "make a release", "cut 0.0.8", "release the plugin", "bump the version and publish". Covers bumping manifest.json and creating the GitHub release with the plugin assets.
---

# Releasing Vault Script Runner

A release of this Obsidian plugin is a **GitHub release** whose tag equals the
plugin version and whose assets are the three files Obsidian loads: `main.js`,
`manifest.json`, and `styles.css`. The tag must be the bare version number (e.g.
`0.0.8`) with **no `v` prefix** — Obsidian matches the release tag against
`manifest.json`'s `version`.

## Preconditions

- On `main`, working tree clean, and all code changes already committed and pushed.
- `gh` is authenticated (`gh auth status`).
- Know the new version number and a one-line summary of what changed (the release notes).

## Steps

### 1. Bump the version in manifest.json and versions.json

Edit `manifest.json` and set `version` to the new release number. Keep
`minAppVersion` unless a newer Obsidian API is actually required.

```json
{ "id": "vault-script-runner", "version": "0.0.8", ... }
```

Add a matching entry to `versions.json` mapping the new version to the
`minAppVersion` it requires (Obsidian uses this so older apps install the last
compatible version):

```json
{ "0.0.8": "1.0.0" }
```

Commit and push the bump (the asset files must match the tag on `main`):

```
git commit -am "Bump version to 0.0.8" && git push origin main
```

End the commit message with:

```
Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
```

### 2. Create the GitHub release

Tag, title, and version must all match `manifest.json`. Attach exactly the three
plugin assets and target `main`:

```
gh release create 0.0.8 main.js manifest.json styles.css \
  --title "0.0.8" \
  --notes "One-line summary of what changed in this version." \
  --target main
```

(PowerShell uses a backtick `` ` `` for line continuation instead of `\`, or just
put it on one line.)

### 3. Verify

```
gh release view 0.0.8
```

Confirm the release lists all three assets and the tag matches the manifest version.

## Notes

- **Asset list is fixed:** always `main.js`, `manifest.json`, `styles.css`. These are
  what Obsidian downloads to update the plugin. Do not attach the catalog or scripts —
  those are served directly from `catalog/` on `main` and are not part of the release.
- **Tag == title == manifest version.** A mismatch breaks Obsidian's update detection.
- **Release notes** should be a short, user-facing description of the change, e.g.
  "Adds direct command palette entries for installed scripts."
- If a release with that tag already exists, either pick a new version or delete the
  old one first with `gh release delete <tag> --cleanup-tag` (only with the user's
  explicit go-ahead — this rewrites published history).
