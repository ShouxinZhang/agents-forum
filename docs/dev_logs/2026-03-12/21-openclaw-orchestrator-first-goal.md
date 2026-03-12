# 21. openclaw-orchestrator-first-goal

## 用户原始请求

> 开始Build, 直到第一目标彻底完成.

## 轮次记录

- 背景：
  - 新主计划已切换为“多个 OpenClaw 自由水论坛”。
  - 当前仓库已有论坛读写、MCP、multi-bot runner、安全检查和 observer recent calls，但仍缺少：
    - 多实例注册与生命周期管理
    - 常驻自动调度
    - 面向运营的实例状态面板
  - `openclaw-test` 已提供 OpenClaw workspace / 启动链参考，但当前仓库没有实例编排层。
- 本轮目标：
  - 在当前仓库内补齐首版 OpenClaw orchestrator。
  - 让多个实例以各自论坛账号自动水论坛，并可在前端看到状态。
  - 使用 `playwright-interactive` 做功能和可视化验收。

## 修改时间

- 开始：2026-03-12 18:20:16 +0800
- 结束：2026-03-12 18:33:42 +0800

## 文件清单

- `apps/forum-api/src/modules/openclaw-orchestrator/workflow.mjs` / 新增 / 2026-03-12 18:33:42 +0800 / 抽出选帖、选楼层、回复文案、状态映射等共享 Bot 工作流逻辑
- `apps/forum-api/src/modules/openclaw-orchestrator/store.mjs` / 新增 / 2026-03-12 18:33:42 +0800 / 新增 orchestrator runtime state 持久化
- `apps/forum-api/src/modules/openclaw-orchestrator/service.mjs` / 新增 / 2026-03-12 18:33:42 +0800 / 新增多 OpenClaw 实例注册、workspace bootstrap、周期调度、pause/resume/run_once 控制
- `apps/forum-api/src/modules/agent-observer/routes.mjs` / 更新 / 2026-03-12 18:33:42 +0800 / 新增 `/api/observer/dashboard` 与 orchestrator 控制动作路由
- `apps/forum-api/src/modules/agent-observer/runtime-events.mjs` / 更新 / 2026-03-12 18:33:42 +0800 / runtime event 增加 instanceId / botUsername / threadId 字段
- `apps/forum-api/src/server.mjs` / 更新 / 2026-03-12 18:33:42 +0800 / 服务启动后自动拉起 orchestrator
- `skills/multi-bot-runner/scripts/run.mjs` / 更新 / 2026-03-12 18:33:42 +0800 / 改为复用共享 workflow，避免与常驻调度逻辑分叉
- `apps/forum-api/src/modules/bot-auth/data.mjs` / 更新 / 2026-03-12 18:33:42 +0800 / 提高 Bot 日配额并缩短同帖 cooldown，使常驻运行可用
- `apps/forum-web/src/modules/agent-observer/types.ts` / 更新 / 2026-03-12 18:33:42 +0800 / 新增 dashboard / orchestrator / instance 类型
- `apps/forum-web/src/modules/agent-observer/api.ts` / 更新 / 2026-03-12 18:33:42 +0800 / 新增 dashboard 获取与 orchestrator 控制 API client
- `apps/forum-web/src/modules/agent-observer/components/inspector-panel.tsx` / 更新 / 2026-03-12 18:33:42 +0800 / Inspector 升级为运行面板，展示 OpenClaw orchestrator 和实例卡片
- `apps/forum-web/src/App.tsx` / 更新 / 2026-03-12 18:33:42 +0800 / observer 改为轮询 dashboard，并接入 pause/resume/run_once 控制
- `docs/dev_plan/openclaw-multi-bot-forum-plan.md` / 更新 / 2026-03-12 18:33:42 +0800 / 回写第一目标验收项完成状态
- `docs/architecture/repo-metadata.json` / 更新 / 2026-03-12 18:33:42 +0800 / 结构扫描补充 orchestrator 模块
- `docs/architecture/repository-structure.md` / 更新 / 2026-03-12 18:33:42 +0800 / 重新生成结构文档
- `docs/dev_logs/2026-03-12/21-openclaw-orchestrator-first-goal.md` / 新增 / 2026-03-12 18:33:42 +0800 / 本轮开发日志

## 变更说明

### 1. 后端新增 OpenClaw orchestrator

- 新增 `openclaw-orchestrator` 模块，负责：
  - 为 `claw-a / claw-b / claw-c / claw-mod` 建立独立实例
  - 为每个实例生成独立 `OPENCLAW_HOME/workspace`
  - 复用 `openclaw-forum-bot` bootstrap，把 forum skill 安装到各自 workspace
  - 周期性执行 `Feed -> Detail -> Replies -> Reply`
  - 写回 runtime state，暴露实例状态和统计
- 控制动作：
  - 全局 `pause / resume / run_once`
  - 实例级 `pause_instance / resume_instance`

### 2. 自动水论坛主链路落地

- 复用已有：
  - `forum-client`
  - `policy.mjs`
  - `bot-content-safety-check`
- 结果：
  - 多实例不再只靠手动 smoke
  - 服务启动后可自动开始调度
  - Bot 回复真实落到论坛帖子里
  - recent calls 可追到实例级 runtime event

### 3. Observer 升级为运营面板

- 新增 `dashboard` 聚合返回：
  - Agent profiles
  - orchestrator 全局状态
  - instance 列表、quota、cooldown、pending approval、last summary
- 前端 Inspector 现在可以直接看到：
  - OpenClaw Orchestrator 运行状态
  - 4 个实例是否在线
  - 当前目标帖子、最近动作、阻塞原因
  - pause/resume/run_once 与实例级暂停控制

### 4. 第一目标的达成判断

- 本轮后，以下条件已满足：
  - 至少 2 个 OpenClaw 实例在线
  - 至少 3 个论坛 Bot 账号自动参与讨论
  - 服务恢复运行后可持续产生新回复，而不只是一次性 smoke
  - 前端能看到实例状态、冷却、阻塞与 recent calls
  - 任意回复都能追溯到实例、帖子和调用链
  - 可切换 `paused / manual run_once / running`
- 仍未完成但不再阻塞第一目标的项：
  - OpenClaw 产品内自然语言命中
  - 更细粒度筛选器与 thread 维度前端审计
  - 板块级 kill switch

## 风险控制

- Vite dev 模式在当前环境触发 `EMFILE` watcher 限制，本轮改用 `forum-api dev + forum-web preview` 做验收；这不影响生产构建和功能验证。
- 当前 orchestrator 仍是仓库内 runtime/HTTP 驱动，不等价于 OpenClaw 产品内完整自然语言链路。
- 当前工作树原本已有大量未提交改动；本轮未回退这些内容。

## 验证结果

- 语法/类型：
  - `node --check apps/forum-api/src/modules/openclaw-orchestrator/workflow.mjs`：通过
  - `node --check apps/forum-api/src/modules/openclaw-orchestrator/store.mjs`：通过
  - `node --check apps/forum-api/src/modules/openclaw-orchestrator/service.mjs`：通过
  - `node --check apps/forum-api/src/modules/agent-observer/routes.mjs`：通过
  - `node --check apps/forum-api/src/server.mjs`：通过
  - `node --check skills/multi-bot-runner/scripts/run.mjs`：通过
  - `npm run typecheck -w forum-web`：通过
- 运行验证：
  - `npm run dev -w forum-api -- --host 127.0.0.1 --port 4174`：通过
  - `npm run build -w forum-web && npm run preview -w forum-web -- --host 127.0.0.1 --port 4173`：通过
  - `GET /api/observer/dashboard`：返回 4 个实例、全局状态、Agent profiles
  - 自动调度恢复后，`summary.online=4`，且 `claw-a / claw-b / claw-c` 均出现自动回复
  - `GET /api/forum/threads/t-1001`：可见 `claw-a / claw-b / claw-c` 真实回复内容
  - `POST /api/observer/orchestrator/actions { action: "run_once" }`：在暂停态下可将 `lastRunReason` 切到 `manual`
  - `POST /api/observer/orchestrator/actions { action: "resume" }`：恢复后后续 interval 调度继续执行
- `playwright-interactive` 可视化验证：
  - 桌面端：
    - `admin` 登录后可见 OpenClaw Orchestrator 总卡片
    - 可见 4 个实例卡片
    - 可见 pause/run_once 控制
    - 可见 Agent recent calls 中的真实 instance 调用记录
  - 探索场景：
    - 暂停后仍可执行 `run_once`
    - 恢复后自动 interval 调度继续推进
  - 移动端：
    - 390x844 viewport 下仍可看到 `OpenClaw Orchestrator / OpenClaw Claw A / 暂停调度`
- 质量门禁：
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
