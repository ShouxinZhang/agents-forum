# 开发日志 - forum 读取 API 化与前端模块拆分

## 1. 用户原始请求
> 嗯，用playwright interacive技能，进行PLAN地实施
> Go.

## 2. 轮次摘要
- 目标: 按模块依赖计划先落第一批高价值实现，把论坛初始化读取链路从前端内存态迁到 `forum-api`，并把 `forum-web` 的业务类型/读取逻辑/展示部件从 `App.tsx` 中拆出。
- 核心实施:
  - 为 `forum-api` 新增 `modules/forum`，提供论坛 bootstrap、板块列表、帖子列表、帖子详情只读接口。
  - 为 `forum-web` 新增 `modules/forum`、`modules/auth`、`modules/agent-observer`、`modules/shared`，承接类型、API client、登录页、角色徽章与 Inspector 面板。
  - `App.tsx` 改为以 API 初始化论坛数据，并保留现有发帖、回复、模拟讨论的前端状态交互。
  - 使用 `playwright-interactive` 的 `js_repl` 会话做浏览器回归，发现旧版 `forum-api` 仍占用 `4174` 导致 `/api/forum/bootstrap` 返回 `Not Found`，重启后端后验证通过。
  - 继续用 Playwright 浏览器回归板块切换、Inspector 切换、新建帖子和发布回复。

## 3. 修改时间
- 完成时间: 2026-03-12 00:28:26 +0800
- 时间戳(秒): 1773246506

## 4. 文件清单（路径 / 操作 / 说明）
- `apps/forum-api/src/server.mjs` / 更新 / 挂载 `/api/forum` 路由
- `apps/forum-api/src/modules/forum/data.mjs` / 新增 / 论坛板块与线程种子数据
- `apps/forum-api/src/modules/forum/routes.mjs` / 新增 / bootstrap、sections、threads、thread detail 只读接口
- `apps/forum-web/src/App.tsx` / 更新 / 接入 forum-api 初始化读取链路并保留现有交互状态
- `apps/forum-web/src/modules/forum/types.ts` / 新增 / forum 业务类型定义
- `apps/forum-web/src/modules/forum/api.ts` / 新增 / forum bootstrap API client
- `apps/forum-web/src/modules/forum/utils.ts` / 新增 / forum 公共常量与工具函数
- `apps/forum-web/src/modules/agent-observer/data.ts` / 新增 / Agent Inspector 静态 profile 数据
- `apps/forum-web/src/modules/agent-observer/components/inspector-panel.tsx` / 新增 / Inspector 面板组件
- `apps/forum-web/src/modules/auth/components/login-page.tsx` / 新增 / 登录页组件
- `apps/forum-web/src/modules/shared/components/role-badge.tsx` / 新增 / 统一角色徽章组件
- `docs/dev_logs/2026-03-12/02-forum-read-api-and-web-modules.md` / 新增 / 本轮开发日志

## 5. 变更说明（方案、影响范围、风险控制）
- 方案:
  - 第一阶段只做“读取链路 API 化 + 页面模块拆分”，不在这一轮引入真实数据库、服务端登录态或 MCP 写接口。
  - `forum-api` 以只读 seed data 提供论坛初始数据，前端加载后继续在本地状态上承接发帖、回帖与 mock 讨论，保证交互行为不被大改打断。
  - 登录成功和重试时显式进入 `loading`，异步回调中再批量更新状态，规避 React Hooks lint 对 effect 内同步 `setState` 的限制。
- 影响范围:
  - 影响 `forum-api` 路由结构和 `forum-web` 初始化数据来源。
  - 前端 UI 外观基本保持不变，但登录后会先经过一次“论坛数据加载中”状态。
- 风险控制:
  - Playwright 回归中发现旧版 `forum-api` 仍占用端口并返回 `Not Found`，已通过重启 `4174` 上的后端进程切到新版路由。
  - 当前新建帖子与回复仍只保存在前端状态，不会回写到 API；这符合本阶段目标，但不是持久化能力。
  - Playwright 标准 click 在当前滚动位置下点击“发布回复”会被遮挡元素拦截，本轮用页面脚本完成验证，后续应补 UI 可点击性优化。

## 6. 验证结果
- 静态与构建:
  - `npm run typecheck -w forum-web`：通过
  - `npm run lint -w forum-web`：通过
  - `npm run build -w forum-web`：通过
  - `node --check apps/forum-api/src/server.mjs`：通过
  - `node --check apps/forum-api/src/modules/forum/data.mjs`：通过
  - `node --check apps/forum-api/src/modules/forum/routes.mjs`：通过
- 质量门禁:
  - `bash scripts/check_errors.sh`：通过（4/4）
  - `npm test`：通过（workspaces 下无测试按 `--if-present` 跳过）
- API 验证:
  - `curl http://127.0.0.1:4174/api/forum/bootstrap`：通过
  - `curl http://127.0.0.1:4174/api/forum/threads/t-admin-arena`：通过
  - `curl http://127.0.0.1:4174/api/forum/threads?sectionId=memory`：通过
- Playwright 回归:
  - `js_repl` 启动 `playwright` 浏览器并访问 `http://127.0.0.1:4173`：通过
  - 登录后初次命中 “论坛数据加载失败 / Not Found”，定位为旧版 `forum-api` 进程未重启：已定位并修复
  - 重启 `forum-api` 后刷新页面，板块/帖子/详情正常显示：通过
  - 切换到 `记忆实验室` 板块：通过
  - 打开 `Agent Inspector` 并切到 `Agent B`：通过
  - 新建帖子 `API 读取链路已接通`：通过
  - 发布楼层回复 `验证：读取 API 化后，页面内回复交互仍可用。`：通过（使用页面脚本 click，标准 click 存在遮挡）

## 7. Git 锚点
- branch: `main`
- HEAD: `20b2020e1031f51dbab0053e578921a1d0f7cf50`
- tag: 无
