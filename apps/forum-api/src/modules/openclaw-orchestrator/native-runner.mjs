import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(moduleDir, "../../../../../");
const bootstrapScript = path.join(
  repoRoot,
  "skills",
  "openclaw-forum-bot",
  "scripts",
  "bootstrap.sh"
);
const openclawCliEntry = path.resolve(
  "/home/wudizhe001/Documents/GitHub/openclaw-test/third_party/openclaw/openclaw.mjs"
);

function safeReadJson(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function resolveRootPath(instance) {
  if (typeof instance?.openclawRoot === "string" && instance.openclawRoot.trim()) {
    return path.resolve(instance.openclawRoot);
  }

  if (typeof instance?.openclawHome === "string" && instance.openclawHome.trim()) {
    const candidate = path.resolve(instance.openclawHome);
    if (candidate.endsWith(`${path.sep}.openclaw`)) {
      return path.dirname(candidate);
    }
    return candidate;
  }

  throw new Error("instance.openclawRoot is required for native runtime");
}

export function resolveNativeLayout(instance) {
  const rootPath = resolveRootPath(instance);
  const homePath = path.join(rootPath, ".openclaw");
  return {
    rootPath,
    homePath,
    workspaceDir: path.join(homePath, "workspace"),
    configPath: path.join(homePath, "openclaw.json"),
    authProfilesPath: path.join(homePath, "agents", "main", "agent", "auth-profiles.json"),
  };
}

function normalizePathForCompare(value) {
  return typeof value === "string" && value.trim() ? path.resolve(value) : "";
}

function resolveConfiguredWorkspaceDir(config, layout) {
  const configured = config?.agents?.defaults?.workspace;
  if (typeof configured !== "string" || !configured.trim()) {
    return layout.workspaceDir;
  }

  if (configured.startsWith("~/")) {
    return path.join(os.homedir(), configured.slice(2));
  }

  return path.isAbsolute(configured)
    ? path.resolve(configured)
    : path.resolve(layout.homePath, configured);
}

export function describeNativeRuntimeBinding(layout, config = safeReadJson(layout.configPath) || {}) {
  const configuredWorkspaceDir = resolveConfiguredWorkspaceDir(config, layout);
  const bindingVerified =
    normalizePathForCompare(layout.workspaceDir) === normalizePathForCompare(configuredWorkspaceDir) &&
    normalizePathForCompare(layout.homePath) ===
      normalizePathForCompare(path.dirname(layout.configPath));

  return {
    mode: "native_turn_bridge",
    driver: "forum_scheduler_requests_native_turns",
    schedulerRole: "compatibility-layer",
    rootPath: layout.rootPath,
    homePath: layout.homePath,
    workspaceDir: layout.workspaceDir,
    configPath: layout.configPath,
    configuredWorkspaceDir,
    openclawHomeEnv: layout.rootPath,
    openclawStateDirEnv: layout.homePath,
    invocationCwd: repoRoot,
    bindingVerified,
    verifiedAt: new Date().toISOString(),
  };
}

export function verifyNativeRuntimeBinding(instance) {
  const layout = resolveNativeLayout(instance);
  const config = safeReadJson(layout.configPath) || {};
  const binding = describeNativeRuntimeBinding(layout, config);

  if (!binding.bindingVerified) {
    throw new Error(
      `native runtime binding mismatch for ${instance?.id || "instance"}: workspace ${binding.configuredWorkspaceDir || "missing"}`
    );
  }

  return {
    layout,
    config,
    binding,
  };
}

function copyRecursiveIfMissing(sourcePath, targetPath) {
  if (!fs.existsSync(sourcePath) || fs.existsSync(targetPath)) {
    return;
  }

  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.cpSync(sourcePath, targetPath, {
    recursive: true,
  });
}

function migrateLegacyLayout(layout) {
  const legacyConfig = path.join(layout.rootPath, "openclaw.json");
  const legacyWorkspace = path.join(layout.rootPath, "workspace");
  const legacyAgents = path.join(layout.rootPath, "agents");

  copyRecursiveIfMissing(legacyConfig, layout.configPath);
  copyRecursiveIfMissing(legacyWorkspace, layout.workspaceDir);
  copyRecursiveIfMissing(legacyAgents, path.join(layout.homePath, "agents"));
}

function buildNativeConfig(layout) {
  const globalConfigPath = path.join(os.homedir(), ".openclaw", "openclaw.json");
  const globalConfig = safeReadJson(globalConfigPath) || {};
  const globalDefaults = globalConfig.agents?.defaults || {};
  const globalModels = globalDefaults.models || {};
  const globalPrimaryModel = globalDefaults.model || {
    primary: "openai-codex/gpt-5.4",
  };
  const globalTools = globalConfig.tools || {};
  const globalExec = globalTools.exec || {};

  return {
    ...(typeof globalConfig.meta === "object" && globalConfig.meta ? { meta: globalConfig.meta } : {}),
    ...(typeof globalConfig.auth === "object" && globalConfig.auth ? { auth: globalConfig.auth } : {}),
    agents: {
      ...(globalConfig.agents || {}),
      defaults: {
        ...globalDefaults,
        model: globalPrimaryModel,
        models: globalModels,
        workspace: layout.workspaceDir,
      },
    },
    ...(typeof globalConfig.commands === "object" && globalConfig.commands
      ? {
          commands: globalConfig.commands,
        }
      : {}),
    tools: {
      ...globalTools,
      // Forum-native turns should stay inside a predictable shell path instead of drifting to browser/web tools.
      allow: ["exec", "process"],
      exec: {
        ...globalExec,
        ask: "off",
        security: "full",
      },
    },
  };
}

function syncAuthProfiles(layout) {
  const source = path.join(os.homedir(), ".openclaw", "agents", "main", "agent", "auth-profiles.json");
  if (!fs.existsSync(source)) {
    return;
  }

  fs.mkdirSync(path.dirname(layout.authProfilesPath), { recursive: true });
  fs.copyFileSync(source, layout.authProfilesPath);
}

function ensureNativeConfig(layout) {
  fs.mkdirSync(layout.workspaceDir, { recursive: true });
  migrateLegacyLayout(layout);
  writeJson(layout.configPath, buildNativeConfig(layout));
  syncAuthProfiles(layout);
}

export function ensureNativeRuntimeReady(instance) {
  const layout = resolveNativeLayout(instance);
  ensureNativeConfig(layout);

  const targetSkillDir = path.join(layout.workspaceDir, "skills", "openclaw-forum-bot");
  if (fs.existsSync(targetSkillDir)) {
    return layout;
  }

  const result = spawnSync("bash", [bootstrapScript, "--force"], {
    cwd: repoRoot,
    env: {
      ...process.env,
      OPENCLAW_HOME: layout.rootPath,
      OPENCLAW_STATE_DIR: layout.homePath,
      OPENCLAW_CONFIG_PATH: layout.configPath,
      OPENCLAW_WORKSPACE: layout.workspaceDir,
    },
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  });

  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || result.stdout.trim() || "openclaw bootstrap failed");
  }

  ensureNativeConfig(layout);
  return verifyNativeRuntimeBinding(instance).layout;
}

export async function runNativeAgentTurn({
  instance,
  message,
  sessionId,
  timeoutSeconds = 120,
}) {
  ensureNativeRuntimeReady(instance);
  const { layout, binding } = verifyNativeRuntimeBinding(instance);
  const args = [
    openclawCliEntry,
    "agent",
    "--local",
    "--agent",
    "main",
    "--session-id",
    sessionId,
    "--json",
    "--timeout",
    String(timeoutSeconds),
    "--message",
    message,
  ];

  const result = await new Promise((resolve, reject) => {
    const child = spawn("node", args, {
      cwd: layout.rootPath,
      env: {
        ...process.env,
        OPENCLAW_HOME: layout.rootPath,
        OPENCLAW_STATE_DIR: layout.homePath,
        OPENCLAW_CONFIG_PATH: layout.configPath,
        FORUM_OPENCLAW_RUNTIME_ROOT: layout.rootPath,
        FORUM_OPENCLAW_WORKSPACE_DIR: layout.workspaceDir,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");

    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });

    child.on("error", (error) => {
      reject(error);
    });

    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || stdout.trim() || "openclaw native agent failed"));
        return;
      }

      try {
        resolve(JSON.parse(stdout));
      } catch (error) {
        reject(
          new Error(
            `failed to parse native OpenClaw JSON output: ${error instanceof Error ? error.message : String(error)}`
          )
        );
      }
    });
  });

  return {
    layout,
    runtimeBinding: binding,
    invocation: {
      cwd: layout.rootPath,
      homePath: layout.homePath,
      workspaceDir: layout.workspaceDir,
      cliEntry: openclawCliEntry,
    },
    result,
  };
}

export function extractNativeJsonPayload(runResult) {
  const payloads = runResult?.result?.payloads ?? runResult?.payloads ?? [];
  for (let index = payloads.length - 1; index >= 0; index -= 1) {
    const text = payloads[index]?.text;
    if (typeof text !== "string") {
      continue;
    }

    try {
      return JSON.parse(text);
    } catch {
      continue;
    }
  }

  throw new Error("could not find JSON payload in native OpenClaw result");
}
