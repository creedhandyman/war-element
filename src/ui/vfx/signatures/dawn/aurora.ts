/** AURORA — Light Orb Creation. "Conjure 3 Light Orbs: blue (3 DMG + BLIND),
 *  green (2 DMG + heal weakest ally 7), red (POISON 2). Each absorbs one
 *  incoming hit, then bursts at the attacker." Three lights, each taking a
 *  blow meant for her.
 *
 *  On its art Aurora is a white-robed mage with a golden halo, three glowing
 *  ORBS — blue, green and red — circling her on rings of light, and an
 *  AURORA of green and violet ribbons in the sky behind her. She conjures for
 *  herself, so there is no delivery: the LANDING is the whole move.
 *
 *  An aurora curtain shimmers into being over her card: soft ribbons of
 *  green going violet, hung in folds that ripple sideways, brightest along
 *  their lower hem. Under it the orbs kindle one after another — BLUE, then
 *  GREEN, then RED — each from a pinpoint flare into a glowing sphere with a
 *  white-hot core and a little ring of its own, where it sits on her art
 *  (blue high on one side, green on the other, red low). Each is strung on
 *  its own tilted ellipse of light round her card and goes round on it,
 *  dimmer and smaller as it passes behind her, a comet-tail of its colour
 *  drawn along its ring; after a turn or so the rings thin and the orbs fade
 *  into her, kept (the game shows them from here).
 *
 *  The only blue, green and red in DAWN, kept apart from the gold: no sun,
 *  no beams, no rays. All of it is light (additive). */
import { centre, rand } from "../../looks/base";
import type { Graphics } from "pixi.js";
import type { FxTools, Pt, SparkStyle } from "../../looks/types";
import type { Signature, SigMoment } from "../types";

const TAU = Math.PI * 2;
const WHITE = 0xffffff;
/** The aurora: green at its hem, violet at its crown. */
const AUR_GREEN = 0x4dffb0, AUR_TEAL = 0x5ad8ff, AUR_VIOLET = 0xb486ff;
/** Each orb: its body, its pale core, and the deep colour of its glow. */
const ORBS = [
  { body: 0x4aa6ff, core: 0xd6ecff, deep: 0x2266ff }, // blue: the blinding one
  { body: 0x4dff7a, core: 0xdcffe2, deep: 0x16c84a }, // green: the mending one
  { body: 0xff4a4a, core: 0xffd6cc, deep: 0xe0182a }, // red: the poisoning one
];
/** Each orb's ring round her card: its tilt, where on it the orb kindles
 *  (blue high on one side, green on the other, red low, as on her art), and
 *  when, s from the landing. */
const RINGS = [
  { tilt: 0.5, phase: Math.PI, at: 0.06 },
  { tilt: -0.18, phase: 0, at: 0.18 },
  { tilt: -0.55, phase: Math.PI, at: 0.3 },
];
/** Sparks shed by an orb as it kindles: its own colour, hanging a moment. */
const shed = (o: (typeof ORBS)[number]): SparkStyle => ({ palette: [WHITE, o.core, o.body, o.deep], gravity: 0, drag: 0.4, size: [4.5, 1.2], streak: false });

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeOut = (x: number) => 1 - (1 - x) * (1 - x);
/** Overshoots and settles: a light catching. */
const pop = (x: number) => { const k = 2; return 1 + (k + 1) * Math.pow(x - 1, 3) + k * Math.pow(x - 1, 2); };

/** How fast the orbs go round (rad/s), the ring's size against the square,
 *  and when it all fades. */
const SPIN = TAU / 0.75, RX = 0.6, RY = 0.2, END = 1.08;

// ── The aurora ───────────────────────────────────────────────────────────────

/** One curtain of the aurora over `c`, `W` across: a row of thin vertical
 *  strands hung along a rippling hem, each rising `H` (give or take) and
 *  fading as it climbs, green at the hem and violet up top, shimmering one
 *  strand against the next. `time` drives the ripple. */
function curtain(g: Graphics, c: Pt, W: number, H: number, time: number, seed: number, alpha: number, hue: number) {
  if (alpha <= 0.01) return;
  const N = 48;
  for (let i = 0; i < N; i++) {
    const f = i / (N - 1), x = c.x - W / 2 + W * f;
    // The hem ripples sideways along the curtain as folds drift through it.
    const hem = c.y + H * 0.18 * Math.sin(f * 7 + time * 3.2 + seed) + H * 0.08 * Math.sin(f * 17 - time * 5 + seed);
    const h = H * (0.7 + 0.3 * Math.sin(f * 11 + time * 2 + seed * 2));
    const ends = Math.sin(Math.PI * f), shimmer = 0.6 + 0.4 * Math.sin(time * 9 + i * 1.7 + seed);
    const a = alpha * ends * shimmer;
    if (a < 0.02) continue;
    const w = (W / N) * 2;
    // Hem to crown in three bands: bright green, teal, a violet haze.
    g.moveTo(x, hem).lineTo(x, hem - h * 0.3).stroke({ width: w, color: hue ? AUR_TEAL : AUR_GREEN, alpha: 0.42 * a });
    g.moveTo(x, hem - h * 0.3).lineTo(x, hem - h * 0.65).stroke({ width: w, color: hue ? AUR_VIOLET : AUR_TEAL, alpha: 0.24 * a });
    g.moveTo(x, hem - h * 0.65).lineTo(x, hem - h).stroke({ width: w, color: AUR_VIOLET, alpha: 0.12 * a });
    g.circle(x, hem, w * 0.45).fill({ color: WHITE, alpha: 0.25 * a });
  }
}

// ── The orbs ─────────────────────────────────────────────────────────────────

/** A point on a ring round `c` at angle `q`: the ellipse `rx` by `ry`, turned
 *  by `tilt`, and how near the viewer it is there (1 in front, 0 behind). */
function onRing(c: Pt, rx: number, ry: number, tilt: number, q: number) {
  const x = Math.cos(q) * rx, y = Math.sin(q) * ry, ct = Math.cos(tilt), st = Math.sin(tilt);
  return { x: c.x + x * ct - y * st, y: c.y + x * st + y * ct, near: 0.5 + 0.5 * Math.sin(q) };
}

/** The ring itself, from angle `q0` to `q1`, as flat points. */
function ringArc(c: Pt, rx: number, ry: number, tilt: number, q0: number, q1: number): number[] {
  const n = Math.max(4, Math.ceil(Math.abs(q1 - q0) / 0.12)), pts: number[] = [];
  for (let i = 0; i <= n; i++) {
    const p = onRing(c, rx, ry, tilt, q0 + ((q1 - q0) * i) / n);
    pts.push(p.x, p.y);
  }
  return pts;
}

/** An orb of light at `p`, `r` across: its glow, the coloured sphere, a pale
 *  core lit from the top-left, a white-hot point, and a little tilted ring of
 *  its own round it. */
function orb(g: Graphics, p: Pt, r: number, o: (typeof ORBS)[number], alpha: number, spin: number) {
  if (alpha <= 0.01 || r < 0.5) return;
  g.circle(p.x, p.y, r * 2.4).fill({ color: o.deep, alpha: 0.16 * alpha });
  g.circle(p.x, p.y, r * 1.5).fill({ color: o.body, alpha: 0.22 * alpha });
  g.circle(p.x, p.y, r).fill({ color: o.body, alpha: 0.75 * alpha }).stroke({ width: 1.2, color: o.core, alpha: 0.9 * alpha });
  g.circle(p.x - r * 0.2, p.y - r * 0.22, r * 0.55).fill({ color: o.core, alpha: 0.8 * alpha });
  g.circle(p.x - r * 0.3, p.y - r * 0.32, r * 0.22).fill({ color: WHITE, alpha: alpha });
  const ring: number[] = [], ct = Math.cos(spin), st = Math.sin(spin);
  for (let i = 0; i <= 20; i++) {
    const q = (i / 20) * TAU, x = Math.cos(q) * r * 1.85, y = Math.sin(q) * r * 0.5;
    ring.push(p.x + x * ct - y * st, p.y + x * st + y * ct);
  }
  g.poly(ring, false).stroke({ width: 1.2, color: o.core, alpha: 0.75 * alpha });
}

/** A pinpoint flare: four thin arms of the orb's colour round a white
 *  point, `R` long. */
function kindle(g: Graphics, p: Pt, R: number, color: number, alpha: number) {
  if (alpha <= 0.01 || R < 0.5) return;
  for (const [ux, uy] of [[1, 0], [0, 1]]) {
    const w = R * 0.08;
    g.poly([p.x - ux * R, p.y - uy * R, p.x - uy * w, p.y + ux * w, p.x + ux * R, p.y + uy * R, p.x + uy * w, p.y - ux * w], true).fill({ color, alpha: 0.85 * alpha });
  }
  g.circle(p.x, p.y, R * 0.18).fill({ color: WHITE, alpha });
}

export const AURORA: Signature = {
  // Conjuring, not striking: the board does not stir.
  shake: 0,
  lunge: false,

  land(t: FxTools, m: SigMoment) {
    const c = centre(m.from), s = m.size, seed = rand(0, 10);
    const rx = s * RX, ry = s * RY;

    // THE AURORA over her card: two curtains, one behind the other, swelling
    // in, shimmering, and gone as the orbs settle.
    t.draw(END, (g, u) => {
      const time = u * END, a = easeOut(clamp01(time / 0.22)) * (1 - clamp01((time - (END - 0.35)) / 0.35));
      curtain(g, { x: c.x + s * 0.05, y: c.y - s * 0.2 }, s * 1.5, s * 0.6, time, seed + 3, 0.9 * a, 1);
      curtain(g, { x: c.x - s * 0.05, y: c.y - s * 0.1 }, s * 1.3, s * 0.55, time, seed, 1.25 * a, 0);
    });

    // THE ORBS, kindled one by one and sent round her on their rings.
    ORBS.forEach((o, i) => {
      const R = RINGS[i], D = END - R.at;
      const angle = (time: number) => R.phase + SPIN * Math.max(0, time - 0.12) * (1 - 0.25 * clamp01(time / D));
      const fade = (time: number) => 1 - clamp01((time - (D - 0.25)) / 0.25);
      t.draw(D, (g, u) => {
        const time = u * D, f = fade(time), q = angle(time), p = onRing(c, rx, ry, R.tilt, q);
        // The ring of light it rides: drawn on from where it kindled, the
        // stretch just behind the orb brightest — a comet-tail of its colour.
        const drawn = easeOut(clamp01(time / 0.3));
        if (drawn > 0) {
          g.poly(ringArc(c, rx, ry, R.tilt, R.phase, R.phase + TAU * drawn), false).stroke({ width: 1.5, color: o.core, alpha: 0.45 * f });
          const tail = Math.min(1.6, q - R.phase);
          if (tail > 0.05) {
            g.poly(ringArc(c, rx, ry, R.tilt, q - tail, q), false).stroke({ width: s * 0.05, color: o.body, alpha: 0.2 * f });
            g.poly(ringArc(c, rx, ry, R.tilt, q - tail * 0.5, q), false).stroke({ width: 2, color: o.core, alpha: 0.6 * f });
          }
        }
        // The orb, swelling out of the flare, smaller and dimmer behind her.
        const grow = pop(clamp01(time / 0.14)), depth = 0.6 + 0.4 * p.near;
        orb(g, p, s * 0.14 * grow * (0.8 + 0.25 * p.near) * (1 - 0.4 * (1 - f)), o, f * depth, R.tilt + time * 2);
        const fl = 1 - clamp01(time / 0.2);
        if (fl > 0) kindle(g, onRing(c, rx, ry, R.tilt, R.phase), s * 0.45 * easeOut(clamp01(time / 0.06)), o.body, fl);
      }, { delay: R.at });
      // Its kindling: a flash of its colour and a few motes shed.
      t.later(R.at, () => {
        const p = onRing(c, rx, ry, R.tilt, R.phase), st = shed(o);
        t.flash(p, o.body, 0.22 * (s / 90));
        for (let k = 0; k < Math.round(7 * t.quality) + 1; k++) {
          const a = rand(0, TAU), v = rand(40, 110) * (s / 90);
          t.spark(p.x, p.y, Math.cos(a) * v, Math.sin(a) * v, rand(0.25, 0.45), st);
        }
      });
    });
    // As the last orb settles, a soft wash of all three over her card.
    t.later(RINGS[2].at + 0.1, () => {
      t.glow(m.from, ORBS[0].body, 0.14, 0.5, 1.1);
      t.glow(m.from, ORBS[1].body, 0.1, 0.5, 0.9);
      t.glow(m.from, ORBS[2].body, 0.1, 0.5, 0.7);
    });
  },
};
