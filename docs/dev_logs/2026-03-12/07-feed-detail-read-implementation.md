# 开发日志 - Feed / 详情读架构第一步实现

## 用户原始请求

> Plan是否更新了？
> 更新了就继续按照路线图干活儿。

## 轮次背景与意图摘要

- 背景：路线图已改为 Reddit 式信息架构，但代码仍是“首页列表 + 正文同屏”的单页模型。
- 本轮目标：按阶段 C 的新路线落第一步实现，让论坛从单页模式切到“首页 Feed 摘要列表 + 独立帖子详情 URL + 详情懒加载正文”。
- 范围控制：
  - 只改论坛读路径与本地前端写入后的呈现路径，不做真实写接口持久化。
  - 不引入新路由库，继续保持最小依赖面，使用浏览器历史 API 落独立帖子 URL。
  - 保留当前前端本地发帖/回帖逻辑，但让它们适配新的 Feed / Detail 结构。

## 修改时间

- 2026-03-12 01:43:19 CST

## 文件清单

- `apps/forum-api/src/modules/forum/data.mjs` / 更新 / 2026-03-12 01:43:19 CST / 新增线程摘要与板块计数构建，bootstrap 收敛为轻量 sections
- `apps/forum-api/src/modules/forum/routes.mjs` / 更新 / 2026-03-12 01:43:19 CST / `GET /threads` 改为返回摘要列表，`GET /bootstrap` / `GET /sections` 返回带计数板块
- `apps/forum-web/src/modules/forum/types.ts` / 更新 / 2026-03-12 01:43:19 CST / 新增 `ForumRoute`、`ThreadSummary`，为 `Section` 增加 `threadCount`
- `apps/forum-web/src/modules/forum/api.ts` / 更新 / 2026-03-12 01:43:19 CST / 新增 `fetchForumThreads` 与 `fetchForumThread`，抽象统一 API 读取器
- `apps/forum-web/src/modules/forum/utils.ts` / 更新 / 2026-03-12 01:43:19 CST / 新增摘要计算、帖子路径构造、路径解析工具
- `apps/forum-web/src/App.tsx` / 更新 / 2026-03-12 01:43:19 CST / 将前端主界面改为 Feed / 详情两段式，接入 URL 路由、摘要缓存、详情缓存、本地发帖/回帖同步
- `docs/dev_plan/agents_forum_module_dependency_diagram_plan/00-overview.md` / 更新 / 2026-03-12 01:43:19 CST / 同步总览页的已验证产出勾选状态
- `docs/dev_plan/agents_forum_module_dependency_diagram_plan/04-phase-c-forum-read.md` / 更新 / 2026-03-12 01:43:19 CST / 按实际实现勾选阶段 C 已完成项
- `docs/dev_plan/agents_forum_module_dependency_diagram_plan/12-reddit-feed-and-detail.md` / 更新 / 2026-03-12 01:43:19 CST / 回写 Feed / 详情专项子计划完成状态
- `docs/dev_logs/2026-03-12/07-feed-detail-read-implementation.md` / 新增 / 2026-03-12 01:43:19 CST / 本轮开发日志

## 变更说明

- 后端只读契约：
  - `bootstrap` 不再返回完整线程正文，只返回板块及 `threadCount`。
  - `threads` 列表接口改为摘要契约，返回标题、摘要、标签、作者、时间、`replyCount`，不返回 `floors`。
  - `threads/:threadId` 继续返回完整帖子详情与楼层，作为独立详情页的数据源。
- 前端信息架构：
  - 首页改为板块侧栏 + Feed 摘要列表，点击帖子后进入 `/threads/:threadId`。
  - 详情页进入后才拉取完整帖子正文与楼层。
  - 发帖后直接跳转到新帖详情页；回帖后同步更新当前详情与 Feed 摘要计数。
- 状态与交互：
  - 使用浏览器历史 API 做最小路由实现，支持根路径 Feed 和独立帖子详情路径。
  - 增加按板块缓存 Feed 摘要、按线程缓存详情的本地状态，避免在当前阶段 D 未落地时，局部交互立即退化。
  - 修复一次真实布局问题：窄宽布局下卡片内容区高度塌陷，导致详情页“发布回复”按钮被上层 header 拦截。现在改为移动端自然撑开、桌面端内部滚动。
- 路线图状态：
  - 本轮回写了阶段 C 与 Feed / 详情专项子计划的已完成项。
  - 阶段 C 仍未整体打勾，因为搜索、排序、楼层区间读取等只读能力还没补完。
- 回归过程中的环境处理：
  - `playwright-interactive` 需要当前 workspace 可 `import('playwright')`，但本仓库未安装该包，因此回退到会话内置 Playwright 浏览器工具进行同等回归。
  - 回归时发现 `forum-api` 仍在跑旧进程，已单独重启 API 进程，使新契约生效后再验证。

## 验证结果

- `bash scripts/check_errors.sh`：通过
- `npm test`：通过
- `curl http://127.0.0.1:4174/api/forum/bootstrap`：通过，确认返回 `threadCount`
- `curl http://127.0.0.1:4174/api/forum/threads?sectionId=arena`：通过，确认返回摘要列表与 `replyCount`
- Playwright 浏览器回归：通过
  - 根路径仅展示 Feed 摘要列表，不展示正文楼层
  - 点击 `[MVP] A/B/C 如何分工构建论坛？` 后进入 `/threads/t-1001`
  - 浏览器前进/后退可在 Feed 与详情页之间切换
  - 详情页发布回复成功，回复数从 `3` 增加到 `4`
  - Feed 页新建帖子后直接跳转到独立详情页
  - 从新帖详情返回 Feed 后，摘要卡片出现在列表顶部且计数正常

## Git 锚点

- branch: `main`
- commit: `20b2020e1031f51dbab0053e578921a1d0f7cf50`
