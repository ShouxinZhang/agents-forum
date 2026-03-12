# 开发日志 - 分模块依赖计划拆分为目录化子计划

## 1. 用户原始请求
> docs/dev_plan/agents_forum_module_dependency_diagram_plan.md
> 将这个大的PLAN拆分为一个文件夹，里面有多个子PLAN, 含有方框，完成的打勾。

## 2. 轮次摘要
- 目标: 把单个大计划文档拆成一个可持续维护的目录化计划，并给每个子计划加勾选框。
- 核心实施:
  - 保留原 `docs/dev_plan/agents_forum_module_dependency_diagram_plan.md` 作为索引页。
  - 新建 `docs/dev_plan/agents_forum_module_dependency_diagram_plan/` 目录，并按总览、模块图、阶段 A-G 拆分为多个子计划文件。
  - 依据当前仓库实际实现状态，对已完成项打勾，对未完成项保留空框。
  - 通过 `repo-metadata` 手工补齐新目录与新文件的元数据描述，并重生成结构文档。
- 关键判断:
  - 只对已经在代码或回归中确认完成的项打勾，避免把“计划意图”误记成“已完成事实”。
  - 未使用 `scan.mjs --update` 处理这些新文档，因为该脚本按已跟踪路径工作，会误删未提交的新文件元数据。

## 3. 修改时间
- 完成时间: 2026-03-12 00:34:43 +0800
- 时间戳(秒): 1773246883

## 4. 文件清单（路径 / 操作 / 说明）
- `docs/dev_plan/agents_forum_module_dependency_diagram_plan.md` / 更新 / 由大计划改为索引页
- `docs/dev_plan/agents_forum_module_dependency_diagram_plan/00-overview.md` / 新增 / 总览与阶段状态
- `docs/dev_plan/agents_forum_module_dependency_diagram_plan/01-module-map.md` / 新增 / 模块边界与依赖图
- `docs/dev_plan/agents_forum_module_dependency_diagram_plan/02-phase-a-foundation.md` / 新增 / 阶段 A 子计划
- `docs/dev_plan/agents_forum_module_dependency_diagram_plan/03-phase-b-auth.md` / 新增 / 阶段 B 子计划
- `docs/dev_plan/agents_forum_module_dependency_diagram_plan/04-phase-c-forum-read.md` / 新增 / 阶段 C 子计划
- `docs/dev_plan/agents_forum_module_dependency_diagram_plan/05-phase-d-forum-write.md` / 新增 / 阶段 D 子计划
- `docs/dev_plan/agents_forum_module_dependency_diagram_plan/06-phase-e-agent-observer.md` / 新增 / 阶段 E 子计划
- `docs/dev_plan/agents_forum_module_dependency_diagram_plan/07-phase-f-mcp.md` / 新增 / 阶段 F 子计划
- `docs/dev_plan/agents_forum_module_dependency_diagram_plan/08-phase-g-quality.md` / 新增 / 阶段 G 子计划
- `docs/architecture/repo-metadata.json` / 更新 / 补充新计划目录与文件描述
- `docs/architecture/repository-structure.md` / 更新 / 结构树重生成
- `docs/dev_logs/2026-03-12/03-split-module-plan-into-folder.md` / 新增 / 本轮开发日志

## 5. 变更说明（方案、影响范围、风险控制）
- 方案:
  - 用“索引页 + 子计划目录”替代单文件大计划，便于阶段推进时逐个勾选。
  - 子计划按模块和阶段拆分，避免一个文档同时承载结构图、阶段任务和状态追踪。
  - 已完成项的勾选严格依据当前实现状态，而不是按规划预期打勾。
- 影响范围:
  - 仅影响 `docs/dev_plan` 与文档元数据。
  - 不影响前后端运行逻辑。
- 风险控制:
  - 避免运行 `scan.mjs --update` 误删未提交新文档的元数据，改用 `crud.mjs set` 顺序写入。
  - 结构文档与 SQLite 元数据同步在 JSON 校验通过后执行，避免再次写坏 `repo-metadata.json`。

## 6. 验证结果
- `bash scripts/check_errors.sh`：通过（4/4）
- `npm test`：通过（workspaces 下无测试按 `--if-present` 跳过）
- `node -e "JSON.parse(...repo-metadata.json...)"`：通过
- `node scripts/repo-metadata/scripts/generate-structure-md.mjs`：通过
- `node scripts/repo-metadata/scripts/sync-json-to-sqlite.mjs`：通过

## 7. Git 锚点
- branch: `main`
- HEAD: `20b2020e1031f51dbab0053e578921a1d0f7cf50`
- tag: 无
