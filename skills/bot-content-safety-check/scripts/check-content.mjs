#!/usr/bin/env node

import { pathToFileURL } from "node:url";

const defaults = {
  minLength: 16,
  maxLength: 280,
  similarityContainsLength: 80,
  blockedPhrases: ["引流", "私信我", "加vx", "加v", "刷屏", "赌博", "色情"],
  fillerPhrases: ["顶一下", "支持", "同意", "学习了", "路过", "再看看"],
};

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[，。！？、,.!?;:：；"'`~()[\]{}]/g, "");
}

function safeArray(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
}

function containsBlockedPhrase(content) {
  return defaults.blockedPhrases.find((phrase) => content.includes(phrase)) || "";
}

function buildComparisonSet(input) {
  const values = [];

  if (typeof input.rootContent === "string" && input.rootContent.trim()) {
    values.push(input.rootContent.trim());
  }

  values.push(...safeArray(input.existingReplies).map((item) => item.trim()).filter(Boolean));
  return values;
}

function hasDuplicate(candidateNormalized, existingValues) {
  return existingValues.some((existing) => normalizeText(existing) === candidateNormalized);
}

function hasContainedMatch(candidateNormalized, existingValues) {
  return existingValues.some((existing) => {
    const normalized = normalizeText(existing);
    if (!normalized || normalized === candidateNormalized) {
      return false;
    }

    const isContained =
      normalized.includes(candidateNormalized) || candidateNormalized.includes(normalized);

    return isContained && Math.max(normalized.length, candidateNormalized.length) <= defaults.similarityContainsLength;
  });
}

export function evaluateReplyCandidate(input) {
  const content = String(input?.content || "").trim();
  const normalizedContent = normalizeText(content);
  const checks = [];
  const reasons = [];
  let riskScore = 0;

  const hasOpenedThread = Boolean(input?.hasOpenedThread);
  const hasReadReplies = Boolean(input?.hasReadReplies);

  checks.push({
    name: "opened_thread",
    ok: hasOpenedThread,
    detail: hasOpenedThread ? "thread detail loaded" : "thread detail not loaded",
  });
  checks.push({
    name: "read_replies",
    ok: hasReadReplies,
    detail: hasReadReplies ? "replies loaded" : "replies not loaded",
  });

  if (!hasOpenedThread) {
    reasons.push("必须先打开帖子详情");
    riskScore += 40;
  }

  if (!hasReadReplies) {
    reasons.push("必须先读取 replies");
    riskScore += 40;
  }

  checks.push({
    name: "content_present",
    ok: content.length > 0,
    detail: `length=${content.length}`,
  });

  if (!content) {
    reasons.push("回复内容不能为空");
    riskScore += 100;
  }

  if (content.length > 0 && content.length < defaults.minLength) {
    reasons.push(`回复过短，至少需要 ${defaults.minLength} 个字符`);
    riskScore += 35;
  }

  if (content.length > defaults.maxLength) {
    reasons.push(`回复过长，最多允许 ${defaults.maxLength} 个字符`);
    riskScore += 20;
  }

  const blockedPhrase = containsBlockedPhrase(content);
  checks.push({
    name: "blocked_phrases",
    ok: !blockedPhrase,
    detail: blockedPhrase ? `matched=${blockedPhrase}` : "no blocked phrase",
  });

  if (blockedPhrase) {
    reasons.push(`命中敏感词或黑名单短语: ${blockedPhrase}`);
    riskScore += 100;
  }

  const comparisonSet = buildComparisonSet(input);
  const duplicated = normalizedContent ? hasDuplicate(normalizedContent, comparisonSet) : false;
  const containedMatch = normalizedContent
    ? hasContainedMatch(normalizedContent, comparisonSet)
    : false;

  checks.push({
    name: "duplicate_check",
    ok: !duplicated,
    detail: duplicated ? "exact duplicate detected" : "no exact duplicate",
  });
  checks.push({
    name: "containment_check",
    ok: !containedMatch,
    detail: containedMatch ? "high-overlap short message detected" : "no high-overlap short message",
  });

  if (duplicated) {
    reasons.push("与已有内容重复");
    riskScore += 80;
  }

  if (containedMatch) {
    reasons.push("与现有讨论高度重复");
    riskScore += 45;
  }

  const fillerHits = defaults.fillerPhrases.filter((phrase) => content.includes(phrase));
  checks.push({
    name: "filler_phrases",
    ok: fillerHits.length === 0,
    detail: fillerHits.length === 0 ? "no filler phrase" : `matched=${fillerHits.join(",")}`,
  });

  if (fillerHits.length > 0 && content.length <= 28) {
    reasons.push("回复过于空泛，存在灌水风险");
    riskScore += 30;
  }

  const decision = reasons.length === 0 ? "allow" : "reject";

  return {
    ok: decision === "allow",
    decision,
    actor: String(input?.actor || "").trim() || "unknown",
    threadTitle: String(input?.threadTitle || "").trim(),
    replyCount: Number.isFinite(input?.replyCount) ? Number(input.replyCount) : 0,
    reasons,
    riskScore,
    checks,
  };
}

function printHelp() {
  console.log(`Usage:
  node skills/bot-content-safety-check/scripts/check-content.mjs --self-test
  printf '%s\\n' '<json>' | node skills/bot-content-safety-check/scripts/check-content.mjs`);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function readStdinJson() {
  if (process.stdin.isTTY) {
    return null;
  }

  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }

  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) {
    return null;
  }

  return JSON.parse(raw);
}

function runSelfTest() {
  const allowed = evaluateReplyCandidate({
    actor: "claw-a",
    content: "我补一个执行建议：先把读写链路和审计跑通，再继续扩展治理。",
    threadTitle: "论坛接入",
    rootContent: "先把核心链路跑通",
    existingReplies: ["可以先做最小版本"],
    hasOpenedThread: true,
    hasReadReplies: true,
    replyCount: 2,
  });
  assert(allowed.ok, "expected allowed candidate to pass");

  const rejected = evaluateReplyCandidate({
    actor: "claw-c",
    content: "支持",
    threadTitle: "论坛接入",
    rootContent: "先把核心链路跑通",
    existingReplies: ["支持"],
    hasOpenedThread: false,
    hasReadReplies: false,
    replyCount: 1,
  });
  assert(!rejected.ok, "expected rejected candidate to fail");
  assert(
    rejected.reasons.some((item) => item.includes("详情")) &&
      rejected.reasons.some((item) => item.includes("重复")),
    "expected self-test rejection reasons to include detail-read and duplicate"
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        mode: "self-test",
        checks: [allowed, rejected],
      },
      null,
      2
    )
  );
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes("-h") || args.includes("--help")) {
    printHelp();
    return;
  }

  if (args.includes("--self-test")) {
    runSelfTest();
    return;
  }

  const payload = await readStdinJson();
  if (!payload) {
    printHelp();
    process.exit(1);
  }

  const result = evaluateReplyCandidate(payload);
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.ok ? 0 : 1);
}

function isDirectExecution() {
  if (!process.argv[1]) {
    return false;
  }

  return import.meta.url === pathToFileURL(process.argv[1]).href;
}

if (isDirectExecution()) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.stack ?? error.message : String(error));
    process.exit(1);
  });
}
