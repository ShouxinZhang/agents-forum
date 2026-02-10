# 开发日志 - Vite Proxy + 同源 /api + Hono API 启动基线

## 1. 用户原始请求
> Vite 的代理配置：
> 建议： 与其让前端去访问 http://127.0.0.1:4174/api/...，不如在 vite.config.ts 里配置 server.proxy。
> 好处： 前端代码只需要写 /api/...，不需要硬编码端口号，且能顺便解决跨域问题。
>
> PLEASE IMPLEMENT THIS PLAN: API 访问策略更新计划：Vite Proxy + 同源 `/api`
>
> continue, 用SQLite

## 2. 轮次摘要
- 目标: 前端统一使用同源 `/api`，开发态通过 Vite 代理到本地 API；启动脚本支持 web+api 同启。
- 实施内容:
  - 为 `forum-web` 增加 Vite 代理配置。
  - 新增最小 `Hono` API 服务（`/api/health`）并监听 4174。
  - `restart.sh` 升级为优先同时启动 web+api，缺失 API 工作区时自动降级。
- 结果: 开发态已可通过 `http://127.0.0.1:4173/api/health` 访问 API（由 Vite proxy 转发）。

## 3. 修改时间
- 完成时间: 2026-02-10 09:56:03 +0800
- 时间戳(秒): 1770688563

## 4. 文件清单（路径 / 操作 / 说明）
- `apps/forum-web/vite.config.ts` / 更新 / 新增 `server.proxy`，将 `/api` 转发到 `http://127.0.0.1:4174`
- `restart.sh` / 更新 / 增加 `WEB_PORT/API_PORT` 与 web+api 同启逻辑
- `apps/forum-api/package.json` / 新增 / Hono API 工作区与运行脚本
- `apps/forum-api/src/server.mjs` / 新增 / 最小 API 服务，提供 `/api/health`
- `package-lock.json` / 更新 / 安装 API 依赖
- `docs/dev_logs/2026-02-10/03-vite-proxy-hono-api-bootstrap.md` / 新增 / 本轮日志

## 5. 变更说明（方案、影响范围、风险控制）
- 方案:
  - 开发态前端请求统一 `/api/*`；由 Vite 代理解决端口与跨域。
  - API 使用 `Hono + @hono/node-server`，先提供健康检查端点，后续可承接 SQLite 持久化接口。
  - 启动脚本默认 web:4173/api:4174，并兼容无 API 目录场景。
- 影响范围:
  - 前端开发代理、启动脚本、API 工作区初始化。
  - 不改变现有页面业务逻辑与数据流。
- 风险控制:
  - API 服务采用最小实现，不引入业务行为回归。
  - `restart.sh` 对 API 目录存在性进行判断，避免脚本失败。

## 6. 验证结果
- `bash -n restart.sh`：通过
- `npm run dev -w forum-api -- --host 127.0.0.1 --port 4174` + `curl /api/health`：通过
- `npm run dev -w forum-web -- --host 127.0.0.1 --port 4173` + `curl /api/health`（经 proxy）：通过
- `npm run typecheck -w forum-web`：通过
- `npm run lint -w forum-web`：通过
- `npm run build -w forum-web`：通过
- `npm run typecheck -w forum-api`：通过（当前为占位输出）
- `npm run lint -w forum-api`：通过（当前为占位输出）
- `npm run build -w forum-api`：通过（当前为占位输出）
- `bash scripts/check_errors.sh`：通过（4/4）
- `npm test`：通过（workspace 无测试按 `--if-present` 跳过）
- `node scripts/repo-metadata/scripts/scan.mjs --update`：执行成功
- `node scripts/repo-metadata/scripts/generate-structure-md.mjs`：执行成功

## 7. Git 锚点
- branch: `main`
- HEAD: `a734fc33e981809d7d7efe5decf8c1ad235dbed9`
- tag: 无
