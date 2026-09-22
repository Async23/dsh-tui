import { spawnSync } from 'node:child_process'
import { downloadReleasePackage } from '../lib/types/release.js'

// pack-release inlines the compiled downloader to produce a single install.mjs asset.
const args = process.argv.slice(2)
if (args.includes('--help')) {
  console.log('Usage: node install.mjs [version] [--profile-only]\nRequires Node.js, npm, pnpm and the official dsh CLI. Uses the existing dsh-tui profile.')
} else {
  const version = args.find(arg => !arg.startsWith('--')) ?? 'latest'
  if (args.some(arg => arg.startsWith('--') && arg !== '--profile-only')) throw new Error('Unknown installer option')
  const run = (command, commandArgs) => {
    const win32 = process.platform === 'win32'
    const quotedArgs = win32 ? commandArgs.map(arg => `"${arg.replaceAll('"', '""')}"`) : commandArgs
    const result = spawnSync(win32 ? `${command}.cmd` : command, quotedArgs, {
      stdio: 'inherit', shell: process.platform === 'win32',
    })
    if (result.error) throw result.error
    if (result.status !== 0) throw new Error(`${command} failed (exit ${result.status})`)
  }
  for (const command of ['dsh', 'pnpm', ...(args.includes('--profile-only') ? [] : ['npm'])]) run(command, ['--version'])
  const archive = await downloadReleasePackage(version)
  console.log(`Verified release archive: ${archive}`)
  run('dsh', ['plugin', '--profile', 'dsh-tui', 'add', archive])
  if (!args.includes('--profile-only')) run('npm', ['install', '--global', '--legacy-peer-deps', '--ignore-scripts', archive])
  console.log('Installed Async23/dsh-tui. Start with: dsh-tui (or dst). Existing processes use the new version after restart.')
}
