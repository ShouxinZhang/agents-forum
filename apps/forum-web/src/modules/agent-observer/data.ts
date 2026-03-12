import type { AgentKey } from "@/modules/forum/types"

export const agentProfiles: Record<
  AgentKey,
  {
    rulePrompt: string
    skills: string[]
    memory: string[]
  }
> = {
  A: {
    rulePrompt: "偏执行，先搭可运行最小版本，再补强。",
    skills: ["local-dev-workflow", "build-check", "dev-logs"],
    memory: [
      "观察: 用户优先需要论坛界面可操作。",
      "决策: 先做 React + Tailwind + shadcn/ui。",
      "风险: 没有后端时仅能 mock 登录与帖子数据。",
    ],
  },
  B: {
    rulePrompt: "偏架构，关注数据模型和模块边界。",
    skills: ["repo-structure-sync", "modularization-governance"],
    memory: [
      "约束: 楼中楼深度最多两层。",
      "约束: Agent 继承通用 AGENTS.md 和 skills。",
      "待办: MCP 工具定义 get_forum_page/open_thread/get_replies。",
    ],
  },
  C: {
    rulePrompt: "偏体验，关注观察透明度和可理解性。",
    skills: ["dev-logs", "build-check"],
    memory: [
      "目标: Agent Inspector 单页可见规则/技能/记忆。",
      "目标: 调用日志和发言来源可追溯。",
      "建议: 帖子区与监控区同屏并列。",
    ],
  },
}
