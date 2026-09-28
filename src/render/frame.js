// Per-frame context handed to every scene: drawing contexts, time, musical position and cue envelopes.
export function makeFrame({ ctx, glow, W, H, G, cues, T, Tc, fps }) {
  const c = cues;
  const f = {
    kick: c.env('kick', Tc, 0.16),
    kickS: c.env('kick', Tc, 0.06),
    kickN: c.count('kick', Tc),
    clap: c.env('clap', Tc, 0.14),
    hat: c.env('hatC', Tc, 0.05),
    ohat: c.env('hatO', Tc, 0.14),
    acid: c.envV('acid', Tc, 0.17),
    stab: c.env('stab', Tc, 0.24),
    tick: c.env('tick', Tc, 0.09),
    tom: c.env('tom', Tc, 0.15),
    snare: c.env('snare', Tc, 0.1),
    clank: c.env('clank', Tc, 0.12),
    blip: c.env('blip', Tc, 0.1),
    pluck: c.env('pluck', Tc, 0.12),
    crash: c.env('crash', Tc, 0.7),
    impact: c.env('impact', Tc, 0.5),
    boot: c.env('boot', Tc, 0.12),
    voice: c.env('voice', Tc, 0.16),
    rms: c.rms(Tc),
    bands: c.bands(Tc, new Float32Array(c.sp.bands)),
  };
  return {
    ctx, glow, W, H, G, cues, T, Tc, fps, f,
    bar: Tc / c.BAR, beat: Tc / c.BEAT, step: Tc / c.STEP,
    BAR: c.BAR, BEAT: c.BEAT, STEP: c.STEP,
    // filled by the timeline:
    sc: null, lt: 0, lbar: 0, u: 0,
    // scene-requested post fx
    fx: { bloom: 1, bloomMul: 1, glitch: 0, split: 0, flash: 0, shake: 0 },
  };
}
