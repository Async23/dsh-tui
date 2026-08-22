/**
 * verify-sticky-anchor — 置顶 prompt 头跟随视口（“翻到哪条置顶哪条”）。
 *
 * 用户报告：滚动到倒数第二条消息时，置顶头仍显示最后一条消息。修复后
 * StickyPromptHeader 钉住视口正在显示的那条 user 消息（视口内最靠上的
 * user 行；视口内只有 assistant 内容时取视口上方最近的 user 行），不再
 * 固定取 `channel.lastUserText`。
 *
 * 断言（全屏 headless xterm，100×40）：
 *   1. 初始钉底：无置顶头（第 0 行不以 ❯ 开头）；
 *   2. 滚轮上滚后：置顶头出现，且 = 视口内最靠上的可见 user 消息；
 *   3. 继续上滚：置顶头跟随变化，且永不为屏幕上看不到的“最后一条”；
 *   4. 逐格下滚：每步置顶头都与视口顶可见 user 消息一致；
 *   5. 点击置顶头：被钉消息跳到视口顶部（转译区首行附近出现该消息）；
 *   6. 滚回底部：重新钉底，置顶头消失。
 *
 * 运行：node --import tsx/esm scripts/verify-sticky-anchor.tsx
 */
process.env.FORCE_COLOR = '3'
process.env.DSH_TUI_THEME = 'dark'
process.env.DSH_TUI_LANG = 'zh'

const [{ PassThrough, Writable }, React, { Terminal: XTerm }, { render, AlternateScreen }, { Chat }, { QuestionStore }, { LOCAL_COMMANDS, completeCommands }] = await Promise.all([
  import('node:stream'),
  import('react'),
  import('@xterm/headless'),
  import('../src/ui.js'),
  import('../src/screens/Chat.js'),
  import('../src/dsh-adapter/questions.js'),
  import('../src/commands.js'),
])

const COLS = 100, ROWS = 40
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let failed = 0
function check(name: string, ok: boolean, extra = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${extra ? `  (${extra})` : ''}`)
  if (!ok) failed += 1
}

const term = new XTerm({ cols: COLS, rows: ROWS, scrollback: 0, allowProposedApi: true })
const writes: string[] = []
class FakeStdout extends Writable {
  columns = COLS; rows = ROWS; isTTY = true
  _write(chunk: unknown, _e: BufferEncoding, cb: () => void) {
    writes.push(String(chunk))
    term.write(String(chunk), cb)
  }
}
class FakeStderr extends Writable { isTTY = true; _write(_c: unknown, _e: BufferEncoding, cb: () => void) { cb() } }
class FakeStdin extends PassThrough {
  isTTY = true
  setRawMode() { return this }
  ref() { return this }
  unref() { return this }
}
const stdin = new FakeStdin(), stdout = new FakeStdout(), stderr = new FakeStderr()

// 8 轮对话：user 消息各 1 行（问题 1..8），assistant 回复各 8 行。
// 内容总高 ≈ 14（LogoHeader）+ 8×9 = 86 行 ≫ 视口，可滚动。
const rows: any[] = []
for (let turn = 1; turn <= 8; turn++) {
  rows.push({ id: turn * 2 - 1, kind: 'user', text: `问题 ${turn}` })
  rows.push({
    id: turn * 2,
    kind: 'assistant',
    text: Array.from({ length: 8 }, (_, i) => `回复 ${turn} 第 ${i + 1} 行`).join('\n'),
  })
}

const listeners = new Set<() => void>()
const channel: any = {
  version: 0,
  rows,
  status: 'idle',
  sessionTitle: 'probe',
  agentId: 'probe',
  model: 'deepseek-v4-flash',
  provider: 'deepseek',
  reasoningEffort: 'max',
  effortLevels: [],
  tokens: { input: 0, output: 0 },
  cwd: '/tmp/demo',
  displayCwd: '/tmp/demo',
  gitBranch: 'main',
  working: false,
  spinnerMode: 'requesting',
  responseChars: 0,
  activeToolCount: 0,
  turnStart: 0,
  pending: [],
  commandList: LOCAL_COMMANDS,
  notifications: [],
  mode: { plan: false, sandbox: undefined },
  activityFrames: 'claude',
  agentPreset: undefined,
  subagents: [],
  // 故意的“错误真源”：修复前置顶头读它 → 永远显示问题 8；修复后必须
  // 不再使用它（断言 3 专门抓这一点）。
  lastUserText: '问题 8',
  subscribe(cb: () => void) { listeners.add(cb); return () => listeners.delete(cb) },
  submit: () => {},
  cancel: () => {},
  clear: () => {},
  notify: () => {},
  listModels: () => Promise.resolve([]),
  listSessions: () => Promise.resolve([]),
  deleteSession: () => Promise.resolve(true),
  renameSessionTo: () => Promise.resolve(true),
  setResumeTarget: () => {},
  loadOlder: () => {},
  mcpStatus: () => [],
  pushLocal: () => {},
  commandCompletions: (input: string) => completeCommands(input),
}

const inst = await render(
  <AlternateScreen>
    <Chat channel={channel} questionStore={new QuestionStore()} fullscreen />
  </AlternateScreen>,
  { stdout: stdout as any, stdin: stdin as any, stderr: stderr as any, exitOnCtrlC: false, patchConsole: false },
)
await sleep(700)

function screenLines(): string[] {
  const buf = term.buffer.active
  return Array.from({ length: ROWS }, (_, y) => buf.getLine(buf.baseY + y)?.translateToString(true) ?? '')
}
/** 置顶头文本（第 0 行），无头时返回 null。 */
function headerText(): string | null {
  const line0 = screenLines()[0]!.trimEnd()
  return /^❯/.test(line0) ? line0 : null
}
/** 视口内最靠上的可见 user 消息编号（从转译区第 1 行扫起，跳过置顶头）。 */
function topVisibleUser(): number | null {
  for (let y = 1; y < ROWS; y++) {
    const m = screenLines()[y]!.match(/问题 (\d+)/)
    if (m) return Number(m[1])
  }
  return null
}
const wheel = async (up: boolean, times: number) => {
  for (let i = 0; i < times; i++) {
    stdin.write(`\x1b[<${up ? 64 : 65};50;30M`)
    await sleep(180)
  }
}
const clickHeader = async () => {
  stdin.write('\x1b[<0;5;1M')
  stdin.write('\x1b[<0;5;1m')
  await sleep(400)
}
/** 断言置顶头 = 视口顶可见 user 消息，且不是最后一条（问题 8 不在顶上时）。 */
function assertHeaderFollowsViewport(label: string): void {
  const top = topVisibleUser()
  const header = headerText()
  if (top === null) {
    check(`${label}: 视口内无 user 消息 → 置顶头隐藏`, header === null, `header=${JSON.stringify(header)}`)
    return
  }
  check(`${label}: 置顶头存在`, header !== null, `header=${JSON.stringify(header)}`)
  check(`${label}: 置顶头 = 视口顶消息 问题 ${top}`, header?.includes(`问题 ${top}`) === true, `header=${JSON.stringify(header)}`)
  if (top !== 8) {
    check(`${label}: 置顶头 ≠ 最后一条消息`, header?.includes('问题 8') === false, `header=${JSON.stringify(header)}`)
  }
}

// ── 1. 初始钉底：无置顶头，末尾消息可见 ──
check('初始钉底无置顶头', headerText() === null, `line0=${JSON.stringify(screenLines()[0]!.trimEnd().slice(0, 20))}`)
check('初始末尾消息可见', screenLines().some(l => l.includes('问题 8')))

// ── 2/3. 上滚：置顶头出现并跟随视口 ──
await wheel(true, 4)   // -12 行
assertHeaderFollowsViewport('上滚 4 格后')
await wheel(true, 8)   // 再 -24 行（累计 -36）
assertHeaderFollowsViewport('上滚 12 格后')

// ── 4. 逐格下滚回读：每步都跟随 ──
let seenAny = false
for (let step = 1; step <= 14; step++) {
  await wheel(false, 1)
  const top = topVisibleUser()
  const header = headerText()
  if (top !== null && header !== null) {
    seenAny = true
    check(`下滚第 ${step} 格: 置顶头 = 视口顶 问题 ${top}`, header.includes(`问题 ${top}`), `header=${JSON.stringify(header)}`)
    if (top !== 8) check(`下滚第 ${step} 格: ≠ 最后一条`, !header.includes('问题 8'), `header=${JSON.stringify(header)}`)
  }
}
check('下滚过程中至少观察到一次置顶头跟随', seenAny)

// ── 5. 点击置顶头：被钉消息跳到视口顶 ──
{
  // 先上滚 3 格：点击的 seek 会把被钉消息对齐到视口顶，若该位置恰好是
  // 内容底部，渲染器会按既定规则重新钉底（sticky → 置顶头合法消失，
  // 见 render-node-to-output 的 sticky-restore）——那不是本测试要覆盖的
  // 场景，避开它。
  await wheel(true, 3)
  const top = topVisibleUser()
  const header = headerText()
  if (top !== null && header !== null) {
    const before = screenLines().slice(1, 6).map(l => l.trimEnd())
    await clickHeader()
    const after = screenLines().slice(1, 6).map(l => l.trimEnd())
    check('点击后: 置顶头仍显示原消息', headerText()?.includes(`问题 ${top}`) === true,
      `header=${JSON.stringify(headerText())}`)
    check('点击后: 原消息跳到转译区顶部', after[0]?.includes(`问题 ${top}`) || after[1]?.includes(`问题 ${top}`) || after[2]?.includes(`问题 ${top}`),
      `before=${JSON.stringify(before[0])} after=${JSON.stringify(after[0])}`)
  } else {
    check('点击测试跳过（需要置顶头可见）', false, `top=${top} header=${JSON.stringify(header)}`)
  }
}

// ── 6. 滚回底部：重新钉底，置顶头消失 ──
await wheel(false, 30)
const headerAfterBottom = headerText()
check('滚回底部后置顶头消失', headerAfterBottom === null, `line0=${JSON.stringify(screenLines()[0]!.trimEnd().slice(0, 20))}`)
check('滚回底部后末尾消息可见', screenLines().some(l => l.includes('问题 8')))

await inst.unmount()
console.log(failed === 0 ? '\nALL PASS' : `\n${failed} 项失败`)
process.exit(failed === 0 ? 0 : 1)
