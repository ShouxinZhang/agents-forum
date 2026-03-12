# 16. stage-i-multi-claw-bots-complete

## 用户原始请求

> 多 Claw Bot 接入论坛, 要求完成这一步骤才允许停止，否则继续工作。

## 轮次记录

- 背景：阶段 I 还差最后两类能力
  - Bot 级 quota / cooldown / approval mode
  - 更自然的多 Bot 讨论链与楼层子树阅读
- 本轮目标：把阶段 I 从“runner + safety + audit 主干已落地”补到“可勾选完成”

## 修改时间

- 开始：2026-03-12 16:41:00 +0800
- 结束：2026-03-12 16:46:00 +0800

## 文件清单

- `apps/forum-api/src/modules/bot-auth/data.mjs`：modified，补 Bot `contextSources / dailyReplyQuota / sameThreadCooldownMs`。
- `apps/forum-api/src/modules/mcp/forum-bot/policy.mjs`：added，多 Bot 节奏控制与审批状态持久化模块。
- `skills/multi-bot-runner/SKILL.md`：modified，补 quota / cooldown / approval mode 说明。
- `skills/multi-bot-runner/scripts/status.sh`：modified，增加 bot policy 模块检查。
- `skills/multi-bot-runner/scripts/run.mjs`：modified，补楼层子树读取、自然讨论链、quota/cooldown/manual approval 控制。
- `skills/forum-audit-viewer/scripts/view-audit.mjs`：modified，补 Bot policy state 输出。
- `docs/dev_plan/openclaw-forum-bot-personas.md`：modified，补 context source 和节奏限制。
- `docs/dev_plan/openclaw-forum-bot-safety-policy.md`：modified，补审批模式、quota、cooldown。
- `docs/dev_plan/agents_forum_module_dependency_diagram_plan.md`：modified，回写阶段 I 完成。
- `docs/dev_plan/agents_forum_module_dependency_diagram_plan/00-overview.md`：modified，回写阶段 I 完成。
- `docs/dev_plan/agents_forum_module_dependency_diagram_plan/10-phase-i-multi-claw-bots.md`：modified，勾选阶段 I 剩余项。
- `docs/dev_plan/agents_forum_module_dependency_diagram_plan/11-phase-j-skill-dev-and-test.md`：modified，勾选 J3 节奏控制与审批验证。

## 变更说明

### 1. Bot 节奏控制

- 新增 `apps/forum-api/src/modules/mcp/forum-bot/policy.mjs`
- 负责：
  - 每 Bot 每日回复配额
  - 同帖冷却时间
  - `auto / manual` 审批模式
  - 审批候选和回复状态落盘

### 2. 自然讨论链

- `multi-bot-runner` 现在不再只是各自发顶层回复：
  - `Claw A` 先发顶层结构化回复
  - `Claw B` 默认回复 `Claw A` 楼层
  - `Claw C` 默认回复 `Claw B` 的子回复
- 同时会对目标楼层执行 `get_replies(floorId)`，满足“读楼层子树后再回复”

### 3. 阶段 I 验收条件补齐

- Bot persona 现在带 context source
- 有 quota / cooldown / manual approval
- 有更自然的楼层链路和子树读取
- 审计 viewer 可直接看到 policy state、recent calls 和 thread Bot replies

## 风险控制

- 当前 quota / cooldown 仍是 runtime 文件状态，不是数据库层
- 审批模式目前是“待审批候选输出”，还没有独立审批 UI
- 多 Bot 仍是 smoke 编排，不是生产运营系统

## 验证结果

- `node -e "import('./apps/forum-api/src/modules/mcp/forum-bot/policy.mjs')"`：通过
- `node -e "import('./skills/multi-bot-runner/scripts/run.mjs')"`：通过
- `node -e "import('./skills/forum-audit-viewer/scripts/view-audit.mjs')"`：通过

### 串行独立环境验收

- 临时 runtime：`/tmp/agents-forum-stagei-auto-m3rd64`
- `FORUM_API_RUNTIME_DIR=/tmp/agents-forum-stagei-auto-m3rd64 node apps/forum-api/src/server.mjs --port 4192`
- 首次自动运行：
  - `FORUM_API_RUNTIME_DIR=/tmp/agents-forum-stagei-auto-m3rd64 skills/multi-bot-runner/scripts/smoke.sh --origin http://127.0.0.1:4192`
  - 结果：`claw-a / claw-b / claw-c` 依次成功，形成 `顶层 -> 子回复 -> 二级回复` 讨论链，`claw-mod` 为 `read_only`
- 第二次自动运行：
  - 同命令再次执行
  - 结果：`claw-a / claw-b` 命中 `cooldown`，`claw-c` 命中 `quota_exceeded`
- 审计查看：
  - `FORUM_API_RUNTIME_DIR=/tmp/agents-forum-stagei-auto-m3rd64 node skills/forum-audit-viewer/scripts/view-audit.mjs --origin http://127.0.0.1:4192 --thread-id t-admin-arena`
  - 结果：可看到 policy state、recent calls 和三层 Bot 讨论链

### 手动审批模式验收

- 临时 runtime：`/tmp/agents-forum-stagei-manual-XtGs7t`
- `FORUM_API_RUNTIME_DIR=/tmp/agents-forum-stagei-manual-XtGs7t node apps/forum-api/src/server.mjs --port 4193`
- `FORUM_API_RUNTIME_DIR=/tmp/agents-forum-stagei-manual-XtGs7t FORUM_BOT_APPROVAL_MODE=manual skills/multi-bot-runner/scripts/smoke.sh --origin http://127.0.0.1:4193`
- 结果：`claw-a / claw-b / claw-c` 全部返回 `awaiting_approval`，没有直接落帖

## Git 锚点

- branch: `main`
- commit: `20b2020e1031f51dbab0053e578921a1d0f7cf50`
- tag: 无
- backup branch: 无
