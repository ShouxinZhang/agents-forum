import React from 'https://esm.sh/react@18.3.1';

const h = React.createElement;

function statusText(consistency) {
  if (!consistency) return '一致性检查中...';
  if (consistency.status === 'ok') return 'SQLite 与 JSON 一致';
  return `发现不一致: SQLite缺失 ${consistency.missingInSqliteCount} / JSON缺失 ${consistency.missingInJsonCount} / 字段差异 ${consistency.fieldMismatchCount}`;
}

export function Toolbar({
  source,
  editable,
  consistency,
  busy,
  syncing,
  expandedCount,
  expandedDepth,
  onSourceChange,
  onReload,
  onSync,
  onCreateRoot,
}) {
  const warn = consistency && consistency.status !== 'ok';

  return h(
    'header',
    { className: 'toolbar' },
    h(
      'div',
      { className: 'toolbar-left' },
      h('h1', { className: 'toolbar-title' }, 'Repo Metadata Mind Map'),
      h('p', { className: 'toolbar-subtitle' }, '左到右结构图 + 节点悬浮信息 + SQLite/JSON 对照'),
    ),
    h(
      'div',
      { className: 'toolbar-actions' },
      h(
        'div',
        { className: 'segmented' },
        h(
          'button',
          {
            type: 'button',
            className: source === 'sqlite' ? 'segmented-active' : '',
            onClick: () => onSourceChange('sqlite'),
          },
          'SQLite',
        ),
        h(
          'button',
          {
            type: 'button',
            className: source === 'json' ? 'segmented-active' : '',
            onClick: () => onSourceChange('json'),
          },
          'JSON (只读)',
        ),
      ),
      h(
        'button',
        {
          type: 'button',
          disabled: busy,
          onClick: onReload,
        },
        busy ? '刷新中...' : '刷新',
      ),
      h(
        'button',
        {
          type: 'button',
          disabled: syncing,
          onClick: onSync,
        },
        syncing ? '同步中...' : '同步 SQLite -> JSON',
      ),
      h(
        'button',
        {
          type: 'button',
          disabled: !editable,
          onClick: onCreateRoot,
        },
        '新增根节点',
      ),
    ),
    h(
      'div',
      {
        className: warn ? 'consistency-banner warn' : 'consistency-banner ok',
        title: warn
          ? JSON.stringify(
              {
                missingInJson: consistency?.missingInJson?.slice(0, 10),
                missingInSqlite: consistency?.missingInSqlite?.slice(0, 10),
                fieldMismatches: consistency?.fieldMismatches?.slice(0, 10),
              },
              null,
              2,
            )
          : '一致',
      },
      statusText(consistency),
    ),
    h(
      'div',
      { className: 'expand-stats' },
      `已展开目录: ${expandedCount ?? 0} | 当前最大层级: ${expandedDepth ?? 0}`,
    ),
  );
}
