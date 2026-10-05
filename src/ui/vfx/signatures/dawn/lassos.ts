/** LASSOS — Hogtie. "5 DMG, rope the target one slot toward you from any
 *  direction, and BLIND it for 2 rounds." One foe, roped and hauled in.
 *
 *  His art is a rider in white and gold on a black horse, whirling a glowing
 *  GOLDEN LASSO that has already roped a charging bison, a sun blazing over
 *  the dust. So the DELIVERY is the rope: the loop whirled over his card, a
 *  spinning ellipse of golden rope glinting as it turns, faster and faster —
 *  then thrown, the loop sailing out on a curve and opening over the target,
 *  the rope paying out behind it in a sagging arc. It arrives with the
 *  delivery, round the square the target stands on.
 *
 *  The LANDING is the catch, in the same instant the target's token starts
 *  its slide toward him (the board slides it one slot over 0.28s, eased out;
 *  the noose rides with it): the loop drops and CINCHES tight round the card,
 *  the rope snaps taut and dead straight, thrumming, and the card is YANKED a
 *  slot toward Lassos, dust skidding off behind it. Then a dazzle of sun glare
 *  breaks over the card (the BLIND), and the rope goes slack and falls away.
 *
 *  Rope, not a beam: curves, sag and a spinning loop — the one curve in DAWN's
 *  kit, which is otherwise all straight light. Gold rope with a white sheen
 *  and twist highlights along it, so it reads over a dark square. */
import { centre, rand } from "../../looks/base";
import type { Graphics } from "pixi.js";
import type { FxTools, Pt, SparkStyle } from "../../looks/types";
import type { Signature, SigMoment } from "../types";

type Box = SigMoment["from"];

const TAU = Math.PI * 2;
// The rope: a glowing gold body and a white sheen.
const GLOW = 0xffb83a, ROPE = 0xf0b03a, SHEEN = 0xfff2c4, WHITE = 0xffffff;
// The sun the glare comes off.
const SUN = 0xffe07a, GLARE = 0xfff7e0;
/** Dust kicked off the ground as the card is hauled across it. */
const DUST: SparkStyle = { palette: [0xf2dca8, 0xd8b474, 0xa88250], gravity: 80, drag: 0.5, size: [4.5, 2], streak: false };
/** Glints flicked off the rope as it whirls and as it cinches. */
const GLINT: SparkStyle = { palette: [WHITE, SHEEN, SUN], gravity: 0, drag: 0.4, size: [4, 1.5], streak: false };

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeOut = (x: number) => 1 - (1 - x) * (1 - x);
const easeInOut = (x: number) => x * x * (3 - 2 * x);
/** The board's own slide of a moved card (Board.tsx: 280ms, cubic ease-out):
 *  the noose rides with the token, so it must keep the same pace. */
const SLIDE = 0.28;
const slide = (x: number) => 1 - Math.pow(1 - clamp01(x), 3);

// ── The rope ────────────────────────────────────────────────────────────────

/** His roping hand, up and to the side of his card's centre, and the point
 *  over the card the loop is whirled round. */
const handOf = (c: Pt, s: number): Pt => ({ x: c.x + s * 0.16, y: c.y - s * 0.1 });
const overhead = (c: Pt, s: number): Pt => ({ x: c.x - s * 0.02, y: c.y - s * 0.42 });

/** A rope laid from `a` to `b`, sagging `sag` px off the straight line to one
 *  side (`side` +-1): a quadratic curve, flat points. */
function ropeLine(a: Pt, b: Pt, sag: number, side: number, n = 18): number[] {
  const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1;
  const kx = (a.x + b.x) / 2 + (-dy / d) * sag * side * 2, ky = (a.y + b.y) / 2 + (dx / d) * sag * side * 2;
  const pts: number[] = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n, v = 1 - u;
    pts.push(v * v * a.x + 2 * v * u * kx + u * u * b.x, v * v * a.y + 2 * v * u * ky + u * u * b.y);
  }
  return pts;
}

/** The loop: an ellipse round `o`, `rx` by `ry`, flat points, closed by the
 *  caller. `wob` ripples the rope a little, so it never reads as a ring of
 *  light. */
function loopLine(o: Pt, rx: number, ry: number, time: number, wob = 0.04, n = 30): number[] {
  const pts: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU, k = 1 + wob * Math.sin(a * 3 + time * 9);
    pts.push(o.x + Math.cos(a) * rx * k, o.y + Math.sin(a) * ry * k);
  }
  return pts;
}

/** Stroke a rope: a soft gold glow, the rope's body, a white sheen down it,
 *  and short slanted twist highlights along it — what makes it ROPE. */
function rope(g: Graphics, pts: number[], w: number, alpha: number, closed = false, taut = 0) {
  if (alpha <= 0.01 || pts.length < 4) return;
  g.poly(pts, closed).stroke({ width: w * (2.6 + 1.4 * taut), color: GLOW, alpha: alpha * (0.2 + 0.25 * taut), join: "round", cap: "round" });
  g.poly(pts, closed).stroke({ width: w, color: ROPE, alpha: alpha * 0.95, join: "round", cap: "round" });
  g.poly(pts, closed).stroke({ width: Math.max(1, w * 0.32), color: taut > 0.5 ? WHITE : SHEEN, alpha: alpha * 0.85, join: "round" });
  // The twist: a slanted tick every few px along it.
  const n = pts.length / 2, step = Math.max(1, Math.round((w * 2.2) / Math.max(1, segLen(pts) / n)));
  for (let i = 0; i < n - 1; i += step) {
    const x = pts[i * 2], y = pts[i * 2 + 1], dx = pts[i * 2 + 2] - x, dy = pts[i * 2 + 3] - y, d = Math.hypot(dx, dy) || 1;
    const ux = dx / d, uy = dy / d, nx = -uy, ny = ux, h = w * 0.55;
    g.moveTo(x - nx * h - ux * h * 0.6, y - ny * h - uy * h * 0.6).lineTo(x + nx * h + ux * h * 0.6, y + ny * h + uy * h * 0.6);
  }
  g.stroke({ width: Math.max(0.8, w * 0.22), color: WHITE, alpha: alpha * 0.55 });
}

/** A polyline's length, px. */
function segLen(pts: number[]): number {
  let L = 0;
  for (let i = 2; i < pts.length; i += 2) L += Math.hypot(pts[i] - pts[i - 2], pts[i + 1] - pts[i - 1]);
  return L;
}

/** The point on an ellipse round `o` facing `to`: where the honda (the eye
 *  the loop runs through) sits, on the side toward the thrower. */
function honda(o: Pt, rx: number, ry: number, to: Pt): Pt {
  const a = Math.atan2((to.y - o.y) / ry, (to.x - o.x) / rx);
  return { x: o.x + Math.cos(a) * rx, y: o.y + Math.sin(a) * ry };
}

/** One slot toward Lassos from the target, as the rules haul it: a step on
 *  each axis it is not already level with him on (diagonals included),
 *  measured off the board's own pitch — and nothing at all when it already
 *  stands beside him. The pitch is read off the distance to him when it can
 *  be (a whole number of slots), else a square plus a gap. */
function pullOf(c: Pt, p: Pt, s: number): Pt {
  const axis = (d: number) => {
    const a = Math.abs(d);
    if (a < s * 0.6) return { step: 0, n: 0 };
    const n = Math.max(1, Math.round(a / (s * 1.08)));
    return { step: Math.sign(d) * (a / n), n };
  };
  const x = axis(c.x - p.x), y = axis(c.y - p.y);
  if (x.n <= 1 && y.n <= 1) return { x: 0, y: 0 };
  return { x: x.step, y: y.step };
}

/** Which side the rope bows to: up the screen, so a throw reads as a lob. */
function bowSide(a: Pt, b: Pt): number {
  const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1;
  return dx / d >= 0 ? -1 : 1;
}

// ── The sun glare ───────────────────────────────────────────────────────────

/** Sun glare breaking over a card (the BLIND): a white-hot sun-point with a
 *  long horizontal flare streak, a ring of rays turning round it, a warm
 *  bloom — bright for a moment, then gone, so the card stays readable. */
function glare(g: Graphics, p: Pt, s: number, a: number, spin: number) {
  if (a <= 0.01) return;
  g.circle(p.x, p.y, s * 0.4).fill({ color: SUN, alpha: 0.18 * a });
  for (let i = 0; i < 12; i++) {
    const q = spin + (i / 12) * TAU, L = s * (i % 2 ? 0.34 : 0.56), r0 = s * 0.14;
    g.moveTo(p.x + Math.cos(q) * r0, p.y + Math.sin(q) * r0).lineTo(p.x + Math.cos(q) * L, p.y + Math.sin(q) * L);
  }
  g.stroke({ width: Math.max(1.4, s * 0.026), color: SUN, alpha: 0.85 * a });
  // The flare streak: a long thin lozenge across the card.
  const W = s * 0.75, H = s * 0.035;
  g.poly([p.x - W, p.y, p.x, p.y - H, p.x + W, p.y, p.x, p.y + H], true).fill({ color: GLARE, alpha: 0.75 * a });
  g.poly([p.x, p.y - s * 0.3, p.x + H * 0.8, p.y, p.x, p.y + s * 0.3, p.x - H * 0.8, p.y], true).fill({ color: GLARE, alpha: 0.5 * a });
  g.circle(p.x, p.y, s * 0.12).fill({ color: GLARE, alpha: 0.85 * a });
  g.circle(p.x, p.y, s * 0.06).fill({ color: WHITE, alpha: a });
}

export const LASSOS: Signature = {
  shake: 0.9,
  // He ropes from the saddle; the rope does the travelling.
  lunge: false,

  deliver(t: FxTools, m: SigMoment, seconds: number) {
    const T = seconds, c = centre(m.from), s = m.size, hand = handOf(c, s), O = overhead(c, s);
    const r = m.targets[0];
    const p = r ? centre(r) : { x: c.x + m.ahead.x * s * 2, y: c.y + m.ahead.y * s * 2 };
    const W = Math.max(2, s * 0.045), R0 = s * 0.46, SQ = 0.36, RC = s * 0.7;
    // The whirl, then the throw: the throw takes the last stretch, so the loop
    // arrives round the target exactly as the delivery ends.
    const TH = Math.max(0.18, Math.min(0.3, T * 0.45)), T0 = T - TH;
    const side = bowSide(hand, p), d = Math.hypot(p.x - O.x, p.y - O.y);
    // Spinning up: about three turns a second rising to five.
    const spin = (time: number) => TAU * (3 * time + 1.2 * time * time / Math.max(0.2, T0));
    const state = (time: number) => {
      if (time < T0) {
        // Whirled overhead, its centre circling a little with the swing.
        const ph = spin(time), o = { x: O.x + Math.cos(ph) * s * 0.05, y: O.y + Math.sin(ph) * s * 0.02 };
        const grow = easeOut(clamp01(time / (T0 * 0.4)));
        const rx = R0 * (0.5 + 0.5 * grow), ry = rx * SQ;
        const k = { x: o.x + Math.cos(ph) * rx, y: o.y + Math.sin(ph) * ry };
        return { o, rx, ry, k, sag: s * 0.05, q: 0 };
      }
      // Thrown: sailing out on a lob, opening from a whirled ellipse into a
      // flat loop round the target, the honda trailing toward his hand.
      const q = clamp01((time - T0) / TH), e = easeInOut(q);
      const nx = -(p.y - O.y) / (d || 1), ny = (p.x - O.x) / (d || 1), bow = d * 0.2 * Math.sin(Math.PI * e) * side;
      const o = { x: O.x + (p.x - O.x) * e + nx * bow, y: O.y + (p.y - O.y) * e + ny * bow };
      const rx = R0 + (RC - R0) * e, ry = rx * (SQ + (1 - SQ) * e * e);
      return { o, rx, ry, k: honda(o, rx, ry, hand), sag: s * (0.08 + 0.35 * Math.sin(Math.PI * Math.min(1, q * 1.2))), q };
    };
    const D = T + 0.02;
    t.draw(D, (g, u) => {
      const time = Math.min(T, u * D), st = state(time), a = clamp01(time / 0.06);
      // The motion blur of the whirl: a fainter loop just outside the rope.
      if (time < T0) g.ellipse(st.o.x, st.o.y, st.rx * 1.12, st.ry * 1.25).stroke({ width: W * 1.6, color: GLOW, alpha: 0.18 * a });
      rope(g, loopLine(st.o, st.rx, st.ry, time), W, a, true);
      rope(g, ropeLine(hand, st.k, st.sag, side), W * 0.85, a);
      // Light running round the loop as it turns.
      const ph = time < T0 ? spin(time) : spin(T0) + (time - T0) * 10;
      for (const off of [0, Math.PI]) {
        const gx = st.o.x + Math.cos(ph + off + 0.6) * st.rx, gy = st.o.y + Math.sin(ph + off + 0.6) * st.ry;
        g.circle(gx, gy, W * 1.3).fill({ color: WHITE, alpha: 0.75 * a });
        g.poly([gx - W * 3, gy, gx, gy - W * 0.6, gx + W * 3, gy, gx, gy + W * 0.6], true).fill({ color: SHEEN, alpha: 0.6 * a });
      }
      g.circle(hand.x, hand.y, W * 1.2).fill({ color: SHEEN, alpha: 0.8 * a });
    });
    // Glints flicked off the whirling loop.
    for (let i = 0; i < Math.round(8 * t.quality); i++) {
      const at = rand(0.1, 0.9) * T0;
      t.later(at, () => {
        const ph = rand(0, TAU), x = O.x + Math.cos(ph) * R0, y = O.y + Math.sin(ph) * R0 * SQ, v = rand(40, 90) * (s / 90);
        t.spark(x, y, -Math.sin(ph) * v, Math.cos(ph) * v * SQ, rand(0.25, 0.4), GLINT);
      });
    }
    t.glow(m.from, SUN, 0.22, T0 + 0.1, 1.2);
  },

  land(t: FxTools, m: SigMoment) {
    const c = centre(m.from), s = m.size, hand = handOf(c, s), r: Box | undefined = m.targets[0];
    if (!r) return;
    const p0 = centre(r), P = pullOf(c, p0, s), plen = Math.hypot(P.x, P.y);
    const k = Math.max(0.8, Math.min(1.5, m.power[0] ?? 1)), W = Math.max(2, s * 0.045);
    const side = bowSide(hand, p0), killed = m.killed[0] ?? false;
    const Q = (time: number): Pt => {
      const e = killed ? 0 : slide(time / SLIDE);
      return { x: p0.x + P.x * e, y: p0.y + P.y * e };
    };
    // The noose: dropped round the card and CINCHED tight in an instant, held
    // through the haul, then loosening and falling away.
    const radius = (time: number) => {
      const cinch = s * (0.7 - 0.18 * easeOut(clamp01(time / 0.09)));
      return cinch + s * 0.12 * easeOut(clamp01((time - 0.5) / 0.35));
    };
    const D = 0.95;
    t.draw(D, (g, u) => {
      const time = u * D, q = Q(time), R = radius(time);
      const a = 1 - clamp01((time - 0.6) / 0.35);
      // Taut through the haul and a beat after it — thrumming — then slack.
      const taut = 1 - clamp01((time - SLIDE - 0.08) / 0.15);
      const thrum = s * 0.035 * Math.sin(time * 70) * (1 - clamp01(time / (SLIDE + 0.1)));
      const sag = thrum + s * 0.3 * easeOut(clamp01((time - SLIDE - 0.08) / 0.5));
      const loop = loopLine(q, R, R * 0.96, time, 0.03 * (1 - taut * 0.6));
      rope(g, loop, W * (1 + 0.2 * taut), a, true, taut);
      // The rope from his hand to the honda, which sits on the side facing him.
      const kh = honda(q, R, R * 0.96, hand);
      rope(g, ropeLine(hand, kh, sag, side), W * (0.9 + 0.25 * taut), a * (1 - clamp01((time - 0.5) / 0.4)), false, taut);
      // The honda itself: a bright knot where the noose runs through it.
      g.circle(kh.x, kh.y, W * (1.4 + 0.8 * taut)).fill({ color: WHITE, alpha: 0.9 * a });
    });

    // THE CINCH: the catch flaring at the honda and over the card.
    const kh0 = honda(p0, s * 0.52, s * 0.5, hand);
    t.flash(kh0, SHEEN, 0.2 * (s / 80));
    t.flash(p0, SUN, 0.22 * k * (s / 80));
    t.ring(r, SHEEN, 0.75, 0.45, 0.16, 3);
    for (let i = 0; i < Math.round(6 * k); i++) {
      const a = rand(0, TAU), v = rand(90, 180) * (s / 90);
      t.spark(p0.x + Math.cos(a) * s * 0.5, p0.y + Math.sin(a) * s * 0.5, -Math.cos(a) * v * 0.3, -Math.sin(a) * v * 0.3, rand(0.2, 0.35), GLINT);
    }

    // THE HAUL: speed lines streaming off behind the card as it is dragged, and
    // the dust it ploughs up skidding out behind it.
    if (plen > 1 && !killed) {
      const ux = P.x / plen, uy = P.y / plen, nx = -uy, ny = ux;
      const lines = Array.from({ length: 6 }, (_, i) => ({ off: ((i + 0.5) / 6 - 0.5) * s * 0.9, len: rand(0.5, 0.95), lag: rand(0, 0.06) }));
      t.draw(SLIDE + 0.2, (g, u) => {
        const time = u * (SLIDE + 0.2), q = Q(time);
        for (const ln of lines) {
          const a = clamp01((time - ln.lag) / 0.05) * (1 - clamp01((time - SLIDE * 0.6) / 0.3));
          if (a <= 0.01) continue;
          const bx = q.x - ux * s * 0.55 + nx * ln.off, by = q.y - uy * s * 0.55 + ny * ln.off;
          g.moveTo(bx, by).lineTo(bx - ux * s * ln.len, by - uy * s * ln.len);
        }
        g.stroke({ width: Math.max(1, s * 0.018), color: SHEEN, alpha: 0.6 * (1 - u) });
        // Skid marks from where it stood to where it is, on the ground.
        for (const sx of [-0.28, 0.28]) {
          const ax = p0.x + nx * s * sx + ux * s * 0.3, ay = p0.y + ny * s * sx + uy * s * 0.3;
          g.moveTo(ax, ay).lineTo(q.x + nx * s * sx + ux * s * 0.3, q.y + ny * s * sx + uy * s * 0.3);
        }
        g.stroke({ width: Math.max(1.5, s * 0.03), color: 0xd8b474, alpha: 0.45 * (1 - u) });
      });
      for (let i = 0; i < Math.round(12 * t.quality); i++) {
        const f = rand(0, 0.7);
        t.later(f * SLIDE, () => {
          const q = Q(f * SLIDE), o = rand(-0.45, 0.45) * s;
          const a = Math.atan2(-uy, -ux) + rand(-0.7, 0.7), v = rand(60, 150) * (s / 90);
          t.spark(q.x - ux * s * 0.45 + nx * o, q.y - uy * s * 0.45 + ny * o, Math.cos(a) * v, Math.sin(a) * v - 30 * (s / 90), rand(0.35, 0.6), DUST);
        });
      }
    }

    // THE GLARE (the BLIND): sun breaking over the card where it now stands,
    // a moment after the catch.
    const GD = 0.5, spin0 = rand(0, TAU);
    t.draw(GD, (g, u) => {
      const time = 0.16 + u * GD, a = clamp01(u / 0.15) * (1 - clamp01((u - 0.3) / 0.7));
      glare(g, Q(time), s * (1.05 + 0.2 * k), a, spin0 + u * 0.8);
    }, { delay: 0.16 });
    t.later(0.16, () => t.flash(Q(0.16), GLARE, 0.18 * (s / 80)));
  },
};
