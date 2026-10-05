/** EVERA — Spiraling Root Coil. "ROOT up to 4 opponents in the adjacent row
 *  for 3 rounds. Next round, ROOT up to 4 in the far row for 2 rounds." The
 *  goddess of the four seasons: her Coil pins a whole row, then the row
 *  behind it.
 *
 *  The DELIVERY is the year turning round her. A wheel of the seasons circles
 *  her card — spring's pink petals, summer's green leaves, autumn's amber and
 *  winter's snowflakes, each following the last — under the pale halo of her
 *  art; then the wheel winds down into the roots at her feet, and the ground
 *  furrows as they run out under the row ahead.
 *
 *  The LANDING is the coil. Under each card the ground breaks and a root
 *  bursts up, spiralling as it climbs — the twisting roots that coil at her
 *  feet on her art — and wraps the card from its footing to its crown, front
 *  turns over it and back turns behind. Each coil carries the next season
 *  along the row: blossom opening on the first, leaves on the second, autumn
 *  leaves turning and falling off the third, rime and snow on the fourth. And
 *  from each coil a thin root creeps on past the row toward the one behind
 *  it — the coil that comes next round.
 *
 *  The roots are SOLID bark on the normal-blend layer, with a lit back and a
 *  dark edge so they read over an empty square; the seasons are light. */
import { centre, rand } from "../../looks/base";
import type { Graphics } from "pixi.js";
import type { FxTools, Pt, SparkStyle } from "../../looks/types";
import type { Signature, SigMoment } from "../types";

type Box = SigMoment["from"];

const TAU = Math.PI * 2;
// Her roots: twisted dark bark, on the normal-blend layer.
const BARK = 0x6a4a2c, BARK_LO = 0x3a2716, BARK_HI = 0xb58c5c, BARK_EDGE = 0x150d06, SOIL = 0x0c0805, CLOD = 0x3a2a18, CLOD_LIT = 0xb89468;
// The four seasons, off her art: spring blossom, summer leaf, autumn, frost.
const SPRING = 0xffa8c8, SPRING_LT = 0xffe0ec, SUMMER = 0x8fdc5a, SUMMER_DK = 0x4caf6d, AUTUMN = 0xffa23a, AUTUMN_DK = 0xd8602a;
const FROST = 0xd8f0ff, ICE = 0x9fd0ff, WHITE = 0xffffff;
/** Her halo: pale gold. */
const HALO = 0xfff0c0;
const SEASON = [SPRING, SUMMER, AUTUMN, FROST];
/** Each season's motes, as it lets go: petals, pollen, falling leaf-bits, snow. */
const SPARKS: SparkStyle[] = [
  { palette: [SPRING_LT, SPRING, 0xe86a9a], gravity: 60, drag: 0.5, size: [5, 2], streak: false, swirl: 140 },
  { palette: [0xf0ffd8, SUMMER, SUMMER_DK], gravity: -40, drag: 0.5, size: [5, 2], streak: false, swirl: -140 },
  { palette: [0xffe0a0, AUTUMN, AUTUMN_DK], gravity: 90, drag: 0.5, size: [5, 2], streak: false, swirl: 140 },
  { palette: [WHITE, FROST, ICE], gravity: 50, drag: 0.6, size: [5, 2], streak: false },
];
/** Grit off the ground the coil breaks. */
const GRIT: SparkStyle = { palette: [0xe8d8b0, 0xb89468, 0x6e5a40], gravity: 900, drag: 0.6, size: [5, 2], streak: false };

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeOut = (x: number) => 1 - (1 - x) * (1 - x);
const smooth = (x: number) => x * x * (3 - 2 * x);

// ── The seasons, drawn ───────────────────────────────────────────────────────

/** A leaf (or, wide at its tip, a petal): `open` is how face-on it is. */
function leaf(g: Graphics, x: number, y: number, len: number, ang: number, open: number, color: number, alpha: number, petal = false) {
  if (alpha <= 0.02 || len < 1.5) return;
  const c = Math.cos(ang), s = Math.sin(ang), hx = c * len * 0.5, hy = s * len * 0.5, w = len * (petal ? 0.5 : 0.44) * Math.max(0.12, open);
  const k = petal ? 0.45 : -0.3, mx = x + hx * k, my = y + hy * k;
  g.moveTo(x - hx, y - hy).quadraticCurveTo(mx - s * w, my + c * w, x + hx, y + hy).quadraticCurveTo(mx + s * w, my - c * w, x - hx, y - hy)
    .fill({ color, alpha });
}

/** A snowflake: six spokes, each forked near its end. */
function snowflake(g: Graphics, x: number, y: number, r: number, rot: number, alpha: number) {
  if (alpha <= 0.02 || r < 1) return;
  for (let i = 0; i < 6; i++) {
    const a = rot + (i / 6) * TAU, c = Math.cos(a), s = Math.sin(a), fx = x + c * r * 0.6, fy = y + s * r * 0.6;
    g.moveTo(x, y).lineTo(x + c * r, y + s * r);
    g.moveTo(fx, fy).lineTo(fx + Math.cos(a + 0.7) * r * 0.3, fy + Math.sin(a + 0.7) * r * 0.3);
    g.moveTo(fx, fy).lineTo(fx + Math.cos(a - 0.7) * r * 0.3, fy + Math.sin(a - 0.7) * r * 0.3);
  }
  g.stroke({ width: 1.2, color: WHITE, alpha });
}

/** A blossom: five petals round a pale heart. */
function blossom(g: Graphics, x: number, y: number, r: number, rot: number, alpha: number) {
  if (alpha <= 0.02 || r < 1) return;
  for (let i = 0; i < 5; i++) {
    const a = rot + (i / 5) * TAU;
    g.circle(x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55, r * 0.48).fill({ color: SPRING, alpha: 0.95 * alpha });
  }
  g.circle(x, y, r * 0.3).fill({ color: SPRING_LT, alpha });
}

/** One mote of season `k`, as it rides the wheel. */
function mote(g: Graphics, k: number, x: number, y: number, len: number, ang: number, open: number, alpha: number) {
  if (k === 0) leaf(g, x, y, len * 0.8, ang, open, SPRING, alpha, true);
  else if (k === 1) leaf(g, x, y, len, ang, open, SUMMER, alpha);
  else if (k === 2) leaf(g, x, y, len, ang, open, open > 0.5 ? AUTUMN : AUTUMN_DK, alpha);
  else snowflake(g, x, y, len * 0.45, ang, alpha);
}

// ── The coil ─────────────────────────────────────────────────────────────────

/** A root's run of points either in front of the card or behind it. */
interface Run { pts: number[]; w: number[]; front: boolean }

/** THE COIL round a card: a helix from its footing to its crown, `turns`
 *  round, tilted so its front turns lie lower than its back ones, grown
 *  `upto` (0..1) of its length, `squeeze` drawing it in. Split into runs in
 *  front of the card and behind it. */
function coilRuns(c: Pt, s: number, a0: number, dir: number, upto: number, squeeze: number): Run[] {
  const N = 40, n = Math.max(2, Math.ceil(N * upto)), runs: Run[] = [];
  const bottom = c.y + s * 0.42, H = s * 0.86;
  let cur: Run | null = null;
  for (let i = 0; i <= n; i++) {
    const f = Math.min(upto, i / N), th = a0 + dir * f * 2.1 * TAU, R = s * 0.47 * (1 - 0.18 * f) * squeeze;
    const x = c.x + Math.cos(th) * R, y = bottom - f * H + Math.sin(th) * R * 0.24, front = Math.sin(th) > 0;
    const w = s * (0.11 - 0.065 * f) * (f > upto - 0.04 ? Math.max(0.25, (upto - f) / 0.04) : 1);
    if (!cur || cur.front !== front) {
      // Each run starts where the last ended, so the root is unbroken.
      const prev: Run | null = cur;
      cur = { pts: [], w: [], front };
      if (prev) { cur.pts.push(prev.pts[prev.pts.length - 2], prev.pts[prev.pts.length - 1]); cur.w.push(prev.w[prev.w.length - 1]); }
      runs.push(cur);
    }
    cur.pts.push(x, y);
    cur.w.push(w);
  }
  return runs;
}

/** A body round a run: as wide as its widths say, each side. */
function body(run: Run, scale = 1): number[] {
  const n = run.pts.length / 2, left: number[] = [], right: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1);
    const tx = run.pts[b * 2] - run.pts[a * 2], ty = run.pts[b * 2 + 1] - run.pts[a * 2 + 1], l = Math.hypot(tx, ty) || 1, hw = (run.w[i] * scale) / 2;
    left.push(run.pts[i * 2] - (ty / l) * hw, run.pts[i * 2 + 1] + (tx / l) * hw);
    right.unshift(run.pts[i * 2] + (ty / l) * hw, run.pts[i * 2 + 1] - (tx / l) * hw);
  }
  return left.concat(right);
}

export const EVERA: Signature = {
  shake: 0.6,
  // She stays where she stands: the roots go.
  lunge: false,

  deliver(t: FxTools, m: SigMoment, seconds: number) {
    const r = m.from, c = centre(r), s = m.size, S = seconds;
    // HER HALO, as on her art, brightening as the year turns.
    const halo = { x: c.x, y: r.y + r.h * 0.27 };
    t.draw(S, (g, u) => {
      const k = smooth(clamp01(u / 0.4)) * (1 - 0.6 * clamp01((u - 0.75) / 0.25));
      g.circle(halo.x, halo.y, s * 0.25).stroke({ width: s * 0.06, color: HALO, alpha: 0.12 * k });
      g.circle(halo.x, halo.y, s * 0.25).stroke({ width: 1.3, color: HALO, alpha: 0.75 * k });
    });
    // THE WHEEL OF THE YEAR: three motes of each season in turn round her,
    // turning — then wound down into the roots at her feet.
    const n = 12, a0 = rand(0, TAU), dir = Math.random() < 0.5 ? -1 : 1, feet = { x: c.x, y: r.y + r.h * 0.88 };
    const ph = Array.from({ length: n }, () => rand(0, TAU));
    const WIND = 0.62;
    const place = (i: number, time: number) => {
      const u = time / S, down = smooth(clamp01((u - WIND) / (1 - WIND)));
      const th = a0 + (i / n) * TAU + dir * time * 2.6 + dir * down * 2.4;
      const rx = s * 0.66 * (1 - 0.85 * down), ry = s * 0.5 * (1 - 0.85 * down);
      const cy = c.y + (feet.y - c.y) * down;
      return { x: c.x + Math.cos(th) * rx, y: cy + Math.sin(th) * ry, th };
    };
    t.draw(S, (g, u) => {
      const time = u * S, a = Math.min(1, u * 5) * (1 - clamp01((u - 0.88) / 0.12));
      // The wheel's track: each season's arc in its own colour.
      const down = smooth(clamp01((u - WIND) / (1 - WIND)));
      for (let k = 0; k < 4; k++) {
        const pts: number[] = [];
        for (let j = 0; j <= 8; j++) {
          const p = place(k * 3 - 1 + (j / 8) * 3, time);
          pts.push(p.x, p.y);
        }
        g.poly(pts, false).stroke({ width: s * 0.08, color: SEASON[k], alpha: 0.1 * a * (1 - down) });
        g.poly(pts, false).stroke({ width: 1.5, color: SEASON[k], alpha: 0.55 * a * (1 - down) });
      }
      for (let i = 0; i < n; i++) {
        const p = place(i, time), k = Math.floor(i / 3), turn = Math.cos(time * 9 + ph[i]);
        mote(g, k, p.x, p.y, s * 0.2, p.th + dir * Math.PI / 2 + 0.4 * turn, 0.3 + 0.7 * Math.abs(turn), 0.95 * a);
      }
    });
    // THE FURROWS: as the wheel goes down, her roots run out under the row
    // ahead, the ground humping over each — arriving under every card as the
    // delivery ends.
    const GO = S * 0.55, RUN = S - GO;
    const lines = m.targets.map((tr) => {
      const p = centre(tr), b = { x: p.x - m.ahead.x * s * 0.46, y: p.y - m.ahead.y * s * 0.46 }, dx = b.x - feet.x, dy = b.y - feet.y, L = Math.hypot(dx, dy) || 1;
      const bow = L * rand(0.08, 0.16) * (Math.random() < 0.5 ? -1 : 1), pts: number[] = [];
      for (let i = 0; i <= 12; i++) {
        const f = i / 12;
        pts.push(feet.x + dx * f - (dy / L) * bow * Math.sin(Math.PI * f), feet.y + dy * f + (dx / L) * bow * Math.sin(Math.PI * f));
      }
      return pts;
    });
    const part = (pts: number[], f: number) => pts.slice(0, Math.max(2, Math.round((pts.length / 2) * f)) * 2);
    t.draw(RUN, (g, u) => {
      for (const p of lines) g.poly(part(p, easeOut(u)), false).stroke({ width: s * 0.07, color: SOIL, alpha: 0.5, cap: "round", join: "round" });
    }, { dark: true, delay: GO });
    t.draw(RUN, (g, u) => {
      for (const p of lines) {
        const q = part(p, easeOut(u));
        g.poly(q, false).stroke({ width: 1, color: CLOD_LIT, alpha: 0.6, join: "round" });
        g.circle(q[q.length - 2], q[q.length - 1], s * 0.04).fill({ color: SUMMER, alpha: 0.6 });
      }
    }, { delay: GO });
  },

  land(t: FxTools, m: SigMoment) {
    const s = m.size;
    // The seasons follow each other ALONG the row: ordered across the way
    // she faces, so the year turns from her left to her right.
    const across = { x: -m.ahead.y, y: m.ahead.x };
    const order = m.targets.map((r, i) => ({ r, i, k: centre(r).x * across.x + centre(r).y * across.y })).sort((a, b) => a.k - b.k);
    order.forEach((o, j) => coil(t, o.r, j % 4, m.ahead, s, j * 0.04));
  },
};

/** THE COIL on one card, carrying season `k`: the ground breaking at its
 *  footing, the root bursting up and spiralling round it to its crown,
 *  tightening as it takes hold; the season opening along it; and a thin root
 *  creeping on from it toward the row behind. */
function coil(t: FxTools, r: Box, k: number, ahead: Pt, s: number, delay: number) {
  const c = centre(r), foot = { x: c.x, y: r.y + r.h * 0.9 }, a0 = Math.PI / 2 + rand(-0.4, 0.4), dir = Math.random() < 0.5 ? -1 : 1, D = 1.0;
  const grow = (time: number) => easeOut(clamp01(time / 0.3));
  const squeeze = (time: number) => 1 - 0.08 * smooth(clamp01((time - 0.28) / 0.12)) + 0.03 * Math.sin(clamp01((time - 0.4) / 0.2) * Math.PI);
  const fade = (time: number) => 1 - clamp01((time - 0.72) / 0.28);
  t.later(delay, () => {
    // The ground breaks.
    t.flash(foot, SEASON[k], 0.12 * (s / 80));
    const n = Math.round(9 * t.quality);
    for (let i = 0; i < n; i++) {
      const a = rand(-Math.PI * 0.9, -Math.PI * 0.1), v = rand(80, 180) * (s / 90);
      t.spark(foot.x + rand(-0.2, 0.2) * s, foot.y, Math.cos(a) * v, Math.sin(a) * v, rand(0.3, 0.5), GRIT);
    }
    t.glow(r, SEASON[k], 0.24, 0.8, 1.05);
    clods(t, foot, s);
  });
  // The root: back turns first, dimmer, then the front turns over the card —
  // bark with a lit back and a dark edge.
  t.draw(D, (g, u) => {
    const time = u * D, a = fade(time);
    if (a <= 0.02) return;
    const runs = coilRuns(c, s, a0, dir, grow(time), squeeze(time));
    for (const front of [false, true])
      for (const run of runs) {
        if (run.front !== front || run.pts.length < 4) continue;
        const shape = body(run);
        g.poly(shape, true).fill({ color: front ? BARK : BARK_LO, alpha: (front ? 0.98 : 0.75) * a }).stroke({ width: 1.2, color: BARK_EDGE, alpha: 0.9 * a });
        if (front) {
          const lit = run.pts.map((v, j) => (j % 2 ? v - run.w[(j - 1) / 2] * 0.22 : v));
          g.poly(lit, false).stroke({ width: Math.max(1, s * 0.022), color: BARK_HI, alpha: 0.85 * a, join: "round" });
        }
      }
  }, { dark: true, delay });
  // The season along it, and a glint of it down the root's back.
  const spots = [0.2, 0.42, 0.64, 0.86].map((f) => {
    const th = a0 + dir * f * 2.1 * TAU;
    return { f, th, front: Math.sin(th) > 0, rot: rand(0, TAU) };
  });
  t.draw(D, (g, u) => {
    const time = u * D, a = fade(time), up = grow(time), sq = squeeze(time);
    if (a <= 0.02) return;
    const runs = coilRuns(c, s, a0, dir, up, sq);
    for (const run of runs) {
      if (!run.front || run.pts.length < 4) continue;
      if (k === 3) g.poly(run.pts, false).stroke({ width: Math.max(1.2, s * 0.025), color: FROST, alpha: 0.8 * a * clamp01((time - 0.15) / 0.2), join: "round" });
      else g.poly(run.pts, false).stroke({ width: 1, color: SEASON[k], alpha: 0.35 * a, join: "round" });
    }
    for (const sp of spots) {
      const open = clamp01((up - sp.f) / 0.15) * clamp01((time - 0.12) / 0.15);
      if (open <= 0) continue;
      const R = s * 0.47 * (1 - 0.18 * sp.f) * sq, x = c.x + Math.cos(sp.th) * R, y = c.y + s * 0.42 - sp.f * s * 0.86 + Math.sin(sp.th) * R * 0.24;
      const da = sp.front ? 1 : 0.45, out = Math.atan2(y - c.y, x - c.x);
      if (k === 0) blossom(g, x, y, s * 0.085 * springIn(open), sp.rot + time * 2, a * da);
      else if (k === 1) {
        leaf(g, x + Math.cos(out) * s * 0.08 * open, y + Math.sin(out) * s * 0.08 * open, s * 0.21 * open, out - 0.4, 0.8, SUMMER, 0.95 * a * da);
        leaf(g, x + Math.cos(out + 1) * s * 0.06 * open, y + Math.sin(out + 1) * s * 0.06 * open, s * 0.15 * open, out + 0.7, 0.8, SUMMER_DK, 0.9 * a * da);
      } else if (k === 2) {
        // Autumn's leaves turn, and the late ones let go and fall.
        const drop = clamp01((time - 0.45 - sp.f * 0.15) / 0.5), fx = x + Math.sin(drop * 9 + sp.rot) * s * 0.06 * drop, fy = y + drop * drop * s * 0.6;
        leaf(g, fx + Math.cos(out) * s * 0.08 * open, fy + Math.sin(out) * s * 0.08 * open, s * 0.2 * open, out - 0.4 + drop * 4, 0.4 + 0.6 * Math.abs(Math.cos(drop * 8 + sp.rot)),
          sp.f > 0.5 ? AUTUMN_DK : AUTUMN, 0.95 * a * da * (1 - drop * drop));
      } else snowflake(g, x, y, s * 0.085 * open, sp.rot + time * 1.5, 0.95 * a * da);
    }
  }, { delay });
  // The season's motes, let go as it opens.
  t.later(delay + 0.2, () => {
    const n = Math.round(8 * t.quality);
    for (let i = 0; i < n; i++)
      t.spark(c.x + rand(-0.4, 0.4) * s, c.y + rand(-0.4, 0.3) * s, rand(-25, 25) * (s / 90), rand(-40, 0) * (s / 90), rand(0.5, 0.8), SPARKS[k]);
  });
  creep(t, c, ahead, s, delay + 0.3);
}

/** Eases in from nothing with a little overshoot: a bud opening. */
function springIn(x: number) {
  return x <= 0 ? 0 : 1 + 2.7 * Math.pow(x - 1, 3) + 1.7 * Math.pow(x - 1, 2);
}

/** Clods of earth thrown up where the root breaks the ground: dark, lit at
 *  their rims, falling back. */
function clods(t: FxTools, at: Pt, s: number) {
  const bits = Array.from({ length: Math.max(2, Math.round(5 * t.quality)) }, () => {
    const a = rand(-Math.PI * 0.85, -Math.PI * 0.15), v = rand(90, 170) * (s / 90);
    return { x: at.x + rand(-0.25, 0.25) * s, y: at.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: s * rand(0.028, 0.045), rot: rand(0, TAU) };
  });
  t.draw(0.5, (g, u) => {
    const time = u * 0.5, a = 1 - Math.pow(u, 3);
    for (const b of bits) {
      const x = b.x + b.vx * time, y = b.y + b.vy * time + 700 * (s / 90) * time * time, pts: number[] = [];
      for (let i = 0; i < 5; i++) {
        const an = b.rot + time * 8 + (i / 5) * TAU;
        pts.push(x + Math.cos(an) * b.r * (0.75 + 0.25 * ((i * 7) % 3)), y + Math.sin(an) * b.r * (0.75 + 0.25 * ((i * 5) % 3)));
      }
      g.poly(pts, true).fill({ color: CLOD, alpha: a }).stroke({ width: 1, color: CLOD_LIT, alpha: 0.8 * a });
    }
  }, { dark: true });
}

/** NEXT ROUND'S COIL: a thin root creeping on from a coiled card past the
 *  row toward the one behind it — slow, feeling its way along the ground —
 *  and drawing back down into it: it will come up there next round. */
function creep(t: FxTools, c: Pt, ahead: Pt, s: number, delay: number) {
  const nx = -ahead.y, ny = ahead.x, from = { x: c.x + ahead.x * s * 0.46, y: c.y + ahead.y * s * 0.46 }, L = s * 0.62, side = Math.random() < 0.5 ? -1 : 1;
  const pts: number[] = [];
  for (let i = 0; i <= 12; i++) {
    const f = i / 12, off = Math.sin(f * Math.PI * 1.6) * s * 0.06 * side;
    pts.push(from.x + ahead.x * L * f + nx * off, from.y + ahead.y * L * f + ny * off);
  }
  const D = 0.65, grow = (u: number) => easeOut(clamp01(u / 0.6)), a = (u: number) => Math.min(1, u * 6) * (1 - clamp01((u - 0.6) / 0.4));
  // Drawn back into the ground from its root end as it goes.
  const part = (u: number) => {
    const n = Math.max(2, Math.round(13 * grow(u))), from0 = Math.min(n - 2, Math.floor(13 * clamp01((u - 0.55) / 0.45) * 0.8));
    return pts.slice(from0 * 2, n * 2);
  };
  const shape = (p: number[]) => {
    const n = p.length / 2, left: number[] = [], right: number[] = [];
    for (let i = 0; i < n; i++) {
      const a0 = Math.max(0, i - 1), b0 = Math.min(n - 1, i + 1), tx = p[b0 * 2] - p[a0 * 2], ty = p[b0 * 2 + 1] - p[a0 * 2 + 1], l = Math.hypot(tx, ty) || 1;
      const hw = s * (0.03 - (0.022 * i) / Math.max(1, n - 1));
      left.push(p[i * 2] - (ty / l) * hw, p[i * 2 + 1] + (tx / l) * hw);
      right.unshift(p[i * 2] + (ty / l) * hw, p[i * 2 + 1] - (tx / l) * hw);
    }
    return left.concat(right);
  };
  t.draw(D, (g, u) => {
    const p = part(u);
    if (p.length >= 4) g.poly(shape(p), true).fill({ color: BARK, alpha: 0.9 * a(u) }).stroke({ width: 1, color: BARK_EDGE, alpha: 0.8 * a(u) });
  }, { dark: true, delay });
  t.draw(D, (g, u) => {
    const p = part(u);
    if (p.length < 4) return;
    g.poly(p, false).stroke({ width: 1, color: SUMMER, alpha: 0.6 * a(u), join: "round" });
    g.circle(p[p.length - 2], p[p.length - 1], s * 0.028).fill({ color: SPRING_LT, alpha: 0.75 * a(u) });
  }, { delay });
}
