// Render single frames (PNG) from the real renderer:  node tools/still.mjs out_dir spec [spec...]
// spec: seconds ("12.5"), or bar notation "b16" / "b16.8" (bar, optional step 0-15)
import path from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { serve } from './serve.mjs';
import { loadPlaywright } from './playwright.mjs';
const { chromium } = loadPlaywright();

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [outDir, ...specs] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });
const BAR = 60 / 132 * 4, STEP = BAR / 16;
const toT = (s) => (s[0] === 'b' ? (([b, st = 0]) => b * BAR + st * STEP)(s.slice(1).split('.').map(Number)) : Number(s));

const srv = await serve(root);
const browser = await chromium.launch({ args: ['--disable-gpu', '--force-color-profile=srgb', '--hide-scrollbars'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
page.on('console', (m) => { if (m.type() !== 'debug') console.log('[page]', m.text()); });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(`${srv.url}/src/render/index.html?render=1`);
await page.waitForFunction(() => window.__ready === true, null, { timeout: 30000 });
for (const spec of specs) {
  const T = toT(spec);
  const t0 = Date.now();
  const b64 = await page.evaluate((T) => { window.__renderAt(T, 30); return document.getElementById('c').toDataURL('image/png').split(',')[1]; }, T);
  const file = path.join(outDir, `f_${spec.replace(/[^\w.]/g, '_')}.png`);
  writeFileSync(file, Buffer.from(b64, 'base64'));
  console.log(`${spec} (t=${T.toFixed(2)}s) -> ${file}  ${Date.now() - t0} ms`);
}
await browser.close(); srv.close();
