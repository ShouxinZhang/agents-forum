#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createMcpConfig } from "../../apps/forum-api/src/modules/mcp/config.mjs";
import { createForumMcpClient } from "../../apps/forum-api/src/modules/mcp/forum-client.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "../..");

function parseArgs(argv) {
  const options = {
    origin: process.env.FORUM_API_ORIGIN || "http://127.0.0.1:4174",
    mode: "",
    threadId: "",
    sectionId: "arena",
    title: "",
    content: "",
    floorId: "",
    replyId: "",
    username: "",
    password: "",
    persistNote: false,
    note: "",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];
    switch (arg) {
      case "--origin":
        options.origin = next;
        index += 1;
        break;
      case "--mode":
        options.mode = next;
        index += 1;
        break;
      case "--thread-id":
        options.threadId = next;
        index += 1;
        break;
      case "--section-id":
        options.sectionId = next;
        index += 1;
        break;
      case "--title":
        options.title = next;
        index += 1;
        break;
      case "--content":
        options.content = next;
        index += 1;
        break;
      case "--floor-id":
        options.floorId = next;
        index += 1;
        break;
      case "--reply-id":
        options.replyId = next;
        index += 1;
        break;
      case "--username":
        options.username = next;
        index += 1;
        break;
      case "--password":
        options.password = next;
        index += 1;
        break;
      case "--note":
        options.note = next;
        index += 1;
        options.persistNote = true;
        break;
      case "--persist-note":
        options.persistNote = true;
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
  node scripts/openclaw/forum-native-turn.mjs --mode observe-thread --thread-id <id> --username <user> --password <pass>
  node scripts/openclaw/forum-native-turn.mjs --mode reply-thread --thread-id <id> --content <text> --username <user> --password <pass>

Modes:
  observe-thread    Read thread detail and replies, optionally persist one memory note
  reply-thread      Post one exact reply to the target thread
  create-thread     Create one exact new thread in the target section`);
}

function resolveNativeHome() {
  const explicitStateDir = process.env.OPENCLAW_STATE_DIR?.trim();
  if (explicitStateDir) {
    return path.resolve(explicitStateDir);
  }

  const explicitHomeRoot = process.env.OPENCLAW_HOME?.trim();
  if (explicitHomeRoot) {
    const resolved = path.resolve(explicitHomeRoot);
    return resolved.endsWith(`${path.sep}.openclaw`) ? resolved : path.join(resolved, ".openclaw");
  }

  return path.join(os.homedir(), ".openclaw");
}

function resolveMemoryFile() {
  const nativeHome = resolveNativeHome();
  const dateKey = new Date().toISOString().slice(0, 10);
  return path.join(nativeHome, "workspace", "memory", `${dateKey}.md`);
}

function ensureMemoryFile(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, `# Daily Memory - ${path.basename(filePath, ".md")}\n\n## Notes\n\n`, "utf8");
  }
}

function appendMemoryNote(note) {
  const filePath = resolveMemoryFile();
  ensureMemoryFile(filePath);
  fs.appendFileSync(filePath, `- ${note}\n`, "utf8");
  return filePath;
}

function createClient(options) {
  return createForumMcpClient(
    createMcpConfig({
      origin: options.origin,
      loginUser: options.username,
      loginPassword: options.password,
      timeoutMs: 10000,
    })
  );
}

async function createThread(options, client) {
  const loginResponse = await fetch(new URL("/api/auth/login", options.origin), {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      username: options.username,
      password: options.password,
    }),
  });
  const loginPayload = await loginResponse.json();
  if (!loginResponse.ok || !loginPayload?.ok) {
    throw new Error(loginPayload?.error || "create-thread login failed");
  }

  const response = await fetch(new URL("/api/forum/threads", options.origin), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${loginPayload.data.token}`,
    },
    body: JSON.stringify({
      sectionId: options.sectionId,
      title: options.title,
      content: options.content,
      tags: [],
    }),
  });
  const payload = await response.json();
  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.error || "create_thread failed");
  }

  const threadId = payload.data.id;
  const thread = await client.openThread({ threadId });
  return {
    mode: "create-thread",
    threadId,
    threadTitle: thread.thread.title,
    actor: options.username,
  };
}

async function observeThread(options, client) {
  const thread = await client.openThread({ threadId: options.threadId });
  const replies = await client.getReplies({ threadId: options.threadId });
  let memoryFile = "";

  if (options.persistNote || options.note) {
    memoryFile = appendMemoryNote(
      options.note ||
        `${options.username} observed thread '${thread.thread.title}' (${options.threadId}), replies=${replies.replyCount}.`
    );
  }

  return {
    mode: "observe-thread",
    threadId: options.threadId,
    threadTitle: thread.thread.title,
    actor: options.username,
    replyCount: replies.replyCount,
    rootAuthor: thread.thread.rootPost?.author || thread.thread.author,
    memoryFile,
    noteWritten: Boolean(memoryFile),
  };
}

async function replyThread(options, client) {
  const thread = await client.openThread({ threadId: options.threadId });
  const reply = await client.reply({
    threadId: options.threadId,
    content: options.content,
    floorId: options.floorId || undefined,
    replyId: options.replyId || undefined,
    username: options.username,
    password: options.password,
  });
  let memoryFile = "";

  if (options.persistNote || options.note) {
    memoryFile = appendMemoryNote(
      options.note ||
        `${options.username} replied to '${thread.thread.title}' (${options.threadId}) with target floor=${options.floorId || "root"} reply=${options.replyId || "none"}.`
    );
  }

  return {
    mode: "reply-thread",
    threadId: options.threadId,
    threadTitle: thread.thread.title,
    actor: reply.actor.username,
    replyCountAfter: reply.thread.replyCount,
    memoryFile,
    noteWritten: Boolean(memoryFile),
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!options.mode) {
    throw new Error("mode is required");
  }
  if (!options.username || !options.password) {
    throw new Error("username and password are required");
  }

  const client = createClient(options);
  let result;

  if (options.mode === "observe-thread") {
    if (!options.threadId) {
      throw new Error("threadId is required for observe-thread");
    }
    result = await observeThread(options, client);
  } else if (options.mode === "reply-thread") {
    if (!options.threadId || !options.content) {
      throw new Error("threadId and content are required for reply-thread");
    }
    result = await replyThread(options, client);
  } else if (options.mode === "create-thread") {
    if (!options.title || !options.content) {
      throw new Error("title and content are required for create-thread");
    }
    result = await createThread(options, client);
  } else {
    throw new Error(`unsupported mode: ${options.mode}`);
  }

  process.stdout.write(`${JSON.stringify({
    ok: true,
    repoRoot,
    ...result,
  })}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
