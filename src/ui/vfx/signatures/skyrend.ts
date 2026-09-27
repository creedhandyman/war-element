/** SKYREND — Dive Bomb. "Dive up to 3 spaces in any direction onto your
 *  target, deal 24 DMG (+5 splash) and WEAKEN it for 2 rounds, taking 25%
 *  recoil, then vanish into STEALTH until next round. A kill leaves Skyrend
 *  standing in its place" — he comes down out of his own sky.
 *
 *  The DELIVERY is a stoop, in the three beats a falconer would know, and it
 *  is drawn as Skyrend AND his shadow: the higher he is, the further the one
 *  rides above the other, and the smaller and fainter the shadow. He CLIMBS
 *  off his square on a column of wind, wings beating; he crosses high over
 *  the board, his shadow sliding over the ground beneath him to the card he
 *  has chosen, a ring closing on it; then the STOOP — wings folded into a
 *  dart, the wind corkscrewing round the line he cuts, bird and shadow closing
 *  on each other until his beak meets the card on the frame the blow lands.
 *
 *  The LANDING is the crater: a shockwave and a blast of wind thrown out flat
 *  from where he struck, a dark crater punched into the card with cracks run
 *  out from it, dust rolled out in a ring, and his own pale-gold feathers flung
 *  up and fluttering down. Anything beside it (the +5 splash) takes the edge of
 *  the blast. The recoil throws him back to where he ends — beside the card, or,
 *  when the dive killed it, standing in its crater — and the dust hangs over
 *  him there as he goes to STEALTH: gone before it decides which way to fall.
 *
 *  Height is drawn as screen-up, the way any top-down view lifts a thing off
 *  the ground. `ahead` plays no part: he dives from wherever he climbed, in any
 *  direction, and the board's flip does not move the sky. */
import { centre, rand } from "../looks/base";
import type { Graphics } from "pixi.js";
import type { FxTools, Pt, SparkStyle } from "../looks/types";
import type { Signature } from "./types";

type Box = { x: number; y: number; w: number; h: number };

const TAU = Math.PI * 2;
const CREAM = 0xfffaf0, PEACH = 0xffd9a0, APRICOT = 0xffc070, AMBER = 0xffa040, RUST = 0xd9701a;
/** His feathers, pale gold: not GALE's dust colours, so they read as HIM. */
const QUILL = 0xfff8e4, GILT = 0xffd98a;
/** His shadow and the crater — only ever on the dark layer. */
const INK = 0x0c0906;

/** Dust in the wind he makes, curling round where it was blown off. */
const EDDY: SparkStyle = { palette: [CREAM, PEACH, AMBER], gravity: -20, drag: 0.35, size: [6, 2], streak: true, swirl: 650 };
/** Dust rolled out flat from the crater: heavy, low, slowing hard. */
const DUST: SparkStyle = { palette: [PEACH, APRICOT, AMBER, RUST], gravity: 40, drag: 0.2, size: [8, 3], streak: false };

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeOut = (x: number) => 1 - (1 - x) * (1 - x);
/** 0 -> 1 as `u` runs from `a` to `b`. */
const span = (u: number, a: number, b: number) => clamp01((u - a) / (b - a));
/** The shortest turn from angle `a` to `b`. */
const turn = (a: number, b: number) => Math.atan2(Math.sin(b - a), Math.cos(b - a));

/** The card the dive was aimed at: the one that took the most. The targets
 *  come in the order the engine touched them, so the splash can come first. */
function mainOf(power: number[]): number {
  let best = 0;
  for (let i = 1; i < power.length; i++) if (power[i] > power[best]) best = i;
  return best;
}

// ── The flight ──────────────────────────────────────────────────────────────

/** How high he climbs, in squares — drawn as screen-up. */
const HIGH = 1.6;
/** Fractions of the delivery: straight up until CLIMB, across the sky until
 *  STOOP, then down. */
const CLIMB = 0.3, STOOP = 0.6;

/** Where he is `u` (0..1) into the delivery: the point on the ground under
 *  him and his height over it. Up off his own square, fast and then hanging at
 *  the top; across, a little higher mid-way, easing in over a spot a touch
 *  back toward where he came from (so the dive's slant says which way he
 *  came); then the stoop, falling faster every frame onto the card. */
function flight(c0: Pt, p: Pt, s: number, u: number): { gx: number; gy: number; h: number } {
  const H = s * HIGH;
  const ox = p.x + (c0.x - p.x) * 0.12, oy = p.y + (c0.y - p.y) * 0.12;
  if (u < CLIMB) return { gx: c0.x, gy: c0.y, h: H * easeOut(u / CLIMB) };
  if (u < STOOP) {
    const v = (u - CLIMB) / (STOOP - CLIMB), e = v * v * (3 - 2 * v);
    return { gx: c0.x + (ox - c0.x) * e, gy: c0.y + (oy - c0.y) * e, h: H * (1 + 0.15 * Math.sin(Math.PI * v)) };
  }
  const v = Math.min(1, (u - STOOP) / (1 - STOOP));
  return { gx: ox + (p.x - ox) * v, gy: oy + (p.y - oy) * v, h: H * (1 - v * v) };
}

/** Where the eye sees him: his ground point lifted by his height. */
function seen(c0: Pt, p: Pt, s: number, u: number): Pt {
  const f = flight(c0, p, s, u);
  return { x: f.gx, y: f.gy - f.h };
}

// ── Skyrend himself ──────────────────────────────────────────────────────────

/** His outline's right half, beak to tail, as (back, out) in units of his
 *  length and half-span: wings SPREAD for the climb... */
const SPREAD = [0, 0, -0.12, 0.12, -0.2, 0.18, -0.16, 0.62, -0.4, 1, -0.5, 0.66, -0.46, 0.3, -0.6, 0.14, -0.95, 0.24, -0.9, 0];
/** ...and FOLDED back along the body into a dart for the stoop. */
const TUCKED = [0, 0, -0.12, 0.1, -0.2, 0.16, -0.45, 0.34, -1, 0.44, -0.8, 0.26, -0.62, 0.16, -0.7, 0.1, -0.9, 0.1, -0.86, 0];

/** Skyrend as the eye catches him at speed: a raptor's silhouette, beak
 *  first. (x, y) is his beak, (ux, uy) the way he flies, `len` beak to tail,
 *  `half` his half-span, and `tuck` 0..1 folds the wings from spread to a
 *  dart. Mirrored from one half, so the outline is always clean. */
function raptor(x: number, y: number, ux: number, uy: number, len: number, half: number, tuck: number): number[] {
  const nx = -uy, ny = ux, n = SPREAD.length / 2, out: number[] = [];
  const at = (i: number, side: number) => {
    const f = SPREAD[2 * i] + (TUCKED[2 * i] - SPREAD[2 * i]) * tuck;
    const w = (SPREAD[2 * i + 1] + (TUCKED[2 * i + 1] - SPREAD[2 * i + 1]) * tuck) * side;
    out.push(x + ux * f * len + nx * w * half, y + uy * f * len + ny * w * half);
  };
  for (let i = 0; i < n; i++) at(i, 1);
  for (let i = n - 2; i >= 1; i--) at(i, -1);
  return out;
}

/** Lit by his own speed: a pale-gold body with a bright edge. */
function drawRaptor(g: Graphics, pts: number[], a: number) {
  if (a <= 0.01) return;
  g.poly(pts).fill({ color: GILT, alpha: 0.8 * a }).stroke({ width: 1.6, color: CREAM, alpha: a });
}

// ── Wind ────────────────────────────────────────────────────────────────────

/** A streak of wind out from `c` along `a`: the stretch [u0, u1] of its run
 *  from `r0` to `r1`, curling `bend` radians as it spends itself. Thin tail,
 *  bold head, so it reads as travelling. */
function gust(g: Graphics, c: Pt, a: number, r0: number, r1: number, bend: number, u0: number, u1: number,
  width: number, color: number, alpha: number) {
  if (u1 - u0 < 0.02 || alpha <= 0.01) return;
  const n = 10, all: number[] = [], head: number[] = [];
  for (let i = 0; i <= n; i++) {
    const f = u0 + ((u1 - u0) * i) / n, r = r0 + (r1 - r0) * f, th = a + bend * f * f;
    const x = c.x + Math.cos(th) * r, y = c.y + Math.sin(th) * r;
    all.push(x, y);
    if (i >= 6) head.push(x, y);
  }
  g.poly(all, false).stroke({ width: width * 0.5, color, alpha: alpha * 0.55, cap: "round" });
  g.poly(head, false).stroke({ width, color, alpha, cap: "round" });
}

/** Where a gust is, `age` into a run of `dur`: its head races out and its tail
 *  follows `lag` behind, so the streak passes through and is gone. */
function run(age: number, dur: number, lag: number): [number, number] {
  const head = easeOut(clamp01(age / dur)), tail = clamp01((age - lag) / dur);
  return [Math.min(head, tail * tail * (3 - 2 * tail)), head];
}

/** Air whirled round `c`: a streak from radius `rt` (its tail) turning through
 *  `len` radians to `rh` (its head), bold at the head. */
function whirl(g: Graphics, c: Pt, rt: number, rh: number, a: number, len: number, width: number, color: number, alpha: number) {
  if (alpha <= 0.01) return;
  const all: number[] = [], head: number[] = [];
  for (let i = 0; i <= 10; i++) {
    const f = i / 10, r = rt + (rh - rt) * f, th = a + len * f;
    all.push(c.x + Math.cos(th) * r, c.y + Math.sin(th) * r);
    if (i >= 6) head.push(c.x + Math.cos(th) * r, c.y + Math.sin(th) * r);
  }
  g.poly(all, false).stroke({ width: width * 0.5, color, alpha: alpha * 0.55, cap: "round" });
  g.poly(head, false).stroke({ width, color, alpha, cap: "round" });
}

/** Warm or pale by where a gust points, so a ring of them is not one flat
 *  colour. */
const tint = (a: number) => (Math.sin(a * 3) > 0 ? CREAM : PEACH);

// ── Feathers ────────────────────────────────────────────────────────────────

interface Feather { x: number; y: number; vx: number; vy: number; rot: number; spin: number; ph: number; len: number; life: number }

/** One feather: a pointed vane round its quill. */
function feather(g: Graphics, x: number, y: number, rot: number, len: number, a: number) {
  const ux = Math.cos(rot), uy = Math.sin(rot), nx = -uy, ny = ux, h = len / 2, w = len * 0.17;
  g.poly([
    x - ux * h, y - uy * h,
    x - ux * h * 0.2 + nx * w, y - uy * h * 0.2 + ny * w,
    x + ux * h * 0.55 + nx * w * 0.7, y + uy * h * 0.55 + ny * w * 0.7,
    x + ux * h, y + uy * h,
    x + ux * h * 0.5 - nx * w * 0.8, y + uy * h * 0.5 - ny * w * 0.8,
    x - ux * h * 0.25 - nx * w * 0.9, y - uy * h * 0.25 - ny * w * 0.9,
  ]).fill({ color: GILT, alpha: 0.7 * a });
  g.moveTo(x - ux * h * 1.15, y - uy * h * 1.15).lineTo(x + ux * h * 0.9, y + uy * h * 0.9)
    .stroke({ width: 1.2, color: QUILL, alpha: 0.95 * a });
}

/** Feathers torn loose from `at`: thrown out at `speed` (px/s on a 90px square,
 *  within the angle band `dir`, or all round) and up by `lift`, then caught by
 *  the air — a feather loses its speed at once and falls slow, rocking. Drawn,
 *  not sparks: a quill and a vane, which no round spark can pass for. */
function featherFall(t: FxTools, at: Pt, n: number, s: number, speed: [number, number], lift: number, D: number,
  dir?: [number, number]) {
  const k = s / 90, fs: Feather[] = [];
  const count = Math.max(1, Math.round(n * t.quality));
  for (let i = 0; i < count; i++) {
    const a = dir ? rand(dir[0], dir[1]) : rand(0, TAU), v = rand(speed[0], speed[1]) * k;
    fs.push({
      x: at.x + rand(-0.1, 0.1) * s, y: at.y + rand(-0.1, 0.1) * s, vx: Math.cos(a) * v, vy: Math.sin(a) * v - lift * k,
      rot: rand(0, TAU), spin: rand(-7, 7), ph: rand(0, TAU), len: s * rand(0.18, 0.25), life: D * rand(0.7, 1),
    });
  }
  t.draw(D, (g, u, dt) => {
    const time = u * D, keep = Math.pow(0.06, dt);
    for (const f of fs) {
      const q = time / f.life;
      if (q >= 1) continue;
      f.vx *= keep;
      f.vy = f.vy * keep + 260 * k * dt;
      f.x += f.vx * dt + Math.cos(time * 7 + f.ph) * 26 * k * dt;
      f.y += f.vy * dt;
      f.rot += f.spin * dt * Math.max(0.15, 1 - q * 2);
      feather(g, f.x, f.y, f.rot + 0.5 * Math.sin(time * 7 + f.ph), f.len, Math.min(1, (1 - q) * 2.5));
    }
  });
}

// ── The ground ──────────────────────────────────────────────────────────────

/** The crater he punches into a card: a lumpy disc `r` across. */
function crater(g: Graphics, c: Pt, r: number, seed: number): Graphics {
  const pts: number[] = [];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * TAU, rr = r * (1 + 0.13 * Math.sin(3 * a + seed) + 0.08 * Math.sin(7 * a - seed));
    pts.push(c.x + Math.cos(a) * rr, c.y + Math.sin(a) * rr * 0.86);
  }
  return g.poly(pts);
}

/** Cracks run out from a crater's rim: jagged lines from `r0` out to about
 *  `r1`, picked once so they hold still while they fade. */
function cracks(c: Pt, r0: number, r1: number, n: number): number[][] {
  const out: number[][] = [], a0 = rand(0, TAU);
  for (let i = 0; i < n; i++) {
    const a = a0 + (i / n) * TAU + rand(-0.25, 0.25), len = r1 * rand(0.7, 1), pts: number[] = [];
    for (let j = 0; j <= 3; j++) {
      const f = j / 3, rr = r0 + (len - r0) * f, jit = j === 0 ? 0 : rand(-0.24, 0.24);
      pts.push(c.x + Math.cos(a + jit) * rr, c.y + Math.sin(a + jit) * rr);
    }
    out.push(pts);
  }
  return out;
}

/** The first `f` of a polyline, as a path to stroke. */
function partial(g: Graphics, pts: number[], f: number): Graphics {
  const n = pts.length / 2 - 1, upto = f * n, last = Math.floor(upto);
  g.moveTo(pts[0], pts[1]);
  for (let i = 1; i <= last && i <= n; i++) g.lineTo(pts[2 * i], pts[2 * i + 1]);
  if (last < n) {
    const q = upto - last;
    g.lineTo(pts[2 * last] + (pts[2 * last + 2] - pts[2 * last]) * q, pts[2 * last + 1] + (pts[2 * last + 3] - pts[2 * last + 1]) * q);
  }
  return g;
}

export const SKYREND: Signature = {
  shake: 1.6,
  // He does not walk up to anything: he climbs, and the dive is drawn.
  lunge: false,

  deliver(t: FxTools, m, seconds) {
    const T = seconds, s = m.size, k = s / 90;
    const c0 = centre(m.from), p = centre(m.targets[mainOf(m.power)]);
    const H = s * HIGH;

    // THE CLIMB: wind lifting off his square, racing up past the card and
    // curling off the top, and a downbeat's dust thrown off it.
    const ups = [-0.32, -0.1, 0.12, 0.34].map((o, i) => ({ x: c0.x + o * s, at: [0.05, 0, 0.08, 0.02][i] * T, bend: o < 0 ? -0.55 : 0.55 }));
    t.draw(T * 0.55, (g, u) => {
      const age = u * T * 0.55;
      for (const w of ups) {
        const [u0, u1] = run(age - w.at, T * 0.3, T * 0.12);
        gust(g, { x: w.x, y: c0.y + s * 0.5 }, -Math.PI / 2, 0, s * 1.8, w.bend, u0, u1, 2.6, PEACH, 0.85);
      }
    });
    for (let i = 0; i < Math.round(16 * t.quality); i++) {
      const a = rand(0, TAU), v = rand(120, 220) * k;
      t.spark(c0.x + Math.cos(a) * s * 0.3, c0.y + s * 0.3 + Math.sin(a) * s * 0.12, Math.cos(a) * v, Math.sin(a) * v * 0.35,
        rand(0.25, 0.45), EDDY);
    }
    t.draw(T * 0.4, (g, u) => {
      g.ellipse(c0.x, c0.y + s * 0.32, s * (0.35 + 0.55 * easeOut(u)), s * (0.12 + 0.18 * easeOut(u)))
        .stroke({ width: 3 * (1 - u) + 1, color: PEACH, alpha: 0.75 * (1 - u) });
    });

    // HIS SHADOW on the ground under him: the higher he is, the smaller and
    // fainter; as he stoops it swells and darkens on the card, and a ring
    // closes on it.
    const shade = (u: number) => {
      const f = flight(c0, p, s, u), hh = Math.min(1, f.h / H);
      return { x: f.gx, y: f.gy + s * 0.1, r: s * (0.36 - 0.18 * hh), a: span(u, 0.02, 0.1) * (0.55 - 0.3 * hh) };
    };
    t.draw(T, (g, u) => {
      const sh = shade(u);
      g.ellipse(sh.x, sh.y, sh.r * 1.3, sh.r * 0.7).fill({ color: INK, alpha: sh.a });
    }, { dark: true });
    t.draw(T, (g, u) => {
      const sh = shade(u);
      if (sh.a > 0.01) g.ellipse(sh.x, sh.y, sh.r * 1.3, sh.r * 0.7).stroke({ width: 1.5, color: PEACH, alpha: Math.min(0.9, sh.a * 1.9) });
      const f = span(u, STOOP - 0.08, 1);
      if (f > 0) g.circle(p.x, p.y, s * (1.05 - 0.5 * easeOut(f))).stroke({ width: 2, color: AMBER, alpha: 0.75 * Math.min(1, f * 3) });
    });

    // SKYREND: up on the wind, beating; across high, gliding; then folded
    // into the stoop — turning (not snapping) toward wherever he is going,
    // with the path he flew streaming behind him. The beak is the point he
    // flies by, so it meets the card exactly as the delivery ends.
    let ang = -Math.PI / 2, acc = 0;
    t.draw(T, (g, u, dt) => {
      const time = u * T, here = seen(c0, p, s, u), next = seen(c0, p, s, Math.min(1, u + 0.03));
      if (Math.hypot(next.x - here.x, next.y - here.y) > 0.5) ang += turn(ang, Math.atan2(next.y - here.y, next.x - here.x)) * Math.min(1, dt * 24);
      const ux = Math.cos(ang), uy = Math.sin(ang);
      const fold = span(u, STOOP, STOOP + 0.14);
      const beat = u < STOOP ? Math.sin(time * 34) * (1 - 0.7 * span(u, CLIMB, CLIMB + 0.1)) : 0;
      const len = s * (0.5 + 0.14 * fold), half = s * (0.58 - 0.16 * fold) * (1 - 0.18 * beat);
      const a = Math.min(1, u * 12);
      // The way he came: his path for the last stretch, a bright line down
      // its middle and paler ones either side, never back past his square.
      const from = Math.max(0, u - 0.16), pts: number[] = [];
      for (let i = 0; i <= 10; i++) {
        const q = seen(c0, p, s, from + ((u - from) * i) / 10);
        pts.push(q.x, q.y);
      }
      const lanes = [0, -1, 1];
      for (const side of lanes) {
        const line: number[] = [];
        for (let i = 0; i <= 10; i++) {
          const j = Math.min(9, i), dx = pts[2 * j + 2] - pts[2 * j], dy = pts[2 * j + 3] - pts[2 * j + 1], dl = Math.hypot(dx, dy) || 1;
          const o = side * s * 0.14 * (i / 10);
          line.push(pts[2 * i] - (dy / dl) * o, pts[2 * i + 1] + (dx / dl) * o);
        }
        g.poly(line, false).stroke({ width: side ? 1.4 : 2, color: side ? PEACH : CREAM, alpha: (side ? 0.45 : 0.6) * a, cap: "round" });
      }
      // In the stoop the wind corkscrews round the line he cuts.
      if (fold > 0) {
        const back = Math.min(Math.hypot(here.x - pts[0], here.y - pts[1]), s * 1.8);
        for (let st = 0; st < 2; st++) {
          const cs: number[] = [];
          for (let i = 0; i <= 14; i++) {
            const d = (i / 14) * back + len * 0.6, amp = s * (0.08 + 0.14 * (d / (s * 1.8)));
            const w = amp * Math.sin((d / s) * 7 - time * 40 + st * Math.PI);
            cs.push(here.x - ux * d - uy * w, here.y - uy * d + ux * w);
          }
          g.poly(cs, false).stroke({ width: 2, color: st ? PEACH : CREAM, alpha: 0.75 * fold * a, cap: "round" });
        }
        acc += dt * 70 * t.quality;
        for (; acc >= 1; acc--) {
          const side = Math.random() < 0.5 ? -1 : 1, v = rand(40, 100) * k;
          t.spark(here.x - ux * len, here.y - uy * len, -uy * side * v - ux * v * 0.5, ux * side * v - uy * v * 0.5, rand(0.2, 0.35), EDDY);
        }
      }
      drawRaptor(g, raptor(here.x, here.y, ux, uy, len, half, 0.12 + 0.3 * Math.max(0, beat) + 0.76 * fold), a);
      if (fold > 0) g.circle(here.x, here.y, s * 0.06).fill({ color: CREAM, alpha: 0.9 * fold });
    });
    // The air under him building as he comes.
    t.later(T * 0.72, () => t.charge(p, s * 1.1, AMBER, 0.3, T * 0.28));
  },

  land(t: FxTools, m) {
    const s = m.size, k = s / 90, seed = rand(0, 100);
    const hit = m.targets.length ? mainOf(m.power) : -1;
    const r: Box = hit >= 0 ? m.targets[hit] : m.to;
    const p = centre(r), end = centre(m.to), half = Math.min(r.w, r.h) / 2;
    const kk = hit >= 0 ? Math.max(0.8, Math.min(1.8, m.power[hit])) : 0.8;

    // The line he came down, hanging in the air a moment.
    const top = seen(centre(m.from), p, s, STOOP);
    t.draw(0.18, (g, u) => {
      const f = 1 - u;
      g.moveTo(top.x + (p.x - top.x) * (0.2 + 0.7 * u), top.y + (p.y - top.y) * (0.2 + 0.7 * u)).lineTo(p.x, p.y)
        .stroke({ width: 3 * f + 1, color: CREAM, alpha: 0.8 * f });
    });

    // THE IMPACT: a flash, and a shockwave thrown out flat — out as far as
    // whatever the blast catches, and a little past it...
    let reach = s * 1.5;
    m.targets.forEach((tr, i) => {
      if (i !== hit) reach = Math.max(reach, Math.hypot(centre(tr).x - p.x, centre(tr).y - p.y) + s * 0.4);
    });
    t.flash(p, PEACH, 0.35 + 0.1 * kk);
    t.ring(r, CREAM, 0.7, reach / half, 0.45, 5);
    t.later(0.06, () => t.ring(r, AMBER, 0.5, (reach / half) * 0.75, 0.5, 3));
    // ...the crater punched into the card, cracks run out from it...
    const cr = s * 0.26 * Math.min(1.4, kk), lines = cracks(p, cr * 0.85, cr * 2.2, 7);
    const CD = 0.9;
    t.draw(CD, (g, u) => {
      const time = u * CD, grow = easeOut(span(time, 0, 0.07)), fade = 1 - span(time, 0.35, CD);
      crater(g, p, cr * (0.4 + 0.6 * grow), seed).fill({ color: INK, alpha: 0.6 * fade });
      for (const c of lines) partial(g, c, easeOut(span(time, 0.02, 0.14))).stroke({ width: 3, color: INK, alpha: 0.7 * fade, cap: "round" });
    }, { dark: true });
    t.draw(CD, (g, u) => {
      const time = u * CD, grow = easeOut(span(time, 0, 0.07)), fade = 1 - span(time, 0.35, CD);
      crater(g, p, cr * (0.4 + 0.6 * grow), seed).stroke({ width: 2, color: APRICOT, alpha: 0.8 * fade });
      for (const c of lines) partial(g, c, easeOut(span(time, 0.02, 0.14))).stroke({ width: 1, color: PEACH, alpha: 0.55 * fade });
    });
    // ...the wind of it blasting out flat all round, curling as it spends...
    const blasts = Array.from({ length: 8 }, (_, i) => ({
      a: seed + (i / 8) * TAU + rand(-0.2, 0.2), bend: rand(0.25, 0.5) * (i % 2 ? 1 : -1), at: rand(0, 0.05),
    }));
    t.draw(0.5, (g, u) => {
      const age = u * 0.5;
      for (const b of blasts) {
        const [u0, u1] = run(age - b.at, 0.26, 0.1);
        gust(g, p, b.a, s * 0.4, s * (0.85 + 0.3 * kk), b.bend, u0, u1, 3, tint(b.a), 0.9);
      }
    });
    // ...dust rolled out along the ground in a ring...
    const nd = Math.round(24 * kk * t.quality);
    for (let i = 0; i < nd; i++) {
      const a = (i / nd) * TAU + rand(-0.1, 0.1), v = rand(160, 300) * k;
      t.spark(p.x + Math.cos(a) * cr, p.y + Math.sin(a) * cr * 0.86, Math.cos(a) * v, Math.sin(a) * v * 0.86, rand(0.35, 0.6), DUST);
    }
    // ...and his feathers flung up out of it, fluttering down.
    featherFall(t, p, 7 * kk, s, [140, 300], 160, 1.15);

    // THE SPLASH: the edge of the blast over anything beside it, as the
    // shockwave reaches it.
    m.targets.forEach((tr, i) => {
      if (i === hit) return;
      const q = centre(tr), d = Math.hypot(q.x - p.x, q.y - p.y);
      const at = clamp01((d - half * 0.7) / Math.max(1, reach - half * 0.7));
      t.later(0.45 * (1 - Math.sqrt(1 - Math.min(0.98, at))), () => blastEdge(t, tr, p, m.power[i] ?? 0.7));
    });

    // THE RECOIL throws him back off the card to where he ends: a hop of wind
    // and a whirl as he sets down. On a kill he stays in the crater, and the
    // updraft of it lifts his feathers again.
    const hop = Math.hypot(end.x - p.x, end.y - p.y);
    if (hop > s * 0.3) {
      const cx = (p.x + end.x) / 2, cy = (p.y + end.y) / 2 - s * 0.45 - hop * 0.2;
      const at = (f: number): Pt => ({
        x: (1 - f) * (1 - f) * p.x + 2 * (1 - f) * f * cx + f * f * end.x,
        y: (1 - f) * (1 - f) * p.y + 2 * (1 - f) * f * cy + f * f * end.y,
      });
      t.draw(0.34, (g, u) => {
        const f1 = easeOut(span(u, 0, 0.6)), f0 = span(u, 0.25, 1);
        if (f1 - f0 < 0.02) return;
        const pts: number[] = [], head: number[] = [];
        for (let i = 0; i <= 12; i++) {
          const q = at(f0 + ((f1 - f0) * i) / 12);
          pts.push(q.x, q.y);
          if (i >= 7) head.push(q.x, q.y);
        }
        g.poly(pts, false).stroke({ width: 1.6, color: PEACH, alpha: 0.6, cap: "round" });
        g.poly(head, false).stroke({ width: 3, color: CREAM, alpha: 0.9, cap: "round" });
      }, { delay: 0.05 });
      t.later(0.24, () => touchdown(t, m.to, 0.8));
    } else if (hit >= 0 && m.killed[hit]) {
      featherFall(t, p, 6, s, [60, 140], 260, 1.0, [-Math.PI * 0.85, -Math.PI * 0.15]);
      t.later(0.2, () => touchdown(t, m.to, 1));
    }

    // STEALTH: the dust he raised hanging over where he ends, turning slowly
    // in the last of his wind — he is already gone from it.
    let acc = 0;
    t.draw(0.55, (g, u, dt) => {
      acc += dt * 20 * t.quality;
      for (; acc >= 1; acc--) {
        const a = rand(0, TAU), rr = s * rand(0.2, 0.42), v = rand(20, 45) * k;
        t.spark(end.x + Math.cos(a) * rr, end.y + Math.sin(a) * rr, -Math.sin(a) * v, Math.cos(a) * v, rand(0.3, 0.45), EDDY, end);
      }
      g.circle(end.x, end.y, s * (0.62 - 0.14 * u)).stroke({ width: 1.5, color: PEACH, alpha: 0.3 * Math.sin(Math.PI * u) });
    }, { delay: 0.4 });
  },
};

/** The edge of the blast reaching a card beside the crater: a ring, wind
 *  driving on through it away from the crater, dust, and a feather or two. */
function blastEdge(t: FxTools, r: Box, from: Pt, power: number) {
  const c = centre(r), s = Math.min(r.w, r.h), k = s / 90;
  const kk = Math.max(0.55, Math.min(1.4, power));
  const away = Math.atan2(c.y - from.y, c.x - from.x), ux = Math.cos(away), uy = Math.sin(away), nx = -uy, ny = ux;
  t.ring(r, PEACH, 0.3, 1.1 * kk, 0.35, 3);
  const lanes = [-0.26, 0, 0.26].map((o, i) => ({ o, bend: (i - 1) * 0.35, at: [0.03, 0, 0.05][i] }));
  t.draw(0.42, (g, u) => {
    const age = u * 0.42;
    for (const l of lanes) {
      const [u0, u1] = run(age - l.at, 0.26, 0.1);
      gust(g, { x: c.x - ux * s * 0.55 + nx * l.o * s, y: c.y - uy * s * 0.55 + ny * l.o * s }, away, 0, s * 1.25 * kk, l.bend,
        u0, u1, 2.4, l.o === 0 ? CREAM : PEACH, 0.85);
    }
  });
  const n = Math.round(10 * kk);
  for (let i = 0; i < n; i++) {
    const a = away + rand(-0.9, 0.9), v = rand(90, 200) * k;
    t.spark(c.x + rand(-0.15, 0.15) * s, c.y + rand(-0.15, 0.15) * s, Math.cos(a) * v, Math.sin(a) * v, rand(0.3, 0.5), DUST);
  }
  featherFall(t, c, 2, s, [80, 160], 90, 0.8);
}

/** Setting down: air whirled in round the square and a puff of dust. */
function touchdown(t: FxTools, r: Box, k: number) {
  const c = centre(r), s = Math.min(r.w, r.h), rot = rand(0, TAU);
  t.draw(0.4, (g, u) => {
    const e = easeOut(u);
    for (let i = 0; i < 3; i++)
      whirl(g, c, s * (0.72 - 0.34 * e), s * (0.56 - 0.3 * e), rot + e * 4 + (i * TAU) / 3, 1.3, 2.4, PEACH, 0.85 * k * (1 - u));
  });
  t.emit({ count: Math.round(14 * k), palette: [CREAM, PEACH, AMBER], from: r, at: "ring", speed: [100, 170], gravity: 0, drag: 0.9,
    life: [0.3, 0.5], size: [7, 2], streak: true, swirl: 700 });
}
