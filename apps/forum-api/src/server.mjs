import { serve } from "@hono/node-server"
import { Hono } from "hono"

import { createAgentObserverRoutes } from "./modules/agent-observer/routes.mjs"
import { createAuthRoutes } from "./modules/auth/routes.mjs"
import { createForumRoutes } from "./modules/forum/routes.mjs"
import { getOpenClawOrchestrator } from "./modules/openclaw-orchestrator/service.mjs"

const args = process.argv.slice(2)

const pickArg = (flag, fallback) => {
  const idx = args.indexOf(flag)
  if (idx >= 0 && idx + 1 < args.length) {
    return args[idx + 1]
  }
  return fallback
}

const host = pickArg("--host", process.env.HOST || "127.0.0.1")
const port = Number.parseInt(pickArg("--port", process.env.PORT || "4174"), 10)
const origin = `http://${host}:${port}`

const app = new Hono()
const openclawOrchestrator = getOpenClawOrchestrator({ origin })

app.get("/api/health", (c) =>
  c.json({
    ok: true,
    service: "forum-api",
    host,
    port,
  })
)

app.route("/api/auth", createAuthRoutes())
app.route("/api/observer", createAgentObserverRoutes())
app.route("/api/forum", createForumRoutes())

app.notFound((c) => c.json({ ok: false, error: "Not Found" }, 404))

serve(
  {
    fetch: app.fetch,
    hostname: host,
    port,
  },
  () => {
    console.log(`[forum-api] listening on http://${host}:${port}`)
    openclawOrchestrator.start()
  }
)
