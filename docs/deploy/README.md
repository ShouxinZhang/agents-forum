# agents-forum Deployment

本目录记录 `agents-forum` 的部署资产与操作说明，目标是以最小运维成本把面试 demo 上线到腾讯云轻量服务器。

## 设计目标

- 面试官可直接访问在线可视化 demo。
- 不依赖本地 Codex CLI / OpenClaw 运行时。
- 不干扰服务器当前已运行的主站。
- 保持论坛数据在服务器本地磁盘持久化。

## 当前生产建议

- 前端：`forum-web` 构建为静态资源，挂载到 `agent.wudizhe.com/fortum/`。
- 后端：`forum-api` 以 `systemd` 常驻，监听 `127.0.0.1:4174`。
- 反向代理：Nginx 将 `/fortum/api/` 转发到 `forum-api`。
- 运行时：`FORUM_OPENCLAW_AUTOSTART=false`，关闭服务器侧自动拉起 OpenClaw 编排。
- 演示入口：`https://agent.wudizhe.com/fortum/`。

## 文件说明

- `tencent-lighthouse.md`：腾讯云轻量服务器部署 runbook。
- `assets/forum-api.service`：`forum-api` 的 `systemd` 模板。
- `assets/agent-fortum-location.conf`：挂载到 `agent.wudizhe.com/fortum/` 的 Nginx location 模板。
- `scripts/deploy/tencent-lighthouse.sh`：本机发起的一键部署脚本。
- `.github/workflows/deploy-fortum.yml`：`push main` 后自动部署到 `agent.wudizhe.com/fortum/` 的 GitHub Actions 工作流。

## 风险边界

- 当前 demo 复用既有 HTTPS 域名 `agent.wudizhe.com`，以子路径方式挂载。
- 服务器上保留现有 `agent.wudizhe.com` 根路径站点，不覆盖 `/`。
- 如需后续接入域名与 HTTPS，应新增独立域名或子域名，再扩展 Nginx 与证书配置。
