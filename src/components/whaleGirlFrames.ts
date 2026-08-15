/**
 * Pixel whale-girl (鲸鱼娘) frames for the startup splash (issue #4): a
 * chibi gijinka of the DeepSeek whale — blue bob hair with an ice-blue
 * shine, a white dress with a blue sailor collar, the classic whale's
 * tail swishing up behind her, and a water spout over her head. Same
 * 40×25 grid and palette alphabet as whaleFrames.ts, extended with the
 * S (skin) and P (blush) tones defined in Whale.tsx. The art's bounding
 * box (cols 6..32, center 19) matches the classic whale's center, so the
 * header layout and welcome-line padding stay unchanged.
 * `WHALE_GIRL_OPENING_SEQUENCE` plays once at startup: blink, spout
 * bloom, then the header settles static.
 */
import type { OpeningStep, WhaleFrame } from './whaleFrames.js'

/** The 3 hand-drawn whale-girl frames. */
export const WHALE_GIRL_FRAMES: readonly WhaleFrame[] = [
  {
    name: 'standard',
    rows: [
      '........................................',
      '..............L.........................',
      '.............LLL........................',
      '..............L.........................',
      '........................................',
      '..........DDDDDDDD......................',
      '.........DBBLLBBBBD.....................',
      '........DBBBBBBBBBBD....................',
      '........DBSSSSSSSSBD....................',
      '........DBSSSSSSSSBD....................',
      '........DBSDDSSDDSBD....................',
      '........DBSDDSSDDSBD....................',
      '........DBPSSSSSSPBD....................',
      '.........DSSSDDSSSSD..D.................',
      '..........DDDDDDDD...DBD.....D..........',
      '.........DWWBBBBWWD..DBBD...DBD.........',
      '........DWWWWWWWWWD..DBBBD.DDBBD........',
      '.......DSWWWWWWWWSD..DBBBBDDBBBBD.......',
      '.......DSWWWWWWWWSD...DBBBBBBBBD........',
      '........DWWWWWWWWWD...DBBBBBBBD.........',
      '.......DWWWWWWWWWWWDBBDBBBBBDD..........',
      '......DWWWWWWWLLLLWWD...................',
      '......DDDDDDDDDDDDDDD...................',
      '........SS......SS......................',
      '........DD......DD......................',
    ],
  },
  {
    name: 'blink',
    rows: [
      '........................................',
      '..............L.........................',
      '.............LLL........................',
      '..............L.........................',
      '........................................',
      '..........DDDDDDDD......................',
      '.........DBBLLBBBBD.....................',
      '........DBBBBBBBBBBD....................',
      '........DBSSSSSSSSBD....................',
      '........DBSSSSSSSSBD....................',
      '........DBSSSSSSSSBD....................',
      '........DBSDDSSDDSBD....................',
      '........DBPSSSSSSPBD....................',
      '.........DSSSDDSSSSD..D.................',
      '..........DDDDDDDD...DBD.....D..........',
      '.........DWWBBBBWWD..DBBD...DBD.........',
      '........DWWWWWWWWWD..DBBBD.DDBBD........',
      '.......DSWWWWWWWWSD..DBBBBDDBBBBD.......',
      '.......DSWWWWWWWWSD...DBBBBBBBBD........',
      '........DWWWWWWWWWD...DBBBBBBBD.........',
      '.......DWWWWWWWWWWWDBBDBBBBBDD..........',
      '......DWWWWWWWLLLLWWD...................',
      '......DDDDDDDDDDDDDDD...................',
      '........SS......SS......................',
      '........DD......DD......................',
    ],
  },
  {
    name: 'spout',
    rows: [
      '............L...L.......................',
      '............LLLLL.......................',
      '.............LLL........................',
      '..............L.........................',
      '..............L.........................',
      '..........DDDDDDDD......................',
      '.........DBBLLBBBBD.....................',
      '........DBBBBBBBBBBD....................',
      '........DBSSSSSSSSBD....................',
      '........DBSSSSSSSSBD....................',
      '........DBSDDSSDDSBD....................',
      '........DBSDDSSDDSBD....................',
      '........DBPSSSSSSPBD....................',
      '.........DSSSDDSSSSD..D.................',
      '..........DDDDDDDD...DBD.....D..........',
      '.........DWWBBBBWWD..DBBD...DBD.........',
      '........DWWWWWWWWWD..DBBBD.DDBBD........',
      '.......DSWWWWWWWWSD..DBBBBDDBBBBD.......',
      '.......DSWWWWWWWWSD...DBBBBBBBBD........',
      '........DWWWWWWWWWD...DBBBBBBBD.........',
      '.......DWWWWWWWWWWWDBBDBBBBBDD..........',
      '......DWWWWWWWLLLLWWD...................',
      '......DDDDDDDDDDDDDDD...................',
      '........SS......SS......................',
      '........DD......DD......................',
    ],
  },
]

/** Startup sequence (~1.8s), ending on the standard pose. */
export const WHALE_GIRL_OPENING_SEQUENCE: readonly OpeningStep[] = [
  { frame: 0, ms: 400 }, // standard
  { frame: 1, ms: 250 }, // blink
  { frame: 0, ms: 300 }, // standard
  { frame: 2, ms: 500 }, // spout
  { frame: 0, ms: 300 }, // standard
]
