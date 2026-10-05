/** VESPER — Moon Frenzy. "Attack all opponents for 3 DMG, DRAIN from each,
 *  and SEAL them (they cannot be healed)." Vesper's Moon Frenzy bites every
 *  opponent and seals their healing.
 *
 *  The art is a vampire in a red-lined cloak hanging in the air on huge RED
 *  bat wings, a blood moon behind him, crimson threads of blood streaming from
 *  his hands down into the crowd. So the DELIVERY is him rising to feed: the
 *  BLOOD MOON swells up behind his card, the bat wings unfold over it (black
 *  membrane, red-rimmed, the finger bones lit), and a swarm of small bats
 *  boils off the wings and wheels round him.
 *
 *  The LANDING is the frenzy. The swarm pours out to EVERY opponent at once,
 *  each knot of bats on its own curving flight, and they BITE: two red
 *  punctures on the card, blood running from them, drops flung. From every
 *  bite a crimson thread of blood is drawn back to Vesper, writhing as it is
 *  pulled in, beads of blood running along it (the DRAIN), and each one
 *  lands on him as a red pulse. Last, a blood-red ring CLAMPS shut round each
 *  card with a crescent moon flaring in it: the SEAL, no healing past it.
 *
 *  Blood red and black, never DUSK's violet: this is the one DUSK card that
 *  feeds on blood rather than shadow. The wings, the bats and the punctures
 *  are dark for real (`dark: true`), each with a red rim, so they read over
 *  an empty square; the moon's disc sits on the dark layer too, so the wings
 *  cover it the way they do in the picture. The wings and moon are drawn
 *  upright on the screen whichever way the board faces, the way his art
 *  stands — the bats themselves fly the real paths to the real targets. */
import { centre, rand } from "../../looks/base";
import type { Graphics } from "pixi.js";
import type { FxTools, Pt, SparkStyle } from "../../looks/types";
import type { Signature, SigMoment } from "../types";

type Box = SigMoment["from"];

const TAU = Math.PI * 2;
/** Blood, lit: white-pink at its brightest, through crimson to a deep red. */
const PINK = 0xffd3d8, ROSE = 0xff7686, CRIMSON = 0xff2a44, BLOOD = 0xd0102c;
/** The blood moon: a deep red disc (dark layer, normal blend) with a hot
 *  orange-red halo. */
const MOON = 0xa8142a, MOON_IN = 0xd23a3a, MOON_HI = 0xff8a6a;
/** Wing membrane and bat bodies: a blood-black. Dark layer only. */
const INK = 0x160409;
/** Blood flung off a bite: bright, falling, darkening. */
const DROP: SparkStyle = { palette: [PINK, CRIMSON, BLOOD, 0xa00c22], gravity: 620, drag: 0.6, size: [4.5, 1.5], streak: false };
/** Blood drawn in to him: streaked toward him and turned as it comes. */
const SIP = [PINK, ROSE, CRIMSON];

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeOut = (x: number) => 1 - (1 - x) * (1 - x);
const easeIn = (x: number) => x * x;
/** 0 -> 1 as `u` runs from `a` to `b`. */
const span = (u: number, a: number, b: number) => clamp01((u - a) / (b - a));
/** Overshoots and settles: a ring snapping shut. */
const snap = (x: number) => (x >= 1 ? 1 : 1 + 2.7 * Math.pow(x - 1, 3) + 1.7 * Math.pow(x - 1, 2));

/** A glow sized to the board's squares (`flash` is sized in px). */
function flare(t: FxTools, p: Pt, size: number, color: number, peak: number, seconds: number) {
  t.glow({ x: p.x - size / 2, y: p.y - size / 2, w: size, h: size }, color, peak, seconds, 1);
}

// ── Bats ────────────────────────────────────────────────────────────────────

/** A bat's right half, nose to tail, as (across, along) in units of its span:
 *  the head and a pointed ear, the shoulder, then the wing's leading edge out
 *  to the tip and its scalloped trailing edge back between the finger bones.
 *  The wing x's are scaled by the beat; `lift` sweeps the tips. */
function batHalf(sp: number, lift: number): number[][] {
  return [[0, 0.17], [0.035, 0.24], [0.05, 0.11], [0.075, 0.07], [0.5 * sp, 0.13 + lift], [0.4 * sp, -0.06 + lift * 0.7],
    [0.33 * sp, 0.01 + lift * 0.5], [0.25 * sp, -0.12 + lift * 0.4], [0.17 * sp, -0.02 + lift * 0.2], [0.08, -0.13], [0, -0.1]];
}

/** A bat in flight as one silhouette: flat points round its body and both
 *  wings, centred on (x, y), `k` px from wingtip to wingtip at full span,
 *  flying along `ang`. `ph` is the wingbeat: the wings close and sweep. */
function batPts(x: number, y: number, k: number, ang: number, ph: number): number[] {
  const fx = Math.cos(ang), fy = Math.sin(ang), nx = -fy, ny = fx;
  const half = batHalf(0.55 + 0.45 * Math.abs(Math.cos(ph)), 0.12 * Math.sin(ph)), out: number[] = [];
  for (const [a, b] of half) out.push(x + (nx * a + fx * b) * k, y + (ny * a + fy * b) * k);
  for (let i = half.length - 2; i >= 1; i--) {
    const [a, b] = half[i];
    out.push(x + (-nx * a + fx * b) * k, y + (-ny * a + fy * b) * k);
  }
  return out;
}

/** Where a bat is and how it is drawn this frame: its silhouette, its eye
 *  and how solid it is. */
interface BatPose { pts: number[]; eye: Pt; a: number }

function pose(x: number, y: number, k: number, ang: number, ph: number, a: number): BatPose {
  return { pts: batPts(x, y, k, ang, ph), eye: { x: x + Math.cos(ang) * k * 0.14, y: y + Math.sin(ang) * k * 0.14 }, a };
}

/** A flight of bats: the dark silhouettes on the dark layer, and their red
 *  rims and eyes on the light, so they read over an empty square. */
function drawBats(t: FxTools, D: number, poses: (time: number) => BatPose[], delay = 0) {
  t.draw(D, (g, u) => {
    for (const b of poses(u * D)) if (b.a > 0.01) g.poly(b.pts, true).fill({ color: INK, alpha: 0.92 * b.a });
  }, { dark: true, delay });
  t.draw(D, (g, u) => {
    for (const b of poses(u * D)) {
      if (b.a <= 0.01) continue;
      g.poly(b.pts, true).fill({ color: BLOOD, alpha: 0.28 * b.a }).stroke({ width: 1.4, color: CRIMSON, alpha: 0.95 * b.a, join: "round" });
      g.circle(b.eye.x, b.eye.y, 1.6).fill({ color: PINK, alpha: b.a });
    }
  }, { delay });
}

// ── His wings and the moon ──────────────────────────────────────────────────

/** His right wing at full spread, screen space, in units of the square from
 *  his card's centre: shoulder, the wrist high up, the tip, then the
 *  scalloped trailing edge back down between three fingers to his side. */
const WING: number[][] = [[0.06, -0.08], [0.42, -0.5], [0.88, -0.36], [0.72, -0.24], [0.7, -0.03], [0.56, -0.1],
  [0.5, 0.1], [0.38, 0.0], [0.3, 0.15], [0.18, 0.04], [0.08, 0.1]];
/** The finger bones run from the wrist to these points of WING. */
const BONES = [2, 4, 6, 8];

/** A wing as flat points: side `sx` (+-1), opened `sp` (0..1) out from the
 *  shoulder. */
function wingPts(c: Pt, s: number, sx: number, sp: number): number[] {
  const out: number[] = [], [ox, oy] = WING[0];
  for (const [x, y] of WING) out.push(c.x + sx * (ox + (x - ox) * sp * 1.2) * s, c.y + (oy + (y - oy) * sp * 1.2) * s);
  return out;
}

/** The moon hangs over his card's top edge, a little to one side, as on his
 *  art. */
const moonAt = (c: Pt, s: number): Pt => ({ x: c.x + s * 0.16, y: c.y - s * 0.52 });

/** The wings and the blood moon behind them, opened `sp` and solid `a`; the
 *  moon `mr` across (px). The dark half: the moon's disc first, then the
 *  wings over it. */
function wingsDark(g: Graphics, c: Pt, s: number, sp: number, a: number, mr: number) {
  if (a <= 0.01) return;
  const M = moonAt(c, s);
  if (mr > 1) {
    g.circle(M.x, M.y, mr).fill({ color: MOON, alpha: 0.72 * a });
    g.circle(M.x - mr * 0.12, M.y - mr * 0.1, mr * 0.7).fill({ color: MOON_IN, alpha: 0.35 * a });
  }
  for (const sx of [-1, 1]) g.poly(wingPts(c, s, sx, sp), true).fill({ color: INK, alpha: 0.7 * a });
}

/** ...and lit: the moon's halo, the wings' red rims and finger bones. */
function wingsLit(g: Graphics, c: Pt, s: number, sp: number, a: number, mr: number) {
  if (a <= 0.01) return;
  const M = moonAt(c, s);
  if (mr > 1) {
    g.circle(M.x, M.y, mr * 1.25).stroke({ width: mr * 0.4, color: CRIMSON, alpha: 0.12 * a });
    g.circle(M.x, M.y, mr).stroke({ width: 1.6, color: MOON_HI, alpha: 0.8 * a });
  }
  for (const sx of [-1, 1]) {
    const w = wingPts(c, s, sx, sp);
    g.poly(w, true).fill({ color: BLOOD, alpha: 0.22 * a }).stroke({ width: 2, color: CRIMSON, alpha: 0.9 * a, join: "round" });
    for (const i of BONES) g.moveTo(w[2], w[3]).lineTo(w[i * 2], w[i * 2 + 1]);
    g.moveTo(w[0], w[1]).lineTo(w[2], w[3]);
    g.stroke({ width: 1.2, color: ROSE, alpha: 0.75 * a, cap: "round" });
  }
}

// ── The bite, the drain and the seal ───────────────────────────────────────

/** A crescent moon, flat points: `r` across, its horns turned toward `rot`. */
function crescent(cx: number, cy: number, r: number, rot: number): number[] {
  const out: number[] = [], d = 0.45 * r, e = Math.SQRT1_2 * r;
  const ri = Math.hypot(e - d, e), a0 = Math.atan2(e, e - d);
  const put = (x: number, y: number) => out.push(cx + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot));
  for (let i = 0; i <= 12; i++) {
    const a = Math.PI / 4 + (i / 12) * (Math.PI * 1.5);
    put(Math.cos(a) * r, Math.sin(a) * r);
  }
  for (let i = 0; i <= 12; i++) {
    const a = -a0 - (i / 12) * (TAU - 2 * a0);
    put(d + Math.cos(a) * ri, Math.sin(a) * ri);
  }
  return out;
}

/** THE BITE on a card: two punctures (dark, rimmed red) with blood running
 *  down from each, a red flash and drops flung away from where the bats came
 *  from. A kill bleeds out harder. */
function bite(t: FxTools, r: Box, s: number, k: number, killed: boolean, from: Pt) {
  const p = centre(r), v = s / 90, away = Math.atan2(p.y - from.y, p.x - from.x);
  const holes = [-1, 1].map((sx) => ({ x: p.x + sx * s * 0.1, y: p.y - s * 0.08 }));
  flare(t, p, s * 1.1, CRIMSON, 0.45 * k, 0.28);
  t.flash(p, ROSE, 0.22 * k * (s / 80));
  const n = Math.round((killed ? 16 : 8) * k);
  for (let i = 0; i < n; i++) {
    const h = holes[i % 2], a = away + rand(-1.3, 1.3), sp = rand(80, 200) * v;
    t.spark(h.x, h.y, Math.cos(a) * sp, Math.sin(a) * sp - rand(40, 120) * v, rand(0.35, 0.6), DROP);
  }
  const D = 0.85, rad = s * 0.05 * (0.8 + 0.3 * k);
  const run = (u: number) => s * (killed ? 0.3 : 0.18) * easeOut(span(u, 0.08, 0.7));
  t.draw(D, (g, u) => {
    const a = 1 - span(u, 0.6, 1);
    for (const h of holes) g.circle(h.x, h.y, rad * (0.5 + 0.5 * easeOut(span(u, 0, 0.1)))).fill({ color: INK, alpha: 0.85 * a });
  }, { dark: true });
  t.draw(D, (g, u) => {
    const a = 1 - span(u, 0.6, 1);
    for (const h of holes) {
      g.circle(h.x, h.y, rad * 1.25).stroke({ width: 1.6, color: CRIMSON, alpha: 0.95 * a });
      // The blood running from it, a drop swelling at its end.
      const L = run(u);
      if (L > 1) {
        g.moveTo(h.x, h.y + rad).lineTo(h.x, h.y + rad + L).stroke({ width: rad * 0.9, color: BLOOD, alpha: 0.9 * a, cap: "round" });
        g.circle(h.x, h.y + rad + L, rad * 0.65).fill({ color: CRIMSON, alpha: 0.95 * a });
      }
    }
  });
}

/** THE DRAIN: a crimson thread pulled from the bite back to Vesper — it
 *  shoots out of the card toward him, writhing, beads of blood running along
 *  it, then the card's end lets go and the whole thread is reeled in. Starts
 *  `delay` after the landing; returns when its blood reaches him. */
function thread(t: FxTools, p: Pt, c: Pt, s: number, k: number, delay: number): number {
  const dx = c.x - p.x, dy = c.y - p.y, d = Math.hypot(dx, dy) || 1, nx = -dy / d, ny = dx / d;
  const GROW = 0.22, HOLD = 0.14, REEL = 0.2, D = GROW + HOLD + REEL;
  const phase = rand(0, TAU), waves = 1.5 + d / (s * 2.2), amp = s * (0.12 + 0.05 * Math.min(2, d / (s * 2)));
  const at = (q: number, time: number): Pt => {
    // Pinned at both ends, writhing between, the ripples running toward him.
    const w = amp * Math.sin(Math.PI * q) * Math.sin(q * Math.PI * waves + phase + time * 14) * (1 - 0.5 * span(time, GROW, D));
    return { x: p.x + dx * q + nx * w, y: p.y + dy * q + ny * w };
  };
  t.draw(D, (g, u) => {
    const time = u * D, q1 = easeIn(span(time, 0, GROW)), q0 = easeIn(span(time, GROW + HOLD, D));
    if (q1 - q0 < 0.01) return;
    const pts: number[] = [];
    for (let i = 0; i <= 24; i++) {
      const pt = at(q0 + ((q1 - q0) * i) / 24, time);
      pts.push(pt.x, pt.y);
    }
    const a = 1 - 0.3 * span(time, GROW + HOLD, D);
    g.poly(pts, false).stroke({ width: 6 * k, color: BLOOD, alpha: 0.3 * a, join: "round", cap: "round" });
    g.poly(pts, false).stroke({ width: 2.2 * k, color: CRIMSON, alpha: 0.95 * a, join: "round", cap: "round" });
    g.poly(pts, false).stroke({ width: 0.9, color: PINK, alpha: 0.7 * a, join: "round" });
    // Beads of blood running up it to him.
    for (let b = 0; b < 3; b++) {
      const q = q0 + (q1 - q0) * ((time * 2.6 + b / 3) % 1), pt = at(q, time);
      g.circle(pt.x, pt.y, 2.6 * k).fill({ color: PINK, alpha: 0.9 * a });
    }
    // The tip racing ahead of the blood toward him.
    if (q1 < 1) {
      const tip = at(q1, time);
      g.circle(tip.x, tip.y, 3.4 * k).fill({ color: PINK, alpha: 1 });
    }
  }, { delay });
  return delay + GROW;
}

/** THE SEAL: a blood-red ring that closes on the card and clamps shut,
 *  four teeth biting in, and a crescent moon flaring in its middle — no
 *  healing past it. Dark band, red rim. */
function seal(t: FxTools, r: Box, s: number, k: number, delay: number) {
  const p = centre(r), rot = rand(-0.6, -0.2), D = 0.5;
  const R = (u: number) => s * (0.82 - 0.27 * snap(span(u, 0, 0.26)));
  const fade = (u: number) => clamp01(u / 0.08) * (1 - span(u, 0.62, 1));
  t.draw(D, (g, u) => {
    const a = fade(u);
    g.circle(p.x, p.y, R(u)).stroke({ width: s * 0.07, color: INK, alpha: 0.6 * a });
    const cr = 1 - span(u, 0.3, 0.85);
    if (cr > 0.01) g.poly(crescent(p.x, p.y, s * 0.16, rot), true).fill({ color: INK, alpha: 0.5 * a * cr });
  }, { dark: true, delay });
  t.draw(D, (g, u) => {
    const a = fade(u), rr = R(u);
    g.circle(p.x, p.y, rr + s * 0.04).stroke({ width: 6, color: BLOOD, alpha: 0.25 * a });
    g.circle(p.x, p.y, rr).stroke({ width: 2.2 * k, color: CRIMSON, alpha: 0.95 * a });
    // The teeth: four short bars biting in toward the card.
    for (let i = 0; i < 4; i++) {
      const q = Math.PI / 4 + (i * Math.PI) / 2;
      g.moveTo(p.x + Math.cos(q) * (rr + s * 0.04), p.y + Math.sin(q) * (rr + s * 0.04))
        .lineTo(p.x + Math.cos(q) * (rr - s * 0.09), p.y + Math.sin(q) * (rr - s * 0.09));
    }
    g.stroke({ width: 2.4, color: ROSE, alpha: 0.95 * a, cap: "round" });
    const cr = (1 - span(u, 0.3, 0.85)) * clamp01((u - 0.12) / 0.1);
    if (cr > 0.01)
      g.poly(crescent(p.x, p.y, s * 0.16, rot), true).fill({ color: CRIMSON, alpha: 0.4 * a * cr })
        .stroke({ width: 1.6, color: PINK, alpha: 0.9 * a * cr, join: "round" });
  }, { delay });
  t.later(delay + 0.07, () => t.ring(r, CRIMSON, 0.95, 0.6, 0.18, 2));
}

export const VESPER: Signature = {
  shake: 0.7,
  // He feeds from where he hangs; the swarm does the travelling.
  lunge: false,

  deliver(t: FxTools, m: SigMoment, seconds: number) {
    const T = seconds, c = centre(m.from), s = m.size;
    // The moon swells, the wings unfold over it.
    const open = (time: number) => 0.18 + 0.82 * easeOut(span(time, 0, T * 0.65));
    const mr = (time: number) => s * 0.3 * easeOut(span(time, 0, T * 0.55));
    const fadeIn = (time: number) => clamp01(time / 0.08);
    t.draw(T, (g, u) => { const time = u * T; wingsDark(g, c, s, open(time), fadeIn(time), mr(time)); }, { dark: true });
    t.draw(T, (g, u) => { const time = u * T; wingsLit(g, c, s, open(time), fadeIn(time), mr(time)); });
    t.glow(m.from, CRIMSON, 0.2, T, 1.3);

    // The swarm boiling off the wings: each bat lifts off the membrane and
    // wheels round him, the flock thickening as the wings open.
    const n = Math.max(4, Math.round(10 * t.quality));
    const bats = Array.from({ length: n }, (_, i) => {
      const sx = i % 2 ? 1 : -1;
      return {
        born: T * (0.12 + 0.6 * (i / n)) + rand(0, 0.05),
        a0: sx > 0 ? rand(-1.2, 0.2) : Math.PI + rand(-0.2, 1.2),
        w: sx * rand(5, 8), r: rand(0.5, 0.8), ph: rand(0, TAU), k: rand(0.28, 0.34),
      };
    });
    drawBats(t, T, (time) => bats.map((b) => {
      const age = time - b.born;
      if (age <= 0) return { pts: [], eye: c, a: 0 };
      const ang = b.a0 + b.w * age, R = s * b.r * (0.6 + 0.4 * easeOut(clamp01(age / 0.3)));
      const x = c.x + Math.cos(ang) * R, y = c.y - s * 0.15 + Math.sin(ang) * R * 0.6;
      const head = ang + (b.w > 0 ? Math.PI / 2 : -Math.PI / 2);
      return pose(x, y, s * b.k * Math.min(1, age / 0.08 + 0.4), head, b.ph + age * 34, clamp01(age / 0.06));
    }));
  },

  land(t: FxTools, m: SigMoment) {
    const c = centre(m.from), s = m.size;
    // The wings beat once, hard, as the swarm is loosed — and the moon and
    // wings sink away.
    const WD = 0.6;
    const beat = (u: number) => 1 - 0.18 * Math.sin(Math.PI * span(u, 0, 0.35));
    t.draw(WD, (g, u) => wingsDark(g, c, s, beat(u), 1 - span(u, 0.25, 1), s * 0.3), { dark: true });
    t.draw(WD, (g, u) => wingsLit(g, c, s, beat(u), 1 - span(u, 0.25, 1), s * 0.3));

    // THE SWARM: a knot of bats to every opponent, each bat on its own curve,
    // bowing out and in so the flock spreads over the board; at the card they
    // circle and feed, then scatter.
    const per = Math.max(2, Math.round(4 * t.quality));
    const hits = m.targets.map((r, i) => ({ r, p: centre(r), k: Math.max(0.7, Math.min(1.5, (m.power[i] ?? 1) + 0.25)), killed: m.killed[i] ?? false, first: 9 }));
    const flock = hits.flatMap((h) => Array.from({ length: per }, (_, j) => {
      const a = rand(0, TAU), S = { x: c.x + Math.cos(a) * s * rand(0.3, 0.55), y: c.y - s * 0.15 + Math.sin(a) * s * 0.35 };
      const dx = h.p.x - S.x, dy = h.p.y - S.y, d = Math.hypot(dx, dy) || 1;
      const bow = (j % 2 ? 1 : -1) * rand(0.15, 0.35) * d;
      const K = { x: (S.x + h.p.x) / 2 - (dy / d) * bow, y: (S.y + h.p.y) / 2 + (dx / d) * bow };
      const go = rand(0, 0.05) + j * 0.025, fly = Math.max(0.16, Math.min(0.3, 0.12 + 0.045 * (d / s)));
      h.first = Math.min(h.first, go + fly);
      return { S, K, h, go, fly, w: (j % 2 ? 1 : -1) * rand(9, 12), a1: rand(0, TAU), ph: rand(0, TAU), k: rand(0.34, 0.4) };
    }));
    const FEED = 0.26, SCATTER = 0.14, BD = 0.08 + 0.3 + FEED + SCATTER + 0.06;
    drawBats(t, BD, (time) => flock.map((b) => {
      const q = (time - b.go) / b.fly, ph = b.ph + time * 36;
      if (q < 0) return { pts: [], eye: c, a: 0 };
      if (q < 1) {
        // On the wing: a quadratic curve, quickening toward the bite.
        const e = easeIn(q) * 0.6 + q * 0.4, v = 1 - e;
        const x = v * v * b.S.x + 2 * v * e * b.K.x + e * e * b.h.p.x, y = v * v * b.S.y + 2 * v * e * b.K.y + e * e * b.h.p.y;
        const tx = 2 * v * (b.K.x - b.S.x) + 2 * e * (b.h.p.x - b.K.x), ty = 2 * v * (b.K.y - b.S.y) + 2 * e * (b.h.p.y - b.K.y);
        return pose(x, y, s * b.k, Math.atan2(ty, tx), ph, clamp01(q * 6));
      }
      // Feeding: circling tight over the card, then scattering outward.
      const f = time - b.go - b.fly, ang = b.a1 + b.w * f;
      const R = s * (0.28 - 0.1 * span(f, 0, FEED) + 0.9 * easeIn(span(f, FEED, FEED + SCATTER)));
      const a = 1 - span(f, FEED, FEED + SCATTER);
      return pose(b.h.p.x + Math.cos(ang) * R, b.h.p.y + Math.sin(ang) * R * 0.8, s * b.k, ang + Math.sign(b.w) * Math.PI / 2, ph, a);
    }));

    // Where each knot lands: the bite, the blood drawn home, the seal.
    for (const h of hits) {
      t.later(h.first, () => bite(t, h.r, s, h.k, h.killed, c));
      const home = thread(t, h.p, c, s, h.k, h.first + 0.06);
      t.later(home, () => {
        flare(t, c, s * 0.9, CRIMSON, 0.3, 0.25);
        t.emit({ count: 5, palette: SIP, from: m.from, at: "ring", speed: [90 * (s / 90), 160 * (s / 90)], gravity: 0, drag: 1,
          life: [0.2, 0.32], size: [5, 2], streak: true, swirl: 240 });
      });
      seal(t, h.r, s, h.k, h.first + 0.3);
    }
    // The blood comes home: a last pulse of red light swelling round him.
    const last = Math.max(0, ...hits.map((h) => h.first)) + 0.3;
    t.later(last, () => t.ring(m.from, CRIMSON, 0.4, 1.0, 0.3, 3));
  },
};
