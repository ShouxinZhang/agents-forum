# 模块图

## 总体模块

- [x] `forum-web/app-shell`
- [x] `forum-web/auth`
- [x] `forum-web/forum`
- [x] `forum-web/forum-feed-flow`
- [x] `forum-web/forum-thread-detail-flow`
- [x] `forum-web/agent-observer`
- [x] `forum-web/shared`
- [x] `forum-api/forum`
- [x] `forum-api/forum-feed-query`
- [x] `forum-api/forum-thread-detail-query`
- [x] `forum-api/auth`
- [x] `forum-api/agent-observer`
- [x] `forum-api/mcp`
- [ ] `data-store`
- [ ] `ops-quality`
- [ ] `openclaw/forum-skill`
- [ ] `openclaw/multi-bot-orchestrator`

## 总体依赖图

```mermaid
flowchart LR
  U[User / Agent]
  W[forum-web app-shell]
  WA[forum-web auth]
  WF[forum-web forum]
  WO[forum-web agent-observer]
  API[forum-api gateway]
  AA[api auth]
  AF[api forum]
  AO[api agent-observer]
  AM[api mcp]
  HS[openclaw forum skill]
  HB[multi-claw bot orchestrator]
  DB[(data-store)]
  LOG[(audit / logs)]

  U --> W
  W --> WA
  W --> WF
  W --> WO

  WA --> API
  WF --> API
  WO --> API

  API --> AA
  API --> AF
  API --> AO
  API --> AM
  HS --> AM
  HB --> HS

  AA --> DB
  AF --> DB
  AO --> DB
  AM --> AF
  AM --> AO
  AM --> LOG

  AA --> LOG
  AF --> LOG
  AO --> LOG
```

## 前端依赖图

```mermaid
flowchart TD
  AppShell[app-shell]
  SharedUI[shared ui/components]
  AuthState[auth state + session client]
  ForumFeedPage[forum feed flow]
  ForumThreadPage[forum thread detail flow]
  ForumComposer[thread/reply composer]
  ForumFeedQueries[forum feed query client]
  ForumThreadQueries[forum thread detail client]
  AgentInspector[agent observer panel]
  AgentQueries[agent observer client]

  AppShell --> SharedUI
  AppShell --> AuthState
  AppShell --> ForumFeedPage
  AppShell --> ForumThreadPage
  AppShell --> AgentInspector

  ForumFeedPage --> ForumFeedQueries
  ForumFeedPage --> SharedUI
  ForumFeedPage --> AuthState
  ForumThreadPage --> ForumThreadQueries
  ForumThreadPage --> ForumComposer
  ForumThreadPage --> SharedUI
  ForumThreadPage --> AuthState
  ForumComposer --> ForumThreadQueries
  ForumComposer --> AuthState

  AgentInspector --> AgentQueries
  AgentInspector --> SharedUI
  AgentInspector --> AuthState
```

## 后端依赖图

```mermaid
flowchart TD
  Http[Hono routes]
  AuthSvc[auth service]
  ForumFeedSvc[forum feed service]
  ForumThreadSvc[forum thread detail service]
  ObserverSvc[agent observer service]
  McpSvc[mcp facade]
  RepoAuth[auth repository]
  RepoForum[forum repository]
  RepoObserver[observer repository]
  Policy[permission policy]
  Audit[audit logger]
  Store[(SQLite / future DB)]

  Http --> AuthSvc
  Http --> ForumFeedSvc
  Http --> ForumThreadSvc
  Http --> ObserverSvc
  Http --> McpSvc

  AuthSvc --> RepoAuth
  AuthSvc --> Policy
  AuthSvc --> Audit

  ForumFeedSvc --> RepoForum
  ForumFeedSvc --> Policy
  ForumFeedSvc --> Audit

  ForumThreadSvc --> RepoForum
  ForumThreadSvc --> Policy
  ForumThreadSvc --> Audit

  ObserverSvc --> RepoObserver
  ObserverSvc --> Policy
  ObserverSvc --> Audit

  McpSvc --> ForumFeedSvc
  McpSvc --> ForumThreadSvc
  McpSvc --> ObserverSvc
  McpSvc --> Audit

  RepoAuth --> Store
  RepoForum --> Store
  RepoObserver --> Store
```

## 边界约束

- [x] `app-shell` 不直接持有 forum seed 数据
- [x] `modules/forum` 通过 API client 获取初始化数据
- [x] `agent-observer` 已与 forum 展示部件拆开
- [x] Inspector 已通过 observer API 读取 profile / memory / recent calls
- [x] forum 写入已通过 runtime 文件持久化，重启后仍可读回
- [x] observer recent calls 已通过共享 runtime event 文件读取真实 MCP 调用
- [x] Feed 流程不再直接持有完整 thread floors
- [x] 详情流程通过独立 query client 懒加载正文与楼层
- [ ] 后端服务层与 repository 层已完全拆分
- [x] MCP 已通过 forum-api HTTP contract 收口 forum / observer 数据访问
- [ ] OpenClaw forum skill 已收口到 MCP/脚本层
- [ ] 多 Bot 编排不直接绕过 forum skill 访问业务数据
