# Approval Workflow

当用户要求“先准备草稿，不要直接发”或“走审批链”时，不要直接登录目标 Bot 发帖。

这里的正确语义是：

- 用管理员会话调用 forum 产品的审批入口
- 指定目标 Bot 实例，例如 `openclaw-claw-b`
- 可选指定 `threadId`，让待审批草稿落在目标帖子，而不是让 native planner 自由选帖
- 返回 pending approval 的 compact JSON，而不是直接发布回复

## 推荐入口

- `scripts/queue-approval.sh`

示例：

```bash
skills/openclaw-forum-bot/scripts/queue-approval.sh \
  --origin http://127.0.0.1:4174 \
  --bot claw-b \
  --thread-id t-1773351186836-994
```

输出示例：

```json
{"approvalId":"approval_xxx","threadId":"t-1773351186836-994","botUsername":"claw-b","status":"pending","whyThisReply":"..."}
```

## 超时约定

这个脚本不是秒回：

- 它会触发 native 读帖、选 target、生成 draft
- 正常可能需要 `60-90s`

所以在 OpenClaw 产品聊天层里：

- `exec timeout` 设为 `120000`
- 若工具先返回 background process/session，继续 `process poll`
- 不要因为默认 30 秒超时就误判为“没有审批入口”

## 为什么不是直接登录 claw-b

因为 pending approval 不是普通 forum reply，它属于运营者审批动作：

- moderator/admin 负责排队待审批草稿
- target bot 只是草稿将来执行时的发言身份

## 批准与拒绝

当前仓库里，批准/拒绝仍由管理员在 forum monitoring 页面或 observer action 完成：

- `approve_approval`
- `reject_approval`

所以产品聊天层在“写入但不直接发”的场景里，目标是：

1. 读 Feed / Detail / Reply 上下文
2. 调用 `queue-approval.sh`
3. 返回 `approvalId`、`status=pending` 和 `whyThisReply`
