/** THE DEEPEST — Drilling Quake. "Tear off 5 HP to sinkhole all opponents in
 *  range for 3 DMG — DOT 3, −5 SP, −50% accuracy for 3 rounds — then slip
 *  into STEALTH." It is blind, and has never needed the eyes: the ground tells
 *  it everything.
 *
 *  The DELIVERY is the drill of its body turning in the ground: the earth
 *  under its square wound into a spiral vortex, as on its art — dark bands
 *  turning inward, lit from below, broken stone drawn round and down, the blue
 *  of its crystals glinting in it — while tremors race out underground from
 *  it, a crack running to every opponent and arriving as the delivery ends.
 *  The LANDING is the quake taking them: under each one a sinkhole opens, a
 *  dark pit spiralling down with the Deepest's blue far down in it, dust
 *  lifting off its broken rim and rubble sliding in; and the Deepest sinks
 *  into its own square — it darkens and goes back under (the STEALTH), a few
 *  stones torn off it for the HP it paid.
 *
 *  The pits are real darkness (`dark: true`), each with a lit rim, because a
 *  dark shape on the near-black board reads only against something lit. */
import { centre, rand } from "../looks/base";
import type { Graphics } from "pixi.js";
import type { FxTools, Pt, SparkStyle } from "../looks/types";
import type { Signature, SigMoment } from "./types";

type Box = SigMoment["from"];

const TAU = Math.PI * 2;
// The dark it drills into, only ever on the dark layer.
const PIT = 0x050308, CRACK = 0x0e0906;
// Stone, as looks/bore.ts draws it.
const ROCK = 0x8a7461, ROCK_HI = 0xcfb592, ROCK_LO = 0x4e3e31, EDGE = 0x241a13, DUST = 0xb89e80;
// Light (additive): stone lit from below, as on its art, and its crystals.
const EMBER = 0xffc27a, AMBER = 0xd98a3a, CRYSTAL = 0x4f9dff, ICE = 0xd6efff;
/** Grit shaken loose: small, heavy, falling. */
const GRIT: SparkStyle = { palette: [0xfff1dc, 0xe8cfa8, 0xd9b48a, 0xa1887f], gravity: 950, drag: 0.6, size: [5, 2], streak: false };
/** The blue of its crystals, winking out as it goes under. */
const GLINT: SparkStyle = { palette: [0xffffff, ICE, CRYSTAL], gravity: 0, drag: 0.4, size: [7, 2], streak: false };

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeOut = (x: number) => 1 - (1 - x) * (1 - x);
/** Up fast, hold, down: 0 at the ends of `time` over `rise`..`fall`..`end`. */
const env = (time: number, rise: number, fall: number, end: number) =>
  time < rise ? easeOut(time / rise) : time < fall ? 1 : Math.max(0, 1 - (time - fall) / (end - fall));

/** One arm of a vortex, as a band of ground wound down into it: a spiral from
 *  radius `r0` in toward `c` over `turns` (negative winds the other way),
 *  `w` wide at the rim and pointed at the heart, flattened by `squash`. Its
 *  outer edge comes back too, which is where the light from below catches. */
function arm(c: Pt, r0: number, a0: number, w: number, squash: number, turns: number) {
  const N = 16, edge: number[] = [], inner: number[] = [];
  for (let i = 0; i <= N; i++) {
    const f = i / N, a = a0 + f * turns * TAU, r = r0 * (1 - 0.9 * f), hw = (w / 2) * (1 - 0.85 * f);
    edge.push(c.x + Math.cos(a) * (r + hw), c.y + Math.sin(a) * (r + hw) * squash);
    inner.push(c.x + Math.cos(a) * (r - hw), c.y + Math.sin(a) * (r - hw) * squash);
  }
  const band = edge.slice();
  for (let i = inner.length - 2; i >= 0; i -= 2) band.push(inner[i], inner[i + 1]);
  return { band, edge };
}

/** A lumpy ring: the broken rim of a hole in the ground, `r` across. */
function rim(c: Pt, r: number, squash: number, seed: number): number[] {
  const pts: number[] = [];
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * TAU, rr = r * (1 + 0.08 * Math.sin(a * 3 + seed) + 0.06 * Math.sin(a * 7 + seed * 2));
    pts.push(c.x + Math.cos(a) * rr, c.y + Math.sin(a) * rr * squash);
  }
  return pts;
}

/** A rock's outline: corners at uneven angles and radii, [angle, radius]. */
function rockShape(): number[] {
  const out: number[] = [], n = 5 + Math.floor(rand(0, 3)), a0 = rand(0, TAU);
  for (let i = 0; i < n; i++) out.push(a0 + (i / n) * TAU + rand(-0.25, 0.25), rand(0.72, 1));
  return out;
}

/** A rock at (x, y), `size` its radius, turned `rot`: body, shadowed face,
 *  lit face, dark edge. */
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

/** Stones round a rim, sliding round and down in: each set loose at `at`,
 *  shrinking as it goes under. */
function slide(t: FxTools, c: Pt, R: number, squash: number, n: number, size: number, dir: number, span: number, delay = 0) {
  const bits = Array.from({ length: Math.max(2, Math.round(n * t.quality)) }, (_, i) => ({
    a: (i / n) * TAU + rand(-0.3, 0.3), at: rand(0, span * 0.5), rk: rockShape(), size: size * rand(0.7, 1.2),
  }));
  t.draw(span, (g, v) => {
    const time = v * span;
    for (const b of bits) {
      const q = (time - b.at) / (span * 0.5);
      if (q <= 0 || q >= 1) continue;
      const a = b.a + dir * q * 2.4, r = R * (1.05 - 0.95 * q * q);
      rock(g, c.x + Math.cos(a) * r, c.y + Math.sin(a) * r * squash, b.size * (1 - 0.6 * q), a * 3, b.rk, Math.min(1, q * 8) * (1 - q));
    }
  }, { dark: true, delay });
}

/** Dust lifting off a rim: soft clouds that rise a little, swell and thin. */
function dust(t: FxTools, c: Pt, r: number, n: number, size: number, life: number, delay = 0) {
  const puffs = Array.from({ length: Math.max(1, Math.round(n * t.quality)) }, () => {
    const a = rand(0, TAU);
    return { x: c.x + Math.cos(a) * r, y: c.y + Math.sin(a) * r * 0.8, vx: Math.cos(a) * size * rand(0.7, 2.5), vy: -size * rand(1.6, 3.4), r: size * rand(0.6, 1), age: 0, life: life * rand(0.8, 1.2) };
  });
  t.draw(life * 1.2, (g, _u, dt) => {
    for (const p of puffs) {
      p.age += dt;
      if (p.age >= p.life) continue;
      const q = p.age / p.life, a = q < 0.2 ? q / 0.2 : 1 - (q - 0.2) / 0.8, rr = p.r * (1 + q * 1.4);
      p.x += p.vx * dt; p.y += p.vy * dt;
      g.circle(p.x, p.y, rr).fill({ color: DUST, alpha: 0.14 * a }).circle(p.x, p.y, rr * 0.6).fill({ color: DUST, alpha: 0.18 * a });
    }
  }, { dark: true, delay });
}

/** A tremor's course from `a` to `b`: a crack's kinks, fixed once — and a
 *  fork off it partway, the way ground splits. */
function tremor(a: Pt, b: Pt, s: number) {
  const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
  const steps = Math.max(3, Math.round(L / (s * 0.2))), main = [a.x, a.y];
  for (let i = 1; i < steps; i++) {
    const f = i / steps, j = rand(-1, 1) * s * 0.07;
    main.push(a.x + dx * f + nx * j, a.y + dy * f + ny * j);
  }
  main.push(b.x, b.y);
  const k = Math.max(1, Math.floor(steps * rand(0.35, 0.6))), side = Math.random() < 0.5 ? -1 : 1;
  const fx = main[k * 2], fy = main[k * 2 + 1], fl = s * rand(0.25, 0.4);
  const fork = [fx, fy, fx + (dx / L) * fl * 0.6 + nx * side * fl * 0.5, fy + (dy / L) * fl * 0.6 + ny * side * fl * 0.5,
    fx + (dx / L) * fl + nx * side * fl * 0.6 + rand(-2, 2), fy + (dy / L) * fl + ny * side * fl * 0.6 + rand(-2, 2)];
  return { main, fork, forkAt: k / steps };
}

/** The first `f` (0..1) of a point list, ending exactly on the way. */
function part(pts: number[], f: number): number[] {
  const n = pts.length / 2 - 1, at = Math.max(0, Math.min(n, f * n)), i = Math.floor(at), r = at - i;
  const out = pts.slice(0, (i + 1) * 2);
  if (i < n && r > 0) out.push(pts[i * 2] + (pts[i * 2 + 2] - pts[i * 2]) * r, pts[i * 2 + 1] + (pts[i * 2 + 3] - pts[i * 2 + 1]) * r);
  return out;
}

/** A pit drawn in the ground at `c`, `R` across and open by `o`: rings of
 *  dark one inside another, deeper toward the heart, and spiral bands wound
 *  down into it, turned by `turn`. The body (`lit` false) or its light: the
 *  rim and the bands' edges lit from below in `rimColor`. */
function pit(g: Graphics, c: Pt, R: number, o: number, turn: number, dir: number, seed: number, lit: boolean, rimColor: number) {
  if (o <= 0.01) return;
  const arms = [0, 1, 2].map((i) => arm(c, R * 0.95, seed + (i / 3) * TAU + turn, R * 0.32, 0.75, 0.8 * dir));
  if (!lit) {
    g.poly(rim(c, R, 0.75, seed), true).fill({ color: PIT, alpha: 0.6 * o });
    g.ellipse(c.x, c.y, R * 0.64, R * 0.64 * 0.75).fill({ color: PIT, alpha: 0.4 * o });
    g.ellipse(c.x, c.y, R * 0.32, R * 0.32 * 0.75).fill({ color: PIT, alpha: 0.5 * o });
    for (const a of arms) g.poly(a.band, true).fill({ color: PIT, alpha: 0.55 * o });
    g.poly(rim(c, R, 0.75, seed), true).stroke({ width: Math.max(2, R * 0.1), color: ROCK_LO, alpha: 0.9 * o });
    return;
  }
  g.poly(rim(c, R * 1.03, 0.75, seed), true).stroke({ width: 1.6, color: rimColor, alpha: 0.75 * o });
  g.ellipse(c.x, c.y, R * 0.66, R * 0.66 * 0.75).stroke({ width: 1, color: rimColor, alpha: 0.3 * o });
  for (const a of arms) g.poly(a.edge, false).stroke({ width: 1.2, color: rimColor, alpha: 0.55 * o });
}

export const DEEPEST: Signature = {
  shake: 1.5,
  // It never comes to anyone: the ground carries it.
  lunge: false,

  deliver(t: FxTools, m: SigMoment, seconds: number) {
    const c = centre(m.from), s = m.size, S = seconds, seed = rand(0, 10);
    // THE VORTEX: the ground under it wound into a spiral, opening out and
    // turning faster — four bands of dark ground, lit from below along their
    // edges, its crystals' blue riding them down.
    const spin = (time: number) => 1.5 * time + (5 * time * time) / S;
    const R = (time: number) => s * (0.3 + 0.3 * easeOut(clamp01(time / (S * 0.5))));
    const arms = (time: number) => [0, 1, 2, 3].map((i) => arm(c, R(time), seed + (i / 4) * TAU + spin(time), s * 0.13, 0.8, 0.85));
    t.draw(S, (g, v) => {
      const time = v * S, k = Math.min(1, v * 5);
      g.poly(rim(c, R(time), 0.8, seed), true).fill({ color: PIT, alpha: 0.5 * k });
      g.ellipse(c.x, c.y, R(time) * 0.4, R(time) * 0.32).fill({ color: PIT, alpha: 0.5 * k });
      for (const a of arms(time)) g.poly(a.band, true).fill({ color: PIT, alpha: 0.8 * k });
      g.poly(rim(c, R(time), 0.8, seed), true).stroke({ width: Math.max(2, s * 0.05), color: ROCK_LO, alpha: 0.85 * k });
    }, { dark: true });
    t.draw(S, (g, v) => {
      const time = v * S, k = Math.min(1, v * 5);
      g.poly(rim(c, R(time) * 1.04, 0.8, seed), true).stroke({ width: 1.5, color: EMBER, alpha: 0.6 * k });
      for (const a of arms(time)) g.poly(a.edge, false).stroke({ width: 1.5, color: AMBER, alpha: 0.7 * k });
      for (let i = 0; i < 4; i++) {
        const a = seed + (i / 4) * TAU + spin(time) * 1.1 + 1.2, r = R(time) * (0.45 + 0.3 * Math.sin(time * 7 + i * 2));
        const x = c.x + Math.cos(a) * r, y = c.y + Math.sin(a) * r * 0.8;
        g.circle(x, y, s * 0.05).fill({ color: CRYSTAL, alpha: 0.35 * k });
        g.circle(x, y, s * 0.022).fill({ color: ICE, alpha: 0.95 * k });
      }
    });
    slide(t, c, s * 0.6, 0.8, 6, s * 0.05, 1, S);
    dust(t, c, s * 0.5, 4, s * 0.12, S);

    // THE TREMORS: a crack racing out underground to every opponent from the
    // edge of its square, gathering speed — whole on the landing frame.
    const LEAVE = S * 0.25;
    const runs = m.targets.map((r) => {
      const p = centre(r), d = Math.hypot(p.x - c.x, p.y - c.y) || 1;
      return tremor({ x: c.x + ((p.x - c.x) / d) * s * 0.5, y: c.y + ((p.y - c.y) / d) * s * 0.5 }, p, s);
    });
    const reach = (time: number) => clamp01((time - LEAVE) / (S - LEAVE)) ** 1.5;
    const fork = (r: ReturnType<typeof tremor>, f: number) => clamp01((f - r.forkAt) / 0.25);
    // Stones along each run, jolted up out of the ground as the tremor passes.
    const jolted = runs.flatMap((r) => {
      const n = r.main.length / 2 - 1, out: { x: number; y: number; f: number; rk: number[]; size: number }[] = [];
      for (let i = 1; i < n; i += 2) {
        const side = i % 4 === 1 ? 1 : -1;
        out.push({ x: r.main[i * 2] + side * s * 0.06, y: r.main[i * 2 + 1] - s * 0.02, f: i / n, rk: rockShape(), size: s * rand(0.03, 0.05) });
      }
      return out;
    });
    // The cracks outlast the delivery a little, fading as the sinkholes they
    // ran to open at their ends.
    const TAIL = 0.3, SPAN = S + TAIL;
    const after = (time: number) => (time < S ? 1 : Math.max(0, 1 - (time - S) / TAIL));
    t.draw(SPAN, (g, v) => {
      const time = v * SPAN, f = reach(Math.min(time, S)), a = after(time);
      if (f <= 0) return;
      for (const r of runs) {
        g.poly(part(r.main, f), false).stroke({ width: s * 0.05, color: CRACK, alpha: 0.9 * a, join: "round" });
        if (fork(r, f) > 0) g.poly(part(r.fork, fork(r, f)), false).stroke({ width: s * 0.032, color: CRACK, alpha: 0.85 * a, join: "round" });
      }
      for (const j of jolted) {
        const q = (f - j.f) * 4;
        if (q <= 0) continue;
        rock(g, j.x, j.y - Math.sin(Math.min(1, q) * Math.PI) * s * 0.06, j.size, j.f * 9 + Math.min(1, q) * 3, j.rk, a);
      }
    }, { dark: true });
    let grit = 0;
    t.draw(SPAN, (g, v, dt) => {
      const time = v * SPAN, f = reach(Math.min(time, S)), a = after(time);
      if (f <= 0) return;
      for (const r of runs) {
        const q = part(r.main, f), hx = q[q.length - 2], hy = q[q.length - 1];
        // Lit from below along its length, as the ground breaks open over it.
        g.poly(q, false).stroke({ width: s * 0.1, color: AMBER, alpha: 0.14 * a, join: "round" });
        g.poly(q.map((x) => x - 1), false).stroke({ width: 1.4, color: EMBER, alpha: 0.6 * a });
        if (fork(r, f) > 0) g.poly(part(r.fork, fork(r, f)).map((x) => x - 1), false).stroke({ width: 1.2, color: EMBER, alpha: 0.45 * a });
        // The tremor's head: the ground lit from below where it breaks open.
        if (time >= S) continue;
        g.circle(hx, hy, s * 0.1).fill({ color: AMBER, alpha: 0.3 });
        g.circle(hx, hy, s * 0.035).fill({ color: EMBER, alpha: 0.95 });
      }
      if (time >= S) return;
      grit += dt * 25 * runs.length * t.quality;
      for (; grit >= 1; grit--) {
        const q = part(runs[Math.floor(rand(0, runs.length))].main, f);
        t.spark(q[q.length - 2], q[q.length - 1], rand(-40, 40) * (s / 90), -rand(60, 140) * (s / 90), rand(0.25, 0.4), GRIT);
      }
    });
  },

  land(t: FxTools, m: SigMoment) {
    const c = centre(m.from), s = m.size;
    m.targets.forEach((r, i) => sinkhole(t, r, m.power[i] ?? 1, !!m.killed[i]));

    // IT GOES BACK UNDER: its own square closing dark over it, a pit of its
    // own turning shut with its crystals' blue lighting the way down, and it
    // is gone from sight (STEALTH). The stones it tore off itself fall away.
    const D = 1.15, seed = rand(0, 10);
    t.draw(D, (g, v) => {
      const time = v * D, k = env(time, 0.25, 0.75, D);
      g.rect(m.from.x, m.from.y, m.from.w, m.from.h).fill({ color: PIT, alpha: 0.45 * k });
      pit(g, c, s * (0.46 - 0.12 * clamp01(time / D)), k, -time * 4, -1, seed, false, CRYSTAL);
    }, { dark: true });
    t.draw(D, (g, v) => {
      const time = v * D, k = env(time, 0.25, 0.75, D);
      pit(g, c, s * (0.46 - 0.12 * clamp01(time / D)), k, -time * 4, -1, seed, true, CRYSTAL);
      g.circle(c.x, c.y, s * 0.06).fill({ color: CRYSTAL, alpha: 0.4 * k });
      g.circle(c.x, c.y, s * 0.025).fill({ color: ICE, alpha: 0.9 * k });
    });
    for (let i = 0; i < Math.round(8 * t.quality); i++)
      t.later(rand(0, 0.6), () => {
        const a = rand(0, TAU), r = s * rand(0.12, 0.42);
        t.spark(c.x + Math.cos(a) * r, c.y + Math.sin(a) * r, -Math.cos(a) * s * 0.12, -Math.sin(a) * s * 0.12, rand(0.25, 0.45), GLINT);
      });
    const floor = m.from.y + m.from.h * 0.92;
    const torn = [0, 1, 2].map((i) => ({ rk: rockShape(), vx: (i - 1) * rand(50, 90) * (s / 90), vy: -rand(130, 210) * (s / 90), rot: rand(0, TAU) }));
    t.draw(0.6, (g, v) => {
      const time = v * 0.6;
      for (const r of torn)
        rock(g, c.x + r.vx * time, Math.min(floor, c.y - s * 0.1 + r.vy * time + 750 * (s / 90) * time * time), s * 0.065, r.rot + time * 8, r.rk, 1 - v * v);
    }, { dark: true });
    dust(t, c, s * 0.38, 5, s * 0.14, 0.9);
  },
};

/** A sinkhole opening under a card the quake took: a dark pit spiralling
 *  down, the Deepest's blue glinting far down in it, its broken rim lit from
 *  below, dust lifting off it and rubble sliding in. Sized by what it did. */
function sinkhole(t: FxTools, r: Box, power: number, killed: boolean) {
  const c = centre(r), s = Math.min(r.w, r.h), k = Math.max(0.75, Math.min(1.5, power)) * (killed ? 1.15 : 1);
  const R = s * 0.46 * k, D = 1.1, seed = rand(0, 10), dir = Math.random() < 0.5 ? -1 : 1;
  const open = (time: number) => env(time, 0.16, 0.7, D);
  const size = (time: number) => R * (0.3 + 0.7 * open(time));
  t.draw(D, (g, v) => {
    const time = v * D;
    pit(g, c, size(time), open(time), dir * time * 4, dir, seed, false, EMBER);
  }, { dark: true });
  t.draw(D, (g, v) => {
    const time = v * D, o = open(time);
    pit(g, c, size(time), o, dir * time * 4, dir, seed, true, EMBER);
    const pulse = 0.7 + 0.3 * Math.sin(time * 14);
    g.circle(c.x, c.y + s * 0.02, s * 0.05).fill({ color: CRYSTAL, alpha: 0.35 * o * pulse });
    g.circle(c.x, c.y + s * 0.02, s * 0.018).fill({ color: ICE, alpha: 0.85 * o * pulse });
  });
  slide(t, c, R, 0.75, killed ? 7 : 5, s * 0.055 * Math.min(1.3, k), dir, 0.9, 0.04);
  dust(t, c, R, killed ? 8 : 5, s * 0.13 * k, 0.9, 0.05);
  t.flash(c, AMBER, 0.14 * k * (s / 80));
  for (let i = 0; i < Math.round(6 * k); i++) {
    const a = rand(0, TAU);
    t.spark(c.x + Math.cos(a) * R, c.y + Math.sin(a) * R * 0.75, Math.cos(a) * rand(20, 60) * (s / 90), -rand(40, 110) * (s / 90), rand(0.3, 0.5), GRIT);
  }
}
