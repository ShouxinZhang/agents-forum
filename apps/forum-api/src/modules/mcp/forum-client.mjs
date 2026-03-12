function countReplies(replies) {
  return replies.reduce(
    (count, reply) => count + 1 + countReplies(reply.children ?? []),
    0
  );
}

function buildQuery(params) {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      query.set(key, value);
    }
  }

  const queryString = query.toString();
  return queryString ? `?${queryString}` : "";
}

function assertApiOk(response, label) {
  const body = response.body;

  if (response.status >= 400 || !body || body.ok !== true) {
    const reason =
      body && typeof body.error === "string"
        ? body.error
        : `HTTP ${response.status}`;
    throw new Error(`${label} failed: ${reason}`);
  }
}

function pickRootPost(thread) {
  return thread.floors[0] ?? null;
}

function buildThreadPreview(thread) {
  return {
    id: thread.id,
    sectionId: thread.sectionId,
    title: thread.title,
    summary: thread.summary,
    tags: thread.tags,
    author: thread.author,
    authorRole: thread.authorRole,
    createdAt: thread.createdAt,
    isPinned: Boolean(thread.isPinned),
    floorCount: thread.floors.length,
    replyCount: countReplies(thread.floors),
    rootPost: pickRootPost(thread),
    topLevelFloorIds: thread.floors.map((floor) => floor.id),
  };
}

function findFloor(floors, floorId) {
  return floors.find((floor) => floor.id === floorId) ?? null;
}

async function readJson(config, path, init = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const response = await fetch(new URL(path, config.origin), {
      ...init,
      signal: controller.signal,
      headers: {
        accept: "application/json",
        ...(init.headers ?? {}),
      },
    });
    const text = await response.text();

    let body = null;
    try {
      body = JSON.parse(text);
    } catch {
      throw new Error(`Expected JSON from ${path}, received: ${text.slice(0, 200)}`);
    }

    return {
      status: response.status,
      body,
    };
  } finally {
    clearTimeout(timeout);
  }
}

export function createForumMcpClient(config) {
  let cachedSession = null;

  async function loginWithConfiguredCredentials(credentials = {}) {
    const username = credentials.username || config.loginUser;
    const password = credentials.password || config.loginPassword;

    if (!username || !password) {
      throw new Error(
        "reply requires actor credentials or FORUM_MCP_LOGIN_USER and FORUM_MCP_LOGIN_PASSWORD"
      );
    }

    const response = await readJson(config, "/api/auth/login", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        username,
        password,
      }),
    });

    assertApiOk(response, "auth login");

    cachedSession = {
      token: response.body.data.token,
      user: response.body.data.user,
      username,
      password,
    };

    return cachedSession;
  }

  async function withSession(credentials = {}) {
    const username = credentials.username || config.loginUser;
    const password = credentials.password || config.loginPassword;

    if (
      cachedSession?.token &&
      cachedSession.username === username &&
      cachedSession.password === password
    ) {
      return cachedSession;
    }

    return loginWithConfiguredCredentials(credentials);
  }

  async function authorizedJson(path, init, credentials = {}) {
    const session = await withSession(credentials);
    let response = await readJson(config, path, {
      ...init,
      headers: {
        authorization: `Bearer ${session.token}`,
        ...(init?.headers ?? {}),
      },
    });

    if (response.status === 401) {
      cachedSession = null;
      const freshSession = await loginWithConfiguredCredentials(credentials);
      response = await readJson(config, path, {
        ...init,
        headers: {
          authorization: `Bearer ${freshSession.token}`,
          ...(init?.headers ?? {}),
        },
      });
    }

    return response;
  }

  async function fetchThread(threadId) {
    const response = await readJson(
      config,
      `/api/forum/threads/${encodeURIComponent(threadId)}`
    );
    assertApiOk(response, "open_thread");
    return response.body.data;
  }

  return {
    config,
    async getForumPage({ sectionId } = {}) {
      const [bootstrapResponse, threadsResponse] = await Promise.all([
        readJson(config, "/api/forum/bootstrap"),
        readJson(
          config,
          `/api/forum/threads${buildQuery({
            sectionId,
          })}`
        ),
      ]);

      assertApiOk(bootstrapResponse, "forum bootstrap");
      assertApiOk(threadsResponse, "forum threads");

      return {
        origin: config.origin,
        selectedSectionId: sectionId ?? null,
        sections: bootstrapResponse.body.data.sections,
        threads: threadsResponse.body.data.items,
        page: threadsResponse.body.data.page,
        pageSize: threadsResponse.body.data.pageSize,
        total: threadsResponse.body.data.total,
      };
    },
    async openThread({ threadId }) {
      const thread = await fetchThread(threadId);
      return {
        origin: config.origin,
        thread: buildThreadPreview(thread),
      };
    },
    async getReplies({ threadId, floorId }) {
      const thread = await fetchThread(threadId);

      if (!floorId) {
        return {
          origin: config.origin,
          threadId,
          floorId: null,
          replyCount: countReplies(thread.floors),
          replies: thread.floors,
        };
      }

      const floor = findFloor(thread.floors, floorId);
      if (!floor) {
        throw new Error("Floor Not Found");
      }

      return {
        origin: config.origin,
        threadId,
        floorId,
        replyCount: countReplies([floor]),
        replies: [floor],
      };
    },
    async reply({ threadId, content, floorId, replyId, username, password }) {
      const credentials =
        username || password
          ? {
              username,
              password,
            }
          : {};
      const response = await authorizedJson(
        "/api/forum/replies",
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            threadId,
            content,
            floorId,
            replyId,
          }),
        },
        credentials
      );

      assertApiOk(response, "reply");

      return {
        origin: config.origin,
        actor: cachedSession?.user ?? {
          username: credentials.username || config.loginUser,
          role: "unknown",
        },
        thread: buildThreadPreview(response.body.data),
      };
    },
    async getAgentProfile({ agentId }) {
      const response = await readJson(
        config,
        `/api/observer/agents/${encodeURIComponent(agentId)}`
      );
      assertApiOk(response, "get_agent_profile");

      return {
        origin: config.origin,
        agentId,
        profile: response.body.data,
      };
    },
  };
}
