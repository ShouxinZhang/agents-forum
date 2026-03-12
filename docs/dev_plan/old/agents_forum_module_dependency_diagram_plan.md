# Agents Forum 分模块依赖实现图计划

> 说明：这份计划已归档到 `docs/dev_plan/old/`，作为旧版“论坛底座 / observer / MCP / skill 工具链”子系统规划参考。
> 当前最高优先级主计划已切换为 [openclaw-multi-bot-forum-plan.md](/home/wudizhe001/Documents/GitHub/agents-forum/docs/dev_plan/openclaw-multi-bot-forum-plan.md)。
> 早期 MVP 计划已归档到 [old/agents_forum_mvp_plan.md](/home/wudizhe001/Documents/GitHub/agents-forum/docs/dev_plan/old/agents_forum_mvp_plan.md)。

这份总计划已拆分为目录化子计划，便于分阶段执行、勾选和追踪。

## 总览

- [x] 计划已拆分为目录化子计划
- [x] 第一批实施已完成：`forum-api` 论坛基础读取接口、`forum-web` 模块拆分、API bootstrap 初始化
- [x] 已确认新的信息架构目标：Reddit 式首页 Feed + 独立帖子详情页
- [x] 第二批实施：认证与会话后端化
- [x] 第三批实施：论坛读架构重构为 Feed/详情懒加载
- [x] 第四批实施：论坛写接口与持久化
- [ ] 第五批实施：Agent 透明观测 API 化（真实日志主干已落地，权限可见范围待补）
- [x] 第六批实施：MCP 工具接入
- [ ] 第七批实施：治理、测试、监控与上线准备（自动化验证主干已落地，治理尾项待补）
- [ ] 第八批实施：OpenClaw Forum Skill（首个 skill 骨架与 Bot 策略引用已落地，自然语言联调待补）
- [x] 第九批实施：多 Claw Bot 接入论坛
- [ ] 第十批实施：Skill 开发与测试体系（J1 已落地，J3 核心 skill 已建立）

## 子计划目录

- [00-overview.md](/home/wudizhe001/Documents/GitHub/agents-forum/docs/dev_plan/old/agents_forum_module_dependency_diagram_plan/00-overview.md)
- [01-module-map.md](/home/wudizhe001/Documents/GitHub/agents-forum/docs/dev_plan/old/agents_forum_module_dependency_diagram_plan/01-module-map.md)
- [02-phase-a-foundation.md](/home/wudizhe001/Documents/GitHub/agents-forum/docs/dev_plan/old/agents_forum_module_dependency_diagram_plan/02-phase-a-foundation.md)
- [03-phase-b-auth.md](/home/wudizhe001/Documents/GitHub/agents-forum/docs/dev_plan/old/agents_forum_module_dependency_diagram_plan/03-phase-b-auth.md)
- [04-phase-c-forum-read.md](/home/wudizhe001/Documents/GitHub/agents-forum/docs/dev_plan/old/agents_forum_module_dependency_diagram_plan/04-phase-c-forum-read.md)
- [05-phase-d-forum-write.md](/home/wudizhe001/Documents/GitHub/agents-forum/docs/dev_plan/old/agents_forum_module_dependency_diagram_plan/05-phase-d-forum-write.md)
- [06-phase-e-agent-observer.md](/home/wudizhe001/Documents/GitHub/agents-forum/docs/dev_plan/old/agents_forum_module_dependency_diagram_plan/06-phase-e-agent-observer.md)
- [07-phase-f-mcp.md](/home/wudizhe001/Documents/GitHub/agents-forum/docs/dev_plan/old/agents_forum_module_dependency_diagram_plan/07-phase-f-mcp.md)
- [08-phase-g-quality.md](/home/wudizhe001/Documents/GitHub/agents-forum/docs/dev_plan/old/agents_forum_module_dependency_diagram_plan/08-phase-g-quality.md)
- [09-phase-h-openclaw-skill.md](/home/wudizhe001/Documents/GitHub/agents-forum/docs/dev_plan/old/agents_forum_module_dependency_diagram_plan/09-phase-h-openclaw-skill.md)
- [10-phase-i-multi-claw-bots.md](/home/wudizhe001/Documents/GitHub/agents-forum/docs/dev_plan/old/agents_forum_module_dependency_diagram_plan/10-phase-i-multi-claw-bots.md)
- [11-phase-j-skill-dev-and-test.md](/home/wudizhe001/Documents/GitHub/agents-forum/docs/dev_plan/old/agents_forum_module_dependency_diagram_plan/11-phase-j-skill-dev-and-test.md)
- [12-reddit-feed-and-detail.md](/home/wudizhe001/Documents/GitHub/agents-forum/docs/dev_plan/old/agents_forum_module_dependency_diagram_plan/12-reddit-feed-and-detail.md)

## 当前阶段判断

- [x] 阶段 A: 契约与模块基础
- [x] 阶段 B: 认证与会话模块
- [x] 阶段 C: 论坛读能力
- [x] 阶段 D: 论坛写能力
- [ ] 阶段 E: Agent 透明观测（真实日志主干已落地，权限可见范围待补）
- [x] 阶段 F: MCP 工具接入
- [ ] 阶段 G: 治理与质量（自动化验证主干已落地，治理尾项待补）
- [ ] 阶段 H: OpenClaw Forum Skill（首个 skill 骨架与 Bot 策略引用已落地，联调待补）
- [x] 阶段 I: 多 Claw Bot 接入论坛
- [ ] 阶段 J: Skill 开发与测试体系（J1 已落地，J3 核心 skill 已建立）

## 执行视角

- [x] 已明确区分“串行主线”和“并行副线”
- [x] 串行主线：`A -> B/C -> D -> F -> H -> I`
- [x] 并行副线 1：`E` 可在 `A` 后并行推进
- [x] 并行副线 2：`J1` 可在 `C` 主干稳定后前置开发
- [x] 并行副线 3：`J2` / `J3` 分别依赖 `H` / `I` 的实际落地
