// Post-processing: multi-level bloom from the emissive canvas, vignette, scanlines, glitch slices, RGB split.
import { clamp, hash2 } from './util.js';

const mk = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; };

export class Post {
  constructor(W, H) {
    this.W = W; this.H = H;
    this.q = mk(W / 4, H / 4); this.qb = mk(W / 4, H / 4);
    this.e = mk(W / 8, H / 8); this.eb = mk(W / 8, H / 8);
    this.s = mk(W / 16, H / 16); this.sb = mk(W / 16, H / 16);
    this.c = Object.fromEntries(['q', 'qb', 'e', 'eb', 's', 'sb'].map((k) => [k, this[k].getContext('2d')]));
    for (const c of Object.values(this.c)) c.imageSmoothingQuality = 'high';

    this.vig = mk(W, H);
    { const c = this.vig.getContext('2d'), g = c.createRadialGradient(W / 2, H / 2, H * 0.42, W / 2, H / 2, H * 1.02);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.62)'); c.fillStyle = g; c.fillRect(0, 0, W, H); }
    this.scan = mk(W, H);
    { const c = this.scan.getContext('2d'); c.fillStyle = 'rgba(0,0,0,0.10)'; for (let y = 0; y < H; y += 3) c.fillRect(0, y, W, 1); }
    this.snap = mk(W, H); this.snapc = this.snap.getContext('2d');
    this.ch = mk(W, H); this.chc = this.ch.getContext('2d');
  }

  /** additive bloom of the emissive canvas at three radii */
  bloom(main, glow, { k1 = 0.85, k2 = 0.85, k3 = 0.6 } = {}) {
    const { W, H, c } = this;
    c.q.globalCompositeOperation = 'copy'; c.q.drawImage(glow, 0, 0, W / 4, H / 4);
    c.qb.globalCompositeOperation = 'copy'; c.qb.filter = 'blur(2px)'; c.qb.drawImage(this.q, 0, 0); c.qb.filter = 'none';
    c.e.globalCompositeOperation = 'copy'; c.e.drawImage(this.qb, 0, 0, W / 8, H / 8);
    c.eb.globalCompositeOperation = 'copy'; c.eb.filter = 'blur(2px)'; c.eb.drawImage(this.e, 0, 0); c.eb.filter = 'none';
    c.s.globalCompositeOperation = 'copy'; c.s.drawImage(this.eb, 0, 0, W / 16, H / 16);
    c.sb.globalCompositeOperation = 'copy'; c.sb.filter = 'blur(2px)'; c.sb.drawImage(this.s, 0, 0); c.sb.filter = 'none';
    main.save();
    main.imageSmoothingQuality = 'high';
    main.globalCompositeOperation = 'lighter';
    main.globalAlpha = k1; main.drawImage(this.qb, 0, 0, W, H);
    main.globalAlpha = k2; main.drawImage(this.eb, 0, 0, W, H);
    main.globalAlpha = k3; main.drawImage(this.sb, 0, 0, W, H);
    main.restore();
  }
  finish(main, { scan = true, vig = true } = {}) {
    if (vig) main.drawImage(this.vig, 0, 0);
    if (scan) main.drawImage(this.scan, 0, 0);
  }
  /** horizontal slice displacement; amt 0..1 */
  glitch(main, seed, amt) {
    if (amt < 0.02) return;
    const { W, H, snapc } = this;
    snapc.globalCompositeOperation = 'copy'; snapc.drawImage(main.canvas, 0, 0);
    const n = 5 + Math.floor(amt * 12);
    for (let i = 0; i < n; i++) {
      const y0 = Math.floor(hash2(i, seed) * H), hh = 6 + hash2(i, seed + 7) * 120 * amt, dx = (hash2(i, seed + 13) - 0.5) * 420 * amt;
      main.drawImage(this.snap, 0, y0, W, hh, dx, y0, W, hh);
    }
  }
  /** chromatic aberration by channel shifting */
  rgbSplit(main, px) {
    if (px < 0.6) return;
    const { W, H, snapc, chc } = this;
    snapc.globalCompositeOperation = 'copy'; snapc.drawImage(main.canvas, 0, 0);
    // keep only green in main
    main.save(); main.globalCompositeOperation = 'multiply'; main.fillStyle = '#00ff00'; main.fillRect(0, 0, W, H);
    main.globalCompositeOperation = 'lighter';
    for (const [col, dx] of [['#ff0000', -px], ['#0000ff', px]]) {
      chc.globalCompositeOperation = 'copy'; chc.drawImage(this.snap, 0, 0);
      chc.globalCompositeOperation = 'multiply'; chc.fillStyle = col; chc.fillRect(0, 0, W, H);
      main.drawImage(this.ch, dx, 0);
    }
    main.restore();
  }
}
