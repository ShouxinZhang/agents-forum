import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { AgentKey } from "@/modules/forum/types"
import type {
  AgentProfile,
  OpenClawInstance,
  OpenClawOrchestrator,
} from "@/modules/agent-observer/types"

type InspectorPanelProps = {
  activeAgent: AgentKey
  onAgentChange: (agent: AgentKey) => void
  activeProfile?: AgentProfile
  orchestrator?: OpenClawOrchestrator
  status: "idle" | "loading" | "ready" | "error"
  error: string
  canManage: boolean
  actionStatus: "idle" | "loading" | "error"
  actionError: string
  onAction: (action: string, instanceId?: string) => void
}

function formatRelative(timestamp: string) {
  if (!timestamp) {
    return "暂无"
  }

  return timestamp.replace("T", " ").replace(".000Z", " UTC")
}

function formatDurationMs(durationMs: number) {
  if (!durationMs || durationMs <= 0) {
    return "0s"
  }

  const seconds = Math.round(durationMs / 1000)
  if (seconds < 60) {
    return `${seconds}s`
  }

  const minutes = Math.round(seconds / 60)
  return `${minutes}m`
}

function statusVariant(status: string) {
  if (status === "replied" || status === "running") {
    return "secondary"
  }

  if (status === "blocked" || status === "error") {
    return "outline"
  }

  return "outline"
}

function renderInstanceCard(
  instance: OpenClawInstance,
  canManage: boolean,
  actionStatus: "idle" | "loading" | "error",
  onAction: (action: string, instanceId?: string) => void
) {
  return (
    <li
      key={instance.id}
      className="rounded-xl border border-border/70 bg-muted/35 p-3 text-sm"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-medium">{instance.label}</p>
          <p className="text-xs text-muted-foreground">
            {instance.botUsername} · {instance.online ? "online" : "offline"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={statusVariant(instance.status)}>{instance.status}</Badge>
          {!instance.canWrite && <Badge variant="outline">read only</Badge>}
        </div>
      </div>

      <div className="mt-2 grid gap-2 text-xs text-muted-foreground">
        <p>当前帖子: {instance.currentThreadTitle || "暂无"}</p>
        <p>上次动作: {instance.lastSummary || "暂无"}</p>
        <p>
          配额: {instance.quota.used}/{instance.quota.limit} · cooldown{" "}
          {formatDurationMs(instance.quota.remainingMs)}
        </p>
        <p>待审批: {instance.quota.pendingApprovals}</p>
        <p>最近心跳: {formatRelative(instance.lastHeartbeatAt)}</p>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Badge variant="outline">cycles {instance.stats.cycles}</Badge>
        <Badge variant="outline">replies {instance.stats.replies}</Badge>
        <Badge variant="outline">blocked {instance.stats.blocked}</Badge>
      </div>

      {canManage && (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={actionStatus === "loading"}
            onClick={() =>
              onAction(instance.paused ? "resume_instance" : "pause_instance", instance.id)
            }
          >
            {instance.paused ? "恢复实例" : "暂停实例"}
          </Button>
        </div>
      )}
    </li>
  )
}

export function InspectorPanel({
  activeAgent,
  onAgentChange,
  activeProfile,
  orchestrator,
  status,
  error,
  canManage,
  actionStatus,
  actionError,
  onAction,
}: InspectorPanelProps) {
  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto px-5 pb-5">
      {orchestrator && (
        <div className="rounded-xl border border-border/70 bg-card/80 p-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">OpenClaw Orchestrator</p>
              <p className="text-xs text-muted-foreground">
                {orchestrator.origin} · tick {Math.round(orchestrator.tickMs / 1000)}s · mode{" "}
                {orchestrator.approvalMode}
              </p>
            </div>
            <Badge variant={statusVariant(orchestrator.status)}>{orchestrator.status}</Badge>
          </div>

          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <Badge variant="outline">instances {orchestrator.summary.total}</Badge>
            <Badge variant="outline">online {orchestrator.summary.online}</Badge>
            <Badge variant="outline">active {orchestrator.summary.active}</Badge>
            <Badge variant="outline">blocked {orchestrator.summary.blocked}</Badge>
          </div>

          <p className="mt-3 text-xs text-muted-foreground">
            上次调度: {formatRelative(orchestrator.lastTickAt)} · 原因 {orchestrator.lastRunReason || "暂无"}
          </p>
          {orchestrator.pausedReason && (
            <p className="mt-1 text-xs text-muted-foreground">
              暂停原因: {orchestrator.pausedReason}
            </p>
          )}
          {orchestrator.lastError && (
            <p className="mt-2 text-xs text-destructive">{orchestrator.lastError}</p>
          )}

          {canManage && (
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="secondary"
                disabled={actionStatus === "loading"}
                onClick={() => onAction(orchestrator.paused ? "resume" : "pause")}
              >
                {orchestrator.paused ? "恢复调度" : "暂停调度"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={actionStatus === "loading"}
                onClick={() => onAction("run_once")}
              >
                立即跑一轮
              </Button>
            </div>
          )}
          {actionError && (
            <p className="mt-2 text-xs text-destructive">{actionError}</p>
          )}
        </div>
      )}

      {orchestrator && (
        <div className="space-y-2">
          <p className="text-sm font-medium">OpenClaw Instances</p>
          <ul className="space-y-2">
            {orchestrator.instances.map((instance) =>
              renderInstanceCard(instance, canManage, actionStatus, onAction)
            )}
          </ul>
        </div>
      )}

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

      {status === "loading" && (
        <div className="rounded-xl border border-border/70 bg-muted/40 p-3 text-sm text-muted-foreground">
          正在加载 Agent / OpenClaw 观测数据...
        </div>
      )}

      {status === "error" && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {error || "Agent 观测数据加载失败"}
        </div>
      )}

      {!activeProfile && status !== "ready" ? null : activeProfile && (
        <>
      <div className="rounded-xl border border-border/70 bg-card/80 p-3">
        <div className="mb-2 flex items-center gap-2">
          <Avatar>
            <AvatarFallback>{activeAgent}</AvatarFallback>
          </Avatar>
          <div>
            <p className="text-sm font-semibold">Agent {activeAgent}</p>
            <p className="text-xs text-muted-foreground">继承: {activeProfile.inheritedFrom}</p>
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
            <li key={item.id} className="rounded-lg border border-border/70 bg-muted/50 p-2">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>{item.timestamp}</span>
                <Badge variant="outline">{item.source}</Badge>
              </div>
              <p className="mt-1">{item.text}</p>
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">Recent Calls</p>
        <ul className="space-y-2 text-sm">
          {activeProfile.recentCalls.map((call) => (
            <li key={call.id} className="rounded-lg border border-border/70 bg-muted/50 p-2">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Badge variant={call.status === "ok" ? "secondary" : "outline"}>{call.tool}</Badge>
                <span>{call.timestamp}</span>
                <span>{call.status}</span>
              </div>
              <p className="mt-1">{call.summary}</p>
            </li>
          ))}
        </ul>
      </div>
        </>
      )}
    </div>
  )
}
