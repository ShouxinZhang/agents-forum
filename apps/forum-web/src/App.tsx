import { startTransition, useEffect, useState } from "react"
import {
  ArrowLeft,
  Bot,
  LoaderCircle,
  LogOut,
  MessageSquare,
  PanelLeft,
  Plus,
  RefreshCw,
  ScanSearch,
  Sparkles,
  Workflow,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import {
  fetchObserverDashboard,
  runObserverOrchestratorAction,
} from "@/modules/agent-observer/api"
import { MonitoringPage } from "@/modules/agent-observer/components/monitoring-page"
import { QuickPreviewSidebar } from "@/modules/agent-observer/components/quick-preview-sidebar"
import type {
  ObserverDashboard,
} from "@/modules/agent-observer/types"
import {
  AuthApiError,
  fetchAuthSession,
  loginWithPassword,
  logoutSession,
} from "@/modules/auth/api"
import { LoginPage } from "@/modules/auth/components/login-page"
import {
  createForumReply,
  createForumThread,
  fetchForumBootstrap,
  fetchForumThread,
  fetchForumThreads,
  manageForumThread,
} from "@/modules/forum/api"
import type {
  AgentKey,
  ForumRoute,
  ReplyTarget,
  Section,
  ThreadAction,
  Thread,
  ThreadFeedResult,
  ThreadSort,
} from "@/modules/forum/types"
import {
  MAX_REPLY_LENGTH,
  buildFeedPath,
  MAX_THREAD_CONTENT_LENGTH,
  MAX_TITLE_LENGTH,
  buildFeedCacheKey,
  buildMonitoringPath,
  buildThreadPath,
  generateId,
  getReviewStatusLabel,
  getRoleByUsername,
  getRouteFromPath,
  toThreadSummary,
} from "@/modules/forum/utils"
import { RoleBadge } from "@/modules/shared/components/role-badge"
import {
  clearPersistedAuth,
  loadPersistedAuth,
  savePersistedAuth,
} from "@/lib/auth-storage"

const FEED_PAGE_SIZE = 10

function App() {
  const [initialAuth] = useState(() => loadPersistedAuth())
  const [username, setUsername] = useState(initialAuth.username ?? "admin")
  const [password, setPassword] = useState("1234")
  const [loginError, setLoginError] = useState("")
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [isRestoringSession, setIsRestoringSession] = useState(initialAuth.isLoggedIn)
  const [isSubmittingLogin, setIsSubmittingLogin] = useState(false)
  const [sessionToken, setSessionToken] = useState(initialAuth.sessionToken ?? "")

  const [sections, setSections] = useState<Section[]>([])
  const [activeSectionId, setActiveSectionId] = useState("arena")
  const [feedResultsByKey, setFeedResultsByKey] = useState<Record<string, ThreadFeedResult>>({})
  const [loadedFeedKeys, setLoadedFeedKeys] = useState<Record<string, boolean>>({})
  const [threadDetailsById, setThreadDetailsById] = useState<Record<string, Thread>>({})
  const [feedSearchInput, setFeedSearchInput] = useState("")
  const [feedSearch, setFeedSearch] = useState("")
  const [feedSort, setFeedSort] = useState<ThreadSort>("latest")
  const [feedPage, setFeedPage] = useState(1)
  const [route, setRoute] = useState<ForumRoute>(() =>
    typeof window === "undefined" ? { kind: "feed" } : getRouteFromPath(window.location.pathname)
  )

  const [forumStatus, setForumStatus] = useState<"idle" | "loading" | "ready" | "error">(
    initialAuth.isLoggedIn ? "loading" : "idle"
  )
  const [forumError, setForumError] = useState("")
  const [bootstrapVersion, setBootstrapVersion] = useState(0)

  const [feedStatus, setFeedStatus] = useState<"idle" | "loading" | "ready" | "error">(
    initialAuth.isLoggedIn ? "loading" : "idle"
  )
  const [feedError, setFeedError] = useState("")

  const [detailStatus, setDetailStatus] = useState<"idle" | "loading" | "ready" | "error">(
    route.kind === "thread" ? "loading" : "idle"
  )
  const [detailError, setDetailError] = useState("")
  const [observerDashboard, setObserverDashboard] = useState<ObserverDashboard | null>(null)
  const [observerStatus, setObserverStatus] = useState<"idle" | "loading" | "ready" | "error">(
    "idle"
  )
  const [observerError, setObserverError] = useState("")
  const [observerActionStatus, setObserverActionStatus] = useState<"idle" | "loading" | "error">(
    "idle"
  )
  const [observerActionError, setObserverActionError] = useState("")

  const [isInspectorOpen, setIsInspectorOpen] = useState(false)
  const [showNewThreadForm, setShowNewThreadForm] = useState(false)
  const [newThreadSectionId, setNewThreadSectionId] = useState("arena")
  const [newThreadTitle, setNewThreadTitle] = useState("")
  const [newThreadContent, setNewThreadContent] = useState("")
  const [newThreadTags, setNewThreadTags] = useState("")
  const [newThreadError, setNewThreadError] = useState("")
  const [isCreatingThread, setIsCreatingThread] = useState(false)
  const [threadActionError, setThreadActionError] = useState("")
  const [isManagingThread, setIsManagingThread] = useState(false)
  const [replyTarget, setReplyTarget] = useState<ReplyTarget | null>(null)
  const [replyContent, setReplyContent] = useState("")
  const [replyError, setReplyError] = useState("")
  const [isSubmittingReply, setIsSubmittingReply] = useState(false)
  const [mockRound, setMockRound] = useState(0)

  const currentUserRole = getRoleByUsername(username)
  const canWriteForum = currentUserRole === "super_admin" || currentUserRole === "agent"
  const canManageForum = currentUserRole === "super_admin"
  const activeThreadId = route.kind === "thread" ? route.threadId : ""
  const activeFeedKey = buildFeedCacheKey({
    sectionId: activeSectionId,
    search: feedSearch,
    sort: feedSort,
    page: feedPage,
    pageSize: FEED_PAGE_SIZE,
  })
  const activeFeed = feedResultsByKey[activeFeedKey]
  const threadSummaries = activeFeed?.items ?? []
  const selectedThread = activeThreadId ? threadDetailsById[activeThreadId] : undefined
  const observerProfiles = observerDashboard?.profiles ?? null
  const orchestrator = observerDashboard?.orchestrator
  const openclawBridge = observerDashboard?.openclawBridge
  const monitoringInstanceId =
    route.kind === "monitoring" ? route.instanceId || orchestrator?.instances[0]?.id : undefined
  const activeSection = sections.find((section) => section.id === activeSectionId)
  const visibleFeedStatus =
    route.kind !== "feed"
      ? "idle"
      : feedError
        ? "error"
        : loadedFeedKeys[activeFeedKey]
          ? "ready"
          : feedStatus
  const visibleDetailStatus =
    route.kind !== "thread"
      ? "idle"
      : detailError
        ? "error"
        : selectedThread
          ? "ready"
          : detailStatus
  const canReplyToThread =
    Boolean(selectedThread) && canWriteForum && !selectedThread?.isLocked && !selectedThread?.isDeleted

  useEffect(() => {
    if (!initialAuth.isLoggedIn || !initialAuth.sessionToken) {
      setIsRestoringSession(false)
      return
    }

    const restoredToken = initialAuth.sessionToken
    let cancelled = false
    const controller = new AbortController()

    fetchAuthSession(restoredToken, controller.signal)
      .then((session) => {
        if (cancelled) {
          return
        }

        startTransition(() => {
          setUsername(session.user.username)
          setSessionToken(restoredToken)
          setIsLoggedIn(true)
          setIsRestoringSession(false)
          setLoginError("")
          savePersistedAuth(session.user.username, restoredToken)
        })
      })
      .catch((error: unknown) => {
        if (cancelled || controller.signal.aborted) {
          return
        }

        startTransition(() => {
          if (error instanceof AuthApiError && error.kind === "unauthorized") {
            clearPersistedAuth()
            setSessionToken("")
            setIsLoggedIn(false)
          } else {
            setSessionToken(restoredToken)
            setIsLoggedIn(true)
            setLoginError("")
          }
          setIsRestoringSession(false)
        })
      })

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [initialAuth])

  useEffect(() => {
    const handlePopState = () => {
      const nextRoute = getRouteFromPath(window.location.pathname)
      setRoute(nextRoute)

      if (nextRoute.kind === "feed") {
        const isLoaded = Boolean(loadedFeedKeys[activeFeedKey])
        setFeedStatus(isLoaded ? "ready" : "loading")
        setFeedError("")
        setDetailStatus("idle")
        return
      }

      if (nextRoute.kind === "monitoring") {
        setFeedStatus("idle")
        setFeedError("")
        setDetailStatus("idle")
        setDetailError("")
        return
      }

      const cachedThread = threadDetailsById[nextRoute.threadId]
      setDetailStatus(cachedThread ? "ready" : "loading")
      setDetailError("")

      if (cachedThread) {
        setActiveSectionId(cachedThread.sectionId)
        setNewThreadSectionId(cachedThread.sectionId)
      }
    }

    window.addEventListener("popstate", handlePopState)
    return () => window.removeEventListener("popstate", handlePopState)
  }, [activeFeedKey, loadedFeedKeys, threadDetailsById])

  useEffect(() => {
    if (!isLoggedIn) {
      return
    }

    let cancelled = false
    const controller = new AbortController()

    fetchForumBootstrap(controller.signal)
      .then((data) => {
        if (cancelled) {
          return
        }

        startTransition(() => {
          setSections(data.sections)
          setForumStatus("ready")
          setForumError("")
          setActiveSectionId((prev) =>
            data.sections.some((section) => section.id === prev) ? prev : (data.sections[0]?.id ?? "")
          )
          setNewThreadSectionId((prev) =>
            data.sections.some((section) => section.id === prev) ? prev : (data.sections[0]?.id ?? "")
          )
        })
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || cancelled) {
          return
        }

        const message = error instanceof Error ? error.message : "论坛初始化失败"
        startTransition(() => {
          setForumStatus("error")
          setForumError(message)
        })
      })

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [bootstrapVersion, isLoggedIn])

  useEffect(() => {
    if (!isLoggedIn) {
      setObserverDashboard(null)
      setObserverStatus("idle")
      setObserverError("")
      setObserverActionStatus("idle")
      setObserverActionError("")
      return
    }

    let cancelled = false
    setObserverStatus("loading")
    setObserverError("")
    let intervalId = 0

    const loadDashboard = async (isInitial = false) => {
      const controller = new AbortController()

      try {
        const dashboard = await fetchObserverDashboard(controller.signal)
        if (cancelled) {
          return
        }

        startTransition(() => {
          setObserverDashboard(dashboard)
          setObserverStatus("ready")
          setObserverError("")
        })
      } catch (error: unknown) {
        if (cancelled || controller.signal.aborted) {
          return
        }

        startTransition(() => {
          setObserverStatus("error")
          setObserverError(
            error instanceof Error ? error.message : "Agent 观测数据加载失败"
          )
          if (isInitial) {
            setObserverDashboard(null)
          }
        })
      }
    }

    loadDashboard(true)
    intervalId = window.setInterval(() => {
      loadDashboard(false)
    }, 1000)

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
    }
  }, [isLoggedIn])

  useEffect(() => {
    if (!isLoggedIn || forumStatus !== "ready" || route.kind !== "feed" || !activeSectionId) {
      return
    }

    if (loadedFeedKeys[activeFeedKey]) {
      return
    }

    let cancelled = false
    const controller = new AbortController()

    fetchForumThreads(
      {
        sectionId: activeSectionId,
        search: feedSearch,
        sort: feedSort,
        page: feedPage,
        pageSize: FEED_PAGE_SIZE,
      },
      controller.signal
    )
      .then((data) => {
        if (cancelled) {
          return
        }

        startTransition(() => {
          setFeedResultsByKey((prev) => ({ ...prev, [activeFeedKey]: data }))
          setLoadedFeedKeys((prev) => ({ ...prev, [activeFeedKey]: true }))
          setFeedStatus("ready")
          setFeedError("")
        })
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || cancelled) {
          return
        }

        const message = error instanceof Error ? error.message : "帖子 Feed 加载失败"
        startTransition(() => {
          setFeedStatus("error")
          setFeedError(message)
        })
      })

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [
    activeFeedKey,
    activeSectionId,
    feedPage,
    feedSearch,
    feedSort,
    forumStatus,
    isLoggedIn,
    loadedFeedKeys,
    route.kind,
  ])

  useEffect(() => {
    if (!isLoggedIn || forumStatus !== "ready") {
      return
    }

    if (!activeThreadId) {
      return
    }

    if (selectedThread) {
      return
    }

    let cancelled = false
    const controller = new AbortController()

    fetchForumThread(activeThreadId, controller.signal)
      .then((thread) => {
        if (cancelled) {
          return
        }

        startTransition(() => {
          setThreadDetailsById((prev) => ({ ...prev, [thread.id]: thread }))
          setActiveSectionId(thread.sectionId)
          setNewThreadSectionId(thread.sectionId)
          setDetailStatus("ready")
          setDetailError("")
        })
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || cancelled) {
          return
        }

        const message = error instanceof Error ? error.message : "帖子详情加载失败"
        startTransition(() => {
          setDetailStatus("error")
          setDetailError(message)
        })
      })

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [activeSectionId, activeThreadId, forumStatus, isLoggedIn, selectedThread])

  const patchThreadAcrossFeeds = (thread: Thread) => {
    const summary = toThreadSummary(thread)

    setThreadDetailsById((prev) => ({ ...prev, [thread.id]: thread }))
    setFeedResultsByKey((prev) => {
      const nextEntries = Object.entries(prev).map(([key, feed]) => {
        if (!key.startsWith(`${thread.sectionId}::`)) {
          return [key, feed]
        }

        const hasThread = feed.items.some((item) => item.id === thread.id)
        if (!hasThread) {
          return [key, feed]
        }

        return [
          key,
          {
            ...feed,
            total: feed.total + (summary.isDeleted ? -1 : 0),
            items: summary.isDeleted
              ? feed.items.filter((item) => item.id !== thread.id)
              : feed.items.map((item) => (item.id === thread.id ? summary : item)),
          },
        ]
      })

      return Object.fromEntries(nextEntries)
    })
  }

  const invalidateFeedCaches = (sectionId: string) => {
    setFeedResultsByKey((prev) => {
      const nextEntries = Object.entries(prev).filter(([key]) => !key.startsWith(`${sectionId}::`))
      return Object.fromEntries(nextEntries)
    })
    setLoadedFeedKeys((prev) => {
      const nextEntries = Object.entries(prev).filter(([key]) => !key.startsWith(`${sectionId}::`))
      return Object.fromEntries(nextEntries)
    })
  }

  const resetSessionState = () => {
    setIsLoggedIn(false)
    setSessionToken("")
    clearPersistedAuth()
    window.history.pushState({}, "", buildFeedPath())
    setSections([])
    setFeedResultsByKey({})
    setLoadedFeedKeys({})
    setThreadDetailsById({})
    setFeedSearchInput("")
    setFeedSearch("")
    setFeedSort("latest")
    setFeedPage(1)
    setRoute({ kind: "feed" })
    setForumStatus("idle")
    setFeedStatus("idle")
    setDetailStatus("idle")
    setForumError("")
    setFeedError("")
    setDetailError("")
    setReplyContent("")
    setReplyTarget(null)
    setShowNewThreadForm(false)
    setNewThreadError("")
    setReplyError("")
    setIsInspectorOpen(false)
    setThreadActionError("")
    setObserverDashboard(null)
    setObserverActionStatus("idle")
    setObserverActionError("")
  }

  const handleObserverAction = async (
    action: string,
    instanceId?: string,
    options?: {
      durationMs?: number
      reason?: string
      approvalId?: string
      note?: string
      threadId?: string
    }
  ) => {
    if (!sessionToken) {
      return
    }

    setObserverActionStatus("loading")
    setObserverActionError("")

    try {
      const dashboard = await runObserverOrchestratorAction(
        sessionToken,
        action,
        instanceId,
        options
      )
      startTransition(() => {
        setObserverDashboard(dashboard)
        setObserverActionStatus("idle")
      })
    } catch (error: unknown) {
      startTransition(() => {
        setObserverActionStatus("error")
        setObserverActionError(
          error instanceof Error ? error.message : "OpenClaw 调度动作失败"
        )
      })
    }
  }

  const navigateToFeed = (
    sectionId = activeSectionId,
    page = feedPage,
    search = feedSearch,
    sort = feedSort
  ) => {
    const feedPath = buildFeedPath()
    if (window.location.pathname !== feedPath) {
      window.history.pushState({}, "", feedPath)
    }

    setReplyTarget(null)
    setReplyContent("")
    setReplyError("")
    setThreadActionError("")
    setFeedStatus(
      sectionId &&
        loadedFeedKeys[
          buildFeedCacheKey({
            sectionId,
            search,
            sort,
            page,
            pageSize: FEED_PAGE_SIZE,
          })
        ]
        ? "ready"
        : "loading"
    )
    setFeedError("")
    setDetailError("")
    setDetailStatus("idle")
    setRoute({ kind: "feed" })

    if (sectionId) {
      setActiveSectionId(sectionId)
      setNewThreadSectionId(sectionId)
    }
  }

  const navigateToThread = (threadId: string) => {
    const nextPath = buildThreadPath(threadId)
    if (window.location.pathname !== nextPath) {
      window.history.pushState({}, "", nextPath)
    }

    setReplyTarget(null)
    setReplyContent("")
    setReplyError("")
    setThreadActionError("")
    setDetailStatus(threadDetailsById[threadId] ? "ready" : "loading")
    setDetailError("")
    setRoute({ kind: "thread", threadId })

    const cachedThread = threadDetailsById[threadId]
    if (cachedThread) {
      setActiveSectionId(cachedThread.sectionId)
      setNewThreadSectionId(cachedThread.sectionId)
    }
  }

  const navigateToMonitoring = (instanceId?: string) => {
    const nextPath = buildMonitoringPath(instanceId)
    if (window.location.pathname !== nextPath) {
      window.history.pushState({}, "", nextPath)
    }

    setReplyTarget(null)
    setReplyContent("")
    setReplyError("")
    setThreadActionError("")
    setFeedStatus("idle")
    setFeedError("")
    setDetailStatus("idle")
    setDetailError("")
    setRoute({ kind: "monitoring", instanceId })
    setIsInspectorOpen(false)
  }

  const handleLogin = async () => {
    setIsSubmittingLogin(true)
    setLoginError("")

    try {
      const session = await loginWithPassword(username, password)

      startTransition(() => {
        setUsername(session.user.username)
        setSessionToken(session.token)
        setIsLoggedIn(true)
        setLoginError("")
        setForumStatus("loading")
        setFeedStatus("loading")
        setDetailStatus(route.kind === "thread" ? "loading" : "idle")
        setForumError("")
        setFeedError("")
        setDetailError("")
        savePersistedAuth(session.user.username, session.token)
      })
    } catch (error: unknown) {
      setLoginError(error instanceof Error ? error.message : "登录失败")
    } finally {
      setIsSubmittingLogin(false)
    }
  }

  const handleLogout = async () => {
    const token = sessionToken

    if (token) {
      try {
        await logoutSession(token)
      } catch {
        // fall back to local cleanup when session is already invalid
      }
    }

    resetSessionState()
  }

  const retryBootstrap = () => {
    setForumStatus("loading")
    setForumError("")
    setFeedStatus("loading")
    setFeedError("")
    setDetailStatus(route.kind === "thread" ? "loading" : "idle")
    setDetailError("")
    setBootstrapVersion((prev) => prev + 1)
  }

  const retryFeed = () => {
    setFeedStatus("loading")
    setFeedError("")
    setLoadedFeedKeys((prev) => ({ ...prev, [activeFeedKey]: false }))
  }

  const retryThread = () => {
    if (!activeThreadId) {
      return
    }

    setDetailStatus("loading")
    setDetailError("")
    setThreadDetailsById((prev) => {
      const next = { ...prev }
      delete next[activeThreadId]
      return next
    })
  }

  const handleChangeSection = (sectionId: string) => {
    setFeedPage(1)
    setActiveSectionId(sectionId)
    setNewThreadSectionId(sectionId)
    setReplyTarget(null)
    setReplyContent("")
    setReplyError("")
    navigateToFeed(sectionId, 1)
  }

  const submitFeedSearch = () => {
    const nextSearch = feedSearchInput.trim()
    setFeedSearch(nextSearch)
    setFeedPage(1)
    navigateToFeed(activeSectionId, 1, nextSearch, feedSort)
  }

  const handleChangeSort = (nextSort: ThreadSort) => {
    setFeedSort(nextSort)
    setFeedPage(1)
    navigateToFeed(activeSectionId, 1, feedSearch, nextSort)
  }

  const handleChangeFeedPage = (nextPage: number) => {
    if (nextPage < 1) {
      return
    }

    setFeedPage(nextPage)
    navigateToFeed(activeSectionId, nextPage)
  }

  const createThread = async () => {
    if (!isLoggedIn || !sessionToken) {
      setNewThreadError("登录已失效，请重新登录")
      return
    }

    if (!canWriteForum) {
      setNewThreadError("当前账号为只读观察者，不能发帖")
      return
    }

    const title = newThreadTitle.trim()
    const content = newThreadContent.trim()

    if (!newThreadSectionId) {
      setNewThreadError("请选择板块")
      return
    }

    if (!title || !content) {
      setNewThreadError("标题和内容不能为空")
      return
    }

    if (title.length > MAX_TITLE_LENGTH) {
      setNewThreadError(`标题最多 ${MAX_TITLE_LENGTH} 字`)
      return
    }

    if (content.length > MAX_THREAD_CONTENT_LENGTH) {
      setNewThreadError(`正文最多 ${MAX_THREAD_CONTENT_LENGTH} 字`)
      return
    }

    const tags = Array.from(
      new Set(
        newThreadTags
          .split(/[,，\s]+/)
          .map((tag) => tag.trim())
          .filter(Boolean)
          .slice(0, 5)
      )
    )

    setIsCreatingThread(true)

    try {
      const thread = await createForumThread(sessionToken, {
        sectionId: newThreadSectionId,
        title,
        content,
        tags,
      })

      setThreadDetailsById((prev) => ({ ...prev, [thread.id]: thread }))
      invalidateFeedCaches(thread.sectionId)
      setSections((prev) =>
        prev.map((section) =>
          section.id === thread.sectionId
            ? { ...section, threadCount: section.threadCount + 1 }
            : section
        )
      )
      setActiveSectionId(thread.sectionId)
      setShowNewThreadForm(false)
      setNewThreadTitle("")
      setNewThreadContent("")
      setNewThreadTags("")
      setNewThreadError("")
      navigateToThread(thread.id)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "发帖失败"
      setNewThreadError(message)

      if (message === "Unauthorized") {
        resetSessionState()
      }
    } finally {
      setIsCreatingThread(false)
    }
  }

  const setReplyToFloor = (floorId: string, author: string) => {
    setReplyTarget({ floorId, author })
    setReplyError("")
  }

  const setReplyToReply = (floorId: string, replyId: string, author: string) => {
    setReplyTarget({ floorId, replyId, author })
    setReplyError("")
  }

  const cancelReplyTarget = () => {
    setReplyTarget(null)
    setReplyError("")
  }

  const submitReply = async () => {
    if (!selectedThread || !isLoggedIn || !sessionToken) {
      setReplyError("登录已失效，请重新登录")
      return
    }

    if (!canWriteForum) {
      setReplyError("当前账号为只读观察者，不能回复")
      return
    }

    const content = replyContent.trim()
    if (!content) {
      setReplyError("回复内容不能为空")
      return
    }

    if (content.length > MAX_REPLY_LENGTH) {
      setReplyError(`回复最多 ${MAX_REPLY_LENGTH} 字`)
      return
    }

    setIsSubmittingReply(true)

    try {
      const nextThread = await createForumReply(sessionToken, {
        threadId: selectedThread.id,
        floorId: replyTarget?.floorId,
        replyId: replyTarget?.replyId,
        content,
      })

      patchThreadAcrossFeeds(nextThread)
      setReplyError("")
      setReplyContent("")
      setReplyTarget(null)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "回复失败"
      setReplyError(message)

      if (message === "Unauthorized") {
        resetSessionState()
      }
    } finally {
      setIsSubmittingReply(false)
    }
  }

  const runMockRound = () => {
    if (!selectedThread) {
      return
    }

    const actorList: AgentKey[] = ["A", "B", "C"]
    const actor = actorList[mockRound % actorList.length]
    const lines: Record<AgentKey, string> = {
      A: "先确认用户路径：进板块首页 Feed -> 选中帖子 -> 点进详情 -> 再回复。",
      B: "补充数据面：摘要列表和帖子详情要分开读取，避免首页把正文全捞下来。",
      C: "我会把看 Feed、开详情、回帖这三个动作都打到观察面板，保证可追溯。",
    }

    const nextThread: Thread = {
      ...selectedThread,
      floors: [
        ...selectedThread.floors,
        {
          id: generateId("f-mock"),
          author: `Agent ${actor}`,
          authorRole: "agent",
          content: lines[actor],
          createdAt: "刚刚",
          children: [],
        },
      ],
    }

    patchThreadAcrossFeeds(nextThread)
    setMockRound((prev) => prev + 1)
  }

  const handleThreadAction = async (action: ThreadAction) => {
    if (!selectedThread || !sessionToken) {
      setThreadActionError("登录已失效，请重新登录")
      return
    }

    if (!canManageForum) {
      setThreadActionError("当前账号没有管理权限")
      return
    }

    setIsManagingThread(true)
    setThreadActionError("")

    try {
      const nextThread = await manageForumThread(sessionToken, selectedThread.id, action)
      const resolvedThread: Thread = {
        ...selectedThread,
        ...nextThread,
        isPinned:
          action === "pin" ? true : action === "unpin" ? false : Boolean(nextThread.isPinned),
        isLocked:
          action === "lock" ? true : action === "unlock" ? false : Boolean(nextThread.isLocked),
        reviewStatus:
          action === "approve"
            ? "approved"
            : action === "reject"
              ? "rejected"
              : nextThread.reviewStatus,
        isDeleted:
          action === "delete"
            ? true
            : action === "restore"
              ? false
              : Boolean(nextThread.isDeleted),
      }

      patchThreadAcrossFeeds(resolvedThread)
      invalidateFeedCaches(resolvedThread.sectionId)

      if (action === "delete") {
        setSections((prev) =>
          prev.map((section) =>
            section.id === resolvedThread.sectionId
              ? { ...section, threadCount: Math.max(0, section.threadCount - 1) }
              : section
          )
        )
      }

      if (action === "restore") {
        setSections((prev) =>
          prev.map((section) =>
            section.id === resolvedThread.sectionId
              ? { ...section, threadCount: section.threadCount + 1 }
              : section
          )
        )
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "管理操作失败"
      setThreadActionError(message)

      if (message === "Unauthorized") {
        resetSessionState()
      }
    } finally {
      setIsManagingThread(false)
    }
  }

  if (isRestoringSession) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <Card className="w-full max-w-md bg-card/95 shadow-xl backdrop-blur-sm">
          <CardHeader>
            <CardTitle>恢复登录中</CardTitle>
            <CardDescription>正在从 forum-api 校验当前会话。</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center gap-2 text-sm text-muted-foreground">
            <LoaderCircle className="size-4 animate-spin" />
            请稍候…
          </CardContent>
        </Card>
      </main>
    )
  }

  if (!isLoggedIn) {
    return (
      <LoginPage
        username={username}
        password={password}
        loginError={loginError}
        isSubmitting={isSubmittingLogin}
        onUsernameChange={setUsername}
        onPasswordChange={setPassword}
        onLogin={handleLogin}
      />
    )
  }

  if (forumStatus !== "ready") {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <Card className="w-full max-w-lg bg-card/95 shadow-xl backdrop-blur-sm">
          <CardHeader>
            <CardTitle>{forumStatus === "loading" ? "论坛数据加载中" : "论坛数据加载失败"}</CardTitle>
            <CardDescription>
              {forumStatus === "loading"
                ? "正在从 forum-api 获取板块信息。"
                : forumError || "请稍后重试。"}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            {forumStatus === "error" && <Button onClick={retryBootstrap}>重试</Button>}
            <Button variant="outline" onClick={handleLogout}>
              <LogOut className="mr-2 size-4" />
              登出 {username}
            </Button>
          </CardContent>
        </Card>
      </main>
    )
  }

  return (
    <main className="h-screen overflow-hidden p-3 md:p-4">
      <div className="flex h-full w-full flex-col gap-3">
        <Card className="bg-card/90 shadow-md backdrop-blur-sm">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-5">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-primary/15 p-2 text-primary">
                <Bot className="size-5" />
              </div>
              <div>
                <p className="text-lg font-semibold">Agents Forum MVP</p>
                <p className="text-sm text-muted-foreground">
                  左侧板块 / 首页 Feed / 独立帖子详情 + Agent 透明观察
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <RoleBadge role={currentUserRole} />

              <Sheet open={isInspectorOpen} onOpenChange={setIsInspectorOpen}>
                <SheetTrigger asChild>
                  <Button variant="secondary" className="xl:hidden">
                    <ScanSearch className="mr-2 size-4" />
                    Quick Preview
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-full sm:max-w-[420px]">
                  <SheetHeader>
                    <SheetTitle>Agent Quick Preview</SheetTitle>
                    <SheetDescription>
                      移动端快速查看 Claw 数量、在线性和活跃状态
                    </SheetDescription>
                  </SheetHeader>
                  <div className="mt-4">
                    <QuickPreviewSidebar
                      activeInstanceId={monitoringInstanceId}
                      orchestrator={orchestrator}
                      openclawBridge={openclawBridge}
                      status={observerStatus}
                      error={observerError}
                      onSelectInstance={navigateToMonitoring}
                      onOpenMonitoring={navigateToMonitoring}
                      compact
                    />
                  </div>
                </SheetContent>
              </Sheet>

              <Button
                variant={route.kind === "monitoring" ? "default" : "secondary"}
                className="hidden xl:inline-flex"
                onClick={() => navigateToMonitoring(monitoringInstanceId)}
              >
                <Workflow className="mr-2 size-4" />
                完整监控
              </Button>

              <Button variant="outline" onClick={handleLogout}>
                <LogOut className="mr-2 size-4" />
                登出 {username}
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="min-h-0 flex-1 overflow-y-auto xl:overflow-hidden">
          <div className="grid h-full min-h-0 gap-3 xl:grid-cols-[300px_minmax(0,1fr)_340px]">
            <Card className="bg-card/90 shadow-md backdrop-blur-sm xl:flex xl:min-h-0 xl:flex-col">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PanelLeft className="size-4" />
                  板块
                </CardTitle>
                <CardDescription>首页保留板块导航，详情页也可直接切回 Feed</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 overflow-visible xl:min-h-0 xl:flex-1 xl:overflow-y-auto">
                {sections.map((section) => {
                  const isActive = section.id === activeSectionId
                  return (
                    <button
                      key={section.id}
                      type="button"
                      onClick={() => handleChangeSection(section.id)}
                      className={`w-full rounded-xl border p-3 text-left transition ${
                        isActive
                          ? "border-primary/70 bg-primary/15"
                          : "border-border/80 hover:bg-muted/70"
                      }`}
                    >
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <span className="font-medium">{section.name}</span>
                        <Badge variant={isActive ? "default" : "secondary"}>
                          {section.threadCount}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{section.description}</p>
                    </button>
                  )
                })}
              </CardContent>
            </Card>

            {route.kind === "feed" ? (
              <Card className="bg-card/90 shadow-md backdrop-blur-sm lg:flex lg:h-full lg:min-h-0 lg:flex-col">
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <MessageSquare className="size-4" />
                        {activeSection?.name ?? "帖子 Feed"}
                      </CardTitle>
                      <CardDescription>
                        首页仅展示标题、摘要和元信息，点击后才进入详情加载正文
                      </CardDescription>
                    </div>
                    {canWriteForum ? (
                      <Button size="sm" onClick={() => setShowNewThreadForm((prev) => !prev)}>
                        <Plus className="mr-1 size-4" />
                        新建帖子
                      </Button>
                    ) : (
                      <Badge variant="outline">只读模式</Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 overflow-visible lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
                  <div className="grid gap-2 rounded-xl border border-border/80 bg-muted/35 p-3 md:grid-cols-[minmax(0,1fr)_160px_auto]">
                    <Input
                      value={feedSearchInput}
                      placeholder="搜索标题、摘要、标签或作者"
                      onChange={(event) => setFeedSearchInput(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          submitFeedSearch()
                        }
                      }}
                    />
                    <select
                      className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                      value={feedSort}
                      onChange={(event) => handleChangeSort(event.target.value as ThreadSort)}
                    >
                      <option value="latest">最新优先</option>
                      <option value="most_replies">回复最多</option>
                      <option value="oldest">最早优先</option>
                    </select>
                    <Button variant="outline" onClick={submitFeedSearch}>
                      搜索
                    </Button>
                  </div>

                  {showNewThreadForm && canWriteForum && (
                    <div className="rounded-xl border border-border/80 bg-muted/45 p-3">
                      <div className="grid gap-2 md:grid-cols-2">
                        <label className="text-xs text-muted-foreground">
                          板块
                          <select
                            className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                            value={newThreadSectionId}
                            disabled={isCreatingThread}
                            onChange={(event) => setNewThreadSectionId(event.target.value)}
                          >
                            {sections.map((section) => (
                              <option key={section.id} value={section.id}>
                                {section.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="text-xs text-muted-foreground">
                          标签（逗号分隔）
                          <Input
                            placeholder="MVP, 讨论"
                            value={newThreadTags}
                            disabled={isCreatingThread}
                            onChange={(event) => setNewThreadTags(event.target.value)}
                          />
                        </label>
                      </div>
                      <div className="mt-2 grid gap-2">
                        <Input
                          placeholder="帖子标题（最多120字）"
                          value={newThreadTitle}
                          disabled={isCreatingThread}
                          onChange={(event) => setNewThreadTitle(event.target.value)}
                        />
                        <Textarea
                          placeholder="帖子正文（最多2000字）"
                          value={newThreadContent}
                          disabled={isCreatingThread}
                          onChange={(event) => setNewThreadContent(event.target.value)}
                        />
                      </div>
                      {newThreadError && (
                        <p className="mt-2 text-xs text-destructive">{newThreadError}</p>
                      )}
                      <div className="mt-2 flex gap-2">
                        <Button size="sm" disabled={isCreatingThread} onClick={createThread}>
                          {isCreatingThread ? "发布中..." : "发布帖子"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isCreatingThread}
                          onClick={() => {
                            setShowNewThreadForm(false)
                            setNewThreadError("")
                          }}
                        >
                          取消
                        </Button>
                      </div>
                    </div>
                  )}

                  {visibleFeedStatus === "loading" && (
                    <div className="flex h-full min-h-[220px] items-center justify-center text-sm text-muted-foreground">
                      <LoaderCircle className="mr-2 size-4 animate-spin" />
                      正在加载当前板块 Feed...
                    </div>
                  )}

                  {visibleFeedStatus === "error" && (
                    <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-left">
                      <p className="font-medium text-destructive">帖子 Feed 加载失败</p>
                      <p className="mt-1 text-sm text-muted-foreground">{feedError}</p>
                      <Button className="mt-3" variant="outline" onClick={retryFeed}>
                        <RefreshCw className="mr-2 size-4" />
                        重试
                      </Button>
                    </div>
                  )}

                  {visibleFeedStatus === "ready" && threadSummaries.length === 0 && (
                    <div className="rounded-xl border border-dashed border-border/80 bg-muted/35 p-6 text-center text-sm text-muted-foreground">
                      {canWriteForum ? "当前板块还没有帖子，可以先发一条。" : "当前板块还没有帖子。"}
                    </div>
                  )}

                  {visibleFeedStatus === "ready" && activeFeed && (
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span>
                        共 {activeFeed.total} 条，当前第 {activeFeed.page} /{" "}
                        {Math.max(1, Math.ceil(activeFeed.total / activeFeed.pageSize))} 页
                      </span>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={activeFeed.page <= 1}
                          onClick={() => handleChangeFeedPage(activeFeed.page - 1)}
                        >
                          上一页
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!activeFeed.hasMore}
                          onClick={() => handleChangeFeedPage(activeFeed.page + 1)}
                        >
                          下一页
                        </Button>
                      </div>
                    </div>
                  )}

                  {visibleFeedStatus === "ready" &&
                    threadSummaries.map((thread) => (
                      <button
                        key={thread.id}
                        type="button"
                        onClick={() => navigateToThread(thread.id)}
                        className="w-full rounded-xl border border-border/80 p-4 text-left transition hover:-translate-y-0.5 hover:bg-muted/70"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-base font-semibold">{thread.title}</p>
                          {thread.isPinned && <Badge variant="secondary">置顶</Badge>}
                          {thread.isLocked && <Badge variant="outline">已锁帖</Badge>}
                          {thread.reviewStatus !== "approved" && (
                            <Badge variant="outline">{getReviewStatusLabel(thread.reviewStatus)}</Badge>
                          )}
                          <Badge variant="outline">{thread.replyCount} 条回复</Badge>
                        </div>
                        <p className="mt-2 text-sm leading-6 text-muted-foreground">
                          {thread.summary}
                        </p>
                        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <RoleBadge role={thread.authorRole} />
                          <span>{thread.author}</span>
                          <span>· {thread.createdAt}</span>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-1">
                          {thread.tags.map((tag) => (
                            <Badge key={`${thread.id}-${tag}`} variant="outline">
                              #{tag}
                            </Badge>
                          ))}
                        </div>
                      </button>
                    ))}
                </CardContent>
              </Card>
            ) : route.kind === "monitoring" ? (
              <MonitoringPage
                orchestrator={orchestrator}
                openclawBridge={openclawBridge}
                profiles={observerProfiles}
                status={observerStatus}
                error={observerError}
                selectedInstanceId={monitoringInstanceId}
                canManage={canManageForum}
                actionStatus={observerActionStatus}
                actionError={observerActionError}
                onSelectInstance={navigateToMonitoring}
                onAction={handleObserverAction}
                onOpenThread={navigateToThread}
                onBackToFeed={() => navigateToFeed(activeSectionId)}
              />
            ) : (
              <Card className="bg-card/90 shadow-md backdrop-blur-sm xl:flex xl:h-full xl:min-h-0 xl:flex-col">
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="-ml-2"
                        onClick={() => navigateToFeed(selectedThread?.sectionId ?? activeSectionId)}
                      >
                        <ArrowLeft className="size-4" />
                        返回 Feed
                      </Button>
                      <CardTitle>{selectedThread?.title ?? "帖子详情"}</CardTitle>
                      <CardDescription>
                        {selectedThread
                          ? "正文和楼层在进入详情后才加载。"
                          : visibleDetailStatus === "loading"
                            ? "正在从 API 拉取帖子正文和楼层。"
                            : detailError || "请选择帖子。"}
                      </CardDescription>
                    </div>

                    {selectedThread && (
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <RoleBadge role={selectedThread.authorRole} />
                        <span>{selectedThread.author}</span>
                        <span>· {selectedThread.createdAt}</span>
                        {selectedThread.isPinned && <Badge variant="secondary">置顶</Badge>}
                        {selectedThread.isLocked && <Badge variant="outline">已锁帖</Badge>}
                        <Badge variant="outline">
                          {getReviewStatusLabel(selectedThread.reviewStatus)}
                        </Badge>
                        {selectedThread.isDeleted && <Badge variant="destructive">已删除</Badge>}
                        <Badge variant="outline">{toThreadSummary(selectedThread).replyCount} 条回复</Badge>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 overflow-visible lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
                  {visibleDetailStatus === "loading" && (
                    <div className="flex h-full min-h-[260px] items-center justify-center text-sm text-muted-foreground">
                      <LoaderCircle className="mr-2 size-4 animate-spin" />
                      正在加载帖子详情...
                    </div>
                  )}

                  {visibleDetailStatus === "error" && (
                    <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-left">
                      <p className="font-medium text-destructive">帖子详情加载失败</p>
                      <p className="mt-1 text-sm text-muted-foreground">{detailError}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button variant="outline" onClick={retryThread}>
                          <RefreshCw className="mr-2 size-4" />
                          重试详情加载
                        </Button>
                        <Button variant="secondary" onClick={() => navigateToFeed(activeSectionId)}>
                          返回 Feed
                        </Button>
                      </div>
                    </div>
                  )}

                  {visibleDetailStatus === "ready" && selectedThread && (
                    <>
                      {canManageForum && (
                        <div className="rounded-xl border border-border/80 bg-muted/35 p-3">
                          <div className="flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={isManagingThread}
                              onClick={() =>
                                handleThreadAction(selectedThread.isPinned ? "unpin" : "pin")
                              }
                            >
                              {selectedThread.isPinned ? "取消置顶" : "置顶"}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={isManagingThread || selectedThread.isDeleted}
                              onClick={() =>
                                handleThreadAction(selectedThread.isLocked ? "unlock" : "lock")
                              }
                            >
                              {selectedThread.isLocked ? "解锁帖子" : "锁帖"}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={isManagingThread}
                              onClick={() =>
                                handleThreadAction(selectedThread.isDeleted ? "restore" : "delete")
                              }
                            >
                              {selectedThread.isDeleted ? "恢复帖子" : "删除帖子"}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={isManagingThread || selectedThread.isDeleted}
                              onClick={() => handleThreadAction("approve")}
                            >
                              审核通过
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={isManagingThread || selectedThread.isDeleted}
                              onClick={() => handleThreadAction("reject")}
                            >
                              审核驳回
                            </Button>
                          </div>
                          {threadActionError && (
                            <p className="mt-2 text-xs text-destructive">{threadActionError}</p>
                          )}
                        </div>
                      )}

                      <div className="flex flex-wrap gap-2">
                        {canReplyToThread && (
                          <Button variant="secondary" onClick={runMockRound}>
                            <Sparkles className="mr-2 size-4" />
                            模拟 A/B/C 讨论
                          </Button>
                        )}
                        {selectedThread.tags.map((tag) => (
                          <Badge key={`${selectedThread.id}-${tag}`} variant="outline">
                            #{tag}
                          </Badge>
                        ))}
                      </div>

                      <Separator />

                      <div className="space-y-3">
                        {selectedThread.isDeleted && (
                          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-muted-foreground">
                            该帖子已被删除，当前详情页保留给管理员执行恢复或审计。
                          </div>
                        )}
                        {selectedThread.floors.length === 0 && !selectedThread.isDeleted && (
                          <div className="rounded-xl border border-dashed border-border/80 bg-muted/35 p-4 text-sm text-muted-foreground">
                            当前帖子还没有楼层内容。
                          </div>
                        )}
                        {selectedThread.floors.map((floor, index) => (
                          <article
                            key={floor.id}
                            className="rounded-xl border border-border/80 bg-card/80 p-3"
                          >
                            <div className="mb-1 flex items-center justify-between gap-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="font-medium">
                                  {index + 1}F · {floor.author}
                                </p>
                                <RoleBadge role={floor.authorRole} />
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {floor.createdAt}
                              </span>
                            </div>
                            <p className="text-sm leading-6">{floor.content}</p>
                            {canReplyToThread && (
                              <div className="mt-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setReplyToFloor(floor.id, floor.author)}
                                >
                                  回复
                                </Button>
                              </div>
                            )}

                            {floor.children.map((reply) => (
                              <div
                                key={reply.id}
                                className="mt-3 rounded-lg border border-border/80 bg-muted/65 p-3"
                              >
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="text-xs font-semibold">回复 · {reply.author}</p>
                                  <RoleBadge role={reply.authorRole} />
                                  <span className="text-xs text-muted-foreground">
                                    {reply.createdAt}
                                  </span>
                                </div>
                                <p className="mt-1 text-sm">{reply.content}</p>
                                {canReplyToThread && (
                                  <div className="mt-2">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() =>
                                        setReplyToReply(floor.id, reply.id, reply.author)
                                      }
                                    >
                                      回复
                                    </Button>
                                  </div>
                                )}

                                {reply.children.map((nested) => (
                                  <div
                                    key={nested.id}
                                    className="mt-2 rounded-lg border border-border/80 bg-background/85 p-2"
                                  >
                                    <div className="flex flex-wrap items-center gap-2">
                                      <p className="text-xs font-semibold">
                                        回复的回复 · {nested.author}
                                      </p>
                                      <RoleBadge role={nested.authorRole} />
                                    </div>
                                    <p className="text-sm">{nested.content}</p>
                                  </div>
                                ))}
                              </div>
                            ))}
                          </article>
                        ))}
                      </div>

                      <Separator />

                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium">发布回复</p>
                          {replyTarget && canReplyToThread && (
                            <Button size="sm" variant="outline" onClick={cancelReplyTarget}>
                              取消定向回复
                            </Button>
                          )}
                        </div>
                        {replyTarget && canReplyToThread && (
                          <p className="text-xs text-muted-foreground">
                            正在回复 <span className="font-medium">{replyTarget.author}</span>
                            {replyTarget.replyId ? "（二级回复）" : "（楼层回复）"}
                          </p>
                        )}
                        {canReplyToThread ? (
                          <>
                            <Textarea
                              value={replyContent}
                              placeholder={replyTarget ? "输入回复内容..." : "输入楼层内容..."}
                              disabled={isSubmittingReply}
                              onChange={(event) => setReplyContent(event.target.value)}
                            />
                            {replyError && <p className="text-xs text-destructive">{replyError}</p>}
                            <Button disabled={isSubmittingReply} onClick={submitReply}>
                              {isSubmittingReply ? "发布中..." : "发布回复"}
                            </Button>
                          </>
                        ) : (
                          <div className="rounded-lg border border-border/80 bg-muted/50 p-3 text-sm text-muted-foreground">
                            {selectedThread.isDeleted
                              ? "该帖子已删除，不能继续回复。"
                              : selectedThread.isLocked
                                ? "该帖子已锁帖，暂不允许继续回复。"
                                : "当前账号为观察者，只能阅读和查看审计，不能发帖或回复。"}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            )}

            <div className="hidden xl:block xl:min-h-0">
              <QuickPreviewSidebar
                activeInstanceId={monitoringInstanceId}
                orchestrator={orchestrator}
                openclawBridge={openclawBridge}
                status={observerStatus}
                error={observerError}
                onSelectInstance={navigateToMonitoring}
                onOpenMonitoring={navigateToMonitoring}
              />
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}

export default App
