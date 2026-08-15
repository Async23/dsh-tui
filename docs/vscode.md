# 在 VS Code 中运行 dsh-TUI

[文档索引](README.md) · [English](vscode.en.md)

dsh-TUI 是终端程序：它把 ANSI 写进 PTY、从 PTY 读按键，因此任何兼容终端都能
承载它，包括 **VS Code 集成终端**（xterm.js）。本页覆盖两种用法：

1. **直接在内置终端里跑** —— 零安装，秒级可用；
2. **companion 扩展 `dsh-tui-vscode`** —— 一键启动/恢复、文件路径可点、
   `$VISUAL`/`$EDITOR` 指向 VS Code 等编辑器加成（
   [issue #161](https://github.com/ccch1mneyyy/dsh-TUI/issues/161) 的
   Path A MVP）。

## 方式一：VS Code 集成终端直接运行

前置条件与[快速开始](getting-started.md)一致：全局安装 `dsh` CLI 与 `dsh-tui`
（首次启动会自举 profile，需要 pnpm）。

1. 打开 VS Code 集成终端（`` Ctrl+` ``）：

   ```sh
   dsh-tui
   ```

2. 恢复上次会话：

   ```sh
   dsh-tui --resume
   ```

dsh-TUI 对 xterm.js（VS Code / Cursor / code-server）有专门的兼容路径：
truecolor 配色、OSC 8 链接（由 VS Code 直接渲染为可点击）、OSC 52 剪贴板
（首次使用 VS Code 会弹授权提示）、同步输出与平滑刷屏——这些在
`src/ink/` 中按 `TERM_PROGRAM=vscode` 探测分支处理。因此在内置终端里，
流式 Markdown、工具卡、滚动、双击 Esc 时间回溯等行为与独立终端一致。

### 让 `Ctrl+X` 用 VS Code 编辑当前输入

TUI 的 `Ctrl+X` 走 `$VISUAL`/`$EDITOR`。想让它在 VS Code 里编辑，把
`code -w` 写进终端环境（`settings.json` 中按平台设置，键名
`terminal.integrated.env.<platform>`）：

```jsonc
{
  "terminal.integrated.env.windows": { "VISUAL": "code -w" },
  "terminal.integrated.env.linux":   { "VISUAL": "code -w" },
  "terminal.integrated.env.osx":     { "VISUAL": "code -w" }
}
```

（若 `$VISUAL`/`$EDITOR` 都未设置，companion 扩展会自动导出 `code -w`，见下文。）

### 界面语言

`DSH_TUI_LANG` 默认中文；要英文界面，在上述 env 里加 `"DSH_TUI_LANG": "en"`。

### 已知差异（内置终端）

xterm.js 的能力上限决定：

| 能力 | 内置终端表现 |
| --- | --- |
| 鼠标滚轮/拖选 | 由集成终端处理；“松开即复制”在 VS Code 内表现为 OS 级复制行为 |
| 扩展键盘协议 | modifyOtherKeys / win32-input-mode 相关行为由 xterm.js 决定，可能与 kitty / WezTerm 不完全一致 |
| OSC 52 剪贴板 | 首次使用弹出权限提示（VS Code 自身的安全设计） |

需要完全对齐独立终端行为（如复杂鼠标语义）时，请使用独立终端窗口
（Windows Terminal / kitty / WezTerm / iTerm2 / tmux），或等待路径 B 的
完整自定义渲染方案（见下文）。

## 方式二：companion 扩展 dsh-tui-vscode

[`baobaolaodie/dsh-tui-vscode`](https://github.com/baobaolaodie/dsh-tui-vscode)
用 `createTerminal()` 开一个专用集成终端跑 `dsh-tui`，再叠加轻量编辑器集成。
它不改动 TUI 核心渲染链路，只负责**承载**——与 Claude Code 官方 VS Code
扩展同构。

### 安装

```sh
git clone https://github.com/baobaolaodie/dsh-tui-vscode.git
cd dsh-tui-vscode
pnpm install
pnpm package
code --install-extension dsh-tui-vscode-0.1.0.vsix --force
```

### 命令与编辑器加成

- `dsh-tui: Start new session / 启动新会话`、`dsh-tui: Resume last session / 恢复上次会话`、
  `dsh-tui: Focus session terminal / 聚焦会话终端`、`dsh-tui: Terminate session / 终止会话`
- 终端输出里的 `C:\...`、`/...`、`~/...`、`./...` 路径（含 `path:line[:col]`）可点击打开
- `$VISUAL`/`$EDITOR` 未设置时自动导出 `code -w`，`Ctrl+X` 直接进 VS Code
- 状态栏 `dsh-tui` 项点击聚焦/启动会话
- 配置项：`dsh-tui-vscode.command`、`extraArgs`、`terminalName`、`lang`、
  `injectEditor`、`editorCommand`、`dshHome`（详见扩展 README）

### 限制与后续

Path A 的能力上限与“方式一”相同（受 VS Code 集成终端约束）。若未来需要
完整自定义渲染（Webview + xterm.js + 真 PTY，issue #161 的路径 B），扩展
仓库可作为承载点；dsh-TUI 本体保持“只做交互与呈现”的边界不变。

## 验收基线

按[贡献指南](contributing.md)的约定，VS Code 属于受支持的终端平台：任何
渲染改动请在 inline / fullscreen 两种模式、窄终端宽度下，于 VS Code
集成终端内走一遍启动、resize、滚动、输入、取消与干净退出。