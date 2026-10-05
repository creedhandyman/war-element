/** RAVVEN — Night Stalk. "Gain +3 DMG for 3 rounds." Night Stalk then adds
 *  three to every shot.
 *
 *  Its art is a hooded archer with great black RAVEN wings, a full moon behind
 *  it, crows round it and a glowing violet arrow on the string. It aims at
 *  nothing, so there is no delivery: the LANDING is the whole move, and it is
 *  the hunter waking at nightfall. Shadow is drawn in to the card, and the
 *  wings SPREAD — two black fans of long feathers snapping open off its
 *  shoulders, each feather edged violet, the leading edge catching the light.
 *  Behind it a pale MOON rises clear of the card's head. The wings give one
 *  hard downbeat, and a FLOCK of crows bursts off the feather tips and wheels
 *  away into the dark, loose feathers rocking down after them. Then the arrow
 *  is nocked: a thin shaft of light across the card, a glint running along it
 *  from the fletching to the point, and the tip IGNITES — a violet arrowhead
 *  drawn longer and finer as it burns (the three it adds to every shot),
 *  violet flame streaming back off it.
 *
 *  The wings, the crows and the feathers are darkness drawn for real
 *  (`dark: true`), each with a violet rim so they read over an empty square;
 *  the moon and the arrow are the only light, kept off the dark shapes. */
import { centre, rand } from "../../looks/base";
import type { Graphics } from "pixi.js";
import type { FxTools, Pt, SparkStyle } from "../../looks/types";
import type { Signature, SigMoment } from "../types";

const TAU = Math.PI * 2;
const WHITE = 0xffffff, PALE = 0xf3e8ff, LILAC = 0xc9a6ff, VIOLET = 0x9a6ad8, PURPLE = 0x7b4fb0;
/** Raven black (dark layer only) and the moon's light. */
const INK = 0x0b0418, MOON = 0xe6e2ff, MOONGLOW = 0xb4acff;
/** Shadow drawn in to the card as the hunter wakes. */
const MOTE_IN: SparkStyle = { palette: [PALE, LILAC, VIOLET], gravity: 0, drag: 1, size: [6, 2], streak: true, swirl: 240 };
/** Violet flame streaming back off the lit arrowhead. */
const FLAME: SparkStyle = { palette: [WHITE, LILAC, VIOLET, PURPLE], gravity: -40, drag: 0.25, size: [5, 1], streak: true };

/** The wings: spread by OPEN, the downbeat at BEAT (lasting FLAP), folding
 *  and gone from FOLD to END. */
const OPEN = 0.26, BEAT = 0.34, FLAP = 0.16, FOLD = 0.78, END = 1.02;
/** The arrow: nocked at NOCK, the glint runs to the tip by LIT, gone by
 *  ARROW_END. */
const NOCK = 0.36, LIT = 0.6, ARROW_END = 1.1;

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeOut = (x: number) => 1 - (1 - x) * (1 - x);
/** Overshoots and settles: a wing snapping open. */
const snap = (x: number) => 1 + 2.7 * Math.pow(x - 1, 3) + 1.7 * Math.pow(x - 1, 2);
const dir = (a: number): Pt => ({ x: Math.cos(a), y: Math.sin(a) });

// ── The wings ────────────────────────────────────────────────────────────────

/** A long feather: pointed at the tip, a little full past its middle. */
function feather(b: Pt, ang: number, len: number, w: number): number[] {
  const d = dir(ang), n = { x: -d.y, y: d.x };
  const at = (f: number, off: number) => [b.x + d.x * len * f + n.x * off, b.y + d.y * len * f + n.y * off];
  return [...at(0, w * 0.4), ...at(0.6, w * 0.55), ...at(1, 0), ...at(0.6, -w * 0.5), ...at(0, -w * 0.4)];
}

/** One wing at `time`, `side` +1 for the right and -1 for the left: its arm
 *  from the shoulder out to the wrist, and a fan of feathers hung off it —
 *  the inner ones pointing down off the arm, the primaries out along it. Laid
 *  flat against the body while folded; the fan opens as the arm lifts. */
function wing(c: Pt, s: number, side: number, time: number) {
  const open = Math.max(0, snap(clamp01(time / OPEN)) - 0.3 * clamp01((time - FOLD) / (END - FOLD)));
  const beat = time > BEAT && time < BEAT + FLAP ? 0.55 * Math.sin((Math.PI * (time - BEAT)) / FLAP) : 0;
  const theta = 1.25 + (-0.72 - 1.25) * open + beat;
  // Laid out for the right wing, relative to the card's centre, then mirrored.
  const P = (x: number, y: number): Pt => ({ x: c.x + side * x, y: c.y + y });
  const S = { x: s * 0.1, y: -s * 0.12 }, L = s * 0.66, a = dir(theta);
  const feathers: number[][] = [], tips: Pt[] = [];
  const N = 8;
  for (let i = 0; i < N; i++) {
    const f = i / (N - 1), along = L * (0.15 + 0.85 * f);
    const base = { x: S.x + a.x * along, y: S.y + a.y * along };
    const delta = 0.15 + (1.45 - 1.3 * f) * clamp01(open);
    const len = s * (0.32 + 0.28 * f), phi = theta + delta, d = dir(phi);
    const pts = feather(base, phi, len, s * 0.1);
    const out: number[] = [];
    for (let k = 0; k < pts.length; k += 2) { const p = P(pts[k], pts[k + 1]); out.push(p.x, p.y); }
    feathers.push(out);
    tips.push(P(base.x + d.x * len, base.y + d.y * len));
  }
  const shoulder = P(S.x, S.y), wrist = P(S.x + a.x * L, S.y + a.y * L);
  // The coverts: the wing's body between the arm and the feathers, so the fan
  // reads as one wing and not loose blades.
  const body: number[] = [shoulder.x, shoulder.y, wrist.x, wrist.y];
  for (let i = N - 1; i >= 0; i--) {
    const fp = feathers[i];
    body.push(fp[0] + (fp[4] - fp[0]) * 0.5, fp[1] + (fp[5] - fp[1]) * 0.5);
  }
  return { feathers, tips, shoulder, wrist, body };
}

// ── The crows ────────────────────────────────────────────────────────────────

/** A crow seen from below as it flies, on `g` (the dark layer): a black
 *  silhouette — head, two swept wings bowed into an M, a fanned tail — its
 *  wingtips lifting and dropping with `flap`, `w` its half-span, and a violet
 *  edge so it reads as a bird on any square. */
function crow(g: Graphics, p: Pt, heading: number, w: number, flap: number, a: number) {
  if (a <= 0.01) return;
  const f = dir(heading), n = { x: -f.y, y: f.x };
  // One wing, from the shoulder along the leading edge to the tip and back
  // along the trailing edge, in (across, forward) units of `w`.
  const half = [[0.12, 0.22], [0.5, 0.36 - flap * 0.18], [1, -0.02 + flap * 0.5], [0.62, 0.04 - flap * 0.12], [0.3, -0.06], [0.12, -0.2], [0.13, -0.5]];
  const pts: number[] = [];
  const put = (x: number, y: number) => pts.push(p.x + n.x * w * x + f.x * w * y, p.y + n.y * w * x + f.y * w * y);
  put(0, 0.38);
  for (const [x, y] of half) put(x, y);
  for (let i = half.length - 1; i >= 0; i--) put(-half[i][0], half[i][1]);
  g.poly(pts, true).fill({ color: INK, alpha: a }).stroke({ width: 1.1, color: LILAC, alpha: 0.85 * a, join: "round" });
}

/** The flock bursting off the feather tips on the downbeat: each crow flies a
 *  wheeling arc (a circle of its own), outward and up, flapping, smaller and
 *  fainter as it goes. Each flies its own circle, worked out from the time
 *  alone. */
function flock(t: FxTools, c: Pt, s: number, from: Pt[], board: SigMoment["board"]) {
  const n = Math.max(4, Math.round(8 * t.quality));
  // Up and away where there is sky; out to the sides for a card on the top row.
  const lift = c.y - s * 1.6 > board.y ? 1.1 : 0.05;
  const crows = Array.from({ length: n }, (_, i) => {
    const p0 = from[i % from.length];
    const side = p0.x < c.x ? -1 : 1;
    const h0 = Math.atan2(p0.y - c.y - s * lift, p0.x - c.x) + rand(-0.35, 0.35);
    return {
      p0, h0,
      start: rand(0, 0.09), life: rand(0.5, 0.66),
      om: side * rand(1.4, 3.2) * (Math.random() < 0.25 ? -1 : 1),
      v: s * rand(1.3, 2.0), w: s * rand(0.15, 0.2), hz: rand(8, 12), ph: rand(0, TAU),
    };
  });
  const place = (k: (typeof crows)[number], age: number) => {
    const h = k.h0 + k.om * age;
    const x = k.p0.x + (k.v / k.om) * (Math.sin(h) - Math.sin(k.h0));
    const y = k.p0.y - (k.v / k.om) * (Math.cos(h) - Math.cos(k.h0));
    return { p: { x, y }, h };
  };
  const D = 0.8;
  t.draw(D, (g, u) => {
    const time = u * D;
    for (const k of crows) {
      const age = time - k.start;
      if (age <= 0 || age > k.life) continue;
      const q = age / k.life, { p, h } = place(k, age);
      const a = clamp01(age / 0.04) * (1 - clamp01((q - 0.6) / 0.4));
      // Drawn upright, as birds against a night sky are, only banking into
      // the turn: an M on its side reads as a scribble, not a crow.
      crow(g, p, -Math.PI / 2 + 0.45 * Math.cos(h), k.w * (1.15 - 0.45 * q), Math.sin(age * k.hz * TAU + k.ph), a);
    }
  }, { dark: true, delay: BEAT });
}

/** Loose feathers shaken off on the downbeat, rocking down as they fall. */
function looseFeathers(t: FxTools, s: number, from: Pt[]) {
  const n = Math.max(3, Math.round(5 * t.quality));
  const fs = Array.from({ length: n }, (_, i) => ({
    p: from[(i * 3 + 1) % from.length], vx: rand(-0.5, 0.5) * s, vy: rand(0.2, 0.45) * s, ph: rand(0, TAU), len: s * rand(0.13, 0.18),
  }));
  const D = 0.66;
  const shape = (f: (typeof fs)[number], time: number) => {
    const rock = 0.9 * Math.sin(time * 9 + f.ph);
    const b = { x: f.p.x + f.vx * time + Math.sin(time * 9 + f.ph) * s * 0.05, y: f.p.y + f.vy * time };
    return feather(b, Math.PI / 2 + rock, f.len, s * 0.045);
  };
  const fade = (u: number) => clamp01(u / 0.1) * (1 - clamp01((u - 0.55) / 0.45));
  t.draw(D, (g, u) => { for (const f of fs) g.poly(shape(f, u * D), true).fill({ color: INK, alpha: 0.85 * fade(u) }); }, { dark: true, delay: BEAT + 0.04 });
  t.draw(D, (g, u) => { for (const f of fs) g.poly(shape(f, u * D), true).stroke({ width: 1, color: VIOLET, alpha: 0.8 * fade(u) }); }, { delay: BEAT + 0.04 });
}

// ── The moon and the arrow ───────────────────────────────────────────────────

/** THE MOON rising behind its head: up out of the card to stand clear of it
 *  (kept on the board for a card on the top row), a pale disc with a soft
 *  halo and a bright limb. */
function moonRise(t: FxTools, c: Pt, s: number, board: SigMoment["board"]) {
  const R = s * 0.25, y0 = c.y - s * 0.1, y1 = Math.max(c.y - s * 0.55, board.y + R * 0.9);
  const D = 1.05;
  const at = (time: number) => ({
    y: y0 + (y1 - y0) * easeOut(clamp01((time - 0.05) / 0.5)),
    a: clamp01((time - 0.05) / 0.25) * (1 - clamp01((time - 0.82) / (D - 0.82))),
  });
  // Its seas, faint shadow on the dark layer under the disc, so it reads as
  // the moon and not a lamp.
  t.draw(D, (g, u) => {
    const { y, a } = at(u * D);
    if (a <= 0.01) return;
    g.ellipse(c.x + R * 0.22, y - R * 0.22, R * 0.34, R * 0.24).ellipse(c.x - R * 0.3, y + R * 0.25, R * 0.26, R * 0.18)
      .fill({ color: INK, alpha: 0.32 * a });
  }, { dark: true });
  t.draw(D, (g, u) => {
    const { y, a } = at(u * D);
    if (a <= 0.01) return;
    g.circle(c.x, y, R * 1.55).stroke({ width: R * 0.9, color: MOONGLOW, alpha: 0.12 * a });
    g.circle(c.x, y, R).fill({ color: MOON, alpha: 0.3 * a });
    g.circle(c.x, y, R).stroke({ width: Math.max(1.2, s * 0.018), color: PALE, alpha: 0.85 * a });
  });
}

/** A four-point glint. */
function glint(g: Graphics, x: number, y: number, r: number, rot: number, color: number, alpha: number) {
  if (alpha <= 0.01 || r < 0.5) return;
  const pts: number[] = [];
  for (let i = 0; i < 8; i++) {
    const a = rot + (i * Math.PI) / 4, d = i % 2 ? r * 0.16 : r;
    pts.push(x + Math.cos(a) * d, y + Math.sin(a) * d);
  }
  g.poly(pts).fill({ color, alpha });
}

/** THE ARROW: a shaft of light laid across the card toward the enemy (tilted
 *  as it is drawn on the string), fletching at the nock; a glint runs up it,
 *  and the point ignites — a violet head drawn longer and finer as it burns,
 *  a star on its tip and flame streaming back off it. */
function arrow(t: FxTools, c: Pt, s: number, ahead: Pt) {
  const ang = Math.atan2(ahead.y, ahead.x) + 0.6, d = dir(ang), n = { x: -d.y, y: d.x };
  const nock = { x: c.x - d.x * s * 0.36, y: c.y - d.y * s * 0.36 }, tip = { x: c.x + d.x * s * 0.3, y: c.y + d.y * s * 0.3 };
  const D = ARROW_END - NOCK;
  t.draw(D, (g, u) => {
    const time = NOCK + u * D, drawn = easeOut(clamp01((time - NOCK) / 0.1));
    const a = 1 - clamp01((time - 0.92) / (ARROW_END - 0.92));
    const hx = nock.x + (tip.x - nock.x) * drawn, hy = nock.y + (tip.y - nock.y) * drawn;
    g.moveTo(nock.x, nock.y).lineTo(hx, hy).stroke({ width: Math.max(3, s * 0.05), color: VIOLET, alpha: 0.22 * a, cap: "round" })
      .moveTo(nock.x, nock.y).lineTo(hx, hy).stroke({ width: Math.max(1.2, s * 0.016), color: PALE, alpha: 0.8 * a, cap: "round" });
    // The fletching: two short vanes back off the nock.
    for (const sd of [-1, 1]) {
      g.moveTo(nock.x + d.x * s * 0.1, nock.y + d.y * s * 0.1)
        .lineTo(nock.x - d.x * s * 0.02 + n.x * sd * s * 0.06, nock.y - d.y * s * 0.02 + n.y * sd * s * 0.06);
    }
    g.stroke({ width: Math.max(1, s * 0.014), color: LILAC, alpha: 0.75 * a * drawn });
    // The glint running up the shaft to the point.
    const run = clamp01((time - (NOCK + 0.08)) / (LIT - NOCK - 0.08));
    if (run > 0 && run < 1) {
      const gx = nock.x + (tip.x - nock.x) * run, gy = nock.y + (tip.y - nock.y) * run;
      g.circle(gx, gy, s * 0.05).fill({ color: LILAC, alpha: 0.3 });
      glint(g, gx, gy, s * 0.1, ang, WHITE, 0.95);
    }
    // The head, lit: longer and finer as it sharpens.
    const lit = clamp01((time - LIT) / 0.05);
    if (lit > 0) {
      const sharp = easeOut(clamp01((time - LIT) / 0.22));
      const len = s * (0.09 + 0.12 * sharp), w = s * (0.07 - 0.025 * sharp);
      const pt = { x: tip.x + d.x * len, y: tip.y + d.y * len };
      const head = [tip.x + n.x * w, tip.y + n.y * w, pt.x, pt.y, tip.x - n.x * w, tip.y - n.y * w, tip.x + d.x * len * 0.2, tip.y + d.y * len * 0.2];
      g.circle(tip.x + d.x * len * 0.4, tip.y + d.y * len * 0.4, len * 0.9).fill({ color: PURPLE, alpha: 0.2 * a * lit });
      g.poly(head, true).fill({ color: VIOLET, alpha: 0.9 * a * lit }).stroke({ width: 1.2, color: PALE, alpha: 0.95 * a * lit, join: "miter" });
      const pulse = 1 + 0.25 * Math.sin(time * 30);
      glint(g, pt.x, pt.y, s * (0.1 + 0.12 * Math.exp(-(time - LIT) / 0.08)) * pulse, ang + Math.PI / 4, WHITE, 0.95 * a * lit);
    }
  }, { delay: NOCK });
  t.later(LIT, () => {
    t.flash({ x: tip.x + d.x * s * 0.1, y: tip.y + d.y * s * 0.1 }, VIOLET, 0.4 * (s / 80));
    // Flame streaming back off the head as it burns.
    let acc = 0;
    t.draw(0.42, (_g, _u, dt) => {
      acc += dt * 70 * t.quality;
      for (; acc >= 1; acc--) {
        const a = ang + Math.PI + rand(-0.35, 0.35), v = rand(50, 120) * (s / 90), off = rand(0, s * 0.12);
        t.spark(tip.x + d.x * off, tip.y + d.y * off, Math.cos(a) * v, Math.sin(a) * v, rand(0.18, 0.3), FLAME);
      }
    });
  });
}

export const RAVVEN: Signature = {
  // A hunter rising, not a blow.
  shake: 0.25,
  lunge: false,

  // It aims at nothing: there is no delivery, the landing is the whole move.
  land(t: FxTools, m: SigMoment) {
    const c = centre(m.from), s = m.size;
    // Shadow drawn in to the card as it wakes.
    const motes = Math.round(12 * t.quality);
    for (let i = 0; i < motes; i++) {
      const a = rand(0, TAU), r = s * rand(0.55, 0.8), l = rand(0.16, 0.24), v = r / l;
      t.spark(c.x + Math.cos(a) * r, c.y + Math.sin(a) * r, (-Math.cos(a) - Math.sin(a) * 0.4) * v, (-Math.sin(a) + Math.cos(a) * 0.4) * v, l, MOTE_IN, c);
    }
    moonRise(t, c, s, m.board);

    // THE WINGS: dark fans, and their violet edges.
    const both = (time: number) => [wing(c, s, 1, time), wing(c, s, -1, time)];
    const alive = (time: number) => clamp01(time / 0.05) * (1 - clamp01((time - FOLD - 0.08) / (END - FOLD - 0.08)));
    t.draw(END, (g, u) => {
      const time = u * END, a = alive(time);
      for (const w of both(time)) {
        g.poly(w.body, true).fill({ color: INK, alpha: 0.9 * a });
        for (const f of w.feathers) g.poly(f, true).fill({ color: INK, alpha: 0.9 * a });
      }
    }, { dark: true });
    t.draw(END, (g, u) => {
      const time = u * END, a = alive(time);
      for (const w of both(time)) {
        for (const f of w.feathers) g.poly(f, true).stroke({ width: 1, color: VIOLET, alpha: 0.6 * a, join: "round" });
        g.moveTo(w.shoulder.x, w.shoulder.y).lineTo(w.wrist.x, w.wrist.y)
          .stroke({ width: Math.max(1.5, s * 0.022), color: PALE, alpha: 0.75 * a, cap: "round" });
      }
    });

    // THE DOWNBEAT: the flock bursts off the feather tips, feathers shaken
    // loose.
    const tips = both(BEAT + FLAP * 0.5).flatMap((w) => w.tips.slice(3));
    flock(t, c, s, tips, m.board);
    looseFeathers(t, s, tips);

    arrow(t, c, s, m.ahead);
  },
};
