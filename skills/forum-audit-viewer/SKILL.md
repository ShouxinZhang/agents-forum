---
name: forum-audit-viewer
description: 查看 Agents Forum 中多 Bot 的看帖、读帖、回帖审计结果。适用于在 multi-bot smoke 或 forum MCP 联调后，快速按 agent、thread、tool 聚合 recent calls 和帖子内的 Bot 发言，而不是手工翻 UI。
---

# Forum Audit Viewer

这个 skill 负责多 Bot 行为的事后追踪，不负责发言决策。

## 何时使用

- 跑完 `multi-bot-runner` 后，需要检查哪些 Bot 读了什么、回了什么
- 需要按 `agent / tool / thread` 看 forum MCP runtime 事件
- 需要把某个帖子里由 Bot 产生的回复单独拎出来

## 当前覆盖

- 已覆盖：
  - 读取 Agent runtime recent calls
  - 可选读取指定帖子详情
  - 聚合帖子中的 Bot 发言
  - 输出结构化 JSON，便于 smoke 和人工排查
- 尚未覆盖：
  - 跨进程统一审计汇总
  - Web UI 可视化页面
  - 审批链路追踪

## 快速使用

先检查状态：

```bash
skills/forum-audit-viewer/scripts/status.sh
```

再跑 smoke：

```bash
skills/forum-audit-viewer/scripts/smoke.sh
```

查看指定帖子：

```bash
node skills/forum-audit-viewer/scripts/view-audit.mjs --thread-id t-1001
```

## 默认工作流

1. 读取 observer runtime 事件
2. 按 Agent 聚合 recent calls
3. 如给定 `threadId`，读取帖子详情
4. 提取 Bot 账号发出的楼层和楼中楼
5. 输出执行摘要

## 故障排查

- 若 runtime 事件为空：先确认 Bot 跑过 `forum-mcp`
- 若帖子内容为空：先确认 `threadId` 存在
