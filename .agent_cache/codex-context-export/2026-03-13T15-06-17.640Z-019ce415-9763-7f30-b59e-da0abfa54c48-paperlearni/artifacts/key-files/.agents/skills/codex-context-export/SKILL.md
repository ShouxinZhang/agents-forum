---
name: codex-context-export
description: Export locally visible Codex context for handoff or backup. Use when the user wants to copy the current Codex conversation, preserve raw session traces, export a structured handoff, or bundle subagent run artifacts.
---

# Codex Context Export

Use this skill when the user wants a reusable export of Codex work context.

The skill produces two layers:

- `raw`
  - Best-effort local-visible Codex records such as the selected session transcript, session index entry, filtered user history, and optional subagent run artifacts.
- `handoff`
  - A structured markdown summary for a new thread or another agent: goals, completed work, pending work, key files, commands, artifacts, and risks.

## Important scope boundary

This skill exports **locally visible traces**, not hidden in-memory compaction state.

That means:

- It can usually export the full on-disk transcript for a selected Codex session.
- It can export related index/history files and subagent artifacts.
- It cannot guarantee access to every hidden internal working-memory summary used by Codex during auto-compact.

State this clearly if the user asks for a "full internal memory dump".

## Files

- Script: `scripts/export_context.mjs`
- Format reference: `references/format.md`

Read the format reference only if you need to explain the output layout or customize exported sections.

## Default workflow

1. Choose the session target.
   - Prefer `--latest` unless the user gave a session id or a thread name.
2. Export both `raw` and `handoff`.
3. If the user mentions subagents, include one or more `--subagent-run-dir` values.
4. If the user cares about reproducibility, include key files, commands, and artifact paths.
5. Verify the output directory exists and summarize what was exported.

## Commands

Export the latest visible Codex session:

```bash
node .agents/skills/codex-context-export/scripts/export_context.mjs --latest
```

Export by session id:

```bash
node .agents/skills/codex-context-export/scripts/export_context.mjs \
  --session-id 019ce415-9763-7f30-b59e-da0abfa54c48
```

Export by thread name substring:

```bash
node .agents/skills/codex-context-export/scripts/export_context.mjs \
  --thread-name "agents forum"
```

Export with a structured handoff:

```bash
node .agents/skills/codex-context-export/scripts/export_context.mjs \
  --latest \
  --goal "Continue the MVP forum bot stabilization work." \
  --completed "Natural-language read path is connected." \
  --completed "Approval write path is connected." \
  --next "Tighten reply quality and context transparency." \
  --key-file apps/forum-api/src/modules/openclaw-orchestrator/service.mjs \
  --command "bash scripts/check_errors.sh" \
  --artifact docs/dev_logs/2026-03-13/10-openclaw-product-write-approval-hit.md
```

Include the latest subagent run:

```bash
node .agents/skills/codex-context-export/scripts/export_context.mjs \
  --latest \
  --subagent-run-dir latest
```

## Output

By default the script writes to:

```text
.agent_cache/codex-context-export/<timestamp>-<session-or-thread>/
```

It generates:

- `manifest.json`
- `handoff.md`
- `raw/`
- `artifacts/` when extra files or subagent runs are included

After export, report:

- selected session id / thread name
- output directory
- what raw records were found
- any missing pieces, especially if the active session transcript was not available on disk
