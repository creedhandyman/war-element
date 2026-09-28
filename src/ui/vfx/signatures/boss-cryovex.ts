/** CRYOVEX — Absolute Zero. "12 DMG and FREEZE for 2 rounds to every opponent
 *  within 3 spaces." It does not hunt. It waits, and the cold does the
 *  walking.
 *
 *  Cryovex on its art is a dragon of dark crystal veined with electric blue,
 *  crouched on ground that has frozen into glowing fractal cracks, spires of
 *  crystal bursting up out of it. The DELIVERY is the cold settling: frost
 *  branching out over the ground under it, spires of crystal rising round its
 *  square, a violet breath curling off it. The LANDING is that same frost
 *  WALKING — not a wave that crashes but a front that creeps, out and out to
 *  three spaces: branches of crystal feeling their way over the ground,
 *  feathering at their tips, the ground behind them gone dark and cold. It
 *  takes its time. Where it reaches a card the card FREEZES SOLID — a spray of
 *  crystal spires bursts up round it, a lattice of ice closes over it, and
 *  splinters fly.
 *
 *  Of the three ice bosses this is the one of the GROUND: Permafrost's cold is
 *  white weather and Hoarfell's the colour of the sky, but Cryovex's is dark
 *  crystal creeping under everything, lit only along its own veins. */
import { centre, rand } from "../looks/base";
import type { Graphics } from "pixi.js";
import type { FxTools, Pt, SparkStyle } from "../looks/types";
import type { Signature, SigMoment } from "./types";

type Box = { x: number; y: number; w: number; h: number };

const TAU = Math.PI * 2;
/** The crystal's veins, the glow under them, their bright tips. */
const VEIN = 0x8ecbff, GLOW = 0x5a5aff, TIP = 0xdff2ff, WHITE = 0xffffff;
/** Its breath, as on its art: violet. */
const BREATH = 0x9a7bff;
/** The ground gone cold — the dark layer only. */
const COLD = 0x05081a;
/** Frost glittering on the front as it creeps. */
const GLINT: SparkStyle = { palette: [WHITE, TIP, VEIN], gravity: 0, drag: 0.4, size: [4, 1.5], streak: false };
/** Crystal splinters off a card as it freezes. */
const SHARD: SparkStyle = { palette: [WHITE, TIP, VEIN, GLOW], gravity: 460, drag: 0.6, size: [7, 2], streak: true };
/** Its breath curling off it. */
const MIST: SparkStyle = { palette: [0xe6dcff, 0xc0b0ff, BREATH], gravity: -30, drag: 0.45, size: [7, 16], streak: false, swirl: 110 };

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeOut = (x: number) => 1 - (1 - x) * (1 - x);
/** 0 -> 1 as `x` runs from `a` to `b`. */
const span = (x: number, a: number, b: number) => clamp01((x - a) / (b - a));

/** A glow sized to the board's squares (`flash` is sized in px). */
function flare(t: FxTools, p: Pt, size: number, color: number, peak: number, seconds: number) {
  t.glow({ x: p.x - size / 2, y: p.y - size / 2, w: size, h: size }, color, peak, seconds, 1);
}

// ── Frost, growing ───────────────────────────────────────────────────────────

/** One branch of the frost: a crystal line out from the middle, wandering a
 *  little, laid out once to its full length — sampled every `step` px — with
 *  side-branches set off it at sixty degrees, alternate sides, as frost grows
 *  on a window. */
interface Branch { pts: number[]; step: number; reach: number; sides: { at: number; a: number; len: number }[] }

function branches(c: Pt, n: number, r0: number, R: number, s: number, board: Box): Branch[] {
  const out: Branch[] = [], step = s * 0.07, m = s * 0.1;
  for (let j = 0; j < n; j++) {
    const a0 = (j / n) * TAU + rand(-0.12, 0.12), reach = rand(0.86, 1.08), pts: number[] = [];
    let a = a0, x = c.x + Math.cos(a0) * r0 * 0.4, y = c.y + Math.sin(a0) * r0 * 0.4;
    pts.push(x, y);
    for (let d = r0 * 0.4; d < R * 1.1; d += step) {
      a += rand(-0.07, 0.07) + (a0 - a) * 0.2;
      x += Math.cos(a) * step;
      y += Math.sin(a) * step;
      // Frost grows over the board, not off it.
      if (x < board.x - m || x > board.x + board.w + m || y < board.y - m || y > board.y + board.h + m) break;
      pts.push(x, y);
    }
    const sides: Branch["sides"] = [];
    for (let at = s * 0.35, k = 0; at < R * 1.1; at += s * rand(0.16, 0.24), k++)
      sides.push({ at, a: (k % 2 ? 1 : -1) * (Math.PI / 3) * rand(0.85, 1.1), len: s * rand(0.16, 0.28) });
    out.push({ pts, step, reach, sides });
  }
  return out;
}

/** Traces the frost out to radius-length `r` (each branch to its own share of
 *  it, so the front is ragged): the branches, their side-branches — short at
 *  the growing tips, full-grown behind — and a twig off each. Only what lies
 *  past `from` of each branch's length, so the fresh growth at the front can be
 *  drawn over the rest, brighter. The tips are returned, for the glitter. */
function frost(g: Graphics, bs: Branch[], r: number, tips: Pt[], from = 0) {
  tips.length = 0;
  for (const b of bs) {
    const len = r * b.reach, n = Math.min(b.pts.length / 2 - 1, Math.floor(len / b.step));
    if (n < 1) continue;
    const i0 = Math.min(n - 1, Math.max(0, Math.floor((from * b.reach) / b.step)));
    g.moveTo(b.pts[i0 * 2], b.pts[i0 * 2 + 1]);
    for (let i = i0 + 1; i <= n; i++) g.lineTo(b.pts[i * 2], b.pts[i * 2 + 1]);
    // A branch stopped at the board's edge has no living tip to glitter.
    if (n * b.step >= len - b.step * 1.5) tips.push({ x: b.pts[n * 2], y: b.pts[n * 2 + 1] });
    for (const sd of b.sides) {
      const i = Math.floor(sd.at / b.step);
      if (i < i0) continue;
      if (i >= n) break;
      const x = b.pts[i * 2], y = b.pts[i * 2 + 1], dir = Math.atan2(b.pts[i * 2 + 3] - y, b.pts[i * 2 + 2] - x) + sd.a;
      const l = Math.min(sd.len, (len - sd.at) * 0.55);
      if (l < 2) continue;
      const ex = x + Math.cos(dir) * l, ey = y + Math.sin(dir) * l;
      g.moveTo(x, y).lineTo(ex, ey);
      const mx = x + Math.cos(dir) * l * 0.55, my = y + Math.sin(dir) * l * 0.55, ta = dir + (sd.a > 0 ? -1 : 1) * (Math.PI / 3);
      g.moveTo(mx, my).lineTo(mx + Math.cos(ta) * l * 0.4, my + Math.sin(ta) * l * 0.4);
    }
  }
}

/** The ground the frost has taken: a disc of radius `r` round `c`, held to the
 *  board — flat points, each held inside the board's edge. */
function ground(c: Pt, r: number, b: Box): number[] {
  const out: number[] = [];
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * TAU;
    out.push(Math.max(b.x, Math.min(b.x + b.w, c.x + Math.cos(a) * r)), Math.max(b.y, Math.min(b.y + b.h, c.y + Math.sin(a) * r)));
  }
  return out;
}

/** A spire of crystal standing on `base`: a tall faceted blade leaning
 *  `lean`, glassy, bright at its edges, a white facet up its middle. */
function spire(g: Graphics, x: number, base: number, w: number, h: number, lean: number, a: number) {
  if (h < 1 || a <= 0.01) return;
  const tx = x + lean * h, ty = base - h;
  g.poly([x - w, base, tx, ty, x + w, base], true).fill({ color: GLOW, alpha: 0.22 * a }).stroke({ width: 1.6, color: VEIN, alpha: 0.95 * a });
  g.moveTo(x + w * 0.2, base).lineTo(tx, ty).stroke({ width: 1, color: WHITE, alpha: 0.8 * a });
}

/** FROZEN SOLID: spires of crystal bursting up round a card, a lattice of ice
 *  closing over it, a flash and splinters. */
function freeze(t: FxTools, r: Box, delay: number, hold: number, k: number) {
  const c = centre(r), s = Math.min(r.w, r.h), v = s / 90, base = c.y + s * 0.42;
  const spires = [-0.36, -0.2, -0.04, 0.12, 0.28, 0.4].map((f, i) => ({
    x: c.x + f * s, h: s * (i % 2 ? rand(0.42, 0.6) : rand(0.62, 0.86)) * k, w: s * rand(0.07, 0.1), lean: -f * 0.5 + rand(-0.08, 0.08), d: rand(0, 0.06),
  }));
  t.draw(hold, (g, u) => {
    const time = u * hold, a = 1 - span(time, hold - 0.3, hold);
    for (const sp of spires) spire(g, sp.x, base, sp.w, sp.h * easeOut(span(time, sp.d, sp.d + 0.12)), sp.lean, a * 0.9);
    // The lattice: a hexagon of ice over the card, facets meeting in it.
    const L = easeOut(span(time, 0.04, 0.2)), R = s * 0.5, hex: number[] = [];
    for (let i = 0; i < 6; i++) hex.push(c.x + Math.cos(Math.PI / 6 + (i * TAU) / 6) * R, c.y + Math.sin(Math.PI / 6 + (i * TAU) / 6) * R);
    if (L > 0) {
      g.poly(hex, true).fill({ color: TIP, alpha: 0.08 * L * a }).stroke({ width: 1.6, color: VEIN, alpha: 0.85 * L * a });
      for (let i = 0; i < 6; i += 2) g.moveTo(c.x, c.y).lineTo(c.x + (hex[i * 2] - c.x) * L, c.y + (hex[i * 2 + 1] - c.y) * L);
      g.stroke({ width: 1.1, color: TIP, alpha: 0.6 * a });
    }
  }, { delay });
  t.later(delay, () => {
    flare(t, c, s * 1.3, TIP, 0.55, 0.25);
    for (let i = 0; i < 14; i++) {
      const a = rand(-Math.PI, 0), sp = rand(120, 260) * v;
      t.spark(c.x + rand(-0.35, 0.35) * s, base - rand(0, 0.3) * s, Math.cos(a) * sp, Math.sin(a) * sp, rand(0.35, 0.6), SHARD);
    }
  });
}

export const CRYOVEX: Signature = {
  shake: 1.5,
  // It does not hunt: it waits, and the cold does the walking.
  lunge: false,

  deliver(t: FxTools, m: SigMoment, seconds: number) {
    const s = m.size, c = centre(m.from), T = seconds, v = s / 90;
    // The frost starting under it — the same frost the landing walks out.
    const bs = branches(c, 16, s * 0.7, s * 0.8, s, m.board), tips: Pt[] = [];
    t.draw(T, (g, u) => {
      g.poly(ground(c, s * 0.7 * easeOut(u), m.board), true).fill({ color: COLD, alpha: 0.3 * easeOut(u) });
    }, { dark: true });
    t.draw(T, (g, u) => {
      const r = s * 0.7 * easeOut(u);
      frost(g, bs, r, tips);
      g.stroke({ width: 4, color: GLOW, alpha: 0.25, cap: "round" });
      frost(g, bs, r, tips);
      g.stroke({ width: 1.2, color: VEIN, alpha: 0.9, cap: "round" });
    });
    // Spires of crystal rising round its square.
    const spires = [-0.5, -0.25, 0.3, 0.52].map((f, i) => ({ x: c.x + f * s, h: s * (i % 3 ? 0.4 : 0.58), lean: -f * 0.4 }));
    t.draw(T, (g, u) => {
      for (const sp of spires) spire(g, sp.x, c.y + s * 0.46, s * 0.07, sp.h * easeOut(span(u, 0.2, 0.9)), sp.lean, 0.9);
    });
    // Its breath curling off it, and the cold drawing in.
    let acc = 0;
    t.draw(T, (_g, _u, dt) => {
      acc += 30 * dt;
      for (; acc >= 1; acc--) {
        const a = rand(0, TAU), r = s * rand(0.1, 0.4);
        t.spark(c.x + Math.cos(a) * r, c.y + Math.sin(a) * r, rand(-15, 15) * v, -rand(15, 45) * v, rand(0.5, 0.8), MIST);
      }
    });
    t.charge(c, s * 1.4, VEIN, 0.45, T);
  },

  land(t: FxTools, m: SigMoment) {
    const s = m.size, c = centre(m.from), v = s / 90;
    const hits = m.targets.map((r, i) => {
      const p = centre(r);
      return { r, p, d: Math.hypot(p.x - c.x, p.y - c.y), power: Math.max(0.8, Math.min(1.4, m.power[i] ?? 1)), killed: !!m.killed[i] };
    });
    // ABSOLUTE ZERO: the frost walks out from where it started, slowly — the
    // front slowing as it goes — to three spaces, or the farthest card.
    const r0 = s * 0.7, R = Math.max(s * 1.8, ...hits.map((h) => h.d + s * 0.45)), RUN = 0.85, D = 1.3;
    const front = (time: number) => r0 + (R - r0) * (1 - Math.pow(1 - clamp01(time / RUN), 1.6));
    const fade = (time: number) => 1 - span(time, 0.9, D);
    const bs = branches(c, 16, r0, R, s, m.board), tips: Pt[] = [];
    // The ground behind it gone dark and cold...
    t.draw(D, (g, u) => {
      const time = u * D;
      g.poly(ground(c, front(time) * 0.96, m.board), true).fill({ color: COLD, alpha: 0.18 * fade(time) });
    }, { dark: true });
    // ...the frost itself, a blue sheen on the ground it has taken — dim
    // behind the front, where it has settled, and bright at the front, where
    // it is still growing — its tips glittering.
    let glint = 0;
    t.draw(D, (g, u, dt) => {
      const time = u * D, r = front(time), a = fade(time), fresh = 1 - span(time, RUN, RUN + 0.3);
      g.poly(ground(c, r * 0.96, m.board), true).fill({ color: VEIN, alpha: 0.05 * a });
      frost(g, bs, r, tips);
      g.stroke({ width: 4, color: GLOW, alpha: 0.14 * a, cap: "round" });
      frost(g, bs, r, tips);
      g.stroke({ width: 1.1, color: VEIN, alpha: (0.4 + 0.3 * (1 - fresh)) * a, cap: "round" });
      frost(g, bs, r, tips, Math.max(0, r - s * 0.75));
      g.stroke({ width: 5, color: GLOW, alpha: 0.3 * fresh * a, cap: "round" });
      frost(g, bs, r, tips, Math.max(0, r - s * 0.75));
      g.stroke({ width: 1.5, color: TIP, alpha: 0.95 * fresh * a, cap: "round" });
      for (const p of tips) g.circle(p.x, p.y, 1.8).fill({ color: WHITE, alpha: 0.9 * fresh * a });
      if (time < RUN && tips.length) {
        glint += 70 * dt;
        for (; glint >= 1; glint--) {
          const p = tips[Math.floor(rand(0, tips.length))];
          t.spark(p.x, p.y, rand(-20, 20) * v, rand(-20, 20) * v, rand(0.3, 0.55), GLINT);
        }
      }
    });
    flare(t, c, s * 1.6, VEIN, 0.45, 0.4);

    // Where it reaches a card, the card freezes solid.
    for (const h of hits) {
      const f = clamp01((h.d - r0) / (R - r0)), when = RUN * (1 - Math.pow(1 - f, 1 / 1.6));
      freeze(t, h.r, when, Math.max(0.45, D - when), h.power + (h.killed ? 0.2 : 0));
    }
  },
};
