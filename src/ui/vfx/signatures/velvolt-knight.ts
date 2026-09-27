/** VELVOLT KNIGHT — Ultra Power Gauntlets. "Gain +2 DMG and FLYING for 3
 *  rounds; basic attacks also hit +1 adjacent target." And as it arrives (Live
 *  Current): every opponent nearest it ELECTRIFIED.
 *
 *  The Knight on its art hangs in the air over a glowing rune circle, both
 *  clawed gauntlets thrown wide and running with violet lightning, a dome of it
 *  round her. So the Special — which aims at nothing, and so is all LANDING —
 *  is the gauntlets charging: two fists of lightning igniting at the card's
 *  lower corners, clawed with arcs, static drawn into them; they CLENCH — a
 *  flash, the current jumps between them, races up both edges of the card and
 *  closes over its top (the plate reporting its faults) — while the rune
 *  circle burns up under her, knocks a flat gold shockwave out on the clench,
 *  and drops away as she lifts off it on a column of light: FLYING. Sparks
 *  ride the updraft up through the card.
 *
 *  The ARRIVAL is the same Knight landing: the rune circle draws itself on her
 *  empty square, static reaching in and the gauntlets lighting before she is
 *  there (the DELIVERY); then the dome breaks out of it as a ring of lightning
 *  running over the board, and as it reaches each nearest opponent a bolt jumps
 *  from the gauntlet on that side into the card — the current that stays.
 *
 *  Lightning keeps looks/bolt.ts's rules: kinked lines, never curves, and a
 *  stutter on a fixed beat. The circle is the one clean shape: it is plate and
 *  sigil, not weather — and gold, like the trim on her armour. */
import { centre, rand } from "../looks/base";
import type { Graphics } from "pixi.js";
import type { FxTools, Pt, SparkStyle } from "../looks/types";
import type { Signature, SigMoment } from "./types";

const TAU = Math.PI * 2;
const WHITE = 0xffffff, LAV = 0xe3d8ff, VIO = 0x9575ff, GOLD = 0xffd27a;
/** One flicker beat, s, and lightning's brightness beat by beat (looks/bolt.ts). */
const BEAT = 0.035;
const FLICKER = [1, 0.35, 1, 0.8, 0.3, 0.95, 0.55, 0.2, 0.75, 0.4, 0.15, 0.55];
/** Static: darts out hard and stops dead. */
const SNAP: SparkStyle = { palette: [WHITE, LAV, VIO], gravity: 0, drag: 0.0008, size: [6, 1.5], streak: true };
/** Static drawn in to the fists as they charge. */
const FIZZ: SparkStyle = { palette: [WHITE, LAV, VIO], gravity: 0, drag: 1, size: [4, 1.5], streak: true };
/** Riding the updraft off the circle as she lifts: bright, rising, gold-tinged. */
const LIFT: SparkStyle = { palette: [WHITE, 0xfff0c8, LAV, VIO], gravity: -220, drag: 0.35, size: [6, 2], streak: true };

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeOut = (x: number) => 1 - (1 - x) * (1 - x);
/** 0 -> 1 as `x` runs from `a` to `b`. */
const span = (x: number, a: number, b: number) => clamp01((x - a) / (b - a));

/** How lit lightning is `since` s after it strikes, lasting `dur`. */
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

/** Flat points as one path, up to fraction `f` of it; `closed` joins the ends. */
function trace(g: Graphics, p: number[], f = 1, closed = false) {
  const n = p.length / 2, reach = f * (n - 1), full = Math.min(n - 1, Math.floor(reach));
  g.moveTo(p[0], p[1]);
  for (let i = 1; i <= full; i++) g.lineTo(p[i * 2], p[i * 2 + 1]);
  const frac = reach - full;
  if (frac > 0 && full + 1 < n) {
    const i = full * 2;
    g.lineTo(p[i] + (p[i + 2] - p[i]) * frac, p[i + 1] + (p[i + 3] - p[i + 1]) * frac);
  }
  if (closed && f >= 1) g.lineTo(p[0], p[1]);
}

/** Lightning stroked: a wide violet halo, then a thin white-hot core. */
function zap(g: Graphics, paths: number[][], width: number, alpha: number, f = 1, closed = false) {
  if (alpha <= 0.02 || paths.length === 0) return;
  const a = Math.min(1, alpha);
  for (const p of paths) trace(g, p, f, closed);
  g.stroke({ width: width * 4, color: VIO, alpha: 0.3 * a, join: "round", cap: "round" });
  for (const p of paths) trace(g, p, f, closed);
  g.stroke({ width, color: WHITE, alpha: a, join: "bevel", cap: "round" });
}

/** A flash sized to the board's squares (`flash` is sized in px). */
function flare(t: FxTools, p: Pt, size: number, color: number, peak: number, seconds: number) {
  t.glow({ x: p.x - size / 2, y: p.y - size / 2, w: size, h: size }, color, peak, seconds, 1);
}

/** Where her gauntlets are on a card at `c`: its two lower corners. */
function fists(c: Pt, s: number): [Pt, Pt] {
  return [{ x: c.x - s * 0.34, y: c.y + s * 0.27 }, { x: c.x + s * 0.34, y: c.y + s * 0.27 }];
}

/** THE GAUNTLETS, drawn for `dur` s from `delay`: a fist of lightning at each,
 *  a white-hot knuckle in a violet glow, clawed with arcs splayed outward and
 *  up (the talons on her art), re-rolled every beat. `level(time)` is how
 *  charged they are, 0..1; static is drawn into them while they build. */
function gauntlets(t: FxTools, c: Pt, s: number, dur: number, level: (time: number) => number, delay = 0) {
  const pair = fists(c, s);
  let claws: number[][] = [], beat = -1, acc = 0;
  t.draw(dur, (g, u, dt) => {
    const time = u * dur, k = level(time);
    if (k <= 0.01) return;
    const b = Math.floor(time / BEAT);
    if (b !== beat) {
      beat = b;
      claws = [];
      for (let side = 0; side < 2; side++) {
        const f = pair[side], out = side ? 0 : Math.PI;
        for (let i = 0; i < 4; i++) {
          // Fanned from straight out to straight up: a hand thrown open.
          const a = out + (side ? -1 : 1) * (i / 3) * (Math.PI / 2) * rand(0.85, 1.1) + (side ? 0.15 : -0.15);
          const l = s * rand(0.18, 0.3) * (0.55 + 0.45 * k);
          claws.push(channel(f.x, f.y, f.x + Math.cos(a) * l, f.y + Math.sin(a) * l, 3, l * 0.3));
        }
      }
    }
    for (const f of pair) {
      g.circle(f.x, f.y, s * 0.2 * (0.6 + 0.4 * k)).fill({ color: VIO, alpha: 0.3 * k });
      g.circle(f.x, f.y, s * 0.1 * (0.6 + 0.4 * k)).fill({ color: LAV, alpha: 0.85 * k });
      g.circle(f.x, f.y, s * 0.055 * (0.6 + 0.4 * k)).fill({ color: WHITE, alpha: k });
    }
    zap(g, claws, 1.6, k * rand(0.7, 1));
    acc += 50 * k * dt;
    for (; acc >= 1; acc--) {
      const f = pair[Math.random() < 0.5 ? 0 : 1], a = rand(0, TAU), r = s * rand(0.25, 0.4), life = rand(0.1, 0.16);
      t.spark(f.x + Math.cos(a) * r, f.y + Math.sin(a) * r, (-Math.cos(a) * r) / life, (-Math.sin(a) * r) / life, life, FIZZ);
    }
  }, { delay });
}

/** THE RUNE CIRCLE under a card at `c`: a flat gold ring — the board seen at a
 *  slant — with a violet band round it and runes ticked between its two rims,
 *  turning. `show(time)` gives how drawn it is (0..1, it races round as it
 *  forms), how lit, how far it has dropped below her, and how much it has
 *  widened: dropping and widening is her lifting off it. */
function circle(t: FxTools, c: Pt, s: number, dur: number,
  show: (time: number) => { drawn: number; lit: number; drop: number; wide: number }, delay = 0) {
  const spin0 = rand(0, TAU);
  t.draw(dur, (g, u) => {
    const time = u * dur, o = show(time);
    if (o.lit <= 0.01 || o.drawn <= 0) return;
    const cx = c.x, cy = c.y + s * (0.42 + o.drop), rx = s * 0.6 * o.wide, ry = rx * 0.3;
    const a0 = -Math.PI / 2, a1 = a0 + TAU * o.drawn, spin = spin0 + time * 2.4;
    const arc = (r: number, width: number, color: number, alpha: number) => {
      const pts: number[] = [];
      for (let i = 0; i <= 40; i++) {
        const a = a0 + ((a1 - a0) * i) / 40;
        pts.push(cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.3);
      }
      trace(g, pts);
      g.stroke({ width, color, alpha, cap: "round", join: "round" });
    };
    arc(rx, 8, VIO, 0.32 * o.lit);
    arc(rx, 2.6, GOLD, 0.95 * o.lit);
    arc(rx * 0.76, 1.6, LAV, 0.8 * o.lit);
    // Runes: short ticks between the rims, turning with the circle.
    for (let i = 0; i < 12; i++) {
      const a = spin + (i / 12) * TAU;
      const rel = (((a - a0) % TAU) + TAU) % TAU;
      if (rel > TAU * o.drawn) continue;
      const long = i % 3 === 0 ? 1 : 0.55;
      const x0 = cx + Math.cos(a) * rx * 0.8, y0 = cy + Math.sin(a) * ry * 0.8;
      const x1 = cx + Math.cos(a) * rx * (0.8 + 0.16 * long), y1 = cy + Math.sin(a) * ry * (0.8 + 0.16 * long);
      g.moveTo(x0, y0).lineTo(x1, y1).stroke({ width: 1.6, color: GOLD, alpha: 0.9 * o.lit });
    }
    // A faint floor of light inside it.
    if (o.drawn >= 1) g.ellipse(cx, cy, rx * 0.76, ry * 0.76).fill({ color: VIO, alpha: 0.12 * o.lit });
  }, { delay });
}

/** A strike from a to b: forked, lit all at once, stuttering, leaving a violet
 *  ghost of the channel behind. `w` its width. */
function strike(t: FxTools, a: Pt, b: Pt, w: number, dur: number, delay: number) {
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1, segs = Math.max(5, Math.min(12, Math.round(len / 22)));
  const base = channel(a.x, a.y, b.x, b.y, segs, Math.min(18, 4 + len * 0.06)), dir = Math.atan2(b.y - a.y, b.x - a.x);
  const forks: number[][] = [];
  for (let i = 0; i < 3; i++) {
    const v = 1 + Math.floor(rand(0.2, 0.8) * (segs - 1)), d = dir + (i % 2 ? 1 : -1) * rand(0.4, 0.9), l = len * rand(0.12, 0.22);
    forks.push(channel(base[v * 2], base[v * 2 + 1], base[v * 2] + Math.cos(d) * l, base[v * 2 + 1] + Math.sin(d) * l, 3, l * 0.25));
  }
  let main = base, beat = -1;
  t.draw(dur, (g, u) => {
    const since = u * dur, bt = Math.floor(since / BEAT);
    if (bt !== beat) {
      beat = bt;
      main = base.map((p, i) => (i < 2 || i >= base.length - 2 ? p : p + rand(-2, 2)));
    }
    const ghost = 1 - u;
    trace(g, base);
    g.stroke({ width: w * 2.2, color: VIO, alpha: 0.35 * ghost * ghost, join: "round", cap: "round" });
    const lit = flicker(since, dur);
    zap(g, [main], w, lit);
    zap(g, forks, w * 0.5, lit * 0.85);
  }, { delay });
}

export const VELVOLT_KNIGHT: Signature = {
  shake: 0.9,

  deliver(t: FxTools, m: SigMoment, seconds: number) {
    // Only her arrival has a delivery (the Special aims at nothing): the
    // square is still empty, and she is drawn into it before she lands.
    const s = m.size, c = centre(m.from), T = seconds, v = s / 90;
    // The rune circle drawing itself round, then turning, brightening...
    circle(t, c, s, T, (time) => ({ drawn: easeOut(span(time, 0, T * 0.45)), lit: 0.55 + 0.45 * span(time, 0, T), drop: 0, wide: 1 }));
    // ...static reaching in from all round, the ring of it tightening...
    t.charge(c, s * 1.4, LAV, 0.5, T);
    let arcs: number[][] = [], beat = -1, acc = 0;
    t.draw(T, (g, u, dt) => {
      const b = Math.floor((u * T) / BEAT), r0 = s * (0.95 - 0.45 * u);
      if (b !== beat) {
        beat = b;
        arcs = [];
        for (let i = 0; i < 4; i++) {
          const a = rand(0, TAU), a1 = a + rand(-0.4, 0.4);
          arcs.push(channel(c.x + Math.cos(a) * r0, c.y + Math.sin(a) * r0, c.x + Math.cos(a1) * r0 * 0.3, c.y + Math.sin(a1) * r0 * 0.3, 4, r0 * 0.15));
        }
      }
      zap(g, arcs, 1.5, (0.35 + 0.65 * u) * rand(0.5, 1));
      acc += 40 * dt;
      for (; acc >= 1; acc--) {
        const a = rand(0, TAU), sp = rand(220, 340) * v;
        t.spark(c.x + Math.cos(a) * r0, c.y + Math.sin(a) * r0, -Math.cos(a) * sp, -Math.sin(a) * sp, rand(0.08, 0.14), FIZZ);
      }
    });
    // ...and the gauntlets lit in there before she is.
    gauntlets(t, c, s, T, (time) => easeOut(span(time, T * 0.5, T)));
  },

  land(t: FxTools, m: SigMoment) {
    const s = m.size, c = centre(m.from), v = s / 90;
    if (m.targets.length === 0) {
      // ULTRA POWER GAUNTLETS: all landing.
      const CLENCH = 0.3, D = 1.2;
      gauntlets(t, c, s, D, (time) => (time < CLENCH ? easeOut(time / CLENCH) : 1) * (1 - span(time, 0.85, D)));
      const pair = fists(c, s);
      t.later(CLENCH, () => {
        // The clench: a flash in each fist, the current jumping between them.
        for (const f of pair) flare(t, f, s * 0.8, LAV, 0.7, 0.2);
        strike(t, pair[0], pair[1], 2.4, 0.4, 0);
        for (let i = 0; i < 16; i++) {
          const f = pair[i % 2], a = rand(0, TAU), sp = rand(150, 320) * v;
          t.spark(f.x, f.y, Math.cos(a) * sp, Math.sin(a) * sp, rand(0.1, 0.24), SNAP);
        }
      });
      // The current racing up both edges of the card from the fists and
      // closing over its top — the whole plate lit, reporting its faults —
      // crackling there, then stuttering out.
      const e = s * 0.41, CRAWL = 0.66, RACE = 0.16;
      const legs = pair.map((f, i) => {
        const x = c.x + (i ? e : -e);
        return [f.x, f.y, x, c.y + s * 0.1, x, c.y - e, c.x, c.y - e];
      });
      /** A leg of the circuit re-kinked: each straight run of it a channel. */
      const kink = (leg: number[]) => {
        const out: number[] = [];
        for (let j = 0; j < leg.length - 2; j += 2) {
          const run = channel(leg[j], leg[j + 1], leg[j + 2], leg[j + 3], 4, s * 0.035);
          out.push(...(j ? run.slice(2) : run));
        }
        return out;
      };
      let beat = -1, sides: number[][] = [], twigs: number[][] = [];
      t.draw(CRAWL, (g, u) => {
        const time = u * CRAWL, up = easeOut(span(time, 0, RACE)), b = Math.floor(time / BEAT);
        if (b !== beat) {
          beat = b;
          sides = legs.map(kink);
          twigs = sides.map((p, i) => {
            const j = 2 * (2 + Math.floor(rand(0, p.length / 2 - 4))), a = (i ? Math.PI : 0) + rand(-0.7, 0.7), l = s * rand(0.1, 0.2);
            return channel(p[j], p[j + 1], p[j] + Math.cos(a) * l, p[j + 1] + Math.sin(a) * l, 3, l * 0.3);
          });
        }
        const lit = time < RACE ? 1 : Math.max(flicker(time - RACE, CRAWL - RACE) * 1.1, 0.3 * (1 - u));
        zap(g, sides, 2, lit, up);
        if (up >= 1) zap(g, twigs, 1.2, lit * 0.8);
      }, { delay: CLENCH });
      // Where the two currents meet over her head, the circuit closes.
      t.later(CLENCH + RACE, () => {
        const top = { x: c.x, y: c.y - e };
        flare(t, top, s * 0.7, LAV, 0.6, 0.18);
        for (let i = 0; i < 10; i++) {
          const a = -Math.PI / 2 + rand(-1.3, 1.3), sp = rand(150, 300) * v;
          t.spark(top.x, top.y, Math.cos(a) * sp, Math.sin(a) * sp, rand(0.1, 0.22), SNAP);
        }
      });
      // The rune circle burning up beneath her, flaring on the clench, then
      // falling away and widening as she lifts off it.
      circle(t, c, s, 1.05, (time) => ({
        drawn: easeOut(span(time, 0.02, 0.26)),
        lit: (0.6 + 0.4 * span(time, 0.2, CLENCH)) * (1 - span(time, 0.55, 1.05)) + 0.6 * span(time, CLENCH, CLENCH + 0.04) * (1 - span(time, CLENCH + 0.04, 0.55)),
        drop: 0.2 * easeOut(span(time, 0.4, 1.05)),
        wide: 1 + 0.3 * easeOut(span(time, 0.4, 1.05)),
      }));
      // The clench knocks a flat shockwave off the circle, out across the floor.
      t.draw(0.45, (g, u) => {
        const rx = s * (0.6 + 0.65 * easeOut(u));
        g.ellipse(c.x, c.y + s * 0.42, rx, rx * 0.3).stroke({ width: 3.5 * (1 - u) + 0.5, color: GOLD, alpha: 0.85 * (1 - u) });
      }, { delay: CLENCH });
      // Her shadow on it, shrinking as she rises: FLYING.
      t.draw(1.0, (g, u) => {
        const time = u * 1.0, lift = easeOut(span(time, 0.35, 0.95));
        const a = 0.45 * span(time, 0, 0.2) * (1 - lift);
        if (a > 0.01) g.ellipse(c.x, c.y + s * 0.42, s * 0.4 * (1 - 0.45 * lift), s * 0.1 * (1 - 0.45 * lift)).fill({ color: 0x0a0616, alpha: a });
      }, { dark: true });
      // The updraft she lifts on: a soft column of light rising off the circle
      // up through the card and past it — brief, and thin at its heart, so the
      // card still reads through it — and sparks riding it up.
      const base = c.y + s * 0.42, UP = 0.5;
      t.draw(UP, (g, u) => {
        const rise = easeOut(span(u, 0, 0.35)), a = 1 - span(u, 0.3, 1), top = base - s * 1.45 * rise;
        if (a <= 0.01 || rise <= 0) return;
        g.poly([c.x - s * 0.34, base, c.x - s * 0.12, top, c.x + s * 0.12, top, c.x + s * 0.34, base], true)
          .fill({ color: VIO, alpha: 0.16 * a });
        g.poly([c.x - s * 0.1, base, c.x - s * 0.03, top, c.x + s * 0.03, top, c.x + s * 0.1, base], true)
          .fill({ color: LAV, alpha: 0.28 * a });
      }, { delay: CLENCH });
      let acc = 0;
      t.draw(0.6, (_g, u, dt) => {
        acc += 90 * (1 - u * 0.6) * dt;
        for (; acc >= 1; acc--) {
          const a = rand(0, TAU), x = c.x + Math.cos(a) * s * 0.5, y = base + Math.sin(a) * s * 0.15;
          t.spark(x, y, rand(-20, 20) * v, -rand(180, 340) * v, rand(0.3, 0.55), LIFT);
        }
      }, { delay: CLENCH - 0.05 });
      flare(t, c, s * 1.3, LAV, 0.35, 0.5);
      return;
    }

    // HER ARRIVAL: the dome breaks out as a ring of lightning running over
    // the board, and a bolt jumps from a gauntlet into each card it reaches.
    const hits = m.targets.map((r, i) => {
      const p = centre(r);
      return { r, p, d: Math.hypot(p.x - c.x, p.y - c.y), power: Math.max(0.55, Math.min(2, m.power[i] ?? 1)) };
    });
    const reach = Math.max(s * 1.4, ...hits.map((h) => h.d + s * 0.4)), r0 = s * 0.35, RUN = 0.42;
    const radius = (time: number) => r0 + (reach - r0) * easeOut(clamp01(time / RUN));
    const D = RUN + 0.2;
    let ring: number[] = [], beat = -1, acc = 0;
    t.draw(D, (g, u, dt) => {
      const time = u * D, r = radius(time), fade = 1 - span(time, RUN * 0.55, D);
      const b = Math.floor(time / BEAT);
      if (b !== beat) {
        beat = b;
        ring = [];
        const n = 40;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * TAU, rr = r * (1 + rand(-0.05, 0.05));
          ring.push(c.x + Math.cos(a) * rr, c.y + Math.sin(a) * rr);
        }
      }
      // The dome it leaves, faint violet, and the ring itself crackling.
      g.circle(c.x, c.y, r).fill({ color: VIO, alpha: 0.08 * fade });
      zap(g, [ring], 2, fade * rand(0.75, 1), 1, true);
      if (time < RUN) {
        acc += 90 * dt;
        for (; acc >= 1; acc--) {
          const a = rand(0, TAU), sp = rand(120, 260) * v;
          t.spark(c.x + Math.cos(a) * r, c.y + Math.sin(a) * r, Math.cos(a) * sp, Math.sin(a) * sp, rand(0.1, 0.2), SNAP);
        }
      }
    });
    flare(t, c, s * 1.6, LAV, 0.5, 0.3);
    gauntlets(t, c, s, 0.95, (time) => 1 - span(time, 0.55, 0.95));
    const pair = fists(c, s);
    hits.forEach((h, i) => {
      const at = clamp01((h.d - r0) / Math.max(1, reach - r0));
      const when = RUN * (1 - Math.sqrt(1 - at));
      // From the gauntlet on its side of her; dead ahead, they take turns.
      const side = Math.abs(h.p.x - c.x) < s * 0.2 ? i % 2 : h.p.x < c.x ? 0 : 1;
      strike(t, pair[side], h.p, 2 + 1.4 * h.power, 0.45, when);
      crackle(t, h.r, 0.5, when + 0.05);
      t.later(when, () => {
        flare(t, h.p, s * (0.9 + 0.35 * h.power), LAV, 0.55, 0.22);
        for (let j = 0; j < Math.round(10 + 6 * h.power); j++) {
          const a = rand(0, TAU), sp = rand(150, 320) * v;
          t.spark(h.p.x, h.p.y, Math.cos(a) * sp, Math.sin(a) * sp, rand(0.1, 0.24), SNAP);
        }
      });
    });
  },
};

/** The current that stays: static crackling round a struck card's rim, re-
 *  rolled every beat, dying away over `dur`. */
function crackle(t: FxTools, r: { x: number; y: number; w: number; h: number }, dur: number, delay: number) {
  const c = centre(r), half = Math.min(r.w, r.h) * 0.42;
  let arcs: number[][] = [], beat = -1;
  t.draw(dur, (g, u) => {
    const b = Math.floor((u * dur) / BEAT);
    if (b !== beat) {
      beat = b;
      arcs = [];
      for (let i = 0; i < 3; i++) {
        const side = Math.floor(rand(0, 4)), q = rand(-half, half);
        const x = c.x + (side < 2 ? q : side === 2 ? -half : half), y = c.y + (side < 2 ? (side ? half : -half) : q);
        const a = (side < 2 ? 0 : Math.PI / 2) + rand(-0.5, 0.5) + (Math.random() < 0.5 ? Math.PI : 0), l = half * rand(0.35, 0.7);
        arcs.push(channel(x, y, x + Math.cos(a) * l, y + Math.sin(a) * l, 3, l * 0.3));
      }
    }
    zap(g, arcs, 1.4, (1 - u) * (Math.random() < 0.25 ? 0.25 : rand(0.6, 1)));
  }, { delay });
}
