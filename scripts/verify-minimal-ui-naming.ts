/**
 * 「极简界面」/「极简模式」命名分离门禁（verify:build 的一环）。
 *
 * 两件完全不同的事共用一个中文名是产品事故：
 *   - TUI 显示设置 `dsh-tui.minimal`（**极简界面** / Minimal UI）只精简界面
 *     装饰（开屏头部、emoji 状态符、装饰配色、底栏字段），不影响模型能力；
 *   - 内核 agent preset `minimal`（**极简模式** / Minimal）是能力决策：它改变
 *     模型可见/可调用的工具面（只暴露一个持久 shell 工具）。
 *
 * 本门禁把「谁该叫哪个名字」钉死，任一方向被改回去都会失败：
 *   1. TUI 设置的文案必须自证「极简界面 / Minimal UI」且只谈界面，
 *      并且**绝不**出现裸「极简模式」或旧的 Minimal mode；
 *   2. 内核 preset 的文案必须仍然叫「极简模式 / Minimal」，且显式说明它是
 *      内核 Agent 预设，与界面开关可区分；
 *   3. 持久化配置键仍然是 `minimal`（Config / settings.yaml / cordis.yml 依赖它）；
 *   4. 源码里不再有 `minimalMode` 一代的标识符，且发布面（TuiSceneProps.channel
 *      收到的 ChannelUi）上的 `minimal` / `setMinimal()` 仍作为 deprecated 别名存在。
 *
 * 运行：node --import tsx/esm scripts/verify-minimal-ui-naming.ts
 */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { i18nDict } from '../src/i18n.js'
import { SETTING_DEFINITIONS } from '../src/settings/definitions.js'

const TUI_NAME_ZH = '极简界面'
const KERNEL_NAME_ZH = '极简模式'
// 拼接出旧标识符，本文件自身的字面量因此不会在下面的全量扫描里自命中。
const RETIRED_IDENTIFIERS = [`isMinimal${'Mode'}`, `setMinimal${'Mode'}`, `minimal${'Mode'}.js`]

let failures = 0
function fail(message: string): void {
  failures += 1
  console.error(`  ✗ ${message}`)
}

// ── 1：TUI 显示设置 `dsh-tui.minimal` 只能说「极简界面 / Minimal UI」 ────
const setting = SETTING_DEFINITIONS.minimal
const tuiText = [
  setting.label,
  setting.descriptions?.zh ?? '',
  setting.hint ?? '',
  setting.hintDescriptions?.zh ?? '',
].join('\n')

if (setting.label !== 'Minimal UI') fail(`设置 minimal 的 label 应为 Minimal UI，实际：${setting.label}`)
if (setting.descriptions?.zh !== TUI_NAME_ZH) fail(`设置 minimal 的中文名应为「${TUI_NAME_ZH}」，实际：${setting.descriptions?.zh}`)
if (tuiText.includes(KERNEL_NAME_ZH)) fail(`设置 minimal 的文案出现裸「${KERNEL_NAME_ZH}」——TUI 开关不得借用内核预设的名字`)
if (/Minimal mode/.test(tuiText)) fail('设置 minimal 的文案仍有旧名 Minimal mode')
// 只谈界面：必须写明它只管界面/不管模型能力，并把读者指回 /preset。
if (!/(interface only|not the agent preset)/i.test(setting.hint ?? '')) fail('设置 minimal 的英文 hint 未说明它只管界面、不是 Agent 预设')
if (!/(只是界面开关|不是 Agent 预设|界面开关|只精简界面)/.test(setting.hintDescriptions?.zh ?? '')) fail('设置 minimal 的中文 hint 未说明它只是界面开关')
if (!/\/preset/.test(`${setting.hint ?? ''} ${setting.hintDescriptions?.zh ?? ''}`)) fail('设置 minimal 的 hint 未指回 /preset（内核预设入口）')

// ── 2：内核 preset `minimal` 必须仍叫「极简模式 / Minimal」且可区分 ──────
const kernelName = i18nDict['preset-name-minimal']
const kernelDesc = i18nDict['preset-desc-minimal']
if (kernelName?.zh !== KERNEL_NAME_ZH) fail(`preset-name-minimal 的中文名应保持「${KERNEL_NAME_ZH}」，实际：${kernelName?.zh}`)
if (kernelName?.en !== 'Minimal') fail(`preset-name-minimal 的英文名应保持 Minimal，实际：${kernelName?.en}`)
if (typeof kernelDesc?.zh !== 'string' || !kernelDesc.zh.includes(KERNEL_NAME_ZH)) fail(`preset-desc-minimal 的中文描述必须点明「${KERNEL_NAME_ZH}」`)
if (typeof kernelDesc?.en !== 'string' || !kernelDesc.en.includes('Minimal')) fail('preset-desc-minimal 的英文描述必须点明 Minimal')
if (typeof kernelDesc?.zh !== 'string' || !/内核 Agent 预设/.test(kernelDesc.zh)) fail('preset-desc-minimal 的中文描述未说明它是内核 Agent 预设')
if (typeof kernelDesc?.en !== 'string' || !/Kernel agent preset/.test(kernelDesc.en)) fail('preset-desc-minimal 的英文描述未说明它是内核 Agent 预设')
// 两边的中文名必须是两个不同的字符串，且预设文案不得借用界面开关的名字。
if (kernelName?.zh === setting.descriptions?.zh) fail('TUI 设置与内核 preset 的中文名相同——两个概念又混在一起了')
const kernelText = `${String(kernelDesc?.zh ?? '')} ${String(kernelDesc?.en ?? '')}`
if (kernelText.includes(TUI_NAME_ZH) || /Minimal UI/.test(kernelText)) {
  fail('preset-desc-minimal 出现界面开关的名字（Minimal UI / 极简界面）')
}

// ── 3：持久化配置键仍然叫 `minimal` ────────────────────────────────────
const settingKeys = Object.keys(SETTING_DEFINITIONS)
if (!settingKeys.includes('minimal')) fail('设置定义里找不到持久化键 minimal——配置键不得改名')
if (settingKeys.includes('minimalUi')) fail('设置定义出现了 minimalUi 键——持久化键只能叫 minimal')
const configSource = readFileSync(new URL('../src/dsh-adapter/index.ts', import.meta.url), 'utf8')
if (!/\bminimal\s*:\s*Schema\.boolean\(\)/.test(configSource)) fail('src/dsh-adapter/index.ts 的 Config 里没有 `minimal: Schema.boolean()`——持久化键被改动了')

// ── 4：源码词汇已解耦，发布面的旧名仍作为 deprecated 别名存在 ────────────
const tracked = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', 'src', 'scripts'], { encoding: 'utf8' })
  .split('\0')
  .filter(file => /\.(ts|tsx|mjs|cjs)$/.test(file))
  .filter(file => existsSync(file))
for (const file of tracked) {
  const content = readFileSync(file, 'utf8')
  for (const identifier of RETIRED_IDENTIFIERS) {
    if (content.includes(identifier)) fail(`${file}: 仍在使用旧标识符 ${identifier}（应改为 minimalUi / isMinimalUiMode / setMinimalUiMode）`)
  }
}
const portSource = readFileSync(new URL('../src/adapter/ports/channel-ui.ts', import.meta.url), 'utf8')
if (!/readonly minimalUi: boolean/.test(portSource)) fail('ChannelUi 缺少 readonly minimalUi: boolean')
if (!/setMinimalUi\(enabled: boolean\): void/.test(portSource)) fail('ChannelUi 缺少 setMinimalUi(enabled: boolean): void')
if (!/readonly minimal: boolean/.test(portSource)) fail('ChannelUi 丢了 deprecated 别名 readonly minimal: boolean（第三方场景插件依赖它）')
if (!/setMinimal\(enabled: boolean\): void/.test(portSource)) fail('ChannelUi 丢了 deprecated 别名 setMinimal(enabled: boolean): void')
// 两个别名都必须标明 deprecation 并指向新名字，读者才知道该迁到哪。
if ((portSource.match(/@deprecated/g) ?? []).length < 2) fail('ChannelUi 的 minimal / setMinimal 别名缺少 @deprecated 标注')
if (!/@deprecated[^\n]*minimalUi/i.test(portSource)) fail('ChannelUi 的别名注释没有指向 minimalUi')
if (!/@deprecated[^\n]*setMinimalUi/.test(portSource)) fail('ChannelUi 的别名注释没有指向 setMinimalUi')
// 只看类型的别名断言管不住实现：shadow 模式下的写守卫由 ui-policy 的效果分级决定。
// 旧名一旦被降级成 'read-only'，场景插件就能在 passive/replay shadow 下真的改状态
// （verify-channel-ui 那一档是 `if (effect !== 'mutate') continue`，会静默跳过）。
const policySource = readFileSync(new URL('../src/adapter/channel/ui-policy.ts', import.meta.url), 'utf8')
for (const name of ['setMinimalUi', 'setMinimal']) {
  if (!new RegExp(`'${name}':\\s*'mutate'`).test(policySource)) {
    fail(`ui-policy 里 ${name} 的效果类必须是 'mutate'（降级成 read-only 会绕过 shadow 写守卫）`)
  }
}

if (failures > 0) {
  console.error(`verify-minimal-ui-naming: ${failures} 处失败`)
  process.exit(1)
}
console.log(`✓ verify-minimal-ui-naming: TUI 设置=${setting.label}/${setting.descriptions?.zh}，内核 preset=${kernelName.en}/${kernelName.zh}，持久化键 minimal 未变`)
