// Contact sheet of the whole video (or a range):  node tools/sheet.mjs out.png|out.jpg [t0|t,t,t,...] [t1] [count] [cols] [cellWidth]
// (a comma-separated list in the second argument picks exact times; a .jpg output is written as JPEG)
import path from 'node:path';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { serve } from './serve.mjs';
import { loadPlaywright } from './playwright.mjs';
const { chromium } = loadPlaywright();
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [out, t0 = '0', t1 = '118', count0 = '24', cols = '4', cw = '480'] = process.argv.slice(2);
const list = t0.includes(',') ? t0.split(',').map(Number) : null, count = list ? String(list.length) : count0;
const jpeg = /\.jpe?g$/i.test(out);
const srv = await serve(root);
const browser = await chromium.launch({ args: ['--disable-gpu', '--force-color-profile=srgb', '--hide-scrollbars'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(`${srv.url}/src/render/index.html?render=1`);
await page.waitForFunction(() => window.__ready === true, null, { timeout: 30000 });
const b64 = await page.evaluate(({ t0, t1, count, cols, cw, list, jpeg }) => {
  const ch = Math.round(cw * 9 / 16), rows = Math.ceil(count / cols);
  const sheet = document.createElement('canvas'); sheet.width = cols * cw; sheet.height = rows * ch;
  const sc = sheet.getContext('2d'), main = document.getElementById('c');
  for (let i = 0; i < count; i++) {
    const T = list ? list[i] : t0 + (t1 - t0) * (count === 1 ? 0 : i / (count - 1));
    window.__renderAt(T, 30);
    const x = (i % cols) * cw, y = Math.floor(i / cols) * ch;
    sc.drawImage(main, x, y, cw, ch);
    if (!jpeg) { sc.fillStyle = 'rgba(0,0,0,0.65)'; sc.fillRect(x, y, 96, 18); sc.fillStyle = '#fff'; sc.font = '12px monospace'; sc.fillText(`${T.toFixed(1)}s  bar ${(T / (240 / 132)).toFixed(1)}`, x + 4, y + 13); }
  }
  return (jpeg ? sheet.toDataURL('image/jpeg', 0.86) : sheet.toDataURL('image/png')).split(',')[1];
}, { t0: list ? 0 : +t0, t1: +t1, count: +count, cols: +cols, cw: +cw, list, jpeg });
writeFileSync(out, Buffer.from(b64, 'base64'));
console.log('wrote', out);
await browser.close(); srv.close();
