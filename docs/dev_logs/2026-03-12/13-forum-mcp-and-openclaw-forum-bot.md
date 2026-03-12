# 13. forum-mcp-and-openclaw-forum-bot

## 用户原始请求

> 继续工作，直到计划完成, 返回YES, 否则继续工作.

## 轮次记录

- 背景：阶段 `B / D / E / J1` 主干已经落地，下一段串行主线是阶段 `F`，并且阶段 `H` 已具备前置条件。
- 本轮目标：先把 forum MCP stdio server 做成真实可调用底座，再把首个 `openclaw-forum-bot` skill 骨架建立起来，让路线图从“计划”推进到“可安装、可启动、可验证”。
- 实施策略：
  - `F` 采用独立 `forum-api/modules/mcp`，通过现有 `forum-api` HTTP 契约收口论坛和 observer 数据访问，避免与 API 进程内状态分叉。
  - `J1` 顺手补齐 `forum-mcp-smoke` 的 MCP stdio smoke 和 `openclaw-forum-bootstrap` 的 `start-mcp.sh`。
  - `H` 新建 `skills/openclaw-forum-bot`，只落 skill 包装层与脚本导航，不提前实现多 Bot 编排。

## 修改时间

- 开始：2026-03-12 03:08:11 +0800
- 结束：2026-03-12 03:08:34 +0800

## 文件清单

- `apps/forum-api/package.json`：modified，新增 `mcp` script，并声明 `@modelcontextprotocol/sdk` / `zod` 依赖。
- `apps/forum-api/src/modules/mcp/config.mjs`：added，forum MCP 配置解析。
- `apps/forum-api/src/modules/mcp/audit-log.mjs`：added，MCP 调用审计与耗时记录。
- `apps/forum-api/src/modules/mcp/forum-client.mjs`：added，通过 HTTP 调 forum / auth / observer API。
- `apps/forum-api/src/modules/mcp/server.mjs`：added，forum MCP stdio server，暴露 `get_forum_page / open_thread / get_replies / reply / get_agent_profile / get_audit_log`。
- `skills/forum-mcp-smoke/SKILL.md`：modified，补充 MCP stdio smoke 入口和定位方式。
- `skills/forum-mcp-smoke/references/current-contract.md`：modified，补充 MCP tools 契约说明。
- `skills/forum-mcp-smoke/scripts/mcp-smoke.mjs`：added，真实 MCP stdio smoke。
- `skills/forum-mcp-smoke/scripts/mcp-smoke.sh`：added，MCP smoke shell 入口。
- `skills/openclaw-forum-bootstrap/SKILL.md`：modified，补充一键启动 forum MCP。
- `skills/openclaw-forum-bootstrap/scripts/status.sh`：modified，把 forum MCP server 文件纳入状态检查。
- `skills/openclaw-forum-bootstrap/scripts/start-mcp.sh`：added，forum MCP 启动脚本。
- `skills/openclaw-forum-bot/SKILL.md`：added，首个 forum skill 包装层入口。
- `skills/openclaw-forum-bot/scripts/bootstrap.sh`：added，安装 skill 到 OpenClaw workspace，并复用 helper bootstrap。
- `skills/openclaw-forum-bot/scripts/start-mcp.sh`：added，复用 helper start-mcp。
- `skills/openclaw-forum-bot/scripts/status.sh`：added，检查 skill / helper / MCP / env 状态。
- `skills/openclaw-forum-bot/scripts/login.sh`：added，验证论坛登录凭据。
- `skills/openclaw-forum-bot/references/forum-actions.md`：added，论坛动作映射。
- `skills/openclaw-forum-bot/references/posting-policy.md`：added，论坛写动作边界。
- `skills/openclaw-forum-bot/references/persona-examples.md`：added，Claw persona 示例。
- `docs/dev_plan/agents_forum_module_dependency_diagram_plan.md`：modified，阶段 F 完成、阶段 H 改为“skill 骨架已落地”。
- `docs/dev_plan/agents_forum_module_dependency_diagram_plan/00-overview.md`：modified，回写 `modules/mcp` 与 `openclaw-forum-bot` 实际状态。
- `docs/dev_plan/agents_forum_module_dependency_diagram_plan/01-module-map.md`：modified，标记 `forum-api/mcp` 已落地。
- `docs/dev_plan/agents_forum_module_dependency_diagram_plan/07-phase-f-mcp.md`：modified，阶段 F 全部勾选。
- `docs/dev_plan/agents_forum_module_dependency_diagram_plan/08-phase-g-quality.md`：modified，更新当前真实风险。
- `docs/dev_plan/agents_forum_module_dependency_diagram_plan/09-phase-h-openclaw-skill.md`：modified，回写 skill 目录与边界项。
- `docs/dev_plan/agents_forum_module_dependency_diagram_plan/10-phase-i-multi-claw-bots.md`：modified，标记前置 `openclaw-forum-bot` 已有。
- `docs/dev_plan/agents_forum_module_dependency_diagram_plan/11-phase-j-skill-dev-and-test.md`：modified，回写 J1 skill 模板与 MCP smoke 进展。
- `docs/architecture/repo-metadata.json`：modified，补充 `modules/mcp`、新增 skill 与脚本元数据。
- `docs/architecture/repository-structure.md`：modified，重生成仓库结构文档。
- `package-lock.json`：modified，`npm install --package-lock-only` 后同步依赖锁。

## 变更说明

### 1. 阶段 F: forum MCP 闭环

- 采用 stdio MCP server，而不是把 MCP 逻辑塞进 HTTP 服务。
- MCP 通过现有 `forum-api` HTTP 契约读写论坛和 observer 数据，避免与 API 进程内状态分叉。
- 每次 MCP tool 调用都记录 `toolName / timestamp / durationMs / status / summary / input`，并通过 `get_audit_log` 回读。
- `forum-mcp-smoke` 新增 client→server→forum-api 的 MCP smoke，验证真实 `reply` 和 `audit`。

### 2. J1 补强

- `openclaw-forum-bootstrap` 现在不止能装 `forum-mcp-smoke`，也能直接启动 forum MCP。
- `forum-mcp-smoke` 现在同时覆盖 HTTP smoke 与 MCP smoke，两条链路可独立定位。

### 3. 阶段 H: `openclaw-forum-bot` 首版骨架

- 新 skill 明确了论坛行为必须遵循 `Feed -> Detail -> Reply`。
- skill 把安装、状态、登录、MCP 启动入口收口到 `scripts/`。
- 写动作策略默认保守：当前仓库中，若用户未明确要求写入，则 skill 默认只读。
- 该 skill 目前是包装层，不代表多 Bot、审批、限流或真实自然语言联调已经完成。

## 风险控制

- forum 数据和 MCP audit 仍是进程内内存态，重启后丢失。
- `openclaw-forum-bot` 目前只有 skill 包装层与脚本导航，尚未完成 OpenClaw 产品内自然语言联调。
- 多 Bot、限流、安全策略、真实 observer runtime 日志仍未落地。

## 验证结果

- `node --check apps/forum-api/src/modules/mcp/server.mjs`：通过
- `node --check apps/forum-api/src/modules/mcp/forum-client.mjs`：通过
- `node --check skills/forum-mcp-smoke/scripts/mcp-smoke.mjs`：通过
- `skills/forum-mcp-smoke/scripts/mcp-smoke.sh --origin http://127.0.0.1:4174 --section-id arena --login-user admin --login-password 1234`：通过
- `skills/openclaw-forum-bootstrap/scripts/status.sh`：通过
- `skills/openclaw-forum-bootstrap/scripts/start-mcp.sh --help`：通过
- `npm run mcp -w forum-api -- --help`：通过
- `skills/openclaw-forum-bot/scripts/status.sh`：通过
- `skills/openclaw-forum-bot/scripts/start-mcp.sh --help`：通过
- `skills/openclaw-forum-bot/scripts/login.sh --user admin --password 1234`：通过
- `OPENCLAW_HOME=$(mktemp -d /tmp/agents-forum-openclaw-bot.XXXXXX) skills/openclaw-forum-bot/scripts/bootstrap.sh`：通过
- `node scripts/repo-metadata/scripts/generate-structure-md.mjs`：通过
- `node scripts/repo-metadata/scripts/sync-json-to-sqlite.mjs`：通过
- `bash scripts/check_errors.sh`：通过
- `npm test`：通过

## Git 锚点

- branch: `main`
- commit: `20b2020e1031f51dbab0053e578921a1d0f7cf50`
- tag: 无
- backup branch: 无
