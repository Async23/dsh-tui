import { createHash } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

const root = fileURLToPath(new URL('../', import.meta.url))
const out = join(root, 'dist-release')
const manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
if (!/^\d+\.\d+\.\d+-async23\.\d+$/.test(manifest.version)) throw new Error('Expected an x.y.z-async23.N version')
await mkdir(out, { recursive: true })
const packed = spawnSync(process.execPath, [
  'scripts/with-publish-manifest.mjs', 'npm', 'pack', '--json', '--ignore-scripts', '--pack-destination', out,
], { cwd: root, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 })
if (packed.error) throw packed.error
if (packed.status !== 0) throw new Error(packed.stderr || packed.stdout)
const reports = JSON.parse(packed.stdout)
const report = Array.isArray(reports) ? reports[0] : Object.values(reports)[0]
const verified = spawnSync(process.execPath, ['scripts/verify-package.mjs'], {
  cwd: root, input: packed.stdout, encoding: 'utf8',
})
if (verified.status !== 0) throw new Error(verified.stderr || verified.stdout)
process.stdout.write(verified.stdout)
await rename(join(out, report.filename), join(out, 'dsh-tui.tgz'))
const downloader = (await readFile(join(root, 'lib/types/release.js'), 'utf8')).replace(/^\/\/# sourceMappingURL=.*$/gm, '')
const installer = (await readFile(join(root, 'scripts/install-release.mjs'), 'utf8'))
  .replace("import { downloadReleasePackage } from '../lib/types/release.js'\n", '')
  .replace("?? 'latest'", `?? '${manifest.version}'`)
await writeFile(join(out, 'install.mjs'), `// Async23/dsh-tui ${manifest.version}; generated from release.ts and install-release.mjs.\n${downloader}\n${installer}`)
const assets = ['dsh-tui.tgz', 'install.mjs']
const sums = await Promise.all(assets.map(async asset => {
  const digest = createHash('sha256').update(await readFile(join(out, asset))).digest('hex')
  return `${digest}  ${asset}\n`
}))
await writeFile(join(out, 'SHA256SUMS'), sums.join(''))
console.log(`Release ${manifest.version}: ${assets.join(', ')}, SHA256SUMS → dist-release/`)
