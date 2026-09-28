/** PERMAFROST — Whiteout. "FREEZE every opponent at 6 HP or less for 2 rounds,
 *  and every ally gains +2 shields." The wall was here before the war, and it
 *  has heard your plan to crack it.
 *
 *  Permafrost on its art is a giant of ice and frozen hair standing in a
 *  blizzard. Its Special is that blizzard let go. The DELIVERY (when there is
 *  anyone weak enough to freeze) is the wall drawing breath: snow and white
 *  breath drawn in round it, rime closing on its square, the cold glowing in
 *  it. The LANDING is the WHITEOUT: a squall of white rolls off the wall and
 *  across the whole board, a billowing front with driven snow streaming ahead
 *  of it and a white veil left behind it, thick enough to lose the board in
 *  for a moment and gone again. Where it passes a weak card, the card is
 *  LOCKED IN ICE — a faceted block of it closing round the card, frost
 *  forming at its corners, splinters thrown off. Its allies on the wall get a
 *  hard frost glaze: a sheet of ice sliding over each, rimed at the corners.
 *  With no one weak enough, the blizzard still comes, and the allies are
 *  still plated — the move is the weather.
 *
 *  White is the whole point, and a white-out over a card is the one thing a
 *  landing must not be: the veil stays thin and brief, the snow is small, and
 *  the ice blocks are glass — lines and a pale fill — so every card reads
 *  through the storm. */
import { centre, rand } from "../looks/base";
import type { Graphics } from "pixi.js";
import type { FxTools, Pt, SparkStyle } from "../looks/types";
import type { Signature, SigMoment } from "./types";

type Box = { x: number; y: number; w: number; h: number };

const TAU = Math.PI * 2;
const WHITE = 0xffffff, SNOW = 0xf4f9ff, FROST = 0xe6f8ff, ICE = 0x9fe3ff, STEEL = 0xb8cfe0;
/** Driven snow: small, fast, streaked along the wind. */
const DRIFT: SparkStyle = { palette: [WHITE, SNOW, STEEL], gravity: 0, drag: 0.85, size: [5, 1.5], streak: true };
/** The body of the squall: soft, swelling puffs of white. */
const SQUALL: SparkStyle = { palette: [WHITE, SNOW, 0xd8e6f2], gravity: 0, drag: 0.6, size: [16, 36], streak: false };
/** Snow drawn in to the wall as it breathes. */
const INTAKE: SparkStyle = { palette: [SNOW, FROST, WHITE], gravity: 0, drag: 1, size: [4, 2.5], streak: false, swirl: 180 };
/** Splinters off ice locking round a card. */
const SHARD: SparkStyle = { palette: [WHITE, FROST, ICE, 0x6ea8e0], gravity: 520, drag: 0.6, size: [7, 2], streak: true };

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeOut = (x: number) => 1 - (1 - x) * (1 - x);
/** 0 -> 1 as `x` runs from `a` to `b`. */
const span = (x: number, a: number, b: number) => clamp01((x - a) / (b - a));

/** A glow sized to the board's squares (`flash` is sized in px). */
function flare(t: FxTools, p: Pt, size: number, color: number, peak: number, seconds: number) {
  t.glow({ x: p.x - size / 2, y: p.y - size / 2, w: size, h: size }, color, peak, seconds, 1);
}

/** A snowflake: six arms, each with a pair of side branches. */
function snowflake(g: Graphics, c: Pt, r: number, rot: number, alpha: number, width = 1.4) {
  if (r < 1 || alpha <= 0.01) return;
  for (let i = 0; i < 6; i++) {
    const a = rot + (i / 6) * TAU, ux = Math.cos(a), uy = Math.sin(a), bx = c.x + ux * r * 0.55, by = c.y + uy * r * 0.55, b = r * 0.3;
    g.moveTo(c.x, c.y).lineTo(c.x + ux * r, c.y + uy * r);
    for (const sd of [-1, 1]) g.moveTo(bx, by).lineTo(bx + Math.cos(a + sd * Math.PI / 3) * b, by + Math.sin(a + sd * Math.PI / 3) * b);
  }
  g.stroke({ width, color: FROST, alpha, cap: "round" });
}

/** A block of ice's outline round a card, in squares from its middle — chunky
 *  and a little crooked, not a neat box — and the point its facets meet. */
const BLOCK = [-0.47, -0.48, 0.08, -0.55, 0.5, -0.4, 0.55, 0.14, 0.41, 0.53, -0.18, 0.55, -0.53, 0.36, -0.55, -0.1];
const HEART = [0.08, -0.06];

/** LOCKED IN ICE: the block closing round a card from its middle out, glassy,
 *  bright at its edges, faceted within, frost forming at its corners. */
function iceBlock(t: FxTools, r: Box, delay: number, hold: number) {
  const c = centre(r), s = Math.min(r.w, r.h), v = s / 90, rot = rand(0, TAU), D = hold;
  t.draw(D, (g, u) => {
    const time = u * D, grow = easeOut(span(time, 0, 0.14)), a = 1 - span(time, D - 0.35, D);
    const k = 0.6 + 0.4 * grow, pts: number[] = [];
    for (let i = 0; i < BLOCK.length; i += 2) pts.push(c.x + BLOCK[i] * s * k, c.y + BLOCK[i + 1] * s * k);
    g.poly(pts, true).stroke({ width: 7, color: ICE, alpha: 0.22 * a });
    g.poly(pts, true).fill({ color: ICE, alpha: 0.2 * a }).stroke({ width: 2, color: WHITE, alpha: 0.9 * a });
    // Its facets, meeting inside it.
    const hx = c.x + HEART[0] * s * k, hy = c.y + HEART[1] * s * k;
    for (let i = 0; i < BLOCK.length; i += 4) g.moveTo(pts[i], pts[i + 1]).lineTo(hx, hy);
    g.stroke({ width: 1.1, color: FROST, alpha: 0.55 * a });
    // A glint running along its top edge as it seals.
    const gl = span(time, 0.1, 0.4);
    if (gl > 0 && gl < 1) {
      const x = pts[0] + (pts[4] - pts[0]) * gl, y = pts[1] + (pts[5] - pts[1]) * gl;
      g.circle(x, y, s * 0.05).fill({ color: WHITE, alpha: (1 - gl) * a });
    }
    // Frost forming at three of its corners.
    for (const i of [0, 6, 12]) snowflake(g, { x: pts[i], y: pts[i + 1] }, s * 0.11 * grow, rot + i, 0.85 * a);
  }, { delay });
  t.later(delay, () => {
    flare(t, c, s * 1.2, FROST, 0.5, 0.25);
    for (let i = 0; i < 12; i++) {
      const a = rand(0, TAU), sp = rand(90, 220) * v;
      t.spark(c.x + Math.cos(a) * s * 0.4, c.y + Math.sin(a) * s * 0.4, Math.cos(a) * sp, Math.sin(a) * sp - 60 * v, rand(0.35, 0.6), SHARD);
    }
  });
}

/** A HARD FROST GLAZE on an ally: a sheet of ice sliding over the card, a
 *  frame of frost locking round it, rime at its corners. */
function glaze(t: FxTools, r: Box, delay: number) {
  const c = centre(r), s = Math.min(r.w, r.h), h = s * 0.47, D = 0.9, rot = rand(0, TAU);
  t.draw(D, (g, u) => {
    const time = u * D, a = 1 - span(time, 0.5, D), frame = easeOut(span(time, 0, 0.18));
    // The sheen: a band of light sliding corner to corner.
    const sw = span(time, 0.05, 0.4);
    if (sw > 0 && sw < 1) {
      const x = c.x - h * 1.6 + h * 3.2 * sw, w = s * 0.16;
      const pts = [x - w, c.y - h, x + w, c.y - h, x + w - h * 0.6, c.y + h, x - w - h * 0.6, c.y + h];
      const cl = pts.map((p, i) => (i % 2 ? p : Math.max(c.x - h, Math.min(c.x + h, p))));
      g.poly(cl, true).fill({ color: WHITE, alpha: 0.32 * Math.sin(Math.PI * sw) * a });
    }
    const k = h * (1.25 - 0.25 * frame);
    g.roundRect(c.x - k, c.y - k, k * 2, k * 2, s * 0.08).stroke({ width: 6, color: ICE, alpha: 0.2 * frame * a });
    g.roundRect(c.x - k, c.y - k, k * 2, k * 2, s * 0.08).fill({ color: FROST, alpha: 0.07 * frame * a }).stroke({ width: 1.8, color: FROST, alpha: 0.85 * frame * a });
    for (const [dx, dy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) snowflake(g, { x: c.x + dx * k, y: c.y + dy * k }, s * 0.1 * frame, rot + dx + dy, 0.8 * a, 1.2);
  }, { delay });
}

export const PERMAFROST: Signature = {
  shake: 1.3,
  // The wall does not move. The weather does.
  lunge: false,

  deliver(t: FxTools, m: SigMoment, seconds: number) {
    const s = m.size, c = centre(m.from), T = seconds;
    // Snow and white breath drawn in round it, turning...
    let acc = 0;
    t.draw(T, (_g, _u, dt) => {
      acc += 70 * dt;
      for (; acc >= 1; acc--) {
        const a = rand(0, TAU), r = s * rand(0.6, 1.0), life = rand(0.25, 0.4), sp = r / life;
        t.spark(c.x + Math.cos(a) * r, c.y + Math.sin(a) * r, (-Math.cos(a) - Math.sin(a) * 0.5) * sp, (-Math.sin(a) + Math.cos(a) * 0.5) * sp, life, INTAKE, c);
      }
    });
    // ...rime closing on its square, and the cold glowing in it.
    t.draw(T, (g, u) => {
      const k = easeOut(u), r = s * (0.95 - 0.35 * k), rot = u * 0.8;
      const hex: number[] = [];
      for (let i = 0; i < 6; i++) hex.push(c.x + Math.cos(rot + (i * TAU) / 6) * r, c.y + Math.sin(rot + (i * TAU) / 6) * r);
      g.poly(hex, true).stroke({ width: 6, color: ICE, alpha: 0.18 * k }).poly(hex, true).stroke({ width: 1.6, color: FROST, alpha: 0.7 * k });
      for (let i = 0; i < 6; i++) snowflake(g, { x: hex[i * 2], y: hex[i * 2 + 1] }, s * 0.08 * k, rot * 3 + i, 0.7 * k);
    });
    t.charge(c, s * 1.5, FROST, 0.55, T);
  },

  land(t: FxTools, m: SigMoment) {
    const s = m.size, c = centre(m.from), v = s / 90, seed = rand(0, 100);
    const ax = m.ahead.x, ay = m.ahead.y, cx = -ay, cy = ax;
    // The board in the wind's own terms: how far it runs ahead of the wall,
    // and how wide it is across.
    const b = m.board, corners = [[b.x, b.y], [b.x + b.w, b.y], [b.x, b.y + b.h], [b.x + b.w, b.y + b.h]];
    const along = (x: number, y: number) => (x - c.x) * ax + (y - c.y) * ay, across = (x: number, y: number) => (x - c.x) * cx + (y - c.y) * cy;
    const aMax = Math.max(...corners.map(([x, y]) => along(x, y))) + s * 0.3;
    const xMin = Math.min(...corners.map(([x, y]) => across(x, y))), xMax = Math.max(...corners.map(([x, y]) => across(x, y)));
    const a0 = -s * 0.35, RUN = 0.62, D = 1.3;
    const front = (time: number) => a0 + (aMax - a0) * easeOut(clamp01(time / RUN));
    const P = (al: number, ac: number): Pt => ({ x: c.x + ax * al + cx * ac, y: c.y + ay * al + cy * ac });

    // THE WHITEOUT, let go: a flash off the wall...
    flare(t, c, s * 2, WHITE, 0.45, 0.35);
    // ...the veil it leaves over everything behind its front, thin and brief...
    t.draw(D, (g, u) => {
      const time = u * D, F = front(time), a = 0.12 * span(time, 0, 0.1) * (1 - span(time, 0.6, 1.2));
      if (a <= 0.005) return;
      const p = [P(a0, xMin), P(F, xMin), P(F, xMax), P(a0, xMax)];
      g.poly([p[0].x, p[0].y, p[1].x, p[1].y, p[2].x, p[2].y, p[3].x, p[3].y], true).fill({ color: SNOW, alpha: a });
    });
    // ...and its FRONT: a billowing wall of white running the width of the
    // board, a bright torn edge leading it.
    const nb = Math.max(6, Math.round((xMax - xMin) / (s * 0.14)));
    const billows = Array.from({ length: nb }, (_, i) => ({
      x: xMin + ((i + rand(0.2, 0.8)) / nb) * (xMax - xMin), r: rand(0.18, 0.42), ph: rand(0, TAU), off: rand(-0.24, 0.08),
    }));
    t.draw(RUN + 0.3, (g, u) => {
      const time = u * (RUN + 0.3), F = front(time), a = 1 - span(time, RUN * 0.8, RUN + 0.3);
      if (a <= 0.01) return;
      for (const bl of billows) {
        const p = P(F + (bl.off + 0.04 * Math.sin(time * 9 + bl.ph)) * s - s * 0.1, bl.x);
        g.circle(p.x, p.y, s * bl.r * (1 + 0.12 * Math.sin(time * 7 + bl.ph)));
      }
      g.fill({ color: SNOW, alpha: 0.085 * a });
      const edge: number[] = [];
      for (let i = 0; i <= 28; i++) {
        const ac = xMin + ((xMax - xMin) * i) / 28, p = P(F + s * (0.2 + 0.07 * Math.sin(ac * 0.07 + time * 16 + seed)), ac);
        edge.push(p.x, p.y);
      }
      g.moveTo(edge[0], edge[1]);
      for (let i = 2; i < edge.length; i += 2) g.lineTo(edge[i], edge[i + 1]);
      g.stroke({ width: 9, color: FROST, alpha: 0.18 * a, join: "round" });
      g.moveTo(edge[0], edge[1]);
      for (let i = 2; i < edge.length; i += 2) g.lineTo(edge[i], edge[i + 1]);
      g.stroke({ width: 2.4, color: WHITE, alpha: 0.7 * a, join: "round" });
    });
    // Driven snow streaming ahead of the front and through the veil, slanted
    // on the wind — and puffs of the squall rolling off its front.
    const slant = Math.random() < 0.5 ? -1 : 1;
    let snow = 0, puff = 0;
    t.draw(1.0, (_g, u, dt) => {
      const time = u * 1.0, F = front(time), rate = 1 - span(time, 0.6, 1.0);
      snow += 170 * rate * dt;
      for (; snow >= 1; snow--) {
        const p = P(rand(a0, F + s * 0.3), rand(xMin, xMax)), sp = rand(380, 620) * v;
        t.spark(p.x, p.y, (ax + cx * slant * 0.35) * sp, (ay + cy * slant * 0.35) * sp, rand(0.16, 0.3), DRIFT);
      }
      if (time < RUN) {
        puff += 70 * dt;
        for (; puff >= 1; puff--) {
          const p = P(F, rand(xMin, xMax)), sp = rand(60, 140) * v;
          t.spark(p.x, p.y, (ax + cx * slant * 0.3) * sp, (ay + cy * slant * 0.3) * sp, rand(0.35, 0.55), SQUALL);
        }
      }
    });

    // Where it passes a weak card, the card is locked in ice...
    m.targets.forEach((r) => {
      const p = centre(r), f = clamp01((along(p.x, p.y) - a0) / (aMax - a0)), when = RUN * (1 - Math.sqrt(1 - f));
      iceBlock(t, r, when, D - when);
    });
    // ...and its allies on the wall are glazed as it leaves them.
    m.allies.forEach((r, i) => glaze(t, r, 0.04 + 0.05 * i));
  },
};
