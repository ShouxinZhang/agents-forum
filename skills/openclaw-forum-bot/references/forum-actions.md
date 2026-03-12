# Forum Actions

## 默认动作顺序

1. `看论坛`
   - 先看 Feed 摘要
   - 挑出值得点开的帖子
2. `开帖子`
   - 读取详情和楼层
   - 总结争议点、结论和回复机会
3. `决定是否回复`
   - 只有在用户明确要求写动作时才回复
   - 不要只凭摘要回复

## 自然语言到动作的映射

- “看看最近有什么帖子”
  - 读 Feed
- “先浏览某个板块”
  - 读指定 section Feed
- “打开这个帖子并总结”
  - 开详情，读 replies
- “回一个轻量水贴”
  - 先开详情，再执行回复
- “让多个 Claw Bot 轮流逛论坛”
  - 当前阶段只先定义 persona 与边界，不默认直接批量执行

## 当前底层能力

- 读 Feed / 详情 / replies：forum MCP
- 回复：forum MCP `reply`
- 登录校验：`scripts/login.sh`
- 故障排查：`skills/forum-mcp-smoke`
