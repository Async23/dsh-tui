# dsh-TUI 0.10.2-async23.2

基于上游 0.10.2，基础提交 `8e1931e7bbd376dc8838d74f2fe24f052012542c`，延续 async23.1 的 Recap 紧凑布局和个人更新来源。

- `/settings` 的 dsh-tui 区块新增“显示回到底部按钮”（英文 `Show back-to-bottom button`，配置键 `showBackToBottom`），默认开启。
- 关闭后同时隐藏“回到底部”和新消息计数按钮；重新开启立即恢复当前提示。
- 开关自动保存，立即生效，重启后保留。关闭按钮不影响滚动、既有回底操作和回底后跟随新输出。
- 同步双语 README、设置指南和配置示例，发布流程加入常规与窄屏按钮回归。

下载 `install.mjs` 后运行 `node install.mjs`。需要 Node.js ^22.19 或 >=24、npm、pnpm 和官方 dsh。安装沿用现有 dsh-tui profile；启动命令为 `dsh-tui` 或 `dst`。

发布资产：`dsh-tui.tgz`（编译插件）、`install.mjs`（版本固定的安装脚本）、`SHA256SUMS`。DSH 核心仍使用官方运行时，本 Release 不提供独立二进制。

验证：TypeScript 编译、全部 `verify:build` 门禁、100 列与 60 列按钮交互回归、设置自动保存回归、问卷及工具卡 CI 回归、Recap 27 项交互检查、个人发布 15 项检查通过。安装包的 27 个入口均在归档中，编译入口可正常导入。

隔离 profile 实际启动验证：120 列全屏界面可以关闭开关并写入 settings.yaml；重新启动到 80 列 inline 界面后，设置仍显示关闭。两次启动均正常退出，未提交模型请求。
