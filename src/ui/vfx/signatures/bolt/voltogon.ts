/** VOLTOGON — Gigavolt Strike. "Deal 11 DMG and heal self 11 HP." The only
 *  dragon on the payroll, and the strike heals it with what it hits.
 *
 *  Its art is a black mechanical dragon, violet light burning through the
 *  seams of its plating, red spines and red eyes, wings spread, breathing a
 *  blinding violet-white beam of lightning that blasts the street to rubble.
 *  So the DELIVERY is the breath drawn in: two red eyes light at the card's
 *  front edge, violet light gathers in the throat between them, static is
 *  dragged into the maw, and lightning runs down the spine to it, pulse after
 *  pulse, each arriving brighter.
 *
 *  The LANDING is the BREATH, and it is a beam, not a bolt: a thick river of
 *  lightning from the maw to the target, held for a third of a second. Its
 *  edges are torn and re-torn every beat, braided channels crackle down its
 *  length and forks peel off its sides, while the card at the far end is
 *  blasted (black rubble with lit edges flung back, sparks sprayed). Then the
 *  current turns round: bright beads of charge run BACK up the narrowing beam
 *  into Voltogon, and its own card surges violet, rings closing on it, its
 *  seams lit and charge lifting off it: the 11 HP it took. A kill shatters
 *  the target into violet shards before the current comes home.
 *
 *  Lightning keeps looks/bolt.ts's rules (kinked lines, a stutter on a fixed
 *  beat), but the breath is SUSTAINED: it holds at full and only shivers,
 *  where a bolt strikes and dies. Violet-white with the red of its eyes: BOLT's
 *  dragon, not its storm. */
import { centre, rand } from "../../looks/base";
import type { Graphics } from "pixi.js";
import type { FxTools, Pt, SparkStyle } from "../../looks/types";
import type { Signature, SigMoment } from "../types";

type Box = SigMoment["from"];

const TAU = Math.PI * 2;
// The breath: white-hot to lavender to violet to the deep of the seams.
const WHITE = 0xffffff, LAV = 0xe3d8ff, VIO = 0x9575ff, DEEP = 0x5b3bd6;
// Its eyes.
const RED = 0xff3b4a, RED_HI = 0xffb0b4;
// The plate the breath tears up: dark layer only.
const PLATE = 0x0a0614;
/** One flicker beat, s, and a struck channel's brightness beat by beat. */
const BEAT = 0.035;
const FLICKER = [1, 0.35, 1, 0.8, 0.3, 0.95, 0.55, 0.2, 0.75, 0.4, 0.15, 0.55];
/** Static: darts out hard and stops dead. */
const SNAP: SparkStyle = { palette: [WHITE, LAV, VIO], gravity: 0, drag: 0.0008, size: [6, 1.5], streak: true };
/** Static dragged into the maw as it charges. */
const INTAKE: SparkStyle = { palette: [LAV, VIO, WHITE], gravity: 0, drag: 1, size: [2, 4.5], streak: true };
/** Sprayed off the blasted card: hot, falling a little. */
const BLAST: SparkStyle = { palette: [WHITE, LAV, VIO, DEEP], gravity: 220, drag: 0.4, size: [5, 1.5], streak: true };
/** Charge lifting off Voltogon as the current comes home: the heal. */
const SURGE: SparkStyle = { palette: [WHITE, LAV, VIO], gravity: -260, drag: 0.4, size: [6, 2], streak: true };

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeOut = (x: number) => 1 - (1 - x) * (1 - x);
/** 0 -> 1 as `x` runs from `a` to `b`. */
const span = (x: number, a: number, b: number) => clamp01((x - a) / (b - a));

/** The breath's timeline, s from the landing: held at full to HOLD, thinning
 *  as the current runs back, gone at END; the beads reach home at HOME. */
const HOLD = 0.24, END = 0.44, HOME = 0.46;

// ── Lightning ────────────────────────────────────────────────────────────────

/** How lit a strike is `since` s after it lands, lasting `dur`. */
function flicker(since: number, dur: number): number {
  if (since < 0 || since >= dur) return 0;
  return FLICKER[Math.floor(since / BEAT) % FLICKER.length] * Math.sqrt(1 - since / dur);
}

/** A lightning channel from a to b, pinned at both ends: `segs` uneven steps,
 *  kinked up to `jag` px across by a walk. */
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
  g.moveTo(p[0], p[1]);
  for (let i = 1; i <= full; i++) g.lineTo(p[i * 2], p[i * 2 + 1]);
  const frac = reach - full;
  if (frac > 0 && full + 1 < n) {
    const i = full * 2;
    g.lineTo(p[i] + (p[i + 2] - p[i]) * frac, p[i + 1] + (p[i + 3] - p[i + 1]) * frac);
  }
}

/** Lightning stroked: a wide violet halo, then a thin white-hot core. */
function zap(g: Graphics, paths: number[][], width: number, alpha: number, f = 1) {
  if (alpha <= 0.02 || paths.length === 0) return;
  const a = Math.min(1, alpha);
  for (const p of paths) trace(g, p, f);
  g.stroke({ width: width * 4, color: VIO, alpha: 0.3 * a, join: "round", cap: "round" });
  for (const p of paths) trace(g, p, f);
  g.stroke({ width, color: WHITE, alpha: a, join: "bevel", cap: "round" });
}

/** A flash sized to the board's squares (`flash` is sized in px). */
function flare(t: FxTools, p: Pt, size: number, color: number, peak: number, seconds: number) {
  t.glow({ x: p.x - size / 2, y: p.y - size / 2, w: size, h: size }, color, peak, seconds, 1);
}

// ── The dragon ──────────────────────────────────────────────────────────────

type Head = ReturnType<typeof head>;

/** Where it breathes from, and which way: the maw on the card's edge facing
 *  the target, the spine running back across the card behind it, and an eye
 *  either side of the throat. */
function head(m: SigMoment) {
  const c = centre(m.from), s = m.size;
  const p = m.targets.length ? centre(m.targets[0]) : { x: c.x + m.ahead.x * s, y: c.y + m.ahead.y * s };
  const ang = Math.atan2(p.y - c.y, p.x - c.x), ux = Math.cos(ang), uy = Math.sin(ang), nx = -uy, ny = ux;
  const maw = { x: c.x + ux * s * 0.34, y: c.y + uy * s * 0.34 };
  const tail = { x: c.x - ux * s * 0.42 + nx * s * 0.08, y: c.y - uy * s * 0.42 + ny * s * 0.08 };
  const eyes: Pt[] = [-1, 1].map((k) => ({ x: c.x + ux * s * 0.2 + nx * k * s * 0.13, y: c.y + uy * s * 0.2 + ny * k * s * 0.13 }));
  return { c, s, p, ang, ux, uy, nx, ny, maw, tail, eyes };
}

/** Its red eyes, lit for `dur` s at `lit(time)`: a slit of red with a hot
 *  centre, angled along the line of the breath. */
function redEyes(t: FxTools, H: Head, dur: number, lit: (time: number) => number) {
  t.draw(dur, (g, u) => {
    const k = lit(u * dur);
    if (k <= 0.01) return;
    for (const e of H.eyes) {
      const L = H.s * 0.075, W = H.s * 0.026;
      g.circle(e.x, e.y, H.s * 0.08).fill({ color: RED, alpha: 0.22 * k });
      g.poly([e.x - H.ux * L, e.y - H.uy * L, e.x + H.nx * W, e.y + H.ny * W, e.x + H.ux * L, e.y + H.uy * L, e.x - H.nx * W, e.y - H.ny * W], true)
        .fill({ color: RED, alpha: 0.95 * k });
      g.circle(e.x, e.y, H.s * 0.016).fill({ color: RED_HI, alpha: k });
    }
  });
}

/** Lightning running down the spine to the maw: a kinked channel from the
 *  tail end of the card to the throat, lit as a pulse that travels along it
 *  (the head of the pulse bright, the run behind it a violet ghost). One pulse
 *  every `every` s, each brighter than the last as the charge builds. */
function spine(t: FxTools, H: Head, dur: number, every: number) {
  let path: number[] = [], beat = -1;
  t.draw(dur, (g, u) => {
    const time = u * dur, b = Math.floor(time / BEAT);
    if (b !== beat) {
      beat = b;
      path = channel(H.tail.x, H.tail.y, H.maw.x, H.maw.y, 7, H.s * 0.06);
    }
    const q = easeOut((time % every) / every), build = 0.45 + 0.55 * u;
    zap(g, [path], 1.3, 0.4 * build * rand(0.6, 1), q);
    const n = path.length / 2, j = Math.min(n - 2, Math.floor(q * (n - 1)));
    const seg = path.slice(Math.max(0, j - 1) * 2, (j + 2) * 2);
    if (seg.length >= 4) zap(g, [seg], 2.2, build);
  });
}

/** Black plate torn up by the breath, flung back from the card along `ang`:
 *  chunks on the dark layer, their edges lit violet, tumbling to a stop. */
function rubble(t: FxTools, p: Pt, s: number, ang: number, n: number, delay: number) {
  const D = 0.7;
  const bits = Array.from({ length: n }, () => {
    const a = ang + rand(-1.3, 1.3), v = rand(1.6, 3.4) * s, r = s * rand(0.035, 0.07);
    const sides = 4 + Math.floor(rand(0, 2)), pts: number[] = [];
    for (let i = 0; i < sides; i++) pts.push((i / sides) * TAU + rand(-0.3, 0.3), r * rand(0.6, 1.1));
    return { vx: Math.cos(a) * v, vy: Math.sin(a) * v, spin: rand(-12, 12), rot: rand(0, TAU), pts };
  });
  const shape = (g: Graphics, b: (typeof bits)[number], time: number) => {
    // Out fast, dragged to a stop: x = v (1 - e^-kt) / k.
    const f = (1 - Math.exp(-5 * time)) / 5, x = p.x + b.vx * f, y = p.y + b.vy * f, rot = b.rot + b.spin * f;
    const out: number[] = [];
    for (let i = 0; i < b.pts.length; i += 2) out.push(x + Math.cos(b.pts[i] + rot) * b.pts[i + 1], y + Math.sin(b.pts[i] + rot) * b.pts[i + 1]);
    return g.poly(out, true);
  };
  const fade = (u: number) => clamp01(u * 10) * (1 - span(u, 0.55, 1));
  t.draw(D, (g, u) => { for (const b of bits) shape(g, b, u * D).fill({ color: PLATE, alpha: 0.9 * fade(u) }); }, { dark: true, delay });
  t.draw(D, (g, u) => { for (const b of bits) shape(g, b, u * D).stroke({ width: 1.4, color: VIO, alpha: 0.9 * fade(u), join: "round" }); }, { delay });
}

/** A killed card shattering: violet shards struck out of it, spinning off. */
function shatter(t: FxTools, r: Box, s: number, delay: number) {
  const p = centre(r), D = 0.6;
  const shards = Array.from({ length: 9 }, (_, i) => ({
    a: (i / 9) * TAU + rand(-0.25, 0.25), v: rand(1.2, 2) * s, spin: rand(-9, 9), len: s * rand(0.1, 0.18), wid: s * rand(0.04, 0.07),
  }));
  t.draw(D, (g, u) => {
    const time = u * D, f = (1 - Math.exp(-4 * time)) / 4, al = 1 - span(u, 0.35, 1);
    for (const sh of shards) {
      const x = p.x + Math.cos(sh.a) * sh.v * f, y = p.y + Math.sin(sh.a) * sh.v * f, rot = sh.a + sh.spin * f;
      const cx = Math.cos(rot), sy = Math.sin(rot);
      g.poly([x + cx * sh.len, y + sy * sh.len, x - sy * sh.wid, y + cx * sh.wid, x - cx * sh.len * 0.6, y - sy * sh.len * 0.6, x + sy * sh.wid, y - cx * sh.wid], true)
        .fill({ color: VIO, alpha: 0.5 * al }).stroke({ width: 1.2, color: LAV, alpha: al, join: "miter" });
    }
  }, { delay });
  t.later(delay, () => {
    flare(t, p, s * 1.7, LAV, 0.7, 0.3);
    t.ring(r, LAV, 0.3, 1.3, 0.35, 3);
    for (let i = 0; i < 14; i++) {
      const a = rand(0, TAU), v = rand(160, 340) * (s / 90);
      t.spark(p.x, p.y, Math.cos(a) * v, Math.sin(a) * v, rand(0.12, 0.26), SNAP);
    }
  });
}

/** The current home in Voltogon's card: a violet surge drawn INTO it (rings
 *  closing on it), its seams lit with crawling static, charge lifting off. */
function surge(t: FxTools, r: Box, s: number, delay: number) {
  const c = centre(r), v = s / 90, D = 0.5, half = s * 0.4;
  t.later(delay, () => {
    flare(t, c, s * 1.5, VIO, 0.6, 0.4);
    flare(t, c, s * 0.8, LAV, 0.5, 0.2);
  });
  // Two rings closing in on the card: drawn in, not blown out.
  t.draw(0.36, (g, u) => {
    for (const lag of [0, 0.3]) {
      const q = span(u, lag, lag + 0.7);
      if (q <= 0 || q >= 1) continue;
      const R = s * (0.95 - 0.55 * easeOut(q));
      g.circle(c.x, c.y, R).stroke({ width: 8, color: VIO, alpha: 0.2 * (1 - q) });
      g.circle(c.x, c.y, R).stroke({ width: 2.5, color: LAV, alpha: 0.85 * (1 - q) });
    }
  }, { delay });
  // The seams of its plating lit: short kinked runs across the card face,
  // re-rolled every beat, stuttering out.
  let seams: number[][] = [], beat = -1;
  t.draw(D, (g, u) => {
    const b = Math.floor((u * D) / BEAT);
    if (b !== beat) {
      beat = b;
      seams = [];
      for (let i = 0; i < 4; i++) {
        const o = rand(-half, half) * 0.8, a0 = -half * rand(0.75, 1), a1 = half * rand(0.75, 1);
        seams.push(i % 2 ? channel(c.x + o, c.y + a0, c.x + o, c.y + a1, 4, s * 0.03) : channel(c.x + a0, c.y + o, c.x + a1, c.y + o, 4, s * 0.03));
      }
    }
    zap(g, seams, 1.3, flicker(u * D, D) * 1.1);
  }, { delay });
  let acc = 0;
  t.draw(0.4, (_g, u, dt) => {
    acc += 70 * (1 - u) * dt * t.quality;
    for (; acc >= 1; acc--) {
      const x = c.x + rand(-half, half), y = c.y + rand(-half, half) * 0.6 + s * 0.1;
      t.spark(x, y, rand(-20, 20) * v, -rand(120, 260) * v, rand(0.3, 0.5), SURGE);
    }
  }, { delay });
}

export const VOLTOGON: Signature = {
  shake: 1.1,
  // It hangs where it is and breathes: the beam is the reach.
  lunge: false,

  deliver(t: FxTools, m: SigMoment, seconds: number) {
    const H = head(m), T = seconds;
    // The eyes light first (stuttering on), then the throat between them fills.
    redEyes(t, H, T + 0.05, (time) => (time < 0.1 ? (Math.floor(time / BEAT) % 2 ? 0.3 : 1) * (time / 0.1) : 1));
    t.charge(H.maw, H.s * 1.2, VIO, 0.6, T);
    t.charge(H.maw, H.s * 0.55, LAV, 0.85, T);
    // Lightning running down the spine to the throat, pulse after pulse.
    spine(t, H, T, Math.max(0.12, T / 3));
    // Static dragged into the maw from ahead of it: the beam's path breathed in.
    let acc = 0;
    t.draw(T, (_g, u, dt) => {
      acc += (30 + 50 * u) * dt * t.quality;
      for (; acc >= 1; acc--) {
        const a = H.ang + rand(-1.3, 1.3), d = H.s * rand(0.35, 0.65), life = rand(0.1, 0.16);
        const x = H.maw.x + Math.cos(a) * d, y = H.maw.y + Math.sin(a) * d;
        t.spark(x, y, (H.maw.x - x) / life, (H.maw.y - y) / life, life, INTAKE);
      }
    });
  },

  land(t: FxTools, m: SigMoment) {
    if (!m.targets.length) return;
    const H = head(m), { s, maw, p } = H, v = s / 90;
    const power = Math.max(0.7, Math.min(2, m.power[0] ?? 1)), killed = m.killed[0] ?? false;
    const dx = p.x - maw.x, dy = p.y - maw.y, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, nx = -uy, ny = ux;
    const W = s * (0.34 + 0.08 * power);
    /** The beam's width at `time`: blasting out, held, thinning as it ends. */
    const width = (time: number) => W * easeOut(span(time, 0, 0.05)) * (1 - 0.85 * span(time, HOLD, END));
    /** How far from the maw it has reached at `time`. */
    const reach = (time: number) => easeOut(span(time, 0, 0.06));

    redEyes(t, H, END + 0.1, (time) => 1 - span(time, END - 0.05, END + 0.1));

    // THE BREATH: a river of lightning. Torn edges re-torn every beat, a
    // braided core, forks peeling off its sides.
    const N = Math.max(8, Math.round(L / (s * 0.11)));
    /** Each edge's half-width at each step along the beam, torn: narrow at
     *  the maw, full down the river, flaring where it hits. */
    const tear = (k: number) => {
      const out: number[] = [];
      for (let i = 0; i <= N; i++) {
        const q = i / N, taper = 0.45 + 0.55 * Math.min(1, q * 5) + 0.3 * span(q, 0.85, 1);
        out.push((k / 2) * taper * (1 + rand(-0.3, 0.3)), (k / 2) * taper * (1 + rand(-0.3, 0.3)));
      }
      return out;
    };
    let outer: number[] = [], inner: number[] = [], braids: number[][] = [], forks: number[][] = [], beat = -1;
    t.draw(END, (g, u) => {
      const time = u * END, w = width(time), f = reach(time), len = L * f;
      if (w < 0.5) return;
      const b = Math.floor(time / BEAT);
      if (b !== beat) {
        beat = b;
        outer = tear(1);
        inner = tear(0.42);
        braids = [0, 1, 2].map(() => channel(maw.x, maw.y, p.x, p.y, Math.max(6, Math.round(L / (s * 0.18))), s * 0.06));
        forks = [];
        for (let i = 0; i < 3; i++) {
          const q = rand(0.15, 0.85), side = Math.random() < 0.5 ? -1 : 1, a = Math.atan2(uy, ux) + side * rand(0.5, 1.1);
          const x = maw.x + ux * L * q + nx * side * W * 0.4, y = maw.y + uy * L * q + ny * side * W * 0.4, l = s * rand(0.25, 0.45);
          forks.push(channel(x, y, x + Math.cos(a) * l, y + Math.sin(a) * l, 4, l * 0.3));
        }
      }
      const band = (half: number[]) => {
        const left: number[] = [], right: number[] = [];
        for (let i = 0; i <= N; i++) {
          const q = (i / N) * len, x = maw.x + ux * q, y = maw.y + uy * q, wl = half[i * 2] * w, wr = half[i * 2 + 1] * w;
          left.push(x + nx * wl, y + ny * wl);
          right.unshift(x - nx * wr, y - ny * wr);
        }
        return g.poly(left.concat(right), true);
      };
      const shiver = rand(0.85, 1);
      // A soft bloom round the whole river, so it blinds.
      g.moveTo(maw.x, maw.y).lineTo(maw.x + ux * len, maw.y + uy * len).stroke({ width: w * 1.9, color: VIO, alpha: 0.14 * shiver, cap: "round" });
      band(outer).fill({ color: VIO, alpha: 0.42 * shiver }).stroke({ width: 1.5, color: LAV, alpha: 0.65 * shiver, join: "bevel" });
      band(inner).fill({ color: LAV, alpha: 0.75 * shiver });
      g.moveTo(maw.x, maw.y).lineTo(maw.x + ux * len, maw.y + uy * len).stroke({ width: Math.max(1.5, w * 0.16), color: WHITE, alpha: 0.95, cap: "round" });
      zap(g, braids, Math.max(1, 1.8 * (w / W)), 0.9 * shiver, f);
      if (f >= 1) zap(g, forks, 1.3 * (w / W), flicker(time % (BEAT * 6), BEAT * 6) + 0.25);
      // The maw blazing.
      g.circle(maw.x, maw.y, w * 0.55).fill({ color: VIO, alpha: 0.35 });
      g.circle(maw.x, maw.y, w * 0.3).fill({ color: WHITE, alpha: 0.85 });
    });

    // THE BLAST at the far end: a flash, rubble flung back, sparks sprayed for
    // as long as the beam holds, a burning glow on the card.
    const back = Math.atan2(uy, ux);
    t.later(0.05, () => {
      flare(t, p, s * (1.3 + 0.3 * power), LAV, 0.75, 0.25);
      t.ring(m.targets[0], LAV, 0.3, 1.1, 0.3, 3);
    });
    rubble(t, p, s, back, Math.round(9 * Math.max(0.6, t.quality)), 0.05);
    t.glow(m.targets[0], VIO, 0.45, HOLD + 0.2, 1.1);
    let acc = 0;
    t.draw(HOLD, (_g, _u, dt) => {
      acc += 130 * power * dt * t.quality;
      for (; acc >= 1; acc--) {
        const a = back + (Math.random() < 0.25 ? Math.PI : 0) + rand(-1.3, 1.3), sp = rand(150, 340) * v;
        t.spark(p.x + rand(-0.15, 0.15) * s, p.y + rand(-0.15, 0.15) * s, Math.cos(a) * sp, Math.sin(a) * sp, rand(0.2, 0.4), BLAST);
      }
    }, { delay: 0.05 });

    // A kill bursts before the current comes home.
    if (killed) shatter(t, m.targets[0], s, HOLD);

    // THE CURRENT COMING BACK: beads of charge running up the narrowing beam
    // from the card into the maw — the heal it took.
    const RUN = 0.15;
    const starts = [0, 0.03, 0.06, 0.09].map((lag) => HOME - RUN - 0.09 + lag);
    t.draw(HOME + 0.05, (g, u) => {
      const time = u * (HOME + 0.05);
      for (const st of starts) {
        const q = span(time, st, st + RUN);
        if (q <= 0 || q >= 1) continue;
        // Its tail runs back toward the card it came from, never past it.
        const e = q * q, x = p.x - ux * L * e, y = p.y - uy * L * e, tl = Math.min(s * 0.6, L * e);
        g.circle(x, y, s * 0.22).fill({ color: VIO, alpha: 0.4 });
        g.circle(x, y, s * 0.13).fill({ color: LAV, alpha: 0.45 });
        g.moveTo(x, y).lineTo(x + ux * tl, y + uy * tl).stroke({ width: s * 0.13, color: VIO, alpha: 0.5, cap: "round" });
        g.moveTo(x, y).lineTo(x + ux * tl * 0.7, y + uy * tl * 0.7).stroke({ width: s * 0.05, color: LAV, alpha: 0.95, cap: "round" });
        g.circle(x, y, s * 0.075).fill({ color: WHITE, alpha: 1 });
      }
    });
    surge(t, m.from, s, HOME);
  },
};
