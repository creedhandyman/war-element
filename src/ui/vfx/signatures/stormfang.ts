/** STORMFANG — Whirling Missile. "Dash into the target's row, then deal 14 DMG
 *  to it and 7 DMG to opponents adjacent to it" — and WEAKEN on all of them.
 *  The pack runs at his speed; the faster he gets, the harder it lands.
 *
 *  The DELIVERY is the wolf turning himself into a missile. He SPINS UP where
 *  he stands — streaks of wind orbiting in round his square and quickening,
 *  dust drawn in — until the spin is a funnel: GALE's dust-devil laid on its
 *  side, point first, turning. Then it FLIES, and it homes: out along the dash
 *  toward the square he will end on and hooked in onto the card, the way a
 *  thrown missile bends to its mark, faster every frame, a corkscrew of wind
 *  unwinding behind it. The point is on the card as the delivery ends.
 *
 *  The LANDING is the drill and what it throws off. The funnel bores into the
 *  card — shortening as it goes in, spinning faster, spiral scoring round the
 *  hole and grit flung off it — and then it BURSTS: the spin let go all at once
 *  as crescent blades of wind, one flung at each card beside it (the splash),
 *  each carving across the card it reaches. The crescents are his fangs — the
 *  shape GALE cuts with, and a wolf's. Where he stops, a whirl settles as he
 *  comes out of the spin. A kill blows the funnel up off the card and away. */
import { centre, rand } from "../looks/base";
import type { Graphics } from "pixi.js";
import type { FxTools, Pt, SparkStyle } from "../looks/types";
import type { Signature } from "./types";

type Box = { x: number; y: number; w: number; h: number };

const TAU = Math.PI * 2;
const CREAM = 0xfffaf0, PEACH = 0xffd9a0, APRICOT = 0xffc070, AMBER = 0xffa040, RUST = 0xd9701a;
/** The bore hole — only ever on the dark layer. */
const INK = 0x0c0806;

/** Dust in the wind, curling round where it was blown off. */
const EDDY: SparkStyle = { palette: [CREAM, PEACH, AMBER], gravity: -20, drag: 0.35, size: [6, 2], streak: true, swirl: 650 };
/** Grit flung off the drill: fast, hot, bent round by the spin. */
const GRIND: SparkStyle = { palette: [CREAM, APRICOT, AMBER, RUST], gravity: 0, drag: 0.3, size: [7, 2], streak: true, swirl: 900 };

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeOut = (x: number) => 1 - (1 - x) * (1 - x);
/** 0 -> 1 as `u` runs from `a` to `b`. */
const span = (u: number, a: number, b: number) => clamp01((u - a) / (b - a));

/** The card the missile was aimed at: the one that took the most. The targets
 *  come in the order the engine touched them, so the splash can come first. */
function mainOf(power: number[]): number {
  let best = 0;
  for (let i = 1; i < power.length; i++) if (power[i] > power[best]) best = i;
  return best;
}

// ── The flight ──────────────────────────────────────────────────────────────

/** The missile's line: a curve from his square, bent toward the square he
 *  dashes to, onto the card — out along the dash and hooked in, as the rules
 *  have it. With no dash (he struck from where he stood) it is a straight line. */
function homing(c0: Pt, via: Pt, p: Pt) {
  const at = (v: number): Pt => ({
    x: (1 - v) * (1 - v) * c0.x + 2 * (1 - v) * v * via.x + v * v * p.x,
    y: (1 - v) * (1 - v) * c0.y + 2 * (1 - v) * v * via.y + v * v * p.y,
  });
  const dir = (v: number): Pt => {
    let dx = 2 * (1 - v) * (via.x - c0.x) + 2 * v * (p.x - via.x), dy = 2 * (1 - v) * (via.y - c0.y) + 2 * v * (p.y - via.y);
    if (Math.hypot(dx, dy) < 1e-3) { dx = p.x - c0.x; dy = p.y - c0.y; }
    const d = Math.hypot(dx, dy) || 1;
    return { x: dx / d, y: dy / d };
  };
  let length = 0;
  for (let i = 0; i < 12; i++) {
    const a = at(i / 12), b = at((i + 1) / 12);
    length += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return { at, dir, length };
}

/** Fractions of the delivery: spinning up until LAUNCH, flying after. */
const LAUNCH = 0.3;
/** How far along its line the missile is, `u` into the delivery: gathering
 *  speed the whole way (the faster he gets...), and on the card at the end. */
const along = (u: number) => { const f = span(u, LAUNCH, 1); return f * (0.4 + 0.6 * f); };

// ── GALE's shapes ───────────────────────────────────────────────────────────

/** A dust-devil laid on its side and pointed: rings stacked back from its
 *  point at (x, y) along -(ux, uy), `len` long and `w` across at the back, each
 *  an OPEN ellipse whose gap turns with `spin` — so it spins, and reads as air
 *  turning rather than a solid cone. Dust at the point, air at the back. */
function funnel(g: Graphics, x: number, y: number, ux: number, uy: number, len: number, w: number, spin: number, alpha: number) {
  if (alpha <= 0.01 || len < 2) return;
  const nx = -uy, ny = ux, levels = 5, left: number[] = [], right: number[] = [];
  const bx = x - ux * len, by = y - uy * len, bw = w / 2;
  // A faint body under the rings, so it has mass: a missile, not a spring.
  g.poly([x, y, bx + nx * bw, by + ny * bw, bx - nx * bw, by - ny * bw]).fill({ color: AMBER, alpha: 0.16 * alpha });
  for (let j = 0; j < levels; j++) {
    const f = j / (levels - 1);
    const cx = x - ux * len * f, cy = y - uy * len * f;
    const rx = bw * (0.12 + 0.88 * Math.pow(f, 0.9)), ry = rx * 0.34 + 1;
    const a0 = spin * (1.5 - 0.5 * f) + j * 1.9, ring: number[] = [];
    for (let i = 0; i <= 8; i++) {
      const th = a0 + (i / 8) * TAU * 0.72;
      ring.push(cx + nx * Math.cos(th) * rx + ux * Math.sin(th) * ry, cy + ny * Math.cos(th) * rx + uy * Math.sin(th) * ry);
    }
    g.poly(ring, false).stroke({ width: 3.2 - f * 1.1, color: f < 0.3 ? APRICOT : f < 0.7 ? PEACH : CREAM, alpha: alpha * (0.95 - 0.15 * f), cap: "round" });
    left.push(cx + nx * rx, cy + ny * rx);
    right.push(cx - nx * rx, cy - ny * rx);
  }
  g.poly(left, false).stroke({ width: 1.4, color: PEACH, alpha: alpha * 0.55 });
  g.poly(right, false).stroke({ width: 1.4, color: PEACH, alpha: alpha * 0.55 });
  g.circle(x, y, Math.max(2, w * 0.09)).fill({ color: CREAM, alpha });
}

/** The same spin seen END-ON, as it bores down into a card: open rings
 *  turning round `c` at their own speeds, the outer ones slower. */
function bore(g: Graphics, c: Pt, r: number, spin: number, alpha: number) {
  if (alpha <= 0.01) return;
  for (let j = 0; j < 3; j++) {
    const rr = r * (0.42 + 0.29 * j), a = spin * (1.4 - 0.3 * j) + j * 2.1;
    g.moveTo(c.x + Math.cos(a) * rr, c.y + Math.sin(a) * rr).arc(c.x, c.y, rr, a, a + TAU * 0.7)
      .stroke({ width: 3.4 - j * 0.8, color: j === 0 ? CREAM : j === 1 ? PEACH : APRICOT, alpha: alpha * (1 - 0.18 * j), cap: "round" });
  }
}

/** A crescent wind-blade — the fang: the lune between an arc of radius `r`
 *  and a swell `thick` outside it, tapering to a point at both tips. (x, y) is
 *  the middle of its inner edge, `rot` the way its convex side faces, and
 *  [s0, s1] of its length is drawn, so a cut can sweep on and off. */
function blade(g: Graphics, x: number, y: number, r: number, rot: number, arc: number, thick: number,
  s0: number, s1: number, color: number, alpha: number) {
  if (s1 - s0 < 0.02 || alpha <= 0.01) return;
  const ox = x - Math.cos(rot) * r, oy = y - Math.sin(rot) * r, n = 9, body: number[] = [], edge: number[] = [];
  for (let i = 0; i <= n; i++) {
    const a = rot + (s0 + ((s1 - s0) * i) / n - 0.5) * arc;
    body.push(ox + Math.cos(a) * r, oy + Math.sin(a) * r);
  }
  for (let i = n; i >= 0; i--) {
    const f = s0 + ((s1 - s0) * i) / n, a = rot + (f - 0.5) * arc, rr = r + thick * Math.sin(Math.PI * f);
    body.push(ox + Math.cos(a) * rr, oy + Math.sin(a) * rr);
    edge.push(ox + Math.cos(a) * rr, oy + Math.sin(a) * rr);
  }
  g.poly(body).fill({ color, alpha: alpha * 0.6 });
  g.poly(edge, false).stroke({ width: 1.8, color: CREAM, alpha });
}

/** Air whirled round `c`: a streak from radius `rt` (its tail) turning through
 *  `len` radians to `rh` (its head), bold at the head. */
function whirl(g: Graphics, c: Pt, rt: number, rh: number, a: number, len: number, width: number, color: number, alpha: number) {
  if (alpha <= 0.01) return;
  const all: number[] = [], head: number[] = [];
  for (let i = 0; i <= 10; i++) {
    const f = i / 10, r = rt + (rh - rt) * f, th = a + len * f;
    all.push(c.x + Math.cos(th) * r, c.y + Math.sin(th) * r);
    if (i >= 6) head.push(c.x + Math.cos(th) * r, c.y + Math.sin(th) * r);
  }
  g.poly(all, false).stroke({ width: width * 0.5, color, alpha: alpha * 0.55, cap: "round" });
  g.poly(head, false).stroke({ width, color, alpha, cap: "round" });
}

export const STORMFANG: Signature = {
  shake: 1.3,
  // He does not lunge: the whole dash is drawn, as the missile.
  lunge: false,

  deliver(t: FxTools, m, seconds) {
    const T = seconds, s = m.size, k = s / 90;
    const c0 = centre(m.from), p = centre(m.targets[mainOf(m.power)]);
    const path = homing(c0, centre(m.to), p);
    const w = s * 0.58, len = s * 0.66;

    // THE SPIN-UP: streaks of wind orbiting in round his square, tightening
    // and quickening, dust pulled in with them — and the funnel forming in
    // the middle of it, pointed where he is about to go.
    const a0 = rand(0, TAU), up = T * (LAUNCH + 0.08);
    t.draw(up, (g, u) => {
      const e = u * u, r = s * (0.95 - 0.62 * e), al = Math.min(1, u * 5) * (1 - span(u, 0.85, 1));
      for (let i = 0; i < 4; i++)
        whirl(g, c0, r * 1.3, r, a0 + 12 * e + (i * TAU) / 4, 1.5, 3, i % 2 ? PEACH : CREAM, 0.95 * al);
      const d0 = path.dir(0), grow = span(u, 0.35, 0.8);
      if (grow > 0 && u < 0.9) funnel(g, c0.x + d0.x * len * 0.4, c0.y + d0.y * len * 0.4, d0.x, d0.y, len * grow, w * grow, a0 + u * T * 40, grow);
    });
    t.emit({ count: 22, palette: [CREAM, PEACH, AMBER], from: m.from, at: "ring", speed: [130, 210], gravity: 0, drag: 1,
      life: [0.2, T * LAUNCH], size: [8, 2], streak: true, swirl: 900 });
    t.charge(c0, s * 1.1, AMBER, 0.3, T * LAUNCH);

    // THE MISSILE: the funnel flying the dash and hooking in onto the card,
    // point first and turning, a corkscrew of wind unwinding behind it along
    // the line it flew.
    let acc = 0;
    const D = T * (1 - LAUNCH);
    t.draw(D, (g, u, dt) => {
      const time = u * D, v = along(LAUNCH + u * (1 - LAUNCH)), head = path.at(v), d = path.dir(v);
      const al = Math.min(1, u * 8);
      // The wake: the stretch of the line behind it, a braid of two strands
      // round it, widest at the funnel and thinning out behind.
      const back = Math.min(v, (s * 1.5) / Math.max(1, path.length)), v0 = v - back;
      if (back > 0.01) {
        const n = 14;
        for (let st = 0; st < 2; st++) {
          const pts: number[] = [];
          for (let i = 0; i <= n; i++) {
            const q = v0 + (back * i) / n, c = path.at(q), dd = path.dir(q), f = i / n;
            const amp = s * (0.06 + 0.15 * f) * Math.sin(f * 11 - time * 38 + st * Math.PI);
            pts.push(c.x - dd.y * amp - d.x * len * f * 0.9, c.y + dd.x * amp - d.y * len * f * 0.9);
          }
          g.poly(pts, false).stroke({ width: 2.2, color: st ? PEACH : CREAM, alpha: 0.7 * al, cap: "round" });
        }
        const tail = path.at(v0);
        for (const o of [-0.3, 0.3])
          g.moveTo(head.x - d.x * len + -d.y * o * s, head.y - d.y * len + d.x * o * s)
            .lineTo(tail.x - d.x * len * 0.9 + -d.y * o * s * 0.6, tail.y - d.y * len * 0.9 + d.x * o * s * 0.6)
            .stroke({ width: 1.4, color: PEACH, alpha: 0.45 * al });
      }
      g.circle(head.x - d.x * len * 0.45, head.y - d.y * len * 0.45, w * 0.55).fill({ color: AMBER, alpha: 0.12 * al });
      funnel(g, head.x, head.y, d.x, d.y, len, w, a0 + time * 55, al);
      // Dust flung off it as it goes, curling away.
      acc += dt * 90 * t.quality;
      for (; acc >= 1; acc--) {
        const side = Math.random() < 0.5 ? -1 : 1, sp = rand(60, 140) * k;
        t.spark(head.x - d.x * len * 0.8 - d.y * side * w * 0.4, head.y - d.y * len * 0.8 + d.x * side * w * 0.4,
          -d.y * side * sp - d.x * sp * 0.4, d.x * side * sp - d.y * sp * 0.4, rand(0.2, 0.35), EDDY);
      }
    }, { delay: T * LAUNCH });
  },

  land(t: FxTools, m) {
    const s = m.size, k = s / 90;
    const hit = m.targets.length ? mainOf(m.power) : -1;
    const r: Box = hit >= 0 ? m.targets[hit] : m.to;
    const p = centre(r), c0 = centre(m.from), end = centre(m.to);
    const kk = hit >= 0 ? Math.max(0.7, Math.min(1.8, m.power[hit])) : 0.7;
    const d = homing(c0, end, p).dir(1), w = s * 0.58, len = s * 0.66, a0 = rand(0, TAU);
    const DRILL = 0.24;

    // THE DRILL: the funnel going into the card point first — gone into it in
    // a few frames — and then the same spin seen end-on as it bores down:
    // rings turning round the hole and drawn in toward it, spiral scoring
    // closing on it...
    t.draw(DRILL + 0.08, (g, u) => {
      const time = u * (DRILL + 0.08), f = span(time, 0, DRILL), al = 1 - span(time, DRILL, DRILL + 0.08);
      const inn = span(time, 0, 0.1);
      if (inn < 1) funnel(g, p.x, p.y, d.x, d.y, len * (1 - inn), w * (1 - 0.3 * inn), a0 + time * 90, 1 - inn);
      bore(g, p, s * 0.5 * Math.min(1.3, kk) * (1 - 0.3 * f), a0 + time * 30, al * span(time, 0.02, 0.08));
      for (let i = 0; i < 3; i++)
        whirl(g, p, s * (0.68 - 0.28 * f) * kk, s * (0.34 - 0.14 * f) * kk, a0 + time * 22 + (i * TAU) / 3, 1.6, 3, i % 2 ? PEACH : CREAM, 0.9 * al);
    });
    // ...the hole it bores (dark, lit round its rim)...
    const HD = 0.7;
    t.draw(HD, (g, u) => {
      const time = u * HD, rr = s * 0.2 * Math.min(1.3, kk) * easeOut(span(time, 0, DRILL));
      if (rr > 0.5) g.circle(p.x, p.y, rr).fill({ color: INK, alpha: 0.6 * (1 - span(time, 0.3, HD)) });
    }, { dark: true });
    t.draw(HD, (g, u) => {
      const time = u * HD, rr = s * 0.2 * Math.min(1.3, kk) * easeOut(span(time, 0, DRILL));
      if (rr > 0.5) g.circle(p.x, p.y, rr).stroke({ width: 2, color: APRICOT, alpha: 0.8 * (1 - span(time, 0.3, HD)) });
    });
    // ...and grit flung off the spin, bent round by it.
    let acc = 0;
    t.draw(DRILL, (_g, _u, dt) => {
      acc += dt * 130 * t.quality;
      for (; acc >= 1; acc--) {
        const a = rand(0, TAU), v = rand(150, 280) * k, rr = s * 0.18;
        t.spark(p.x + Math.cos(a) * rr, p.y + Math.sin(a) * rr, (-Math.sin(a) * 0.8 + Math.cos(a) * 0.6) * v,
          (Math.cos(a) * 0.8 + Math.sin(a) * 0.6) * v, rand(0.2, 0.4), GRIND, p);
      }
    });

    // THE BURST: the spin let go at once — a flash and a ring off the card,
    // and a fang of wind flung at every card beside it.
    t.later(DRILL, () => {
      t.flash(p, PEACH, 0.28 + 0.08 * kk);
      t.ring(r, CREAM, 0.7, 1.6 + 0.4 * kk, 0.4, 4);
      t.glow(r, AMBER, 0.25, 0.4, 1.0);
      const others = m.targets.map((tr, i) => ({ tr, i })).filter((o) => o.i !== hit);
      for (const o of others) fang(t, p, o.tr, m.power[o.i] ?? 0.8);
      // With nothing beside it, the spin still flies apart: crescents thrown
      // off it that spend themselves in the air.
      if (others.length === 0)
        for (let i = 0; i < 3; i++) {
          const a = a0 + (i * TAU) / 3, q = { x: p.x + Math.cos(a) * s * 0.9, y: p.y + Math.sin(a) * s * 0.9 };
          fling(t, p, q, s, 0.2, null);
        }
      if (hit >= 0 && m.killed[hit]) blowAway(t, p, s);
    });

    // WHERE HE STOPS: out of the spin — a whirl settling round his square,
    // dust thrown off it.
    const rot = rand(0, TAU);
    t.draw(0.45, (g, u) => {
      const e = easeOut(u);
      for (let i = 0; i < 3; i++)
        whirl(g, end, s * (0.3 + 0.38 * e), s * (0.24 + 0.3 * e), rot - e * 4 + (i * TAU) / 3, 1.3, 2.4, PEACH, 0.8 * (1 - u));
    });
    t.emit({ count: 12, palette: [CREAM, PEACH, AMBER], from: m.to, at: "ring", speed: [100, 170], gravity: 0, drag: 0.9,
      life: [0.3, 0.5], size: [7, 2], streak: true, swirl: 700 });
  },
};

/** A fang of wind flung from the drill at a card beside it, carving across
 *  it as it lands: a crescent spinning as it flies, turning its edge to the
 *  card at the last, then sweeping through it with dust driven on beyond. */
function fang(t: FxTools, from: Pt, r: Box, power: number) {
  const c = centre(r), s = Math.min(r.w, r.h);
  const kk = Math.max(0.55, Math.min(1.4, power));
  fling(t, from, c, s, 0.16, () => {
    const ang = Math.atan2(c.y - from.y, c.x - from.x), ux = Math.cos(ang), uy = Math.sin(ang), nx = -uy, ny = ux;
    const R = s * 0.6 * kk, side = Math.random() < 0.5 ? -1 : 1;
    // The cut: one big crescent swept across the card, convex side leading,
    // with a smaller one a beat behind the other way — back and forth, a bite.
    t.draw(0.42, (g, u) => {
      const age = u * 0.42;
      for (let j = 0; j < 2; j++) {
        const a = age - j * 0.07;
        if (a <= 0) continue;
        const s1 = clamp01(a / 0.07), s0 = clamp01((a - 0.12) / 0.2);
        const f0 = j ? 1 - s1 : s0, f1 = j ? 1 - s0 : s1, o = (j ? -0.2 : 0.15) * side;
        blade(g, c.x + nx * o * s - ux * s * 0.1, c.y + ny * o * s - uy * s * 0.1, R * (j ? 0.8 : 1), ang + side * (j ? -0.5 : 0.4),
          1.8, R * 0.3, f0, f1, AMBER, 1);
      }
    });
    t.glow(r, AMBER, 0.26, 0.3, 1.0);
    t.ring(r, PEACH, 0.3, 1.0 * kk, 0.3, 3);
    const n = Math.round(12 * kk);
    for (let i = 0; i < n; i++) {
      const a = ang + rand(-0.7, 0.7), v = rand(140, 280) * (s / 90);
      t.spark(c.x + rand(-5, 5), c.y + rand(-5, 5), Math.cos(a) * v, Math.sin(a) * v, rand(0.25, 0.45), EDDY);
    }
  });
}

/** A crescent flown from `a` to `b` in `secs`, spinning, turning its edge
 *  forward as it arrives (then `onArrive`), or — with none — spending itself:
 *  thinning and gone as it gets there. */
function fling(t: FxTools, a: Pt, b: Pt, s: number, secs: number, onArrive: (() => void) | null) {
  const ang = Math.atan2(b.y - a.y, b.x - a.x), dx = b.x - a.x, dy = b.y - a.y;
  const R = s * 0.27, turns = 1.5, spin0 = ang - turns * TAU;
  t.draw(secs, (g, u) => {
    const e = easeOut(u), x = a.x + dx * e, y = a.y + dy * e, rot = spin0 + u * turns * TAU;
    const al = onArrive ? Math.min(1, u * 6) : Math.min(1, u * 6) * (1 - u);
    // A short speed line behind it, never back past where it left.
    const back = Math.min(Math.hypot(dx, dy) * e, R * 1.5);
    g.moveTo(x - Math.cos(ang) * back, y - Math.sin(ang) * back).lineTo(x, y).stroke({ width: 1.6, color: PEACH, alpha: 0.45 * al });
    blade(g, x + Math.cos(rot) * R * 0.35, y + Math.sin(rot) * R * 0.35, R, rot, 2.4, R * 0.6, 0, 1, AMBER, al);
  });
  if (onArrive) t.later(secs, onArrive);
}

/** A kill: the funnel stood up on the card and blown up off it — a dust-devil
 *  lifting away, thinning as it goes. */
function blowAway(t: FxTools, p: Pt, s: number) {
  const spin0 = rand(0, TAU);
  t.draw(0.6, (g, u) => {
    const e = easeOut(u), h = s * (0.5 + 0.4 * e), al = 0.9 * (1 - u);
    // Upright now: point down on the card, mouth up, rising.
    funnel(g, p.x, p.y - s * 0.9 * e, 0, 1, h, s * (0.5 + 0.3 * e), spin0 + u * 30, al);
  });
  t.emit({ count: 14, palette: [CREAM, PEACH, AMBER], from: { x: p.x - s * 0.3, y: p.y - s * 0.2, w: s * 0.6, h: s * 0.4 },
    dir: [-120, -60], speed: [120, 240], gravity: -60, drag: 0.4, life: [0.35, 0.6], size: [8, 2], streak: true, swirl: 500 });
}
