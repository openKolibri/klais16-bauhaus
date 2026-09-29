// A tiny perspective camera for the wireframe scenes (Canvas2D has no 3-D). World: x right, y up, z forward (into the nave).
import { TAU } from '../render/util.js';

export class Cam {
  constructor(W, H, F = 1300, near = 0.5) { this.W = W; this.H = H; this.F = F; this.near = near; this.set({}); }
  /** yaw turns left/right, pitch looks up (+), roll banks the picture */
  set({ x = 0, y = 0, z = 0, yaw = 0, pitch = 0, roll = 0, cx = this.W / 2, cy = this.H / 2 }) {
    Object.assign(this, { x, y, z, cx, cy, cyaw: Math.cos(yaw), syaw: Math.sin(yaw), cp: Math.cos(pitch), sp: Math.sin(pitch), cr: Math.cos(roll), sr: Math.sin(roll) });
    return this;
  }
  /** project a world point into out = [sx, sy, depth]; false when it is behind the near plane */
  p(x, y, z, out) {
    const dx = x - this.x, dy = y - this.y, dz = z - this.z;
    const x1 = dx * this.cyaw - dz * this.syaw, z1 = dx * this.syaw + dz * this.cyaw;
    const y2 = dy * this.cp - z1 * this.sp, z2 = dy * this.sp + z1 * this.cp;
    if (z2 < this.near) return false;
    const sx = (this.F * x1) / z2, sy = (this.F * y2) / z2;
    out[0] = this.cx + sx * this.cr - sy * this.sr; out[1] = this.cy - (sx * this.sr + sy * this.cr); out[2] = z2;
    return true;
  }
  /** add a 3-D polyline [[x,y,z],...] to the current path of `ctx` (segments with an end behind the camera are skipped) */
  path(ctx, pts, close = false) {
    const o = [0, 0, 0];
    let pen = false;
    for (let i = 0; i < pts.length; i++) {
      const q = pts[i];
      if (!this.p(q[0], q[1], q[2], o)) { pen = false; continue; }
      if (pen) ctx.lineTo(o[0], o[1]); else ctx.moveTo(o[0], o[1]);
      pen = true;
    }
    if (close && pts.length > 2) { const q = pts[0]; if (this.p(q[0], q[1], q[2], o)) ctx.lineTo(o[0], o[1]); }
  }
}

/** points of a pointed arch in a plane: from the left springing (-w/2, ys) over the apex to the right springing; coordinates [u, v] */
export function archPts(w, rise, ys = 0, n = 12) {
  const s = w / 2, R = (rise * rise + s * s) / (2 * s), a = Math.atan2(rise, R - s), out = [];
  for (let i = 0; i <= n; i++) { const p = (i / n) * a; out.push([-s + R - R * Math.cos(p), ys + R * Math.sin(p)]); }
  for (let i = n - 1; i >= 0; i--) { const p = (i / n) * a; out.push([s - R + R * Math.cos(p), ys + R * Math.sin(p)]); }
  return out;
}
