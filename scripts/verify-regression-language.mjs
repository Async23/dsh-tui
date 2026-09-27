#!/usr/bin/env node
/**
 * #1030: copy-sensitive regressions must run independently of the host's
 * locale, saved /lang choice, and DSH_TUI_LANG (including CI's zh default).
 * Run after build: node scripts/verify-regression-language.mjs
 * Each child runs the real assertions with a fresh, disposable HOME.
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const scripts = [
  ['--import', 'tsx/esm', 'scripts/repro-askpanel.tsx'],
  ['--import', 'tsx/esm', 'scripts/verify-askpanel-layout.tsx'],
  ['--import', 'tsx/esm', 'scripts/verify-askpanel-hide-custom-input.tsx'],
  ['--import', 'tsx/esm', 'scripts/verify-compact-switch.tsx'],
  ['scripts/verify-compact.mjs'],
  ['--import', 'tsx/esm', 'scripts/verify-ime-cursor.tsx'],
  ['--import', 'tsx/esm', 'scripts/verify-question-paste.tsx'],
  ['--import', 'tsx/esm', 'scripts/repro-suggestion-click.tsx'],
  ['scripts/verify-queue.mjs'],
]
const cases = [
  { name: 'locale', locale: 'en_US.UTF-8' },
  { name: 'saved preference', locale: 'zh_CN.UTF-8', saved: 'en' },
  { name: 'environment override', locale: 'zh_CN.UTF-8', saved: 'zh', envLang: 'en' },
]

let failures = 0
for (const testCase of cases) {
  for (const args of scripts) {
    const home = mkdtempSync(join(tmpdir(), 'dsh-tui-lang-test-'))
    try {
      if (testCase.saved) {
        const dir = join(home, '.dsh-tui')
        mkdirSync(dir)
        writeFileSync(join(dir, 'lang.json'), JSON.stringify({ lang: testCase.saved }))
      }
      const env = {
        ...process.env,
        HOME: home,
        USERPROFILE: home,
        LANG: testCase.locale,
        LC_ALL: testCase.locale,
        LC_MESSAGES: testCase.locale,
      }
      delete env.DSH_TUI_LANG
      if (testCase.envLang) env.DSH_TUI_LANG = testCase.envLang
      const result = spawnSync(process.execPath, args, {
        cwd: root,
        env,
        encoding: 'utf8',
        timeout: 90_000,
        maxBuffer: 8 * 1024 * 1024,
      })
      const ok = result.status === 0 && !result.error
      console.log(`${ok ? 'PASS' : 'FAIL'} ${testCase.name}: ${args.at(-1)}`)
      if (!ok) {
        failures++
        console.error(result.error ?? `exit=${result.status}, signal=${result.signal}`)
        process.stderr.write(result.stdout ?? '')
        process.stderr.write(result.stderr ?? '')
      }
    } finally {
      rmSync(home, { recursive: true, force: true })
    }
  }
}
console.log(`${scripts.length * cases.length - failures}/${scripts.length * cases.length} language-isolation checks passed`)
process.exitCode = failures === 0 ? 0 : 1
