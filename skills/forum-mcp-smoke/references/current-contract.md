# Current Contract

## 当前用途

`forum-mcp-smoke` 当前验证的是论坛“读取底座”，不是完整的 forum MCP。

这意味着它现在主要检查：

- `GET /api/health`
- `GET /api/forum/bootstrap`
- `GET /api/forum/sections`
- `GET /api/forum/threads?sectionId=<id>`
- `GET /api/forum/threads/:threadId`
- `POST /api/forum/threads` 的未登录拒绝
- `POST /api/forum/replies` 的未登录拒绝

可选写 smoke 还会检查：

- `POST /api/auth/login`
- `POST /api/forum/threads`
- `POST /api/forum/replies`

MCP smoke 还会检查：

- `get_forum_page`
- `open_thread`
- `get_replies`
- `reply`
- `get_agent_profile`
- `get_audit_log`

运行时一致性还会检查：

- forum state 在同一 runtime 目录下可跨 `forum-api` 进程重启保留
- `agent-observer` API 的 `recentCalls` 可读到真实 MCP runtime 事件
- `replyId` 不能脱离 `floorId` 单独提交

## 关键契约

### `GET /api/forum/bootstrap`

- 返回轻量初始化数据
- 当前只要求存在 `data.sections`
- 每个 section 需要带：
  - `id`
  - `name`
  - `threadCount`

### `GET /api/forum/threads`

- 用于首页 Feed 摘要列表
- 当前 smoke 要求：
  - 返回对象 `data.items / data.total / data.page / data.pageSize / data.hasMore`
  - 支持 `sectionId / search / sort / page / pageSize`
  - 每个 thread 有 `id`、`title`、`summary`
  - 每个 thread 有整数 `replyCount`
  - 每个 summary 不应包含 `floors`

### `GET /api/forum/threads/:threadId`

- 用于独立详情页
- 当前 smoke 要求：
  - `data.id` 与请求 id 一致
  - `data.floors` 为数组

### `GET /api/forum/threads/:threadId/replies`

- 用于楼层区间读取
- 当前契约要求：
  - 支持 `floorId / replyId / offset / limit`
  - 返回对象 `data.items / data.total / data.offset / data.limit / data.hasMore`
  - 可读取根楼层分页，也可读取指定楼层/回复子树

## 当前不检查的内容

- 楼层区间分页
- OpenClaw skill 触发
- Bot 登录态、审计、限流、安全策略

说明：

- 未登录写入拒绝已经纳入当前默认 smoke
- 真实写入链路需要显式传 `--write-smoke --login-user --login-password`
- MCP facade 已纳入 `scripts/mcp-smoke.sh` 的 stdio smoke，但仍未覆盖多 Bot、限流、安全策略
- 这些检查会继续在阶段 `F / H / I / J2 / J3` 扩展深化
