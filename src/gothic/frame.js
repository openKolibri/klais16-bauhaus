// Per-frame context handed to every gothic scene: drawing contexts, time, musical position and cue envelopes.
export function makeFrame({ ctx, glow, W, H, G, cues, T, Tc, fps }) {
  const c = cues;
  const f = {
    kick: c.env('kick', Tc, 0.16),
    kickS: c.env('kick', Tc, 0.06),
    kickN: c.count('kick', Tc),
    snare: c.env('snare', Tc, 0.14),
    chain: c.env('chain', Tc, 0.05),
    drag: c.env('drag', Tc, 0.14),
    tick: c.env('tick', Tc, 0.09),
    tom: c.env('tom', Tc, 0.18),
    clank: c.env('clank', Tc, 0.12),
    bass: c.envV('bass', Tc, 0.14),
    stab: c.env('stab', Tc, 0.22),
    lead: c.env('lead', Tc, 0.25),
    cel: c.env('cel', Tc, 0.3),
    bell: c.env('bell', Tc, 0.2),
    toll: c.env('toll', Tc, 1.0),
    heart: c.env('heart', Tc, 0.16),
    impact: c.env('impact', Tc, 0.5),
    crash: c.env('crash', Tc, 0.7),
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
    fx: { bloom: 1, bloomMul: 1, glitch: 0, flash: 0, shake: 0, fade: 0 },
  };
}
