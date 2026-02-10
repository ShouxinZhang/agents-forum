# 开发日志 - repo-metadata SQLite 双向同步与元数据补全

## 1. 用户原始请求
> 目前我们的repo-metadata.json还很不完善，此外就是，嗯，之前可能方案考虑采用的是posgresSQL, 但是我想的话，可能用SQLite更合适一点，因为本来仓库架构这种就很适合pogresSQL
>
> 不是，我的意思是仓库的repo-metadata.json, 这个默认是用json储存的，然后和SQL有一个双向互通
> 对，我的意思是，用SQLite记录

## 2. 轮次摘要
- 背景: `repo-metadata` 当前采用 `JSON ⇄ PostgreSQL`，且 `repo-metadata.json` 描述字段大面积缺失。
- 意图: 保持 `repo-metadata.json` 为主存储，同时将 SQL 双向互通切到 SQLite，并提升元数据可读性。
- 实施策略:
  - 新增 SQLite 公共库，统一连接、建表与 tags 序列化逻辑。
  - 新增 `sync-json-to-sqlite.mjs`，保留旧 `sync-json-to-postgres.mjs` 作为兼容转发入口。
  - 将 `sync-to-json.mjs` 与 MCP `repo_metadata_sync_db` 全面改为 SQLite。
  - 补全 `repo-metadata.json` 描述字段并刷新结构文档。

## 3. 修改时间
- 完成时间: 2026-02-10 10:28:50 +0800
- 时间戳(秒): 1770690530

## 4. 文件清单（路径 / 操作 / 时间 / 说明）
- `scripts/repo-metadata/lib/sqlite.mjs` / 新增 / 2026-02-10 10:24:xx / SQLite 路径解析、建表、tags 序列化工具
- `scripts/repo-metadata/scripts/sync-json-to-sqlite.mjs` / 新增 / 2026-02-10 10:24:xx / JSON → SQLite 全量同步脚本
- `scripts/repo-metadata/scripts/sync-json-to-postgres.mjs` / 更新 / 2026-02-10 10:24:xx / 改为兼容入口并转发到 SQLite 脚本
- `scripts/repo-metadata/scripts/sync-to-json.mjs` / 更新 / 2026-02-10 10:24:xx / 数据源从 PostgreSQL 切换为 SQLite
- `scripts/repo-metadata/mcp-server.mjs` / 更新 / 2026-02-10 10:25:xx / `repo_metadata_sync_db` 改为 JSON ⇄ SQLite，兼容旧方向参数
- `scripts/repo-metadata/sql/001_init.sql` / 更新 / 2026-02-10 10:25:xx / 初始化 SQL 从 PostgreSQL 方言切换为 SQLite 方言
- `scripts/repo-metadata/README.md` / 更新 / 2026-02-10 10:25:xx / 文档改为 SQLite 同步命令
- `scripts/repo-metadata/package.json` / 更新 / 2026-02-10 10:25:xx / 描述文案同步为 SQLite
- `docs/architecture/repo-metadata.json` / 更新 / 2026-02-10 10:27:xx / 描述字段补全（116 节点，0 未描述），并纳入 SQLite 新脚本路径
- `docs/architecture/repository-structure.md` / 更新 / 2026-02-10 10:27:xx / 目录树按最新元数据重新生成
- `docs/dev_logs/2026-02-10/04-repo-metadata-sqlite-sync.md` / 新增 / 2026-02-10 10:28:xx / 本轮开发日志

## 5. 变更说明（方案、影响范围、风险控制）
- 方案:
  - 保持 `repo-metadata.json` 为 source of truth。
  - SQL 同步默认落到 SQLite（默认路径 `docs/architecture/repo-metadata.sqlite`，可用 `REPO_METADATA_DB_PATH/SQLITE_PATH` 覆盖）。
  - MCP 同步工具支持新旧方向参数（`json-to-sqlite/sqlite-to-json` 与兼容值 `json-to-pg/pg-to-json`）。
- 影响范围:
  - 仅影响 `scripts/repo-metadata` 工具链与架构文档元数据。
  - 不影响论坛前端运行时业务逻辑。
- 风险控制:
  - 保留旧脚本入口避免现有命令立即失效。
  - 同步脚本保留 `updatedAt` 字段，避免历史元数据时间戳丢失。
  - 对空 SQLite 库做显式提示，不覆盖 JSON。

## 6. 验证结果
- `node scripts/repo-metadata/scripts/sync-json-to-sqlite.mjs`（临时 DB）: 通过，`upsert 116, 删除 0`
- `node scripts/repo-metadata/scripts/sync-json-to-postgres.mjs`（临时 DB）: 通过，兼容转发到 SQLite 成功
- `node scripts/repo-metadata/scripts/sync-to-json.mjs`（空临时 DB）: 通过，输出“SQLite 表为空，无数据可同步”
- `node --check scripts/repo-metadata/lib/sqlite.mjs`: 通过
- `node --check scripts/repo-metadata/scripts/sync-json-to-sqlite.mjs`: 通过
- `node --check scripts/repo-metadata/scripts/sync-to-json.mjs`: 通过
- `node --check scripts/repo-metadata/mcp-server.mjs`: 通过
- `node scripts/repo-metadata/scripts/scan.mjs --update`: 通过
- `node scripts/repo-metadata/scripts/generate-structure-md.mjs`: 通过
- `bash scripts/check_errors.sh`: 通过（依赖检查/typecheck/lint/build 全通过）
- `npm test`: 通过（workspace 无测试按 `--if-present` 跳过）

## 7. Git 锚点
- branch: `main`
- HEAD: `a734fc33e981809d7d7efe5decf8c1ad235dbed9`
- tag: 无
