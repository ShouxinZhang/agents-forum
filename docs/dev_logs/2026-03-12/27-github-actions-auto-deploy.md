# 27-github-actions-auto-deploy

## 用户原始请求

> 把这个 GitHub Actions 工作流加进仓库  
> 但是ssh key如何获得呢？

## 轮次背景与意图摘要

- 用户已经接受通过 `push main` 自动触发服务器部署。
- 当前仓库已有可复用的一键部署脚本 `scripts/deploy/tencent-lighthouse.sh`，因此本轮目标是把该脚本接入 GitHub Actions，而不是另起一套部署逻辑。
- 同时补齐“如何生成 GitHub Actions 用的 SSH key、如何安装到服务器、如何配置 GitHub Secrets”的文档说明。

## 修改时间

- 2026-03-12 19:39:22 +0800

## 文件清单

- `.github/workflows/deploy-fortum.yml` / 新增 / 2026-03-12 19:3x:xx +0800 / `push main` 与手动触发的自动部署工作流
- `docs/deploy/README.md` / 更新 / 2026-03-12 19:3x:xx +0800 / 增加自动部署工作流说明
- `docs/deploy/tencent-lighthouse.md` / 更新 / 2026-03-12 19:3x:xx +0800 / 新增 GitHub Actions、SSH key 生成与 GitHub Secrets 配置说明
- `docs/architecture/repo-metadata.json` / 更新 / 2026-03-12 19:39:xx +0800 / 登记 `.github/workflows/deploy-fortum.yml`
- `docs/architecture/repository-structure.md` / 更新 / 2026-03-12 19:39:xx +0800 / 补充自动部署入口说明

## 变更说明

- 方案：
  - 新增 `.github/workflows/deploy-fortum.yml`，在 `push` 到 `main` 或手动 `workflow_dispatch` 时执行自动部署。
  - 工作流逻辑保持最小化：
    - checkout 仓库
    - 从 GitHub Secrets 写入部署私钥
    - `ssh-keyscan` 记录服务器 host key
    - 调用 `scripts/deploy/tencent-lighthouse.sh`
  - 在部署文档中补充完整的 SSH key 获取与配置方式，明确要求不要复用已经暴露过的旧私钥。
- 影响范围：
  - 仅新增 CI 自动化与文档，不改业务逻辑和线上 Nginx/API 行为。
- 风险控制：
  - 自动部署只监听 `main`，避免任意分支推送触发上线。
  - 使用专用部署私钥，不与开发机常用私钥混用。
  - 通过 `concurrency` 防止重复 push 造成并发部署。

## 验证结果

- `bash scripts/check_errors.sh`：通过
- `npm test`：执行完成；当前 workspaces 无额外测试输出
- 工作流文件检查：
  - `.github/workflows/deploy-fortum.yml` 已创建
  - 触发条件：`push main`、`workflow_dispatch`
  - 部署目标：`agent.wudizhe.com/fortum/`

## SSH key 获取方法（已写入部署文档）

生成新的专用部署私钥：

```bash
ssh-keygen -t ed25519 -C "agents-forum-github-actions" -f ~/.ssh/agents_forum_deploy
```

输出文件：

- 私钥：`~/.ssh/agents_forum_deploy`
- 公钥：`~/.ssh/agents_forum_deploy.pub`

服务器端安装公钥：

```bash
cat ~/.ssh/agents_forum_deploy.pub
```

复制后在服务器追加到：

```bash
~/.ssh/authorized_keys
```

GitHub 仓库 Secrets：

- `DEPLOY_SSH_KEY`
- `DEPLOY_HOST`
- `DEPLOY_USER`

## Git 锚点

- 分支：`main`
- 基线提交：`20b2020e1031f51dbab0053e578921a1d0f7cf50`
- 本轮未创建新的 commit / tag / backup branch
