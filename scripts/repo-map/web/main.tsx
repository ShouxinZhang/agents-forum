import React from 'https://esm.sh/react@18.3.1';
import { createRoot } from 'https://esm.sh/react-dom@18.3.1/client';

import { MapCanvas } from './components/MapCanvas.tsx';
import { NodeEditor } from './components/NodeEditor.tsx';
import { SqlPanel } from './components/SqlPanel.tsx';
import { Toolbar } from './components/Toolbar.tsx';
import { SOURCE_JSON, SOURCE_SQLITE } from './types.ts';

const h = React.createElement;

async function requestJson(url, options = {}) {
  const res = await fetch(url, {
    headers: {
      'content-type': 'application/json',
    },
    ...options,
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok || payload.ok === false) {
    throw new Error(payload.detail || payload.error || `Request failed: ${res.status}`);
  }
  return payload;
}

function toNodeMap(nodes) {
  const map = {};
  for (const node of nodes ?? []) {
    map[node.id] = node;
  }
  return map;
}

function toEdgeMap(edges) {
  const map = {};
  for (const edge of edges ?? []) {
    map[edge.id] = edge;
  }
  return map;
}

function toRepoNodeMap(repoNodes) {
  const map = {};
  for (const node of repoNodes ?? []) {
    map[node.path] = node;
  }
  return map;
}

function mergeObject(prev, entries, keyOf) {
  const next = { ...prev };
  for (const item of entries ?? []) {
    next[keyOf(item)] = item;
  }
  return next;
}

function App() {
  const [source, setSource] = React.useState(SOURCE_SQLITE);
  const [editable, setEditable] = React.useState(true);

  const [nodeMap, setNodeMap] = React.useState({});
  const [edgeMap, setEdgeMap] = React.useState({});
  const [repoNodeMap, setRepoNodeMap] = React.useState({});
  const [collapsedMap, setCollapsedMap] = React.useState({});
  const [expandedPaths, setExpandedPaths] = React.useState(() => new Set());
  const [childrenLoadedPaths, setChildrenLoadedPaths] = React.useState(() => new Set());
  const [fitToken, setFitToken] = React.useState(0);

  const [consistency, setConsistency] = React.useState(null);
  const [sqlTemplate, setSqlTemplate] = React.useState(null);
  const [selectedNodeId, setSelectedNodeId] = React.useState(null);

  const [loading, setLoading] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [syncing, setSyncing] = React.useState(false);
  const [message, setMessage] = React.useState('');
  const [error, setError] = React.useState('');

  const inflightChildrenRef = React.useRef(new Map());

  const selectedNode = selectedNodeId ? repoNodeMap[selectedNodeId] ?? null : null;

  const visiblePathSet = React.useMemo(() => {
    const memo = new Map();
    const isVisible = (path) => {
      if (memo.has(path)) return memo.get(path);
      const node = repoNodeMap[path];
      if (!node) {
        memo.set(path, false);
        return false;
      }
      if (node.parentPath === null) {
        memo.set(path, true);
        return true;
      }
      if (!repoNodeMap[node.parentPath]) {
        memo.set(path, false);
        return false;
      }
      const parentVisible = isVisible(node.parentPath);
      const visible = parentVisible && expandedPaths.has(node.parentPath);
      memo.set(path, visible);
      return visible;
    };

    const set = new Set();
    for (const path of Object.keys(repoNodeMap)) {
      if (isVisible(path)) set.add(path);
    }
    return set;
  }, [repoNodeMap, expandedPaths]);

  const visibleNodes = React.useMemo(() => {
    const allNodes = Object.values(nodeMap);
    return allNodes.filter((node) => visiblePathSet.has(node.id));
  }, [nodeMap, visiblePathSet]);

  const visibleEdges = React.useMemo(() => {
    const allEdges = Object.values(edgeMap);
    return allEdges.filter((edge) => visiblePathSet.has(edge.source) && visiblePathSet.has(edge.target));
  }, [edgeMap, visiblePathSet]);

  React.useEffect(() => {
    if (!selectedNodeId) return;
    if (!visiblePathSet.has(selectedNodeId)) {
      setSelectedNodeId(null);
    }
  }, [selectedNodeId, visiblePathSet]);

  const refreshConsistency = React.useCallback(async () => {
    try {
      const payload = await requestJson('/api/consistency');
      setConsistency(payload);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  const refreshSqlTemplate = React.useCallback(async () => {
    try {
      const payload = await requestJson('/api/sql-template');
      setSqlTemplate(payload);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  const loadBootstrap = React.useCallback(
    async (nextSource = source, options = {}) => {
      const fit = options.fit !== false;
      setLoading(true);
      setError('');
      try {
        const payload = await requestJson(`/api/map/bootstrap?source=${nextSource}`);
        setEditable(Boolean(payload.editable));
        setNodeMap(toNodeMap(payload.nodes ?? []));
        setEdgeMap(toEdgeMap(payload.edges ?? []));
        setRepoNodeMap(toRepoNodeMap(payload.repoNodes ?? []));
        setCollapsedMap(payload.collapsedMap ?? {});
        setExpandedPaths(new Set(payload.expandedPaths ?? []));
        setChildrenLoadedPaths(new Set(payload.roots ?? []));
        inflightChildrenRef.current.clear();
        if (fit) {
          setFitToken((prev) => prev + 1);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    },
    [source],
  );

  const ensureChildrenLoaded = React.useCallback(
    async (parentPath) => {
      if (childrenLoadedPaths.has(parentPath)) {
        return;
      }

      if (inflightChildrenRef.current.has(parentPath)) {
        await inflightChildrenRef.current.get(parentPath);
        return;
      }

      const task = requestJson(
        `/api/map/children?source=${source}&parentPath=${encodeURIComponent(parentPath)}`,
      )
        .then((payload) => {
          setNodeMap((prev) => mergeObject(prev, payload.nodes, (item) => item.id));
          setEdgeMap((prev) => mergeObject(prev, payload.edges, (item) => item.id));
          setRepoNodeMap((prev) => mergeObject(prev, payload.repoNodes, (item) => item.path));
          setCollapsedMap((prev) => ({ ...prev, ...(payload.collapsedMap ?? {}) }));
          setChildrenLoadedPaths((prev) => {
            const next = new Set(prev);
            next.add(parentPath);
            return next;
          });
        })
        .finally(() => {
          inflightChildrenRef.current.delete(parentPath);
        });

      inflightChildrenRef.current.set(parentPath, task);
      await task;
    },
    [childrenLoadedPaths, source],
  );

  React.useEffect(() => {
    loadBootstrap(source, { fit: true });
  }, [source, loadBootstrap]);

  React.useEffect(() => {
    refreshConsistency();
  }, [refreshConsistency]);

  React.useEffect(() => {
    refreshSqlTemplate();
  }, [refreshSqlTemplate]);

  const persistCollapsedState = React.useCallback(
    async (path, collapsed) => {
      if (source !== SOURCE_SQLITE) return;
      try {
        await requestJson('/api/layout', {
          method: 'PUT',
          body: JSON.stringify({
            source,
            items: [{ path, collapsed }],
          }),
        });
      } catch (err) {
        setError(err.message);
      }
    },
    [source],
  );

  const handleToggleDirectory = React.useCallback(
    async (path) => {
      const node = repoNodeMap[path];
      if (!node || node.type !== 'directory') return;

      const currentlyExpanded = expandedPaths.has(path);
      if (currentlyExpanded) {
        setExpandedPaths((prev) => {
          const next = new Set(prev);
          next.delete(path);
          return next;
        });
        setCollapsedMap((prev) => ({ ...prev, [path]: true }));
        await persistCollapsedState(path, true);
        return;
      }

      try {
        await ensureChildrenLoaded(path);
      } catch (err) {
        setError(err.message);
        return;
      }

      setExpandedPaths((prev) => {
        const next = new Set(prev);
        next.add(path);
        return next;
      });
      setCollapsedMap((prev) => ({ ...prev, [path]: false }));
      await persistCollapsedState(path, false);
    },
    [repoNodeMap, expandedPaths, ensureChildrenLoaded, persistCollapsedState],
  );

  const runMutation = async (handler, successMessage) => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const result = await handler();
      if (successMessage) {
        setMessage(successMessage);
      }
      await Promise.all([loadBootstrap(source, { fit: false }), refreshConsistency()]);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setBusy(false);
    }
  };

  const handleReload = async () => {
    await Promise.all([loadBootstrap(source, { fit: true }), refreshConsistency()]);
  };

  const handleSync = async () => {
    setSyncing(true);
    setError('');
    setMessage('');
    try {
      const payload = await requestJson('/api/sync/sqlite-to-json', { method: 'POST' });
      setMessage(`同步完成：${payload.rows} 条记录已写回 JSON`);
      await Promise.all([loadBootstrap(source, { fit: false }), refreshConsistency()]);
    } catch (err) {
      setError(err.message);
    } finally {
      setSyncing(false);
    }
  };

  const handleCreateRoot = async () => {
    if (!editable) return;
    const pathValue = window.prompt('请输入根节点 path（例如 tools/repo-map）');
    if (!pathValue) return;
    const description = window.prompt('请输入 description（可留空）') ?? '';
    const type = window.confirm('作为目录节点创建？（取消=文件）') ? 'directory' : 'file';

    await runMutation(
      () =>
        requestJson('/api/nodes', {
          method: 'POST',
          body: JSON.stringify({
            path: pathValue,
            type,
            description,
            detail: '',
            tags: [],
          }),
        }),
      '根节点创建成功',
    );
  };

  const handleSaveNode = async (patch) => {
    if (!selectedNode) return;
    const result = await runMutation(
      () =>
        requestJson(`/api/nodes/${encodeURIComponent(selectedNode.path)}`, {
          method: 'PATCH',
          body: JSON.stringify(patch),
        }),
      '节点保存成功',
    );
    if (result?.node?.path) {
      setSelectedNodeId(result.node.path);
    }
  };

  const handleDeleteNode = async (nodePath) => {
    if (!nodePath) return;
    const confirmed = window.confirm(`确认删除节点及其子树？\n${nodePath}`);
    if (!confirmed) return;
    await runMutation(
      () =>
        requestJson(`/api/nodes/${encodeURIComponent(nodePath)}?cascade=true`, {
          method: 'DELETE',
        }),
      '节点删除成功',
    );
    if (selectedNodeId === nodePath || selectedNodeId?.startsWith(`${nodePath}/`)) {
      setSelectedNodeId(null);
    }
  };

  const handleCreateChild = async (payload) => {
    const result = await runMutation(
      () =>
        requestJson('/api/nodes', {
          method: 'POST',
          body: JSON.stringify(payload),
        }),
      '子节点创建成功',
    );
    if (result?.node?.path) {
      const parentPath = result.node.parent_path ?? null;
      if (parentPath) {
        setExpandedPaths((prev) => {
          const next = new Set(prev);
          next.add(parentPath);
          return next;
        });
      }
      setSelectedNodeId(result.node.path);
    }
  };

  const handleLayoutChange = async (item) => {
    if (!editable) return;
    try {
      await requestJson('/api/layout', {
        method: 'PUT',
        body: JSON.stringify({ source, items: [item] }),
      });
    } catch (err) {
      setError(err.message);
    }
  };

  const expandedDepth = React.useMemo(() => {
    if (expandedPaths.size === 0) return 0;
    let maxDepth = 0;
    for (const path of expandedPaths) {
      const depth = String(path).split('/').length;
      if (depth > maxDepth) maxDepth = depth;
    }
    return maxDepth;
  }, [expandedPaths]);

  return h(
    'main',
    { className: 'app-shell' },
    h(Toolbar, {
      source,
      editable,
      consistency,
      busy: loading || busy,
      syncing,
      expandedCount: expandedPaths.size,
      expandedDepth,
      onSourceChange: (next) => {
        setSource(next === SOURCE_JSON ? SOURCE_JSON : SOURCE_SQLITE);
        setSelectedNodeId(null);
      },
      onReload: handleReload,
      onSync: handleSync,
      onCreateRoot: handleCreateRoot,
    }),
    message ? h('div', { className: 'flash success' }, message) : null,
    error ? h('div', { className: 'flash error' }, error) : null,
    h(
      'div',
      { className: 'main-grid' },
      h(MapCanvas, {
        nodes: visibleNodes,
        edges: visibleEdges,
        selectedNodeId,
        editable,
        expandedPaths,
        fitToken,
        onNodeSelect: setSelectedNodeId,
        onToggleDirectory: handleToggleDirectory,
        onNodeLayoutChange: handleLayoutChange,
      }),
      h(
        'div',
        { className: 'side-column' },
        h(NodeEditor, {
          selectedNode,
          editable,
          busy,
          onSave: handleSaveNode,
          onDelete: handleDeleteNode,
          onCreateChild: handleCreateChild,
        }),
        h(SqlPanel, { sqlTemplate }),
      ),
    ),
  );
}

createRoot(document.getElementById('app')).render(h(App));
