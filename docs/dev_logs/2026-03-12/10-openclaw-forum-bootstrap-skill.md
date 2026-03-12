# 开发日志 - openclaw-forum-bootstrap 技能落地

## 用户原始请求

> 继续工作，直到PLAN全部完成

## 轮次背景与意图摘要

- 背景：阶段 `J1` 已落地 `forum-mcp-smoke`，但还缺一个把论坛 smoke 能力接入 OpenClaw workspace 的 bootstrap 工具。
- 本轮目标：继续沿 `J1` 推进，新增 `openclaw-forum-bootstrap`，把“workspace 安装 -> 安装检查 -> 通过 workspace 中的 skill 跑 smoke”这条链路打通。
- 范围控制：
  - 只实现 OpenClaw workspace bootstrap，不提前实现 forum MCP facade、`openclaw-forum-bot`、Bot 登录态或多 Bot 编排。
  - 当前 bootstrap 只安装 `forum-mcp-smoke`，不假装论坛 skill / MCP 已经完成。
  - 同步计划文档、结构元数据与开发日志。

## 修改时间

- 2026-03-12 02:34:25 CST

## 文件清单

- `skills/openclaw-forum-bootstrap/SKILL.md` / 新增 / 2026-03-12 02:34:25 CST / 定义 OpenClaw forum bootstrap skill 的适用场景、边界与工作流
- `skills/openclaw-forum-bootstrap/scripts/bootstrap.sh` / 新增 / 2026-03-12 02:34:25 CST / 将 `forum-mcp-smoke` 安装到 OpenClaw workspace，可选安装后直接运行 smoke
- `skills/openclaw-forum-bootstrap/scripts/install-check.sh` / 新增 / 2026-03-12 02:34:25 CST / 检查 workspace、skills 目录与目标 skill 安装状态
- `skills/openclaw-forum-bootstrap/scripts/status.sh` / 新增 / 2026-03-12 02:34:25 CST / 汇总 bootstrap skill 路径、workspace、Node/curl 与安装检查结果
- `skills/openclaw-forum-bootstrap/scripts/smoke.sh` / 新增 / 2026-03-12 02:34:25 CST / 通过 workspace 中的 `forum-mcp-smoke` 执行论坛读取 smoke
- `skills/openclaw-forum-bootstrap/references/workspace-layout.md` / 新增 / 2026-03-12 02:34:25 CST / 记录当前 OpenClaw workspace 接入布局与能力边界
- `docs/dev_plan/agents_forum_module_dependency_diagram_plan.md` / 更新 / 2026-03-12 02:34:25 CST / 根计划回写 `J1` 的 smoke / bootstrap 首版已落地
- `docs/dev_plan/agents_forum_module_dependency_diagram_plan/00-overview.md` / 更新 / 2026-03-12 02:34:25 CST / 总览回写首个 OpenClaw workspace bootstrap skill 已建立
- `docs/dev_plan/agents_forum_module_dependency_diagram_plan/11-phase-j-skill-dev-and-test.md` / 更新 / 2026-03-12 02:34:25 CST / 勾选 `openclaw-forum-bootstrap`，细化当前已实现范围
- `docs/architecture/repo-metadata.json` / 更新 / 2026-03-12 02:34:25 CST / 手动加入 `skills/openclaw-forum-bootstrap` 元数据节点
- `docs/architecture/repository-structure.md` / 更新 / 2026-03-12 02:34:25 CST / 重新生成目录树，使新 skill 出现在结构文档中
- `docs/dev_logs/2026-03-12/10-openclaw-forum-bootstrap-skill.md` / 新增 / 2026-03-12 02:34:25 CST / 本轮开发日志

## 变更说明

- Skill 设计：
  - `openclaw-forum-bootstrap` 作为 `J1` 的第二个工具型 skill，解决的是 OpenClaw workspace 安装链路，而不是论坛业务能力本身。
  - `bootstrap.sh` 默认把仓库内的 `skills/forum-mcp-smoke` 以符号链接方式安装到 `OPENCLAW_WORKSPACE/skills/forum-mcp-smoke`，也支持 `--copy` 与 `--force`。
  - `install-check.sh` 负责检查 workspace 是否存在、目标 skill 是否安装、目标 `SKILL.md` 和 `scripts/smoke.sh` 是否就位。
  - `smoke.sh` 通过 workspace 里的 `forum-mcp-smoke` 继续执行论坛读链路 smoke，证明 bootstrap 不只是“目录存在”，而是“安装后可用”。
- 业务价值：
  - 现在可以把论坛底座验证与 OpenClaw workspace 接入分层处理。
  - 后面 `openclaw-forum-bot`、forum MCP、多 Bot 编排出问题时，可以先排除“workspace 安装是否正确”。
  - 这降低了后续阶段 `H / I / J2 / J3` 的故障定位成本。
- 路线图回写：
  - 阶段 `J1` 不再只有 `forum-mcp-smoke`，而是已有 `smoke + workspace bootstrap` 两个首版工具。
  - `openclaw-forum-bootstrap` 已从“待规划”改为“已建立”。
  - 文档中保持了边界诚实：当前只安装 `forum-mcp-smoke`，未勾选“启动 forum MCP”。
- 结构同步策略：
  - 本轮再次新增 `skills/` 子目录，按规范必须同步结构文档。
  - 由于当前工作树仍有大量未提交目录，`scan.mjs --update` 依赖 tracked paths，不适合直接运行。
  - 因此继续采用“手动补 `repo-metadata.json` + 运行 `generate-structure-md.mjs`”的安全同步方式。

## 验证结果

- `OPENCLAW_HOME=/tmp/agents-forum-openclaw.csMm95 skills/openclaw-forum-bootstrap/scripts/bootstrap.sh --run-smoke`：通过
  - 已在临时 OpenClaw workspace 中建立 `forum-mcp-smoke` 链接
  - `install-check.sh` 通过
  - 通过 workspace 中的 `forum-mcp-smoke` 成功执行论坛读链路 smoke
- `OPENCLAW_HOME=/tmp/agents-forum-openclaw.csMm95 skills/openclaw-forum-bootstrap/scripts/status.sh`：通过
- `OPENCLAW_HOME=/tmp/agents-forum-openclaw.csMm95 skills/openclaw-forum-bootstrap/scripts/smoke.sh`：通过
- `node scripts/repo-metadata/scripts/generate-structure-md.mjs`：通过
- `bash scripts/check_errors.sh`：通过
- `npm test`：通过

## Git 锚点

- branch: `main`
- commit: `20b2020e1031f51dbab0053e578921a1d0f7cf50`

## 备注

- 当前工作树原本已有论坛代码、计划文档、结构文档、`package-lock.json` 等未提交改动；本轮未回退这些内容。
