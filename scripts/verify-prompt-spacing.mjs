#!/usr/bin/env node
/**
 * Compact composer regression through the real Chat and terminal renderer.
 * Covers idle spacing, notification appearance/replacement/removal, and
 * multiline draft shrink in fullscreen and inline modes at 120/80/40 columns.
 * Run after build: node scripts/verify-prompt-spacing.mjs
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
import { settled, viewportLines } from './lib/term-test.mjs'

let checks = 0
for (const fullscreen of [true, false]) {
  for (const columns of [120, 80, 40]) {
    const label = `${fullscreen ? 'fullscreen' : 'inline'} ${columns} columns`
    const rows = 24
    const term = new xterm.Terminal({ cols: columns, rows, scrollback: 100, allowProposedApi: true })
    const stdout = Object.assign(new Writable({
      write(chunk, _encoding, callback) { term.write(String(chunk), callback) },
    }), { columns, rows, isTTY: true })
    const stderr = Object.assign(new Writable({
      write(_chunk, _encoding, callback) { callback() },
    }), { isTTY: true })
    const stdin = Object.assign(new PassThrough(), {
      isTTY: true,
      setRawMode() { return this },
      ref() { return this },
      unref() { return this },
    })
    const listeners = new Set()
    const channel = {
      ...createInitialChannelView({
        model: 'spacing-model', cwd: '/tmp', provider: 'test',
        whale: false, whaleIdle: false, smoothStreaming: false,
        scrollGutter: 'scrollbar', pageMargin: 'none', showBackToBottom: false,
      }, { agentId: 'spacing-probe', mode: { id: 'default', plan: false }, cwdDescription: '/tmp' }),
      status: 'idle',
      sessionTitle: 'spacing-probe',
      rows: [
        { id: 1, kind: 'user', text: 'Spacing probe' },
        { id: 2, kind: 'assistant', text: Array.from({ length: 60 }, (_, i) => `正文 ${i + 1}`).join('\n') + '\nTRANSCRIPT_END' },
      ],
      subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener) },
      emit() { this.version++; for (const listener of listeners) listener() },
      commandCompletions() { return [] },
      mcpStatus() { return [] },
      listFiles: async () => [],
      listModels: async () => [],
      listSessions: async () => [],
      loadOlder() {},
      notify() {},
      cancel() {},
    }
    const chat = React.createElement(Chat, { channel, questionStore: new QuestionStore(), fullscreen })
    const instance = await render(fullscreen ? React.createElement(AlternateScreen, null, chat) : chat, {
      stdout, stderr, stdin, exitOnCtrlC: false, patchConsole: false,
    })
    const lines = () => viewportLines(term)
    const geometry = () => {
      const screen = lines()
      return {
        screen,
        top: screen.findIndex(line => line.includes('╭')),
        bottom: screen.findIndex(line => line.includes('╰')),
        transcriptBottom: screen.findIndex(line => line.includes('TRANSCRIPT_END')),
        status: screen.findIndex(line => line.includes('spacing-model')),
      }
    }
    const check = async (name, predicate) => {
      assert.ok(await settled(predicate), `${label}: ${name}\n${lines().join('\n')}`)
      checks++
      console.log(`PASS ${label}: ${name}`)
    }
    const hasGap = count => {
      const g = geometry()
      return g.transcriptBottom >= 0 && g.top - g.transcriptBottom - 1 === count
        && g.bottom > g.top && g.status > g.bottom
    }
    const notify = text => {
      channel.notifications = text === undefined ? [] : [{ text }]
      channel.emit()
    }
    try {
      await check('transcript and input mounted', () => lines().some(line => line.includes('TRANSCRIPT_END')) && geometry().status >= 0)
      await check('idle input has no empty row above its border', () => hasGap(0))
      const baseline = geometry()
      stdin.write('draft-kept')
      await check('draft accepts typing', () => lines().some(line => line.includes('draft-kept')))

      for (const message of ['NOTICE_ONE', 'NOTICE_TWO']) {
        notify(message)
        await check(`${message} occupies exactly one row without covering the transcript or draft`, () => {
          const g = geometry()
          return hasGap(1) && g.screen[g.top - 1]?.includes(message)
            && g.screen.some(line => line.includes('TRANSCRIPT_END'))
            && g.screen.some(line => line.includes('draft-kept'))
            && g.status === baseline.status
        })
      }
      notify(undefined)
      await check('notification removal reclaims the row with no stale text', () => hasGap(0)
        && lines().every(line => !line.includes('NOTICE_'))
        && lines().some(line => line.includes('draft-kept'))
        && geometry().transcriptBottom === baseline.transcriptBottom)

      stdin.write('\x03')
      await check('draft clears', () => hasGap(0) && lines().every(line => !line.includes('draft-kept')))
      stdin.write('\x1b[200~第一行\n第二行\n第三行\x1b[201~')
      await check('multiline input grows without an extra blank row', () => hasGap(0)
        && lines().some(line => line.includes('第三行'))
        && geometry().bottom - geometry().top === 4)
      notify('MULTILINE_NOTICE')
      await check('notification coexists with multiline input', () => hasGap(1)
        && lines()[geometry().top - 1]?.includes('MULTILINE_NOTICE')
        && lines().some(line => line.includes('第三行')))
      notify(undefined)
      await check('notification removal preserves multiline input', () => hasGap(0)
        && lines().every(line => !line.includes('MULTILINE_NOTICE'))
        && geometry().bottom - geometry().top === 4)
      stdin.write('\x03')
      await check('input shrink restores the original transcript and footer geometry', () => hasGap(0)
        && geometry().top === baseline.top && geometry().bottom === baseline.bottom
        && geometry().status === baseline.status
        && lines().every(line => !/第[一二三]行|NOTICE/.test(line))
        && lines().some(line => line.includes('TRANSCRIPT_END')))
    } finally {
      instance.unmount()
      await new Promise(resolve => stdout.write('', resolve))
      term.dispose()
    }
  }
}
console.log(`verify-prompt-spacing OK (${checks} assertions)`)
