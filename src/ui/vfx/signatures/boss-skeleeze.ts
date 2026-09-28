/** SKELEEZE RANGER — Piercing Arrow. "10 DMG to every opponent in the column
 *  directly ahead — a guaranteed CRIT that pierces shields." One slot to the
 *  right, every round, forever. You have been told.
 *
 *  The Ranger on its art draws a great spiked bow of bone in the eye of a
 *  storm. The DELIVERY is that draw: the bow across its card, the string
 *  hauled back to its skull with an arrow nocked on it, violet ghost-light
 *  gathering on the barbed head and wind wheeling round the archer — the
 *  string trembling at full draw as the landing comes. The LANDING is one
 *  arrow. The string snaps home and the arrow goes down the whole column and
 *  off the board — the air snapping off its line in rings as it passes —
 *  straight through every card in it: at each, a punch of violet light, bone
 *  splinters thrown on after it and a hard star of a critical hit — shields
 *  are no part of it. Behind it hangs its wake, a spectral trail the length of
 *  the column with the storm's wind twisting round it, slow to fade: the lane
 *  it owns this round.
 *
 *  Bone is drawn in bone and the ghost-light in violet, never the reverse:
 *  what is real about the Ranger is its bow, and what it shoots is not. */
import { centre, rand } from "../looks/base";
import type { Graphics } from "pixi.js";
import type { FxTools, Pt, SparkStyle } from "../looks/types";
import type { Signature, SigMoment } from "./types";

const TAU = Math.PI * 2;
const BONE = 0xece2c8, GHOST = 0xf4eeff, LILAC = 0xd9c2ff, VIOLET = 0x9a6ad8;
/** The storm round the archer, as on its art: a pale blue-white wind. */
const WIND = 0xdde8ff;
/** Ghost-light drawn in to the arrowhead, spiralling. */
const MOTE: SparkStyle = { palette: [GHOST, LILAC, VIOLET], gravity: 0, drag: 1, size: [6, 2], streak: true, swirl: 260 };
/** Bone splintered off a card the arrow goes through, thrown on after it. */
const SPLINTER: SparkStyle = { palette: [0xffffff, BONE, 0xb8ab90], gravity: 380, drag: 0.35, size: [6, 1.5], streak: true };
/** What the wake sheds: ghost-light, drifting and going out. */
const WAKE: SparkStyle = { palette: [GHOST, LILAC, VIOLET], gravity: -20, drag: 0.5, size: [5, 2], streak: false, swirl: 60 };

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeOut = (x: number) => 1 - (1 - x) * (1 - x);
/** 0 -> 1 as `x` runs from `a` to `b`. */
const span = (x: number, a: number, b: number) => clamp01((x - a) / (b - a));

/** A glow sized to the board's squares (`flash` is sized in px). */
function flare(t: FxTools, p: Pt, size: number, color: number, peak: number, seconds: number) {
  t.glow({ x: p.x - size / 2, y: p.y - size / 2, w: size, h: size }, color, peak, seconds, 1);
}

/** Which way is which for an archer at `c` shooting along `a` (unit): the
 *  grip of its bow, and the axis across. */
interface Aim { c: Pt; ax: number; ay: number; cx: number; cy: number; s: number }
const P = (o: Aim, along: number, across: number): Pt => ({
  x: o.c.x + (o.ax * along + o.cx * across) * o.s, y: o.c.y + (o.ay * along + o.cy * across) * o.s,
});

/** THE BOW, `draw` 0..1 of the way to full draw: bone limbs curving back from
 *  the grip, spiked along their length, the string hauled back to the nock.
 *  `snap` > 0 is the string after the release, still shivering. The nock's
 *  position is returned — the arrow sits on it. */
function bow(g: Graphics, o: Aim, draw: number, alpha: number, snap = 0): Pt {
  const grip = 0.12, bend = 0.12 + 0.2 * draw, half = 0.66 - 0.07 * draw;
  const limb: Pt[] = [];
  for (let i = 0; i <= 16; i++) {
    const q = i / 16 * 2 - 1;
    limb.push(P(o, grip - bend * q * q, half * q));
  }
  const tipL = limb[0], tipR = limb[16];
  const nockAlong = grip - bend - 0.28 * draw;
  const shiver = snap > 0 ? Math.sin(snap * 60) * 0.06 * (1 - snap) : 0;
  const nock = P(o, nockAlong + (snap > 0 ? bend + 0.28 * draw : 0), shiver);
  // The ghost-light it is strung with, then the bone.
  const trace = () => { g.moveTo(limb[0].x, limb[0].y); for (const p of limb) g.lineTo(p.x, p.y); };
  trace();
  g.stroke({ width: 9, color: VIOLET, alpha: 0.25 * alpha, cap: "round", join: "round" });
  trace();
  g.stroke({ width: 3.8, color: BONE, alpha: 0.95 * alpha, cap: "round", join: "round" });
  // Spikes along its back — the side facing the target — as on its art.
  for (let i = 2; i <= 14; i += 3) {
    const p = limb[i], n = limb[i + 1], dx = n.x - p.x, dy = n.y - p.y, l = Math.hypot(dx, dy) || 1;
    const tx = dx / l, ty = dy / l, side = -ty * o.ax + tx * o.ay > 0 ? 1 : -1, ox = -ty * side, oy = tx * side;
    g.moveTo(p.x - tx * 2.5, p.y - ty * 2.5).lineTo(p.x + ox * o.s * 0.07, p.y + oy * o.s * 0.07)
      .lineTo(p.x + tx * 2.5, p.y + ty * 2.5).stroke({ width: 1.4, color: BONE, alpha: 0.85 * alpha });
  }
  g.moveTo(tipL.x, tipL.y).lineTo(nock.x, nock.y).lineTo(tipR.x, tipR.y).stroke({ width: 1.2, color: GHOST, alpha: 0.9 * alpha });
  return nock;
}

/** THE ARROW, its head at `h` along the aim: a bone shaft with fletching, and
 *  a barbed head burning with ghost-light (`glow`). */
function arrow(g: Graphics, o: Aim, h: Pt, len: number, glow: number, alpha: number) {
  const tx = h.x - o.ax * len, ty = h.y - o.ay * len, w = o.s * 0.07;
  if (glow > 0.01) g.circle(h.x, h.y, o.s * 0.16 * (0.6 + 0.4 * glow)).fill({ color: VIOLET, alpha: 0.35 * glow * alpha });
  g.moveTo(tx, ty).lineTo(h.x - o.ax * w * 1.4, h.y - o.ay * w * 1.4).stroke({ width: 2.4, color: BONE, alpha: 0.95 * alpha });
  // The barbed head.
  g.poly([h.x + o.ax * w * 0.8, h.y + o.ay * w * 0.8,
    h.x - o.ax * w * 1.6 + o.cx * w, h.y - o.ay * w * 1.6 + o.cy * w,
    h.x - o.ax * w * 1.1, h.y - o.ay * w * 1.1,
    h.x - o.ax * w * 1.6 - o.cx * w, h.y - o.ay * w * 1.6 - o.cy * w], true)
    .fill({ color: GHOST, alpha: 0.95 * alpha }).stroke({ width: 1.2, color: LILAC, alpha: alpha });
  // Fletching.
  for (const sd of [-1, 1])
    g.moveTo(tx + o.ax * w * 1.4, ty + o.ay * w * 1.4).lineTo(tx - o.ax * w * 0.4 + o.cx * sd * w * 0.9, ty - o.ay * w * 0.4 + o.cy * sd * w * 0.9)
      .stroke({ width: 1.6, color: LILAC, alpha: 0.85 * alpha });
}

/** A critical hit's star: four hard points, flung open and gone. */
function star(t: FxTools, c: Pt, size: number, delay: number) {
  const rot = rand(0, Math.PI / 4);
  t.draw(0.3, (g, u) => {
    const k = easeOut(span(u, 0, 0.25)) * (1 - span(u, 0.35, 1)), r = size * (0.5 + 0.5 * easeOut(u));
    if (k <= 0.01) return;
    for (let i = 0; i < 4; i++) {
      const a = rot + (i * Math.PI) / 2, ux = Math.cos(a), uy = Math.sin(a), px = -uy * r * 0.09, py = ux * r * 0.09;
      g.poly([c.x + px, c.y + py, c.x + ux * r, c.y + uy * r, c.x - px, c.y - py], true).fill({ color: GHOST, alpha: 0.95 * k });
    }
    g.circle(c.x, c.y, r * 0.16).fill({ color: 0xffffff, alpha: k });
  }, { delay });
}

/** Where the column ahead of `c` runs off the board, px along the aim. */
function runOff(m: SigMoment, c: Pt): number {
  const b = m.board, ax = m.ahead.x, ay = m.ahead.y;
  let d = Infinity;
  if (ay > 1e-3) d = Math.min(d, (b.y + b.h - c.y) / ay);
  if (ay < -1e-3) d = Math.min(d, (b.y - c.y) / ay);
  if (ax > 1e-3) d = Math.min(d, (b.x + b.w - c.x) / ax);
  if (ax < -1e-3) d = Math.min(d, (b.x - c.x) / ax);
  return Number.isFinite(d) ? d : m.size * 4;
}

export const SKELEEZE: Signature = {
  shake: 1.5,
  // It is Ranged: the arrow does the travelling.
  lunge: false,

  deliver(t: FxTools, m: SigMoment, seconds: number) {
    const s = m.size, c = centre(m.from), T = seconds;
    const o: Aim = { c, ax: m.ahead.x, ay: m.ahead.y, cx: -m.ahead.y, cy: m.ahead.x, s };
    // THE DRAW: the string hauled back to full draw, then held there,
    // trembling — the arrow riding back with it, its head gathering light.
    const drawAt = (u: number) => easeOut(span(u, 0.05, 0.8));
    t.draw(T, (g, u) => {
      const a = Math.min(1, u * 6), held = u > 0.8 ? Math.sin(u * T * 90) * 0.012 : 0;
      const nock = bow(g, o, drawAt(u), a);
      const len = s * 0.95, head = { x: nock.x + o.ax * len + o.cx * held * s, y: nock.y + o.ay * len + o.cy * held * s };
      arrow(g, o, head, len, span(u, 0.2, 1), a);
    });
    const tip = (u: number) => {
      const d = drawAt(u), along = 0.12 - (0.12 + 0.2 * d) - 0.28 * d + 0.95;
      return P(o, along, 0);
    };
    t.charge(tip(1), s * 0.9, LILAC, 0.6, T);
    let acc = 0;
    t.draw(T, (_g, u, dt) => {
      acc += 50 * dt;
      for (; acc >= 1; acc--) {
        const h = tip(Math.min(1, u + 0.1)), a = rand(0, TAU), r = s * rand(0.35, 0.6), life = rand(0.18, 0.3);
        const ca = Math.cos(a), sa = Math.sin(a), sp = r / life;
        t.spark(h.x + ca * r, h.y + sa * r, (-ca - sa * 0.4) * sp, (-sa + ca * 0.4) * sp, life, MOTE, h);
      }
    });
    // The storm wheeling round the archer: wisps of wind, turning faster.
    t.draw(T, (g, u) => {
      const a = Math.min(1, u * 3);
      for (let i = 0; i < 3; i++) {
        const r = s * (0.62 + 0.1 * i), a0 = u * (4 + i) + (i * TAU) / 3;
        g.moveTo(c.x + Math.cos(a0) * r, c.y + Math.sin(a0) * r).arc(c.x, c.y, r, a0, a0 + 1.4)
          .stroke({ width: 2 - i * 0.4, color: WIND, alpha: 0.45 * a });
      }
    });
  },

  land(t: FxTools, m: SigMoment) {
    const s = m.size, c = centre(m.from), v = s / 90, seed = rand(0, 100);
    const o: Aim = { c, ax: m.ahead.x, ay: m.ahead.y, cx: -m.ahead.y, cy: m.ahead.x, s };
    // THE RELEASE: the string snaps home and shivers, and the bow is let go.
    t.draw(0.4, (g, u) => { bow(g, o, 1 - easeOut(span(u, 0, 0.12)), 1 - span(u, 0.3, 1), Math.max(0.01, u)); });
    flare(t, P(o, 0.3, 0), s * 1.1, LILAC, 0.5, 0.22);

    // THE ARROW: from the bow down the whole column and off the board — from
    // just ahead of the archer to as far past the board's edge — and never
    // short of the farthest card it goes through.
    const start = P(o, 0.4, 0), FLY = 0.3;
    const along = (p: Pt) => (p.x - start.x) * o.ax + (p.y - start.y) * o.ay;
    const L = Math.max(runOff(m, c), ...m.targets.map((r) => along(centre(r)) + s * 0.6));
    const headAt = (time: number): Pt => { const f = Math.min(1, time / FLY) * L; return { x: start.x + o.ax * f, y: start.y + o.ay * f }; };
    const D = 1.15;
    let shed = 0;
    t.draw(D, (g, u, dt) => {
      const time = u * D, reach = Math.min(1, time / FLY) * L, h = headAt(time);
      // Its wake: the lane lit behind it, and the storm's wind twisting round
      // it — slow to go.
      const wf = 1 - span(time, FLY + 0.15, D);
      if (reach > 1 && wf > 0) {
        const ex = start.x + o.ax * reach, ey = start.y + o.ay * reach;
        g.moveTo(start.x, start.y).lineTo(ex, ey).stroke({ width: s * 0.42 * (1 - 0.4 * span(time, FLY, D)), color: VIOLET, alpha: 0.22 * wf });
        g.moveTo(start.x, start.y).lineTo(ex, ey).stroke({ width: s * 0.12, color: LILAC, alpha: 0.5 * wf });
        g.moveTo(start.x, start.y).lineTo(ex, ey).stroke({ width: 2, color: GHOST, alpha: 0.85 * wf });
        for (let k = 0; k < 2; k++) {
          const pts: number[] = [];
          for (let i = 0; i <= 30; i++) {
            const f = (i / 30) * reach, off = Math.sin(f / (s * 0.28) + time * 14 + k * Math.PI + seed) * s * 0.13 * Math.min(1, f / (s * 0.5));
            pts.push(start.x + o.ax * f + o.cx * off, start.y + o.ay * f + o.cy * off);
          }
          g.moveTo(pts[0], pts[1]);
          for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
          g.stroke({ width: 1.4, color: WIND, alpha: 0.55 * wf, cap: "round", join: "round" });
        }
      }
      if (time < FLY) {
        arrow(g, o, h, s * 0.95, 1, 1);
        shed += 120 * dt;
        for (; shed >= 1; shed--) {
          const f = rand(0, reach);
          t.spark(start.x + o.ax * f + o.cx * rand(-0.1, 0.1) * s, start.y + o.ay * f + o.cy * rand(-0.1, 0.1) * s,
            o.cx * rand(-30, 30) * v, o.cy * rand(-30, 30) * v - rand(10, 30) * v, rand(0.35, 0.6), WAKE);
        }
      }
    });

    // The air it goes through, snapping: flat rings thrown off its line as it
    // passes, one after another down the column — and the wind the release
    // threw back off the bow.
    const RINGS = Math.max(3, Math.round(L / (s * 0.9)));
    for (let k = 0; k < RINGS; k++) {
      const f = ((k + 0.5) / RINGS) * L, at = FLY * (f / L), p = { x: start.x + o.ax * f, y: start.y + o.ay * f };
      t.draw(0.34, (g, u) => {
        const r = s * (0.12 + 0.3 * easeOut(u)), a = 1 - u, n = 18, pts: number[] = [];
        for (let i = 0; i <= n; i++) {
          const th = (i / n) * TAU, x = Math.cos(th) * r * 0.32, y = Math.sin(th) * r;
          pts.push(p.x + o.ax * x + o.cx * y, p.y + o.ay * x + o.cy * y);
        }
        g.poly(pts, true).stroke({ width: 2.2 * a + 0.5, color: WIND, alpha: 0.7 * a });
      }, { delay: at });
    }
    for (let i = 0; i < 12; i++) {
      const a = Math.atan2(-o.ay, -o.ax) + rand(-0.7, 0.7), sp = rand(120, 260) * v, b = P(o, -0.1, rand(-0.5, 0.5));
      t.spark(b.x, b.y, Math.cos(a) * sp, Math.sin(a) * sp, rand(0.2, 0.4), WAKE);
    }

    // THROUGH EVERY CARD IN IT: a punch of violet light, bone splinters thrown
    // on after the arrow, and the hard star of a critical hit.
    m.targets.forEach((r, i) => {
      const p = centre(r), when = FLY * clamp01(along(p) / L), k = Math.max(0.8, Math.min(1.5, m.power[i] ?? 1));
      t.later(when, () => {
        flare(t, p, s * 1.2 * k, LILAC, 0.6, 0.25);
        t.ring(r, VIOLET, 0.2, 0.9, 0.3, 3);
        for (let j = 0; j < Math.round(12 * k + (m.killed[i] ? 8 : 0)); j++) {
          const a = Math.atan2(o.ay, o.ax) + rand(-0.9, 0.9), sp = rand(150, 320) * v;
          t.spark(p.x, p.y, Math.cos(a) * sp, Math.sin(a) * sp, rand(0.25, 0.45), SPLINTER);
        }
      });
      star(t, p, s * 0.62 * k, when + 0.02);
    });
  },
};
