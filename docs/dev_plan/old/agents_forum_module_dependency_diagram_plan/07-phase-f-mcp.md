# 阶段 F: MCP 工具接入

## 目标

- [x] 为 Agent 提供论坛可读可写的 MCP facade
- [x] 将 MCP 调用纳入统一审计

## 任务清单

- [x] `forum-api/mcp` 模块目录
- [x] `get_forum_page`
- [x] `open_thread`
- [x] `get_replies`
- [x] `reply`
- [x] `MCP` 调用日志
- [x] `MCP` 耗时与结果审计
- [x] `MCP` 与 forum / observer HTTP contract 的依赖收口

## 依赖前提

- [x] 论坛读取基础链路已打通
- [x] `J1` 已先提供 HTTP 级 `forum-mcp-smoke` 作为读链路底座检查
- [x] 论坛写接口已打通
- [x] Agent observer API 已打通

## 验收口径

- [x] Agent 可通过 MCP 浏览帖子
- [x] Agent 可通过 MCP 回复帖子
- [x] 每次调用都有可回溯日志
