/** KLIPSO — Tranq Feather Blade. "Deal 10 DMG (PEN) and STUN the target for 2
 *  rounds." A feather blade through armour, then a stun.
 *
 *  Its art is a hooded assassin in dark feathered armour, amber eyes burning
 *  under the hood, an orange crescent moon behind him, and in his hand a long
 *  sword shaped like ONE glowing ice-blue feather. GALE is wind; Klipso is the
 *  one GALE card that does not blow. Everything about him is quiet.
 *
 *  The DELIVERY is him going: a swirl of dark feathers closing round his card
 *  as he melts into it, the two amber eyes the last thing to go, a thin orange
 *  moon behind him. The feather blade is drawn back at his side, and a glint
 *  runs up it to the point just before he strikes (the token lunges).
 *
 *  The LANDING is one cut, fast and clean: the blade's own FEATHER drawn
 *  straight through the card on the slant, quill first and point out the far
 *  side (PEN — it does not stop at the armour), a white-hot spine with the
 *  vane's barbs lit along it. Then the barbs come loose and scatter as glowing
 *  ice-blue filaments, and instead of an impact a HUSH: soft blue rings that
 *  close in on the card and settle over it — the sedative taking hold (the
 *  STUN), drawn as a calm, not as stars. A few dark feathers drift down after
 *  him. On a kill the blade's feather itself comes loose and drifts down over
 *  the card, rocking, as it goes out.
 *
 *  The light is ice-blue (additive); the feathers he hides in are dark for
 *  real, each with an ice rim so they read over an empty square. */
import { centre, rand } from "../../looks/base";
import type { Graphics } from "pixi.js";
import type { FxTools, Pt, SparkStyle } from "../../looks/types";
import type { Signature, SigMoment } from "../types";

type Box = SigMoment["from"];

const TAU = Math.PI * 2;
// The blade's light: white at the spine, ice through the vane, cobalt at its edge.
const WHITE = 0xffffff, FROST = 0xe4f7ff, ICE = 0x9fe0ff, BLUE = 0x4aa6ff, DEEP = 0x2a6fd0;
/** The hush: a softer, sleepier blue than the blade. */
const HUSH = 0x7cb8ff, HUSH_HI = 0xcfe6ff;
/** His feathers (dark layer only) and the light caught on their edges. */
const PLUME = 0x0a0c16, PLUME_RIM = 0x86c8ff;
/** The amber of his eyes and the orange of the moon behind him. */
const EYE = 0xffb040, MOON = 0xff8a2a;

/** A barb torn off the vane: a fine glowing filament, slow, settling. */
const BARB: SparkStyle = { palette: [WHITE, FROST, ICE, BLUE], gravity: 40, drag: 0.25, size: [6, 1.5], streak: true };
/** Motes of the sedative, sinking onto the card. */
const MOTE: SparkStyle = { palette: [HUSH_HI, HUSH, DEEP], gravity: 18, drag: 0.5, size: [4, 1.5], streak: false };
/** The glint off the blade, struck as he goes. */
const GLINT: SparkStyle = { palette: [WHITE, FROST, ICE], gravity: 0, drag: 0.2, size: [5, 1], streak: true };

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeOut = (x: number) => 1 - (1 - x) * (1 - x);
const easeIn = (x: number) => x * x;
/** Up over the first `a` of 0..1, down over the last `b`. */
const env = (u: number, a: number, b: number) => Math.max(0, Math.min(1, u / a, (1 - u) / b));

// ── The feather ──────────────────────────────────────────────────────────────

/** How wide a feather's vane is `f` of the way from quill to point (0..1 of
 *  its widest): a bare quill, the vane swelling in fast, near-parallel down
 *  its length, then rounding off to the point — the outline that says
 *  FEATHER where a lens says leaf. */
function vane(f: number) {
  if (f < 0.12) return 0.05;
  if (f < 0.3) { const k = (f - 0.12) / 0.18; return 0.05 + 0.95 * k * k * (3 - 2 * k); }
  if (f < 0.82) return 1 - 0.1 * ((f - 0.3) / 0.52);
  return 0.9 * Math.sqrt(Math.max(0, 1 - ((f - 0.82) / 0.18) ** 2));
}
/** A split in the vane at `at`, as a real feather has: a V notched into it. */
const split = (f: number, at: number, depth: number) => 1 - depth * Math.max(0, 1 - Math.abs(f - at) / 0.035);

/** A feather, its quill at (x, y) and its point along `ang`, `len` long and
 *  `w` across at its widest (each side), the far side a touch narrower, a
 *  split `notch` deep cut into each side (big feathers only: on a small one
 *  it reads as a lump), the whole of it bent by `bend` as a flight feather is. Returns the outline and the spine, in world space. */
function feather(x: number, y: number, ang: number, len: number, w: number, bend: number, notch = 0) {
  const N = 26, c = Math.cos(ang), s = Math.sin(ang), left: number[] = [], right: number[] = [], spine: number[] = [];
  const P = (lx: number, ly: number) => [x + lx * c - ly * s, y + lx * s + ly * c];
  for (let i = 0; i <= N; i++) {
    const f = i / N, sx = f * len, sy = bend * len * f * f, hw = w * vane(f);
    left.push(...P(sx, sy - hw * split(f, 0.52, notch)));
    right.unshift(...P(sx, sy + hw * 0.78 * split(f, 0.68, notch)));
    spine.push(...P(sx, sy));
  }
  return { outline: left.concat(right), spine };
}

/** The barbs of a feather's vane: fine lines off the spine, swept toward the
 *  point. */
function barbs(g: Graphics, x: number, y: number, ang: number, len: number, w: number, bend: number,
  color: number, alpha: number) {
  if (alpha <= 0.02) return;
  const c = Math.cos(ang), s = Math.sin(ang);
  const P = (lx: number, ly: number): Pt => ({ x: x + lx * c - ly * s, y: y + lx * s + ly * c });
  for (let i = 3; i < 17; i++) {
    const f = i / 19, f2 = f + 0.08, sy = bend * len * f * f, sy2 = bend * len * f2 * f2;
    for (const side of [-1, 0.78]) {
      const a = P(f * len, sy), b = P(f2 * len, sy2 + side * w * vane(f2) * 0.9);
      g.moveTo(a.x, a.y).lineTo(b.x, b.y);
    }
  }
  g.stroke({ width: 1, color, alpha });
}

/** Dark feathers let go at `at`: thrown, the throw bleeding off, then rocking
 *  down and turning — closed form from birth, so a flurry is two Graphics (the
 *  dark body, and its lit rim over it). */
function plumes(t: FxTools, at: Pt, n: number, s: number, speed: number, dir: number, spread: number, life: number, delay = 0) {
  const fs = Array.from({ length: Math.max(1, Math.round(n * t.quality)) }, () => {
    const a = dir + rand(-spread, spread), v = speed * rand(0.4, 1);
    return { vx: Math.cos(a) * v, vy: Math.sin(a) * v, ph: rand(0, TAU), rock: rand(5, 8), rot: rand(0, TAU),
      len: s * rand(0.26, 0.34), life: life * rand(0.8, 1), fall: rand(30, 50) * (s / 90) };
  });
  const each = (u: number, fn: (o: ReturnType<typeof feather>, a: number) => void) => {
    const time = u * life, d = 0.18 * (1 - Math.exp(-time / 0.18));
    for (const f of fs) {
      const q = time / f.life;
      if (q >= 1) continue;
      const sw = Math.sin(time * f.rock + f.ph);
      const ang = f.rot + time * 0.8 + 0.6 * sw;
      const qx = at.x + f.vx * d + f.len * 0.4 * sw, qy = at.y + f.vy * d + f.fall * time;
      fn(feather(qx - Math.cos(ang) * f.len * 0.5, qy - Math.sin(ang) * f.len * 0.5, ang, f.len, f.len * 0.16, 0.12), Math.min(1, q * 10) * (1 - q * q));
    }
  };
  t.draw(life, (g, u) => each(u, (o, a) => { g.poly(o.outline, true).fill({ color: PLUME, alpha: 0.9 * a }); }), { dark: true, delay });
  t.draw(life, (g, u) => each(u, (o, a) => {
    g.poly(o.outline, true).stroke({ width: 1, color: PLUME_RIM, alpha: 0.7 * a });
    g.poly(o.spine, false).stroke({ width: 1, color: ICE, alpha: 0.35 * a });
  }), { delay });
}

/** The line of the cut: from Klipso to the card, and the slant it runs on. */
function lineOf(m: SigMoment) {
  const c = centre(m.from), p = m.targets.length ? centre(m.targets[0]) : { x: c.x + m.ahead.x * m.size, y: c.y + m.ahead.y * m.size };
  const at = Math.atan2(p.y - c.y, p.x - c.x);
  return { c, p, at };
}

export const KLIPSO: Signature = {
  shake: 0.6,

  deliver(t: FxTools, m: SigMoment, seconds: number) {
    const { c, at } = lineOf(m), s = m.size, T = seconds;
    const side = { x: -Math.sin(at), y: Math.cos(at) };
    // THE SWIRL: dark feathers closing round him as he goes into them.
    const n = Math.max(5, Math.round(9 * t.quality));
    const ring = Array.from({ length: n }, (_, i) => ({ th: (i / n) * TAU + rand(-0.3, 0.3), r: rand(0.62, 0.85), len: s * rand(0.36, 0.44), sp: rand(5, 7) }));
    const swirl = (u: number, fn: (o: ReturnType<typeof feather>, a: number) => void) => {
      const time = u * T, close = easeIn(u), a = env(u, 0.2, 0.25);
      for (const f of ring) {
        const th = f.th + f.sp * time * (1 + close), r = s * f.r * (1 - 0.55 * close);
        const x = c.x + Math.cos(th) * r, y = c.y + Math.sin(th) * r * 0.9, ang = th + Math.PI / 2 + 0.3;
        fn(feather(x - Math.cos(ang) * f.len * 0.5, y - Math.sin(ang) * f.len * 0.5, ang, f.len, f.len * 0.16, -0.15), a);
      }
    };
    t.draw(T, (g, u) => swirl(u, (o, a) => { g.poly(o.outline, true).fill({ color: PLUME, alpha: 0.85 * a }); }), { dark: true });
    t.draw(T, (g, u) => swirl(u, (o, a) => { g.poly(o.outline, true).stroke({ width: 1.2, color: PLUME_RIM, alpha: 0.75 * a }); }));
    // The moon behind him, a thin orange crescent; and his eyes, the last of
    // him to go.
    const back = { x: c.x - Math.cos(at) * s * 0.18, y: c.y - Math.sin(at) * s * 0.18 };
    t.draw(T, (g, u) => {
      const a = env(u, 0.3, 0.3), R = s * 0.36, mx = back.x + side.x * s * 0.08, my = back.y + side.y * s * 0.08;
      g.moveTo(mx + Math.cos(at + 2.0) * R, my + Math.sin(at + 2.0) * R).arc(mx, my, R, at + 2.0, at + 4.3)
        .arc(mx - Math.cos(at + 3.15) * R * 0.22, my - Math.sin(at + 3.15) * R * 0.22, R * 0.86, at + 4.3, at + 2.0, true)
        .fill({ color: MOON, alpha: 0.4 * a });
      const e = env(clamp01((u - 0.1) / 0.75), 0.15, 0.35), ex = c.x - Math.cos(at) * s * 0.06, ey = c.y - Math.sin(at) * s * 0.06;
      for (const k of [-1, 1]) {
        const x = ex + side.x * s * 0.07 * k, y = ey + side.y * s * 0.07 * k;
        g.circle(x, y, s * 0.05).fill({ color: EYE, alpha: 0.25 * e }).circle(x, y, s * 0.018).fill({ color: 0xffe2a0, alpha: 0.95 * e });
      }
    });
    // THE BLADE: the ice feather held back at his side, a glint running up
    // it to the point just before the strike.
    const held = at + Math.PI * 0.72, q = { x: c.x + side.x * s * 0.2, y: c.y + side.y * s * 0.2 }, L = s * 0.8;
    t.draw(T, (g, u) => {
      const a = env(u, 0.25, 0.08), sw = held - 0.35 * easeIn(clamp01((u - 0.6) / 0.4));
      const o = feather(q.x, q.y, sw, L, s * 0.085, 0.1);
      g.poly(o.outline, true).fill({ color: BLUE, alpha: 0.32 * a }).stroke({ width: 1.2, color: ICE, alpha: 0.8 * a });
      g.poly(o.spine, false).stroke({ width: 1.4, color: FROST, alpha: 0.9 * a });
      barbs(g, q.x, q.y, sw, L, s * 0.085, 0.1, ICE, 0.45 * a);
      const gl = clamp01((u - 0.45) / 0.35);
      if (gl > 0 && gl < 1) {
        const x = q.x + Math.cos(sw) * L * gl, y = q.y + Math.sin(sw) * L * gl, r = s * 0.11 * Math.sin(Math.PI * gl);
        g.moveTo(x - r, y).lineTo(x + r, y).moveTo(x, y - r).lineTo(x, y + r).stroke({ width: 1.5, color: WHITE, alpha: 0.95 });
        g.circle(x, y, r * 0.45).fill({ color: FROST, alpha: 0.6 });
      }
    });
    t.later(T * 0.8, () => {
      const x = q.x + Math.cos(held - 0.3) * L, y = q.y + Math.sin(held - 0.3) * L;
      for (let i = 0; i < 4; i++) {
        const a = rand(0, TAU), v = rand(40, 90) * (s / 90);
        t.spark(x, y, Math.cos(a) * v, Math.sin(a) * v, rand(0.15, 0.25), GLINT);
      }
    });
  },

  land(t: FxTools, m: SigMoment) {
    if (!m.targets.length) return;
    const { p, at } = lineOf(m), s = m.size, r = m.targets[0];
    const k = Math.max(0.8, Math.min(1.6, m.power[0] ?? 1));
    // THE CUT: the blade's feather driven through the card on the slant, point
    // first — in on the near side, out the far side (PEN) — leaving the cut
    // behind it as a white sliver across the card.
    const slant = at + 0.5 * (Math.random() < 0.5 ? -1 : 1), L = s * 0.95, w = s * 0.095 * Math.min(1.2, k);
    const ux = Math.cos(slant), uy = Math.sin(slant), nx = -uy, ny = ux, BEND = 0.06;
    const E = { x: p.x - ux * s * 0.72, y: p.y - uy * s * 0.72 }, X = { x: p.x + ux * s * 0.72, y: p.y + uy * s * 0.72 };
    /** Where the feather's point is, `time` into the pass: already in the
     *  card on the landing frame, out past it a beat later, slowing. */
    const PASS = 0.14, run = s * 0.3 + s * 0.72 + L * 0.85;
    const tipAt = (time: number) => {
      const d = -s * 0.3 + run * easeOut(clamp01(time / PASS));
      return { x: p.x + ux * d, y: p.y + uy * d, d };
    };
    const D = 0.6;
    t.draw(D, (g, u) => {
      const time = u * D, tip = tipAt(time);
      // The cut it leaves: a sliver from where it went in to where its point
      // is, white at the heart, held a moment and then closing.
      const reach = Math.min(tip.d, s * 0.72), cl = 1 - clamp01((time - 0.2) / 0.35);
      if (cl > 0 && reach > -s * 0.7) {
        const B = { x: p.x + ux * reach, y: p.y + uy * reach }, mid = { x: (E.x + B.x) / 2, y: (E.y + B.y) / 2 };
        const sl = (wd: number) => g.poly([E.x, E.y,
          mid.x + nx * wd, mid.y + ny * wd, B.x, B.y, mid.x - nx * wd * 0.6, mid.y - ny * wd * 0.6], true);
        sl(s * 0.13 * cl).fill({ color: BLUE, alpha: 0.32 * cl });
        sl(s * 0.045 * cl).fill({ color: WHITE, alpha: 0.95 * cl });
      }
      // The feather itself, flying through: gone into its barbs as it slows.
      const a = 1 - clamp01((time - PASS * 0.85) / 0.12);
      if (a <= 0.02) return;
      const q = { x: tip.x - ux * L, y: tip.y - uy * L };
      const o = feather(q.x, q.y, slant, L, w, BEND, 0.5);
      g.poly(o.spine, false).stroke({ width: w * 3.2, color: DEEP, alpha: 0.25 * a, cap: "round" });
      g.poly(o.outline, true).fill({ color: BLUE, alpha: 0.5 * a }).stroke({ width: 1.5, color: ICE, alpha: 0.95 * a });
      barbs(g, q.x, q.y, slant, L, w, BEND, FROST, 0.75 * a);
      g.poly(o.spine, false).stroke({ width: Math.max(2, s * 0.03), color: WHITE, alpha: a });
      g.circle(tip.x, tip.y, s * 0.08).fill({ color: ICE, alpha: 0.4 * a }).circle(tip.x, tip.y, s * 0.03).fill({ color: WHITE, alpha: a });
    });
    t.later(0.03, () => {
      t.flash(p, ICE, 0.1 * k * (s / 80));
      t.glow(r, BLUE, 0.22, 0.35, 1.0);
    });
    // The far side: where it came out, a thin spray thrown on along the cut.
    t.later(0.06, () => {
      for (let i = 0; i < Math.round(6 * k); i++) {
        const a = slant + rand(-0.25, 0.25), v = rand(140, 260) * (s / 90);
        t.spark(X.x, X.y, Math.cos(a) * v, Math.sin(a) * v, rand(0.15, 0.28), GLINT);
      }
    });
    // THE BARBS LET GO: the feather comes apart into glowing filaments as it
    // slows past the card, and more peel off both lips of the cut, drifting
    // out and sinking.
    t.later(PASS * 0.85, () => {
      const tip = tipAt(PASS), n = Math.round(16 * k * t.quality);
      for (let i = 0; i < n; i++) {
        const f = rand(0.1, 0.95), sd = Math.random() < 0.5 ? -1 : 1, hw = w * Math.sin(Math.PI * f);
        const x = tip.x - ux * L * (1 - f) + nx * hw * sd, y = tip.y - uy * L * (1 - f) + ny * hw * sd;
        const v = rand(30, 80) * (s / 90);
        t.spark(x, y, (nx * sd + ux * 0.8) * v, (ny * sd + uy * 0.8) * v, rand(0.45, 0.75), BARB);
      }
      for (let i = 0; i < Math.round(10 * k * t.quality); i++) {
        const f = rand(0, 1), sd = Math.random() < 0.5 ? -1 : 1, v = rand(20, 55) * (s / 90);
        t.spark(E.x + (X.x - E.x) * f, E.y + (X.y - E.y) * f, nx * sd * v, ny * sd * v, rand(0.4, 0.65), BARB);
      }
    });
    // THE HUSH: soft rings closing in on the card and settling over it.
    hush(t, r, p, s, 0.16);
    // Dark feathers drifting down after him.
    plumes(t, { x: p.x, y: p.y - s * 0.35 }, 4, s, 70 * (s / 90), -Math.PI / 2, 1.4, 0.9, 0.05);
    if (m.killed[0]) t.later(0.22, () => fallen(t, p, s, slant));
  },
};

/** The sedative taking hold: two soft blue rings closing in from round the
 *  card and settling on it, the second lagging, a calm glow under them, and
 *  a few motes sinking onto it. Inward and slow — the opposite of a blow. */
function hush(t: FxTools, r: Box, p: Pt, s: number, delay: number) {
  const D = 0.8;
  for (let j = 0; j < 2; j++)
    t.draw(D, (g, u) => {
      const R = s * (0.95 - 0.45 * easeOut(clamp01(u / 0.7))), a = env(u, 0.2, 0.45) * (j ? 0.6 : 1);
      g.ellipse(p.x, p.y, R, R * 0.92).stroke({ width: 6, color: HUSH, alpha: 0.18 * a });
      g.ellipse(p.x, p.y, R, R * 0.92).stroke({ width: 1.6, color: HUSH_HI, alpha: 0.7 * a });
    }, { delay: delay + j * 0.12 });
  t.later(delay + 0.2, () => t.glow(r, HUSH, 0.2, 0.65, 0.9));
  const n = Math.round(8 * t.quality);
  for (let i = 0; i < n; i++)
    t.later(delay + rand(0.05, 0.4), () => {
      const a = rand(0, TAU), R = s * rand(0.45, 0.6);
      t.spark(p.x + Math.cos(a) * R, p.y + Math.sin(a) * R, -Math.cos(a) * 25 * (s / 90), -Math.sin(a) * 25 * (s / 90) + 10, rand(0.5, 0.7), MOTE);
    });
}

/** A kill: the blade's feather comes loose and drifts down over the card,
 *  rocking side to side, its glow going out as it settles. */
function fallen(t: FxTools, p: Pt, s: number, slant: number) {
  const D = 0.85, len = s * 0.7;
  t.draw(D, (g, u) => {
    const time = u * D, sw = Math.sin(time * 6.5), a = env(u, 0.12, 0.5);
    const x = p.x + sw * s * 0.18, y = p.y - s * 0.3 + s * 0.45 * easeOut(u), ang = slant * 0.2 - Math.PI / 2 + 1.2 + 0.45 * sw;
    const qx = x - Math.cos(ang) * len * 0.5, qy = y - Math.sin(ang) * len * 0.5;
    const o = feather(qx, qy, ang, len, len * 0.13, 0.1, 0.5);
    g.poly(o.outline, true).fill({ color: BLUE, alpha: 0.4 * a }).stroke({ width: 1.3, color: ICE, alpha: 0.9 * a });
    g.poly(o.spine, false).stroke({ width: 1.3, color: WHITE, alpha: 0.85 * a });
    barbs(g, qx, qy, ang, len, len * 0.13, 0.1, FROST, 0.5 * a);
  });
  t.ring({ x: p.x - s / 2, y: p.y - s / 2, w: s, h: s }, ICE, 0.3, 1.2, 0.45, 2);
}
