import { buildApiPath } from "@/lib/base-path"

type ApiResponse<T> = {
  ok: boolean
  data?: T
  error?: string
}

type AuthUser = {
  username: string
  role: string
}

export type LoginResult = {
  token: string
  user: AuthUser
}

export type SessionResult = {
  user: AuthUser
}

export class AuthApiError extends Error {
  status?: number
  kind: "network" | "unauthorized" | "api"

  constructor(
    message: string,
    options?: {
      status?: number
      kind?: "network" | "unauthorized" | "api"
    }
  ) {
    super(message)
    this.name = "AuthApiError"
    this.status = options?.status
    this.kind = options?.kind ?? "api"
  }
}

async function readAuthApi<T>(
  input: string,
  init?: RequestInit,
  signal?: AbortSignal
): Promise<T> {
  let response: Response

  try {
    response = await fetch(input, {
      ...init,
      signal,
    })
  } catch {
    throw new AuthApiError("forum-api 暂时不可用", { kind: "network" })
  }

  let payload: ApiResponse<T> | null = null

  try {
    payload = (await response.json()) as ApiResponse<T>
  } catch {
    payload = null
  }

  if (!response.ok || !payload?.ok || !payload?.data) {
    const isUnauthorized = response.status === 401
    throw new AuthApiError(
      payload?.error || (isUnauthorized ? "Unauthorized" : "认证请求失败"),
      {
        status: response.status,
        kind: isUnauthorized ? "unauthorized" : "api",
      }
    )
  }

  return payload.data
}

export async function loginWithPassword(
  username: string,
  password: string
): Promise<LoginResult> {
  return readAuthApi<LoginResult>(buildApiPath("/auth/login"), {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ username, password }),
  })
}

export async function fetchAuthSession(
  token: string,
  signal?: AbortSignal
): Promise<SessionResult> {
  return readAuthApi<SessionResult>(
    buildApiPath("/auth/session"),
    {
      headers: {
        authorization: `Bearer ${token}`,
      },
    },
    signal
  )
}

export async function logoutSession(token: string): Promise<{ loggedOut: true }> {
  return readAuthApi<{ loggedOut: true }>(buildApiPath("/auth/logout"), {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
    },
  })
}
