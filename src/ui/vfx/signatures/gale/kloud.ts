/** KLOUD — Twisted Rage. "Raise a Thundering Hurricane at half strength. It
 *  lands reeling every opponent within 2 spaces into contact for 8 DMG and
 *  PARALYZING them. Cast again while it stands and it re-forms: the burst
 *  breaks again and the storm heals 6." It raises a Thundering Hurricane over
 *  your foes.
 *
 *  Kloud is a feathered storm shaman, a blue lightning vortex spinning in one
 *  palm and an amber flame-feather in the other; the Thundering Hurricane he
 *  raises is a towering violet-blue funnel laced with lightning. So the
 *  DELIVERY is his two hands: a vortex of blue wind and lightning winding up
 *  in one, the flame-feather flickering and shedding embers in the other,
 *  both swelling as the storm is called.
 *
 *  The LANDING is the hurricane. A funnel of storm cloud twists up out of its
 *  square, growing tall in under half a second — dark for real, lit along its
 *  edges, violet and blue bands whirling round it faster at the foot than at
 *  the crown, a glowing eye at its mouth and lightning jumping inside it. Its
 *  winds REEL every target in: streaks torn off beyond each card and dragged
 *  round and into the funnel's foot, dust spun in with them — and then a blue
 *  lightning crack out of the funnel onto each one, the paralysis crawling
 *  over the card.
 *
 *  Re-formed (the storm already stands, so nothing is spawned), the funnel is
 *  there at full height from the first frame: it FLARES, a burst rings out
 *  from it, and the reel and the lightning follow faster. The game hands no
 *  square for the standing storm, but every foe it reels ends in contact with
 *  it — so it is drawn on the ally that stands beside every one of them, or
 *  failing that between them, or over Kloud when nothing is reeled.
 *
 *  It is weather, not a spirit: violet storm and lightning, nothing carved. */
import { centre, rand } from "../../looks/base";
import type { Graphics } from "pixi.js";
import type { FxTools, Pt, SparkStyle } from "../../looks/types";
import type { Signature, SigMoment } from "../types";

type Box = SigMoment["from"];

const TAU = Math.PI * 2;
// The funnel's body: only ever on the dark layer.
const STORM = 0x0b0820;
// The storm lit: violet bands, blue bands, the pale rim, the lightning.
const VIOLET = 0x8f74ff, BLUE = 0x4f8cff, RIM = 0xb4a8ff, PALE = 0xdcd8ff, BOLT_CORE = 0xf2f4ff;
// The flame-feather in his other hand.
const FLAME = 0xffb44a, FLAME_HI = 0xffe2a0;
/** Dust and torn air spun round the funnel's foot and reeled in. */
const REEL: SparkStyle = { palette: [PALE, VIOLET, BLUE, 0x3a3aa0], gravity: -40, drag: 0.6, size: [5, 1.5], streak: true, swirl: 700 };
/** Embers off the flame-feather. */
const EMBER: SparkStyle = { palette: [FLAME_HI, FLAME, 0xe0701a], gravity: -120, drag: 0.6, size: [3.5, 1], streak: false };
/** The paralysis crawling off a struck card: short, jittering blue. */
const CRACKLE: SparkStyle = { palette: [BOLT_CORE, PALE, BLUE], gravity: 0, drag: 0.2, size: [4, 1], streak: true };

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeOut = (x: number) => 1 - (1 - x) * (1 - x);

/** The whole landing, s, and when the funnel starts to thin. */
const D = 1.05, THIN = 0.78;
const fadeAll = (time: number) => 1 - clamp01((time - THIN) / (D - THIN));

// ── Where the storm stands ──────────────────────────────────────────────────

/** The storm's square: the one it was raised on; re-formed, the ally beside
 *  every reeled foe (nearest their middle), else their middle; else Kloud. */
function stormAt(m: SigMoment): { p: Pt; fresh: boolean } {
  if (m.spawned.length) return { p: centre(m.spawned[0]), fresh: true };
  if (!m.targets.length) return { p: centre(m.from), fresh: false };
  const ps = m.targets.map(centre);
  const mid = { x: ps.reduce((a, p) => a + p.x, 0) / ps.length, y: ps.reduce((a, p) => a + p.y, 0) / ps.length };
  let best: Pt | null = null, bd = Infinity;
  for (const r of m.allies) {
    const a = centre(r);
    if (!ps.every((p) => Math.hypot(p.x - a.x, p.y - a.y) < m.size * 1.6)) continue;
    const d = Math.hypot(a.x - mid.x, a.y - mid.y);
    if (d < bd) { bd = d; best = a; }
  }
  return { p: best ?? mid, fresh: false };
}

// ── The funnel ──────────────────────────────────────────────────────────────

/** The funnel at height fraction `v` (0 the foot, 1 the crown): its axis,
 *  swaying more the higher it goes, and its radius, flaring wide at the top. */
function slice(foot: Pt, s: number, v: number, time: number) {
  const H = s * 1.5;
  return {
    x: foot.x + s * 0.13 * v * Math.sin(time * 3.2 + v * 2.6),
    y: foot.y - H * v,
    r: s * (0.08 + 0.6 * Math.pow(v, 1.6)),
  };
}

/** The funnel's silhouette up to `top`: its left edge up, its right edge
 *  down, the edge rolling as the cloud churns. */
function outline(foot: Pt, s: number, top: number, time: number): number[] {
  const N = 18, left: number[] = [], right: number[] = [];
  for (let i = 0; i <= N; i++) {
    const v = (top * i) / N, q = slice(foot, s, v, time);
    const lump = 1 + 0.13 * Math.sin(v * 14 + time * 9) + 0.08 * Math.sin(v * 31 - time * 13);
    left.push(q.x - q.r * lump, q.y);
    right.unshift(q.x + q.r * (2 - lump), q.y);
  }
  return left.concat(right);
}

/** The storm cloud the funnel hangs from, at its crown `cr`: a broad, lumpy
 *  disc seen a little from above, churning. */
function cap(cr: { x: number; y: number; r: number }, s: number, time: number): number[] {
  const pts: number[] = [], rx = cr.r * 1.3 + s * 0.05, ry = s * 0.2;
  for (let i = 0; i < 32; i++) {
    const th = (i / 32) * TAU, lump = 1 + 0.12 * Math.sin(th * 5 + time * 6) + 0.07 * Math.sin(th * 9 - time * 9);
    pts.push(cr.x + Math.cos(th) * rx * lump, cr.y + Math.sin(th) * ry * lump - s * 0.04);
  }
  return pts;
}

/** THE HURRICANE: the funnel twisting up out of its square (or standing
 *  there already, and flaring), dark and lit, its bands whirling, an eye
 *  glowing at its mouth, lightning jumping inside it, dust spun round its
 *  foot. */
function funnel(t: FxTools, at: Pt, s: number, fresh: boolean) {
  const foot = { x: at.x, y: at.y + s * 0.3 };
  const top = (time: number) => (fresh ? 0.12 + 0.88 * easeOut(clamp01(time / 0.4)) : 1);
  const flare = (time: number) => (fresh ? 0 : Math.exp(-time / 0.14));
  t.draw(D, (g, u) => {
    const time = u * D, a = clamp01(time / 0.06) * fadeAll(time);
    g.poly(outline(foot, s, top(time), time), true).fill({ color: STORM, alpha: 0.72 * a });
    g.poly(cap(slice(foot, s, top(time), time), s, time), true).fill({ color: STORM, alpha: 0.72 * a });
  }, { dark: true });
  let dust = 0;
  t.draw(D, (g, u, dt) => {
    const time = u * D, a = clamp01(time / 0.06) * fadeAll(time), tp = top(time), fl = flare(time);
    const out = outline(foot, s, tp, time);
    g.poly(out, true).fill({ color: VIOLET, alpha: (0.08 + 0.35 * fl) * a }).stroke({ width: 1.8, color: RIM, alpha: (0.7 + 0.3 * fl) * a, join: "round" });
    // The bands: arcs round the funnel on its near side, spinning faster at
    // the foot than at the crown, violet and blue in turn.
    for (let k = 0; k < 11; k++) {
      const v = ((k + 0.5) / 11) * tp, q = slice(foot, s, v, time), spin = time * (13 - 6 * v) + k * 1.9;
      const ry = q.r * 0.24, span = 1.3 + 0.6 * Math.sin(k * 2.3 + time * 4);
      for (let j = 0; j < 2; j++) {
        const a0 = spin + j * Math.PI;
        // Ragged: each band wanders in and out, and droops, as it goes round.
        const rr = (n: number) => q.r * (0.8 + 0.18 * Math.sin(n * 1.7 + k + time * 11));
        g.moveTo(q.x + Math.cos(a0) * rr(0), q.y + Math.sin(a0) * ry);
        for (let n = 1; n <= 8; n++) {
          const th = a0 + (span * n) / 8;
          g.lineTo(q.x + Math.cos(th) * rr(n), q.y + Math.sin(th) * ry + (n / 8) * q.r * 0.1);
        }
        // Bright where it swings across the front, dim round the back.
        const front = 0.5 + 0.5 * Math.sin(a0 + span / 2);
        g.stroke({ width: 1.2 + 1.6 * front, color: k % 2 ? BLUE : VIOLET, alpha: (0.25 + 0.6 * front) * a, cap: "round" });
      }
    }
    // The cloud it hangs from, lit along its edge, and the eye in it: a
    // spiral winding in to a glow.
    const cr = slice(foot, s, tp, time), cp = cap(cr, s, time);
    g.poly(cp, true).fill({ color: VIOLET, alpha: (0.1 + 0.3 * fl) * a }).stroke({ width: 2, color: RIM, alpha: (0.6 + 0.4 * fl) * a, join: "round" });
    g.ellipse(cr.x, cr.y - s * 0.04, cr.r * 0.9, s * 0.13).stroke({ width: 1.2, color: BLUE, alpha: 0.6 * a });
    for (let j = 0; j < 2; j++) {
      const a0 = -time * 8 + j * Math.PI;
      g.moveTo(cr.x + Math.cos(a0) * cr.r * 0.8, cr.y + Math.sin(a0) * cr.r * 0.2);
      for (let n = 1; n <= 10; n++) {
        const f = n / 10, th = a0 + f * 4;
        g.lineTo(cr.x + Math.cos(th) * cr.r * 0.8 * (1 - f * 0.85), cr.y + Math.sin(th) * cr.r * 0.2 * (1 - f * 0.85));
      }
      g.stroke({ width: 1.4, color: BOLT_CORE, alpha: 0.7 * a, cap: "round" });
    }
    g.circle(cr.x, cr.y, s * 0.05).fill({ color: PALE, alpha: (0.35 + 0.4 * fl) * a });
    // Dust spun round the foot and up into it.
    if (time < THIN) {
      dust += dt * 34 * t.quality;
      for (; dust >= 1; dust--) {
        const th = rand(0, TAU), R = s * rand(0.3, 0.5), v = rand(150, 240) * (s / 90);
        t.spark(foot.x + Math.cos(th) * R, foot.y + Math.sin(th) * R * 0.3, -Math.sin(th) * v, Math.cos(th) * v * 0.3 - rand(30, 90) * (s / 90),
          rand(0.3, 0.45), REEL, foot);
      }
    }
  });
  // Lightning jumping inside it.
  for (const when of fresh ? [0.22, 0.48, 0.7] : [0.04, 0.3, 0.62])
    t.later(when, () => {
      const v0 = rand(0.25, 0.45), v1 = rand(0.65, 0.9), tm = when, q0 = slice(foot, s, v0, tm), q1 = slice(foot, s, v1, tm);
      t.bolt({ x: q0.x + rand(-0.5, 0.5) * q0.r, y: q0.y }, { x: q1.x + rand(-0.6, 0.6) * q1.r, y: q1.y }, BOLT_CORE, BLUE, 0.1);
    });
  // Re-formed: the standing storm flares and the burst breaks again.
  if (!fresh) {
    const r: Box = { x: at.x - s / 2, y: at.y - s / 2, w: s, h: s };
    t.flash({ x: at.x, y: at.y - s * 0.3 }, PALE, 0.4 * (s / 80));
    t.ring(r, VIOLET, 0.4, 2.4, 0.4, 6);
    t.ring(r, PALE, 0.5, 2.2, 0.32, 2);
    t.glow(r, VIOLET, 0.35, 0.35, 1.6);
  }
}

// ── The reel and the strike ─────────────────────────────────────────────────

/** A streak of storm-wind dragged in: torn off beyond the card and pulled
 *  round, the way the storm turns, into the funnel's foot — a thin tail and
 *  a bold head. */
function streak(g: Graphics, p0: Pt, p1: Pt, bend: number, e: number, w: number, color: number, alpha: number) {
  if (alpha <= 0.02) return;
  const mx = (p0.x + p1.x) / 2 - (p1.y - p0.y) * bend, my = (p0.y + p1.y) / 2 + (p1.x - p0.x) * bend;
  const pt = (f: number) => {
    const q = 1 - f;
    return { x: q * q * p0.x + 2 * q * f * mx + f * f * p1.x, y: q * q * p0.y + 2 * q * f * my + f * f * p1.y };
  };
  const t0 = Math.max(0, e - 0.55), N = 10, pts: number[] = [], head: number[] = [];
  for (let i = 0; i <= N; i++) {
    const q = pt(t0 + ((e - t0) * i) / N);
    pts.push(q.x, q.y);
    if (i >= N - 4) head.push(q.x, q.y);
  }
  g.poly(pts, false).stroke({ width: w * 0.45, color, alpha: alpha * 0.5, cap: "round", join: "round" });
  g.poly(head, false).stroke({ width: w, color, alpha, cap: "round", join: "round" });
}

/** One foe REELED IN and struck: storm-wind torn off beyond it and dragged
 *  into the funnel, dust pulled off it the same way, then a blue lightning
 *  crack out of the funnel onto it and the paralysis crawling over it. */
function reel(t: FxTools, r: Box, eye: Pt, s: number, power: number, killed: boolean, delay: number) {
  const p = centre(r), k = Math.max(0.6, Math.min(1.6, power));
  const dx = p.x - eye.x, dy = p.y - eye.y, d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d;
  const foot = { x: eye.x + ux * s * 0.28, y: eye.y + s * 0.2 + uy * s * 0.15 };
  const lines = Array.from({ length: Math.max(3, Math.round(6 * t.quality)) }, (_, i) => {
    const side = rand(-0.45, 0.45) * s, back = rand(0.5, 0.9) * s;
    return {
      p0: { x: p.x + ux * back - uy * side, y: p.y + uy * back + ux * side },
      p1: { x: foot.x - uy * side * 0.25, y: foot.y + ux * side * 0.25 },
      // Bent the way the storm turns, so they come in round it, not straight.
      bend: 0.28 + rand(-0.06, 0.06), lag: i * 0.04 + rand(0, 0.03), color: i % 2 ? BLUE : VIOLET,
    };
  });
  const R = 0.5;
  t.draw(R + 0.2, (g, u) => {
    const time = u * (R + 0.2);
    for (const l of lines) {
      const q = clamp01((time - l.lag) / R);
      if (q <= 0) continue;
      const e = easeOut(q) * 0.95, a = Math.min(1, q * 5) * (1 - clamp01((q - 0.7) / 0.3));
      streak(g, l.p0, l.p1, l.bend, e, Math.max(3, s * 0.075 * k), l.color, a);
      streak(g, l.p0, l.p1, l.bend, e, Math.max(1, s * 0.015), PALE, 0.9 * a);
    }
  }, { delay });
  // Dust pulled off the card toward the storm, turning round it.
  t.later(delay + 0.05, () => {
    const n = Math.round(6 * k);
    for (let i = 0; i < n; i++) {
      const v = rand(160, 280) * (s / 90), a = Math.atan2(-uy, -ux) + rand(-0.5, 0.5);
      t.spark(p.x + rand(-0.3, 0.3) * s, p.y + rand(-0.3, 0.3) * s, Math.cos(a) * v, Math.sin(a) * v, rand(0.3, 0.45), REEL, eye);
    }
  });
  // THE STRIKE: lightning off the funnel's flank onto the card.
  const hit = delay + 0.16;
  t.later(hit, () => {
    const src = { x: eye.x + ux * s * 0.35, y: eye.y - s * rand(0.35, 0.6) };
    t.bolt(src, p, BOLT_CORE, BLUE, 0.18);
    t.flash(p, PALE, 0.3 * k * (s / 80));
    t.ring(r, BLUE, 0.3, 1.05 * (0.85 + 0.15 * k), 0.3, 3);
    t.arcs(p, [BOLT_CORE, PALE, BLUE], 0.8 * k, 5);
    t.glow(r, VIOLET, 0.25, 0.3, 1.0);
    if (killed) {
      t.bolt({ x: eye.x - ux * s * 0.2, y: eye.y - s * 0.9 }, p, BOLT_CORE, VIOLET, 0.16);
      t.ring(r, PALE, 0.4, 1.5, 0.4, 4);
    }
  });
  // The paralysis: short blue arcs jittering over the card a little while.
  let acc = 0;
  t.draw(0.45, (g, u, dt) => {
    acc += dt * 30 * t.quality * k;
    for (; acc >= 1; acc--) {
      const a = rand(0, TAU), v = rand(80, 160) * (s / 90);
      t.spark(p.x + rand(-0.32, 0.32) * s, p.y + rand(-0.36, 0.36) * s, Math.cos(a) * v, Math.sin(a) * v, rand(0.06, 0.12), CRACKLE);
    }
    // Two jagged threads of current across the card, re-rolled each frame.
    for (let j = 0; j < 2; j++) {
      const a0 = rand(0, TAU), L = s * 0.36;
      let x = p.x + Math.cos(a0) * L, y = p.y + Math.sin(a0) * L;
      g.moveTo(x, y);
      for (let n = 1; n <= 5; n++) {
        const f = n / 5;
        x = p.x + Math.cos(a0) * L * (1 - 2 * f) + rand(-0.1, 0.1) * s;
        y = p.y + Math.sin(a0) * L * (1 - 2 * f) + rand(-0.1, 0.1) * s;
        g.lineTo(x, y);
      }
      g.stroke({ width: 1.3, color: PALE, alpha: 0.75 * (1 - u), join: "miter" });
    }
  }, { delay: hit });
}

// ── The shaman's hands ──────────────────────────────────────────────────────

/** A small whirl of wind in a palm: arcs spiralling in round `p`, `R` across,
 *  spinning at `spin` rad/s. */
function whirl(g: Graphics, p: Pt, R: number, time: number, spin: number, color: number, alpha: number) {
  for (let j = 0; j < 3; j++) {
    const a0 = time * spin + (j * TAU) / 3;
    g.moveTo(p.x + Math.cos(a0) * R, p.y + Math.sin(a0) * R * 0.8);
    for (let n = 1; n <= 8; n++) {
      const f = n / 8, th = a0 + f * 2.6, rr = R * (1 - 0.75 * f);
      g.lineTo(p.x + Math.cos(th) * rr, p.y + Math.sin(th) * rr * 0.8);
    }
    g.stroke({ width: 1.8, color, alpha, cap: "round" });
  }
}

/** The flame-feather: a feather of amber fire, its vane flickering. */
function featherFlame(g: Graphics, p: Pt, len: number, time: number, alpha: number) {
  const ang = -Math.PI / 2 + 0.25 + 0.12 * Math.sin(time * 9), ux = Math.cos(ang), uy = Math.sin(ang), nx = -uy, ny = ux;
  const base = { x: p.x - ux * len * 0.45, y: p.y - uy * len * 0.45 }, tip = { x: p.x + ux * len * 0.55, y: p.y + uy * len * 0.55 };
  const pts: number[] = [];
  for (let i = 0; i <= 8; i++) {
    const f = i / 8, w = len * 0.22 * Math.sin(Math.PI * Math.pow(f, 0.8)) * (1 + 0.15 * Math.sin(time * 23 + i));
    pts.push(base.x + (tip.x - base.x) * f + nx * w, base.y + (tip.y - base.y) * f + ny * w);
  }
  for (let i = 8; i >= 0; i--) {
    const f = i / 8, w = len * 0.2 * Math.sin(Math.PI * Math.pow(f, 0.8)) * (1 + 0.15 * Math.sin(time * 19 + i * 2));
    pts.push(base.x + (tip.x - base.x) * f - nx * w, base.y + (tip.y - base.y) * f - ny * w);
  }
  g.poly(pts, true).fill({ color: FLAME, alpha: 0.45 * alpha }).stroke({ width: 1.3, color: FLAME_HI, alpha: 0.9 * alpha, join: "round" });
  g.moveTo(base.x, base.y).lineTo(tip.x, tip.y).stroke({ width: 1, color: FLAME_HI, alpha: 0.9 * alpha });
}

export const KLOUD: Signature = {
  shake: 1.1,
  // He calls the storm from where he stands.
  lunge: false,

  deliver(t: FxTools, m: SigMoment, seconds: number) {
    const c = centre(m.from), s = m.size, T = seconds;
    // His hands, either side of him: the vortex on the left as on the art,
    // the flame-feather on the right.
    const L = { x: c.x - s * 0.34, y: c.y + s * 0.08 }, Rh = { x: c.x + s * 0.34, y: c.y + s * 0.08 };
    t.charge(L, s * 0.7, BLUE, 0.35, T);
    t.charge(Rh, s * 0.55, FLAME, 0.25, T);
    let embers = 0;
    t.draw(T, (g, u, dt) => {
      const time = u * T, a = clamp01(u * 5), k = 0.6 + 0.4 * easeOut(u);
      whirl(g, L, s * 0.27 * k, time, 9 + 10 * u, BLUE, 0.9 * a);
      whirl(g, L, s * 0.16 * k, time + 0.3, 14 + 10 * u, PALE, 0.7 * a);
      featherFlame(g, Rh, s * 0.46 * k, time, a);
      embers += dt * 22 * t.quality;
      for (; embers >= 1; embers--) t.spark(Rh.x + rand(-0.08, 0.08) * s, Rh.y - rand(0, 0.15) * s, rand(-20, 20), -rand(30, 80) * (s / 90), rand(0.25, 0.4), EMBER);
    });
    // The vortex crackling as it winds up.
    for (const f of [0.3, 0.6]) t.later(T * f, () => t.arcs(L, [BOLT_CORE, PALE, BLUE], 0.2, 2));
  },

  land(t: FxTools, m: SigMoment) {
    const s = m.size, { p, fresh } = stormAt(m);
    funnel(t, p, s, fresh);
    // Nearest first: the storm's pull reaches the closest of them soonest.
    const order = m.targets.map((r, i) => ({ r, i, d: Math.hypot(centre(r).x - p.x, centre(r).y - p.y) })).sort((a, b) => a.d - b.d);
    const start = fresh ? 0.24 : 0.1;
    order.forEach((o, j) => reel(t, o.r, p, s, m.power[o.i] ?? 1, m.killed[o.i] ?? false, start + j * 0.07));
  },
};
