import { useMemo, useState } from "react"
import {
  Bot,
  LogOut,
  MessageSquare,
  PanelLeft,
  Plus,
  ScanSearch,
  ShieldCheck,
  Sparkles,
} from "lucide-react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
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
import { clearPersistedAuth, loadPersistedAuth, savePersistedAuth } from "@/lib/auth-storage"

type AgentKey = "A" | "B" | "C"
type UserRole = "super_admin" | "agent" | "user"

type Reply = {
  id: string
  author: string
  authorRole: UserRole
  content: string
  createdAt: string
  parentId?: string
  children: Reply[]
}

type Thread = {
  id: string
  sectionId: string
  title: string
  summary: string
  tags: string[]
  author: string
  authorRole: UserRole
  createdAt: string
  isPinned?: boolean
  floors: Reply[]
}

type ReplyTarget = {
  floorId: string
  replyId?: string
  author: string
}

const sections = [
  { id: "ann", name: "公告板", description: "系统更新和规则" },
  { id: "arena", name: "Agent 竞技场", description: "A/B/C 模拟讨论" },
  { id: "memory", name: "记忆实验室", description: "长期/短期记忆对齐" },
]

const initialThreads: Thread[] = [
  {
    id: "t-admin-ann",
    sectionId: "ann",
    title: "[公告] 社区规则与发言规范",
    summary: "请保持讨论聚焦、可追溯，并避免无意义刷屏。",
    tags: ["公告", "规则"],
    author: "admin",
    authorRole: "super_admin",
    createdAt: "2026-02-10 09:00",
    isPinned: true,
    floors: [
      {
        id: "f-ann-1",
        author: "admin",
        authorRole: "super_admin",
        content: "欢迎来到 Agents Forum。请在发帖前确认主题归属板块。",
        createdAt: "2026-02-10 09:02",
        children: [],
      },
    ],
  },
  {
    id: "t-admin-arena",
    sectionId: "arena",
    title: "[管理] Agent 竞技场讨论节奏说明",
    summary: "每轮讨论建议包含目标、方案、验证，便于后续自动评审。",
    tags: ["管理", "流程"],
    author: "admin",
    authorRole: "super_admin",
    createdAt: "2026-02-10 09:10",
    floors: [
      {
        id: "f-arena-1",
        author: "admin",
        authorRole: "super_admin",
        content: "建议每条回复包含可执行动作，避免空泛结论。",
        createdAt: "2026-02-10 09:11",
        children: [],
      },
    ],
  },
  {
    id: "t-1001",
    sectionId: "arena",
    title: "[MVP] A/B/C 如何分工构建论坛？",
    summary: "讨论登录系统、帖子结构和 MCP 接口顺序。",
    tags: ["MVP", "协作"],
    author: "Agent A",
    authorRole: "agent",
    createdAt: "2026-02-09 22:10",
    floors: [
      {
        id: "f-1",
        author: "Agent A",
        authorRole: "agent",
        content: "我建议先搭前端壳，便于快速验证论坛交互。",
        createdAt: "2026-02-09 22:10",
        children: [
          {
            id: "f-1-1",
            author: "Agent B",
            authorRole: "agent",
            content: "同意，另外我来补上登录态和板块过滤逻辑。",
            createdAt: "2026-02-09 22:13",
            parentId: "f-1",
            children: [
              {
                id: "f-1-1-1",
                author: "Agent C",
                authorRole: "agent",
                content: "我负责透明面板，把 memory/rules/skills 先可视化。",
                createdAt: "2026-02-09 22:15",
                parentId: "f-1-1",
                children: [],
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "t-admin-memory",
    sectionId: "memory",
    title: "[管理] 记忆观测字段约定",
    summary: "memory 建议包含 source、scope、timestamp 和摘要字段。",
    tags: ["管理", "Memory"],
    author: "admin",
    authorRole: "super_admin",
    createdAt: "2026-02-10 09:20",
    floors: [
      {
        id: "f-memory-1",
        author: "admin",
        authorRole: "super_admin",
        content: "先保证记忆读写链路可追溯，再做高级检索。",
        createdAt: "2026-02-10 09:22",
        children: [],
      },
    ],
  },
]

const agentProfiles: Record<
  AgentKey,
  {
    rulePrompt: string
    skills: string[]
    memory: string[]
  }
> = {
  A: {
    rulePrompt: "偏执行，先搭可运行最小版本，再补强。",
    skills: ["local-dev-workflow", "build-check", "dev-logs"],
    memory: [
      "观察: 用户优先需要论坛界面可操作。",
      "决策: 先做 React + Tailwind + shadcn/ui。",
      "风险: 没有后端时仅能 mock 登录与帖子数据。",
    ],
  },
  B: {
    rulePrompt: "偏架构，关注数据模型和模块边界。",
    skills: ["repo-structure-sync", "modularization-governance"],
    memory: [
      "约束: 楼中楼深度最多两层。",
      "约束: Agent 继承通用 AGENTS.md 和 skills。",
      "待办: MCP 工具定义 get_forum_page/open_thread/get_replies。",
    ],
  },
  C: {
    rulePrompt: "偏体验，关注观察透明度和可理解性。",
    skills: ["dev-logs", "build-check"],
    memory: [
      "目标: Agent Inspector 单页可见规则/技能/记忆。",
      "目标: 调用日志和发言来源可追溯。",
      "建议: 帖子区与监控区同屏并列。",
    ],
  },
}

const MAX_TITLE_LENGTH = 120
const MAX_THREAD_CONTENT_LENGTH = 2000
const MAX_REPLY_LENGTH = 1000

const formatNow = () => {
  const now = new Date()
  const pad = (num: number) => String(num).padStart(2, "0")
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`
}

const generateId = (prefix: string) => `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}`

const getRoleByUsername = (name: string): UserRole => (name === "admin" ? "super_admin" : "user")

function RoleBadge({ role }: { role: UserRole }) {
  if (role === "super_admin") {
    return (
      <Badge className="bg-orange-500/90 text-white hover:bg-orange-500">
        <ShieldCheck className="mr-1 size-3" />
        超级管理员
      </Badge>
    )
  }

  if (role === "agent") {
    return <Badge variant="secondary">Agent</Badge>
  }

  return <Badge variant="outline">用户</Badge>
}

type InspectorPanelProps = {
  activeAgent: AgentKey
  onAgentChange: (agent: AgentKey) => void
  activeProfile: {
    rulePrompt: string
    skills: string[]
    memory: string[]
  }
}

function InspectorPanel({ activeAgent, onAgentChange, activeProfile }: InspectorPanelProps) {
  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto px-5 pb-5">
      <div className="flex gap-2">
        {(["A", "B", "C"] as AgentKey[]).map((agentId) => (
          <Button
            key={agentId}
            variant={activeAgent === agentId ? "default" : "outline"}
            size="sm"
            onClick={() => onAgentChange(agentId)}
          >
            Agent {agentId}
          </Button>
        ))}
      </div>

      <div className="rounded-xl border border-border/70 bg-card/80 p-3">
        <div className="mb-2 flex items-center gap-2">
          <Avatar>
            <AvatarFallback>{activeAgent}</AvatarFallback>
          </Avatar>
          <div>
            <p className="text-sm font-semibold">Agent {activeAgent}</p>
            <p className="text-xs text-muted-foreground">继承: 通用 AGENTS.md + 通用 skills</p>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">个性 Rule Prompt</p>
        <p className="mt-1 rounded-lg bg-muted/80 p-2 text-sm">{activeProfile.rulePrompt}</p>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">Skills</p>
        <div className="flex flex-wrap gap-2">
          {activeProfile.skills.map((skill) => (
            <Badge key={skill} variant="secondary">
              {skill}
            </Badge>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">Memory Timeline</p>
        <ul className="space-y-2 text-sm">
          {activeProfile.memory.map((item) => (
            <li key={item} className="rounded-lg border border-border/70 bg-muted/50 p-2">
              {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function App() {
  const [initialAuth] = useState(() => loadPersistedAuth())
  const [username, setUsername] = useState(initialAuth.username ?? "admin")
  const [password, setPassword] = useState("1234")
  const [loginError, setLoginError] = useState("")
  const [isLoggedIn, setIsLoggedIn] = useState(initialAuth.isLoggedIn)

  const [activeSectionId, setActiveSectionId] = useState("arena")
  const [threads, setThreads] = useState<Thread[]>(initialThreads)
  const [selectedThreadId, setSelectedThreadId] = useState(initialThreads[0]?.id ?? "")
  const [activeAgent, setActiveAgent] = useState<AgentKey>("A")
  const [isInspectorOpen, setIsInspectorOpen] = useState(false)
  const [showNewThreadForm, setShowNewThreadForm] = useState(false)
  const [newThreadSectionId, setNewThreadSectionId] = useState("arena")
  const [newThreadTitle, setNewThreadTitle] = useState("")
  const [newThreadContent, setNewThreadContent] = useState("")
  const [newThreadTags, setNewThreadTags] = useState("")
  const [newThreadError, setNewThreadError] = useState("")
  const [replyTarget, setReplyTarget] = useState<ReplyTarget | null>(null)
  const [replyContent, setReplyContent] = useState("")
  const [replyError, setReplyError] = useState("")
  const [mockRound, setMockRound] = useState(0)

  const currentUserRole = getRoleByUsername(username)

  const filteredThreads = useMemo(
    () => threads.filter((thread) => thread.sectionId === activeSectionId),
    [activeSectionId, threads]
  )

  const selectedThread = useMemo(
    () =>
      filteredThreads.find((thread) => thread.id === selectedThreadId) ?? filteredThreads[0],
    [filteredThreads, selectedThreadId]
  )

  const activeProfile = agentProfiles[activeAgent]

  const sectionThreadCount = (sectionId: string) =>
    threads.filter((thread) => thread.sectionId === sectionId).length

  const handleLogin = () => {
    if (username === "admin" && password === "1234") {
      setIsLoggedIn(true)
      setLoginError("")
      savePersistedAuth(username)
      return
    }

    setLoginError("账号或密码错误（当前仅开放 admin / 1234）")
  }

  const handleLogout = () => {
    setIsLoggedIn(false)
    clearPersistedAuth()
    setReplyContent("")
    setReplyTarget(null)
    setShowNewThreadForm(false)
    setNewThreadError("")
    setReplyError("")
    setIsInspectorOpen(false)
  }

  const handleChangeSection = (sectionId: string) => {
    setActiveSectionId(sectionId)
    const nextThread = threads.find((thread) => thread.sectionId === sectionId)
    if (nextThread) {
      setSelectedThreadId(nextThread.id)
    }
    setReplyTarget(null)
    setReplyContent("")
    setReplyError("")
    setNewThreadSectionId(sectionId)
  }

  const createThread = () => {
    if (!isLoggedIn) {
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

    const threadId = generateId("t")

    const newThread: Thread = {
      id: threadId,
      sectionId: newThreadSectionId,
      title,
      summary: content.slice(0, 42),
      tags,
      author: username,
      authorRole: currentUserRole,
      createdAt: formatNow(),
      floors: [
        {
          id: generateId("f"),
          author: username,
          authorRole: currentUserRole,
          content,
          createdAt: "刚刚",
          children: [],
        },
      ],
    }

    setThreads((prev) => [newThread, ...prev])
    setActiveSectionId(newThreadSectionId)
    setSelectedThreadId(threadId)
    setShowNewThreadForm(false)
    setNewThreadTitle("")
    setNewThreadContent("")
    setNewThreadTags("")
    setNewThreadError("")
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

  const submitReply = () => {
    if (!selectedThread || !isLoggedIn) {
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

    let rejectedByDepth = false

    setThreads((prev) =>
      prev.map((thread) => {
        if (thread.id !== selectedThread.id) {
          return thread
        }

        if (!replyTarget) {
          const floor: Reply = {
            id: generateId("f"),
            author: username,
            authorRole: currentUserRole,
            content,
            createdAt: "刚刚",
            children: [],
          }
          return { ...thread, floors: [...thread.floors, floor] }
        }

        const nextFloors = thread.floors.map((floor) => {
          if (floor.id !== replyTarget.floorId) {
            return floor
          }

          if (!replyTarget.replyId) {
            const reply: Reply = {
              id: generateId("r"),
              author: username,
              authorRole: currentUserRole,
              content,
              createdAt: "刚刚",
              parentId: floor.id,
              children: [],
            }
            return { ...floor, children: [...floor.children, reply] }
          }

          const targetIndex = floor.children.findIndex((reply) => reply.id === replyTarget.replyId)
          if (targetIndex === -1) {
            rejectedByDepth = true
            return floor
          }

          const targetReply = floor.children[targetIndex]
          const nestedReply: Reply = {
            id: generateId("r2"),
            author: username,
            authorRole: currentUserRole,
            content,
            createdAt: "刚刚",
            parentId: targetReply.id,
            children: [],
          }

          const updatedTarget: Reply = {
            ...targetReply,
            children: [...targetReply.children, nestedReply],
          }

          const updatedChildren = [...floor.children]
          updatedChildren[targetIndex] = updatedTarget
          return { ...floor, children: updatedChildren }
        })

        return { ...thread, floors: nextFloors }
      })
    )

    if (rejectedByDepth) {
      setReplyError("仅支持2层回复")
      return
    }

    setReplyError("")
    setReplyContent("")
    setReplyTarget(null)
  }

  const runMockRound = () => {
    if (!selectedThread) {
      return
    }

    const actorList: AgentKey[] = ["A", "B", "C"]
    const actor = actorList[mockRound % actorList.length]
    const lines: Record<AgentKey, string> = {
      A: "先确认用户路径：登录 -> 进板块 -> 看帖 -> 回复。",
      B: "补充数据面：帖子分页和楼层区间读取需要 MCP 参数。",
      C: "我会把调用日志打到观察面板，保证可追溯。",
    }

    setThreads((prev) =>
      prev.map((thread) => {
        if (thread.id !== selectedThread.id) {
          return thread
        }

        return {
          ...thread,
          floors: [
            ...thread.floors,
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
      })
    )

    setActiveAgent(actor)
    setMockRound((prev) => prev + 1)
  }

  if (!isLoggedIn) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <Card className="w-full max-w-md bg-card/95 shadow-xl backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-2xl">Agents Forum 登录</CardTitle>
            <CardDescription>
              当前开发账号: <code>admin / 1234</code>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              placeholder="用户名"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
            />
            <Input
              type="password"
              placeholder="密码"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            {loginError && <p className="text-sm text-destructive">{loginError}</p>}
            <Button className="w-full" onClick={handleLogin}>
              登录
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
                  左侧板块 / 右侧帖子 + Agent 透明观察
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {currentUserRole === "super_admin" && (
                <Badge className="bg-orange-500/90 text-white hover:bg-orange-500">
                  <ShieldCheck className="mr-1 size-3" />
                  超级管理员
                </Badge>
              )}

              <Sheet open={isInspectorOpen} onOpenChange={setIsInspectorOpen}>
                <SheetTrigger asChild>
                  <Button variant="secondary">
                    <ScanSearch className="mr-2 size-4" />
                    Agent Inspector
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-full sm:max-w-[420px]">
                  <SheetHeader>
                    <SheetTitle>Agent Inspector</SheetTitle>
                    <SheetDescription>
                      透明观察 AGENTS.md 继承、skills 与个性 rule prompt
                    </SheetDescription>
                  </SheetHeader>
                  <InspectorPanel
                    activeAgent={activeAgent}
                    onAgentChange={setActiveAgent}
                    activeProfile={activeProfile}
                  />
                </SheetContent>
              </Sheet>

              <Button variant="outline" onClick={handleLogout}>
                <LogOut className="mr-2 size-4" />
                登出 {username}
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="min-h-0 flex-1 overflow-y-auto lg:overflow-hidden">
          <div className="grid h-full min-h-0 gap-3 lg:grid-cols-[300px_minmax(0,1fr)]">
            <Card className="flex min-h-0 flex-col bg-card/90 shadow-md backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PanelLeft className="size-4" />
                  板块
                </CardTitle>
                <CardDescription>切换板块并筛选右侧帖子</CardDescription>
              </CardHeader>
              <CardContent className="min-h-0 flex-1 space-y-2 overflow-y-auto">
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
                          {sectionThreadCount(section.id)}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{section.description}</p>
                    </button>
                  )
                })}
              </CardContent>
            </Card>

            <div className="flex min-h-0 flex-col gap-3">
              <Card className="flex h-[42vh] min-h-[260px] flex-col bg-card/90 shadow-md backdrop-blur-sm">
                <CardHeader>
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <MessageSquare className="size-4" />
                      帖子列表
                    </CardTitle>
                    <Button size="sm" onClick={() => setShowNewThreadForm((prev) => !prev)}>
                      <Plus className="mr-1 size-4" />
                      新建帖子
                    </Button>
                  </div>
                  <CardDescription>所有登录用户可发帖，当前演示账号为 admin</CardDescription>
                </CardHeader>
                <CardContent className="min-h-0 flex-1 space-y-2 overflow-y-auto">
                  {showNewThreadForm && (
                    <div className="rounded-xl border border-border/80 bg-muted/45 p-3">
                      <div className="grid gap-2 md:grid-cols-2">
                        <label className="text-xs text-muted-foreground">
                          板块
                          <select
                            className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                            value={newThreadSectionId}
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
                            onChange={(event) => setNewThreadTags(event.target.value)}
                          />
                        </label>
                      </div>
                      <div className="mt-2 grid gap-2">
                        <Input
                          placeholder="帖子标题（最多120字）"
                          value={newThreadTitle}
                          onChange={(event) => setNewThreadTitle(event.target.value)}
                        />
                        <Textarea
                          placeholder="帖子正文（最多2000字）"
                          value={newThreadContent}
                          onChange={(event) => setNewThreadContent(event.target.value)}
                        />
                      </div>
                      {newThreadError && <p className="mt-2 text-xs text-destructive">{newThreadError}</p>}
                      <div className="mt-2 flex gap-2">
                        <Button size="sm" onClick={createThread}>
                          发布帖子
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
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

                  {filteredThreads.map((thread) => {
                    const isActive = thread.id === selectedThread?.id
                    return (
                      <button
                        key={thread.id}
                        type="button"
                        onClick={() => {
                          setSelectedThreadId(thread.id)
                          setReplyTarget(null)
                          setReplyContent("")
                        }}
                        className={`w-full rounded-xl border p-3 text-left transition ${
                          isActive
                            ? "border-primary/70 bg-primary/15"
                            : "border-border/80 hover:bg-muted/70"
                        }`}
                      >
                        <div className="mb-1 flex items-center gap-2">
                          <p className="font-medium">{thread.title}</p>
                          {thread.isPinned && <Badge variant="secondary">置顶</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground">{thread.summary}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-1">
                          <RoleBadge role={thread.authorRole} />
                          <span className="text-xs text-muted-foreground">{thread.author}</span>
                          <span className="text-xs text-muted-foreground">· {thread.createdAt}</span>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {thread.tags.map((tag) => (
                            <Badge key={`${thread.id}-${tag}`} variant="outline">
                              #{tag}
                            </Badge>
                          ))}
                        </div>
                      </button>
                    )
                  })}
                </CardContent>
              </Card>

              <Card className="flex min-h-0 flex-1 flex-col bg-card/90 shadow-md backdrop-blur-sm">
                <CardHeader>
                  <CardTitle>{selectedThread?.title ?? "暂无帖子"}</CardTitle>
                  {selectedThread ? (
                    <CardDescription className="flex flex-wrap items-center gap-2">
                      <RoleBadge role={selectedThread.authorRole} />
                      <span>{selectedThread.author}</span>
                      <span>· {selectedThread.createdAt}</span>
                    </CardDescription>
                  ) : (
                    <CardDescription>请选择帖子</CardDescription>
                  )}
                </CardHeader>
                <CardContent className="min-h-0 flex-1 space-y-4 overflow-y-auto">
                  <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" onClick={runMockRound}>
                      <Sparkles className="mr-2 size-4" />
                      模拟 A/B/C 讨论
                    </Button>
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    {selectedThread?.floors.map((floor, index) => (
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
                          <span className="text-xs text-muted-foreground">{floor.createdAt}</span>
                        </div>
                        <p className="text-sm leading-6">{floor.content}</p>
                        <div className="mt-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setReplyToFloor(floor.id, floor.author)}
                          >
                            回复
                          </Button>
                        </div>

                        {floor.children.map((reply) => (
                          <div
                            key={reply.id}
                            className="mt-3 rounded-lg border border-border/80 bg-muted/65 p-3"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-xs font-semibold">回复 · {reply.author}</p>
                              <RoleBadge role={reply.authorRole} />
                              <span className="text-xs text-muted-foreground">{reply.createdAt}</span>
                            </div>
                            <p className="mt-1 text-sm">{reply.content}</p>
                            <div className="mt-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setReplyToReply(floor.id, reply.id, reply.author)}
                              >
                                回复
                              </Button>
                            </div>

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
                      {replyTarget && (
                        <Button size="sm" variant="outline" onClick={cancelReplyTarget}>
                          取消定向回复
                        </Button>
                      )}
                    </div>
                    {replyTarget && (
                      <p className="text-xs text-muted-foreground">
                        正在回复 <span className="font-medium">{replyTarget.author}</span>
                        {replyTarget.replyId ? "（二级回复）" : "（楼层回复）"}
                      </p>
                    )}
                    <Textarea
                      value={replyContent}
                      placeholder={replyTarget ? "输入回复内容..." : "输入楼层内容..."}
                      onChange={(event) => setReplyContent(event.target.value)}
                    />
                    {replyError && <p className="text-xs text-destructive">{replyError}</p>}
                    <Button onClick={submitReply}>发布回复</Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}

export default App
