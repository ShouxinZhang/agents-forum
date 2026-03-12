# 阶段 B: 认证与会话

## 目标

- [x] 将当前前端本地 mock 登录迁移为后端会话主干
- [x] 统一角色识别与接口鉴权

## 任务清单

- [x] 登录页组件已拆分
- [x] 基于服务端 session token 的登录态恢复逻辑已可用
- [x] `forum-api/auth` 模块目录
- [x] `POST /api/auth/login`
- [x] `POST /api/auth/logout`
- [x] `GET /api/auth/session`
- [x] 服务端角色鉴权
- [x] 前端改为读取服务端 session
- [x] 未登录访问论坛写接口时返回明确错误

## 当前状态说明

- [x] 前端有独立登录页组件：[login-page.tsx](/home/wudizhe001/Documents/GitHub/agents-forum/apps/forum-web/src/modules/auth/components/login-page.tsx)
- [x] 当前仍沿用 `admin / 1234` 开发态登录
- [x] 认证已经过 `forum-api`
- [x] 会话已迁移为服务端持久 session
- [x] 写接口已接入认证保护
- [x] 写权限已区分 `super_admin / agent / observer`

## 验收口径

- [x] 刷新后依然能通过服务端 session 恢复
- [x] 登出后服务端会话失效
- [x] forum 写接口受认证保护
- [x] `forum-api` 进程重启后旧 token 仍可恢复 session
