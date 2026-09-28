/** BASILISK — Wither Coil. "5 DMG and DRAIN 2 max HP from up to 3 opponents
 *  within 2 spaces." It is not winning the fight. It is winning the wait.
 *
 *  The great serpent on its art: moss-grown scales, teal runes glowing along
 *  them, a glowing pool beneath its jaws. The DELIVERY is it uncoiling: the
 *  pool under it rippling teal, and a coil of its body snaking out to each
 *  card it wants, weaving as it comes, head first, eyes lit — arriving as the
 *  delivery ends. The LANDING is the wither: each coil loops round its card
 *  and TIGHTENS, twice, runes flaring; the life in the card is drawn out and
 *  runs back along the coil to the Basilisk as green-gold motes, which it
 *  swallows (its REGEN, its LIFESTEAL); the card withers where it stands —
 *  dulled, dried and cracking, flakes falling off it (the max HP it will not
 *  get back). Then the coils slacken and slide home.
 *
 *  The body is SOLID — scales on the normal-blend layer, a lit back and a dark
 *  edge, so it reads as a body over an empty square — and only the runes, the
 *  eyes and the stolen life are light. */
import { centre, rand } from "../looks/base";
import type { Graphics } from "pixi.js";
import type { FxTools, Pt, SparkStyle } from "../looks/types";
import type { Signature, SigMoment } from "./types";

type Box = SigMoment["from"];

const TAU = Math.PI * 2;
// The serpent: moss-dark scales, real colour on the normal-blend layer.
const SCALE = 0x33502a, SCALE_HI = 0x86a656, SCALE_LO = 0x18280f, EDGE = 0x08120a;
// Light (additive): its runes and eyes, and the life it steals.
const RUNE = 0x3fffd0, RUNE_CORE = 0xd8fff4, GOLD = 0xe8e070, SAP = 0x9fe070;
/** Withering, laid over a card: a dry, dead olive — only on the dark layer. */
const WITHER = 0x2e2610, DRY = 0xc8b070;
/** Flakes falling off a withered card. */
const FLAKE: SparkStyle = { palette: [0xf0e0a0, DRY, 0x7a6a38], gravity: 160, drag: 0.5, size: [6, 2], streak: false, swirl: 60 };
/** Life breaking off a card as it is drawn out. */
const MOTE: SparkStyle = { palette: [0xfff6c8, GOLD, SAP, RUNE], gravity: -30, drag: 0.5, size: [6, 2], streak: false };

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeOut = (x: number) => 1 - (1 - x) * (1 - x);
const smooth = (x: number) => x * x * (3 - 2 * x);
const N = 22;

/** A coil's course from `a` to `b`: bowed out to `side` and back, an S that
 *  a snake would take — its weave is added frame by frame, travelling along
 *  it (`phase`), dying out at both ends so it leaves the Basilisk and meets
 *  its card dead on. `upto` (0..1) lays out only that much of it. */
function course(a: Pt, b: Pt, side: number, phase: number, upto = 1): number[] {
  const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L, pts: number[] = [];
  for (let i = 0; i <= N; i++) {
    const f = (i / N) * upto, env = Math.sin(Math.PI * f);
    const off = (side * L * 0.16 * Math.sin(Math.PI * f * 2) + L * 0.035 * Math.sin(f * 7 - phase)) * env;
    pts.push(a.x + dx * f + nx * off, a.y + dy * f + ny * off);
  }
  return pts;
}

/** A coil round a card at `c`: from `a0` round by `turns`, winding in from
 *  `R` a little as it goes, so the second pass lies inside the first — a
 *  coil, not a ring — squashed a little flat so it lies on the board. */
function loop(c: Pt, R: number, a0: number, turns: number): number[] {
  const pts: number[] = [], n = 30;
  for (let i = 0; i <= n; i++) {
    const f = i / n, a = a0 + f * turns * TAU, rr = R * (1.06 - 0.2 * f) * (1 + 0.03 * Math.sin(a * 5));
    pts.push(c.x + Math.cos(a) * rr, c.y + Math.sin(a) * rr * 0.92);
  }
  return pts;
}

/** THE BODY along a centreline, `w` wide: scales on the normal-blend layer —
 *  a body, a shadowed flank, a lit back, chevrons across it, a dark edge —
 *  or (`lit`) its runes, a teal line down the spine glowing by `rune`. */
function body(g: Graphics, pts: number[], w: number, alpha: number, lit: boolean, rune = 1) {
  const n = pts.length / 2;
  if (n < 2 || alpha <= 0.02) return;
  const left: number[] = [], right: number[] = [], back: number[] = [], nrm: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1);
    const tx = pts[b * 2] - pts[a * 2], ty = pts[b * 2 + 1] - pts[a * 2 + 1], l = Math.hypot(tx, ty) || 1;
    const nx = -ty / l, ny = tx / l, hw = (w / 2) * (i === n - 1 ? 0.7 : 1);
    nrm.push(nx, ny);
    left.push(pts[i * 2] + nx * hw, pts[i * 2 + 1] + ny * hw);
    right.unshift(pts[i * 2] - nx * hw, pts[i * 2 + 1] - ny * hw);
    // The back catches the light from above-left, whichever way it runs.
    const up = nx * -0.7 + ny * -0.7 > 0 ? 1 : -1;
    back.push(pts[i * 2] + nx * hw * 0.45 * up, pts[i * 2 + 1] + ny * hw * 0.45 * up);
  }
  const outline = left.concat(right);
  if (!lit) {
    g.poly(outline, true).fill({ color: SCALE, alpha });
    g.poly(back, false).stroke({ width: Math.max(1.2, w * 0.2), color: SCALE_HI, alpha: alpha * 0.8, join: "round" });
    // Chevrons of scale across the back.
    for (let i = 1; i < n - 1; i += 2) {
      const x = pts[i * 2], y = pts[i * 2 + 1], nx = nrm[i * 2], ny = nrm[i * 2 + 1];
      const tx = ny, ty = -nx, hw = w * 0.42;
      g.moveTo(x + nx * hw - tx * hw * 0.5, y + ny * hw - ty * hw * 0.5).lineTo(x, y).lineTo(x - nx * hw - tx * hw * 0.5, y - ny * hw - ty * hw * 0.5)
        .stroke({ width: 1, color: SCALE_LO, alpha: alpha * 0.9 });
    }
    g.poly(outline, true).stroke({ width: 1.3, color: EDGE, alpha });
    return;
  }
  // Runes down the spine: a mark every few scales, glowing teal.
  for (let i = 1; i < n - 1; i += 3) {
    const x = pts[i * 2], y = pts[i * 2 + 1], tx = nrm[i * 2 + 1], ty = -nrm[i * 2], L = w * 0.26;
    g.moveTo(x - tx * L, y - ty * L).lineTo(x + tx * L, y + ty * L).stroke({ width: 4, color: RUNE, alpha: 0.25 * rune * alpha });
    g.moveTo(x - tx * L, y - ty * L).lineTo(x + tx * L, y + ty * L).stroke({ width: 1.2, color: RUNE_CORE, alpha: 0.8 * rune * alpha });
  }
}

/** The head at the end of a centreline: a blunt wedge on the normal-blend
 *  layer, or (`lit`) its two teal eyes. */
function head(g: Graphics, pts: number[], w: number, alpha: number, lit: boolean) {
  const n = pts.length / 2;
  if (n < 2 || alpha <= 0.02) return;
  const x = pts[n * 2 - 2], y = pts[n * 2 - 1], px = pts[n * 2 - 4], py = pts[n * 2 - 3];
  const l = Math.hypot(x - px, y - py) || 1, ux = (x - px) / l, uy = (y - py) / l, nx = -uy, ny = ux;
  if (!lit) {
    const pts2 = [x + ux * w * 1.1, y + uy * w * 1.1, x + nx * w * 0.75 + ux * w * 0.2, y + ny * w * 0.75 + uy * w * 0.2,
      x + nx * w * 0.55 - ux * w * 0.4, y + ny * w * 0.55 - uy * w * 0.4, x - nx * w * 0.55 - ux * w * 0.4, y - ny * w * 0.55 - uy * w * 0.4,
      x - nx * w * 0.75 + ux * w * 0.2, y - ny * w * 0.75 + uy * w * 0.2];
    g.poly(pts2, true).fill({ color: SCALE, alpha }).stroke({ width: 1.3, color: EDGE, alpha });
    return;
  }
  for (const side of [-1, 1]) {
    const ex = x + nx * w * 0.38 * side + ux * w * 0.3, ey = y + ny * w * 0.38 * side + uy * w * 0.3;
    g.circle(ex, ey, w * 0.28).fill({ color: RUNE, alpha: 0.35 * alpha });
    g.circle(ex, ey, w * 0.12).fill({ color: RUNE_CORE, alpha: alpha });
  }
}

export const BASILISK: Signature = {
  shake: 1.3,
  // It does not strike across: its coils go out to them.
  lunge: false,

  deliver(t: FxTools, m: SigMoment, seconds: number) {
    const c = centre(m.from), s = m.size, S = seconds, W = s * 0.21;
    // THE POOL beneath its jaws, rippling out teal.
    t.draw(S, (g, v) => {
      for (let i = 0; i < 3; i++) {
        const q = (v * 1.6 + i / 3) % 1;
        g.ellipse(c.x, c.y + s * 0.2, s * (0.15 + 0.45 * q), s * (0.07 + 0.2 * q)).stroke({ width: 1.5, color: RUNE, alpha: 0.6 * (1 - q) * Math.min(1, v * 4) });
      }
    });
    t.glow(m.from, RUNE, 0.3, S, 1.0);
    // THE COILS: out to each card, head first, weaving — arriving on the
    // landing frame.
    const coils = m.targets.map((r, i) => {
      const p = centre(r), d = Math.hypot(p.x - c.x, p.y - c.y) || 1;
      const a = { x: c.x + ((p.x - c.x) / d) * s * 0.3, y: c.y + ((p.y - c.y) / d) * s * 0.3 };
      const end = { x: p.x - ((p.x - c.x) / d) * s * 0.55, y: p.y - ((p.y - c.y) / d) * s * 0.55 };
      return { a, end, side: i % 2 ? 1 : -1 };
    });
    const reach = (time: number) => smooth(clamp01(time / S));
    const shape = (k: (typeof coils)[number], time: number) => course(k.a, k.end, k.side, time * 9, reach(time));
    t.draw(S, (g, v) => {
      const time = v * S;
      for (const k of coils) {
        const p = shape(k, time);
        body(g, p, W, 1, false);
        head(g, p, W, 1, false);
      }
    }, { dark: true });
    t.draw(S, (g, v) => {
      const time = v * S;
      for (const k of coils) {
        const p = shape(k, time);
        body(g, p, W, 1, true, 0.6 + 0.4 * Math.sin(time * 12));
        head(g, p, W, 1, true);
      }
    });
  },

  land(t: FxTools, m: SigMoment) {
    const c = centre(m.from), s = m.size, W = s * 0.21, D = 1.3;
    // Each coil loops its card and tightens — twice — then slackens and
    // slides home.
    const coils = m.targets.map((r, i) => {
      const p = centre(r), d = Math.hypot(p.x - c.x, p.y - c.y) || 1;
      const a = { x: c.x + ((p.x - c.x) / d) * s * 0.3, y: c.y + ((p.y - c.y) / d) * s * 0.3 };
      const end = { x: p.x - ((p.x - c.x) / d) * s * 0.55, y: p.y - ((p.y - c.y) / d) * s * 0.55 };
      return { r, p, a, end, side: i % 2 ? 1 : -1, a0: Math.atan2(end.y - p.y, end.x - p.x), dir: i % 2 ? 1 : -1, power: m.power[i] ?? 1 };
    });
    const squeeze = (time: number) => {
      const k = time < 0.1 ? easeOut(time / 0.1) : 1;
      const pulse = 0.08 * Math.max(0, Math.sin(clamp01((time - 0.1) / 0.6) * Math.PI * 2));
      return 0.62 - 0.1 * k - pulse + 0.2 * clamp01((time - 0.9) / 0.4);
    };
    const hold = (time: number) => 1 - clamp01((time - 0.95) / 0.35);
    const home = (time: number) => 1 - 0.85 * easeOut(clamp01((time - 0.95) / 0.35));
    const draw = (lit: boolean) => (g: Graphics, v: number) => {
      const time = v * D, a = hold(time), rune = time < 0.9 ? 0.7 + 0.3 * Math.sin(time * 18) : 0.6;
      for (const k of coils) {
        const R = s * squeeze(time) * Math.max(0.9, Math.min(1.2, k.power));
        const ring = loop(k.p, R, k.a0, 1.45 * k.dir);
        body(g, course(k.a, k.end, k.side, 9 * 0.6 + time * 4, home(time)), W, a, lit, rune);
        body(g, ring, W, a, lit, rune);
        head(g, ring, W, a, lit);
      }
    };
    t.draw(D, draw(false), { dark: true });
    t.draw(D, draw(true));
    // THE WITHERING, on each card, and its life drawn home along the coil.
    coils.forEach((k) => wither(t, k.r, k.power, s));
    const LIFE = 0.5;
    const motes = coils.flatMap((k) => Array.from({ length: Math.round(7 * Math.max(0.5, t.quality)) }, (_, j) => ({ k, at: 0.18 + j * 0.07 + rand(0, 0.04) })));
    t.draw(D, (g, v) => {
      const time = v * D;
      for (const mo of motes) {
        const q = (time - mo.at) / LIFE;
        if (q <= 0 || q >= 1) continue;
        // From the card's coil back up its length to the Basilisk.
        const path = course(mo.k.a, mo.k.end, mo.k.side, 9 * 0.6 + time * 4, 1), f = 1 - smooth(q), n = path.length / 2 - 1;
        const i = Math.min(n - 1, Math.floor(f * n)), fr = f * n - i;
        const x = path[i * 2] + (path[i * 2 + 2] - path[i * 2]) * fr, y = path[i * 2 + 1] + (path[i * 2 + 3] - path[i * 2 + 1]) * fr;
        g.circle(x, y, s * 0.07).fill({ color: SAP, alpha: 0.3 });
        g.circle(x, y, s * 0.03).fill({ color: q < 0.5 ? 0xfff6c8 : GOLD, alpha: 0.95 });
      }
    });
    // It swallows what came home: its own glow, a green-gold ring.
    t.later(0.55, () => {
      t.glow(m.from, SAP, 0.5, 0.6, 1.15);
      t.ring(m.from, GOLD, 0.4, 1.1, 0.45, 3);
    });
  },
};

/** A card withering in the coil's grip: dulled and dried — a dead olive
 *  laid over it, the dry cracks running through it — its life breaking off it
 *  as motes, and dead flakes falling away. Sized by what it lost. */
function wither(t: FxTools, r: Box, power: number, s: number) {
  const c = centre(r), k = Math.max(0.7, Math.min(1.4, power)), D = 1.1;
  const cracks = Array.from({ length: 4 }, () => {
    let x = c.x + rand(-0.3, 0.3) * r.w, y = c.y + rand(-0.3, 0.3) * r.h, a = rand(0, TAU);
    const pts = [x, y];
    for (let i = 0; i < 4; i++) {
      a += rand(-0.7, 0.7);
      x += Math.cos(a) * s * 0.09;
      y += Math.sin(a) * s * 0.09;
      pts.push(x, y);
    }
    return pts;
  });
  const env = (time: number) => (time < 0.2 ? time / 0.2 : 1 - clamp01((time - 0.6) / 0.5));
  t.draw(D, (g, v) => {
    const a = env(v * D);
    g.rect(r.x + r.w * 0.08, r.y + r.h * 0.08, r.w * 0.84, r.h * 0.84).fill({ color: WITHER, alpha: 0.42 * a * k });
  }, { dark: true });
  t.draw(D, (g, v) => {
    const a = env(v * D), f = clamp01((v * D - 0.1) / 0.3);
    for (const p of cracks) g.poly(p.slice(0, Math.max(2, Math.round((p.length / 2) * f)) * 2), false).stroke({ width: 1.2, color: DRY, alpha: 0.7 * a });
  });
  for (let i = 0; i < Math.round(9 * k); i++)
    t.later(rand(0.15, 0.7), () => t.spark(r.x + rand(0.15, 0.85) * r.w, r.y + rand(0.3, 0.8) * r.h, rand(-20, 20) * (s / 90), rand(-10, 30) * (s / 90), rand(0.5, 0.8), FLAKE));
  for (let i = 0; i < Math.round(8 * k); i++)
    t.later(rand(0.1, 0.4), () => t.spark(c.x + rand(-0.3, 0.3) * r.w, c.y + rand(-0.3, 0.3) * r.h, rand(-25, 25) * (s / 90), -rand(20, 60) * (s / 90), rand(0.35, 0.55), MOTE));
  t.flash(c, SAP, 0.14 * k * (s / 80));
}
