# 开发日志 - Vite Proxy 同源 /api 访问策略

## 1. 用户原始请求
> Vite 的代理配置：
> 建议： 与其让前端去访问 http://127.0.0.1:4174/api/...，不如在 vite.config.ts 里配置 server.proxy。
> 好处： 前端代码只需要写 /api/...，不需要硬编码端口号，且能顺便解决跨域问题。
>
> PLEASE IMPLEMENT THIS PLAN: API 访问策略更新计划：Vite Proxy + 同源 `/api`

## 2. 轮次摘要
- 目标: 前端统一走同源 `/api/*`，开发环境由 Vite 转发到本地 API。
- 当前现状: 前端暂无实际 API 调用，但 Vite 尚未配置代理，`restart.sh` 也仅启动 web。
- 实施结果: 已新增 Vite proxy；`restart.sh` 支持优先同启 web+api（未发现 api workspace 时回退 web-only）。

## 3. 修改时间
- 完成时间: 2026-02-10 09:53:48 +0800
- 时间戳(秒): 1770688428

## 4. 文件清单（路径 / 操作 / 说明）
- `apps/forum-web/vite.config.ts` / 更新 / 增加 `server.proxy`，将 `/api` 转发到 `http://127.0.0.1:4174`
- `restart.sh` / 更新 / 增加 `WEB_PORT/API_PORT` 配置与 web+api 启动逻辑；无 `forum-api` 时自动降级为仅启动 web
- `docs/dev_logs/2026-02-10/02-vite-proxy-same-origin-api.md` / 新增 / 本轮日志

## 5. 变更说明（方案、影响范围、风险控制）
- 方案:
  - 前端开发环境统一使用相对路径 `/api/*`。
  - Vite dev server 代理 `/api` 到 `127.0.0.1:4174`，避免端口硬编码与跨域。
  - 启动脚本预留 API 同启能力，支撑后续 `forum-api` 接入。
- 影响范围:
  - 仅开发访问策略与启动脚本，不改现有业务 UI 逻辑。
- 风险控制:
  - 兼容无 API 服务场景，脚本自动回退到 web-only。

## 6. 验证结果
- `bash -n restart.sh`：通过
- `npm run typecheck -w forum-web`：通过
- `npm run lint -w forum-web`：通过
- `npm run build -w forum-web`：通过
- `bash scripts/check_errors.sh`：通过（4/4）
- `npm test`：通过（workspaces 下无测试按 `--if-present` 跳过）

## 7. Git 锚点
- branch: `main`
- HEAD: `a734fc33e981809d7d7efe5decf8c1ad235dbed9`
- tag: 无
