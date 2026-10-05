/** HOAX — Mark of Hoax. "Mark an opponent: while they have no shields every
 *  basic attack against them is a guaranteed CRIT, and they cannot be healed
 *  for the rest of the match." One opponent, anywhere, marked — politely.
 *
 *  Its art is a hooded hunter whose face is a grinning JACK-O'-LANTERN,
 *  pointing, an orange crosshair hanging in the air where he points, ravens,
 *  a huge orange harvest moon over a cornfield and carved pumpkins. So the
 *  DELIVERY is the point: the carved grin flares orange in the dark of his
 *  hood, candle-lit and flickering, and a thin orange line runs out from him
 *  to the one he has picked, arriving with the delivery.
 *
 *  The LANDING is the mark. An orange CROSSHAIR materialises over the card
 *  and tightens on it — broken rings turning as they close, ticks sliding
 *  in — and locks with a click of light. Then a carved JACK-O'-LANTERN grins
 *  over the card for a beat — a dark pumpkin, ribbed and rimmed in orange,
 *  candle-light pouring through the carved eyes and the jagged grin — and
 *  burns down: the pumpkin goes, and its face shrinks and sinks into the
 *  card as a smouldering brand inside the crosshair, embers lifting off it.
 *  A raven swoops past across the top of the card, black against the
 *  harvest glow, while it happens.
 *
 *  No damage blast: the mark does no damage, and a mark that exploded would
 *  lie about it. Halloween orange and black — a harvest-night curse, not a
 *  contract (BOLT's Kingpin) and not DUSK's violet. Darkness is drawn for
 *  real (`dark: true`), always with an orange rim so it reads. */
import { centre, rand } from "../../looks/base";
import { EMBER, pyroFlick } from "../../looks/fire";
import type { Graphics } from "pixi.js";
import type { FxTools, Pt } from "../../looks/types";
import type { Signature, SigMoment } from "../types";

const TAU = Math.PI * 2;
/** Candle-light through carved rind: white-hot, yellow, pumpkin, deep. */
const WICK = 0xfff4d6, CANDLE = 0xffe08a, AMBER = 0xffb347, PUMPKIN = 0xff7a1a, BURNT = 0xc2410c;
/** The crosshair: the art's red-orange. */
const SIGHT = 0xff5a1f;
/** The rind and the raven: near-black, warm. Dark layer only. */
const RIND = 0x1c0b03, CROW = 0x07040a;

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeOut = (x: number) => 1 - (1 - x) * (1 - x);
/** 0 -> 1 as `u` runs from `a` to `b`. */
const span = (u: number, a: number, b: number) => clamp01((u - a) / (b - a));
/** Overshoots and settles: a pop. */
const pop = (x: number) => { const u = clamp01(x); return 1 + 0.18 * Math.sin(u * Math.PI) * (1 - u) * 2 - (1 - u) * (1 - u) * 0.5 * (1 - u); };

// ── The carved face ─────────────────────────────────────────────────────────

/** The carving, in units of the face's half-width, y down: two triangle
 *  eyes, a nose, and a jagged grin with two teeth left in it. */
const EYE_L = [-0.44, -0.04, -0.1, -0.04, -0.3, -0.36];
const EYE_R = [0.44, -0.04, 0.1, -0.04, 0.3, -0.36];
const NOSE = [-0.08, 0.14, 0.08, 0.14, 0, 0.01];
const GRIN = [
  -0.6, 0.16, -0.42, 0.3, -0.3, 0.24, -0.16, 0.33, 0, 0.27, 0.16, 0.33, 0.3, 0.24, 0.42, 0.3, 0.6, 0.16,
  0.46, 0.48, 0.26, 0.56, 0.18, 0.45, 0.06, 0.58, -0.06, 0.58, -0.18, 0.45, -0.26, 0.56, -0.46, 0.48,
];

/** A carved piece placed at `c`, `R` wide, and swollen by `grow` about its
 *  own middle (for the glow round a cut). `wide` stretches the grin. */
function carve(list: number[], c: Pt, R: number, grow = 1, wide = 1): number[] {
  let mx = 0, my = 0;
  for (let i = 0; i < list.length; i += 2) { mx += list[i]; my += list[i + 1]; }
  mx /= list.length / 2;
  my /= list.length / 2;
  const out: number[] = [];
  for (let i = 0; i < list.length; i += 2) {
    const x = (mx + (list[i] - mx) * grow) * wide, y = my + (list[i + 1] - my) * grow - (wide - 1) * Math.abs(list[i]) * 0.5;
    out.push(c.x + x * R, c.y + y * R);
  }
  return out;
}

/** Candle-light pouring through the carving: an orange halo round each cut,
 *  the cut itself yellow, and a white-hot heart low in it, flickering. */
function face(g: Graphics, c: Pt, R: number, a: number, time: number, wide = 1) {
  if (a <= 0.01) return;
  const fl = 0.85 + 0.15 * pyroFlick(time, 3.1);
  for (const part of [EYE_L, EYE_R, NOSE, GRIN]) {
    const w = part === GRIN ? wide : 1;
    g.poly(carve(part, c, R, 1.35, w)).fill({ color: PUMPKIN, alpha: 0.4 * a * fl });
    g.poly(carve(part, c, R, 1, w)).fill({ color: CANDLE, alpha: 0.95 * a });
    g.poly(carve(part, c, R, 0.55, w)).fill({ color: WICK, alpha: 0.8 * a * fl });
  }
}

/** The pumpkin's body: three overlapping lobes, `R` its half-width. */
const LOBES = [[0, 0.08, 0.62, 0.72], [-0.42, 0.12, 0.55, 0.64], [0.42, 0.12, 0.55, 0.64]];
function lobes(g: Graphics, c: Pt, R: number) {
  for (const [x, y, rx, ry] of LOBES) g.ellipse(c.x + x * R, c.y + y * R, rx * R, ry * R);
  return g;
}

// ── The crosshair ───────────────────────────────────────────────────────────

/** The sight, at `c`, its ring `r` across, turned `rot`: a ring broken into
 *  four arcs, ticks sliding in through the gaps, a fine inner ring and a
 *  dot. Drawn twice by the caller — a wide warm glow, then the hard line. */
function sight(g: Graphics, c: Pt, r: number, rot: number, w: number, color: number, a: number) {
  if (a <= 0.01) return;
  for (let i = 0; i < 4; i++) {
    const a0 = rot + (i / 4) * TAU + 0.28, a1 = a0 + TAU / 4 - 0.56;
    g.moveTo(c.x + Math.cos(a0) * r, c.y + Math.sin(a0) * r).arc(c.x, c.y, r, a0, a1);
  }
  for (let i = 0; i < 4; i++) {
    const q = rot + (i / 4) * TAU;
    g.moveTo(c.x + Math.cos(q) * r * 1.3, c.y + Math.sin(q) * r * 1.3).lineTo(c.x + Math.cos(q) * r * 0.62, c.y + Math.sin(q) * r * 0.62);
  }
  g.stroke({ width: w, color, alpha: a, cap: "round" });
  g.circle(c.x, c.y, r * 0.3).stroke({ width: w * 0.6, color, alpha: a * 0.8 });
}

// ── The raven ───────────────────────────────────────────────────────────────

/** A raven in flight at `c`, `S` its wingspan, wings at `flap` (-1 down ..
 *  1 up): the Halloween silhouette — an M of two wings with fingered
 *  primaries, a short body, a wedge of tail, the head and beak turned the way
 *  it flies (`dir`, +1 right). Flat outlines, filled and rimmed by the caller. */
function raven(c: Pt, dir: number, flap: number, S: number) {
  const P = (x: number, y: number) => [c.x + x * S, c.y + y * S];
  const e = -0.13 * flap, tip = -0.24 * flap + 0.04;
  const wing = (sd: number) => [
    ...P(0.03 * sd, -0.03), ...P(0.2 * sd, -0.08 + e), ...P(0.5 * sd, tip),
    ...P(0.43 * sd, tip + 0.07), ...P(0.41 * sd, tip + 0.035), ...P(0.36 * sd, tip + 0.1), ...P(0.34 * sd, tip + 0.06),
    ...P(0.28 * sd, tip + 0.1 + e * 0.3), ...P(0.18 * sd, 0.05 + e * 0.4), ...P(0.04 * sd, 0.06),
  ];
  const body: number[] = [];
  for (let i = 0; i < 12; i++) { const q = (i / 12) * TAU; body.push(...P(0.06 * Math.cos(q), 0.02 + 0.1 * Math.sin(q))); }
  const tail = [...P(-0.025, 0.1), ...P(0.025, 0.1), ...P(0.06, 0.24), ...P(-0.06, 0.24)];
  const hx = 0.04 * dir, hy = -0.09;
  const beak = [...P(hx + 0.02 * dir, hy - 0.02), ...P(hx + 0.1 * dir, hy + 0.005), ...P(hx + 0.02 * dir, hy + 0.025)];
  const head = { x: c.x + hx * S, y: c.y + hy * S, r: 0.045 * S };
  const eye = { x: c.x + (hx + 0.015 * dir) * S, y: c.y + (hy - 0.01) * S };
  return { wings: [wing(-1), wing(1)], body, tail, beak, head, eye };
}

export const HOAX: Signature = {
  // A mark, not a blow: the board hardly moves.
  shake: 0.25,
  // He points from where he stands.
  lunge: false,

  deliver(t: FxTools, m: SigMoment, seconds: number) {
    const T = seconds, s = m.size, c = centre(m.from);
    const p = m.targets.length ? centre(m.targets[0]) : { x: c.x + m.ahead.x * s * 2, y: c.y + m.ahead.y * s * 2 };
    const fc = { x: c.x, y: c.y - s * 0.06 }, R = s * 0.3;

    // THE GRIN flares in the dark of his hood: a hood of shadow rimmed in
    // orange, and the carved face lit inside it.
    const hood = (u: number) => R * 1.15 * easeOut(span(u, 0, 0.3));
    t.draw(T, (g, u) => {
      const r = hood(u);
      if (r > 1) g.ellipse(fc.x, fc.y + R * 0.1, r, r * 0.95).fill({ color: RIND, alpha: 0.72 });
    }, { dark: true });
    t.draw(T, (g, u) => {
      const r = hood(u), time = u * T;
      if (r > 1) g.ellipse(fc.x, fc.y + R * 0.1, r, r * 0.95).stroke({ width: 1.5, color: BURNT, alpha: 0.8 });
      face(g, fc, R, span(u, 0.1, 0.3) * (0.75 + 0.25 * Math.sin(time * 30)), time, 1 + 0.15 * span(u, 0.2, 0.7));
    });
    t.glow(m.from, PUMPKIN, 0.35, T * 1.2, 1.1);

    // THE POINT: a thin orange line out to the one he has picked, its tip on
    // the card as the delivery ends.
    const P0 = 0.35;
    t.draw(T + 0.12, (g, u) => {
      const time = u * (T + 0.12), k = easeOut(span(time, T * P0, T)), a = 1 - span(time, T, T + 0.12);
      if (k <= 0) return;
      const ax = c.x + (p.x - c.x) * 0.22, ay = c.y + (p.y - c.y) * 0.22;
      const tx = ax + (p.x - ax) * k, ty = ay + (p.y - ay) * k;
      g.moveTo(ax, ay).lineTo(tx, ty).stroke({ width: 4, color: PUMPKIN, alpha: 0.25 * a });
      g.moveTo(ax, ay).lineTo(tx, ty).stroke({ width: 1.2, color: CANDLE, alpha: 0.9 * a });
      g.circle(tx, ty, 3).fill({ color: WICK, alpha: a });
    });
    for (let i = 0; i < Math.round(8 * t.quality); i++)
      t.later(rand(0.1, 0.9) * T, () => t.spark(fc.x + rand(-0.3, 0.3) * R, fc.y + rand(-0.2, 0.4) * R, rand(-15, 15), -rand(25, 60), rand(0.3, 0.5), EMBER));
  },

  land(t: FxTools, m: SigMoment) {
    if (!m.targets.length) return;
    const s = m.size, k = s / 90, r = m.targets[0], p = centre(r), c = centre(m.from);
    const kk = Math.max(0.8, Math.min(1.3, (m.power[0] ?? 0.55) / 0.55 * 0.9));
    const R = s * 0.4 * kk;

    // The harvest glow behind it all.
    t.glow(r, PUMPKIN, 0.3, 1.0, 1.2);

    // THE CROSSHAIR materialises over the card and tightens on it, turning
    // as it closes; then it locks, and stays round the brand till it fades.
    const LOCK = 0.22, XD = 1.02;
    t.draw(XD, (g, u) => {
      const time = u * XD, e = easeOut(span(time, 0, LOCK));
      const rr = s * (0.95 - 0.47 * e), rot = 0.9 * (1 - e), a = span(time, 0, 0.06) * (1 - span(time, 0.8, XD));
      sight(g, p, rr, rot, 5, PUMPKIN, 0.28 * a);
      sight(g, p, rr, rot, 1.8, SIGHT, 0.95 * a);
    });
    t.later(LOCK, () => {
      t.ring(r, AMBER, 0.95, 1.2, 0.2, 2);
      t.flash(p, AMBER, 0.3);
    });

    // THE JACK-O'-LANTERN grins over the card for a beat — dark rind ribbed
    // and rimmed in orange, candle-light through the carving — and burns
    // down: the rind goes, the face shrinks and sinks into the card.
    const J0 = LOCK - 0.02, BURN = 0.58, JD = 1.04 - J0;
    const scaleAt = (time: number) => pop(span(time, 0, 0.16)) * (1 - 0.55 * easeOut(span(time, BURN - J0, JD)));
    const fcAt = (time: number): Pt => ({ x: p.x, y: p.y + s * 0.08 * easeOut(span(time, BURN - J0, JD)) });
    const rindA = (time: number) => span(time, 0, 0.06) * (1 - span(time, BURN - J0, BURN - J0 + 0.22));
    t.draw(JD, (g, u) => {
      const time = u * JD, a = rindA(time), q = R * scaleAt(time), f = fcAt(time);
      if (a <= 0.01) return;
      lobes(g, f, q).fill({ color: RIND, alpha: 0.86 * a });
      g.moveTo(f.x, f.y - q * 0.58).lineTo(f.x + q * 0.12, f.y - q * 0.86).stroke({ width: q * 0.14, color: RIND, alpha: 0.9 * a, cap: "round" });
    }, { dark: true, delay: J0 });
    t.draw(JD, (g, u) => {
      const time = u * JD, a = rindA(time), q = R * scaleAt(time), f = fcAt(time);
      if (a > 0.01) {
        lobes(g, f, q).stroke({ width: 1.8, color: PUMPKIN, alpha: 0.85 * a });
        // The ribs, catching the light down the middle lobe.
        for (const x of [-0.22, 0.22]) {
          g.moveTo(f.x + x * q, f.y - q * 0.55).quadraticCurveTo(f.x + x * q * 1.4, f.y + q * 0.1, f.x + x * q, f.y + q * 0.75);
        }
        g.stroke({ width: 1.2, color: BURNT, alpha: 0.8 * a });
        g.moveTo(f.x, f.y - q * 0.58).lineTo(f.x + q * 0.12, f.y - q * 0.86).stroke({ width: 1.5, color: AMBER, alpha: 0.7 * a });
      }
      // The face outlives the rind, and burns down to a brand.
      const fa = span(time, 0.02, 0.1) * (1 - span(time, JD - 0.3, JD));
      face(g, f, q, fa, time, 1 + 0.2 * span(time, 0.05, 0.3));
      // The brand it leaves: a smouldering ring under the face.
      const b = span(time, BURN - J0, BURN - J0 + 0.15) * (1 - span(time, JD - 0.25, JD));
      if (b > 0.01) {
        g.circle(f.x, f.y, R * 0.75).stroke({ width: 4, color: PUMPKIN, alpha: 0.35 * b });
        g.circle(f.x, f.y, R * 0.75).stroke({ width: 1.3, color: CANDLE, alpha: 0.8 * b });
      }
    }, { delay: J0 });
    // Embers off it as it burns down.
    let ember = 0;
    t.draw(0.45, (_g, _u, dt) => {
      ember += dt * 34 * t.quality;
      for (; ember >= 1; ember--)
        t.spark(p.x + rand(-0.32, 0.32) * R * 2, p.y + rand(-0.2, 0.4) * R, rand(-20, 20) * k, -rand(40, 100) * k, rand(0.35, 0.6), EMBER);
    }, { delay: BURN - 0.05 });

    // THE RAVEN swoops past across the top of the card, black against the
    // glow, rimmed in orange moonlight.
    const dir = p.x >= c.x ? 1 : -1, S = s * 0.95;
    const a0 = { x: p.x - dir * s * 1.0, y: p.y - s * 0.5 }, a1 = { x: p.x + dir * s * 1.0, y: p.y - s * 0.45 }, ac = { x: p.x, y: p.y + s * 0.12 };
    const RV = 0.55, RV0 = 0.2;
    const bird = (u: number) => {
      const q = 1 - u, at = { x: q * q * a0.x + 2 * q * u * ac.x + u * u * a1.x, y: q * q * a0.y + 2 * q * u * ac.y + u * u * a1.y };
      return raven(at, dir, Math.sin(u * RV * 28), S);
    };
    const birdA = (u: number) => span(u, 0, 0.15) * (1 - span(u, 0.8, 1));
    t.draw(RV, (g, u) => {
      const b = bird(u), a = birdA(u);
      for (const part of [...b.wings, b.body, b.tail, b.beak]) g.poly(part).fill({ color: CROW, alpha: 0.92 * a });
      g.circle(b.head.x, b.head.y, b.head.r).fill({ color: CROW, alpha: 0.92 * a });
    }, { dark: true, delay: RV0 });
    t.draw(RV, (g, u) => {
      const b = bird(u), a = birdA(u);
      for (const part of [...b.wings, b.tail]) g.poly(part).stroke({ width: 1.2, color: AMBER, alpha: 0.75 * a, join: "round" });
      g.circle(b.head.x, b.head.y, b.head.r).stroke({ width: 1, color: AMBER, alpha: 0.6 * a });
      g.circle(b.eye.x, b.eye.y, 1.2).fill({ color: CANDLE, alpha: a });
    }, { delay: RV0 });
  },
};
