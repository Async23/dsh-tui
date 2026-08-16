# Running dsh-TUI in VS Code

[Documentation index](README.md) · [中文](vscode.md)

dsh-TUI is a terminal program: it writes ANSI into a PTY and reads keys back
from the PTY, so any compatible terminal can host it — including the **VS Code
integrated terminal** (xterm.js). This page covers two ways to use it:

1. **Run directly in the built-in terminal** — zero install, seconds to start;
2. **The `dsh-tui-vscode` companion extension** — an experience **almost
   identical to the official Claude Code VS Code extension**: sessions run in
   a REAL integrated terminal, open on the Beside column, multiple concurrent
   sessions, a sidebar session history, one-click start/resume and
   specific-session resume ([issue #161](https://github.com/ccch1mneyyy/dsh-TUI/issues/161)).

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

| Capability | Behavior in the integrated terminal |
| --- | --- |
| Mouse wheel / drag selection | Handled by the integrated terminal; "copy on release" surfaces as OS-level copy behavior |
| Extended keyboard protocol | modifyOtherKeys / win32-input-mode behavior is decided by xterm.js and may differ from kitty / WezTerm |
| OSC 52 clipboard | First use triggers VS Code's own permission prompt |

For behavior identical to a standalone terminal (e.g. complex mouse
semantics), use an external terminal window (Windows Terminal / kitty /
WezTerm / iTerm2 / tmux).

## Option 2: the dsh-tui-vscode companion extension (recommended)

[`baobaolaodie/dsh-tui-vscode`](https://github.com/baobaolaodie/dsh-tui-vscode)
runs dsh-tui inside a REAL VS Code integrated terminal — the same shape as the
official Claude Code extension's terminal mode (`createTerminal` + run the CLI
inside it), with no webview and no xterm emulation. It does not touch the
TUI's rendering core — it only **hosts** it and adds editor integration.

### Experience comparison with the official Claude Code extension

| Capability | Official Claude Code extension | dsh-tui-vscode |
| --- | --- | --- |
| Entry points | Activity-bar icon + editor-title button + command palette | Same (DeepSeek whale icon) |
| Session position | NEW column beside the active one (`ViewColumn.Beside`) | Same — never takes the current column |
| Terminal tab | `Claude Code` + logo icon | `DeepSeek` + whale icon |
| Session host | Real integrated terminal (default shell — PowerShell on Windows) | Same |
| Multiple sessions | Every click opens a new session terminal | Same; old sessions keep running |
| Sidebar | Sessions list | Session history (grouped by project — stronger) |
| Auto start/stop | Open = start; closing the terminal = end | Same |
| Env injection | — | `DSH_TUI_LANG` / `$VISUAL` / `$DSH_HOME` / session id |

### Install

```sh
git clone https://github.com/baobaolaodie/dsh-tui-vscode.git
cd dsh-tui-vscode
npm install
npm run package
code --install-extension dsh-tui-vscode-0.5.0.vsix --force
# or: npm run install:local
```

### Entry points and commands

- **Activity-bar whale icon** / **editor-title whale button** / command palette:
  `dsh-tui: Open panel / 打开会话面板`, `dsh-tui: Start new session / 启动新会话`,
  `dsh-tui: Resume last session / 恢复上次会话`, `dsh-tui: Terminate session / 终止会话`,
  `dsh-tui: Refresh sessions / 刷新会话列表`
- **Sidebar session history**: a tree grouped by project; clicking an entry
  resumes THAT session
- **Status bar**: a `DeepSeek` item appears while sessions exist; clicking it
  focuses the most recent terminal

### Architecture

**Session launch** (same shape as the official extension):

```ts
createTerminal({
  name: 'DeepSeek',                                   // terminal tab title
  cwd,                                                // workspace root
  env,                                                // env injection (below)
  iconPath: <whale icon>,                             // tab icon
  location: { viewColumn: ViewColumn.Beside },        // new column beside
  isTransient: true,                                  // not restored
})
terminal.show()
// runs the launch command once the shell is ready (shell-integration event,
// or a 1.2s fallback delay)
```

The launch command comes from `dsh-tui-vscode.command` (default `dsh-tui`,
resolved by the shell via PATH), plus `--resume` (resume last) or extra args.

**Env injection**: `DSH_TUI_LANG`, `$DSH_HOME` (optional override) and
`$VISUAL` (`code -w` when unset) are passed through `createTerminal`'s env;
resuming a specific session additionally injects `DSH_TUI_RESUME_SESSION`.

**Multiple concurrent sessions**: every "Start new session" click creates a
new terminal and process; older sessions keep running in their own terminals
(same as the official extension). "Focus" and "Terminate" act on the most
recently created terminal; closing a terminal ends only that session.

**Specific-session resume**: clicking a sidebar entry injects the target
session id into the terminal env via `DSH_TUI_RESUME_SESSION` and deliberately
does NOT pass `--resume`: this profile's `cordis.patch.yml` reads that env at
boot (`sessionId: !!js process.env.DSH_TUI_RESUME_SESSION ?? ...`) and the TUI
resumes the session. Passing `--resume` would make the launcher
(`bin/dsh-tui.js`) overwrite the env from `~/.dsh-tui/resume.txt` — that is the
"resume last session" path; the two do not interfere (verified in the launcher
source).

**Sidebar session history**:
- Data sources: session logs under `~/.dsh/sessions` (zstd JSONL), the
  dsh-storage ledger (`~/.dsh/storages/session_projcache.json`), and the
  TUI's last-used map (`~/.dsh-tui/last-used.json`);
- Title precedence: log `session/title` event → storage-ledger title (the web
  session list's own source) → first user message → "未命名会话";
- Grouped by project (cwd short name), most recently active project first;
  within a group, most recently used first;
- Auto-refresh: watches the session directories (including each project
  group), so new sessions appear immediately; terminal open/close and the
  manual refresh button also trigger a refresh.

**Start/stop semantics**: open = start; closing the terminal ends that
session's process; double `Ctrl+C` inside the TUI exits. No button panels, no
background daemons.

### Configuration

| Key | Default | Description |
| --- | --- | --- |
| `dsh-tui-vscode.command` | `dsh-tui` | Launch command (resolved by the shell via PATH) |
| `dsh-tui-vscode.extraArgs` | `[]` | Extra CLI args, e.g. `["--lang","en"]` |
| `dsh-tui-vscode.lang` | `""` | `""`/`zh`/`en`, exported as `DSH_TUI_LANG` |
| `dsh-tui-vscode.injectEditor` | `true` | Export `$VISUAL` when unset |
| `dsh-tui-vscode.editorCommand` | `code -w` | Value exported as `$VISUAL` |
| `dsh-tui-vscode.dshHome` | `""` | `$DSH_HOME` override (empty = inherit) |

### Development and verification

```sh
npm install
npm run typecheck   # tsc --noEmit
npm test            # compile + node --test (8 data-layer unit tests)
npm run test:e2e    # 8 real extension-host tests (xvfb-run -a on Linux)
npm run package     # compile + build the .vsix
```

The e2e suite covers: command registration, real terminal creation with env
injection, input round-trip, multiple sessions, Ctrl+C termination,
`--resume` resume, specific-session resume (env channel, no `--resume`), and a
**guarded REAL dsh-tui resume test** (a successful resume creates no new
session — observable).

### Known limitations

- Session content is terminal content: scrollback is managed by the VS Code
  terminal (same as Claude Code's terminal mode);
- Specific-session resume requires this profile's `cordis.patch.yml`
  (dsh-tui 0.6.1+);
- For logs without a `session` header, the project name comes from decoding
  the cwd-encoded group dir, which is lossy for hyphenated project names
  (e.g. `flow-comet` → `flow\comet`); the real cwd is still available in the
  item tooltip.

## Acceptance baseline

Per [Contributing](contributing.en.md), VS Code is a supported terminal
platform: any rendering change should be walked through inside the VS Code
integrated terminal in both inline and fullscreen modes at narrow widths —
startup, resize, scroll, input, cancel, and clean exit.
