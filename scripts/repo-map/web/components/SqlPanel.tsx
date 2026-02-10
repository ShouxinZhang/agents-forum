import React from 'https://esm.sh/react@18.3.1';

const h = React.createElement;

async function copyText(text) {
  if (!navigator?.clipboard) return false;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function SqlBlock({ title, sql }) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    const ok = await copyText(sql);
    setCopied(ok);
    setTimeout(() => setCopied(false), 1000);
  };

  return h(
    'div',
    { className: 'sql-block' },
    h(
      'div',
      { className: 'sql-block-head' },
      h('h3', null, title),
      h(
        'button',
        {
          type: 'button',
          onClick: handleCopy,
        },
        copied ? '已复制' : '复制 SQL',
      ),
    ),
    h('textarea', { readOnly: true, rows: 10, value: sql || '' }),
  );
}

export function SqlPanel({ sqlTemplate }) {
  return h(
    'section',
    { className: 'sql-panel' },
    h('h2', null, 'SQL 模板'),
    h('p', { className: 'hint' }, '下方 SQL 可直接用于 SQLite 查询与结构核对。'),
    h(SqlBlock, {
      title: '递归树查询（WITH RECURSIVE）',
      sql: sqlTemplate?.recursiveTree ?? '',
    }),
    h(SqlBlock, {
      title: '结构基线查询',
      sql: sqlTemplate?.structureBaseline ?? '',
    }),
  );
}
