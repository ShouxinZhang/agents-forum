# 04 Phase2 Phase3 Phase35 Acceleration

- User prompt: `.agents/skills/codex-subagents-simple 用这个加速一下你的工作 Phase 2,3,3.5 加速`
- Timestamp: `2026-03-13 04:21:17 CST (+0800)`

## Files

- `apps/forum-api/src/modules/openclaw-orchestrator/service.mjs`
- `apps/forum-api/src/modules/mcp/forum-bot/policy.mjs`
- `apps/forum-api/src/modules/agent-observer/routes.mjs`
- `apps/forum-web/src/modules/agent-observer/types.ts`
- `apps/forum-web/src/modules/agent-observer/api.ts`
- `apps/forum-web/src/modules/agent-observer/format.ts`
- `apps/forum-web/src/modules/agent-observer/components/quick-preview-sidebar.tsx`
- `apps/forum-web/src/modules/agent-observer/components/monitoring-page.tsx`
- `apps/forum-web/src/App.tsx`
- `docs/dev_plan/openclaw-multi-bot-forum-plan.md`
- `docs/dev_logs/2026-03-13/04-phase2-phase3-phase35-acceleration.md`

## Change Details

### 1. Subagent acceleration attempt

- Read and used repo-local skill `.agents/skills/codex-subagents-simple/SKILL.md`.
- Created a 3-worker spec for:
  - `phase2-native-monitoring`
  - `phase3-native-runtime`
  - `phase35-yolo-mode`
- Started the subagent runner through:
  - `npm --prefix .agents/skills/codex-subagents-simple run subagents -- --spec ... --workspace-root ... --model gpt-5.4 --reasoning-effort high --max-parallel 3`
- Result:
  - worker processes launched successfully
  - no `agents/*.json` result files were written in a reasonable time window
  - primary agent cancelled the run and fell back to direct implementation to avoid blocking delivery

### 2. Phase 3: native runtime lifecycle visibility and control

- Completed the partial native lifecycle scaffolding that already existed in `openclaw-orchestrator`.
- Added live native runtime tracking to orchestrator state and dashboard:
  - instance native status
  - native heartbeat
  - native session id
  - native error
  - native run count
  - native consecutive failures
  - global native runtime aggregate status
- Native observe/reply turns now update native lifecycle state before and after each run.
- Added instance-level action:
  - `run_instance_once`

### 3. Phase 3.5: first working YOLO Mode slice

- Implemented a time-limited `YOLO Mode` backend flow:
  - `start_yolo`
  - `stop_yolo`
  - remaining time
  - actor / reason
  - faster tick interval while enabled
- Policy behavior during YOLO:
  - bypass daily quota
  - bypass same-thread cooldown
  - bypass local content safety check
  - keep `claw-mod` read-only
- Added YOLO-specific accounting so YOLO replies do not consume the normal daily quota bucket.

### 4. Phase 2: native-first monitoring improvements

- Extended observer/frontend types to expose:
  - global native runtime
  - instance native runtime
  - yolo mode
- Monitoring UI now shows:
  - `global native`
  - instance native status
  - native session
  - native run count
  - native consecutive failures
  - YOLO banner, remaining time, and controls
- Quick Preview now shows:
  - native connected/running counts
  - native runtime health wording instead of only forum scheduler wording
- Added explicit UI controls for:
  - `实例跑一轮`
  - `YOLO 5m / 15m / 30m`
  - `关闭 YOLO`

### 5. Plan sync

- Updated `docs/dev_plan/openclaw-multi-bot-forum-plan.md` so Phases 2, 3, and 3.5 reflect the current shipped progress.

## Verification

- Syntax / type checks:
  - `node --check apps/forum-api/src/modules/openclaw-orchestrator/service.mjs`
  - `node --check apps/forum-api/src/modules/agent-observer/routes.mjs`
  - `node --check apps/forum-api/src/modules/mcp/forum-bot/policy.mjs`
  - `npm run typecheck -w forum-web`
- Runtime API checks after restarting `forum-api`:
  - `curl http://127.0.0.1:4174/api/health`
  - `curl http://127.0.0.1:4174/api/observer/dashboard | jq ...`
  - `POST /api/observer/orchestrator/actions` with `start_yolo`
  - `POST /api/observer/orchestrator/actions` with `stop_yolo`
  - `POST /api/observer/orchestrator/actions` with `run_instance_once`
- Playwright interactive desktop QA:
  - logged in as `admin`
  - opened `/monitoring`
  - confirmed `YOLO 5m/15m/30m`, `global native`, `native 状态`, `实例跑一轮`
  - triggered `YOLO 5m` from UI and confirmed banner plus close control appeared

## Remaining Risks

- `YOLO Mode` currently has a working first slice, but still needs longer runtime validation to prove it materially increases multi-bot activity under load.
- Monitoring is more native-aware, but forum timeline is still coexisting with native transcript rather than being fully demoted to domain supplement data.
- The forum orchestrator still triggers native turns; full lifecycle ownership has not yet been migrated to OpenClaw native multi-agent runtime.

