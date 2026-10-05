/** PRISM — Enchantment. "Enchant your weapon (Freezing, Burning, Sleeping or
 *  Sharpen), then strike at once if an opponent is in range, otherwise store
 *  the charge for your next basic." — a prism splits one blow into frost,
 *  fire, sleep or edge.
 *
 *  On her art Prism is a white-haired knight in silver plate holding a sword
 *  of RAINBOW CRYSTAL, prismatic shards and spectral light all round her. The
 *  move is light refracting through that blade. The signature is not told
 *  which of the four enchantments she picked, so it draws the prism splitting
 *  white light into all four: frost blue, fire orange, sleep violet and steel
 *  white.
 *
 *  The DELIVERY (only when she has someone to strike) is the enchanting: a
 *  clear crystal blade crystallises over her card from the hilt up, a beam of
 *  white light strikes it side-on, and out of the far side it comes SPLIT — a
 *  fan of four coloured rays — which bend back in and wind round the blade as
 *  four ribbons while it glows rainbow along its length.
 *
 *  The LANDING with a target is the enchanted cut. The blade flares at her
 *  card and the four ribbons leave it as four coloured rays that converge on
 *  the target; there a crescent slash is drawn through the card, a white core
 *  fringed in the spectrum, its colours dispersing apart as it fades (the cut
 *  is itself refracted light), and crystal shards in the four colours scatter
 *  off it and fall. A kill breaks the light open: a prismatic starburst. The
 *  landing alone still reads as Prism if no delivery ran: the rainbow blade
 *  appears at her card as the cut lands.
 *
 *  STORED, with nobody in range, there is no delivery and no target: the
 *  landing is the whole enchanting — the blade forms, the white beam strikes
 *  and splits into four, the rays wrap the blade, a bright gleam runs up its
 *  edge and flares at the tip, and the blade settles holding its rainbow
 *  charge before it fades (the next basic carries it).
 *
 *  The only rainbow move in the game, and it is LIGHT through CRYSTAL: all of
 *  it is drawn additive and pale, the spectrum used only where light splits. */
import { centre, rand } from "../../looks/base";
import type { Graphics } from "pixi.js";
import type { FxTools, Pt, SparkStyle } from "../../looks/types";
import type { Signature, SigMoment } from "../types";

type Box = SigMoment["from"];

const TAU = Math.PI * 2;
/** The four enchantments, in the order the prism splits them. */
const FROST = 0x8fe2ff, FIRE = 0xff8a2e, SLEEP = 0xb68cff, STEEL = 0xf2f6ff;
const ENCHANTS = [FROST, FIRE, SLEEP, STEEL];
/** The spectrum a refracted edge shows, red to violet. */
const SPECTRUM = [0xff4a4a, 0xff9a2e, 0xffe14a, 0x5cff8a, 0x45d6ff, 0x5c7cff, 0xb45cff];
/** Clear crystal, and the white light going into it. */
const GLASS = 0xdff4ff, WHITE = 0xffffff;
/** Glints shed off the charged blade: they drift and fade, light not stone. */
const MOTE = (c: number): SparkStyle => ({ palette: [WHITE, c, c], gravity: -40, drag: 0.5, size: [4, 1], streak: false });
/** Sparks thrown off the cut, one style per enchantment colour. */
const FLECK = ENCHANTS.map((c): SparkStyle => ({ palette: [WHITE, c, c], gravity: 500, drag: 0.4, size: [5, 1.5], streak: true }));
const MOTES = ENCHANTS.map(MOTE);

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeOut = (x: number) => 1 - (1 - x) * (1 - x);
/** Up over `rise`, held, down after `fall`: 0 at both ends of `u`. */
const env = (u: number, rise: number, fall: number) => (u < rise ? u / rise : u > fall ? Math.max(0, 1 - (u - fall) / (1 - fall)) : 1);
const rot = (v: Pt, a: number): Pt => ({ x: v.x * Math.cos(a) - v.y * Math.sin(a), y: v.x * Math.sin(a) + v.y * Math.cos(a) });
const unit = (a: Pt, b: Pt): Pt => {
  const dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 1;
  return { x: dx / l, y: dy / l };
};

// ── The blade ────────────────────────────────────────────────────────────────

/** Where the blade stands: its hilt, its line `d` (hilt to tip), the side `n`
 *  the white light leaves by, its length and width. Held raised across her
 *  card, leaning off the line she faces. */
interface Blade { hilt: Pt; d: Pt; n: Pt; len: number; w: number; mid: Pt }

function bladeAt(c: Pt, toward: Pt, ahead: Pt, s: number): Blade {
  const d = rot(toward, -0.5), len = s * 0.98;
  let n = { x: -d.y, y: d.x };
  // The split light leaves on her own side, away from what she faces, so the
  // fan never lands on the card she is about to cut.
  if (n.x * ahead.x + n.y * ahead.y > 0) n = { x: -n.x, y: -n.y };
  const hilt = { x: c.x - d.x * len * 0.42, y: c.y - d.y * len * 0.42 };
  return { hilt, d, n, len, w: s * 0.17, mid: { x: hilt.x + d.x * len * 0.5, y: hilt.y + d.y * len * 0.5 } };
}

/** The point `f` along the blade, `side` (-1..1) of its half-width across it.
 *  The profile is a sword's: a short shoulder, a long straight run, a point. */
function bp(B: Blade, f: number, side: number): Pt {
  const half = (B.w / 2) * (f < 0.1 ? 0.75 + 2.5 * f : f < 0.78 ? 1 - 0.15 * ((f - 0.1) / 0.68) : 0.85 * (1 - (f - 0.78) / 0.22));
  return { x: B.hilt.x + B.d.x * B.len * f + B.n.x * half * side, y: B.hilt.y + B.d.y * B.len * f + B.n.y * half * side };
}

/** The blade outline, crystallised `grow` of its length from the hilt. */
function outline(B: Blade, grow: number): number[] {
  const out: number[] = [], back: number[] = [], N = 10;
  for (let i = 0; i <= N; i++) {
    const f = (i / N) * grow, l = bp(B, f, 1), r = bp(B, f, -1);
    out.push(l.x, l.y);
    back.unshift(r.x, r.y);
  }
  if (grow > 0.99) {
    const tip = bp(B, 1, 0);
    out.push(tip.x, tip.y);
  }
  return out.concat(back);
}

/** The crystal blade, all light: a pale glass body, a rainbow sheen running up
 *  it (`sheen`, its colours sliding with `time`), four coloured ribbons wound
 *  round it (`wrap`, their swing; 0 for none), white edges, a ridge and a
 *  silver guard. */
function drawBlade(g: Graphics, B: Blade, grow: number, sheen: number, wrap: number, time: number, alpha: number) {
  if (alpha <= 0.02 || grow <= 0.02) return;
  const body = outline(B, grow);
  g.poly(body, true).stroke({ width: B.w * 0.9, color: GLASS, alpha: 0.12 * alpha, join: "round" });
  g.poly(body, true).fill({ color: GLASS, alpha: 0.28 * alpha });
  if (sheen > 0.02) {
    const N = 7, shift = time * 9;
    for (let k = 0; k < N; k++) {
      const f0 = (k / N) * grow, f1 = ((k + 1) / N) * grow;
      const a0 = bp(B, f0, 1), a1 = bp(B, f1, 1), b1 = bp(B, f1, -1), b0 = bp(B, f0, -1);
      const col = SPECTRUM[(k + Math.floor(shift)) % SPECTRUM.length];
      g.poly([a0.x, a0.y, a1.x, a1.y, b1.x, b1.y, b0.x, b0.y], true).fill({ color: col, alpha: 0.5 * sheen * alpha });
    }
  }
  if (wrap > 0.02) {
    // Four ribbons a quarter-turn apart: a helix seen side-on. The half of each
    // turn that passes behind the blade is drawn fainter.
    for (let j = 0; j < 4; j++) {
      let px = 0, py = 0;
      for (let i = 0; i <= 16; i++) {
        const f = 0.06 + (i / 16) * (grow - 0.08);
        const ph = f * 14 + j * (Math.PI / 2) - time * 12;
        const c = bp(B, f, 0), off = Math.sin(ph) * B.w * (0.5 + wrap * 0.5);
        const x = c.x + B.n.x * off, y = c.y + B.n.y * off;
        if (i > 0) g.moveTo(px, py).lineTo(x, y).stroke({ width: 2.5, color: ENCHANTS[j], alpha: (Math.cos(ph) > 0 ? 0.95 : 0.35) * wrap * alpha });
        px = x; py = y;
      }
    }
  }
  g.poly(body, true).stroke({ width: 2, color: WHITE, alpha: 0.9 * alpha, join: "round" });
  const r0 = bp(B, 0.02, 0), r1 = bp(B, grow * 0.97, 0);
  g.moveTo(r0.x, r0.y).lineTo(r1.x, r1.y).stroke({ width: 1, color: WHITE, alpha: 0.7 * alpha });
  // The guard and grip: silver, across the hilt.
  const gl = B.w * 1.2;
  g.moveTo(B.hilt.x + B.n.x * gl, B.hilt.y + B.n.y * gl).lineTo(B.hilt.x - B.n.x * gl, B.hilt.y - B.n.y * gl)
    .stroke({ width: 4, color: STEEL, alpha: 0.9 * alpha, cap: "round" });
  g.moveTo(B.hilt.x, B.hilt.y).lineTo(B.hilt.x - B.d.x * B.w * 1.1, B.hilt.y - B.d.y * B.w * 1.1)
    .stroke({ width: 2.5, color: STEEL, alpha: 0.7 * alpha, cap: "round" });
}

/** A four-pointed glint: a long spike along `a` and a shorter one across. */
function star(g: Graphics, p: Pt, r: number, a: number, color: number, alpha: number) {
  if (alpha <= 0.02 || r < 1) return;
  for (const [ang, len] of [[a, r], [a + Math.PI / 2, r * 0.65]] as const) {
    const ux = Math.cos(ang), uy = Math.sin(ang), w = r * 0.11;
    g.poly([p.x + ux * len, p.y + uy * len, p.x - uy * w, p.y + ux * w, p.x - ux * len, p.y - uy * len, p.x + uy * w, p.y - ux * w], true)
      .fill({ color, alpha });
  }
  g.circle(p.x, p.y, r * 0.22).fill({ color: WHITE, alpha });
}

/** White light going into the blade at its middle, from off its far side:
 *  a soft beam with a hard core, reaching `f` of the way in. */
function beam(g: Graphics, B: Blade, s: number, f: number, alpha: number) {
  if (alpha <= 0.02 || f <= 0) return;
  const src = { x: B.mid.x - B.n.x * s * 1.25 - B.d.x * s * 0.2, y: B.mid.y - B.n.y * s * 1.25 - B.d.y * s * 0.2 };
  const x = src.x + (B.mid.x - src.x) * f, y = src.y + (B.mid.y - src.y) * f;
  g.moveTo(src.x, src.y).lineTo(x, y).stroke({ width: 9, color: WHITE, alpha: 0.2 * alpha, cap: "round" });
  g.moveTo(src.x, src.y).lineTo(x, y).stroke({ width: 3, color: WHITE, alpha: 0.95 * alpha, cap: "round" });
}

/** The split: four coloured rays fanning out of the blade's far side, `out`
 *  of their length, closing back toward the blade by `close` (0..1). */
function fan(g: Graphics, B: Blade, s: number, out: number, close: number, alpha: number) {
  if (alpha <= 0.02 || out <= 0) return;
  const base = Math.atan2(B.n.y + B.d.y * 0.2, B.n.x + B.d.x * 0.2);
  for (let j = 0; j < 4; j++) {
    const a = base + (j - 1.5) * 0.24 * (1 - close) + close * 1.1 * (j < 2 ? -1 : 1) * 0.6;
    const L = s * 1.2 * out * (1 - 0.55 * close);
    const ex = B.mid.x + Math.cos(a) * L, ey = B.mid.y + Math.sin(a) * L;
    g.moveTo(B.mid.x, B.mid.y).lineTo(ex, ey).stroke({ width: 9, color: ENCHANTS[j], alpha: 0.25 * alpha, cap: "round" });
    g.moveTo(B.mid.x, B.mid.y).lineTo(ex, ey).stroke({ width: 3, color: ENCHANTS[j], alpha: 0.95 * alpha, cap: "round" });
  }
  g.circle(B.mid.x, B.mid.y, B.w * 0.9).fill({ color: WHITE, alpha: 0.7 * alpha });
}

/** Glints drifting off the charged blade, `rate` a second, in the four colours. */
function motes(t: FxTools, B: Blade, s: number, dt: number, rate: number, acc: { v: number }) {
  acc.v += dt * rate * t.quality;
  for (; acc.v >= 1; acc.v--) {
    const j = Math.floor(rand(0, 4)), p = bp(B, rand(0.1, 0.95), rand(-1, 1));
    t.spark(p.x, p.y, rand(-25, 25) * (s / 90), rand(-45, -10) * (s / 90), rand(0.35, 0.6), MOTES[j]);
  }
}

// ── The cut ──────────────────────────────────────────────────────────────────

/** A crescent from `a` to `b`, bowed `bulge` px across, `thick` at its belly
 *  and pointed at both ends, drawn `f` of the way along and shifted by `off`. */
function crescent(a: Pt, b: Pt, bulge: number, thick: number, f: number, off: Pt): number[] {
  const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
  const N = 14, n = Math.max(2, Math.round(N * f)), one: number[] = [], two: number[] = [];
  for (let i = 0; i <= n; i++) {
    const u = (i / n) * f, bow = 4 * u * (1 - u), w = (thick / 2) * bow;
    const x = a.x + dx * u + nx * bulge * bow + off.x, y = a.y + dy * u + ny * bulge * bow + off.y;
    one.push(x + nx * w, y + ny * w);
    two.unshift(x - nx * w, y - ny * w);
  }
  return one.concat(two);
}

/** The enchanted slash through a card hit from `from`: a white crescent
 *  fringed in the spectrum, the fringes dispersing apart as it fades; crystal
 *  shards in the four colours struck off it, falling. */
function slash(t: FxTools, r: Box, from: Pt, power: number, killed: boolean) {
  const p = centre(r), s = Math.min(r.w, r.h), k = Math.max(0.75, Math.min(1.6, power));
  const th = Math.atan2(p.y - from.y, p.x - from.x), across = th + Math.PI / 2 + 0.45;
  const R = s * 0.72 * Math.min(1.2, 0.85 + 0.15 * k);
  const a = { x: p.x - Math.cos(across) * R, y: p.y - Math.sin(across) * R };
  const b = { x: p.x + Math.cos(across) * R, y: p.y + Math.sin(across) * R };
  const nx = -Math.sin(across), ny = Math.cos(across);
  const bulge = (nx * Math.cos(th) + ny * Math.sin(th) > 0 ? 1 : -1) * s * 0.2; // bowed the way the blow goes
  const fx = Math.cos(th), fy = Math.sin(th);
  const D = 0.6, DRAW = 0.07, thick = s * 0.2 * Math.sqrt(k);
  t.draw(D, (g, u) => {
    const time = u * D, f = easeOut(clamp01(time / DRAW)), fade = 1 - clamp01((time - 0.12) / (D - 0.12));
    // The spectrum, spreading apart along the blow as the light disperses...
    const spread = s * (0.015 + 0.04 * easeOut(clamp01(time / 0.4)));
    SPECTRUM.forEach((col, j) => {
      const o = (j - 3) * spread;
      g.poly(crescent(a, b, bulge, thick * 0.75, f, { x: fx * o, y: fy * o }), true).fill({ color: col, alpha: 0.55 * fade });
    });
    // ...round a white core that burns out first.
    const core = 1 - clamp01((time - 0.08) / 0.25);
    g.poly(crescent(a, b, bulge, thick * 0.5, f, { x: 0, y: 0 }), true).fill({ color: WHITE, alpha: 0.95 * core });
  });
  t.flash(p, WHITE, 0.32 * k * (s / 90), DRAW * 0.5);
  t.ring(r, GLASS, 0.3, 1.0, 0.3, 2);

  // Shards of the crystal, in the four colours, flung on along the blow.
  const n = Math.max(4, Math.round(12 * k * t.quality));
  const shards = Array.from({ length: n }, (_, i) => {
    const ang = th + rand(-1.2, 1.2), v = rand(110, 240) * (s / 90);
    return { col: ENCHANTS[i % 4], vx: Math.cos(ang) * v, vy: Math.sin(ang) * v - rand(40, 120) * (s / 90), a0: rand(0, TAU), va: rand(-14, 14),
      len: s * rand(0.07, 0.12), life: rand(0.4, 0.6), o: rand(-0.6, 0.6) };
  });
  const SD = 0.62, gy = 650 * (s / 90);
  t.draw(SD, (g, u) => {
    const time = u * SD;
    for (const sh of shards) {
      if (time > sh.life) continue;
      const x = p.x + Math.cos(across) * R * sh.o * 0.6 + sh.vx * time, y = p.y + Math.sin(across) * R * sh.o * 0.6 + sh.vy * time + gy * time * time;
      const ang = sh.a0 + sh.va * time, fade = 1 - (time / sh.life) ** 2, ux = Math.cos(ang), uy = Math.sin(ang), w = sh.len * 0.32;
      const pts = [x + ux * sh.len, y + uy * sh.len, x - uy * w, y + ux * w, x - ux * sh.len * 0.45, y - uy * sh.len * 0.45, x + uy * w, y - ux * w];
      g.poly(pts, true).fill({ color: sh.col, alpha: 0.8 * fade }).stroke({ width: 1.2, color: WHITE, alpha: 0.9 * fade });
    }
  }, { delay: DRAW * 0.5 });
  const sparks = Math.round(10 * k);
  for (let i = 0; i < sparks; i++) {
    const ang = th + rand(-1.4, 1.4), v = rand(140, 300) * (s / 90), q = rand(-0.8, 0.8);
    t.spark(p.x + Math.cos(across) * R * q, p.y + Math.sin(across) * R * q, Math.cos(ang) * v, Math.sin(ang) * v - 60 * (s / 90), rand(0.25, 0.45), FLECK[i % 4]);
  }
  if (killed) t.later(0.1, () => burst(t, r, s));
}

/** A kill: the light breaks open on the card — a starburst of spectrum rays
 *  turning as it fades, a white star at its heart. */
function burst(t: FxTools, r: Box, s: number) {
  const p = centre(r), a0 = rand(0, TAU), D = 0.55;
  t.draw(D, (g, u) => {
    const out = easeOut(clamp01(u / 0.3)), fade = 1 - clamp01((u - 0.25) / 0.75);
    for (let j = 0; j < 14; j++) {
      const a = a0 + (j / 14) * TAU + u * 0.6, L = s * (j % 2 ? 0.55 : 0.85) * out, col = SPECTRUM[j % SPECTRUM.length];
      g.moveTo(p.x + Math.cos(a) * s * 0.08, p.y + Math.sin(a) * s * 0.08).lineTo(p.x + Math.cos(a) * L, p.y + Math.sin(a) * L)
        .stroke({ width: 3, color: col, alpha: 0.75 * fade, cap: "round" });
    }
    star(g, p, s * 0.42 * out, a0, WHITE, 0.9 * fade);
  });
  t.glow(r, GLASS, 0.35, 0.5, 1.1);
}

export const PRISM: Signature = {
  shake: 0.6,
  // The cut comes off the blade where it is drawn, over her own card; the
  // light carries it the one square to the target.
  lunge: false,

  deliver(t: FxTools, m: SigMoment, seconds: number) {
    const T = seconds, s = m.size, c = centre(m.from);
    const toward = m.targets.length ? unit(c, centre(m.targets[0])) : m.ahead;
    const B = bladeAt(c, toward, m.ahead, s), acc = { v: 0 };
    t.charge(B.mid, s * 0.9, GLASS, 0.3, T);
    t.draw(T, (g, u, dt) => {
      const time = u * T;
      const grow = easeOut(clamp01(u / 0.35));
      const sheen = clamp01((u - 0.4) / 0.4), wrap = clamp01((u - 0.55) / 0.35);
      // The white beam strikes the blade side-on...
      beam(g, B, s, easeOut(clamp01((u - 0.12) / 0.25)), env(clamp01((u - 0.12) / 0.55), 0.2, 0.7));
      // ...and leaves it split into four, which close back round the blade.
      fan(g, B, s, easeOut(clamp01((u - 0.33) / 0.2)), clamp01((u - 0.55) / 0.3), clamp01((u - 0.33) / 0.05) * (1 - clamp01((u - 0.7) / 0.2)));
      drawBlade(g, B, grow, sheen, wrap, time, Math.min(1, u * 6));
      if (u > 0.5) motes(t, B, s, dt, 30, acc);
    });
    // Crystallising: a glint at the tip as it forms.
    t.later(T * 0.33, () => t.flash(bp(B, 1, 0), GLASS, 0.15 * (s / 90)));
  },

  land(t: FxTools, m: SigMoment) {
    const s = m.size, c = centre(m.from);
    if (!m.targets.length) return stored(t, m);
    const tgt = m.targets[0], p = centre(tgt);
    const B = bladeAt(c, unit(c, p), m.ahead, s), tip = bp(B, 0.95, 0);
    // The blade flares and lets go of its four colours...
    const D = 0.42;
    t.draw(D, (g, u) => {
      const time = u * D, fade = 1 - clamp01((u - 0.3) / 0.7);
      drawBlade(g, B, 1, 1 - u * 0.6, Math.max(0, 1 - u * 2.5), time, fade);
      // ...four rays from the blade to the target, converging on the cut.
      const reach = easeOut(clamp01(time / 0.07)), ra = 1 - clamp01((time - 0.1) / 0.18);
      for (let j = 0; j < 4; j++) {
        const sx = tip.x + B.n.x * B.w * (j - 1.5) * 0.9, sy = tip.y + B.n.y * B.w * (j - 1.5) * 0.9;
        const ex = sx + (p.x - sx) * reach, ey = sy + (p.y - sy) * reach;
        g.moveTo(sx, sy).lineTo(ex, ey).stroke({ width: 9, color: ENCHANTS[j], alpha: 0.22 * ra, cap: "round" });
        g.moveTo(sx, sy).lineTo(ex, ey).stroke({ width: 3, color: ENCHANTS[j], alpha: 0.95 * ra, cap: "round" });
      }
    });
    t.flash(tip, WHITE, 0.2 * (s / 90));
    t.later(0.06, () => slash(t, tgt, c, m.power[0] ?? 1, !!m.killed[0]));
  },
};

/** STORED: nobody in reach, so the enchanting is the whole move — the blade
 *  forms, the beam splits into four and they wrap it, a gleam runs up its
 *  edge to the tip, and it settles holding the charge. */
function stored(t: FxTools, m: SigMoment) {
  const s = m.size, c = centre(m.from);
  const B = bladeAt(c, m.ahead, m.ahead, s), acc = { v: 0 }, D = 1.05;
  t.draw(D, (g, u, dt) => {
    const time = u * D;
    const grow = easeOut(clamp01(time / 0.22));
    const sheen = clamp01((time - 0.38) / 0.2) * (1 - 0.55 * clamp01((time - 0.7) / 0.2));
    const wrap = clamp01((time - 0.42) / 0.18) * (1 - 0.5 * clamp01((time - 0.7) / 0.2));
    const fade = 1 - clamp01((time - 0.85) / 0.2);
    beam(g, B, s, easeOut(clamp01((time - 0.08) / 0.18)), env(clamp01((time - 0.08) / 0.42), 0.15, 0.7));
    fan(g, B, s, easeOut(clamp01((time - 0.26) / 0.12)), clamp01((time - 0.4) / 0.18), clamp01((time - 0.26) / 0.03) * (1 - clamp01((time - 0.52) / 0.1)));
    drawBlade(g, B, grow, sheen, wrap, time, Math.min(1, time * 8) * fade);
    // The gleam: a star sliding up the edge, flaring at the point.
    const run = clamp01((time - 0.6) / 0.16);
    if (run > 0 && time < 0.95) {
      const q = bp(B, 0.08 + 0.9 * easeOut(run), 1), flare = time > 0.76 ? 1 + 1.4 * env(clamp01((time - 0.76) / 0.19), 0.2, 0.3) : 1;
      star(g, q, B.w * 1.6 * flare, Math.atan2(B.d.y, B.d.x) + time * 2, WHITE, 0.95 * (1 - clamp01((time - 0.85) / 0.1)));
    }
    if (time > 0.4 && time < 0.9) motes(t, B, s, dt, 28, acc);
  });
  t.charge(B.mid, s * 0.8, GLASS, 0.25, 0.4);
  t.later(0.3, () => t.flash(B.mid, WHITE, 0.2 * (s / 90)));
  t.later(0.77, () => t.flash(bp(B, 1, 0), WHITE, 0.22 * (s / 90)));
  t.later(0.78, () => t.glow(m.from, GLASS, 0.22, 0.4, 0.9));
}
