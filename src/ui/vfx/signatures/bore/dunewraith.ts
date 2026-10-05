/** DUNEWRAITH — Nightmare. "SLEEP up to 2 opponents for 2 rounds." It puts
 *  you under and then keeps working, quietly.
 *
 *  Dunewraith's art is a hooded desert wraith under a full moon, golden SAND
 *  pouring from his outstretched hand and wound round him in a great vortex,
 *  the sleepers half-buried in the dunes at his feet. So the DELIVERY is that
 *  vortex: sand drawn up off the floor into slow golden arms turning round his
 *  card, a pale moon coming up behind him. Then the sand leaves his hand — a
 *  long ribbon of it to each target, lifting over the board and turning down
 *  above the card, the head of it reaching the card as the step lands.
 *
 *  The LANDING is the hourglass. The ribbon keeps pouring, a thin stream
 *  falling straight down onto the card, and the sand piles at its foot into a
 *  small dune that climbs the card and half-buries it; the ribbon's tail
 *  drains out of his hand and runs down after it, the last grains fall, and a
 *  moonlit shimmer passes over the dune before it settles and is gone. No
 *  flash, no impact, no shake: this is the one BORE move that is quiet, and
 *  sleep is what it is about.
 *
 *  Sand, not rock: the ribbon and the dune have a body (normal-blend, real
 *  colour — additive light cannot draw a dune), and the light is in the
 *  grains: fine golden glints running along the ribbon and winking on the
 *  dune. Every sand body carries a lit edge, so it reads over an empty
 *  square as well as over a card. */
import { centre, rand } from "../../looks/base";
import type { Graphics } from "pixi.js";
import type { FxTools, Pt, SparkStyle } from "../../looks/types";
import type { Signature, SigMoment } from "../types";

type Box = SigMoment["from"];

const TAU = Math.PI * 2;
// The sand's body, on the dark (normal-blend) layer: real colour.
const SAND = 0xb08540, SAND_LIT = 0xdcb46a, SAND_LO = 0x7a5526, SAND_EDGE = 0x4a3216;
// Its light (additive): the grains glinting, and the moon.
const GLINT = 0xfff2c4, GOLD = 0xf2c25a, AMBER = 0xc98a2e;
const MOON = 0xdfe8ff, MOON_HALO = 0x8fa6e8;
/** A grain falling off the pour or the vortex: tiny, heavy, golden. */
const GRAIN: SparkStyle = { palette: [GLINT, GOLD, AMBER], gravity: 520, drag: 0.6, size: [3, 1.5], streak: false };
/** Sand drawn up into the vortex: light, turning round the card. */
const DRIFT: SparkStyle = { palette: [GLINT, GOLD, AMBER], gravity: -30, drag: 0.7, size: [3, 1.2], streak: false, swirl: 160 };

/** The ribbon's width at its thickest, against a square. */
const W = 0.15;

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeOut = (x: number) => 1 - (1 - x) * (1 - x);
const smooth = (x: number) => x * x * (3 - 2 * x);

// ── The ribbon ───────────────────────────────────────────────────────────────

/** A cubic Bezier at `q`. */
function bez(a: Pt, b: Pt, c: Pt, d: Pt, q: number): Pt {
  const r = 1 - q;
  return {
    x: r * r * r * a.x + 3 * r * r * q * b.x + 3 * r * q * q * c.x + q * q * q * d.x,
    y: r * r * r * a.y + 3 * r * r * q * b.y + 3 * r * q * q * c.y + q * q * q * d.y,
  };
}

/** The ribbon's way from his hand to the card: out of the hand toward it,
 *  bowed to one side (alternating, so two ribbons part), lifting over the
 *  board — and then turning DOWN above the card, so it pours onto it from
 *  above like an hourglass, whichever way the board faces. Deterministic from
 *  the squares, so the delivery and the landing draw the same ribbon. */
function ribbonPath(hand: Pt, r: Box, s: number, i: number, ahead: Pt) {
  const top = { x: r.x + r.w / 2, y: r.y + r.h * 0.06 };
  const dx = top.x - hand.x, dy = top.y - hand.y, d = Math.hypot(dx, dy) || 1;
  // Bowed OUT, toward the side of the line the card is on, so two ribbons
  // part instead of crossing; a card dead ahead takes turns.
  const cross = ahead.x * dy - ahead.y * dx;
  const nx = -dy / d, ny = dx / d, side = Math.abs(cross) > s * 0.3 ? (cross > 0 ? 1 : -1) : i % 2 ? -1 : 1;
  // Over the card, a little out to its side: where it turns down to pour.
  const c = { x: top.x + nx * s * 0.8 * side, y: top.y - s * 0.6 - d * 0.08 };
  const b = { x: hand.x + (c.x - hand.x) * 0.4 + nx * d * 0.3 * side, y: hand.y + (c.y - hand.y) * 0.4 + ny * d * 0.3 * side };
  return (q: number) => bez(hand, b, c, top, q);
}

/** A band of sand along `path` from `q0` to `q1`, `w` wide at its middle and
 *  thinning to the ends, rippling as it flows. Flat points (a polygon). */
function band(path: (q: number) => Pt, q0: number, q1: number, w: number, time: number): number[] {
  const N = 22, left: number[] = [], right: number[] = [];
  for (let k = 0; k <= N; k++) {
    const f = k / N, q = q0 + (q1 - q0) * f;
    const p = path(q), p2 = path(Math.min(1, q + 0.01)), p1 = path(Math.max(0, q - 0.01));
    const tx = p2.x - p1.x, ty = p2.y - p1.y, tl = Math.hypot(tx, ty) || 1;
    const nx = -ty / tl, ny = tx / tl;
    // Thick through its body, thin where it leaves the hand and where it
    // pours: and a slow ripple running along it, as sand on the wind.
    const hw = (w / 2) * (0.35 + 0.65 * Math.sin(Math.PI * f)) * (1 + 0.18 * Math.sin(q * 26 - time * 9));
    left.push(p.x + nx * hw, p.y + ny * hw);
    right.unshift(p.x - nx * hw, p.y - ny * hw);
  }
  return left.concat(right);
}

/** Grains running along the ribbon from `q0` to `q1`: each its own place
 *  across the band, flowing toward the card and winking as it goes. */
function grains(g: Graphics, path: (q: number) => Pt, q0: number, q1: number, w: number, time: number, seeds: number[][], a: number) {
  if (q1 - q0 < 0.005 || a <= 0.02) return;
  for (const [ph, off, sp] of seeds) {
    const f = (ph + time * sp) % 1, q = q0 + (q1 - q0) * f, p = path(q), p2 = path(Math.min(1, q + 0.01));
    const tx = p2.x - p.x, ty = p2.y - p.y, tl = Math.hypot(tx, ty) || 1;
    const x = p.x - (ty / tl) * off * w * 0.45, y = p.y + (tx / tl) * off * w * 0.45;
    const wink = 0.55 + 0.45 * Math.sin(time * 14 + ph * 40);
    g.circle(x, y, 1.3).fill({ color: wink > 0.8 ? GLINT : GOLD, alpha: a * wink });
  }
}

/** The ribbon from `q0` to `q1` drawn. On the dark layer: a thin haze of
 *  sand round it (the soft edge a stream of grains has) and its body. On the
 *  light layer: a golden sheen, a lit edge, a second finer strand twisting
 *  along it, and the grains running down it. */
function ribbon(g: Graphics, path: (q: number) => Pt, q0: number, q1: number, w: number, time: number, dark: boolean, gs: number[][]) {
  if (q1 - q0 < 0.01) return;
  if (dark) {
    g.poly(band(path, q0, q1, w * 2.1, time * 0.7), true).fill({ color: SAND, alpha: 0.16 });
    g.poly(band(path, q0, q1, w, time), true).fill({ color: SAND, alpha: 0.78 });
    return;
  }
  g.poly(band(path, q0, q1, w, time), true).fill({ color: GOLD, alpha: 0.16 }).stroke({ width: 1, color: SAND_LIT, alpha: 0.55, join: "round" });
  // A finer strand winding along it: a stream of sand is never one band.
  const N = 20, pts: number[] = [];
  for (let k = 0; k <= N; k++) {
    const q = q0 + ((q1 - q0) * k) / N, p = path(q), p2 = path(Math.min(1, q + 0.01));
    const tx = p2.x - p.x, ty = p2.y - p.y, tl = Math.hypot(tx, ty) || 1, o = w * 0.32 * Math.sin(q * 30 - time * 7);
    pts.push(p.x - (ty / tl) * o, p.y + (tx / tl) * o);
  }
  g.poly(pts, false).stroke({ width: 1.2, color: GLINT, alpha: 0.45, join: "round" });
  grains(g, path, q0, q1, w, time, gs, 0.95);
}

/** Grains spilling off the ribbon as it flows: rate-based, falling. */
function spill(t: FxTools, path: (q: number) => Pt, q0: number, q1: number, s: number, dt: number, acc: { v: number }) {
  acc.v += dt * 40 * t.quality * (q1 - q0);
  for (; acc.v >= 1; acc.v--) {
    const p = path(rand(q0, q1));
    t.spark(p.x + rand(-2, 2), p.y, rand(-12, 12) * (s / 90), rand(0, 20) * (s / 90), rand(0.35, 0.6), GRAIN);
  }
}

// ── The dune ─────────────────────────────────────────────────────────────────

/** The dune's top edge over a card's foot: `H` high at the crest under the
 *  pour, `hw` either side, with a soft ripple. Left to right. */
function crest(cx: number, base: number, hw: number, H: number, seed: number): number[] {
  const N = 18, out: number[] = [];
  for (let k = 0; k <= N; k++) {
    const f = k / N, x = cx - hw + 2 * hw * f, u = (x - cx) / hw;
    const h = H * Math.pow(Math.max(0, 1 - u * u), 0.9) * (1 + 0.06 * Math.sin(u * 7 + seed));
    out.push(x, base - h);
  }
  return out;
}

/** The dune drawn: on the dark layer, a sand body with its lit windward face
 *  (left of the crest), its shadowed lee face and a dark foot; on the light
 *  layer, the lit crest, wind ripples down its face and grains winking. */
function dune(g: Graphics, cx: number, base: number, hw: number, H: number, seed: number, a: number, dark: boolean, time: number) {
  if (a <= 0.02 || H < 1) return;
  const top = crest(cx, base, hw, H, seed);
  if (dark) {
    g.poly([...top, cx + hw, base, cx - hw, base], true).fill({ color: SAND, alpha: 0.88 * a });
    const mid = top.length / 2;
    const left = top.slice(0, mid + 1);
    g.poly([...left, cx, base, cx - hw, base], true).fill({ color: SAND_LIT, alpha: 0.5 * a });
    const right = top.slice(mid - 1);
    g.poly([...right, cx + hw, base, cx + hw * 0.1, base], true).fill({ color: SAND_LO, alpha: 0.45 * a });
    g.moveTo(cx - hw, base).lineTo(cx + hw, base).stroke({ width: 2, color: SAND_EDGE, alpha: 0.7 * a });
    return;
  }
  // The crest catches the light; ripples lie along the face below it.
  g.poly(top, false).stroke({ width: 1.6, color: GLINT, alpha: 0.75 * a, join: "round" });
  for (const k of [0.62, 0.32]) {
    const rip = crest(cx, base, hw * (0.55 + 0.4 * k), H * k, seed + 1);
    g.poly(rip.slice(4, rip.length - 4), false).stroke({ width: 1, color: GOLD, alpha: 0.35 * a });
  }
  for (let k = 0; k < 6; k++) {
    const u = ((k * 0.37 + seed) % 1) * 1.6 - 0.8, x = cx + u * hw;
    const y = base - H * Math.pow(Math.max(0, 1 - u * u), 1.4) * (0.3 + 0.5 * ((k * 0.61) % 1));
    const wink = Math.max(0, Math.sin(time * 9 + k * 2.3));
    g.circle(x, y, 1.4).fill({ color: GLINT, alpha: a * wink });
  }
}

export const DUNEWRAITH: Signature = {
  // Nothing hits anything: it is a lullaby, not a blow.
  shake: 0,
  lunge: false,

  deliver(t: FxTools, m: SigMoment, seconds: number) {
    const c = centre(m.from), s = m.size, T = seconds;
    const ax = m.ahead.x, ay = m.ahead.y;
    const hand = { x: c.x + ax * s * 0.26 + -ay * s * 0.12, y: c.y + ay * s * 0.26 + ax * s * 0.12 };
    // THE MOON over his shoulder, as on his art: in the sky, so up the
    // screen however the board faces — the card is drawn upright either way.
    const moon = { x: c.x - s * 0.34, y: c.y - s * 0.4 };
    const D = T + 0.35, fade = (time: number) => 1 - clamp01((time - T) / 0.35);
    // THE VORTEX: three arms of sand turning slowly round him, drawn up off
    // the floor as they grow — a body of sand and the grains glinting on it.
    const arms = [0, 1, 2, 3].map((i) => rand(0, 0.4) + (i / 4) * TAU);
    const spiral = (a0: number, time: number) => {
      const grow = easeOut(clamp01(time / (T * 0.5))), N = 16, pts: Pt[] = [];
      for (let k = 0; k <= N; k++) {
        const f = k / N, a = a0 + time * 2.2 + f * 3.4, r = s * (0.14 + 0.52 * f * grow);
        pts.push({ x: c.x + Math.cos(a) * r, y: c.y + Math.sin(a) * r * 0.82 - s * 0.05 * f });
      }
      return pts;
    };
    const armBand = (pts: Pt[], w: number) => {
      const left: number[] = [], right: number[] = [];
      for (let k = 0; k < pts.length; k++) {
        const p = pts[k], q = pts[Math.min(pts.length - 1, k + 1)], o = pts[Math.max(0, k - 1)];
        const tx = q.x - o.x, ty = q.y - o.y, tl = Math.hypot(tx, ty) || 1, f = k / (pts.length - 1);
        const hw = (w / 2) * Math.sin(Math.PI * Math.min(0.98, f * 0.9 + 0.08));
        left.push(p.x - (ty / tl) * hw, p.y + (tx / tl) * hw);
        right.unshift(p.x + (ty / tl) * hw, p.y - (tx / tl) * hw);
      }
      return left.concat(right);
    };
    t.draw(D, (g, u) => {
      const time = u * D, a = clamp01(time / (T * 0.3)) * fade(time);
      for (const a0 of arms) g.poly(armBand(spiral(a0, time), s * 0.1), true).fill({ color: SAND, alpha: 0.42 * a });
    }, { dark: true });
    const seeds = Array.from({ length: Math.round(30 * t.quality) }, () => [rand(0, 1), rand(-1, 1), rand(0, 3)]);
    t.draw(D, (g, u) => {
      const time = u * D, a = clamp01(time / (T * 0.3)) * fade(time);
      for (const a0 of arms) {
        const pts = spiral(a0, time);
        g.poly(armBand(pts, s * 0.1), true).stroke({ width: 1, color: GOLD, alpha: 0.45 * a, join: "round" });
        const flat: number[] = [];
        for (const p of pts) flat.push(p.x, p.y);
        g.poly(flat, false).stroke({ width: 1, color: GLINT, alpha: 0.3 * a });
      }
      for (const [ph, off, arm] of seeds) {
        const pts = spiral(arms[Math.floor(arm * 4 / 3)], time), f = (ph + time * 0.8) % 1, p = pts[Math.floor(f * (pts.length - 1))];
        const wink = 0.5 + 0.5 * Math.sin(time * 12 + ph * 30);
        g.circle(p.x + off * s * 0.03, p.y + off * s * 0.03, 1.2).fill({ color: GLINT, alpha: a * wink });
      }
      // The moon comes up behind him: a pale disc, a cold halo, two faint
      // seas on its face.
      const mk = smooth(clamp01(time / (T * 0.7))) * fade(time), R = s * 0.12;
      g.circle(moon.x, moon.y, R * 2.4).fill({ color: MOON_HALO, alpha: 0.1 * mk })
        .circle(moon.x, moon.y, R * 1.5).fill({ color: MOON_HALO, alpha: 0.14 * mk })
        .circle(moon.x, moon.y, R).fill({ color: MOON, alpha: 0.75 * mk })
        .circle(moon.x - R * 0.3, moon.y - R * 0.15, R * 0.28).fill({ color: MOON_HALO, alpha: 0.35 * mk })
        .circle(moon.x + R * 0.25, moon.y + R * 0.3, R * 0.2).fill({ color: MOON_HALO, alpha: 0.3 * mk });
    });
    let acc = 0;
    t.draw(T, (_g, u, dt) => {
      acc += dt * 26 * t.quality;
      for (; acc >= 1; acc--) {
        const a = rand(0, TAU), r = s * rand(0.3, 0.6), v = 40 * (s / 90);
        t.spark(c.x + Math.cos(a) * r, c.y + Math.sin(a) * r * 0.82, -Math.sin(a) * v, Math.cos(a) * v - 10, rand(0.4, 0.7), DRIFT, c);
      }
      void u;
    });

    // THE RIBBONS: out of his hand, over the board, and down onto each card,
    // the head of each arriving as the step lands.
    const LEAVE = T * 0.38, F = T - LEAVE;
    m.targets.forEach((r, i) => {
      const path = ribbonPath(hand, r, s, i, m.ahead);
      const gs = Array.from({ length: Math.round(16 * t.quality) }, () => [rand(0, 1), rand(-1, 1), rand(0.5, 0.9)]);
      const head = (u: number) => smooth(u) * 0.85 + u * 0.15;
      const acc = { v: 0 };
      t.draw(F, (g, u) => ribbon(g, path, 0, head(u), W * s, u * F, true, gs), { dark: true, delay: LEAVE });
      t.draw(F, (g, u, dt) => {
        const q = head(u), time = u * F;
        if (q <= 0.01) return;
        ribbon(g, path, 0, q, W * s, time, false, gs);
        spill(t, path, 0, q, s, dt, acc);
        const p = path(q);
        g.circle(p.x, p.y, s * 0.05).fill({ color: GOLD, alpha: 0.35 }).circle(p.x, p.y, s * 0.022).fill({ color: GLINT, alpha: 0.9 });
      }, { delay: LEAVE });
    });
  },

  land(t: FxTools, m: SigMoment) {
    const c = centre(m.from), s = m.size;
    const hand = { x: c.x + m.ahead.x * s * 0.26 - m.ahead.y * s * 0.12, y: c.y + m.ahead.y * s * 0.26 + m.ahead.x * s * 0.12 };
    m.targets.forEach((r, i) => pour(t, r, ribbonPath(hand, r, s, i, m.ahead), m.power[i] ?? 0.55, s, 0));
  },
};

/** The hourglass over one card, `delay` in: the ribbon still pouring onto it
 *  and its tail running down out of his hand after it, a stream falling onto
 *  the card, and the dune piling up its foot, glinting, then a moonlit
 *  shimmer passing over it before it settles away. */
function pour(t: FxTools, r: Box, path: (q: number) => Pt, power: number, s: number, delay: number) {
  const k = Math.max(0.85, Math.min(1.3, power + 0.4));
  const cx = r.x + r.w / 2, base = r.y + r.h * 0.97, hw = r.w * 0.48 * k, top = path(1);
  const Hmax = r.h * 0.44 * Math.min(1.1, k), seed = rand(0, 10);
  const D = 1.1;
  // The tail drains out of his hand and follows the rest down; the stream
  // falls until the tail has gone into it.
  const tailQ = (time: number) => smooth(clamp01((time - 0.12) / 0.5));
  const H = (time: number) => Hmax * easeOut(clamp01((time - 0.03) / 0.5));
  const fade = (time: number) => 1 - clamp01((time - 0.82) / 0.28);
  const stream = (time: number) => {
    // The stream's top drops away once the last of the ribbon is through.
    const gone = clamp01((time - 0.62) / 0.16), y0 = top.y + (base - H(time) - top.y) * gone;
    return { y0, y1: base - H(time) * 0.9, a: 1 - clamp01((time - 0.7) / 0.1) };
  };
  const gs = Array.from({ length: Math.round(16 * t.quality) }, () => [rand(0, 1), rand(-1, 1), rand(0.5, 0.9)]);
  t.draw(D, (g, u) => {
    const time = u * D, q0 = tailQ(time);
    if (q0 < 0.995) ribbon(g, path, q0, 1, W * s * (1 - 0.5 * q0), time, true, gs);
    const st = stream(time);
    if (st.a > 0.02 && st.y1 - st.y0 > 1) g.rect(cx - s * 0.022, st.y0, s * 0.044, st.y1 - st.y0).fill({ color: SAND, alpha: 0.75 * st.a });
    dune(g, cx, base, hw, H(time), seed, fade(time), true, time);
  }, { dark: true, delay });
  const flow = { v: 0 };
  t.draw(D, (g, u, dt) => {
    const time = u * D, q0 = tailQ(time);
    if (q0 < 0.995) {
      ribbon(g, path, q0, 1, W * s * (1 - 0.5 * q0), time, false, gs);
      spill(t, path, q0, 1, s, dt, flow);
    }
    // The stream: a lit edge each side and grains falling down it.
    const st = stream(time);
    if (st.a > 0.02 && st.y1 - st.y0 > 1) {
      g.moveTo(cx - s * 0.022, st.y0).lineTo(cx - s * 0.022, st.y1).stroke({ width: 1, color: SAND_LIT, alpha: 0.6 * st.a });
      for (let j = 0; j < 7; j++) {
        const f = (j / 7 + time * 2.2) % 1, y = st.y0 + (st.y1 - st.y0) * f;
        g.circle(cx + Math.sin(j * 3.1 + time * 20) * s * 0.012, y, 1.2).fill({ color: GLINT, alpha: 0.85 * st.a });
      }
    }
    dune(g, cx, base, hw, H(time), seed, fade(time), false, time);
    // THE SHIMMER: moonlight running over the dune once it has settled — a
    // pale sheen sliding along the crest, and the card bathed in it.
    const sh = clamp01((time - 0.6) / 0.35);
    if (sh > 0 && sh < 1) {
      const cr = crest(cx, base, hw, H(time), seed), n = cr.length / 2;
      const at = Math.floor(sh * (n - 4)), seg = cr.slice(at * 2, at * 2 + 8);
      g.poly(seg, false).stroke({ width: 3, color: MOON, alpha: 0.7 * Math.sin(Math.PI * sh), cap: "round", join: "round" });
    }
  }, { delay });
  // Grains bouncing off the pile where the stream lands — rate-based, low.
  let acc = 0;
  t.draw(0.75, (_g, u, dt) => {
    const time = u * 0.75;
    if (time > 0.68) return;
    acc += dt * 34 * t.quality;
    for (; acc >= 1; acc--) {
      const y = base - H(time) * 0.9, v = rand(30, 70) * (s / 90), a = rand(-Math.PI * 0.95, -Math.PI * 0.05);
      t.spark(cx + rand(-2, 2), y, Math.cos(a) * v, Math.sin(a) * v * 0.6, rand(0.25, 0.4), GRAIN);
    }
  }, { delay });
  t.later(delay + 0.6, () => t.glow(r, MOON_HALO, 0.14, 0.5, 0.9));
}
