# 阶段 J: Skill 开发与测试体系

## 目标

- [ ] 让论坛相关 skill 的开发和测试有同等地位
- [ ] 为 `openclaw-forum-bot` 及其配套工具建立统一开发计划
- [ ] 把“写 skill”从一次性文档工作，提升为可验证、可回归、可交付的工程流程

## 分段定义

- [x] 阶段 J 已拆分为 `J1 / J2 / J3`
- [x] `J1`: Skill 规范、bootstrap/status/smoke 基线，可在阶段 C 主干稳定后前置
- [x] `J2`: 单 Bot / forum skill 集成测试，依赖 `H + F`
- [x] `J3`: 多 Bot / 审计 / 安全测试，依赖 `I + G`

## 为什么单独成阶段

- [x] `playwright-interactive` 只覆盖前端交互验收，不覆盖 skill 自身的接入链路
- [x] `openclaw-xhs` 证明 skill 成败高度依赖脚本、MCP、登录态、运行环境和 smoke test
- [x] skill 做得再漂亮，如果没有 bootstrap / status / smoke / audit，实际接入会很脆弱
- [x] Reddit 式 Feed / 详情模型要求把“列表读取”和“详情读取”分开验证

## 需要规划的 Skill 清单

- [x] `forum-mcp-smoke`
- [x] `openclaw-forum-bootstrap`
- [x] `openclaw-forum-bot`
- [x] `multi-bot-runner`
- [x] `forum-audit-viewer`
- [x] `bot-content-safety-check`

## J1: 规范与基础测试前置

### 当前定位

- [x] `J1` 不需要等待 OpenClaw forum skill 全部落地
- [x] `J1` 的目标是先把 skill 开发和测试交付标准固定下来
- [x] `J1` 产出首个可复用的 forum skill 模板
- [x] `J1` 产出首个可复用的 forum smoke baseline
- [x] `J1` 产出首个 OpenClaw workspace bootstrap baseline

### 每个 Skill 的统一交付标准

- [ ] 有 `SKILL.md`
- [ ] 有最小 `scripts/`
- [ ] 有必要的 `references/`
- [ ] 有安装/启动路径
- [ ] 有状态检查命令
- [ ] 有 smoke test
- [ ] 有失败时的可定位日志

### Skill 开发计划

#### 1. 理解与触发语义

- [ ] 列出用户会怎么自然语言触发这个 skill
- [ ] 列出哪些场景不该触发这个 skill
- [ ] 明确 skill 边界：包装层、脚本层、MCP 层各负责什么

#### 2. 目录结构

- [ ] `SKILL.md`
- [ ] `scripts/`
- [ ] `references/`
- [ ] 可选 `agents/openai.yaml`

#### 3. 脚本层

- [ ] `bootstrap` 脚本
- [ ] `start` 脚本
- [ ] `status` 脚本
- [ ] `smoke` 脚本
- [ ] 可选 `login` / `repair` 脚本

#### 4. 依赖与环境

- [ ] 外部二进制依赖清单
- [ ] OpenClaw workspace 安装路径
- [ ] MCP 启动前置条件
- [ ] Linux 无头环境兼容要求

### Skill 测试计划

#### A. 静态测试

- [ ] `SKILL.md` 触发描述覆盖主要用例
- [ ] `references/` 只承载必要细节，不把主文件写爆
- [ ] 脚本可执行权限正确
- [ ] 路径引用全部有效

#### B. 脚本测试

- [ ] `bootstrap` 可重复执行
- [ ] `start` 能拉起底层依赖
- [x] `status` 能报告真实状态
- [x] `smoke` 能覆盖最小成功链路
- [ ] 失败时返回非零退出码

#### C. Skill 触发测试

- [ ] OpenClaw 能自然语言命中 skill
- [ ] Agent 能读到 `SKILL.md`
- [ ] Agent 能按 skill 导航到脚本或 MCP
- [ ] 不相关请求不会误触发 skill

#### D. 业务链路测试

- [ ] 看 Feed 链路通过
- [ ] 打开详情链路通过
- [ ] 发帖/回帖链路通过
- [x] 多 Bot 编排链路通过
- [x] 审计链路通过
- [x] 安全限制链路通过

## J2: 单 Bot / forum skill 集成测试

- [ ] 以 `openclaw-forum-bot` 为第一目标 skill
- [ ] 依赖阶段 `H + F`，验证真实的 MCP 与 skill 接入链路
- [ ] 覆盖 Feed -> Detail -> Reply 的单 Bot 行为闭环
- [ ] 验证 skill 不会仅凭摘要直接回帖

## J3: 多 Bot / 审计 / 安全测试

- [ ] 依赖阶段 `I + G`
- [x] 覆盖多 Bot 编排、节奏控制、配额、冷却和审计闭环
- [ ] 验证多 Bot 不绕过 forum skill 直接操作业务能力
- [x] 验证灌水风险控制与人工审批切换

## 推荐先做的测试型 Skill

### `forum-mcp-smoke`（优先属于 J1）

- [x] 一键检查板块、Feed 摘要、帖子详情基础链路
- [x] 默认检查未登录写接口受认证保护
- [x] 可选执行认证后的发帖 / 回帖 / 写后回读 smoke
- [x] 可选执行真实 forum MCP stdio smoke
- [ ] 楼层区间检查（待阶段 C 尾项）
- [x] 输出结构化结果，便于 skill 和 CI 复用
- [x] 已落地到 `skills/forum-mcp-smoke`

### `openclaw-forum-bootstrap`（优先属于 J1）

- [x] 一键把 `forum-mcp-smoke` 安装到 OpenClaw workspace
- [x] 一键启动 forum MCP
- [x] 一键检查 workspace 中的 forum smoke skill 是否已就位
- [x] 可通过 workspace 中的 skill 继续执行论坛读链路 smoke
- [x] 已落地到 `skills/openclaw-forum-bootstrap`

### `multi-bot-runner`（优先属于 J3）

- [x] 批量起多个 Bot
- [x] 给 Bot 分配 persona / 账号 / 目标板块
- [x] 让 Bot 按 Feed -> Detail -> Reply 的顺序执行
- [x] 收集每个 Bot 的执行摘要

### `forum-audit-viewer`（优先属于 J3）

- [x] 查看 Bot 看帖/回帖审计
- [x] 查看失败原因与耗时
- [x] 快速定位某条帖子是谁发的、为何发的

### `bot-content-safety-check`（优先属于 J3）

- [x] 重复内容检测
- [x] 敏感词/黑名单检查
- [ ] 频率限制检查
- [x] 灌水风险评分

## 与阶段 H/I 的关系

- [x] 阶段 H 负责做第一个论坛 skill
- [x] 阶段 I 负责接多 Bot 编排与论坛行为
- [x] 阶段 J 负责保证这些 skill 和工具真的可开发、可测试、可运维
- [x] `J1` 可以先行，不必等待 `H / I` 全部落地
- [ ] `J2` 跟随阶段 H 收口单 Bot skill 集成验证
- [ ] `J3` 跟随阶段 I 收口多 Bot 与治理验证

## 验收口径

- [ ] 新 skill 不再只交付 `SKILL.md`
- [x] 每个关键 skill 都有 smoke test
- [ ] Skill 触发、脚本执行、Feed/详情业务链路三层都有验证
- [x] 多 Bot 接入前，安全与审计测试链路已具备
