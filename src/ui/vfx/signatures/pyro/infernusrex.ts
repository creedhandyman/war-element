/** INFERNUS REX — Volcanic Charge. "Move up to 3 spaces forward and deal 12
 *  DMG to the first opponent hit." The king of the volcano charges up to three
 *  spaces and hits the first enemy for 12.
 *
 *  Its art is a tyrannosaur of black scaled rock split by molten seams,
 *  jaws open on a throat glowing white-gold, stamping through a river of
 *  lava. Not a fireball, then, and not flame: LAVA — black crust over a red
 *  that runs to white where it is hottest. The DELIVERY is the charge, and
 *  it is heavy: it rears (heat gathering deep red at its square), then comes
 *  on with its jaws already open — two black jaws lined with glowing fangs
 *  round a white-hot throat — and every stride STAMPS. Each footprint is a
 *  three-toed theropod print pressed into the ground white-hot, cooling to
 *  orange and then to dark crust with a red rim as the next one lands; each
 *  stamp kicks up a spray of lava drops and a ring of heat. Heat shimmer
 *  wavers off its back. Its jaws meet the card as the delivery ends; the
 *  token jumps to where the charge stopped as the step lands.
 *
 *  The LANDING is the bite. The same jaws, wide open across the card, SNAP
 *  shut on it — black rock rimmed in lava, the fangs interlocking white-hot
 *  — and the crunch throws out a shockwave and spatters lava round the card,
 *  gobbets that land on the ground about it glowing and crust over. A kill
 *  wells up molten through the card it bit.
 *
 *  It draws its own charge (no lunge). The crust, the prints and the
 *  spatter are dark for real, each lit along its edge so it reads over an
 *  empty square. */
import type { Graphics } from "pixi.js";
import { centre, rand } from "../../looks/base";
import { pyroFlick, pyroLick } from "../../looks/fire";
import type { FxTools, Pt, SparkStyle } from "../../looks/types";
import type { Signature, SigMoment } from "../types";

type Box = SigMoment["from"];

// Lava, as light (additive): white-hot to the deep red it cools through.
const HOT = 0xfff0c0, GOLD = 0xffc040, LAVA = 0xff5a14, DEEP = 0xd02208, BLOOD = 0x9a1004;
// Crust: the black rock it is made of, and the lava it cools into (normal blend).
const CRUST = 0x140604, CINDER = 0x2a0c06;
// The shimmer of heat off its back: a pale, hot haze.
const HAZE = 0xffb070;

/** Lava kicked up by a stamp or the crunch: heavy, falling, cooling dark red. */
const DROP: SparkStyle = { palette: [HOT, GOLD, LAVA, DEEP, BLOOD], gravity: 820, drag: 0.6, size: [5, 2], streak: false };
/** Embers off the bite: rising, small. */
const CINDERS: SparkStyle = { palette: [HOT, GOLD, LAVA, DEEP], gravity: -150, drag: 0.55, size: [4, 1.5], streak: false };

const TAU = Math.PI * 2;
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeOut = (x: number) => 1 - (1 - x) * (1 - x);

/** Its charge: from its square to where its jaws meet the card it bites
 *  (`hit`, that card's near face), along `u`; the body's middle stops `back`
 *  short of it. Worked out the same for the delivery and the landing. */
function runOf(m: SigMoment) {
  const s = m.size, c0 = centre(m.from);
  const prey = m.targets.length ? centre(m.targets[0]) : { x: centre(m.to).x + m.ahead.x * s, y: centre(m.to).y + m.ahead.y * s };
  const dx = prey.x - c0.x, dy = prey.y - c0.y, d = Math.hypot(dx, dy) || 1, u = { x: dx / d, y: dy / d };
  const hit = { x: prey.x - u.x * s * 0.5, y: prey.y - u.y * s * 0.5 };
  const end = { x: hit.x - u.x * s * 0.42, y: hit.y - u.y * s * 0.42 };
  return { c0, prey, u, hit, end, len: Math.max(0, (end.x - c0.x) * u.x + (end.y - c0.y) * u.y) };
}

// ── The jaws ─────────────────────────────────────────────────────────────────

/** One jaw, seen from above: a crescent of black rock `L` long lying along
 *  (ux, uy) through `c`, on `side` (±1) of that line. Its two ends sit `d`
 *  off the line and its inner edge bows `bow` further out between them, so
 *  two jaws shut (`d` = 0) make a lens-shaped mouth — and the fangs on each
 *  inner edge reach across it, staggered against the other jaw's, to
 *  interlock. Returns the band, its spine (a molten seam), its outer edge
 *  and the fangs, as point lists. */
function jaw(c: Pt, ux: number, uy: number, L: number, d: number, bow: number, thick: number, side: number) {
  const ox = -uy * side, oy = ux * side, N = 12;
  const inner: number[] = [], outer: number[] = [], spine: number[] = [], fangs: number[][] = [];
  const at = (f: number, off: number) => ({ x: c.x + ux * L * (f - 0.5) + ox * off, y: c.y + uy * L * (f - 0.5) + oy * off });
  const sw = (f: number) => Math.sin(Math.PI * f);
  for (let i = 0; i <= N; i++) {
    const f = i / N, o = d + bow * sw(f), w = thick * Math.pow(sw(f), 0.5);
    const pi = at(f, o), po = at(f, o + w), ps = at(f, o + w * 0.45);
    inner.push(pi.x, pi.y);
    outer.push(po.x, po.y);
    spine.push(ps.x, ps.y);
  }
  // Fangs: long, hooked a little toward the back of the mouth, the upper
  // jaw's set between the lower's.
  const fs = side > 0 ? [0.2, 0.4, 0.6, 0.8] : [0.3, 0.5, 0.7];
  for (const f of fs) {
    const o = d + bow * sw(f), len = bow * (0.75 + 0.5 * sw(f));
    const b0 = at(f - 0.045, d + bow * sw(f - 0.045)), b1 = at(f + 0.045, d + bow * sw(f + 0.045)), tip = at(f - 0.02, o - len);
    fangs.push([b0.x, b0.y, tip.x, tip.y, b1.x, b1.y]);
  }
  const back: number[] = [];
  for (let i = outer.length - 2; i >= 0; i -= 2) back.push(outer[i], outer[i + 1]);
  return { band: inner.concat(back), spine, outer, fangs };
}

/** Both jaws round the line through `c` along `ang`, their ends `d` off it:
 *  drawn dark (`lit` false) or as their lava light (`lit` true). `heat` 0..1
 *  is how white the fangs and seams run. */
function jaws(g: Graphics, c: Pt, ang: number, d: number, L: number, s: number, a: number, heat: number, lit: boolean) {
  if (a <= 0.02) return;
  const ux = Math.cos(ang), uy = Math.sin(ang), bow = L * 0.2, thick = L * 0.13;
  for (const side of [-1, 1]) {
    const j = jaw(c, ux, uy, L, d, bow, thick, side);
    if (!lit) {
      g.poly(j.band, true).fill({ color: CRUST, alpha: 0.95 * a });
      continue;
    }
    // The heat off it, the molten seam down the rock, its lit edges.
    g.poly(j.outer, false).stroke({ width: thick * 0.9, color: DEEP, alpha: 0.2 * a, cap: "round", join: "round" });
    g.poly(j.spine, false).stroke({ width: Math.max(1.2, s * 0.022), color: heat > 0.6 ? GOLD : LAVA, alpha: (0.5 + 0.4 * heat) * a, cap: "round", join: "round" });
    g.poly(j.band, true).stroke({ width: 1.5, color: LAVA, alpha: 0.95 * a, join: "round" });
    for (const f of j.fangs) {
      // White-hot as they bite, then dimming so the card shows through.
      g.poly(f, true).fill({ color: heat > 0.5 ? HOT : GOLD, alpha: (0.45 + 0.5 * heat) * a });
      g.poly(f, true).stroke({ width: 1, color: LAVA, alpha: 0.6 * a, join: "round" });
    }
  }
}

// ── The prints ───────────────────────────────────────────────────────────────

/** A three-toed theropod print at `c`, toes pointing along `ang`: a heel pad
 *  and three long toes splayed forward, each ending in a claw point. */
function footprint(c: Pt, ang: number, s: number): number[][] {
  const pts: number[][] = [], ux = Math.cos(ang), uy = Math.sin(ang), px = -uy, py = ux;
  const heel: number[] = [];
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * TAU, l = Math.cos(a) * s * 0.075, w = Math.sin(a) * s * 0.062;
    heel.push(c.x + ux * l + px * w, c.y + uy * l + py * w);
  }
  pts.push(heel);
  for (const k of [-1, 0, 1]) {
    const a = ang + k * 0.5, len = s * (k === 0 ? 0.21 : 0.17), bx = c.x + ux * s * 0.04, by = c.y + uy * s * 0.04;
    const tx = Math.cos(a), ty = Math.sin(a), hw = s * 0.036;
    pts.push([bx - ty * hw, by + tx * hw, bx + tx * len * 0.6 - ty * hw * 0.7, by + ty * len * 0.6 + tx * hw * 0.7,
      bx + tx * len, by + ty * len, bx + tx * len * 0.6 + ty * hw * 0.7, by + ty * len * 0.6 - tx * hw * 0.7, bx + ty * hw, by - tx * hw]);
  }
  return pts;
}

export const INFERNUS_REX: Signature = {
  shake: 1.7,
  // It draws its own charge: the token jumps to where the charge stopped as
  // the step lands.
  lunge: false,

  deliver(t: FxTools, m: SigMoment, seconds: number) {
    const s = m.size, S = seconds, run = runOf(m), { c0, u } = run, nx = -u.y, ny = u.x, sc = s / 90;
    const ang = Math.atan2(u.y, u.x), seed = rand(0, 100);
    const WIND = S * 0.22, RUN = S - WIND, EXP = 1.45;
    /** How far along its charge its body's middle is: rearing, then on,
     *  gathering speed into the bite. */
    const at = (time: number) => run.len * Math.pow(clamp01((time - WIND) / RUN), EXP);
    const P = (d: number, side = 0): Pt => ({ x: c0.x + u.x * d + nx * side, y: c0.y + u.y * d + ny * side });
    // IT REARS: heat gathering deep red at its square, the throat lighting.
    t.charge(c0, s * 1.3, DEEP, 0.4, WIND + RUN * 0.3);
    t.glow(m.from, LAVA, 0.18, WIND + 0.15, 1.0);

    // THE STAMPS: a stride every half square or so, left and right, each
    // print pressed in white-hot as the body comes over it.
    const stride = s * 0.42, n = Math.max(2, Math.floor((run.len + s * 0.2) / stride));
    const prints = Array.from({ length: n }, (_, i) => {
      const d = s * 0.1 + i * stride, side = (i % 2 ? 1 : -1) * s * 0.15;
      // When the body is over it: at(time) = d, solved.
      const q = Math.pow(clamp01(run.len > 0 ? d / run.len : 0), 1 / EXP), when = WIND + RUN * q * 0.96;
      return { d, side, when, shape: footprint(P(d, side), ang + rand(-0.12, 0.12), s) };
    });
    const FADE = 0.4, D = S + FADE;
    const gone = (time: number) => 1 - clamp01((time - S) / FADE);
    for (const p of prints) {
      t.later(p.when, () => {
        const c = P(p.d, p.side), out = Math.sign(p.side);
        t.ring({ x: c.x - s * 0.2, y: c.y - s * 0.2, w: s * 0.4, h: s * 0.4 }, LAVA, 0.2, 1.0, 0.28, 2);
        for (let i = 0; i < Math.round(6 * t.quality); i++) {
          const a = Math.atan2(ny * out, nx * out) + rand(-0.9, 0.9), v = rand(70, 150) * sc;
          t.spark(c.x, c.y, Math.cos(a) * v - u.x * 30 * sc, Math.sin(a) * v - 90 * sc, rand(0.3, 0.45), DROP);
        }
      });
    }
    // The prints themselves: crust once stamped (dark)...
    t.draw(D, (g, v) => {
      const time = v * D, a = gone(time);
      for (const p of prints) {
        if (time < p.when) continue;
        for (const poly of p.shape) g.poly(poly, true).fill({ color: CINDER, alpha: 0.9 * a });
      }
    }, { dark: true });
    // ...and the lava in them, white-hot as they land, cooling to a red rim.
    t.draw(D, (g, v) => {
      const time = v * D, a = gone(time);
      for (const p of prints) {
        if (time < p.when) continue;
        const heat = 1 - clamp01((time - p.when) / 0.45);
        for (const poly of p.shape) {
          if (heat > 0) g.poly(poly, true).fill({ color: heat > 0.55 ? HOT : LAVA, alpha: 0.85 * heat * a });
          g.poly(poly, true).stroke({ width: 1.2, color: heat > 0.3 ? GOLD : DEEP, alpha: (0.55 + 0.4 * heat) * a, join: "round" });
        }
      }
    });

    // THE BODY coming on: a mass of heat with the jaws open at its front —
    // black rock round a white-hot throat, the fangs glowing — heat shimmer
    // wavering off its back, and lava thrown off its feet as it runs.
    const jawAt = (time: number) => {
      const h = at(time), k = clamp01((time - WIND * 0.4) / (WIND * 0.8)), front = P(h + s * 0.32);
      return { h, k, front, open: s * (0.1 + 0.05 * Math.sin(time * 24)) };
    };
    t.draw(S, (g, v) => {
      const time = v * S, j = jawAt(time);
      if (j.k > 0.02) jaws(g, j.front, ang, j.open, s * 0.7, s, j.k, 0, false);
    }, { dark: true });
    let spray = 0;
    t.draw(S, (g, v, dt) => {
      const time = v * S, j = jawAt(time), pace = clamp01((time - WIND) / RUN);
      const body = P(j.h);
      if (j.k > 0.02) {
        // The molten mass of it, and the throat between the jaws.
        // The lava it wades through, a molten wake behind it.
        if (j.h > s * 0.1) {
          const w0 = P(Math.max(0, j.h - s * 1.4));
          g.moveTo(w0.x, w0.y).lineTo(body.x, body.y).stroke({ width: s * 0.42, color: DEEP, alpha: 0.12 * j.k, cap: "round" });
          g.moveTo(w0.x, w0.y).lineTo(body.x, body.y).stroke({ width: s * 0.16, color: LAVA, alpha: 0.12 * j.k, cap: "round" });
        }
        g.circle(body.x, body.y, s * 0.46).fill({ color: DEEP, alpha: 0.16 * j.k });
        g.circle(body.x, body.y, s * 0.26).fill({ color: LAVA, alpha: 0.12 * j.k });
        const th = j.front;
        g.ellipse(th.x, th.y, s * 0.2, s * 0.2).fill({ color: LAVA, alpha: 0.4 * j.k });
        g.circle(th.x, th.y, s * 0.11).fill({ color: GOLD, alpha: 0.65 * j.k });
        g.circle(th.x, th.y, s * 0.055).fill({ color: HOT, alpha: 0.95 * j.k });
        jaws(g, j.front, ang, j.open, s * 0.7, s, j.k, 0.6 + 0.4 * pace, true);
        // Heat shimmer off its back: wavering lines rising up the screen.
        for (let i = 0; i < 4; i++) {
          const base = P(j.h - s * 0.25, (i - 1.5) * s * 0.14), pts: number[] = [];
          for (let q = 0; q <= 6; q++) pts.push(base.x + Math.sin(time * 22 + q * 1.3 + i * 2) * s * 0.025, base.y - q * s * 0.06);
          g.poly(pts, false).stroke({ width: 1.5, color: HAZE, alpha: 0.22 * j.k, join: "round" });
        }
        // Flames licking up off its molten back.
        for (let i = 0; i < 3; i++) {
          const b = P(j.h - s * 0.12, (i - 1) * s * 0.18);
          pyroLick(g, b.x, b.y, s * (0.16 + 0.06 * pyroFlick(time, seed + i)), s * 0.1, time, seed + i * 3, 0.55 * j.k);
        }
      }
      if (pace > 0 && pace < 1) {
        spray += dt * 32 * t.quality;
        for (; spray >= 1; spray--) {
          const sd = Math.random() < 0.5 ? -1 : 1, p = P(j.h - s * 0.15, sd * s * 0.2), vv = rand(60, 140) * sc;
          t.spark(p.x, p.y, (nx * sd * 0.7 - u.x * 0.5) * vv, (ny * sd * 0.7 - u.y * 0.5) * vv - 80 * sc, rand(0.3, 0.45), DROP);
        }
      }
    });
  },

  land(t: FxTools, m: SigMoment) {
    const s = m.size, run = runOf(m), { u } = run, sc = s / 90, ang = Math.atan2(u.y, u.x);
    if (!m.targets.length) return;
    const r = m.targets[0], p = centre(r), k = Math.max(0.8, Math.min(1.8, m.power[0] ?? 1));
    // THE BITE: the jaws, wide open either side of the card, snap shut on it
    // in a blink — the fangs interlocking across it — hold, clamped, and let
    // go.
    const L = s * 1.3 * Math.min(1.15, 0.9 + 0.12 * k);
    const SNAP = 0.09, D = 0.62;
    const openAt = (time: number) => s * (0.5 * (1 - Math.pow(clamp01(time / SNAP), 2)) + (time > 0.36 ? 0.2 * easeOut(clamp01((time - 0.36) / 0.25)) : 0));
    const fade = (time: number) => (time < 0.36 ? 1 : 1 - clamp01((time - 0.36) / (D - 0.36)));
    t.draw(D, (g, v) => {
      const time = v * D;
      jaws(g, p, ang, openAt(time), L, s, fade(time), 0, false);
    }, { dark: true });
    t.draw(D, (g, v) => {
      const time = v * D, heat = time < SNAP ? 0.5 : 1 - clamp01((time - SNAP) / 0.3);
      jaws(g, p, ang, openAt(time), L, s, fade(time), heat, true);
    });
    // THE CRUNCH as they meet: a white-hot flash, a shockwave of heat, lava
    // spattered out round the card.
    t.later(SNAP, () => {
      t.flash(p, HOT, 0.16 * k * (s / 80));
      t.glow(r, LAVA, 0.32, 0.45, 1.05);
      t.ring(r, LAVA, 0.35, 1.45 + 0.15 * k, 0.4, 4);
      t.ring(r, GOLD, 0.3, 1.1, 0.28, 2);
      for (let i = 0; i < Math.round(16 * k); i++) {
        const a = rand(0, TAU), vv = rand(120, 260) * sc;
        t.spark(p.x + rand(-6, 6), p.y + rand(-6, 6), Math.cos(a) * vv, Math.sin(a) * vv - 110 * sc, rand(0.35, 0.55), DROP);
      }
      for (let i = 0; i < Math.round(8 * k); i++)
        t.spark(p.x + rand(-0.3, 0.3) * s, p.y + rand(-0.2, 0.3) * s, rand(-20, 20) * sc, -rand(40, 90) * sc, rand(0.4, 0.7), CINDERS);
      spatter(t, p, s, k);
    });
    if (m.killed[0]) t.later(0.2, () => welling(t, r, s));
  },
};

/** Gobbets of lava flung off the crunch, landing on the ground round the
 *  card: each flies out, splats, glows, and crusts over dark with a red rim. */
function spatter(t: FxTools, p: Pt, s: number, k: number) {
  const n = Math.max(5, Math.round(8 * Math.min(1.3, k) * (0.6 + 0.4 * t.quality))), D = 0.85, FLY = 0.12;
  const blobs = Array.from({ length: n }, (_, i) => {
    const a = (i / n) * TAU + rand(-0.3, 0.3), d = s * rand(0.5, 0.8);
    return { x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d * 0.9, r: s * rand(0.035, 0.06),
      pts: Array.from({ length: 8 }, () => rand(0.7, 1.1)), rot: rand(0, TAU), at: rand(0, 0.06) };
  });
  type Blob = (typeof blobs)[number];
  const shape = (b: Blob, grow: number) => {
    const out: number[] = [];
    for (let i = 0; i < 8; i++) {
      const a = b.rot + (i / 8) * TAU, rr = b.r * b.pts[i] * grow;
      out.push(b.x + Math.cos(a) * rr, b.y + Math.sin(a) * rr);
    }
    return out;
  };
  const landed = (b: Blob, time: number) => clamp01((time - b.at - FLY) / 0.06);
  const fade = (time: number) => 1 - clamp01((time - 0.55) / (D - 0.55));
  t.draw(D, (g, v) => {
    const time = v * D;
    for (const b of blobs) {
      const q = landed(b, time);
      if (q > 0) g.poly(shape(b, 0.6 + 0.4 * q), true).fill({ color: CRUST, alpha: 0.9 * fade(time) });
    }
  }, { dark: true });
  t.draw(D, (g, v) => {
    const time = v * D, a = fade(time);
    for (const b of blobs) {
      const fly = clamp01((time - b.at) / FLY);
      if (fly < 1) {
        if (time <= b.at) continue;
        // In flight off the bite: a hot gobbet, lobbed.
        const x = p.x + (b.x - p.x) * easeOut(fly), y = p.y + (b.y - p.y) * easeOut(fly) - Math.sin(Math.PI * fly) * s * 0.18;
        g.circle(x, y, b.r * 0.6).fill({ color: GOLD, alpha: 0.9 });
        continue;
      }
      const q = landed(b, time);
      if (q <= 0) continue;
      const heat = 1 - clamp01((time - b.at - FLY) / 0.4), pts = shape(b, 0.6 + 0.4 * q);
      if (heat > 0) g.poly(pts, true).fill({ color: heat > 0.5 ? GOLD : LAVA, alpha: 0.8 * heat * a });
      g.poly(pts, true).stroke({ width: 1.2, color: heat > 0.3 ? LAVA : DEEP, alpha: 0.85 * a, join: "round" });
    }
  });
}

/** A card it killed going under: lava welling up through it from below, a
 *  molten pool spreading and fire standing up off it. */
function welling(t: FxTools, r: Box, s: number) {
  const c = centre(r), seed = rand(0, 100), D = 0.7;
  t.glow(r, DEEP, 0.4, 0.6, 1.1);
  t.draw(D, (g, v) => {
    const time = v * D, k = easeOut(clamp01(v / 0.35)), a = 1 - clamp01((v - 0.5) / 0.5);
    g.ellipse(c.x, c.y + s * 0.18, s * 0.42 * k, s * 0.16 * k).fill({ color: LAVA, alpha: 0.35 * a });
    g.ellipse(c.x, c.y + s * 0.18, s * 0.26 * k, s * 0.09 * k).fill({ color: GOLD, alpha: 0.5 * a });
    for (let i = 0; i < 4; i++)
      pyroLick(g, c.x + (i - 1.5) * s * 0.17, c.y + s * 0.2, s * (0.35 + 0.12 * Math.sin(seed + i * 2.1)) * k, s * 0.16, time, seed + i * 3, 0.85 * a);
  });
}
