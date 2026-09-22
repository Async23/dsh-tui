// Bounded, offline tests of actual download and update paths; no real installation.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { downloadReleasePackage, releaseAssetUrl } from '../lib/types/release.js'
import { fetchGithubLatestRelease, migrateGlobalLauncher, resolveTuiUpdateTarget, tuiUpdatePluginArgs } from '../lib/types/update.js'

const cacheRoot = await mkdtemp(join(tmpdir(), 'verify-fork-release-'))
const originalFetch = globalThis.fetch
const version = '99.0.0-async23.1'
const bytes = Buffer.from('test tarball contents')
const digest = createHash('sha256').update(bytes).digest('hex')
let checks = 0
try {
  const calls = []
  const fetchImpl = async url => {
    calls.push(String(url))
    return new Response(String(url).endsWith('/SHA256SUMS') ? `${digest}  dsh-tui.tgz\n` : bytes)
  }
  const archive = await downloadReleasePackage(version, { fetchImpl, cacheRoot })
  assert.deepEqual(await readFile(archive), bytes)
  assert(calls.every(url => url.startsWith(`https://github.com/Async23/dsh-tui/releases/download/v${version}/`)))
  checks += 2
  await assert.rejects(downloadReleasePackage(version, { cacheRoot, fetchImpl: async url => new Response(
    String(url).endsWith('/SHA256SUMS') ? `${'0'.repeat(64)}  dsh-tui.tgz\n` : bytes,
  ) }), /mismatch/)
  await assert.rejects(downloadReleasePackage(version, { cacheRoot, fetchImpl: async () => new Response('missing') }), /unique/)
  await assert.rejects(downloadReleasePackage(version, { cacheRoot, fetchImpl: async () => new Response('', { status: 404 }) }), /HTTP 404/)
  assert.throws(() => releaseAssetUrl('../../wrong-repo'), /Invalid/)
  checks += 4
  const releaseFetch = async url => {
    assert.equal(String(url), 'https://api.github.com/repos/Async23/dsh-tui/releases/latest')
    return Response.json({ tag_name: `v${version}`, assets: [
      { name: 'dsh-tui.tgz', browser_download_url: releaseAssetUrl(version) },
      { name: 'SHA256SUMS', browser_download_url: releaseAssetUrl(version, 'SHA256SUMS') },
    ] })
  }
  const release = await fetchGithubLatestRelease({ fetchImpl: releaseFetch })
  assert.equal(release.version, version)
  assert.equal(release.downloadUrl, releaseAssetUrl(version))
  globalThis.fetch = releaseFetch
  assert.equal((await resolveTuiUpdateTarget()).latest, version)
  globalThis.fetch = async url => {
    assert(String(url).startsWith('https://api.github.com/repos/Async23/dsh-tui/'))
    throw new Error('offline')
  }
  assert.equal((await resolveTuiUpdateTarget()).kind, 'unknown')
  assert.deepEqual(tuiUpdatePluginArgs('custom', version, archive), ['plugin', '--profile', 'custom', 'add', archive])
  assert.equal(tuiUpdatePluginArgs('custom')[4], releaseAssetUrl())
  checks += 6
  const globalDir = join(cacheRoot, 'global')
  const globalBin = join(globalDir, 'bin', 'dsh-tui.js')
  await mkdir(join(globalDir, 'bin'), { recursive: true })
  await writeFile(join(globalDir, 'package.json'), JSON.stringify({ name: '@deepseek-harness-tui/dsh-tui', version: '0.0.0' }))
  await writeFile(globalBin, '// older launcher')
  const originalArgv1 = process.argv[1]
  process.argv[1] = globalBin
  try {
    assert.equal(migrateGlobalLauncher(), true)
    assert.equal(await readFile(globalBin, 'utf8'), await readFile(new URL('../bin/dsh-tui.js', import.meta.url), 'utf8'))
    assert.equal(await readFile(join(globalDir, 'package.json'), 'utf8'), await readFile(new URL('../package.json', import.meta.url), 'utf8'))
    checks += 3
  } finally {
    process.argv[1] = originalArgv1
  }
  console.log(`Fork release: ${checks} checks passed (checksum, errors, cache, pinned installs, own update source, offline).`)
} finally {
  globalThis.fetch = originalFetch
  await rm(cacheRoot, { recursive: true, force: true })
}
