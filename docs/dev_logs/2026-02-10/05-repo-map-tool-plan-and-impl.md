# 开发日志 - Repo Metadata 通用思维导图工具（scripts 独立）

## 1. 用户原始请求
> PLEASE IMPLEMENT THIS PLAN:
> Repo Metadata 通用思维导图工具计划（scripts 独立、React Flow、SQLite 持久化）
> ...

## 2. 轮次摘要
- 目标: 按既定方案交付 `scripts` 独立工具，实现 repo metadata 左到右思维导图、悬浮说明、SQLite/JSON 切换、全量 CRUD、布局持久化与一致性告警。
- 核心实施:
  - 新建 `scripts/repo-map` 工具目录，落地 Node + Hono API 与独立前端页面。
  - 前端使用 React + React Flow，实现画布浏览、节点选择、编辑、创建子节点、删除子树、布局拖拽保存。
  - 后端实现 `GET /api/map`、`GET /api/consistency`、节点 CRUD、`PUT /api/layout`、`POST /api/sync/sqlite-to-json`、`GET /api/sql-template`。
  - 增加 SQLite 布局表 `repo_metadata_layout`，并在 SQLite 空库时自动从 `repo-metadata.json` 引导导入，保证首启可用。
  - 增加顶层脚本 `npm run repo-map:dev`，支持 `--repo-root/--db-path/--host/--port`。
  - 同步更新架构元数据与结构文档。

## 3. 修改时间
- 完成时间: 2026-02-10 11:05:27 +0800
- 时间戳(秒): 1770692727

## 4. 文件清单（路径 / 操作 / 说明）
- `scripts/repo-map/package.json` / 新增 / repo-map workspace 包配置
- `scripts/repo-map/run.sh` / 新增 / repo-map 启动脚本
- `scripts/repo-map/README.md` / 新增 / 使用说明与 API 列表
- `scripts/repo-map/src/server.mjs` / 新增 / HTTP 服务与 API 路由
- `scripts/repo-map/src/lib/db.mjs` / 新增 / SQLite 连接、参数解析、路径工具与建表
- `scripts/repo-map/src/lib/metadata-store.mjs` / 新增 / 节点读取、CRUD、布局持久化、同步与 SQL 模板
- `scripts/repo-map/src/lib/consistency-check.mjs` / 新增 / SQLite 与 JSON 对比逻辑
- `scripts/repo-map/web/index.html` / 新增 / 前端页面与样式
- `scripts/repo-map/web/main.tsx` / 新增 / 前端状态管理与 API 调用编排
- `scripts/repo-map/web/types.ts` / 新增 / 前端类型常量与输入工具
- `scripts/repo-map/web/components/MapCanvas.tsx` / 新增 / React Flow 画布组件
- `scripts/repo-map/web/components/NodeEditor.tsx` / 新增 / 节点编辑 CRUD 组件
- `scripts/repo-map/web/components/Toolbar.tsx` / 新增 / 数据源切换、同步与一致性提示
- `scripts/repo-map/web/components/SqlPanel.tsx` / 新增 / SQL 模板展示与复制
- `package.json` / 更新 / 增加 workspace: `scripts/repo-map` 与脚本 `repo-map:dev`
- `package-lock.json` / 更新 / workspace 与依赖图同步
- `.gitignore` / 更新 / 忽略 SQLite 运行产物（`*.sqlite`, `*.sqlite3`）
- `docs/architecture/repo-metadata.json` / 更新 / 补充 repo-map 与相关节点描述
- `docs/architecture/repository-structure.md` / 更新 / 结构树重新生成
- `docs/dev_logs/2026-02-10/05-repo-map-tool-plan-and-impl.md` / 新增 / 本轮日志

## 5. 变更说明（方案、影响范围、风险控制）
- 方案:
  - 工具独立于 forum app，部署于 `scripts/repo-map`，兼容后续复制到其他仓库。
  - 默认读取 SQLite，JSON 模式只读；编辑仅写 SQLite；手动触发 SQLite -> JSON 同步。
  - 一致性比较维度为结构（path+parent）和字段值（type/description/detail/tags），仅顶部告警不阻断操作。
- 影响范围:
  - 新增通用工具目录与根 workspace 配置。
  - 增加对 repo metadata 的可视化和交互维护路径。
  - 不影响论坛业务页面运行逻辑。
- 风险控制:
  - 对路径合法性、父子环路、重名冲突、级联删除等加后端校验。
  - 子树重命名/移动使用事务，避免部分写入。
  - JSON 同步失败不回滚 SQLite，返回错误供重试。

## 6. 验证结果
- 语法检查:
  - `node --check scripts/repo-map/src/lib/db.mjs`：通过
  - `node --check scripts/repo-map/src/lib/metadata-store.mjs`：通过
  - `node --check scripts/repo-map/src/lib/consistency-check.mjs`：通过
  - `node --check scripts/repo-map/src/server.mjs`：通过
- API/功能验证（临时 SQLite）:
  - `GET /api/health`：通过
  - `GET /api/map?source=sqlite`：通过（nodes=116）
  - `GET /api/map?source=json`：通过（editable=false）
  - `GET /api/consistency`：通过（status=ok）
  - `GET /api/sql-template`：通过（两个 SQL 模板都返回）
  - `POST/PATCH/DELETE /api/nodes`：通过（创建、重命名、删除子树）
  - `PUT /api/layout`：通过（布局保存）
  - `POST /api/sync/sqlite-to-json`：通过（在临时 repoRoot 回写成功）
- 启动链路验证:
  - `npm run repo-map:dev -- --host 127.0.0.1 --port 4183 --db-path <tmp>`：通过
- 质量门禁:
  - `bash scripts/check_errors.sh`：通过（4/4）
  - `npm test`：通过（workspaces 无测试按 `--if-present` 跳过）

## 7. Git 锚点
- branch: `main`
- HEAD: `a734fc33e981809d7d7efe5decf8c1ad235dbed9`
- tag: 无
