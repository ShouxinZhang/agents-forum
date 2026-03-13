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
  yoloReplies?: number
}

export type OpenClawPresenceSource = "native" | "forum" | "mixed" | "none"

export type OpenClawNativeRuntimeStatus =
  | "booting"
  | "running"
  | "idle"
  | "paused"
  | "error"
  | "stale"

export type OpenClawInstanceNativeRuntime = {
  status: OpenClawNativeRuntimeStatus
  sessionId: string
  lastHeartbeatAt: string
  lastStartedAt: string
  lastCompletedAt: string
  lastSuccessAt: string
  lastErrorAt: string
  lastExitCode: number | null
  runCount: number
  consecutiveFailures: number
  currentRunReason: string
  lastError: string
  lastRecoveredAt: string
  lastRecoveryReason: string
  stale?: boolean
}

export type OpenClawGlobalNativeRuntime = {
  status: OpenClawNativeRuntimeStatus | "idle"
  lastHeartbeatAt: string
  lastStartedAt: string
  lastCompletedAt: string
  activeRuns: number
  onlineInstances: number
  staleInstances: number
  errorInstances: number
  consecutiveFailures: number
  lastError: string
  lastRecoveredAt: string
  lastRecoveryReason: string
  staleAfterMs: number
}

export type OpenClawYoloMode = {
  enabled: boolean
  status: "disabled" | "enabled" | "expired"
  startedAt: string
  expiresAt: string
  durationMs: number
  startedBy: string
  reason: string
  remainingMs: number
  lastEventAt: string
  lastEventBy: string
  lastRecoveryAt: string
  recoveryStatus: string
  recoveryReason: string
}

export type OpenClawInstanceStats = {
  cycles: number
  replies: number
  reads: number
  blocked: number
  errors: number
}

export type OpenClawReplyContextHighlight = {
  author: string
  text: string
}

export type OpenClawReplyContextMemoryHit = {
  id: string
  label: string
  source: string
  summary: string
  updatedAt: string
}

export type OpenClawReplyContextTarget = {
  kind: string
  author: string
  floorId: string
  replyId: string
  summary: string
}

export type OpenClawReplyContextTrace = {
  updatedAt: string
  createdAt?: string
  id?: string
  source: "openclaw-native" | "local-fallback" | "native" | "forum" | "mixed" | "none" | "unknown"
  persona: string
  contextSources: string[]
  threadId: string
  threadTitle: string
  threadSummary?: string
  rootExcerpt: string
  rootPostSummary?: string
  targetSummary: string
  replySummary?: string
  whyThisReply?: string
  generationSource?: string
  finalSource?: string
  target?: OpenClawReplyContextTarget | null
  replyHighlights: OpenClawReplyContextHighlight[]
  memoryHighlights: string[]
  memoryHits?: OpenClawReplyContextMemoryHit[]
  memoryApplied?: string
  seedReply: string
  nativeDraft?: string
  finalReply: string
  basis: string[]
  promptSummary: string
  posted: boolean
}

export type OpenClawApprovalRequest = {
  id: string
  status: "pending" | "approved" | "rejected" | "executed"
  botUsername: string
  instanceId: string
  threadId: string
  threadTitle: string
  sectionId: string
  title: string
  content: string
  target: Record<string, unknown>
  approvalMode: string
  timestamp: string
  requestedBy: string
  source: string
  instruction: string
  note: string
  auditId: string
  whyThisReply: string
  memoryApplied: string
  replyContextTrace: OpenClawReplyContextTrace | null
  resolvedAt: string
  resolvedBy: string
  resolutionNote: string
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
  schedulerOnline: boolean
  online: boolean
  observedActive: boolean
  onlineSource: OpenClawPresenceSource
  activitySource: OpenClawPresenceSource
  primaryTimelineSource: "native" | "forum" | "none"
  nextRunAt: string
  lastHeartbeatAt: string
  lastTransitionAt: string
  currentThreadId: string
  currentThreadTitle: string
  lastDecision: string
  lastSummary: string
  lastError: string
  nativeRuntime: OpenClawInstanceNativeRuntime
  nativeStatus: OpenClawNativeRuntimeStatus
  nativeHeartbeatAt: string
  nativeSessionId: string
  nativeLastError: string
  workflow: OpenClawWorkflowSnapshot
  recentEvents: OpenClawWorkflowEvent[]
  replyContext?: OpenClawReplyContextTrace | null
  replyContextTrace?: OpenClawReplyContextTrace | null
  latestReplyTrace?: OpenClawReplyContextTrace | null
  stats: OpenClawInstanceStats
  quota: OpenClawInstanceQuota
}

export type OpenClawSummary = {
  total: number
  online: number
  schedulerOnline: number
  writable: number
  active: number
  observedActive: number
  paused: number
  blocked: number
}

export type OpenClawLifecycle = {
  sourceOfTruth: "openclaw-native+forum-domain"
  schedulerRole: "compatibility-layer"
  turnDriver: "forum_scheduler_requests_native_plan_and_draft"
  workingDirectoryMode: "instance-openclaw-root"
  nativePreferred: boolean
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
  nativeRuntime: OpenClawGlobalNativeRuntime
  yoloMode: OpenClawYoloMode
  lifecycle: OpenClawLifecycle
  statePath: string
  origin: string
  approvalMode: string
  instances: OpenClawInstance[]
  approvals: OpenClawApprovalRequest[]
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

export type OpenClawBridgeInstanceView = {
  instanceId: string
  homeId: string
  agentId: string
  observedOnline: boolean
  observedActive: boolean
  onlineSource: OpenClawPresenceSource
  activitySource: OpenClawPresenceSource
  primaryTimelineSource: "native" | "forum" | "none"
  latestSessionId: string
  nativeUpdatedAt: string
  currentAction: string
  currentSummary: string
}

export type OpenClawBridge = {
  status: "connected" | "partial" | "disconnected"
  source: "openclaw-native"
  summary: OpenClawBridgeSummary
  homes: OpenClawBridgeHome[]
  agents: OpenClawBridgeAgent[]
  instanceViews: OpenClawBridgeInstanceView[]
  notes: string[]
}

export type ObserverDashboard = {
  profiles: AgentProfiles
  orchestrator: OpenClawOrchestrator
  openclawBridge: OpenClawBridge
}
