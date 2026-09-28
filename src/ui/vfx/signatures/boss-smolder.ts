/** SMOLDER — Burning Roots. "8 DMG to every opponent within 2 spaces, setting
 *  them alight — BURN 3 for 3 rounds — and ROOTing them for 2, so they burn
 *  where they stand." The forest did not burn down. It stood up.
 *
 *  The burning ent on its art: charred bark split with ember-light, fire
 *  wheeling round it. The DELIVERY is its roots going out: the ground round
 *  it cracking with ember-light and embers lifting off it, and a charred root
 *  per card racing out under the ground to each, its seams glowing, fire
 *  licking at its growing tip — arriving as the delivery ends. The LANDING is
 *  the grip and the burning: each root bursts up round its card and COILS it,
 *  thorns driven in (the ROOT); the coils catch, fire running up them and
 *  onto the card (the BURN), embers and smoke off the top — and the roots
 *  char black and crumble as the flames die, sparks falling off them.
 *
 *  The roots are SOLID — charred bark on the normal-blend layer with a lit
 *  edge — and the ember seams are light; the fire is PYRO's own
 *  (looks/fire.ts), so the BURN it leaves reads as the same fire. */
import { centre, rand } from "../looks/base";
import { EMBER, SCORCH, pyroBody, pyroFire, pyroLick } from "../looks/fire";
import type { Graphics } from "pixi.js";
import type { FxTools, Pt, SparkStyle } from "../looks/types";
import type { Signature, SigMoment } from "./types";

type Box = SigMoment["from"];

const TAU = Math.PI * 2;
// Charred bark, real colour on the normal-blend layer.
const CHAR = 0x3e2819, CHAR_HI = 0x8a5a38, CHAR_EDGE = 0x0c0604, ASH = 0x4a4038;
// Ember-light in its seams (additive): orange going white-hot.
const SEAM = 0xff7a24, SEAM_HOT = 0xffd27a;
/** Cinders falling off a root as it chars: they drop and cool. */
const CINDER: SparkStyle = { palette: [0xffe0a0, 0xff9a3a, 0xc2461a, 0x5a2a14], gravity: 420, drag: 0.6, size: [5, 2], streak: false };

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeOut = (x: number) => 1 - (1 - x) * (1 - x);

/** A root's course from `a` to `b`: a meander of two waves, dying out at both
 *  ends so it leaves the ground and reaches its card dead on — fixed once. */
function course(a: Pt, b: Pt): number[] {
  const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
  const a1 = rand(0.07, 0.13) * L * (Math.random() < 0.5 ? -1 : 1), a2 = rand(0.02, 0.04) * L, ph = rand(0, TAU), pts: number[] = [];
  for (let i = 0; i <= 20; i++) {
    const f = i / 20, env = Math.sin(Math.PI * f), off = (a1 * Math.sin(f * Math.PI * 1.6 + ph) + a2 * Math.sin(f * Math.PI * 7 + ph)) * env;
    pts.push(a.x + dx * f + nx * off, a.y + dy * f + ny * off);
  }
  return pts;
}

/** The first `f` (0..1) of a point list, ending exactly on the way. */
function part(pts: number[], f: number): number[] {
  const n = pts.length / 2 - 1, at = Math.max(0, Math.min(n, f * n)), i = Math.floor(at), r = at - i;
  const out = pts.slice(0, (i + 1) * 2);
  if (i < n && r > 0) out.push(pts[i * 2] + (pts[i * 2 + 2] - pts[i * 2]) * r, pts[i * 2 + 1] + (pts[i * 2 + 3] - pts[i * 2 + 1]) * r);
  return out;
}

/** A band along a centreline, `w0` wide at its start narrowing to `w1` —
 *  pointed where it is still growing. */
function band(pts: number[], w0: number, w1: number): number[] {
  const n = pts.length / 2, left: number[] = [], right: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1);
    const tx = pts[b * 2] - pts[a * 2], ty = pts[b * 2 + 1] - pts[a * 2 + 1], l = Math.hypot(tx, ty) || 1;
    const f = n > 1 ? i / (n - 1) : 0, hw = ((w0 + (w1 - w0) * f) / 2) * (i === n - 1 ? 0.2 : 1);
    left.push(pts[i * 2] - (ty / l) * hw, pts[i * 2 + 1] + (tx / l) * hw);
    right.unshift(pts[i * 2] + (ty / l) * hw, pts[i * 2 + 1] - (tx / l) * hw);
  }
  return left.concat(right);
}

/** CHARRED ROOT along a centreline: the bark (normal blend) — a body, a lit
 *  back, a dark edge, going to ash grey by `ash` — or (`lit`) the ember seam
 *  down its middle, glowing by `glow`. */
function root(g: Graphics, pts: number[], w0: number, w1: number, alpha: number, lit: boolean, glow = 1, ash = 0) {
  if (pts.length < 4 || alpha <= 0.02) return;
  if (!lit) {
    const body = band(pts, w0, w1);
    g.poly(body, true).fill({ color: ash > 0.5 ? ASH : CHAR, alpha });
    g.poly(pts.map((v, j) => (j % 2 ? v - w0 * 0.18 : v)), false).stroke({ width: Math.max(1, w0 * 0.16), color: CHAR_HI, alpha: alpha * 0.8, join: "round" });
    g.poly(body, true).stroke({ width: 1.2, color: CHAR_EDGE, alpha });
    return;
  }
  g.poly(pts, false).stroke({ width: Math.max(2, w0 * 0.45), color: SEAM, alpha: 0.3 * glow * alpha, join: "round" });
  g.poly(pts, false).stroke({ width: 1.3, color: SEAM_HOT, alpha: 0.95 * glow * alpha, join: "round" });
}

export const SMOLDER: Signature = {
  shake: 1.5,
  // It stands where it stands: its roots go out.
  lunge: false,

  deliver(t: FxTools, m: SigMoment, seconds: number) {
    const c = centre(m.from), s = m.size, S = seconds;
    // THE GROUND ROUND IT splitting with ember-light, embers lifting.
    const seams = Array.from({ length: 8 }, (_, i) => {
      let a = (i / 8) * TAU + rand(-0.25, 0.25), x = c.x + Math.cos(a) * s * 0.3, y = c.y + Math.sin(a) * s * 0.3;
      const pts = [x, y];
      for (let k = 0; k < 4; k++) {
        a += rand(-0.4, 0.4);
        x += Math.cos(a) * s * 0.1;
        y += Math.sin(a) * s * 0.1;
        pts.push(x, y);
      }
      return pts;
    });
    t.draw(S, (g, v) => {
      const f = easeOut(clamp01(v / 0.5));
      for (const p of seams) g.poly(part(p, f), false).stroke({ width: s * 0.04, color: CHAR_EDGE, alpha: 0.85 });
    }, { dark: true });
    t.draw(S, (g, v) => {
      const f = easeOut(clamp01(v / 0.5));
      for (const p of seams) g.poly(part(p, f), false).stroke({ width: 1.4, color: v > 0.6 ? SEAM_HOT : SEAM, alpha: 0.9 });
    });
    t.glow(m.from, SEAM, 0.35, S, 1.2);
    let ember = 0;
    t.draw(S, (_g, _v, dt) => {
      ember += dt * 30 * t.quality;
      for (; ember >= 1; ember--) {
        const a = rand(0, TAU), r = s * rand(0.2, 0.55);
        t.spark(c.x + Math.cos(a) * r, c.y + Math.sin(a) * r, rand(-15, 15) * (s / 90), -rand(50, 120) * (s / 90), rand(0.4, 0.7), EMBER);
      }
    });
    // THE ROOTS going out under the ground, one to each card, fire licking at
    // each growing tip — whole on the landing frame.
    const runs = m.targets.map((r) => {
      const p = centre(r), d = Math.hypot(p.x - c.x, p.y - c.y) || 1;
      return course({ x: c.x + ((p.x - c.x) / d) * s * 0.4, y: c.y + ((p.y - c.y) / d) * s * 0.4 }, { x: p.x - ((p.x - c.x) / d) * s * 0.6, y: p.y - ((p.y - c.y) / d) * s * 0.6 });
    });
    laid = { key: squaresOf(c, m.targets), runs };
    const LEAVE = S * 0.2;
    const grown = (time: number) => 1 - Math.pow(1 - clamp01((time - LEAVE) / (S - LEAVE)), 1.8);
    const W = s * 0.18;
    t.draw(S, (g, v) => {
      const f = grown(v * S);
      if (f > 0.02) for (const p of runs) root(g, part(p, f), W, W * 0.35, 1, false);
    }, { dark: true });
    t.draw(S, (g, v) => {
      const time = v * S, f = grown(time);
      if (f <= 0.02) return;
      for (let i = 0; i < runs.length; i++) {
        const q = part(runs[i], f);
        root(g, q, W, W * 0.35, 1, true, 0.8);
        pyroLick(g, q[q.length - 2], q[q.length - 1] + s * 0.04, s * 0.22, s * 0.12, time, i * 7.3, 0.9);
      }
    });
  },

  land(t: FxTools, m: SigMoment) {
    const c = centre(m.from), s = m.size, W = s * 0.18, D = 1.3;
    // The roots stay run out to their cards — the same roots that ran — and
    // burn, until they char and crumble.
    const runs = laid && laid.key === squaresOf(c, m.targets) ? laid.runs : m.targets.map((r) => {
      const p = centre(r), d = Math.hypot(p.x - c.x, p.y - c.y) || 1;
      return course({ x: c.x + ((p.x - c.x) / d) * s * 0.4, y: c.y + ((p.y - c.y) / d) * s * 0.4 }, { x: p.x - ((p.x - c.x) / d) * s * 0.6, y: p.y - ((p.y - c.y) / d) * s * 0.6 });
    });
    laid = null;
    const char = (time: number) => clamp01((time - 0.7) / 0.4), gone = (time: number) => 1 - clamp01((time - 0.95) / 0.35);
    t.draw(D, (g, v) => {
      const time = v * D;
      for (const p of runs) root(g, p, W, W * 0.35, gone(time), false, 1, char(time));
    }, { dark: true });
    t.draw(D, (g, v) => {
      const time = v * D, glow = 1 - char(time);
      for (let i = 0; i < runs.length; i++) {
        const p = runs[i];
        root(g, p, W, W * 0.35, gone(time), true, glow);
        // Fire running along it, dying back as it chars.
        for (const f of [0.3, 0.55, 0.8]) {
          const j = Math.round(f * (p.length / 2 - 1));
          pyroLick(g, p[j * 2], p[j * 2 + 1] + s * 0.03, s * 0.2 * glow, s * 0.1, time, i * 5.1 + f * 9, 0.85 * glow);
        }
      }
    });
    // Cinders dropping off them as they char.
    for (const p of runs)
      for (let k = 0; k < Math.round(5 * t.quality); k++)
        t.later(rand(0.75, 1.1), () => {
          const j = Math.floor(rand(0, p.length / 2));
          t.spark(p[j * 2], p[j * 2 + 1], rand(-15, 15) * (s / 90), rand(-40, 0) * (s / 90), rand(0.35, 0.6), CINDER);
        });
    m.targets.forEach((r, i) => grip(t, r, m.power[i] ?? 1, !!m.killed[i], s, c));
  },
};

/** The roots the delivery ran out, handed to the landing so the same roots
 *  burst up (a landing played with no delivery before it lays fresh ones).
 *  Keyed to the squares they were run for: a delivery whose landing never
 *  came (the match left mid-throw) must not lend its roots to a later cast
 *  aimed somewhere else. */
let laid: { key: string; runs: number[][] } | null = null;
/** Which squares a cast ran between: the boss's and each target's. */
const squaresOf = (c: Pt, rs: Array<{ x: number; y: number; w: number; h: number }>) =>
  [c, ...rs.map(centre)].map((p) => `${Math.round(p.x)},${Math.round(p.y)}`).join(" ");

/** A card in its grip: the root that ran to it carries on round it and COILS
 *  it — a second coil from the far side — winding in and tightening, thorns
 *  driven in; then catching: fire running up the coils and onto the card,
 *  embers and smoke off the top, a scorch under it — the coils charring black
 *  as it dies down. Sized by what it did. */
function grip(t: FxTools, r: Box, power: number, killed: boolean, s: number, from: Pt) {
  const c = centre(r), k = Math.max(0.8, Math.min(1.5, power)) * (killed ? 1.15 : 1), foot = r.y + r.h * 0.88, seed = rand(0, 100);
  const a0 = Math.atan2(from.y - c.y, from.x - c.x), dir = Math.random() < 0.5 ? -1 : 1, D = 1.25, W = s * 0.15;
  /** Coil `j`: from its start round by its turns, winding in as it goes and
   *  pulled in tighter as time runs. */
  const coil = (j: number, time: number) => {
    const grow = easeOut(clamp01((time - j * 0.05) / 0.18)), turns = j ? 0.7 : 1.15, pinch = s * 0.05 * easeOut(clamp01(time / 0.3));
    const b0 = a0 + j * Math.PI, pts: number[] = [];
    for (let i = 0; i <= 16; i++) {
      const f = (i / 16) * grow, a = b0 + dir * f * turns * TAU, R = s * (0.6 - 0.16 * f) - pinch;
      pts.push(c.x + Math.cos(a) * R, c.y + Math.sin(a) * R * 0.92);
    }
    return pts;
  };
  const char = (time: number) => clamp01((time - 0.75) / 0.35), gone = (time: number) => 1 - clamp01((time - 0.95) / 0.3);
  t.draw(D, (g, v) => {
    const time = v * D;
    for (let j = 0; j < 2; j++) {
      const p = coil(j, time);
      root(g, p, W, W * 0.45, gone(time), false, 1, char(time));
      // A thorn driven in where each coil ends.
      if (time > 0.2) {
        const ex = p[p.length - 2], ey = p[p.length - 1];
        g.poly([ex + (c.x - ex) * 0.32, ey + (c.y - ey) * 0.32, ex - (c.y - ey) * 0.08, ey + (c.x - ex) * 0.08, ex + (c.y - ey) * 0.08, ey - (c.x - ex) * 0.08], true)
          .fill({ color: CHAR, alpha: gone(time) }).stroke({ width: 1, color: CHAR_EDGE, alpha: gone(time) });
      }
    }
  }, { dark: true });
  t.draw(D, (g, v) => {
    const time = v * D, glow = 1 - char(time);
    for (let j = 0; j < 2; j++) root(g, coil(j, time), W, W * 0.45, gone(time), true, glow);
  });
  // It catches: fire up the coils and onto the card.
  pyroFire(t, {
    seconds: 0.95, delay: 0.1,
    wisp: () => ({ x: r.x + r.w * rand(0.15, 0.85), y: r.y + r.h * rand(0.2, 0.55) }), wispRate: 16 * k, wispSize: s * 0.08,
    puff: (kk) => (kk > 0.3 ? { x: c.x + rand(-0.3, 0.3) * r.w, y: r.y + r.h * 0.1 } : null), smokeRate: 6, smokeSize: s * 0.16,
    body: (g, time, kk) => {
      const env = kk < 0.15 ? easeOut(kk / 0.15) : Math.pow(1 - (kk - 0.15) / 0.85, 1.2);
      pyroBody(g, r.x + r.w * 0.12, r.x + r.w * 0.88, foot, s * 0.5 * k * env, Math.min(1, env * 1.4), time, seed, 1);
      const p = coil(0, 1);
      for (const [i, f] of [0.25, 0.55, 0.85].entries()) {
        const j = Math.round(f * 16);
        pyroLick(g, p[j * 2], p[j * 2 + 1], s * 0.3 * k * env, s * 0.13, time, seed + i * 3.7, Math.min(1, env * 1.3));
      }
    },
  });
  t.draw(1.1, (g, u) => {
    g.ellipse(c.x, foot, r.w * 0.44, r.h * 0.12).fill({ color: SCORCH, alpha: 0.45 * Math.min(1, u * 6) * (1 - u) });
  }, { dark: true });
  t.flash(c, SEAM_HOT, 0.2 * k * (s / 80));
  t.glow(r, SEAM, 0.4 * Math.min(1.2, k), 0.7, 1.1);
  for (let i = 0; i < Math.round(8 * k); i++) {
    const a = rand(0, TAU);
    t.spark(c.x + Math.cos(a) * s * 0.5, c.y + Math.sin(a) * s * 0.45, rand(-20, 20) * (s / 90), -rand(60, 140) * (s / 90), rand(0.4, 0.7), EMBER);
  }
}
