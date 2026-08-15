import { jsx as _jsx } from "react/jsx-runtime";
import { Box, Text } from '../ui.js';
import { WHALE_FRAMES } from './whaleFrames.js';
import { WHALE_GIRL_FRAMES } from './whaleGirlFrames.js';
/** Narrow an untrusted value (cordis config) to a WhaleStyle. */
export function isWhaleStyle(value) {
    return value === 'classic' || value === 'girl';
}
/**
 * Sprite palette: D outline · B body/hair · L belly/spout/shine · W mouth/
 * dress · S skin · P blush · `.` transparent. S and P only appear in the
 * whale-girl frames; the classic whale renders exactly as before.
 */
const PALETTE = {
    D: [20, 38, 96],
    B: [78, 111, 255],
    L: [190, 225, 255],
    W: [255, 255, 255],
    S: [255, 223, 196],
    P: [255, 170, 190],
};
const fg = (rgb) => `\x1b[38;2;${rgb[0]};${rgb[1]};${rgb[2]}m`;
const bg = (rgb) => `\x1b[48;2;${rgb[0]};${rgb[1]};${rgb[2]}m`;
const RESET = '\x1b[0m';
/**
 * Render a frame to 13 ANSI rows (one per sprite row pair). Consecutive
 * cells sharing one style are run-length encoded; trailing transparent
 * cells are dropped so the rows measure exactly the whale's bounding box.
 */
export function renderWhaleRows(frame) {
    const sprite = frame.rows;
    const rows = [];
    for (let r = 0; r < sprite.length; r += 2) {
        const upper = sprite[r];
        const lower = sprite[r + 1] ?? '';
        let out = '';
        let current = '';
        for (let x = 0; x < upper.length; x++) {
            const up = PALETTE[upper[x]];
            const lo = PALETTE[lower[x]];
            let seq;
            let ch;
            if (up !== undefined && lo !== undefined) {
                seq = fg(up) + bg(lo);
                ch = '▀';
            }
            else if (up !== undefined) {
                seq = fg(up);
                ch = '▀';
            }
            else if (lo !== undefined) {
                seq = fg(lo);
                ch = '▄';
            }
            else {
                seq = '';
                ch = ' ';
            }
            if (seq !== current) {
                out += seq === '' ? RESET : seq;
                current = seq;
            }
            out += ch;
        }
        // Drop the transparent tail (plain spaces paint nothing), then always
        // close the row's style — a row ending on a colored cell would
        // otherwise leak its SGR into the line's remaining padding.
        let row = out.replace(/[ ]+$/, '');
        if (!row.endsWith(RESET))
            row += RESET;
        rows.push(row);
    }
    return rows;
}
/** Pre-rendered ANSI rows for every frame of each style, computed once at
 *  module load. */
const RENDERED = {
    classic: WHALE_FRAMES.map(renderWhaleRows),
    girl: WHALE_GIRL_FRAMES.map(renderWhaleRows),
};
/** Index of the `standard` frame — the settled header's static pose. */
export const STANDARD_FRAME_INDEX = 0;
/**
 * One whale pose as an Ink component: 13 rows × 40 columns, never
 * shrinking. Pass `frameIndex` from the style's opening sequence while
 * animating, or STANDARD_FRAME_INDEX for the static header whale. `width`
 * pins the box width so the neighbouring text column never shifts when
 * frames widen (the classic tail-wag frames reach 4 columns further right
 * than standard).
 */
export function WhaleArt({ frameIndex = STANDARD_FRAME_INDEX, width, style = 'classic', }) {
    const rendered = RENDERED[style];
    const rows = rendered[frameIndex] ?? rendered[STANDARD_FRAME_INDEX];
    return (_jsx(Box, { flexDirection: "column", flexShrink: 0, width: width, children: rows.map((row, index) => (_jsx(Text, { wrap: "truncate-end", children: row }, index))) }));
}
