/** BLUE WHALE — Breach. "Surface under any opponent on the board for 9 DMG and
 *  shove it back 2 spaces." Its Breach surfaces under any foe and shoves it
 *  back.
 *
 *  Its art is a vast luminous blue whale rising through deep blue water, light
 *  rippling down over it, its skin speckled with glowing cyan. It is LIQUID
 *  WATER, never ice. The DELIVERY is the whale sounding: at its own square its
 *  flukes lift out of the water and slip under, rings spreading; then its
 *  shadow — a long dark whale shape, rimmed and speckled in glowing cyan —
 *  glides under the board to the target, its tail beating, the surface over
 *  it dimpling in rings, and the water over the target starts to swell.
 *
 *  The LANDING is the breach. The surface under the card bursts and a huge
 *  column of water stands up out of it, and in it the whale's head rises —
 *  deep blue, the pale grooves of its throat, a glowing eye — a pectoral fin
 *  thrown out to the side. Its rise throws the card back along "ahead" (the
 *  token jumps two squares back as the step lands): a rush of water carries
 *  on to where it lands, and a splash goes up there. Then the head goes back
 *  under and the column crashes down — a ring of white water running out over
 *  the surface, drops falling, bubbles lifting.
 *
 *  The whale itself is solid — deep blue on the normal-blend layer, lit along
 *  its edges like the art — so it reads as a body over a card and over an
 *  empty square; the water round it is light. */
import { centre, rand } from "../../looks/base";
import type { Graphics } from "pixi.js";
import type { FxTools, Pt, SparkStyle } from "../../looks/types";
import type { Signature, SigMoment } from "../types";

type Box = SigMoment["from"];

const TAU = Math.PI * 2;
// The whale, solid: a deep sea-blue body, a lighter throat, the abyss for its
// shadow under the board.
const BODY = 0x163f8f, THROAT = 0x2c6cc4, SHADOW = 0x020b22;
// Light (additive): its glow and speckles, the water.
const LUM = 0x55dcff, GLOW = 0x2f8cff, BLUE = 0x3f8fe8, PALE = 0xbfefff, WHITE = 0xf2fcff;
/** Drops thrown off the breach: round, heavy, falling, white to blue. */
const DROP: SparkStyle = { palette: [WHITE, PALE, BLUE, 0x1f4fa8], gravity: 1000, drag: 0.6, size: [7, 3], streak: false };
/** Spray off the column's top: lighter, slower. */
const MIST: SparkStyle = { palette: [WHITE, PALE, LUM], gravity: 500, drag: 0.5, size: [5, 2], streak: false };
/** Bubbles lifting off where it went back under. */
const BUBBLE: SparkStyle = { palette: [WHITE, PALE, LUM], gravity: -120, drag: 0.6, size: [4, 2], streak: false };

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeOut = (x: number) => 1 - (1 - x) * (1 - x);
const smooth = (x: number) => x * x * (3 - 2 * x);

// ── The whale ────────────────────────────────────────────────────────────────

/** The whale seen from above, under the water: centred on `c`, nose along
 *  `ang`, `L` long and `W` across, its tail swinging with `beat`. A long
 *  rounded body tapering to the tail stock, and the flukes spread across its
 *  end. Flat points. */
function whaleFrom(c: Pt, ang: number, L: number, W: number, beat: number): number[] {
  const dx = Math.cos(ang), dy = Math.sin(ang), nx = -dy, ny = dx;
  const S = (u: number, side: number) => {
    const sway = W * 0.45 * u * u * beat;
    return { x: c.x + dx * (0.5 - u) * L + nx * (sway + side), y: c.y + dy * (0.5 - u) * L + ny * (sway + side) };
  };
  const half = (u: number) => (W / 2) * (u < 0.12 ? 0.85 * Math.sqrt(u / 0.12) : u < 0.35 ? 0.85 + (0.15 * (u - 0.12)) / 0.23 : 1 - (0.85 * (u - 0.35)) / 0.5);
  const left: number[] = [], right: number[] = [];
  for (let i = 0; i <= 14; i++) {
    const u = (0.86 * i) / 14, l = S(u, half(u)), r = S(u, -half(u));
    left.push(l.x, l.y);
    right.unshift(r.x, r.y);
  }
  const tip = (side: number) => S(1.02, side * W * 0.85), notch = S(0.94, 0), root = (side: number) => S(0.88, side * W * 0.12);
  const fl = [tip(1), notch, tip(-1), root(-1)];
  return left.concat(...fl.map((p) => [p.x, p.y]), right);
}

/** Its flukes, upright on the water at `b`, `H` tall: a stock rising out of
 *  the water and two broad lobes spread across its top. Flat points. */
function flukes(b: Pt, H: number): number[] {
  const w = H * 0.85, pts: number[] = [];
  const P = (x: number, y: number) => pts.push(b.x + x, b.y - y);
  P(-H * 0.1, 0);
  P(-H * 0.08, H * 0.55);
  P(-w * 0.55, H * 0.72);
  P(-w, H * 1.0);
  P(-w * 0.6, H * 0.98);
  P(-w * 0.2, H * 0.82);
  P(0, H * 0.9);
  P(w * 0.2, H * 0.82);
  P(w * 0.6, H * 0.98);
  P(w, H * 1.0);
  P(w * 0.55, H * 0.72);
  P(H * 0.08, H * 0.55);
  P(H * 0.1, 0);
  return pts;
}

/** Its head breaching, seen from the side: rising out of the water at `b`,
 *  `L` tall, leaning `lean` (radians off upright), its throat on `side`. The
 *  long head tapering to the snout, the pale pleated throat bulging on its
 *  underside, the line of its mouth running back from the snout, the eye at
 *  its end, the ridge down the top of its head, and a long pectoral fin
 *  thrown out. Shapes in screen space. */
function head(b: Pt, L: number, lean: number, side: number) {
  const ca = Math.cos(lean), sa = Math.sin(lean);
  const P = (x: number, y: number): Pt => ({ x: b.x + x * L * side * ca + y * L * sa, y: b.y + x * L * side * sa - y * L * ca });
  const poly = (pts: Array<[number, number]>) => pts.flatMap(([x, y]) => {
    const p = P(x, y);
    return [p.x, p.y];
  });
  const body = poly([[-0.26, 0], [-0.25, 0.4], [-0.21, 0.7], [-0.15, 0.87], [-0.08, 0.97], [0.01, 1], [0.1, 0.96], [0.2, 0.84], [0.29, 0.62], [0.35, 0.34], [0.37, 0]]);
  const throat = poly([[0.37, 0], [0.35, 0.34], [0.29, 0.62], [0.2, 0.84], [0.1, 0.96], [0.07, 0.86], [0.14, 0.6], [0.18, 0.3], [0.18, 0]]);
  const pleats = [0, 1, 2, 3].map((i) => [P(0.21 + 0.045 * i, 0.03), P(0.11 + 0.045 * i, 0.82 - 0.12 * i)]);
  const mouth = [P(0.06, 0.97), P(0.0, 0.72), P(-0.02, 0.5)];
  const ridge = [P(-0.04, 0.97), P(-0.13, 0.62)];
  const fin = poly([[0.3, 0.44], [0.55, 0.36], [0.8, 0.18], [0.88, 0.1], [0.62, 0.2], [0.32, 0.3]]);
  const spots = [[-0.19, 0.2], [-0.2, 0.35], [-0.16, 0.48], [-0.18, 0.6], [-0.12, 0.74], [-0.22, 0.08]].map(([x, y]) => P(x, y));
  return { body, throat, pleats, mouth, ridge, fin, spots, eye: P(-0.04, 0.47) };
}

/** Rings dimpling the surface: each spreads from where it was dropped. */
interface Dimple { x: number; y: number; at: number; r: number }

function dimples(g: Graphics, list: Dimple[], now: number, life: number, alpha: number) {
  for (const d of list) {
    const q = (now - d.at) / life;
    if (q < 0 || q >= 1) continue;
    const r = d.r * (0.25 + 0.75 * easeOut(q));
    g.ellipse(d.x, d.y, r, r * 0.4).stroke({ width: 2 - q, color: q < 0.4 ? PALE : BLUE, alpha: 0.8 * (1 - q) * alpha });
  }
}

/** Where the card it shoves comes down: two squares back along `ahead`,
 *  kept on the board. */
function shovedTo(m: SigMoment, p: Pt): Pt {
  const s = m.size, step = s * 1.08, b = m.board;
  const x = p.x + m.ahead.x * step * 2, y = p.y + m.ahead.y * step * 2;
  return { x: Math.max(b.x + s / 2, Math.min(b.x + b.w - s / 2, x)), y: Math.max(b.y + s / 2, Math.min(b.y + b.h - s / 2, y)) };
}

export const BLUE_WHALE: Signature = {
  shake: 1.6,
  // It never leaves its square: it is the water under the target that moves.
  lunge: false,

  deliver(t: FxTools, m: SigMoment, seconds: number) {
    const s = m.size, T = seconds, c = centre(m.from), sc = s / 90;
    const to = m.targets.length ? centre(m.targets[0]) : { x: c.x + m.ahead.x * s * 2, y: c.y + m.ahead.y * s * 2 };
    // IT SOUNDS: the flukes lift out of the water at its square and slip
    // under, rings spreading from where they went.
    const FL = T * 0.45;
    const fl = (u: number) => {
      const up = easeOut(clamp01(u / 0.35)), down = clamp01((u - 0.45) / 0.55);
      return { H: s * 0.42 * up * (1 - down * down), y: s * 0.22 * down, a: 1 - down };
    };
    const base = { x: c.x, y: c.y + s * 0.18 };
    t.draw(FL, (g, u) => {
      const q = fl(u);
      if (q.H > 1.5) g.poly(flukes({ x: base.x, y: base.y + q.y }, q.H), true).fill({ color: BODY, alpha: q.a });
    }, { dark: true });
    t.draw(FL, (g, u) => {
      const q = fl(u);
      if (q.H > 1.5) g.poly(flukes({ x: base.x, y: base.y + q.y }, q.H), true).stroke({ width: 1.5, color: LUM, alpha: 0.9 * q.a });
      g.ellipse(base.x, base.y, s * 0.3, s * 0.1).stroke({ width: 2, color: PALE, alpha: 0.7 * q.a });
    });
    t.later(FL * 0.25, () => {
      for (let i = 0; i < Math.round(8 * t.quality); i++)
        t.spark(base.x + rand(-0.3, 0.3) * s, base.y - s * 0.38, rand(-30, 30) * sc, rand(-20, 30) * sc, rand(0.3, 0.45), DROP);
    });
    // THE SHADOW gliding under the board to the target, its tail beating, the
    // surface over it dimpling.
    const G0 = T * 0.2, ang = Math.atan2(to.y - c.y, to.x - c.x);
    const pos = (time: number) => {
      const q = smooth(clamp01((time - G0) / (T - G0)));
      return { x: c.x + (to.x - c.x) * q, y: c.y + (to.y - c.y) * q };
    };
    const L = s * 1.4, W = s * 0.5, vis = (time: number) => clamp01((time - G0 * 0.6) / (T * 0.2));
    t.draw(T, (g, u) => {
      const time = u * T, p = pos(time), a = vis(time);
      if (a > 0.01) g.poly(whaleFrom(p, ang, L, W, Math.sin(time * 14)), true).fill({ color: SHADOW, alpha: 0.6 * a });
    }, { dark: true });
    const rings: Dimple[] = [];
    let drop = 0;
    t.draw(T + 0.25, (g, u, dt) => {
      const time = u * (T + 0.25), a = vis(time);
      if (time < T) {
        const p = pos(time), pts = whaleFrom(p, ang, L, W, Math.sin(time * 14));
        g.poly(pts, true).fill({ color: GLOW, alpha: 0.1 * a }).stroke({ width: 1.6, color: LUM, alpha: 0.55 * a });
        // The glowing speckles down its back.
        for (let i = 0; i < 6; i++) {
          const v = 0.12 + i * 0.11, sway = W * 0.45 * v * v * Math.sin(time * 14);
          const x = p.x + Math.cos(ang) * (0.5 - v) * L - Math.sin(ang) * sway, y = p.y + Math.sin(ang) * (0.5 - v) * L + Math.cos(ang) * sway;
          g.circle(x, y, s * 0.02).fill({ color: LUM, alpha: 0.8 * a });
        }
        if (time > G0) {
          drop += dt * 14;
          for (; drop >= 1; drop--) rings.push({ x: p.x + rand(-0.2, 0.2) * s, y: p.y + rand(-0.2, 0.2) * s, at: time, r: s * rand(0.3, 0.45) });
        }
      }
      dimples(g, rings, time, 0.4, 1);
      // The water over the target swelling as it comes.
      const sw = clamp01((time - T * 0.55) / (T * 0.45)) * (1 - clamp01((time - T) / 0.25));
      if (sw > 0) {
        g.ellipse(to.x, to.y + s * 0.25, s * (0.5 - 0.1 * sw), s * (0.2 - 0.04 * sw)).stroke({ width: 2.5, color: PALE, alpha: 0.8 * sw });
        g.ellipse(to.x, to.y + s * 0.25, s * 0.35, s * 0.13).fill({ color: LUM, alpha: 0.18 * sw });
      }
    });
    t.charge(to, s * 0.9, LUM, 0.3, T);
  },

  land(t: FxTools, m: SigMoment) {
    if (!m.targets.length) return;
    const s = m.size, r = m.targets[0], p = centre(r), sc = s / 90, k = Math.max(0.8, Math.min(1.6, m.power[0] ?? 1));
    const base = { x: p.x, y: p.y + s * 0.3 }, dest = shovedTo(m, p), side = Math.abs(m.ahead.x) > 0.5 ? Math.sign(m.ahead.x) : 1;
    const L = s * 1.3 * Math.min(1.15, 0.85 + 0.2 * k);
    // THE BREACH: the surface bursts...
    t.flash(base, PALE, 0.2 * k);
    t.ring(r, WHITE, 0.3, 1.15, 0.35, 3);
    for (let i = 0; i < Math.round(18 * k); i++) {
      const a = -Math.PI / 2 + rand(-0.7, 0.7), v = rand(220, 420) * sc;
      t.spark(base.x + rand(-0.3, 0.3) * s, base.y - rand(0, 0.2) * s, Math.cos(a) * v, Math.sin(a) * v, rand(0.45, 0.7), i % 3 ? DROP : MIST);
    }
    // ...the whale's head rises in a column of water, leans over as it
    // throws the card, and goes back under.
    const D = 0.75, UP = 0.16, TOP = 0.4, DOWN = 0.62;
    const pose = (time: number) => {
      const rise = time < UP ? easeOut(time / UP) : time < TOP ? 1 : time < DOWN ? 1 - smooth((time - TOP) / (DOWN - TOP)) : 0;
      return { rise, lean: side * (0.15 + 0.25 * smooth(clamp01((time - UP * 0.6) / (TOP - UP * 0.6)))), a: time < DOWN ? 1 : 0 };
    };
    const col = (time: number) => {
      const up = easeOut(clamp01(time / 0.14)), fall = clamp01((time - TOP) / (D - TOP));
      return { H: s * 1.55 * up * (1 - fall * fall), w: s * (0.42 + 0.25 * fall), a: 1 - fall };
    };
    /** Where its head comes out of the water: under the card, set back
     *  against its lean so the head stands over the card, not beside it. */
    const rootOf = (q: ReturnType<typeof pose>) => ({ x: base.x - Math.sin(q.lean) * L * q.rise * 0.45 - side * L * 0.05, y: base.y + L * 0.3 * (1 - q.rise) });
    t.draw(D, (g, u) => {
      const q = pose(u * D);
      if (q.rise < 0.03) return;
      const h = head(rootOf(q), L * q.rise, q.lean, side);
      g.poly(h.fin, true).fill({ color: BODY, alpha: q.a });
      g.poly(h.body, true).fill({ color: BODY, alpha: q.a });
      g.poly(h.throat, true).fill({ color: THROAT, alpha: q.a });
    }, { dark: true });
    let mist = 0;
    t.draw(D, (g, u, dt) => {
      const time = u * D, q = pose(time), cl = col(time);
      // The column, light and streaming up round the whale.
      if (cl.H > 2) {
        const pts: number[] = [];
        for (let i = 0; i <= 8; i++) {
          const v = i / 8, w = cl.w * (1 - 0.35 * v) + s * 0.03 * Math.sin(v * 9 + time * 30);
          pts.push(base.x - w, base.y - cl.H * v);
        }
        for (let i = 8; i >= 0; i--) {
          const v = i / 8, w = cl.w * (1 - 0.35 * v) + s * 0.03 * Math.sin(v * 7 - time * 26 + 2);
          pts.push(base.x + w, base.y - cl.H * v);
        }
        g.poly(pts, true).fill({ color: BLUE, alpha: 0.14 * cl.a });
        g.poly(pts.slice(0, 18), false).stroke({ width: 2, color: PALE, alpha: 0.75 * cl.a });
        g.poly(pts.slice(18), false).stroke({ width: 2, color: PALE, alpha: 0.75 * cl.a });
        // Its top bursting open: fingers of water flung up and out.
        for (let j = 0; j < 5; j++) {
          const f = j / 4 - 0.5, x = base.x + f * cl.w * 1.3, y = base.y - cl.H;
          g.moveTo(x, y + s * 0.05).quadraticCurveTo(x + f * s * 0.2, y - s * 0.12, x + f * s * 0.45, y - s * (0.1 + 0.08 * Math.cos(f * 3)))
            .stroke({ width: 2, color: WHITE, alpha: 0.7 * cl.a, cap: "round" });
        }
        for (let j = 0; j < 4; j++) {
          const x = base.x + cl.w * (-0.6 + 0.4 * j), y0 = base.y - cl.H * ((time * 3 + j * 0.3) % 1) * 0.8;
          g.moveTo(x, y0).lineTo(x, y0 - s * 0.25).stroke({ width: 1.5, color: WHITE, alpha: 0.5 * cl.a });
        }
        mist += dt * 50 * t.quality * cl.a;
        for (; mist >= 1; mist--) {
          const a = -Math.PI / 2 + rand(-1.2, 1.2), v = rand(60, 160) * sc;
          t.spark(base.x + rand(-0.6, 0.6) * cl.w, base.y - cl.H, Math.cos(a) * v, Math.sin(a) * v, rand(0.35, 0.55), MIST);
        }
      }
      if (q.rise < 0.03) return;
      // The whale lit as the art is: a cyan rim, speckles, the pale grooves
      // of its throat, its mouth line, a glowing eye.
      const h = head(rootOf(q), L * q.rise, q.lean, side), a = q.a;
      g.poly(h.body, true).stroke({ width: 5, color: GLOW, alpha: 0.25 * a });
      g.poly(h.body, true).stroke({ width: 1.6, color: LUM, alpha: 0.95 * a });
      g.poly(h.fin, true).stroke({ width: 1.4, color: LUM, alpha: 0.85 * a });
      for (const [g0, g1] of h.pleats) g.moveTo(g0.x, g0.y).lineTo(g1.x, g1.y).stroke({ width: 1.2, color: PALE, alpha: 0.55 * a });
      g.moveTo(h.mouth[0].x, h.mouth[0].y).quadraticCurveTo(h.mouth[1].x, h.mouth[1].y, h.mouth[2].x, h.mouth[2].y).stroke({ width: 1.6, color: PALE, alpha: 0.85 * a });
      g.moveTo(h.ridge[0].x, h.ridge[0].y).lineTo(h.ridge[1].x, h.ridge[1].y).stroke({ width: 1.2, color: LUM, alpha: 0.5 * a });
      g.circle(h.eye.x, h.eye.y, s * 0.055 * q.rise).fill({ color: LUM, alpha: 0.45 * a }).circle(h.eye.x, h.eye.y, s * 0.024 * q.rise).fill({ color: WHITE, alpha: a });
      for (const sp of h.spots) g.circle(sp.x, sp.y, s * 0.016).fill({ color: LUM, alpha: 0.85 * a });
      // White water boiling round it where it comes out.
      g.ellipse(base.x, base.y, s * 0.5, s * 0.14).fill({ color: PALE, alpha: 0.22 * a }).stroke({ width: 3, color: WHITE, alpha: 0.85 * a });
    });
    // THE SHOVE: thrown back along "ahead", a rush of water carrying on to
    // where the card comes down, and a splash there.
    const SH = 0.1, RUN = 0.24;
    t.draw(RUN + 0.3, (g, u) => {
      const time = u * (RUN + 0.3), q = easeOut(clamp01(time / RUN)), a = 1 - clamp01((time - RUN) / 0.3);
      const hx = p.x + (dest.x - p.x) * q, hy = p.y + (dest.y - p.y) * q, tl = Math.max(0, q - 0.55);
      const tx = p.x + (dest.x - p.x) * tl, ty = p.y + (dest.y - p.y) * tl, nx = -m.ahead.y, ny = m.ahead.x;
      for (const o of [-0.22, 0, 0.22]) {
        g.moveTo(tx + nx * o * s, ty + ny * o * s).lineTo(hx + nx * o * s * 0.6, hy + ny * o * s * 0.6)
          .stroke({ width: o === 0 ? 4 : 2, color: o === 0 ? PALE : LUM, alpha: (o === 0 ? 0.6 : 0.8) * a, cap: "round" });
      }
      if (time < RUN) g.circle(hx, hy, s * 0.14).fill({ color: LUM, alpha: 0.25 * a }).circle(hx, hy, s * 0.06).fill({ color: WHITE, alpha: 0.9 * a });
    }, { delay: SH });
    t.later(SH + RUN, () => {
      const box = { x: dest.x - s / 2, y: dest.y - s / 2, w: s, h: s };
      t.ring(box, PALE, 0.3, 1.0, 0.35, 2.5);
      for (let i = 0; i < Math.round(10 * t.quality); i++) {
        const a = -Math.PI / 2 + rand(-1.2, 1.2), v = rand(90, 200) * sc;
        t.spark(dest.x + rand(-0.25, 0.25) * s, dest.y + s * 0.2, Math.cos(a) * v, Math.sin(a) * v, rand(0.35, 0.5), DROP);
      }
    });
    // THE CRASH: the column comes down in a ring of white water running out
    // over the surface, drops falling round it, bubbles lifting after.
    t.later(DOWN - 0.04, () => crash(t, r, base, s, k, m.killed[0]));
  },
};

/** The column coming down: white water ringing out flat across the surface,
 *  a fall of drops, and bubbles rising where the whale went under (more, and
 *  a deeper glow, when the card it surfaced under did not come back up). */
function crash(t: FxTools, r: Box, base: Pt, s: number, k: number, killed: boolean) {
  const sc = s / 90;
  t.draw(0.45, (g, u) => {
    for (let i = 0; i < 3; i++) {
      const q = clamp01(u * 1.3 - i * 0.15);
      if (q <= 0 || q >= 1) continue;
      const R = s * (0.3 + 0.9 * easeOut(q));
      g.ellipse(base.x, base.y, R, R * 0.38).stroke({ width: 3 - 2 * q, color: i === 0 ? WHITE : PALE, alpha: 0.9 * (1 - q) });
    }
  });
  for (let i = 0; i < Math.round(16 * k); i++) {
    const a = rand(0, TAU), v = rand(80, 220) * sc;
    t.spark(base.x + Math.cos(a) * s * 0.3, base.y - s * rand(0.2, 0.9), Math.cos(a) * v, rand(-80, 40) * sc, rand(0.35, 0.55), DROP);
  }
  const n = Math.round((killed ? 14 : 7) * t.quality);
  for (let i = 0; i < n; i++)
    t.later(rand(0.05, 0.3), () => t.spark(base.x + rand(-0.35, 0.35) * s, base.y - rand(0, 0.2) * s, rand(-10, 10) * sc, -rand(30, 70) * sc, rand(0.4, 0.6), BUBBLE));
  if (killed) t.glow(r, GLOW, 0.35, 0.5, 1.1);
}
