#!/usr/bin/env node

import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const defaults = {
  origin: process.env.FORUM_API_ORIGIN || "http://127.0.0.1:4174",
  sectionId: process.env.FORUM_SECTION_ID || "arena",
  approvalMode: process.env.FORUM_BOT_APPROVAL_MODE || "auto",
  bots: (process.env.FORUM_MULTI_BOTS || "claw-a,claw-b,claw-c,claw-mod")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
};

function printHelp() {
  console.log(`Usage:
  node skills/multi-bot-runner/scripts/run.mjs [options]

Options:
  --origin <url>        forum-api origin, default: ${defaults.origin}
  --section-id <id>     feed section id, default: ${defaults.sectionId}
  --thread-id <id>      explicit thread id
  --approval-mode <m>   auto or manual, default: ${defaults.approvalMode}
  --bots <a,b,c>        bot usernames, default: ${defaults.bots.join(",")}
  -h, --help            show help`);
}

function parseArgs(argv) {
  const options = {
    origin: defaults.origin,
    sectionId: defaults.sectionId,
    threadId: "",
    approvalMode: defaults.approvalMode,
    bots: defaults.bots,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--origin" && argv[index + 1]) {
      options.origin = argv[index + 1];
      index += 1;
      continue;
    }

    if (arg === "--section-id" && argv[index + 1]) {
      options.sectionId = argv[index + 1];
      index += 1;
      continue;
    }

    if (arg === "--thread-id" && argv[index + 1]) {
      options.threadId = argv[index + 1];
      index += 1;
      continue;
    }

    if (arg === "--approval-mode" && argv[index + 1]) {
      options.approvalMode = argv[index + 1];
      index += 1;
      continue;
    }

    if (arg === "--bots" && argv[index + 1]) {
      options.bots = argv[index + 1]
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
      index += 1;
      continue;
    }

    if (arg === "-h" || arg === "--help") {
      printHelp();
      process.exit(0);
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(scriptDir, "..", "..", "..");
  const serverFile = path.join(
    repoRoot,
    "apps",
    "forum-api",
    "src",
    "modules",
    "mcp",
    "server.mjs"
  );
  const botAuthModule = await import(
    path.join(repoRoot, "apps", "forum-api", "src", "modules", "bot-auth", "data.mjs")
  );
  const safetyModule = await import(
    path.join(
      repoRoot,
      "skills",
      "bot-content-safety-check",
      "scripts",
      "check-content.mjs"
    )
  );
  const botPolicyModule = await import(
    path.join(
      repoRoot,
      "apps",
      "forum-api",
      "src",
      "modules",
      "mcp",
      "forum-bot",
      "policy.mjs"
    )
  );
  const workflowModule = await import(
    path.join(
      repoRoot,
      "apps",
      "forum-api",
      "src",
      "modules",
      "openclaw-orchestrator",
      "workflow.mjs"
    )
  );
  const availableBots = botAuthModule.botAccounts.filter((bot) =>
    options.bots.includes(bot.username)
  );
  const client = new Client({
    name: "multi-bot-runner",
    version: "0.1.0",
  });
  const transport = new StdioClientTransport({
    command: "node",
    args: [serverFile, "--origin", options.origin],
    cwd: repoRoot,
    stderr: "pipe",
    env: {
      ...(process.env.FORUM_API_RUNTIME_DIR
        ? { FORUM_API_RUNTIME_DIR: process.env.FORUM_API_RUNTIME_DIR }
        : {}),
    },
  });

  const report = {
    ok: false,
    skill: "multi-bot-runner",
    origin: options.origin,
    sectionId: options.sectionId,
    selectedThreadId: "",
    approvalMode: options.approvalMode,
    bots: [],
    auditTrail: [],
  };

  try {
    await client.connect(transport);

    const pageResult = await client.callTool({
      name: "get_forum_page",
      arguments: {
        sectionId: options.sectionId,
        agentId: "A",
      },
    });
    const pagePayload = pageResult.structuredContent;
    const selectedThreadId = workflowModule.chooseThread(pagePayload.threads, {
      explicitThreadId: options.threadId,
    });

    if (!selectedThreadId) {
      throw new Error("No thread available for multi-bot run");
    }

    report.selectedThreadId = selectedThreadId;

    for (const bot of availableBots) {
      const openThread = await client.callTool({
        name: "open_thread",
        arguments: {
          threadId: selectedThreadId,
          agentId: bot.agentId || undefined,
        },
      });
      const threadPayload = openThread.structuredContent;

      const replies = await client.callTool({
        name: "get_replies",
        arguments: {
          threadId: selectedThreadId,
          agentId: bot.agentId || undefined,
        },
      });
      const repliesPayload = replies.structuredContent;
      const target = workflowModule.chooseReplyTarget(bot, repliesPayload.replies ?? []);
      const entry = {
        username: bot.username,
        displayName: bot.displayName,
        canWrite: bot.canWrite,
        contextSources: bot.contextSources ?? [],
        feedAuditId: pagePayload.auditId,
        openThreadAuditId: threadPayload.auditId,
        getRepliesAuditId: repliesPayload.auditId,
        scopedRepliesAuditId: "",
        replyAuditId: "",
        status: "read",
        summary: "",
        target,
      };

      if (!bot.canWrite) {
        entry.status = "read_only";
        entry.summary = "bot policy is read-only";
        report.bots.push(entry);
        continue;
      }

      if (target.floorId) {
        const scopedReplies = await client.callTool({
          name: "get_replies",
          arguments: {
            threadId: selectedThreadId,
            floorId: target.floorId,
            agentId: bot.agentId || undefined,
          },
        });
        entry.scopedRepliesAuditId = scopedReplies.structuredContent?.auditId || "";
      }

      const replyContent = workflowModule.buildReplyContent(
        bot,
        threadPayload,
        repliesPayload.replyCount,
        target
      );
      entry.policy = botPolicyModule.evaluateBotAction({
        bot,
        threadId: selectedThreadId,
        approvalMode: options.approvalMode,
      });

      if (!entry.policy.ok) {
        entry.status = entry.policy.decision;
        entry.summary = entry.policy.reasons.join(" / ") || entry.policy.decision;
        botPolicyModule.recordBotAction({
          bot,
          threadId: selectedThreadId,
          status: entry.policy.decision,
          content: replyContent,
          target,
          approvalMode: options.approvalMode,
        });
        report.bots.push(entry);
        continue;
      }

      const safetyResult = safetyModule.evaluateReplyCandidate({
        actor: bot.username,
        content: replyContent,
        threadTitle: threadPayload.thread.title,
        rootContent: threadPayload.thread.rootPost?.content || "",
        existingReplies: workflowModule.collectReplyTexts(repliesPayload.replies ?? []),
        hasOpenedThread: true,
        hasReadReplies: true,
        replyCount: repliesPayload.replyCount,
      });

      entry.safety = safetyResult;

      if (!safetyResult.ok) {
        entry.status = "blocked";
        entry.summary = safetyResult.reasons.join(" / ") || "blocked by safety check";
        report.bots.push(entry);
        continue;
      }

      const replyResult = await client.callTool({
        name: "reply",
        arguments: {
          threadId: selectedThreadId,
          content: replyContent,
          floorId: target.floorId,
          replyId: target.replyId,
          actor: bot.username,
          agentId: bot.agentId || undefined,
        },
      });
      const replyPayload = replyResult.structuredContent;

      entry.replyAuditId = replyPayload.auditId;
      entry.status = "replied";
      entry.summary = `${bot.username} replied as ${replyPayload.actor.username}`;
      botPolicyModule.recordBotAction({
        bot,
        threadId: selectedThreadId,
        auditId: replyPayload.auditId,
        status: "replied",
        content: replyContent,
        target,
        approvalMode: options.approvalMode,
      });
      report.bots.push(entry);
    }

    const auditResult = await client.callTool({
      name: "get_audit_log",
      arguments: {
        limit: 50,
      },
    });
    report.auditTrail = auditResult.structuredContent.entries;

    report.ok = true;
  } catch (error) {
    report.error = error instanceof Error ? error.message : String(error);
  } finally {
    await client.close().catch(() => {});
    await transport.close().catch(() => {});
  }

  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}

function isDirectExecution() {
  if (!process.argv[1]) {
    return false;
  }

  return import.meta.url === pathToFileURL(process.argv[1]).href;
}

if (isDirectExecution()) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.stack ?? error.message : String(error));
    process.exit(1);
  });
}
