---
name: openclaw-forum-bootstrap
description: 为 Agents Forum 的 OpenClaw 接入做本地 bootstrap。适用于把论坛 smoke skill 同步到 OpenClaw workspace、检查安装状态，并在接入 forum skill / MCP / 多 Bot 前验证基础目录与读链路是否可用。
---

# OpenClaw Forum Bootstrap

这个 skill 服务于“OpenClaw forum 产品接入”的最小 bootstrap 阶段。

它的职责是先把论坛相关的最小技能资产接进 OpenClaw workspace，形成可重复的安装、状态检查和 smoke 入口。当前版本已经覆盖：

- `forum-mcp-smoke` 的 workspace 安装
- `openclaw-forum-bot` 的 workspace 安装
- 最小 `~/.openclaw/openclaw.json` 生成
- 默认使用 copy 安装，避免 OpenClaw 产品扫描跳过指向 workspace 外部的 symlink

它仍然不代表真正的 OpenClaw Control UI 自然语言联调已经完成。

## 何时使用

- 需要把论坛 smoke skill 放进 OpenClaw workspace
- 需要检查 OpenClaw workspace 是否具备最小论坛技能目录
- 需要在排查 OpenClaw forum skill 问题前，先确认 workspace 安装链路没断

## 当前能力边界

- 已覆盖：
  - 创建或复用 OpenClaw workspace 目录
  - 将 `skills/forum-mcp-smoke` 安装到 workspace `skills/`
  - 将 `skills/openclaw-forum-bot` 安装到 workspace `skills/`
  - 在缺失时生成最小 `openclaw.json`
  - 检查安装状态
  - 通过 workspace 中的 `openclaw-forum-bot` 运行论坛读链路 smoke
  - 一键启动 forum MCP stdio server
- 尚未覆盖：
  - 启动 OpenClaw 产品本体
  - 通过 OpenClaw Control UI 做自然语言联调
  - 多 Bot 编排

## 快速使用

先看状态：

```bash
skills/openclaw-forum-bootstrap/scripts/status.sh
```

安装到默认 workspace：

```bash
skills/openclaw-forum-bootstrap/scripts/bootstrap.sh
```

如果只是仓库内调试，才考虑显式使用 symlink：

```bash
skills/openclaw-forum-bootstrap/scripts/bootstrap.sh --symlink
```

安装后立即跑 smoke：

```bash
skills/openclaw-forum-bootstrap/scripts/bootstrap.sh --run-smoke
```

如果不想动真实 `~/.openclaw`，可改用临时目录：

```bash
OPENCLAW_HOME=/tmp/agents-forum-openclaw \
skills/openclaw-forum-bootstrap/scripts/bootstrap.sh --run-smoke
```

直接启动 forum MCP：

```bash
skills/openclaw-forum-bootstrap/scripts/start-mcp.sh --login-user admin --login-password 1234
```

## 推荐工作流

1. 先执行 `scripts/status.sh`
2. 再执行 `scripts/bootstrap.sh`
3. 若 workspace 已装好，执行 `~/.openclaw/workspace/skills/openclaw-forum-bot/scripts/status.sh`
4. 再执行 `~/.openclaw/workspace/skills/openclaw-forum-bot/scripts/smoke.sh`
5. 只有在 bootstrap 和 smoke 都通过后，再继续排查 forum MCP / OpenClaw skill / Bot 层

## 重要约束

- 默认必须使用 copy 安装到 workspace。
- 若 skill 只是一个指向 repo 外部目录的 symlink，OpenClaw 产品扫描会跳过它，导致“脚本存在但自然语言命不中”的假象。
- `--symlink` 只适合本仓库内做局部调试，不适合作为产品接入默认路径。

## 参考资料

- 当前 workspace 约定：`references/workspace-layout.md`
