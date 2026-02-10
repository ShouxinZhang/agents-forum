import fs from 'node:fs/promises';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const DEFAULT_DB_RELATIVE_PATH = path.join('docs', 'architecture', 'repo-metadata.sqlite');

export function resolveSqlitePath(repoRoot) {
  const envPath = process.env.REPO_METADATA_DB_PATH ?? process.env.SQLITE_PATH ?? '';
  if (!envPath) {
    return path.join(repoRoot, DEFAULT_DB_RELATIVE_PATH);
  }
  if (path.isAbsolute(envPath)) {
    return envPath;
  }
  return path.resolve(repoRoot, envPath);
}

export async function openSqliteDb(dbPath) {
  await fs.mkdir(path.dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec('pragma foreign_keys = on;');
  return db;
}

export function ensureRepoMetadataSchema(db) {
  db.exec(`
    create table if not exists repo_metadata_nodes (
      path         text primary key,
      type         text not null check (type in ('directory', 'file')),
      description  text,
      detail       text,
      tags         text not null default '[]',
      parent_path  text references repo_metadata_nodes(path) on delete cascade,
      sort_order   integer not null default 0,
      updated_by   text not null default 'scan',
      created_at   text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      updated_at   text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );

    create index if not exists idx_repo_metadata_nodes_parent
      on repo_metadata_nodes(parent_path, sort_order, path);
  `);
}

export function serializeTags(tags) {
  if (!Array.isArray(tags)) return '[]';
  return JSON.stringify(tags);
}

export function deserializeTags(raw) {
  if (typeof raw !== 'string' || raw.length === 0) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => String(item));
  } catch {
    return [];
  }
}
