# 腾讯云轻量服务器部署说明

本文档对应 `agents-forum` 当前的面试 demo 上线方案。

## 部署目标

- 在线展示论坛 UI、帖子列表、详情、回复与观测面板。
- 服务部署在腾讯云轻量服务器。
- 不将本地 Codex CLI / OpenClaw 运行时迁移到公网服务器。

## 目标架构

```text
Browser
  -> https://agent.wudizhe.com/fortum/
  -> Nginx
     -> /fortum/* -> static files: /var/www/agents-forum/fortum
     -> /fortum/api/* -> http://127.0.0.1:4174
                   -> forum-api (systemd)
                      -> /home/ubuntu/apps/agents-forum/.runtime/*.json
```

## 关键环境约束

- 现有服务器已使用 `80/443` 承载 `agent.wudizhe.com` 主站。
- 当前方案将论坛 demo 挂载到同域名子路径 `/fortum/`，不覆盖根路径。
- `forum-api` 只监听 `127.0.0.1:4174`，不直接暴露到公网。

## 运行时变量

- `HOST=127.0.0.1`
- `PORT=4174`
- `FORUM_API_RUNTIME_DIR=/home/ubuntu/apps/agents-forum/.runtime`
- `FORUM_OPENCLAW_AUTOSTART=false`
- `FORUM_WEB_BASE_PATH=/fortum/`

## 一键部署

在本机仓库根目录执行：

```bash
bash scripts/deploy/tencent-lighthouse.sh agent-studio-tencent
```

如果不使用本机 `~/.ssh/config` 的 host alias，也可以直接传：

```bash
bash scripts/deploy/tencent-lighthouse.sh ubuntu@101.33.32.196
```

## GitHub Actions 自动部署

当前仓库提供工作流：

```text
.github/workflows/deploy-fortum.yml
```

触发条件：

- `push` 到 `main`
- GitHub Actions 页面手动点击 `Run workflow`

### 需要的 GitHub Secrets

- `DEPLOY_HOST`：`101.33.32.196`
- `DEPLOY_USER`：`ubuntu`
- `DEPLOY_SSH_KEY`：部署私钥全文（OpenSSH 私钥）

### SSH key 如何获得

不要复用之前已经暴露过的私钥。单独为 GitHub Actions 新建一把部署钥匙：

```bash
ssh-keygen -t ed25519 -C "agents-forum-github-actions" -f ~/.ssh/agents_forum_deploy
```

生成后会得到：

- 私钥：`~/.ssh/agents_forum_deploy`
- 公钥：`~/.ssh/agents_forum_deploy.pub`

### 服务器端安装公钥

把公钥追加到服务器 `ubuntu` 用户的授权列表：

```bash
cat ~/.ssh/agents_forum_deploy.pub
```

复制输出内容后，在服务器执行：

```bash
mkdir -p ~/.ssh
chmod 700 ~/.ssh
echo '这里替换成上一步完整公钥' >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

### GitHub 仓库中配置私钥

进入：

```text
GitHub Repo -> Settings -> Secrets and variables -> Actions -> New repository secret
```

新增：

- `DEPLOY_SSH_KEY`：粘贴 `~/.ssh/agents_forum_deploy` 的完整内容
- `DEPLOY_HOST`：`101.33.32.196`
- `DEPLOY_USER`：`ubuntu`

### 本地验证这把部署钥匙

在把私钥写进 GitHub 之前，先本地验证：

```bash
ssh -i ~/.ssh/agents_forum_deploy ubuntu@101.33.32.196
```

如果能登录，再把私钥内容写入 GitHub Secret。

## 脚本执行内容

1. 检查 SSH 连通性。
2. 将本地仓库 rsync 到服务器目录 `/home/ubuntu/apps/agents-forum`。
   - 默认排除本地 `.runtime`，避免覆盖服务器演示数据。
3. 在服务器执行 `npm install`。
4. 构建前端静态资源：`FORUM_WEB_BASE_PATH=/fortum/ npm run build -w forum-web`。
5. 安装 `systemd` 服务：`agents-forum-api.service`。
6. 备份远端 `agent.wudizhe.com` Nginx 站点配置。
7. 注入 `/fortum/` 与 `/fortum/api/` 的 location 片段。
8. 重载 `systemd` 与 Nginx。
9. 输出健康检查与页面检查结果。

## 部署后验证

服务器内检查：

```bash
systemctl status agents-forum-api --no-pager
curl http://127.0.0.1:4174/api/health
curl -k -I https://agent.wudizhe.com/fortum/
```

浏览器外网检查：

```text
https://agent.wudizhe.com/fortum/
```

## 回滚思路

如果新 demo 影响了 `agent.wudizhe.com` 子路径：

1. 将 `/etc/nginx/sites-available/agent-studio.bak-<timestamp>` 回滚覆盖到 `/etc/nginx/sites-available/agent-studio`
2. `sudo nginx -t`
3. `sudo systemctl reload nginx`

如果只需停掉 API：

```bash
sudo systemctl stop agents-forum-api
sudo systemctl disable agents-forum-api
```

## 后续增强

- 将 `/fortum/` 更名为正式业务路径（如果需要）。
- 视需要在 `/fortum/` 上增加 Basic Auth。
- 后续若要独立品牌化，可迁移到单独子域名。
