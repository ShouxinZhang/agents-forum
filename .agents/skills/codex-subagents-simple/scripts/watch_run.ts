import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

type Args = {
  runDir: string | null;
  intervalMs: number;
  once: boolean;
};

type LatestRunPointer = {
  version: 1;
  runDir: string;
};

type RunManifest = {
  version: 1;
  task: string;
  specPath: string;
  workspaceRoot: string;
  createdAt: string;
  updatedAt: string;
  model: string;
  reasoningEffort: string;
  status: string;
  fresh: boolean;
  subagents: Array<{
    name: string;
    mission: string;
    statusPath: string;
    eventsPath: string;
    resultPath: string;
  }>;
};

type SubagentLiveStatus = {
  version: 1;
  name: string;
  mission: string;
  state: string;
  resumeMode: string;
  threadId: string | null;
  resumedFromThreadId: string | null;
  startedAt: string | null;
  updatedAt: string;
  completedAt: string | null;
  currentItemType: string | null;
  currentItemStatus: string | null;
  currentItemText: string | null;
  latestCommand: { command: string; status: string; exitCode?: number; updatedAt: string } | null;
  latestFileChange: { paths: string[]; status: string; updatedAt: string } | null;
  latestAgentMessage: { text: string; updatedAt: string } | null;
  latestReasoning: { text: string; updatedAt: string } | null;
  latestTodo: { text: string[]; updatedAt: string } | null;
  latestEvent: string | null;
  lastError: string | null;
  filesTouched: string[];
  checksRun: string[];
  openRisks: string[];
  boundaryViolations: string[];
  finalSummaryMarkdown: string | null;
};

function parseArgs(argv: string[]): Args {
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

  const intervalMs = Number(args.get("interval-ms") ?? "1000");
  if (!Number.isFinite(intervalMs) || intervalMs <= 0) {
    throw new Error("--interval-ms must be a positive number");
  }

  return {
    runDir: args.get("run-dir") ? path.resolve(args.get("run-dir")!) : null,
    intervalMs,
    once: args.get("once") === "true",
  };
}

async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await readFile(filePath, "utf-8");
    return JSON.parse(raw) as T;
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

async function resolveRunDir(args: Args): Promise<string> {
  if (args.runDir) {
    return args.runDir;
  }
  const latest = await readJsonFile<LatestRunPointer>(path.resolve(".agent_cache/codex-subagents-simple/latest-run.json"));
  if (!latest?.runDir) {
    throw new Error("missing latest run pointer; pass --run-dir explicitly");
  }
  return latest.runDir;
}

function formatTime(value: string | null): string {
  if (!value) {
    return "-";
  }
  return value.replace("T", " ").replace("Z", " UTC");
}

function shortId(value: string | null): string {
  if (!value) {
    return "-";
  }
  return value.length <= 16 ? value : `${value.slice(0, 8)}...${value.slice(-6)}`;
}

function divider(char = "─", width = 88): string {
  return char.repeat(width);
}

async function collectStatusFiles(runDir: string): Promise<string[]> {
  const agentsDir = path.join(runDir, "agents");
  try {
    const names = await readdir(agentsDir);
    return names.filter((name) => name.endsWith(".status.json")).map((name) => path.join(agentsDir, name)).sort();
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

function renderStatusCard(status: SubagentLiveStatus): string[] {
  const lines = [
    `${status.name}  [${status.state}]  resume=${status.resumeMode}  thread=${shortId(status.threadId)}`,
    `  started: ${formatTime(status.startedAt)}  updated: ${formatTime(status.updatedAt)}  done: ${formatTime(status.completedAt)}`,
    `  current: ${status.currentItemType ?? "-"} / ${status.currentItemStatus ?? "-"} / ${status.currentItemText ?? "-"}`,
    `  latest event: ${status.latestEvent ?? "-"}`,
  ];

  if (status.latestCommand) {
    lines.push(`  cmd: ${status.latestCommand.status} :: ${status.latestCommand.command}`);
  }
  if (status.latestFileChange) {
    lines.push(`  files: ${status.latestFileChange.status} :: ${status.latestFileChange.paths.join(", ")}`);
  }
  if (status.latestReasoning) {
    lines.push(`  reasoning: ${status.latestReasoning.text}`);
  }
  if (status.latestAgentMessage) {
    lines.push(`  message: ${status.latestAgentMessage.text}`);
  }
  if (status.latestTodo && status.latestTodo.text.length > 0) {
    lines.push(`  todo: ${status.latestTodo.text.join(" | ")}`);
  }
  if (status.lastError) {
    lines.push(`  error: ${status.lastError}`);
  }
  if (status.finalSummaryMarkdown) {
    lines.push(`  summary: ${status.finalSummaryMarkdown}`);
  }
  if (status.filesTouched.length > 0) {
    lines.push(`  touched: ${status.filesTouched.join(", ")}`);
  }
  if (status.openRisks.length > 0) {
    lines.push(`  risks: ${status.openRisks.join(" | ")}`);
  }

  return lines;
}

function clearScreen(): void {
  if (process.stdout.isTTY) {
    process.stdout.write("\x1Bc");
  }
}

async function render(runDir: string): Promise<{ done: boolean; output: string }> {
  const manifest = await readJsonFile<RunManifest>(path.join(runDir, "run.json"));
  const statusFiles = await collectStatusFiles(runDir);
  const statuses = (await Promise.all(statusFiles.map((filePath) => readJsonFile<SubagentLiveStatus>(filePath)))).filter(
    (value): value is SubagentLiveStatus => value !== null,
  );
  const expectedCount = manifest?.subagents.length ?? statuses.length;
  const completedCount = statuses.filter((status) => status.state === "completed").length;
  const failedCount = statuses.filter((status) => status.state === "failed").length;
  const runningCount = statuses.filter((status) => status.state === "running").length;
  const queuedCount = Math.max(0, expectedCount - completedCount - failedCount - runningCount);
  const done =
    (manifest?.status === "completed" || manifest?.status === "completed_with_boundary_violations" || manifest?.status === "failed") &&
    statuses.length >= expectedCount &&
    statuses.every((status) => status.state === "completed" || status.state === "failed");

  const lines = [
    `Subagent Watch`,
    divider(),
    `runDir: ${runDir}`,
    `task: ${manifest?.task ?? "-"}`,
    `status: ${manifest?.status ?? "unknown"}  model=${manifest?.model ?? "-"}  fresh=${manifest?.fresh ?? "-"}`,
    `agents: total=${expectedCount} running=${runningCount} queued=${queuedCount} completed=${completedCount} failed=${failedCount}`,
    divider(),
  ];

  if (statuses.length === 0) {
    lines.push("No subagent status files yet.");
  }

  for (const status of statuses) {
    lines.push(...renderStatusCard(status));
    lines.push(divider("·"));
  }

  if (manifest?.subagents) {
    const known = new Set(statuses.map((status) => status.name));
    for (const subagent of manifest.subagents) {
      if (!known.has(subagent.name)) {
        lines.push(`${subagent.name}  [queued]  waiting for first status file`);
        lines.push(divider("·"));
      }
    }
  }

  return {
    done,
    output: lines.join("\n"),
  };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const runDir = await resolveRunDir(args);

  while (true) {
    const { done, output } = await render(runDir);
    clearScreen();
    process.stdout.write(output + "\n");
    if (args.once || done) {
      return;
    }
    await delay(args.intervalMs);
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
