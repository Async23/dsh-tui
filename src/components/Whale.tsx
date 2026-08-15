import React from 'react'
import { Box, Text } from '../ui.js'
import { WHALE_FRAMES, type WhaleFrame } from './whaleFrames.js'
import { WHALE_GIRL_FRAMES } from './whaleGirlFrames.js'

/**
 * The DeepSeek pixel whale from the hand-drawn Excel art (whale_frames.zip):
 * a 40×25 sprite in four true-color tones (deep-navy outline, DeepSeek-blue
 * body, ice-blue belly, white mouth). Rendered with the half-block
 * technique — each terminal cell packs two vertical pixels into one `▀`/`▄`
 * glyph (foreground = upper pixel, background = lower), so the whale shows
 * at 40 columns × 13 rows with visually square pixels.
 *
 * The `girl` style (issue #4) swaps in the whale-girl sprite from
 * whaleGirlFrames.ts — same grid, same half-block pipeline, two extra
 * palette tones (S skin, P blush) the classic frames never reference.
 */

type Rgb = readonly [number, number, number]

/** Startup whale artwork: the classic whale, or the whale-girl (issue #4). */
export type WhaleStyle = 'classic' | 'girl'

/** Narrow an untrusted value (cordis config) to a WhaleStyle. */
export function isWhaleStyle(value: unknown): value is WhaleStyle {
  return value === 'classic' || value === 'girl'
}

/**
 * Sprite palette: D outline · B body/hair · L belly/spout/shine · W mouth/
 * dress · S skin · P blush · `.` transparent. S and P only appear in the
 * whale-girl frames; the classic whale renders exactly as before.
 */
const PALETTE: Record<string, Rgb | undefined> = {
  D: [20, 38, 96],
  B: [78, 111, 255],
  L: [190, 225, 255],
  W: [255, 255, 255],
  S: [255, 223, 196],
  P: [255, 170, 190],
}

const fg = (rgb: Rgb): string => `\x1b[38;2;${rgb[0]};${rgb[1]};${rgb[2]}m`
const bg = (rgb: Rgb): string => `\x1b[48;2;${rgb[0]};${rgb[1]};${rgb[2]}m`
const RESET = '\x1b[0m'

/**
 * Render a frame to 13 ANSI rows (one per sprite row pair). Consecutive
 * cells sharing one style are run-length encoded; trailing transparent
 * cells are dropped so the rows measure exactly the whale's bounding box.
 */
export function renderWhaleRows(frame: WhaleFrame): string[] {
  const sprite = frame.rows
  const rows: string[] = []
  for (let r = 0; r < sprite.length; r += 2) {
    const upper = sprite[r]
    const lower = sprite[r + 1] ?? ''
    let out = ''
    let current = ''
    for (let x = 0; x < upper.length; x++) {
      const up = PALETTE[upper[x]]
      const lo = PALETTE[lower[x]]
      let seq: string
      let ch: string
      if (up !== undefined && lo !== undefined) {
        seq = fg(up) + bg(lo)
        ch = '▀'
      } else if (up !== undefined) {
        seq = fg(up)
        ch = '▀'
      } else if (lo !== undefined) {
        seq = fg(lo)
        ch = '▄'
      } else {
        seq = ''
        ch = ' '
      }
      if (seq !== current) {
        out += seq === '' ? RESET : seq
        current = seq
      }
      out += ch
    }
    // Drop the transparent tail (plain spaces paint nothing), then always
    // close the row's style — a row ending on a colored cell would
    // otherwise leak its SGR into the line's remaining padding.
    let row = out.replace(/[ ]+$/, '')
    if (!row.endsWith(RESET)) row += RESET
    rows.push(row)
  }
  return rows
}

/** Pre-rendered ANSI rows for every frame of each style, computed once at
 *  module load. */
const RENDERED: Record<WhaleStyle, readonly string[][]> = {
  classic: WHALE_FRAMES.map(renderWhaleRows),
  girl: WHALE_GIRL_FRAMES.map(renderWhaleRows),
}

/** Index of the `standard` frame — the settled header's static pose. */
export const STANDARD_FRAME_INDEX = 0

/**
 * One whale pose as an Ink component: 13 rows × 40 columns, never
 * shrinking. Pass `frameIndex` from the style's opening sequence while
 * animating, or STANDARD_FRAME_INDEX for the static header whale. `width`
 * pins the box width so the neighbouring text column never shifts when
 * frames widen (the classic tail-wag frames reach 4 columns further right
 * than standard).
 */
export function WhaleArt({
  frameIndex = STANDARD_FRAME_INDEX,
  width,
  style = 'classic',
}: {
  frameIndex?: number
  width?: number
  style?: WhaleStyle
}): React.ReactNode {
  const rendered = RENDERED[style]
  const rows = rendered[frameIndex] ?? rendered[STANDARD_FRAME_INDEX]
  return (
    <Box flexDirection="column" flexShrink={0} width={width}>
      {rows.map((row, index) => (
        <Text key={index} wrap="truncate-end">
          {row}
        </Text>
      ))}
    </Box>
  )
}
