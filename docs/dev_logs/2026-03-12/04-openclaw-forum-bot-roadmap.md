# 开发日志 - 在路线图中接入 OpenClaw Forum Skill 与多 Claw Bot

## 1. 用户原始请求
> 嗯, /home/wudizhe001/Documents/GitHub/openclaw-test实现了基于CodeX CLI的OpenClaw AI Bot
> 现在，我们需要在目前的路线图上，接入如何将多Claw Bot接入我们的论坛，让它们能够看论坛，水论坛
> 当然我们知道，首先我们需要制作一个很好的SKILL, 就像是xiaohongshu SKILL那样

## 2. 轮次摘要
- 目标: 把 `openclaw-test` 的 OpenClaw/XHS 经验接入当前论坛路线图，明确“先做论坛 skill，再接多 Claw Bot”的顺序。
- 核心实施:
  - 使用 `skill-creator` 视角，先对齐 skill 的职责边界：`SKILL.md + scripts + MCP` 的包装层，而不是直接把论坛业务塞进 Bot。
  - 读取 `openclaw-test` 的 `README`、`openclaw-xhs` 研究文档和本地技能目录，提炼可复用模式。
  - 在现有分阶段路线图中新增阶段 H: `OpenClaw Forum Skill`，以及阶段 I: `多 Claw Bot 接入论坛`。
  - 更新总索引、总览和模块图，把 `openclaw/forum-skill` 与 `openclaw/multi-bot-orchestrator` 纳入依赖图。

## 3. 修改时间
- 完成时间: 2026-03-12 00:43:54 +0800
- 时间戳(秒): 1773247434

## 4. 文件清单（路径 / 操作 / 说明）
- `docs/dev_plan/agents_forum_module_dependency_diagram_plan.md` / 更新 / 新增阶段 H/I 链接与总览状态
- `docs/dev_plan/agents_forum_module_dependency_diagram_plan/00-overview.md` / 更新 / 新增阶段 H/I 总览与依赖顺序
- `docs/dev_plan/agents_forum_module_dependency_diagram_plan/01-module-map.md` / 更新 / 模块图加入 `openclaw/forum-skill` 与 `multi-claw-bot orchestrator`
- `docs/dev_plan/agents_forum_module_dependency_diagram_plan/09-phase-h-openclaw-skill.md` / 新增 / OpenClaw Forum Skill 子计划
- `docs/dev_plan/agents_forum_module_dependency_diagram_plan/10-phase-i-multi-claw-bots.md` / 新增 / 多 Claw Bot 接入论坛子计划
- `docs/architecture/repo-metadata.json` / 更新 / 补充新子计划文件元数据
- `docs/architecture/repository-structure.md` / 更新 / 结构树重新生成
- `docs/dev_logs/2026-03-12/04-openclaw-forum-bot-roadmap.md` / 新增 / 本轮开发日志

## 5. 变更说明（方案、影响范围、风险控制）
- 方案:
  - 先在路线图中固化“Skill-first”顺序，再谈多 Bot 接入。
  - 对标 `openclaw-xhs`，把论坛 Skill 定位为 OpenClaw workspace 里的 skill 包装层，主要职责是触发语义、边界约束、脚本导航和底层 MCP 依赖说明。
  - 把多 Bot 路线单独拆成下一阶段，避免把“单 Bot Skill 建设”和“多 Bot 编排/节流/灌水策略”混在一个计划里。
- 影响范围:
  - 仅影响 `docs/dev_plan` 路线图与文档元数据。
  - 不影响论坛前后端运行逻辑。
- 风险控制:
  - 已明确：多 Claw Bot 不应直接绕过 forum skill 访问业务数据，应统一通过 MCP/脚本层收口。
  - 已明确：Bot 灌水必须附带配额、冷却、黑名单、重复检测和审计要求。
  - 未把尚未实现的论坛写接口或 Bot 账号体系误标为完成。

## 6. 外部参考结论（来自 openclaw-test）
- `openclaw-xhs` 更像是“放在 OpenClaw workspace 里的 skill 目录”，而不是 OpenClaw 核心模块。
- `SKILL.md` 的核心职责是：适用场景、触发示例、脚本/MCP 导航。
- 真正连业务系统的通常是底层 MCP 与脚本，而不是 skill 本身。
- 对论坛 Bot 来说，最合理路径同样是：
  1. skill 目录包装层
  2. 底层 forum MCP / forum API
  3. Bot persona / 节流 / 安全策略

## 7. 验证结果
- `bash scripts/check_errors.sh`：通过（4/4）
- `npm test`：通过（workspaces 下无测试按 `--if-present` 跳过）
- `node -e "JSON.parse(...repo-metadata.json...)"`：通过
- `node scripts/repo-metadata/scripts/generate-structure-md.mjs`：通过
- `node scripts/repo-metadata/scripts/sync-json-to-sqlite.mjs`：通过

## 8. Git 锚点
- branch: `main`
- HEAD: `20b2020e1031f51dbab0053e578921a1d0f7cf50`
- tag: 无
