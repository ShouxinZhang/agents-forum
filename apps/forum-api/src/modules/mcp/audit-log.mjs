import { randomUUID } from "node:crypto";

function summarizeString(value) {
  if (typeof value !== "string") {
    return value;
  }

  return value.length > 120 ? `${value.slice(0, 117)}...` : value;
}

function summarizeValue(value) {
  if (typeof value === "string") {
    return summarizeString(value);
  }

  if (Array.isArray(value)) {
    return value.slice(0, 5).map((item) => summarizeValue(item));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .slice(0, 8)
        .map(([key, nested]) => [key, summarizeValue(nested)])
    );
  }

  return value;
}

export function createAuditLog(maxEntries = 200, options = {}) {
  const entries = [];
  const persistEvent = options.persistEvent;

  function pushEntry(entry) {
    entries.unshift(entry);
    if (entries.length > maxEntries) {
      entries.length = maxEntries;
    }
  }

  async function run(toolName, input, execute, context = {}) {
    const startedAt = Date.now();
    const entry = {
      id: `audit_${randomUUID()}`,
      toolName,
      timestamp: new Date(startedAt).toISOString(),
      input: summarizeValue(input),
      status: "running",
      durationMs: 0,
      summary: "",
    };

    try {
      const result = await execute(entry);
      entry.status = "ok";
      entry.durationMs = Date.now() - startedAt;
      entry.summary = summarizeString(result?.summary ?? "ok");
      pushEntry(entry);

      if (typeof persistEvent === "function") {
        persistEvent({
          id: entry.id,
          agentId: context.agentId,
          tool: toolName,
          summary: entry.summary,
          timestamp: entry.timestamp,
          status: entry.status,
          durationMs: entry.durationMs,
          source: context.source ?? "forum-mcp",
          auditId: entry.id,
        });
      }

      return {
        entry,
        payload: result?.payload,
      };
    } catch (error) {
      entry.status = "error";
      entry.durationMs = Date.now() - startedAt;
      entry.summary = summarizeString(
        error instanceof Error ? error.message : String(error)
      );
      pushEntry(entry);

      if (typeof persistEvent === "function") {
        persistEvent({
          id: entry.id,
          agentId: context.agentId,
          tool: toolName,
          summary: entry.summary,
          timestamp: entry.timestamp,
          status: entry.status,
          durationMs: entry.durationMs,
          source: context.source ?? "forum-mcp",
          auditId: entry.id,
        });
      }

      throw error;
    }
  }

  function list({ limit = 20, toolName } = {}) {
    return entries
      .filter((entry) => !toolName || entry.toolName === toolName)
      .slice(0, limit);
  }

  return {
    run,
    list,
  };
}
