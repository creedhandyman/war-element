/** VOLCANON — Eruption. "Deal 3 DMG × 5 hits to one opponent at range (shreds
 *  shields). Costs 2 HP; +1 DMG per use (Bad Temper); on kill, recast free next
 *  round." A flying volcano: each Eruption costs it 2 HP and lands five hits on
 *  one target.
 *
 *  On its art Volcanon is a winged demon of black rock split by lava, and
 *  round it a rain of meteors — black rocks in shells of fire — comes down out
 *  of the sky. The DELIVERY is the volcano going off: lava seams crack open
 *  across its card from the heart outward, then it ERUPTS — a fountain of lava
 *  thrown straight up, and five glowing rocks hurled high out of it, spinning
 *  away up off the board, while molten drops run off the bottom of its own
 *  card (the 2 HP it pays). The first rock is already falling as the delivery
 *  ends, so it lands on the landing frame.
 *
 *  The LANDING is the rain: five meteors come down on the target one after
 *  another out of the sky, each a black rock with a fire tail behind it,
 *  slanting in from Volcanon's side. Each one craters: a white-orange flash, a
 *  scorched pit ringed in lava, a splash of molten drops and chips of rock
 *  flung off — five separate beats, scattered over the card, the last the
 *  biggest. A kill blows a last plume of lava up out of the wreck.
 *
 *  Volcanon's fire is ROCK AND LAVA — the heaviest in PYRO: dark bodies with
 *  lit rims (drawn dark on purpose, always rimmed), deep lava red, drops that
 *  fall rather than embers that rise. */
import type { Graphics } from "pixi.js";
import { centre, rand } from "../../looks/base";
import { pyroFlame } from "../../looks/fire";
import type { FxTools, Pt, SparkStyle } from "../../looks/types";
import type { Signature, SigMoment } from "../types";

type Box = SigMoment["from"];

const TAU = Math.PI * 2;
// Rock, solid (normal blend): black basalt, and the char a crater leaves.
const ROCK = 0x1c100b, CHAR = 0x140806;
// Lava, light (additive): deep red, orange, yellow-hot, white at the heart.
const DEEP = 0xc22a0c, LAVA = 0xff5214, HOT = 0xffa424, WHITE = 0xfff0b8;
/** Molten drops: heavy, falling, cooling from yellow-hot to deep red. */
const SPLASH: SparkStyle = { palette: [WHITE, HOT, LAVA, DEEP], gravity: 950, drag: 0.6, size: [6, 2.5], streak: false };
/** The fountain: lava thrown straight up out of the volcano, falling back. */
const FOUNT: SparkStyle = { palette: [WHITE, HOT, LAVA, DEEP], gravity: 700, drag: 0.7, size: [6, 2], streak: true };
/** Drops of its own lava running off its card: the 2 HP it pays. */
const BLEED: SparkStyle = { palette: [HOT, LAVA, DEEP], gravity: 420, drag: 0.7, size: [5, 2.5], streak: false };

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeOut = (x: number) => 1 - (1 - x) * (1 - x);

// ── The rocks ────────────────────────────────────────────────────────────────

/** A lump of basalt: eight points round `p`, `r` across, each a little in or
 *  out by its own `shape`, turned `rot`. */
function lump(p: Pt, r: number, rot: number, shape: number[]): number[] {
  const pts: number[] = [];
  for (let k = 0; k < shape.length; k++) {
    const a = rot + (k / shape.length) * TAU;
    pts.push(p.x + Math.cos(a) * r * shape[k], p.y + Math.sin(a) * r * shape[k]);
  }
  return pts;
}
const shapeOf = () => Array.from({ length: 8 }, () => rand(0.72, 1));

/** A rock's light half: lava glowing round it, a hot rim, and a crack of lava
 *  across its face. */
function rockLight(g: Graphics, p: Pt, r: number, rot: number, shape: number[], a: number) {
  g.circle(p.x, p.y, r * 1.7).fill({ color: LAVA, alpha: 0.18 * a });
  g.poly(lump(p, r, rot, shape), true).stroke({ width: Math.max(1.2, r * 0.18), color: HOT, alpha: 0.9 * a, join: "round" });
  const c0 = rot + 0.4, c1 = rot + 2.6;
  g.moveTo(p.x + Math.cos(c0) * r * 0.7, p.y + Math.sin(c0) * r * 0.7).lineTo(p.x + Math.cos(rot + 1.5) * r * 0.15, p.y + Math.sin(rot + 1.5) * r * 0.15)
    .lineTo(p.x + Math.cos(c1) * r * 0.65, p.y + Math.sin(c1) * r * 0.65).stroke({ width: Math.max(1, r * 0.14), color: WHITE, alpha: 0.75 * a });
}

/** Where meteor `i` strikes on the card: scattered over its face so five
 *  hits read as five, the last dead centre. */
function strikeAt(r: Box, i: number): Pt {
  const p = centre(r), s = Math.min(r.w, r.h);
  const spots = [[-0.2, -0.14], [0.2, 0.12], [-0.12, 0.2], [0.17, -0.18], [0, 0]];
  const [dx, dy] = spots[i];
  return { x: p.x + dx * s, y: p.y + dy * s };
}

/** The meteors' timing: when each strikes, s from the landing frame — quick
 *  succession, a breath before the last. And how long each takes to fall. */
const HIT = [0, 0.1, 0.2, 0.3, 0.43], FALL = 0.2;
/** A meteor's size: they grow, and the last is the biggest by far. */
const meteorR = (s: number, i: number, power: number) => s * (i === 4 ? 0.2 : 0.12 + 0.012 * i) * Math.max(0.85, Math.min(1.3, power));

/** Where meteor `i` falls from: high above its mark, slanting in from
 *  Volcanon's side of the board, as on the art. */
function skyFor(m: SigMoment, to: Pt, i: number): Pt {
  const c = centre(m.from), s = m.size;
  const side = Math.abs(to.x - c.x) < s * 0.3 ? (i % 2 ? 1 : -1) : Math.sign(c.x - to.x);
  return { x: to.x + side * s * (0.8 + 0.12 * i), y: to.y - s * (2.3 + 0.1 * (i % 2)) };
}

/** One meteor falling from `from` to `to` in FALL seconds, `delay` in,
 *  accelerating: a tumbling black rock with a fire tail streaming back up its
 *  path, and `onArrive` as it strikes. */
function meteor(t: FxTools, from: Pt, to: Pt, r: number, delay: number, onArrive: () => void) {
  const shape = shapeOf(), rot0 = rand(0, TAU), spin = rand(-9, 9), seed = rand(0, 100);
  const dx = to.x - from.x, dy = to.y - from.y, d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d;
  const where = (u: number) => {
    const e = u * u * 0.7 + u * 0.3;
    return { x: from.x + dx * e, y: from.y + dy * e };
  };
  t.draw(FALL, (g, u) => {
    const p = where(u);
    g.poly(lump(p, r, rot0 + spin * u * FALL, shape), true).fill({ color: ROCK, alpha: 1 });
  }, { dark: true, delay });
  t.draw(FALL, (g, u) => {
    const p = where(u), time = u * FALL, a = clamp01(u * 6);
    // The tail: one long flame streaming back up the path, longer as it speeds.
    const len = r * (3 + 4 * u), lean = r * 0.5 * Math.sin(time * 30 + seed);
    pyroFlame(g, p.x - ux * r * 1.1, p.y - uy * r * 1.1, -ux, -uy, len, r * 1.9, lean, 0.9 * a);
    rockLight(g, p, r, rot0 + spin * time, shape, a);
  }, { delay });
  t.later(delay + FALL, onArrive);
}

/** A meteor cratering at `p`: a flash, a molten burst and a crown of lava
 *  splashed out round it, a scorched pit left ringed in lava that cools,
 *  molten drops thrown up and away, and chips of rock flung. */
function crater(t: FxTools, p: Pt, s: number, k: number, from: Pt) {
  const R = s * 0.2 * k, D = 0.6, seed = rand(0, TAU), N = 9;
  const spurts = Array.from({ length: N }, (_, j) => ({ a: seed + (j / N) * TAU + rand(-0.25, 0.25), l: rand(0.7, 1.25) }));
  t.flash(p, HOT, 0.3 * k * (s / 90));
  t.draw(D, (g, u) => {
    const grow = easeOut(clamp01(u / 0.12)), fade = 1 - clamp01((u - 0.3) / 0.7);
    g.ellipse(p.x, p.y + R * 0.1, R * 0.8 * grow, R * 0.6 * grow).fill({ color: CHAR, alpha: 0.55 * fade });
  }, { dark: true });
  t.draw(D, (g, u) => {
    const time = u * D, grow = easeOut(clamp01(u / 0.12)), fade = 1 - clamp01((u - 0.2) / 0.8), cool = 1 - clamp01(u / 0.45);
    // THE CROWN: lava splashed out round the pit in thick tapering spurts,
    // flung fast and falling back.
    const out = easeOut(clamp01(time / 0.16)), sag = clamp01((time - 0.12) / 0.3);
    if (sag < 1)
      for (const sp of spurts) {
        const ux = Math.cos(sp.a), uy = Math.sin(sp.a), bx = p.x + ux * R * 0.45, by = p.y + uy * R * 0.4;
        const len = R * 1.25 * sp.l * out * (1 - 0.6 * sag), w = R * 0.42 * (1 - 0.5 * sag);
        pyroFlame(g, bx, by, ux, uy * 0.85 - 0.25, len, w, 0, 0.9 * (1 - sag));
      }
    g.circle(p.x, p.y, R * (0.5 + 0.4 * grow) * (1 - 0.4 * u)).fill({ color: HOT, alpha: 0.55 * cool });
    g.circle(p.x, p.y, R * 0.35 * (1 - 0.5 * u)).fill({ color: WHITE, alpha: 0.85 * cool });
    // The pit, ringed in lava that cools from yellow to red.
    g.ellipse(p.x, p.y + R * 0.1, R * 0.8 * grow, R * 0.6 * grow).stroke({ width: Math.max(1.5, R * 0.14), color: cool > 0.3 ? HOT : LAVA, alpha: 0.85 * fade });
  });
  // The splash: thrown up and away from where it came in.
  const away = Math.atan2(p.y - from.y, p.x - from.x), n = Math.round(10 * k);
  for (let j = 0; j < n; j++) {
    const a = j % 3 === 0 ? -Math.PI / 2 + rand(-0.8, 0.8) : away + rand(-1.2, 1.2), v = rand(120, 260) * (s / 90) * Math.min(1.3, k);
    t.spark(p.x, p.y, Math.cos(a) * v, Math.sin(a) * v - rand(50, 130) * (s / 90), rand(0.3, 0.5), SPLASH);
  }
  chips(t, p, Math.round(4 * k), s);
}

/** Chips of black rock flung off a strike, rimmed in lava, falling back. */
function chips(t: FxTools, at: Pt, n: number, s: number) {
  const bits = Array.from({ length: Math.max(1, Math.round(n * t.quality)) }, () => {
    const a = -Math.PI / 2 + rand(-1.4, 1.4), v = rand(120, 240) * (s / 90);
    return { vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: s * rand(0.022, 0.04), rot: rand(0, TAU), vr: rand(-10, 10), shape: shapeOf(), life: rand(0.35, 0.5) };
  });
  const D = 0.5, pos = (b: (typeof bits)[number], time: number) => ({ x: at.x + b.vx * time, y: at.y + b.vy * time + 650 * (s / 90) * time * time });
  t.draw(D, (g, u) => {
    const time = u * D;
    for (const b of bits) if (time < b.life) g.poly(lump(pos(b, time), b.r, b.rot + b.vr * time, b.shape), true).fill({ color: ROCK, alpha: 1 - (time / b.life) ** 3 });
  }, { dark: true });
  t.draw(D, (g, u) => {
    const time = u * D;
    for (const b of bits) if (time < b.life)
      g.poly(lump(pos(b, time), b.r, b.rot + b.vr * time, b.shape), true).stroke({ width: Math.max(1, b.r * 0.35), color: HOT, alpha: 0.85 * (1 - (time / b.life) ** 3) });
  });
}

// ── The volcano ──────────────────────────────────────────────────────────────

/** Seams cracking open across Volcanon's card: jagged lines from its heart
 *  outward, each a run of kinks. Fixed once per delivery. */
function seams(c: Pt, s: number) {
  const a0 = rand(0, TAU);
  return Array.from({ length: 6 }, (_, i) => {
    const pts: Pt[] = [{ ...c }];
    let a = a0 + (i / 6) * TAU + rand(-0.3, 0.3), x = c.x, y = c.y;
    for (let k = 0; k < 5; k++) {
      a += rand(-0.6, 0.6);
      const step = s * rand(0.07, 0.1);
      x += Math.cos(a) * step;
      y += Math.sin(a) * step;
      pts.push({ x, y });
    }
    return pts;
  });
}

/** A seam opened `f` (0..1) of its length: the part from the heart out. */
function seamPart(pts: Pt[], f: number): number[] {
  const n = pts.length - 1, e = f * n, out: number[] = [pts[0].x, pts[0].y];
  for (let k = 1; k <= n; k++) {
    if (k <= e) out.push(pts[k].x, pts[k].y);
    else {
      const r = e - (k - 1);
      if (r > 0) out.push(pts[k - 1].x + (pts[k].x - pts[k - 1].x) * r, pts[k - 1].y + (pts[k].y - pts[k - 1].y) * r);
      break;
    }
  }
  return out;
}

export const VOLCANON: Signature = {
  shake: 1.3,
  lunge: false,

  deliver(t: FxTools, m: SigMoment, seconds: number) {
    const T = seconds, s = m.size, c = centre(m.from);
    if (!m.targets.length) return;
    const ERUPT = T * 0.42;
    // THE SEAMS: lava splitting its card open from the heart, glowing hotter
    // until it blows.
    const cracks = seams(c, s);
    t.draw(T + 0.2, (g, u) => {
      const time = u * (T + 0.2), open = easeOut(clamp01(time / ERUPT)), fade = 1 - clamp01((time - T) / 0.2);
      const heat = clamp01(time / ERUPT);
      for (const sm of cracks) {
        const pts = seamPart(sm, open);
        if (pts.length < 4) continue;
        g.poly(pts, false).stroke({ width: Math.max(3, s * 0.07), color: DEEP, alpha: 0.4 * fade, join: "round", cap: "round" });
        g.poly(pts, false).stroke({ width: Math.max(1.5, s * 0.025), color: heat > 0.7 ? WHITE : HOT, alpha: 0.9 * fade, join: "round", cap: "round" });
      }
      g.circle(c.x, c.y, s * (0.08 + 0.06 * heat)).fill({ color: HOT, alpha: 0.6 * fade }).circle(c.x, c.y, s * 0.05 * (1 + heat)).fill({ color: WHITE, alpha: 0.8 * fade });
    });
    t.charge(c, s * 1.1, LAVA, 0.4, ERUPT);
    t.later(ERUPT, () => {
      t.flash({ x: c.x, y: c.y - s * 0.2 }, HOT, 0.3 * (s / 90));
      t.glow(m.from, LAVA, 0.45, T - ERUPT + 0.2, 1.2);
    });

    // THE FOUNTAIN: lava thrown straight up out of it while it erupts...
    let jet = 0;
    t.draw(T - ERUPT, (g, u, dt) => {
      const q = 1 - u * 0.6;
      jet += dt * 70 * t.quality * q;
      for (; jet >= 1; jet--) {
        const a = -Math.PI / 2 + rand(-0.32, 0.32), v = rand(260, 460) * (s / 90);
        t.spark(c.x + rand(-0.12, 0.12) * s, c.y - s * 0.15, Math.cos(a) * v, Math.sin(a) * v, rand(0.35, 0.55), FOUNT);
      }
      // ...a column of fire standing up off the card under it.
      const h = s * (1.15 + 0.25 * Math.sin(u * 30)) * (1 - 0.35 * u);
      pyroFlame(g, c.x, c.y + s * 0.05, 0, -1, h, s * 0.6, s * 0.08 * Math.sin(u * 22), 0.85 * (1 - u * 0.5));
    }, { delay: ERUPT });

    // THE FIVE ROCKS: hurled high out of the fountain, spinning up off the
    // board — the same five that will come down.
    for (let i = 0; i < 5; i++) {
      const go = ERUPT + i * T * 0.06, D = T + 0.15 - go;
      const shape = shapeOf(), rot0 = rand(0, TAU), spin = rand(-12, 12), r = meteorR(s, i, 1) * 0.8;
      const vx = rand(-0.6, 0.6) * s, rise = s * rand(4.6, 5.4);
      const where = (time: number) => {
        const q = time / D;
        return { x: c.x + vx * q, y: c.y - s * 0.2 - rise * (1 - (1 - q) * (1 - q) * (1 - q)) * 0.8 };
      };
      t.draw(D, (g, u) => {
        const p = where(u * D);
        g.poly(lump(p, r, rot0 + spin * u * D, shape), true).fill({ color: ROCK, alpha: 1 - clamp01((u - 0.8) / 0.2) });
      }, { dark: true, delay: go });
      t.draw(D, (g, u) => {
        const time = u * D, p = where(time), a = 1 - clamp01((u - 0.8) / 0.2);
        pyroFlame(g, p.x, p.y + r * 1.0, 0, 1, r * 3.2, r * 1.7, r * 0.4 * Math.sin(time * 28 + i), 0.75 * a);
        rockLight(g, p, r, rot0 + spin * time, shape, a);
      }, { delay: go });
    }

    // ITS OWN LAVA running off its card: the 2 HP it pays.
    const drops = Math.round(7 * t.quality);
    for (let j = 0; j < drops; j++)
      t.later(ERUPT + rand(0, 0.9) * (T - ERUPT), () =>
        t.spark(m.from.x + m.from.w * rand(0.2, 0.8), m.from.y + m.from.h * rand(0.75, 0.95), rand(-15, 15), rand(10, 50), rand(0.35, 0.55), BLEED));

    // THE FIRST METEORS, already falling: whichever must leave the sky before
    // the landing frame to strike on time (the landing craters them).
    for (let i = 0; i < 5 && HIT[i] < FALL; i++) {
      const to = strikeAt(m.targets[0], i);
      meteor(t, skyFor(m, to, i), to, meteorR(s, i, m.power[0] ?? 1), T + HIT[i] - FALL, () => {});
    }
  },

  land(t: FxTools, m: SigMoment) {
    const s = m.size;
    if (!m.targets.length) return;
    const r = m.targets[0], power = m.power[0] ?? 1, killed = !!m.killed[0];
    const k = (i: number) => (i === 4 ? 1.45 : 0.85 + 0.06 * i) * Math.max(0.85, Math.min(1.3, power));
    for (let i = 0; i < 5; i++) {
      const to = strikeAt(r, i), from = skyFor(m, to, i);
      const strike = () => {
        crater(t, to, s, k(i), from);
        if (i !== 4) return;
        // The last, the biggest: a shock ring and the card lit red.
        t.ring(r, HOT, 0.3, 1.5, 0.4, 5);
        t.glow(r, LAVA, 0.5, 0.5, 1.3);
      };
      // The first ones fell in the delivery and strike on their beat; the
      // rest come down out of the sky after them.
      if (HIT[i] < FALL) {
        if (HIT[i] <= 0) strike();
        else t.later(HIT[i], strike);
      } else meteor(t, from, to, meteorR(s, i, power), HIT[i] - FALL, strike);
    }
    // A kill: a last plume of lava blown up out of the wreck.
    if (killed) t.later(HIT[4] + 0.12, () => plume(t, r, s));
  },
};

/** What it killed goes up in a last plume: a column of fire and lava thrown
 *  up off the card, falling back. */
function plume(t: FxTools, r: Box, s: number) {
  const p = centre(r), D = 0.45, seed = rand(0, 100);
  t.flash(p, WHITE, 0.3 * (s / 90));
  t.draw(D, (g, u) => {
    const grow = easeOut(clamp01(u / 0.25)), fade = 1 - clamp01((u - 0.3) / 0.7);
    pyroFlame(g, p.x, p.y + s * 0.2, 0, -1, s * 1.1 * grow, s * 0.55, s * 0.1 * Math.sin(u * 20 + seed), 0.9 * fade);
  });
  const n = Math.round(16 * t.quality);
  for (let j = 0; j < n; j++) {
    const a = -Math.PI / 2 + rand(-0.5, 0.5), v = rand(200, 380) * (s / 90);
    t.spark(p.x + rand(-0.15, 0.15) * s, p.y, Math.cos(a) * v, Math.sin(a) * v, rand(0.4, 0.6), FOUNT);
  }
}
