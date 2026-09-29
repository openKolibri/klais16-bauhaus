// The gothic composition. 128 BPM, E harmonic minor, 64 bars (+1 bar of ring-out), instrumental - no voices of any kind.
// One bar = 16 steps = the 16 segments of the display.
//
// The melodic layer is change ringing (see src/shared/ring.js): eight tuned bells ring *plain hunt on eight*.
//   drop 1   bars 16-31   one course at eighth-note rate  (one row per bar)
//   requiem  bars 32-39   a course at sixteenth-note rate (two rows per bar)
//   drop 2   bars 40-55   two more courses at sixteenth-note rate
//   tenebrae bars 56-63   the last course: 128 strikes, one per LED, and every strike snuffs one LED of the board
import * as V from './voices-gothic.mjs';
import { rng, noteNum } from './dsp.mjs';
import { plainHunt, ledOf } from '../shared/ring.js';

export const BPM = 128;
export const STEP = 60 / BPM / 4; // one sixteenth
export const BAR = STEP * 16;
export const BARS = 65; // 64 bars of music + 1 bar of ring-out
export const DURATION = BARS * BAR;
export const t = (bar, step = 0) => (bar * 16 + step) * STEP;

export const SECTIONS = [
  { name: 'candle', bar: 0, bars: 4 },
  { name: 'nave', bar: 4, bars: 4 },
  { name: 'vigil', bar: 8, bars: 8 },
  { name: 'drop1', bar: 16, bars: 16 },
  { name: 'requiem', bar: 32, bars: 8 },
  { name: 'drop2', bar: 40, bars: 16 },
  { name: 'tenebrae', bar: 56, bars: 9 },
];

const N = noteNum;
/** chords: organ voicing, root of the rolling bass and the pitches of the eight bells (treble -> tenor) */
export const CHORDS = {
  Em: { org: [N('E2'), N('B2'), N('E3'), N('G3'), N('B3'), N('E4')], bass: N('E2'), bells: [N('E5'), N('B4'), N('G4'), N('E4'), N('D4'), N('B3'), N('G3'), N('E3')] },
  C: { org: [N('C2'), N('G2'), N('C3'), N('E3'), N('G3'), N('C4')], bass: N('C2'), bells: [N('E5'), N('C5'), N('B4'), N('G4'), N('E4'), N('C4'), N('G3'), N('C3')] },
  Am: { org: [N('A1'), N('E2'), N('A2'), N('C3'), N('E3'), N('A3')], bass: N('A1'), bells: [N('E5'), N('C5'), N('A4'), N('G4'), N('E4'), N('C4'), N('A3'), N('E3')] },
  B: { org: [N('B1'), N('F#2'), N('B2'), N('D#3'), N('F#3'), N('B3')], bass: N('B1'), bells: [N('D#5'), N('B4'), N('A4'), N('F#4'), N('D#4'), N('B3'), N('A3'), N('F#3')] }, // B7: the raised seventh of E harmonic minor
};
const CYCLE = ['Em', 'Em', 'C', 'C', 'Am', 'Am', 'B', 'B'];
export function chordAt(bar) {
  if (bar < 8) return 'Em';
  if (bar < 12) return bar < 10 ? 'Em' : 'C';
  if (bar < 16) return bar < 14 ? 'Am' : 'B';
  if (bar < 32) return CYCLE[(bar - 16) % 8];
  if (bar < 40) return bar < 36 ? 'Em' : bar < 38 ? 'Am' : 'B';
  if (bar < 56) return CYCLE[(bar - 40) % 8];
  if (bar < 60) return 'Em';
  if (bar < 62) return 'Am';
  if (bar < 63) return 'B';
  return 'Em';
}

// the Dies irae (13th-century plainchant, public domain), first phrase transposed to E: E D# E B C B A B - it fits E harmonic
// minor exactly (D# is the leading tone) - and an answering phrase that falls home to the tonic
const DIES_A = [N('E5'), N('D#5'), N('E5'), N('B4'), N('C5'), N('B4'), N('A4'), N('B4')];
const DIES_B = [N('B4'), N('C5'), N('B4'), N('A4'), N('G4'), N('A4'), N('F#4'), N('E4')];
const SCALE16 = ['E3', 'F#3', 'G3', 'A3', 'B3', 'C4', 'D#4', 'E4', 'F#4', 'G4', 'A4', 'B4', 'C5', 'D#5', 'E5', 'F#5'].map(N); // one note per segment

// rolling bass patterns: [step, semitones above the chord root, length in steps, accent, slide]
const PA = [[2, 0, 1, 1, 0], [3, 12, 1, 0, 0], [6, 0, 1, 1, 0], [10, 0, 1, 1, 0], [11, 7, 1, 0, 1], [14, 0, 1, 1, 0], [15, 12, 1, 0, 0]];
const PB = [[2, 0, 1, 1, 0], [3, 0, 1, 0, 0], [5, 12, 1, 0, 0], [6, 0, 1, 1, 0], [7, 0, 1, 0, 0], [9, 7, 1, 0, 0], [10, 0, 1, 1, 0], [11, 0, 1, 0, 0], [13, 12, 1, 0, 0], [14, 0, 1, 1, 0], [15, 7, 1, 0, 1]];

/**
 * Renders every part into its own bus (tr.*) and returns the event lists used by the video.
 * tr: { kick, rumble, bass, snr, chain, perc, organ, stab, lead, ring, toll, cel, heart, atmo, fx }
 */
export function compose(tr) {
  const ev = { kick: [], snare: [], chain: [], drag: [], tick: [], tom: [], clank: [], bass: [], organ: [], stab: [], lead: [], cel: [], bell: [], toll: [], ignite: [], snuff: [], heart: [], crash: [], impact: [], riser: [], chord: [] };
  const hr = rng(1988); // groove humanisation
  const jit = () => (hr() - 0.5) * 0.0012;
  const inDrop = (b) => (b >= 16 && b < 32) || (b >= 40 && b < 60);

  for (let b = 0; b < 64; b++) if (b === 0 || chordAt(b) !== chordAt(b - 1)) ev.chord.push([t(b), chordAt(b), b]);

  // ---------------------------------------------------------------- kick (+ rumble source) and heartbeat
  for (let b = 4; b < 64; b++) {
    let steps = null;
    if (b < 32) steps = b === 15 || b === 31 ? [0, 4, 8] : [0, 4, 8, 12];
    else if (b >= 40 && b < 63) steps = b === 47 || b === 55 ? [0, 4, 8] : [0, 4, 8, 12];
    else if (b === 63) steps = [0];
    if (!steps) continue;
    for (const s of steps) {
      const vel = b >= 60 ? 0.9 - (b - 60) * 0.08 : 1, tt = t(b, s);
      V.kick(tr.kick, tt, vel, { f1: 41.2 });
      ev.kick.push([tt, vel]);
      if ((b >= 16 && b < 32) || (b >= 40 && b < 63)) V.kick(tr.rumble, tt, 1, { f1: 41.2, click: 0, decay: 0.2, len: 0.55 });
    }
  }
  const heart = (b, s, vel) => { V.thump(tr.heart, t(b, s), vel); ev.heart.push([t(b, s), vel]); };
  for (const b of [2, 3]) { heart(b, 0, 0.5); heart(b, 3, 0.3); }
  for (let b = 32; b < 40; b++) for (const [s, v] of [[0, 0.55], [3, 0.36], [8, 0.5], [11, 0.32]]) heart(b, s, v * (b >= 38 ? 0.7 : 1));

  // ---------------------------------------------------------------- chains (the hats), gated snare, clock ticks, war drums, anvil
  for (let b = 6; b < 63; b++) {
    const req = b >= 32 && b < 40;
    for (let s = 0; s < 16; s++) {
      const g = b * 16 + s, tt = t(b, s) + (s % 2 ? 0.03 * STEP : 0) + jit();
      if (!req) {
        if (b < 12) {
          if (s % 4 === 2) { const v = 0.16 + 0.03 * (b - 6); V.chain(tr.chain, tt, v, { n: 3, pan: 0.3 }); ev.chain.push([tt, v]); }
        } else if (s % 4 === 2) { const v = 0.5; V.chain(tr.chain, tt, v, { n: 6, gap: 0.02, fall: 0.82, pan: -0.25 }); ev.drag.push([tt, v]); }
        else if (s % 2 === 1 || (s % 4 === 0 && b >= 16)) { const v = s % 2 ? 0.2 : 0.14; V.chain(tr.chain, tt, v * (b >= 56 ? 1 - (b - 56) * 0.11 : 1), { n: 3, gap: 0.009, pan: s % 4 === 1 ? 0.35 : -0.35 }); ev.chain.push([tt, v]); }
      } else if (b >= 34 && s % 4 === 2) { const v = 0.14 + 0.02 * (b - 34); V.chain(tr.chain, tt, v, { n: 3, pan: 0.4 }); ev.chain.push([tt, v]); }
      // backbeat: the gated-reverb snare
      const snareOn = (b >= 12 && b < 32) || (b >= 40 && b < 62);
      if (snareOn && (s === 4 || (s === 12 && b !== 15 && b !== 31 && b !== 47 && b !== 55))) { V.snare(tr.snr, t(b, s), 0.85, { f: 172, decay: 0.12 }); ev.snare.push([t(b, s), 0.85, 1]); }
      // 5-step clock tick that drifts across the bar line
      if (b >= 6 && g % 5 === 0 && !(b >= 32 && b < 34)) {
        const v = (req ? 0.22 : 0.34) * (b >= 24 && b < 28 ? 1.5 : 1);
        V.tick(tr.perc, t(b, s), v, { pan: (g % 10 === 0 ? -1 : 1) * 0.55, pitch: g % 10 === 0 ? 1900 : 2600 }); ev.tick.push([t(b, s), v, g % 10 === 0 ? 0 : 1]);
      }
      // 7-step war drums
      if (((b >= 28 && b < 32) || (b >= 44 && b < 60)) && g % 7 === 3) {
        const f = [72, 86, 62][Math.floor(g / 7) % 3];
        V.tom(tr.perc, t(b, s), 0.55, { f, decay: 0.24, pan: g % 2 ? 0.4 : -0.4 }); ev.tom.push([t(b, s), 0.55]);
      }
      // 3-step iron clanks in drop 2
      if (b >= 48 && b < 60 && g % 3 === 0) { V.clank(tr.perc, t(b, s), 0.2, { freq: 330 + 55 * (Math.floor(g / 3) % 4), pan: 0.5 * (g % 2 ? 1 : -1) }); ev.clank.push([t(b, s), 0.2]); }
    }
  }
  // the processional: a war drum on every beat that grows through the last bars of the requiem
  for (let b = 36; b < 40; b++) for (const s of b === 39 ? [0, 4, 8] : [0, 4, 8, 12]) {
    const v = 0.3 + 0.13 * (b - 36) + 0.02 * s / 4; V.tom(tr.perc, t(b, s), v, { f: 54, decay: 0.32 }); ev.tom.push([t(b, s), v]);
  }
  // snare rolls
  const roll = (b, from, vel0) => {
    for (let s = from; s < 16; s++) {
      const v = vel0 + (1 - vel0) * ((s - from) / (16 - from));
      V.snare(tr.perc, t(b, s), v * 0.75, { pan: s % 2 ? 0.2 : -0.2, decay: 0.09 }); ev.snare.push([t(b, s), v * 0.75, 0]);
      if (b === 39 && s >= 12) { const t2 = t(b, s) + STEP / 2; V.snare(tr.perc, t2, v * 0.6, { decay: 0.09 }); ev.snare.push([t2, v * 0.6, 0]); }
    }
  };
  roll(15, 8, 0.25); roll(31, 8, 0.25); roll(39, 4, 0.2); roll(47, 8, 0.25); roll(55, 8, 0.25);

  // ---------------------------------------------------------------- rolling bass
  const bassNotes = [];
  for (let b = 12; b < 60; b++) {
    if ((b >= 32 && b < 40) || b === 15 || b === 31 || b === 47 || b === 55) continue;
    const pat = b < 48 ? PA : PB, root = CHORDS[chordAt(b)].bass;
    for (const [s, semi, len, acc, slide] of pat) {
      const tt = t(b, s), dur = len * STEP * (slide ? 1.08 : 0.86);
      bassNotes.push({ t: tt, dur, midi: root + semi, acc: !!acc, slide: !!slide });
      ev.bass.push([tt, dur, root + semi, acc ? 1 : 0]);
    }
  }
  const unit = (x) => Math.min(1, Math.max(0, x));
  const cutoffAt = (tt) => {
    const bar = tt / BAR;
    if (bar < 16) return 170 + 45 * (bar - 12);
    if (bar < 32) return 240 * Math.pow(5.5, unit((bar - 16) / 16));
    return 360 * Math.pow(5, unit((bar - 40) / 16)) * (1 + 0.3 * Math.sin((Math.PI * 2 * bar) / 4));
  };
  V.acid(tr.bass, bassNotes.filter((n) => n.t < t(32)), { cutoffAt, res: 0.55, drive: 1.9, envMod: 1500, decay: 0.11, accDecay: 0.07, accBoost: 1.4, slide: 0.03, from: t(12), to: t(32) + 0.6 });
  V.acid(tr.bass, bassNotes.filter((n) => n.t >= t(40)), { cutoffAt, res: 0.6, drive: 2.0, envMod: 1800, decay: 0.11, accDecay: 0.07, accBoost: 1.4, slide: 0.03, from: t(40), to: t(60) + 0.6 });

  // ---------------------------------------------------------------- organ: long chords and dub-style stabs
  const padSpan = (b0, b1, gain, extra = {}, maxLen = 4) => {
    for (let b = b0; b < b1;) {
      let e = b + 1;
      while (e < b1 && e - b < maxLen && chordAt(e) === chordAt(b)) e++;
      const c = CHORDS[chordAt(b)], d = (e - b) * BAR;
      V.organ(tr.organ, t(b), d, c.org, { gain, ...extra });
      ev.organ.push([t(b), d, ...c.org]);
      b = e;
    }
  };
  padSpan(3, 8, 0.55, { att: 1.8, lp: [500, 1900], rel: 1.2 });
  padSpan(8, 16, 0.42, { att: 0.8, lp: 1700, rel: 1.0 });
  padSpan(16, 32, 0.3, { att: 0.5, lp: 1500, rel: 1.0 }, 2);
  padSpan(32, 40, 1.0, { att: 1.2, lp: [900, 4200], rel: 1.4, stops: 'full' });
  padSpan(40, 56, 0.3, { att: 0.4, lp: 1600, rel: 1.0 }, 2);
  padSpan(56, 64, 0.7, { att: 1.4, lp: 1200, rel: 1.6, stops: 'dark' });
  for (let b = 8; b < 60; b++) {
    if ((b >= 32 && b < 40) || b === 15 || b === 31 || b === 47 || b === 55) continue;
    const notes = CHORDS[chordAt(b)].org.slice(2), steps = b % 2 ? [3, 6, 11] : [3, 10], drop = inDrop(b);
    steps.forEach((s, i) => {
      const tt = t(b, s), vel = (drop ? 0.9 : 0.6) * (i === 1 ? 0.7 : 1);
      V.organ(tr.stab, tt, 0.26, notes, { gain: vel, stops: 'diapason', att: 0.004, rel: 0.1, lp: [drop ? 4200 : 3000, 800], chiff: 0, trem: 0, spread: 0.7 });
      ev.stab.push([tt, vel, ...notes]);
    });
  }

  // ---------------------------------------------------------------- the ring: plain hunt on eight tuned handbells
  const ROWS = plainHunt(8);
  const strike = (bar, step, row, pos, bell, vel, course, chordBar) => {
    const tt = t(bar, step), midi = CHORDS[chordAt(chordBar)].bells[bell - 1];
    V.bell(tr.ring, tt, midi, vel, { size: 0.28, pan: ((bell - 4.5) / 3.5) * 0.6 });
    ev.bell.push([tt, bell, row, pos, midi, course, course >= 0 ? ledOf(row, bell) : 0]);
    return tt;
  };
  /** ring one row starting at (bar, step): `per` steps between strikes; only bells >= minBell sound (ringing up) */
  const ringRow = (bar, step, row, per, vel, course, minBell = 1) => {
    ROWS[row].forEach((bell, pos) => {
      if (bell < minBell) return;
      const s = step + pos * per, b = bar + Math.floor(s / 16);
      strike(b, s % 16, row, pos, bell, vel * (pos === 0 ? 1.12 : 1) * (bell === 8 ? 1.1 : 1), course, b);
    });
  };
  // ringing up: the tenor first, one more bell every bar (bars 4-7); then rounds
  for (let b = 4; b < 8; b++) ringRow(b, 0, 0, 2, 0.75, -1, [8, 7, 5, 1][b - 4]);
  for (let b = 8; b < 12; b++) ringRow(b, 0, 0, 2, 0.62, -1);
  for (let b = 12; b < 16; b++) { ringRow(b, 0, 0, 1, 0.5, -1); ringRow(b, 8, 0, 1, 0.5, -1); }
  // course A - drop 1, one row per bar
  for (let r = 0; r < 16; r++) ringRow(16 + r, 0, r, 2, 0.85, 0);
  // courses B..E at sixteenth-note rate, two rows per bar
  const course16 = (bar0, course, vel, fade = 0) => {
    for (let r = 0; r < 16; r++) ringRow(bar0 + Math.floor(r / 2), (r % 2) * 8, r, 1, vel * (1 - fade * (r / 16)), course);
  };
  course16(32, 1, 0.55);
  course16(40, 2, 0.6);
  course16(48, 3, 0.6);
  course16(56, 4, 0.7, 0.45);
  // the last strike (bar 63, step 15) is the 128th of the last course. Every strike of that course snuffs one LED
  for (const e of ev.bell.filter((x) => x[5] === 4)) { V.snuff(tr.fx, e[0] + 0.004, 0.22 - 0.1 * ((e[0] - t(56)) / (8 * BAR)), { pan: e[1] % 2 ? -0.3 : 0.3 }); ev.snuff.push([e[0], e[6]]); }

  // ---------------------------------------------------------------- the great bell
  const toll = (bar, midi, vel = 0.7, size = 2.4) => { V.bell(tr.toll, t(bar), midi, vel, { size, hum: 0.75, bright: 0.65 }); ev.toll.push([t(bar), midi, vel]); };
  const E2 = N('E2'), B1 = N('B1');
  toll(0, E2, 0.9); toll(2, B1, 0.8);
  for (const b of [4, 8, 12, 16, 20, 24, 28]) toll(b, E2, 0.7);
  [32, 34, 36, 38].forEach((b, i) => toll(b, i % 2 ? B1 : E2, 0.8));
  for (const b of [40, 44, 48, 52]) toll(b, E2, 0.75);
  [56, 58, 60, 62].forEach((b, i) => toll(b, i % 2 ? B1 : E2, 0.7));
  toll(64, E2, 1.0, 3.2);

  // ---------------------------------------------------------------- lead: the Dies irae
  const phrase = (bar, notes, fn) => notes.forEach((m, i) => fn(t(bar) + i * 4 * STEP, m, 4 * STEP * (i === notes.length - 1 ? 1 : 0.92)));
  const reedNote = (tt, m, d) => { V.reed(tr.lead, tt, m, d, { gain: 0.9 }); ev.lead.push([tt, d, m]); };
  for (const b0 of [40, 48]) { phrase(b0, DIES_A, reedNote); phrase(b0 + 2, DIES_B, reedNote); }
  const celNote = (tt, m) => { V.mallet(tr.cel, tt, m, 0.5, { decay: 0.9, pan: ((m % 12) / 12) * 0.8 - 0.4 }); ev.cel.push([tt, m]); };
  phrase(36, DIES_A, (tt, m) => celNote(tt, m)); phrase(38, DIES_B, (tt, m) => celNote(tt, m));
  // a farewell on the flute stop, half-note by half-note (8 steps per note)
  [DIES_A, DIES_B].forEach((notes, k) => notes.forEach((m, i) => {
    const tt = t(56 + 4 * k) + i * 8 * STEP;
    V.organ(tr.lead, tt, 8 * STEP * 0.95, [m], { gain: 0.75, stops: 'flute', att: 0.03, rel: 0.3, lp: 2600, chiff: 0.1, trem: 0.03, spread: 0 });
    ev.lead.push([tt, 8 * STEP, m]);
  }));

  // ---------------------------------------------------------------- fiat lux: the display ignites (bar 1) and the underline rings rounds (bar 2)
  SCALE16.forEach((m, s) => {
    V.mallet(tr.cel, t(1, s), m, 0.42, { decay: 0.85, pan: (s / 15) * 1.2 - 0.6 });
    V.spark(tr.cel, t(1, s), 0.3, { pan: (s / 15) * 1.2 - 0.6, pitch: 3200 + 120 * s });
    ev.ignite.push([t(1, s), s]);
  });
  for (let k = 0; k < 8; k++) {
    strike(2, k * 2, 0, k, k + 1, 0.7, -1, 2);
    V.spark(tr.cel, t(2, k * 2), 0.28, { pan: (k / 7) * 1.2 - 0.6, pitch: 2600 });
    ev.ignite.push([t(2, k * 2), 17 + k]);
  }
  V.spark(tr.cel, t(3), 0.4, { pitch: 2200 }); ev.ignite.push([t(3), 16]);

  // ---------------------------------------------------------------- atmosphere
  V.drone(tr.atmo, 0, t(8), [N('E1'), N('B1'), N('E2')], { gain: 0.5, cutoff: 330, fadeIn: 5, fadeOut: 2.5 });
  V.wind(tr.atmo, 0, t(8), { gain: 0.1, f0: 300, f1: 1300, fadeIn: 3, fadeOut: 2 });
  V.crackle(tr.atmo, 0, t(6), { gain: 0.22, rate: 14, fadeIn: 1.5, fadeOut: 3 });
  V.drone(tr.atmo, t(32), t(8), [N('E1'), N('B1'), N('G2')], { gain: 0.55, cutoff: 480, fadeIn: 2.5, fadeOut: 3, lfo: 0.08 });
  V.wind(tr.atmo, t(32), t(8), { gain: 0.09, f0: 450, f1: 2400, fadeIn: 2, fadeOut: 2 });
  V.crackle(tr.atmo, t(32), t(8), { gain: 0.14, rate: 9, fadeIn: 2, fadeOut: 2, seed: 8 });
  V.drone(tr.atmo, t(56), t(9), [N('E1'), N('B1'), N('E2'), N('G2')], { gain: 0.5, cutoff: 300, fadeIn: 2, fadeOut: 6 });
  V.wind(tr.atmo, t(57), t(8), { gain: 0.08, f0: 320, f1: 1000, fadeIn: 2, fadeOut: 4 });
  V.crackle(tr.atmo, t(56), t(9), { gain: 0.16, rate: 7, fadeIn: 1, fadeOut: 5, seed: 13 });

  // ---------------------------------------------------------------- transitions
  const hit = (bar, vel = 1, big = true) => {
    V.crash(tr.fx, t(bar), 0.4 * vel, { decay: 1.3 }); ev.crash.push([t(bar), 0.4 * vel]);
    V.impact(tr.fx, t(bar), (big ? 1 : 0.6) * vel); ev.impact.push([t(bar), (big ? 1 : 0.6) * vel]);
  };
  const back = (bar, midi, vel = 0.7, dur = 2.4) => V.bell(tr.fx, t(bar), midi, vel, { reverse: true, dur, size: 1.2, bright: 0.8 });
  back(4, N('E3'), 0.6, 1.8); hit(8, 0.6, false);
  V.riser(tr.fx, t(14), 2 * BAR - STEP, { gain: 0.5, tone: 0.05 }); ev.riser.push([t(14), 2 * BAR]);
  back(16, N('E3'), 0.9, 2.0); hit(16, 1);
  V.riser(tr.fx, t(28), 4 * BAR - STEP, { gain: 0.3, f0: 400, f1: 7000, curve: 2 }); ev.riser.push([t(28), 4 * BAR]);
  hit(32, 0.6, false);
  V.riser(tr.fx, t(36), 4 * BAR - STEP, { gain: 0.75, f0: 200, f1: 11000, tone: 0.08 }); ev.riser.push([t(36), 4 * BAR]);
  V.organ(tr.fx, t(36), 4 * BAR - STEP, [N('E3'), N('B3'), N('E4'), N('G4'), N('B4')], { gain: 0.7, att: 3.6, rel: 0.05, lp: [300, 7000], stops: 'full', trem: 0.08 });
  back(40, N('B3'), 1.0, 2.6); hit(40, 1.15);
  V.riser(tr.fx, t(46), 2 * BAR - STEP, { gain: 0.5, tone: 0.05 }); ev.riser.push([t(46), 2 * BAR]);
  hit(48, 0.6, false);
  V.riser(tr.fx, t(54), 2 * BAR - STEP, { gain: 0.5, tone: 0.05 }); ev.riser.push([t(54), 2 * BAR]);
  hit(56, 0.9);
  V.impact(tr.fx, t(64), 1.1, { decay: 1.6 }); ev.impact.push([t(64), 1.1]);

  return { ev, cutoffAt };
}
