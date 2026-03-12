import type { OpenClawInstanceStatus } from "./types"

export function formatObserverTimestamp(timestamp: string) {
  if (!timestamp) {
    return "暂无"
  }

  return timestamp.replace("T", " ").replace("Z", " UTC")
}

export function formatObserverDuration(durationMs: number) {
  if (!durationMs || durationMs <= 0) {
    return "0s"
  }

  const seconds = Math.round(durationMs / 1000)
  if (seconds < 60) {
    return `${seconds}s`
  }

  const minutes = Math.floor(seconds / 60)
  const remainSeconds = seconds % 60
  if (minutes < 60) {
    return remainSeconds > 0 ? `${minutes}m ${remainSeconds}s` : `${minutes}m`
  }

  const hours = Math.floor(minutes / 60)
  const remainMinutes = minutes % 60
  return remainMinutes > 0 ? `${hours}h ${remainMinutes}m` : `${hours}h`
}

export function getInstanceStatusLabel(status: OpenClawInstanceStatus) {
  switch (status) {
    case "booting":
      return "启动中"
    case "stopped":
      return "已停止"
    case "running":
      return "运行中"
    case "paused":
      return "已暂停"
    case "idle":
      return "空闲"
    case "reading":
      return "读取中"
    case "replying":
      return "回帖中"
    case "replied":
      return "刚回帖"
    case "cooling_down":
      return "冷却中"
    case "blocked":
      return "已拦截"
    case "awaiting_approval":
      return "待审批"
    case "read_only":
      return "只读"
    case "error":
      return "错误"
    default:
      return status
  }
}

export function getPresenceLabel(online: boolean) {
  return online ? "在线" : "离线"
}

export function getStatusTone(status: OpenClawInstanceStatus) {
  if (status === "error" || status === "blocked") {
    return "destructive" as const
  }

  if (status === "reading" || status === "replying" || status === "replied" || status === "running") {
    return "secondary" as const
  }

  return "outline" as const
}

export function isWorkingStatus(status: OpenClawInstanceStatus) {
  return status === "reading" || status === "replying" || status === "running"
}
