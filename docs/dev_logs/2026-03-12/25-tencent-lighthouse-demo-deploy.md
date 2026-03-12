# 25-tencent-lighthouse-demo-deploy

## 用户原始请求

> 在docs里新建一个部署文件夹模块，记录部署流程，然后部署上线

补充上下文：

> 最好是部署在轻量级服务器上……主要是面试 demo，让面试官可以看到一个可视化结果。

## 轮次背景与意图摘要

- 用户要求跨 workspace 找到既有部署文档，并复用到 `agents-forum`。
- 结合仓库现状与服务器现网结构，最终收敛为“腾讯云轻量服务器面试 demo 部署”：
  - 前端静态化，由 Nginx 托管。
  - 后端 `forum-api` 以 `systemd` 常驻。
  - 不上线本地 Codex CLI / OpenClaw 运行时。
  - 使用服务器公网 IP 的 HTTP 默认站点作为 demo 入口，避免覆盖现有 `agent.wudizhe.com` 站点。

## 修改时间

- 2026-03-12 19:11:09 +0800

## 文件清单

- `docs/deploy/README.md` / 新增 / 2026-03-12 19:07:xx +0800 / 部署模块总览与风险边界说明
- `docs/deploy/tencent-lighthouse.md` / 新增 / 2026-03-12 19:07:xx +0800 / 腾讯云轻量服务器部署 runbook
- `docs/deploy/assets/forum-api.service` / 新增 / 2026-03-12 19:07:xx +0800 / `forum-api` 的 `systemd` 模板
- `docs/deploy/assets/agents-forum-ip.conf` / 新增 / 2026-03-12 19:07:xx +0800 / 公网 IP 默认 HTTP 入口的 Nginx 模板
- `scripts/deploy/tencent-lighthouse.sh` / 新增 / 2026-03-12 19:07:xx +0800 / 本机发起的腾讯云轻量服务器一键部署脚本
- `docs/architecture/repository-structure.md` / 更新 / 2026-03-12 19:10:xx +0800 / 增补部署模块结构说明
- `docs/architecture/repo-metadata.json` / 更新 / 2026-03-12 19:12:xx +0800 / 登记 `docs/deploy` 与 `scripts/deploy` 元数据

## 变更说明

- 方案：
  - 新增 `docs/deploy/` 模块，正式记录 `agents-forum` 的部署入口、Nginx/systemd 模板与腾讯云轻量服务器流程。
  - 新增 `scripts/deploy/tencent-lighthouse.sh`，通过 SSH + rsync 将当前 workspace 同步到服务器、安装依赖、构建前端、安装 `systemd` 与 Nginx 配置并执行健康检查。
  - 服务器端采用：
    - 静态前端：`/var/www/agents-forum`
    - 后端服务：`agents-forum-api.service`
    - API 监听：`127.0.0.1:4174`
    - 运行时目录：`/home/ubuntu/apps/agents-forum/.runtime`
    - OpenClaw 自动启动：关闭（`FORUM_OPENCLAW_AUTOSTART=false`）
- 影响范围：
  - 本仓库新增部署资产和文档，不改业务逻辑。
  - 服务器新增公网 IP 默认 HTTP 站点，不覆盖现有 `agent.wudizhe.com` HTTPS 站点。
- 风险控制：
  - 避免使用高端口暴露 demo，直接复用已开放的 `80` 端口默认站点。
  - 避免同步本地 `.runtime`，后续部署保留服务器端演示数据。
  - 保留现有域名站点配置，部署后验证 `agent.wudizhe.com` 仍然返回正常响应。

## 验证结果

### 本地

- `bash -n scripts/deploy/tencent-lighthouse.sh`：通过
- `bash scripts/check_errors.sh`：通过
- `npm test`：执行完成；当前 workspaces 无额外测试用例输出

### 服务器

- SSH 目标：`ubuntu@101.33.32.196`
- 部署脚本：`bash scripts/deploy/tencent-lighthouse.sh agent-studio-tencent`
- `systemctl is-active agents-forum-api`：`active`
- `curl http://127.0.0.1:4174/api/health`：

```json
{"ok":true,"service":"forum-api","host":"127.0.0.1","port":4174}
```

- `curl -I http://101.33.32.196/`：`HTTP/1.1 200 OK`
- Playwright 浏览器验证：
  - 打开 `http://101.33.32.196/` 成功
  - 登录页展示 `Agents Forum 登录`
  - 使用默认 `admin / 1234` 登录后进入论坛首页 Feed
- 现有站点回归：
  - `http://agent.wudizhe.com/`：`301` 跳转 HTTPS
  - `https://agent.wudizhe.com/`：`200 OK`

## Git 锚点

- 分支：`main`
- 基线提交：`20b2020e1031f51dbab0053e578921a1d0f7cf50`
- 本轮未创建新的 commit / tag / backup branch

## 交付结果

- 面试 demo 已上线：
  - `http://101.33.32.196/`
- 仓库内已补齐部署文档模块与一键部署脚本，可继续复用到后续迭代。
