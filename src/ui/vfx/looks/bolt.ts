/** BOLT — lightning.
 *
 *  Every other element travels, swells or glows; lightning does none of that.
 *  It CRACKLES, then STRIKES: a broken, forked line that is simply there, all
 *  at once, stutters hard on and off for a few beats and leaves a violet
 *  ghost of itself behind. Every hook below is built from that one motion, so
 *  a BOLT effect still reads as lightning in grey — by its shape (kinked
 *  lines, never curves) and its timing (a stutter, never a smooth fade).
 *
 *  The pieces: a CHANNEL (a jagged line pinned at both ends, re-kinked every
 *  beat so it crackles in place), a STRIKE (a faint stepped leader feeling its
 *  way to the target, then the bright channel with its forks), a CRAWL (tiny
 *  arcs of static running over a card's rim) and SNAPS (sparks that dart out
 *  and stop dead, rather than spraying). */
import type { Graphics } from "pixi.js";
import { centre, rand } from "./base";
import type { ElementLook, FxTools, Pt, SparkStyle } from "./types";

type Box = { x: number; y: number; w: number; h: number };

const WHITE = 0xffffff, LAV = 0xe3d8ff, VIO = 0x9575ff, DEEP = 0x5b3bd6;
const PAL3 = [WHITE, LAV, VIO];
const TAU = Math.PI * 2;

/** One flicker beat, s. Lightning changes state faster than the eye tracks
 *  motion, so every re-kink and every stutter step runs on this clock —
 *  frame-rate independent, and the same on a 30Hz phone as a 120Hz one. */
const BEAT = 0.035;
/** A strike's brightness, beat by beat: re-strokes, not a fade. */
const FLICKER = [1, 0.3, 1, 0.8, 0.25, 0.95, 0.5, 0.15, 0.7, 0.35, 0.1, 0.5];

/** Static: darts out hard and stops dead — a snap, not a spray. */
const SNAP: SparkStyle = { palette: PAL3, gravity: 0, drag: 0.0008, size: [6, 1.5], streak: true };
/** Finer static, for crackle hanging around a shape. */
const FIZZ: SparkStyle = { palette: [WHITE, LAV, VIO, DEEP], gravity: 0, drag: 0.002, size: [4, 1], streak: true };
/** The storm's static, a touch bigger so it reads across the whole board. */
const STATIC: SparkStyle = { palette: [WHITE, LAV, VIO], gravity: 0, drag: 0.001, size: [7, 1.5], streak: true };
/** A heal's charge: motes zipping up off the card and hanging there. */
const LIFT: SparkStyle = { palette: [WHITE, 0xd6ffe2, 0xa9f5c4], gravity: -60, drag: 0.02, size: [7, 2], streak: true };

// ── Drawing lightning ────────────────────────────────────────────────────────

const KINKS: number[] = []; // scratch, for channels laid once

/** Fresh kinks for a channel of `segs` segments: per interior vertex, an
 *  offset across the line (a correlated walk — meanders AND sharp turns, the
 *  way lightning actually goes) and a wobble along it (uneven steps). */
function boltKinks(out: number[], segs: number): number[] {
  out.length = 0;
  let off = 0;
  for (let i = 1; i < segs; i++) {
    off = off * 0.5 + rand(-1, 1);
    out.push(off, rand(-0.3, 0.3));
  }
  return out;
}

/** A channel from a to b through `kinks`, written into `out` as flat x,y
 *  pairs. Pinned at both ends — it always lands exactly where it is aimed. */
function boltLay(out: number[], ax: number, ay: number, bx: number, by: number, kinks: number[], jag: number): number[] {
  const segs = kinks.length / 2 + 1;
  const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1;
  const ux = dx / len, uy = dy / len, step = len / segs;
  out.length = 0;
  out.push(ax, ay);
  for (let i = 1; i < segs; i++) {
    const f = i / segs;
    const off = kinks[i * 2 - 2] * jag * Math.sqrt(Math.sin(Math.PI * f));
    const al = kinks[i * 2 - 1] * step;
    out.push(ax + dx * f + ux * al - uy * off, ay + dy * f + uy * al + ux * off);
  }
  out.push(bx, by);
  return out;
}

function boltChannel(out: number[], ax: number, ay: number, bx: number, by: number, segs: number, jag: number): number[] {
  return boltLay(out, ax, ay, bx, by, boltKinks(KINKS, segs), jag);
}

/** `base` re-kinked slightly into `out`: the same channel, crackling. */
function boltShake(out: number[], base: number[], amp: number) {
  const n = base.length;
  out.length = n;
  for (let i = 0; i < n; i++) out[i] = i < 2 || i >= n - 2 ? base[i] : base[i] + rand(-amp, amp);
}

/** Traces `p` as one open path, up to fraction `f` of it (by vertex, the last
 *  segment partly). Paths are traced, never handed to `poly()`: Pixi keeps a
 *  poly's array by reference until it renders, and these arrays are reused. */
function boltTrace(g: Graphics, p: number[], f = 1): boolean {
  const n = p.length / 2;
  const reach = f * (n - 1);
  if (n < 2 || reach <= 0) return false;
  const full = Math.min(n - 1, Math.floor(reach));
  g.moveTo(p[0], p[1]);
  for (let i = 1; i <= full; i++) g.lineTo(p[i * 2], p[i * 2 + 1]);
  const frac = reach - full;
  if (frac > 0 && full + 1 < n) {
    const i = full * 2;
    g.lineTo(p[i] + (p[i + 2] - p[i]) * frac, p[i + 1] + (p[i + 3] - p[i + 1]) * frac);
  }
  return true;
}

/** The point fraction `f` along `p`, into `out`. */
function boltAt(p: number[], f: number, out: Pt): Pt {
  const n = p.length / 2;
  const reach = Math.max(0, Math.min(n - 1, f * (n - 1)));
  const i = Math.min(n - 2, Math.floor(reach)) * 2, frac = reach - i / 2;
  out.x = p[i] + (p[i + 2] - p[i]) * frac;
  out.y = p[i + 1] + (p[i + 3] - p[i + 1]) * frac;
  return out;
}

/** Strokes the first `n` of `paths` as lightning: a wide violet halo, then a
 *  thin white-hot core. Round joins on the halo and bevels on the core: a
 *  mitred zig-zag grows spikes at every sharp kink. */
function boltDraw(g: Graphics, paths: number[][], n: number, width: number, a: number, f = 1, core = WHITE, halo = VIO) {
  if (a <= 0.02 || n <= 0) return;
  const alpha = Math.min(1, a);
  let any = false;
  for (let i = 0; i < n; i++) any = boltTrace(g, paths[i], f) || any;
  if (!any) return;
  g.stroke({ width: width * 4, color: halo, alpha: 0.3 * alpha, join: "round", cap: "round" });
  for (let i = 0; i < n; i++) boltTrace(g, paths[i], f);
  g.stroke({ width, color: core, alpha, join: "bevel", cap: "round" });
}

/** How lit a strike is `since` s after it lands, lasting `dur` s. */
function boltFlicker(since: number, dur: number): number {
  if (since < 0 || since >= dur) return 0;
  return FLICKER[Math.floor(since / BEAT) % FLICKER.length] * Math.sqrt(1 - since / dur);
}

/** A short hard flash: in and gone in a blink, where a normal flash lingers. */
function boltFlash(t: FxTools, p: Pt, size: number, color: number, peak: number, seconds: number) {
  t.glow({ x: p.x - size / 2, y: p.y - size / 2, w: size, h: size }, color, peak, seconds, 1);
}

/** Static thrown off a channel: `n` snaps from points along it, sideways. */
function boltSpit(t: FxTools, p: number[], n: number, speed: number) {
  const m = p.length / 2 - 1;
  if (m < 1) return;
  for (let i = 0; i < n; i++) {
    const j = Math.min(m - 1, Math.floor(Math.random() * m)) * 2, f = Math.random();
    const dx = p[j + 2] - p[j], dy = p[j + 3] - p[j + 1];
    const a = Math.atan2(dy, dx) + (Math.random() < 0.5 ? -1 : 1) * rand(1.0, 2.1);
    const v = speed * rand(0.45, 1);
    t.spark(p[j] + dx * f, p[j + 1] + dy * f, Math.cos(a) * v, Math.sin(a) * v, rand(0.1, 0.24), SNAP);
  }
}

/** `n` snaps out of a point, all round. */
function boltSnaps(t: FxTools, c: Pt, n: number, speed: number, st: SparkStyle = SNAP) {
  for (let i = 0; i < n; i++) {
    const a = rand(0, TAU), v = speed * rand(0.45, 1);
    t.spark(c.x, c.y, Math.cos(a) * v, Math.sin(a) * v, rand(0.1, 0.24), st);
  }
}

const RIM = { x: 0, y: 0, tan: 0 };
/** A random point on a square rim of half-size `half` round `c`, and the
 *  rim's direction there — into the shared RIM. */
function boltRim(c: Pt, half: number) {
  const side = Math.floor(Math.random() * 4), s = rand(-half, half);
  RIM.x = c.x + (side < 2 ? s : side === 2 ? -half : half);
  RIM.y = c.y + (side < 2 ? (side === 0 ? -half : half) : s);
  RIM.tan = side < 2 ? 0 : Math.PI / 2;
  return RIM;
}

/** Static crawling over a card: tiny arcs flickering along its rim, re-rolled
 *  every beat, more and longer as it builds, drawing sparks in toward the
 *  middle — St Elmo's fire, a charge you can see gathering. */
function boltCrawl(t: FxTools, r: Box, seconds: number, n: number, reach: number, sparkRate: number, width = 1.5) {
  const c = centre(r), half = Math.min(r.w, r.h) * 0.42;
  const arcs: number[][] = [];
  for (let i = 0; i < n; i++) arcs.push([]);
  let beat = -1, shown = 0, acc = 0;
  t.draw(seconds, (g, k, dt) => {
    const b = Math.floor((k * seconds) / BEAT);
    if (b !== beat) {
      beat = b;
      shown = Math.max(1, Math.round(n * (0.4 + 0.6 * k)));
      for (let i = 0; i < shown; i++) {
        const p = boltRim(c, half);
        const a = p.tan + rand(-0.5, 0.5) + (Math.random() < 0.5 ? Math.PI : 0);
        const l = reach * rand(0.6, 1.1) * (0.6 + 0.4 * k);
        boltChannel(arcs[i], p.x, p.y, p.x + Math.cos(a) * l, p.y + Math.sin(a) * l, 3, l * 0.3);
      }
    }
    boltDraw(g, arcs, shown, width, (0.45 + 0.55 * k) * rand(0.55, 1));
    acc += sparkRate * dt;
    while (acc >= 1) {
      acc -= 1;
      const p = boltRim(c, half);
      const a = Math.atan2(c.y - p.y, c.x - p.x) + rand(-0.7, 0.7), v = rand(120, 240);
      t.spark(p.x, p.y, Math.cos(a) * v, Math.sin(a) * v, rand(0.08, 0.16), FIZZ);
    }
  });
}

interface BoltStrike {
  delay?: number;
  /** s the stepped leader takes to reach `b`; 0 = it just strikes. */
  lead: number;
  /** s the strike stutters for, and the violet afterglow lingers for. */
  flick: number;
  after: number;
  width: number;
  forks: number;
  /** A fork's length, against the channel's. */
  forkLen: number;
  spit: number;
  segs?: number;
  jag?: number;
  leadAlpha?: number;
  crackle?: number;
}

/** A lightning strike from a to b. With a `lead`, a faint LEADER steps out
 *  first — jumping vertex to vertex along the very channel the strike will
 *  take, a feeler twitching at its tip — and reaches `b` exactly at `lead`;
 *  then the channel and its forks light all at once, stutter, and leave a
 *  violet afterglow. That is real lightning's order, and it gives a ranged
 *  shot a visible delivery without it ever "flying". */
function boltStrike(t: FxTools, a: Pt, b: Pt, o: BoltStrike) {
  const dist = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const segs = o.segs ?? Math.max(5, Math.min(14, Math.round(dist / 24)));
  const base = boltChannel([], a.x, a.y, b.x, b.y, segs, o.jag ?? Math.min(20, 4 + dist * 0.045));
  const bases = [base], main = base.slice(), mains = [main];
  const dir = Math.atan2(b.y - a.y, b.x - a.x);
  const forkBase: number[][] = [], forks: number[][] = [];
  for (let i = 0; i < o.forks; i++) {
    const v = 1 + Math.floor(rand(0.15, 0.8) * (segs - 1));
    const d = dir + (i % 2 ? 1 : -1) * rand(0.35, 0.85);
    const len = dist * o.forkLen * rand(0.6, 1.1);
    const x = base[v * 2], y = base[v * 2 + 1];
    const fb = boltChannel([], x, y, x + Math.cos(d) * len, y + Math.sin(d) * len, 3, len * 0.2);
    forkBase.push(fb);
    forks.push(fb.slice());
  }
  const twig: number[] = [], twigs = [twig];
  const lead = o.lead, total = lead + Math.max(o.flick, o.after);
  let beat = -1, spat = false;
  t.draw(total, (g, k) => {
    const time = k * total;
    const bt = Math.floor(time / BEAT);
    if (time < lead) {
      // The leader, in jumps: it has reached vertex `upto`, never `b` itself
      // until the landing frame.
      const upto = Math.floor((time / lead) * segs);
      if (upto < 1) return;
      if (bt !== beat) {
        beat = bt;
        const x = base[upto * 2], y = base[upto * 2 + 1];
        const d = Math.atan2(b.y - y, b.x - x) + rand(-1.2, 1.2), l = rand(8, 16);
        boltChannel(twig, x, y, x + Math.cos(d) * l, y + Math.sin(d) * l, 2, 4);
      }
      const la = (o.leadAlpha ?? 0.45) * rand(0.6, 1);
      boltDraw(g, bases, 1, 1.3, la, upto / segs, LAV);
      boltDraw(g, twigs, 1, 1, la * 0.8, 1, LAV);
      g.circle(base[upto * 2], base[upto * 2 + 1], 2.4).fill({ color: WHITE, alpha: Math.min(1, la * 2) });
      return;
    }
    const since = time - lead;
    if (bt !== beat) {
      beat = bt;
      boltShake(main, base, o.crackle ?? 2);
      for (let i = 0; i < forks.length; i++) boltShake(forks[i], forkBase[i], 1.5);
    }
    if (!spat) {
      spat = true;
      if (o.spit) boltSpit(t, base, o.spit, 320);
    }
    // The afterglow: what the eye keeps of the channel once the flash is gone.
    const ag = since < o.after ? 1 - since / o.after : 0;
    if (ag > 0 && boltTrace(g, base))
      g.stroke({ width: o.width * 2.2, color: VIO, alpha: 0.35 * ag * ag, join: "round", cap: "round" });
    const lit = boltFlicker(since, o.flick);
    boltDraw(g, mains, 1, o.width, lit);
    boltDraw(g, forks, forks.length, o.width * 0.5, lit * 0.85);
  }, { delay: o.delay });
}

// ── The look ─────────────────────────────────────────────────────────────────

/** Lightning's own glyph, laid along a cut: two long strokes joined by a short
 *  step BACK — the one mark no other element's blow makes. (u along the cut,
 *  v across it, in reaches.) */
const GLYPH = [-0.95, -0.28, 0.22, 0.16, -0.2, -0.1, 0.95, 0.3];

/** A heartbeat, left to right: (u, lift) pairs. An electric heal is a jolt
 *  that restarts something, and a trace is the one heal shape that is also a
 *  zig-zag. */
const ECG = [0, 0, 0.3, 0, 0.36, 0.1, 0.42, 0, 0.47, -0.14, 0.53, 0.66, 0.59, -0.32, 0.65, 0, 0.77, 0.16, 0.86, 0, 1, 0];

export const BOLT: ElementLook = {
  markColor: 0xc4b3ff,

  windUp(t, d) {
    // Static gathers on the card — arcs crawling its rim, sparks pulled in, a
    // glow under it — quickening toward the release. Least for a basic melee,
    // where the lunge is the wind-up; a Special crackles all round.
    const dur = d.wind + (d.T - d.wind) * 0.3;
    const basicMelee = d.melee && !d.special;
    t.charge(d.at, d.size * (d.special ? 1.35 : basicMelee ? 0.7 : 0.95), LAV,
      d.special ? 0.5 : basicMelee ? 0.14 : 0.28, dur);
    boltCrawl(t, d.rect, dur, d.special ? 4 : basicMelee ? 1 : 2, d.size * (d.special ? 0.26 : 0.18),
      d.special ? 70 : basicMelee ? 0 : 28, d.special ? 1.8 : 1.4);
  },

  gather(t, d) {
    // The storm drawn INTO the empty square: arcs reaching in from all round,
    // the ring of them tightening as it builds, and the strike comes out of it.
    const c = d.at, n = d.special ? 5 : 3;
    t.charge(c, d.size * (d.special ? 1.6 : 1.2), LAV, d.special ? 0.7 : 0.45, d.T);
    const arcs: number[][] = [];
    for (let i = 0; i < n; i++) arcs.push([]);
    let beat = -1, acc = 0, shown = 0, r0 = d.size;
    t.draw(d.T, (g, k, dt) => {
      const b = Math.floor((k * d.T) / BEAT);
      r0 = d.size * (0.85 - 0.4 * k);
      if (b !== beat) {
        beat = b;
        shown = Math.max(2, Math.round(n * (0.5 + 0.5 * k)));
        for (let i = 0; i < shown; i++) {
          const a = rand(0, TAU), a1 = a + rand(-0.4, 0.4), r1 = r0 * 0.3;
          boltChannel(arcs[i], c.x + Math.cos(a) * r0, c.y + Math.sin(a) * r0,
            c.x + Math.cos(a1) * r1, c.y + Math.sin(a1) * r1, 4, (r0 - r1) * 0.22);
        }
      }
      boltDraw(g, arcs, shown, d.special ? 1.8 : 1.4, (0.35 + 0.65 * k) * rand(0.5, 1));
      acc += (d.special ? 60 : 36) * dt;
      while (acc >= 1) {
        acc -= 1;
        const a = rand(0, TAU), v = rand(200, 320);
        t.spark(c.x + Math.cos(a) * r0, c.y + Math.sin(a) * r0, -Math.cos(a) * v, -Math.sin(a) * v, rand(0.08, 0.15), FIZZ);
      }
    });
  },

  projectile(t, s) {
    // Lightning does not fly: a faint leader steps out to the target during
    // the throw, and the bolt STRIKES down it on the landing frame — forked,
    // stuttering, both ends lit at once, a violet ghost left behind. A basic
    // is one thin strike; a Special is thicker, forks more and burns longer.
    const sp = s.special;
    boltStrike(t, s.from, s.to, {
      delay: s.delay, lead: s.seconds, flick: sp ? 0.4 : 0.26, after: sp ? 0.5 : 0.32,
      width: sp ? 3.4 : 2.4, forks: sp ? 5 : 2, forkLen: sp ? 0.22 : 0.15, spit: sp ? 14 : 6,
      leadAlpha: sp ? 0.6 : 0.42, crackle: sp ? 3 : 2,
    });
    t.later(s.delay + s.seconds, () => boltFlash(t, s.from, s.size * (sp ? 1.1 : 0.7), LAV, sp ? 0.6 : 0.35, 0.16));
  },

  swing(t, s) {
    // The lunge drags lightning behind it. A basic trails a short thin crackle
    // (it happens every turn); a Special stays TETHERED to where it started —
    // a live channel from the attacker's square to the blow, forking and
    // throwing static as it goes.
    const sp = s.special, segs = sp ? 8 : 4;
    const kinks: number[] = [], path: number[] = [], paths = [path];
    const twk: number[] = [], twig: number[] = [], twigs = [twig];
    let beat = -1, acc = 0, tv = 1, ta = 0, tl = 0;
    t.draw(s.seconds, (g, k, dt) => {
      const e = k * k; // eased in, like the lunge: it hits hardest at the end
      const hx = s.from.x + (s.to.x - s.from.x) * e, hy = s.from.y + (s.to.y - s.from.y) * e;
      const e0 = sp ? 0 : Math.max(0, e - 0.35);
      const tx = s.from.x + (s.to.x - s.from.x) * e0, ty = s.from.y + (s.to.y - s.from.y) * e0;
      const b = Math.floor((k * s.seconds) / BEAT);
      if (b !== beat) {
        beat = b;
        boltKinks(kinks, segs);
        if (sp) {
          boltKinks(twk, 2);
          tv = 1 + Math.floor(rand(0, segs - 1));
          ta = (Math.random() < 0.5 ? -1 : 1) * rand(0.5, 1.2);
          tl = rand(10, 20);
        }
      }
      const len = Math.hypot(hx - tx, hy - ty);
      if (len < 3) return;
      const lit = Math.min(1, k * 5) * rand(sp ? 0.7 : 0.45, sp ? 1 : 0.7);
      boltLay(path, tx, ty, hx, hy, kinks, Math.min(sp ? 9 : 4, len * 0.15));
      boltDraw(g, paths, 1, sp ? 2.4 : 1.3, lit);
      if (sp) {
        const x = path[tv * 2], y = path[tv * 2 + 1], dd = Math.atan2(hy - ty, hx - tx) + ta;
        boltLay(twig, x, y, x + Math.cos(dd) * tl, y + Math.sin(dd) * tl, twk, 3);
        boltDraw(g, twigs, 1, 1.2, lit * 0.8);
        acc += 60 * dt;
        while (acc >= 1) {
          acc -= 1;
          const a = rand(0, TAU), v = rand(120, 260);
          t.spark(hx, hy, Math.cos(a) * v, Math.sin(a) * v, rand(0.08, 0.18), SNAP);
        }
      }
      g.circle(hx, hy, sp ? 3.5 : 2).fill({ color: WHITE, alpha: lit });
    }, { delay: s.delay });
  },

  mark(t, m) {
    // The glyph cut across the card in one blink, its edges crackling, forks
    // spitting off its kinks, and a fainter afterimage of it a step behind —
    // then it stutters out. Not an arc: nothing about lightning is smooth.
    const ux = Math.cos(m.across), uy = Math.sin(m.across), vx = -uy, vy = ux, R = m.reach;
    const base: number[] = [];
    const put = (u: number, v: number) => base.push(m.c.x + (ux * u + vx * v) * R, m.c.y + (uy * u + vy * v) * R);
    for (let i = 0; i < 3; i++)
      for (let j = 0; j < 3; j++) {
        const f = j / 3;
        put(GLYPH[i * 2] + (GLYPH[i * 2 + 2] - GLYPH[i * 2]) * f, GLYPH[i * 2 + 1] + (GLYPH[i * 2 + 3] - GLYPH[i * 2 + 1]) * f);
      }
    put(GLYPH[6], GLYPH[7]);
    const live = base.slice(), lives = [live], echo: number[] = [], echoes = [echo];
    const twigs: number[][] = [[], [], []];
    const ex = vx * R * 0.3, ey = vy * R * 0.3;
    const width = 2.8 * (0.85 + 0.15 * m.k), dur = 0.46, cut = 0.05;
    let beat = -1, acc = 0;
    t.draw(dur, (g, k, dt) => {
      const time = k * dur;
      const b = Math.floor(time / BEAT);
      if (b !== beat) {
        beat = b;
        // The glyph's own corners hold (so it stays readable); the points
        // between them crackle.
        for (let i = 0; i < base.length; i++) live[i] = base[i] + ((i >> 1) % 3 === 0 ? rand(-1, 1) : rand(-3.5, 3.5));
        for (let j = 0; j < twigs.length; j++) {
          const p = 1 + Math.floor(rand(0, 8)), x = live[p * 2], y = live[p * 2 + 1];
          const a = m.across + (Math.random() < 0.5 ? -1 : 1) * (Math.PI / 2 + rand(-0.6, 0.6)), l = R * rand(0.18, 0.36);
          boltChannel(twigs[j], x, y, x + Math.cos(a) * l, y + Math.sin(a) * l, 2, l * 0.3);
        }
      }
      const since = time - cut;
      const lit = since < 0 ? 1 : Math.max(boltFlicker(since, dur - cut), 0.4 * (1 - since / (dur - cut)));
      boltDraw(g, lives, 1, width, lit, Math.min(1, time / cut));
      if (since <= 0) return;
      const ea = 0.55 * (1 - since / 0.25);
      if (ea > 0) {
        echo.length = live.length;
        for (let i = 0; i < live.length; i += 2) { echo[i] = live[i] + ex; echo[i + 1] = live[i + 1] + ey; }
        boltDraw(g, echoes, 1, width * 0.5, ea, 1, LAV);
      }
      if (since < 0.28) boltDraw(g, twigs, twigs.length, 1.2, lit * 0.8);
      acc += 36 * dt;
      while (acc >= 1) {
        acc -= 1;
        const p = Math.floor(rand(0, 10)) * 2, a = rand(0, TAU), v = rand(100, 220);
        t.spark(live[p], live[p + 1], Math.cos(a) * v, Math.sin(a) * v, rand(0.08, 0.16), FIZZ);
      }
    });
    boltFlash(t, m.c, R * 1.8, LAV, 0.5, 0.2);
    boltSpit(t, base, Math.round(10 * m.k), 320);
  },

  xSparks(t, c, count) {
    // Static jumping off the X's own arms: each snaps out along a diagonal and
    // stops dead — a crackle, not a spray.
    for (let i = 0; i < count; i++) {
      const a = Math.PI / 4 + (i % 4) * (Math.PI / 2) + rand(-0.3, 0.3), v = rand(200, 340);
      t.spark(c.x + Math.cos(a) * 5, c.y + Math.sin(a) * 5, Math.cos(a) * v, Math.sin(a) * v, rand(0.12, 0.3), SNAP);
    }
  },

  arrive(t, r) {
    // Struck in from the sky: a bolt down onto the square, a hard flash, and
    // the strike grounding out in arcs across it.
    const c = centre(r);
    boltStrike(t, { x: c.x + rand(-0.2, 0.2) * r.w, y: r.y - r.h * 1.6 }, c, {
      lead: 0, flick: 0.36, after: 0.45, width: 3.6, forks: 3, forkLen: 0.25, spit: 10,
    });
    boltFlash(t, c, r.w * 1.3, LAV, 0.75, 0.22);
    t.arcs(c, PAL3, 0.42, 5);
    boltSnaps(t, c, 22, 360);
  },

  impactAccent(t, at, k) {
    // ELECTRIFIED: after the burst has gone the card is still crackling —
    // static crawling over it, snapping, dying away. One draw, a few sparks.
    const rad = 28 * Math.min(1.4, k), dur = 0.5;
    const arcs: number[][] = [[], [], []];
    let beat = -1, acc = 0;
    t.draw(dur, (g, kk, dt) => {
      const b = Math.floor((kk * dur) / BEAT);
      if (b !== beat) {
        beat = b;
        for (let i = 0; i < arcs.length; i++) {
          const a = rand(0, TAU), d = rad * rand(0.35, 1), x = at.x + Math.cos(a) * d, y = at.y + Math.sin(a) * d;
          const ta = a + Math.PI / 2 + rand(-0.5, 0.5), l = rand(10, 18);
          boltChannel(arcs[i], x, y, x + Math.cos(ta) * l, y + Math.sin(ta) * l, 3, 4);
        }
      }
      boltDraw(g, arcs, arcs.length, 1.3, (1 - kk) * (Math.random() < 0.3 ? 0.2 : rand(0.6, 1)));
      acc += 30 * (1 - kk) * dt;
      while (acc >= 1) {
        acc -= 1;
        const a = rand(0, TAU), v = rand(100, 200), d = rad * rand(0.2, 0.9);
        t.spark(at.x + Math.cos(a) * d, at.y + Math.sin(a) * d, Math.cos(a) * v, Math.sin(a) * v, rand(0.08, 0.15), FIZZ);
      }
    }, { delay: 0.12 });
  },

  shield(t, r) {
    // A cage of live wire: a hexagon of kinked lines raced round the card in
    // a blink, crackling as it holds, an arc hopping corner to corner round it
    // — then it shorts out.
    const c = centre(r), R = Math.min(r.w, r.h) * 0.6, dur = 0.95, race = 0.15;
    const V: number[] = [];
    for (let i = 0; i < 6; i++) V.push(c.x + Math.cos(-Math.PI / 2 + (i * Math.PI) / 3) * R, c.y + Math.sin(-Math.PI / 2 + (i * Math.PI) / 3) * R);
    const base: number[] = [];
    for (let i = 0; i < 6; i++) {
      const j = ((i + 1) % 6) * 2;
      for (let s = 0; s < 3; s++) base.push(V[i * 2] + ((V[j] - V[i * 2]) * s) / 3, V[i * 2 + 1] + ((V[j + 1] - V[i * 2 + 1]) * s) / 3);
    }
    base.push(V[0], V[1]);
    const cage = base.slice(), cages = [cage], hop: number[] = [], half: number[] = [], hops = [hop];
    const head = { x: 0, y: 0 };
    let beat = -1, acc = 0, h = 0;
    t.draw(dur, (g, k, dt) => {
      const time = k * dur;
      const b = Math.floor(time / BEAT);
      const fade = time < 0.55 ? 1 : Math.max(0, 1 - (time - 0.55) / (dur - 0.55));
      if (b !== beat) {
        beat = b;
        // Corners hold still; the wire between them crackles.
        for (let i = 2; i < base.length - 2; i++) cage[i] = base[i] + ((i >> 1) % 3 === 0 ? 0 : rand(-3.5, 3.5));
        if (time > race && b % 3 === 0) {
          // The next hop: an arc bowing out over the next edge.
          h = (h + 1) % 6;
          const i0 = h * 2, i1 = ((h + 1) % 6) * 2;
          const mx = (V[i0] + V[i1]) / 2, my = (V[i0 + 1] + V[i1 + 1]) / 2;
          const ox = mx + (mx - c.x) * 0.3, oy = my + (my - c.y) * 0.3;
          boltChannel(hop, V[i0], V[i0 + 1], ox, oy, 3, 5);
          boltChannel(half, ox, oy, V[i1], V[i1 + 1], 3, 5);
          for (let i = 2; i < half.length; i++) hop.push(half[i]);
          if (time < 0.75) for (let s = 0; s < 3; s++) {
            const a = Math.atan2(V[i1 + 1] - c.y, V[i1] - c.x) + rand(-0.8, 0.8), v = rand(140, 260);
            t.spark(V[i1], V[i1 + 1], Math.cos(a) * v, Math.sin(a) * v, rand(0.1, 0.2), SNAP);
          }
        }
      }
      const f = Math.min(1, time / race), lit = fade * rand(0.75, 1);
      if (f >= 1) {
        g.poly(V, true).fill({ color: VIO, alpha: 0.05 * fade });
        if (time < 0.8) boltDraw(g, hops, 1, 1.5, lit * 0.9);
      }
      boltDraw(g, cages, 1, 1.8, lit, f);
      if (f < 1) {
        // The racing head, shedding fizz as it goes round.
        boltAt(base, f, head);
        g.circle(head.x, head.y, 3).fill({ color: WHITE, alpha: 1 });
        acc += 90 * dt;
        while (acc >= 1) {
          acc -= 1;
          const a = rand(0, TAU), v = rand(80, 180);
          t.spark(head.x, head.y, Math.cos(a) * v, Math.sin(a) * v, rand(0.1, 0.2), FIZZ);
        }
      }
    });
    t.glow(r, VIO, 0.28, 0.5, 1.2);
  },

  heal(t, r, k) {
    // A jolt that restarts the heart: one beat of a trace drawn across the
    // card, bright at its head, in a living green, and charge zipping up off
    // it.
    const kk = Math.max(0.7, Math.min(2.2, k));
    const c = centre(r), x0 = r.x + r.w * 0.08, span = r.w * 0.84, amp = r.h * 0.36;
    const trace: number[] = [];
    for (let i = 0; i < ECG.length; i += 2) trace.push(x0 + ECG[i] * span, c.y - ECG[i + 1] * amp);
    const traces = [trace], head = { x: 0, y: 0 }, dur = 1.0, sweep = 0.36;
    t.draw(dur, (g, kt) => {
      const time = kt * dur, f = Math.min(1, time / sweep);
      const fade = time < sweep ? 1 : 1 - (time - sweep) / (dur - sweep);
      boltDraw(g, traces, 1, 2.2, fade, f, 0xeafff0, 0x5fe08a);
      if (f < 1) {
        boltAt(trace, f, head);
        g.circle(head.x, head.y, 3.5).fill({ color: WHITE, alpha: 1 });
      }
    });
    t.emit({ count: Math.round(16 * kk), palette: LIFT.palette, from: r, at: "bottom", dir: [-100, -80],
      speed: [180, 300], gravity: LIFT.gravity, drag: LIFT.drag, life: [0.35, 0.7], size: LIFT.size, streak: true });
    t.glow(r, 0xc8ffb0, 0.35, 0.8);
  },

  wall(t, r) {
    // An electric fence: two live rails along the row and arcs leaping
    // between them — sweeping out along it, then dancing on and off at
    // random until it shorts out.
    const N = 8, top = r.y + r.h * 0.1, bot = r.y + r.h * 0.9, dur = 1.0;
    const arcs: number[][] = [], vis: number[][] = [], on: boolean[] = [];
    for (let i = 0; i < N; i++) { arcs.push([]); on.push(false); }
    const rails: number[][] = [[], []];
    let beat = -1, acc = 0;
    t.draw(dur, (g, k, dt) => {
      const time = k * dur;
      const front = Math.min(1, time / 0.22);
      const fade = time < 0.6 ? 1 : Math.max(0, 1 - (time - 0.6) / 0.4);
      const b = Math.floor(time / BEAT);
      if (b !== beat) {
        beat = b;
        for (let i = 0; i < N; i++) {
          const x = r.x + (r.w * (i + 0.5 + rand(-0.35, 0.35))) / N;
          boltChannel(arcs[i], x, bot, x + rand(-10, 10), top, 5, 6);
          on[i] = time < 0.3 || Math.random() < 0.55;
        }
        boltChannel(rails[0], r.x, bot, r.x + r.w, bot, 12, 2.5);
        boltChannel(rails[1], r.x, top, r.x + r.w, top, 12, 2.5);
      }
      vis.length = 0;
      const fx = r.x + r.w * front;
      for (let i = 0; i < N; i++) if (on[i] && arcs[i][0] <= fx) vis.push(arcs[i]);
      const lit = fade * rand(0.7, 1);
      g.rect(r.x, top, r.w * front, bot - top).fill({ color: VIO, alpha: 0.07 * fade });
      boltDraw(g, rails, 2, 1.4, lit * 0.8, front);
      boltDraw(g, vis, vis.length, 1.6, lit);
      if (!vis.length) { acc = 0; return; }
      acc += 110 * fade * dt;
      while (acc >= 1) {
        acc -= 1;
        const p = vis[Math.floor(Math.random() * vis.length)], end = Math.random() < 0.5 ? 0 : p.length - 2;
        const a = (end ? -Math.PI / 2 : Math.PI / 2) + rand(-1.2, 1.2), v = rand(120, 260);
        t.spark(p[end], p[end + 1], Math.cos(a) * v, Math.sin(a) * v, rand(0.1, 0.2), SNAP);
      }
    });
  },

  field(t, r) {
    // A storm over the board: the sky darkens (real shade, on the normal
    // layer, so the flashes have something to light), sheet lightning
    // flickers across all of it three times with a bolt down under each, and
    // static snaps on and off everywhere in between.
    const dur = 1.3, at = [0.1, 0.42, 0.78];
    t.draw(dur, (g, k) => {
      const a = k < 0.15 ? k / 0.15 : k < 0.55 ? 1 : 1 - (k - 0.55) / 0.45;
      g.rect(r.x, r.y, r.w, r.h).fill({ color: 0x07040f, alpha: 0.3 * a });
    }, { dark: true });
    for (let i = 0; i < at.length; i++) {
      const x = r.x + r.w * (0.2 + 0.3 * i + rand(-0.08, 0.08));
      boltStrike(t, { x, y: r.y - 16 }, { x: x + rand(-0.12, 0.12) * r.w, y: r.y + r.h * rand(0.3, 0.62) }, {
        delay: at[i], lead: 0, flick: 0.26, after: 0.34, width: 2.2, forks: 3, forkLen: 0.22, spit: 10,
      });
    }
    let acc = 0;
    t.draw(1.15, (g, k, dt) => {
      const time = k * 1.15;
      let lit = 0;
      for (let i = 0; i < at.length; i++) lit = Math.max(lit, boltFlicker(time - at[i], 0.22));
      if (lit > 0) g.rect(r.x, r.y, r.w, r.h).fill({ color: VIO, alpha: 0.14 * lit });
      acc += 600 * (1 - k * 0.7) * dt;
      while (acc >= 1) {
        acc -= 1;
        const a = rand(0, TAU), v = rand(90, 220);
        t.spark(r.x + rand(0, r.w), r.y + rand(0, r.h), Math.cos(a) * v, Math.sin(a) * v, rand(0.06, 0.16), STATIC);
      }
    });
  },

  move(t, from, to) {
    // A blink: static swarms the card, it vanishes in a flash and IS the bolt
    // — straight to where it lands, instantly — and is back there, crackling.
    const a = centre(from), b = centre(to);
    boltCrawl(t, from, 0.14, 4, from.w * 0.22, 80);
    t.later(0.1, () => boltFlash(t, a, from.w * 0.9, LAV, 0.6, 0.14));
    boltStrike(t, a, b, { delay: 0.1, lead: 0, flick: 0.24, after: 0.36, width: 2.8, forks: 2, forkLen: 0.12, spit: 10 });
    t.later(0.12, () => {
      boltFlash(t, b, to.w * 1.1, LAV, 0.7, 0.2);
      t.arcs(b, PAL3, 0.38, 4);
      boltSnaps(t, b, 16, 300);
    });
  },

  trapSet(t, r) {
    // A charged rune — a diamond with the bolt glyph in it — struck into the
    // square, crackling hard, then going QUIET: the crackle dies to nothing,
    // the white drains to violet and it sinks out of sight. Armed, and hidden.
    const c = centre(r), R = Math.min(r.w, r.h) * 0.34, dur = 1.1;
    const corners = [0, -1, 1, 0, 0, 1, -1, 0, 0, -1];
    const dia: number[] = [];
    for (let i = 0; i < 4; i++) {
      const x0 = corners[i * 2], y0 = corners[i * 2 + 1], x1 = corners[i * 2 + 2], y1 = corners[i * 2 + 3];
      dia.push(c.x + x0 * R, c.y + y0 * R, c.x + ((x0 + x1) / 2) * R, c.y + ((y0 + y1) / 2) * R);
    }
    dia.push(c.x, c.y - R);
    const glyph = [c.x - R * 0.2, c.y - R * 0.62, c.x + R * 0.22, c.y - R * 0.04, c.x - R * 0.22, c.y + R * 0.04, c.x + R * 0.2, c.y + R * 0.62];
    const dl = dia.slice(), gl = glyph.slice(), dias = [dl], glyphs = [gl];
    let beat = -1;
    t.draw(dur, (g, k) => {
      const time = k * dur;
      const noisy = time < 0.45 ? 1 : Math.max(0, 1 - (time - 0.45) / 0.3);
      const fade = time < 0.6 ? 1 : 1 - (time - 0.6) / (dur - 0.6);
      const b = Math.floor(time / BEAT);
      if (b !== beat) {
        beat = b;
        boltShake(dl, dia, 3.5 * noisy);
        boltShake(gl, glyph, 2.5 * noisy);
      }
      const a = Math.min(1, time / 0.05) * fade * (1 - noisy * 0.5 * Math.random());
      const core = noisy > 0.3 ? WHITE : LAV;
      boltDraw(g, dias, 1, 1.6, a * 0.85, 1, core);
      boltDraw(g, glyphs, 1, 2.2, a, 1, core);
    });
    boltFlash(t, c, R * 2.4, LAV, 0.45, 0.14);
    boltSnaps(t, c, 10, 220, FIZZ);
  },

  pulse(t, r) {
    // One bolt the length of the row: a leader flicks across, then the whole
    // line strikes at once, forking up and down, the row lit in stutters.
    const y = r.y + r.h / 2, dur = 0.6, lead = 0.1;
    boltStrike(t, { x: r.x + 4, y }, { x: r.x + r.w - 4, y }, {
      lead, flick: 0.34, after: 0.45, width: 2.8, forks: 4, forkLen: 0.12, spit: 24, leadAlpha: 0.5, jag: 12,
    });
    t.draw(dur, (g, k) => {
      const lit = boltFlicker(k * dur - lead, 0.34);
      if (lit > 0) g.rect(r.x, r.y, r.w, r.h).fill({ color: VIO, alpha: 0.12 * lit });
    });
  },
};
