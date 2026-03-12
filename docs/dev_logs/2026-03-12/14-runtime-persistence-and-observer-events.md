# 14. runtime-persistence-and-observer-events

## 用户原始请求

> 继续工作，直到计划完成, 返回YES, 否则继续工作.

## 轮次记录

- 背景：阶段 `F` 和 `H` 首版已落地，但阶段 `D / E / G` 仍有两个关键缺口：
  - 论坛数据仍是进程内内存态，`forum-api` 重启后丢失
  - Inspector 的 `recentCalls` 仍需要从真实运行事件读取，而不是演示项
- 本轮目标：用最小实现同时推进 `D / E / G`
  - 论坛写入落盘持久化
  - MCP 运行日志写入共享 runtime 文件
  - observer API 读取真实 recent calls
  - 默认联调端口 `4174` 切到新代码

## 修改时间

- 开始：2026-03-12 03:17:52 +0800
- 结束：2026-03-12 03:17:52 +0800

## 文件清单

- `.gitignore`：modified，忽略 `apps/forum-api/.runtime/`。
- `apps/forum-api/src/modules/forum/seed.mjs`：added，论坛初始 seed state。
- `apps/forum-api/src/modules/forum/store.mjs`：added，forum state 文件持久化读写。
- `apps/forum-api/src/modules/forum/data.mjs`：modified，改为基于持久化 store 读写。
- `apps/forum-api/src/modules/forum/routes.mjs`：modified，切换到持久化读写接口，并拒绝 `replyId` 脱离 `floorId` 的非法层级。
- `apps/forum-api/src/modules/agent-observer/runtime-events.mjs`：added，Agent runtime recent calls 的共享 NDJSON store。
- `apps/forum-api/src/modules/agent-observer/data.mjs`：modified，用 runtime recent calls 合并静态 profile 种子。
- `apps/forum-api/src/modules/agent-observer/routes.mjs`：modified，列表接口改为动态构建 profile。
- `apps/forum-api/src/modules/mcp/audit-log.mjs`：modified，支持将 audit entry 持久化为共享 runtime event。
- `apps/forum-api/src/modules/mcp/server.mjs`：modified，支持可选 `agentId`，并把 MCP tool 调用写入 observer runtime event。
- `skills/forum-mcp-smoke/scripts/mcp-smoke.mjs`：modified，新增 `agentId` 支持，并把 `FORUM_API_RUNTIME_DIR` 透传给子进程。
- `skills/forum-mcp-smoke/SKILL.md`：modified，补充持久化和 observer runtime recent calls 校验说明。
- `skills/forum-mcp-smoke/references/current-contract.md`：modified，补充 runtime 一致性契约。
- `docs/dev_plan/agents_forum_module_dependency_diagram_plan.md`：modified，阶段 `D / E` 状态更新为“主干已落地”。
- `docs/dev_plan/agents_forum_module_dependency_diagram_plan/00-overview.md`：modified，回写 forum state 持久化和真实 recent calls。
- `docs/dev_plan/agents_forum_module_dependency_diagram_plan/01-module-map.md`：modified，补充 runtime 文件持久化与 shared runtime event 事实。
- `docs/dev_plan/agents_forum_module_dependency_diagram_plan/05-phase-d-forum-write.md`：modified，勾选持久化与非法层级拒绝。
- `docs/dev_plan/agents_forum_module_dependency_diagram_plan/06-phase-e-agent-observer.md`：modified，勾选真实工具运行事件可追溯。
- `docs/dev_plan/agents_forum_module_dependency_diagram_plan/08-phase-g-quality.md`：modified，风险说明更新为“runtime 文件落盘，非数据库层”。

## 变更说明

### 1. 论坛数据持久化

- 新增 `forum/store.mjs`，将板块和线程状态落盘到 `apps/forum-api/.runtime/forum-state.json`。
- `forum-api` 重启后，帖子和回复可从 runtime 文件读回，不再丢失。
- 这一步先用 runtime 文件完成最小持久化，不提前扩成数据库层。

### 2. observer recent calls 真实化

- 新增 `agent-observer/runtime-events.mjs`，把 MCP tool 运行结果追加到共享 NDJSON 文件。
- observer API 每次读取 profile 时，都会从 runtime event 文件反查 `recentCalls`。
- `recentCalls` 现在能真实显示 `get_forum_page / open_thread / get_replies / reply / get_audit_log` 等实际调用。

### 3. MCP 与 observer 归属打通

- MCP tool 新增可选 `agentId`，用于把运行事件归属到 `Agent A / B / C`。
- `forum-mcp-smoke` 也新增 `--agent-id`，并把 `FORUM_API_RUNTIME_DIR` 透传给 stdio 子进程，避免 MCP 和 observer 写到不同 runtime 目录。

### 4. 默认联调端口切到新代码

- 检查发现 `127.0.0.1:4174` 上跑的是旧 `forum-api` 进程，observer 仍返回演示 recent calls。
- 已停止旧进程并重新启动新代码，当前 `4174` 端口已经承载本轮实现。

## 风险控制

- 当前持久化层仍是 runtime 文件，不是独立数据存储模块或数据库。
- `get_audit_log` 仍以当前 MCP 进程内视图为主；共享 runtime 文件主要服务 observer recent calls。
- `memory` 仍是静态种子数据，尚未接成真实运行记忆流。
- 管理动作、搜索/排序/分页、多 Bot 编排与安全策略仍未落地。

## 验证结果

- `node --check apps/forum-api/src/modules/forum/seed.mjs`：通过
- `node --check apps/forum-api/src/modules/forum/store.mjs`：通过
- `node --check apps/forum-api/src/modules/forum/data.mjs`：通过
- `node --check apps/forum-api/src/modules/agent-observer/runtime-events.mjs`：通过
- `node --check apps/forum-api/src/modules/agent-observer/data.mjs`：通过
- `node --check apps/forum-api/src/modules/forum/routes.mjs`：通过
- `node --check apps/forum-api/src/modules/mcp/audit-log.mjs`：通过
- `node --check apps/forum-api/src/modules/mcp/server.mjs`：通过
- `node --check skills/forum-mcp-smoke/scripts/mcp-smoke.mjs`：通过
- API：`replyId` 脱离 `floorId` 的非法输入返回 `400`
- API：在独立 runtime 目录下创建帖子、重启 `forum-api`、再次读取，帖子仍存在
- `skills/forum-mcp-smoke/scripts/mcp-smoke.sh --origin http://127.0.0.1:4191 --agent-id A --login-user admin --login-password 1234`：通过
- `curl http://127.0.0.1:4191/api/observer/agents/A`：可读取真实 MCP runtime recent calls
- `skills/forum-mcp-smoke/scripts/smoke.sh --origin http://127.0.0.1:4174 --write-smoke --login-user admin --login-password 1234`：通过
- `skills/forum-mcp-smoke/scripts/mcp-smoke.sh --origin http://127.0.0.1:4174 --agent-id A --login-user admin --login-password 1234`：通过
- `curl http://127.0.0.1:4174/api/observer/agents/A`：可读取真实 MCP runtime recent calls
- Playwright：登录 `forum-web` 后打开 `Agent Inspector`，确认 `Recent Calls` 显示真实 MCP 调用而非演示项

## Git 锚点

- branch: `main`
- commit: `20b2020e1031f51dbab0053e578921a1d0f7cf50`
- tag: 无
- backup branch: 无
