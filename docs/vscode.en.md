# Running dsh-TUI in VS Code

[Documentation index](README.md) · [中文](vscode.md)

dsh-TUI is a terminal program: it writes ANSI into a PTY and reads keys back
from the PTY, so any compatible terminal can host it — including the **VS Code
integrated terminal** (xterm.js). This page covers two ways to use it:

1. **Run directly in the built-in terminal** — zero install, seconds to start;
2. **The `dsh-tui-vscode` companion extension** — one-click start/resume,
   clickable file paths, `$VISUAL`/`$EDITOR` pointing at VS Code
   ([issue #161](https://github.com/ccch1mneyyy/dsh-TUI/issues/161),
   Path A MVP).

## Option 1: run directly in the VS Code integrated terminal

Prerequisites match [Getting started](getting-started.en.md): install the `dsh`
CLI and `dsh-tui` globally (the first run bootstraps the profile; pnpm is
required).

1. Open the VS Code integrated terminal (`` Ctrl+` ``) and run:

   ```sh
   dsh-tui
   ```

2. Resume the last session:

   ```sh
   dsh-tui --resume
   ```

dsh-TUI has dedicated compatibility paths for xterm.js (VS Code / Cursor /
code-server): truecolor, OSC 8 links (rendered clickable by VS Code itself),
OSC 52 clipboard (VS Code prompts for permission on first use), synchronized
output and smooth draining — handled in `src/ink/` under the
`TERM_PROGRAM=vscode` detection branches. Streaming Markdown, tool cards,
scrolling, and double-Esc time travel behave the same as in a standalone
terminal.

### Make `Ctrl+X` edit the current input in VS Code

The TUI's `Ctrl+X` uses `$VISUAL`/`$EDITOR`. To edit in VS Code, export
`code -w` in the terminal environment (`settings.json`, key
`terminal.integrated.env.<platform>`):

```jsonc
{
  "terminal.integrated.env.windows": { "VISUAL": "code -w" },
  "terminal.integrated.env.linux":   { "VISUAL": "code -w" },
  "terminal.integrated.env.osx":     { "VISUAL": "code -w" }
}
```

(The companion extension exports `code -w` automatically when neither
`$VISUAL` nor `$EDITOR` is set — see below.)

### UI language

`DSH_TUI_LANG` defaults to Chinese; for the English UI, add
`"DSH_TUI_LANG": "en"` to the env block above.

### Known differences (built-in terminal)

The xterm.js capabilities cap what is possible:

| Capability | Behavior in the integrated terminal |
| --- | --- |
| Mouse wheel / drag selection | Handled by the integrated terminal; "copy on release" surfaces as OS-level copy behavior |
| Extended keyboard protocol | modifyOtherKeys / win32-input-mode behavior is decided by xterm.js and may differ from kitty / WezTerm |
| OSC 52 clipboard | First use triggers VS Code's own permission prompt |

For behavior identical to a standalone terminal (e.g. complex mouse
semantics), use an external terminal window (Windows Terminal / kitty /
WezTerm / iTerm2 / tmux) or wait for a Path B custom rendering solution
(below).

## Option 2: the dsh-tui-vscode companion extension

[`baobaolaodie/dsh-tui-vscode`](https://github.com/baobaolaodie/dsh-tui-vscode)
opens a dedicated integrated terminal via `createTerminal()` running `dsh-tui`
and layers light editor integration on top. It does not touch the TUI's
rendering core — it only **hosts** it, the same architecture as the official
Claude Code VS Code extension.

### Install

```sh
git clone https://github.com/baobaolaodie/dsh-tui-vscode.git
cd dsh-tui-vscode
pnpm install
pnpm package
code --install-extension dsh-tui-vscode-0.1.0.vsix --force
```

### Commands and editor integration

- `dsh-tui: Start new session / 启动新会话`, `dsh-tui: Resume last session / 恢复上次会话`,
  `dsh-tui: Focus session terminal / 聚焦会话终端`, `dsh-tui: Terminate session / 终止会话`
- File paths in terminal output (`C:\...`, `/...`, `~/...`, `./...`, with
  `path:line[:col]`) are clickable and open in the editor
- Exports `code -w` as `$VISUAL` when unset, so `Ctrl+X` edits in VS Code
- Status-bar `dsh-tui` item focuses/starts the session
- Settings: `dsh-tui-vscode.command`, `extraArgs`, `terminalName`, `lang`,
  `injectEditor`, `editorCommand`, `dshHome` (see the extension README)

### Limitations and next steps

Path A is bounded by the VS Code integrated terminal, same as Option 1. If
full custom rendering is ever needed (webview + xterm.js + real PTY — Path B
of issue #161), the extension repo is the hosting point; dsh-TUI itself keeps
its "interaction and presentation only" boundary unchanged.

## Acceptance baseline

Per [Contributing](contributing.en.md), VS Code is a supported terminal
platform: any rendering change should be walked through inside the VS Code
integrated terminal in both inline and fullscreen modes at narrow widths —
startup, resize, scroll, input, cancel, and clean exit.