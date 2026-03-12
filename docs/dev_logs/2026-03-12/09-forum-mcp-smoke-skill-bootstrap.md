# 开发日志 - forum-mcp-smoke 技能落地

## 用户原始请求

> 继续工作

## 轮次背景与意图摘要

- 背景：路线图已重构为“串行主线 + 并行副线 + J1/J2/J3”，其中阶段 `J1` 明确可以前置。
- 本轮目标：按新路线继续推进 `J1`，先落第一个测试型 skill `forum-mcp-smoke`，把论坛读取底座做成可重复验证的 smoke 基线。
- 范围控制：
  - 只实现 `forum-mcp-smoke` 的最小可用版本，不提前实现论坛 MCP、本地写接口或 OpenClaw forum skill。
  - smoke 当前仅覆盖论坛 HTTP 读取链路；写接口、MCP、Bot 登录态留给后续阶段。
  - 需要同步计划文档、结构元数据与开发日志，保证这次新增目录不会成为“只有文件没有路线状态”的孤岛。

## 修改时间

- 2026-03-12 02:18:51 CST

## 文件清单

- `skills/forum-mcp-smoke/SKILL.md` / 新增 / 2026-03-12 02:18:51 CST / 定义 J1 阶段 smoke skill 的用途、边界、使用方式
- `skills/forum-mcp-smoke/scripts/status.sh` / 新增 / 2026-03-12 02:18:51 CST / 检查 skill 路径、Node、forum-api 健康状态与 smoke 入口
- `skills/forum-mcp-smoke/scripts/smoke.sh` / 新增 / 2026-03-12 02:18:51 CST / shell 入口，统一转发到 Node smoke 脚本
- `skills/forum-mcp-smoke/scripts/smoke.mjs` / 新增 / 2026-03-12 02:18:51 CST / 对论坛读取契约做结构化 smoke 校验并返回 JSON 结果
- `skills/forum-mcp-smoke/references/current-contract.md` / 新增 / 2026-03-12 02:18:51 CST / 记录当前 smoke 覆盖的论坛 API 契约和边界
- `docs/dev_plan/agents_forum_module_dependency_diagram_plan.md` / 更新 / 2026-03-12 02:18:51 CST / 回写根计划中 `J1` 已启动、首个 smoke 已落地
- `docs/dev_plan/agents_forum_module_dependency_diagram_plan/00-overview.md` / 更新 / 2026-03-12 02:18:51 CST / 回写首个 J1 smoke 基线已建立
- `docs/dev_plan/agents_forum_module_dependency_diagram_plan/07-phase-f-mcp.md` / 更新 / 2026-03-12 02:18:51 CST / 补充 J1 先提供 HTTP 级 smoke 底座
- `docs/dev_plan/agents_forum_module_dependency_diagram_plan/11-phase-j-skill-dev-and-test.md` / 更新 / 2026-03-12 02:18:51 CST / 勾选 `forum-mcp-smoke` 与首个 smoke baseline
- `docs/architecture/repo-metadata.json` / 更新 / 2026-03-12 02:18:51 CST / 手动加入 `skills/forum-mcp-smoke` 元数据节点
- `docs/architecture/repository-structure.md` / 更新 / 2026-03-12 02:18:51 CST / 重新生成目录树，使新 skill 出现在结构文档中
- `docs/dev_logs/2026-03-12/09-forum-mcp-smoke-skill-bootstrap.md` / 新增 / 2026-03-12 02:18:51 CST / 本轮开发日志

## 变更说明

- Skill 落地策略：
  - 采用“先 HTTP、后 MCP”的 J1 实现方式。
  - 当前 skill 名称仍保持 `forum-mcp-smoke`，但实际模式明确标识为 `forum-http-read-smoke`，避免误导为“论坛 MCP 已完成”。
  - 这样做的业务价值是先把论坛底座的可用性单独验证出来，后续 OpenClaw skill / MCP / 多 Bot 出现异常时，能先排除论坛 API 是否正常。
- Skill 目录设计：
  - `SKILL.md` 负责说明何时使用、覆盖范围、当前边界与推荐工作流。
  - `scripts/status.sh` 负责最小状态检查。
  - `scripts/smoke.mjs` 负责真实的结构化 smoke 验证，检查：
    - `/api/health`
    - `/api/forum/bootstrap`
    - `/api/forum/sections`
    - `/api/forum/threads?sectionId=<id>`
    - `/api/forum/threads/:threadId`
  - `references/current-contract.md` 负责沉淀当前契约，避免把细节全塞进 `SKILL.md`。
- 契约验证逻辑：
  - `bootstrap` 必须返回轻量 sections，并带 `threadCount`
  - `threads` 必须返回 Feed 摘要，且不包含 `floors`
  - `thread detail` 必须返回 `floors`
  - smoke 输出结构化 JSON，便于后续给 CI、skill、bootstrap 工具复用
- 路线图回写：
  - 阶段 `J1` 的“首个 forum smoke baseline”已标记落地
  - `forum-mcp-smoke` 已从“待规划”改为“已建立”
  - 阶段 `F` 明确说明：在真正的 forum MCP 之前，已有 J1 的 HTTP smoke 做读链路兜底
- 结构同步策略：
  - 本轮新增了 `skills/forum-mcp-smoke` 目录，触发结构同步要求
  - 但仓库当前存在大量未提交的新目录，`scan.mjs --update` 依赖 tracked paths，会把现有手工维护的未提交节点误判为删除
  - 因此本轮采用“手动补 `repo-metadata.json` + 运行 `generate-structure-md.mjs`”的安全同步方式，避免再次破坏结构文档
- 验证过程中的一次实际问题：
  - 首次并行执行 `chmod` 与 `status.sh` 时触发了权限竞态，导致 `status.sh` 返回 `Permission denied`
  - 顺序复跑后确认脚本本身可正常执行，问题不在 skill 实现

## 验证结果

- `skills/forum-mcp-smoke/scripts/status.sh`：通过
  - skill 路径、Node、`/api/health`、`smoke.sh` 入口均可用
- `skills/forum-mcp-smoke/scripts/smoke.sh`：通过
  - `health`、`bootstrap`、`sections`、`threads`、`thread-detail` 全部通过
  - 结果以结构化 JSON 返回
- `node scripts/repo-metadata/scripts/generate-structure-md.mjs`：通过
  - `repository-structure.md` 已显示 `skills/forum-mcp-smoke`
- `bash scripts/check_errors.sh`：通过
- `npm test`：通过

## Git 锚点

- branch: `main`
- commit: `20b2020e1031f51dbab0053e578921a1d0f7cf50`

## 备注

- 当前工作树原本已有论坛代码、计划文档、结构文档和 `package-lock.json` 的未提交改动；本轮未回退这些内容。
