/** KRAKEN — Black Wave Crash. "Lose 5 HP. Deal 8 DMG to every opponent within
 *  2 spaces and BLIND them" — the part of the Deep that surfaces.
 *
 *  The DELIVERY is the Deep coming up: black water welling round the card and
 *  tentacles rising out of it, swaying, for as long as the wind-up lasts. The
 *  LANDING is the crash — the tentacles slam down, and a ring of black water
 *  runs out from the card to everything in reach, a torn white crest on its
 *  leading edge. Where the crest passes a card it breaks over it: spray thrown
 *  up, and a blot of black water across the card's face (the BLIND).
 *
 *  Darkness is drawn for real (`dark: true`), because black water is the
 *  point — and every dark shape carries a light rim, because on the near-black
 *  board a dark shape over an empty square is invisible. */
import { centre, rand } from "../looks/base";
import type { Graphics } from "pixi.js";
import type { FxTools, Pt, SparkStyle } from "../looks/types";
import type { Signature, SigMoment } from "./types";

const TAU = Math.PI * 2;
const INK = 0x020a14, DEEP = 0x123a70, BLUE = 0x3a8ae0, PALE = 0x9fe3ff, FOAM = 0xeefbff;
/** Thrown up where the crest breaks: heavy, falling, white to deep. */
const SPRAY: SparkStyle = { palette: [0xffffff, PALE, BLUE, DEEP], gravity: 950, drag: 0.55, size: [7, 3], streak: false };
/** Drops running off a rising tentacle. */
const DRIP: SparkStyle = { palette: [PALE, BLUE, DEEP], gravity: 700, drag: 0.6, size: [5, 2], streak: false };
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeOut = (x: number) => 1 - (1 - x) * (1 - x);
/** Up fast, hold, down: 0 at the ends of `u`. */
const env = (u: number, rise: number, fall: number) => (u < rise ? u / rise : u > fall ? Math.max(0, 1 - (u - fall) / (1 - fall)) : 1);

/** A tentacle's outline: a curve from `base` out along `ang`, `len` long, fat
 *  at the root and pointed at the end. Its heading snakes (`wave`, travelling
 *  with `phase`) and then hooks at the tip (`curl`) — a single bend reads as a
 *  blade, not an arm. Flat points, filled and rimmed by the caller. */
function tentacle(base: Pt, ang: number, len: number, width: number, curl: number, wave = 0.55, phase = 0): number[] {
  const N = 16, left: number[] = [], right: number[] = [];
  let x = base.x, y = base.y;
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    const h = ang + wave * Math.sin(u * Math.PI * 1.7 + phase) * u + curl * u * u * u;
    const w = (width / 2) * Math.pow(1 - u, 0.7);
    const nx = -Math.sin(h), ny = Math.cos(h);
    left.push(x + nx * w, y + ny * w);
    right.unshift(x - nx * w, y - ny * w);
    x += Math.cos(h) * (len / N);
    y += Math.sin(h) * (len / N);
  }
  return left.concat(right);
}

/** Water welling up: a lumpy disc, `r` across, its edge rolling. */
function pool(g: Graphics, c: Pt, r: number, time: number, seed: number): Graphics {
  const pts: number[] = [];
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * TAU;
    const rr = r * (1 + 0.07 * Math.sin(3 * a + seed + time * 5) + 0.05 * Math.sin(5 * a - time * 7));
    pts.push(c.x + Math.cos(a) * rr, c.y + Math.sin(a) * rr * 0.9);
  }
  return g.poly(pts, true);
}

/** Where the card's tentacles come up: spread round it, a little at random,
 *  each with its own curl and sway. */
function tentacles(n: number) {
  const a0 = rand(0, TAU);
  return Array.from({ length: n }, (_, i) => ({
    ang: a0 + (i / n) * TAU + rand(-0.3, 0.3),
    curl: rand(0.9, 1.6) * (Math.random() < 0.5 ? -1 : 1),
    phase: rand(0, TAU),
    reach: rand(0.85, 1.15),
  }));
}

export const KRAKEN: Signature = {
  shake: 1.5,
  // It does not close on anything: it surfaces where it stands, and the wave
  // goes out from there.
  lunge: false,

  deliver(t: FxTools, m: SigMoment, seconds: number) {
    const c = centre(m.from), s = m.size, seed = rand(0, 100);
    const arms = tentacles(4);
    const shape = (u: number, i: number) => {
      const a = arms[i], time = u * seconds;
      const grow = easeOut(clamp01(u / 0.8));
      const base = { x: c.x + Math.cos(a.ang) * s * 0.34, y: c.y + Math.sin(a.ang) * s * 0.34 };
      // Rising out of the water and swaying as they come — they have not
      // chosen what to hit yet.
      const sway = 0.35 * Math.sin(time * 7 + a.phase);
      return tentacle(base, a.ang + sway * 0.3, s * 0.95 * a.reach * grow, s * 0.2, a.curl * (0.6 + 0.4 * grow), 0.7, a.phase + time * 6);
    };
    // The water comes up under the card, dark and rising...
    t.draw(seconds, (g, u) => {
      pool(g, c, s * (0.45 + 0.35 * easeOut(u)), u * seconds, seed).fill({ color: INK, alpha: 0.5 * easeOut(clamp01(u / 0.6)) });
      for (let i = 0; i < arms.length; i++) g.poly(shape(u, i), true).fill({ color: INK, alpha: 0.85 * clamp01(u * 4) });
    }, { dark: true });
    // ...and lit: a deep-blue glow through the water and the arms, so they
    // read over an empty square, and a pale rim on each arm.
    t.draw(seconds, (g, u) => {
      const k = easeOut(clamp01(u / 0.6));
      pool(g, c, s * (0.45 + 0.35 * easeOut(u)), u * seconds, seed).fill({ color: DEEP, alpha: 0.3 * k })
        .stroke({ width: 2, color: BLUE, alpha: 0.7 * k });
      for (let i = 0; i < arms.length; i++)
        g.poly(shape(u, i), true).fill({ color: DEEP, alpha: 0.45 * clamp01(u * 4) })
          .stroke({ width: 2, color: PALE, alpha: 0.6 * clamp01(u * 4) });
    });
    // Drops running off the arms as they rise.
    const drips = Math.round(10 * t.quality);
    for (let i = 0; i < drips; i++)
      t.later(rand(0.1, 0.9) * seconds, () => {
        const a = arms[Math.floor(rand(0, arms.length))];
        const r = s * rand(0.5, 0.8);
        t.spark(c.x + Math.cos(a.ang) * r, c.y + Math.sin(a.ang) * r, rand(-30, 30), rand(-60, 10), rand(0.3, 0.5), DRIP);
      });
  },

  land(t: FxTools, m: SigMoment) {
    const c = centre(m.from), s = m.size, seed = rand(0, 100);
    // Everything within reach, and how far: the wave runs out to the farthest.
    const hits = m.targets.map((r, i) => {
      const p = centre(r);
      return { r, p, d: Math.hypot(p.x - c.x, p.y - c.y), power: m.power[i] ?? 1 };
    });
    const reach = Math.max(s * 1.6, ...hits.map((h) => h.d + s * 0.45));
    const RUN = 0.5; // the wave's run out to `reach`, s
    const radius = (time: number) => s * 0.4 + (reach - s * 0.4) * easeOut(clamp01(time / RUN));

    // THE SLAM: the arms thrown out flat and down, and gone.
    const arms = tentacles(5);
    const slam = (u: number, i: number) => {
      const a = arms[i], k = easeOut(clamp01(u / 0.25));
      const base = { x: c.x + Math.cos(a.ang) * s * 0.3, y: c.y + Math.sin(a.ang) * s * 0.3 };
      return tentacle(base, a.ang, s * (0.55 + 0.6 * k) * a.reach, s * 0.2, a.curl * (1 - k) * 0.8, 0.5 * (1 - k), a.phase + u * 8);
    };
    const SLAM = 0.45;
    t.draw(SLAM, (g, u) => {
      for (let i = 0; i < arms.length; i++) g.poly(slam(u, i), true).fill({ color: INK, alpha: 0.9 * env(u, 0.1, 0.45) });
    }, { dark: true });
    t.draw(SLAM, (g, u) => {
      for (let i = 0; i < arms.length; i++)
        g.poly(slam(u, i), true).fill({ color: DEEP, alpha: 0.4 * env(u, 0.1, 0.45) })
          .stroke({ width: 2, color: PALE, alpha: 0.65 * env(u, 0.1, 0.45) });
    });
    t.flash(c, PALE, 0.55);

    // THE WAVE: a ring of black water running out, heaviest at its crest...
    const D = RUN + 0.35;
    const fadeAt = (time: number) => 1 - clamp01((time - RUN * 0.7) / (D - RUN * 0.7));
    t.draw(D, (g, u) => {
      const time = u * D, r = radius(time);
      const w = s * (0.22 + 0.2 * (1 - clamp01(time / RUN)));
      g.circle(c.x, c.y, Math.max(1, r - w / 2)).stroke({ width: w, color: INK, alpha: 0.55 * fadeAt(time) });
    }, { dark: true });
    // ...lit through as deep water, with a torn white crest riding its leading
    // edge, broken into lengths — and spray torn off the crest as it runs.
    let spray = 0;
    t.draw(D, (g, u, dt) => {
      const time = u * D, r = radius(time), fade = fadeAt(time);
      const w = s * (0.22 + 0.2 * (1 - clamp01(time / RUN)));
      g.circle(c.x, c.y, Math.max(1, r - w / 2)).stroke({ width: w, color: DEEP, alpha: 0.4 * fade });
      if (time < RUN) {
        spray += dt * 70 * t.quality;
        for (; spray >= 1; spray--) {
          const a = rand(0, TAU), v = rand(60, 160) * (s / 90);
          t.spark(c.x + Math.cos(a) * r, c.y + Math.sin(a) * r, Math.cos(a) * v, Math.sin(a) * v - rand(40, 120) * (s / 90), rand(0.25, 0.45), SPRAY);
        }
      }
      const pieces = 9;
      for (let i = 0; i < pieces; i++) {
        const a0 = (i / pieces) * TAU + seed + time * 0.6, a1 = a0 + (TAU / pieces) * 0.72;
        for (let k = 0; k <= 8; k++) {
          const a = a0 + ((a1 - a0) * k) / 8;
          const rr = r * (1 + 0.035 * Math.sin(a * 7 + time * 18 + i));
          if (k === 0) g.moveTo(c.x + Math.cos(a) * rr, c.y + Math.sin(a) * rr);
          else g.lineTo(c.x + Math.cos(a) * rr, c.y + Math.sin(a) * rr);
        }
        g.stroke({ width: 4, color: FOAM, alpha: 0.95 * fade });
      }
      g.circle(c.x, c.y, Math.max(1, r - s * 0.16)).stroke({ width: 2, color: BLUE, alpha: 0.45 * fade });
    });

    // Where the crest reaches a card, the water breaks over it.
    for (const h of hits) {
      const at = clamp01((h.d - s * 0.4) / Math.max(1, reach - s * 0.4));
      const when = RUN * (1 - Math.sqrt(1 - at)); // when the eased crest gets there
      t.later(when, () => breakOver(t, h.r, h.p, h.power, c));
    }
  },
};

/** The wave breaking over a card it reached: spray thrown up and away from the
 *  Kraken, a ring of white water, and black water across the card's face —
 *  darkest where its eyes would be, and draining down off it. */
function breakOver(t: FxTools, r: { x: number; y: number; w: number; h: number }, p: Pt, power: number, from: Pt) {
  const s = Math.min(r.w, r.h), away = Math.atan2(p.y - from.y, p.x - from.x), seed = rand(0, 100);
  const k = Math.max(0.8, Math.min(1.5, power));
  const n = Math.round(14 * k);
  for (let i = 0; i < n; i++) {
    const a = away + rand(-1.1, 1.1), v = rand(160, 340) * (s / 90);
    t.spark(p.x, p.y, Math.cos(a) * v, Math.sin(a) * v - rand(80, 180) * (s / 90), rand(0.35, 0.6), SPRAY);
  }
  t.ring(r, FOAM, 0.35, 1.05, 0.4, 3);
  const D = 0.75;
  const blot = (g: Graphics, u: number) => {
    const drain = s * 0.12 * easeOut(clamp01((u - 0.3) / 0.7)); // it runs down the card as it drains
    return pool(g, { x: p.x, y: p.y - s * 0.12 + drain }, s * (0.24 + 0.14 * easeOut(clamp01(u / 0.25))) * k, u * D, seed);
  };
  t.draw(D, (g, u) => { blot(g, u).fill({ color: INK, alpha: 0.62 * env(u, 0.12, 0.35) }); }, { dark: true });
  t.draw(D, (g, u) => { blot(g, u).stroke({ width: 1.5, color: PALE, alpha: 0.5 * env(u, 0.12, 0.35) }); });
}
