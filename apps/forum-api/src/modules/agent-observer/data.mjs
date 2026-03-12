import { listAgentRecentCalls } from "./runtime-events.mjs";

const agentProfileSeeds = {
  A: {
    rulePrompt: "偏执行，先搭可运行最小版本，再补强。",
    inheritedFrom: "通用 AGENTS.md + 通用 skills",
    skills: ["local-dev-workflow", "build-check", "dev-logs"],
    memory: [
      {
        id: "mem-a-1",
        text: "观察: 用户优先需要论坛界面可操作。",
        source: "dev-log",
        timestamp: "2026-03-12 01:00",
      },
      {
        id: "mem-a-2",
        text: "决策: 先做 React + Tailwind + shadcn/ui。",
        source: "implementation",
        timestamp: "2026-03-12 01:05",
      },
      {
        id: "mem-a-3",
        text: "风险: 没有后端时仅能 mock 登录与帖子数据。",
        source: "risk-note",
        timestamp: "2026-03-12 01:06",
      },
    ],
  },
  B: {
    rulePrompt: "偏架构，关注数据模型和模块边界。",
    inheritedFrom: "通用 AGENTS.md + 通用 skills",
    skills: ["repo-structure-sync", "modularization-governance"],
    memory: [
      {
        id: "mem-b-1",
        text: "约束: 楼中楼深度最多两层。",
        source: "domain-rule",
        timestamp: "2026-03-12 01:08",
      },
      {
        id: "mem-b-2",
        text: "约束: Agent 继承通用 AGENTS.md 和 skills。",
        source: "repo-policy",
        timestamp: "2026-03-12 01:09",
      },
      {
        id: "mem-b-3",
        text: "待办: MCP 工具定义 get_forum_page/open_thread/get_replies。",
        source: "roadmap",
        timestamp: "2026-03-12 01:10",
      },
    ],
  },
  C: {
    rulePrompt: "偏体验，关注观察透明度和可理解性。",
    inheritedFrom: "通用 AGENTS.md + 通用 skills",
    skills: ["dev-logs", "build-check"],
    memory: [
      {
        id: "mem-c-1",
        text: "目标: Agent Inspector 单页可见规则/技能/记忆。",
        source: "ux-goal",
        timestamp: "2026-03-12 01:12",
      },
      {
        id: "mem-c-2",
        text: "目标: 调用日志和发言来源可追溯。",
        source: "ux-goal",
        timestamp: "2026-03-12 01:13",
      },
      {
        id: "mem-c-3",
        text: "建议: 帖子区与监控区同屏并列。",
        source: "ux-note",
        timestamp: "2026-03-12 01:14",
      },
    ],
  },
};

export function buildAgentProfiles() {
  return Object.fromEntries(
    Object.entries(agentProfileSeeds).map(([agentId, profile]) => [
      agentId,
      {
        ...profile,
        recentCalls: listAgentRecentCalls(agentId),
      },
    ])
  );
}

export function getAgentProfile(agentId) {
  return buildAgentProfiles()[agentId] ?? null;
}
