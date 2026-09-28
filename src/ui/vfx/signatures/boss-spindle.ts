/** SPINDLE — Unblinking Gaze. "It looks at three of you: MUTED for 2 rounds,
 *  BLIND for 2, and DOT 8 for 2." Lore: "It is not a spider and there is no
 *  web... the legs came later, grown to hold the eye at a height where
 *  nothing is out of sight, and the eye came first."
 *
 *  The DELIVERY is the eye opening. Over the boss a vast almond eye parts its
 *  lids — dark inside, lidded in pale silver, a great striated iris that
 *  darts about as it opens and then settles, turned toward the ones it has
 *  chosen — while the spindly legs that hold it up plant themselves round it
 *  and the light of the board is drawn in to it.
 *
 *  The LANDING is the look. The pupil tightens; the board goes still and dim
 *  under it; and one after another three cones of its gaze snap across the
 *  board onto the three it looks at. Each card is SEEN: an iris is printed on
 *  it, closing down to lock on, a dark pupil at its heart. Then the great eye
 *  blinks, once, and is gone — leaving what it saw marked (the game draws the
 *  MUTED, the BLIND and the DOT over that).
 *
 *  VOID's own vocabulary: pale silver on white, never purple, things pulled
 *  in rather than thrown out, and darkness drawn for real — every dark shape
 *  here rimmed in light so it reads over an empty square. */
import type { Graphics } from "pixi.js";
import { centre, lerpPt, rand } from "../looks/base";
import type { FxTools, Pt, SparkStyle } from "../looks/types";
import type { Signature, SigMoment } from "./types";

type Box = { x: number; y: number; w: number; h: number };

const TAU = Math.PI * 2;
const WHITE = 0xffffff, PALE = 0xe3e7f1, SILVER = 0xc2c8d8, DIM = 0x8a92a8;
/** VOID's darkness: only black reads as a hole in a near-black board. */
const INK = 0x000000;
/** Motes drawn IN: exact speed, so each dies on the point it was aimed at. */
const MOTE: SparkStyle = { palette: [WHITE, PALE, SILVER, DIM], gravity: 0, drag: 1, size: [7, 1.5], streak: true };
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeOut = (x: number) => 1 - (1 - x) * (1 - x);

/** The eye: half its width and its lids' opening, in squares. */
const HALF = 1.3, OPEN = 0.42;
/** The look: when each cone of gaze snaps on after the landing frame, how
 *  long it holds the stare, and the blink. */
const SNAP = 0.07, HOLD = 0.62, BLINK = 0.14;

/** An almond through `c`, tips `half` either side, lids bowed `open` off the
 *  axis: the one shape an eye is. */
function almond(g: Graphics, c: Pt, half: number, open: number): Graphics {
  return g.moveTo(c.x - half, c.y).quadraticCurveTo(c.x, c.y - open * 2, c.x + half, c.y)
    .quadraticCurveTo(c.x, c.y + open * 2, c.x - half, c.y);
}

/** An iris at `c`, `R` across: a pale ring, striations running in from it,
 *  the pupil left dark (the dark behind it shows through), a catchlight. */
function iris(g: Graphics, c: Pt, R: number, pupil: number, alpha: number) {
  if (alpha <= 0.01 || R < 1) return;
  g.circle(c.x, c.y, R).stroke({ width: 6, color: SILVER, alpha: 0.2 * alpha }).stroke({ width: 2, color: PALE, alpha: 0.95 * alpha });
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * TAU, r0 = R * Math.max(pupil + 0.08, 0.3), r1 = R * (i % 2 ? 0.8 : 0.95);
    g.moveTo(c.x + Math.cos(a) * r0, c.y + Math.sin(a) * r0).lineTo(c.x + Math.cos(a) * r1, c.y + Math.sin(a) * r1);
  }
  g.stroke({ width: 1.3, color: SILVER, alpha: 0.75 * alpha });
  g.circle(c.x, c.y, R * pupil).stroke({ width: 1.5, color: WHITE, alpha: 0.8 * alpha });
  g.circle(c.x - R * pupil * 0.45, c.y - R * pupil * 0.45, Math.max(1.2, R * 0.09)).fill({ color: WHITE, alpha: alpha });
}

/** How the eye is at a moment: how far open, where it looks, its pupil, how
 *  much of it there is. Both of its draws (the dark inside and the light)
 *  work from one of these, each on its own. */
interface EyeState { open: number; look: Pt; pupil: number; alpha: number }

/** THE EYE's dark inside, on the dark layer: only black reads as a hole. */
function eyeDark(gd: Graphics, c: Pt, s: number, e: EyeState) {
  const o = s * OPEN * e.open;
  if (e.alpha > 0.01 && o > 1) almond(gd, c, s * HALF, o).fill({ color: INK, alpha: 0.85 * e.alpha });
}

/** THE EYE over the boss, in light: lidded in silver, its iris turned by
 *  `look` (px, held inside the lids). `open` 0 is a shut line. */
function bigEye(g: Graphics, c: Pt, s: number, e: EyeState) {
  const { look, pupil, alpha } = e, half = s * HALF, o = s * OPEN * e.open;
  if (alpha <= 0.01) return;
  almond(g, c, half, Math.max(0.5, o)).stroke({ width: 9, color: SILVER, alpha: 0.2 * alpha }).stroke({ width: 3, color: PALE, alpha: 0.95 * alpha });
  const R = Math.min(o * 0.92, s * 0.4);
  if (R > 2) iris(g, { x: c.x + look.x * (1 - R / (s * 0.5)), y: c.y + look.y * 0.3 }, R, pupil, alpha);
  // Lashes of light off the lids' tips: the eye's corners.
  for (const sd of [-1, 1]) g.moveTo(c.x + sd * half, c.y).lineTo(c.x + sd * (half + s * 0.18), c.y).stroke({ width: 1.5, color: PALE, alpha: 0.6 * alpha });
}

/** Its legs: long, spindly, jointed high, planted round its square — what
 *  holds the eye at its height. `k` 0..1 as they come down. */
function legs(g: Graphics, c: Pt, s: number, k: number, alpha: number) {
  if (alpha <= 0.01 || k <= 0.01) return;
  for (const [fx, fy] of [[-1.55, 0.55], [-1.05, 0.85], [1.05, 0.85], [1.55, 0.55]]) {
    const hip = { x: c.x + fx * s * 0.45, y: c.y + s * 0.1 };
    const foot = { x: c.x + fx * s, y: c.y + fy * s };
    const knee = { x: (hip.x + foot.x) / 2 + fx * s * 0.2, y: Math.min(hip.y, foot.y) - s * 0.55 };
    const kk = lerpPt(hip, knee, Math.min(1, k * 2)), ff = lerpPt(knee, foot, clamp01(k * 2 - 1));
    g.moveTo(hip.x, hip.y).lineTo(kk.x, kk.y);
    if (k > 0.5) g.lineTo(ff.x, ff.y);
    g.stroke({ width: 2, color: DIM, alpha: 0.55 * alpha });
    if (k >= 1) g.circle(foot.x, foot.y, 2.5).fill({ color: PALE, alpha: 0.7 * alpha });
  }
}

/** Where the eye hangs: just over the boss's card. */
const eyeAt = (m: SigMoment): Pt => { const c = centre(m.from); return { x: c.x, y: c.y - m.size * 0.08 }; };

/** Where its iris turns to look at everything it chose: toward the middle of
 *  them, px. */
function lookAt(m: SigMoment): Pt {
  const c = eyeAt(m);
  if (!m.targets.length) return { x: 0, y: 0 };
  let x = 0, y = 0;
  for (const r of m.targets) { const p = centre(r); x += p.x - c.x; y += p.y - c.y; }
  x /= m.targets.length; y /= m.targets.length;
  const l = Math.hypot(x, y) || 1;
  return { x: (x / l) * m.size * 0.5, y: (y / l) * m.size * 0.5 };
}

/** A card it looks at, SEEN: an iris printed on it that closes down to lock
 *  on, its pupil dark on the card (on the dark layer, rimmed), a ring
 *  drawing in to it and the light round it pulled in. */
function seen(t: FxTools, r: Box, s: number, power: number) {
  const c = centre(r), k = Math.max(0.8, Math.min(1.3, power + 0.25));
  const D = 0.78;
  const shape = (u: number) => {
    const lock = easeOut(clamp01(u / 0.16));
    const close = clamp01((u - 0.72) / 0.28);
    return { R: s * 0.4 * k * (1.45 - 0.45 * lock) * (1 - 0.5 * close), pupil: 0.52 - 0.2 * lock, a: 1 - close };
  };
  t.draw(D, (g, u) => {
    const { R, pupil, a } = shape(u);
    g.circle(c.x, c.y, R * pupil).fill({ color: INK, alpha: 0.6 * a });
  }, { dark: true });
  t.draw(D, (g, u) => {
    const { R, pupil, a } = shape(u);
    iris(g, c, R, pupil, a);
  });
  t.ring(r, PALE, 1.5, 0.75, 0.3, 3);
  t.glow(r, PALE, 0.3, 0.45, 1.05);
  for (let i = 0; i < 10; i++) {
    const a = rand(0, TAU), d = s * rand(0.5, 0.75), life = rand(0.2, 0.3);
    t.spark(c.x + Math.cos(a) * d, c.y + Math.sin(a) * d, (-Math.cos(a) * d) / life, (-Math.sin(a) * d) / life, life, MOTE);
  }
}

export const SPINDLE: Signature = {
  shake: 1.2,
  // It does not come to you. It looks.
  lunge: false,

  deliver(t: FxTools, m: SigMoment, seconds: number) {
    const s = m.size, T = seconds, c = eyeAt(m), turn = lookAt(m), seed = rand(0, 100);
    // THE EYE OPENS over it: its lids parting, its iris darting about as it
    // opens and then settling, turned on the ones it chose; its legs coming
    // down round it.
    const state = (u: number): EyeState => {
      const time = u * T, settle = clamp01((u - 0.6) / 0.3);
      const dart = { x: Math.sin(time * 11 + seed) * s * 0.45, y: Math.cos(time * 8 + seed) * s * 0.2 };
      return { open: easeOut(clamp01((u - 0.08) / 0.62)), look: lerpPt(dart, turn, settle), pupil: 0.5 - 0.08 * settle, alpha: Math.min(1, u * 6) };
    };
    t.draw(T, (gd, u) => eyeDark(gd, c, s, state(u)), { dark: true });
    t.draw(T, (g, u) => {
      legs(g, c, s, clamp01(u / 0.7), 1);
      bigEye(g, c, s, state(u));
    });
    t.charge(c, s * 1.6, PALE, 0.35, T);
    // The light of the board drawn in to it.
    let acc = 0;
    t.draw(T, (_g, u, dt) => {
      if (u > 0.9) return;
      acc += dt * 60 * t.quality;
      for (; acc >= 1; acc--) {
        const a = rand(0, TAU), R = s * rand(0.9, 1.8), life = rand(0.2, 0.34);
        const x = c.x + Math.cos(a) * R, y = c.y + Math.sin(a) * R * 0.7;
        t.spark(x, y, (c.x - x) / life, (c.y - y) / life, life, MOTE);
      }
    });
  },

  land(t: FxTools, m: SigMoment) {
    const s = m.size, c = eyeAt(m), turn = lookAt(m), b = m.board;
    const n = m.targets.length;
    const END = SNAP * Math.max(0, n - 1) + HOLD + BLINK;
    // THE STARE: the eye held open — pupil tightening — then one blink, and
    // gone. (Handed no delivery, it opens here first, fast.)
    const fresh = n === 0;
    const blinkAt = (u: number) => clamp01((u * END - (END - BLINK)) / BLINK);
    const state = (u: number): EyeState => {
      const time = u * END, blink = blinkAt(u);
      return {
        open: (fresh ? easeOut(clamp01(time / 0.2)) : 1) * (1 - blink * blink), look: turn,
        pupil: 0.42 - 0.18 * easeOut(clamp01(time / 0.08)), alpha: 1 - 0.3 * blink,
      };
    };
    t.draw(END, (gd, u) => eyeDark(gd, c, s, state(u)), { dark: true });
    t.draw(END, (g, u) => {
      const blink = blinkAt(u);
      legs(g, c, s, 1, 1 - blink);
      bigEye(g, c, s, state(u));
      // Shut, a hairline of light, and then nothing.
      if (blink >= 1) g.moveTo(c.x - s * HALF, c.y).lineTo(c.x + s * HALF, c.y).stroke({ width: 2, color: WHITE, alpha: 0.8 });
    });
    t.flash(c, PALE, 0.45 * (s / 90));
    t.ring(m.from, SILVER, 0.6, 2.4, 0.5, 3);
    // Under its look the board goes still and dim.
    t.draw(END, (g, u) => {
      const a = Math.min(1, u * END * 10) * (1 - clamp01((u * END - (END - BLINK - 0.1)) / (BLINK + 0.1)));
      g.rect(b.x, b.y, b.w, b.h).fill({ color: INK, alpha: 0.22 * a });
    }, { dark: true });

    // THE LOOK: a cone of its gaze snapping across the board onto each of the
    // three, one after another, held while it stares.
    const pupilAt = { x: c.x + turn.x * 0.3, y: c.y + turn.y * 0.1 };
    m.targets.forEach((r, i) => {
      const q = centre(r), at = SNAP * i, D = END - at - BLINK * 0.5;
      const dx = q.x - pupilAt.x, dy = q.y - pupilAt.y, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len;
      const sweep = (i % 2 ? 1 : -1) * s * 0.9;
      t.draw(D, (g, u) => {
        const time = u * D, lock = easeOut(clamp01(time / 0.08));
        const end = { x: q.x + nx * sweep * (1 - lock), y: q.y + ny * sweep * (1 - lock) };
        const fade = time < D - 0.15 ? 1 : 1 - (time - (D - 0.15)) / 0.15;
        const ex = end.x - pupilAt.x, ey = end.y - pupilAt.y, el = Math.hypot(ex, ey) || 1, px = -ey / el, py = ex / el;
        const w0 = s * 0.06, w1 = s * 0.46;
        g.poly([pupilAt.x + px * w0, pupilAt.y + py * w0, end.x + px * w1, end.y + py * w1, end.x - px * w1, end.y - py * w1, pupilAt.x - px * w0, pupilAt.y - py * w0])
          .fill({ color: PALE, alpha: 0.1 * fade });
        for (const sd of [-1, 1])
          g.moveTo(pupilAt.x + px * w0 * sd, pupilAt.y + py * w0 * sd).lineTo(end.x + px * w1 * sd, end.y + py * w1 * sd).stroke({ width: 1.2, color: SILVER, alpha: 0.45 * fade });
        g.moveTo(pupilAt.x, pupilAt.y).lineTo(end.x, end.y).stroke({ width: 1.6, color: WHITE, alpha: 0.75 * fade });
      }, { delay: at });
      t.later(at + 0.08, () => seen(t, r, s, m.power[i] ?? 0.55));
    });
  },
};
