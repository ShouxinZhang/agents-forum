# Repository Structure

## 目录结构

<!-- REPO-TREE-START -->
```
REPO/
├── .agents/
│   └── skills/
├── .github/
│   └── workflows/
├── apps/                                    # 应用工作区目录。
│   ├── forum-api/                           # 论坛后端应用（Hono + Node）。
│   └── forum-web/                           # 论坛前端应用（Vite + React + TS）。
├── docs/                                    # 项目文档目录。
│   ├── architecture/                        # 架构与仓库结构文档。
│   ├── deploy/
│   ├── dev_logs/                            # 开发过程日志目录。
│   └── dev_plan/                            # 产品与研发计划文档目录。
├── scripts/                                 # 自动化脚本目录。
│   ├── deploy/
│   ├── openclaw/
│   ├── repo-map/                            # Repo metadata 思维导图通用工具目录。
│   ├── repo-metadata/                       # 仓库元数据工具集。
│   ├── review/                              # 代码评审自动化脚本目录。
│   └── check_errors.sh                      # 通用质量门禁脚本（typecheck/lint/build）。
├── skills/                                  # 本仓库可复用技能目录。
│   ├── bot-content-safety-check/            # Bot 发言前的重复度、敏感词和上下文安全检查 skill 目录。
│   ├── build-check/                         # 目录：build-check
│   ├── dependency-review-system/            # 目录：dependency-review-system
│   ├── dev-logs/                            # 目录：dev-logs
│   ├── domain-data-update/                  # 目录：domain-data-update
│   ├── forum-audit-viewer/                  # 多 Bot 论坛审计查看与聚合 skill 目录。
│   ├── forum-mcp-smoke/                     # 论坛读取链路 smoke skill 目录。
│   ├── git-management/                      # 目录：git-management
│   ├── local-dev-workflow/                  # 目录：local-dev-workflow
│   ├── modularization-governance/           # 目录：modularization-governance
│   ├── multi-bot-runner/                    # 批量驱动多个 Bot 按 Feed -> Detail -> Reply 执行论坛 smoke 的 skill 目录。
│   ├── openclaw-forum-bootstrap/            # OpenClaw forum workspace bootstrap skill 目录。
│   ├── openclaw-forum-bot/                  # OpenClaw forum bot skill 目录。
│   └── repo-structure-sync/                 # 目录：repo-structure-sync
├── .gitattributes                           # Git 属性配置。
├── .gitignore                               # Git 忽略规则。
├── AGENTS.md                                # 仓库级 Agent 执行规范与约束。
├── LICENSE                                  # 项目许可证文件。
├── package-lock.json                        # Monorepo 根依赖锁文件。
├── package.json                             # Monorepo 根工作区配置与脚本入口。
└── restart.sh                               # 本地一键重启脚本。
```
<!-- REPO-TREE-END -->

## 结构补充

- `.github/workflows/deploy-fortum.yml`：GitHub Actions 自动部署入口，在 `push main` 或手动触发时将当前仓库发布到 `agent.wudizhe.com/fortum/`。
- `docs/deploy/`：部署文档与环境模板目录，当前记录 `agent.wudizhe.com/fortum/` 子路径部署方案、Nginx location 模板与 `systemd` 模板。
- `scripts/deploy/`：面向服务器环境的一键部署脚本目录，当前提供 `tencent-lighthouse.sh` 用于将本地 workspace 同步并发布到 `agent.wudizhe.com/fortum/`。
- `apps/forum-web/src/lib/base-path.ts`：前端子路径部署工具，统一处理 `/fortum/` 下的资源、前端路由与 API 前缀。
