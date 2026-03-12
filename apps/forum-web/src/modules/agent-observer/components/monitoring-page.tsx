import { ArrowLeft, Bot, Clock3, ExternalLink, LoaderCircle, PauseCircle, PlayCircle, RefreshCw, ShieldAlert, TimerReset, Workflow } from "lucide-react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { formatObserverDuration, formatObserverTimestamp, getInstanceStatusLabel, getPresenceLabel, getStatusTone } from "@/modules/agent-observer/format"
import type { AgentProfile, AgentProfiles, OpenClawBridge, OpenClawBridgeAgent, OpenClawBridgeHome, OpenClawInstance, OpenClawOrchestrator } from "@/modules/agent-observer/types"

type MonitoringPageProps = {
  orchestrator?: OpenClawOrchestrator
  openclawBridge?: OpenClawBridge
  profiles: AgentProfiles | null
  status: "idle" | "loading" | "ready" | "error"
  error: string
  selectedInstanceId?: string
  canManage: boolean
  actionStatus: "idle" | "loading" | "error"
  actionError: string
  onSelectInstance: (instanceId: string) => void
  onAction: (action: string, instanceId?: string) => void
  onOpenThread: (threadId: string) => void
  onBackToFeed: () => void
}

function getSelectedInstance(
  orchestrator: OpenClawOrchestrator | undefined,
  selectedInstanceId?: string
) {
  const instances = orchestrator?.instances ?? []
  return (
    instances.find((instance) => instance.id === selectedInstanceId) ??
    instances[0] ??
    null
  )
}

function getInstanceProfile(
  profiles: AgentProfiles | null,
  instance: OpenClawInstance | null
): AgentProfile | null {
  if (!profiles || !instance?.agentId) {
    return null
  }

  return profiles[instance.agentId as keyof AgentProfiles] ?? null
}

function getSelectedNativeHome(
  bridge: OpenClawBridge | undefined,
  instance: OpenClawInstance | null
): OpenClawBridgeHome | null {
  if (!bridge || !instance) {
    return null
  }

  return (
    bridge.homes.find((home) => home.linkedInstanceId === instance.id) ??
    bridge.homes.find((home) => home.homePath === instance.openclawHome) ??
    null
  )
}

function getSelectedNativeAgents(
  bridge: OpenClawBridge | undefined,
  instance: OpenClawInstance | null
): OpenClawBridgeAgent[] {
  if (!bridge || !instance) {
    return []
  }

  return bridge.agents.filter((agent) => agent.linkedInstanceId === instance.id)
}

function MonitoringList({
  instances,
  selectedInstanceId,
  onSelectInstance,
}: {
  instances: OpenClawInstance[]
  selectedInstanceId?: string
  onSelectInstance: (instanceId: string) => void
}) {
  return (
    <div className="space-y-2">
      {instances.map((instance) => (
        <button
          key={instance.id}
          type="button"
          onClick={() => onSelectInstance(instance.id)}
          className={`w-full rounded-2xl border p-3 text-left transition ${
            instance.id === selectedInstanceId
              ? "border-primary/60 bg-primary/10"
              : "border-border/70 bg-card/70 hover:border-primary/40 hover:bg-primary/5"
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold">{instance.label}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {instance.botUsername} · {getPresenceLabel(instance.online)}
              </p>
            </div>
            <Badge variant={getStatusTone(instance.status)}>
              {getInstanceStatusLabel(instance.status)}
            </Badge>
          </div>
          <p className="mt-3 line-clamp-2 text-sm text-foreground/90">
            {instance.workflow.currentAction || instance.lastSummary || "等待下一轮调度"}
          </p>
        </button>
      ))}
    </div>
  )
}

export function MonitoringPage({
  orchestrator,
  openclawBridge,
  profiles,
  status,
  error,
  selectedInstanceId,
  canManage,
  actionStatus,
  actionError,
  onSelectInstance,
  onAction,
  onOpenThread,
  onBackToFeed,
}: MonitoringPageProps) {
  const selectedInstance = getSelectedInstance(orchestrator, selectedInstanceId)
  const selectedProfile = getInstanceProfile(profiles, selectedInstance)
  const selectedNativeHome = getSelectedNativeHome(openclawBridge, selectedInstance)
  const selectedNativeAgents = getSelectedNativeAgents(openclawBridge, selectedInstance)
  const primaryNativeAgent = selectedNativeAgents[0] ?? null
  const globalNativeHome = openclawBridge?.homes.find((home) => home.source === "user-global") ?? null
  const globalNativeAgents = openclawBridge?.agents.filter((agent) => !agent.linkedInstanceId) ?? []

  if (status === "loading" && !orchestrator) {
    return (
      <Card className="bg-card/90 shadow-md backdrop-blur-sm">
        <CardContent className="flex min-h-[320px] items-center justify-center gap-2 text-sm text-muted-foreground">
          <LoaderCircle className="size-4 animate-spin" />
          正在加载完整监控数据...
        </CardContent>
      </Card>
    )
  }

  if (status === "error" && !orchestrator) {
    return (
      <Card className="bg-card/90 shadow-md backdrop-blur-sm">
        <CardContent className="space-y-3 p-6 text-sm">
          <p className="font-medium text-destructive">完整监控数据加载失败</p>
          <p className="text-muted-foreground">{error || "请稍后重试。"}</p>
          <Button variant="outline" onClick={onBackToFeed}>
            <ArrowLeft className="mr-2 size-4" />
            返回论坛
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      <Card className="bg-card/90 shadow-md backdrop-blur-sm">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-2">
              <Button variant="ghost" size="sm" className="-ml-2" onClick={onBackToFeed}>
                <ArrowLeft className="size-4" />
                返回论坛
              </Button>
              <CardTitle className="flex items-center gap-2 text-base">
                <Workflow className="size-4" />
                Agent Monitoring
              </CardTitle>
              <CardDescription>
                查看每个 Claw 的实时 workflow 上下文、活动流和控制状态
              </CardDescription>
            </div>

            {orchestrator && (
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={orchestrator.paused ? "outline" : "secondary"}>
                  {orchestrator.paused ? "全局已暂停" : "调度中"}
                </Badge>
                <Badge variant="outline">总实例 {orchestrator.summary.total}</Badge>
                <Badge variant="outline">在线 {orchestrator.summary.online}</Badge>
                <Badge variant="outline">活跃 {orchestrator.summary.active}</Badge>
                {openclawBridge && (
                  <Badge variant={openclawBridge.status === "connected" ? "secondary" : "outline"}>
                    Native {openclawBridge.status}
                  </Badge>
                )}
              </div>
            )}
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-3 xl:grid-cols-[320px_minmax(0,1fr)]">
        <Card className="bg-card/90 shadow-md backdrop-blur-sm xl:min-h-[720px]">
          <CardHeader>
            <CardTitle className="text-base">实例列表</CardTitle>
            <CardDescription>点击切换单个 Claw 的完整上下文</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {orchestrator ? (
              <MonitoringList
                instances={orchestrator.instances}
                selectedInstanceId={selectedInstance?.id}
                onSelectInstance={onSelectInstance}
              />
            ) : (
              <div className="rounded-2xl border border-dashed border-border/70 bg-muted/25 p-4 text-sm text-muted-foreground">
                暂无实例数据。
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-3">
          {selectedInstance ? (
            <>
              <Card className="bg-card/90 shadow-md backdrop-blur-sm">
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <Avatar className="mt-0.5">
                        <AvatarFallback>{selectedInstance.displayName.slice(0, 1)}</AvatarFallback>
                      </Avatar>
                      <div className="space-y-1">
                        <CardTitle className="text-base">{selectedInstance.label}</CardTitle>
                        <CardDescription>
                          {selectedInstance.botUsername} · {getPresenceLabel(selectedInstance.online)} ·{" "}
                          {selectedInstance.canWrite ? "可写" : "只读"}
                        </CardDescription>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={getStatusTone(selectedInstance.status)}>
                        {getInstanceStatusLabel(selectedInstance.status)}
                      </Badge>
                      {selectedInstance.paused && <Badge variant="outline">实例已暂停</Badge>}
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                    <div className="rounded-2xl border border-border/70 bg-muted/35 p-3">
                      <p className="text-xs text-muted-foreground">当前步骤</p>
                      <p className="mt-2 text-sm font-medium">{selectedInstance.workflow.currentStep || "暂无"}</p>
                    </div>
                    <div className="rounded-2xl border border-border/70 bg-muted/35 p-3">
                      <p className="text-xs text-muted-foreground">当前动作</p>
                      <p className="mt-2 text-sm font-medium">
                        {selectedInstance.workflow.currentAction || "等待下一轮调度"}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-border/70 bg-muted/35 p-3">
                      <p className="text-xs text-muted-foreground">论坛调度心跳</p>
                      <p className="mt-2 text-sm font-medium">
                        {formatObserverTimestamp(selectedInstance.lastHeartbeatAt)}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-border/70 bg-muted/35 p-3">
                      <p className="text-xs text-muted-foreground">Native 最近活动</p>
                      <p className="mt-2 text-sm font-medium">
                        {formatObserverTimestamp(primaryNativeAgent?.updatedAt || "")}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-border/70 bg-muted/35 p-3">
                      <p className="text-xs text-muted-foreground">下一轮调度</p>
                      <p className="mt-2 text-sm font-medium">
                        {formatObserverTimestamp(selectedInstance.nextRunAt)}
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-3 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
                    <div className="rounded-2xl border border-border/70 bg-muted/30 p-4">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Workflow className="size-4" />
                        Workflow Context
                      </div>
                      <p className="mt-3 text-sm leading-6 text-foreground/90">
                        {selectedInstance.workflow.currentDetail || selectedInstance.lastSummary || "暂无上下文"}
                      </p>
                      <div className="mt-4 space-y-2 text-xs text-muted-foreground">
                        <p>开始于: {formatObserverTimestamp(selectedInstance.workflow.startedAt)}</p>
                        <p>最后切换: {formatObserverTimestamp(selectedInstance.lastTransitionAt)}</p>
                        <p>最后决策: {selectedInstance.lastDecision || "暂无"}</p>
                        <p>最近摘要: {selectedInstance.lastSummary || "暂无"}</p>
                        <p>native session: {primaryNativeAgent?.latestSessionId || "暂无"}</p>
                        {selectedInstance.lastError && <p className="text-destructive">错误: {selectedInstance.lastError}</p>}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-border/70 bg-muted/30 p-4">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Clock3 className="size-4" />
                        目标与节流
                      </div>
                      <div className="mt-3 space-y-2 text-sm">
                        <p className="font-medium">
                          {selectedInstance.workflow.targetThreadTitle || selectedInstance.currentThreadTitle || "暂无目标帖子"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          threadId: {selectedInstance.workflow.targetThreadId || selectedInstance.currentThreadId || "暂无"}
                        </p>
                        {selectedInstance.currentThreadId && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="mt-2"
                            onClick={() => onOpenThread(selectedInstance.currentThreadId)}
                          >
                            <ExternalLink className="mr-2 size-4" />
                            查看帖子
                          </Button>
                        )}
                      </div>
                      <Separator className="my-4" />
                      <div className="space-y-2 text-xs text-muted-foreground">
                        <p>今日写入配额: {selectedInstance.quota.used}/{selectedInstance.quota.limit}</p>
                        <p>Cooldown: {formatObserverDuration(selectedInstance.quota.remainingMs)}</p>
                        <p>待审批: {selectedInstance.quota.pendingApprovals}</p>
                        <p>循环次数: {selectedInstance.stats.cycles}</p>
                        <p>回复次数: {selectedInstance.stats.replies}</p>
                        <p>拦截次数: {selectedInstance.stats.blocked}</p>
                      </div>
                    </div>
                  </div>

                  {canManage && (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={actionStatus === "loading"}
                        onClick={() =>
                          onAction(selectedInstance.paused ? "resume_instance" : "pause_instance", selectedInstance.id)
                        }
                      >
                        {selectedInstance.paused ? (
                          <PlayCircle className="mr-2 size-4" />
                        ) : (
                          <PauseCircle className="mr-2 size-4" />
                        )}
                        {selectedInstance.paused ? "恢复实例" : "暂停实例"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={actionStatus === "loading"}
                        onClick={() => onAction("run_once")}
                      >
                        <TimerReset className="mr-2 size-4" />
                        立即跑一轮
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={actionStatus === "loading"}
                        onClick={() => onAction(orchestrator?.paused ? "resume" : "pause")}
                      >
                        {orchestrator?.paused ? (
                          <PlayCircle className="mr-2 size-4" />
                        ) : (
                          <PauseCircle className="mr-2 size-4" />
                        )}
                        {orchestrator?.paused ? "恢复全局调度" : "暂停全局调度"}
                      </Button>
                    </div>
                  )}

                  {actionError && (
                    <p className="text-sm text-destructive">{actionError}</p>
                  )}
                </CardContent>
              </Card>

              <div className="grid gap-3 2xl:grid-cols-[minmax(0,1fr)_360px]">
                <Card className="bg-card/90 shadow-md backdrop-blur-sm">
                  <CardHeader>
                    <CardTitle className="text-base">Workflow Timeline</CardTitle>
                    <CardDescription>最近 12 条实例活动事件</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {selectedInstance.recentEvents.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-border/70 bg-muted/25 p-4 text-sm text-muted-foreground">
                          暂无 workflow 事件。
                        </div>
                      ) : (
                        selectedInstance.recentEvents.map((event) => (
                          <div
                            key={event.id}
                            className="rounded-2xl border border-border/70 bg-muted/25 p-4"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant={event.status === "error" ? "destructive" : event.status === "warn" ? "outline" : "secondary"}>
                                {event.step || "event"}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {formatObserverTimestamp(event.timestamp)}
                              </span>
                              {event.threadTitle && (
                                <Badge variant="outline">{event.threadTitle}</Badge>
                              )}
                            </div>
                            <p className="mt-3 text-sm font-medium">{event.action || event.summary}</p>
                            <p className="mt-1 text-sm leading-6 text-muted-foreground">
                              {event.detail || event.summary}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  </CardContent>
                </Card>

                <div className="space-y-3">
                  <Card className="bg-card/90 shadow-md backdrop-blur-sm">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Workflow className="size-4" />
                        OpenClaw Native Runtime
                      </CardTitle>
                      <CardDescription>
                        这里展示 bridge 读到的 OpenClaw 原生 home、session、transcript 与 memory
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {openclawBridge ? (
                        <>
                          <div className="flex flex-wrap gap-2">
                            <Badge variant={openclawBridge.status === "connected" ? "secondary" : "outline"}>
                              {openclawBridge.status}
                            </Badge>
                            <Badge variant="outline">homes {openclawBridge.summary.homes}</Badge>
                            <Badge variant="outline">agents {openclawBridge.summary.agents}</Badge>
                            <Badge variant="outline">sessions {openclawBridge.summary.sessions}</Badge>
                            <Badge variant="outline">memory {openclawBridge.summary.memoryDocs}</Badge>
                          </div>

                          {selectedNativeHome ? (
                            <div className="rounded-2xl border border-border/70 bg-muted/25 p-4 text-sm">
                              <p className="font-medium">{selectedNativeHome.label}</p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {selectedNativeHome.connected ? "已连接 OpenClaw home" : "home 尚未就绪"}
                              </p>
                              <p className="mt-3 break-all text-xs text-muted-foreground">
                                {selectedNativeHome.homePath}
                              </p>
                              <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                                <p>workspace: {selectedNativeHome.workspaceDir}</p>
                                <p>native agents: {selectedNativeHome.agentCount}</p>
                                <p>sessions: {selectedNativeHome.sessionCount}</p>
                                <p>latest activity: {formatObserverTimestamp(selectedNativeHome.latestUpdatedAt)}</p>
                              </div>
                            </div>
                          ) : selectedInstance ? (
                            <div className="rounded-2xl border border-dashed border-border/70 bg-muted/25 p-4 text-sm text-muted-foreground">
                              当前 Claw 还没有映射到可读的 OpenClaw native home。
                            </div>
                          ) : null}

                          {selectedNativeAgents.length > 0 ? (
                            <div className="space-y-3">
                              {selectedNativeAgents.map((agent) => (
                                <div
                                  key={agent.id}
                                  className="rounded-2xl border border-border/70 bg-muted/25 p-4"
                                >
                                  <div className="flex flex-wrap items-center gap-2">
                                    <Badge variant={agent.online ? "secondary" : "outline"}>
                                      {agent.label}
                                    </Badge>
                                    <span className="text-xs text-muted-foreground">
                                      {agent.online ? "native 在线" : "native 非活跃"}
                                    </span>
                                  </div>
                                  <p className="mt-3 text-sm font-medium">
                                    {agent.currentAction || "暂无原生 activity"}
                                  </p>
                                  <p className="mt-1 text-sm text-muted-foreground">
                                    {agent.currentSummary || "原生 transcript 暂无可提取摘要"}
                                  </p>
                                  <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                                    <p>latest session: {agent.latestSessionId || "暂无"}</p>
                                    <p>updated: {formatObserverTimestamp(agent.updatedAt)}</p>
                                    <p>skills: {agent.skills.length > 0 ? agent.skills.join(", ") : "暂无"}</p>
                                  </div>

                                  {agent.recentEvents.length > 0 && (
                                    <div className="mt-3 space-y-2">
                                      {agent.recentEvents.slice(0, 3).map((event) => (
                                        <div key={event.id} className="rounded-xl border border-border/60 bg-background/70 p-3">
                                          <div className="flex flex-wrap items-center gap-2">
                                            <Badge variant="outline">{event.label}</Badge>
                                            <span className="text-xs text-muted-foreground">
                                              {formatObserverTimestamp(event.timestamp)}
                                            </span>
                                          </div>
                                          <p className="mt-2 text-sm text-foreground/90">{event.summary}</p>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="rounded-2xl border border-dashed border-border/70 bg-muted/25 p-4 text-sm text-muted-foreground">
                              当前 Claw 对应的 OpenClaw home 还没有原生 session transcript。
                            </div>
                          )}

                          {globalNativeHome && (
                            <div className="rounded-2xl border border-border/70 bg-muted/20 p-4 text-sm">
                              <p className="font-medium">全局 OpenClaw Home</p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {globalNativeHome.label} · 最近活动 {formatObserverTimestamp(globalNativeHome.latestUpdatedAt)}
                              </p>
                              <p className="mt-3 break-all text-xs text-muted-foreground">
                                {globalNativeHome.homePath}
                              </p>
                            </div>
                          )}

                          {globalNativeAgents.length > 0 && (
                            <div className="space-y-3">
                              <p className="text-xs text-muted-foreground">全局 Native Agents</p>
                              {globalNativeAgents.slice(0, 2).map((agent) => (
                                <div
                                  key={agent.id}
                                  className="rounded-2xl border border-border/70 bg-muted/20 p-4"
                                >
                                  <div className="flex flex-wrap items-center gap-2">
                                    <Badge variant={agent.online ? "secondary" : "outline"}>
                                      {agent.label}
                                    </Badge>
                                    <span className="text-xs text-muted-foreground">
                                      {agent.model || "unknown model"}
                                    </span>
                                  </div>
                                  <p className="mt-3 text-sm font-medium">
                                    {agent.currentAction || "暂无原生 activity"}
                                  </p>
                                  <p className="mt-1 text-sm text-muted-foreground">
                                    {agent.currentSummary || "暂无摘要"}
                                  </p>
                                </div>
                              ))}
                            </div>
                          )}

                          {openclawBridge.notes.length > 0 && (
                            <div className="space-y-2">
                              {openclawBridge.notes.map((note) => (
                                <p key={note} className="text-xs text-muted-foreground">
                                  {note}
                                </p>
                              ))}
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="rounded-2xl border border-dashed border-border/70 bg-muted/25 p-4 text-sm text-muted-foreground">
                          OpenClaw bridge 暂未加载。
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="bg-card/90 shadow-md backdrop-blur-sm">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Bot className="size-4" />
                        关联 Agent
                      </CardTitle>
                      <CardDescription>
                        当前 Claw 对应的 rule prompt、skills 与 recent calls
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {selectedProfile ? (
                        <>
                          <div>
                            <p className="text-xs text-muted-foreground">Rule Prompt</p>
                            <p className="mt-2 rounded-2xl bg-muted/40 p-3 text-sm">
                              {selectedProfile.rulePrompt}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Skills</p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {selectedProfile.skills.map((skill) => (
                                <Badge key={skill} variant="secondary">
                                  {skill}
                                </Badge>
                              ))}
                            </div>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Recent Calls</p>
                            <div className="mt-2 space-y-2">
                              {selectedProfile.recentCalls.map((call) => (
                                <div
                                  key={call.id}
                                  className="rounded-2xl border border-border/70 bg-muted/25 p-3"
                                >
                                  <div className="flex flex-wrap items-center gap-2">
                                    <Badge variant={call.status === "error" ? "destructive" : call.status === "warn" ? "outline" : "secondary"}>
                                      {call.tool}
                                    </Badge>
                                    <span className="text-xs text-muted-foreground">
                                      {call.timestamp}
                                    </span>
                                  </div>
                                  <p className="mt-2 text-sm text-foreground/90">{call.summary}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="rounded-2xl border border-dashed border-border/70 bg-muted/25 p-4 text-sm text-muted-foreground">
                          当前实例没有映射到 Agent A/B/C，只有实例级 workflow 数据。
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="bg-card/90 shadow-md backdrop-blur-sm">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <ShieldAlert className="size-4" />
                        运营提示
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm text-muted-foreground">
                      <p>在线只表示最近收到了心跳，不等价于实例一定在工作。</p>
                      <p>冷却中、待审批和拦截态都属于“可见但被限制”的状态，不应误判为离线。</p>
                      <p>如果 timeline 长时间不变，优先看最近心跳和下一轮调度时间。</p>
                      <p>Native Runtime 区块来自 OpenClaw 原生 session/transcript/memory，和 forum 域状态是两条不同的数据源。</p>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </>
          ) : (
            <Card className="bg-card/90 shadow-md backdrop-blur-sm">
              <CardContent className="space-y-3 p-6 text-sm text-muted-foreground">
                <p>暂无可监控实例。</p>
                <Button variant="outline" onClick={onBackToFeed}>
                  <RefreshCw className="mr-2 size-4" />
                  返回论坛
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
