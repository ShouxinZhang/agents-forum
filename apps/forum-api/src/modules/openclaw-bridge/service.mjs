import fs from "node:fs";
import os from "node:os";
import path from "node:path";

function clipText(value, maxLength = 180) {
  const normalized = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  if (!normalized) {
    return "";
  }

  return normalized.length > maxLength
    ? `${normalized.slice(0, Math.max(0, maxLength - 1))}...`
    : normalized;
}

function toIsoFromUnix(timestamp) {
  if (!Number.isFinite(timestamp)) {
    return "";
  }

  return new Date(timestamp).toISOString();
}

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

function safeReadJsonLines(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    return [];
  }

  try {
    return fs
      .readFileSync(filePath, "utf8")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

function listFiles(directoryPath) {
  if (!directoryPath || !fs.existsSync(directoryPath)) {
    return [];
  }

  try {
    return fs.readdirSync(directoryPath, { withFileTypes: true });
  } catch {
    return [];
  }
}

function statTimestamp(filePath) {
  try {
    return fs.statSync(filePath).mtime.toISOString();
  } catch {
    return "";
  }
}

function isRecent(timestamp, thresholdMs = 5 * 60 * 1000) {
  if (!timestamp) {
    return false;
  }

  const value = Date.parse(timestamp);
  if (!Number.isFinite(value)) {
    return false;
  }

  return Date.now() - value <= thresholdMs;
}

function resolveWorkspaceDir(homePath, config) {
  const configured = config?.agents?.defaults?.workspace;
  if (typeof configured !== "string" || !configured.trim()) {
    return path.join(homePath, "workspace");
  }

  if (configured.startsWith("~/")) {
    return path.join(os.homedir(), configured.slice(2));
  }

  return path.isAbsolute(configured)
    ? configured
    : path.resolve(homePath, configured);
}

function listWorkspaceMemoryDocs(workspaceDir) {
  if (!workspaceDir) {
    return [];
  }

  const docs = [];
  const rootMemory = path.join(workspaceDir, "MEMORY.md");
  if (fs.existsSync(rootMemory)) {
    docs.push({
      id: `memory:${rootMemory}`,
      label: "MEMORY.md",
      path: rootMemory,
      updatedAt: statTimestamp(rootMemory),
    });
  }

  const memoryDir = path.join(workspaceDir, "memory");
  for (const entry of listFiles(memoryDir)) {
    if (!entry.isFile() || !entry.name.endsWith(".md")) {
      continue;
    }

    const filePath = path.join(memoryDir, entry.name);
    docs.push({
      id: `memory:${filePath}`,
      label: `memory/${entry.name}`,
      path: filePath,
      updatedAt: statTimestamp(filePath),
    });
  }

  return docs
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .slice(0, 8);
}

function extractMessageText(content) {
  if (!Array.isArray(content)) {
    return "";
  }

  return clipText(
    content
      .map((entry) => {
        if (!entry || typeof entry !== "object") {
          return "";
        }

        if (typeof entry.text === "string") {
          return entry.text;
        }

        if (typeof entry.thinking === "string") {
          return entry.thinking;
        }

        return "";
      })
      .filter(Boolean)
      .join(" ")
  );
}

function extractRawMessageText(content) {
  if (!Array.isArray(content)) {
    return "";
  }

  return content
    .map((entry) => {
      if (!entry || typeof entry !== "object") {
        return "";
      }

      if (typeof entry.text === "string") {
        return entry.text;
      }

      if (typeof entry.thinking === "string") {
        return entry.thinking;
      }

      return "";
    })
    .filter(Boolean)
    .join(" ")
    .trim();
}

function parseNativeReplyDraft(rawText) {
  if (typeof rawText !== "string" || !rawText.trim()) {
    return null;
  }

  try {
    const payload = JSON.parse(rawText);
    if (!payload || typeof payload !== "object") {
      return null;
    }

    const contextTrace =
      payload.contextTrace && typeof payload.contextTrace === "object" ? payload.contextTrace : {};
    const finalReply =
      typeof payload.replyText === "string"
        ? payload.replyText.trim()
        : typeof contextTrace.finalReply === "string"
          ? contextTrace.finalReply.trim()
          : typeof payload.content === "string"
            ? payload.content.trim()
            : "";

    if (!finalReply && !contextTrace.whyThisReply && !payload.whyThisReply) {
      return null;
    }

    const basis = Array.isArray(contextTrace.basis)
      ? contextTrace.basis
      : Array.isArray(payload.basis)
        ? payload.basis
        : [];

    return {
      finalReply: clipText(finalReply, 240),
      whyThisReply: clipText(payload.whyThisReply || contextTrace.whyThisReply || "", 160),
      memoryApplied: clipText(payload.memoryApplied || contextTrace.memoryApplied || "", 160),
      persona: clipText(contextTrace.persona || "", 120),
      threadId: typeof contextTrace.threadId === "string" ? contextTrace.threadId : "",
      threadTitle: typeof contextTrace.threadTitle === "string" ? contextTrace.threadTitle : "",
      basis: basis.map((entry) => clipText(entry, 120)).filter(Boolean).slice(0, 4),
      source:
        typeof contextTrace.source === "string" && contextTrace.source
          ? contextTrace.source
          : "openclaw-native",
    };
  } catch {
    return null;
  }
}

function summarizeTranscriptEntry(entry) {
  if (!entry || typeof entry !== "object") {
    return null;
  }

  const timestamp = typeof entry.timestamp === "string" ? entry.timestamp : "";
  const id = typeof entry.id === "string" ? entry.id : `native-${timestamp || "event"}`;

  if (entry.type === "toolCall") {
    const name = typeof entry.name === "string" ? entry.name : "tool";
    const detail =
      entry.arguments && typeof entry.arguments === "object"
        ? clipText(JSON.stringify(entry.arguments))
        : clipText(entry.partialJson || "");

    return {
      id,
      type: "toolCall",
      label: `调用 ${name}`,
      summary: detail || name,
      timestamp,
    };
  }

  if (entry.type === "message") {
    const message = entry.message || {};
    const role = typeof message.role === "string" ? message.role : "";
    const body = extractMessageText(message.content);
    const rawBody = extractRawMessageText(message.content);

    if (role === "user") {
      return {
        id,
        type: "user",
        label: "用户消息",
        summary: body || "收到用户输入",
        timestamp,
      };
    }

    if (role === "assistant") {
      const replyDraft = parseNativeReplyDraft(rawBody);
      if (replyDraft) {
        return {
          id,
          type: "assistant",
          label: "原生回复草稿",
          summary: replyDraft.whyThisReply || replyDraft.finalReply || "已生成原生回复草稿",
          timestamp,
          replyContext: replyDraft,
        };
      }

      return {
        id,
        type: "assistant",
        label: "Assistant 响应",
        summary: body || "生成回复或继续工具调用",
        timestamp,
      };
    }

    if (role === "toolResult") {
      const toolName = typeof message.toolName === "string" ? message.toolName : "tool";
      return {
        id,
        type: "toolResult",
        label: `工具结果 ${toolName}`,
        summary: body || "工具返回结果",
        timestamp,
      };
    }
  }

  if (entry.type === "session") {
    return {
      id,
      type: "session",
      label: "会话启动",
      summary: typeof entry.cwd === "string" ? `cwd ${entry.cwd}` : "新会话已启动",
      timestamp,
    };
  }

  if (entry.type === "custom") {
    return {
      id,
      type: "custom",
      label: typeof entry.customType === "string" ? entry.customType : "custom",
      summary: clipText(JSON.stringify(entry.data || {})) || "自定义事件",
      timestamp,
    };
  }

  return null;
}

function discoverNativeAgent(home, agentEntry) {
  const sessionsDir = path.join(home.homePath, "agents", agentEntry.name, "sessions");
  const sessionsIndexPath = path.join(sessionsDir, "sessions.json");
  const sessionsIndex = safeReadJson(sessionsIndexPath) || {};
  const sessions = Object.values(sessionsIndex)
    .filter(Boolean)
    .sort((left, right) => (right.updatedAt ?? 0) - (left.updatedAt ?? 0));
  const latestSession = sessions[0] || null;
  const sessionFile =
    latestSession && typeof latestSession.sessionFile === "string"
      ? latestSession.sessionFile
      : latestSession?.sessionId
        ? path.join(sessionsDir, `${latestSession.sessionId}.jsonl`)
        : "";
  const transcriptEntries = safeReadJsonLines(sessionFile);
  const recentEvents = transcriptEntries
    .map(summarizeTranscriptEntry)
    .filter(Boolean)
    .slice(-8)
    .reverse();
  const latestReplyContext =
    recentEvents.find((event) => event?.replyContext)?.replyContext || null;
  const updatedAt = latestSession?.updatedAt
    ? toIsoFromUnix(latestSession.updatedAt)
    : recentEvents[0]?.timestamp || "";
  const memoryDocs = listWorkspaceMemoryDocs(home.workspaceDir);

  return {
    id: `${home.id}:${agentEntry.name}`,
    agentId: agentEntry.name,
    label: agentEntry.name,
    homeId: home.id,
    homeLabel: home.label,
    homePath: home.homePath,
    workspaceDir: home.workspaceDir,
    linkedInstanceId: home.linkedInstanceId,
    sessionCount: sessions.length,
    latestSessionId: latestSession?.sessionId || "",
    updatedAt,
    online: isRecent(updatedAt),
    chatType: latestSession?.chatType || "",
    model: latestSession?.model || "",
    currentAction: recentEvents[0]?.label || "暂无原生 activity",
    currentSummary: recentEvents[0]?.summary || "",
    recentEvents,
    latestReplyContext,
    whyThisReply: latestReplyContext?.whyThisReply || "",
    finalReply: latestReplyContext?.finalReply || "",
    memoryDocs,
    skills:
      latestSession?.skillsSnapshot?.skills
        ?.map((skill) => skill?.name)
        .filter((name) => typeof name === "string" && name.trim())
        .slice(0, 8) || [],
  };
}

function normalizeHomeEntry({ id, label, homePath, linkedInstanceId = "", source = "native" }) {
  const configPath = path.join(homePath, "openclaw.json");
  const config = safeReadJson(configPath);
  const workspaceDir = resolveWorkspaceDir(homePath, config);
  const memoryDocs = listWorkspaceMemoryDocs(workspaceDir);
  const agentDirs = listFiles(path.join(homePath, "agents")).filter((entry) => entry.isDirectory());
  const agents = agentDirs.map((entry) =>
    discoverNativeAgent(
      {
        id,
        label,
        homePath,
        workspaceDir,
        linkedInstanceId,
      },
      entry
    )
  );
  const sessionCount = agents.reduce((total, agent) => total + agent.sessionCount, 0);
  const latestUpdatedAt = agents
    .map((agent) => agent.updatedAt)
    .filter(Boolean)
    .sort((left, right) => right.localeCompare(left))[0] || "";

  return {
    id,
    label,
    source,
    linkedInstanceId,
    homePath,
    workspaceDir,
    configPath,
    connected: fs.existsSync(configPath),
    agentCount: agents.length,
    sessionCount,
    latestUpdatedAt,
    memoryDocs,
    agents,
  };
}

function buildHomeEntries(orchestratorDashboard) {
  const homes = [];
  const configuredStateDir = process.env.OPENCLAW_STATE_DIR?.trim();
  const configuredHomeRoot = process.env.OPENCLAW_HOME?.trim();
  const globalHomePath = configuredStateDir
    ? path.resolve(configuredStateDir)
    : path.join(path.resolve(configuredHomeRoot || os.homedir()), ".openclaw");

  homes.push(
    normalizeHomeEntry({
      id: "openclaw-global",
      label: "用户 OpenClaw Home",
      homePath: globalHomePath,
      source: "user-global",
    })
  );

  const instances = orchestratorDashboard?.instances ?? [];
  for (const instance of instances) {
    if (!instance?.openclawHome || instance.openclawHome === globalHomePath) {
      continue;
    }

    homes.push(
      normalizeHomeEntry({
        id: instance.id,
        label: instance.label,
        homePath: instance.openclawHome,
        linkedInstanceId: instance.id,
        source: "forum-instance",
      })
    );
  }

  return homes;
}

function chooseLatestAgent(left, right) {
  if (!left) {
    return right;
  }
  if (!right) {
    return left;
  }

  return (right.updatedAt || "").localeCompare(left.updatedAt || "") > 0 ? right : left;
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

function buildInstanceViews(homes, agents, orchestratorDashboard) {
  const instances = orchestratorDashboard?.instances ?? [];
  const homesByInstanceId = new Map();
  const agentsByInstanceId = new Map();

  for (const home of homes) {
    if (home.linkedInstanceId) {
      homesByInstanceId.set(home.linkedInstanceId, home);
    }
  }

  for (const agent of agents) {
    if (!agent.linkedInstanceId) {
      continue;
    }
    agentsByInstanceId.set(
      agent.linkedInstanceId,
      chooseLatestAgent(agentsByInstanceId.get(agent.linkedInstanceId), agent)
    );
  }

  return instances.map((instance) => {
    const home = homesByInstanceId.get(instance.id) || null;
    const agent = agentsByInstanceId.get(instance.id) || null;
    const latestReplyContext = agent?.latestReplyContext || instance.replyContext || null;
    const nativeOnline =
      Boolean(agent?.online) ||
      Boolean(home?.connected && isRecent(home.latestUpdatedAt)) ||
      instance.nativeStatus === "running";
    const schedulerOnline = Boolean(instance.schedulerOnline);
    const observedOnline = nativeOnline || schedulerOnline;
    const nativeActive =
      instance.nativeStatus === "running" ||
      Boolean(agent?.currentAction && agent.currentAction !== "暂无原生 activity" && agent.online);
    const forumActive = Boolean(instance.observedActive);

    return {
      instanceId: instance.id,
      homeId: home?.id || "",
      agentId: agent?.id || "",
      observedOnline,
      observedActive: nativeActive || forumActive,
      onlineSource: resolvePresenceSource(nativeOnline, schedulerOnline),
      activitySource: resolvePresenceSource(nativeActive, forumActive),
      primaryTimelineSource: agent?.recentEvents?.length ? "native" : instance.recentEvents?.length ? "forum" : "none",
      latestSessionId: agent?.latestSessionId || instance.nativeSessionId || "",
      nativeUpdatedAt: agent?.updatedAt || home?.latestUpdatedAt || instance.nativeHeartbeatAt || "",
      currentAction: agent?.currentAction || instance.workflow?.currentAction || "",
      currentSummary: agent?.currentSummary || instance.lastSummary || "",
      latestReplyContext,
      whyThisReply: latestReplyContext?.whyThisReply || "",
      finalReply: latestReplyContext?.finalReply || "",
    };
  });
}

function createBridgeService() {
  function getDashboard(orchestratorDashboard) {
    const homes = buildHomeEntries(orchestratorDashboard);
    const agents = homes.flatMap((home) => home.agents);
    const instanceViews = buildInstanceViews(homes, agents, orchestratorDashboard);
    const summary = {
      homes: homes.length,
      connectedHomes: homes.filter((home) => home.connected).length,
      agents: agents.length,
      onlineAgents: agents.filter((agent) => agent.online).length,
      sessions: agents.reduce((total, agent) => total + agent.sessionCount, 0),
      memoryDocs: homes.reduce((total, home) => total + home.memoryDocs.length, 0),
    };
    const notes = [];

    if (summary.connectedHomes === 0) {
      notes.push("未发现可用的 OpenClaw home。");
    }
    if (summary.agents === 0) {
      notes.push("已发现 home，但还没有原生 agent session/transcript 可读。");
    }
    if (homes.some((home) => home.source === "forum-instance" && home.agentCount === 0)) {
      notes.push("论坛实例 home 已创建，但多数还未沉淀原生 session transcript。");
    }

    return {
      status:
        summary.connectedHomes === 0
          ? "disconnected"
          : summary.agents === 0
            ? "partial"
            : "connected",
      source: "openclaw-native",
      summary,
      homes: homes.map((home) => ({
        id: home.id,
        label: home.label,
        source: home.source,
        linkedInstanceId: home.linkedInstanceId,
        homePath: home.homePath,
        workspaceDir: home.workspaceDir,
        connected: home.connected,
        agentCount: home.agentCount,
        sessionCount: home.sessionCount,
        latestUpdatedAt: home.latestUpdatedAt,
        memoryDocs: home.memoryDocs,
      })),
      agents,
      instanceViews,
      notes,
    };
  }

  return {
    getDashboard,
  };
}

let bridgeService = null;

export function getOpenClawBridgeService() {
  if (!bridgeService) {
    bridgeService = createBridgeService();
  }

  return bridgeService;
}
