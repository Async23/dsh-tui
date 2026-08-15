#!/usr/bin/env node
/**
 * Regression: resume-seam legacy event-type registration
 * (src/dsh-adapter/compat/sessionLog.ts, issue #153).
 *
 * Boots the REAL upstream storage stack (SessionStore + the jsonl
 * persistence backend) against a temp root with hand-crafted pre-#143 logs
 * (activity/status present, no ignorable marker — the shape that made
 * resume reject whole sessions), and asserts through the backend's own
 * strict read path:
 *   1. before registration, load() rejects with SessionFormatUnsupportedError
 *      ("not marked ignorable") — the exact failure from issue #153;
 *   2. ensureLegacySessionEventTypes() flips the SAME load() to success via
 *      the validator's own dsh-session copy (anchor coverage is e2e-proven,
 *      not assumed);
 *   3. the log file stays byte-identical and keeps its 0600 mode —
 *      registration never rewrites the shared store (no lost concurrent
 *      frames, no permission/checksum drift, no torn-tail parsing);
 *   4. whitelist discipline: a non-whitelisted unknown type (standing in
 *      for a FUTURE required event) still rejects after registration —
 *      upstream's fail-closed newer-harness protection is preserved;
 *   5. idempotence: a second ensure call is a harmless no-op.
 * Exits non-zero on any assertion failure (CI gate).
 */
import assert from 'node:assert/strict'
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { zstdCompressSync } from 'node:zlib'
import { Context } from '@deepseek-ai/cordis'
import SessionStore, { KNOWN_SESSION_EVENT_TYPES, SESSION_FORMAT_VERSION } from '@deepseek-ai/dsh-session'
import Jsonl from '@deepseek-ai/dsh-session-persistence-jsonl'

const root = mkdtempSync(join(tmpdir(), 'dsh-tui-resume-legacy-'))
const {
  ensureLegacySessionEventTypes,
  LEGACY_SESSION_EVENT_TYPES,
} = await import('../lib/types/dsh-adapter/compat/sessionLog.js')

/** Hand-craft one pre-#143 shaped log: header frame + one event frame. */
function writeTaintedLog(id, eventType) {
  const header = { type: 'session', version: SESSION_FORMAT_VERSION, id, createdAt: 1, cwd: '/tmp/verify', delegationDepth: 0 }
  const event = { type: eventType, seq: 0, time: 2, data: {} }
  const dir = join(root, '--tmp-verify--', id)
  mkdirSync(dir, { recursive: true })
  const file = join(dir, 'session.jsonl.zstd')
  writeFileSync(
    file,
    Buffer.concat([
      zstdCompressSync(Buffer.from(JSON.stringify(header) + '\n', 'utf8')),
      zstdCompressSync(Buffer.from(JSON.stringify(event) + '\n', 'utf8')),
    ]),
  )
  chmodSync(file, 0o600) // the backend's artifact mode — must survive us
  return file
}

const ctx = new Context()
await ctx.plugin(SessionStore)
const fork = ctx.plugin(Jsonl, { root })
if (fork && typeof fork.await === 'function') await fork.await()
else await fork
const persistence = ctx.get('sessionPersistence')
assert.ok(persistence, 'sessionPersistence service mounted')

const legacyId = '00000000-1111-2222-3333-444444444444'
const futureId = '55555555-6666-7777-8888-999999999999'
const legacyFile = writeTaintedLog(legacyId, 'activity/status')
writeTaintedLog(futureId, 'acme/required-policy') // non-whitelisted unknown

// 1. The exact issue #153 failure, through the real validator.
await assert.rejects(
  () => persistence.load(legacyId),
  (error) => {
    assert.equal(error.name, 'SessionFormatUnsupportedError')
    assert.match(error.message, /not marked ignorable/)
    return true
  },
  'tainted log must reject before registration',
)

const bytesBefore = readFileSync(legacyFile)
const modeBefore = statSync(legacyFile).mode & 0o777

// 2. Registration flips the same load to success.
ensureLegacySessionEventTypes()
const loaded = await persistence.load(legacyId)
assert.equal(loaded.events.length, 1, 'legacy session loads after registration')
assert.equal(loaded.events[0].type, 'activity/status')

// 3. The shared store was never rewritten.
assert.equal(Buffer.compare(readFileSync(legacyFile), bytesBefore), 0, 'log bytes untouched')
assert.equal(statSync(legacyFile).mode & 0o777, modeBefore, 'log mode untouched')
assert.equal(modeBefore, 0o600, 'fixture really exercised the 0600 contract')

// 4. Fail-closed preserved: the non-whitelisted unknown still rejects.
await assert.rejects(
  () => persistence.load(futureId),
  /not marked ignorable/,
  'non-whitelisted unknown type must stay rejected (newer-harness protection)',
)

// 5. Whitelist/Set coherence in this tree + idempotence.
for (const type of LEGACY_SESSION_EVENT_TYPES) {
  assert.ok(KNOWN_SESSION_EVENT_TYPES.has(type), `${type} registered in this tree's copy`)
}
assert.ok(!KNOWN_SESSION_EVENT_TYPES.has('acme/required-policy'), 'unknown stays unknown')
ensureLegacySessionEventTypes() // second call: no-op, never throws
assert.equal((await persistence.load(legacyId)).events.length, 1, 'still loads after re-ensure')

rmSync(root, { recursive: true, force: true })
console.log('verify-resume-legacy-events: OK')
process.exit(0)
