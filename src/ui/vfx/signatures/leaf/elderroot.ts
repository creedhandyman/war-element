/** ELDERROOT — Grove's Embrace. "Heal all allies 7 HP and cleanse their
 *  negative statuses." The oldest thing in the Grove: his Embrace heals the
 *  whole line and cleanses what ails it.
 *
 *  It aims at nothing, so there is no delivery: the LANDING is the whole
 *  move. The golden-green light of his art swells in his raised hands — one
 *  held high, one held out — and pours down him into the ground, pooling
 *  round his footing. From there it runs out through the earth as glowing
 *  root-veins, the luminous veins of the forest floor on his art, racing to
 *  every ally on his side. At each, the vein parts into two roots that curl
 *  up round the card either side — the Embrace, the Grove's arms round it —
 *  and a flower of golden light opens on it, healing motes rising off it.
 *  What ailed the card lifts off it as dark flecks that burn away into light
 *  as they rise: the cleanse.
 *
 *  All of it is light but the flecks and the earth round a vein: those are
 *  dark for real, and each fleck is rimmed in the gold that burns it away,
 *  so it reads over any card. */
import { centre, rand } from "../../looks/base";
import type { Graphics } from "pixi.js";
import type { FxTools, Pt, SparkStyle } from "../../looks/types";
import type { Signature, SigMoment } from "../types";

type Box = SigMoment["from"];

const TAU = Math.PI * 2;
// The Embrace's light, off his art: chartreuse going gold, white at the heart.
const WHITE = 0xfffff2, PALE = 0xf6ffd6, CHART = 0xd4f75a, GOLD = 0xffd75e, AMBER = 0xffb648, MOSS = 0x8fcf4a;
/** The earth a vein runs through, darkened round its light, and the blight
 *  the cleanse lifts off a card: only ever on the dark layer. */
const EARTH = 0x040a03, BLIGHT = 0x120818;
/** The sickly rim of a blight fleck, before the gold takes it. */
const SICK = 0xa47ae0;
/** Healing motes rising off an embraced card: green-gold, curling up. */
const MOTE: SparkStyle = { palette: [WHITE, GOLD, CHART, MOSS], gravity: -110, drag: 0.6, size: [7, 2], streak: false, swirl: 130 };
const MOTE_L: SparkStyle = { ...MOTE, swirl: -130 };
/** A fleck of blight burning out: the pinch of light it leaves. */
const EMBER: SparkStyle = { palette: [WHITE, GOLD, AMBER], gravity: -60, drag: 0.5, size: [6, 1], streak: false };
/** Light shed by a vein's racing tip. */
const SHED: SparkStyle = { palette: [PALE, CHART, MOSS], gravity: -25, drag: 0.4, size: [5, 1], streak: false };

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeOut = (x: number) => 1 - (1 - x) * (1 - x);
/** Overshoots a little and settles: a petal springing open. */
const springOut = (x: number) => 1 + 2.7 * Math.pow(x - 1, 3) + 1.7 * Math.pow(x - 1, 2);

/** When the light reaches the ground under him, and a vein's run per square
 *  of distance (plus a base): the nearest are embraced first. */
const POUR = 0.2, RUN0 = 0.1, RUN_PER = 0.075;

// ── Lines that grow ──────────────────────────────────────────────────────────

/** Running arc length along a flat point list. */
function lengths(pts: number[]): number[] {
  const cum = [0];
  for (let i = 1; i < pts.length / 2; i++) cum.push(cum[i - 1] + Math.hypot(pts[i * 2] - pts[i * 2 - 2], pts[i * 2 + 1] - pts[i * 2 - 1]));
  return cum;
}

/** The first `upto` px of a sampled line. */
function upTo(pts: number[], cum: number[], upto: number): number[] {
  const out = [pts[0], pts[1]];
  for (let i = 1; i < cum.length; i++) {
    if (cum[i] <= upto) { out.push(pts[i * 2], pts[i * 2 + 1]); continue; }
    const f = (upto - cum[i - 1]) / (cum[i] - cum[i - 1] || 1);
    out.push(pts[i * 2 - 2] + (pts[i * 2] - pts[i * 2 - 2]) * f, pts[i * 2 - 1] + (pts[i * 2 + 1] - pts[i * 2 - 1]) * f);
    break;
  }
  return out;
}

/** A body round a point list: `w0` across where it starts, thinning to `w1`,
 *  and drawn to a point at its end — a root's growing tip, not a stroke. */
function taper(line: number[], w0: number, w1: number): number[] {
  const n = line.length / 2, left: number[] = [], right: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1);
    const tx = line[b * 2] - line[a * 2], ty = line[b * 2 + 1] - line[a * 2 + 1], l = Math.hypot(tx, ty) || 1;
    const hw = ((w0 + ((w1 - w0) * i) / Math.max(1, n - 1)) / 2) * (i === n - 1 ? 0.15 : 1);
    left.push(line[i * 2] - (ty / l) * hw, line[i * 2 + 1] + (tx / l) * hw);
    right.unshift(line[i * 2] + (ty / l) * hw, line[i * 2 + 1] - (tx / l) * hw);
  }
  return left.concat(right);
}

/** A ROOT-VEIN: its meandering course through the ground from `a` to `b`
 *  (dying out at both ends, so it leaves him and meets its card dead on),
 *  how thick it runs, when it leaves the pool and how long it takes, and the
 *  rootlets forking off it on the way. */
interface Vein {
  pts: number[]; cum: number[]; total: number; w: number; at: number; run: number; hold: number;
  forks: { at: number; pts: number[] }[];
}

function veinOf(a: Pt, b: Pt, w: number, at: number, run: number, hold: number, s: number): Vein {
  const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
  const side = Math.random() < 0.5 ? -1 : 1, amp = Math.min(L * 0.13, s * 0.2) * side, ph = rand(0, TAU), N = 16, pts: number[] = [];
  for (let i = 0; i <= N; i++) {
    const f = i / N, env = Math.sin(Math.PI * f);
    const off = (amp * Math.sin(f * Math.PI * 1.6 + ph) + amp * 0.3 * Math.sin(f * Math.PI * 5.2 + ph * 2)) * env;
    pts.push(a.x + dx * f + nx * off, a.y + dy * f + ny * off);
  }
  const cum = lengths(pts);
  // Rootlets feeling off it, kinked, out to alternate sides — a short vein
  // has no room for them.
  const forks = L < s * 0.5 ? [] : [0.36, 0.64].map((f, k) => {
    const i = Math.round(f * N), x = pts[i * 2], y = pts[i * 2 + 1];
    let ang = Math.atan2(pts[i * 2 + 3] - pts[i * 2 - 1], pts[i * 2 + 2] - pts[i * 2 - 2]) + (k ? 1 : -1) * side * rand(0.6, 1.0);
    const len = Math.min(s * 0.3, L * rand(0.2, 0.28)), fp = [x, y];
    let px = x, py = y;
    for (let j = 0; j < 3; j++) {
      ang += rand(-0.4, 0.4);
      px += (Math.cos(ang) * len) / 3;
      py += (Math.sin(ang) * len) / 3;
      fp.push(px, py);
    }
    return { at: cum[i], pts: fp };
  });
  return { pts, cum, total: cum[N], w, at, run, hold, forks };
}

/** Where a ray from a card's centre along (ux, uy) leaves its square. */
function edgeOf(c: Pt, ux: number, uy: number, half: number): Pt {
  const k = Math.min(half / Math.max(1e-3, Math.abs(ux)), half / Math.max(1e-3, Math.abs(uy)));
  return { x: c.x + ux * k, y: c.y + uy * k };
}

// ── Light ────────────────────────────────────────────────────────────────────

/** A flower of light, `r` to its petal tips, `open` 0..1 unfolded: six gold
 *  petals over six green-gold, a white heart ringed with stamens. */
function flower(g: Graphics, c: Pt, r: number, open: number, spin: number, alpha: number) {
  if (alpha <= 0.02 || open <= 0.02) return;
  const rings: [number, number, number, number][] = [[r, 0, GOLD, 0.5], [r * 0.6, Math.PI / 6, CHART, 0.55]];
  for (const [R, off, color, fill] of rings)
    for (let i = 0; i < 6; i++) {
      const a = spin + off + (i / 6) * TAU, L = R * open, W = L * 0.4, ca = Math.cos(a), sa = Math.sin(a);
      const mx = c.x + ca * L * 0.5, my = c.y + sa * L * 0.5;
      g.moveTo(c.x, c.y).quadraticCurveTo(mx - sa * W, my + ca * W, c.x + ca * L, c.y + sa * L)
        .quadraticCurveTo(mx + sa * W, my - ca * W, c.x, c.y).fill({ color, alpha: fill * alpha }).stroke({ width: 1.3, color: PALE, alpha: 0.85 * alpha });
    }
  g.circle(c.x, c.y, r * 0.3 * open).fill({ color: GOLD, alpha: 0.35 * alpha });
  g.circle(c.x, c.y, r * 0.15 * open).fill({ color: WHITE, alpha: 0.95 * alpha });
  for (let i = 0; i < 6; i++) {
    const a = spin * 1.5 + (i / 6) * TAU + 0.3;
    g.circle(c.x + Math.cos(a) * r * 0.24 * open, c.y + Math.sin(a) * r * 0.24 * open, Math.max(0.8, r * 0.035)).fill({ color: WHITE, alpha: 0.9 * alpha });
  }
}

/** A small leaf budding on a root: a teardrop from its stem, `len` long. */
function bud(g: Graphics, x: number, y: number, len: number, ang: number, color: number, alpha: number) {
  if (alpha <= 0.02 || len < 1.5) return;
  const c = Math.cos(ang), s = Math.sin(ang), w = len * 0.42, mx = x + c * len * 0.4, my = y + s * len * 0.4;
  g.moveTo(x, y).quadraticCurveTo(mx - s * w, my + c * w, x + c * len, y + s * len).quadraticCurveTo(mx + s * w, my - c * w, x, y).fill({ color, alpha });
}

export const ELDERROOT: Signature = {
  // A blessing, not a blow: the board stays still.
  shake: 0,
  // He does not move: the Grove comes to them through the ground.
  lunge: false,

  land(t: FxTools, m: SigMoment) {
    const c = centre(m.from), s = m.size, half = s * 0.45;
    gather(t, m.from, s);
    // THE VEINS: from the edge of his square, out through the earth to the
    // facing edge of each ally's — the nearest first.
    const veins: Vein[] = [];
    const reached: { r: Box; at: Pt; when: number }[] = [];
    for (const r of m.allies) {
      const p = centre(r), d = Math.hypot(p.x - c.x, p.y - c.y) || 1, ux = (p.x - c.x) / d, uy = (p.y - c.y) / d;
      const a = edgeOf(c, ux, uy, half), b = edgeOf(p, -ux, -uy, half * 1.02);
      const run = RUN0 + RUN_PER * (Math.hypot(b.x - a.x, b.y - a.y) / s);
      const at = POUR + rand(0, 0.03);
      veins.push(veinOf(a, b, s * 0.065, at, run, 0.3, s));
      reached.push({ r, at: b, when: at + run });
    }
    // ...and, when the line is short, a few that go nowhere in particular: the
    // light running on into the forest floor, away from the line, so the
    // ground round him is lit even when he stands alone.
    const dirs = m.allies.map((r) => Math.atan2(centre(r).y - c.y, centre(r).x - c.x));
    const free: number[] = [];
    for (let k = 0; k < 3 - m.allies.length; k++) {
      let best = 0, bestGap = -1;
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * TAU + 0.1, gap = Math.min(Math.PI, ...dirs.concat(free).map((d) => Math.abs(Math.atan2(Math.sin(a - d), Math.cos(a - d)))));
        if (gap > bestGap) { bestGap = gap; best = a; }
      }
      free.push(best);
      const a0 = edgeOf(c, Math.cos(best), Math.sin(best), half), len = s * rand(0.38, 0.55);
      veins.push(veinOf(a0, { x: a0.x + Math.cos(best + rand(-0.3, 0.3)) * len, y: a0.y + Math.sin(best + rand(-0.3, 0.3)) * len },
        s * 0.045, POUR + rand(0, 0.05), 0.22, 0.08, s));
    }
    const grown = (v: Vein, time: number) => v.total * (1 - Math.pow(1 - clamp01((time - v.at) / v.run), 1.7));
    const fade = (v: Vein, time: number) => 1 - clamp01((time - v.at - v.run - v.hold) / 0.3);
    const D = Math.max(...veins.map((v) => v.at + v.run + v.hold + 0.3));
    // The earth darkened along each vein, so its light reads over a card as
    // well as over an empty square.
    t.draw(D, (g, u) => {
      const time = u * D;
      for (const v of veins) {
        if (time < v.at) continue;
        const line = upTo(v.pts, v.cum, grown(v, time));
        g.poly(line, false).stroke({ width: v.w * 2.6, color: EARTH, alpha: 0.36 * fade(v, time), join: "round", cap: "round" });
      }
    }, { dark: true });
    const shed = veins.map(() => 0);
    t.draw(D, (g, u, dt) => {
      const time = u * D;
      veins.forEach((v, k) => {
        if (time < v.at) return;
        const up = grown(v, time), a = fade(v, time), line = upTo(v.pts, v.cum, up);
        if (a <= 0.02 || line.length < 4) return;
        g.poly(line, false).stroke({ width: v.w * 3.2, color: CHART, alpha: 0.16 * a, join: "round" });
        g.poly(taper(line, v.w, v.w * 0.3), true).fill({ color: CHART, alpha: 0.85 * a });
        g.poly(upTo(v.pts, v.cum, up * 0.75), false).stroke({ width: Math.max(1, v.w * 0.3), color: WHITE, alpha: 0.75 * a, join: "round" });
        for (const f of v.forks) {
          if (up < f.at) continue;
          const fl = clamp01((up - f.at) / (v.total * 0.25)), fc = lengths(f.pts);
          g.poly(upTo(f.pts, fc, fc[fc.length - 1] * fl), false).stroke({ width: Math.max(1, v.w * 0.4), color: CHART, alpha: 0.75 * a, join: "round" });
        }
        // The racing tip: white-hot, shedding light as it goes, and spent as
        // it arrives.
        const p = up / v.total;
        if (p < 0.98) {
          const hx = line[line.length - 2], hy = line[line.length - 1], k2 = 1 - p * p * p;
          g.circle(hx, hy, s * 0.08 * k2).fill({ color: CHART, alpha: 0.35 * k2 });
          g.circle(hx, hy, s * 0.032 * (0.5 + 0.5 * k2)).fill({ color: WHITE, alpha: k2 });
          shed[k] += dt * 40 * t.quality;
          for (; shed[k] >= 1; shed[k]--)
            t.spark(hx, hy, rand(-30, 30) * (s / 90), rand(-50, 10) * (s / 90), rand(0.25, 0.4), SHED);
        }
      });
    });
    // Where each vein arrives, the Embrace.
    for (const h of reached) t.later(h.when, () => embrace(t, h.r, h.at, s));
  },
};

/** THE GATHER: golden-green light swelling in his raised hands — the high
 *  one and the held-out one, where they are on his art — then pouring down
 *  him into the ground, pooling round his footing as it soaks in. */
function gather(t: FxTools, r: Box, s: number) {
  const c = centre(r);
  const hands = [{ x: r.x + r.w * 0.2, y: r.y + r.h * 0.17 }, { x: r.x + r.w * 0.83, y: r.y + r.h * 0.4 }];
  const feet = { x: c.x, y: r.y + r.h * 0.9 };
  t.glow(r, CHART, 0.26, 0.5, 1.0);
  for (const h of hands)
    t.emit({ count: 7, palette: [WHITE, GOLD, CHART], from: { x: h.x - s * 0.22, y: h.y - s * 0.22, w: s * 0.44, h: s * 0.44 }, at: "ring",
      speed: [80 * (s / 90), 130 * (s / 90)], gravity: 0, drag: 1, life: [0.12, 0.2], size: [5, 2] });
  const SWELL = POUR, D = POUR + 0.2;
  const spin = rand(0, TAU);
  t.draw(D, (g, u) => {
    const time = u * D, k = easeOut(clamp01(time / SWELL)), out = clamp01((time - SWELL + 0.04) / 0.16);
    hands.forEach((h, i) => {
      const a = 1 - out, rad = s * (0.025 + 0.055 * k) * (1 - 0.5 * out);
      if (a <= 0.02) return;
      g.circle(h.x, h.y, rad * 2.6).fill({ color: CHART, alpha: 0.22 * a });
      g.circle(h.x, h.y, rad * 1.5).fill({ color: GOLD, alpha: 0.5 * a });
      g.circle(h.x, h.y, rad * 0.75).fill({ color: WHITE, alpha: 0.95 * a });
      // The ring of light round his hand on the art, turning as it brightens.
      const R = s * (0.1 + 0.05 * k), sp = spin + (i ? -1 : 1) * time * 7;
      for (let j = 0; j < 3; j++) {
        const a0 = sp + (j / 3) * TAU;
        g.moveTo(h.x + Math.cos(a0) * R, h.y + Math.sin(a0) * R).arc(h.x, h.y, R, a0, a0 + 1.4);
      }
      g.stroke({ width: 1.4, color: PALE, alpha: 0.8 * k * a });
    });
    // Poured down him: a wisp of light from each hand to his feet, curling
    // the way the light curls round him on his art — head first, the tail
    // following it down.
    const head = clamp01((time - SWELL + 0.1) / 0.12), tail = clamp01((time - SWELL + 0.02) / 0.16);
    if (head > tail)
      hands.forEach((h, i) => {
        const pts: number[] = [], side = h.x < c.x ? -1 : 1;
        for (let j = 0; j <= 10; j++) {
          const f = tail + ((head - tail) * j) / 10, bow = Math.sin(Math.PI * f) * side * s * 0.1;
          const wave = Math.sin(f * 11 + i * 2 + time * 20) * s * 0.035 * Math.sin(Math.PI * f);
          pts.push(h.x + (feet.x - h.x) * f + bow + wave, h.y + (feet.y - h.y) * f);
        }
        g.poly(pts, false).stroke({ width: s * 0.09, color: CHART, alpha: 0.22, join: "round", cap: "round" });
        g.poly(pts, false).stroke({ width: Math.max(1.5, s * 0.026), color: PALE, alpha: 0.95, join: "round", cap: "round" });
      });
  });
  // It soaks in: a pool of light round his footing, opening out.
  t.later(SWELL, () => {
    t.flash(feet, CHART, 0.22 * (s / 80));
    t.draw(0.55, (g, u) => {
      const k = easeOut(clamp01(u / 0.4)), a = 1 - u;
      g.circle(c.x, c.y, s * (0.46 + 0.2 * k)).stroke({ width: s * 0.12, color: CHART, alpha: 0.14 * a });
      g.circle(c.x, c.y, s * (0.46 + 0.2 * k)).stroke({ width: 1.6, color: GOLD, alpha: 0.8 * a });
    });
  });
}

/** THE EMBRACE on an ally the vein reached at `from`: the root curls up onto
 *  the card — tendrils curling off its foot — and climbs to its heart; two
 *  leaves open round the top of it, cupped like hands, and a flower of golden
 *  light opens between them. Healing motes rise off the card, and what ailed
 *  it lifts off as dark flecks that burn out into light. */
function embrace(t: FxTools, r: Box, from: Pt, s: number) {
  const c = centre(r), F = { x: c.x, y: c.y - s * 0.04 }, D = 0.62;
  const dx = F.x - from.x, dy = F.y - from.y, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, nx = -uy, ny = ux;
  // The stem: from where the vein came in, bowing a little, to the heart.
  const bow = L * rand(0.14, 0.22) * (Math.random() < 0.5 ? -1 : 1), stem: number[] = [];
  for (let i = 0; i <= 10; i++) {
    const f = i / 10, w = 1 - f, mx = (from.x + F.x) / 2 + nx * bow, my = (from.y + F.y) / 2 + ny * bow;
    stem.push(w * w * from.x + 2 * w * f * mx + f * f * F.x, w * w * from.y + 2 * w * f * my + f * f * F.y);
  }
  const stemCum = lengths(stem), stemLen = stemCum[10];
  // The roots curling up off its foot, out either side along the card's
  // edge, each winding into a tight curl.
  const curls = [-1, 1].map((side) => {
    let a = Math.atan2(ny * side, nx * side) + side * 0.5, x = from.x, y = from.y;
    const pts = [x, y], len = s * 0.3;
    for (let i = 1; i <= 10; i++) {
      const f = i / 10;
      a += side * 0.5 * (0.5 + 1.1 * f);
      x += (Math.cos(a) * len * (1.15 - 0.75 * f)) / 10;
      y += (Math.sin(a) * len * (1.15 - 0.75 * f)) / 10;
      pts.push(x, y);
    }
    return { pts, cum: lengths(pts) };
  });
  const climb = (time: number) => easeOut(clamp01(time / 0.13));
  const curl = (time: number) => easeOut(clamp01((time - 0.02) / 0.14));
  const LEAF_AT = 0.09, OPEN = 0.12, spin = rand(0, TAU);
  const plantA = (time: number) => 1 - clamp01((time - 0.38) / 0.24);
  const up = Math.atan2(uy, ux), Q = { x: stem[14], y: stem[15] };
  t.draw(D, (g, u) => {
    const time = u * D, a = plantA(time);
    if (a > 0.02) {
      const line = upTo(stem, stemCum, stemLen * climb(time));
      if (line.length >= 4) {
        g.poly(line, false).stroke({ width: s * 0.12, color: CHART, alpha: 0.13 * a, join: "round" });
        g.poly(taper(line, s * 0.06, s * 0.028), true).fill({ color: CHART, alpha: 0.9 * a });
        g.poly(line, false).stroke({ width: 1, color: WHITE, alpha: 0.6 * a, join: "round" });
      }
      for (const k of curls) {
        const cl = upTo(k.pts, k.cum, k.cum[10] * curl(time));
        if (cl.length >= 4) g.poly(taper(cl, s * 0.035, s * 0.012), true).fill({ color: CHART, alpha: 0.85 * a });
      }
      // The two leaves cupping the bloom, opening off the top of the stem.
      const lo = easeOut(clamp01((time - LEAF_AT) / 0.14));
      if (lo > 0)
        for (const side of [-1, 1]) {
          bud(g, Q.x, Q.y, s * 0.3 * lo, up + side * 0.95, side < 0 ? MOSS : CHART, 0.75 * a);
          const la = up + side * 0.95;
          g.moveTo(Q.x, Q.y).lineTo(Q.x + Math.cos(la) * s * 0.22 * lo, Q.y + Math.sin(la) * s * 0.22 * lo).stroke({ width: 1, color: PALE, alpha: 0.7 * a });
        }
    }
    // The flower of light, springing open on the card and fading as it
    // gives itself up to it.
    const q = clamp01((time - OPEN) / 0.2), fadeF = 1 - clamp01((time - OPEN - 0.22) / (D - OPEN - 0.22));
    flower(g, F, s * 0.29 * (1 + 0.12 * (1 - fadeF)), springOut(q), spin + time * 0.8, fadeF * clamp01(q * 3));
  });
  t.later(OPEN, () => {
    t.glow(r, 0xeaffa0, 0.32, 0.55, 1.1);
    t.ring(r, GOLD, 0.35, 1.0, 0.4, 2);
    const n = Math.round(9 * t.quality);
    for (let i = 0; i < n; i++)
      t.spark(r.x + rand(0.15, 0.85) * r.w, r.y + r.h * rand(0.55, 0.9), rand(-15, 15) * (s / 90), -rand(55, 105) * (s / 90), rand(0.45, 0.7), i % 2 ? MOTE : MOTE_L);
  });
  cleanse(t, r, s);
  glints(t, r, s, 3, 0.12, D);
}

/** THE CLEANSE: the ailment lifting off a card as dark flecks — soot-dark
 *  and ragged, a sickly violet at the rim until the gold takes them —
 *  rising, shrinking, and going out as a pinch of light. */
function cleanse(t: FxTools, r: Box, s: number) {
  const c = centre(r), n = Math.max(3, Math.round(6 * t.quality)), D = 0.75;
  const flecks = Array.from({ length: n }, (_, i) => ({
    x: c.x + ((i + 0.5) / n - 0.5) * r.w * 0.7 + rand(-0.05, 0.05) * r.w, y: c.y + rand(-0.1, 0.3) * r.h,
    vx: rand(-25, 25) * (s / 90), vy: -rand(70, 110) * (s / 90),
    at: rand(0.1, 0.26), life: rand(0.34, 0.44), rad: s * rand(0.055, 0.075), rot: rand(0, TAU), shape: Array.from({ length: 5 }, () => rand(0.6, 1)),
  }));
  const where = (f: (typeof flecks)[number], q: number) => {
    const time = q * f.life;
    return { x: f.x + f.vx * time + Math.sin(time * 14 + f.rot) * s * 0.02, y: f.y + f.vy * time, rad: f.rad * (1 - 0.6 * q) };
  };
  const shape = (f: (typeof flecks)[number], p: { x: number; y: number; rad: number }, q: number) => {
    const pts: number[] = [];
    for (let i = 0; i < 5; i++) {
      const a = f.rot + q * 5 + (i / 5) * TAU;
      pts.push(p.x + Math.cos(a) * p.rad * f.shape[i], p.y + Math.sin(a) * p.rad * f.shape[i]);
    }
    return pts;
  };
  t.draw(D, (g, u) => {
    const time = u * D;
    for (const f of flecks) {
      const q = (time - f.at) / f.life;
      if (q <= 0 || q >= 1) continue;
      g.poly(shape(f, where(f, q), q), true).fill({ color: BLIGHT, alpha: 0.85 * (1 - q * q) * Math.min(1, q * 8) });
    }
  }, { dark: true });
  t.draw(D, (g, u) => {
    const time = u * D;
    for (const f of flecks) {
      const q = (time - f.at) / f.life;
      if (q <= 0 || q >= 1) continue;
      const p = where(f, q);
      g.poly(shape(f, p, q), true).stroke({ width: 1.4, color: q < 0.35 ? SICK : q < 0.65 ? AMBER : GOLD, alpha: (0.6 + 0.4 * q) * Math.min(1, q * 8) });
      if (q > 0.6) g.circle(p.x, p.y, p.rad * 0.6).fill({ color: WHITE, alpha: (q - 0.6) * 2 });
    }
  });
  for (const f of flecks)
    t.later(f.at + f.life, () => {
      const p = where(f, 1);
      t.spark(p.x, p.y, rand(-20, 20) * (s / 90), -rand(20, 50) * (s / 90), rand(0.25, 0.4), EMBER);
    });
}

/** Twinkles on a healed card: four-point glints that pop and shrink. */
function glints(t: FxTools, r: Box, s: number, n: number, from: number, D: number) {
  const gs = Array.from({ length: n }, () => ({ x: r.x + rand(0.15, 0.85) * r.w, y: r.y + rand(0.1, 0.7) * r.h, at: rand(from, D - 0.3) }));
  t.draw(D, (g, u) => {
    const time = u * D;
    for (const p of gs) {
      const q = (time - p.at) / 0.26;
      if (q <= 0 || q >= 1) continue;
      const L = s * 0.08 * Math.sin(Math.PI * q);
      g.moveTo(p.x - L, p.y).lineTo(p.x + L, p.y).moveTo(p.x, p.y - L).lineTo(p.x, p.y + L).stroke({ width: 1.5, color: WHITE, alpha: 0.9 });
    }
  });
}
