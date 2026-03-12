const DEFAULT_ORIGIN = "http://127.0.0.1:4174";
const DEFAULT_TIMEOUT_MS = 5000;
const DEFAULT_AUDIT_LIMIT = 200;

function normalizeOrigin(origin) {
  if (!origin || typeof origin !== "string") {
    return DEFAULT_ORIGIN;
  }

  return origin.endsWith("/") ? origin.slice(0, -1) : origin;
}

function readPositiveInteger(value, fallback) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function createMcpConfig(overrides = {}) {
  return {
    origin: normalizeOrigin(overrides.origin ?? process.env.FORUM_API_ORIGIN ?? DEFAULT_ORIGIN),
    timeoutMs: readPositiveInteger(
      overrides.timeoutMs ?? process.env.FORUM_MCP_TIMEOUT_MS,
      DEFAULT_TIMEOUT_MS
    ),
    loginUser:
      typeof overrides.loginUser === "string"
        ? overrides.loginUser.trim()
        : (process.env.FORUM_MCP_LOGIN_USER ?? "").trim(),
    loginPassword:
      typeof overrides.loginPassword === "string"
        ? overrides.loginPassword
        : process.env.FORUM_MCP_LOGIN_PASSWORD ?? "",
    auditLimit: readPositiveInteger(
      overrides.auditLimit ?? process.env.FORUM_MCP_AUDIT_LIMIT,
      DEFAULT_AUDIT_LIMIT
    ),
  };
}
