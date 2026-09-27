/** NITRO — Volatile Formula. "Deal 13 DMG to all opponents in range — 30%
 *  chance to deal double." The Forge Core's finest formula, and its least
 *  stable.
 *
 *  The DELIVERY is the formula thrown: the card bubbles up green, and out of
 *  it a stoppered flask is lobbed at every target, tumbling end over end in a
 *  high arc, glowing acid-green through the glass, fizzing at the neck and
 *  trailing chemical vapour — each timed to come down on its target on the
 *  landing frame.
 *
 *  The LANDING is each flask breaking. Glass flies, and the formula goes off:
 *  an orange bloom of fire at the heart (it is still PYRO's) inside a cloud of
 *  acid-green foam — a cluster of bubbles that swells, seethes and pops —
 *  with drops of it flung out that burst where they land. A target that took
 *  double (a big `power`) was the formula doing what it does best: its foam
 *  trembles, then goes off AGAIN a beat later, bigger, with a shock ring.
 *  What it killed goes on bubbling after: the experiment completes.
 *
 *  All of it is light (additive): acid green reads on the dark board, and the
 *  foam is drawn as rims, so the card under it still reads. */
import type { Graphics } from "pixi.js";
import { centre, rand } from "../looks/base";
import { AMBER, F_CORE, F_MID, F_OUT, ORANGE, pyroFlick, pyroTongue } from "../looks/fire";
import type { FxTools, Pt, SparkStyle } from "../looks/types";
import type { Signature, SigMoment } from "./types";

type Box = { x: number; y: number; w: number; h: number };

const TAU = Math.PI * 2;
const ACID = 0x9dff3a, PALE = 0xe4ffb8, DEEP = 0x3fae2a, GLASS = 0xe8fbff;
/** Chemical vapour off a flask in flight: puffs that swell as they thin. */
const VAPOUR = [PALE, ACID, DEEP];
/** Glass: bright, sharp, falling. */
const SHARD: SparkStyle = { palette: [0xffffff, GLASS, 0xa8e8d8], gravity: 650, drag: 0.5, size: [6, 2], streak: true };
/** The formula flung out in drops: no drag, so each lands where we worked
 *  out it would — and bursts there. */
const DROP: SparkStyle = { palette: [PALE, ACID, ACID, DEEP], gravity: 620, drag: 1, size: [7, 4], streak: false };
/** Fizz off the neck of a flask in flight, and off a drop that bursts. */
const FIZZ: SparkStyle = { palette: [0xffffff, PALE, ACID], gravity: -120, drag: 0.4, size: [4, 1.5], streak: true };
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeOut = (x: number) => 1 - (1 - x) * (1 - x);
/** Took double: the formula went off twice (13 is ~1.27 as a shot's power,
 *  26 is ~1.8). */
const DOUBLED = 1.6;

/** A stoppered flask, `r` its bulb's radius, turned to `rot`: a round bulb
 *  glowing with the formula through a pale glass outline, a neck, a stopper
 *  and a glint. */
function flask(g: Graphics, x: number, y: number, r: number, rot: number, a: number) {
  const ux = Math.cos(rot), uy = Math.sin(rot), nx = -uy, ny = ux;
  // The neck: a short tube out of the bulb along `rot`, and the stopper on it.
  const n0 = r * 0.8, n1 = r * 1.75, nw = r * 0.34;
  const neck = [
    x + ux * n0 + nx * nw, y + uy * n0 + ny * nw, x + ux * n1 + nx * nw, y + uy * n1 + ny * nw,
    x + ux * n1 - nx * nw, y + uy * n1 - ny * nw, x + ux * n0 - nx * nw, y + uy * n0 - ny * nw,
  ];
  g.circle(x, y, r * 0.86).fill({ color: ACID, alpha: 0.75 * a });
  g.circle(x - ux * r * 0.2, y - uy * r * 0.2, r * 0.42).fill({ color: PALE, alpha: 0.6 * a });
  g.poly(neck).fill({ color: DEEP, alpha: 0.5 * a }).stroke({ width: 1.5, color: GLASS, alpha: 0.95 * a });
  g.circle(x, y, r).stroke({ width: 2, color: GLASS, alpha: 0.95 * a });
  // The stopper: a plug of amber across the neck's end.
  const s0 = r * 1.75, s1 = r * 2.15, sw = nw * 1.35;
  g.poly([
    x + ux * s0 + nx * sw, y + uy * s0 + ny * sw, x + ux * s1 + nx * sw * 0.8, y + uy * s1 + ny * sw * 0.8,
    x + ux * s1 - nx * sw * 0.8, y + uy * s1 - ny * sw * 0.8, x + ux * s0 - nx * sw, y + uy * s0 - ny * sw,
  ]).fill({ color: AMBER, alpha: 0.95 * a });
  // The glint stays put while the flask turns: it is the light, not the glass.
  g.circle(x - r * 0.4, y - r * 0.45, r * 0.2).fill({ color: 0xffffff, alpha: 0.95 * a });
}

export const NITRO: Signature = {
  shake: 1.4,

  deliver(t: FxTools, m: SigMoment, seconds: number) {
    const c = centre(m.from), s = m.size, T = seconds;
    const n = m.targets.length;
    // The formula coming up to the boil on the card.
    t.charge(c, s * 1.2, ACID, 0.45, T * 0.5);
    bubbles(t, m.from, 5, T * 0.55, s);
    m.targets.forEach((r, i) => {
      const to = centre(r), p = m.power[i] ?? 1;
      // Thrown one after another, every one landing together.
      const leave = T * (0.18 + (n > 1 ? (0.16 * i) / (n - 1) : 0));
      const fly = T - leave;
      const from = { x: c.x + rand(-0.12, 0.12) * s, y: c.y - s * 0.2 };
      const dist = Math.hypot(to.x - from.x, to.y - from.y);
      const arc = s * 0.45 + dist * 0.3;
      const rb = s * 0.105 * (0.9 + 0.2 * Math.min(2, p));
      // The shot owns the timing contract and sheds a little vapour; its head
      // is only the glow the glass gives off.
      t.shot({
        from, to, seconds: fly, delay: leave, head: DEEP, headSize: rb * 3,
        arc, trail: { palette: VAPOUR, rate: 30, size: [rb * 0.7, rb * 1.6], life: [0.2, 0.4], drift: 18, gravity: -40 },
      });
      // The flask itself, on the shot's own path and clock (linear, bowed by
      // `arc`), tumbling end over end — and the chemical smoke it leaves,
      // hanging in the air behind it, swelling and thinning.
      const spin = rand(9, 13) * (Math.random() < 0.5 ? -1 : 1), rot0 = rand(0, TAU);
      const smoke: { x: number; y: number; age: number; seed: number }[] = [];
      const HANG = 0.4;
      let fizz = 0, puff = 0, lx = from.x, ly = from.y;
      t.draw(fly + HANG, (g, u, dt) => {
        const time = u * (fly + HANG), q = Math.min(1, time / fly);
        const x = from.x + (to.x - from.x) * q, y = from.y + (to.y - from.y) * q - arc * 4 * q * (1 - q);
        for (const p of smoke) p.age += dt;
        if (time < fly) {
          // Laid along the stretch flown since the last frame, not heaped
          // where the flask is now: a trail, not a string of beads.
          puff += dt * 90 * Math.max(0.5, t.quality);
          const due = Math.floor(puff);
          for (let j = 1; j <= due; j++) {
            const f = j / due;
            smoke.push({ x: lx + (x - lx) * f + rand(-2, 2), y: ly + (y - ly) * f + rand(-2, 2), age: dt * (1 - f), seed: rand(0, TAU) });
          }
          puff -= due;
          lx = x; ly = y;
        }
        for (const p of smoke) {
          const k = p.age / HANG;
          if (k >= 1) continue;
          const rr = rb * (0.6 + 1.7 * k);
          const px = p.x + Math.sin(p.seed + p.age * 6) * rb * 0.5 * k, py = p.y - k * rb * 1.2;
          g.circle(px, py, rr).fill({ color: DEEP, alpha: 0.3 * (1 - k) });
          g.circle(px, py, rr * 0.55).fill({ color: ACID, alpha: 0.18 * (1 - k) });
        }
        if (time >= fly) return;
        const rot = rot0 + spin * time;
        flask(g, x, y, rb, rot, Math.min(1, q * 8));
        fizz += dt * 30 * t.quality;
        for (; fizz >= 1; fizz--) {
          const nx = x + Math.cos(rot) * rb * 2.1, ny = y + Math.sin(rot) * rb * 2.1;
          t.spark(nx, ny, Math.cos(rot) * rand(40, 90) + rand(-20, 20), Math.sin(rot) * rand(40, 90) + rand(-20, 20), rand(0.12, 0.22), FIZZ);
        }
      }, { delay: leave });
    });
  },

  land(t: FxTools, m: SigMoment) {
    const s = m.size;
    m.targets.forEach((r, i) => {
      const p = m.power[i] ?? 1;
      blast(t, r, Math.min(p, 1.45), s, 0);
      // Took double: the foam trembles, and the rest of the formula goes off.
      if (p >= DOUBLED) blast(t, r, p * 1.1, s, 0.24);
      if (m.killed[i]) t.later(0.35, () => bubbles(t, r, 7, 0.7, s));
    });
  },
};

/** Bubbles rising off a card and popping: `n` of them over `seconds`. */
function bubbles(t: FxTools, r: Box, n: number, seconds: number, s: number) {
  const bs = Array.from({ length: n }, () => ({
    x: r.x + r.w * rand(0.18, 0.82), y: r.y + r.h * rand(0.45, 0.9), at: rand(0, seconds * 0.5),
    life: rand(0.3, 0.5) * Math.min(1, seconds * 1.6), size: s * rand(0.04, 0.075), seed: rand(0, TAU),
  }));
  t.draw(seconds, (g, u) => {
    const time = u * seconds;
    for (const b of bs) {
      const q = (time - b.at) / b.life;
      if (q <= 0 || q >= 1) continue;
      const rr = b.size * (0.4 + 0.6 * easeOut(Math.min(1, q * 2))) * (q > 0.85 ? 1 + (q - 0.85) * 3 : 1);
      const x = b.x + Math.sin(time * 9 + b.seed) * s * 0.02, y = b.y - q * s * 0.28;
      const a = q > 0.85 ? (1 - q) / 0.15 : 1;
      g.circle(x, y, rr).fill({ color: ACID, alpha: 0.18 * a }).stroke({ width: 1.3, color: PALE, alpha: 0.85 * a });
      g.circle(x - rr * 0.35, y - rr * 0.35, rr * 0.25).fill({ color: 0xffffff, alpha: 0.8 * a });
    }
  });
}

/** A flask going off on a card, `delay` seconds in: glass flying, a bloom of
 *  fire at the heart, a cloud of acid foam round it that swells, seethes and
 *  pops, and drops of the formula flung out to burst where they land. The
 *  size of all of it is the hit. */
function blast(t: FxTools, r: Box, power: number, s: number, delay: number) {
  const c = centre(r), k = Math.max(0.8, Math.min(2, power));
  const R = s * 0.42 * k, second = delay > 0;
  const go = () => {
    // Glass (only the first time: the second blast is the formula itself).
    if (!second) {
      for (let i = 0; i < 12; i++) {
        const a = rand(0, TAU), v = rand(140, 300) * (s / 90);
        t.spark(c.x, c.y, Math.cos(a) * v, Math.sin(a) * v - rand(40, 120) * (s / 90), rand(0.3, 0.5), SHARD);
      }
    }
    t.flash(c, ORANGE, (second ? 0.4 : 0.35) * k * (s / 90));
    t.glow(r, ACID, second ? 0.3 : 0.35, 0.55, 1.1);
    if (second) t.ring(r, PALE, 0.3, 1.25 * k, 0.4, 4);
    // Drops of it flung out, each bursting where it lands.
    const drops = Math.round((second ? 10 : 7) * k * Math.max(0.5, t.quality));
    for (let i = 0; i < drops; i++) {
      const a = -Math.PI / 2 + rand(-1.3, 1.3), v = rand(110, 230) * (s / 90) * (second ? 1.25 : 1);
      const vx = Math.cos(a) * v, vy = Math.sin(a) * v, life = rand(0.32, 0.5);
      const g = DROP.gravity * (s / 90);
      t.spark(c.x, c.y, vx, vy, life, { ...DROP, gravity: g });
      const lx = c.x + vx * life, ly = c.y + vy * life + 0.5 * g * life * life;
      t.later(life, () => pop(t, { x: lx, y: ly }, s));
    }
  };
  if (delay > 0) t.later(delay, go);
  else go();

  // THE FIRE AT ITS HEART: an orange bloom of flame bursting out and lifting
  // as it burns down — the formula is PYRO's, however green it runs. Orange
  // through, white only at the very heart, so it reads as fire in the acid
  // and not as a flash.
  const seed = rand(0, 100);
  const tongues = 7;
  t.draw(0.38, (g, u) => {
    const time = u * 0.38;
    const grow = u < 0.18 ? easeOut(u / 0.18) : 1, fade = u < 0.3 ? 1 : 1 - (u - 0.3) / 0.7;
    const lift = u * R * 0.35, cy = c.y - lift;
    g.circle(c.x, cy, R * 0.5 * grow * (1 - 0.3 * u)).fill({ color: F_OUT, alpha: 0.4 * fade });
    for (let i = 0; i < tongues; i++) {
      const a = (i / tongues) * TAU + seed;
      let ux = Math.cos(a), uy = Math.sin(a) - 0.6;
      const l = Math.hypot(ux, uy) || 1;
      ux /= l; uy /= l;
      const len = R * 0.8 * grow * (1 - 0.4 * u) * (1 + 0.2 * pyroFlick(time, seed + i));
      const lean = len * 0.2 * pyroFlick(time * 0.8, seed + i * 1.7), bx = c.x + ux * R * 0.12, by = cy + uy * R * 0.12;
      pyroTongue(g, bx, by, ux, uy, len, R * 0.38, lean, F_OUT, 0.5 * fade);
      pyroTongue(g, bx, by, ux, uy, len * 0.7, R * 0.24, lean * 0.7, F_MID, 0.6 * fade);
    }
    g.circle(c.x, cy, R * 0.26 * grow * (1 - 0.5 * u)).fill({ color: F_MID, alpha: 0.5 * fade });
    g.circle(c.x, cy, R * 0.13 * grow * (1 - 0.6 * u)).fill({ color: F_CORE, alpha: 0.85 * fade });
  }, { delay });
  t.later(delay, () => t.glow({ x: c.x - R * 0.5, y: c.y - R * 0.5, w: R, h: R }, ORANGE, 0.5, 0.3, 1.2));

  // THE FOAM: a cluster of acid bubbles round it — out fast with the blast,
  // seething in place, then popping one by one. Drawn as rims over a thin
  // wash, so the card shows through; a second blast's trembles first.
  const lobes = Array.from({ length: 9 }, (_, i) => ({
    a: (i / 9) * TAU + rand(-0.25, 0.25), d: rand(0.45, 0.8), r: rand(0.26, 0.42), ph: rand(0, TAU),
    pop: rand(0.5, 0.85),
  }));
  const D = second ? 0.7 : 0.8;
  t.draw(D, (g, u) => {
    const time = u * D;
    const out = easeOut(clamp01(time / 0.12));
    for (const b of lobes) {
      const popAt = b.pop * D;
      if (time > popAt + 0.06) continue;
      const shrink = time > popAt ? 1 - (time - popAt) / 0.06 : 1;
      const boil = 1 + 0.12 * Math.sin(time * 26 + b.ph);
      const d = R * b.d * out * (1 + 0.15 * u), rr = R * b.r * (0.35 + 0.65 * out) * boil * shrink;
      const x = c.x + Math.cos(b.a) * d, y = c.y + Math.sin(b.a) * d * 0.9 - u * R * 0.2;
      g.circle(x, y, rr).fill({ color: DEEP, alpha: 0.22 }).stroke({ width: 2, color: ACID, alpha: 0.85 });
      g.circle(x - rr * 0.35, y - rr * 0.38, rr * 0.2).fill({ color: PALE, alpha: 0.7 });
    }
  }, { delay });
  // The second blast's warning: the first foam shuddering, swelling, before
  // it goes.
  if (second)
    t.draw(delay, (g, u) => {
      const q = u * u;
      const rr = R * (0.55 + 0.25 * q) * (1 + 0.06 * Math.sin(u * 60));
      g.circle(c.x + Math.sin(u * 70) * s * 0.02 * q, c.y, rr).stroke({ width: 2 + 3 * q, color: ACID, alpha: 0.3 + 0.5 * q });
    });
}

/** A drop of the formula landing: a small green burst and a ring. */
function pop(t: FxTools, at: Pt, s: number) {
  const w = s * 0.14;
  t.ring({ x: at.x - w / 2, y: at.y - w / 2, w, h: w }, ACID, 0.4, 1.8, 0.25, 2);
  for (let i = 0; i < 3; i++) {
    const a = -Math.PI / 2 + rand(-1, 1), v = rand(40, 90) * (s / 90);
    t.spark(at.x, at.y, Math.cos(a) * v, Math.sin(a) * v, rand(0.12, 0.22), FIZZ);
  }
}
