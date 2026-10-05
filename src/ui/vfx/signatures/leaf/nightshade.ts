/** NIGHTSHADE — Night Bloom. "Apply POISON 3 (DOT) to all opponents for 3
 *  rounds." Nightshade's bloom poisons every enemy on the board.
 *
 *  The DELIVERY is the bloom gathering on her, as on her art: dark violet
 *  nightshade blossoms open round her card, their hearts glowing poison-green,
 *  while toxic light pools in her hands and drips off them in strands to a
 *  green pool at her feet. Then she lets it go: a glowing spore drifts out of
 *  her hands to every opponent on the board, wavering as it comes, each landing
 *  on the landing frame.
 *
 *  The LANDING is the night bloom itself. On every card a spore reached, a
 *  nightshade flower UNFURLS — five deep-violet petals turning open, rimmed in
 *  violet light, a green heart of glowing stamens — and the heart BURSTS into
 *  a drifting cloud of toxic spores, green drops running off the petal tips;
 *  then the flower closes over and is gone, and the POISON is left behind.
 *
 *  The petals are drawn dark for real (`dark: true`), because a nightshade's
 *  bloom is the darkest thing on the board — and every petal carries a violet
 *  rim and a lit vein, so it reads over an empty square as well as a card. The
 *  poison is light: toxic green, the one bright colour in it. */
import { centre, rand } from "../../looks/base";
import type { Graphics } from "pixi.js";
import type { FxTools, Pt, SparkStyle } from "../../looks/types";
import type { Signature, SigMoment } from "../types";

type Box = SigMoment["from"];

const TAU = Math.PI * 2;
// The petals, only ever on the dark layer: deep violet going near-black.
const PETAL = 0x1c0a30, PETAL_IN = 0x3a1464;
// Their light (additive): the violet rim and the lilac vein.
const VIOLET = 0x9a5ad8, RIM = 0xbf8cff, LILAC = 0xd2b0ff;
// The poison: toxic green, the one bright thing in the bloom.
const TOXIC = 0x8cff2a, TOXIC_HI = 0xe0ffa8, TOXIC_DEEP = 0x3fae1a;
/** Spores loosed from a bursting heart: they drift, rising, curling. */
const SPORE: SparkStyle = { palette: [TOXIC_HI, TOXIC, TOXIC_DEEP], gravity: -40, drag: 0.55, size: [5, 2], streak: false, swirl: 110 };
const SPORE_L: SparkStyle = { ...SPORE, swirl: -110 };
/** Poison running off a petal tip, or off her hands: drops that fall. */
const DRIP: SparkStyle = { palette: [TOXIC_HI, TOXIC, TOXIC_DEEP], gravity: 520, drag: 0.7, size: [5, 2], streak: false };

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeOut = (x: number) => 1 - (1 - x) * (1 - x);

// ── The flower ───────────────────────────────────────────────────────────────

/** One petal's outline from the flower's heart `c` out along `ang`: narrow at
 *  the heart, broad through its middle, drawn to a point — a nightshade's
 *  star-petal. Continues the current path. */
function petal(g: Graphics, c: Pt, ang: number, len: number, width: number) {
  const ux = Math.cos(ang), uy = Math.sin(ang), nx = -uy, ny = ux, w = len * width;
  const bx = c.x + ux * len * 0.08, by = c.y + uy * len * 0.08, tx = c.x + ux * len, ty = c.y + uy * len;
  const mx = c.x + ux * len * 0.5, my = c.y + uy * len * 0.5;
  g.moveTo(bx, by).quadraticCurveTo(mx + nx * w, my + ny * w, tx, ty).quadraticCurveTo(mx - nx * w, my - ny * w, bx, by);
}

/** A nightshade flower over `c`, `R` across a petal, `open` 0..1 from a
 *  closed bud to a full star (petals lengthening and turning out), turned to
 *  `rot`. With `light` false: the dark petals, a deeper violet at their
 *  hearts; true: their violet rims, lilac veins, and the glowing green heart
 *  of stamens. */
function flower(g: Graphics, c: Pt, R: number, open: number, rot: number, a: number, light: boolean, heart = 1) {
  if (a <= 0.02 || R < 1) return;
  const len = R * (0.35 + 0.65 * open), wid = 0.26 + 0.24 * open, twist = (1 - open) * 0.9;
  const angs = Array.from({ length: 5 }, (_, i) => rot + (i / 5) * TAU + twist);
  if (!light) {
    for (const ang of angs) petal(g, c, ang, len, wid);
    g.fill({ color: PETAL, alpha: 0.88 * a });
    for (const ang of angs) petal(g, c, ang, len * 0.55, wid * 0.8);
    g.fill({ color: PETAL_IN, alpha: 0.8 * a });
    return;
  }
  // A violet sheen through the dark, brightest at the heart, then the rim:
  // a soft halo and a hard edge.
  for (const ang of angs) petal(g, c, ang, len, wid);
  g.fill({ color: VIOLET, alpha: 0.16 * a });
  for (const ang of angs) petal(g, c, ang, len * 0.5, wid * 0.8);
  g.fill({ color: VIOLET, alpha: 0.18 * a });
  for (const ang of angs) petal(g, c, ang, len, wid);
  g.stroke({ width: Math.max(3, R * 0.14), color: VIOLET, alpha: 0.22 * a, join: "round" });
  for (const ang of angs) petal(g, c, ang, len, wid);
  g.stroke({ width: Math.max(1.2, R * 0.045), color: RIM, alpha: 0.9 * a, join: "round" });
  for (const ang of angs)
    g.moveTo(c.x + Math.cos(ang) * len * 0.15, c.y + Math.sin(ang) * len * 0.15).lineTo(c.x + Math.cos(ang) * len * 0.8, c.y + Math.sin(ang) * len * 0.8);
  g.stroke({ width: 1, color: LILAC, alpha: 0.5 * a });
  if (heart <= 0.02) return;
  // The heart: stamens standing out of a green glow, each tipped with light.
  const h = a * heart;
  g.circle(c.x, c.y, R * 0.45 * open).fill({ color: TOXIC_DEEP, alpha: 0.4 * h }).circle(c.x, c.y, R * 0.25 * open).fill({ color: TOXIC, alpha: 0.35 * h });
  for (let i = 0; i < 6; i++) {
    const ang = rot * 1.7 + (i / 6) * TAU + 0.3, l = R * 0.3 * open, x = c.x + Math.cos(ang) * l, y = c.y + Math.sin(ang) * l;
    g.moveTo(c.x, c.y).lineTo(x, y).stroke({ width: 1, color: TOXIC, alpha: 0.8 * h });
    g.circle(x, y, Math.max(1.2, R * 0.05)).fill({ color: TOXIC_HI, alpha: 0.95 * h });
  }
  g.circle(c.x, c.y, R * 0.1).fill({ color: TOXIC_HI, alpha: 0.9 * h });
}

/** A cloud of poison off a burst heart: soft green puffs that swell, drift up
 *  and thin — one Graphics. */
function cloud(t: FxTools, c: Pt, s: number, n: number, delay: number) {
  const D = 0.75;
  const puffs = Array.from({ length: n }, (_, i) => {
    const a = (i / n) * TAU + rand(-0.4, 0.4), d = s * rand(0.08, 0.2);
    return { x: c.x + Math.cos(a) * d, y: c.y + Math.sin(a) * d * 0.7, vx: Math.cos(a) * s * 0.35, r: s * rand(0.1, 0.16), ph: rand(0, TAU) };
  });
  t.draw(D, (g, u) => {
    const time = u * D, a = (u < 0.15 ? u / 0.15 : 1 - (u - 0.15) / 0.85);
    for (const p of puffs) {
      const out = 1 - Math.exp(-time / 0.25), x = p.x + p.vx * out * 0.6 + Math.sin(time * 5 + p.ph) * s * 0.03, y = p.y - s * 0.35 * time;
      const r = p.r * (1 + 1.3 * u);
      g.circle(x, y, r).fill({ color: TOXIC_DEEP, alpha: 0.22 * a }).circle(x, y, r * 0.55).fill({ color: TOXIC, alpha: 0.16 * a });
    }
  }, { delay });
}

/** A spore's way from her hands to a card: wavering, as a thing carried on
 *  the air does, and dead on the card at the end. */
function drift(from: Pt, to: Pt) {
  const dx = to.x - from.x, dy = to.y - from.y, d = Math.hypot(dx, dy) || 1, nx = -dy / d, ny = dx / d;
  const amp = d * rand(0.08, 0.14) * (Math.random() < 0.5 ? -1 : 1), ph = rand(0, TAU);
  return (q: number) => {
    const off = amp * Math.sin(Math.PI * q) * Math.sin(Math.PI * q * 2.5 + ph);
    return { x: from.x + dx * q + nx * off, y: from.y + dy * q + ny * off };
  };
}

export const NIGHTSHADE: Signature = {
  shake: 0.5,

  deliver(t: FxTools, m: SigMoment, seconds: number) {
    const r = m.from, c = centre(r), s = m.size, T = seconds;
    const hands = { x: c.x, y: c.y + s * 0.02 };
    // THE BLOSSOMS round her: four, opening one after another, held.
    const blooms = [0, 1, 2, 3].map((i) => {
      const a = Math.PI / 4 + (i * Math.PI) / 2 + rand(-0.2, 0.2);
      return { c: { x: c.x + Math.cos(a) * s * 0.44, y: c.y + Math.sin(a) * s * 0.44 }, at: i * 0.08 * T, rot: rand(0, TAU) };
    });
    const D = T + 0.2;
    const bloomAt = (b: (typeof blooms)[number], time: number) => ({
      open: easeOut(clamp01((time - b.at) / (T * 0.45))), a: clamp01((time - b.at) / 0.06) * (1 - clamp01((time - T) / 0.2)),
    });
    t.draw(D, (g, u) => {
      const time = u * D;
      for (const b of blooms) {
        const k = bloomAt(b, time);
        flower(g, b.c, s * 0.24, k.open, b.rot + time * 0.6, k.a, false);
      }
    }, { dark: true });
    t.draw(D, (g, u) => {
      const time = u * D;
      for (const b of blooms) {
        const k = bloomAt(b, time);
        flower(g, b.c, s * 0.24, k.open, b.rot + time * 0.6, k.a, true);
      }
      // THE POISON in her hands, pooling, and running off them in strands to
      // a green pool at her feet.
      const k = easeOut(clamp01(time / (T * 0.6))), fade = 1 - clamp01((time - T) / 0.2);
      g.circle(hands.x, hands.y, s * (0.1 + 0.08 * k)).fill({ color: TOXIC, alpha: 0.3 * k * fade })
        .circle(hands.x, hands.y, s * 0.05 * k).fill({ color: TOXIC_HI, alpha: 0.9 * k * fade });
      for (const o of [-0.09, 0, 0.08]) {
        const len = s * (0.18 + 0.12 * Math.abs(o) * 8) * clamp01((time - T * 0.15) / (T * 0.6)), x = hands.x + o * s;
        if (len < 1) continue;
        g.moveTo(x, hands.y + s * 0.04).lineTo(x + Math.sin(time * 6 + o * 20) * s * 0.01, hands.y + s * 0.04 + len).stroke({ width: 1.2, color: TOXIC, alpha: 0.75 * fade });
        g.circle(x, hands.y + s * 0.04 + len, 2).fill({ color: TOXIC_HI, alpha: 0.9 * fade });
      }
      g.ellipse(c.x, r.y + r.h * 0.86, s * 0.34 * k, s * 0.07 * k).fill({ color: TOXIC_DEEP, alpha: 0.35 * k * fade })
        .ellipse(c.x, r.y + r.h * 0.86, s * 0.2 * k, s * 0.035 * k).fill({ color: TOXIC, alpha: 0.4 * k * fade });
    });
    t.charge(hands, s * 0.9, TOXIC, 0.35, T * 0.5);
    const drops = Math.round(5 * t.quality);
    for (let i = 0; i < drops; i++)
      t.later(rand(0.25, 0.9) * T, () => t.spark(hands.x + rand(-0.1, 0.1) * s, hands.y + s * 0.2, rand(-8, 8), rand(20, 50), rand(0.25, 0.4), DRIP));

    // THE SPORES: loosed from her hands at once, drifting out to every card.
    const LET = T * 0.45, F = T - LET;
    m.targets.forEach((tr, i) => {
      const path = drift(hands, centre(tr));
      let acc = 0, n = i;
      t.draw(F, (g, u, dt) => {
        const q = u * (0.75 + 0.25 * u), p = path(q), fin = clamp01(u * 6), trail: number[] = [];
        for (let k = 0; k <= 6; k++) {
          const b = path(Math.max(0, q - 0.14) + (Math.min(q, 0.14) * k) / 6);
          trail.push(b.x, b.y);
        }
        // A short wake, brightest at the spore: something carried, not grown.
        g.poly(trail, false).stroke({ width: Math.max(2, s * 0.05), color: TOXIC_DEEP, alpha: 0.3 * fin, cap: "round", join: "round" });
        g.poly(trail.slice(6), false).stroke({ width: 1.2, color: TOXIC, alpha: 0.75 * fin, cap: "round", join: "round" });
        g.circle(p.x, p.y, s * 0.1).fill({ color: TOXIC_DEEP, alpha: 0.35 * fin }).circle(p.x, p.y, s * 0.045).fill({ color: TOXIC_HI, alpha: fin });
        // A violet husk round the spore, turning.
        g.circle(p.x, p.y, s * 0.07).stroke({ width: 1.2, color: VIOLET, alpha: 0.7 * fin });
        acc += dt * 30 * t.quality;
        for (; acc >= 1; acc--) t.spark(p.x, p.y, rand(-20, 20) * (s / 90), rand(-20, 20) * (s / 90), rand(0.25, 0.4), n++ % 2 ? SPORE : SPORE_L);
      }, { delay: LET });
    });
  },

  land(t: FxTools, m: SigMoment) {
    const s = m.size;
    m.targets.forEach((r, i) => bloom(t, r, m.power[i] ?? 0.55, s, i * 0.025));
  },
};

/** The night bloom on one card, `delay` in: a nightshade flower unfurling
 *  over it, its green heart bursting into a cloud of spores and dripping
 *  poison off its petal tips, then closing over and gone. */
function bloom(t: FxTools, r: Box, power: number, s: number, delay: number) {
  const c = centre(r), k = Math.max(0.55, Math.min(1.5, power)), R = s * 0.44 * (0.9 + 0.2 * k), rot = rand(0, TAU);
  const D = 0.95, BURST = 0.2;
  const state = (time: number) => {
    const open = time < 0.62 ? easeOut(clamp01(time / 0.18)) : 1 - 0.5 * clamp01((time - 0.62) / 0.33);
    return { open, a: clamp01(time / 0.05) * (1 - clamp01((time - 0.62) / 0.33)), rot: rot + time * 0.5,
      // The heart swells to the burst, and is spent after it.
      heart: time < BURST ? 0.6 + 0.4 * time / BURST : Math.max(0, 1 - (time - BURST) / 0.2) };
  };
  t.draw(D, (g, u) => {
    const st = state(u * D);
    flower(g, c, R, st.open, st.rot, st.a, false);
  }, { dark: true, delay });
  t.draw(D, (g, u) => {
    const st = state(u * D);
    flower(g, c, R, st.open, st.rot, st.a, true, st.heart);
  }, { delay });
  // THE BURST: the heart goes, a cloud of poison rising off the card, spores
  // flung through it, and drops running off the petal tips.
  t.later(delay + BURST, () => {
    t.flash(c, TOXIC, 0.11 * (s / 80));
    t.glow(r, TOXIC_DEEP, 0.35, 0.6, 1.1);
    const n = Math.round(10 * k + 4);
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU), v = rand(50, 140) * (s / 90);
      t.spark(c.x, c.y, Math.cos(a) * v, Math.sin(a) * v - 30 * (s / 90), rand(0.5, 0.8), i % 2 ? SPORE : SPORE_L, c);
    }
    for (let i = 0; i < 5; i++) {
      const a = rot + BURST * 0.5 + (i / 5) * TAU;
      t.later(rand(0.03, 0.2), () => t.spark(c.x + Math.cos(a) * R * 0.9, c.y + Math.sin(a) * R * 0.9, rand(-10, 10), rand(10, 40), rand(0.35, 0.5), DRIP));
    }
  });
  cloud(t, c, s, 6, delay + BURST);
}
