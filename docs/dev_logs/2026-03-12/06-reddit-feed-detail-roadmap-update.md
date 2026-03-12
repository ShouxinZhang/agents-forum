# 开发日志 - Reddit 式 Feed/详情路线图重排

## 用户原始请求

> 对，计划还要再变化一下，如图，我想把这种所有内容在一个page里的模式改为类似于reddit, 首页仅仅展示帖子标题，点击才会加载内容
>
> 全部用推荐

## 轮次背景与意图摘要

- 背景：现有论坛路线图仍默认“列表 + 正文同页展示”的单页模式，这与用户期望的 Reddit 式信息架构不一致。
- 本轮目标：将计划重定义为“首页 Feed 摘要列表 + 独立帖子详情页 + 点击后懒加载正文”，并把该变化同步到论坛读写阶段、OpenClaw forum skill、多 Bot 接入和 skill 测试计划。
- 关键决策：采用推荐项作为默认方案，即独立详情路由、首页卡片展示标题/摘要/作者时间/标签/回复数、详情页保留左侧板块导航、路线图按 Feed/详情/API/Bot 流程一起重构。

## 修改时间

- 2026-03-12 01:12:15 CST

## 文件清单

- `docs/dev_plan/agents_forum_module_dependency_diagram_plan.md` / 更新 / 2026-03-12 01:12:15 CST / 调整总入口状态，新增 Reddit 式 Feed/详情子计划索引
- `docs/dev_plan/agents_forum_module_dependency_diagram_plan/00-overview.md` / 更新 / 2026-03-12 01:12:15 CST / 将阶段 C 重定义为 Feed/详情读架构，回写阶段状态
- `docs/dev_plan/agents_forum_module_dependency_diagram_plan/01-module-map.md` / 更新 / 2026-03-12 01:12:15 CST / 补充前后端 Feed/Detail 模块边界与依赖图
- `docs/dev_plan/agents_forum_module_dependency_diagram_plan/04-phase-c-forum-read.md` / 更新 / 2026-03-12 01:12:15 CST / 将论坛读能力改为摘要列表 + 详情懒加载模型
- `docs/dev_plan/agents_forum_module_dependency_diagram_plan/05-phase-d-forum-write.md` / 更新 / 2026-03-12 01:12:15 CST / 将发帖入口固定在 Feed 页，回复入口收口到详情页
- `docs/dev_plan/agents_forum_module_dependency_diagram_plan/09-phase-h-openclaw-skill.md` / 更新 / 2026-03-12 01:12:15 CST / Skill 路径改为 Feed -> Detail -> Reply
- `docs/dev_plan/agents_forum_module_dependency_diagram_plan/10-phase-i-multi-claw-bots.md` / 更新 / 2026-03-12 01:12:15 CST / 多 Bot 看帖链路改为先看摘要再点详情
- `docs/dev_plan/agents_forum_module_dependency_diagram_plan/11-phase-j-skill-dev-and-test.md` / 更新 / 2026-03-12 01:12:15 CST / Skill 测试补充 Feed 与详情的分层验证
- `docs/dev_plan/agents_forum_module_dependency_diagram_plan/12-reddit-feed-and-detail.md` / 新增 / 2026-03-12 01:12:15 CST / 新增 Reddit 式 Feed/详情专项子计划
- `docs/architecture/repo-metadata.json` / 更新 / 2026-03-12 01:12:15 CST / 补回被 `scan.mjs --update` 误删的未跟踪路径元数据，并登记新计划文件
- `docs/architecture/repository-structure.md` / 更新 / 2026-03-12 01:12:15 CST / 按修复后的元数据重新生成结构树
- `docs/dev_logs/2026-03-12/06-reddit-feed-detail-roadmap-update.md` / 新增 / 2026-03-12 01:12:15 CST / 本轮开发日志

## 变更说明

- 路线图层面：
  - 将“论坛读能力已完成”的旧结论回退为过渡态，明确阶段 C 仍未完成，因为当前实现仍是单页列表 + 正文同屏。
  - 新增一份跨阶段子计划，专门锁定 Reddit 式 Feed/详情信息架构，避免后续各阶段各自理解。
- Bot / Skill 层面：
  - 将 OpenClaw forum skill 和多 Bot 的阅读路径统一为 `Feed 摘要 -> 帖子详情 -> 回复决策`。
  - 明确禁止仅凭首页摘要直接回复，避免“看论坛”和“水论坛”逻辑失真。
- 结构同步层面：
  - `node scripts/repo-metadata/scripts/scan.mjs --update` 会按当前 Git 跟踪集扫描；由于当前工作树中已有一批尚未纳入 Git 跟踪的模块化文件和计划文件，它们被误判为删除并从元数据移除。
  - 本轮已采用最小修复方式，将这些真实存在的路径节点手工补回 `repo-metadata.json`，再重新生成结构文档与 SQLite 同步，避免结构文档丢失上下文。

## 验证结果

- `bash scripts/check_errors.sh`：通过
- `npm test`：通过
- `node -e "JSON.parse(require('fs').readFileSync('docs/architecture/repo-metadata.json','utf8'))"`：通过
- `node scripts/repo-metadata/scripts/generate-structure-md.mjs`：通过
- `node scripts/repo-metadata/scripts/sync-json-to-sqlite.mjs`：通过

## Git 锚点

- branch: `main`
- commit: `20b2020e1031f51dbab0053e578921a1d0f7cf50`

