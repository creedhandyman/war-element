/** GLACIUS — Deep Freeze. "Deal 4 DMG and FREEZE up to 3 opponents for 2
 *  rounds." It freezes three foes under the ice.
 *
 *  On its art Glacius is an armoured ice lich in a frozen cathedral, a
 *  glowing orb ringed with runes in one hand and a storm of ice spears
 *  hanging in the air all round it. The DELIVERY is that storm called up:
 *  the orb flares cyan in its hand, its rune ring turning, and spears of old,
 *  dark glacier ice form in the air in a ring round the lich — jagged, rimmed
 *  in cold light, drifting where they hang — then all turn on their marks at
 *  once and fly as one volley, every mark taking its spear (the rest of the
 *  storm flying with them), all landing on the landing frame.
 *
 *  The LANDING is each mark sunk UNDER THE ICE: the spear drives in and
 *  stays, and a glacier sheet freezes up over the card from the ground —
 *  dark, deep ice with a jagged crest of cold light — that CRACKS across in
 *  bright cyan veins as it sets, glows its cold blue a moment, and lets the
 *  card go.
 *
 *  Of the three ice legendaries Glacius's is the GLACIER: heavy, dark and
 *  ancient, lit only along its edges and its cracks, where Phrost's is breath
 *  and rime and Polar King's cut crystal. The dark ice is drawn dark on
 *  purpose (`dark: true`), always under a light rim, and the sheet over a
 *  card is thin and brief so the card reads under it. */
import { centre, rand } from "../../looks/base";
import type { Graphics } from "pixi.js";
import type { FxTools, Pt, SparkStyle } from "../../looks/types";
import type { Signature, SigMoment } from "../types";

type Box = SigMoment["from"];

const TAU = Math.PI * 2;
// The glacier: deep ice dark as old water, and the cold teal-cyan light that
// lives in its edges and cracks — and in the lich's orb.
const ABYSS = 0x061c2a, DEEPICE = 0x0f3b55, TEAL = 0x2fb8d8, CYAN = 0x7ff4ff, PALE = 0xd2fbff, WHITE = 0xffffff;
/** A splinter of glacier off a spear or a cracking sheet. */
const SHARD: SparkStyle = { palette: [PALE, CYAN, TEAL, DEEPICE], gravity: 520, drag: 0.55, size: [8, 2.5], streak: true };
/** Cold drawn in to the orb, and frost hanging off the storm. */
const MOTE: SparkStyle = { palette: [WHITE, PALE, CYAN], gravity: 0, drag: 0.5, size: [4, 1.5], streak: false };
/** Cold breath rolling off the sheet as it sets. */
const MIST: SparkStyle = { palette: [PALE, 0xbfeaf2, 0x8ccad8], gravity: -25, drag: 0.45, size: [7, 15], streak: false };

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeOut = (x: number) => 1 - (1 - x) * (1 - x);
/** An angle folded into -PI..PI. */
const fold = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

// ── The orb ──────────────────────────────────────────────────────────────────

/** Where the orb is: in the hand on the art's side of its card. */
const orbAt = (c: Pt, s: number): Pt => ({ x: c.x + s * 0.28, y: c.y + s * 0.02 });

/** The lich's orb, `flare` (0..1) bright: a cyan sphere in a halo, and round it
 *  a ring of runes — a circle of six tick-marks and a star of lines inside
 *  it, as on the art — turning `rot`. */
function orb(g: Graphics, o: Pt, s: number, flare: number, rot: number, alpha: number) {
  if (alpha <= 0.02) return;
  const R = s * 0.1;
  g.circle(o.x, o.y, R * (2 + flare)).fill({ color: TEAL, alpha: (0.1 + 0.15 * flare) * alpha });
  g.circle(o.x, o.y, R).fill({ color: CYAN, alpha: (0.45 + 0.3 * flare) * alpha }).stroke({ width: 1.2, color: WHITE, alpha: 0.9 * alpha });
  g.circle(o.x, o.y, R * 0.4).fill({ color: WHITE, alpha: (0.6 + 0.4 * flare) * alpha });
  const RR = s * (0.18 + 0.04 * flare);
  g.circle(o.x, o.y, RR).stroke({ width: 1.2, color: CYAN, alpha: 0.8 * alpha });
  for (let i = 0; i < 6; i++) {
    const a = rot + (i * TAU) / 6, ca = Math.cos(a), sa = Math.sin(a);
    g.moveTo(o.x + ca * RR, o.y + sa * RR).lineTo(o.x + ca * RR * 1.25, o.y + sa * RR * 1.25).stroke({ width: 1.4, color: PALE, alpha: 0.85 * alpha });
  }
  // Two triangles, a hexagram, counter-turning inside the ring.
  for (let k = 0; k < 2; k++) {
    const tri: number[] = [];
    for (let i = 0; i < 3; i++) {
      const a = -rot * 1.5 + (k * Math.PI) / 3 + (i * TAU) / 3;
      tri.push(o.x + Math.cos(a) * RR * 0.85, o.y + Math.sin(a) * RR * 0.85);
    }
    g.poly(tri, true).stroke({ width: 0.9, color: CYAN, alpha: 0.55 * alpha });
  }
}

// ── The storm ────────────────────────────────────────────────────────────────

/** A spear of glacier ice, its point at `tip`, heading `ang`, `len` long and
 *  `w` across: a jagged shard — the notches along its flanks from `jag` —
 *  with a crack of light down its middle. Its solid half (dark: the old ice)
 *  or its light half (the rim and the crack) by `lit`. */
function spear(g: Graphics, tip: Pt, ang: number, len: number, w: number, jag: number[], alpha: number, lit: boolean) {
  if (alpha <= 0.02 || len < 2) return;
  const ux = Math.cos(ang), uy = Math.sin(ang), nx = -uy, ny = ux;
  const P = (d: number, side: number) => [tip.x - ux * d * len + nx * side * w, tip.y - uy * d * len + ny * side * w];
  const pts = [tip.x, tip.y, ...P(0.18, 0.75 + jag[0]), ...P(0.34, 0.55 + jag[1]), ...P(0.42, 0.95 + jag[2]), ...P(0.68, 0.6 + jag[3]),
    ...P(1, 0.15), ...P(0.86, -0.35 - jag[4]), ...P(0.6, -0.85 - jag[5]), ...P(0.46, -0.5 - jag[0]), ...P(0.24, -0.8 - jag[1])];
  if (!lit) {
    g.poly(pts, true).fill({ color: DEEPICE, alpha: 0.9 * alpha });
    return;
  }
  g.poly(pts, true).fill({ color: TEAL, alpha: 0.14 * alpha }).stroke({ width: 1.4, color: CYAN, alpha: 0.95 * alpha, join: "miter" });
  const [ax, ay] = P(0.85, 0.05), [bx, by] = P(0.55, -0.15), [cx, cy] = P(0.3, 0.12);
  g.moveTo(ax, ay).lineTo(bx, by).lineTo(cx, cy).lineTo(tip.x, tip.y).stroke({ width: 1, color: WHITE, alpha: 0.8 * alpha });
}

/** The storm round the lich: where each spear hangs, how it first faces (out
 *  from the lich), which mark it flies to (every mark one of the first, the
 *  rest of the storm after them) and where on that mark it strikes. Fixed by
 *  the targets alone, so the landing knows how each came in. */
function storm(m: SigMoment) {
  const c = centre(m.from), s = m.size, n = m.targets.length, N = Math.max(8, n * 3);
  const a0 = Math.atan2(m.ahead.y, m.ahead.x);
  return Array.from({ length: N }, (_, j) => {
    const i = j % n, main = j < n, th = a0 + Math.PI / N + (j * TAU) / N;
    const R = s * (j % 2 ? 0.84 : 0.62);
    const at = { x: c.x + Math.cos(th) * R, y: c.y + Math.sin(th) * R * 0.9 };
    const p = centre(m.targets[i]), off = main ? 0 : s * 0.2;
    const hit = { x: p.x + Math.cos(th * 3) * off, y: p.y + Math.sin(th * 3) * off * 0.7 };
    return { j, i, main, th, at, hit, ang: Math.atan2(hit.y - at.y, hit.x - at.x), len: s * (main ? 0.62 : 0.42), w: s * (main ? 0.085 : 0.06) };
  });
}

export const GLACIUS: Signature = {
  shake: 1.0,
  lunge: false,

  deliver(t: FxTools, m: SigMoment, seconds: number) {
    const c = centre(m.from), s = m.size, T = seconds, o = orbAt(c, s);
    if (!m.targets.length) return;
    const spears = storm(m).map((sp) => ({ ...sp, jag: Array.from({ length: 6 }, () => rand(-0.2, 0.25)), born: rand(0.05, 0.3) * T, ph: rand(0, TAU) }));
    const TURN0 = T * 0.38, TURN1 = T * 0.55, LAUNCH = T * 0.58;
    // THE ORB flaring, its runes turning.
    t.draw(T + 0.1, (g, u) => {
      const time = u * (T + 0.1), flare = clamp01(time / (T * 0.7));
      orb(g, o, s, flare, time * 2.2, clamp01(time / (T * 0.12)) * (1 - clamp01((time - T) / 0.1)));
    });
    t.charge(o, s * 1.0, CYAN, 0.4, T * 0.8);
    const motes = Math.round(9 * t.quality);
    for (let k = 0; k < motes; k++)
      t.later(rand(0.05, 0.7) * T, () => {
        const a = rand(0, TAU), d = s * rand(0.35, 0.55), life = rand(0.2, 0.3);
        t.spark(o.x + Math.cos(a) * d, o.y + Math.sin(a) * d, (-Math.cos(a) * d) / life, (-Math.sin(a) * d) / life, life, MOTE);
      });

    // THE STORM: spears forming in the air round it, drifting as they hang,
    // turning on their marks together, and loosed as one volley.
    const where = (sp: (typeof spears)[number], time: number) => {
      if (time < LAUNCH) {
        const drift = s * 0.04 * Math.sin(time * 5 + sp.ph);
        const out = sp.th, turn = easeOut(clamp01((time - TURN0) / (TURN1 - TURN0)));
        const ang = out + fold(sp.ang - out) * turn;
        const tip = { x: sp.at.x + Math.cos(ang) * sp.len * 0.5 + Math.cos(sp.th) * drift, y: sp.at.y + Math.sin(ang) * sp.len * 0.5 + Math.sin(sp.th) * drift };
        return { tip, ang, grow: easeOut(clamp01((time - sp.born) / (T * 0.22))) };
      }
      const start = { x: sp.at.x + Math.cos(sp.ang) * sp.len * 0.5, y: sp.at.y + Math.sin(sp.ang) * sp.len * 0.5 };
      const e = clamp01((time - LAUNCH) / (T - LAUNCH)), k = e * e * 0.6 + e * 0.4;
      return { tip: { x: start.x + (sp.hit.x - start.x) * k, y: start.y + (sp.hit.y - start.y) * k }, ang: sp.ang, grow: 1 };
    };
    t.draw(T, (g, u) => {
      for (const sp of spears) {
        const q = where(sp, u * T);
        spear(g, q.tip, q.ang, sp.len * q.grow, sp.w * (0.5 + 0.5 * q.grow), sp.jag, q.grow, false);
      }
    }, { dark: true });
    let acc = 0;
    t.draw(T, (g, u, dt) => {
      const time = u * T;
      for (const sp of spears) {
        const q = where(sp, time);
        if (time >= LAUNCH) {
          // In flight: a cold streak behind it.
          const bx = q.tip.x - Math.cos(q.ang) * sp.len * 1.6, by = q.tip.y - Math.sin(q.ang) * sp.len * 1.6;
          g.moveTo(bx, by).lineTo(q.tip.x, q.tip.y).stroke({ width: sp.w * 1.8, color: TEAL, alpha: 0.18, cap: "round" });
        }
        spear(g, q.tip, q.ang, sp.len * q.grow, sp.w * (0.5 + 0.5 * q.grow), sp.jag, q.grow, true);
      }
      if (time < LAUNCH) return;
      acc += dt * 60 * t.quality;
      for (; acc >= 1; acc--) {
        const sp = spears[Math.floor(rand(0, spears.length))], q = where(sp, time), d = rand(0.3, 1.2) * sp.len;
        t.spark(q.tip.x - Math.cos(q.ang) * d, q.tip.y - Math.sin(q.ang) * d, rand(-20, 20) * (s / 90), rand(-20, 20) * (s / 90), rand(0.2, 0.35), MOTE);
      }
    });
    // The volley loosed: the orb's ring pulses out with it.
    t.later(LAUNCH, () => t.ring({ x: o.x - s * 0.3, y: o.y - s * 0.3, w: s * 0.6, h: s * 0.6 }, CYAN, 0.6, 1.6, 0.3, 2));
  },

  land(t: FxTools, m: SigMoment) {
    const s = m.size;
    const sp = storm(m);
    m.targets.forEach((r, i) => {
      const mine = sp.filter((q) => q.i === i);
      for (const q of mine) lodge(t, q.hit, q.ang, q.len, q.w, s, q.main);
      underIce(t, r, s, m.power[i] ?? 1, !!m.killed[i]);
    });
  },
};

/** A spear driven home along `ang`: it bites in and stands a moment, then
 *  goes to splinters as the ice takes the card. */
function lodge(t: FxTools, p: Pt, ang: number, len: number, w: number, s: number, main: boolean) {
  const jag = Array.from({ length: 6 }, () => rand(-0.2, 0.25)), D = 0.32, ux = Math.cos(ang), uy = Math.sin(ang);
  const pose = (u: number) => ({ tip: { x: p.x + ux * s * 0.08 * easeOut(clamp01(u * 4)), y: p.y + uy * s * 0.08 * easeOut(clamp01(u * 4)) }, a: 1 - clamp01((u - 0.5) / 0.5) });
  t.draw(D, (g, u) => {
    const q = pose(u);
    spear(g, q.tip, ang, len, w, jag, q.a, false);
  }, { dark: true });
  t.draw(D, (g, u) => {
    const q = pose(u);
    spear(g, q.tip, ang, len, w, jag, q.a, true);
  });
  const n = Math.round((main ? 6 : 3) * t.quality + 1);
  t.later(D * 0.6, () => {
    for (let k = 0; k < n; k++) {
      const a = ang + Math.PI + rand(-1, 1), v = rand(100, 200) * (s / 90);
      t.spark(p.x - ux * len * 0.4, p.y - uy * len * 0.4, Math.cos(a) * v, Math.sin(a) * v - rand(20, 70) * (s / 90), rand(0.3, 0.5), SHARD);
    }
  });
}

/** A card sunk UNDER THE ICE: a glacier sheet freezes up over it from the
 *  ground — deep ice, a jagged crest of cold light riding its top — and as
 *  it sets it CRACKS across in bright cyan veins, glows cold blue, breathes
 *  a little mist, and thaws away. The sheet is dark (`dark: true`) but thin,
 *  so the card reads under it. */
function underIce(t: FxTools, r: Box, s: number, power: number, killed: boolean) {
  const p = centre(r), k = Math.max(0.6, Math.min(1.5, power)), o = s * 0.05;
  const X0 = r.x - o, X1 = r.x + r.w + o, base = r.y + r.h + o, top = r.y - o * 0.5;
  const RISE = 0.2, CRACK = 0.24, D = 0.95;
  // The crest: a jagged line of facets, peaks and notches.
  const crest = Array.from({ length: 11 }, (_, i) => ({ f: i / 10, dy: (i % 2 ? rand(0.05, 0.12) : -(i % 4 === 2 ? rand(0.1, 0.18) : rand(0, 0.05))) * s }));
  const sheet = (time: number): number[] => {
    const h = (base - top) * easeOut(clamp01(time / RISE)), y = base - h, pts: number[] = [X0, base];
    for (const cr of crest) pts.push(X0 + (X1 - X0) * cr.f, Math.min(base, y + cr.dy * clamp01(time / RISE)));
    pts.push(X1, base);
    return pts;
  };
  // The cracks: from a point low on the sheet, branching up and across.
  const cracks = Array.from({ length: 4 }, (_, i) => {
    const sx = X0 + (X1 - X0) * (0.2 + 0.2 * i + rand(-0.06, 0.06)), sy = base - s * rand(0.1, 0.3), pts: number[] = [sx, sy];
    let x = sx, y = sy, a = -Math.PI / 2 + rand(-0.9, 0.9);
    for (let j = 0; j < 4; j++) {
      x += Math.cos(a) * s * rand(0.1, 0.16);
      y += Math.sin(a) * s * rand(0.1, 0.16);
      x = Math.max(X0, Math.min(X1, x));
      y = Math.max(top + s * 0.08, Math.min(base, y));
      pts.push(x, y);
      a += rand(-0.7, 0.7);
    }
    return { pts, late: rand(0, 0.08) };
  });
  const fade = (time: number) => clamp01(time / 0.04) * (1 - clamp01((time - 0.55) / (D - 0.55)));
  t.draw(D, (g, u) => {
    const time = u * D;
    g.poly(sheet(time), true).fill({ color: ABYSS, alpha: 0.42 * fade(time) });
  }, { dark: true });
  t.draw(D, (g, u) => {
    const time = u * D, a = fade(time), pts = sheet(time);
    g.poly(pts, true).fill({ color: TEAL, alpha: 0.13 * a });
    // The crest of cold light along its top, and facets running down it.
    const crestPts = pts.slice(2, pts.length - 2);
    g.poly(crestPts, false).stroke({ width: Math.max(3, s * 0.06), color: TEAL, alpha: 0.3 * a, join: "miter" });
    g.poly(crestPts, false).stroke({ width: 1.6, color: PALE, alpha: 0.95 * a, join: "miter" });
    for (let i = 0; i < crestPts.length; i += 4)
      g.moveTo(crestPts[i], crestPts[i + 1]).lineTo(crestPts[i] + s * 0.06, crestPts[i + 1] + (base - crestPts[i + 1]) * 0.45).stroke({ width: 1, color: CYAN, alpha: 0.4 * a });
    g.moveTo(X0, base).lineTo(X1, base).stroke({ width: 1.4, color: CYAN, alpha: 0.6 * a });
    // The cracks, racing through it as it sets.
    for (const cr of cracks) {
      const q = clamp01((time - CRACK - cr.late) / 0.1);
      if (q <= 0) continue;
      const n = Math.max(2, Math.round((cr.pts.length / 2) * q)), seg = cr.pts.slice(0, n * 2);
      g.poly(seg, false).stroke({ width: 3.5, color: TEAL, alpha: 0.35 * a });
      g.poly(seg, false).stroke({ width: 1.3, color: CYAN, alpha: a });
      g.poly(seg, false).stroke({ width: 0.6, color: WHITE, alpha: 0.9 * a });
    }
  });
  t.glow(r, TEAL, 0.25, 0.6, 1.05);
  t.later(CRACK, () => {
    t.flash(p, CYAN, 0.12 * k * (s / 80));
    const n = Math.round(7 * k);
    for (let i = 0; i < n; i++) {
      const x = X0 + (X1 - X0) * rand(0, 1), a = -Math.PI / 2 + rand(-1, 1), v = rand(90, 190) * (s / 90);
      t.spark(x, top + rand(0, 0.15) * s, Math.cos(a) * v, Math.sin(a) * v, rand(0.3, 0.5), SHARD);
    }
    t.emit({ count: Math.round(4 * k), palette: MIST.palette, from: { x: X0, y: base - s * 0.2, w: X1 - X0, h: s * 0.2 }, dir: [-120, -60],
      speed: [15, 40], gravity: -25, drag: 0.45, life: [0.5, 0.8], size: [7, 15] });
    if (killed) t.ring(r, CYAN, 0.4, 1.4, 0.4, 3);
  });
}
