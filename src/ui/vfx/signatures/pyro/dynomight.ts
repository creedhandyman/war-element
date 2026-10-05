/** DYNOMIGHT — Grand Finally. "Deal 6 DMG to opponents in the adjacent row and
 *  5 DMG to the rest. Dynomight loses 2 HP." The Forged built him to open
 *  armour.
 *
 *  On his art Dynomight is a wild white-haired bomber in a red sash, a lit
 *  stick of dynamite held up in his fist, its fuse spitting sparks, the field
 *  behind him going up. The DELIVERY is him lighting a bundle: red sticks
 *  bound together in his raised fist, every fuse fizzing yellow-white — then
 *  the sticks pulled off one by one and tossed, tumbling end over end in high
 *  lobs, each fuse still spitting, one to every target, all landing together.
 *
 *  The LANDING is the grand finale. The sticks lie where they fell with their
 *  fuses burning down, and go off one after another, the near row first: on
 *  each a white flash, a round fireball blown out, a shock ring, shrapnel and
 *  black debris thrown, and a puff of grey smoke rolling up lit orange from
 *  below — a chain of blasts walking down the board. His own card takes a
 *  singe as the first goes (the 2 HP): a smudge of soot and a few embers.
 *
 *  Dynomight's fire is DYNAMITE: solid red sticks and fuse-spark yellow, round
 *  blasts rather than flames, and grey smoke — his is the PYRO move that comes
 *  in a staggered string of bangs. The sticks are solid (normal blend), the
 *  smoke dark under a lit rim, everything else light. */
import type { Graphics } from "pixi.js";
import { centre, rand } from "../../looks/base";
import type { FxTools, Pt, SparkStyle } from "../../looks/types";
import type { Signature, SigMoment } from "../types";

type Box = SigMoment["from"];

const TAU = Math.PI * 2;
// A stick, solid (normal blend): red paper, its darker crimped ends, a lit
// edge, the fuse cord.
const STICK = 0xc42018, STICK_END = 0x5e0a06, STICK_LIT = 0xff8a6a, CORD = 0xd8c49a;
// Smoke and debris (normal blend).
const SMOKE = 0x3a3638, DEBRIS = 0x1e1614;
// Light (additive): the fuse spark, the blast.
const WHITE = 0xffffff, SPARKY = 0xfff27a, AMBER = 0xffc040, ORANGE = 0xff7a20, RED = 0xe0381a;
/** Fizz off a burning fuse: tiny, fast, short, yellow-white. */
const FIZZ: SparkStyle = { palette: [WHITE, SPARKY, AMBER, ORANGE], gravity: 260, drag: 0.4, size: [3.5, 1], streak: true };
/** Shrapnel thrown out of a blast: fast hot streaks. */
const SHRAPNEL: SparkStyle = { palette: [WHITE, SPARKY, AMBER, ORANGE], gravity: 380, drag: 0.45, size: [7, 1.5], streak: true };
/** Embers off his own singed card. */
const SINGE: SparkStyle = { palette: [AMBER, ORANGE, RED], gravity: -120, drag: 0.55, size: [4, 1.5], streak: false };

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeOut = (x: number) => 1 - (1 - x) * (1 - x);

// ── A stick of dynamite ──────────────────────────────────────────────────────

/** A stick's size: `s` the square's side. */
const stickLen = (s: number) => s * 0.34, stickW = (s: number) => s * 0.11;

/** The point `d` along a stick at `p` turned `rot`, `o` off its axis. */
const along = (p: Pt, rot: number, d: number, o = 0): Pt => ({
  x: p.x + Math.cos(rot) * d - Math.sin(rot) * o,
  y: p.y + Math.sin(rot) * d + Math.cos(rot) * o,
});

/** A stick's solid half: the red tube, darker crimped ends, a highlight down
 *  one side, and its fuse — a cord out of one end, `fuse` (0..1) of it left,
 *  with a kink so it reads as string. Returns where the fuse burns. */
function stickSolid(g: Graphics, p: Pt, rot: number, s: number, fuse: number, a: number): Pt {
  const L = stickLen(s) / 2, W = stickW(s) / 2;
  const q = (d: number, o: number) => {
    const v = along(p, rot, d, o);
    return [v.x, v.y];
  };
  g.poly([...q(-L, -W), ...q(L, -W), ...q(L, W), ...q(-L, W)], true).fill({ color: STICK, alpha: a });
  for (const e of [-1, 1]) g.poly([...q(e * L, -W), ...q(e * L * 0.8, -W), ...q(e * L * 0.8, W), ...q(e * L, W)], true).fill({ color: STICK_END, alpha: a });
  g.moveTo(...(q(-L * 0.75, -W * 0.5) as [number, number])).lineTo(...(q(L * 0.75, -W * 0.5) as [number, number]))
    .stroke({ width: Math.max(1, W * 0.35), color: STICK_LIT, alpha: 0.8 * a });
  // The fuse: out of the far end, bending.
  const F = s * 0.16 * fuse, base = along(p, rot, L), mid = along(p, rot, L + F * 0.55, F * 0.35), tip = along(p, rot, L + F, -F * 0.05);
  if (F > 0.5) g.moveTo(base.x, base.y).quadraticCurveTo(mid.x, mid.y, tip.x, tip.y).stroke({ width: Math.max(1, s * 0.016), color: CORD, alpha: a });
  return F > 0.5 ? tip : base;
}

/** ...and its light: a hot outline so the red reads on the board, and the
 *  burning spark at the fuse's end, a little star that flickers. */
function stickLight(g: Graphics, p: Pt, rot: number, s: number, tip: Pt, time: number, a: number) {
  const L = stickLen(s) / 2, W = stickW(s) / 2;
  const q = (d: number, o: number) => {
    const v = along(p, rot, d, o);
    return [v.x, v.y];
  };
  g.poly([...q(-L, -W), ...q(L, -W), ...q(L, W), ...q(-L, W)], true).stroke({ width: 1.2, color: 0xff6a4a, alpha: 0.55 * a });
  const fl = 0.75 + 0.25 * Math.sin(time * 47) * Math.sin(time * 31), R = s * 0.05 * fl;
  g.circle(tip.x, tip.y, R * 2.4).fill({ color: AMBER, alpha: 0.25 * a });
  for (let k = 0; k < 4; k++) {
    const ang = time * 20 + (k * Math.PI) / 4;
    g.moveTo(tip.x - Math.cos(ang) * R * 1.8, tip.y - Math.sin(ang) * R * 1.8).lineTo(tip.x + Math.cos(ang) * R * 1.8, tip.y + Math.sin(ang) * R * 1.8)
      .stroke({ width: 1.2, color: SPARKY, alpha: 0.9 * a });
  }
  g.circle(tip.x, tip.y, R * 0.7).fill({ color: WHITE, alpha: a });
}

// ── The plan ─────────────────────────────────────────────────────────────────

/** Who goes up when: the targets nearest him first (the adjacent row), a beat
 *  apart, the whole chain inside about half a second. Each stick's pose where
 *  it lies, fixed by its place in the chain so the delivery's tumble ends on
 *  exactly the pose the landing draws it in. */
function chain(m: SigMoment) {
  const c = centre(m.from), n = m.targets.length;
  const order = m.targets.map((r, i) => ({ i, r, d: Math.hypot(centre(r).x - c.x, centre(r).y - c.y) })).sort((a, b) => a.d - b.d);
  const gap = n > 1 ? Math.min(0.09, 0.4 / (n - 1)) : 0;
  return order.map((o, j) => {
    const p = centre(o.r);
    return { ...o, j, at: { x: p.x + m.size * 0.04 * Math.cos(j * 2.3), y: p.y + m.size * 0.08 }, rot: -0.5 + j * 1.27, boom: j * gap };
  });
}

/** Where the bundle is held: his raised fist, up off his card's corner as on
 *  the art. */
const fistAt = (c: Pt, s: number): Pt => ({ x: c.x - s * 0.16, y: c.y - s * 0.2 });

export const DYNOMIGHT: Signature = {
  shake: 1.4,
  lunge: false,

  deliver(t: FxTools, m: SigMoment, seconds: number) {
    const T = seconds, s = m.size, c = centre(m.from), f = fistAt(c, s);
    if (!m.targets.length) return;
    const plan = chain(m), n = plan.length;
    // Thrown one after another, near ones first, every one landing together.
    const leave = (j: number) => T * (0.3 + (n > 1 ? (0.3 * j) / (n - 1) : 0));
    // Up to five sticks in the bundle; more targets than that are thrown from
    // the same five slots, refilled.
    const slot = (j: number) => {
      const k = j % 5, spread = (k - 2) * 0.24;
      return { p: { x: f.x + spread * s * 0.22, y: f.y + Math.abs(spread) * s * 0.06 }, rot: -Math.PI / 2 + spread };
    };
    // THE BUNDLE in his fist, every fuse lit and fizzing; a stick gone from it
    // as each is thrown.
    t.draw(T, (g, u) => {
      const time = u * T;
      for (let j = Math.min(n, 5) - 1; j >= 0; j--) if (time < leave(j)) {
        const sl = slot(j);
        stickSolid(g, sl.p, sl.rot, s * 0.9, 1 - 0.25 * u, clamp01(time / (T * 0.12)));
      }
    }, { dark: true });
    let fz = 0;
    t.draw(T, (g, u, dt) => {
      const time = u * T, tips: Pt[] = [];
      for (let j = Math.min(n, 5) - 1; j >= 0; j--) if (time < leave(j)) {
        const sl = slot(j), L = stickLen(s * 0.9) / 2, F = s * 0.9 * 0.16 * (1 - 0.25 * u);
        const tip = along(sl.p, sl.rot, L + F, -F * 0.05);
        tips.push(tip);
        stickLight(g, sl.p, sl.rot, s * 0.9, tip, time + j, clamp01(time / (T * 0.12)));
      }
      fz += dt * 45 * t.quality;
      for (; fz >= 1 && tips.length; fz--) {
        const tp = tips[Math.floor(rand(0, tips.length))], a = rand(0, TAU), v = rand(60, 160) * (s / 90);
        t.spark(tp.x, tp.y, Math.cos(a) * v, Math.sin(a) * v - 40 * (s / 90), rand(0.1, 0.22), FIZZ);
      }
    });
    t.charge(f, s * 0.7, AMBER, 0.3, T * 0.4);

    // THE THROWS: each stick lobbed high and tumbling, its fuse spitting all
    // the way, to land on its target on the landing frame.
    for (const pl of plan) {
      const go = leave(pl.j), fly = T - go, sl = slot(pl.j), to = pl.at;
      const dist = Math.hypot(to.x - sl.p.x, to.y - sl.p.y), arc = s * 0.5 + dist * 0.28;
      const spin = (pl.j % 2 ? 1 : -1) * rand(10, 14);
      const pose = (time: number) => {
        const q = time / fly;
        return {
          p: { x: sl.p.x + (to.x - sl.p.x) * q, y: sl.p.y + (to.y - sl.p.y) * q - arc * 4 * q * (1 - q) },
          rot: pl.rot - spin * (fly - time),
        };
      };
      t.draw(fly, (g, u) => {
        const ps = pose(u * fly);
        stickSolid(g, ps.p, ps.rot, s, 0.75, 1);
      }, { dark: true, delay: go });
      let fz2 = 0;
      t.draw(fly, (g, u, dt) => {
        const time = u * fly, ps = pose(time), L = stickLen(s) / 2, F = s * 0.16 * 0.75;
        const tip = along(ps.p, ps.rot, L + F, -F * 0.05);
        stickLight(g, ps.p, ps.rot, s, tip, time + pl.j, 1);
        fz2 += dt * 22 * t.quality;
        for (; fz2 >= 1; fz2--) {
          const a = rand(0, TAU), v = rand(30, 90) * (s / 90);
          t.spark(tip.x, tip.y, Math.cos(a) * v, Math.sin(a) * v, rand(0.1, 0.2), FIZZ);
        }
      }, { delay: go });
    }
  },

  land(t: FxTools, m: SigMoment) {
    const s = m.size, c = centre(m.from);
    if (!m.targets.length) return;
    const plan = chain(m);
    const END = Math.max(...plan.map((p) => p.boom));
    // A stick stays drawn a breath past its bang, under the fireball's first
    // frames, so it never blinks out before the blast shows.
    const HOLD = 0.07;
    // THE STICKS where they fell, fuses burning down to their bang.
    t.draw(END + HOLD, (g, u) => {
      const time = u * (END + HOLD);
      for (const pl of plan) if (time < pl.boom + HOLD) stickSolid(g, pl.at, pl.rot, s, 0.75 * clamp01(1 - time / Math.max(0.01, pl.boom)), 1);
    }, { dark: true });
    let fz = 0;
    t.draw(END + HOLD, (g, u, dt) => {
      const time = u * (END + HOLD), tips: Pt[] = [];
      for (const pl of plan) if (time < pl.boom + HOLD) {
        const L = stickLen(s) / 2, F = s * 0.16 * 0.75 * clamp01(1 - time / Math.max(0.01, pl.boom));
        const tip = F > 0.5 ? along(pl.at, pl.rot, L + F, -F * 0.05) : along(pl.at, pl.rot, L);
        tips.push(tip);
        stickLight(g, pl.at, pl.rot, s, tip, time + pl.j, 1);
      }
      fz += dt * 18 * tips.length * t.quality;
      for (; fz >= 1 && tips.length; fz--) {
        const tp = tips[Math.floor(rand(0, tips.length))], a = rand(0, TAU), v = rand(40, 120) * (s / 90);
        t.spark(tp.x, tp.y, Math.cos(a) * v, Math.sin(a) * v - 30 * (s / 90), rand(0.1, 0.2), FIZZ);
      }
    });
    // THE CHAIN: each goes up in turn.
    for (const pl of plan) {
      const go = () => blast(t, pl.r, centre(pl.r), m.power[pl.i] ?? 1, !!m.killed[pl.i], s, c);
      if (pl.boom <= 0) go();
      else t.later(pl.boom, go);
    }
    // HIS OWN SINGE: the 2 HP the finale costs him.
    singe(t, m.from, s);
  },
};

/** One stick going up on a card: a white flash, a round fireball blown out
 *  and burning down from the inside, a shock ring, shrapnel and black debris,
 *  then a puff of grey smoke rolling up off it, lit orange from below. */
function blast(t: FxTools, r: Box, p: Pt, power: number, killed: boolean, s: number, from: Pt) {
  const k = Math.max(0.75, Math.min(1.5, power)), R = s * 0.56 * k, seed = rand(0, TAU);
  t.flash(p, WHITE, 0.3 * k * (s / 90));
  t.ring(r, AMBER, 0.25, (1.25 + 0.2 * k) * (killed ? 1.25 : 1), 0.32, 4);
  // THE FIREBALL: a lumpy round ball, out fast, burning down from the inside.
  const D = 0.42;
  const ball = (g: Graphics, rr: number, u: number, color: number, alpha: number) => {
    const pts: number[] = [];
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * TAU, w = 1 + 0.1 * Math.sin(a * 5 + seed) + 0.06 * Math.sin(a * 3 - seed + u * 6);
      pts.push(p.x + Math.cos(a) * rr * w, p.y - u * R * 0.25 + Math.sin(a) * rr * w);
    }
    g.poly(pts, true).fill({ color, alpha });
  };
  t.draw(D, (g, u) => {
    const grow = 0.3 + 0.7 * easeOut(clamp01(u / 0.22)), fade = 1 - clamp01((u - 0.35) / 0.65);
    ball(g, R * grow, u, RED, 0.45 * fade);
    ball(g, R * 0.78 * grow, u, ORANGE, 0.6 * fade);
    ball(g, R * 0.55 * grow * (1 - 0.6 * u), u, AMBER, 0.75 * fade);
    ball(g, R * 0.32 * grow * (1 - 0.9 * u), u, WHITE, 0.9 * fade);
  });
  // THE SMOKE: grey, rolling up out of the ball as it burns down.
  const puffs = Array.from({ length: 5 }, (_, i) => ({ a: seed + (i / 5) * TAU, d: rand(0.2, 0.45), r: rand(0.32, 0.45), ph: rand(0, TAU) }));
  const S = 0.6, smoke = (u: number, b: (typeof puffs)[number]) => {
    const rise = easeOut(u) * R * 0.75;
    return { x: p.x + Math.cos(b.a) * R * b.d * (1 + u * 0.5), y: p.y - rise + Math.sin(b.a) * R * b.d * 0.7, rr: R * b.r * (0.8 + 0.7 * u) };
  };
  t.draw(S, (g, u) => {
    const a = 0.72 * Math.sin(Math.PI * clamp01(u * 1.15)) * (1 - u * 0.4);
    for (const b of puffs) {
      const q = smoke(u, b);
      g.circle(q.x, q.y, q.rr).fill({ color: SMOKE, alpha: a });
    }
  }, { dark: true, delay: 0.1 });
  t.draw(S, (g, u) => {
    const a = 0.8 * Math.sin(Math.PI * clamp01(u * 1.15)) * (1 - u * 0.7);
    for (const b of puffs) {
      const q = smoke(u, b);
      // Lit from below by the fire it came out of: an arc of orange under it.
      g.moveTo(q.x + Math.cos(0.15 * Math.PI) * q.rr, q.y + Math.sin(0.15 * Math.PI) * q.rr).arc(q.x, q.y, q.rr, 0.15 * Math.PI, 0.85 * Math.PI).stroke({ width: 2.5, color: ORANGE, alpha: a });
      g.moveTo(q.x + Math.cos(-2.2) * q.rr, q.y + Math.sin(-2.2) * q.rr).arc(q.x, q.y, q.rr, -2.2, -1.2).stroke({ width: 1.5, color: 0xc8c0b8, alpha: 0.6 * a });
    }
  }, { delay: 0.1 });
  // Shrapnel, thrown wide and mostly away from him.
  const away = Math.atan2(p.y - from.y, p.x - from.x), n = Math.round(12 * k);
  for (let j = 0; j < n; j++) {
    const a = j % 2 ? rand(0, TAU) : away + rand(-1, 1), v = rand(170, 340) * (s / 90);
    t.spark(p.x, p.y, Math.cos(a) * v, Math.sin(a) * v, rand(0.2, 0.36), SHRAPNEL);
  }
  debris(t, p, Math.round(5 * k), s);
}

/** Black debris blown out of a blast, rimmed hot, tumbling and falling. */
function debris(t: FxTools, at: Pt, n: number, s: number) {
  const bits = Array.from({ length: Math.max(1, Math.round(n * t.quality)) }, () => {
    const a = rand(0, TAU), v = rand(140, 260) * (s / 90);
    return { vx: Math.cos(a) * v, vy: Math.sin(a) * v - 80 * (s / 90), w: s * rand(0.03, 0.055), h: s * rand(0.015, 0.03), rot: rand(0, TAU), vr: rand(-14, 14), life: rand(0.35, 0.5) };
  });
  const D = 0.5;
  const shard = (b: (typeof bits)[number], time: number) => {
    const x = at.x + b.vx * time, y = at.y + b.vy * time + 600 * (s / 90) * time * time, a = b.rot + b.vr * time;
    const ca = Math.cos(a), sa = Math.sin(a);
    return [x - ca * b.w + sa * b.h, y - sa * b.w - ca * b.h, x + ca * b.w + sa * b.h * 0.4, y + sa * b.w - ca * b.h * 0.4, x + ca * b.w * 0.6 - sa * b.h, y + sa * b.w * 0.6 + ca * b.h, x - ca * b.w * 0.8 - sa * b.h, y - sa * b.w * 0.8 + ca * b.h];
  };
  t.draw(D, (g, u) => {
    const time = u * D;
    for (const b of bits) if (time < b.life) g.poly(shard(b, time), true).fill({ color: DEBRIS, alpha: 1 - (time / b.life) ** 3 });
  }, { dark: true });
  t.draw(D, (g, u) => {
    const time = u * D;
    for (const b of bits) if (time < b.life) g.poly(shard(b, time), true).stroke({ width: 1, color: AMBER, alpha: 0.8 * (1 - (time / b.life) ** 3) });
  });
}

/** His own card singed by the finale: a smudge of soot with a hot edge
 *  where his fist was, and a few embers. Small: it is 2 HP. */
function singe(t: FxTools, r: Box, s: number) {
  const f = fistAt(centre(r), s), D = 0.6;
  t.flash(f, ORANGE, 0.12 * (s / 90));
  t.draw(D, (g, u) => {
    g.circle(f.x, f.y - u * s * 0.12, s * (0.12 + 0.08 * u)).fill({ color: SMOKE, alpha: 0.5 * (1 - u) });
  }, { dark: true });
  t.draw(D, (g, u) => {
    g.circle(f.x, f.y - u * s * 0.12, s * (0.12 + 0.08 * u)).stroke({ width: 1.5, color: ORANGE, alpha: 0.6 * (1 - u) });
  });
  for (let j = 0; j < Math.round(6 * t.quality); j++)
    t.spark(f.x + rand(-0.1, 0.1) * s, f.y + rand(-0.05, 0.1) * s, rand(-25, 25) * (s / 90), -rand(30, 80) * (s / 90), rand(0.4, 0.6), SINGE);
}
