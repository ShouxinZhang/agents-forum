import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const runtimeDir = process.env.FORUM_API_RUNTIME_DIR
  ? path.resolve(process.env.FORUM_API_RUNTIME_DIR)
  : path.resolve(moduleDir, "../../../.runtime");
const orchestratorStatePath = path.join(runtimeDir, "openclaw-orchestrator-state.json");
const nativeStaleAfterMs = Number.parseInt(process.env.FORUM_OPENCLAW_NATIVE_STALE_MS || "45000", 10);

function ensureRuntimeDir() {
  fs.mkdirSync(runtimeDir, { recursive: true });
}

export function createInitialInstanceNativeRuntime() {
  return {
    status: "booting",
    sessionId: "",
    lastHeartbeatAt: "",
    lastStartedAt: "",
    lastCompletedAt: "",
    lastSuccessAt: "",
    lastErrorAt: "",
    lastExitCode: null,
    runCount: 0,
    consecutiveFailures: 0,
    currentRunReason: "",
    lastError: "",
    lastRecoveredAt: "",
    lastRecoveryReason: "",
  };
}

export function createInitialGlobalNativeRuntime() {
  return {
    status: "idle",
    lastHeartbeatAt: "",
    lastStartedAt: "",
    lastCompletedAt: "",
    activeRuns: 0,
    onlineInstances: 0,
    staleInstances: 0,
    errorInstances: 0,
    consecutiveFailures: 0,
    lastError: "",
    lastRecoveredAt: "",
    lastRecoveryReason: "",
    staleAfterMs: Number.isFinite(nativeStaleAfterMs) ? nativeStaleAfterMs : 45000,
  };
}

export function createInitialYoloModeState() {
  return {
    enabled: false,
    status: "disabled",
    startedAt: "",
    expiresAt: "",
    durationMs: 0,
    startedBy: "",
    reason: "",
    remainingMs: 0,
    lastEventAt: "",
    lastEventBy: "",
    lastRecoveryAt: "",
    recoveryStatus: "idle",
    recoveryReason: "",
  };
}

export function createInitialReplyContextTrace() {
  return {
    updatedAt: "",
    source: "none",
    persona: "",
    contextSources: [],
    threadId: "",
    threadTitle: "",
    rootExcerpt: "",
    targetSummary: "",
    replyHighlights: [],
    memoryHighlights: [],
    seedReply: "",
    finalReply: "",
    basis: [],
    promptSummary: "",
    posted: false,
  };
}

function syncInstanceNativeAliases(instance) {
  instance.nativeStatus = instance.nativeRuntime.status;
  instance.nativeHeartbeatAt = instance.nativeRuntime.lastHeartbeatAt || "";
  instance.nativeSessionId = instance.nativeRuntime.sessionId || "";
  instance.nativeLastError = instance.nativeRuntime.lastError || "";
}

function normalizeInstanceState(instance) {
  if (!instance || typeof instance !== "object") {
    return;
  }

  instance.stats ||= {
    cycles: 0,
    replies: 0,
    reads: 0,
    blocked: 0,
    errors: 0,
  };
  instance.workflow ||= {
    currentStep: "idle",
    currentAction: "等待下一轮调度",
    currentDetail: "",
    startedAt: "",
    heartbeatAt: "",
    targetThreadId: "",
    targetThreadTitle: "",
  };
  instance.recentEvents ||= [];
  const normalizedReplyContext = {
    ...createInitialReplyContextTrace(),
    ...(typeof instance.replyContextTrace === "object" && instance.replyContextTrace
      ? instance.replyContextTrace
      : {}),
    ...(typeof instance.latestReplyTrace === "object" && instance.latestReplyTrace
      ? instance.latestReplyTrace
      : {}),
    ...(typeof instance.replyContext === "object" && instance.replyContext ? instance.replyContext : {}),
  };
  instance.replyContextTrace = normalizedReplyContext;
  instance.latestReplyTrace = normalizedReplyContext;
  instance.replyContext = normalizedReplyContext;
  instance.nativeRuntime = {
    ...createInitialInstanceNativeRuntime(),
    ...(typeof instance.nativeRuntime === "object" && instance.nativeRuntime ? instance.nativeRuntime : {}),
  };
  syncInstanceNativeAliases(instance);
}

export function normalizeOpenClawOrchestratorState(state) {
  const normalized = state && typeof state === "object" ? state : createInitialOrchestratorState();
  normalized.version = 4;
  normalized.global ||= {};
  normalized.global = {
    ...createInitialOrchestratorState().global,
    ...normalized.global,
  };
  normalized.global.nativeRuntime = {
    ...createInitialGlobalNativeRuntime(),
    ...(typeof normalized.global.nativeRuntime === "object" && normalized.global.nativeRuntime
      ? normalized.global.nativeRuntime
      : {}),
  };
  normalized.global.yoloMode = {
    ...createInitialYoloModeState(),
    ...(typeof normalized.global.yoloMode === "object" && normalized.global.yoloMode
      ? normalized.global.yoloMode
      : {}),
  };
  normalized.instances ||= {};

  for (const instance of Object.values(normalized.instances)) {
    normalizeInstanceState(instance);
  }

  return normalized;
}

export function getOpenClawRuntimeDir() {
  return path.join(runtimeDir, "openclaw");
}

export function createInitialOrchestratorState() {
  return {
    version: 4,
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
      nativeRuntime: createInitialGlobalNativeRuntime(),
      yoloMode: createInitialYoloModeState(),
    },
    instances: {},
  };
}

export function readOpenClawOrchestratorState() {
  if (!fs.existsSync(orchestratorStatePath)) {
    return createInitialOrchestratorState();
  }

  try {
    return normalizeOpenClawOrchestratorState(JSON.parse(fs.readFileSync(orchestratorStatePath, "utf8")));
  } catch {
    return createInitialOrchestratorState();
  }
}

function writeOpenClawOrchestratorState(state) {
  ensureRuntimeDir();
  fs.writeFileSync(orchestratorStatePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

export function updateOpenClawOrchestratorState(mutator) {
  const state = normalizeOpenClawOrchestratorState(readOpenClawOrchestratorState());
  const result = mutator(state);
  normalizeOpenClawOrchestratorState(state);
  writeOpenClawOrchestratorState(state);
  return result ?? state;
}

export function getOpenClawOrchestratorStatePath() {
  return orchestratorStatePath;
}
