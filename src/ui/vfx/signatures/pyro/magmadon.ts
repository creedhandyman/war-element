/** MAGMADON — Meltdown. "Deal 5 DMG (+ bonus) to every opponent in range, then
 *  erupt the same way every round for 2 HP a round, until it dies, is FROZEN,
 *  or can't pay." Meltdown scorches everyone in range, then repeats every
 *  round for 2 of its own HP. This is the FIRST eruption; the rounds after it
 *  play in PYRO's look.
 *
 *  Its art is a hulking magma golem of black crust, lava pouring down its body
 *  in rivers, a round furnace grate glowing in its chest and molten drips
 *  everywhere. So its fire is not flame but LAVA: heavy, deep red, slow, and
 *  it runs along the ground rather than flying through the air.
 *
 *  The DELIVERY is the golem going critical: the grate in its chest heats from
 *  a dull red through orange to white, and its crust splits — seams of lava
 *  racing out from the core across the card, forking as they go — while the
 *  first molten drops fall off it.
 *
 *  The LANDING is the meltdown. The core bursts, and lava pours out of the
 *  golem in rivers across the ground, one to every card in reach — a dark
 *  cooling crust along each bank, a molten channel inside, the head of each
 *  river the hottest, brightest lava there is. Where a river reaches a card it
 *  wells up under it: a molten pool spreads out round the card, swelling
 *  bubbles that burst into heavy spatter, low flames licking off its edge, then
 *  it crusts over and cools. Its own square keeps glowing — the seams still
 *  lit, a slow drip off it into a pool at its feet — because the meltdown does
 *  not stop: it goes on, round after round, until it can't pay.
 *
 *  The crust is drawn dark for real (`dark: true`), always beneath the lava
 *  that lights its edge, so it reads over an empty square; the pools are thin
 *  enough that the card reads through them. */
import type { Graphics } from "pixi.js";
import { centre, rand } from "../../looks/base";
import { pyroLick } from "../../looks/fire";
import type { FxTools, Pt, SparkStyle } from "../../looks/types";
import type { Signature, SigMoment } from "../types";

type Box = SigMoment["from"];

const TAU = Math.PI * 2;
// Lava, from the cooling crust to the white-hot core of the flow. Deeper and
// redder than PYRO's flame: this is rock that runs.
const CRUST = 0x160403, DEEP = 0xa3140a, LAVA = 0xe0360c, MOLTEN = 0xff7418, GOLD = 0xffbe3c, HOT = 0xfff0c4;
/** Molten drops off the golem: heavy, falling, cooling to deep red. */
const DRIP: SparkStyle = { palette: [GOLD, MOLTEN, LAVA, DEEP], gravity: 620, drag: 0.7, size: [5, 3], streak: false };
/** Spatter off a bursting bubble: heavier and hotter, thrown up and falling. */
const SPATTER: SparkStyle = { palette: [HOT, GOLD, MOLTEN, DEEP], gravity: 900, drag: 0.6, size: [6, 2], streak: false };

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeOut = (x: number) => 1 - (1 - x) * (1 - x);
const easeIn = (x: number) => x * x;
/** Heat as a colour: 0 a dull red, 1 white-hot. */
function heat(k: number): number {
  const stops = [DEEP, LAVA, MOLTEN, GOLD, HOT];
  const f = clamp01(k) * (stops.length - 1), i = Math.min(stops.length - 2, Math.floor(f)), q = f - i;
  const a = stops[i], b = stops[i + 1];
  const ch = (sh: number) => Math.round(((a >> sh) & 255) + (((b >> sh) & 255) - ((a >> sh) & 255)) * q);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

// ── Lines that grow ──────────────────────────────────────────────────────────

/** Running arc length along a flat point list. */
function lengths(pts: number[]): number[] {
  const cum = [0];
  for (let i = 1; i < pts.length / 2; i++) cum.push(cum[i - 1] + Math.hypot(pts[i * 2] - pts[i * 2 - 2], pts[i * 2 + 1] - pts[i * 2 - 1]));
  return cum;
}

/** The part of a sampled line between `from` and `upto` px along it. */
function span(pts: number[], cum: number[], from: number, upto: number): number[] {
  const at = (d: number) => {
    for (let i = 1; i < cum.length; i++)
      if (cum[i] >= d) {
        const f = (d - cum[i - 1]) / (cum[i] - cum[i - 1] || 1);
        return { i, x: pts[i * 2 - 2] + (pts[i * 2] - pts[i * 2 - 2]) * f, y: pts[i * 2 - 1] + (pts[i * 2 + 1] - pts[i * 2 - 1]) * f };
      }
    const n = cum.length - 1;
    return { i: n + 1, x: pts[n * 2], y: pts[n * 2 + 1] };
  };
  const a = at(Math.max(0, from)), b = at(Math.max(from, upto)), out = [a.x, a.y];
  for (let i = a.i; i < b.i; i++) out.push(pts[i * 2], pts[i * 2 + 1]);
  out.push(b.x, b.y);
  return out;
}

/** A body round a line, `w` across, swelling and pinching along its length
 *  the way a lava flow does (lumpy, never a clean stroke). */
function ribbon(line: number[], w: number, seed: number): number[] {
  const n = line.length / 2, left: number[] = [], right: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1);
    const tx = line[b * 2] - line[a * 2], ty = line[b * 2 + 1] - line[a * 2 + 1], l = Math.hypot(tx, ty) || 1;
    const hw = (w / 2) * (1 + 0.2 * Math.sin(i * 0.75 + seed) + 0.1 * Math.sin(i * 1.9 + seed * 2)) * (i === 0 ? 0.7 : 1);
    left.push(line[i * 2] - (ty / l) * hw, line[i * 2 + 1] + (tx / l) * hw);
    right.unshift(line[i * 2] + (ty / l) * hw, line[i * 2 + 1] - (tx / l) * hw);
  }
  return left.concat(right);
}

/** A lumpy round blob — lava welling, its edge rolling slowly. */
function blob(g: Graphics, c: Pt, rx: number, ry: number, time: number, seed: number): Graphics {
  const pts: number[] = [];
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * TAU;
    const k = 1 + 0.09 * Math.sin(3 * a + seed + time * 2.5) + 0.06 * Math.sin(5 * a + seed * 2 - time * 3.5);
    pts.push(c.x + Math.cos(a) * rx * k, c.y + Math.sin(a) * ry * k);
  }
  return g.poly(pts, true);
}

// ── The golem ────────────────────────────────────────────────────────────────

/** The furnace grate in its chest, where it is on the art: a little above the
 *  card's middle. */
const coreOf = (r: Box): Pt => ({ x: r.x + r.w / 2, y: r.y + r.h * 0.44 });

/** Its crust splitting: seams of lava out from the core to the card's edge,
 *  jagged, each with a fork. Fixed once, so they hold their shape as they
 *  open and as they glow on through the landing. */
interface Seam { pts: number[]; cum: number[]; total: number; fork: { at: number; pts: number[]; cum: number[] } }

function seamsOf(r: Box, n: number): Seam[] {
  const c = coreOf(r), s = Math.min(r.w, r.h), a0 = rand(0, TAU);
  return Array.from({ length: n }, (_, i) => {
    let a = a0 + (i / n) * TAU + rand(-0.25, 0.25), x = c.x + Math.cos(a) * s * 0.13, y = c.y + Math.sin(a) * s * 0.13;
    const pts = [x, y];
    for (let k = 0; k < 7; k++) {
      a += rand(-0.55, 0.55);
      const nx = x + Math.cos(a) * s * 0.052, ny = y + Math.sin(a) * s * 0.052;
      if (nx < r.x + 2 || nx > r.x + r.w - 2 || ny < r.y + 2 || ny > r.y + r.h - 2) break;
      x = nx; y = ny;
      pts.push(x, y);
    }
    const cum = lengths(pts), j = Math.max(1, Math.floor(pts.length / 4));
    let fa = a + (Math.random() < 0.5 ? -1 : 1) * rand(0.7, 1.1), fx = pts[j * 2], fy = pts[j * 2 + 1];
    const fp = [fx, fy];
    for (let k = 0; k < 3; k++) {
      fa += rand(-0.4, 0.4);
      fx = Math.min(r.x + r.w - 2, Math.max(r.x + 2, fx + Math.cos(fa) * s * 0.045));
      fy = Math.min(r.y + r.h - 2, Math.max(r.y + 2, fy + Math.sin(fa) * s * 0.045));
      fp.push(fx, fy);
    }
    return { pts, cum, total: cum[cum.length - 1], fork: { at: cum[Math.min(j, cum.length - 1)], pts: fp, cum: lengths(fp) } };
  });
}

/** The seams drawn `open` (0..1) of the way out, glowing at `k` heat. */
function drawSeams(g: Graphics, seams: Seam[], open: number, k: number, a: number, s: number) {
  if (a <= 0.02 || open <= 0.01) return;
  const col = heat(k);
  for (const sm of seams) {
    const up = sm.total * open, line = span(sm.pts, sm.cum, 0, up);
    if (line.length < 4) continue;
    g.poly(line, false).stroke({ width: Math.max(3, s * 0.06), color: LAVA, alpha: 0.28 * a, join: "round", cap: "round" });
    g.poly(line, false).stroke({ width: Math.max(1.2, s * 0.022), color: col, alpha: 0.95 * a, join: "round", cap: "round" });
    if (up > sm.fork.at) {
      const fl = span(sm.fork.pts, sm.fork.cum, 0, sm.fork.cum[sm.fork.cum.length - 1] * clamp01((up - sm.fork.at) / (sm.total * 0.4)));
      if (fl.length >= 4) g.poly(fl, false).stroke({ width: Math.max(1, s * 0.015), color: col, alpha: 0.8 * a, join: "round" });
    }
  }
}

/** The grate in its chest, glowing at `k` heat: a ring, and the light coming
 *  through it in slots between the bars — a furnace, not a fireball. */
function drawCore(g: Graphics, c: Pt, R: number, k: number, a: number) {
  if (a <= 0.02) return;
  const col = heat(k);
  g.circle(c.x, c.y, R * 2.1).fill({ color: LAVA, alpha: 0.16 * a * (0.4 + k) });
  g.circle(c.x, c.y, R * 1.05).stroke({ width: Math.max(1.5, R * 0.22), color: col, alpha: 0.9 * a });
  // Four slots of light between the bars, each cut to the circle.
  const slots = 4, w = (R * 2) / (slots * 1.6);
  for (let i = 0; i < slots; i++) {
    const x = c.x - R + (R * 2 * (i + 0.5)) / slots, dx = x - c.x, h = Math.sqrt(Math.max(0, R * R * 0.8 - dx * dx));
    g.rect(x - w / 2, c.y - h, w, h * 2).fill({ color: col, alpha: 0.85 * a });
  }
  // Past orange, the white bleeds out through the middle of the grate.
  if (k > 0.5) g.circle(c.x, c.y, R * 0.45).fill({ color: HOT, alpha: (k - 0.5) * 1.4 * a });
}

// ── The flow ─────────────────────────────────────────────────────────────────

/** A river of lava from the golem's edge to a card: its meandering course,
 *  when it leaves and how long it runs, and the card it runs to. */
interface River { pts: number[]; cum: number[]; total: number; seed: number; at: number; run: number; r: Box; p: Pt; k: number; killed: boolean }

/** Where a ray from a square's centre along (ux, uy) leaves it. */
function edgeOf(c: Pt, ux: number, uy: number, half: number): Pt {
  const k = Math.min(half / Math.max(1e-3, Math.abs(ux)), half / Math.max(1e-3, Math.abs(uy)));
  return { x: c.x + ux * k, y: c.y + uy * k };
}

/** A river's course from `from` to `to`: lava meanders a little, never much. */
function courseOf(from: Pt, to: Pt, s: number): { pts: number[]; cum: number[]; total: number } {
  const dx = to.x - from.x, dy = to.y - from.y, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
  const amp = Math.min(L * 0.1, s * 0.12) * (Math.random() < 0.5 ? -1 : 1), ph = rand(0, TAU), N = 18, pts: number[] = [];
  for (let i = 0; i <= N; i++) {
    const f = i / N, e = Math.sin(Math.PI * f);
    const off = (amp * Math.sin(f * Math.PI * 1.4 + ph) + amp * 0.35 * Math.sin(f * Math.PI * 4.6 + ph * 2)) * e;
    pts.push(from.x + dx * f + nx * off, from.y + dy * f + ny * off);
  }
  const cum = lengths(pts);
  return { pts, cum, total: cum[N] };
}

/** When the core has burst and the lava starts to pour, s. */
const POUR = 0.06;

export const MAGMADON: Signature = {
  shake: 1.3,
  // It does not step in: it melts where it stands, and the lava comes to them.
  lunge: false,

  deliver(t: FxTools, m: SigMoment, seconds: number) {
    const r = m.from, s = m.size, S = seconds, core = coreOf(r), seams = seamsOf(r, 6);
    // Heat building in the core under everything: it only grows.
    t.charge(core, s * 1.15, LAVA, 0.4, S);
    // The crust round the core darkened, so the seams split something.
    t.draw(S, (g, u) => {
      blob(g, core, s * 0.36, s * 0.4, u * S, 3).fill({ color: CRUST, alpha: 0.32 * easeOut(clamp01(u / 0.3)) });
    }, { dark: true });
    t.draw(S, (g, u) => {
      const k = easeIn(u);
      // The seams lag the core: first it glows, then the crust gives.
      drawSeams(g, seams, easeOut(clamp01((u - 0.2) / 0.75)), 0.25 + 0.6 * k, 1, s);
      drawCore(g, core, s * 0.12 * (1 + 0.12 * k), k, clamp01(u * 5));
    });
    // The first drops let go of its underside as the seams reach it.
    const drops = Math.round(6 * t.quality);
    for (let i = 0; i < drops; i++)
      t.later(S * rand(0.45, 0.95), () => t.spark(r.x + r.w * rand(0.2, 0.8), r.y + r.h * rand(0.7, 0.92), rand(-8, 8), rand(10, 40) * (s / 90), rand(0.3, 0.45), DRIP));
  },

  land(t: FxTools, m: SigMoment) {
    const r = m.from, s = m.size, half = s * 0.45, c = centre(r), core = coreOf(r), seams = seamsOf(r, 6), sc = s / 90;
    // THE CORE BURSTS.
    t.flash(core, HOT, 0.5 * sc);
    t.ring(r, GOLD, 0.25, 0.95, 0.32, 3);
    for (let i = 0; i < Math.round(10 * t.quality); i++) {
      const a = rand(0, TAU), v = rand(90, 200) * sc;
      t.spark(core.x, core.y, Math.cos(a) * v, Math.sin(a) * v - 80 * sc, rand(0.35, 0.55), SPATTER);
    }
    // THE RIVERS: from its edge to each card in reach — lava does not hurry,
    // but it does not stop.
    const rivers: River[] = m.targets.map((tr, i) => {
      const p = centre(tr), d = Math.hypot(p.x - c.x, p.y - c.y) || 1, ux = (p.x - c.x) / d, uy = (p.y - c.y) / d;
      const course = courseOf(edgeOf(c, ux, uy, half * 0.8), { x: p.x - ux * s * 0.12, y: p.y - uy * s * 0.12 }, s);
      return { ...course, seed: rand(0, 100), at: POUR + rand(0, 0.03), run: 0.16 + 0.1 * (course.total / s), r: tr, p,
        k: Math.max(0.6, Math.min(1.6, m.power[i] ?? 1)), killed: !!m.killed[i] };
    });
    const flowed = (v: River, time: number) => v.total * (1 - Math.pow(1 - clamp01((time - v.at) / v.run), 1.6));
    const cool = (v: River, time: number) => 1 - clamp01((time - v.at - v.run - 0.3) / 0.35);
    const D = Math.max(0.5, ...rivers.map((v) => v.at + v.run + 0.65));
    // The crust along each bank, dark and wide: lava skins over as it runs.
    t.draw(D, (g, u) => {
      const time = u * D;
      for (const v of rivers) {
        if (time < v.at) continue;
        const line = span(v.pts, v.cum, 0, flowed(v, time));
        if (line.length < 4) continue;
        g.poly(ribbon(line, s * 0.3 * v.k, v.seed), true).fill({ color: CRUST, alpha: 0.6 * cool(v, time) });
      }
    }, { dark: true });
    // The molten channel inside it: deep red where it has been running a
    // while, hotter toward the head, and the head itself white-gold, spitting.
    let spit = 0;
    t.draw(D, (g, u, dt) => {
      const time = u * D;
      for (const v of rivers) {
        if (time < v.at) continue;
        const up = flowed(v, time), a = cool(v, time), w = s * v.k;
        if (a <= 0.02 || up < 2) continue;
        const all = span(v.pts, v.cum, 0, up);
        // The bank: the crust's lip, lit dull red by the flow inside it.
        g.poly(ribbon(all, w * 0.3, v.seed), true).stroke({ width: 1.2, color: DEEP, alpha: 0.8 * a, join: "round" });
        g.poly(ribbon(all, w * 0.2, v.seed), true).fill({ color: DEEP, alpha: 0.85 * a });
        g.poly(ribbon(span(v.pts, v.cum, up * 0.15, up), w * 0.13, v.seed + 1), true).fill({ color: LAVA, alpha: 0.85 * a });
        g.poly(span(v.pts, v.cum, up * 0.45, up), false).stroke({ width: w * 0.06, color: MOLTEN, alpha: 0.9 * a, join: "round", cap: "round" });
        g.poly(span(v.pts, v.cum, up * 0.75, up), false).stroke({ width: Math.max(1.2, w * 0.022), color: GOLD, alpha: 0.9 * a, join: "round", cap: "round" });
        if (up / v.total < 0.99) {
          const hx = all[all.length - 2], hy = all[all.length - 1];
          g.circle(hx, hy, w * 0.15).fill({ color: MOLTEN, alpha: 0.6 });
          g.circle(hx, hy, w * 0.09).fill({ color: GOLD, alpha: 0.95 });
          g.circle(hx, hy, w * 0.045).fill({ color: HOT, alpha: 1 });
          spit += dt * 22 * t.quality;
          for (; spit >= 1; spit--) t.spark(hx, hy, rand(-40, 40) * sc, -rand(30, 90) * sc, rand(0.25, 0.4), DRIP);
        }
      }
    });
    // Where each river reaches a card, the lava wells up under it.
    for (const v of rivers) t.later(v.at + v.run, () => well(t, v));
    // ITS OWN SQUARE keeps melting: the seams still lit and cooling slowly, a
    // drip off its underside into a pool at its feet.
    const OWN = 1.15, feet = { x: c.x, y: r.y + r.h * 0.9 }, seed = rand(0, 100);
    t.draw(OWN, (g, u) => {
      blob(g, feet, s * 0.36, s * 0.1, u * OWN, seed).fill({ color: CRUST, alpha: 0.45 * clamp01(u * 6) * (1 - u) });
    }, { dark: true });
    let drip = 0;
    t.draw(OWN, (g, u, dt) => {
      const a = 1 - easeIn(u), time = u * OWN, pk = clamp01(u * 4);
      drawSeams(g, seams, 1, 0.75 - 0.45 * u, a, s);
      drawCore(g, core, s * 0.12, 0.85 - 0.5 * u, a);
      blob(g, feet, s * 0.3 * pk, s * 0.075 * pk, time, seed).fill({ color: LAVA, alpha: 0.45 * a }).stroke({ width: 1.5, color: GOLD, alpha: 0.75 * a });
      drip += dt * 7 * t.quality;
      for (; drip >= 1; drip--) t.spark(r.x + r.w * rand(0.25, 0.75), r.y + r.h * rand(0.55, 0.8), 0, rand(5, 25) * sc, rand(0.3, 0.45), DRIP);
    });
  },
};

/** THE LAVA WELLING UP under a card a river reached: a molten pool spreading
 *  out round it under a dark crust, bubbles swelling and bursting into
 *  spatter, low flames licking off its edge; then it skins over and cools.
 *  A card that died sinks into it: a bigger heave and a burst of spatter. */
function well(t: FxTools, v: River) {
  const s = Math.min(v.r.w, v.r.h), sc = s / 90, p = v.p, k = v.k, seed = rand(0, 100), D = 0.68;
  const c2 = { x: p.x, y: p.y + s * 0.06 };
  t.flash(p, MOLTEN, 0.3 * k * sc);
  t.glow(v.r, LAVA, 0.32, 0.5, 1.0);
  const n = Math.round((9 + 5 * k) * t.quality);
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + rand(-1.2, 1.2), sp = rand(100, 220) * sc * Math.sqrt(k);
    t.spark(p.x + rand(-0.2, 0.2) * s, p.y + rand(-0.05, 0.15) * s, Math.cos(a) * sp, Math.sin(a) * sp, rand(0.35, 0.55), SPATTER);
  }
  const R = s * 0.4 * Math.min(1.25, 0.75 + 0.3 * k);
  const spread = (time: number) => easeOut(clamp01(time / 0.16));
  const fade = (time: number) => 1 - clamp01((time - 0.3) / (D - 0.3));
  t.draw(D, (g, u) => {
    const time = u * D, q = spread(time);
    blob(g, c2, R * 1.12 * q, R * 0.9 * q, time, seed).fill({ color: CRUST, alpha: 0.42 * fade(time) });
  }, { dark: true });
  // Bubbles: swelling on the pool and bursting, each at its own moment.
  const bubbles = Array.from({ length: 3 }, () => ({ x: c2.x + rand(-0.5, 0.5) * R, y: c2.y + rand(-0.35, 0.35) * R, at: rand(0.08, 0.32), life: rand(0.14, 0.2), r: s * rand(0.05, 0.08) }));
  for (const b of bubbles)
    t.later(b.at + b.life, () => {
      for (let i = 0; i < Math.round(4 * t.quality); i++) {
        const a = -Math.PI / 2 + rand(-0.9, 0.9), sp = rand(70, 140) * sc;
        t.spark(b.x, b.y, Math.cos(a) * sp, Math.sin(a) * sp, rand(0.28, 0.4), SPATTER);
      }
    });
  t.draw(D, (g, u) => {
    const time = u * D, q = spread(time), a = fade(time), hot = 1 - clamp01(time / 0.45);
    // The pool: a molten sheet, white-gold where it is still welling up and
    // reddening as it crusts.
    blob(g, c2, R * q, R * 0.78 * q, time, seed).fill({ color: LAVA, alpha: 0.24 * a }).stroke({ width: 2, color: heat(0.55 + 0.4 * hot), alpha: 0.9 * a });
    blob(g, c2, R * 0.55 * q, R * 0.42 * q, time, seed + 2).fill({ color: heat(0.45 + 0.5 * hot), alpha: 0.32 * a });
    for (const b of bubbles) {
      const bq = (time - b.at) / b.life;
      if (bq <= 0 || bq >= 1) continue;
      g.circle(b.x, b.y, b.r * (0.3 + 0.7 * bq)).fill({ color: MOLTEN, alpha: 0.35 * a }).stroke({ width: 1.3, color: HOT, alpha: 0.9 * a });
    }
    // Low flames licking off the far edge of the pool while it is fresh.
    if (time < 0.5)
      for (let i = 0; i < 3; i++) {
        const f = (i - 1) * 0.55;
        pyroLick(g, c2.x + f * R, c2.y - R * 0.45 * (1 - Math.abs(f)), s * 0.2 * (1 - time / 0.5) * q, s * 0.1, time, seed + i * 3, 0.7 * a);
      }
  });
  if (v.killed)
    t.later(0.14, () => {
      t.ring(v.r, GOLD, 0.3, 1.15, 0.4, 3);
      t.flash(p, GOLD, 0.35 * sc);
      for (let i = 0; i < Math.round(12 * t.quality); i++) {
        const a = -Math.PI / 2 + rand(-1.4, 1.4), sp = rand(120, 240) * sc;
        t.spark(p.x, p.y, Math.cos(a) * sp, Math.sin(a) * sp, rand(0.4, 0.6), SPATTER);
      }
    });
}
