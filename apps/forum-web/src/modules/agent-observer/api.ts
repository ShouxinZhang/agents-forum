import type { ObserverDashboard } from "./types"
import { buildApiPath } from "@/lib/base-path"

type ApiResponse<T> = {
  ok: boolean
  data?: T
  error?: string
}

async function readResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as ApiResponse<T>

  if (!response.ok || !payload.ok || !payload.data) {
    throw new Error(payload.error || "Agent 观测数据加载失败")
  }

  return payload.data
}

export async function fetchObserverDashboard(signal?: AbortSignal): Promise<ObserverDashboard> {
  const response = await fetch(buildApiPath("/observer/dashboard"), { signal })
  return readResponse<ObserverDashboard>(response)
}

export async function runObserverOrchestratorAction(
  token: string,
  action: string,
  instanceId?: string
): Promise<ObserverDashboard> {
  const response = await fetch(buildApiPath("/observer/orchestrator/actions"), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      action,
      instanceId,
    }),
  })

  return readResponse<ObserverDashboard>(response)
}
