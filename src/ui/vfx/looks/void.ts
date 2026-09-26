/** VOID — the Void Tower's boss element, and the only one that is an ABSENCE
 *  rather than a substance. Every other element throws something outward;
 *  VOID takes (its aura steals a point off every strike it lands) and watches
 *  (every fourth blow against it is turned aside), so its look runs the other
 *  way: things are pulled IN, space tears open and seals, and an eye opens
 *  where it acts. Three shapes carry it, all drawn by hand here because none
 *  of the shared primitives is hollow:
 *   - the RIFT: a thin almond slit, pale at the lips, that tears open and
 *     snaps shut — white while it is a hairline, dark inside once it gapes;
 *   - the EYE: the same almond, fatter, with an iris — it opens, looks, blinks;
 *   - the HOLE: a black bead with a pale rim, which only ever shrinks.
 *  Pale silver on white, never purple (purple smoke is DUSK). Its darkness is
 *  real darkness (`dark: true`), kept small and brief so the card under it
 *  still reads. */
import type { Graphics } from "pixi.js";
import { centre, rand } from "./base";
import type { ElementLook, FxTools, Pt, SparkStyle } from "./types";

const WHITE = 0xffffff, PALE = 0xe3e7f1, SILVER = 0xc2c8d8, DIM = 0x8a92a8;
/** What the dark layer paints with: the board is near-black already, so only
 *  black reads as a hole in it. */
const INK = 0x000000;

/** Motes on their way IN. `drag: 1` keeps their speed exact, so a mote aimed
 *  at a point dies on it — shrinking and fading as it goes, swallowed. */
const MOTE: SparkStyle = { palette: [WHITE, PALE, SILVER, DIM], gravity: 0, drag: 1, size: [7, 1.5], streak: true };
const MOTE_SMALL: SparkStyle = { palette: [WHITE, PALE, SILVER], gravity: 0, drag: 1, size: [5, 1], streak: true };
/** A heal still has to read as a heal: the same inward pull, tinged living green. */
const MOTE_HEAL: SparkStyle = { palette: [WHITE, 0xe8fff0, 0xc6f0d6, 0x9fd8b8], gravity: 0, drag: 1, size: [8, 2], streak: true, swirl: 150 };
/** The field's slow inward drift, turning a little round the board's middle. */
const MOTE_DRIFT: SparkStyle = { palette: [WHITE, PALE, SILVER, DIM], gravity: 0, drag: 1, size: [6, 1.5], streak: true, swirl: 45 };

const voidClamp = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
/** 0..1 across [a, b]. */
const voidSeg = (x: number, a: number, b: number) => voidClamp((x - a) / (b - a));
const voidOut = (x: number) => 1 - (1 - x) * (1 - x);
const voidIn = (x: number) => x * x;
const voidHash = (i: number) => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
/** VOID stutters: now and then, for a frame or two, a shape slips sideways. */
const voidGlitch = (s: number, seed: number, chance: number, amp: number) => {
  const i = Math.floor(s * 24) + seed * 97;
  return voidHash(i) < chance ? (voidHash(i + 0.5) - 0.5) * 2 * amp : 0;
};

/** An almond through `c`: tips `half` either side along `ang`, lids bowed
 *  `open` px off the axis. The one shape VOID is built from — a rift is a thin
 *  one, an eye a fat one, and a sealed rift or a shut eye is the same shape at
 *  open = 0. */
function voidLens(g: Graphics, c: Pt, half: number, open: number, ang: number): Graphics {
  const ux = Math.cos(ang) * half, uy = Math.sin(ang) * half;
  const nx = -Math.sin(ang) * open * 2, ny = Math.cos(ang) * open * 2;
  return g.moveTo(c.x - ux, c.y - uy)
    .quadraticCurveTo(c.x + nx, c.y + ny, c.x + ux, c.y + uy)
    .quadraticCurveTo(c.x - nx, c.y - ny, c.x - ux, c.y - uy);
}

const VOID_N = 10;
/** The almond again, but TORN: a rift's lips are roughened, the roughness
 *  re-dealt a dozen times a second (`seed` changes) so the edges crackle —
 *  which is what tells a rift from an eye, whose lids are smooth. The rough
 *  grows as it gapes (capped, or a portal thrown wide reads as a rock) and
 *  vanishes at the tips. A fresh array each call: Pixi keeps the points until
 *  it renders. */
function voidTorn(g: Graphics, c: Pt, half: number, open: number, ang: number, seed: number): Graphics {
  const ux = Math.cos(ang), uy = Math.sin(ang);
  const amp = Math.min(4, 0.6 + open * 0.3);
  const pts: number[] = [];
  for (let side = 1; side >= -1; side -= 2)
    for (let j = 0; j <= VOID_N; j++) {
      const i = side > 0 ? j : VOID_N - j;
      if (side < 0 && (i === 0 || i === VOID_N)) continue; // the tips are shared
      const u = i / VOID_N, bow = 4 * u * (1 - u), a = (u - 0.5) * 2 * half;
      const off = side * (open * bow + (voidHash(seed + i + (side < 0 ? 50 : 0)) - 0.35) * amp * bow);
      pts.push(c.x + ux * a - uy * off, c.y + uy * a + ux * off);
    }
  return g.poly(pts, true);
}

/** The lens's pale lips: a soft halo under a hard line. */
function voidLips(g: Graphics, c: Pt, half: number, open: number, ang: number, alpha: number, width: number, color = PALE) {
  if (alpha <= 0.01 || half < 1) return;
  voidLens(g, c, half, open, ang).stroke({ width: width * 3, color, alpha: 0.22 * alpha, join: "round" });
  voidLens(g, c, half, open, ang).stroke({ width, color, alpha: 0.95 * alpha, join: "round" });
}

/** An eye's light: its lids and, once they part far enough, the iris
 *  (`look` px along the lids' axis). The pupil is dark — drawn by the caller
 *  on the dark layer. */
function voidEye(g: Graphics, c: Pt, half: number, lid: number, alpha: number, width: number, iris: number, look = 0) {
  voidLips(g, c, half, lid, 0, alpha, width);
  const ri = Math.min(iris, lid * 0.9);
  if (ri > 1.5) g.circle(c.x + look, c.y, ri).stroke({ width: Math.max(1.3, width * 0.75), color: WHITE, alpha: 0.9 * alpha });
}

/** Motes pulled INTO `c` from a ring `r0..r1` out, each arriving as it dies. */
function voidPull(t: FxTools, c: Pt, r0: number, r1: number, n: number, life: [number, number], style: SparkStyle = MOTE) {
  for (let i = 0; i < n; i++) {
    const a = rand(0, Math.PI * 2), r = rand(r0, r1), l = rand(life[0], life[1]);
    const ux = Math.cos(a), uy = Math.sin(a);
    t.spark(c.x + ux * r, c.y + uy * r, (-ux * r) / l, (-uy * r) / l, l, style, c);
  }
}

/** Motes pulled into a slit: born either side of it and drawn onto its line
 *  (and a little toward its middle), arriving as they die. */
function voidPullSlit(t: FxTools, c: Pt, half: number, ang: number, d0: number, d1: number, n: number, life: [number, number], style: SparkStyle = MOTE) {
  const ux = Math.cos(ang), uy = Math.sin(ang);
  for (let i = 0; i < n; i++) {
    const u = rand(-0.85, 0.85) * half, d = rand(d0, d1) * (Math.random() < 0.5 ? -1 : 1), l = rand(life[0], life[1]);
    const x = c.x + ux * u - uy * d, y = c.y + uy * u + ux * d;
    const tx = c.x + ux * u * 0.7, ty = c.y + uy * u * 0.7;
    t.spark(x, y, (tx - x) / l, (ty - y) / l, l, style, c);
  }
}

/** A rift's shape at `s` seconds: `half` its half-length, `open` how far the
 *  lips have parted (px), `shift` its centre slid along its axis (a tear
 *  running from one end), `glitch` a sideways slip of the lips this frame,
 *  `ink` how dark its inside is (defaults to `alpha`). */
interface VoidSlit { half: number; open: number; alpha: number; shift: number; glitch: number; ink: number }

/** A rift in space, shaped over time by `shape`: black inside once it gapes,
 *  pale at the lips, white down its middle while it is still a hairline. Two
 *  draws, one dark and one light, sharing one shape. */
function voidRift(t: FxTools, c: Pt, ang: number, seconds: number, shape: (s: number, o: VoidSlit) => void,
  opts?: { delay?: number; width?: number; ink?: number }) {
  const o: VoidSlit = { half: 0, open: 0, alpha: 0, shift: 0, glitch: 0, ink: -1 };
  const ux = Math.cos(ang), uy = Math.sin(ang);
  const at: Pt = { x: 0, y: 0 }, ghost: Pt = { x: 0, y: 0 };
  const base = Math.floor(rand(0, 1000)) * 131;
  let seed = 0;
  const read = (k: number) => {
    o.shift = 0; o.glitch = 0; o.ink = -1;
    const s = k * seconds;
    shape(s, o);
    at.x = c.x + ux * o.shift;
    at.y = c.y + uy * o.shift;
    seed = base + Math.floor(s * 12) * 23;
  };
  const width = opts?.width ?? 2;
  const ink = opts?.ink ?? 0.85;
  t.draw(seconds, (g, k) => {
    read(k);
    const a = o.ink < 0 ? o.alpha : o.ink;
    if (o.open > 0.8 && a > 0.01) voidTorn(g, at, o.half, o.open, ang, seed).fill({ color: INK, alpha: ink * Math.min(1, a) });
  }, { delay: opts?.delay, dark: true });
  t.draw(seconds, (g, k) => {
    read(k);
    if (o.alpha <= 0.01 || o.half < 1) return;
    if (o.glitch) {
      // The slip: a ghost of the lips a few px off, for a frame or two.
      ghost.x = at.x - uy * o.glitch;
      ghost.y = at.y + ux * o.glitch;
      voidTorn(g, ghost, o.half, o.open, ang, seed + 7).stroke({ width: 1.2, color: SILVER, alpha: 0.5 * o.alpha, join: "round" });
    }
    voidTorn(g, at, o.half, o.open, ang, seed).stroke({ width: width * 3, color: PALE, alpha: 0.22 * o.alpha, join: "round" });
    voidTorn(g, at, o.half, o.open, ang, seed).stroke({ width, color: PALE, alpha: 0.95 * o.alpha, join: "round" });
    // Light bleeding through the tear while it is thin; once it gapes, the
    // inside is nothing at all.
    const core = o.alpha * voidClamp(1 - o.open / 6);
    if (core > 0.02)
      g.moveTo(at.x - ux * o.half * 0.9, at.y - uy * o.half * 0.9).lineTo(at.x + ux * o.half * 0.9, at.y + uy * o.half * 0.9)
        .stroke({ width: 1.4, color: WHITE, alpha: core, cap: "round" });
  }, { delay: opts?.delay });
}

/** Along a thrown path, accelerating like the shared shots do. */
function voidAlong(a: Pt, b: Pt, k: number, out: Pt): Pt {
  const e = k * k;
  out.x = a.x + (b.x - a.x) * e;
  out.y = a.y + (b.y - a.y) * e;
  return out;
}

export const VOID: ElementLook = {
  // Pale silver, a shade brighter than the palette's silver so the basic X
  // still reads on a near-black board.
  markColor: 0xd8dde9,

  windUp(t, d) {
    const dur = d.wind + (d.T - d.wind) * 0.3;
    const S = d.size, c = d.at;
    if (!d.special) {
      // Space pinching in on the attacker: a ring closing to a dark bead —
      // the shot it is about to throw. A basic melee gets only a faint ring;
      // the lunge is its wind-up.
      const peak = d.melee ? 0.35 : 0.8;
      t.draw(dur, (g, k) => {
        g.circle(c.x, c.y, S * (0.5 - 0.38 * voidOut(k))).stroke({ width: 2, color: PALE, alpha: peak * Math.min(1, k * 3) });
      });
      if (!d.melee) {
        t.draw(dur, (g, k) => { g.circle(c.x, c.y, S * 0.07 * k).fill({ color: INK, alpha: 0.85 }); }, { dark: true });
        voidPull(t, c, S * 0.35, S * 0.55, 8, [dur * 0.6, dur], MOTE_SMALL);
      }
      return;
    }
    // A Special: an eye opens on the attacker and draws the dark in, then
    // blinks as it lets fly.
    const half = S * 0.44, lidMax = S * 0.2, iris = S * 0.1;
    const lid = (k: number) => lidMax * voidOut(voidSeg(k, 0, 0.45)) * (1 - voidSeg(k, 0.86, 1));
    t.draw(dur, (g, k) => voidEye(g, c, half, lid(k), Math.min(1, k * 4), 2.2, iris));
    t.draw(dur, (g, k) => {
      const r = Math.min(iris * 0.62, lid(k) * 0.6);
      if (r > 1) g.circle(c.x, c.y, r).fill({ color: INK, alpha: 0.9 });
    }, { dark: true });
    voidPull(t, c, S * 0.6, S * 0.95, 24, [0.16, dur], MOTE);
  },

  gather(t, d) {
    // The square is still empty, so a rift tears open on it, drinking in the
    // space around — and the strike comes out of it.
    const S = d.size, c = d.at, T = d.T;
    const openMax = S * (d.special ? 0.15 : 0.1), half = S * 0.42;
    voidRift(t, c, Math.PI / 2, T, (s, o) => {
      const k = s / T;
      o.half = half * voidOut(voidSeg(k, 0, 0.35));
      o.open = openMax * Math.pow(voidSeg(k, 0.15, 1), 1.4);
      o.alpha = Math.min(1, k * 5);
      o.glitch = voidGlitch(s, 1, 0.18, 4);
    });
    voidPullSlit(t, c, half, Math.PI / 2, S * 0.25, S * 0.6, d.special ? 32 : 20, [0.2, T]);
  },

  projectile(t, s) {
    // Not a ball of light: a HOLE — a black bead in a pale rim, swallowing
    // motes as it flies and leaving rings behind it that close up, the space
    // it passed through sealing. Now and then it stutters, a ghost of it a
    // few px off its line. A Special carries a flat disc of light round it,
    // the way a black hole does.
    const r = s.size * (s.special ? 0.15 : 0.095);
    const { from, to } = s;
    const len = Math.hypot(to.x - from.x, to.y - from.y) || 1;
    const nx = -(to.y - from.y) / len, ny = (to.x - from.x) / len;
    const gs = Math.floor(rand(0, 500));
    const pd: Pt = { x: 0, y: 0 };
    t.draw(s.seconds, (g, k) => {
      voidAlong(from, to, k, pd);
      g.circle(pd.x, pd.y, r * 0.8).fill({ color: INK, alpha: 0.9 * Math.min(1, k * 6) });
    }, { delay: s.delay, dark: true });
    const p: Pt = { x: 0, y: 0 }, q: Pt = { x: 0, y: 0 };
    let px = from.x, py = from.y, acc = 0;
    const rate = s.special ? 150 : 60;
    t.draw(s.seconds, (g, k, dt) => {
      voidAlong(from, to, k, p);
      const a = Math.min(1, k * 6);
      for (let i = 1; i <= 2; i++) {
        const kb = k - i * 0.14;
        if (kb <= 0) continue;
        voidAlong(from, to, kb, q);
        g.circle(q.x, q.y, r * (1 - i * 0.3)).stroke({ width: 1.5, color: SILVER, alpha: (0.5 * a) / i });
      }
      // Corona as a band OUTSIDE the rim, so the bead stays black.
      g.circle(p.x, p.y, r * 1.45).stroke({ width: r * 0.9, color: PALE, alpha: 0.13 * a });
      if (s.special) g.ellipse(p.x, p.y, r * 2.2, r * 0.5).stroke({ width: 1.6, color: PALE, alpha: 0.7 * a });
      const slip = voidGlitch(k * s.seconds, gs, 0.14, r * 1.2);
      if (slip) g.circle(p.x + nx * slip, p.y + ny * slip, r).stroke({ width: 1.3, color: SILVER, alpha: 0.55 * a });
      g.circle(p.x, p.y, r).stroke({ width: s.special ? 3 : 2.2, color: WHITE, alpha: 0.95 * a });
      // Motes swallowed on the way: born round the head, aimed where it will
      // be, so they close on it rather than trail off it.
      const vx = (p.x - px) / Math.max(dt, 1e-3), vy = (p.y - py) / Math.max(dt, 1e-3);
      px = p.x; py = p.y;
      acc += rate * dt;
      while (acc >= 1) {
        acc -= 1;
        const ang = rand(0, Math.PI * 2), dd = r * rand(2.2, 3.4), l = rand(0.1, 0.18);
        const ux = Math.cos(ang), uy = Math.sin(ang);
        t.spark(p.x + ux * dd, p.y + uy * dd, (-ux * dd) / l + vx, (-uy * dd) / l + vy, l, MOTE_SMALL);
      }
    }, { delay: s.delay });
  },

  swing(t, s) {
    // A tear chasing the lunge and zipping shut behind it. A basic one is a
    // hairline — it happens every turn; a Special's gapes black, with the
    // space either side pulled into it.
    const lag = s.special ? 0.5 : 0.3;
    const ang = Math.atan2(s.to.y - s.from.y, s.to.x - s.from.x);
    const ux = Math.cos(ang), uy = Math.sin(ang);
    const w = s.size * 0.07;
    const p: Pt = { x: 0, y: 0 }, q: Pt = { x: 0, y: 0 }, m: Pt = { x: 0, y: 0 };
    const span = (k: number) => {
      voidAlong(s.from, s.to, k, p);
      voidAlong(s.from, s.to, Math.max(0, k - lag), q);
      m.x = (p.x + q.x) / 2; m.y = (p.y + q.y) / 2;
      return Math.hypot(p.x - q.x, p.y - q.y) / 2;
    };
    let acc = 0;
    t.draw(s.seconds, (g, k, dt) => {
      const half = span(k);
      const a = Math.min(1, k * 5);
      if (!s.special) {
        if (half > 1) g.moveTo(q.x, q.y).lineTo(p.x, p.y).stroke({ width: 1.6, color: PALE, alpha: 0.5 * a, cap: "round" });
        g.circle(p.x, p.y, s.size * 0.05).stroke({ width: 1.5, color: WHITE, alpha: 0.7 * a });
        return;
      }
      if (half > 1) voidLips(g, m, half, w * Math.min(1, half / (s.size * 0.3)), ang, a, 2);
      g.circle(p.x, p.y, s.size * 0.08).stroke({ width: 2.2, color: WHITE, alpha: 0.9 * a });
      acc += 110 * dt;
      while (acc >= 1 && half > 4) {
        acc -= 1;
        const u = rand(-1, 1) * half, dd = rand(10, 22) * (Math.random() < 0.5 ? -1 : 1), l = rand(0.1, 0.16);
        const x = m.x + ux * u - uy * dd, y = m.y + uy * u + ux * dd;
        t.spark(x, y, (uy * dd) / l, (-ux * dd) / l, l, MOTE_SMALL);
      }
    }, { delay: s.delay });
    if (s.special)
      t.draw(s.seconds, (g, k) => {
        const half = span(k);
        if (half > 4) voidLens(g, m, half, w * Math.min(1, half / (s.size * 0.3)), ang).fill({ color: INK, alpha: 0.8 });
      }, { delay: s.delay, dark: true });
  },

  mark(t, m) {
    // A rift-cut: a hairline tears across the card, gapes black with the
    // space round it pulled in, then SNAPS shut — the lips flare, the seam
    // shrinks to nothing and a ring closes in on where it was. VOID leaves no
    // wound behind, only the absence of one.
    const { c, reach: R, across: ang, k } = m;
    const half = R * 0.92, openMax = R * (0.16 + 0.04 * Math.min(k, 2));
    const RUN = 0.07, SNAP = 0.27, SHUT = 0.32, END = 0.47;
    voidRift(t, c, ang, END, (s, o) => {
      const u = voidSeg(s, 0, RUN);
      o.half = half * (s < SHUT ? u : 1 - voidOut(voidSeg(s, SHUT, END)));
      o.shift = s < RUN ? -half * (1 - u) : 0;
      o.open = openMax * voidOut(voidSeg(s, RUN, RUN + 0.1)) * (1 - voidIn(voidSeg(s, SNAP, SHUT)));
      o.alpha = 1 - 0.5 * voidSeg(s, SHUT, END);
      o.glitch = s > RUN && s < SNAP ? voidGlitch(s, 2, 0.22, 4) : 0;
    }, { width: 2.6 });
    // The snap: a flare along the seam and a ring closing in.
    const ux = Math.cos(ang) * half, uy = Math.sin(ang) * half;
    t.draw(END - SNAP, (g, u) => {
      const f = 1 - voidSeg(u, 0, 0.5);
      if (f > 0) g.moveTo(c.x - ux * (1 - u), c.y - uy * (1 - u)).lineTo(c.x + ux * (1 - u), c.y + uy * (1 - u))
        .stroke({ width: 4, color: WHITE, alpha: 0.8 * f, cap: "round" });
      g.circle(c.x, c.y, R * 0.95 * (1 - voidIn(u)) + 1).stroke({ width: 2, color: PALE, alpha: 0.75 * (1 - 0.4 * u) });
    }, { delay: SNAP });
    voidPullSlit(t, c, half, ang, R * 0.3, R * 0.85, Math.round(26 * k), [0.18, 0.3]);
  },

  xSparks(t, c, count) {
    // Exactly `count`, and pulled IN to the X rather than thrown off it:
    // VOID takes from what it hits.
    voidPull(t, c, 14, 24, count, [0.14, 0.26], MOTE_SMALL);
  },

  arrive(t, r) {
    // The rift it gathered in throws wide and the card steps out of it: the
    // lips race out past the card's edges and fade, the dark draining off it
    // first so the card shows at once, and the space round it closes in.
    const c = centre(r), S = Math.min(r.w, r.h);
    voidRift(t, c, Math.PI / 2, 0.4, (s, o) => {
      const u = voidOut(voidSeg(s, 0, 0.16));
      o.half = S * (0.42 + 0.3 * u);
      o.open = S * (0.15 + 0.5 * u);
      o.alpha = 1 - voidSeg(s, 0.08, 0.4);
      o.ink = 1 - voidSeg(s, 0, 0.16);
      o.glitch = voidGlitch(s, 5, 0.25, 5);
    }, { width: 2.4 });
    t.glow(r, PALE, 0.3, 0.4, 1.05);
    voidPull(t, c, S * 0.6, S * 0.95, 22, [0.25, 0.45], MOTE);
  },

  impactAccent(t, at, k) {
    // The One Eye: it opens on the hit while the standard VOID burst draws
    // in, blinks shut as the burst goes — and once the flash has faded, the
    // hole the hit left seals, a black bead shrinking inside a closing rim.
    // Draws only, no sparks: this fires on every spell hit.
    const half = 14 + 11 * k, lidMax = half * 0.42, iris = half * 0.34, D = 0.72;
    const lid = (s: number) => lidMax * voidOut(voidSeg(s, 0.02, 0.14)) * (1 - voidSeg(s, 0.2, 0.26));
    const hole = (s: number) => (s < 0.38 ? 0 : half * 0.75 * Math.pow(1 - voidSeg(s, 0.38, D), 1.6));
    t.draw(D, (g, kk) => {
      const s = kk * D;
      if (s < 0.27) voidEye(g, at, half, lid(s), 1, 2, iris);
      const h = hole(s);
      if (h > 0.5) g.circle(at.x, at.y, h + 2).stroke({ width: 2, color: PALE, alpha: 0.8 });
    });
    t.draw(D, (g, kk) => {
      const s = kk * D;
      const pr = s < 0.27 ? Math.min(iris * 0.6, lid(s) * 0.6) : hole(s);
      if (pr > 0.8) g.circle(at.x, at.y, pr).fill({ color: INK, alpha: 0.85 });
    }, { dark: true });
  },

  shield(t, r) {
    // A ward that WATCHES: an eye opens round the card and focuses (its iris
    // tightening, rings drawn in onto it), motes slide along its lids, and it
    // blinks shut with a flare along the lash-line and a flick off each
    // corner — the blow it would turn aside.
    const c = centre(r), half = r.w * 0.66, lidMax = r.h * 0.44, iris = r.w * 0.16, D = 1.0;
    const lid = (s: number) => lidMax * voidOut(voidSeg(s, 0, 0.2)) * (1 - voidIn(voidSeg(s, 0.66, 0.78)));
    t.draw(D, (g, kk) => {
      const s = kk * D;
      const a = 1 - voidSeg(s, 0.8, D);
      const L = lid(s);
      voidEye(g, c, half, L, a, 2.4, iris * (1.35 - 0.35 * voidOut(voidSeg(s, 0.05, 0.4))));
      for (let i = 0; i < 2; i++) {
        const u = voidSeg(s, 0.12 + i * 0.24, 0.36 + i * 0.24);
        if (u > 0 && u < 1)
          g.circle(c.x, c.y, iris + (L * 0.95 - iris) * (1 - voidIn(u))).stroke({ width: 1.5, color: SILVER, alpha: 0.5 * (1 - u) });
      }
      const f = voidSeg(s, 0.7, 0.78) * (1 - voidSeg(s, 0.78, D));
      if (f > 0.01) g.moveTo(c.x - half, c.y).lineTo(c.x + half, c.y).stroke({ width: 3.5, color: WHITE, alpha: 0.9 * f, cap: "round" });
    });
    t.draw(D, (g, kk) => {
      const pr = Math.min(iris * 0.5, lid(kk * D) * 0.5);
      if (pr > 1) g.circle(c.x, c.y, pr).fill({ color: INK, alpha: 0.6 });
    }, { dark: true });
    // Motes riding the lids round, clockwise: along the top left to right,
    // back along the bottom — two waves, so the ward stays alive while it holds.
    const ride = () => {
      for (let i = 0; i < 14; i++) {
        const top = i % 2 === 0, u = rand(0.05, 0.9), l = rand(0.35, 0.55), v = rand(50, 85);
        const bow = (top ? -2 : 2) * lidMax;
        const x = c.x - half + 2 * half * u, y = c.y + 2 * u * (1 - u) * bow;
        const tx = 2 * half, ty = 2 * (1 - 2 * u) * bow, tl = Math.hypot(tx, ty) || 1;
        const dir = top ? 1 : -1;
        t.spark(x, y, (dir * tx * v) / tl, (dir * ty * v) / tl, l, MOTE);
      }
    };
    ride();
    t.later(0.35, ride);
    t.later(0.72, () => {
      for (let i = 0; i < 8; i++) {
        const side = i % 2 === 0 ? -1 : 1, v = rand(120, 220), a = rand(-0.25, 0.25);
        t.spark(c.x + side * half, c.y, side * v * Math.cos(a), v * Math.sin(a), rand(0.14, 0.24), MOTE_SMALL);
      }
    });
  },

  heal(t, r, k) {
    // VOID heals by TAKING: pale motes spiral in from all round into the
    // card, which brightens a living green as they arrive, and a ring closes
    // in on it.
    const kk = Math.max(0.7, Math.min(2.2, k));
    const c = centre(r), S = Math.min(r.w, r.h);
    voidPull(t, c, S * 0.7, S * 1.05, Math.round(34 * kk), [0.45, 0.85], MOTE_HEAL);
    t.glow(r, 0xcff3dc, 0.35, 0.9);
    t.draw(0.75, (g, kk2) => {
      g.circle(c.x, c.y, S * (0.78 - 0.5 * voidIn(kk2))).stroke({ width: 2, color: 0xd8f5e2, alpha: 0.6 * (1 - kk2) });
    });
  },

  wall(t, r) {
    // A row of rifts: the row dims, a tear opens down each square in turn,
    // the space either side drawn into them, and they snap shut together.
    const n = Math.max(1, Math.round(r.w / r.h)), cw = r.w / n;
    const half = r.h * 0.44, openMax = r.h * 0.1, D = 0.82, STAGGER = 0.07;
    t.draw(D + STAGGER * (n - 1), (g, k) => {
      const e = Math.min(1, k * 6) * (1 - voidSeg(k, 0.7, 1));
      g.rect(r.x, r.y, r.w, r.h).fill({ color: INK, alpha: 0.28 * e });
    }, { dark: true });
    for (let i = 0; i < n; i++) {
      const c = { x: r.x + cw * (i + 0.5), y: r.y + r.h / 2 };
      const delay = i * STAGGER;
      // They all shut on the same frame, however late each opened.
      const shut = 0.6 - delay;
      voidRift(t, c, Math.PI / 2, D - delay, (s, o) => {
        o.half = half * voidOut(voidSeg(s, 0, 0.1));
        o.open = openMax * voidOut(voidSeg(s, 0.06, 0.2)) * (1 - voidIn(voidSeg(s, shut, shut + 0.08)));
        o.alpha = 1 - voidSeg(s, shut + 0.08, D - delay);
        o.glitch = voidGlitch(s, i + 3, 0.15, 3);
      }, { delay, width: 2.2 });
      // Drawn in from the start, so the space bends before it tears.
      voidPullSlit(t, c, half, Math.PI / 2, r.h * 0.2, r.h * 0.5, 22, [0.25 + delay, 0.5 + delay]);
    }
  },

  field(t, r) {
    // The weather runs backwards: the board dims, pale motes drift INWARD,
    // turning slowly round a hole that opens at its middle and, as the light
    // comes back, closes to a point.
    const c = centre(r), D = 1.25, R0 = Math.min(r.w, r.h) * 0.08;
    t.draw(D, (g, k) => {
      const e = voidOut(voidSeg(k, 0, 0.2)) * (1 - voidSeg(k, 0.68, 1));
      g.rect(r.x, r.y, r.w, r.h).fill({ color: INK, alpha: 0.42 * e });
    }, { dark: true });
    const hole = (s: number) => R0 * voidOut(voidSeg(s, 0.05, 0.35)) * (1 - voidIn(voidSeg(s, 0.85, 1.15)));
    t.draw(D, (g, k) => {
      const h = hole(k * D);
      if (h > 0.8) g.circle(c.x, c.y, h).fill({ color: INK, alpha: 0.9 });
    }, { dark: true });
    t.draw(D, (g, k) => {
      const s = k * D, h = hole(s);
      if (h > 0.8) {
        g.circle(c.x, c.y, h * 1.5).stroke({ width: h * 0.8, color: PALE, alpha: 0.1 });
        g.ellipse(c.x, c.y, h * 2.3, h * 0.5).stroke({ width: 1.6, color: PALE, alpha: 0.6 });
        g.circle(c.x, c.y, h).stroke({ width: 2.4, color: WHITE, alpha: 0.9 });
      }
      const f = voidSeg(s, 1.1, 1.15) * (1 - voidSeg(s, 1.15, D));
      if (f > 0) g.circle(c.x, c.y, 3).fill({ color: WHITE, alpha: f });
    });
    const drift = () => {
      for (let i = 0; i < 110; i++) {
        const x = r.x + rand(-0.05, 1.05) * r.w, y = r.y + rand(-0.05, 1.05) * r.h, l = rand(0.7, 1.1);
        // Most of the way in, never all of it: a drift, not a rush.
        const f = rand(1.3, 2);
        t.spark(x, y, (c.x - x) / (l * f), (c.y - y) / (l * f), l, MOTE_DRIFT, c);
      }
    };
    drift();
    t.later(0.3, drift);
  },

  move(t, from, to) {
    // A blink: it folds into a point where it stood, flickers across the gap
    // rather than crossing it, and unfolds from a point where it lands.
    const a = centre(from), b = centre(to), S = Math.min(from.w, from.h);
    const OUT = 0.18;
    t.draw(0.24, (g, k) => {
      const s = k * 0.24, u = voidIn(voidSeg(s, 0, OUT));
      if (s < OUT) g.circle(a.x, a.y, S * 0.55 * (1 - u) + 1).stroke({ width: 2.4, color: PALE, alpha: 0.9 });
      const f = voidSeg(s, OUT - 0.03, OUT) * (1 - voidSeg(s, OUT, 0.24));
      if (f > 0) g.circle(a.x, a.y, 3.5).fill({ color: WHITE, alpha: f });
    });
    t.draw(OUT, (g, k) => {
      const rr = S * 0.34 * (1 - voidIn(k));
      if (rr > 1) g.circle(a.x, a.y, rr).fill({ color: INK, alpha: 0.6 });
    }, { dark: true });
    voidPull(t, a, S * 0.3, S * 0.6, 18, [0.12, 0.2], MOTE_SMALL);
    // The stutter between: two afterimages, a frame or two each.
    t.draw(0.12, (g, k) => {
      const p = k < 0.5 ? 1 / 3 : 2 / 3;
      g.circle(a.x + (b.x - a.x) * p, a.y + (b.y - a.y) * p, S * 0.1).stroke({ width: 1.6, color: SILVER, alpha: 0.6 });
    }, { delay: 0.12 });
    t.draw(0.4, (g, k) => {
      const s = k * 0.4, u = voidOut(voidSeg(s, 0, 0.16)), fade = 1 - voidSeg(s, 0.14, 0.4);
      const f = 1 - voidSeg(s, 0, 0.06);
      if (f > 0) g.circle(b.x, b.y, 3.5).fill({ color: WHITE, alpha: f });
      const slip = voidGlitch(s, 9, 0.3, 5);
      if (slip) g.circle(b.x + slip, b.y, S * 0.55 * u).stroke({ width: 1.3, color: SILVER, alpha: 0.5 * fade });
      g.circle(b.x, b.y, S * 0.55 * u + 1).stroke({ width: 2.4, color: PALE, alpha: 0.9 * fade });
    }, { delay: 0.22 });
  },

  trapSet(t, r) {
    // A watching eye: it opens on the square, glances one way and the other
    // (in snaps, not sweeps), shuts, and the shut line sinks into the square.
    const c = centre(r), half = r.w * 0.4, lidMax = r.h * 0.21, iris = r.w * 0.11, D = 1.0;
    const lid = (s: number) => lidMax * voidOut(voidSeg(s, 0, 0.2)) * (1 - voidIn(voidSeg(s, 0.55, 0.68)));
    const look = (s: number) => (s < 0.25 ? 0 : s < 0.38 ? -half * 0.32 : s < 0.5 ? half * 0.32 : 0);
    const len = (s: number) => half * (1 - voidIn(voidSeg(s, 0.7, 0.95)));
    t.draw(D, (g, kk) => {
      const s = kk * D;
      voidEye(g, c, len(s), lid(s), 1 - voidSeg(s, 0.85, D), 2.2, iris, look(s));
    });
    t.draw(D, (g, kk) => {
      const s = kk * D, pr = Math.min(iris * 0.6, lid(s) * 0.6);
      if (pr > 1) g.circle(c.x + look(s), c.y, pr).fill({ color: INK, alpha: 0.85 });
    }, { dark: true });
    voidPull(t, c, r.w * 0.45, r.w * 0.75, 18, [0.5, 0.75], MOTE_SMALL);
  },

  pulse(t, r) {
    // A seam torn the length of the row: it runs across, gapes, draws the
    // space above and below into it, and snaps shut.
    const c = centre(r), half = r.w * 0.48, openMax = r.h * 0.09, D = 0.8;
    voidRift(t, c, 0, D, (s, o) => {
      const u = voidSeg(s, 0, 0.14);
      o.half = half * u;
      o.shift = -half * (1 - u);
      o.open = openMax * voidOut(voidSeg(s, 0.12, 0.3)) * (1 - voidIn(voidSeg(s, 0.52, 0.6)));
      o.alpha = 1 - voidSeg(s, 0.6, D);
      o.glitch = voidGlitch(s, 7, 0.15, 3);
    }, { width: 2.2 });
    voidPullSlit(t, c, half, 0, r.h * 0.2, r.h * 0.55, 44, [0.25, 0.5]);
  },
};
