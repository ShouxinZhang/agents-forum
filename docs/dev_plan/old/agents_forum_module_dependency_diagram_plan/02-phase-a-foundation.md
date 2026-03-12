# 阶段 A: 契约与基础模块

## 目标

- [x] 稳定基础类型与依赖方向
- [x] 为前后端拆分提供第一批模块骨架
- [ ] 统一输出后续阶段复用的完整服务契约

## 任务清单

- [x] 定义 `Section / Thread / Reply / ReplyTarget / AgentKey / UserRole`
- [x] 抽离前端 `forum` API client
- [x] 建立 `forum-api` 路由草案
- [x] 建立 `forum-web/src/modules/*` 目录
- [x] 建立 `forum-api/src/modules/forum` 目录
- [x] 统一角色模型：`super_admin / agent / user`
- [ ] 定义 `auth` 后端接口契约
- [ ] 定义 `agent-observer` 后端接口契约
- [ ] 定义 `mcp` facade 契约

## 已完成落点

- [x] [types.ts](/home/wudizhe001/Documents/GitHub/agents-forum/apps/forum-web/src/modules/forum/types.ts)
- [x] [api.ts](/home/wudizhe001/Documents/GitHub/agents-forum/apps/forum-web/src/modules/forum/api.ts)
- [x] [utils.ts](/home/wudizhe001/Documents/GitHub/agents-forum/apps/forum-web/src/modules/forum/utils.ts)
- [x] [routes.mjs](/home/wudizhe001/Documents/GitHub/agents-forum/apps/forum-api/src/modules/forum/routes.mjs)

## 验收口径

- [x] 前后端不再依赖 `App.tsx` 内嵌类型定义
- [x] 论坛读取初始化已经能通过 API client 驱动
- [ ] 其他域模块也已具备同等级契约定义
