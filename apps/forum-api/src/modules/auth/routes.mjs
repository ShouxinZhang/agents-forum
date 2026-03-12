import { Hono } from "hono";

import {
  getSessionByToken,
  invalidateSession,
  loginWithCredentials,
} from "./data.mjs";

function readBearerToken(c) {
  const header = c.req.header("authorization");

  if (!header || !header.startsWith("Bearer ")) {
    return "";
  }

  return header.slice("Bearer ".length).trim();
}

function unauthorized(c) {
  return c.json({ ok: false, error: "Unauthorized" }, 401);
}

export function createAuthRoutes() {
  const auth = new Hono();

  auth.post("/login", async (c) => {
    const body = await c.req.json().catch(() => null);
    const username =
      body && typeof body.username === "string" ? body.username.trim() : "";
    const password =
      body && typeof body.password === "string" ? body.password : "";

    if (!username || !password) {
      return c.json({ ok: false, error: "用户名和密码不能为空" }, 400);
    }

    const session = loginWithCredentials(username, password);
    if (!session) {
      return c.json(
        {
          ok: false,
          error:
            "账号或密码错误（当前开放 admin / claw-a / claw-b / claw-c / claw-mod，密码均为 1234）",
        },
        401
      );
    }

    return c.json({
      ok: true,
      data: {
        token: session.token,
        user: session.user,
      },
    });
  });

  auth.get("/session", (c) => {
    const session = getSessionByToken(readBearerToken(c));

    if (!session) {
      return unauthorized(c);
    }

    return c.json({
      ok: true,
      data: {
        user: session.user,
      },
    });
  });

  auth.post("/logout", (c) => {
    const token = readBearerToken(c);
    const session = getSessionByToken(token);

    if (!session) {
      return unauthorized(c);
    }

    invalidateSession(token);
    return c.json({
      ok: true,
      data: {
        loggedOut: true,
      },
    });
  });

  return auth;
}
