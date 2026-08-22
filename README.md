# dsh-current-title-hydration

一个可随时卸载的 DSH Desktop 兼容性插件：在硬刷新后，避免**当前选中的会话**标题退回为工作区目录名。

## 问题背景

对于冷启动会话，DSH 的 `session.list` 会有意从零 I/O 缓存读取标题投影。当缓存缺少有效的 `title` 投影时，客户端会按以下顺序回退：

```text
会话标题 → cwd 目录名 → 会话 ID
```

因此，位于名为 `DSH` 的目录中的会话，即使持久化的 `session/title` 事件仍保存真实标题，也可能显示为 `DSH`。

## 插件行为

本插件会：

1. 监听客户端会话列表；
2. 如果当前选中的会话已有标题投影，则不执行任何操作；
3. 若标题投影缺失，仅经由本机 loopback 读取端点查询该会话最后一个持久化的 `session/title` 事件；
4. 使用 DSH 正常的序列顺序，将标题写入现有 projection store；
5. 写入一个很小的浏览器本地缓存，加速下一次刷新。

本插件**不会**修改 DSH 核心 bundle、会话日志、projection-cache 文件、recall 快照或工作区数据，也不会为侧边栏的所有会话批量补全标题。

## 使用 AI 安装（先读 AGENTS.md）

如果由 AI 助手、编码代理或自动化工具安装/修改本插件，**必须先阅读仓库根目录的 [AGENTS.md](AGENTS.md)**。该文件明确说明本插件没有发布到 npm，安装时必须创建本地 `link:`，并列出重启、卸载与修改边界。

## 安装（本地链接）

本插件没有发布到 npm，必须从本地仓库创建链接。请在本仓库根目录执行：

```bash
APP="/Applications/DSH Desktop.app/Contents/Resources/app"
export DSH_HOME="$HOME/Library/Application Support/dsh-desktop/harness"
"$APP/node_modules/node/bin/node" \
  "$APP/node_modules/@deepseek-ai/dsh/lib/bin.js" \
  plugin --profile web add "link:$PWD"
```

完成后请完全退出并重新打开 DSH Desktop。请勿仅安装到 `node_modules`，也不要将上述命令替换为直接执行 `pnpm add`；`dsh plugin` 成功后会把插件同步进 DSH profile 的 bundle 配置。

## 卸载

```bash
APP="/Applications/DSH Desktop.app/Contents/Resources/app"
export DSH_HOME="$HOME/Library/Application Support/dsh-desktop/harness"
"$APP/node_modules/node/bin/node" \
  "$APP/node_modules/@deepseek-ai/dsh/lib/bin.js" \
  plugin --profile web remove dsh-current-title-hydration
```

卸载后同样需要完全重启 DSH Desktop。

## 验证

1. 打开一个已有标题的会话，等待侧边栏或 Header 显示预期标题。
2. 对 DSH Desktop web view 执行硬刷新。
3. 当前选中的会话应保留或很快恢复持久化标题，而不是显示 cwd 目录名。

可执行以下命令进行静态检查和单元测试：

```bash
npm run check
```

如果系统未单独安装 Node/npm，请使用 DSH Desktop 内置的 Node 运行时。
