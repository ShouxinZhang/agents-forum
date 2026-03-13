import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const runtimeDir = process.env.FORUM_API_RUNTIME_DIR
  ? path.resolve(process.env.FORUM_API_RUNTIME_DIR)
  : path.resolve(moduleDir, "../../../../.runtime");
const botPolicyStatePath = path.join(runtimeDir, "forum-bot-state.json");

function ensureRuntimeDir() {
  fs.mkdirSync(runtimeDir, { recursive: true });
}

function getDateKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function normalizeApprovalEntry(entry = {}, username = "") {
  return {
    id: typeof entry.id === "string" && entry.id.trim() ? entry.id : `approval-${Date.now()}`,
    status:
      entry.status === "approved" || entry.status === "rejected" || entry.status === "executed"
        ? entry.status
        : "pending",
    botUsername:
      typeof entry.botUsername === "string" && entry.botUsername.trim()
        ? entry.botUsername
        : username,
    instanceId: typeof entry.instanceId === "string" ? entry.instanceId : "",
    threadId: typeof entry.threadId === "string" ? entry.threadId : "",
    threadTitle: typeof entry.threadTitle === "string" ? entry.threadTitle : "",
    sectionId: typeof entry.sectionId === "string" ? entry.sectionId : "",
    title: typeof entry.title === "string" ? entry.title : "",
    content: typeof entry.content === "string" ? entry.content : "",
    target: typeof entry.target === "object" && entry.target ? entry.target : {},
    approvalMode: typeof entry.approvalMode === "string" ? entry.approvalMode : "manual",
    timestamp: typeof entry.timestamp === "string" ? entry.timestamp : new Date().toISOString(),
    requestedBy: typeof entry.requestedBy === "string" ? entry.requestedBy : "",
    source: typeof entry.source === "string" ? entry.source : "forum-orchestrator",
    instruction: typeof entry.instruction === "string" ? entry.instruction : "",
    note: typeof entry.note === "string" ? entry.note : "",
    auditId: typeof entry.auditId === "string" ? entry.auditId : "",
    whyThisReply: typeof entry.whyThisReply === "string" ? entry.whyThisReply : "",
    memoryApplied: typeof entry.memoryApplied === "string" ? entry.memoryApplied : "",
    replyContextTrace:
      typeof entry.replyContextTrace === "object" && entry.replyContextTrace
        ? entry.replyContextTrace
        : null,
    resolvedAt: typeof entry.resolvedAt === "string" ? entry.resolvedAt : "",
    resolvedBy: typeof entry.resolvedBy === "string" ? entry.resolvedBy : "",
    resolutionNote: typeof entry.resolutionNote === "string" ? entry.resolutionNote : "",
    execution: typeof entry.execution === "object" && entry.execution ? entry.execution : null,
  };
}

function createInitialState() {
  return {
    version: 2,
    bots: {},
  };
}

function normalizeState(state) {
  const normalized = state && typeof state === "object" ? state : createInitialState();
  normalized.version = 2;
  normalized.bots ||= {};

  for (const [username, bucket] of Object.entries(normalized.bots)) {
    const normalizedBucket = bucket && typeof bucket === "object" ? bucket : {};
    normalizedBucket.days ||= {};
    normalizedBucket.threads ||= {};
    normalizedBucket.approvals = Array.isArray(normalizedBucket.approvals)
      ? normalizedBucket.approvals.map((entry) => normalizeApprovalEntry(entry, username))
      : [];
    normalized.bots[username] = normalizedBucket;
  }

  return normalized;
}

export function readBotRuntimeState() {
  if (!fs.existsSync(botPolicyStatePath)) {
    return createInitialState();
  }

  try {
    return normalizeState(JSON.parse(fs.readFileSync(botPolicyStatePath, "utf8")));
  } catch {
    return createInitialState();
  }
}

function writeBotRuntimeState(state) {
  ensureRuntimeDir();
  fs.writeFileSync(botPolicyStatePath, `${JSON.stringify(normalizeState(state), null, 2)}\n`, "utf8");
}

function getBotBucket(state, username) {
  if (!state.bots[username]) {
    state.bots[username] = {
      days: {},
      threads: {},
      approvals: [],
    };
  }

  return state.bots[username];
}

function pickQuota(bot) {
  return Number.isFinite(bot.dailyReplyQuota) ? bot.dailyReplyQuota : 1;
}

function pickCooldown(bot) {
  return Number.isFinite(bot.sameThreadCooldownMs) ? bot.sameThreadCooldownMs : 0;
}

export function evaluateBotAction({
  bot,
  threadId,
  approvalMode = "auto",
  now = Date.now(),
  yoloModeEnabled = false,
}) {
  const state = readBotRuntimeState();
  const bucket = getBotBucket(state, bot.username);
  const dayKey = getDateKey(new Date(now));
  const dayBucket = bucket.days[dayKey] ?? { replyCount: 0, yoloReplyCount: 0 };
  const dayCount = dayBucket.replyCount ?? 0;
  const threadState = bucket.threads[threadId] ?? null;
  const quota = pickQuota(bot);
  const cooldownMs = pickCooldown(bot);

  if (!bot.canWrite) {
    return {
      ok: false,
      decision: "read_only",
      reasons: ["bot policy is read-only"],
      quota,
      cooldownMs,
      dayCount,
    };
  }

  if (yoloModeEnabled) {
    return {
      ok: true,
      decision: "yolo_allow",
      reasons: [],
      quota,
      cooldownMs,
      dayCount,
      yoloModeEnabled: true,
      yoloReplyCount: dayBucket.yoloReplyCount ?? 0,
    };
  }

  if (dayCount >= quota) {
    return {
      ok: false,
      decision: "quota_exceeded",
      reasons: [`daily quota reached: ${dayCount}/${quota}`],
      quota,
      cooldownMs,
      dayCount,
    };
  }

  if (threadState?.lastReplyAt && cooldownMs > 0) {
    const remainingMs = threadState.lastReplyAt + cooldownMs - now;
    if (remainingMs > 0) {
      return {
        ok: false,
        decision: "cooldown",
        reasons: [`same-thread cooldown active: ${remainingMs}ms remaining`],
        quota,
        cooldownMs,
        dayCount,
        remainingMs,
      };
    }
  }

  if (approvalMode === "manual") {
    return {
      ok: false,
      decision: "awaiting_approval",
      reasons: ["manual approval mode enabled"],
      quota,
      cooldownMs,
      dayCount,
    };
  }

  return {
    ok: true,
    decision: "allow",
    reasons: [],
    quota,
    cooldownMs,
    dayCount,
  };
}

export function recordBotAction({
  bot,
  threadId,
  auditId,
  status,
  content,
  target = {},
  approvalMode = "auto",
  now = Date.now(),
  yoloModeEnabled = false,
}) {
  const state = readBotRuntimeState();
  const bucket = getBotBucket(state, bot.username);
  const dayKey = getDateKey(new Date(now));

  if (!bucket.days[dayKey]) {
    bucket.days[dayKey] = {
      replyCount: 0,
      yoloReplyCount: 0,
    };
  }

  if (status === "replied") {
    if (yoloModeEnabled) {
      bucket.days[dayKey].yoloReplyCount += 1;
      bucket.threads[threadId] = {
        ...bucket.threads[threadId],
        lastYoloReplyAt: now,
        lastYoloAuditId: auditId ?? "",
        lastTarget: target,
      };
    } else {
      bucket.days[dayKey].replyCount += 1;
      bucket.threads[threadId] = {
        ...bucket.threads[threadId],
        lastReplyAt: now,
        lastAuditId: auditId ?? "",
        lastTarget: target,
      };
    }
  }

  if (status === "awaiting_approval") {
    bucket.approvals.unshift({
      id: auditId ?? `approval-${now}`,
      status: "pending",
      botUsername: bot.username,
      threadId,
      content,
      target,
      approvalMode,
      timestamp: new Date(now).toISOString(),
    });
    bucket.approvals = bucket.approvals.slice(0, 20);
  }

  writeBotRuntimeState(state);
  return state;
}

export function createApprovalRequest({
  bot,
  instanceId = "",
  threadId = "",
  threadTitle = "",
  sectionId = "",
  title = "",
  content = "",
  target = {},
  approvalMode = "manual",
  requestedBy = "",
  source = "openclaw-native",
  instruction = "",
  note = "",
  auditId = "",
  whyThisReply = "",
  memoryApplied = "",
  replyContextTrace = null,
  now = Date.now(),
}) {
  const state = readBotRuntimeState();
  const bucket = getBotBucket(state, bot.username);
  const approval = normalizeApprovalEntry(
    {
      id: auditId || `approval-${now}`,
      status: "pending",
      botUsername: bot.username,
      instanceId,
      threadId,
      threadTitle,
      sectionId,
      title,
      content,
      target,
      approvalMode,
      timestamp: new Date(now).toISOString(),
      requestedBy,
      source,
      instruction,
      note,
      auditId,
      whyThisReply,
      memoryApplied,
      replyContextTrace,
    },
    bot.username
  );
  bucket.approvals.unshift(approval);
  bucket.approvals = bucket.approvals.slice(0, 40);
  writeBotRuntimeState(state);
  return approval;
}

export function listApprovalRequests(options = {}) {
  const onlyPending = options.onlyPending !== false;
  const state = readBotRuntimeState();
  const approvals = Object.entries(state.bots).flatMap(([username, bucket]) =>
    (Array.isArray(bucket?.approvals) ? bucket.approvals : []).map((entry) =>
      normalizeApprovalEntry(entry, username)
    )
  );

  return approvals
    .filter((entry) => (onlyPending ? entry.status === "pending" : true))
    .sort((left, right) => String(right.timestamp).localeCompare(String(left.timestamp)));
}

export function resolveApprovalRequest({
  approvalId,
  decision,
  actor = "",
  note = "",
  execution = null,
  now = Date.now(),
}) {
  const state = readBotRuntimeState();
  let resolved = null;

  for (const [username, bucket] of Object.entries(state.bots)) {
    if (!Array.isArray(bucket?.approvals)) {
      continue;
    }

    const index = bucket.approvals.findIndex((entry) => entry?.id === approvalId);
    if (index < 0) {
      continue;
    }

    const status =
      decision === "approve" ? (execution ? "executed" : "approved") : "rejected";
    const approval = normalizeApprovalEntry(bucket.approvals[index], username);
    const nextApproval = normalizeApprovalEntry(
      {
        ...approval,
        status,
        resolvedAt: new Date(now).toISOString(),
        resolvedBy: actor,
        resolutionNote: note,
        execution,
      },
      username
    );
    bucket.approvals[index] = nextApproval;
    resolved = nextApproval;
    break;
  }

  if (!resolved) {
    throw new Error(`Approval request not found: ${approvalId}`);
  }

  writeBotRuntimeState(state);
  return resolved;
}

export function getBotPolicyStatePath() {
  return botPolicyStatePath;
}
