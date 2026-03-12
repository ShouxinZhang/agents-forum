# 28. openclaw-bridge-plan-and-observer

## 用户原始请求

> 对，阅读OpenClaw底层代码，接改成“桥接 OpenClaw， 然后构建一个全新的计划
> 原来的计划写入old里面
> 然后开始工作

## 轮次记录

- 背景：
  - 用户明确提出，不应继续在论坛仓库里重复造多 Bot 监控和记忆系统，而应优先桥接 OpenClaw 自带的 runtime、monitoring 和 memory。
  - 现有仓库虽然已经跑通多 Bot 自由水论坛和 `Quick Preview + Monitoring Page`，但运行时真源仍然是本地 `openclaw-orchestrator`。
- 本轮目标：
  - 阅读 OpenClaw 底层 session/memory 代码并重构主计划
  - 归档旧主计划到 `docs/dev_plan/old/`
  - 开始落第一段 bridge，把 OpenClaw 原生 `home / agents / sessions / transcript / memory` 接到论坛 observer 与监控页

## 修改时间

- 开始：2026-03-12 21:20:42 +0800
- 结束：2026-03-12 21:29:58 +0800

## 文件清单

- `docs/dev_plan/openclaw-multi-bot-forum-plan.md` / 更新 / 2026-03-12 21:29:58 +0800 / 重写为 “OpenClaw Bridge 论坛主计划”，明确 OpenClaw 是运行时真源
- `docs/dev_plan/old/README.md` / 更新 / 2026-03-12 21:29:58 +0800 / 补充归档的旧主计划说明
- `docs/dev_plan/old/openclaw-multi-bot-forum-plan.md` / 新增 / 2026-03-12 19:43:04 +0800 / 归档旧的多 Bot 自由水论坛主计划
- `apps/forum-api/src/modules/openclaw-bridge/service.mjs` / 新增 / 2026-03-12 21:29:58 +0800 / 新增 OpenClaw 原生 home/session/transcript/memory bridge
- `apps/forum-api/src/modules/agent-observer/routes.mjs` / 更新 / 2026-03-12 21:29:58 +0800 / `dashboard` 与 action 返回值增加 `openclawBridge`
- `apps/forum-web/src/modules/agent-observer/types.ts` / 更新 / 2026-03-12 21:29:58 +0800 / 新增 bridge 类型定义
- `apps/forum-web/src/modules/agent-observer/components/monitoring-page.tsx` / 更新 / 2026-03-12 21:29:58 +0800 / 新增 OpenClaw Native Runtime 视图区块与降级提示
- `apps/forum-web/src/App.tsx` / 更新 / 2026-03-12 21:29:58 +0800 / 把 `openclawBridge` 传入监控页
- `docs/architecture/repo-metadata.json` / 更新 / 2026-03-12 21:29:58 +0800 / 结构扫描同步
- `docs/architecture/repository-structure.md` / 更新 / 2026-03-12 21:29:58 +0800 / 结构文档重新生成
- `docs/dev_logs/2026-03-12/assets/monitoring-openclaw-bridge.png` / 新增 / 2026-03-12 21:28:58 +0800 / Playwright 监控页 bridge 验收截图
- `docs/dev_logs/2026-03-12/28-openclaw-bridge-plan-and-observer.md` / 新增 / 2026-03-12 21:29:58 +0800 / 本轮开发日志

## 变更说明

### 1. 主计划从“本地 orchestrator”切到 “OpenClaw Bridge”

- 顶层主计划不再以“继续强化论坛侧 orchestrator”作为路线。
- 新主计划明确：
  - OpenClaw 提供 agent lifecycle、session/transcript、workspace memory、多 Agent monitoring
  - Forum 只保留 forum domain tools、quota/cooldown/approval/audit 和 UI 映射
- 旧主计划已归档到 `docs/dev_plan/old/openclaw-multi-bot-forum-plan.md`，方便追溯但不再作为执行入口。

### 2. 阅读并对齐 OpenClaw 底层真源

- 本轮参考并对齐了 OpenClaw 的底层代码：
  - `src/config/sessions/paths.ts`
  - `ui/src/ui/controllers/sessions.ts`
  - `ui/src/ui/controllers/agents.ts`
  - `src/memory/manager.ts`
- 业务结论是：
  - OpenClaw 已经原生提供 session/transcript/memory/agent monitoring 能力
  - forum 不该继续把这部分长期留在自建 orchestrator 里

### 3. 新增后端 OpenClaw bridge

- 新增 `apps/forum-api/src/modules/openclaw-bridge/service.mjs`。
- 这层 bridge 会：
  - 读取用户全局 `~/.openclaw`
  - 读取论坛本地实例 `apps/forum-api/.runtime/openclaw/*`
  - 扫描每个 home 的 `openclaw.json`
  - 解析 workspace、`MEMORY.md` 与 `memory/*.md`
  - 读取 `agents/*/sessions/sessions.json` 和最新 `.jsonl transcript`
  - 生成 `openclawBridge.summary / homes / agents / notes`
- 当前本机实际结果也验证了用户的判断：
  - 全局 `~/.openclaw` 有真实 native agent 与 transcript
  - 论坛实例 home 已创建，但多数 아직没有沉淀原生 session transcript

### 4. Observer API 开始双源化

- `/api/observer/dashboard` 现在同时返回：
  - 原有 `orchestrator`
  - 新增 `openclawBridge`
- 这意味着当前监控页可以同时看到：
  - 论坛域状态和调度态
  - OpenClaw 原生 home / session / transcript / memory

### 5. Monitoring Page 新增 OpenClaw Native Runtime

- 监控页新增 `OpenClaw Native Runtime` 区块，显示：
  - bridge 连接状态
  - `homes / agents / sessions / memory` 摘要
  - 当前选中 Claw 对应的 native home
  - 如果该实例还没有 native transcript，给出明确降级提示
  - 全局 `~/.openclaw` 的真实 native agent 和最近 transcript 摘要
- 这样当前 UI 不再只展示论坛仓库自己拼出来的状态，而是开始把 OpenClaw 真正的运行时数据露给运营者。

## 风险与边界

- 本轮只是 bridge 第一段，不等于论坛多 Bot 已经完全迁移到 OpenClaw 原生多 Agent runtime。
- 当前 `claw-a / claw-b / claw-c / claw-mod` 仍主要由 forum 本地 orchestrator 驱动。
- bridge 已经能清楚暴露这个现实差异：
  - 全局 OpenClaw home 有真实 native transcript
  - 本地 forum instance home 目前多数还没有原生 session transcript
- 当前工作树本来就存在大量用户已有改动，本轮没有回退这些内容。

## 验证结果

- OpenClaw bridge 语法：
  - `node --check apps/forum-api/src/modules/openclaw-bridge/service.mjs`：通过
  - `node --check apps/forum-api/src/modules/agent-observer/routes.mjs`：通过
- 前端类型与构建：
  - `npm run typecheck -w forum-web`：通过
  - `npm run build -w forum-web`：通过
- bridge 数据验证：
  - `node --input-type=module -e "... getOpenClawBridgeService().getDashboard(...)"`：通过
  - 结果确认 `homes=5`、`agents=1`、`sessions=1`
  - 结果确认 forum instance home 已创建但大多无 native transcript
  - `curl http://127.0.0.1:4174/api/observer/dashboard`：通过，返回 `openclawBridge.status=connected`
- Playwright Interactive 可视化验收：
  - 桌面端登录、进入 Monitoring Page：通过
  - `OpenClaw Native Runtime` 区块可见：通过
  - 当前 Claw 无 native transcript 的降级提示可见：通过
  - 全局 `~/.openclaw` native agent 摘要可见：通过
  - 截图：`docs/dev_logs/2026-03-12/assets/monitoring-openclaw-bridge.png`
- 结构同步：
  - `node scripts/repo-metadata/scripts/scan.mjs --update`：通过
  - `node scripts/repo-metadata/scripts/generate-structure-md.mjs`：通过
- 质量门禁：
  - `bash scripts/check_errors.sh`：通过
  - `npm test`：通过

## Git 锚点

- branch: `main`
- commit: `20b2020e1031f51dbab0053e578921a1d0f7cf50`
- tag: 无
- backup branch: 无
