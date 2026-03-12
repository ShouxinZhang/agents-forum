import type {
  ForumRoute,
  Reply,
  Thread,
  ThreadReviewStatus,
  ThreadSort,
  ThreadSummary,
  UserRole,
} from "./types"
import { stripBasePath, withBasePath } from "@/lib/base-path"

export const MAX_TITLE_LENGTH = 120
export const MAX_THREAD_CONTENT_LENGTH = 2000
export const MAX_REPLY_LENGTH = 1000

export const formatNow = () => {
  const now = new Date()
  const pad = (num: number) => String(num).padStart(2, "0")
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`
}

export const generateId = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}`

export const getRoleByUsername = (name: string): UserRole => {
  if (name === "admin") {
    return "super_admin"
  }

  if (["claw-a", "claw-b", "claw-c"].includes(name)) {
    return "agent"
  }

  if (name === "claw-mod") {
    return "observer"
  }

  return "user"
}

const countReplies = (replies: Reply[]): number =>
  replies.reduce((count, reply) => count + 1 + countReplies(reply.children), 0)

export const toThreadSummary = (thread: Thread): ThreadSummary => ({
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
})

export const buildFeedPath = () => withBasePath("/")

export const buildThreadPath = (threadId: string) =>
  withBasePath(`/threads/${encodeURIComponent(threadId)}`)

export const buildMonitoringPath = (instanceId?: string) =>
  instanceId
    ? withBasePath(`/monitoring/${encodeURIComponent(instanceId)}`)
    : withBasePath("/monitoring")

export const getRouteFromPath = (pathname: string): ForumRoute => {
  const normalizedPath = stripBasePath(pathname)
  const monitoringMatch = normalizedPath.match(/^\/monitoring(?:\/([^/]+))?\/?$/)
  if (monitoringMatch) {
    return {
      kind: "monitoring",
      instanceId: monitoringMatch[1] ? decodeURIComponent(monitoringMatch[1]) : undefined,
    }
  }

  const match = normalizedPath.match(/^\/threads\/([^/]+)\/?$/)

  if (!match) {
    return { kind: "feed" }
  }

  return {
    kind: "thread",
    threadId: decodeURIComponent(match[1]),
  }
}

export const buildFeedCacheKey = ({
  sectionId,
  search,
  sort,
  page,
  pageSize,
}: {
  sectionId: string
  search: string
  sort: ThreadSort
  page: number
  pageSize: number
}) => `${sectionId}::${search}::${sort}::${page}::${pageSize}`

export const getReviewStatusLabel = (status: ThreadReviewStatus) => {
  if (status === "rejected") {
    return "审核驳回"
  }

  if (status === "pending") {
    return "待审核"
  }

  return "审核通过"
}
