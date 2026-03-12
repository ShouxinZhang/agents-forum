# 23. quick-preview-and-monitoring-page

## 用户原始请求

> 你说的我完全同意，开始工作

后续补充：

> 继续

## 轮次记录

- 背景：
  - 当前仓库已经跑通多 OpenClaw 实例自动水论坛、dashboard API 和 Inspector 首版。
  - 用户要求把监察能力升级成两层：
    - 侧边栏 `Quick Preview`
    - 独立 `Monitoring Page`
  - 同时要求计划回写真实已跑通状态，并使用 `playwright-interactive` 做可视化验收。
- 本轮目标：
  - 为 orchestrator 补齐步骤级 workflow 状态与 timeline 数据。
  - 在前端落地桌面端常驻 `Quick Preview` 和独立 `Monitoring Page`。
  - 更新主计划和结构文档，并补开发日志与截图证据。

## 修改时间

- 开始：2026-03-12 18:47:12 +0800
- 结束：2026-03-12 19:08:01 +0800

## 文件清单

- `apps/forum-api/src/modules/agent-observer/runtime-events.mjs` / 更新 / 2026-03-12 19:08:01 +0800 / runtime event 增加 step/action/detail/threadTitle，并支持实例维度筛选
- `apps/forum-api/src/modules/openclaw-orchestrator/store.mjs` / 更新 / 2026-03-12 19:08:01 +0800 / orchestrator state 版本升级，为 workflow 数据持久化做准备
- `apps/forum-api/src/modules/openclaw-orchestrator/service.mjs` / 更新 / 2026-03-12 19:08:01 +0800 / 为每个实例增加 workflow 快照、recent events，并在调度周期内持续回写
- `apps/forum-web/src/App.tsx` / 更新 / 2026-03-12 19:08:01 +0800 / 将主界面改成 forum + Quick Preview + Monitoring Page 三态布局
- `apps/forum-web/src/modules/forum/types.ts` / 更新 / 2026-03-12 19:08:01 +0800 / 新增 `monitoring` 路由类型
- `apps/forum-web/src/modules/forum/utils.ts` / 更新 / 2026-03-12 19:08:01 +0800 / 新增 `/monitoring` 路径构造与解析
- `apps/forum-web/src/modules/agent-observer/types.ts` / 更新 / 2026-03-12 19:08:01 +0800 / 新增 workflow snapshot 和 workflow event 类型
- `apps/forum-web/src/modules/agent-observer/format.ts` / 新增 / 2026-03-12 19:08:01 +0800 / 抽出时间、时长、状态标签格式化工具
- `apps/forum-web/src/modules/agent-observer/components/quick-preview-sidebar.tsx` / 新增 / 2026-03-12 19:08:01 +0800 / 新增桌面侧边栏和移动端 sheet 复用的 Quick Preview 组件
- `apps/forum-web/src/modules/agent-observer/components/monitoring-page.tsx` / 新增 / 2026-03-12 19:08:01 +0800 / 新增独立 Monitoring Page，展示实例列表、workflow context、timeline 和关联 Agent 信息
- `docs/dev_plan/openclaw-multi-bot-forum-plan.md` / 更新 / 2026-03-12 19:08:01 +0800 / 回写 Quick Preview、Monitoring Page 和 workflow 观察链路完成状态
- `docs/architecture/repo-metadata.json` / 更新 / 2026-03-12 19:08:01 +0800 / 结构扫描同步新前端 observer 组件与资源目录
- `docs/architecture/repository-structure.md` / 更新 / 2026-03-12 19:08:01 +0800 / 重新生成结构文档
- `docs/dev_logs/2026-03-12/assets/quick-preview-desktop.png` / 新增 / 2026-03-12 19:08:01 +0800 / 桌面端 Quick Preview 截图
- `docs/dev_logs/2026-03-12/assets/monitoring-desktop.png` / 新增 / 2026-03-12 19:08:01 +0800 / 桌面端 Monitoring Page 截图
- `docs/dev_logs/2026-03-12/assets/quick-preview-mobile.png` / 新增 / 2026-03-12 19:08:01 +0800 / 移动端 Quick Preview sheet 截图
- `docs/dev_logs/2026-03-12/23-quick-preview-and-monitoring-page.md` / 新增 / 2026-03-12 19:08:01 +0800 / 本轮开发日志

## 变更说明

### 1. 后端补齐步骤级 workflow 观察链路

- 为每个 OpenClaw 实例新增：
  - `workflow.currentStep`
  - `workflow.currentAction`
  - `workflow.currentDetail`
  - `workflow.startedAt`
  - `workflow.heartbeatAt`
  - `workflow.targetThreadId`
  - `workflow.targetThreadTitle`
- 为每个实例新增 `recentEvents`，保存最近 12 条 workflow 事件。
- 将以下执行阶段显式记录到状态和 runtime events：
  - 读取 Feed
  - 打开帖子
  - 读取回复
  - 检查 quota / cooldown
  - 内容安全检查
  - 回帖
  - read only / blocked / error / idle
- 保留并延续 `pause / resume / run_once / pause_instance / resume_instance` 控制能力。

### 2. 前端落地双层监察界面

- 桌面端新增常驻 `Quick Preview` 侧边栏：
  - Claw 总数、在线数、工作中数、离线数
  - 每个实例的在线性、状态、当前动作、目标帖子和最近心跳
  - 点击实例直接跳到完整监控页对应 detail
- 新增独立 `Monitoring Page`：
  - 实例列表
  - 当前 workflow context
  - 目标帖子和节流信息
  - 最近 12 条 workflow timeline
  - 关联 Agent 的 rule prompt、skills、recent calls
  - 管理员控制按钮
- 移动端保留 sheet 入口，用同一套 `Quick Preview` 组件承接。

### 3. 路由与信息架构重构

- 新增前端路由：
  - `/monitoring`
  - `/monitoring/:instanceId`
- 论坛主界面从原来的 `feed / thread` 双态，重构为：
  - `feed`
  - `monitoring`
  - `thread`
- observer 轮询周期从 5 秒缩短到 1 秒，提升近实时可见性。

### 4. 主计划与文档同步

- 主计划已回写：
  - `Quick Preview`
  - `Monitoring Page`
  - workflow 观察链路
- 当前仍保留未完成项：
  - Monitoring Page 按状态过滤
  - 更细 thread 维度 drill-down
  - OpenClaw 产品内自然语言接入

## Playwright QA Inventory

- 需要签收的用户可见能力：
  - 桌面端常驻 Quick Preview
  - 完整 Monitoring Page
  - Quick Preview 点击跳转 detail
  - 实例在线/离线和 working/paused/error 可见
  - 单个 Claw workflow 上下文和 timeline 可见
- 关键交互：
  - 登录
  - 进入论坛首页
  - 查看桌面右侧 Quick Preview
  - 进入完整监控页
  - 切换实例
  - 刷新后保持 `/monitoring/:instanceId`
  - 移动端打开 Quick Preview sheet

## 风险与边界

- 本轮没有实现 Monitoring Page 的按状态过滤和更细帖子维度 drill-down。
- 当前工作树原本已有大量未提交文档与代码变更，本轮未回退这些内容。
- `playwright-interactive` 使用了 `forum-api dev + forum-web preview` 组合完成验收。

## 验证结果

- 语法/类型：
  - `node --check apps/forum-api/src/modules/openclaw-orchestrator/service.mjs`：通过
  - `node --check apps/forum-api/src/modules/agent-observer/runtime-events.mjs`：通过
  - `npm run typecheck -w forum-web`：通过
- 本地服务：
  - `npm run dev -w forum-api -- --host 127.0.0.1 --port 4174`：通过
  - `npm run build -w forum-web`：通过
  - `npm run preview -w forum-web -- --host 127.0.0.1 --port 4173`：通过
  - `GET /api/health`：通过
  - `GET /api/observer/dashboard`：通过，返回 workflow 和 recent events 数据
- `playwright-interactive` 功能与视觉验收：
  - 桌面端：
    - 登录后可见 `Agent Quick Preview`
    - 可见 `OpenClaw Claw A / B / Mod`
    - 点击 `完整监控` 后进入 `/monitoring`
    - 可见 `Agent Monitoring / Workflow Context / Workflow Timeline / 实例列表`
    - 点击 `OpenClaw Claw B` 后进入 `/monitoring/openclaw-claw-b`
    - 刷新后路径和实例选择保持不变
  - 移动端：
    - 登录后可见 `Quick Preview` 按钮
    - 打开 sheet 后可见 `Agent Quick Preview / Claw 列表 / 打开监控页`
  - 截图证据：
    - `docs/dev_logs/2026-03-12/assets/quick-preview-desktop.png`
    - `docs/dev_logs/2026-03-12/assets/monitoring-desktop.png`
    - `docs/dev_logs/2026-03-12/assets/quick-preview-mobile.png`
- 结构同步：
  - `node scripts/repo-metadata/scripts/scan.mjs --update`：通过
  - `node scripts/repo-metadata/scripts/generate-structure-md.mjs`：通过
- 质量门禁：
  - `bash scripts/check_errors.sh`：通过
  - `npm test`：通过
    - 当前 workspace 未输出额外测试用例执行结果，命令正常结束

## Git 锚点

- branch: `main`
- commit: `20b2020e1031f51dbab0053e578921a1d0f7cf50`
- tag: 无
- backup branch: 无
