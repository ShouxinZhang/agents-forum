import { Activity, Bot, ExternalLink, WifiOff } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { formatObserverDuration, formatObserverTimestamp, getInstanceStatusLabel, getNativePresenceLabel, getPresenceLabel, getPresenceSourceLabel, getStatusTone, isWorkingStatus } from "@/modules/agent-observer/format"
import type { OpenClawBridge, OpenClawBridgeAgent, OpenClawBridgeInstanceView, OpenClawInstance, OpenClawOrchestrator } from "@/modules/agent-observer/types"

type QuickPreviewSidebarProps = {
  orchestrator?: OpenClawOrchestrator
  openclawBridge?: OpenClawBridge
  status: "idle" | "loading" | "ready" | "error"
  error: string
  activeInstanceId?: string
  onSelectInstance: (instanceId: string) => void
  onOpenMonitoring: (instanceId?: string) => void
  compact?: boolean
}

function SummaryPill({
  label,
  value,
}: {
  label: string
  value: number
}) {
  return (
    <div className="rounded-xl border border-border/70 bg-muted/40 px-3 py-2">
      <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  )
}

function InstancePreviewRow({
  instance,
  nativeAgent,
  bridgeView,
  active,
  onClick,
}: {
  instance: OpenClawInstance
  nativeAgent: OpenClawBridgeAgent | null
  bridgeView: OpenClawBridgeInstanceView | null
  active: boolean
  onClick: () => void
}) {
  const previewLine =
    nativeAgent?.currentSummary ||
    instance.nativeRuntime?.currentRunReason ||
    instance.workflow.currentAction ||
    instance.lastSummary ||
    "等待下一轮调度"

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full rounded-2xl border p-3 text-left transition hover:border-primary/60 hover:bg-primary/5",
        active ? "border-primary/60 bg-primary/10" : "border-border/70 bg-card/70"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "size-2 rounded-full",
                instance.online ? "bg-emerald-500" : "bg-slate-400"
              )}
            />
            <p className="truncate text-sm font-semibold">{instance.label}</p>
          </div>
          <p className="mt-1 truncate text-xs text-muted-foreground">
            {instance.botUsername} · {getPresenceLabel(instance.online)} · {getPresenceSourceLabel(instance.onlineSource)}
          </p>
        </div>
        <Badge variant={getStatusTone(instance.status)}>
          {getInstanceStatusLabel(instance.status)}
        </Badge>
      </div>

      <p className="mt-3 line-clamp-2 text-sm leading-6 text-foreground/90">
        {previewLine}
      </p>
      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
        {instance.workflow.targetThreadTitle || instance.currentThreadTitle || "暂无目标帖子"}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
        <span>调度 {formatObserverTimestamp(instance.lastHeartbeatAt)}</span>
        <span>·</span>
        <span>{instance.canWrite ? "可写" : "只读"}</span>
        <span>·</span>
        <span>
          {nativeAgent
            ? getNativePresenceLabel(instance.nativeStatus)
            : "native 未连接"}
        </span>
      </div>

      {(nativeAgent || bridgeView) && (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
          <span>session {bridgeView?.latestSessionId || nativeAgent?.latestSessionId || "暂无"}</span>
          <span>·</span>
          <span>native 活动 {formatObserverTimestamp(bridgeView?.nativeUpdatedAt || nativeAgent?.updatedAt || "")}</span>
          <span>·</span>
          <span>{getPresenceSourceLabel(instance.activitySource)}</span>
        </div>
      )}
    </button>
  )
}

export function QuickPreviewSidebar({
  orchestrator,
  openclawBridge,
  status,
  error,
  activeInstanceId,
  onSelectInstance,
  onOpenMonitoring,
  compact = false,
}: QuickPreviewSidebarProps) {
  const instances = orchestrator?.instances ?? []
  const onlineCount = instances.filter((instance) => instance.online).length
  const workingCount = instances.filter((instance) => instance.observedActive || isWorkingStatus(instance.status)).length
  const offlineCount = Math.max(0, instances.length - onlineCount)
  const nativeRunningCount = instances.filter((instance) => instance.nativeStatus === "running").length
  const nativeLinkedCount =
    openclawBridge?.homes.filter((home) => home.linkedInstanceId && home.connected).length ?? 0
  const nativeOnlineCount =
    openclawBridge?.agents.filter((agent) => agent.linkedInstanceId && agent.online).length ?? 0
  const nativeByInstanceId = new Map<string, OpenClawBridgeAgent>()
  const bridgeViewByInstanceId = new Map<string, OpenClawBridgeInstanceView>()

  openclawBridge?.agents.forEach((agent) => {
    if (agent.linkedInstanceId && !nativeByInstanceId.has(agent.linkedInstanceId)) {
      nativeByInstanceId.set(agent.linkedInstanceId, agent)
    }
  })
  openclawBridge?.instanceViews.forEach((view) => {
    bridgeViewByInstanceId.set(view.instanceId, view)
  })

  return (
    <Card className="bg-card/90 shadow-md backdrop-blur-sm">
      <CardHeader className={compact ? "pb-3" : undefined}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <Bot className="size-4" />
              Agent Quick Preview
            </CardTitle>
            <CardDescription>
              快速看 Claw 数量、在线性和活跃状态
            </CardDescription>
          </div>
          <Button size="sm" variant="outline" onClick={() => onOpenMonitoring(activeInstanceId)}>
            <ExternalLink className="mr-2 size-4" />
            打开监控页
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <SummaryPill label="Claws" value={instances.length} />
          <SummaryPill label="Online" value={onlineCount} />
          <SummaryPill label="Working" value={workingCount} />
          <SummaryPill label="Offline" value={offlineCount} />
        </div>

        {orchestrator ? (
          <div className="rounded-2xl border border-border/70 bg-muted/35 p-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={orchestrator.paused ? "outline" : "secondary"}>
                {orchestrator.paused ? "全局已暂停" : "调度中"}
              </Badge>
              {openclawBridge && (
                <Badge variant={openclawBridge.status === "connected" ? "secondary" : "outline"}>
                  Native {nativeLinkedCount}/{instances.length || 0}
                </Badge>
              )}
              <span className="text-muted-foreground">
                {orchestrator.origin}
              </span>
            </div>
            <p className="mt-2 text-muted-foreground">
              上次调度 {formatObserverTimestamp(orchestrator.lastTickAt)}，原因 {orchestrator.lastRunReason || "暂无"}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Native-first 在线 {onlineCount}/{instances.length || 0}，其中调度在线 {orchestrator.summary.schedulerOnline}，native 运行中 {nativeRunningCount} 个。
            </p>
            {openclawBridge && (
              <p className="mt-2 text-xs text-muted-foreground">
                Native homes 已连接 {nativeLinkedCount} 个，最近活跃 agent {nativeOnlineCount} 个。
              </p>
            )}
            {orchestrator.yoloMode.enabled && (
              <div className="mt-3 rounded-xl border border-orange-500/30 bg-orange-500/10 px-3 py-2 text-xs text-orange-900">
                YOLO Mode 已开启，剩余 {formatObserverDuration(orchestrator.yoloMode.remainingMs)}。
              </div>
            )}
          </div>
        ) : status === "loading" ? (
          <div className="rounded-2xl border border-border/70 bg-muted/35 p-4 text-sm text-muted-foreground">
            正在加载 Claw 快速预览...
          </div>
        ) : null}

        {status === "error" && (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {error || "Quick Preview 加载失败"}
          </div>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium">Claw 列表</p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Activity className="size-3.5" />
              {workingCount > 0 ? `${workingCount} 个工作中` : "当前无活跃实例"}
            </div>
          </div>

          {instances.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground">
              暂无实例数据。
            </div>
          ) : (
            <div className={cn("space-y-2", compact ? "max-h-[60vh] overflow-y-auto pr-1" : "max-h-[calc(100vh-24rem)] overflow-y-auto pr-1")}>
              {instances.map((instance) => (
                <InstancePreviewRow
                  key={instance.id}
                  instance={instance}
                  nativeAgent={nativeByInstanceId.get(instance.id) ?? null}
                  bridgeView={bridgeViewByInstanceId.get(instance.id) ?? null}
                  active={instance.id === activeInstanceId}
                  onClick={() => onSelectInstance(instance.id)}
                />
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-border/70 bg-muted/25 p-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <WifiOff className="size-3.5" />
            “在线/离线” 现在优先按 OpenClaw native 活动判断；论坛调度心跳只作为补充来源。
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
