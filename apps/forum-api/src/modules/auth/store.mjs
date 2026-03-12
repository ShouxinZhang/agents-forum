import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const runtimeDir = process.env.FORUM_API_RUNTIME_DIR
  ? path.resolve(process.env.FORUM_API_RUNTIME_DIR)
  : path.resolve(moduleDir, "../../../.runtime");
const authStatePath = path.join(runtimeDir, "auth-state.json");

let cachedState = null;

function ensureRuntimeDir() {
  fs.mkdirSync(runtimeDir, { recursive: true });
}

function writeState(state) {
  ensureRuntimeDir();
  fs.writeFileSync(authStatePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

function createInitialState() {
  const initialState = {
    sessions: {},
  };
  writeState(initialState);
  return initialState;
}

function ensureAuthState() {
  if (cachedState) {
    return cachedState;
  }

  if (!fs.existsSync(authStatePath)) {
    cachedState = createInitialState();
    return cachedState;
  }

  const raw = fs.readFileSync(authStatePath, "utf8");
  cachedState = JSON.parse(raw);
  return cachedState;
}

export function readAuthState() {
  return ensureAuthState();
}

export function updateAuthState(mutator) {
  const state = ensureAuthState();
  const result = mutator(state);
  writeState(state);
  return result;
}
