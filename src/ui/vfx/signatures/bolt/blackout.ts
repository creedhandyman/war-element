/** BLACKOUT — Fryer. "Deal 4 DMG to all opponents and MUTE them for 1 round;
 *  PARALYZED opponents take +1 DMG." Anything at four HP or under goes dark;
 *  Fryer mutes the rest of the grid.
 *
 *  His art is a hooded figure with violet eyes in a rain-soaked neon city, one
 *  hand out, raw current crackling off him — and every light in the street
 *  round him failing. So the DELIVERY is the brownout before it: the surge
 *  crawls up his arm (static over his card, an arc reaching out of its front
 *  edge where his hand is), his eyes light violet in the hood, and the whole
 *  board's light dips and stutters as he pulls on the grid.
 *
 *  The LANDING is the grid going down. A surge races out from him ALONG THE
 *  GRID LINES between the squares — a diamond-shaped front running the
 *  streets, straight segments and right angles, a circuit board, not a fork
 *  — and a hard trace routes round the corners to every opponent, solder pads
 *  lit at its turns. Where it arrives the card SHORTS: a violet pop, static,
 *  hot fuse sparks and a wisp of burnt smoke — and then it goes DARK. The
 *  card is blacked out for a beat, its edge a dying violet tube, and then it
 *  flickers back on the way failing neon does, catching and dropping out
 *  again before it holds. The darkness is the move: lights going OUT, not a
 *  bright blast. The board's own light browns out with it.
 *
 *  Darkness is drawn for real (`dark: true`), and every dark shape keeps a
 *  violet rim so it reads over an empty square. */
import { centre, rand } from "../../looks/base";
import type { Graphics } from "pixi.js";
import type { FxTools, Pt, SparkStyle } from "../../looks/types";
import type { Signature, SigMoment } from "../types";

type Box = SigMoment["from"];

const TAU = Math.PI * 2;
/** The surge: white-hot, lavender, violet, deep violet. */
const WHITE = 0xffffff, LAV = 0xe3d8ff, VIO = 0x9575ff, DEEP = 0x5b3bd6;
/** A blown fuse: hot orange, and grey smoke after. */
const FUSE = 0xffb060, EMBER = 0xff7a2a, SMOKE = 0x8a8496;
/** The dark: no light at all. Dark layer only. */
const OUT = 0x020206;
/** One flicker beat, s (looks/bolt.ts). */
const BEAT = 0.035;
/** The board's light while he pulls on the grid: mostly up, dipping. */
const DIP = [0, 0, 0.5, 0.1, 0, 0, 0.8, 0.3, 0, 0.6, 1, 0.2, 0, 0.9, 0.5, 1];
/** A dead card coming back like failing neon, beat by beat: 1 = still dark,
 *  0 = lit. It catches, drops out, catches again, and holds. */
/** The traces dying once the grid is down: a stutter, never a fade. */
const CUT = [0.35, 0.9, 0.15, 0.6, 0, 0.3, 0];
const NEON = [0.15, 1, 1, 0.1, 0.9, 0.2, 0.05, 0.85, 0.1, 0.4, 0];

/** Static: darts out hard and stops dead. */
const SNAP: SparkStyle = { palette: [WHITE, LAV, VIO], gravity: 0, drag: 0.0008, size: [6, 1.5], streak: true };
/** Finer static, crawling on him. */
const FIZZ: SparkStyle = { palette: [WHITE, LAV, VIO, DEEP], gravity: 0, drag: 0.002, size: [4, 1], streak: true };
/** Hot fuse sparks: thrown and falling. */
const SPIT: SparkStyle = { palette: [WHITE, FUSE, EMBER], gravity: 520, drag: 0.4, size: [4, 1], streak: true };
/** Burnt smoke off a shorted card, drifting up. */
const FUMES: SparkStyle = { palette: [0xb8b0c8, SMOKE, 0x4c4858], gravity: -60, drag: 0.5, size: [5, 11], streak: false };

/** The surge's run out over the board, s, and how long a dead card stays
 *  dark before it starts to come back. */
const RUN = 0.34, DARK = 0.26;

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeOut = (x: number) => 1 - (1 - x) * (1 - x);

// ── Lightning, for the crackle on him ───────────────────────────────────────

/** A lightning channel from a to b, pinned at both ends. */
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

/** Flat points as one open path. */
function trace(g: Graphics, p: number[]) {
  g.moveTo(p[0], p[1]);
  for (let i = 2; i < p.length; i += 2) g.lineTo(p[i], p[i + 1]);
}

/** Lightning stroked: a violet halo, then a thin hot core. */
function zap(g: Graphics, paths: number[][], width: number, alpha: number) {
  if (alpha <= 0.02 || paths.length === 0) return;
  const a = Math.min(1, alpha);
  for (const p of paths) trace(g, p);
  g.stroke({ width: width * 4, color: VIO, alpha: 0.3 * a, join: "round", cap: "round" });
  for (const p of paths) trace(g, p);
  g.stroke({ width, color: WHITE, alpha: a, join: "bevel", cap: "round" });
}

/** A hard flash sized to the squares, in and gone in a blink. */
function blink(t: FxTools, p: Pt, size: number, color: number, peak: number, seconds: number) {
  t.glow({ x: p.x - size / 2, y: p.y - size / 2, w: size, h: size }, color, peak, seconds, 1);
}

// ── The grid ────────────────────────────────────────────────────────────────

/** The board's pitch, px: a square plus the gap between squares, read off
 *  where the cards actually sit (whole numbers of squares apart), so the
 *  streets the surge runs line up with the real gaps on any board. */
function pitchOf(m: SigMoment): number {
  const s = m.size, ps = [m.from, ...m.targets, ...m.allies].map(centre);
  let sum = 0, n = 0;
  for (let i = 0; i < ps.length; i++)
    for (let j = i + 1; j < ps.length; j++)
      for (const d of [Math.abs(ps[i].x - ps[j].x), Math.abs(ps[i].y - ps[j].y)]) {
        const k = Math.round(d / (s * 1.08));
        if (k >= 1 && k <= 6) { sum += d / k; n++; }
      }
  const p = n ? sum / n : s * 1.08;
  return Math.max(s, Math.min(s * 1.25, p));
}

/** The streets: the gaps between squares, as offsets from his own square's
 *  centre, that fall on the board — `lo..hi` the board's extent. */
function streets(c: number, lo: number, hi: number, P: number): number[] {
  const out: number[] = [];
  for (let k = -12; k <= 12; k++) {
    const v = c + (k + 0.5) * P;
    if (v > lo + P * 0.25 && v < hi - P * 0.25) out.push(v);
  }
  return out;
}

/** A TRACE from him to a card, routed like a circuit: straight out of the
 *  middle of one of his square's edges onto the street, along it, round a
 *  right angle onto the street beside the card, and straight in through the
 *  middle of the card's edge — right angles only, never a diagonal. Alternate
 *  cards leave by the other edge, so the traces spread over the board instead
 *  of bundling. Returns the corner points and the path's length. */
function route(c: Pt, p: Pt, P: number, flip: boolean): { pts: Pt[]; len: number } {
  const h = P / 2, dx = p.x - c.x, dy = p.y - c.y;
  const sameCol = Math.abs(dx) < P * 0.5, sameRow = Math.abs(dy) < P * 0.5;
  const sx = sameCol ? (flip ? 1 : -1) : Math.sign(dx), sy = sameRow ? (flip ? 1 : -1) : Math.sign(dy);
  let pts: Pt[];
  if (sameRow || (!sameCol && flip)) {
    // Out through his side, along the street beside his column, then the
    // street before the card's row, and in through its near edge.
    const X = c.x + Math.sign(dx || 1) * h, Y = p.y - sy * h;
    pts = [c, { x: X, y: c.y }, { x: X, y: Y }, { x: p.x, y: Y }, p];
  } else {
    // Out through his front or back, along the street before his row, then
    // the street beside the card's column, and in through its side.
    const Y = c.y + Math.sign(dy || 1) * h, X = p.x - sx * h;
    pts = [c, { x: c.x, y: Y }, { x: X, y: Y }, { x: X, y: p.y }, p];
  }
  let len = 0;
  for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  return { pts, len };
}

/** `pts` traced up to `d` px along. Returns the head. */
function along(g: Graphics, pts: Pt[], d: number): Pt {
  g.moveTo(pts[0].x, pts[0].y);
  let left = d;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], l = Math.hypot(b.x - a.x, b.y - a.y);
    if (left <= l) {
      const f = l ? left / l : 0, h = { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
      g.lineTo(h.x, h.y);
      return h;
    }
    g.lineTo(b.x, b.y);
    left -= l;
  }
  return pts[pts.length - 1];
}

// ── A card shorting and going dark ──────────────────────────────────────────

/** A card SHORTING: a violet pop, static, hot fuse sparks spat and falling,
 *  a wisp of burnt smoke — then it goes DARK, holds, and flickers back on
 *  like failing neon, its edge a dying violet tube the while. */
function shortOut(t: FxTools, r: Box, s: number, power: number, killed: boolean, delay: number) {
  const c = centre(r), k = Math.max(0.8, Math.min(1.4, power + 0.2)), v = s / 90;
  t.later(delay, () => {
    blink(t, c, s * 1.15, VIO, 0.55 * k, 0.1);
    for (let i = 0; i < Math.round(9 * k); i++) {
      const a = rand(0, TAU), sp = rand(150, 300) * v;
      t.spark(c.x, c.y, Math.cos(a) * sp, Math.sin(a) * sp, rand(0.08, 0.18), SNAP);
    }
    // The fuse going: from one corner, the way a junction box blows.
    const fx = c.x + rand(-0.3, 0.3) * s, fy = c.y - s * 0.3;
    for (let i = 0; i < Math.round(6 * k); i++) {
      const a = -Math.PI / 2 + rand(-1.1, 1.1), sp = rand(90, 220) * v;
      t.spark(fx, fy, Math.cos(a) * sp, Math.sin(a) * sp, rand(0.3, 0.5), SPIT);
    }
    for (let i = 0; i < Math.round(3 * t.quality) + 1; i++)
      t.spark(c.x + rand(-0.2, 0.2) * s, c.y + rand(-0.1, 0.2) * s, rand(-12, 12) * v, rand(-40, -20) * v, rand(0.5, 0.8), FUMES);
  });
  // Lights out. A killed card does not come back on.
  const back = NEON.length * BEAT * 1.15, D = DARK + (killed ? 0.4 : back);
  const out = (time: number) => {
    if (time < DARK) return 1;
    if (killed) return 1 - clamp01((time - DARK) / 0.4);
    return NEON[Math.min(NEON.length - 1, Math.floor((time - DARK) / (BEAT * 1.15)))];
  };
  const inset = s * 0.03;
  // The overload: the card blazes for two beats as the surge hits — so the
  // drop to black after it lands as lights going OUT.
  t.draw(BEAT * 2, (g, u) => {
    g.rect(r.x + inset, r.y + inset, r.w - inset * 2, r.h - inset * 2).fill({ color: LAV, alpha: 0.5 * (1 - u * 0.5) });
  }, { delay });
  t.draw(D, (g, u) => {
    const a = out(u * D);
    g.rect(r.x + inset, r.y + inset, r.w - inset * 2, r.h - inset * 2).fill({ color: OUT, alpha: 0.93 * a });
  }, { dark: true, delay: delay + BEAT * 2 });
  // The tube round its edge: lit while the card is out — so the dark square
  // reads on an empty board — buzzing, and gone once the card is back.
  t.draw(D, (g, u) => {
    const time = u * D, a = out(time), buzz = Math.floor(time / BEAT) % 3 === 1 ? 0.45 : 1;
    if (a <= 0.02) return;
    g.rect(r.x + inset, r.y + inset, r.w - inset * 2, r.h - inset * 2)
      .stroke({ width: 5, color: DEEP, alpha: 0.3 * a * buzz })
      .stroke({ width: 2, color: VIO, alpha: 0.9 * a * buzz });
  }, { delay: delay + BEAT * 2 });
}

export const BLACKOUT: Signature = {
  shake: 0.7,
  // He reaches into the grid where he stands.
  lunge: false,

  deliver(t: FxTools, m: SigMoment, seconds: number) {
    const s = m.size, c = centre(m.from), T = seconds, v = s / 90, A = m.ahead;
    // THE SURGE up his arm: static crawling over his card, more as it builds,
    // and an arc reaching out of its front edge where his hand is out.
    const half = s * 0.42;
    let arcs: number[][] = [], beat = -1, acc = 0;
    const hand = { x: c.x + A.x * s * 0.5, y: c.y + A.y * s * 0.5 };
    t.draw(T, (g, u, dt) => {
      const time = u * T, bt = Math.floor(time / BEAT);
      if (bt !== beat) {
        beat = bt;
        arcs = [];
        const n = 2 + Math.round(3 * u);
        for (let i = 0; i < n; i++) {
          const side = Math.floor(rand(0, 4)), f = rand(-half, half);
          const x = c.x + (side < 2 ? f : side === 2 ? -half : half), y = c.y + (side < 2 ? (side === 0 ? -half : half) : f);
          const a = rand(0, TAU), l = s * rand(0.12, 0.24) * (0.6 + 0.4 * u);
          arcs.push(channel(x, y, x + Math.cos(a) * l, y + Math.sin(a) * l, 3, l * 0.3));
        }
        if (u > 0.3) {
          // The hand, raw current reaching off it.
          const a = Math.atan2(A.y, A.x) + rand(-0.6, 0.6), l = s * rand(0.25, 0.45) * u;
          arcs.push(channel(c.x, c.y, hand.x, hand.y, 4, s * 0.06), channel(hand.x, hand.y, hand.x + Math.cos(a) * l, hand.y + Math.sin(a) * l, 3, l * 0.3));
        }
      }
      zap(g, arcs, 1.5, (0.4 + 0.6 * u) * rand(0.5, 1));
      acc += dt * 40 * t.quality * u;
      for (; acc >= 1; acc--) {
        const a = rand(0, TAU), R = s * rand(0.45, 0.6), sp = rand(120, 220) * v;
        t.spark(c.x + Math.cos(a) * R, c.y + Math.sin(a) * R, -Math.cos(a) * sp, -Math.sin(a) * sp, rand(0.08, 0.14), FIZZ);
      }
    });
    // His EYES lighting in the hood: two violet points, the one steady light
    // in the picture while everything else fails.
    t.draw(T + 0.25, (g, u) => {
      const time = u * (T + 0.25), a = clamp01((time - T * 0.3) / 0.08) * (1 - clamp01((time - T) / 0.25));
      for (const sx of [-1, 1]) {
        const x = c.x + sx * s * 0.07, y = c.y - s * 0.13;
        g.ellipse(x, y, s * 0.06, s * 0.035).fill({ color: VIO, alpha: 0.4 * a });
        g.ellipse(x, y, s * 0.028, s * 0.014).fill({ color: WHITE, alpha: 0.95 * a });
      }
    });
    // THE BROWNOUT: the board's light dipping and stuttering as he pulls on
    // the grid, deeper toward the end.
    t.draw(T, (g, u) => {
      const a = DIP[Math.floor((u * T) / BEAT) % DIP.length] * (0.12 + 0.2 * u);
      if (a > 0.01) g.rect(m.board.x, m.board.y, m.board.w, m.board.h).fill({ color: OUT, alpha: a });
    }, { dark: true });
  },

  land(t: FxTools, m: SigMoment) {
    const s = m.size, c = centre(m.from), b = m.board, P = pitchOf(m);
    const hits = m.targets.map((r, i) => {
      const p = centre(r), rt = route(c, p, P, i % 2 === 1);
      return { r, p, rt, power: m.power[i] ?? 1, killed: m.killed[i] ?? false };
    });
    // The front runs in grid distance — along the streets — out past the
    // farthest card, so every trace's head and the front arrive together.
    const far = Math.max(P * 2, ...hits.map((h) => h.rt.len));
    const reach = far + P * 0.6;
    const front = (time: number) => reach * easeOut(clamp01(time / RUN)) * 1.0;
    const xs = streets(c.x, b.x, b.x + b.w, P), ys = streets(c.y, b.y, b.y + b.h, P);

    // A pop off him as he dumps it into the grid.
    blink(t, c, s * 1.3, LAV, 0.5, 0.12);
    t.ring(m.from, VIO, 0.6, 1.3, 0.22, 3);

    // THE SURGE over the grid: on every street, the two points where the
    // diamond-shaped front crosses it, each a bright head with a violet tail
    // laid back toward him — straight lines along the gaps, so it reads as a
    // circuit, never as a fork.
    const D = RUN + 0.22;
    t.draw(D, (g, u) => {
      const time = u * D, F = front(time), fade = 1 - clamp01((time - RUN) / (D - RUN));
      const tail = P * 1.3, head = P * 0.2;
      const seg = (x0: number, y0: number, x1: number, y1: number, w: number, color: number, a: number) =>
        g.moveTo(x0, y0).lineTo(x1, y1).stroke({ width: w, color, alpha: a, cap: "round" });
      for (const pass of [0, 1]) {
        for (const X of xs) {
          const d = F - Math.abs(X - c.x);
          if (d <= 0) continue;
          for (const sy of [-1, 1]) {
            const L = pass ? head : tail, y1 = c.y + sy * d, y0 = c.y + sy * Math.max(0, d - L);
            const y1c = Math.max(b.y, Math.min(b.y + b.h, y1)), y0c = Math.max(b.y, Math.min(b.y + b.h, y0));
            if (Math.abs(y1c - y0c) < 1) continue;
            if (pass) seg(X, y0c, X, y1c, 3, WHITE, fade);
            else { seg(X, y0c, X, y1c, 9, DEEP, 0.4 * fade); seg(X, y0c, X, y1c, 2.5, VIO, 0.85 * fade); }
          }
        }
        for (const Y of ys) {
          const d = F - Math.abs(Y - c.y);
          if (d <= 0) continue;
          for (const sx of [-1, 1]) {
            const L = pass ? head : tail, x1 = c.x + sx * d, x0 = c.x + sx * Math.max(0, d - L);
            const x1c = Math.max(b.x, Math.min(b.x + b.w, x1)), x0c = Math.max(b.x, Math.min(b.x + b.w, x0));
            if (Math.abs(x1c - x0c) < 1) continue;
            if (pass) seg(x0c, Y, x1c, Y, 3, WHITE, fade);
            else { seg(x0c, Y, x1c, Y, 9, DEEP, 0.4 * fade); seg(x0c, Y, x1c, Y, 2.5, VIO, 0.85 * fade); }
          }
        }
      }
    });

    // THE TRACES to every card: laid along the route as the front runs, a
    // hot head at its tip and solder pads lighting at its corners — and the
    // moment the cards short, the power is gone: they stutter out, and leave
    // the dark to itself.
    const TD = RUN + 0.2;
    t.draw(TD, (g, u) => {
      const time = u * TD, F = front(time);
      const a = time < RUN + 0.03 ? 1 : CUT[Math.min(CUT.length - 1, Math.floor((time - RUN - 0.03) / BEAT))];
      if (a <= 0.02) return;
      for (const h of hits) {
        const d = Math.min(F, h.rt.len);
        along(g, h.rt.pts, d);
        g.stroke({ width: 7, color: DEEP, alpha: 0.35 * a, join: "miter", cap: "square" });
        const hd = along(g, h.rt.pts, d);
        g.stroke({ width: 2.4, color: LAV, alpha: 0.95 * a, join: "miter", cap: "square" });
        let run = 0;
        for (let i = 1; i < h.rt.pts.length - 1; i++) {
          const p0 = h.rt.pts[i - 1], p1 = h.rt.pts[i];
          run += Math.hypot(p1.x - p0.x, p1.y - p0.y);
          if (run > d) break;
          g.circle(p1.x, p1.y, Math.max(2.5, s * 0.045)).fill({ color: DEEP, alpha: 0.5 * a }).stroke({ width: 1.5, color: LAV, alpha: 0.9 * a });
        }
        if (d < h.rt.len) g.circle(hd.x, hd.y, Math.max(2.5, s * 0.04)).fill({ color: WHITE, alpha: 1 });
      }
    });

    // THE BLACKOUT: each card shorts as its trace arrives, and goes dark.
    for (const h of hits) {
      const q = clamp01(h.rt.len / reach), when = RUN * (1 - Math.sqrt(1 - q));
      shortOut(t, h.r, s, h.power, h.killed, when);
    }
    // The board's own light browns out with them, and comes back unevenly.
    t.draw(RUN + 0.7, (g, u) => {
      const time = u * (RUN + 0.7);
      const a = clamp01(time / RUN) * (time < RUN + 0.3 ? 1 : DIP[Math.floor(time / BEAT) % DIP.length] * (1 - clamp01((time - RUN - 0.3) / 0.4)));
      if (a > 0.01) g.rect(b.x, b.y, b.w, b.h).fill({ color: OUT, alpha: 0.26 * a });
    }, { dark: true });
  },
};
