---
name: authoring-vault-script-runner-scripts
description: Write, register, and ship a new script for the Vault Script Runner Obsidian plugin. Use when the user wants to add a script that the plugin can download and run from Obsidian — e.g. "add a script to the vault script runner", "make a plugin script that does X to my notes", "register a new catalog script", or any task that ends in a Python script invoked through this plugin's catalog.
---

# Authoring Vault Script Runner scripts

## What this plugin is

Vault Script Runner is a desktop-only Obsidian plugin that runs **local scripts**
with prompted parameters. The plugin is script-agnostic. Scripts are not bundled —
they are discovered from a **catalog JSON file hosted on GitHub**, downloaded on
demand into `<Vault>/.obsidian/plugins/vault-script-runner/scripts/`, version-tracked,
and run through a configurable **preset**.

The repository (`https://github.com/jlb-jlb/vault-script-runner`) holds:

- `catalog/catalog.json` — the catalog the plugin fetches.
- `catalog/<script>.py` — each script, served next to the catalog.

The plugin's default catalog URL is
`https://raw.githubusercontent.com/jlb-jlb/vault-script-runner/main/catalog/catalog.json`.

**To add a script you do two things: write the `.py` file and add a catalog entry.**
The user then opens *Settings → Vault Script Runner*, clicks **Download**, and runs
it via the command palette command **Run configured script**.

## Workflow checklist

1. Confirm the script's job and its single most-important input (this becomes the prompted parameter).
2. Write `catalog/<script_name>.py` following the conventions below.
3. Add an entry to `catalog/catalog.json` (`schemaVersion` stays `1`).
4. Test the script standalone from the command line on a real input.
5. Commit and push to the catalog repo so the plugin can fetch it.

## Script conventions

Match the style of the existing scripts in `catalog/`. Read
`catalog/pdf_to_obsidian_images.py` and `catalog/clean_gpt_research.py` as references.

- **Stdlib first.** Prefer the standard library. If you need a third-party package,
  declare it in the preset's `requirements` field (the plugin installs it into a venv).
- **`argparse` CLI.** Every input arrives as a CLI argument. Use a module docstring,
  long `--flags`, sensible defaults, and `raise SystemExit(main())`.
- **`--vault` is the anchor.** Take the vault root as `--vault`. Resolve every
  vault-relative path against it and **refuse to write outside the vault**. Copy the
  `resolve_inside_vault` helper from the reference scripts verbatim.
- **Fail loudly.** Print a clear message to `stderr` and `return 1` on bad input.
  Print what was written to `stdout` on success — that output is shown to the user.
- **UTF-8 everywhere.** Read and write files with `encoding="utf-8"`.
- **Windows-friendly.** The primary platform is Windows. Use `pathlib.Path`, never
  hardcode separators, and remember CLI paths may contain backslashes and spaces.
- **Idempotent / non-destructive by default.** Either write to a new file, or require
  an explicit `--in-place` / `--overwrite` flag before clobbering existing files.

## Catalog entry

Add an object to the `scripts` array in `catalog/catalog.json`. Bump only the
script's own `version` on changes; leave `schemaVersion: 1`.

```json
{
  "id": "kebab-case-id",
  "name": "Human readable name",
  "version": "0.1.0",
  "description": "One sentence shown in the settings list.",
  "fileName": "my_script.py",
  "path": "my_script.py",
  "preset": {
    "id": "kebab-case-id",
    "name": "Human readable name",
    "command": "{{venvPython}}",
    "arguments": "{{scriptPath}}\n--vault\n{{vault}}\n--in-place\n{{targetPath}}",
    "cwd": "{{vault}}",
    "parameters": [
      {
        "name": "targetPath",
        "label": "Target path",
        "placeholder": "Folder/Note.md",
        "defaultValue": "{{activeFile}}"
      }
    ],
    "env": "",
    "useVenv": true,
    "venvPath": "",
    "pythonExecutable": "",
    "requirements": "",
    "runInShell": false,
    "openOutput": true
  }
}
```

Field notes:

- `path` is resolved **relative to the catalog file**, so keep scripts in `catalog/`.
  Use `url` instead only for an absolute script URL.
- `sha256` is optional; omit it to avoid having to recompute it on every edit.
- **`arguments` is newline-separated.** Each line is one argv token — never put a flag
  and its value on the same line, and never quote paths (the plugin passes tokens
  directly, so spaces are safe). The script file itself is `{{scriptPath}}` as the
  first token.
- `useVenv: true` runs the script with the plugin's venv Python (`{{venvPython}}`).
  Set `requirements` to a pip spec (e.g. `"pymupdf"`) when you need packages; leave it
  `""` for stdlib-only scripts.
- `openOutput: true` opens the resulting note in Obsidian after a successful run.
- `runInShell: false` unless the command genuinely needs a shell.

## Template variables

The plugin substitutes these in `command`, `arguments`, `cwd`, and parameter
`defaultValue` / `placeholder`:

- `{{vault}}` — absolute vault path
- `{{pluginDir}}` — absolute plugin directory
- `{{scriptsDir}}` — downloaded scripts directory
- `{{scriptPath}}` — the downloaded script's path (use as argv[0] for catalog scripts)
- `{{downloads}}` — the user's Downloads folder
- `{{latestDownload}}` — newest file in Downloads
- `{{latestDownloadPdf}}` — newest `.pdf` in Downloads
- `{{activeFile}}` — active note path, relative to the vault
- `{{activeFolder}}` — active note's parent folder, relative to the vault
- `{{activeFolderPrefix}}` — active folder plus `/`, or empty at the vault root
- `{{venvPath}}` / `{{venvPython}}` — the script venv path / its Python executable

For any **parameter** (and the path-like built-ins), derived suffixes are available:
`{{name.basename}}`, `{{name.stem}}`, `{{name.dirname}}`, `{{name.ext}}`. Example:
`{{activeFolderPrefix}}{{pdfPath.stem}}.md` builds an output note name beside the
active note.

**Choosing the parameter default:** pick the variable that matches the script's
normal trigger. Operating on the open note → `{{activeFile}}`. Operating on a fresh
download → `{{latestDownload}}` or `{{latestDownloadPdf}}`.

## Testing before shipping

Run the script directly with the plugin's venv Python against a real input, writing
to a throwaway output (never the user's real note) to confirm behavior:

```powershell
& ".\.venv\Scripts\python.exe" ".\catalog\my_script.py" --vault "<vault>" --output "<temp>.md" "<input>"
```

Then validate the catalog still parses:

```powershell
python -c "import json; json.load(open('catalog/catalog.json'))"
```

## Shipping

Commit the new script and the catalog change, then push to the repo the plugin fetches
from (`origin`, branch `main`). The plugin picks the script up on the next catalog
**Refresh** in settings; an installed script with a lower version shows up under
**Updates**.

```
Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
```

Only commit/push when the user asks — otherwise leave the changes staged for them to review.
