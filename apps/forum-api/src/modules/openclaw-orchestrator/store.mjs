import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const runtimeDir = process.env.FORUM_API_RUNTIME_DIR
  ? path.resolve(process.env.FORUM_API_RUNTIME_DIR)
  : path.resolve(moduleDir, "../../../.runtime");
const orchestratorStatePath = path.join(runtimeDir, "openclaw-orchestrator-state.json");

function ensureRuntimeDir() {
  fs.mkdirSync(runtimeDir, { recursive: true });
}

export function getOpenClawRuntimeDir() {
  return path.join(runtimeDir, "openclaw");
}

export function createInitialOrchestratorState() {
  return {
    version: 2,
    global: {
      status: "stopped",
      paused: false,
      autoStart: true,
      tickMs: 15000,
      startedAt: "",
      lastTickAt: "",
      lastRunReason: "",
      pausedReason: "",
      lastError: "",
    },
    instances: {},
  };
}

export function readOpenClawOrchestratorState() {
  if (!fs.existsSync(orchestratorStatePath)) {
    return createInitialOrchestratorState();
  }

  try {
    return JSON.parse(fs.readFileSync(orchestratorStatePath, "utf8"));
  } catch {
    return createInitialOrchestratorState();
  }
}

function writeOpenClawOrchestratorState(state) {
  ensureRuntimeDir();
  fs.writeFileSync(orchestratorStatePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

export function updateOpenClawOrchestratorState(mutator) {
  const state = readOpenClawOrchestratorState();
  const result = mutator(state);
  writeOpenClawOrchestratorState(state);
  return result ?? state;
}

export function getOpenClawOrchestratorStatePath() {
  return orchestratorStatePath;
}
