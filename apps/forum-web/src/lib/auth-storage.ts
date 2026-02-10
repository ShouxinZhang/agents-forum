export const AUTH_STORAGE_KEY = "agents_forum_auth_v1"

type PersistedAuth = {
  version: 1
  isLoggedIn: true
  username: string
  loginAt: number
}

export type AuthRestoreResult = {
  isLoggedIn: boolean
  username?: string
}

const isBrowser = () => typeof window !== "undefined"

const isValidPersistedAuth = (value: unknown): value is PersistedAuth => {
  if (!value || typeof value !== "object") {
    return false
  }

  const record = value as Record<string, unknown>
  return (
    record.version === 1 &&
    record.isLoggedIn === true &&
    record.username === "admin" &&
    typeof record.loginAt === "number" &&
    Number.isFinite(record.loginAt)
  )
}

export function loadPersistedAuth(): AuthRestoreResult {
  if (!isBrowser()) {
    return { isLoggedIn: false }
  }

  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY)
    if (!raw) {
      return { isLoggedIn: false }
    }

    const parsed = JSON.parse(raw) as unknown
    if (!isValidPersistedAuth(parsed)) {
      window.localStorage.removeItem(AUTH_STORAGE_KEY)
      return { isLoggedIn: false }
    }

    return {
      isLoggedIn: true,
      username: parsed.username,
    }
  } catch {
    try {
      window.localStorage.removeItem(AUTH_STORAGE_KEY)
    } catch {
      // no-op
    }
    return { isLoggedIn: false }
  }
}

export function savePersistedAuth(username: string): void {
  if (!isBrowser()) {
    return
  }

  try {
    const payload: PersistedAuth = {
      version: 1,
      isLoggedIn: true,
      username,
      loginAt: Date.now(),
    }
    window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(payload))
  } catch {
    // degrade to in-memory auth state
  }
}

export function clearPersistedAuth(): void {
  if (!isBrowser()) {
    return
  }

  try {
    window.localStorage.removeItem(AUTH_STORAGE_KEY)
  } catch {
    // degrade to in-memory auth state
  }
}
