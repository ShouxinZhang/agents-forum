#!/usr/bin/env node

import { listAgentRuntimeEvents } from "../../../apps/forum-api/src/modules/agent-observer/runtime-events.mjs";
import { botAccounts } from "../../../apps/forum-api/src/modules/bot-auth/data.mjs";
import {
  getBotPolicyStatePath,
  readBotRuntimeState,
} from "../../../apps/forum-api/src/modules/mcp/forum-bot/policy.mjs";
import { pathToFileURL } from "node:url";

const defaults = {
  origin: process.env.FORUM_API_ORIGIN || "http://127.0.0.1:4174",
  threadId: process.env.FORUM_THREAD_ID || "",
  limit: Number.parseInt(process.env.FORUM_AUDIT_LIMIT || "8", 10),
};

function parseArgs(argv) {
  const options = {
    origin: defaults.origin,
    threadId: defaults.threadId,
    limit: defaults.limit,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--origin" && argv[index + 1]) {
      options.origin = argv[index + 1];
      index += 1;
      continue;
    }

    if (arg === "--thread-id" && argv[index + 1]) {
      options.threadId = argv[index + 1];
      index += 1;
      continue;
    }

    if (arg === "--limit" && argv[index + 1]) {
      options.limit = Number.parseInt(argv[index + 1], 10);
      index += 1;
      continue;
    }

    if (arg === "-h" || arg === "--help") {
      console.log(`Usage:
  node skills/forum-audit-viewer/scripts/view-audit.mjs [options]

Options:
  --origin <url>     forum-api origin, default: ${defaults.origin}
  --thread-id <id>   optional thread id
  --limit <count>    recent call limit per agent, default: ${defaults.limit}`);
      process.exit(0);
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      accept: "application/json",
    },
  });
  const payload = await response.json().catch(() => null);

  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.error || `HTTP ${response.status}`);
  }

  return payload.data;
}

function flattenReplies(replies, depth = 1) {
  return replies.flatMap((reply) => [
    {
      id: reply.id,
      author: reply.author,
      authorRole: reply.authorRole,
      content: reply.content,
      createdAt: reply.createdAt,
      parentId: reply.parentId || "",
      depth,
    },
    ...flattenReplies(reply.children || [], depth + 1),
  ]);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const botUsernames = new Set(botAccounts.map((bot) => bot.username));
  const agents = {};

  for (const bot of botAccounts) {
    if (!bot.agentId) {
      continue;
    }

    agents[bot.agentId] = {
      username: bot.username,
      displayName: bot.displayName,
      recentCalls: listAgentRuntimeEvents({
        agentId: bot.agentId,
        limit: options.limit,
      }),
    };
  }

  const report = {
    ok: true,
    skill: "forum-audit-viewer",
    origin: options.origin,
    threadId: options.threadId || null,
    botPolicyStatePath: getBotPolicyStatePath(),
    botPolicyState: readBotRuntimeState(),
    agents,
    threadBotReplies: [],
  };

  if (options.threadId) {
    const thread = await fetchJson(
      `${options.origin}/api/forum/threads/${encodeURIComponent(options.threadId)}`
    );

    report.thread = {
      id: thread.id,
      title: thread.title,
      author: thread.author,
      createdAt: thread.createdAt,
    };
    report.threadBotReplies = flattenReplies(thread.floors).filter((reply) =>
      botUsernames.has(reply.author)
    );
  }

  console.log(JSON.stringify(report, null, 2));
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
