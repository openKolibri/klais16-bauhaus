// Scene timeline. Bars are 0-indexed; scene [b0, b1) is drawn while b0 <= bar < b1.
import { hud, shockRing } from './furniture.js';
import { fiat } from './scenes/fiat.js';
import { belfry } from './scenes/belfry.js';
import { rosa } from './scenes/rosa.js';
import { hunt } from './scenes/hunt.js';
import { nave } from './scenes/nave.js';
import { organ } from './scenes/organ.js';
import { clock } from './scenes/clock.js';
import { strata } from './scenes/strata.js';
import { codex } from './scenes/codex.js';
import { chandeliers } from './scenes/chandeliers.js';
import { rosa2 } from './scenes/rosa2.js';
import { ossarium } from './scenes/ossarium.js';
import { tenebrae } from './scenes/tenebrae.js';
import { drawTransition } from './transitions.js';

export const SCENES = [
  { name: 'fiat', b0: 0, b1: 4, draw: fiat, hud: false },
  { name: 'belfry', b0: 4, b1: 8, draw: belfry, hud: 'min' },
  { name: 'rosa', b0: 8, b1: 12, draw: rosa, hud: true },
  { name: 'hunt', b0: 12, b1: 16, draw: hunt, hud: 'min' },
  { name: 'nave', b0: 16, b1: 24, hud: 'min',
    draw: nave({ z0: 4, z1: 96, roseZ: 168, roseR: 10, board: { course: 0 }, title: 'ECCE  LUMEN',
      roseLit: (C) => (i) => { const row = Math.floor(C.bar) - 16; return i < row ? 0.55 : i === row ? 0.55 + 0.4 * Math.exp(-(C.bar % 1) * 3) : 0.02; } }) },
  { name: 'organ', b0: 24, b1: 28, draw: organ, hud: 'min' },
  { name: 'clock', b0: 28, b1: 32, draw: clock, hud: 'min' },
  { name: 'strata', b0: 32, b1: 36, draw: strata, hud: 'min' },
  { name: 'codex', b0: 36, b1: 40, draw: codex, hud: 'min' },
  { name: 'chandeliers', b0: 40, b1: 44, draw: chandeliers, hud: 'min' },
  { name: 'rosa2', b0: 44, b1: 48, draw: rosa2, hud: 'min' },
  { name: 'ossarium', b0: 48, b1: 56, draw: ossarium, hud: 'min' },
  { name: 'tenebrae', b0: 56, b1: 65, draw: tenebrae, hud: false },
];

export function drawTimeline(C) {
  let sc = SCENES[0];
  for (const s of SCENES) if (C.bar >= s.b0 - 1e-9) sc = s;
  C.sc = sc; C.lbar = C.bar - sc.b0; C.lt = C.Tc - sc.b0 * C.BAR; C.u = C.lbar / (sc.b1 - sc.b0);
  sc.draw(C);
  shockRing(C);
  drawTransition(C);
  if (sc.hud) hud(C, { steps: sc.hud !== 'min' });
}
