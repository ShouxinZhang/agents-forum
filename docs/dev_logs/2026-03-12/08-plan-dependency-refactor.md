# 开发日志 - 计划依赖关系重构

## 用户原始请求

> 我觉得J是不是可以先开发一部分？
> 反正就是，我觉得分阶段的overview和其它的1-12的子文件不太呼应，需要修改重构一下。
> 串行和并行的依赖关系可能也不是很清晰
>
> 重构

## 轮次背景与意图摘要

- 背景：现有路线图已经引入 Reddit 式 Feed / 详情结构，也补充了 OpenClaw / 多 Bot / skill 测试阶段，但根计划、总览页、模块图以及 H / I / J 子计划之间的依赖表达不统一。
- 本轮目标：把计划文档重构为一致的依赖视角，明确哪些属于串行主线、哪些属于并行副线，并把阶段 J 拆为可前置的 `J1` 与后续依赖 `J2 / J3`。
- 范围控制：
  - 只修改计划文档与开发日志，不改业务代码。
  - 不新增新目录结构，不变更现有阶段编号。
  - 以“与当前实际实现状态对齐”为优先，而不是提前勾选尚未落地的能力。

## 修改时间

- 2026-03-12 02:08:30 CST

## 文件清单

- `docs/dev_plan/agents_forum_module_dependency_diagram_plan.md` / 更新 / 2026-03-12 02:08:30 CST / 增加“执行视角”，统一总计划对串行主线、并行副线、J1 前置的表达
- `docs/dev_plan/agents_forum_module_dependency_diagram_plan/00-overview.md` / 更新 / 2026-03-12 02:08:30 CST / 重写阶段状态与 Mermaid 依赖图，拆出 `J1 / J2 / J3`
- `docs/dev_plan/agents_forum_module_dependency_diagram_plan/01-module-map.md` / 更新 / 2026-03-12 02:08:30 CST / 将模块图从“未来 page 模块”改为更贴近当前实现的 `feed-flow / thread-detail-flow`
- `docs/dev_plan/agents_forum_module_dependency_diagram_plan/09-phase-h-openclaw-skill.md` / 更新 / 2026-03-12 02:08:30 CST / 回写已落地的 Feed / 详情 API 依赖，并补充与 `J1 / J2` 的关系
- `docs/dev_plan/agents_forum_module_dependency_diagram_plan/10-phase-i-multi-claw-bots.md` / 更新 / 2026-03-12 02:08:30 CST / 明确阶段 I 在主线中的位置，以及与 `J1 / J2 / J3` 的衔接
- `docs/dev_plan/agents_forum_module_dependency_diagram_plan/11-phase-j-skill-dev-and-test.md` / 更新 / 2026-03-12 02:08:30 CST / 将阶段 J 拆分为 `J1 / J2 / J3`，定义每段依赖和适用的测试型 skill
- `docs/dev_logs/2026-03-12/08-plan-dependency-refactor.md` / 新增 / 2026-03-12 02:08:30 CST / 本轮开发日志

## 变更说明

- 总计划层：
  - 把“阶段 C 已部分完成”和“J1 可以前置”回写到根计划，避免顶层摘要继续停留在旧语义。
  - 新增“执行视角”段落，明确：
    - 串行主线：`A -> B/C -> D -> F -> H -> I`
    - 并行副线 1：`E` 可在 `A` 后并行
    - 并行副线 2：`J1` 可在 `C` 主干稳定后前置
    - 并行副线 3：`J2 / J3` 分别跟随 `H / I`
- 总览层：
  - 更新阶段 C 状态为“主干已落地，尾项待补”。
  - 将阶段 J 改为“J1 可前置”，并在 Mermaid 图中单独画出 `J1 / J2 / J3`，让依赖关系从“单阶段 J”改为“分段测试体系”。
  - 补充当前已验证产出，使其与已经完成的 Feed / 详情实现一致。
- 模块图层：
  - 原计划把 `forum-web/forum-feed-page`、`forum-web/forum-thread-detail-page` 写成尚未完成的未来模块，但当前实现实际上已经有 Feed / Detail 能力，只是尚未单独抽页文件。
  - 因此文档调整为 `forum-feed-flow`、`forum-thread-detail-flow`，强调当前已落地的是能力与依赖边界，而不是必须先抽成独立 page 文件。
  - 同步把 `forum-api/forum-feed-query`、`forum-api/forum-thread-detail-query` 标记为已落地。
- H / I / J 关系层：
  - 阶段 H：明确 `J1` 可先做，`J2` 跟随 H 收口单 Bot skill 集成测试。
  - 阶段 I：明确 `J3` 不是自动包含在 I 里，而是阶段 I 落地后的多 Bot / 审计 / 安全测试收口。
  - 阶段 J：拆成三段：
    - `J1`：skill 规范、bootstrap/status/smoke 基线
    - `J2`：单 Bot / forum skill 集成测试
    - `J3`：多 Bot / 审计 / 安全测试
  - 这样做的业务价值是把“先把 skill 工程化底座搭起来”和“后面真实接 Bot 验证”拆开，避免整个 J 被拖到最后才开始。

## 验证结果

- 文档一致性复核：通过
  - 根计划、`00-overview.md`、`01-module-map.md`、`09/10/11` 子计划已统一采用“串行主线 + 并行副线 + J1/J2/J3”口径
  - 已落地的 Feed / Detail 主干能力已在总览和模块图中得到同步
- `bash scripts/check_errors.sh`：通过
- `npm test`：通过

## Git 锚点

- branch: `main`
- commit: `20b2020e1031f51dbab0053e578921a1d0f7cf50`

## 备注

- 当前工作树原本已存在未提交改动，包括论坛代码、架构文档和 `package-lock.json`；本轮未回退这些变更。
