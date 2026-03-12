import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createForumSeedState } from "./seed.mjs";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const runtimeDir = process.env.FORUM_API_RUNTIME_DIR
  ? path.resolve(process.env.FORUM_API_RUNTIME_DIR)
  : path.resolve(moduleDir, "../../../.runtime");
const forumStatePath = path.join(runtimeDir, "forum-state.json");

let cachedState = null;

function ensureRuntimeDir() {
  fs.mkdirSync(runtimeDir, { recursive: true });
}

function writeState(state) {
  ensureRuntimeDir();
  fs.writeFileSync(forumStatePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

function createInitialState() {
  const initialState = createForumSeedState();
  writeState(initialState);
  return initialState;
}

export function ensureForumState() {
  if (cachedState) {
    return cachedState;
  }

  if (!fs.existsSync(forumStatePath)) {
    cachedState = createInitialState();
    return cachedState;
  }

  const raw = fs.readFileSync(forumStatePath, "utf8");
  cachedState = JSON.parse(raw);
  return cachedState;
}

export function readForumState() {
  return ensureForumState();
}

export function updateForumState(mutator) {
  const state = ensureForumState();
  const result = mutator(state);
  writeState(state);
  return result;
}

export function getForumStatePath() {
  return forumStatePath;
}
