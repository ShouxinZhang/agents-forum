# 27. openclaw-natural-language-forum-hit

## 用户原始请求

> 哦哦，那赶紧做啊，不然不是和静态web没区别吗

## 轮次记录

- 背景：
  - 上一轮已经确认真实卡点不是 forum 能力本身，而是 OpenClaw 产品扫描 workspace 时会跳过解析后落在 workspace 外部的 skill symlink。
  - 进一步联调又暴露了第二个实际问题：改成 copy 安装后，workspace 副本里的 skill 会丢失源码仓库上下文，导致 `status / install-check / start-mcp / mcp-smoke` 仍然按错误路径找 repo。
- 本轮目标：
  - 让 OpenClaw 产品侧稳定发现 `openclaw-forum-bot`
  - 修复 copy 安装后的 workspace skill 上下文丢失问题
  - 用真实 OpenClaw 自然语言会话验证 `Feed -> Detail -> Summary` 读链路

## 修改时间

- 开始：2026-03-12 19:27:40 +0800
- 结束：2026-03-12 19:35:33 +0800

## 文件清单

- `skills/openclaw-forum-bootstrap/scripts/bootstrap.sh` / 更新 / 2026-03-12 19:35:33 +0800 / 默认改为 copy 安装，并在复制后的 workspace skill 中写入源码仓库 marker
- `skills/openclaw-forum-bootstrap/scripts/install-check.sh` / 更新 / 2026-03-12 19:35:33 +0800 / 增加“workspace 外部 symlink 会被 OpenClaw 跳过”的定位检查
- `skills/openclaw-forum-bootstrap/scripts/start-mcp.sh` / 更新 / 2026-03-12 19:35:33 +0800 / 支持从复制后的 skill marker 解析源码仓库路径
- `skills/openclaw-forum-bootstrap/SKILL.md` / 更新 / 2026-03-12 19:35:33 +0800 / 回写 copy 为产品默认安装方式及 symlink 风险
- `skills/openclaw-forum-bootstrap/references/workspace-layout.md` / 更新 / 2026-03-12 19:35:33 +0800 / 回写 workspace copy 布局与 source-root 约定
- `skills/openclaw-forum-bot/SKILL.md` / 更新 / 2026-03-12 19:35:33 +0800 / 回写 OpenClaw 产品扫描会跳过 workspace 外部 symlink 的约束
- `skills/openclaw-forum-bot/scripts/bootstrap.sh` / 更新 / 2026-03-12 19:35:33 +0800 / 默认改为 copy，且复制后仍可通过 marker 找回 repo helper
- `skills/openclaw-forum-bot/scripts/install-check.sh` / 更新 / 2026-03-12 19:35:33 +0800 / 增加 workspace 定位检查，并支持从 marker 解析源码仓库
- `skills/openclaw-forum-bot/scripts/status.sh` / 更新 / 2026-03-12 19:35:33 +0800 / 复制后的 workspace skill 也能正确显示 repo MCP 路径与 helper 状态
- `skills/openclaw-forum-bot/scripts/start-mcp.sh` / 更新 / 2026-03-12 19:35:33 +0800 / 复制后的 skill 也能正确定位 repo 的 MCP server
- `skills/forum-mcp-smoke/scripts/mcp-smoke.mjs` / 更新 / 2026-03-12 19:35:33 +0800 / 通过 source-root marker 从 repo 解析 `@modelcontextprotocol/sdk`，修复 copied skill 的 MCP smoke
- `docs/dev_plan/openclaw-multi-bot-forum-plan.md` / 更新 / 2026-03-12 19:35:33 +0800 / 回写“自然语言读链路已跑通，剩余缺口为写入/审计闭环、长稳、治理”
- `docs/architecture/repo-metadata.json` / 更新 / 2026-03-12 19:35:33 +0800 / 结构扫描同步本轮脚本与日志变更
- `docs/architecture/repository-structure.md` / 更新 / 2026-03-12 19:35:33 +0800 / 重新生成仓库结构文档
- `docs/dev_logs/2026-03-12/27-openclaw-natural-language-forum-hit.md` / 新增 / 2026-03-12 19:35:33 +0800 / 本轮开发日志

## 变更说明

### 1. 把产品侧默认安装方式改成 copy

- `openclaw-forum-bootstrap` 与 `openclaw-forum-bot` 的 bootstrap 默认都从 `symlink` 改为 `copy`。
- 同时保留 `--symlink`，但明确标注只适合仓库内调试，不适合作为 OpenClaw 产品接入默认路径。
- 这样做的业务价值是避免“脚本目录存在，但 OpenClaw 产品扫描不到 skill”的假阳性。

### 2. 为复制后的 workspace skill 补 source-root 上下文

- 在 copy 安装时，bootstrap 会给 `forum-mcp-smoke` 与 `openclaw-forum-bot` 写入 `.agents-forum-source-root`。
- `status / install-check / start-mcp / mcp-smoke` 现在都能优先读取这个 marker，回到真实源码仓库继续定位：
  - forum MCP server
  - helper bootstrap
  - repo 级 node_modules
- 这样复制后的 workspace 副本不再因为“失去 repo 根路径”而在产品环境里半残。

### 3. 给 install-check 增加真实错误指向

- `install-check.sh` 现在不只看“路径存不存在”，还会检查目标 skill 解析后是否仍位于 workspace 内。
- 如果目标解析后落到 workspace 外部，会直接输出 `FAIL` 并提示：
  - OpenClaw 产品会跳过 workspace 外部 skill
- 这样未来再遇到自然语言命不中，不需要再靠猜。

### 4. 完成 OpenClaw 产品内自然语言读链路联调

- 真实 OpenClaw 默认 workspace 中，`openclaw skills list --json` 已能看到：
  - `forum-mcp-smoke`
  - `openclaw-forum-bot`
- 真实自然语言联调已在 session transcript 中确认：
  - OpenClaw 读取 `~/.openclaw/workspace/skills/openclaw-forum-bot/SKILL.md`
  - 读取 `references/forum-actions.md`
  - 读取并使用 `scripts/status.sh` / `scripts/smoke.sh`
  - 实际请求 `http://127.0.0.1:4174/api/forum/threads?...`
  - 实际请求 `http://127.0.0.1:4174/api/forum/threads/t-1001`
  - 最终输出基于真实论坛数据的中文总结，且未回帖

### 5. 修复 copied MCP smoke

- `forum-mcp-smoke/scripts/mcp-smoke.mjs` 现在不再依赖 copied workspace 的模块解析。
- 它会通过 source-root marker 回到 repo，用 repo 的 `package.json` 解析 `@modelcontextprotocol/sdk`。
- 结果是 copied workspace 里的 `node .../mcp-smoke.mjs` 也能直接通过。

## 风险与边界

- 本轮已打通的是 OpenClaw 产品侧自然语言读链路，不代表“自然语言写入 + 审计回溯 + 审批 UI”已经全部完成。
- `openclaw agent --json` 这轮 CLI 验证在当前环境里没有稳定返回最终 JSON 到调用端，但 session transcript 已完整记录了 skill 命中、真实请求和最终答案，因此本轮以 transcript 作为产品联调证据。
- 当前工作树原本已有大量未提交变更，本轮未回退这些内容。

## 验证结果

- 脚本/JS 语法：
  - `bash -n skills/openclaw-forum-bootstrap/scripts/bootstrap.sh skills/openclaw-forum-bootstrap/scripts/start-mcp.sh skills/openclaw-forum-bot/scripts/bootstrap.sh skills/openclaw-forum-bot/scripts/install-check.sh skills/openclaw-forum-bot/scripts/status.sh skills/openclaw-forum-bot/scripts/start-mcp.sh`：通过
  - `node --check skills/forum-mcp-smoke/scripts/mcp-smoke.mjs`：通过
- 本地服务：
  - `GET http://127.0.0.1:4174/api/health`：通过
- 产品安装与发现：
  - `scripts/openclaw/bootstrap-openclaw-forum.sh --force`：通过
  - `node /home/wudizhe001/Documents/GitHub/openclaw-test/third_party/openclaw/openclaw.mjs skills list --json | rg 'forum-mcp-smoke|openclaw-forum-bot'`：通过
- workspace 副本自检：
  - `~/.openclaw/workspace/skills/openclaw-forum-bot/scripts/status.sh`：通过
  - `~/.openclaw/workspace/skills/openclaw-forum-bot/scripts/install-check.sh`：通过
  - `~/.openclaw/workspace/skills/openclaw-forum-bot/scripts/smoke.sh --origin http://127.0.0.1:4174`：通过
  - `node ~/.openclaw/workspace/skills/forum-mcp-smoke/scripts/mcp-smoke.mjs --origin http://127.0.0.1:4174`：通过
- OpenClaw 产品自然语言联调：
  - 证据文件：`~/.openclaw/agents/main/sessions/1b975d0c-799e-4fff-a67a-9c595180d3ab.jsonl`
  - transcript 已确认：
    - 读取 `openclaw-forum-bot/SKILL.md`
    - 读取 `references/forum-actions.md`
    - 实际读取论坛 feed 与帖子详情
    - 输出基于真实结果的中文总结
    - 未执行回帖
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
