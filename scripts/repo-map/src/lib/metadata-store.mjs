import fs from 'node:fs/promises';
import path from 'node:path';

import {
  baseNameOf,
  depthOfPath,
  deserializeTags,
  isDescendantPath,
  joinPath,
  normalizePath,
  normalizeTags,
  nowIso,
  parentPathOf,
  serializeTags,
} from './db.mjs';

const DEFAULT_METADATA_RELATIVE_PATH = path.join('docs', 'architecture', 'repo-metadata.json');

function getMetadataPath(repoRoot) {
  return path.join(repoRoot, DEFAULT_METADATA_RELATIVE_PATH);
}

function beginTx(db) {
  db.exec('begin immediate;');
}

function commitTx(db) {
  db.exec('commit;');
}

function rollbackTx(db) {
  try {
    db.exec('rollback;');
  } catch {
    // ignore rollback failure
  }
}

function getNodeByPath(db, nodePath) {
  return db
    .prepare(`
      select path, type, description, detail, tags, parent_path, sort_order, updated_by, updated_at
      from repo_metadata_nodes
      where path = ?
    `)
    .get(nodePath);
}

function rowToRepoNode(row) {
  return {
    path: row.path,
    type: row.type,
    description: row.description ?? '',
    detail: row.detail ?? '',
    tags: deserializeTags(row.tags),
    parentPath: row.parent_path ?? null,
    sortOrder: row.sort_order ?? 0,
    updatedBy: row.updated_by ?? 'scan',
    updatedAt: row.updated_at ?? nowIso(),
  };
}

export function loadSqliteRepoNodes(db) {
  const rows = db
    .prepare(`
      select path, type, description, detail, tags, parent_path, sort_order, updated_by, updated_at
      from repo_metadata_nodes
      order by path
    `)
    .all();

  return rows.map(rowToRepoNode);
}

export async function loadJsonRepoNodes(repoRoot) {
  const metadataPath = getMetadataPath(repoRoot);
  const content = await fs.readFile(metadataPath, 'utf8');
  const metadata = JSON.parse(content);
  const nodes = metadata.nodes ?? {};
  return Object.entries(nodes)
    .map(([nodePath, node]) => ({
      path: normalizePath(nodePath),
      type: node.type,
      description: node.description ?? '',
      detail: node.detail ?? '',
      tags: normalizeTags(node.tags ?? []),
      parentPath: parentPathOf(nodePath),
      sortOrder: node.sortOrder ?? 0,
      updatedBy: node.updatedBy ?? 'scan',
      updatedAt: node.updatedAt ?? nowIso(),
    }))
    .sort((a, b) => a.path.localeCompare(b.path));
}

export function loadLayoutRows(db) {
  return db
    .prepare(`
      select path, x, y, collapsed, updated_at
      from repo_metadata_layout
      order by path
    `)
    .all()
    .map((row) => ({
      path: row.path,
      x: Number(row.x ?? 0),
      y: Number(row.y ?? 0),
      collapsed: Boolean(row.collapsed),
      updatedAt: row.updated_at ?? nowIso(),
    }));
}

function loadLayoutRowsByPaths(db, paths) {
  if (!Array.isArray(paths) || paths.length === 0) return [];
  const placeholders = paths.map(() => '?').join(', ');
  const rows = db
    .prepare(`
      select path, x, y, collapsed, updated_at
      from repo_metadata_layout
      where path in (${placeholders})
      order by path
    `)
    .all(...paths);
  return rows.map((row) => ({
    path: row.path,
    x: Number(row.x ?? 0),
    y: Number(row.y ?? 0),
    collapsed: Boolean(row.collapsed),
    updatedAt: row.updated_at ?? nowIso(),
  }));
}

function buildNodeTooltip(node, source) {
  return [
    `path: ${node.path}`,
    `type: ${node.type}`,
    `parent: ${node.parentPath ?? '(root)'}`,
    `description: ${node.description || '(empty)'}`,
    `detail: ${node.detail || '(empty)'}`,
    `tags: ${node.tags.join(', ') || '(empty)'}`,
    `updatedAt: ${node.updatedAt}`,
    `source: ${source}`,
  ].join('\n');
}

function buildFallbackPositions(repoNodes) {
  const byParent = new Map();
  for (const node of repoNodes) {
    const key = node.parentPath ?? '__root__';
    const list = byParent.get(key) ?? [];
    list.push(node);
    byParent.set(key, list);
  }
  for (const list of byParent.values()) {
    list.sort((a, b) => a.path.localeCompare(b.path));
  }

  const positions = new Map();
  let rowCursor = 0;

  function walk(parentPath, depth) {
    const key = parentPath ?? '__root__';
    const children = byParent.get(key) ?? [];
    for (const child of children) {
      positions.set(child.path, { x: depth * 320, y: rowCursor * 110 });
      rowCursor += 1;
      walk(child.path, depth + 1);
    }
  }

  walk(null, 0);
  return positions;
}

export function buildMapPayload({ source, repoNodes, layoutRows }) {
  const layoutMap = new Map(layoutRows.map((item) => [item.path, item]));
  const fallback = buildFallbackPositions(repoNodes);

  const nodes = repoNodes.map((node) => {
    const stored = layoutMap.get(node.path);
    const fallbackPos = fallback.get(node.path) ?? { x: 0, y: 0 };
    return {
      id: node.path,
      type: 'repoNode',
      position: {
        x: stored?.x ?? fallbackPos.x,
        y: stored?.y ?? fallbackPos.y,
      },
      data: {
        ...node,
        source,
        isDirectory: node.type === 'directory',
        tooltip: buildNodeTooltip(node, source),
      },
    };
  });

  const edges = repoNodes
    .filter((node) => Boolean(node.parentPath))
    .map((node) => ({
      id: `e:${node.parentPath}:${node.path}`,
      source: node.parentPath,
      target: node.path,
      animated: false,
      type: 'smoothstep',
    }));

  return {
    source,
    editable: source === 'sqlite',
    nodes,
    edges,
    repoNodes,
    layoutNodes: layoutRows,
  };
}

function loadSqliteRootNodes(db) {
  const rows = db
    .prepare(`
      select path, type, description, detail, tags, parent_path, sort_order, updated_by, updated_at
      from repo_metadata_nodes
      where parent_path is null
      order by path
    `)
    .all();
  return rows.map(rowToRepoNode);
}

function loadSqliteDirectChildren(db, parentPath) {
  const rows = db
    .prepare(`
      select path, type, description, detail, tags, parent_path, sort_order, updated_by, updated_at
      from repo_metadata_nodes
      where parent_path = ?
      order by path
    `)
    .all(parentPath);
  return rows.map(rowToRepoNode);
}

function loadSqliteDirectChildrenByParents(db, parentPaths) {
  if (!Array.isArray(parentPaths) || parentPaths.length === 0) return [];
  const placeholders = parentPaths.map(() => '?').join(', ');
  const rows = db
    .prepare(`
      select path, type, description, detail, tags, parent_path, sort_order, updated_by, updated_at
      from repo_metadata_nodes
      where parent_path in (${placeholders})
      order by parent_path, path
    `)
    .all(...parentPaths);
  return rows.map(rowToRepoNode);
}

function pickRootAndChildren(allNodes) {
  const roots = allNodes.filter((node) => node.parentPath === null).sort((a, b) => a.path.localeCompare(b.path));
  const rootPaths = new Set(roots.map((node) => node.path));
  const children = allNodes
    .filter((node) => node.parentPath && rootPaths.has(node.parentPath))
    .sort((a, b) => a.path.localeCompare(b.path));
  return { roots, children };
}

function toFlowNodes(source, repoNodes, layoutRows) {
  const layoutMap = new Map(layoutRows.map((item) => [item.path, item]));
  const fallback = buildFallbackPositions(repoNodes);

  return repoNodes.map((node) => {
    const stored = layoutMap.get(node.path);
    const fallbackPos = fallback.get(node.path) ?? { x: 0, y: 0 };
    return {
      id: node.path,
      type: 'repoNode',
      position: {
        x: stored?.x ?? fallbackPos.x,
        y: stored?.y ?? fallbackPos.y,
      },
      data: {
        ...node,
        source,
        isDirectory: node.type === 'directory',
        tooltip: buildNodeTooltip(node, source),
      },
    };
  });
}

function toFlowEdges(repoNodes) {
  return repoNodes
    .filter((node) => Boolean(node.parentPath))
    .map((node) => ({
      id: `e:${node.parentPath}:${node.path}`,
      source: node.parentPath,
      target: node.path,
      animated: false,
      type: 'smoothstep',
    }));
}

function buildCollapsedMap(repoNodes, layoutRows) {
  const layoutMap = new Map(layoutRows.map((item) => [item.path, item]));
  const collapsedMap = {};
  for (const node of repoNodes) {
    if (layoutMap.has(node.path)) {
      collapsedMap[node.path] = Boolean(layoutMap.get(node.path).collapsed);
      continue;
    }
    collapsedMap[node.path] = node.parentPath !== null;
  }
  return collapsedMap;
}

function buildExpandedPaths(roots, collapsedMap) {
  return roots.filter((node) => !collapsedMap[node.path]).map((node) => node.path);
}

export async function buildBootstrapPayload({ source, db, repoRoot }) {
  let roots = [];
  let children = [];
  if (source === 'json') {
    const allNodes = await loadJsonRepoNodes(repoRoot);
    const picked = pickRootAndChildren(allNodes);
    roots = picked.roots;
    children = picked.children;
  } else {
    roots = loadSqliteRootNodes(db);
    children = loadSqliteDirectChildrenByParents(
      db,
      roots.map((node) => node.path),
    );
  }

  const repoNodes = [...roots, ...children];
  const layoutRows = loadLayoutRowsByPaths(db, repoNodes.map((node) => node.path));
  const collapsedMap = buildCollapsedMap(repoNodes, layoutRows);
  const expandedPaths = buildExpandedPaths(roots, collapsedMap);

  return {
    source,
    editable: source === 'sqlite',
    nodes: toFlowNodes(source, repoNodes, layoutRows),
    edges: toFlowEdges(repoNodes),
    repoNodes,
    layoutNodes: layoutRows,
    roots: roots.map((node) => node.path),
    expandedPaths,
    collapsedMap,
  };
}

export async function buildDirectChildrenPayload({ source, db, repoRoot, parentPath }) {
  const normalizedParentPath = normalizePath(parentPath);
  const repoNodes =
    source === 'json'
      ? (await loadJsonRepoNodes(repoRoot)).filter((node) => node.parentPath === normalizedParentPath)
      : loadSqliteDirectChildren(db, normalizedParentPath);
  const layoutRows = loadLayoutRowsByPaths(db, repoNodes.map((node) => node.path));
  const collapsedMap = buildCollapsedMap(repoNodes, layoutRows);

  return {
    source,
    parentPath: normalizedParentPath,
    nodes: toFlowNodes(source, repoNodes, layoutRows),
    edges: toFlowEdges(repoNodes),
    repoNodes,
    layoutNodes: layoutRows,
    collapsedMap,
  };
}

function ensureParentExists(db, parentPath, knownPaths = new Set()) {
  if (!parentPath) return;
  if (knownPaths.has(parentPath)) return;
  const parent = getNodeByPath(db, parentPath);
  if (!parent) {
    throw new Error(`parent_path 不存在: ${parentPath}`);
  }
}

export function createNode(db, payload) {
  const nodePath = normalizePath(payload.path);
  const expectedParent = parentPathOf(nodePath);
  if ('parentPath' in payload) {
    const explicitParent = payload.parentPath ? normalizePath(payload.parentPath) : null;
    if (explicitParent !== expectedParent) {
      throw new Error(`parent_path 与 path 不一致: ${explicitParent ?? '(root)'} != ${expectedParent ?? '(root)'}`);
    }
  }

  ensureParentExists(db, expectedParent);

  const existing = getNodeByPath(db, nodePath);
  if (existing) {
    throw new Error(`路径已存在: ${nodePath}`);
  }

  const now = nowIso();
  const type = payload.type === 'directory' ? 'directory' : 'file';
  const description = payload.description ?? '';
  const detail = payload.detail ?? '';
  const tags = normalizeTags(payload.tags ?? []);
  const sortOrder = Number.isFinite(payload.sortOrder) ? Number(payload.sortOrder) : 0;

  beginTx(db);
  try {
    db.prepare(`
      insert into repo_metadata_nodes
      (path, type, description, detail, tags, parent_path, sort_order, updated_by, updated_at)
      values (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      nodePath,
      type,
      description,
      detail,
      serializeTags(tags),
      expectedParent,
      sortOrder,
      'human',
      now,
    );

    if (Number.isFinite(payload.x) && Number.isFinite(payload.y)) {
      db.prepare(`
        insert into repo_metadata_layout (path, x, y, collapsed, updated_at)
        values (?, ?, ?, ?, ?)
        on conflict(path) do update set
          x = excluded.x,
          y = excluded.y,
          collapsed = excluded.collapsed,
          updated_at = excluded.updated_at
      `).run(nodePath, Number(payload.x), Number(payload.y), payload.collapsed ? 1 : 0, now);
    }

    commitTx(db);
  } catch (err) {
    rollbackTx(db);
    throw err;
  }

  return getNodeByPath(db, nodePath);
}

function resolveTargetPath(currentPath, patch) {
  const normalizedCurrent = normalizePath(currentPath);
  const hasPath = typeof patch.path === 'string' && patch.path.trim().length > 0;
  const hasParent = Object.prototype.hasOwnProperty.call(patch, 'parentPath');

  if (hasPath && hasParent) {
    const explicitPath = normalizePath(patch.path);
    const explicitParent = patch.parentPath ? normalizePath(patch.parentPath) : null;
    if (parentPathOf(explicitPath) !== explicitParent) {
      throw new Error('patch.path 与 patch.parentPath 不一致');
    }
    return explicitPath;
  }

  if (hasPath) {
    return normalizePath(patch.path);
  }

  if (hasParent) {
    const newParent = patch.parentPath ? normalizePath(patch.parentPath) : null;
    return joinPath(newParent, baseNameOf(normalizedCurrent));
  }

  return normalizedCurrent;
}

function getSubtreeRows(db, rootPath) {
  return db
    .prepare(`
      select path, type, description, detail, tags, parent_path, sort_order, updated_by, created_at, updated_at
      from repo_metadata_nodes
      where path = ? or path like ?
      order by length(path) asc, path asc
    `)
    .all(rootPath, `${rootPath}/%`);
}

function getLayoutRowsForSubtree(db, rootPath) {
  return db
    .prepare(`
      select path, x, y, collapsed, updated_at
      from repo_metadata_layout
      where path = ? or path like ?
      order by length(path) asc, path asc
    `)
    .all(rootPath, `${rootPath}/%`);
}

function ensureNoCollision(db, mappedPaths, oldPaths) {
  const checkStmt = db.prepare('select path from repo_metadata_nodes where path = ?');
  for (const mappedPath of mappedPaths) {
    const existing = checkStmt.get(mappedPath);
    if (existing && !oldPaths.has(mappedPath)) {
      throw new Error(`目标路径已存在: ${mappedPath}`);
    }
  }
}

export function updateNode(db, currentPath, patch) {
  const oldPath = normalizePath(currentPath);
  const current = getNodeByPath(db, oldPath);
  if (!current) {
    throw new Error(`路径不存在: ${oldPath}`);
  }

  const nextPath = resolveTargetPath(oldPath, patch);
  const nextParentPath = parentPathOf(nextPath);

  if (nextPath !== oldPath && isDescendantPath(nextPath, oldPath)) {
    throw new Error('不能将节点移动到其子孙路径下');
  }
  if (nextParentPath && isDescendantPath(nextParentPath, oldPath)) {
    throw new Error('不能将节点的父路径设置为其子孙节点');
  }

  const hasPathChange = nextPath !== oldPath;
  const now = nowIso();

  if (!hasPathChange) {
    ensureParentExists(db, nextParentPath);
    beginTx(db);
    try {
      const type = patch.type ?? current.type;
      const description = patch.description ?? current.description ?? '';
      const detail = patch.detail ?? current.detail ?? '';
      const tags = Object.prototype.hasOwnProperty.call(patch, 'tags')
        ? normalizeTags(patch.tags ?? [])
        : deserializeTags(current.tags);
      const sortOrder = Number.isFinite(patch.sortOrder) ? Number(patch.sortOrder) : current.sort_order ?? 0;

      db.prepare(`
        update repo_metadata_nodes
        set type = ?,
            description = ?,
            detail = ?,
            tags = ?,
            parent_path = ?,
            sort_order = ?,
            updated_by = ?,
            updated_at = ?
        where path = ?
      `).run(
        type,
        description,
        detail,
        serializeTags(tags),
        nextParentPath,
        sortOrder,
        'human',
        now,
        oldPath,
      );
      commitTx(db);
    } catch (err) {
      rollbackTx(db);
      throw err;
    }

    return getNodeByPath(db, nextPath);
  }

  const subtreeRows = getSubtreeRows(db, oldPath);
  const oldPaths = new Set(subtreeRows.map((row) => row.path));
  const mapPath = (p) => (p === oldPath ? nextPath : `${nextPath}${p.slice(oldPath.length)}`);
  const mappedPaths = subtreeRows.map((row) => mapPath(row.path));

  ensureParentExists(db, nextParentPath, oldPaths);
  ensureNoCollision(db, mappedPaths, oldPaths);

  const layoutRows = getLayoutRowsForSubtree(db, oldPath);

  beginTx(db);
  try {
    const insertNode = db.prepare(`
      insert into repo_metadata_nodes
      (path, type, description, detail, tags, parent_path, sort_order, updated_by, created_at, updated_at)
      values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const row of subtreeRows) {
      const mappedPath = mapPath(row.path);
      const mappedParent = row.path === oldPath ? nextParentPath : mapPath(parentPathOf(row.path));

      const isRoot = row.path === oldPath;
      const type = isRoot ? patch.type ?? row.type : row.type;
      const description = isRoot ? patch.description ?? row.description ?? '' : row.description ?? '';
      const detail = isRoot ? patch.detail ?? row.detail ?? '' : row.detail ?? '';
      const tags = isRoot
        ? Object.prototype.hasOwnProperty.call(patch, 'tags')
          ? normalizeTags(patch.tags ?? [])
          : deserializeTags(row.tags)
        : deserializeTags(row.tags);
      const sortOrder = isRoot
        ? Number.isFinite(patch.sortOrder)
          ? Number(patch.sortOrder)
          : row.sort_order ?? 0
        : row.sort_order ?? 0;

      insertNode.run(
        mappedPath,
        type,
        description,
        detail,
        serializeTags(tags),
        mappedParent,
        sortOrder,
        'human',
        row.created_at ?? now,
        now,
      );
    }

    const upsertLayout = db.prepare(`
      insert into repo_metadata_layout (path, x, y, collapsed, updated_at)
      values (?, ?, ?, ?, ?)
      on conflict(path) do update set
        x = excluded.x,
        y = excluded.y,
        collapsed = excluded.collapsed,
        updated_at = excluded.updated_at
    `);
    const mapLayoutPath = (p) => (p === oldPath ? nextPath : `${nextPath}${p.slice(oldPath.length)}`);
    for (const row of layoutRows) {
      upsertLayout.run(mapLayoutPath(row.path), Number(row.x ?? 0), Number(row.y ?? 0), row.collapsed ? 1 : 0, now);
    }

    db.prepare(`delete from repo_metadata_nodes where path = ?`).run(oldPath);
    commitTx(db);
  } catch (err) {
    rollbackTx(db);
    throw err;
  }

  return getNodeByPath(db, nextPath);
}

export function deleteNode(db, nodePath, cascade = true) {
  const normalizedPath = normalizePath(nodePath);
  const existing = getNodeByPath(db, normalizedPath);
  if (!existing) {
    throw new Error(`路径不存在: ${normalizedPath}`);
  }

  if (!cascade) {
    const child = db.prepare(`select path from repo_metadata_nodes where parent_path = ? limit 1`).get(normalizedPath);
    if (child) {
      throw new Error('节点存在子节点，请使用 cascade=true');
    }
  }

  beginTx(db);
  try {
    db.prepare(`delete from repo_metadata_nodes where path = ?`).run(normalizedPath);
    commitTx(db);
  } catch (err) {
    rollbackTx(db);
    throw err;
  }

  return { deletedPath: normalizedPath };
}

export function saveLayout(db, items) {
  if (!Array.isArray(items)) {
    throw new Error('items 必须为数组');
  }

  const now = nowIso();
  const upsert = db.prepare(`
    insert into repo_metadata_layout (path, x, y, collapsed, updated_at)
    values (?, ?, ?, ?, ?)
    on conflict(path) do update set
      x = excluded.x,
      y = excluded.y,
      collapsed = excluded.collapsed,
      updated_at = excluded.updated_at
  `);

  beginTx(db);
  try {
    const selectExisting = db.prepare(`
      select x, y, collapsed
      from repo_metadata_layout
      where path = ?
    `);

    let saved = 0;
    for (const item of items) {
      const nodePath = normalizePath(item.path);
      const existing = selectExisting.get(nodePath);
      const nextX = Number.isFinite(item.x) ? Number(item.x) : Number(existing?.x ?? 0);
      const nextY = Number.isFinite(item.y) ? Number(item.y) : Number(existing?.y ?? 0);
      const nextCollapsed = Object.prototype.hasOwnProperty.call(item, 'collapsed')
        ? Boolean(item.collapsed)
        : Boolean(existing?.collapsed ?? false);
      upsert.run(
        nodePath,
        nextX,
        nextY,
        nextCollapsed ? 1 : 0,
        now,
      );
      saved += 1;
    }
    commitTx(db);
    return { saved };
  } catch (err) {
    rollbackTx(db);
    throw err;
  }
}

export function saveCollapsedState(db, nodePath, collapsed) {
  const normalizedPath = normalizePath(nodePath);
  return saveLayout(db, [
    {
      path: normalizedPath,
      collapsed: Boolean(collapsed),
    },
  ]);
}

async function loadExistingConfig(repoRoot) {
  const metadataPath = getMetadataPath(repoRoot);
  try {
    const content = await fs.readFile(metadataPath, 'utf8');
    const metadata = JSON.parse(content);
    return metadata.config ?? {};
  } catch {
    return {
      scanIgnore: ['docs/dev_logs/**', 'docs/private_context/**'],
      generateMdDepth: 2,
    };
  }
}

export async function syncSqliteToJson(repoRoot, db) {
  const rows = db
    .prepare(`
      select path, type, description, detail, tags, sort_order, updated_by, updated_at
      from repo_metadata_nodes
      order by path
    `)
    .all();

  if (rows.length === 0) {
    throw new Error('SQLite 表为空，无数据可同步。');
  }

  const nodes = {};
  for (const row of rows) {
    nodes[row.path] = {
      type: row.type,
      description: row.description ?? '',
      detail: row.detail ?? '',
      tags: deserializeTags(row.tags),
      sortOrder: row.sort_order ?? 0,
      updatedBy: row.updated_by ?? 'scan',
      updatedAt: row.updated_at ?? nowIso(),
    };
  }

  const metadata = {
    version: 1,
    config: await loadExistingConfig(repoRoot),
    updatedAt: nowIso(),
    nodes,
  };

  const metadataPath = getMetadataPath(repoRoot);
  await fs.mkdir(path.dirname(metadataPath), { recursive: true });
  await fs.writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`, 'utf8');

  return {
    metadataPath,
    rows: rows.length,
  };
}

export async function bootstrapSqliteFromJsonIfEmpty(repoRoot, db) {
  const countRow = db.prepare(`select count(*) as count from repo_metadata_nodes`).get();
  const currentCount = Number(countRow?.count ?? 0);
  if (currentCount > 0) {
    return { bootstrapped: false, rows: currentCount };
  }

  let jsonNodes;
  try {
    jsonNodes = await loadJsonRepoNodes(repoRoot);
  } catch {
    return { bootstrapped: false, rows: 0 };
  }

  if (jsonNodes.length === 0) {
    return { bootstrapped: false, rows: 0 };
  }

  const now = nowIso();
  beginTx(db);
  try {
    const insertNode = db.prepare(`
      insert into repo_metadata_nodes
      (path, type, description, detail, tags, parent_path, sort_order, updated_by, updated_at)
      values (?, ?, ?, ?, ?, ?, ?, ?, ?)
      on conflict(path) do update set
        type = excluded.type,
        description = excluded.description,
        detail = excluded.detail,
        tags = excluded.tags,
        parent_path = excluded.parent_path,
        sort_order = excluded.sort_order,
        updated_by = excluded.updated_by,
        updated_at = excluded.updated_at
    `);

    const sorted = [...jsonNodes].sort((a, b) => {
      return depthOfPath(a.path) - depthOfPath(b.path) || a.path.localeCompare(b.path);
    });

    for (const node of sorted) {
      insertNode.run(
        node.path,
        node.type ?? 'file',
        node.description ?? '',
        node.detail ?? '',
        serializeTags(node.tags ?? []),
        node.parentPath ?? parentPathOf(node.path),
        node.sortOrder ?? 0,
        node.updatedBy ?? 'bootstrap',
        node.updatedAt ?? now,
      );
    }
    commitTx(db);
  } catch (err) {
    rollbackTx(db);
    throw err;
  }

  return { bootstrapped: true, rows: jsonNodes.length };
}

export function getSqlTemplates() {
  return {
    recursiveTree: `
with recursive tree as (
  select
    path,
    type,
    parent_path,
    description,
    detail,
    tags,
    0 as depth
  from repo_metadata_nodes
  where parent_path is null

  union all

  select
    child.path,
    child.type,
    child.parent_path,
    child.description,
    child.detail,
    child.tags,
    tree.depth + 1 as depth
  from repo_metadata_nodes child
  join tree on child.parent_path = tree.path
)
select path, type, parent_path, depth, description, detail, tags
from tree
order by depth, path;
    `.trim(),
    structureBaseline: `
select
  path,
  parent_path,
  case
    when parent_path is null then 'root'
    when instr(path, '/') = 0 then 'root-child'
    else substr(path, 1, length(path) - length(substr(path, instr(path, '/') + 1)) - 1)
  end as derived_parent_hint
from repo_metadata_nodes
order by path;
    `.trim(),
  };
}

export function normalizeNodeForComparison(node) {
  return {
    path: normalizePath(node.path),
    parentPath: node.parentPath ? normalizePath(node.parentPath) : null,
    type: node.type ?? 'file',
    description: node.description ?? '',
    detail: node.detail ?? '',
    tags: normalizeTags(node.tags ?? []).sort(),
  };
}

export function subtreeDepth(pathValue, rootPath) {
  if (!isDescendantPath(pathValue, rootPath)) return -1;
  return depthOfPath(pathValue) - depthOfPath(rootPath);
}
