/** WARKILN — Breakthrough. "Roll up to 2 slots forward, then grind the lane:
 *  10 DMG to the first opponent ahead and 5 to each one packed behind it." A
 *  kiln on tracks. Breakthrough rolls forward and grinds the lane.
 *
 *  Its art is a siege-furnace on tank tracks: an iron fortress with a
 *  chimney crowned in fire, furnace light glaring through its grilles, a
 *  drum of spiked rollers at its front. Its fire is INDUSTRY's — a stoked
 *  furnace, iron, sparks off steel and soot — not a flame thrown. The
 *  DELIVERY is it getting under way: the furnace is stoked, three beats, the
 *  chimney roaring up taller and spitting a fountain of sparks on each, the
 *  grilles at its front glaring brighter; and it rolls, its tracks pressing
 *  two cleated treads into the ground behind it (dark, the cleats glowing
 *  from the furnace heat).
 *
 *  The LANDING is the grind: the spiked roller-drum driven down the lane
 *  ahead as a wall of furnace heat, the drum turning, fire banked up behind
 *  it and a red-hot scorch laid along the lane where it has been. It goes
 *  THROUGH each card in turn, nearest first, and each one it reaches is
 *  ground — a flash, sparks thrown off both sides of the drum like a
 *  grinding wheel's, three glowing scores raked into the card along the
 *  lane — while sooty furnace smoke rolls up behind it. The lane is always
 *  drawn along `m.ahead`: aimed by Domination it grinds sideways just as
 *  well.
 *
 *  It draws its own roll (no lunge). The treads, the drum's iron and the
 *  smoke are dark for real, each lit along its edge. */
import { centre, rand } from "../../looks/base";
import { pyroFlick, pyroLick } from "../../looks/fire";
import type { FxTools, Pt, SparkStyle } from "../../looks/types";
import type { Signature, SigMoment } from "../types";

type Box = SigMoment["from"];

const TAU = Math.PI * 2;
// The furnace, as light: its orange, a coal's amber, white-yellow at the core.
const FURNACE = 0xff7a1e, COAL = 0xffa83a, CORE = 0xfff2b0, EMBER_RED = 0xd8361a;
// Iron and soot (normal blend), and the furnace light on their edges.
const IRON = 0x17100c, TREAD = 0x0d0907, SOOT = 0x1e1714, LIT = 0xff8a30, SOOT_RIM = 0xd08a50;

/** Sparks off steel being ground: fast, streaked, white-yellow cooling to red. */
const GRIND: SparkStyle = { palette: [CORE, COAL, FURNACE, EMBER_RED], gravity: 420, drag: 0.55, size: [5, 1.5], streak: true };
/** The chimney's fountain: shot up, arcing over, falling. */
const FOUNT: SparkStyle = { palette: [CORE, COAL, FURNACE, EMBER_RED], gravity: 520, drag: 0.7, size: [4, 1.5], streak: true };

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeOut = (x: number) => 1 - (1 - x) * (1 - x);
const smooth = (x: number) => x * x * (3 - 2 * x);

/** Its frame: where it starts and stops, "ahead" (the lane, whichever way it
 *  is aimed) and "across", how far it rolls, and the lane: each target's
 *  distance down it from where it stops, nearest first, and where it ends. */
function frameOf(m: SigMoment) {
  const s = m.size, c0 = centre(m.from), c1 = centre(m.to), A = m.ahead, N = { x: -A.y, y: A.x };
  const roll = Math.max(0, (c1.x - c0.x) * A.x + (c1.y - c0.y) * A.y);
  const lane = m.targets.map((r, i) => {
    const p = centre(r);
    return { i, r, p, d: (p.x - c1.x) * A.x + (p.y - c1.y) * A.y };
  }).sort((a, b) => a.d - b.d);
  const end = lane.length ? lane[lane.length - 1].d + s * 0.55 : s * 1.6;
  return { s, c0, c1, A, N, roll, lane, start: s * 0.45, end: Math.max(s * 0.9, end) };
}
type Frame = ReturnType<typeof frameOf>;

/** A point `d` down the lane from `o` and `l` across it. */
const along = (f: Frame, o: Pt, d: number, l = 0): Pt => ({ x: o.x + f.A.x * d + f.N.x * l, y: o.y + f.A.y * d + f.N.y * l });

/** A quad from four (along, across) corners round `o`, as a point list. */
function quad(f: Frame, o: Pt, pts: [number, number][]): number[] {
  return pts.flatMap(([d, l]) => { const p = along(f, o, d, l); return [p.x, p.y]; });
}

/** A puff of soot: a soft lumpy blob. */
function puffShape(x: number, y: number, r: number, seed: number): number[] {
  const pts: number[] = [];
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * TAU, rr = r * (1 + 0.14 * Math.sin(3 * a + seed) + 0.07 * Math.sin(5 * a - seed));
    pts.push(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.85);
  }
  return pts;
}

/** Furnace smoke rolling up off points `at(k)` (k: 0..1 through `seconds`),
 *  `rate` puffs a second: dark soot, its underside lit by the furnace. */
function soot(t: FxTools, seconds: number, rate: number, size: number, at: (k: number) => Pt | null, delay = 0) {
  const D = seconds + 0.75, sc = size / 10;
  const puffs: { x: number; y: number; vx: number; vy: number; r: number; age: number; life: number; seed: number }[] = [];
  let acc = 0;
  const step = (time: number, dt: number) => {
    if (time < seconds) {
      acc += dt * rate * t.quality;
      for (; acc >= 1; acc--) {
        const p = at(time / seconds);
        if (p && puffs.length < 18)
          puffs.push({ x: p.x, y: p.y, vx: rand(-12, 12), vy: -rand(30, 60) * Math.min(1.5, sc * 0.6), r: size * rand(0.75, 1.15), age: 0, life: rand(0.6, 0.85), seed: rand(0, 100) });
      }
    }
    for (let i = puffs.length - 1; i >= 0; i--) {
      const q = puffs[i];
      q.age += dt;
      if (q.age >= q.life) { puffs.splice(i, 1); continue; }
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.vy *= Math.pow(0.55, dt);
    }
  };
  t.draw(D, (g, v, dt) => {
    step(v * D, dt);
    for (const q of puffs) {
      const k = q.age / q.life;
      g.poly(puffShape(q.x, q.y, q.r * (1 + 1.2 * k), q.seed), true).fill({ color: SOOT, alpha: 0.72 * Math.sin(Math.PI * Math.min(1, k + 0.12)) });
    }
  }, { dark: true, delay });
  t.draw(D, (g) => {
    for (const q of puffs) {
      const k = q.age / q.life, R = q.r * (1 + 1.2 * k), a = 0.7 * (1 - k);
      g.poly(puffShape(q.x, q.y, R, q.seed), true).fill({ color: SOOT_RIM, alpha: 0.06 * (1 - k) });
      // Lit from below, by the furnace: the underside of each puff.
      g.moveTo(q.x + Math.cos(0.15 * Math.PI) * R, q.y + Math.sin(0.15 * Math.PI) * R * 0.85)
        .arc(q.x, q.y, R, 0.15 * Math.PI, 0.85 * Math.PI).stroke({ width: 1.3, color: SOOT_RIM, alpha: a });
    }
  }, { delay });
}

export const WARKILN: Signature = {
  shake: 1.5,
  // It draws its own roll: the token jumps to where it stops as the step
  // lands.
  lunge: false,

  deliver(t: FxTools, m: SigMoment, seconds: number) {
    const f = frameOf(m), { s, c0, A, N } = f, S = seconds, sc = s / 90, seed = rand(0, 100);
    /** How far it has rolled: under way slowly, a tank's pace. */
    const pos = (time: number) => f.roll * smooth(clamp01((time - S * 0.15) / (S * 0.85)));
    const at = (time: number) => along(f, c0, pos(time));
    const stokes = [0.04, 0.38, 0.72].map((q) => q * S);
    /** How hard the furnace is drawing: a flare on each stoke. */
    const draw = (time: number) => {
      let b = 0.3;
      for (const st of stokes) if (time >= st) b = Math.max(b, 1 - (time - st) / 0.22);
      return b;
    };
    const chim = (time: number) => along(f, at(time), -s * 0.08);
    for (const st of stokes) {
      t.later(st, () => {
        const c = chim(st), top = { x: c.x, y: c.y - s * 0.14 };
        t.flash(top, COAL, 0.09 * (s / 80));
        for (let i = 0; i < Math.round(13 * t.quality); i++)
          t.spark(top.x + rand(-3, 3), top.y, rand(-100, 100) * sc, -rand(240, 400) * sc, rand(0.45, 0.65), FOUNT);
      });
    }
    t.glow(m.from, FURNACE, 0.2, S * 0.6, 0.95);

    // THE TREADS pressed in behind it as it rolls: two dark bands, their
    // cleats glowing with the furnace's heat.
    const D = S + 0.4;
    const gone = (time: number) => 1 - clamp01((time - S) / 0.4);
    const TW = s * 0.15, TO = s * 0.31, cleat = s * 0.085;
    t.draw(D, (g, v) => {
      const time = v * D, h = pos(Math.min(time, S)), a = gone(time);
      if (h < s * 0.04) return;
      for (const sd of [-1, 1])
        g.poly(quad(f, c0, [[-s * 0.42, sd * TO - TW / 2], [h - s * 0.42, sd * TO - TW / 2], [h - s * 0.42, sd * TO + TW / 2], [-s * 0.42, sd * TO + TW / 2]]), true)
          .fill({ color: TREAD, alpha: 0.85 * a });
    }, { dark: true });
    t.draw(D, (g, v) => {
      const time = v * D, h = pos(Math.min(time, S)), a = gone(time);
      if (h < s * 0.04) return;
      for (const sd of [-1, 1]) {
        for (let d = -s * 0.42 + cleat * 0.5; d < h - s * 0.42; d += cleat) {
          const p0 = along(f, c0, d, sd * TO - TW * 0.42), p1 = along(f, c0, d, sd * TO + TW * 0.42);
          g.moveTo(p0.x, p0.y).lineTo(p1.x, p1.y);
        }
        g.stroke({ width: Math.max(1.2, s * 0.022), color: LIT, alpha: 0.6 * a });
      }
    });

    // THE KILN under way: its chimney roaring, the grilles at its front
    // glaring, grit churned off the tracks.
    let grit = 0;
    t.draw(S, (g, v, dt) => {
      const time = v * S, o = at(time), b = draw(time), a = Math.min(1, time / 0.05);
      // The grilles: three slats of furnace light across its front.
      for (let i = 0; i < 3; i++) {
        const d = s * (0.16 + i * 0.09);
        g.poly(quad(f, o, [[d - s * 0.03, -s * 0.3], [d + s * 0.03, -s * 0.3], [d + s * 0.03, s * 0.3], [d - s * 0.03, s * 0.3]]), true)
          .fill({ color: i === 1 ? COAL : FURNACE, alpha: (0.35 + 0.5 * b) * a });
      }
      const gc = along(f, o, s * 0.255);
      g.circle(gc.x, gc.y, s * 0.3).fill({ color: FURNACE, alpha: 0.1 * b * a });
      // The chimney: a stack, and the fire crowning it, taller on a stoke.
      const c = chim(time);
      g.rect(c.x - s * 0.06, c.y - s * 0.14, s * 0.12, s * 0.16).stroke({ width: 1.3, color: LIT, alpha: 0.85 * a });
      const top = { x: c.x, y: c.y - s * 0.14 };
      g.circle(top.x, top.y, s * 0.1).fill({ color: COAL, alpha: 0.35 * a });
      pyroLick(g, top.x, top.y, s * (0.34 + 0.55 * b), s * (0.2 + 0.08 * b), time, seed, a);
      pyroLick(g, top.x - s * 0.05, top.y, s * (0.2 + 0.3 * b), s * 0.12, time, seed + 7, 0.8 * a);
      pyroLick(g, top.x + s * 0.05, top.y, s * (0.18 + 0.26 * b), s * 0.11, time, seed + 13, 0.8 * a);
      if (f.roll > 0 && pos(time) > 0 && pos(time) < f.roll) {
        grit += dt * 24 * t.quality;
        for (; grit >= 1; grit--) {
          const sd = Math.random() < 0.5 ? -1 : 1, p = along(f, o, -s * 0.38, sd * TO), vv = rand(50, 120) * sc;
          t.spark(p.x, p.y, (-A.x * 0.6 + N.x * sd * 0.6) * vv, (-A.y * 0.6 + N.y * sd * 0.6) * vv - 30 * sc, rand(0.25, 0.4), GRIND);
        }
      }
    });
    /** Its iron hull, once it has rolled off its own square (until then the
     *  card IS the kiln). */
    const hull = (time: number) => quad(f, at(time), [[-s * 0.42, -s * 0.4], [s * 0.42, -s * 0.4], [s * 0.42, s * 0.4], [-s * 0.42, s * 0.4]]);
    const hullA = (time: number) => clamp01((pos(time) - s * 0.35) / (s * 0.35)) * (time > S - 0.01 ? 0 : 1);
    t.draw(S, (g, v) => {
      const time = v * S, c = chim(time), a = Math.min(1, time / 0.05), ha = hullA(time);
      if (ha > 0.02) g.poly(hull(time), true).fill({ color: IRON, alpha: 0.85 * ha });
      g.rect(c.x - s * 0.06, c.y - s * 0.14, s * 0.12, s * 0.16).fill({ color: IRON, alpha: 0.9 * a });
    }, { dark: true });
    t.draw(S, (g, v) => {
      const time = v * S, ha = hullA(time);
      if (ha > 0.02) g.poly(hull(time), true).stroke({ width: 1.5, color: LIT, alpha: 0.8 * ha, join: "round" });
    });
    soot(t, S, 10, s * 0.14, (k) => { const c = chim(k * S); return { x: c.x + rand(-3, 3), y: c.y - s * 0.4 }; });
  },

  land(t: FxTools, m: SigMoment) {
    const f = frameOf(m), { s, c1, A, N } = f, sc = s / 90, seed = rand(0, 100);
    const span = f.end - f.start, G = Math.max(0.28, Math.min(0.55, 0.16 + 0.11 * (span / s)));
    /** Where the drum is down the lane: driven at a grinding, even pace. */
    const front = (time: number) => f.start + span * clamp01(time / G);
    const W = s * 0.52, T = s * 0.24, FADE = 0.16;
    const shown = (time: number) => Math.min(1, time / 0.04) * (1 - clamp01((time - G) / FADE));
    const D = G + FADE;
    // The scorch it lays down the lane behind it: red-hot, cooling.
    t.draw(D + 0.45, (g, v) => {
      const time = v * (D + 0.45), d = front(Math.min(time, G)), a = 1 - clamp01((time - G) / 0.55);
      if (d <= f.start) return;
      const q = quad(f, c1, [[f.start, -W * 0.85], [d, -W * 0.85], [d, W * 0.85], [f.start, W * 0.85]]);
      g.poly(q, true).fill({ color: EMBER_RED, alpha: 0.12 * a });
      for (const sd of [-1, 1]) {
        const p0 = along(f, c1, f.start, sd * W * 0.85), p1 = along(f, c1, d, sd * W * 0.85);
        g.moveTo(p0.x, p0.y).lineTo(p1.x, p1.y).stroke({ width: 1.4, color: FURNACE, alpha: 0.55 * a });
      }
    });
    // THE DRUM: iron, its spikes forward, turning (bands running over it).
    const spikes = 6;
    t.draw(D, (g, v) => {
      const time = v * D, o = along(f, c1, front(Math.min(time, G))), a = shown(time);
      if (a <= 0.02) return;
      g.poly(quad(f, o, [[-T / 2, -W], [T / 2, -W], [T / 2, W], [-T / 2, W]]), true).fill({ color: IRON, alpha: 0.95 * a });
    }, { dark: true });
    let sp = 0;
    t.draw(D, (g, v, dt) => {
      const time = v * D, d = front(Math.min(time, G)), o = along(f, c1, d), a = shown(time);
      if (a <= 0.02) return;
      // The heat banked up behind it: a wall of furnace fire.
      for (let i = 0; i < 5; i++) {
        const b = along(f, o, -T * 0.6, (i / 4 - 0.5) * W * 1.7);
        pyroLick(g, b.x, b.y, s * (0.44 + 0.1 * pyroFlick(time, seed + i)), s * 0.24, time, seed + i * 2.7, 0.9 * a);
      }
      const halo = along(f, o, -T * 0.4);
      g.ellipse(halo.x, halo.y, s * 0.55, s * 0.32).fill({ color: FURNACE, alpha: 0.12 * a });
      // The drum: lit iron, bands running over it as it turns, its spikes.
      g.poly(quad(f, o, [[-T / 2, -W], [T / 2, -W], [T / 2, W], [-T / 2, W]]), true).stroke({ width: 1.6, color: LIT, alpha: 0.95 * a, join: "round" });
      const turn = (time * 9) % 1;
      for (let b = 0; b < 3; b++) {
        const dd = -T / 2 + T * ((b / 3 + turn) % 1);
        const p0 = along(f, o, dd, -W), p1 = along(f, o, dd, W);
        g.moveTo(p0.x, p0.y).lineTo(p1.x, p1.y);
      }
      g.stroke({ width: 1.2, color: COAL, alpha: 0.7 * a });
      // Its hubs, a glowing boss at each end of the drum.
      for (const sd of [-1, 1]) {
        const hb = along(f, o, 0, sd * W);
        g.circle(hb.x, hb.y, T * 0.42).fill({ color: COAL, alpha: 0.5 * a }).stroke({ width: 1.4, color: CORE, alpha: 0.9 * a });
      }
      for (let i = 0; i < spikes; i++) {
        const l = (-0.5 + (i + 0.5) / spikes) * W * 2, hw = W / spikes * 0.6, len = s * 0.15;
        g.poly(quad(f, o, [[T / 2, l - hw], [T / 2 + len, l], [T / 2, l + hw], [T / 2, l]]), true).fill({ color: CORE, alpha: 0.85 * a });
      }
      // Sparks thrown off both ends, as off a grinding wheel.
      if (time < G) {
        sp += dt * 46 * t.quality;
        for (; sp >= 1; sp--) {
          const sd = Math.random() < 0.5 ? -1 : 1, p = along(f, o, T * 0.3, sd * W), vv = rand(150, 300) * sc;
          t.spark(p.x, p.y, (N.x * sd * 0.85 - A.x * 0.45) * vv, (N.y * sd * 0.85 - A.y * 0.45) * vv - 40 * sc, rand(0.25, 0.4), GRIND);
        }
      }
    });
    // EACH CARD it reaches, nearest first: ground.
    for (const ln of f.lane) {
      const when = G * clamp01((ln.d - s * 0.12 - f.start) / span);
      t.later(when, () => grindHit(t, f, ln.r, m.power[ln.i] ?? 1, !!m.killed[ln.i]));
    }
    // Sooty furnace smoke rolling up behind the drum, and a last burst where
    // it stops.
    soot(t, G, 18, s * 0.16, (k) => along(f, c1, front(k * G) - s * 0.3, rand(-0.4, 0.4) * W));
    t.later(G, () => {
      const p = along(f, c1, f.end);
      t.flash(p, FURNACE, 0.1 * (s / 80));
      for (let i = 0; i < Math.round(10 * t.quality); i++) {
        const a = rand(0, TAU), vv = rand(80, 200) * sc;
        t.spark(p.x, p.y, Math.cos(a) * vv, Math.sin(a) * vv - 60 * sc, rand(0.3, 0.45), GRIND);
      }
    });
  },
};

/** A card the drum goes through: a flash, a fan of grinding sparks off
 *  each side, and three glowing scores raked down it along the lane. */
function grindHit(t: FxTools, f: Frame, r: Box, power: number, killed: boolean, s: number = f.s) {
  const p = centre(r), k = Math.max(0.6, Math.min(1.6, power)), sc = s / 90, { A, N } = f;
  t.flash(p, COAL, 0.13 * k * (s / 80));
  t.glow(r, FURNACE, 0.26 * k, 0.4, 1.0);
  t.ring(r, FURNACE, 0.3, 1.1 + 0.2 * k, 0.32, 3);
  for (const sd of [-1, 1]) {
    for (let i = 0; i < Math.round(9 * k); i++) {
      const a = Math.atan2(N.y * sd, N.x * sd) + rand(-0.55, 0.35) * sd, vv = rand(170, 340) * sc;
      t.spark(p.x + N.x * sd * s * 0.3, p.y + N.y * sd * s * 0.3, Math.cos(a) * vv - A.x * 60 * sc, Math.sin(a) * vv - A.y * 60 * sc - 50 * sc, rand(0.3, 0.5), GRIND);
    }
  }
  // The scores: three lines raked along the lane, dark, glowing white-hot
  // as they are cut and cooling to furnace orange.
  const scores = [-1, 0, 1].map((j) => {
    const l = j * s * 0.17 + rand(-0.02, 0.02) * s;
    return { a: along(f, p, -s * 0.36, l), b: along(f, p, s * 0.36, l + rand(-0.04, 0.04) * s) };
  });
  const D = 0.45, CUT = 0.09;
  t.draw(D, (g, v) => {
    const time = v * D, q = easeOut(clamp01(time / CUT)), a = 1 - clamp01((time - 0.2) / 0.25);
    for (const sc2 of scores) {
      const e = { x: sc2.a.x + (sc2.b.x - sc2.a.x) * q, y: sc2.a.y + (sc2.b.y - sc2.a.y) * q };
      g.moveTo(sc2.a.x, sc2.a.y).lineTo(e.x, e.y);
    }
    g.stroke({ width: s * 0.05, color: TREAD, alpha: 0.75 * a, cap: "round" });
  }, { dark: true });
  t.draw(D, (g, v) => {
    const time = v * D, q = easeOut(clamp01(time / CUT)), a = 1 - clamp01((time - 0.2) / 0.25), hot = 1 - clamp01((time - CUT) / 0.2);
    for (const sc2 of scores) {
      const e = { x: sc2.a.x + (sc2.b.x - sc2.a.x) * q, y: sc2.a.y + (sc2.b.y - sc2.a.y) * q };
      g.moveTo(sc2.a.x, sc2.a.y).lineTo(e.x, e.y);
    }
    g.stroke({ width: Math.max(1.2, s * 0.018), color: hot > 0.3 ? CORE : FURNACE, alpha: 0.95 * a, cap: "round" });
  });
  if (killed) {
    // Ground down to slag: a heap of embers left glowing where it stood.
    for (let i = 0; i < Math.round(10 * t.quality); i++)
      t.spark(p.x + rand(-0.35, 0.35) * s, p.y + rand(-0.1, 0.35) * s, rand(-25, 25) * sc, -rand(50, 110) * sc, rand(0.5, 0.8), FOUNT);
    t.glow(r, EMBER_RED, 0.35, 0.7, 1.1);
  }
}
