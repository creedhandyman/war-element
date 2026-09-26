/** FIRE, DRAWN — the flame primitives PYRO's look is built from, shared with
 *  the BURN tick (ticks.ts) so a burn looks like PYRO's fire wherever it lands.
 *
 *  Fire reads as fire from four things, and a row of neat cones had only the
 *  first:
 *   - TONGUES: a fat hot bulb tapering to a licking tip whose top curls on its
 *     own, never twice the same height (`pyroTongue`, `pyroFlame`, `pyroLick`);
 *   - A BODY: tongues overlapping into one burning mass, thickest in the middle,
 *     glow pooled at its foot (`pyroBody`);
 *   - WISPS: bits of flame tearing off the tips and rising as they shrink and
 *     cool — the thing a drawing of fire most often lacks;
 *   - SMOKE: real darkness rolling up above it, on the normal-blend layer.
 *  `pyroFire` runs a fire for a while with its wisps and smoke on their own
 *  clock. Colours walk hot white -> amber -> orange -> deep red as they cool,
 *  matching the standard PYRO burst and the meteors of its board set piece. */
import type { Graphics } from "pixi.js";
import { rand } from "./base";
import type { FxTools, Pt, SparkStyle } from "./types";

export const WHITE = 0xfff4d6, AMBER = 0xffc14a, ORANGE = 0xff6a2a, RED = 0xc2261a;
export const PAL = [WHITE, AMBER, ORANGE, RED];
/** A tongue's three layers. Additive, so where they stack the core runs
 *  white-hot and the edge stays deep: the gradient comes free from the overlap. */
export const F_OUT = 0xd8401c, F_MID = 0xff8a2a, F_CORE = 0xfff0c8;
/** Char left on the ground (normal blend). */
export const SCORCH = 0x1c0a04;
/** Smoke: a warm near-black, so it reads as smoke off a fire, not a shadow. */
const SMOKE = 0x241a15;

/** Embers: round, slow, rising, cooling as they go. */
export const EMBER: SparkStyle = { palette: PAL, gravity: -170, drag: 0.55, size: [6, 2], streak: false };

/** Three incommensurate waves: a flame's height never quite repeats, which is
 *  what makes it read as burning rather than pulsing. ~-1..1. */
export function pyroFlick(time: number, seed: number): number {
  return 0.5 * Math.sin(time * 17 + seed) + 0.3 * Math.sin(time * 29.3 + seed * 1.7) + 0.2 * Math.sin(time * 47.1 + seed * 2.9);
}

/** Rise fast, hold, die down: a flame's life, 0..1 over `life` seconds. */
export function pyroEnv(age: number, life: number, rise = 0.07): number {
  if (age <= 0 || age >= life) return 0;
  return age < rise ? age / rise : 1 - (age - rise) / (life - rise);
}

/** One flame tongue: a round bulb at `b`, tapering to a tip `len` along
 *  (ux, uy). `lean` bends the TOP of it — the belly stays planted and the neck
 *  swings toward the tip — which is the difference between a flame and a
 *  leaning cone. Each edge swells out low and pulls in high, a little
 *  unevenly, so no two sides match. */
export function pyroTongue(g: Graphics, bx: number, by: number, ux: number, uy: number, len: number, w: number,
  lean: number, color: number, alpha: number) {
  if (len < 1.5 || alpha <= 0.01) return;
  const px = -uy, py = ux, hw = w / 2;
  const tx = bx + ux * len + px * lean, ty = by + uy * len + py * lean;
  const lx = bx + ux * len * 0.28, ly = by + uy * len * 0.28; // the belly, low
  const nx = bx + ux * len * 0.64 + px * lean * 0.5, ny = by + uy * len * 0.64 + py * lean * 0.5; // the neck, leaning
  g.moveTo(bx - px * hw, by - py * hw)
    .bezierCurveTo(lx - px * hw * 1.38, ly - py * hw * 1.38, nx - px * hw * 0.55, ny - py * hw * 0.55, tx, ty)
    .bezierCurveTo(nx + px * hw * 0.42, ny + py * hw * 0.42, lx + px * hw * 1.28, ly + py * hw * 1.28, bx + px * hw, by + py * hw)
    .quadraticCurveTo(bx - ux * hw * 1.2, by - uy * hw * 1.2, bx - px * hw, by - py * hw)
    .closePath()
    .fill({ color, alpha });
}

/** A whole flame: deep outer tongue, orange body, white-hot core low down. */
export function pyroFlame(g: Graphics, bx: number, by: number, ux: number, uy: number, len: number, w: number,
  lean: number, a: number) {
  pyroTongue(g, bx, by, ux, uy, len, w, lean, F_OUT, 0.46 * a);
  pyroTongue(g, bx, by, ux, uy, len * 0.72, w * 0.66, lean * 0.78, F_MID, 0.6 * a);
  pyroTongue(g, bx, by, ux, uy, len * 0.42, w * 0.36, lean * 0.45, F_CORE, 0.82 * a);
}

/** An upright flame whose height and lean flicker on their own. */
export function pyroLick(g: Graphics, x: number, y: number, h: number, w: number, time: number, seed: number, a: number) {
  const hh = h * (1 + 0.26 * pyroFlick(time, seed));
  pyroFlame(g, x, y, 0, -1, hh, w, hh * 0.24 * pyroFlick(time * 0.8, seed + 4.1), a);
}

/** A BURNING BODY on a base line from x0 to x1: tongues overlapping into one
 *  fire, each flickering on its own, tallest where the fire is thickest, the
 *  glow pooled at its foot. `h` is its height, `a` its strength 0..1. */
export function pyroBody(g: Graphics, x0: number, x1: number, y: number, h: number, a: number, time: number, seed: number,
  density = 1) {
  if (h < 2 || a <= 0.01) return;
  const span = x1 - x0;
  const n = Math.max(2, Math.round((span / Math.max(8, h * 0.32)) * density));
  const w = (span / n) * 1.9;
  g.ellipse((x0 + x1) / 2, y, span / 2 + h * 0.14, Math.max(3, h * 0.13)).fill({ color: F_OUT, alpha: 0.3 * a });
  for (let i = 0; i < n; i++) {
    const f = (i + 0.5) / n;
    const mass = 0.55 + 0.45 * Math.sin(Math.PI * f);
    const own = 0.68 + 0.32 * Math.abs(Math.sin(seed * 1.3 + i * 2.17));
    const hh = h * mass * own * (1 + 0.3 * pyroFlick(time, seed + i * 1.9));
    const x = x0 + span * f + Math.sin(seed + i * 3.1) * w * 0.15;
    pyroFlame(g, x, y, 0, -1, hh, w, hh * 0.26 * pyroFlick(time * 0.7, seed + i * 0.7), a);
  }
}

// ── Wisps and smoke: fire's own clock ───────────────────────────────────────

interface Wisp { x: number; y: number; vx: number; vy: number; age: number; life: number; size: number; seed: number }
interface Puff { x: number; y: number; r: number; vx: number; vy: number; age: number; life: number }

/** A fire burning for `seconds`: `body` draws its flames each frame (seconds
 *  in, and 0..1 of the way through); WISPS tear off at `wisp()` points,
 *  `wispRate` a second, and SMOKE rolls up from `puff()` points, `smokeRate` a
 *  second. Both thin with the layer's detail and stop being born before the
 *  flames go out, so a fire dies clean — the last wisps and smoke finish on
 *  their own a little after. */
export function pyroFire(t: FxTools, o: {
  seconds: number;
  delay?: number;
  body: (g: Graphics, time: number, k: number) => void;
  wisp?: (k: number) => Pt | null;
  wispRate?: number;
  wispSize?: number;
  puff?: (k: number) => Pt | null;
  smokeRate?: number;
  smokeSize?: number;
}) {
  const D = o.seconds;
  const wisps: Wisp[] = [];
  let wa = 0;
  t.draw(D + 0.45, (g, u, dt) => {
    const time = u * (D + 0.45), k = Math.min(1, time / D);
    if (time < D) o.body(g, time, k);
    if (o.wisp && time < D * 0.78) {
      wa += (o.wispRate ?? 10) * t.quality * dt;
      while (wa >= 1) {
        wa -= 1;
        const p = o.wisp(k);
        if (p && wisps.length < 28)
          wisps.push({ x: p.x, y: p.y, vx: rand(-14, 14), vy: -rand(70, 135), age: 0, life: rand(0.24, 0.42),
            size: (o.wispSize ?? 8) * rand(0.7, 1.2), seed: rand(0, 100) });
      }
    }
    for (let i = wisps.length - 1; i >= 0; i--) {
      const w = wisps[i];
      w.age += dt;
      if (w.age >= w.life) { wisps.splice(i, 1); continue; }
      const q = w.age / w.life;
      w.x += (w.vx + Math.sin(time * 9 + w.seed) * 20) * dt;
      w.y += w.vy * dt;
      const s = w.size * (1 - 0.8 * q);
      pyroTongue(g, w.x, w.y, 0, -1, s * 1.7, s, s * 0.35 * pyroFlick(time, w.seed), q < 0.5 ? F_MID : F_OUT, 0.85 * (1 - q));
      if (q < 0.45) pyroTongue(g, w.x, w.y, 0, -1, s * 0.85, s * 0.45, 0, F_CORE, 0.85 * (1 - q / 0.45));
    }
  }, { delay: o.delay });
  const puff = o.puff;
  if (!puff) return;
  const puffs: Puff[] = [];
  let sa = 0;
  const S = D + 1.0;
  t.draw(S, (g, u, dt) => {
    const time = u * S, k = Math.min(1, time / D);
    if (time < D * 0.85) {
      sa += (o.smokeRate ?? 6) * t.quality * dt;
      while (sa >= 1) {
        sa -= 1;
        const p = puff(k);
        if (p && puffs.length < 20)
          puffs.push({ x: p.x, y: p.y, r: (o.smokeSize ?? 10) * rand(0.7, 1.15), vx: rand(-12, 12), vy: -rand(28, 55), age: 0,
            life: rand(0.7, 1.05) });
      }
    }
    for (let i = puffs.length - 1; i >= 0; i--) {
      const p = puffs[i];
      p.age += dt;
      if (p.age >= p.life) { puffs.splice(i, 1); continue; }
      const q = p.age / p.life;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy *= Math.pow(0.6, dt);
      g.circle(p.x, p.y, p.r * (1 + q * 1.5)).fill({ color: SMOKE, alpha: 0.34 * Math.sin(Math.PI * q) });
    }
  }, { delay: o.delay, dark: true });
}

/** The fire's own ember spray off a rect. */
export function pyroEmbers(t: FxTools, r: { x: number; y: number; w: number; h: number }, count: number,
  speed: [number, number], life: [number, number], size: [number, number] = [7, 2]) {
  t.emit({ count, palette: PAL, from: r, dir: [-118, -62], speed, gravity: -170, drag: 0.55, life, size });
}
