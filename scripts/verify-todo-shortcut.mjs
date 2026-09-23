/**
 * Todo shortcut regression through the real Chat input and rendered hints.
 * Run after build: node scripts/verify-todo-shortcut.mjs
 * Also run with DSH_TEST_FULLSCREEN=0 DSH_TEST_COLUMNS=60 for narrow inline UI.
 */
import '../lib/types/force-production-react.js'
import assert from 'node:assert/strict'
import { PassThrough, Writable } from 'node:stream'
import React from 'react'
import xterm from '@xterm/headless'
import { render, AlternateScreen } from '../lib/types/ui.js'
import { Chat } from '../lib/types/screens/Chat.js'
import { QuestionStore } from '../lib/types/dsh-adapter/questions.js'
import { createInitialChannelView } from '../lib/types/dsh-adapter/channel/state.js'
import { setLang } from '../lib/types/i18n.js'
import { actionMatches, resetKeymapOverrides, setKeymapOverrides } from '../lib/types/utils/keymap.js'
import { settled, viewportLines } from './lib/term-test.mjs'

const columns = Number(process.env.DSH_TEST_COLUMNS ?? 120)
const fullscreen = process.env.DSH_TEST_FULLSCREEN !== '0'
let checks = 0

for (const lang of ['en', 'zh']) {
  resetKeymapOverrides()
  setLang(lang)
  const term = new xterm.Terminal({ cols: columns, rows: 45, scrollback: 100, allowProposedApi: true })
  const stdout = new Writable({ write(chunk, _encoding, done) { term.write(String(chunk), done) } })
  Object.assign(stdout, { columns, rows: 45, isTTY: true })
  const stderr = new Writable({ write(_chunk, _encoding, done) { done() } })
  stderr.isTTY = true
  const stdin = new PassThrough()
  Object.assign(stdin, { isTTY: true, setRawMode() { return this }, ref() { return this }, unref() { return this } })
  const listeners = new Set()
  let cancelCount = 0
  const channel = {
    ...createInitialChannelView(
      { model: 'probe', provider: 'test', cwd: '/tmp' },
      { agentId: 'todo-shortcut', mode: { id: 'default' }, cwdDescription: '/tmp' },
    ),
    whaleIdle: false,
    rows: [],
    todos: [
      { content: 'Shortcut probe preview', status: 'in_progress' },
      { content: 'Shortcut probe second task', status: 'pending' },
    ],
    notifications: [],
    pending: [],
    commandList: [],
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener) },
    emit() { this.version++; for (const listener of listeners) listener() },
    submit() {}, cancel() { cancelCount++ }, clear() {}, notify() {}, pushLocal() {},
    commandCompletions: () => [], loadOlder: () => 0, mcpStatus: () => [],
    listFiles: async () => [], listModels: async () => [], listSessions: async () => [],
    setResumeTarget() {}, setActivityFrames: () => true,
  }
  const chat = React.createElement(Chat, { channel, questionStore: new QuestionStore(), fullscreen, onExit() {} })
  const instance = await render(fullscreen ? React.createElement(AlternateScreen, null, chat) : chat,
    { stdout, stderr, stdin, exitOnCtrlC: false, patchConsole: false })
  const screen = () => viewportLines(term).join('\n')
  const expectScreen = async (label, predicate) => {
    assert.ok(await settled(() => predicate(screen())), `${label}\n${screen()}`)
    checks++
    console.log(`PASS: ${lang} ${fullscreen ? 'fullscreen' : 'inline'} ${columns} columns: ${label}`)
  }
  const suffix = lang === 'en' ? ' to fold' : ' 折叠'
  const helpSuffix = lang === 'en' ? ' to fold todos' : ' 折叠待办'
  const openHelp = async () => {
    stdin.write('?')
    await expectScreen('help opens', text => text.includes('ctrl+c'))
    // Below 72 columns, shortcuts are stacked inside a scroll viewport.
    if (columns < 72) stdin.write('\x1b[F')
  }
  try {
    await expectScreen('default hint names Control, including on macOS', text => text.includes(`Ctrl+Q${suffix}`) && !text.includes('⌘q'))
    stdin.write('\x11')
    await expectScreen('Ctrl+Q folds the todo list', text => text.includes('Shortcut probe preview') && !text.includes('Shortcut probe second task'))
    stdin.write('\x11')
    await expectScreen('Ctrl+Q unfolds the todo list', text => text.includes('Shortcut probe second task') && text.includes(`Ctrl+Q${suffix}`))
    channel.working = true
    channel.emit()
    stdin.write('\x11')
    await expectScreen('Ctrl+Q also folds while the agent is working', text => text.includes('Shortcut probe preview') && !text.includes('Shortcut probe second task'))
    assert.equal(cancelCount, 0, 'folding must not interrupt the running turn')
    checks++
    stdin.write('\x11')
    await expectScreen('working todo list unfolds', text => text.includes('Shortcut probe second task') && text.includes(`Ctrl+Q${suffix}`))
    channel.working = false
    channel.emit()
    await openHelp()
    await expectScreen('help shows the same default shortcut', text => text.includes(`Ctrl+Q${helpSuffix}`))
    stdin.write('\x1b')
    await expectScreen('help closes before remapping', text => !text.includes(`Ctrl+Q${helpSuffix}`) && text.includes(`Ctrl+Q${suffix}`))

    setKeymapOverrides({ todoFold: 'alt+q' })
    channel.emit()
    await expectScreen('live remapping updates the panel hint', text => text.includes(`Alt+Q${suffix}`) && !text.includes(`Ctrl+Q${suffix}`))
    assert.equal(actionMatches('todoFold', 'q', { ctrl: true }), false)
    checks++
    stdin.write('\x1bq')
    await expectScreen('remapped Alt+Q folds the list', text => text.includes('Shortcut probe preview') && !text.includes('Shortcut probe second task'))
    stdin.write('\x1bq')
    await expectScreen('remapped Alt+Q unfolds the list', text => text.includes('Shortcut probe second task') && text.includes(`Alt+Q${suffix}`))
    await openHelp()
    await expectScreen('help follows live remapping', text => text.includes(`Alt+Q${helpSuffix}`))
    stdin.write('\x1b')
    await expectScreen('remapped help closes', text => !text.includes(`Alt+Q${helpSuffix}`) && text.includes(`Alt+Q${suffix}`))

    setKeymapOverrides({ todoFold: ['ctrl+shift+q', 'alt+q'] })
    channel.emit()
    await expectScreen('all configured alternatives appear', text => text.includes(`Ctrl+Shift+Q, Alt+Q${suffix}`))
    resetKeymapOverrides()
    channel.emit()
    await expectScreen('reset restores the default hint', text => text.includes(`Ctrl+Q${suffix}`) && !text.includes(`Alt+Q${suffix}`))
  } finally {
    instance.unmount()
    term.dispose()
    resetKeymapOverrides()
  }
}
console.log(`${checks} todo shortcut checks passed`)
