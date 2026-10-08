# dsh-TUI 0.14.0-async23.1

同步上游正式版 0.14.0，基础提交 `c2eee95218d1decfce138f7d31ef7099cc391d00`，保留个人版的全部界面定制和 GitHub Release 更新来源。

- 引入上游多内核界面：DSH 为默认内核，Claude 与 Codex 为实验性可选后端；同时更新会话管理、Agent 团队面板、侧线程、Markdown 与数学公式呈现。上游功能和兼容说明见 [0.14.0 Release](https://github.com/ccch1mneyyy/dsh-TUI/releases/tag/v0.14.0)。
- 保留紧凑输入区和 Recap、默认上下文用量明细、回到底部按钮开关，以及跟随实际键位配置的待办快捷键提示。
- 紧凑输入区适配新版附件和通知路由：附件占用一行；只有真正显示的通知才保留通知行；通知和附件移除后正确收回空间。
- 默认上下文明细使用新版统一占用数据；悬停、操作提示和活动摘要仍按优先级切换，底栏高度保持稳定。
- 修复 Node 22 下 Codex 代理连接关闭时的异常，保留连接队列、分帧和异常退出处理。
- 更新随包中英文手册、配置接线与个人回归脚本，适配新版可动态更新的配置和活动投影接口。

下载本 Release 的 `install.mjs` 后执行 `node install.mjs`，校验通过后同时更新现有 dsh-tui profile 和全局启动器。也可使用已有个人版的 `dsh-tui update` 或 `/update`。需要 Node.js ^22.19 或 >=24、npm、pnpm 和官方 dsh；本版主验证目标为 DSH `0.2.0-rc.2`。启动命令为 `dsh-tui` 或 `dst`，已运行的空闲会话可执行 `/restart` 加载新代码。

发布资产为 `dsh-tui.tgz`、`install.mjs` 和 `SHA256SUMS`。安装与更新共用 SHA-256 校验；更新来源固定为 `Async23/dsh-tui` 的 GitHub Release。

验证：TypeScript 编译、91 项构建门禁和四个完整 CI 回归组共 355 项通过，另通过屏幕组装冒烟、个人发布校验、待办快捷键全屏/窄屏回归。输入区的 90 项断言覆盖 fullscreen/inline 和 120/80/40 列；Codex 代理连接的 7 项回归在 Node 22.23.2 与 24.18.0 均通过。一次 IDE 通道并行测试偶发失败，按仓库流程单独串行复跑通过。Claude/Codex 的带凭据模型回合未在本次验证中运行。

同步记录：上游重写了历史，旧基础提交 `8e1931e7bbd376dc8838d74f2fe24f052012542c` 与新历史中的 `73843e5d` tree 一致。本次按已核对的基线做三方合并，保留个人历史与上游父节点。
