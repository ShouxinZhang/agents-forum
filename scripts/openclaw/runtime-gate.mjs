#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import https from "node:https";
import path from "node:path";
import { fileURLToPath } from "node:url";

const defaultOrigin = "http://127.0.0.1:4174";
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "../..");
const defaultOpenClawRepo = path.resolve(
  "/home/wudizhe001/Documents/GitHub/openclaw-test/third_party/openclaw"
);
const defaultPolicyStatePath = path.join(repoRoot, "apps/forum-api/.runtime/forum-bot-state.json");

function parseArgs(argv) {
  const options = {
    origin: process.env.FORUM_API_ORIGIN || defaultOrigin,
    openclawBin: process.env.OPENCLAW_BIN || "",
    openclawRepo: process.env.OPENCLAW_REPO || defaultOpenClawRepo,
    postUser: process.env.OPENCLAW_FORUM_POST_USER || "claw-a",
    postPassword: process.env.OPENCLAW_FORUM_POST_PASSWORD || "1234",
    adminUser: process.env.OPENCLAW_FORUM_ADMIN_USER || "admin",
    adminPassword: process.env.OPENCLAW_FORUM_ADMIN_PASSWORD || "1234",
    sectionId: process.env.OPENCLAW_FORUM_SECTION_ID || "arena",
    sessionId: process.env.OPENCLAW_FORUM_SESSION_ID || "forum-runtime-gate",
    memoryFile:
      process.env.OPENCLAW_FORUM_MEMORY_FILE || path.join(process.env.HOME || "", ".openclaw/workspace/memory/2026-03-12.md"),
    policyStatePath: process.env.OPENCLAW_FORUM_POLICY_STATE || defaultPolicyStatePath,
    resetPolicyState: process.env.OPENCLAW_FORUM_RESET_POLICY_STATE !== "false",
    maxReplyPolls: Number.parseInt(process.env.OPENCLAW_FORUM_REPLY_POLLS || "4", 10),
    pollDelayMs: Number.parseInt(process.env.OPENCLAW_FORUM_POLL_DELAY_MS || "4000", 10),
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];
    switch (arg) {
      case "--origin":
        options.origin = next;
        index += 1;
        break;
      case "--openclaw-bin":
        options.openclawBin = next;
        index += 1;
        break;
      case "--openclaw-repo":
        options.openclawRepo = next;
        index += 1;
        break;
      case "--post-user":
        options.postUser = next;
        index += 1;
        break;
      case "--post-password":
        options.postPassword = next;
        index += 1;
        break;
      case "--admin-user":
        options.adminUser = next;
        index += 1;
        break;
      case "--admin-password":
        options.adminPassword = next;
        index += 1;
        break;
      case "--section-id":
        options.sectionId = next;
        index += 1;
        break;
      case "--session-id":
        options.sessionId = next;
        index += 1;
        break;
      case "--memory-file":
        options.memoryFile = next;
        index += 1;
        break;
      case "--policy-state-path":
        options.policyStatePath = next;
        index += 1;
        break;
      case "--no-reset-policy-state":
        options.resetPolicyState = false;
        break;
      case "--max-reply-polls":
        options.maxReplyPolls = Number.parseInt(next, 10);
        index += 1;
        break;
      case "--poll-delay-ms":
        options.pollDelayMs = Number.parseInt(next, 10);
        index += 1;
        break;
      case "-h":
      case "--help":
        printHelp();
        process.exit(0);
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

function printHelp() {
  console.log(`Usage:
  node scripts/openclaw/runtime-gate.mjs [options]

Options:
  --origin <url>              forum-api origin, default ${defaultOrigin}
  --openclaw-bin <path>       explicit OpenClaw CLI binary
  --openclaw-repo <path>      fallback OpenClaw repo root
  --post-user <name>          forum posting user, default claw-a
  --post-password <pass>      forum posting password, default 1234
  --admin-user <name>         observer action user, default admin
  --admin-password <pass>     observer action password, default 1234
  --section-id <id>           target forum section, default arena
  --session-id <id>           OpenClaw session id label, default forum-runtime-gate
  --memory-file <path>        memory file to update after reply verification
  --policy-state-path <path>  forum bot policy state file
  --no-reset-policy-state     keep existing quota/cooldown state
  --max-reply-polls <n>       max run_once polls waiting for a bot reply, default 4
  --poll-delay-ms <ms>        delay between reply polls, default 4000`);
}

function resolveOpenClawInvocation(options) {
  if (options.openclawBin) {
    return {
      cmd: options.openclawBin,
      args: [],
    };
  }

  const repoEntry = path.join(options.openclawRepo, "openclaw.mjs");
  if (fs.existsSync(repoEntry)) {
    return {
      cmd: "node",
      args: [repoEntry],
    };
  }

  return {
    cmd: "openclaw",
    args: [],
  };
}

async function requestJson(url, init = {}) {
  const requestUrl = new URL(url);
  const client = requestUrl.protocol === "https:" ? https : http;
  const method = init.method || "GET";
  const headers = init.headers || {};
  const body = typeof init.body === "string" ? init.body : "";

  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const payload = await new Promise((resolve, reject) => {
        const request = client.request(
          requestUrl,
          {
            method,
            headers: {
              ...headers,
              ...(body
                ? {
                    "content-length": Buffer.byteLength(body),
                  }
                : {}),
            },
          },
          (response) => {
            const chunks = [];
            response.setEncoding("utf8");
            response.on("data", (chunk) => chunks.push(chunk));
            response.on("end", () => {
              const text = chunks.join("");
              let json = null;
              try {
                json = text ? JSON.parse(text) : null;
              } catch {
                json = null;
              }

              if (response.statusCode < 200 || response.statusCode >= 300 || !json?.ok) {
                reject(new Error(json?.error || `${method} ${url} failed with status ${response.statusCode}`));
                return;
              }

              resolve(json.data);
            });
          }
        );

        request.on("error", (error) => {
          reject(
            new Error(`${method} ${url} request failed: ${error instanceof Error ? error.message : String(error)}`)
          );
        });

        if (body) {
          request.write(body);
        }
        request.end();
      });

      return payload;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (
        attempt === 4 ||
        (!message.includes("request failed: socket hang up") &&
          !message.includes("request failed: connect ECONNRESET") &&
          !message.includes("request failed: read ECONNRESET"))
      ) {
        throw error;
      }

      logStep(`retry ${method} ${url} after transient transport error: ${message}`);
      await wait(1000 * attempt);
    }
  }
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createInitialPolicyState() {
  return {
    version: 1,
    bots: {},
  };
}

function resetPolicyState(options) {
  const statePath = path.resolve(options.policyStatePath);
  const stateDir = path.dirname(statePath);
  fs.mkdirSync(stateDir, { recursive: true });
  let backupPath = "";

  if (fs.existsSync(statePath)) {
    backupPath = `${statePath}.bak-${Date.now()}`;
    fs.copyFileSync(statePath, backupPath);
  }

  fs.writeFileSync(statePath, `${JSON.stringify(createInitialPolicyState(), null, 2)}\n`, "utf8");
  return {
    statePath,
    backupPath,
  };
}

function logStep(message) {
  process.stderr.write(`[runtime-gate] ${message}\n`);
}

function formatOutputSnippet(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().replace(/\s+/g, " ").slice(0, 400);
}

function runOpenClawAgent(options, message, label = "agent-turn") {
  const invocation = resolveOpenClawInvocation(options);
  const args = [
    ...invocation.args,
    "agent",
    "--agent",
    "main",
    "--session-id",
    options.sessionId,
    "--json",
    "--timeout",
    "120",
    "--message",
    message,
  ];

  for (let attempt = 1; attempt <= 4; attempt += 1) {
    logStep(`${label}: attempt ${attempt}`);
    const result = spawnSync(invocation.cmd, args, {
      cwd: process.cwd(),
      encoding: "utf8",
      env: process.env,
      maxBuffer: 10 * 1024 * 1024,
    });

    if (result.status === 0) {
      return JSON.parse(result.stdout);
    }

    const failureMessage =
      result.stderr.trim() || result.stdout.trim() || "openclaw agent failed";
    logStep(
      `${label}: exit=${result.status ?? "null"} signal=${result.signal ?? "none"} stderr="${formatOutputSnippet(
        result.stderr
      )}" stdout="${formatOutputSnippet(result.stdout)}"`
    );
    if (!failureMessage.includes("fetch failed") || attempt === 4) {
      throw new Error(failureMessage);
    }

    logStep(`${label}: transient failure "${failureMessage}", retrying in 3000ms`);
    spawnSync("bash", ["-lc", "sleep 3"], {
      cwd: process.cwd(),
      encoding: "utf8",
      env: process.env,
      maxBuffer: 1024 * 1024,
    });
  }
}

function extractLastJsonPayload(runResult) {
  const payloads = runResult?.result?.payloads ?? [];
  for (let index = payloads.length - 1; index >= 0; index -= 1) {
    const text = payloads[index]?.text;
    if (typeof text !== "string") {
      continue;
    }

    try {
      return JSON.parse(text);
    } catch {
      continue;
    }
  }

  throw new Error("could not find JSON payload in openclaw agent result");
}

function flattenReplyAuthors(threadPayload) {
  const authors = [];
  const visit = (replies = []) => {
    for (const reply of replies) {
      authors.push(reply.author);
      visit(reply.children ?? []);
    }
  };

  visit(threadPayload?.floors ?? []);
  return authors;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const uniqueSuffix = Date.now().toString(36).slice(-8);
  const title = `[OpenClaw Gate] autonomous post ${uniqueSuffix}`;
  const content =
    "this post is for validating autonomous OpenClaw posting, reply chains, and native transcript context.";

  logStep(`health-check ${options.origin}`);
  await requestJson(`${options.origin}/api/health`);
  let policyReset = {
    statePath: path.resolve(options.policyStatePath),
    backupPath: "",
    applied: false,
  };
  if (options.resetPolicyState) {
    logStep(`reset forum bot policy state ${policyReset.statePath}`);
    const resetResult = resetPolicyState(options);
    policyReset = {
      ...resetResult,
      applied: true,
    };
  }
  logStep("admin login");
  const adminSession = await requestJson(`${options.origin}/api/auth/login`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      username: options.adminUser,
      password: options.adminPassword,
    }),
  });

  const postPrompt = [
    `Use the OpenClaw forum workflow against ${options.origin}.`,
    "First read ~/.openclaw/workspace/skills/openclaw-forum-bot/SKILL.md and follow it.",
    `Then log into the forum as ${options.postUser} with password ${options.postPassword}.`,
    `Create one new thread in section ${options.sectionId} with exact title ${title}.`,
    `Use exact content: ${content}`,
    "After creating the thread, open the created thread detail and verify the body text matches.",
    'Return only compact JSON with threadId, title, author, verifiedReadback, and summary.',
  ].join(" ");
  const postRun = runOpenClawAgent(options, postPrompt, "post-thread");
  logStep("post-thread completed");
  const postPayload = extractLastJsonPayload(postRun);
  const threadId = postPayload.threadId;

  if (!threadId) {
    throw new Error("OpenClaw did not return threadId");
  }

  logStep(`fetch thread detail ${threadId}`);
  let threadPayload = await requestJson(`${options.origin}/api/forum/threads/${threadId}`);
  let replyAuthors = flattenReplyAuthors(threadPayload).filter((author) => author && author !== options.postUser);

  for (let attempt = 0; replyAuthors.length === 0 && attempt < options.maxReplyPolls; attempt += 1) {
    logStep(`run_once poll ${attempt + 1}/${options.maxReplyPolls}`);
    await requestJson(`${options.origin}/api/observer/orchestrator/actions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${adminSession.token}`,
      },
      body: JSON.stringify({
        action: "run_once",
      }),
    });
    await wait(options.pollDelayMs);
    threadPayload = await requestJson(`${options.origin}/api/forum/threads/${threadId}`);
    replyAuthors = flattenReplyAuthors(threadPayload).filter((author) => author && author !== options.postUser);
  }

  if (replyAuthors.length === 0) {
    throw new Error("No bot replies were added to the validation thread");
  }

  const readbackPrompt = [
    `Continue the existing forum validation thread at ${options.origin}.`,
    `Open forum thread ${threadId} and verify any bot replies added after the original post.`,
    `Identify the reply authors and then append a concise persistent note to ${options.memoryFile}.`,
    `Mention thread ${threadId}, title ${title}, and whether claw-b replied.`,
    'Return only compact JSON with threadId, verifiedReplyReadback, replyAuthors, memoryFile, and memoryUpdated.',
  ].join(" ");
  logStep(`start native readback for ${threadId}`);
  const readbackRun = runOpenClawAgent(options, readbackPrompt, "readback-memory");
  logStep("readback-memory completed");
  const readbackPayload = extractLastJsonPayload(readbackRun);

  logStep("fetch observer dashboard");
  const dashboard = await requestJson(`${options.origin}/api/observer/dashboard`);
  const mainBridgeAgent = dashboard.openclawBridge?.agents?.find((agent) => agent.agentId === "main") ?? null;
  const firstReplyingBot =
    dashboard.orchestrator?.instances?.find(
      (instance) =>
        replyAuthors.includes(instance.botUsername) &&
        (instance.currentThreadId === threadId ||
          (instance.recentEvents ?? []).some((event) => event.threadId === threadId))
    ) ?? null;

  const result = {
    ok: true,
    gate: "openclaw-runtime-gate",
    thread: {
      id: threadId,
      title,
      author: postPayload.author,
      verifiedReadback: Boolean(postPayload.verifiedReadback),
      replyAuthors,
      replyCountExcludingAuthor: replyAuthors.length,
    },
    memory: {
      file: readbackPayload.memoryFile,
      updated: Boolean(readbackPayload.memoryUpdated),
    },
    policyReset,
    native: {
      sessionId: readbackRun?.result?.meta?.agentMeta?.sessionId || postRun?.result?.meta?.agentMeta?.sessionId || "",
      bridgeStatus: dashboard.openclawBridge?.status || "",
      mainAction: mainBridgeAgent?.currentAction || "",
      mainSummary: mainBridgeAgent?.currentSummary || "",
      memoryDocs: mainBridgeAgent?.memoryDocs?.map((entry) => entry.label) ?? [],
    },
    forumRuntime: firstReplyingBot
      ? {
          instanceId: firstReplyingBot.id,
          botUsername: firstReplyingBot.botUsername,
          currentThreadId: firstReplyingBot.currentThreadId,
          currentThreadTitle: firstReplyingBot.currentThreadTitle,
          workflowStep: firstReplyingBot.workflow?.currentStep || "",
          workflowAction: firstReplyingBot.workflow?.currentAction || "",
        }
      : null,
    postRun,
    readbackRun,
  };

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
