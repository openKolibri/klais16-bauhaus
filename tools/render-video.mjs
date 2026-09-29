// Renders the video: N headless-Chromium pages draw frames in parallel (pure function of time), an ordered queue feeds
// them to ffmpeg as a PNG stream, and ffmpeg muxes them with build/track.wav into an H.264 + AAC mp4.
//
//   node tools/render-video.mjs [--edition bauhaus|gothic] [--fps 30] [--workers 4] [--out dist/klais16-bauhaus.mp4]
//                               [--crf 23] [--preset slow] [--maxrate 8M] [--start 0] [--end 118.2]
//   (start/end in seconds are handy for quick test renders)
import { spawn } from 'node:child_process';
import { readFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from './serve.mjs';
import { edition } from './editions.mjs';
import { loadPlaywright } from './playwright.mjs';
const { chromium } = loadPlaywright();
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const ed = edition();
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const FPS = Number(arg('fps', 30)), WORKERS = Number(arg('workers', 4)), CRF = arg('crf', ed.crf || '23'), PRESET = arg('preset', 'slow'), MAXRATE = arg('maxrate', '8M');
const OUT = path.resolve(root, arg('out', ed.out));
const PAGE_QS = 'render=1' + (arg('scanlines', '0') === '1' ? '&scan=1' : '');
const cues = JSON.parse(readFileSync(path.join(root, ed.buildDir, 'cues.json'), 'utf8'));
const START = Number(arg('start', 0)), END = Math.min(Number(arg('end', cues.duration)), cues.duration);
const f0 = Math.round(START * FPS), f1 = Math.ceil(END * FPS), TOTAL = f1 - f0;
mkdirSync(path.dirname(OUT), { recursive: true });

console.log(`[${ed.name}] render ${TOTAL} frames @ ${FPS} fps (${START.toFixed(2)}s..${END.toFixed(2)}s) with ${WORKERS} workers -> ${path.relative(root, OUT)}`);
const srv = await serve(root);
const browser = await chromium.launch({ args: ['--disable-gpu', '--force-color-profile=srgb', '--hide-scrollbars', '--disable-dev-shm-usage'] });
const pages = [];
for (let i = 0; i < WORKERS; i++) {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.error('[pageerror]', e.message));
  await page.goto(`${srv.url}/${ed.page}?${PAGE_QS}`);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 60000 });
  pages.push(page);
}

// ffmpeg: PNG frames on stdin + the synthesized audio. Colours tagged BT.709 (what browsers/players assume for HD).
const ff = spawn(process.env.FFMPEG || 'ffmpeg', [
  '-y', '-hide_banner', '-loglevel', 'warning', '-nostats',
  '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-',
  ...(START > 0 || END < cues.duration ? ['-ss', String(START), '-t', String(END - START)] : []),
  '-i', path.join(root, ed.buildDir, 'track.wav'),
  '-map', '0:v', '-map', '1:a',
  '-vf', 'scale=in_range=full:out_range=tv:out_color_matrix=bt709,format=yuv420p',
  '-c:v', 'libx264', '-preset', PRESET, '-crf', CRF, '-maxrate', MAXRATE, '-bufsize', String(parseInt(MAXRATE) * 2) + 'M', ...(ed.tune ? ['-tune', ed.tune] : []), ...(ed.x264 ? ['-x264-params', ed.x264] : []), '-profile:v', 'high', '-level', '4.2',
  '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
  '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-shortest',
  '-metadata', `title=${ed.title}`, '-metadata', 'artist=generated with Claude Code', '-metadata', `comment=${ed.comment}`,
  '-movflags', '+faststart', OUT,
], { stdio: ['pipe', 'inherit', 'inherit'] });
ff.stdin.on('error', () => {});
const ffDone = new Promise((res, rej) => { ff.on('close', (c) => (c === 0 ? res() : rej(new Error('ffmpeg exit ' + c)))); });

const done = new Map();
let nextJob = 0, nextWrite = 0;
const t0 = Date.now();
const MAX_AHEAD = WORKERS * 4;
let writing = false;
async function pump() {
  if (writing) return; writing = true;
  while (done.has(nextWrite)) {
    const buf = done.get(nextWrite); done.delete(nextWrite);
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    nextWrite++;
    if (nextWrite % 60 === 0 || nextWrite === TOTAL) {
      const el = (Date.now() - t0) / 1000, fps = nextWrite / el, eta = (TOTAL - nextWrite) / Math.max(fps, 0.01);
      console.log(`  ${nextWrite}/${TOTAL}  ${fps.toFixed(1)} fps  elapsed ${el.toFixed(0)}s  eta ${eta.toFixed(0)}s`);
    }
  }
  writing = false;
}
async function worker(page) {
  for (;;) {
    while (nextJob - nextWrite >= MAX_AHEAD) await new Promise((r) => setTimeout(r, 15));
    const i = nextJob++;
    if (i >= TOTAL) return;
    const T = (f0 + i) / FPS;
    const b64 = await page.evaluate(({ T, FPS }) => { window.__renderAt(T, FPS); return document.getElementById('c').toDataURL('image/png').slice(22); }, { T, FPS });
    done.set(i, Buffer.from(b64, 'base64'));
    pump();
  }
}
await Promise.all(pages.map(worker));
while (nextWrite < TOTAL) { await pump(); await new Promise((r) => setTimeout(r, 20)); }
ff.stdin.end();
await ffDone;
await browser.close(); srv.close();
console.log(`done in ${((Date.now() - t0) / 1000).toFixed(0)}s -> ${OUT}`);
