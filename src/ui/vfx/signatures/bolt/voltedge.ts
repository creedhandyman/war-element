/** VOLTEDGE — Razr Lightning Bladerang. "Hurl the bladerang for 7 DMG to a
 *  target and apply a 7-DOT for 1 round." One target; the bladerang is the
 *  follow-up.
 *
 *  Voltedge's art is a violet-haired assassin in a black catsuit and a gold-
 *  trimmed mask, mid-throw, a huge four-pointed bladerang of black steel and
 *  GOLD edges crackling with violet lightning. So the DELIVERY is the
 *  bladerang spinning up in her hand — slow, then a blur, lightning crawling
 *  off its points — and the throw: it leaves her on a wide curve, out to one
 *  side of the line, a violet lightning trail behind it, and reaches the
 *  target exactly as the step lands.
 *
 *  The LANDING is the slice and the RETURN. It grinds through the card for a
 *  blink — a ring of gold cuts laid round it as the four blades go by, hot
 *  sparks flung off the rim — and leaves a crackling gash across the card
 *  (dark, gold-edged, violet current fizzing in it: the 7-DOT). Then it comes
 *  BACK: on round the far side of the loop, the other side of the line from
 *  the way it went out, and into her hand, caught with a gold glint. The
 *  return is the signature — a boomerang, not a shot. A kill cuts the card
 *  clean in two: a second gash across the first, and it falls apart violet.
 *
 *  It is a machine, not a storm: the blade moves on a smooth, exact curve
 *  and spins like one; only the lightning riding it keeps BOLT's rules
 *  (kinked, re-struck on a beat). The steel is dark for real (`dark: true`)
 *  under its gold edges, so it reads over a card and over an empty square. */
import { centre, rand } from "../../looks/base";
import type { Graphics } from "pixi.js";
import type { FxTools, Pt, SparkStyle } from "../../looks/types";
import type { Signature, SigMoment } from "../types";

type Box = SigMoment["from"];

const TAU = Math.PI * 2;
/** The bladerang's gold edges: white-gold, gold, old gold. */
const WHITE = 0xffffff, GOLD_HI = 0xfff0a8, GOLD = 0xffc838, OLD_GOLD = 0xc8921e;
/** The lightning it carries: BOLT's lavender and violet. */
const LAV = 0xe3d8ff, VIO = 0x9575ff, DEEP = 0x5b3bd6;
/** Black steel, and the gash's dark: dark layer only. */
const STEEL = 0x08060c, GASH = 0x050208;
/** One flicker beat, s, and a crackle's brightness beat by beat: a stutter. */
const BEAT = 0.035;
const FLICKER = [1, 0.35, 1, 0.8, 0.3, 0.95, 0.5, 0.2, 0.75, 0.35, 0.15, 0.55];
/** The blade's spin at full speed, rad/s, and its radius against a square. */
const SPIN = 26, RADIUS = 0.34;
/** At the target: how long it grinds there, then its flight home, s. */
const GRIND = 0.07, HOME = 0.42;

/** Hot steel off the cut: fast, falling. */
const HOT: SparkStyle = { palette: [WHITE, GOLD_HI, GOLD, OLD_GOLD], gravity: 380, drag: 0.35, size: [5, 1.5], streak: true };
/** Glitter shed off the gold edges in flight. */
const SHED: SparkStyle = { palette: [GOLD_HI, GOLD, OLD_GOLD], gravity: 60, drag: 0.2, size: [3, 1], streak: false };
/** Static: darts out hard and stops dead. */
const SNAP: SparkStyle = { palette: [WHITE, LAV, VIO], gravity: 0, drag: 0.0008, size: [5, 1.5], streak: true };
/** What is left of a card cut in two. */
const SHARD: SparkStyle = { palette: [WHITE, LAV, VIO, DEEP], gravity: 260, drag: 0.5, size: [6, 2.5], streak: false };

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeOut = (x: number) => 1 - (1 - x) * (1 - x);
const smooth = (x: number) => x * x * (3 - 2 * x);

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

/** Lightning stroked: a wide violet halo, then a thin hot core. */
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
  g.stroke({ width, color: LAV, alpha: a, join: "bevel", cap: "round" });
}

/** The bladerang at (x, y), radius R, turned `rot`: four hooked blades, each
 *  a fang swept back from the hub to its point — and each blade's leading
 *  (cutting) edge on its own, for the gold. Flat points. */
function bladerang(x: number, y: number, R: number, rot: number) {
  const rh = R * 0.22, blades: number[][] = [], edges: number[][] = [], tips: Pt[] = [];
  for (let i = 0; i < 4; i++) {
    const a = rot + (i * Math.PI) / 2, lead: number[] = [], trail: number[] = [];
    for (let k = 0; k <= 6; k++) {
      const f = k / 6, r = rh + (R - rh) * f, w = Math.pow(f, 1.6);
      lead.push(x + Math.cos(a - 0.45 + 0.85 * w) * r, y + Math.sin(a - 0.45 + 0.85 * w) * r);
      trail.unshift(x + Math.cos(a + 0.4) * r, y + Math.sin(a + 0.4) * r);
    }
    blades.push(lead.concat(trail.slice(2)));
    edges.push(lead);
    tips.push({ x: lead[12], y: lead[13] });
  }
  return { blades, edges, tips, hub: R * 0.3 };
}

/** The bladerang drawn: black steel (dark layer), or its gold edges, the
 *  violet hub and — spinning fast (`blur` 0..1) — the ghosts of its last
 *  turn and the disc its points sweep (light layer). */
function drawRang(g: Graphics, x: number, y: number, R: number, rot: number, dark: boolean, a: number, blur: number) {
  if (a <= 0.01) return;
  const b = bladerang(x, y, R, rot);
  if (dark) {
    for (const pts of b.blades) g.poly(pts, true).fill({ color: STEEL, alpha: 0.9 * a });
    g.circle(x, y, b.hub).fill({ color: STEEL, alpha: 0.9 * a });
    return;
  }
  if (blur > 0.05) {
    g.circle(x, y, R * 0.97).stroke({ width: R * 0.12, color: GOLD, alpha: 0.18 * blur * a });
    for (const lag of [0.2, 0.4]) {
      const gh = bladerang(x, y, R, rot - lag);
      for (const pts of gh.edges) {
        g.moveTo(pts[0], pts[1]);
        for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
      }
      g.stroke({ width: 1.4, color: GOLD, alpha: 0.4 * blur * (1 - lag) * a });
    }
  }
  for (const pts of b.blades) g.poly(pts, true).fill({ color: OLD_GOLD, alpha: 0.3 * a }).stroke({ width: 1.5, color: GOLD, alpha: 0.9 * a, join: "round" });
  for (const pts of b.edges) {
    g.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
  }
  g.stroke({ width: 2.6, color: GOLD_HI, alpha: a, cap: "round", join: "round" });
  g.circle(x, y, b.hub).fill({ color: VIO, alpha: 0.35 * a }).stroke({ width: 1.5, color: GOLD, alpha: a });
  g.circle(x, y, b.hub * 0.4).fill({ color: LAV, alpha: 0.9 * a });
}

/** The loop it flies: an ellipse from her hand out to the target (its far
 *  end) and back, bowed out to one side going and the other side coming
 *  home. `at(th)`: th = PI at her hand, 0 at the target, -PI home again. */
function loop(m: SigMoment) {
  const c = centre(m.from), s = m.size;
  const r: Box | undefined = m.targets[0];
  const p = r ? centre(r) : { x: c.x + m.ahead.x * s * 3, y: c.y + m.ahead.y * s * 3 };
  let ux = p.x - c.x, uy = p.y - c.y;
  const d0 = Math.hypot(ux, uy) || 1;
  ux /= d0; uy /= d0;
  const hand = { x: c.x + ux * s * 0.18, y: c.y + uy * s * 0.18 };
  const d = Math.hypot(p.x - hand.x, p.y - hand.y), a = d / 2, b = Math.min(s * 1.05, Math.max(s * 0.6, d * 0.38));
  // Bow the outward leg in toward the middle of the board, so the loop stays
  // on it from a corner.
  const bc = centre(m.board), nx = -uy, ny = ux;
  const side = (bc.x - c.x) * nx + (bc.y - c.y) * ny < 0 ? -1 : 1;
  const at = (th: number): Pt => ({
    x: hand.x + ux * (a + a * Math.cos(th)) + nx * side * b * Math.sin(th),
    y: hand.y + uy * (a + a * Math.cos(th)) + ny * side * b * Math.sin(th),
  });
  return { c, s, r, p, hand, at, ux, uy, nx: nx * side, ny: ny * side, power: m.power[0] ?? 1, killed: m.killed[0] ?? false };
}

/** The violet lightning it trails: a channel laid back along where it has
 *  just been (`pos` at a few moments behind `time`), re-kinked every beat. */
function trailPaths(pos: (time: number) => Pt, time: number, s: number): number[][] {
  const pts: Pt[] = [];
  for (let k = 0; k <= 6; k++) pts.push(pos(Math.max(0, time - k * 0.016)));
  const out: number[] = [];
  for (let k = 0; k < pts.length - 1; k++) {
    const seg = channel(pts[k].x, pts[k].y, pts[k + 1].x, pts[k + 1].y, 2, s * 0.06);
    out.push(...(k ? seg.slice(2) : seg));
  }
  return [out];
}

/** Lightning crawling off the blade's points: a few short channels out of
 *  random tips, re-rolled every beat. */
function tipArcs(x: number, y: number, R: number, rot: number, n: number): number[][] {
  const b = bladerang(x, y, R, rot), out: number[][] = [];
  for (let i = 0; i < n; i++) {
    const tp = b.tips[Math.floor(rand(0, 4))], q = Math.atan2(tp.y - y, tp.x - x) + rand(-0.9, 0.9), l = R * rand(0.35, 0.7);
    out.push(channel(tp.x, tp.y, tp.x + Math.cos(q) * l, tp.y + Math.sin(q) * l, 3, l * 0.35));
  }
  return out;
}

/** The ring of cuts the four blades lay round the card as they grind
 *  through it: arc after arc, laid in the spin's direction, white-gold
 *  cooling to violet. */
function cutRing(t: FxTools, p: Pt, R: number, delay: number) {
  const D = 0.5, n = 7, a0 = rand(0, TAU);
  t.draw(D, (g, u) => {
    const time = u * D;
    for (let i = 0; i < n; i++) {
      const born = (i / n) * GRIND * 1.4, q = (time - born) / (D - born);
      if (q <= 0) continue;
      const a = a0 - (i * TAU) / n, rr = R * (0.92 + 0.12 * (i % 2)), span = 0.75;
      const fade = 1 - clamp01((q - 0.15) / 0.85), hot = 1 - clamp01(q / 0.3);
      g.moveTo(p.x + Math.cos(a) * rr, p.y + Math.sin(a) * rr);
      for (let k = 1; k <= 6; k++) {
        const q2 = a - (span * k) / 6;
        g.lineTo(p.x + Math.cos(q2) * rr, p.y + Math.sin(q2) * rr);
      }
      g.stroke({ width: 1.5 + 2.5 * hot, color: hot > 0.3 ? GOLD_HI : VIO, alpha: fade, cap: "round" });
    }
  }, { delay });
}

/** The gash left across the card along `ang`: a dark wedge, thickest in the
 *  middle, its lips edged gold, violet current fizzing in it, stuttering —
 *  the cut still burning (the DOT). */
function gash(t: FxTools, p: Pt, s: number, ang: number, len: number, delay: number, D: number) {
  const ux = Math.cos(ang), uy = Math.sin(ang), nx = -uy, ny = ux;
  const wedge = (w: number, draw: number) => {
    const pts: number[] = [], back: number[] = [];
    for (let k = 0; k <= 8; k++) {
      const f = (k / 8) * draw, x = p.x + ux * len * (f - 0.5), y = p.y + uy * len * (f - 0.5), ww = w * Math.sin(Math.PI * (k / 8));
      pts.push(x + nx * ww, y + ny * ww);
      back.unshift(x - nx * ww, y - ny * ww);
    }
    return pts.concat(back);
  };
  const drawn = (time: number) => easeOut(clamp01(time / 0.06));
  const fade = (u: number) => 1 - clamp01((u - 0.7) / 0.3);
  t.draw(D, (g, u) => {
    g.poly(wedge(s * 0.065, drawn(u * D)), true).fill({ color: GASH, alpha: 0.8 * fade(u) });
  }, { delay, dark: true });
  let paths: number[][] = [], beat = -1, acc = 0;
  t.draw(D, (g, u, dt) => {
    const time = u * D, a = fade(u), b = Math.floor(time / BEAT), dr = drawn(time);
    g.poly(wedge(s * 0.065, dr), true).stroke({ width: 1.4, color: GOLD, alpha: 0.9 * a, join: "round" });
    if (time < 0.12) g.poly(wedge(s * 0.09, dr), true).fill({ color: GOLD_HI, alpha: 0.5 * (1 - time / 0.12) });
    if (b !== beat) {
      beat = b;
      paths = [];
      for (let i = 0; i < 2; i++) {
        const f0 = rand(0.1, 0.5), f1 = f0 + rand(0.25, 0.4);
        paths.push(channel(p.x + ux * len * (f0 - 0.5), p.y + uy * len * (f0 - 0.5), p.x + ux * len * (f1 - 0.5), p.y + uy * len * (f1 - 0.5), 4, s * 0.04));
      }
    }
    zap(g, paths, 1.2, FLICKER[b % FLICKER.length] * a);
    acc += dt * 14 * t.quality * a;
    for (; acc >= 1; acc--) {
      const f = rand(0.15, 0.85), q = ang + (Math.random() < 0.5 ? 1 : -1) * rand(1.2, 1.9), sp = rand(70, 140) * (s / 90);
      t.spark(p.x + ux * len * (f - 0.5), p.y + uy * len * (f - 0.5), Math.cos(q) * sp, Math.sin(q) * sp, rand(0.08, 0.16), SNAP);
    }
  }, { delay });
}

export const VOLTEDGE: Signature = {
  shake: 0.8,
  // She stands and throws; the blade does the travelling, out and back.
  lunge: false,

  deliver(t: FxTools, m: SigMoment, seconds: number) {
    const L = loop(m), { s, hand } = L, T = seconds, R = s * RADIUS;
    const FLY = Math.min(0.26, T * 0.45), WIND = T - FLY;
    // The spin, integrated: from a lazy turn in her hand up to full speed as
    // she lets go.
    const rot = (time: number) => (time < WIND ? 2 * time + ((SPIN - 2) * time * time) / (2 * WIND) : 2 * WIND + ((SPIN - 2) * WIND) / 2 + SPIN * (time - WIND));
    // Out along the near leg of the loop, hand (th = PI) to the target (0),
    // at a steady turn: a thrown blade does not ease in or out.
    const pos = (time: number): Pt => (time < WIND ? hand : L.at(Math.PI * (1 - clamp01((time - WIND) / FLY))));
    const size = (time: number) => R * (0.7 + 0.3 * easeOut(clamp01(time / WIND)));
    const blur = (time: number) => clamp01((time / WIND - 0.35) / 0.5);
    t.draw(T, (g, u) => {
      const time = u * T, q = pos(time);
      drawRang(g, q.x, q.y, size(time), rot(time), true, clamp01(time / 0.06), 0);
    }, { dark: true });
    let arcs: number[][] = [], trail: number[][] = [], beat = -1, acc = 0;
    t.draw(T, (g, u, dt) => {
      const time = u * T, q = pos(time), b = Math.floor(time / BEAT);
      if (b !== beat) {
        beat = b;
        arcs = tipArcs(q.x, q.y, size(time), rot(time), time < WIND ? 1 + Math.round(2 * time / WIND) : 2);
        trail = time > WIND + 0.02 ? trailPaths(pos, time, s) : [];
      }
      zap(g, trail, 1.6, 0.9 * FLICKER[b % FLICKER.length] + 0.2);
      drawRang(g, q.x, q.y, size(time), rot(time), false, clamp01(time / 0.06), time < WIND ? blur(time) : 1);
      zap(g, arcs, 1.2, (time < WIND ? 0.4 + 0.6 * time / WIND : 1) * rand(0.55, 1));
      if (time > WIND) {
        acc += dt * 50 * t.quality;
        for (; acc >= 1; acc--) t.spark(q.x + rand(-0.5, 0.5) * R, q.y + rand(-0.5, 0.5) * R, rand(-30, 30), rand(-30, 30), rand(0.15, 0.3), SHED);
      }
    });
    t.charge(hand, s * 0.5, VIO, 0.4, WIND);
  },

  land(t: FxTools, m: SigMoment) {
    const L = loop(m), { s, p, hand } = L, R = s * RADIUS, v = s / 90;
    const k = Math.max(0.75, Math.min(1.5, L.power));
    // It grinds through the card, then home along the far leg (th 0 -> -PI),
    // slowing into her hand.
    const D = GRIND + HOME + 0.08;
    const pos = (time: number): Pt => (time < GRIND ? p : L.at(-Math.PI * smooth(clamp01((time - GRIND) / HOME))));
    const rot = (time: number) => SPIN * time;
    const alpha = (time: number) => 1 - clamp01((time - GRIND - HOME) / 0.06);
    const scale = (time: number) => 1 - 0.3 * clamp01((time - GRIND - HOME * 0.8) / (HOME * 0.2));
    t.draw(D, (g, u) => {
      const time = u * D, q = pos(time);
      drawRang(g, q.x, q.y, R * scale(time), rot(time), true, alpha(time), 0);
    }, { dark: true });
    let trail: number[][] = [], arcs: number[][] = [], beat = -1, acc = 0;
    t.draw(D, (g, u, dt) => {
      const time = u * D, q = pos(time), b = Math.floor(time / BEAT), a = alpha(time);
      if (b !== beat) {
        beat = b;
        trail = time > GRIND + 0.02 ? trailPaths(pos, time, s) : [];
        arcs = tipArcs(q.x, q.y, R, rot(time), 2);
      }
      zap(g, trail, 1.6, (0.9 * FLICKER[b % FLICKER.length] + 0.2) * a);
      drawRang(g, q.x, q.y, R * scale(time), rot(time), false, a, 1 - 0.6 * clamp01((time - GRIND - HOME * 0.6) / (HOME * 0.4)));
      zap(g, arcs, 1.2, a * rand(0.55, 1));
      acc += dt * 40 * t.quality * a;
      for (; acc >= 1; acc--) t.spark(q.x + rand(-0.5, 0.5) * R, q.y + rand(-0.5, 0.5) * R, rand(-30, 30), rand(-30, 30), rand(0.15, 0.3), SHED);
    });

    // THE SLICE: a ring of cuts round the card, hot steel flung off the rim
    // along the spin, a snap of light — and the gash it leaves, across the
    // card along the way it went through.
    cutRing(t, p, s * 0.36 * (0.9 + 0.1 * k), 0);
    t.flash(p, GOLD_HI, 0.3 * k * v);
    if (L.r) t.ring(L.r, GOLD, 0.2, 0.9, 0.25, 2.5);
    const hot = Math.round((10 + 4 * k) * t.quality) + 3;
    for (let i = 0; i < hot; i++) {
      const a = rand(0, TAU), rr = s * 0.32, sp = rand(160, 320) * v, tan = a - Math.PI / 2;
      t.spark(p.x + Math.cos(a) * rr, p.y + Math.sin(a) * rr, Math.cos(tan) * sp, Math.sin(tan) * sp, rand(0.18, 0.32), HOT);
    }
    // Through the card it was going across the line of the throw, so the
    // gash runs that way, tilted a little.
    const cut = Math.atan2(L.ny, L.nx) + 0.35;
    gash(t, p, s, cut, s * 0.86, 0.02, 0.95);

    // A kill: cut clean across again, and the card falls apart.
    if (L.killed) {
      gash(t, p, s, cut + Math.PI / 2 - 0.2, s * 0.7, 0.1, 0.6);
      t.later(0.12, () => {
        t.flash(p, VIO, 0.35 * v);
        if (L.r) t.ring(L.r, VIO, 0.3, 1.25, 0.4, 3);
        for (let i = 0; i < Math.round(12 * t.quality) + 4; i++) {
          const a = rand(0, TAU), sp = rand(80, 220) * v;
          t.spark(p.x + rand(-0.25, 0.25) * s, p.y + rand(-0.25, 0.25) * s, Math.cos(a) * sp, Math.sin(a) * sp, rand(0.35, 0.6), SHARD);
        }
      });
    }

    // THE CATCH: back in her hand with a gold glint.
    t.later(GRIND + HOME, () => {
      t.flash(hand, GOLD_HI, 0.22 * v);
      for (let i = 0; i < Math.round(5 * t.quality) + 2; i++) {
        const a = rand(0, TAU), sp = rand(60, 140) * v;
        t.spark(hand.x, hand.y, Math.cos(a) * sp, Math.sin(a) * sp, rand(0.12, 0.22), SNAP);
      }
    });
    t.draw(0.25, (g, u) => {
      const a = Math.sin(Math.PI * u), l = s * 0.26 * a, w = s * 0.025 * a;
      for (let i = 0; i < 4; i++) {
        const q = 0.4 + (i * Math.PI) / 2, cq = Math.cos(q), sq = Math.sin(q), ln = i % 2 ? l * 0.6 : l;
        g.poly([hand.x - sq * w, hand.y + cq * w, hand.x + cq * ln, hand.y + sq * ln, hand.x + sq * w, hand.y - cq * w], true).fill({ color: GOLD_HI, alpha: a });
      }
    }, { delay: GRIND + HOME - 0.03 });
  },
};
