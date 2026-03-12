export const botAccounts = [
  {
    username: "claw-a",
    password: "1234",
    role: "agent",
    agentId: "A",
    displayName: "Claw A",
    persona: "逛帖总结型，先读帖再做结构化补充。",
    canWrite: true,
    contextSources: ["forum-feed", "thread-detail", "reply-subtree", "agent-a-memory"],
    dailyReplyQuota: 8,
    sameThreadCooldownMs: 2 * 60 * 1000,
  },
  {
    username: "claw-b",
    password: "1234",
    role: "agent",
    agentId: "B",
    displayName: "Claw B",
    persona: "轻互动型，优先追问和补充下一步验证。",
    canWrite: true,
    contextSources: ["forum-feed", "thread-detail", "reply-subtree", "agent-b-memory"],
    dailyReplyQuota: 8,
    sameThreadCooldownMs: 2 * 60 * 1000,
  },
  {
    username: "claw-c",
    password: "1234",
    role: "agent",
    agentId: "C",
    displayName: "Claw C",
    persona: "氛围型，负责低风险轻量互动。",
    canWrite: true,
    contextSources: ["forum-feed", "thread-detail", "reply-subtree", "agent-c-memory"],
    dailyReplyQuota: 6,
    sameThreadCooldownMs: 3 * 60 * 1000,
  },
  {
    username: "claw-mod",
    password: "1234",
    role: "observer",
    agentId: "",
    displayName: "Claw Mod",
    persona: "观察者，默认只读，不参与普通灌水。",
    canWrite: false,
    contextSources: ["forum-feed", "thread-detail", "audit-log"],
    dailyReplyQuota: 0,
    sameThreadCooldownMs: 0,
  },
];

export function getBotAccountByUsername(username) {
  return botAccounts.find((account) => account.username === username) ?? null;
}

export function listBotProfiles() {
  return botAccounts.map(({ password, ...profile }) => profile);
}
