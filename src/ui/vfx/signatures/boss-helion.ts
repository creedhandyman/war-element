/** HELION — Solar Lance. "Fires down the column it stands in: 22 DMG to every
 *  opponent in the lane, straight through shields." Lore: "It has already
 *  chosen your lane. Walking there was the courtesy."
 *
 *  The DELIVERY is the sun gathering into a lance. A sun kindles on the siege
 *  engine — a gold disc in a turning corona, light pulled in to it — and a
 *  spear of light grows out of its front edge; and down the lane ahead a thin
 *  gold line is already drawn, glints running along it, the lane chosen.
 *
 *  The LANDING is the lance fired: a column of light down the WHOLE lane to
 *  the board's edge, near a square wide, white at its heart — not a shot at
 *  one card but the lane itself set alight. Every card in it is burned
 *  through as the light passes (it does not stop at shields, and neither does
 *  the column: it goes on past each one): a flare on it, light thrown out
 *  sideways off it, a scorch left on its face. When the light goes out it
 *  leaves the lane scorched — a trench of burned ground with a glowing lip —
 *  and heat shimmering up off it.
 *
 *  DAWN's gold, drawn straight — light does not bend — and with its BORE half
 *  in the ground it leaves: a siege engine's shot marks the earth. */
import type { Graphics } from "pixi.js";
import { centre, lerpPt, rand } from "../looks/base";
import type { FxTools, Pt, SparkStyle } from "../looks/types";
import type { Signature, SigMoment } from "./types";

type Box = { x: number; y: number; w: number; h: number };

const TAU = Math.PI * 2;
const WHITE = 0xffffff, PALE = 0xfff1b3, GOLD = 0xffd54f, DEEP = 0xe0a41c, WARM = 0xffe38a;
/** Burned ground (normal blend). */
const SCORCH = 0x1c1004;
/** Light thrown off a card the lance burns through: fast, straight. */
const SCATTER: SparkStyle = { palette: [WHITE, PALE, GOLD, DEEP], gravity: 0, drag: 0.08, size: [7, 2], streak: true };
/** Light pulled in to the sun as it gathers. */
const INFALL: SparkStyle = { palette: [DEEP, GOLD, PALE, WHITE], gravity: 0, drag: 1, size: [3, 6], streak: true };
/** Embers of the scorched lane, drifting up. */
const ASH: SparkStyle = { palette: [PALE, GOLD, DEEP], gravity: -50, drag: 0.6, size: [5, 2], streak: false };
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeOut = (x: number) => 1 - (1 - x) * (1 - x);

/** The lance's run: out in FIRE s, held to HOLD, gone by GONE. */
const FIRE = 0.07, HOLD = 0.3, GONE = 0.52;

/** The lane: from the engine's front edge straight along `ahead` to where
 *  that line leaves the board. */
function laneOf(m: SigMoment) {
  const c = centre(m.from), s = m.size, A = m.ahead, b = m.board;
  const a = { x: c.x + A.x * s * 0.46, y: c.y + A.y * s * 0.46 };
  // How far along `ahead` until the board's edge.
  const reach = (p: number, d: number, lo: number, hi: number) => (d > 1e-6 ? (hi - p) / d : d < -1e-6 ? (lo - p) / d : Infinity);
  const len = Math.max(s, Math.min(reach(a.x, A.x, b.x, b.x + b.w), reach(a.y, A.y, b.y, b.y + b.h)));
  return { a, b: { x: a.x + A.x * len, y: a.y + A.y * len }, len, A, c };
}

/** A four-point star (`r` along `rot`, `r2` across), pinched to `w`. */
function star(g: Graphics, x: number, y: number, r: number, r2: number, w: number, rot: number, color: number, alpha: number) {
  if (alpha <= 0.01 || (r < 0.5 && r2 < 0.5)) return;
  const pts: number[] = [];
  for (let i = 0; i < 8; i++) {
    const a = rot + (i * Math.PI) / 4, d = i % 2 ? w : i % 4 === 0 ? r : r2;
    pts.push(x + Math.cos(a) * d, y + Math.sin(a) * d);
  }
  g.poly(pts).fill({ color, alpha });
}

/** The sun on the engine: a gold disc, white at the heart, in a corona of
 *  long and short rays turned by `spin`. */
function sun(g: Graphics, c: Pt, R: number, spin: number, rays: number, alpha: number) {
  if (alpha <= 0.01) return;
  g.circle(c.x, c.y, R * 1.6).fill({ color: DEEP, alpha: 0.18 * alpha });
  for (let i = 0; i < 16; i++) {
    const a = spin + (i / 16) * TAU, l = R * (1.15 + rays * (i % 2 ? 0.55 : 1.1));
    const ca = Math.cos(a), sa = Math.sin(a), hw = R * 0.12;
    g.poly([c.x + ca * R * 0.9 - sa * hw, c.y + sa * R * 0.9 + ca * hw, c.x + ca * l, c.y + sa * l, c.x + ca * R * 0.9 + sa * hw, c.y + sa * R * 0.9 - ca * hw])
      .fill({ color: GOLD, alpha: 0.6 * alpha });
  }
  g.circle(c.x, c.y, R).fill({ color: GOLD, alpha: 0.55 * alpha }).stroke({ width: 2, color: WARM, alpha: 0.9 * alpha });
  g.circle(c.x, c.y, R * 0.6).fill({ color: PALE, alpha: 0.7 * alpha });
  g.circle(c.x, c.y, R * 0.3).fill({ color: WHITE, alpha: 0.9 * alpha });
}

/** A spear of light from `a` to `b`: needle-pointed at `b`, swelling just
 *  behind the point, thinning back to `a`. */
function spear(g: Graphics, a: Pt, b: Pt, w: number, color: number, alpha: number) {
  const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy);
  if (len < 1 || alpha <= 0.01) return;
  const ux = dx / len, uy = dy / len, back = Math.min(len * 0.35, w * 2.5);
  const sx = b.x - ux * back, sy = b.y - uy * back, hx = (-uy * w) / 2, hy = (ux * w) / 2;
  g.poly([a.x, a.y, sx + hx, sy + hy, b.x, b.y, sx - hx, sy - hy]).fill({ color, alpha });
}

/** A card the lance burns through: a flare on it, a ring, light scattered
 *  off it sideways across the lane, and a scorch left on its face. */
function sear(t: FxTools, r: Box, power: number, s: number, A: Pt, killed: boolean) {
  const c = centre(r), k = Math.max(0.8, Math.min(2, power));
  t.draw(0.5, (g, u) => {
    const a = Math.pow(1 - u, 1.3), grow = 0.5 + 0.5 * Math.min(1, u * 8);
    // Wide across the lane: the light spills out of the column at the card.
    const rot = Math.atan2(A.y, A.x) + Math.PI / 2;
    star(g, c.x, c.y, s * 0.75 * k * grow, s * 0.32 * grow, s * 0.05, rot, GOLD, 0.45 * a);
    star(g, c.x, c.y, s * 0.6 * k * grow, s * 0.26 * grow, s * 0.025, rot, WHITE, a);
  });
  t.ring(r, WARM, 0.3, 1.25 * Math.min(1.4, k), 0.4, 4);
  t.glow(r, GOLD, 0.45, 0.45, 1.1);
  const n = Math.round(10 * Math.min(1.5, k) * Math.max(0.5, t.quality));
  for (let i = 0; i < n; i++) {
    const side = i % 2 ? 1 : -1, a = Math.atan2(A.y, A.x) + side * (Math.PI / 2) + rand(-0.35, 0.35), v = rand(260, 460) * (s / 90);
    t.spark(c.x, c.y, Math.cos(a) * v, Math.sin(a) * v, rand(0.18, 0.32), SCATTER);
  }
  // The scorch on its face, glowing at the edge as it cools.
  const D = killed ? 1.1 : 0.9;
  t.draw(D, (g, u) => {
    g.ellipse(c.x, c.y, s * 0.26, s * 0.3).fill({ color: SCORCH, alpha: 0.45 * Math.min(1, u * 10) * (1 - u) });
  }, { dark: true, delay: 0.05 });
  t.draw(D, (g, u) => {
    g.ellipse(c.x, c.y, s * 0.26, s * 0.3).stroke({ width: 2, color: u < 0.4 ? PALE : DEEP, alpha: 0.8 * Math.min(1, u * 10) * (1 - u) });
  }, { delay: 0.05 });
}

export const HELION: Signature = {
  shake: 1.9,

  deliver(t: FxTools, m: SigMoment, seconds: number) {
    const s = m.size, T = seconds, L = laneOf(m), c = L.c;
    const spin0 = rand(0, TAU);
    // THE SUN GATHERING on the engine, and a lance growing out of its front
    // edge — while down the lane a line is already drawn: chosen.
    const glints = [0, 0.33, 0.66];
    t.draw(T, (g, u) => {
      const time = u * T, k = easeOut(u);
      sun(g, c, s * (0.2 + 0.1 * k), spin0 + time * 2.2, 0.3 + 0.5 * k, Math.min(1, u * 4));
      const tip = { x: L.a.x + L.A.x * s * 0.9 * k * k, y: L.a.y + L.A.y * s * 0.9 * k * k };
      spear(g, c, tip, s * 0.22 * k, GOLD, 0.45 * k);
      spear(g, c, tip, s * 0.09 * k, WHITE, 0.9 * k);
      // The lane marked: the whole of it faintly lit, and a hairline
      // brightening all the way down it...
      g.moveTo(L.a.x, L.a.y).lineTo(L.b.x, L.b.y).stroke({ width: s * 0.9, color: DEEP, alpha: 0.07 * k })
        .stroke({ width: 5, color: GOLD, alpha: 0.14 * k }).stroke({ width: 1.5, color: WARM, alpha: 0.7 * k });
      // ...with glints running along it, away from the engine.
      for (const g0 of glints) {
        const f = (g0 + time * 1.6) % 1, p = lerpPt(L.a, L.b, f), gr = s * 0.1 * Math.sin(Math.PI * f) * k;
        star(g, p.x, p.y, gr, gr, gr * 0.12, 0, WHITE, 0.9);
      }
    });
    t.charge(c, s * 1.5, GOLD, 0.6, T);
    // Light pulled in to the sun from all round, each mote timed to reach it.
    let acc = 0;
    t.draw(T, (_g, u, dt) => {
      if (u > 0.9) return;
      acc += dt * 70 * t.quality;
      for (; acc >= 1; acc--) {
        const a = rand(0, TAU), R = s * rand(0.7, 1.4), life = rand(0.18, 0.3);
        const x = c.x + Math.cos(a) * R, y = c.y + Math.sin(a) * R;
        t.spark(x, y, (c.x - x) / life, (c.y - y) / life, life, INFALL);
      }
    });
  },

  land(t: FxTools, m: SigMoment) {
    const s = m.size, L = laneOf(m), c = L.c;
    const k = Math.max(1, Math.min(1.3, Math.max(0.8, ...m.power)));
    // THE LANCE: down the whole lane, out in two frames, held while it sears,
    // then drawn in to a thread and gone.
    t.draw(GONE, (g, u) => {
      const time = u * GONE;
      const head = lerpPt(L.a, L.b, clamp01(time / FIRE));
      const thin = time < HOLD ? 1 : Math.pow(1 - (time - HOLD) / (GONE - HOLD), 1.4);
      const w = s * 0.62 * k * thin * (1 + 0.05 * Math.sin(time * 70));
      const beam = (width: number, color: number, alpha: number) =>
        g.moveTo(L.a.x, L.a.y).lineTo(head.x, head.y).stroke({ width, color, alpha });
      // Graded layers, wide and faint to narrow and white: a falloff, not a
      // stack of flat bands.
      beam(w * 1.7, DEEP, 0.08 * thin);
      beam(w * 1.35, DEEP, 0.1 * thin);
      beam(w, GOLD, 0.2 * thin);
      beam(w * 0.72, GOLD, 0.22 * thin);
      beam(w * 0.48, PALE, 0.45 * thin);
      beam(Math.max(1.5, w * 0.24), WHITE, thin);
      // Light pouring down it: bright bands running from the engine outward.
      if (time > FIRE)
        for (let i = 0; i < 4; i++) {
          const f = (i / 4 + time * 2.6) % 1, p0 = lerpPt(L.a, L.b, Math.max(0, f - 0.08)), p1 = lerpPt(L.a, L.b, f);
          g.moveTo(p0.x, p0.y).lineTo(p1.x, p1.y).stroke({ width: w * 0.5, color: WHITE, alpha: 0.35 * thin * Math.sin(Math.PI * f) });
        }
      // The engine discharging, and the point of the lance while it runs out.
      const cf = clamp01(1 - time / 0.3);
      if (cf > 0) {
        sun(g, c, s * 0.3 * (0.6 + 0.4 * cf), time * 3, 0.9 * cf, cf);
        star(g, L.a.x, L.a.y, s * 0.9 * cf, s * 0.9 * cf, s * 0.06, 0, WHITE, cf);
      }
      if (time < FIRE) star(g, head.x, head.y, s * 0.45, s * 0.45, s * 0.05, 0, WHITE, 1);
    });
    t.flash(L.a, PALE, 0.55 * (s / 90));
    t.ring(m.from, WARM, 0.5, 2.2, 0.5, 6);

    // Every card in the lane burned through as the light passes it.
    m.targets.forEach((r, i) => {
      const p = centre(r), f = clamp01(((p.x - L.a.x) * L.A.x + (p.y - L.a.y) * L.A.y) / L.len);
      t.later(FIRE * f, () => sear(t, r, m.power[i] ?? 1, s, L.A, !!m.killed[i]));
    });

    // THE SCORCHED LANE: a trench of burned ground with a glowing lip, left
    // as the light goes out...
    const D = 1.05, W = s * 0.34;
    const nx = -L.A.y, ny = L.A.x;
    const edge = (side: number) => [L.a.x + nx * W * side, L.a.y + ny * W * side, L.b.x + nx * W * side, L.b.y + ny * W * side];
    t.draw(D, (g, u) => {
      const a = Math.min(1, u * 8) * Math.pow(1 - u, 1.3);
      g.poly([...edge(-1), ...edge(1).slice(2), ...edge(1).slice(0, 2)]).fill({ color: SCORCH, alpha: 0.4 * a });
    }, { dark: true, delay: 0.12 });
    t.draw(D, (g, u) => {
      const a = Math.min(1, u * 8) * Math.pow(1 - u, 1.3);
      for (const sd of [-1, 1]) {
        const e = edge(sd);
        g.moveTo(e[0], e[1]).lineTo(e[2], e[3]).stroke({ width: 2, color: u < 0.35 ? PALE : DEEP, alpha: 0.75 * a });
      }
    }, { delay: 0.12 });
    // ...and heat shimmering up off it: wavering threads of light rising.
    const threads = Math.max(3, Math.round(L.len / (s * 0.4)));
    const spots = Array.from({ length: threads }, (_, i) => ({ f: (i + rand(0.2, 0.8)) / threads, off: rand(-0.7, 0.7) * W, ph: rand(0, TAU) }));
    t.draw(0.85, (g, u) => {
      const time = u * 0.85, a = Math.sin(Math.PI * u);
      for (const sp of spots) {
        const p = lerpPt(L.a, L.b, sp.f), x0 = p.x + nx * sp.off, y0 = p.y + ny * sp.off - time * s * 0.5;
        g.moveTo(x0 + Math.sin(sp.ph + time * 9) * s * 0.04, y0);
        for (let j = 1; j <= 6; j++) g.lineTo(x0 + Math.sin(sp.ph + j * 1.3 + time * 9) * s * 0.04, y0 - (s * 0.36 * j) / 6);
        g.stroke({ width: 2, color: WARM, alpha: 0.35 * a });
      }
    }, { delay: 0.35 });
    for (let i = 0; i < Math.round(14 * Math.max(0.5, t.quality)); i++) {
      const p = lerpPt(L.a, L.b, rand(0.05, 0.98));
      t.later(rand(0.3, 0.6), () => t.spark(p.x + nx * rand(-W, W), p.y + ny * rand(-W, W), rand(-10, 10), -rand(30, 70), rand(0.5, 0.8), ASH));
    }
  },
};
