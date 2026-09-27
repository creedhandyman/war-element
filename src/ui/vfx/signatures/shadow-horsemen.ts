/** SHADOW HORSEMEN — Shadow Charge. "Ride up to 4 spaces in any direction
 *  toward your target, dealing 5 DMG (PEN) to every opponent you pass. Then
 *  hit it for 19 DMG (PEN) + 9 DOT and gain EVASION for a round" — they ride
 *  the line the way a rumour travels, through everything in between.
 *
 *  The DELIVERY is the ride. Shadow pools under their card and three pairs of
 *  eyes open in it; then the riders pour out — horses' heads of dark smoke lit
 *  violet along their edges, each with a hooded rider hunched over the neck and
 *  a lance couched — and charge the line in a wedge, heads bobbing at the
 *  gallop, their smoke boiling off behind them and ember hoofprints left
 *  burning on the ground. Every card they pass flashes as they go through it.
 *  The leader's lance is on the target as the delivery ends.
 *
 *  The LANDING is the lance strike: three lances driven through the card and
 *  out the far side — PEN: armour was never part of the conversation — a burst
 *  of darkness on it with violet fire rising off it (the DOT), and the riders
 *  going on straight through it and coming apart into smoke beyond. Each card
 *  they trampled on the way takes a smaller cut of shadow and a hoofprint.
 *
 *  Darkness is drawn for real (`dark: true`) and every dark shape carries a
 *  violet edge, as DUSK's own look does: on the near-black board a shadow only
 *  reads against something lit. */
import { centre, rand } from "../looks/base";
import { pyroFlick, pyroTongue } from "../looks/fire";
import type { Graphics } from "pixi.js";
import type { FxTools, Pt, SparkStyle } from "../looks/types";
import type { Signature, SigMoment } from "./types";

type Box = { x: number; y: number; w: number; h: number };

const TAU = Math.PI * 2;
const PALE = 0xf3e8ff, LILAC = 0xc9a6ff, VIOLET = 0x9a6ad8, PURPLE = 0x7b4fb0, DEEP = 0x4a2a78;
/** The shadow itself — only ever on the dark layer. */
const INK = 0x0b0418;
/** What burns in a hoofprint: a hotter violet, so it reads as an ember. */
const EMBER = 0xe0b0ff;

/** Smoke off the riders: round, swelling as it thins, drifting up. */
const SMOKE: SparkStyle = { palette: [LILAC, VIOLET, PURPLE, DEEP], gravity: -50, drag: 0.4, size: [4, 12], streak: false };
/** Motes of shadow drawn in as they gather. */
const MOTE_IN: SparkStyle = { palette: [PALE, LILAC, VIOLET], gravity: 0, drag: 1, size: [7, 2], streak: true, swirl: 260 };
/** Torn out the far side of a card the lances went through. */
const THROUGH: SparkStyle = { palette: [PALE, LILAC, VIOLET, PURPLE], gravity: 0, drag: 0.4, size: [8, 3], streak: true };
/** Cinders off the violet fire, rising. */
const CINDER = [PALE, EMBER, VIOLET, PURPLE];

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeOut = (x: number) => 1 - (1 - x) * (1 - x);
/** 0 -> 1 as `u` runs from `a` to `b`. */
const span = (u: number, a: number, b: number) => clamp01((u - a) / (b - a));

/** The card they rode at: the one that took the most (the lance); the rest
 *  were trampled on the way. The targets come in the order the engine touched
 *  them, so the trampled come first. */
function mainOf(power: number[]): number {
  let best = 0;
  for (let i = 1; i < power.length; i++) if (power[i] > power[best]) best = i;
  return best;
}

// ── The ride ────────────────────────────────────────────────────────────────

type At = { x: number; y: number; ux: number; uy: number };

/** The line they ride: from their square, bent through the square they pull
 *  up on, onto the target — sampled by distance, so the riders keep an even
 *  gallop round a bend — and carried on straight past either end (the
 *  flankers start behind the leader; the landing rides on through). */
function trail(a: Pt, via: Pt, b: Pt, fallback: Pt) {
  const N = 32, xs: number[] = [], ys: number[] = [], ds: number[] = [0];
  for (let i = 0; i <= N; i++) {
    const v = i / N;
    xs.push((1 - v) * (1 - v) * a.x + 2 * (1 - v) * v * via.x + v * v * b.x);
    ys.push((1 - v) * (1 - v) * a.y + 2 * (1 - v) * v * via.y + v * v * b.y);
    if (i > 0) ds.push(ds[i - 1] + Math.hypot(xs[i] - xs[i - 1], ys[i] - ys[i - 1]));
  }
  const L = ds[N];
  const seg = (i: number): Pt => {
    const dx = xs[i + 1] - xs[i], dy = ys[i + 1] - ys[i], d = Math.hypot(dx, dy);
    return d > 1e-6 ? { x: dx / d, y: dy / d } : fallback;
  };
  const first = seg(0), last = seg(N - 1);
  const at = (d: number): At => {
    if (d <= 0 || L < 1e-6) return { x: a.x + first.x * d, y: a.y + first.y * d, ux: first.x, uy: first.y };
    if (d >= L) return { x: b.x + last.x * (d - L), y: b.y + last.y * (d - L), ux: last.x, uy: last.y };
    let i = 0;
    while (ds[i + 1] < d) i++;
    const f = (d - ds[i]) / Math.max(1e-6, ds[i + 1] - ds[i]), u = seg(i);
    return { x: xs[i] + (xs[i + 1] - xs[i]) * f, y: ys[i] + (ys[i + 1] - ys[i]) * f, ux: u.x, uy: u.y };
  };
  /** How far along the line the point nearest `q` is. */
  const nearest = (q: Pt) => {
    let best = 0, bd = Infinity;
    for (let i = 0; i <= N; i++) {
      const d = Math.hypot(xs[i] - q.x, ys[i] - q.y);
      if (d < bd) { bd = d; best = ds[i]; }
    }
    return best;
  };
  return { L, at, nearest };
}

/** Fraction of the delivery at which the ride starts: before it they gather. */
const RIDE = 0.14;

/** The riders, in a wedge: the leader on the line, the other two back and to
 *  either side of it, a little smaller, each with its own stride. `back` and
 *  `side` are in squares. */
const RIDERS = [
  { back: 0, side: 0, size: 1, ph: 0 },
  { back: 0.3, side: -0.42, size: 0.86, ph: 2.1 },
  { back: 0.44, side: 0.4, size: 0.82, ph: 4.2 },
];

/** Everything the delivery and the landing agree on: the line, the leader's
 *  lance-point along it through the delivery, and which way the heads face. */
function ride(m: SigMoment) {
  const s = m.size, c0 = centre(m.from), hit = mainOf(m.power);
  const p = m.targets.length ? centre(m.targets[hit]) : centre(m.to);
  const path = trail(c0, centre(m.to), p, m.ahead);
  const lance = s * 0.42, d0 = lance + s * 0.1;
  /** The leader's lance-point, `u` into the delivery: gathering, then away —
   *  quickening all the way, and on the target at the end. */
  const tip = (u: number) => { const f = span(u, RIDE, 1); return d0 + (Math.max(path.L, d0) - d0) * f * (0.45 + 0.55 * f); };
  // A horse reads in profile, the way a chess knight is drawn — turned to
  // face along a ride up the board it is only a shape. So the heads face the
  // side the ride goes (picked once, so no rider flips mid-ride), noses
  // tipped into the charge.
  const side = p.x < c0.x - s * 0.05 ? -1 : 1;
  return { s, c0, p, hit, path, lance, tip, side };
}

// ── A rider ─────────────────────────────────────────────────────────────────

/** A horse's head and neck in profile, charging, with its rider hunched over
 *  the neck: (forward, up) in units of its size, muzzle at the origin. A
 *  HORSE's head, not any beast's: long, a big round jowl at the back tapering
 *  down a straight face to a narrow muzzle, ears pricked; the neck stretched
 *  out behind and dissolving; the rider's hood rising off the withers. One
 *  outline, so it fills as one shadow. */
const HORSE = [
  0, 0, -0.02, -0.1, -0.12, -0.14, -0.35, -0.14, -0.62, -0.22, -0.78, -0.12, -0.84, -0.04, -1.05, -0.18, -1.3, -0.3,
  -1.45, -0.08, -1.38, 0.24, -1.3, 0.55, -1.16, 0.78, -1.04, 0.62, -0.98, 0.42, -0.9, 0.34, -0.82, 0.3, -0.8, 0.52,
  -0.72, 0.62, -0.7, 0.36, -0.62, 0.3, -0.5, 0.24, -0.25, 0.15, -0.06, 0.08,
];
/** The run of the outline that faces into the charge (brow to muzzle): lit
 *  brightest, as if they ride out of their own light. */
const FACE = [20, 21, 22, 23, 0, 1];
/** Where the rider's hands are, and the eye. */
const HANDS: Pt = { x: -1.0, y: 0.36 }, EYE: Pt = { x: -0.55, y: 0.18 };

/** A rider at the gallop, its muzzle at `at`: in profile facing `side`, nose
 *  tipped toward the way it rides, the head dipping and lifting to the
 *  stride. `P(f, h)` places a point of the outline; (ux, uy) is the ride. */
function pose(at: At, side: number, size: number, time: number, ph: number) {
  let fx = side + at.ux * 0.8, fy = at.uy * 0.8;
  const fl = Math.hypot(fx, fy) || 1;
  fx /= fl;
  fy /= fl;
  const bob = 0.1 * Math.sin(time * 20 + ph), c = Math.cos(bob), sn = Math.sin(bob);
  const gx = fx * c - fy * sn, gy = fx * sn + fy * c;
  // Its top is whichever side of it faces up the screen. (It never faces
  // straight up or down: `side` keeps it turned at least a little.)
  const hx = gx > 0 ? gy : -gy, hy = gx > 0 ? -gx : gx;
  const P = (f: number, h: number): Pt => ({
    x: at.x + gx * f * size + hx * (h - 0.2) * size, y: at.y + gy * f * size + hy * (h - 0.2) * size,
  });
  return { ux: at.ux, uy: at.uy, x: at.x, y: at.y, P };
}

type Pose = ReturnType<typeof pose>;

function outline(q: Pose): number[] {
  const out: number[] = [];
  for (let i = 0; i < HORSE.length; i += 2) {
    const p = q.P(HORSE[i], HORSE[i + 1]);
    out.push(p.x, p.y);
  }
  return out;
}

/** The smoke its body is made of, boiling off behind the neck and streaming
 *  back down the line it rides: `k` = 0..4, nearest first. */
function smokeAt(q: Pose, size: number, time: number, ph: number, k: number): Pt {
  const nb = q.P(-1.3, 0.1), w = 0.14 * size * Math.sin(time * 9 + ph + k * 1.7), d = 0.24 * size * k;
  return { x: nb.x - q.ux * d - q.uy * w, y: nb.y - q.uy * d + q.ux * w };
}

/** The dark of a rider: its outline, and the smoke of its body. */
function riderShadow(g: Graphics, q: Pose, size: number, time: number, ph: number, a: number) {
  if (a <= 0.01) return;
  g.poly(outline(q)).fill({ color: INK, alpha: 0.9 * a });
  for (let k = 0; k < 5; k++) {
    const c = smokeAt(q, size, time, ph, k);
    g.circle(c.x, c.y, size * (0.26 + 0.06 * k)).fill({ color: INK, alpha: (0.62 - 0.11 * k) * a });
  }
}

/** The light of a rider: a faint violet body with a lit edge, brightest along
 *  the face; a burning eye; the mane streaming back off the crest; and the
 *  couched lance from the rider's hands, aimed down the line to `tip`. */
function riderLight(g: Graphics, q: Pose, size: number, tip: Pt, time: number, ph: number, a: number, eyes: number) {
  if (a > 0.01) {
    g.poly(outline(q)).fill({ color: PURPLE, alpha: 0.22 * a }).stroke({ width: 1.4, color: LILAC, alpha: 0.85 * a });
    // The smoke of its body, faintly lit from inside.
    for (let k = 1; k < 5; k++) {
      const c = smokeAt(q, size, time, ph, k);
      g.circle(c.x, c.y, size * (0.26 + 0.06 * k)).fill({ color: DEEP, alpha: (0.42 - 0.08 * k) * a });
    }
    const face: number[] = [];
    for (const i of FACE) { const p = q.P(HORSE[2 * i], HORSE[2 * i + 1]); face.push(p.x, p.y); }
    g.poly(face, false).stroke({ width: 2, color: PALE, alpha: 0.9 * a, cap: "round" });
    // The mane: three wisps off the crest, whipping back.
    for (let k = 0; k < 3; k++) {
      const pts: number[] = [];
      for (let i = 0; i <= 8; i++) {
        const f = i / 8, wv = 0.1 * f * Math.sin(time * 16 + ph + k * 1.3 - f * 5);
        const p = q.P(-0.86 - 0.2 * k - 0.75 * f, 0.34 - 0.05 * k + wv - 0.06 * f);
        pts.push(p.x, p.y);
      }
      g.poly(pts, false).stroke({ width: 2.2 - 0.5 * k, color: k ? VIOLET : LILAC, alpha: 0.8 * a, cap: "round" });
    }
    // The lance, couched: a violet shaft with a pale core, and its point.
    const h0 = q.P(HANDS.x, HANDS.y), dx = tip.x - h0.x, dy = tip.y - h0.y, dl = Math.hypot(dx, dy) || 1;
    const ux = dx / dl, uy = dy / dl, hl = size * 0.3, hw = size * 0.07;
    g.moveTo(h0.x, h0.y).lineTo(tip.x, tip.y).stroke({ width: 5, color: VIOLET, alpha: 0.3 * a });
    g.moveTo(h0.x, h0.y).lineTo(tip.x, tip.y).stroke({ width: 1.6, color: PALE, alpha: 0.9 * a });
    g.poly([tip.x, tip.y, tip.x - ux * hl * 0.6 - uy * hw, tip.y - uy * hl * 0.6 + ux * hw, tip.x - ux * hl, tip.y - uy * hl,
      tip.x - ux * hl * 0.6 + uy * hw, tip.y - uy * hl * 0.6 - ux * hw]).fill({ color: PALE, alpha: 0.9 * a });
  }
  // The eye opens first — before the rest of it has come out of the dark.
  if (eyes > 0.01) {
    const e = q.P(EYE.x, EYE.y);
    g.circle(e.x, e.y, size * 0.12).fill({ color: VIOLET, alpha: 0.35 * eyes });
    g.circle(e.x, e.y, Math.max(1.2, size * 0.05)).fill({ color: PALE, alpha: eyes });
  }
}

/** A hoofprint burning on the ground: a horseshoe, open to the heel, glowing
 *  and going out. */
function hoofprint(g: Graphics, x: number, y: number, ang: number, r: number, a: number) {
  if (a <= 0.01) return;
  g.circle(x, y, r * 1.7).fill({ color: VIOLET, alpha: 0.22 * a });
  g.moveTo(x + Math.cos(ang - 1.9) * r, y + Math.sin(ang - 1.9) * r).arc(x, y, r, ang - 1.9, ang + 1.9)
    .stroke({ width: 2, color: EMBER, alpha: 0.95 * a, cap: "round" });
}

// ── Shadow ──────────────────────────────────────────────────────────────────

/** A shadow stain: overlapping discs, so its edge is ragged, densest in the
 *  middle where they stack. */
function blot(g: Graphics, x: number, y: number, r: number, alpha: number, seed: number) {
  if (r < 0.5 || alpha <= 0.01) return;
  g.circle(x, y, r * 0.62);
  for (let i = 0; i < 5; i++) {
    const a = seed + i * 1.7;
    g.circle(x + Math.cos(a) * r * 0.4, y + Math.sin(a) * r * 0.4, r * (0.44 + 0.08 * (i % 3)));
  }
  g.fill({ color: INK, alpha });
}

/** A cut of shadow across a card, along a curve (`c` = p0, control, p2):
 *  sharp at both ends, widest mid-way, laid down up to `drawn` of its length
 *  so it tears across rather than appearing. */
function gash(g: Graphics, c: number[], w: number, drawn: number, color: number, alpha: number) {
  if (drawn <= 0 || alpha <= 0.01) return;
  const n = 10, left: number[] = [], right: number[] = [];
  for (let i = 0; i <= n; i++) {
    const s = (i / n) * drawn, q = 1 - s;
    const x = q * q * c[0] + 2 * q * s * c[2] + s * s * c[4], y = q * q * c[1] + 2 * q * s * c[3] + s * s * c[5];
    const tx = q * (c[2] - c[0]) + s * (c[4] - c[2]), ty = q * (c[3] - c[1]) + s * (c[5] - c[3]), tl = Math.hypot(tx, ty) || 1;
    const hw = (w / 2) * Math.pow(Math.sin(Math.PI * s), 0.7);
    left.push(x - (ty / tl) * hw, y + (tx / tl) * hw);
    right.push(x + (ty / tl) * hw, y - (tx / tl) * hw);
  }
  for (let i = n; i >= 0; i--) left.push(right[2 * i], right[2 * i + 1]);
  g.poly(left).fill({ color, alpha });
}

/** A lance driven clean through: a shaft from `a` to `b`, the point at `b`. */
function spear(g: Graphics, a: Pt, b: Pt, w: number, alpha: number) {
  const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy);
  if (len < 2 || alpha <= 0.01) return;
  const ux = dx / len, uy = dy / len, nx = -uy, ny = ux, head = Math.min(len * 0.4, w * 4.5);
  g.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ width: w * 2.6, color: VIOLET, alpha: 0.3 * alpha });
  g.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ width: w, color: LILAC, alpha: 0.9 * alpha });
  const hx = b.x - ux * head, hy = b.y - uy * head;
  g.poly([b.x, b.y, hx + ux * head * 0.35 + nx * w * 1.1, hy + uy * head * 0.35 + ny * w * 1.1, hx, hy,
    hx + ux * head * 0.35 - nx * w * 1.1, hy + uy * head * 0.35 - ny * w * 1.1]).fill({ color: PALE, alpha });
  g.moveTo(a.x, a.y).lineTo(hx, hy).stroke({ width: Math.max(1, w * 0.35), color: PALE, alpha });
}

export const SHADOW_HORSEMEN: Signature = {
  shake: 1.5,
  // They do not lunge: the ride is drawn, the whole way.
  lunge: false,

  deliver(t: FxTools, m, seconds) {
    const T = seconds, R = ride(m), s = R.s, k = s / 90, seed = rand(0, TAU);
    const size = s * 0.44;

    // THE MUSTER: shadow pooling under their card, a lit rim round it, motes
    // of it drawn in — the dark they ride out of.
    t.draw(T * 0.7, (g, u) => {
      blot(g, R.c0.x, R.c0.y, s * 0.5 * easeOut(span(u, 0, 0.3)), 0.55 * (1 - span(u, 0.5, 1)), seed);
    }, { dark: true });
    t.draw(T * 0.7, (g, u) => {
      const r = s * 0.46 * easeOut(span(u, 0, 0.3));
      if (r > 1) g.circle(R.c0.x, R.c0.y, r).stroke({ width: 1.5, color: LILAC, alpha: 0.6 * (1 - span(u, 0.5, 1)) });
    });
    for (let i = 0; i < Math.round(16 * t.quality); i++) {
      const a = rand(0, TAU), r = s * rand(0.45, 0.7), l = rand(0.15, T * 0.3), v = r / l;
      t.spark(R.c0.x + Math.cos(a) * r, R.c0.y + Math.sin(a) * r, (-Math.cos(a) - Math.sin(a) * 0.4) * v,
        (-Math.sin(a) + Math.cos(a) * 0.4) * v, l, MOTE_IN, R.c0);
    }

    // THE RIDE: each rider at its place in the wedge behind the leader's
    // lance-point — eyes first, then the rest of it out of the dark, then away
    // at the gallop.
    const place = (u: number, i: number): At => {
      const r = RIDERS[i], time = u * T;
      const d = R.tip(u) - R.lance - r.back * s + 0.04 * s * Math.sin(time * 40 + r.ph);
      const at = R.path.at(d), off = r.side * s + 0.03 * s * Math.sin(time * 20 + r.ph);
      return { x: at.x - at.uy * off, y: at.y + at.ux * off, ux: at.ux, uy: at.uy };
    };
    t.draw(T, (g, u) => {
      const time = u * T, body = span(u, 0.05, RIDE + 0.08);
      for (let i = RIDERS.length - 1; i >= 0; i--) {
        const r = RIDERS[i];
        riderShadow(g, pose(place(u, i), R.side, size * r.size, time, r.ph), size * r.size, time, r.ph, body);
      }
    }, { dark: true });
    let acc = 0;
    t.draw(T, (g, u, dt) => {
      const time = u * T, body = span(u, 0.05, RIDE + 0.08), eyes = span(u, 0.01, 0.07);
      for (let i = RIDERS.length - 1; i >= 0; i--) {
        const r = RIDERS[i], at = place(u, i);
        riderLight(g, pose(at, R.side, size * r.size, time, r.ph), size * r.size, { x: at.x + at.ux * R.lance, y: at.y + at.uy * R.lance },
          time, r.ph, body, eyes);
      }
      // Smoke torn off them as they ride.
      if (u > RIDE) {
        acc += dt * 60 * t.quality;
        for (; acc >= 1; acc--) {
          const i = Math.floor(rand(0, RIDERS.length)), at = place(u, i);
          const c = smokeAt(pose(at, R.side, size * RIDERS[i].size, time, RIDERS[i].ph), size * RIDERS[i].size, time, RIDERS[i].ph, 1);
          t.spark(c.x, c.y, -at.ux * rand(20, 60) * k, -at.uy * rand(20, 60) * k - rand(10, 40) * k, rand(0.3, 0.5), SMOKE);
        }
      }
    });

    // THE HOOFPRINTS: left burning where each rider's hooves came down, one
    // every stride, and going out behind them.
    const STRIDE = s * 0.46, prints: { x: number; y: number; ang: number; at: number }[] = [];
    const when = (d: number) => {
      // The moment the leader's lance-point is `d` along the line: the ride
      // only ever goes forward, so halve the interval.
      let lo = RIDE, hi = 1;
      for (let j = 0; j < 18; j++) { const mid = (lo + hi) / 2; if (R.tip(mid) < d) lo = mid; else hi = mid; }
      return hi;
    };
    RIDERS.forEach((r, i) => {
      const lag = R.lance + r.back * s + size * r.size * 1.3; // lance-point to the hooves, under the chest
      const first = R.tip(RIDE) - lag, last = R.tip(1) - lag;
      for (let d = first + STRIDE * (0.5 + 0.3 * i), n = 0; d < last; d += STRIDE, n++) {
        const at = R.path.at(d), side = (n % 2 ? 1 : -1) * s * 0.07 + r.side * s;
        prints.push({ x: at.x - at.uy * side, y: at.y + at.ux * side, ang: Math.atan2(at.uy, at.ux), at: when(d + lag) * T });
      }
    });
    t.draw(T + 0.55, (g, u) => {
      const time = u * (T + 0.55);
      for (const pr of prints) {
        const age = time - pr.at;
        if (age >= 0) hoofprint(g, pr.x, pr.y, pr.ang, s * 0.05, 0.8 * (1 - span(age, 0.12, 0.5)));
      }
    });

    // THE TRAMPLED: each card they ride through flashes as the leader passes.
    m.targets.forEach((tr, i) => {
      if (i === R.hit) return;
      const d = R.path.nearest(centre(tr));
      t.later(when(d + R.lance) * T, () => {
        t.flash(centre(tr), VIOLET, 0.4);
        t.ring(tr, LILAC, 0.9, 0.35, 0.25, 3);
      });
    });
  },

  land(t: FxTools, m) {
    const R = ride(m), s = R.s, k = s / 90, seed = rand(0, TAU), size = s * 0.44;
    const p = R.p, end = R.path.at(R.path.L), ux = end.ux, uy = end.uy, nx = -uy, ny = ux;
    const kk = m.targets.length ? Math.max(0.8, Math.min(1.8, m.power[R.hit])) : 0.8;
    const killed = m.targets.length > 0 && m.killed[R.hit];

    // THE RIDERS go on straight through the card and come apart beyond it,
    // thinning to smoke as they go, the smoke left hanging where they were.
    const THRU = 0.32, speed = s * 5;
    const place = (time: number, i: number): At => {
      const r = RIDERS[i], at = R.path.at(R.path.L - R.lance - r.back * s + speed * time);
      return { x: at.x - at.uy * r.side * s, y: at.y + at.ux * r.side * s, ux: at.ux, uy: at.uy };
    };
    t.draw(THRU, (g, u) => {
      const time = u * THRU;
      for (let i = RIDERS.length - 1; i >= 0; i--) {
        const r = RIDERS[i];
        riderShadow(g, pose(place(time, i), R.side, size * r.size, time, r.ph), size * r.size, time, r.ph, Math.pow(1 - u, 1.5));
      }
    }, { dark: true });
    t.draw(THRU, (g, u) => {
      const time = u * THRU;
      for (let i = RIDERS.length - 1; i >= 0; i--) {
        const r = RIDERS[i], at = place(time, i);
        riderLight(g, pose(at, R.side, size * r.size, time, r.ph), size * r.size, { x: at.x + at.ux * R.lance, y: at.y + at.uy * R.lance },
          time, r.ph, 1 - u, 1 - u);
      }
    });
    for (let i = 0; i < RIDERS.length; i++)
      t.later(rand(0.12, 0.26), () => {
        const at = place(0.2, i);
        for (let j = 0; j < Math.round(7 * t.quality); j++)
          t.spark(at.x + rand(-0.2, 0.2) * s, at.y + rand(-0.2, 0.2) * s, ux * rand(30, 90) * k + rand(-30, 30) * k,
            uy * rand(30, 90) * k - rand(20, 60) * k, rand(0.4, 0.7), SMOKE);
      });

    if (!m.targets.length) return;

    // THE LANCE STRIKE: three lances driven through the card and out the far
    // side, one a beat after another...
    const lances = [0, -0.2, 0.2].map((o, i) => ({ o, at: i * 0.035, reach: rand(0.85, 1.05) }));
    t.draw(0.5, (g, u) => {
      const age = u * 0.5;
      for (const l of lances) {
        const a = age - l.at;
        if (a <= 0) continue;
        const grow = easeOut(clamp01(a / 0.07)), fade = 1 - span(a, 0.16, 0.42);
        const bx = p.x - ux * s * 0.8 + nx * l.o * s, by = p.y - uy * s * 0.8 + ny * l.o * s;
        const L = s * (0.8 + l.reach * Math.min(1.3, kk) * 0.8) * grow;
        spear(g, { x: bx, y: by }, { x: bx + ux * L, y: by + uy * L }, 3 * Math.min(1.3, kk), fade);
      }
    });
    t.flash(p, VIOLET, 0.45 + 0.1 * kk);
    // ...what they tear out the far side...
    const nt = Math.round(14 * kk * t.quality);
    for (let i = 0; i < nt; i++) {
      const a = Math.atan2(uy, ux) + rand(-0.45, 0.45), v = rand(160, 320) * k;
      t.spark(p.x + ux * s * 0.3, p.y + uy * s * 0.3, Math.cos(a) * v, Math.sin(a) * v, rand(0.3, 0.5), THROUGH);
    }
    // ...and the burst of darkness on it, ringed in violet...
    const BD = 0.85;
    t.draw(BD, (g, u) => {
      const time = u * BD, r = s * 0.5 * Math.min(1.4, kk) * (killed ? 1.2 : 1) * easeOut(span(time, 0, 0.1));
      blot(g, p.x, p.y, r, 0.6 * (1 - span(time, 0.3, BD)), seed);
    }, { dark: true });
    t.draw(0.55, (g, u) => {
      const e = easeOut(u), f = 1 - u;
      g.circle(p.x, p.y, s * (0.3 + 0.55 * e) * Math.min(1.3, kk)).stroke({ width: 3 * f + 1, color: VIOLET, alpha: 0.7 * f });
      g.circle(p.x, p.y, s * (0.28 + 0.5 * e) * Math.min(1.3, kk)).stroke({ width: 1.5, color: PALE, alpha: 0.85 * f });
    });
    // ...with violet fire rising off it: the DOT, burning.
    const FD = 0.8, tongues = [-0.3, -0.1, 0.12, 0.3].map((o) => ({ o, seed: rand(0, 100), h: rand(0.75, 1.1) }));
    t.draw(FD, (g, u) => {
      const time = u * FD, a = span(time, 0.04, 0.12) * (1 - span(time, 0.45, FD));
      const H = s * 0.5 * Math.min(1.4, kk) * (killed ? 1.25 : 1);
      for (const f of tongues) {
        const hh = H * f.h * (1 + 0.25 * pyroFlick(time, f.seed)), bx = p.x + f.o * s, by = p.y + s * 0.3;
        const lean = hh * 0.25 * pyroFlick(time * 0.8, f.seed + 3);
        pyroTongue(g, bx, by, 0, -1, hh, s * 0.2, lean, PURPLE, 0.55 * a);
        pyroTongue(g, bx, by, 0, -1, hh * 0.7, s * 0.13, lean * 0.8, VIOLET, 0.65 * a);
        pyroTongue(g, bx, by, 0, -1, hh * 0.38, s * 0.07, lean * 0.4, PALE, 0.8 * a);
      }
    });
    t.later(0.1, () => t.emit({ count: Math.round(12 * kk), palette: CINDER, from: { x: p.x - s * 0.35, y: p.y - s * 0.1, w: s * 0.7, h: s * 0.4 },
      dir: [-115, -65], speed: [40, 110], gravity: -150, drag: 0.5, life: [0.4, 0.7], size: [6, 2] }));

    // THE TRAMPLED: a smaller cut of shadow across each card they rode
    // through, torn along the way they went, with a hoofprint left on it.
    m.targets.forEach((q, i) => {
      if (i === R.hit) return;
      t.later(0.02 + 0.04 * i, () => trampled(t, q, m.power[i] ?? 0.8, R.path.at(R.path.nearest(centre(q)))));
    });
  },
};

/** A card the riders went through on the way: two cuts of shadow torn across
 *  it where they passed — dark wounds under lit violet edges, one a beat after
 *  the other — and smoke off it. */
function trampled(t: FxTools, r: Box, power: number, line: At) {
  const c = centre(r), s = Math.min(r.w, r.h), kk = Math.max(0.55, Math.min(1.3, power));
  // Across the line they rode, a little off square, so it reads as a cut.
  const ang = Math.atan2(line.uy, line.ux) + Math.PI / 2 + 0.35, ux = Math.cos(ang), uy = Math.sin(ang), nx = -uy, ny = ux;
  const L = s * 0.32 * kk, bow = L * 0.22, gap = s * 0.13;
  const cuts = [-1, 1].map((j) => {
    const mx = c.x + nx * gap * j + ux * L * 0.1 * j, my = c.y + ny * gap * j + uy * L * 0.1 * j;
    return [mx - ux * L, my - uy * L, mx - nx * bow, my - ny * bow, mx + ux * L, my + uy * L];
  });
  const drawn = (time: number, j: number) => span(time, j * 0.05, j * 0.05 + 0.08);
  t.draw(0.5, (g, u) => {
    const time = u * 0.5, f = 1 - span(time, 0.25, 0.5);
    cuts.forEach((cut, j) => gash(g, cut, 11 * kk, drawn(time, j), INK, 0.7 * f));
  }, { dark: true });
  t.draw(0.45, (g, u) => {
    const time = u * 0.45, f = 1 - span(time, 0.14, 0.45);
    cuts.forEach((cut, j) => {
      gash(g, cut, 4.5 * kk, drawn(time, j), VIOLET, 0.95 * f);
      gash(g, cut, 1.8, drawn(time, j), PALE, f);
    });
  });
  t.ring(r, LILAC, 0.4, 0.95, 0.3, 2);
  for (let i = 0; i < Math.round(6 * kk); i++)
    t.spark(c.x + rand(-0.25, 0.25) * s, c.y + rand(-0.2, 0.2) * s, rand(-20, 20), -rand(30, 70), rand(0.4, 0.65), SMOKE);
}
