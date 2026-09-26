/** THE END OF THE ROUND, DRAWN STATUS BY STATUS.
 *
 *  Burn, poison, bleed and scald all bite in the one step that runs Cleanup,
 *  alongside every heal-over-time, every element aura that pays out then and
 *  every status that runs out. The board lights the cards that step will hurt
 *  and the numbers land — but until now nothing said WHY a card lost 3 HP, and
 *  a frozen card thawed without a crack. Each of those gets its own look here.
 *
 *  WHAT happened is read off the state change in spell-fx.ts (`roundEndEffects`);
 *  this is only how each one is drawn, from the same primitives the element
 *  looks use. A status looks like what it IS, not who inflicted it: a burn is
 *  fire from any element's spell. They fire every round, several at once, so
 *  each is small and quick — the card and its number must still read through. */
import type { Graphics } from "pixi.js";
import type { StatusKind } from "../../engine";
import type { Rect } from "./impact-layer";
import { centre, rand } from "./looks/base";
import type { FxTools, Pt, SparkStyle } from "./looks/types";

/** What the end of the round did to one card. */
export type RoundTick =
  /** A damage-over-time status biting: BURN, SCALD, BLEED, DOT. */
  | "bite"
  /** A status running out. */
  | "expire"
  /** A status burned off early — DAWN's Awakening, a full cleanse. */
  | "cleanse"
  /** A heal-over-time: REGEN, the Well, a field's regen. */
  | "regen"
  /** Shields regrowing at the round's end (a field, an aura, a Cost-10
   *  engine) — drawn by the card's own element look, as a spell's would be. */
  | "shield"
  /** LEAF's Photosynthesis healing it. */
  | "photosynthesis"
  /** LEAF's bark regrowing shields where it was struck. */
  | "bark"
  /** AQUA's tide coming in: the Flow it chose deepening. */
  | "tide"
  /** GALE's Zephyr: +SP. */
  | "zephyr"
  /** DAWN's First Light: +SP. */
  | "firstLight";

export interface TickArgs {
  tick: RoundTick;
  /** The status for bite / expire / cleanse. */
  status?: StatusKind;
  /** ~0.7-2.2, from the amount (a DOT's power, a heal's size). */
  strength: number;
  /** BURN that melted shields as it bit. */
  melted?: boolean;
  /** The Flow an AQUA card chose, for its tide. */
  mode?: "water" | "ice" | "steam";
}

const TAU = Math.PI * 2;
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
/** Up fast, hold, down: the shape of almost everything here. */
const envelope = (t: number, rise = 0.2, fall = 0.55) => (t < rise ? t / rise : t > fall ? 1 - (t - fall) / (1 - fall) : 1);

// ── Spark styles, built once (the layer caches its copy per object) ─────────

const EMBER: SparkStyle = { palette: [0xfff4d6, 0xffc14a, 0xff6a2a, 0xc2261a], gravity: -170, drag: 0.5, size: [6, 2], streak: false };
const MOLTEN: SparkStyle = { palette: [0xfff0c0, 0xffa040, 0xff5020], gravity: 520, drag: 0.7, size: [7, 4], streak: false };
const STEAM: SparkStyle = { palette: [0xffffff, 0xeaf6ff, 0xb8dcf0, 0x7fa8c8], gravity: -70, drag: 0.55, size: [9, 18], streak: false, swirl: 50 };
const BLOOD: SparkStyle = { palette: [0xffe0e0, 0xff5a66, 0xe02038], gravity: 620, drag: 0.8, size: [9, 6], streak: false };
const SPLASH: SparkStyle = { palette: [0xffb0b0, 0xff4a58], gravity: 600, drag: 0.5, size: [4, 2], streak: true };
const TOXIC: SparkStyle = { palette: [0xeaffc0, 0xb8f060, 0x6fbf2a], gravity: -30, drag: 0.6, size: [5, 2], streak: false, swirl: 40 };
const MEND: SparkStyle = { palette: [0xffffff, 0xd8ffe0, 0x7dff9a, 0x3fbf5a], gravity: -120, drag: 0.5, size: [7, 2], streak: false };
const SHARD: SparkStyle = { palette: [0xffffff, 0xe6f8ff, 0x9fe3ff, 0x4d94e8], gravity: 520, drag: 0.6, size: [9, 3], streak: true };
const MIST: SparkStyle = { palette: [0xffffff, 0xdff3ff, 0x9fcfe8], gravity: -40, drag: 0.4, size: [8, 16], streak: false };
const SMOKE: SparkStyle = { palette: [0xe0dcd8, 0xa8a4a0, 0x6a6662], gravity: -80, drag: 0.5, size: [8, 17], streak: false, swirl: 60 };
const FLECK: SparkStyle = { palette: [0xe8dca0, 0xb8a060, 0x7a6a3a], gravity: 260, drag: 0.6, size: [6, 3], streak: false, swirl: 90 };
const GOLD: SparkStyle = { palette: [0xffffff, 0xfff1b3, 0xffd54f, 0xe0a41c], gravity: -160, drag: 0.4, size: [7, 2], streak: false };
const LEAFY: SparkStyle = { palette: [0xf4ffe6, 0xb6f27a, 0x4caf6d], gravity: -90, drag: 0.5, size: [6, 2], streak: false, swirl: 80 };
const DROP: SparkStyle = { palette: [0xffffff, 0xbfeaff, 0x4d94e8], gravity: 700, drag: 0.6, size: [6, 3], streak: false };
const GUST: SparkStyle = { palette: [0xfffaf0, 0xffd9a0, 0xffa040], gravity: -60, drag: 0.4, size: [8, 2], streak: true, swirl: 700 };
const WISP: SparkStyle = { palette: [0xf0e0ff, 0xb080e0, 0x6a3a9a], gravity: 0, drag: 0.5, size: [8, 3], streak: false };
const LIFT: SparkStyle = { palette: [0xf6eee6, 0xc8b8a8, 0x8a7a6a], gravity: -260, drag: 0.5, size: [6, 2], streak: true };

/** Spark colours of the statuses that fizzle out as crackle. */
const ZAP: Record<string, number[]> = {
  STUN: [0xffffff, 0xfff3b0, 0xffd54f],
  PARALYZE: [0xffffff, 0xfff3b0, 0xffd54f],
  ELECTRIFIED: [0xffffff, 0xe3d8ff, 0x9575ff],
};

// ── Shapes ─────────────────────────────────────────────────────────────────

/** A flame tongue standing on (x, base), `h` tall, its tip swaying. */
function flame(g: Graphics, x: number, base: number, w: number, h: number, sway: number, color: number, alpha: number) {
  g.moveTo(x - w, base)
    .quadraticCurveTo(x - w * 0.9, base - h * 0.55, x + sway, base - h)
    .quadraticCurveTo(x + w * 0.9, base - h * 0.55, x + w, base)
    .closePath()
    .fill({ color, alpha });
}

/** A leaf `len` long at `p`, pointing along `a`. */
function leafShape(g: Graphics, p: Pt, a: number, len: number, color: number, alpha: number) {
  const ux = Math.cos(a), uy = Math.sin(a), nx = -uy, ny = ux, w = len * 0.38;
  const tip = { x: p.x + ux * len, y: p.y + uy * len }, mid = { x: p.x + ux * len * 0.5, y: p.y + uy * len * 0.5 };
  g.moveTo(p.x, p.y)
    .quadraticCurveTo(mid.x + nx * w, mid.y + ny * w, tip.x, tip.y)
    .quadraticCurveTo(mid.x - nx * w, mid.y - ny * w, p.x, p.y)
    .fill({ color, alpha });
}

/** A jagged line from `a` toward angle `ang`, `len` long, in `steps` kinks. */
function crackPts(a: Pt, ang: number, len: number, steps: number, jag: number): number[] {
  const pts = [a.x, a.y];
  for (let k = 1; k <= steps; k++) {
    const d = (len * k) / steps, j = rand(-jag, jag);
    pts.push(a.x + Math.cos(ang) * d - Math.sin(ang) * j, a.y + Math.sin(ang) * d + Math.cos(ang) * j);
  }
  return pts;
}

/** Bubbles that swell and pop: born over [0, spread] of the effect, each
 *  living `life` of it, rising `rise` px. Positions picked once. */
function bubbles(t: FxTools, r: Rect, n: number, color: number, seconds: number, rise: number, pop: SparkStyle) {
  const s = Math.min(r.w, r.h);
  const list = Array.from({ length: n }, () => ({
    x: r.x + r.w * rand(0.2, 0.8), y: r.y + r.h * rand(0.45, 0.85),
    born: rand(0, 0.55), life: rand(0.25, 0.4), size: s * rand(0.05, 0.09), wob: rand(0, TAU), popped: false,
  }));
  t.draw(seconds, (g, u) => {
    for (const b of list) {
      const k = (u - b.born) / b.life;
      if (k < 0) continue;
      const x = b.x + Math.sin(b.wob + k * 5) * 2, y = b.y - rise * k;
      if (k >= 1) {
        if (!b.popped) {
          b.popped = true;
          for (let i = 0; i < 4; i++) {
            const a = (i / 4) * TAU + rand(-0.4, 0.4);
            t.spark(x, y, Math.cos(a) * 60, Math.sin(a) * 60, 0.18, pop);
          }
        }
        continue;
      }
      const rad = b.size * (0.4 + 0.6 * k);
      g.circle(x, y, rad).fill({ color, alpha: 0.12 }).circle(x, y, rad).stroke({ width: 1.6, color, alpha: 0.9 });
      g.circle(x - rad * 0.35, y - rad * 0.35, rad * 0.22).fill({ color: 0xffffff, alpha: 0.7 });
    }
  });
}

// ── The bites ──────────────────────────────────────────────────────────────

/** BURN: fire flares up off the card's footing, embers lift off it, and if it
 *  still wore shields they glow and drip away (BURN melts two a tick). */
function burn(t: FxTools, r: Rect, k: number, melted: boolean) {
  const s = Math.min(r.w, r.h), base = r.y + r.h * 0.92;
  const n = 3 + Math.round(k);
  const tongues = Array.from({ length: n }, (_, i) => ({
    x: r.x + r.w * (0.18 + (0.64 * (i + 0.5)) / n) + rand(-4, 4),
    h: s * rand(0.32, 0.5) * (0.8 + k * 0.15), w: s * rand(0.08, 0.12), ph: rand(0, TAU),
  }));
  t.draw(0.8, (g, u) => {
    const e = envelope(u, 0.18, 0.5);
    for (const f of tongues) {
      const flick = 0.85 + 0.15 * Math.sin(u * 40 + f.ph);
      const sway = Math.sin(u * 18 + f.ph) * f.w * 0.8;
      flame(g, f.x, base, f.w, f.h * e * flick, sway, 0xff6a2a, 0.55 * e);
      flame(g, f.x, base, f.w * 0.55, f.h * 0.62 * e * flick, sway * 0.7, 0xffd27a, 0.7 * e);
    }
  });
  t.glow(r, 0xff6a2a, 0.3 + 0.08 * k, 0.7, 1.05);
  t.emit({ count: Math.round(12 * k), palette: EMBER.palette, from: { x: r.x + r.w * 0.15, y: r.y + r.h * 0.5, w: r.w * 0.7, h: r.h * 0.4 },
    dir: [-115, -65], speed: [50, 150], gravity: -170, drag: 0.5, life: [0.5, 1.0], size: [6, 2] });
  if (melted) {
    // The plating goes: an orange rim around the card, and molten drops off it.
    t.draw(0.7, (g, u) => {
      const a = envelope(u, 0.15, 0.35);
      g.roundRect(r.x + 3, r.y + 3, r.w - 6, r.h - 6, 8).stroke({ width: 4, color: 0xff8a3a, alpha: 0.75 * a });
    });
    for (let i = 0; i < 6; i++)
      t.later(0.08 + i * 0.05, () => t.spark(r.x + r.w * rand(0.1, 0.9), r.y + r.h * rand(0.7, 0.95), rand(-20, 20), rand(20, 60),
        rand(0.4, 0.6), MOLTEN));
  }
}

/** SCALD: it boils — bubbles swell and pop across the card — and steam rolls
 *  up off it over a hot flush. */
function scald(t: FxTools, r: Rect, k: number) {
  bubbles(t, r, 4 + Math.round(2 * k), 0xdff4ff, 0.8, Math.min(r.w, r.h) * 0.12, SPLASH_STEAM);
  t.glow(r, 0xff7a6a, 0.22 + 0.06 * k, 0.6, 1.05);
  t.emit({ count: Math.round(9 * k), palette: STEAM.palette, from: { x: r.x + r.w * 0.2, y: r.y + r.h * 0.25, w: r.w * 0.6, h: r.h * 0.4 },
    dir: [-110, -70], speed: [30, 80], gravity: -70, drag: 0.55, life: [0.7, 1.1], size: [9, 18], swirl: 50 });
}
const SPLASH_STEAM: SparkStyle = { palette: [0xffffff, 0xdff4ff], gravity: -40, drag: 0.4, size: [4, 2], streak: false };

/** BLEED: the wound opens — a red cut — and drops run down the card and
 *  spatter at its foot, to a double pulse like a heartbeat. */
function bleed(t: FxTools, r: Rect, k: number) {
  const c = centre(r), s = Math.min(r.w, r.h);
  const a = rand(-0.5, -0.2);
  t.arcCut({ x: c.x, y: c.y - s * 0.12 }, s * 0.24, a, 0xff4a5a, 4, 0.06, 0.4, 0.2);
  const n = 6 + Math.round(2 * k);
  for (let i = 0; i < n; i++) {
    const f = rand(-1, 1);
    t.later(i * 0.05, () => t.spark(c.x + Math.cos(a) * s * 0.22 * f, c.y - s * 0.12 + Math.sin(a) * s * 0.22 * f,
      rand(-15, 15), rand(0, 40), rand(0.4, 0.55), BLOOD));
  }
  t.later(0.36, () => {
    for (let i = 0; i < 6; i++)
      t.spark(c.x + rand(-s * 0.25, s * 0.25), r.y + r.h * 0.86, rand(-80, 80), rand(-160, -60), rand(0.18, 0.3), SPLASH);
  });
  t.glow(r, 0xff2a3a, 0.26, 0.3, 1.0);
  t.later(0.2, () => t.glow(r, 0xff2a3a, 0.2, 0.3, 1.0));
}

/** POISON (DOT): toxic bubbles rise off the card and pop, in a sickly haze. */
function poison(t: FxTools, r: Rect, k: number) {
  bubbles(t, r, 5 + Math.round(2 * k), 0xa8f050, 0.9, Math.min(r.w, r.h) * 0.4, TOXIC);
  t.glow(r, 0x8ad040, 0.22 + 0.05 * k, 0.9, 1.1);
  t.emit({ count: Math.round(6 * k), palette: TOXIC.palette, from: r, at: "bottom", dir: [-100, -80], speed: [20, 60],
    gravity: -30, drag: 0.6, life: [0.7, 1.1], size: [5, 2], swirl: 40 });
}

// ── Heals and auras ────────────────────────────────────────────────────────

/** REGEN: a soft green cross swells over the card and lifts, trailing motes. */
function regen(t: FxTools, r: Rect, k: number) {
  const c = centre(r), s = Math.min(r.w, r.h);
  t.draw(0.8, (g, u) => {
    const a = envelope(u, 0.2, 0.45), arm = s * (0.14 + 0.04 * a), y = c.y - s * 0.2 * u, w = s * 0.07;
    g.rect(c.x - w / 2, y - arm, w, arm * 2).fill({ color: 0x7dff9a, alpha: 0.55 * a })
      .rect(c.x - arm, y - w / 2, arm * 2, w).fill({ color: 0x7dff9a, alpha: 0.55 * a });
  });
  t.ring(r, 0x7dff9a, 0.5, 1.0, 0.5, 3);
  t.emit({ count: Math.round(10 * k), palette: MEND.palette, from: r, at: "bottom", dir: [-100, -80], speed: [50, 120],
    gravity: -120, drag: 0.5, life: [0.6, 1.0], size: [7, 2] });
}

/** Photosynthesis (LEAF): a shaft of sunlight falls on the card and it puts
 *  out leaves. Every LEAF card, every round — so a light touch. */
function photosynthesis(t: FxTools, r: Rect, k: number) {
  const c = centre(r), s = Math.min(r.w, r.h);
  t.draw(0.9, (g, u) => {
    const a = envelope(u, 0.25, 0.5) * 0.16, top = r.y - s * 0.5;
    g.poly([c.x - s * 0.05, top, c.x + s * 0.25, top, c.x + s * 0.32, r.y + r.h * 0.9, c.x - s * 0.32, r.y + r.h * 0.9])
      .fill({ color: 0xeaffb0, alpha: a });
  });
  const leaves = Array.from({ length: 2 + Math.round(k) }, (_, i) => ({
    x: r.x + r.w * (0.25 + 0.5 * rand(0, 1)), a0: -Math.PI / 2 + (i % 2 ? 0.7 : -0.7), ph: rand(0, TAU), d: rand(0, 0.25),
  }));
  t.draw(0.9, (g, u) => {
    for (const l of leaves) {
      const q = clamp01((u - l.d) / 0.6);
      if (q <= 0) continue;
      const grow = Math.min(1, q * 2.5), fade = q > 0.7 ? 1 - (q - 0.7) / 0.3 : 1;
      leafShape(g, { x: l.x + Math.sin(l.ph + q * 6) * 3, y: r.y + r.h * 0.75 - s * 0.35 * q }, l.a0 + Math.sin(l.ph + q * 5) * 0.3,
        s * 0.16 * grow, 0x9be86a, 0.8 * fade);
    }
  });
  t.emit({ count: 6, palette: LEAFY.palette, from: r, at: "bottom", dir: [-100, -80], speed: [30, 80], gravity: -90,
    drag: 0.5, life: [0.6, 1.0], size: [6, 2], swirl: 80 });
}

/** Bark (LEAF): plates of bark slide in over the card's sides where it was
 *  struck, and set. */
function bark(t: FxTools, r: Rect) {
  const inset = Math.min(r.w, r.h) * 0.12;
  t.draw(0.75, (g, u) => {
    const slide = 1 - Math.pow(1 - clamp01(u / 0.25), 3), a = u < 0.6 ? 1 : 1 - (u - 0.6) / 0.4, off = (1 - slide) * 14;
    const col = 0xd8c888, edge = 0xa8e070;
    // Left, right, top, bottom plates: angular, a little ragged.
    const plates = [
      [r.x - off, r.y + inset, r.x + inset - off, r.y + inset * 1.6, r.x + inset - off, r.y + r.h - inset * 1.6, r.x - off, r.y + r.h - inset],
      [r.x + r.w + off, r.y + inset, r.x + r.w - inset + off, r.y + inset * 1.6, r.x + r.w - inset + off, r.y + r.h - inset * 1.6, r.x + r.w + off, r.y + r.h - inset],
      [r.x + inset, r.y - off, r.x + inset * 1.6, r.y + inset - off, r.x + r.w - inset * 1.6, r.y + inset - off, r.x + r.w - inset, r.y - off],
      [r.x + inset, r.y + r.h + off, r.x + inset * 1.6, r.y + r.h - inset + off, r.x + r.w - inset * 1.6, r.y + r.h - inset + off, r.x + r.w - inset, r.y + r.h + off],
    ];
    for (const p of plates) g.poly(p, true).fill({ color: col, alpha: 0.28 * a }).poly(p, true).stroke({ width: 2, color: edge, alpha: 0.85 * a });
  });
  t.later(0.22, () => t.emit({ count: 8, palette: FLECK.palette, from: r, at: "edge", speed: [40, 90], gravity: 260, drag: 0.6,
    life: [0.3, 0.5], size: [6, 3] }));
}

/** The tide (AQUA): water rises up the card and falls back — and what it
 *  leaves is the Flow it chose: a sparkle of ice, a breath of steam, or drops. */
function tide(t: FxTools, r: Rect, mode: TickArgs["mode"]) {
  const s = Math.min(r.w, r.h);
  t.draw(0.85, (g, u) => {
    const lvl = Math.sin(Math.PI * clamp01(u / 0.85)) * 0.55, y = r.y + r.h * (1 - lvl), a = u < 0.7 ? 1 : 1 - (u - 0.7) / 0.3;
    const pts: number[] = [];
    for (let i = 0; i <= 12; i++) {
      const x = r.x + (r.w * i) / 12;
      pts.push(x, y + Math.sin(i * 0.9 + u * 14) * s * 0.03);
    }
    g.poly([...pts, r.x + r.w, r.y + r.h, r.x, r.y + r.h], true).fill({ color: 0x4d94e8, alpha: 0.22 * a });
    g.poly(pts, false).stroke({ width: 2.5, color: 0xbfeaff, alpha: 0.9 * a });
  });
  const crest = { x: r.x, y: r.y + r.h * 0.45, w: r.w, h: r.h * 0.1 };
  if (mode === "ice") {
    t.later(0.4, () => t.emit({ count: 10, palette: [0xffffff, 0xe6f8ff, 0x9fe3ff], from: crest, speed: [10, 40], gravity: 0,
      drag: 0.3, life: [0.3, 0.6], size: [7, 2] }));
  } else if (mode === "steam") {
    t.later(0.35, () => t.emit({ count: 8, palette: MIST.palette, from: crest, dir: [-110, -70], speed: [30, 70], gravity: -40,
      drag: 0.4, life: [0.6, 0.9], size: [8, 16] }));
  } else {
    t.later(0.38, () => t.emit({ count: 10, palette: DROP.palette, from: crest, dir: [-130, -50], speed: [80, 180], gravity: 700,
      drag: 0.6, life: [0.35, 0.6], size: [6, 3] }));
  }
}

/** Zephyr (GALE): the wind picks up — a spiral of air curls up round the card. */
function zephyr(t: FxTools, r: Rect) {
  const c = centre(r), s = Math.min(r.w, r.h);
  t.draw(0.7, (g, u) => {
    const a = envelope(u, 0.2, 0.5);
    for (let j = 0; j < 2; j++) {
      const pts: number[] = [];
      for (let i = 0; i <= 16; i++) {
        const q = i / 16, ang = q * TAU * 1.2 + u * 9 + j * Math.PI, y = r.y + r.h * (0.95 - 0.8 * q * clamp01(u * 2));
        pts.push(c.x + Math.cos(ang) * s * 0.42 * (1 - q * 0.3), y + Math.sin(ang) * s * 0.08);
      }
      g.poly(pts, false).stroke({ width: 2, color: 0xffd9a0, alpha: 0.7 * a });
    }
  });
  t.emit({ count: 6, palette: GUST.palette, from: { x: c.x - s * 0.3, y: r.y + r.h * 0.6, w: s * 0.6, h: s * 0.3 }, dir: [-110, -70],
    speed: [60, 140], gravity: -60, drag: 0.4, life: [0.3, 0.55], size: [8, 2], streak: true, swirl: 700 });
}

/** First Light (DAWN): a small sunrise on the card's top edge. */
function firstLight(t: FxTools, r: Rect) {
  const top = { x: r.x + r.w / 2, y: r.y + r.h * 0.12 };
  t.rays(top, [0xffffff, 0xfff1b3, 0xffd54f], 0.28, 6);
  t.glow({ x: top.x - 10, y: top.y - 10, w: 20, h: 20 }, 0xfff1b3, 0.6, 0.45, 2.2);
}

// ── Statuses ending ────────────────────────────────────────────────────────

/** A status burned off early: a band of dawn light sweeps up the card and
 *  lifts the affliction off it as gold. */
function cleanse(t: FxTools, r: Rect) {
  t.draw(0.6, (g, u) => {
    const y = r.y + r.h * (1 - u), a = u < 0.8 ? 1 : 1 - (u - 0.8) / 0.2;
    g.rect(r.x, y, r.w, r.h * 0.18 * (1 - u)).fill({ color: 0xffe38a, alpha: 0.22 * a })
      .rect(r.x, y - 1.5, r.w, 3).fill({ color: 0xfff6cc, alpha: 0.9 * a });
  });
  t.later(0.45, () => t.rays({ x: r.x + r.w / 2, y: r.y + r.h * 0.1 }, [0xffffff, 0xfff1b3, 0xffd54f], 0.35, 8));
  t.emit({ count: 12, palette: GOLD.palette, from: r, dir: [-100, -80], speed: [60, 150], gravity: -160, drag: 0.4,
    life: [0.5, 0.9], size: [7, 2] });
}

/** A status running out, by what it was. */
function expire(t: FxTools, r: Rect, kind: StatusKind | undefined) {
  const c = centre(r), s = Math.min(r.w, r.h);
  switch (kind) {
    case "FREEZE": {
      // The ice cracks, then shatters: cracks race out from the middle, and
      // the shards fall away in a breath of cold.
      const cracks = Array.from({ length: 4 }, (_, i) => crackPts(c, (i / 4) * TAU + rand(-0.4, 0.4), s * rand(0.35, 0.5), 5, s * 0.05));
      t.draw(0.35, (g, u) => {
        const n = Math.max(2, Math.round(6 * clamp01(u / 0.3))), a = u < 0.7 ? 1 : 1 - (u - 0.7) / 0.3;
        for (const p of cracks) g.poly(p.slice(0, n * 2), false).stroke({ width: 2, color: 0xe6f8ff, alpha: 0.95 * a });
      });
      t.later(0.2, () => {
        for (let i = 0; i < 14; i++) {
          const a = rand(0, TAU), v = rand(60, 180);
          t.spark(c.x + Math.cos(a) * s * 0.2, c.y + Math.sin(a) * s * 0.2, Math.cos(a) * v, Math.sin(a) * v - 60, rand(0.35, 0.6), SHARD);
        }
        t.emit({ count: 8, palette: MIST.palette, from: r, dir: [-110, -70], speed: [20, 50], gravity: -40, drag: 0.4, life: [0.6, 0.9], size: [8, 16] });
        t.glow(r, 0xbfeaff, 0.35, 0.35, 1.05);
      });
      return;
    }
    case "SLEEP": {
      // It wakes: the last Zs drift off, and its eyes open with a blink.
      const zs = [0, 1, 2].map((i) => ({ d: i * 0.12, x: c.x + s * (0.1 + i * 0.1), size: s * (0.08 + i * 0.03) }));
      t.draw(0.8, (g, u) => {
        for (const z of zs) {
          const q = clamp01((u - z.d) / 0.55);
          if (q <= 0 || q >= 1) continue;
          const x = z.x + Math.sin(q * 5) * 3, y = r.y + r.h * 0.35 - s * 0.35 * q, h = z.size, a = q < 0.7 ? 1 : 1 - (q - 0.7) / 0.3;
          g.moveTo(x - h / 2, y - h / 2).lineTo(x + h / 2, y - h / 2).lineTo(x - h / 2, y + h / 2).lineTo(x + h / 2, y + h / 2)
            .stroke({ width: 2.5, color: 0xc8b8ff, alpha: 0.95 * a });
        }
      });
      t.flash({ x: c.x, y: r.y + r.h * 0.3 }, 0xfff8e0, 0.25, 0.45);
      return;
    }
    case "ROOT": {
      // The roots let go: the vines holding its footing shrink back into the
      // ground, dropping dead leaf.
      const vines = Array.from({ length: 4 }, (_, i) => ({ x: r.x + r.w * (0.15 + 0.23 * i), bend: rand(-1, 1) * s * 0.15, h: s * rand(0.3, 0.45) }));
      t.draw(0.6, (g, u) => {
        const len = 1 - clamp01(u / 0.8), a = u < 0.8 ? 1 : 1 - (u - 0.8) / 0.2, base = r.y + r.h * 0.95;
        for (const v of vines) {
          const h = v.h * len;
          g.moveTo(v.x, base).quadraticCurveTo(v.x + v.bend, base - h * 0.6, v.x + v.bend * 0.3, base - h)
            .stroke({ width: 3, color: 0x9ab85a, alpha: 0.85 * a });
        }
      });
      t.emit({ count: 8, palette: FLECK.palette, from: { x: r.x, y: r.y + r.h * 0.55, w: r.w, h: r.h * 0.3 }, dir: [60, 120],
        speed: [20, 60], gravity: 260, drag: 0.6, life: [0.4, 0.7], size: [6, 3], swirl: 90 });
      return;
    }
    case "STUN":
    case "PARALYZE":
    case "ELECTRIFIED": {
      // The charge runs out: a last few sputters, each weaker, then nothing.
      const pal = ZAP[kind];
      t.arcs(c, pal, 0.35, 2);
      t.later(0.14, () => t.arcs({ x: c.x + rand(-8, 8), y: c.y + rand(-8, 8) }, pal, 0.25, 1));
      t.later(0.3, () => t.arcs({ x: c.x + rand(-8, 8), y: c.y + rand(-8, 8) }, pal, 0.16, 1));
      t.emit({ count: 6, palette: pal, from: { x: c.x - 8, y: c.y - 8, w: 16, h: 16 }, speed: [60, 140], gravity: 400, drag: 0.4,
        life: [0.2, 0.4], size: [5, 2], streak: true });
      return;
    }
    case "BURN":
      // Put out: the last embers die and smoke curls up where the fire was.
      t.emit({ count: 9, palette: SMOKE.palette, from: { x: r.x + r.w * 0.2, y: r.y + r.h * 0.45, w: r.w * 0.6, h: r.h * 0.4 },
        dir: [-110, -70], speed: [30, 70], gravity: -80, drag: 0.5, life: [0.7, 1.1], size: [8, 17], swirl: 60 });
      t.emit({ count: 4, palette: EMBER.palette, from: { x: r.x + r.w * 0.25, y: r.y + r.h * 0.7, w: r.w * 0.5, h: r.h * 0.2 },
        dir: [-110, -70], speed: [20, 60], gravity: -170, drag: 0.5, life: [0.3, 0.5], size: [5, 2] });
      return;
    case "SCALD":
      t.emit({ count: 6, palette: MIST.palette, from: { x: r.x + r.w * 0.25, y: r.y + r.h * 0.35, w: r.w * 0.5, h: r.h * 0.3 },
        dir: [-110, -70], speed: [25, 60], gravity: -40, drag: 0.4, life: [0.6, 0.9], size: [8, 16] });
      return;
    case "BLEED":
      // The wound closes: the cut draws shut to a glint.
      t.draw(0.35, (g, u) => {
        const half = s * 0.18 * (1 - u);
        g.moveTo(c.x - half, c.y - s * 0.1 + half * 0.3).lineTo(c.x + half, c.y - s * 0.1 - half * 0.3)
          .stroke({ width: 3, color: 0xff5a64, alpha: 0.9 });
      });
      t.flash({ x: c.x, y: c.y - s * 0.1 }, 0xffe0e0, 0.14, 0.3);
      return;
    case "DOT":
      bubbles(t, r, 3, 0xa8f050, 0.55, s * 0.2, TOXIC);
      return;
    case "BLIND":
      // The glare lifts off its eyes, upward.
      t.draw(0.5, (g, u) => {
        const y = r.y + r.h * (0.35 - 0.45 * u), a = 1 - u;
        g.rect(r.x, y, r.w, r.h * 0.22).fill({ color: 0xfffbe0, alpha: 0.3 * a });
      });
      return;
    case "WEAKEN":
      // The weight comes off: it straightens, and dust lifts away.
      t.draw(0.5, (g, u) => {
        const y = c.y + s * 0.15 - s * 0.35 * u, w = s * 0.18, a = u < 0.6 ? 1 : 1 - (u - 0.6) / 0.4;
        g.moveTo(c.x - w, y + w * 0.6).lineTo(c.x, y).lineTo(c.x + w, y + w * 0.6).stroke({ width: 3, color: 0xe8dcd0, alpha: 0.85 * a });
      });
      t.emit({ count: 8, palette: LIFT.palette, from: r, at: "bottom", dir: [-100, -80], speed: [120, 220], gravity: -260, drag: 0.5,
        life: [0.3, 0.5], size: [6, 2], streak: true });
      return;
    case "FRIGHTEN":
      // The dread thins out and scatters.
      t.emit({ count: 10, palette: WISP.palette, from: { x: c.x - s * 0.2, y: c.y - s * 0.2, w: s * 0.4, h: s * 0.4 }, speed: [40, 110],
        gravity: 0, drag: 0.5, life: [0.4, 0.7], size: [8, 3] });
      return;
    case "MUTED":
    case "SEAL": {
      // The seal breaks: its ring splits into four and flies apart.
      t.draw(0.45, (g, u) => {
        const rad = s * (0.42 + 0.3 * u), a = 1 - u;
        for (let i = 0; i < 4; i++) {
          const a0 = (i / 4) * TAU + 0.25, off = s * 0.12 * u;
          const ox = Math.cos(a0 + Math.PI / 4) * off, oy = Math.sin(a0 + Math.PI / 4) * off;
          g.arc(c.x + ox, c.y + oy, rad, a0, a0 + TAU / 4 - 0.35).stroke({ width: 3, color: 0xd0d4e0, alpha: 0.9 * a });
        }
      });
      return;
    }
    case "STEALTH":
    case "EVASION":
      // Back in plain sight: its outline flickers in.
      t.draw(0.45, (g, u) => {
        const a = (Math.sin(u * Math.PI * 6) * 0.5 + 0.5) * (1 - u);
        g.roundRect(r.x + 4, r.y + 4, r.w - 8, r.h - 8, 8).stroke({ width: 2, color: 0xbcd0ff, alpha: 0.9 * a });
      });
      return;
    default:
      t.ring(r, 0xd0d4e0, 0.9, 0.3, 0.35, 2);
  }
}

/** Draw one card's round-end tick. `element` is the card's own — it colours
 *  nothing here (a status looks like what it is), but the tools are keyed by it. */
export function drawTick(t: FxTools, r: Rect, a: TickArgs) {
  const k = Math.max(0.6, Math.min(2.2, a.strength));
  switch (a.tick) {
    case "bite":
      if (a.status === "BURN") burn(t, r, k, !!a.melted);
      else if (a.status === "SCALD") scald(t, r, k);
      else if (a.status === "BLEED") bleed(t, r, k);
      else poison(t, r, k);
      return;
    case "expire": return expire(t, r, a.status);
    case "cleanse": return cleanse(t, r);
    case "regen": return regen(t, r, k);
    case "photosynthesis": return photosynthesis(t, r, k);
    case "bark": return bark(t, r);
    case "tide": return tide(t, r, a.mode);
    case "zephyr": return zephyr(t, r);
    case "firstLight": return firstLight(t, r);
    case "shield": return; // the layer hands this one to the element's look
  }
}

/** Creeping Dark (DUSK): life drawn out of the card it touches and carried
 *  back to the one drinking — a stream of shadow along a curve. */
export function drawDrain(t: FxTools, from: Rect, to: Rect) {
  const a = centre(from), b = centre(to);
  const s = Math.min(from.w, from.h);
  // What it takes gathers IN on the victim first — DUSK's hit implodes.
  t.emit({ count: 12, palette: WISP.palette, from, at: "ring", speed: [80, 140], gravity: 0, drag: 1, life: [0.2, 0.3], size: [8, 3] });
  for (let i = 0; i < 3; i++)
    t.shot({
      from: a, to: b, seconds: 0.45, delay: 0.18 + i * 0.07, ease: "in", arc: s * (0.35 + 0.15 * i) * (i % 2 ? -1 : 1),
      head: 0xc9a6ff, headSize: 10,
      trail: { palette: [0xf3e8ff, 0xc9a6ff, 0x7b4fb0], rate: 60, size: [7, 2], life: [0.2, 0.4], drift: 8 },
      onArrive: i === 2 ? () => t.glow(to, 0xb07cff, 0.4, 0.45, 1.1) : undefined,
    });
}

