/** SUPERNOVA — Gamma Ray Burst. "Deal 14 DMG to a target and 14 DMG to every
 *  opponent adjacent to it. Supernova loses 5 HP." As it is summoned it gives
 *  its first light: 2 DMG to every opponent. "It burns five of its own for
 *  every burst."
 *
 *  The DELIVERY is the star collapsing before it bursts: its light pulled back
 *  into itself — a violet body shrinking to a white-hot point, its rays drawn
 *  in and shortening, motes of light falling into it, the whole of it
 *  brighter the smaller it gets. Arriving, the star first kindles on the empty
 *  square it is dropping onto, then collapses the same way.
 *
 *  The LANDING is the burst. A searing beam — white core, violet halo, light
 *  pulsing down it — fires from the star to the target the others stand
 *  round, and a starburst goes off there: a flare, long spokes of light, and
 *  a shell of it running out over every card adjacent, each lit as the shell
 *  passes. The star itself flares and sheds a little of its own light as it
 *  fires (it pays five). Arriving, there is no beam: the nova goes off where
 *  it lands, a shell of light flooding the whole board to its edges, and a
 *  spark on every opponent as the shell reaches it.
 *
 *  White and violet rather than DAWN's usual gold: this is a star's hardest
 *  light, and it is the only DAWN card drawn in it. Gold is kept for the
 *  shell's rim, so it still reads as DAWN's. */
import type { Graphics } from "pixi.js";
import { centre, lerpPt, rand } from "../looks/base";
import type { FxTools, Pt, SparkStyle } from "../looks/types";
import type { Signature, SigMoment } from "./types";

type Box = { x: number; y: number; w: number; h: number };

const TAU = Math.PI * 2;
const WHITE = 0xffffff, LILAC = 0xeadfff, VIOLET = 0xb48cff, DEEP = 0x7a52e0, GOLD = 0xffd54f;
/** Light flung out of a burst: dead straight and fast, white to violet. */
const NEEDLE: SparkStyle = { palette: [WHITE, LILAC, VIOLET], gravity: 0, drag: 0.04, size: [6, 2], streak: true };
/** Motes falling into the collapsing star, brightening as they go. */
const INFALL: SparkStyle = { palette: [VIOLET, LILAC, WHITE], gravity: 0, drag: 1, size: [3, 6], streak: true };
/** What the star sheds of itself when it fires: slow violet embers. */
const SHED: SparkStyle = { palette: [LILAC, VIOLET, DEEP], gravity: -40, drag: 0.5, size: [6, 2], streak: false };
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeOut = (x: number) => 1 - (1 - x) * (1 - x);

/** A four-point star: two long arms (`r` along `rot`, `r2` across it) pinched
 *  to a waist `w` — the shape of a flare. */
function star(g: Graphics, x: number, y: number, r: number, r2: number, w: number, rot: number, color: number, alpha: number) {
  if (alpha <= 0.01 || (r < 0.5 && r2 < 0.5)) return;
  const pts: number[] = [];
  for (let i = 0; i < 8; i++) {
    const a = rot + (i * Math.PI) / 4;
    const d = i % 2 ? w : i % 4 === 0 ? r : r2;
    pts.push(x + Math.cos(a) * d, y + Math.sin(a) * d);
  }
  g.poly(pts).fill({ color, alpha });
}

/** A flare: a violet star behind a white one, a fainter diagonal star between
 *  its arms, a hot dot at the heart. `wide` stretches it along `rot`. */
function flare(g: Graphics, x: number, y: number, r: number, alpha: number, rot = 0, wide = 1) {
  if (alpha <= 0.01 || r < 0.5) return;
  star(g, x, y, r * 1.3 * wide, r * 1.3, r * 0.22, rot, VIOLET, alpha * 0.45);
  star(g, x, y, r * 0.55, r * 0.55, r * 0.08, rot + Math.PI / 4, LILAC, alpha * 0.6);
  star(g, x, y, r * wide, r, r * 0.07, rot, WHITE, alpha);
  g.circle(x, y, r * 0.18).fill({ color: WHITE, alpha });
}

/** Spokes of light out of `c`: thin wedges from `r0` out to `r1`, long and
 *  short in turn, turned by `spin`. */
function spokes(g: Graphics, c: Pt, n: number, r0: number, r1: number, w: number, spin: number, color: number, alpha: number) {
  if (alpha <= 0.01 || r1 <= r0) return;
  for (let i = 0; i < n; i++) {
    const a = spin + (i / n) * TAU, len = r0 + (r1 - r0) * (i % 2 ? 0.55 : 1);
    const ca = Math.cos(a), sa = Math.sin(a), hw = (w * (i % 2 ? 0.7 : 1)) / 2;
    g.poly([
      c.x + ca * r0 - sa * hw, c.y + sa * r0 + ca * hw,
      c.x + ca * len, c.y + sa * len,
      c.x + ca * r0 + sa * hw, c.y + sa * r0 - ca * hw,
    ]).fill({ color, alpha });
  }
}

/** The target the burst is aimed at: the one the others stand round. The
 *  rules hit it and everything adjacent to it for the same damage, and the
 *  game lists targets in no particular order — so it is the one nearest all
 *  the rest, then the hardest hit, then the first. */
function mainTarget(m: SigMoment): number {
  let best = 0, bestScore = Infinity;
  m.targets.forEach((r, i) => {
    const p = centre(r);
    let sum = 0;
    for (const q of m.targets) { const o = centre(q); sum += Math.hypot(o.x - p.x, o.y - p.y); }
    const score = sum - (m.power[i] ?? 1) * m.size * 0.01;
    if (score < bestScore - 1e-6) { bestScore = score; best = i; }
  });
  return best;
}

/** Where a shell `r` out from `c` would be at angle `a`, held inside the
 *  board: the light floods the board up to its edges, never over them. */
function onBoard(c: Pt, r: number, a: number, b: Box): Pt {
  return {
    x: Math.min(b.x + b.w, Math.max(b.x, c.x + Math.cos(a) * r)),
    y: Math.min(b.y + b.h, Math.max(b.y, c.y + Math.sin(a) * r)),
  };
}

/** A card the burst reaches: a flare on it, a ring, needles of light and a
 *  glow, sized by what it took. */
function strike(t: FxTools, r: Box, power: number, s: number, big: boolean) {
  const c = centre(r), k = Math.max(0.55, Math.min(1.6, power));
  // A small hit keeps a floor under its flare: at a 2-damage chip's size a
  // flare in a ring reads as a crosshair, not a star going off.
  const fk = Math.max(0.85, k);
  const D = big ? 0.5 : 0.38, rot = rand(-0.2, 0.2);
  t.draw(D, (g, u) => {
    const a = Math.pow(1 - u, 1.4), grow = 0.55 + 0.45 * Math.min(1, u * 6);
    flare(g, c.x, c.y, s * (big ? 0.42 : 0.32) * fk * grow, a, rot, 1.5);
  });
  t.ring(r, big ? LILAC : VIOLET, 0.4, (big ? 1.2 : 1.1) * fk, big ? 0.45 : 0.32, big ? 4 : 2);
  t.glow(r, VIOLET, (big ? 0.45 : 0.3) * Math.min(1.2, k), big ? 0.5 : 0.4, 1.05);
  const n = Math.round((big ? 18 : 9) * k);
  for (let i = 0; i < n; i++) {
    const a = rot + (i % 4) * (Math.PI / 2) + rand(-0.15, 0.15), v = rand(220, 420) * (s / 90);
    t.spark(c.x + Math.cos(a) * s * 0.1, c.y + Math.sin(a) * s * 0.1, Math.cos(a) * v, Math.sin(a) * v, rand(0.15, 0.3), NEEDLE);
  }
}

/** A card the burst killed: its light drawn in to a point and put out. */
function snuff(t: FxTools, r: Box, s: number) {
  const c = centre(r);
  t.draw(0.3, (g, u) => {
    const e = u * u;
    g.circle(c.x, c.y, s * 0.55 * (1 - e) + 1).stroke({ width: 2 + 2 * e, color: LILAC, alpha: 0.8 * (1 - 0.3 * u) });
    if (u > 0.75) star(g, c.x, c.y, s * 0.25 * (1 - u) * 4, s * 0.25 * (1 - u) * 4, s * 0.02, 0, WHITE, 1);
  }, { delay: 0.45 });
}

export const SUPERNOVA: Signature = {
  shake: 1.5,

  deliver(t: FxTools, m: SigMoment, seconds: number) {
    const c = centre(m.from), s = m.size, T = seconds, spin0 = rand(0, TAU);
    // Arriving, the star first has to kindle on the empty square: it swells
    // out of nothing before it collapses. On the board it is already there.
    const born = m.arriving ? 0.45 : 0;
    t.charge(c, s * 1.3, VIOLET, 0.5, T);
    t.draw(T, (g, u) => {
      const time = u * T;
      const kindle = born > 0 ? easeOut(clamp01(u / born)) : 1;
      const k = clamp01((u - born * 0.6) / (1 - born * 0.6));
      const e = k * k; // the collapse quickens
      const R = s * (0.46 - 0.36 * e) * kindle;
      const bright = (0.45 + 0.55 * k) * kindle;
      const flick = 1 + 0.1 * k * Math.sin(time * 70);
      // The rays, drawn back in: long spokes whose tips retract into it.
      spokes(g, c, 12, R * 0.9, (s * (1.15 - 0.95 * e) + R * 0.5) * kindle, s * 0.08 * (1 - 0.5 * e), spin0 + time * 1.5, VIOLET, 0.45 * kindle);
      spokes(g, c, 12, R * 0.9, (s * (0.9 - 0.75 * e) + R * 0.3) * kindle, s * 0.03, spin0 + time * 1.5, WHITE, 0.55 * kindle);
      // Its body: violet round a white heart, smaller and hotter by the frame.
      g.circle(c.x, c.y, R * 1.7).fill({ color: DEEP, alpha: 0.2 * bright });
      g.circle(c.x, c.y, R).fill({ color: VIOLET, alpha: 0.4 * bright });
      g.circle(c.x, c.y, R * 0.6).fill({ color: LILAC, alpha: 0.65 * bright });
      g.circle(c.x, c.y, Math.max(1.5, R * 0.32 * flick)).fill({ color: WHITE, alpha: 0.95 * kindle });
      // A halo closing on it.
      const hr = s * (0.95 - 0.72 * easeOut(k)) * kindle;
      g.circle(c.x, c.y, hr).stroke({ width: 2, color: LILAC, alpha: 0.7 * kindle * (0.4 + 0.6 * k) });
      if (k > 0.55) star(g, c.x, c.y, s * 0.55 * (k - 0.55), s * 0.55 * (k - 0.55), s * 0.018, spin0, WHITE, 0.9);
    });
    // Motes of light falling into it from all round, timed to reach it as
    // they die.
    let acc = 0;
    t.draw(T, (_g, u, dt) => {
      if (u > 0.92) return;
      acc += dt * 70 * t.quality;
      for (; acc >= 1; acc--) {
        const a = rand(0, TAU), R = s * rand(0.7, 1.35), life = rand(0.16, 0.3);
        const x = c.x + Math.cos(a) * R, y = c.y + Math.sin(a) * R;
        t.spark(x, y, (c.x - x) / life, (c.y - y) / life, life, INFALL);
      }
    });
  },

  land(t: FxTools, m: SigMoment) {
    const c = centre(m.from), s = m.size;
    // Whatever it aims at, the star flares as it fires and sheds a little of
    // itself: it pays five for every burst.
    t.draw(0.34, (g, u) => flare(g, c.x, c.y, s * 0.6 * (1 - 0.5 * u), Math.pow(1 - u, 1.3), 0, 1.6));
    for (let i = 0; i < 10; i++) {
      const a = rand(0, TAU), v = rand(30, 80) * (s / 90);
      t.spark(c.x + Math.cos(a) * s * 0.3, c.y + Math.sin(a) * s * 0.3, Math.cos(a) * v, Math.sin(a) * v - 20, rand(0.5, 0.9), SHED);
    }
    if (m.arriving) { nova(t, m); return; }
    if (m.targets.length === 0) { burst(t, c, s * 1.3, s, 1); return; }

    // THE BEAM: fired in two frames, held while it sears, then thinning to a
    // thread and gone. Light pulses down it from the star to the target.
    const mi = mainTarget(m), main = centre(m.targets[mi]);
    const FIRE = 0.06, HOLD = 0.3, GONE = 0.46;
    const w0 = s * 0.2 * Math.min(1.3, Math.max(0.8, m.power[mi] ?? 1));
    t.draw(GONE, (g, u) => {
      const time = u * GONE;
      const head = lerpPt(c, main, clamp01(time / FIRE));
      const thin = time < HOLD ? 1 : Math.pow(1 - (time - HOLD) / (GONE - HOLD), 1.5);
      const w = w0 * thin * (1 + 0.12 * Math.sin(time * 90));
      g.moveTo(c.x, c.y).lineTo(head.x, head.y).stroke({ width: w * 3.2, color: DEEP, alpha: 0.22 * thin });
      g.moveTo(c.x, c.y).lineTo(head.x, head.y).stroke({ width: w * 1.7, color: VIOLET, alpha: 0.45 * thin });
      g.moveTo(c.x, c.y).lineTo(head.x, head.y).stroke({ width: w * 0.95, color: LILAC, alpha: 0.8 * thin });
      g.moveTo(c.x, c.y).lineTo(head.x, head.y).stroke({ width: Math.max(1, w * 0.45), color: WHITE, alpha: thin });
      // Pulses of light running down it, star to target: streaks, not beads.
      if (time > FIRE) {
        for (let i = 0; i < 4; i++) {
          const f = (i / 4 + time * 3.2) % 1, a = lerpPt(c, main, Math.max(0, f - 0.09)), b = lerpPt(c, main, f);
          g.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ width: w * 1.05, color: WHITE, alpha: 0.5 * thin * Math.sin(Math.PI * f) });
        }
      }
      if (time < FIRE) flare(g, head.x, head.y, s * 0.2, 1, Math.atan2(main.y - c.y, main.x - c.x), 1.8);
    });

    // THE STARBURST where it strikes, its shell out over every card adjacent.
    const others = m.targets.map((r, i) => ({ r, i, p: centre(r) })).filter((h) => h.i !== mi);
    const reach = Math.max(s * 1.3, ...others.map((h) => Math.hypot(h.p.x - main.x, h.p.y - main.y) + s * 0.45));
    const RUN = 0.3;
    t.later(FIRE, () => {
      burst(t, main, reach, s, m.power[mi] ?? 1);
      strike(t, m.targets[mi], m.power[mi] ?? 1, s, true);
      if (m.killed[mi]) snuff(t, m.targets[mi], s);
      for (const h of others) {
        const at = clamp01((Math.hypot(h.p.x - main.x, h.p.y - main.y) - s * 0.2) / Math.max(1, reach - s * 0.2));
        t.later(RUN * (1 - Math.sqrt(1 - at * 0.999)), () => {
          strike(t, h.r, m.power[h.i] ?? 1, s, false);
          if (m.killed[h.i]) snuff(t, h.r, s);
        });
      }
    });
  },
};

/** A starburst at `c`: a flare, long spokes of light turning out of it, and a
 *  shell running out to `reach` — white-edged, gold-rimmed, violet behind —
 *  in 0.3s, then thinning away. */
function burst(t: FxTools, c: Pt, reach: number, s: number, power: number) {
  const k = Math.max(0.8, Math.min(1.4, power));
  const RUN = 0.3, D = 0.75, spin = rand(0, TAU);
  t.flash(c, LILAC, 0.5 * k * (s / 90));
  t.draw(D, (g, u) => {
    const time = u * D;
    const q = clamp01(time / RUN), r = s * 0.2 + (reach - s * 0.2) * easeOut(q);
    const fade = time < RUN ? 1 : Math.pow(1 - (time - RUN) / (D - RUN), 1.3);
    g.circle(c.x, c.y, r).fill({ color: DEEP, alpha: 0.16 * fade * (1 - 0.5 * q) });
    spokes(g, c, 16, s * 0.12, r * 1.25 + s * 0.2, s * 0.09, spin + time * 0.6, VIOLET, 0.5 * fade);
    spokes(g, c, 16, s * 0.12, r * 1.05 + s * 0.1, s * 0.035, spin + time * 0.6, WHITE, 0.7 * fade);
    g.circle(c.x, c.y, r).stroke({ width: 10 * (1 - q) + 3, color: VIOLET, alpha: 0.35 * fade });
    g.circle(c.x, c.y, r).stroke({ width: 3 * (1 - q) + 1.5, color: GOLD, alpha: 0.55 * fade });
    g.circle(c.x, c.y, r - 2).stroke({ width: 1.5, color: WHITE, alpha: 0.9 * fade });
    flare(g, c.x, c.y, s * 0.62 * k * (1 - 0.55 * u), Math.pow(1 - u, 1.2), spin, 1.4);
  });
  const n = Math.round(20 * k);
  for (let i = 0; i < n; i++) {
    const a = rand(0, TAU), v = rand(260, 480) * (s / 90);
    t.spark(c.x, c.y, Math.cos(a) * v, Math.sin(a) * v, rand(0.2, 0.36), NEEDLE);
  }
}

/** ITS FIRST LIGHT: the nova going off on the square it lands on, a shell of
 *  light flooding the whole board to its edges (its outline slides along an
 *  edge once it reaches one), and a spark on every opponent as it passes. */
function nova(t: FxTools, m: SigMoment) {
  const c = centre(m.from), s = m.size, b = m.board;
  const far = Math.max(...[[b.x, b.y], [b.x + b.w, b.y], [b.x, b.y + b.h], [b.x + b.w, b.y + b.h]]
    .map(([x, y]) => Math.hypot(x - c.x, y - c.y)));
  const RUN = 0.62, D = 0.9, N = 72;
  const at = (time: number) => s * 0.3 + (far - s * 0.3) * easeOut(clamp01(time / RUN));
  t.flash(c, LILAC, 0.6 * (s / 90));
  const spin = rand(0, TAU);
  t.draw(D, (g, u) => {
    const time = u * D, r = at(time);
    const fade = time < RUN * 0.6 ? 1 : Math.pow(1 - (time - RUN * 0.6) / (D - RUN * 0.6), 1.2);
    const rim: number[] = [];
    for (let i = 0; i < N; i++) {
      const p = onBoard(c, r, (i / N) * TAU, b);
      rim.push(p.x, p.y);
    }
    // Light behind the shell, thinning as it spreads.
    g.poly(rim).fill({ color: DEEP, alpha: 0.12 * fade * (1 - 0.6 * clamp01(time / RUN)) });
    g.poly(rim).stroke({ width: 12, color: VIOLET, alpha: 0.3 * fade });
    g.poly(rim).stroke({ width: 3, color: GOLD, alpha: 0.5 * fade });
    g.poly(rim).stroke({ width: 1.5, color: WHITE, alpha: 0.9 * fade });
    // Its first light: spokes out of the square, and the star at its heart.
    const e = clamp01(time / 0.4);
    spokes(g, c, 12, s * 0.15, s * (0.5 + 1.6 * easeOut(e)), s * 0.07, spin + time * 0.8, VIOLET, 0.5 * (1 - e));
    spokes(g, c, 12, s * 0.15, s * (0.4 + 1.3 * easeOut(e)), s * 0.03, spin + time * 0.8, WHITE, 0.7 * (1 - e));
  });
  for (let i = 0; i < 16; i++) {
    const a = rand(0, TAU), v = rand(260, 460) * (s / 90);
    t.spark(c.x, c.y, Math.cos(a) * v, Math.sin(a) * v, rand(0.2, 0.34), NEEDLE);
  }
  // A spark on every opponent as the shell reaches it.
  m.targets.forEach((r, i) => {
    const p = centre(r), d = Math.hypot(p.x - c.x, p.y - c.y);
    const f = clamp01((d - s * 0.3) / Math.max(1, far - s * 0.3));
    t.later(RUN * (1 - Math.sqrt(1 - f * 0.999)), () => {
      strike(t, r, m.power[i] ?? 0.55, s, false);
      if (m.killed[i]) snuff(t, r, s);
    });
  });
}
