/** Block math as a terminal image (`mathRendering: image`): a complete block
 * in a terminal with graphics and a measured cell size is laid out as an
 * image box of exactly the raster's cells, painted in the theme's text color;
 * every other case keeps the Unicode rendering — `auto`, a terminal without
 * graphics or without a cell size, a dimmed block, a still-streaming block,
 * and TeX the image backend rejects. Run with:
 * node --import tsx/esm scripts/verify-math-block-image.tsx
 */
process.env.FORCE_COLOR = '3'
process.env.DSH_TUI_LANG = 'en'

import assert from 'node:assert/strict'
import React from 'react'
import { renderToScreen } from '../src/ink/render-to-screen.js'
import { cellAt } from '../src/ink/screen.js'
import { TerminalSizeContext } from '../src/ink/components/TerminalSizeContext.js'
import { TerminalImagesContext } from '../src/ink/hooks/use-terminal-images.js'
import type { TerminalCellSize } from '../src/ink/terminal-image.js'
import { MathBlock } from '../src/components/MathBlock.js'
import { renderMathRaster, type MathRenderRequest } from '../src/math/renderer.js'
import { getTheme } from '../src/theme.js'
import { renderDisplayMath, renderInlineMath } from '../src/terminal-utils/math.js'
import { applyMathRendering } from '../src/tuiDisplayPrefs.js'

const WIDTH = 80
const CELL: TerminalCellSize = { width: 10, height: 20 }
const QUADRATIC = String.raw`x = \frac{-b \pm \sqrt{b^2-4ac}}{2a}`

const blockToken = (text: string, pending = false) => ({
  type: 'mathBlock' as const,
  raw: `$$\n${text}\n$$`,
  text,
  ...(pending ? { pending: true } : {}),
})

function images(available: boolean, cellSize: TerminalCellSize | undefined) {
  return {
    subscribe: () => () => {},
    getSnapshot: () => available,
    getCellSize: () => cellSize,
    request: () => () => {},
  }
}

function screenLines(element: React.ReactElement, graphics = images(true, CELL)): string[] {
  const screen = renderToScreen(
    <TerminalSizeContext.Provider value={{ columns: WIDTH, rows: 40 }}>
      <TerminalImagesContext.Provider value={graphics}>{element}</TerminalImagesContext.Provider>
    </TerminalSizeContext.Provider>,
    WIDTH,
  )
  return Array.from({ length: screen.height }, (_, row) =>
    Array.from({ length: WIDTH }, (_, column) => cellAt(screen.screen, column, row)?.char ?? '').join('').trimEnd(),
  )
}

const block = (text: string, dimColor = false, pending = false) =>
  <MathBlock token={blockToken(text, pending)} dimColor={dimColor} forceWidth={WIDTH} />

// The request MathBlock derives: the theme's text color, the width left after
// its indent and slack, at most 16 rows. Rendering it here first puts the
// result in the cache, which the component reads synchronously on mount.
const rgb = /^rgb\((\d+),(\d+),(\d+)\)$/.exec(getTheme('dark').text)
assert.ok(rgb !== null, 'the dark theme text color is rgb()')
const color = `#${rgb.slice(1, 4).map(channel => Number(channel).toString(16).padStart(2, '0')).join('')}`
const request = (tex: string): MathRenderRequest =>
  ({ tex, display: true, color, cellSize: CELL, maxColumns: WIDTH - 2 - 4, maxRows: 16 })

const stacked = renderDisplayMath(QUADRATIC)!.map(line => `  ${line}`.trimEnd())
const linear = renderInlineMath(QUADRATIC)!

applyMathRendering('image')
const quadratic = await renderMathRaster(request(QUADRATIC))
assert.ok(quadratic.ok, `the quadratic formula rasterizes (got ${quadratic.ok ? '' : quadratic.failure})`)

// Image: a box of exactly the raster's cells, whose text fallback (what a
// cell grid shows) is the one-line form rather than the stacked layout.
{
  const lines = screenLines(block(QUADRATIC))
  assert.equal(lines.length, quadratic.raster.rows, 'the block takes the raster rows')
  const shown = lines[0]!.replace(/…$/u, '')
  assert.ok(shown.length > 4 && `  ${linear}`.startsWith(shown), 'the image box holds the one-line fallback, truncated to its width')
  assert.notDeepEqual(lines, stacked, 'not the stacked Unicode layout')
}

// Every other case keeps the Unicode rendering.
assert.deepEqual(screenLines(block(QUADRATIC), images(false, CELL)), stacked, 'no graphics: Unicode')
assert.deepEqual(screenLines(block(QUADRATIC), images(true, undefined)), stacked, 'no measured cell size: Unicode')
assert.deepEqual(screenLines(block(QUADRATIC, true)), stacked, 'a dimmed block cannot be an image')
assert.deepEqual(screenLines(block(QUADRATIC, false, true)), ['$$', QUADRATIC, '$$'], 'a streaming block keeps its source')
{
  const unknown = String.raw`x + \unknown{y}`
  const rejected = await renderMathRaster(request(unknown))
  assert.ok(!rejected.ok, 'the image backend rejects unknown commands')
  assert.deepEqual(screenLines(block(unknown)), ['$$', unknown, '$$'], 'a rejected formula falls back like the Unicode path')
}

applyMathRendering('auto')
assert.deepEqual(screenLines(block(QUADRATIC)), stacked, '`auto` stays on Unicode until images are validated')
applyMathRendering('unicode')
assert.deepEqual(screenLines(block(QUADRATIC)), stacked, '`unicode` never uses images')

console.log('Math block images verified: image box from the cached raster, Unicode for auto/unicode, no graphics, no cell size, dimmed, streaming, and rejected TeX')
