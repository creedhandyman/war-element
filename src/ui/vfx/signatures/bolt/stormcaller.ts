/** STORMCALLER — Chain Paralysis. "Deal 3 DMG to up to 3 opponents and
 *  PARALYZE them." It holds up to three, then it bills everything held.
 *
 *  His art is a robed sorcerer with his arms flung wide, standing inside a
 *  ring of GOLDEN lightning while a violet beam drives down onto him out of
 *  the storm. So the DELIVERY is that picture: a ring of gold lightning
 *  crackles up round his card, closing as it builds, and the violet beam
 *  strikes down onto him from above — the sky is up the screen whichever way
 *  the board faces, as it is on the card — and the ring flares as it takes
 *  the charge.
 *
 *  The LANDING is ONE chain, not a fan: gold lightning leaps from him to the
 *  nearest card, then on from that card to the next nearest, a beat a link,
 *  so you can follow it hop by hop. Where it lands a CAGE of gold lightning
 *  snaps shut round the card — a frame of crackling bars slammed in from
 *  outside, thin bars across its face — and holds, stuttering, as the
 *  paralysis, before it gutters out. Then the ring round him lets go.
 *
 *  Gold, not violet: the only violet in it is the beam he draws on. The
 *  lightning keeps looks/bolt.ts's rules — kinked lines, never curves, a
 *  stutter on a fixed beat, never a smooth fade. */
import { centre, rand } from "../../looks/base";
import type { Graphics } from "pixi.js";
import type { FxTools, Pt, SparkStyle } from "../../looks/types";
import type { Signature, SigMoment } from "../types";

type Box = SigMoment["from"];

const TAU = Math.PI * 2;
/** His lightning: white-hot, pale gold, gold, amber at the halo's edge. */
const WHITE = 0xffffff, GOLD_HI = 0xfff3a8, GOLD = 0xffd23c, AMBER = 0xffa424;
/** The storm's beam he draws on: the one violet in the move. */
const LAV = 0xe3d8ff, VIO = 0x9575ff;
/** One flicker beat, s, and a strike's brightness beat by beat: re-strokes,
 *  not a fade (looks/bolt.ts). */
const BEAT = 0.035;
const FLICKER = [1, 0.3, 1, 0.8, 0.25, 0.95, 0.5, 0.15, 0.7, 0.35, 0.1, 0.5];
/** A cage holding: never quite steady, never quite out — a current that
 *  will not let go. */
const HOLD = [1, 0.7, 0.95, 0.55, 1, 0.85, 0.6, 0.9];
/** Static: darts out hard and stops dead. Gold. */
const SNAP: SparkStyle = { palette: [WHITE, GOLD_HI, GOLD, AMBER], gravity: 0, drag: 0.0008, size: [6, 1.5], streak: true };
/** Finer gold static drawn in round the ring as it builds. */
const FIZZ: SparkStyle = { palette: [WHITE, GOLD_HI, GOLD], gravity: 0, drag: 0.002, size: [4, 1], streak: true };
/** Violet static off the beam where it hits him. */
const VSNAP: SparkStyle = { palette: [WHITE, LAV, VIO], gravity: 0, drag: 0.0008, size: [6, 1.5], streak: true };

/** One link of the chain, s apart. */
const LINK = 0.11;
/** How long a cage holds before it gutters out, s. */
const CAGE = 0.62;

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeOut = (x: number) => 1 - (1 - x) * (1 - x);

/** How lit a strike is `since` s after it lands, lasting `dur`. */
function flicker(since: number, dur: number): number {
  if (since < 0 || since >= dur) return 0;
  return FLICKER[Math.floor(since / BEAT) % FLICKER.length] * Math.sqrt(1 - since / dur);
}

// ── Drawing lightning ───────────────────────────────────────────────────────

/** A lightning channel from a to b, pinned at both ends: `segs` uneven steps,
 *  kinked up to `jag` px across by a walk, so it meanders AND turns sharp. */
function channel(ax: number, ay: number, bx: number, by: number, segs: number, jag: number): number[] {
  const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len;
  const out = [ax, ay];
  let off = 0;
  for (let i = 1; i < segs; i++) {
    off = off * 0.5 + rand(-1, 1);
    const f = (i + rand(-0.3, 0.3)) / segs, o = off * jag * Math.sqrt(Math.sin((Math.PI * i) / segs));
    out.push(ax + dx * f + nx * o, ay + dy * f + ny * o);
  }
  out.push(bx, by);
  return out;
}

/** Flat points as one open path, up to fraction `f` of it. */
function trace(g: Graphics, p: number[], f = 1) {
  const n = p.length / 2, reach = f * (n - 1), full = Math.min(n - 1, Math.floor(reach));
  if (n < 2 || reach <= 0) return;
  g.moveTo(p[0], p[1]);
  for (let i = 1; i <= full; i++) g.lineTo(p[i * 2], p[i * 2 + 1]);
  const frac = reach - full;
  if (frac > 0 && full + 1 < n) {
    const i = full * 2;
    g.lineTo(p[i] + (p[i + 2] - p[i]) * frac, p[i + 1] + (p[i + 3] - p[i + 1]) * frac);
  }
}

/** Lightning stroked: a wide halo, a tighter one, then a thin hot core. Gold
 *  by default; the doubled halo is what keeps gold reading as gold rather
 *  than washing out to white. */
function zap(g: Graphics, paths: number[][], width: number, alpha: number, f = 1, core = WHITE, halo = GOLD) {
  if (alpha <= 0.02 || paths.length === 0) return;
  const a = Math.min(1, alpha);
  for (const p of paths) trace(g, p, f);
  g.stroke({ width: width * 4, color: halo, alpha: 0.3 * a, join: "round", cap: "round" });
  for (const p of paths) trace(g, p, f);
  g.stroke({ width: width * 1.8, color: halo, alpha: 0.75 * a, join: "round", cap: "round" });
  for (const p of paths) trace(g, p, f);
  g.stroke({ width, color: core, alpha: a, join: "bevel", cap: "round" });
}

/** A hard flash sized to the squares, in and gone in a blink. */
function blink(t: FxTools, p: Pt, size: number, color: number, peak: number, seconds: number) {
  t.glow({ x: p.x - size / 2, y: p.y - size / 2, w: size, h: size }, color, peak, seconds, 1);
}

/** `n` snaps out of a point, all round. */
function snaps(t: FxTools, c: Pt, n: number, speed: number, st: SparkStyle = SNAP) {
  for (let i = 0; i < n; i++) {
    const a = rand(0, TAU), v = speed * rand(0.45, 1);
    t.spark(c.x, c.y, Math.cos(a) * v, Math.sin(a) * v, rand(0.1, 0.24), st);
  }
}

/** A closed ring of lightning round `c`, `R` across, in `n` kinked steps —
 *  the radius jumping in and out, never a circle. */
function ringPath(c: Pt, R: number, n: number, jag: number, a0: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = a0 + (i / n) * TAU, rr = R + rand(-jag, jag);
    out.push(c.x + Math.cos(a) * rr, c.y + Math.sin(a) * rr);
  }
  out.push(out[0], out[1]);
  return out;
}

// ── The chain and the cage ──────────────────────────────────────────────────

/** The chain's order: from him to the nearest card, then from each card to
 *  the nearest one not yet held — so every link is a short hop, as a real
 *  chain of lightning jumps. */
function chainOf(m: SigMoment): number[] {
  const left = m.targets.map((_, i) => i), out: number[] = [];
  let at = centre(m.from);
  while (left.length) {
    let bi = 0, bd = Infinity;
    left.forEach((i, k) => {
      const p = centre(m.targets[i]), d = Math.hypot(p.x - at.x, p.y - at.y);
      if (d < bd) { bd = d; bi = k; }
    });
    const i = left.splice(bi, 1)[0];
    out.push(i);
    at = centre(m.targets[i]);
  }
  return out;
}

/** One link of the chain: the channel from `a` to `b` lit all at once, its
 *  forks peeling off, re-struck every other beat and stuttering out. */
function link(t: FxTools, a: Pt, b: Pt, s: number, delay: number, width: number) {
  const d = Math.hypot(b.x - a.x, b.y - a.y) || 1, segs = Math.max(5, Math.min(12, Math.round(d / (s * 0.28))));
  const dir = Math.atan2(b.y - a.y, b.x - a.x);
  const D = 0.46;
  let main: number[][] = [], forks: number[][] = [], beat = -1;
  t.draw(D, (g, u) => {
    const time = u * D, bt = Math.floor(time / BEAT);
    if (bt !== beat && bt % 2 === 0) {
      beat = bt;
      const p = channel(a.x, a.y, b.x, b.y, segs, Math.min(s * 0.22, 4 + d * 0.06));
      main = [p];
      forks = [];
      for (let k = 0; k < 2; k++) {
        const v = 1 + Math.floor(rand(0.2, 0.8) * (p.length / 2 - 2));
        const fd = dir + (k ? 1 : -1) * rand(0.4, 0.9), fl = d * rand(0.12, 0.22);
        const x = p[v * 2], y = p[v * 2 + 1];
        forks.push(channel(x, y, x + Math.cos(fd) * fl, y + Math.sin(fd) * fl, 3, fl * 0.25));
      }
    }
    // The stutter, over a dim ghost of the link that stays a moment: you can
    // still trace the chain hop by hop after it has jumped on.
    const lit = Math.max(flicker(time, D * 0.75), 0.3 * (1 - u));
    zap(g, main, width, lit * 1.1);
    zap(g, forks, width * 0.55, flicker(time, D * 0.6) * 0.8);
  }, { delay });
}

/** THE CAGE snapping shut round a card: a frame of gold lightning slammed in
 *  from outside onto the card's edge, then thin bars struck down across its
 *  face, holding and stuttering for `CAGE`, then guttering out. The bars stay
 *  thin and few so the card still reads through them. */
function cage(t: FxTools, r: Box, s: number, power: number, delay: number) {
  const c = centre(r), k = Math.max(0.8, Math.min(1.3, power + 0.25));
  const hw = r.w * 0.54, hh = r.h * 0.54;
  const D = CAGE + 0.16, SNAPIN = 0.06;
  let frame: number[][] = [], bars: number[][] = [], beat = -1;
  t.draw(D, (g, u) => {
    const time = u * D, bt = Math.floor(time / BEAT);
    // Slammed in from half again its size.
    const q = clamp01(time / SNAPIN), sc = time < SNAPIN ? 1.5 - 0.5 * easeOut(q) : 1;
    const x0 = c.x - hw * sc, x1 = c.x + hw * sc, y0 = c.y - hh * sc, y1 = c.y + hh * sc;
    if (bt !== beat) {
      beat = bt;
      const j = s * 0.035;
      frame = [
        channel(x0, y0, x1, y0, 5, j), channel(x1, y0, x1, y1, 5, j),
        channel(x1, y1, x0, y1, 5, j), channel(x0, y1, x0, y0, 5, j),
      ];
      bars = [];
      for (let i = 1; i <= 3; i++) {
        const bx = x0 + ((x1 - x0) * i) / 4;
        bars.push(channel(bx, y0, bx, y1, 5, s * 0.03));
      }
    }
    let lit: number;
    if (time < SNAPIN) lit = 0.7 + 0.3 * q;
    else if (time < CAGE) lit = HOLD[bt % HOLD.length];
    else lit = flicker(time - CAGE + BEAT * 2, D - CAGE + BEAT * 2) * 0.9;
    zap(g, frame, 1.8 * k, lit);
    // The bars come down across it just after the frame lands.
    const fb = clamp01((time - SNAPIN * 0.6) / 0.07);
    if (fb > 0) zap(g, bars, 1.0 * k, lit * 0.7, fb);
    // A brace at each corner: a cage, not a glow.
    for (const [x, y] of [[x0, y0], [x1, y0], [x1, y1], [x0, y1]])
      g.circle(x, y, Math.max(1.5, s * 0.035)).fill({ color: GOLD_HI, alpha: 0.9 * lit });
  }, { delay });
  // The slam: a gold blink and static snapping off the frame.
  t.later(delay + SNAPIN, () => {
    blink(t, c, s * 1.35, GOLD, 0.42, 0.16);
    const v = s / 90;
    for (let i = 0; i < Math.round(9 * k); i++) {
      const side = Math.floor(rand(0, 4)), f = rand(-1, 1);
      const x = c.x + (side < 2 ? f * hw : side === 2 ? -hw : hw), y = c.y + (side < 2 ? (side === 0 ? -hh : hh) : f * hh);
      const a = Math.atan2(y - c.y, x - c.x) + rand(-0.5, 0.5), sp = rand(140, 280) * v;
      t.spark(x, y, Math.cos(a) * sp, Math.sin(a) * sp, rand(0.1, 0.2), SNAP);
    }
  });
  // Held: static keeps snapping off the bars while it holds.
  let acc = 0;
  t.draw(CAGE, (_g, _u, dt) => {
    acc += dt * 16 * t.quality;
    for (; acc >= 1; acc--) {
      const x = c.x + rand(-hw, hw), y = c.y + (Math.random() < 0.5 ? -hh : hh), a = rand(0, TAU), sp = rand(80, 160) * (s / 90);
      t.spark(x, y, Math.cos(a) * sp, Math.sin(a) * sp, rand(0.08, 0.16), FIZZ);
    }
  }, { delay: delay + SNAPIN });
}

export const STORMCALLER: Signature = {
  shake: 0.8,
  // He calls it down where he stands.
  lunge: false,

  deliver(t: FxTools, m: SigMoment, seconds: number) {
    const s = m.size, c = centre(m.from), T = seconds, v = s / 90;
    // THE RING crackling up round him: laid round his card a little more each
    // beat, then whole, brightening, closing in a touch as it builds.
    const R0 = s * 0.7, a0 = rand(0, TAU);
    let ring: number[] = [], beat = -1;
    t.draw(T + 0.08, (g, u) => {
      const time = u * (T + 0.08), bt = Math.floor(time / BEAT), k = clamp01(time / T);
      if (bt !== beat) {
        beat = bt;
        ring = ringPath(c, R0 * (1 - 0.1 * easeOut(k)), 16, s * 0.07, a0 + rand(-0.05, 0.05));
      }
      zap(g, [ring], 1.5 + 1.3 * k, (0.45 + 0.55 * k) * rand(0.6, 1), clamp01(time / (T * 0.45)));
    });
    // Gold static drawn in to the ring as it builds.
    let acc = 0;
    t.draw(T, (_g, u, dt) => {
      acc += dt * 40 * t.quality * (0.4 + u);
      for (; acc >= 1; acc--) {
        const a = rand(0, TAU), R = R0 * rand(1.15, 1.4), sp = rand(120, 220) * v;
        t.spark(c.x + Math.cos(a) * R, c.y + Math.sin(a) * R, -Math.cos(a) * sp, -Math.sin(a) * sp, rand(0.08, 0.14), FIZZ);
      }
    });
    t.charge(c, s * 1.3, GOLD, 0.35, T);

    // THE BEAM driving down onto him out of the storm: a violet column struck
    // from above the card, held and stuttering, with a violet flash where it
    // meets him.
    const HIT = T * 0.38, D = T - HIT + 0.05;
    const top = { x: c.x + rand(-0.1, 0.1) * s, y: c.y - s * 2.6 };
    let beam: number[][] = [], forks: number[][] = [], bb = -1;
    t.draw(D, (g, u) => {
      const time = u * D, bt = Math.floor(time / BEAT);
      if (bt !== bb) {
        bb = bt;
        const p = channel(top.x, top.y, c.x, c.y - s * 0.05, 7, s * 0.12);
        beam = [p];
        forks = [];
        for (let k = 0; k < 2; k++) {
          const vi = 2 + Math.floor(rand(0, 4)), x = p[vi * 2], y = p[vi * 2 + 1];
          const fa = Math.PI / 2 + (k ? 1 : -1) * rand(0.4, 0.8), fl = s * rand(0.3, 0.5);
          forks.push(channel(x, y, x + Math.cos(fa) * fl, y + Math.sin(fa) * fl, 3, fl * 0.25));
        }
      }
      const lit = Math.max(0.35, FLICKER[bt % FLICKER.length]) * (1 - 0.5 * clamp01((time - D + 0.12) / 0.12));
      // A wide soft column under the strike, so it reads as a beam, not a fork.
      g.moveTo(top.x, top.y).lineTo(c.x, c.y).stroke({ width: s * 0.34, color: VIO, alpha: 0.2 * lit, cap: "round" });
      g.moveTo(top.x, top.y).lineTo(c.x, c.y).stroke({ width: s * 0.13, color: LAV, alpha: 0.22 * lit, cap: "round" });
      zap(g, beam, 3, lit, 1, WHITE, VIO);
      zap(g, forks, 1.4, lit * 0.7, 1, LAV, VIO);
    }, { delay: HIT });
    t.later(HIT, () => {
      blink(t, c, s * 1.3, VIO, 0.5, 0.2);
      snaps(t, c, 8, 260 * v, VSNAP);
    });
  },

  land(t: FxTools, m: SigMoment) {
    const s = m.size, home = centre(m.from), v = s / 90;
    // The ring lets go as the chain leaves him.
    blink(t, home, s * 1.5, GOLD, 0.45, 0.18);
    t.ring(m.from, GOLD_HI, 0.9, 1.6, 0.3, 3);
    snaps(t, home, 8, 240 * v);

    let prev = home;
    chainOf(m).forEach((i, n) => {
      const r = m.targets[i], p = centre(r), power = m.power[i] ?? 1, at = n * LINK;
      // Leaves from the edge of the card it came off, lands on the next.
      const d = Math.hypot(p.x - prev.x, p.y - prev.y) || 1, ux = (p.x - prev.x) / d, uy = (p.y - prev.y) / d;
      const a = { x: prev.x + ux * s * (n === 0 ? 0.6 : 0.3), y: prev.y + uy * s * (n === 0 ? 0.6 : 0.3) };
      link(t, a, p, s, at, 2.2 + 0.6 * Math.min(1.5, power));
      t.later(at, () => {
        blink(t, p, s * 0.9, GOLD_HI, 0.4, 0.1);
        snaps(t, p, 7, 260 * v);
      });
      cage(t, r, s, power, at + 0.02);
      if (m.killed[i]) {
        // A card that dies in the cage shorts out inside it.
        t.later(at + 0.2, () => {
          blink(t, p, s * 1.2, AMBER, 0.45, 0.25);
          snaps(t, p, 14, 320 * v);
        });
      }
      prev = p;
    });
  },
};
