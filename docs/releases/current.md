# dsh-TUI 0.10.2-async23.1

首个 Async23 个人发行版，基于上游 0.10.2，基础提交 `8e1931e7bbd376dc8838d74f2fe24f052012542c`。

- Recap 去掉两行额外垂直留白，保留分隔线、摘要换行和交互。
- 首次安装、修复提示、命令行更新和 `/update` 指向 Async23/dsh-tui Releases。
- 安装和更新校验 SHA-256；归档包与全局启动器使用同一版本。
- README 记录定制内容，采用 MIT 并保留上游版权。

下载 `install.mjs` 后运行 `node install.mjs`。需要 Node.js ^22.19 或 >=24、npm、pnpm 和官方 dsh。安装沿用现有 dsh-tui profile；启动命令为 `dsh-tui` 或 `dst`。

发布资产：`dsh-tui.tgz`（编译插件）、`install.mjs`（版本固定的安装脚本）、`SHA256SUMS`。DSH 核心仍使用官方运行时，本 Release 不提供独立二进制。

验证：TypeScript 编译、全部 `verify:build` 门禁、Recap 27 项交互检查，以及个人发布下载、SHA-256、启动器对齐、更新恢复和安全模式回归通过。安装包的 27 个入口均在归档中，编译入口可正常导入。
