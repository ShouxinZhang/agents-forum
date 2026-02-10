# repo-map

通用仓库元数据思维导图工具（`scripts` 独立工具）。

## 功能

- 左到右思维导图（React Flow，按层渐进展开）
- 悬浮显示节点说明（path/type/description/detail/tags/source/updatedAt）
- 数据源切换：`SQLite` / `JSON`（JSON 只读）
- 节点全量 CRUD（新增/删除/移动/重命名/字段编辑）
- 布局自动持久化到 SQLite（`repo_metadata_layout`）
- SQLite 与 JSON 一致性检查（顶部告警，不阻断）
- 一键 `SQLite -> JSON` 同步
- 页面内 SQL 模板展示与复制

## 启动

```bash
# 从仓库根目录
npm run repo-map:dev
```

默认地址：`http://127.0.0.1:4180`

## 可选参数

```bash
bash scripts/repo-map/run.sh --repo-root /path/to/repo --db-path docs/architecture/repo-metadata.sqlite --host 127.0.0.1 --port 4180
```

参数说明：

- `--repo-root`: 目标仓库根目录（默认当前工作目录）
- `--db-path`: SQLite 路径（默认 `REPO_METADATA_DB_PATH` / `SQLITE_PATH` / `docs/architecture/repo-metadata.sqlite`）
- `--host`: 监听地址（默认 `127.0.0.1`）
- `--port`: 监听端口（默认 `4180`）

## API

- `GET /api/map?source=sqlite|json`（全量调试）
- `GET /api/map/bootstrap?source=sqlite|json`（根 + 一级）
- `GET /api/map/children?source=sqlite|json&parentPath=<url-encoded>`（按需加载子节点）
- `GET /api/consistency`
- `POST /api/nodes`
- `PATCH /api/nodes/:path`（`path` 需 URL encode）
- `DELETE /api/nodes/:path?cascade=true`
- `PUT /api/layout`
- `POST /api/sync/sqlite-to-json`
- `GET /api/sql-template`
