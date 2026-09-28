/** VULCANYX — Fissure. "11 DMG to every opponent in melee reach, through
 *  shields, and BURN 3 for 2 rounds on all of it." The mountain did not
 *  erupt. It got hungry.
 *
 *  The DELIVERY is the ground under it giving way to what is underneath: its
 *  square splits in glowing seams and heats from below, embers lifting, and
 *  from its edge a crack of magma races out through the ground to every card
 *  in reach, arriving as the delivery ends. The LANDING is the fissure
 *  opening: each crack tears wide into a channel of lava, its basalt lips
 *  shouldered apart, and under every card it reached the lava BURSTS UP — a
 *  fountain of fire and molten blobs flung high and falling back, rock thrown
 *  out, smoke rolling off — then the channels crust over dark as they cool.
 *  Heavier than any mythic's move: the whole of its reach goes up at once.
 *
 *  Rock is SOLID, on the normal-blend layer; the magma is light, and only the
 *  magma, so the channels glow out of dark stone rather than out of nothing.
 *  Fire is PYRO's own (looks/fire.ts), so the BURN it leaves reads as the same
 *  fire. */
import { centre, rand } from "../looks/base";
import { EMBER, SCORCH, pyroBody, pyroFire, pyroLick } from "../looks/fire";
import type { Graphics } from "pixi.js";
import type { FxTools, Pt, SparkStyle } from "../looks/types";
import type { Signature, SigMoment } from "./types";

type Box = SigMoment["from"];

const TAU = Math.PI * 2;
// Basalt: real colour, on the normal-blend layer. CRUST is lava gone dark.
const BASALT = 0x3a2a22, BASALT_HI = 0x7a5a48, BASALT_LO = 0x1e140f, EDGE = 0x100a07, CRUST = 0x2a120a;
// Magma, as light: white-hot at the heart, walking down to deep red.
const HOT = 0xfff2c0, YELLOW = 0xffc24a, ORANGE = 0xff6a1a, DEEPRED = 0xc8280c;
/** Molten spatter: heavy drops that cool as they fall. */
const SPATTER: SparkStyle = { palette: [HOT, YELLOW, ORANGE, DEEPRED], gravity: 900, drag: 0.6, size: [6, 2], streak: false };
/** Grit shaken off the stone. */
const GRIT: SparkStyle = { palette: [0xfff1dc, 0xe8cfa8, 0xa1887f], gravity: 950, drag: 0.6, size: [5, 2], streak: false };

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeOut = (x: number) => 1 - (1 - x) * (1 - x);

/** A crack's course from `a` to `b`: kinked, fixed once. */
function crackPath(a: Pt, b: Pt, s: number, jag = 0.06): number[] {
  const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
  const steps = Math.max(3, Math.round(L / (s * 0.18))), pts = [a.x, a.y];
  for (let i = 1; i < steps; i++) {
    const f = i / steps, j = rand(-1, 1) * s * jag;
    pts.push(a.x + dx * f + nx * j, a.y + dy * f + ny * j);
  }
  pts.push(b.x, b.y);
  return pts;
}

/** The first `f` (0..1) of a point list, ending exactly on the way. */
function part(pts: number[], f: number): number[] {
  const n = pts.length / 2 - 1, at = Math.max(0, Math.min(n, f * n)), i = Math.floor(at), r = at - i;
  const out = pts.slice(0, (i + 1) * 2);
  if (i < n && r > 0) out.push(pts[i * 2] + (pts[i * 2 + 2] - pts[i * 2]) * r, pts[i * 2 + 1] + (pts[i * 2 + 3] - pts[i * 2 + 1]) * r);
  return out;
}

/** A path pushed sideways by `off` px (per point, along its local normal). */
function shift(pts: number[], off: (i: number) => number): number[] {
  const n = pts.length / 2, out: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1);
    const tx = pts[b * 2] - pts[a * 2], ty = pts[b * 2 + 1] - pts[a * 2 + 1], l = Math.hypot(tx, ty) || 1;
    out.push(pts[i * 2] - (ty / l) * off(i), pts[i * 2 + 1] + (tx / l) * off(i));
  }
  return out;
}

/** A rock at (x, y), `size` its radius, turned `rot`: basalt body, a shadowed
 *  face, a lit face, a dark edge. `rk` is [angle, radius] corner pairs. */
function rock(g: Graphics, x: number, y: number, size: number, rot: number, rk: number[], alpha: number) {
  if (alpha <= 0.02 || size < 1) return;
  const face = (k: number, dx: number, dy: number) => {
    const p: number[] = [];
    for (let i = 0; i < rk.length; i += 2) p.push(x + dx + Math.cos(rk[i] + rot) * rk[i + 1] * size * k, y + dy + Math.sin(rk[i] + rot) * rk[i + 1] * size * k);
    return p;
  };
  const body = face(1, 0, 0);
  g.poly(body, true).fill({ color: BASALT, alpha });
  g.poly(face(0.62, size * 0.16, size * 0.18), true).fill({ color: BASALT_LO, alpha: alpha * 0.8 });
  g.poly(face(0.5, -size * 0.2, -size * 0.22), true).fill({ color: BASALT_HI, alpha: alpha * 0.85 });
  g.poly(body, true).stroke({ width: Math.max(1, size * 0.12), color: EDGE, alpha });
}

function rockShape(): number[] {
  const out: number[] = [], n = 5 + Math.floor(rand(0, 3)), a0 = rand(0, TAU);
  for (let i = 0; i < n; i++) out.push(a0 + (i / n) * TAU + rand(-0.25, 0.25), rand(0.72, 1));
  return out;
}

/** Basalt chunks blown out of a burst, thrown up and out, falling back to
 *  land on `floor` round the card rather than raining down the board. */
function chunks(t: FxTools, at: Pt, n: number, s: number, k: number, floor: number) {
  const bits = Array.from({ length: Math.max(1, Math.round(n * t.quality)) }, () => {
    const a = (rand(-160, -20) * Math.PI) / 180, v = rand(160, 300) * (s / 90) * k;
    return { vx: Math.cos(a) * v, vy: Math.sin(a) * v, rot: rand(0, TAU), vr: rand(-9, 9), size: s * rand(0.04, 0.075) * k, rk: rockShape(), life: rand(0.5, 0.7) };
  });
  t.draw(0.7, (g, u) => {
    const time = u * 0.7;
    for (const b of bits) {
      if (time >= b.life) continue;
      const q = time / b.life, y = Math.min(floor, at.y + b.vy * time + 900 * (s / 90) * time * time);
      rock(g, at.x + b.vx * time * (y >= floor ? 0.85 : 1), y, b.size, b.rot + b.vr * time, b.rk, q > 0.7 ? 1 - (q - 0.7) / 0.3 : 1);
    }
  }, { dark: true });
}

export const VULCANYX: Signature = {
  shake: 1.9,
  // It does not reach for anyone: the ground it stands on does the reaching.
  lunge: false,

  deliver(t: FxTools, m: SigMoment, seconds: number) {
    const c = centre(m.from), s = m.size, S = seconds;
    // ITS OWN GROUND GIVES: seams of magma splitting its square from the
    // middle out, heat building up through them.
    const seams = Array.from({ length: 7 }, (_, i) => {
      const a = (i / 7) * TAU + rand(-0.3, 0.3);
      return crackPath(c, { x: c.x + Math.cos(a) * s * rand(0.42, 0.56), y: c.y + Math.sin(a) * s * rand(0.42, 0.56) }, s, 0.05);
    });
    const open = (time: number) => easeOut(clamp01(time / (S * 0.45)));
    t.draw(S, (g, v) => {
      const f = open(v * S);
      for (const p of seams) g.poly(part(p, f), false).stroke({ width: s * 0.05, color: EDGE, alpha: 0.85, join: "round" });
    }, { dark: true });
    t.draw(S, (g, v) => {
      const time = v * S, f = open(time), heat = clamp01(time / S);
      g.circle(c.x, c.y, s * (0.35 + 0.2 * heat)).fill({ color: ORANGE, alpha: 0.12 + 0.18 * heat });
      for (const p of seams) {
        const q = part(p, f);
        g.poly(q, false).stroke({ width: s * 0.06, color: DEEPRED, alpha: 0.35 * heat + 0.15, join: "round" });
        g.poly(q, false).stroke({ width: s * 0.022, color: heat > 0.6 ? HOT : YELLOW, alpha: 0.9, join: "round" });
      }
    });
    t.charge(c, s * 1.5, ORANGE, 0.55, S);
    let ember = 0;
    t.draw(S, (_g, v, dt) => {
      ember += dt * 40 * v * t.quality;
      for (; ember >= 1; ember--) {
        const a = rand(0, TAU), r = s * rand(0.1, 0.45);
        t.spark(c.x + Math.cos(a) * r, c.y + Math.sin(a) * r, rand(-20, 20) * (s / 90), -rand(60, 150) * (s / 90), rand(0.35, 0.6), EMBER);
      }
    });

    // THE CRACKS RUN: magma splitting the ground out from its edge to every
    // card in reach, speeding up — each arriving on the landing frame.
    const LEAVE = S * 0.35;
    const runs = m.targets.map((r) => {
      const p = centre(r), d = Math.hypot(p.x - c.x, p.y - c.y) || 1;
      return crackPath({ x: c.x + ((p.x - c.x) / d) * s * 0.42, y: c.y + ((p.y - c.y) / d) * s * 0.42 }, p, s);
    });
    const reach = (time: number) => Math.pow(clamp01((time - LEAVE) / (S - LEAVE)), 1.4);
    t.draw(S, (g, v) => {
      const f = reach(v * S);
      if (f > 0) for (const p of runs) g.poly(part(p, f), false).stroke({ width: s * 0.05, color: EDGE, alpha: 0.9, join: "round" });
    }, { dark: true });
    let spit = 0;
    t.draw(S, (g, v, dt) => {
      const f = reach(v * S);
      if (f <= 0) return;
      for (const p of runs) {
        const q = part(p, f), hx = q[q.length - 2], hy = q[q.length - 1];
        g.poly(q, false).stroke({ width: s * 0.07, color: DEEPRED, alpha: 0.35, join: "round" });
        g.poly(q, false).stroke({ width: s * 0.025, color: YELLOW, alpha: 0.95, join: "round" });
        g.circle(hx, hy, s * 0.1).fill({ color: ORANGE, alpha: 0.4 });
        g.circle(hx, hy, s * 0.04).fill({ color: HOT, alpha: 0.95 });
      }
      spit += dt * 22 * runs.length * t.quality;
      for (; spit >= 1; spit--) {
        const q = part(runs[Math.floor(rand(0, runs.length))], f);
        t.spark(q[q.length - 2], q[q.length - 1], rand(-50, 50) * (s / 90), -rand(90, 190) * (s / 90), rand(0.3, 0.5), SPATTER);
      }
    });
  },

  land(t: FxTools, m: SigMoment) {
    const c = centre(m.from), s = m.size;
    // THE FISSURES OPEN: each crack torn wide into a channel of lava, basalt
    // lips shouldered apart either side, cooling to a crust.
    const channels = m.targets.map((r) => {
      const p = centre(r), d = Math.hypot(p.x - c.x, p.y - c.y) || 1;
      const path = crackPath({ x: c.x + ((p.x - c.x) / d) * s * 0.3, y: c.y + ((p.y - c.y) / d) * s * 0.3 }, p, s, 0.05);
      return { path, wob: Array.from({ length: path.length / 2 }, () => rand(0.75, 1.25)) };
    });
    const D = 1.3;
    const width = (time: number) => s * 0.11 * easeOut(clamp01(time / 0.12)) * (1 - 0.35 * clamp01((time - 0.7) / 0.6));
    const cool = (time: number) => clamp01((time - 0.55) / 0.7);
    t.draw(D, (g, v) => {
      const time = v * D, w = width(time), gone = 1 - clamp01((time - 1.0) / 0.3);
      for (const ch of channels) {
        const n = ch.path.length / 2;
        for (const side of [-1, 1]) {
          // The lips: basalt slabs shoved apart, lit along their top edges.
          const lip = shift(ch.path, (i) => side * (w * 0.5 * ch.wob[i] + s * 0.02) * Math.sin((Math.PI * (i + 0.5)) / n));
          g.poly(lip, false).stroke({ width: s * 0.06, color: BASALT, alpha: 0.95 * gone, join: "round" });
          g.poly(lip, false).stroke({ width: 1.2, color: BASALT_HI, alpha: 0.8 * gone, join: "round" });
        }
        // Crust skinning over the channel as it cools.
        const k = cool(time);
        if (k > 0) g.poly(ch.path, false).stroke({ width: w * 0.9 * k, color: CRUST, alpha: 0.85 * k * gone, join: "round" });
      }
    }, { dark: true });
    t.draw(D, (g, v) => {
      const time = v * D, w = width(time), k = cool(time), gone = 1 - clamp01((time - 1.0) / 0.3);
      for (const ch of channels) {
        g.poly(ch.path, false).stroke({ width: w * 2.2, color: DEEPRED, alpha: 0.25 * (1 - k) * gone, join: "round" });
        g.poly(ch.path, false).stroke({ width: w, color: ORANGE, alpha: 0.85 * (1 - 0.7 * k) * gone, join: "round" });
        g.poly(ch.path, false).stroke({ width: w * 0.35, color: k < 0.4 ? HOT : YELLOW, alpha: 0.95 * (1 - k) * gone, join: "round" });
      }
      // The heart of it, white-hot for a moment where it split.
      const heart = 1 - clamp01(time / 0.35);
      if (heart > 0) {
        g.circle(c.x, c.y, s * 0.3).fill({ color: ORANGE, alpha: 0.35 * heart });
        g.circle(c.x, c.y, s * 0.12).fill({ color: HOT, alpha: 0.8 * heart });
      }
    });
    // A shove of heat out through the ground from it.
    t.ring(m.from, ORANGE, 0.6, 2.4, 0.5, 5);
    t.flash(c, YELLOW, 0.45 * (s / 80));
    m.targets.forEach((r, i) => t.later(0.04 + i * 0.03, () => burst(t, r, m.power[i] ?? 1, !!m.killed[i], s)));
  },
};

/** Lava bursting up under a card the fissure reached: a fountain of fire at
 *  its foot, molten blobs flung high and falling back, basalt blown out,
 *  a glowing pool, smoke rolling off the top, a scorch left under it. Sized by
 *  what it did; a kill goes up higher. */
function burst(t: FxTools, r: Box, power: number, killed: boolean, s: number) {
  const c = centre(r), k = Math.max(0.8, Math.min(1.6, power)) * (killed ? 1.2 : 1), foot = r.y + r.h * 0.88, seed = rand(0, 100);
  const D = 0.75;
  pyroFire(t, {
    seconds: D,
    wisp: () => ({ x: r.x + r.w * rand(0.2, 0.8), y: r.y + r.h * rand(0.2, 0.5) }), wispRate: 22 * k, wispSize: s * 0.09,
    puff: (kk) => (kk > 0.25 ? { x: c.x + rand(-0.3, 0.3) * r.w, y: r.y + r.h * 0.1 } : null), smokeRate: 7, smokeSize: s * 0.18,
    body: (g, time, kk) => {
      const env = kk < 0.12 ? easeOut(kk / 0.12) : Math.pow(1 - (kk - 0.12) / 0.88, 1.2);
      g.ellipse(c.x, foot, r.w * 0.44 * k, r.h * 0.14).fill({ color: ORANGE, alpha: 0.4 * env });
      g.ellipse(c.x, foot, r.w * 0.26 * k, r.h * 0.07).fill({ color: HOT, alpha: 0.6 * env });
      pyroBody(g, r.x + r.w * 0.1, r.x + r.w * 0.9, foot, s * 0.7 * k * env, Math.min(1, env * 1.4), time, seed, 1.1);
      // The column: the lava's own jet up the middle, tallest of all.
      pyroLick(g, c.x, foot, s * 0.9 * k * env, s * 0.3, time, seed + 7, Math.min(1, env * 1.3));
    },
  });
  // Molten blobs: flung high, falling back and splashing flat on the ground
  // round the card, cooling from white to red.
  const n = Math.round(9 * k * Math.max(0.5, t.quality)), floor = foot + s * 0.12;
  const blobs = Array.from({ length: n }, () => {
    const a = (rand(-150, -30) * Math.PI) / 180, v = rand(220, 360) * (s / 90);
    return { vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: s * rand(0.025, 0.05) * k, life: rand(0.55, 0.8), floor: foot + s * rand(0.02, 0.22) };
  });
  t.draw(0.8, (g, u) => {
    const time = u * 0.8;
    for (const b of blobs) {
      if (time >= b.life) continue;
      const q = time / b.life, fly = foot - s * 0.1 + b.vy * time + 900 * (s / 90) * time * time;
      const down = fly >= b.floor, y = Math.min(b.floor, fly), x = c.x + b.vx * time;
      // Landed, it spreads into a splash and dulls.
      const rx = b.r * (down ? 1.8 : 1 - 0.4 * q), ry = b.r * (down ? 0.55 : 1 - 0.4 * q);
      g.ellipse(x, y, rx * 2.2, ry * 2.2).fill({ color: ORANGE, alpha: (down ? 0.1 : 0.22) * (1 - q) });
      g.ellipse(x, y, rx, ry).fill({ color: q < 0.3 ? HOT : q < 0.6 ? YELLOW : ORANGE, alpha: (down ? 0.5 : 0.95) * (1 - q * q) });
    }
  });
  chunks(t, { x: c.x, y: foot - s * 0.1 }, killed ? 6 : 4, s, k, floor);
  t.draw(1.1, (g, u) => {
    g.ellipse(c.x, foot, r.w * 0.5, r.h * 0.14).fill({ color: SCORCH, alpha: 0.5 * Math.min(1, u * 6) * (1 - u) });
  }, { dark: true });
  t.flash(c, YELLOW, 0.4 * k * (s / 80));
  t.glow(r, ORANGE, 0.45 * Math.min(1.2, k), 0.7, 1.1);
  for (let i = 0; i < Math.round(8 * k); i++) {
    const a = (rand(-160, -20) * Math.PI) / 180, v = rand(120, 240) * (s / 90);
    t.spark(c.x + rand(-6, 6), foot - s * 0.05, Math.cos(a) * v, Math.sin(a) * v, rand(0.25, 0.4), i % 3 ? SPATTER : GRIT);
  }
}
