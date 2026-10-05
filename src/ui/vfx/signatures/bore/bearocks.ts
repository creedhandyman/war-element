/** BEAROCKS — Blunt Bash. "Deal 8 DMG and SLEEP all opponents in range for 2
 *  rounds." Everything next to it, clubbed senseless at once.
 *
 *  Its art is a huge bear built of dark cave rock and spiked stone plates,
 *  blue crystal gems set in its armour, roaring, a crystal-headed MACE lying
 *  at its feet. Nothing takes hold of it; it puts things down instead.
 *
 *  The DELIVERY is the bear rearing up: the ground gives under its weight,
 *  pebbles shiver loose round it, the blue gems in its armour flare one after
 *  another, and the stone mace comes up and back over its shoulder — growing
 *  as it lifts toward us — then tips over the top for the blow.
 *
 *  The LANDING is the slam, and the slam IS the move. The mace comes down on
 *  the ground just in front of the bear: the head smashes in, crystal chips
 *  fly off it, cracks race out, and a SHOCK RING of cracking earth runs out
 *  from the bear's square, rock shouldered up along its front and dust
 *  rolling behind it. Where the ring reaches a card, that card is clubbed: a
 *  dent of cracks, rock shards thrown away from the bear, a concussion ring of
 *  dust bursting off it, one blue gem glint knocked loose and bouncing away —
 *  and then the card is dazed, a slow wobbling ring of dust motes drifting
 *  round its head (the SLEEP, drawn as a blow to the head, not a lullaby).
 *
 *  Stone is SOLID, on the normal-blend layer (see looks/bore.ts): body, lit
 *  face, shadowed face, dark edge. Light is only the blue of the crystals, the
 *  lit lips of the cracks and the grit. */
import type { Graphics } from "pixi.js";
import { centre, rand } from "../../looks/base";
import type { FxTools, Pt, SparkStyle } from "../../looks/types";
import type { Signature, SigMoment } from "../types";

type Box = SigMoment["from"];

const TAU = Math.PI * 2;
// The bear's stone: darker and greyer than BORE's sandstone — cave rock.
const ROCK = 0x625a52, ROCK_HI = 0xaea292, ROCK_LO = 0x37312c, EDGE = 0x141110;
// The mace's haft: dark wood bound in iron.
const HAFT = 0x3b2b1f, HAFT_HI = 0x9a7a58;
// The ground breaking.
const CRACK = 0x0e0906, DUST = 0xb2a28e, LIT = 0xdcc8a8;
// The blue crystal set in its armour and its mace (additive: light).
const GEM = 0x3d9bff, GEM_HI = 0xa8deff, GEM_WHITE = 0xf2fbff, GEM_DEEP = 0x1d5ab0;
/** Grit: small, heavy, falling — stone does not float. */
const GRIT: SparkStyle = { palette: [0xfff1dc, 0xe0cba8, 0xb8a080, 0x8a7a68], gravity: 950, drag: 0.6, size: [5, 2], streak: false };
/** Chips of stone knocked off the slam: fast little streaks that drop. */
const CHIP: SparkStyle = { palette: [0xfff6e6, 0xd9c09a], gravity: 1100, drag: 0.5, size: [4, 2], streak: true };
/** Splinters of blue crystal struck off the mace head. */
const SHARD: SparkStyle = { palette: [GEM_WHITE, GEM_HI, GEM, GEM_DEEP], gravity: 900, drag: 0.55, size: [4, 1.5], streak: true };

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeOut = (x: number) => 1 - (1 - x) * (1 - x);
const easeIn = (x: number) => x * x;

/** "Ahead", made safe to build on: a unit vector, up if it came in empty. */
function unit(v: Pt): Pt {
  const l = Math.hypot(v.x, v.y);
  return l > 1e-6 ? { x: v.x / l, y: v.y / l } : { x: 0, y: -1 };
}

// ── Stone ────────────────────────────────────────────────────────────────────

/** A rock's outline: corners at uneven angles and radii, [angle, radius]. */
function rockShape(n = 5 + Math.floor(rand(0, 3))): number[] {
  const out: number[] = [], a0 = rand(0, TAU);
  for (let i = 0; i < n; i++) out.push(a0 + (i / n) * TAU + rand(-0.25, 0.25), rand(0.72, 1));
  return out;
}

/** A rock at (x, y), `size` its radius, turned `rot`: a body, a shadowed face,
 *  a lit face and a dark edge, the light staying top-left as it tumbles. */
function rock(g: Graphics, x: number, y: number, size: number, rot: number, rk: number[], alpha: number) {
  if (alpha <= 0.02 || size < 1) return;
  const face = (k: number, dx: number, dy: number) => {
    const p: number[] = [];
    for (let i = 0; i < rk.length; i += 2) p.push(x + dx + Math.cos(rk[i] + rot) * rk[i + 1] * size * k, y + dy + Math.sin(rk[i] + rot) * rk[i + 1] * size * k);
    return p;
  };
  const body = face(1, 0, 0);
  g.poly(body, true).fill({ color: ROCK, alpha });
  g.poly(face(0.62, size * 0.16, size * 0.18), true).fill({ color: ROCK_LO, alpha: alpha * 0.75 });
  g.poly(face(0.5, -size * 0.2, -size * 0.22), true).fill({ color: ROCK_HI, alpha: alpha * 0.85 });
  g.poly(body, true).stroke({ width: Math.max(1, size * 0.12), color: EDGE, alpha });
}

/** Chunks thrown from `at` — up and out (round `away` when given, else every
 *  way upward), spinning, falling back to bounce once on `floor`. */
function rubble(t: FxTools, at: Pt, n: number, size: [number, number], speed: [number, number], floor: number, sc: number, away?: number) {
  const chunks = Array.from({ length: Math.max(1, Math.round(n * t.quality)) }, () => {
    const a = away === undefined ? (rand(-165, -15) * Math.PI) / 180 : away + rand(-1.1, 1.1);
    const v = rand(speed[0], speed[1]) * sc;
    return { x: at.x, y: at.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - rand(80, 180) * sc, rot: rand(0, TAU), vr: rand(-9, 9),
      size: rand(size[0], size[1]), rk: rockShape(), age: 0, life: rand(0.5, 0.7), floor: floor + rand(-4, 4) * sc };
  });
  t.draw(0.7, (g, _u, dt) => {
    for (const c of chunks) {
      c.age += dt;
      if (c.age >= c.life) continue;
      c.vy += 1500 * sc * dt;
      c.x += c.vx * dt; c.y += c.vy * dt; c.rot += c.vr * dt;
      if (c.y > c.floor && c.vy > 0) { c.y = c.floor; c.vy *= -0.3; c.vx *= 0.55; c.vr *= 0.5; }
      rock(g, c.x, c.y, c.size, c.rot, c.rk, c.age > c.life * 0.7 ? 1 - (c.age - c.life * 0.7) / (c.life * 0.3) : 1);
    }
  }, { dark: true });
}

/** Dust rolling out low from a point: soft clouds pushed sideways that slow
 *  and settle — earth does not rise like smoke. */
function dust(t: FxTools, at: Pt, n: number, size: number, spread: number, life = 0.8, delay = 0) {
  const puffs = Array.from({ length: Math.max(1, Math.round(n * t.quality)) }, (_, i) => ({
    x: at.x + rand(-4, 4), y: at.y + rand(-3, 3), r: size * rand(0.6, 1),
    vx: (i % 2 ? 1 : -1) * rand(0.35, 1) * spread, vy: -size * rand(0.3, 1.2), age: 0, life: life * rand(0.8, 1.2),
  }));
  t.draw(life * 1.2, (g, _u, dt) => {
    for (const p of puffs) {
      p.age += dt;
      if (p.age >= p.life) continue;
      const q = p.age / p.life;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= Math.pow(0.12, dt);
      const rr = p.r * (1 + q * 1.6), a = q < 0.15 ? q / 0.15 : 1 - (q - 0.15) / 0.85;
      g.circle(p.x, p.y, rr).fill({ color: DUST, alpha: 0.15 * a }).circle(p.x, p.y, rr * 0.62).fill({ color: DUST, alpha: 0.2 * a });
    }
  }, { dark: true, delay });
}

/** Cracks run out of a point through the ground: dark grooves drawn in over
 *  `drawIn`, held, faded, each with a lit lip where the broken edge catches
 *  the light. */
function cracks(t: FxTools, at: Pt, n: number, reach: number, hold: number, width = 2.4, drawIn = 0.07) {
  const paths: number[][] = [], a0 = rand(0, TAU);
  for (let i = 0; i < n; i++) {
    let ang = a0 + (i / n) * TAU + rand(-0.3, 0.3), x = at.x, y = at.y;
    const len = reach * rand(0.6, 1), pts = [x, y];
    for (let k = 1; k <= 4; k++) {
      ang += rand(-0.45, 0.45);
      x += Math.cos(ang) * (len / 4);
      y += Math.sin(ang) * (len / 4);
      pts.push(x, y);
    }
    paths.push(pts);
  }
  const D = drawIn + hold + 0.25;
  const state = (u: number) => ({ drawn: clamp01((u * D) / drawIn), a: u * D < drawIn + hold ? 1 : 1 - (u * D - drawIn - hold) / 0.25 });
  const part = (p: number[], drawn: number) => p.slice(0, Math.max(2, Math.round((p.length / 2) * drawn)) * 2);
  t.draw(D, (g, u) => {
    const { drawn, a } = state(u);
    for (const p of paths) g.poly(part(p, drawn), false).stroke({ width, color: CRACK, alpha: 0.85 * a });
  }, { dark: true });
  t.draw(D, (g, u) => {
    const { drawn, a } = state(u);
    for (const p of paths) g.poly(part(p, drawn).map((v) => v - 1), false).stroke({ width: 1, color: LIT, alpha: 0.4 * a });
  });
}

// ── Crystal ──────────────────────────────────────────────────────────────────

/** A cut blue gem at (x, y), `r` tall, turned `rot`: a long rhombus of light
 *  with a white facet line down it — the stones set in its armour. */
function gem(g: Graphics, x: number, y: number, r: number, rot: number, alpha: number) {
  if (alpha <= 0.02 || r < 0.5) return;
  const c = Math.cos(rot), s = Math.sin(rot), w = r * 0.62;
  const p = (a: number, b: number) => [x + c * a - s * b, y + s * a + c * b];
  const pts = [...p(0, -r), ...p(w, -r * 0.15), ...p(0, r), ...p(-w, -r * 0.15)];
  g.poly(pts, true).fill({ color: GEM, alpha: 0.7 * alpha }).stroke({ width: 1, color: GEM_HI, alpha });
  g.poly([...p(-w * 0.35, -r * 0.3), ...p(0, -r * 0.82), ...p(w * 0.2, -r * 0.2)], false).stroke({ width: 1, color: GEM_WHITE, alpha: 0.9 * alpha });
}

/** A four-pointed glint: a gem catching the light. */
function glint(g: Graphics, x: number, y: number, r: number, alpha: number) {
  if (alpha <= 0.02 || r < 0.5) return;
  g.moveTo(x - r, y).lineTo(x + r, y).moveTo(x, y - r).lineTo(x, y + r).stroke({ width: 1.2, color: GEM_WHITE, alpha });
  g.circle(x, y, r * 0.3).fill({ color: GEM_WHITE, alpha });
}

// ── The mace ─────────────────────────────────────────────────────────────────

/** The crystal-headed mace, its grip at `grip` and its head at `head`, drawn
 *  `z` times its size (bigger is nearer: lifted toward us). The stone head is
 *  studded with crystal points — the dark pass draws the haft and the stone,
 *  the lit pass the haft's sheen, the crystal and (by `flare`) their glow. */
function mace(g: Graphics, grip: Pt, head: Pt, s: number, z: number, rk: number[], rot: number, alpha: number, lit: boolean, flare = 0) {
  if (alpha <= 0.02) return;
  const R = s * 0.22 * z, hw = s * 0.035 * z;
  const dx = head.x - grip.x, dy = head.y - grip.y, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
  const tail = { x: grip.x - ux * s * 0.08 * z, y: grip.y - uy * s * 0.08 * z };
  if (!lit) {
    g.moveTo(tail.x, tail.y).lineTo(head.x, head.y).stroke({ width: hw * 2 + 2, color: EDGE, alpha, cap: "round" });
    g.moveTo(tail.x, tail.y).lineTo(head.x, head.y).stroke({ width: hw * 2, color: HAFT, alpha, cap: "round" });
    rock(g, head.x, head.y, R, rot, rk, alpha);
    return;
  }
  // The haft's lit edge, and the iron bands on it.
  g.moveTo(tail.x - uy * hw * 0.5, tail.y + ux * hw * 0.5).lineTo(head.x - uy * hw * 0.5, head.y + ux * hw * 0.5)
    .stroke({ width: 1, color: HAFT_HI, alpha: 0.6 * alpha });
  for (const f of [0.25, 0.6]) {
    const bx = tail.x + (head.x - tail.x) * f, by = tail.y + (head.y - tail.y) * f;
    g.moveTo(bx - uy * hw, by + ux * hw).lineTo(bx + uy * hw, by - ux * hw).stroke({ width: 1.5, color: LIT, alpha: 0.55 * alpha });
  }
  if (flare > 0.02) g.circle(head.x, head.y, R * 1.3).fill({ color: GEM, alpha: 0.12 * flare * alpha });
  // Crystals set into the stone head, studs rather than spikes: it is a
  // club, and the stone has to read first.
  for (let i = 0; i < 3; i++) {
    const a = rot + (i / 3) * TAU + 0.3;
    gem(g, head.x + Math.cos(a) * R * 0.42, head.y + Math.sin(a) * R * 0.42, R * 0.3, a + Math.PI / 2, alpha * (0.6 + 0.4 * flare));
  }
  g.circle(head.x - R * 0.12, head.y - R * 0.12, R * 0.82).stroke({ width: 1.4, color: LIT, alpha: 0.4 * alpha });
}

/** Where the gems sit on the bear's own card (the art is upright on screen):
 *  chest, two shoulders, belly. */
const ARMOUR_GEMS: [number, number][] = [[0, 0.04], [-0.27, -0.14], [0.27, -0.14], [0.02, 0.3]];

export const BEAROCKS: Signature = {
  shake: 1.8,
  // It does not close on anything: it brings the mace down where it stands
  // and the ground carries the blow.
  lunge: false,

  deliver(t: FxTools, m: SigMoment, seconds: number) {
    const c = centre(m.from), s = m.size, sc = s / 90, u = unit(m.ahead), n = { x: -u.y, y: u.x }, S = seconds;
    const grip = { x: c.x + n.x * s * 0.2 + u.x * s * 0.06, y: c.y + n.y * s * 0.2 + u.y * s * 0.06 };
    const rk = rockShape(8), rot0 = rand(0, TAU);
    // Up and back over its shoulder, then tipping over the top.
    const TIP = 0.14;
    const head = (time: number) => {
      const e = easeOut(clamp01(time / (S * 0.7))), tr = Math.sin(time * 70) * s * 0.012 * e;
      const back = { x: c.x - u.x * s * (0.12 + 0.34 * e) + n.x * (s * 0.12 + tr), y: c.y - u.y * s * (0.12 + 0.34 * e) + n.y * (s * 0.12 + tr) };
      const q = easeIn(clamp01((time - S * (1 - TIP)) / (S * TIP)));
      const over = { x: c.x + u.x * s * 0.05 + n.x * s * 0.06, y: c.y + u.y * s * 0.05 + n.y * s * 0.06 };
      return { p: { x: back.x + (over.x - back.x) * q, y: back.y + (over.y - back.y) * q }, z: 0.75 + 0.45 * e + 0.2 * q };
    };
    t.draw(S, (g, v) => {
      const h = head(v * S);
      mace(g, grip, h.p, s, h.z, rk, rot0 + v * 0.6, clamp01(v * 6), false);
    }, { dark: true });
    t.draw(S, (g, v) => {
      const time = v * S, h = head(time);
      mace(g, grip, h.p, s, h.z, rk, rot0 + v * 0.6, clamp01(v * 6), true, easeIn(v));
      // The gems in its armour flare one after another as it rears.
      ARMOUR_GEMS.forEach(([gx, gy], i) => {
        const k = clamp01((v - 0.1 - i * 0.14) / 0.3), fl = k * (0.8 + 0.2 * Math.sin(time * 40 + i * 2));
        const x = c.x + gx * s, y = c.y + gy * s, since = v - 0.1 - i * 0.14 - 0.3;
        g.circle(x, y, s * 0.09).fill({ color: GEM, alpha: 0.22 * fl });
        gem(g, x, y, s * 0.055, 0, fl);
        if (since > 0) glint(g, x, y, s * 0.12, 0.9 * clamp01(1 - since * 4));
      });
    });
    t.charge(c, s * 0.8, GEM, 0.22, S);
    // Its weight comes off the ground: cracks under it, pebbles shivering
    // loose and hanging round it, dust at its feet.
    const feet = { x: c.x, y: c.y + s * 0.34 };
    cracks(t, feet, 5, s * 0.5, S * 0.5, 2, S * 0.4);
    const pebbles = Array.from({ length: 4 }, (_, i) => ({ a: (i / 4) * TAU + rand(-0.3, 0.3), rk: rockShape(6), size: s * rand(0.045, 0.07) }));
    t.draw(S, (g, v) => {
      const lift = easeOut(Math.min(1, v * 1.6)), a = Math.min(1, v * 5) * (v > 0.85 ? (1 - v) / 0.15 : 1);
      for (const p of pebbles) {
        const x = c.x + Math.cos(p.a + v * 0.8) * s * 0.46;
        const y = feet.y - s * 0.3 * lift + Math.sin(p.a + v * 0.8) * s * 0.12 + Math.sin(v * 60 + p.a) * 1.2;
        rock(g, x, y, p.size, v * 2 + p.a, p.rk, a);
      }
    }, { dark: true });
    dust(t, feet, 5, s * 0.13, 60 * sc, 0.7);
    let grit = 0;
    t.draw(S, (_g, v, dt) => {
      grit += dt * 18 * t.quality * (0.4 + v);
      for (; grit >= 1; grit--) t.spark(c.x + rand(-0.4, 0.4) * s, feet.y - rand(0, 0.15) * s, rand(-20, 20) * sc, -rand(40, 110) * sc, rand(0.3, 0.45), GRIT);
    });
  },

  land(t: FxTools, m: SigMoment) {
    const c = centre(m.from), s = m.size, sc = s / 90, u = unit(m.ahead), n = { x: -u.y, y: u.x };
    const grip = { x: c.x + n.x * s * 0.2 + u.x * s * 0.06, y: c.y + n.y * s * 0.2 + u.y * s * 0.06 };
    const over = { x: c.x + u.x * s * 0.05 + n.x * s * 0.06, y: c.y + u.y * s * 0.05 + n.y * s * 0.06 };
    const P = { x: c.x + u.x * s * 0.64 + n.x * s * 0.06, y: c.y + u.y * s * 0.64 + n.y * s * 0.06 };
    const rk = rockShape(8), rot0 = rand(0, TAU);

    // THE SLAM: the mace comes down over the front edge, shrinking as it falls
    // away from us, and stays a moment in the broken ground.
    const SLAM = 0.07, D = 0.45;
    const head = (time: number) => {
      const q = easeIn(clamp01(time / SLAM)), jolt = time > SLAM && time < SLAM + 0.06 ? Math.sin(((time - SLAM) / 0.06) * Math.PI) * s * 0.03 : 0;
      return { p: { x: over.x + (P.x - over.x) * q + u.x * jolt, y: over.y + (P.y - over.y) * q + u.y * jolt }, z: 1.4 - 0.35 * q };
    };
    const alpha = (time: number) => (time < 0.28 ? 1 : Math.max(0, 1 - (time - 0.28) / (D - 0.28)));
    t.draw(D, (g, v) => {
      const time = v * D, h = head(time);
      mace(g, grip, h.p, s, h.z, rk, rot0, alpha(time), false);
    }, { dark: true });
    t.draw(D, (g, v) => {
      const time = v * D, h = head(time);
      // The rush of the swing behind the head as it comes down.
      if (time < SLAM + 0.04) {
        const k = clamp01(time / SLAM) * (1 - clamp01((time - SLAM) / 0.04));
        for (const o of [-1, 0, 1]) {
          const ox = n.x * o * s * 0.08, oy = n.y * o * s * 0.08;
          g.moveTo(over.x + ox - u.x * s * 0.1, over.y + oy - u.y * s * 0.1).lineTo(h.p.x + ox, h.p.y + oy)
            .stroke({ width: 2, color: LIT, alpha: 0.45 * k, cap: "round" });
        }
      }
      mace(g, grip, h.p, s, h.z, rk, rot0, alpha(time), true, 1 - clamp01((time - SLAM) / 0.3));
    });

    // The head smashing in: crystal chips struck off it, a crater, cracks,
    // rock and dust thrown out of the hole.
    t.later(SLAM, () => {
      t.flash(P, GEM_HI, 0.3 * sc);
      t.flash(P, LIT, 0.25 * sc, 0.02);
      cracks(t, P, 8, s * 0.75, 0.42, 2.6);
      t.draw(0.55, (g, v) => {
        g.ellipse(P.x, P.y + s * 0.03, s * 0.2, s * 0.13).fill({ color: CRACK, alpha: 0.6 * Math.min(1, v * 10) * (1 - v) });
      }, { dark: true });
      rubble(t, P, 6, [s * 0.04, s * 0.08], [160, 320], P.y + s * 0.2, sc);
      dust(t, { x: P.x, y: P.y + s * 0.1 }, 7, s * 0.17, 120 * sc, 0.85);
      const nShard = Math.round(12 * t.quality);
      for (let i = 0; i < nShard; i++) {
        const a = rand(0, TAU), v = rand(140, 300) * sc;
        t.spark(P.x, P.y, Math.cos(a) * v, Math.sin(a) * v - rand(60, 160) * sc, rand(0.3, 0.5), SHARD);
      }
      for (let i = 0; i < Math.round(10 * t.quality); i++) {
        const a = (rand(-170, -10) * Math.PI) / 180, v = rand(150, 320) * sc;
        t.spark(P.x, P.y, Math.cos(a) * v, Math.sin(a) * v, rand(0.3, 0.5), CHIP);
      }
    });

    // THE SHOCK RING: cracking earth running out from the bear's square to
    // everything in reach, rock shouldered up along its front, dust behind.
    const hits = m.targets.map((r, i) => {
      const p = centre(r);
      return { r, p, d: Math.hypot(p.x - c.x, p.y - c.y), power: m.power[i] ?? 1, killed: !!m.killed[i] };
    });
    const R0 = s * 0.55, reach = Math.max(s * 1.5, ...hits.map((h) => h.d + s * 0.4));
    const RUN = 0.38, RD = RUN + 0.32;
    const radius = (time: number) => R0 + (reach - R0) * easeOut(clamp01(time / RUN));
    const fade = (time: number) => 1 - clamp01((time - RUN * 0.6) / (RD - RUN * 0.6));
    const N = 48, jag = Array.from({ length: N }, () => rand(-1, 1));
    const ringPts = (r: number, off: number) => {
      const pts: number[] = [];
      for (let i = 0; i < N; i++) {
        const a = (i / N) * TAU, rr = r * (1 + 0.045 * jag[i]) + off;
        pts.push(c.x + Math.cos(a) * rr, c.y + Math.sin(a) * rr);
      }
      return pts;
    };
    const nHeave = Math.round(16 * t.quality);
    const heave = Array.from({ length: nHeave }, (_, i) => ({
      a: (i / nHeave) * TAU + rand(-0.15, 0.15), rk: rockShape(), size: s * rand(0.05, 0.085), rot: rand(0, TAU), ph: rand(0, TAU),
    }));
    t.later(SLAM, () => {
      t.draw(RD, (g, v) => {
        const time = v * RD, r = radius(time), a = fade(time), w = s * (0.3 - 0.12 * clamp01(time / RUN));
        g.circle(c.x, c.y, Math.max(1, r - w / 2)).stroke({ width: w, color: DUST, alpha: 0.14 * a });
        g.poly(ringPts(r, 0), true).stroke({ width: 3.2, color: CRACK, alpha: 0.9 * a, join: "round" });
        // The ground fractures across the front: short broken ticks, in and out.
        for (let i = 0; i < N; i += 2) {
          const a0 = (i / N) * TAU, len = s * (0.07 + 0.05 * jag[i + 1]), kink = jag[(i + 5) % N] * 0.08;
          const r0 = r - len * 0.7, r1 = r + len;
          g.moveTo(c.x + Math.cos(a0) * r0, c.y + Math.sin(a0) * r0)
            .lineTo(c.x + Math.cos(a0 + kink) * r, c.y + Math.sin(a0 + kink) * r)
            .lineTo(c.x + Math.cos(a0) * r1, c.y + Math.sin(a0) * r1)
            .stroke({ width: 2, color: CRACK, alpha: 0.85 * a });
        }
        // Rock shouldered up as the front passes, bobbing along it.
        for (const h of heave) {
          const bob = Math.abs(Math.sin(time * 18 + h.ph)) * s * 0.03;
          rock(g, c.x + Math.cos(h.a) * (r + s * 0.02), c.y + Math.sin(h.a) * (r + s * 0.02) - bob, h.size * (0.6 + 0.4 * a), h.rot + time * 4, h.rk, a);
        }
      }, { dark: true });
      t.draw(RD, (g, v) => {
        const time = v * RD, r = radius(time), a = fade(time);
        g.poly(ringPts(r, -1.5), true).stroke({ width: 1.4, color: LIT, alpha: 0.7 * a, join: "round" });
        g.circle(c.x, c.y, r + s * 0.06).stroke({ width: 2, color: LIT, alpha: 0.22 * a });
      });
      let grit = 0;
      t.draw(RUN, (_g, v, dt) => {
        const r = radius(v * RUN);
        grit += dt * 70 * t.quality;
        for (; grit >= 1; grit--) {
          const a = rand(0, TAU), vv = rand(40, 120) * sc;
          t.spark(c.x + Math.cos(a) * r, c.y + Math.sin(a) * r, Math.cos(a) * vv, Math.sin(a) * vv - rand(60, 140) * sc, rand(0.25, 0.4), GRIT);
        }
      });
      // Dust rolling out behind the front.
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU + rand(-0.3, 0.3), r = (R0 + reach) * 0.5;
        dust(t, { x: c.x + Math.cos(a) * r, y: c.y + Math.sin(a) * r }, 2, s * 0.13, 50 * sc, 0.7, RUN * 0.45);
      }
      // Each card clubbed as the ring reaches it.
      for (const h of hits) {
        const at = clamp01((h.d - R0) / Math.max(1, reach - R0));
        t.later(RUN * (1 - Math.sqrt(1 - at)), () => club(t, h.r, h.p, c, h.power, h.killed));
      }
    });
  },
};

/** A card the shock reaches, clubbed: a dent of cracks, rock thrown away from
 *  the bear, a concussion ring of dust bursting off it, one blue gem glint
 *  knocked loose and bouncing away — then dazed, dust motes wobbling slowly
 *  round its head. A kill breaks it wider. */
function club(t: FxTools, r: Box, p: Pt, from: Pt, power: number, killed: boolean) {
  const s = Math.min(r.w, r.h), sc = s / 90, k = Math.max(0.8, Math.min(1.6, power)) * (killed ? 1.2 : 1);
  const away = Math.atan2(p.y - from.y, p.x - from.x), floor = r.y + r.h * 0.9;
  t.flash(p, LIT, 0.22 * k * sc);
  cracks(t, p, killed ? 7 : 5, s * 0.42 * k, 0.32, 2.2);
  t.draw(0.5, (g, v) => {
    g.ellipse(p.x, p.y, s * 0.17 * k, s * 0.12 * k).fill({ color: CRACK, alpha: 0.5 * Math.min(1, v * 10) * (1 - v) });
  }, { dark: true });
  rubble(t, p, Math.round(3 + 2 * k), [s * 0.035, s * 0.07], [140, 260], floor, sc, away);
  for (let i = 0; i < Math.round(8 * k * t.quality); i++) {
    const a = away + rand(-1.2, 1.2), v = rand(130, 280) * sc;
    t.spark(p.x, p.y, Math.cos(a) * v, Math.sin(a) * v - rand(40, 120) * sc, rand(0.25, 0.45), CHIP);
  }

  // The concussion: a ring of dust thrown off the card all round...
  const nPuff = Math.round(9 * t.quality) + 2;
  const puffs = Array.from({ length: nPuff }, (_, i) => ({ a: (i / nPuff) * TAU + rand(-0.2, 0.2), r: s * rand(0.1, 0.14) }));
  const CD = 0.6;
  t.draw(CD, (g, v) => {
    const out = s * (0.12 + 0.5 * easeOut(v)) * k, a = v < 0.1 ? v / 0.1 : 1 - (v - 0.1) / 0.9;
    for (const q of puffs) {
      const x = p.x + Math.cos(q.a) * out, y = p.y + Math.sin(q.a) * out * 0.8, rr = q.r * (1 + v);
      g.circle(x, y, rr).fill({ color: DUST, alpha: 0.2 * a }).circle(x, y, rr * 0.6).fill({ color: DUST, alpha: 0.22 * a });
    }
  }, { dark: true });

  // ...one gem glint knocked loose, spinning off away from the bear and
  // bouncing once...
  const g0 = { x: p.x + rand(-0.1, 0.1) * s, y: p.y - s * 0.08 }, ga = away + rand(-0.5, 0.5), gv = rand(110, 170) * sc;
  const q = { x: g0.x, y: g0.y, vx: Math.cos(ga) * gv, vy: Math.sin(ga) * gv - rand(200, 260) * sc, rot: rand(0, TAU) };
  t.draw(0.6, (g, v, dt) => {
    q.vy += 1100 * sc * dt;
    q.x += q.vx * dt; q.y += q.vy * dt; q.rot += 14 * dt;
    if (q.y > floor && q.vy > 0) { q.y = floor; q.vy *= -0.35; q.vx *= 0.6; }
    const a = v < 0.75 ? 1 : 1 - (v - 0.75) / 0.25;
    g.circle(q.x, q.y, s * 0.07).fill({ color: GEM, alpha: 0.2 * a });
    gem(g, q.x, q.y, s * 0.06, q.rot, a);
    if (v < 0.25) glint(g, g0.x, g0.y, s * 0.16 * (1 - v * 4), 1 - v * 4);
  });

  // ...and the card dazed: a slow, tilting ring of dust motes round its head.
  const motes = Array.from({ length: 5 }, (_, i) => ({ a: (i / 5) * TAU, blue: i === 2 }));
  const head = { x: p.x, y: r.y + r.h * 0.2 }, DZ = 0.85, spin = Math.random() < 0.5 ? -1 : 1;
  t.draw(DZ, (g, v) => {
    const time = v * DZ, a = clamp01(v / 0.15) * (v > 0.6 ? 1 - (v - 0.6) / 0.4 : 1);
    const tilt = 0.18 * Math.sin(time * 5), wob = 1 + 0.1 * Math.sin(time * 7);
    for (const mo of motes) {
      const ang = mo.a + spin * time * 3.2;
      const ox = Math.cos(ang) * s * 0.27 * wob, oy = Math.sin(ang) * s * 0.08;
      const x = head.x + ox * Math.cos(tilt) - oy * Math.sin(tilt), y = head.y + ox * Math.sin(tilt) + oy * Math.cos(tilt);
      const near = Math.sin(ang) > 0 ? 1 : 0.55; // the near side of the ring brighter
      g.circle(x, y, 4 * sc).fill({ color: mo.blue ? GEM : LIT, alpha: 0.22 * a * near });
      g.circle(x, y, 1.8 * sc).fill({ color: mo.blue ? GEM_WHITE : 0xfff4e2, alpha: 0.9 * a * near });
    }
  }, { delay: 0.12 });

  if (killed) {
    t.ring(r, LIT, 0.4, 1.35, 0.42, 3);
    rubble(t, p, 4, [s * 0.05, s * 0.09], [200, 340], floor, sc);
    dust(t, { x: p.x, y: floor - s * 0.1 }, 5, s * 0.17, 90 * sc, 0.8);
  }
}
