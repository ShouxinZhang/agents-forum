# 19. move-remaining-dev-plans-to-old

## 用户原始请求

> 其它计划迁移到old里

## 轮次记录

- 背景：
  - 上一轮已经新增了 `openclaw-multi-bot-forum-plan.md` 作为新的最高优先级主计划。
  - `docs/dev_plan/` 下仍残留一组旧计划：模块依赖总计划及其子计划、persona 文档、安全策略文档。
  - 用户要求将其它计划一并迁移到 `old/`，让当前入口只保留新主计划和归档目录。
- 本轮目标：
  - 将剩余历史计划整体迁移到 `docs/dev_plan/old/`。
  - 修正新主计划和归档文档中的引用，避免路径失效。
  - 同步仓库结构文档和开发日志。

## 修改时间

- 开始：2026-03-12 18:18:10 +0800
- 结束：2026-03-12 18:18:10 +0800

## 文件清单

- `docs/dev_plan/old/agents_forum_module_dependency_diagram_plan.md` / 移动并更新 / 2026-03-12 18:18:10 +0800 / 归档模块依赖总计划，并修正说明和子计划链接
- `docs/dev_plan/old/agents_forum_module_dependency_diagram_plan/00-overview.md` / 移动 / 2026-03-12 18:18:10 +0800 / 归档子计划
- `docs/dev_plan/old/agents_forum_module_dependency_diagram_plan/01-module-map.md` / 移动 / 2026-03-12 18:18:10 +0800 / 归档子计划
- `docs/dev_plan/old/agents_forum_module_dependency_diagram_plan/02-phase-a-foundation.md` / 移动 / 2026-03-12 18:18:10 +0800 / 归档子计划
- `docs/dev_plan/old/agents_forum_module_dependency_diagram_plan/03-phase-b-auth.md` / 移动 / 2026-03-12 18:18:10 +0800 / 归档子计划
- `docs/dev_plan/old/agents_forum_module_dependency_diagram_plan/04-phase-c-forum-read.md` / 移动 / 2026-03-12 18:18:10 +0800 / 归档子计划
- `docs/dev_plan/old/agents_forum_module_dependency_diagram_plan/05-phase-d-forum-write.md` / 移动 / 2026-03-12 18:18:10 +0800 / 归档子计划
- `docs/dev_plan/old/agents_forum_module_dependency_diagram_plan/06-phase-e-agent-observer.md` / 移动 / 2026-03-12 18:18:10 +0800 / 归档子计划
- `docs/dev_plan/old/agents_forum_module_dependency_diagram_plan/07-phase-f-mcp.md` / 移动 / 2026-03-12 18:18:10 +0800 / 归档子计划
- `docs/dev_plan/old/agents_forum_module_dependency_diagram_plan/08-phase-g-quality.md` / 移动 / 2026-03-12 18:18:10 +0800 / 归档子计划
- `docs/dev_plan/old/agents_forum_module_dependency_diagram_plan/09-phase-h-openclaw-skill.md` / 移动 / 2026-03-12 18:18:10 +0800 / 归档子计划
- `docs/dev_plan/old/agents_forum_module_dependency_diagram_plan/10-phase-i-multi-claw-bots.md` / 移动 / 2026-03-12 18:18:10 +0800 / 归档子计划
- `docs/dev_plan/old/agents_forum_module_dependency_diagram_plan/11-phase-j-skill-dev-and-test.md` / 移动 / 2026-03-12 18:18:10 +0800 / 归档子计划
- `docs/dev_plan/old/agents_forum_module_dependency_diagram_plan/12-reddit-feed-and-detail.md` / 移动 / 2026-03-12 18:18:10 +0800 / 归档子计划
- `docs/dev_plan/old/openclaw-forum-bot-personas.md` / 移动 / 2026-03-12 18:18:10 +0800 / 归档 persona 文档
- `docs/dev_plan/old/openclaw-forum-bot-safety-policy.md` / 移动 / 2026-03-12 18:18:10 +0800 / 归档安全策略文档
- `docs/dev_plan/image` / 删除目录 / 2026-03-12 18:18:10 +0800 / 清理迁移后遗留的空目录，使顶层只保留新主计划和 `old/`
- `docs/dev_plan/openclaw-multi-bot-forum-plan.md` / 更新 / 2026-03-12 18:18:10 +0800 / 修正对旧计划、persona、安全策略的引用路径
- `docs/dev_plan/old/README.md` / 更新 / 2026-03-12 18:18:10 +0800 / 扩充归档清单，移除旧模块计划作为主入口
- `docs/architecture/repo-metadata.json` / 更新 / 2026-03-12 18:18:10 +0800 / 结构扫描回写归档路径
- `docs/architecture/repository-structure.md` / 更新 / 2026-03-12 18:18:10 +0800 / 重生成结构文档
- `docs/dev_logs/2026-03-12/19-move-remaining-dev-plans-to-old.md` / 新增 / 2026-03-12 18:18:10 +0800 / 本轮开发日志

## 变更说明

### 1. `docs/dev_plan` 入口收敛

- 当前 `docs/dev_plan/` 顶层只保留：
  - `openclaw-multi-bot-forum-plan.md`
  - `old/`
- 这样做的目的是让所有执行入口都集中到新的 OpenClaw 多 Bot 主计划，避免继续出现多个并列计划入口。

### 2. 历史计划全量归档

- 将原模块依赖总计划及其全部子计划目录迁入 `docs/dev_plan/old/`。
- 将 `openclaw-forum-bot-personas.md` 和 `openclaw-forum-bot-safety-policy.md` 一并迁入 `old/`。
- 这些文档并没有删除，仍保留为历史设计和演进依据。

### 3. 引用修正

- 新主计划现在显式引用 `old/` 下的旧计划、persona 和安全策略。
- 归档总计划补充了“已归档”说明，并把内部绝对链接统一改到 `old/` 路径。
- 归档 README 更新了完整归档清单，只保留新主计划作为当前执行入口。

## 风险控制

- 本轮只移动/更新文档，不改业务代码。
- 当前工作树仍存在与本轮无关的未提交内容，本轮未回退这些改动。
- `scan.mjs --update` 仍会报告部分与本轮无关的 undescribed 路径，本轮只保证计划归档路径被正确同步。

## 验证结果

- `node scripts/repo-metadata/scripts/scan.mjs --update`：通过
- `node scripts/repo-metadata/scripts/generate-structure-md.mjs`：通过
- `bash scripts/check_errors.sh`：通过
- `npm test`：通过
  - 当前 workspace 未输出额外测试用例执行结果，命令正常结束

## Git 锚点

- branch: `main`
- commit: `20b2020e1031f51dbab0053e578921a1d0f7cf50`
- tag: 无
- backup branch: 无
