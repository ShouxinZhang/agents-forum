import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const runtimeDir = process.env.FORUM_API_RUNTIME_DIR
  ? path.resolve(process.env.FORUM_API_RUNTIME_DIR)
  : path.resolve(moduleDir, "../../../.runtime");
const runtimeEventsPath = path.join(runtimeDir, "agent-runtime-events.ndjson");

function ensureRuntimeDir() {
  fs.mkdirSync(runtimeDir, { recursive: true });
}

function readRuntimeLines() {
  if (!fs.existsSync(runtimeEventsPath)) {
    return [];
  }

  return fs
    .readFileSync(runtimeEventsPath, "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function parseLine(line) {
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
}

export function appendAgentRuntimeEvent(event) {
  const normalizedEvent = {
    id: event.id,
    agentId: typeof event.agentId === "string" ? event.agentId.trim() : "",
    tool: event.tool,
    summary: event.summary,
    timestamp: event.timestamp,
    status: event.status,
    durationMs: event.durationMs ?? 0,
    source: event.source ?? "forum-runtime",
    auditId: event.auditId ?? event.id,
    instanceId: typeof event.instanceId === "string" ? event.instanceId.trim() : "",
    botUsername: typeof event.botUsername === "string" ? event.botUsername.trim() : "",
    threadId: typeof event.threadId === "string" ? event.threadId.trim() : "",
    threadTitle: typeof event.threadTitle === "string" ? event.threadTitle.trim() : "",
    step: typeof event.step === "string" ? event.step.trim() : "",
    action: typeof event.action === "string" ? event.action.trim() : "",
    detail: typeof event.detail === "string" ? event.detail.trim() : "",
  };

  ensureRuntimeDir();
  fs.appendFileSync(runtimeEventsPath, `${JSON.stringify(normalizedEvent)}\n`, "utf8");
  return normalizedEvent;
}

export function listAgentRuntimeEvents({ agentId, instanceId, limit = 20 } = {}) {
  const entries = readRuntimeLines()
    .map(parseLine)
    .filter(Boolean)
    .filter((entry) => !agentId || entry.agentId === agentId)
    .filter((entry) => !instanceId || entry.instanceId === instanceId)
    .reverse();

  return entries.slice(0, limit);
}

export function listAgentRecentCalls(agentId, limit = 8) {
  return listAgentRuntimeEvents({ agentId, limit }).map((entry) => ({
    id: entry.id,
    tool: entry.tool,
    summary: entry.summary,
    timestamp: entry.timestamp,
    status: entry.status,
  }));
}

export function listInstanceRuntimeEvents(instanceId, limit = 12) {
  return listAgentRuntimeEvents({ instanceId, limit });
}

export function getAgentRuntimeEventsPath() {
  return runtimeEventsPath;
}
