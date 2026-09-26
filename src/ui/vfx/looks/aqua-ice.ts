/** AQUA, FROZEN — the look of an AQUA card that is ice rather than water.
 *
 *  A card that took the Frozen Flow, or one built around freezing (its attack
 *  or Special freezes, it freezes whoever strikes it) or plainly named for the
 *  cold, was throwing the same dripping water bolts and breaking-wave cuts as
 *  a Siren. Polar King threw splashes. So these cards get ice: an icicle, not
 *  a droplet; a crack, not a wave; frost forming, not water drawn up. Who is
 *  icy is decided game-side (spell-fx.ts `lookVariant`); this is only how ice
 *  looks. Everything a SPELL draws stays AQUA's — spells are not characters. */
import type { Graphics } from "pixi.js";
import { AQUA } from "./aqua";
import { centre, rand } from "./base";
import type { ElementLook, FxTools, Pt, SparkStyle } from "./types";

const TAU = Math.PI * 2;
const WHITE = 0xffffff, FROST = 0xe6f8ff, ICE = 0x9fe3ff, GLACIER = 0x4d94e8;
/** The X and the crack: paler than water's blue, so ice reads as ice. */
const MARK = 0xd8f6ff;

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeOut = (x: number) => 1 - (1 - x) * (1 - x);

/** A twinkle of frost that hangs in the air — ice glitters, water drips. */
const GLINT: SparkStyle = { palette: [WHITE, FROST, ICE], gravity: 40, drag: 0.4, size: [5, 2], streak: false };
/** A splinter of ice, falling. */
const SHARD: SparkStyle = { palette: [WHITE, FROST, ICE, GLACIER], gravity: 520, drag: 0.6, size: [9, 3], streak: true };
/** Cold breath. */
const MIST: SparkStyle = { palette: [WHITE, 0xdff3ff, 0x9fcfe8], gravity: -30, drag: 0.4, size: [8, 15], streak: false };

/** An icicle: a long thin diamond pointing along `a`, glassy fill, a bright
 *  edge and a white spine. */
function iceShard(g: Graphics, x: number, y: number, a: number, len: number, w: number, alpha: number) {
  const ux = Math.cos(a), uy = Math.sin(a), nx = -uy, ny = ux;
  const tip = { x: x + ux * len * 0.62, y: y + uy * len * 0.62 }, tail = { x: x - ux * len * 0.38, y: y - uy * len * 0.38 };
  const pts = [tip.x, tip.y, x + nx * w, y + ny * w, tail.x, tail.y, x - nx * w, y - ny * w];
  g.poly(pts, true).fill({ color: ICE, alpha: 0.35 * alpha }).poly(pts, true).stroke({ width: 1.6, color: FROST, alpha });
  g.moveTo(tail.x, tail.y).lineTo(tip.x, tip.y).stroke({ width: 1.2, color: WHITE, alpha: 0.9 * alpha });
}

/** A snowflake: six arms, each with a pair of side branches. */
function snowflake(g: Graphics, c: Pt, r: number, rot: number, alpha: number, width = 2) {
  for (let i = 0; i < 6; i++) {
    const a = rot + (i / 6) * TAU, ux = Math.cos(a), uy = Math.sin(a);
    g.moveTo(c.x, c.y).lineTo(c.x + ux * r, c.y + uy * r).stroke({ width, color: FROST, alpha });
    const bx = c.x + ux * r * 0.55, by = c.y + uy * r * 0.55, b = r * 0.28;
    for (const s of [-1, 1]) {
      const ba = a + s * (Math.PI / 3);
      g.moveTo(bx, by).lineTo(bx + Math.cos(ba) * b, by + Math.sin(ba) * b).stroke({ width: width * 0.8, color: FROST, alpha });
    }
  }
}

/** A jagged, straight-sided crack: ice breaks in facets, not curves. */
function crackLine(c: Pt, a: number, reach: number, kinks: number): number[] {
  const ux = Math.cos(a), uy = Math.sin(a), nx = -uy, ny = ux, pts: number[] = [];
  for (let i = 0; i <= kinks; i++) {
    const d = -reach + (2 * reach * i) / kinks, j = i === 0 || i === kinks ? 0 : rand(-1, 1) * reach * 0.16;
    pts.push(c.x + ux * d + nx * j, c.y + uy * d + ny * j);
  }
  return pts;
}

/** Frost crystals forming round a point, turning in as they grow. */
function frostRing(t: FxTools, c: Pt, radius: number, n: number, seconds: number, size: number) {
  const a0 = rand(0, TAU);
  t.draw(seconds, (g, u) => {
    const grow = easeOut(clamp01(u / 0.7)), a = u < 0.8 ? 1 : 1 - (u - 0.8) / 0.2;
    for (let i = 0; i < n; i++) {
      const ang = a0 + (i / n) * TAU + u * 0.8, rr = radius * (1 - 0.25 * u);
      const p = { x: c.x + Math.cos(ang) * rr, y: c.y + Math.sin(ang) * rr };
      snowflake(g, p, size * grow, ang, 0.85 * a, 1.2);
    }
  });
}

export const AQUA_ICE: ElementLook = {
  ...AQUA,
  markColor: MARK,

  windUp(t, d) {
    const dur = d.wind + (d.T - d.wind) * 0.3;
    if (d.melee && !d.special) {
      // The lunge is the wind-up: a breath of frost at its feet, no more.
      t.ring({ x: d.at.x - d.size / 2, y: d.at.y - d.size / 2, w: d.size, h: d.size }, FROST, 0.95, 0.7, 0.3, 2);
      return;
    }
    // Frost crystals form round the card and the cold gathers in...
    frostRing(t, d.at, d.size * 0.5, d.special ? 6 : 4, dur, d.size * (d.special ? 0.09 : 0.07));
    t.emit({ count: d.special ? 16 : 8, palette: GLINT.palette, from: d.rect, at: "ring", speed: [70, 130], gravity: 0, drag: 1,
      life: [0.2, d.wind], size: [5, 2] });
    t.charge(d.at, d.size * (d.special ? 1.3 : 1.0), ICE, d.special ? 0.4 : 0.25, dur);
    if (d.special) {
      // ...and a Special draws its snowflake sigil under itself.
      t.draw(dur, (g, u) => snowflake(g, d.at, d.size * 0.42 * easeOut(clamp01(u / 0.6)), u * 1.2, 0.55 * Math.min(1, u * 3), 2));
    }
    if (!d.melee) {
      // A ranged card grows its icicle, point up — the throw takes over from it.
      const len = d.size * (d.special ? 0.46 : 0.34);
      t.draw(d.wind, (g, u) => iceShard(g, d.at.x, d.at.y, -Math.PI / 2, len * easeOut(u), len * 0.16 * easeOut(u), Math.min(1, u * 3)));
    }
  },

  gather(t, d) {
    // The empty square frosts over: a snowflake grows across it, turning, and
    // the cold is drawn in to its heart. The card steps out of it (`arrive`).
    const s = d.size;
    t.draw(d.T, (g, u) => snowflake(g, d.at, s * (d.special ? 0.44 : 0.36) * easeOut(u), u * 1.5, 0.8 * Math.min(1, u * 3), 2));
    t.emit({ count: d.special ? 22 : 14, palette: GLINT.palette, from: d.rect, at: "ring", speed: [80, 140], gravity: 0, drag: 1,
      life: [0.25, d.T * 0.9], size: [5, 2] });
    t.emit({ count: 6, palette: MIST.palette, from: d.rect, at: "edge", speed: [30, 60], gravity: 0, drag: 0.8, life: [0.3, d.T],
      size: [8, 15] });
    t.charge(d.at, s * 1.3, ICE, d.special ? 0.45 : 0.3, d.T);
  },

  projectile(t, s) {
    // An ICICLE, point first, glittering frost off its flank. A Special looses
    // a volley — its big spear flanked by two splinters on bowed paths, all
    // three arriving on the landing frame.
    const dx = s.to.x - s.from.x, dy = s.to.y - s.from.y, dist = Math.hypot(dx, dy) || 1;
    const a = Math.atan2(dy, dx), nx = -dy / dist, ny = dx / dist;
    const shards = s.special
      ? [{ len: s.size * 0.5, bow: 0 }, { len: s.size * 0.28, bow: dist * 0.18 }, { len: s.size * 0.28, bow: -dist * 0.18 }]
      : [{ len: s.size * 0.36, bow: 0 }];
    let acc = 0;
    t.draw(s.seconds, (g, u, dt) => {
      const e = u * u * 0.5 + u * 0.5; // quickening, and exactly 1 at u = 1
      for (const sh of shards) {
        const off = sh.bow * 4 * u * (1 - u);
        const x = s.from.x + dx * e + nx * off, y = s.from.y + dy * e + ny * off;
        const heading = a + (sh.bow ? Math.atan2(sh.bow * 4 * (1 - 2 * u), dist) : 0);
        iceShard(g, x, y, heading, sh.len, sh.len * 0.15, Math.min(1, u * 6));
      }
      acc += (s.special ? 90 : 45) * dt;
      while (acc >= 1) {
        acc -= 1;
        const x = s.from.x + dx * e, y = s.from.y + dy * e;
        t.spark(x + rand(-4, 4), y + rand(-4, 4), rand(-25, 25), rand(-25, 25), rand(0.25, 0.5), GLINT);
      }
    }, { delay: s.delay });
  },

  swing(t, s) {
    // A cold streak along the swing, shedding glitter; a Special's is a spray
    // of frost behind it.
    t.shot({
      from: s.from, to: s.to, seconds: s.seconds, delay: s.delay, ease: "in",
      head: FROST, headSize: s.size * (s.special ? 0.16 : 0.08),
      trail: { palette: GLINT.palette, rate: s.special ? 110 : 24, size: s.special ? [7, 2] : [5, 2], life: [0.2, 0.4], drift: 10 },
    });
  },

  mark(t, m) {
    // The blow CRACKS it: a faceted fault races across the card, splinters
    // branch off it, shards burst out and fall, and a rime of frost is left on
    // the card for a moment. Straight-edged and still — BOLT's cut flickers.
    const main = crackLine(m.c, m.across, m.reach, 5);
    const branches = [0.35, 0.65].map((f) => {
      const i = Math.round(f * 5) * 2;
      return { x: main[i], y: main[i + 1], a: m.across + (f < 0.5 ? 1 : -1) * rand(0.7, 1.1), len: m.reach * rand(0.35, 0.5) };
    });
    t.draw(0.5, (g, u) => {
      const drawn = clamp01(u / 0.14), a = u < 0.55 ? 1 : 1 - (u - 0.55) / 0.45;
      const n = Math.max(2, Math.round(6 * drawn));
      g.poly(main.slice(0, n * 2), false).stroke({ width: 7, color: ICE, alpha: 0.28 * a });
      g.poly(main.slice(0, n * 2), false).stroke({ width: 2.4, color: WHITE, alpha: 0.95 * a });
      if (drawn >= 1)
        for (const b of branches) {
          const q = clamp01((u - 0.14) / 0.1);
          g.moveTo(b.x, b.y).lineTo(b.x + Math.cos(b.a) * b.len * q, b.y + Math.sin(b.a) * b.len * q)
            .stroke({ width: 1.6, color: FROST, alpha: 0.9 * a });
        }
      // The rime: a pale hexagon of frost over the card, fading.
      const rr = m.reach * 0.9, ra = 0.14 * (u < 0.2 ? u / 0.2 : 1 - (u - 0.2) / 0.8);
      const hex: number[] = [];
      for (let i = 0; i < 6; i++) hex.push(m.c.x + Math.cos((i / 6) * TAU) * rr, m.c.y + Math.sin((i / 6) * TAU) * rr);
      g.poly(hex, true).fill({ color: FROST, alpha: ra });
    });
    const n = Math.round(12 * m.k);
    for (let i = 0; i < n; i++) {
      const side = i % 2 ? 1 : -1, ang = m.across + side * Math.PI / 2 + rand(-0.6, 0.6), v = rand(90, 220), f = rand(-0.8, 0.8);
      t.spark(m.c.x + Math.cos(m.across) * m.reach * f, m.c.y + Math.sin(m.across) * m.reach * f,
        Math.cos(ang) * v, Math.sin(ang) * v - 50, rand(0.35, 0.6), SHARD);
    }
    t.glow(m.rect, ICE, 0.32, 0.35, 1.05);
  },

  xSparks(t, c, count) {
    // Glints of frost off the X, hanging a moment rather than flying.
    for (let i = 0; i < count; i++) {
      const a = rand(0, TAU), v = rand(40, 110);
      t.spark(c.x + rand(-3, 3), c.y + rand(-3, 3), Math.cos(a) * v, Math.sin(a) * v, rand(0.2, 0.34), GLINT);
    }
  },

  arrive(t, r) {
    // It steps out of the ice: the snowflake it gathered in bursts, and six
    // crystals fly off it and melt into the air.
    const c = centre(r), s = Math.min(r.w, r.h);
    t.draw(0.45, (g, u) => {
      const a = 1 - u;
      snowflake(g, c, s * (0.36 + 0.3 * easeOut(u)), 1.5 + u * 0.6, 0.9 * a, 2.2);
      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * TAU + Math.PI / 6, d = s * (0.2 + 0.45 * easeOut(u));
        iceShard(g, c.x + Math.cos(ang) * d, c.y + Math.sin(ang) * d, ang, s * 0.2, s * 0.035, a);
      }
    });
    t.ring(r, FROST, 0.3, 1.25, 0.45, 3);
    t.glow(r, ICE, 0.5, 0.4, 1.2);
    t.emit({ count: 8, palette: MIST.palette, from: r, speed: [20, 60], gravity: -30, drag: 0.4, life: [0.5, 0.8], size: [8, 15] });
  },

  impactAccent(t, at, k) {
    // Where an icicle lands: a flash of frost in a snowflake, splinters falling.
    const r = 16 + 10 * k;
    t.draw(0.3, (g, u) => snowflake(g, at, r * (0.6 + 0.4 * u), 0.3, 0.85 * (1 - u), 1.8));
    for (let i = 0; i < 6; i++) {
      const a = rand(0, TAU), v = rand(60, 160);
      t.spark(at.x, at.y, Math.cos(a) * v, Math.sin(a) * v - 60, rand(0.3, 0.5), SHARD);
    }
  },
};
