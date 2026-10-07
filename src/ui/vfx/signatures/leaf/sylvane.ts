/** SYLVANE — Emergence. "Spawn an Elephlora in an adjacent slot and heal all
 *  allies 4; each round the tree marches forward, hits an opponent for 3, and
 *  heals an ally 3." Her Emergence raises a walking tree that heals the line
 *  as it marches.
 *
 *  It aims at nothing, so there is no delivery: the LANDING is the whole
 *  move. The ribbons of golden light that swirl from her hands on her art
 *  stream from her to the slot beside her, and the ground there splits along
 *  a seam of light. Out of it a TREE OF LIGHT grows — a trunk, then limbs,
 *  then twigs, each drawn out tip-first with sap-light racing up it, roots
 *  spreading at its foot — and cherry blossom opens at its tips. Then the
 *  blossom lets go: petals ride the wind to every ally, each one warming as
 *  they arrive, and the tree dissolves upward into motes, leaving the
 *  Elephlora standing on its card.
 *
 *  Restraint over spectacle (owner, 2026-10-06: the first version, a drawn
 *  cartoon elephant with apples, read "like a kids game"): the card's own art
 *  is the creature, so this draws only light — thin, branching, unhurried —
 *  in her art's gold and blossom-pink. */
import { centre, rand } from "../../looks/base";
import type { Graphics } from "pixi.js";
import type { FxTools, Pt, SparkStyle } from "../../looks/types";
import type { Signature, SigMoment } from "../types";

type Box = SigMoment["from"];

const TAU = Math.PI * 2;
// Her ribbons, off her art: pale gold light, white at the core.
const WHITE = 0xfffbef, RIBBON = 0xfff0b0, GOLD = 0xffd36a, AMBER = 0xe8a948;
// Cherry blossom, pink to blush.
const PINK = 0xffa8c8, BLUSH = 0xffd8e8;
/** Gold glitter off the ribbons. */
const GLITTER: SparkStyle = { palette: [WHITE, RIBBON, GOLD], gravity: 20, drag: 0.5, size: [4, 1], streak: false };
/** Light lifting off the tree as it dissolves, and off a healed ally. */
const MOTE: SparkStyle = { palette: [WHITE, BLUSH, PINK, GOLD], gravity: -90, drag: 0.6, size: [5, 1.5], streak: false, swirl: 120 };
const MOTE_L: SparkStyle = { ...MOTE, swirl: -120 };
/** Grit off the seam as it opens. */
const GRIT: SparkStyle = { palette: [0xf0e0b8, 0xc8a46c, 0x8a6c48], gravity: 700, drag: 0.6, size: [4, 1.5], streak: false };

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeOut = (x: number) => 1 - (1 - x) * (1 - x);
const smooth = (x: number) => x * x * (3 - 2 * x);

/** The beats, s from the landing: the ribbons arrive and the seam opens; the
 *  tree grows; its blossom opens; the petals leave for her allies; it is gone. */
const SEAM = 0.16, GROW = 0.2, BLOOM = 0.62, SEND = 0.7, FADE = 0.88, GONE = 1.15;

/** A cherry-blossom petal: a teardrop wide at its tip, `open` how face-on it
 *  is, so a tumbling petal thins to a sliver and back. */
function petal(g: Graphics, x: number, y: number, len: number, ang: number, open: number, color: number, alpha: number) {
  if (alpha <= 0.02 || len < 1.5) return;
  const c = Math.cos(ang), s = Math.sin(ang), hx = c * len * 0.5, hy = s * len * 0.5, w = len * 0.5 * Math.max(0.15, open);
  const px = x + hx * 0.45, py = y + hy * 0.45;
  g.moveTo(x - hx, y - hy).quadraticCurveTo(px - s * w, py + c * w, x + hx, y + hy).quadraticCurveTo(px + s * w, py - c * w, x - hx, y - hy)
    .fill({ color, alpha });
}

// ── The tree of light ────────────────────────────────────────────────────────

/** One limb: a gentle curve from (x0, y0), `len` long at `ang`, bowed by `bow`,
 *  `w` thick at its base; it starts growing at `born` for `dur` s. */
interface Limb { x0: number; y0: number; ang: number; len: number; bow: number; w: number; born: number; dur: number; depth: number }

/** The tree that grows on the square at (x, y), its foot: a trunk, three
 *  limbs, then boughs and twigs two by two, each starting as its parent is
 *  most of the way out — and a few roots spreading along the ground at its
 *  foot (depth -1). It stands a little taller than its square. */
function plant(x: number, y: number, s: number): Limb[] {
  const out: Limb[] = [];
  const add = (x0: number, y0: number, ang: number, len: number, w: number, born: number, depth: number) => {
    const dur = [0.2, 0.15, 0.12, 0.1, 0.09][depth];
    out.push({ x0, y0, ang, len, bow: rand(-0.16, 0.16), w, born, dur, depth });
    if (depth === 4) return;
    const ex = x0 + Math.cos(ang) * len, ey = y0 + Math.sin(ang) * len;
    const kids = depth === 0 ? 3 : 2, spread = [0.7, 0.55, 0.5, 0.45][depth];
    for (let k = 0; k < kids; k++) {
      const a = ang + spread * (k - (kids - 1) / 2) + rand(-0.12, 0.12);
      add(ex, ey, a, len * rand(0.66, 0.76), w * 0.62, born + dur * 0.72, depth + 1);
    }
  };
  add(x, y, -Math.PI / 2 + rand(-0.05, 0.05), s * 0.4, s * 0.1, GROW, 0);
  for (const side of [-1, 1])
    for (const k of [0, 1])
      out.push({ x0: x + side * s * 0.03, y0: y, ang: side > 0 ? rand(0.08, 0.22) + k * 0.22 : Math.PI - rand(0.08, 0.22) - k * 0.22,
        len: s * rand(0.3, 0.42), bow: rand(-0.1, 0.1), w: s * 0.05, born: SEAM + 0.02, dur: 0.24, depth: -1 });
  return out;
}

/** A limb's curve, out to `p` (0..1) of its length, as a point list. */
function limbLine(l: Limb, p: number): number[] {
  const ex = l.x0 + Math.cos(l.ang) * l.len, ey = l.y0 + Math.sin(l.ang) * l.len;
  const nx = -Math.sin(l.ang), ny = Math.cos(l.ang);
  const cx = (l.x0 + ex) / 2 + nx * l.bow * l.len, cy = (l.y0 + ey) / 2 + ny * l.bow * l.len;
  const pts: number[] = [];
  const n = 7;
  for (let i = 0; i <= n; i++) {
    const u = (i / n) * p, v = 1 - u;
    pts.push(v * v * l.x0 + 2 * v * u * cx + u * u * ex, v * v * l.y0 + 2 * v * u * cy + u * u * ey);
  }
  return pts;
}

/** The tree at `time`: each limb as a soft halo of gold with a fine bright
 *  core, the sap-light a bead running ahead at its growing tip. Fades to
 *  nothing from FADE, crown first — the light lifts off it. */
function drawTree(g: Graphics, limbs: Limb[], time: number) {
  const fade = 1 - smooth(clamp01((time - FADE) / (GONE - FADE)));
  if (fade <= 0.01) return;
  for (const l of limbs) {
    const p = easeOut(clamp01((time - l.born) / l.dur));
    if (p <= 0.01) continue;
    // The crown dissolves a little ahead of the trunk.
    const a = fade * (l.depth >= 3 ? 1 - 0.4 * clamp01((time - FADE) / 0.1) : 1);
    const pts = limbLine(l, p);
    const core = Math.max(1.1, l.w * 0.4);
    g.poly(pts, false).stroke({ width: core * 5, color: AMBER, alpha: 0.16 * a, cap: "round", join: "round" });
    g.poly(pts, false).stroke({ width: core * 2.2, color: GOLD, alpha: 0.4 * a, cap: "round", join: "round" });
    g.poly(pts, false).stroke({ width: core, color: l.depth <= 1 ? WHITE : RIBBON, alpha: 0.92 * a, cap: "round", join: "round" });
    if (p < 0.98) {
      const tx = pts[pts.length - 2], ty = pts[pts.length - 1];
      g.circle(tx, ty, core * 2.6).fill({ color: GOLD, alpha: 0.35 * a });
      g.circle(tx, ty, core * 1.1).fill({ color: WHITE, alpha: a });
    }
  }
}

/** The blossom at its tips: five petals opening round a bright heart, a
 *  faint bloom of pink light about each. */
function drawBlossom(g: Graphics, tips: { x: number; y: number; at: number; rot: number; r: number }[], time: number) {
  const fade = 1 - smooth(clamp01((time - FADE + 0.04) / (GONE - FADE)));
  for (const b of tips) {
    const k = easeOut(clamp01((time - b.at) / 0.14));
    // Let go of their petals as they are sent.
    const shed = 1 - 0.6 * smooth(clamp01((time - SEND) / 0.15));
    const a = fade * shed;
    if (k <= 0.01 || a <= 0.02) continue;
    const R = b.r * k;
    g.circle(b.x, b.y, R * 2.2).fill({ color: PINK, alpha: 0.16 * a });
    for (let i = 0; i < 5; i++) {
      const an = b.rot + (i / 5) * TAU;
      petal(g, b.x + Math.cos(an) * R * 0.55, b.y + Math.sin(an) * R * 0.55, R, an, 0.85, i % 2 ? PINK : BLUSH, 0.85 * a);
    }
    g.circle(b.x, b.y, R * 0.22).fill({ color: WHITE, alpha: a });
  }
}

export const SYLVANE: Signature = {
  // It grows; nothing is struck.
  shake: 0.25,
  // She stays where she stands: the ribbons go, not her.
  lunge: false,

  land(t: FxTools, m: SigMoment) {
    const c = centre(m.from), s = m.size;
    const spawn = m.spawned[0] ?? m.allies[0] ?? { x: m.from.x + m.ahead.x * s, y: m.from.y + m.ahead.y * s, w: m.from.w, h: m.from.h };
    const tc = centre(spawn), foot = { x: tc.x, y: spawn.y + spawn.h * 0.9 };
    t.glow(m.from, BLUSH, 0.25, 0.45, 1.05);
    ribbons(t, c, foot, s);
    t.later(SEAM, () => seam(t, foot, s));
    // THE TREE OF LIGHT.
    const limbs = plant(foot.x, foot.y, s);
    const tips = limbs.filter((l) => l.depth >= 3).map((l) => {
      const pts = limbLine(l, 1);
      return { x: pts[pts.length - 2], y: pts[pts.length - 1], at: Math.max(BLOOM - 0.08, l.born + l.dur * 0.9) + rand(0, 0.05),
        rot: rand(0, TAU), r: s * (l.depth === 4 ? 0.065 : 0.075) };
    });
    // A shaft of light rising behind it as it grows, and a pool of it at its foot.
    t.draw(FADE + 0.2 - GROW, (g, u) => {
      const time = GROW + u * (FADE + 0.2 - GROW), k = easeOut(clamp01((time - GROW) / 0.35)), a = k * (1 - smooth(clamp01((time - FADE) / 0.2)));
      g.ellipse(foot.x, foot.y - s * 0.6 * k, s * 0.42, s * 0.75 * k).fill({ color: GOLD, alpha: 0.06 * a });
      g.ellipse(foot.x, foot.y - s * 0.5 * k, s * 0.22, s * 0.6 * k).fill({ color: RIBBON, alpha: 0.07 * a });
      g.ellipse(foot.x, foot.y, s * 0.55, s * 0.12).fill({ color: GOLD, alpha: 0.14 * a });
    }, { delay: GROW });
    t.draw(GONE, (g, u) => drawTree(g, limbs, u * GONE));
    t.draw(GONE, (g, u) => drawBlossom(g, tips, u * GONE));
    // A breath of light through the crown as it comes into flower.
    const crown = { x: foot.x - s * 0.55, y: foot.y - s * 1.25, w: s * 1.1, h: s * 0.75 };
    t.later(BLOOM, () => t.glow(crown, BLUSH, 0.3, 0.5, 1.0));
    // THE PETALS: let go to every ally, warming each as they arrive.
    const healed = [m.from, ...m.allies.filter((r) => !m.spawned.some((p) => p.x === r.x && p.y === r.y))];
    send(t, tips, healed, s);
    // It dissolves: light lifts off the crown and the boughs.
    t.later(FADE, () => {
      const n = Math.round(14 * t.quality);
      for (let i = 0; i < n; i++) {
        const b = tips[Math.floor(rand(0, tips.length))] ?? { x: foot.x, y: foot.y - s * 0.6 };
        t.spark(b.x + rand(-4, 4), b.y + rand(-4, 4), rand(-12, 12) * (s / 90), -rand(35, 80) * (s / 90), rand(0.45, 0.7), i % 2 ? MOTE : MOTE_L);
      }
    });
  },
};

/** THE RIBBONS: three bands of golden light streaming from her to the slot
 *  beside her, braided about each other, each a flat ribbon turning over as
 *  it flies — swelling face-on, pinching edge-on — drawn in at the far end as
 *  the tail catches up. Light, with no outline: a glow, not a cut-out. */
function ribbons(t: FxTools, a: Pt, b: Pt, s: number) {
  const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, nx = -uy, ny = ux;
  const A = { x: a.x + ux * s * 0.2, y: a.y + uy * s * 0.2 }, B = { x: b.x, y: b.y - s * 0.05 };
  const bands = [0.18, -0.14, 0.06].map((amp, i) => ({ amp: amp * Math.min(L, s * 2), waves: 1.6 + i * 0.4, ph: rand(0, TAU), tw: 2.2 + i * 0.5, tph: rand(0, TAU), w: s * (0.13 - i * 0.025), at: i * 0.025 }));
  const D = 0.3;
  const head = (time: number, at: number) => easeOut(clamp01((time - at) / 0.19));
  const tail = (time: number, at: number) => smooth(clamp01((time - at - 0.08) / 0.2));
  const at = (bd: (typeof bands)[number], f: number, time: number) => {
    const off = bd.amp * Math.sin(f * bd.waves * Math.PI + bd.ph - time * 10) * Math.sin(Math.PI * f);
    return { x: A.x + (B.x - A.x) * f + nx * off, y: A.y + (B.y - A.y) * f + ny * off };
  };
  let acc = 0;
  t.draw(D, (g, u, dt) => {
    const time = u * D;
    for (const bd of bands) {
      const f1 = head(time, bd.at), f0 = tail(time, bd.at);
      if (f1 - f0 < 0.01) continue;
      const N = 16, left: number[] = [], right: number[] = [], mid: number[] = [];
      for (let i = 0; i <= N; i++) {
        const f = f0 + ((f1 - f0) * i) / N, p = at(bd, f, time), q = at(bd, Math.min(1, f + 0.01), time);
        const tx = q.x - p.x, ty = q.y - p.y, l = Math.hypot(tx, ty) || 1;
        // Face-on it swells, edge-on it pinches: a ribbon turning over.
        const w = bd.w * (0.12 + 0.88 * Math.abs(Math.cos(f * bd.tw * Math.PI + bd.tph - time * 7))) * Math.sin(Math.PI * (i / N)) / 2;
        left.push(p.x - (ty / l) * w, p.y + (tx / l) * w);
        right.unshift(p.x + (ty / l) * w, p.y - (tx / l) * w);
        mid.push(p.x, p.y);
      }
      g.poly(left.concat(right), true).fill({ color: RIBBON, alpha: 0.28 });
      g.poly(mid, false).stroke({ width: 1.2, color: WHITE, alpha: 0.8 });
    }
    // Glitter off the leading band.
    acc += dt * 50 * t.quality;
    const f = head(time, 0);
    for (; acc >= 1; acc--) {
      const p = at(bands[0], f * rand(0.6, 1), time);
      t.spark(p.x, p.y, rand(-25, 25) * (s / 90), rand(-25, 25) * (s / 90), rand(0.25, 0.4), GLITTER);
    }
  });
}

/** The ground splitting along a seam of light where the tree will rise: a
 *  dark crack in the earth, lit along its lips, a little grit thrown up. */
function seam(t: FxTools, at: Pt, s: number) {
  // A jagged line across the foot of the square, opening from the middle out.
  const pts: Pt[] = [];
  for (let i = 0; i <= 10; i++) {
    const f = i / 10 - 0.5;
    pts.push({ x: at.x + f * s * 0.8, y: at.y + rand(-0.025, 0.025) * s + Math.abs(f) * s * 0.03 });
  }
  const upTo = (k: number) => pts.filter((_, i) => Math.abs(i / 10 - 0.5) <= k * 0.5 + 0.001).flatMap((p) => [p.x, p.y]);
  t.draw(0.7, (g, u) => {
    const k = easeOut(clamp01(u / 0.3)), a = 1 - smooth(clamp01((u - 0.45) / 0.55));
    const line = upTo(k);
    if (line.length >= 4) g.poly(line, false).stroke({ width: s * 0.045, color: 0x0b0704, alpha: 0.75 * a, cap: "round", join: "round" });
  }, { dark: true });
  t.draw(0.7, (g, u) => {
    const k = easeOut(clamp01(u / 0.3)), a = 1 - smooth(clamp01((u - 0.45) / 0.55));
    const line = upTo(k);
    if (line.length < 4) return;
    g.poly(line, false).stroke({ width: s * 0.09, color: GOLD, alpha: 0.12 * a, cap: "round", join: "round" });
    g.poly(line, false).stroke({ width: 1.2, color: RIBBON, alpha: 0.85 * a, cap: "round", join: "round" });
  });
  t.flash({ x: at.x, y: at.y - s * 0.04 }, RIBBON, 0.12 * (s / 80));
  const n = Math.round(8 * t.quality);
  for (let i = 0; i < n; i++) {
    const a = rand(-Math.PI * 0.85, -Math.PI * 0.15), v = rand(70, 150) * (s / 90);
    t.spark(at.x + rand(-0.3, 0.3) * s, at.y, Math.cos(a) * v, Math.sin(a) * v, rand(0.3, 0.45), GRIT);
  }
}

/** THE PETALS SENT: from the blossom, a few petals ride a curving wind to
 *  each ally, and the ally warms as they settle on it. */
function send(t: FxTools, tips: { x: number; y: number }[], healed: Box[], s: number) {
  const TRAVEL = 0.28;
  healed.forEach((r, j) => {
    const dest = centre(r), delay = SEND + j * 0.035;
    const ps = Array.from({ length: Math.max(3, Math.round(5 * t.quality)) }, (_, i) => {
      const from = tips[(j * 3 + i) % Math.max(1, tips.length)] ?? dest;
      const dx = dest.x - from.x, dy = dest.y - from.y, L = Math.hypot(dx, dy) || 1;
      const bend = rand(0.18, 0.32) * (i % 2 ? 1 : -1) * L;
      return { from, ctrl: { x: (from.x + dest.x) / 2 - (dy / L) * bend, y: (from.y + dest.y) / 2 + (dx / L) * bend - s * 0.2 },
        to: { x: dest.x + rand(-0.25, 0.25) * r.w, y: dest.y + rand(-0.2, 0.2) * r.h }, at: i * 0.03, spin: rand(7, 11), ph: rand(0, TAU),
        len: s * rand(0.1, 0.13), color: i % 2 ? PINK : BLUSH };
    });
    t.draw(TRAVEL + 0.25, (g, u) => {
      const time = u * (TRAVEL + 0.25);
      for (const p of ps) {
        const q = clamp01((time - p.at) / TRAVEL);
        if (q <= 0) continue;
        const along = (qq: number) => {
          const e = smooth(qq), v = 1 - e;
          return { x: v * v * p.from.x + 2 * v * e * p.ctrl.x + e * e * p.to.x, y: v * v * p.from.y + 2 * v * e * p.ctrl.y + e * e * p.to.y };
        };
        const { x, y } = along(q);
        // A thread of gold light behind it while it flies.
        if (q < 1) {
          const trail: number[] = [];
          for (let i = 0; i <= 6; i++) { const b = along(Math.max(0, q - 0.3 * (i / 6))); trail.push(b.x, b.y); }
          g.poly(trail, false).stroke({ width: 1.4, color: GOLD, alpha: 0.5 * Math.min(1, q * 5), cap: "round", join: "round" });
        }
        const settle = q >= 1 ? 1 - clamp01((time - p.at - TRAVEL) / 0.25) : 1;
        petal(g, x, y + (q >= 1 ? (time - p.at - TRAVEL) * s * 0.3 : 0), p.len, p.ph + time * p.spin * 0.5,
          0.3 + 0.7 * Math.abs(Math.cos(time * p.spin + p.ph)), p.color, 0.9 * Math.min(1, q * 5) * settle);
      }
    }, { delay });
    t.later(delay + TRAVEL * 0.85, () => warm(t, r, s));
  });
}

/** An ally the petals reached: a soft blush of warmth over it and light
 *  lifting off it. */
function warm(t: FxTools, r: Box, s: number) {
  t.glow(r, 0xffc4dc, 0.3, 0.5, 1.05);
  const n = Math.round(6 * t.quality);
  for (let i = 0; i < n; i++)
    t.spark(r.x + rand(0.15, 0.85) * r.w, r.y + r.h * rand(0.5, 0.9), rand(-12, 12) * (s / 90), -rand(40, 80) * (s / 90), rand(0.45, 0.7), i % 2 ? MOTE : MOTE_L);
}
