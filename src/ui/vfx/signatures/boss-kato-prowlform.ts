/** KATO, PROWLFORM — Pounce. "Springs up to 2 slots onto a target for 11 DMG
 *  through shields and ELECTRIFIED for 2 rounds — then springs AGAIN at
 *  whatever is nearest where it landed. Either pounce that kills takes the
 *  victim's square" — it left the wheels in the crater and came on anyway.
 *
 *  The beast is drawn as what it is: a panther of ROCK with lightning in its
 *  seams — solid stone on the normal-blend layer, as BORE draws stone (a
 *  mid-brown body, a lit back, a dark edge), with white-violet lightning
 *  crackling down its spine and legs and an eye burning. It leaps in a real
 *  arc: up off the ground and down again, pitched nose-up as it rises and
 *  nose-down as it drops, over its own shadow sliding along the ground below.
 *
 *  The DELIVERY is the first spring. It crouches on its square with the charge
 *  building in it, kicks off — the ground cracking under it — and arcs onto
 *  the first card, landing on it as the delivery ends.
 *
 *  The LANDING is the rest of the Special, in the order the rules give it:
 *  the claws rake the first card — three grooves cut into it, lightning
 *  running in them, stone chips and dust thrown up, the card crackling (the
 *  ELECTRIFIED) — and it springs AGAIN, off the card and onto the second,
 *  which takes the same; then a last short bound to wherever it ends, where
 *  it settles in a puff of dust. A kill shatters more stone. */
import { centre, rand } from "../looks/base";
import type { Graphics } from "pixi.js";
import type { FxTools, Pt, SparkStyle } from "../looks/types";
import type { Signature } from "./types";

type Box = { x: number; y: number; w: number; h: number };

const TAU = Math.PI * 2;
// Stone, on the normal-blend layer: real colour, as BORE draws it.
const ROCK = 0x8a7461, ROCK_HI = 0xcfb592, ROCK_LO = 0x4e3e31, EDGE = 0x241a13, CRACK = 0x0e0906, DUST = 0xb89e80;
// Light: grit, the lit lip of a groove, and the lightning in it.
const SAND = [0xfff1dc, 0xe8cfa8, 0xd9b48a, 0xa1887f], LIT = 0xd9bf98;
const WHITE = 0xffffff, LAV = 0xe3d8ff, VIO = 0x9575ff;

/** Static: darts out hard and stops dead. */
const SNAP: SparkStyle = { palette: [WHITE, LAV, VIO], gravity: 0, drag: 0.001, size: [6, 1.5], streak: true };

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
/** 0 -> 1 as `u` runs from `a` to `b`. */
const span = (u: number, a: number, b: number) => clamp01((u - a) / (b - a));
/** One flicker beat, s: lightning is re-drawn on this clock, not the frame's. */
const BEAT = 0.035;

// ── Lightning ───────────────────────────────────────────────────────────────

/** A lightning channel from a to b, kinked by up to `jag` px — a fresh one
 *  every beat, so it crackles. */
function channel(ax: number, ay: number, bx: number, by: number, segs: number, jag: number): number[] {
  const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len, out = [ax, ay];
  let off = 0;
  for (let i = 1; i < segs; i++) {
    off = off * 0.5 + rand(-1, 1);
    const f = i / segs, o = off * jag * Math.sqrt(Math.sin(Math.PI * f));
    out.push(ax + dx * f + nx * o, ay + dy * f + ny * o);
  }
  out.push(bx, by);
  return out;
}

/** Lightning stroked: a violet halo under a white-hot core. Traced, never
 *  handed to `poly`, since the arrays are re-rolled. */
function lightning(g: Graphics, paths: number[][], width: number, alpha: number) {
  if (alpha <= 0.02 || !paths.length) return;
  const trace = () => {
    for (const p of paths) {
      g.moveTo(p[0], p[1]);
      for (let i = 2; i < p.length; i += 2) g.lineTo(p[i], p[i + 1]);
    }
  };
  trace();
  g.stroke({ width: width * 4, color: VIO, alpha: 0.3 * alpha, join: "round", cap: "round" });
  trace();
  g.stroke({ width, color: WHITE, alpha, join: "bevel", cap: "round" });
}

// ── The beast ───────────────────────────────────────────────────────────────

/** A panther mid-leap, side on: (forward, up) in units of its size, nose
 *  near the origin — ear pricked, the long back, the tail up behind it, a
 *  hind leg driving back and a foreleg reaching forward with the claws out.
 *  The first ten points are its back (lit), the rest its underside. */
const CAT = [0.02, 0.04, -0.08, 0.16, -0.16, 0.3, -0.24, 0.17, -0.5, 0.17, -0.9, 0.2, -1.2, 0.13, -1.45, 0.26, -1.65, 0.36,
  -1.5, 0.18, -1.28, 0.02, -1.52, -0.14, -1.72, -0.2, -1.48, -0.24, -1.12, -0.12, -0.7, -0.14, -0.45, -0.16, 0.1, -0.32,
  0.2, -0.27, 0.06, -0.2, -0.2, -0.1, -0.04, -0.03];
/** How big it is, in squares: a boss, bigger than a card. */
const BODY = 0.64;
/** Its middle, so a leap can be aimed by the body rather than the nose. */
const MID = -0.8;

/** Where each point of the beast is: at `c` (its middle), `size` big, facing
 *  `side`, pitched `pitch` (nose down positive) — plus where its eye is. */
function beast(c: Pt, side: number, pitch: number, size: number) {
  const fx = side * Math.cos(pitch), fy = Math.sin(pitch), hx = side * Math.sin(pitch), hy = -Math.cos(pitch);
  const P = (f: number, h: number): Pt => ({ x: c.x + fx * (f - MID) * size + hx * h * size, y: c.y + fy * (f - MID) * size + hy * h * size });
  const pts: number[] = [];
  for (let i = 0; i < CAT.length; i += 2) { const q = P(CAT[i], CAT[i + 1]); pts.push(q.x, q.y); }
  return { pts, P, eye: P(-0.1, 0.1) };
}

/** The stone of it: body, a pale lit band along its back, a shadowed belly
 *  and a dark edge. */
function stone(g: Graphics, b: ReturnType<typeof beast>, a: number) {
  if (a <= 0.01) return;
  g.poly(b.pts).fill({ color: ROCK, alpha: a });
  const back: number[] = [], belly: number[] = [];
  for (let i = 0; i <= 9; i++) { const q = b.P(CAT[2 * i], CAT[2 * i + 1] - 0.05); back.push(q.x, q.y); }
  for (let i = 14; i <= 17; i++) { const q = b.P(CAT[2 * i], CAT[2 * i + 1] + 0.05); belly.push(q.x, q.y); }
  g.poly(back, false).stroke({ width: 3, color: ROCK_HI, alpha: 0.85 * a, cap: "round", join: "round" });
  g.poly(belly, false).stroke({ width: 3, color: ROCK_LO, alpha: 0.8 * a, cap: "round", join: "round" });
  g.poly(b.pts).stroke({ width: 1.8, color: EDGE, alpha: a, join: "round" });
}

/** The storm in it: lightning down its spine and its reaching foreleg, a
 *  burning eye, and a faint charge round its outline. `veins` is re-rolled by
 *  the caller every beat. */
function storm(g: Graphics, b: ReturnType<typeof beast>, veins: number[][], size: number, a: number) {
  if (a <= 0.01) return;
  g.poly(b.pts).stroke({ width: 1.2, color: LAV, alpha: 0.22 * a });
  lightning(g, veins, 1.1, 0.8 * a * rand(0.6, 1));
  g.circle(b.eye.x, b.eye.y, size * 0.13).fill({ color: VIO, alpha: 0.45 * a });
  g.circle(b.eye.x, b.eye.y, Math.max(1.3, size * 0.05)).fill({ color: WHITE, alpha: a });
}

function veinsOf(b: ReturnType<typeof beast>, size: number): number[][] {
  const sp0 = b.P(-0.3, 0.06), sp1 = b.P(-1.15, 0.02), l0 = b.P(-0.4, -0.08), l1 = b.P(0.14, -0.27);
  return [channel(sp0.x, sp0.y, sp1.x, sp1.y, 6, size * 0.1), channel(l0.x, l0.y, l1.x, l1.y, 4, size * 0.08)];
}

/** One spring, from `a` to `b` over `dur` s after `delay`: a real arc, up off
 *  the ground and down again, `H` high at the top (screen-up — height, not
 *  "ahead"), pitched with its path, over its shadow sliding along the ground;
 *  landing its middle on `b`. `fadeOut` thins it away as it lands (the last
 *  bound, into the square it ends on). */
function spring(t: FxTools, a: Pt, b: Pt, s: number, delay: number, dur: number, H: number, fadeOut = false) {
  const size = s * BODY, side = b.x < a.x - s * 0.05 ? -1 : 1;
  const at = (f: number) => {
    const h = H * 4 * f * (1 - f), x = a.x + (b.x - a.x) * f, y = a.y + (b.y - a.y) * f;
    const vx = b.x - a.x, vy = b.y - a.y - H * 4 * (1 - 2 * f);
    const pitch = Math.max(-0.8, Math.min(0.8, Math.atan2(vy, Math.abs(vx) + s * 0.8)));
    return { ground: { x, y }, h, pitch };
  };
  // Every spring carries on from a beast already there (the crouch, or the
  // last spring), so none fades in; only the last bound thins away.
  const alpha = (f: number) => (fadeOut ? 1 - span(f, 0.75, 1) : 1);
  t.draw(dur, (g, u) => {
    const { ground, h, pitch } = at(u), sh = 1 - Math.min(1, h / (H + 1)) * 0.6;
    g.ellipse(ground.x, ground.y + s * 0.2, s * 0.42 * sh, s * 0.14 * sh).fill({ color: CRACK, alpha: 0.45 * sh * alpha(u) });
    stone(g, beast({ x: ground.x, y: ground.y - h }, side, pitch, size), alpha(u));
  }, { dark: true, delay });
  let beat = -1, veins: number[][] = [];
  t.draw(dur, (g, u) => {
    const { ground, h, pitch } = at(u), bb = beast({ x: ground.x, y: ground.y - h }, side, pitch, size);
    const b0 = Math.floor((u * dur) / BEAT);
    if (b0 !== beat) { beat = b0; veins = veinsOf(bb, size); }
    const sh = 1 - Math.min(1, h / (H + 1)) * 0.6;
    g.ellipse(ground.x, ground.y + s * 0.2, s * 0.42 * sh, s * 0.14 * sh).stroke({ width: 1.2, color: LIT, alpha: 0.5 * sh * alpha(u) });
    storm(g, bb, veins, size, alpha(u));
  }, { delay });
}

// ── What its claws do ───────────────────────────────────────────────────────

interface Chunk { x: number; y: number; vx: number; vy: number; rot: number; vr: number; size: number; rk: number[]; life: number }

/** Chips of stone knocked out of a card: up and out, spinning, dropping back
 *  to bounce once on `floor` — solid rock, fading at the end. */
function chips(t: FxTools, at: Pt, n: number, s: number, floor: number) {
  const k = s / 90, cs: Chunk[] = [];
  for (let i = 0; i < Math.max(1, Math.round(n * t.quality)); i++) {
    const a = rand(-Math.PI * 0.95, -Math.PI * 0.05), v = rand(160, 330) * k, rk: number[] = [];
    const a0 = rand(0, TAU), m = 5 + Math.floor(rand(0, 3));
    for (let j = 0; j < m; j++) rk.push(a0 + (j / m) * TAU + rand(-0.25, 0.25), rand(0.72, 1));
    cs.push({ x: at.x + rand(-0.1, 0.1) * s, y: at.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, rot: rand(0, TAU), vr: rand(-9, 9),
      size: s * rand(0.05, 0.09), rk, life: rand(0.5, 0.72) });
  }
  let age = 0;
  t.draw(0.72, (g, _u, dt) => {
    age += dt;
    for (const c of cs) {
      if (age >= c.life) continue;
      c.vy += 1500 * k * dt;
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      c.rot += c.vr * dt;
      if (c.y > floor && c.vy > 0) { c.y = floor; c.vy *= -0.3; c.vx *= 0.55; c.vr *= 0.5; }
      const a = age > c.life * 0.7 ? 1 - (age - c.life * 0.7) / (c.life * 0.3) : 1, pts: number[] = [];
      for (let j = 0; j < c.rk.length; j += 2) pts.push(c.x + Math.cos(c.rk[j] + c.rot) * c.rk[j + 1] * c.size, c.y + Math.sin(c.rk[j] + c.rot) * c.rk[j + 1] * c.size);
      g.poly(pts).fill({ color: ROCK, alpha: a }).stroke({ width: 1, color: EDGE, alpha: a });
    }
  }, { dark: true });
}

/** Dust rolling out low from a point and settling — earth does not rise. */
function dust(t: FxTools, at: Pt, n: number, s: number) {
  const puffs = Array.from({ length: Math.max(1, Math.round(n * t.quality)) }, (_, i) => ({
    x: at.x + rand(-4, 4), y: at.y, r: s * rand(0.1, 0.16), vx: (i % 2 ? 1 : -1) * rand(0.4, 1) * s * 0.9, vy: -rand(4, 20), life: rand(0.6, 0.9),
  }));
  t.draw(0.9, (g, u) => {
    const time = u * 0.9;
    for (const p of puffs) {
      if (time >= p.life) continue;
      const q = time / p.life, e = (1 - Math.exp(-2.1 * time)) / 2.1;
      const x = p.x + p.vx * e, y = p.y + p.vy * time, rr = p.r * (1 + q * 1.6), a = q < 0.15 ? q / 0.15 : 1 - (q - 0.15) / 0.85;
      g.circle(x, y, rr).fill({ color: DUST, alpha: 0.15 * a }).circle(x, y, rr * 0.62).fill({ color: DUST, alpha: 0.2 * a });
    }
  }, { dark: true });
}

/** The claws raking a card, along `dir` (the way it sprang): three grooves
 *  cut into it — dark, with the broken lip catching the light — lightning
 *  running in them, a flash, the card left crackling (ELECTRIFIED), stone
 *  chipped out of it and dust thrown up. A kill breaks more. */
function rake(t: FxTools, r: Box, dir: number, power: number, killed: boolean) {
  const p = centre(r), s = Math.min(r.w, r.h), k = s / 90, kk = Math.max(0.8, Math.min(1.6, power)) * (killed ? 1.2 : 1);
  const ux = Math.cos(dir + 0.35), uy = Math.sin(dir + 0.35), nx = -uy, ny = ux, L = s * 0.44 * kk, gap = s * 0.17;
  const grooves = [-1, 0, 1].map((i) => {
    const pts: number[] = [];
    for (let j = 0; j <= 6; j++) {
      const f = j / 6, bow = Math.sin(Math.PI * f) * s * 0.08, jag = j && j < 6 ? rand(-1.5, 1.5) : 0;
      pts.push(p.x + nx * (gap * i - bow + jag) + ux * L * (2 * f - 1), p.y + ny * (gap * i - bow + jag) + uy * L * (2 * f - 1));
    }
    return pts;
  });
  const cut = (g: Graphics, pts: number[], f: number) => {
    const n = Math.max(2, Math.round(7 * f));
    g.moveTo(pts[0], pts[1]);
    for (let j = 1; j < n; j++) g.lineTo(pts[2 * j], pts[2 * j + 1]);
  };
  const D = 0.62;
  t.draw(D, (g, u) => {
    const time = u * D, a = 1 - span(time, 0.35, D);
    grooves.forEach((pts, i) => {
      cut(g, pts, span(time, i * 0.02, i * 0.02 + 0.07));
      g.stroke({ width: 4.5 * kk, color: CRACK, alpha: 0.85 * a, cap: "round", join: "round" });
    });
  }, { dark: true });
  let beat = -1, bolts: number[][] = [];
  t.draw(D, (g, u) => {
    const time = u * D, a = 1 - span(time, 0.35, D);
    grooves.forEach((pts, i) => {
      const lip: number[] = [];
      const f = span(time, i * 0.02, i * 0.02 + 0.07);
      for (let j = 0; j < Math.max(2, Math.round(7 * f)); j++) lip.push(pts[2 * j] - 1, pts[2 * j + 1] - 1.5);
      if (lip.length >= 4) g.poly(lip, false).stroke({ width: 1.2, color: LIT, alpha: 0.6 * a });
    });
    // Lightning running in the grooves, flickering out.
    const b = Math.floor(time / BEAT);
    if (b !== beat) {
      beat = b;
      bolts = grooves.map((pts) => channel(pts[0], pts[1], pts[12], pts[13], 5, s * 0.05));
    }
    lightning(g, bolts, 1.6, (1 - span(time, 0.08, 0.34)) * (b % 3 === 1 ? 0.35 : 1));
  });
  t.flash(p, LAV, 0.8 * kk);
  t.arcs(p, [WHITE, LAV, VIO], 0.5 * kk, 5);
  t.glow(r, LAV, 0.25, 0.3, 1.0);
  for (let i = 0; i < Math.round(8 * kk * t.quality); i++) {
    const a = rand(0, TAU), v = rand(220, 400) * k;
    t.spark(p.x, p.y, Math.cos(a) * v, Math.sin(a) * v, rand(0.1, 0.22), SNAP);
  }
  t.emit({ count: Math.round(10 * kk), palette: SAND, from: { x: p.x - s * 0.3, y: p.y - s * 0.05, w: s * 0.6, h: s * 0.1 },
    dir: [-150, -30], speed: [80, 200], gravity: 950, drag: 0.6, life: [0.3, 0.55], size: [5, 2] });
  chips(t, { x: p.x, y: p.y + s * 0.1 }, (killed ? 8 : 5) * kk, s, p.y + s * 0.35);
  dust(t, { x: p.x, y: p.y + s * 0.3 }, killed ? 6 : 4, s);
  if (killed) t.ring(r, LIT, 0.4, 1.6, 0.45, 4);
}

export const KATO_PROWLFORM: Signature = {
  shake: 1.8,
  // It does not lunge: it springs, and the spring is drawn.
  lunge: false,

  deliver(t: FxTools, m, seconds) {
    const T = seconds, s = m.size, c0 = centre(m.from), p1 = centre(m.targets[0]);
    const CROUCH = 0.3, size = s * BODY, side = p1.x < c0.x - s * 0.05 ? -1 : 1;

    // THE CROUCH: the beast on its square, low, the charge building in it.
    t.draw(T * CROUCH, (g, u) => stone(g, beast({ x: c0.x, y: c0.y + s * 0.06 }, side, 0.15, size), Math.min(1, u * 5)), { dark: true });
    let beat = -1, veins: number[][] = [];
    t.draw(T * CROUCH, (g, u) => {
      const bb = beast({ x: c0.x, y: c0.y + s * 0.06 }, side, 0.15, size), b = Math.floor((u * T * CROUCH) / BEAT);
      if (b !== beat) { beat = b; veins = veinsOf(bb, size * (0.6 + 0.6 * u)); }
      storm(g, bb, veins, size, Math.min(1, u * 5) * (0.5 + 0.5 * u));
    });
    t.emit({ count: 12, palette: [WHITE, LAV, VIO], from: m.from, at: "ring", speed: [140, 220], gravity: 0, drag: 1,
      life: [0.1, T * CROUCH], size: [6, 1.5], streak: true });

    // THE SPRING: kicking off — the ground cracks under it — and arcing onto
    // the first card, landing on it as the delivery ends.
    const dist = Math.hypot(p1.x - c0.x, p1.y - c0.y);
    spring(t, c0, p1, s, T * CROUCH, T * (1 - CROUCH), s * 0.7 + dist * 0.3);
    t.later(T * CROUCH, () => {
      dust(t, { x: c0.x, y: c0.y + s * 0.3 }, 4, s);
      t.emit({ count: 10, palette: SAND, from: { x: c0.x - s * 0.3, y: c0.y + s * 0.2, w: s * 0.6, h: s * 0.1 }, dir: [-160, -20],
        speed: [80, 180], gravity: 950, drag: 0.6, life: [0.3, 0.5], size: [5, 2] });
    });
  },

  land(t: FxTools, m) {
    const s = m.size, c0 = centre(m.from), end = centre(m.to);
    if (!m.targets.length) return;
    const p1 = centre(m.targets[0]), p2 = m.targets.length > 1 ? centre(m.targets[1]) : null;
    // THE FIRST CARD: raked where it landed.
    rake(t, m.targets[0], Math.atan2(p1.y - c0.y, p1.x - c0.x), m.power[0] ?? 1, m.killed[0] ?? false);
    let last = p1, at = 0;
    if (p2) {
      // AND AGAIN: off the card and onto the second, which takes the same.
      const d = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      spring(t, p1, p2, s, 0, 0.3, s * 0.55 + d * 0.28);
      t.later(0.3, () => rake(t, m.targets[1], Math.atan2(p2.y - p1.y, p2.x - p1.x), m.power[1] ?? 1, m.killed[1] ?? false));
      last = p2;
      at = 0.3;
    } else {
      // Only the one: it holds on the card a beat before it moves off.
      spring(t, p1, p1, s, 0, 0.12, 0);
      at = 0.12;
    }
    // THE LAST BOUND: to wherever it ends, settling there in its dust.
    const hop = Math.hypot(end.x - last.x, end.y - last.y);
    if (hop > s * 0.3) {
      spring(t, last, end, s, at, 0.2, s * 0.3, true);
      t.later(at + 0.2, () => dust(t, { x: end.x, y: end.y + s * 0.3 }, 3, s));
    } else spring(t, last, last, s, at, 0.16, 0, true);
  },
};
