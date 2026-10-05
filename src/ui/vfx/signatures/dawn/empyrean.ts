/** EMPYREAN — Golden Courage. "Heal every ally 5 HP, CLEANSE them, and give the
 *  team +1 DMG for 2 rounds." She "descends from above already sounding Golden
 *  Courage."
 *
 *  Her art is an angel coming down out of a blazing sun: great wings of golden
 *  light whose edges break into a RAINBOW, the way light through a prism does,
 *  and three small suns standing over her head. The Special aims at nothing,
 *  so there is no delivery: the LANDING is the whole move, and it comes from
 *  ABOVE, down — it is the only DAWN move that does.
 *
 *  Her sun warms behind her card and her wings unfold out of it: seven
 *  feathers of light a side, flung from folded to spread, a rainbow fringe
 *  running round each wing's outer edge. The three suns ignite over her head
 *  one by one. Then a shaft of light comes DOWN onto every ally, the nearest
 *  first: a narrow beam dropping out of the sky with a star at its point,
 *  widening into a pillar on the card as it lands, its two edges split into
 *  the spectrum (red one side, violet the other — her wings' prism). A halo
 *  rides the shaft down and settles round the card's head (the courage);
 *  where the light touches the ground it splashes flat; and what ailed the
 *  card lifts off it as dark flecks that the light burns out (the cleanse).
 *  With no ally to come down on, the shaft comes down on her.
 *
 *  Everything is light but the flecks: those are dark for real, each rimmed
 *  in the gold that burns it away, so they read over any card. */
import { centre, rand } from "../../looks/base";
import type { Graphics } from "pixi.js";
import type { FxTools, Pt, SparkStyle } from "../../looks/types";
import type { Signature, SigMoment } from "../types";

type Box = SigMoment["from"];

const TAU = Math.PI * 2;
const WHITE = 0xffffff, PALE = 0xfff6d6, GOLD = 0xffd54f, DEEP = 0xe0a41c, WARM = 0xffe38a;
/** Her wings' edge, red through violet: kept light, so it adds as colour. */
const PRISM = [0xff6b6b, 0xffa94d, 0xffec6e, 0x7cf29a, 0x5fd3ff, 0x8f8cff, 0xd08bff];
/** What the cleanse lifts off a card (dark layer only), and its sickly rim
 *  before the gold takes it. */
const BLIGHT = 0x0d0712, SICK = 0xa47ae0;
/** Glitter: a mote walks it as it ages, flicking white to deep gold. */
const GLINT = [WHITE, DEEP, WHITE, GOLD, PALE, DEEP, WHITE, DEEP];
/** Light splashing flat off the ground where a shaft lands. */
const NEEDLE: SparkStyle = { palette: [WHITE, PALE, GOLD], gravity: 0, drag: 0.03, size: [5, 1.5], streak: true };
/** Glitter hanging over a blessed card, lifting slowly. */
const MOTE: SparkStyle = { palette: GLINT, gravity: -35, drag: 0.5, size: [5, 1.5], streak: false };
/** Light shed off her wing tips as they spread: a little of every colour. */
const PLUME: SparkStyle = { palette: [WHITE, PRISM[2], PRISM[4], PRISM[6], PRISM[0]], gravity: 25, drag: 0.55, size: [4, 1], streak: false };
/** A fleck of blight burning out: the pinch of light it leaves. */
const EMBER: SparkStyle = { palette: [WHITE, GOLD, DEEP], gravity: -50, drag: 0.5, size: [5, 1], streak: false };

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeOut = (x: number) => 1 - (1 - x) * (1 - x);
/** Overshoots a little and settles: a wing flung open. */
const snap = (x: number) => 1 + 2.7 * Math.pow(x - 1, 3) + 1.7 * Math.pow(x - 1, 2);

/** The wings: spread by, and fading out over. */
const SPREAD = 0.2, WING_D = 1.05, WING_FADE = 0.68;
/** The three suns over her head, one by one. */
const SUNS = [0.05, 0.11, 0.17];
/** The first shaft leaves the sky, the next a beat behind it; each drops for
 *  DROP, stands for HOLD, and fades over OUT. */
const DESCEND = 0.2, STEP = 0.07, DROP = 0.15, HOLD = 0.24, OUT = 0.24;

// ── Light's shapes ───────────────────────────────────────────────────────────

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

/** A small sun: a hot disc in a gold corona, a four-point glint across it. */
function sun(g: Graphics, x: number, y: number, r: number, alpha: number) {
  if (alpha <= 0.01 || r < 0.5) return;
  g.circle(x, y, r * 1.9).fill({ color: GOLD, alpha: 0.18 * alpha });
  g.circle(x, y, r).fill({ color: WARM, alpha: 0.75 * alpha }).stroke({ width: 1.2, color: WHITE, alpha: 0.9 * alpha });
  star(g, x, y, r * 2.6, r * 2.6, r * 0.2, 0, WHITE, 0.85 * alpha);
  g.circle(x, y, r * 0.45).fill({ color: WHITE, alpha });
}

// ── Her wings ────────────────────────────────────────────────────────────────

/** One feather of light: from its root out along `ang`, `len` long and `w`
 *  across at its widest, swept a little back along its trailing edge. */
function feather(root: Pt, ang: number, len: number, w: number) {
  const ux = Math.cos(ang), uy = Math.sin(ang), nx = -uy, ny = ux;
  const mid = { x: root.x + ux * len * 0.5, y: root.y + uy * len * 0.5 }, tip = { x: root.x + ux * len, y: root.y + uy * len };
  return { tip, pts: [root.x, root.y, mid.x + nx * w, mid.y + ny * w, tip.x, tip.y, mid.x - nx * w * 0.45, mid.y - ny * w * 0.45] };
}

/** THE WINGS unfolding out of her card, a heraldic angel's: each wing's arm
 *  sweeps up and out from her shoulder to its wrist, bowing as it goes, and
 *  seven feathers of light hang off it — the inner ones pointing down, the
 *  outer primaries swinging out and up, longest at the wrist. Folded, the arm
 *  stands close and the feathers hang straight down behind her; spread, the
 *  wing spans the squares beside her. A rainbow fringe runs along the
 *  trailing edge through every feather's tip — and as they open, light is
 *  shed off the tips in every colour. */
function wings(t: FxTools, r: Box, s: number) {
  const root = { x: r.x + r.w / 2, y: r.y + r.h * 0.38 }, N = 7;
  /** Where the arm is at `f` (0 shoulder, 1 wrist), for this much spread. */
  const arm = (side: number, f: number, e: number): Pt => {
    const sx = root.x + side * s * 0.07, wx = side * s * (0.12 + 0.46 * e), wy = -s * (0.42 + 0.2 * e);
    const bow = Math.sin(Math.PI * f) * s * 0.12 * e;
    return { x: sx + wx * f, y: root.y + wy * f - bow };
  };
  const pose = (side: number, j: number, e: number) => {
    const f = 0.3 + (0.7 * j) / (N - 1), at = arm(side, f, e);
    // Down (folded behind her) for all of them, then fanned: inner ones
    // still down, the outer primaries swung out past level.
    const spread = Math.PI / 2 - (0.35 + (2.3 * j) / (N - 1)) * e;
    const ang = side > 0 ? spread : Math.PI - spread;
    const len = s * (0.34 + (0.46 * j) / (N - 1)) * (0.6 + 0.4 * Math.min(1.1, e));
    return feather(at, ang, len, s * 0.075);
  };
  t.draw(WING_D, (g, u) => {
    const time = u * WING_D, e = Math.max(0, snap(clamp01(time / SPREAD)));
    const a = clamp01(time / 0.04) * (1 - clamp01((time - WING_FADE) / (WING_D - WING_FADE)));
    if (a <= 0.02) return;
    for (const side of [-1, 1]) {
      const tips: Pt[] = [];
      for (let j = 0; j < N; j++) {
        const f = pose(side, j, e);
        tips.push(f.tip);
        g.poly(f.pts, true).fill({ color: GOLD, alpha: 0.34 * a }).stroke({ width: 1.2, color: PALE, alpha: 0.7 * a, join: "round" });
        g.moveTo(f.pts[0], f.pts[1]).lineTo(f.tip.x, f.tip.y).stroke({ width: 1, color: WHITE, alpha: 0.5 * a });
      }
      // The arm: the wing's leading edge, white-hot.
      for (let k = 0; k <= 10; k++) {
        const p = arm(side, k / 10, e);
        if (k === 0) g.moveTo(p.x, p.y);
        else g.lineTo(p.x, p.y);
      }
      g.stroke({ width: Math.max(3, s * 0.05), color: GOLD, alpha: 0.35 * a, join: "round", cap: "round" });
      for (let k = 0; k <= 10; k++) {
        const p = arm(side, k / 10, e);
        if (k === 0) g.moveTo(p.x, p.y);
        else g.lineTo(p.x, p.y);
      }
      g.stroke({ width: Math.max(1.5, s * 0.02), color: WHITE, alpha: 0.9 * a, join: "round", cap: "round" });
      // The prism: the trailing edge split into its colours, red innermost,
      // violet outermost — out from her, through every tip.
      PRISM.forEach((color, k) => {
        const out = 1.0 + (k - 1) * 0.03;
        for (let j = 0; j < N; j++) {
          const p = tips[j], x = root.x + (p.x - root.x) * out, y = root.y + (p.y - root.y) * out;
          if (j === 0) g.moveTo(x, y);
          else g.lineTo(x, y);
        }
        g.stroke({ width: Math.max(1.5, s * 0.022), color, alpha: 0.7 * a, join: "round", cap: "round" });
      });
    }
  });
  // Light shed off the tips as they open: falling slowly, every colour.
  t.later(SPREAD * 0.8, () => {
    const n = Math.round(6 * t.quality);
    for (const side of [-1, 1])
      for (let i = 0; i < n; i++) {
        const f = pose(side, Math.floor(rand(2, N)), 1), v = rand(15, 45) * (s / 90);
        t.spark(f.tip.x, f.tip.y, side * v, rand(-10, 25) * (s / 90), rand(0.4, 0.65), PLUME);
      }
  });
}

/** HER SUN and the THREE SUNS over her head: the sun she came out of warming
 *  behind her card, then three small suns igniting in an arc over it, one by
 *  one, each with a flash. */
function suns(t: FxTools, r: Box, s: number) {
  const c = centre(r);
  t.glow(r, WARM, 0.36, 0.9, 1.6);
  const at = [-1, 0, 1].map((k) => ({ x: c.x + k * s * 0.2, y: r.y + r.h * 0.05 - (k === 0 ? s * 0.06 : 0) }));
  const D = 0.95;
  t.draw(D, (g, u) => {
    const time = u * D, fade = 1 - clamp01((time - 0.7) / (D - 0.7));
    at.forEach((p, i) => {
      const q = (time - SUNS[i]) / 0.12;
      if (q <= 0) return;
      // Struck big, settling to a steady small sun.
      const k = q < 1 ? 1 + 0.9 * Math.sin(Math.PI * q) : 1;
      sun(g, p.x, p.y, s * 0.04 * k, fade);
    });
  });
  at.forEach((p, i) => t.later(SUNS[i], () => t.flash(p, WARM, 0.18 * (s / 80))));
}

// ── The descent ──────────────────────────────────────────────────────────────

/** A SHAFT coming down onto a card: a beam dropping out of the sky with a star
 *  at its point, widening into a pillar on the card as it lands — brightest at
 *  its foot, its edges split into the spectrum — with a halo riding it down
 *  that settles round the card's head. */
function shaft(t: FxTools, r: Box, s: number, when: number) {
  const c = centre(r), top = r.y - s * 1.3, foot = r.y + r.h * 0.94, W = r.w * 0.72;
  const D = DROP + HOLD + OUT;
  const head = { x: c.x, y: r.y + r.h * 0.2 };
  t.draw(D, (g, u) => {
    const time = u * D, drop = clamp01(time / DROP), y = top + (foot - top) * drop * drop;
    const a = clamp01(time / 0.03) * (1 - clamp01((time - DROP - HOLD) / OUT));
    if (a <= 0.02) return;
    // Narrow while it falls, opening into a pillar the moment it lands.
    const w = W * (0.3 + 0.7 * easeOut(clamp01((time - DROP) / 0.1)));
    const h = y - top, wt = w * 0.55;
    const slab = (f: number, ww: number, color: number, al: number) => {
      const y0 = top + h * f, k = wt / w + (1 - wt / w) * f;
      g.poly([c.x - (ww * k) / 2, y0, c.x + (ww * k) / 2, y0, c.x + ww / 2, y, c.x - ww / 2, y]).fill({ color, alpha: al });
    };
    // Eight thin layers, each lower one adding to those above: the light
    // thickens toward the card and has no top edge to speak of.
    for (let i = 0; i < 8; i++) slab(i / 8, w, WARM, 0.07 * a);
    slab(0.35, w * 0.2, WHITE, 0.2 * a);
    slab(0.65, w * 0.2, WHITE, 0.35 * a);
    // The spectrum down its two edges: red to the left, violet to the right,
    // strongest low on the shaft where the light is.
    PRISM.forEach((color, k) => {
      const side = k < 3 ? -1 : k > 3 ? 1 : 0;
      if (!side) return;
      const off = (side < 0 ? 3 - k : k - 3) * Math.max(1.4, s * 0.018);
      const x0 = c.x + side * (wt / 2 + off), x1 = c.x + side * (w / 2 + off), ym = top + h * 0.55;
      g.moveTo(x0, top).lineTo(x0 + (x1 - x0) * 0.55, ym).stroke({ width: 1.4, color, alpha: 0.25 * a })
        .moveTo(x0 + (x1 - x0) * 0.55, ym).lineTo(x1, y).stroke({ width: 1.8, color, alpha: 0.85 * a });
    });
    // The point, while it falls: a star of light leading it down.
    if (drop < 1) {
      star(g, c.x, y, s * 0.2, s * 0.13, s * 0.025, -Math.PI / 2, GOLD, 0.5 * a);
      star(g, c.x, y, s * 0.15, s * 0.09, s * 0.012, -Math.PI / 2, WHITE, a);
    }
    // THE HALO riding just above the point, then settling round the card's
    // head and drawing in tight.
    const settle = easeOut(clamp01((time - DROP) / 0.18));
    const hy = drop < 1 ? y - s * 0.14 : head.y;
    const rx = s * (0.5 - 0.14 * settle), ry = rx * 0.27;
    g.ellipse(c.x, hy, rx, ry).stroke({ width: 5, color: GOLD, alpha: 0.22 * a })
      .ellipse(c.x, hy, rx, ry).stroke({ width: 1.8, color: WARM, alpha: 0.95 * a });
    for (let i = 0; i < 9; i++) {
      // A crown of short rays standing up off its back rim.
      const th = Math.PI + (i / 8) * Math.PI, ca = Math.cos(th), sa = Math.sin(th), l = s * (i % 2 ? 0.05 : 0.09) * (0.5 + 0.5 * settle);
      g.moveTo(c.x + ca * rx, hy + sa * ry).lineTo(c.x + ca * rx, hy + sa * ry - l);
    }
    g.stroke({ width: 1.6, color: PALE, alpha: 0.8 * a });
    // The splash at its foot: light pooling flat and running out.
    if (time > DROP) {
      const q = clamp01((time - DROP) / 0.3);
      g.ellipse(c.x, foot, W * (0.4 + 0.5 * easeOut(q)), s * (0.06 + 0.05 * easeOut(q))).stroke({ width: 2, color: WARM, alpha: 0.85 * (1 - q) * a });
    }
  }, { delay: when });
  t.later(when + DROP, () => {
    t.flash({ x: c.x, y: foot - s * 0.1 }, WHITE, 0.28 * (s / 80));
    t.glow(r, WARM, 0.34, 0.55, 1.05);
    // Splashed flat along the ground.
    const n = Math.max(4, Math.round(8 * t.quality));
    for (let i = 0; i < n; i++) {
      const side = i % 2 ? 1 : -1, v = rand(110, 200) * (s / 90);
      t.spark(c.x + side * W * 0.3, foot - s * 0.04, side * v, rand(-8, 4) * (s / 90), rand(0.18, 0.3), NEEDLE);
    }
    const m = Math.round(6 * t.quality);
    for (let i = 0; i < m; i++)
      t.spark(r.x + rand(0.15, 0.85) * r.w, r.y + rand(0.3, 0.85) * r.h, rand(-8, 8) * (s / 90), -rand(15, 40) * (s / 90), rand(0.45, 0.7), MOTE);
    cleanse(t, r, s);
  });
}

/** THE CLEANSE: the ailment lifting off a card as dark flecks — soot-dark and
 *  ragged, a sickly violet at the rim until the light takes them — rising,
 *  shrinking, and going out as a pinch of light. */
function cleanse(t: FxTools, r: Box, s: number) {
  const c = centre(r), n = Math.max(3, Math.round(5 * t.quality)), D = 0.6;
  const flecks = Array.from({ length: n }, (_, i) => ({
    x: c.x + ((i + 0.5) / n - 0.5) * r.w * 0.66 + rand(-0.04, 0.04) * r.w, y: c.y + rand(-0.05, 0.3) * r.h,
    vx: rand(-20, 20) * (s / 90), vy: -rand(70, 105) * (s / 90),
    at: rand(0.02, 0.14), life: rand(0.32, 0.42), rad: s * rand(0.05, 0.07), rot: rand(0, TAU), shape: Array.from({ length: 5 }, () => rand(0.6, 1)),
  }));
  type Fleck = (typeof flecks)[number];
  const where = (f: Fleck, q: number) => {
    const time = q * f.life;
    return { x: f.x + f.vx * time + Math.sin(time * 14 + f.rot) * s * 0.02, y: f.y + f.vy * time, rad: f.rad * (1 - 0.6 * q) };
  };
  const shape = (f: Fleck, p: { x: number; y: number; rad: number }, q: number) => {
    const pts: number[] = [];
    for (let i = 0; i < 5; i++) {
      const a = f.rot + q * 5 + (i / 5) * TAU;
      pts.push(p.x + Math.cos(a) * p.rad * f.shape[i], p.y + Math.sin(a) * p.rad * f.shape[i]);
    }
    return pts;
  };
  t.draw(D, (g, u) => {
    const time = u * D;
    for (const f of flecks) {
      const q = (time - f.at) / f.life;
      if (q <= 0 || q >= 1) continue;
      g.poly(shape(f, where(f, q), q), true).fill({ color: BLIGHT, alpha: 0.85 * (1 - q * q) * Math.min(1, q * 8) });
    }
  }, { dark: true });
  t.draw(D, (g, u) => {
    const time = u * D;
    for (const f of flecks) {
      const q = (time - f.at) / f.life;
      if (q <= 0 || q >= 1) continue;
      const p = where(f, q);
      g.poly(shape(f, p, q), true).stroke({ width: 1.4, color: q < 0.35 ? SICK : q < 0.65 ? DEEP : GOLD, alpha: (0.6 + 0.4 * q) * Math.min(1, q * 8) });
      if (q > 0.6) g.circle(p.x, p.y, p.rad * 0.6).fill({ color: WHITE, alpha: (q - 0.6) * 2 });
    }
  });
  for (const f of flecks)
    t.later(f.at + f.life, () => {
      const p = where(f, 1);
      t.spark(p.x, p.y, rand(-15, 15) * (s / 90), -rand(15, 40) * (s / 90), rand(0.2, 0.35), EMBER);
    });
}

export const EMPYREAN: Signature = {
  // A blessing from above, not a blow: the board stays still.
  shake: 0,
  lunge: false,

  land(t: FxTools, m: SigMoment) {
    const c = centre(m.from), s = m.size;
    suns(t, m.from, s);
    wings(t, m.from, s);
    // The light comes down on the nearest first; with nobody else on her
    // side, it comes down on her.
    const blessed = (m.allies.length ? m.allies : [m.from])
      .map((r) => ({ r, d: Math.hypot(centre(r).x - c.x, centre(r).y - c.y) }))
      .sort((a, b) => a.d - b.d);
    blessed.forEach((b, i) => shaft(t, b.r, s, DESCEND + i * STEP));
  },
};
