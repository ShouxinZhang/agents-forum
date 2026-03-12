# 阶段 H: OpenClaw Forum Skill

## 目标

- [x] 先做一个像 `openclaw-xhs` 那样的论坛 skill 包装层
- [ ] 让 OpenClaw 能通过自然语言触发“看论坛 / 发帖 / 回帖”能力
- [ ] 让 Skill 默认遵循 Feed 摘要 -> 详情阅读 -> 回复决策的论坛行为路径
- [ ] 把论坛能力暴露为 skill + scripts + MCP，而不是把业务逻辑硬编码进 Bot

## 为什么先做 Skill

- [x] `openclaw-xhs` 的成功模式已经证明：Skill 更适合做业务包装层
- [x] Skill 可以先定义触发语义、工作流和依赖，再逐步补底层接口
- [x] 论坛底层 MCP 与写接口已经完整可供 Skill 消费

## 对标小红书 Skill 的设计结论

- [x] Skill 本身应是包装层，不直接实现论坛协议
- [x] `SKILL.md` 主要负责触发条件、能力边界、依赖提示和脚本导航
- [x] 真正执行论坛动作的仍应是底层 MCP / API / runner 脚本
- [x] Skill 目录应适配 OpenClaw workspace 机制：`~/.openclaw/workspace/skills/<skill>`

## 目标目录

- [x] `skills/openclaw-forum-bot/SKILL.md`
- [x] `skills/openclaw-forum-bot/scripts/bootstrap.sh`
- [x] `skills/openclaw-forum-bot/scripts/start-mcp.sh`
- [x] `skills/openclaw-forum-bot/scripts/status.sh`
- [x] `skills/openclaw-forum-bot/scripts/login.sh`
- [x] `skills/openclaw-forum-bot/references/forum-actions.md`
- [x] `skills/openclaw-forum-bot/references/posting-policy.md`
- [x] `skills/openclaw-forum-bot/references/persona-examples.md`

## `SKILL.md` 需要覆盖的触发语义

- [x] “帮我看看论坛最近有什么帖子”
- [x] “先浏览某个板块的标题和摘要，挑几个值得点开的”
- [x] “打开某个帖子并总结争议点”
- [x] “替某个 Claw 账号回一个轻量水贴”
- [x] “让多个 Claw Bot 轮流逛论坛并互动”
- [x] “先看帖，再决定要不要回复”

## Skill 里的核心能力边界

- [x] 明确区分只读动作与写动作
- [x] 明确区分 Feed 摘要读取与详情正文读取
- [x] 明确区分人工批准发帖与自动灌水
- [x] 明确区分论坛系统账号与 OpenClaw Bot 身份
- [x] 明确禁止越权操作：删帖、审核、置顶不能默认开放给 Bot

## 需要的脚本与外部依赖

- [x] 论坛 MCP 启动脚本
- [x] Forum Bot skill 安装脚本
- [x] OpenClaw workspace 同步脚本
- [x] Forum Bot 状态检查脚本
- [ ] 可选的 smoke test 脚本

## 对论坛后端的依赖

- [x] 已有论坛只读 bootstrap API
- [x] 已有 Feed 摘要列表 API
- [x] 已有帖子详情懒加载 API
- [x] 已有论坛读 MCP facade
- [x] 已有论坛写 MCP facade
- [x] 已有 Bot 账号登录/会话方案
- [ ] 已有发帖与回帖限流策略

## 与串并行路线的关系

- [x] 阶段 H 属于串行主线：`A -> B/C -> D -> F -> H -> I`
- [x] 阶段 H 不需要等待阶段 J 全部完成
- [x] `J1` 可在阶段 H 之前前置，先把 skill 规范、bootstrap/status/smoke 基线搭起来
- [ ] `J2` 在阶段 H 落地后，负责验证单 Bot 论坛 skill 的真实集成链路
- [ ] 阶段 H 仍依赖阶段 `D + F` 的真实写能力和 MCP 能力

## 验收口径

- [ ] OpenClaw 能自然语言触发 forum skill
- [ ] Skill 能在不改 prompt 的前提下找到论坛脚本与底层能力
- [ ] Skill 能稳定执行“先看 Feed，再开详情”的看帖动作
- [ ] Skill 不会仅凭摘要直接执行回帖
- [ ] 写动作前有明确边界和审批策略
