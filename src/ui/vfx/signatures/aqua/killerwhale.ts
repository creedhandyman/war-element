/** KILLER WHALE — Tidal Crush. "6 DMG to every opponent in the row directly
 *  ahead and FREEZE them for 2 rounds. The row behind it takes 3 DMG and is
 *  FROZEN for 1 round." A killer whale that breaches into play and freezes the
 *  row ahead.
 *
 *  Its art is a hulking orca warrior, black and white, rising out of a
 *  crashing night sea with a barbed trident, its eyes and the trident's prongs
 *  lit electric blue. The DELIVERY is him calling the sea: the trident goes up
 *  over his card, current crackling on its prongs, and behind him the sea
 *  surges — a black swell standing up at his back, foam on its lip, spray
 *  thrown off it.
 *
 *  The LANDING is the crush. The swell rolls forward THROUGH his square and
 *  out along "ahead" as one black wall of water, fanning out to the width of
 *  the row it is aimed at, a torn white crest on its front — and riding it,
 *  just behind the crest, the orca's own dorsal fin cutting the water. The
 *  crest breaks over the row ahead (spray thrown up off every card, the fin
 *  diving) and FREEZES as it breaks: the foam line turns to a ridge of ice
 *  spikes standing where it broke, each card crusted over in ice. What spills
 *  past runs on as a smaller, thinner wash over the row behind, frosting as it
 *  goes, and leaves a lighter crust and a snowflake on each card there (the
 *  shorter freeze). The ice shatters off as it fades.
 *
 *  Black water is drawn dark for real (`dark: true`) and lit through with
 *  deep blue and a white crest, so it reads over an empty square; the ice is
 *  light. It never closes on anything — the sea does the moving — so it does
 *  not lunge. */
import { centre, rand } from "../../looks/base";
import type { Graphics } from "pixi.js";
import type { FxTools, Pt, SparkStyle } from "../../looks/types";
import type { Signature, SigMoment } from "../types";

type Box = SigMoment["from"];

const TAU = Math.PI * 2;
// The orca's sea: black water, lit deep blue through, white foam; the
// electric blue of its eyes and trident.
const INK = 0x03070d, DEEP = 0x123a70, BLUE = 0x2f7fe0, ELEC = 0x5cc8ff, PALE = 0xa8e6ff, FOAM = 0xf2fbff;
// The freeze at the end of the bite.
const ICE = 0xbfeeff, FROST = 0xe6f8ff, WHITE = 0xffffff;
/** Thrown up where the crest breaks: heavy, falling, white to deep. */
const SPRAY: SparkStyle = { palette: [FOAM, PALE, BLUE, DEEP], gravity: 950, drag: 0.55, size: [7, 3], streak: false };
/** Ice snapping off the frozen crest as it fades. */
const SHARD: SparkStyle = { palette: [WHITE, FROST, ICE, BLUE], gravity: 600, drag: 0.6, size: [8, 3], streak: true };
/** Frost glittering where the wash runs. */
const GLINT: SparkStyle = { palette: [WHITE, FROST, ICE], gravity: 30, drag: 0.4, size: [5, 2], streak: false };

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeOut = (x: number) => 1 - (1 - x) * (1 - x);

/** His frame: "ahead" (`a`) and across it (`n`), from his card's centre. */
function frame(m: SigMoment) {
  const c = centre(m.from), a = m.ahead, n = { x: -a.y, y: a.x };
  const at = (al: number, lat: number): Pt => ({ x: c.x + a.x * al + n.x * lat, y: c.y + a.y * al + n.y * lat });
  const local = (p: Pt) => ({ al: (p.x - c.x) * a.x + (p.y - c.y) * a.y, lat: (p.x - c.x) * n.x + (p.y - c.y) * n.y });
  return { c, a, n, at, local };
}
type Frame = ReturnType<typeof frame>;

/** The wave's front `F` ahead of his card, spanning `lo..hi` across: bowed
 *  forward in the middle, its edge rippling. Flat points. */
function frontLine(f: Frame, F: number, lo: number, hi: number, s: number, time: number, bow = 0.1): number[] {
  const pts: number[] = [], N = 18;
  for (let j = 0; j <= N; j++) {
    const k = j / N, lat = lo + (hi - lo) * k, q = k * 2 - 1;
    const p = f.at(F + s * bow * (1 - q * q) + s * 0.025 * Math.sin((lat / s) * 7 + time * 14), lat);
    pts.push(p.x, p.y);
  }
  return pts;
}

/** The water behind a front: the front's points, then back along `B`,
 *  narrowing behind (a wave fanning out as it runs) and its back edge ragged
 *  where it thins out. */
function sheet(f: Frame, front: number[], B: number, lo: number, hi: number): number[] {
  const out = front.slice(), mid = (lo + hi) / 2, half = (hi - lo) / 2;
  for (let j = 6; j >= 0; j--) {
    const k = j / 6, lat = mid + half * 0.72 * (k * 2 - 1), p = f.at(B + Math.abs(Math.sin(k * 9.1 + lo)) * half * 0.12, lat);
    out.push(p.x, p.y);
  }
  return out;
}

/** A lip of foam curling over off the crest: a short tightening hook from
 *  (x, y), setting off along (hx, hy) and turning to `side`. */
function curl(g: Graphics, x: number, y: number, hx: number, hy: number, len: number, side: number, alpha: number) {
  const pts = [x, y], d = 0.65 * side, cs = Math.cos(d), sn = Math.sin(d);
  let step = len * 0.3;
  for (let i = 0; i < 7; i++) {
    x += hx * step;
    y += hy * step;
    pts.push(x, y);
    const nx = hx * cs - hy * sn;
    hy = hx * sn + hy * cs;
    hx = nx;
    step *= 0.8;
  }
  g.poly(pts, false).stroke({ width: 4, color: PALE, alpha: 0.35 * alpha });
  g.poly(pts, false).stroke({ width: 1.6, color: FOAM, alpha: 0.95 * alpha });
}

/** The crest's foam: torn white lengths along the front, a softer pale band
 *  under them, and lips curling over every so often. */
function crest(g: Graphics, f: Frame, pts: number[], s: number, alpha: number, seed: number) {
  if (alpha <= 0.01) return;
  g.poly(pts, false).stroke({ width: Math.max(5, s * 0.12), color: PALE, alpha: 0.28 * alpha, cap: "round", join: "round" });
  const N = pts.length / 2 - 1;
  for (let j = 0; j < N; j += 3) {
    const e = Math.min(N, j + 2), piece: number[] = [];
    for (let k = j; k <= e; k++) piece.push(pts[2 * k], pts[2 * k + 1]);
    g.poly(piece, false).stroke({ width: 3.5, color: FOAM, alpha: 0.95 * alpha, cap: "round" });
  }
  for (let j = 2; j < N; j += 5) {
    const side = (j + Math.floor(seed)) % 2 ? 1 : -1;
    curl(g, pts[2 * j], pts[2 * j + 1], f.a.x, f.a.y, s * 0.2, side, alpha);
  }
}

/** The orca's dorsal fin standing out of the water at `b` (its base), `H`
 *  tall: a tall black hooked blade, its tip swept back to `sw` (screen side).
 *  Flat points. */
function fin(b: Pt, H: number, sw: number): number[] {
  const w = H * 0.3, pts: number[] = [];
  const q = (p0: Pt, p1: Pt, p2: Pt, from: number) => {
    for (let i = from; i <= 8; i++) {
      const u = i / 8, v = 1 - u;
      pts.push(b.x + sw * (v * v * p0.x + 2 * v * u * p1.x + u * u * p2.x), b.y + v * v * p0.y + 2 * v * u * p1.y + u * u * p2.y);
    }
  };
  const tip = { x: H * 0.34, y: -H };
  q({ x: -w, y: 0 }, { x: -w * 0.25, y: -H * 0.8 }, tip, 0); // the leading edge, rounding over
  q(tip, { x: w * 0.1, y: -H * 0.4 }, { x: w, y: 0 }, 1); // the trailing edge, hooked back in
  return pts;
}

/** Which way a fin moving along `a` sweeps its tip, on screen. */
const sweep = (a: Pt) => (Math.abs(a.x) > 0.5 ? -Math.sign(a.x) : 1);

/** His trident held up at the right of his card, `lift` raised: the shaft,
 *  the crossbar, three barbed prongs. Line segments (x0, y0, x1, y1), and its
 *  prong tips. */
function trident(c: Pt, s: number, lift: number) {
  const x = c.x + s * 0.27, top = c.y - s * 0.2 - lift * s * 0.3, bot = c.y + s * 0.46 - lift * s * 0.3;
  const sp = s * 0.12, pl = s * 0.27;
  const segs = [
    [x, bot, x, top],
    [x - sp, top, x + sp, top],
    [x - sp, top, x - sp * 1.15, top - pl * 0.85],
    [x, top, x, top - pl * 1.2],
    [x + sp, top, x + sp * 1.15, top - pl * 0.85],
    // Barbs, swept back down each prong.
    [x - sp * 1.1, top - pl * 0.55, x - sp * 1.5, top - pl * 0.3],
    [x, top - pl * 0.85, x - sp * 0.35, top - pl * 0.6],
    [x + sp * 1.1, top - pl * 0.55, x + sp * 1.5, top - pl * 0.3],
  ];
  const tips: Pt[] = [{ x: x - sp * 1.15, y: top - pl * 0.85 }, { x, y: top - pl * 1.2 }, { x: x + sp * 1.15, y: top - pl * 0.85 }];
  return { segs, tips };
}

export const KILLER_WHALE: Signature = {
  shake: 1.4,
  // The sea does the moving: he stands in it and sends it.
  lunge: false,

  deliver(t: FxTools, m: SigMoment, seconds: number) {
    const s = m.size, T = seconds, f = frame(m), { c } = f, seed = rand(0, 10);
    const lift = (u: number) => easeOut(clamp01(u / 0.55));
    // THE TRIDENT goes up: black steel, lit electric blue along its edges,
    // the prongs glowing hotter as it rises.
    t.draw(T, (g, u) => {
      const tr = trident(c, s, lift(u)), a = clamp01(u * 5);
      for (const q of tr.segs) g.moveTo(q[0], q[1]).lineTo(q[2], q[3]).stroke({ width: Math.max(3, s * 0.05), color: INK, alpha: 0.95 * a, cap: "round" });
    }, { dark: true });
    t.draw(T, (g, u) => {
      const tr = trident(c, s, lift(u)), a = clamp01(u * 5), hot = clamp01((u - 0.35) / 0.65);
      for (const q of tr.segs) {
        g.moveTo(q[0], q[1]).lineTo(q[2], q[3]).stroke({ width: Math.max(5, s * 0.09), color: ELEC, alpha: 0.16 * a, cap: "round" });
        g.moveTo(q[0], q[1]).lineTo(q[2], q[3]).stroke({ width: 1.3, color: PALE, alpha: 0.8 * a, cap: "round" });
      }
      for (const p of tr.tips) g.circle(p.x, p.y, s * (0.03 + 0.04 * hot)).fill({ color: ELEC, alpha: 0.5 * hot }).circle(p.x, p.y, s * 0.018).fill({ color: FOAM, alpha: a });
    });
    t.later(T * 0.7, () => t.arcs(trident(c, s, 1).tips[1], [FOAM, ELEC, BLUE], 0.25, 2));
    // THE SURGE at his back: a black swell standing up behind him, its
    // foam lip curling forward, spray thrown off it.
    const F = (u: number) => -s * 0.6 + s * 0.22 * easeOut(u);
    const grow = (u: number) => easeOut(clamp01(u / 0.7));
    const half = (u: number) => s * 0.62 * (0.6 + 0.4 * grow(u));
    t.draw(T, (g, u) => {
      const k = grow(u), w = half(u), pts = frontLine(f, F(u), -w, w, s, u * T, 0.12 * k);
      g.poly(sheet(f, pts, F(u) - s * 0.5 * k, -w, w), true).fill({ color: INK, alpha: 0.6 * k });
    }, { dark: true });
    let spray = 0;
    t.draw(T, (g, u, dt) => {
      const k = grow(u), w = half(u), pts = frontLine(f, F(u), -w, w, s, u * T, 0.12 * k);
      g.poly(sheet(f, pts, F(u) - s * 0.5 * k, -w, w), true).fill({ color: DEEP, alpha: 0.32 * k });
      g.poly(sheet(f, pts, F(u) - s * 0.18 * k, -w, w), true).fill({ color: BLUE, alpha: 0.18 * k });
      crest(g, f, pts, s, k, seed);
      spray += dt * 40 * t.quality * k;
      for (; spray >= 1; spray--) {
        const j = Math.floor(rand(0, pts.length / 2)), v = rand(60, 150) * (s / 90);
        t.spark(pts[2 * j], pts[2 * j + 1], f.a.x * v * 0.6 + rand(-20, 20), f.a.y * v * 0.6 - rand(70, 160) * (s / 90), rand(0.3, 0.45), SPRAY);
      }
    });
  },

  land(t: FxTools, m: SigMoment) {
    const s = m.size, f = frame(m), seed = rand(0, 10), sc = s / 90;
    // The two rows it reaches, by how far ahead each card stands.
    const hits = m.targets.map((r, i) => ({ r, p: centre(r), ...f.local(centre(r)), k: Math.max(0.5, Math.min(1.6, m.power[i] ?? 1)) }));
    const d1 = hits.length ? Math.min(...hits.map((h) => h.al)) : s * 1.07;
    const row1 = hits.filter((h) => h.al < d1 + s * 0.5), row2 = hits.filter((h) => h.al >= d1 + s * 0.5);
    const d2 = row2.length ? Math.min(...row2.map((h) => h.al)) : d1 + s * 1.07;
    const span = (hs: typeof hits, lo0: number, hi0: number) =>
      hs.length ? [Math.min(lo0, ...hs.map((h) => h.lat - s * 0.62)), Math.max(hi0, ...hs.map((h) => h.lat + s * 0.62))] : [lo0, hi0];
    const [lo1, hi1] = span(row1, -s * 0.62, s * 0.62);
    const [lo2, hi2] = row2.length ? span(row2, Infinity, -Infinity) : [lo1, hi1];

    // THE WAVE: from behind him, through his square, out to the row ahead,
    // fanning out to its width as it goes.
    const T1 = 0.24, F0 = -s * 0.42, F1 = d1 + s * 0.06;
    const Fat = (time: number) => F0 + (F1 - F0) * easeOut(clamp01(time / T1));
    const width = (time: number) => {
      const q = clamp01((Fat(time) - F0) / (F1 - F0));
      return [-s * 0.62 + (lo1 + s * 0.62) * q, s * 0.62 + (hi1 - s * 0.62) * q];
    };
    const D1 = T1 + 0.32;
    const drain = (time: number) => 1 - clamp01((time - T1) / (D1 - T1));
    const foamOn = (time: number) => 1 - clamp01((time - T1 - 0.03) / 0.1);
    /** The water deepening toward the crest: three sheets laid back from the
     *  front, so it builds to a wall rather than ending on a hard edge. */
    const depths = (time: number) => [1.3, 0.75, 0.32].map((d) => Math.max(F0 - s * 0.1, Fat(time) - s * d));

    // THE FIN riding the wave just behind its crest, cutting a white wake;
    // it dives as the crest breaks.
    const sw = sweep(f.a), lat0 = Math.max(lo1 + s * 0.3, Math.min(hi1 - s * 0.3, 0));
    const finAt = (time: number) => {
      const rise = easeOut(clamp01(time / 0.08)), dive = clamp01((time - T1 + 0.02) / 0.16);
      const b = f.at(Fat(time) - s * 0.3, lat0), H = s * 0.66 * rise * (1 - dive * dive);
      return { b: { x: b.x, y: b.y + s * 0.12 * dive }, H, a: 1 - dive };
    };
    const FIN = T1 + 0.16;

    t.draw(D1, (g, u) => {
      const time = u * D1, [lo, hi] = width(time), F = Fat(time), a = drain(time), pts = frontLine(f, F, lo, hi, s, time);
      for (const B of depths(time)) g.poly(sheet(f, pts, B, lo, hi), true).fill({ color: INK, alpha: 0.22 * a });
    }, { dark: true });
    let spray = 0;
    t.draw(D1, (g, u, dt) => {
      const time = u * D1, [lo, hi] = width(time), F = Fat(time), a = drain(time), pts = frontLine(f, F, lo, hi, s, time);
      // Foam streaks drawn back along the water behind the crest.
      for (const off of [0.32, 0.62]) {
        const st = frontLine(f, F - s * off, lo + s * 0.15, hi - s * 0.15, s, time + off * 3, 0.06);
        for (let j = 0; j + 2 < st.length / 2; j += 4)
          g.moveTo(st[2 * j], st[2 * j + 1]).lineTo(st[2 * j + 4], st[2 * j + 5]).stroke({ width: 1.5, color: PALE, alpha: 0.4 * a * (1 - off) });
      }
      depths(time).forEach((B, i) => g.poly(sheet(f, pts, B, lo, hi), true).fill({ color: i === 2 ? BLUE : DEEP, alpha: (i === 2 ? 0.14 : 0.12) * a }));
      crest(g, f, pts, s, foamOn(time), seed);
      if (time < T1) {
        spray += dt * 75 * t.quality;
        for (; spray >= 1; spray--) {
          const j = Math.floor(rand(0, pts.length / 2)), v = rand(80, 190) * sc;
          t.spark(pts[2 * j], pts[2 * j + 1], f.a.x * v + rand(-30, 30) * sc, f.a.y * v - rand(60, 150) * sc, rand(0.25, 0.4), SPRAY);
        }
      }
    });
    t.draw(FIN, (g, u) => {
      const q = finAt(u * FIN);
      if (q.H > 2) g.poly(fin(q.b, q.H, sw), true).fill({ color: INK, alpha: 0.95 * q.a });
    }, { dark: true });
    t.draw(FIN, (g, u) => {
      const q = finAt(u * FIN);
      if (q.H <= 2) return;
      g.poly(fin(q.b, q.H, sw), true).stroke({ width: 4, color: ELEC, alpha: 0.3 * q.a });
      g.poly(fin(q.b, q.H, sw), true).stroke({ width: 1.5, color: PALE, alpha: 0.95 * q.a });
      // The orca's white saddle patch, a pale crescent at the back of its base.
      const w = q.H * 0.32, sx = q.b.x + sw * w * 1.05, sy = q.b.y - q.H * 0.05;
      g.moveTo(sx - sw * w * 0.2, sy).quadraticCurveTo(sx + sw * w * 0.9, sy - q.H * 0.22, sx + sw * w * 1.6, sy)
        .quadraticCurveTo(sx + sw * w * 0.8, sy - q.H * 0.08, sx - sw * w * 0.2, sy).fill({ color: FOAM, alpha: 0.75 * q.a });
      // The wake: white water parting round its base and peeling back.
      g.ellipse(q.b.x, q.b.y, w * 1.4, w * 0.38).stroke({ width: 2.2, color: FOAM, alpha: 0.9 * q.a });
      for (const side of [-1, 1]) {
        const s0 = { x: q.b.x + side * w * 1.3, y: q.b.y };
        const e = { x: q.b.x - f.a.x * s * 0.3 + f.n.x * side * s * 0.32, y: q.b.y - f.a.y * s * 0.3 + f.n.y * side * s * 0.32 };
        const mid = { x: (s0.x + e.x) / 2 + f.n.x * side * s * 0.06, y: (s0.y + e.y) / 2 + f.n.y * side * s * 0.06 };
        g.moveTo(s0.x, s0.y).quadraticCurveTo(mid.x, mid.y, e.x, e.y).stroke({ width: 1.6, color: FOAM, alpha: 0.5 * q.a, cap: "round" });
      }
    });

    // THE CREST BREAKS on each card in the row ahead...
    for (const h of row1) {
      const q = clamp01((h.al - s * 0.15 - F0) / (F1 - F0)), when = T1 * (1 - Math.sqrt(1 - q));
      t.later(when, () => breakOn(t, h.r, h.p, h.k, f.a, s));
    }
    // ...and freezes where it broke: a ridge of ice spikes standing on the
    // line of the crest, shattering away as it fades.
    const spikes: Array<{ lat: number; h: number; lean: number; w: number; back: boolean }> = [];
    for (let lat = lo1 + s * 0.05; lat <= hi1 - s * 0.05; lat += s * 0.15)
      spikes.push({ lat: lat + rand(-0.03, 0.03) * s, h: s * rand(0.16, 0.32), lean: rand(-0.35, 0.35), w: s * rand(0.045, 0.07), back: Math.random() < 0.3 });
    const ICE_D = 1.0 - T1;
    const iceA = (time: number) => (time < 0.55 ? 1 : 1 - clamp01((time - 0.55) / (ICE_D - 0.55)));
    t.draw(ICE_D, (g, u) => {
      const time = u * ICE_D, grow = easeOut(clamp01(time / 0.12)), a = iceA(time), line = frontLine(f, F1, lo1, hi1, s, T1);
      g.poly(line, false).stroke({ width: Math.max(3, s * 0.05), color: ICE, alpha: 0.45 * a * grow, join: "round" });
      g.poly(line, false).stroke({ width: 1.3, color: WHITE, alpha: 0.9 * a * grow, join: "round" });
      const wide = hi1 - lo1;
      for (const sp of spikes) {
        const k = clamp01((sp.lat - lo1) / wide), qq = k * 2 - 1;
        const base = f.at(F1 + s * 0.1 * (1 - qq * qq), sp.lat), H = sp.h * grow * (sp.back ? -0.6 : 1), L = Math.abs(H) * sp.lean;
        const tip = { x: base.x + f.a.x * H + f.n.x * L, y: base.y + f.a.y * H + f.n.y * L };
        const tri = [base.x + f.n.x * sp.w, base.y + f.n.y * sp.w, tip.x, tip.y, base.x - f.n.x * sp.w, base.y - f.n.y * sp.w];
        g.poly(tri, true).fill({ color: ICE, alpha: 0.32 * a }).stroke({ width: 1.4, color: FROST, alpha: 0.95 * a });
        g.moveTo(base.x, base.y).lineTo(tip.x, tip.y).stroke({ width: 1, color: WHITE, alpha: 0.7 * a });
      }
    }, { delay: T1 });
    t.later(T1 + 0.62, () => {
      const n = Math.round(Math.min(14, spikes.length) * t.quality);
      for (let i = 0; i < n; i++) {
        const sp = spikes[Math.floor(rand(0, spikes.length))], p = f.at(F1 + s * 0.05, sp.lat), ang = rand(0, TAU), v = rand(50, 140) * sc;
        t.spark(p.x, p.y, Math.cos(ang) * v, Math.sin(ang) * v - 60 * sc, rand(0.3, 0.5), SHARD);
      }
    });

    // THE WASH: what spills past runs on over the row behind, thinner and
    // lower, frosting as it goes.
    const W0 = T1 + 0.03, RUNW = 0.3, WD = RUNW + 0.32, G0 = F1 + s * 0.05, G1 = d2 + s * 0.08;
    const Gat = (time: number) => G0 + (G1 - G0) * easeOut(clamp01(time / RUNW));
    const wSpan = (time: number) => {
      const q = clamp01((Gat(time) - G0) / Math.max(1, G1 - G0));
      return [lo1 + (lo2 - lo1) * q, hi1 + (hi2 - hi1) * q];
    };
    const wFade = (time: number) => clamp01(time / 0.05) * (1 - clamp01((time - RUNW * 0.7) / (WD - RUNW * 0.7)));
    t.draw(WD, (g, u) => {
      const time = u * WD, [lo, hi] = wSpan(time), G = Gat(time), pts = frontLine(f, G, lo, hi, s, time, 0.07);
      g.poly(sheet(f, pts, Math.max(G0 - s * 0.1, G - s * 0.7), lo, hi), true).fill({ color: INK, alpha: 0.22 * wFade(time) });
    }, { dark: true, delay: W0 });
    let glint = 0;
    t.draw(WD, (g, u, dt) => {
      const time = u * WD, [lo, hi] = wSpan(time), G = Gat(time), a = wFade(time), pts = frontLine(f, G, lo, hi, s, time, 0.07);
      const cold = clamp01(time / RUNW) > 0.5;
      g.poly(sheet(f, pts, Math.max(G0 - s * 0.1, G - s * 0.7), lo, hi), true).fill({ color: DEEP, alpha: 0.18 * a });
      g.poly(pts, false).stroke({ width: Math.max(3, s * 0.05), color: cold ? ICE : PALE, alpha: 0.3 * a, join: "round" });
      g.poly(pts, false).stroke({ width: 1.6, color: cold ? WHITE : FOAM, alpha: 0.85 * a, join: "round" });
      if (time < RUNW) {
        glint += dt * 45 * t.quality;
        for (; glint >= 1; glint--) {
          const j = Math.floor(rand(0, pts.length / 2));
          t.spark(pts[2 * j], pts[2 * j + 1], rand(-15, 15) * sc, -rand(10, 40) * sc, rand(0.35, 0.6), cold ? GLINT : SPRAY);
        }
      }
    }, { delay: W0 });
    for (const h of row2) {
      const q = clamp01((h.al - s * 0.1 - G0) / Math.max(1, G1 - G0)), when = W0 + RUNW * (1 - Math.sqrt(1 - q));
      t.later(when, () => frostOn(t, h.r, h.p, h.k, s));
    }
  },
};

/** The crest breaking on a card in the row ahead: spray thrown up and on, a
 *  ring of white water — then it freezes on the card, a crust of ice closing
 *  over its face with cracks through it. */
function breakOn(t: FxTools, r: Box, p: Pt, k: number, a: Pt, s: number) {
  const sc = s / 90, n = Math.round(12 * k);
  for (let i = 0; i < n; i++) {
    const ang = Math.atan2(a.y, a.x) + rand(-1.2, 1.2), v = rand(130, 280) * sc;
    t.spark(p.x, p.y, Math.cos(ang) * v, Math.sin(ang) * v - rand(80, 170) * sc, rand(0.3, 0.5), SPRAY);
  }
  t.ring(r, FOAM, 0.3, 1.05, 0.35, 3);
  t.flash(p, PALE, 0.2 * k);
  t.later(0.04, () => crust(t, p, s * 0.42, 0.9, 1));
}

/** The wash reaching a card in the row behind: a little white water, then a
 *  lighter crust of frost and a snowflake on its face. */
function frostOn(t: FxTools, r: Box, p: Pt, k: number, s: number) {
  const sc = s / 90;
  for (let i = 0; i < Math.round(6 * k + 2); i++) {
    const ang = -Math.PI / 2 + rand(-1.2, 1.2), v = rand(70, 150) * sc;
    t.spark(p.x + rand(-0.2, 0.2) * s, p.y, Math.cos(ang) * v, Math.sin(ang) * v, rand(0.3, 0.45), i % 2 ? GLINT : SPRAY);
  }
  t.ring(r, FROST, 0.3, 0.85, 0.3, 2);
  crust(t, p, s * 0.36, 0.5, 0.6);
  const rot = rand(0, TAU);
  t.draw(0.5, (g, u) => {
    const R = s * 0.2 * easeOut(clamp01(u / 0.3)), a = u < 0.6 ? 1 : 1 - (u - 0.6) / 0.4;
    for (let i = 0; i < 6; i++) {
      const ang = rot + (i / 6) * TAU, ux = Math.cos(ang), uy = Math.sin(ang);
      g.moveTo(p.x, p.y).lineTo(p.x + ux * R, p.y + uy * R).stroke({ width: 1.5, color: FROST, alpha: 0.85 * a });
      const bx = p.x + ux * R * 0.55, by = p.y + uy * R * 0.55;
      for (const sd of [-1, 1]) {
        const ba = ang + sd * (Math.PI / 3);
        g.moveTo(bx, by).lineTo(bx + Math.cos(ba) * R * 0.3, by + Math.sin(ba) * R * 0.3).stroke({ width: 1.2, color: FROST, alpha: 0.8 * a });
      }
    }
  });
}

/** A crust of ice closing over a card's face: a faceted pane, glassy, its
 *  rim bright, cracks run through it; held, then gone. */
function crust(t: FxTools, p: Pt, R: number, seconds: number, strength: number) {
  const N = 9, rr = Array.from({ length: N }, () => rand(0.82, 1.05)), a0 = rand(0, TAU);
  const cracks = Array.from({ length: 3 }, () => ({ a: rand(0, TAU), k: rand(0.4, 0.75), b: rand(-0.5, 0.5) }));
  t.draw(seconds, (g, u) => {
    const grow = easeOut(clamp01(u / 0.18)), a = strength * (u < 0.6 ? 1 : 1 - (u - 0.6) / 0.4), pts: number[] = [];
    for (let i = 0; i < N; i++) {
      const ang = a0 + (i / N) * TAU;
      pts.push(p.x + Math.cos(ang) * R * rr[i] * grow, p.y + Math.sin(ang) * R * rr[i] * grow);
    }
    g.poly(pts, true).fill({ color: ICE, alpha: 0.16 * a }).stroke({ width: 1.6, color: FROST, alpha: 0.85 * a });
    for (const c of cracks) {
      const mx = p.x + Math.cos(c.a) * R * c.k * 0.5 * grow, my = p.y + Math.sin(c.a) * R * c.k * 0.5 * grow;
      const ex = p.x + Math.cos(c.a + c.b) * R * c.k * grow, ey = p.y + Math.sin(c.a + c.b) * R * c.k * grow;
      g.moveTo(p.x, p.y).lineTo(mx, my).lineTo(ex, ey).stroke({ width: 1.1, color: WHITE, alpha: 0.7 * a });
    }
  });
}
