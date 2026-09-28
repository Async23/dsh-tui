/**
 * verify-settings-namespace — 设置读点必须用「本挂载注册的 ns」，不是字面量
 * `'dsh-tui'`。
 *
 * 背景（issue #1124）：设置分区注册与写入用的是 `resolveSettingsNamespace()`
 * 解出的 Config owner Loader id（profile 里可以是 `custom-tui` 等自定义 id），
 * 但三个读点写死了 `'dsh-tui'`：
 *  - `channel.autoRecapOnOpen`（设置 `dsh-tui.recapOnOpen`，默认开）——非默认 id
 *    下 `describe()` 里没有该 ns，`undefined !== false` 于是自动回顾**永远关不掉**；
 *  - `Chat.applyLang` 往 settings 用户层镜像 `lang` —— 静默跳过；
 *  - `/reload` 的 `langOverriddenBySettings` —— 恒 false，语言优先级报告错位。
 *
 * 本回归钉住：解析出的 ns、构造时传入的 ns、`channel.settingsNamespace` 暴露的
 * ns、getter 实际查询的 ns 是同一个；并覆盖「不串到别的插件 ns」「缺省回落
 * `'dsh-tui'`」与 `recapOnOpen` 的取值语义。
 *
 * Source-level via tsx; no lib/ needed.
 * Run: node --import tsx/esm scripts/verify-settings-namespace.ts
 */
import assert from 'node:assert/strict'
import { createChannel } from '../src/dsh-adapter/channel.js'
import type { ChannelLaunchOptions } from '../src/dsh-adapter/channel/state.js'
import { resolveSettingsNamespace } from '../src/dsh-adapter/compat/settings.js'
import { Config } from '../src/dsh-adapter/index.js'

let checks = 0
function check(name: string, test: () => void): void {
  try {
    test()
    checks += 1
    console.log(`PASS: ${name}`)
  } catch (error) {
    console.error(`FAIL: ${name}`)
    throw error
  }
}

/** The channel only needs `ctx.get('settings')` here; everything else stays
 *  undefined, which is the shape the other channel fixtures use. */
function makeChannel(options: {
  settingsNs?: string
  describe?: () => readonly { ns: string; value: unknown }[]
} = {}) {
  const settings = options.describe === undefined ? undefined : { describe: options.describe }
  const ctx = {
    on: () => () => {},
    get: (name: string) => (name === 'settings' ? settings : undefined),
    logger: { warn() {} },
  }
  const agent = {
    id: 'ns-agent',
    status: 'idle',
    session: { id: 'ns-session', seq: 0, events: [] },
    ctx: { on: () => () => {} },
    followup() {},
    steer() {},
  }
  const launch: ChannelLaunchOptions = {
    model: 'deepseek-chat',
    cwd: '/tmp',
    provider: 'deepseek',
    activity: false,
  }
  if (options.settingsNs !== undefined) launch.settingsNs = options.settingsNs
  return createChannel(ctx as never, agent as never, launch)
}

const describeFor = (ns: string, value: unknown) => () => [{ ns, value }]

// ── ① 缺省与自定义 ns ─────────────────────────────────────────────────────
check("未传 settingsNs 时读点仍是 'dsh-tui'（直接注入的兜底）", () => {
  assert.equal(makeChannel().settingsNamespace, 'dsh-tui')
})
check('自定义 Loader id 原样成为读点用的 ns', () => {
  assert.equal(makeChannel({ settingsNs: 'custom-tui' }).settingsNamespace, 'custom-tui')
})

// ── ② 解析出的 ns 就是读点用的 ns（漂移守卫）─────────────────────────────
check('resolveSettingsNamespace 解出的 id 与 channel 读的 ns 一致', () => {
  for (const id of ['dsh-tui', 'custom-tui', 'Custom.TUI']) {
    // 与 plugin.ts 的取值同形：settings 服务不提供 register（0.1.7 线）时，
    // ns 取 Config owner 的 Loader entry id。
    const owner = { get: () => ({}), fiber: { entry: { options: { id } } } }
    const resolved = resolveSettingsNamespace(owner as never, Config)
    assert.equal(resolved, id)
    assert.equal(makeChannel({ settingsNs: resolved }).settingsNamespace, resolved)
  }
})

// ── ③ getter 只认自己的 ns（#1124 的复现点）───────────────────────────────
check('自定义 ns 下关掉 recap 就真的关掉', () => {
  const channel = makeChannel({ settingsNs: 'custom-tui', describe: describeFor('custom-tui', { recapOnOpen: false }) })
  assert.equal(channel.autoRecapOnOpen, false, "读点写死 'dsh-tui' 时这里会是 true，#1124 复现")
})
check('别的插件的 ns 不会被误认（同名键也不算）', () => {
  const channel = makeChannel({ settingsNs: 'custom-tui', describe: describeFor('llm-pi-ai', { recapOnOpen: false }) })
  assert.equal(channel.autoRecapOnOpen, true)
})
check("默认 ns 下 'dsh-tui' 的用户层仍然生效", () => {
  assert.equal(makeChannel({ describe: describeFor('dsh-tui', { recapOnOpen: false }) }).autoRecapOnOpen, false)
})

// ── ④ 值语义：只有显式 false 算关 ─────────────────────────────────────────
for (const [label, value] of [
  ['未设置', {}],
  ['显式 true', { recapOnOpen: true }],
  ['null', { recapOnOpen: null }],
] as const) {
  check(`recapOnOpen ${label} → 视为开`, () => {
    assert.equal(makeChannel({ describe: describeFor('dsh-tui', value) }).autoRecapOnOpen, true)
  })
}
check('没有 settings 服务时保持既有语义（关）', () => {
  assert.equal(makeChannel().autoRecapOnOpen, false)
})

console.log(`\nAll ${checks} settings-namespace checks passed.`)
