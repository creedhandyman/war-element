/** BASTION — Boulder Barrage. "Hurl boulders: 6 DMG and WEAKEN to up to 3
 *  opponents anywhere." — a bastion that adds two plates every round.
 *
 *  On its art Bastion is a colossal walking FORTRESS: a golem of castle walls
 *  and towers with a gate for a mouth, hurling huge blocks of masonry that arc
 *  high across the sky. So this is SIEGE ARTILLERY, and what it throws is
 *  dressed stone — squared blocks with mortar lines — not the rough rock the
 *  rest of BORE throws.
 *
 *  The DELIVERY is its battlements tearing loose: a crenellated wall-top
 *  shoulders up along the card's front edge, cracks run through the merlons,
 *  and one by one, a beat apart, they rip free as great masonry boulders and
 *  are hurled up in high catapult arcs, one per target. Each boulder swells as
 *  it climbs (it is coming up toward us) and its shadow slides along the board
 *  beneath it, darkening and tightening on the square it will hit — the
 *  catapult stone you can see coming.
 *
 *  The LANDING is the bombardment: each boulder comes down on its target in
 *  turn, a beat apart, and CRUSHES — a jolt of light, a crater, cracks
 *  spidering out through the card, and the boulder breaking apart into its
 *  dressed blocks, which tumble out and bounce, while dust rolls out low. A
 *  kill leaves the card under a heap of masonry that settles and fades.
 *
 *  Stone is SOLID, on the normal-blend layer (`dark: true`), as looks/bore.ts
 *  draws it: a mid-tone body, a lit face, a shadowed face, a dark edge. Light
 *  is only the jolt of the impact, the lit lip of a crack and the grit. */
import { centre, rand } from "../../looks/base";
import type { Graphics } from "pixi.js";
import type { FxTools, Pt, SparkStyle } from "../../looks/types";
import type { Signature, SigMoment } from "../types";

type Box = SigMoment["from"];

const TAU = Math.PI * 2;
// Dressed masonry, normal blend: greyer than BORE's sandstone, a fortress's.
const STONE = 0x9a8b78, STONE_HI = 0xd6c6a6, STONE_LO = 0x56493c, EDGE = 0x211810, MORTAR = 0x3a2e23;
const CRACK = 0x0e0906, DUST = 0xb39c80, SHADOW = 0x050403;
// Light, additive: grit, the jolt, a crack's lit lip.
const SAND = [0xfff1dc, 0xe8cfa8, 0xd9b48a, 0xa1887f];
const LIT = 0xd9bf98, JOLT = 0xffe8c0;
/** Grit shaken off a boulder in flight and off the wall: heavy, falling. */
const GRIT: SparkStyle = { palette: SAND, gravity: 950, drag: 0.6, size: [5, 2], streak: false };
/** Chips knocked off as a block breaks: fast little streaks that drop. */
const CHIP: SparkStyle = { palette: [0xfff1dc, 0xd9b48a], gravity: 1100, drag: 0.5, size: [5, 2], streak: true };

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeOut = (x: number) => 1 - (1 - x) * (1 - x);

/** When each boulder lands, s after the landing frame: a barrage, a beat apart. */
const BEAT = 0.1;

// ── Masonry ──────────────────────────────────────────────────────────────────

/** A dressed block at (x, y), `hw` x `hh` half-size, turned `rot`, its corners
 *  chamfered: the body, a shadowed face and a lit one (the light stays top-left
 *  however it tumbles), and a dark edge. `courses` lays mortar across it — a
 *  boulder torn out of a wall is several blocks still bonded together. */
function block(g: Graphics, x: number, y: number, hw: number, hh: number, rot: number, alpha: number, courses = false) {
  if (alpha <= 0.02 || hw < 0.8) return;
  const c = Math.cos(rot), s = Math.sin(rot), ch = Math.min(hw, hh) * 0.22;
  const local = [[-hw + ch, -hh], [hw - ch, -hh], [hw, -hh + ch], [hw, hh - ch], [hw - ch, hh], [-hw + ch, hh], [-hw, hh - ch], [-hw, -hh + ch]];
  const at = (lx: number, ly: number, k = 1, dx = 0, dy = 0) => [x + dx + (lx * c - ly * s) * k, y + dy + (lx * s + ly * c) * k];
  const face = (k: number, dx: number, dy: number) => local.flatMap(([lx, ly]) => at(lx, ly, k, dx, dy));
  const body = face(1, 0, 0), m = Math.max(hw, hh);
  g.poly(body, true).fill({ color: STONE, alpha });
  g.poly(face(0.7, m * 0.14, m * 0.16), true).fill({ color: STONE_LO, alpha: alpha * 0.7 });
  g.poly(face(0.62, -m * 0.15, -m * 0.17), true).fill({ color: STONE_HI, alpha: alpha * 0.8 });
  if (courses) {
    // A running bond: one bed joint across, a head joint above and below it
    // offset from each other — read at a glance as a chunk of wall.
    const w = Math.max(1, m * 0.09);
    g.poly([...at(-hw, 0), ...at(hw, 0)], false).stroke({ width: w, color: MORTAR, alpha });
    g.poly([...at(-hw * 0.25, -hh), ...at(-hw * 0.25, 0)], false).stroke({ width: w, color: MORTAR, alpha });
    g.poly([...at(hw * 0.35, 0), ...at(hw * 0.35, hh)], false).stroke({ width: w, color: MORTAR, alpha });
  }
  g.poly(body, true).stroke({ width: Math.max(1, m * 0.1), color: EDGE, alpha });
}

/** The battlement along a card's front edge: a wall-walk band and `n`
 *  merlons standing on it, facing out along `ahead`. Returns where each
 *  merlon stands and the band's line, so boulders can be torn from them. */
function battlement(r: Box, ahead: Pt, n: number) {
  const c = centre(r), s = Math.min(r.w, r.h);
  const along = { x: -ahead.y, y: ahead.x };
  const edge = { x: c.x + ahead.x * s * 0.3, y: c.y + ahead.y * s * 0.3 };
  const merlons = Array.from({ length: n }, (_, i) => {
    const f = (i - (n - 1) / 2) / n;
    return { x: edge.x + along.x * f * s * 0.95 + ahead.x * s * 0.09, y: edge.y + along.y * f * s * 0.95 + ahead.y * s * 0.09 };
  });
  return { edge, along, merlons, mw: s * 0.068, rot: Math.atan2(along.y, along.x) };
}

// ── What a falling boulder does ──────────────────────────────────────────────

/** Cracks spidering out of `at` through the ground: dark grooves drawn in fast
 *  with a lit lip, held, faded. */
function cracks(t: FxTools, at: Pt, reach: number, n: number) {
  const paths: number[][] = [], a0 = rand(0, TAU);
  for (let i = 0; i < n; i++) {
    let a = a0 + (i / n) * TAU + rand(-0.3, 0.3), x = at.x, y = at.y;
    const pts = [x, y], len = reach * rand(0.6, 1);
    for (let k = 0; k < 4; k++) {
      a += rand(-0.5, 0.5);
      x += Math.cos(a) * (len / 4); y += Math.sin(a) * (len / 4);
      pts.push(x, y);
    }
    paths.push(pts);
  }
  const D = 0.75, part = (p: number[], u: number) => p.slice(0, Math.max(2, Math.round((p.length / 2) * clamp01(u / 0.1))) * 2);
  const fade = (u: number) => 1 - clamp01((u - 0.55) / 0.45);
  t.draw(D, (g, u) => { for (const p of paths) g.poly(part(p, u), false).stroke({ width: 2.4, color: CRACK, alpha: 0.85 * fade(u) }); }, { dark: true });
  t.draw(D, (g, u) => {
    for (const p of paths) g.poly(part(p, u).map((v) => v - 1), false).stroke({ width: 1, color: LIT, alpha: 0.4 * fade(u) });
  });
}

/** Dust rolling out low from `at`: soft clouds pushed sideways that slow and
 *  settle — earth does not rise like smoke. */
function dust(t: FxTools, at: Pt, n: number, size: number, spread: number, life = 0.85) {
  const puffs = Array.from({ length: Math.max(1, Math.round(n * t.quality)) }, (_, i) => ({
    x: at.x + rand(-4, 4), y: at.y + rand(-3, 3), r: size * rand(0.6, 1), vx: (i % 2 ? 1 : -1) * rand(0.35, 1) * spread, vy: -rand(4, 20), age: 0, life: life * rand(0.8, 1.2),
  }));
  t.draw(life * 1.2, (g, _u, dt) => {
    for (const p of puffs) {
      p.age += dt;
      if (p.age >= p.life) continue;
      const q = p.age / p.life, rr = p.r * (1 + q * 1.6), a = q < 0.15 ? q / 0.15 : 1 - (q - 0.15) / 0.85;
      p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= Math.pow(0.12, dt);
      g.circle(p.x, p.y, rr).fill({ color: DUST, alpha: 0.16 * a }).circle(p.x, p.y, rr * 0.62).fill({ color: DUST, alpha: 0.22 * a });
    }
  }, { dark: true });
}

/** A boulder crushing down on a card: the jolt, a crater, cracks, the boulder
 *  bursting into the blocks it was built of — tumbling out, bouncing once on
 *  the card's floor — dust rolling low and chips flung. A kill heaps rubble. */
function crush(t: FxTools, r: Box, power: number, killed: boolean) {
  const p = centre(r), s = Math.min(r.w, r.h), k = Math.max(0.75, Math.min(1.6, power));
  const floor = r.y + r.h * 0.9, R = s * 0.24 * Math.sqrt(k);
  t.flash(p, JOLT, 0.2 * k * (s / 90));
  t.ring(r, 0xe8cfa8, 0.3, 1.15, 0.35, 4);
  t.draw(0.7, (g, u) => {
    const grow = easeOut(clamp01(u / 0.1)), a = 1 - clamp01((u - 0.3) / 0.7);
    g.ellipse(p.x, p.y + s * 0.06, R * 1.6 * grow, R * 1.1 * grow).fill({ color: CRACK, alpha: 0.62 * a });
  }, { dark: true });
  cracks(t, { x: p.x, y: p.y + s * 0.05 }, s * 0.6, 7);
  // The boulder itself, squashed flat for a blink as it hits, then gone into
  // its blocks.
  t.draw(0.08, (g, u) => block(g, p.x, p.y + s * 0.04 * u, R * (1.15 + 0.2 * u), R * (1 - 0.35 * u), 0, 1 - u * 0.6, true), { dark: true });
  const n = Math.max(3, Math.round((5 + 2 * k) * t.quality));
  const blocks = Array.from({ length: n }, () => {
    const a = (rand(-170, -10) * Math.PI) / 180, v = rand(140, 300) * (s / 90);
    return { x: p.x + rand(-R, R) * 0.6, y: p.y + rand(-R, R) * 0.4, vx: Math.cos(a) * v, vy: Math.sin(a) * v, rot: rand(0, TAU), vr: rand(-9, 9),
      hw: s * rand(0.075, 0.11), hh: s * rand(0.045, 0.065), age: 0, life: rand(0.55, 0.75) };
  });
  t.draw(0.78, (g, _u, dt) => {
    for (const b of blocks) {
      b.age += dt;
      if (b.age >= b.life) continue;
      b.vy += 1500 * (s / 90) * dt;
      b.x += b.vx * dt; b.y += b.vy * dt; b.rot += b.vr * dt;
      if (b.y > floor && b.vy > 0) { b.y = floor; b.vy *= -0.3; b.vx *= 0.5; b.vr *= 0.4; }
      block(g, b.x, b.y, b.hw, b.hh, b.rot, b.age > b.life * 0.7 ? 1 - (b.age - b.life * 0.7) / (b.life * 0.3) : 1);
    }
  }, { dark: true, delay: 0.04 });
  dust(t, { x: p.x, y: floor - s * 0.12 }, 8, s * 0.22, 130 * (s / 90));
  for (let i = 0; i < Math.round(10 * k); i++) {
    const a = (rand(-160, -20) * Math.PI) / 180, v = rand(150, 320) * (s / 90);
    t.spark(p.x + rand(-R, R), p.y, Math.cos(a) * v, Math.sin(a) * v, rand(0.3, 0.5), CHIP);
  }
  if (killed) t.later(0.12, () => rubble(t, r, s));
}

/** What a kill leaves: the card under a heap of masonry, the blocks dropping
 *  into place one after another, a last roll of dust, then fading. */
function rubble(t: FxTools, r: Box, s: number) {
  const p = centre(r), base = r.y + r.h * 0.86;
  const heap = [[-0.26, 0], [0, 0], [0.26, 0], [-0.13, -1], [0.13, -1], [0, -2]].map(([fx, row], i) => ({
    x: p.x + fx * s + rand(-2, 2), y: base + row * s * 0.12 - s * 0.06, rot: rand(-0.25, 0.25), d: i * 0.04,
  }));
  const D = 0.85;
  t.draw(D, (g, u) => {
    const time = u * D, a = 1 - clamp01((time - 0.55) / 0.3);
    for (const h of heap) {
      const q = clamp01((time - h.d) / 0.1);
      if (q > 0) block(g, h.x, h.y - s * 0.4 * (1 - q * q), s * 0.13, s * 0.065, h.rot, a);
    }
  }, { dark: true });
  t.later(0.22, () => dust(t, { x: p.x, y: base }, 6, s * 0.2, 110 * (s / 90), 0.7));
}

export const BASTION: Signature = {
  shake: 1.4,
  // A fortress does not step out: it throws from where it stands.
  lunge: false,

  deliver(t: FxTools, m: SigMoment, seconds: number) {
    const T = seconds, s = m.size, n = m.targets.length;
    if (!n) return;
    // Five merlons on the wall; the boulders tear out of the ones between the
    // ends, so a gap opens in the wall for each throw.
    const W = battlement(m.from, m.ahead, 5);
    const pick = [1, 3, 2, 0, 4];
    const LAUNCH = (i: number) => T * (0.3 + 0.13 * i);
    const torn = new Set<number>();

    // THE WALL-TOP: shouldering up out of the card's front edge, merlons on
    // it, each gone from the moment its boulder leaves.
    const D = T + 0.25;
    t.draw(D, (g, u) => {
      const time = u * D, rise = easeOut(clamp01(time / (T * 0.25))), a = 1 - clamp01((time - T) / 0.25);
      const lift = (1 - rise) * s * 0.18;
      const ex = W.edge.x + m.ahead.x * (s * 0.02 - lift), ey = W.edge.y + m.ahead.y * (s * 0.02 - lift);
      block(g, ex, ey, s * 0.46, s * 0.05, W.rot, a * rise);
      W.merlons.forEach((mp, i) => {
        if (torn.has(i)) return;
        const shake = time > T * 0.18 ? Math.sin(time * 70 + i * 2) * s * 0.008 : 0;
        block(g, mp.x - m.ahead.x * lift + shake, mp.y - m.ahead.y * lift, W.mw, s * 0.08, W.rot, a * rise, false);
      });
    }, { dark: true });
    // Cracks through the merlons about to go.
    for (let i = 0; i < Math.min(n, 3); i++) {
      const mp = W.merlons[pick[i]];
      t.later(T * 0.15, () => cracks(t, mp, s * 0.16, 3));
    }

    m.targets.slice(0, 5).forEach((r, i) => {
      const go = LAUNCH(Math.min(i, 3)), arrive = T + BEAT * i, F = arrive - go;
      const mi = pick[i % pick.length], start = W.merlons[mi], end = centre(r);
      const dist = Math.hypot(end.x - start.x, end.y - start.y);
      // High — but kept on the board, so it is never lost off the top: the
      // tallest arc whose every point stays below the board's top edge.
      let H = s * 1.2 + dist * 0.3;
      for (let q = 0.05; q < 1; q += 0.05) H = Math.min(H, (start.y + (end.y - start.y) * q - (m.board.y + s * 0.3)) / (4 * q * (1 - q)));
      H = Math.max(s * 0.6, H);
      const R0 = s * 0.11, R1 = s * 0.25 * Math.sqrt(Math.max(0.75, Math.min(1.5, m.power[i] ?? 1)));
      const spin = rand(2.5, 4.5) * (end.x >= start.x ? 1 : -1), rot0 = W.rot;
      t.later(go, () => {
        torn.add(mi);
        dust(t, start, 3, s * 0.12, 50 * (s / 90), 0.55);
        t.emit({ count: 8, palette: SAND, from: { x: start.x - s * 0.08, y: start.y - 3, w: s * 0.16, h: 6 }, dir: [-140, -40], speed: [60, 150],
          gravity: 950, drag: 0.6, life: [0.25, 0.45], size: [5, 2] });
      });
      // Its ground track: x and y run straight, the height is a parabola.
      const ground = (q: number) => ({ x: start.x + (end.x - start.x) * q, y: start.y + (end.y - start.y) * q });
      const height = (q: number) => 4 * q * (1 - q) * H;
      // The shadow, sliding along under it, darker and tighter as it comes down.
      t.draw(F, (g, u) => {
        const gp = ground(u), lowness = 1 - height(u) / H;
        g.ellipse(gp.x, gp.y + s * 0.08, R1 * (1.6 - 0.5 * lowness), R1 * (0.9 - 0.3 * lowness)).fill({ color: SHADOW, alpha: 0.05 + 0.5 * lowness * u });
      }, { dark: true, delay: go });
      // The boulder: swelling as it climbs toward us, tumbling slowly.
      t.draw(F, (g, u) => {
        const gp = ground(u), hgt = height(u), size = (R0 + (R1 - R0) * Math.min(1, u * 2.5)) * (1 + 0.3 * (hgt / H));
        block(g, gp.x, gp.y - hgt, size, size * 0.86, rot0 + spin * u * F, 1, true);
      }, { dark: true, delay: go });
      // Grit shaken off it all the way, thinning as it flies.
      let acc = 0;
      t.draw(F, (_g, u, dt) => {
        acc += dt * 30 * t.quality * (1 - 0.5 * u);
        for (; acc >= 1; acc--) {
          const gp = ground(u);
          t.spark(gp.x + rand(-4, 4), gp.y - height(u) + rand(-4, 4), rand(-30, 30), rand(-10, 40), rand(0.25, 0.4), GRIT);
        }
      }, { delay: go });
    });
  },

  land(t: FxTools, m: SigMoment) {
    // Each comes down on its own beat, as the delivery threw them.
    m.targets.forEach((r, i) => {
      const hit = () => crush(t, r, m.power[i] ?? 1, !!m.killed[i]);
      if (i === 0) hit();
      else t.later(BEAT * i, hit);
    });
  },
};
