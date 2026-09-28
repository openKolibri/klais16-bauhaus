// The composition. 132 BPM, F minor / phrygian, 64 bars (+1 bar of tail).
// Every rhythmic part is a 16-step pattern: one bar = 16 steps = the 16 segments of the display.
import * as V from './voices.mjs';
import { rng, noteNum } from './dsp.mjs';

export const BPM = 132;
export const STEP = 60 / BPM / 4; // one sixteenth
export const BAR = STEP * 16;
export const BARS = 65; // 64 bars of music + 1 bar of ring-out
export const DURATION = BARS * BAR;
export const t = (bar, step = 0) => (bar * 16 + step) * STEP;

export const SECTIONS = [
  { name: 'boot', bar: 0, bars: 4 },
  { name: 'scan', bar: 4, bars: 4 },
  { name: 'ascii', bar: 8, bars: 8 },
  { name: 'drop1', bar: 16, bars: 16 },
  { name: 'stack', bar: 32, bars: 8 },
  { name: 'drop2', bar: 40, bars: 16 },
  { name: 'outro', bar: 56, bars: 9 },
];

// The UART rhythm layer: 8N1 frames (start bit, 8 data bits LSB first, stop bit) of this text, one bit per 16th note.
export const MESSAGE = 'KLAIS-16 SIXTEEN SEGMENT DISPLAY ';
export const UART_START = 4 * 16; // global step where the stream begins (bar 4)
export const uartBit = (g) => {
  if (g < UART_START) return { bit: 0, pos: 0, char: -1 };
  const k = g - UART_START, char = Math.floor(k / 10) % MESSAGE.length, pos = k % 10;
  const code = MESSAGE.charCodeAt(char);
  const bit = pos === 0 ? 0 : pos === 9 ? 1 : (code >> (pos - 1)) & 1;
  return { bit, pos, char, code };
};
const BLIP_SCALE = [77, 80, 84, 87, 91, 82, 75, 89]; // F5 Ab5 C6 Eb6 G6 Bb5 Eb5 F6

// chords (MIDI)
const N = noteNum;
const CH = {
  Fm7: [N('F3'), N('Ab3'), N('C4'), N('Eb4')],
  Gbmaj7: [N('Gb3'), N('Bb3'), N('Db4'), N('F4')],
  Dbmaj7: [N('Db3'), N('F3'), N('Ab3'), N('C4')],
  Ebsus: [N('Eb3'), N('Bb3'), N('F4'), N('Ab4')],
  Fm9: [N('F3'), N('Ab3'), N('C4'), N('Eb4'), N('G4')],
  Dbmaj9: [N('Db3'), N('F3'), N('Ab3'), N('C4'), N('Eb4')],
  Gbmaj7s: [N('Gb3'), N('Bb3'), N('Db4'), N('F4'), N('Ab4')],
};
const stabChord = (b) => (b < 24 ? [CH.Fm7, CH.Fm7, CH.Gbmaj7, CH.Fm7] : b < 48 ? [CH.Fm7, CH.Dbmaj7, CH.Gbmaj7, CH.Fm7] : [CH.Fm7, CH.Gbmaj7, CH.Dbmaj7, CH.Ebsus])[b % 4];
const padChord = (b) => [CH.Fm9, CH.Dbmaj9, CH.Gbmaj7s, CH.Ebsus][Math.floor(b / 2) % 4];

// acid patterns: [step, semitones above F2, length in steps, accent, slide]
const F2 = N('F2');
const P1 = [[0, 0, 1, 1, 0], [2, 0, 1, 0, 0], [3, 12, 1, 0, 0], [5, 0, 1, 0, 0], [6, 3, 1, 1, 0], [8, 0, 1, 0, 0], [10, 0, 1, 0, 0], [11, 7, 1, 0, 1], [12, 1, 2, 1, 0], [14, 0, 1, 0, 0], [15, 12, 1, 0, 1]];
const P2 = [[0, 0, 1, 1, 0], [1, 0, 1, 0, 0], [3, 0, 1, 0, 0], [4, 3, 1, 1, 0], [6, 0, 1, 0, 0], [7, 12, 1, 0, 1], [8, 10, 1, 1, 0], [10, 7, 1, 0, 0], [11, 5, 1, 0, 1], [12, 3, 1, 1, 0], [14, 1, 1, 0, 0], [15, 0, 1, 0, 0]];
const P3 = Array.from({ length: 16 }, (_, s) => [s, s % 8 === 6 ? 12 : s === 13 ? 1 : s === 7 ? 3 : 0, 1, s % 3 === 0 ? 1 : 0, 0]);

/**
 * Renders every part into its own bus (tr.*) and returns the event lists used by the video.
 * tr: { kick, rumble, acid, hats, clap, perc, stab, pad, pluck, blip, atmo, fx }
 */
export function compose(tr) {
  const ev = { kick: [], clap: [], hatC: [], hatO: [], tick: [], tom: [], clank: [], snare: [], crash: [], impact: [], stab: [], acid: [], blip: [], pluck: [], pad: [], riser: [], boot: [], voice: [] };
  const hr = rng(77); // groove humanisation
  const jit = () => (hr() - 0.5) * 0.0012;

  // ---------------------------------------------------------------- kick (+ rumble source)
  const kickBars = [];
  for (let b = 0; b < 64; b++) {
    let steps = null;
    if (b === 2 || b === 3) steps = [[0, { vel: 0.5, lp: 120 }]];
    else if (b >= 4 && b <= 7) steps = [0, 4, 8, 12];
    else if (b >= 8 && b <= 31) steps = b === 15 || b === 31 ? [0, 4, 8] : [0, 4, 8, 12];
    else if (b >= 40 && b <= 62) steps = b === 47 || b === 55 ? [0, 4, 8] : [0, 4, 8, 12];
    else if (b === 63) steps = [0];
    if (!steps) continue;
    for (const st of steps) {
      const [s, o] = Array.isArray(st) ? st : [st, {}];
      const vel = o.vel ?? (b >= 60 ? 0.9 - (b - 60) * 0.08 : 1);
      const tt = t(b, s);
      V.kick(tr.kick, tt, vel, o.lp ? { lp: o.lp } : {});
      ev.kick.push([tt, vel]);
      const rumbleOn = (b >= 8 && b <= 31) || (b >= 40 && b <= 62);
      if (rumbleOn) V.kick(tr.rumble, tt, 1, { click: 0, decay: 0.2, len: 0.55 });
      kickBars.push(b);
    }
  }

  // ---------------------------------------------------------------- hats / clap / percussion
  for (let b = 4; b < 63; b++) {
    const brk = b >= 32 && b < 40;
    for (let s = 0; s < 16; s++) {
      const g = b * 16 + s;
      const swing = s % 2 === 1 ? 0.03 * STEP : 0;
      const tt = t(b, s) + swing + jit();
      const openOn = (b >= 10 && b < 32) || (b >= 40 && b < 60);
      // closed / open hats
      if (b < 8) {
        if (s % 4 === 2) { const v = 0.16 + 0.05 * (b - 4); V.hat(tr.hats, tt, v, { pan: 0.3 }); ev.hatC.push([tt, v]); }
      } else if (!brk) {
        const mod = s % 4;
        if (mod === 2 && openOn) { V.hat(tr.hats, tt, 0.5, { decay: 0.16, pan: -0.25 }); ev.hatO.push([tt, 0.5]); }
        else {
          const v = mod === 0 ? 0.26 : mod === 1 ? 0.2 : mod === 2 ? 0.5 : 0.3;
          const vv = v * (b >= 56 ? 1 - (b - 56) * 0.09 : 1);
          V.hat(tr.hats, tt, vv, { pan: mod === 1 ? 0.35 : mod === 3 ? -0.35 : 0 }); ev.hatC.push([tt, vv]);
        }
      } else if (b >= 34 && s % 4 === 2) {
        const v = 0.14 + 0.02 * (b - 34); V.hat(tr.hats, tt, v, { pan: 0.4 }); ev.hatC.push([tt, v]);
      }
      // claps on 2 and 4
      const clapOn = (b >= 12 && b < 32) || (b >= 40 && b < 62);
      if (clapOn && (s === 4 || s === 12)) { V.clap(tr.clap, t(b, s), 0.75, { pan: 0.05 }); ev.clap.push([t(b, s), 0.75]); }
      if (b >= 48 && b < 60 && s === 14) { V.clap(tr.clap, t(b, s), 0.28, { pan: -0.3 }); ev.clap.push([t(b, s), 0.28]); }
      // 5-step tick loop (drifts across the bar line)
      if (b >= 6 && g % 5 === 0 && !(b >= 32 && b < 34)) {
        const v = brk ? 0.22 : 0.34, pan = (g % 10 === 0 ? -1 : 1) * 0.55;
        V.tick(tr.perc, t(b, s), v, { pan, pitch: g % 10 === 0 ? 2400 : 3100 }); ev.tick.push([t(b, s), v]);
      }
      // 7-step toms
      if (((b >= 24 && b < 32) || (b >= 44 && b < 60)) && g % 7 === 3) {
        const f = [92, 110, 82][Math.floor(g / 7) % 3];
        V.tom(tr.perc, t(b, s), 0.5, { f, pan: (g % 2 ? 0.4 : -0.4) }); ev.tom.push([t(b, s), 0.5]);
      }
      // 3-step clanks in the second drop
      if (b >= 48 && b < 60 && g % 3 === 0) {
        V.clank(tr.perc, t(b, s), 0.2, { freq: 380 + 60 * (Math.floor(g / 3) % 4), pan: 0.5 * (g % 2 ? 1 : -1) }); ev.clank.push([t(b, s), 0.2]);
      }
    }
  }

  // ---------------------------------------------------------------- fills
  const roll = (b, fromStep, vel0) => {
    for (let s = fromStep; s < 16; s++) {
      const v = vel0 + (1 - vel0) * ((s - fromStep) / (16 - fromStep));
      V.snare(tr.perc, t(b, s), v * 0.75, { pan: (s % 2 ? 0.2 : -0.2) }); ev.snare.push([t(b, s), v * 0.75]);
      if (b === 39 && s >= 12) { const t2 = t(b, s) + STEP / 2; V.snare(tr.perc, t2, v * 0.6); ev.snare.push([t2, v * 0.6]); }
    }
  };
  roll(15, 8, 0.25); roll(31, 8, 0.25); roll(39, 4, 0.2); roll(47, 8, 0.25); roll(55, 8, 0.25);

  // ---------------------------------------------------------------- acid bass
  const acidNotes = [];
  const addAcid = (b, pat, octave = 0) => {
    for (const [s, semi, len, acc, slide] of pat) {
      const tt = t(b, s), dur = len * STEP * (slide ? 1.08 : 0.86);
      acidNotes.push({ t: tt, dur, midi: F2 + semi + octave, acc: !!acc, slide: !!slide });
      ev.acid.push([tt, dur, F2 + semi + octave, acc ? 1 : 0]);
    }
  };
  for (let b = 16; b < 32; b++) addAcid(b, (b - 16) % 4 === 3 ? P2 : P1);
  for (let b = 40; b < 56; b++) addAcid(b, b >= 48 ? P3 : (b - 40) % 4 === 3 ? P2 : P1);
  const cutoffAt = (tt) => {
    const bar = tt / BAR;
    if (bar < 32) { const u = Math.min(1, Math.max(0, (bar - 16) / 16)); return 300 * Math.pow(6.3, u); }
    const u = Math.min(1, Math.max(0, (bar - 40) / 16));
    return 480 * Math.pow(5.4, u) * (1 + 0.32 * Math.sin((Math.PI * 2 * bar) / 4));
  };
  V.acid(tr.acid, acidNotes.filter((n) => n.t < t(32)), { cutoffAt, res: 0.9, envMod: 2100, from: t(16), to: t(32) + 0.6 });
  V.acid(tr.acid, acidNotes.filter((n) => n.t >= t(40)), { cutoffAt, res: 0.93, envMod: 2600, from: t(40), to: t(56) + 0.6 });

  // ---------------------------------------------------------------- chord stabs (dub techno)
  for (let b = 8; b < 60; b++) {
    if ((b >= 32 && b < 40) || b === 15 || b === 31 || b === 47 || b === 55) continue;
    const ch = stabChord(b), steps = b % 2 ? [3, 6, 11] : [3, 10];
    const drop = (b >= 16 && b < 32) || (b >= 40 && b < 56);
    steps.forEach((s, i) => {
      const tt = t(b, s), vel = (drop ? 0.9 : 0.65) * (i === 1 ? 0.7 : 1);
      V.stab(tr.stab, tt, ch, { dur: 0.32, gain: vel, pan: i % 2 ? 0.3 : -0.3, cutoff: drop ? 1900 : 1300 });
      ev.stab.push([tt, vel, ...ch]);
    });
  }

  // ---------------------------------------------------------------- pads, arp, data blips
  const padSpan = (b0, b1, gain, extra = {}) => {
    for (let b = b0; b < b1; b += 2) {
      const ch = padChord(b);
      V.pad(tr.pad, t(b), 2 * BAR, ch, { gain, ...extra });
      V.pad(tr.pad, t(b), 2 * BAR, [N('F1') + (ch[0] === N('Db3') ? -4 : 0)], { gain: gain * 0.9, voices: 2, cutoff: 260, att: 0.5 });
      ev.pad.push([t(b), 2 * BAR, ...ch]);
    }
  };
  padSpan(4, 8, 0.5, { att: 1.6, cutoff: 700 });
  padSpan(16, 32, 0.3);
  padSpan(32, 40, 1.0, { att: 1.2, cutoff: 1250 });
  padSpan(40, 56, 0.28);
  padSpan(56, 64, 0.8, { att: 1.4, cutoff: 900 });

  const arp = (b0, b1, gain) => {
    for (let b = b0; b < b1; b++) {
      const ch = padChord(b), pool = [...ch, ch[0] + 12, ch[1] + 12, ch[2] + 12];
      for (let s = 0; s < 16; s++) {
        const idx = [0, 2, 4, 1, 3, 5, 2, 6, 4, 1, 5, 3, 6, 2, 4, 0][s] % pool.length;
        const midi = pool[idx] + 12, tt = t(b, s);
        V.pluck(tr.pluck, tt, midi, { dur: 0.2, gain: gain * (s % 4 === 0 ? 1 : 0.7), pan: ((idx % 5) / 4 - 0.5) * 1.2 });
        ev.pluck.push([tt, midi]);
      }
    }
  };
  arp(33, 40, 0.75);
  arp(48, 56, 0.45);

  const blipGain = (b) => (b < 8 ? 0.25 + 0.15 * (b - 4) : b < 16 ? 0.55 : b < 32 ? 0.6 : b < 40 ? 1 : b < 56 ? 0.6 : b < 62 ? 0.5 : 0);
  for (let g = UART_START; g < 62 * 16; g++) {
    const b = Math.floor(g / 16), { bit, pos, char } = uartBit(g);
    if (!bit) continue;
    const gain = blipGain(b);
    if (!gain) continue;
    const midi = pos === 9 ? 65 : BLIP_SCALE[(pos - 1) % 8];
    const vel = (pos === 9 ? 0.55 : 0.4) * gain;
    V.blip(tr.blip, g * STEP, midi, vel, ((pos / 9) * 2 - 1) * 0.6);
    ev.blip.push([g * STEP, midi, pos, char]);
  }

  // ---------------------------------------------------------------- boot self-test: one chirp per segment (A..U) in bar 1
  const BOOT = [65, 66, 68, 70, 72, 73, 75, 77, 78, 80, 82, 84, 85, 87, 89, 90]; // F phrygian, two octaves up
  BOOT.forEach((m, s) => {
    V.blip(tr.blip, t(1, s), m, 0.42, (s / 15) * 1.2 - 0.6);
    ev.boot.push([t(1, s), m, s]);
  });

  // ---------------------------------------------------------------- robot voice: the README's three title words
  // row = which line of the wall the syllable belongs to (SIXTEEN / SEGMENT / DISPLAY), -1 = product name
  const ROW = { six: 0, teen: 0, sixteen: 0, seg: 1, ment: 1, segment: 1, dis: 2, play: 2, display: 2, klais: -1, kolibri: -1, klai: -1 };
  const say = (bar, step, name, o = {}) => {
    const tt = t(bar, step) + (o.off || 0);
    const d = V.voice(tr.voice, tt, name, { gain: 1, ...o });
    ev.voice.push([tt, name, d, ROW[name] ?? -1, o.rate || 1]);
  };
  const chant = (bar, o = {}) => {
    say(bar, 0, 'six', { len: 0.44, ...o }); say(bar, 4, 'teen', { len: 0.42, ...o });
    say(bar, 8, 'seg', { len: 0.44, ...o }); say(bar, 12, 'ment', { len: 0.44, ...o });
    say(bar + 1, 0, 'dis', { len: 0.4, ...o }); say(bar + 1, 4, 'play', { len: 0.42, ...o });
    say(bar + 1, 8, 'klais', { len: 0.5, ...o });
  };
  const stutter = (bar, from, rate0, o = {}) => {
    for (const s of [0, 2, 3, 4, 6, 7, 8, 10, 11, 12, 14, 15].filter((x) => x >= from)) say(bar, s, 'six', { len: 0.09, rate: rate0 + (s / 15) * 0.5, gain: 0.85, ...o });
  };
  // build: each word lands exactly as its letters type in on screen (bars 12-14)
  say(12, 0, 'sixteen', { rate: 0.95 }); say(13, 0, 'segment', { rate: 0.95 }); say(14, 0, 'display', { rate: 0.95 });
  stutter(15, 8, 0.9);
  // drop 1
  for (const b of [18, 22, 26]) chant(b);
  say(30, 0, 'six', { len: 0.44 }); say(30, 4, 'teen', { len: 0.42 }); say(30, 8, 'seg', { len: 0.44 }); say(30, 12, 'ment', { len: 0.44 });
  // breakdown: whispers with long tails, then a reversed word that lands on the drop
  say(33, 0, 'sixteen', { rate: 0.72, gain: 0.9 }); say(35, 0, 'segment', { rate: 0.72, gain: 0.9 }); say(37, 0, 'kolibri', { rate: 0.7, gain: 0.9 });
  { const d = V.voice(tr.voice, t(40), 'display', { rate: 0.8, reverse: true, gain: 1 }); ev.voice.push([t(40) - d, 'display', d, 2, -0.8]); }
  // drop 2: the chant comes back faster and higher, with a stutter fill in the middle
  for (const b of [42, 46]) chant(b, { rate: 1.1 });
  stutter(50, 0, 1.0, { crush: 9000 }); stutter(51, 0, 1.2, { crush: 9000 });
  chant(52, { rate: 1.1 });
  say(54, 0, 'sixteen', { rate: 1.1 }); say(54, 8, 'segment', { rate: 1.1 }); say(55, 0, 'display', { rate: 1.1 });
  // outro
  say(56, 0, 'klais', { rate: 0.9 }); say(56, 6, 'sixteen', { rate: 0.9 });
  say(60, 0, 'kolibri', { rate: 0.85, gain: 0.9 });
  say(63, 0, 'klais', { rate: 0.7, gain: 0.9 });

  // ---------------------------------------------------------------- atmosphere
  V.hum(tr.atmo, 0, t(5), { gain: 0.06, fadeIn: 1.5, fadeOut: 3.5 });
  V.drone(tr.atmo, 0, t(8), [N('F1'), N('F2'), N('C3')], { gain: 0.5, cutoff: 360, fadeIn: 5, fadeOut: 2.5 });
  V.wind(tr.atmo, 0, t(8), { gain: 0.12, f0: 380, f1: 1500, fadeIn: 3, fadeOut: 2 });
  V.drone(tr.atmo, t(32), t(8), [N('F1'), N('C2'), N('Ab2')], { gain: 0.6, cutoff: 520, fadeIn: 2.5, fadeOut: 3, lfo: 0.08 });
  V.wind(tr.atmo, t(32), t(8), { gain: 0.1, f0: 500, f1: 2600, fadeIn: 2, fadeOut: 2 });
  V.drone(tr.atmo, t(56), t(9), [N('F1'), N('F2'), N('C3'), N('Ab2')], { gain: 0.55, cutoff: 340, fadeIn: 2, fadeOut: 6 });
  V.wind(tr.atmo, t(57), t(8), { gain: 0.09, f0: 350, f1: 1200, fadeIn: 2, fadeOut: 4 });

  // ---------------------------------------------------------------- transitions
  const hit = (bar, vel = 1, big = true) => {
    V.crash(tr.fx, t(bar), 0.55 * vel, { decay: 1.3 }); ev.crash.push([t(bar), 0.55 * vel]);
    V.impact(tr.fx, t(bar), (big ? 1 : 0.6) * vel); ev.impact.push([t(bar), (big ? 1 : 0.6) * vel]);
  };
  V.crash(tr.fx, t(8), 0.5, { reverse: true, dur: 1.8 });
  hit(8, 0.6, false);
  V.riser(tr.fx, t(14), 2 * BAR - STEP, { gain: 0.55, tone: 0.06 }); ev.riser.push([t(14), 2 * BAR]);
  V.crash(tr.fx, t(16), 0.6, { reverse: true, dur: 1.6 });
  hit(16, 1);
  V.riser(tr.fx, t(28), 4 * BAR - STEP, { gain: 0.35, f0: 400, f1: 7000, curve: 2 }); ev.riser.push([t(28), 4 * BAR]);
  hit(32, 0.6, false);
  V.riser(tr.fx, t(36), 4 * BAR - STEP, { gain: 0.8, f0: 200, f1: 11000, tone: 0.09 }); ev.riser.push([t(36), 4 * BAR]);
  V.crash(tr.fx, t(40), 0.7, { reverse: true, dur: 2.2 });
  hit(40, 1.15);
  V.riser(tr.fx, t(46), 2 * BAR - STEP, { gain: 0.5, tone: 0.05 }); ev.riser.push([t(46), 2 * BAR]);
  hit(48, 0.6, false);
  V.riser(tr.fx, t(54), 2 * BAR - STEP, { gain: 0.55, tone: 0.05 }); ev.riser.push([t(54), 2 * BAR]);
  hit(56, 0.9);
  V.impact(tr.fx, t(63), 1.1, { decay: 1.6 }); ev.impact.push([t(63), 1.1]);
  V.crash(tr.fx, t(63), 0.6, { decay: 2.0, dur: 5 }); ev.crash.push([t(63), 0.6]);

  return { ev, cutoffAt };
}
