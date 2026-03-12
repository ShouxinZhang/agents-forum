import { Hono } from "hono";

import { canUserManageForum, getSessionByToken } from "../auth/data.mjs";
import { buildAgentProfiles, getAgentProfile } from "./data.mjs";
import { getOpenClawBridgeService } from "../openclaw-bridge/service.mjs";
import { getOpenClawOrchestrator } from "../openclaw-orchestrator/service.mjs";

function readBearerToken(c) {
  const header = c.req.header("authorization");

  if (!header || !header.startsWith("Bearer ")) {
    return "";
  }

  return header.slice("Bearer ".length).trim();
}

function requireModeratorSession(c) {
  const session = getSessionByToken(readBearerToken(c));

  if (!session) {
    return {
      ok: false,
      response: c.json({ ok: false, error: "Unauthorized" }, 401),
    };
  }

  if (!canUserManageForum(session.user)) {
    return {
      ok: false,
      response: c.json({ ok: false, error: "Forbidden" }, 403),
    };
  }

  return { ok: true, session };
}

export function createAgentObserverRoutes() {
  const observer = new Hono();
  const orchestrator = getOpenClawOrchestrator();
  const bridge = getOpenClawBridgeService();

  observer.get("/agents", (c) =>
    c.json({
      ok: true,
      data: buildAgentProfiles(),
    })
  );

  observer.get("/agents/:agentId", (c) => {
    const profile = getAgentProfile(c.req.param("agentId"));

    if (!profile) {
      return c.json({ ok: false, error: "Agent Not Found" }, 404);
    }

    return c.json({
      ok: true,
      data: profile,
    });
  });

  observer.get("/dashboard", (c) =>
    {
      const orchestratorDashboard = orchestrator.getDashboard();
      return c.json({
        ok: true,
        data: {
          profiles: buildAgentProfiles(),
          orchestrator: orchestratorDashboard,
          openclawBridge: bridge.getDashboard(orchestratorDashboard),
        },
      });
    }
  );

  observer.post("/orchestrator/actions", async (c) => {
    const auth = requireModeratorSession(c);
    if (!auth.ok) {
      return auth.response;
    }

    const body = await c.req.json().catch(() => null);
    const action = body && typeof body.action === "string" ? body.action.trim() : "";
    const instanceId =
      body && typeof body.instanceId === "string" ? body.instanceId.trim() : "";

    if (!action) {
      return c.json({ ok: false, error: "Action Required" }, 400);
    }

    try {
      const dashboard = await orchestrator.performAction(action, instanceId || undefined);
      return c.json({
        ok: true,
        data: {
          profiles: buildAgentProfiles(),
          orchestrator: dashboard,
          openclawBridge: bridge.getDashboard(dashboard),
        },
      });
    } catch (error) {
      return c.json(
        {
          ok: false,
          error: error instanceof Error ? error.message : "Observer Action Failed",
        },
        400
      );
    }
  });

  return observer;
}
