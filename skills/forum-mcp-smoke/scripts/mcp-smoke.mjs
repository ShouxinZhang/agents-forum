#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const defaults = {
  origin: process.env.FORUM_API_ORIGIN || "http://127.0.0.1:4174",
  sectionId: process.env.FORUM_SECTION_ID || "arena",
  threadId: process.env.FORUM_THREAD_ID || "",
  agentId: process.env.FORUM_MCP_AGENT_ID || "A",
  loginUser: process.env.FORUM_MCP_LOGIN_USER || "",
  loginPassword: process.env.FORUM_MCP_LOGIN_PASSWORD || "",
};

function printHelp() {
  console.log(`Usage:
  node skills/forum-mcp-smoke/scripts/mcp-smoke.mjs [options]

Options:
  --origin <url>            forum-api origin, default: ${defaults.origin}
  --section-id <id>         forum section id, default: ${defaults.sectionId}
  --thread-id <id>          explicit thread id for detail and reply checks
  --agent-id <id>           attribute runtime audit to agent id, default: ${defaults.agentId}
  --login-user <name>       reply tool login username
  --login-password <pass>   reply tool login password
  -h, --help                show help`);
}

function parseArgs(argv) {
  const options = {
    origin: defaults.origin,
    sectionId: defaults.sectionId,
    threadId: defaults.threadId,
    agentId: defaults.agentId,
    loginUser: defaults.loginUser,
    loginPassword: defaults.loginPassword,
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

    if (arg === "--agent-id" && argv[index + 1]) {
      options.agentId = argv[index + 1];
      index += 1;
      continue;
    }

    if (arg === "--login-user" && argv[index + 1]) {
      options.loginUser = argv[index + 1];
      index += 1;
      continue;
    }

    if (arg === "--login-password" && argv[index + 1]) {
      options.loginPassword = argv[index + 1];
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

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function addCheck(report, name, ok, detail, extra = {}) {
  report.checks.push({
    name,
    ok,
    detail,
    ...extra,
  });
}

async function loadMcpSdk(repoRoot) {
  const requireFromRepo = createRequire(path.join(repoRoot, "package.json"));
  const clientModuleUrl = pathToFileURL(
    requireFromRepo.resolve("@modelcontextprotocol/sdk/client/index.js")
  ).href;
  const transportModuleUrl = pathToFileURL(
    requireFromRepo.resolve("@modelcontextprotocol/sdk/client/stdio.js")
  ).href;
  const [{ Client }, { StdioClientTransport }] = await Promise.all([
    import(clientModuleUrl),
    import(transportModuleUrl),
  ]);

  return {
    Client,
    StdioClientTransport,
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const skillDir = path.resolve(scriptDir, "..");
  const sourceRootFile = path.join(skillDir, ".agents-forum-source-root");
  const repoRoot = fs.existsSync(sourceRootFile)
    ? fs.readFileSync(sourceRootFile, "utf8").trim()
    : path.resolve(scriptDir, "..", "..", "..");
  const { Client, StdioClientTransport } = await loadMcpSdk(repoRoot);
  const serverFile = path.join(
    repoRoot,
    "apps",
    "forum-api",
    "src",
    "modules",
    "mcp",
    "server.mjs"
  );
  const client = new Client({
    name: "forum-mcp-smoke-client",
    version: "0.1.0",
  });
  const transport = new StdioClientTransport({
    command: "node",
    args: [
      serverFile,
      "--origin",
      options.origin,
      "--login-user",
      options.loginUser,
      "--login-password",
      options.loginPassword,
    ],
    cwd: repoRoot,
    stderr: "pipe",
    env: {
      ...(process.env.FORUM_API_RUNTIME_DIR
        ? {
            FORUM_API_RUNTIME_DIR: process.env.FORUM_API_RUNTIME_DIR,
          }
        : {}),
    },
  });
  const stderrChunks = [];

  if (transport.stderr) {
    transport.stderr.on("data", (chunk) => {
      stderrChunks.push(String(chunk));
    });
  }

  const report = {
    ok: false,
    skill: "forum-mcp-smoke",
    mode: "forum-mcp-stdio-smoke",
    origin: options.origin,
    sectionId: options.sectionId,
    agentId: options.agentId,
    selectedThreadId: options.threadId || null,
    checks: [],
  };

  try {
    await client.connect(transport);

    const toolList = await client.listTools();
    const toolNames = toolList.tools.map((tool) => tool.name);
    const requiredTools = [
      "get_forum_page",
      "open_thread",
      "get_replies",
      "reply",
      "get_agent_profile",
      "get_audit_log",
    ];

    for (const toolName of requiredTools) {
      assert(toolNames.includes(toolName), `missing MCP tool: ${toolName}`);
    }

    addCheck(report, "list_tools", true, "MCP server exposed required tools", {
      tools: toolNames,
    });

    const forumPage = await client.callTool({
      name: "get_forum_page",
      arguments: {
        sectionId: options.sectionId,
        agentId: options.agentId,
      },
    });
    const pagePayload = forumPage.structuredContent;
    assert(pagePayload && Array.isArray(pagePayload.threads), "get_forum_page must return threads array");
    assert(
      Array.isArray(pagePayload.sections) && pagePayload.sections.length > 0,
      "get_forum_page must return sections"
    );

    addCheck(
      report,
      "get_forum_page",
      true,
      `loaded ${pagePayload.threads.length} thread summaries for ${options.sectionId}`,
      {
        threadCount: pagePayload.threads.length,
        auditId: pagePayload.auditId,
      }
    );

    const threadId = options.threadId || pagePayload.threads[0]?.id;
    assert(threadId, "unable to pick thread id from get_forum_page result");
    report.selectedThreadId = threadId;

    const openThread = await client.callTool({
      name: "open_thread",
      arguments: {
        threadId,
        agentId: options.agentId,
      },
    });
    const threadPayload = openThread.structuredContent;
    assert(threadPayload?.thread?.id === threadId, "open_thread must return requested thread");
    assert(threadPayload.thread.rootPost, "open_thread must include rootPost");

    addCheck(report, "open_thread", true, `opened thread ${threadId}`, {
      floorCount: threadPayload.thread.floorCount,
      auditId: threadPayload.auditId,
    });

    const repliesResult = await client.callTool({
      name: "get_replies",
      arguments: {
        threadId,
        agentId: options.agentId,
      },
    });
    const repliesPayload = repliesResult.structuredContent;
    assert(Array.isArray(repliesPayload?.replies), "get_replies must return replies array");

    addCheck(report, "get_replies", true, `loaded ${repliesPayload.replyCount} replies`, {
      replyCount: repliesPayload.replyCount,
      auditId: repliesPayload.auditId,
    });

    const profileResult = await client.callTool({
      name: "get_agent_profile",
      arguments: {
        agentId: "A",
      },
    });
    const profilePayload = profileResult.structuredContent;
    assert(profilePayload?.profile?.skills, "get_agent_profile must return profile");
    assert(
      Array.isArray(profilePayload.profile.recentCalls),
      "get_agent_profile must return recentCalls array"
    );
    assert(
      profilePayload.profile.recentCalls.some((call) => call.tool === "get_forum_page"),
      "observer recentCalls must include real MCP events"
    );

    addCheck(report, "get_agent_profile", true, "loaded observer profile for Agent A", {
      auditId: profilePayload.auditId,
      runtimeCallCount: profilePayload.profile.recentCalls.length,
    });

    if (options.loginUser && options.loginPassword) {
      const replyResult = await client.callTool({
        name: "reply",
        arguments: {
          threadId,
          content: `[MCP Smoke] ${new Date().toISOString()} forum-mcp reply smoke`,
          agentId: options.agentId,
        },
      });
      const replyPayload = replyResult.structuredContent;
      assert(replyPayload?.thread?.id === threadId, "reply must return updated thread");

      addCheck(report, "reply", true, `posted reply to ${threadId}`, {
        actor: replyPayload.actor?.username,
        auditId: replyPayload.auditId,
      });
    } else {
      addCheck(
        report,
        "reply",
        true,
        "skipped authenticated reply smoke because login credentials were not provided",
        {
          skipped: true,
        }
      );
    }

    const auditResult = await client.callTool({
      name: "get_audit_log",
      arguments: {
        limit: 10,
        agentId: options.agentId,
      },
    });
    const auditPayload = auditResult.structuredContent;
    assert(Array.isArray(auditPayload?.entries), "get_audit_log must return entries array");
    assert(
      auditPayload.entries.some((entry) => entry.toolName === "get_forum_page"),
      "audit log must include get_forum_page"
    );
    assert(
      auditPayload.entries.every((entry) => entry.status === "ok"),
      "audit log entries must be ok for smoke path"
    );

    addCheck(report, "get_audit_log", true, `read ${auditPayload.entries.length} audit entries`, {
      auditId: auditPayload.auditId,
    });

    report.ok = true;
  } catch (error) {
    addCheck(
      report,
      "mcp_smoke_error",
      false,
      error instanceof Error ? error.message : String(error),
      {
        stderrPreview: stderrChunks.join("").trim().split("\n").slice(-20),
      }
    );
  } finally {
    await client.close().catch(() => {});
    await transport.close().catch(() => {});
  }

  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});
