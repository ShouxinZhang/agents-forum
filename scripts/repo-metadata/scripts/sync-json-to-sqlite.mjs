#!/usr/bin/env node
/**
 * sync-json-to-sqlite.mjs — 将 repo-metadata.json 推送到 SQLite
 *
 * 用法:
 *   REPO_METADATA_DB_PATH='docs/architecture/repo-metadata.sqlite' node sync-json-to-sqlite.mjs
 *
 * 行为: 以 JSON 为 source of truth，全量 upsert 到 SQLite
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ensureRepoMetadataSchema,
  openSqliteDb,
  resolveSqlitePath,
  serializeTags,
} from '../lib/sqlite.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '../../../');
const metadataPath = path.join(repoRoot, 'docs', 'architecture', 'repo-metadata.json');
const sqlitePath = resolveSqlitePath(repoRoot);

function parentPathOf(p) {
  const parent = path.dirname(p);
  return parent === '.' ? null : parent;
}

async function main() {
  const content = await fs.readFile(metadataPath, 'utf8');
  const metadata = JSON.parse(content);
  const entries = Object.entries(metadata.nodes ?? {});

  if (entries.length === 0) {
    console.log('ℹ repo-metadata.json 为空，无数据可同步。');
    return;
  }

  const db = await openSqliteDb(sqlitePath);

  try {
    ensureRepoMetadataSchema(db);
    db.exec('begin immediate;');

    const sorted = entries.sort(([a], [b]) => {
      const da = a.split('/').length;
      const dbDepth = b.split('/').length;
      return da - dbDepth || a.localeCompare(b);
    });

    const upsertStmt = db.prepare(`
      insert into repo_metadata_nodes
        (path, type, description, detail, tags, parent_path, sort_order, updated_by, updated_at)
      values
        (@path, @type, @description, @detail, @tags, @parent_path, @sort_order, @updated_by, @updated_at)
      on conflict (path) do update set
        type = excluded.type,
        description = excluded.description,
        detail = excluded.detail,
        tags = excluded.tags,
        parent_path = excluded.parent_path,
        sort_order = excluded.sort_order,
        updated_by = excluded.updated_by,
        updated_at = excluded.updated_at
    `);

    const now = new Date().toISOString();
    let upserted = 0;
    for (const [nodePath, node] of sorted) {
      upsertStmt.run({
        path: nodePath,
        type: node.type,
        description: node.description || null,
        detail: node.detail || null,
        tags: serializeTags(node.tags),
        parent_path: parentPathOf(nodePath),
        sort_order: node.sortOrder ?? 0,
        updated_by: node.updatedBy ?? 'scan',
        updated_at: node.updatedAt ?? now,
      });
      upserted += 1;
    }

    const pathSet = new Set(entries.map(([nodePath]) => nodePath));
    const dbRows = db.prepare('select path from repo_metadata_nodes').all();
    const deleteStmt = db.prepare('delete from repo_metadata_nodes where path = ?');
    let deleted = 0;
    for (const row of dbRows) {
      if (!pathSet.has(row.path)) {
        deleteStmt.run(row.path);
        deleted += 1;
      }
    }

    db.exec('commit;');
    console.log(`✅ JSON → SQLite 同步完成: upsert ${upserted}, 删除 ${deleted}`);
    console.log(`📦 SQLite 文件: ${sqlitePath}`);
  } catch (err) {
    db.exec('rollback;');
    throw err;
  } finally {
    db.close();
  }
}

main().catch((err) => {
  console.error(`❌ 同步失败: ${err.message}`);
  process.exitCode = 1;
});
