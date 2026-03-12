# 29. plan-tighten-openclaw-runtime-gates

## 用户原始请求

> 我怎么发现你的测试门禁里，没有包含让OpenClaw自主发帖，以及查看帖子地内容呢？
> 这是基本要求啊？
> 还有就是，你自己发一个帖子，看看其它Bot是否回复这些地啊
> 然后，我觉得你也没有对后端里OpenClaw的记忆系统以及real time上下文作一个测试啊，比如Claw发帖了，然后你看看它的具体上下文是什么
>
> 更新一下计划

## 轮次记录

- 背景：
  - 上一轮已经把主计划切到 “OpenClaw Bridge” 路线，并落了第一段 observer bridge。
  - 用户指出现有测试门禁仍然缺少最基本的 thread 级真实运行验收。
- 本轮目标：
  - 把缺失的真实运行验收补进主计划
  - 将其从“增强项”提升为 L0 / 硬性门禁

## 修改时间

- 开始：2026-03-12 21:43:40 +0800
- 结束：2026-03-12 21:46:25 +0800

## 文件清单

- `docs/dev_plan/openclaw-multi-bot-forum-plan.md` / 更新 / 2026-03-12 21:46:25 +0800 / 增加 OpenClaw 自主发帖、回看帖子、其他 Bot 回复、native memory/transcript 上下文等强制门禁
- `docs/dev_logs/2026-03-12/29-plan-tighten-openclaw-runtime-gates.md` / 新增 / 2026-03-12 21:46:25 +0800 / 本轮开发日志

## 变更说明

### 1. 把用户指出的 4 个缺口升级为硬性门禁

- 新主计划现在明确把以下能力列为不可跳过的运行时验收：
  - OpenClaw 自主发一个新帖
  - OpenClaw 发帖后重新读回该帖正文和元信息
  - 至少一个其他 Bot 对该帖产生真实回复
  - 在 native transcript / memory / observer 中回看该帖链的上下文

### 2. 新增 `Phase 1.5：强制运行验收门禁`

- 在 `Phase 1` 和 `Phase 2` 之间新增专门的 thread 级真实验收阶段。
- 这是为了防止 bridge 做得很漂亮，但真正的“OpenClaw 原生接入”仍然停留在只读或静态展示。

### 3. 更新 L0 与对外口径

- 现在主计划明确写明：
  - 如果还没有验收“自主发帖 -> 其他 Bot 回复 -> 回看帖子 -> native context 可追”，就不能宣称已经完成 OpenClaw 原生接入。
- 相反，`Monitoring Page` 过滤器、thread drill-down 等保留为非 L0。

## 风险与边界

- 本轮只更新计划，不修改运行时代码。
- 因此：
  - 真实运行门禁已被正式列为 blocker
  - 但这些门禁本身还没有在代码层被实现或跑通

## 验证结果

- 文档更新后质量门禁：
  - `bash scripts/check_errors.sh`：通过
  - `npm test`：通过

## Git 锚点

- branch: `main`
- commit: `20b2020e1031f51dbab0053e578921a1d0f7cf50`
- tag: 无
- backup branch: 无
