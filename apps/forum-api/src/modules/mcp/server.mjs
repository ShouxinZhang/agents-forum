import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { appendAgentRuntimeEvent } from "../agent-observer/runtime-events.mjs";
import { resolveUserCredentials } from "../auth/data.mjs";
import { createAuditLog } from "./audit-log.mjs";
import { createMcpConfig } from "./config.mjs";
import { createForumMcpClient } from "./forum-client.mjs";

function pickArg(args, flag) {
  const index = args.indexOf(flag);
  if (index >= 0 && index + 1 < args.length) {
    return args[index + 1];
  }

  return undefined;
}

function printHelp() {
  console.error(`Usage:
  node apps/forum-api/src/modules/mcp/server.mjs [options]

Options:
  --origin <url>            forum-api origin, default: http://127.0.0.1:4174
  --login-user <name>       optional username for authenticated reply tool
  --login-password <pass>   optional password for authenticated reply tool
  --timeout-ms <ms>         request timeout in milliseconds
  --audit-limit <count>     max in-memory audit entries
  -h, --help                show help`);
}

function createTextResult(payload) {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(payload, null, 2),
      },
    ],
    structuredContent: payload,
  };
}

function resolveActorCredentials(actor) {
  if (!actor) {
    return {};
  }

  const user = resolveUserCredentials(actor.trim());
  if (!user) {
    throw new Error(`Unknown actor: ${actor}`);
  }

  return {
    username: user.username,
    password: user.password,
  };
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes("-h") || args.includes("--help")) {
    printHelp();
    process.exit(0);
  }

  const config = createMcpConfig({
    origin: pickArg(args, "--origin"),
    loginUser: pickArg(args, "--login-user"),
    loginPassword: pickArg(args, "--login-password"),
    timeoutMs: pickArg(args, "--timeout-ms"),
    auditLimit: pickArg(args, "--audit-limit"),
  });

  const auditLog = createAuditLog(config.auditLimit, {
    persistEvent: appendAgentRuntimeEvent,
  });
  const forumClient = createForumMcpClient(config);
  const server = new McpServer({
    name: "forum-mcp",
    version: "0.1.0",
  });

  server.tool(
    "get_forum_page",
    "读取论坛 Feed 摘要页。先看板块和标题摘要，再决定是否打开详情。",
    {
      sectionId: z.string().optional().describe("可选，板块 id，例如 arena"),
      agentId: z.string().optional().describe("可选，记录调用归属的 Agent id"),
    },
    async ({ sectionId, agentId }) => {
      const { entry, payload } = await auditLog.run(
        "get_forum_page",
        { sectionId, agentId },
        async () => {
          const page = await forumClient.getForumPage({
            sectionId: sectionId?.trim() || undefined,
          });
          return {
            summary: `section=${page.selectedSectionId ?? "all"} threads=${page.threads.length}`,
            payload: {
              ...page,
              auditId: "",
            },
          };
        },
        { agentId: agentId?.trim() || undefined }
      );

      payload.auditId = entry.id;
      return createTextResult(payload);
    }
  );

  server.tool(
    "open_thread",
    "打开某个帖子详情，但保持结果聚焦在线程元信息和首楼，不替代专门的 replies 读取。",
    {
      threadId: z.string().min(1).describe("帖子 id"),
      agentId: z.string().optional().describe("可选，记录调用归属的 Agent id"),
    },
    async ({ threadId, agentId }) => {
      const { entry, payload } = await auditLog.run(
        "open_thread",
        { threadId, agentId },
        async () => {
          const result = await forumClient.openThread({ threadId: threadId.trim() });
          return {
            summary: `thread=${threadId} topFloors=${result.thread.floorCount}`,
            payload: {
              ...result,
              auditId: "",
            },
          };
        },
        { agentId: agentId?.trim() || undefined }
      );

      payload.auditId = entry.id;
      return createTextResult(payload);
    }
  );

  server.tool(
    "get_replies",
    "读取帖子楼层。默认返回全部顶层楼层；传 floorId 时返回该楼层子树。",
    {
      threadId: z.string().min(1).describe("帖子 id"),
      floorId: z.string().optional().describe("可选，限定某个顶层楼层 id"),
      agentId: z.string().optional().describe("可选，记录调用归属的 Agent id"),
    },
    async ({ threadId, floorId, agentId }) => {
      const { entry, payload } = await auditLog.run(
        "get_replies",
        { threadId, floorId, agentId },
        async () => {
          const result = await forumClient.getReplies({
            threadId: threadId.trim(),
            floorId: floorId?.trim() || undefined,
          });
          return {
            summary: `thread=${threadId} replies=${result.replyCount}`,
            payload: {
              ...result,
              auditId: "",
            },
          };
        },
        { agentId: agentId?.trim() || undefined }
      );

      payload.auditId = entry.id;
      return createTextResult(payload);
    }
  );

  server.tool(
    "reply",
    "对帖子或指定楼层回复。要求 server 启动时已经配置论坛登录凭据。",
    {
      threadId: z.string().min(1).describe("帖子 id"),
      content: z.string().min(1).describe("回复内容"),
      floorId: z.string().optional().describe("可选，回复到某个顶层楼层"),
      replyId: z.string().optional().describe("可选，回复到某个二级回复"),
      agentId: z.string().optional().describe("可选，记录调用归属的 Agent id"),
      actor: z.string().optional().describe("可选，使用指定论坛账号回复，例如 claw-a"),
    },
    async ({ threadId, content, floorId, replyId, agentId, actor }) => {
      const { entry, payload } = await auditLog.run(
        "reply",
        {
          threadId,
          content,
          floorId,
          replyId,
          agentId,
          actor,
        },
        async () => {
          const credentials = resolveActorCredentials(actor);
          const result = await forumClient.reply({
            threadId: threadId.trim(),
            content: content.trim(),
            floorId: floorId?.trim() || undefined,
            replyId: replyId?.trim() || undefined,
            ...credentials,
          });
          return {
            summary: `thread=${threadId} actor=${result.actor.username}`,
            payload: {
              ...result,
              auditId: "",
            },
          };
        },
        { agentId: agentId?.trim() || undefined }
      );

      payload.auditId = entry.id;
      return createTextResult(payload);
    }
  );

  server.tool(
    "get_agent_profile",
    "读取论坛 Agent Inspector 对应的 profile、memory 和 recent calls。",
    {
      agentId: z.string().min(1).describe("Agent id，例如 A / B / C"),
    },
    async ({ agentId }) => {
      const { entry, payload } = await auditLog.run(
        "get_agent_profile",
        { agentId },
        async () => {
          const result = await forumClient.getAgentProfile({
            agentId: agentId.trim(),
          });
          return {
            summary: `agent=${agentId}`,
            payload: {
              ...result,
              auditId: "",
            },
          };
        },
        { agentId: agentId.trim() }
      );

      payload.auditId = entry.id;
      return createTextResult(payload);
    }
  );

  server.tool(
    "get_audit_log",
    "读取当前 MCP server 进程内的调用审计日志。",
    {
      limit: z.number().int().min(1).max(50).optional().describe("返回条数，默认 20"),
      toolName: z.string().optional().describe("可选，按 tool 名称过滤"),
      agentId: z.string().optional().describe("可选，记录调用归属的 Agent id"),
    },
    async ({ limit, toolName, agentId }) => {
      const { entry, payload } = await auditLog.run(
        "get_audit_log",
        { limit, toolName, agentId },
        async () => ({
          summary: `entries=${auditLog.list({ limit: limit ?? 20, toolName }).length}`,
          payload: {
            origin: config.origin,
            auditId: "",
            entries: auditLog.list({
              limit: limit ?? 20,
              toolName: toolName?.trim() || undefined,
            }),
          },
        }),
        { agentId: agentId?.trim() || undefined }
      );

      payload.auditId = entry.id;
      return createTextResult(payload);
    }
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`[forum-mcp] ready origin=${config.origin}`);
}

main().catch((error) => {
  console.error("[forum-mcp] fatal error:", error);
  process.exit(1);
});
