# 26. openclaw-product-bootstrap-contract

## 用户原始请求

> 我完全同意你的看法，请开始工作吧

## 轮次记录

- 背景：
  - 当前监控路线已跑通，下一阶段真正的 L0 转向 OpenClaw 产品内真实接入。
  - 现有仓库虽然已有 `openclaw-forum-bot` 和 `openclaw-forum-bootstrap`，但仍缺少：
    - 明确的 workspace skill 安装/发现合同
    - 最小 `openclaw.json` 配置生成
    - 单 Bot 产品接入 smoke
    - repo 级统一 bootstrap/check 入口
- 本轮目标：
  - 把 OpenClaw forum 接入补成可重复执行的最小产品合同。
  - 用临时 `OPENCLAW_HOME` 跑通 bootstrap、check、skill smoke 和写入 smoke。

## 修改时间

- 开始：2026-03-12 19:10:40 +0800
- 结束：2026-03-12 19:14:20 +0800

## 文件清单

- `skills/openclaw-forum-bot/SKILL.md` / 更新 / 2026-03-12 19:14:20 +0800 / 补充自然语言触发语义、产品接入约定和新脚本入口
- `skills/openclaw-forum-bot/scripts/status.sh` / 更新 / 2026-03-12 19:14:20 +0800 / 状态输出增加 config、install-check、smoke
- `skills/openclaw-forum-bot/scripts/install-check.sh` / 新增 / 2026-03-12 19:14:20 +0800 / 检查 workspace skill、helper skill、config 和 forum MCP 路径
- `skills/openclaw-forum-bot/scripts/smoke.sh` / 新增 / 2026-03-12 19:14:20 +0800 / 验证 workspace forum skill 读链路、登录和可选写入 smoke
- `skills/openclaw-forum-bootstrap/SKILL.md` / 更新 / 2026-03-12 19:14:20 +0800 / 将 bootstrap 定位升级为最小产品接入合同，而不再只是 smoke 安装器
- `skills/openclaw-forum-bootstrap/references/workspace-layout.md` / 更新 / 2026-03-12 19:14:20 +0800 / 回写 workspace 中同时安装 `forum-mcp-smoke` 与 `openclaw-forum-bot` 的布局
- `skills/openclaw-forum-bootstrap/scripts/bootstrap.sh` / 更新 / 2026-03-12 19:14:20 +0800 / 新增 `openclaw.json` 生成、forum skill 安装和更完整的初始化输出
- `skills/openclaw-forum-bootstrap/scripts/install-check.sh` / 更新 / 2026-03-12 19:14:20 +0800 / 增加 config 和 forum skill 检查
- `skills/openclaw-forum-bootstrap/scripts/status.sh` / 更新 / 2026-03-12 19:14:20 +0800 / 输出 config 与 forum skill 状态
- `scripts/openclaw/bootstrap-openclaw-forum.sh` / 新增 / 2026-03-12 19:14:20 +0800 / repo 级 OpenClaw forum bootstrap 入口
- `scripts/openclaw/check-openclaw-forum.sh` / 新增 / 2026-03-12 19:14:20 +0800 / repo 级 OpenClaw forum 安装检查入口
- `docs/dev_plan/openclaw-multi-bot-forum-plan.md` / 更新 / 2026-03-12 19:14:20 +0800 / 回写里程碑 4 的最小产品接入合同进度
- `docs/architecture/repo-metadata.json` / 更新 / 2026-03-12 19:14:20 +0800 / 结构扫描同步新脚本目录
- `docs/architecture/repository-structure.md` / 更新 / 2026-03-12 19:14:20 +0800 / 重新生成结构文档
- `docs/dev_logs/2026-03-12/26-openclaw-product-bootstrap-contract.md` / 新增 / 2026-03-12 19:14:20 +0800 / 本轮开发日志

## 变更说明

### 1. 建立最小 OpenClaw 产品接入合同

- `openclaw-forum-bootstrap` 不再只安装 `forum-mcp-smoke`。
- 当前 bootstrap 会同时：
  - 创建/复用 OpenClaw workspace
  - 安装 `forum-mcp-smoke`
  - 安装 `openclaw-forum-bot`
  - 在缺失时生成最小 `openclaw.json`
- 这样做的业务价值是把“论坛能力存在于 workspace skill 中”这件事真正固定下来，后续自然语言联调时不再需要人工拼装目录。

### 2. 补齐 forum skill 的 install-check 和 smoke

- `openclaw-forum-bot` 新增：
  - `install-check.sh`
  - `smoke.sh`
- `smoke.sh` 现在可以验证：
  - workspace skill 已安装
  - forum 读链路 smoke 可跑
  - 登录可用
  - 在 `--write-smoke` 下真实落帖/回帖可跑
- 这样至少把“产品接入前的最小单 Bot 合同”补成可重复脚本，而不是只靠文档说明。

### 3. 补 repo 级统一入口

- 新增：
  - `scripts/openclaw/bootstrap-openclaw-forum.sh`
  - `scripts/openclaw/check-openclaw-forum.sh`
- 这样做的目的是把产品接入入口提升到 repo 级，不要求使用者记住 skill 目录里的具体脚本路径。

### 4. 修复临时 OpenClaw home 的配置路径问题

- 初版 bootstrap 在临时 `OPENCLAW_HOME` 下虽然能生成 `openclaw.json`，但 workspace 路径仍写成默认 `~/.openclaw/workspace`。
- 本轮已修复：
  - 默认环境写 `~/.openclaw/workspace`
  - 自定义 `OPENCLAW_HOME` / `OPENCLAW_WORKSPACE` 时写真实路径
- 这是本轮发现并当场修复的实际问题，否则临时环境下的 bootstrap 只能算伪通过。

## 风险与边界

- 本轮仍未接入 OpenClaw gateway / Control UI，自然语言命中尚未完成。
- 当前只建立了“最小产品接入合同”，还不等于真正完成产品内自然语言联调。
- 当前工作树原本已有大量未提交变更，本轮未回退这些内容。

## 验证结果

- 脚本语法：
  - `bash -n skills/openclaw-forum-bot/scripts/install-check.sh skills/openclaw-forum-bot/scripts/smoke.sh skills/openclaw-forum-bootstrap/scripts/bootstrap.sh skills/openclaw-forum-bootstrap/scripts/install-check.sh skills/openclaw-forum-bootstrap/scripts/status.sh scripts/openclaw/bootstrap-openclaw-forum.sh scripts/openclaw/check-openclaw-forum.sh`：通过
- 本地服务：
  - `GET http://127.0.0.1:4174/api/health`：通过
- 产品接入合同验证：
  - `OPENCLAW_HOME=/tmp/agents-forum-openclaw.a0dIMv scripts/openclaw/bootstrap-openclaw-forum.sh --force`：通过
  - `OPENCLAW_HOME=/tmp/agents-forum-openclaw.a0dIMv scripts/openclaw/check-openclaw-forum.sh`：通过
  - `OPENCLAW_HOME=/tmp/agents-forum-openclaw.a0dIMv ~/.openclaw/workspace/skills/openclaw-forum-bot/scripts/smoke.sh ...`：
    - 说明：实际以临时 workspace 中的 `openclaw-forum-bot/scripts/smoke.sh` 运行
    - 读链路 smoke：通过
    - 登录验证：通过
    - `--write-smoke`：通过，真实帖子创建、回复和回读均通过
  - `OPENCLAW_HOME=/tmp/agents-forum-openclaw.3RgsED scripts/openclaw/bootstrap-openclaw-forum.sh --force`：通过
    - 并验证生成的 `openclaw.json` 中 `workspace` 指向临时目录，而不是错误写死默认路径
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
