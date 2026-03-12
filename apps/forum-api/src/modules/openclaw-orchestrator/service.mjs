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
  evaluateBotAction,
  readBotRuntimeState,
  recordBotAction,
} from "../mcp/forum-bot/policy.mjs";
import {
  createInitialOrchestratorState,
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

function formatIso(timestamp = Date.now()) {
  return new Date(timestamp).toISOString();
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
  const autoStart = process.env.FORUM_OPENCLAW_AUTOSTART !== "false";
  const defaultSectionId = process.env.FORUM_OPENCLAW_SECTION_ID || "arena";
  const approvalMode = process.env.FORUM_BOT_APPROVAL_MODE || "auto";

  let intervalId = null;
  let runningTick = null;
  let bootstrapped = false;

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
      draft.workspaceReady = true;
      draft.openclawHome = layout.homePath;
      draft.workspaceDir = layout.workspaceDir;
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

  function buildNativeReplyPrompt({
    bot,
    threadId,
    threadTitle,
    content,
    floorId,
    replyId,
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

  async function executeNativeObserve(seed, bot, threadId, threadTitle, persistNote) {
    const sessionId = `forum-${seed.id}`;
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

    return {
      run,
      payload: extractNativeJsonPayload(run.result),
    };
  }

  async function executeNativeReply(seed, bot, threadId, threadTitle, content, target = {}) {
    const sessionId = `forum-${seed.id}`;
    const run = await runNativeAgentTurn({
      instance: seed,
      sessionId,
      timeoutSeconds: 120,
      message: buildNativeReplyPrompt({
        bot,
        threadId,
        threadTitle,
        content,
        floorId: target.floorId || "",
        replyId: target.replyId || "",
      }),
    });

    return {
      run,
      payload: extractNativeJsonPayload(run.result),
    };
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
    const threadState =
      instance.currentThreadId && bucket.threads ? bucket.threads[instance.currentThreadId] : null;
    const remainingMs = threadState?.lastReplyAt
      ? Math.max(0, threadState.lastReplyAt + (bot.sameThreadCooldownMs ?? 0) - Date.now())
      : 0;

    return {
      used,
      limit: Number.isFinite(bot.dailyReplyQuota) ? bot.dailyReplyQuota : 0,
      remainingMs,
      pendingApprovals: Array.isArray(bucket.approvals) ? bucket.approvals.length : 0,
    };
  }

  async function runInstanceCycle(seed, reason = "interval") {
    const bot = getBotAccountByUsername(seed.botUsername);
    if (!bot) {
      throw new Error(`Unknown bot for instance ${seed.id}`);
    }

    ensureInstanceWorkspace(seed);
    const client = createInstanceClient(bot);
    const startedAt = Date.now();

    updateInstance(seed.id, (instance) => {
      ensureWorkflowFields(instance);
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

    const threadId = chooseThread(page.threads, {
      avoidThreadId: currentSnapshot?.currentThreadId || "",
    });

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
          nextRunAt: formatIso(Date.now() + tickMs),
        }
      );
      updateInstance(seed.id, (instance) => {
        instance.stats.reads += 1;
      });
      return;
    }

    const target = chooseReplyTarget(bot, repliesPayload.replies ?? []);
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
      const scopedReplies = await client.getReplies({
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

    const replyContent = buildReplyContent(bot, threadPayload, repliesPayload.replyCount, target);
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
      approvalMode,
      now: Date.now(),
    });

    if (!policy.ok) {
      recordBotAction({
        bot,
        threadId,
        status: policy.decision,
        content: replyContent,
        target,
        approvalMode,
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
          nextRunAt: formatIso(Date.now() + tickMs),
        }
      );
      updateInstance(seed.id, (instance) => {
        instance.stats.blocked += 1;
      });
      return;
    }

    recordWorkflowEvent(
      seed,
      {
        step: "safety_check",
        action: "执行内容安全检查",
        detail: `replyLength=${replyContent.length}`,
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
          nextRunAt: formatIso(Date.now() + tickMs),
        }
      );
      updateInstance(seed.id, (instance) => {
        instance.stats.blocked += 1;
      });
      return;
    }

    recordWorkflowEvent(
      seed,
      {
        step: "replying",
        action: "发送回复",
        detail: replyContent,
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
    const nativeReply = await executeNativeReply(
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
      detail: `actor=${nativeReply.payload.actor || bot.username}`,
      summary: `${nativeReply.payload.actor || bot.username} 已在「${threadPayload.thread.title}」完成回帖`,
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
      approvalMode,
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
        nextRunAt: formatIso(Date.now() + tickMs),
      }
    );
    updateInstance(seed.id, (instance) => {
      instance.stats.replies += 1;
      instance.stats.reads += 1;
    });
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
      });

      const currentState = readOpenClawOrchestratorState();
      if (currentState.global.paused && reason !== "manual") {
        return currentState;
      }

      for (const seed of seeds) {
        const instance = readOpenClawOrchestratorState().instances[seed.id];
        if (!instance || instance.paused) {
          continue;
        }

        if (instance.nextRunAt && Date.parse(instance.nextRunAt) > Date.now() && reason !== "manual") {
          continue;
        }

        try {
          await runInstanceCycle(seed, reason);
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
              nextRunAt: formatIso(Date.now() + tickMs),
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
            draft.nextRunAt = formatIso(Date.now() + tickMs);
            draft.stats.errors += 1;
            state.global.lastError = draft.lastError;
          });
        }
      }

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

    intervalId = setInterval(() => {
      tick("interval").catch(() => {});
    }, tickMs);

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

    if (!intervalId && autoStart) {
      start();
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

  function getDashboard() {
    ensureStateInitialized();
    const state = readOpenClawOrchestratorState();
    const instances = Object.values(state.instances)
      .sort((left, right) => Number(left.sortOrder ?? 0) - Number(right.sortOrder ?? 0))
      .map((instance) => {
        ensureWorkflowFields(instance);
        const quota = buildQuotaSnapshot(instance);
        const online =
          Boolean(instance.lastHeartbeatAt) &&
          Date.now() - Date.parse(instance.lastHeartbeatAt) <= Math.max(tickMs * 3, 30000);

        return {
          ...instance,
          online,
          quota,
        };
      });

    const summary = {
      total: instances.length,
      online: instances.filter((instance) => instance.online).length,
      writable: instances.filter((instance) => instance.canWrite).length,
      active: instances.filter((instance) =>
        ["reading", "replying", "replied"].includes(instance.status)
      ).length,
      paused: instances.filter((instance) => instance.status === "paused").length,
      blocked: instances.filter((instance) =>
        ["blocked", "cooling_down", "awaiting_approval"].includes(instance.status)
      ).length,
    };

    return {
      ...state.global,
      statePath: getOpenClawOrchestratorStatePath(),
      origin,
      approvalMode,
      instances,
      summary,
    };
  }

  async function performAction(action, instanceId) {
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
