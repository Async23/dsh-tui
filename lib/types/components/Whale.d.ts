import React from 'react';
import { type WhaleFrame } from './whaleFrames.js';
/** Startup whale artwork: the classic whale, or the whale-girl (issue #4). */
export type WhaleStyle = 'classic' | 'girl';
/** Narrow an untrusted value (cordis config) to a WhaleStyle. */
export declare function isWhaleStyle(value: unknown): value is WhaleStyle;
/**
 * Render a frame to 13 ANSI rows (one per sprite row pair). Consecutive
 * cells sharing one style are run-length encoded; trailing transparent
 * cells are dropped so the rows measure exactly the whale's bounding box.
 */
export declare function renderWhaleRows(frame: WhaleFrame): string[];
/** Index of the `standard` frame — the settled header's static pose. */
export declare const STANDARD_FRAME_INDEX = 0;
/**
 * One whale pose as an Ink component: 13 rows × 40 columns, never
 * shrinking. Pass `frameIndex` from the style's opening sequence while
 * animating, or STANDARD_FRAME_INDEX for the static header whale. `width`
 * pins the box width so the neighbouring text column never shifts when
 * frames widen (the classic tail-wag frames reach 4 columns further right
 * than standard).
 */
export declare function WhaleArt({ frameIndex, width, style, }: {
    frameIndex?: number;
    width?: number;
    style?: WhaleStyle;
}): React.ReactNode;
//# sourceMappingURL=Whale.d.ts.map