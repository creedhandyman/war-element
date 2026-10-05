/** AFTERMATH — Smog. "Blanket your side in smoke for 2 rounds — basic attacks
 *  on your cards have a 25% chance to miss." The blast first, the smoke after.
 *
 *  Its art is a hooded figure of ash and soot in a grey haze, burning-ember
 *  eyes, holding up a spiked black bomb with glowing vents while a ruined
 *  city smoulders behind. Its fire is the fire AFTER a fire: no flame at all,
 *  only ash, soot and the embers left glowing in it.
 *
 *  It aims at nothing, so there is no delivery: the LANDING is the whole
 *  move. The spiked bomb comes up over its card, its round vents glowing, and
 *  vents — a hiss of embers jetting out of each port. Then the smog comes:
 *  thick grey-black clouds billowing off the bomb, slow and heavy, rolling
 *  out over the ground to every card on its side, and settling on each as a
 *  low haze over the lower half of the card, lit from beneath by embers
 *  drifting in it. The smog thins away as the move ends; the game draws the
 *  cover itself from then on.
 *
 *  Smog is dark, so it is drawn dark for real (`dark: true`) — and every
 *  cloud carries two lit rims over it, ash-grey along its top where the
 *  smoulder catches it and ember-orange underneath, so it reads over the
 *  near-black board and stays a cloud rather than a hole. It covers only the
 *  lower half of a card, so the card reads through it. */
import { centre, rand } from "../../looks/base";
import type { FxTools, Pt, SparkStyle } from "../../looks/types";
import type { Signature, SigMoment } from "../types";

type Box = SigMoment["from"];

const TAU = Math.PI * 2;
/** Smog, on the dark layer: a warm soot-black, not a shadow. */
const SMOG = 0x17120f, BOMB = 0x0c0908;
// Light on it: the ash the smoulder catches, and the embers under it.
const ASH = 0x9c948c, ASH_HI = 0xd6cec4, EMBER_C = 0xff6e26, EMBER_HOT = 0xffc25a, WHITE = 0xfff2d8;
/** The hiss out of a vent: fast, hot, short. */
const HISS: SparkStyle = { palette: [WHITE, EMBER_HOT, EMBER_C, 0x7a2a10], gravity: -40, drag: 0.45, size: [6, 1.5], streak: true };
/** Embers adrift in the haze: slow, rising a little, cooling. */
const DRIFT: SparkStyle = { palette: [EMBER_HOT, EMBER_C, 0xa83414], gravity: -35, drag: 0.7, size: [3.5, 1.5], streak: false };

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeOut = (x: number) => 1 - (1 - x) * (1 - x);
/** Slower out than easeOut: a heavy cloud coasting to a stop. */
const coast = (x: number) => 1 - Math.pow(1 - x, 3);

/** When the bomb vents, and when the smog begins to thin, s. */
const VENT = 0.1, THIN = 0.85, GONE = 1.25;

// ── Smog ─────────────────────────────────────────────────────────────────────

/** A cloud of smog: billowing from `a` to `b`, born at `at`, `run` long,
 *  swelling from `r0` to `r1`, and rolling on `roll` px/s once it settles. */
interface Puff { a: Pt; b: Pt; at: number; run: number; r0: number; r1: number; seed: number; roll: number }

/** A cloud's outline: five lobes, turning slowly as it rolls. */
function cloud(x: number, y: number, r: number, seed: number, time: number, a0 = 0, a1 = TAU): number[] {
  const pts: number[] = [], n = 22;
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    const k = 1 + 0.1 * Math.sin(4 * a + seed + time * 1.2) + 0.05 * Math.sin(3 * a - seed * 1.3);
    pts.push(x + Math.cos(a) * r * k, y + Math.sin(a) * r * k * 0.82);
  }
  return pts;
}

function puffAt(p: Puff, time: number, s: number) {
  const q = coast(clamp01((time - p.at) / p.run)), settled = Math.max(0, time - p.at - p.run);
  return {
    x: p.a.x + (p.b.x - p.a.x) * q + p.roll * settled + Math.sin(time * 1.6 + p.seed) * s * 0.015,
    y: p.a.y + (p.b.y - p.a.y) * q + Math.cos(time * 1.3 + p.seed) * s * 0.01,
    r: (p.r0 + (p.r1 - p.r0) * easeOut(q)) * (1 + 0.04 * Math.sin(time * 3 + p.seed)),
    a: clamp01((time - p.at) / 0.08) * (1 - clamp01((time - THIN - (p.seed % 1) * 0.1) / (GONE - THIN - 0.1))),
  };
}

/** Clouds settling onto a card: from the bomb to points over its lower
 *  half, the far ones taking longer. */
function hazeOn(r: Box, from: Pt, n: number, at0: number, s: number): Puff[] {
  const c = centre(r), d = Math.hypot(c.x - from.x, c.y - from.y) / s;
  return Array.from({ length: n }, (_, i) => {
    const f = n > 1 ? i / (n - 1) - 0.5 : 0;
    return {
      a: { x: from.x + rand(-0.08, 0.08) * s, y: from.y + rand(-0.06, 0.06) * s },
      b: { x: c.x + f * s * 0.62 + rand(-0.05, 0.05) * s, y: c.y + s * rand(0.08, 0.28) },
      at: at0 + i * 0.03 + rand(0, 0.025), run: 0.22 + 0.09 * d, r0: s * 0.15, r1: s * rand(0.19, 0.25),
      seed: rand(0, 100), roll: rand(-6, 6) * (s / 90),
    };
  });
}

export const AFTERMATH: Signature = {
  // Smoke, not a blast: the board barely stirs.
  shake: 0.3,
  // It stays where it stands; the smog does the travelling.
  lunge: false,

  land(t: FxTools, m: SigMoment) {
    const r = m.from, s = m.size;
    // The bomb, held up where it is on the art: high on the card's right.
    const B = { x: r.x + r.w * 0.66, y: r.y + r.h * 0.32 }, R = s * 0.16;
    bomb(t, B, R, s);
    // THE SMOG: off the bomb over its own card first, then out to every ally,
    // the nearest first.
    const n = Math.max(3, Math.round(5 * t.quality));
    const puffs: Puff[] = hazeOn(r, B, n, VENT + 0.04, s);
    const allies = m.allies.map((a) => ({ a, d: Math.hypot(centre(a).x - B.x, centre(a).y - B.y) })).sort((x, y) => x.d - y.d);
    allies.forEach(({ a }, i) => puffs.push(...hazeOn(a, B, n, VENT + 0.12 + i * 0.03, s)));
    // A few that billow round the bomb and go nowhere: the cloud it stands in.
    for (let i = 0; i < 3; i++) {
      const ang = rand(0, TAU);
      puffs.push({ a: B, b: { x: B.x + Math.cos(ang) * s * 0.3, y: B.y + Math.sin(ang) * s * 0.22 }, at: VENT + i * 0.06, run: 0.45,
        r0: s * 0.06, r1: s * rand(0.2, 0.26), seed: rand(0, 100), roll: 0 });
    }
    t.draw(GONE, (g, u) => {
      const time = u * GONE;
      for (const p of puffs) {
        const q = puffAt(p, time, s);
        if (q.a > 0.02) g.poly(cloud(q.x, q.y, q.r, p.seed, time), true).fill({ color: SMOG, alpha: 0.6 * q.a });
      }
    }, { dark: true });
    t.draw(GONE, (g, u) => {
      const time = u * GONE;
      for (const p of puffs) {
        const q = puffAt(p, time, s);
        if (q.a <= 0.02) continue;
        // The body of it, faintly lit grey: where clouds overlap the smog
        // thickens, so it reads as volume rather than outlines.
        g.poly(cloud(q.x, q.y, q.r, p.seed, time), true).fill({ color: ASH, alpha: 0.09 * q.a });
        g.poly(cloud(q.x, q.y, q.r * 0.9, p.seed, time, Math.PI * 0.15, Math.PI * 0.85), false).stroke({ width: q.r * 0.35, color: EMBER_C, alpha: 0.08 * q.a, join: "round" });
        // Ash-grey along its top, where the smoulder catches it...
        g.poly(cloud(q.x, q.y, q.r, p.seed, time, Math.PI * 1.08, Math.PI * 1.92), false).stroke({ width: 1.3, color: ASH, alpha: 0.32 * q.a, join: "round" });
        // ...and ember-orange underneath, lit by what is still burning.
        g.poly(cloud(q.x, q.y, q.r, p.seed, time, Math.PI * 0.2, Math.PI * 0.8), false).stroke({ width: 1.6, color: EMBER_C, alpha: 0.45 * q.a, join: "round" });
      }
    });
    // Embers adrift in the haze on every card it settles on.
    for (const card of [r, ...m.allies]) driftIn(t, card, s);
  },
};

/** THE BOMB: a spiked black sphere coming up over the card, its three round
 *  vents glowing hotter and hotter — then venting, a hiss of embers jetting
 *  from every port — and lost in its own smog. */
function bomb(t: FxTools, B: Pt, R: number, s: number) {
  const sc = s / 90, D = 0.6, spin = rand(0, TAU);
  const vents = [-2.3, -0.75, 1.15].map((a) => ({ a: a + spin * 0.1, x: B.x + Math.cos(a + spin * 0.1) * R * 0.52, y: B.y + Math.sin(a + spin * 0.1) * R * 0.52 }));
  const grow = (time: number) => 0.6 + 0.4 * easeOut(clamp01(time / 0.08));
  const fade = (time: number) => 1 - clamp01((time - 0.42) / (D - 0.42));
  /** The spikes: eight blunt cones off its shell. */
  const spikes = (k: number) => Array.from({ length: 8 }, (_, i) => {
    const a = spin + (i / 8) * TAU, w = 0.2;
    return [B.x + Math.cos(a - w) * R * k * 0.92, B.y + Math.sin(a - w) * R * k * 0.92, B.x + Math.cos(a) * R * k * 1.45, B.y + Math.sin(a) * R * k * 1.45,
      B.x + Math.cos(a + w) * R * k * 0.92, B.y + Math.sin(a + w) * R * k * 0.92];
  });
  t.draw(D, (g, u) => {
    const time = u * D, k = grow(time), a = fade(time);
    g.circle(B.x, B.y, R * k).fill({ color: BOMB, alpha: 0.95 * a });
    for (const sp of spikes(k)) g.poly(sp, true).fill({ color: BOMB, alpha: 0.95 * a });
  }, { dark: true });
  t.draw(D, (g, u) => {
    const time = u * D, k = grow(time), a = fade(time), hot = clamp01(time / VENT);
    g.circle(B.x, B.y, R * k * 1.9).fill({ color: EMBER_C, alpha: 0.1 * a * hot });
    g.circle(B.x, B.y, R * k).stroke({ width: 1.5, color: ASH_HI, alpha: 0.6 * a });
    for (const sp of spikes(k)) g.poly(sp, false).stroke({ width: 1.1, color: ASH, alpha: 0.7 * a });
    // The vents: round ports glowing through the shell, white at the heart
    // as they blow.
    const blow = 1 - clamp01((time - VENT - 0.25) / 0.2);
    for (const v of vents) {
      const vx = B.x + (v.x - B.x) * k, vy = B.y + (v.y - B.y) * k, vr = R * 0.24 * k;
      g.circle(vx, vy, vr * 1.8).fill({ color: EMBER_C, alpha: 0.3 * a * hot });
      g.circle(vx, vy, vr).fill({ color: EMBER_HOT, alpha: 0.95 * a * (0.5 + 0.5 * hot) });
      if (time > VENT) g.circle(vx, vy, vr * 0.5).fill({ color: WHITE, alpha: a * blow });
    }
  });
  // THE HISS: embers jetting out of each port as it vents.
  t.later(VENT, () => t.flash(B, EMBER_HOT, 0.18 * sc));
  let acc = 0;
  t.draw(0.32, (_g, _u, dt) => {
    acc += dt * 95 * t.quality;
    for (; acc >= 1; acc--) {
      const v = vents[Math.floor(rand(0, vents.length))], a = v.a + rand(-0.35, 0.35), sp = rand(180, 320) * sc;
      t.spark(v.x, v.y, Math.cos(a) * sp, Math.sin(a) * sp, rand(0.24, 0.4), HISS);
    }
  }, { delay: VENT });
}

/** Embers adrift in the haze on a card: a few at a time, low on the card,
 *  rising a little and going out. */
function driftIn(t: FxTools, r: Box, s: number) {
  let acc = 0;
  t.draw(THIN - 0.3, (_g, _u, dt) => {
    acc += dt * 6 * t.quality;
    for (; acc >= 1; acc--)
      t.spark(r.x + r.w * rand(0.15, 0.85), r.y + r.h * rand(0.6, 0.9), rand(-12, 12) * (s / 90), -rand(10, 35) * (s / 90), rand(0.4, 0.7), DRIFT);
  }, { delay: 0.35 });
}
