// Page bootstrap: loads the geometry/font/cue data, exposes window.__renderAt(T) for offline capture,
// and drives a live preview from the audio clock when opened normally in a browser.
import { Cues } from './cues.js';
import { Glyphs } from './glyph.js';
import { Post } from './post.js';
import { P } from './util.js';
import { makeFrame } from './frame.js';
import { drawTimeline } from './timeline.js';

const W = 1920, H = 1080;
const params = new URLSearchParams(location.search);
const json = async (u) => { const r = await fetch(u); if (!r.ok) throw new Error(`${u}: ${r.status}`); return r.json(); };

async function boot() {
  const [geom, font, cj] = await Promise.all([json('../geometry/klais16.json'), json('../geometry/font16.json'), json('../../build/cues.json')]);
  const canvas = document.getElementById('c');
  const ctx = canvas.getContext('2d', { alpha: false });
  const glowC = Object.assign(document.createElement('canvas'), { width: W, height: H });
  const glow = glowC.getContext('2d');
  const cues = new Cues(cj), G = new Glyphs(geom, font), post = new Post(W, H);

  function renderAt(T, fps = 30) {
    const Tc = T + 1 / fps;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.filter = 'none';
    ctx.fillStyle = P.INK; ctx.fillRect(0, 0, W, H);
    glow.setTransform(1, 0, 0, 1, 0, 0); glow.globalAlpha = 1; glow.globalCompositeOperation = 'source-over'; glow.clearRect(0, 0, W, H);
    const C = makeFrame({ ctx, glow, W, H, G, cues, T, Tc, fps });
    drawTimeline(C);
    const bm = C.fx.bloom * C.fx.bloomMul;
    if (bm > 0.01) post.bloom(ctx, glowC, { k1: 0.42 * bm, k2: 0.4 * bm, k3: 0.3 * bm });
    post.finish(ctx, { scan: params.has('scan') });
    if (C.fx.glitch > 0) post.glitch(ctx, Math.floor(T * fps), C.fx.glitch);
    if (C.fx.split > 0) post.rgbSplit(ctx, C.fx.split);
    if (C.fx.flash > 0) { ctx.fillStyle = `rgba(255,250,240,${Math.min(0.5, C.fx.flash)})`; ctx.fillRect(0, 0, W, H); }
  }
  window.__renderAt = renderAt;
  window.__duration = cues.duration;
  document.body.classList.toggle('render', params.has('render'));
  window.__ready = true;

  if (!params.has('render')) {
    const audio = document.getElementById('a'), btn = document.getElementById('play'), bar = document.querySelector('#bar i');
    let running = false;
    const loop = () => {
      const T = audio.paused && !running ? 0 : audio.currentTime;
      renderAt(T, 60);
      bar.style.width = `${(T / cues.duration) * 100}%`;
      requestAnimationFrame(loop);
    };
    btn.addEventListener('click', () => { btn.style.display = 'none'; audio.currentTime = 0; audio.play(); running = true; });
    audio.addEventListener('ended', () => { btn.style.display = 'grid'; running = false; });
    renderAt(0, 60); requestAnimationFrame(loop);
  }
}
boot().catch((e) => { console.error(e); document.title = 'ERROR ' + e.message; });
