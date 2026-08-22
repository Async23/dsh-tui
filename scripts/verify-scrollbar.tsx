/**
 * verify-scrollbar — 全屏转录区 1 列迷你滚动条：消息节点 + 当前消息高亮 +
 * 点击跳转。
 *
 * 断言（headless xterm 100×40，全屏 Chat，8 轮对话）：
 *   1. 初始钉底：右侧出现滚动条——恰 8 个消息节点（·/●）+ 滑块（█）贴底，
 *      高亮 ● 在最末节点（= 当前轮 问题 8）；
 *   2. 滚轮上滚：● 移到视口顶可见的 user 消息对应节点（第 k 个节点 ↔
 *      问题 k），且全条唯一；
 *   3. 点击第 2 个节点（问题 2）：转译区顶部出现问题 2，● 跳到该节点；
 *   4. 点击轨道顶部：滚到顶，问题 1 可见；
 *   5. 滚回底部：● 回到最末节点，滑块贴底。
 *
 * 运行：node --import tsx/esm scripts/verify-scrollbar.tsx
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
function cellAt(y: number, col: number): string {
  const buf = term.buffer.active
  return buf.getLine(buf.baseY + y)?.getCell(col)?.getChars() ?? ''
}
/** 置顶头可见？(第 0 行以 ❯ 开头) */
function headerVisible(): boolean {
  return /^❯/.test(screenLines()[0]!.trimEnd())
}
/** 滚动条区域：置顶头之下、prompt 输入框 margin 之上。返回 [top, bottom)。 */
function barRange(): [number, number] {
  const lines = screenLines()
  const top = headerVisible() ? 1 : 0
  let promptRow = -1
  for (let y = ROWS - 1; y >= 0; y--) {
    if (lines[y]!.trimStart().startsWith('❯')) { promptRow = y; break }
  }
  // prompt 输入框上方有 1 行 margin（空白），其上是滚动条末行。
  return [top, promptRow >= 0 ? promptRow - 2 : ROWS - 4]
}
/** 滚动条快照：{ nodes: 各节点屏幕行(按内容序), anchorRow: ● 所在行, thumbs: █ 行集合 } */
function barSnapshot(): { nodes: number[]; anchorRow: number | null; thumbs: number[] } {
  const [top, bottom] = barRange()
  const nodes: number[] = []
  let anchorRow: number | null = null
  const thumbs: number[] = []
  for (let y = top; y < bottom; y++) {
    const c = cellAt(y, COLS - 1)
    if (c === '·' || c === '●') {
      nodes.push(y)
      if (c === '●') anchorRow = y
    } else if (c === '█') {
      thumbs.push(y)
    }
  }
  return { nodes, anchorRow, thumbs }
}
/** 视口内最靠上的可见 user 消息编号。 */
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
const clickAt = async (col: number, row: number) => {
  stdin.write(`\x1b[<0;${col};${row}M`)
  stdin.write(`\x1b[<0;${col};${row}m`)
  await sleep(400)
}

// ── 1. 初始钉底：滚动条出现，8 节点，● 在最末节点，滑块贴底 ──
{
  const snap = barSnapshot()
  check('滚动条存在（有节点或滑块）', snap.nodes.length > 0 || snap.thumbs.length > 0,
    `nodes=${snap.nodes.length} thumbs=${snap.thumbs.length}`)
  check('恰 8 个消息节点', snap.nodes.length === 8, `nodes=${snap.nodes.length}`)
  check('恰一个高亮 ●', snap.anchorRow !== null &&
    snap.nodes.filter((_, i) => snap.nodes[i] === snap.anchorRow).length === 1 &&
    snap.nodes.filter(y => y === snap.anchorRow).length === 1,
    `anchor=${snap.anchorRow} nodes=${JSON.stringify(snap.nodes)}`)
  check('● 在最末节点（钉底=当前轮 问题 8）', snap.anchorRow === snap.nodes[snap.nodes.length - 1],
    `anchor=${snap.anchorRow} last=${snap.nodes[snap.nodes.length - 1]}`)
  const [top, bottom] = barRange()
  check('滑块贴底（末行是 █）', bottom > top && cellAt(bottom - 1, COLS - 1) === '█',
    `bottom=${bottom} cell=${JSON.stringify(cellAt(bottom - 1, COLS - 1))}`)
}

// ── 2. 上滚 4 格：● 移到视口顶 user 消息对应节点 ──
await wheel(true, 4)
{
  const snap = barSnapshot()
  const top = topVisibleUser()
  check('上滚后仍恰 8 节点', snap.nodes.length === 8, `nodes=${snap.nodes.length}`)
  check('上滚后恰一个 ●', snap.anchorRow !== null && snap.nodes.filter(y => y === snap.anchorRow).length === 1,
    `anchor=${snap.anchorRow}`)
  check('● 移离最末节点', snap.anchorRow !== snap.nodes[snap.nodes.length - 1],
    `anchor=${snap.anchorRow} last=${snap.nodes[snap.nodes.length - 1]}`)
  if (top !== null && snap.anchorRow !== null) {
    const k = snap.nodes.indexOf(snap.anchorRow)
    check('● 节点 = 视口顶 user 消息', k + 1 === top, `node#${k + 1} vs 问题 ${top}`)
  } else {
    check('上滚后 ● 对应视口顶消息', false, `top=${top} anchor=${snap.anchorRow}`)
  }
  check('滑块仍在（█ 存在）', snap.thumbs.length > 0, `thumbs=${snap.thumbs.length}`)
}

// ── 3. 点击第 2 个节点（问题 2）→ 跳转 ──
{
  const snap = barSnapshot()
  const nodeRow = snap.nodes[1]
  check('第 2 个节点存在', nodeRow !== undefined, `nodes=${JSON.stringify(snap.nodes)}`)
  if (nodeRow !== undefined) {
    await clickAt(COLS, nodeRow + 1) // SGR 行号 1-based
    await sleep(250)
    const lines = screenLines()
    check('点击节点后问题 2 跳到转译区顶部', lines.slice(1, 5).some(l => l.includes('问题 2')),
      `top3=${JSON.stringify(lines.slice(1, 4).map(l => l.trimEnd()))}`)
    const snap2 = barSnapshot()
    check('点击后 ● 移到该节点', snap2.anchorRow === nodeRow,
      `anchor=${snap2.anchorRow} expected=${nodeRow}`)
  }
}

// ── 4. 点击轨道顶部 → 滚到顶 ──
{
  const [top] = barRange()
  await clickAt(COLS, top + 1)
  await sleep(250)
  const lines = screenLines()
  check('点击轨道顶部后问题 1 可见', lines.slice(1, 24).some(l => l.includes('问题 1')),
    `top3=${JSON.stringify(lines.slice(1, 4).map(l => l.trimEnd()))}`)
}

// ── 5. 滚回底部：● 回最末节点，滑块贴底 ──
await wheel(false, 30)
{
  const snap = barSnapshot()
  const [top, bottom] = barRange()
  check('滚回底部后 ● 回到最末节点', snap.anchorRow === snap.nodes[snap.nodes.length - 1],
    `anchor=${snap.anchorRow} last=${snap.nodes[snap.nodes.length - 1]}`)
  check('滚回底部后滑块贴底', bottom > top && cellAt(bottom - 1, COLS - 1) === '█',
    `cell=${JSON.stringify(cellAt(bottom - 1, COLS - 1))}`)
}

await inst.unmount()
console.log(failed === 0 ? '\nALL PASS' : `\n${failed} 项失败`)
process.exit(failed === 0 ? 0 : 1)
