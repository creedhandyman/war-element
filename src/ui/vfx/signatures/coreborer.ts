/** THE COREBORER — Core Drill. "Burrow through the column directly ahead,
 *  dealing 12 DMG (PEN) to every opponent in it" — it does not go around the
 *  mountain, and it does not go around you.
 *
 *  The DELIVERY is the drill on its art spinning up: the great banded cone
 *  thrust out of the card's front edge along the line ahead, its spiral ridges
 *  climbing toward the tip faster and faster until the tip heats white, grit
 *  sprayed off its flanks. The LANDING is the burrow. The drill plunges tip
 *  first into the ground and runs on under it down the column ahead: the
 *  ground heaves over it and splits open behind it, broken rock shouldered up
 *  along both lips, and under each opponent in the column, nearest first, the
 *  drill bursts up through the card, rock thrown off the spinning cone, and
 *  goes back under. It runs on to the board's edge: the hole it leaves is the
 *  same width either way.
 *
 *  Drill and stone are SOLID, on the normal-blend layer (see looks/bore.ts:
 *  additive light cannot draw bronze or rock). Light is only the lit edge of a
 *  ridge, the hot tip, the glow of it churning underground and the grit. */
import { centre, rand } from "../looks/base";
import type { Graphics } from "pixi.js";
import type { FxTools, Pt, SparkStyle } from "../looks/types";
import type { Signature, SigMoment } from "./types";

type Box = SigMoment["from"];

const TAU = Math.PI * 2;
// The drill, as on the art: dark bronze plates wound in a spiral.
const BRONZE = 0x5e4428, BRONZE_HI = 0x9c7446, BRONZE_LO = 0x2e2012, EDGE = 0x140c06;
// Light (additive): the gold edge of a ridge, the tip as it heats.
const LIT = 0xffd28a, HOT = 0xfff4dc;
// Stone and earth, as looks/bore.ts draws them.
const ROCK = 0x8a7461, ROCK_HI = 0xcfb592, ROCK_LO = 0x4e3e31, CRACK = 0x0e0906, DUST = 0xb89e80;
const SAND = [0xfff1dc, 0xe8cfa8, 0xd9b48a, 0xa1887f];
/** Grit off the cone and the rupture: small, heavy, falling. */
const GRIT: SparkStyle = { palette: SAND, gravity: 950, drag: 0.6, size: [5, 2], streak: false };
/** Chips struck off rock by the spinning cone: fast little streaks that drop. */
const CHIP: SparkStyle = { palette: [0xfff6e0, LIT, 0xd9b48a], gravity: 1100, drag: 0.5, size: [5, 2], streak: true };

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeOut = (x: number) => 1 - (1 - x) * (1 - x);
/** Threads on the cone, and how far along it one climbs across its face. */
const THREADS = 5, PITCH = 0.15;

/** THE DRILL: a cone from `base` out along `u`, `len` long and `half` wide at
 *  its root, a screw thread wound round it and turned on by `turn` — the
 *  threads climb toward the tip as it spins, which is what reads as a drill
 *  and not a spike. Each thread crosses the face as a screw's does, steep at
 *  the flanks where it wraps round. Drawn twice: the plated body on the
 *  normal-blend layer, then (`lit`) its light — the gold edge of each thread,
 *  the rim of its lit flank, the tip heating by `hot`, and streaks of speed
 *  across it by `blur`. The light stays top-left whichever way it points. */
function drill(g: Graphics, base: Pt, u: Pt, len: number, half: number, turn: number, alpha: number, lit: boolean, hot = 0, blur = 0) {
  if (len < 2 || alpha <= 0.02) return;
  const nx = -u.y, ny = u.x;
  const litSide = nx + ny < 0 ? 1 : -1; // the flank facing up-left
  const hw = (f: number) => half * Math.max(0, 1 - f);
  const px = (f: number, side: number) => base.x + u.x * len * f + nx * hw(f) * side;
  const py = (f: number, side: number) => base.y + u.y * len * f + ny * hw(f) * side;
  const flank = (s0: number, s1: number) => {
    const p: number[] = [];
    for (let i = 0; i <= 6; i++) p.push(px(i / 6, s0), py(i / 6, s0));
    for (let i = 6; i >= 0; i--) p.push(px(i / 6, s1), py(i / 6, s1));
    return p;
  };
  /** A thread from flank to flank, starting `a` along the cone. */
  const thread = (a: number, shift: number) => {
    const p: number[] = [];
    for (let k = 0; k <= 6; k++) {
      const side = -1 + k / 3, f = a + shift + PITCH * (Math.asin(side) / Math.PI + 0.5);
      p.push(px(f, side), py(f, side));
    }
    return p;
  };
  const out = flank(1, -1);
  const at = (j: number) => ((((j + turn) % THREADS) + THREADS) % THREADS) / THREADS;
  if (!lit) {
    g.poly(out, true).fill({ color: BRONZE, alpha });
    g.poly(flank(litSide, litSide * 0.1), true).fill({ color: BRONZE_HI, alpha: alpha * 0.8 });
    g.poly(flank(-litSide, -litSide * 0.5), true).fill({ color: BRONZE_LO, alpha: alpha * 0.85 });
    for (let j = 0; j < THREADS; j++) {
      const a = at(j);
      if (a + PITCH > 0.92) continue;
      g.poly(thread(a, 0), false).stroke({ width: Math.max(1.5, hw(a) * 0.22), color: EDGE, alpha });
    }
    // The collar where the cone meets the carapace, trimmed in gold (lit).
    const ct = half * 0.28;
    g.poly([px(0, 1.04), py(0, 1.04), px(0, -1.04), py(0, -1.04),
      px(0, -1.04) - u.x * ct, py(0, -1.04) - u.y * ct, px(0, 1.04) - u.x * ct, py(0, 1.04) - u.y * ct], true)
      .fill({ color: BRONZE_LO, alpha }).stroke({ width: 1.2, color: EDGE, alpha });
    g.poly(out, true).stroke({ width: 1.5, color: EDGE, alpha });
    return;
  }
  for (let j = 0; j < THREADS; j++) {
    const a = at(j);
    if (a + PITCH > 0.94) continue;
    g.poly(thread(a, 0.03), false).stroke({ width: 1.2, color: LIT, alpha: alpha * 0.75 });
  }
  const rim: number[] = [];
  for (let i = 0; i <= 6; i++) rim.push(px(i / 6, litSide), py(i / 6, litSide));
  g.poly(rim, false).stroke({ width: 1.2, color: LIT, alpha: alpha * 0.55 });
  g.moveTo(px(0, 1), py(0, 1)).lineTo(px(0, -1), py(0, -1)).stroke({ width: 1, color: LIT, alpha: alpha * 0.6 });
  // Spun fast, it smears: faint threads flicked across it, never twice alike.
  for (let i = 0; i < Math.round(3 * blur); i++)
    g.poly(thread(rand(0.02, 0.7), 0), false).stroke({ width: 1, color: HOT, alpha: 0.3 * blur * alpha });
  if (hot > 0.02) {
    const tx = base.x + u.x * len, ty = base.y + u.y * len;
    g.circle(tx, ty, half * (0.35 + 0.5 * hot)).fill({ color: LIT, alpha: 0.25 * hot * alpha });
    g.circle(tx, ty, half * 0.17).fill({ color: HOT, alpha: 0.95 * hot * alpha });
  }
}

// ── Stone ────────────────────────────────────────────────────────────────────

/** A rock's outline: corners at uneven angles and radii, [angle, radius]. */
function rockShape(): number[] {
  const out: number[] = [], n = 5 + Math.floor(rand(0, 3)), a0 = rand(0, TAU);
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

/** Chunks broken off and thrown from `at` — up and out, spinning, falling back
 *  to bounce once on `floor`. */
function rubble(t: FxTools, at: Pt, n: number, size: [number, number], speed: [number, number], floor: number, sc: number) {
  const chunks = Array.from({ length: Math.max(1, Math.round(n * t.quality)) }, () => {
    const a = (rand(-165, -15) * Math.PI) / 180, v = rand(speed[0], speed[1]) * sc;
    return { x: at.x, y: at.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, rot: rand(0, TAU), vr: rand(-9, 9),
      size: rand(size[0], size[1]), rk: rockShape(), age: 0, life: rand(0.5, 0.7) };
  });
  t.draw(0.7, (g, _u, dt) => {
    for (const c of chunks) {
      c.age += dt;
      if (c.age >= c.life) continue;
      c.vy += 1500 * sc * dt;
      c.x += c.vx * dt; c.y += c.vy * dt; c.rot += c.vr * dt;
      if (c.y > floor && c.vy > 0) { c.y = floor; c.vy *= -0.3; c.vx *= 0.55; c.vr *= 0.5; }
      rock(g, c.x, c.y, c.size, c.rot, c.rk, c.age > c.life * 0.7 ? 1 - (c.age - c.life * 0.7) / (c.life * 0.3) : 1);
    }
  }, { dark: true });
}

/** Dust rolling out low from a point: soft clouds pushed sideways that slow
 *  and settle — earth does not rise like smoke. */
function dust(t: FxTools, at: Pt, n: number, size: number, spread: number, life = 0.8) {
  const puffs = Array.from({ length: Math.max(1, Math.round(n * t.quality)) }, (_, i) => ({
    x: at.x + rand(-4, 4), y: at.y + rand(-3, 3), r: size * rand(0.6, 1),
    vx: (i % 2 ? 1 : -1) * rand(0.35, 1) * spread, vy: -size * rand(0.4, 1.8), age: 0, life: life * rand(0.8, 1.2),
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
  }, { dark: true });
}

/** Cracks run out of a point through the ground: dark grooves drawn in fast,
 *  held, faded, each with a lit lip where the broken edge catches the light. */
function cracks(t: FxTools, at: Pt, n: number, reach: number, hold: number) {
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
  const DRAW = 0.07, D = DRAW + hold + 0.25;
  const state = (u: number) => ({ drawn: clamp01((u * D) / DRAW), a: u * D < DRAW + hold ? 1 : 1 - (u * D - DRAW - hold) / 0.25 });
  const part = (p: number[], drawn: number) => p.slice(0, Math.max(2, Math.round((p.length / 2) * drawn)) * 2);
  t.draw(D, (g, u) => {
    const { drawn, a } = state(u);
    for (const p of paths) g.poly(part(p, drawn), false).stroke({ width: 2.4, color: CRACK, alpha: 0.85 * a });
  }, { dark: true });
  t.draw(D, (g, u) => {
    const { drawn, a } = state(u);
    for (const p of paths) g.poly(part(p, drawn).map((v) => v - 1), false).stroke({ width: 1, color: LIT, alpha: 0.35 * a });
  });
}

/** How far from `p` along `u` the board's edge lies, px. */
function toEdge(p: Pt, u: Pt, b: Box): number {
  let d = 1e4;
  if (u.x > 1e-6) d = Math.min(d, (b.x + b.w - p.x) / u.x);
  if (u.x < -1e-6) d = Math.min(d, (b.x - p.x) / u.x);
  if (u.y > 1e-6) d = Math.min(d, (b.y + b.h - p.y) / u.y);
  if (u.y < -1e-6) d = Math.min(d, (b.y - p.y) / u.y);
  return Math.max(0, d);
}

/** "Ahead", made safe to build on: a unit vector, up if it came in empty. */
function unit(v: Pt): Pt {
  const l = Math.hypot(v.x, v.y);
  return l > 1e-6 ? { x: v.x / l, y: v.y / l } : { x: 0, y: -1 };
}

/** The drill's size and seat on its own card: its root just ahead of centre,
 *  its tip well out past the front edge. */
const LEN = 0.8, HALF = 0.23, ROOT = 0.1;

export const COREBORER: Signature = {
  shake: 1.6,
  // It does not close on anything: the drill goes through the ground instead.
  lunge: false,

  deliver(t: FxTools, m: SigMoment, seconds: number) {
    const c = centre(m.from), s = m.size, u = unit(m.ahead), nx = -u.y, ny = u.x, S = seconds;
    const root = { x: c.x + u.x * s * ROOT, y: c.y + u.y * s * ROOT };
    // Thrust out over the first third, then winding up: the ridges' climb is
    // the integral of a rate rising from 1.5 to 7.5 a second.
    const out = (time: number) => easeOut(clamp01(time / (S * 0.35)));
    const ramp = (time: number) => clamp01(time / S);
    const turn = (time: number) => 1.5 * time + (6 * time * time * time) / (3 * S * S);
    // It shudders as it comes up to speed.
    const at = (time: number) => {
      const j = Math.sin(time * 95) * s * 0.014 * ramp(time) * ramp(time);
      return { x: root.x + nx * j, y: root.y + ny * j };
    };
    const shape = (time: number) => ({ len: s * LEN * out(time), half: s * HALF * (0.65 + 0.35 * out(time)) });
    t.draw(S, (g, v) => {
      const time = v * S, { len, half } = shape(time);
      drill(g, at(time), u, len, half, turn(time), Math.min(1, v * 8), false);
    }, { dark: true });
    let grit = 0;
    t.draw(S, (g, v, dt) => {
      const time = v * S, k = ramp(time), { len, half } = shape(time), b = at(time);
      drill(g, b, u, len, half, turn(time), Math.min(1, v * 8), true, k * k, clamp01((k - 0.4) / 0.6));
      // Grit flung off the flanks, more as it winds up: out sideways, a
      // little back along it.
      grit += dt * 90 * k * t.quality;
      for (; grit >= 1; grit--) {
        const f = rand(0.1, 0.7), side = Math.random() < 0.5 ? -1 : 1, hw = half * (1 - f);
        const x = b.x + u.x * len * f + nx * hw * side, y = b.y + u.y * len * f + ny * hw * side;
        const v1 = rand(100, 240) * (s / 90), back = rand(10, 70) * (s / 90);
        t.spark(x, y, nx * side * v1 - u.x * back, ny * side * v1 - u.y * back - rand(20, 80) * (s / 90), rand(0.25, 0.45),
          Math.random() < 0.35 ? CHIP : GRIT);
      }
    });
    // Dust shaken off the front edge as the drill comes out through it.
    const front = { x: c.x + u.x * s * 0.45, y: c.y + u.y * s * 0.45 + s * 0.05 };
    dust(t, front, 3, s * 0.12, 45 * (s / 90), 0.6);
    t.later(S * 0.6, () => dust(t, front, 3, s * 0.12, 60 * (s / 90), 0.5));
  },

  land(t: FxTools, m: SigMoment) {
    const c = centre(m.from), s = m.size, u = unit(m.ahead), nx = -u.y, ny = u.x;
    // THE PLUNGE: the spun-up drill goes in tip first where its tip stood,
    // collapsing onto the point as it tips down into the ground.
    const tip = { x: c.x + u.x * s * (ROOT + LEN), y: c.y + u.y * s * (ROOT + LEN) };
    const PLUNGE = 0.12;
    const sink = (g: Graphics, v: number, lit: boolean) => {
      const len = s * LEN * (1 - easeOut(v));
      drill(g, { x: tip.x - u.x * len, y: tip.y - u.y * len }, u, len, s * HALF * (1 - 0.4 * v), 8 + v * 2, 1, lit, 1, 1);
    };
    t.draw(PLUNGE, (g, v) => sink(g, v, false), { dark: true });
    t.draw(PLUNGE, (g, v) => sink(g, v, true));
    dust(t, { x: tip.x, y: tip.y + s * 0.05 }, 5, s * 0.14, 70 * (s / 90), 0.7);
    rubble(t, tip, 3, [s * 0.04, s * 0.07], [140, 260], tip.y + s * 0.25, s / 90);

    // THE BURROW'S LINE: from where it went in, under every opponent in turn,
    // nearest first, and on to the board's edge.
    const hits = m.targets.map((r, i) => ({ r, p: centre(r), power: m.power[i] ?? 1, killed: !!m.killed[i] }))
      .sort((a, b) => Math.hypot(a.p.x - c.x, a.p.y - c.y) - Math.hypot(b.p.x - c.x, b.p.y - c.y));
    const way: Pt[] = [tip, ...hits.map((h) => h.p)];
    const last = way[way.length - 1], run = Math.max(s * 0.3, toEdge(last, u, m.board) - s * 0.1);
    way.push({ x: last.x + u.x * run, y: last.y + u.y * run });
    const cum = [0];
    for (let i = 1; i < way.length; i++) cum.push(cum[i - 1] + Math.hypot(way[i].x - way[i - 1].x, way[i].y - way[i - 1].y));
    const total = cum[cum.length - 1];
    /** The point `d` px along the line, and the way it runs there. */
    const along = (d: number) => {
      let i = 1;
      while (i < way.length - 1 && cum[i] < d) i++;
      const seg = cum[i] - cum[i - 1] || 1, f = clamp01((d - cum[i - 1]) / seg);
      const a = way[i - 1], b = way[i];
      return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, dx: (b.x - a.x) / seg, dy: (b.y - a.y) / seg };
    };
    // Driving on hard, slowing as it grinds: the front's run down the line.
    const RUN = 0.6, D = 1.2;
    const front = (time: number) => total * easeOut(clamp01(time / RUN));
    const when = (d: number) => RUN * (1 - Math.sqrt(clamp01(1 - d / total)));
    const fade = (time: number) => (time < 0.75 ? 1 : Math.max(0, 1 - (time - 0.75) / 0.45));

    // What it leaves: a jagged split down the line, and broken rock shouldered
    // up along both lips as the front passes — laid out once.
    const split: number[] = [], STEP = s * 0.14;
    for (let d = 0; d <= total; d += STEP) {
      const p = along(d), j = d > 0 && d < total - STEP ? rand(-1, 1) * s * 0.05 : 0;
      split.push(p.x - p.dy * j, p.y + p.dx * j);
    }
    const heaved: { x: number; y: number; at: number; size: number; rot: number; rk: number[] }[] = [];
    for (let d = s * 0.15; d < total; d += s * 0.2)
      for (const side of [-1, 1]) {
        const p = along(d + rand(-0.05, 0.05) * s), off = side * s * rand(0.1, 0.19);
        heaved.push({ x: p.x - p.dy * off, y: p.y + p.dx * off, at: when(d), size: s * rand(0.04, 0.075), rot: rand(0, TAU), rk: rockShape() });
      }
    const grown = (time: number) => Math.max(2, Math.min(split.length / 2, Math.ceil(front(time) / STEP) + 1));
    /** The drill's tip, cutting along just under the surface at the front —
     *  a fin of spinning bronze breaking the ground. */
    const fin = (g: Graphics, time: number, lit: boolean) => {
      if (time >= RUN) return;
      const p = along(front(time)), dir = { x: p.dx, y: p.dy }, len = s * 0.34;
      drill(g, { x: p.x - dir.x * len * 0.35, y: p.y - dir.y * len * 0.35 }, dir, len, s * 0.13, time * 9, 1, lit, 1, 1);
    };
    t.draw(D, (g, v) => {
      const time = v * D, n = grown(time), a = fade(time);
      const cut = split.slice(0, n * 2);
      g.poly(cut, false).stroke({ width: s * 0.13, color: CRACK, alpha: 0.3 * a, join: "round" });
      g.poly(cut, false).stroke({ width: s * 0.055, color: CRACK, alpha: 0.9 * a, join: "round" });
      // The broken lips of the split, catching the light as stone does.
      for (const side of [-1, 1]) {
        const lip: number[] = [];
        for (let i = 0; i < n; i++) lip.push(split[i * 2] + nx * side * s * 0.04, split[i * 2 + 1] + ny * side * s * 0.04);
        g.poly(lip, false).stroke({ width: 1.3, color: ROCK_HI, alpha: 0.7 * a });
      }
      // Each rock pops up as the front passes under it, then settles.
      for (const h of heaved) {
        const q = time - h.at;
        if (q <= 0) continue;
        const pop = Math.min(1, q / 0.08), hop = q < 0.2 ? Math.sin((q / 0.2) * Math.PI) * s * 0.07 : 0;
        rock(g, h.x, h.y - hop, h.size * pop, h.rot + q * 3 * (q < 0.2 ? 1 : 0), h.rk, a);
      }
      // THE HEAVE at the head: churned ground, and the drill cutting through.
      if (time < RUN) {
        const p = along(front(time)), churn: number[] = [];
        for (let i = 0; i < 12; i++) {
          const q = (i / 12) * TAU, r = s * 0.17 * (1 + 0.18 * Math.sin(q * 3 + time * 40));
          churn.push(p.x + Math.cos(q) * r, p.y + Math.sin(q) * r);
        }
        g.poly(churn, true).fill({ color: CRACK, alpha: 0.7 });
      }
      fin(g, time, false);
    }, { dark: true });
    // The light: the split still hot just behind the drill, cooling as the
    // front moves on; the fin's lit threads; grit thrown off the heave.
    let grit = 0;
    t.draw(D, (g, v, dt) => {
      const time = v * D, n = grown(time), head = front(time);
      for (let i = 1; i < n; i++) {
        const heat = 1 - (head - i * STEP) / (s * 1.4);
        if (heat <= 0) continue;
        g.moveTo(split[i * 2 - 2], split[i * 2 - 1]).lineTo(split[i * 2], split[i * 2 + 1]).stroke({ width: 1.6, color: LIT, alpha: 0.7 * heat });
      }
      fin(g, time, true);
      if (time >= RUN) return;
      const p = along(head);
      grit += dt * 70 * t.quality;
      for (; grit >= 1; grit--) {
        const side = Math.random() < 0.5 ? -1 : 1, v1 = rand(60, 170) * (s / 90);
        t.spark(p.x + rand(-4, 4), p.y + rand(-4, 4), -p.dy * side * v1, p.dx * side * v1 - rand(40, 120) * (s / 90), rand(0.25, 0.45), GRIT);
      }
    });
    // Dust rolling off the rupture as the front passes along it.
    for (let d = s * 0.5; d < total; d += s * 0.6) {
      const p = along(d);
      t.later(when(d), () => dust(t, { x: p.x, y: p.y + s * 0.04 }, 2, s * 0.11, 40 * (s / 90), 0.6));
    }
    // THE DRILL BURSTS UP under each opponent as the front reaches it.
    hits.forEach((h, i) => t.later(when(cum[i + 1]), () => breach(t, h.r, u, h.power, h.killed, i)));
  },
};

/** The drill bursting up through a card in its column: out of a broken hole
 *  under it, spinning, rock thrown off round it and chips struck off the
 *  cone — then back under. Sized by what it did (`power`); a kill breaks the
 *  ground wider. */
function breach(t: FxTools, r: Box, u: Pt, power: number, killed: boolean, seq: number) {
  const c = centre(r), s = Math.min(r.w, r.h), k = Math.max(0.8, Math.min(1.5, power));
  const nx = -u.y, ny = u.x, floor = r.y + r.h * 0.9;
  const hole = { x: c.x - u.x * s * 0.2, y: c.y - u.y * s * 0.2 };
  const len = s * 0.62 * k, half = s * 0.24 * Math.min(1.25, k), D = 0.44;
  // Up fast, held spinning, then drawn back down.
  const reach = (time: number) => (time < 0.06 ? easeOut(time / 0.06) : time < 0.24 ? 1 : Math.max(0, 1 - (time - 0.24) / 0.12));
  const lip: number[] = [];
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * TAU, rr = half * rand(1.05, 1.4);
    lip.push(hole.x + Math.cos(a) * rr, hole.y + Math.sin(a) * rr * 0.75);
  }
  const holeA = (time: number) => (time < 0.3 ? Math.min(1, time * 25) : Math.max(0, 1 - (time - 0.3) / 0.14));
  t.draw(D, (g, v) => {
    const time = v * D;
    g.poly(lip, true).fill({ color: CRACK, alpha: 0.85 * holeA(time) });
    drill(g, hole, u, len * reach(time), half, seq * 0.6 + time * 7, 1, false);
  }, { dark: true });
  t.draw(D, (g, v) => {
    const time = v * D;
    g.poly(lip, true).stroke({ width: 1.5, color: LIT, alpha: 0.55 * holeA(time) });
    drill(g, hole, u, len * reach(time), half, seq * 0.6 + time * 7, 1, true, 1 - time / D, 1);
  });
  cracks(t, hole, killed ? 8 : 6, s * 0.55 * k, 0.35);
  rubble(t, hole, Math.round((killed ? 6 : 3) + 2 * k), [s * 0.05, s * 0.085 * k], [200, 360], floor, s / 90);
  dust(t, { x: c.x, y: floor - s * 0.1 }, killed ? 7 : 4, s * 0.17, 100 * (s / 90), 0.8);
  t.flash(hole, 0xffe2b0, 0.16 * k * (s / 80));
  if (killed) t.ring(r, 0xe8cfa8, 0.4, 1.3, 0.4, 3);
  // Chips struck off the spinning cone, sprayed out to both sides.
  const chips = Math.round(12 * k);
  for (let i = 0; i < chips; i++) {
    const side = i % 2 ? 1 : -1, v = rand(150, 320) * (s / 90), f = rand(0, 0.5);
    t.spark(hole.x + u.x * len * f, hole.y + u.y * len * f, nx * side * v + rand(-40, 40) * (s / 90), ny * side * v - rand(60, 160) * (s / 90), rand(0.3, 0.5), CHIP);
  }
}
