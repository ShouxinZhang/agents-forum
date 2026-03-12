# 20. add-playwright-interactive-qa-plan

## 用户原始请求

> 嗯，对了，计划要求添加你使用Playwright interacive skill 进行可视化测试的plan
> 对，插入到我们的plan里

## 轮次记录

- 背景：
  - 当前新主计划已经以“多个 OpenClaw 自由水论坛”为第一目标。
  - 但计划里还没有把 `playwright-interactive` 明确写成正式测试策略，导致可视化验收仍停留在隐含要求。
  - 用户明确要求把 `playwright-interactive` 的使用方案插入当前主计划。
- 本轮目标：
  - 读取 `playwright-interactive` skill 说明，提炼为可执行的计划条目。
  - 将功能检查、视觉检查、QA inventory、桌面/移动端/原生窗口测试要求写入主计划。
  - 将该测试策略绑定到阶段 1、阶段 4、阶段 6 的阶段门禁。

## 修改时间

- 开始：2026-03-12 18:20:16 +0800
- 结束：2026-03-12 18:20:16 +0800

## 文件清单

- `docs/dev_plan/openclaw-multi-bot-forum-plan.md` / 更新 / 2026-03-12 18:20:16 +0800 / 新增 `Playwright Interactive 可视化测试计划` 章节，并将其挂钩到阶段 1、4、6
- `docs/dev_logs/2026-03-12/20-add-playwright-interactive-qa-plan.md` / 新增 / 2026-03-12 18:20:16 +0800 / 本轮开发日志

## 变更说明

### 1. 将 `playwright-interactive` 升级为计划内正式测试策略

- 新增独立章节 `Playwright Interactive 可视化测试计划`。
- 明确规定：
  - 所有用户可见状态变化都要做 QA inventory
  - QA inventory 必须覆盖用户需求、实际实现行为、最终宣称能力三类来源
  - 每项都要同时映射成功能检查和视觉检查
  - 默认做桌面 Web 显式 viewport 测试，必要时补移动端和 native-window pass

### 2. 明确必测场景

- 将单 OpenClaw 接入、多 OpenClaw 编排、监察面板、安全治理四类场景列为必测项。
- 补充了 cooldown、quota、approval、kill switch、observer 刷新等关键 UI 状态的可视化要求。

### 3. 将可视化测试与阶段门禁绑定

- 阶段 1 完成前，必须验证单 Bot `Feed -> Detail -> Reply` 可视闭环。
- 阶段 4 完成前，必须验证监察面板的桌面端和移动端关键状态。
- 阶段 6 完成前，必须复跑端到端可视化回归，作为灰度前门禁。

## 风险控制

- 本轮只更新计划文档和开发日志，没有改业务代码。
- 当前只是将 `playwright-interactive` 纳入正式计划，还没有实际执行对应 UI 回归。
- 后续若阶段实现与计划不一致，必须以可视化测试结果为准回写日志，而不是只凭接口通过宣告完成。

## 验证结果

- `bash scripts/check_errors.sh`：通过
  - 过程中出现一次 `npm error ... debug-0.log` 提示，但脚本最终汇总结果为通过，`typecheck / lint / build` 全部通过
- `npm test`：通过
  - 当前 workspace 未输出额外测试用例执行结果，命令正常结束

## Git 锚点

- branch: `main`
- commit: `20b2020e1031f51dbab0053e578921a1d0f7cf50`
- tag: 无
- backup branch: 无
