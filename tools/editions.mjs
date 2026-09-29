// The repo builds two videos from one engine. This registry tells the tools (still / sheet / render-video / QA) where each
// edition keeps its page, its synthesized audio + cue sheet and its finished file.
//   node tools/still.mjs --edition gothic build/gothic/stills b12.0     (or EDITION=gothic ...)
export const EDITIONS = {
  bauhaus: {
    title: 'KLAIS-16 // SIXTEEN',
    comment: 'Dark techno x Bauhaus music video for github.com/openKolibri/klais-16',
    page: 'src/render/index.html',
    buildDir: 'build',
    out: 'dist/klais16-bauhaus.mp4',
    // bars in which the picture pulses with every kick (used by sync-check) and a steady 4-on-the-floor stretch (audio-qa)
    sync: [16.2, 19.8],
    beatlock: [16, 24],
    tune: 'animation',
  },
  gothic: {
    title: 'LUX SEDECIM',
    comment: 'Red-only gothic techno music video for github.com/openKolibri/klais-16 (no vocals)',
    page: 'src/gothic/index.html',
    buildDir: 'build/gothic',
    out: 'dist/klais16-gothic.mp4',
    sync: [16.2, 19.8],
    beatlock: [16, 24],
    // dark, smooth red gradients: variance-adaptive quantisation that favours dark areas keeps them from banding
    tune: '',
    x264: 'aq-mode=3:aq-strength=0.9:deblock=-1,-1',
  },
};

/** pick the edition from `--edition x` / $EDITION and return it together with argv minus that flag */
export function edition(argv = process.argv.slice(2)) {
  const i = argv.indexOf('--edition');
  const name = i >= 0 ? argv[i + 1] : process.env.EDITION || 'bauhaus';
  const ed = EDITIONS[name];
  if (!ed) throw new Error(`unknown edition "${name}" (have: ${Object.keys(EDITIONS).join(', ')})`);
  const args = i >= 0 ? argv.filter((_, k) => k !== i && k !== i + 1) : argv;
  return { name, ...ed, args };
}
