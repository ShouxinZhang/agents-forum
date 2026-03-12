import type {
  ForumBootstrap,
  Thread,
  ThreadAction,
  ThreadFeedResult,
  ThreadRepliesPage,
  ThreadSort,
} from "./types"
import { buildApiPath } from "@/lib/base-path"

type ApiResponse<T> = {
  ok: boolean
  data?: T
  error?: string
}

type CreateThreadInput = {
  sectionId: string
  title: string
  content: string
  tags: string[]
}

type CreateReplyInput = {
  threadId: string
  floorId?: string
  replyId?: string
  content: string
}

type FetchThreadsInput = {
  sectionId: string
  search?: string
  sort?: ThreadSort
  page?: number
  pageSize?: number
}

async function readApi<T>(
  input: string,
  init?: RequestInit,
  signal?: AbortSignal
): Promise<T> {
  const response = await fetch(input, { ...init, signal })
  const payload = (await response.json()) as ApiResponse<T>

  if (!response.ok || !payload.ok || !payload.data) {
    throw new Error(payload.error || "论坛初始化失败")
  }

  return payload.data
}

export async function fetchForumBootstrap(signal?: AbortSignal): Promise<ForumBootstrap> {
  return readApi<ForumBootstrap>(buildApiPath("/forum/bootstrap"), undefined, signal)
}

export async function fetchForumThreads(
  input: FetchThreadsInput,
  signal?: AbortSignal
): Promise<ThreadFeedResult> {
  const query = new URLSearchParams()
  query.set("sectionId", input.sectionId)

  if (input.search) {
    query.set("search", input.search)
  }

  if (input.sort) {
    query.set("sort", input.sort)
  }

  if (input.page) {
    query.set("page", String(input.page))
  }

  if (input.pageSize) {
    query.set("pageSize", String(input.pageSize))
  }

  return readApi<ThreadFeedResult>(
    `${buildApiPath("/forum/threads")}?${query.toString()}`,
    undefined,
    signal
  )
}

export async function fetchForumThread(threadId: string, signal?: AbortSignal): Promise<Thread> {
  return readApi<Thread>(
    buildApiPath(`/forum/threads/${encodeURIComponent(threadId)}`),
    undefined,
    signal
  )
}

export async function fetchThreadReplies(
  threadId: string,
  input?: {
    floorId?: string
    replyId?: string
    offset?: number
    limit?: number
  },
  signal?: AbortSignal
): Promise<ThreadRepliesPage> {
  const query = new URLSearchParams()
  if (input?.floorId) {
    query.set("floorId", input.floorId)
  }
  if (input?.replyId) {
    query.set("replyId", input.replyId)
  }
  if (typeof input?.offset === "number") {
    query.set("offset", String(input.offset))
  }
  if (typeof input?.limit === "number") {
    query.set("limit", String(input.limit))
  }

  const queryString = query.toString()
  const path = `${buildApiPath(`/forum/threads/${encodeURIComponent(threadId)}/replies`)}${
    queryString ? `?${queryString}` : ""
  }`
  return readApi<ThreadRepliesPage>(path, undefined, signal)
}

export async function createForumThread(
  token: string,
  input: CreateThreadInput
): Promise<Thread> {
  return readApi<Thread>(buildApiPath("/forum/threads"), {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(input),
  })
}

export async function createForumReply(
  token: string,
  input: CreateReplyInput
): Promise<Thread> {
  return readApi<Thread>(buildApiPath("/forum/replies"), {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(input),
  })
}

export async function manageForumThread(
  token: string,
  threadId: string,
  action: ThreadAction
): Promise<Thread> {
  return readApi<Thread>(
    buildApiPath(`/forum/threads/${encodeURIComponent(threadId)}/actions`),
    {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ action }),
    }
  )
}
