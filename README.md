# dsh-TUI · Async23

[简体中文](README_ZH.md) · [Releases](https://github.com/Async23/dsh-tui/releases) · [MIT License](LICENSE)

A personal fork of [ccch1mneyyy/dsh-TUI](https://github.com/ccch1mneyyy/dsh-TUI), the terminal UI plugin for DeepSeek Harness. This repository keeps the upstream project and history, with a small, documented set of personal changes. Agent execution, models, tools and session storage remain provided by the official DSH runtime.

## Customizations

- **Accurate todo shortcut hints:** the panel and help menu follow the configured binding. See the [keyboard guide](docs/user-guide.en.md#2-keymap-quick-reference).
- **Compact Recap:** removes two extra blank rows above the recap divider and summary. The divider, full summary, natural wrapping, hover hint, expand and dismiss behavior remain available. With a one-line recap, the component occupies two terminal rows instead of four.
- **Optional back-to-bottom button:** show or hide the return-to-bottom / new-message button in `/settings`, without changing scrolling. See the [settings guide](docs/user-guide.en.md#53-the-settings-editor).
- **Context details while idle:** the footer shows the context legend whenever no hint or activity summary is displayed. See the [status bar guide](docs/user-guide.en.md#52-bottom-status-bar-three-rows-under-the-input).
- **Personal release channel:** `dsh-tui update` and `/update` check this repository's GitHub Releases. Failed checks do not switch to the upstream npm release channel.
- **Verified installation:** release installation and updates verify the plugin archive against `SHA256SUMS`. The installer installs both the `dsh-tui` profile and the global `dsh-tui` / `dst` launcher, using the existing DSH home.
- **Traceable versions:** `x.y.z-async23.N` identifies the upstream base and personal revision. Release notes record changes and validation for each revision.

The npm package identifier remains `@deepseek-harness-tui/dsh-tui` for compatibility with DSH's plugin configuration. This fork publishes downloadable artifacts on GitHub, not to the upstream npm scope. Installing the upstream npm package manually replaces these customizations.

## Install a release

Requires Node.js **^22.19 or >=24**, npm, pnpm, and the official `dsh` CLI. Releases contain a compiled JavaScript plugin archive, so Node.js and DSH are required; this is not a standalone executable.

Download `install.mjs` from the [latest release](https://github.com/Async23/dsh-tui/releases/latest), then run:

```sh
node install.mjs
dsh-tui
```

The release installer pins its own version and verifies the plugin archive before installation. It uses your configured npm global prefix; that prefix must be writable. Use `node install.mjs --profile-only` when you only need `dsh --profile dsh-tui` and do not want to install global launchers.

Update with `dsh-tui update` or `/update`. Restart an already running session to load newly installed code. Downloaded archives stay in `~/.cache/dsh-tui-releases` because the profile records a local file dependency; keep this cache while the release is installed.

## Develop and maintain

```sh
git clone --recurse-submodules https://github.com/Async23/dsh-tui.git
cd dsh-tui
pnpm install --frozen-lockfile --ignore-scripts
pnpm build
pnpm verify:release
pnpm release:pack
```

- [Fork maintenance and publishing](docs/fork-maintenance.md)
- [Current release notes](docs/releases/current.md)
- [Upstream feature guide](docs/user-guide.en.md)
- [Documentation index](docs/README.md) and [architecture](docs/architecture.md)
- [Source conventions](AGENTS.md) and [runtime boundary](ADAPTER.md)

The retained upstream documentation describes shared features; use this README for the personal fork's installation and release channel.

## License and attribution

[MIT](LICENSE), retaining the upstream copyright notice and adding attribution for Async23's modifications. DeepSeek Harness and bundled third-party dependencies retain their own licenses. This is an independently maintained personal fork.
