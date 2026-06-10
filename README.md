# Vault Script Runner

Desktop-only Obsidian plugin for running configured local scripts with prompted parameters.

## Install

Copy this folder to:

```text
<Vault>/.obsidian/plugins/vault-script-runner
```

Then reload Obsidian and enable **Vault Script Runner** under Community plugins.

## Default PDF preset

The plugin includes a default script preset named **PDF to Obsidian images**. It calls:

```text
scripts/pdf_to_obsidian_images.py
```

and prompts for one parameter:

```text
pdfPath
```

That prompt defaults to:

```text
{{latestDownloadPdf}}
```

which resolves to the newest `.pdf` file in your Downloads folder.
If the PDF path field is left blank, the plugin uses that default before rendering output templates, so `{{pdfPath.stem}}` still resolves to the PDF file name.

The preset creates a subfolder under `_Attachments` for each PDF and puts the rendered page images there:

```text
_Attachments/{{pdfPath.stem}}/
```

Internally the script option is:

```text
--attachment-subdir {pdf_stem}
```

Use an empty `--attachment-subdir` value if you ever want the old flat `_Attachments` behavior.

The preset creates the Markdown note in the folder of the currently open note:

```text
{{activeFolderPrefix}}{{pdfPath.stem}}.md
```

Rendered page images default to JPG to keep storage use lower:

```text
--format jpg
```

Change that preset argument to `png` if you need lossless page images.

The PDF preset also extracts simple text from each PDF page and writes it into an HTML image `alt` attribute:

```html
<img src="_Attachments/pdf-name/page-image.jpg" alt="full extracted page text">
```

That keeps the extracted text hidden in Obsidian preview while still leaving it in the Markdown source for tools that read alt text. The preset uses HTML image tags because full-page text can contain brackets, parentheses, and punctuation that may break Markdown image syntax.

The PDF preset uses the shared plugin-managed Python virtual environment by default:

```text
{{pluginDir}}\.venv
```

On first run, the plugin creates the venv and installs the preset requirements:

```text
pymupdf
```

Later runs reuse the same venv. Other Python script presets can use the same venv by enabling **Use virtual environment** and setting their command to:

```text
{{venvPython}}
```

Each script tracks its own requirements marker, but installs packages into the shared venv. That lets different Python scripts share installed packages without each script repeatedly reinstalling another script's dependency list.

## Script Configuration

Open **Settings -> Vault Script Runner**.

Each script has:

- **Command**: executable to run, such as `python`, `powershell`, or an absolute path.
- **Arguments**: one argument per line. This avoids quoting problems with spaces in paths.
- **Working directory**: supports template variables.
- **Parameters**: comma-separated parameter names that will be prompted before execution.
- **Use virtual environment**: creates and reuses a Python venv before running the script.
- **Virtual environment path**: optional override. Leave blank to use the shared default venv.
- **Venv creator Python**: optional Python executable override used for `python -m venv`.
- **Requirements**: pip requirements installed into the venv when changed.
- **Environment**: optional `KEY=value` lines.

Template variables use `{{name}}` syntax.

Built-in variables:

- `{{vault}}`: absolute vault path.
- `{{pluginDir}}`: absolute plugin directory path.
- `{{downloads}}`: current user's Downloads folder.
- `{{latestDownload}}`: newest file in Downloads.
- `{{latestDownloadPdf}}`: newest `.pdf` file in Downloads.
- `{{sharedVenvPath}}`: absolute path to the shared Python virtual environment.
- `{{sharedVenvPython}}`: Python executable inside the shared virtual environment.
- `{{venvPath}}`: absolute virtual environment path for the script.
- `{{venvPython}}`: Python executable inside the script's virtual environment.
- `{{activeFile}}`: active file path relative to the vault.
- `{{activeFolder}}`: active file parent folder relative to the vault.
- `{{activeFolderPrefix}}`: active file parent folder plus `/`, or empty at vault root.
- `{{date}}`: current local date as `YYYY-MM-DD`.
- `{{time}}`: current local time as `HH-mm-ss`.

For path-like parameters, derived variables are available:

- `{{pdfPath.basename}}`
- `{{pdfPath.stem}}`
- `{{pdfPath.dirname}}`
- `{{pdfPath.ext}}`

The same derived suffixes work for any parameter name.

## Security

This plugin runs local commands with your user account permissions. Only configure scripts you trust.
