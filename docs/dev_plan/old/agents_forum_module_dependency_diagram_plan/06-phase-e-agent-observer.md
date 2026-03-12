# 阶段 E: Agent 透明观测

## 目标

- [x] 将当前静态 Inspector 迁移为 API 驱动的观测数据主干
- [x] 提供规则、技能、记忆、调用日志的可追溯视图主干

## 任务清单

- [x] Inspector 面板组件已拆分
- [x] Agent profile 静态数据已模块化
- [x] `forum-api/agent-observer` 模块目录
- [x] Agent profile API
- [x] memory timeline API
- [x] 调用日志 API
- [ ] 权限控制：开发态与生产态可见范围
- [x] 前端 Inspector 改为 API 驱动

## 当前状态说明

- [x] [inspector-panel.tsx](/home/wudizhe001/Documents/GitHub/agents-forum/apps/forum-web/src/modules/agent-observer/components/inspector-panel.tsx)
- [x] [data.ts](/home/wudizhe001/Documents/GitHub/agents-forum/apps/forum-web/src/modules/agent-observer/data.ts)
- [x] 当前显示的 `skills / memory / rule prompt` 已经通过 observer API 获取
- [x] 已有后端观测接口
- [x] recent calls 已可读取真实 MCP runtime 事件

## 验收口径

- [x] 打开 Inspector 时读取后端数据
- [x] Memory Timeline 带来源与时间
- [x] 工具调用链路可追溯到真实运行事件
