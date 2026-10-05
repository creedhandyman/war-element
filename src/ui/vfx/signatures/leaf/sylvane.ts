/** SYLVANE — Emergence. "Spawn an Elephlora in an adjacent slot and heal all
 *  allies 4; each round the tree marches forward, hits an opponent for 3, and
 *  heals an ally 3." Her Emergence raises a walking tree that heals the line
 *  as it marches.
 *
 *  It aims at nothing, so there is no delivery: the LANDING is the whole
 *  move. The ribbons of golden light that swirl from her hands on her art
 *  stream from her to the slot beside her, cherry blossom riding them, and
 *  wind round it as the ground there breaks open. Out of it the Elephlora
 *  grows, as it stands on its own card: an elephant of twisted bark — legs
 *  rising out of the earth like two trunks, ears unfurling, ivory tusks, its
 *  trunk dropping and curling — and from its back the branches unfold into a
 *  canopy of pink blossom hung with fruit. Then it lifts its trunk and
 *  trumpets, and a soft pink-gold pulse rolls out from it across the line:
 *  every ally it passes glows as it is healed, and blossom falls on it.
 *
 *  Bark, ivory and blossom are SOLID, on the normal-blend layer — a body, a
 *  lit edge and a dark one, so the tree reads over an empty square as well as
 *  over a card — and only the ribbons, the highlights and the pulse are
 *  light. */
import { centre, rand } from "../../looks/base";
import type { Graphics } from "pixi.js";
import type { FxTools, Pt, SparkStyle } from "../../looks/types";
import type { Signature, SigMoment } from "../types";

type Box = SigMoment["from"];

const TAU = Math.PI * 2;
// Her ribbons, off her art: pale gold light, white at the core.
const WHITE = 0xfffbef, RIBBON = 0xfff0b0, GOLD = 0xffd36a;
// Cherry blossom, rose to blush.
const ROSE = 0xff7aa8, PINK = 0xffa8c8, BLUSH = 0xffd8e8;
// The Elephlora, solid: bark, its shadow, its lit edge, its outline; ivory;
// the canopy's blossom by depth; fruit.
const BARK = 0x7d5c36, BARK_LO = 0x45311b, BARK_HI = 0xc8a46c, BARK_EDGE = 0x1c1209;
const IVORY = 0xf3e6c8, IVORY_EDGE = 0x5c4a2c;
const BLOOM_DK = 0xb44f7d, BLOOM = 0xdc72a2, BLOOM_LT = 0xf2a2c4;
const APPLE = 0xd2303a, MOSS = 0x8fbf4a;
/** Gold glitter off the ribbons. */
const GLITTER: SparkStyle = { palette: [WHITE, RIBBON, GOLD], gravity: 20, drag: 0.5, size: [4, 1], streak: false };
/** Motes rising off a healed ally: blush and gold, curling. */
const MOTE: SparkStyle = { palette: [WHITE, BLUSH, PINK, GOLD], gravity: -90, drag: 0.6, size: [6, 2], streak: false, swirl: 120 };
const MOTE_L: SparkStyle = { ...MOTE, swirl: -120 };
/** Grit off the ground it breaks. */
const GRIT: SparkStyle = { palette: [0xe8d8b0, 0xb89468, 0x6e5a40], gravity: 900, drag: 0.6, size: [5, 2], streak: false };

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeOut = (x: number) => 1 - (1 - x) * (1 - x);
const smooth = (x: number) => x * x * (3 - 2 * x);
/** Overshoots a little and settles: a blossom popping open. */
const springOut = (x: number) => (x <= 0 ? 0 : 1 + 2.7 * Math.pow(x - 1, 3) + 1.7 * Math.pow(x - 1, 2));

/** The beats, s from the landing: the ribbons arrive and the ground breaks;
 *  it rises; its trunk goes up and the pulse leaves it; it fades back into
 *  its card. */
const BREAK = 0.17, RISE = 0.24, TRUMPET = 0.6, FADE = 0.84, GONE = 1.08;

/** A cherry-blossom petal: a teardrop wide at its tip, `open` how face-on it
 *  is, so a tumbling petal thins to a sliver and back. */
function petal(g: Graphics, x: number, y: number, len: number, ang: number, open: number, color: number, alpha: number) {
  if (alpha <= 0.02 || len < 1.5) return;
  const c = Math.cos(ang), s = Math.sin(ang), hx = c * len * 0.5, hy = s * len * 0.5, w = len * 0.5 * Math.max(0.15, open);
  const px = x + hx * 0.45, py = y + hy * 0.45;
  g.moveTo(x - hx, y - hy).quadraticCurveTo(px - s * w, py + c * w, x + hx, y + hy).quadraticCurveTo(px + s * w, py - c * w, x - hx, y - hy)
    .fill({ color, alpha });
}

/** A closed blob round (cx, cy): `rx` by `ry`, turned by `rot`. */
function blob(cx: number, cy: number, rx: number, ry: number, rot = 0, n = 16): number[] {
  const pts: number[] = [], c = Math.cos(rot), s = Math.sin(rot);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU, x = Math.cos(a) * rx, y = Math.sin(a) * ry;
    pts.push(cx + x * c - y * s, cy + x * s + y * c);
  }
  return pts;
}

/** A body round a point list: `w0` across where it starts, `w1` at its end. */
function taper(line: number[], w0: number, w1: number): number[] {
  const n = line.length / 2, left: number[] = [], right: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1);
    const tx = line[b * 2] - line[a * 2], ty = line[b * 2 + 1] - line[a * 2 + 1], l = Math.hypot(tx, ty) || 1;
    const hw = (w0 + ((w1 - w0) * i) / Math.max(1, n - 1)) / 2;
    left.push(line[i * 2] - (ty / l) * hw, line[i * 2 + 1] + (tx / l) * hw);
    right.unshift(line[i * 2] + (ty / l) * hw, line[i * 2 + 1] - (tx / l) * hw);
  }
  return left.concat(right);
}

/** A cubic from p0 to p3 sampled `n` times, only its first `upto` (0..1). */
function cubic(p0: Pt, p1: Pt, p2: Pt, p3: Pt, n: number, upto = 1): number[] {
  const out: number[] = [];
  for (let i = 0; i <= n; i++) {
    const u = (i / n) * upto, v = 1 - u, A = v * v * v, B = 3 * v * v * u, C = 3 * v * u * u, D = u * u * u;
    out.push(A * p0.x + B * p1.x + C * p2.x + D * p3.x, A * p0.y + B * p1.y + C * p2.y + D * p3.y);
  }
  return out;
}

// ── The Elephlora ────────────────────────────────────────────────────────────

/** How far grown each part of it is, 0..1, and how far its trunk is raised. */
interface Growth { rise: number; ears: number; ivory: number; trunk: number; boughs: number; bloom: number[]; fruit: number; raise: number; alpha: number }

/** Its canopy: blossom clusters on its back, in units of the square from its
 *  feet (x across, y up), each with its moment to pop and its depth. */
const PUFFS: { x: number; y: number; r: number; at: number; tone: number }[] = [
  { x: -0.37, y: 0.7, r: 0.11, at: 0.0, tone: 0 }, { x: 0.37, y: 0.7, r: 0.11, at: 0.02, tone: 0 },
  { x: -0.22, y: 0.78, r: 0.13, at: 0.03, tone: 0 }, { x: 0.22, y: 0.78, r: 0.13, at: 0.05, tone: 0 },
  { x: 0, y: 0.8, r: 0.15, at: 0.06, tone: 1 }, { x: -0.3, y: 0.86, r: 0.11, at: 0.08, tone: 1 },
  { x: 0.3, y: 0.86, r: 0.11, at: 0.09, tone: 1 }, { x: -0.12, y: 0.93, r: 0.12, at: 0.1, tone: 2 },
  { x: 0.12, y: 0.93, r: 0.12, at: 0.12, tone: 2 },
];
const FRUIT: Pt[] = [{ x: -0.3, y: 0.78 }, { x: 0.13, y: 0.9 }, { x: 0.34, y: 0.74 }, { x: -0.08, y: 0.84 }];
const BLOSSOM: Pt[] = [{ x: -0.36, y: 0.74 }, { x: -0.18, y: 0.9 }, { x: 0.05, y: 0.97 }, { x: 0.24, y: 0.84 }, { x: 0.4, y: 0.68 }, { x: -0.04, y: 0.8 }, { x: 0.18, y: 0.74 }];
const BOUGHS: Pt[] = [{ x: -0.32, y: 0.8 }, { x: -0.12, y: 0.92 }, { x: 0.12, y: 0.92 }, { x: 0.32, y: 0.8 }];

/** The Elephlora standing on (x0, y0), `s` the square: the SOLID body on the
 *  normal-blend layer, or (`lit`) its light — the ribbons' gold along its
 *  edges, blossom catching the light, the glint in its eyes. */
function elephlora(g: Graphics, x0: number, y0: number, s: number, k: Growth, lit: boolean) {
  const a = k.alpha;
  if (a <= 0.02 || k.rise <= 0.01) return;
  const P = (x: number, y: number): Pt => ({ x: x0 + x * s, y: y0 - y * s * k.rise });
  const poly = (pts: Pt[]) => pts.flatMap((p) => [p.x, p.y]);
  const bark = (pts: number[]) => {
    if (lit) return;
    g.poly(pts, true).fill({ color: BARK, alpha: a }).stroke({ width: 1.2, color: BARK_EDGE, alpha: 0.9 * a });
  };
  // Boughs from its back, unfolding up into where the canopy will be.
  if (k.boughs > 0)
    for (const b of BOUGHS) {
      const root = P(b.x * 0.15, 0.6), tip = P(b.x * k.boughs, 0.6 + (b.y - 0.6) * k.boughs);
      const line = [root.x, root.y, (root.x + tip.x) / 2 + (tip.x - root.x) * 0.1, (root.y + tip.y) / 2 + s * 0.02, tip.x, tip.y];
      if (!lit) g.poly(taper(line, s * 0.07, s * 0.025), true).fill({ color: BARK, alpha: a }).stroke({ width: 1, color: BARK_EDGE, alpha: 0.8 * a });
    }
  // The canopy: blossom by depth — the shadowed clusters first, the lit
  // crown last — hung with fruit.
  PUFFS.forEach((p, i) => {
    const pop = k.bloom[i];
    if (pop <= 0) return;
    const c = P(p.x, p.y), R = p.r * s * pop;
    if (!lit) {
      // A cluster, not a ball: a lumpy edge of florets.
      const pts: number[] = [];
      for (let j = 0; j < 14; j++) {
        const an = (j / 14) * TAU, rr = R * (0.86 + 0.14 * Math.cos(an * 5 + i * 1.7));
        pts.push(c.x + Math.cos(an) * rr, c.y + Math.sin(an) * rr);
      }
      g.poly(pts, true).fill({ color: p.tone === 0 ? BLOOM_DK : p.tone === 1 ? BLOOM : BLOOM_LT, alpha: 0.97 * a });
      return;
    }
    g.circle(c.x - R * 0.25, c.y - R * 0.3, R * 0.5).fill({ color: BLUSH, alpha: (p.tone === 2 ? 0.35 : 0.18) * a });
  });
  if (lit && k.bloom[k.bloom.length - 1] > 0.5)
    for (const b of BLOSSOM) {
      const c = P(b.x, b.y);
      for (let j = 0; j < 5; j++) {
        const an = (j / 5) * TAU;
        g.circle(c.x + Math.cos(an) * s * 0.018, c.y + Math.sin(an) * s * 0.018, s * 0.013).fill({ color: WHITE, alpha: 0.85 * a });
      }
    }
  if (k.fruit > 0)
    for (const f of FRUIT) {
      const c = P(f.x, f.y), R = s * 0.036 * k.fruit;
      if (!lit) g.circle(c.x, c.y, R).fill({ color: APPLE, alpha: a }).stroke({ width: 1, color: 0x4a0a10, alpha: 0.8 * a });
      else g.circle(c.x - R * 0.35, c.y - R * 0.35, R * 0.35).fill({ color: 0xffd2b0, alpha: 0.9 * a });
    }
  // Ears: leaf-fringed fans either side of its head, unfurling.
  if (k.ears > 0)
    for (const side of [-1, 1]) {
      const c = P(side * 0.25, 0.53), ear = blob(c.x, c.y, s * 0.12 * k.ears, s * 0.155 * (0.4 + 0.6 * k.ears), side * 0.35, 14);
      bark(ear);
      if (lit) g.poly(ear, true).stroke({ width: 1.2, color: MOSS, alpha: 0.55 * a });
      else g.poly(blob(c.x + side * s * 0.02, c.y + s * 0.01, s * 0.07 * k.ears, s * 0.1 * k.ears, side * 0.35, 10), true).fill({ color: BARK_LO, alpha: 0.7 * a });
    }
  // Its legs, risen out of the ground like two trunks, nails at their feet.
  for (const side of [-1, 1]) {
    const leg = poly([P(side * 0.29, 0), P(side * 0.05, 0), P(side * 0.075, 0.07), P(side * 0.09, 0.36), P(side * 0.26, 0.36), P(side * 0.275, 0.07)]);
    bark(leg);
    if (lit) {
      const e0 = P(side * 0.275, 0.07), e1 = P(side * 0.26, 0.34);
      g.moveTo(e0.x, e0.y).lineTo(e1.x, e1.y).stroke({ width: 1.2, color: GOLD, alpha: 0.6 * a });
    } else
      for (const nx of [0.24, 0.17, 0.1]) {
        const n = P(side * nx, 0.015);
        g.circle(n.x, n.y, s * 0.024).fill({ color: IVORY, alpha: 0.9 * a });
      }
  }
  // Body and head, bark twisted like the trunk of a tree.
  const body = blob(P(0, 0.42).x, P(0, 0.42).y, s * 0.27, s * 0.13 * k.rise);
  bark(body);
  const head = blob(P(0, 0.53).x, P(0, 0.53).y, s * 0.155, s * 0.15 * k.rise);
  bark(head);
  if (!lit) {
    for (const off of [-0.07, 0, 0.07]) {
      const p0 = P(off, 0.44), p1 = P(off + 0.03, 0.62);
      g.moveTo(p0.x, p0.y).quadraticCurveTo(p0.x + s * 0.03, (p0.y + p1.y) / 2, p1.x, p1.y).stroke({ width: 1, color: BARK_LO, alpha: 0.8 * a });
    }
    for (const side of [-1, 1]) {
      const e = P(side * 0.065, 0.56);
      g.circle(e.x, e.y, s * 0.02).fill({ color: BARK_EDGE, alpha: a });
    }
  } else {
    const h0 = P(-0.15, 0.5), h1 = P(-0.06, 0.66);
    g.moveTo(h0.x, h0.y).quadraticCurveTo(P(-0.15, 0.64).x, P(-0.15, 0.64).y, h1.x, h1.y).stroke({ width: 1.3, color: BARK_HI, alpha: 0.7 * a });
    for (const side of [-1, 1]) {
      const e = P(side * 0.065, 0.56);
      g.circle(e.x + s * 0.006, e.y - s * 0.006, s * 0.008).fill({ color: GOLD, alpha: a });
    }
  }
  // Ivory tusks, curving down and out from under its head.
  if (k.ivory > 0)
    for (const side of [-1, 1]) {
      const t = cubic(P(side * 0.06, 0.43), P(side * 0.09, 0.32), P(side * 0.15, 0.25), P(side * 0.22, 0.3), 8, k.ivory);
      if (!lit) g.poly(taper(t, s * 0.05, s * 0.012), true).fill({ color: IVORY, alpha: a }).stroke({ width: 1, color: IVORY_EDGE, alpha: 0.85 * a });
      else g.poly(t.slice(0, 10), false).stroke({ width: 1, color: WHITE, alpha: 0.6 * a });
    }
  // The trunk: hanging and curled at its tip — or raised, to trumpet.
  if (k.trunk > 0) {
    const r = k.raise;
    const tr = cubic(P(0, 0.47), P(0.02 * (1 - r) + 0.08 * r, 0.3 + 0.1 * r), P(0.0 + 0.2 * r, 0.16 + 0.42 * r), P(0.07 + 0.2 * r, 0.1 + 0.62 * r), 10, k.trunk);
    if (!lit) {
      g.poly(taper(tr, s * 0.1, s * 0.045), true).fill({ color: BARK, alpha: a }).stroke({ width: 1.2, color: BARK_EDGE, alpha: 0.9 * a });
      // Wrinkles across it.
      for (let i = 2; i < tr.length / 2 - 1; i += 2) {
        const x = tr[i * 2], y = tr[i * 2 + 1], tx = tr[i * 2 + 2] - tr[i * 2 - 2], ty = tr[i * 2 + 3] - tr[i * 2 - 1], l = Math.hypot(tx, ty) || 1;
        const w = s * (0.045 - 0.002 * i);
        g.moveTo(x - (ty / l) * w * 0.8, y + (tx / l) * w * 0.8).lineTo(x + (ty / l) * w * 0.8, y - (tx / l) * w * 0.8).stroke({ width: 1, color: BARK_LO, alpha: 0.85 * a });
      }
    } else g.poly(tr, false).stroke({ width: 1, color: BARK_HI, alpha: 0.45 * a });
  }
}

export const SYLVANE: Signature = {
  // It grows; nothing is struck.
  shake: 0.4,
  // She stays where she stands: the ribbons go, not her.
  lunge: false,

  land(t: FxTools, m: SigMoment) {
    const c = centre(m.from), s = m.size;
    const spawn = m.spawned[0] ?? m.allies[0] ?? { x: m.from.x + m.ahead.x * s, y: m.from.y + m.ahead.y * s, w: m.from.w, h: m.from.h };
    const tc = centre(spawn), x0 = tc.x, y0 = spawn.y + spawn.h * 0.94;
    t.glow(m.from, PINK, 0.3, 0.45, 1.05);
    ribbons(t, c, tc, s);
    // THE GROUND BREAKS where the ribbons go in.
    t.later(BREAK, () => breakGround(t, { x: x0, y: y0 - s * 0.05 }, s));
    // THE ELEPHLORA, grown out of it — solid, then lit.
    const grow = (time: number): Growth => {
      const at = (t0: number, d: number) => easeOut(clamp01((time - t0) / d));
      const pop = (t0: number) => springOut(clamp01((time - t0) / 0.12));
      return {
        rise: at(RISE, 0.22), ears: at(RISE + 0.1, 0.14), ivory: at(RISE + 0.13, 0.14), trunk: at(RISE + 0.12, 0.16),
        boughs: at(RISE + 0.08, 0.16), bloom: PUFFS.map((p) => pop(RISE + 0.16 + p.at)), fruit: pop(RISE + 0.32),
        raise: smooth(clamp01((time - TRUMPET + 0.08) / 0.1)) * (1 - smooth(clamp01((time - TRUMPET - 0.2) / 0.16))),
        alpha: 1 - clamp01((time - FADE) / (GONE - FADE)),
      };
    };
    // A stamp as it trumpets: it rocks back and comes down, which is what a
    // walking tree's first step looks like.
    const dip = (time: number) => s * 0.035 * Math.sin(Math.PI * clamp01((time - TRUMPET + 0.04) / 0.14));
    t.draw(GONE, (g, u) => {
      const time = u * GONE;
      if (time >= RISE) elephlora(g, x0, y0 + dip(time), s, grow(time), false);
    }, { dark: true });
    t.draw(GONE, (g, u) => {
      const time = u * GONE;
      if (time >= RISE) elephlora(g, x0, y0 + dip(time), s, grow(time), true);
    });
    helix(t, x0, y0, s);
    // THE TRUMPET: the pulse leaves it, and it sheds blossom as it settles.
    t.later(TRUMPET, () => {
      t.glow({ x: x0 - s * 0.45, y: y0 - s * 1.0, w: s * 0.9, h: s * 0.5 }, BLUSH, 0.3, 0.4, 1.0);
      const tip = { x: x0 + s * 0.27, y: y0 - s * 0.72 };
      t.flash(tip, RIBBON, 0.07 * (s / 80));
      // The call itself: three arcs of sound off the raised trunk.
      t.draw(0.36, (g, u) => {
        for (let i = 0; i < 3; i++) {
          const q = clamp01((u - i * 0.15) / 0.6);
          if (q <= 0 || q >= 1) continue;
          const R = s * (0.08 + 0.3 * easeOut(q));
          g.moveTo(tip.x + Math.cos(-1.35) * R, tip.y + Math.sin(-1.35) * R).arc(tip.x, tip.y, R, -1.35, 0.15).stroke({ width: 2, color: RIBBON, alpha: 0.9 * (1 - q) });
        }
      });
    });
    const healed = [m.from, ...m.allies.filter((r) => !m.spawned.some((p) => p.x === r.x && p.y === r.y))];
    pulse(t, { x: x0, y: y0 - s * 0.45 }, healed, s);
    fall(t, { x: x0, y: y0 - s * 0.8 }, s, FADE - 0.15);
  },
};

/** THE RIBBONS: three bands of golden light streaming from her to the slot
 *  beside her, braided about each other, each a flat ribbon turning over as
 *  it flies — swelling face-on, pinching edge-on — with blossom riding them;
 *  drawn in at the far end as the tail catches up. */
function ribbons(t: FxTools, a: Pt, b: Pt, s: number) {
  const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, nx = -uy, ny = ux;
  const A = { x: a.x + ux * s * 0.2, y: a.y + uy * s * 0.2 }, B = { x: b.x, y: b.y + s * 0.15 };
  const bands = [0.2, -0.16, 0.06].map((amp, i) => ({ amp: amp * Math.min(L, s * 2), waves: 1.6 + i * 0.4, ph: rand(0, TAU), tw: 2.2 + i * 0.5, tph: rand(0, TAU), w: s * (0.2 - i * 0.03), at: i * 0.025 }));
  const D = 0.3;
  const head = (time: number, at: number) => easeOut(clamp01((time - at) / 0.19));
  const tail = (time: number, at: number) => smooth(clamp01((time - at - 0.08) / 0.2));
  const at = (bd: (typeof bands)[number], f: number, time: number) => {
    const off = bd.amp * Math.sin(f * bd.waves * Math.PI + bd.ph - time * 10) * Math.sin(Math.PI * f);
    return { x: A.x + (B.x - A.x) * f + nx * off, y: A.y + (B.y - A.y) * f + ny * off };
  };
  let acc = 0;
  t.draw(D, (g, u, dt) => {
    const time = u * D;
    for (const bd of bands) {
      const f1 = head(time, bd.at), f0 = tail(time, bd.at);
      if (f1 - f0 < 0.01) continue;
      const N = 16, left: number[] = [], right: number[] = [], mid: number[] = [];
      for (let i = 0; i <= N; i++) {
        const f = f0 + ((f1 - f0) * i) / N, p = at(bd, f, time), q = at(bd, Math.min(1, f + 0.01), time);
        const tx = q.x - p.x, ty = q.y - p.y, l = Math.hypot(tx, ty) || 1;
        // Face-on it swells, edge-on it pinches: a ribbon turning over.
        const w = bd.w * (0.12 + 0.88 * Math.abs(Math.cos(f * bd.tw * Math.PI + bd.tph - time * 7))) * Math.sin(Math.PI * (i / N)) / 2;
        left.push(p.x - (ty / l) * w, p.y + (tx / l) * w);
        right.unshift(p.x + (ty / l) * w, p.y - (tx / l) * w);
        mid.push(p.x, p.y);
      }
      g.poly(left.concat(right), true).fill({ color: RIBBON, alpha: 0.42 }).stroke({ width: 1, color: GOLD, alpha: 0.85 });
      g.poly(mid, false).stroke({ width: 1, color: WHITE, alpha: 0.7 });
    }
    // Glitter off the leading band.
    acc += dt * 60 * t.quality;
    const f = head(time, 0);
    for (; acc >= 1; acc--) {
      const p = at(bands[0], f * rand(0.6, 1), time);
      t.spark(p.x, p.y, rand(-30, 30) * (s / 90), rand(-30, 30) * (s / 90), rand(0.25, 0.4), GLITTER);
    }
  });
  // Blossom riding them, then whirled round the slot and let fall.
  const n = Math.max(4, Math.round(9 * t.quality)), PD = 0.75;
  const ps = Array.from({ length: n }, (_, i) => ({ bd: bands[i % 3], at: i * 0.012, side: rand(-1, 1) * s * 0.08, spin: rand(7, 12) * (i % 2 ? 1 : -1),
    ph: rand(0, TAU), orb: rand(0.3, 0.5) * s, dir: i % 2 ? 1 : -1, len: s * rand(0.08, 0.11), color: i % 3 === 0 ? BLUSH : i % 3 === 1 ? PINK : ROSE }));
  t.draw(PD, (g, u) => {
    const time = u * PD;
    for (const p of ps) {
      const q = (time - p.at) / 0.22;
      if (q <= 0) continue;
      let x: number, y: number;
      if (q < 1) {
        const pt = at(p.bd, easeOut(q), time);
        x = pt.x + nx * p.side;
        y = pt.y + ny * p.side;
      } else {
        // Round the slot, loosening and falling.
        const w = time - p.at - 0.22, an = Math.atan2(A.y - B.y, A.x - B.x) + p.dir * w * 7;
        x = B.x + Math.cos(an) * p.orb * (1 + w);
        y = B.y + Math.sin(an) * p.orb * 0.6 * (1 + w) + w * w * s * 1.4;
      }
      const turn = Math.cos(time * p.spin + p.ph);
      petal(g, x, y, p.len, p.ph + time * p.spin * 0.4, 0.25 + 0.75 * Math.abs(turn), p.color, Math.min(1, q * 6) * (1 - u * u) * 0.95);
    }
  });
}

/** The ground breaking open where it comes up: a dark mouth in the earth,
 *  lit at its lip, clods and grit thrown off it, a flash of gold. */
function breakGround(t: FxTools, at: Pt, s: number) {
  t.flash(at, GOLD, 0.22 * (s / 80));
  t.draw(0.6, (g, u) => {
    const k = easeOut(clamp01(u / 0.2)), a = 1 - clamp01((u - 0.4) / 0.6);
    g.ellipse(at.x, at.y, s * 0.36 * k, s * 0.09 * k).fill({ color: 0x0c0804, alpha: 0.7 * a });
  }, { dark: true });
  t.draw(0.6, (g, u) => {
    const k = easeOut(clamp01(u / 0.2)), a = 1 - clamp01((u - 0.4) / 0.6);
    g.ellipse(at.x, at.y, s * 0.36 * k, s * 0.09 * k).stroke({ width: 1.4, color: 0xc8a46c, alpha: 0.8 * a });
    g.ellipse(at.x, at.y, s * 0.5 * k, s * 0.14 * k).stroke({ width: 1, color: GOLD, alpha: 0.5 * a });
  });
  const n = Math.round(12 * t.quality);
  for (let i = 0; i < n; i++) {
    const a = rand(-Math.PI * 0.95, -Math.PI * 0.05), v = rand(90, 200) * (s / 90);
    t.spark(at.x + rand(-0.3, 0.3) * s, at.y, Math.cos(a) * v, Math.sin(a) * v, rand(0.3, 0.5), GRIT);
  }
}

/** The ribbons winding round it as it grows: two strands of gold climbing
 *  it in a helix, dimmer where they pass behind. */
function helix(t: FxTools, x0: number, y0: number, s: number) {
  const D = TRUMPET - RISE + 0.1, ph = rand(0, TAU);
  t.draw(D, (g, u) => {
    const time = u * D, top = easeOut(clamp01(time / 0.26)), a = Math.min(1, u * 5) * (1 - clamp01((u - 0.5) / 0.35));
    for (let k = 0; k < 2; k++) {
      let prev: Pt | null = null, prevFront = false;
      for (let i = 0; i <= 24; i++) {
        const f = i / 24, th = ph + k * Math.PI + f * 2.4 * Math.PI - time * 14, R = s * (0.42 - 0.1 * f);
        const p = { x: x0 + Math.cos(th) * R, y: y0 - s * 0.05 - f * top * s * 0.9 + Math.sin(th) * R * 0.18 }, front = Math.sin(th) > 0;
        if (prev) {
          g.moveTo(prev.x, prev.y).lineTo(p.x, p.y).stroke({ width: prevFront ? 1.6 : 1, color: prevFront ? RIBBON : GOLD, alpha: (prevFront ? 0.8 : 0.25) * a * (1 - f * 0.5) });
        }
        prev = p;
        prevFront = front;
      }
    }
  }, { delay: RISE - 0.04 });
}

/** THE PULSE: a soft pink-gold ring rolling out from the tree across the
 *  line; every ally it passes glows as it is healed, blossom falling on it
 *  and motes rising off it. */
function pulse(t: FxTools, from: Pt, healed: Box[], s: number) {
  const hits = healed.map((r) => ({ r, d: Math.hypot(centre(r).x - from.x, centre(r).y - from.y) }));
  const reach = Math.max(s * 1.4, ...hits.map((h) => h.d + s * 0.4)), RUN = 0.34, D = RUN + 0.22, R0 = s * 0.3;
  const radius = (time: number) => R0 + (reach - R0) * easeOut(clamp01(time / RUN));
  const ph = rand(0, TAU);
  t.draw(D, (g, u) => {
    const time = u * D, r = radius(time), a = 1 - clamp01((time - RUN * 0.6) / (D - RUN * 0.6));
    g.circle(from.x, from.y, r).stroke({ width: s * 0.3, color: PINK, alpha: 0.08 * a });
    g.circle(from.x, from.y, Math.max(1, r - s * 0.05)).stroke({ width: s * 0.1, color: BLUSH, alpha: 0.1 * a });
    const far = 1 - 0.5 * clamp01((r - s * 1.2) / Math.max(1, reach - s * 1.2));
    g.circle(from.x, from.y, r).stroke({ width: 1.8, color: GOLD, alpha: 0.75 * a * far });
    // Petals riding the crest.
    for (let i = 0; i < 10; i++) {
      const an = ph + (i / 10) * TAU + time * 0.8;
      petal(g, from.x + Math.cos(an) * r, from.y + Math.sin(an) * r, s * 0.09, an + Math.PI / 2 + time * 6, 0.4 + 0.6 * Math.abs(Math.sin(time * 9 + i)),
        i % 2 ? PINK : BLUSH, 0.9 * a);
    }
  }, { delay: TRUMPET });
  for (const h of hits) {
    const q = clamp01((h.d - R0) / Math.max(1, reach - R0)), when = TRUMPET + RUN * (1 - Math.sqrt(1 - q));
    t.later(when, () => bless(t, h.r, s));
  }
}

/** An ally the pulse reached: a pink-gold glow and ring, blossom drifting
 *  down over it, motes curling up off it. */
function bless(t: FxTools, r: Box, s: number) {
  t.glow(r, 0xffc4dc, 0.38, 0.55, 1.1);
  t.ring(r, GOLD, 0.4, 1.05, 0.4, 2);
  const n = Math.round(7 * t.quality);
  for (let i = 0; i < n; i++)
    t.spark(r.x + rand(0.15, 0.85) * r.w, r.y + r.h * rand(0.5, 0.9), rand(-15, 15) * (s / 90), -rand(50, 95) * (s / 90), rand(0.45, 0.7), i % 2 ? MOTE : MOTE_L);
  const ps = Array.from({ length: 4 }, (_, i) => ({ x: r.x + r.w * (0.2 + 0.2 * i) + rand(-4, 4), y: r.y + rand(0, 0.25) * r.h, ph: rand(0, TAU), spin: rand(6, 10), len: s * rand(0.08, 0.1) }));
  t.draw(0.6, (g, u) => {
    const time = u * 0.6;
    for (const p of ps)
      petal(g, p.x + Math.sin(time * 6 + p.ph) * s * 0.05, p.y + time * s * 0.55, p.len, p.ph + time * 3, 0.3 + 0.7 * Math.abs(Math.cos(time * p.spin + p.ph)),
        PINK, Math.min(1, u * 8) * (1 - u * u));
  });
}

/** Blossom shed off the canopy as the tree settles back into its card. */
function fall(t: FxTools, at: Pt, s: number, delay: number) {
  const ps = Array.from({ length: Math.max(3, Math.round(7 * t.quality)) }, () => ({ x: at.x + rand(-0.4, 0.4) * s, y: at.y + rand(-0.12, 0.12) * s,
    vx: rand(-25, 25) * (s / 90), ph: rand(0, TAU), spin: rand(6, 11), len: s * rand(0.08, 0.11), color: Math.random() < 0.5 ? PINK : BLUSH }));
  t.draw(0.55, (g, u) => {
    const time = u * 0.55;
    for (const p of ps)
      petal(g, p.x + p.vx * time + Math.sin(time * 7 + p.ph) * s * 0.04, p.y + time * s * 0.7, p.len, p.ph + time * 3,
        0.3 + 0.7 * Math.abs(Math.cos(time * p.spin + p.ph)), p.color, Math.min(1, u * 8) * (1 - u * u) * 0.9);
  }, { delay });
}
