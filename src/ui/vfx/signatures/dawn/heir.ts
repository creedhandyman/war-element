/** HEIR — Crowned. "Gain +5 DMG, +5 HP, +5 SP permanently. 3-round cooldown,
 *  three times in all." Named, not born: "Three coronations are permitted."
 *
 *  On its art the Heir is a young knight in gold plate and a navy cloak,
 *  coming down the palace stairs with a long golden sword, a crown on his
 *  head and a HALO OF THREE SUNS over it. The Special crowns him, so it is
 *  drawn as a coronation. It aims at nothing — there is no delivery; the
 *  LANDING is the whole move, played on his own card.
 *
 *  A crown of light comes down out of the sky onto his card on a thin shaft
 *  of light, glitter falling off it — five gold points with a jewel on each
 *  tip, a navy velvet cap behind them (the colour of his cloak) — and settles
 *  on his brow with a little give, the gem on its band struck into a gleam.
 *  Then the halo: three sun-points over the crown, lit one after another, each
 *  a small sun of eight rays like the emblems on DAWN's banners, an arc of
 *  light drawn between them as they come. Last, the sword flashes upright
 *  down the card — a golden blade standing point-up beneath the crown, a glint
 *  running down it from tip to hilt — and a burst of gold motes rises off him
 *  as all of it fades. Royal and ceremonial: the light comes DOWN onto him and
 *  stays on him, and nothing is thrown.
 *
 *  All light (additive), but the velvet cap, which is dark navy on the
 *  normal layer, rimmed in gold so it holds on any card. */
import { centre, rand } from "../../looks/base";
import type { Graphics } from "pixi.js";
import type { FxTools, Pt, SparkStyle } from "../../looks/types";
import type { Signature, SigMoment } from "../types";

const TAU = Math.PI * 2;
// DAWN's light: white-hot, pale, gold, the deep gold of plate, warm rims.
const WHITE = 0xffffff, PALE = 0xfff1b3, GOLD = 0xffd54f, DEEP = 0xe0a41c, WARM = 0xffe38a;
/** The crown's velvet, the navy of his cloak: dark layer only. */
const VELVET = 0x0c1640;
/** Glitter: a mote walks it as it ages, flicking white to deep gold. */
const GLINT = [WHITE, DEEP, WHITE, GOLD, PALE, DEEP, WHITE, DEEP];
/** Gold motes rising off him as he is crowned: they hang and climb. */
const RISE: SparkStyle = { palette: GLINT, gravity: -70, drag: 0.55, size: [6, 2], streak: false };
/** Glitter shaken off the crown as it comes down: it drifts, it does not fall. */
const SIFT: SparkStyle = { palette: [WHITE, PALE, GOLD, DEEP], gravity: 25, drag: 0.6, size: [4, 1.5], streak: false };

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeOut = (x: number) => 1 - (1 - x) * (1 - x);
/** Comes down fast and eases onto its rest. */
const settle = (x: number) => 1 - Math.pow(1 - x, 3);
/** Up fast, hold, down: 0 at the ends of `u`. */
const env = (u: number, rise: number, fall: number) => (u < rise ? u / rise : u > fall ? Math.max(0, 1 - (u - fall) / (1 - fall)) : 1);

/** The ceremony's beats, s from the landing: the crown's descent, each sun
 *  of the halo, the sword's flash, and when it all fades. */
const DESCEND = 0.3, SUNS = [0.36, 0.46, 0.56], SWORD = 0.5, END = 1.05;

// ── The regalia ──────────────────────────────────────────────────────────────

/** A four-point star: two long arms (`r` along `rot`, `r2` across it) pinched
 *  to a waist `w`. */
function star(g: Graphics, x: number, y: number, r: number, r2: number, w: number, rot: number, color: number, alpha: number) {
  if (alpha <= 0.01 || (r < 0.5 && r2 < 0.5)) return;
  const pts: number[] = [];
  for (let i = 0; i < 8; i++) {
    const a = rot + (i * Math.PI) / 4;
    const d = i % 2 ? w : i % 4 === 0 ? r : r2;
    pts.push(x + Math.cos(a) * d, y + Math.sin(a) * d);
  }
  g.poly(pts).fill({ color, alpha });
}

/** A lens flare: a gold star behind a white one, a hot dot at its heart. */
function flare(g: Graphics, x: number, y: number, r: number, alpha: number, rot = 0, wide = 1) {
  if (alpha <= 0.01 || r < 0.5) return;
  star(g, x, y, r * 1.3 * wide, r * 1.3, r * 0.2, rot, GOLD, alpha * 0.45);
  star(g, x, y, r * wide, r, r * 0.07, rot, WHITE, alpha);
  g.circle(x, y, r * 0.16).fill({ color: PALE, alpha: alpha * 0.85 });
}

/** The crown, its band's centre at (x, y), `W` across: a band curving a
 *  little toward the viewer, five points rising from it — tallest in the
 *  middle — the tips of the points (for their jewels), and the velvet cap
 *  domed behind them. Flat points. */
function crown(x: number, y: number, W: number) {
  const hw = W / 2, band = W * 0.17, sag = W * 0.05;
  const heights = [0.36, 0.5, 0.66, 0.5, 0.36].map((h) => h * W);
  const tips: Pt[] = [], outline: number[] = [];
  // Along the bottom of the band, left to right, bowed down toward us...
  for (let i = 0; i <= 8; i++) {
    const f = i / 8;
    outline.push(x - hw + W * f, y + band / 2 + sag * Math.sin(Math.PI * f));
  }
  // ...then back along the top, right to left: a tip, then a valley sunk to
  // just above the band.
  for (let k = 4; k >= 0; k--) {
    const f = k / 4, px = x - hw + W * f, top = y - band / 2 + sag * Math.sin(Math.PI * f) * 0.6;
    const tip = { x: px + (f - 0.5) * W * 0.12, y: top - heights[k] };
    tips.unshift(tip);
    if (k === 4) outline.push(px, top);
    outline.push(tip.x, tip.y);
    if (k > 0) outline.push(px - W / 8, top - band * 0.4);
    else outline.push(px, top);
  }
  const cap: number[] = [];
  for (let i = 0; i <= 12; i++) {
    const a = Math.PI + (i / 12) * Math.PI;
    cap.push(x + Math.cos(a) * hw * 0.9, y - band * 0.3 + Math.sin(a) * W * 0.48);
  }
  return { outline, cap, tips, band };
}

/** A small sun, the emblem on DAWN's banners: a disc with eight rays, long
 *  and short in turn, `r` the disc. `lit` 0..1 kindles it from a spark. */
function sun(g: Graphics, x: number, y: number, r: number, spin: number, lit: number, alpha: number) {
  if (alpha <= 0.01 || lit <= 0.01) return;
  const R = r * lit;
  g.circle(x, y, R * 2.6).fill({ color: GOLD, alpha: 0.16 * alpha });
  for (let i = 0; i < 8; i++) {
    const a = spin + (i * TAU) / 8, L = R * (i % 2 ? 1.9 : 2.7), w = R * 0.38;
    const ca = Math.cos(a), sa = Math.sin(a);
    g.poly([x + ca * R * 0.8 - sa * w, y + sa * R * 0.8 + ca * w, x + ca * L, y + sa * L, x + ca * R * 0.8 + sa * w, y + sa * R * 0.8 - ca * w])
      .fill({ color: i % 2 ? GOLD : WARM, alpha: 0.9 * alpha });
  }
  g.circle(x, y, R).fill({ color: GOLD, alpha: 0.85 * alpha }).stroke({ width: 1.2, color: WHITE, alpha: 0.9 * alpha });
  g.circle(x, y, R * 0.5).fill({ color: WHITE, alpha: 0.9 * alpha });
}

/** The sword standing point-up, its crossguard at (x, y): a blade `len` long
 *  and `w` wide in a glow of its own, a white fuller, the guard, grip and
 *  pommel below. */
function sword(g: Graphics, x: number, y: number, len: number, w: number, alpha: number) {
  if (alpha <= 0.01 || len < 2) return;
  const tip = y - len, hw = w / 2, taper = Math.min(len * 0.3, w * 2);
  g.poly([x - hw * 2.6, y, x - hw * 2.6, tip + taper, x, tip - w * 1.4, x + hw * 2.6, tip + taper, x + hw * 2.6, y]).fill({ color: GOLD, alpha: 0.2 * alpha });
  g.poly([x - hw, y, x - hw, tip + taper, x, tip, x + hw, tip + taper, x + hw, y]).fill({ color: GOLD, alpha: 0.6 * alpha })
    .stroke({ width: 1.4, color: WHITE, alpha: 0.9 * alpha });
  g.moveTo(x, y - w * 0.4).lineTo(x, tip + taper * 0.7).stroke({ width: Math.max(1, w * 0.24), color: WHITE, alpha: 0.85 * alpha });
  g.roundRect(x - w * 2.2, y - w * 0.3, w * 4.4, w * 0.6, w * 0.2).fill({ color: DEEP, alpha: 0.85 * alpha }).stroke({ width: 1.2, color: WARM, alpha: 0.9 * alpha });
  g.rect(x - w * 0.25, y + w * 0.3, w * 0.5, w * 1.6).fill({ color: DEEP, alpha: 0.8 * alpha });
  g.circle(x, y + w * 2.1, w * 0.36).fill({ color: GOLD, alpha: 0.9 * alpha }).stroke({ width: 1, color: WHITE, alpha: 0.8 * alpha });
}

export const HEIR: Signature = {
  // A crowning, not a blow: the board barely stirs as the crown sets.
  shake: 0.3,
  lunge: false,

  land(t: FxTools, m: SigMoment) {
    const c = centre(m.from), s = m.size;
    // Where the crown rests (on his brow, high on the card) and how far above
    // it the crown starts down.
    const rest = { x: c.x, y: c.y - s * 0.06 }, W = s * 0.62, high = s * 1.0;
    // Down, then a little give as it is set on, and still.
    const crownY = (time: number) => rest.y - high * (1 - settle(clamp01(time / DESCEND))) + s * 0.025 * Math.sin(clamp01((time - DESCEND) / 0.14) * Math.PI);
    const crownA = (time: number) => clamp01(time / 0.08) * (1 - clamp01((time - (END - 0.25)) / 0.25));

    // THE CROWN COMES DOWN: the velvet first, on the dark layer...
    t.draw(END, (g, u) => {
      const time = u * END, a = crownA(time);
      if (a > 0.01) g.poly(crown(rest.x, crownY(time), W).cap, true).fill({ color: VELVET, alpha: 0.5 * a * a });
    }, { dark: true });
    // ...then the gold over it, on a thin shaft of light from above that
    // thins and goes as it settles.
    t.draw(END, (g, u) => {
      const time = u * END, a = crownA(time), y = crownY(time), K = crown(rest.x, y, W);
      const shaft = 1 - clamp01((time - DESCEND * 0.6) / 0.25);
      if (shaft > 0.01) {
        const top = y - s * 1.3;
        g.poly([rest.x - W * 0.22, top, rest.x + W * 0.22, top, rest.x + W * 0.45, y, rest.x - W * 0.45, y], true).fill({ color: GOLD, alpha: 0.13 * shaft * a });
        g.moveTo(rest.x, top).lineTo(rest.x, y - W * 0.3).stroke({ width: Math.max(1, s * 0.02), color: PALE, alpha: 0.5 * shaft * a });
      }
      if (a <= 0.01) return;
      g.circle(rest.x, y - W * 0.2, W * 0.75).fill({ color: GOLD, alpha: 0.08 * a });
      g.poly(K.cap, true).stroke({ width: 1.2, color: DEEP, alpha: 0.7 * a });
      g.poly(K.outline, true).fill({ color: GOLD, alpha: 0.7 * a }).stroke({ width: 1.6, color: WARM, alpha: 0.95 * a, join: "miter" });
      // The band picked out, and a jewel on each point.
      g.moveTo(rest.x - W * 0.48, y).lineTo(rest.x + W * 0.48, y).stroke({ width: Math.max(1, K.band * 0.35), color: PALE, alpha: 0.75 * a });
      for (const tip of K.tips) g.circle(tip.x, tip.y, s * 0.022).fill({ color: WHITE, alpha: 0.95 * a });
      // The gem on the band, struck into a gleam as the crown sets.
      star(g, rest.x, y + K.band * 0.15, s * 0.04, s * 0.05, s * 0.022, Math.PI / 4, PALE, 0.95 * a);
      const gleam = Math.max(0, 1 - Math.abs(time - DESCEND - 0.04) / 0.12);
      if (gleam > 0) flare(g, rest.x, y, s * 0.42 * gleam, gleam, 0, 1.8);
    });
    // Glitter sifting off the crown on its way down.
    const sift = Math.round(8 * t.quality);
    for (let i = 0; i < sift; i++) {
      const at = rand(0.02, 0.9) * DESCEND;
      t.later(at, () => t.spark(rest.x + rand(-0.5, 0.5) * W, crownY(at) + rand(-0.1, 0.05) * s, rand(-15, 15), rand(10, 40) * (s / 90), rand(0.35, 0.55), SIFT));
    }
    // It sets: a warm glow over the card.
    t.later(DESCEND, () => {
      t.flash(rest, PALE, 0.35 * (s / 90));
      t.glow(m.from, GOLD, 0.35, 0.6, 1.0);
    });

    // THE HALO OF THREE SUNS, lit one by one over the crown — left, right,
    // then the centre — an arc of light drawn on between them as they come.
    const hc = { x: rest.x, y: rest.y - s * 0.02 }, HR = s * 0.56;
    const spots = [-0.62, 0, 0.62].map((d) => ({ x: hc.x + Math.sin(d) * HR, y: hc.y - Math.cos(d) * HR }));
    const order = [0, 2, 1];
    const D = END - SUNS[0];
    t.draw(D, (g, u) => {
      const time = SUNS[0] + u * D, fade = 1 - clamp01((time - (END - 0.25)) / 0.25);
      const run = clamp01((time - SUNS[0]) / (SUNS[2] - SUNS[0] + 0.04));
      if (run > 0) {
        const a0 = -Math.PI / 2 - 0.75, a1 = a0 + 1.5 * run;
        g.arc(hc.x, hc.y, HR, a0, a1).stroke({ width: 5, color: GOLD, alpha: 0.2 * fade });
        g.arc(hc.x, hc.y, HR, a0, a1).stroke({ width: 1.5, color: WARM, alpha: 0.8 * fade });
      }
      order.forEach((idx, n) => {
        const q = (time - SUNS[n]) / 0.12;
        if (q <= 0) return;
        const p = spots[idx], big = idx === 1 ? 1.2 : 1;
        // Swelling a touch past full as it catches, then holding.
        const lit = easeOut(clamp01(q)) * (1 + 0.15 * Math.max(0, 1 - Math.abs(q - 1)));
        sun(g, p.x, p.y, s * 0.065 * big, time * 1.2 + idx, lit, fade);
        const kf = env(clamp01(q / 2.2), 0.15, 0.3);
        if (kf > 0) flare(g, p.x, p.y, s * 0.2 * big * kf, kf);
      });
    }, { delay: SUNS[0] });

    // THE SWORD FLASHES upright down the card, point to the crown: there at
    // once, a glint running down it from tip to hilt, and gone.
    const guard = { x: c.x, y: c.y + s * 0.36 }, len = s * 0.42, bw = s * 0.06;
    const SD = 0.42;
    t.draw(SD, (g, u) => {
      const time = u * SD, a = env(u, 0.08, 0.45);
      sword(g, guard.x, guard.y, len * (0.85 + 0.15 * easeOut(clamp01(time / 0.08))), bw, 0.85 * a);
      const run = clamp01((time - 0.03) / 0.2);
      if (run > 0 && run < 1) flare(g, guard.x, guard.y - len + len * easeOut(run), s * 0.17, 1 - run * 0.4, 0, 0.6);
    }, { delay: SWORD });
    t.later(SWORD, () => t.flash({ x: guard.x, y: guard.y - len }, PALE, 0.25 * (s / 90)));

    // Gold rising off him: he is more than he was.
    t.later(SWORD + 0.08, () => {
      t.emit({ count: Math.round(30 * t.quality), palette: GLINT, from: { x: m.from.x + s * 0.1, y: m.from.y + s * 0.2, w: s * 0.8, h: s * 0.7 },
        dir: [-105, -75], speed: [25 * (s / 90), 75 * (s / 90)], gravity: -60, drag: 0.55, life: [0.45, 0.7], size: [6, 2] });
      for (let i = 0; i < Math.round(6 * t.quality); i++)
        t.spark(c.x + rand(-0.4, 0.4) * s, c.y + s * rand(0.1, 0.45), 0, -rand(60, 120) * (s / 90), rand(0.4, 0.6), RISE);
    });
  },
};
