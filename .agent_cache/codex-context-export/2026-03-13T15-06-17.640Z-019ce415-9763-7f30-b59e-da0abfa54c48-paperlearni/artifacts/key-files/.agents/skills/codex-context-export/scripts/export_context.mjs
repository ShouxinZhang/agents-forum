#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

function parseArgs(argv) {
  const args = {
    latest: false,
    sessionId: "",
    threadName: "",
    outputDir: "",
    codexHome: path.join(os.homedir(), ".codex"),
    goal: "",
    completed: [],
    next: [],
    risks: [],
    keyFiles: [],
    commands: [],
    artifacts: [],
    subagentRunDirs: [],
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];
    switch (token) {
      case "--latest":
        args.latest = true;
        break;
      case "--session-id":
        args.sessionId = next ?? "";
        index += 1;
        break;
      case "--thread-name":
        args.threadName = next ?? "";
        index += 1;
        break;
      case "--output-dir":
        args.outputDir = next ?? "";
        index += 1;
        break;
      case "--codex-home":
        args.codexHome = next ? path.resolve(next) : args.codexHome;
        index += 1;
        break;
      case "--goal":
        args.goal = next ?? "";
        index += 1;
        break;
      case "--completed":
        args.completed.push(next ?? "");
        index += 1;
        break;
      case "--next":
        args.next.push(next ?? "");
        index += 1;
        break;
      case "--risk":
        args.risks.push(next ?? "");
        index += 1;
        break;
      case "--key-file":
        args.keyFiles.push(next ?? "");
        index += 1;
        break;
      case "--command":
        args.commands.push(next ?? "");
        index += 1;
        break;
      case "--artifact":
        args.artifacts.push(next ?? "");
        index += 1;
        break;
      case "--subagent-run-dir":
        args.subagentRunDirs.push(next ?? "");
        index += 1;
        break;
      case "--help":
        printHelp();
        process.exit(0);
      default:
        throw new Error(`Unknown argument: ${token}`);
    }
  }

  return args;
}

function printHelp() {
  console.log(`Usage:
  node .agents/skills/codex-context-export/scripts/export_context.mjs --latest
  node .agents/skills/codex-context-export/scripts/export_context.mjs --session-id <id>
  node .agents/skills/codex-context-export/scripts/export_context.mjs --thread-name <text>

Optional:
  --output-dir <path>
  --codex-home <path>
  --goal <text>
  --completed <text>   (repeatable)
  --next <text>        (repeatable)
  --risk <text>        (repeatable)
  --key-file <path>    (repeatable)
  --command <text>     (repeatable)
  --artifact <path>    (repeatable)
  --subagent-run-dir <path|latest> (repeatable)
`);
}

function readJsonl(filePath) {
  if (!fs.existsSync(filePath)) {
    return [];
  }
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
}

function walkFiles(rootDir) {
  if (!fs.existsSync(rootDir)) {
    return [];
  }
  const files = [];
  const stack = [rootDir];
  while (stack.length > 0) {
    const current = stack.pop();
    const stat = fs.statSync(current);
    if (stat.isDirectory()) {
      for (const entry of fs.readdirSync(current)) {
        stack.push(path.join(current, entry));
      }
    } else if (stat.isFile()) {
      files.push(current);
    }
  }
  return files.sort();
}

function slugify(value) {
  return String(value || "export")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "export";
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function copyFileIfExists(sourcePath, destPath, missing, label) {
  if (!sourcePath || !fs.existsSync(sourcePath)) {
    missing.push(label);
    return false;
  }
  ensureDir(path.dirname(destPath));
  fs.copyFileSync(sourcePath, destPath);
  return true;
}

function copyPath(sourcePath, destPath) {
  ensureDir(path.dirname(destPath));
  fs.cpSync(sourcePath, destPath, { recursive: true });
}

function pickSession(entries, args) {
  if (args.sessionId) {
    const direct = entries.find((entry) => entry.id === args.sessionId);
    if (!direct) {
      throw new Error(`Session id not found in session index: ${args.sessionId}`);
    }
    return direct;
  }

  if (args.threadName) {
    const needle = args.threadName.toLowerCase();
    const match = [...entries]
      .filter((entry) => String(entry.thread_name || "").toLowerCase().includes(needle))
      .sort((left, right) => String(right.updated_at || "").localeCompare(String(left.updated_at || "")))[0];
    if (!match) {
      throw new Error(`No session matched thread name: ${args.threadName}`);
    }
    return match;
  }

  const latest = [...entries].sort((left, right) => String(right.updated_at || "").localeCompare(String(left.updated_at || "")))[0];
  if (!latest) {
    throw new Error("No session entries were found in ~/.codex/session_index.jsonl");
  }
  return latest;
}

function findSessionTranscript(codexHome, sessionId) {
  const files = walkFiles(path.join(codexHome, "sessions"));
  return files.find((filePath) => filePath.endsWith(".jsonl") && path.basename(filePath).includes(sessionId)) || "";
}

function findArchivedTranscript(codexHome, sessionId) {
  const files = walkFiles(path.join(codexHome, "archived_sessions"));
  return files.find((filePath) => filePath.endsWith(".jsonl") && path.basename(filePath).includes(sessionId)) || "";
}

function resolveLatestSubagentRun(repoRoot) {
  const rootDir = path.join(repoRoot, ".agent_cache", "codex-subagents-simple");
  if (!fs.existsSync(rootDir)) {
    return "";
  }
  const candidates = fs
    .readdirSync(rootDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(rootDir, entry.name))
    .sort((left, right) => fs.statSync(right).mtimeMs - fs.statSync(left).mtimeMs);
  return candidates[0] || "";
}

function normalizeExtraPaths(paths, repoRoot) {
  return paths
    .map((value) => {
      if (!value) {
        return "";
      }
      if (value === "latest") {
        return resolveLatestSubagentRun(repoRoot);
      }
      return path.isAbsolute(value) ? value : path.resolve(repoRoot, value);
    })
    .filter(Boolean);
}

function writeJson(filePath, value) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function writeMarkdown(filePath, lines) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${lines.join("\n").trim()}\n`, "utf8");
}

function listOrFallback(items, fallback = "- None") {
  if (!items || items.length === 0) {
    return [fallback];
  }
  return items.map((item) => `- ${item}`);
}

function relativeToRepo(filePath, repoRoot) {
  if (!filePath) {
    return "";
  }
  return path.isAbsolute(filePath) ? path.relative(repoRoot, filePath) || "." : filePath;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = process.cwd();
  const codexHome = args.codexHome;

  const sessionIndexPath = path.join(codexHome, "session_index.jsonl");
  const historyPath = path.join(codexHome, "history.jsonl");
  const sessionEntries = readJsonl(sessionIndexPath);
  const selectedSession = pickSession(sessionEntries, args);
  const sessionId = selectedSession.id;
  const transcriptPath = findSessionTranscript(codexHome, sessionId);
  const archivedPath = findArchivedTranscript(codexHome, sessionId);
  const historyEntries = readJsonl(historyPath).filter((entry) => entry.session_id === sessionId);
  const subagentRunDirs = normalizeExtraPaths(args.subagentRunDirs, repoRoot);
  const keyFiles = normalizeExtraPaths(args.keyFiles, repoRoot);
  const artifactFiles = normalizeExtraPaths(args.artifacts, repoRoot);

  const stamp = new Date().toISOString().replaceAll(":", "-");
  const exportSlug = slugify(`${sessionId}-${selectedSession.thread_name || "session"}`);
  const outputDir = args.outputDir
    ? path.resolve(repoRoot, args.outputDir)
    : path.join(repoRoot, ".agent_cache", "codex-context-export", `${stamp}-${exportSlug}`);
  const rawDir = path.join(outputDir, "raw");
  const artifactsDir = path.join(outputDir, "artifacts");
  const missing = [];

  ensureDir(rawDir);
  ensureDir(artifactsDir);

  copyFileIfExists(sessionIndexPath, path.join(rawDir, "session-index.full.jsonl"), missing, "session_index.jsonl");
  writeJson(path.join(rawDir, "session-index.entry.json"), selectedSession);
  fs.writeFileSync(path.join(rawDir, "history.filtered.jsonl"), `${historyEntries.map((entry) => JSON.stringify(entry)).join("\n")}${historyEntries.length ? "\n" : ""}`, "utf8");
  copyFileIfExists(transcriptPath, path.join(rawDir, "selected-session.jsonl"), missing, "selected session transcript");
  copyFileIfExists(archivedPath, path.join(rawDir, "archived-session.jsonl"), missing, "archived session transcript");

  const notes = [
    "This export contains locally visible Codex traces only.",
    "It does not claim access to hidden in-memory compacted context that may not be persisted on disk.",
    `Selected session id: ${sessionId}`,
    `Selected thread name: ${selectedSession.thread_name || ""}`,
    `Selected transcript path: ${transcriptPath || "(not found)"}`,
    `Selected archived transcript path: ${archivedPath || "(not found)"}`,
  ];
  fs.writeFileSync(path.join(rawDir, "notes.txt"), `${notes.join("\n")}\n`, "utf8");

  const copiedKeyFiles = [];
  for (const filePath of keyFiles) {
    if (!fs.existsSync(filePath)) {
      missing.push(`key file: ${filePath}`);
      continue;
    }
    const targetPath = path.join(artifactsDir, "key-files", relativeToRepo(filePath, repoRoot));
    copyPath(filePath, targetPath);
    copiedKeyFiles.push(filePath);
  }

  const copiedArtifacts = [];
  for (const filePath of artifactFiles) {
    if (!fs.existsSync(filePath)) {
      missing.push(`artifact: ${filePath}`);
      continue;
    }
    const targetPath = path.join(artifactsDir, "outputs", relativeToRepo(filePath, repoRoot));
    copyPath(filePath, targetPath);
    copiedArtifacts.push(filePath);
  }

  const copiedSubagentRuns = [];
  for (const runDir of subagentRunDirs) {
    if (!fs.existsSync(runDir)) {
      missing.push(`subagent run dir: ${runDir}`);
      continue;
    }
    const targetPath = path.join(artifactsDir, "subagents", path.basename(runDir));
    copyPath(runDir, targetPath);
    copiedSubagentRuns.push(runDir);
  }

  const manifest = {
    exportedAt: new Date().toISOString(),
    repoRoot,
    codexHome,
    selection: {
      sessionId,
      threadName: selectedSession.thread_name || "",
      updatedAt: selectedSession.updated_at || "",
      latestMode: !args.sessionId && !args.threadName,
    },
    sources: {
      sessionIndexPath,
      historyPath,
      transcriptPath,
      archivedPath,
    },
    exportedFiles: {
      outputDir,
      rawDir,
      handoffPath: path.join(outputDir, "handoff.md"),
      copiedKeyFiles,
      copiedArtifacts,
      copiedSubagentRuns,
    },
    missing,
  };
  writeJson(path.join(outputDir, "manifest.json"), manifest);

  const handoffLines = [
    "# Codex Context Handoff",
    "",
    "## Session",
    "",
    `- Session ID: \`${sessionId}\``,
    `- Thread Name: ${selectedSession.thread_name || "(unknown)"}`,
    `- Updated At: ${selectedSession.updated_at || "(unknown)"}`,
    `- Transcript: ${transcriptPath || "(not found)"}`,
    `- Archived Transcript: ${archivedPath || "(not found)"}`,
    `- Export Directory: ${outputDir}`,
    "",
    "## Goal",
    "",
    ...(args.goal ? [args.goal] : ["No explicit goal was provided."]),
    "",
    "## Completed",
    "",
    ...listOrFallback(args.completed),
    "",
    "## Pending / Next",
    "",
    ...listOrFallback(args.next),
    "",
    "## Risks",
    "",
    ...listOrFallback(args.risks),
    "",
    "## Key Files",
    "",
    ...listOrFallback(copiedKeyFiles.map((filePath) => relativeToRepo(filePath, repoRoot))),
    "",
    "## Commands",
    "",
    ...listOrFallback(args.commands.map((command) => `\`${command}\``)),
    "",
    "## Output Artifacts",
    "",
    ...listOrFallback(copiedArtifacts.map((filePath) => relativeToRepo(filePath, repoRoot))),
    "",
    "## Subagent Runs",
    "",
    ...listOrFallback(copiedSubagentRuns.map((runDir) => relativeToRepo(runDir, repoRoot))),
    "",
    "## Raw Export Notes",
    "",
    ...notes.map((note) => `- ${note}`),
    "",
    "## Missing Pieces",
    "",
    ...listOrFallback(missing, "- None"),
  ];
  writeMarkdown(path.join(outputDir, "handoff.md"), handoffLines);

  console.log(
    JSON.stringify(
      {
        ok: true,
        outputDir,
        sessionId,
        threadName: selectedSession.thread_name || "",
        transcriptFound: Boolean(transcriptPath),
        archivedFound: Boolean(archivedPath),
        historyCount: historyEntries.length,
        copiedKeyFiles: copiedKeyFiles.length,
        copiedArtifacts: copiedArtifacts.length,
        copiedSubagentRuns: copiedSubagentRuns.length,
        missing,
      },
      null,
      2,
    ),
  );
}

main();
