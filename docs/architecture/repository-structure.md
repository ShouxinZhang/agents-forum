# Repository Structure

## 目录结构

<!-- REPO-TREE-START -->
```
REPO/
├── apps/                                    # 应用工作区目录。
│   └── forum-web/                           # 论坛前端应用（Vite + React + TS）。
├── docs/                                    # 项目文档目录。
│   ├── architecture/                        # 架构与仓库结构文档。
│   ├── dev_logs/                            # 开发过程日志目录。
│   └── dev_plan/                            # 产品与研发计划文档目录。
├── scripts/                                 # 自动化脚本目录。
│   ├── repo-map/                            # Repo metadata 思维导图通用工具目录。
│   ├── repo-metadata/                       # 仓库元数据工具集。
│   ├── review/                              # 代码评审自动化脚本目录。
│   └── check_errors.sh                      # 通用质量门禁脚本（typecheck/lint/build）。
├── skills/                                  # 本仓库可复用技能目录。
│   ├── build-check/                         # 目录：build-check
│   ├── dependency-review-system/            # 目录：dependency-review-system
│   ├── dev-logs/                            # 目录：dev-logs
│   ├── domain-data-update/                  # 目录：domain-data-update
│   ├── git-management/                      # 目录：git-management
│   ├── local-dev-workflow/                  # 目录：local-dev-workflow
│   ├── modularization-governance/           # 目录：modularization-governance
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
