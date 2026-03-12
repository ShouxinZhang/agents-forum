import type { AgentKey } from "@/modules/forum/types"

export type AgentMemoryEntry = {
  id: string
  text: string
  source: string
  timestamp: string
}

export type AgentCallLog = {
  id: string
  tool: string
  summary: string
  timestamp: string
  status: "ok" | "warn" | "error"
}

export type OpenClawWorkflowSnapshot = {
  currentStep: string
  currentAction: string
  currentDetail: string
  startedAt: string
  heartbeatAt: string
  targetThreadId: string
  targetThreadTitle: string
}

export type OpenClawWorkflowEvent = {
  id: string
  step: string
  action: string
  detail: string
  summary: string
  status: "ok" | "warn" | "error"
  timestamp: string
  threadId: string
  threadTitle: string
}

export type AgentProfile = {
  rulePrompt: string
  inheritedFrom: string
  skills: string[]
  memory: AgentMemoryEntry[]
  recentCalls: AgentCallLog[]
}

export type AgentProfiles = Record<AgentKey, AgentProfile>

export type OpenClawInstanceStatus =
  | "booting"
  | "stopped"
  | "running"
  | "paused"
  | "idle"
  | "reading"
  | "replying"
  | "replied"
  | "cooling_down"
  | "blocked"
  | "awaiting_approval"
  | "read_only"
  | "error"

export type OpenClawInstanceQuota = {
  used: number
  limit: number
  remainingMs: number
  pendingApprovals: number
}

export type OpenClawInstanceStats = {
  cycles: number
  replies: number
  reads: number
  blocked: number
  errors: number
}

export type OpenClawInstance = {
  id: string
  label: string
  sortOrder: number
  botUsername: string
  displayName: string
  agentId: string
  canWrite: boolean
  openclawHome: string
  workspaceDir: string
  status: OpenClawInstanceStatus
  paused: boolean
  workspaceReady: boolean
  online: boolean
  nextRunAt: string
  lastHeartbeatAt: string
  lastTransitionAt: string
  currentThreadId: string
  currentThreadTitle: string
  lastDecision: string
  lastSummary: string
  lastError: string
  workflow: OpenClawWorkflowSnapshot
  recentEvents: OpenClawWorkflowEvent[]
  stats: OpenClawInstanceStats
  quota: OpenClawInstanceQuota
}

export type OpenClawSummary = {
  total: number
  online: number
  writable: number
  active: number
  paused: number
  blocked: number
}

export type OpenClawOrchestrator = {
  status: "running" | "paused" | "stopped"
  paused: boolean
  autoStart: boolean
  tickMs: number
  startedAt: string
  lastTickAt: string
  lastRunReason: string
  pausedReason: string
  lastError: string
  statePath: string
  origin: string
  approvalMode: string
  instances: OpenClawInstance[]
  summary: OpenClawSummary
}

export type OpenClawBridgeMemoryDoc = {
  id: string
  label: string
  path: string
  updatedAt: string
}

export type OpenClawBridgeEvent = {
  id: string
  type: string
  label: string
  summary: string
  timestamp: string
}

export type OpenClawBridgeHome = {
  id: string
  label: string
  source: string
  linkedInstanceId: string
  homePath: string
  workspaceDir: string
  connected: boolean
  agentCount: number
  sessionCount: number
  latestUpdatedAt: string
  memoryDocs: OpenClawBridgeMemoryDoc[]
}

export type OpenClawBridgeAgent = {
  id: string
  agentId: string
  label: string
  homeId: string
  homeLabel: string
  homePath: string
  workspaceDir: string
  linkedInstanceId: string
  sessionCount: number
  latestSessionId: string
  updatedAt: string
  online: boolean
  chatType: string
  model: string
  currentAction: string
  currentSummary: string
  recentEvents: OpenClawBridgeEvent[]
  memoryDocs: OpenClawBridgeMemoryDoc[]
  skills: string[]
}

export type OpenClawBridgeSummary = {
  homes: number
  connectedHomes: number
  agents: number
  onlineAgents: number
  sessions: number
  memoryDocs: number
}

export type OpenClawBridge = {
  status: "connected" | "partial" | "disconnected"
  source: "openclaw-native"
  summary: OpenClawBridgeSummary
  homes: OpenClawBridgeHome[]
  agents: OpenClawBridgeAgent[]
  notes: string[]
}

export type ObserverDashboard = {
  profiles: AgentProfiles
  orchestrator: OpenClawOrchestrator
  openclawBridge: OpenClawBridge
}
