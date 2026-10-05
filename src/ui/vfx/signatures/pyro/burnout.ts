/** BURNOUT — Crash Out. "Charge up to 3 slots and crash into a target: 10 DMG
 *  and BURN 3, with the same burn spreading to everything touching it. If the
 *  crash kills, Burnout takes its place. Costs Burnout 2 HP." Crash Out
 *  charges up to three slots for 10 and spreads the burn.
 *
 *  Its art is a flaming black hot-rod: a supercharger stack, a row of round
 *  amber headlamps, spiked wheels with their tyres on fire, exhaust pipes
 *  blasting flame. So its fire is a MACHINE's: blue-hot exhaust, burning
 *  rubber, tyre smoke and wreckage. The DELIVERY starts as its name: it does
 *  a burnout — the wheels spin in place, ash-grey tyre smoke boiling off the
 *  back, and the engine revs, each rev a blast of BLUE-hot flame out of the
 *  twin pipes behind it. Then it launches: four spiked wheels ringed in fire
 *  race to the card with the headlamps blazing ahead, the exhaust a long blue
 *  jet, laying two black tyre tracks that catch fire behind it. Its nose
 *  meets the card as the delivery ends; the token jumps to where the run
 *  ended as the step lands.
 *
 *  The LANDING is the crash: a hard white impact star where it hits, the
 *  board shaking, wreckage flung off — black shards of metal, hot along their
 *  torn edges — and a shower of sparks. The card it hit goes up, and the fire
 *  spills off it: a wash of flame running along the ground to every card
 *  touching it, each catching as it arrives (the burn spreading). A kill
 *  gives it the ground, and the engine roars once more there, blue.
 *
 *  It draws its own charge (no lunge). The tracks, the tyre smoke and the
 *  wreckage are dark for real, each lit along its edge. */
import type { Graphics } from "pixi.js";
import { centre, rand } from "../../looks/base";
import { pyroBody, pyroEnv, pyroFire, pyroFlick, pyroLick, pyroTongue } from "../../looks/fire";
import type { FxTools, Pt, SparkStyle } from "../../looks/types";
import type { Signature, SigMoment } from "../types";

type Box = SigMoment["from"];

const TAU = Math.PI * 2;
// The exhaust: blue-hot, as light — the one thing in PYRO that burns blue.
const B_OUT = 0x2a5cff, B_MID = 0x5cb0ff, B_CORE = 0xeaf8ff;
// Fire on the wheels and the tracks, the headlamps' amber, the crash's white.
const FLAME = 0xff7a26, AMBER = 0xffb43c, LAMP = 0xffd890, WHITE = 0xfff6e8;
// Rubber and metal (normal blend), and their lit edges.
const RUBBER = 0x0b0807, METAL = 0x17131a, HOT_EDGE = 0xffa040;
// Tyre smoke: ash grey, its tops catching the light.
const SMOKE = 0x2c2826, SMOKE_RIM = 0xb4aaa2;

/** The exhaust's pops: blue-white, fast, short. */
const POP: SparkStyle = { palette: [B_CORE, B_MID, B_OUT], gravity: 0, drag: 0.3, size: [4, 1.5], streak: true };
/** Sparks off the crash: white-hot metal, falling. */
const CRASH: SparkStyle = { palette: [WHITE, LAMP, AMBER, FLAME], gravity: 600, drag: 0.5, size: [5, 1.5], streak: true };
/** Grit and rubber thrown off the spinning wheels. */
const GRIT: SparkStyle = { palette: [LAMP, AMBER, FLAME, 0x803010], gravity: 500, drag: 0.5, size: [4, 1.5], streak: false };

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeOut = (x: number) => 1 - (1 - x) * (1 - x);

/** Its run: from its square to where its nose meets the card it crashes into
 *  (`hit`, that card's near face), along `u`; the car's middle stops `back`
 *  short of it. Worked out the same for the delivery and the landing. */
function runOf(m: SigMoment) {
  const s = m.size, c0 = centre(m.from);
  const prey = m.targets.length ? centre(m.targets[0]) : { x: centre(m.to).x + m.ahead.x * s, y: centre(m.to).y + m.ahead.y * s };
  const dx = prey.x - c0.x, dy = prey.y - c0.y, d = Math.hypot(dx, dy) || 1, u = { x: dx / d, y: dy / d };
  const hit = { x: prey.x - u.x * s * 0.48, y: prey.y - u.y * s * 0.48 };
  const end = { x: hit.x - u.x * s * 0.4, y: hit.y - u.y * s * 0.4 };
  return { c0, prey, u, hit, end, len: Math.max(0, (end.x - c0.x) * u.x + (end.y - c0.y) * u.y) };
}

/** A tongue of blue-hot exhaust from (bx, by) along (ux, uy): the same flame
 *  shape PYRO burns in, drawn in the exhaust's blues. */
function exhaust(g: Graphics, bx: number, by: number, ux: number, uy: number, len: number, w: number, lean: number, a: number) {
  pyroTongue(g, bx, by, ux, uy, len, w, lean, B_OUT, 0.5 * a);
  pyroTongue(g, bx, by, ux, uy, len * 0.7, w * 0.62, lean * 0.7, B_MID, 0.65 * a);
  pyroTongue(g, bx, by, ux, uy, len * 0.38, w * 0.34, lean * 0.4, B_CORE, 0.9 * a);
}

/** A spiked wheel at `c`, `R` across, turned `spin`: the tyre as a dark disc
 *  (`lit` false) or as its light — a ring of fire round it and the spikes
 *  on its hub catching the light (`lit` true). */
function wheel(g: Graphics, c: Pt, R: number, spin: number, a: number, lit: boolean) {
  if (a <= 0.02) return;
  if (!lit) {
    g.circle(c.x, c.y, R).fill({ color: RUBBER, alpha: 0.95 * a });
    return;
  }
  g.circle(c.x, c.y, R * 1.25).stroke({ width: R * 0.5, color: FLAME, alpha: 0.25 * a });
  g.circle(c.x, c.y, R).stroke({ width: Math.max(1.2, R * 0.22), color: AMBER, alpha: 0.9 * a });
  for (let i = 0; i < 6; i++) {
    const th = spin + (i / 6) * TAU;
    g.moveTo(c.x + Math.cos(th) * R * 0.3, c.y + Math.sin(th) * R * 0.3)
      .lineTo(c.x + Math.cos(th) * R * 1.35, c.y + Math.sin(th) * R * 1.35);
  }
  g.stroke({ width: 1.2, color: LAMP, alpha: 0.85 * a, cap: "round" });
  g.circle(c.x, c.y, R * 0.25).fill({ color: LAMP, alpha: 0.8 * a });
}

/** A puff of smoke: a soft lumpy blob. */
function puffShape(x: number, y: number, r: number, seed: number): number[] {
  const pts: number[] = [];
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * TAU, rr = r * (1 + 0.14 * Math.sin(3 * a + seed) + 0.07 * Math.sin(5 * a - seed));
    pts.push(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.8);
  }
  return pts;
}

export const BURNOUT: Signature = {
  shake: 1.8,
  // It draws its own charge: the token jumps to where the run ends as the
  // step lands.
  lunge: false,

  deliver(t: FxTools, m: SigMoment, seconds: number) {
    const s = m.size, S = seconds, run = runOf(m), { c0, u } = run, nx = -u.y, ny = u.x, sc = s / 90, seed = rand(0, 100);
    const WIND = S * 0.38, RUN = S - WIND;
    /** Where the car's middle is along its run: spinning in place, then
     *  launched, flat out into the crash. */
    const at = (time: number) => run.len * Math.pow(clamp01((time - WIND) / RUN), 1.7);
    const P = (d: number, side = 0): Pt => ({ x: c0.x + u.x * d + nx * side, y: c0.y + u.y * d + ny * side });
    const AX = s * 0.28, AY = s * 0.3, WR = s * 0.105; // axles: along, across; wheel radius
    /** The burnout's shudder: the car shaking on its springs while it spins. */
    const jig = (time: number) => (time < WIND ? Math.sin(time * 90) * s * 0.012 : 0);
    const shown = (time: number) => clamp01(time / 0.06) * (time > S - 0.01 ? 0 : 1);
    const revs = [0.05, 0.38, 0.7].map((f) => f * WIND);
    /** How hard the exhaust blows: a blast on each rev, a long jet once it
     *  launches. */
    const blow = (time: number) => {
      if (time >= WIND) return 0.85 + 0.15 * Math.sin(time * 50);
      let b = 0.25;
      for (const r of revs) if (time >= r) b = Math.max(b, 1 - (time - r) / 0.12);
      return b;
    };
    for (const r of revs) {
      t.later(r, () => {
        const rear = P(-s * 0.42);
        t.flash(rear, B_MID, 0.08 * (s / 80));
        for (let i = 0; i < Math.round(6 * t.quality); i++) {
          // Spat out to the sides as well as back, so they show even when its
          // tail is at the board's edge.
          const a = Math.atan2(-u.y, -u.x) + (Math.random() < 0.5 ? -1 : 1) * rand(0.3, 1.2), v = rand(160, 300) * sc;
          t.spark(rear.x + nx * rand(-0.15, 0.15) * s, rear.y + ny * rand(-0.15, 0.15) * s, Math.cos(a) * v, Math.sin(a) * v, rand(0.15, 0.25), POP);
        }
      });
    }

    // THE TRACKS: two black stripes of rubber laid behind its rear wheels,
    // catching fire as it goes — and the patch it burns in place first.
    const D = S + 0.35;
    const gone = (time: number) => 1 - clamp01((time - S) / 0.35);
    const step = s * 0.16, nFl = Math.max(2, Math.floor((run.len + s * 0.2) / step));
    const flames = [-1, 1].flatMap((sd) => Array.from({ length: nFl }, (_, i) => ({ d: -AX + i * step + (sd > 0 ? step * 0.5 : 0), sd, born: -1, h: rand(0.8, 1.2) })));
    t.draw(D, (g, v) => {
      const time = v * D, h = at(Math.min(time, S)), a = gone(time);
      for (const sd of [-1, 1]) {
        const a0 = P(-AX - s * 0.05, sd * AY), a1 = P(h - AX, sd * AY);
        g.moveTo(a0.x, a0.y).lineTo(a1.x, a1.y).stroke({ width: s * 0.11, color: RUBBER, alpha: 0.85 * a, cap: "round" });
      }
    }, { dark: true });
    t.draw(D, (g, v) => {
      const time = v * D, h = at(Math.min(time, S)), a = gone(time);
      for (const sd of [-1, 1]) {
        const a0 = P(-AX - s * 0.05, sd * AY), a1 = P(h - AX, sd * AY);
        for (const e of [-1, 1]) {
          const o = e * s * 0.045;
          g.moveTo(a0.x + nx * o, a0.y + ny * o).lineTo(a1.x + nx * o, a1.y + ny * o);
        }
        g.stroke({ width: 1, color: HOT_EDGE, alpha: 0.45 * a });
      }
      // Fire catching along them where the rear wheels have passed.
      for (const f of flames) {
        if (f.born < 0) {
          if (time < WIND || f.d > h - AX) continue;
          f.born = time;
        }
        const e = pyroEnv(time - f.born, 0.6, 0.06);
        if (e <= 0) continue;
        const p = P(f.d, f.sd * AY);
        pyroLick(g, p.x, p.y, s * 0.3 * f.h * e, s * 0.13, time, seed + f.d * 0.1 + f.sd, 0.9 * e);
      }
    });

    // TYRE SMOKE boiling off the back wheels while it spins in place, rolling
    // away behind it: ash grey, dark, its tops lit.
    const puffs: { x: number; y: number; vx: number; vy: number; r: number; age: number; life: number; seed: number }[] = [];
    let pa = 0;
    const PD = S + 0.6;
    const stepPuffs = (dt: number, time: number) => {
      if (time < WIND + RUN * 0.3) {
        pa += dt * 30 * t.quality;
        for (; pa >= 1; pa--) {
          const sd = Math.random() < 0.5 ? -1 : 1, p = P(at(time) - AX - s * 0.05, sd * AY), v = rand(25, 60) * sc;
          puffs.push({ x: p.x, y: p.y, vx: -u.x * v * 0.5 + nx * sd * v, vy: -u.y * v * 0.5 + ny * sd * v - 20 * sc, r: s * rand(0.13, 0.19),
            age: 0, life: rand(0.55, 0.8), seed: rand(0, 100) });
        }
      }
      for (let i = puffs.length - 1; i >= 0; i--) {
        const q = puffs[i];
        q.age += dt;
        if (q.age >= q.life) { puffs.splice(i, 1); continue; }
        q.x += q.vx * dt;
        q.y += q.vy * dt;
      }
    };
    t.draw(PD, (g, v, dt) => {
      stepPuffs(dt, v * PD);
      for (const q of puffs) {
        const k = q.age / q.life;
        g.poly(puffShape(q.x, q.y, q.r * (1 + 1.3 * k), q.seed), true).fill({ color: SMOKE, alpha: 0.75 * Math.sin(Math.PI * Math.min(1, k * 1.2 + 0.15)) });
      }
    }, { dark: true });
    t.draw(PD, (g) => {
      for (const q of puffs) {
        const k = q.age / q.life, R = q.r * (1 + 1.3 * k), a = 0.6 * (1 - k);
        g.poly(puffShape(q.x, q.y, R, q.seed), true).fill({ color: SMOKE_RIM, alpha: 0.07 * (1 - k) });
        g.moveTo(q.x + Math.cos(Math.PI * 1.1) * R, q.y + Math.sin(Math.PI * 1.1) * R * 0.8)
          .arc(q.x, q.y, R, Math.PI * 1.1, Math.PI * 1.9).stroke({ width: 1.2, color: SMOKE_RIM, alpha: a });
      }
    });

    // THE CAR: four spiked wheels on fire, the headlamps blazing ahead, the
    // exhaust blasting blue behind — shuddering in place, then gone.
    const wheels = (time: number) => {
      const h = at(time), j = jig(time);
      return [-1, 1].flatMap((al) => [-1, 1].map((sd) => P(h + al * AX + j, sd * AY + j * 0.5)));
    };
    /** Its chassis, once it is off its own square (until then the card IS
     *  the car): a long black hull, nose to tail, and the supercharger
     *  standing out of its bonnet. */
    const body = (time: number) => {
      const h = at(time) + jig(time), c = P(h), hl = s * 0.4, hw = s * 0.24, nose = s * 0.14;
      const pt = (al: number, ac: number) => ({ x: c.x + u.x * al + nx * ac, y: c.y + u.y * al + ny * ac });
      const hull = [pt(-hl, -hw), pt(hl - nose, -hw), pt(hl, -hw * 0.7), pt(hl, hw * 0.7), pt(hl - nose, hw), pt(-hl, hw)].flatMap((q) => [q.x, q.y]);
      const blower = [pt(s * 0.02, -s * 0.09), pt(s * 0.24, -s * 0.07), pt(s * 0.24, s * 0.07), pt(s * 0.02, s * 0.09)].flatMap((q) => [q.x, q.y]);
      return { hull, blower, a: clamp01((at(time) - s * 0.3) / (s * 0.35)), c };
    };
    const spinOf = (time: number) => (time < WIND ? time * 40 : WIND * 40 + at(time) / WR);
    t.draw(S, (g, v) => {
      const time = v * S, a = shown(time);
      for (const w of wheels(time)) wheel(g, w, WR, 0, a, false);
      const b = body(time);
      if (b.a > 0.02) g.poly(b.hull, true).fill({ color: METAL, alpha: 0.92 * b.a * a });
    }, { dark: true });
    let grit = 0;
    t.draw(S, (g, v, dt) => {
      const time = v * S, a = shown(time), h = at(time), pace = clamp01((time - WIND) / RUN);
      if (a <= 0) return;
      const spin = spinOf(time);
      // Speed: streaks off its flanks once it is moving.
      if (pace > 0.05) {
        for (const sd of [-1, 0.5, 1]) {
          const b = P(h - s * 0.3, sd * s * 0.42), e = P(h - s * (0.3 + 0.9 * pace), sd * s * 0.42);
          g.moveTo(b.x, b.y).lineTo(e.x, e.y).stroke({ width: 1.2, color: AMBER, alpha: 0.35 * a });
        }
      }
      // The headlamps, three round amber lights at its nose, and their beams.
      const nose = P(h + s * 0.4 + jig(time));
      for (const sd of [-1, 0, 1]) {
        const l = { x: nose.x + nx * sd * s * 0.14, y: nose.y + ny * sd * s * 0.14 }, far = s * 0.75, half = s * 0.16;
        g.poly([l.x, l.y, l.x + u.x * far + nx * half, l.y + u.y * far + ny * half, l.x + u.x * far - nx * half, l.y + u.y * far - ny * half], true)
          .fill({ color: LAMP, alpha: 0.08 * a });
        g.circle(l.x, l.y, s * 0.05).fill({ color: AMBER, alpha: 0.5 * a });
        g.circle(l.x, l.y, s * 0.028).fill({ color: WHITE, alpha: 0.95 * a });
      }
      // The hull's hot edges and the supercharger's chrome.
      const bd = body(time);
      if (bd.a > 0.02) {
        g.poly(bd.hull, true).stroke({ width: 1.4, color: HOT_EDGE, alpha: 0.8 * bd.a * a, join: "round" });
        g.poly(bd.blower, true).fill({ color: AMBER, alpha: 0.25 * bd.a * a }).stroke({ width: 1.2, color: LAMP, alpha: 0.85 * bd.a * a, join: "round" });
      }
      // The wheels, burning.
      for (const w of wheels(time)) {
        wheel(g, w, WR, spin, a, true);
        pyroLick(g, w.x, w.y, s * 0.17, s * 0.09, time, seed + w.x * 0.07, 0.75 * a);
      }
      // The exhaust: twin pipes at its tail, blue-hot.
      const b = blow(time), tail = P(h - s * 0.4 + jig(time));
      for (const sd of [-1, 1]) {
        const px = tail.x + nx * sd * s * 0.13, py = tail.y + ny * sd * s * 0.13;
        g.circle(px, py, s * 0.035).fill({ color: B_MID, alpha: 0.8 * a });
        exhaust(g, px, py, -u.x, -u.y, s * (0.2 + 0.5 * b) * (1 + 0.15 * pyroFlick(time, seed + sd)), s * 0.12, s * 0.04 * pyroFlick(time * 1.3, seed + sd * 3), a);
      }
      // Grit and burning rubber thrown off the wheels as they spin.
      grit += dt * (time < WIND ? 30 : 22) * t.quality;
      for (; grit >= 1; grit--) {
        const sd = Math.random() < 0.5 ? -1 : 1, p = P(h - AX, sd * AY), vv = rand(80, 170) * sc;
        t.spark(p.x, p.y, (-u.x + nx * sd * rand(0.2, 0.7)) * vv, (-u.y + ny * sd * rand(0.2, 0.7)) * vv - 40 * sc, rand(0.25, 0.4), GRIT);
      }
    });
    t.charge(P(-s * 0.42), s * 0.8, B_MID, 0.3, WIND);
  },

  land(t: FxTools, m: SigMoment) {
    const s = m.size, run = runOf(m), { u, hit } = run, sc = s / 90, ang = Math.atan2(u.y, u.x);
    if (!m.targets.length) return;
    const r0 = m.targets[0], p0 = centre(r0), k = Math.max(0.8, Math.min(1.8, m.power[0] ?? 1));
    // THE CRASH: a white impact star where its nose hits, a blue flash of the
    // engine behind it, the card shoved and shaken.
    t.flash(hit, WHITE, 0.2 * k * (s / 80));
    t.flash(p0, AMBER, 0.12 * k * (s / 80), 0.03);
    t.ring(r0, AMBER, 0.3, 1.35, 0.35, 3);
    const star = Array.from({ length: 14 }, (_, i) => (i % 2 ? rand(0.32, 0.45) : rand(0.6, 0.85)) * s * Math.min(1.2, 0.8 + 0.2 * k));
    const rot = rand(0, TAU), SD = 0.26;
    t.draw(SD, (g, v) => {
      const a = 1 - v, grow = 0.6 + 0.4 * easeOut(Math.min(1, v * 4)), pts: number[] = [];
      for (let i = 0; i < 14; i++) {
        const th = rot + (i / 14) * TAU;
        pts.push(hit.x + Math.cos(th) * star[i] * grow, hit.y + Math.sin(th) * star[i] * grow * 0.8);
      }
      g.poly(pts, true).fill({ color: AMBER, alpha: 0.3 * a }).stroke({ width: 2, color: WHITE, alpha: 0.9 * a, join: "miter" });
      // Its white-hot heart: the same star pulled in toward the point of impact
      // (the list runs x, y, x, y...).
      const inner = pts.map((q, i) => (i % 2 ? hit.y + (q - hit.y) * 0.45 : hit.x + (q - hit.x) * 0.45));
      g.poly(inner, true).fill({ color: WHITE, alpha: 0.55 * a });
    });
    for (let i = 0; i < Math.round(16 * k); i++) {
      const a = ang + Math.PI + rand(-1.5, 1.5) * (Math.random() < 0.5 ? 1 : -1), v = rand(160, 340) * sc;
      t.spark(hit.x, hit.y, Math.cos(a) * v, Math.sin(a) * v - 60 * sc, rand(0.3, 0.5), CRASH);
    }
    wreckage(t, hit, ang, s, k);
    // The card it hit goes up...
    burn(t, r0, s, 0.55, 0.48 * Math.min(1.2, k), 0.06, true);
    // ...and the fire spills off it onto everything touching it.
    m.targets.forEach((r, i) => { if (i > 0) spill(t, p0, r, s, 0.1 + (i - 1) * 0.04); });
    if (m.killed[0]) t.later(0.32, () => roar(t, m.to, m.ahead, s));
  },
};

/** Wreckage flung off the crash: black shards of torn metal, tumbling out
 *  forward and to the sides and falling, hot along their torn edges. */
function wreckage(t: FxTools, at: Pt, ang: number, s: number, k: number) {
  const n = Math.max(6, Math.round(10 * Math.min(1.3, k) * (0.6 + 0.4 * t.quality))), D = 0.75, sc = s / 90;
  const bits = Array.from({ length: n }, () => {
    const a = ang + rand(-1.6, 1.6), v = rand(140, 300) * sc, sz = s * rand(0.07, 0.13), m = Math.random() < 0.5 ? 3 : 4;
    return { vx: Math.cos(a) * v, vy: Math.sin(a) * v - rand(60, 140) * sc, spin: rand(-14, 14), rot: rand(0, TAU),
      pts: Array.from({ length: m }, (_, i) => ({ a: (i / m) * TAU + rand(-0.4, 0.4), r: sz * rand(0.6, 1.1) })), life: rand(0.5, 0.75) };
  });
  type Bit = (typeof bits)[number];
  const shape = (b: Bit, time: number) => {
    const x = at.x + b.vx * time, y = at.y + b.vy * time + 0.5 * 700 * sc * time * time, th = b.rot + b.spin * time, out: number[] = [];
    for (const q of b.pts) out.push(x + Math.cos(th + q.a) * q.r, y + Math.sin(th + q.a) * q.r);
    return out;
  };
  const alive = (b: Bit, time: number) => (time < b.life ? 1 - Math.pow(time / b.life, 3) : 0);
  t.draw(D, (g, v) => {
    const time = v * D;
    for (const b of bits) { const a = alive(b, time); if (a > 0) g.poly(shape(b, time), true).fill({ color: METAL, alpha: 0.95 * a }); }
  }, { dark: true });
  t.draw(D, (g, v) => {
    const time = v * D;
    for (const b of bits) {
      const a = alive(b, time);
      if (a > 0) g.poly(shape(b, time), true).stroke({ width: 1.3, color: time < 0.15 ? LAMP : HOT_EDGE, alpha: 0.9 * a, join: "miter" });
    }
  });
}

/** A card on fire: flames standing up off its footing and climbing it,
 *  wisps tearing off, and (for the card it crashed into) smoke rolling up. */
function burn(t: FxTools, r: Box, s: number, seconds: number, height: number, delay: number, smoke: boolean) {
  const seed = rand(0, 100), y = r.y + r.h * 0.86;
  t.glow(r, FLAME, 0.3, seconds * 0.7, 1.0);
  pyroFire(t, {
    seconds, delay,
    body: (g, time, k) => {
      const e = Math.min(1, time / 0.08) * (1 - Math.pow(k, 2.5));
      pyroBody(g, r.x + r.w * 0.08, r.x + r.w * 0.92, y, s * height * (0.7 + 0.3 * e), e, time, seed);
    },
    wisp: () => ({ x: r.x + r.w * rand(0.15, 0.85), y: y - s * height * rand(0.3, 0.7) }), wispRate: 14, wispSize: s * 0.08,
    puff: smoke ? () => ({ x: r.x + r.w * rand(0.25, 0.75), y: r.y + r.h * 0.2 }) : undefined, smokeRate: 5, smokeSize: s * 0.11,
  });
}

/** The burn spreading: a wash of flame running along the ground from the
 *  crashed card `from` to a card touching it, and that card catching. */
function spill(t: FxTools, from: Pt, r: Box, s: number, delay: number) {
  const to = centre(r), RUN = 0.2, D = 0.65, seed = rand(0, 100);
  const dx = to.x - from.x, dy = to.y - from.y;
  const P = (f: number): Pt => ({ x: from.x + dx * f, y: from.y + dy * f });
  t.draw(D, (g, v) => {
    const time = v * D, f = easeOut(clamp01(time / RUN));
    // Flames standing up along the path it has run, dying back behind it.
    for (let i = 0; i <= 5; i++) {
      const q = i / 5;
      if (q > f) break;
      const age = time - (RUN * (1 - Math.sqrt(1 - q)));
      const e = pyroEnv(age, 0.42, 0.05);
      if (e <= 0) continue;
      const p = P(q);
      pyroLick(g, p.x, p.y + s * 0.1, s * 0.22 * e, s * 0.13, time, seed + i * 2.3, 0.85 * e);
    }
    // Its running front: a low rolling head of fire.
    if (time < RUN + 0.04) {
      const p = P(f), a = 1 - clamp01((time - RUN) / 0.04);
      g.circle(p.x, p.y, s * 0.16).fill({ color: FLAME, alpha: 0.35 * a });
      pyroLick(g, p.x, p.y + s * 0.08, s * 0.3, s * 0.18, time, seed, a);
    }
  }, { delay });
  t.later(delay + RUN, () => {
    t.flash(to, FLAME, 0.1 * (s / 80));
    burn(t, r, s, 0.45, 0.34, 0, false);
  });
}

/** It takes the dead card's place: the engine roars there once more, a last
 *  blast of blue out of its pipes. */
function roar(t: FxTools, r: Box, ahead: Pt, s: number) {
  const c = centre(r), nx = -ahead.y, ny = ahead.x, D = 0.4, seed = rand(0, 100);
  const tail = { x: c.x - ahead.x * s * 0.42, y: c.y - ahead.y * s * 0.42 };
  t.flash(tail, B_MID, 0.1 * (s / 80));
  t.draw(D, (g, v) => {
    const time = v * D, a = Math.sin(Math.PI * Math.min(1, v * 1.2));
    for (const sd of [-1, 1]) {
      const px = tail.x + nx * sd * s * 0.13, py = tail.y + ny * sd * s * 0.13;
      exhaust(g, px, py, -ahead.x, -ahead.y, s * 0.55 * (1 + 0.15 * pyroFlick(time, seed + sd)), s * 0.13, 0, a);
    }
  });
}
