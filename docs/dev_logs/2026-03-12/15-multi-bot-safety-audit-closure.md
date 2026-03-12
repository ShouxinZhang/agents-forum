# 15. multi-bot-safety-audit-closure

## 用户原始请求

> 跑通最后闭环，用playwright interacitve skill和其它skill完成测试。
>
> 直接干就行了，continue

## 轮次记录

- 背景：阶段 `I / J3 / G` 还缺最后一段多 Bot 闭环。
- 本轮目标：
  - 落地 `bot-content-safety-check`
  - 落地 `forum-audit-viewer`
  - 把 `multi-bot-runner` 接入安全检查并跑通
  - 用 `playwright-interactive` 完成前端权限与审计回归
  - 回写计划、结构文档和验证记录

## 修改时间

- 开始：2026-03-12 16:28:25 +0800
- 结束：2026-03-12 16:38:40 +0800

## 文件清单

- `package.json`：modified，新增 `playwright` 开发依赖。
- `package-lock.json`：modified，同步依赖锁文件。
- `apps/forum-api/src/modules/mcp/forum-client.mjs`：modified，修复 actor 凭据透传与 reply 返回值组装。
- `apps/forum-web/src/App.tsx`：modified，补观察者只读 UI 权限收敛与角色徽章展示。
- `skills/bot-content-safety-check/SKILL.md`：added，Bot 内容安全检查 skill。
- `skills/bot-content-safety-check/references/rules.md`：added，最小治理规则说明。
- `skills/bot-content-safety-check/scripts/check-content.mjs`：added，可导入也可 CLI 运行的安全检查脚本。
- `skills/bot-content-safety-check/scripts/status.sh`：added，skill 状态检查。
- `skills/bot-content-safety-check/scripts/smoke.sh`：added，self-test smoke。
- `skills/forum-audit-viewer/SKILL.md`：added，多 Bot 审计查看 skill。
- `skills/forum-audit-viewer/scripts/view-audit.mjs`：added，聚合 runtime events 与 thread Bot replies。
- `skills/forum-audit-viewer/scripts/status.sh`：added，skill 状态检查。
- `skills/forum-audit-viewer/scripts/smoke.sh`：added，审计查看 smoke。
- `skills/multi-bot-runner/SKILL.md`：modified，补安全检查与审计说明。
- `skills/multi-bot-runner/scripts/status.sh`：modified，增加安全 skill 依赖检查。
- `skills/multi-bot-runner/scripts/run.mjs`：modified，接入 `bot-content-safety-check` 并回传 audit trail。
- `skills/openclaw-forum-bot/references/posting-policy.md`：modified，回写独立 Bot 账号体系和安全链路事实。
- `docs/dev_plan/openclaw-forum-bot-safety-policy.md`：modified，补最小治理落地说明。
- `docs/dev_plan/agents_forum_module_dependency_diagram_plan.md`：modified，回写 `G / H / I / J` 阶段状态。
- `docs/dev_plan/agents_forum_module_dependency_diagram_plan/00-overview.md`：modified，回写多 Bot / 安全 / 审计主干落地结果。
- `docs/dev_plan/agents_forum_module_dependency_diagram_plan/08-phase-g-quality.md`：modified，勾选自动化验证和 API 集成测试。
- `docs/dev_plan/agents_forum_module_dependency_diagram_plan/09-phase-h-openclaw-skill.md`：modified，勾选 Bot 账号登录/会话方案。
- `docs/dev_plan/agents_forum_module_dependency_diagram_plan/10-phase-i-multi-claw-bots.md`：modified，勾选 Bot 账号、persona、安全与审计主干。
- `docs/dev_plan/agents_forum_module_dependency_diagram_plan/11-phase-j-skill-dev-and-test.md`：modified，勾选 `multi-bot-runner / forum-audit-viewer / bot-content-safety-check` 和 J3 验证结果。
- `docs/architecture/repo-metadata.json`：modified，补新 skill / bot-auth / dev_plan 节点。
- `docs/architecture/repository-structure.md`：modified，补新技能目录结构。

## 变更说明

### 1. 多 Bot 安全闭环

- 新增 `bot-content-safety-check` skill，把“详情已读 / replies 已读 / 长度 / 敏感词 / 重复度 / 灌水短语”收成结构化 `allow / reject / reasons / riskScore`。
- `multi-bot-runner` 现在会在每个 Bot 回帖前执行安全检查；不再是“策略写在文档里，runner 仍然裸回帖”。

### 2. 多 Bot 审计闭环

- 新增 `forum-audit-viewer` skill，从 runtime events 与线程详情聚合：
  - Agent recent calls
  - 工具耗时与结果
  - 指定帖子中的 Bot replies
- `multi-bot-runner` 末尾会把当前 MCP 进程内 audit trail 一并带回，便于快速看 smoke 结果。

### 3. 前端只读角色收敛

- `claw-mod` 现在不仅后端被 `403` 拒绝，前端也会隐藏：
  - 新建帖子入口
  - 楼层回复按钮
  - 发布回复按钮
  - “模拟 A/B/C 讨论”按钮
- 详情页改为明确显示“观察者只能阅读和查看审计”。

### 4. 联调环境修复

- 发现 `127.0.0.1:4174` 上仍在跑旧 `forum-api` 进程，导致 `claw-a` 登录失败。
- 已停止旧进程并重新拉起新代码，再次验证多 Bot runner 与前端回归。

### 5. 仓库结构同步

- 为了让 repo-metadata 扫描到当前未提交新增文件，先对新增路径做了 `git add -N`。
- 之后执行了 `scan.mjs --update`、`generate-structure-md.mjs`、`sync-json-to-sqlite.mjs`。
- `scan` 会按规则把 `docs/dev_logs/**` 从元数据中移除；这不影响日志文件本身。

## 风险控制

- 安全检查仍是 smoke 级治理，不是生产级审核引擎。
- 配额、冷却、审批流、真正的数据库层仍未完成。
- `forum-audit-viewer` 当前主要依赖 runtime events 和 thread detail，尚未形成跨进程统一审计仓。
- `openclaw-forum-bot` 的自然语言触发联调仍未完成。

## 验证结果

- `npm install -D playwright`：完成，workspace 内可导入 `playwright`
- `skills/bot-content-safety-check/scripts/status.sh`：通过
- `skills/bot-content-safety-check/scripts/smoke.sh`：通过
- `printf ... | node skills/bot-content-safety-check/scripts/check-content.mjs`：按预期返回 `reject`
- `skills/multi-bot-runner/scripts/status.sh`：通过
- `skills/multi-bot-runner/scripts/smoke.sh`：通过
- `node skills/forum-audit-viewer/scripts/view-audit.mjs --thread-id t-1773256614502-5857`：通过，可看到 `claw-a / claw-b / claw-c` 的 recent calls 与 thread replies
- `curl` 使用 `claw-mod` token 调用 `POST /api/forum/replies`：返回 `403 Forbidden`
- Playwright：
  - 登录页显示 `claw-a / claw-b / claw-c / claw-mod`
  - `claw-a` 登录后可见 Agent 角色与 Inspector recent calls
  - `claw-mod` 登录后可见观察者/只读模式
  - `claw-mod` 在详情页看不到回复按钮、发布回复按钮和“模拟 A/B/C 讨论”
- `bash scripts/check_errors.sh`：通过
- `npm test`：通过

## Git 锚点

- branch: `main`
- commit: `20b2020e1031f51dbab0053e578921a1d0f7cf50`
- tag: 无
- backup branch: 无
