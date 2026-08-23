/**
 * verify-back-to-bottom — 一键回底：pill 常驻化 + End/Enter 键。
 *
 * 断言（headless xterm 100×40，全屏 Chat，8 轮对话）：
 *   1. 钉底：无 pill；
 *   2. 上滚：pill 出现「↓ 回到底部」；再流入新消息（追加 1 轮）→
 *      pill 切「↓ N 条新消息」；
 *   3. 按 End：回底（末轮可见、pill 消失）；
 *   4. 再上滚：pill 出现；按 Enter：回底（pill 消失）；
 *   5. 再上滚：点击 pill：回底；
 *   6. 钉底按 End：无操作（末轮仍可见，不崩）。
 *
 * 运行：node --import tsx/esm scripts/verify-back-to-bottom.tsx
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
class FakeStdout extends Writable {
  columns = COLS; rows = ROWS; isTTY = true
  _write(chunk: unknown, _e: BufferEncoding, cb: () => void) { term.write(String(chunk), cb) }
}
class FakeStderr extends Writable { isTTY = true; _write(_c: unknown, _e: BufferEncoding, cb: () => void) { cb() } }
class FakeStdin extends PassThrough {
  isTTY = true
  setRawMode() { return this }
  ref() { return this }
  unref() { return this }
}
const stdin = new FakeStdin(), stdout = new FakeStdout(), stderr = new FakeStderr()

const rows: any[] = []
for (let turn = 1; turn <= 8; turn++) {
  rows.push({ id: turn * 2 - 1, kind: 'user', text: `问题 ${turn}` })
  rows.push({ id: turn * 2, kind: 'assistant', text: Array.from({ length: 8 }, (_, i) => `回复 ${turn} 第 ${i + 1} 行`).join('\n') })
}
const listeners = new Set<() => void>()
const channel: any = {
  version: 0, rows, status: 'idle', sessionTitle: 'probe', agentId: 'probe',
  model: 'deepseek-v4-flash', provider: 'deepseek', reasoningEffort: 'max', effortLevels: [],
  tokens: { input: 0, output: 0 }, cwd: '/tmp/demo', displayCwd: '/tmp/demo', gitBranch: 'main',
  working: false, spinnerMode: 'requesting', responseChars: 0, activeToolCount: 0, turnStart: 0,
  pending: [], commandList: LOCAL_COMMANDS, notifications: [], mode: { plan: false, sandbox: undefined },
  activityFrames: 'claude', agentPreset: undefined, subagents: [], lastUserText: '问题 8',
  scrollGutter: 'timeline',
  subscribe(cb: () => void) { listeners.add(cb); return () => listeners.delete(cb) },
  submit: () => {}, cancel: () => {}, clear: () => {}, notify: () => {},
  listModels: () => Promise.resolve([]), listSessions: () => Promise.resolve([]),
  deleteSession: () => Promise.resolve(true), renameSessionTo: () => Promise.resolve(true),
  setResumeTarget: () => {}, loadOlder: () => {}, mcpStatus: () => [], pushLocal: () => {},
  commandCompletions: (input: string) => completeCommands(input),
}
const emitChannel = () => { channel.version++; for (const l of listeners) l() }

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
/** pill 行文本（含 ↓ 的左缘行），无则 null。 */
function pillText(): string | null {
  for (const l of screenLines()) {
    if (/↓/.test(l)) return l.trim()
  }
  return null
}
const lastTurnVisible = () => screenLines().some(l => l.includes('问题 8'))
const wheel = async (up: boolean, times: number) => {
  for (let i = 0; i < times; i++) {
    stdin.write(`\x1b[<${up ? 64 : 65};90;30M`)
    await sleep(150)
  }
}
const pressKey = async (name: string) => {
  const seqs: Record<string, string> = {
    end: '\x1b[F',
    enter: '\r',
  }
  stdin.write(seqs[name]!)
  await sleep(400)
}

// ── 1. 钉底：无 pill ──
check('钉底无 pill', pillText() === null, `pill=${JSON.stringify(pillText())}`)

// ── 2. 上滚：常驻 pill；流入新消息后切计数 ──
await wheel(true, 6)
{
  const p = pillText()
  check('上滚后 pill 出现（回到底部）', p !== null && p.includes('回到底部'), `pill=${JSON.stringify(p)}`)
}
// 追加一轮新消息（模拟流式落定）
rows.push({ id: 17, kind: 'user', text: '问题 9' })
rows.push({ id: 18, kind: 'assistant', text: '回复 9 第 1 行\n回复 9 第 2 行' })
emitChannel()
await sleep(500)
{
  const p = pillText()
  check('新消息后 pill 切计数', p !== null && /2 条新消息/.test(p), `pill=${JSON.stringify(p)}`)
}

// ── 3. End 键回底 ──
await pressKey('end')
{
  check('End 后回到底部（末轮可见）', lastTurnVisible())
  check('End 后 pill 消失', pillText() === null, `pill=${JSON.stringify(pillText())}`)
}

// ── 4. 上滚后 Enter 回底 ──
await wheel(true, 8)
{
  check('再次上滚 pill 重现', pillText() !== null, `pill=${JSON.stringify(pillText())}`)
}
await pressKey('enter')
{
  check('Enter 后回到底部', lastTurnVisible() && pillText() === null,
    `last=${lastTurnVisible()} pill=${JSON.stringify(pillText())}`)
}

// ── 5. 点击 pill 回底 ──
await wheel(true, 8)
{
  const lines = screenLines()
  let pillRow = -1, pillCol = -1
  for (let y = 0; y < ROWS && pillRow === -1; y++) {
    const l = lines[y]!
    const x = l.indexOf('↓')
    if (x >= 0) { pillRow = y; pillCol = x }
  }
  check('点击前 pill 可见', pillRow !== -1, `row=${pillRow}`)
  if (pillRow !== -1) {
    stdin.write(`\x1b[<0;${pillCol + 2};${pillRow + 1}M`)
    stdin.write(`\x1b[<0;${pillCol + 2};${pillRow + 1}m`)
    await sleep(500)
    check('点击 pill 后回到底部', lastTurnVisible() && pillText() === null,
      `last=${lastTurnVisible()} pill=${JSON.stringify(pillText())}`)
  }
}

// ── 6. 钉底按 End：无操作不崩 ──
await pressKey('end')
{
  check('钉底按 End 无操作', lastTurnVisible() && pillText() === null)
}

await inst.unmount()
console.log(failed === 0 ? '\nALL PASS' : `\n${failed} 项失败`)
process.exit(failed === 0 ? 0 : 1)
