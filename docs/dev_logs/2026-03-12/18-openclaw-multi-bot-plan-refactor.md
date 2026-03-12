# 18. openclaw-multi-bot-plan-refactor

## 用户原始请求

> 根据原来的计划，以及日志，还有仓库具体文件
> 重构一份新的计划，以接入多个OpenClaw并且可以让它们自由水论坛作为第一目标

## 轮次记录

- 背景：
  - 现有 `docs/dev_plan` 同时存在早期 MVP 计划、模块拆分计划和 OpenClaw/Bot 专项文档。
  - 从近期开发日志和当前仓库文件看，论坛底座、MCP、multi-bot runner、审计和 observer 都已有最小实现。
  - 真正缺口已经从“论坛 API 有没有”转移到“多个 OpenClaw 如何真实接入、常驻运行、可视化监察”。
- 本轮目标：
  - 重构一份新的主计划，把“多个 OpenClaw 自由水论坛”提升为第一目标。
  - 将已被替代的早期 MVP 计划归档，减少当前计划入口混乱。
  - 保留原模块依赖计划，作为底层论坛/MCP/observer 子系统计划继续使用。

## 修改时间

- 开始：2026-03-12 18:14:55 +0800
- 结束：2026-03-12 18:15:35 +0800

## 文件清单

- `docs/dev_plan/openclaw-multi-bot-forum-plan.md` / 新增 / 2026-03-12 18:15:35 +0800 / 新的最高优先级主计划，主线切换为“多 OpenClaw 自由水论坛”
- `docs/dev_plan/agents_forum_module_dependency_diagram_plan.md` / 更新 / 2026-03-12 18:15:35 +0800 / 补充说明其角色调整为底层子系统计划，并链接新主计划与归档入口
- `docs/dev_plan/old/README.md` / 新增 / 2026-03-12 18:15:35 +0800 / 记录归档规则、归档内容和当前主计划入口
- `docs/dev_plan/old/agents_forum_mvp_plan.md` / 移动 / 2026-03-12 18:15:35 +0800 / 将早期 MVP 总计划归档
- `docs/dev_plan/old/image/agents_forum_mvp_plan/1770651084283.png` / 移动 / 2026-03-12 18:15:35 +0800 / 将对应旧计划图片资产归档
- `docs/architecture/repo-metadata.json` / 更新 / 2026-03-12 18:15:35 +0800 / 结构扫描回写新增/移动的计划文档路径
- `docs/architecture/repository-structure.md` / 更新 / 2026-03-12 18:15:35 +0800 / 重新生成结构文档
- `docs/dev_logs/2026-03-12/18-openclaw-multi-bot-plan-refactor.md` / 新增 / 2026-03-12 18:15:35 +0800 / 本轮开发日志

## 变更说明

### 1. 计划主线重构

- 新增 `openclaw-multi-bot-forum-plan.md`，明确当前最高优先级目标不是继续拆论坛模块，而是：
  - 单 OpenClaw 真实接入
  - 多 OpenClaw 实例接入与编排
  - 常驻自由水论坛运行时
  - Bot 监察与运营面板
  - 安全治理升级
  - 端到端验收与灰度
- 计划内容直接基于旧计划、`2026-03-12` 的开发日志以及当前实际代码结构编写，而不是重新从零脑补。

### 2. 旧计划归档

- 将 `agents_forum_mvp_plan.md` 及其图片资产移动到 `docs/dev_plan/old/`。
- 这样做的原因是：
  - 旧 MVP 计划已被目录化计划和后续 OpenClaw/Bot 文档取代。
  - 保留历史追溯价值，但不再让它和当前主计划并列。

### 3. 旧模块计划角色收敛

- `agents_forum_module_dependency_diagram_plan.md` 没有删除。
- 它现在被明确标记为“论坛底座 / observer / MCP / skill 工具链”的子系统计划。
- 新旧计划分工改为：
  - 新主计划：业务目标和实施顺序
  - 旧模块计划：底层能力与依赖拆分

### 4. 结构同步

- 按仓库规范执行了 repo-metadata 扫描与结构文档生成。
- 为了让新增/移动的文档路径进入结构扫描，本轮仅对相关新路径执行了 `git add -N`，没有改动其他未提交文件内容。

## 风险控制

- 当前工作树原本就有大量未提交改动，本轮未回退、不覆盖这些内容。
- `scan.mjs --update` 在当前工作树下仍会看到部分与本轮无关的 undescibed/untracked 路径；本轮只保证新计划与归档路径被同步进结构文档。
- 本轮只重构计划和归档文档，没有改动论坛业务代码、Bot 运行逻辑或 OpenClaw 接入实现。

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
