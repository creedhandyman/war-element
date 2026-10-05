/** ADAMANT — Adamantize. "Harden allies' armour: each ally gains BLOCK 2 for
 *  2 rounds." — one cast hardens your whole line.
 *
 *  On its art Adamant is a hooded mage in faceted crystal armour, a crystal
 *  staff in one hand and the other raised, and round its allies glow
 *  violet-blue SHIELD-DOMES built of hexagonal facets. It targets itself, so
 *  there is no delivery: the landing is the whole move.
 *
 *  The staff's crystal flares violet-blue over its card and a hexagon of light
 *  rings out from it. Crystal veins race out across the ground to every ally —
 *  straight, angular runs that kink like a growing crystal, short spurs
 *  budding off them as they go. Where a vein arrives, the armour GROWS: cut-gem
 *  plates rise from the ground up round the card, facet by facet, each one
 *  snapping into place until they lock into a faceted hexagonal shell. It
 *  rings as it locks, then the light runs round the facets one by one as each
 *  catches it, and the shell settles to a faint faceted sheen and fades (the
 *  BLOCK the board then draws).
 *
 *  Crystal GROWING, not stone slamming: everything is light (additive) in
 *  violet and ice blue, the facets shaded by which way they face so the shell
 *  reads as a cut gem; only the shell's outline is laid in deep violet on the
 *  normal layer, so it holds its edge on a pale card. Little shake. */
import { centre, rand } from "../../looks/base";
import type { Graphics } from "pixi.js";
import type { FxTools, Pt, SparkStyle } from "../../looks/types";
import type { Signature, SigMoment } from "../types";

type Box = SigMoment["from"];

const TAU = Math.PI * 2;
/** Adamant crystal: violet, ice blue, its pale lilac edges, white glints. */
const VIOLET = 0x8f6bff, BLUE = 0x5aa2ff, ICE = 0xcad6ff, WHITE = 0xf6f2ff;
/** The deep violet a shell's edge is laid in, on the normal layer. */
const DEEP = 0x2a1870;
/** Glints chipped off as a shell locks: they hang a moment and fade. */
const GLINT: SparkStyle = { palette: [WHITE, ICE, VIOLET], gravity: 60, drag: 0.3, size: [4, 1], streak: false };

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeOut = (x: number) => 1 - (1 - x) * (1 - x);
/** Overshoots and settles: a plate snapping into place. */
const snap = (x: number) => { const c = 2.2; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };

// ── The shell ────────────────────────────────────────────────────────────────

/** One facet of a shell: its corners, where it grows from (its lowest corner),
 *  the way it faces (angle from the centre), and when it grows. */
interface Facet { pts: Pt[]; anchor: Pt; ang: number; inner: boolean; at: number; shade: number }

/** A cut-gem shell round `p`, `R` across: a pointy-topped hexagon, its rim cut
 *  into twelve triangular facets and a ring of six fainter ones round the
 *  middle (so the card stays readable). Each facet is shaded by how squarely it
 *  faces the light, top-left, and grows in order from the ground up. */
function shell(p: Pt, R: number, grow: number): Facet[] {
  const v = (r: number, k: number): Pt => ({ x: p.x + Math.cos(-Math.PI / 2 + (k * TAU) / 6) * r, y: p.y + Math.sin(-Math.PI / 2 + (k * TAU) / 6) * r });
  const out: Facet[] = [];
  const add = (pts: Pt[], inner: boolean) => {
    const cx = pts.reduce((a, q) => a + q.x, 0) / pts.length, cy = pts.reduce((a, q) => a + q.y, 0) / pts.length;
    const ang = Math.atan2(cy - p.y, cx - p.x);
    const anchor = pts.reduce((a, q) => (q.y > a.y ? q : a), pts[0]);
    out.push({ pts, anchor, ang, inner, at: 0, shade: 0.5 + 0.5 * Math.cos(ang + (3 * Math.PI) / 4) });
  };
  for (let k = 0; k < 6; k++) {
    const o0 = v(R, k), o1 = v(R, k + 1), i0 = v(R * 0.52, k), i1 = v(R * 0.52, k + 1);
    add([o0, o1, i0], false);
    add([o1, i1, i0], false);
    add([p, i0, i1], true);
  }
  // From the ground up: the lowest facets first, the crown last.
  const ys = out.map((f) => f.anchor.y + f.pts.reduce((a, q) => a + q.y, 0) / 3);
  const order = out.map((_, i) => i).sort((a, b) => ys[b] - ys[a]);
  order.forEach((idx, n) => (out[idx].at = (n / out.length) * grow));
  return out;
}

/** A facet grown `e` of the way out of its anchor, as flat points. */
function grown(f: Facet, e: number): number[] {
  return f.pts.flatMap((q) => [f.anchor.x + (q.x - f.anchor.x) * e, f.anchor.y + (q.y - f.anchor.y) * e]);
}

/** The hexagon outline, `R` across, round `p`. */
function hex(p: Pt, R: number): number[] {
  const pts: number[] = [];
  for (let k = 0; k < 6; k++) pts.push(p.x + Math.cos(-Math.PI / 2 + (k * TAU) / 6) * R, p.y + Math.sin(-Math.PI / 2 + (k * TAU) / 6) * R);
  return pts;
}

/** Times inside one shell's life, s from when its vein arrives. */
const GROW = 0.3, PLATE = 0.09, LOCK = GROW + PLATE, SWEEP = 0.24, SHELL = 0.76;

/** The armour growing over one ally: plates rising and snapping together from
 *  the ground up, a ring as it locks, the light running round its facets, a
 *  settle to a faint sheen, gone. */
function armour(t: FxTools, r: Box, delay: number) {
  const p = centre(r), s = Math.min(r.w, r.h), R = s * 0.64;
  const facets = shell(p, R, GROW), spin = rand(0, TAU);
  const life = (time: number) => (time < LOCK + SWEEP ? 1 : 1 - 0.65 * clamp01((time - LOCK - SWEEP) / 0.12)) * (1 - clamp01((time - SHELL + 0.2) / 0.2));
  // The edge, laid in deep violet on the normal layer, so the shell keeps its
  // shape over a pale card.
  t.draw(SHELL, (g, u) => {
    const time = u * SHELL, a = clamp01((time - GROW * 0.5) / (LOCK - GROW * 0.5)) * life(time);
    if (a > 0.02) g.poly(hex(p, R), true).stroke({ width: 3, color: DEEP, alpha: 0.45 * a, join: "round" });
  }, { dark: true, delay });
  t.draw(SHELL, (g, u) => {
    const time = u * SHELL, fade = life(time);
    const sweep = time > LOCK ? spin + ((time - LOCK) / SWEEP) * TAU : -99;
    for (const f of facets) {
      const q = clamp01((time - f.at) / PLATE);
      if (q <= 0) continue;
      const e = snap(q), pts = grown(f, e);
      // Each facet catches the light as the sweep goes by it.
      const d = Math.cos(f.ang - sweep), catchLight = time > LOCK && time < LOCK + SWEEP + 0.05 ? Math.pow(Math.max(0, d), 10) : 0;
      const base = f.inner ? 0.07 : 0.18 + 0.24 * f.shade;
      const col = f.inner ? BLUE : f.shade > 0.5 ? VIOLET : BLUE;
      g.poly(pts, true).fill({ color: col, alpha: base * fade });
      if (catchLight > 0.02) g.poly(pts, true).fill({ color: WHITE, alpha: 0.45 * catchLight * fade });
      g.poly(pts, true).stroke({ width: f.inner ? 1 : 1.4, color: ICE, alpha: (f.inner ? 0.4 : 0.85) * fade * Math.min(1, q * 3), join: "round" });
      // A plate just landing flashes its edge.
      if (q < 1) g.poly(pts, true).stroke({ width: 2, color: WHITE, alpha: 0.7 * (1 - q) });
    }
    // The lock: the rim rings white.
    const ring = time > LOCK ? 1 - clamp01((time - LOCK) / 0.18) : 0;
    if (ring > 0) g.poly(hex(p, R), true).stroke({ width: 3, color: WHITE, alpha: 0.9 * ring, join: "round" });
  }, { delay });
  t.later(delay + LOCK, () => {
    t.flash({ x: p.x, y: p.y - R * 0.55 }, ICE, 0.18 * (s / 90));
    t.ring(r, VIOLET, 1.0, 1.35, 0.3, 2);
    const n = Math.round(6 * t.quality);
    for (let k = 0; k < n; k++) {
      const a = -Math.PI / 2 + (k * TAU) / 6, x = p.x + Math.cos(a) * R, y = p.y + Math.sin(a) * R;
      t.spark(x, y, Math.cos(a) * 30 * (s / 90), Math.sin(a) * 30 * (s / 90) - 15, rand(0.3, 0.5), GLINT);
    }
  });
}

// ── The veins ────────────────────────────────────────────────────────────────

/** A crystal vein from `a` to `b`: straight runs with sharp kinks, and a short
 *  spur budding off at each kink. Points, and each spur with the length along
 *  the vein where it buds. */
function vein(a: Pt, b: Pt, s: number) {
  const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
  const N = Math.max(3, Math.round(L / (s * 0.45)));
  const pts: Pt[] = [a];
  for (let i = 1; i < N; i++) {
    const o = rand(-0.1, 0.1) * s;
    pts.push({ x: a.x + (dx * i) / N + nx * o, y: a.y + (dy * i) / N + ny * o });
  }
  pts.push(b);
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  const spurs = pts.slice(1, -1).map((q, i) => {
    const ang = Math.atan2(dy, dx) + (i % 2 ? 1 : -1) * rand(0.7, 1.0);
    return { q, at: cum[i + 1], ang, len: s * rand(0.1, 0.16) };
  });
  return { pts, cum, total: cum[cum.length - 1], spurs };
}

/** The vein drawn out to `run` px of its length: a violet glow under an ice
 *  core, a bright diamond at its growing head, spurs budding behind it. */
function drawVein(g: Graphics, V: ReturnType<typeof vein>, run: number, alpha: number, head: boolean) {
  if (alpha <= 0.02 || run <= 0) return;
  const flat: number[] = [V.pts[0].x, V.pts[0].y];
  let hx = V.pts[0].x, hy = V.pts[0].y;
  for (let i = 1; i < V.pts.length; i++) {
    if (V.cum[i] <= run) { flat.push(V.pts[i].x, V.pts[i].y); hx = V.pts[i].x; hy = V.pts[i].y; continue; }
    const f = (run - V.cum[i - 1]) / (V.cum[i] - V.cum[i - 1]);
    hx = V.pts[i - 1].x + (V.pts[i].x - V.pts[i - 1].x) * f;
    hy = V.pts[i - 1].y + (V.pts[i].y - V.pts[i - 1].y) * f;
    flat.push(hx, hy);
    break;
  }
  g.poly(flat, false).stroke({ width: 6, color: VIOLET, alpha: 0.3 * alpha, join: "miter" });
  g.poly(flat, false).stroke({ width: 1.8, color: ICE, alpha: 0.95 * alpha, join: "miter" });
  for (const sp of V.spurs) {
    const grow = clamp01((run - sp.at) / (sp.len * 2));
    if (grow <= 0) continue;
    const ex = sp.q.x + Math.cos(sp.ang) * sp.len * grow, ey = sp.q.y + Math.sin(sp.ang) * sp.len * grow;
    g.moveTo(sp.q.x, sp.q.y).lineTo(ex, ey).stroke({ width: 1.5, color: ICE, alpha: 0.8 * alpha });
    gem(g, { x: ex, y: ey }, 3 * grow, sp.ang, BLUE, 0.9 * alpha);
  }
  if (head) gem(g, { x: hx, y: hy }, 5, Math.atan2(V.pts[1].y - V.pts[0].y, V.pts[1].x - V.pts[0].x), WHITE, alpha);
}

/** A small cut diamond at `p`, `r` long, pointing along `ang`. */
function gem(g: Graphics, p: Pt, r: number, ang: number, color: number, alpha: number) {
  if (r < 0.5 || alpha <= 0.02) return;
  const ux = Math.cos(ang), uy = Math.sin(ang), w = r * 0.55;
  g.poly([p.x + ux * r, p.y + uy * r, p.x - uy * w, p.y + ux * w, p.x - ux * r * 0.6, p.y - uy * r * 0.6, p.x + uy * w, p.y - ux * w], true)
    .fill({ color, alpha });
}

// ── The staff ────────────────────────────────────────────────────────────────

/** The staff's crystal over its card: a long six-sided gem, `h` tall, its
 *  faces lit from top-left, flaring by `flare`. */
function staffGem(g: Graphics, p: Pt, h: number, flare: number, alpha: number) {
  const w = h * 0.36;
  const P = [[0, -h], [w, -h * 0.4], [w, h * 0.45], [0, h], [-w, h * 0.45], [-w, -h * 0.4]].map(([x, y]) => ({ x: p.x + x, y: p.y + y }));
  g.circle(p.x, p.y, h * (1.2 + 0.6 * flare)).fill({ color: VIOLET, alpha: 0.18 * alpha * (0.5 + flare) });
  for (let k = 0; k < 6; k++) {
    const a = P[k], b = P[(k + 1) % 6], mid = Math.atan2((a.y + b.y) / 2 - p.y, (a.x + b.x) / 2 - p.x);
    const lit = 0.5 + 0.5 * Math.cos(mid + (3 * Math.PI) / 4);
    g.poly([p.x, p.y, a.x, a.y, b.x, b.y], true).fill({ color: lit > 0.5 ? ICE : VIOLET, alpha: (0.3 + 0.4 * lit) * alpha });
  }
  g.poly(P.flatMap((q) => [q.x, q.y]), true).stroke({ width: 1.5, color: WHITE, alpha: 0.9 * alpha, join: "round" });
  g.circle(p.x, p.y, h * 0.18 * (1 + flare)).fill({ color: WHITE, alpha: 0.85 * alpha * flare });
}

export const ADAMANT: Signature = {
  // Hardening, not a blow: the board barely stirs.
  shake: 0.3,
  lunge: false,

  land(t: FxTools, m: SigMoment) {
    const s = m.size, c = centre(m.from), top = { x: c.x, y: c.y - s * 0.12 };

    // THE STAFF FLARES: its crystal blazing violet-blue over the card, a
    // hexagon of light ringing out from it.
    const FL = 0.6;
    t.draw(FL, (g, u) => {
      const time = u * FL, rise = easeOut(clamp01(time / 0.12)), flare = Math.max(0, 1 - Math.abs(time - 0.14) / 0.14);
      staffGem(g, { x: top.x, y: top.y - s * 0.04 * rise }, s * 0.22 * rise, flare, 1 - clamp01((time - 0.35) / 0.25));
      const hr = easeOut(clamp01((time - 0.08) / 0.4));
      if (hr > 0) g.poly(hex(c, s * (0.4 + 0.5 * hr)), true).stroke({ width: 2.5, color: VIOLET, alpha: 0.85 * (1 - hr) });
    });
    t.later(0.12, () => {
      t.flash(top, ICE, 0.3 * (s / 90));
      t.glow(m.from, VIOLET, 0.4, 0.5, 1.1);
    });

    // THE VEINS, racing out to every ally — the farthest takes longest — and
    // where each arrives, the armour grows.
    const far = Math.max(s, ...m.allies.map((r) => Math.hypot(centre(r).x - c.x, centre(r).y - c.y)));
    for (const r of m.allies) {
      const p = centre(r), d = Math.hypot(p.x - c.x, p.y - c.y);
      const go = 0.08, arrive = go + 0.08 + 0.16 * (d / far), V = vein({ x: c.x, y: c.y + s * 0.2 }, { x: p.x, y: p.y + s * 0.2 }, s);
      const D = 0.75;
      t.draw(D, (g, u) => {
        const time = u * D, run = V.total * easeOut(clamp01(time / (arrive - go)));
        drawVein(g, V, run, 1 - clamp01((time - (arrive - go) - 0.12) / 0.3), time < arrive - go);
      }, { delay: go });
      armour(t, r, arrive);
    }
  },
};
