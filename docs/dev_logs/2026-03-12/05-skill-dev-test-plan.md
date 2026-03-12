# 开发日志 - 将 Skill 开发与测试体系纳入路线图

## 1. 用户原始请求
> 嗯，这些技能的制作，我认为最好也可以做一个开发计划，这些是测试的SKILL dev PLAN, 如我们所知，workflow里开发和测试一样重要.

## 2. 轮次摘要
- 目标: 为论坛 Bot 相关 skill 建立独立的开发与测试计划，而不是只在功能路线里顺带提一句 smoke test。
- 核心实施:
  - 在现有阶段计划中新增阶段 J: `Skill 开发与测试体系`。
  - 明确 skill 开发计划和 skill 测试计划是两条并行主线，都必须进入路线图。
  - 将测试型 skill 也纳入计划：`forum-mcp-smoke`、`openclaw-forum-bootstrap`、`multi-bot-runner`、`forum-audit-viewer`、`bot-content-safety-check`。
  - 把 skill 统一交付标准定义为：`SKILL.md + scripts + references + status + smoke + logs`，避免只交付一份说明文件。

## 3. 修改时间
- 完成时间: 2026-03-12 00:48:10 +0800
- 时间戳(秒): 1773247690

## 4. 文件清单（路径 / 操作 / 说明）
- `docs/dev_plan/agents_forum_module_dependency_diagram_plan.md` / 更新 / 新增阶段 J 链接与状态
- `docs/dev_plan/agents_forum_module_dependency_diagram_plan/00-overview.md` / 更新 / 新增阶段 J 与依赖顺序
- `docs/dev_plan/agents_forum_module_dependency_diagram_plan/11-phase-j-skill-dev-and-test.md` / 新增 / Skill 开发与测试体系子计划
- `docs/architecture/repo-metadata.json` / 更新 / 补充阶段 J 文件元数据
- `docs/architecture/repository-structure.md` / 更新 / 结构树重新生成
- `docs/dev_logs/2026-03-12/05-skill-dev-test-plan.md` / 新增 / 本轮开发日志

## 5. 变更说明（方案、影响范围、风险控制）
- 方案:
  - 将“skill 的开发”和“skill 的测试”从隐含工作提升为显式阶段。
  - 把测试型 skill 单列，避免所有测试都继续依赖人工临时脚本。
  - 让阶段 H/I 与阶段 J 解耦：H/I 负责能力建设，J 负责可测试、可运行、可运维。
- 影响范围:
  - 仅影响 `docs/dev_plan` 路线图与文档元数据。
  - 不影响论坛与 OpenClaw 代码运行。
- 风险控制:
  - 目前所有阶段 J 条目均保持未完成，避免把“计划”误标为“已交付”。
  - 继续使用 `crud.mjs set` 管理新文档元数据，避免 `scan.mjs --update` 对未提交路径的误删。

## 6. 验证结果
- `bash scripts/check_errors.sh`：通过（4/4）
- `npm test`：通过（workspaces 下无测试按 `--if-present` 跳过）
- `node scripts/repo-metadata/scripts/generate-structure-md.mjs`：通过
- `node scripts/repo-metadata/scripts/sync-json-to-sqlite.mjs`：通过

## 7. Git 锚点
- branch: `main`
- HEAD: `20b2020e1031f51dbab0053e578921a1d0f7cf50`
- tag: 无
