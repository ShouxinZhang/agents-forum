# Output Format

The export directory is organized like this:

```text
.agent_cache/codex-context-export/<timestamp>-<slug>/
├── manifest.json
├── handoff.md
├── raw/
│   ├── session-index.full.jsonl
│   ├── session-index.entry.json
│   ├── history.filtered.jsonl
│   ├── selected-session.jsonl
│   ├── archived-session.jsonl
│   └── notes.txt
└── artifacts/
    ├── key-files/
    ├── outputs/
    └── subagents/
```

## `manifest.json`

Machine-readable export metadata:

- export timestamp
- selected session id and thread name
- source file paths
- copied artifact paths
- missing records

## `handoff.md`

Human-readable continuation package:

- session summary
- current goal
- completed work
- pending / next items
- risks
- key files
- commands
- artifacts

## `raw/`

Best-effort local-visible traces:

- full session index copy
- selected session index entry
- filtered user history for that session id
- selected live transcript from `~/.codex/sessions/**`
- matching archived transcript from `~/.codex/archived_sessions/` if found

## `artifacts/`

Optional copied files:

- key files
- explicit output artifacts
- subagent run directories

The export is intended to be robust for handoff, not to claim perfect access to Codex internal hidden compaction state.
