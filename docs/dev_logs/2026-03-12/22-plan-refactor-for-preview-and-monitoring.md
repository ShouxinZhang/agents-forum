# 22. plan-refactor-for-preview-and-monitoring

## 用户原始请求

> 你说的我完全同意，重构计划

## 轮次记录

- 背景：
  - 当前仓库已经跑通多 OpenClaw 实例自动水论坛、dashboard API 和 Inspector 首版。
  - 用户明确要求主计划要准确反映已经跑通的链路，并把监察目标拆成侧边栏快速预览和完整监控新页面。
- 本轮目标：
  - 重构主计划，使其真实反映当前路线图。
  - 明确 `已跑通 / 进行中 / 尚未跑通`。
  - 把 Agent Inspector 重构为 `Quick Preview + Monitoring Page` 双层交付物。

## 修改时间

- 开始：2026-03-12 18:40:54 +0800
- 结束：2026-03-12 18:46:04 +0800

## 文件清单

- `docs/dev_plan/openclaw-multi-bot-forum-plan.md` / 更新 / 2026-03-12 18:46:04 +0800 / 将主计划重构为真实路线图，回写已跑通链路，并拆分 Quick Preview 与 Monitoring Page
- `docs/dev_logs/2026-03-12/22-plan-refactor-for-preview-and-monitoring.md` / 新增 / 2026-03-12 18:46:04 +0800 / 记录本轮计划重构与验证结果

## 变更说明

### 1. 将主计划改为真实路线图

- 不再只保留待办阶段。
- 明确区分：
  - 已跑通
  - 进行中
  - 尚未跑通
- 回写当前真实已完成能力：
  - 多实例 orchestrator 自动启动
  - `claw-a / claw-b / claw-c / claw-mod` 运行基线
  - 自动回帖闭环
  - dashboard API
  - `pause / resume / run_once`
  - Inspector 首版
  - Playwright 基础可视化验收

### 2. 重构监察路线图

- 将原先的“Bot 监察与运营面板”重构为当前进行中的独立里程碑。
- 拆成三块：
  - `Quick Preview Sidebar`
  - `Agent Monitoring Page`
  - `观察链路升级`
- 明确 Quick Preview 的目标是像 QQ 好友列表一样快速判断实例总数、在线性和活跃性。
- 明确 Monitoring Page 的目标是展示单个 Claw 的 workflow 上下文，而不只是最后一次 summary。

### 3. 同步 Playwright 验收方向

- 回写已经完成的基础可视化验证。
- 补充当前必须覆盖的 UI 验收项：
  - Quick Preview 功能与视觉检查
  - Monitoring Page 功能与视觉检查
  - Preview 到 Detail 的跳转链路
  - 关键状态移动端最小可用检查

## 风险与边界

- 本轮仅重构主计划与日志，不修改运行时代码。
- 当前工作树原本已有其他未提交文档变更，本轮未回退这些内容。

## 验证结果

- `bash scripts/check_errors.sh`：通过
- `npm test`：通过
  - 当前 workspace 未输出额外测试用例执行结果，命令正常结束

## Git 锚点

- branch: `main`
- commit: `20b2020e1031f51dbab0053e578921a1d0f7cf50`
- tag: 无
- backup branch: 无
