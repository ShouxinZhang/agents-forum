import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  Codex,
  type ModelReasoningEffort,
  type ThreadEvent,
  type ThreadItem,
  type Usage,
} from "@openai/codex-sdk";
import { z } from "zod";

const subagentSchema = z.object({
  name: z.string().min(1),
  mission: z.string().min(1),
  ownedPaths: z.array(z.string().min(1)).min(1),
  readFiles: z.array(z.string().min(1)).default([]),
  extraInstructions: z.array(z.string().min(1)).default([]),
});

const specSchema = z.object({
  task: z.string().min(1),
  acceptanceCriteria: z.array(z.string().min(1)).min(1),
  sharedContextFiles: z.array(z.string().min(1)).default([]),
  subagents: z.array(subagentSchema).min(1),
});

const subagentOutputSchema = {
  type: "object",
  properties: {
    summaryMarkdown: { type: "string" },
    filesTouched: { type: "array", items: { type: "string" } },
    checksRun: { type: "array", items: { type: "string" } },
    openRisks: { type: "array", items: { type: "string" } },
  },
  required: ["summaryMarkdown", "filesTouched", "checksRun", "openRisks"],
  additionalProperties: false,
} as const;

const subagentResultSchema = z.object({
  summaryMarkdown: z.string().min(1),
  filesTouched: z.array(z.string()).default([]),
  checksRun: z.array(z.string()).default([]),
  openRisks: z.array(z.string()).default([]),
});

type ParsedArgs = {
  specPath: string;
  workspaceRoot: string;
  runDir: string;
  registryPath: string;
  latestRunPath: string;
  model: string;
  reasoningEffort: ModelReasoningEffort;
  maxParallel: number;
  fresh: boolean;
};

type SubagentSpec = z.infer<typeof subagentSchema>;
type RunSpec = z.infer<typeof specSchema>;

type SubagentRunResult = z.infer<typeof subagentResultSchema> & {
  name: string;
  mission: string;
  ownedPaths: string[];
  readFiles: string[];
  extraInstructions: string[];
  boundaryViolations: string[];
  threadId: string | null;
  resumedFromThreadId: string | null;
};

type ThreadRegistryEntry = {
  threadId: string;
  subagentName: string;
  specKey: string;
  workspaceRoot: string;
  createdAt: string;
  updatedAt: string;
  lastRunDir: string;
};

type ThreadRegistry = {
  version: 1;
  entries: Record<string, ThreadRegistryEntry>;
};

type SubagentLiveState = "queued" | "running" | "completed" | "failed";
type ResumeMode = "new" | "fresh" | "resumed";

type SubagentLiveStatus = {
  version: 1;
  name: string;
  mission: string;
  ownedPaths: string[];
  readFiles: string[];
  extraInstructions: string[];
  state: SubagentLiveState;
  resumeMode: ResumeMode;
  threadId: string | null;
  resumedFromThreadId: string | null;
  startedAt: string | null;
  updatedAt: string;
  completedAt: string | null;
  currentItemType: ThreadItem["type"] | null;
  currentItemStatus: string | null;
  currentItemText: string | null;
  latestCommand: {
    command: string;
    status: string;
    exitCode?: number;
    updatedAt: string;
  } | null;
  latestFileChange: {
    paths: string[];
    status: string;
    updatedAt: string;
  } | null;
  latestAgentMessage: {
    text: string;
    updatedAt: string;
  } | null;
  latestReasoning: {
    text: string;
    updatedAt: string;
  } | null;
  latestTodo: {
    text: string[];
    updatedAt: string;
  } | null;
  latestEvent: string | null;
  lastError: string | null;
  usage: Usage | null;
  filesTouched: string[];
  checksRun: string[];
  openRisks: string[];
  boundaryViolations: string[];
  finalSummaryMarkdown: string | null;
};

type RunManifest = {
  version: 1;
  task: string;
  specPath: string;
  workspaceRoot: string;
  createdAt: string;
  updatedAt: string;
  model: string;
  reasoningEffort: ModelReasoningEffort;
  status: "running" | "completed" | "completed_with_boundary_violations" | "failed";
  fresh: boolean;
  subagents: Array<{
    name: string;
    mission: string;
    statusPath: string;
    eventsPath: string;
    resultPath: string;
  }>;
};

type RegistryContext = {
  path: string;
  data: ThreadRegistry;
  writeQueue: Promise<void>;
};

function nowIso(): string {
  return new Date().toISOString();
}

function truncate(value: string, max = 240): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= max) {
    return normalized;
  }
  return `${normalized.slice(0, max - 1)}...`;
}

function parseArgs(argv: string[]): ParsedArgs {
  const args = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 1) {
    const part = argv[index];
    if (!part.startsWith("--")) {
      continue;
    }
    const key = part.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      args.set(key, "true");
      continue;
    }
    args.set(key, value);
    index += 1;
  }

  const specPath = args.get("spec");
  const workspaceRoot = args.get("workspace-root");
  if (!specPath) {
    throw new Error("missing required argument: --spec");
  }
  if (!workspaceRoot) {
    throw new Error("missing required argument: --workspace-root");
  }

  const reasoningEffort = (args.get("reasoning-effort") ?? "high") as ModelReasoningEffort;
  if (!["minimal", "low", "medium", "high", "xhigh"].includes(reasoningEffort)) {
    throw new Error("invalid --reasoning-effort");
  }

  const maxParallel = Number(args.get("max-parallel") ?? "0");
  if (!Number.isInteger(maxParallel) || maxParallel < 0) {
    throw new Error("--max-parallel must be a non-negative integer");
  }

  const resolvedWorkspaceRoot = path.resolve(workspaceRoot);
  const registryRoot = path.join(resolvedWorkspaceRoot, ".agent_cache", "codex-subagents-simple");

  return {
    specPath: path.resolve(specPath),
    workspaceRoot: resolvedWorkspaceRoot,
    runDir: path.resolve(args.get("run-dir") ?? defaultRunDir(resolvedWorkspaceRoot, specPath)),
    registryPath: path.resolve(args.get("registry-path") ?? path.join(registryRoot, "thread-registry.json")),
    latestRunPath: path.join(registryRoot, "latest-run.json"),
    model: args.get("model") ?? "gpt-5.4",
    reasoningEffort,
    maxParallel,
    fresh: args.get("fresh") === "true",
  };
}

function defaultRunDir(workspaceRoot: string, specPath: string): string {
  const timestamp = nowIso().replaceAll(":", "").replaceAll(".", "");
  const slug =
    path.basename(specPath, path.extname(specPath)).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "subagents";
  return path.join(workspaceRoot, ".agent_cache", "codex-subagents-simple", `${timestamp}-${slug}`);
}

function toPosix(value: string): string {
  return value.split(path.sep).join(path.posix.sep);
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function relativeToWorkspace(workspaceRoot: string, targetPath: string): string {
  const relative = path.relative(workspaceRoot, targetPath);
  return toPosix(relative || ".");
}

function ensureInsideWorkspace(workspaceRoot: string, candidate: string): string {
  const resolved = path.resolve(workspaceRoot, candidate);
  if (resolved !== workspaceRoot && !resolved.startsWith(workspaceRoot + path.sep)) {
    throw new Error(`path is outside workspace: ${candidate}`);
  }
  return resolved;
}

function sanitizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "subagent";
}

function getRunManifestPath(runDir: string): string {
  return path.join(runDir, "run.json");
}

function getAgentResultPath(runDir: string, name: string): string {
  return path.join(runDir, "agents", `${sanitizeName(name)}.json`);
}

function getAgentStatusPath(runDir: string, name: string): string {
  return path.join(runDir, "agents", `${sanitizeName(name)}.status.json`);
}

function getAgentEventsPath(runDir: string, name: string): string {
  return path.join(runDir, "agents", `${sanitizeName(name)}.events.jsonl`);
}

async function ensureRunLayout(runDir: string): Promise<void> {
  await mkdir(runDir, { recursive: true });
  await mkdir(path.join(runDir, "agents"), { recursive: true });
}

async function readSpec(specPath: string): Promise<RunSpec> {
  const raw = await readFile(specPath, "utf-8");
  return specSchema.parse(JSON.parse(raw));
}

function normalizeSpec(spec: RunSpec, workspaceRoot: string): RunSpec {
  return {
    ...spec,
    sharedContextFiles: spec.sharedContextFiles.map((filePath) =>
      relativeToWorkspace(workspaceRoot, ensureInsideWorkspace(workspaceRoot, filePath)),
    ),
    subagents: spec.subagents.map((subagent) => ({
      ...subagent,
      ownedPaths: subagent.ownedPaths.map((ownedPath) => relativeToWorkspace(workspaceRoot, ensureInsideWorkspace(workspaceRoot, ownedPath))),
      readFiles: subagent.readFiles.map((filePath) => relativeToWorkspace(workspaceRoot, ensureInsideWorkspace(workspaceRoot, filePath))),
    })),
  };
}

function buildPrompt(spec: RunSpec, subagent: SubagentSpec, resumeMode: ResumeMode): string {
  const sharedContext = spec.sharedContextFiles.length > 0 ? spec.sharedContextFiles.map((filePath) => `- ${filePath}`).join("\n") : "- None";
  const readFiles = subagent.readFiles.length > 0 ? subagent.readFiles.map((filePath) => `- ${filePath}`).join("\n") : "- None";
  const ownedPaths = subagent.ownedPaths.map((ownedPath) => `- ${ownedPath}`).join("\n");
  const extraInstructions = subagent.extraInstructions.length > 0 ? subagent.extraInstructions.map((line) => `- ${line}`).join("\n") : "- None";
  const acceptanceCriteria = spec.acceptanceCriteria.map((line) => `- ${line}`).join("\n");
  const resumeGuidance =
    resumeMode === "resumed"
      ? "This is a resumed subagent thread. Reuse the prior thread context when it is relevant, but still obey the current mission and owned paths."
      : "This is a fresh subagent thread. Do not assume prior thread context exists.";

  return [
    "You are a Codex subagent launched by a primary agent.",
    "You have been assigned a scoped subtask with explicit owned paths.",
    "You are allowed to use danger-full-access, but you should only modify files inside your owned paths unless the primary agent explicitly told you otherwise.",
    "Read the listed files first, perform the task, run the smallest relevant checks, and stop without asking the user for confirmation.",
    "Return only JSON that matches the required schema.",
    resumeGuidance,
    "",
    `Global Task:\n${spec.task}`,
    "",
    `Subagent Name:\n${subagent.name}`,
    "",
    `Subagent Mission:\n${subagent.mission}`,
    "",
    "Acceptance Criteria:",
    acceptanceCriteria,
    "",
    "Shared Context Files:",
    sharedContext,
    "",
    "Read These Files First:",
    readFiles,
    "",
    "Owned Paths You May Modify:",
    ownedPaths,
    "",
    "Extra Instructions:",
    extraInstructions,
    "",
    "Your response must include:",
    "- summaryMarkdown: concise business-focused result",
    "- filesTouched: files you believe you changed or created",
    "- checksRun: checks or commands you ran",
    "- openRisks: anything incomplete, uncertain, or risky",
  ].join("\n");
}

function collectItems<T extends ThreadItem["type"]>(items: ThreadItem[], type: T): Extract<ThreadItem, { type: T }>[] {
  return items.filter((item): item is Extract<ThreadItem, { type: T }> => item.type === type);
}

function normalizeReportedPath(workspaceRoot: string, reportedPath: string): string {
  const absolute = path.isAbsolute(reportedPath) ? reportedPath : path.resolve(workspaceRoot, reportedPath);
  return relativeToWorkspace(workspaceRoot, absolute);
}

function isOwnedPath(filePath: string, ownedPaths: string[]): boolean {
  return ownedPaths.some((ownedPath) => filePath === ownedPath || filePath.startsWith(`${ownedPath}/`));
}

async function readThreadRegistry(registryPath: string): Promise<ThreadRegistry> {
  try {
    const raw = await readFile(registryPath, "utf-8");
    const parsed = JSON.parse(raw) as ThreadRegistry;
    if (parsed.version === 1 && parsed.entries && typeof parsed.entries === "object") {
      return parsed;
    }
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }

  return {
    version: 1,
    entries: {},
  };
}

async function queueRegistryWrite(context: RegistryContext): Promise<void> {
  context.writeQueue = context.writeQueue.then(() =>
    writeFile(context.path, JSON.stringify(context.data, null, 2) + "\n", "utf-8"),
  );
  return context.writeQueue;
}

function buildRegistryKey(args: ParsedArgs, subagent: SubagentSpec): string {
  const specRelative = path.relative(args.workspaceRoot, args.specPath);
  const specKey = specRelative.startsWith("..") ? toPosix(args.specPath) : toPosix(specRelative);
  return `${specKey}::${sanitizeName(subagent.name)}`;
}

async function upsertRegistryEntry(
  context: RegistryContext,
  key: string,
  entry: ThreadRegistryEntry,
): Promise<void> {
  context.data.entries[key] = entry;
  await queueRegistryWrite(context);
}

function createInitialStatus(
  subagent: SubagentSpec,
  resumeMode: ResumeMode,
  threadId: string | null,
  resumedFromThreadId: string | null,
): SubagentLiveStatus {
  return {
    version: 1,
    name: subagent.name,
    mission: subagent.mission,
    ownedPaths: subagent.ownedPaths,
    readFiles: subagent.readFiles,
    extraInstructions: subagent.extraInstructions,
    state: "queued",
    resumeMode,
    threadId,
    resumedFromThreadId,
    startedAt: null,
    updatedAt: nowIso(),
    completedAt: null,
    currentItemType: null,
    currentItemStatus: null,
    currentItemText: null,
    latestCommand: null,
    latestFileChange: null,
    latestAgentMessage: null,
    latestReasoning: null,
    latestTodo: null,
    latestEvent: "queued",
    lastError: null,
    usage: null,
    filesTouched: [],
    checksRun: [],
    openRisks: [],
    boundaryViolations: [],
    finalSummaryMarkdown: null,
  };
}

async function writeStatus(runDir: string, status: SubagentLiveStatus): Promise<void> {
  const payload = {
    ...status,
    updatedAt: nowIso(),
  };
  await writeFile(getAgentStatusPath(runDir, status.name), JSON.stringify(payload, null, 2) + "\n", "utf-8");
}

async function appendEventLog(
  runDir: string,
  subagentName: string,
  payload: Record<string, unknown>,
): Promise<void> {
  await appendFile(getAgentEventsPath(runDir, subagentName), JSON.stringify(payload) + "\n", "utf-8");
}

function summarizeTodo(items: { text: string; completed: boolean }[]): string[] {
  return items.map((item) => `${item.completed ? "[x]" : "[ ]"} ${truncate(item.text, 120)}`);
}

function summarizeItemText(item: ThreadItem): string | null {
  switch (item.type) {
    case "agent_message":
      return truncate(item.text);
    case "reasoning":
      return truncate(item.text);
    case "command_execution":
      return truncate(item.command);
    case "file_change":
      return truncate(item.changes.map((change) => `${change.kind}:${change.path}`).join(", "));
    case "mcp_tool_call":
      return truncate(`${item.server}/${item.tool}`);
    case "web_search":
      return truncate(item.query);
    case "todo_list":
      return truncate(item.items.map((entry) => entry.text).join(" | "));
    case "error":
      return truncate(item.message);
    default:
      return null;
  }
}

function applyItemToStatus(status: SubagentLiveStatus, item: ThreadItem, timestamp: string): void {
  status.currentItemType = item.type;
  status.currentItemText = summarizeItemText(item);

  switch (item.type) {
    case "command_execution":
      status.currentItemStatus = item.status;
      status.latestCommand = {
        command: truncate(item.command),
        status: item.status,
        exitCode: item.exit_code,
        updatedAt: timestamp,
      };
      status.latestEvent = `command ${item.status}: ${truncate(item.command, 120)}`;
      break;
    case "file_change":
      status.currentItemStatus = item.status;
      status.latestFileChange = {
        paths: item.changes.map((change) => truncate(change.path, 120)),
        status: item.status,
        updatedAt: timestamp,
      };
      status.latestEvent = `file change ${item.status}: ${item.changes.map((change) => change.path).join(", ")}`;
      break;
    case "agent_message":
      status.currentItemStatus = "completed";
      status.latestAgentMessage = {
        text: truncate(item.text, 500),
        updatedAt: timestamp,
      };
      status.latestEvent = `agent message: ${truncate(item.text, 120)}`;
      break;
    case "reasoning":
      status.currentItemStatus = "completed";
      status.latestReasoning = {
        text: truncate(item.text, 500),
        updatedAt: timestamp,
      };
      status.latestEvent = `reasoning: ${truncate(item.text, 120)}`;
      break;
    case "todo_list":
      status.currentItemStatus = "completed";
      status.latestTodo = {
        text: summarizeTodo(item.items),
        updatedAt: timestamp,
      };
      status.latestEvent = `todo list updated (${item.items.length})`;
      break;
    case "mcp_tool_call":
      status.currentItemStatus = item.status;
      status.latestEvent = `mcp ${item.status}: ${item.server}/${item.tool}`;
      break;
    case "web_search":
      status.currentItemStatus = "completed";
      status.latestEvent = `web search: ${truncate(item.query, 120)}`;
      break;
    case "error":
      status.currentItemStatus = "failed";
      status.lastError = item.message;
      status.latestEvent = `item error: ${truncate(item.message, 120)}`;
      break;
  }
}

function summarizeEvent(event: ThreadEvent): Record<string, unknown> {
  const timestamp = nowIso();
  switch (event.type) {
    case "thread.started":
      return { timestamp, type: event.type, threadId: event.thread_id };
    case "turn.started":
      return { timestamp, type: event.type };
    case "turn.completed":
      return { timestamp, type: event.type, usage: event.usage };
    case "turn.failed":
      return { timestamp, type: event.type, error: event.error.message };
    case "error":
      return { timestamp, type: event.type, error: event.message };
    case "item.started":
    case "item.updated":
    case "item.completed":
      return {
        timestamp,
        type: event.type,
        itemType: event.item.type,
        itemId: event.item.id,
        itemStatus: "status" in event.item ? event.item.status : undefined,
        text: summarizeItemText(event.item),
      };
    default:
      return { timestamp, type: "unknown" };
  }
}

async function writeManifest(runDir: string, manifest: RunManifest): Promise<void> {
  const payload = {
    ...manifest,
    updatedAt: nowIso(),
  };
  await writeFile(getRunManifestPath(runDir), JSON.stringify(payload, null, 2) + "\n", "utf-8");
}

async function writeLatestRunPointer(args: ParsedArgs): Promise<void> {
  await mkdir(path.dirname(args.latestRunPath), { recursive: true });
  await writeFile(
    args.latestRunPath,
    JSON.stringify(
      {
        version: 1,
        runDir: args.runDir,
        specPath: args.specPath,
        workspaceRoot: args.workspaceRoot,
        updatedAt: nowIso(),
      },
      null,
      2,
    ) + "\n",
    "utf-8",
  );
}

async function runOneSubagent(
  spec: RunSpec,
  subagent: SubagentSpec,
  args: ParsedArgs,
  registryContext: RegistryContext,
): Promise<SubagentRunResult> {
  const registryKey = buildRegistryKey(args, subagent);
  const registryEntry = args.fresh ? undefined : registryContext.data.entries[registryKey];
  const resumeMode: ResumeMode = args.fresh ? "fresh" : registryEntry ? "resumed" : "new";
  const resumedFromThreadId = registryEntry?.threadId ?? null;
  const codex = new Codex();
  const threadOptions = {
    model: args.model,
    sandboxMode: "danger-full-access" as const,
    workingDirectory: args.workspaceRoot,
    approvalPolicy: "never" as const,
    modelReasoningEffort: args.reasoningEffort,
    networkAccessEnabled: true,
  };
  const thread = registryEntry ? codex.resumeThread(registryEntry.threadId, threadOptions) : codex.startThread(threadOptions);

  const status = createInitialStatus(subagent, resumeMode, thread.id ?? resumedFromThreadId, resumedFromThreadId);
  await writeStatus(args.runDir, status);

  const itemsById = new Map<string, ThreadItem>();
  let finalMessageText = "";

  try {
    const { events } = await thread.runStreamed(buildPrompt(spec, subagent, resumeMode), { outputSchema: subagentOutputSchema });
    for await (const event of events) {
      const timestamp = nowIso();
      await appendEventLog(args.runDir, subagent.name, summarizeEvent(event));

      switch (event.type) {
        case "thread.started": {
          status.threadId = event.thread_id;
          status.latestEvent = `thread started: ${event.thread_id}`;
          await upsertRegistryEntry(registryContext, registryKey, {
            threadId: event.thread_id,
            subagentName: subagent.name,
            specKey: registryKey,
            workspaceRoot: args.workspaceRoot,
            createdAt: registryEntry?.createdAt ?? timestamp,
            updatedAt: timestamp,
            lastRunDir: args.runDir,
          });
          break;
        }
        case "turn.started":
          status.state = "running";
          status.startedAt ??= timestamp;
          status.latestEvent = "turn started";
          break;
        case "turn.completed":
          status.usage = event.usage;
          status.completedAt = timestamp;
          status.latestEvent = "turn completed";
          break;
        case "turn.failed":
          status.state = "failed";
          status.completedAt = timestamp;
          status.lastError = event.error.message;
          status.latestEvent = `turn failed: ${truncate(event.error.message, 120)}`;
          break;
        case "error":
          status.state = "failed";
          status.completedAt = timestamp;
          status.lastError = event.message;
          status.latestEvent = `stream error: ${truncate(event.message, 120)}`;
          break;
        case "item.started":
        case "item.updated":
        case "item.completed":
          itemsById.set(event.item.id, event.item);
          status.state = "running";
          status.startedAt ??= timestamp;
          applyItemToStatus(status, event.item, timestamp);
          if (event.item.type === "agent_message") {
            finalMessageText = event.item.text;
          }
          break;
        default:
          break;
      }

      await writeStatus(args.runDir, status);
    }

    if (status.state === "failed") {
      throw new Error(status.lastError ?? "subagent failed");
    }

    const finalItems = [...itemsById.values()];
    const lastAgentMessage = [...collectItems(finalItems, "agent_message")].at(-1);
    const finalResponseText = lastAgentMessage?.text ?? finalMessageText;
    if (!finalResponseText) {
      throw new Error(`subagent ${subagent.name} did not produce a final agent_message`);
    }

    const parsed = subagentResultSchema.parse(JSON.parse(finalResponseText));
    const filesFromTooling = collectItems(finalItems, "file_change")
      .flatMap((item) => item.changes.map((change) => normalizeReportedPath(args.workspaceRoot, change.path)));
    const commands = collectItems(finalItems, "command_execution").map((item) => item.command);
    const filesTouched = unique([...parsed.filesTouched.map((filePath) => normalizeReportedPath(args.workspaceRoot, filePath)), ...filesFromTooling]);
    const checksRun = unique([...parsed.checksRun, ...commands]);
    const boundaryViolations = filesTouched.filter((filePath) => !isOwnedPath(filePath, subagent.ownedPaths));
    const openRisks = unique([
      ...parsed.openRisks,
      ...boundaryViolations.map((filePath) => `Boundary violation: ${filePath} is outside ownedPaths`),
    ]);

    status.state = "completed";
    status.completedAt ??= nowIso();
    status.filesTouched = filesTouched;
    status.checksRun = checksRun;
    status.openRisks = openRisks;
    status.boundaryViolations = boundaryViolations;
    status.finalSummaryMarkdown = parsed.summaryMarkdown;
    status.latestEvent = "completed";
    await writeStatus(args.runDir, status);

    if (status.threadId) {
      await upsertRegistryEntry(registryContext, registryKey, {
        threadId: status.threadId,
        subagentName: subagent.name,
        specKey: registryKey,
        workspaceRoot: args.workspaceRoot,
        createdAt: registryEntry?.createdAt ?? status.startedAt ?? nowIso(),
        updatedAt: nowIso(),
        lastRunDir: args.runDir,
      });
    }

    return {
      ...parsed,
      name: subagent.name,
      mission: subagent.mission,
      ownedPaths: subagent.ownedPaths,
      readFiles: subagent.readFiles,
      extraInstructions: subagent.extraInstructions,
      filesTouched,
      checksRun,
      openRisks,
      boundaryViolations,
      threadId: status.threadId,
      resumedFromThreadId,
    };
  } catch (error: unknown) {
    status.state = "failed";
    status.completedAt = nowIso();
    status.lastError = error instanceof Error ? error.stack ?? error.message : String(error);
    status.latestEvent = `failed: ${truncate(status.lastError, 120)}`;
    await appendEventLog(args.runDir, subagent.name, {
      timestamp: nowIso(),
      type: "runner.failure",
      error: status.lastError,
    });
    await writeStatus(args.runDir, status);
    throw error;
  }
}

async function runWithLimit<T>(values: T[], limit: number, worker: (value: T, index: number) => Promise<void>): Promise<void> {
  const concurrency = limit > 0 ? limit : values.length;
  let nextIndex = 0;
  const runners = Array.from({ length: Math.max(1, Math.min(concurrency, values.length)) }, async () => {
    while (true) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      if (currentIndex >= values.length) {
        return;
      }
      await worker(values[currentIndex], currentIndex);
    }
  });
  await Promise.all(runners);
}

async function writeAgentResult(runDir: string, result: SubagentRunResult): Promise<void> {
  const outputPath = getAgentResultPath(runDir, result.name);
  await writeFile(outputPath, JSON.stringify(result, null, 2) + "\n", "utf-8");
}

function buildSummary(spec: RunSpec, results: SubagentRunResult[]): string {
  const lines = [
    "# Subagent Summary",
    "",
    "## Task",
    spec.task,
    "",
    "## Acceptance Criteria",
    ...spec.acceptanceCriteria.map((line) => `- ${line}`),
    "",
  ];

  for (const result of results) {
    lines.push(`## ${result.name}`);
    lines.push(`Mission: ${result.mission}`);
    lines.push("");
    lines.push(result.summaryMarkdown.trim());
    lines.push("");
    lines.push(`Thread: ${result.threadId ?? "None"}`);
    lines.push(`Resumed From: ${result.resumedFromThreadId ?? "None"}`);
    lines.push("");
    lines.push("Files Touched:");
    lines.push(...(result.filesTouched.length > 0 ? result.filesTouched.map((line) => `- ${line}`) : ["- None"]));
    lines.push("");
    lines.push("Checks Run:");
    lines.push(...(result.checksRun.length > 0 ? result.checksRun.map((line) => `- ${line}`) : ["- None"]));
    lines.push("");
    lines.push("Open Risks:");
    lines.push(...(result.openRisks.length > 0 ? result.openRisks.map((line) => `- ${line}`) : ["- None"]));
    lines.push("");
  }

  return lines.join("\n").trimEnd() + "\n";
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  await ensureRunLayout(args.runDir);
  await writeLatestRunPointer(args);

  const rawSpec = await readSpec(args.specPath);
  const spec = normalizeSpec(rawSpec, args.workspaceRoot);
  await writeFile(path.join(args.runDir, "spec.normalized.json"), JSON.stringify(spec, null, 2) + "\n", "utf-8");

  const registryContext: RegistryContext = {
    path: args.registryPath,
    data: await readThreadRegistry(args.registryPath),
    writeQueue: Promise.resolve(),
  };

  const manifest: RunManifest = {
    version: 1,
    task: spec.task,
    specPath: args.specPath,
    workspaceRoot: args.workspaceRoot,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    model: args.model,
    reasoningEffort: args.reasoningEffort,
    status: "running",
    fresh: args.fresh,
    subagents: spec.subagents.map((subagent) => ({
      name: subagent.name,
      mission: subagent.mission,
      statusPath: relativeToWorkspace(args.workspaceRoot, getAgentStatusPath(args.runDir, subagent.name)),
      eventsPath: relativeToWorkspace(args.workspaceRoot, getAgentEventsPath(args.runDir, subagent.name)),
      resultPath: relativeToWorkspace(args.workspaceRoot, getAgentResultPath(args.runDir, subagent.name)),
    })),
  };
  await writeManifest(args.runDir, manifest);

  for (const subagent of spec.subagents) {
    const registryEntry = args.fresh ? undefined : registryContext.data.entries[buildRegistryKey(args, subagent)];
    await writeStatus(
      args.runDir,
      createInitialStatus(
        subagent,
        args.fresh ? "fresh" : registryEntry ? "resumed" : "new",
        registryEntry?.threadId ?? null,
        registryEntry?.threadId ?? null,
      ),
    );
  }

  const results: SubagentRunResult[] = new Array(spec.subagents.length);
  try {
    await runWithLimit(spec.subagents, args.maxParallel, async (subagent, index) => {
      const result = await runOneSubagent(spec, subagent, args, registryContext);
      results[index] = result;
      await writeAgentResult(args.runDir, result);
    });
  } catch (error: unknown) {
    manifest.status = "failed";
    await writeManifest(args.runDir, manifest);
    throw error;
  }

  const summary = buildSummary(spec, results);
  await writeFile(path.join(args.runDir, "summary.md"), summary, "utf-8");

  const boundaryViolations = results.flatMap((result) => result.boundaryViolations.map((filePath) => `${result.name}: ${filePath}`));
  const status = boundaryViolations.length > 0 ? "completed_with_boundary_violations" : "completed";
  manifest.status = status;
  await writeManifest(args.runDir, manifest);

  console.log(
    JSON.stringify(
      {
        status,
        runDir: args.runDir,
        registryPath: args.registryPath,
        latestRunPath: args.latestRunPath,
        subagents: results.map((result) => ({
          name: result.name,
          threadId: result.threadId,
          resumedFromThreadId: result.resumedFromThreadId,
          filesTouched: result.filesTouched,
          checksRun: result.checksRun,
          openRisks: result.openRisks,
          boundaryViolations: result.boundaryViolations,
        })),
      },
      null,
      2,
    ),
  );

  if (boundaryViolations.length > 0) {
    process.exitCode = 2;
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
