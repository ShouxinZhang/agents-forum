import { readForumState, updateForumState } from "./store.mjs";

function formatNow() {
  const now = new Date();
  const pad = (num) => String(num).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(
    now.getHours()
  )}:${pad(now.getMinutes())}`;
}

function generateId(prefix) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

function countReplies(replies) {
  return replies.reduce(
    (count, reply) => count + 1 + countReplies(reply.children),
    0
  );
}

function normalizeSearchInput(search) {
  return (search || "").trim().toLowerCase();
}

function compareByCreatedAt(left, right) {
  return right.createdAt.localeCompare(left.createdAt);
}

function sortThreads(threads, sort) {
  const items = [...threads];

  if (sort === "oldest") {
    return items.sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  }

  if (sort === "most_replies") {
    return items.sort((left, right) => {
      const replyCountDiff = countReplies(right.floors) - countReplies(left.floors);
      if (replyCountDiff !== 0) {
        return replyCountDiff;
      }

      return compareByCreatedAt(left, right);
    });
  }

  return items.sort((left, right) => {
    const pinDiff = Number(Boolean(right.isPinned)) - Number(Boolean(left.isPinned));
    if (pinDiff !== 0) {
      return pinDiff;
    }

    return compareByCreatedAt(left, right);
  });
}

function filterBySearch(threads, search) {
  const normalizedSearch = normalizeSearchInput(search);
  if (!normalizedSearch) {
    return threads;
  }

  return threads.filter((thread) => {
    const haystack = [
      thread.title,
      thread.summary,
      thread.author,
      ...(thread.tags ?? []),
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(normalizedSearch);
  });
}

function getNestedReplyChildren(replyId, replies) {
  for (const reply of replies) {
    if (reply.id === replyId) {
      return reply.children;
    }

    const nested = getNestedReplyChildren(replyId, reply.children ?? []);
    if (nested) {
      return nested;
    }
  }

  return null;
}

export function getSectionById(sectionId) {
  return readForumState().sections.find((section) => section.id === sectionId) ?? null;
}

export function getThreadById(threadId, options = {}) {
  const { includeDeleted = false } = options;

  return (
    readForumState().threads.find(
      (thread) => thread.id === threadId && (includeDeleted || !thread.isDeleted)
    ) ?? null
  );
}

export function listThreads(options = {}) {
  const {
    sectionId,
    search = "",
    sort = "latest",
    page = 1,
    pageSize = 10,
    includeDeleted = false,
  } = options;
  const { threads } = readForumState();
  const scopedThreads = sectionId
    ? threads.filter((thread) => thread.sectionId === sectionId)
    : threads;
  const visibleThreads = includeDeleted
    ? scopedThreads
    : scopedThreads.filter((thread) => !thread.isDeleted);
  const searchedThreads = filterBySearch(visibleThreads, search);
  const sortedThreads = sortThreads(searchedThreads, sort);
  const safePage = Math.max(1, page);
  const safePageSize = Math.min(Math.max(1, pageSize), 50);
  const total = sortedThreads.length;
  const startIndex = (safePage - 1) * safePageSize;
  const items = sortedThreads.slice(startIndex, startIndex + safePageSize);

  return {
    items,
    total,
    page: safePage,
    pageSize: safePageSize,
    hasMore: startIndex + safePageSize < total,
  };
}

export function buildThreadSummary(thread) {
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
    isLocked: Boolean(thread.isLocked),
    reviewStatus: thread.reviewStatus ?? "approved",
    isDeleted: Boolean(thread.isDeleted),
    replyCount: countReplies(thread.floors),
  };
}

export function buildThreadDetail(thread) {
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
    isLocked: Boolean(thread.isLocked),
    reviewStatus: thread.reviewStatus ?? "approved",
    isDeleted: Boolean(thread.isDeleted),
    floors: thread.floors,
  };
}

export function buildForumBootstrap() {
  const { sections } = readForumState();

  return {
    sections: sections.map((section) => ({
      ...section,
      threadCount: listThreads({ sectionId: section.id }).total,
    })),
  };
}

export function createThreadEntry({
  sectionId,
  title,
  content,
  tags,
  author,
  authorRole,
}) {
  return updateForumState((state) => {
    const createdAt = formatNow();
    const thread = {
      id: generateId("t"),
      sectionId,
      title,
      summary: content.slice(0, 72),
      tags,
      author,
      authorRole,
      createdAt,
      isPinned: false,
      isLocked: false,
      reviewStatus: "approved",
      isDeleted: false,
      floors: [
        {
          id: generateId("f"),
          author,
          authorRole,
          content,
          createdAt,
          children: [],
        },
      ],
    };

    state.threads.unshift(thread);
    return thread;
  });
}

export function appendReplyEntry({
  threadId,
  floorId,
  replyId,
  content,
  author,
  authorRole,
}) {
  return updateForumState((state) => {
    const thread = state.threads.find((item) => item.id === threadId);
    if (!thread) {
      return { error: "Thread Not Found", status: 404 };
    }

    if (thread.isDeleted) {
      return { error: "Thread Not Found", status: 404 };
    }

    if (thread.isLocked) {
      return { error: "Thread Locked", status: 403 };
    }

    const createdAt = formatNow();

    if (!floorId) {
      thread.floors.push({
        id: generateId("f"),
        author,
        authorRole,
        content,
        createdAt,
        children: [],
      });
      return { thread };
    }

    const targetFloor = thread.floors.find((floor) => floor.id === floorId);
    if (!targetFloor) {
      return { error: "Floor Not Found", status: 404 };
    }

    if (!replyId) {
      targetFloor.children.push({
        id: generateId("r"),
        author,
        authorRole,
        content,
        createdAt,
        parentId: floorId,
        children: [],
      });
      return { thread };
    }

    const targetReply = targetFloor.children.find((reply) => reply.id === replyId);
    if (!targetReply) {
      return { error: "Reply Not Found", status: 404 };
    }

    targetReply.children.push({
      id: generateId("r2"),
      author,
      authorRole,
      content,
      createdAt,
      parentId: replyId,
      children: [],
    });

    return { thread };
  });
}

export function readThreadReplies({
  threadId,
  floorId,
  replyId,
  offset = 0,
  limit = 20,
}) {
  const thread = getThreadById(threadId);
  if (!thread) {
    return { error: "Thread Not Found", status: 404 };
  }

  const safeOffset = Math.max(0, offset);
  const safeLimit = Math.min(Math.max(1, limit), 50);
  const rootFloors = thread.floors ?? [];

  if (!floorId) {
    const items = rootFloors.slice(safeOffset, safeOffset + safeLimit);
    return {
      threadId,
      floorId: null,
      replyId: null,
      total: rootFloors.length,
      offset: safeOffset,
      limit: safeLimit,
      hasMore: safeOffset + safeLimit < rootFloors.length,
      items,
    };
  }

  const targetFloor = rootFloors.find((floor) => floor.id === floorId);
  if (!targetFloor) {
    return { error: "Floor Not Found", status: 404 };
  }

  const scopedReplies = replyId
    ? getNestedReplyChildren(replyId, targetFloor.children ?? [])
    : targetFloor.children ?? [];

  if (replyId && !scopedReplies) {
    return { error: "Reply Not Found", status: 404 };
  }

  const items = scopedReplies.slice(safeOffset, safeOffset + safeLimit);
  return {
    threadId,
    floorId,
    replyId: replyId ?? null,
    total: scopedReplies.length,
    offset: safeOffset,
    limit: safeLimit,
    hasMore: safeOffset + safeLimit < scopedReplies.length,
    items,
  };
}

export function manageThreadEntry({ threadId, action, actor }) {
  return updateForumState((state) => {
    const thread = state.threads.find((item) => item.id === threadId);
    if (!thread) {
      return { error: "Thread Not Found", status: 404 };
    }

    switch (action) {
      case "pin":
        thread.isPinned = true;
        break;
      case "unpin":
        thread.isPinned = false;
        break;
      case "lock":
        thread.isLocked = true;
        break;
      case "unlock":
        thread.isLocked = false;
        break;
      case "delete":
        thread.isDeleted = true;
        thread.deletedAt = formatNow();
        thread.deletedBy = actor;
        break;
      case "restore":
        thread.isDeleted = false;
        delete thread.deletedAt;
        delete thread.deletedBy;
        break;
      case "approve":
        thread.reviewStatus = "approved";
        thread.reviewedAt = formatNow();
        thread.reviewedBy = actor;
        break;
      case "reject":
        thread.reviewStatus = "rejected";
        thread.reviewedAt = formatNow();
        thread.reviewedBy = actor;
        break;
      default:
        return { error: "Unsupported Action", status: 400 };
    }

    return { thread };
  });
}
