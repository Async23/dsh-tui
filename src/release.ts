import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, rename, rm, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'

export const RELEASE_REPOSITORY = 'Async23/dsh-tui'
export const RELEASE_PACKAGE_ASSET = 'dsh-tui.tgz'

/** Fixed release paths also work when the unauthenticated GitHub API is rate limited. */
export function releaseAssetUrl(version = 'latest', asset = RELEASE_PACKAGE_ASSET): string {
  if (version !== 'latest' && !/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(version)) {
    throw new Error(`Invalid release version: ${version}`)
  }
  const path = version === 'latest' ? 'latest/download' : `download/v${version}`
  return `https://github.com/${RELEASE_REPOSITORY}/releases/${path}/${asset}`
}

/** Verify before invoking a package manager; keep the archive for pnpm's file: dependency. */
export async function downloadReleasePackage(
  version = 'latest',
  options: { fetchImpl?: typeof fetch; cacheRoot?: string } = {},
): Promise<string> {
  const doFetch = options.fetchImpl ?? fetch
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 120_000)
  const read = async (url: string, limit: number): Promise<Buffer> => {
    const response = await doFetch(url, { signal: controller.signal, headers: { 'user-agent': 'dsh-tui-async23' } })
    if (!response.ok || response.body === null) throw new Error(`Release download failed: HTTP ${response.status} (${url})`)
    const reader = response.body.getReader()
    const chunks: Uint8Array[] = []
    let size = 0
    try {
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        size += value.byteLength
        if (size > limit) throw new Error('Release asset exceeds size limit')
        chunks.push(value)
      }
      return Buffer.concat(chunks)
    } finally {
      await reader.cancel().catch(() => {})
    }
  }
  try {
    const sums = (await read(releaseAssetUrl(version, 'SHA256SUMS'), 64 * 1024)).toString('utf8')
    const entries = sums.split(/\r?\n/).map(line => /^([a-fA-F0-9]{64})\s+\*?dsh-tui\.tgz$/.exec(line))
      .filter((entry): entry is RegExpExecArray => entry !== null)
    if (entries.length !== 1) throw new Error('Release is missing a unique SHA256SUMS entry for dsh-tui.tgz')
    const bytes = await read(releaseAssetUrl(version), 64 * 1024 * 1024)
    const digest = createHash('sha256').update(bytes).digest('hex')
    if (digest !== entries[0]![1]!.toLowerCase()) throw new Error('Release SHA-256 mismatch; installation refused')
    const cache = options.cacheRoot ?? process.env.DSH_TUI_RELEASE_CACHE ?? join(homedir(), '.cache', 'dsh-tui-releases')
    await mkdir(cache, { recursive: true })
    const stage = await mkdtemp(join(cache, '.download-'))
    const target = join(cache, `${digest}.tgz`)
    try {
      await writeFile(join(stage, RELEASE_PACKAGE_ASSET), bytes, { mode: 0o600 })
      await rename(join(stage, RELEASE_PACKAGE_ASSET), target)
    } finally {
      await rm(stage, { recursive: true, force: true })
    }
    return target
  } finally {
    clearTimeout(timer)
  }
}
