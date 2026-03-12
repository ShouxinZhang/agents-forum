#!/usr/bin/env node

const defaults = {
  origin: process.env.FORUM_API_ORIGIN || "http://127.0.0.1:4174",
  sectionId: process.env.FORUM_SECTION_ID || "arena",
  timeoutMs: Number.parseInt(process.env.FORUM_SMOKE_TIMEOUT_MS || "5000", 10),
  loginUser: process.env.FORUM_SMOKE_LOGIN_USER || "",
  loginPassword: process.env.FORUM_SMOKE_LOGIN_PASSWORD || "",
};

function parseArgs(argv) {
  const options = {
    origin: defaults.origin,
    sectionId: defaults.sectionId,
    threadId: null,
    timeoutMs: defaults.timeoutMs,
    writeSmoke: false,
    loginUser: defaults.loginUser,
    loginPassword: defaults.loginPassword,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === "--origin" && argv[i + 1]) {
      options.origin = argv[i + 1];
      i += 1;
      continue;
    }

    if (arg === "--section-id" && argv[i + 1]) {
      options.sectionId = argv[i + 1];
      i += 1;
      continue;
    }

    if (arg === "--thread-id" && argv[i + 1]) {
      options.threadId = argv[i + 1];
      i += 1;
      continue;
    }

    if (arg === "--timeout-ms" && argv[i + 1]) {
      options.timeoutMs = Number.parseInt(argv[i + 1], 10);
      i += 1;
      continue;
    }

    if (arg === "--write-smoke") {
      options.writeSmoke = true;
      continue;
    }

    if (arg === "--login-user" && argv[i + 1]) {
      options.loginUser = argv[i + 1];
      i += 1;
      continue;
    }

    if (arg === "--login-password" && argv[i + 1]) {
      options.loginPassword = argv[i + 1];
      i += 1;
      continue;
    }

    if (arg === "-h" || arg === "--help") {
      printHelp();
      process.exit(0);
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!Number.isFinite(options.timeoutMs) || options.timeoutMs <= 0) {
    throw new Error("timeout-ms must be a positive integer");
  }

  return options;
}

function printHelp() {
  console.log(`Usage:
  node skills/forum-mcp-smoke/scripts/smoke.mjs [options]

Options:
  --origin <url>         forum-api origin, default: ${defaults.origin}
  --section-id <id>      feed section id, default: ${defaults.sectionId}
  --thread-id <id>       explicit thread id for detail check
  --timeout-ms <ms>      request timeout in milliseconds
  --write-smoke          enable authenticated create-thread / reply smoke
  --login-user <name>    login username for write smoke
  --login-password <pw>  login password for write smoke
  -h, --help             show help`);
}

function addCheck(report, name, ok, detail, extra = {}) {
  report.checks.push({
    name,
    ok,
    detail,
    ...extra,
  });
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertObject(value, message) {
  assert(value && typeof value === "object" && !Array.isArray(value), message);
}

async function requestJson(origin, path, timeoutMs) {
  return requestJsonWithInit(origin, path, {}, timeoutMs);
}

async function requestJsonWithInit(origin, path, init, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(new URL(path, origin), {
      ...init,
      signal: controller.signal,
      headers: {
        accept: "application/json",
        ...(init.headers ?? {}),
      },
    });
    const text = await response.text();

    let body;
    try {
      body = JSON.parse(text);
    } catch (error) {
      throw new Error(`Expected JSON but received: ${text.slice(0, 200)}`);
    }

    return {
      status: response.status,
      body,
    };
  } finally {
    clearTimeout(timeout);
  }
}

function validateHealth(body) {
  assertObject(body, "health response must be an object");
  assert(body.ok === true, "health response ok must be true");
  assert(body.service === "forum-api", "health response service must be forum-api");
}

function validateUnauthorized(status, body, label) {
  assert(status === 401, `${label} status must be 401`);
  assertObject(body, `${label} response must be an object`);
  assert(body.ok === false, `${label} ok must be false`);
  assert(body.error === "Unauthorized", `${label} error must be Unauthorized`);
}

function validateBootstrap(body) {
  assertObject(body, "bootstrap response must be an object");
  assert(body.ok === true, "bootstrap response ok must be true");
  assertObject(body.data, "bootstrap data must be an object");
  assert(Array.isArray(body.data.sections), "bootstrap data.sections must be an array");

  for (const section of body.data.sections) {
    assert(typeof section.id === "string" && section.id.length > 0, "section.id must be a non-empty string");
    assert(typeof section.name === "string" && section.name.length > 0, "section.name must be a non-empty string");
    assert(Number.isInteger(section.threadCount), "section.threadCount must be an integer");
  }

  return {
    sectionCount: body.data.sections.length,
  };
}

function validateSections(body) {
  assertObject(body, "sections response must be an object");
  assert(body.ok === true, "sections response ok must be true");
  assert(Array.isArray(body.data), "sections data must be an array");
  return {
    sectionCount: body.data.length,
  };
}

function validateThreadSummaries(body) {
  assertObject(body, "threads response must be an object");
  assert(body.ok === true, "threads response ok must be true");
  assertObject(body.data, "threads data must be an object");
  assert(Array.isArray(body.data.items), "threads data.items must be an array");
  assert(Number.isInteger(body.data.total), "threads data.total must be an integer");
  assert(Number.isInteger(body.data.page), "threads data.page must be an integer");
  assert(Number.isInteger(body.data.pageSize), "threads data.pageSize must be an integer");

  for (const thread of body.data.items) {
    assert(typeof thread.id === "string" && thread.id.length > 0, "thread.id must be a non-empty string");
    assert(typeof thread.title === "string" && thread.title.length > 0, "thread.title must be a non-empty string");
    assert(typeof thread.summary === "string", "thread.summary must be a string");
    assert(Number.isInteger(thread.replyCount), "thread.replyCount must be an integer");
    assert(!("floors" in thread), "thread summary must not include floors");
  }

  return {
    threadCount: body.data.items.length,
    total: body.data.total,
    threadIds: body.data.items.map((thread) => thread.id),
  };
}

function validateThreadDetail(body, expectedThreadId) {
  assertObject(body, "thread detail response must be an object");
  assert(body.ok === true, "thread detail response ok must be true");
  assertObject(body.data, "thread detail data must be an object");
  assert(body.data.id === expectedThreadId, "thread detail id must match requested thread id");
  assert(Array.isArray(body.data.floors), "thread detail floors must be an array");

  return {
    floorCount: body.data.floors.length,
  };
}

async function loginForWriteSmoke(origin, username, password, timeoutMs) {
  const response = await requestJsonWithInit(
    origin,
    "/api/auth/login",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        username,
        password,
      }),
    },
    timeoutMs
  );

  assert(response.status === 200, "auth login status must be 200");
  assertObject(response.body, "auth login response must be an object");
  assert(response.body.ok === true, "auth login ok must be true");
  assertObject(response.body.data, "auth login data must be an object");
  assert(
    typeof response.body.data.token === "string" && response.body.data.token.length > 0,
    "auth login token must be a non-empty string"
  );

  return response.body.data.token;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const origin = options.origin.endsWith("/") ? options.origin.slice(0, -1) : options.origin;

  const report = {
    ok: false,
    skill: "forum-mcp-smoke",
    mode: "forum-http-read-smoke",
    origin,
    sectionId: options.sectionId,
    selectedThreadId: options.threadId,
    writeSmoke: options.writeSmoke,
    checks: [],
    startedAt: new Date().toISOString(),
    finishedAt: null,
  };

  try {
    const health = await requestJson(origin, "/api/health", options.timeoutMs);
    assert(health.status === 200, "health status must be 200");
    validateHealth(health.body);
    addCheck(report, "health", true, "forum-api health endpoint is available", {
      status: health.status,
    });

    const bootstrap = await requestJson(origin, "/api/forum/bootstrap", options.timeoutMs);
    assert(bootstrap.status === 200, "bootstrap status must be 200");
    const bootstrapInfo = validateBootstrap(bootstrap.body);
    addCheck(report, "bootstrap", true, "bootstrap returns lightweight sections", bootstrapInfo);

    const sections = await requestJson(origin, "/api/forum/sections", options.timeoutMs);
    assert(sections.status === 200, "sections status must be 200");
    const sectionsInfo = validateSections(sections.body);
    addCheck(report, "sections", true, "sections endpoint returns section list", sectionsInfo);

    const threads = await requestJson(
      origin,
      `/api/forum/threads?sectionId=${encodeURIComponent(options.sectionId)}`,
      options.timeoutMs
    );
    assert(threads.status === 200, "threads status must be 200");
    const threadInfo = validateThreadSummaries(threads.body);
    addCheck(report, "threads", true, "threads endpoint returns feed summaries without floors", threadInfo);

    const threadId = options.threadId || threadInfo.threadIds[0];
    assert(threadId, `no thread available in section ${options.sectionId}`);
    report.selectedThreadId = threadId;

    const detail = await requestJson(origin, `/api/forum/threads/${encodeURIComponent(threadId)}`, options.timeoutMs);
    assert(detail.status === 200, "thread detail status must be 200");
    const detailInfo = validateThreadDetail(detail.body, threadId);
    addCheck(report, "thread-detail", true, "thread detail endpoint returns floors", detailInfo);

    const unauthorizedCreate = await requestJsonWithInit(
      origin,
      "/api/forum/threads",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          sectionId: options.sectionId,
          title: "[smoke] unauthorized create",
          content: "should be rejected",
          tags: ["smoke"],
        }),
      },
      options.timeoutMs
    );
    validateUnauthorized(unauthorizedCreate.status, unauthorizedCreate.body, "unauthorized create");
    addCheck(report, "write-protected-thread", true, "thread write is protected by auth", {
      status: unauthorizedCreate.status,
    });

    const unauthorizedReply = await requestJsonWithInit(
      origin,
      "/api/forum/replies",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          threadId,
          content: "should be rejected",
        }),
      },
      options.timeoutMs
    );
    validateUnauthorized(unauthorizedReply.status, unauthorizedReply.body, "unauthorized reply");
    addCheck(report, "write-protected-reply", true, "reply write is protected by auth", {
      status: unauthorizedReply.status,
    });

    if (options.writeSmoke) {
      assert(options.loginUser, "write-smoke requires --login-user");
      assert(options.loginPassword, "write-smoke requires --login-password");

      const token = await loginForWriteSmoke(
        origin,
        options.loginUser,
        options.loginPassword,
        options.timeoutMs
      );
      addCheck(report, "auth-login", true, "auth login for write smoke succeeded");

      const createdThread = await requestJsonWithInit(
        origin,
        "/api/forum/threads",
        {
          method: "POST",
          headers: {
            authorization: `Bearer ${token}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            sectionId: options.sectionId,
            title: `[smoke] ${new Date().toISOString()}`,
            content: "forum-mcp-smoke write smoke thread",
            tags: ["smoke", "write"],
          }),
        },
        options.timeoutMs
      );
      assert(createdThread.status === 201, "create thread status must be 201");
      assertObject(createdThread.body.data, "create thread data must be an object");
      const createdThreadId = createdThread.body.data.id;
      addCheck(report, "write-thread", true, "authenticated thread create succeeded", {
        threadId: createdThreadId,
      });

      const createdReply = await requestJsonWithInit(
        origin,
        "/api/forum/replies",
        {
          method: "POST",
          headers: {
            authorization: `Bearer ${token}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            threadId: createdThreadId,
            content: "forum-mcp-smoke write smoke reply",
          }),
        },
        options.timeoutMs
      );
      assert(createdReply.status === 201, "create reply status must be 201");
      addCheck(report, "write-reply", true, "authenticated reply create succeeded");

      const writtenThread = await requestJson(
        origin,
        `/api/forum/threads/${encodeURIComponent(createdThreadId)}`,
        options.timeoutMs
      );
      assert(writtenThread.status === 200, "written thread fetch status must be 200");
      const writtenThreadInfo = validateThreadDetail(writtenThread.body, createdThreadId);
      assert(writtenThreadInfo.floorCount >= 2, "written thread should contain created reply");
      addCheck(report, "write-readback", true, "written thread can be read back after create/reply", {
        floorCount: writtenThreadInfo.floorCount,
      });
    }

    report.ok = true;
    report.finishedAt = new Date().toISOString();
    console.log(JSON.stringify(report, null, 2));
  } catch (error) {
    addCheck(report, "failure", false, error instanceof Error ? error.message : String(error));
    report.finishedAt = new Date().toISOString();
    console.log(JSON.stringify(report, null, 2));
    process.exitCode = 1;
  }
}

main();
