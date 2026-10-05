/** MAGMAW — Molten Rampage. "Strike one opponent up to 4× for 4 DMG; on a kill
 *  the rest chain to a new enemy at +3 DMG each." Four bites at one target,
 *  and if it drops the rest carry on into the next.
 *
 *  Its art is a towering rock behemoth with two huge blocky FISTS of cracked
 *  stone, magma glowing through every crack, swinging them down into the
 *  ground in a shower of sparks. Its fire is the fire inside rock: it lives in
 *  the knuckles and the cracks, and it comes out where stone hits.
 *
 *  The DELIVERY is the fists heating up: two stone fists at the front corners
 *  of its card, dark rock with lava in their seams, the knuckles going from a
 *  dull red through orange to white as embers lift off them — and at the end
 *  the left one is already swinging.
 *
 *  The LANDING is the rampage, four punches as four separate beats, left,
 *  right, left, right, each a stone fist driven in from Magmaw's side. Every
 *  one leaves a fist-print on the card — four knuckle dents punched into it,
 *  cracks of lava running out from them — throws chunks of rock and a shower
 *  of sparks, and each is hotter than the last: red, orange, gold, and the
 *  fourth white-hot and heaviest. On a chain (the first target killed) the
 *  rampage does not stop: a molten streak leaps from the fallen card to the
 *  next and the rest of the punches land there, hotter still.
 *
 *  The rock is drawn dark for real (`dark: true`) with its glowing seams and
 *  a heat-lit rim over it, so a fist reads over an empty square and over a
 *  card alike; the light is all in the knuckles, the cracks and the sparks. */
import type { Graphics } from "pixi.js";
import { centre, rand } from "../../looks/base";
import type { FxTools, Pt, SparkStyle } from "../../looks/types";
import type { Signature, SigMoment } from "../types";

type Box = SigMoment["from"];

const TAU = Math.PI * 2;
// Stone, and the heat in it: dull red to white.
const ROCK = 0x1c0e08, DEEP = 0xa01a0c, LAVA = 0xe8400e, MOLTEN = 0xff8020, GOLD = 0xffc848, HOT = 0xfff6dc;
/** Embers lifting off a heating knuckle. */
const EMBER: SparkStyle = { palette: [GOLD, MOLTEN, LAVA, DEEP], gravity: -140, drag: 0.55, size: [4, 1.5], streak: false };
/** The shower of sparks off a punch: fast streaks, falling as they cool. */
const SHOWER: SparkStyle = { palette: [HOT, GOLD, MOLTEN, DEEP], gravity: 700, drag: 0.5, size: [5, 1.5], streak: true };

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeOut = (x: number) => 1 - (1 - x) * (1 - x);
const easeIn = (x: number) => x * x;
/** Heat as a colour: 0 a dull red, 1 white-hot. */
function heat(k: number): number {
  const stops = [DEEP, LAVA, MOLTEN, GOLD, HOT];
  const f = clamp01(k) * (stops.length - 1), i = Math.min(stops.length - 2, Math.floor(f)), q = f - i;
  const a = stops[i], b = stops[i + 1];
  const ch = (sh: number) => Math.round(((a >> sh) & 255) + (((b >> sh) & 255) - ((a >> sh) & 255)) * q);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

/** When each punch lands after the landing begins, and how long a fist takes
 *  to come in. Four beats ~0.1s apart: a rampage, not a flurry. */
const GAP = 0.1, SWING = 0.08;

// ── The fist ─────────────────────────────────────────────────────────────────

/** A point in a fist's own frame: `a` forward along `f` (the way it punches),
 *  `b` across it. */
const at = (c: Pt, f: Pt, a: number, b: number): Pt => ({ x: c.x + f.x * a - f.y * b, y: c.y + f.y * a + f.x * b });

/** A block with its corners knocked off, in a fist's frame: hewn stone, not a
 *  rounded box. */
function block(c: Pt, f: Pt, a0: number, a1: number, b0: number, b1: number, cut: number): number[] {
  const corners: [number, number][] = [[a0 + cut, b0], [a1 - cut, b0], [a1, b0 + cut], [a1, b1 - cut], [a1 - cut, b1], [a0 + cut, b1], [a0, b1 - cut], [a0, b0 + cut]];
  const pts: number[] = [];
  for (const [a, b] of corners) {
    const p = at(c, f, a, b);
    pts.push(p.x, p.y);
  }
  return pts;
}

/** A stone fist centred on `c`, punching along `f`, `L` long and `W` across:
 *  the block of the hand, four knuckles along its front, a thumb on one side
 *  (`side`), and two cracks across its back. */
function fistShape(c: Pt, f: Pt, L: number, W: number, side: number) {
  const body = block(c, f, -L / 2, L * 0.28, -W / 2, W / 2, W * 0.12);
  const knuckles = [0, 1, 2, 3].map((i) => {
    const b0 = -W / 2 + (W * i) / 4 + W * 0.02, b1 = b0 + W / 4 - W * 0.04;
    return block(c, f, L * 0.22, L / 2, b0, b1, W * 0.05);
  });
  const thumb = block(c, f, -L * 0.15, L * 0.18, side * W * 0.42, side * W * 0.62, W * 0.05);
  const p = (a: number, b: number) => at(c, f, a, b);
  const c1 = [p(-L * 0.4, -W * 0.3), p(-L * 0.12, -W * 0.05), p(-L * 0.2, W * 0.2), p(L * 0.05, W * 0.38)];
  const c2 = [p(-L * 0.45, W * 0.1), p(-L * 0.25, -W * 0.15), p(L * 0.1, -W * 0.2)];
  return { body, knuckles, thumb, cracks: [c1, c2], front: p(L / 2, 0) };
}

/** A fist's stone, on the dark layer. */
function fistDark(g: Graphics, sh: ReturnType<typeof fistShape>, a: number) {
  if (a <= 0.02) return;
  g.poly(sh.body, true).fill({ color: ROCK, alpha: 0.95 * a });
  g.poly(sh.thumb, true).fill({ color: ROCK, alpha: 0.95 * a });
  for (const k of sh.knuckles) g.poly(k, true).fill({ color: ROCK, alpha: 0.95 * a });
}

/** A fist's heat, over its stone: a rim lit by the glow inside it, lava in
 *  its cracks, and knuckles glowing at `k` (0 dull red, 1 white-hot). */
function fistLit(g: Graphics, sh: ReturnType<typeof fistShape>, k: number, a: number, s: number) {
  if (a <= 0.02) return;
  const col = heat(k);
  g.circle(sh.front.x, sh.front.y, s * (0.08 + 0.08 * k)).fill({ color: MOLTEN, alpha: (0.06 + 0.14 * k) * a });
  g.poly(sh.body, true).stroke({ width: 1.4, color: heat(k * 0.55), alpha: 0.85 * a, join: "round" });
  g.poly(sh.thumb, true).stroke({ width: 1.2, color: heat(k * 0.55), alpha: 0.8 * a, join: "round" });
  for (const cr of sh.cracks) {
    g.moveTo(cr[0].x, cr[0].y);
    for (let i = 1; i < cr.length; i++) g.lineTo(cr[i].x, cr[i].y);
    g.stroke({ width: 1.4, color: heat(k * 0.8), alpha: 0.9 * a, join: "round" });
  }
  for (const kn of sh.knuckles) g.poly(kn, true).fill({ color: col, alpha: (0.45 + 0.4 * k) * a }).stroke({ width: 1, color: heat(Math.min(1, k + 0.2)), alpha: 0.9 * a });
}

// ── The rampage ──────────────────────────────────────────────────────────────

interface Punch { i: number; r: Box; p: Pt; from: Pt; f: Pt; side: number; k: number; heat: number; last: boolean; kill: boolean; hit: Pt }

/** The four punches: which card each lands on and how hot it is. On a chain
 *  the rest of the four land on the second card; how many land on the first
 *  is read off how much each took. */
function punchesOf(m: SigMoment): Punch[] {
  const s = m.size, c0 = centre(m.from);
  if (!m.targets.length) return [];
  const chain = m.targets.length > 1 && m.killed[0];
  const p0 = m.power[0] ?? 1, p1 = m.power[1] ?? 1;
  const first = chain ? Math.max(1, Math.min(3, Math.round((4 * p0) / (p0 + p1)))) : 4;
  return [0, 1, 2, 3].map((i) => {
    const ti = chain && i >= first ? 1 : 0, r = m.targets[ti], p = centre(r);
    const dx = p.x - c0.x, dy = p.y - c0.y, d = Math.hypot(dx, dy) || 1, u = { x: dx / d, y: dy / d };
    // Left, right, left, right: each fist swings in from its own corner.
    const side = i % 2 ? 1 : -1;
    const from = { x: c0.x + u.x * s * 0.15 - u.y * side * s * 0.27, y: c0.y + u.y * s * 0.15 + u.x * side * s * 0.27 };
    const hit = { x: p.x - u.y * side * s * 0.1 + rand(-0.04, 0.04) * s, y: p.y + u.x * side * s * 0.1 + rand(-0.04, 0.04) * s };
    const fx = hit.x - from.x, fy = hit.y - from.y, fl = Math.hypot(fx, fy) || 1;
    const hot = Math.min(1, 0.35 + 0.2 * i + (ti ? 0.15 : 0));
    const k = Math.max(0.8, Math.min(1.6, m.power[ti] ?? 1)) * (i === 3 ? 1.25 : 1);
    const lastOnIt = i === 3 || (chain && i === first - 1);
    return { i, r, p, from, f: { x: fx / fl, y: fy / fl }, side, k, heat: hot, last: i === 3, kill: lastOnIt && !!m.killed[ti], hit };
  });
}

export const MAGMAW: Signature = {
  shake: 1.5,
  // It throws its fists, it does not step: the punches are drawn in from its
  // own corners.
  lunge: false,

  deliver(t: FxTools, m: SigMoment, seconds: number) {
    const s = m.size, S = seconds, ps = punchesOf(m);
    if (!ps.length) return;
    const c0 = centre(m.from), sc = s / 90;
    const p0 = ps[0], u = { x: p0.p.x - c0.x, y: p0.p.y - c0.y }, ul = Math.hypot(u.x, u.y) || 1;
    const ux = u.x / ul, uy = u.y / ul;
    // The two fists, held at the front corners, pulled back a little as they
    // heat — and the left one swinging for the first punch at the very end.
    const corner = (side: number, time: number): Pt => {
      const back = s * 0.06 * easeOut(clamp01(time / (S * 0.6)));
      return { x: c0.x + ux * (s * 0.15 - back) - uy * side * s * 0.27, y: c0.y + uy * (s * 0.15 - back) + ux * side * s * 0.27 };
    };
    const where = (side: number, time: number) => {
      const rest = corner(side, time);
      if (side > 0 || time < S - SWING) return { c: rest, f: { x: ux, y: uy } };
      const q = easeIn(clamp01((time - (S - SWING)) / SWING));
      return { c: { x: rest.x + (p0.hit.x - rest.x) * q, y: rest.y + (p0.hit.y - rest.y) * q }, f: p0.f };
    };
    const L = s * 0.4, W = s * 0.36, size = (time: number) => 0.5 + 0.5 * easeOut(clamp01(time / (S * 0.3)));
    t.draw(S, (g, v) => {
      const time = v * S, a = clamp01(v * 6);
      for (const side of [-1, 1]) {
        const w = where(side, time), z = size(time);
        fistDark(g, fistShape(w.c, w.f, L * z, W * z, -side), a);
      }
    }, { dark: true });
    let ember = 0;
    t.draw(S, (g, v, dt) => {
      const time = v * S, a = clamp01(v * 6), k = 0.9 * easeIn(v);
      for (const side of [-1, 1]) {
        const w = where(side, time), z = size(time), sh = fistShape(w.c, w.f, L * z, W * z, -side);
        fistLit(g, sh, k, a, s);
        // The swing's smear behind the left fist as it goes.
        if (side < 0 && time > S - SWING) speedLines(g, w.c, w.f, L, W, clamp01((time - (S - SWING)) / SWING), k);
      }
      ember += dt * 26 * t.quality * (0.3 + v);
      for (; ember >= 1; ember--) {
        const side = Math.random() < 0.5 ? -1 : 1, w = where(side, time), fr = { x: w.c.x + w.f.x * L * 0.45, y: w.c.y + w.f.y * L * 0.45 };
        t.spark(fr.x + rand(-0.1, 0.1) * s, fr.y + rand(-0.1, 0.1) * s, rand(-20, 20) * sc, -rand(30, 80) * sc, rand(0.3, 0.5), EMBER);
      }
    });
    // Heat gathering in the knuckles.
    for (const side of [-1, 1]) t.charge(corner(side, S), s * 0.6, MOLTEN, 0.35, S);
  },

  land(t: FxTools, m: SigMoment) {
    const s = m.size, ps = punchesOf(m);
    if (!ps.length) return;
    for (const p of ps) {
      const impact = p.i * GAP;
      // Every fist after the first swings in from its corner.
      if (p.i > 0) t.later(impact - SWING, () => swing(t, p, s));
      t.later(impact, () => punch(t, p, s));
    }
    // A chain: the rampage leaps from the fallen card to the next.
    const j = ps.findIndex((p, i) => i > 0 && p.r !== ps[i - 1].r);
    if (j > 0) t.later((j - 1) * GAP + 0.03, () => leap(t, centre(ps[j - 1].r), centre(ps[j].r), s));
  },
};

/** A fist swinging in from Magmaw's corner to where it lands, a smear of heat
 *  behind it. */
function swing(t: FxTools, p: Punch, s: number) {
  const L = s * 0.4 * Math.min(1.2, p.k), W = s * 0.36 * Math.min(1.2, p.k);
  const pos = (v: number) => {
    const q = easeIn(v);
    return { x: p.from.x + (p.hit.x - p.from.x) * q, y: p.from.y + (p.hit.y - p.from.y) * q };
  };
  t.draw(SWING, (g, v) => fistDark(g, fistShape(pos(v), p.f, L, W, -p.side), 1), { dark: true });
  t.draw(SWING, (g, v) => {
    const c = pos(v);
    speedLines(g, c, p.f, L, W, v, p.heat);
    fistLit(g, fistShape(c, p.f, L, W, -p.side), p.heat, 1, s);
  });
}

/** The rush behind a swinging fist: three streaks of heat trailing off its
 *  back, longer as it speeds up — a blow, not a thrown rock. */
function speedLines(g: Graphics, c: Pt, f: Pt, L: number, W: number, v: number, k: number) {
  const len = L * (0.5 + 1.3 * v);
  for (const o of [-0.3, 0, 0.3]) {
    const bx = c.x - f.x * L * 0.45 - f.y * o * W, by = c.y - f.y * L * 0.45 + f.x * o * W;
    const l = len * (o ? 0.75 : 1);
    g.moveTo(bx, by).lineTo(bx - f.x * l, by - f.y * l).stroke({ width: Math.max(1.5, W * 0.1), color: heat(k * 0.8), alpha: 0.55 * v, cap: "round" });
  }
}

/** A punch landing: the fist held a moment on the card and gone, a print of
 *  its four knuckles punched in with cracks of lava running out of it, rock
 *  chunks and a shower of sparks thrown off, and a shock ring — all as hot as
 *  this punch is. */
function punch(t: FxTools, p: Punch, s: number) {
  const sc = s / 90, k = p.k, col = heat(p.heat), c = p.hit, f = p.f, nx = -f.y, ny = f.x, seed = rand(0, TAU);
  const L = s * 0.4 * Math.min(1.2, k), W = s * 0.36 * Math.min(1.2, k);
  // The fist, held where it struck, then gone.
  const HOLD = 0.09;
  const fistAt = { x: c.x - f.x * L * 0.35, y: c.y - f.y * L * 0.35 };
  t.draw(HOLD, (g, v) => fistDark(g, fistShape(fistAt, f, L, W, -p.side), 1 - easeIn(v)), { dark: true });
  t.draw(HOLD, (g, v) => fistLit(g, fistShape(fistAt, f, L, W, -p.side), Math.min(1, p.heat + 0.1), 1 - easeIn(v), s));
  t.flash(c, col, (0.16 + 0.07 * p.i) * Math.min(1.3, k) * sc);
  t.glow(p.r, heat(p.heat * 0.7), 0.22 + 0.06 * p.i, 0.35, 1.0);
  t.ring(p.r, col, 0.2, 0.75 + 0.12 * p.i, 0.28, p.last ? 4 : 2.5);
  // THE PRINT: four knuckle dents across the line of the punch, with cracks
  // running out of them.
  const R = s * 0.32 * Math.min(1.3, k);
  const dents = [-1.5, -0.5, 0.5, 1.5].map((o) => {
    const q = { x: c.x + nx * o * W * 0.25, y: c.y + ny * o * W * 0.25 };
    return block(q, f, -W * 0.09, W * 0.09, -W * 0.1, W * 0.1, W * 0.04);
  });
  const cracks = Array.from({ length: 6 }, (_, i) => {
    let a = seed + (i / 6) * TAU, x = c.x + Math.cos(a) * s * 0.08, y = c.y + Math.sin(a) * s * 0.08;
    const pts = [x, y], n = 4, len = (R * rand(0.75, 1.1)) / n;
    for (let j = 0; j < n; j++) {
      a += rand(-0.5, 0.5);
      x += Math.cos(a) * len; y += Math.sin(a) * len;
      pts.push(x, y);
    }
    return pts;
  });
  const D = 0.5;
  const fade = (v: number) => 1 - clamp01((v * D - 0.12) / (D - 0.12));
  t.draw(D, (g, v) => {
    const a = fade(v);
    for (const d of dents) g.poly(d, true).fill({ color: ROCK, alpha: 0.85 * a });
  }, { dark: true });
  t.draw(D, (g, v) => {
    const a = fade(v), open = easeOut(clamp01((v * D) / 0.06)), cool = heat(p.heat * (1 - 0.5 * v));
    for (const d of dents) g.poly(d, true).stroke({ width: 1.3, color: cool, alpha: 0.9 * a });
    for (const cr of cracks) {
      const n = Math.max(1, Math.round((cr.length / 2 - 1) * open));
      g.moveTo(cr[0], cr[1]);
      for (let j = 1; j <= n; j++) g.lineTo(cr[j * 2], cr[j * 2 + 1]);
      g.stroke({ width: 4, color: LAVA, alpha: 0.25 * a, join: "round" });
      g.moveTo(cr[0], cr[1]);
      for (let j = 1; j <= n; j++) g.lineTo(cr[j * 2], cr[j * 2 + 1]);
      g.stroke({ width: 1.4, color: cool, alpha: 0.95 * a, join: "round" });
    }
  });
  // THE SHOWER: sparks thrown off the blow, mostly up and away to the sides.
  const n = Math.round((8 + 3 * p.i) * k * t.quality);
  for (let i = 0; i < n; i++) {
    const side = i % 2 ? 1 : -1, a = Math.atan2(ny * side, nx * side) + rand(-0.8, 0.8), v = rand(140, 300) * sc;
    t.spark(c.x, c.y, Math.cos(a) * v + f.x * 40 * sc, Math.sin(a) * v - rand(60, 140) * sc, rand(0.25, 0.45), SHOWER);
  }
  rubble(t, c, f, Math.round((3 + (p.last ? 3 : 1)) * t.quality + 1), s, p.heat);
  if (p.kill)
    t.later(0.05, () => {
      t.ring(p.r, HOT, 0.3, 1.2, 0.4, 3);
      t.flash(centre(p.r), GOLD, 0.3 * sc);
      for (let i = 0; i < Math.round(14 * t.quality); i++) {
        const a = rand(0, TAU), v = rand(160, 300) * sc;
        t.spark(centre(p.r).x, centre(p.r).y, Math.cos(a) * v, Math.sin(a) * v - 60 * sc, rand(0.3, 0.5), SHOWER);
      }
    });
}

/** Chunks of rock knocked off by a punch: dark, tumbling, falling, each with
 *  a hot edge. Closed form from their birth, so a burst is one Graphics. */
function rubble(t: FxTools, c: Pt, f: Pt, n: number, s: number, hot: number) {
  const sc = s / 90, D = 0.55;
  const bits = Array.from({ length: n }, () => {
    const a = Math.atan2(-f.y, -f.x) + rand(-1.6, 1.6), v = rand(110, 230) * sc;
    return { vx: Math.cos(a) * v, vy: Math.sin(a) * v - rand(80, 160) * sc, r: s * rand(0.035, 0.06), rot: rand(0, TAU), spin: rand(-12, 12),
      shape: Array.from({ length: 5 }, () => rand(0.65, 1)) };
  });
  const shape = (b: (typeof bits)[number], time: number) => {
    const x = c.x + b.vx * time, y = c.y + b.vy * time + 0.5 * 900 * sc * time * time, pts: number[] = [];
    for (let i = 0; i < 5; i++) {
      const a = b.rot + b.spin * time + (i / 5) * TAU;
      pts.push(x + Math.cos(a) * b.r * b.shape[i], y + Math.sin(a) * b.r * b.shape[i]);
    }
    return pts;
  };
  const fade = (v: number) => 1 - clamp01((v - 0.6) / 0.4);
  t.draw(D, (g, v) => { for (const b of bits) g.poly(shape(b, v * D), true).fill({ color: ROCK, alpha: 0.95 * fade(v) }); }, { dark: true });
  t.draw(D, (g, v) => { for (const b of bits) g.poly(shape(b, v * D), true).stroke({ width: 1.2, color: heat(hot * (1 - 0.6 * v)), alpha: 0.9 * fade(v) }); });
}

/** The rampage carrying on: a molten streak from the card that fell to the
 *  next one, fast and white-gold at its head. */
function leap(t: FxTools, a: Pt, b: Pt, s: number) {
  const D = 0.16, dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L, bow = L * 0.25;
  const pt = (q: number) => ({ x: a.x + dx * q + nx * bow * Math.sin(Math.PI * q), y: a.y + dy * q + ny * bow * Math.sin(Math.PI * q) });
  t.draw(D + 0.12, (g, v) => {
    const time = v * (D + 0.12), head = easeOut(clamp01(time / D)), tail = clamp01((time - 0.06) / D), al = 1 - clamp01((time - D) / 0.12);
    if (head <= tail) return;
    const pts: number[] = [];
    for (let i = 0; i <= 10; i++) {
      const q = pt(tail + ((head - tail) * i) / 10);
      pts.push(q.x, q.y);
    }
    g.poly(pts, false).stroke({ width: s * 0.12, color: LAVA, alpha: 0.3 * al, cap: "round", join: "round" });
    g.poly(pts, false).stroke({ width: s * 0.04, color: GOLD, alpha: 0.95 * al, cap: "round", join: "round" });
    const h = pt(head);
    g.circle(h.x, h.y, s * 0.05).fill({ color: HOT, alpha: al });
  });
}
