import { normalizeTags, parentPathOf } from './db.mjs';

function canonicalizeNode(node) {
  return {
    path: node.path,
    parentPath: node.parentPath ?? parentPathOf(node.path),
    type: node.type ?? 'file',
    description: node.description ?? '',
    detail: node.detail ?? '',
    tags: normalizeTags(node.tags ?? []).sort(),
  };
}

export function compareNodeSets(sqliteNodes, jsonNodes) {
  const sqliteMap = new Map(sqliteNodes.map((node) => [node.path, canonicalizeNode(node)]));
  const jsonMap = new Map(jsonNodes.map((node) => [node.path, canonicalizeNode(node)]));

  const missingInJson = [];
  const missingInSqlite = [];
  const fieldMismatches = [];

  const paths = new Set([...sqliteMap.keys(), ...jsonMap.keys()]);
  for (const path of [...paths].sort((a, b) => a.localeCompare(b))) {
    const sqliteNode = sqliteMap.get(path);
    const jsonNode = jsonMap.get(path);

    if (sqliteNode && !jsonNode) {
      missingInJson.push(path);
      continue;
    }
    if (!sqliteNode && jsonNode) {
      missingInSqlite.push(path);
      continue;
    }

    const pairs = [
      ['parentPath', sqliteNode.parentPath ?? null, jsonNode.parentPath ?? null],
      ['type', sqliteNode.type, jsonNode.type],
      ['description', sqliteNode.description, jsonNode.description],
      ['detail', sqliteNode.detail, jsonNode.detail],
      ['tags', JSON.stringify(sqliteNode.tags), JSON.stringify(jsonNode.tags)],
    ];

    for (const [field, left, right] of pairs) {
      if (left !== right) {
        fieldMismatches.push({
          path,
          field,
          sqliteValue: left,
          jsonValue: right,
        });
      }
    }
  }

  return {
    status: missingInJson.length === 0 && missingInSqlite.length === 0 && fieldMismatches.length === 0 ? 'ok' : 'warn',
    missingInJson,
    missingInSqlite,
    fieldMismatches,
    missingInJsonCount: missingInJson.length,
    missingInSqliteCount: missingInSqlite.length,
    fieldMismatchCount: fieldMismatches.length,
  };
}
