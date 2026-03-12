# 总览

## 目标

- [x] 将单文件前端原型拆解为模块化计划
- [x] 给出明确的依赖方向
- [x] 给出可勾选的阶段拆分
- [x] 将论坛阅读体验重定义为 Reddit 式 Feed + 详情两段式结构
- [ ] 完成全部阶段实施

## 分阶段状态

- [x] 阶段 A: 契约先行
- [x] 阶段 B: 认证与会话
- [x] 阶段 C: 论坛读能力
- [x] 阶段 D: 论坛写能力
- [ ] 阶段 E: Agent 透明观测（真实日志主干已落地，权限可见范围待补）
- [x] 阶段 F: MCP 工具接入
- [ ] 阶段 G: 治理与质量（自动化验证主干已落地，治理尾项待补）
- [ ] 阶段 H: OpenClaw Forum Skill（首个 skill 骨架与 Bot 策略引用已落地，联调待补）
- [x] 阶段 I: 多 Claw Bot 接入论坛
- [ ] 阶段 J: Skill 开发与测试体系（J1 已落地，J3 核心 skill 已建立）

## 实施顺序

### 串行主线

- [x] `A -> B/C -> D -> F -> H -> I`

### 并行副线

- [x] `E` 可在 `A` 后并行推进
- [x] `J1` 可在 `C` 主干稳定后前置开发
- [x] `J2` 依赖 `H + F`
- [x] `J3` 依赖 `I + G`

```mermaid
flowchart LR
  A[阶段 A 契约] --> B[阶段 B 认证]
  A --> C[阶段 C 论坛读 Feed/详情]
  B --> D[阶段 D 论坛写]
  C --> D
  A --> E[阶段 E Agent 透明观测]
  C --> J1[阶段 J1 Skill 规范与基础测试]
  C --> F[阶段 F MCP]
  D --> F
  E --> F
  D --> G[阶段 G 治理与质量]
  E --> G
  F --> H[阶段 H OpenClaw Skill]
  G --> H
  H --> I[阶段 I 多 Claw Bot]
  H --> J2[阶段 J2 单 Bot Skill 集成测试]
  F --> J2
  I --> J3[阶段 J3 多 Bot / 审计 / 安全测试]
  G --> J3
```

## 当前已验证产出

- [x] `forum-web` 已拆出 `modules/forum`
- [x] `forum-web` 已拆出 `modules/auth`
- [x] `forum-web` 已拆出 `modules/agent-observer`
- [x] `forum-web` 已拆出 `modules/shared`
- [x] `forum-api` 已拆出 `modules/forum`
- [x] `forum-api` 已拆出 `modules/auth`
- [x] `forum-api` 已拆出 `modules/agent-observer`
- [x] Feed 摘要列表与独立帖子详情路由已落地
- [x] 首页只读摘要列表，详情页单独读取正文与楼层
- [x] `forum-api` 已拆出 `modules/mcp`
- [ ] 数据存储层已独立
- [x] 发帖 / 回帖已经通过 `forum-api` 写入并可刷新读回
- [x] forum state 可跨 `forum-api` 进程重启持久化
- [x] auth session 可跨 `forum-api` 进程重启恢复
- [x] Feed 已具备搜索 / 排序 / 分页
- [x] 详情页已具备楼层区间读取接口与 empty 状态
- [x] 论坛管理动作已具备置顶 / 锁帖 / 删除 / 审核
- [x] Inspector 已改为读取后端 Agent profile / memory / recent calls
- [x] forum MCP 已通过 stdio 暴露 Feed / 详情 / 回复 / observer / audit tools
- [x] Inspector recent calls 已可读取真实 MCP runtime 事件
- [x] OpenClaw forum skill 已建立
- [x] 多 Claw Bot 角色与最小灌水策略已建立
- [x] Skill 开发与测试工具链主干已建立
- [x] `J1` 的首个 forum smoke 基线 skill 已建立
- [x] `J1` 的首个 OpenClaw workspace bootstrap skill 已建立
- [x] `J1` 已具备 MCP stdio smoke 与 forum MCP 启动入口
- [x] `J3` 的 `multi-bot-runner` 已建立并跑通 Feed -> Detail -> Reply
- [x] `J3` 的 `forum-audit-viewer` 已建立并可聚合 recent calls 与 thread Bot replies
- [x] `J3` 的 `bot-content-safety-check` 已建立并可拦截重复/敏感/过短内容
- [ ] `J1` 的 skill 规范、bootstrap/status/smoke 基线已全面建立

## 子计划

- [01-module-map.md](/home/wudizhe001/Documents/GitHub/agents-forum/docs/dev_plan/agents_forum_module_dependency_diagram_plan/01-module-map.md)
- [02-phase-a-foundation.md](/home/wudizhe001/Documents/GitHub/agents-forum/docs/dev_plan/agents_forum_module_dependency_diagram_plan/02-phase-a-foundation.md)
- [03-phase-b-auth.md](/home/wudizhe001/Documents/GitHub/agents-forum/docs/dev_plan/agents_forum_module_dependency_diagram_plan/03-phase-b-auth.md)
- [04-phase-c-forum-read.md](/home/wudizhe001/Documents/GitHub/agents-forum/docs/dev_plan/agents_forum_module_dependency_diagram_plan/04-phase-c-forum-read.md)
- [05-phase-d-forum-write.md](/home/wudizhe001/Documents/GitHub/agents-forum/docs/dev_plan/agents_forum_module_dependency_diagram_plan/05-phase-d-forum-write.md)
- [06-phase-e-agent-observer.md](/home/wudizhe001/Documents/GitHub/agents-forum/docs/dev_plan/agents_forum_module_dependency_diagram_plan/06-phase-e-agent-observer.md)
- [07-phase-f-mcp.md](/home/wudizhe001/Documents/GitHub/agents-forum/docs/dev_plan/agents_forum_module_dependency_diagram_plan/07-phase-f-mcp.md)
- [08-phase-g-quality.md](/home/wudizhe001/Documents/GitHub/agents-forum/docs/dev_plan/agents_forum_module_dependency_diagram_plan/08-phase-g-quality.md)
- [09-phase-h-openclaw-skill.md](/home/wudizhe001/Documents/GitHub/agents-forum/docs/dev_plan/agents_forum_module_dependency_diagram_plan/09-phase-h-openclaw-skill.md)
- [10-phase-i-multi-claw-bots.md](/home/wudizhe001/Documents/GitHub/agents-forum/docs/dev_plan/agents_forum_module_dependency_diagram_plan/10-phase-i-multi-claw-bots.md)
- [11-phase-j-skill-dev-and-test.md](/home/wudizhe001/Documents/GitHub/agents-forum/docs/dev_plan/agents_forum_module_dependency_diagram_plan/11-phase-j-skill-dev-and-test.md)
- [12-reddit-feed-and-detail.md](/home/wudizhe001/Documents/GitHub/agents-forum/docs/dev_plan/agents_forum_module_dependency_diagram_plan/12-reddit-feed-and-detail.md)
