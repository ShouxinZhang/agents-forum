# 开发日志 - 论坛写接口主干与 Observer API 化

## 用户原始请求

> 继续工作，直到计划完成, 返回YES, 否则继续工作.

## 轮次背景与意图摘要

- 背景：阶段 `B` 的后端 session 已落地，论坛读取链路已完成 Feed / Detail 重构，`J1` 也已有 `forum-mcp-smoke` 和 `openclaw-forum-bootstrap`。
- 本轮目标：
  - 继续推进阶段 `D`，把发帖 / 回帖迁移到 `forum-api` 写接口，并挂上 session 保护
  - 顺手升级 `forum-mcp-smoke`，让它默认检查未登录写入拒绝，并支持可选真实写入 smoke
  - 继续推进阶段 `E`，把 Inspector 从前端静态数据改成后端 observer API 驱动
- 范围控制：
  - 阶段 `D` 当前只做到服务端内存持久化，不引入数据库
  - 阶段 `E` 当前 recent calls 仍是演示数据，不是假实时运行日志
  - 继续保持最小接口面，不提前进入 MCP facade 和多 Bot 编排

## 修改时间

- 2026-03-12 02:53:31 CST

## 文件清单

- `apps/forum-api/src/modules/forum/data.mjs` / 更新 / 2026-03-12 02:53:31 CST / 新增线程创建、回复写入与内存写辅助逻辑
- `apps/forum-api/src/modules/forum/routes.mjs` / 更新 / 2026-03-12 02:53:31 CST / 新增 `POST /api/forum/threads` 与 `POST /api/forum/replies`，并接入 session 校验
- `apps/forum-web/src/modules/forum/api.ts` / 更新 / 2026-03-12 02:53:31 CST / 新增前端发帖与回帖 API client
- `apps/forum-web/src/App.tsx` / 更新 / 2026-03-12 02:53:31 CST / 将发帖 / 回帖改为走后端写接口，增加提交态与 session 失效处理
- `skills/forum-mcp-smoke/SKILL.md` / 更新 / 2026-03-12 02:53:31 CST / 补充未登录写保护与可选写 smoke 说明
- `skills/forum-mcp-smoke/references/current-contract.md` / 更新 / 2026-03-12 02:53:31 CST / 回写默认写保护校验和可选写链路 smoke 契约
- `skills/forum-mcp-smoke/scripts/smoke.mjs` / 更新 / 2026-03-12 02:53:31 CST / 新增未登录写接口拒绝校验与可选真实写入 smoke
- `apps/forum-api/src/modules/agent-observer/data.mjs` / 新增 / 2026-03-12 02:53:31 CST / 新增 Agent profile、memory timeline、recent calls 后端数据
- `apps/forum-api/src/modules/agent-observer/routes.mjs` / 新增 / 2026-03-12 02:53:31 CST / 新增 `/api/observer/agents` 与 `/api/observer/agents/:agentId`
- `apps/forum-api/src/server.mjs` / 更新 / 2026-03-12 02:53:31 CST / 挂载 observer API
- `apps/forum-web/src/modules/agent-observer/api.ts` / 新增 / 2026-03-12 02:53:31 CST / 新增前端 observer API client
- `apps/forum-web/src/modules/agent-observer/types.ts` / 新增 / 2026-03-12 02:53:31 CST / 新增前端 observer profile / memory / call 类型
- `apps/forum-web/src/modules/agent-observer/components/inspector-panel.tsx` / 更新 / 2026-03-12 02:53:31 CST / 改为展示 API 驱动的 memory timeline 与 recent calls
- `docs/dev_plan/agents_forum_module_dependency_diagram_plan.md` / 更新 / 2026-03-12 02:53:31 CST / 根计划回写阶段 D/E 的主干落地状态
- `docs/dev_plan/agents_forum_module_dependency_diagram_plan/00-overview.md` / 更新 / 2026-03-12 02:53:31 CST / 总览回写 forum 写链路与 observer API 已落地主干
- `docs/dev_plan/agents_forum_module_dependency_diagram_plan/01-module-map.md` / 更新 / 2026-03-12 02:53:31 CST / 模块图回写 `forum-api/agent-observer`
- `docs/dev_plan/agents_forum_module_dependency_diagram_plan/05-phase-d-forum-write.md` / 更新 / 2026-03-12 02:53:31 CST / 勾选写接口、写后回读与详情回复主干
- `docs/dev_plan/agents_forum_module_dependency_diagram_plan/06-phase-e-agent-observer.md` / 更新 / 2026-03-12 02:53:31 CST / 勾选 observer API 与前端 API 驱动主干
- `docs/dev_plan/agents_forum_module_dependency_diagram_plan/11-phase-j-skill-dev-and-test.md` / 更新 / 2026-03-12 02:53:31 CST / 回写 `forum-mcp-smoke` 已覆盖写保护与可选写 smoke
- `docs/architecture/repo-metadata.json` / 更新 / 2026-03-12 02:53:31 CST / 手动加入 observer API 相关新节点，并更新 forum 路由描述
- `docs/architecture/repository-structure.md` / 更新 / 2026-03-12 02:53:31 CST / 重新生成目录树
- `docs/dev_logs/2026-03-12/12-forum-write-and-observer-api.md` / 新增 / 2026-03-12 02:53:31 CST / 本轮开发日志

## 变更说明

- 阶段 D：论坛写接口主干
  - 后端新增：
    - `POST /api/forum/threads`
    - `POST /api/forum/replies`
  - 两个接口都要求 Bearer session，未登录时返回 `401 Unauthorized`
  - 当前写入目标是 `forum-api` 进程内内存数据，因此：
    - 页面刷新后仍可从后端读回
    - 但后端进程重启后数据会丢失
  - 前端发帖后会直接跳到独立详情页，回帖后只更新当前详情与摘要计数
- 阶段 J1：forum smoke 升级
  - 默认 smoke 现在会额外验证：
    - 未登录发帖被拒绝
    - 未登录回帖被拒绝
  - 可选写 smoke 通过 `--write-smoke --login-user --login-password` 开启：
    - 登录
    - 发帖
    - 回帖
    - 写后回读
  - 这让 `forum-mcp-smoke` 从纯读底座，升级为“读 + 写保护 + 可选写链路”验证工具
- 阶段 E：Inspector API 化
  - 后端新增 observer 模块，提供 Agent profile、memory timeline、recent calls
  - 前端 Inspector 改为请求 `/api/observer/agents`
  - 当前 `recent calls` 仍是演示数据，业务价值在于：
    - 观察入口已经 API 化
    - memory 与 recent calls 的结构已经固定
    - 后续接真实 skill / MCP / Bot 行为日志时，不需要再改 UI 骨架
- 环境处理
  - 阶段 D 联调时和阶段 E 联调时，都发现 `127.0.0.1:4174` 上仍在跑旧版 `forum-api`
  - 两次都通过重启 API 进程切到新代码后，再继续做 API 与浏览器回归

## 验证结果

- API 写链路：
  - 登录后 `POST /api/forum/threads`：通过
  - 登录后 `POST /api/forum/replies`：通过
  - 创建后 `GET /api/forum/threads/:threadId`：通过
  - 未登录发帖 / 回帖：均返回 `401 Unauthorized`
- 浏览器回归：
  - 登录后点击“新建帖子”，发帖后进入独立详情页：通过
  - 在详情页发布回复：通过
  - 刷新详情页后，新帖与新回复仍可从后端读回：通过
  - 打开 `Agent Inspector` 后，可看到 API 驱动的 memory timeline 与 recent calls：通过
- Smoke：
  - `skills/forum-mcp-smoke/scripts/smoke.sh`：通过，默认读链路 + 写保护检查通过
  - `skills/forum-mcp-smoke/scripts/smoke.sh --write-smoke --login-user admin --login-password 1234`：通过
- Observer API：
  - `GET /api/observer/agents`：通过
  - `GET /api/observer/agents/A`：通过
- 语法与门禁：
  - `node --check apps/forum-api/src/modules/forum/routes.mjs`：通过
  - `node --check apps/forum-api/src/modules/forum/data.mjs`：通过
  - `node --check apps/forum-api/src/modules/agent-observer/routes.mjs`：通过
  - `node --check apps/forum-api/src/modules/agent-observer/data.mjs`：通过
  - `bash scripts/check_errors.sh`：通过
  - `npm test`：通过

## Git 锚点

- branch: `main`
- commit: `20b2020e1031f51dbab0053e578921a1d0f7cf50`

## 备注

- 当前工作树原本已有论坛代码、计划文档、结构文档、`package-lock.json` 等未提交改动；本轮未回退这些内容。
