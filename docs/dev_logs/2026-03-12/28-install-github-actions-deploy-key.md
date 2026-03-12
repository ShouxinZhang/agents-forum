# 28-install-github-actions-deploy-key

## 用户原始请求

> 下一步可以继续帮你做一件事：把这把新公钥直接装到服务器，然后你只需要去 GitHub 页面填 3 个 Secrets。  
> 记得完整日志留痕啊，下次复用

## 轮次背景与意图摘要

- 仓库已添加 GitHub Actions 自动部署工作流。
- 用户要求继续完成“生成新的 CI 部署 SSH key、把公钥安装到腾讯云服务器、验证可登录”。
- 本轮不改业务代码，也不把任何私钥明文写入仓库；只做机器侧密钥安装与日志留痕。

## 修改时间

- 2026-03-12 19:39:22 +0800 至 2026-03-12 19:43:xx +0800

## 文件清单

- `docs/dev_logs/2026-03-12/28-install-github-actions-deploy-key.md` / 新增 / 2026-03-12 19:43:xx +0800 / 记录 CI 部署 key 生成、安装与验证结果

## 执行步骤

1. 检查本地 `~/.ssh/`，确认 `~/.ssh/agents_forum_deploy` 尚不存在。
2. 确认服务器 `ubuntu@101.33.32.196` 的 `~/.ssh/authorized_keys` 已就绪。
3. 在本地生成新的专用部署 key：

```bash
ssh-keygen -t ed25519 -C "agents-forum-github-actions" -f ~/.ssh/agents_forum_deploy -N ''
```

4. 将公钥追加到服务器 `~/.ssh/authorized_keys`。
5. 使用新私钥单独验证：

```bash
ssh -i ~/.ssh/agents_forum_deploy -o IdentitiesOnly=yes ubuntu@101.33.32.196
```

## 结果

- 新部署私钥路径：
  - `~/.ssh/agents_forum_deploy`
- 新部署公钥路径：
  - `~/.ssh/agents_forum_deploy.pub`
- 指纹：
  - `SHA256:DxVzpReRwDkEl5tbVjuSuETmIE0KNxWGLpqSUUruLyo`
- 服务器账号：
  - `ubuntu@101.33.32.196`
- 验证结果：
  - 新私钥已成功通过 `publickey` 认证登录服务器

## 后续需要用户完成的 GitHub 配置

在 GitHub 仓库 `Settings -> Secrets and variables -> Actions` 中新增：

- `DEPLOY_HOST` = `101.33.32.196`
- `DEPLOY_USER` = `ubuntu`
- `DEPLOY_SSH_KEY` = `~/.ssh/agents_forum_deploy` 的完整私钥内容

## 风险与注意事项

- 本轮未将私钥写入仓库，也未在日志中记录私钥明文。
- 之前已经暴露过的旧 SSH 私钥仍然存在风险，建议后续继续做旧钥匙清理与轮换。

## Git 锚点

- 分支：`main`
- 基线提交：`20b2020e1031f51dbab0053e578921a1d0f7cf50`
- 本轮未创建新的 commit / tag / backup branch
