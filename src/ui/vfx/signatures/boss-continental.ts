/** CONTINENTAL — Rolling Boulder. "Hurls a boulder at one random opponent
 *  anywhere on the board for 35 DMG. If that kills it, the boulder settles in
 *  its square and starts rolling." It has not arrived anywhere; things have
 *  simply ended up in front of it.
 *
 *  The DELIVERY is the boulder on its art: the ground at the giant's feet
 *  splits and a great mossy stone heaves up out of it, earth falling off, and
 *  is thrown — lobbed high on a long arc to wherever the victim stands,
 *  turning over as it flies, its shadow running across the board beneath it
 *  and swelling as it comes down, landing on the landing frame. The LANDING is
 *  the crush: the stone slams down on the card, the ground cracks wide round
 *  it, a crater, chunks and a ring of dust thrown out. If the card lives the
 *  boulder breaks apart on it; if it dies the boulder stays — it settles into
 *  the hole the body left, rolls a little, rocks still — and the rolling
 *  boulder the game puts there takes over.
 *
 *  All stone, on the normal-blend layer (see looks/bore.ts): a mid-grey body
 *  lit top-left, a shadowed face, cracks and moss that turn as it turns, so it
 *  reads as ROLLING and not as a disc. Light is only the grit. */
import { centre, rand } from "../looks/base";
import type { Graphics } from "pixi.js";
import type { FxTools, Pt, SparkStyle } from "../looks/types";
import type { Signature, SigMoment } from "./types";

type Box = SigMoment["from"];

const TAU = Math.PI * 2;
// Stone and moss, real colour on the normal-blend layer.
const STONE = 0x8c877a, STONE_HI = 0xd0cab8, STONE_LO = 0x4a463d, EDGE = 0x1a1814, MOSS = 0x5a7a2c, MOSS_HI = 0x8fb04a;
const CRACK = 0x0e0c09, DUST = 0xb8ae98;
/** Grit off the stone: small, heavy, falling. */
const GRIT: SparkStyle = { palette: [0xfff1dc, 0xe8dcc0, 0xb8ac90], gravity: 950, drag: 0.6, size: [5, 2], streak: false };
/** Chips knocked off by the crush: fast streaks that drop. */
const CHIP: SparkStyle = { palette: [0xffffff, 0xe8dcc0, 0xa89c80], gravity: 1100, drag: 0.5, size: [6, 2], streak: true };

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeOut = (x: number) => 1 - (1 - x) * (1 - x);

/** THE BOULDER's look, fixed once: its outline (round, but lumpy), the cracks
 *  across its face and the moss on it, all in its own turning frame. */
interface Stone { rim: number[]; cracks: number[][]; moss: { a: number; r: number; size: number; lobe: number[] }[] }

function stoneOf(): Stone {
  const rim: number[] = [];
  for (let i = 0; i < 14; i++) rim.push((i / 14) * TAU + rand(-0.12, 0.12), rand(0.88, 1));
  const cracks = Array.from({ length: 3 }, () => {
    const a = rand(0, TAU), r0 = rand(0.1, 0.45), pts: number[] = [];
    let x = Math.cos(a) * r0, y = Math.sin(a) * r0, h = a + rand(-1, 1);
    for (let k = 0; k < 4; k++) {
      pts.push(x, y);
      h += rand(-0.6, 0.6);
      x += Math.cos(h) * 0.16;
      y += Math.sin(h) * 0.16;
    }
    return pts;
  });
  // Moss in ragged patches, not spots: each a lobed outline of its own.
  const moss = Array.from({ length: 3 }, () => ({ a: rand(0, TAU), r: rand(0.25, 0.62), size: rand(0.2, 0.34),
    lobe: Array.from({ length: 9 }, () => rand(0.45, 1)) }));
  return { rim, cracks, moss };
}

/** The boulder at (x, y), `R` its radius, turned `rot`, squashed by `sq` (1
 *  round; below 1 flattened by a blow): a body, a shadowed lower face, a lit
 *  upper one — the light stays top-left as it turns — its cracks and moss
 *  turning with it, and a dark edge. */
function boulder(g: Graphics, st: Stone, x: number, y: number, R: number, rot: number, alpha: number, sq = 1) {
  if (alpha <= 0.02 || R < 2) return;
  const P = (a: number, r: number, dx = 0, dy = 0) => ({ x: x + dx + Math.cos(a) * r * R, y: y + dy + Math.sin(a) * r * R * sq });
  const outline = (k: number, dx: number, dy: number) => {
    const p: number[] = [];
    for (let i = 0; i < st.rim.length; i += 2) {
      const q = P(st.rim[i] + rot, st.rim[i + 1] * k, dx, dy);
      p.push(q.x, q.y);
    }
    return p;
  };
  const body = outline(1, 0, 0);
  g.poly(body, true).fill({ color: STONE, alpha });
  g.poly(outline(0.7, R * 0.16, R * 0.18 * sq), true).fill({ color: STONE_LO, alpha: alpha * 0.7 });
  g.poly(outline(0.52, -R * 0.2, -R * 0.24 * sq), true).fill({ color: STONE_HI, alpha: alpha * 0.8 });
  for (const m of st.moss) {
    const c = P(m.a + rot, m.r), w = m.size * R, p: number[] = [];
    for (let i = 0; i < m.lobe.length; i++) {
      const a = rot + (i / m.lobe.length) * TAU;
      p.push(c.x + Math.cos(a) * w * m.lobe[i], c.y + Math.sin(a) * w * m.lobe[i] * sq);
    }
    g.poly(p, true).fill({ color: MOSS, alpha: alpha * 0.85 });
    g.circle(c.x - w * 0.25, c.y - w * 0.25 * sq, w * 0.22).fill({ color: MOSS_HI, alpha: alpha * 0.7 });
  }
  const ca = Math.cos(rot), sa = Math.sin(rot);
  for (const cr of st.cracks) {
    const p: number[] = [];
    for (let i = 0; i < cr.length; i += 2) p.push(x + (cr[i] * ca - cr[i + 1] * sa) * R, y + (cr[i] * sa + cr[i + 1] * ca) * R * sq);
    g.poly(p, false).stroke({ width: Math.max(1, R * 0.05), color: EDGE, alpha: alpha * 0.8 });
  }
  g.poly(body, true).stroke({ width: Math.max(1.5, R * 0.07), color: EDGE, alpha });
}

/** A small rock's outline: corners at uneven angles and radii, [angle, radius]. */
function rockShape(): number[] {
  const out: number[] = [], n = 5 + Math.floor(rand(0, 3)), a0 = rand(0, TAU);
  for (let i = 0; i < n; i++) out.push(a0 + (i / n) * TAU + rand(-0.25, 0.25), rand(0.72, 1));
  return out;
}

/** A chunk of stone at (x, y), `size` its radius, turned `rot`. */
function chunk(g: Graphics, x: number, y: number, size: number, rot: number, rk: number[], alpha: number) {
  if (alpha <= 0.02 || size < 1) return;
  const face = (k: number, dx: number, dy: number) => {
    const p: number[] = [];
    for (let i = 0; i < rk.length; i += 2) p.push(x + dx + Math.cos(rk[i] + rot) * rk[i + 1] * size * k, y + dy + Math.sin(rk[i] + rot) * rk[i + 1] * size * k);
    return p;
  };
  const body = face(1, 0, 0);
  g.poly(body, true).fill({ color: STONE, alpha });
  g.poly(face(0.62, size * 0.16, size * 0.18), true).fill({ color: STONE_LO, alpha: alpha * 0.75 });
  g.poly(face(0.5, -size * 0.2, -size * 0.22), true).fill({ color: STONE_HI, alpha: alpha * 0.85 });
  g.poly(body, true).stroke({ width: Math.max(1, size * 0.12), color: EDGE, alpha });
}

/** Chunks thrown from `at`, up and out, bouncing once on `floor`. */
function rubble(t: FxTools, at: Pt, n: number, size: [number, number], speed: [number, number], floor: number, s: number, spread = 0) {
  const sc = s / 90;
  const bits = Array.from({ length: Math.max(1, Math.round(n * t.quality)) }, () => {
    const a = (rand(-165, -15) * Math.PI) / 180, v = rand(speed[0], speed[1]) * sc;
    return { x: at.x + rand(-spread, spread), y: at.y + rand(-spread, spread) * 0.6, vx: Math.cos(a) * v, vy: Math.sin(a) * v, rot: rand(0, TAU),
      vr: rand(-9, 9), size: rand(size[0], size[1]), rk: rockShape(), age: 0, life: rand(0.55, 0.8) };
  });
  t.draw(0.8, (g, _u, dt) => {
    for (const b of bits) {
      b.age += dt;
      if (b.age >= b.life) continue;
      b.vy += 1500 * sc * dt;
      b.x += b.vx * dt; b.y += b.vy * dt; b.rot += b.vr * dt;
      if (b.y > floor && b.vy > 0) { b.y = floor; b.vy *= -0.3; b.vx *= 0.55; b.vr *= 0.5; }
      chunk(g, b.x, b.y, b.size, b.rot, b.rk, b.age > b.life * 0.7 ? 1 - (b.age - b.life * 0.7) / (b.life * 0.3) : 1);
    }
  }, { dark: true });
}

/** Dust rolling out low from a point: soft clouds pushed out that slow and
 *  settle — earth does not rise like smoke. */
function dust(t: FxTools, at: Pt, n: number, size: number, spread: number, life = 0.9, ring = 0) {
  const puffs = Array.from({ length: Math.max(1, Math.round(n * t.quality)) }, (_, i) => {
    const a = ring > 0 ? (i / n) * TAU + rand(-0.2, 0.2) : 0;
    return { x: at.x + Math.cos(a) * ring, y: at.y + Math.sin(a) * ring * 0.6, r: size * rand(0.6, 1),
      vx: ring > 0 ? Math.cos(a) * spread * rand(0.6, 1) : (i % 2 ? 1 : -1) * rand(0.35, 1) * spread,
      vy: ring > 0 ? Math.sin(a) * spread * 0.4 * rand(0.6, 1) : -size * rand(0.4, 1.8), age: 0, life: life * rand(0.8, 1.2) };
  });
  t.draw(life * 1.2, (g, _u, dt) => {
    for (const p of puffs) {
      p.age += dt;
      if (p.age >= p.life) continue;
      const q = p.age / p.life;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= Math.pow(0.15, dt); p.vy *= Math.pow(0.15, dt);
      const rr = p.r * (1 + q * 1.6), a = q < 0.15 ? q / 0.15 : 1 - (q - 0.15) / 0.85;
      g.circle(p.x, p.y, rr).fill({ color: DUST, alpha: 0.15 * a }).circle(p.x, p.y, rr * 0.62).fill({ color: DUST, alpha: 0.2 * a });
    }
  }, { dark: true });
}

/** Cracks run out of a point through the ground, drawn in fast and held —
 *  dark grooves with a lit lip where the broken edge catches the light. */
function cracks(t: FxTools, at: Pt, n: number, reach: number, hold: number) {
  const paths: number[][] = [], a0 = rand(0, TAU);
  for (let i = 0; i < n; i++) {
    let ang = a0 + (i / n) * TAU + rand(-0.3, 0.3), x = at.x, y = at.y;
    const len = reach * rand(0.6, 1), pts = [x, y];
    for (let k = 1; k <= 5; k++) {
      ang += rand(-0.45, 0.45);
      x += Math.cos(ang) * (len / 5);
      y += Math.sin(ang) * (len / 5);
      pts.push(x, y);
    }
    paths.push(pts);
  }
  const DRAW = 0.08, D = DRAW + hold + 0.3;
  const state = (u: number) => ({ drawn: clamp01((u * D) / DRAW), a: u * D < DRAW + hold ? 1 : 1 - (u * D - DRAW - hold) / 0.3 });
  const part = (p: number[], drawn: number) => p.slice(0, Math.max(2, Math.round((p.length / 2) * drawn)) * 2);
  t.draw(D, (g, u) => {
    const { drawn, a } = state(u);
    for (const p of paths) g.poly(part(p, drawn), false).stroke({ width: 3, color: CRACK, alpha: 0.85 * a });
  }, { dark: true });
  t.draw(D, (g, u) => {
    const { drawn, a } = state(u);
    for (const p of paths) g.poly(part(p, drawn).map((v) => v - 1), false).stroke({ width: 1, color: STONE_HI, alpha: 0.4 * a });
  });
}

/** The stone's size for a throw of this weight: a boss's boulder, near a
 *  whole square across. */
const radius = (s: number, power: number) => s * 0.38 * Math.max(0.9, Math.min(1.3, power));

export const CONTINENTAL: Signature = {
  shake: 2,
  // It does not close on anything — it throws.
  lunge: false,

  deliver(t: FxTools, m: SigMoment, seconds: number) {
    const c = centre(m.from), s = m.size, S = seconds, st = stoneOf();
    const r = m.targets[0], to = r ? centre(r) : { x: c.x + m.ahead.x * s * 3, y: c.y + m.ahead.y * s * 3 };
    const R = radius(s, m.power[0] ?? 2), spin = (to.x >= c.x ? 1 : -1) * rand(5, 7);
    // TORN UP: the ground at its feet splits and the stone heaves up out of
    // it, earth falling away — then it is thrown.
    const UP = S * 0.38, FLY = S - UP;
    const lift = { x: c.x, y: c.y - s * 0.12 };
    cracks(t, { x: c.x, y: c.y + s * 0.15 }, 6, s * 0.6, S);
    t.draw(UP, (g, v) => {
      const e = easeOut(v);
      g.ellipse(c.x, c.y + s * 0.2, R * 1.1, R * 0.4).fill({ color: CRACK, alpha: 0.6 * Math.min(1, v * 4) });
      boulder(g, st, c.x, c.y + s * 0.2 + (lift.y - c.y - s * 0.2) * e, R * (0.75 + 0.25 * e), v * 0.6, Math.min(1, v * 5));
    }, { dark: true });
    dust(t, { x: c.x, y: c.y + s * 0.25 }, 6, s * 0.16, 70 * (s / 90), 0.8);
    for (let i = 0; i < Math.round(10 * t.quality); i++)
      t.later(rand(0.05, 0.9) * UP, () => t.spark(c.x + rand(-R, R), c.y + rand(-R, R) * 0.5, rand(-30, 30) * (s / 90), rand(-20, 40) * (s / 90), rand(0.3, 0.5), GRIT));
    // THROWN: a high lob, turning over as it goes, landing on the landing
    // frame. Its shadow runs along the ground under it, swelling and
    // darkening as it comes down. High, but not so high that a throw from the
    // top row leaves the board.
    const dx = to.x - lift.x, dy = to.y - lift.y, dist = Math.hypot(dx, dy);
    const H = Math.max(s * 0.9, dist * 0.35);
    const at = (q: number) => ({ x: lift.x + dx * q, y: lift.y + dy * q - H * 4 * q * (1 - q) });
    thrown = { stone: st, rot: UP * 0.6 + spin };
    t.draw(FLY, (g, v) => {
      const gx = lift.x + dx * v, gy = lift.y + dy * v + s * 0.12, h = 4 * v * (1 - v);
      g.ellipse(gx, gy, R * (0.6 + 0.4 * v), R * (0.25 + 0.15 * v)).fill({ color: CRACK, alpha: 0.2 + 0.4 * v * (1 - h * 0.5) });
      const p = at(v);
      boulder(g, st, p.x, p.y, R * (1 + 0.22 * h), UP * 0.6 + v * spin, 1);
    }, { delay: UP, dark: true });
    // Grit and clods shaken off it in flight.
    let acc = 0;
    t.draw(FLY, (_g, v, dt) => {
      acc += dt * 45 * t.quality;
      for (; acc >= 1; acc--) {
        const p = at(v), a = rand(0, TAU);
        t.spark(p.x + Math.cos(a) * R * 0.8, p.y + Math.sin(a) * R * 0.8, rand(-30, 30) * (s / 90), rand(-10, 40) * (s / 90), rand(0.3, 0.5), GRIT);
      }
    }, { delay: UP });
  },

  land(t: FxTools, m: SigMoment) {
    const s = m.size, c0 = centre(m.from), flew = thrown;
    thrown = null;
    m.targets.forEach((r, i) => crush(t, r, m.power[i] ?? 2, !!m.killed[i], s, c0, flew));
  },
};

/** The stone that flew is the stone that lands: the delivery leaves its look
 *  and its last turn here for the landing to pick up (a landing played with
 *  no delivery before it draws a fresh one). */
let thrown: { stone: Stone; rot: number } | null = null;

/** The boulder coming down on a card: it slams and flattens a little, the
 *  ground cracks wide, a crater, chunks and a ring of dust thrown out — then
 *  it breaks apart on a card that lives, or settles on the one it killed,
 *  rolls a little further the way it was going, and rocks back into the hole
 *  the body left (the game's rolling boulder takes over there). */
function crush(t: FxTools, r: Box, power: number, killed: boolean, s: number, from: Pt, flew: typeof thrown) {
  const c = centre(r), R = radius(s, power), st = flew?.stone ?? stoneOf(), floor = r.y + r.h * 0.95;
  const dx = c.x - from.x, dy = c.y - from.y, d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d;
  const k = Math.max(1, Math.min(1.6, power));
  // The ground round it, broken: cracks out past the square, a crater under
  // it, a ring of dust thrown out low.
  cracks(t, c, 9, s * 0.95, 0.55);
  t.draw(1.1, (g, u) => {
    const a = Math.min(1, u * 8) * (1 - clamp01((u - 0.6) / 0.4));
    g.ellipse(c.x, c.y + R * 0.3, R * 1.25, R * 0.55).fill({ color: CRACK, alpha: 0.6 * a });
  }, { dark: true });
  dust(t, c, 12, s * 0.2, 170 * (s / 90), 1.0, R * 0.8);
  rubble(t, c, Math.round(6 * k), [s * 0.05, s * 0.1], [220, 420], floor, s, R * 0.4);
  t.flash(c, 0xfff0d8, 0.18 * k * (s / 80));
  for (let i = 0; i < Math.round(14 * k); i++) {
    const a = (rand(-170, -10) * Math.PI) / 180, v = rand(180, 360) * (s / 90);
    t.spark(c.x + rand(-R, R) * 0.6, c.y + rand(-R, R) * 0.3, Math.cos(a) * v, Math.sin(a) * v, rand(0.3, 0.55), i % 2 ? CHIP : GRIT);
  }
  const rot0 = flew?.rot ?? rand(0, TAU);
  if (!killed) {
    // It breaks on a card that stands: flattened by the blow, then in pieces
    // thrown off it.
    t.draw(0.14, (g, u) => boulder(g, st, c.x, c.y + R * 0.1 * u, R * (1 + 0.08 * u), rot0, 1, 1 - 0.18 * u), { dark: true });
    t.later(0.14, () => {
      rubble(t, { x: c.x, y: c.y }, 6, [R * 0.34, R * 0.52], [170, 330], floor, s, R * 0.6);
      dust(t, c, 6, s * 0.18, 90 * (s / 90), 0.9);
    });
    return;
  }
  // It stays on the one it killed: a bounce, a roll on the way it was going,
  // and back — rocking still into the hole the body left.
  const D = 1.2;
  t.draw(D, (g, u) => {
    const time = u * D;
    const bounce = time < 0.2 ? Math.sin((time / 0.2) * Math.PI) * R * 0.3 : 0;
    const roll = time < 0.2 ? 0 : Math.sin(((time - 0.2) / 0.7) * Math.PI) * Math.exp(-(time - 0.2) * 2.2) * s * 0.3;
    const sq = time < 0.06 ? 1 - 0.15 * Math.sin((time / 0.06) * Math.PI) : 1;
    const a = time < 0.85 ? 1 : 1 - (time - 0.85) / 0.35;
    boulder(g, st, c.x + ux * roll, c.y + uy * roll - bounce, R, rot0 + roll / R, a, sq);
  }, { dark: true });
  t.later(0.25, () => dust(t, { x: c.x + ux * s * 0.2, y: c.y + uy * s * 0.2 + R * 0.5 }, 4, s * 0.14, 50 * (s / 90), 0.7));
}
