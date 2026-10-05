/** JACK ARC — StunGun. "Blast 3 targets for 4 DMG and PARALYZE them for 3
 *  rounds." Every round one enemy stops working, and he files it as routine.
 *
 *  His art is Arc Industries' field engineer: a purple afro, black armour, a
 *  glowing RED core in his chest and a heavy violet-and-red stun rifle. He is
 *  not a storm and not a sorcerer; he is a man with a tool. So the DELIVERY
 *  is the tool warming up: the chest core spins up — a red rotor turning
 *  faster and brighter — and the rifle comes level, red-violet charge pooling
 *  at its muzzle with current crawling down the barrel.
 *
 *  The LANDING is a TASER. Three barbed darts, small and red-tipped, fire one
 *  after another from the muzzle, each paying out a thin WIRE behind it that
 *  whips as it flies. Once a dart bites, current runs down its wire — beads
 *  of red-violet charge pulsing from the rifle to the card, the core flaring
 *  with each one — and the card JOLTS: its outline shudders and short violet
 *  arcs snap over it. Then the current cuts, the wires drop slack and fade.
 *
 *  Kept apart from Stormcaller's gold chain on purpose: nothing here leaps.
 *  The wires are the one soft curve in BOLT — they hang, they whip, they
 *  sag — and the charge travels ALONG them, in beads, at a speed you can see.
 *  The rifle is a dark shape, drawn dark for real (`dark: true`) and lit along
 *  its edges. */
import { centre, rand } from "../../looks/base";
import type { Graphics } from "pixi.js";
import type { FxTools, Pt, SparkStyle } from "../../looks/types";
import type { Signature, SigMoment } from "../types";

type Box = SigMoment["from"];

const TAU = Math.PI * 2;
/** His core and the dart tips: white-hot, pale red, red. */
const WHITE = 0xffffff, RED_HI = 0xff9aa4, RED = 0xff2f4a;
/** The current he runs: red-violet, magenta, violet (BOLT's own). */
const ROSE = 0xff5aa8, MAG = 0xd04cff, VIO = 0x9575ff, LAV = 0xe3d8ff;
/** The wire: pale steel, light enough to read on the board. */
const STEEL = 0xd8d2e6;
/** The rifle's black chrome. Dark layer only. */
const CHROME = 0x0c0a12;
/** One flicker beat, s (looks/bolt.ts). */
const BEAT = 0.035;

/** Static off a jolted card: darts out and stops dead. */
const SNAP: SparkStyle = { palette: [WHITE, LAV, VIO], gravity: 0, drag: 0.0008, size: [5, 1.2], streak: true };
/** Red-violet charge drawn into the muzzle. */
const INTAKE: SparkStyle = { palette: [MAG, ROSE, RED_HI], gravity: 0, drag: 1, size: [2, 4], streak: false };
/** Hot bits off a dart biting in. */
const BITE: SparkStyle = { palette: [WHITE, RED_HI, RED], gravity: 300, drag: 0.4, size: [4, 1], streak: true };

/** The beat between darts, a dart's flight, how long the current runs down a
 *  wire, and the wire going slack after. */
const GAP = 0.09, FLY = 0.08, PULSE = 0.4, SLACK = 0.3;
/** One bead of charge's run down a wire, s, and the gap between beads. */
const RUNS = 0.13, EVERY = 0.07;

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeOut = (x: number) => 1 - (1 - x) * (1 - x);

/** A lightning channel from a to b, pinned at both ends — for the jolt. */
function channel(ax: number, ay: number, bx: number, by: number, segs: number, jag: number): number[] {
  const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len;
  const out = [ax, ay];
  let off = 0;
  for (let i = 1; i < segs; i++) {
    off = off * 0.5 + rand(-1, 1);
    const f = (i + rand(-0.3, 0.3)) / segs, o = off * jag * Math.sqrt(Math.sin((Math.PI * i) / segs));
    out.push(ax + dx * f + nx * o, ay + dy * f + ny * o);
  }
  out.push(bx, by);
  return out;
}

/** Lightning stroked: a violet halo, then a thin hot core. */
function zap(g: Graphics, paths: number[][], width: number, alpha: number) {
  if (alpha <= 0.02 || paths.length === 0) return;
  const a = Math.min(1, alpha);
  const tr = () => { for (const p of paths) { g.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) g.lineTo(p[i], p[i + 1]); } };
  tr();
  g.stroke({ width: width * 4, color: VIO, alpha: 0.3 * a, join: "round", cap: "round" });
  tr();
  g.stroke({ width, color: WHITE, alpha: a, join: "bevel", cap: "round" });
}

/** A hard flash sized to the squares, in and gone in a blink. */
function blink(t: FxTools, p: Pt, size: number, color: number, peak: number, seconds: number) {
  t.glow({ x: p.x - size / 2, y: p.y - size / 2, w: size, h: size }, color, peak, seconds, 1);
}

// ── The rifle and the core ──────────────────────────────────────────────────

/** Where he aims: at the darts' targets as a whole, the muzzle out at the
 *  front of his card that way, and the core in his chest. */
function aim(m: SigMoment) {
  const c = centre(m.from), s = m.size;
  let ax = 0, ay = 0;
  for (const r of m.targets) {
    const p = centre(r), d = Math.hypot(p.x - c.x, p.y - c.y) || 1;
    ax += (p.x - c.x) / d;
    ay += (p.y - c.y) / d;
  }
  const ang = Math.hypot(ax, ay) > 0.3 ? Math.atan2(ay, ax) : Math.atan2(m.ahead.y, m.ahead.x);
  const ux = Math.cos(ang), uy = Math.sin(ang);
  // Carried low across his body, off to one side of the core.
  const nx = -uy, ny = ux, off = s * 0.12;
  const grip = { x: c.x + nx * off, y: c.y + ny * off };
  const muzzle = { x: grip.x + ux * s * 0.6, y: grip.y + uy * s * 0.6 };
  const core = { x: c.x - nx * off * 0.6, y: c.y - ny * off * 0.6 - s * 0.06 };
  return { c, s, ang, ux, uy, nx, ny, grip, muzzle, core };
}

/** The stun rifle: a heavy barrel from his grip to the muzzle, a boxy body
 *  with the cell under it, a stock behind — pulled back by `kick` px. Flat
 *  points for the caller to fill and rim. */
function rifle(A: ReturnType<typeof aim>, kick: number): number[][] {
  const { s, ux, uy, nx, ny } = A;
  const g = { x: A.grip.x - ux * kick, y: A.grip.y - uy * kick };
  const P = (a: number, b: number) => [g.x + ux * a * s + nx * b * s, g.y + uy * a * s + ny * b * s];
  const barrel = [...P(0.08, -0.055), ...P(0.54, -0.055), ...P(0.6, -0.035), ...P(0.6, 0.035), ...P(0.54, 0.055), ...P(0.08, 0.055)];
  const body = [...P(-0.16, -0.09), ...P(0.18, -0.09), ...P(0.2, 0.06), ...P(0.08, 0.14), ...P(-0.04, 0.14), ...P(-0.16, 0.08)];
  const stock = [...P(-0.16, -0.06), ...P(-0.36, -0.04), ...P(-0.38, 0.09), ...P(-0.16, 0.06)];
  return [barrel, body, stock];
}

/** The rifle drawn for `D` s: black chrome on the dark layer, rimmed in
 *  red-violet, a charge strip glowing down the barrel (`glow` 0..1 by time),
 *  `kick` px of recoil by time, fading in and out at the ends. */
function drawRifle(t: FxTools, A: ReturnType<typeof aim>, D: number, inA: number, outA: number,
  glow: (time: number) => number, kick: (time: number) => number) {
  const fade = (time: number) => clamp01(inA ? time / inA : 1) * (1 - clamp01((time - (D - outA)) / outA));
  t.draw(D, (g, u) => {
    const time = u * D, a = fade(time);
    for (const pts of rifle(A, kick(time))) g.poly(pts, true).fill({ color: CHROME, alpha: 0.88 * a });
  }, { dark: true });
  t.draw(D, (g, u) => {
    const time = u * D, a = fade(time), k = kick(time), gl = glow(time);
    for (const pts of rifle(A, k)) g.poly(pts, true).stroke({ width: 1.6, color: ROSE, alpha: 0.85 * a, join: "round" });
    const { s, ux, uy } = A, x0 = A.grip.x - ux * k, y0 = A.grip.y - uy * k;
    g.moveTo(x0 + ux * s * 0.1, y0 + uy * s * 0.1).lineTo(x0 + ux * s * 0.56, y0 + uy * s * 0.56)
      .stroke({ width: Math.max(3, s * 0.06), color: MAG, alpha: 0.35 * gl * a, cap: "round" })
      .moveTo(x0 + ux * s * 0.1, y0 + uy * s * 0.1).lineTo(x0 + ux * s * 0.56, y0 + uy * s * 0.56)
      .stroke({ width: 1.8, color: RED_HI, alpha: 0.9 * gl * a, cap: "round" });
  });
}

/** THE CORE in his chest: a red rotor — six vanes round a white-hot hub —
 *  turning at `spin(time)` radians, lit `lit(time)`. */
function drawCore(t: FxTools, p: Pt, s: number, D: number, spin: (time: number) => number, lit: (time: number) => number, delay = 0) {
  const R = s * 0.13;
  t.draw(D, (g, u) => {
    const time = u * D, a = lit(time), rot = spin(time);
    if (a <= 0.02) return;
    g.circle(p.x, p.y, R * 1.9).fill({ color: RED, alpha: 0.18 * a });
    g.circle(p.x, p.y, R).stroke({ width: 2, color: RED, alpha: 0.9 * a });
    for (let i = 0; i < 6; i++) {
      const q = rot + (i * TAU) / 6;
      g.moveTo(p.x + Math.cos(q) * R * 0.35, p.y + Math.sin(q) * R * 0.35)
        .lineTo(p.x + Math.cos(q + 0.5) * R * 0.92, p.y + Math.sin(q + 0.5) * R * 0.92);
    }
    g.stroke({ width: 1.6, color: RED_HI, alpha: 0.9 * a, cap: "round" });
    g.circle(p.x, p.y, R * 0.3).fill({ color: WHITE, alpha: a });
  }, { delay });
}

// ── A dart and its wire ─────────────────────────────────────────────────────

/** The wire from the muzzle `a` to the dart's tail `b`, as a curve: bowed
 *  down the screen by `sag` (it hangs) and across the line by `whip` (it
 *  snakes as it pays out). The point `f` of the way along, into `out`. */
function wireAt(a: Pt, b: Pt, sag: number, whip: number, f: number, out: Pt): Pt {
  const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, nx = -dy / d, ny = dx / d;
  const bow = 4 * f * (1 - f);
  const w = whip * Math.sin(f * TAU * 1.5) * f;
  out.x = a.x + dx * f + nx * w;
  out.y = a.y + dy * f + ny * w + sag * bow;
  return out;
}

/** The dart: a slim shaft with a red-tipped point and two barbs back off it,
 *  little fins at the tail. Drawn with its tip at `p`, pointing along `ang`. */
function dart(g: Graphics, p: Pt, ang: number, L: number, a: number) {
  if (a <= 0.02) return;
  const ux = Math.cos(ang), uy = Math.sin(ang), nx = -uy, ny = ux;
  const tail = { x: p.x - ux * L, y: p.y - uy * L }, neck = { x: p.x - ux * L * 0.3, y: p.y - uy * L * 0.3 };
  g.moveTo(tail.x, tail.y).lineTo(neck.x, neck.y).stroke({ width: Math.max(2, L * 0.13), color: STEEL, alpha: a, cap: "round" });
  g.circle(p.x - ux * L * 0.15, p.y - uy * L * 0.15, L * 0.3).fill({ color: RED, alpha: 0.22 * a });
  const w = L * 0.19;
  g.poly([p.x, p.y, neck.x + nx * w, neck.y + ny * w, neck.x - nx * w, neck.y - ny * w], true).fill({ color: RED, alpha: a });
  // The barbs: hooked back off the point, why it does not come out.
  for (const sd of [-1, 1])
    g.moveTo(neck.x + ux * L * 0.12, neck.y + uy * L * 0.12).lineTo(neck.x - ux * L * 0.12 + nx * w * 1.7 * sd, neck.y - uy * L * 0.12 + ny * w * 1.7 * sd);
  g.stroke({ width: 1.5, color: RED_HI, alpha: a });
  for (const sd of [-1, 1])
    g.moveTo(tail.x + ux * L * 0.2, tail.y + uy * L * 0.2).lineTo(tail.x - ux * L * 0.05 + nx * w * 1.4 * sd, tail.y - uy * L * 0.05 + ny * w * 1.4 * sd);
  g.stroke({ width: 1.2, color: STEEL, alpha: 0.85 * a });
  g.circle(p.x, p.y, Math.max(1.2, L * 0.07)).fill({ color: WHITE, alpha: a });
}

/** The card JOLTING while current runs into it: its outline shuddering a
 *  pixel or two each beat, short violet arcs snapping over its rim. */
function jolt(t: FxTools, r: Box, s: number, D: number, delay: number) {
  const c = centre(r), half = Math.min(r.w, r.h) * 0.46;
  let arcs: number[][] = [], beat = -1, jx = 0, jy = 0;
  t.draw(D, (g, u) => {
    const time = u * D, bt = Math.floor(time / BEAT);
    if (bt !== beat) {
      beat = bt;
      const j = s * 0.035;
      jx = rand(-j, j);
      jy = rand(-j, j);
      arcs = [];
      for (let i = 0; i < 3; i++) {
        const side = Math.floor(rand(0, 4)), f = rand(-half, half);
        const x = c.x + (side < 2 ? f : side === 2 ? -half : half), y = c.y + (side < 2 ? (side === 0 ? -half : half) : f);
        const a = Math.atan2(y - c.y, x - c.x) + rand(-0.8, 0.8), l = s * rand(0.12, 0.22);
        arcs.push(channel(x, y, x + Math.cos(a) * l, y + Math.sin(a) * l, 3, l * 0.35));
      }
    }
    const a = (bt % 3 === 2 ? 0.45 : 1) * (1 - 0.6 * u);
    g.rect(r.x + jx, r.y + jy, r.w, r.h).stroke({ width: 4, color: MAG, alpha: 0.3 * a }).stroke({ width: 1.5, color: ROSE, alpha: 0.85 * a });
    zap(g, arcs, 1.5, a * 1.1);
  }, { delay });
}

/** ONE DART: fired from `m0` at the card, the wire paying out behind it and
 *  whipping; it bites in near the card's centre at a slant; the current runs
 *  down the wire in beads and jolts the card; then the wire sags slack and
 *  fades. The dart, wire and beads are one hand-drawn piece. */
function shoot(t: FxTools, A: ReturnType<typeof aim>, r: Box, power: number, killed: boolean, delay: number) {
  const s = A.s, m0 = A.muzzle, p = centre(r), k = Math.max(0.8, Math.min(1.3, power));
  const dx = p.x - m0.x, dy = p.y - m0.y, d = Math.hypot(dx, dy) || 1;
  const ang = Math.atan2(dy, dx) + rand(-0.15, 0.15);
  // Where it bites: short of the centre, on the side facing him.
  const tip = { x: p.x - (dx / d) * s * 0.08, y: p.y - (dy / d) * s * 0.08 };
  const L = s * 0.32;
  const D = FLY + PULSE + SLACK;
  const q: Pt = { x: 0, y: 0 }, whipSide = Math.random() < 0.5 ? -1 : 1;
  t.draw(D, (g, u) => {
    const time = u * D;
    const f = clamp01(time / FLY);
    const head = { x: m0.x + (tip.x - m0.x) * f, y: m0.y + (tip.y - m0.y) * f };
    const tail = { x: head.x - Math.cos(ang) * L, y: head.y - Math.sin(ang) * L };
    const live = time >= FLY && time < FLY + PULSE;
    const slack = clamp01((time - FLY - PULSE) / SLACK);
    const fade = 1 - slack;
    // The wire: snaking out as it pays out, nearly taut when in, and hanging
    // lower and lower once the current is cut.
    const whip = time < FLY ? whipSide * s * 0.1 * (1 - f) : whipSide * s * 0.03 * Math.max(0, 1 - (time - FLY) / 0.12);
    const sag = s * (0.05 + 0.03 * f) + s * 0.45 * easeOut(slack);
    const N = 14;
    for (let i = 0; i <= N; i++) {
      wireAt(m0, tail, sag, whip, i / N, q);
      if (i === 0) g.moveTo(q.x, q.y);
      else g.lineTo(q.x, q.y);
    }
    if (live) {
      g.stroke({ width: 6, color: MAG, alpha: 0.3, join: "round", cap: "round" });
      for (let i = 0; i <= N; i++) {
        wireAt(m0, tail, sag, whip, i / N, q);
        if (i === 0) g.moveTo(q.x, q.y);
        else g.lineTo(q.x, q.y);
      }
    }
    g.stroke({ width: live ? 1.8 : 1.3, color: live ? ROSE : STEEL, alpha: 0.9 * fade, join: "round", cap: "round" });
    // The dart: flying, then stuck at its slant, dropping out with the wire.
    dart(g, head, ang, L * (0.9 + 0.15 * k), fade);
    // THE CURRENT: beads of red-violet charge running down the wire, one
    // after another, for as long as the trigger is held.
    if (live) {
      const since = time - FLY;
      for (let n = 0; n * EVERY <= since; n++) {
        const bf = (since - n * EVERY) / RUNS;
        if (bf >= 1 || n * EVERY > PULSE - RUNS) continue;
        wireAt(m0, tail, sag, whip, bf, q);
        g.circle(q.x, q.y, Math.max(4, s * 0.09)).fill({ color: MAG, alpha: 0.35 });
        g.circle(q.x, q.y, Math.max(2.5, s * 0.05)).fill({ color: ROSE, alpha: 0.95 });
        g.circle(q.x, q.y, Math.max(1.2, s * 0.022)).fill({ color: WHITE, alpha: 1 });
      }
    }
  }, { delay });

  // The shot leaving: a red-violet flash at the muzzle.
  t.later(delay, () => blink(t, m0, s * 0.6, ROSE, 0.5, 0.1));
  // The bite: a red prick of light and hot bits off it.
  const hit = delay + FLY;
  t.later(hit, () => {
    blink(t, tip, s * 0.75, RED, 0.45 * k, 0.12);
    const v = s / 90;
    for (let i = 0; i < Math.round(6 * k); i++) {
      const a = ang + Math.PI + rand(-0.9, 0.9), sp = rand(120, 240) * v;
      t.spark(tip.x, tip.y, Math.cos(a) * sp, Math.sin(a) * sp, rand(0.15, 0.3), BITE);
    }
  });
  // Each bead arriving: the card jolts harder, static snapping off it.
  jolt(t, r, s, PULSE, hit + RUNS * 0.8);
  for (let n = 0; n * EVERY <= PULSE - RUNS; n++) {
    t.later(hit + n * EVERY + RUNS, () => {
      blink(t, p, s * 0.95, n % 2 ? MAG : ROSE, 0.25 * k, 0.07);
      const v = s / 90;
      for (let i = 0; i < 3; i++) {
        const a = rand(0, TAU), sp = rand(120, 240) * v;
        t.spark(p.x + Math.cos(a) * s * 0.3, p.y + Math.sin(a) * s * 0.3, Math.cos(a) * sp, Math.sin(a) * sp, rand(0.08, 0.16), SNAP);
      }
    });
  }
  if (killed) {
    // A card that does not get up: one last surge, and it goes out.
    t.later(hit + PULSE * 0.7, () => {
      blink(t, p, s * 1.25, MAG, 0.5, 0.25);
      t.ring(r, ROSE, 0.3, 1.2, 0.3, 3);
    });
  }
}

/** The darts in firing order: nearest first. */
function order(m: SigMoment): number[] {
  const c = centre(m.from);
  const d = (i: number) => { const p = centre(m.targets[i]); return Math.hypot(p.x - c.x, p.y - c.y); };
  return m.targets.map((_, i) => i).sort((a, b) => d(a) - d(b));
}

export const JACK_ARC: Signature = {
  shake: 0.6,
  // He holds his ground and shoots.
  lunge: false,

  deliver(t: FxTools, m: SigMoment, seconds: number) {
    const A = aim(m), { s, ang } = A, T = seconds, v = s / 90;
    // THE CORE spinning up: faster and brighter all the way to the trigger.
    drawCore(t, A.core, s, T, (time) => 30 * (time / T) * (time / T) * T, (time) => 0.35 + 0.65 * clamp01(time / T));
    t.charge(A.core, s * 0.7, RED, 0.45, T);
    // THE RIFLE coming level, its charge strip filling.
    drawRifle(t, A, T, 0.08, 0, (time) => clamp01((time - T * 0.25) / (T * 0.6)), () => 0);
    // Charge pooling at the muzzle, red-violet drawn into it.
    t.charge(A.muzzle, s * 0.55, MAG, 0.45, T);
    for (let i = 0; i < Math.round(10 * t.quality); i++) {
      const life = rand(0.12, 0.2), at = rand(0.35, 0.95) * T - life, th = rand(0, TAU), dd = s * rand(0.18, 0.3);
      const sx = A.muzzle.x + Math.cos(th) * dd, sy = A.muzzle.y + Math.sin(th) * dd;
      t.later(Math.max(0, at), () => t.spark(sx, sy, (A.muzzle.x - sx) / life, (A.muzzle.y - sy) / life, life, INTAKE));
    }
    // Current crawling down the barrel as it charges: short arcs off it.
    let arcs: number[][] = [], beat = -1;
    t.draw(T * 0.55, (g, u) => {
      const bt = Math.floor((u * T * 0.55) / BEAT);
      if (bt !== beat) {
        beat = bt;
        arcs = [];
        const f = rand(0.25, 0.9), x = A.grip.x + A.ux * s * 0.5 * f, y = A.grip.y + A.uy * s * 0.5 * f;
        const a = ang + (Math.random() < 0.5 ? -1 : 1) * rand(1.1, 2), l = s * rand(0.08, 0.16);
        arcs.push(channel(x, y, x + Math.cos(a) * l, y + Math.sin(a) * l, 3, l * 0.35));
      }
      zap(g, arcs, 1.1, rand(0.5, 1));
    }, { delay: T * 0.45 });
    t.later(T * 0.45, () => {
      for (let i = 0; i < 4; i++) {
        const a = rand(0, TAU), sp = rand(80, 160) * v;
        t.spark(A.muzzle.x, A.muzzle.y, Math.cos(a) * sp, Math.sin(a) * sp, rand(0.1, 0.18), SNAP);
      }
    });
  },

  land(t: FxTools, m: SigMoment) {
    const A = aim(m), s = A.s;
    const ids = order(m), n = ids.length;
    const end = (n - 1) * GAP + FLY + PULSE;
    // The rifle stays up while he holds the trigger, kicking with each dart.
    const kick = (time: number) => {
      let k = 0;
      for (let i = 0; i < n; i++) {
        const since = time - i * GAP;
        if (since >= 0 && since < 0.08) k = Math.max(k, s * 0.07 * (1 - since / 0.08));
      }
      return k;
    };
    drawRifle(t, A, end + 0.15, 0, 0.15, (time) => (time < end ? 0.75 + 0.25 * Math.sin(time * 60) : 0.3), kick);
    // The core throbbing with every bead of current it sends.
    drawCore(t, A.core, s, end + 0.15, (time) => 30 * 0.6 + 40 * time, (time) => (time < end ? 0.75 + 0.25 * Math.sin(time * TAU / EVERY) : 1 - (time - end) / 0.15));
    ids.forEach((i, k) => shoot(t, A, m.targets[i], m.power[i] ?? 1, m.killed[i] ?? false, k * GAP));
  },
};
