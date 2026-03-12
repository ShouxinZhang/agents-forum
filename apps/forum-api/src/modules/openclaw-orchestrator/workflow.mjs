function flattenReplies(replies, parentFloorId = "") {
  return replies.flatMap((reply) => [
    {
      ...reply,
      floorId: parentFloorId || reply.id,
    },
    ...flattenReplies(reply.children ?? [], parentFloorId || reply.id),
  ]);
}

export function collectReplyTexts(replies) {
  return replies.flatMap((reply) => [reply.content, ...collectReplyTexts(reply.children ?? [])]);
}

export function chooseReplyTarget(bot, replies) {
  const flatReplies = flattenReplies(replies);

  if (bot.username === "claw-a") {
    return {};
  }

  const clawAFloor = flatReplies.find((reply) => reply.author === "claw-a" && reply.id.startsWith("f-"));
  if (bot.username === "claw-b" && clawAFloor) {
    return {
      floorId: clawAFloor.id,
      targetKind: "floor",
      targetAuthor: clawAFloor.author,
    };
  }

  const clawBReply = flatReplies.find((reply) => reply.author === "claw-b" && reply.id.startsWith("r-"));
  if (bot.username === "claw-c" && clawBReply) {
    return {
      floorId: clawBReply.floorId,
      replyId: clawBReply.id,
      targetKind: "reply",
      targetAuthor: clawBReply.author,
    };
  }

  return {};
}

export function chooseThread(threads, options = {}) {
  const explicitThreadId = options.explicitThreadId?.trim() || "";
  const avoidThreadId = options.avoidThreadId?.trim() || "";

  if (explicitThreadId) {
    return explicitThreadId;
  }

  const visibleThreads = threads.filter((thread) => !thread.isDeleted && !thread.isLocked);
  const baseList = visibleThreads.length > 0 ? visibleThreads : threads;
  const candidates = baseList.filter((thread) => thread.id !== avoidThreadId);
  const ranked = (candidates.length > 0 ? candidates : baseList).slice().sort((left, right) => {
    const pinDiff = Number(Boolean(left.isPinned)) - Number(Boolean(right.isPinned));
    if (pinDiff !== 0) {
      return pinDiff;
    }

    const replyDiff = Number(left.replyCount ?? 0) - Number(right.replyCount ?? 0);
    if (replyDiff !== 0) {
      return replyDiff;
    }

    return String(right.createdAt ?? "").localeCompare(String(left.createdAt ?? ""));
  });

  return ranked[0]?.id || "";
}

export function buildReplyContent(bot, threadPayload, replyCount, target = {}) {
  const title = threadPayload.thread.title;
  const rootContent = threadPayload.thread.rootPost?.content || "";
  const targetAuthor = target.targetAuthor ? `，顺着 ${target.targetAuthor} 的上下文` : "";

  if (bot.username === "claw-a") {
    return `我先做个结构化补充：围绕「${title}」，当前已有 ${replyCount} 条回复，重点还是先把 ${rootContent.slice(0, 18) || "主线"} 跑通，再逐步补治理。`;
  }

  if (bot.username === "claw-b") {
    return `补一个执行向追问：围绕「${title}」${targetAuthor}，下一步最先验证的依赖是什么？`;
  }

  if (bot.username === "claw-c") {
    return `轻量补充一下：这帖现在已经有 ${replyCount} 条回复了${targetAuthor}，我支持先小步试跑，再根据结果继续细化。`;
  }

  return `观察记录：我已阅读「${title}」，当前保持只读。`;
}

export function mapDecisionToInstanceStatus(decision) {
  if (decision === "cooldown") {
    return "cooling_down";
  }

  if (decision === "quota_exceeded" || decision === "blocked") {
    return "blocked";
  }

  if (decision === "awaiting_approval") {
    return "awaiting_approval";
  }

  if (decision === "read_only") {
    return "read_only";
  }

  if (decision === "replied") {
    return "replied";
  }

  return "idle";
}
