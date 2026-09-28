/** UMBRANOVA — Meteor Fall. "The sky falls: 12 DMG to every opponent on the
 *  board, through shields, wherever they stand. Each cast makes the next one
 *  worse." Lore: "It is not aiming. There is nowhere it is not aiming."
 *
 *  The DELIVERY is the sky going dark: a shadow comes down over the whole
 *  board, the sky above it smoulders red, embers stream up off Umbranova into
 *  it — and the first rocks are already falling out of it.
 *
 *  The LANDING is the sky falling. One meteor for every card it hits, and they
 *  are FEW and HUGE, not a shower of sparks: a black rock with a molten rim and
 *  lava in its cracks, wrapped in fire, a streak burned into the air behind it,
 *  coming steep out of the top of the board and still accelerating. They come
 *  down in a ragged volley, the first on the landing frame, and each one
 *  craters where it hits: a flash, a shock ring, a pit of scorched ground with
 *  a glowing lip, molten rock thrown out and fire standing up out of the hole.
 *  Then the shadow lifts.
 *
 *  A meteor's path and time are worked out from its target alone, never by
 *  chance, so the ones still falling when the delivery hands over are picked
 *  up exactly where they were by the landing. Each is as big as its hit —
 *  every cast worse than the last. */
import { centre, rand } from "../looks/base";
import {
  AMBER, EMBER, F_CORE, F_OUT, ORANGE, RED, WHITE,
  pyroFire, pyroFlame, pyroFlick,
} from "../looks/fire";
import type { FxTools, Pt, SparkStyle } from "../looks/types";
import type { Signature, SigMoment } from "./types";

type Box = { x: number; y: number; w: number; h: number };

const TAU = Math.PI * 2;
/** The rock (normal blend, real darkness), the sky's shadow, and a crater's
 *  scorch. */
const ROCK = 0x1a0c07, SHADOW = 0x06020a, PIT = 0x140604;
/** Lava: the light in a meteor's cracks and on a crater's lip. */
const MAGMA = 0xff5a1a;
/** Molten rock thrown out of a crater: heavy, falling, cooling. */
const CHUNK: SparkStyle = { palette: [WHITE, AMBER, ORANGE, RED], gravity: 900, drag: 0.55, size: [8, 3], streak: false };
/** Burning grit shed off a meteor as it falls. */
const SHED: SparkStyle = { palette: [AMBER, ORANGE, RED], gravity: -60, drag: 0.5, size: [6, 2], streak: false };
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeOut = (x: number) => 1 - (1 - x) * (1 - x);
const frac = (x: number) => x - Math.floor(x);

/** A meteor's fall, s; the spread of the volley after the landing frame; how
 *  dark the sky gets. */
const FALL = 0.5, VOLLEY = 0.3, VEIL = 0.5;

/** When target i's meteor lands, s after the landing frame: a ragged volley,
 *  the same answer for the delivery and the landing. */
const impactAt = (i: number) => VOLLEY * frac(i * 0.618034);

/** Target i's meteor: from high above the board — every one on the same
 *  steep slant, so they read as one sky falling — onto the card. */
function skyline(m: SigMoment, i: number): { from: Pt; to: Pt; r: number; spin: number } {
  const to = centre(m.targets[i]), s = m.size;
  const top = m.board.y - s * (0.9 + 0.4 * frac(i * 0.414214));
  const slant = 0.3 + 0.12 * frac(i * 0.732051);
  const drop = Math.max(s, to.y - top);
  const k = Math.max(0.8, Math.min(1.8, m.power[i] ?? 1));
  return { from: { x: to.x - drop * slant, y: to.y - drop }, to, r: s * 0.17 * k, spin: frac(i * 0.3183) * TAU };
}

/** A lumpy rock of radius r turned to `rot`, as points. */
function rock(c: Pt, r: number, rot: number, seed: number): number[] {
  const pts: number[] = [];
  for (let i = 0; i < 8; i++) {
    const a = rot + (i / 8) * TAU, rr = r * (0.78 + 0.22 * frac(Math.sin(seed + i * 12.9898) * 43758.5453));
    pts.push(c.x + Math.cos(a) * rr, c.y + Math.sin(a) * rr);
  }
  return pts;
}

/** Where a meteor is at `q` (0 high in the sky, 1 on the card): it
 *  accelerates the whole way down. */
function fallAt(l: { from: Pt; to: Pt }, q: number): Pt {
  const e = q * q;
  return { x: l.from.x + (l.to.x - l.from.x) * e, y: l.from.y + (l.to.y - l.from.y) * e };
}

/** The meteors in the air at `left(i)` seconds from their impacts: the light
 *  of them (additive) and the rock (dark) as two draws on one clock, and the
 *  grit they shed. `left(i)` < 0 has landed; > FALL has not appeared yet. */
function meteors(t: FxTools, m: SigMoment, seconds: number, left: (i: number, time: number) => number) {
  const lines = m.targets.map((_, i) => skyline(m, i));
  // Shape and spin come from the line and the time to impact too, so a rock
  // handed over mid-fall keeps its outline and its turn.
  const seeds = lines.map((l) => l.spin * 17.3);
  const shed = lines.map(() => 0);
  const each = share(lines.length);
  t.draw(seconds, (g, u, dt) => {
    const time = u * seconds;
    lines.forEach((l, i) => {
      const lf = left(i, time);
      if (lf < 0 || lf > FALL) return;
      const q = 1 - lf / FALL, p = fallAt(l, q), r = l.r;
      const dx = l.to.x - l.from.x, dy = l.to.y - l.from.y, dl = Math.hypot(dx, dy) || 1;
      const ux = dx / dl, uy = dy / dl;
      const a = Math.min(1, q * 8);
      // The streak it burns into the air: a tapered wake back up its line.
      const back = fallAt(l, Math.max(0, q - 0.3));
      const nx = -uy, ny = ux, w = r * 1.5;
      g.poly([p.x + nx * w, p.y + ny * w, back.x, back.y, p.x - nx * w, p.y - ny * w]).fill({ color: F_OUT, alpha: 0.32 * a });
      g.poly([p.x + nx * w * 0.45, p.y + ny * w * 0.45, back.x, back.y, p.x - nx * w * 0.45, p.y - ny * w * 0.45])
        .fill({ color: AMBER, alpha: 0.45 * a });
      // Fire streaming off its back, longer the faster it falls.
      for (let j = -1; j <= 1; j++) {
        const cs = Math.cos(j * 0.35), sn = Math.sin(j * 0.35);
        const bx = -ux * cs + uy * sn, by = -uy * cs - ux * sn;
        const len = r * (2.4 + 3 * q) * (j === 0 ? 1.15 : 0.8) * (1 + 0.2 * pyroFlick(time, seeds[i] + j));
        pyroFlame(g, p.x - ux * r * 0.3, p.y - uy * r * 0.3, bx, by, len, r * 1.9, r * 0.35 * pyroFlick(time * 1.3, seeds[i] + j * 2), a);
      }
      // The envelope round the rock, and its molten rim and cracks.
      g.circle(p.x, p.y, r * 1.35).stroke({ width: r * 0.7, color: F_OUT, alpha: 0.4 * a });
      g.poly(rock(p, r, l.spin - lf * 3, seeds[i])).stroke({ width: 2, color: MAGMA, alpha: 0.95 * a });
      const cr = l.spin - lf * 3;
      g.moveTo(p.x + Math.cos(cr) * r * 0.55, p.y + Math.sin(cr) * r * 0.55).lineTo(p.x, p.y)
        .lineTo(p.x + Math.cos(cr + 2.3) * r * 0.5, p.y + Math.sin(cr + 2.3) * r * 0.5)
        .stroke({ width: 1.5, color: AMBER, alpha: 0.85 * a });
      shed[i] += dt * 36 * t.quality * each;
      for (; shed[i] >= 1; shed[i]--)
        t.spark(p.x + rand(-r, r), p.y + rand(-r, r), -ux * rand(30, 80) + rand(-20, 20), -uy * rand(30, 80), rand(0.25, 0.45), SHED);
    });
  });
  t.draw(seconds, (g, u) => {
    const time = u * seconds;
    lines.forEach((l, i) => {
      const lf = left(i, time);
      if (lf < 0 || lf > FALL) return;
      const q = 1 - lf / FALL;
      g.poly(rock(fallAt(l, q), l.r, l.spin - lf * 3, seeds[i])).fill({ color: ROCK, alpha: 0.95 * Math.min(1, q * 8) });
    });
  }, { dark: true });
}

/** The sky's shadow over the whole board, and the sky above it smouldering:
 *  `dim(u)` 0..1 over `seconds`. */
function sky(t: FxTools, b: Box, s: number, seconds: number, dim: (u: number) => number) {
  t.draw(seconds, (g, u) => {
    g.rect(b.x, b.y, b.w, b.h).fill({ color: SHADOW, alpha: VEIL * dim(u) });
  }, { dark: true });
  t.draw(seconds, (g, u) => {
    const a = dim(u);
    // Red low in the sky, brightest at the board's top edge: stacked bands.
    for (let i = 1; i <= 4; i++) g.rect(b.x, b.y - s * 0.4, b.w, s * 0.4 + (s * 0.55 * i) / 4).fill({ color: RED, alpha: 0.05 * a });
    g.rect(b.x, b.y - 2, b.w, 3).fill({ color: F_OUT, alpha: 0.5 * a });
  });
}

/** Each meteor's share of the sparks when `n` fall at once: the sky can fall
 *  on a whole board, and eight craters at full grit would bury the frame. */
const share = (n: number) => Math.min(1, 5 / Math.max(1, n));

/** A meteor striking a card: a flash, a shock ring, a pit of scorched ground
 *  with a lip that glows and cools, fire standing up out of it, and molten
 *  rock thrown out ahead of the rock's line. `each`: its share of the grit. */
function crater(t: FxTools, r: Box, power: number, s: number, dir: Pt, killed: boolean, each = 1) {
  const c = centre(r), k = Math.max(0.8, Math.min(1.8, power));
  const R = s * 0.34 * k, seed = rand(0, 100);
  t.flash(c, AMBER, 1.1 * k * (s / 90));
  t.ring(r, AMBER, 0.25, 1.7 * k, 0.45, 6);
  t.glow(r, ORANGE, 0.55, 0.55, 1.2);
  t.draw(1.0, (g, u) => {
    g.ellipse(c.x, c.y + s * 0.08, R, R * 0.72).fill({ color: PIT, alpha: 0.6 * Math.min(1, u * 12) * Math.pow(1 - u, 1.2) });
  }, { dark: true });
  t.draw(1.0, (g, u) => {
    const cool = u < 0.3 ? AMBER : u < 0.6 ? ORANGE : RED;
    const a = Math.min(1, u * 12) * Math.pow(1 - u, 1.1);
    g.ellipse(c.x, c.y + s * 0.08, R, R * 0.72).stroke({ width: 3.5, color: cool, alpha: 0.9 * a });
    g.ellipse(c.x, c.y + s * 0.08, R * 0.6, R * 0.43).fill({ color: F_OUT, alpha: 0.35 * a });
  });
  // Fire standing up out of the hole: a bloom that lifts and burns down.
  const tips: Pt[] = [];
  const n = 8, B = s * 0.5 * k;
  pyroFire(t, {
    seconds: killed ? 0.8 : 0.65,
    body: (g, time, kk) => {
      const grow = kk < 0.15 ? easeOut(kk / 0.15) : 1, fade = kk < 0.3 ? 1 : 1 - (kk - 0.3) / 0.7;
      const lift = kk * B * 0.4;
      g.circle(c.x, c.y - lift, B * 0.4 * grow * (1 - 0.4 * kk)).fill({ color: F_CORE, alpha: 0.5 * fade });
      tips.length = 0;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU + seed;
        let ux = Math.cos(a), uy = Math.sin(a) - 0.8;
        const l = Math.hypot(ux, uy) || 1;
        ux /= l; uy /= l;
        const len = B * (0.9 + 0.35 * Math.sin(seed + i * 2.3)) * grow * (1 - 0.4 * kk) * (1 + 0.2 * pyroFlick(time, seed + i));
        const bx = c.x + ux * B * 0.15, by = c.y - lift + uy * B * 0.15;
        pyroFlame(g, bx, by, ux, uy, len, B * 0.45, len * 0.2 * pyroFlick(time * 0.8, seed + i * 1.7), fade);
        tips.push({ x: bx + ux * len, y: by + uy * len });
      }
    },
    wisp: () => (tips.length ? tips[Math.floor(Math.random() * tips.length)] : null), wispRate: 20, wispSize: B * 0.25,
    puff: (kk) => (kk > 0.2 ? { x: c.x + rand(-0.3, 0.3) * B, y: c.y - B * 0.6 } : null), smokeRate: 7, smokeSize: B * 0.4,
  });
  // Molten rock thrown out, mostly on along the line it came in on.
  const chunks = Math.round(9 * k * Math.max(0.5, t.quality) * each);
  const along = Math.atan2(dir.y, dir.x);
  for (let i = 0; i < chunks; i++) {
    const a = (i % 3 === 0 ? rand(0, TAU) : along + rand(-1.2, 1.2)) - 0.9, v = rand(140, 320) * (s / 90);
    t.spark(c.x, c.y, Math.cos(a) * v, Math.sin(a) * v - rand(60, 160) * (s / 90), rand(0.35, 0.6), { ...CHUNK, gravity: CHUNK.gravity * (s / 90) });
  }
  for (let i = 0; i < Math.round(6 * each); i++) t.spark(c.x + rand(-R, R), c.y, rand(-20, 20), -rand(50, 120), rand(0.5, 0.9), EMBER);
}

export const UMBRANOVA: Signature = {
  shake: 2,

  deliver(t: FxTools, m: SigMoment, seconds: number) {
    const c = centre(m.from), s = m.size, T = seconds;
    // THE SKY GOES DARK over everything, and smoulders.
    sky(t, m.board, s, T, (u) => easeOut(clamp01(u / 0.7)));
    // Embers streaming up off Umbranova into it: it is calling them down.
    let acc = 0;
    t.draw(T, (_g, u, dt) => {
      if (u > 0.85) return;
      acc += dt * 40 * t.quality;
      for (; acc >= 1; acc--)
        t.spark(c.x + rand(-0.35, 0.35) * s, c.y + rand(-0.2, 0.3) * s, rand(-25, 25), -rand(180, 320) * (s / 90), rand(0.4, 0.7), EMBER);
    });
    t.charge(c, s * 1.4, RED, 0.5, T);
    // The meteors that land on the landing frame (or soon after) are already
    // falling; the landing picks them up where they are.
    meteors(t, m, T, (i, time) => T + impactAt(i) - time);
  },

  land(t: FxTools, m: SigMoment) {
    const s = m.size;
    // The sky falls on nothing it could hit: a few rocks come down on the far
    // side anyway (the shadow having to fall too, with no delivery before it).
    if (m.targets.length === 0) {
      sky(t, m.board, s, FALL + 0.7, (u) => {
        const time = u * (FALL + 0.7);
        return time < FALL ? easeOut(time / FALL) : Math.pow(1 - (time - FALL) / 0.7, 1.5);
      });
      const b = m.board, down = m.ahead.y >= 0;
      const aims = [0, 1, 2].map((i) => {
        const x = b.x + b.w * (0.2 + 0.3 * i), y = b.y + b.h * (down ? rand(0.6, 0.85) : rand(0.15, 0.4));
        return { x: x - s / 2, y: y - s / 2, w: s, h: s };
      });
      volley({ ...m, targets: aims, power: [1, 1, 1], killed: [false, false, false] }, t, FALL);
      return;
    }
    // THE SHADOW LIFTS as the volley lands...
    sky(t, m.board, s, 0.75, (u) => Math.pow(1 - u, 1.5));
    volley(m, t, 0);
  },
};

/** The rest of the volley still falling, on the same clock the delivery
 *  started it on, and every one of them cratering where it lands — `lead`
 *  seconds later when the landing has to drop them from the sky itself. */
function volley(m: SigMoment, t: FxTools, lead: number) {
  const s = m.size, each = share(m.targets.length);
  meteors(t, m, lead + VOLLEY + 0.02, (i, time) => lead + impactAt(i) - time);
  m.targets.forEach((r, i) => {
    const l = skyline(m, i), d = Math.hypot(l.to.x - l.from.x, l.to.y - l.from.y) || 1;
    const dir = { x: (l.to.x - l.from.x) / d, y: (l.to.y - l.from.y) / d };
    t.later(lead + impactAt(i), () => crater(t, r, m.power[i] ?? 1, s, dir, !!m.killed[i], each));
  });
}
