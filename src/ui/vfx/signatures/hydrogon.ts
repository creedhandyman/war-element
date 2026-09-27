/** HYDROGON — Vapor Beam. "Deal 18 DMG to a target and splash SCALD 6 (DOT, 2
 *  rounds) to adjacent opponents" — the serpent that does not end anywhere in
 *  particular.
 *
 *  The serpent on its art breathes one white shaft of vapour, and where it
 *  strikes the water spins up into a whirlpool of blue light. The DELIVERY is
 *  it drawing that breath: steam curling in from all round to its mouth at the
 *  card's front edge, rings of pressure closing on it, the glow there building
 *  white. The LANDING is the beam — pressurised vapour, white-hot at its core
 *  in a halo of steam, a helix of light twisting down it — driving into the
 *  main target (the one that took the 18) and spinning up the whirlpool there,
 *  spray and steam bursting off it. Then the scald finds the rest: from the
 *  struck card, jets of steam coil out to every opponent beside it and bloom
 *  over each in a scalding cloud — every coil it closes finds the next thing
 *  without being asked.
 *
 *  Steam is drawn light — near-white at a low alpha, swelling as it thins — so
 *  it reads as vapour on the dark board and never paints the light one dark.
 *  The serpent stays where it is: it breathes, it does not lunge. */
import { centre, rand } from "../looks/base";
import type { Graphics } from "pixi.js";
import type { FxTools, Pt, SparkStyle } from "../looks/types";
import type { Signature, SigMoment } from "./types";

type Box = { x: number; y: number; w: number; h: number };

const TAU = Math.PI * 2;
const WHITE = 0xf0fbff, PALE = 0x9fe3ff, BLUE = 0x4d94e8, CYAN = 0xbff6ff;
/** Steam: near-white, cooling to a pale grey-blue as it thins. */
const STEAM = 0xeaf6fc;
/** The scald's heat, in the heart of the cloud. */
const HOT = 0xffd6b8;
/** Vapour: round, swelling as it rises and thins — never a spark. */
const PUFF: SparkStyle = { palette: [0xf4fbff, 0xd8ecf5, 0xaccbdb], gravity: -60, drag: 0.45, size: [6, 18], streak: false };
/** Breath drawn in to the mouth, brightening as it gathers. */
const BREATH: SparkStyle = { palette: [PALE, CYAN, WHITE], gravity: 0, drag: 1, size: [5, 2.5], streak: false };
/** Spray off the whirlpool: round drops, thrown and falling. */
const DROP: SparkStyle = { palette: [WHITE, PALE, BLUE], gravity: 900, drag: 0.6, size: [6, 2], streak: false };

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeOut = (x: number) => 1 - (1 - x) * (1 - x);
/** 0 -> 1 as `x` runs from `a` to `b`. */
const span = (x: number, a: number, b: number) => clamp01((x - a) / (b - a));

/** A glow sized to the board's squares (`flash` is sized in px). */
function flare(t: FxTools, p: Pt, size: number, color: number, peak: number, seconds: number) {
  t.glow({ x: p.x - size / 2, y: p.y - size / 2, w: size, h: size }, color, peak, seconds, 1);
}

/** A path stroked from `w0` wide at its start to `w1` at its end, in three
 *  round-capped runs — a wisp, not a wire. */
function taper(g: Graphics, pts: number[], w0: number, w1: number, color: number, alpha: number) {
  const n = pts.length / 2 - 1;
  if (n < 1 || alpha <= 0.01) return;
  for (let k = 0; k < 3; k++) {
    const i0 = Math.floor((k * n) / 3), i1 = Math.floor(((k + 1) * n) / 3);
    if (i1 <= i0) continue;
    g.moveTo(pts[2 * i0], pts[2 * i0 + 1]);
    for (let i = i0 + 1; i <= i1; i++) g.lineTo(pts[2 * i], pts[2 * i + 1]);
    const f = (k + 0.5) / 3;
    g.stroke({ width: w0 + (w1 - w0) * f, color, alpha, cap: "round", join: "round" });
  }
}

/** The card the beam is for: the one that took the most — the 18, where the
 *  rest only took the scald. */
function mainOf(m: SigMoment): number {
  let best = 0;
  for (let i = 1; i < m.targets.length; i++) if ((m.power[i] ?? 1) > (m.power[best] ?? 1)) best = i;
  return best;
}

/** Its mouth: the front edge of its card, facing `aim`. */
function mouthOf(m: SigMoment, aim: Pt | null): { mouth: Pt; dx: number; dy: number } {
  const c = centre(m.from);
  let dx = m.ahead.x, dy = m.ahead.y;
  if (aim) {
    const l = Math.hypot(aim.x - c.x, aim.y - c.y) || 1;
    dx = (aim.x - c.x) / l;
    dy = (aim.y - c.y) / l;
  }
  return { mouth: { x: c.x + dx * m.size * 0.36, y: c.y + dy * m.size * 0.36 }, dx, dy };
}

/** THE WHIRLPOOL where the beam strikes — the blue spiral on its art: three
 *  arms of light wound in to a white eye, spinning hard, spreading, fading. */
function whirl(t: FxTools, c: Pt, R: number, dur: number, delay: number) {
  const seed = rand(0, TAU);
  t.draw(dur, (g, u) => {
    const time = u * dur, grow = easeOut(span(u, 0, 0.3)), fade = 1 - span(u, 0.35, 1), spin = seed + time * 13;
    if (grow <= 0) return;
    for (let arm = 0; arm < 3; arm++) {
      const pts: number[] = [];
      for (let k = 0; k <= 18; k++) {
        const q = k / 18, a = spin + (arm * TAU) / 3 + q * 2.8, r = R * grow * (0.1 + 0.9 * q);
        pts.push(c.x + Math.cos(a) * r, c.y + Math.sin(a) * r);
      }
      taper(g, pts, 7, 3, BLUE, 0.3 * fade);
      taper(g, pts, 3, 1.2, CYAN, 0.9 * fade);
    }
    g.circle(c.x, c.y, R * grow * 1.02).stroke({ width: 2, color: PALE, alpha: 0.45 * fade });
    g.circle(c.x, c.y, R * 0.16 * grow).fill({ color: WHITE, alpha: 0.85 * fade });
  }, { delay });
}

/** A jet of scalding steam reaching from the struck card to one beside it,
 *  coiling as it goes: its head there in `secs`, its tail drawn after it. */
function jet(t: FxTools, a: Pt, b: Pt, s: number, secs: number, delay: number) {
  const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len;
  const D = secs + 0.22, side = Math.random() < 0.5 ? -1 : 1;
  t.draw(D, (g, u) => {
    const time = u * D, head = easeOut(clamp01(time / secs)), tail = span(time, secs * 0.6, D);
    if (head - tail < 0.02) return;
    const pts: number[] = [];
    for (let i = 0; i <= 14; i++) {
      const f = tail + ((head - tail) * i) / 14;
      const coil = side * Math.sin(f * TAU * 1.2 - time * 18) * len * 0.09 * Math.sin(Math.PI * f);
      pts.push(a.x + dx * f + nx * coil, a.y + dy * f + ny * coil);
    }
    taper(g, pts, s * 0.08, s * 0.24, STEAM, 0.16);
    taper(g, pts, s * 0.04, s * 0.11, PALE, 0.3);
    taper(g, pts, s * 0.015, s * 0.045, WHITE, 0.8);
  }, { delay });
}

/** THE SCALD on a card: a cloud of steam blooming over it — soft puffs
 *  rolling out from its middle and rising off it, hot at its heart — and
 *  steam lifting away. Kept thin, so the card reads through it. */
function bloom(t: FxTools, r: Box, power: number) {
  const c = centre(r), s = Math.min(r.w, r.h), k = Math.max(0.7, Math.min(1.4, power + 0.3)), v = s / 90;
  const puffs = Array.from({ length: 7 }, (_, i) => ({ a: (i / 7) * TAU + rand(-0.3, 0.3), d: rand(0.15, 0.35), r: rand(0.8, 1.2), ph: rand(0, TAU) }));
  t.draw(0.85, (g, u) => {
    const grow = easeOut(span(u, 0, 0.4)), fade = 1 - span(u, 0.35, 1), rise = s * 0.16 * u;
    for (const p of puffs) {
      const d = s * p.d * (0.4 + 0.6 * grow) * k, rr = s * (0.12 + 0.1 * grow) * p.r * k;
      g.circle(c.x + Math.cos(p.a) * d, c.y + Math.sin(p.a) * d * 0.8 - rise + Math.sin(p.ph + u * 6) * 2, rr);
    }
    g.fill({ color: STEAM, alpha: 0.13 * fade });
    g.circle(c.x, c.y - rise * 0.5, s * 0.2 * grow * k).fill({ color: HOT, alpha: 0.22 * fade });
    // Its front rolling out over the card: a soft edge of steam, not a
    // shockwave's hard line.
    const front = easeOut(span(u, 0, 0.5)), ff = 1 - span(u, 0.2, 0.65);
    if (ff > 0) g.circle(c.x, c.y - rise * 0.3, s * (0.2 + 0.4 * front) * k).stroke({ width: s * 0.1 * (1 - 0.5 * front), color: STEAM, alpha: 0.18 * ff });
  });
  for (let i = 0; i < Math.round(10 * k); i++) {
    const a = rand(0, TAU), sp = rand(30, 80) * v;
    t.spark(c.x + Math.cos(a) * s * 0.2, c.y + Math.sin(a) * s * 0.2, Math.cos(a) * sp, Math.sin(a) * sp - rand(30, 70) * v, rand(0.5, 0.8), PUFF);
  }
}

export const HYDROGON: Signature = {
  shake: 1.2,
  // It breathes from where it coils; the beam does the reaching.
  lunge: false,

  deliver(t: FxTools, m: SigMoment, seconds: number) {
    const s = m.size, T = seconds;
    const aim = m.targets.length ? centre(m.targets[mainOf(m)]) : null;
    const { mouth } = mouthOf(m, aim);
    // Steam curling in to its mouth from all round, tightening and turning as
    // it comes — thin where it trails, thick where it pours in.
    const seed = rand(0, TAU), n = 5;
    const wisps = Array.from({ length: n }, (_, i) => ({
      a: seed + (i / n) * TAU + rand(-0.3, 0.3), turn: rand(1.0, 1.7), reach: rand(0.75, 1.1), ph: rand(0, TAU),
    }));
    t.draw(T, (g, u) => {
      const a = Math.min(1, u * 4) * (1 - span(u, 0.85, 1) * 0.5), time = u * T;
      for (const w of wisps) {
        const R = s * (0.85 - 0.45 * easeOut(u)) * w.reach, a0 = w.a + u * 3.4;
        const pts: number[] = [];
        for (let k = 0; k <= 10; k++) {
          // Curling in, and wavering as it comes: steam, not a spiral drawn.
          const q = k / 10, ang = a0 + q * w.turn, r = R * (1 - 0.62 * q) * (1 + 0.08 * Math.sin(q * 7 + w.ph + time * 14));
          pts.push(mouth.x + Math.cos(ang) * r, mouth.y + Math.sin(ang) * r);
        }
        taper(g, pts, 2, s * 0.1, STEAM, 0.2 * a);
        taper(g, pts, 0.5, s * 0.025, CYAN, 0.55 * a);
      }
    });
    // Breath drawn in with it, each mote reaching the mouth as it fades.
    let acc = 0;
    t.draw(T, (_g, u, dt) => {
      acc += 55 * dt;
      for (; acc >= 1; acc--) {
        const a = rand(0, TAU), r = s * rand(0.45, 0.8) * (1 - 0.3 * u), life = rand(0.16, 0.28);
        t.spark(mouth.x + Math.cos(a) * r, mouth.y + Math.sin(a) * r, (-Math.cos(a) * r) / life, (-Math.sin(a) * r) / life, life, BREATH);
      }
    });
    // Pressure: rings closing on the mouth, faster as it builds, and the glow
    // there swelling white and trembling.
    t.charge(mouth, s * 1.0, CYAN, 0.65, T);
    t.draw(T, (g, u) => {
      for (let i = 0; i < 3; i++) {
        const q = (u * 2.6 - i * 0.33) % 1;
        if (q <= 0 || u * 2.6 < i * 0.33) continue;
        g.circle(mouth.x, mouth.y, s * 0.4 * (1 - q) + 1).stroke({ width: 2, color: CYAN, alpha: 0.55 * q * Math.min(1, u * 3) });
      }
      const k = easeOut(u), r = s * (0.03 + 0.05 * k) * (1 + 0.12 * Math.sin(u * T * 70));
      g.circle(mouth.x, mouth.y, r * 2.4).fill({ color: PALE, alpha: 0.3 * k });
      g.circle(mouth.x, mouth.y, r).fill({ color: WHITE, alpha: 0.95 * k });
    });
  },

  land(t: FxTools, m: SigMoment) {
    const s = m.size, v = s / 90;
    const iMain = m.targets.length ? mainOf(m) : -1;
    const main = iMain >= 0 ? m.targets[iMain] : null;
    const { mouth, dx, dy } = mouthOf(m, main ? centre(main) : null);
    const tp = main ? centre(main) : { x: mouth.x + dx * s * 1.6, y: mouth.y + dy * s * 1.6 };
    const P = Math.max(0.55, Math.min(2, main ? m.power[iMain] ?? 1 : 1));
    const L = Math.hypot(tp.x - mouth.x, tp.y - mouth.y), nx = -dy, ny = dx;
    const FIRE = 0.06, HOLD = 0.42, D = 0.66;

    // THE BEAM: out to the target in a blink, held, pressurised — its width
    // shuddering, a helix of light twisting down it, steam shed off its
    // sides — then thinning out.
    let acc = 0;
    t.draw(D, (g, u, dt) => {
      const time = u * D, front = easeOut(clamp01(time / FIRE)), fade = 1 - span(time, HOLD, D);
      const len = L * front, ex = mouth.x + dx * len, ey = mouth.y + dy * len;
      const w = s * (0.09 + 0.035 * P) * (1 + 0.12 * Math.sin(time * 70)) * (0.45 + 0.55 * fade);
      g.moveTo(mouth.x, mouth.y).lineTo(ex, ey).stroke({ width: w * 3.6, color: PALE, alpha: 0.16 * fade, cap: "round" });
      g.moveTo(mouth.x, mouth.y).lineTo(ex, ey).stroke({ width: w * 1.6, color: CYAN, alpha: 0.5 * fade, cap: "round" });
      g.moveTo(mouth.x, mouth.y).lineTo(ex, ey).stroke({ width: w * 0.55, color: WHITE, alpha: 0.95 * fade, cap: "round" });
      // The twist in it — faint, and slow along its length, so it reads as a
      // shaft of vapour turning, not a rope.
      for (let strand = 0; strand < 2; strand++) {
        const pts: number[] = [];
        for (let i = 0; i <= 24; i++) {
          const f = (i / 24) * front, off = Math.sin(f * (L / s) * 1.1 * TAU - time * 34 + strand * Math.PI) * w * 1.05;
          pts.push(mouth.x + dx * L * f + nx * off, mouth.y + dy * L * f + ny * off);
        }
        taper(g, pts, 0.8, 1.6, strand ? WHITE : CYAN, 0.45 * fade);
      }
      g.circle(mouth.x, mouth.y, w * 1.1).fill({ color: WHITE, alpha: 0.9 * fade });
      if (time < HOLD) {
        acc += 70 * dt;
        for (; acc >= 1; acc--) {
          const f = rand(0.08, 1) * front, side = Math.random() < 0.5 ? -1 : 1, sp = rand(20, 60) * v;
          t.spark(mouth.x + dx * L * f + nx * side * w, mouth.y + dy * L * f + ny * side * w,
            nx * side * sp, ny * side * sp - rand(20, 50) * v, rand(0.45, 0.8), PUFF);
        }
      }
    });
    flare(t, mouth, s * 0.9, CYAN, 0.45, 0.3);

    // Where it strikes: the whirlpool spun up, a burst of white, spray and
    // steam thrown off it.
    whirl(t, tp, s * 0.44 * (0.8 + 0.2 * P), 0.8, FIRE);
    t.later(FIRE, () => {
      flare(t, tp, s * (1 + 0.2 * P), WHITE, 0.55, 0.22);
      for (let i = 0; i < Math.round(12 * P); i++) {
        const a = rand(0, TAU), sp = rand(120, 280) * v;
        t.spark(tp.x, tp.y, Math.cos(a) * sp, Math.sin(a) * sp - rand(60, 160) * v, rand(0.35, 0.6), DROP);
      }
      for (let i = 0; i < 8; i++) {
        const a = rand(0, TAU), sp = rand(40, 110) * v;
        t.spark(tp.x + Math.cos(a) * s * 0.15, tp.y + Math.sin(a) * s * 0.15, Math.cos(a) * sp, Math.sin(a) * sp - 30 * v, rand(0.5, 0.85), PUFF);
      }
    });
    if (main && m.killed[iMain]) t.later(FIRE + 0.25, () => bloom(t, main, 1.4));

    // THE SCALD: from the struck card, a jet of steam coiling out to each
    // opponent beside it, blooming over it where it lands.
    let j = 0;
    m.targets.forEach((r, i) => {
      if (i === iMain) return;
      const at = FIRE + 0.14 + 0.04 * j++, secs = 0.16;
      jet(t, tp, centre(r), s, secs, at);
      t.later(at + secs, () => bloom(t, r, m.power[i] ?? 0.55));
    });
  },
};
