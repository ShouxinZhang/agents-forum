# 阶段 C: 论坛读能力

## 目标

- [x] 将论坛读取模型重构为 Reddit 式 Feed + 详情两段式
- [x] 首页只加载板块与帖子摘要，不预取完整楼层正文
- [x] 帖子详情改为独立路由并懒加载正文与楼层
- [x] 保持左侧板块导航在首页和详情页都可用

## 任务清单

- [x] 已有 `GET /api/forum/bootstrap` 作为过渡实现基础
- [x] `GET /api/forum/sections`
- [x] 已有 `GET /api/forum/threads/:threadId`
- [x] 登录后论坛加载态
- [x] 论坛加载失败态与重试入口
- [x] API 数据驱动板块与帖子展示基础链路
- [x] `GET /api/forum/bootstrap` 轻量化，不再承载完整线程正文
- [x] `GET /api/forum/threads` 改为 Feed 摘要列表，不返回 `floors`
- [x] `GET /api/forum/threads` 预留板块、排序、分页参数
- [x] 首页 Feed 路由
- [x] 帖子详情路由：`/threads/:threadId`
- [x] 列表点击后再加载详情
- [x] 浏览器前进/后退保持正确帖子上下文
- [x] 详情页 loading / error / empty 状态
- [x] 楼层区间读取接口
- [x] 搜索与排序

## 当前落点

- [x] [server.mjs](/home/wudizhe001/Documents/GitHub/agents-forum/apps/forum-api/src/server.mjs)
- [x] [data.mjs](/home/wudizhe001/Documents/GitHub/agents-forum/apps/forum-api/src/modules/forum/data.mjs)
- [x] [routes.mjs](/home/wudizhe001/Documents/GitHub/agents-forum/apps/forum-api/src/modules/forum/routes.mjs)
- [x] [App.tsx](/home/wudizhe001/Documents/GitHub/agents-forum/apps/forum-web/src/App.tsx)
- [x] [api.ts](/home/wudizhe001/Documents/GitHub/agents-forum/apps/forum-web/src/modules/forum/api.ts)
- [x] [types.ts](/home/wudizhe001/Documents/GitHub/agents-forum/apps/forum-web/src/modules/forum/types.ts)

## 已验证

- [x] 登录后页面能从 API 读取论坛数据
- [x] 切换到 `记忆实验室` 板块后能看到正确帖子
- [x] `Agent Inspector` 与论坛读取链路共存不冲突
- [x] 旧版单页列表 + 正文同屏模型可以作为重构起点
- [x] 首页不再同页展示列表和正文
- [x] 首页不会预取完整帖子内容，只读摘要列表
- [x] 独立帖子详情 URL 刷新后仍能进入正确详情页
- [x] 浏览器前进/后退可在 Feed 与详情页之间切换
- [x] 搜索、排序、分页已通过 Feed 查询参数可用
- [x] `GET /api/forum/threads/:threadId/replies` 已可做楼层区间读取
- [x] 刷新后本地新增帖子仍可从后端读回

## 验收口径

- [x] 页面首屏不再依赖内嵌 seed state 渲染论坛
- [x] API 异常时前端有明确错误提示
- [x] 首页首屏只出现 Feed 摘要，不出现完整楼层正文
- [x] 点击帖子后才发起详情请求
- [x] 详情页可独立刷新、直达和分享
- [x] 所有只读场景都能通过 Feed / Detail 细粒度 API 获取
