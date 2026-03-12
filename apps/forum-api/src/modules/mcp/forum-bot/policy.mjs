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

function createInitialState() {
  return {
    version: 1,
    bots: {},
  };
}

export function readBotRuntimeState() {
  if (!fs.existsSync(botPolicyStatePath)) {
    return createInitialState();
  }

  try {
    return JSON.parse(fs.readFileSync(botPolicyStatePath, "utf8"));
  } catch {
    return createInitialState();
  }
}

function writeBotRuntimeState(state) {
  ensureRuntimeDir();
  fs.writeFileSync(botPolicyStatePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
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
}) {
  const state = readBotRuntimeState();
  const bucket = getBotBucket(state, bot.username);
  const dayKey = getDateKey(new Date(now));
  const dayCount = bucket.days[dayKey]?.replyCount ?? 0;
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
}) {
  const state = readBotRuntimeState();
  const bucket = getBotBucket(state, bot.username);
  const dayKey = getDateKey(new Date(now));

  if (!bucket.days[dayKey]) {
    bucket.days[dayKey] = {
      replyCount: 0,
    };
  }

  if (status === "replied") {
    bucket.days[dayKey].replyCount += 1;
    bucket.threads[threadId] = {
      lastReplyAt: now,
      lastAuditId: auditId ?? "",
      lastTarget: target,
    };
  }

  if (status === "awaiting_approval") {
    bucket.approvals.unshift({
      id: auditId ?? `approval-${now}`,
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

export function getBotPolicyStatePath() {
  return botPolicyStatePath;
}
