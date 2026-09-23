# dsh-TUI · Async23 个人版

[English](README.md) · [版本发布页](https://github.com/Async23/dsh-tui/releases) · [MIT 协议](LICENSE)

这是 [ccch1mneyyy/dsh-TUI](https://github.com/ccch1mneyyy/dsh-TUI) 的个人 fork，保留完整项目和上游 Git 历史，在此基础上维护少量定制。dsh-TUI 是 DeepSeek Harness 的终端界面插件，Agent 执行、模型、工具和会话存储仍由官方 DSH 运行时负责。

## 我做了哪些定制

- **压缩 Recap 区域高度。** 去掉回顾分隔线上方、分隔线与摘要之间的两行额外留白。摘要为一行时，组件从四行缩到两行；分隔线、完整摘要、自然换行、悬停提示、展开和关闭功能继续保留。
- **紧凑输入区。** 去掉输入框上方的空白行；有通知时才临时显示一行通知文字。
- **回到底部按钮可开关。** 在 `/settings` 中选择是否显示“回到底部 / 新消息”按钮，正常滚动不受影响。详见[设置说明](docs/user-guide.md#53-settings-设置编辑器)。
- **空闲时显示上下文用量。** 底部没有提示或活动摘要时显示占比、已用与剩余 token 数及分类计数；悬停彩色条仍显示颜色图例。详见[状态栏说明](docs/user-guide.md#52-底部状态栏输入框下方三行)。
- **独立的更新来源。** `dsh-tui update` 和 `/update` 查询本仓库的 GitHub Releases。检查失败时不会切回上游 npm 更新源。
- **从 Release 安装并校验。** 安装和更新前按 `SHA256SUMS` 校验插件包。安装脚本同时安装 `dsh-tui` profile 和全局 `dsh-tui` / `dst` 启动器，沿用现有 DSH home。
- **可追踪的个人版本。** 版本采用 `x.y.z-async23.N`，分别表示上游基础版本和个人修订号；每次发布的改动与验证记录放在 Release 说明中。

为兼容 DSH 的插件配置，包标识仍是 `@deepseek-harness-tui/dsh-tui`。本 fork 只在 GitHub 发布下载包，不向上游 npm scope 发布。手动安装上游 npm 包会覆盖个人定制。

## 安装 Release

需要 Node.js **^22.19 或 >=24**、npm、pnpm，以及官方 `dsh` CLI。Release 提供编译好的 JavaScript 插件包，需要 Node.js 和 DSH 运行，不是免依赖的独立可执行文件。

在[最新 Release](https://github.com/Async23/dsh-tui/releases/latest) 下载 `install.mjs`，然后执行：

```sh
node install.mjs
dsh-tui
```

每个 Release 的安装脚本默认安装同一个版本，校验通过后才调用包管理器。全局启动器安装到 npm 当前配置的 prefix，需要对该目录有写权限。若只需要 `dsh --profile dsh-tui`，可以执行 `node install.mjs --profile-only`。

以后用 `dsh-tui update` 或 `/update` 更新。已经运行的会话需要重新启动才能加载新代码。下载包保存在 `~/.cache/dsh-tui-releases`，profile 通过本地文件路径引用它；安装期间请保留该缓存。

## 开发与维护

```sh
git clone --recurse-submodules https://github.com/Async23/dsh-tui.git
cd dsh-tui
pnpm install --frozen-lockfile --ignore-scripts
pnpm build
pnpm verify:release
pnpm release:pack
```

- [个人版维护、同步上游与发版流程](docs/fork-maintenance.md)
- [当前版本说明](docs/releases/current.md)
- [上游功能使用指南](docs/user-guide.md)
- [文档索引](docs/README.md)与[架构](docs/architecture.md)
- [源码约定](AGENTS.md)与[运行时边界](ADAPTER.md)

保留的上游文档用于查阅共有功能；本个人版的安装和更新入口以这份 README 为准。

## 协议与致谢

采用 [MIT](LICENSE)，保留原作者版权声明，并注明 Async23 的定制改动。DeepSeek Harness 和随包依赖继续遵循各自协议。这是独立维护的个人 fork。
