# 开发日志 - workflow 添加一键重启脚本

## 1. 用户原始请求
> 对了，在workflow上，最后要求添加一个一键启动脚本restart.sh

## 2. 对话与意图摘要
- 用户希望把一键启动/重启能力纳入工作流要求。
- 实施决策: 在仓库根目录新增 `restart.sh`，默认执行 `forum-web` 的开发服务重启；并同步更新开发计划文档中的 workflow 要求。

## 3. 修改时间
- 完成时间: 2026-02-09 22:58:04 +0800
- 记录时间戳(秒): 1770649084

## 4. 文件清单（路径 / 操作 / 说明）
- `restart.sh` / 新增 / 一键重启前端脚本（停止占用端口进程 + 安装依赖 + 启动 dev server）
- `docs/dev_plan/agents_forum_mvp_plan.md` / 更新 / 新增“工作流要求”勾选项，明确 `restart.sh`
- `docs/dev_logs/2026-02-09/03-workflow-add-restart-script.md` / 新增 / 本轮变更记录

## 5. 变更说明（方案、影响范围、风险）
- 方案:
  - `restart.sh` 默认参数: `HOST=127.0.0.1`、`PORT=4173`、`WORKSPACE=forum-web`。
  - 若端口被占用，先尝试 kill 占用进程，再启动 `npm run dev -w forum-web`。
- 影响范围:
  - 仅新增启动脚本与文档，不影响业务逻辑代码。
- 风险控制:
  - kill 仅针对指定端口，降低误杀范围。

## 6. 验证结果
- `bash scripts/check_errors.sh`：通过（4/4）
- `npm test`：通过（workspace 下无测试用例时按 `--if-present` 跳过）
- `node scripts/repo-metadata/scripts/scan.mjs --update`：执行成功
- `node scripts/repo-metadata/scripts/generate-structure-md.mjs`：执行成功

## 7. Git 锚点
- branch: `main`
- HEAD: `8891850edeca18c9da065bdf9af3e220db20c5bc`
- tag: 无
