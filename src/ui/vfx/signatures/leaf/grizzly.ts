/** GRIZZLY — Maul. "Close up to 2 spaces and maul for 14. A kill heals it 8
 *  and it takes the ground." Grizzly hides in the thicket until it moves.
 *  Then it closes two spaces and mauls.
 *
 *  Its art is a great bear made of autumn leaves and bark, roaring as it
 *  charges out of a golden field, maple leaves and bees flying round it, all
 *  amber, rust and gold. The DELIVERY is the charge: it digs in — leaves
 *  kicked up round it, dust thrown back — and goes, a surge of autumn leaves
 *  massed round a bow-wave of amber light, tearing a furrow of churned earth
 *  behind it, paw prints pressed into it, clods and leaves thrown off and the
 *  storm trailing it, a few bees caught up in the rush. Its front meets the
 *  card it is mauling as the delivery ends; its token jumps to where the
 *  charge took it as the step lands, and that jump is the end of the run.
 *
 *  The LANDING is the maul: a ROAR — arcs of sound beating out from its jaws
 *  over the card — and four huge claw rakes torn across it, black gashes
 *  edged in amber with a green-gold glow, white-hot as they open; maple
 *  leaves and bark splinters burst off it. On a kill it takes the ground and
 *  a warm green heal swells round the bear where it stands.
 *
 *  It draws its own charge (no lunge). Leaves and earth are their own colour
 *  on the normal-blend layer, and the gashes and the furrow are dark for real,
 *  each lit along its edge so it reads over an empty square. */
import { centre, rand } from "../../looks/base";
import type { FxTools, Pt, SparkStyle } from "../../looks/types";
import type { Signature, SigMoment } from "../types";

type Box = SigMoment["from"];

const TAU = Math.PI * 2;
// Autumn, on the normal-blend layer: the leaves it is made of.
const LEAVES = [0xe2892a, 0xc4471c, 0xeeb43c, 0xb8301a, 0xd86a1e];
// Earth: the furrow, and its lit lips.
const SOIL = 0x24170b, PRINT = 0x140c05, CLOD_LIT = 0xc8a070;
// The gashes' dark.
const GASH = 0x0a0503;
// Light (additive): amber, gold, the green-gold of its glyphs, and life.
const AMBER = 0xffa53a, GOLD = 0xffd36a, PALE = 0xfff0c8, GLYPH = 0xd6f05a, LIME = 0xb6f27a, GREEN = 0x4caf6d, HEAL = 0xf4ffe6;
/** Grit and dust thrown off the furrow. */
const GRIT: SparkStyle = { palette: [0xf0dcb0, 0xc8a070, 0x7a6040], gravity: 900, drag: 0.55, size: [5, 2], streak: false };
/** Bark splintered off the mauled card: hot, falling. */
const SPLINTER: SparkStyle = { palette: [PALE, GOLD, AMBER, 0x8a4a1a], gravity: 700, drag: 0.45, size: [6, 2], streak: true };
/** Life healing it on a kill: green-gold, rising, curling. */
const RISE: SparkStyle = { palette: [HEAL, GLYPH, LIME, GREEN], gravity: -110, drag: 0.6, size: [7, 2], streak: false, swirl: 130 };
const RISE_L: SparkStyle = { ...RISE, swirl: -130 };

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeOut = (x: number) => 1 - (1 - x) * (1 - x);

/** Its run: from its square to where its front meets the card it mauls
 *  (`hit`, that card's near face), along `u`. The body's middle stops `back`
 *  short of it. Worked out the same for the delivery and the landing. */
function runOf(m: SigMoment) {
  const s = m.size, c0 = centre(m.from);
  const prey = m.targets.length ? centre(m.targets[0]) : { x: centre(m.to).x + m.ahead.x * s, y: centre(m.to).y + m.ahead.y * s };
  const dx = prey.x - c0.x, dy = prey.y - c0.y, d = Math.hypot(dx, dy) || 1, u = { x: dx / d, y: dy / d };
  const hit = { x: prey.x - u.x * s * 0.48, y: prey.y - u.y * s * 0.48 };
  const end = { x: hit.x - u.x * s * 0.32, y: hit.y - u.y * s * 0.32 };
  return { c0, prey, u, hit, end, len: Math.max(0, (end.x - c0.x) * u.x + (end.y - c0.y) * u.y) };
}

// ── Leaves ───────────────────────────────────────────────────────────────────

/** A leaf round (x, y), `len` across, turned to `ang`; `open` is how face-on
 *  it is. A MAPLE — five lobes, as on its art — or a plain oval leaf. A fresh
 *  point list each time: Pixi keeps the points it is handed until it draws. */
function leaf(x: number, y: number, len: number, ang: number, open: number, maple: boolean): number[] {
  const c = Math.cos(ang), s = Math.sin(ang), o = Math.max(0.15, open), pts: number[] = [];
  if (maple) {
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * TAU, r = len * 0.5 * (i % 2 ? 0.42 : 1) * (i === 5 ? 0.6 : 1);
      const lx = Math.cos(a) * r, ly = Math.sin(a) * r * o;
      pts.push(x + c * lx - s * ly, y + s * lx + c * ly);
    }
    return pts;
  }
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * TAU, lx = Math.cos(a) * len * 0.5, ly = Math.sin(a) * len * 0.24 * o * (1 - 0.35 * Math.cos(a));
    pts.push(x + c * lx - s * ly, y + s * lx + c * ly);
  }
  return pts;
}

/** A leaf let loose: flung, its fling bleeding off, then rocking down and
 *  turning over — closed form from its birth, so a flurry is one Graphics. */
interface Fly { x: number; y: number; vx: number; vy: number; at: number; life: number; len: number; fall: number; spin: number; ph: number; rot: number; tone: number; maple: boolean }

function fly(x: number, y: number, vx: number, vy: number, at: number, life: number, len: number, s: number): Fly {
  return { x, y, vx, vy, at, life, len, fall: rand(25, 50) * (s / 90), spin: rand(6, 12) * (Math.random() < 0.5 ? -1 : 1), ph: rand(0, TAU),
    rot: rand(0, TAU), tone: LEAVES[Math.floor(rand(0, LEAVES.length))], maple: Math.random() < 0.55 };
}

function flyAt(p: Fly, a: number) {
  const u = a / p.life, d = 0.2 * (1 - Math.exp(-a / 0.2)), w = a * 7 + p.ph, turn = Math.cos(p.spin * a + p.ph);
  return { x: p.x + p.vx * d + p.len * 0.3 * (Math.sin(w) - Math.sin(p.ph)), y: p.y + p.vy * d + p.fall * a,
    ang: p.rot + p.spin * a * 0.35, open: 0.2 + 0.8 * Math.abs(turn), alpha: Math.min(1, u * 10) * (1 - u * u) };
}

/** A flurry of autumn leaves: their colour on the normal-blend layer, a
 *  catch of gold light on each. */
function flurry(t: FxTools, ps: Fly[], delay = 0) {
  let end = 0;
  for (const p of ps) end = Math.max(end, p.at + p.life);
  if (end <= 0) return;
  const each = (now: number, fn: (q: ReturnType<typeof flyAt>, p: Fly) => void) => {
    for (const p of ps) {
      const a = now - p.at;
      if (a >= 0 && a < p.life) fn(flyAt(p, a), p);
    }
  };
  t.draw(end, (g, k) => each(k * end, (q, p) => { g.poly(leaf(q.x, q.y, p.len, q.ang, q.open, p.maple), true).fill({ color: p.tone, alpha: 0.95 * q.alpha }); }), { dark: true, delay });
  t.draw(end, (g, k) => each(k * end, (q, p) => { g.poly(leaf(q.x, q.y, p.len, q.ang, q.open, p.maple), true).stroke({ width: 1, color: GOLD, alpha: 0.55 * q.alpha }); }), { delay });
}

// ── The claws ────────────────────────────────────────────────────────────────

/** A claw's tear from `a` to `b`, swept on a curve as a paw swings, its lips
 *  ragged — fixed once, so the tear holds its shape as it opens. */
function rake(a: Pt, b: Pt, bow: number, jag: number) {
  const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L, pts: number[] = [], rough: number[] = [];
  for (let i = 0; i <= 10; i++) {
    const f = i / 10, off = bow * Math.sin(Math.PI * f) + (i > 0 && i < 10 ? rand(-jag, jag) : 0);
    pts.push(a.x + dx * f + nx * off, a.y + dy * f + ny * off);
    rough.push(rand(0.8, 1.15), rand(0.8, 1.15));
  }
  return { pts, rough };
}

/** The tear's first `f` opened to `w` across: ragged lips, pointed at both
 *  ends, widest a little past its middle as a claw digs in. */
function gash(r: { pts: number[]; rough: number[] }, f: number, w: number): number[] {
  const n = r.pts.length / 2 - 1, m = Math.max(1, Math.ceil(n * f)), left: number[] = [], right: number[] = [];
  for (let i = 0; i <= m; i++) {
    const j = Math.min(i, n), q = Math.min(1, j / (n * Math.max(f, 1e-3)));
    const x = r.pts[j * 2], y = r.pts[j * 2 + 1];
    const tx = r.pts[Math.min(n, j + 1) * 2] - r.pts[Math.max(0, j - 1) * 2], ty = r.pts[Math.min(n, j + 1) * 2 + 1] - r.pts[Math.max(0, j - 1) * 2 + 1];
    const l = Math.hypot(tx, ty) || 1, hw = (w / 2) * Math.pow(Math.sin(Math.PI * Math.pow(q, 0.8)), 0.6);
    left.push(x - (ty / l) * hw * r.rough[j * 2], y + (tx / l) * hw * r.rough[j * 2]);
    right.unshift(x + (ty / l) * hw * r.rough[j * 2 + 1], y - (tx / l) * hw * r.rough[j * 2 + 1]);
  }
  return left.concat(right);
}

export const GRIZZLY: Signature = {
  shake: 1.6,
  // It draws its own charge: the token jumps to where the run ends as the
  // step lands.
  lunge: false,

  deliver(t: FxTools, m: SigMoment, seconds: number) {
    const s = m.size, S = seconds, run = runOf(m), { c0, u } = run, nx = -u.y, ny = u.x, sc = s / 90;
    const WIND = S * 0.3, RUN = S - WIND;
    /** How far along its run its body's middle is at `time`: still, then
     *  gathering speed into the hit. */
    const at = (time: number) => run.len * Math.pow(clamp01((time - WIND) / RUN), 1.7);
    const P = (d: number, side = 0): Pt => ({ x: c0.x + u.x * d + nx * side, y: c0.y + u.y * d + ny * side });
    // IT DIGS IN: leaves kicked up round it, dust thrown back off its heels,
    // the amber of its glyphs lighting.
    const kick: Fly[] = [];
    for (let i = 0; i < Math.round(7 * t.quality); i++) {
      const a = Math.atan2(-u.y, -u.x) + rand(-1.3, 1.3), v = rand(80, 170) * sc;
      kick.push(fly(c0.x + rand(-0.3, 0.3) * s, c0.y + rand(-0.2, 0.3) * s, Math.cos(a) * v, Math.sin(a) * v - 60 * sc, rand(0, WIND * 0.8), rand(0.45, 0.6), s * rand(0.13, 0.18), s));
    }
    flurry(t, kick);
    for (let i = 0; i < Math.round(10 * t.quality); i++) {
      const a = Math.atan2(-u.y, -u.x) + rand(-0.7, 0.7), v = rand(60, 150) * sc;
      t.later(rand(0, WIND), () => t.spark(c0.x - u.x * s * 0.3, c0.y - u.y * s * 0.3, Math.cos(a) * v, Math.sin(a) * v - 50 * sc, rand(0.3, 0.45), GRIT));
    }
    t.charge(c0, s * 1.2, AMBER, 0.35, WIND + RUN * 0.3);
    // THE FURROW: churned earth torn up behind it as it runs — clods turned
    // up along both lips — and its paw prints pressed in, pad and toes and
    // the scratch of each claw: dark, lit along their edges.
    const nClod = Math.max(4, Math.round((run.len / s) * 7));
    const clods = Array.from({ length: nClod }, (_, i) => ({
      d: s * 0.2 + ((i + rand(0, 1)) / nClod) * Math.max(0, run.len - s * 0.1), side: (i % 2 ? 1 : -1) * s * rand(0.12, 0.2),
      r: s * rand(0.03, 0.05), shape: Array.from({ length: 6 }, () => rand(0.7, 1)), rot: rand(0, TAU) }));
    const prints = Array.from({ length: Math.max(1, Math.floor(run.len / (s * 0.45))) }, (_, i) => ({ d: (i + 0.55) * s * 0.45, side: (i % 2 ? 1 : -1) * s * 0.07 }));
    const FADE = 0.3, D = S + FADE, heading = Math.atan2(u.y, u.x);
    const gone = (time: number) => 1 - clamp01((time - S) / FADE);
    const lump = (cl: (typeof clods)[number]) => {
      const q = P(cl.d, cl.side), pts: number[] = [];
      for (let i = 0; i < 6; i++) {
        const a = cl.rot + (i / 6) * TAU;
        pts.push(q.x + Math.cos(a) * cl.r * cl.shape[i], q.y + Math.sin(a) * cl.r * cl.shape[i]);
      }
      return pts;
    };
    const paw = (p: (typeof prints)[number]) => {
      const q = P(p.d, p.side);
      const toes = [-1.5, -0.5, 0.5, 1.5].map((k) => ({ x: q.x + Math.cos(heading + k * 0.42) * s * 0.1, y: q.y + Math.sin(heading + k * 0.42) * s * 0.1 }));
      return { q, toes };
    };
    t.draw(D, (g, v) => {
      const time = v * D, h = at(Math.min(time, S)), a = gone(time);
      if (h > s * 0.05) {
        const a0 = P(s * 0.15), a1 = P(h);
        g.moveTo(a0.x, a0.y).lineTo(a1.x, a1.y).stroke({ width: s * 0.3, color: SOIL, alpha: 0.6 * a, cap: "round" });
      }
      for (const cl of clods) if (cl.d <= h) g.poly(lump(cl), true).fill({ color: 0x3a2a18, alpha: a });
      for (const p of prints) {
        if (p.d > h) continue;
        const { q, toes } = paw(p);
        g.ellipse(q.x, q.y, s * 0.06, s * 0.06).fill({ color: PRINT, alpha: 0.9 * a });
        for (const o of toes) g.circle(o.x, o.y, s * 0.022).fill({ color: PRINT, alpha: 0.9 * a });
      }
    }, { dark: true });
    t.draw(D, (g, v) => {
      const time = v * D, h = at(Math.min(time, S)), a = gone(time);
      for (const cl of clods) if (cl.d <= h) g.poly(lump(cl), true).stroke({ width: 1.2, color: CLOD_LIT, alpha: 0.8 * a });
      for (const p of prints) {
        if (p.d > h) continue;
        const { q, toes } = paw(p);
        g.circle(q.x, q.y, s * 0.06).stroke({ width: 1.2, color: AMBER, alpha: 0.75 * a });
        for (const o of toes) {
          g.circle(o.x, o.y, s * 0.022).stroke({ width: 1, color: AMBER, alpha: 0.75 * a });
          g.moveTo(o.x + u.x * s * 0.03, o.y + u.y * s * 0.03).lineTo(o.x + u.x * s * 0.075, o.y + u.y * s * 0.075).stroke({ width: 1, color: GOLD, alpha: 0.7 * a });
        }
      }
    });
    // THE CHARGE: a mass of autumn leaves whirling round a bow-wave of amber
    // light, shedding leaves and throwing earth, a few bees in the rush.
    const n = Math.max(8, Math.round(16 * t.quality));
    const mass = Array.from({ length: n }, (_, i) => ({ ph: rand(0, TAU), r: rand(0.18, 0.42), sp: rand(7, 12) * (i % 2 ? 1 : -1), len: s * rand(0.14, 0.2),
      tone: LEAVES[i % LEAVES.length], maple: i % 2 === 0, back: rand(-0.35, 0.15) }));
    const leafAt = (time: number, lf: (typeof mass)[number]) => {
      const h = at(time), k = clamp01((time - WIND * 0.6) / (WIND * 0.6)), th = lf.ph + lf.sp * time;
      const along = h + s * (lf.back + 0.18 * Math.cos(th)), side = s * lf.r * Math.sin(th);
      const p = P(along, side);
      return { x: p.x, y: p.y, ang: th * 1.3, open: 0.3 + 0.7 * Math.abs(Math.cos(th * 1.7)), a: k * (time > S - 0.02 ? 0 : 1) };
    };
    t.draw(S, (g, v) => {
      const time = v * S;
      for (const lf of mass) {
        const q = leafAt(time, lf);
        if (q.a > 0.02) g.poly(leaf(q.x, q.y, lf.len, q.ang, q.open, lf.maple), true).fill({ color: lf.tone, alpha: 0.95 * q.a });
      }
    }, { dark: true });
    let grit = 0;
    t.draw(S, (g, v, dt) => {
      const time = v * S, h = at(time), k = clamp01((time - WIND * 0.6) / (WIND * 0.6));
      for (const lf of mass) {
        const q = leafAt(time, lf);
        if (q.a > 0.02) g.poly(leaf(q.x, q.y, lf.len, q.ang, q.open, lf.maple), true).stroke({ width: 1, color: GOLD, alpha: 0.5 * q.a });
      }
      // The bow-wave: amber light pressed ahead of it, brighter as it runs.
      const pace = clamp01((time - WIND) / RUN), front = P(h + s * 0.3), ang = Math.atan2(u.y, u.x), R = s * 0.42;
      if (k > 0) {
        const a = k * (0.35 + 0.65 * pace);
        g.moveTo(front.x - u.x * R + Math.cos(ang - 1.1) * R, front.y - u.y * R + Math.sin(ang - 1.1) * R)
          .arc(front.x - u.x * R, front.y - u.y * R, R, ang - 1.1, ang + 1.1).stroke({ width: 6, color: AMBER, alpha: 0.3 * a });
        g.moveTo(front.x - u.x * R + Math.cos(ang - 0.9) * R, front.y - u.y * R + Math.sin(ang - 0.9) * R)
          .arc(front.x - u.x * R, front.y - u.y * R, R, ang - 0.9, ang + 0.9).stroke({ width: 2, color: GOLD, alpha: 0.9 * a });
        const body = P(h);
        g.circle(body.x, body.y, s * 0.36).fill({ color: AMBER, alpha: 0.1 * a });
      }
      // Bees caught up in it: gold, striped, zigzagging round its flank.
      for (let b = 0; b < 3; b++) {
        const th = time * (14 + b * 3) + b * 2.1, bp = P(h - s * (0.35 + 0.15 * b), s * 0.45 * Math.sin(th) * (b % 2 ? 1 : -1));
        const bx = bp.x + Math.sin(time * 41 + b) * s * 0.03, by = bp.y + Math.cos(time * 37 + b) * s * 0.03, bs = s * 0.035;
        if (k <= 0) continue;
        g.ellipse(bx, by, bs * 1.3, bs * 0.85).fill({ color: GOLD, alpha: k });
        g.moveTo(bx, by - bs * 0.85).lineTo(bx, by + bs * 0.85).stroke({ width: Math.max(1, bs * 0.45), color: 0x1a1006, alpha: k });
        const flap = Math.abs(Math.sin(time * 90 + b));
        g.ellipse(bx - bs * 0.2, by - bs * (0.9 + 0.4 * flap), bs * 0.7, bs * 0.5 * flap + 0.5).fill({ color: PALE, alpha: 0.6 * k });
      }
      if (pace > 0 && pace < 1) {
        grit += dt * 50 * t.quality;
        for (; grit >= 1; grit--) {
          const sd = Math.random() < 0.5 ? -1 : 1, p = P(h - s * 0.1, sd * s * 0.25), v2 = rand(60, 140) * sc;
          t.spark(p.x, p.y, (nx * sd * 0.8 - u.x * 0.4) * v2, (ny * sd * 0.8 - u.y * 0.4) * v2 - 60 * sc, rand(0.3, 0.45), GRIT);
        }
      }
    });
    // The storm trailing it: leaves shed off the run, fluttering down behind.
    const shed: Fly[] = [];
    for (let i = 0; i < Math.round(8 * t.quality); i++) {
      const q = (i + 0.5) / 8, time = WIND + RUN * Math.pow(q, 0.6), p = P(at(time) - s * 0.2, rand(-0.3, 0.3) * s);
      shed.push(fly(p.x, p.y, -u.x * rand(20, 60) * sc + rand(-40, 40) * sc, -u.y * rand(20, 60) * sc - 40 * sc, time, rand(0.5, 0.7), s * rand(0.13, 0.18), s));
    }
    flurry(t, shed);
  },

  land(t: FxTools, m: SigMoment) {
    const s = m.size, run = runOf(m), { u } = run, sc = s / 90;
    if (!m.targets.length) return;
    const r = m.targets[0], p = centre(r), k = Math.max(0.8, Math.min(1.8, m.power[0] ?? 1));
    // THE ROAR: arcs of sound beating out from its jaws over the card.
    const jaws = { x: run.hit.x - u.x * s * 0.12, y: run.hit.y - u.y * s * 0.12 }, ang = Math.atan2(u.y, u.x);
    for (let i = 0; i < 3; i++) {
      const D = 0.38;
      t.draw(D, (g, v) => {
        const R = s * (0.25 + 1.15 * easeOut(v)), a = (1 - v) * (1 - v), spread = 0.75 + 0.25 * v;
        g.moveTo(jaws.x + Math.cos(ang - spread) * R, jaws.y + Math.sin(ang - spread) * R).arc(jaws.x, jaws.y, R, ang - spread, ang + spread)
          .stroke({ width: 7 - 3 * v, color: AMBER, alpha: 0.3 * a });
        g.moveTo(jaws.x + Math.cos(ang - spread) * R, jaws.y + Math.sin(ang - spread) * R).arc(jaws.x, jaws.y, R, ang - spread, ang + spread)
          .stroke({ width: 2, color: GOLD, alpha: 0.85 * a });
      }, { delay: i * 0.07 });
    }
    t.flash(jaws, AMBER, 0.12 * (s / 80));
    // THE MAUL: four huge claws torn across it in one swipe, slanted across
    // the line of the charge.
    const across = ang + Math.PI / 2 + 0.5, ux = Math.cos(across), uy = Math.sin(across), cx = -uy, cy = ux;
    const reach = s * 0.55 * Math.min(1.2, 0.85 + 0.15 * k), gap = s * 0.17, bow = reach * 0.18;
    const claws = [-1.5, -0.5, 0.5, 1.5].map((o) => {
      const len = reach * (Math.abs(o) > 1 ? 0.82 : 1), off = o * gap;
      return rake({ x: p.x - ux * len + cx * off, y: p.y - uy * len + cy * off }, { x: p.x + ux * len + cx * off, y: p.y + uy * len + cy * off }, bow, s * 0.012);
    });
    const W = s * 0.1 * Math.min(1.25, k), DRAW = 0.07, LAG = 0.022, D = 0.75, AT = 0.05;
    const drawn = (time: number, i: number) => clamp01((time - AT - i * LAG) / DRAW);
    const fade = (time: number) => (time < 0.4 ? 1 : Math.max(0, 1 - (time - 0.4) / (D - 0.4)));
    t.draw(D, (g, v) => {
      const time = v * D, a = fade(time);
      claws.forEach((c, i) => {
        const f = drawn(time, i);
        if (f > 0.02) g.poly(gash(c, f, W), true).fill({ color: GASH, alpha: 0.92 * a });
      });
    }, { dark: true });
    t.draw(D, (g, v) => {
      const time = v * D, a = fade(time);
      claws.forEach((c, i) => {
        const f = drawn(time, i);
        if (f <= 0.02) return;
        g.poly(gash(c, f, W * 1.35), true).stroke({ width: 4, color: GLYPH, alpha: 0.16 * a });
        g.poly(gash(c, f, W * 1.1), true).stroke({ width: 1.4, color: AMBER, alpha: 0.95 * a });
        const hot = 1 - clamp01((time - AT - i * LAG - DRAW) / 0.08);
        if (hot > 0) g.poly(gash(c, f, W * 0.25), true).fill({ color: PALE, alpha: 0.85 * hot });
      });
    });
    t.later(AT, () => {
      t.flash(p, GOLD, 0.12 * k * (s / 80));
      t.glow(r, AMBER, 0.25, 0.4, 1.0);
      // Bark splintering off it, thrown on with the swipe.
      for (let i = 0; i < Math.round(12 * k); i++) {
        const a = across + rand(-0.6, 0.6), v = rand(150, 300) * sc;
        t.spark(p.x + rand(-6, 6), p.y + rand(-6, 6), Math.cos(a) * v, Math.sin(a) * v - 50 * sc, rand(0.3, 0.5), SPLINTER);
      }
      // Leaves blown off it, away from the bear.
      const ps: Fly[] = [];
      for (let i = 0; i < Math.round(8 + 3 * k); i++) {
        const a = ang + rand(-1.3, 1.3), v = rand(110, 260) * sc;
        ps.push(fly(p.x + rand(-5, 5), p.y + rand(-5, 5), Math.cos(a) * v, Math.sin(a) * v - 40 * sc, rand(0, 0.05), rand(0.6, 0.85), s * rand(0.14, 0.2), s));
      }
      flurry(t, ps);
    });
    if (m.killed[0]) t.later(0.24, () => heal(t, m.to, s));
  },
};

/** A kill feeds it: it takes the ground, and a warm green heal swells round
 *  the bear where it stands — the 8 HP — its glyph-light rising off it. */
function heal(t: FxTools, r: Box, s: number) {
  const c = centre(r);
  t.glow(r, 0xc8f080, 0.5, 0.65, 1.2);
  t.ring(r, GLYPH, 0.4, 1.15, 0.45, 3);
  t.draw(0.6, (g, v) => {
    const R = s * (0.3 + 0.32 * easeOut(v)), a = Math.sin(Math.PI * v);
    g.circle(c.x, c.y, R).stroke({ width: 5, color: GREEN, alpha: 0.35 * a });
    g.circle(c.x, c.y, R).stroke({ width: 1.5, color: LIME, alpha: 0.85 * a });
  });
  for (let i = 0; i < Math.round(16 * t.quality); i++)
    t.spark(c.x + rand(-0.35, 0.35) * s, c.y + rand(0, 0.38) * s, rand(-15, 15) * (s / 90), -rand(60, 120) * (s / 90), rand(0.5, 0.8), i % 2 ? RISE : RISE_L);
}
