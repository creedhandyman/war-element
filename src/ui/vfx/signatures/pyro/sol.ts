/** SOL — Pyro Ball Barrage. "Deal 3 DMG up to 4 times to one opponent —
 *  Incinerate ramps each hit." The sun does not stop at one: four hits on a
 *  single target, each one hotter.
 *
 *  On his art Sol is a mage with a head of flame and a blazing sun-disc at his
 *  chest, firing a white-gold solar beam from his palm, small suns hanging in
 *  the air round him, each ringed like a little orrery. The DELIVERY is those
 *  suns kindling: the disc at his chest lights, and one after another four
 *  small suns catch in orbit round him — each a bright disc in a spiked
 *  corona inside a thin ring of its own — every one hotter than the one
 *  before (orange, gold, white-gold, white), wheeling round him as they grow.
 *  The first is already loosed as the delivery ends, so it lands on the
 *  landing frame.
 *
 *  The LANDING is the barrage: the suns leave their orbit one at a time, a
 *  beat apart, each a straight solar bolt that leaves a pulse of beam behind
 *  it from Sol to the mark, as on the art. Each impact is a flare, bigger and
 *  whiter than the last — orange, gold, white-gold — and the fourth goes off
 *  as a small sunburst: rays, a corona ring and a shower of embers. Incinerate
 *  is the ramp, so the ramp is the move.
 *
 *  Sol's fire is SOLAR, not a flame: no tongues and no smoke anywhere, only
 *  discs, coronas, rings and straight light — that is what tells his barrage
 *  from every other PYRO card's fire. All of it is light (additive). */
import type { Graphics } from "pixi.js";
import { centre, rand } from "../../looks/base";
import type { FxTools, Pt, SparkStyle } from "../../looks/types";
import type { Signature, SigMoment } from "../types";

const TAU = Math.PI * 2;
/** The four suns, coolest first: each a core, a body and a halo. The ramp is
 *  the card's Incinerate — every hit hotter than the last. */
const SUNS = [
  { core: 0xffd9a0, body: 0xff8a2a, halo: 0xff5a1a },
  { core: 0xffe8b0, body: 0xffb43a, halo: 0xff8a20 },
  { core: 0xfff6d8, body: 0xffd860, halo: 0xffb030 },
  { core: 0xffffff, body: 0xfff0b0, halo: 0xffd24a },
];
const WHITE = 0xffffff, GOLD = 0xffd24a;
/** Embers off a solar flare: they rise and cool from white-gold to orange. */
const FLARE: SparkStyle = { palette: [WHITE, 0xfff0b0, GOLD, 0xff8a2a], gravity: -140, drag: 0.5, size: [5, 1.5], streak: false };
/** Sparks thrown off an impact: fast, straight, white-hot. */
const SPIT: SparkStyle = { palette: [WHITE, 0xfff0b0, GOLD, 0xff7a2a], gravity: 260, drag: 0.35, size: [6, 1.5], streak: true };
/** Heat drawn in to a sun as it kindles. */
const MOTE: SparkStyle = { palette: [0xfff0b0, GOLD, 0xff8a2a], gravity: 0, drag: 0.6, size: [3.5, 1.2], streak: false };

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeOut = (x: number) => 1 - (1 - x) * (1 - x);

// ── The suns ─────────────────────────────────────────────────────────────────

/** How long a sun takes from its orbit to the mark, s; and the beat between
 *  one hit and the next. */
const FLY = 0.1, BEAT = 0.125;
/** The orbit's turn, radians a second. */
const SPIN = 3.4;

/** Where sun `i` is `tau` seconds from the landing frame (negative in the
 *  delivery): wheeling round Sol's card. Worked out from the landing frame
 *  backwards, so the delivery and the landing agree on where each one is
 *  without sharing anything but the moment. */
function orbitAt(m: SigMoment, i: number, tau: number): Pt {
  const c = centre(m.from), s = m.size;
  // Sun 0 (the first loosed) stands on the side facing the enemy as it goes.
  const base = Math.atan2(m.ahead.y, m.ahead.x) + SPIN * FLY;
  const a = base + SPIN * tau + (i * TAU) / 4;
  return { x: c.x + Math.cos(a) * s * 0.6, y: c.y + Math.sin(a) * s * 0.52 };
}
/** When sun `i` leaves its orbit, s from the landing frame: the first just
 *  before it (so it lands on the frame), then a beat apart. */
const leaveAt = (i: number) => i * BEAT - FLY;
/** A sun's radius: each a little bigger than the last. */
const sunR = (s: number, i: number) => s * (0.09 + 0.016 * i);

/** One small sun, `r` across its disc, `a` bright: a soft halo, a corona of
 *  short spikes that flicker, the disc, its white core — and round it a thin
 *  ring and a broken outer ring turning, like the ringed orbs on Sol's art. */
function sun(g: Graphics, x: number, y: number, r: number, i: number, time: number, a: number, rings = true) {
  if (a <= 0.02 || r < 0.5) return;
  const col = SUNS[i];
  g.circle(x, y, r * 2.4).fill({ color: col.halo, alpha: 0.12 * a });
  const N = 10;
  for (let k = 0; k < N; k++) {
    const ang = time * 1.6 + (k / N) * TAU + i, len = r * (1.5 + 0.35 * Math.sin(time * 19 + k * 2.3 + i));
    const half = (TAU / N) * 0.22;
    g.poly([
      x + Math.cos(ang - half) * r * 0.85, y + Math.sin(ang - half) * r * 0.85,
      x + Math.cos(ang) * len, y + Math.sin(ang) * len,
      x + Math.cos(ang + half) * r * 0.85, y + Math.sin(ang + half) * r * 0.85,
    ], true).fill({ color: col.body, alpha: 0.6 * a });
  }
  g.circle(x, y, r).fill({ color: col.body, alpha: 0.85 * a });
  g.circle(x, y, r * 0.58).fill({ color: col.core, alpha: a });
  if (!rings) return;
  g.circle(x, y, r * 2.0).stroke({ width: 1, color: col.halo, alpha: 0.55 * a });
  for (let k = 0; k < 3; k++) {
    const a0 = -time * 2.2 + (k * TAU) / 3;
    g.moveTo(x + Math.cos(a0) * r * 2.6, y + Math.sin(a0) * r * 2.6).arc(x, y, r * 2.6, a0, a0 + TAU / 5).stroke({ width: 1.2, color: col.body, alpha: 0.5 * a });
  }
}

/** The sun-disc at Sol's chest: it lights first and flares with every shot. */
function chestDisc(g: Graphics, c: Pt, s: number, time: number, k: number, flare: number) {
  if (k <= 0.02) return;
  const r = s * (0.07 + 0.03 * flare), N = 12;
  g.circle(c.x, c.y, r * (2.2 + flare)).fill({ color: 0xff8a2a, alpha: (0.12 + 0.2 * flare) * k });
  for (let j = 0; j < N; j++) {
    const ang = -time * 0.9 + (j / N) * TAU, len = r * (1.8 + 0.5 * flare + 0.25 * Math.sin(time * 13 + j * 1.7));
    g.moveTo(c.x + Math.cos(ang) * r, c.y + Math.sin(ang) * r).lineTo(c.x + Math.cos(ang) * len, c.y + Math.sin(ang) * len)
      .stroke({ width: 1.6, color: GOLD, alpha: 0.75 * k });
  }
  g.circle(c.x, c.y, r).fill({ color: 0xffb43a, alpha: 0.85 * k });
  g.circle(c.x, c.y, r * 0.55).fill({ color: WHITE, alpha: (0.7 + 0.3 * flare) * k });
}
const chestAt = (m: SigMoment): Pt => {
  const c = centre(m.from);
  return { x: c.x, y: c.y + m.size * 0.06 };
};

/** Where on the mark each sun strikes: a little scatter, so four hits read
 *  as four, closing in on the centre as they heat up. */
function hitPoint(m: SigMoment, i: number): Pt {
  const p = centre(m.targets[0]), s = m.size, spread = s * 0.13 * (1 - i / 4);
  const a = Math.atan2(m.ahead.y, m.ahead.x) + Math.PI / 2 + i * 2.1;
  return { x: p.x + Math.cos(a) * spread, y: p.y + Math.sin(a) * spread };
}

/** A sun loosed as a solar bolt: from where it is in its orbit as it leaves,
 *  straight to `to` in FLY seconds, a white streak behind its head — and as it
 *  strikes, the beam it leaves behind flashes along the whole line from Sol
 *  to the mark and thins away, a pulse of the beam on his art. */
function bolt(t: FxTools, from: Pt, to: Pt, i: number, s: number, delay: number, onArrive: () => void) {
  const r = sunR(s, i), col = SUNS[i], D = FLY + 0.16;
  t.draw(D, (g, u) => {
    const time = u * D, q = clamp01(time / FLY), e = q * (0.6 + 0.4 * q);
    const hx = from.x + (to.x - from.x) * e, hy = from.y + (to.y - from.y) * e;
    if (time < FLY) {
      const f0 = Math.max(0, e - 0.5), tx = from.x + (to.x - from.x) * f0, ty = from.y + (to.y - from.y) * f0;
      g.moveTo(tx, ty).lineTo(hx, hy).stroke({ width: r * 2.2, color: col.halo, alpha: 0.28, cap: "round" });
      g.moveTo(tx, ty).lineTo(hx, hy).stroke({ width: r * 1.1, color: col.body, alpha: 0.65, cap: "round" });
      g.moveTo(tx, ty).lineTo(hx, hy).stroke({ width: Math.max(1.2, r * 0.4), color: WHITE, alpha: 0.9, cap: "round" });
      sun(g, hx, hy, r, i, time, 1, false);
      return;
    }
    // The beam: the whole line, thinning as it fades.
    const k = 1 - (time - FLY) / (D - FLY), w = r * (0.5 + 1.1 * k) * (0.8 + 0.12 * i);
    g.moveTo(from.x, from.y).lineTo(to.x, to.y).stroke({ width: w * 2.2, color: col.halo, alpha: 0.22 * k, cap: "round" });
    g.moveTo(from.x, from.y).lineTo(to.x, to.y).stroke({ width: w, color: col.body, alpha: 0.55 * k, cap: "round" });
    g.moveTo(from.x, from.y).lineTo(to.x, to.y).stroke({ width: Math.max(1, w * 0.35), color: WHITE, alpha: 0.85 * k, cap: "round" });
  }, { delay });
  t.later(delay + FLY, onArrive);
}

/** A sun striking: a flare on the mark — a disc of its colour bursting out,
 *  a ring of corona spikes thrown wide, sparks spat off it — bigger and whiter
 *  with every hit. The fourth is a SUNBURST: rays, a ring of white-gold and a
 *  shower of embers, and it lingers a moment. */
function flare(t: FxTools, p: Pt, i: number, power: number, s: number, killed: boolean) {
  const col = SUNS[i], k = (0.62 + 0.2 * i) * Math.max(0.8, Math.min(1.5, power)), last = i === 3;
  const R = s * 0.34 * k, D = 0.26 + 0.06 * i + (last ? 0.2 : 0), seed = rand(0, TAU);
  t.flash(p, col.body, (0.22 + 0.08 * i) * k * (s / 90));
  t.draw(D, (g, u) => {
    const grow = easeOut(clamp01(u / 0.3)), fade = u < 0.25 ? 1 : 1 - (u - 0.25) / 0.75;
    g.circle(p.x, p.y, R * (0.55 + 0.65 * grow)).fill({ color: col.halo, alpha: 0.32 * fade });
    // The corona thrown off it: spikes riding out on the edge of the flare.
    const N = 12 + 2 * i;
    for (let j = 0; j < N; j++) {
      const ang = seed + (j / N) * TAU, r0 = R * (0.45 + 0.75 * grow), len = R * (0.35 + 0.25 * Math.sin(j * 2.7 + seed)) * (1 - 0.5 * u);
      const half = (TAU / N) * 0.2;
      g.poly([
        p.x + Math.cos(ang - half) * r0, p.y + Math.sin(ang - half) * r0,
        p.x + Math.cos(ang) * (r0 + len), p.y + Math.sin(ang) * (r0 + len),
        p.x + Math.cos(ang + half) * r0, p.y + Math.sin(ang + half) * r0,
      ], true).fill({ color: col.body, alpha: 0.65 * fade });
    }
    g.circle(p.x, p.y, R * 0.5 * (1 - 0.4 * u)).fill({ color: col.body, alpha: 0.8 * fade });
    g.circle(p.x, p.y, R * 0.3 * (1 - 0.5 * u)).fill({ color: col.core, alpha: fade });
  });
  const box = { x: p.x - R * 0.5, y: p.y - R * 0.5, w: R, h: R };
  t.ring(box, col.body, 0.6, 2.0 + 0.4 * i, 0.3, 2 + i);
  const n = Math.round((5 + 3 * i) * Math.min(1.3, k));
  for (let j = 0; j < n; j++) {
    const a = rand(0, TAU), v = rand(110, 240) * (s / 90) * (0.8 + 0.15 * i);
    t.spark(p.x, p.y, Math.cos(a) * v, Math.sin(a) * v, rand(0.18, 0.32), SPIT);
  }
  if (!last) return;
  // THE SUNBURST.
  t.rays(p, [WHITE, 0xfff0b0, GOLD], 0.36 * k * (s / 90), 14);
  t.glow({ x: p.x - s * 0.5, y: p.y - s * 0.5, w: s, h: s }, GOLD, 0.45, 0.55, 1.4);
  t.ring({ x: p.x - s * 0.5, y: p.y - s * 0.5, w: s, h: s }, 0xfff0b0, 0.3, 1.5, 0.45, 5);
  const em = Math.round(14 * t.quality * Math.min(1.3, k));
  for (let j = 0; j < em; j++) {
    const a = rand(0, TAU), v = rand(40, 130) * (s / 90);
    t.spark(p.x + Math.cos(a) * R * 0.4, p.y + Math.sin(a) * R * 0.4, Math.cos(a) * v, Math.sin(a) * v - 30 * (s / 90), rand(0.45, 0.75), FLARE);
  }
  // What it burned down keeps a little sun of its own a moment longer.
  if (killed) t.later(0.12, () => t.glow({ x: p.x - s * 0.4, y: p.y - s * 0.4, w: s * 0.8, h: s * 0.8 }, 0xfff0b0, 0.6, 0.6, 1.2));
}

export const SOL: Signature = {
  shake: 0.9,
  lunge: false,

  deliver(t: FxTools, m: SigMoment, seconds: number) {
    const T = seconds, s = m.size, ch = chestAt(m);
    if (!m.targets.length) return;
    // When each sun catches: one after another, the last well before the
    // first is loosed; all of it fitted to however long the delivery runs.
    const lit = (i: number) => T * (0.1 + 0.15 * i);
    const grow = T * 0.2;
    const go0 = T + leaveAt(0);
    // THE ORBIT: the chest disc lighting, the suns catching round it.
    t.draw(T, (g, u) => {
      const time = u * T, tau = time - T;
      chestDisc(g, ch, s, time, clamp01(time / (T * 0.15)), 0.4 * clamp01(time / T));
      for (let i = 0; i < 4; i++) {
        if (i === 0 && time >= go0) continue;
        const k = easeOut(clamp01((time - lit(i)) / grow));
        if (k <= 0) continue;
        const p = orbitAt(m, i, tau), bright = 0.75 + 0.25 * Math.sin(time * 9 + i);
        sun(g, p.x, p.y, sunR(s, i) * (0.4 + 0.6 * k), i, time, k * bright);
      }
    });
    t.charge(ch, s * 0.9, GOLD, 0.3, T);
    // Heat drawn in to each sun as it catches.
    for (let i = 0; i < 4; i++) {
      const n = Math.round(4 * t.quality);
      for (let j = 0; j < n; j++)
        t.later(lit(i) + rand(0, grow), () => {
          const time = lit(i) + grow * 0.5, p = orbitAt(m, i, time - T), a = rand(0, TAU), d = s * rand(0.14, 0.22), life = rand(0.12, 0.18);
          t.spark(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, (-Math.cos(a) * d) / life, (-Math.sin(a) * d) / life, life, MOTE);
        });
    }
    // THE FIRST SUN, loosed so it lands on the landing frame.
    t.later(go0, () => t.flash(orbitAt(m, 0, leaveAt(0)), SUNS[0].body, 0.08 * (s / 90)));
    bolt(t, orbitAt(m, 0, leaveAt(0)), hitPoint(m, 0), 0, s, Math.max(0, go0), () => {});
  },

  land(t: FxTools, m: SigMoment) {
    const s = m.size, ch = chestAt(m);
    if (!m.targets.length) return;
    const power = m.power[0] ?? 1, killed = !!m.killed[0];
    // The first sun is landing now (loosed in the delivery)...
    flare(t, hitPoint(m, 0), 0, power, s, false);
    // ...and the rest are loosed a beat apart, each landing a beat later.
    for (let i = 1; i < 4; i++)
      bolt(t, orbitAt(m, i, leaveAt(i)), hitPoint(m, i), i, s, leaveAt(i), () => flare(t, hitPoint(m, i), i, power, s, killed && i === 3));
    // The suns still waiting keep wheeling till they go, and the chest disc
    // flares with every one loosed.
    const D = leaveAt(3) + 0.25;
    t.draw(D, (g, u) => {
      const time = u * D;
      let fl = 0;
      for (let i = 1; i < 4; i++) fl = Math.max(fl, Math.exp(-(((time - leaveAt(i)) / 0.05) ** 2)));
      chestDisc(g, ch, s, time + 1, 1 - clamp01((time - leaveAt(3) - 0.05) / 0.2), 0.4 + 0.6 * fl);
      for (let i = 1; i < 4; i++) {
        if (time >= leaveAt(i)) continue;
        const p = orbitAt(m, i, time);
        sun(g, p.x, p.y, sunR(s, i), i, time + 1, 0.85 + 0.15 * Math.sin(time * 9 + i));
      }
    });
  },
};
