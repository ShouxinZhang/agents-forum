# 11 Codex Context Export Skill

- Timestamp: 2026-03-13 23:04:49 CST
- User Prompt:
  - `我想知道CodeX如何管理对话上下文的？比如说如果我想将本次上下文完整复制，可以如何做？`
  - `此外就是，auto compact的上下文机制又是如何运作的？`
  - `subagent skill`
  - `哦哦，做一个CodeX导出的SKILL, 我觉得就是说，嗯，一个是原始的完整上下文，就是，虽然codex压缩了，但是那只是在它的工作记忆里压缩过，我们本地还是可以看到从头到尾的完整记忆`
  - `然后就是你说的handoff + 关键文件 + 命令 + 输出产物`
  - `YES`

## Files

- `.agents/skills/codex-context-export/SKILL.md`
- `.agents/skills/codex-context-export/references/format.md`
- `.agents/skills/codex-context-export/scripts/export_context.mjs`

## Changes

- Added a new local skill `codex-context-export` for exporting Codex work context.
- Split export into two layers:
  - `raw`: locally visible Codex traces such as session index, selected session transcript, filtered history, and optional subagent run directories.
  - `handoff`: structured continuation summary with goals, completed work, next steps, risks, key files, commands, and artifacts.
- Implemented `export_context.mjs` with support for:
  - `--latest`
  - `--session-id`
  - `--thread-name`
  - repeated `--completed`, `--next`, `--risk`, `--key-file`, `--command`, `--artifact`
  - `--subagent-run-dir latest`
- Tightened `--latest` selection to prefer the latest session whose persisted transcript `cwd` matches the current workspace.
- Made the export explicit about a key boundary: it exports locally visible traces, not hidden in-memory compacted state that may not be persisted on disk.

## Verification

- `node --check .agents/skills/codex-context-export/scripts/export_context.mjs`
- `node .agents/skills/codex-context-export/scripts/export_context.mjs --latest --goal "Export the current Codex session for continuation and backup." --completed "Investigated Codex local session storage." --completed "Created codex-context-export skill and raw/handoff exporter." --next "Reuse the exported handoff in a new Codex thread when needed." --risk "Hidden in-memory compaction state may not be fully visible on disk." --key-file .agents/skills/codex-context-export/SKILL.md --key-file .agents/skills/codex-context-export/scripts/export_context.mjs --command "node .agents/skills/codex-context-export/scripts/export_context.mjs --latest" --subagent-run-dir latest`
  - Output: `.agent_cache/codex-context-export/2026-03-13T15-07-04.671Z-019ce1a7-a1c9-77c2-a1d9-ab38305db313-invalid-jso/`
  - Result: `ok=true`, transcript found, handoff generated, subagent run copied
