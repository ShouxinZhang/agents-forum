# 17-bcd-auth-read-write-closure

- 时间: 2026-03-12 17:57:08 +0800
- 用户请求: `B,C,D, 推进, 要求完成这一步骤才允许停止，否则继续工作。`

## 文件清单

- `apps/forum-api/src/modules/auth/store.mjs`
- `apps/forum-api/src/modules/auth/data.mjs`
- `apps/forum-api/src/modules/forum/data.mjs`
- `apps/forum-api/src/modules/forum/routes.mjs`
- `apps/forum-api/src/modules/mcp/forum-client.mjs`
- `apps/forum-web/src/App.tsx`
- `apps/forum-web/src/modules/forum/api.ts`
- `apps/forum-web/src/modules/forum/types.ts`
- `apps/forum-web/src/modules/forum/utils.ts`
- `skills/forum-mcp-smoke/scripts/smoke.mjs`
- `skills/forum-mcp-smoke/references/current-contract.md`
- `docs/dev_plan/agents_forum_module_dependency_diagram_plan.md`
- `docs/dev_plan/agents_forum_module_dependency_diagram_plan/00-overview.md`
- `docs/dev_plan/agents_forum_module_dependency_diagram_plan/03-phase-b-auth.md`
- `docs/dev_plan/agents_forum_module_dependency_diagram_plan/04-phase-c-forum-read.md`
- `docs/dev_plan/agents_forum_module_dependency_diagram_plan/05-phase-d-forum-write.md`
- `docs/dev_plan/agents_forum_module_dependency_diagram_plan/12-reddit-feed-and-detail.md`
- `docs/dev_logs/2026-03-12/17-bcd-auth-read-write-closure.md`

## 变更说明

- 阶段 B:
  - 新增 `auth/store.mjs`，把 session 从进程内 `Map` 改为 runtime 文件持久化。
  - 保留现有登录接口契约，同时补齐角色写权限与管理权限判断。
  - 验证了 `forum-api` 重启后旧 token 仍可通过 `/api/auth/session` 恢复。
- 阶段 C:
  - `GET /api/forum/threads` 改为支持 `sectionId / search / sort / page / pageSize`。
  - 新增 `GET /api/forum/threads/:threadId/replies`，支持根楼层分页和按 `floorId / replyId` 读取子树。
  - 前端 Feed 接入搜索、排序、分页控件；详情页补齐 loading / error / empty 状态。
- 阶段 D:
  - 新增 `POST /api/forum/threads/:threadId/actions`，支持 `pin / unpin / lock / unlock / delete / restore / approve / reject`。
  - 回复写入会在锁帖时被后端拒绝。
  - 详情页增加管理员治理入口，并修复 delete / restore 后详情状态不即时刷新的问题。
- 兼容同步:
  - 更新 `forum-mcp-smoke` 的 HTTP smoke 校验与当前契约文档。
  - 更新 `forum-client` 以适配新的 Feed 返回结构。

## 验证结果

- `bash scripts/check_errors.sh`: 通过
- `npm test`: 通过
- API 验证:
  - 未登录 `POST /api/forum/threads` 返回 `401`
  - `claw-mod` 回复返回 `403`
  - Feed 查询参数 `search / sort / page / pageSize` 生效
  - `GET /api/forum/threads/:threadId/replies` 返回区间分页数据
  - `lock` 后回复返回 `403 Thread Locked`
  - `delete` 后帖子从 Feed 隐藏
  - `forum-api` 重启后旧 session token 仍可恢复
- Skill 验证:
  - `skills/forum-mcp-smoke/scripts/smoke.sh --write-smoke --login-user admin --login-password 1234`: 通过
  - `skills/forum-mcp-smoke/scripts/mcp-smoke.sh --login-user admin --login-password 1234`: 通过
- Playwright 回归:
  - 登录 `admin`
  - Feed 搜索与排序控件可见
  - 点击帖子进入独立详情 URL
  - 锁帖后详情页显示只读提示
  - 删除后详情页显示已删除状态，恢复后回到可回复状态
