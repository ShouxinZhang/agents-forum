import React from 'https://esm.sh/react@18.3.1';
import {
  Background,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  useNodesState,
} from 'https://esm.sh/@xyflow/react@12.8.6?deps=react@18.3.1,react-dom@18.3.1';

const h = React.createElement;

function RepoNode({ data, selected }) {
  const isDirectory = Boolean(data.isDirectory);
  const expanded = Boolean(data.expanded);

  const handleToggle = (evt) => {
    evt.preventDefault();
    evt.stopPropagation();
    if (isDirectory && data.onToggle) {
      data.onToggle(data.path);
    }
  };

  return h(
    'div',
    {
      className: selected ? 'repo-node selected' : 'repo-node',
      title: data.tooltip,
    },
    h(Handle, { type: 'target', position: Position.Left, style: { opacity: 0.45 } }),
    h(
      'div',
      { className: 'repo-node-head' },
      isDirectory
        ? h(
            'button',
            {
              type: 'button',
              className: expanded ? 'tree-toggle expanded' : 'tree-toggle collapsed',
              onClick: handleToggle,
              title: expanded ? '折叠目录' : '展开目录',
            },
            expanded ? '▾' : '▸',
          )
        : null,
      h('span', { className: 'repo-node-type' }, data.type === 'directory' ? 'DIR' : 'FILE'),
      h('span', { className: 'repo-node-path' }, data.path),
    ),
    h('div', { className: 'repo-node-desc' }, data.description || '(no description)'),
    h(Handle, { type: 'source', position: Position.Right, style: { opacity: 0.45 } }),
  );
}

const nodeTypes = {
  repoNode: RepoNode,
};

export function MapCanvas({
  nodes,
  edges,
  selectedNodeId,
  editable,
  expandedPaths,
  fitToken,
  onNodeSelect,
  onToggleDirectory,
  onNodeLayoutChange,
}) {
  const [flowNodes, setFlowNodes, onNodesChange] = useNodesState(nodes);
  const flowInstanceRef = React.useRef(null);
  const fittedTokenRef = React.useRef(null);

  React.useEffect(() => {
    setFlowNodes(
      nodes.map((node) => ({
        ...node,
        selected: node.id === selectedNodeId,
        draggable: Boolean(editable),
        data: {
          ...node.data,
          expanded: expandedPaths?.has(node.id) ?? false,
          onToggle: onToggleDirectory,
        },
      })),
    );
  }, [nodes, selectedNodeId, editable, expandedPaths, onToggleDirectory, setFlowNodes]);

  React.useEffect(() => {
    if (!fitToken) return;
    if (fittedTokenRef.current === fitToken) return;
    fittedTokenRef.current = fitToken;
    if (!flowInstanceRef.current) return;
    setTimeout(() => {
      flowInstanceRef.current.fitView({ padding: 0.16, duration: 320 });
    }, 0);
  }, [fitToken]);

  return h(
    'section',
    { className: 'map-canvas' },
    h(ReactFlow, {
      nodes: flowNodes,
      edges,
      nodeTypes,
      onNodesChange,
      fitView: false,
      minZoom: 0.2,
      maxZoom: 2.2,
      proOptions: { hideAttribution: true },
      onInit: (instance) => {
        flowInstanceRef.current = instance;
      },
      onNodeClick: (_evt, node) => onNodeSelect?.(node.id),
      onPaneClick: () => onNodeSelect?.(null),
      onNodeDragStop: (_evt, node) =>
        onNodeLayoutChange?.({
          path: node.id,
          x: node.position.x,
          y: node.position.y,
          collapsed: false,
        }),
    }, h(Background, { gap: 18, size: 1 }), h(Controls), h(MiniMap, { pannable: true, zoomable: true })),
  );
}
