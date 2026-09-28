/** SKYBREAKER — Eye of the Storm. "No hurricane on the field: call one.
 *  Otherwise trade places with it, break its wind wake over the board, and
 *  deal 15 DMG to every opponent within 1 space of where Skybreaker lands,
 *  PARALYZING them for 2 rounds" — it has not taken a step in living memory,
 *  and it has been everywhere.
 *
 *  One Special, two faces, and one shape for both: a hurricane seen from
 *  above — spiral bands of cloud winding in to a dark eye, lightning
 *  flickering in them.
 *
 *  CALLING ONE is all landing (it aims at nothing): the sky over the field
 *  darkens, the boss's own storm winds up round it and pours a stream of wind
 *  across to the empty square, and there the hurricane spins up out of
 *  nothing — bands lengthening, spin quickening, lightning waking in it —
 *  until it throws a gust out over the board and stands.
 *
 *  THE SWAP is the move the rules describe. The DELIVERY winds a storm up round
 *  the boss and swells the hurricane where it stands, then the two eyes trade
 *  places down a wake of wind between the squares, each landing where the
 *  other was as the delivery ends. The LANDING is the eye arriving: the storm
 *  bursting out round the square the boss lands on, lightning thrown from the
 *  eye into every card within a space of it (the PARALYZE) and the wind of it
 *  over each; and the hurricane, now standing where the boss was, breaking its
 *  wind wake over the whole board — gusts racing out from it to the edges.
 *
 *  Nothing here is "down": the storms turn where the squares are, and the
 *  gusts run out from them whichever way the board faces. */
import { centre, rand } from "../looks/base";
import type { Graphics } from "pixi.js";
import type { FxTools, Pt, SparkStyle } from "../looks/types";
import type { Signature } from "./types";

type Box = { x: number; y: number; w: number; h: number };

const TAU = Math.PI * 2;
const CREAM = 0xfffaf0, PEACH = 0xffd9a0, APRICOT = 0xffc070, AMBER = 0xffa040;
/** The storm's lightning: BOLT's own white core and violet halo. */
const WHITE = 0xffffff, LAV = 0xe3d8ff, VIO = 0x9575ff;
/** The eye, and the dark sky — only ever on the dark layer. */
const INK = 0x06070c;

/** Dust and spray whipped round a storm, bent by its spin. */
const SPUN: SparkStyle = { palette: [CREAM, PEACH, AMBER], gravity: 0, drag: 0.5, size: [7, 2], streak: true, swirl: 900 };
/** Dust in a gust, curling round where it was blown off. */
const EDDY: SparkStyle = { palette: [CREAM, PEACH, AMBER], gravity: -20, drag: 0.35, size: [6, 2], streak: true, swirl: 650 };
/** Static off a struck card: darts out and stops dead. */
const SNAP: SparkStyle = { palette: [WHITE, LAV, VIO], gravity: 0, drag: 0.001, size: [6, 1.5], streak: true };

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeOut = (x: number) => 1 - (1 - x) * (1 - x);
/** 0 -> 1 as `u` runs from `a` to `b`. */
const span = (u: number, a: number, b: number) => clamp01((u - a) / (b - a));
const lerp = (a: Pt, b: Pt, f: number): Pt => ({ x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f });
/** One flicker beat, s: lightning is re-drawn on this clock, not the frame's. */
const BEAT = 0.035;

// ── The storm ───────────────────────────────────────────────────────────────

/** A hurricane seen from above: `arms` bands of cloud spiralling in to an eye
 *  at `c`, `R` across at their outer ends, turned by `spin`. Log spirals —
 *  tight at the eye wall, opening outward — each a broad faint band of cloud
 *  with a brighter line down it, thinning as it unwinds, over a faint mass of
 *  cloud; the outer ends trail the turn, as a storm's do. */
function hurricane(g: Graphics, c: Pt, R: number, spin: number, alpha: number, arms = 6) {
  if (alpha <= 0.01 || R < 2) return;
  const r0 = R * 0.16, N = 18, grow = R / r0;
  g.circle(c.x, c.y, R * 0.85).fill({ color: CREAM, alpha: 0.07 * alpha });
  for (let i = 0; i < arms; i++) {
    const a0 = spin + (i / arms) * TAU, pts: number[] = [];
    for (let j = 0; j <= N; j++) {
      const f = j / N, r = r0 * Math.pow(grow, f), th = a0 + 3.2 * f;
      pts.push(c.x + Math.cos(th) * r, c.y + Math.sin(th) * r);
    }
    // In three lengths, so the band tapers; butt-ended, so the lengths meet
    // without a bright knot where they join.
    const trace = (k: number) => {
      const i0 = k * 6, i1 = Math.min(N, i0 + 6);
      g.moveTo(pts[2 * i0], pts[2 * i0 + 1]);
      for (let j = i0 + 1; j <= i1; j++) g.lineTo(pts[2 * j], pts[2 * j + 1]);
    };
    for (let k = 0; k < 3; k++) {
      trace(k);
      g.stroke({ width: Math.max(1.5, R * (0.14 - 0.035 * k)), color: CREAM, alpha: alpha * (0.26 - 0.06 * k), cap: "butt", join: "round" });
      trace(k);
      g.stroke({ width: Math.max(1, R * (0.045 - 0.012 * k)), color: k === 0 ? CREAM : k === 1 ? PEACH : APRICOT,
        alpha: alpha * (0.95 - 0.25 * k), cap: "butt", join: "round" });
    }
  }
  g.circle(c.x, c.y, r0).stroke({ width: Math.max(1.5, R * 0.045), color: CREAM, alpha });
}

/** The eye itself: a dark disc at the storm's heart. */
function eye(g: Graphics, c: Pt, R: number, alpha: number) {
  if (alpha > 0.01 && R > 1) g.circle(c.x, c.y, R * 0.14).fill({ color: INK, alpha: 0.7 * alpha });
}

/** A lightning channel from a to b, kinked `segs` times by up to `jag` px:
 *  a fresh one every beat, so it crackles. */
function channel(ax: number, ay: number, bx: number, by: number, segs: number, jag: number): number[] {
  const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len, out = [ax, ay];
  let off = 0;
  for (let i = 1; i < segs; i++) {
    off = off * 0.5 + rand(-1, 1);
    const f = (i + rand(-0.3, 0.3)) / segs, o = off * jag * Math.sqrt(Math.sin(Math.PI * Math.min(1, Math.max(0, f))));
    out.push(ax + dx * f + nx * o, ay + dy * f + ny * o);
  }
  out.push(bx, by);
  return out;
}

/** Lightning stroked: a wide violet halo under a thin white-hot core. Traced,
 *  never handed to `poly`, since the arrays are re-rolled. */
function lightning(g: Graphics, paths: number[][], width: number, alpha: number) {
  if (alpha <= 0.02 || !paths.length) return;
  const trace = () => {
    for (const p of paths) {
      g.moveTo(p[0], p[1]);
      for (let i = 2; i < p.length; i += 2) g.lineTo(p[i], p[i + 1]);
    }
  };
  trace();
  g.stroke({ width: width * 4, color: VIO, alpha: 0.3 * alpha, join: "round", cap: "round" });
  trace();
  g.stroke({ width, color: WHITE, alpha, join: "bevel", cap: "round" });
}

/** Lightning waking in a storm's bands for `D` s: a few short forks flicking
 *  on and off among them, re-rolled every beat. */
function stormLightning(t: FxTools, where: (time: number) => { c: Pt; R: number }, D: number, n: number, delay = 0) {
  let beat = -1, paths: number[][] = [];
  t.draw(D, (g, u) => {
    const time = u * D, b = Math.floor(time / BEAT), { c, R } = where(time);
    if (b !== beat) {
      beat = b;
      paths = [];
      for (let i = 0; i < n; i++) {
        if (Math.random() < 0.45) continue;
        const a = rand(0, TAU), r0 = R * rand(0.25, 0.6), r1 = r0 + R * rand(0.25, 0.45), a1 = a + rand(-0.6, 0.6);
        paths.push(channel(c.x + Math.cos(a) * r0, c.y + Math.sin(a) * r0, c.x + Math.cos(a1) * r1, c.y + Math.sin(a1) * r1, 4, R * 0.06));
      }
    }
    lightning(g, paths, 1.6, Math.sin(Math.PI * u));
  }, { delay });
}

/** Wind racing out from `c` over the whole board to its edges: long streaks
 *  at every angle, each passing once and curling off at its end. */
function wake(t: FxTools, c: Pt, board: Box, s: number, n: number, D: number, delay = 0) {
  const lanes = Array.from({ length: n }, (_, i) => {
    const a = (i / n) * TAU + rand(-0.15, 0.15);
    // To the board's edge along this angle — the wake stops at the field.
    const ca = Math.cos(a), sa = Math.sin(a);
    let reach = Infinity;
    if (ca > 1e-3) reach = Math.min(reach, (board.x + board.w - c.x) / ca);
    if (ca < -1e-3) reach = Math.min(reach, (board.x - c.x) / ca);
    if (sa > 1e-3) reach = Math.min(reach, (board.y + board.h - c.y) / sa);
    if (sa < -1e-3) reach = Math.min(reach, (board.y - c.y) / sa);
    return { a, reach: Math.max(s, reach), bend: rand(0.25, 0.5) * (i % 2 ? 1 : -1), at: rand(0, 0.08) };
  });
  t.draw(D, (g, u) => {
    const age = u * D;
    for (const l of lanes) {
      const head = easeOut(clamp01((age - l.at) / (D * 0.6))), tail = clamp01((age - l.at - D * 0.22) / (D * 0.6));
      if (head - tail < 0.02) continue;
      const pts: number[] = [];
      for (let i = 0; i <= 10; i++) {
        const f = tail + ((head - tail) * i) / 10, r = s * 0.55 + (l.reach - s * 0.55) * f, th = l.a + l.bend * f * f;
        pts.push(c.x + Math.cos(th) * r, c.y + Math.sin(th) * r);
      }
      g.poly(pts, false).stroke({ width: 1.4, color: PEACH, alpha: 0.55, cap: "round" });
      g.poly(pts.slice(12), false).stroke({ width: 2.8, color: CREAM, alpha: 0.85, cap: "round" });
    }
  }, { delay });
}

export const SKYBREAKER: Signature = {
  shake: 1.8,
  // It never walks: the storm moves it.
  lunge: false,

  deliver(t: FxTools, m, seconds) {
    // Only the swap has a delivery: calling a storm aims at nothing.
    const T = seconds, s = m.size, c0 = centre(m.from), c1 = centre(m.to), spin0 = rand(0, TAU);
    const GO = 0.55; // the eyes trade places from here to the end
    const places = (u: number) => {
      const f = span(u, GO, 1), e = f * f * (3 - 2 * f);
      return { boss: lerp(c0, c1, e), storm: lerp(c1, c0, e) };
    };
    const size = (u: number) => ({ boss: s * (0.45 + 0.4 * easeOut(span(u, 0, 0.45))), storm: s * (0.7 + 0.2 * easeOut(span(u, 0, 0.45))) });
    // THE STORMS: one winding up round the boss, the hurricane swelling where
    // it stands — and then trading places.
    t.draw(T, (g, u) => {
      const { boss, storm } = places(u), R = size(u);
      eye(g, boss, R.boss, Math.min(1, u * 4));
      eye(g, storm, R.storm, 1);
    }, { dark: true });
    t.draw(T, (g, u) => {
      const time = u * T, { boss, storm } = places(u), R = size(u), f = span(u, GO, 1);
      // The wake between them: the swap is a streak of wind both ways at once.
      if (f > 0 && f < 1) {
        const w = Math.sin(Math.PI * f);
        for (const o of [-0.18, 0, 0.18]) {
          const nx = -(c1.y - c0.y), ny = c1.x - c0.x, nl = Math.hypot(nx, ny) || 1, ox = (nx / nl) * o * s, oy = (ny / nl) * o * s;
          g.moveTo(boss.x + ox, boss.y + oy).lineTo(storm.x - ox, storm.y - oy).stroke({ width: o ? 1.6 : 3, color: o ? PEACH : CREAM, alpha: 0.75 * w, cap: "round" });
        }
      }
      hurricane(g, boss, R.boss, spin0 - time * 9, Math.min(1, u * 4), 5);
      hurricane(g, storm, R.storm, spin0 + 1.3 - time * 11, 1, 6);
    });
    stormLightning(t, (time) => ({ c: places(time / T).storm, R: size(time / T).storm }), T, 4);
    t.emit({ count: 24, palette: [CREAM, PEACH, AMBER], from: m.to, at: "ring", speed: [130, 210], gravity: 0, drag: 1,
      life: [0.2, T * 0.6], size: [8, 2], streak: true, swirl: 900 });
  },

  land(t: FxTools, m) {
    const s = m.size, k = s / 90, c0 = centre(m.from), c1 = centre(m.to), B = m.board, spin0 = rand(0, TAU);

    if (!m.targets.length) {
      // CALLING THE STORM: the sky darkens, the boss's own storm winds up and
      // pours a stream of wind across to the empty square, and the hurricane
      // spins up out of nothing there until it throws a gust over the board.
      const sp = m.spawned.length ? centre(m.spawned[0]) : { x: c0.x + m.ahead.x * s * 1.1, y: c0.y + m.ahead.y * s * 1.1 };
      const D = 1.15;
      const grow = (time: number) => s * (0.15 + 0.85 * easeOut(span(time, 0.12, 0.7)));
      t.draw(D, (g, u) => {
        g.rect(B.x, B.y, B.w, B.h).fill({ color: INK, alpha: 0.22 * Math.sin(Math.PI * u) });
        eye(g, sp, grow(u * D), span(u * D, 0.15, 0.3) * (1 - span(u, 0.85, 1)));
      }, { dark: true });
      t.draw(D, (g, u) => {
        const time = u * D;
        hurricane(g, c0, s * 0.8, spin0 - time * 8, 0.85 * span(time, 0, 0.12) * (1 - span(time, 0.5, 0.85)), 5);
        // The stream across: three gusts running from the boss to the square.
        const f1 = easeOut(span(time, 0.05, 0.4)), f0 = span(time, 0.2, 0.55);
        if (f1 - f0 > 0.02)
          for (const o of [-0.16, 0, 0.16]) {
            const nx = -(sp.y - c0.y), ny = sp.x - c0.x, nl = Math.hypot(nx, ny) || 1;
            const a = lerp(c0, sp, f0), b = lerp(c0, sp, f1), ox = (nx / nl) * o * s, oy = (ny / nl) * o * s;
            g.moveTo(a.x + ox, a.y + oy).lineTo(b.x + ox, b.y + oy).stroke({ width: o ? 1.6 : 3, color: o ? PEACH : CREAM, alpha: 0.8, cap: "round" });
          }
        hurricane(g, sp, grow(time), spin0 + 2 - time * (6 + 10 * span(time, 0.1, 0.7)), span(time, 0.1, 0.3) * (1 - span(u, 0.8, 1)), 6);
      });
      stormLightning(t, (time) => ({ c: sp, R: grow(0.3 + time) }), 0.75, 4, 0.3);
      t.later(0.62, () => {
        t.ring({ x: sp.x - s / 2, y: sp.y - s / 2, w: s, h: s }, CREAM, 0.6, 3.2, 0.5, 5);
        wake(t, sp, B, s, 10, 0.5);
      });
      let acc = 0;
      t.draw(0.7, (_g, _u, dt) => {
        acc += dt * 50 * t.quality;
        for (; acc >= 1; acc--) {
          const a = rand(0, TAU), r = s * rand(0.7, 1.1), v = rand(120, 200) * k;
          t.spark(sp.x + Math.cos(a) * r, sp.y + Math.sin(a) * r, Math.sin(a) * v - Math.cos(a) * v * 0.6, -Math.cos(a) * v - Math.sin(a) * v * 0.6,
            rand(0.25, 0.45), SPUN, sp);
        }
      }, { delay: 0.1 });
      return;
    }

    // THE EYE ARRIVES: the storm bursts out round the square it lands on...
    t.flash(c1, CREAM, 0.5);
    t.ring(m.to, CREAM, 0.6, 3.4, 0.45, 6);
    t.draw(0.55, (g, u) => {
      const e = easeOut(u);
      eye(g, c1, s * (0.9 + 1.2 * e), 1 - u);
    }, { dark: true });
    t.draw(0.55, (g, u) => {
      const e = easeOut(u);
      hurricane(g, c1, s * (0.9 + 1.2 * e), spin0 - u * 7, 1 - u, 7);
    });
    for (let i = 0; i < Math.round(28 * t.quality); i++) {
      const a = rand(0, TAU), v = rand(200, 360) * k;
      t.spark(c1.x + Math.cos(a) * s * 0.3, c1.y + Math.sin(a) * s * 0.3, -Math.sin(a) * v + Math.cos(a) * v * 0.5,
        Math.cos(a) * v + Math.sin(a) * v * 0.5, rand(0.3, 0.5), SPUN, c1);
    }
    // ...lightning thrown from the eye into every card within a space of it,
    // and the wind of it breaking over each...
    m.targets.forEach((r, i) => {
      const q = centre(r), kk = Math.max(0.7, Math.min(1.8, m.power[i] ?? 1));
      t.later(0.02 + i * 0.04, () => {
        t.bolt(c1, q, WHITE, VIO, 0.32);
        t.arcs(q, [WHITE, LAV, VIO], 0.45 * kk, 5);
        t.ring(r, PEACH, 0.3, 1.1 * kk, 0.35, 3);
        t.glow(r, LAV, 0.3, 0.3, 1.0);
        const away = Math.atan2(q.y - c1.y, q.x - c1.x);
        for (let j = 0; j < Math.round(8 * kk * t.quality); j++) {
          const a = away + rand(-0.8, 0.8), v = rand(140, 280) * k;
          t.spark(q.x, q.y, Math.cos(a) * v, Math.sin(a) * v, rand(0.25, 0.45), EDDY);
        }
        for (let j = 0; j < Math.round(6 * kk * t.quality); j++) {
          const a = rand(0, TAU), v = rand(200, 380) * k;
          t.spark(q.x, q.y, Math.cos(a) * v, Math.sin(a) * v, rand(0.1, 0.22), SNAP);
        }
      });
    });
    // ...and the hurricane, standing where the boss was, breaks its wind wake
    // over the whole board, settling into its square as it does.
    t.later(0.1, () => wake(t, c0, B, s, 12, 0.6));
    t.draw(0.9, (g, u) => eye(g, c0, s * 0.75, Math.sin(Math.PI * u)), { dark: true });
    t.draw(0.9, (g, u) => hurricane(g, c0, s * 0.75, spin0 + 1 - u * 6, 0.8 * Math.sin(Math.PI * u), 6));
  },
};
