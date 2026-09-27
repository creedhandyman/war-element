/** TRINEZER — Jungle Culling. "Deal 11 DMG (PEN) to a target (aim the
 *  lowest-HP). On a kill: gain STEALTH until end of next round, and Culling
 *  the Weak gives EVERY ally +1 DMG permanently." The Cycle asked him to keep
 *  the balance; he arrives with the brood already fed.
 *
 *  The DELIVERY is a predator's crouch and pounce. The undergrowth closes in
 *  round the card and it sinks low into its own shadow; a reptile's eyes glint
 *  out of it, slit-pupilled, and lock on — then it goes, a low jungle-green
 *  streak across the board to the weakest thing on it, three claw lines
 *  trailing it, leaves torn up in its wake. The LANDING is the culling: three
 *  jagged claw rakes torn across the target (TRI-nezer), dark gashes edged in
 *  pale green; the thorned vines across it snap and whip back, leaves flung,
 *  and a flick of red off the end of the swipe, like the red fronds on its
 *  art. On a kill the life it took rises off the card and runs as green pulses
 *  to every ally — the brood fed (+1 DMG each).
 *
 *  The gashes are drawn dark for real (`dark: true`), each edged in light so
 *  they read on an empty square as well as over a card. */
import { centre, rand } from "../looks/base";
import type { Graphics } from "pixi.js";
import type { FxTools, Pt, SparkStyle } from "../looks/types";
import type { Signature, SigMoment } from "./types";

type Box = SigMoment["from"];

const TAU = Math.PI * 2;
// The jungle: the same ramp as LEAF's own look, so the move reads as LEAF.
const PALE = 0xf4ffe6, LIME = 0xb6f27a, GREEN = 0x4caf6d;
/** Its eye, on the art: acid green going to gold. */
const EYE = 0xd8ff5a;
/** The dark of a gash and of its crouch, only ever on the dark layer. */
const GASH = 0x07030a, SHADOW = 0x020803;
/** The red of its fronds, and of the flick off the swipe. */
const RED = 0xff3b3b;
/** Leaf-bits torn up in its wake: they curl as they drift. */
const MOTE: SparkStyle = { palette: [PALE, LIME, GREEN], gravity: 60, drag: 0.5, size: [6, 2], streak: false, swirl: 170 };
const MOTE_L: SparkStyle = { ...MOTE, swirl: -170 };
/** The flick of red off the end of a rake: quick drops, falling. */
const FLICK: SparkStyle = { palette: [0xffd6d0, RED, 0xb0142a], gravity: 600, drag: 0.5, size: [6, 2], streak: true };
/** Life rising off the culled: green, drifting up, curling. */
const LIFE: SparkStyle = { palette: [PALE, LIME, GREEN], gravity: -90, drag: 0.6, size: [7, 2], streak: false, swirl: 140 };

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeOut = (x: number) => 1 - (1 - x) * (1 - x);
const smooth = (x: number) => x * x * (3 - 2 * x);

/** One leaf: a teardrop, round at the stem and pointed at the tip; `open` is
 *  how face-on it is, so a tumbling leaf thins to a sliver and back. */
function leaf(g: Graphics, x: number, y: number, len: number, ang: number, open: number, color: number, alpha: number) {
  if (alpha <= 0.02 || len < 2) return;
  const c = Math.cos(ang), s = Math.sin(ang), hx = c * len * 0.5, hy = s * len * 0.5, w = len * 0.46 * Math.max(0.12, open);
  const mx = x - hx * 0.3, my = y - hy * 0.3;
  g.moveTo(x - hx, y - hy).quadraticCurveTo(mx - s * w, my + c * w, x + hx, y + hy)
    .quadraticCurveTo(mx + s * w, my - c * w, x - hx, y - hy).fill({ color, alpha });
}

/** Leaves let loose from `at`: flung, slowing, rocking and turning over as
 *  they drift down — one Graphics for the lot. */
function flutter(t: FxTools, at: Pt, n: number, len: number, speed: number, life: number, dir?: number) {
  const ms = Array.from({ length: n }, () => {
    const a = dir === undefined ? rand(0, TAU) : dir + rand(-0.9, 0.9), v = speed * rand(0.5, 1);
    return { vx: Math.cos(a) * v, vy: Math.sin(a) * v - speed * 0.2, spin: rand(8, 14) * (Math.random() < 0.5 ? -1 : 1), ph: rand(0, TAU), len: len * rand(0.8, 1.2) };
  });
  t.draw(life, (g, u) => {
    const time = u * life, d = 0.18 * (1 - Math.exp(-time / 0.18));
    for (const m of ms) {
      const turn = Math.cos(m.spin * time + m.ph);
      leaf(g, at.x + m.vx * d + m.len * 0.4 * Math.sin(time * 7 + m.ph), at.y + m.vy * d + m.len * 2.4 * time, m.len, m.ph + m.spin * time * 0.3,
        0.2 + 0.8 * Math.abs(turn), turn > 0 ? LIME : GREEN, Math.min(1, u * 10) * (1 - u * u) * 0.95);
    }
  });
}

/** A claw rake: a jagged line from `a` to `b`, swept on a slight curve the way
 *  a claw moves, and how ragged each lip of the tear is along it — fixed
 *  once, so the tear holds its shape as it opens. */
function rakePath(a: Pt, b: Pt, bow: number, jag: number) {
  const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L, pts: number[] = [], rough: number[] = [];
  for (let i = 0; i <= 9; i++) {
    const f = i / 9, off = bow * Math.sin(Math.PI * f) + (i > 0 && i < 9 ? rand(-jag, jag) : 0);
    pts.push(a.x + dx * f + nx * off, a.y + dy * f + ny * off);
    rough.push(rand(0.55, 1.3), rand(0.55, 1.3));
  }
  return { pts, rough };
}

/** A rake's gash as a shape: the path's first `f` torn open to about `w`
 *  across — ragged at the lips, pointed at both ends: a tear, not a stroke. */
function gash(r: { pts: number[]; rough: number[] }, f: number, w: number): number[] {
  const pts = r.pts, n = pts.length / 2 - 1, m = Math.max(1, Math.ceil(n * f)), left: number[] = [], right: number[] = [];
  for (let i = 0; i <= m; i++) {
    const j = Math.min(i, n), q = Math.min(1, j / (n * Math.max(f, 1e-3)));
    const x = pts[j * 2], y = pts[j * 2 + 1];
    const tx = pts[Math.min(n, j + 1) * 2] - pts[Math.max(0, j - 1) * 2], ty = pts[Math.min(n, j + 1) * 2 + 1] - pts[Math.max(0, j - 1) * 2 + 1];
    const l = Math.hypot(tx, ty) || 1, hw = (w / 2) * Math.pow(Math.sin(Math.PI * Math.min(1, q)), 0.7);
    left.push(x - (ty / l) * hw * r.rough[j * 2], y + (tx / l) * hw * r.rough[j * 2]);
    right.unshift(x + (ty / l) * hw * r.rough[j * 2 + 1], y - (tx / l) * hw * r.rough[j * 2 + 1]);
  }
  return left.concat(right);
}

export const TRINEZER: Signature = {
  shake: 1.1,
  // Its token keeps its lunge: drawn back into the crouch, then driven at
  // the prey, which is the pounce the streak draws.

  deliver(t: FxTools, m: SigMoment, seconds: number) {
    const c = centre(m.from), s = m.size, S = seconds, GO = S * 0.5;
    const prey = m.targets.length ? centre(m.targets[0]) : { x: c.x + m.ahead.x * s * 2, y: c.y + m.ahead.y * s * 2 };
    // THE CROUCH: it sinks into its own shadow, the undergrowth closing in.
    const low = (time: number) => easeOut(clamp01(time / (GO * 0.8)));
    t.draw(S, (g, v) => {
      const time = v * S, k = low(time) * (time > GO ? 1 - (time - GO) / (S - GO) : 1);
      g.ellipse(c.x, c.y + s * 0.3, s * (0.36 + 0.1 * k), s * 0.12).fill({ color: SHADOW, alpha: 0.6 * k });
      // The eyes' dark, under their light: the slit shows through.
      for (const side of [-1, 1]) g.ellipse(c.x + side * s * 0.11, c.y - s * 0.16, s * 0.078, s * 0.042 * k).fill({ color: SHADOW, alpha: 0.9 * k });
    }, { dark: true });
    const fronds = Array.from({ length: 6 }, (_, i) => ({ x: (i - 2.5) / 2.5, len: s * rand(0.2, 0.28), ph: rand(0, TAU) }));
    t.draw(S, (g, v) => {
      const time = v * S, k = low(time), gone = time > GO ? clamp01((time - GO) / (S * 0.2)) : 0;
      g.ellipse(c.x, c.y + s * 0.3, s * (0.36 + 0.1 * k), s * 0.12).stroke({ width: 1.2, color: GREEN, alpha: 0.45 * k * (1 - gone) });
      // Fronds leaning in over its footing, stirring.
      for (const f of fronds) {
        const x = c.x + f.x * s * 0.4, lean = -f.x * 0.9 * k + 0.12 * Math.sin(time * 9 + f.ph);
        leaf(g, x + Math.sin(lean) * f.len * 0.5, c.y + s * 0.4 - Math.cos(lean) * f.len * 0.5, f.len, -Math.PI / 2 + lean, 0.6,
          f.x > 0 ? GREEN : LIME, 0.75 * k * (1 - gone));
      }
      // THE EYES: they open out of the dark, narrow, and glint as it locks on.
      const open = clamp01((time - S * 0.08) / (S * 0.2)), narrow = 1 - 0.55 * clamp01((time - S * 0.3) / (S * 0.15));
      const a = open * (1 - gone);
      if (a <= 0.02) return;
      for (const side of [-1, 1]) {
        const ex = c.x + side * s * 0.11, ey = c.y - s * 0.16, w = s * 0.072, h = s * 0.038 * narrow, slit = s * 0.01;
        g.circle(ex, ey, s * 0.09).fill({ color: GREEN, alpha: 0.3 * a });
        // Each eye in two halves either side of the slit pupil.
        for (const half of [-1, 1])
          g.moveTo(ex + half * slit, ey - h).quadraticCurveTo(ex + half * w * 1.1, ey - h * 0.6, ex + half * w, ey)
            .quadraticCurveTo(ex + half * w * 1.1, ey + h * 0.6, ex + half * slit, ey + h).fill({ color: EYE, alpha: 0.95 * a });
      }
      // The glint: a flare across both eyes as they fix on the prey.
      const flare = Math.sin(Math.PI * clamp01((time - S * 0.3) / (S * 0.22)));
      if (flare > 0.02) {
        g.moveTo(c.x - s * 0.32, c.y - s * 0.16).lineTo(c.x + s * 0.32, c.y - s * 0.16).stroke({ width: 1.5, color: PALE, alpha: 0.8 * flare });
        g.moveTo(c.x - s * 0.11, c.y - s * 0.25).lineTo(c.x - s * 0.11, c.y - s * 0.07).stroke({ width: 1, color: PALE, alpha: 0.7 * flare });
      }
    });
    // THE POUNCE: low and fast, gathering speed into the strike — a bright
    // head, three claw lines trailing it — landing on the landing frame.
    const dx = prey.x - c.x, dy = prey.y - c.y, dist = Math.hypot(dx, dy) || 1, nx = -dy / dist, ny = dx / dist;
    const bow = dist * 0.08 * (dx >= 0 ? -1 : 1);
    const at = (q: number) => {
      const e = Math.pow(clamp01(q), 1.6);
      return { x: c.x + dx * e + nx * bow * Math.sin(Math.PI * e), y: c.y + dy * e + ny * bow * Math.sin(Math.PI * e) };
    };
    const RUN = S - GO;
    let shed = 0;
    t.draw(RUN, (g, v, dt) => {
      const head = at(v), fade = Math.min(1, v * 6);
      const back = at(v - 0.06), ang = Math.atan2(head.y - back.y, head.x - back.x), L = s * 0.2;
      for (const o of [-1, 0, 1]) {
        const trail: number[] = [];
        for (let i = 0; i <= 8; i++) {
          const p = at(v - 0.45 + (i / 8) * 0.45);
          trail.push(p.x + nx * o * s * 0.09, p.y + ny * o * s * 0.09);
        }
        g.poly(trail.slice(0, 10), false).stroke({ width: 1.2, color: GREEN, alpha: 0.35 * fade });
        g.poly(trail.slice(8), false).stroke({ width: 2, color: LIME, alpha: 0.85 * fade });
      }
      const hx = Math.cos(ang), hy = Math.sin(ang), body: number[] = [];
      for (let i = 0; i < 12; i++) {
        const q = (i / 12) * TAU;
        body.push(head.x + hx * Math.cos(q) * L - hy * Math.sin(q) * L * 0.35, head.y + hy * Math.cos(q) * L + hx * Math.sin(q) * L * 0.35);
      }
      g.poly(body, true).fill({ color: GREEN, alpha: 0.45 * fade });
      g.circle(head.x, head.y, s * 0.06).fill({ color: PALE, alpha: 0.95 * fade });
      shed += dt * 60 * t.quality;
      for (; shed >= 1; shed--)
        t.spark(head.x, head.y, (nx * rand(-1, 1) - hx * 0.4) * rand(40, 110) * (s / 90), (ny * rand(-1, 1) - hy * 0.4) * rand(40, 110) * (s / 90),
          rand(0.3, 0.5), Math.random() < 0.5 ? MOTE : MOTE_L);
    }, { delay: GO });
    t.later(GO, () => flutter(t, { x: c.x, y: c.y + s * 0.3 }, 4, s * 0.13, 150 * (s / 90), 0.55));
  },

  land(t: FxTools, m: SigMoment) {
    const c = centre(m.from), s = m.size;
    m.targets.forEach((r, i) => {
      const p = centre(r);
      cull(t, r, Math.atan2(p.y - c.y, p.x - c.x), m.power[i] ?? 1);
      if (m.killed[i]) t.later(0.2, () => feed(t, r, m.allies, s));
    });
  },
};

/** The culling itself on the card it lands on: three jagged claw rakes torn
 *  across it — dark gashes edged in pale green, white-hot as each is made —
 *  the thorned vines across it snapping and whipping back, leaves flung, and
 *  a flick of red off the end of the swipe. Sized by what it did. */
function cull(t: FxTools, r: Box, angle: number, power: number) {
  const c = centre(r), s = Math.min(r.w, r.h), k = Math.max(0.7, Math.min(1.6, power));
  const across = angle + Math.PI / 2 + 0.55, ux = Math.cos(across), uy = Math.sin(across), nx = -uy, ny = ux;
  const reach = s * 0.47 * (0.85 + 0.15 * k), gap = s * 0.17 * Math.min(1.2, k), bow = reach * 0.16;
  const rakes = [-1, 0, 1].map((o) => {
    const len = reach * (o === 0 ? 1 : 0.86), off = o * gap;
    return rakePath({ x: c.x - ux * len + nx * off, y: c.y - uy * len + ny * off }, { x: c.x + ux * len + nx * off, y: c.y + uy * len + ny * off }, bow, s * 0.025);
  });
  const W = s * 0.09 * Math.min(1.3, k), DRAW = 0.06, LAG = 0.03, D = 0.6;
  const drawn = (time: number, i: number) => clamp01((time - i * LAG) / DRAW);
  const alpha = (time: number) => (time < 0.3 ? 1 : Math.max(0, 1 - (time - 0.3) / (D - 0.3)));
  t.draw(D, (g, v) => {
    const time = v * D, a = alpha(time);
    rakes.forEach((p, i) => {
      const f = drawn(time, i);
      if (f > 0.02) g.poly(gash(p, f, W), true).fill({ color: GASH, alpha: 0.9 * a });
    });
  }, { dark: true });
  t.draw(D, (g, v) => {
    const time = v * D, a = alpha(time);
    rakes.forEach((p, i) => {
      const f = drawn(time, i);
      if (f <= 0.02) return;
      g.poly(gash(p, f, W * 1.3), true).stroke({ width: 1.5, color: PALE, alpha: 0.95 * a });
      g.poly(gash(p, f, W * 1.9), true).stroke({ width: 2.5, color: GREEN, alpha: 0.35 * a });
      // The white-hot core of the cut, only while it is being made.
      const hot = 1 - clamp01((time - i * LAG - DRAW) / 0.1);
      if (hot > 0) g.poly(gash(p, f, W * 0.3), true).fill({ color: 0xffffff, alpha: 0.9 * hot });
    });
  });
  // THE VINES across it, thorned, snapped where the claws pass: each half
  // whips back toward where it was tied, curling as it goes.
  const vines = [-0.62, 0.62].map((o) => {
    const va = across + Math.PI / 2 + rand(-0.2, 0.2);
    return { mid: { x: c.x + ux * o * reach * 0.55, y: c.y + uy * o * reach * 0.55 }, vx: Math.cos(va), vy: Math.sin(va),
      bend: rand(-1, 1) * s * 0.06, side: Math.random() < 0.5 ? -1 : 1 };
  });
  const VD = 0.42, SNAP = DRAW * 0.6;
  t.draw(VD, (g, v) => {
    const time = v * VD, q = clamp01((time - SNAP) / 0.22), a = 1 - clamp01((time - 0.16) / (VD - 0.16));
    for (const vn of vines)
      for (const end of [-1, 1]) {
        // Whole until the snap; then each half drawn back to its end and
        // curling over, the way a cut vine goes.
        const keep = time < SNAP ? 1 : 1 - 0.7 * easeOut(q), pts: number[] = [];
        for (let i = 0; i <= 6; i++) {
          const f = (i / 6) * keep, d = s * 0.55 * (1 - f);
          const off = vn.bend * Math.sin(Math.PI * (1 - f) * 0.5) + q * f * f * s * 0.3 * vn.side * end;
          pts.push(vn.mid.x + vn.vx * d * end - vn.vy * off, vn.mid.y + vn.vy * d * end + vn.vx * off);
        }
        g.poly(pts, false).stroke({ width: 3.5, color: GREEN, alpha: 0.25 * a });
        g.poly(pts, false).stroke({ width: 1.4, color: GREEN, alpha: 0.95 * a });
        // Thorns along it, swept back.
        for (let i = 1; i < 6; i += 2) {
          const x = pts[i * 2], y = pts[i * 2 + 1], tx = pts[i * 2 + 2] - pts[i * 2 - 2], ty = pts[i * 2 + 3] - pts[i * 2 - 1];
          const l = Math.hypot(tx, ty) || 1, sd = i % 4 === 1 ? 1 : -1;
          g.moveTo(x, y).lineTo(x - (ty / l) * sd * s * 0.045 - (tx / l) * s * 0.02, y + (tx / l) * sd * s * 0.045 - (ty / l) * s * 0.02)
            .stroke({ width: 1.2, color: LIME, alpha: 0.8 * a });
        }
      }
  });
  flutter(t, c, Math.round(3 + 2 * k), s * 0.15, 220 * (s / 90), 0.6, across);
  // THE RED FLICK off the end of the swipe: a crescent and a spray of drops.
  const tipx = rakes[1].pts[rakes[1].pts.length - 2], tipy = rakes[1].pts[rakes[1].pts.length - 1];
  for (let i = 0; i < Math.round(8 * k); i++) {
    const a = across + rand(-0.4, 0.5), v = rand(140, 280) * (s / 90);
    t.later(DRAW + rand(0, 0.05), () => t.spark(tipx + rand(-3, 3), tipy + rand(-3, 3), Math.cos(a) * v, Math.sin(a) * v - 30 * (s / 90), rand(0.25, 0.45), FLICK));
  }
  t.draw(0.34, (g, v) => {
    const sweep = easeOut(clamp01(v / 0.35)), a = 1 - v * v, R = s * 0.2 * Math.min(1.3, k);
    const a0 = across + Math.PI / 2 + 0.3, a1 = a0 - 2.1 * sweep, cx = tipx - Math.cos(a0) * R, cy = tipy - Math.sin(a0) * R;
    g.moveTo(tipx, tipy).arc(cx, cy, R, a0, a1, true).stroke({ width: 5, color: RED, alpha: 0.3 * a });
    g.moveTo(tipx, tipy).arc(cx, cy, R, a0, a1, true).stroke({ width: 2.2, color: RED, alpha: 0.95 * a });
  }, { delay: DRAW });
  t.flash(c, LIME, 0.18 * k * (s / 80));
}

/** Culling the Weak: the life it took rises off the kill, then runs out as a
 *  green pulse to every ally, each lighting as it is fed. */
function feed(t: FxTools, r: Box, allies: Box[], s: number) {
  const from = centre(r);
  t.glow(r, LIME, 0.55, 0.5, 1.15);
  t.ring(r, LIME, 0.3, 1.2, 0.4, 3);
  for (let i = 0; i < Math.round(12 * t.quality); i++)
    t.spark(from.x + rand(-s * 0.3, s * 0.3), from.y + rand(-s * 0.2, s * 0.3), rand(-15, 15) * (s / 90), -rand(40, 90) * (s / 90), rand(0.5, 0.8), LIFE);
  const RUN = 0.32, D = RUN + 0.18;
  allies.forEach((a, i) => {
    const to = centre(a), dx = to.x - from.x, dy = to.y - from.y, dist = Math.hypot(dx, dy) || 1;
    const bow = dist * 0.18 * (i % 2 ? 1 : -1), mx = (from.x + to.x) / 2 - (dy / dist) * bow, my = (from.y + to.y) / 2 + (dx / dist) * bow;
    const at = (q: number) => {
      const e = smooth(clamp01(q)), w = 1 - e;
      return { x: w * w * from.x + 2 * w * e * mx + e * e * to.x, y: w * w * from.y + 2 * w * e * my + e * e * to.y };
    };
    const delay = 0.08 + i * 0.03;
    t.draw(D, (g, v) => {
      const time = v * D, q = time / RUN, a = time < RUN ? 1 : 1 - (time - RUN) / (D - RUN);
      const trail: number[] = [];
      for (let j = 0; j <= 10; j++) {
        const p = at(Math.max(0, q - 0.45) + (j / 10) * Math.min(q, 0.45));
        trail.push(p.x, p.y);
      }
      g.poly(trail, false).stroke({ width: 5, color: GREEN, alpha: 0.3 * a });
      g.poly(trail, false).stroke({ width: 2, color: LIME, alpha: 0.9 * a });
      if (time < RUN) {
        const h = at(q);
        g.circle(h.x, h.y, s * 0.1).fill({ color: GREEN, alpha: 0.5 });
        g.circle(h.x, h.y, s * 0.045).fill({ color: PALE, alpha: 1 });
      }
    }, { delay });
    t.later(delay + RUN, () => {
      t.glow(a, LIME, 0.5, 0.45, 1.1);
      t.ring(a, LIME, 0.45, 1.1, 0.35, 3);
      for (let j = 0; j < Math.round(6 * t.quality); j++)
        t.spark(to.x + rand(-s * 0.3, s * 0.3), to.y + s * 0.3, rand(-10, 10) * (s / 90), -rand(50, 100) * (s / 90), rand(0.4, 0.6), j % 2 ? MOTE : MOTE_L);
    });
  });
}
