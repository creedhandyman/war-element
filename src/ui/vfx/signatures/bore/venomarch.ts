/** VENOMARCH — Toxic Contagion. "SLEEP a target and POISON 3 for 2 rounds. If
 *  it dies while poisoned, it bursts for 3 DMG to every adjacent card."
 *  Venom on the march.
 *
 *  Venomarch's art is a giant armoured SCORPION in gold plate, a glowing green
 *  crystal set in its back, its tail curled high over it and toxic green mist
 *  rolling round its claws. So the DELIVERY is the tail: a chain of gold
 *  plates rising off the back of its card and arching up over it, the bulb of
 *  the sting glowing green and venom dripping off the barb, swaying as it
 *  takes aim. Then it LASHES: the tail snaps forward and the sting is flung
 *  down the arc of the lash — a green venom streak edged in gold, whipping
 *  over the board to the target, arriving as the step lands.
 *
 *  The LANDING is the sting going in: a sharp green puncture, the gold barb
 *  standing in the card for a blink, and venom spreading out through the
 *  card in VEINS — dark channels lit green from inside, forking as they
 *  run. Then a heavy toxic mist sinks over it and pools low round its foot
 *  (the SLEEP: it does not rise like spores, it settles like a gas). On a
 *  kill the card BURSTS — a ring of green spatter, and gobbets of venom
 *  flung onto each card beside it, each one spreading its own small veins.
 *
 *  Scorpion GOLD and toxic GREEN, nothing else: the plates are dark for real
 *  (`dark: true`) under gold rims, so the tail reads over an empty square;
 *  the venom is light. A sting, not a bite or a pour: one sharp point of
 *  entry, and everything spreading from it. */
import { centre, rand } from "../../looks/base";
import type { Graphics } from "pixi.js";
import type { FxTools, Pt, SparkStyle } from "../../looks/types";
import type { Signature, SigMoment } from "../types";

type Box = SigMoment["from"];

const TAU = Math.PI * 2;
// The tail's plates, on the dark layer: blackened gold armour.
const PLATE = 0x2a1a06, PLATE_LO = 0x140c02, VEIN_DARK = 0x0c2606;
// Its light (additive): the gold of the plate, and the venom.
const GOLD_HI = 0xfff0a0, GOLD = 0xffc23a, OLD_GOLD = 0xb07a18;
const TOXIC_HI = 0xe6ffb0, TOXIC = 0x8cff2a, TOXIC_DEEP = 0x3aa818;
/** Venom falling off the barb or flung from a burst: heavy drops. */
const DRIP: SparkStyle = { palette: [TOXIC_HI, TOXIC, TOXIC_DEEP], gravity: 620, drag: 0.7, size: [5, 2], streak: false };
/** Spatter thrown by a burst or a sting: fast, streaking, falling. */
const SPATTER: SparkStyle = { palette: [TOXIC_HI, TOXIC, TOXIC_DEEP], gravity: 380, drag: 0.5, size: [6, 2], streak: true };
/** Gold chips off the lash. */
const CHIP: SparkStyle = { palette: [GOLD_HI, GOLD, OLD_GOLD], gravity: 300, drag: 0.4, size: [4, 1.5], streak: true };

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeOut = (x: number) => 1 - (1 - x) * (1 - x);
const easeIn = (x: number) => x * x;
const smooth = (x: number) => x * x * (3 - 2 * x);

/** An oval at (x, y), `rx` along `rot` and `ry` across it — a plate of the
 *  tail lying along its curve. Continues the current path. */
function oval(g: Graphics, x: number, y: number, rx: number, ry: number, rot: number) {
  const pts: number[] = [], cs = Math.cos(rot), sn = Math.sin(rot);
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * TAU, px = Math.cos(a) * rx, py = Math.sin(a) * ry;
    pts.push(x + px * cs - py * sn, y + px * sn + py * cs);
  }
  return g.poly(pts, true);
}

// ── The tail ─────────────────────────────────────────────────────────────────

type Seg = { x: number; y: number; h: number; r: number };

/** The tail as a chain of plates from `base`: leaving along `h0` and turning
 *  by `turn` over its `len`, the plates shrinking toward the sting. The last
 *  entry is where the sting sits and the way it points. */
function tail(base: Pt, h0: number, turn: number, len: number, s: number): Seg[] {
  const N = 7, out: Seg[] = [];
  let x = base.x, y = base.y;
  for (let i = 0; i <= N; i++) {
    const u = i / N, h = h0 + turn * Math.pow(u, 1.8);
    out.push({ x, y, h, r: s * (0.1 - 0.045 * u) });
    x += Math.cos(h) * (len / N);
    y += Math.sin(h) * (len / N);
  }
  return out;
}

/** The sting at the end of the tail: a swollen venom bulb and a hooked barb
 *  out of it. Dark: the bulb and barb as armour. Light: their gold rims, the
 *  green venom glowing in the bulb, the barb's tip lit, `glow` 0..1. */
function sting(g: Graphics, p: Seg, s: number, a: number, dark: boolean, glow: number) {
  const ux = Math.cos(p.h), uy = Math.sin(p.h), nx = -uy, ny = ux, R = s * 0.085;
  const bx = p.x + ux * R * 0.6, by = p.y + uy * R * 0.6;
  // The barb: out of the bulb and hooked back toward the curl.
  const tip = { x: bx + ux * R * 2.1 + nx * R * 0.9, y: by + uy * R * 2.1 + ny * R * 0.9 };
  const barb = [bx + nx * R * 0.55, by + ny * R * 0.55, bx + ux * R * 1.4 + nx * R * 0.7, by + uy * R * 1.4 + ny * R * 0.7, tip.x, tip.y,
    bx + ux * R * 1.3 - nx * R * 0.1, by + uy * R * 1.3 - ny * R * 0.1, bx - nx * R * 0.5, by - ny * R * 0.5];
  if (dark) {
    oval(g, bx, by, R * 1.1, R * 0.85, p.h).fill({ color: PLATE, alpha: 0.92 * a });
    g.poly(barb, true).fill({ color: PLATE_LO, alpha: 0.92 * a });
    return tip;
  }
  oval(g, bx, by, R * 0.8, R * 0.6, p.h).fill({ color: TOXIC, alpha: (0.25 + 0.4 * glow) * a });
  oval(g, bx, by, R * 1.1, R * 0.85, p.h).stroke({ width: 1.5, color: GOLD, alpha: 0.9 * a });
  g.poly(barb, true).stroke({ width: 1.3, color: GOLD_HI, alpha: 0.85 * a, join: "round" });
  g.circle(tip.x, tip.y, R * (0.5 + 0.6 * glow)).fill({ color: TOXIC, alpha: 0.35 * glow * a }).circle(tip.x, tip.y, R * 0.28).fill({ color: TOXIC_HI, alpha: (0.5 + 0.5 * glow) * a });
  return tip;
}

/** The tail's outline: a body tapering from its root to the sting, each
 *  plate bulging a little between its joints. Flat points. */
function outline(segs: Seg[]): number[] {
  const left: number[] = [], right: number[] = [];
  for (let i = 0; i < segs.length - 1; i++) {
    const p = segs[i], q = segs[i + 1];
    for (const f of [0, 0.5]) {
      const x = p.x + (q.x - p.x) * f, y = p.y + (q.y - p.y) * f, h = p.h + (q.h - p.h) * f;
      const w = (p.r + (q.r - p.r) * f) * (f ? 1.12 : 0.85), nx = -Math.sin(h), ny = Math.cos(h);
      left.push(x + nx * w, y + ny * w);
      right.unshift(x - nx * w, y - ny * w);
    }
  }
  const e = segs[segs.length - 1], nx = -Math.sin(e.h), ny = Math.cos(e.h);
  left.push(e.x + nx * e.r * 0.8, e.y + ny * e.r * 0.8);
  right.unshift(e.x - nx * e.r * 0.8, e.y - ny * e.r * 0.8);
  return left.concat(right);
}

/** The tail drawn: a body of blackened plate on the dark layer; on the light
 *  layer its gold rim, a gold seam across each joint, a lit ridge down its
 *  back, and venom-green light in the joints (the crystal's glow running
 *  down it). Returns the barb's tip. */
function drawTail(g: Graphics, segs: Seg[], s: number, a: number, dark: boolean, glow: number): Pt {
  if (a <= 0.02) return segs[segs.length - 1];
  const body = outline(segs);
  if (dark) {
    g.poly(body, true).fill({ color: PLATE, alpha: 0.92 * a });
    return sting(g, segs[segs.length - 1], s, a, true, glow);
  }
  g.poly(body, true).fill({ color: OLD_GOLD, alpha: 0.22 * a }).stroke({ width: 1.5, color: GOLD, alpha: 0.9 * a, join: "round" });
  const ridge: number[] = [];
  for (let i = 0; i < segs.length; i++) {
    const p = segs[i], nx = -Math.sin(p.h), ny = Math.cos(p.h);
    ridge.push(p.x + nx * p.r * 0.45, p.y + ny * p.r * 0.45);
    if (i > 0 && i < segs.length - 1) {
      g.moveTo(p.x + nx * p.r * 0.9, p.y + ny * p.r * 0.9).lineTo(p.x - nx * p.r * 0.9, p.y - ny * p.r * 0.9).stroke({ width: 1.3, color: GOLD, alpha: 0.8 * a });
      g.circle(p.x, p.y, p.r * 0.32).fill({ color: TOXIC, alpha: (0.3 + 0.35 * glow) * a });
    }
  }
  g.poly(ridge, false).stroke({ width: 1.4, color: GOLD_HI, alpha: 0.65 * a, join: "round" });
  return sting(g, segs[segs.length - 1], s, a, false, glow);
}

/** The tail's pose: risen `grow` 0..1, swaying, and — `lash` 0..1 — thrown
 *  forward, uncurling to point down the line at the target. `side` is the
 *  flank it rises from. */
function pose(m: SigMoment, side: number, grow: number, sway: number, lash: number, aim: number): Seg[] {
  const c = centre(m.from), s = m.size, ax = m.ahead.x, ay = m.ahead.y, A = Math.atan2(ay, ax);
  // From the back corner of its card, up its flank and curling in over the
  // front — the sting hanging over its head, as a scorpion carries it,
  // whichever way it faces.
  const base = { x: c.x - ax * s * 0.42 - ay * s * 0.3 * side, y: c.y - ay * s * 0.42 + ax * s * 0.3 * side };
  const h0 = A + side * 0.3;
  let turn = -side * (2.3 - 1.4 * lash) + sway * 0.25;
  // Thrown forward, the last plates swing round to point at the target.
  let d = aim - (h0 + turn);
  while (d > Math.PI) d -= TAU;
  while (d < -Math.PI) d += TAU;
  turn += d * lash * 0.8;
  return tail(base, h0, turn, s * (0.35 + 0.7 * grow) * (1 + 0.2 * lash), s);
}

export const VENOMARCH: Signature = {
  shake: 0.5,
  lunge: false,

  deliver(t: FxTools, m: SigMoment, seconds: number) {
    const s = m.size, T = seconds, main = m.targets[0] ? centre(m.targets[0]) : centre(m.to);
    const side = Math.random() < 0.5 ? -1 : 1;
    const c = centre(m.from), aim = Math.atan2(main.y - c.y, main.x - c.x);
    // RISE 0..0.55T, then the LASH: the tail thrown forward as the venom
    // leaves it, the streak arriving on the landing frame.
    const LASH = T * 0.55, D = T + 0.15;
    const state = (time: number) => {
      const grow = easeOut(clamp01(time / (T * 0.45)));
      const lash = easeIn(clamp01((time - LASH) / (T * 0.18)));
      // It cocks back a touch before it throws.
      const cock = Math.sin(Math.PI * clamp01((time - LASH * 0.75) / (LASH * 0.35))) * (1 - lash);
      return { segs: pose(m, side, grow, Math.sin(time * 9) * (1 - lash) - cock * 0.8 * side, lash, aim), a: clamp01(time / 0.06) * (1 - clamp01((time - T) / 0.15)), glow: Math.min(1, time / LASH) };
    };
    t.draw(D, (g, u) => {
      const st = state(u * D);
      drawTail(g, st.segs, s, st.a, true, st.glow);
    }, { dark: true });
    let drip = 0, tipAt: Pt = c;
    t.draw(D, (g, u, dt) => {
      const time = u * D, st = state(time);
      tipAt = drawTail(g, st.segs, s, st.a, false, st.glow);
      if (time < LASH) {
        drip += dt * 9 * t.quality;
        for (; drip >= 1; drip--) t.spark(tipAt.x, tipAt.y, rand(-10, 10), rand(10, 40), rand(0.3, 0.45), DRIP);
      }
    });
    t.charge(centre(m.from), s * 0.7, TOXIC_DEEP, 0.3, LASH);

    // THE LASH: a green venom streak flung off the sting down the arc of the
    // throw — gold-edged, a barb at its head — to the one it stings. (Any
    // other target is a card its burst will reach, not one it aims at.)
    const F = T - LASH;
    t.later(LASH, () => {
      const from = { ...tipAt };
      m.targets.slice(0, 1).forEach((r, i) => {
        const to = centre(r), dx = to.x - from.x, dy = to.y - from.y, d = Math.hypot(dx, dy) || 1;
        const bow = d * 0.28 * side * (i % 2 ? -0.6 : 1);
        const cp = { x: (from.x + to.x) / 2 - (dy / d) * bow, y: (from.y + to.y) / 2 + (dx / d) * bow };
        const at = (q: number) => ({ x: (1 - q) * (1 - q) * from.x + 2 * (1 - q) * q * cp.x + q * q * to.x, y: (1 - q) * (1 - q) * from.y + 2 * (1 - q) * q * cp.y + q * q * to.y });
        let acc = 0;
        t.draw(F, (g, u, dt) => {
          const q = 0.15 * u + 0.85 * easeIn(u), q0 = Math.max(0, q - 0.45), pts: number[] = [], edge: number[] = [];
          for (let k = 0; k <= 14; k++) {
            const p = at(q0 + ((q - q0) * k) / 14);
            pts.push(p.x, p.y);
          }
          for (let k = 7; k <= 14; k++) edge.push(pts[k * 2], pts[k * 2 + 1]);
          g.poly(pts, false).stroke({ width: s * 0.16, color: TOXIC_DEEP, alpha: 0.3, cap: "round", join: "round" });
          g.poly(pts, false).stroke({ width: s * 0.08, color: GOLD, alpha: 0.35, cap: "round", join: "round" });
          g.poly(pts, false).stroke({ width: s * 0.05, color: TOXIC, alpha: 0.9, cap: "round", join: "round" });
          g.poly(edge, false).stroke({ width: 1.4, color: TOXIC_HI, alpha: 0.95, cap: "round", join: "round" });
          const p = at(q), b = at(Math.max(0, q - 0.04)), h = Math.atan2(p.y - b.y, p.x - b.x);
          const R = s * 0.07, ux = Math.cos(h), uy = Math.sin(h);
          g.poly([p.x + ux * R * 1.4, p.y + uy * R * 1.4, p.x - uy * R * 0.5, p.y + ux * R * 0.5, p.x - ux * R * 0.4, p.y - uy * R * 0.4, p.x + uy * R * 0.5, p.y - ux * R * 0.5], true)
            .fill({ color: GOLD, alpha: 0.85 }).stroke({ width: 1, color: GOLD_HI, alpha: 1 });
          acc += dt * 55 * t.quality;
          for (; acc >= 1; acc--) t.spark(p.x, p.y, rand(-25, 25) * (s / 90), rand(-25, 25) * (s / 90), rand(0.25, 0.4), Math.random() < 0.75 ? DRIP : CHIP);
        });
      });
    });
  },

  land(t: FxTools, m: SigMoment) {
    const s = m.size, from = centre(m.from);
    if (!m.targets.length) return;
    const k0 = Math.max(0.7, Math.min(1.5, (m.power[0] ?? 0.7) + 0.3));
    stingHit(t, m.targets[0], from, s, k0, 0);
    // A kill bursts: the venom it carried flung onto every card beside it.
    // Without one, anything else it reached is only splashed.
    const burst = !!m.killed[0];
    const BURST = 0.3;
    if (burst) t.later(BURST, () => burstOut(t, m.targets[0], m.targets.slice(1), s));
    m.targets.slice(1).forEach((r) => splat(t, r, s, burst ? BURST + 0.17 : 0.08, centre(m.targets[0])));
  },
};

/** The sting going into a card: a sharp puncture where the barb stands, the
 *  venom spreading out through it in forking veins, and a heavy mist that
 *  sinks over it and pools at its foot. */
function stingHit(t: FxTools, r: Box, from: Pt, s: number, k: number, delay: number) {
  const c = centre(r), into = Math.atan2(c.y - from.y, c.x - from.x);
  t.later(delay, () => {
    t.flash(c, TOXIC_HI, 0.35 * k);
    t.ring(r, TOXIC, 0.1, 0.55, 0.25, 2);
    const n = Math.round(10 * k);
    for (let i = 0; i < n; i++) {
      const a = into + Math.PI + rand(-1.1, 1.1), v = rand(120, 260) * (s / 90);
      t.spark(c.x, c.y, Math.cos(a) * v, Math.sin(a) * v - 40 * (s / 90), rand(0.25, 0.45), SPATTER);
    }
  });
  // The barb, standing in the card for a blink after the streak.
  const R = s * 0.08, ux = Math.cos(into), uy = Math.sin(into);
  const barb = (g: Graphics) => g.poly([c.x + ux * R * 0.4, c.y + uy * R * 0.4, c.x - ux * R * 1.4 - uy * R * 0.45, c.y - uy * R * 1.4 + ux * R * 0.45,
    c.x - ux * R * 1.1, c.y - uy * R * 1.1, c.x - ux * R * 1.4 + uy * R * 0.45, c.y - uy * R * 1.4 - ux * R * 0.45], true);
  t.draw(0.3, (g, u) => { barb(g).fill({ color: PLATE, alpha: 0.9 * (1 - u) }); }, { dark: true, delay });
  t.draw(0.3, (g, u) => { barb(g).stroke({ width: 1.3, color: GOLD_HI, alpha: 0.95 * (1 - u) }); }, { delay });
  veins(t, c, s * 0.44 * Math.min(1.2, k), 7, s, delay + 0.03, 0.95);
  mist(t, r, s, k, delay + 0.12);
}

/** Venom spreading from `c` through a card: `n` channels running out, each
 *  forking once, drawn dark (the vein) with green light inside it, a pulse
 *  running out along them as they grow. Over by `D`. */
function veins(t: FxTools, c: Pt, L: number, n: number, s: number, delay: number, D: number) {
  const a0 = rand(0, TAU);
  const paths = Array.from({ length: n }, (_, i) => {
    const pts: Pt[] = [c];
    let h = a0 + (i / n) * TAU + rand(-0.25, 0.25), x = c.x, y = c.y;
    const len = L * rand(0.7, 1.05), N = 6;
    for (let k = 1; k <= N; k++) {
      h += rand(-0.55, 0.55);
      x += Math.cos(h) * (len / N);
      y += Math.sin(h) * (len / N);
      pts.push({ x, y });
    }
    const fk = pts[3], fh = h + (Math.random() < 0.5 ? 0.8 : -0.8), fl = len * 0.35;
    const fork = [fk, { x: fk.x + Math.cos(fh) * fl * 0.5, y: fk.y + Math.sin(fh) * fl * 0.5 }, { x: fk.x + Math.cos(fh + 0.3) * fl, y: fk.y + Math.sin(fh + 0.3) * fl }];
    return { pts, fork };
  });
  const trace = (g: Graphics, grow: number) => {
    for (const p of paths) {
      const upto = grow * (p.pts.length - 1), whole = Math.floor(upto);
      g.moveTo(p.pts[0].x, p.pts[0].y);
      for (let k = 1; k <= whole; k++) g.lineTo(p.pts[k].x, p.pts[k].y);
      if (whole < p.pts.length - 1) {
        const a = p.pts[whole], b = p.pts[whole + 1], f = upto - whole;
        g.lineTo(a.x + (b.x - a.x) * f, a.y + (b.y - a.y) * f);
      }
      if (upto > 3.5) {
        const f = clamp01((upto - 3.5) / 2);
        g.moveTo(p.fork[0].x, p.fork[0].y).lineTo(p.fork[1].x, p.fork[1].y);
        if (f > 0.5) g.lineTo(p.fork[1].x + (p.fork[2].x - p.fork[1].x) * (f - 0.5) * 2, p.fork[1].y + (p.fork[2].y - p.fork[1].y) * (f - 0.5) * 2);
      }
    }
  };
  const grow = (u: number) => easeOut(clamp01((u * D) / 0.32));
  const fade = (u: number) => 1 - clamp01((u * D - D * 0.55) / (D * 0.45));
  t.draw(D, (g, u) => { trace(g, grow(u)); g.stroke({ width: Math.max(2.5, s * 0.045), color: VEIN_DARK, alpha: 0.65 * fade(u), cap: "round", join: "round" }); }, { dark: true, delay });
  t.draw(D, (g, u) => {
    const gr = grow(u), f = fade(u), pulse = 0.7 + 0.3 * Math.sin(u * D * 26);
    trace(g, gr);
    g.stroke({ width: Math.max(4, s * 0.07), color: TOXIC_DEEP, alpha: 0.28 * f, cap: "round", join: "round" });
    trace(g, gr);
    g.stroke({ width: 1.3, color: TOXIC, alpha: 0.95 * f * pulse, cap: "round", join: "round" });
    // The front of each vein, where the venom is still going.
    if (gr < 0.99)
      for (const p of paths) {
        const upto = gr * (p.pts.length - 1), k = Math.floor(upto), a = p.pts[k], b = p.pts[Math.min(k + 1, p.pts.length - 1)], fr = upto - k;
        g.circle(a.x + (b.x - a.x) * fr, a.y + (b.y - a.y) * fr, 2).fill({ color: TOXIC_HI, alpha: f });
      }
    g.circle(c.x, c.y, s * 0.06).fill({ color: TOXIC, alpha: 0.5 * f }).circle(c.x, c.y, s * 0.025).fill({ color: TOXIC_HI, alpha: f });
  }, { delay });
}

/** The heavy mist: green puffs that SINK over the card and spread along its
 *  foot, thickening, then thin away — a gas that settles, not spores. */
function mist(t: FxTools, r: Box, s: number, k: number, delay: number) {
  const c = centre(r), D = 0.95, n = Math.round(8 * Math.max(0.6, t.quality));
  const floor = r.y + r.h * 0.78;
  const puffs = Array.from({ length: n }, (_, i) => ({
    x0: c.x + (i / (n - 1) - 0.5) * s * 0.5, y0: c.y - s * rand(0.25, 0.45), spread: (i / (n - 1) - 0.5) * s * 0.55,
    r: s * rand(0.17, 0.23) * Math.min(1.2, k), ph: rand(0, TAU), low: rand(-0.12, 0.08) * s,
  }));
  t.draw(D, (g, u) => {
    const time = u * D, a = time < 0.15 ? time / 0.15 : 1 - clamp01((time - 0.5) / 0.45);
    const sink = smooth(clamp01(time / 0.55));
    for (const p of puffs) {
      const x = p.x0 + p.spread * sink + Math.sin(time * 4 + p.ph) * s * 0.025, y = p.y0 + (floor + p.low - p.y0) * sink;
      // Sinking, it flattens and spreads: a gas pooling on the floor.
      const rx = p.r * (1 + 0.7 * sink), ry = p.r * (1 - 0.3 * sink);
      g.ellipse(x, y, rx, ry).fill({ color: TOXIC_DEEP, alpha: 0.26 * a }).ellipse(x, y - ry * 0.2, rx * 0.6, ry * 0.5).fill({ color: TOXIC, alpha: 0.13 * a });
    }
    // The pool it settles into, lit along its top.
    const pa = a * sink;
    g.ellipse(c.x, floor, s * 0.5, s * 0.1).fill({ color: TOXIC_DEEP, alpha: 0.2 * pa });
    g.moveTo(c.x - s * 0.42, floor - s * 0.05).quadraticCurveTo(c.x, floor - s * 0.13, c.x + s * 0.42, floor - s * 0.05).stroke({ width: 1.2, color: TOXIC_HI, alpha: 0.35 * pa });
  }, { delay });
}

/** A killed card bursting: a ring of green spatter thrown off it, and a
 *  gobbet of venom flung onto every card beside it. */
function burstOut(t: FxTools, r: Box, near: Box[], s: number) {
  const c = centre(r);
  t.flash(c, TOXIC, 0.6);
  t.ring(r, TOXIC, 0.3, 1.45, 0.45, 4);
  t.ring(r, TOXIC_HI, 0.2, 1.1, 0.3, 2);
  const n = Math.round(22 * Math.max(0.6, t.quality));
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + rand(-0.1, 0.1), v = rand(150, 280) * (s / 90);
    t.spark(c.x, c.y, Math.cos(a) * v, Math.sin(a) * v, rand(0.3, 0.5), SPATTER);
  }
  for (const o of near) {
    const p = centre(o);
    for (let i = 0; i < 4; i++) {
      const vx = (p.x - c.x) / 0.17 + rand(-20, 20), vy = (p.y - c.y) / 0.17 + rand(-20, 20);
      t.spark(c.x, c.y, vx, vy, 0.2, { ...DRIP, gravity: 0, drag: 1 });
    }
  }
}

/** Venom landing on a card that was splashed: a green splat, a few short
 *  veins and drops running off it. */
function splat(t: FxTools, r: Box, s: number, delay: number, from: Pt) {
  const c = centre(r), into = Math.atan2(c.y - from.y, c.x - from.x);
  t.later(delay, () => {
    t.flash(c, TOXIC, 0.3);
    t.glow(r, TOXIC_DEEP, 0.3, 0.5, 0.9);
    for (let i = 0; i < 8; i++) {
      const a = into + rand(-1, 1), v = rand(60, 150) * (s / 90);
      t.spark(c.x, c.y, Math.cos(a) * v, Math.sin(a) * v, rand(0.3, 0.5), DRIP);
    }
  });
  veins(t, c, s * 0.3, 4, s, delay, 0.7);
}
