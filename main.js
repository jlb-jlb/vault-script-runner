const { Modal, Notice, Plugin, PluginSettingTab, Setting } = require("obsidian");
const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const PDF_SCRIPT_ID = "pdf-to-obsidian-images";

const DEFAULT_SETTINGS = {
  pythonExecutable: "python",
  defaultVenvPath: "{{pluginDir}}\\.venv",
  scripts: [
    {
      id: PDF_SCRIPT_ID,
      name: "PDF to Obsidian images",
      command: "{{venvPython}}",
      arguments: [
        "{{pluginDir}}\\scripts\\pdf_to_obsidian_images.py",
        "--vault",
        "{{vault}}",
        "--attachments",
        "_Attachments",
        "--attachment-subdir",
        "{pdf_stem}",
        "--output",
        "{{activeFolderPrefix}}{{pdfPath.stem}}.md",
        "--title",
        "{{pdfPath.stem}}",
        "--backend",
        "auto",
        "--link-style",
        "html",
        "--alt-text",
        "extracted",
        "--text-output",
        "none",
        "--format",
        "jpg",
        "{{pdfPath}}",
      ].join("\n"),
      cwd: "{{vault}}",
      parameters: [
        {
          name: "pdfPath",
          label: "PDF path",
          placeholder: "C:\\Users\\you\\Downloads\\lecture.pdf",
          defaultValue: "{{latestDownloadPdf}}",
        },
      ],
      env: "",
      useVenv: true,
      venvPath: "",
      pythonExecutable: "",
      requirements: "pymupdf",
      runInShell: false,
      openOutput: true,
    },
  ],
};

module.exports = class VaultScriptRunnerPlugin extends Plugin {
  async onload() {
    await this.loadSettings();

    this.addRibbonIcon("terminal", "Run script", () => {
      this.openScriptPicker();
    });

    this.addCommand({
      id: "run-configured-script",
      name: "Run configured script",
      callback: () => this.openScriptPicker(),
    });

    this.addCommand({
      id: "run-pdf-to-obsidian-images",
      name: "Run PDF to Obsidian images",
      callback: () => this.runScriptById(PDF_SCRIPT_ID),
    });

    this.addSettingTab(new VaultScriptRunnerSettingTab(this.app, this));
  }

  async loadSettings() {
    const loaded = await this.loadData();
    this.settings = mergeSettings(DEFAULT_SETTINGS, loaded);
    if (JSON.stringify(loaded || {}) !== JSON.stringify(this.settings)) {
      await this.saveSettings();
    }
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  openScriptPicker() {
    const scripts = this.getScripts();
    if (scripts.length === 0) {
      new Notice("Vault Script Runner: no scripts configured.");
      return;
    }

    if (scripts.length === 1) {
      this.openRunModal(scripts[0]);
      return;
    }

    new ScriptPickerModal(this.app, this, scripts).open();
  }

  runScriptById(id) {
    const script = this.getScripts().find((item) => item.id === id);
    if (!script) {
      new Notice(`Vault Script Runner: script not found: ${id}`);
      return;
    }
    this.openRunModal(script);
  }

  openRunModal(script) {
    new ScriptRunModal(this.app, this, script).open();
  }

  getScripts() {
    if (!Array.isArray(this.settings.scripts)) {
      return [];
    }
    return this.settings.scripts.filter((script) => script && script.name && script.command);
  }

  getVaultBasePath() {
    const adapter = this.app.vault.adapter;
    if (adapter && typeof adapter.getBasePath === "function") {
      return adapter.getBasePath();
    }
    if (adapter && typeof adapter.basePath === "string") {
      return adapter.basePath;
    }
    return "";
  }

  getPluginDir() {
    const vaultPath = this.getVaultBasePath();
    if (!vaultPath) {
      return "";
    }
    return path.join(vaultPath, ".obsidian", "plugins", this.manifest.id);
  }

  buildVariables(parameterValues) {
    const vaultPath = this.getVaultBasePath();
    const pluginDir = this.getPluginDir();
    const activeFile = this.app.workspace.getActiveFile();
    const activeFilePath = activeFile ? activeFile.path : "";
    const activeFolder = normalizeObsidianFolder(activeFile && activeFile.parent ? activeFile.parent.path : "");
    const activeFolderPrefix = activeFolder ? `${activeFolder}/` : "";
    const now = new Date();
    const downloadsPath = path.join(os.homedir(), "Downloads");
    const latestDownload = findLatestFile(downloadsPath);
    const latestDownloadPdf = findLatestFile(downloadsPath, ".pdf");
    const variables = {
      vault: vaultPath,
      pluginDir,
      downloads: downloadsPath,
      latestDownload,
      latestDownloadPdf,
      activeFile: activeFilePath,
      activeFolder,
      activeFolderPrefix,
      date: formatDate(now),
      time: formatTime(now),
    };

    addPathVariables(variables, "activeFile", activeFilePath);
    addPathVariables(variables, "downloads", downloadsPath);
    addPathVariables(variables, "latestDownload", latestDownload);
    addPathVariables(variables, "latestDownloadPdf", latestDownloadPdf);
    addPathVariables(variables, "activeFolder", activeFolder);

    for (const [key, value] of Object.entries(parameterValues)) {
      variables[key] = value;
      addPathVariables(variables, key, value);
    }

    return variables;
  }

  addVenvVariables(script, variables) {
    const vaultPath = variables.vault || this.getVaultBasePath();
    const sharedTemplate = this.settings.defaultVenvPath || "{{pluginDir}}\\.venv";
    let sharedVenvPath = stripWrappingQuotes(this.renderTemplate(sharedTemplate, variables).trim());
    if (sharedVenvPath && !path.isAbsolute(sharedVenvPath)) {
      sharedVenvPath = path.join(vaultPath, sharedVenvPath);
    }
    variables.sharedVenvPath = sharedVenvPath;
    variables.sharedVenvPython = sharedVenvPath ? getVenvPythonPath(sharedVenvPath) : "";
    addPathVariables(variables, "sharedVenvPath", sharedVenvPath);
    addPathVariables(variables, "sharedVenvPython", variables.sharedVenvPython);

    const venvTemplate = script.venvPath || "{{sharedVenvPath}}";
    let venvPath = stripWrappingQuotes(this.renderTemplate(venvTemplate, variables).trim());
    if (venvPath && !path.isAbsolute(venvPath)) {
      venvPath = path.join(vaultPath, venvPath);
    }

    variables.venvPath = venvPath;
    variables.venvPython = venvPath ? getVenvPythonPath(venvPath) : "";
    addPathVariables(variables, "venvPath", venvPath);
    addPathVariables(variables, "venvPython", variables.venvPython);

    return {
      venvPath,
      venvPython: variables.venvPython,
    };
  }

  renderTemplate(value, variables) {
    return String(value || "").replace(/\{\{\s*([A-Za-z0-9_.-]+)\s*\}\}/g, (_match, key) => {
      if (Object.prototype.hasOwnProperty.call(variables, key)) {
        return variables[key] == null ? "" : String(variables[key]);
      }
      return "";
    });
  }

  async ensureVenv(script, variables, cwd, env, setupLogs) {
    if (!script.useVenv) {
      return;
    }

    const { venvPath, venvPython } = this.addVenvVariables(script, variables);
    if (!venvPath || !venvPython) {
      throw new Error("Virtual environment path is empty.");
    }

    if (!fs.existsSync(venvPython)) {
      const creatorTemplate = script.pythonExecutable || this.settings.pythonExecutable || "python";
      const creator = stripWrappingQuotes(this.renderTemplate(creatorTemplate, variables).trim());
      if (!creator) {
        throw new Error("Python executable for venv creation is empty.");
      }

      fs.mkdirSync(path.dirname(venvPath), { recursive: true });
      new Notice(`Creating virtual environment for ${script.name}`);
      const createResult = await runProcess(creator, ["-m", "venv", venvPath], {
        cwd,
        env,
        shell: false,
      });
      setupLogs.push({ label: "create virtual environment", result: createResult });

      if (createResult.code !== 0 || !fs.existsSync(venvPython)) {
        throw new Error(
          `Could not create virtual environment at ${venvPath}.\n${createResult.stderr || createResult.stdout}`
        );
      }
    }

    const requirements = normalizeRequirementText(script.requirements);
    if (!requirements) {
      return;
    }

    const requirementsKey = slugify(script.id || script.name || "script");
    const markerPath = path.join(venvPath, `.vault-script-runner-requirements.${requirementsKey}.txt`);
    const requirementsPath = path.join(venvPath, `.vault-script-runner-requirements.${requirementsKey}.in`);
    const previousRequirements = readTextIfExists(markerPath);
    if (previousRequirements === requirements) {
      return;
    }

    fs.writeFileSync(requirementsPath, `${requirements}\n`, "utf8");
    new Notice(`Installing requirements for ${script.name}`);
    const installResult = await runProcess(venvPython, ["-m", "pip", "install", "-r", requirementsPath], {
      cwd,
      env,
      shell: false,
    });
    setupLogs.push({ label: "install requirements", result: installResult });

    if (installResult.code !== 0) {
      throw new Error(`Could not install requirements.\n${installResult.stderr || installResult.stdout}`);
    }

    fs.writeFileSync(markerPath, requirements, "utf8");
  }

  async runScript(script, parameterValues) {
    const variables = this.buildVariables(parameterValues);
    this.addVenvVariables(script, variables);

    const cwd = stripWrappingQuotes(this.renderTemplate(script.cwd || "{{vault}}", variables).trim());
    const env = {
      ...process.env,
      ...parseEnvironment(script.env, (value) => this.renderTemplate(value, variables)),
    };
    const setupLogs = [];

    try {
      await this.ensureVenv(script, variables, cwd || undefined, env, setupLogs);
    } catch (error) {
      new Notice(`Script setup failed: ${script.name}`, 10000);
      new ScriptOutputModal(this.app, {
        script,
        command: "setup",
        args: [],
        cwd,
        startedAt: new Date(),
        finishedAt: new Date(),
        code: null,
        signal: null,
        stdout: "",
        stderr: error.stack || error.message,
        setupLogs,
      }).open();
      return;
    }

    const command = stripWrappingQuotes(this.renderTemplate(script.command, variables).trim());
    const args = parseArgumentLines(script.arguments).map((arg) => this.renderTemplate(arg, variables));

    if (!command) {
      new Notice("Vault Script Runner: command is empty.");
      return;
    }

    new Notice(`Running script: ${script.name}`);
    const result = await runProcess(command, args, {
      cwd: cwd || undefined,
      env,
      shell: Boolean(script.runInShell),
    });

    result.script = script;
    result.command = command;
    result.args = args;
    result.cwd = cwd;
    result.setupLogs = setupLogs;

    if (result.code === 0) {
      new Notice(`Script finished: ${script.name}`);
    } else {
      new Notice(`Script failed (${result.code ?? result.signal ?? "unknown"}): ${script.name}`, 10000);
    }

    if (script.openOutput !== false || result.code !== 0 || setupLogs.length > 0) {
      new ScriptOutputModal(this.app, result).open();
    }
  }
};

class ScriptPickerModal extends Modal {
  constructor(app, plugin, scripts) {
    super(app);
    this.plugin = plugin;
    this.scripts = scripts;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: "Run script" });

    const list = contentEl.createDiv({ cls: "vault-script-runner-picker" });
    for (const script of this.scripts) {
      const button = list.createEl("button", { text: script.name });
      button.addEventListener("click", () => {
        this.close();
        this.plugin.openRunModal(script);
      });
    }
  }

  onClose() {
    this.contentEl.empty();
  }
}

class ScriptRunModal extends Modal {
  constructor(app, plugin, script) {
    super(app);
    this.plugin = plugin;
    this.script = script;
    this.inputs = new Map();
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: this.script.name });

    const parameters = normalizeParameters(this.script.parameters);
    const defaultVariables = this.plugin.buildVariables({});
    if (parameters.length === 0) {
      contentEl.createEl("p", {
        text: "This script has no parameters.",
        cls: "vault-script-runner-help",
      });
    }

    for (const parameter of parameters) {
      const field = contentEl.createDiv({ cls: "vault-script-runner-field" });
      field.createEl("label", { text: parameter.label || parameter.name });
      const input = field.createEl("input", {
        type: parameter.secret ? "password" : "text",
        placeholder: parameter.placeholder || "",
        value: this.plugin.renderTemplate(parameter.defaultValue || "", defaultVariables),
      });
      this.inputs.set(parameter.name, input);
    }

    const actions = contentEl.createDiv({ cls: "vault-script-runner-actions" });
    const cancel = actions.createEl("button", { text: "Cancel" });
    cancel.addEventListener("click", () => this.close());

    const run = actions.createEl("button", { text: "Run" });
    run.addClass("mod-cta");
    run.addEventListener("click", () => this.submit());

    this.scope.register([], "Enter", (event) => {
      if (event.ctrlKey || event.metaKey) {
        this.submit();
        return false;
      }
      return true;
    });

    const firstInput = this.inputs.values().next().value;
    if (firstInput) {
      firstInput.focus();
    } else {
      run.focus();
    }
  }

  submit() {
    const values = {};
    const parameters = normalizeParameters(this.script.parameters);
    const defaultVariables = this.plugin.buildVariables({});
    for (const parameter of parameters) {
      const input = this.inputs.get(parameter.name);
      const rawValue = input ? input.value.trim() : "";
      const fallback = this.plugin.renderTemplate(parameter.defaultValue || "", defaultVariables).trim();
      values[parameter.name] = stripWrappingQuotes(rawValue || fallback);
    }
    this.close();
    this.plugin.runScript(this.script, values);
  }

  onClose() {
    this.contentEl.empty();
  }
}

class ScriptOutputModal extends Modal {
  constructor(app, result) {
    super(app);
    this.result = result;
  }

  onOpen() {
    const { contentEl } = this;
    const result = this.result;
    contentEl.empty();
    contentEl.createEl("h2", { text: result.code === 0 ? "Script finished" : "Script output" });

    const durationMs = result.finishedAt.getTime() - result.startedAt.getTime();
    contentEl.createEl("div", {
      cls: "vault-script-runner-output-meta",
      text: [
        `Script: ${result.script.name}`,
        `Exit: ${result.code === null ? result.signal || "unknown" : result.code}`,
        `Duration: ${(durationMs / 1000).toFixed(1)}s`,
        `Working directory: ${result.cwd || "(default)"}`,
        `Command: ${formatCommandLine(result.command, result.args)}`,
      ].join("\n"),
    });

    if (Array.isArray(result.setupLogs) && result.setupLogs.length > 0) {
      contentEl.createEl("h3", { text: "setup" });
      for (const entry of result.setupLogs) {
        contentEl.createEl("pre", {
          cls: "vault-script-runner-output",
          text: formatSetupLog(entry),
        });
      }
    }

    contentEl.createEl("h3", { text: "stdout" });
    contentEl.createEl("pre", {
      cls: "vault-script-runner-output",
      text: result.stdout || "(empty)",
    });

    contentEl.createEl("h3", { text: "stderr" });
    contentEl.createEl("pre", {
      cls: "vault-script-runner-output",
      text: result.stderr || "(empty)",
    });
  }

  onClose() {
    this.contentEl.empty();
  }
}

class VaultScriptRunnerSettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "Vault Script Runner" });
    containerEl.createEl("p", {
      cls: "vault-script-runner-help",
      text: "Configure local scripts. Arguments are one per line and support {{variable}} templates.",
    });

    new Setting(containerEl)
      .setName("Python executable")
      .setDesc("Used to create virtual environments. Script presets can override this.")
      .addText((text) => {
        text.setPlaceholder("python").setValue(this.plugin.settings.pythonExecutable || "").onChange(async (value) => {
          this.plugin.settings.pythonExecutable = value;
          await this.plugin.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName("Default virtual environment path")
      .setDesc("Relative paths resolve from the vault. Templates are supported.")
      .addText((text) => {
        text
          .setPlaceholder("{{pluginDir}}\\.venv")
          .setValue(this.plugin.settings.defaultVenvPath || "")
          .onChange(async (value) => {
            this.plugin.settings.defaultVenvPath = value;
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName("Add script")
      .setDesc("Create a new blank script preset.")
      .addButton((button) => {
        button.setButtonText("Add").onClick(async () => {
          this.plugin.settings.scripts.push(createBlankScript());
          await this.plugin.saveSettings();
          this.display();
        });
      });

    new Setting(containerEl)
      .setName("Add Python script")
      .setDesc("Create a Python preset that uses the shared virtual environment.")
      .addButton((button) => {
        button.setButtonText("Add").onClick(async () => {
          this.plugin.settings.scripts.push(createPythonScript());
          await this.plugin.saveSettings();
          this.display();
        });
      });

    this.plugin.settings.scripts.forEach((script, index) => {
      this.renderScript(containerEl, script, index);
    });
  }

  renderScript(containerEl, script, index) {
    const wrapper = containerEl.createDiv({ cls: "vault-script-runner-script" });
    wrapper.createEl("h3", { text: script.name || `Script ${index + 1}` });

    new Setting(wrapper)
      .setName("Name")
      .addText((text) => {
        text.setValue(script.name || "").onChange(async (value) => {
          script.name = value;
          script.id = script.id || slugify(value || `script-${index + 1}`);
          await this.plugin.saveSettings();
        });
      });

    new Setting(wrapper)
      .setName("Command")
      .setDesc("Executable name or absolute executable path. Use {{venvPython}} for Python scripts with venv enabled.")
      .addText((text) => {
        text.setPlaceholder("{{venvPython}}").setValue(script.command || "").onChange(async (value) => {
          script.command = value;
          await this.plugin.saveSettings();
        });
      });

    new Setting(wrapper)
      .setName("Working directory")
      .setDesc("Optional. Defaults to {{vault}}.")
      .addText((text) => {
        text.setPlaceholder("{{vault}}").setValue(script.cwd || "").onChange(async (value) => {
          script.cwd = value;
          await this.plugin.saveSettings();
        });
      });

    new Setting(wrapper)
      .setName("Arguments")
      .setDesc("One argument per line. Blank lines and # comments are ignored.")
      .addTextArea((text) => {
        text.inputEl.rows = 10;
        text.inputEl.cols = 60;
        text.setValue(script.arguments || "").onChange(async (value) => {
          script.arguments = value;
          await this.plugin.saveSettings();
        });
      });

    new Setting(wrapper)
      .setName("Parameters")
      .setDesc("Comma-separated names to prompt for, for example: pdfPath, noteName")
      .addText((text) => {
        text
          .setPlaceholder("pdfPath")
          .setValue(normalizeParameters(script.parameters).map((parameter) => parameter.name).join(", "))
          .onChange(async (value) => {
            script.parameters = parseParameterNames(value).map((name) => {
              const existing = normalizeParameters(script.parameters).find((parameter) => parameter.name === name);
              return existing || {
                name,
                label: humanize(name),
                placeholder: "",
                defaultValue: "",
              };
            });
            await this.plugin.saveSettings();
          });
      });

    new Setting(wrapper)
      .setName("Use virtual environment")
      .setDesc("Create the venv if missing, install requirements when they change, and expose {{venvPython}}.")
      .addToggle((toggle) => {
        toggle.setValue(Boolean(script.useVenv)).onChange(async (value) => {
          script.useVenv = value;
          await this.plugin.saveSettings();
        });
      });

    new Setting(wrapper)
      .setName("Virtual environment path")
      .setDesc("Optional. Relative paths resolve from the vault. Defaults to the global venv path.")
      .addText((text) => {
        text.setPlaceholder("{{pluginDir}}\\.venv").setValue(script.venvPath || "").onChange(async (value) => {
          script.venvPath = value;
          await this.plugin.saveSettings();
        });
      });

    new Setting(wrapper)
      .setName("Venv creator Python")
      .setDesc("Optional override for creating this script's venv.")
      .addText((text) => {
        text.setPlaceholder("python").setValue(script.pythonExecutable || "").onChange(async (value) => {
          script.pythonExecutable = value;
          await this.plugin.saveSettings();
        });
      });

    new Setting(wrapper)
      .setName("Requirements")
      .setDesc("Optional pip requirements. Written to a temporary requirements file and installed into the venv.")
      .addTextArea((text) => {
        text.inputEl.rows = 5;
        text.inputEl.cols = 60;
        text.setValue(script.requirements || "").onChange(async (value) => {
          script.requirements = value;
          await this.plugin.saveSettings();
        });
      });

    new Setting(wrapper)
      .setName("Environment")
      .setDesc("Optional KEY=value lines. Templates are supported.")
      .addTextArea((text) => {
        text.inputEl.rows = 4;
        text.inputEl.cols = 60;
        text.setValue(script.env || "").onChange(async (value) => {
          script.env = value;
          await this.plugin.saveSettings();
        });
      });

    new Setting(wrapper)
      .setName("Run in shell")
      .setDesc("Enable for shell built-ins or command strings. Leave off for normal executables.")
      .addToggle((toggle) => {
        toggle.setValue(Boolean(script.runInShell)).onChange(async (value) => {
          script.runInShell = value;
          await this.plugin.saveSettings();
        });
      });

    new Setting(wrapper)
      .setName("Open output")
      .setDesc("Open stdout/stderr when the script finishes. Failures and first-time setup always open output.")
      .addToggle((toggle) => {
        toggle.setValue(script.openOutput !== false).onChange(async (value) => {
          script.openOutput = value;
          await this.plugin.saveSettings();
        });
      });

    new Setting(wrapper)
      .setName("Remove")
      .setDesc("Delete this script preset.")
      .addButton((button) => {
        button.setWarning().setButtonText("Remove").onClick(async () => {
          this.plugin.settings.scripts.splice(index, 1);
          await this.plugin.saveSettings();
          this.display();
        });
      });
  }
}

function mergeSettings(defaults, loaded) {
  const copy = JSON.parse(JSON.stringify(defaults));
  if (!loaded || typeof loaded !== "object") {
    return copy;
  }

  const loadedScripts = Array.isArray(loaded.scripts) ? loaded.scripts : copy.scripts;
  return {
    ...copy,
    ...loaded,
    pythonExecutable: loaded.pythonExecutable || copy.pythonExecutable,
    defaultVenvPath: loaded.defaultVenvPath || copy.defaultVenvPath,
    scripts: loadedScripts.map((script) => normalizeScript(script)),
  };
}

function normalizeScript(script) {
  const normalized = {
    id: script.id || slugify(script.name || `script-${Date.now()}`),
    name: script.name || "Script",
    command: script.command || "",
    arguments: script.arguments || "",
    cwd: script.cwd || "{{vault}}",
    parameters: normalizeParameters(script.parameters),
    env: script.env || "",
    useVenv: Boolean(script.useVenv),
    venvPath: script.venvPath || "",
    pythonExecutable: script.pythonExecutable || "",
    requirements: script.requirements || "",
    runInShell: Boolean(script.runInShell),
    openOutput: script.openOutput !== false,
  };

  if (normalized.id === PDF_SCRIPT_ID) {
    if (script.useVenv === undefined) {
      normalized.useVenv = true;
    }
    if (!script.requirements) {
      normalized.requirements = "pymupdf";
    }
    if (!script.command || script.command === "python") {
      normalized.command = "{{venvPython}}";
      normalized.runInShell = false;
    }
    normalized.arguments = migratePdfOutputArgument(normalized.arguments);
    normalized.arguments = setPdfArgument(normalized.arguments, "--link-style", "html");
    normalized.arguments = setPdfArgument(normalized.arguments, "--alt-text", "extracted");
    normalized.arguments = setPdfArgument(normalized.arguments, "--text-output", "none");
    normalized.arguments = ensurePdfArgument(normalized.arguments, "--format", "jpg");
    normalized.arguments = ensurePdfArgument(normalized.arguments, "--attachment-subdir", "{pdf_stem}");
    ensureParameterDefault(
      normalized.parameters,
      "pdfPath",
      "PDF path",
      "C:\\Users\\you\\Downloads\\lecture.pdf",
      "{{latestDownloadPdf}}"
    );
  }

  if (normalized.useVenv && isGenericPythonCommand(normalized.command)) {
    normalized.command = "{{venvPython}}";
    normalized.runInShell = false;
  }

  return normalized;
}

function createBlankScript() {
  return {
    id: `script-${Date.now()}`,
    name: "New script",
    command: "",
    arguments: "",
    cwd: "{{vault}}",
    parameters: [],
    env: "",
    useVenv: false,
    venvPath: "",
    pythonExecutable: "",
    requirements: "",
    runInShell: false,
    openOutput: true,
  };
}

function createPythonScript() {
  return {
    id: `python-script-${Date.now()}`,
    name: "New Python script",
    command: "{{venvPython}}",
    arguments: "",
    cwd: "{{vault}}",
    parameters: [],
    env: "",
    useVenv: true,
    venvPath: "",
    pythonExecutable: "",
    requirements: "",
    runInShell: false,
    openOutput: true,
  };
}

function normalizeParameters(parameters) {
  if (!Array.isArray(parameters)) {
    return [];
  }
  return parameters
    .map((parameter) => {
      if (typeof parameter === "string") {
        return {
          name: parameter,
          label: humanize(parameter),
          placeholder: "",
          defaultValue: "",
        };
      }
      return parameter;
    })
    .filter((parameter) => parameter && parameter.name);
}

function ensureParameterDefault(parameters, name, label, placeholder, defaultValue) {
  let parameter = parameters.find((item) => item.name === name);
  if (!parameter) {
    parameter = {
      name,
      label,
      placeholder,
      defaultValue,
    };
    parameters.push(parameter);
    return;
  }
  parameter.label = parameter.label || label;
  parameter.placeholder = parameter.placeholder || placeholder;
  if (!parameter.defaultValue) {
    parameter.defaultValue = defaultValue;
  }
}

function parseParameterNames(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseArgumentLines(value) {
  return String(value || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
}

function parseEnvironment(value, renderTemplate) {
  const env = {};
  for (const line of String(value || "").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const equalsIndex = trimmed.indexOf("=");
    if (equalsIndex < 1) {
      continue;
    }
    const key = trimmed.slice(0, equalsIndex).trim();
    const envValue = trimmed.slice(equalsIndex + 1);
    env[key] = renderTemplate(envValue);
  }
  return env;
}

function normalizeRequirementText(value) {
  return String(value || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .join("\n");
}

function migratePdfOutputArgument(argumentsText) {
  const lines = String(argumentsText || "").split(/\r?\n/);
  for (let index = 0; index < lines.length - 1; index += 1) {
    if (lines[index].trim() !== "--output") {
      continue;
    }

    const current = lines[index + 1].trim();
    const legacyOutputs = new Set([
      "Courses\\Robot Learning\\Lectures\\{{pdfPath.stem}}.md",
      "Courses/Robot Learning/Lectures/{{pdfPath.stem}}.md",
    ]);
    if (!current || legacyOutputs.has(current)) {
      lines[index + 1] = "{{activeFolderPrefix}}{{pdfPath.stem}}.md";
    }
    break;
  }
  return lines.join("\n");
}

function ensurePdfArgument(argumentsText, flag, value) {
  const lines = String(argumentsText || "").split(/\r?\n/);
  if (lines.some((line) => line.trim() === flag)) {
    return lines.join("\n");
  }

  let insertIndex = lines.length;
  for (let index = 0; index < lines.length; index += 1) {
    if (lines[index].includes("{{pdfPath}}")) {
      insertIndex = index;
      break;
    }
  }

  lines.splice(insertIndex, 0, flag, value);
  return lines.join("\n");
}

function setPdfArgument(argumentsText, flag, value) {
  const lines = String(argumentsText || "").split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    if (lines[index].trim() !== flag) {
      continue;
    }
    if (index === lines.length - 1) {
      lines.push(value);
    } else {
      lines[index + 1] = value;
    }
    return lines.join("\n");
  }
  return ensurePdfArgument(lines.join("\n"), flag, value);
}

function isGenericPythonCommand(value) {
  const command = stripWrappingQuotes(String(value || "").trim()).toLowerCase();
  return command === "python" || command === "python.exe" || command === "py";
}

function addPathVariables(variables, prefix, rawValue) {
  const value = String(rawValue || "");
  if (!value) {
    return;
  }
  variables[`${prefix}.basename`] = path.basename(value);
  variables[`${prefix}.stem`] = path.basename(value, path.extname(value));
  variables[`${prefix}.dirname`] = path.dirname(value);
  variables[`${prefix}.ext`] = path.extname(value);
}

function findLatestFile(directory, extension) {
  try {
    const normalizedExtension = extension ? extension.toLowerCase() : "";
    const files = fs
      .readdirSync(directory, { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => path.join(directory, entry.name))
      .filter((filePath) => !normalizedExtension || path.extname(filePath).toLowerCase() === normalizedExtension);

    let latestPath = "";
    let latestTime = -1;
    for (const filePath of files) {
      const stat = fs.statSync(filePath);
      if (stat.mtimeMs > latestTime) {
        latestTime = stat.mtimeMs;
        latestPath = filePath;
      }
    }
    return latestPath;
  } catch (_error) {
    return "";
  }
}

function normalizeObsidianFolder(value) {
  const normalized = String(value || "").replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  if (normalized === "." || normalized === "/") {
    return "";
  }
  return normalized;
}

function getVenvPythonPath(venvPath) {
  if (process.platform === "win32") {
    return path.join(venvPath, "Scripts", "python.exe");
  }
  return path.join(venvPath, "bin", "python");
}

function runProcess(command, args, options) {
  return new Promise((resolve) => {
    const startedAt = new Date();
    let stdout = "";
    let stderr = "";
    const outputLimit = 300000;
    let child;
    let finished = false;

    const finish = (result) => {
      if (finished) {
        return;
      }
      finished = true;
      resolve({
        command,
        args,
        cwd: options.cwd || "",
        startedAt,
        finishedAt: new Date(),
        code: result.code,
        signal: result.signal || null,
        stdout,
        stderr,
        error: result.error || null,
      });
    };

    try {
      child = spawn(command, args, {
        cwd: options.cwd || undefined,
        env: options.env || process.env,
        shell: Boolean(options.shell),
        windowsHide: true,
      });
    } catch (error) {
      stderr = appendLimited(stderr, `${error.stack || error.message}\n`, outputLimit);
      finish({ code: null, signal: null, error });
      return;
    }

    child.stdout.on("data", (chunk) => {
      stdout = appendLimited(stdout, chunk.toString(), outputLimit);
    });

    child.stderr.on("data", (chunk) => {
      stderr = appendLimited(stderr, chunk.toString(), outputLimit);
    });

    child.on("error", (error) => {
      stderr = appendLimited(stderr, `${error.stack || error.message}\n`, outputLimit);
      finish({ code: null, signal: null, error });
    });

    child.on("close", (code, signal) => {
      finish({ code, signal });
    });
  });
}

function appendLimited(existing, addition, limit) {
  const combined = existing + addition;
  if (combined.length <= limit) {
    return combined;
  }
  return combined.slice(combined.length - limit);
}

function stripWrappingQuotes(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function readTextIfExists(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch (_error) {
    return null;
  }
}

function formatSetupLog(entry) {
  const result = entry.result;
  return [
    `$ ${formatCommandLine(result.command, result.args)}`,
    `exit: ${result.code === null ? result.signal || "unknown" : result.code}`,
    "",
    "stdout:",
    result.stdout || "(empty)",
    "",
    "stderr:",
    result.stderr || "(empty)",
  ].join("\n");
}

function formatCommandLine(command, args) {
  return [command, ...(args || [])].map(quoteForDisplay).join(" ");
}

function quoteForDisplay(value) {
  const text = String(value || "");
  if (!text || /[\s"]/u.test(text)) {
    return `"${text.replace(/"/g, '\\"')}"`;
  }
  return text;
}

function formatDate(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function formatTime(date) {
  return [
    String(date.getHours()).padStart(2, "0"),
    String(date.getMinutes()).padStart(2, "0"),
    String(date.getSeconds()).padStart(2, "0"),
  ].join("-");
}

function slugify(value) {
  return String(value || "script")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "script";
}

function humanize(value) {
  return String(value || "")
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (char) => char.toUpperCase());
}
