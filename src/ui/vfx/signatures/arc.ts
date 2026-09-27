/** ARC — Light Slasher. "5·5·5·10 combo on a target; on a kill, chain to the
 *  next enemy with +5 to the rest of the combo" — four strikes, each one
 *  measured against the last.
 *
 *  ARC is the war-frame on its art: violet plate, a cold cyan eye, and an
 *  energy greatsword as long as itself, crackling, its thrusters spitting
 *  orange. The DELIVERY is ARC going: static crawls over its square as the
 *  blade lights from guard to point, then it BLINKS — afterimages of it, blade
 *  and all, flickering in and out round its square a beat apart — and the last
 *  blink is a streak of light to the target, arriving as the combo lands.
 *
 *  The LANDING is the combo, measured out: three light slashes a beat apart,
 *  each at its own angle and stacked up the card rather than crossed — cut in
 *  a blink, burning white and stuttering, throwing static and hot sparks off
 *  the blade, then cooling to a violet scar, so the strikes tally up where you
 *  can count them. Then the fourth — the 10 — held half a beat and cut as a
 *  big X at once, lightning bursting out of the crossing: the only X in it. On
 *  a kill it does not stop: the card shorts out, a streak jumps to the next,
 *  and the sequence carries on there with what is left of it. Every card in
 *  the chain takes its strikes; the last one takes the finisher.
 *
 *  Lightning keeps looks/bolt.ts's rules — kinked lines, never curves, and a
 *  stutter on a fixed beat, never a smooth fade — all but the blade's own
 *  edge, the one clean line in it. */
import { centre, rand } from "../looks/base";
import type { Graphics } from "pixi.js";
import type { FxTools, Pt, SparkStyle } from "../looks/types";
import type { Signature, SigMoment } from "./types";

type Box = { x: number; y: number; w: number; h: number };

const TAU = Math.PI * 2;
/** The blade's light: a white-hot core, an ice-cyan edge (its eye's colour),
 *  a violet halo (the charge it runs on). */
const WHITE = 0xffffff, ICE = 0xa6eeff, LAV = 0xe3d8ff, VIO = 0x9575ff;
/** One flicker beat, s, and a strike's brightness beat by beat: re-strokes,
 *  not a fade (looks/bolt.ts). */
const BEAT = 0.035;
const FLICKER = [1, 0.4, 1, 0.75, 0.3, 0.9, 0.55, 0.2, 0.7, 0.35, 0.15, 0.5];
/** The three plain strikes before the X: each one's tilt off square to the
 *  line of attack, whether it sweeps back the other way, and where it crosses
 *  the line (in squares, + toward the far side). Stacked, not crossed — three
 *  cuts you can count, zig-zagging up the card, so the only X is the last. */
const CUTS: Array<[number, boolean, number]> = [[0.42, false, -0.2], [-0.4, true, 0], [0.3, false, 0.2]];
/** Static: darts out hard and stops dead. */
const SNAP: SparkStyle = { palette: [WHITE, ICE, VIO], gravity: 0, drag: 0.0008, size: [6, 1.5], streak: true };
/** Finer static, drawn in over the square as it charges. */
const FIZZ: SparkStyle = { palette: [WHITE, LAV, VIO], gravity: 0, drag: 0.002, size: [4, 1], streak: true };
/** Hot metal off the blade, and the thrusters' spit: the orange on its art. */
const HOT: SparkStyle = { palette: [0xfff4d6, 0xffc36b, 0xff8a2a], gravity: 650, drag: 0.35, size: [5, 1.5], streak: true };

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeOut = (x: number) => 1 - (1 - x) * (1 - x);

/** How lit a strike is `since` s after it lands, lasting `dur`: lightning's
 *  stutter, dying away. */
function flicker(since: number, dur: number): number {
  if (since < 0 || since >= dur) return 0;
  return FLICKER[Math.floor(since / BEAT) % FLICKER.length] * Math.sqrt(1 - since / dur);
}

/** A lightning channel from a to b, pinned at both ends: `segs` uneven steps,
 *  kinked up to `jag` px across by a walk, so it meanders AND turns sharp. */
function channel(ax: number, ay: number, bx: number, by: number, segs: number, jag: number): number[] {
  const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len;
  const out = [ax, ay];
  let off = 0;
  for (let i = 1; i < segs; i++) {
    off = off * 0.5 + rand(-1, 1);
    const f = (i + rand(-0.3, 0.3)) / segs, o = off * jag * Math.sqrt(Math.sin((Math.PI * i) / segs));
    out.push(ax + dx * f + nx * o, ay + dy * f + ny * o);
  }
  out.push(bx, by);
  return out;
}

/** Flat points as one open path, up to fraction `f` of it — traced, not handed
 *  to `poly()`, so a path can be laid down as it grows. */
function trace(g: Graphics, p: number[], f = 1) {
  const n = p.length / 2, reach = f * (n - 1), full = Math.min(n - 1, Math.floor(reach));
  g.moveTo(p[0], p[1]);
  for (let i = 1; i <= full; i++) g.lineTo(p[i * 2], p[i * 2 + 1]);
  const frac = reach - full;
  if (frac > 0 && full + 1 < n) {
    const i = full * 2;
    g.lineTo(p[i] + (p[i + 2] - p[i]) * frac, p[i + 1] + (p[i + 3] - p[i + 1]) * frac);
  }
}

/** Lightning stroked: a wide violet halo, then a thin hot core. */
function zap(g: Graphics, paths: number[][], width: number, alpha: number, f = 1) {
  if (alpha <= 0.02 || paths.length === 0) return;
  const a = Math.min(1, alpha);
  for (const p of paths) trace(g, p, f);
  g.stroke({ width: width * 4, color: VIO, alpha: 0.3 * a, join: "round", cap: "round" });
  for (const p of paths) trace(g, p, f);
  g.stroke({ width, color: WHITE, alpha: a, join: "bevel", cap: "round" });
}

/** A hard flash sized to the board's squares, in and gone in a blink (`flash`
 *  is sized in px, and would swamp a phone's board). */
function blink(t: FxTools, p: Pt, size: number, color: number, peak: number, seconds: number) {
  t.glow({ x: p.x - size / 2, y: p.y - size / 2, w: size, h: size }, color, peak, seconds, 1);
}

/** A point on a square rim of half-size `half` round `c`, and which way the
 *  rim runs there. */
function rim(c: Pt, half: number) {
  const side = Math.floor(Math.random() * 4), s = rand(-half, half);
  return side < 2
    ? { x: c.x + s, y: c.y + (side === 0 ? -half : half), tan: 0 }
    : { x: c.x + (side === 2 ? -half : half), y: c.y + s, tan: Math.PI / 2 };
}

/** Static crawling over a card: short arcs flickering along its rim, more and
 *  longer as it builds (`grow`) or dying away, fizz snapping in toward the
 *  middle. */
function crawl(t: FxTools, r: Box, seconds: number, n: number, reach: number, grow: boolean, delay = 0) {
  const c = centre(r), half = Math.min(r.w, r.h) * 0.42, v = Math.min(r.w, r.h) / 90;
  let arcs: number[][] = [], beat = -1, acc = 0;
  t.draw(seconds, (g, k, dt) => {
    const b = Math.floor((k * seconds) / BEAT), q = grow ? k : 1 - k;
    if (b !== beat) {
      beat = b;
      arcs = [];
      const shown = Math.max(1, Math.round(n * (0.4 + 0.6 * q)));
      for (let i = 0; i < shown; i++) {
        const p = rim(c, half), a = p.tan + rand(-0.5, 0.5) + (Math.random() < 0.5 ? Math.PI : 0);
        const l = reach * rand(0.6, 1.1) * (0.6 + 0.4 * q);
        arcs.push(channel(p.x, p.y, p.x + Math.cos(a) * l, p.y + Math.sin(a) * l, 3, l * 0.3));
      }
    }
    zap(g, arcs, 1.6, (0.45 + 0.55 * q) * rand(0.55, 1));
    acc += 45 * q * dt;
    for (; acc >= 1; acc--) {
      const p = rim(c, half), a = Math.atan2(c.y - p.y, c.x - p.x) + rand(-0.7, 0.7), sp = rand(120, 240) * v;
      t.spark(p.x, p.y, Math.cos(a) * sp, Math.sin(a) * sp, rand(0.08, 0.16), FIZZ);
    }
  }, { delay });
}

/** ARC's greatsword laid across a card at `c` along `ang`: a tapered bar of
 *  light from the guard to its point, lit `lit` of its length, with the guard
 *  and grip behind it — so a sword reads at a glance, not a line. */
function sword(g: Graphics, c: Pt, ang: number, len: number, w: number, lit: number, alpha: number) {
  if (alpha <= 0.02 || lit <= 0.02) return;
  const ux = Math.cos(ang), uy = Math.sin(ang), nx = -uy, ny = ux;
  const hx = c.x - ux * len * 0.42, hy = c.y - uy * len * 0.42;
  const L = len * lit, tx = hx + ux * L, ty = hy + uy * L;
  g.moveTo(hx, hy).lineTo(tx, ty).stroke({ width: w * 3.4, color: VIO, alpha: 0.3 * alpha, cap: "round" });
  g.poly([hx + nx * w * 0.5, hy + ny * w * 0.5, tx, ty, hx - nx * w * 0.5, hy - ny * w * 0.5], true)
    .fill({ color: ICE, alpha: 0.85 * alpha });
  g.moveTo(hx, hy).lineTo(hx + ux * L * 0.88, hy + uy * L * 0.88).stroke({ width: Math.max(1, w * 0.28), color: WHITE, alpha });
  const gw = Math.max(1.5, w * 0.42);
  g.moveTo(hx + nx * w * 1.3, hy + ny * w * 1.3).lineTo(hx - nx * w * 1.3, hy - ny * w * 1.3)
    .stroke({ width: gw, color: LAV, alpha: 0.9 * alpha, cap: "round" });
  g.moveTo(hx, hy).lineTo(hx - ux * w * 1.7, hy - uy * w * 1.7).stroke({ width: gw, color: LAV, alpha: 0.75 * alpha, cap: "round" });
}

/** A card's outline, its corners cut: what an afterimage of ARC is drawn as. */
function frame(g: Graphics, c: Pt, half: number): Graphics {
  const k = half * 0.22;
  return g.poly([
    c.x - half + k, c.y - half, c.x + half - k, c.y - half, c.x + half, c.y - half + k, c.x + half, c.y + half - k,
    c.x + half - k, c.y + half, c.x - half + k, c.y + half, c.x - half, c.y + half - k, c.x - half, c.y - half + k,
  ], true);
}

/** One cut of the combo. */
interface Cut { c: Pt; ang: number; reach: number; w: number; bow: number }

/** Where along a cut `s` (0..1) of the way from its start, bowed to its left. */
function onCut(k: Cut, s: number): Pt {
  const ux = Math.cos(k.ang), uy = Math.sin(k.ang), a = -k.reach + 2 * k.reach * s, b = k.bow * Math.sin(Math.PI * s);
  return { x: k.c.x + ux * a - uy * b, y: k.c.y + uy * a + ux * b };
}

/** The cut's edge: a sliver sharp at both ends and widest mid-way, `w` across,
 *  laid down from its start to `drawn` (0..1) — so it CUTS across, rather than
 *  appearing. */
function sliver(g: Graphics, k: Cut, w: number, drawn: number): Graphics {
  const ux = Math.cos(k.ang), uy = Math.sin(k.ang), n = 12, fwd: number[] = [], back: number[] = [];
  for (let i = 0; i <= n; i++) {
    const s = (i / n) * drawn, p = onCut(k, s), hw = (w / 2) * Math.pow(Math.sin(Math.PI * s), 0.6);
    fwd.push(p.x - uy * hw, p.y + ux * hw);
    back.push(p.x + uy * hw, p.y - ux * hw);
  }
  for (let i = back.length - 2; i >= 0; i -= 2) fwd.push(back[i], back[i + 1]);
  return g.poly(fwd, true);
}

/** ONE STRIKE landing: the blade's edge cut across the card in a blink, burning
 *  white and stuttering, static crackling off its edge — then cooling to a
 *  thin violet SCAR that stays a moment, so the strikes tally up on the card
 *  before the finisher lands. Its follow-through throws hot sparks off the far
 *  end. `bright` s of burn, the scar for the rest of `dur`. */
function slash(t: FxTools, k: Cut, delay: number, bright: number, dur: number, s: number) {
  const DRAW = 0.045, v = s / 90;
  let twigs: number[][] = [], beat = -1;
  t.draw(dur, (g, u) => {
    const time = u * dur, drawn = clamp01(time / DRAW), since = time - DRAW;
    const mid: number[] = [];
    for (let i = 0; i <= 10; i++) { const p = onCut(k, (i / 10) * drawn); mid.push(p.x, p.y); }
    if (since > bright) {
      // The scar: what the eye keeps of the cut.
      const q = (since - bright) / (dur - DRAW - bright);
      trace(g, mid);
      g.stroke({ width: k.w * 1.6, color: VIO, alpha: 0.2 * (1 - q), cap: "round" });
      sliver(g, k, k.w * 0.4, 1).fill({ color: LAV, alpha: 0.6 * (1 - q) });
      return;
    }
    const lit = since < 0 ? 1 : Math.max(flicker(since, bright), 0.5);
    const thin = 1 - 0.4 * clamp01(since / bright);
    trace(g, mid);
    g.stroke({ width: k.w * 3 * thin, color: VIO, alpha: 0.35 * lit, cap: "round", join: "round" });
    sliver(g, k, k.w * thin, drawn).fill({ color: ICE, alpha: 0.9 * lit });
    sliver(g, k, k.w * 0.36 * thin, drawn).fill({ color: WHITE, alpha: lit });
    if (since < 0) return;
    const b = Math.floor(since / BEAT);
    if (b !== beat) {
      beat = b;
      twigs = [];
      for (let j = 0; j < 2; j++) {
        const p = onCut(k, rand(0.2, 0.8));
        const a = k.ang + (Math.random() < 0.5 ? -1 : 1) * (Math.PI / 2 + rand(-0.6, 0.6)), l = k.reach * rand(0.18, 0.34);
        twigs.push(channel(p.x, p.y, p.x + Math.cos(a) * l, p.y + Math.sin(a) * l, 3, l * 0.3));
      }
    }
    zap(g, twigs, 1.2, lit * 0.85);
  }, { delay });
  t.later(delay + DRAW, () => {
    for (let i = 0; i < 8; i++) {
      const p = onCut(k, rand(0.1, 0.9)), a = k.ang + (i % 2 ? 1 : -1) * rand(1.1, 2.0), sp = rand(150, 320) * v;
      t.spark(p.x, p.y, Math.cos(a) * sp, Math.sin(a) * sp, rand(0.1, 0.22), SNAP);
    }
    const end = onCut(k, 0.92);
    for (let i = 0; i < 5; i++) {
      const a = k.ang + rand(-0.5, 0.5), sp = rand(160, 300) * v;
      t.spark(end.x, end.y, Math.cos(a) * sp, Math.sin(a) * sp - 60 * v, rand(0.25, 0.45), HOT);
    }
  });
}

/** Lightning bursting out of a point: `n` jagged arcs, re-rolled every beat,
 *  reaching `reach` and stuttering out over `dur`. */
function burst(t: FxTools, c: Pt, n: number, reach: number, dur: number, delay: number) {
  let arcs: number[][] = [], beat = -1;
  t.draw(dur, (g, u) => {
    const b = Math.floor((u * dur) / BEAT);
    if (b !== beat) {
      beat = b;
      arcs = [];
      const a0 = rand(0, TAU);
      for (let i = 0; i < n; i++) {
        const a = a0 + (i / n) * TAU + rand(-0.3, 0.3), l = reach * rand(0.55, 1) * (0.5 + 0.5 * easeOut(Math.min(1, u * 3)));
        arcs.push(channel(c.x, c.y, c.x + Math.cos(a) * l, c.y + Math.sin(a) * l, 5, l * 0.22));
      }
    }
    zap(g, arcs, 2, flicker(u * dur, dur) * 1.1);
  }, { delay });
}

/** The chain in the order it was struck: the cards ARC killed first, nearest
 *  first (it goes on to whatever is next), then the card it stopped on. The
 *  targets come in no order of their own. */
function chainOf(m: SigMoment): number[] {
  const c = centre(m.from);
  const d = (i: number) => { const p = centre(m.targets[i]); return Math.hypot(p.x - c.x, p.y - c.y); };
  return m.targets.map((_, i) => i).sort((a, b) =>
    (m.killed[a] ? 1 : 0) !== (m.killed[b] ? 1 : 0) ? (m.killed[a] ? -1 : 1) : d(a) - d(b));
}

/** How the four strikes fall along the chain: a card that died took strikes
 *  until it did — read off what it lost, about 5 a strike — and the rest carry
 *  on to the next; the last card always takes the finisher. */
function allot(m: SigMoment, chain: number[]): number[] {
  const out: number[] = [];
  let left = Math.max(4, chain.length);
  chain.forEach((i, ci) => {
    const rest = chain.length - 1 - ci;
    if (rest === 0) { out.push(left); return; }
    const p = m.power[i] ?? 1;
    const k = Math.max(1, Math.min(left - rest, Math.round((8 * p * p) / 5)));
    out.push(k);
    left -= k;
  });
  return out;
}

/** The combo carrying on: a streak of light laid from the card it killed to
 *  the next in `secs`, then stuttering out. */
function jump(t: FxTools, a: Pt, b: Pt, delay: number, secs: number) {
  const path = channel(a.x, a.y, b.x, b.y, 6, Math.hypot(b.x - a.x, b.y - a.y) * 0.06), dur = secs + 0.2;
  t.draw(dur, (g, u) => {
    const time = u * dur, f = clamp01(time / secs);
    zap(g, [path], 2.4, time < secs ? 1 : flicker(time - secs, dur - secs), f);
    if (f < 1) {
      const n = path.length / 2 - 1, i = Math.min(n - 1, Math.floor(f * n)) * 2, q = f * n - i / 2;
      g.circle(path[i] + (path[i + 2] - path[i]) * q, path[i + 1] + (path[i + 3] - path[i + 1]) * q, 3.5).fill({ color: WHITE, alpha: 1 });
    }
  }, { delay });
}

export const ARC: Signature = {
  shake: 1.3,
  // It closes on its target like any melee card: the lunge is the blink's
  // body, and the afterimages are what it leaves behind.

  deliver(t: FxTools, m: SigMoment, seconds: number) {
    const s = m.size, c = centre(m.from), T = seconds, v = s / 90;
    // The combo opens on the nearest card; in a delivery nothing is known dead.
    let aim: Pt = { x: c.x + m.ahead.x * s, y: c.y + m.ahead.y * s }, best = s;
    m.targets.forEach((r, i) => {
      const p = centre(r), d = Math.hypot(p.x - c.x, p.y - c.y);
      if (i === 0 || d < best) { best = d; aim = p; }
    });
    const A = Math.atan2(aim.y - c.y, aim.x - c.x), ux = Math.cos(A), uy = Math.sin(A);
    // The blade rides low across its body, point forward: the pose on its art.
    const held = A + 0.95, len = s * 1.05, bw = s * 0.07;

    // CHARGING: static crawls over the square as the core spins up, and the
    // blade lights from the guard to its point.
    const CH = T * 0.5;
    t.charge(c, s * 1.15, LAV, 0.38, CH);
    crawl(t, m.from, CH, 4, s * 0.26, true);
    t.draw(T * 0.62, (g, u) => {
      const time = u * T * 0.62, lit = easeOut(clamp01(time / (T * 0.38)));
      const fade = 1 - clamp01((time - CH) / (T * 0.12));
      sword(g, c, held, len, bw, lit, fade * rand(0.8, 1));
    });

    // THE BLINK: ARC flickering in and out round its square, blade and all, a
    // beat apart — each afterimage cut off by the next.
    const ghosts = [
      { at: 0.46, dx: -uy * 0.16 - ux * 0.04, dy: ux * 0.16 - uy * 0.04 },
      { at: 0.6, dx: uy * 0.18 - ux * 0.06, dy: -ux * 0.18 - uy * 0.06 },
      { at: 0.72, dx: ux * 0.1, dy: uy * 0.1 },
    ];
    for (const gh of ghosts) {
      const p = { x: c.x + gh.dx * s, y: c.y + gh.dy * s }, D = T * 0.26;
      t.draw(D, (g, u) => {
        const a = Math.max(0.35 * (1 - u), flicker(u * D, D));
        frame(g, p, s * 0.39).fill({ color: VIO, alpha: 0.12 * a }).stroke({ width: 6, color: VIO, alpha: 0.3 * a });
        frame(g, p, s * 0.39).stroke({ width: 2, color: ICE, alpha: 0.95 * a });
        sword(g, p, held, len * 0.9, bw * 0.9, 1, 0.9 * a);
      }, { delay: T * gh.at });
      t.later(T * gh.at, () => {
        for (let i = 0; i < 6; i++) {
          const a = rand(0, TAU), sp = rand(90, 200) * v;
          t.spark(p.x + Math.cos(a) * s * 0.3, p.y + Math.sin(a) * s * 0.3, Math.cos(a) * sp, Math.sin(a) * sp, rand(0.1, 0.2), SNAP);
        }
      });
    }

    // The thrusters kick with the first blink — a flare at its back edge — and
    // spit orange behind it from then on.
    const back = { x: c.x - ux * s * 0.42, y: c.y - uy * s * 0.42 };
    t.later(T * 0.46, () => {
      blink(t, back, s * 0.8, 0xffb060, 0.5, 0.2);
      for (let i = 0; i < 10; i++) {
        const a = A + Math.PI + rand(-0.6, 0.6), sp = rand(160, 320) * v;
        t.spark(back.x + rand(-0.25, 0.25) * s * uy, back.y - rand(-0.25, 0.25) * s * ux, Math.cos(a) * sp, Math.sin(a) * sp, rand(0.25, 0.45), HOT);
      }
    });
    let acc = 0;
    t.draw(T * 0.54, (_g, u, dt) => {
      acc += 50 * dt;
      for (; acc >= 1; acc--) {
        const a = A + Math.PI + rand(-0.45, 0.45), sp = rand(120, 260) * v;
        t.spark(back.x + rand(-0.2, 0.2) * s * uy, back.y - rand(-0.2, 0.2) * s * ux, Math.cos(a) * sp, Math.sin(a) * sp, rand(0.18, 0.34) * (1 - u * 0.5), HOT);
      }
    }, { delay: T * 0.46 });

    // ...and the last blink IS the strike: a trail of light laid out to the
    // target — thin where it left, full where its head is — crackling round
    // its core, reaching the card on the landing frame.
    const GO = T * 0.78, from = { x: c.x + ux * s * 0.25, y: c.y + uy * s * 0.25 };
    const to = { x: aim.x - ux * s * 0.18, y: aim.y - uy * s * 0.18 };
    const path = channel(from.x, from.y, to.x, to.y, 6, Math.max(4, best * 0.06));
    t.draw(T - GO, (g, u) => {
      const f = easeOut(u), hx = from.x + (to.x - from.x) * f, hy = from.y + (to.y - from.y) * f, hw = s * 0.09;
      g.poly([from.x, from.y, hx - uy * hw, hy + ux * hw, hx + ux * hw * 0.8, hy + uy * hw * 0.8, hx + uy * hw, hy - ux * hw], true)
        .fill({ color: ICE, alpha: 0.4 });
      g.moveTo(from.x, from.y).lineTo(hx, hy).stroke({ width: s * 0.26, color: VIO, alpha: 0.18, cap: "round" });
      g.moveTo(from.x, from.y).lineTo(hx, hy).stroke({ width: 2.5, color: WHITE, alpha: 0.95, cap: "round" });
      zap(g, [path], 1.6, rand(0.6, 1), f);
      g.circle(hx, hy, s * 0.07).fill({ color: WHITE, alpha: 0.95 });
    }, { delay: GO });
  },

  land(t: FxTools, m: SigMoment) {
    const s = m.size, home = centre(m.from), v = s / 90;
    const chain = chainOf(m), strikes = allot(m, chain);
    const total = strikes.reduce((a, b) => a + b, 0);
    const GAP = 0.085;
    let time = 0, n = 0, prev = home;
    chain.forEach((i, ci) => {
      const r = m.targets[i], c = centre(r), p = Math.max(0.55, Math.min(2, m.power[i] ?? 1));
      if (ci > 0) {
        // It does not stop: on to the next, and the sequence carries on there.
        jump(t, prev, c, time - 0.02, 0.06);
        time += 0.06;
      }
      const across = Math.atan2(c.y - prev.y, c.x - prev.x) + Math.PI / 2;
      const reach = s * (0.42 + 0.05 * p), w = s * (0.06 + 0.022 * p);
      for (let k = 0; k < strikes[ci]; k++, n++) {
        if (n === total - 1) {
          // THE FINISHER, the 10: a half-beat held, then an X cut at once and
          // lightning bursting out of the crossing.
          time += 0.04;
          const X = { c, reach: reach * 1.18, w: w * 1.35 };
          slash(t, { ...X, ang: across + Math.PI / 4, bow: reach * 0.1 }, time, 0.24, 0.5, s);
          slash(t, { ...X, ang: across - Math.PI / 4 + Math.PI, bow: -reach * 0.1 }, time + 0.025, 0.24, 0.5, s);
          const at = time + 0.05;
          t.later(at, () => {
            blink(t, c, s * 1.55, LAV, 0.55, 0.24);
            t.ring(r, ICE, 0.3, 1.35, 0.38, 3);
            for (let j = 0; j < 18; j++) {
              const a = rand(0, TAU), sp = rand(200, 380) * v;
              t.spark(c.x, c.y, Math.cos(a) * sp, Math.sin(a) * sp, rand(0.12, 0.26), SNAP);
            }
            for (let j = 0; j < 10; j++) {
              const a = rand(0, TAU), sp = rand(140, 300) * v;
              t.spark(c.x, c.y, Math.cos(a) * sp, Math.sin(a) * sp - 80 * v, rand(0.3, 0.55), HOT);
            }
          });
          burst(t, c, 6, s * 0.75 * Math.min(1.25, 0.8 + 0.25 * p), 0.36, at);
        } else {
          const [tilt, sweep, off] = CUTS[n % CUTS.length];
          const at = { x: c.x + Math.sin(across) * off * s, y: c.y - Math.cos(across) * off * s };
          slash(t, { c: at, ang: across + tilt + (sweep ? Math.PI : 0), reach, w, bow: reach * 0.12 * (sweep ? -1 : 1) }, time, 0.12, 0.55, s);
          t.later(time + 0.03, () => blink(t, c, s * 0.95, ICE, 0.3, 0.12));
        }
        time += GAP;
      }
      if (m.killed[i]) {
        // A card the combo killed shorts out as it goes.
        const at = time - GAP + 0.06;
        crawl(t, r, 0.38, 5, s * 0.3, false, at);
        t.later(at, () => {
          blink(t, c, s * 1.2, VIO, 0.45, 0.3);
          for (let j = 0; j < 12; j++) {
            const a = rand(0, TAU), sp = rand(100, 240) * v;
            t.spark(c.x + rand(-0.3, 0.3) * s, c.y + rand(-0.3, 0.3) * s, Math.cos(a) * sp, Math.sin(a) * sp - 60 * v, rand(0.3, 0.55), HOT);
          }
        });
      }
      prev = c;
    });
  },
};
