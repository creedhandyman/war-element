/** BORE — stone and earth.
 *
 *  Told apart by WEIGHT. Everything BORE throws or raises is SOLID: rock drawn
 *  as rock — a mid-tone body, a lit face, a shadowed face, a dark edge — on
 *  the normal-blend layer, where colour is colour and not light (additive
 *  light cannot draw a brown stone; it drew BORE as glowing dots). And
 *  everything it does lands HEAVY: cracks run through the ground, chunks fly
 *  and fall and bounce, dust rolls out low along the floor instead of rising.
 *  Light is only the grit glinting off it. Its aura is plating (Exostone), so
 *  its shield is its signature: slabs of stone slamming onto the card. */
import type { Graphics } from "pixi.js";
import { centre, rand } from "./base";
import type { ElementLook, FxTools, Pt, SparkStyle } from "./types";

// Solid rock, on the normal-blend layer: real colour.
const ROCK = 0x8a7461, ROCK_HI = 0xcfb592, ROCK_LO = 0x4e3e31, EDGE = 0x241a13;
const CRACK = 0x0e0906;
const DUST = 0xb89e80;
// Light, additive: grit, glints, the lit lip of a crack.
const SAND = [0xfff1dc, 0xe8cfa8, 0xd9b48a, 0xa1887f];
const LIT = 0xd9bf98;
/** The basic X, in the colour of broken sandstone. */
const MARK = 0xe0c49a;

const TAU = Math.PI * 2;
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeOut = (x: number) => 1 - (1 - x) * (1 - x);

/** Grit: small, heavy, falling — stone does not float. */
const GRIT: SparkStyle = { palette: SAND, gravity: 950, drag: 0.6, size: [5, 2], streak: false };
/** Chips knocked off a blow: fast little streaks that drop. */
const CHIP: SparkStyle = { palette: [0xfff1dc, 0xd9b48a], gravity: 1100, drag: 0.5, size: [4, 2], streak: true };

// ── Rock ─────────────────────────────────────────────────────────────────────

/** A rock's outline: corners at uneven angles and radii, [angle, radius]
 *  pairs — every rock its own. */
function boreRock(corners = 7): number[] {
  const out: number[] = [];
  const a0 = rand(0, TAU);
  for (let i = 0; i < corners; i++) out.push(a0 + (i / corners) * TAU + rand(-0.25, 0.25), rand(0.72, 1));
  return out;
}

/** The outline scaled `k` about its centre and nudged (dx, dy): a face. */
function boreFace(g: Graphics, pts: number[], cx: number, cy: number, k: number, dx: number, dy: number, color: number, alpha: number) {
  const f: number[] = [];
  for (let i = 0; i < pts.length; i += 2) f.push(cx + (pts[i] - cx) * k + dx, cy + (pts[i + 1] - cy) * k + dy);
  g.poly(f, true).fill({ color, alpha });
}

/** A rock at (x, y), `size` its radius, turned `rot`: body, a shadowed
 *  lower-right face, a lit upper-left one and a dark edge. The light stays
 *  top-left however it tumbles. `pts` is scratch, reused across frames. */
function boreDrawRock(g: Graphics, x: number, y: number, size: number, rot: number, rk: number[], alpha: number, pts: number[]) {
  if (alpha <= 0.02 || size < 1) return;
  pts.length = 0;
  for (let i = 0; i < rk.length; i += 2) {
    const a = rk[i] + rot, r = rk[i + 1] * size;
    pts.push(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  g.poly(pts, true).fill({ color: ROCK, alpha });
  boreFace(g, pts, x, y, 0.62, size * 0.16, size * 0.18, ROCK_LO, alpha * 0.75);
  boreFace(g, pts, x, y, 0.5, -size * 0.2, -size * 0.22, ROCK_HI, alpha * 0.85);
  g.poly(pts, true).stroke({ width: Math.max(1, size * 0.12), color: EDGE, alpha });
}

/** A shard of rock standing on `base`, `h` tall: jagged and leaning, lit on
 *  its left face, shadowed on its right. */
function boreSpike(g: Graphics, x: number, base: number, w: number, h: number, lean: number, alpha: number) {
  if (h < 2 || alpha <= 0.02) return;
  const tx = x + lean * h, ty = base - h;
  const lx = x - w * 0.55 + lean * h * 0.5, ly = base - h * 0.55;
  const rx = x + w * 0.6 + lean * h * 0.5, ry = base - h * 0.42;
  const body = [x - w, base, lx, ly, tx, ty, rx, ry, x + w, base];
  g.poly(body, true).fill({ color: ROCK, alpha });
  g.poly([x - w, base, lx, ly, tx, ty, x - w * 0.1 + lean * h * 0.3, base - h * 0.2], true).fill({ color: ROCK_HI, alpha: alpha * 0.7 });
  g.poly([tx, ty, rx, ry, x + w, base, x + w * 0.2, base], true).fill({ color: ROCK_LO, alpha: alpha * 0.7 });
  g.poly(body, true).stroke({ width: 1.5, color: EDGE, alpha });
}

/** A slab of stone along a card side, a->b its inner edge, `th` thick,
 *  facing out along (nx, ny): a chamfered block with a lit outer rim and a
 *  seam across it — stone plating, not metal. */
function boreSlab(g: Graphics, ax: number, ay: number, bx: number, by: number, nx: number, ny: number, th: number, alpha: number) {
  if (alpha <= 0.02) return;
  const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, c = th * 0.4;
  const oax = ax + nx * th + ux * c, oay = ay + ny * th + uy * c, obx = bx + nx * th - ux * c, oby = by + ny * th - uy * c;
  const pts = [ax, ay, bx, by, obx, oby, oax, oay];
  g.poly(pts, true).fill({ color: ROCK, alpha });
  g.moveTo(oax, oay).lineTo(obx, oby).stroke({ width: Math.max(1.5, th * 0.3), color: ROCK_HI, alpha: alpha * 0.8 });
  g.moveTo(ax + dx * 0.42, ay + dy * 0.42).lineTo(ax + dx * 0.46 + nx * th, ay + dy * 0.46 + ny * th)
    .stroke({ width: 1, color: EDGE, alpha: alpha * 0.7 });
  g.poly(pts, true).stroke({ width: 1.5, color: EDGE, alpha });
}

// ── What stone does when it lands ───────────────────────────────────────────

interface Chunk { x: number; y: number; vx: number; vy: number; rot: number; vr: number; size: number; rk: number[]; age: number; life: number }

/** Chunks thrown from a point — up and out, spinning, falling back to bounce
 *  once on `floor` — solid rock, fading at the end. */
function boreDebris(t: FxTools, o: {
  at: Pt; n: number; size: [number, number]; speed: [number, number]; dir?: [number, number]; floor: number; delay?: number;
}) {
  const n = Math.max(1, Math.round(o.n * t.quality));
  const [d0, d1] = o.dir ?? [-160, -20];
  const chunks: Chunk[] = Array.from({ length: n }, () => {
    const a = (rand(d0, d1) * Math.PI) / 180, v = rand(o.speed[0], o.speed[1]);
    return { x: o.at.x, y: o.at.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, rot: rand(0, TAU), vr: rand(-9, 9),
      size: rand(o.size[0], o.size[1]), rk: boreRock(5 + Math.floor(rand(0, 3))), age: 0, life: rand(0.5, 0.72) };
  });
  const pts: number[] = [];
  t.draw(0.72, (g, _u, dt) => {
    for (const c of chunks) {
      c.age += dt;
      if (c.age >= c.life) continue;
      c.vy += 1500 * dt;
      c.x += c.vx * dt; c.y += c.vy * dt; c.rot += c.vr * dt;
      if (c.y > o.floor && c.vy > 0) { c.y = o.floor; c.vy *= -0.3; c.vx *= 0.55; c.vr *= 0.5; }
      const fade = c.age > c.life * 0.7 ? 1 - (c.age - c.life * 0.7) / (c.life * 0.3) : 1;
      boreDrawRock(g, c.x, c.y, c.size, c.rot, c.rk, fade, pts);
    }
  }, { dark: true, delay: o.delay });
}

interface Puff { x: number; y: number; r: number; vx: number; vy: number; age: number; life: number }

/** Dust rolling out low from a point: soft clouds pushed out sideways that
 *  slow and settle — earth does not rise like smoke. */
function boreDust(t: FxTools, o: { at: Pt; n: number; size: number; spread: number; life?: number; delay?: number }) {
  const n = Math.max(1, Math.round(o.n * t.quality));
  const L = o.life ?? 0.8;
  const puffs: Puff[] = Array.from({ length: n }, (_, i) => ({
    x: o.at.x + rand(-4, 4), y: o.at.y + rand(-3, 3), r: o.size * rand(0.6, 1),
    vx: (i % 2 ? 1 : -1) * rand(0.35, 1) * o.spread, vy: -rand(4, 22), age: 0, life: L * rand(0.8, 1.2),
  }));
  t.draw(L * 1.2, (g, _u, dt) => {
    for (const p of puffs) {
      p.age += dt;
      if (p.age >= p.life) continue;
      const q = p.age / p.life;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= Math.pow(0.12, dt);
      // Two layers, a soft edge round a denser heart: dust, not a disc.
      const rr = p.r * (1 + q * 1.6), a = q < 0.15 ? q / 0.15 : 1 - (q - 0.15) / 0.85;
      g.circle(p.x, p.y, rr).fill({ color: DUST, alpha: 0.15 * a }).circle(p.x, p.y, rr * 0.62).fill({ color: DUST, alpha: 0.2 * a });
    }
  }, { dark: true, delay: o.delay });
}

/** A jagged line from (x0, y0) to (x1, y1) in `steps` kinks. */
function boreJag(x0: number, y0: number, x1: number, y1: number, steps: number, jag: number): number[] {
  const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
  const pts = [x0, y0];
  for (let i = 1; i < steps; i++) {
    const f = i / steps, j = rand(-jag, jag);
    pts.push(x0 + dx * f + nx * j, y0 + dy * f + ny * j);
  }
  pts.push(x1, y1);
  return pts;
}

/** Lines drawn in quickly, then held and faded: dark on the normal layer
 *  with a lit lip one pixel up-left — the broken edge catching the light. */
function boreGrooves(t: FxTools, paths: number[][], o: { draw: number; hold: number; width: number; delay?: number }) {
  const D = o.draw + o.hold + 0.25;
  const at = (time: number) => ({
    drawn: clamp01(time / o.draw),
    a: time < o.draw + o.hold ? 1 : 1 - (time - o.draw - o.hold) / 0.25,
  });
  t.draw(D, (g, u) => {
    const { drawn, a } = at(u * D);
    for (const p of paths) {
      const n = Math.max(2, Math.round((p.length / 2) * drawn));
      g.poly(p.slice(0, n * 2), false).stroke({ width: o.width, color: CRACK, alpha: 0.85 * a });
    }
  }, { dark: true, delay: o.delay });
  t.draw(D, (g, u) => {
    const { drawn, a } = at(u * D);
    for (const p of paths) {
      const n = Math.max(2, Math.round((p.length / 2) * drawn));
      const lip: number[] = [];
      for (let i = 0; i < n * 2; i += 2) lip.push(p[i] - 1, p[i + 1] - 1);
      g.poly(lip, false).stroke({ width: 1, color: LIT, alpha: 0.4 * a });
    }
  }, { delay: o.delay });
}

/** Cracks running out of a point through the ground, forking as they go. */
function boreCracks(t: FxTools, o: { at: Pt; n: number; reach: number; draw: number; hold: number; width?: number; delay?: number }) {
  const paths: number[][] = [];
  const a0 = rand(0, TAU);
  for (let i = 0; i < o.n; i++) {
    let ang = a0 + (i / o.n) * TAU + rand(-0.3, 0.3);
    const len = o.reach * rand(0.6, 1), steps = 5, pts = [o.at.x, o.at.y];
    let x = o.at.x, y = o.at.y;
    for (let k = 1; k <= steps; k++) {
      ang += rand(-0.45, 0.45);
      x += Math.cos(ang) * (len / steps);
      y += Math.sin(ang) * (len / steps);
      pts.push(x, y);
    }
    paths.push(pts);
    if (Math.random() < 0.5) {
      const k = 2 + Math.floor(rand(0, 2)), fx = pts[k * 2], fy = pts[k * 2 + 1];
      const fa = ang + rand(0.5, 0.9) * (Math.random() < 0.5 ? -1 : 1);
      paths.push(boreJag(fx, fy, fx + Math.cos(fa) * len * 0.4, fy + Math.sin(fa) * len * 0.4, 3, 2));
    }
  }
  boreGrooves(t, paths, { draw: o.draw, hold: o.hold, width: o.width ?? 2.2, delay: o.delay });
}

/** Grit thrown up off a line on the floor. */
function boreGrit(t: FxTools, x: number, y: number, w: number, count: number, speed: [number, number] = [60, 160]) {
  t.emit({ count, palette: SAND, from: { x, y: y - 4, w, h: 8 }, dir: [-140, -40], speed, gravity: 950, drag: 0.6,
    life: [0.28, 0.5], size: [5, 2] });
}

// ── The look ─────────────────────────────────────────────────────────────────

export const BORE: ElementLook = {
  markColor: MARK,

  windUp(t, d) {
    const dur = d.wind + (d.T - d.wind) * 0.3;
    const s = d.size, feet = { x: d.at.x, y: d.at.y + s * 0.34 };
    if (d.melee && !d.special) {
      // The lunge is the wind-up: a scuff of dust at its feet, no more.
      boreDust(t, { at: feet, n: 3, size: s * 0.1, spread: 40, life: 0.45 });
      return;
    }
    // The ground gives under it: cracks run out from its feet...
    boreCracks(t, { at: feet, n: d.special ? 6 : 3, reach: s * (d.special ? 0.55 : 0.38), draw: d.wind * 0.6, hold: dur - d.wind * 0.6, width: 2 });
    if (!d.melee) {
      // ...and a rock tears loose and rises into its hand: the throw takes
      // over from it on the frame it leaves.
      const rk = boreRock(), pts: number[] = [], R = s * (d.special ? 0.24 : 0.15);
      t.draw(d.wind, (g, u) => {
        const e = easeOut(u);
        boreDrawRock(g, d.at.x, feet.y + (d.at.y - feet.y) * e + Math.sin(u * 22) * 1.2, R * (0.6 + 0.4 * e), u * 1.5, rk,
          Math.min(1, u * 4), pts);
      }, { dark: true });
      boreGrit(t, feet.x - s * 0.2, feet.y, s * 0.4, d.special ? 12 : 6);
    }
    if (d.special) {
      // A Special pulls up more than it needs: pebbles lift all round it and
      // hang there, trembling.
      const pebbles = Array.from({ length: 4 }, (_, i) => ({ a: (i / 4) * TAU + rand(-0.3, 0.3), rk: boreRock(6), size: s * rand(0.05, 0.08) }));
      const pts: number[] = [];
      t.draw(dur, (g, u) => {
        const lift = easeOut(Math.min(1, u * 1.6)), a = Math.min(1, u * 5) * (u > 0.85 ? (1 - u) / 0.15 : 1);
        for (const p of pebbles) {
          const x = d.at.x + Math.cos(p.a + u * 0.8) * s * 0.44;
          const y = feet.y - s * 0.36 * lift + Math.sin(p.a + u * 0.8) * s * 0.12 + Math.sin(u * 30 + p.a) * 1.2;
          boreDrawRock(g, x, y, p.size, u * 2 + p.a, p.rk, a, pts);
        }
      }, { dark: true });
      boreDust(t, { at: feet, n: 6, size: s * 0.14, spread: 70, life: 0.7 });
    }
  },

  gather(t, d) {
    // The square is still empty: the ground there cracks open and rock
    // shoulders up out of it, dust rolling off — the card erupts out (arrive).
    const s = d.size, floor = d.at.y + s * 0.3;
    boreCracks(t, { at: { x: d.at.x, y: floor - s * 0.1 }, n: d.special ? 7 : 5, reach: s * 0.5, draw: d.T * 0.4, hold: d.T * 0.6 });
    const spikes = [-0.28, 0, 0.26].map((f, i) => ({ x: d.at.x + f * s, h: s * (i === 1 ? 0.42 : 0.28), w: s * 0.1, lean: f * 0.4 }));
    t.draw(d.T, (g, u) => {
      const grow = easeOut(clamp01((u - 0.2) / 0.8));
      for (const sp of spikes) boreSpike(g, sp.x, floor, sp.w, sp.h * grow, sp.lean, Math.min(1, u * 3));
    }, { dark: true });
    boreDust(t, { at: { x: d.at.x, y: floor }, n: d.special ? 8 : 5, size: s * 0.13, spread: 60, life: d.T + 0.2 });
    boreGrit(t, d.rect.x + s * 0.15, floor, s * 0.7, d.special ? 14 : 8, [40, 110]);
  },

  projectile(t, s) {
    // A ROCK, tumbling, heaved in a heavy arc — lobbed, not flown — grit
    // shaking off it all the way. A Special heaves a boulder with two stones
    // after it; they leave a beat later and fly faster, so all three land on
    // the landing frame.
    const dx = s.to.x - s.from.x, dy = s.to.y - s.from.y, dist = Math.hypot(dx, dy) || 1;
    const nx = -dy / dist, ny = dx / dist;
    const rocks = s.special
      ? [{ size: s.size * 0.24, lag: 0, off: 0, arc: 0.34 }, { size: s.size * 0.1, lag: 0.12, off: -s.size * 0.22, arc: 0.28 },
        { size: s.size * 0.09, lag: 0.2, off: s.size * 0.24, arc: 0.3 }]
      : [{ size: s.size * 0.15, lag: 0, off: 0, arc: 0.32 }];
    const shapes = rocks.map(() => boreRock());
    const spin = rand(9, 13) * (dx >= 0 ? 1 : -1);
    const pos = (q: number, r: (typeof rocks)[number]): Pt => {
      const hop = 4 * q * (1 - q) * (dist * r.arc + s.size * 0.25);
      return { x: s.from.x + dx * q + nx * r.off * (1 - q), y: s.from.y + dy * q - hop + ny * r.off * (1 - q) };
    };
    const pts: number[] = [];
    t.draw(s.seconds, (g, u) => {
      rocks.forEach((r, i) => {
        const q = (u - r.lag) / (1 - r.lag);
        if (q <= 0 || q >= 1) return; // landed: the burst and the break take it from here
        const p = pos(q, r);
        boreDrawRock(g, p.x, p.y, r.size, q * spin * 0.25 + i, shapes[i], Math.min(1, q * 8), pts);
      });
    }, { delay: s.delay, dark: true });
    let acc = 0;
    t.draw(s.seconds, (_g, u, dt) => {
      acc += (s.special ? 55 : 28) * t.quality * dt;
      while (acc >= 1) {
        acc -= 1;
        const p = pos(u, rocks[0]);
        t.spark(p.x + rand(-4, 4), p.y + rand(-4, 4), rand(-30, 30), rand(-20, 40), rand(0.25, 0.45), GRIT);
      }
    }, { delay: s.delay });
    t.later(s.delay, () => boreDust(t, { at: { x: s.from.x, y: s.from.y + s.size * 0.3 }, n: s.special ? 5 : 3, size: s.size * 0.11, spread: 45, life: 0.55 }));
  },

  swing(t, s) {
    // Weight behind it: a low heavy streak dragging dust and grit along the
    // lunge; a Special's or a pounce's kicks up the ground where it starts.
    t.shot({
      from: s.from, to: s.to, seconds: s.seconds, delay: s.delay, ease: "in",
      head: 0xd9b48a, headSize: s.size * (s.special ? 0.14 : 0.07),
      trail: { palette: SAND, rate: s.special ? 70 : 20, size: [6, 2], life: [0.2, 0.4], drift: 12, gravity: 600 },
    });
    if (s.special || s.arriving)
      t.later(s.delay, () => boreDust(t, { at: { x: s.from.x, y: s.from.y + s.size * 0.3 }, n: 5, size: s.size * 0.12, spread: 50, life: 0.6 }));
  },

  mark(t, m) {
    // A GROUND-SHAKING SMASH: cracks race out through the card from the blow,
    // a crater darkens where it landed, chunks of rock burst up and fall back
    // and bounce, and dust rolls out low all round. Heavy, not bright.
    const floor = m.rect.y + m.rect.h * 0.9;
    boreCracks(t, { at: m.c, n: 7, reach: m.reach * 1.15, draw: 0.07, hold: 0.32, width: 2.6 });
    t.draw(0.6, (g, u) => {
      g.ellipse(m.c.x, m.c.y + m.reach * 0.1, m.reach * 0.45, m.reach * 0.3).fill({ color: CRACK, alpha: 0.45 * Math.min(1, u * 8) * (1 - u) });
    }, { dark: true });
    boreDebris(t, { at: m.c, n: Math.round(5 + 2 * m.k), size: [m.reach * 0.08, m.reach * 0.16], speed: [180, 360], dir: [-165, -15], floor });
    boreDust(t, { at: { x: m.c.x, y: floor - m.reach * 0.15 }, n: 8, size: m.reach * 0.25, spread: 120, life: 0.8 });
    t.flash(m.c, 0xffe8c0, 0.28);
    t.ring(m.rect, 0xe8cfa8, 0.3, 1.05, 0.35, 4);
    for (let i = 0; i < Math.round(12 * m.k); i++) {
      const a = (rand(-160, -20) * Math.PI) / 180, v = rand(150, 320);
      t.spark(m.c.x, m.c.y, Math.cos(a) * v, Math.sin(a) * v, rand(0.3, 0.5), CHIP);
    }
  },

  xSparks(t, c, count) {
    // Chips of stone knocked off the X: they drop, they do not fly.
    for (let i = 0; i < count; i++) {
      const a = (rand(-150, -30) * Math.PI) / 180, v = rand(60, 150);
      t.spark(c.x + rand(-3, 3), c.y + rand(-3, 3), Math.cos(a) * v, Math.sin(a) * v, rand(0.22, 0.34), GRIT);
    }
  },

  arrive(t, r) {
    // It ERUPTS out of the ground: shards of rock punch up through the square
    // and sink back, chunks thrown up with them, cracks and dust all round.
    const c = centre(r), s = Math.min(r.w, r.h), floor = r.y + r.h * 0.88;
    const spikes = [-0.34, -0.12, 0.1, 0.32].map((f, i) => ({ x: c.x + f * s, h: s * (i % 2 ? 0.62 : 0.45), w: s * 0.1, lean: f * 0.5 }));
    t.draw(0.55, (g, u) => {
      const e = u < 0.18 ? easeOut(u / 0.18) : 1 - Math.pow((u - 0.18) / 0.82, 2) * 0.9;
      const a = u < 0.7 ? 1 : 1 - (u - 0.7) / 0.3;
      for (const sp of spikes) boreSpike(g, sp.x, floor, sp.w, sp.h * e, sp.lean, a);
    }, { dark: true });
    boreCracks(t, { at: { x: c.x, y: floor - s * 0.1 }, n: 6, reach: s * 0.55, draw: 0.06, hold: 0.3 });
    boreDebris(t, { at: { x: c.x, y: floor - s * 0.2 }, n: 6, size: [s * 0.05, s * 0.1], speed: [200, 380], dir: [-150, -30], floor });
    boreDust(t, { at: { x: c.x, y: floor }, n: 8, size: s * 0.15, spread: 110, life: 0.85 });
    boreGrit(t, r.x + r.w * 0.15, floor, r.w * 0.7, 18, [120, 260]);
  },

  impactAccent(t, at, k) {
    // The rock breaks on it: a few chunks knocked loose, falling and bouncing,
    // and a puff of dust. Two drawings, no more — it rides every BORE hit.
    boreDebris(t, { at, n: Math.round(2 + 2 * k), size: [4, 7 + 2 * k], speed: [120, 260], dir: [-160, -20], floor: at.y + 26 });
    boreDust(t, { at: { x: at.x, y: at.y + 12 }, n: 3, size: 9 + 4 * k, spread: 60, life: 0.6 });
  },

  shield(t, r) {
    // EXOSTONE: slabs of stone SLAM onto the card — one to each side, in from
    // outside, with a jolt as each lands and dust bursting off the seam — then
    // settle into the shield pips the board draws.
    const s = Math.min(r.w, r.h), th = s * 0.14, m = s * 0.06, e = s * 0.08;
    const x0 = r.x - m, x1 = r.x + r.w + m, y0 = r.y - m, y1 = r.y + r.h + m;
    const slabs = [
      { ax: x0, ay: y0 + e, bx: x0, by: y1 - e, nx: -1, ny: 0 },
      { ax: x1, ay: y1 - e, bx: x1, by: y0 + e, nx: 1, ny: 0 },
      { ax: x1 - e, ay: y0, bx: x0 + e, by: y0, nx: 0, ny: -1 },
      { ax: x0 + e, ay: y1, bx: x1 - e, by: y1, nx: 0, ny: 1 },
    ];
    const D = 0.9;
    t.draw(D, (g, u) => {
      const time = u * D;
      slabs.forEach((sl, i) => {
        const at = time - i * 0.045;
        if (at <= 0) return;
        const q = Math.min(1, at / 0.1);
        const jolt = at > 0.1 && at < 0.16 ? -2 * Math.sin(((at - 0.1) / 0.06) * Math.PI) : 0;
        const off = (1 - q * q) * s * 0.45 + jolt;
        const a = time < 0.55 ? Math.min(1, at * 12) : 1 - (time - 0.55) / 0.35;
        boreSlab(g, sl.ax + sl.nx * off, sl.ay + sl.ny * off, sl.bx + sl.nx * off, sl.by + sl.ny * off, sl.nx, sl.ny, th, a);
      });
    }, { dark: true });
    slabs.forEach((sl, i) => t.later(0.1 + i * 0.045, () => {
      const mid = { x: (sl.ax + sl.bx) / 2 + sl.nx * th * 0.5, y: (sl.ay + sl.by) / 2 + sl.ny * th * 0.5 };
      boreDust(t, { at: mid, n: 2, size: s * 0.1, spread: 35, life: 0.5 });
      for (let k = 0; k < 4; k++)
        t.spark(mid.x, mid.y, sl.nx * rand(40, 110) + rand(-40, 40), sl.ny * rand(40, 110) - rand(40, 100), rand(0.2, 0.4), CHIP);
    }));
    t.later(0.28, () => t.ring(r, 0xe8cfa8, 1.15, 1.2, 0.25, 2)); // a glint as the plating locks
  },

  heal(t, r, k) {
    // Stone mending: the cracks in it glow warm and draw shut, sand drifting
    // up off it as it knits.
    const c = centre(r), s = Math.min(r.w, r.h);
    const seams = Array.from({ length: 3 }, () => {
      const a = rand(0, TAU), l = s * rand(0.25, 0.4);
      return [c.x - Math.cos(a) * l * 0.5, c.y - Math.sin(a) * l * 0.5, c.x + Math.cos(a) * l * 0.5 + rand(-4, 4), c.y + Math.sin(a) * l * 0.5 + rand(-4, 4)];
    });
    t.draw(0.8, (g, u) => {
      const shut = 1 - easeOut(u), a = u < 0.2 ? u / 0.2 : 1 - (u - 0.2) / 0.8;
      for (const p of seams) {
        const mx = (p[0] + p[2]) / 2, my = (p[1] + p[3]) / 2;
        g.moveTo(mx + (p[0] - mx) * shut, my + (p[1] - my) * shut).lineTo(mx + (p[2] - mx) * shut, my + (p[3] - my) * shut)
          .stroke({ width: 3, color: 0xffd08a, alpha: 0.9 * a });
      }
    });
    t.glow(r, 0xe8c890, 0.3, 0.8, 1.05);
    t.emit({ count: Math.round(14 * Math.max(0.7, Math.min(2.2, k))), palette: [0xfff1dc, 0xe8cfa8, 0xa8e090], from: r, at: "bottom",
      dir: [-100, -80], speed: [30, 80], gravity: -60, drag: 0.6, life: [0.7, 1.1], size: [6, 2] });
  },

  wall(t, r) {
    // STONE WALL: a rampart of rock shoulders up out of the row in a rolling
    // heave from one end to the other — shards leaning every which way,
    // chunks tumbling off, dust rolling along its foot — then settles into
    // the brackets the board draws.
    const n = Math.max(6, Math.round(r.w / 26)), base = r.y + r.h * 0.95;
    const spikes = Array.from({ length: n }, (_, i) => ({
      x: r.x + (r.w * (i + 0.5)) / n + rand(-4, 4), h: r.h * rand(0.5, 0.85) * (i % 2 ? 0.8 : 1),
      w: (r.w / n) * rand(0.45, 0.6), lean: rand(-0.18, 0.18), d: (i / n) * 0.25,
    }));
    t.draw(1.1, (g, u) => {
      const time = u * 1.1, fade = time < 0.75 ? 1 : 1 - (time - 0.75) / 0.35;
      for (const sp of spikes) {
        const q = clamp01((time - sp.d) / 0.14);
        if (q > 0) boreSpike(g, sp.x, base, sp.w, sp.h * easeOut(q), sp.lean, fade);
      }
    }, { dark: true });
    for (let i = 0; i < 4; i++) {
      const f = (i + 0.5) / 4;
      t.later(f * 0.25, () => boreDust(t, { at: { x: r.x + r.w * f, y: base }, n: 3, size: r.h * 0.18, spread: 70, life: 0.8 }));
    }
    boreDebris(t, { at: { x: r.x + r.w * 0.5, y: base - r.h * 0.6 }, n: 5, size: [3, 6], speed: [80, 200], dir: [-150, -30], floor: base, delay: 0.2 });
    boreGrit(t, r.x, base, r.w, Math.round(r.w / 10));
  },

  wallBite(t, r) {
    // Crossing it: the stone heaves up under the card — three shards punching
    // up from its footing — chips flying, dust thrown out.
    const c = centre(r), s = Math.min(r.w, r.h), base = r.y + r.h * 0.95;
    const shards = [-0.3, 0, 0.3].map((f, i) => ({ x: c.x + f * s, h: s * (i === 1 ? 0.62 : 0.44), lean: -f * 0.5 }));
    t.draw(0.6, (g, u) => {
      const grow = easeOut(clamp01(u / 0.12)), a = u < 0.45 ? 1 : 1 - (u - 0.45) / 0.55;
      for (const sh of shards) boreSpike(g, sh.x, base, s * 0.1, sh.h * grow, sh.lean, a);
    }, { dark: true });
    boreDust(t, { at: { x: c.x, y: base }, n: 5, size: s * 0.14, spread: 80, life: 0.7 });
    for (let i = 0; i < 10; i++) {
      const a = (rand(-150, -30) * Math.PI) / 180, v = rand(120, 260);
      t.spark(c.x + rand(-s * 0.3, s * 0.3), base - rand(0, s * 0.3), Math.cos(a) * v, Math.sin(a) * v, rand(0.3, 0.5), CHIP);
    }
  },

  field(t, r) {
    // BEDROCK: the ground under the board hardens into stone — the seams of
    // great slabs running across it, their broken edges catching the light —
    // with a low roll of dust along its floor and grit shaken loose.
    const lines: number[][] = [];
    for (let i = 1; i < 4; i++) {
      const y = r.y + (r.h * i) / 4;
      lines.push(boreJag(r.x, y + rand(-6, 6), r.x + r.w, y + rand(-6, 6), 10, 5));
    }
    for (let j = 1; j < 3; j++) {
      const x = r.x + (r.w * j) / 3;
      lines.push(boreJag(x + rand(-6, 6), r.y, x + rand(-6, 6), r.y + r.h, 12, 5));
    }
    boreGrooves(t, lines, { draw: 0.35, hold: 0.55, width: 2 });
    for (let i = 0; i < 4; i++) {
      const f = (i + 0.5) / 4;
      t.later(i * 0.08, () => boreDust(t, { at: { x: r.x + r.w * f, y: r.y + r.h - 6 }, n: 3, size: r.h * 0.06, spread: 60, life: 0.9 }));
    }
    t.emit({ count: 30, palette: SAND, from: { x: r.x, y: r.y, w: r.w, h: r.h * 0.4 }, dir: [80, 100], speed: [30, 90], gravity: 700,
      drag: 0.5, life: [0.4, 0.8], size: [5, 2] });
  },

  move(t, from, to) {
    // Dragged, not flown: a groove scraped along the path, dust churned up
    // behind it, a thump of dust where it comes to rest.
    const a = centre(from), b = centre(to), s = Math.min(from.w, from.h), foot = s * 0.3;
    t.draw(0.7, (g, u) => {
      const fr = easeOut(Math.min(1, (u * 0.7) / 0.3));
      g.moveTo(a.x, a.y + foot).lineTo(a.x + (b.x - a.x) * fr, a.y + (b.y - a.y) * fr + foot)
        .stroke({ width: 5, color: CRACK, alpha: 0.45 * (1 - u) });
    }, { dark: true });
    for (let i = 0; i < 3; i++) {
      const f = (i + 0.5) / 3;
      t.later(i * 0.1, () => boreDust(t, { at: { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f + foot }, n: 2, size: s * 0.12, spread: 40, life: 0.6 }));
    }
    t.later(0.3, () => boreDust(t, { at: { x: b.x, y: b.y + foot }, n: 4, size: s * 0.13, spread: 60, life: 0.7 }));
  },

  trapSet(t, r) {
    // The square's ground cracks and sand runs down into it, then it settles
    // smooth over what is waiting there.
    const c = centre(r), s = Math.min(r.w, r.h);
    boreCracks(t, { at: c, n: 5, reach: s * 0.4, draw: 0.12, hold: 0.35, width: 1.8 });
    t.emit({ count: 16, palette: SAND, from: r, at: "ring", speed: [60, 120], gravity: 0, drag: 0.9, life: [0.3, 0.5], size: [5, 2] });
  },

  pulse(t, r) {
    // A ripple through the ground: the earth humps up and runs both ways from
    // the middle of the row, dust kicked up behind each front.
    const cx = r.x + r.w / 2, y = r.y + r.h * 0.7, half = r.w / 2;
    const front = (u: number) => easeOut(Math.min(1, u / 0.6));
    t.draw(0.7, (g, u) => {
      const a = 1 - u;
      for (const side of [-1, 1]) {
        const x = cx + side * half * front(u);
        g.moveTo(x - 10, y).quadraticCurveTo(x, y - 9 * a, x + 10, y).stroke({ width: 3, color: CRACK, alpha: 0.6 * a });
      }
    }, { dark: true });
    t.draw(0.7, (g, u) => {
      const a = 1 - u;
      for (const side of [-1, 1]) {
        const x = cx + side * half * front(u);
        g.moveTo(x - 10, y - 1).quadraticCurveTo(x, y - 10 * a, x + 10, y - 1).stroke({ width: 1.5, color: LIT, alpha: 0.6 * a });
      }
    });
    for (let i = 0; i < 3; i++) {
      const at = 0.1 + i * 0.15;
      t.later(at, () => {
        for (const side of [-1, 1]) boreDust(t, { at: { x: cx + side * half * front(at / 0.7), y }, n: 1, size: r.h * 0.12, spread: 30, life: 0.5 });
      });
    }
  },

  boardIncoming(t, a) {
    // THE MOUNTAIN COMES DOWN: solid boulders tumbling out of the sky onto
    // every card it reaches, accelerating, grit streaming off them and dust
    // shaken loose above the board (the board rumbles — use-spell-impacts.ts).
    for (const aim of a.aims) {
      const to = centre(aim), size = 16 * a.strength * rand(0.9, 1.15), rk = boreRock(8), spin = rand(-6, 6);
      const from = { x: to.x + rand(-0.1, 0.1) * a.rect.w, y: a.rect.y - a.rect.h * rand(0.15, 0.3) };
      const pts: number[] = [];
      t.draw(a.seconds, (g, u) => {
        const e = u * u;
        boreDrawRock(g, from.x + (to.x - from.x) * e, from.y + (to.y - from.y) * e, size * (0.7 + 0.3 * u), u * spin, rk, Math.min(1, u * 6), pts);
      }, { dark: true });
      t.shot({
        from, to, seconds: a.seconds, ease: "in", head: 0xd9b48a, headSize: 4,
        trail: { palette: SAND, rate: 40 * a.strength, size: [6, 2], life: [0.3, 0.6], drift: 20, gravity: 300 },
      });
    }
    t.emit({ count: Math.round(50 * a.strength), palette: SAND, from: { x: a.rect.x, y: a.rect.y, w: a.rect.w, h: a.rect.h * 0.35 },
      dir: [80, 100], speed: [40, 120], gravity: 500, drag: 0.4, life: [0.4, 0.8], size: [9, 3] });
  },

  boardFinale(t, a) {
    // The mountain lands: dust rolls out low from every card it struck and
    // hangs over the board, chunks still coming down — dust, not glowing dots.
    const hits = a.targets.length ? a.targets : [{ x: a.rect.x + a.rect.w * 0.3, y: a.rect.y + a.rect.h * 0.3, w: a.rect.w / 4, h: a.rect.h / 4 }];
    for (const r of hits) {
      const c = centre(r);
      boreDust(t, { at: { x: c.x, y: c.y + r.h * 0.3 }, n: 5, size: r.w * 0.2, spread: 110, life: 1.0 });
      boreDebris(t, { at: c, n: 3, size: [4, 9], speed: [150, 300], floor: c.y + r.h * 0.4 });
    }
    t.glow(a.rect, 0xa1887f, 0.18 * a.strength, 0.8, 1.2);
  },
};
