// Scene timeline. Bars are 0-indexed; scene [b0, b1) is drawn while b0 <= bar < b1.
import { drawHud } from './hud.js';
import { P } from './util.js';
import { shock } from './ui.js';
import { wall } from './scenes/wall.js';
import { boot } from './scenes/boot.js';
import { chainTitle } from './scenes/strip.js';
import { scan } from './scenes/scan.js';
import { ascii } from './scenes/ascii.js';
import { words } from './scenes/words.js';
import { kaleido } from './scenes/kaleido.js';
import { sequencer } from './scenes/sequencer.js';
import { tunnel } from './scenes/tunnel.js';
import { stack } from './scenes/stack.js';
import { table } from './scenes/table.js';
import { poster } from './scenes/poster.js';
import { marquee } from './scenes/marquee.js';
import { end } from './scenes/end.js';
import { array3d } from './scenes/array3d.js';
import { drawTransition } from './transitions.js';

export const SCENES = [
  { name: 'boot', b0: 0, b1: 3, draw: boot, hud: false },
  { name: 'chain', b0: 3, b1: 6, draw: chainTitle },
  { name: 'scan', b0: 6, b1: 8, draw: scan },
  { name: 'ascii', b0: 8, b1: 12, draw: ascii, hud: 'min' },
  { name: 'words', b0: 12, b1: 16, draw: words },
  { name: 'wall', b0: 16, b1: 20, draw: wall({ mode: 'words', comp: 'quads', invert: 'none' }), hud: false },
  { name: 'kaleido', b0: 20, b1: 24, draw: kaleido(), hud: 'min' },
  { name: 'sequencer', b0: 24, b1: 28, draw: sequencer, hud: 'min' },
  { name: 'tunnel', b0: 28, b1: 32, draw: tunnel(), hud: 'min' },
  { name: 'stack', b0: 32, b1: 40, draw: stack, hud: 'min' },
  { name: 'table', b0: 40, b1: 44, draw: table(), hud: false },
  { name: 'wall2', b0: 44, b1: 48, draw: wall({ mode: 'marquee', comp: 'sun', invert: 'kick', lines: ['OPEN HARDWARE ', 'KLAIS 16 ', 'CERN OHL S '] }), hud: false },
  { name: 'array', b0: 48, b1: 52, draw: array3d, hud: 'min' },
  { name: 'tunnel2', b0: 52, b1: 56, draw: tunnel({ twist: -0.4, speed0: 1.2, speed1: 3.0 }), hud: 'min' },
  { name: 'poster', b0: 56, b1: 60, draw: poster, hud: false },
  { name: 'url', b0: 60, b1: 64, draw: marquee(), hud: 'min' },
  { name: 'end', b0: 64, b1: 65, draw: end, hud: false },
];

export function drawTimeline(C) {
  let sc = SCENES[0];
  for (const s of SCENES) if (C.bar >= s.b0 - 1e-9) sc = s;
  C.sc = sc; C.lbar = C.bar - sc.b0; C.lt = C.Tc - sc.b0 * C.BAR; C.u = C.lbar / (sc.b1 - sc.b0);
  sc.draw(C);
  C.fx.split = Math.max(C.fx.split, 2.4 * C.f.voice);   // a tiny RGB split on every vocal hit
  shock(C);
  drawTransition(C);
  if (sc.hud !== false) drawHud(C, { steps: sc.hud !== 'min' });
}
