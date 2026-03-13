# 08 Phase4 Context Trace And Native Queue

- Timestamp: 2026-03-13 06:04:43 +0800
- User prompt:
  - `OK`
  - `update the plan, 然后工作`
- Scope:
  - 收口 `Phase 4/5` 当前混合改动，解决 reply context trace 不可见、native draft 路径残缺、以及 `start_yolo + run_instance_once` 并发触发的 OpenClaw session lock。

## Files

- `apps/forum-api/src/modules/openclaw-orchestrator/service.mjs`
- `apps/forum-api/src/modules/openclaw-orchestrator/store.mjs`
- `apps/forum-web/src/modules/agent-observer/components/monitoring-page.tsx`
- `apps/forum-web/src/modules/agent-observer/types.ts`
- `docs/dev_plan/openclaw-multi-bot-forum-plan.md`

## Changes

1. Reply trace backend chain
   - 清理 `service.mjs` 里的残留 reply compose 路径，统一为 `OpenClaw native draft -> forum controlled post`。
   - 修正 `buildNativeDraftReplyPrompt` 调用名错误、补回 `seedReply` 兜底，并修复一次错误合并留下的发布链语法问题。
   - `updateReplyContextTrace(...)` 现在会同步写入 `replyContextTrace / latestReplyTrace / replyContext` 三个别名，避免 dashboard 与 state 漂移。

2. State normalization
   - `store.mjs` 正规化时会把 `replyContextTrace / latestReplyTrace / replyContext` 收敛到同一份 trace，保证旧 state 升级后仍可被前端读取。

3. Concurrency fix
   - 在 `service.mjs` 增加实例级 native turn 串行队列。
   - `tick(...)` 与 `run_instance_once(...)` 现在都会通过同一实例队列执行，避免同一个 Claw 同时命中 OpenClaw session file lock。

4. Plan update
   - 主计划已回写：`Phase 4` 中 native reply generation、reply context trace、Monitoring Page 的 `why this reply / what it read` 已标为完成。
   - `真正的 blocker` 已移除“看不清上下文来源”这一项，改成剩余的产品级写入审批审计闭环。

## Runtime verification

1. Reply context trace
   - 重启 `forum-api` 后，`/api/observer/dashboard` 已返回结构化 `replyContextTrace`。
   - 实际观测到的 trace 包含：
     - `persona`
     - `threadId / threadTitle / threadSummary / rootExcerpt`
     - `replyHighlights / replySummary`
     - `target`
     - `memoryHighlights / memoryApplied`
     - `whyThisReply / finalReply`
   - 实际样例中，`openclaw-claw-b` 的 trace 已出现：
     - `source=openclaw-native`
     - `whyThisReply=承接前面的追问，直接补上最先验证的依赖和最小试跑法。`
     - `finalReply=我建议先验 reply chain 和 transcript 的关联是否稳定...`

2. Native queue
   - 使用 `admin` 通过 `/api/observer/orchestrator/actions` 触发：
     - `start_yolo`
     - `run_instance_once`
   - 旧问题中，这组操作会引发 OpenClaw `session file locked`。
   - 本轮修复后，同实例 turn 已进入串行队列，不再因为同实例并发执行而直接互撞。

3. Operational cleanup
   - 验证结束后手动 `stop_yolo`，防止继续放大论坛活跃度。

## Verification

- `node --check apps/forum-api/src/modules/openclaw-orchestrator/service.mjs`
- `node --check apps/forum-api/src/modules/openclaw-orchestrator/store.mjs`
- `npm run typecheck -w forum-web`
- `curl -sf http://127.0.0.1:4174/api/health`
- 认证后调用 `/api/observer/orchestrator/actions`
- 读取 `/api/observer/dashboard`
- 读取 `apps/forum-api/.runtime/openclaw-orchestrator-state.json`

## Notes

- 这轮仍未完成 `Phase 4` 的产品级自然语言写入审批/审计闭环，也未完成 `Phase 5` 的 native runtime 完全接管。
- subagent 本轮继续用于并行探索前端 reply trace 展示；最终收口与运行验证仍由主 agent 完成。
