# 开发日志 - Repo Map 渐进展开（文件夹式逐层查看）

## 1. 用户原始请求
> PLEASE IMPLEMENT THIS PLAN:
> Repo Map 渐进展开改造计划（文件夹式逐层查看）
> ...

## 2. 轮次摘要
- 目标: 将 `repo-map` 从全量一次性加载改为“根 + 一级 + 按目录点击逐层加载”。
- 实施核心:
  - 后端新增分层接口：`/api/map/bootstrap` 与 `/api/map/children`。
  - 前端改造为缓存式按需加载：`loaded nodes/edges + expandedPaths + childrenLoadedPaths + collapsedMap`。
  - 目录节点增加展开/折叠按钮，点击目录按层请求子节点。
  - SQLite 模式下将折叠状态持久化到 `repo_metadata_layout.collapsed`；JSON 模式禁止写入。
  - 保留 `GET /api/map` 作为全量调试接口。

## 3. 修改时间
- 完成时间: 2026-02-10 11:37:39 +0800
- 时间戳(秒): 1770694659

## 4. 文件清单（路径 / 操作 / 说明）
- `scripts/repo-map/src/lib/metadata-store.mjs` / 更新 / 新增 bootstrap/children 构建逻辑、collapsed map 组装、按父节点查询子节点
- `scripts/repo-map/src/server.mjs` / 更新 / 新增 `GET /api/map/bootstrap`、`GET /api/map/children`；`PUT /api/layout` 增加 JSON 只读保护
- `scripts/repo-map/web/main.tsx` / 更新 / 前端状态改造为按需加载与可见性过滤；目录展开/折叠交互接入
- `scripts/repo-map/web/components/MapCanvas.tsx` / 更新 / 目录节点增加展开按钮，接入 toggle 回调
- `scripts/repo-map/web/components/Toolbar.tsx` / 更新 / 增加展开统计信息展示
- `scripts/repo-map/web/index.html` / 更新 / 新增展开按钮与统计样式
- `scripts/repo-map/README.md` / 更新 / 补充分层 API 文档
- `docs/dev_logs/2026-02-10/06-repo-map-progressive-expand.md` / 新增 / 本轮日志

## 5. 变更说明（方案、影响范围、风险控制）
- 方案:
  - 首屏仅展示“根节点 + 直接子节点”；更深层由用户点击目录后按需拉取。
  - 可见性规则按祖先展开状态计算，折叠后不清缓存，再次展开可秒开。
  - 折叠状态通过 `PUT /api/layout` 写入 SQLite；JSON 源模式下后端拒绝状态写入。
- 影响范围:
  - 仅影响 `scripts/repo-map` 工具的后端与前端交互模型。
  - 不影响 forum-web/forum-api 业务路径。
- 风险控制:
  - children 请求使用 in-flight 去重，避免同节点并发重复请求。
  - source 切换时清空分层缓存并重新 bootstrap，避免跨源状态污染。
  - 保留全量接口用于排障与回归对照。

## 6. 验证结果
- 接口验证（临时 SQLite）:
  - `GET /api/map/bootstrap?source=sqlite`：通过（仅返回根+一级）
  - `GET /api/map/children?source=sqlite&parentPath=scripts`：通过（返回 `scripts` 直接子节点）
  - `PUT /api/layout` with `source=json`：通过（返回 400，提示 JSON 模式只读）
- 质量门禁:
  - `bash scripts/check_errors.sh`：通过（依赖检查/typecheck/lint/build 全通过）
  - `npm test`：通过（workspace 无测试按 `--if-present` 跳过）
- 语法检查:
  - `node --check scripts/repo-map/src/lib/metadata-store.mjs`：通过
  - `node --check scripts/repo-map/src/server.mjs`：通过

## 7. Git 锚点
- branch: `main`
- HEAD: `a734fc33e981809d7d7efe5decf8c1ad235dbed9`
- tag: 无
