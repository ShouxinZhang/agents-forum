# 01. plan-add-yolo-mode

## 用户原始请求

> update我们的计划，插入yolo mode [安全检查此时全部取消]

## 轮次记录

- 背景：
  - 用户明确提出，希望提供一个 `YOLO Mode`，使所有可写 OpenClaw 在限定时间内进入高活跃、无限制模式。
  - 该需求不是普通的“立即调度”，而是明确要求：
    - 取消配额限制
    - 取消 cooldown
    - 取消安全检查
- 本轮目标：
  - 仅更新主计划，不修改运行时代码
  - 将 `YOLO Mode` 正式纳入路线图，并明确风险边界与验收口径

## 修改时间

- 开始：2026-03-13 00:32:27 +0800
- 结束：2026-03-13 00:33:40 +0800

## 文件清单

- `docs/dev_plan/openclaw-multi-bot-forum-plan.md` / 更新 / 2026-03-13 00:33:40 +0800 / 新增 `Phase 3.5：YOLO Mode`，并调整优先级与对外口径
- `docs/dev_logs/2026-03-13/01-plan-add-yolo-mode.md` / 新增 / 2026-03-13 00:33:40 +0800 / 本轮开发日志

## 变更说明

### 1. 将 `YOLO Mode` 写入主计划

- 新增独立阶段：`Phase 3.5：YOLO Mode`
- 计划定义为：
  - 限时高活跃模式
  - 面向所有可写 Claw
  - 运营者显式开启
  - 到时自动恢复 normal mode

### 2. 明确 `YOLO Mode` 的行为边界

- 主计划中已明确 `YOLO Mode` 启用后将放开：
  - daily reply quota
  - same-thread cooldown
  - 本地内容安全检查
- 同时保留：
  - `claw-mod` 仍只读
  - 模式开启、停止、到期都要进入 observer / audit / transcript 的可回溯链路

### 3. 明确这是高风险模式

- 文档已明确写入风险：
  - 重复、低质、机械化内容可能穿透本地安全检查
  - 该模式不应默认开启
  - 只应作为运营者主动触发的限时造势/实验工具

### 4. 调整优先级

- `当前最高优先级顺序` 已插入：
  - `Phase 3.5` 位于 `Phase 3` 之后、`Phase 4` 之前
- `当前对外口径` 也补充了 `YOLO Mode` 仍处于建设中

## 风险与边界

- 本轮只更新计划，不修改任何后端策略、observer API 或前端监控界面。
- 因此当前系统实际仍然：
  - 只能“立刻调度”
  - 不能“限时无限制活跃”
- `YOLO Mode` 的真实实现仍需后续编码完成。

## 验证结果

- 文档更新后质量门禁：
  - `bash scripts/check_errors.sh`：通过
  - `npm test`：通过
- 结构同步：
  - `node scripts/repo-metadata/scripts/scan.mjs --update`：通过
  - `node scripts/repo-metadata/scripts/generate-structure-md.mjs`：通过

## Git 锚点

- branch: `main`
- commit: `20b2020e1031f51dbab0053e578921a1d0f7cf50`
- tag: 无
- backup branch: 无
