import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { serve } from '@hono/node-server';
import { Hono } from 'hono';

import { compareNodeSets } from './lib/consistency-check.mjs';
import {
  parseArgs,
  resolveRepoRoot,
  resolveServerHost,
  resolveServerPort,
  resolveSqlitePath,
  openDatabase,
} from './lib/db.mjs';
import {
  bootstrapSqliteFromJsonIfEmpty,
  buildBootstrapPayload,
  buildDirectChildrenPayload,
  buildMapPayload,
  createNode,
  deleteNode,
  getSqlTemplates,
  loadJsonRepoNodes,
  loadLayoutRows,
  loadSqliteRepoNodes,
  saveLayout,
  syncSqliteToJson,
  updateNode,
} from './lib/metadata-store.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const toolRoot = path.resolve(scriptDir, '..');
const webRoot = path.join(toolRoot, 'web');

const args = parseArgs(process.argv.slice(2));
const repoRoot = resolveRepoRoot(args);
const dbPath = resolveSqlitePath(repoRoot, args);
const host = resolveServerHost(args);
const port = resolveServerPort(args);
const db = await openDatabase(dbPath);
const bootstrap = await bootstrapSqliteFromJsonIfEmpty(repoRoot, db);

const app = new Hono();

function jsonError(c, status, message, detail) {
  return c.json(
    {
      ok: false,
      error: message,
      detail: detail ?? null,
    },
    status,
  );
}

function decodeNodePathFromRequest(c) {
  const prefix = '/api/nodes/';
  const rawPath = c.req.path.startsWith(prefix) ? c.req.path.slice(prefix.length) : '';
  if (!rawPath) {
    throw new Error('缺少节点路径');
  }
  return decodeURIComponent(rawPath);
}

function mimeOf(filePath) {
  if (filePath.endsWith('.html')) return 'text/html; charset=utf-8';
  if (filePath.endsWith('.tsx') || filePath.endsWith('.ts') || filePath.endsWith('.js')) {
    return 'application/javascript; charset=utf-8';
  }
  if (filePath.endsWith('.css')) return 'text/css; charset=utf-8';
  if (filePath.endsWith('.json')) return 'application/json; charset=utf-8';
  if (filePath.endsWith('.svg')) return 'image/svg+xml';
  return 'text/plain; charset=utf-8';
}

async function serveWebFile(c, relativePath) {
  const normalized = relativePath.replace(/^\/+/, '');
  const absPath = path.resolve(webRoot, normalized);
  if (!absPath.startsWith(webRoot)) {
    return jsonError(c, 403, '禁止访问该路径');
  }
  try {
    const content = await fs.readFile(absPath);
    return new Response(content, {
      status: 200,
      headers: {
        'content-type': mimeOf(absPath),
        'cache-control': 'no-store',
      },
    });
  } catch {
    return jsonError(c, 404, '资源不存在');
  }
}

app.get('/api/health', (c) =>
  c.json({
    ok: true,
    service: 'repo-map',
    host,
    port,
    repoRoot,
    dbPath,
  }),
);

app.get('/api/map', async (c) => {
  try {
    const source = c.req.query('source') === 'json' ? 'json' : 'sqlite';
    const repoNodes = source === 'json' ? await loadJsonRepoNodes(repoRoot) : loadSqliteRepoNodes(db);
    const layoutRows = loadLayoutRows(db);
    return c.json({
      ok: true,
      ...buildMapPayload({ source, repoNodes, layoutRows }),
    });
  } catch (err) {
    return jsonError(c, 500, '加载导图失败', err.message);
  }
});

app.get('/api/map/bootstrap', async (c) => {
  try {
    const source = c.req.query('source') === 'json' ? 'json' : 'sqlite';
    const payload = await buildBootstrapPayload({ source, db, repoRoot });
    return c.json({ ok: true, ...payload });
  } catch (err) {
    return jsonError(c, 500, '加载分层导图失败', err.message);
  }
});

app.get('/api/map/children', async (c) => {
  try {
    const source = c.req.query('source') === 'json' ? 'json' : 'sqlite';
    const parentPath = c.req.query('parentPath');
    if (!parentPath) {
      return jsonError(c, 400, '缺少 parentPath 参数');
    }
    const payload = await buildDirectChildrenPayload({ source, db, repoRoot, parentPath });
    return c.json({ ok: true, ...payload });
  } catch (err) {
    return jsonError(c, 400, '加载子节点失败', err.message);
  }
});

app.get('/api/consistency', async (c) => {
  try {
    const sqliteNodes = loadSqliteRepoNodes(db);
    const jsonNodes = await loadJsonRepoNodes(repoRoot);
    const report = compareNodeSets(sqliteNodes, jsonNodes);
    return c.json({ ok: true, ...report });
  } catch (err) {
    return jsonError(c, 500, '一致性检查失败', err.message);
  }
});

app.post('/api/nodes', async (c) => {
  try {
    const payload = await c.req.json();
    const row = createNode(db, payload);
    return c.json({ ok: true, node: row });
  } catch (err) {
    return jsonError(c, 400, '创建节点失败', err.message);
  }
});

app.patch('/api/nodes/*', async (c) => {
  try {
    const nodePath = decodeNodePathFromRequest(c);
    const payload = await c.req.json();
    const row = updateNode(db, nodePath, payload);
    return c.json({ ok: true, node: row });
  } catch (err) {
    return jsonError(c, 400, '更新节点失败', err.message);
  }
});

app.delete('/api/nodes/*', (c) => {
  try {
    const nodePath = decodeNodePathFromRequest(c);
    const cascadeQuery = c.req.query('cascade');
    const cascade = cascadeQuery === undefined ? true : cascadeQuery !== 'false';
    const result = deleteNode(db, nodePath, cascade);
    return c.json({ ok: true, ...result });
  } catch (err) {
    return jsonError(c, 400, '删除节点失败', err.message);
  }
});

app.put('/api/layout', async (c) => {
  try {
    const payload = await c.req.json();
    const source = payload.source === 'json' ? 'json' : 'sqlite';
    if (source === 'json') {
      return jsonError(c, 400, 'JSON 模式只读，禁止写入布局/折叠状态');
    }
    const result = saveLayout(db, payload.items ?? []);
    return c.json({ ok: true, ...result });
  } catch (err) {
    return jsonError(c, 400, '保存布局失败', err.message);
  }
});

app.post('/api/sync/sqlite-to-json', async (c) => {
  try {
    const result = await syncSqliteToJson(repoRoot, db);
    return c.json({ ok: true, ...result });
  } catch (err) {
    return jsonError(c, 500, '同步失败', err.message);
  }
});

app.get('/api/sql-template', (c) =>
  c.json({
    ok: true,
    ...getSqlTemplates(),
  }),
);

app.get('/', (c) => serveWebFile(c, 'index.html'));
app.get('/web/*', (c) => serveWebFile(c, c.req.path.slice('/web/'.length)));
app.notFound((c) => jsonError(c, 404, 'Not Found'));

serve(
  {
    fetch: app.fetch,
    hostname: host,
    port,
  },
  () => {
    console.log(`[repo-map] listening on http://${host}:${port}`);
    console.log(`[repo-map] repoRoot=${repoRoot}`);
    console.log(`[repo-map] dbPath=${dbPath}`);
    if (bootstrap.bootstrapped) {
      console.log(`[repo-map] bootstrap: imported ${bootstrap.rows} nodes from repo-metadata.json`);
    }
  },
);
