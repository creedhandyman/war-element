/** KOBRA — Venom Strike. "10 DMG and SLEEP the target for 2 rounds." She
 *  bites her target to sleep.
 *
 *  Kobra's art is a masked assassin in black scale armour with a GIANT COBRA
 *  rearing behind her, its hood spread, blue light running along its scales
 *  and amber light under them. So the DELIVERY is the cobra rising behind
 *  her card: a great dark hood spreading open over it, rimmed in blue scale-
 *  light, the hood's amber markings and the two amber eyes of the head above
 *  it, swaying — and at the end rearing back, the way a cobra does before it
 *  strikes. Her card stays where it is: the snake is the lunge.
 *
 *  The LANDING is the strike, and it is FAST: the cobra's body shoots out of
 *  the hood to the target in a tight S, the head driving into the card, and
 *  where it bites two FANG punctures are left side by side. Venom seeps out
 *  of them — deep blue stains spreading through the card, ringed in amber,
 *  running down it — and the card goes HEAVY: a dark veil sinks over it from
 *  the top like eyelids closing (the SLEEP), while the snake whips back into
 *  its coil. On a kill the coils come round instead: the cobra's body wraps
 *  the card two turns deep and squeezes.
 *
 *  Not Venomarch's sting: no green, no veins, no mist. This is a snake — a
 *  dark scaled body (`dark: true`, every shape rimmed in its blue scale-light
 *  so it reads over an empty square), amber eyes and fangs, one fast bite,
 *  and the card's light going out. */
import { centre, rand } from "../../looks/base";
import type { Graphics } from "pixi.js";
import type { FxTools, Pt, SparkStyle } from "../../looks/types";
import type { Signature, SigMoment } from "../types";

type Box = SigMoment["from"];

const TAU = Math.PI * 2;
// The snake's body and hood, and the venom's dark, on the dark layer.
const SCALE = 0x05070e, SCALE_IN = 0x0c1630, STAIN = 0x061440, VEIL = 0x02040c;
// Its light (additive): blue scale-light along the body, amber under it.
const BLUE_HI = 0xb4dcff, BLUE = 0x3a8cff, BLUE_DEEP = 0x1846b0;
const AMBER_HI = 0xffe2a0, AMBER = 0xffa830;
/** Venom flicked off the fangs: blue and amber drops. */
const VENOM: SparkStyle = { palette: [AMBER_HI, AMBER, BLUE, BLUE_DEEP], gravity: 520, drag: 0.6, size: [5, 2], streak: false };
/** Scale-light shed as the body snaps out: quick blue streaks. */
const SHED: SparkStyle = { palette: [BLUE_HI, BLUE, BLUE_DEEP], gravity: 0, drag: 0.08, size: [4, 1.5], streak: true };

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeOut = (x: number) => 1 - (1 - x) * (1 - x);
const smooth = (x: number) => x * x * (3 - 2 * x);

// ── The hood ─────────────────────────────────────────────────────────────────

/** The cobra rearing behind her card, as on her art — upright on the
 *  screen whichever way the board faces, because the card art is: its neck
 *  at the card's centre, `open` 0..1 how far the hood has spread, swayed by
 *  `tilt` about the neck and drawn back by `back` (px, x/y). Returns the
 *  hood's outline, the head and where its features sit. */
function hood(c: Pt, s: number, open: number, tilt: number, back: Pt) {
  const neck = { x: c.x + back.x, y: c.y + s * 0.3 + back.y }, H = s * 1.15, W = s * 0.68 * (0.2 + 0.8 * open);
  const cs = Math.cos(tilt), sn = Math.sin(tilt);
  const at = (dx: number, dy: number): Pt => ({ x: neck.x + dx * cs - dy * sn, y: neck.y + dx * sn + dy * cs });
  const left: number[] = [], right: number[] = [];
  const N = 16;
  for (let i = 0; i <= N; i++) {
    const v = i / N;
    // Narrow at the neck, broad through the upper middle, rounding over the
    // top into the head: a cobra's spread hood.
    const w = v < 0.55 ? W * (0.12 + 0.88 * smooth(v / 0.55)) : W * (1 - 0.82 * Math.pow((v - 0.55) / 0.45, 2.2));
    const l = at(-w, -H * v), r = at(w, -H * v);
    left.push(l.x, l.y);
    right.unshift(r.x, r.y);
  }
  const head = at(0, -H * 1.04), eyes = [at(-s * 0.06, -H * 1.03), at(s * 0.06, -H * 1.03)];
  return { outline: left.concat(right), head, eyes, neck, W, H, at, tilt };
}

/** The hood drawn. Dark: the hood and (`withHead`) its head as black
 *  scale. Light: its blue scale rim, rows of scales catching the light, the
 *  amber throat-scutes down its front and the head's amber eyes. */
function drawHood(g: Graphics, h: ReturnType<typeof hood>, s: number, a: number, dark: boolean, withHead = true) {
  if (a <= 0.02) return;
  const hx = s * 0.13, hy = s * 0.095;
  if (dark) {
    g.poly(h.outline, true).fill({ color: SCALE, alpha: 0.72 * a });
    if (withHead) g.ellipse(h.head.x, h.head.y, hx, hy).fill({ color: SCALE, alpha: 0.92 * a });
    return;
  }
  g.poly(h.outline, true).fill({ color: BLUE_DEEP, alpha: 0.12 * a })
    .stroke({ width: Math.max(4, s * 0.07), color: BLUE, alpha: 0.18 * a, join: "round" });
  g.poly(h.outline, true).stroke({ width: 1.6, color: BLUE_HI, alpha: 0.85 * a, join: "round" });
  // Scales: rows of little blue arcs across each wing of the hood.
  for (let row = 1; row <= 5; row++) {
    const v = 0.12 + row * 0.13, wide = h.W * 0.8 * (v < 0.55 ? 0.3 + 0.7 * v / 0.55 : 1 - 0.7 * (v - 0.55) / 0.45);
    for (const sd of [-1, 1])
      for (let k = 1; k <= 2; k++) {
        const p = h.at(sd * wide * (0.3 + 0.32 * k), -h.H * v), r = s * 0.032, a0 = h.tilt + 0.35;
        g.moveTo(p.x + Math.cos(a0) * r, p.y + Math.sin(a0) * r).arc(p.x, p.y, r, a0, a0 + Math.PI - 0.7).stroke({ width: 1, color: BLUE, alpha: 0.55 * a });
      }
  }
  // The throat: broad amber scutes stacked down the middle of the hood.
  for (let k = 0; k < 6; k++) {
    const v = 0.1 + k * 0.13, w = s * (0.06 + 0.012 * Math.sin(Math.PI * v)), l = h.at(-w, -h.H * v), r = h.at(w, -h.H * v), m = h.at(0, -h.H * v - s * 0.025);
    g.moveTo(l.x, l.y).quadraticCurveTo(m.x, m.y, r.x, r.y).stroke({ width: 1.4, color: AMBER, alpha: 0.7 * a });
  }
  if (!withHead) return;
  g.ellipse(h.head.x, h.head.y, hx, hy).stroke({ width: 1.4, color: BLUE_HI, alpha: 0.85 * a });
  for (const e of h.eyes) g.circle(e.x, e.y, s * 0.045).fill({ color: AMBER, alpha: 0.3 * a }).circle(e.x, e.y, s * 0.02).fill({ color: AMBER_HI, alpha: a });
}

// ── The strike ───────────────────────────────────────────────────────────────

/** The body's line from the head's start `a` to the bite `b`: a tight S —
 *  two bends, pinned at both ends, flattening as it straightens. */
function sCurve(a: Pt, b: Pt, amp: number) {
  const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, nx = -dy / d, ny = dx / d;
  return (q: number) => {
    const off = amp * Math.sin(TAU * q) * Math.sin(Math.PI * q);
    return { x: a.x + dx * q + nx * off, y: a.y + dy * q + ny * off };
  };
}

/** The body as a polygon from `q0` to the head at `q1`, thick at the root
 *  and narrowing toward the head. Also hands back the centre line. */
function body(path: (q: number) => Pt, q0: number, q1: number, s: number) {
  const N = 24, left: number[] = [], right: number[] = [], spine: Pt[] = [];
  for (let k = 0; k <= N; k++) {
    const f = k / N, q = q0 + (q1 - q0) * f, p = path(q), p2 = path(q + 0.01), p1 = path(q - 0.01);
    const tx = p2.x - p1.x, ty = p2.y - p1.y, tl = Math.hypot(tx, ty) || 1, w = s * (0.11 - 0.035 * f);
    left.push(p.x - (ty / tl) * w, p.y + (tx / tl) * w);
    right.unshift(p.x + (ty / tl) * w, p.y - (tx / tl) * w);
    spine.push(p);
  }
  return { poly: left.concat(right), spine };
}

/** The striking head at `p` heading `h`: a broad wedge, two amber eyes and,
 *  `bite` 0..1, the jaws open with two fangs out in front. */
function head(g: Graphics, p: Pt, h: number, s: number, a: number, dark: boolean, bite: number) {
  const ux = Math.cos(h), uy = Math.sin(h), nx = -uy, ny = ux, L = s * 0.2, W = s * 0.11;
  const pts = [p.x - ux * L * 0.3 + nx * W * 0.7, p.y - uy * L * 0.3 + ny * W * 0.7, p.x + ux * L * 0.35 + nx * W, p.y + uy * L * 0.35 + ny * W,
    p.x + ux * L, p.y + uy * L, p.x + ux * L * 0.35 - nx * W, p.y + uy * L * 0.35 - ny * W, p.x - ux * L * 0.3 - nx * W * 0.7, p.y - uy * L * 0.3 - ny * W * 0.7];
  if (dark) {
    g.poly(pts, true).fill({ color: SCALE, alpha: 0.95 * a });
    return;
  }
  g.poly(pts, true).fill({ color: BLUE_DEEP, alpha: 0.2 * a }).stroke({ width: 1.5, color: BLUE_HI, alpha: 0.9 * a, join: "round" });
  for (const sd of [-1, 1]) {
    const e = { x: p.x + ux * L * 0.35 + nx * W * 0.55 * sd, y: p.y + uy * L * 0.35 + ny * W * 0.55 * sd };
    g.circle(e.x, e.y, s * 0.03).fill({ color: AMBER, alpha: 0.35 * a }).circle(e.x, e.y, s * 0.014).fill({ color: AMBER_HI, alpha: a });
    if (bite > 0.02) {
      const f0 = { x: p.x + ux * L * 0.75 + nx * W * 0.35 * sd, y: p.y + uy * L * 0.75 + ny * W * 0.35 * sd };
      const f1 = { x: f0.x + ux * L * 0.55 * bite, y: f0.y + uy * L * 0.55 * bite };
      g.moveTo(f0.x, f0.y).lineTo(f1.x, f1.y).stroke({ width: 2, color: AMBER_HI, alpha: a, cap: "round" });
    }
  }
}

export const KOBRA: Signature = {
  shake: 0.9,
  // The cobra is the lunge: her card stays put while the snake strikes.
  lunge: false,

  deliver(t: FxTools, m: SigMoment, seconds: number) {
    const c = centre(m.from), s = m.size, T = seconds, D = T + 0.02;
    const state = (time: number) => {
      const open = easeOut(clamp01(time / (T * 0.5)));
      // Swaying as it spreads; at the end it rears back, away from the
      // target, ready.
      const rear = smooth(clamp01((time - T * 0.7) / (T * 0.3)));
      const tilt = 0.14 * Math.sin(time * 7) * (1 - rear) - 0.08 * rear * Math.sign(m.ahead.x || 1);
      return hood(c, s, open, tilt, { x: -m.ahead.x * s * 0.1 * rear, y: -m.ahead.y * s * 0.1 * rear - s * 0.04 * rear });
    };
    const alpha = (time: number) => clamp01(time / 0.08);
    t.draw(D, (g, u) => { const time = u * D; drawHood(g, state(time), s, alpha(time), true); }, { dark: true });
    t.draw(D, (g, u) => { const time = u * D; drawHood(g, state(time), s, alpha(time), false); });
    t.later(T * 0.5, () => {
      const h = state(T * 0.5);
      for (const e of h.eyes) t.flash(e, AMBER, 0.12);
    });
  },

  land(t: FxTools, m: SigMoment) {
    const c = centre(m.from), s = m.size;
    if (!m.targets.length) return;
    const r = m.targets[0], p = centre(r), k = Math.max(0.8, Math.min(1.5, m.power[0] ?? 1));
    const killed = !!m.killed[0];
    // The hood it struck from, reared back, going as the body leaves it.
    const h = hood(c, s, 1, 0, { x: -m.ahead.x * s * 0.1, y: -m.ahead.y * s * 0.1 - s * 0.04 });
    const HD = 0.4;
    t.draw(HD, (g, u) => drawHood(g, h, s, 1 - smooth(u), true, false), { dark: true });
    t.draw(HD, (g, u) => drawHood(g, h, s, 1 - smooth(u), false, false));

    // THE STRIKE: out of the hood to the card in a tight S, the head biting
    // home on the near side of its centre; it holds, and whips back.
    // The body comes up out of the hood's heart, where the head left it.
    const root = h.at(0, -h.H * 0.55);
    const dir = Math.atan2(p.y - root.y, p.x - root.x);
    const bitePt = { x: p.x - Math.cos(dir) * s * 0.12, y: p.y - Math.sin(dir) * s * 0.12 };
    const d = Math.hypot(bitePt.x - root.x, bitePt.y - root.y);
    const path = sCurve(root, bitePt, Math.min(s * 0.3, d * 0.17) * (Math.random() < 0.5 ? -1 : 1));
    const STRIKE = 0.11, HOLD = 0.32, BACK = 0.24, D = HOLD + BACK;
    // The head along the path: shot out, held in the bite, drawn back.
    const reach = (time: number) => (time < STRIKE ? easeOut(time / STRIKE) : time < HOLD ? 1 : 1 - smooth((time - HOLD) / BACK));
    // A kill keeps the body out: it goes round the card instead of back.
    const fade = (time: number) => (killed ? 1 - clamp01((time - 0.22) / 0.1) : 1 - clamp01((time - HOLD - BACK * 0.6) / (BACK * 0.4)));
    const draw = (g: Graphics, time: number, dark: boolean) => {
      const q = reach(time), a = fade(time);
      if (q < 0.03 || a <= 0.02) return;
      const b = body(path, 0, q, s);
      const tip = path(q), back = path(Math.max(0, q - 0.02)), hd = Math.atan2(tip.y - back.y, tip.x - back.x);
      if (dark) {
        g.poly(b.poly, true).fill({ color: SCALE, alpha: 0.92 * a });
        head(g, tip, hd, s, a, true, 0);
        return;
      }
      g.poly(b.poly, true).fill({ color: BLUE_DEEP, alpha: 0.18 * a }).stroke({ width: 1.5, color: BLUE, alpha: 0.85 * a, join: "round" });
      // The belly scutes: amber dashes along the spine; blue scale glints.
      for (let i = 2; i < b.spine.length - 2; i += 2) {
        const e = b.spine[i], f = b.spine[i + 1];
        g.moveTo(e.x, e.y).lineTo(f.x, f.y);
      }
      g.stroke({ width: 1.6, color: AMBER, alpha: 0.75 * a, cap: "round" });
      head(g, tip, hd, s, a, false, time > STRIKE * 0.6 && time < HOLD + 0.05 ? 1 : 0.3);
    };
    t.draw(D, (g, u) => draw(g, u * D, true), { dark: true });
    let shed = 0;
    t.draw(D, (g, u, dt) => {
      const time = u * D;
      draw(g, time, false);
      if (time < STRIKE) {
        shed += dt * 120 * t.quality;
        const tip = path(reach(time));
        for (; shed >= 1; shed--) t.spark(tip.x + rand(-3, 3), tip.y + rand(-3, 3), -Math.cos(dir) * 60 * (s / 90), -Math.sin(dir) * 60 * (s / 90), rand(0.15, 0.3), SHED);
      }
    });

    t.later(STRIKE, () => bite(t, r, dir, s, k));
    if (killed) t.later(0.2, () => coils(t, r, s, dir));
  },
};

/** The bite on a card: two fang punctures side by side across the strike,
 *  venom seeping out of each in a deep blue stain ringed amber and running
 *  down, and the card going heavy — a dark veil sinking over it from the
 *  top like eyelids closing. */
function bite(t: FxTools, r: Box, dir: number, s: number, k: number) {
  const c = centre(r), nx = -Math.sin(dir), ny = Math.cos(dir), gap = s * 0.09;
  const at = { x: c.x - Math.cos(dir) * s * 0.04, y: c.y - Math.sin(dir) * s * 0.04 };
  const holes = [-1, 1].map((sd) => ({ x: at.x + nx * gap * sd, y: at.y + ny * gap * sd }));
  t.flash(at, AMBER_HI, 0.45 * k);
  t.ring(r, AMBER, 0.15, 0.6, 0.22, 2);
  const n = Math.round(9 * k);
  for (let i = 0; i < n; i++) {
    const a = dir + Math.PI + rand(-1.2, 1.2), v = rand(90, 200) * (s / 90), o = holes[i % 2];
    t.spark(o.x, o.y, Math.cos(a) * v, Math.sin(a) * v - 50 * (s / 90), rand(0.3, 0.5), VENOM);
  }
  const D = 0.95;
  const stain = (time: number) => s * (0.03 + 0.1 * k * easeOut(clamp01(time / 0.45)));
  const drip = (time: number) => s * 0.32 * easeOut(clamp01((time - 0.08) / 0.5));
  const fade = (time: number) => 1 - clamp01((time - 0.6) / 0.35);
  // The veil: heavy lids from the top (and a little from the bottom).
  const lid = (time: number) => smooth(clamp01((time - 0.1) / 0.45));
  // The stain: one blot of venom spreading out from between the fangs, its
  // edge rolling, darkest where they went in.
  const seed = rand(0, 10);
  const blot = (g: Graphics, time: number, grow: number) => {
    const R = stain(time) * grow, pts: number[] = [];
    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * TAU, rr = R * (1 + 0.18 * Math.sin(3 * a + seed) + 0.1 * Math.sin(5 * a - seed));
      pts.push(at.x + Math.cos(a) * rr * 1.35, at.y + Math.sin(a) * rr + R * 0.25);
    }
    return g.poly(pts, true);
  };
  t.draw(D, (g, u) => {
    const time = u * D, a = fade(time), L = lid(time);
    const top = r.h * 0.55 * L, bot = r.h * 0.18 * L;
    for (let b = 0; b < 4; b++) {
      g.rect(r.x, r.y, r.w, top * (1 - b * 0.22)).fill({ color: VEIL, alpha: 0.16 * a });
      g.rect(r.x, r.y + r.h - bot * (1 - b * 0.22), r.w, bot * (1 - b * 0.22)).fill({ color: VEIL, alpha: 0.14 * a });
    }
    blot(g, time, 1).fill({ color: STAIN, alpha: 0.5 * a });
    for (const o of holes) {
      g.moveTo(o.x, o.y).lineTo(o.x, o.y + drip(time)).stroke({ width: Math.max(2, s * 0.035), color: STAIN, alpha: 0.55 * a, cap: "round" });
      g.ellipse(o.x, o.y, s * 0.018, s * 0.032).fill({ color: SCALE_IN, alpha: 0.95 * a });
    }
  }, { dark: true });
  t.draw(D, (g, u) => {
    const time = u * D, a = fade(time), L = lid(time);
    // The lids' edges, a cold blue line closing in.
    if (L > 0.02) {
      g.moveTo(r.x, r.y + r.h * 0.55 * L).lineTo(r.x + r.w, r.y + r.h * 0.55 * L).stroke({ width: 1.2, color: BLUE, alpha: 0.6 * a });
      g.moveTo(r.x, r.y + r.h - r.h * 0.18 * L).lineTo(r.x + r.w, r.y + r.h - r.h * 0.18 * L).stroke({ width: 1, color: BLUE, alpha: 0.45 * a });
    }
    blot(g, time, 1).fill({ color: BLUE_DEEP, alpha: 0.22 * a }).stroke({ width: 1.2, color: BLUE, alpha: 0.6 * a });
    blot(g, time, 0.5).fill({ color: AMBER, alpha: 0.16 * a });
    for (const o of holes) {
      g.moveTo(o.x, o.y + s * 0.03).lineTo(o.x, o.y + drip(time)).stroke({ width: 1, color: AMBER, alpha: 0.6 * a });
      g.circle(o.x, o.y + drip(time), 1.8).fill({ color: AMBER_HI, alpha: 0.9 * a });
      g.ellipse(o.x, o.y, s * 0.018, s * 0.032).stroke({ width: 1.2, color: AMBER_HI, alpha: a });
    }
  });
}

/** On a kill, the coils: the cobra's body wound twice round the card and
 *  tightening on it — dark scale, a blue rim, amber scutes — then the
 *  squeeze, chips of light popping off it. */
function coils(t: FxTools, r: Box, s: number, dir: number) {
  const c = centre(r), D = 0.75, turns = 2.1, a0 = dir + Math.PI;
  const spiral = (time: number) => {
    const wrap = easeOut(clamp01(time / 0.3)), squeeze = 1 - 0.28 * smooth(clamp01((time - 0.25) / 0.25));
    const pts: number[] = [], N = 48, span = turns * wrap;
    for (let i = 0; i <= N; i++) {
      const f = i / N, a = a0 + f * span * TAU, rr = s * (0.66 - 0.12 * f) * squeeze;
      pts.push(c.x + Math.cos(a) * rr, c.y + Math.sin(a) * rr * 0.82);
    }
    return pts;
  };
  const fade = (time: number) => 1 - clamp01((time - 0.55) / 0.2);
  t.draw(D, (g, u) => {
    const time = u * D;
    g.poly(spiral(time), false).stroke({ width: s * 0.13, color: SCALE, alpha: 0.9 * fade(time), cap: "round", join: "round" });
  }, { dark: true });
  t.draw(D, (g, u) => {
    const time = u * D, a = fade(time), pts = spiral(time);
    g.poly(pts, false).stroke({ width: s * 0.13, color: BLUE_DEEP, alpha: 0.18 * a, cap: "round", join: "round" });
    g.poly(pts, false).stroke({ width: 1.2, color: AMBER, alpha: 0.6 * a, join: "round" });
    // The rim: the outer edge of the coil, lit blue.
    const rim: number[] = [];
    for (let i = 0; i < pts.length; i += 2) {
      const dx = pts[i] - c.x, dy = pts[i + 1] - c.y, l = Math.hypot(dx, dy) || 1;
      rim.push(pts[i] + (dx / l) * s * 0.06, pts[i + 1] + (dy / l) * s * 0.06);
    }
    g.poly(rim, false).stroke({ width: 1.4, color: BLUE_HI, alpha: 0.75 * a, join: "round" });
  });
  t.later(0.42, () => {
    t.flash(c, AMBER, 0.4);
    t.ring(r, BLUE, 0.9, 0.4, 0.25, 3);
    for (let i = 0; i < 12; i++) {
      const a = rand(0, TAU), v = rand(80, 170) * (s / 90);
      t.spark(c.x + Math.cos(a) * s * 0.3, c.y + Math.sin(a) * s * 0.3, Math.cos(a) * v, Math.sin(a) * v, rand(0.25, 0.4), VENOM);
    }
  });
}
