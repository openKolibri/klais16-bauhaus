// Page engine shared by both editions: loads the geometry / font / cue data, builds the drawing contexts, exposes
// window.__renderAt(T) for offline capture and drives a live preview from the audio clock in a normal browser tab.
//
// An edition supplies what makes it look like itself:
//   makeFrame(base)  -> the per-frame context handed to its scenes (base = { ctx, glow, W, H, G, cues, T, Tc, fps })
//   drawScene(C)     -> draws the scene timeline into C.ctx (+ emissive shapes into C.glow)
//   finish(C, env)   -> post fx after the scene: bloom, grade, vignette ... (env = { ctx, glowC, post, params, T, fps })
//   ink              -> the clear colour
import { Cues } from './cues.js';
import { Glyphs } from './glyph.js';
import { Post } from './post.js';

export const W = 1920, H = 1080;
const json = async (u) => { const r = await fetch(u); if (!r.ok) throw new Error(`${u}: ${r.status}`); return r.json(); };

export async function boot({ cuesUrl, ink, makeFrame, drawScene, finish, init = null, ctxOptions = { alpha: false } }) {
  const params = new URLSearchParams(location.search);
  const [geom, font, cj] = await Promise.all([json('../geometry/klais16.json'), json('../geometry/font16.json'), json(cuesUrl)]);
  const canvas = document.getElementById('c');
  const ctx = canvas.getContext('2d', ctxOptions);
  const glowC = Object.assign(document.createElement('canvas'), { width: W, height: H });
  const glow = glowC.getContext('2d');
  const cues = new Cues(cj), G = new Glyphs(geom, font), post = new Post(W, H);
  const env = { ctx, glowC, post, params, geom, cues, G };
  if (init) await init(env);

  function renderAt(T, fps = 30) {
    const Tc = T + 1 / fps; // the picture looks one frame ahead of the audio clock (measured by tools/sync-check.mjs)
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.filter = 'none';
    ctx.fillStyle = ink; ctx.fillRect(0, 0, W, H);
    glow.setTransform(1, 0, 0, 1, 0, 0); glow.globalAlpha = 1; glow.globalCompositeOperation = 'source-over'; glow.clearRect(0, 0, W, H);
    const C = makeFrame({ ctx, glow, W, H, G, cues, T, Tc, fps });
    drawScene(C);
    finish(C, { ...env, T, fps });
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
  return { renderAt, cues, G, post, ctx, glowC };
}

/** boot() with error reporting into the page title (visible in headless logs) */
export function run(opts) {
  boot(opts).catch((e) => { console.error(e); document.title = 'ERROR ' + e.message; });
}
