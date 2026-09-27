/**
 * 本会话花费估算回归：子代理 durable usage + 主会话按模型分桶 + 多模型计价
 * （AC-A1..A6，#1089 / #857）。
 *
 * 覆盖：
 *  - AC-A5：价目表按 #857 更新（v4-flash / -vision-exp 用 Flash 价，v4-pro 行移除），
 *    priceForModel 前缀匹配结果；
 *  - AC-A1：SubagentActivityStore 消费 durable assistant/message.usage，按
 *    (provider, model) 累计并进入 estimateCostFromBucketsCny；
 *  - AC-A2：峰谷分桶 + cacheRead 命中价（与主会话同口径）；
 *  - AC-A3：live assistant/chunk.usage 不计费（只认 durable）；不污染 channel.tokens；
 *  - AC-A4：主会话按 event-time 模型分桶（request/header 驱动；无 header 回退
 *    channel 模型），换模型不把历史 token 重估到新模型；
 *  - AC-A6：非官方 provider / 未收录模型只计 token、不计金额（unpriced）；
 *  - 兼容：session-reset 清零、subagent-projection.syncNow 镜像、旧快照
 *    mainCost 缺失时 collectSessionCostEntries 回退 channel.tokens。
 *
 * Run: node --import tsx/esm scripts/verify-session-cost.tsx
 */

const [
  { strict: assert },
  {
    DEEPSEEK_MODEL_PRICES,
    addUsageToCostBuckets,
    cloneCostBuckets,
    collectSessionCostEntries,
    emptyCostBuckets,
    estimateCostFromBucketsCny,
    isPeakHour,
    priceForModel,
  },
  { createInitialChannelView },
  { createChannelProjection },
  { createSubagentProjection },
  { SubagentActivityStore },
  { resetSessionProjection },
] = await Promise.all([
  import('node:assert'),
  import('../src/deepseekPricing.js'),
  import('../src/dsh-adapter/channel/state.js'),
  import('../src/dsh-adapter/channel/projection.js'),
  import('../src/dsh-adapter/channel/subagent-projection.js'),
  import('../src/dsh-adapter/subagents.js'),
  import('../src/dsh-adapter/channel/session-reset.js'),
])

let failures = 0
function check(name: string, condition: boolean, detail = ''): void {
  console.log(`${condition ? 'PASS' : 'FAIL'}: ${name}${detail === '' ? '' : `  (${detail})`}`)
  if (!condition) failures += 1
}

const close = (actual: number, expected: number): boolean => Math.abs(actual - expected) < 1e-9
const noop = (): void => {}

// 北京 = UTC+8。峰：周一 10:00（UTC 02:00）；谷：周一 13:00（UTC 05:00）。
const PEAK = Date.parse('2026-08-17T02:00:00Z')
const IDLE = Date.parse('2026-08-17T05:00:00Z')
const FLASH_PRICE = { inputMiss: [1.0, 2.0], inputHit: [0.02, 0.04], output: [4.0, 8.0] }

/** 一条固定 time 的 durable assistant/message 事件。 */
function durableMessage(seq: number, time: number, usage: Record<string, number>): unknown {
  return {
    type: 'assistant/message',
    seq,
    time,
    data: { turn: 1, step: 1, stream: [], message: { content: [] }, usage },
  }
}

/** 一条固定 time 的 request/header 事件（模型归属真源，replay 时按请求还原）。 */
function requestHeader(seq: number, time: number, model: string): unknown {
  return {
    type: 'request/header',
    seq,
    time,
    data: { header: { config: { provider: 'deepseek', model } }, reason: 'change' },
  }
}

// ═════════════════════ AC-A5：价目表按 #857 更新 ═════════════════════

{
  const flash = priceForModel('deepseek-v4-flash')
  check('AC-A5 priceForModel(v4-flash) = Flash 价', flash !== undefined
    && JSON.stringify(flash) === JSON.stringify(FLASH_PRICE), JSON.stringify(flash))
  const vision = priceForModel('deepseek-v4-flash-vision-exp')
  check('AC-A5 priceForModel(v4-flash-vision-exp) = Flash 价（最长前缀）', vision !== undefined
    && JSON.stringify(vision) === JSON.stringify(FLASH_PRICE), JSON.stringify(vision))
  check('AC-A5 v4-pro 行已移除', priceForModel('deepseek-v4-pro') === undefined
    && !Object.prototype.hasOwnProperty.call(DEEPSEEK_MODEL_PRICES, 'deepseek-v4-pro'))
  check('AC-A5 既有 deepseek-flash 仍为 Flash 价', priceForModel('deepseek-flash') !== undefined
    && JSON.stringify(priceForModel('deepseek-flash')) === JSON.stringify(FLASH_PRICE))
  check('AC-A5 未收录模型不估价', priceForModel('gpt-4o') === undefined)
}

// ═════════════════════ 纯函数：按桶计价 + 分侧 + unpriced ═════════════════════

{
  const buckets = emptyCostBuckets()
  addUsageToCostBuckets(buckets, { input: 1_000_000, output: 0, cacheRead: 0, cacheWrite: 0 }, true)
  const estimate = estimateCostFromBucketsCny([
    { provider: 'deepseek-official', model: 'deepseek-v4-flash', buckets, scope: 'main' },
  ])
  check('estimate 主会话高峰 1M 输入 = ¥2.00', estimate !== undefined
    && close(estimate.total, 2.0) && close(estimate.main, 2.0) && close(estimate.subagent, 0), JSON.stringify(estimate))

  const subBuckets = emptyCostBuckets()
  addUsageToCostBuckets(subBuckets, { input: 500_000, output: 250_000, cacheRead: 100_000, cacheWrite: 50_000 }, false)
  const split = estimateCostFromBucketsCny([
    { provider: 'deepseek-official', model: 'deepseek-v4-flash', buckets, scope: 'main' },
    { provider: 'deepseek-official', model: 'deepseek-flash', buckets: subBuckets, scope: 'subagent' },
  ])
  // 子代理：空闲 (0.5M-0.1M)×1.0 + 0.1M×0.02 + 0.25M×4.0 = 0.4+0.002+1.0 = 1.402
  check('estimate 分侧 main/subagent + 峰谷合计', split !== undefined
    && close(split.main, 2.0) && close(split.subagent, 1.402) && close(split.total, 3.402)
    && close(split.peak, 2.0) && close(split.idle, 1.402), JSON.stringify(split))

  const unpriced = estimateCostFromBucketsCny([
    { provider: 'kimi-coding', model: 'kimi-k2', buckets: emptyCostBuckets0(), scope: 'subagent' },
  ])
  function emptyCostBuckets0() {
    const b = emptyCostBuckets()
    addUsageToCostBuckets(b, { input: 120, output: 30, cacheRead: 0, cacheWrite: 0 }, true)
    return b
  }
  check('AC-A6 仅未计价用量：金额为 0、token 仍上报', unpriced !== undefined
    && close(unpriced.total, 0) && unpriced.unpricedTokens === 150, JSON.stringify(unpriced))
  check('estimate 零 token → undefined', estimateCostFromBucketsCny([]) === undefined)
  check('cloneCostBuckets 深拷贝', (() => {
    const source = emptyCostBuckets()
    addUsageToCostBuckets(source, { input: 7 }, true)
    const copy = cloneCostBuckets(source)
    copy.peak.input = 99
    return source.peak.input === 7 && copy.peak.input === 99
  })())
}

// ═════════════════════ AC-A1/A2：子代理 durable usage 累计与计价 ═════════════════════

{
  const store = new SubagentActivityStore()
  store.onSpawned('child-a', 'deepseek-official', 'deepseek-v4-flash')
  store.onSessionEvent('child-a', durableMessage(1, PEAK, { inputTokens: 1_000_000, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 }))
  const snapshot = store.costSnapshot()
  check('AC-A1 子代理 durable usage 进入按模型桶', snapshot.entries.length === 1
    && snapshot.entries[0]?.provider === 'deepseek-official'
    && snapshot.entries[0]?.model === 'deepseek-v4-flash'
    && snapshot.entries[0]?.buckets.peak.input === 1_000_000, JSON.stringify(snapshot.entries))
  const estimate = estimateCostFromBucketsCny(snapshot.entries.map(entry => ({ ...entry, scope: 'subagent' as const })))
  check('AC-A1 子代理按其自身模型计价 = ¥2.00', estimate !== undefined
    && close(estimate.total, 2.0) && close(estimate.subagent, 2.0), JSON.stringify(estimate))
}

{
  const store = new SubagentActivityStore()
  store.onSpawned('child-b', 'deepseek-official', 'deepseek-v4-flash')
  store.onSessionEvent('child-b', durableMessage(1, IDLE, { inputTokens: 1_000_000, outputTokens: 500_000, cacheReadTokens: 800_000, cacheWriteTokens: 100_000 }))
  store.onSessionEvent('child-b', durableMessage(2, PEAK, { inputTokens: 0, outputTokens: 250_000, cacheReadTokens: 0, cacheWriteTokens: 0 }))
  const entry = store.costSnapshot().entries[0]
  check('AC-A2 跨时段分桶：peak.idle 各归其位', entry?.buckets.peak.output === 250_000
    && entry?.buckets.idle.input === 1_000_000 && entry?.buckets.idle.cacheRead === 800_000
    && entry?.buckets.idle.output === 500_000, JSON.stringify(entry?.buckets))
  const estimate = estimateCostFromBucketsCny(entry === undefined ? [] : [{ ...entry, scope: 'subagent' as const }])
  // 谷：(1M−0.8M)×1.0 + 0.8M×0.02 + 0.5M×4.0 = 2.216；峰：0.25M×8.0 = 2.0
  check('AC-A2 cacheRead 按命中价、跨时段分价 = ¥4.216', estimate !== undefined
    && close(estimate.total, 4.216) && close(estimate.peak, 2.0) && close(estimate.idle, 2.216), JSON.stringify(estimate))
  check('AC-A2 isPeakHour 判定与分桶一致', isPeakHour(new Date(PEAK)) && !isPeakHour(new Date(IDLE)))
}

// ═════════════════════ AC-A3：durable 去重、token 语义不被污染 ═════════════════════

{
  const store = new SubagentActivityStore()
  store.onSpawned('child-live', 'deepseek-official', 'deepseek-v4-flash')
  store.onSessionEvent('child-live', durableMessage(1, PEAK, { inputTokens: 100, outputTokens: 50, cacheReadTokens: 0, cacheWriteTokens: 0 }))
  const before = store.costSnapshot()
  // live chunk usage 只更新展示 token，不计费（否则同回合双计）。
  store.onSessionEvent('child-live', {
    type: 'assistant/chunk',
    seq: 2,
    time: PEAK,
    data: { chunk: { type: 'usage', usage: { inputTokens: 999_999, outputTokens: 999_999 } } },
  })
  const after = store.costSnapshot()
  check('AC-A3 live assistant/chunk.usage 不计费', after.entries[0]?.buckets.peak.input === before.entries[0]?.buckets.peak.input
    && after.entries[0]?.buckets.peak.output === before.entries[0]?.buckets.peak.output, JSON.stringify(after.entries))
  check('AC-A3 durable usage 只计一次', after.entries[0]?.buckets.peak.input === 100
    && after.entries[0]?.buckets.peak.output === 50, JSON.stringify(after.entries))
  check('AC-A3 reset 清空费用累计', (() => {
    store.reset()
    const cleared = store.costSnapshot()
    return cleared.entries.length === 0 && cleared.unpriced.peak.input === 0
  })())
}

// ═════════════════════ AC-A4：主会话按模型分桶（换模型不重估） ═════════════════════

{
  const state = {
    ...createInitialChannelView({ model: 'deepseek-v4-flash', provider: 'deepseek', cwd: '/tmp' }, {
      agentId: 'agent', sessionId: 'session', mode: { id: 'default', name: 'Default' } as never, cwdDescription: '/tmp',
    }),
    emit: noop,
  }
  const projector = createChannelProjection(state, {
    agent: () => ({}) as never,
    rowIds: { value: 0 },
    resetContextWarning: noop,
    pendingTaskDescriptions: [],
    jobs: { onOutputSeen: noop, onStarted: noop },
    inputConvergence: { cancelInFlight: false },
    checkContextWarning: noop,
    notify: noop,
    attachments: noop,
  })
  projector.renderEvent(requestHeader(1, PEAK, 'deepseek-flash') as never)
  projector.renderEvent(durableMessage(2, PEAK, { inputTokens: 1_000_000, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 }) as never)
  projector.renderEvent(requestHeader(3, IDLE, 'deepseek-v4-flash') as never)
  projector.renderEvent(durableMessage(4, IDLE, { inputTokens: 0, outputTokens: 500_000, cacheReadTokens: 0, cacheWriteTokens: 0 }) as never)
  const models = Object.keys(state.mainCost).sort()
  check('AC-A4 主会话按 event-time 模型分桶（两个模型桶）', models.length === 2
    && models[0] === 'deepseek-flash' && models[1] === 'deepseek-v4-flash', JSON.stringify(models))
  check('AC-A4 历史 token 留在原模型桶', state.mainCost['deepseek-flash']?.peak.input === 1_000_000
    && state.mainCost['deepseek-v4-flash']?.idle.output === 500_000, JSON.stringify(state.mainCost))
  const estimate = estimateCostFromBucketsCny(collectSessionCostEntries({
    provider: state.provider,
    main: state.mainCost,
    subagents: state.subagentCost,
  }))
  check('AC-A4 各模型按各自单价求和 = ¥4.00', estimate !== undefined
    && close(estimate.total, 4.0) && close(estimate.main, 4.0), JSON.stringify(estimate))
  check('AC-A3/A4 channel.tokens 既有累计语义不变', state.tokens.input === 1_000_000 && state.tokens.output === 500_000
    && state.tokens.peak.input === 1_000_000 && state.tokens.idle.output === 500_000, JSON.stringify(state.tokens))
}

{
  // 无 request/header 的旧日志/测试桩：回退事件发生时 channel 模型。
  const state = {
    ...createInitialChannelView({ model: 'deepseek-v4-flash', provider: 'deepseek', cwd: '/tmp' }, {
      agentId: 'agent', sessionId: 'session', mode: { id: 'default', name: 'Default' } as never, cwdDescription: '/tmp',
    }),
    emit: noop,
  }
  const projector = createChannelProjection(state, {
    agent: () => ({}) as never, rowIds: { value: 0 }, resetContextWarning: noop, pendingTaskDescriptions: [],
    jobs: { onOutputSeen: noop, onStarted: noop }, inputConvergence: { cancelInFlight: false },
    checkContextWarning: noop, notify: noop, attachments: noop,
  })
  projector.renderEvent(durableMessage(1, PEAK, { inputTokens: 200, outputTokens: 100, cacheReadTokens: 0, cacheWriteTokens: 0 }) as never)
  check('AC-A4 无 header 回退 channel 模型', state.mainCost['deepseek-v4-flash']?.peak.input === 200
    && state.mainCost['deepseek-v4-flash']?.peak.output === 100, JSON.stringify(state.mainCost))
  projector.renderEvent(durableMessage(2, IDLE, { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 }) as never)
  check('AC-A4 零 usage 不建桶', Object.keys(state.mainCost).length === 1)
}

// ═════════════════════ AC-A6：非官方 / 未收录 = unpriced ═════════════════════

{
  const store = new SubagentActivityStore()
  store.onSpawned('child-official', 'deepseek-official', 'deepseek-v4-flash')
  store.onSessionEvent('child-official', durableMessage(1, PEAK, { inputTokens: 1_000_000, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 }))
  store.onSpawned('child-third-party', 'kimi-coding', 'kimi-k2')
  store.onSessionEvent('child-third-party', durableMessage(1, PEAK, { inputTokens: 500, outputTokens: 100, cacheReadTokens: 0, cacheWriteTokens: 0 }))
  store.onSpawned('child-unlisted', 'deepseek-official', 'deepseek-v4-pro')
  store.onSessionEvent('child-unlisted', durableMessage(1, PEAK, { inputTokens: 300, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 }))
  const snapshot = store.costSnapshot()
  check('AC-A6 非官方与未收录各自成桶', snapshot.entries.length === 3, JSON.stringify(snapshot.entries))
  check('AC-A6 未计价桶累计第三方/未收录用量', snapshot.unpriced.peak.input === 800)
  const estimate = estimateCostFromBucketsCny(snapshot.entries.map(entry => ({ ...entry, scope: 'subagent' as const })))
  check('AC-A6 金额排除未计价、token 仍上报', estimate !== undefined
    && close(estimate.total, 2.0) && close(estimate.subagent, 2.0) && estimate.unpricedTokens === 900,
  JSON.stringify(estimate))
}

// ═════════════════════ 兼容：collect 回退 + session-reset + 投影镜像 ═════════════════════

{
  const fallback = emptyCostBuckets()
  addUsageToCostBuckets(fallback, { input: 1_000_000 }, true)
  const entries = collectSessionCostEntries({
    provider: 'deepseek',
    main: {},
    subagents: [],
    fallbackTokens: fallback,
    fallbackModel: 'deepseek-flash',
  })
  check('collect 旧快照回退 channel.tokens + 当前模型', entries.length === 1
    && entries[0]?.scope === 'main' && entries[0]?.model === 'deepseek-flash'
    && close(estimateCostFromBucketsCny(entries)?.total ?? -1, 2.0), JSON.stringify(entries))

  const mainBuckets = emptyCostBuckets()
  addUsageToCostBuckets(mainBuckets, { input: 100_000 }, false)
  const withMain = collectSessionCostEntries({
    provider: 'deepseek',
    main: { 'deepseek-v4-flash': mainBuckets },
    subagents: [{ provider: 'deepseek-official', model: 'deepseek-flash', buckets: emptyCostBuckets() }],
    fallbackTokens: fallback,
    fallbackModel: 'deepseek-flash',
  })
  check('collect mainCost 非空时不叠加 fallback（免双计）', withMain.length === 2
    && withMain[0]?.scope === 'main' && withMain[1]?.scope === 'subagent', JSON.stringify(withMain))
}

{
  const state = {
    ...createInitialChannelView({ model: 'deepseek-v4-flash', provider: 'deepseek', cwd: '/tmp' }, {
      agentId: 'agent', sessionId: 'session', mode: { id: 'default', name: 'Default' } as never, cwdDescription: '/tmp',
    }),
  }
  const seed = emptyCostBuckets()
  addUsageToCostBuckets(seed, { input: 10 }, true)
  state.mainCost = { 'deepseek-v4-flash': seed }
  state.subagentCost = [{ provider: 'deepseek-official', model: 'deepseek-flash', buckets: emptyCostBuckets() }]
  resetSessionProjection(state, { value: 3 }, noop, noop, noop)
  check('session-reset 清零 mainCost/subagentCost', Object.keys(state.mainCost).length === 0
    && state.subagentCost.length === 0 && state.tokens.input === 0, JSON.stringify({ main: state.mainCost, sub: state.subagentCost }))
}

{
  const state = { rows: [] as unknown[], subagents: [] as unknown[], subagentCost: [] as unknown[], emit: noop, emitStream: noop }
  const projection = createSubagentProjection(() => state as never, {
    rowIds: { value: 0 },
    agent: () => ({}) as never,
    subagents: () => undefined,
    lookupChild: () => undefined,
  })
  projection.onStart({ id: 'child-mirror', provider: 'deepseek-official' })
  projection.store.patch('child-mirror', { model: 'deepseek-v4-flash' })
  projection.store.onSessionEvent('child-mirror', durableMessage(1, PEAK, { inputTokens: 42, outputTokens: 7, cacheReadTokens: 0, cacheWriteTokens: 0 }))
  projection.syncNow()
  const mirror = state.subagentCost as Array<{ provider: string; model: string; buckets: { peak: { input: number; output: number } } }>
  check('subagent-projection.syncNow 镜像 store 费用快照', mirror.length === 1
    && mirror[0]?.provider === 'deepseek-official' && mirror[0]?.model === 'deepseek-v4-flash'
    && mirror[0]?.buckets.peak.input === 42 && mirror[0]?.buckets.peak.output === 7, JSON.stringify(mirror))
  projection.reset()
  check('subagent-projection.reset 清空镜像', (state.subagentCost as unknown[]).length === 0)
}

if (failures > 0) {
  console.error(`\n${failures} failure(s)`)
  process.exit(1)
}
console.log('\nAll session-cost checks passed')
