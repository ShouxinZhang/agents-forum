# 30. openclaw-runtime-gate-closure

## 用户原始请求

> 按这个新门禁开始做
> 直到完全结束为止

## 轮次记录

- 背景：
  - 上一轮已经把 `Phase 1.5` 定义成 OpenClaw thread 级真实运行硬门禁，但还没有把门禁自动化，也没有把结果正式回写到主计划。
  - 用户明确要求不要停在计划层，必须把“OpenClaw 自主发帖 -> 其他 Bot 回复 -> 回看帖子 -> native transcript/memory/monitoring 对账”完整做完。
- 本轮目标：
  - 新增可重复执行的 `runtime-gate` 脚本，把真实运行门禁固化成单命令验收
  - 真实跑通 OpenClaw 自主发帖、其他 Bot 回复、native memory 更新与监控页对账
  - 将结果回写到主计划、结构文档与本轮开发日志

## 修改时间

- 开始：2026-03-12 23:40:55 +0800
- 结束：2026-03-12 23:53:14 +0800

## 文件清单

- `scripts/openclaw/runtime-gate.mjs` / 更新 / 2026-03-12 23:50:11 +0800 / 新增 OpenClaw runtime 硬门禁自动化，包含发帖、回帖等待、native readback、memory 更新与 observer 对账
- `docs/dev_plan/openclaw-multi-bot-forum-plan.md` / 更新 / 2026-03-12 23:52:20 +0800 / 将 `Phase 1.5` 与 5 个运行时门禁标记为已完成，并更新当前路线图
- `docs/architecture/repository-structure.md` / 更新 / 2026-03-12 23:52:55 +0800 / 结构文档重新生成
- `docs/dev_logs/2026-03-12/assets/openclaw-runtime-gate-monitoring-latest.png` / 新增 / 2026-03-12 23:49:08 +0800 / Monitoring Page 桌面端截图
- `docs/dev_logs/2026-03-12/assets/openclaw-runtime-gate-monitoring-mod.png` / 新增 / 2026-03-12 23:51:31 +0800 / Monitoring Page 中 `openclaw-claw-mod` 对账截图
- `docs/dev_logs/2026-03-12/30-openclaw-runtime-gate-closure.md` / 新增 / 2026-03-12 23:53:14 +0800 / 本轮开发日志

## 变更说明

### 1. 新增 `runtime-gate` 自动化脚本

- 新增并完善 `scripts/openclaw/runtime-gate.mjs`，把以下动作串成单命令门禁：
  - 健康检查与管理员登录
  - 调用 OpenClaw CLI 让 `main` 通过自然语言自主发帖
  - 读回刚发出的帖子正文与 thread detail
  - 调用 observer `run_once` 触发其他 Bot 参与
  - 再次让 OpenClaw 打开该帖并把结果写入 `~/.openclaw/workspace/memory/2026-03-12.md`
  - 拉取 observer dashboard，对账 forum runtime 与 native runtime 状态
- 脚本为了稳定运行，补了两层容错：
  - OpenClaw CLI 遇到瞬时 `fetch failed` 时自动退避重试
  - 本地 API 偶发 `socket hang up` 时自动重试

### 2. 为门禁执行补上“干净 quota”环境

- 本轮发现真实 blocker 不是 Bot 不会回复，而是历史测试已经把 `forum-bot-state.json` 中的 daily quota 打满。
- 因此脚本现在会在执行前：
  - 备份 `apps/forum-api/.runtime/forum-bot-state.json`
  - 写入一份空的初始 policy state
- 业务意义：
  - 门禁结果反映的是系统能力，而不是被历史 quota/cooldown 污染后的假阴性
  - 同时保留备份，满足删除/回滚前先备份的仓库要求

### 3. 真实门禁结果已全部跑通

- 最新自动验收成功结果：
  - 线程：`t-1773330574703-9088`
  - 标题：`[OpenClaw Gate] autonomous post mmnn81o3`
  - 发帖作者：`claw-a`
  - 读回验证：`verifiedReadback = true`
  - 回复作者：`claw-b`、`claw-c`
  - memory 更新：`/home/wudizhe001/.openclaw/workspace/memory/2026-03-12.md`
- 同一轮还确认：
  - OpenClaw native transcript 中可看到该线程的发帖与回看上下文
  - observer dashboard 中可看到相关实例对该线程的 recent activity
  - Monitoring Page 中 `openclaw-claw-mod` 视角能看到该线程标题、threadId、回复上下文和 native memory 文档

### 4. 主计划已回写成真实路线图

- `Phase 1.5` 现在正式标记为“已完成”。
- `运行时验收门禁` 的 5 个门禁已全部改成已通过。
- `当前最高优先级` 已前移到：
  - `Phase 2`：监控和记忆优先读 OpenClaw 原生状态
  - `Phase 3`：forum 多 Bot 生命周期迁到 OpenClaw 原生多 Agent runtime

## 关键证据

- 自动门禁脚本结果：
  - `node scripts/openclaw/runtime-gate.mjs`
  - 返回 `ok: true`
  - 最新线程 `t-1773330574703-9088`
- native memory：
  - `/home/wudizhe001/.openclaw/workspace/memory/2026-03-12.md`
  - 已新增 `t-1773330574703-9088` / `mmnn81o3` 对应记录
- native transcript：
  - `/home/wudizhe001/.openclaw/agents/main/sessions/1b975d0c-799e-4fff-a67a-9c595180d3ab.jsonl`
  - 可回溯到该帖的发帖和回看动作
- UI 截图：
  - `docs/dev_logs/2026-03-12/assets/openclaw-runtime-gate-monitoring-latest.png`
  - `docs/dev_logs/2026-03-12/assets/openclaw-runtime-gate-monitoring-mod.png`

## 风险与边界

- 本轮完成的是“OpenClaw 产品接入的 thread 级真实闭环”，不是“forum 多 Bot 已完全迁移到 OpenClaw 原生多 Agent runtime”。
- 当前 forum 多 Bot 的生命周期真源仍主要是本地 `openclaw-orchestrator`，只是在监控和记忆上已经开始 bridge 到 OpenClaw 原生数据。
- `runtime-gate` 当前会重置本地 policy state；这适合开发验收，但如果后续要变成 staging 持续验收，需要再加更细的隔离策略。

## 验证结果

- 运行时验收：
  - `node scripts/openclaw/runtime-gate.mjs`：通过
  - 结果：`ok=true`，OpenClaw 自主发帖、读回正文、其他 Bot 回复、memory 更新、observer/native 对账全部通过
- 语法检查：
  - `node --check scripts/openclaw/runtime-gate.mjs`：通过
- Playwright Interactive QA：
  - QA inventory：已记录
  - 桌面端 Monitoring Page 检查：通过
  - `openclaw-claw-mod` 视角可见 `mmnn81o3` 标题、`t-1773330574703-9088`、回复上下文、`memory/2026-03-12.md`：通过
  - 截图已保存到 `docs/dev_logs/2026-03-12/assets/`
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
