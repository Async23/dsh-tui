# 个人版维护

项目入口和定制清单见 [README_ZH.md](../README_ZH.md)，本页记录源码与 Release 的维护流程。

## 源码与上游

`origin` 指向 `Async23/dsh-tui`，`upstream` 指向 `ccch1mneyyy/dsh-TUI`。修改 `src/`，由编译生成 `lib/types/`；不要直接修改已安装的 JavaScript 文件。子模块保留上游来源与固定提交。

同步上游时先保存个人改动，在单独分支合并所需上游提交，处理冲突并重新验证。保留 Recap 的紧凑布局、个人更新源和发布配置。当前上游基础提交见对应 Release 说明。

```sh
git fetch upstream
git switch -c sync/upstream
git merge upstream/main
git submodule update --init --recursive
```

上游贡献准入要求只针对提交给上游的 PR；本个人 fork 的修改按仓库维护者授权处理。

## 构建与验证

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm build
pnpm verify:release
node --import tsx/esm scripts/verify-auto-recap.tsx
pnpm release:pack
```

在 macOS 上，系统临时目录可能使 Unix socket 路径超过长度限制；遇到注入通道测试的路径错误时，可用 `TMPDIR=/tmp pnpm verify:build` 运行同一套检查。中文界面断言用 `DSH_TUI_LANG=zh`，与 CI 一致。无头颜色测试不要继承 tmux 的颜色降级环境；在 tmux 中运行时可使用 `env -u TMUX -u NO_COLOR TMPDIR=/tmp DSH_TUI_LANG=zh pnpm verify:build`，不改变实际终端配置。

`release:pack` 将 workspace/link 依赖的编译文件随包分发，移除需要源码的 prepare 生命周期，再校验所有入口是否在 tarball 中。打包临时修改 manifest，结束后恢复；不要与其他读写 manifest 的构建同时运行。

产物位于忽略入库的 `dist-release/`：`dsh-tui.tgz`、`install.mjs`、`SHA256SUMS`。安装脚本由编译后的 `src/release.ts` 与 `scripts/install-release.mjs` 生成，安装与 `/update` 共用下载和校验逻辑。包内不放本机配置、会话、凭据或 node_modules 的开发依赖。

## 发版

1. 将 `package.json` 的版本改为 `上游版本-async23.修订号`，更新 [当前发布说明](releases/current.md)。本项目保留 MIT 和上游版权，不发布到上游 npm scope。
2. 完成上述验证，提交源码与文档。
3. 推送与 package.json 完全一致的 `v版本号` tag。`Publish personal release` 工作流从该 tag 检出子模块、构建、验证、打包并创建 GitHub Release。该工作流只在 `Async23/dsh-tui` 上运行。
4. 在 Release 页确认三个资产齐全，下载该版本的 `install.mjs` 并执行；用 `dsh-tui version` 检查 launcher 和 profile 版本一致。

手动补发时使用相同的构建和校验过程，从 tag 构建后用 `gh release create --verify-tag --latest` 上传这三个文件，并附版本说明。版本后缀按个人修订编号使用，GitHub Release 标为普通最新发布，供 `/releases/latest` 查询。

历史上游的便携包和 Star History 工作流只允许在上游仓库运行。本 fork 的资产是 Node.js 插件包；不要用原有的上游 npm 便携包构建脚本发布个人版本。

## 安装与回退

安装脚本先校验 Release 包，再调用官方 DSH 的 profile 安装机制；全局 launcher 使用同一个已验证的文件。默认 profile 为 `dsh-tui`，不重建 DSH home。安装失败时脚本非零退出，可以修复报错后重跑。

已验证的包保留在 `~/.cache/dsh-tui-releases/`，因为 pnpm 会将文件路径写入 profile 依赖。回退到个人旧版时，下载该旧版 Release 的 `install.mjs` 并重新运行；无需改源码。安装上游 npm 包则会恢复上游 UI 和更新来源。
