/** OVERCLOCK — Production Run. "Stamp out 2 Firebolt Drones beside it, up to
 *  4 at once." Lore: "The line does not stop for losses. Losses are a
 *  scheduled output."
 *
 *  A spawn, so there is usually nothing to aim at and no DELIVERY: the
 *  LANDING is the whole shift. Overclock is a factory, and this is its press
 *  running — one stroke per drone, on a beat: KA-CHUNK, KA-CHUNK. A slab of a
 *  stamping die, steel with hazard stripes on its striking edge, drops onto
 *  the boss and slams: a flash off its face, sparks fanning out from under
 *  it, a shock running flat along the floor and steam off the hot metal. Out
 *  of each stroke a blank is ejected RED-HOT down a conveyor of current — two
 *  rails with the charge running along them, arcs crackling between — to the
 *  drone's square, where a frame is stamped down on it, riveted, glowing hot
 *  and cooling, crackling with the line's current. Then the die lifts for the
 *  next.
 *
 *  BOLT's lightning (its tribe) and PYRO's heat (its mechanic) in one
 *  machine: the current is violet-white and kinked, re-struck on a beat like
 *  all of BOLT's; the metal glows orange. With the line at its cap nothing
 *  comes out: the press still strokes, dry. Should the step ever reach an
 *  opponent, each takes a bolt off the line. */
import type { Graphics } from "pixi.js";
import { centre, lerpPt, rand } from "../looks/base";
import { AMBER, F_CORE, ORANGE } from "../looks/fire";
import type { FxTools, Pt, SparkStyle } from "../looks/types";
import type { Signature, SigMoment } from "./types";

type Box = { x: number; y: number; w: number; h: number };

const WHITE = 0xffffff, LAV = 0xe3d8ff, VIO = 0x9575ff, DEEP = 0x5b3bd6;
/** The die: its steel (normal blend), the sheen on its face and the light
 *  along its edges (additive), and steam off it. */
const STEEL = 0x14161c, SHEEN = 0x6d7689, EDGE = 0xc8cedb, STEAM = 0xd8dde8;
/** Sparks off a press stroke: hot, fast, falling. */
const HOT: SparkStyle = { palette: [WHITE, AMBER, ORANGE, 0xc2261a], gravity: 700, drag: 0.5, size: [7, 2], streak: true };
/** Static off the line: darts out and stops dead. */
const SNAP: SparkStyle = { palette: [WHITE, LAV, VIO], gravity: 0, drag: 0.001, size: [6, 1.5], streak: true };
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeOut = (x: number) => 1 - (1 - x) * (1 - x);
/** A repeatable 0..1 from a number: lightning re-kinked on a beat, not on
 *  every frame, so it looks the same at 30 Hz and 120. */
const hash = (n: number) => { const x = Math.sin(n * 12.9898 + 4.1414) * 43758.5453; return x - Math.floor(x); };

/** The press's beat: a stroke every BEAT s; the die falls in DROP, dwells on
 *  the stroke, and lifts; the blank runs down the line in RUN; lightning is
 *  re-struck every FLICK s. */
const BEAT = 0.3, DROP = 0.1, DWELL = 0.07, LIFT = 0.14, RUN = 0.18, FLICK = 0.035;

/** THE DIE's steel, centred on (x, y): the slab `w` by `h` and the ram it
 *  hangs from, on the dark layer — solid, so the die hides what it covers. */
function steel(gd: Graphics, x: number, y: number, w: number, h: number, alpha: number) {
  const top = y - h / 2, rw = w * 0.3, rh = h * 1.2;
  gd.rect(x - rw / 2, top - rh, rw, rh).fill({ color: STEEL, alpha: 0.9 * alpha });
  gd.roundRect(x - w / 2, top, w, h, h * 0.1).fill({ color: STEEL, alpha: 0.92 * alpha });
}

/** THE DIE's light, over its steel: lit on its face, bolted at the corners,
 *  hazard-striped along its striking edge — whose face glows hot (`hot`) as
 *  it strikes — and the current running in the ram. */
function die(g: Graphics, x: number, y: number, w: number, h: number, hot: number, alpha: number) {
  const l = x - w / 2, top = y - h / 2, rw = w * 0.3, rh = h * 1.2;
  // The ram, with the current running in it.
  g.rect(x - rw / 2, top - rh, rw, rh).fill({ color: SHEEN, alpha: 0.18 * alpha }).stroke({ width: 1.2, color: EDGE, alpha: 0.7 * alpha });
  for (const f of [0.3, 0.7])
    g.moveTo(x - rw * 0.3, top - rh * f).lineTo(x + rw * 0.3, top - rh * f).stroke({ width: 1.5, color: VIO, alpha: 0.9 * alpha });
  // The slab: sheen brightest high on its face, lit edges, bolts.
  g.roundRect(l, top, w, h, h * 0.1).fill({ color: SHEEN, alpha: 0.2 * alpha });
  g.rect(l + 3, top + 3, w - 6, h * 0.3).fill({ color: SHEEN, alpha: 0.22 * alpha });
  g.roundRect(l, top, w, h, h * 0.1).stroke({ width: 2, color: EDGE, alpha: 0.95 * alpha });
  for (const [bx, by] of [[0.08, 0.2], [0.92, 0.2], [0.08, 0.55], [0.92, 0.55]])
    g.circle(l + w * bx, top + h * by, h * 0.07).fill({ color: EDGE, alpha: 0.9 * alpha });
  // Hazard stripes along its striking edge.
  const sy = top + h * 0.7, sh = h * 0.24, n = 7, sw = w / n;
  for (let i = 0; i < n; i++) {
    const x0 = l + i * sw;
    g.poly([x0 + sw * 0.1, sy + sh, x0 + sw * 0.45, sy, x0 + sw * 0.9, sy, x0 + sw * 0.55, sy + sh]).fill({ color: i % 2 ? AMBER : ORANGE, alpha: 0.85 * alpha });
  }
  if (hot > 0.01) g.rect(l + 2, top + h - 4, w - 4, 5).fill({ color: F_CORE, alpha: hot * alpha });
}

/** A kinked line of current from a to b — lightning, not a curve — its kinks
 *  dealt by `beat` so it holds still between re-strikes. */
function current(g: Graphics, a: Pt, b: Pt, jag: number, width: number, color: number, alpha: number, beat: number) {
  const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len;
  const segs = Math.max(4, Math.round(len / 14));
  g.moveTo(a.x, a.y);
  let off = 0;
  for (let i = 1; i < segs; i++) {
    off = off * 0.5 + (hash(beat * 7.31 + i * 1.37 + a.x * 0.013) * 2 - 1);
    const f = i / segs, o = off * jag * Math.sin(Math.PI * f);
    g.lineTo(a.x + dx * f + nx * o, a.y + dy * f + ny * o);
  }
  g.lineTo(b.x, b.y).stroke({ width, color, alpha });
}

/** One stroke of the press on the boss at `c`, `at` s in, ejecting a blank
 *  to `to` (null: a dry stroke, the line at its cap). */
function stroke(t: FxTools, c: Pt, s: number, at: number, to: Box | null) {
  const w = s * 1.22, h = s * 0.52, hang = c.y - s * 0.75, strike = c.y + s * 0.03;
  const D = DROP + DWELL + LIFT;
  // THE DIE: down hard, a dwell on the stroke, and up again. Its steel and
  // its light are two draws that each work out where it is from the same
  // clock (neither leans on the other's Graphics: the layer ticks its effects
  // in its own order).
  const dieAt = (time: number) => ({
    y: time < DROP ? hang + (strike - hang) * Math.pow(time / DROP, 2)
      : time < DROP + DWELL ? strike : strike + (hang - strike) * easeOut((time - DROP - DWELL) / LIFT),
    hot: time < DROP ? 0 : Math.max(0, 1 - (time - DROP) / (DWELL + LIFT * 0.6)),
    alpha: Math.min(1, time * 25) * (time < D - LIFT * 0.4 ? 1 : 1 - (time - (D - LIFT * 0.4)) / (LIFT * 0.4)),
  });
  t.draw(D, (gd, u) => { const d = dieAt(u * D); steel(gd, c.x, d.y, w, h, d.alpha); }, { dark: true, delay: at });
  t.draw(D, (g, u) => { const d = dieAt(u * D); die(g, c.x, d.y, w, h, d.hot, d.alpha); }, { delay: at });
  // THE SLAM: a flash off its face, sparks fanning out from under it both
  // ways, a shock running flat along the floor, steam off the hot metal.
  const foot = strike + h / 2;
  t.later(at + DROP, () => {
    t.flash({ x: c.x, y: foot }, AMBER, 0.7 * (s / 90));
    for (let i = 0; i < Math.round(22 * Math.max(0.5, t.quality)); i++) {
      const side = i % 2 ? 1 : -1, a = rand(0.05, 0.6), v = rand(220, 460) * (s / 90);
      t.spark(c.x + side * w * 0.48, foot - 2, side * Math.cos(a) * v, -Math.sin(a) * v - rand(30, 90), rand(0.25, 0.45), { ...HOT, gravity: HOT.gravity * (s / 90) });
    }
    const puffs = Array.from({ length: 6 }, (_, i) => ({ side: i % 2 ? 1 : -1, v: rand(0.5, 1.1), r: rand(0.12, 0.2), lift: rand(0.3, 0.6) }));
    t.draw(0.55, (g, u) => {
      // The shock along the floor: a flat ring.
      const q = easeOut(Math.min(1, u / 0.5)), rx = s * (0.6 + 2 * q);
      g.ellipse(c.x, foot, rx, rx * 0.2).stroke({ width: 4 * (1 - q) + 1, color: EDGE, alpha: 0.8 * (1 - q) });
      for (const p of puffs) {
        const x = c.x + p.side * (w * 0.5 + s * p.v * easeOut(u)), y = foot - s * p.lift * u, rr = s * p.r * (0.6 + u);
        g.circle(x, y, rr).fill({ color: STEAM, alpha: 0.2 * Math.sin(Math.PI * u) });
      }
    });
    if (to) eject(t, c, foot, to, s);
  });
}

/** A blank ejected red-hot from under the press down a conveyor of current to
 *  its square, and a frame stamped down on it there, cooling and crackling. */
function eject(t: FxTools, c: Pt, foot: number, r: Box, s: number) {
  const p = centre(r), from = { x: c.x, y: foot - s * 0.12 };
  const dx = p.x - from.x, dy = p.y - from.y, len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len, gap = s * 0.13;
  const D = RUN + 0.42;
  t.draw(D, (g, u) => {
    const time = u * D, on = Math.min(1, time * 20), off = time < RUN + 0.12 ? 1 : 1 - (time - RUN - 0.12) / 0.3;
    const a = on * off, beat = Math.floor(time / FLICK);
    // The rails, a glow between them, and the charge running along both.
    g.moveTo(from.x, from.y).lineTo(p.x, p.y).stroke({ width: gap * 2.2, color: DEEP, alpha: 0.2 * a });
    for (const sd of [-1, 1])
      g.moveTo(from.x + nx * gap * sd, from.y + ny * gap * sd).lineTo(p.x + nx * gap * sd, p.y + ny * gap * sd)
        .stroke({ width: 2, color: LAV, alpha: 0.85 * a });
    for (let i = 0; i < 7; i++) {
      const f = (i / 7 + time * 3.2) % 1, q0 = lerpPt(from, p, f), q1 = lerpPt(from, p, Math.min(1, f + 0.05));
      g.moveTo(q0.x + nx * gap, q0.y + ny * gap).lineTo(q0.x - nx * gap, q0.y - ny * gap).stroke({ width: 1.5, color: VIO, alpha: 0.6 * a });
      for (const sd of [-1, 1])
        g.moveTo(q0.x + nx * gap * sd, q0.y + ny * gap * sd).lineTo(q1.x + nx * gap * sd, q1.y + ny * gap * sd)
          .stroke({ width: 3.5, color: WHITE, alpha: 0.95 * a });
    }
    // Arcs crackling down the middle.
    current(g, from, p, s * 0.08, 5, VIO, 0.35 * a, beat);
    current(g, from, p, s * 0.08, 1.6, WHITE, 0.85 * a, beat);
    // The blank: white-hot out of the press, cooling to orange on its run.
    if (time < RUN) {
      const e = easeOut(time / RUN), q = lerpPt(from, p, e), bw = s * 0.46, bh = s * 0.32;
      g.roundRect(q.x - bw * 0.8, q.y - bh * 0.8, bw * 1.6, bh * 1.6, bh * 0.45).fill({ color: ORANGE, alpha: 0.4 });
      g.roundRect(q.x - bw / 2, q.y - bh / 2, bw, bh, bh * 0.25).fill({ color: e < 0.55 ? F_CORE : AMBER, alpha: 0.95 })
        .stroke({ width: 1.5, color: WHITE, alpha: 0.8 });
    }
  });
  // STAMPED: a frame snapped down on the square as the blank arrives, riveted,
  // glowing hot and cooling, crackling with the line's current.
  t.later(RUN, () => {
    t.flash(p, AMBER, 0.6 * (s / 90));
    t.glow(r, ORANGE, 0.55, 0.7, 1.05);
    for (let i = 0; i < 10; i++) {
      const a = rand(0, Math.PI * 2), v = rand(160, 300) * (s / 90);
      t.spark(p.x + Math.cos(a) * s * 0.4, p.y + Math.sin(a) * s * 0.4, Math.cos(a) * v, Math.sin(a) * v, rand(0.1, 0.2), SNAP);
    }
    t.draw(0.62, (g, u) => {
      const snap = easeOut(clamp01(u / 0.1)), sc = 1.35 - 0.35 * snap;
      const w = r.w * 0.94 * sc, h = r.h * 0.94 * sc, a = u < 0.15 ? 1 : 1 - (u - 0.15) / 0.85;
      const col = u < 0.2 ? WHITE : u < 0.45 ? AMBER : ORANGE;
      if (u < 0.12) g.rect(p.x - w / 2, p.y - h / 2, w, h).fill({ color: AMBER, alpha: 0.3 * (1 - u / 0.12) });
      g.rect(p.x - w / 2, p.y - h / 2, w, h).stroke({ width: 7, color: ORANGE, alpha: 0.35 * a }).stroke({ width: 2.5, color: col, alpha: 0.95 * a });
      // Rivets at the corners: it was pressed, not drawn.
      for (const [cx, cy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]])
        g.circle(p.x + (cx * w) / 2, p.y + (cy * h) / 2, s * 0.045).fill({ color: F_CORE, alpha: a });
      const beat = Math.floor((u * 0.62) / FLICK);
      if (u < 0.6 && beat % 3 === 0) {
        const e = beat % 4, x0 = p.x + (e % 2 ? w / 2 : -w / 2), y0 = p.y + (e < 2 ? -h / 2 : h / 2);
        current(g, { x: x0, y: y0 }, { x: x0 + (hash(beat) - 0.5) * s * 0.6, y: y0 + (hash(beat + 0.5) - 0.5) * s * 0.6 }, s * 0.05, 1.6, LAV, 0.9 * (1 - u), beat);
      }
    });
  });
}

export const OVERCLOCK: Signature = {
  shake: 1.5,
  // It is a production line: it stays where it is and runs.
  lunge: false,

  deliver(t: FxTools, m: SigMoment, seconds: number) {
    // Only when the step reached an opponent: the line spinning up — current
    // crawling in over the boss, the charge building.
    const c = centre(m.from), s = m.size, T = seconds;
    t.charge(c, s * 1.3, VIO, 0.5, T);
    t.draw(T, (g, u) => {
      const beat = Math.floor((u * T) / FLICK);
      for (let i = 0; i < 3; i++) {
        const a = hash(beat + i * 3.3) * Math.PI * 2;
        current(g, { x: c.x + Math.cos(a) * s * 0.45, y: c.y + Math.sin(a) * s * 0.45 }, c, s * 0.06, 1.5, LAV, 0.8 * u, beat + i);
      }
    });
  },

  land(t: FxTools, m: SigMoment) {
    const c = centre(m.from), s = m.size;
    // One stroke per drone stamped out — or one dry stroke with none.
    const out = m.spawned.length ? m.spawned : [null];
    out.forEach((r, j) => stroke(t, c, s, 0.04 + BEAT * j, r));
    t.charge(c, s * 1.2, DEEP, 0.3, 0.04 + BEAT * out.length);
    // Anything the step reached takes a bolt off the line.
    m.targets.forEach((r, i) => {
      const p = centre(r);
      t.later(0.1 + 0.05 * i, () => {
        t.bolt(c, p, WHITE, VIO, 0.3);
        t.arcs(p, [WHITE, LAV, VIO], 0.5 * Math.max(0.55, Math.min(1.5, m.power[i] ?? 1)), 4);
      });
    });
  },
};
