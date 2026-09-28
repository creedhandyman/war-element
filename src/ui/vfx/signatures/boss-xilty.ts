/** XILTY — Web Trap. "15 DMG to every opponent within 2 spaces, PARALYZED for
 *  1 round and ROOTed for 2." The first blow finds silk. The web decides about
 *  the second.
 *
 *  Xilty on its art is a spider of black iron with a cluster of violet eyes,
 *  crouched over a web strung with lightning, violet and gold. The DELIVERY
 *  is it taking aim: its eyes light one by one, and it SHOOTS — a strand of
 *  silk flung out to every card in reach, crackling as it flies, each landing
 *  on its card as the Special does. The LANDING is the web snapping taut: an
 *  orb-web thrown open across the whole of its reach — radials out from
 *  Xilty, the spiral strung between them, every strand twanging as it pulls
 *  tight — with current running out along it to gold nodes where the silk
 *  crosses (the PARALYZE). And every card it caught is wound up: silk wrapped
 *  round and round it into a cocoon, crackling (the ROOT), held there while
 *  the web decides.
 *
 *  The web fans out toward what it caught rather than round Xilty in a full
 *  circle, so a spider sat on the board's edge strings its web across the
 *  board, not off it. Silk is drawn light and thin, a violet glow under it,
 *  so the cards still read through the web and the cocoons. */
import { centre, rand } from "../looks/base";
import type { Graphics } from "pixi.js";
import type { FxTools, Pt, SparkStyle } from "../looks/types";
import type { Signature, SigMoment } from "./types";

const TAU = Math.PI * 2;
/** Silk, and the violet glow it carries; the gold of the current in it. */
const SILK = 0xf4f0ff, LILAC = 0xd9c2ff, VIOLET = 0xa77bff, GOLD = 0xffd27a, WHITE = 0xffffff;
/** One flicker beat for the current, s (looks/bolt.ts). */
const BEAT = 0.035;
/** Current snapping off the web: violet and gold, dead-stop sparks. */
const SNAP: SparkStyle = { palette: [WHITE, 0xfff0c0, GOLD, VIOLET], gravity: 0, drag: 0.001, size: [5, 1.5], streak: true };
const SNAP_V: SparkStyle = { palette: [WHITE, LILAC, VIOLET], gravity: 0, drag: 0.001, size: [5, 1.5], streak: true };

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeOut = (x: number) => 1 - (1 - x) * (1 - x);
/** 0 -> 1 as `x` runs from `a` to `b`. */
const span = (x: number, a: number, b: number) => clamp01((x - a) / (b - a));
/** An angle folded into (-PI, PI]. */
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/** A glow sized to the board's squares (`flash` is sized in px). */
function flare(t: FxTools, p: Pt, size: number, color: number, peak: number, seconds: number) {
  t.glow({ x: p.x - size / 2, y: p.y - size / 2, w: size, h: size }, color, peak, seconds, 1);
}

/** Silk stroked: a violet glow, then the thread. */
function silk(g: Graphics, width: number, alpha: number) {
  g.stroke({ width: width * 3.5, color: VIOLET, alpha: 0.18 * alpha, cap: "round", join: "round" });
}

/** A short jagged arc of current from (x, y), `l` long along `a`. */
function spark(g: Graphics, x: number, y: number, a: number, l: number, color: number, alpha: number) {
  g.moveTo(x, y);
  let px = x, py = y;
  for (let i = 1; i <= 3; i++) {
    const f = i / 3, j = i < 3 ? rand(-0.35, 0.35) * l : 0;
    px = x + Math.cos(a) * l * f - Math.sin(a) * j;
    py = y + Math.sin(a) * l * f + Math.cos(a) * j;
    g.lineTo(px, py);
  }
  g.stroke({ width: 1.3, color, alpha, cap: "round", join: "bevel" });
}

/** How far the board runs from `c` along `a`, px. */
function toEdge(m: SigMoment, c: Pt, a: number): number {
  const b = m.board, ux = Math.cos(a), uy = Math.sin(a);
  let d = Infinity;
  if (ux > 1e-3) d = Math.min(d, (b.x + b.w - c.x) / ux);
  if (ux < -1e-3) d = Math.min(d, (b.x - c.x) / ux);
  if (uy > 1e-3) d = Math.min(d, (b.y + b.h - c.y) / uy);
  if (uy < -1e-3) d = Math.min(d, (b.y - c.y) / uy);
  return Number.isFinite(d) ? Math.max(0, d) : m.size * 3;
}

/** THE WEB's frame: the radials it is strung on, fanned over what it caught
 *  (or the whole way round, when that is everywhere), each as long as its
 *  reach — or the board — allows. */
function webFrame(m: SigMoment, c: Pt, R: number): { angles: number[]; lens: number[]; full: boolean } {
  const s = m.size, base = Math.atan2(m.ahead.y, m.ahead.x);
  const rel = m.targets.map((r) => { const p = centre(r); return wrap(Math.atan2(p.y - c.y, p.x - c.x) - base); });
  let lo = rel.length ? Math.min(...rel) - 0.55 : -1.2, hi = rel.length ? Math.max(...rel) + 0.55 : 1.2;
  const full = hi - lo > TAU - 0.6;
  if (full) { lo = -Math.PI; hi = Math.PI; }
  const n = Math.max(5, Math.round((hi - lo) / 0.36)), angles: number[] = [], lens: number[] = [];
  for (let i = 0; i < (full ? n : n + 1); i++) {
    const a = base + lo + ((hi - lo) * i) / n;
    angles.push(a);
    lens.push(Math.min(R, toEdge(m, c, a) + s * 0.15));
  }
  return { angles, lens, full };
}

/** A card wound up in silk: wraps laid round it one after another (`wound`
 *  0..1), then the cocoon's lumpy outline closing over them. Light, and thin,
 *  so the card still reads inside it. */
function cocoon(g: Graphics, p: Pt, s: number, wound: number, alpha: number, seed: number) {
  if (wound <= 0 || alpha <= 0.01) return;
  const n = 8, h = s * 0.46;
  for (let k = 0; k < n; k++) {
    const q = clamp01(wound * n - k);
    if (q <= 0) break;
    const a = seed + k * 0.72 + (k % 2) * 0.4, ux = Math.cos(a), uy = Math.sin(a), off = (k - n / 2) * s * 0.035;
    const ax = p.x - ux * h - uy * off, ay = p.y - uy * h + ux * off;
    const bx = ax + ux * 2 * h * q, by = ay + uy * 2 * h * q;
    const mx = (ax + bx) / 2 - uy * s * 0.06, my = (ay + by) / 2 + ux * s * 0.06;
    g.moveTo(ax, ay).quadraticCurveTo(mx, my, bx, by);
  }
  silk(g, 1.4, alpha);
  const n2 = Math.min(n, Math.ceil(wound * n));
  for (let k = 0; k < n2; k++) {
    const q = clamp01(wound * n - k), a = seed + k * 0.72 + (k % 2) * 0.4, ux = Math.cos(a), uy = Math.sin(a), off = (k - n / 2) * s * 0.035;
    const ax = p.x - ux * h - uy * off, ay = p.y - uy * h + ux * off, bx = ax + ux * 2 * h * q, by = ay + uy * 2 * h * q;
    g.moveTo(ax, ay).quadraticCurveTo((ax + bx) / 2 - uy * s * 0.06, (ay + by) / 2 + ux * s * 0.06, bx, by);
  }
  g.stroke({ width: 1.4, color: SILK, alpha: 0.85 * alpha, cap: "round" });
  if (wound >= 1) {
    const pts: number[] = [];
    for (let i = 0; i < 20; i++) {
      const th = (i / 20) * TAU, r = s * (0.47 + 0.04 * Math.sin(th * 5 + seed));
      pts.push(p.x + Math.cos(th) * r * 0.92, p.y + Math.sin(th) * r);
    }
    g.poly(pts, true).fill({ color: SILK, alpha: 0.1 * alpha }).stroke({ width: 1.8, color: SILK, alpha: 0.8 * alpha });
  }
}

export const XILTY: Signature = {
  shake: 1.5,
  // It does not close on anything: the silk does.
  lunge: false,

  deliver(t: FxTools, m: SigMoment, seconds: number) {
    const s = m.size, c = centre(m.from), T = seconds, v = s / 90;
    // Its eyes lighting, one by one, then all of them — the cluster on its art.
    const EYES = [[-0.16, -0.08, 0.05], [-0.055, -0.12, 0.06], [0.055, -0.12, 0.06], [0.16, -0.08, 0.05],
      [-0.1, 0.03, 0.035], [0, 0.0, 0.04], [0.1, 0.03, 0.035], [0, 0.11, 0.03]];
    t.draw(T, (g, u) => {
      EYES.forEach(([x, y, r], i) => {
        const on = span(u, 0.04 * i, 0.04 * i + 0.1), p = { x: c.x + x * s, y: c.y + y * s };
        if (on <= 0) return;
        g.circle(p.x, p.y, r * s * 2.2).fill({ color: VIOLET, alpha: 0.28 * on });
        g.circle(p.x, p.y, r * s).fill({ color: LILAC, alpha: 0.9 * on });
        g.circle(p.x - r * s * 0.3, p.y - r * s * 0.3, r * s * 0.35).fill({ color: WHITE, alpha: on });
      });
    });
    // THE SHOT: a strand flung to every card in reach, a bead of silk at its
    // head, landing as the Special does; current crackling along it.
    const LAUNCH = T * 0.35, FLY = T - LAUNCH;
    m.targets.forEach((r) => {
      const p = centre(r), d = Math.hypot(p.x - c.x, p.y - c.y) || 1, ux = (p.x - c.x) / d, uy = (p.y - c.y) / d;
      const a0 = { x: c.x + ux * s * 0.3, y: c.y + uy * s * 0.3 }, bow = (Math.random() < 0.5 ? -1 : 1) * d * 0.08;
      let beat = -1, acc = 0;
      t.draw(FLY, (g, u, dt) => {
        const f = u * (0.4 + 0.6 * u), x = a0.x + (p.x - a0.x) * f - uy * bow * 4 * f * (1 - f), y = a0.y + (p.y - a0.y) * f + ux * bow * 4 * f * (1 - f);
        const pts: number[] = [];
        for (let i = 0; i <= 10; i++) {
          const q = (i / 10) * f;
          pts.push(a0.x + (p.x - a0.x) * q - uy * bow * 4 * q * (1 - q), a0.y + (p.y - a0.y) * q + ux * bow * 4 * q * (1 - q));
        }
        g.moveTo(pts[0], pts[1]);
        for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
        silk(g, 1.3, 1);
        g.moveTo(pts[0], pts[1]);
        for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
        g.stroke({ width: 1.3, color: SILK, alpha: 0.9, cap: "round" });
        g.circle(x, y, s * 0.045).fill({ color: WHITE, alpha: 1 });
        const b = Math.floor((u * FLY) / BEAT);
        if (b !== beat && Math.random() < 0.6) {
          beat = b;
          const i = 2 * Math.floor(rand(1, 9));
          spark(g, pts[i], pts[i + 1], Math.atan2(uy, ux) + (Math.random() < 0.5 ? 1.6 : -1.6), s * 0.12, Math.random() < 0.5 ? GOLD : LILAC, 0.9);
        }
        acc += 30 * dt;
        for (; acc >= 1; acc--) {
          const a = rand(0, TAU), sp = rand(60, 140) * v;
          t.spark(x, y, Math.cos(a) * sp, Math.sin(a) * sp, rand(0.1, 0.2), SNAP_V);
        }
      }, { delay: LAUNCH });
    });
    t.charge(c, s * 1.2, VIOLET, 0.45, T);
  },

  land(t: FxTools, m: SigMoment) {
    const s = m.size, c = centre(m.from), v = s / 90, seed = rand(0, TAU);
    const hits = m.targets.map((r, i) => {
      const p = centre(r);
      return { r, p, d: Math.hypot(p.x - c.x, p.y - c.y), power: Math.max(0.55, Math.min(2, m.power[i] ?? 1)), killed: !!m.killed[i] };
    });
    const R = Math.max(s * 1.6, ...hits.map((h) => h.d + s * 0.5));
    const { angles, lens, full } = webFrame(m, c, R);
    const RINGS = [0.28, 0.46, 0.64, 0.82, 1.0];
    const SNAP_T = 0.16, D = 1.3;
    const fade = (time: number) => 1 - span(time, 0.95, D);
    /** A strand twanging as it pulls taut: its middle thrown aside, dying. */
    const twang = (time: number, k: number) => Math.sin(time * 70 + k * 1.7) * Math.exp(-time * 7) * s * 0.05;

    // THE WEB SNAPS TAUT: radials out from Xilty to the whole of its reach,
    // the spiral strung between them ring by ring, every strand twanging.
    const web = (g: Graphics, time: number) => {
      const grow = easeOut(span(time, 0, SNAP_T));
      angles.forEach((a, k) => {
        const L = lens[k] * grow, ux = Math.cos(a), uy = Math.sin(a), tw = twang(time, k);
        g.moveTo(c.x + ux * s * 0.3, c.y + uy * s * 0.3).quadraticCurveTo(c.x + ux * L * 0.5 - uy * tw, c.y + uy * L * 0.5 + ux * tw, c.x + ux * L, c.y + uy * L);
      });
      for (const f of RINGS) {
        const rr = R * f, shown = span(time, SNAP_T * f * 0.6, SNAP_T * (0.4 + f * 0.8));
        if (shown <= 0) continue;
        for (let k = 0; k < angles.length - (full ? 0 : 1); k++) {
          const k2 = (k + 1) % angles.length;
          if (rr > lens[k] || rr > lens[k2]) continue;
          const a0 = angles[k], a1 = angles[k2], am = a0 + wrap(a1 - a0) / 2, sag = 0.9 + 0.02 * Math.sin(time * 40 + k);
          const x0 = c.x + Math.cos(a0) * rr, y0 = c.y + Math.sin(a0) * rr, x1 = c.x + Math.cos(a1) * rr, y1 = c.y + Math.sin(a1) * rr;
          g.moveTo(x0, y0).quadraticCurveTo(c.x + Math.cos(am) * rr * sag, c.y + Math.sin(am) * rr * sag,
            x0 + (x1 - x0) * shown, y0 + (y1 - y0) * shown);
        }
      }
    };
    t.draw(D, (g, u) => {
      const time = u * D, a = fade(time);
      web(g, time);
      silk(g, 1.3, a);
      web(g, time);
      g.stroke({ width: 1.3, color: SILK, alpha: 0.75 * a, cap: "round" });
      // The current in it: beads of light running out along the radials to
      // gold nodes where the silk crosses, flickering.
      const run = span(time, 0.08, 0.7);
      if (run > 0 && run < 1)
        angles.forEach((ang, k) => {
          const f = (run * 1.6 + k * 0.23) % 1, L = lens[k], x = c.x + Math.cos(ang) * L * f, y = c.y + Math.sin(ang) * L * f;
          g.circle(x, y, s * 0.03).fill({ color: GOLD, alpha: 0.95 * a });
        });
      const nodes = span(time, SNAP_T, SNAP_T + 0.1) * (0.6 + 0.4 * Math.sin(time * 30));
      if (nodes > 0)
        angles.forEach((ang, k) => {
          for (const f of RINGS) {
            const rr = R * f;
            if (rr > lens[k]) continue;
            g.circle(c.x + Math.cos(ang) * rr, c.y + Math.sin(ang) * rr, s * 0.022).fill({ color: GOLD, alpha: 0.8 * nodes * a });
          }
        });
    });
    flare(t, c, s * 1.6, VIOLET, 0.45, 0.35);
    // Current snapping off the web as it pulls tight.
    let acc = 0;
    t.draw(0.6, (_g, u, dt) => {
      acc += 80 * (1 - u) * dt;
      for (; acc >= 1; acc--) {
        const k = Math.floor(rand(0, angles.length)), f = rand(0.2, 1), L = lens[k] * f;
        const x = c.x + Math.cos(angles[k]) * L, y = c.y + Math.sin(angles[k]) * L, a = rand(0, TAU), sp = rand(100, 220) * v;
        t.spark(x, y, Math.cos(a) * sp, Math.sin(a) * sp, rand(0.08, 0.18), Math.random() < 0.5 ? SNAP : SNAP_V);
      }
    }, { delay: 0.05 });

    // EVERY CARD IT CAUGHT, wound into a cocoon — the bite of it a flash as
    // the web closes — crackling while it holds.
    hits.forEach((h, i) => {
      const at = 0.08 + 0.18 * (h.d / R), sd = seed + i * 1.3;
      t.later(at, () => {
        flare(t, h.p, s * (1 + 0.2 * h.power), LILAC, 0.5, 0.25);
        for (let j = 0; j < Math.round(8 + 4 * h.power + (h.killed ? 6 : 0)); j++) {
          const a = rand(0, TAU), sp = rand(120, 260) * v;
          t.spark(h.p.x, h.p.y, Math.cos(a) * sp, Math.sin(a) * sp, rand(0.1, 0.22), SNAP);
        }
      });
      let beat = -1;
      t.draw(D - at, (g, u) => {
        const time = u * (D - at), wound = easeOut(span(time, 0, 0.32)), a = fade(time + at);
        cocoon(g, h.p, s, wound, a, sd);
        const b = Math.floor(time / BEAT);
        if (wound > 0.5 && b !== beat && time < 0.8) {
          beat = b;
          for (let k = 0; k < 2; k++) {
            const th = rand(0, TAU), x = h.p.x + Math.cos(th) * s * 0.44, y = h.p.y + Math.sin(th) * s * 0.46;
            spark(g, x, y, th + Math.PI / 2 + rand(-0.5, 0.5), s * 0.14, k ? GOLD : LILAC, 0.9 * a);
          }
        }
      }, { delay: at });
    });
  },
};
