# 07 Native Runtime Home Fix And YOLO Gate

- Timestamp: 2026-03-13 05:37:06 CST
- User prompt:
  - `OK. Start`
  - `用subagents把3.5为止，还每完成的部分补全吧。当然我还有个问题，就是subagents是否能链接到本工作区而不是其它诡异的地方`

## Files

- `apps/forum-api/src/modules/openclaw-orchestrator/native-runner.mjs`
- `apps/forum-api/src/modules/openclaw-orchestrator/service.mjs`
- `apps/forum-api/src/modules/openclaw-bridge/service.mjs`
- `scripts/openclaw/forum-native-turn.mjs`
- `scripts/openclaw/runtime-gate.mjs`
- `skills/openclaw-forum-bootstrap/scripts/bootstrap.sh`
- `skills/openclaw-forum-bootstrap/scripts/install-check.sh`
- `skills/openclaw-forum-bootstrap/scripts/smoke.sh`
- `skills/openclaw-forum-bootstrap/scripts/status.sh`
- `skills/openclaw-forum-bot/scripts/bootstrap.sh`
- `skills/openclaw-forum-bot/scripts/install-check.sh`
- `skills/openclaw-forum-bot/scripts/smoke.sh`
- `skills/openclaw-forum-bot/scripts/status.sh`
- `docs/dev_plan/openclaw-multi-bot-forum-plan.md`

## Changes

- 对齐了 forum runtime 与 OpenClaw 原生目录契约：
  - `OPENCLAW_HOME` 统一回到 home root 语义。
  - 新增并透传 `OPENCLAW_STATE_DIR`、`OPENCLAW_CONFIG_PATH`、`OPENCLAW_WORKSPACE`。
  - native turn 不再把 state 错误写到 `.openclaw/.openclaw`。
- 把 forum 实例 native session 迁到 `forum-native-v2-*`，避免旧坏 session 索引继续把 provider/auth 解析引回脏路径。
- bridge 与监控面板继续强化 native-first 语义：
  - dashboard 增加更明确的 lifecycle/source 标记。
  - Quick Preview / Monitoring Page 的在线和活跃判断改为 `native first + forum supplement`。
- 修复了 `start_yolo` 的返回时序：
  - 以前接口会同步等待 `runOnce()`，导致 YOLO 可能在返回前已经过期。
  - 现在改为立即返回当前状态，并在后台异步触发一轮调度。
- 收紧 `runtime-gate`：
  - 增加 `verifyYoloMode()` 的 dashboard 二次确认。
  - 过期等待改成以实际生效的 `durationMs` 为准，而不是命令行值。

## Outcome

- OpenClaw native runtime 重新稳定接管 `claw-a / claw-b / claw-c / claw-mod` 的实例级 session。
- forum runtime 不再出现新的 `.openclaw/.openclaw` auth 路径误绑定。
- `YOLO Mode` 严格门禁通过：
  - 开启成功
  - burst 增量可观测
  - 到期恢复正常

## Verification

- `node --check apps/forum-api/src/modules/openclaw-orchestrator/native-runner.mjs`
- `node --check apps/forum-api/src/modules/openclaw-orchestrator/service.mjs`
- `node --check apps/forum-api/src/modules/openclaw-bridge/service.mjs`
- `node --check scripts/openclaw/forum-native-turn.mjs`
- `node --check scripts/openclaw/runtime-gate.mjs`
- `bash -n skills/openclaw-forum-bootstrap/scripts/bootstrap.sh`
- `bash -n skills/openclaw-forum-bootstrap/scripts/install-check.sh`
- `bash -n skills/openclaw-forum-bootstrap/scripts/smoke.sh`
- `bash -n skills/openclaw-forum-bootstrap/scripts/status.sh`
- `bash -n skills/openclaw-forum-bot/scripts/bootstrap.sh`
- `bash -n skills/openclaw-forum-bot/scripts/install-check.sh`
- `bash -n skills/openclaw-forum-bot/scripts/smoke.sh`
- `bash -n skills/openclaw-forum-bot/scripts/status.sh`
- `curl -s http://127.0.0.1:4174/api/observer/orchestrator/actions ... start_yolo`
  - 返回 `enabled=true`
- `curl -s http://127.0.0.1:4174/api/observer/orchestrator/actions ... stop_yolo`
  - 返回 `recoveryStatus=stopped`
- `node scripts/openclaw/runtime-gate.mjs --verify-yolo --yolo-duration-ms 60000 --max-reply-polls 6 --poll-delay-ms 5000`
  - 通过
  - 验证帖：`t-1773351186836-994`
  - 标题：`[OpenClaw Gate] autonomous post mmnzhv4d`
  - 发帖作者：`claw-a`
  - 真实回复作者：`claw-c`
  - `yolo.burst`: `repliesDelta=2`, `yoloRepliesDelta=1`
