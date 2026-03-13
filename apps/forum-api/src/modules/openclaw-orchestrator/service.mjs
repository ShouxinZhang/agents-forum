import fs from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { appendAgentRuntimeEvent } from "../agent-observer/runtime-events.mjs";
import { botAccounts, getBotAccountByUsername } from "../bot-auth/data.mjs";
import { evaluateReplyCandidate } from "../../../../../skills/bot-content-safety-check/scripts/check-content.mjs";
import { createMcpConfig } from "../mcp/config.mjs";
import { createForumMcpClient } from "../mcp/forum-client.mjs";
import {
  ensureNativeRuntimeReady,
  extractNativeJsonPayload,
  runNativeAgentTurn,
} from "./native-runner.mjs";
import {
  createApprovalRequest,
  evaluateBotAction,
  listApprovalRequests,
  readBotRuntimeState,
  recordBotAction,
  resolveApprovalRequest,
} from "../mcp/forum-bot/policy.mjs";
import {
  createInitialGlobalNativeRuntime,
  createInitialInstanceNativeRuntime,
  createInitialOrchestratorState,
  createInitialReplyContextTrace,
  createInitialYoloModeState,
  getOpenClawOrchestratorStatePath,
  getOpenClawRuntimeDir,
  readOpenClawOrchestratorState,
  updateOpenClawOrchestratorState,
} from "./store.mjs";
import {
  buildReplyContent,
  chooseReplyTarget,
  chooseThread,
  collectReplyTexts,
  mapDecisionToInstanceStatus,
} from "./workflow.mjs";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(moduleDir, "../../../../../");
const yoloDurationsMs = [5 * 60 * 1000, 15 * 60 * 1000, 30 * 60 * 1000];

function formatIso(timestamp = Date.now()) {
  return new Date(timestamp).toISOString();
}

function parseIsoOrZero(value) {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function isTimestampRecent(value, thresholdMs) {
  const timestamp = parseIsoOrZero(value);
  return timestamp > 0 && Date.now() - timestamp <= thresholdMs;
}

function resolvePresenceSource(nativeValue, forumValue) {
  if (nativeValue && forumValue) {
    return "mixed";
  }
  if (nativeValue) {
    return "native";
  }
  if (forumValue) {
    return "forum";
  }
  return "none";
}

function clipText(value, maxLength = 180) {
  const normalized = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  if (!normalized) {
    return "";
  }

  return normalized.length > maxLength
    ? `${normalized.slice(0, Math.max(0, maxLength - 1))}...`
    : normalized;
}

function normalizeReplyContextTrace(trace, fallback = {}) {
  const normalized = {
    ...createInitialReplyContextTrace(),
    ...(typeof fallback === "object" && fallback ? fallback : {}),
    ...(typeof trace === "object" && trace ? trace : {}),
  };
  normalized.contextSources = Array.isArray(normalized.contextSources)
    ? normalized.contextSources.filter((entry) => typeof entry === "string" && entry.trim())
    : [];
  const replyHighlightsSource =
    Array.isArray(normalized.replyHighlights) && normalized.replyHighlights.length > 0
      ? normalized.replyHighlights
      : Array.isArray(normalized.replySummaries)
        ? normalized.replySummaries
        : [];
  normalized.replyHighlights = Array.isArray(replyHighlightsSource)
    ? replyHighlightsSource
        .map((entry) => ({
          author: typeof entry?.author === "string" ? entry.author : "",
          text: clipText(entry?.text || entry?.summary || entry?.content || "", 120),
        }))
        .filter((entry) => entry.author || entry.text)
        .slice(0, 4)
    : [];
  normalized.memoryHighlights = Array.isArray(normalized.memoryHighlights)
    ? normalized.memoryHighlights.map((entry) => clipText(entry, 120)).filter(Boolean).slice(0, 4)
    : [];
  normalized.threadSummary = clipText(normalized.threadSummary, 180);
  normalized.rootSummary = clipText(normalized.rootSummary || normalized.rootExcerpt, 220);
  normalized.rootExcerpt = clipText(normalized.rootExcerpt, 220);
  normalized.targetSummary = clipText(normalized.targetSummary, 180);
  normalized.memoryApplied = clipText(normalized.memoryApplied, 160);
  normalized.whyThisReply = clipText(normalized.whyThisReply, 120);
  normalized.seedReply = clipText(normalized.seedReply, 220);
  normalized.finalReply = clipText(normalized.finalReply, 280);
  normalized.basis = Array.isArray(normalized.basis)
    ? normalized.basis.map((entry) => clipText(entry, 120)).filter(Boolean).slice(0, 4)
    : [];
  normalized.promptSummary = clipText(normalized.promptSummary, 220);
  return normalized;
}

function createNativeRuntimeStatusView(nativeRuntime, paused = false, staleAfterMs = 45000) {
  const normalized = {
    ...createInitialInstanceNativeRuntime(),
    ...(typeof nativeRuntime === "object" && nativeRuntime ? nativeRuntime : {}),
  };
  const heartbeatAt = parseIsoOrZero(normalized.lastHeartbeatAt);
  const stale = heartbeatAt > 0 && Date.now() - heartbeatAt > staleAfterMs;

  if (paused) {
    return {
      ...normalized,
      status: "paused",
      stale,
    };
  }

  if (normalized.status === "running") {
    return {
      ...normalized,
      stale,
    };
  }

  if (normalized.lastError && normalized.consecutiveFailures > 0) {
    return {
      ...normalized,
      status: stale ? "stale" : "error",
      stale,
    };
  }

  if (stale) {
    return {
      ...normalized,
      status: "stale",
      stale,
    };
  }

  return {
    ...normalized,
    status: normalized.runCount > 0 ? "idle" : normalized.status,
    stale: false,
  };
}

function syncInstanceNativeAliases(instance) {
  const nativeRuntime = createNativeRuntimeStatusView(instance.nativeRuntime, instance.paused);
  instance.nativeRuntime = nativeRuntime;
  instance.nativeStatus = nativeRuntime.status;
  instance.nativeHeartbeatAt = nativeRuntime.lastHeartbeatAt || "";
  instance.nativeSessionId = nativeRuntime.sessionId || "";
  instance.nativeLastError = nativeRuntime.lastError || "";
}

function ensureNativeRuntimeFields(instance) {
  instance.nativeRuntime ||= createInitialInstanceNativeRuntime();
  syncInstanceNativeAliases(instance);
}

function computeYoloModeView(yoloMode, now = Date.now()) {
  const normalized = {
    ...createInitialYoloModeState(),
    ...(typeof yoloMode === "object" && yoloMode ? yoloMode : {}),
  };
  const expiresAt = parseIsoOrZero(normalized.expiresAt);
  const remainingMs = normalized.enabled && expiresAt > now ? expiresAt - now : 0;
  const expired = Boolean(normalized.enabled && expiresAt > 0 && expiresAt <= now);

  return {
    ...normalized,
    enabled: normalized.enabled && remainingMs > 0,
    status: expired ? "expired" : normalized.enabled && remainingMs > 0 ? "enabled" : normalized.status,
    remainingMs,
  };
}

function resolveYoloDurationMs(value) {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.max(60 * 1000, Math.floor(value));
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    const matchedMinutes = normalized.match(/^(\d+)\s*m$/);
    if (matchedMinutes) {
      return Math.max(60 * 1000, Number.parseInt(matchedMinutes[1], 10) * 60 * 1000);
    }
    const matchedMs = normalized.match(/^(\d+)\s*ms$/);
    if (matchedMs) {
      return Math.max(60 * 1000, Number.parseInt(matchedMs[1], 10));
    }
  }

  return 15 * 60 * 1000;
}

function listMemoryHighlights(workspaceDir, limit = 3) {
  const memoryDir = path.join(workspaceDir || "", "memory");
  if (!workspaceDir || !fs.existsSync(memoryDir)) {
    return [];
  }

  const files = fs
    .readdirSync(memoryDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => {
      const filePath = path.join(memoryDir, entry.name);
      return {
        filePath,
        mtimeMs: fs.statSync(filePath).mtimeMs,
      };
    })
    .sort((left, right) => right.mtimeMs - left.mtimeMs)
    .slice(0, 2);

  const highlights = [];
  for (const file of files) {
    const lines = fs.readFileSync(file.filePath, "utf8").split("\n");
    for (let index = lines.length - 1; index >= 0; index -= 1) {
      const line = lines[index].trim();
      if (!line || line.startsWith("#")) {
        continue;
      }
      const normalized = line.replace(/^[-*]\s+/, "").trim();
      if (!normalized) {
        continue;
      }
      highlights.push(clipText(normalized, 120));
      if (highlights.length >= limit) {
        return highlights;
      }
    }
  }

  return highlights;
}

function flattenRepliesForContext(replies = [], parentFloorId = "") {
  return replies.flatMap((reply) => {
    const floorId = parentFloorId || reply.id;
    return [
      {
        ...reply,
        floorId,
      },
      ...flattenRepliesForContext(reply.children ?? [], floorId),
    ];
  });
}

function buildReplyHighlights(replies = [], limit = 3) {
  return flattenRepliesForContext(replies)
    .filter((reply) => typeof reply.content === "string" && reply.content.trim())
    .slice(0, limit)
    .map((reply) => ({
      author: reply.author || "unknown",
      text: clipText(reply.content, 96),
    }));
}

function describeReplyTargetForContext(replies = [], target = {}) {
  if (!target?.floorId && !target?.replyId) {
    return "";
  }

  const flatReplies = flattenRepliesForContext(replies);
  const match = flatReplies.find((reply) =>
    target.replyId ? reply.id === target.replyId : reply.id === target.floorId || reply.floorId === target.floorId
  );
  if (!match) {
    return target.targetAuthor ? `优先承接 ${target.targetAuthor} 的上下文` : "优先承接已有回复上下文";
  }

  const targetType = target.replyId ? "reply" : "floor";
  return `${targetType} by ${match.author || "unknown"}: ${clipText(match.content, 96)}`;
}

function buildReplyContextTrace({
  bot,
  threadId,
  threadTitle,
  threadPayload,
  repliesPayload,
  target,
  memoryHighlights,
  seedReply = "",
  finalReply = "",
  basis = [],
  source = "none",
  posted = false,
  memoryApplied = "",
}) {
  const rootExcerpt = clipText(threadPayload?.thread?.rootPost?.content || "", 140);
  const replyHighlights = buildReplyHighlights(repliesPayload?.replies ?? [], 3);
  const targetSummary = describeReplyTargetForContext(repliesPayload?.replies ?? [], target);
  const promptSummaryParts = [
    bot.persona ? `persona=${bot.persona}` : "",
    rootExcerpt ? `root=${rootExcerpt}` : "",
    targetSummary ? `target=${targetSummary}` : "",
    replyHighlights.length > 0 ? `replyHighlights=${replyHighlights.length}` : "",
    memoryHighlights.length > 0 ? `memoryHighlights=${memoryHighlights.length}` : "",
  ].filter(Boolean);

  return normalizeReplyContextTrace({
    status: posted ? "posted" : finalReply ? "drafted" : "prepared",
    source,
    persona: bot.persona || "",
    contextSources: Array.isArray(bot.contextSources) ? bot.contextSources : [],
    threadId,
    threadTitle,
    threadSummary: clipText(`${threadTitle} / ${rootExcerpt || "暂无首楼摘要"}`, 180),
    rootAuthor: threadPayload?.thread?.rootPost?.author || threadPayload?.thread?.author || "",
    rootSummary: rootExcerpt,
    rootExcerpt,
    targetSummary,
    target: {
      kind: target?.targetKind || (target?.replyId ? "reply" : target?.floorId ? "floor" : "thread"),
      author: target?.targetAuthor || "",
      floorId: target?.floorId || "",
      replyId: target?.replyId || "",
      summary: targetSummary,
    },
    replyCount: repliesPayload?.replyCount ?? 0,
    replySummaries: replyHighlights.map((item, index) => ({
      id: `${threadId}-reply-${index}`,
      floorId: target?.floorId || "",
      author: item.author,
      summary: item.text,
    })),
    replyHighlights,
    replySummary: replyHighlights.map((item) => `${item.author}: ${item.text}`).join(" / "),
    memoryApplied: memoryApplied || memoryHighlights.join(" / "),
    memoryHighlights,
    seedReply,
    finalReply,
    basis,
    whyThisReply: basis[0] || "",
    promptSummary: promptSummaryParts.join(" | "),
    posted,
    generatedAt: formatIso(),
    postedAt: posted ? formatIso() : "",
    generationSource: source,
    finalSource: source,
  });
}

function buildFeedThreadCandidates(page = {}, limit = 6) {
  return Array.isArray(page?.threads)
    ? page.threads
        .filter((thread) => thread && !thread.isDeleted && !thread.isLocked)
        .slice(0, limit)
        .map((thread) => ({
          id: thread.id,
          title: clipText(thread.title, 120),
          author: typeof thread.author === "string" ? thread.author : "",
          summary: clipText(thread.snippet || thread.rootPost?.content || "", 160),
          replyCount: Number(thread.replyCount ?? 0),
          isPinned: Boolean(thread.isPinned),
        }))
    : [];
}

function flattenReplyCandidates(replies = [], parentFloorId = "") {
  return replies.flatMap((reply) => {
    const floorId = parentFloorId || reply.id;
    const current = {
      id: reply.id,
      floorId,
      author: typeof reply.author === "string" ? reply.author : "",
      kind: reply.id?.startsWith("r-") ? "reply" : "floor",
      summary: clipText(reply.content || "", 120),
    };
    return [current, ...flattenReplyCandidates(reply.children ?? [], floorId)];
  });
}

function createWorkflowSnapshot() {
  return {
    currentStep: "idle",
    currentAction: "等待下一轮调度",
    currentDetail: "",
    startedAt: "",
    heartbeatAt: "",
    targetThreadId: "",
    targetThreadTitle: "",
  };
}

function createWorkflowEvent({
  step,
  action,
  detail = "",
  summary = "",
  status = "ok",
  threadId = "",
  threadTitle = "",
  timestamp = formatIso(),
}) {
  return {
    id: `workflow_${randomUUID()}`,
    step,
    action,
    detail,
    summary,
    status,
    timestamp,
    threadId,
    threadTitle,
  };
}

function ensureWorkflowFields(instance) {
  instance.workflow ||= createWorkflowSnapshot();
  instance.recentEvents ||= [];
}

function ensureReplyContextTraceFields(instance) {
  const trace = normalizeReplyContextTrace(
    instance.replyContextTrace ?? instance.latestReplyTrace ?? instance.replyContext
  );
  instance.replyContextTrace = trace;
  instance.latestReplyTrace = trace;
  instance.replyContext = trace;
}

function createInstanceSeed(bot, index) {
  const instanceId = `openclaw-${bot.username}`;
  const openclawRoot = path.join(getOpenClawRuntimeDir(), instanceId);
  const openclawHome = path.join(openclawRoot, ".openclaw");
  return {
    id: instanceId,
    label: `OpenClaw ${bot.displayName}`,
    sortOrder: index,
    botUsername: bot.username,
    displayName: bot.displayName,
    agentId: bot.agentId || "",
    canWrite: Boolean(bot.canWrite),
    openclawRoot,
    openclawHome,
    workspaceDir: path.join(openclawHome, "workspace"),
  };
}

function buildSeeds() {
  return botAccounts.map((bot, index) => createInstanceSeed(bot, index));
}

function createService(options = {}) {
  const origin = options.origin || process.env.FORUM_API_ORIGIN || "http://127.0.0.1:4174";
  const tickMs = Number.parseInt(process.env.FORUM_OPENCLAW_TICK_MS || "15000", 10);
  const yoloTickMs = Number.parseInt(
    process.env.FORUM_OPENCLAW_YOLO_TICK_MS || String(Math.max(3000, Math.min(tickMs, 5000))),
    10
  );
  const autoStart = process.env.FORUM_OPENCLAW_AUTOSTART !== "false";
  const defaultSectionId = process.env.FORUM_OPENCLAW_SECTION_ID || "arena";
  const approvalMode = process.env.FORUM_BOT_APPROVAL_MODE || "auto";

  let intervalId = null;
  let intervalMs = 0;
  let runningTick = null;
  let bootstrapped = false;
  const runningInstances = new Map();

  function appendGlobalObserverEvent({
    summary,
    status = "ok",
    tool = "native_runtime",
    detail = "",
    step = "",
    action = "",
  }) {
    return appendAgentRuntimeEvent({
      id: `runtime_${randomUUID()}`,
      agentId: "",
      tool,
      summary,
      timestamp: formatIso(),
      status,
      source: "openclaw-orchestrator",
      step,
      action,
      detail,
    });
  }

  function getStateSnapshot() {
    return readOpenClawOrchestratorState();
  }

  function getEffectiveTickMs(state = getStateSnapshot()) {
    const yoloMode = computeYoloModeView(state.global?.yoloMode);
    return yoloMode.enabled ? Math.max(1000, yoloTickMs) : Math.max(1000, tickMs);
  }

  function getYoloModeView(state = getStateSnapshot()) {
    return computeYoloModeView(state.global?.yoloMode);
  }

  function refreshGlobalNativeRuntime() {
    updateOpenClawOrchestratorState((state) => {
      const instances = Object.values(state.instances ?? {});
      const nativeRuntime = {
        ...createInitialGlobalNativeRuntime(),
        ...(typeof state.global.nativeRuntime === "object" && state.global.nativeRuntime
          ? state.global.nativeRuntime
          : {}),
      };
      const staleAfterMs = Number.isFinite(nativeRuntime.staleAfterMs)
        ? nativeRuntime.staleAfterMs
        : 45000;
      const recentThreshold = Math.max(staleAfterMs, getEffectiveTickMs(state) * 3);

      const activeRuns = instances.filter((instance) => instance.nativeRuntime?.status === "running").length;
      const onlineInstances = instances.filter((instance) =>
        isTimestampRecent(instance.nativeRuntime?.lastHeartbeatAt, recentThreshold)
      ).length;
      const staleInstances = instances.filter((instance) => instance.nativeRuntime?.status === "stale").length;
      const errorInstances = instances.filter((instance) =>
        ["error", "stale"].includes(instance.nativeRuntime?.status)
      ).length;
      const lastHeartbeatAt = instances
        .map((instance) => instance.nativeRuntime?.lastHeartbeatAt || "")
        .filter(Boolean)
        .sort((left, right) => right.localeCompare(left))[0] || nativeRuntime.lastHeartbeatAt || "";

      state.global.nativeRuntime = {
        ...nativeRuntime,
        status: activeRuns > 0 ? "running" : onlineInstances > 0 ? "idle" : state.global.paused ? "paused" : "idle",
        lastHeartbeatAt,
        onlineInstances,
        staleInstances,
        errorInstances,
        activeRuns,
      };
    });
  }

  function updateInstanceNativeRuntime(instanceId, mutator) {
    updateInstance(instanceId, (instance) => {
      ensureNativeRuntimeFields(instance);
      mutator(instance.nativeRuntime, instance);
      syncInstanceNativeAliases(instance);
    });
    refreshGlobalNativeRuntime();
  }

  function markNativeRunStarted(instanceId, sessionId, reason) {
    const timestamp = formatIso();
    updateInstanceNativeRuntime(instanceId, (nativeRuntime) => {
      nativeRuntime.status = "running";
      nativeRuntime.sessionId = sessionId;
      nativeRuntime.lastStartedAt = timestamp;
      nativeRuntime.lastHeartbeatAt = timestamp;
      nativeRuntime.currentRunReason = reason;
      nativeRuntime.runCount += 1;
    });
  }

  function markNativeRunFinished(instanceId, options = {}) {
    const timestamp = formatIso();
    updateInstanceNativeRuntime(instanceId, (nativeRuntime) => {
      nativeRuntime.lastHeartbeatAt = timestamp;
      nativeRuntime.lastCompletedAt = timestamp;
      nativeRuntime.lastExitCode =
        typeof options.exitCode === "number" ? options.exitCode : nativeRuntime.lastExitCode;

      if (options.ok) {
        nativeRuntime.status = "idle";
        nativeRuntime.lastSuccessAt = timestamp;
        nativeRuntime.lastRecoveredAt = timestamp;
        nativeRuntime.lastRecoveryReason = options.reason || nativeRuntime.currentRunReason || "";
        nativeRuntime.consecutiveFailures = 0;
        nativeRuntime.lastError = "";
        nativeRuntime.lastErrorAt = "";
      } else {
        nativeRuntime.status = "error";
        nativeRuntime.lastError = options.error || "native runtime failed";
        nativeRuntime.lastErrorAt = timestamp;
        nativeRuntime.consecutiveFailures += 1;
      }

      nativeRuntime.currentRunReason = "";
    });
  }

  function resetInterval(force = false) {
    if (!intervalId && !force) {
      return;
    }

    const nextIntervalMs = getEffectiveTickMs();
    if (!force && intervalId && intervalMs === nextIntervalMs) {
      return;
    }

    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }

    intervalMs = nextIntervalMs;

    if (autoStart && !getStateSnapshot().global.paused) {
      intervalId = setInterval(() => {
        tick("interval").catch(() => {});
      }, intervalMs);
    }
  }

  function stopYoloMode({
    reason = "manual_stop",
    actor = "admin",
    recoveryStatus = "stopped",
  } = {}) {
    updateOpenClawOrchestratorState((state) => {
      state.global.yoloMode = {
        ...computeYoloModeView(state.global.yoloMode),
        enabled: false,
        status: "disabled",
        expiresAt: "",
        remainingMs: 0,
        lastEventAt: formatIso(),
        lastEventBy: actor,
        lastRecoveryAt: formatIso(),
        recoveryStatus,
        recoveryReason: reason,
      };
    });

    appendGlobalObserverEvent({
      step: "yolo_mode",
      action: "YOLO Mode 已关闭",
      summary: `YOLO Mode 已关闭：${reason}`,
      detail: `actor=${actor}`,
      status: "warn",
      tool: "yolo_mode",
    });
    resetInterval(Boolean(intervalId));
  }

  function expireYoloModeIfNeeded() {
    const snapshot = getStateSnapshot();
    const yoloMode = computeYoloModeView(snapshot.global?.yoloMode);
    if (!yoloMode.enabled && yoloMode.status !== "expired") {
      return yoloMode;
    }
    if (yoloMode.enabled) {
      return yoloMode;
    }

    stopYoloMode({
      reason: "duration_expired",
      actor: yoloMode.lastEventBy || "system",
      recoveryStatus: "expired",
    });
    return computeYoloModeView(getStateSnapshot().global?.yoloMode);
  }

  function startYoloMode({
    durationMs,
    actor = "admin",
    reason = "manual_start",
  } = {}) {
    const resolvedDurationMs = resolveYoloDurationMs(durationMs);
    const expiresAt = formatIso(Date.now() + resolvedDurationMs);
    updateOpenClawOrchestratorState((state) => {
      state.global.yoloMode = {
        ...computeYoloModeView(state.global.yoloMode),
        enabled: true,
        status: "enabled",
        startedAt: formatIso(),
        expiresAt,
        durationMs: resolvedDurationMs,
        startedBy: actor,
        reason,
        remainingMs: resolvedDurationMs,
        lastEventAt: formatIso(),
        lastEventBy: actor,
        lastRecoveryAt: "",
        recoveryStatus: "active",
        recoveryReason: "",
      };
    });

    appendGlobalObserverEvent({
      step: "yolo_mode",
      action: "YOLO Mode 已开启",
      summary: `YOLO Mode 已开启 ${Math.round(resolvedDurationMs / 60000)} 分钟`,
      detail: `actor=${actor} reason=${reason}`,
      status: "warn",
      tool: "yolo_mode",
    });
    resetInterval(Boolean(intervalId));
  }

  function ensureStateInitialized() {
    const seeds = buildSeeds();

    updateOpenClawOrchestratorState((state) => {
      if (!state.global) {
        state.global = createInitialOrchestratorState().global;
      }

      state.global.tickMs = Number.isFinite(tickMs) ? tickMs : 15000;
      state.global.autoStart = autoStart;
      state.instances ||= {};

      for (const seed of seeds) {
        if (!state.instances[seed.id]) {
          state.instances[seed.id] = {
            ...seed,
            status: "booting",
            paused: false,
            workspaceReady: false,
            online: false,
            nextRunAt: "",
            lastHeartbeatAt: "",
            lastTransitionAt: "",
            currentThreadId: "",
            currentThreadTitle: "",
            lastDecision: "",
            lastSummary: "",
            lastError: "",
            workflow: createWorkflowSnapshot(),
            recentEvents: [],
            replyContext: createInitialReplyContextTrace(),
            nativeRuntime: createInitialInstanceNativeRuntime(),
            nativeStatus: "booting",
            nativeHeartbeatAt: "",
            nativeSessionId: "",
            nativeLastError: "",
            stats: {
              cycles: 0,
              replies: 0,
              reads: 0,
              blocked: 0,
              errors: 0,
            },
          };
        }

        Object.assign(state.instances[seed.id], {
          label: seed.label,
          sortOrder: seed.sortOrder,
          botUsername: seed.botUsername,
          displayName: seed.displayName,
          agentId: seed.agentId,
          canWrite: seed.canWrite,
          openclawRoot: seed.openclawRoot,
          openclawHome: seed.openclawHome,
          workspaceDir: seed.workspaceDir,
        });

        ensureWorkflowFields(state.instances[seed.id]);
        ensureReplyContextTraceFields(state.instances[seed.id]);
        ensureNativeRuntimeFields(state.instances[seed.id]);
      }
    });

    return seeds;
  }

  function updateInstance(instanceId, mutator) {
    return updateOpenClawOrchestratorState((state) => {
      const instance = state.instances[instanceId];
      if (!instance) {
        return null;
      }

      return mutator(instance, state);
    });
  }

  function updateReplyContextTrace(instanceId, trace) {
    updateInstance(instanceId, (instance) => {
      ensureReplyContextTraceFields(instance);
      const normalizedTrace = normalizeReplyContextTrace(trace, instance.replyContextTrace);
      instance.replyContextTrace = normalizedTrace;
      instance.latestReplyTrace = normalizedTrace;
      instance.replyContext = normalizedTrace;
    });
  }

  function recordWorkflowEvent(instance, event, options = {}) {
    const timestamp = event.timestamp || formatIso();
    const normalizedEvent = createWorkflowEvent({
      ...event,
      timestamp,
      threadId: event.threadId ?? instance.currentThreadId ?? "",
      threadTitle: event.threadTitle ?? instance.currentThreadTitle ?? "",
    });

    updateInstance(instance.id, (draft) => {
      ensureWorkflowFields(draft);
      ensureReplyContextTraceFields(draft);
      ensureNativeRuntimeFields(draft);
      draft.workflow.currentStep = normalizedEvent.step || draft.workflow.currentStep;
      draft.workflow.currentAction = normalizedEvent.action || draft.workflow.currentAction;
      draft.workflow.currentDetail = normalizedEvent.detail || normalizedEvent.summary;
      draft.workflow.startedAt = timestamp;
      draft.workflow.heartbeatAt = timestamp;
      if (normalizedEvent.threadId) {
        draft.workflow.targetThreadId = normalizedEvent.threadId;
        draft.currentThreadId = normalizedEvent.threadId;
      }
      if (normalizedEvent.threadTitle) {
        draft.workflow.targetThreadTitle = normalizedEvent.threadTitle;
        draft.currentThreadTitle = normalizedEvent.threadTitle;
      }
      draft.lastHeartbeatAt = timestamp;
      draft.recentEvents = [normalizedEvent, ...draft.recentEvents].slice(0, 12);

      if (options.status) {
        draft.status = options.status;
      }
      if (typeof options.summary === "string") {
        draft.lastSummary = options.summary;
      }
      if (typeof options.decision === "string") {
        draft.lastDecision = options.decision;
      }
      if (typeof options.error === "string") {
        draft.lastError = options.error;
      }
      if (options.transition !== false) {
        draft.lastTransitionAt = timestamp;
      }
      if (typeof options.nextRunAt === "string") {
        draft.nextRunAt = options.nextRunAt;
      }
      syncInstanceNativeAliases(draft);
    });

    return appendAgentRuntimeEvent({
      id: `runtime_${randomUUID()}`,
      agentId: instance.agentId || "",
      tool: event.tool || normalizedEvent.step || "workflow",
      summary: normalizedEvent.summary,
      timestamp,
      status: normalizedEvent.status,
      source: "openclaw-orchestrator",
      instanceId: instance.id,
      botUsername: instance.botUsername,
      threadId: normalizedEvent.threadId,
      threadTitle: normalizedEvent.threadTitle,
      step: normalizedEvent.step,
      action: normalizedEvent.action,
      detail: normalizedEvent.detail,
    });
  }

  function ensureInstanceWorkspace(instance) {
    const layout = ensureNativeRuntimeReady(instance);
    updateInstance(instance.id, (draft) => {
      ensureReplyContextTraceFields(draft);
      ensureNativeRuntimeFields(draft);
      draft.workspaceReady = true;
      draft.openclawHome = layout.homePath;
      draft.workspaceDir = layout.workspaceDir;
      syncInstanceNativeAliases(draft);
    });
  }

  function buildNativeObservePrompt({ bot, threadId, threadTitle, persistNote }) {
    const command = [
      "node",
      path.join(repoRoot, "scripts", "openclaw", "forum-native-turn.mjs"),
      "--mode",
      "observe-thread",
      "--origin",
      origin,
      "--thread-id",
      threadId,
      "--username",
      bot.username,
      "--password",
      bot.password,
      ...(persistNote ? ["--persist-note"] : []),
      "--note",
      `${bot.username} observed '${threadTitle}' (${threadId}) through native OpenClaw runtime.`,
    ];

    return [
      `You are operating the ${bot.displayName} native forum runtime.`,
      "Use the exec tool exactly once. Do not use browser, web_fetch, or any other tool.",
      "Set exec yieldMs to 30000 and timeout to 120000 so the command can finish in one turn.",
      "Run this command without modification:",
      command.map((item) => JSON.stringify(item)).join(" "),
      'Then return only the JSON result from that command, with no prose.',
    ].join(" ");
  }

  function buildNativeDraftReplyPrompt({
    bot,
    threadId,
    threadTitle,
    contextTrace,
  }) {
    const promptContext = normalizeReplyContextTrace(contextTrace, {
      status: "prepared",
      threadId,
      threadTitle,
      persona: bot.persona,
      contextSources: bot.contextSources,
    });

    return [
      `You are ${bot.displayName} (${bot.username}) drafting one forum reply for thread ${threadId}.`,
      "Generate the final reply content yourself. The forum scheduler will post exactly your reply text after policy checks, so there is no local template fallback.",
      'Return only valid JSON with this shape: {"mode":"forum-native-reply-draft","replyText":"...","whyThisReply":"...","memoryApplied":"...","contextTrace":{...}}',
      "Requirements:",
      "- replyText must be one concise Chinese paragraph, specific to this thread, and no more than 140 Chinese characters.",
      "- whyThisReply must explain why this reply fits the thread and target in no more than 80 Chinese characters.",
      "- memoryApplied must briefly state what prior memory/context you reused. If none, return an empty string.",
      "- contextTrace must echo the effective persona, the thread/root summary, the reply summaries you relied on, the chosen target, memoryApplied, whyThisReply, and finalReply.",
      "- Do not use Markdown lists, code fences, or generic filler.",
      "Forum context:",
      JSON.stringify(promptContext, null, 2),
      "Return JSON only.",
    ].join(" ");
  }

  function buildNativeThreadPlanPrompt({ bot, page }) {
    const candidates = buildFeedThreadCandidates(page);

    return [
      `You are ${bot.displayName} (${bot.username}) selecting one forum thread to inspect next.`,
      'Return only JSON: {"mode":"forum-thread-plan","threadId":"...","reason":"..."}',
      "Choose one candidate thread id that best fits your persona and current forum momentum.",
      "reason must be one short sentence in Chinese, under 60 Chinese characters.",
      "If no candidate is suitable, return an empty threadId.",
      `Persona: ${bot.persona || "无"}`,
      "Candidates:",
      JSON.stringify(candidates, null, 2),
      "Return JSON only.",
    ].join(" ");
  }

  function normalizeNativeThreadPlan(payload, page) {
    const candidates = buildFeedThreadCandidates(page);
    const availableThreadIds = new Set(candidates.map((item) => item.id));
    const threadId = typeof payload?.threadId === "string" ? payload.threadId.trim() : "";
    if (!threadId || !availableThreadIds.has(threadId)) {
      return null;
    }

    return {
      threadId,
      reason: clipText(payload?.reason || "", 96),
    };
  }

  async function executeNativeThreadPlan(seed, bot, page) {
    const sessionId = resolveNativeSessionId(seed);
    markNativeRunStarted(seed.id, sessionId, "plan-thread");
    try {
      const run = await runNativeAgentTurn({
        instance: seed,
        sessionId,
        timeoutSeconds: 45,
        message: buildNativeThreadPlanPrompt({ bot, page }),
      });
      markNativeRunFinished(seed.id, {
        ok: true,
        exitCode: 0,
        reason: "plan-thread",
      });

      return {
        run,
        payload: extractNativeJsonPayload(run.result),
      };
    } catch (error) {
      markNativeRunFinished(seed.id, {
        ok: false,
        exitCode: 1,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  function buildNativeTargetPlanPrompt({ bot, threadPayload, repliesPayload }) {
    const candidates = flattenReplyCandidates(repliesPayload?.replies ?? []).slice(0, 8);
    const rootExcerpt = clipText(threadPayload?.thread?.rootPost?.content || "", 160);

    return [
      `You are ${bot.displayName} (${bot.username}) choosing what reply context to continue in thread ${threadPayload?.thread?.id || ""}.`,
      'Return only JSON: {"mode":"forum-target-plan","targetKind":"thread|floor|reply","floorId":"...","replyId":"...","targetAuthor":"...","reason":"..."}',
      "Choose the best target for your next reply. If you should reply to the root thread, return targetKind=thread and leave ids empty.",
      "reason must be one short Chinese sentence under 60 Chinese characters.",
      `Persona: ${bot.persona || "无"}`,
      `Thread title: ${threadPayload?.thread?.title || ""}`,
      `Root summary: ${rootExcerpt || "none"}`,
      "Candidates:",
      JSON.stringify(candidates, null, 2),
      "Return JSON only.",
    ].join(" ");
  }

  function normalizeNativeTargetPlan(payload, repliesPayload) {
    const candidates = flattenReplyCandidates(repliesPayload?.replies ?? []);
    const byId = new Map(candidates.map((item) => [item.id, item]));
    const floorId = typeof payload?.floorId === "string" ? payload.floorId.trim() : "";
    const replyId = typeof payload?.replyId === "string" ? payload.replyId.trim() : "";
    const explicitTarget = replyId ? byId.get(replyId) : floorId ? byId.get(floorId) : null;
    const targetKind =
      payload?.targetKind === "reply" || payload?.targetKind === "floor" || payload?.targetKind === "thread"
        ? payload.targetKind
        : explicitTarget?.kind || "thread";

    if (targetKind === "reply" && !replyId) {
      return null;
    }
    if (targetKind === "floor" && !floorId) {
      return null;
    }

    return {
      targetKind,
      floorId: targetKind === "thread" ? "" : floorId || explicitTarget?.floorId || "",
      replyId: targetKind === "reply" ? replyId : "",
      targetAuthor:
        (typeof payload?.targetAuthor === "string" && payload.targetAuthor.trim()) ||
        explicitTarget?.author ||
        "",
      reason: clipText(payload?.reason || "", 96),
    };
  }

  async function executeNativeTargetPlan(seed, bot, threadPayload, repliesPayload) {
    const sessionId = resolveNativeSessionId(seed);
    markNativeRunStarted(seed.id, sessionId, "plan-target");
    try {
      const run = await runNativeAgentTurn({
        instance: seed,
        sessionId,
        timeoutSeconds: 45,
        message: buildNativeTargetPlanPrompt({ bot, threadPayload, repliesPayload }),
      });
      markNativeRunFinished(seed.id, {
        ok: true,
        exitCode: 0,
        reason: "plan-target",
      });

      return {
        run,
        payload: extractNativeJsonPayload(run.result),
      };
    } catch (error) {
      markNativeRunFinished(seed.id, {
        ok: false,
        exitCode: 1,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  function resolveNativeSessionId(seed) {
    return `forum-native-v2-${seed.id}`;
  }

  async function executeNativeObserve(seed, bot, threadId, threadTitle, persistNote) {
    const sessionId = resolveNativeSessionId(seed);
    markNativeRunStarted(seed.id, sessionId, "observe-thread");
    try {
      const run = await runNativeAgentTurn({
        instance: seed,
        sessionId,
        timeoutSeconds: 120,
        message: buildNativeObservePrompt({
          bot,
          threadId,
          threadTitle,
          persistNote,
        }),
      });
      markNativeRunFinished(seed.id, {
        ok: true,
        exitCode: 0,
        reason: "observe-thread",
      });

      return {
        run,
        payload: extractNativeJsonPayload(run.result),
      };
    } catch (error) {
      markNativeRunFinished(seed.id, {
        ok: false,
        exitCode: 1,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async function executeNativeDraftReply(seed, bot, threadId, threadTitle, contextTrace) {
    const sessionId = resolveNativeSessionId(seed);
    markNativeRunStarted(seed.id, sessionId, "draft-reply");
    try {
      const run = await runNativeAgentTurn({
        instance: seed,
        sessionId,
        timeoutSeconds: 45,
        message: buildNativeDraftReplyPrompt({
          bot,
          threadId,
          threadTitle,
          contextTrace,
        }),
      });
      markNativeRunFinished(seed.id, {
        ok: true,
        exitCode: 0,
        reason: "draft-reply",
      });

      return {
        run,
        payload: extractNativeJsonPayload(run.result),
      };
    } catch (error) {
      markNativeRunFinished(seed.id, {
        ok: false,
        exitCode: 1,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  function normalizeNativeReplyDraft(payload, fallbackTrace, sessionId = "") {
    const normalizedPayload = payload && typeof payload === "object" ? payload : {};
    const rawContextTrace =
      normalizedPayload.contextTrace && typeof normalizedPayload.contextTrace === "object"
        ? normalizedPayload.contextTrace
        : {};
    const replyText = clipText(
      normalizedPayload.replyText || normalizedPayload.finalReply || normalizedPayload.content || rawContextTrace.finalReply,
      280
    );

    if (!replyText) {
      throw new Error("native OpenClaw reply draft is missing replyText");
    }

    return {
      payload: normalizedPayload,
      replyText,
      contextTrace: normalizeReplyContextTrace(
        {
          ...rawContextTrace,
          status: "drafted",
          source: "openclaw-native",
          memoryApplied:
            normalizedPayload.memoryApplied || rawContextTrace.memoryApplied || "",
          whyThisReply:
            normalizedPayload.whyThisReply || rawContextTrace.whyThisReply || "",
          finalReply: replyText,
          generatedAt: formatIso(),
          nativeSessionId: sessionId,
        },
        fallbackTrace
      ),
    };
  }

  function buildNativePostReplyPrompt({
    bot,
    threadId,
    threadTitle,
    content,
    floorId,
    replyId,
    note = "",
  }) {
    const command = [
      "node",
      path.join(repoRoot, "scripts", "openclaw", "forum-native-turn.mjs"),
      "--mode",
      "reply-thread",
      "--origin",
      origin,
      "--thread-id",
      threadId,
      "--username",
      bot.username,
      "--password",
      bot.password,
      ...(floorId ? ["--floor-id", floorId] : []),
      ...(replyId ? ["--reply-id", replyId] : []),
      "--content",
      content,
      "--persist-note",
      "--note",
      note ||
        `${bot.username} replied to '${threadTitle}' (${threadId}) through native OpenClaw runtime.`,
    ];

    return [
      `You are operating the ${bot.displayName} native forum runtime.`,
      "Use the exec tool exactly once. Do not use browser, web_fetch, or any other tool.",
      "Set exec yieldMs to 30000 and timeout to 120000 so the command can finish in one turn.",
      "Run this command without modification:",
      command.map((item) => JSON.stringify(item)).join(" "),
      'Then return only the JSON result from that command, with no prose.',
    ].join(" ");
  }

  async function executeNativePostReply(seed, bot, threadId, threadTitle, content, target = {}, note = "") {
    const sessionId = resolveNativeSessionId(seed);
    markNativeRunStarted(seed.id, sessionId, "post-reply");
    try {
      const run = await runNativeAgentTurn({
        instance: seed,
        sessionId,
        timeoutSeconds: 120,
        message: buildNativePostReplyPrompt({
          bot,
          threadId,
          threadTitle,
          content,
          floorId: target.floorId || "",
          replyId: target.replyId || "",
          note,
        }),
      });
      markNativeRunFinished(seed.id, {
        ok: true,
        exitCode: 0,
        reason: "post-reply",
      });

      return {
        run,
        payload: extractNativeJsonPayload(run.result),
      };
    } catch (error) {
      markNativeRunFinished(seed.id, {
        ok: false,
        exitCode: 1,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  function createInstanceClient(bot) {
    return createForumMcpClient(
      createMcpConfig({
        origin,
        loginUser: bot.username,
        loginPassword: bot.password,
        timeoutMs: 8000,
      })
    );
  }

  function buildQuotaSnapshot(instance) {
    const bot = getBotAccountByUsername(instance.botUsername);
    if (!bot) {
      return {
        used: 0,
        limit: 0,
        remainingMs: 0,
        pendingApprovals: 0,
      };
    }

    const policyState = readBotRuntimeState();
    const bucket = policyState.bots?.[bot.username] ?? { days: {}, threads: {}, approvals: [] };
    const dayKey = new Date().toISOString().slice(0, 10);
    const used = bucket.days?.[dayKey]?.replyCount ?? 0;
    const yoloReplies = bucket.days?.[dayKey]?.yoloReplyCount ?? 0;
    const threadState =
      instance.currentThreadId && bucket.threads ? bucket.threads[instance.currentThreadId] : null;
    const remainingMs = threadState?.lastReplyAt
      ? Math.max(0, threadState.lastReplyAt + (bot.sameThreadCooldownMs ?? 0) - Date.now())
      : 0;

    return {
      used,
      limit: Number.isFinite(bot.dailyReplyQuota) ? bot.dailyReplyQuota : 0,
      remainingMs,
      pendingApprovals: Array.isArray(bucket.approvals)
        ? bucket.approvals.filter((entry) => entry?.status === "pending").length
        : 0,
      yoloReplies,
    };
  }

  async function runInstanceCycle(seed, reason = "interval", options = {}) {
    const bot = getBotAccountByUsername(seed.botUsername);
    if (!bot) {
      throw new Error(`Unknown bot for instance ${seed.id}`);
    }

    ensureInstanceWorkspace(seed);
    const client = createInstanceClient(bot);
    const startedAt = Date.now();
    const yoloMode = expireYoloModeIfNeeded();
    const effectiveApprovalMode =
      options.approvalModeOverride === "manual" || options.approvalModeOverride === "auto"
        ? options.approvalModeOverride
        : approvalMode;
    const activeTickMs = getEffectiveTickMs();

    updateInstance(seed.id, (instance) => {
      ensureWorkflowFields(instance);
      ensureNativeRuntimeFields(instance);
      instance.status = "reading";
      instance.online = true;
      instance.lastHeartbeatAt = formatIso(startedAt);
      instance.lastTransitionAt = formatIso(startedAt);
      instance.lastError = "";
      instance.stats.cycles += 1;
    });
    recordWorkflowEvent(
      seed,
      {
        step: "reading_feed",
        action: "读取论坛 Feed",
        detail: `origin=${origin} section=${defaultSectionId}`,
        summary: `${seed.label} 正在读取 ${defaultSectionId} 板块 Feed`,
        tool: "get_forum_page",
      },
      {
        status: "reading",
        summary: "正在读取论坛 Feed",
        decision: reason,
      }
    );

    const currentSnapshot = readOpenClawOrchestratorState().instances[seed.id];
    const page = await client.getForumPage({ sectionId: defaultSectionId });
    recordWorkflowEvent(seed, {
      step: "reading_feed",
      action: "读取论坛 Feed",
      detail: `threads=${page.threads.length}`,
      summary: `${seed.label} 已读取 ${page.threads.length} 个帖子摘要`,
      tool: "get_forum_page",
    });

    const requestedThreadId =
      typeof options.threadIdOverride === "string" ? options.threadIdOverride.trim() : "";
    const fallbackThreadId = chooseThread(page.threads, {
      avoidThreadId: currentSnapshot?.currentThreadId || "",
    });
    let threadId = requestedThreadId || fallbackThreadId;
    if (requestedThreadId) {
      recordWorkflowEvent(seed, {
        step: "planning_thread",
        action: "使用指定帖子",
        detail: requestedThreadId,
        summary: `${seed.label} 使用指定帖子 ${requestedThreadId}`,
        threadId: requestedThreadId,
        tool: "manual_thread_override",
      });
    } else {
      try {
        const nativeThreadPlan = await executeNativeThreadPlan(seed, bot, page);
        const normalizedThreadPlan = normalizeNativeThreadPlan(nativeThreadPlan.payload, page);
        if (normalizedThreadPlan?.threadId) {
          threadId = normalizedThreadPlan.threadId;
          recordWorkflowEvent(seed, {
            step: "planning_thread",
            action: "原生选择帖子",
            detail: `${threadId} ${normalizedThreadPlan.reason || ""}`.trim(),
            summary: `${seed.label} 通过 native planner 选择了帖子 ${threadId}`,
            threadId,
            tool: "native_plan_thread",
          });
        }
      } catch (error) {
        recordWorkflowEvent(seed, {
          step: "planning_thread",
          action: "原生选帖失败，回退本地排序",
          detail: error instanceof Error ? error.message : String(error),
          summary: `${seed.label} 原生选帖失败，回退本地排序`,
          status: "warn",
          threadId: fallbackThreadId,
          tool: "native_plan_thread",
        });
      }
    }

    if (!threadId) {
      recordWorkflowEvent(
        seed,
        {
          step: "idle",
          action: "等待下一轮调度",
          detail: "本轮未找到可阅读帖子",
          summary: "未找到可阅读帖子",
          tool: "choose_thread",
        },
        {
          status: "idle",
          summary: "未找到可阅读帖子",
          decision: "idle",
        }
      );
      return;
    }

    recordWorkflowEvent(
      seed,
      {
        step: "opening_thread",
        action: "打开帖子详情",
        detail: `thread=${threadId}`,
        summary: `${seed.label} 正在打开帖子 ${threadId}`,
        threadId,
        tool: "open_thread",
      },
      {
        status: "reading",
        summary: `正在打开帖子 ${threadId}`,
      }
    );
    const threadPayload = await client.openThread({ threadId });
    recordWorkflowEvent(seed, {
      step: "opening_thread",
      action: "打开帖子详情",
      detail: threadPayload.thread.title,
      summary: `${seed.label} 已打开「${threadPayload.thread.title}」`,
      threadId,
      threadTitle: threadPayload.thread.title,
      tool: "open_thread",
    });
    recordWorkflowEvent(
      seed,
      {
        step: "reading_replies",
        action: "读取回复上下文",
        detail: `thread=${threadId}`,
        summary: `${seed.label} 正在读取回复上下文`,
        threadId,
        threadTitle: threadPayload.thread.title,
        tool: "get_replies",
      },
      {
        status: "reading",
        summary: `正在读取「${threadPayload.thread.title}」回复`,
      }
    );
    const repliesPayload = await client.getReplies({ threadId });
    recordWorkflowEvent(seed, {
      step: "reading_replies",
      action: "读取回复上下文",
      detail: `replies=${repliesPayload.replyCount}`,
      summary: `${seed.label} 已读取 ${repliesPayload.replyCount} 条回复上下文`,
      threadId,
      threadTitle: threadPayload.thread.title,
      tool: "get_replies",
    });

    updateInstance(seed.id, (instance) => {
      instance.currentThreadId = threadId;
      instance.currentThreadTitle = threadPayload.thread.title;
      instance.lastHeartbeatAt = formatIso();
      ensureWorkflowFields(instance);
      instance.workflow.targetThreadId = threadId;
      instance.workflow.targetThreadTitle = threadPayload.thread.title;
      instance.workflow.heartbeatAt = formatIso();
    });

    const nativeObserve = await executeNativeObserve(
      seed,
      bot,
      threadId,
      threadPayload.thread.title,
      currentSnapshot?.currentThreadId !== threadId
    );
    recordWorkflowEvent(seed, {
      step: "native_observe",
      action: "同步原生 OpenClaw 观察上下文",
      detail: `session=${nativeObserve.run.result?.meta?.agentMeta?.sessionId || "main"}`,
      summary: `${seed.label} 已将「${threadPayload.thread.title}」同步到 native transcript`,
      threadId,
      threadTitle: threadPayload.thread.title,
      tool: "native_observe",
    });

    if (!bot.canWrite) {
      recordWorkflowEvent(
        seed,
        {
          step: "read_only",
          action: "只读观察",
          detail: `thread=${threadPayload.thread.title}`,
          summary: `只读观察「${threadPayload.thread.title}」`,
          threadId,
          threadTitle: threadPayload.thread.title,
          tool: "observe_thread",
        },
        {
          status: "read_only",
          summary: `只读观察「${threadPayload.thread.title}」`,
          decision: "read_only",
          nextRunAt: formatIso(Date.now() + activeTickMs),
        }
      );
      updateInstance(seed.id, (instance) => {
        instance.stats.reads += 1;
      });
      return;
    }

    const fallbackTarget = chooseReplyTarget(bot, repliesPayload.replies ?? []);
    let target = fallbackTarget;
    try {
      const nativeTargetPlan = await executeNativeTargetPlan(seed, bot, threadPayload, repliesPayload);
      const normalizedTargetPlan = normalizeNativeTargetPlan(nativeTargetPlan.payload, repliesPayload);
      if (normalizedTargetPlan) {
        target = {
          ...fallbackTarget,
          ...normalizedTargetPlan,
        };
        recordWorkflowEvent(seed, {
          step: "planning_reply",
          action: "原生选择承接上下文",
          detail: `${target.targetKind || "thread"} ${target.reason || ""}`.trim(),
          summary: `${seed.label} 通过 native planner 选择了回帖承接上下文`,
          threadId,
          threadTitle: threadPayload.thread.title,
          tool: "native_plan_target",
        });
      }
    } catch (error) {
      recordWorkflowEvent(seed, {
        step: "planning_reply",
        action: "原生选择承接上下文失败，回退本地规则",
        detail: error instanceof Error ? error.message : String(error),
        summary: `${seed.label} 原生选 target 失败，回退本地规则`,
        status: "warn",
        threadId,
        threadTitle: threadPayload.thread.title,
        tool: "native_plan_target",
      });
    }
    let scopedReplies = null;
    if (target.floorId) {
      recordWorkflowEvent(
        seed,
        {
          step: "reading_replies",
          action: "读取楼层上下文",
          detail: `floor=${target.floorId}`,
          summary: `${seed.label} 正在补读楼层 ${target.floorId}`,
          threadId,
          threadTitle: threadPayload.thread.title,
          tool: "get_replies",
        },
        {
          status: "reading",
          summary: `正在补读「${threadPayload.thread.title}」局部上下文`,
        }
      );
      scopedReplies = await client.getReplies({
        threadId,
        floorId: target.floorId,
      });
      recordWorkflowEvent(seed, {
        step: "reading_replies",
        action: "读取楼层上下文",
        detail: `floor=${target.floorId} replies=${scopedReplies.replyCount}`,
        summary: `${seed.label} 已补读楼层 ${target.floorId} 的回复`,
        threadId,
        threadTitle: threadPayload.thread.title,
        tool: "get_replies",
      });
    }
    recordWorkflowEvent(
      seed,
      {
        step: "evaluating_policy",
        action: "检查节流与配额",
        detail: `actor=${bot.username}`,
        summary: `${seed.label} 正在检查 quota / cooldown`,
        threadId,
        threadTitle: threadPayload.thread.title,
        tool: "evaluate_policy",
      },
      {
        status: "reading",
        summary: `正在检查「${threadPayload.thread.title}」的节流策略`,
      }
    );
    const policy = evaluateBotAction({
      bot,
      threadId,
      approvalMode: effectiveApprovalMode === "manual" ? "auto" : effectiveApprovalMode,
      now: Date.now(),
      yoloModeEnabled: yoloMode.enabled,
    });

    if (!policy.ok) {
      recordBotAction({
        bot,
        threadId,
        status: policy.decision,
        content: "",
        target,
        approvalMode: effectiveApprovalMode,
        yoloModeEnabled: yoloMode.enabled,
      });

      recordWorkflowEvent(
        seed,
        {
          step: "blocked",
          action: "等待限制解除",
          detail: policy.reasons.join(" / ") || policy.decision,
          summary: policy.reasons.join(" / ") || policy.decision,
          status: "warn",
          threadId,
          threadTitle: threadPayload.thread.title,
          tool: "evaluate_policy",
        },
        {
          status: mapDecisionToInstanceStatus(policy.decision),
          summary: policy.reasons.join(" / ") || policy.decision,
          decision: policy.decision,
          nextRunAt: formatIso(Date.now() + activeTickMs),
        }
      );
      updateInstance(seed.id, (instance) => {
        instance.stats.blocked += 1;
      });
      return;
    }

    const memoryHighlights = listMemoryHighlights(seed.workspaceDir, 3);
    const seedReply = buildReplyContent(bot, threadPayload, repliesPayload.replyCount, target);
    const draftRepliesPayload = scopedReplies
      ? {
          ...repliesPayload,
          replyCount: scopedReplies.replyCount,
          replies: scopedReplies.replies,
        }
      : repliesPayload;
    let replyContextTrace = buildReplyContextTrace({
      bot,
      threadId,
      threadTitle: threadPayload.thread.title,
      threadPayload,
      repliesPayload: draftRepliesPayload,
      target,
      memoryHighlights,
      seedReply,
      source: "forum-context",
    });

    updateReplyContextTrace(seed.id, replyContextTrace);

    recordWorkflowEvent(
      seed,
      {
        step: "composing_reply",
        action: "生成回复草稿",
        detail: replyContextTrace.threadSummary || replyContextTrace.promptSummary,
        summary: `${seed.label} 正在根据 persona、thread 和 memory 生成回复草稿`,
        threadId,
        threadTitle: threadPayload.thread.title,
        tool: "native_draft_reply",
      },
      {
        status: "reading",
        summary: `正在生成「${threadPayload.thread.title}」回复草稿`,
      }
    );

    let replyContent = "";
    try {
      const nativeDraft = await executeNativeDraftReply(
        seed,
        bot,
        threadId,
        threadPayload.thread.title,
        replyContextTrace
      );
      const normalizedDraft = normalizeNativeReplyDraft(
        nativeDraft.payload,
        replyContextTrace,
        nativeDraft.run.result?.meta?.agentMeta?.sessionId || resolveNativeSessionId(seed)
      );
      replyContent = normalizedDraft.replyText;
      replyContextTrace = normalizeReplyContextTrace(
        {
          ...normalizedDraft.contextTrace,
          finalReply: normalizedDraft.replyText,
          posted: false,
          finalSource: "openclaw-native",
          generationSource: "openclaw-native",
          updatedAt: formatIso(),
        },
        replyContextTrace
      );
    } catch (error) {
      replyContextTrace = normalizeReplyContextTrace(
        {
          ...replyContextTrace,
          status: "error",
          source: "openclaw-native-error",
          finalSource: "openclaw-native-error",
          generationSource: "openclaw-native-error",
          finalReply: "",
          whyThisReply: clipText(error instanceof Error ? error.message : String(error), 120),
          basis: [
            "native draft failed before forum posting",
            clipText(error instanceof Error ? error.message : String(error), 120),
          ],
          updatedAt: formatIso(),
        },
        replyContextTrace
      );
      updateReplyContextTrace(seed.id, replyContextTrace);
      throw error;
    }
    updateReplyContextTrace(seed.id, replyContextTrace);

    recordWorkflowEvent(seed, {
      step: "composing_reply",
      action: "回复草稿已生成",
      detail: `${replyContextTrace.source}: ${replyContent}`,
      summary: `${seed.label} 已生成待发布回复草稿`,
      threadId,
      threadTitle: threadPayload.thread.title,
      tool: "native_draft_reply",
    });

    if (yoloMode.enabled) {
      recordWorkflowEvent(
        seed,
        {
          step: "yolo_mode",
          action: "YOLO Mode 跳过安全检查",
          detail: `expiresAt=${yoloMode.expiresAt}`,
          summary: `${seed.label} 在 YOLO Mode 下跳过 quota / cooldown / safety`,
          status: "warn",
          threadId,
          threadTitle: threadPayload.thread.title,
          tool: "yolo_mode",
        },
        {
          status: "reading",
          summary: `YOLO Mode 已放开「${threadPayload.thread.title}」回复限制`,
        }
      );
    } else {
      recordWorkflowEvent(
        seed,
        {
          step: "safety_check",
          action: "执行内容安全检查",
          detail: `replyLength=${replyContent.length} source=${replyContextTrace.source}`,
          summary: `${seed.label} 正在执行内容安全检查`,
          threadId,
          threadTitle: threadPayload.thread.title,
          tool: "content_safety_check",
        },
        {
          status: "reading",
          summary: `正在检查「${threadPayload.thread.title}」回复内容`,
        }
      );
      const safetyResult = evaluateReplyCandidate({
        actor: bot.username,
        content: replyContent,
        threadTitle: threadPayload.thread.title,
        rootContent: threadPayload.thread.rootPost?.content || "",
        existingReplies: collectReplyTexts(repliesPayload.replies ?? []),
        hasOpenedThread: true,
        hasReadReplies: true,
        replyCount: repliesPayload.replyCount,
      });

      if (!safetyResult.ok) {
        replyContextTrace = normalizeReplyContextTrace(
          {
            ...replyContextTrace,
            status: "blocked",
            whyThisReply: safetyResult.reasons.join(" / ") || "blocked by safety",
            basis: [
              ...(Array.isArray(replyContextTrace.basis) ? replyContextTrace.basis.slice(0, 3) : []),
              clipText(safetyResult.reasons.join(" / ") || "blocked by safety", 120),
            ].slice(0, 4),
            updatedAt: formatIso(),
          },
          replyContextTrace
        );
        updateReplyContextTrace(seed.id, replyContextTrace);
        recordWorkflowEvent(
          seed,
          {
            step: "blocked",
            action: "安全检查拦截",
            detail: safetyResult.reasons.join(" / ") || "blocked by safety",
            summary: safetyResult.reasons.join(" / ") || "blocked by safety",
            status: "warn",
            threadId,
            threadTitle: threadPayload.thread.title,
            tool: "content_safety_check",
          },
          {
            status: "blocked",
            summary: safetyResult.reasons.join(" / ") || "blocked by safety",
            decision: "blocked",
            nextRunAt: formatIso(Date.now() + activeTickMs),
          }
        );
        updateInstance(seed.id, (instance) => {
          instance.stats.blocked += 1;
        });
        return;
      }
    }

    if (effectiveApprovalMode === "manual" && !yoloMode.enabled) {
      const approvalId = `approval_${randomUUID()}`;
      const approval = createApprovalRequest({
        bot,
        instanceId: seed.id,
        threadId,
        threadTitle: threadPayload.thread.title,
        content: replyContent,
        target,
        approvalMode: effectiveApprovalMode,
        requestedBy: "native-runtime",
        source: "openclaw-native",
        auditId: approvalId,
        whyThisReply: replyContextTrace.whyThisReply || "",
        memoryApplied: replyContextTrace.memoryApplied || "",
        replyContextTrace: normalizeReplyContextTrace(
          {
            ...replyContextTrace,
            finalReply: replyContent,
            updatedAt: formatIso(),
          },
          replyContextTrace
        ),
      });
      updateReplyContextTrace(seed.id, approval.replyContextTrace || replyContextTrace);
      recordWorkflowEvent(
        seed,
        {
          step: "awaiting_approval",
          action: "生成待审批写入草稿",
          detail: approvalId,
          summary: `${seed.label} 已生成待审批回复草稿`,
          status: "warn",
          threadId,
          threadTitle: threadPayload.thread.title,
          tool: "approval_queue",
        },
        {
          status: "awaiting_approval",
          summary: `${seed.label} 正在等待审批后发布`,
          decision: "awaiting_approval",
          nextRunAt: formatIso(Date.now() + activeTickMs),
        }
      );
      return;
    }

    recordWorkflowEvent(
      seed,
      {
        step: "replying",
        action: "发送回复",
        detail: `${replyContextTrace.source}: ${replyContent}`,
        summary: `${seed.label} 正在回复「${threadPayload.thread.title}」`,
        threadId,
        threadTitle: threadPayload.thread.title,
        tool: "reply",
      },
      {
        status: "replying",
        summary: `正在回复「${threadPayload.thread.title}」`,
      }
    );
    const postedReply = await executeNativePostReply(
      seed,
      bot,
      threadId,
      threadPayload.thread.title,
      replyContent,
      target
    );
    recordWorkflowEvent(seed, {
      step: "replied",
      action: "回复已发布",
      detail: `actor=${postedReply.payload?.actor || bot.username}`,
      summary: `${postedReply.payload?.actor || bot.username} 已在「${threadPayload.thread.title}」完成回帖`,
      threadId,
      threadTitle: threadPayload.thread.title,
      tool: "reply",
    });

    recordBotAction({
      bot,
      threadId,
      auditId: `runtime_${randomUUID()}`,
      status: "replied",
      content: replyContent,
      target,
      approvalMode: effectiveApprovalMode,
      yoloModeEnabled: yoloMode.enabled,
    });

    updateReplyContextTrace(seed.id, {
      ...replyContextTrace,
      updatedAt: formatIso(),
      posted: true,
      postedAt: formatIso(),
    });

    recordWorkflowEvent(
      seed,
      {
        step: "idle",
        action: "等待下一轮调度",
        detail: `${bot.username} 已在「${threadPayload.thread.title}」回帖`,
        summary: `${bot.username} 已在「${threadPayload.thread.title}」回帖`,
        threadId,
        threadTitle: threadPayload.thread.title,
        tool: "cycle_complete",
      },
      {
          status: "replied",
          summary: `${bot.username} 已在「${threadPayload.thread.title}」回帖`,
          decision: "replied",
          nextRunAt: formatIso(Date.now() + activeTickMs),
        }
      );
    updateInstance(seed.id, (instance) => {
      instance.stats.replies += 1;
      instance.stats.reads += 1;
    });
  }

  async function runSerializedInstanceTask(instanceId, task) {
    const previousRun = runningInstances.get(instanceId) || Promise.resolve();
    const nextRun = previousRun
      .catch(() => {})
      .then(task)
      .finally(() => {
        if (runningInstances.get(instanceId) === nextRun) {
          runningInstances.delete(instanceId);
        }
      });
    runningInstances.set(instanceId, nextRun);
    return nextRun;
  }

  async function runSerializedInstanceCycle(seed, reason = "interval", options = {}) {
    const nextRun = runSerializedInstanceTask(seed.id, () =>
      runInstanceCycle(seed, reason, options)
    );
    return nextRun;
  }

  async function tick(reason = "interval") {
    if (runningTick) {
      return runningTick;
    }

    runningTick = (async () => {
      const seeds = ensureStateInitialized();

      updateOpenClawOrchestratorState((state) => {
        state.global.status = state.global.paused ? "paused" : "running";
        state.global.lastRunReason = reason;
        state.global.lastTickAt = formatIso();
        if (!state.global.startedAt) {
          state.global.startedAt = formatIso();
        }
        state.global.yoloMode = computeYoloModeView(state.global.yoloMode);
      });

      expireYoloModeIfNeeded();
      const currentState = readOpenClawOrchestratorState();
      if (currentState.global.paused && reason !== "manual") {
        return currentState;
      }
      const activeTickMs = getEffectiveTickMs(currentState);

      for (const seed of seeds) {
        const instance = readOpenClawOrchestratorState().instances[seed.id];
        if (!instance || instance.paused) {
          continue;
        }

        if (instance.nextRunAt && Date.parse(instance.nextRunAt) > Date.now() && reason !== "manual") {
          continue;
        }

        try {
          await runSerializedInstanceCycle(seed, reason);
        } catch (error) {
          recordWorkflowEvent(
            seed,
            {
              step: "error",
              action: "本轮执行失败",
              detail: error instanceof Error ? error.message : String(error),
              summary: error instanceof Error ? error.message : String(error),
              status: "error",
              tool: "orchestrator_error",
            },
            {
              status: "error",
              summary: error instanceof Error ? error.message : String(error),
              decision: "error",
              error: error instanceof Error ? error.message : String(error),
              nextRunAt: formatIso(Date.now() + activeTickMs),
            }
          );
          updateInstance(seed.id, (draft, state) => {
            draft.status = "error";
            draft.online = true;
            draft.lastError = error instanceof Error ? error.message : String(error);
            draft.lastSummary = draft.lastError;
            draft.lastDecision = "error";
            draft.lastHeartbeatAt = formatIso();
            draft.lastTransitionAt = formatIso();
            draft.nextRunAt = formatIso(Date.now() + activeTickMs);
            draft.stats.errors += 1;
            state.global.lastError = draft.lastError;
          });
        }
      }

      refreshGlobalNativeRuntime();
      return readOpenClawOrchestratorState();
    })().finally(() => {
      runningTick = null;
    });

    return runningTick;
  }

  function start() {
    ensureStateInitialized();

    if (!autoStart) {
      updateOpenClawOrchestratorState((state) => {
        state.global.status = "paused";
        state.global.paused = true;
        state.global.pausedReason = "FORUM_OPENCLAW_AUTOSTART=false";
      });
      return;
    }

    if (intervalId) {
      return;
    }

    if (!bootstrapped) {
      bootstrapped = true;
      setTimeout(() => {
        tick("startup").catch(() => {});
      }, 500);
    }

    resetInterval(true);

    updateOpenClawOrchestratorState((state) => {
      state.global.status = "running";
      state.global.paused = false;
      state.global.pausedReason = "";
      if (!state.global.startedAt) {
        state.global.startedAt = formatIso();
      }
    });
  }

  function stop() {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
    intervalMs = 0;

    updateOpenClawOrchestratorState((state) => {
      state.global.status = "stopped";
    });
  }

  function pause(reason = "manual_pause") {
    updateOpenClawOrchestratorState((state) => {
      state.global.paused = true;
      state.global.status = "paused";
      state.global.pausedReason = reason;
    });
  }

  function resume() {
    updateOpenClawOrchestratorState((state) => {
      state.global.paused = false;
      state.global.status = intervalId ? "running" : "stopped";
      state.global.pausedReason = "";
    });

    if (autoStart) {
      if (!intervalId) {
        start();
      } else {
        resetInterval(true);
      }
    }
  }

  function pauseInstance(instanceId) {
    const snapshot = readOpenClawOrchestratorState().instances[instanceId];
    if (!snapshot) {
      return;
    }

    updateInstance(instanceId, (instance) => {
      ensureWorkflowFields(instance);
      instance.paused = true;
      instance.status = "paused";
      instance.lastSummary = "实例已手动暂停";
      instance.lastDecision = "paused";
      instance.lastTransitionAt = formatIso();
      instance.workflow.currentStep = "paused";
      instance.workflow.currentAction = "实例已暂停";
      instance.workflow.currentDetail = "等待手动恢复";
      instance.workflow.startedAt = formatIso();
      instance.workflow.heartbeatAt = formatIso();
      instance.recentEvents = [
        createWorkflowEvent({
          step: "paused",
          action: "实例已暂停",
          detail: "等待手动恢复",
          summary: "实例已手动暂停",
        }),
        ...instance.recentEvents,
      ].slice(0, 12);
    });
  }

  function resumeInstance(instanceId) {
    updateInstance(instanceId, (instance) => {
      ensureWorkflowFields(instance);
      instance.paused = false;
      instance.status = "idle";
      instance.lastSummary = "实例已恢复调度";
      instance.lastDecision = "resumed";
      instance.lastTransitionAt = formatIso();
      instance.nextRunAt = formatIso();
      instance.workflow.currentStep = "idle";
      instance.workflow.currentAction = "等待下一轮调度";
      instance.workflow.currentDetail = "实例已恢复调度";
      instance.workflow.startedAt = formatIso();
      instance.workflow.heartbeatAt = formatIso();
      instance.recentEvents = [
        createWorkflowEvent({
          step: "idle",
          action: "实例已恢复",
          detail: "等待下一轮调度",
          summary: "实例已恢复调度",
        }),
        ...instance.recentEvents,
      ].slice(0, 12);
    });
  }

  async function runOnce() {
    return tick("manual");
  }

  async function runInstanceOnce(instanceId, options = {}) {
    const snapshot = readOpenClawOrchestratorState().instances[instanceId];
    if (!snapshot) {
      throw new Error(`Unknown instance: ${instanceId}`);
    }
    if (snapshot.paused) {
      throw new Error(`Instance paused: ${instanceId}`);
    }

    const seed = buildSeeds().find((item) => item.id === instanceId);
    if (!seed) {
      throw new Error(`Seed not found for instance: ${instanceId}`);
    }

    await runSerializedInstanceCycle(seed, "manual_instance", options);
    refreshGlobalNativeRuntime();
    return getDashboard();
  }

  async function approvePendingApproval(approvalId, actor = "admin", note = "") {
    const approval = listApprovalRequests({ onlyPending: true }).find((entry) => entry.id === approvalId);
    if (!approval) {
      throw new Error(`Pending approval not found: ${approvalId}`);
    }

    const bot = getBotAccountByUsername(approval.botUsername);
    if (!bot) {
      throw new Error(`Unknown bot for approval: ${approval.botUsername}`);
    }

    const seed = buildSeeds().find((item) => item.id === approval.instanceId || item.botUsername === approval.botUsername);
    if (!seed) {
      throw new Error(`Seed not found for approval: ${approvalId}`);
    }

    if (!approval.threadId) {
      throw new Error("Only reply approvals are supported right now");
    }

    const client = createInstanceClient(bot);
    const postedReply = await runSerializedInstanceTask(seed.id, () =>
      client.reply({
        threadId: approval.threadId,
        content: approval.content,
        floorId: approval.target?.floorId || undefined,
        replyId: approval.target?.replyId || undefined,
        username: bot.username,
        password: bot.password,
      })
    );
    const execution = {
      mode: "reply-thread",
      actor: postedReply.actor?.username || bot.username,
      threadId: approval.threadId,
      threadTitle: approval.threadTitle || approval.threadId,
      executedAt: formatIso(),
      sessionId:
        approval.replyContextTrace?.nativeSessionId || resolveNativeSessionId(seed),
    };

    resolveApprovalRequest({
      approvalId,
      decision: "approve",
      actor,
      note,
      execution,
    });
    recordBotAction({
      bot,
      threadId: approval.threadId,
      auditId: approval.auditId || approvalId,
      status: "replied",
      content: approval.content,
      target: approval.target || {},
      approvalMode: approval.approvalMode || "manual",
      yoloModeEnabled: false,
    });
    updateReplyContextTrace(seed.id, {
      ...(approval.replyContextTrace || createInitialReplyContextTrace()),
      finalReply: approval.content,
      posted: true,
      updatedAt: formatIso(),
      postedAt: formatIso(),
      finalSource: "openclaw-native",
      generationSource:
        approval.replyContextTrace?.generationSource ||
        approval.replyContextTrace?.source ||
        "openclaw-native",
    });
    recordWorkflowEvent(
      seed,
      {
        step: "replied",
        action: "审批后发布回复",
        detail: approvalId,
        summary: `${seed.label} 的待审批回复已发布`,
        threadId: approval.threadId,
        threadTitle: approval.threadTitle || approval.threadId,
        tool: "approval_execute",
      },
      {
        status: "replied",
        summary: `${seed.label} 的待审批回复已发布`,
        decision: "replied",
        nextRunAt: formatIso(Date.now() + getEffectiveTickMs()),
      }
    );
  }

  function rejectPendingApproval(approvalId, actor = "admin", note = "") {
    const approval = listApprovalRequests({ onlyPending: true }).find((entry) => entry.id === approvalId);
    if (!approval) {
      throw new Error(`Pending approval not found: ${approvalId}`);
    }

    resolveApprovalRequest({
      approvalId,
      decision: "reject",
      actor,
      note,
    });
    const seed = buildSeeds().find((item) => item.id === approval.instanceId || item.botUsername === approval.botUsername);
    if (seed) {
      recordWorkflowEvent(
        seed,
        {
          step: "blocked",
          action: "审批已拒绝",
          detail: approvalId,
          summary: `${seed.label} 的待审批回复已拒绝`,
          status: "warn",
          threadId: approval.threadId,
          threadTitle: approval.threadTitle || approval.threadId,
          tool: "approval_reject",
        },
        {
          status: "blocked",
          summary: `${seed.label} 的待审批回复已拒绝`,
          decision: "rejected",
          nextRunAt: formatIso(Date.now() + getEffectiveTickMs()),
        }
      );
    }
  }

  function getDashboard() {
    ensureStateInitialized();
    expireYoloModeIfNeeded();
    const state = readOpenClawOrchestratorState();
    const yoloMode = computeYoloModeView(state.global?.yoloMode);
    refreshGlobalNativeRuntime();
    const refreshedState = readOpenClawOrchestratorState();
    const instances = Object.values(refreshedState.instances)
      .sort((left, right) => Number(left.sortOrder ?? 0) - Number(right.sortOrder ?? 0))
      .map((instance) => {
        ensureWorkflowFields(instance);
        ensureReplyContextTraceFields(instance);
        ensureNativeRuntimeFields(instance);
        const quota = buildQuotaSnapshot(instance);
        const schedulerOnline =
          Boolean(instance.lastHeartbeatAt) &&
          Date.now() - Date.parse(instance.lastHeartbeatAt) <= Math.max(tickMs * 3, 30000);
        const nativeOnline =
          isTimestampRecent(
            instance.nativeHeartbeatAt || instance.nativeRuntime?.lastHeartbeatAt || "",
            Math.max(getEffectiveTickMs(refreshedState) * 3, 30000)
          ) || ["running", "idle"].includes(instance.nativeStatus);
        const online = nativeOnline || schedulerOnline;
        const forumActive = ["reading", "replying", "replied"].includes(instance.status);
        const nativeActive = instance.nativeStatus === "running";
        const observedActive = nativeActive || forumActive;

        return {
          ...instance,
          schedulerOnline,
          online,
          observedActive,
          onlineSource: resolvePresenceSource(nativeOnline, schedulerOnline),
          activitySource: resolvePresenceSource(nativeActive, forumActive),
          primaryTimelineSource:
            instance.nativeRuntime?.runCount > 0 || instance.nativeSessionId ? "native" : instance.recentEvents?.length ? "forum" : "none",
          quota,
        };
      });

    const summary = {
      total: instances.length,
      online: instances.filter((instance) => instance.online).length,
      schedulerOnline: instances.filter((instance) => instance.schedulerOnline).length,
      writable: instances.filter((instance) => instance.canWrite).length,
      active: instances.filter((instance) => instance.observedActive).length,
      observedActive: instances.filter((instance) => instance.observedActive).length,
      paused: instances.filter((instance) => instance.status === "paused").length,
      blocked: instances.filter((instance) =>
        ["blocked", "cooling_down", "awaiting_approval"].includes(instance.status)
      ).length,
    };
    const approvals = listApprovalRequests({ onlyPending: false });

    return {
      ...refreshedState.global,
      nativeRuntime: refreshedState.global.nativeRuntime,
      yoloMode,
      lifecycle: {
        sourceOfTruth: "openclaw-native+forum-domain",
        schedulerRole: "compatibility-layer",
        turnDriver: "forum_scheduler_requests_native_plan_and_draft",
        workingDirectoryMode: "instance-openclaw-root",
        nativePreferred: true,
      },
      statePath: getOpenClawOrchestratorStatePath(),
      origin,
      approvalMode,
      instances,
      approvals,
      summary,
    };
  }

  async function performAction(action, instanceId, options = {}) {
    if (action === "pause") {
      pause();
      return getDashboard();
    }

    if (action === "resume") {
      resume();
      return getDashboard();
    }

    if (action === "run_once") {
      await runOnce();
      return getDashboard();
    }

    if (action === "run_instance_once" && instanceId) {
      return runInstanceOnce(instanceId, {
        threadIdOverride: options.threadId || "",
      });
    }

    if (action === "queue_instance_approval" && instanceId) {
      return runInstanceOnce(instanceId, {
        approvalModeOverride: "manual",
        threadIdOverride: options.threadId || "",
      });
    }

    if (action === "start_yolo") {
      startYoloMode({
        durationMs: options.durationMs,
        actor: options.actor,
        reason: options.reason || "manual_start",
      });
      runOnce().catch(() => {});
      return getDashboard();
    }

    if (action === "stop_yolo") {
      stopYoloMode({
        actor: options.actor || "admin",
        reason: options.reason || "manual_stop",
      });
      return getDashboard();
    }

    if (action === "approve_approval" && options.approvalId) {
      await approvePendingApproval(options.approvalId, options.actor || "admin", options.note || "");
      return getDashboard();
    }

    if (action === "reject_approval" && options.approvalId) {
      rejectPendingApproval(options.approvalId, options.actor || "admin", options.note || "");
      return getDashboard();
    }

    if (action === "pause_instance" && instanceId) {
      pauseInstance(instanceId);
      return getDashboard();
    }

    if (action === "resume_instance" && instanceId) {
      resumeInstance(instanceId);
      return getDashboard();
    }

    throw new Error(`Unsupported action: ${action}`);
  }

  return {
    start,
    stop,
    getDashboard,
    performAction,
  };
}

let singletonService = null;

export function getOpenClawOrchestrator(options = {}) {
  if (!singletonService) {
    singletonService = createService(options);
  }

  return singletonService;
}
