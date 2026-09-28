// Minimal KiCad 5 (.kicad_pcb) S-expression reader: just enough to pull board outlines and footprint positions.
import { readFileSync } from 'node:fs';

export function parseSexp(src) {
  let i = 0;
  const n = src.length;
  function skipWs() {
    while (i < n && /\s/.test(src[i])) i++;
  }
  function atom() {
    if (src[i] === '"') {
      i++;
      let s = '';
      while (i < n && src[i] !== '"') {
        if (src[i] === '\\') i++;
        s += src[i++];
      }
      i++;
      return s;
    }
    let s = '';
    while (i < n && !/[\s()]/.test(src[i])) s += src[i++];
    return s;
  }
  function list() {
    i++; // (
    const out = [];
    for (;;) {
      skipWs();
      if (i >= n) throw new Error('unbalanced sexp');
      if (src[i] === ')') { i++; return out; }
      out.push(src[i] === '(' ? list() : atom());
    }
  }
  skipWs();
  return list();
}

export const load = (file) => parseSexp(readFileSync(file, 'utf8'));
export const children = (node, tag) => node.filter((c) => Array.isArray(c) && c[0] === tag);
export const child = (node, tag) => children(node, tag)[0];
const num = (s) => Number.parseFloat(s);

/** Edge.Cuts (or any layer) drawing primitives, as polylines in board mm. */
export function drawings(pcb, layer) {
  const out = [];
  for (const g of pcb.filter((c) => Array.isArray(c))) {
    const tag = g[0];
    if (!['gr_line', 'gr_arc', 'gr_poly', 'gr_circle'].includes(tag)) continue;
    const lay = child(g, 'layer')?.[1];
    if (layer && lay !== layer) continue;
    if (tag === 'gr_line') {
      const s = child(g, 'start'), e = child(g, 'end');
      out.push({ kind: 'line', layer: lay, pts: [[num(s[1]), num(s[2])], [num(e[1]), num(e[2])]] });
    } else if (tag === 'gr_arc') {
      const c = child(g, 'start'), s = child(g, 'end'), a = num(child(g, 'angle')[1]);
      const cx = num(c[1]), cy = num(c[2]), sx = num(s[1]), sy = num(s[2]);
      const r = Math.hypot(sx - cx, sy - cy);
      const a0 = Math.atan2(sy - cy, sx - cx);
      const steps = Math.max(4, Math.ceil(Math.abs(a) / 6));
      const pts = [];
      for (let k = 0; k <= steps; k++) {
        const th = a0 + ((a * Math.PI) / 180) * (k / steps);
        pts.push([cx + r * Math.cos(th), cy + r * Math.sin(th)]);
      }
      out.push({ kind: 'arc', layer: lay, pts });
    } else if (tag === 'gr_poly') {
      const pts = children(child(g, 'pts'), 'xy').map((p) => [num(p[1]), num(p[2])]);
      out.push({ kind: 'poly', layer: lay, pts });
    } else if (tag === 'gr_circle') {
      const c = child(g, 'center'), e = child(g, 'end');
      const cx = num(c[1]), cy = num(c[2]);
      out.push({ kind: 'circle', layer: lay, center: [cx, cy], r: Math.hypot(num(e[1]) - cx, num(e[2]) - cy) });
    }
  }
  return out;
}

/** Chain loose line/arc pieces into closed loops. */
export function chainLoops(prims, tol = 0.01) {
  const key = (p) => `${Math.round(p[0] / tol)},${Math.round(p[1] / tol)}`;
  const pieces = prims.filter((p) => p.kind === 'line' || p.kind === 'arc').map((p) => ({ pts: p.pts, used: false }));
  const closed = prims.filter((p) => p.kind === 'poly').map((p) => p.pts);
  const byEnd = new Map();
  pieces.forEach((pc, idx) => {
    for (const end of [pc.pts[0], pc.pts[pc.pts.length - 1]]) {
      const k = key(end);
      if (!byEnd.has(k)) byEnd.set(k, []);
      byEnd.get(k).push(idx);
    }
  });
  const loops = [...closed];
  for (const start of pieces) {
    if (start.used) continue;
    start.used = true;
    let chain = [...start.pts];
    for (;;) {
      const tail = chain[chain.length - 1];
      if (key(tail) === key(chain[0]) && chain.length > 2) break;
      const cand = (byEnd.get(key(tail)) || []).map((i) => pieces[i]).find((pc) => !pc.used);
      if (!cand) break;
      cand.used = true;
      const forward = key(cand.pts[0]) === key(tail);
      const seq = forward ? cand.pts : [...cand.pts].reverse();
      chain = chain.concat(seq.slice(1));
    }
    if (chain.length > 2 && key(chain[chain.length - 1]) === key(chain[0])) loops.push(chain.slice(0, -1));
    else loops.push({ open: true, pts: chain });
  }
  return loops;
}

/** Footprint ("module") placements. */
export function modules(pcb) {
  return children(pcb, 'module').map((m) => {
    const at = child(m, 'at');
    const ref = children(m, 'fp_text').find((t) => t[1] === 'reference');
    return { name: m[1], ref: ref ? ref[2] : '', x: num(at[1]), y: num(at[2]), rot: at[3] ? num(at[3]) : 0, layer: child(m, 'layer')?.[1] };
  });
}

export const area = (pts) => {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length];
    a += x1 * y2 - x2 * y1;
  }
  return a / 2;
};
export const bbox = (pts) => {
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
};
