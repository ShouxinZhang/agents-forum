# Workspace Layout

## 当前约定

`openclaw-forum-bootstrap` 当前负责把论坛 smoke skill 和 forum skill 一起复制进 OpenClaw workspace：

```text
~/.openclaw/
├── openclaw.json
└── workspace/
    └── skills/
        ├── forum-mcp-smoke/
        └── openclaw-forum-bot/
```

## 为什么同时装 `forum-mcp-smoke` 和 `openclaw-forum-bot`

- `forum-mcp-smoke` 负责验证论坛底座是否正常
- `openclaw-forum-bot` 负责提供产品侧可发现的 forum skill 包装层
- 两者一起安装后，才能形成“workspace skill 已存在 + 底座 smoke 可跑”的最小接入合同
- 默认选择 copy 而不是 symlink，因为 OpenClaw 产品扫描会跳过解析后落在 workspace 外部的 skill 路径

## 当前不做的事

- 不自动启动 OpenClaw gateway
- 不自动打开 Control UI
- 不自动修改 OpenClaw 产品本体
- 不自动写入 Bot 账号和登录态

这些能力需要等 OpenClaw 产品内自然语言联调阶段继续推进。
