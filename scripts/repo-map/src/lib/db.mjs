import fs from 'node:fs/promises';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const DEFAULT_DB_RELATIVE_PATH = path.join('docs', 'architecture', 'repo-metadata.sqlite');

export function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      args[key] = 'true';
    } else {
      args[key] = next;
      i += 1;
    }
  }
  return args;
}

export function resolveRepoRoot(args = {}) {
  const raw = args['repo-root'] ?? process.env.REPO_ROOT ?? process.env.INIT_CWD ?? process.cwd();
  return path.resolve(raw);
}

export function resolveSqlitePath(repoRoot, args = {}) {
  const raw =
    args['db-path'] ??
    process.env.REPO_METADATA_DB_PATH ??
    process.env.SQLITE_PATH ??
    DEFAULT_DB_RELATIVE_PATH;
  if (path.isAbsolute(raw)) return raw;
  return path.resolve(repoRoot, raw);
}

export function resolveServerHost(args = {}) {
  return args.host ?? process.env.HOST ?? '127.0.0.1';
}

export function resolveServerPort(args = {}) {
  const raw = args.port ?? process.env.PORT ?? '4180';
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 4180;
  }
  return parsed;
}

export async function openDatabase(dbPath) {
  await fs.mkdir(path.dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec('pragma foreign_keys = on;');
  ensureNodesTableSchema(db);
  ensureLayoutTable(db);
  return db;
}

export function ensureNodesTableSchema(db) {
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

export function ensureLayoutTable(db) {
  db.exec(`
    create table if not exists repo_metadata_layout (
      path       text primary key references repo_metadata_nodes(path) on delete cascade,
      x          real not null default 0,
      y          real not null default 0,
      collapsed  integer not null default 0,
      updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );

    create index if not exists idx_repo_metadata_layout_updated
      on repo_metadata_layout(updated_at);
  `);
}

export function nowIso() {
  return new Date().toISOString();
}

export function serializeTags(tags) {
  if (!Array.isArray(tags)) return '[]';
  return JSON.stringify([...new Set(tags.map((item) => String(item).trim()).filter(Boolean))]);
}

export function deserializeTags(raw) {
  if (!raw || typeof raw !== 'string') return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return [...new Set(parsed.map((item) => String(item).trim()).filter(Boolean))];
  } catch {
    return [];
  }
}

export function normalizeTags(tags) {
  if (!Array.isArray(tags)) return [];
  return [...new Set(tags.map((item) => String(item).trim()).filter(Boolean))];
}

export function normalizePath(rawPath) {
  if (typeof rawPath !== 'string') {
    throw new Error('path 必须是字符串');
  }

  const normalized = rawPath.trim().replaceAll('\\', '/').replace(/^\/+|\/+$/g, '');

  if (!normalized) {
    throw new Error('path 不能为空');
  }

  if (normalized.includes('//')) {
    throw new Error('path 不能包含连续斜杠');
  }

  const segments = normalized.split('/');
  for (const seg of segments) {
    if (!seg || seg === '.' || seg === '..') {
      throw new Error(`非法路径片段: ${seg || '(empty)'}`);
    }
  }

  return normalized;
}

export function parentPathOf(nodePath) {
  const normalized = normalizePath(nodePath);
  const idx = normalized.lastIndexOf('/');
  if (idx < 0) return null;
  return normalized.slice(0, idx);
}

export function baseNameOf(nodePath) {
  const normalized = normalizePath(nodePath);
  const idx = normalized.lastIndexOf('/');
  if (idx < 0) return normalized;
  return normalized.slice(idx + 1);
}

export function joinPath(parentPath, baseName) {
  const name = normalizePath(baseName).split('/').at(-1);
  if (!parentPath) return name;
  return `${normalizePath(parentPath)}/${name}`;
}

export function isDescendantPath(pathValue, ancestorPath) {
  const p = normalizePath(pathValue);
  const ancestor = normalizePath(ancestorPath);
  return p === ancestor || p.startsWith(`${ancestor}/`);
}

export function depthOfPath(nodePath) {
  return normalizePath(nodePath).split('/').length;
}
