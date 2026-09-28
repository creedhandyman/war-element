/** HOARFELL — Aurora Break. "17 DMG and BLIND for 2 rounds to every opponent
 *  within 2 spaces." Every step is louder than the last. That is not a
 *  warning, it is a count.
 *
 *  Hoarfell on its art is a great ice-ox in gold — horns banded, a golden sun
 *  for a crown, sun-medallions on its harness — with the aurora burning in the
 *  sky behind it. The DELIVERY is it rearing to stamp: a golden sun-mandala
 *  turning and brightening under it, frost forming round it, and the aurora
 *  beginning, faint, over everything it can reach. The LANDING is the STAMP —
 *  a gold shockwave off its hooves, the ice cracking out round it, icicles
 *  flung — and the aurora BREAKING: curtains of it, green at their hem through
 *  teal to violet, rays shimmering up off a rippling edge, sweeping out from
 *  Hoarfell over every card in reach. Each card the curtain crosses is
 *  dazzled (the BLIND): a burst of that light, rayed like a star.
 *
 *  Of the three ice bosses this is the one of LIGHT: Permafrost is white
 *  weather and Cryovex frost in the ground, but Hoarfell's cold is the colour
 *  of the polar sky. The aurora is drawn as rays, not a fill, so the cards
 *  read through it; its green is kept light, and the gold is only the stamp. */
import { centre, rand } from "../looks/base";
import type { Graphics } from "pixi.js";
import type { FxTools, Pt, SparkStyle } from "../looks/types";
import type { Signature, SigMoment } from "./types";

const TAU = Math.PI * 2;
/** The aurora: a pale mint hem, green, teal, violet up its rays. */
const MINT = 0xc8ffe0, GREEN = 0x5cffa0, TEAL = 0x4de8d8, VIOLET = 0xa77bff;
/** Its gold: the sun on its crown and harness. */
const GOLD = 0xffd27a, GOLD_HI = 0xfff0c0;
const WHITE = 0xffffff, FROST = 0xe6f8ff, ICE = 0x9fe3ff;
/** Ice splintered by the stamp: thrown, falling. */
const SHARD: SparkStyle = { palette: [WHITE, FROST, ICE, 0x6ea8e0], gravity: 520, drag: 0.6, size: [8, 2], streak: true };
/** Motes of the aurora, drifting and going out. */
const GLOW: SparkStyle = { palette: [WHITE, MINT, GREEN, VIOLET], gravity: -30, drag: 0.5, size: [5, 2], streak: false, swirl: 70 };

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeOut = (x: number) => 1 - (1 - x) * (1 - x);
/** 0 -> 1 as `x` runs from `a` to `b`. */
const span = (x: number, a: number, b: number) => clamp01((x - a) / (b - a));

/** A glow sized to the board's squares (`flash` is sized in px). */
function flare(t: FxTools, p: Pt, size: number, color: number, peak: number, seconds: number) {
  t.glow({ x: p.x - size / 2, y: p.y - size / 2, w: size, h: size }, color, peak, seconds, 1);
}

/** THE SUN under it: a gold ring and an inner one, spiked with rays like the
 *  crown on its art, turning. */
function mandala(g: Graphics, c: Pt, s: number, rot: number, a: number) {
  if (a <= 0.01) return;
  g.circle(c.x, c.y, s * 0.5).stroke({ width: 8, color: GOLD, alpha: 0.18 * a });
  g.circle(c.x, c.y, s * 0.5).stroke({ width: 2.2, color: GOLD_HI, alpha: 0.9 * a });
  g.circle(c.x, c.y, s * 0.36).stroke({ width: 1.4, color: GOLD, alpha: 0.75 * a });
  for (let i = 0; i < 12; i++) {
    const t0 = rot + (i / 12) * TAU, w = 0.09, l = i % 2 ? 0.66 : 0.78;
    g.poly([c.x + Math.cos(t0 - w) * s * 0.52, c.y + Math.sin(t0 - w) * s * 0.52, c.x + Math.cos(t0) * s * l, c.y + Math.sin(t0) * s * l,
      c.x + Math.cos(t0 + w) * s * 0.52, c.y + Math.sin(t0 + w) * s * 0.52], true).fill({ color: GOLD, alpha: 0.55 * a });
  }
}

/** A snowflake of frost: six arms, branched. */
function snowflake(g: Graphics, c: Pt, r: number, rot: number, alpha: number) {
  if (r < 1 || alpha <= 0.01) return;
  for (let i = 0; i < 6; i++) {
    const a = rot + (i / 6) * TAU, ux = Math.cos(a), uy = Math.sin(a), bx = c.x + ux * r * 0.55, by = c.y + uy * r * 0.55;
    g.moveTo(c.x, c.y).lineTo(c.x + ux * r, c.y + uy * r);
    for (const sd of [-1, 1]) g.moveTo(bx, by).lineTo(bx + Math.cos(a + sd * 1.05) * r * 0.3, by + Math.sin(a + sd * 1.05) * r * 0.3);
  }
  g.stroke({ width: 1.3, color: FROST, alpha, cap: "round" });
}

/** An icicle: a long thin diamond pointing along `a`, glassy, a white spine. */
function icicle(g: Graphics, x: number, y: number, a: number, len: number, alpha: number) {
  const ux = Math.cos(a), uy = Math.sin(a), w = len * 0.16;
  const pts = [x + ux * len * 0.62, y + uy * len * 0.62, x - uy * w, y + ux * w, x - ux * len * 0.38, y - uy * len * 0.38, x + uy * w, y - ux * w];
  g.poly(pts, true).fill({ color: ICE, alpha: 0.35 * alpha }).stroke({ width: 1.5, color: FROST, alpha });
  g.moveTo(pts[4], pts[5]).lineTo(pts[0], pts[1]).stroke({ width: 1.1, color: WHITE, alpha: 0.9 * alpha });
}

/** The region the aurora breaks over, in the ox's own terms: from just ahead
 *  of it to past the farthest card it reaches, and across everything between. */
interface Sky { c: Pt; ax: number; ay: number; cx: number; cy: number; a0: number; a1: number; x0: number; x1: number }
const at = (k: Sky, along: number, across: number): Pt => ({ x: k.c.x + k.ax * along + k.cx * across, y: k.c.y + k.ay * along + k.cy * across });

/** ONE CURTAIN of aurora, its hem at `hem` along the sky, rippling: rays
 *  standing off the hem back toward Hoarfell, shimmering, walking green to
 *  teal to violet as they go. `phase` sets it apart from the other curtain,
 *  `a` how lit it is. */
function curtain(g: Graphics, k: Sky, s: number, hem: number, time: number, phase: number, a: number) {
  if (a <= 0.01) return;
  const n = Math.max(8, Math.round((k.x1 - k.x0) / (s * 0.06)));
  const hemAt = (x: number) => hem + s * (0.12 * Math.sin(x * (2.6 / s) + time * 3 + phase) + 0.06 * Math.sin(x * (6.1 / s) - time * 5 + phase * 2));
  const bands: Array<[number, number, number, number, number]> = [[0, 0.3, MINT, 2.4, 0.55], [0.3, 0.62, GREEN, 2.2, 0.38], [0.62, 0.84, TEAL, 2, 0.24], [0.84, 1, VIOLET, 2, 0.16]];
  for (const [f0, f1, color, width, al] of bands) {
    for (let i = 0; i <= n; i++) {
      const x = k.x0 + ((k.x1 - k.x0) * i) / n, h = hemAt(x);
      const len = s * (0.55 + 0.35 * Math.sin(i * 1.7 + time * 6 + phase) + 0.2 * Math.sin(i * 0.43 - time * 2));
      const p0 = at(k, h - len * f0, x), p1 = at(k, h - len * f1, x);
      g.moveTo(p0.x, p0.y).lineTo(p1.x, p1.y);
    }
    g.stroke({ width, color, alpha: al * a, cap: "round" });
  }
  // Its hem: the bright rippling edge the rays stand off.
  const hemPts: number[] = [];
  for (let i = 0; i <= 30; i++) {
    const x = k.x0 + ((k.x1 - k.x0) * i) / 30, p = at(k, hemAt(x), x);
    hemPts.push(p.x, p.y);
  }
  const trace = () => { g.moveTo(hemPts[0], hemPts[1]); for (let i = 2; i < hemPts.length; i += 2) g.lineTo(hemPts[i], hemPts[i + 1]); };
  trace();
  g.stroke({ width: 10, color: GREEN, alpha: 0.2 * a, join: "round" });
  trace();
  g.stroke({ width: 2.4, color: MINT, alpha: 0.85 * a, join: "round" });
}

/** The sky it breaks over: from just ahead of the ox to past the farthest card
 *  it reaches, across all of them (and no wider than the board). */
function skyOf(m: SigMoment, c: Pt): Sky {
  const s = m.size, ax = m.ahead.x, ay = m.ahead.y, cx = -ay, cy = ax;
  const proj = (p: Pt) => ({ al: (p.x - c.x) * ax + (p.y - c.y) * ay, ac: (p.x - c.x) * cx + (p.y - c.y) * cy });
  const pts = m.targets.map((r) => proj(centre(r)));
  const b = m.board, edge = [[b.x, b.y], [b.x + b.w, b.y], [b.x, b.y + b.h], [b.x + b.w, b.y + b.h]].map(([x, y]) => proj({ x, y }).ac);
  const bx0 = Math.min(...edge), bx1 = Math.max(...edge);
  const a1 = pts.length ? Math.max(...pts.map((p) => p.al)) + s * 0.55 : s * 2.2;
  const x0 = Math.max(bx0, (pts.length ? Math.min(...pts.map((p) => p.ac)) : -s * 2) - s * 0.7);
  const x1 = Math.min(bx1, (pts.length ? Math.max(...pts.map((p) => p.ac)) : s * 2) + s * 0.7);
  return { c, ax, ay, cx, cy, a0: s * 0.25, a1, x0, x1 };
}

export const HOARFELL: Signature = {
  shake: 2,
  // It stamps where it stands; the aurora does the travelling.
  lunge: false,

  deliver(t: FxTools, m: SigMoment, seconds: number) {
    const s = m.size, c = centre(m.from), T = seconds, rot0 = rand(0, TAU);
    const k = skyOf(m, c);
    // The sun under it, turning and brightening as it rears...
    t.draw(T, (g, u) => mandala(g, c, s, rot0 + u * 1.2, easeOut(u)));
    // ...frost forming round it...
    t.draw(T, (g, u) => {
      const grow = easeOut(span(u, 0.1, 0.8));
      for (let i = 0; i < 6; i++) {
        const a = rot0 + (i / 6) * TAU + u * 0.6, r = s * 0.9;
        snowflake(g, { x: c.x + Math.cos(a) * r, y: c.y + Math.sin(a) * r }, s * 0.1 * grow, a, 0.8 * grow);
      }
    });
    t.charge(c, s * 1.5, GOLD, 0.5, T);
    // ...and the aurora beginning over everything it can reach, faint.
    t.draw(T, (g, u) => curtain(g, k, s, k.a0 + (k.a1 - k.a0) * 0.35, u * T, 0, 0.3 * span(u, 0.25, 1)));
  },

  land(t: FxTools, m: SigMoment) {
    const s = m.size, c = centre(m.from), v = s / 90, rot0 = rand(0, TAU);
    const k = skyOf(m, c);

    // THE STAMP: gold off its hooves in a shockwave, the ice cracking out
    // round it, icicles flung.
    flare(t, c, s * 2.1, GOLD_HI, 0.6, 0.32);
    t.draw(0.4, (g, u) => mandala(g, c, s * (1 + 0.25 * easeOut(u)), rot0, 1 - u));
    t.draw(0.5, (g, u) => {
      const r = s * (0.5 + 1.9 * easeOut(u)), a = 1 - u;
      g.circle(c.x, c.y, r).stroke({ width: 12 * a + 1, color: GOLD, alpha: 0.28 * a });
      g.circle(c.x, c.y, r).stroke({ width: 3 * a + 1, color: GOLD_HI, alpha: 0.9 * a });
      const r2 = s * (0.4 + 1.3 * easeOut(clamp01(u * 1.3 - 0.15)));
      g.circle(c.x, c.y, r2).stroke({ width: 2 * a + 0.5, color: ICE, alpha: 0.7 * a });
    });
    const cracks = Array.from({ length: 9 }, (_, i) => {
      const a = rot0 + (i / 9) * TAU + rand(-0.2, 0.2), pts: number[] = [];
      let x = c.x + Math.cos(a) * s * 0.45, y = c.y + Math.sin(a) * s * 0.45, h = a;
      pts.push(x, y);
      for (let j = 0; j < 4; j++) {
        h += rand(-0.4, 0.4);
        x += Math.cos(h) * s * 0.17;
        y += Math.sin(h) * s * 0.17;
        pts.push(x, y);
      }
      return pts;
    });
    t.draw(0.7, (g, u) => {
      const f = easeOut(span(u, 0, 0.12)), a = 1 - span(u, 0.4, 1), n = Math.max(1, Math.round(f * 4));
      for (const p of cracks) {
        g.moveTo(p[0], p[1]);
        for (let j = 1; j <= n; j++) g.lineTo(p[j * 2], p[j * 2 + 1]);
      }
      g.stroke({ width: 2, color: WHITE, alpha: 0.85 * a, join: "miter" });
    });
    const flung = Array.from({ length: 7 }, () => ({ a: Math.atan2(k.ay, k.ax) + rand(-1.6, 1.6), sp: rand(0.9, 1.6) * s, spin: rand(-6, 6) }));
    t.draw(0.5, (g, u) => {
      const e = easeOut(u), a = 1 - span(u, 0.55, 1);
      for (const f of flung) {
        const d = s * 0.4 + f.sp * e, x = c.x + Math.cos(f.a) * d, y = c.y + Math.sin(f.a) * d - s * 0.5 * Math.sin(Math.PI * u);
        icicle(g, x, y, f.a + f.spin * u, s * 0.28, a);
      }
    });
    for (let i = 0; i < 22; i++) {
      const a = rand(0, TAU), sp = rand(140, 300) * v;
      t.spark(c.x + Math.cos(a) * s * 0.4, c.y + Math.sin(a) * s * 0.4, Math.cos(a) * sp, Math.sin(a) * sp - rand(80, 200) * v, rand(0.4, 0.7), SHARD);
    }

    // THE AURORA BREAKS: two curtains sweeping out from the ox over all it
    // reaches — a light wash cast behind them — then hanging there, shimmering,
    // as they fade.
    const SWEEP = 0.55, D = 1.3;
    const hem = (time: number, lag: number) => k.a0 + (k.a1 - k.a0) * easeOut(clamp01((time - lag) / SWEEP));
    const lit = (time: number) => span(time, 0.02, 0.1) * (1 - span(time, 0.8, D));
    t.draw(D, (g, u) => {
      const time = u * D, a = lit(time), h = hem(time, 0);
      if (a <= 0.01) return;
      const p = [at(k, k.a0, k.x0), at(k, h, k.x0), at(k, h, k.x1), at(k, k.a0, k.x1)];
      g.poly([p[0].x, p[0].y, p[1].x, p[1].y, p[2].x, p[2].y, p[3].x, p[3].y], true).fill({ color: GREEN, alpha: 0.05 * a });
      curtain(g, k, s, hem(time, 0.1), time, 2.1, 0.6 * a);
      curtain(g, k, s, h, time, 0, a);
    });
    let mote = 0;
    t.draw(0.9, (_g, u, dt) => {
      mote += 60 * (1 - u) * dt;
      for (; mote >= 1; mote--) {
        const p = at(k, rand(k.a0, hem(u * 0.9, 0)), rand(k.x0, k.x1));
        t.spark(p.x, p.y, rand(-15, 15) * v, rand(-15, 15) * v, rand(0.5, 0.9), GLOW);
      }
    });

    // Each card the curtain crosses is dazzled: a burst of its light, rayed.
    m.targets.forEach((r, i) => {
      const p = centre(r), al = (p.x - c.x) * k.ax + (p.y - c.y) * k.ay;
      const when = SWEEP * (1 - Math.sqrt(1 - clamp01((al - k.a0) / (k.a1 - k.a0)))), pw = Math.max(0.8, Math.min(1.6, m.power[i] ?? 1));
      t.later(when, () => {
        flare(t, p, s * 1.3 * pw, MINT, 0.65, 0.3);
        t.ring(r, FROST, 0.3, 1.2, 0.35, 2.5);
        for (let j = 0; j < Math.round(6 + (m.killed[i] ? 8 : 0)); j++) {
          const a = rand(0, TAU), sp = rand(100, 220) * v;
          t.spark(p.x, p.y, Math.cos(a) * sp, Math.sin(a) * sp - 60 * v, rand(0.35, 0.55), SHARD);
        }
      });
      const rot = rand(0, TAU);
      t.draw(0.4, (g, u) => {
        const len = s * (0.25 + 0.5 * easeOut(u)) * pw, a = 1 - u;
        for (let j = 0; j < 8; j++) {
          const ang = rot + (j / 8) * TAU + u * 0.5, l = len * (j % 2 ? 0.6 : 1);
          g.moveTo(p.x + Math.cos(ang) * s * 0.1, p.y + Math.sin(ang) * s * 0.1).lineTo(p.x + Math.cos(ang) * l, p.y + Math.sin(ang) * l);
        }
        g.stroke({ width: 2.4 * a + 0.6, color: dazzleColor(i), alpha: 0.85 * a, cap: "round" });
      }, { delay: when });
    });
  },
};

/** The dazzle's rays take the aurora's colours in turn, card by card. */
function dazzleColor(i: number): number {
  return [MINT, TEAL, GREEN, VIOLET][i % 4];
}
