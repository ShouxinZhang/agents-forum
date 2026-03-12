# 26-fortum-subpath-deploy

## 用户原始请求

> 我想挂靠到agent.wudizhe.com/fortum上

## 轮次背景与意图摘要

- 现有 demo 已通过公网 IP 上线。
- 用户要求将 demo 挂载到现有 HTTPS 域名 `agent.wudizhe.com` 下的子路径 `/fortum/`，而不是继续使用单独的 IP 默认站点。
- 为避免破坏现有根站，最终方案采用：
  - 前端支持子路径部署。
  - Nginx 在 `agent.wudizhe.com` 现有 server block 中插入 `/fortum/` 与 `/fortum/api/` 路由。
  - `forum-api` 继续复用已有 `systemd` 服务。

## 修改时间

- 2026-03-12 19:28:48 +0800

## 文件清单

- `apps/forum-web/src/lib/base-path.ts` / 新增 / 2026-03-12 19:2x:xx +0800 / 前端子路径部署工具
- `apps/forum-web/src/modules/forum/utils.ts` / 更新 / 2026-03-12 19:2x:xx +0800 / 路由路径构造与解析支持 `/fortum/`
- `apps/forum-web/src/modules/forum/api.ts` / 更新 / 2026-03-12 19:2x:xx +0800 / forum API 前缀切换为 base-path 感知
- `apps/forum-web/src/modules/auth/api.ts` / 更新 / 2026-03-12 19:2x:xx +0800 / auth API 前缀切换为 base-path 感知
- `apps/forum-web/src/modules/agent-observer/api.ts` / 更新 / 2026-03-12 19:2x:xx +0800 / observer API 前缀切换为 base-path 感知
- `apps/forum-web/src/App.tsx` / 更新 / 2026-03-12 19:2x:xx +0800 / Feed 根路径跳转改为 base-path 感知
- `apps/forum-web/vite.config.ts` / 更新 / 2026-03-12 19:2x:xx +0800 / 新增 `FORUM_WEB_BASE_PATH` 构建配置
- `docs/deploy/assets/agent-fortum-location.conf` / 更新 / 2026-03-12 19:2x:xx +0800 / 子路径 Nginx location 模板参数化
- `scripts/deploy/tencent-lighthouse.sh` / 更新 / 2026-03-12 19:2x:xx +0800 / 部署目标切换为 `agent.wudizhe.com/fortum/`，增加远端 Nginx 备份与补丁脚本
- `docs/deploy/README.md` / 更新 / 2026-03-12 19:2x:xx +0800 / 当前公开入口改为 `/fortum/`
- `docs/deploy/tencent-lighthouse.md` / 更新 / 2026-03-12 19:2x:xx +0800 / runbook 改为 fortum 子路径部署
- `docs/architecture/repo-metadata.json` / 更新 / 2026-03-12 19:29:xx +0800 / 登记 base-path 与 fortum 部署资产
- `docs/architecture/repository-structure.md` / 更新 / 2026-03-12 19:29:xx +0800 / 补充 fortum 子路径部署模块说明

## 变更说明

- 方案：
  - 新增 `base-path.ts`，统一处理 `import.meta.env.BASE_URL`、前端路由和 API 路径。
  - 通过 `FORUM_WEB_BASE_PATH=/fortum/` 构建前端，确保静态资源从 `/fortum/assets/...` 加载。
  - 在远端 Nginx 配置中注入以下能力：
    - `location = /fortum`：重定向到 `/fortum/`
    - `location ^~ /fortum/api/`：反代到 `127.0.0.1:4174`
    - `location ^~ /fortum/`：托管 SPA 静态资源与前端深链
  - 修改部署脚本，在远端变更前自动备份 `/etc/nginx/sites-available/agent-studio`
- 影响范围：
  - `agent.wudizhe.com/` 根路径站点继续由原 Next.js 服务承载。
  - `agent.wudizhe.com/fortum/` 成为论坛 demo 的正式入口。
- 风险控制：
  - 远端 Nginx 配置自动生成带时间戳备份。
  - 先 `nginx -t`，通过后再 reload。
  - 通过 Playwright 做登录和深链访问验证，而不仅是检查 `200 OK`。

## 验证结果

### 本地

- `FORUM_WEB_BASE_PATH=/fortum/ npm run build -w forum-web`：通过
- `bash scripts/check_errors.sh`：通过
- `npm test`：执行完成；当前 workspaces 无额外测试输出

### 服务器

- 备份文件：
  - `/etc/nginx/sites-available/agent-studio.bak-20260312192810`
- 远端注入 Nginx 片段：
  - `location = /fortum`
  - `location ^~ /fortum/api/`
  - `location ^~ /fortum/`
- 健康检查：
  - `curl -k https://agent.wudizhe.com/fortum/api/health`

```json
{"ok":true,"service":"forum-api","host":"127.0.0.1","port":4174}
```

- 浏览器验证：
  - 打开 `https://agent.wudizhe.com/fortum/` 成功显示登录页
  - 使用 `admin / 1234` 登录成功进入 Feed
  - 点击帖子后地址变为 `https://agent.wudizhe.com/fortum/threads/t-1001`
  - 详情页正文与楼层加载正常
- 根站回归：
  - `https://agent.wudizhe.com/` 仍返回 `200 OK`

## Git 锚点

- 分支：`main`
- 基线提交：`20b2020e1031f51dbab0053e578921a1d0f7cf50`
- 本轮未创建新的 commit / tag / backup branch

## 当前公开入口

- `https://agent.wudizhe.com/fortum/`
