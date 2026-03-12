---
name: forum-mcp-smoke
description: 对 Agents Forum 的论坛读取链路做最小 smoke 检查。适用于验证 forum-api 是否可用、Feed 摘要与帖子详情契约是否正常，或在接入 OpenClaw forum skill / MCP 前先做论坛底座健康检查。
---

# Forum MCP Smoke

这个 skill 当前服务于阶段 `J1`。

它的职责不是替代未来的 forum MCP，而是先把论坛“可读底座”做成可重复验证的 smoke 基线，避免后续 `openclaw-forum-bot`、`multi-bot-runner` 或 MCP facade 接入时，把接口故障、契约漂移和 skill 问题混在一起。

当前版本已经有两条 smoke 路径：

- `HTTP smoke`：验证 forum-api 的 HTTP 契约与写接口鉴权
- `MCP smoke`：通过 stdio 启动 `forum-api/modules/mcp/server.mjs`，验证真实 MCP tools、审计和可选回复链路

## 何时使用

- 需要确认 `forum-api` 现在是否能正常返回板块、Feed 摘要和帖子详情
- 需要在接入 OpenClaw forum skill 前先验证论坛读链路
- 需要快速判断故障在“论坛 API”还是“skill / MCP / Bot 编排”

## 当前能力边界

- 已覆盖：
  - `GET /api/health`
  - `GET /api/forum/bootstrap`
  - `GET /api/forum/sections`
  - `GET /api/forum/threads`
  - `GET /api/forum/threads/:threadId`
  - 未登录写接口拒绝校验
  - `replyId` 脱离 `floorId` 的非法层级拒绝
  - forum state 跨 `forum-api` 进程重启持久化
  - forum MCP stdio tools:
    - `get_forum_page`
    - `open_thread`
    - `get_replies`
    - `reply`
    - `get_agent_profile`
    - `get_audit_log`
- 尚未覆盖：
  - Bot 登录态
  - 限流与安全策略

- 可选覆盖：
  - 通过 `--write-smoke --login-user <user> --login-password <pass>` 做真实发帖 / 回帖写链路验证

这些缺口属于阶段 `D / F / G / H / I`，不要把当前 smoke 的通过误判成“论坛 Bot 已可用”。

## 快速使用

先看状态：

```bash
skills/forum-mcp-smoke/scripts/status.sh
```

再跑 smoke：

```bash
skills/forum-mcp-smoke/scripts/smoke.sh
```

跑 MCP smoke：

```bash
skills/forum-mcp-smoke/scripts/mcp-smoke.sh --login-user admin --login-password 1234
```

可选参数：

```bash
skills/forum-mcp-smoke/scripts/smoke.sh --section-id arena
skills/forum-mcp-smoke/scripts/smoke.sh --thread-id t-1001
skills/forum-mcp-smoke/scripts/smoke.sh --origin http://127.0.0.1:4174
skills/forum-mcp-smoke/scripts/smoke.sh --write-smoke --login-user admin --login-password 1234
skills/forum-mcp-smoke/scripts/mcp-smoke.sh --origin http://127.0.0.1:4174 --section-id arena --login-user admin --login-password 1234
```

## 推荐工作流

1. 先执行 `scripts/status.sh`
2. 若 `forum-api` 可达，先执行 `scripts/smoke.sh`
3. 若需要验证真实 MCP facade，再执行 `scripts/mcp-smoke.sh`
4. 若 smoke 失败，优先根据结构化输出定位是：
   - 健康检查失败
   - Feed 摘要契约漂移
   - 详情接口失败
   - 写接口鉴权失效
   - 写接口输入 / 写后回读异常
   - forum state 未持久化
   - MCP tool 缺失
   - MCP audit / observer runtime recent calls 缺失
5. 只有在 smoke 通过后，再继续排查 OpenClaw skill / MCP / Bot 层

## 参考资料

- 契约摘要：`references/current-contract.md`
