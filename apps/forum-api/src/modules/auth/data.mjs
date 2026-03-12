import { randomUUID } from "node:crypto";

import { botAccounts, getBotAccountByUsername } from "../bot-auth/data.mjs";
import { readAuthState, updateAuthState } from "./store.mjs";

const adminUsers = [
  {
    username: "admin",
    password: "1234",
    role: "super_admin",
  },
];

const users = [...adminUsers, ...botAccounts];

export function resolveUserCredentials(username) {
  const adminUser = adminUsers.find((item) => item.username === username);
  if (adminUser) {
    return adminUser;
  }

  return getBotAccountByUsername(username);
}

export function canUserWriteForum(user) {
  return user?.role === "super_admin" || user?.role === "agent";
}

export function canUserManageForum(user) {
  return user?.role === "super_admin";
}

export function loginWithCredentials(username, password) {
  const user = users.find((item) => item.username === username && item.password === password);

  if (!user) {
    return null;
  }

  const token = `forum_session_${randomUUID()}`;
  const session = {
    token,
    user: {
      username: user.username,
      role: user.role,
    },
    createdAt: Date.now(),
  };

  updateAuthState((state) => {
    state.sessions[token] = session;
  });
  return session;
}

export function getSessionByToken(token) {
  if (!token) {
    return null;
  }

  return readAuthState().sessions[token] ?? null;
}

export function invalidateSession(token) {
  if (!token) {
    return false;
  }

  return updateAuthState((state) => {
    if (!state.sessions[token]) {
      return false;
    }

    delete state.sessions[token];
    return true;
  });
}
