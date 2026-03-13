# 09 Phase4 Approval Closure And Native Planning

- Timestamp: 2026-03-13 06:33:55 +0800
- User prompt:
  - `剩下真正的 L0 只剩两类：`
  - `OpenClaw 产品侧“自然语言写入 + 审批 + 审计”闭环。`
  - `forum 生命周期彻底切到 OpenClaw 原生多 Agent runtime。`
  - `开始工作`

## Scope

- 推进剩余两个 L0：
  - 产品侧写入审批/审计闭环
  - forum 生命周期继续向 OpenClaw native runtime 接管

## Files

- `apps/forum-api/src/modules/mcp/forum-bot/policy.mjs`
- `apps/forum-api/src/modules/openclaw-orchestrator/service.mjs`
- `apps/forum-api/src/modules/agent-observer/routes.mjs`
- `apps/forum-web/src/App.tsx`
- `apps/forum-web/src/modules/agent-observer/api.ts`
- `apps/forum-web/src/modules/agent-observer/components/monitoring-page.tsx`
- `apps/forum-web/src/modules/agent-observer/types.ts`
- `docs/dev_plan/openclaw-multi-bot-forum-plan.md`

## Changes

1. Approval state model
   - `policy.mjs` 把审批从简单数组升级成结构化 approval request：
     - `pending / approved / rejected / executed`
     - `botUsername / instanceId / threadId / content / target`
     - `whyThisReply / memoryApplied / replyContextTrace`
     - `resolvedAt / resolvedBy / execution`
   - 新增：
     - `createApprovalRequest(...)`
     - `listApprovalRequests(...)`
     - `resolveApprovalRequest(...)`

2. Native-first turn planning
   - `service.mjs` 增加 native planner：
     - `buildNativeThreadPlanPrompt / executeNativeThreadPlan`
     - `buildNativeTargetPlanPrompt / executeNativeTargetPlan`
   - 现在生命周期已从本地 `chooseThread / chooseReplyTarget` 进一步改为：
     - native 选帖
     - native 选承接 target
     - native draft final reply
     - forum/native executor 执行
   - lifecycle 元信息同步改为 `forum_scheduler_requests_native_plan_and_draft`

3. Approval actions and UI
   - observer action 新增：
     - `queue_instance_approval`
     - `approve_approval`
     - `reject_approval`
   - Monitoring Page 新增待审批卡片，可直接：
     - 生成待审批草稿
     - 批准并发布
     - 拒绝
   - dashboard 现在返回 `approvals`

4. Concurrency / runtime details
   - approval 执行也接入实例级串行队列，避免与调度同时打到同一 Claw。
   - native thread/target/draft 的单次超时下调到 45 秒，减少长时间挂起。

## Runtime verification

1. Native planning
   - dashboard lifecycle 已显示：
     - `turnDriver=forum_scheduler_requests_native_plan_and_draft`

2. Approval generation
   - 先暂停全局调度，再对 `openclaw-claw-b` 执行 `queue_instance_approval`
   - 成功得到待审批对象：
     - `approval_fce47f91-b648-4997-9dde-ece500660460`
   - approval 内包含：
     - native 生成的 `content`
     - `whyThisReply`
     - `memoryApplied`
     - `replyContextTrace`

3. Approval execution
   - 同一 approval 最终已进入 `executed` 状态：
     - `resolvedBy=admin`
     - `resolutionNote=approved_after_restart`
     - `execution.mode=reply-thread`
   - 论坛线程 `t-1773351186836-994` 中已能读到这条批准后发布的回复：
     - `顺着小步试跑，我建议先锁定一个 thread/floor 做三 Bot 连续回复...`

4. Operational cleanup
   - 验证后恢复全局调度 `resume`

## Verification

- `node --check apps/forum-api/src/modules/openclaw-orchestrator/service.mjs`
- `node --check apps/forum-api/src/modules/mcp/forum-bot/policy.mjs`
- `npm run typecheck -w forum-web`
- `curl -sf http://127.0.0.1:4174/api/health`
- `/api/observer/orchestrator/actions`
  - `pause`
  - `queue_instance_approval`
  - `approve_approval`
  - `resume`
- `/api/observer/dashboard`
- `apps/forum-api/.runtime/forum-bot-state.json`
- `/api/forum/threads/t-1773351186836-994`

## Remaining

- 还没完成 OpenClaw 产品聊天层“自然语言写入”直接命中审批链。
- 还没完成 forum 多 Bot 生命周期被 OpenClaw 原生多 Agent runtime 完全托管。
