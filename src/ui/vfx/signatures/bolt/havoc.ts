/** HAVOC — ThunderShot. "7 DMG to any target and PARALYZE it. If it already
 *  had a status, MUTE it as well." One shot, and it goes anywhere on the board.
 *
 *  Havoc's art is a mohawked gunman in spiked black armour and a long coat,
 *  an armoured car behind him, levelling a violet RAILGUN as long as his arm.
 *  So the DELIVERY is the railgun charging: the gun comes level on its mark (a
 *  black barrel of twin rails, lit violet along its edges), and the coils
 *  strung down the barrel light one after another, then a pulse runs through
 *  them faster and faster — the spool-up whine — particles drawn in to the
 *  rails, a hairline sight flickering on to the target.
 *
 *  The LANDING is one INSTANT shot. Not a bolt that crackles its way over:
 *  a dead-straight, razor-thin white-violet line laid from the muzzle to the
 *  target on the same frame, with shock rings strung along its length where
 *  the slug tore the air — and the gun kicking back hard into Havoc, blowback
 *  spitting out of the breech. At the target, a hard punch (a white core, a
 *  cross of spikes, a spray out the far side) and then the current LOCKS the
 *  card: four hard channels from the hole to its corners, stuttering, like
 *  staples — the paralyze. On a kill the card shatters along the shot.
 *
 *  Kept apart from the rest of BOLT by its line: everything else in Bolt City
 *  forks and kinks; ThunderShot is the one straight line in it. The current
 *  that locks the card keeps lightning's rules (kinks, a stutter on a beat);
 *  the gun is dark for real (`dark: true`) with a violet rim. */
import { centre, rand } from "../../looks/base";
import type { Graphics } from "pixi.js";
import type { FxTools, Pt, SparkStyle } from "../../looks/types";
import type { Signature, SigMoment } from "../types";

type Box = SigMoment["from"];

const TAU = Math.PI * 2;
/** The shot's light: white-hot, lavender, the rail's violet, deep violet. */
const WHITE = 0xffffff, LAV = 0xe3d8ff, VIO = 0x9575ff, DEEP = 0x5b3bd6;
/** The gun's black steel: dark layer only. */
const GUNMETAL = 0x0b0812;
/** One flicker beat, s, and the lock's brightness beat by beat: re-strokes,
 *  not a fade (looks/bolt.ts). */
const BEAT = 0.035;
const FLICKER = [1, 0.35, 1, 0.8, 0.3, 0.95, 0.5, 0.2, 0.75, 0.35, 0.15, 0.55];
/** Where the coils sit down the barrel, breech (0) to muzzle (1). */
const COILS = [0.3, 0.44, 0.58, 0.72, 0.86];

/** Drawn in to the rails as they charge. */
const INTAKE: SparkStyle = { palette: [DEEP, VIO, LAV], gravity: 0, drag: 1, size: [1.5, 3.5], streak: true };
/** Static: darts out hard and stops dead. */
const SNAP: SparkStyle = { palette: [WHITE, LAV, VIO], gravity: 0, drag: 0.0008, size: [6, 1.5], streak: true };
/** Out the far side of the card: hot, fast, on along the shot. */
const SPALL: SparkStyle = { palette: [WHITE, LAV, VIO, DEEP], gravity: 120, drag: 0.25, size: [7, 1.5], streak: true };
/** What is left of a card the shot went through. */
const SHARD: SparkStyle = { palette: [WHITE, LAV, VIO, DEEP], gravity: 260, drag: 0.5, size: [6, 2.5], streak: false };
/** Blowback out of the breech. */
const VENT: SparkStyle = { palette: [LAV, VIO, DEEP], gravity: 0, drag: 0.08, size: [5, 1.5], streak: true };

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeOut = (x: number) => 1 - (1 - x) * (1 - x);

/** How lit a strike is `since` s after it lands, lasting `dur`: a stutter,
 *  dying away. */
function flicker(since: number, dur: number): number {
  if (since < 0 || since >= dur) return 0;
  return FLICKER[Math.floor(since / BEAT) % FLICKER.length] * Math.sqrt(1 - since / dur);
}

/** A lightning channel from a to b, pinned at both ends, kinked up to `jag`
 *  px across by a walk. */
function channel(ax: number, ay: number, bx: number, by: number, segs: number, jag: number): number[] {
  const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len;
  const out = [ax, ay];
  let off = 0;
  for (let i = 1; i < segs; i++) {
    off = off * 0.5 + rand(-1, 1);
    const f = (i + rand(-0.3, 0.3)) / segs, o = off * jag * Math.sqrt(Math.sin((Math.PI * i) / segs));
    out.push(ax + dx * f + nx * o, ay + dy * f + ny * o);
  }
  out.push(bx, by);
  return out;
}

/** Lightning stroked: a wide violet halo, then a thin hot core. */
function zap(g: Graphics, paths: number[][], width: number, alpha: number) {
  if (alpha <= 0.02 || paths.length === 0) return;
  const a = Math.min(1, alpha);
  const trace = () => {
    for (const p of paths) {
      g.moveTo(p[0], p[1]);
      for (let i = 2; i < p.length; i += 2) g.lineTo(p[i], p[i + 1]);
    }
  };
  trace();
  g.stroke({ width: width * 4, color: VIO, alpha: 0.3 * a, join: "round", cap: "round" });
  trace();
  g.stroke({ width, color: WHITE, alpha: a, join: "bevel", cap: "round" });
}

/** A ring round the line of fire: a circle seen edge-on, so an ellipse long
 *  ACROSS the shot and thin along it. Flat points. */
function hoop(c: Pt, ux: number, uy: number, across: number, along: number): number[] {
  const pts: number[] = [];
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * TAU, ca = Math.cos(a) * along, sa = Math.sin(a) * across;
    pts.push(c.x + ux * ca - uy * sa, c.y + uy * ca + ux * sa);
  }
  return pts;
}

/** The line of fire: from Havoc to his mark (or straight ahead without one). */
function aim(m: SigMoment) {
  const c = centre(m.from), s = m.size;
  const r: Box | undefined = m.targets[0];
  const p = r ? centre(r) : { x: c.x + m.ahead.x * s * 3, y: c.y + m.ahead.y * s * 3 };
  const dx = p.x - c.x, dy = p.y - c.y, d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d;
  return { c, s, p, r, ux, uy, ang: Math.atan2(uy, ux), power: m.power[0] ?? 1, killed: m.killed[0] ?? false };
}

/** The railgun along (ux, uy), kicked back `kick` px: twin rails out to the
 *  muzzle, a housing over the breech, a stock behind. Flat points for the
 *  caller to fill, and where its breech and muzzle are. */
function railgun(c: Pt, s: number, ux: number, uy: number, kick: number) {
  const nx = -uy, ny = ux;
  const b = { x: c.x - ux * (s * 0.22 + kick), y: c.y - uy * (s * 0.22 + kick) };
  const L = s * 0.72, mz = { x: b.x + ux * L, y: b.y + uy * L };
  const quad = (f0: number, f1: number, off: number, w: number) => {
    const ax = b.x + ux * L * f0 + nx * off, ay = b.y + uy * L * f0 + ny * off;
    const bx = b.x + ux * L * f1 + nx * off, by = b.y + uy * L * f1 + ny * off;
    return [ax - nx * w, ay - ny * w, bx - nx * w, by - ny * w, bx + nx * w, by + ny * w, ax + nx * w, ay + ny * w];
  };
  const parts = [
    quad(0.1, 1, -s * 0.055, s * 0.022), // the rails
    quad(0.1, 1, s * 0.055, s * 0.022),
    quad(0, 0.32, 0, s * 0.1), // the housing
    quad(-0.22, 0.02, s * 0.02, s * 0.05), // the stock
  ];
  return { parts, breech: b, muzzle: mz, at: (f: number): Pt => ({ x: b.x + ux * L * f, y: b.y + uy * L * f }) };
}

/** The gun drawn for `dur`, kicked by `kick(time)`, its coils lit by
 *  `coil(i, time)` — dark steel on the dark layer, a violet rim and the coils
 *  as light. */
function drawGun(t: FxTools, c: Pt, s: number, ux: number, uy: number, dur: number,
  alpha: (time: number) => number, kick: (time: number) => number, coil: (i: number, time: number) => number) {
  t.draw(dur, (g, u) => {
    const time = u * dur, a = alpha(time);
    if (a <= 0.01) return;
    for (const pts of railgun(c, s, ux, uy, kick(time)).parts) g.poly(pts, true).fill({ color: GUNMETAL, alpha: 0.88 * a });
  }, { dark: true });
  t.draw(dur, (g, u) => {
    const time = u * dur, a = alpha(time);
    if (a <= 0.01) return;
    const gun = railgun(c, s, ux, uy, kick(time));
    for (const pts of gun.parts) g.poly(pts, true).stroke({ width: 1.3, color: VIO, alpha: 0.85 * a, join: "round" });
    // The coils: rings round the rails, each as lit as the charge in it.
    for (let i = 0; i < COILS.length; i++) {
      const lit = coil(i, time);
      if (lit <= 0.02) continue;
      const pts = hoop(gun.at(COILS[i]), ux, uy, s * 0.12, s * 0.035);
      g.poly(pts, true).stroke({ width: 4, color: VIO, alpha: 0.35 * Math.min(1, lit) * a });
      g.poly(hoop(gun.at(COILS[i]), ux, uy, s * 0.12, s * 0.035), true).stroke({ width: 1.4, color: LAV, alpha: Math.min(1, lit) * a });
    }
  });
}

export const HAVOC: Signature = {
  shake: 1.1,
  // He plants his feet and fires; the recoil is the only move he makes.
  lunge: false,

  deliver(t: FxTools, m: SigMoment, seconds: number) {
    const A = aim(m), { c, s, ux, uy } = A, T = seconds;
    // THE CHARGE: the coils light down the barrel one after another and stay
    // lit, while a pulse chases through them faster and faster — the whine.
    let phase = 0, last = 0;
    const chase = (time: number) => {
      // Integrated, so the pulse speeds up without jumping: 3 -> ~22 Hz.
      if (time > last) { phase += (time - last) * (3 + 19 * (time / T) * (time / T)); last = time; }
      return phase;
    };
    drawGun(t, c, s, ux, uy, T,
      (time) => clamp01(time / 0.08),
      () => 0,
      (i, time) => {
        const on = clamp01((time / T - 0.08 - i * 0.1) / 0.08), ph = chase(time);
        const pulse = Math.max(0, 1 - Math.abs((((ph - i * 0.18) % 1) + 1) % 1 - 0.5) * 6);
        return on * (0.35 + 0.3 * (time / T)) + on * pulse * 0.7;
      });
    const gun = railgun(c, s, ux, uy, 0);
    t.charge(gun.muzzle, s * 0.55, VIO, 0.55, T);
    // Particles drawn in to the rails, more as it builds.
    let acc = 0;
    t.draw(T, (g, u, dt) => {
      acc += dt * (14 + 46 * u) * t.quality;
      for (; acc >= 1; acc--) {
        const f = rand(0.25, 1), q = gun.at(f), th = rand(0, TAU), dd = s * rand(0.2, 0.34), life = rand(0.1, 0.16);
        const sx = q.x + Math.cos(th) * dd, sy = q.y + Math.sin(th) * dd;
        t.spark(sx, sy, (q.x - sx) / life, (q.y - sy) / life, life, INTAKE);
      }
      // The sight: a hairline flickering on to the mark in the last of it.
      const sight = clamp01((u - 0.55) / 0.2) * (Math.floor((u * T) / BEAT) % 3 === 1 ? 0.35 : 1);
      if (sight > 0.02) {
        const mz = gun.muzzle;
        g.moveTo(mz.x, mz.y).lineTo(A.p.x, A.p.y).stroke({ width: 1, color: VIO, alpha: 0.4 * sight });
        g.circle(A.p.x, A.p.y, s * 0.06).stroke({ width: 1, color: LAV, alpha: 0.6 * sight });
      }
    });
  },

  land(t: FxTools, m: SigMoment) {
    const A = aim(m), { c, s, p, ux, uy, ang } = A, nx = -uy, ny = ux;
    const k = Math.max(0.75, Math.min(1.6, A.power));
    const v = s / 90;
    const gun0 = railgun(c, s, ux, uy, 0), mz = gun0.muzzle, br = gun0.breech;
    // The slug goes through: the line runs on a little past the card.
    const end = { x: p.x + ux * s * 0.38, y: p.y + uy * s * 0.38 };
    const len = Math.hypot(end.x - mz.x, end.y - mz.y);

    // THE RECOIL: the gun slammed back into him, rocking forward again, the
    // coils spent.
    const KD = 0.42;
    drawGun(t, c, s, ux, uy, KD,
      (time) => 1 - clamp01((time - 0.25) / 0.17),
      (time) => s * 0.17 * (time < 0.025 ? time / 0.025 : Math.exp(-(time - 0.025) * 11)),
      (i, time) => Math.max(0, 1.2 - time * 7 - i * 0.05));
    // The muzzle blast: a flat collar of light across the shot, gone at once.
    t.draw(0.12, (g, u) => {
      const a = 1 - u, w = s * (0.18 + 0.22 * easeOut(u));
      g.poly(hoop(mz, ux, uy, w, w * 0.22), true).fill({ color: LAV, alpha: 0.45 * a }).stroke({ width: 2, color: WHITE, alpha: a });
      g.moveTo(mz.x - nx * w * 1.3, mz.y - ny * w * 1.3).lineTo(mz.x + nx * w * 1.3, mz.y + ny * w * 1.3).stroke({ width: 2, color: WHITE, alpha: 0.8 * a });
    });
    // Blowback out of the breech.
    for (let i = 0; i < Math.round(7 * t.quality) + 2; i++) {
      const a = ang + Math.PI + rand(-0.5, 0.5), sp = rand(140, 280) * v;
      t.spark(br.x, br.y, Math.cos(a) * sp, Math.sin(a) * sp, rand(0.15, 0.3), VENT);
    }
    t.flash(mz, LAV, 0.35 * v);

    // THE LINE: there all at once, white-hot and razor-thin, a violet halo
    // collapsing round it — held a blink, then drawn down to a hairline.
    const LD = 0.4;
    t.draw(LD, (g, u) => {
      const time = u * LD, q = clamp01((time - 0.05) / (LD - 0.05)), keep = 1 - q;
      const stut = time < 0.12 ? (Math.floor(time / BEAT) % 2 ? 0.75 : 1) : 1;
      g.moveTo(mz.x, mz.y).lineTo(end.x, end.y).stroke({ width: s * 0.2 * keep * keep + 1, color: VIO, alpha: 0.3 * keep * stut, cap: "round" });
      g.moveTo(mz.x, mz.y).lineTo(end.x, end.y).stroke({ width: Math.max(1, s * 0.07 * keep), color: LAV, alpha: 0.55 * keep * stut, cap: "round" });
      g.moveTo(mz.x, mz.y).lineTo(end.x, end.y).stroke({ width: Math.max(1, s * 0.03 * keep), color: WHITE, alpha: Math.min(1, keep * 1.4) * stut, cap: "round" });
    });
    // Shock rings strung down its length, a muzzle-first ripple: the air the
    // slug went through, ringing.
    const n = Math.max(2, Math.round(len / (s * 0.5)));
    const RD = 0.36;
    t.draw(RD + 0.07, (g, u) => {
      const time = u * (RD + 0.07);
      for (let i = 0; i < n; i++) {
        const f = (i + 0.5) / n, q = (time - f * 0.07) / RD;
        if (q <= 0 || q >= 1) continue;
        const at = { x: mz.x + (end.x - mz.x) * f, y: mz.y + (end.y - mz.y) * f }, e = easeOut(q), a = 1 - q;
        const across = s * (0.07 + 0.2 * e) * (i % 2 ? 0.85 : 1);
        g.poly(hoop(at, ux, uy, across, across * 0.3), true).stroke({ width: 1 + 2.5 * a, color: LAV, alpha: 0.85 * a });
        if (q < 0.4) g.poly(hoop(at, ux, uy, across * 0.6, across * 0.18), true).stroke({ width: 1.2, color: WHITE, alpha: 0.9 * (1 - q / 0.4) });
      }
    });
    // The ionised track, spitting static as it cools.
    t.later(0.06, () => {
      for (let i = 0; i < Math.round(8 * t.quality) + 2; i++) {
        const f = rand(0.05, 0.95), x = mz.x + (end.x - mz.x) * f, y = mz.y + (end.y - mz.y) * f;
        const a = ang + (Math.random() < 0.5 ? 1 : -1) * rand(1.2, 1.9), sp = rand(80, 170) * v;
        t.spark(x, y, Math.cos(a) * sp, Math.sin(a) * sp, rand(0.1, 0.2), SNAP);
      }
    });

    // THE PUNCH: a white core and a hard cross of spikes, along and across
    // the shot, gone in a blink — and a spray out the far side.
    t.flash(p, WHITE, 0.45 * k * v);
    t.draw(0.18, (g, u) => {
      const a = 1 - u, R = s * 0.2 * k * (0.7 + 0.5 * easeOut(u));
      g.circle(p.x, p.y, R * 0.6 * a + 1).fill({ color: WHITE, alpha: 0.9 * a });
      for (const [px, py, l] of [[ux, uy, 1.7], [-ux, -uy, 0.9], [nx, ny, 1.1], [-nx, -ny, 1.1]]) {
        const W = R * 0.12;
        g.poly([p.x - py * W, p.y + px * W, p.x + px * R * l * 1.8, p.y + py * R * l * 1.8, p.x + py * W, p.y - px * W], true)
          .fill({ color: LAV, alpha: 0.85 * a });
      }
    });
    if (A.r) t.ring(A.r, LAV, 0.15, 0.95 * (0.85 + 0.15 * k), 0.26, 3);
    const spall = Math.round((8 + 5 * k) * t.quality) + 3;
    for (let i = 0; i < spall; i++) {
      const on = i < spall * 0.75, a = (on ? ang : ang + Math.PI) + rand(-0.4, 0.4), sp = rand(220, 440) * v * (on ? 1 : 0.5);
      t.spark(p.x, p.y, Math.cos(a) * sp, Math.sin(a) * sp, rand(0.14, 0.28), SPALL);
    }

    // THE LOCK: four hard channels from the hole out to the card's corners,
    // re-kinked every beat and stuttering — the card stapled where it stands.
    if (A.r) {
      const half = Math.min(A.r.w, A.r.h) * 0.44, LKD = 0.62;
      const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, y]) => ({ x: p.x + x * half, y: p.y + y * half }));
      let paths: number[][] = [], beat = -1;
      t.draw(LKD, (g, u) => {
        const time = u * LKD, b = Math.floor(time / BEAT);
        if (b !== beat) {
          beat = b;
          paths = corners.map((q) => channel(p.x, p.y, q.x, q.y, 5, s * 0.07));
        }
        const lit = flicker(time, LKD);
        zap(g, paths, 1.6, lit);
        // ...and a staple of current clamped on each corner.
        for (const q of corners) {
          const sx = Math.sign(q.x - p.x), sy = Math.sign(q.y - p.y), l = s * 0.13;
          g.moveTo(q.x - sx * l, q.y).lineTo(q.x, q.y).lineTo(q.x, q.y - sy * l).stroke({ width: 2, color: LAV, alpha: 0.9 * lit, join: "miter" });
        }
      }, { delay: 0.04 });
      t.later(0.04, () => {
        for (const q of corners) for (let i = 0; i < 2; i++) {
          const a = rand(0, TAU), sp = rand(90, 180) * v;
          t.spark(q.x, q.y, Math.cos(a) * sp, Math.sin(a) * sp, rand(0.1, 0.2), SNAP);
        }
      });
    }

    // A kill: the card blown apart along the shot.
    if (A.killed) {
      t.later(0.05, () => {
        t.flash(p, VIO, 0.4 * v);
        if (A.r) t.ring(A.r, VIO, 0.3, 1.3, 0.4, 4);
        for (let i = 0; i < Math.round(14 * t.quality) + 4; i++) {
          const a = ang + rand(-0.9, 0.9), sp = rand(120, 300) * v;
          t.spark(p.x + rand(-0.25, 0.25) * s, p.y + rand(-0.25, 0.25) * s, Math.cos(a) * sp, Math.sin(a) * sp, rand(0.35, 0.6), SHARD);
        }
      });
    }
  },
};
