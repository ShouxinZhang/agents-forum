# 10. OpenClaw 产品聊天层命中审批链

- Timestamp: 2026-03-13 07:06:58 CST
- User Prompt:
  - `OpenClaw 产品聊天层的“自然语言写入”还没直接命中这条审批链。 run`

## Files

- `apps/forum-api/src/modules/agent-observer/routes.mjs`
- `apps/forum-api/src/modules/openclaw-orchestrator/service.mjs`
- `apps/forum-web/src/App.tsx`
- `apps/forum-web/src/modules/agent-observer/api.ts`
- `apps/forum-web/src/modules/agent-observer/components/monitoring-page.tsx`
- `docs/dev_plan/openclaw-multi-bot-forum-plan.md`
- `skills/openclaw-forum-bot/SKILL.md`
- `skills/openclaw-forum-bot/references/approval-workflow.md`
- `skills/openclaw-forum-bot/scripts/queue-approval.sh`

## Change Summary

- 为 observer action 增加 `threadId` 透传，允许 `queue_instance_approval` 锁定指定帖子，而不是让 native planner 自由选帖。
- 为 OpenClaw forum skill 新增 `scripts/queue-approval.sh`，把“管理员登录 -> queue_instance_approval -> 返回 compact JSON”收敛成一个显式产品入口。
- 在 `SKILL.md` 与 `references/approval-workflow.md` 中补充非发布写入契约：
  - 待审批草稿必须走 `queue-approval.sh`
  - `admin` 是审批动作执行者，`claw-*` 是目标发言身份
  - `exec timeout` 需要设为 `120000`
  - 若工具返回 background process/session，需要继续 `process poll`
- 回写主计划，确认“OpenClaw 产品聊天层自然语言写入直接命中审批链”已不再是 L0 blocker。

## Runtime Verification

- 先将更新后的 skill 用 `skills/openclaw-forum-bot/scripts/bootstrap.sh --force` 复制到 `~/.openclaw/workspace/skills/openclaw-forum-bot`。
- 为了避免历史 quota 污染结论，测试前暂停 orchestrator，并仅清空 `claw-b` 的当日 quota/cooldown 状态；验证后恢复 orchestrator。
- 直接脚本 smoke：
  - `skills/openclaw-forum-bot/scripts/queue-approval.sh --bot claw-b --thread-id t-1773351186836-994`
  - 成功返回 pending approval：
    - `approval_fa1ca966-29e7-4e37-868a-3cb4067b4c90`
- OpenClaw 产品聊天层验证：
  - 会话中读取 `~/.openclaw/workspace/skills/openclaw-forum-bot/SKILL.md`
  - 明确执行 `./queue-approval.sh --origin http://127.0.0.1:4174 --bot claw-b --thread-id t-1773351186836-994`
  - observer 侧出现新的真实 pending approval：
    - `approval_a367b04e-a67b-4154-8afd-a0b999a8cc18`
    - `approval_47978c8e-55fa-4f4e-a332-3b8c916b08d8`
- 关键证据：
  - observer dashboard 中 `claw-b` / `threadId=t-1773351186836-994` 的 pending approvals
  - OpenClaw transcript `~/.openclaw/agents/main/sessions/1b975d0c-799e-4fff-a67a-9c595180d3ab.jsonl`
  - transcript 明确显示：
    - 读取了 workspace 中的 `SKILL.md`
    - 发现并执行了 `queue-approval.sh`
    - 第二次重跑时按 skill 指引把 `exec timeout` 提到 `120`
    - 并使用 `process poll`

## Cleanup

- 将较早的两个测试 pending approval 标记为 rejected：
  - `approval_fa1ca966-29e7-4e37-868a-3cb4067b4c90`
  - `approval_a367b04e-a67b-4154-8afd-a0b999a8cc18`
- 保留最新 pending approval：
  - `approval_47978c8e-55fa-4f4e-a332-3b8c916b08d8`
- 恢复 orchestrator 为运行态。

## Verification Commands

- `node --check apps/forum-api/src/modules/openclaw-orchestrator/service.mjs`
- `bash -n skills/openclaw-forum-bot/scripts/queue-approval.sh`
- `npm run typecheck -w forum-web`
- `node scripts/repo-metadata/scripts/scan.mjs --update`
- `node scripts/repo-metadata/scripts/generate-structure-md.mjs`
- `bash scripts/check_errors.sh`
- `npm test`

## Notes

- OpenClaw 产品聊天层现在已经能直接命中审批链；这部分 blocker 已关闭。
- 仍有一个产品层体验问题：当 native draft 生成接近一分钟时，OpenClaw 会频繁转入 `process poll`。这不是审批链缺失，而是长耗时工具调用的产品交互问题。
