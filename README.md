# Vault Script Runner

Desktop-only Obsidian plugin for running local scripts with prompted parameters.

The plugin itself is script-agnostic. Scripts are discovered from a catalog JSON file, downloaded on demand, version-tracked, and then run through configurable presets.

## Install

Copy this folder to:

```text
<Vault>/.obsidian/plugins/vault-script-runner
```

Reload Obsidian and enable **Vault Script Runner** under Community plugins.

## Catalog Workflow

Open **Settings -> Vault Script Runner**.

1. Set **Script catalog URL** if you do not want to use the default GitHub catalog.
2. Click **Download** next to any available script.
3. Run the generated preset from the command palette command **Run configured script**.

The catalog loads automatically when the settings tab opens. **Refresh** reloads it on demand.

Downloaded scripts are stored in:

```text
<Vault>/.obsidian/plugins/vault-script-runner/scripts/
```

The plugin tracks installed script versions in plugin data. If the catalog has a newer version than the installed script, the script appears under **Updates**. Scripts that are installed and current are not shown as downloadable.

## Catalog Format

The catalog is a JSON file:

```json
{
  "schemaVersion": 1,
  "scripts": [
    {
      "id": "pdf-to-obsidian-images",
      "name": "PDF to Obsidian images",
      "version": "1.3.3",
      "description": "Render a PDF into page images and a Markdown note.",
      "fileName": "pdf_to_obsidian_images.py",
      "path": "pdf_to_obsidian_images.py",
      "sha256": "optional hex sha256",
      "preset": {
        "id": "pdf-to-obsidian-images",
        "name": "PDF to Obsidian images",
        "command": "{{venvPython}}",
        "arguments": "{{scriptPath}}\n--vault\n{{vault}}\n...",
        "parameters": [
          {
            "name": "pdfPath",
            "label": "PDF path",
            "defaultValue": "{{latestDownloadPdf}}"
          }
        ],
        "useVenv": true,
        "requirements": "pymupdf"
      }
    }
  ]
}
```

`path` is resolved relative to the catalog file. `url` can be used instead for an absolute script URL.

## Template Variables

Common variables:

- `{{vault}}`: absolute vault path
- `{{pluginDir}}`: absolute plugin directory
- `{{scriptsDir}}`: downloaded scripts directory
- `{{scriptPath}}`: downloaded script path for catalog-installed presets
- `{{downloads}}`: current user's Downloads folder
- `{{latestDownload}}`: newest file in Downloads
- `{{latestDownloadPdf}}`: newest `.pdf` file in Downloads
- `{{activeFile}}`: active file path relative to the vault
- `{{activeFolder}}`: active file parent folder relative to the vault
- `{{activeFolderPrefix}}`: active file parent folder plus `/`, or empty at vault root
- `{{venvPath}}`: script virtual environment path
- `{{venvPython}}`: Python executable inside the script virtual environment

For path-like values, derived variables are available:

- `{{pdfPath.basename}}`
- `{{pdfPath.stem}}`
- `{{pdfPath.dirname}}`
- `{{pdfPath.ext}}`

The same suffixes work for any parameter name.

## Security and disclosures

This plugin is desktop-only and runs local scripts on your machine. Please read the following before using it.

### Code execution

The plugin launches local executables and scripts (for example Python) as child processes with your user account's permissions, using the commands and arguments you configure. Downloaded scripts and any command you configure can read, write, and delete files anywhere your user account can, including outside the vault. **Only use catalogs, scripts, and commands you trust.**

### Network use

The plugin connects to the network only to fetch the **script catalog** and to **download scripts** you explicitly choose to install:

- The catalog is downloaded from the **Script catalog URL** in settings. The default is the author's catalog on GitHub (`raw.githubusercontent.com/jlb-jlb/vault-script-runner`). You can change it to any URL you trust, or point it at a local file.
- When you click **Download**/**Update** for a catalog entry, the corresponding script file is fetched from the location named in the catalog and saved into the plugin's `scripts/` folder.

No other data is sent anywhere. The plugin contains no telemetry, analytics, or advertising, and it does not update itself.

### File access outside the vault

Beyond reading and writing inside your vault, the plugin:

- Reads your Downloads folder to resolve the `{{downloads}}` / `{{latestDownload}}` template variables (auto-detected, or set explicitly in settings).
- Creates and manages a Python virtual environment at the configured **Default virtual environment path** (by default inside the plugin folder).
- Runs scripts that may access any path you pass to them.

### Trust model

You are responsible for the scripts and commands you run. Review a script before downloading it, keep the catalog URL pointed at a source you trust, and remember that presets run with your full user permissions.
