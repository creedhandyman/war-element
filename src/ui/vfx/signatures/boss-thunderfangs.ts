/** THUNDERFANGS — Thunder Run. "9 DMG and ELECTRIFIED for 2 rounds to every
 *  opponent within 2 spaces" (Stormform: 11) — it never hunts alone, and it
 *  has never had to learn how. Both forms play this one module.
 *
 *  The DELIVERY is the pack gathering and then running. Static crawls over the
 *  boss's card and the wind whirls in round it; it howls — a ring of air
 *  thrown out over the field — and the pack breaks from it: one storm-wolf for
 *  every card in reach, each a wolf's head of pale storm-light with a body of
 *  streaming wind and lightning crackling down it, racing out in a curve
 *  round the boss and closing on its card. Every wolf is on its card as the
 *  delivery ends.
 *
 *  The LANDING is the bite: on each card a pair of jaws made of lightning —
 *  an upper fang and a lower, jagged, snapping shut on it — then the crackle
 *  of it held in the card (the ELECTRIFIED), a flash, the wind of the pack
 *  breaking over it, the wolf gone to static. The pack lands in a ragged
 *  volley, not all at once.
 *
 *  STORMFORM is fiercer, read off how hard the bites land (`m.power`): its own
 *  storm answers it — a bolt out of the sky onto the boss as it howls, and
 *  another onto every card it bites — and the wolves run bigger, the jaws
 *  wider, the crackle thicker. The wolves' heads are drawn in profile, facing
 *  the side they run to with their noses tipped into the run: a wolf reads in
 *  profile, and turned to face straight down the board it would only be a
 *  shape. */
import { centre, rand } from "../looks/base";
import type { Graphics } from "pixi.js";
import type { FxTools, Pt, SparkStyle } from "../looks/types";
import type { Signature, SigMoment } from "./types";

type Box = { x: number; y: number; w: number; h: number };

const TAU = Math.PI * 2;
const CREAM = 0xfffaf0, PEACH = 0xffd9a0, AMBER = 0xffa040;
/** The storm's light: BOLT's white core and violet halo, and a pale storm-blue
 *  for the wolves' bodies. */
const WHITE = 0xffffff, LAV = 0xe3d8ff, VIO = 0x9575ff, STORM = 0xc8d4ff;

/** Static: darts out hard and stops dead. */
const SNAP: SparkStyle = { palette: [WHITE, LAV, VIO], gravity: 0, drag: 0.001, size: [6, 1.5], streak: true };
/** Dust whipped up by the pack, curling in its wind. */
const EDDY: SparkStyle = { palette: [CREAM, PEACH, AMBER], gravity: -20, drag: 0.35, size: [6, 2], streak: true, swirl: 650 };

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeOut = (x: number) => 1 - (1 - x) * (1 - x);
/** 0 -> 1 as `u` runs from `a` to `b`. */
const span = (u: number, a: number, b: number) => clamp01((u - a) / (b - a));
/** One flicker beat, s: lightning is re-drawn on this clock, not the frame's. */
const BEAT = 0.035;

/** How fierce this cast is, 0..1, from how hard it bites: Thunderfangs' 9 sits
 *  near the bottom, Stormform's 11 (15 on the afflicted) near the top. */
function fierce(m: SigMoment): number {
  if (!m.power.length) return 0;
  const avg = m.power.reduce((a, b) => a + b, 0) / m.power.length;
  return clamp01((avg - 1) / 0.35);
}

// ── Lightning ───────────────────────────────────────────────────────────────

/** Points along a curve from `a` through control `c` to `b`, kinked across it
 *  by up to `jag` px (most mid-way, pinned at the ends): a fresh one every
 *  beat, so it crackles. */
function crackle(a: Pt, c: Pt, b: Pt, segs: number, jag: number): number[] {
  const out: number[] = [];
  let off = 0;
  for (let i = 0; i <= segs; i++) {
    const f = i / segs, q = 1 - f;
    const x = q * q * a.x + 2 * q * f * c.x + f * f * b.x, y = q * q * a.y + 2 * q * f * c.y + f * f * b.y;
    const tx = q * (c.x - a.x) + f * (b.x - c.x), ty = q * (c.y - a.y) + f * (b.y - c.y), tl = Math.hypot(tx, ty) || 1;
    off = i === 0 || i === segs ? 0 : off * 0.5 + rand(-1, 1);
    const o = off * jag * Math.sqrt(Math.sin(Math.PI * f));
    out.push(x - (ty / tl) * o, y + (tx / tl) * o);
  }
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

// ── The pack ────────────────────────────────────────────────────────────────

/** A wolf's head in profile, running: (forward, up) in units of its size,
 *  nose at the origin — the long tapering snout, the stop, the tall pointed
 *  ear, the nape and throat running back into the body of wind it trails. */
const WOLF = [0, 0.02, -0.02, -0.06, -0.1, -0.12, -0.3, -0.14, -0.48, -0.2, -0.62, -0.18, -0.9, -0.24, -1.05, 0,
  -0.9, 0.24, -0.7, 0.3, -0.64, 0.33, -0.62, 0.64, -0.46, 0.34, -0.36, 0.28, -0.12, 0.1, -0.02, 0.07];

type Run = { r: Box; i: number; p: Pt; xs: number[]; ys: number[]; ds: number[]; L: number; side: number };

/** Each wolf's run: out from the boss in a curve round it — bowing out to the
 *  side its card is on — and in onto the card, sampled by distance so it runs
 *  at an even pace round the bend. */
function pack(m: SigMoment): Run[] {
  const c0 = centre(m.from), a = m.ahead, s = m.size;
  return m.targets.map((r, i) => {
    const p = centre(r), dx = p.x - c0.x, dy = p.y - c0.y, dist = Math.hypot(dx, dy) || 1;
    const lat = dx * -a.y + dy * a.x, bow = (lat >= 0 ? 1 : -1) * Math.max(s * 0.35, dist * 0.38);
    const ctl = { x: c0.x + dx * 0.45 + (-dy / dist) * bow, y: c0.y + dy * 0.45 + (dx / dist) * bow };
    const xs: number[] = [], ys: number[] = [], ds: number[] = [0];
    for (let j = 0; j <= 20; j++) {
      const f = j / 20, q = 1 - f;
      xs.push(q * q * c0.x + 2 * q * f * ctl.x + f * f * p.x);
      ys.push(q * q * c0.y + 2 * q * f * ctl.y + f * f * p.y);
      if (j > 0) ds.push(ds[j - 1] + Math.hypot(xs[j] - xs[j - 1], ys[j] - ys[j - 1]));
    }
    return { r, i, p, xs, ys, ds, L: ds[20], side: p.x < c0.x - s * 0.05 ? -1 : 1 };
  });
}

/** Where a run is `d` px along it, and which way it is heading there. */
function along(w: Run, d: number): { x: number; y: number; ux: number; uy: number } {
  const dd = Math.max(0, Math.min(w.L, d));
  let j = 0;
  while (j < 19 && w.ds[j + 1] < dd) j++;
  const f = (dd - w.ds[j]) / Math.max(1e-6, w.ds[j + 1] - w.ds[j]);
  const dx = w.xs[j + 1] - w.xs[j], dy = w.ys[j + 1] - w.ys[j], dl = Math.hypot(dx, dy) || 1;
  return { x: w.xs[j] + dx * f, y: w.ys[j] + dy * f, ux: dx / dl, uy: dy / dl };
}

/** A wolf's head at `at`, `size` big: in profile facing `side`, nose tipped
 *  into the run, bobbing with its stride. Returns the outline and where its
 *  eye and its nape are. */
function wolfHead(at: { x: number; y: number; ux: number; uy: number }, side: number, size: number, time: number, ph: number) {
  let fx = side + at.ux * 0.8, fy = at.uy * 0.8;
  const fl = Math.hypot(fx, fy) || 1;
  fx /= fl;
  fy /= fl;
  const bob = 0.12 * Math.sin(time * 24 + ph), c = Math.cos(bob), sn = Math.sin(bob);
  const gx = fx * c - fy * sn, gy = fx * sn + fy * c;
  const hx = gx > 0 ? gy : -gy, hy = gx > 0 ? -gx : gx;
  const P = (f: number, h: number): Pt => ({ x: at.x + gx * f * size + hx * (h - 0.1) * size, y: at.y + gy * f * size + hy * (h - 0.1) * size });
  const pts: number[] = [];
  for (let i = 0; i < WOLF.length; i += 2) { const q = P(WOLF[i], WOLF[i + 1]); pts.push(q.x, q.y); }
  return { pts, eye: P(-0.3, 0.14), nape: P(-0.95, 0.05) };
}

export const THUNDERFANGS: Signature = {
  shake: 1.7,
  // It does not lunge: the pack runs for it.
  lunge: false,

  deliver(t: FxTools, m, seconds) {
    const T = seconds, s = m.size, k = s / 90, c0 = centre(m.from), f = fierce(m), runs = pack(m);
    const GO = 0.24; // the pack breaks from the boss here
    const size = s * (0.5 + 0.12 * f);

    // THE GATHERING: static crawling over the boss's card, wind whirling in.
    let beat = -1, rim: number[][] = [];
    t.draw(T * 0.45, (g, u) => {
      const time = u * T * 0.45, b = Math.floor(time / BEAT);
      if (b !== beat) {
        beat = b;
        rim = [];
        for (let i = 0; i < 3 + Math.round(3 * f); i++) {
          const a = rand(0, TAU), r = s * 0.46, a1 = a + rand(0.3, 0.7) * (Math.random() < 0.5 ? -1 : 1);
          const A = { x: c0.x + Math.cos(a) * r, y: c0.y + Math.sin(a) * r }, B = { x: c0.x + Math.cos(a1) * r, y: c0.y + Math.sin(a1) * r };
          rim.push(crackle(A, { x: (A.x + B.x) / 2 + (A.x + B.x - 2 * c0.x) * 0.3, y: (A.y + B.y) / 2 + (A.y + B.y - 2 * c0.y) * 0.3 }, B, 4, s * 0.05));
        }
      }
      lightning(g, rim, 1.5, Math.sin(Math.PI * u) * rand(0.6, 1));
      for (let i = 0; i < 3; i++) {
        const a = i * (TAU / 3) + time * 9, r = s * (0.95 - 0.45 * u);
        g.moveTo(c0.x + Math.cos(a) * r, c0.y + Math.sin(a) * r).arc(c0.x, c0.y, r, a, a + 1.2)
          .stroke({ width: 2.4, color: i % 2 ? PEACH : CREAM, alpha: 0.8 * Math.sin(Math.PI * u), cap: "round" });
      }
    });
    t.emit({ count: 18, palette: [CREAM, PEACH, AMBER], from: m.from, at: "ring", speed: [120, 200], gravity: 0, drag: 1,
      life: [0.2, T * 0.3], size: [8, 2], streak: true, swirl: 900 });
    // Stormform's storm answers it: a bolt out of the sky onto the boss.
    if (f > 0.35) t.later(T * 0.06, () => t.bolt({ x: c0.x + rand(-0.3, 0.3) * s, y: c0.y - s * 2.6 }, c0, WHITE, VIO, 0.28));
    // THE HOWL: a ring of air thrown out over the field as the pack breaks.
    t.later(T * GO * 0.8, () => {
      t.draw(0.45, (g, u) => {
        const e = easeOut(u);
        g.circle(c0.x, c0.y, s * (0.5 + 2.4 * e)).stroke({ width: 4 * (1 - u) + 1, color: CREAM, alpha: 0.7 * (1 - u) });
        g.circle(c0.x, c0.y, s * (0.4 + 1.8 * e)).stroke({ width: 1.5, color: LAV, alpha: 0.5 * (1 - u) });
      });
    });

    // THE PACK: a storm-wolf to every card in reach, racing out round the boss
    // and in onto its card, on it as the delivery ends.
    const D = T * (1 - GO);
    runs.forEach((w, n) => {
      const ph = n * 1.7, bodyLen = s * (0.9 + 0.3 * f);
      const head = (u: number) => { const e = u * (0.35 + 0.65 * u); return w.L * e; };
      let beatW = -1, body: number[][] = [], acc = 0;
      t.draw(D, (g, u, dt) => {
        const time = u * D, d = head(u), at = along(w, d), a = Math.min(1, u * 6);
        // The body of wind it trails: three streaks along the line it ran.
        for (const o of [-0.13, 0, 0.13]) {
          const pts: number[] = [];
          for (let j = 0; j <= 8; j++) {
            const q = along(w, d - s * 0.3 - (bodyLen * j) / 8), wob = o * s * (1 - j / 10) + Math.sin(time * 20 + j + ph) * s * 0.02;
            pts.push(q.x - q.uy * wob, q.y + q.ux * wob);
          }
          g.poly(pts, false).stroke({ width: o ? 1.6 : 2.6, color: o ? PEACH : CREAM, alpha: (o ? 0.5 : 0.7) * a, cap: "round" });
        }
        // Lightning crackling down its spine.
        const b = Math.floor(time / BEAT);
        if (b !== beatW) {
          beatW = b;
          const n0 = along(w, d - s * 0.35), n1 = along(w, d - s * 0.35 - bodyLen * 0.9);
          body = [crackle(n0, { x: (n0.x + n1.x) / 2, y: (n0.y + n1.y) / 2 }, n1, 5, s * (0.08 + 0.05 * f))];
        }
        lightning(g, body, 1.4 + 0.6 * f, a * rand(0.55, 1));
        // The head: pale storm-light, rimmed white, a burning eye.
        const h = wolfHead(at, w.side, size, time, ph);
        g.poly(h.pts).fill({ color: STORM, alpha: 0.55 * a }).stroke({ width: 1.6, color: WHITE, alpha: 0.95 * a });
        g.circle(h.eye.x, h.eye.y, size * 0.13).fill({ color: VIO, alpha: 0.4 * a });
        g.circle(h.eye.x, h.eye.y, Math.max(1.3, size * 0.05)).fill({ color: WHITE, alpha: a });
        // Dust kicked up by its run.
        acc += dt * 24 * t.quality;
        for (; acc >= 1; acc--) {
          const q = along(w, d - s * 0.5), v = rand(40, 100) * k, sd = Math.random() < 0.5 ? -1 : 1;
          t.spark(q.x, q.y, -q.uy * sd * v - q.ux * v * 0.4, q.ux * sd * v - q.uy * v * 0.4, rand(0.2, 0.35), EDDY);
        }
      }, { delay: T * GO });
    });
  },

  land(t: FxTools, m) {
    const s = m.size, k = s / 90, f = fierce(m), runs = pack(m), size = s * (0.5 + 0.12 * f);
    runs.forEach((w, n) => {
      // A ragged volley — but the first bite is on the landing frame itself,
      // or the pack would blink out between arriving and biting.
      const at = n * 0.035 + (n % 2) * 0.02;
      if (at <= 0) bite(t, w, s, k, size, f, m.power[w.i] ?? 1, n);
      else t.later(at, () => bite(t, w, s, k, size, f, m.power[w.i] ?? 1, n));
    });
  },
};

/** A wolf's bite: jaws of lightning — an upper fang and a lower, jagged,
 *  snapping shut on the card from the way the wolf came — the crackle held in
 *  the card, a flash, the pack's wind breaking over it, the wolf itself gone
 *  to static. Stormform's bites are wider, thicker, and the sky strikes too. */
function bite(t: FxTools, w: Run, s: number, k: number, size: number, f: number, power: number, n: number) {
  const p = w.p, end = along(w, w.L), ux = end.ux, uy = end.uy, nx = -uy, ny = ux;
  const kk = Math.max(0.7, Math.min(1.8, power)), jaw = s * (0.5 + 0.12 * f) * Math.min(1.3, kk);
  // Where each fang starts: behind and to either side of the card, the jaws open.
  const top = { x: p.x - ux * jaw * 0.9 + nx * jaw, y: p.y - uy * jaw * 0.9 + ny * jaw };
  const bot = { x: p.x - ux * jaw * 0.9 - nx * jaw, y: p.y - uy * jaw * 0.9 - ny * jaw };
  let beat = -1, fangs: number[][] = [];
  const D = 0.36;
  t.draw(D, (g, u) => {
    const time = u * D, shut = easeOut(clamp01(time / 0.07)), b = Math.floor(time / BEAT);
    if (b !== beat) {
      beat = b;
      fangs = [];
      for (const [from, side] of [[top, 1], [bot, -1]] as const) {
        // Each fang sweeps in along an arc and meets the other on the card.
        const tip = { x: p.x + (from.x - p.x) * (1 - shut) * 0.9, y: p.y + (from.y - p.y) * (1 - shut) * 0.9 };
        const ctl = { x: (from.x + tip.x) / 2 + nx * side * jaw * 0.35 + ux * jaw * 0.4, y: (from.y + tip.y) / 2 + ny * side * jaw * 0.35 + uy * jaw * 0.4 };
        fangs.push(crackle(from, ctl, tip, 6, s * 0.05));
      }
    }
    const lit = time < 0.07 ? 1 : [1, 0.35, 1, 0.8, 0.3, 0.9, 0.5, 0.2][Math.floor((time - 0.07) / BEAT) % 8] * (1 - span(time, 0.07, D));
    lightning(g, fangs, 2 + 1.2 * f, lit);
    // The wolf dissolving into its bite.
    const h = wolfHead({ x: p.x, y: p.y, ux, uy }, w.side, size * (1 + 0.5 * u), time, n * 1.7), gone = 1 - span(u, 0, 0.5);
    g.poly(h.pts).fill({ color: STORM, alpha: 0.4 * gone * gone }).stroke({ width: 1.4, color: WHITE, alpha: 0.8 * gone });
  });
  t.flash(p, LAV, 0.35 + 0.12 * kk + 0.1 * f);
  t.later(0.07, () => {
    t.arcs(p, [WHITE, LAV, VIO], (0.4 + 0.25 * f) * kk, 4 + Math.round(3 * f));
    t.ring(w.r, CREAM, 0.4, 1.2 * kk, 0.35, 3);
    t.glow(w.r, STORM, 0.28, 0.35, 1.0);
    for (let i = 0; i < Math.round((8 + 6 * f) * kk * t.quality); i++) {
      const a = rand(0, TAU), v = rand(220, 420) * k;
      t.spark(p.x, p.y, Math.cos(a) * v, Math.sin(a) * v, rand(0.1, 0.22), SNAP);
    }
    for (let i = 0; i < Math.round(6 * kk * t.quality); i++) {
      const a = Math.atan2(uy, ux) + rand(-0.8, 0.8), v = rand(140, 260) * k;
      t.spark(p.x, p.y, Math.cos(a) * v, Math.sin(a) * v, rand(0.25, 0.4), EDDY);
    }
  });
  // Stormform: the sky strikes the bitten card too.
  if (f > 0.35) t.later(0.1 + n * 0.02, () => t.bolt({ x: p.x + rand(-0.3, 0.3) * s, y: p.y - s * 2.4 }, p, WHITE, VIO, 0.26));
}
