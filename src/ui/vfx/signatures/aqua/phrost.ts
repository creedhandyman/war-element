/** PHROST — Icicle Freeze. "Deal 4 DMG x2 and FREEZE up to 2 opponents for 2
 *  rounds." A frost dragon: it freezes you in place, then scalds whatever it
 *  has frozen.
 *
 *  On her art Phrost hurls a long ice spear that burns electric blue down its
 *  core, and the frost dragon coils behind her. The DELIVERY is the two of
 *  them working as one: the frost dragon rears up over her card — seen from
 *  above, as the board is, its horned head lifting and its great wings
 *  opening behind her — and breathes a cold white mist along her aim; in
 *  that breath her javelins freeze out of the air, one beside her for each
 *  mark, glassy, the blue light running down their cores. She hurls them;
 *  the breath freezes a second pair at once and she hurls those too, a beat
 *  behind (4 DMG, twice). The first pair lands on the landing frame, the
 *  second just after it.
 *
 *  The LANDING is each javelin shattering into its card — splinters flung on
 *  through it and back off it — and HOARFROST: feathery rime ferns creeping
 *  in over the card from its edges, branching as they grow, the second spear
 *  thickening the crust. Of the three ice legendaries hers is the AIR's ice:
 *  glass, breath and rime, bright and airy, where Polar King's is cut crystal
 *  and Glacius's the glacier.
 *
 *  All of it is light (additive): white frost and electric azure on the dark
 *  board, nothing painting dark, and the rime is drawn as lines so the card
 *  reads through its crust. */
import { centre, rand } from "../../looks/base";
import type { Graphics } from "pixi.js";
import type { FxTools, Pt, SparkStyle } from "../../looks/types";
import type { Signature, SigMoment } from "../types";

type Box = SigMoment["from"];

// Her ice: white at the edges, a glassy pale blue through, and the electric
// azure that burns down a javelin's core on the art.
const WHITE = 0xffffff, FROST = 0xeaf8ff, PALE = 0xbfe6ff, AZURE = 0x48b4ff;
/** The dragon: a spectral frost-white, edged pale. */
const DRAGON = 0xcfe8ff;
/** The dragon's cold breath: white, swelling as it thins and drifts. */
const MIST: SparkStyle = { palette: [WHITE, FROST, PALE], gravity: -20, drag: 0.45, size: [6, 16], streak: false };
/** Frost glittering off a javelin in flight, hanging where it passed. */
const GLINT: SparkStyle = { palette: [WHITE, FROST, AZURE], gravity: 30, drag: 0.4, size: [4, 1.5], streak: false };
/** A splinter off a shattered javelin, glinting as it falls. */
const SHARD: SparkStyle = { palette: [WHITE, FROST, PALE, AZURE], gravity: 480, drag: 0.55, size: [8, 2.5], streak: true };

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeOut = (x: number) => 1 - (1 - x) * (1 - x);

/** The second javelin at each mark lands this long after the first, s. */
const BEAT = 0.12;

// ── The javelin ──────────────────────────────────────────────────────────────

/** An ice javelin with its point at `tip`, heading along `ang`, `len` long:
 *  a long faceted blade of glass — a broad head that narrows to a long shaft
 *  and a sharp tail — with the electric-blue core burning down its length and
 *  a white spine. `form` (0..1) is how far it has frozen out of the air: the
 *  point first, the rest following it. */
function javelin(g: Graphics, tip: Pt, ang: number, len: number, w: number, alpha: number, form = 1) {
  if (alpha <= 0.02 || form <= 0.02) return;
  const ux = Math.cos(ang), uy = Math.sin(ang), nx = -uy, ny = ux, L = len * form, W = w * (0.4 + 0.6 * form);
  const at = (d: number, side: number) => [tip.x - ux * d + nx * side, tip.y - uy * d + ny * side];
  const pts = [tip.x, tip.y, ...at(L * 0.2, W), ...at(L * 0.3, W * 0.45), ...at(L * 0.75, W * 0.4), ...at(L, 0),
    ...at(L * 0.75, -W * 0.4), ...at(L * 0.3, -W * 0.45), ...at(L * 0.2, -W)];
  const [tx, ty] = at(L, 0), [mx, my] = at(L * 0.5, 0);
  g.moveTo(tx, ty).lineTo(tip.x, tip.y).stroke({ width: W * 3.2, color: AZURE, alpha: 0.18 * alpha, cap: "round" });
  g.poly(pts, true).fill({ color: PALE, alpha: 0.32 * alpha }).stroke({ width: 1.4, color: FROST, alpha: 0.95 * alpha, join: "miter" });
  g.moveTo(tx, ty).lineTo(tip.x, tip.y).stroke({ width: Math.max(1.5, W * 0.55), color: AZURE, alpha: 0.75 * alpha });
  g.moveTo(mx, my).lineTo(tip.x, tip.y).stroke({ width: 1, color: WHITE, alpha: 0.95 * alpha });
}

// ── The dragon ───────────────────────────────────────────────────────────────

// The frost dragon seen from above, as the board is: u along its snout (the
// tip at +0.5), v across it. Fractions of the head's length; each shape is
// one half, mirrored across the snout.
const HEAD: [number, number][] = [[0.5, 0], [0.44, 0.07], [0.18, 0.11], [0.04, 0.19], [-0.12, 0.25], [-0.26, 0.19], [-0.36, 0.09], [-0.4, 0]];
const HORN: [number, number][] = [[-0.2, 0.17], [-0.3, 0.2], [-0.62, 0.36], [-0.86, 0.46], [-0.58, 0.3]];
const FRILL: [number, number][] = [[-0.08, 0.24], [-0.16, 0.25], [-0.34, 0.42]];
const NECK: [number, number][] = [[-0.38, 0.09], [-0.7, 0.12], [-1.0, 0.14], [-1.15, 0]];
/** A wing: shoulder, wrist, three finger tips, and where the membrane meets
 *  the body — spread `span` (0 folded, 1 open). */
const WING = (span: number): { bones: [number, number][]; edge: [number, number][] } => {
  const w = (u: number, v: number, fold: number): [number, number] => [u, v * (fold + (1 - fold) * span)];
  const sh = w(-0.7, 0.14, 1), wr = w(-0.3, 0.95, 0.3);
  const tips = [w(-0.4, 1.6, 0.2), w(-0.9, 1.45, 0.2), w(-1.2, 0.95, 0.3)];
  return { bones: [sh, wr, ...tips], edge: [wr, tips[0], w(-0.8, 1.32, 0.2), tips[1], w(-1.12, 1.1, 0.25), tips[2], w(-1.2, 0.5, 0.4), w(-1.05, 0.14, 1)] };
};

/** The frost dragon from above, its head at `h` facing `a` (unit), the head
 *  `L` long, wings spread `span`: a spectral dragon of frost light — a horned,
 *  frilled head with burning azure eyes, a spined neck, and two great wings
 *  opening behind it, finger-boned and scalloped, as they spread behind
 *  Phrost on her art. Lines and a pale fill, so it reads as the dragon's cold
 *  and not as a solid, and her card shows through it. */
function dragon(g: Graphics, h: Pt, a: Pt, L: number, span: number, alpha: number) {
  if (alpha <= 0.02) return;
  const P = (u: number, v: number) => [h.x + (a.x * u - a.y * v) * L, h.y + (a.y * u + a.x * v) * L];
  const half = (pts: [number, number][], side: number) => pts.flatMap(([u, v]) => P(u, v * side));
  const both = (pts: [number, number][]) => [...half(pts, 1), ...half([...pts].reverse(), -1)];
  const lw = Math.max(1.3, L * 0.022);
  // The wings first, under the rest: a faint membrane, bright bones.
  const wing = WING(span);
  for (const side of [-1, 1]) {
    g.poly(half(wing.edge, side), true).fill({ color: DRAGON, alpha: 0.09 * alpha }).stroke({ width: lw * 0.8, color: PALE, alpha: 0.6 * alpha, join: "round" });
    const [sx, sy] = P(wing.bones[0][0], wing.bones[0][1] * side), [wx, wy] = P(wing.bones[1][0], wing.bones[1][1] * side);
    g.moveTo(sx, sy).lineTo(wx, wy).stroke({ width: lw * 1.3, color: FROST, alpha: 0.9 * alpha, cap: "round" });
    for (const tip of wing.bones.slice(2)) {
      const [tx, ty] = P(tip[0], tip[1] * side);
      g.moveTo(wx, wy).lineTo(tx, ty).stroke({ width: lw * 0.8, color: FROST, alpha: 0.75 * alpha, cap: "round" });
    }
  }
  // The neck, spined down its middle.
  g.poly(both(NECK), true).fill({ color: DRAGON, alpha: 0.14 * alpha }).stroke({ width: lw * 0.8, color: PALE, alpha: 0.6 * alpha });
  for (let k = 0; k < 4; k++) {
    const u = -0.48 - k * 0.17;
    g.poly([...P(u + 0.07, 0), ...P(u - 0.04, 0.045), ...P(u - 0.04, -0.045)], true).fill({ color: WHITE, alpha: 0.7 * alpha });
  }
  // The horns swept back and the frill, then the head over them.
  for (const side of [-1, 1]) {
    g.poly(half(HORN, side), true).fill({ color: DRAGON, alpha: 0.35 * alpha }).stroke({ width: lw, color: FROST, alpha: 0.95 * alpha, join: "round" });
    g.poly(half(FRILL, side), true).fill({ color: DRAGON, alpha: 0.25 * alpha }).stroke({ width: lw * 0.8, color: FROST, alpha: 0.8 * alpha });
  }
  const [gx, gy] = P(0.02, 0);
  g.circle(gx, gy, L * 0.42).fill({ color: AZURE, alpha: 0.1 * alpha });
  g.poly(both(HEAD), true).fill({ color: DRAGON, alpha: 0.3 * alpha }).stroke({ width: lw * 1.2, color: FROST, alpha, join: "round" });
  // The ridge down its snout, the brows, the nostrils, and the eyes.
  const [r0x, r0y] = P(0.4, 0), [r1x, r1y] = P(-0.3, 0);
  g.moveTo(r0x, r0y).lineTo(r1x, r1y).stroke({ width: lw * 0.7, color: WHITE, alpha: 0.6 * alpha });
  for (const side of [-1, 1]) {
    const [b0x, b0y] = P(0.12, 0.08 * side), [b1x, b1y] = P(-0.1, 0.2 * side), [ex, ey] = P(0.0, 0.15 * side), [nx, ny] = P(0.42, 0.045 * side);
    g.moveTo(b0x, b0y).lineTo(b1x, b1y).stroke({ width: lw, color: WHITE, alpha: 0.85 * alpha });
    g.circle(nx, ny, L * 0.018).fill({ color: AZURE, alpha: 0.9 * alpha });
    g.circle(ex, ey, L * 0.07).fill({ color: AZURE, alpha: 0.5 * alpha }).circle(ex, ey, L * 0.03).fill({ color: WHITE, alpha });
  }
}

// ── The throw ────────────────────────────────────────────────────────────────

/** Where her aim is: the marks as a whole, or ahead when they are all round. */
function aimOf(m: SigMoment): Pt {
  const c = centre(m.from);
  let x = 0, y = 0;
  for (const r of m.targets) {
    const p = centre(r), d = Math.hypot(p.x - c.x, p.y - c.y) || 1;
    x += (p.x - c.x) / d;
    y += (p.y - c.y) / d;
  }
  const d = Math.hypot(x, y);
  return d > 0.35 * Math.max(1, m.targets.length) ? { x: x / d, y: y / d } : m.ahead;
}

/** Every javelin she throws: two per mark, `v` 0 the first pair and 1 the
 *  second. Each freezes out of the breath on the side of her its mark lies
 *  (a lone mark's two on either side of her), then flies straight to it.
 *  Fixed by the targets alone, so the landing knows how each came in. */
function javelins(m: SigMoment) {
  const c = centre(m.from), s = m.size, a = aimOf(m), n = m.targets.length;
  const out: { i: number; v: number; at: Pt; to: Pt; ang: number; r: Box; power: number; killed: boolean }[] = [];
  for (let v = 0; v < 2; v++)
    m.targets.forEach((r, i) => {
      const to = centre(r), cross = a.x * (to.y - c.y) - a.y * (to.x - c.x);
      let side = Math.abs(cross) > s * 0.2 ? Math.sign(cross) : i % 2 ? 1 : -1;
      if (n === 1 && v === 1) side = -side;
      const f = s * (0.4 + 0.08 * (i >> 1)), fwd = s * (v ? 0.0 : 0.16);
      const at = { x: c.x - a.y * f * side + a.x * fwd, y: c.y + a.x * f * side + a.y * fwd };
      out.push({ i, v, at, to, ang: Math.atan2(to.y - at.y, to.x - at.x), r, power: m.power[i] ?? 1, killed: m.killed[i] ?? false });
    });
  return out;
}

export const PHROST: Signature = {
  shake: 0.8,
  lunge: false,

  deliver(t: FxTools, m: SigMoment, seconds: number) {
    const c = centre(m.from), s = m.size, T = seconds, a = aimOf(m), L = s * 0.62;
    const spears = javelins(m);
    if (!spears.length) return;
    // Her timing: the dragon up by a third of the way in; the first pair
    // frozen and hurled by half, the second frozen and hurled behind it.
    const REAR = T * 0.32, THROW = [T * 0.45, T * 0.62], FORM = [[T * 0.12, T * 0.42], [T * 0.42, T * 0.6]];
    const arrive = (v: number) => (v ? T + BEAT : T);
    const END = T + 0.3;
    /** The dragon at `time`: its head rising from behind her card up over
     *  it as its wings open, darting forward as each pair is hurled (the
     *  wings beating with it), and gone as it fades. */
    const pose = (time: number) => {
      const r = easeOut(clamp01(time / REAR));
      let thrust = 0;
      for (const th of THROW) thrust += Math.exp(-(((time - th - 0.03) / 0.06) ** 2));
      const fwd = s * (-0.3 + 0.42 * r + 0.08 * thrust), hl = L * (0.75 + 0.25 * r);
      return {
        h: { x: c.x + a.x * fwd, y: c.y + a.y * fwd }, L: hl, span: 0.15 + 0.85 * r - 0.12 * thrust,
        alpha: clamp01(time / (T * 0.15)) * (1 - clamp01((time - T) / (END - T))),
      };
    };

    // THE DRAGON rearing up over her, a cold glow at its jaws...
    let mist = 0;
    t.draw(END, (g, u, dt) => {
      const time = u * END, hd = pose(time);
      dragon(g, hd.h, a, hd.L, hd.span, hd.alpha);
      const mo = { x: hd.h.x + a.x * 0.52 * hd.L, y: hd.h.y + a.y * 0.52 * hd.L };
      const breath = clamp01((time - REAR * 0.7) / 0.08) * (1 - clamp01((time - T) / 0.15));
      g.circle(mo.x, mo.y, s * 0.12).fill({ color: PALE, alpha: 0.25 * breath * hd.alpha }).circle(mo.x, mo.y, s * 0.04).fill({ color: WHITE, alpha: 0.8 * breath * hd.alpha });
      // ...and its BREATH, a cold white mist rolling forward along her aim.
      if (breath <= 0) return;
      mist += dt * 50 * t.quality * breath;
      for (; mist >= 1; mist--) {
        const ang = Math.atan2(a.y, a.x) + rand(-0.45, 0.45), v = rand(70, 150) * (s / 90);
        t.spark(mo.x, mo.y, Math.cos(ang) * v, Math.sin(ang) * v, rand(0.4, 0.6), MIST);
      }
    });

    // THE JAVELINS: frozen out of the breath beside her, point first, then
    // hurled — straight, quickening, glittering frost off their flanks.
    spears.forEach((sp) => {
      const [f0, f1] = FORM[sp.v], go = THROW[sp.v], A = arrive(sp.v);
      const len = s * 0.62, w = s * 0.065;
      const start = { x: sp.at.x + Math.cos(sp.ang) * len * 0.5, y: sp.at.y + Math.sin(sp.ang) * len * 0.5 };
      let acc = 0;
      t.draw(A, (g, u, dt) => {
        const time = u * A;
        if (time < f0) return;
        if (time < go) {
          // Hovering in the breath, trembling a little, its point on its mark.
          const form = easeOut(clamp01((time - f0) / (f1 - f0))), q = Math.sin(time * 60) * s * 0.008 * form;
          javelin(g, { x: start.x + q, y: start.y }, sp.ang, len, w, Math.min(1, form * 2), form);
          return;
        }
        const e = (time - go) / (A - go), k = e * e * 0.55 + e * 0.45;
        const tip = { x: start.x + (sp.to.x - start.x) * k, y: start.y + (sp.to.y - start.y) * k };
        // A streak of cold behind it, the length of its run so far.
        const back = Math.min(len * 1.4, Math.hypot(tip.x - start.x, tip.y - start.y) + len);
        g.moveTo(tip.x - Math.cos(sp.ang) * back, tip.y - Math.sin(sp.ang) * back).lineTo(tip.x, tip.y)
          .stroke({ width: w * 2.2, color: AZURE, alpha: 0.16, cap: "round" });
        javelin(g, tip, sp.ang, len, w, 1);
        acc += dt * 45 * t.quality;
        for (; acc >= 1; acc--) {
          const d = rand(0.2, 1) * len;
          t.spark(tip.x - Math.cos(sp.ang) * d, tip.y - Math.sin(sp.ang) * d, rand(-20, 20) * (s / 90), rand(-20, 20) * (s / 90), rand(0.2, 0.35), GLINT);
        }
      });
      // The hurl: a puff of frost off the hand that threw it.
      t.later(go, () => {
        for (let k = 0; k < 4; k++) {
          const ang = sp.ang + Math.PI + rand(-0.9, 0.9), v = rand(40, 90) * (s / 90);
          t.spark(sp.at.x, sp.at.y, Math.cos(ang) * v, Math.sin(ang) * v, rand(0.2, 0.3), GLINT);
        }
      });
    });
    t.charge(c, s * 1.1, AZURE, 0.3, T * 0.6);
  },

  land(t: FxTools, m: SigMoment) {
    const s = m.size, crusted = new Set<number>();
    for (const sp of javelins(m)) {
      if (!crusted.has(sp.i)) {
        crusted.add(sp.i);
        rime(t, sp.r, s, sp.power, sp.killed);
      }
      t.later(sp.v ? BEAT : 0, () => shatter(t, sp.to, sp.ang, s, sp.power, sp.v === 1, sp.killed));
    }
  },
};

/** A javelin shattering into its card along `ang`: it drives in a little and
 *  bursts — splinters flung on through the card and a few back off it, a
 *  white star of cracks where it broke, a ring of frost. The second (`last`)
 *  bursts a touch bigger, and bigger again on a kill. */
function shatter(t: FxTools, p: Pt, ang: number, s: number, power: number, last: boolean, killed: boolean) {
  const k = Math.max(0.55, Math.min(1.6, power)) * (last ? 1.15 : 1) * (last && killed ? 1.3 : 1);
  const ux = Math.cos(ang), uy = Math.sin(ang), len = s * 0.62, w = s * 0.065;
  // The javelin driving its last span in and breaking: its head buried, its
  // shaft coming apart from the point back.
  t.draw(0.14, (g, u) => {
    const tip = { x: p.x + ux * s * 0.1 * easeOut(u), y: p.y + uy * s * 0.1 * easeOut(u) };
    javelin(g, tip, ang, len * (1 - 0.8 * u), w * (1 + u), 1 - u);
  });
  // The break: a white star of cracks from where it went in.
  const cracks = Array.from({ length: 5 }, (_, i) => ({ a: ang + Math.PI + ((i - 2) / 2) * 1.1 + rand(-0.2, 0.2), r: s * rand(0.18, 0.3) * k }));
  t.draw(0.3, (g, u) => {
    const a = 1 - u, q = easeOut(clamp01(u / 0.25));
    for (const cr of cracks) {
      const mx = p.x + Math.cos(cr.a + 0.25) * cr.r * 0.5 * q, my = p.y + Math.sin(cr.a + 0.25) * cr.r * 0.5 * q;
      g.moveTo(p.x, p.y).lineTo(mx, my).lineTo(p.x + Math.cos(cr.a) * cr.r * q, p.y + Math.sin(cr.a) * cr.r * q)
        .stroke({ width: 1.6, color: WHITE, alpha: 0.9 * a });
    }
    g.circle(p.x, p.y, s * 0.08 * k).fill({ color: AZURE, alpha: 0.3 * a });
  });
  t.flash(p, FROST, 0.1 * k * (s / 80));
  t.ring({ x: p.x - s / 2, y: p.y - s / 2, w: s, h: s }, PALE, 0.2, 0.85 * k, 0.3, 2.5);
  const n = Math.round(9 * k);
  for (let i = 0; i < n; i++) {
    const on = i < n * 0.65, a = (on ? ang : ang + Math.PI) + rand(-0.8, 0.8), v = rand(130, 280) * (s / 90) * (on ? 1 : 0.6);
    t.spark(p.x, p.y, Math.cos(a) * v, Math.sin(a) * v - rand(30, 80) * (s / 90), rand(0.3, 0.5), SHARD);
  }
}

/** HOARFROST over a card: frost creeping in over it from its corners and
 *  edges the way it creeps over a window — straight dendrites of ice, each
 *  branching at sixty degrees as it grows and branching again, the first
 *  javelin starting it and the second thickening it — glittering, then
 *  thawing away. Drawn as lines over a faint frost haze, so the card reads
 *  through its crust. */
function rime(t: FxTools, r: Box, s: number, power: number, killed: boolean) {
  const p = centre(r), k = Math.max(0.7, Math.min(1.4, power)), inset = s * 0.05;
  const starts: Pt[] = [
    { x: r.x + inset, y: r.y + inset }, { x: r.x + r.w - inset, y: r.y + inset }, { x: r.x + r.w - inset, y: r.y + r.h - inset }, { x: r.x + inset, y: r.y + r.h - inset },
    { x: p.x, y: r.y + inset }, { x: r.x + r.w - inset, y: p.y }, { x: p.x, y: r.y + r.h - inset }, { x: r.x + inset, y: p.y },
  ];
  const ferns = starts.map((st, i) => ({
    x: st.x, y: st.y, a: Math.atan2(p.y - st.y, p.x - st.x) + rand(-0.25, 0.25),
    len: s * (i < 4 ? rand(0.42, 0.5) : rand(0.26, 0.34)) * k, late: i % 2 ? BEAT : 0, ph: rand(0, 1),
  }));
  const D = 1.0, H = Math.PI / 3;
  t.draw(D, (g, u) => {
    const time = u * D, fade = 1 - clamp01((time - 0.6) / 0.4);
    g.rect(r.x + s * 0.03, r.y + s * 0.03, r.w - s * 0.06, r.h - s * 0.06).fill({ color: FROST, alpha: 0.09 * clamp01(time / 0.15) * fade });
    for (const fn of ferns) {
      const grow = easeOut(clamp01((time - fn.late) / 0.3));
      if (grow <= 0) continue;
      const ux = Math.cos(fn.a), uy = Math.sin(fn.a), L = fn.len * grow;
      g.moveTo(fn.x, fn.y).lineTo(fn.x + ux * L, fn.y + uy * L).stroke({ width: 3, color: PALE, alpha: 0.2 * fade });
      g.moveTo(fn.x, fn.y).lineTo(fn.x + ux * L, fn.y + uy * L).stroke({ width: 1.3, color: WHITE, alpha: 0.9 * fade });
      // Branches off the stem at sixty degrees, longest near its root, and a
      // twig off each, as ice grows.
      for (let j = 0; j < 4; j++) {
        const f = 0.18 + j * 0.2 + fn.ph * 0.05, show = clamp01((grow - f) / 0.3);
        if (show <= 0) continue;
        const bx = fn.x + ux * fn.len * f, by = fn.y + uy * fn.len * f, bl = fn.len * 0.34 * (1 - f) * show;
        for (const sd of [-1, 1]) {
          const ba = fn.a + sd * H, ex = bx + Math.cos(ba) * bl, ey = by + Math.sin(ba) * bl;
          g.moveTo(bx, by).lineTo(ex, ey).stroke({ width: 1, color: FROST, alpha: 0.85 * fade });
          const mx = bx + Math.cos(ba) * bl * 0.5, my = by + Math.sin(ba) * bl * 0.5, ca = ba + sd * H;
          g.moveTo(mx, my).lineTo(mx + Math.cos(fn.a) * bl * 0.35, my + Math.sin(fn.a) * bl * 0.35).stroke({ width: 0.8, color: PALE, alpha: 0.7 * fade });
          g.moveTo(mx, my).lineTo(mx + Math.cos(ca) * bl * 0.3, my + Math.sin(ca) * bl * 0.3).stroke({ width: 0.8, color: PALE, alpha: 0.6 * fade });
        }
      }
    }
  });
  t.glow(r, PALE, 0.16, 0.5, 1.0);
  // The crust glittering as it sets.
  t.later(BEAT + 0.12, () => t.emit({ count: Math.round(8 * k), palette: GLINT.palette, from: r, speed: [5, 25], gravity: 15, drag: 0.4,
    life: [0.35, 0.6], size: [4, 1.5] }));
  if (killed) t.later(BEAT + 0.05, () => t.ring(r, WHITE, 0.4, 1.35, 0.4, 3));
}
