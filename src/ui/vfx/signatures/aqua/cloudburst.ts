/** CLOUDBURST — Scoped 50GAL. "Your next basic attack fires 3 shots and can
 *  aim across up to 3 opponents." It does not aim at one: rain falls on
 *  whatever stands near what it aimed at.
 *
 *  Its art is a soldier in dark armour crouched on a cliff in a thunderstorm,
 *  sighting down a heavy water cannon through a scope whose lenses glow blue,
 *  the cannon's blast a blazing white-blue jet. The Special aims at nothing —
 *  it is a set-up, loading the next shot — so there is no delivery: the
 *  LANDING is the whole move, and it is the weather and the gun.
 *
 *  A storm gathers over the card: a dark thunderhead billowing up over it,
 *  lit along its edge, rain slanting down out of it onto the card, lightning
 *  flickering inside it twice. Under it a scope reticle snaps into place over
 *  the card — a ring closing down, its crosshair ticks — and three aim marks
 *  come spinning in round it and lock on one after another, spread across
 *  what lies ahead: three shots, three opponents. Then the cannon at its side
 *  charges: a barrel laid along the line it will fire, and three cells of
 *  pressurised water in it filling one by one, water drawn in to each and the
 *  cell blazing white-blue as it seals, until a glint runs off the muzzle.
 *  Then the storm thins and the gun is loaded.
 *
 *  The thunderhead and the barrel are dark for real (`dark: true`), each lit
 *  along its edge, so they read over the card's art and over an empty
 *  square; the rain, the reticle and the cells are light. */
import { centre, rand } from "../../looks/base";
import type { Graphics } from "pixi.js";
import type { FxTools, Pt, SparkStyle } from "../../looks/types";
import type { Signature, SigMoment } from "../types";

type Box = SigMoment["from"];

const TAU = Math.PI * 2;
// The thunderhead and the gun's steel: only ever on the dark layer.
const STORM = 0x0a1120, STEEL = 0x070c14;
// The storm lit: its edge, the flicker inside it, the rain.
const STORM_RIM = 0x8fb2ec, FLICKER = 0xe6ecff, RAIN = 0xb8dcff;
// The scope and the water cannon: the art's lens-blue, the jet's white-blue.
const SCOPE = 0x4fc4ff, SCOPE_HOT = 0xdaf6ff, CELL = 0x6fd8ff, JET = 0xf2fcff, BLUE = 0x2f7fe0;

/** Rain out of the thunderhead: thin, fast, slanting. */
const RAINDROP: SparkStyle = { palette: [JET, RAIN, BLUE], gravity: 700, drag: 0.95, size: [5, 3], streak: true };
/** Rain striking the card: flicked up and straight back. */
const SPLASH: SparkStyle = { palette: [JET, RAIN, BLUE], gravity: 1100, drag: 0.5, size: [3, 1.5], streak: false };
/** Water drawn into a cell as it fills: brightening as it goes in. */
const INTAKE: SparkStyle = { palette: [BLUE, CELL, JET], gravity: 0, drag: 1, size: [3, 5], streak: false };
/** Mist off the muzzle as the last cell seals. */
const MIST: SparkStyle = { palette: [JET, RAIN, BLUE], gravity: -30, drag: 0.4, size: [4, 9], streak: false };

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeOut = (x: number) => 1 - (1 - x) * (1 - x);
/** Overshoots and settles: a reticle snapping onto its mark. */
const snap = (x: number) => 1 + 2.7 * Math.pow(x - 1, 3) + 1.7 * Math.pow(x - 1, 2);

/** The whole move, s, and when the storm starts to thin. */
const D = 1.05, THIN = 0.8;
/** When the reticle closes, when each aim mark locks, when each cell seals. */
const RET = 0.16, RET_IN = 0.2, LOCKS = [0.36, 0.43, 0.5], CELLS = [0.48, 0.6, 0.72];
/** The flickers of lightning inside the cloud. */
const FLICKERS = [0.2, 0.58];

const fadeAll = (time: number) => 1 - clamp01((time - THIN) / (D - THIN));

// ── The thunderhead ──────────────────────────────────────────────────────────

/** The cloud's outline: the outer edge of a heap of billowing lobes, found by
 *  casting out from its middle — one silhouette, so its rim is the cloud's
 *  edge and not the lobes' circles showing through each other. */
function cloud(cc: Pt, lobes: { x: number; y: number; r: number; ph: number }[], grow: number, time: number): number[] {
  const pts: number[] = [];
  for (let i = 0; i < 48; i++) {
    const th = (i / 48) * TAU, dx = Math.cos(th), dy = Math.sin(th);
    let best = 0;
    for (const l of lobes) {
      const lx = l.x * grow, ly = l.y * grow, r = l.r * grow * (1 + 0.07 * Math.sin(time * 5 + l.ph));
      // Where the ray leaves this lobe, if it passes through it at all.
      const b = lx * dx + ly * dy, cc2 = lx * lx + ly * ly - r * r, disc = b * b - cc2;
      if (disc >= 0) best = Math.max(best, b + Math.sqrt(disc));
    }
    pts.push(cc.x + dx * best, cc.y + dy * best);
  }
  return pts;
}

/** THE STORM over the card: the thunderhead billowing up, its edge lit, rain
 *  slanting out of it onto the card and splashing off, lightning flickering
 *  inside it. */
function storm(t: FxTools, r: Box, s: number) {
  const c = centre(r), cc = { x: c.x, y: c.y - s * 0.42 }, slant = Math.random() < 0.5 ? -1 : 1;
  const lobes = [
    { x: -0.3, y: 0.04, r: 0.15 }, { x: -0.14, y: -0.06, r: 0.2 }, { x: 0.06, y: -0.1, r: 0.22 }, { x: 0.24, y: -0.03, r: 0.18 },
    { x: 0.36, y: 0.06, r: 0.12 }, { x: -0.04, y: 0.07, r: 0.17 }, { x: 0.18, y: 0.08, r: 0.15 },
  ].map((l) => ({ x: l.x * s * 1.45, y: l.y * s * 1.3, r: l.r * s * 1.3, ph: rand(0, TAU) }));
  const grow = (time: number) => 0.55 + 0.45 * easeOut(clamp01(time / 0.22));
  const lit = (time: number) => Math.max(0, ...FLICKERS.map((f) => (time >= f ? Math.exp(-(time - f) / 0.05) : 0)));
  t.draw(D, (g, u) => {
    const time = u * D, a = clamp01(time / 0.08) * fadeAll(time);
    g.poly(cloud(cc, lobes, grow(time), time), true).fill({ color: STORM, alpha: 0.82 * a });
  }, { dark: true });
  let rain = 0, splash = 0;
  const floor = r.y + r.h * 0.88;
  t.draw(D, (g, u, dt) => {
    const time = u * D, a = clamp01(time / 0.08) * fadeAll(time), f = lit(time), out = cloud(cc, lobes, grow(time), time);
    // Lit from inside when it flickers, and along its edge always, brighter
    // on top where the sky behind it is.
    g.poly(out, true).fill({ color: f > 0.05 ? FLICKER : STORM_RIM, alpha: (0.06 + 0.4 * f) * a });
    g.poly(out, true).stroke({ width: 1.8, color: STORM_RIM, alpha: (0.6 + 0.4 * f) * a, join: "round" });
    const top: number[] = [];
    for (let i = 26; i <= 46; i++) top.push(out[i * 2], out[i * 2 + 1]);
    g.poly(top, false).stroke({ width: 3, color: FLICKER, alpha: (0.25 + 0.5 * f) * a, cap: "round", join: "round" });
    // The rain, out of its underside and across the card.
    if (time > 0.06 && time < THIN + 0.1) {
      rain += dt * 120 * t.quality;
      for (; rain >= 1; rain--) {
        const x = c.x + rand(-0.5, 0.5) * s, y = cc.y + s * rand(0.08, 0.16), vy = rand(480, 560) * (s / 90);
        t.spark(x, y, slant * 70 * (s / 90), vy, ((floor - y) / vy) * rand(0.85, 1.1), RAINDROP);
      }
      splash += dt * 22 * t.quality;
      for (; splash >= 1; splash--)
        t.spark(c.x + rand(-0.38, 0.38) * s, floor - rand(0, 0.08) * s, rand(-35, 35) * (s / 90), -rand(60, 120) * (s / 90), rand(0.15, 0.25), SPLASH);
    }
  });
  // The lightning itself: a fork leaping across the inside of the cloud.
  for (const f of FLICKERS)
    t.later(f, () => {
      const a = { x: cc.x - s * rand(0.18, 0.3), y: cc.y + rand(-0.06, 0.02) * s }, b = { x: cc.x + s * rand(0.15, 0.3), y: cc.y + rand(0.0, 0.1) * s };
      if (Math.random() < 0.5) t.bolt(a, b, FLICKER, SCOPE, 0.1);
      else t.bolt(b, a, FLICKER, SCOPE, 0.1);
      // ...and the card under it lit for an instant.
      t.glow(r, FLICKER, 0.16, 0.18, 1.0);
    });
}

// ── The scope ────────────────────────────────────────────────────────────────

/** A chevron aim mark at `p`, pointing along `ang` (in, at the target). */
function chevron(g: Graphics, p: Pt, ang: number, size: number, color: number, alpha: number) {
  const ca = Math.cos(ang), sa = Math.sin(ang), back = size * 0.7, wide = size * 0.65;
  g.moveTo(p.x - ca * back - sa * wide, p.y - sa * back + ca * wide).lineTo(p.x, p.y).lineTo(p.x - ca * back + sa * wide, p.y - sa * back - ca * wide)
    .stroke({ width: 2, color, alpha, join: "miter", cap: "round" });
}

/** THE RETICLE closing down over the card, its crosshair ticks, and the three
 *  aim marks spinning in to lock on round it — spread across what lies ahead
 *  of it: the three it will be able to aim across. */
function reticle(t: FxTools, r: Box, s: number, ahead: number) {
  const c = centre(r), R = s * 0.36, spinDir = Math.random() < 0.5 ? -1 : 1;
  const rot = (time: number) => ahead + spinDir * 1.6 * (1 - easeOut(clamp01((time - RET) / RET_IN)));
  const rad = (time: number) => R * (2.4 - 1.4 * snap(clamp01((time - RET) / RET_IN)));
  const marks = [-1, 0, 1].map((k, i) => ({ ang: ahead + k * 0.5, lock: LOCKS[i], from: rand(1.8, 2.6) * (i % 2 ? -1 : 1) }));
  t.draw(D, (g, u) => {
    const time = u * D, a = clamp01((time - RET) / 0.06) * fadeAll(time);
    if (a <= 0.02) return;
    const rr = rad(time), th = rot(time);
    // The ring, its glow, and the ticks of the crosshair across it.
    g.circle(c.x, c.y, rr).stroke({ width: 5, color: SCOPE, alpha: 0.18 * a });
    g.circle(c.x, c.y, rr).stroke({ width: 1.6, color: SCOPE_HOT, alpha: 0.9 * a });
    g.circle(c.x, c.y, rr * 0.55).stroke({ width: 1, color: SCOPE, alpha: 0.45 * a });
    for (let i = 0; i < 4; i++) {
      const q = th + (i / 4) * TAU, ca = Math.cos(q), sa = Math.sin(q);
      g.moveTo(c.x + ca * rr * 0.3, c.y + sa * rr * 0.3).lineTo(c.x + ca * rr * 0.8, c.y + sa * rr * 0.8)
        .moveTo(c.x + ca * rr * 0.92, c.y + sa * rr * 0.92).lineTo(c.x + ca * rr * 1.18, c.y + sa * rr * 1.18);
    }
    g.stroke({ width: 1.2, color: SCOPE_HOT, alpha: 0.8 * a });
    g.circle(c.x, c.y, Math.max(1, s * 0.016)).fill({ color: SCOPE_HOT, alpha: a });
    // The marks, spinning in round the ring and locking on.
    for (const mk of marks) {
      const q = clamp01((time - RET - 0.02) / (mk.lock - RET - 0.02));
      if (q <= 0) continue;
      const e = easeOut(q), ang = mk.ang + mk.from * (1 - e), dist = R * (1.25 + 1.1 * (1 - e));
      const p = { x: c.x + Math.cos(ang) * dist, y: c.y + Math.sin(ang) * dist };
      const locked = time >= mk.lock, flash = locked ? Math.exp(-(time - mk.lock) / 0.08) : 0;
      chevron(g, p, ang + Math.PI, s * (0.09 + 0.04 * flash), locked ? SCOPE_HOT : SCOPE, Math.min(1, q * 4) * a);
      if (flash > 0.05) g.circle(p.x, p.y, s * (0.05 + 0.1 * (1 - flash))).stroke({ width: 1.5, color: SCOPE_HOT, alpha: flash * a });
      // Locked, it throws a sight line out across the field the way it
      // points â€” dashed, shooting out and fading: one of the three it will
      // be able to aim across.
      const lq = (time - mk.lock) / 0.4;
      if (lq > 0 && lq < 1) {
        const ca = Math.cos(mk.ang), sa = Math.sin(mk.ang), L = s * 1.4 * easeOut(clamp01(lq / 0.25)), dash = s * 0.09;
        for (let d0 = s * 0.08; d0 < L; d0 += dash * 1.8) {
          const d1 = Math.min(L, d0 + dash);
          g.moveTo(p.x + ca * d0, p.y + sa * d0).lineTo(p.x + ca * d1, p.y + sa * d1);
        }
        g.stroke({ width: 1.3, color: SCOPE_HOT, alpha: 0.75 * (1 - lq) * a, cap: "round" });
      }
    }
  });
  t.later(RET + RET_IN * 0.6, () => t.ring(r, SCOPE, 0.75, 0.6, 0.2, 2));
}

// ── The cannon ───────────────────────────────────────────────────────────────

/** THE CANNON at its side, laid along the line it fires: a barrel of dark
 *  steel lit along its edge, three cells in it filling one by one with
 *  pressurised water — drawn in, then sealing white-blue — and a glint off
 *  the muzzle as the last one seals. */
function cannon(t: FxTools, r: Box, s: number, ux: number, uy: number) {
  const c = centre(r), nx = -uy, ny = ux, side = s * 0.52;
  const at = (along: number, across = 0): Pt => ({ x: c.x + ux * along * s + nx * (side + across * s), y: c.y + uy * along * s + ny * (side + across * s) });
  const B0 = -0.4, B1 = 0.56, HALF = 0.085;
  const box = (k: number, half: number) => {
    const e = B0 + (B1 - B0) * k, a = at(B0, -half), b = at(e, -half), c2 = at(e, half), d = at(B0, half);
    return [a.x, a.y, b.x, b.y, c2.x, c2.y, d.x, d.y];
  };
  const cells = CELLS.map((when, i) => ({ when, p: at(B0 + (B1 - B0) * (0.22 + i * 0.27)) }));
  const IN = 0.3, slide = (time: number) => easeOut(clamp01((time - IN + 0.1) / 0.14));
  t.draw(D, (g, u) => {
    const time = u * D, k = slide(time), a = fadeAll(time);
    if (k > 0.01) g.poly(box(k, HALF), true).fill({ color: STEEL, alpha: 0.82 * a });
  }, { dark: true });
  t.draw(D, (g, u) => {
    const time = u * D, k = slide(time), a = fadeAll(time);
    if (k <= 0.01) return;
    g.poly(box(k, HALF), true).stroke({ width: 1.5, color: SCOPE, alpha: 0.75 * a, join: "miter" });
    const ang = Math.atan2(uy, ux), L = s * 0.09, W = s * 0.05;
    for (const cl of cells) {
      if (k < 0.5) continue;
      const q = clamp01((time - cl.when + 0.1) / 0.1), sealed = time >= cl.when, hot = sealed ? Math.exp(-(time - cl.when) / 0.12) : 0;
      const ca = Math.cos(ang), sa = Math.sin(ang);
      const pts = [cl.p.x - ca * L, cl.p.y - sa * L, cl.p.x - sa * W, cl.p.y + ca * W, cl.p.x + ca * L, cl.p.y + sa * L, cl.p.x + sa * W, cl.p.y - ca * W];
      // An empty cell is a dim outline; filling, the water rises in it;
      // sealed, it blazes and settles to a steady glow.
      g.poly(pts, true).stroke({ width: 1, color: CELL, alpha: (0.45 + 0.5 * q) * a, join: "miter" });
      if (q > 0) {
        g.circle(cl.p.x, cl.p.y, s * (0.06 + 0.06 * hot)).fill({ color: CELL, alpha: (0.18 + 0.3 * hot) * q * a });
        g.poly(pts, true).fill({ color: CELL, alpha: 0.6 * q * a });
        g.circle(cl.p.x, cl.p.y, s * 0.022 * q).fill({ color: JET, alpha: a });
        // The water spinning inside it under pressure.
        const sp = time * 18, R = s * 0.05;
        g.moveTo(cl.p.x + Math.cos(sp) * R, cl.p.y + Math.sin(sp) * R).arc(cl.p.x, cl.p.y, R, sp, sp + 1.8).stroke({ width: 1, color: JET, alpha: 0.8 * q * a });
      }
    }
    // The muzzle glint as the last cell seals.
    const last = CELLS[CELLS.length - 1], gq = (time - last) / 0.22;
    if (gq > 0 && gq < 1) {
      const p = at(B1 + 0.04), Lg = s * 0.13 * Math.sin(Math.PI * gq);
      g.moveTo(p.x - ux * Lg * 1.4, p.y - uy * Lg * 1.4).lineTo(p.x + ux * Lg * 1.4, p.y + uy * Lg * 1.4)
        .moveTo(p.x - nx * Lg, p.y - ny * Lg).lineTo(p.x + nx * Lg, p.y + ny * Lg).stroke({ width: 1.6, color: JET, alpha: 0.95 * a });
      g.circle(p.x, p.y, Lg * 0.35).fill({ color: CELL, alpha: 0.6 * a });
    }
  });
  // Water drawn in to each cell as it fills, and a pulse as it seals.
  for (const cl of cells) {
    const n = Math.round(6 * t.quality);
    for (let i = 0; i < n; i++) {
      const th = rand(0, TAU), d = s * rand(0.14, 0.24), life = rand(0.08, 0.12);
      const sx = cl.p.x + Math.cos(th) * d, sy = cl.p.y + Math.sin(th) * d;
      t.later(cl.when - life, () => t.spark(sx, sy, (cl.p.x - sx) / life, (cl.p.y - sy) / life, life, INTAKE));
    }
    t.later(cl.when, () => t.flash(cl.p, CELL, 0.12 * (s / 80)));
  }
  t.later(CELLS[CELLS.length - 1], () => {
    const p = at(B1 + 0.04);
    for (let i = 0; i < Math.round(6 * t.quality); i++) {
      const a = Math.atan2(uy, ux) + rand(-0.5, 0.5), v = rand(40, 90) * (s / 90);
      t.spark(p.x, p.y, Math.cos(a) * v, Math.sin(a) * v, rand(0.3, 0.45), MIST);
    }
  });
}

// ── The move ─────────────────────────────────────────────────────────────────

export const CLOUDBURST: Signature = {
  // Loading a gun, not firing it: the board barely stirs.
  shake: 0.25,
  lunge: false,

  land(t: FxTools, m: SigMoment) {
    const s = m.size;
    storm(t, m.from, s);
    reticle(t, m.from, s, Math.atan2(m.ahead.y, m.ahead.x));
    cannon(t, m.from, s, m.ahead.x, m.ahead.y);
  },
};
