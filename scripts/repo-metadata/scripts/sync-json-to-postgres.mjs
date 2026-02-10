#!/usr/bin/env node
/**
 * sync-json-to-postgres.mjs — 兼容入口（已迁移至 SQLite）
 *
 * 新用法:
 *   REPO_METADATA_DB_PATH='docs/architecture/repo-metadata.sqlite' node sync-json-to-sqlite.mjs
 */
console.warn('⚠️ 该脚本已迁移到 SQLite，正在转发到 sync-json-to-sqlite.mjs');
await import('./sync-json-to-sqlite.mjs');
