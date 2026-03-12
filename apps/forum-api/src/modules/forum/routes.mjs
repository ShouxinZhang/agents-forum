import { Hono } from "hono";

import {
  appendReplyEntry,
  buildForumBootstrap,
  buildThreadDetail,
  buildThreadSummary,
  createThreadEntry,
  getSectionById,
  getThreadById,
  listThreads,
  manageThreadEntry,
  readThreadReplies,
} from "./data.mjs";
import {
  canUserManageForum,
  canUserWriteForum,
  getSessionByToken,
} from "../auth/data.mjs";

const MAX_TITLE_LENGTH = 120;
const MAX_THREAD_CONTENT_LENGTH = 2000;
const MAX_REPLY_LENGTH = 1000;

function readBearerToken(c) {
  const header = c.req.header("authorization");

  if (!header || !header.startsWith("Bearer ")) {
    return "";
  }

  return header.slice("Bearer ".length).trim();
}

function requireSession(c) {
  const session = getSessionByToken(readBearerToken(c));

  if (!session) {
    return {
      ok: false,
      response: c.json({ ok: false, error: "Unauthorized" }, 401),
    };
  }

  return { ok: true, session };
}

function requireWritableSession(c) {
  const auth = requireSession(c);

  if (!auth.ok) {
    return auth;
  }

  if (!canUserWriteForum(auth.session.user)) {
    return {
      ok: false,
      response: c.json({ ok: false, error: "Forbidden" }, 403),
    };
  }

  return auth;
}

function requireModeratorSession(c) {
  const auth = requireSession(c);

  if (!auth.ok) {
    return auth;
  }

  if (!canUserManageForum(auth.session.user)) {
    return {
      ok: false,
      response: c.json({ ok: false, error: "Forbidden" }, 403),
    };
  }

  return auth;
}

export function createForumRoutes() {
  const forum = new Hono();

  forum.get("/bootstrap", (c) =>
    c.json({
      ok: true,
      data: buildForumBootstrap(),
    })
  );

  forum.get("/sections", (c) =>
    c.json({
      ok: true,
      data: buildForumBootstrap().sections,
    })
  );

  forum.get("/threads", (c) => {
    const sectionId = c.req.query("sectionId");
    const search = c.req.query("search") ?? "";
    const sort = c.req.query("sort") ?? "latest";
    const page = Number.parseInt(c.req.query("page") ?? "1", 10);
    const pageSize = Number.parseInt(c.req.query("pageSize") ?? "10", 10);
    const result = listThreads({
      sectionId: sectionId || undefined,
      search,
      sort,
      page: Number.isFinite(page) ? page : 1,
      pageSize: Number.isFinite(pageSize) ? pageSize : 10,
    });

    return c.json({
      ok: true,
      data: {
        items: result.items.map(buildThreadSummary),
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
        hasMore: result.hasMore,
        filters: {
          sectionId: sectionId || "",
          search,
          sort,
        },
      },
    });
  });

  forum.get("/threads/:threadId", (c) => {
    const threadId = c.req.param("threadId");
    const thread = getThreadById(threadId);

    if (!thread) {
      return c.json({ ok: false, error: "Thread Not Found" }, 404);
    }

    return c.json({
      ok: true,
      data: buildThreadDetail(thread),
    });
  });

  forum.get("/threads/:threadId/replies", (c) => {
    const threadId = c.req.param("threadId");
    const floorId = c.req.query("floorId") ?? "";
    const replyId = c.req.query("replyId") ?? "";
    const offset = Number.parseInt(c.req.query("offset") ?? "0", 10);
    const limit = Number.parseInt(c.req.query("limit") ?? "20", 10);
    const result = readThreadReplies({
      threadId,
      floorId: floorId || undefined,
      replyId: replyId || undefined,
      offset: Number.isFinite(offset) ? offset : 0,
      limit: Number.isFinite(limit) ? limit : 20,
    });

    if (result.error) {
      return c.json({ ok: false, error: result.error }, result.status);
    }

    return c.json({
      ok: true,
      data: result,
    });
  });

  forum.post("/threads", async (c) => {
    const auth = requireWritableSession(c);
    if (!auth.ok) {
      return auth.response;
    }

    const body = await c.req.json().catch(() => null);
    const sectionId =
      body && typeof body.sectionId === "string" ? body.sectionId.trim() : "";
    const title = body && typeof body.title === "string" ? body.title.trim() : "";
    const content =
      body && typeof body.content === "string" ? body.content.trim() : "";
    const tags = Array.isArray(body?.tags)
      ? Array.from(
          new Set(
            body.tags
              .filter((tag) => typeof tag === "string")
              .map((tag) => tag.trim())
              .filter(Boolean)
              .slice(0, 5)
          )
        )
      : [];

    if (!getSectionById(sectionId)) {
      return c.json({ ok: false, error: "板块不存在" }, 400);
    }

    if (!title || !content) {
      return c.json({ ok: false, error: "标题和内容不能为空" }, 400);
    }

    if (title.length > MAX_TITLE_LENGTH) {
      return c.json(
        { ok: false, error: `标题最多 ${MAX_TITLE_LENGTH} 字` },
        400
      );
    }

    if (content.length > MAX_THREAD_CONTENT_LENGTH) {
      return c.json(
        { ok: false, error: `正文最多 ${MAX_THREAD_CONTENT_LENGTH} 字` },
        400
      );
    }

    const thread = createThreadEntry({
      sectionId,
      title,
      content,
      tags,
      author: auth.session.user.username,
      authorRole: auth.session.user.role,
    });

    return c.json({ ok: true, data: buildThreadDetail(thread) }, 201);
  });

  forum.post("/replies", async (c) => {
    const auth = requireWritableSession(c);
    if (!auth.ok) {
      return auth.response;
    }

    const body = await c.req.json().catch(() => null);
    const threadId =
      body && typeof body.threadId === "string" ? body.threadId.trim() : "";
    const floorId =
      body && typeof body.floorId === "string" ? body.floorId.trim() : "";
    const replyId =
      body && typeof body.replyId === "string" ? body.replyId.trim() : "";
    const content =
      body && typeof body.content === "string" ? body.content.trim() : "";

    if (replyId && !floorId) {
      return c.json({ ok: false, error: "replyId 不能脱离 floorId 单独使用" }, 400);
    }

    if (!threadId || !content) {
      return c.json({ ok: false, error: "帖子和回复内容不能为空" }, 400);
    }

    if (content.length > MAX_REPLY_LENGTH) {
      return c.json(
        { ok: false, error: `回复最多 ${MAX_REPLY_LENGTH} 字` },
        400
      );
    }

    const result = appendReplyEntry({
      threadId,
      floorId: floorId || undefined,
      replyId: replyId || undefined,
      content,
      author: auth.session.user.username,
      authorRole: auth.session.user.role,
    });

    if (result.error) {
      return c.json({ ok: false, error: result.error }, result.status);
    }

    return c.json({ ok: true, data: buildThreadDetail(result.thread) }, 201);
  });

  forum.post("/threads/:threadId/actions", async (c) => {
    const auth = requireModeratorSession(c);
    if (!auth.ok) {
      return auth.response;
    }

    const threadId = c.req.param("threadId");
    const body = await c.req.json().catch(() => null);
    const action = body && typeof body.action === "string" ? body.action.trim() : "";

    if (!action) {
      return c.json({ ok: false, error: "管理动作不能为空" }, 400);
    }

    const result = manageThreadEntry({
      threadId,
      action,
      actor: auth.session.user.username,
    });

    if (result.error) {
      return c.json({ ok: false, error: result.error }, result.status);
    }

    return c.json({ ok: true, data: buildThreadDetail(result.thread) });
  });

  return forum;
}
