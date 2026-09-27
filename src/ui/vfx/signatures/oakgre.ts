/** OAKGRE — Uprooted. "Lose 9 HP. Permanently gain +3 DMG and +3 SP — it can
 *  move for the rest of the game. Three casts maximum." He has torn free of
 *  the soil three times in a thousand years, and never once put a root back.
 *
 *  It aims at nothing, so there is no delivery: the LANDING is the whole
 *  move. The ground round the card HEAVES — humped up over the great roots
 *  that spread from its feet on its art, cracking between them — and the
 *  roots rip up out of it, the soil splitting along each one and clods of
 *  earth flung off them. Then they SNAP, amber splinters where they break
 *  (the 9 HP it pays): the far ends thrown away, the stubs drawn back up into
 *  the trunk, torn furrows left in the ground. And the power comes up through
 *  it: a green-gold surge climbing from its footing to its crown, the cracks
 *  in its bark lighting amber as on its art, leaves spiralling up round it —
 *  the DMG and the SP it keeps.
 *
 *  Bark and earth are SOLID, on the normal-blend layer: a mid-brown root with
 *  a shadowed underside, a lit back and a dark edge reads as wood over an
 *  empty square as well as over a card. */
import { centre, rand } from "../looks/base";
import type { Graphics } from "pixi.js";
import type { FxTools, Pt, SparkStyle } from "../looks/types";
import type { Signature, SigMoment } from "./types";

type Box = SigMoment["from"];

const TAU = Math.PI * 2;
// Bark and earth: real colour, on the normal-blend layer.
const BARK = 0x6b4f33, BARK_LO = 0x35271a, BARK_HI = 0xb8956a, BARK_EDGE = 0x160f08;
const SOIL = 0x24180d, CLOD = 0x3a2a18, CLOD_LIT = 0xb89468, DUST = 0xb89e80;
// Light (additive): moss on the bark, the amber in its cracks, the surge.
const MOSS = 0xa6d86a, AMBER = 0xffae3c, GOLD = 0xffe08a, PALE = 0xf4ffe6, LIME = 0xb6f27a, GREEN = 0x4caf6d;
/** Splinters where a root snaps: wood-hot, falling. */
const SPLINTER: SparkStyle = { palette: [0xfff0c0, 0xffc060, 0xa0703a], gravity: 900, drag: 0.5, size: [6, 2], streak: true };
/** Grit shaken off torn roots and heaved ground. */
const GRIT: SparkStyle = { palette: [0xe8d8b0, 0xb89468, 0x6e5a40], gravity: 950, drag: 0.6, size: [5, 2], streak: false };
/** Motes of the surge: green-gold, rising, curling. */
const RISE: SparkStyle = { palette: [PALE, GOLD, LIME, GREEN], gravity: -110, drag: 0.6, size: [7, 2], streak: false, swirl: 130 };
const RISE_L: SparkStyle = { ...RISE, swirl: -130 };

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeOut = (x: number) => 1 - (1 - x) * (1 - x);

/** One leaf: a teardrop, round at the stem and pointed at the tip; `open` is
 *  how face-on it is, so a turning leaf thins to a sliver and back. */
function leaf(g: Graphics, x: number, y: number, len: number, ang: number, open: number, color: number, alpha: number) {
  if (alpha <= 0.02 || len < 2) return;
  const c = Math.cos(ang), s = Math.sin(ang), hx = c * len * 0.5, hy = s * len * 0.5, w = len * 0.46 * Math.max(0.12, open);
  const mx = x - hx * 0.3, my = y - hy * 0.3;
  g.moveTo(x - hx, y - hy).quadraticCurveTo(mx - s * w, my + c * w, x + hx, y + hy)
    .quadraticCurveTo(mx + s * w, my - c * w, x - hx, y - hy).fill({ color, alpha });
  if (len > 9 && open > 0.4)
    g.moveTo(x - hx * 1.1, y - hy * 1.1).lineTo(x + hx * 0.8, y + hy * 0.8).stroke({ width: 1, color: PALE, alpha: alpha * 0.5 });
}

// ── The roots ────────────────────────────────────────────────────────────────

/** A root: its course out from under the card into the ground, meandering,
 *  fixed once — how thick, where a side root forks off it — and when it rips
 *  loose, where it snaps, and how the broken end goes. */
interface Root {
  pts: number[]; w: number; out: Pt; ph: number;
  fork: { at: number; ang: number; len: number };
  at: number; snap: number; brk: number; spin: number; fly: number;
}
const N = 12;

function rootOf(c: Pt, ang: number, s: number, at: number): Root {
  const r0 = s * 0.27, L = s * rand(0.75, 0.92), ox = Math.cos(ang), oy = Math.sin(ang);
  const amp = rand(0.07, 0.12) * L * (Math.random() < 0.5 ? -1 : 1), ph = rand(0, TAU), pts: number[] = [];
  for (let i = 0; i <= N; i++) {
    const f = i / N, off = amp * Math.sin(f * Math.PI * 1.6 + ph) * Math.sin(Math.PI * Math.min(1, f * 1.3));
    pts.push(c.x + ox * (r0 + L * f) - oy * off, c.y + oy * (r0 + L * f) + ox * off);
  }
  return { pts, w: s * rand(0.19, 0.23), out: { x: ox, y: oy }, ph,
    fork: { at: rand(0.35, 0.5), ang: rand(0.5, 0.8) * (Math.random() < 0.5 ? -1 : 1), len: L * rand(0.26, 0.36) },
    at, snap: at + rand(0.3, 0.35), brk: rand(0.52, 0.64), spin: rand(4, 7) * (Math.random() < 0.5 ? -1 : 1), fly: rand(80, 140) };
}

/** The point `i` samples along a centreline, and the way it runs there. */
function onLine(line: number[], i: number) {
  const j = Math.min(N - 1, Math.max(0, Math.floor(i))), fr = i - j;
  const dx = line[j * 2 + 2] - line[j * 2], dy = line[j * 2 + 3] - line[j * 2 + 1];
  return { x: line[j * 2] + dx * fr, y: line[j * 2 + 1] + dy * fr, a: Math.atan2(dy, dx) };
}

/** An outline along a centreline from sample `i0` to `i1`: `hw(f)` wide
 *  either side, pointed where it ends at the tip, knotted as roots are;
 *  every point through `move` (a lift, or the tumble of a broken end). */
function body(line: number[], i0: number, i1: number, hw: (f: number) => number, move?: (x: number, y: number) => Pt): number[] {
  const left: number[] = [], right: number[] = [], steps = Math.max(2, Math.ceil((i1 - i0) * 1.5));
  for (let k = 0; k <= steps; k++) {
    const i = i0 + ((i1 - i0) * k) / steps, p = onLine(line, i), nx = -Math.sin(p.a), ny = Math.cos(p.a);
    const w = hw(i / N) * (i1 >= N - 0.01 && k === steps ? 0.12 : 1);
    const a = { x: p.x + nx * w, y: p.y + ny * w }, b = { x: p.x - nx * w, y: p.y - ny * w };
    const ma = move ? move(a.x, a.y) : a, mb = move ? move(b.x, b.y) : b;
    left.push(ma.x, ma.y);
    right.unshift(mb.x, mb.y);
  }
  return left.concat(right);
}

/** A side root forking off a lifted main root: a short curve from the fork
 *  point, its own centreline in the same sampling. */
function forkLine(rt: Root, line: number[]): number[] {
  const p = onLine(line, rt.fork.at * N), out: number[] = [];
  let x = p.x, y = p.y, a = p.a + rt.fork.ang;
  for (let i = 0; i <= N; i++) {
    out.push(x, y);
    a -= rt.fork.ang * 0.06;
    x += Math.cos(a) * (rt.fork.len / N);
    y += Math.sin(a) * (rt.fork.len / N);
  }
  return out;
}

// ── Earth ────────────────────────────────────────────────────────────────────

/** Clods of earth — lumpy dark bodies lit on their rims — thrown from `at`
 *  with velocities from `vel`, falling back under gravity. */
function clods(t: FxTools, at: Pt, n: number, s: number, vel: () => Pt, delay: number) {
  const bits = Array.from({ length: Math.max(1, Math.round(n * t.quality)) }, () => {
    const v = vel();
    return { x: at.x + rand(-3, 3), y: at.y + rand(-3, 3), vx: v.x, vy: v.y, r: s * rand(0.03, 0.052), rot: rand(0, TAU), vr: rand(-8, 8),
      shape: Array.from({ length: 6 }, () => rand(0.7, 1)), life: rand(0.45, 0.6) };
  });
  t.draw(0.6, (g, u) => {
    const time = u * 0.6;
    for (const b of bits) {
      if (time >= b.life) continue;
      const x = b.x + b.vx * time, y = b.y + b.vy * time + 700 * (s / 90) * time * time, a = 1 - Math.pow(time / b.life, 3), p: number[] = [];
      for (let i = 0; i < 6; i++) {
        const ang = b.rot + b.vr * time + (i / 6) * TAU;
        p.push(x + Math.cos(ang) * b.r * b.shape[i], y + Math.sin(ang) * b.r * b.shape[i]);
      }
      g.poly(p, true).fill({ color: CLOD, alpha: a }).stroke({ width: Math.max(1, b.r * 0.3), color: CLOD_LIT, alpha: 0.85 * a });
    }
  }, { dark: true, delay });
}

/** Dust puffing up off broken ground: soft clouds that swell and settle. */
function dust(t: FxTools, at: Pt, n: number, size: number, spread: number, delay = 0) {
  const puffs = Array.from({ length: Math.max(1, Math.round(n * t.quality)) }, () => ({
    x: at.x + rand(-4, 4), y: at.y + rand(-3, 3), vx: rand(-1, 1) * spread, vy: -size * rand(0.5, 2.2), r: size * rand(0.6, 1), life: rand(0.6, 0.85),
  }));
  t.draw(0.9, (g, v) => {
    const time = v * 0.9;
    for (const p of puffs) {
      if (time >= p.life) continue;
      const q = time / p.life, a = q < 0.15 ? q / 0.15 : 1 - (q - 0.15) / 0.85, rr = p.r * (1 + q * 1.5);
      const x = p.x + p.vx * (1 - Math.exp(-time * 4)) * 0.25, y = p.y + p.vy * time;
      g.circle(x, y, rr).fill({ color: DUST, alpha: 0.14 * a }).circle(x, y, rr * 0.6).fill({ color: DUST, alpha: 0.18 * a });
    }
  }, { dark: true, delay });
}

export const OAKGRE: Signature = {
  shake: 1.4,
  // Rooted where it stands until this moment: nothing to lunge at, and the
  // tearing free is the move.
  lunge: false,

  land(t: FxTools, m: SigMoment) {
    const c = centre(m.from), s = m.size, a0 = rand(0, TAU);
    // THE ROOTS: five, from under the card out into the ground round it.
    const roots = Array.from({ length: 5 }, (_, i) => rootOf(c, a0 + (i / 5) * TAU + rand(-0.25, 0.25), s, 0.02 * i));
    heave(t, c, s, roots);
    const lift = (rt: Root, time: number) => easeOut(clamp01((time - rt.at - 0.06) / 0.2));
    /** A root at `time`: lifting out of the soil, the tip most — then broken:
     *  the stub drawn back into the trunk, the end thrown off tumbling. */
    const pieces = (rt: Root, time: number) => {
      const up = lift(rt, time) * s * 0.07;
      const line = rt.pts.map((v, j) => (j % 2 ? v - up * (0.2 + (0.8 * (j - 1)) / (2 * N)) : v));
      const hw = (f: number) => (rt.w / 2) * (1 - 0.75 * f) * (1 + 0.14 * Math.sin(f * 13 + rt.ph));
      const fhw = (f: number) => hw(rt.fork.at) * 0.68 * (1 - 0.75 * f);
      if (time < rt.snap) return { line, hw, stub: body(line, 0, N, hw), stubTo: N, fork: body(forkLine(rt, line), 0, N, fhw), end: null as number[] | null, endA: 0 };
      const q = time - rt.snap, ib = rt.brk * N, stubTo = ib * (1 - easeOut(clamp01(q / 0.28)));
      const b = onLine(line, ib), ca = Math.cos(rt.spin * q), sa = Math.sin(rt.spin * q), v = rt.fly * (s / 90);
      const end = q < 0.45 ? body(line, ib, N, hw, (x, y) => {
        const px = x - b.x, py = y - b.y;
        return { x: b.x + px * ca - py * sa + rt.out.x * v * q, y: b.y + px * sa + py * ca + rt.out.y * v * q - 120 * (s / 90) * q + 700 * (s / 90) * q * q };
      }) : null;
      return { line, hw, stub: stubTo > 0.4 ? body(line, 0, stubTo, hw) : null, stubTo,
        fork: rt.fork.at * N < stubTo ? body(forkLine(rt, line), 0, N * clamp01((stubTo - rt.fork.at * N) / (N * 0.3)), fhw) : null,
        end, endA: 1 - q / 0.45 };
    };
    /** How far the bark shows through the soil: faint while buried, whole
     *  once the soil has split off it. */
    const bare = (rt: Root, time: number) => 0.3 + 0.7 * lift(rt, time);
    const D = 1.0;
    t.draw(D, (g, v) => {
      const time = v * D;
      for (const rt of roots) {
        // The soil humped over it, splitting into the furrow it leaves.
        const k = lift(rt, time), a = clamp01(time / 0.05), gone = 1 - clamp01((time - 0.6) / 0.4);
        g.poly(rt.pts, false).stroke({ width: rt.w * (1.6 - 0.9 * k), color: SOIL, alpha: 0.8 * a * gone, cap: "round", join: "round" });
        const p = pieces(rt, time), ba = bare(rt, time) * a;
        // Bark, round: a mid-brown body, a shadowed underside, a lit back.
        for (const shape of [p.fork, p.stub]) {
          if (!shape) continue;
          g.poly(shape, true).fill({ color: BARK, alpha: 0.97 * ba });
        }
        if (p.stub) {
          g.poly(body(p.line, 0, p.stubTo, (f) => p.hw(f) * 0.45, (x, y) => ({ x, y: y + p.hw(0) * 0.35 })), true).fill({ color: BARK_LO, alpha: 0.8 * ba });
          const back = p.line.slice(0, (Math.floor(p.stubTo) + 1) * 2).map((x, j) => (j % 2 ? x - rt.w * 0.16 : x));
          g.poly(back, false).stroke({ width: Math.max(1.2, rt.w * 0.13), color: BARK_HI, alpha: 0.8 * ba, cap: "round", join: "round" });
        }
        for (const shape of [p.fork, p.stub]) if (shape) g.poly(shape, true).stroke({ width: 1.3, color: BARK_EDGE, alpha: 0.9 * ba });
        if (p.end) g.poly(p.end, true).fill({ color: BARK, alpha: 0.97 * p.endA }).stroke({ width: 1.3, color: BARK_EDGE, alpha: 0.9 * p.endA });
      }
    }, { dark: true });
    // The light: the soil's lit crest over each root, splitting; moss and the
    // amber in the grain once it is bare; the raw wood hot where it broke.
    t.draw(D, (g, v) => {
      const time = v * D;
      for (const rt of roots) {
        const k = lift(rt, time), a = clamp01(time / 0.05), gone = 1 - clamp01((time - 0.6) / 0.4), off = rt.w * (0.8 - 0.45 * k);
        for (const side of [-1, 1])
          g.poly(rt.pts.map((x, j) => x + (j % 2 ? rt.out.x : -rt.out.y) * side * off), false).stroke({ width: 1, color: CLOD_LIT, alpha: 0.45 * a * gone });
        const p = pieces(rt, time);
        if (p.stub && k > 0.2) {
          g.poly(p.line.slice(0, (Math.floor(p.stubTo) + 1) * 2), false).stroke({ width: 1, color: AMBER, alpha: 0.45 * k });
          for (const f of [0.18, 0.36, 0.55]) {
            if (f * N > p.stubTo) break;
            const q = onLine(p.line, f * N);
            g.circle(q.x, q.y - p.hw(f) * 0.45, rt.w * 0.14).fill({ color: MOSS, alpha: 0.6 * k });
          }
        }
        if (time >= rt.snap && p.stub) {
          const hot = 1 - clamp01((time - rt.snap) / 0.4), e = onLine(p.line, p.stubTo);
          g.circle(e.x, e.y, rt.w * 0.4).fill({ color: AMBER, alpha: 0.35 * hot });
          g.circle(e.x, e.y, rt.w * 0.17).fill({ color: GOLD, alpha: 0.9 * hot });
        }
      }
    });
    for (const rt of roots) {
      // Earth flung off each root as it rips up, most where the tip tears
      // out of the ground...
      const mid = onLine(rt.pts, N * 0.5), tip = onLine(rt.pts, N);
      clods(t, mid, 2, s, () => ({ x: rt.out.x * rand(20, 80) * (s / 90), y: -rand(100, 180) * (s / 90) }), rt.at + 0.1);
      clods(t, tip, 3, s, () => ({ x: rt.out.x * rand(60, 140) * (s / 90), y: rt.out.y * rand(30, 90) * (s / 90) - rand(120, 200) * (s / 90) }), rt.snap - 0.05);
      dust(t, tip, 2, s * 0.11, 35 * (s / 90), rt.snap - 0.05);
      // ...and splinters thrown where it snaps.
      t.later(rt.snap, () => {
        const b = onLine(rt.pts, rt.brk * N);
        const by = b.y - s * 0.07 * (0.2 + 0.8 * rt.brk);
        t.flash({ x: b.x, y: by }, AMBER, 0.07 * (s / 80));
        for (let i = 0; i < 5; i++) {
          const a = Math.atan2(rt.out.y, rt.out.x) + rand(-1.3, 1.3), sp = rand(120, 240) * (s / 90);
          t.spark(b.x, by, Math.cos(a) * sp, Math.sin(a) * sp - rand(40, 120) * (s / 90), rand(0.25, 0.45), SPLINTER);
        }
      });
    }
    surge(t, m.from, s);
  },
};

/** THE HEAVE: the ground round the card cracking between its roots as they
 *  strain, grit and dust thrown up all round. */
function heave(t: FxTools, c: Pt, s: number, roots: Root[]) {
  const paths: number[][] = [];
  // A crack out between each pair of roots, kinked and forking the way dry
  // ground splits — not a line.
  const angs = roots.map((r) => Math.atan2(r.out.y, r.out.x)).sort((a, b) => a - b);
  angs.forEach((a, i) => {
    const b = i + 1 < angs.length ? angs[i + 1] : angs[0] + TAU;
    let ang = (a + b) / 2 + rand(-0.15, 0.15), x = c.x + Math.cos(ang) * s * 0.52, y = c.y + Math.sin(ang) * s * 0.52;
    const pts = [x, y], len = s * rand(0.32, 0.45);
    for (let k = 0; k < 5; k++) {
      ang += rand(-0.7, 0.7);
      x += Math.cos(ang) * (len / 5);
      y += Math.sin(ang) * (len / 5);
      pts.push(x, y);
    }
    paths.push(pts);
    const fx = pts[4], fy = pts[5], fa = ang + (Math.random() < 0.5 ? -1 : 1) * rand(0.6, 1);
    paths.push([fx, fy, fx + Math.cos(fa) * len * 0.22, fy + Math.sin(fa) * len * 0.22, fx + Math.cos(fa + 0.3) * len * 0.38, fy + Math.sin(fa + 0.3) * len * 0.38]);
  });
  const drawn = (time: number) => clamp01(time / 0.1), cf = (time: number) => 1 - clamp01((time - 0.4) / 0.3);
  const part = (p: number[], f: number) => p.slice(0, Math.max(2, Math.round((p.length / 2) * f)) * 2);
  t.draw(0.8, (g, v) => {
    const time = v * 0.8;
    for (const p of paths) g.poly(part(p, drawn(time)), false).stroke({ width: Math.max(2, s * 0.035), color: SOIL, alpha: 0.85 * cf(time), join: "round" });
  }, { dark: true });
  t.draw(0.8, (g, v) => {
    const time = v * 0.8;
    for (const p of paths) g.poly(part(p, drawn(time)).map((x) => x - 1), false).stroke({ width: 1, color: CLOD_LIT, alpha: 0.4 * cf(time) });
  });
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU + rand(-0.3, 0.3);
    dust(t, { x: c.x + Math.cos(a) * s * 0.55, y: c.y + Math.sin(a) * s * 0.55 }, 2, s * 0.13, 40 * (s / 90));
  }
  for (let i = 0; i < Math.round(14 * t.quality); i++) {
    const a = rand(0, TAU), r = s * rand(0.5, 0.75);
    t.spark(c.x + Math.cos(a) * r, c.y + Math.sin(a) * r, Math.cos(a) * rand(30, 80) * (s / 90), -rand(80, 180) * (s / 90), rand(0.3, 0.5), GRIT);
  }
}

/** THE SURGE: green-gold power rising up through the card from its footing
 *  to its crown — the cracks in its bark lit amber below the rising front,
 *  leaves spiralling up round it, motes rising — and a ring of it settling
 *  out round its freed feet. */
function surge(t: FxTools, r: Box, s: number) {
  const c = centre(r), START = 0.36, RISE_T = 0.4, D = 0.85, END = D + 0.35;
  const bottom = r.y + r.h * 0.92, top = r.y + r.h * 0.08;
  const front = (time: number) => bottom - (bottom - top) * easeOut(clamp01((time - START) / RISE_T));
  // The cracks in its bark, as on the art: jagged seams up through the card.
  const veins = [0.27, 0.43, 0.58, 0.74].map((fx) => {
    const pts: number[] = [];
    let x = r.x + r.w * fx;
    for (let i = 0; i <= 7; i++) {
      pts.push(x, bottom - ((bottom - top) * i) / 7);
      x += rand(-1, 1) * s * 0.045;
    }
    return pts;
  });
  const glowA = (time: number) => (time < START ? 0 : time < 0.85 ? 1 : Math.max(0, 1 - (time - 0.85) / (END - 0.85)));
  t.draw(END, (g, v) => {
    const time = v * END, y = front(time), a = glowA(time);
    if (a <= 0) return;
    for (const p of veins) {
      // Lit from the bottom up to the rising front.
      const lit: number[] = [p[0], p[1]];
      for (let i = 2; i < p.length; i += 2) {
        if (p[i + 1] >= y) { lit.push(p[i], p[i + 1]); continue; }
        const f = (p[i - 1] - y) / (p[i - 1] - p[i + 1] || 1);
        lit.push(p[i - 2] + (p[i] - p[i - 2]) * f, y);
        break;
      }
      g.poly(lit, false).stroke({ width: 4, color: AMBER, alpha: 0.3 * a });
      g.poly(lit, false).stroke({ width: 1.4, color: GOLD, alpha: 0.9 * a });
    }
    // The front itself: a band of green-gold light climbing the card.
    if (time < START + RISE_T + 0.05) {
      const k = 1 - clamp01((time - START - RISE_T) / 0.05);
      g.rect(r.x, y - s * 0.09, r.w, s * 0.18).fill({ color: LIME, alpha: 0.16 * k });
      g.rect(r.x, y - s * 0.035, r.w, s * 0.07).fill({ color: GOLD, alpha: 0.3 * k });
    }
  });
  t.later(START, () => {
    t.glow(r, 0xd8f080, 0.38, 0.85, 1.1);
    t.ring(r, GOLD, 0.85, 1.2, 0.45, 2);
  });
  // Leaves spiralling up round it, nose first along the helix, dimmer when
  // they pass behind it.
  const n = 12, ph = rand(0, TAU), dir = Math.random() < 0.5 ? -1 : 1, LIFE = 0.62;
  const leaves = Array.from({ length: n }, (_, i) => ({ th: ph + (i / n) * TAU, at: START + (i % 6) * 0.04 + (i >= 6 ? 0.12 : 0),
    color: i % 3 === 0 ? GOLD : i % 3 === 1 ? LIME : GREEN }));
  t.draw(D, (g, v) => {
    const time = v * D;
    for (const lf of leaves) {
      const q = (time - lf.at) / LIFE;
      if (q <= 0 || q >= 1) continue;
      const th = lf.th + dir * q * TAU * 1.1, rad = s * (0.55 - 0.15 * q);
      const x = c.x + Math.cos(th) * rad, y = c.y + s * 0.4 - q * s * 1.15 + Math.sin(th) * rad * 0.3;
      const turn = Math.cos(th * 2 + q * 9), w = dir * TAU * 1.1;
      const heading = Math.atan2(-s * 1.15 + Math.cos(th) * rad * 0.3 * w, -Math.sin(th) * rad * w);
      leaf(g, x, y, s * 0.22, heading, 0.3 + 0.7 * Math.abs(turn), lf.color, Math.min(1, q * 8) * (1 - q * q) * (Math.sin(th) > 0 ? 1 : 0.5));
    }
  });
  let acc = 0, k = 0;
  t.draw(D, (_g, v, dt) => {
    const time = v * D;
    if (time < START || time > 0.95) return;
    acc += dt * 45 * t.quality;
    for (; acc >= 1; acc--)
      t.spark(r.x + rand(0.15, 0.85) * r.w, bottom - rand(0, 0.2) * r.h, rand(-15, 15) * (s / 90), -rand(60, 120) * (s / 90), rand(0.5, 0.8), k++ % 2 ? RISE : RISE_L);
  });
}
