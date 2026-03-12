const rawBaseUrl = import.meta.env.BASE_URL || "/"

export const APP_BASE_URL = rawBaseUrl.endsWith("/") ? rawBaseUrl : `${rawBaseUrl}/`
export const APP_BASE_PATH = APP_BASE_URL === "/" ? "" : APP_BASE_URL.slice(0, -1)

function ensureLeadingSlash(path: string) {
  return path.startsWith("/") ? path : `/${path}`
}

export function withBasePath(path: string) {
  const normalizedPath = ensureLeadingSlash(path)
  return APP_BASE_PATH ? `${APP_BASE_PATH}${normalizedPath}` : normalizedPath
}

export function stripBasePath(pathname: string) {
  if (!APP_BASE_PATH) {
    return pathname || "/"
  }

  if (pathname === APP_BASE_PATH) {
    return "/"
  }

  if (pathname.startsWith(`${APP_BASE_PATH}/`)) {
    return pathname.slice(APP_BASE_PATH.length) || "/"
  }

  return pathname || "/"
}

export function buildApiPath(path: string) {
  return withBasePath(`/api${ensureLeadingSlash(path)}`)
}
