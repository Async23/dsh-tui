#!/usr/bin/env node
/**
 * Build lib/settings.json from the single settings definition module
 * (src/settings/definitions.ts, compiled to lib/types/settings/definitions.js)
 * plus the Config schema defaults. The file ships in the npm package; the
 * website's settings reference reads it from the exact published version.
 * Not committed. Run after tsc (part of `pnpm compile`).
 *
 * Also a validator: it fails when a setting lacks either language, an option
 * lacks a Chinese label, or keys are out of order — so `pnpm compile` stops
 * on an incomplete definition before anything is published.
 *
 * Usage: node scripts/gen-settings-json.mjs [--check]
 *   --check  validate and print the entry count without writing the file.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const check = process.argv.includes('--check')

const { SETTING_DEFINITIONS, SHORTCUT_FIELD_META } = await import(`${root}lib/types/settings/definitions.js`)
const { SHORTCUT_ACTIONS } = await import(`${root}lib/types/utils/keymap.js`)
const { Config } = await import(`${root}lib/types/dsh-adapter/index.js`)
const pkg = JSON.parse(readFileSync(`${root}package.json`, 'utf8'))

const problems = []
const need = (value, what) => {
  if (typeof value !== 'string' || value.trim() === '') problems.push(what)
  return value
}

/** The Config schema default for a dotted key, or null when it is computed at runtime. */
function defaultOf(key) {
  const [head, ...rest] = key.split('.')
  const field = Config.dict?.[head]
  // A transform field keeps its default on the inner schema.
  let value = field?.meta?.default ?? field?.inner?.meta?.default
  for (const part of rest) value = value !== null && typeof value === 'object' ? value[part] : undefined
  return value === undefined ? null : value
}

const RESTART = /\/restart|restart|重启/i

function entry(key, def) {
  const label = { en: need(def.label, `${key}: label`), zh: need(def.descriptions?.zh, `${key}: label (zh)`) }
  const description = { en: need(def.hint, `${key}: hint`), zh: need(def.hintDescriptions?.zh, `${key}: hint (zh)`) }
  const options = def.options?.map(option => ({
    value: option.value,
    label: { en: need(option.label, `${key}.${option.value}: option label`), zh: need(option.descriptions?.zh, `${key}.${option.value}: option label (zh)`) },
  }))
  return {
    key,
    kind: def.kind,
    group: def.group ?? 'general',
    label,
    description,
    default: defaultOf(key),
    ...(options === undefined ? {} : { options }),
    restartRequired: RESTART.test(`${description.en} ${description.zh}`),
    deprecated: false,
  }
}

const keys = Object.keys(SETTING_DEFINITIONS)
const sorted = [...keys].sort()
if (keys.join('\n') !== sorted.join('\n')) problems.push('SETTING_DEFINITIONS keys are not sorted — add a setting at its sorted position')

const settings = keys.map(key => entry(key, SETTING_DEFINITIONS[key]))
for (const action of SHORTCUT_ACTIONS) {
  const meta = SHORTCUT_FIELD_META[action.id]
  const defaults = action.defaults.join(', ')
  settings.push({
    ...entry(`shortcuts.${action.id}`, {
      label: meta.label,
      descriptions: { zh: meta.zh },
      hint: meta.hintEn(defaults),
      hintDescriptions: { zh: meta.hintZh(defaults) },
      kind: 'text',
      group: 'shortcuts',
    }),
    // Default combos differ by platform; the description names them.
    default: null,
  })
}
settings.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))

if (problems.length > 0) {
  console.error(`settings.json: ${problems.length} problem(s):\n  ${problems.join('\n  ')}`)
  process.exit(1)
}

const document = {
  schemaVersion: 1,
  package: pkg.name,
  packageVersion: pkg.version,
  namespace: 'dsh-tui',
  settings,
}
if (!check) writeFileSync(`${root}lib/settings.json`, `${JSON.stringify(document, null, 2)}\n`)
console.log(`settings.json: ${settings.length} settings${check ? ' (checked)' : ''}`)
