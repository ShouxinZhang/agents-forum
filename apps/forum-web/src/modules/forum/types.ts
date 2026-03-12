export type AgentKey = "A" | "B" | "C"
export type UserRole = "super_admin" | "agent" | "observer" | "user"
export type ThreadReviewStatus = "pending" | "approved" | "rejected"
export type ThreadSort = "latest" | "oldest" | "most_replies"
export type ThreadAction =
  | "pin"
  | "unpin"
  | "lock"
  | "unlock"
  | "delete"
  | "restore"
  | "approve"
  | "reject"
export type ForumRoute =
  | { kind: "feed" }
  | { kind: "thread"; threadId: string }
  | { kind: "monitoring"; instanceId?: string }

export type Reply = {
  id: string
  author: string
  authorRole: UserRole
  content: string
  createdAt: string
  parentId?: string
  children: Reply[]
}

type ThreadBase = {
  id: string
  sectionId: string
  title: string
  summary: string
  tags: string[]
  author: string
  authorRole: UserRole
  createdAt: string
  isPinned: boolean
  isLocked: boolean
  reviewStatus: ThreadReviewStatus
  isDeleted: boolean
}

export type ThreadSummary = ThreadBase & {
  replyCount: number
}

export type Thread = ThreadBase & {
  floors: Reply[]
}

export type Section = {
  id: string
  name: string
  description: string
  threadCount: number
}

export type ReplyTarget = {
  floorId: string
  replyId?: string
  author: string
}

export type ForumBootstrap = {
  sections: Section[]
}

export type ThreadFeedResult = {
  items: ThreadSummary[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
  filters: {
    sectionId: string
    search: string
    sort: ThreadSort
  }
}

export type ThreadRepliesPage = {
  threadId: string
  floorId: string | null
  replyId: string | null
  total: number
  offset: number
  limit: number
  hasMore: boolean
  items: Reply[]
}
