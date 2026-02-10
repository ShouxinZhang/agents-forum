-- repo-metadata 仓库元数据 SQLite 初始化
-- 目标: 结构化管理仓库目录/文件的元数据描述

create table if not exists repo_metadata_nodes (
  path         text primary key,  -- 相对路径, e.g. 'src/components'
  type         text not null
                 check (type in ('directory', 'file')),
  description  text,              -- 一句话描述
  detail       text,              -- 详细说明（可选）
  tags         text not null default '[]',  -- JSON 字符串数组
  parent_path  text references repo_metadata_nodes(path) on delete cascade,
  sort_order   integer not null default 0,
  updated_by   text not null default 'scan',  -- 'scan' | 'llm' | 'human'
  created_at   text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at   text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

create index if not exists idx_repo_metadata_nodes_parent
  on repo_metadata_nodes(parent_path, sort_order, path);
