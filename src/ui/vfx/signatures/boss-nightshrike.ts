/** NIGHTSHRIKE — Death From Above. "Dive two opponents for 9 DMG each" — you
 *  will hear one wingbeat; payment is due on the second.
 *
 *  A boss's move is a set piece, so this one owns the whole board for a moment.
 *  The DELIVERY is the wingbeat: night closing in over the field, then two
 *  great dark wings spreading over the boss's square — wider than three cards —
 *  raised, and brought down once, hard. The downstroke is a shockwave: a ring
 *  of wind thrown out flat across the board, gusts running out ahead of it,
 *  dust and black feathers torn loose. Then it is up and gone into the dark,
 *  and the first of two shrike-shaped shadows is falling out of the sky onto
 *  the nearer card — its shadow swelling on the card, a ring of moonlight
 *  closing on it, talons swinging forward at the last — onto the card as the
 *  delivery ends.
 *
 *  The LANDING is the payment, twice. Talons rake the first card — three dark
 *  wounds lit along their edges — with black feathers bursting off it; and a
 *  beat later the second shadow, already falling, comes down on the other card
 *  the same way, while the boss's wings snap down once more over its square:
 *  the second wingbeat. The night lifts as it lands.
 *
 *  Height is screen-up — the sky does not turn with the board — and the dives
 *  come out of it a little from the boss's side, so the slant says who sent
 *  them. Darkness is drawn for real, every dark shape rimmed in moonlight. */
import { centre, rand } from "../looks/base";
import type { Graphics } from "pixi.js";
import type { FxTools, Pt, SparkStyle } from "../looks/types";
import type { Signature, SigMoment } from "./types";

type Box = { x: number; y: number; w: number; h: number };

const TAU = Math.PI * 2;
/** Night — only ever on the dark layer. */
const INK = 0x07050e;
/** Moonlight on an edge; the violet of the dark; GALE's wind. */
const MOON = 0xe8e4ff, LILAC = 0xc4b4ff, VIOLET = 0x8a6ad8, CREAM = 0xfffaf0, PEACH = 0xffd9a0;
/** The body of a dark shape as the light layer sees it: a night-violet, so a
 *  wing over an empty square is a wing and not an outline. */
const DUSKY = 0x5c4c9c;

/** Dust torn up by the downstroke, curling in the wind it made. */
const EDDY: SparkStyle = { palette: [CREAM, PEACH, LILAC], gravity: -20, drag: 0.35, size: [6, 2], streak: true, swirl: 600 };
/** Moonlit grit flung off a talon strike. */
const CHIP: SparkStyle = { palette: [MOON, LILAC, VIOLET], gravity: 380, drag: 0.4, size: [6, 2], streak: true };

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeOut = (x: number) => 1 - (1 - x) * (1 - x);
/** 0 -> 1 as `u` runs from `a` to `b`. */
const span = (u: number, a: number, b: number) => clamp01((u - a) / (b - a));

/** How long each dive takes from the top of the sky to the card, s — fixed,
 *  not a share of the delivery, so the landing can pick up the second dive
 *  exactly where the delivery left it. */
const DIVE = 0.3;
/** The second payment lands this long after the first, s. */
const GAP = 0.2;

/** The dives, in the order they land: the nearer card first. */
function dives(m: SigMoment) {
  const c0 = centre(m.from), s = m.size;
  return m.targets.map((r, i) => ({ r, i, p: centre(r) }))
    .sort((a, b) => Math.hypot(a.p.x - c0.x, a.p.y - c0.y) - Math.hypot(b.p.x - c0.x, b.p.y - c0.y))
    .slice(0, 2)
    .map((d, n) => {
      // The top of its fall: high over the card, a little back toward the boss.
      const lat = Math.max(-1.2 * s, Math.min(1.2 * s, c0.x - d.p.x)) * 0.3;
      return { ...d, n, top: { x: d.p.x + lat, y: d.p.y - s * 2.1 } };
    });
}

/** Where a dive is `tau` s before it lands (0..DIVE): falling faster every
 *  frame, from its top to the card. */
function fall(top: Pt, p: Pt, tau: number): Pt {
  const f = clamp01(tau / DIVE), k = f * f;
  return { x: p.x + (top.x - p.x) * k, y: p.y + (top.y - p.y) * k };
}

// ── The bird ────────────────────────────────────────────────────────────────

/** A wing's outline, root to tip along +x, leading edge +y, in units of its
 *  length: a long arm, and the primaries splayed at the end like fingers. */
const WING = [0, 0.1, 0.3, 0.19, 0.6, 0.2, 0.85, 0.12, 1, 0, 0.95, -0.1, 0.86, -0.06, 0.88, -0.16, 0.77, -0.1, 0.78, -0.2,
  0.67, -0.13, 0.66, -0.22, 0.55, -0.16, 0.4, -0.2, 0.2, -0.17, 0, -0.1];

/** A wing from `root` out along angle `ang`, `len` long, on `side` (1 right,
 *  -1 left: mirrored so the leading edge is always the top one). */
function wing(root: Pt, ang: number, len: number, side: number): number[] {
  const ux = Math.cos(ang) * side, uy = Math.sin(ang), nx = uy * side, ny = -ux * side;
  const out: number[] = [];
  for (let i = 0; i < WING.length; i += 2) out.push(root.x + (ux * WING[i] - nx * WING[i + 1]) * len, root.y + (uy * WING[i] - ny * WING[i + 1]) * len);
  return out;
}

/** The shrike folded into a dive, beak first at (x, y) heading (ux, uy):
 *  the right half of its outline, (back, out) in units of its length. */
const DART = [0, 0, -0.14, 0.1, -0.24, 0.15, -0.48, 0.34, -1, 0.46, -0.8, 0.27, -0.62, 0.17, -0.7, 0.11, -0.92, 0.12, -0.88, 0];

function dart(x: number, y: number, ux: number, uy: number, len: number, half: number): number[] {
  const nx = -uy, ny = ux, n = DART.length / 2, out: number[] = [];
  const at = (i: number, side: number) => out.push(x + ux * DART[2 * i] * len + nx * DART[2 * i + 1] * half * side,
    y + uy * DART[2 * i] * len + ny * DART[2 * i + 1] * half * side);
  for (let i = 0; i < n; i++) at(i, 1);
  for (let i = n - 2; i >= 1; i--) at(i, -1);
  return out;
}

/** A dark shape made visible: filled with night on the dark layer (`dark`),
 *  then, on the light layer, a faint violet body and a moonlit edge. */
function shade(g: Graphics, pts: number[], a: number, dark: boolean) {
  if (a <= 0.01) return;
  if (dark) g.poly(pts).fill({ color: INK, alpha: 0.88 * a });
  else g.poly(pts).fill({ color: DUSKY, alpha: 0.5 * a }).stroke({ width: 1.6, color: MOON, alpha: 0.9 * a });
}

// ── Feathers, wounds ────────────────────────────────────────────────────────

interface Feather { x: number; y: number; vx: number; vy: number; rot: number; spin: number; ph: number; len: number; life: number }

/** How hard the air takes a feather's speed: it keeps 6% of it a second. */
const AIR = -Math.log(0.06);

/** Black feathers torn loose from `at`, flung out and caught by the air: a
 *  dark vane rimmed in moonlight, rocking as it falls. Each one's flight is
 *  worked out in closed form — flung speed dying away, a slow fall, a rock
 *  from side to side — so the dark vane and its lit rim, drawn on two layers,
 *  are always in the same place on the same frame. */
function feathers(t: FxTools, at: Pt, n: number, s: number, speed: [number, number], lift: number, D: number) {
  const k = s / 90, fall = (260 * k) / AIR, fs: Feather[] = [];
  for (let i = 0; i < Math.max(1, Math.round(n * t.quality)); i++) {
    const a = rand(0, TAU), v = rand(speed[0], speed[1]) * k;
    fs.push({ x: at.x, y: at.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - lift * k, rot: rand(0, TAU), spin: rand(-7, 7),
      ph: rand(0, TAU), len: s * rand(0.2, 0.28), life: D * rand(0.7, 1) });
  }
  const vane = (f: Feather, time: number): number[] => {
    const e = (1 - Math.exp(-AIR * time)) / AIR;
    const x = f.x + f.vx * e + ((26 * k) / 7) * (Math.sin(7 * time + f.ph) - Math.sin(f.ph));
    const y = f.y + fall * time + (f.vy - fall) * e;
    const r = f.rot + f.spin * time * 0.5 + 0.5 * Math.sin(time * 7 + f.ph);
    const ux = Math.cos(r), uy = Math.sin(r), nx = -uy, ny = ux, h = f.len / 2, w = f.len * 0.18;
    return [x - ux * h, y - uy * h, x + nx * w, y + ny * w, x + ux * h, y + uy * h, x - nx * w * 0.8, y - ny * w * 0.8];
  };
  const fade = (f: Feather, time: number) => Math.min(1, (1 - time / f.life) * 2.5);
  t.draw(D, (g, u) => {
    const time = u * D;
    for (const f of fs) if (time < f.life) g.poly(vane(f, time)).fill({ color: INK, alpha: 0.85 * fade(f, time) });
  }, { dark: true });
  t.draw(D, (g, u) => {
    const time = u * D;
    for (const f of fs) {
      if (time >= f.life) continue;
      const a = fade(f, time), v = vane(f, time);
      g.poly(v).stroke({ width: 1.2, color: MOON, alpha: 0.85 * a });
      g.moveTo(v[0], v[1]).lineTo(v[4], v[5]).stroke({ width: 1, color: LILAC, alpha: 0.7 * a });
    }
  });
}

/** A talon wound along a curve (`c` = p0, control, p2): sharp at both ends,
 *  widest mid-way, laid down up to `drawn` of its length so it tears. */
function gash(g: Graphics, c: number[], w: number, drawn: number, color: number, alpha: number) {
  if (drawn <= 0 || alpha <= 0.01) return;
  const n = 10, left: number[] = [], right: number[] = [];
  for (let i = 0; i <= n; i++) {
    const s = (i / n) * drawn, q = 1 - s;
    const x = q * q * c[0] + 2 * q * s * c[2] + s * s * c[4], y = q * q * c[1] + 2 * q * s * c[3] + s * s * c[5];
    const tx = q * (c[2] - c[0]) + s * (c[4] - c[2]), ty = q * (c[3] - c[1]) + s * (c[5] - c[3]), tl = Math.hypot(tx, ty) || 1;
    const hw = (w / 2) * Math.pow(Math.sin(Math.PI * s), 0.7);
    left.push(x - (ty / tl) * hw, y + (tx / tl) * hw);
    right.push(x + (ty / tl) * hw, y - (tx / tl) * hw);
  }
  for (let i = n; i >= 0; i--) left.push(right[2 * i], right[2 * i + 1]);
  g.poly(left).fill({ color, alpha });
}

// ── The dive ────────────────────────────────────────────────────────────────

/** A dive falling for the stretch `tau0`..`tau1` s before it lands: the
 *  shrike's shadow-shape stooping out of the sky with talons swung forward at
 *  the last, and its shadow swelling on the card under a closing ring. The
 *  delivery and the landing each draw their own stretch of the same dive. */
function drawDive(t: FxTools, top: Pt, p: Pt, s: number, tau0: number, tau1: number, delay: number) {
  const D = tau0 - tau1;
  if (D <= 0.001) return;
  const dx = p.x - top.x, dy = p.y - top.y, dl = Math.hypot(dx, dy) || 1, ux = dx / dl, uy = dy / dl;
  const tauAt = (u: number) => tau0 - u * D;
  const bird = (tau: number, dark: boolean, g: Graphics) => {
    const q = fall(top, p, tau), a = Math.min(1, (DIVE - tau) * 12);
    shade(g, dart(q.x, q.y, ux, uy, s * 0.95, s * 0.62), a, dark);
    return { q, a };
  };
  t.draw(D, (g, u) => {
    const tau = tauAt(u), f = 1 - tau / DIVE;
    // Its shadow on the card, swelling as it comes.
    const r = s * (0.14 + 0.3 * f * f);
    g.ellipse(p.x, p.y + s * 0.08, r * 1.3, r * 0.75).fill({ color: INK, alpha: 0.2 + 0.4 * f });
    bird(tau, true, g);
  }, { dark: true, delay });
  t.draw(D, (g, u) => {
    const tau = tauAt(u), f = 1 - tau / DIVE, { q, a } = bird(tau, false, g);
    // The line it falls down, dark streaming off it.
    const back = Math.min(Math.hypot(q.x - top.x, q.y - top.y), s * 1.4) + s * 0.6;
    for (const o of [-0.26, 0, 0.26])
      g.moveTo(q.x - ux * s * 0.7 - uy * o * s, q.y - uy * s * 0.7 + ux * o * s).lineTo(q.x - ux * back - uy * o * s * 1.3, q.y - uy * back + ux * o * s * 1.3)
        .stroke({ width: o ? 1.4 : 2.2, color: o ? LILAC : MOON, alpha: (o ? 0.4 : 0.55) * a });
    // Talons swung forward at the last.
    const talon = span(f, 0.72, 0.95);
    if (talon > 0)
      for (let i = -1; i <= 1; i++) {
        const ang = Math.atan2(uy, ux) + i * 0.42 * talon, L = s * 0.28 * talon;
        const bx = q.x - uy * i * s * 0.1, by = q.y + ux * i * s * 0.1;
        g.moveTo(bx, by).quadraticCurveTo(bx + Math.cos(ang) * L, by + Math.sin(ang) * L, bx + Math.cos(ang + i * 0.6 + 0.4) * L * 0.9, by + Math.sin(ang + i * 0.6 + 0.4) * L * 0.9)
          .stroke({ width: 2.4, color: MOON, alpha: a, cap: "round" });
      }
    // A ring of moonlight closing on the card, and the rim of its shadow.
    g.circle(p.x, p.y, s * (1.1 - 0.52 * easeOut(f))).stroke({ width: 2, color: LILAC, alpha: 0.75 * Math.min(1, f * 2.5) });
    const r = s * (0.14 + 0.3 * f * f);
    g.ellipse(p.x, p.y + s * 0.08, r * 1.3, r * 0.75).stroke({ width: 1.4, color: MOON, alpha: 0.4 + 0.4 * f });
  }, { delay });
}

/** A dive landing: talons raking the card — three dark wounds lit along their
 *  edges — black feathers bursting off it, a ring of moonlight and a gust
 *  thrown out flat. */
function talons(t: FxTools, r: Box, from: Pt, power: number, killed: boolean) {
  const p = centre(r), s = Math.min(r.w, r.h), k = s / 90, kk = Math.max(0.8, Math.min(1.6, power)) * (killed ? 1.15 : 1);
  const down = Math.atan2(p.y - from.y, p.x - from.x), ux = Math.cos(down + 0.35), uy = Math.sin(down + 0.35), nx = -uy, ny = ux;
  const L = s * 0.46 * kk, gap = s * 0.2, bow = L * 0.3;
  const claws = [-1, 0, 1].map((i) => {
    const mx = p.x + nx * gap * i, my = p.y + ny * gap * i, len = L * (i ? 0.85 : 1);
    return [mx - ux * len, my - uy * len, mx - nx * bow, my - ny * bow, mx + ux * len, my + uy * len];
  });
  const drawn = (time: number, j: number) => span(time, j * 0.03, j * 0.03 + 0.08);
  t.flash(p, LILAC, 0.45 + 0.1 * kk);
  t.draw(0.6, (g, u) => {
    const time = u * 0.6, f = 1 - span(time, 0.3, 0.6);
    claws.forEach((c, j) => gash(g, c, 15 * kk, drawn(time, j), INK, 0.75 * f));
  }, { dark: true });
  t.draw(0.5, (g, u) => {
    const time = u * 0.5, f = 1 - span(time, 0.16, 0.5);
    claws.forEach((c, j) => {
      gash(g, c, 6.5 * kk, drawn(time, j), VIOLET, 0.95 * f);
      gash(g, c, 2.2, drawn(time, j), MOON, f);
    });
    // The downdraft of it, thrown out flat round the card.
    const e = easeOut(clamp01(time / 0.3));
    g.circle(p.x, p.y, s * (0.4 + 1.1 * e * kk)).stroke({ width: 4 * (1 - e) + 1, color: MOON, alpha: 0.8 * (1 - e) });
  });
  feathers(t, p, 8 * kk, s, [140, 280], 150, 1.0);
  for (let i = 0; i < Math.round(12 * kk * t.quality); i++) {
    const a = rand(0, TAU), v = rand(150, 300) * k;
    t.spark(p.x, p.y, Math.cos(a) * v, Math.sin(a) * v - rand(40, 120) * k, rand(0.3, 0.5), CHIP);
  }
}

/** The boss's wings, beating once over its square: spreading and raised over
 *  `up` s, brought down hard over `down` s, then folding away over `gone` s —
 *  drawn `scale` large, `alpha` strong. */
function wingbeat(t: FxTools, c: Pt, s: number, o: { up: number; down: number; gone: number; scale: number; alpha: number; delay?: number }) {
  const D = o.up + o.down + o.gone;
  const pose = (u: number) => {
    const time = u * D;
    const raise = easeOut(span(time, 0, o.up)), beat = span(time, o.up, o.up + o.down), fold = span(time, o.up + o.down, D);
    const ang = -0.45 * raise + 0.95 * beat * beat - 0.2 * fold, len = s * 1.65 * o.scale * (0.55 + 0.45 * raise) * (1 - 0.35 * fold);
    const a = o.alpha * Math.min(1, time / 0.05) * (1 - fold);
    return { ang, len, a };
  };
  const both = (g: Graphics, u: number, dark: boolean) => {
    const { ang, len, a } = pose(u);
    for (const side of [1, -1]) shade(g, wing({ x: c.x + side * s * 0.14, y: c.y - s * 0.05 }, ang, len, side), a, dark);
  };
  t.draw(D, (g, u) => both(g, u, true), { dark: true, delay: o.delay });
  t.draw(D, (g, u) => both(g, u, false), { delay: o.delay });
}

export const NIGHTSHRIKE: Signature = {
  shake: 1.8,
  // It never walks up to anything: it beats once, and the sky does the rest.
  lunge: false,

  deliver(t: FxTools, m, seconds) {
    const T = seconds, s = m.size, k = s / 90, c0 = centre(m.from), B = m.board, seed = rand(0, TAU);
    const plan = dives(m);

    // NIGHT closing in over the field — lifting again as the payments land.
    t.draw(T, (g, u) => {
      g.rect(B.x, B.y, B.w, B.h).fill({ color: INK, alpha: 0.26 * easeOut(span(u, 0.05, 0.4)) });
    }, { dark: true });

    // THE WINGBEAT: spread and raised, then brought down hard...
    const up = T * 0.14, down = T * 0.12;
    wingbeat(t, c0, s, { up, down, gone: T * 0.26, scale: 1, alpha: 1 });
    // ...and the shockwave off the downstroke: a ring of wind thrown out flat
    // across the board, gusts running ahead of it, dust and feathers torn up.
    t.later(up + down, () => {
      const R = Math.max(B.w, B.h) * 0.75;
      t.draw(0.55, (g, u) => {
        const e = easeOut(u), f = 1 - u;
        g.circle(c0.x, c0.y, s * 0.5 + R * e).stroke({ width: 6 * f + 1, color: CREAM, alpha: 0.7 * f });
        g.circle(c0.x, c0.y, s * 0.4 + R * 0.8 * e).stroke({ width: 2, color: LILAC, alpha: 0.5 * f });
        for (let i = 0; i < 10; i++) {
          const a = seed + (i / 10) * TAU, r0 = s * 0.5 + R * e * 0.55, r1 = s * 0.5 + R * e;
          g.moveTo(c0.x + Math.cos(a) * r0, c0.y + Math.sin(a) * r0).lineTo(c0.x + Math.cos(a + 0.12) * r1, c0.y + Math.sin(a + 0.12) * r1)
            .stroke({ width: 2, color: PEACH, alpha: 0.6 * f, cap: "round" });
        }
      });
      for (let i = 0; i < Math.round(20 * t.quality); i++) {
        const a = rand(0, TAU), v = rand(180, 320) * k;
        t.spark(c0.x + Math.cos(a) * s * 0.4, c0.y + Math.sin(a) * s * 0.4, Math.cos(a) * v, Math.sin(a) * v, rand(0.3, 0.5), EDDY);
      }
      feathers(t, c0, 5, s, [120, 240], 120, 0.9);
    });

    // THE DIVES: the first onto the nearer card as the delivery ends; the
    // second already falling as it does — the landing picks it up.
    plan.forEach((d) => {
      const lands = T + d.n * GAP; // s after the delivery starts
      const start = Math.max(up + down, lands - DIVE);
      drawDive(t, d.top, d.p, s, lands - start, Math.max(0, lands - T), start);
    });
  },

  land(t: FxTools, m) {
    const s = m.size, c0 = centre(m.from), B = m.board;
    const plan = dives(m);

    // The night lifting.
    t.draw(0.45, (g, u) => {
      g.rect(B.x, B.y, B.w, B.h).fill({ color: INK, alpha: 0.26 * (1 - easeOut(u)) });
    }, { dark: true });

    for (const d of plan) {
      const at = d.n * GAP;
      // The second dive's last stretch, from where the delivery left it.
      if (at > 0) drawDive(t, d.top, d.p, s, at, 0, 0);
      t.later(at, () => talons(t, d.r, d.top, m.power[d.i] ?? 1, m.killed[d.i] ?? false));
      // Payment on the second: the wings snap down once more over its square.
      if (d.n === 1) wingbeat(t, c0, s, { up: 0.08, down: 0.08, gone: 0.22, scale: 0.8, alpha: 0.7, delay: at - 0.12 });
    }
  },
};
