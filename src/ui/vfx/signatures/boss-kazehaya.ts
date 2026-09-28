/** KAZEHAYA — Cutting Wind. "15 DMG to every opponent within 3 spaces, hauls
 *  each of them 2 slots into contact, and ROOTs them there for a round." It
 *  has never taken the first swing. It has never needed to.
 *
 *  The samurai of bark and leaf on its art stands in a whirl of pale wind
 *  ribbons and torn leaves. The DELIVERY is that whirl winding up round it —
 *  ribbons of wind turning faster, leaves caught in them — while the air is
 *  drawn IN to it from everything in reach, streaks of wind and leaves pouring
 *  toward it from each card it wants. The LANDING is the cut and the haul: the
 *  whirl snaps shut; blades of wind slash across every card; each is dragged
 *  in along a wake of wind and leaves to where it ends up beside the samurai,
 *  and roots burst up round it there and snap shut (the ROOT).
 *
 *  Where a hauled card ends up is worked out the way the rope does it (see
 *  `reelToCaster`): up to two steps straight at the samurai, one axis at a
 *  time round anything in the way, stopping on contact and never on its own
 *  home row. The wind is light (additive, pale); the roots are SOLID, on the
 *  normal-blend layer, with a lit edge. */
import { centre, rand } from "../looks/base";
import type { Graphics } from "pixi.js";
import type { FxTools, Pt, SparkStyle } from "../looks/types";
import type { Signature, SigMoment } from "./types";

const TAU = Math.PI * 2;
// The wind, as light: pale green-white ribbons with a soft green edge.
const WIND = 0xeafff0, WIND_G = 0x9fe0b0, PALE = 0xf4ffe6, LIME = 0xb6f27a, GREEN = 0x4caf6d;
// The roots: bark, real colour on the normal-blend layer.
const BARK = 0x5e4630, BARK_HI = 0xa8875a, BARK_EDGE = 0x160f08;
/** Leaf-bits in the wind: they curl as they go. */
const BIT: SparkStyle = { palette: [PALE, LIME, GREEN], gravity: 40, drag: 0.5, size: [6, 2], streak: false, swirl: 200 };
const BIT_L: SparkStyle = { ...BIT, swirl: -200 };

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeOut = (x: number) => 1 - (1 - x) * (1 - x);

/** One leaf: a teardrop, round at the stem and pointed at the tip; `open` is
 *  how face-on it is, so a tumbling leaf thins to a sliver and back. */
function leaf(g: Graphics, x: number, y: number, len: number, ang: number, open: number, color: number, alpha: number) {
  if (alpha <= 0.02 || len < 2) return;
  const c = Math.cos(ang), s = Math.sin(ang), hx = c * len * 0.5, hy = s * len * 0.5, w = len * 0.46 * Math.max(0.12, open);
  const mx = x - hx * 0.3, my = y - hy * 0.3;
  g.moveTo(x - hx, y - hy).quadraticCurveTo(mx - s * w, my + c * w, x + hx, y + hy)
    .quadraticCurveTo(mx + s * w, my - c * w, x - hx, y - hy).fill({ color, alpha });
}

/** A ribbon of wind along a centreline: thick in the middle, drawn to
 *  nothing at both ends — a streak, not a pipe — a soft green edge round a
 *  white core. */
function ribbon(g: Graphics, pts: number[], w: number, alpha: number) {
  const n = pts.length / 2;
  if (n < 2 || alpha <= 0.02) return;
  const shape = (k: number) => {
    const left: number[] = [], right: number[] = [];
    for (let i = 0; i < n; i++) {
      const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1);
      const tx = pts[b * 2] - pts[a * 2], ty = pts[b * 2 + 1] - pts[a * 2 + 1], l = Math.hypot(tx, ty) || 1;
      const hw = (w / 2) * k * Math.sin((Math.PI * (i + 0.5)) / n);
      left.push(pts[i * 2] - (ty / l) * hw, pts[i * 2 + 1] + (tx / l) * hw);
      right.unshift(pts[i * 2] + (ty / l) * hw, pts[i * 2 + 1] - (tx / l) * hw);
    }
    return left.concat(right);
  };
  g.poly(shape(1), true).fill({ color: WIND_G, alpha: 0.35 * alpha });
  g.poly(shape(0.35), true).fill({ color: WIND, alpha: 0.9 * alpha });
}

/** An arc of points round `c`: radius `r` (flattened by `sq`), from `a0` to `a1`. */
function arc(c: Pt, r: number, a0: number, a1: number, sq: number, n = 10): number[] {
  const out: number[] = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    out.push(c.x + Math.cos(a) * r, c.y + Math.sin(a) * r * sq);
  }
  return out;
}

/** Where each hauled card ends up — the rope's own rule (`reelToCaster`):
 *  up to `steps` steps straight at the puller, else along one axis, never
 *  onto a taken square or the puller's home row, stopping on contact. Squares
 *  are found from the targets' own offsets; the nearest are reeled first. */
function hauled(m: SigMoment, steps: number): Pt[] {
  const c = centre(m.from), s = m.size;
  const pts = m.targets.map((r) => centre(r));
  let sum = 0, n = 0;
  for (const p of pts)
    for (const d of [p.x - c.x, p.y - c.y]) {
      const k = Math.round(d / (s * 1.075));
      if (k) { sum += d / k; n++; }
    }
  const pitch = n ? sum / n : s * 1.075;
  const cell = (p: Pt) => ({ x: Math.round((p.x - c.x) / pitch), y: Math.round((p.y - c.y) / pitch) });
  const key = (q: Pt) => `${q.x},${q.y}`;
  const taken = new Set<string>([key({ x: 0, y: 0 }), ...m.allies.map((r) => key(cell(centre(r)))), ...pts.map((p) => key(cell(p)))]);
  const b = m.board, ahead = m.ahead;
  const onBoard = (q: Pt) => {
    const x = c.x + q.x * pitch, y = c.y + q.y * pitch;
    return x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h;
  };
  // Its own home row: the board's last row behind it.
  const back = (q: Pt) => {
    const x = c.x + q.x * pitch, y = c.y + q.y * pitch;
    const along = (x - c.x) * ahead.x + (y - c.y) * ahead.y;
    const edge = Math.min(...[[b.x, b.y], [b.x + b.w, b.y], [b.x, b.y + b.h], [b.x + b.w, b.y + b.h]].map(([ex, ey]) => (ex - c.x) * ahead.x + (ey - c.y) * ahead.y));
    return along - edge < pitch * 0.55;
  };
  const out: Pt[] = pts.map((p) => p);
  const order = pts.map((p, i) => ({ i, d: Math.hypot(p.x - c.x, p.y - c.y) })).sort((a, z) => a.d - z.d);
  for (const { i } of order) {
    let q = cell(pts[i]);
    taken.delete(key(q));
    for (let k = 0; k < steps && Math.max(Math.abs(q.x), Math.abs(q.y)) > 1; k++) {
      const dx = -Math.sign(q.x), dy = -Math.sign(q.y);
      const tries = [{ x: q.x + dx, y: q.y + dy }, { x: q.x, y: q.y + dy }, { x: q.x + dx, y: q.y }].filter((t) => t.x !== q.x || t.y !== q.y);
      const next = tries.find((t) => !taken.has(key(t)) && onBoard(t) && !back(t));
      if (!next) break;
      q = next;
    }
    taken.add(key(q));
    out[i] = { x: c.x + q.x * pitch, y: c.y + q.y * pitch };
  }
  return out;
}

export const KAZEHAYA: Signature = {
  shake: 1.6,
  // It never takes the first swing: it stays where it is and draws them in.
  lunge: false,

  deliver(t: FxTools, m: SigMoment, seconds: number) {
    const c = centre(m.from), s = m.size, S = seconds, dir = Math.random() < 0.5 ? -1 : 1;
    // THE WHIRL winding up round it: ribbons of wind turning faster, leaves
    // caught in them.
    const spin = (time: number) => dir * (2 * time + (7 * time * time) / S);
    const R = (time: number) => s * (0.5 + 0.35 * easeOut(clamp01(time / S)));
    const leaves = Array.from({ length: 7 }, (_, i) => ({ a: (i / 7) * TAU, r: rand(0.8, 1.15), len: s * rand(0.13, 0.18), color: i % 3 ? LIME : GREEN }));
    t.draw(S, (g, v) => {
      const time = v * S, k = Math.min(1, v * 4), a0 = spin(time);
      for (let i = 0; i < 5; i++) {
        const a = a0 + (i / 5) * TAU;
        ribbon(g, arc(c, R(time) * (i % 2 ? 1 : 0.8), a, a + dir * 1.05, 0.78), s * 0.13, 0.85 * k);
      }
      for (const lf of leaves) {
        const a = a0 * 1.2 + lf.a, rr = R(time) * lf.r, turn = Math.cos(time * 14 + lf.a * 3);
        leaf(g, c.x + Math.cos(a) * rr, c.y + Math.sin(a) * rr * 0.78, lf.len, a + dir * Math.PI / 2, 0.3 + 0.7 * Math.abs(turn), lf.color, 0.9 * k);
      }
    });
    // THE AIR DRAWN IN from every card it wants: streaks of wind pouring
    // toward it along each line, faster as it winds up.
    const lines = m.targets.map((r) => {
      const p = centre(r), d = Math.hypot(p.x - c.x, p.y - c.y) || 1;
      return { p, ux: (c.x - p.x) / d, uy: (c.y - p.y) / d, d, seed: rand(0, 1) };
    });
    const IN = S * 0.3;
    t.draw(S, (g, v) => {
      const time = v * S;
      if (time < IN) return;
      const k = clamp01((time - IN) / (S * 0.25));
      for (const ln of lines)
        for (let j = 0; j < 3; j++) {
          const q = ((time - IN) * 2.2 + j / 3 + ln.seed) % 1, off = (j - 1) * s * 0.14;
          const h0 = ln.d * (q - 0.25) - s * 0.3, h1 = ln.d * q - s * 0.3;
          if (h1 <= 0) continue;
          const nx = -ln.uy, ny = ln.ux, pts: number[] = [];
          for (let i = 0; i <= 6; i++) {
            const h = Math.max(0, h0) + ((h1 - Math.max(0, h0)) * i) / 6;
            pts.push(ln.p.x + ln.ux * h + nx * off, ln.p.y + ln.uy * h + ny * off);
          }
          ribbon(g, pts, s * 0.1, 0.8 * k * (1 - q * 0.6));
        }
    });
    let bits = 0;
    t.draw(S, (_g, v, dt) => {
      if (v * S < IN) return;
      bits += dt * 14 * lines.length * t.quality;
      for (; bits >= 1; bits--) {
        const ln = lines[Math.floor(rand(0, lines.length))], sp = rand(180, 280) * (s / 90);
        t.spark(ln.p.x + rand(-0.3, 0.3) * s, ln.p.y + rand(-0.3, 0.3) * s, ln.ux * sp, ln.uy * sp, rand(0.3, 0.5), Math.random() < 0.5 ? BIT : BIT_L);
      }
    });
  },

  land(t: FxTools, m: SigMoment) {
    const c = centre(m.from), s = m.size, dest = hauled(m, 2);
    // The whirl snaps shut on it: its ribbons pulled tight in, and gone.
    t.draw(0.3, (g, v) => {
      const e = easeOut(v), a0 = v * 6;
      for (let i = 0; i < 5; i++) {
        const a = a0 + (i / 5) * TAU;
        ribbon(g, arc(c, s * (0.85 - 0.45 * e), a, a + 1.05, 0.78), s * 0.14 * (1 - 0.5 * e), 1 - v);
      }
    });
    t.flash(c, WIND, 0.14 * (s / 80));
    m.targets.forEach((r, i) => {
      const from = centre(r), to = dest[i] ?? from, k = Math.max(0.8, Math.min(1.5, m.power[i] ?? 1));
      haul(t, from, to, s);
      cut(t, to, k, s, Math.atan2(to.y - c.y, to.x - c.x));
      t.later(0.12, () => snare(t, to, s));
    });
  },
};

/** THE HAUL: a wake of wind and leaves from where a card stood to where it
 *  was dragged, streaming the way it went and thinning from the far end. */
function haul(t: FxTools, from: Pt, to: Pt, s: number) {
  const dx = to.x - from.x, dy = to.y - from.y, d = Math.hypot(dx, dy);
  if (d < s * 0.3) return;
  const nx = -dy / d, ny = dx / d, D = 0.55, bow = rand(-0.12, 0.12) * d;
  const at = (f: number) => ({ x: from.x + dx * f + nx * bow * Math.sin(Math.PI * f), y: from.y + dy * f + ny * bow * Math.sin(Math.PI * f) });
  const lvs = Array.from({ length: 5 }, (_, i) => ({ at: i * 0.05, off: rand(-0.2, 0.2) * s, len: s * rand(0.12, 0.17), spin: rand(8, 14), color: i % 2 ? LIME : GREEN }));
  t.draw(D, (g, v) => {
    const tail = easeOut(clamp01(v / 0.7)), a = 1 - clamp01((v - 0.5) / 0.5);
    for (const o of [-0.16, 0, 0.16]) {
      const pts: number[] = [];
      for (let i = 0; i <= 8; i++) {
        const p = at(tail + ((1 - tail) * i) / 8);
        pts.push(p.x + nx * o * s, p.y + ny * o * s);
      }
      ribbon(g, pts, s * (o ? 0.07 : 0.14), 0.85 * a);
    }
    for (const lf of lvs) {
      const q = clamp01((v * D - lf.at) / 0.3);
      if (q <= 0 || q >= 1) continue;
      const p = at(easeOut(q)), turn = Math.cos(q * lf.spin + lf.at * 9);
      leaf(g, p.x + nx * lf.off, p.y + ny * lf.off, lf.len, Math.atan2(dy, dx) + q * 3, 0.3 + 0.7 * Math.abs(turn), lf.color, 0.95 * (1 - q * q));
    }
  });
}

/** THE CUT: blades of wind slashed across a card — two crescents crossing,
 *  white at the edge — leaves shredded off it. */
function cut(t: FxTools, c: Pt, k: number, s: number, ang: number) {
  const D = 0.4, R = s * 0.5 * (0.9 + 0.15 * k);
  const blades = [ang + Math.PI / 2 + 0.5, ang + Math.PI / 2 - 0.5];
  t.draw(D, (g, v) => {
    blades.forEach((b, i) => {
      const q = clamp01((v * D - i * 0.05) / 0.1), a = 1 - clamp01((v * D - i * 0.05 - 0.12) / 0.25);
      if (q <= 0) return;
      const ux = Math.cos(b), uy = Math.sin(b), nx = -uy, ny = ux, pts: number[] = [];
      for (let j = 0; j <= 10; j++) {
        const f = (j / 10) * q, w = -1 + 2 * f, bulge = (1 - w * w) * R * 0.3;
        pts.push(c.x + ux * w * R + nx * bulge, c.y + uy * w * R + ny * bulge);
      }
      ribbon(g, pts, s * 0.16 * k, a);
    });
  });
  for (let i = 0; i < Math.round(8 * k); i++) {
    const a = rand(0, TAU), v = rand(120, 260) * (s / 90);
    t.spark(c.x, c.y, Math.cos(a) * v, Math.sin(a) * v - 40 * (s / 90), rand(0.35, 0.55), i % 2 ? BIT : BIT_L);
  }
  t.flash(c, WIND, 0.2 * k * (s / 80));
}

/** THE SNARE: roots bursting up round a card where it was dragged to and
 *  snapping shut over it, thorned, like a hand closing — held, then let go
 *  (the game's ROOT holds it after). */
function snare(t: FxTools, c: Pt, s: number) {
  const a0 = rand(0, TAU), n = 5;
  const roots = Array.from({ length: n }, (_, i) => ({ a: a0 + (i / n) * TAU + rand(-0.2, 0.2), curl: rand(1.6, 2.2) * (i % 2 ? 1 : -1), len: s * rand(0.46, 0.56) }));
  const D = 0.95;
  const line = (rt: (typeof roots)[number], grow: number) => {
    const pts: number[] = [];
    let x = c.x + Math.cos(rt.a) * s * 0.56, y = c.y + Math.sin(rt.a) * s * 0.54, h = rt.a + Math.PI;
    const N = 8;
    for (let i = 0; i <= N; i++) {
      pts.push(x, y);
      h += (rt.curl / N) * grow;
      x += Math.cos(h) * ((rt.len * grow) / N);
      y += Math.sin(h) * ((rt.len * grow) / N);
    }
    return pts;
  };
  const grow = (time: number) => easeOut(clamp01(time / 0.1));
  const alpha = (time: number) => 1 - clamp01((time - 0.6) / 0.35);
  const shape = (pts: number[], w: number) => {
    const n2 = pts.length / 2, left: number[] = [], right: number[] = [];
    for (let i = 0; i < n2; i++) {
      const a = Math.max(0, i - 1), b = Math.min(n2 - 1, i + 1);
      const tx = pts[b * 2] - pts[a * 2], ty = pts[b * 2 + 1] - pts[a * 2 + 1], l = Math.hypot(tx, ty) || 1, hw = (w / 2) * (1 - (0.85 * i) / (n2 - 1));
      left.push(pts[i * 2] - (ty / l) * hw, pts[i * 2 + 1] + (tx / l) * hw);
      right.unshift(pts[i * 2] + (ty / l) * hw, pts[i * 2 + 1] - (tx / l) * hw);
    }
    return left.concat(right);
  };
  t.draw(D, (g, v) => {
    const time = v * D, a = alpha(time), k = grow(time);
    for (const rt of roots) {
      const pts = line(rt, k), body = shape(pts, s * 0.15);
      g.poly(body, true).fill({ color: BARK, alpha: a });
      g.poly(pts.map((x, j) => (j % 2 ? x - s * 0.015 : x)), false).stroke({ width: 1.3, color: BARK_HI, alpha: 0.8 * a });
      g.poly(body, true).stroke({ width: 1.2, color: BARK_EDGE, alpha: a });
    }
  }, { dark: true });
  t.draw(D, (g, v) => {
    const time = v * D, a = alpha(time), k = grow(time);
    for (const rt of roots) {
      const pts = line(rt, k);
      // Thorns along its back, and a green tip where it grew.
      for (const i of [3, 6]) {
        const x = pts[i * 2], y = pts[i * 2 + 1], tx = pts[i * 2 + 2] - pts[i * 2 - 2], ty = pts[i * 2 + 3] - pts[i * 2 - 1], l = Math.hypot(tx, ty) || 1;
        g.moveTo(x, y).lineTo(x - (ty / l) * s * 0.06 - (tx / l) * s * 0.03, y + (tx / l) * s * 0.06 - (ty / l) * s * 0.03).stroke({ width: 1.3, color: LIME, alpha: 0.8 * a });
      }
      g.circle(pts[pts.length - 2], pts[pts.length - 1], s * 0.025).fill({ color: LIME, alpha: 0.8 * a });
    }
  });
  for (let i = 0; i < 6; i++) {
    const a = rand(0, TAU);
    t.spark(c.x + Math.cos(a) * s * 0.5, c.y + Math.sin(a) * s * 0.5, -Math.cos(a) * 40 * (s / 90), -Math.sin(a) * 40 * (s / 90) - 30 * (s / 90), rand(0.3, 0.5), i % 2 ? BIT : BIT_L);
  }
}
