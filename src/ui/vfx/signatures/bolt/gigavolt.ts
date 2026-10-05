/** GIGAVOLT — Turret Mode. "ELECTRIFY all opponents, then deal 3 DMG to every
 *  Electrified opponent now and at the end of each round for 3 rounds." It
 *  arrives with no weapon and no legs, and then it stops being a robot and
 *  becomes a fortress.
 *
 *  Its art is a giant mech-fortress chained to the street, no legs, a violet
 *  reactor core blazing in its chest, red sensor eyes, and heavy cannon arms
 *  flaring gold-orange muzzle fire. The Special aims at itself, so the
 *  DELIVERY may not run: when it does, it is only the reactor spinning up and
 *  the sensors coming on. The LANDING is the whole move, and it is military:
 *
 *  LOCK DOWN. Four anchor clamps slam out to the card's corners and bite, and
 *  chains shoot out from them to pegs driven into the board; the reactor core
 *  flares; four turret barrels swing out from its flanks (dark steel, lit
 *  rims). SCAN. A radar sweep, a violet scan line with a fading wake, turns
 *  once round the fortress over the whole board, and as it passes each
 *  opponent a target-lock reticle snaps onto it (red brackets closing in, a
 *  ping, static crawling on the card: ELECTRIFIED). FIRE. One volley: each
 *  barrel kicks with a gold-orange muzzle flash and a fast violet tracer bolt
 *  cracks to its locked target; the hit bursts in violet and the reticle
 *  blows out.
 *
 *  Clamps, scan, lock, fire: machine timing, hard stops and snaps. Only the
 *  tracers and the electrify are lightning, and they keep looks/bolt.ts's
 *  kinked lines and stutter. The muzzle fire is gold, as on its art. */
import { centre, rand } from "../../looks/base";
import type { Graphics } from "pixi.js";
import type { FxTools, Pt, SparkStyle } from "../../looks/types";
import type { Signature, SigMoment } from "../types";

type Box = SigMoment["from"];

const TAU = Math.PI * 2;
// Lightning and the reactor: white-hot to lavender to violet.
const WHITE = 0xffffff, LAV = 0xe3d8ff, VIO = 0x9575ff;
// Muzzle fire, from the art: white-hot to gold to orange.
const FIRE_HI = 0xfff0b8, GOLD = 0xffc040, ORANGE = 0xff8a20;
// Its sensors, and the lock.
const RED = 0xff3a4c, RED_HI = 0xffb0b8;
// Steel: dark layer only.
const STEEL = 0x08070e;
/** One flicker beat, s, and a struck channel's brightness beat by beat. */
const BEAT = 0.035;
const FLICKER = [1, 0.35, 1, 0.8, 0.3, 0.95, 0.55, 0.2, 0.75, 0.4, 0.15, 0.55];
/** Static: darts out hard and stops dead. */
const SNAP: SparkStyle = { palette: [WHITE, LAV, VIO], gravity: 0, drag: 0.0008, size: [6, 1.5], streak: true };
/** Sparks off the clamps biting and the muzzles: hot metal, falling. */
const METAL: SparkStyle = { palette: [WHITE, FIRE_HI, GOLD, ORANGE], gravity: 420, drag: 0.5, size: [4, 1.2], streak: true };

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeOut = (x: number) => 1 - (1 - x) * (1 - x);
const easeIn = (x: number) => x * x;
/** 0 -> 1 as `x` runs from `a` to `b`. */
const span = (x: number, a: number, b: number) => clamp01((x - a) / (b - a));

/** The landing's beats, s: the clamps bite; the radar turns once from SCAN
 *  for SWEEP; the volley opens at FIRE, a shot every GAP; all gone by END. */
const BITE = 0.11, SCAN = 0.16, SWEEP = 0.36, FIRE = 0.6, GAP = 0.045, FLY = 0.08, END = 1.1;

// ── Lightning ────────────────────────────────────────────────────────────────

/** How lit a strike is `since` s after it lands, lasting `dur`. */
function flicker(since: number, dur: number): number {
  if (since < 0 || since >= dur) return 0;
  return FLICKER[Math.floor(since / BEAT) % FLICKER.length] * Math.sqrt(1 - since / dur);
}

/** A lightning channel from a to b, pinned at both ends: `segs` uneven steps,
 *  kinked up to `jag` px across by a walk. */
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

/** Lightning stroked: a wide violet halo, then a thin white-hot core. */
function zap(g: Graphics, paths: number[][], width: number, alpha: number) {
  if (alpha <= 0.02 || paths.length === 0) return;
  const a = Math.min(1, alpha);
  const trace = () => {
    for (const p of paths) {
      g.moveTo(p[0], p[1]);
      for (let i = 2; i < p.length; i += 2) g.lineTo(p[i], p[i + 1]);
    }
  };
  trace();
  g.stroke({ width: width * 4, color: VIO, alpha: 0.3 * a, join: "round", cap: "round" });
  trace();
  g.stroke({ width, color: WHITE, alpha: a, join: "bevel", cap: "round" });
}

/** A flash sized to the board's squares (`flash` is sized in px). */
function flare(t: FxTools, p: Pt, size: number, color: number, peak: number, seconds: number) {
  t.glow({ x: p.x - size / 2, y: p.y - size / 2, w: size, h: size }, color, peak, seconds, 1);
}

// ── The fortress ────────────────────────────────────────────────────────────

type Plan = ReturnType<typeof plan>;

/** Everything the move is laid out by: the fortress's frame (ahead and
 *  across), its core and sensors, its four barrel mounts, and the targets in
 *  the order the radar finds them, each with its lock time, the barrel that
 *  takes it and when that barrel fires. */
function plan(m: SigMoment) {
  const c = centre(m.from), s = m.size;
  const ux = m.ahead.x, uy = m.ahead.y, nx = -uy, ny = ux;
  const P = (a: number, b: number): Pt => ({ x: c.x + ux * a * s + nx * b * s, y: c.y + uy * a * s + ny * b * s });
  const core = P(-0.02, 0);
  const eyes = [P(0.26, -0.08), P(0.26, 0.08)];
  // Two cannon arms a side: shoulders forward, hips back.
  const mounts = [P(0.14, -0.36), P(0.14, 0.36), P(-0.16, -0.38), P(-0.16, 0.38)];
  // The sweep starts behind its left shoulder and turns clockwise on screen,
  // so what is ahead of it is found in the middle of the turn.
  const a0 = Math.atan2(uy, ux) - Math.PI * 0.75;
  let reach = s * 1.4;
  const found = m.targets.map((r, i) => {
    const p = centre(r), d = Math.hypot(p.x - c.x, p.y - c.y);
    reach = Math.max(reach, d + s * 0.6);
    const rel = ((Math.atan2(p.y - c.y, p.x - c.x) - a0) % TAU + TAU) % TAU;
    return { r, p, d, lock: SCAN + (rel / TAU) * SWEEP, power: Math.max(0.55, Math.min(2, m.power[i] ?? 1)), killed: m.killed[i] ?? false, barrel: 0, fire: 0 };
  });
  // The volley goes in the order the targets were locked; each shot from the
  // barrel on that target's side, the arms taking turns.
  const order = found.slice().sort((a, b) => a.lock - b.lock);
  const used = [0, 0, 0, 0];
  order.forEach((f, k) => {
    const side = (f.p.x - c.x) * nx + (f.p.y - c.y) * ny < 0 ? 0 : 1;
    const pair = [side, side + 2];
    f.barrel = used[pair[0]] <= used[pair[1]] ? pair[0] : pair[1];
    used[f.barrel]++;
    f.fire = FIRE + k * GAP;
  });
  return { c, s, ux, uy, nx, ny, P, core, eyes, mounts, a0, reach, found: order };
}

/** Where barrel `i` points at `time`: folded back along the flank until the
 *  lock-down, then swung onto the first target it has to fire at, and on to
 *  the next once it has fired. */
function barrelAim(A: Plan, i: number, time: number): number {
  const folded = Math.atan2(-A.uy, -A.ux) + (i % 2 ? 0.5 : -0.5);
  const mine = A.found.filter((f) => f.barrel === i);
  const m0 = A.mounts[i];
  const toward = (p: Pt) => Math.atan2(p.y - m0.y, p.x - m0.x);
  // An idle arm still comes round to face the enemy.
  const first = mine.length ? toward(mine[0].p) : Math.atan2(A.uy, A.ux) + (i % 2 ? 0.35 : -0.35);
  const turn = (a: number, b: number, k: number) => {
    let d = b - a;
    while (d > Math.PI) d -= TAU;
    while (d < -Math.PI) d += TAU;
    return a + d * k;
  };
  let ang = turn(folded, first, easeOut(span(time, BITE, BITE + 0.2)));
  for (let k = 1; k < mine.length; k++) ang = turn(ang, toward(mine[k].p), easeOut(span(time, mine[k - 1].fire + 0.02, mine[k].fire - 0.005)));
  return ang;
}

/** How far barrel `i` is kicked back at `time` (recoil, px fraction of s). */
function recoil(A: Plan, i: number, time: number): number {
  let k = 0;
  for (const f of A.found) if (f.barrel === i) {
    const q = (time - f.fire) / 0.12;
    if (q >= 0 && q < 1) k = Math.max(k, q < 0.2 ? q / 0.2 : 1 - (q - 0.2) / 0.8);
  }
  return k * 0.07;
}

/** A barrel as a flat outline: a heavy breech at the mount and a long
 *  barrel out along `ang`, with a muzzle collar. */
function barrel(m0: Pt, ang: number, s: number, kick: number): number[] {
  const ux = Math.cos(ang), uy = Math.sin(ang), nx = -uy, ny = ux;
  const P = (a: number, b: number) => [m0.x + ux * (a - kick) * s + nx * b * s, m0.y + uy * (a - kick) * s + ny * b * s];
  return [...P(-0.08, -0.07), ...P(0.06, -0.07), ...P(0.08, -0.04), ...P(0.44, -0.04), ...P(0.44, -0.058), ...P(0.52, -0.058),
    ...P(0.52, 0.058), ...P(0.44, 0.058), ...P(0.44, 0.04), ...P(0.08, 0.04), ...P(0.06, 0.07), ...P(-0.08, 0.07)];
}

/** A muzzle at `time`: the end of barrel `i`. */
function muzzle(A: Plan, i: number, time: number): Pt {
  const m0 = A.mounts[i], ang = barrelAim(A, i, time), k = recoil(A, i, time);
  return { x: m0.x + Math.cos(ang) * (0.54 - k) * A.s, y: m0.y + Math.sin(ang) * (0.54 - k) * A.s };
}

/** An anchor clamp: an L-bracket gripping corner `k` of a card at `c`, its
 *  arms along the card's edges. `out` 0 is tucked in at the centre, 1 at the
 *  corner. */
function clampShape(c: Pt, s: number, k: number, out: number): number[] {
  const sx = k === 0 || k === 3 ? -1 : 1, sy = k < 2 ? -1 : 1, e = s * 0.44 * (0.3 + 0.7 * out);
  const x = c.x + sx * e, y = c.y + sy * e, L = s * 0.17, W = s * 0.055;
  return [x, y, x - sx * L, y, x - sx * L, y - sy * W, x - sx * W, y - sy * W, x - sx * W, y - sy * L, x, y - sy * L];
}

/** The chain out of corner `k` to its peg: `n` links, laid out to fraction
 *  `f` of its length. Each link an outline of a stretched ring. */
function chainLinks(c: Pt, s: number, k: number, f: number): Array<{ x: number; y: number; ang: number; side: boolean }> {
  const sx = k === 0 || k === 3 ? -1 : 1, sy = k < 2 ? -1 : 1;
  const x0 = c.x + sx * s * 0.44, y0 = c.y + sy * s * 0.44, ang = Math.atan2(sy, sx), L = s * 0.36 * f, n = 4;
  const out = [];
  for (let i = 0; i < n; i++) {
    const d = ((i + 0.5) / n) * s * 0.36;
    if (d > L) break;
    out.push({ x: x0 + Math.cos(ang) * d, y: y0 + Math.sin(ang) * d, ang, side: i % 2 === 1 });
  }
  return out;
}

/** A link's outline: flat-on it is a stretched ring, edge-on a bar. */
function link(g: Graphics, l: { x: number; y: number; ang: number; side: boolean }, s: number) {
  const ux = Math.cos(l.ang), uy = Math.sin(l.ang), nx = -uy, ny = ux, a = s * 0.05, b = l.side ? s * 0.012 : s * 0.03;
  const pts: number[] = [];
  for (let i = 0; i < 10; i++) {
    const q = (i / 10) * TAU;
    pts.push(l.x + ux * Math.cos(q) * a + nx * Math.sin(q) * b, l.y + uy * Math.cos(q) * a + ny * Math.sin(q) * b);
  }
  return g.poly(pts, true);
}

/** The radar: a scan line turning once round the fortress from `a0`, a
 *  fading wake behind it and a range ring, all out to `reach`. */
function radar(t: FxTools, A: Plan) {
  const D = SWEEP + 0.12, R = A.reach;
  t.draw(D, (g, u) => {
    const time = u * D, q = clamp01(time / SWEEP), ang = A.a0 + q * TAU, fade = 1 - span(time, SWEEP - 0.04, D);
    if (fade <= 0.01) return;
    // The wake: a fan of thin wedges behind the line, dimmer the older.
    const wake = 0.9, n = 8;
    for (let i = 0; i < n; i++) {
      const b0 = ang - (wake * i) / n, b1 = ang - (wake * (i + 1)) / n;
      if (q * TAU < (wake * i) / n) break;
      g.poly([A.c.x, A.c.y, A.c.x + Math.cos(b0) * R, A.c.y + Math.sin(b0) * R, A.c.x + Math.cos(b1) * R, A.c.y + Math.sin(b1) * R], true)
        .fill({ color: VIO, alpha: 0.22 * (1 - i / n) * fade });
    }
    g.moveTo(A.c.x, A.c.y).lineTo(A.c.x + Math.cos(ang) * R, A.c.y + Math.sin(ang) * R)
      .stroke({ width: 6, color: VIO, alpha: 0.3 * fade }).moveTo(A.c.x, A.c.y).lineTo(A.c.x + Math.cos(ang) * R, A.c.y + Math.sin(ang) * R)
      .stroke({ width: 1.8, color: LAV, alpha: 0.95 * fade });
    // Range rings, ticked.
    for (const k of [0.5, 1]) g.circle(A.c.x, A.c.y, R * k).stroke({ width: 1, color: VIO, alpha: 0.35 * fade });
  }, { delay: SCAN });
}

/** The target lock on one card: red brackets snapping in from wide onto its
 *  corners at `lock`, cross-ticks and a red pip, holding until the shot hits
 *  at `hit`, then blown out wide. */
function reticle(t: FxTools, r: Box, s: number, lock: number, hit: number) {
  const c = centre(r), D = hit + 0.25 - lock;
  t.draw(D, (g, u) => {
    const time = u * D, snap = easeOut(span(time, 0, 0.08)), blow = easeIn(span(time, hit - lock, D));
    const e = s * (0.44 + 0.4 * (1 - snap) + 0.35 * blow), a = (1 - blow) * (time < 0.08 ? (Math.floor(time / 0.02) % 2 ? 0.4 : 1) : 1);
    const L = s * 0.14, rot = 0.6 * (1 - snap);
    for (let k = 0; k < 4; k++) {
      const q = rot + Math.PI / 4 + (k * Math.PI) / 2, x = c.x + Math.cos(q) * e * Math.SQRT2, y = c.y + Math.sin(q) * e * Math.SQRT2;
      const sx = Math.sign(Math.cos(q)) || 1, sy = Math.sign(Math.sin(q)) || 1;
      g.moveTo(x - sx * L, y).lineTo(x, y).lineTo(x, y - sy * L);
    }
    g.stroke({ width: 5, color: RED, alpha: 0.25 * a, join: "miter" });
    for (let k = 0; k < 4; k++) {
      const q = rot + Math.PI / 4 + (k * Math.PI) / 2, x = c.x + Math.cos(q) * e * Math.SQRT2, y = c.y + Math.sin(q) * e * Math.SQRT2;
      const sx = Math.sign(Math.cos(q)) || 1, sy = Math.sign(Math.sin(q)) || 1;
      g.moveTo(x - sx * L, y).lineTo(x, y).lineTo(x, y - sy * L);
    }
    g.stroke({ width: 2, color: RED_HI, alpha: a, join: "miter" });
    // The cross-ticks and the pip, once locked.
    if (snap >= 1 && blow <= 0) {
      const tk = s * 0.1, gap = s * 0.06;
      g.moveTo(c.x - gap - tk, c.y).lineTo(c.x - gap, c.y).moveTo(c.x + gap, c.y).lineTo(c.x + gap + tk, c.y)
        .moveTo(c.x, c.y - gap - tk).lineTo(c.x, c.y - gap).moveTo(c.x, c.y + gap).lineTo(c.x, c.y + gap + tk)
        .stroke({ width: 1.5, color: RED_HI, alpha: 0.85 });
      g.circle(c.x, c.y, s * 0.025).fill({ color: RED, alpha: Math.floor(time / 0.06) % 2 ? 0.5 : 1 });
    }
  }, { delay: lock });
  // The lock pings, and the current takes the card: ELECTRIFIED.
  t.later(lock, () => t.ring(r, VIO, 0.6, 1.25, 0.25, 2));
  electrify(t, r, s, hit - lock + 0.2, lock + 0.04);
}

/** Static crawling over a card's rim, re-rolled every beat: the charge it now
 *  carries. Dimmer while it waits, then dying away. */
function electrify(t: FxTools, r: Box, s: number, dur: number, delay: number) {
  const c = centre(r), half = s * 0.42;
  let arcs: number[][] = [], beat = -1;
  t.draw(dur, (g, u) => {
    const b = Math.floor((u * dur) / BEAT);
    if (b !== beat) {
      beat = b;
      arcs = [];
      for (let i = 0; i < 3; i++) {
        const side = Math.floor(rand(0, 4)), q = rand(-half, half);
        const x = c.x + (side < 2 ? q : side === 2 ? -half : half), y = c.y + (side < 2 ? (side ? half : -half) : q);
        const a = (side < 2 ? 0 : Math.PI / 2) + rand(-0.5, 0.5) + (Math.random() < 0.5 ? Math.PI : 0), l = half * rand(0.35, 0.7);
        arcs.push(channel(x, y, x + Math.cos(a) * l, y + Math.sin(a) * l, 3, l * 0.3));
      }
    }
    zap(g, arcs, 1.3, (1 - u * u) * (Math.random() < 0.25 ? 0.25 : rand(0.55, 0.9)));
  }, { delay });
}

/** One shot: a gold-orange muzzle flash at the barrel, a violet tracer bolt
 *  cracking to the card in FLY, and the hit. */
function shot(t: FxTools, A: Plan, f: Plan["found"][number]) {
  const s = A.s, v = s / 90, m0 = muzzle(A, f.barrel, f.fire + 0.001);
  const ang = Math.atan2(f.p.y - m0.y, f.p.x - m0.x);
  // THE MUZZLE FLASH: a forward star of gold fire, gone at once.
  t.draw(0.13, (g, u) => {
    const a = 1 - u, L = s * 0.6 * (0.6 + 0.4 * easeOut(clamp01(u * 5)));
    g.circle(m0.x, m0.y, s * 0.17 * (1 + u)).fill({ color: ORANGE, alpha: 0.35 * a });
    for (const [off, len, w] of [[0, 1, 0.08], [0.6, 0.45, 0.05], [-0.6, 0.45, 0.05], [1.5, 0.25, 0.04], [-1.5, 0.25, 0.04]]) {
      const q = ang + off, cq = Math.cos(q), sq = Math.sin(q), W = s * w;
      g.poly([m0.x - sq * W, m0.y + cq * W, m0.x + cq * L * len, m0.y + sq * L * len, m0.x + sq * W, m0.y - cq * W], true)
        .fill({ color: off === 0 ? FIRE_HI : GOLD, alpha: 0.9 * a });
    }
    g.circle(m0.x, m0.y, s * 0.05).fill({ color: WHITE, alpha: a });
  }, { delay: f.fire });
  t.later(f.fire, () => {
    for (let i = 0; i < 4; i++) {
      const a = ang + rand(-1, 1), sp = rand(80, 200) * v;
      t.spark(m0.x, m0.y, Math.cos(a) * sp, Math.sin(a) * sp, rand(0.15, 0.3), METAL);
    }
  });
  // THE TRACER: a short kinked bolt racing down the line, re-kinked every beat.
  const dx = f.p.x - m0.x, dy = f.p.y - m0.y, d = Math.hypot(dx, dy) || 1;
  let bolt: number[] = [], beat = -1;
  t.draw(FLY + 0.22, (g, u) => {
    const time = u * (FLY + 0.22), e = clamp01(time / FLY), tail = Math.max(0, e - (s * 0.9) / d);
    const b = Math.floor(time / BEAT);
    if (b !== beat) {
      beat = b;
      bolt = channel(m0.x + dx * tail, m0.y + dy * tail, m0.x + dx * e, m0.y + dy * e, 5, s * 0.05);
    }
    if (time < FLY) {
      zap(g, [bolt], 2 + f.power, 1);
      g.circle(m0.x + dx * e, m0.y + dy * e, s * 0.05).fill({ color: WHITE, alpha: 1 });
    }
    // The ionised line it leaves, thinning.
    const ghost = 1 - span(time, FLY, FLY + 0.22);
    g.moveTo(m0.x, m0.y).lineTo(m0.x + dx * e, m0.y + dy * e).stroke({ width: 4, color: VIO, alpha: 0.3 * ghost })
      .moveTo(m0.x, m0.y).lineTo(m0.x + dx * e, m0.y + dy * e).stroke({ width: 1.3, color: LAV, alpha: 0.7 * ghost });
  }, { delay: f.fire });
  // THE HIT.
  const hit = f.fire + FLY;
  t.later(hit, () => {
    flare(t, f.p, s * (1 + 0.4 * f.power), LAV, 0.65, 0.22);
    flare(t, f.p, s * 0.6, GOLD, 0.35, 0.12);
    t.ring(f.r, LAV, 0.25, 0.9 + 0.25 * f.power, 0.28, 2.5);
    for (let i = 0; i < Math.round(7 + 5 * f.power); i++) {
      const a = ang + rand(-1.4, 1.4), sp = rand(140, 300) * v;
      t.spark(f.p.x, f.p.y, Math.cos(a) * sp, Math.sin(a) * sp, rand(0.1, 0.24), SNAP);
    }
  });
  let arcs: number[][] = [], b2 = -1;
  t.draw(0.3, (g, u) => {
    const bt = Math.floor((u * 0.3) / BEAT);
    if (bt !== b2) {
      b2 = bt;
      arcs = [];
      for (let i = 0; i < 4; i++) {
        const a = rand(0, TAU), l = s * rand(0.25, 0.45) * (0.8 + 0.2 * f.power);
        arcs.push(channel(f.p.x, f.p.y, f.p.x + Math.cos(a) * l, f.p.y + Math.sin(a) * l, 3, l * 0.3));
      }
    }
    zap(g, arcs, 1.5, flicker(u * 0.3, 0.3));
  }, { delay: hit });
}

export const GIGAVOLT: Signature = {
  shake: 1.0,
  // It has no legs. It does not go anywhere.
  lunge: false,

  deliver(t: FxTools, m: SigMoment, seconds: number) {
    const A = plan(m), T = seconds;
    // The reactor spinning up, and the sensors coming on.
    t.charge(A.core, A.s * 0.9, VIO, 0.55, T);
    t.charge(A.core, A.s * 0.35, LAV, 0.8, T);
    t.draw(T, (g, u) => {
      const time = u * T, on = time < T * 0.4 ? 0 : Math.floor(time / 0.05) % 3 === 0 && time < T * 0.7 ? 0.3 : 1;
      for (const e of A.eyes) {
        g.circle(e.x, e.y, A.s * 0.06).fill({ color: RED, alpha: 0.25 * on });
        g.circle(e.x, e.y, A.s * 0.025).fill({ color: RED_HI, alpha: on });
      }
      // The core's turbine: three blades turning faster and faster.
      const spin = 30 * u * u, R = A.s * 0.13;
      for (let i = 0; i < 3; i++) {
        const a = spin + (i * TAU) / 3;
        g.moveTo(A.core.x, A.core.y).lineTo(A.core.x + Math.cos(a) * R, A.core.y + Math.sin(a) * R);
      }
      g.stroke({ width: 2, color: LAV, alpha: 0.7 * u });
      g.circle(A.core.x, A.core.y, R).stroke({ width: 1.5, color: VIO, alpha: 0.8 * u });
    });
  },

  land(t: FxTools, m: SigMoment) {
    const A = plan(m), { c, s } = A, v = s / 90;

    // LOCK DOWN — the clamps slam out to the corners and bite...
    const clampOut = (time: number) => easeIn(span(time, 0, BITE));
    const clampA = (time: number) => clamp01(time / 0.03) * (1 - span(time, 0.75, END));
    t.draw(END, (g, u) => {
      const time = u * END, a = clampA(time);
      for (let k = 0; k < 4; k++) g.poly(clampShape(c, s, k, clampOut(time)), true).fill({ color: STEEL, alpha: 0.9 * a });
    }, { dark: true });
    t.draw(END, (g, u) => {
      const time = u * END, a = clampA(time), hot = 1 - span(time, BITE, BITE + 0.25);
      for (let k = 0; k < 4; k++) g.poly(clampShape(c, s, k, clampOut(time)), true).stroke({ width: 1.6, color: hot > 0 ? LAV : VIO, alpha: (0.75 + 0.25 * hot) * a, join: "miter" });
    });
    // ...and the chains shoot out from them to pegs in the board.
    const CH = 0.08;
    t.draw(END - BITE, (g, u) => {
      const time = u * (END - BITE), f = easeOut(span(time, 0, CH)), a = 1 - span(time + BITE, 0.75, END);
      for (let k = 0; k < 4; k++) for (const l of chainLinks(c, s, k, f)) link(g, l, s).fill({ color: STEEL, alpha: 0.85 * a });
    }, { dark: true, delay: BITE });
    t.draw(END - BITE, (g, u) => {
      const time = u * (END - BITE), f = easeOut(span(time, 0, CH)), a = 1 - span(time + BITE, 0.75, END);
      for (let k = 0; k < 4; k++) {
        for (const l of chainLinks(c, s, k, f)) link(g, l, s).stroke({ width: 1.3, color: LAV, alpha: 0.8 * a });
        if (f >= 1) {
          const sx = k === 0 || k === 3 ? -1 : 1, sy = k < 2 ? -1 : 1, px = c.x + sx * s * 0.72, py = c.y + sy * s * 0.72;
          g.circle(px, py, s * 0.035).fill({ color: VIO, alpha: 0.4 * a }).stroke({ width: 1.3, color: LAV, alpha: 0.9 * a });
        }
      }
    }, { delay: BITE });
    t.later(BITE, () => {
      for (let k = 0; k < 4; k++) {
        const sx = k === 0 || k === 3 ? -1 : 1, sy = k < 2 ? -1 : 1, x = c.x + sx * s * 0.44, y = c.y + sy * s * 0.44;
        t.flash({ x, y }, FIRE_HI, 0.18 * (s / 80));
        for (let i = 0; i < 3; i++) {
          const a = Math.atan2(sy, sx) + rand(-1, 1), sp = rand(80, 180) * v;
          t.spark(x, y, Math.cos(a) * sp, Math.sin(a) * sp, rand(0.15, 0.3), METAL);
        }
      }
    });
    t.later(BITE + CH, () => {
      for (let k = 0; k < 4; k++) {
        const sx = k === 0 || k === 3 ? -1 : 1, sy = k < 2 ? -1 : 1;
        t.flash({ x: c.x + sx * s * 0.72, y: c.y + sy * s * 0.72 }, LAV, 0.14 * (s / 80));
      }
    });

    // The reactor core flares, and holds lit while it fights.
    t.later(BITE, () => {
      flare(t, A.core, s * 1.5, VIO, 0.6, 0.45);
      t.ring(m.from, LAV, 0.2, 1.0, 0.3, 2.5);
    });
    t.draw(END, (g, u) => {
      const time = u * END, a = clamp01(time / 0.05) * (1 - span(time, 0.8, END)), pulse = 0.8 + 0.2 * Math.sin(time * 40);
      g.circle(A.core.x, A.core.y, s * 0.16).fill({ color: VIO, alpha: 0.3 * a * pulse });
      g.circle(A.core.x, A.core.y, s * 0.13).stroke({ width: 2, color: LAV, alpha: 0.85 * a });
      g.circle(A.core.x, A.core.y, s * 0.06).fill({ color: WHITE, alpha: 0.9 * a * pulse });
      for (const e of A.eyes) {
        g.circle(e.x, e.y, s * 0.06).fill({ color: RED, alpha: 0.25 * a });
        g.circle(e.x, e.y, s * 0.025).fill({ color: RED_HI, alpha: a });
      }
    });

    // The turret barrels swinging out from its flanks, tracking, kicking.
    const barrelA = (time: number) => clamp01((time - BITE * 0.5) / 0.06) * (1 - span(time, 0.85, END));
    const shapes = (time: number) => A.mounts.map((m0, i) => barrel(m0, barrelAim(A, i, time), s, recoil(A, i, time)));
    t.draw(END, (g, u) => {
      const time = u * END, a = barrelA(time);
      if (a > 0.01) for (const pts of shapes(time)) g.poly(pts, true).fill({ color: STEEL, alpha: 0.92 * a });
    }, { dark: true });
    t.draw(END, (g, u) => {
      const time = u * END, a = barrelA(time);
      if (a <= 0.01) return;
      for (const pts of shapes(time)) g.poly(pts, true).stroke({ width: 1.4, color: VIO, alpha: 0.9 * a, join: "miter" });
      // The muzzles glowing hot as the volley nears.
      const heat = span(time, FIRE - 0.15, FIRE) * (1 - span(time, FIRE + 0.4, END));
      if (heat > 0.01) for (let i = 0; i < 4; i++) {
        const mz = muzzle(A, i, time);
        g.circle(mz.x, mz.y, s * 0.05).fill({ color: GOLD, alpha: 0.6 * heat });
      }
    });

    // SCAN: the radar turns once, locking every opponent as it passes.
    radar(t, A);
    for (const f of A.found) reticle(t, f.r, s, f.lock, f.fire + FLY);

    // FIRE: one volley, in lock order.
    for (const f of A.found) shot(t, A, f);
  },
};
