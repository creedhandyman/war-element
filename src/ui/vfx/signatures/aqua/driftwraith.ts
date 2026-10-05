/** DRIFTWRAITH — Boneyard Ambush. "Break stealth to deal 14 DMG (PEN) to an
 *  opponent." Unseen until it strikes, then fourteen straight through armour,
 *  and the fog covers its retreat.
 *
 *  Its art is a drowned pirate in a rotted coat and tricorn, eyes burning a
 *  pale cyan, a spectral cutlass raised over its head with ghost-light
 *  crackling down the blade, standing in sea fog among the wrecks. It was in
 *  STEALTH until now, so the DELIVERY is it showing itself: sea fog rolling
 *  off its card in dark banks, pale along their tops; two cyan eyes opening
 *  in it; and the cutlass glowing up through it, raised high, ghost-light
 *  crawling along its edge. The cutlass and the eyes go with its token as it
 *  lunges, because they are the wraith; the fog stays where it hid.
 *
 *  The LANDING is the ambush. One cut, straight THROUGH the target — a long
 *  spectral slash that starts short of the card and carries on well out the
 *  far side (PEN: armour does not stop it), ghost-images of the blade a
 *  hair behind it. Drowned water bursts out of the card the way the blade
 *  went, and spectral bubbles stream out after it, wobbling up and popping.
 *  Then the fog rolls back in over the wraith's own square and closes on it,
 *  its eyes glinting once in there before they go out — the retreat. A card
 *  it kills gives up its ghost: a skull of pale light rising off it, trailing
 *  a wisp, while a drowned ship's bell tolls twice over it.
 *
 *  The fog is dark for real (`dark: true`), its banks rimmed in a pale
 *  sea-grey so it reads over an empty square; the blade, the eyes, the water
 *  and the ghost are light. */
import { centre, rand } from "../../looks/base";
import type { Graphics } from "pixi.js";
import type { FxTools, Pt, SparkStyle } from "../../looks/types";
import type { Signature, SigMoment } from "../types";

type Box = SigMoment["from"];

const TAU = Math.PI * 2;
// The fog: dark sea-grey, only ever on the dark layer; and the pale of its tops.
const FOG = 0x08141a, FOG_RIM = 0x8fbccb;
// The ghost: its cyan, white-hot at the edge; the drowned water; its bubbles.
const GHOST = 0x6feeff, GHOST_HOT = 0xe2ffff, TEAL = 0x2aa6b0, DEEP = 0x145a78, BUBBLE = 0xc4fbff;
// The bell's toll: an old bronze gone pale.
const BELL = 0xe6d8a4;

/** Drowned water flung out the far side: heavy, falling, teal to deep. */
const BRINE: SparkStyle = { palette: [GHOST_HOT, GHOST, TEAL, DEEP], gravity: 750, drag: 0.5, size: [6, 2], streak: true };
/** Ghost-light shed off the blade as it is raised. */
const WISP: SparkStyle = { palette: [GHOST_HOT, GHOST, TEAL], gravity: -40, drag: 0.5, size: [4, 1], streak: false };

/** How far the lunge carries its token toward its target, and how long it
 *  takes coming home: use-spell-impacts.ts `lunge` — drawn back a tenth, then
 *  driven this far by the landing frame on a CSS ease-in. */
const LUNGE = 0.42, RETURN = 0.22;

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeOut = (x: number) => 1 - (1 - x) * (1 - x);

/** CSS `ease-in` (cubic-bezier(0.42, 0, 1, 1)) at `u`, as the lunge runs. */
function easeInCss(u: number): number {
  if (u <= 0) return 0;
  if (u >= 1) return 1;
  let lo = 0, hi = 1, t = u;
  for (let i = 0; i < 16; i++) {
    const x = 3 * (1 - t) * (1 - t) * t * 0.42 + 3 * (1 - t) * t * t + t * t * t;
    if (x < u) lo = t;
    else hi = t;
    t = (lo + hi) / 2;
  }
  return 3 * (1 - t) * t * t + t * t * t;
}

/** Where its lunge has its token `time` into a delivery of `seconds`, as a
 *  fraction of the full reach: so the blade it holds goes where it goes. */
function lungeK(time: number, seconds: number): number {
  const total = seconds + RETURN, strike = seconds / total, back = strike * 0.4, p = easeInCss(time / total);
  if (p <= back) return (-0.1 * p) / back;
  if (p <= strike) return -0.1 + (1.1 * (p - back)) / (strike - back);
  return 1 - (p - strike) / (1 - strike);
}

// ── Fog ──────────────────────────────────────────────────────────────────────

/** A bank of fog: a soft lumpy blob, its edge rolling. */
function bank(g: Graphics, x: number, y: number, r: number, time: number, seed: number): Graphics {
  const pts: number[] = [];
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * TAU;
    const rr = r * (1 + 0.12 * Math.sin(3 * a + seed + time * 2.5) + 0.06 * Math.sin(5 * a - seed - time * 3));
    pts.push(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.72);
  }
  return g.poly(pts, true);
}

/** Fog banks moving between two radii round `c` over `D` s: rolling OUT off
 *  the square (`out`) or rolling back IN over it — dark, the tops of the
 *  banks catching a pale light. `a(time)` is how thick it is. */
function fog(t: FxTools, c: Pt, s: number, D: number, out: boolean, a: (time: number) => number, delay = 0) {
  const n = Math.max(5, Math.round(8 * t.quality));
  const banks = Array.from({ length: n }, (_, i) => ({
    th: (i / n) * TAU + rand(-0.3, 0.3), r: s * rand(0.2, 0.3), seed: rand(0, 100), spin: rand(-0.6, 0.6),
    near: s * rand(0.08, 0.22), far: s * rand(0.5, 0.7),
  }));
  const at = (b: (typeof banks)[number], time: number) => {
    const q = easeOut(clamp01(time / D)), d = out ? b.near + (b.far - b.near) * q : b.far + (b.near - b.far) * q, th = b.th + b.spin * q;
    return { x: c.x + Math.cos(th) * d, y: c.y + Math.sin(th) * d * 0.85, r: b.r * (out ? 0.8 + 0.4 * q : 1.15 - 0.2 * q) };
  };
  t.draw(D, (g, u) => {
    const time = u * D, k = a(time);
    if (k <= 0.01) return;
    for (const b of banks) {
      const p = at(b, time);
      bank(g, p.x, p.y, p.r, time, b.seed).fill({ color: FOG, alpha: 0.55 * k });
    }
  }, { dark: true, delay });
  t.draw(D, (g, u) => {
    const time = u * D, k = a(time);
    if (k <= 0.01) return;
    for (const b of banks) {
      const p = at(b, time);
      // The pale along its top, where the light catches a bank.
      const pts: number[] = [];
      for (let i = 0; i <= 10; i++) {
        const ang = Math.PI * (1.12 + 0.76 * (i / 10));
        const rr = p.r * (1 + 0.12 * Math.sin(3 * ang + b.seed + time * 2.5) + 0.06 * Math.sin(5 * ang - b.seed - time * 3));
        pts.push(p.x + Math.cos(ang) * rr, p.y + Math.sin(ang) * rr * 0.72);
      }
      // A soft haze through it, thickest at the top, and the lit edge.
      g.ellipse(p.x, p.y - p.r * 0.2, p.r * 0.8, p.r * 0.42).fill({ color: FOG_RIM, alpha: 0.07 * k });
      g.poly(pts, false).stroke({ width: p.r * 0.35, color: FOG_RIM, alpha: 0.08 * k, cap: "round", join: "round" });
      g.poly(pts, false).stroke({ width: 1.2, color: FOG_RIM, alpha: 0.4 * k, cap: "round", join: "round" });
    }
  }, { delay });
}

/** Its eyes: two pale-cyan points burning in the fog, a soft glow round them. */
function eyes(g: Graphics, p: Pt, s: number, alpha: number) {
  if (alpha <= 0.02) return;
  for (const sd of [-1, 1]) {
    const x = p.x + sd * s * 0.06, y = p.y;
    g.circle(x, y, s * 0.05).fill({ color: GHOST, alpha: 0.22 * alpha });
    g.ellipse(x, y, s * 0.024, s * 0.014).fill({ color: GHOST_HOT, alpha: 0.95 * alpha });
  }
}

// ── The blade ────────────────────────────────────────────────────────────────

/** The raised cutlass: a curved blade from `hilt` along `ang`, `len` long,
 *  broad toward its tip as a cutlass is, drawn in ghost-light — and a crackle
 *  of light crawling along its edge, re-rolled each frame. */
function cutlass(g: Graphics, hilt: Pt, ang: number, len: number, s: number, alpha: number, crackle: number) {
  if (alpha <= 0.02) return;
  const N = 10, back: number[] = [], edge: number[] = [], bend = 0.35;
  for (let i = 0; i <= N; i++) {
    const u = i / N, h = ang + bend * u * u, w = s * (0.018 + 0.03 * Math.sin(Math.PI * Math.min(1, u * 1.1)));
    const x = hilt.x + Math.cos(ang) * len * u + Math.cos(ang + Math.PI / 2) * len * 0.12 * u * u;
    const y = hilt.y + Math.sin(ang) * len * u + Math.sin(ang + Math.PI / 2) * len * 0.12 * u * u;
    back.push(x - Math.sin(h) * w * 0.3, y + Math.cos(h) * w * 0.3);
    edge.push(x + Math.sin(h) * w, y - Math.cos(h) * w);
  }
  const outline = edge.concat(back.slice().reverse().flatMap((_, i, arr) => (i % 2 ? [] : [arr[i + 1], arr[i]])));
  g.poly(edge, false).stroke({ width: s * 0.09, color: GHOST, alpha: 0.14 * alpha, cap: "round", join: "round" });
  g.poly(outline, true).fill({ color: GHOST, alpha: 0.5 * alpha });
  g.poly(edge, false).stroke({ width: 1.5, color: GHOST_HOT, alpha: 0.95 * alpha, join: "round" });
  // The hilt's guard, a short bar across the blade's root.
  const gx = Math.cos(ang + Math.PI / 2) * s * 0.06, gy = Math.sin(ang + Math.PI / 2) * s * 0.06;
  g.moveTo(hilt.x - gx, hilt.y - gy).lineTo(hilt.x + gx, hilt.y + gy).stroke({ width: 2, color: GHOST, alpha: 0.8 * alpha, cap: "round" });
  if (crackle > 0.02) {
    const pts: number[] = [];
    for (let i = 2; i <= N; i++) pts.push(edge[i * 2] + rand(-1, 1) * s * 0.03, edge[i * 2 + 1] + rand(-1, 1) * s * 0.03);
    g.poly(pts, false).stroke({ width: 1, color: GHOST_HOT, alpha: 0.8 * crackle * alpha, join: "miter" });
  }
}

// ── The move ─────────────────────────────────────────────────────────────────

export const DRIFTWRAITH: Signature = {
  shake: 1.1,
  // It keeps its lunge: it comes out of the fog at the card, and the cut is
  // made from where the lunge leaves it.

  deliver(t: FxTools, m: SigMoment, seconds: number) {
    const c = centre(m.from), s = m.size, S = seconds;
    const tc = m.targets.length ? centre(m.targets[0]) : { x: c.x + m.ahead.x * s, y: c.y + m.ahead.y * s };
    const lx = (tc.x - c.x) * LUNGE, ly = (tc.y - c.y) * LUNGE;
    const it = (time: number) => {
      const k = lungeK(time, S);
      return { x: c.x + lx * k, y: c.y + ly * k };
    };
    // THE FOG rolling off its card, thick, and thinning as it comes out.
    fog(t, c, s, S + 0.25, true, (time) => clamp01(time / 0.12) * (1 - clamp01((time - S) / 0.25)));
    // THE CUTLASS, raised over its head as on its art — the hilt up at its
    // shoulder, the blade swept back over it — glowing up through the fog,
    // and THE EYES opening under it.
    const raised = -Math.PI / 2 - 0.55;
    let acc = 0;
    t.draw(S, (g, u, dt) => {
      const time = u * S, p = it(time), k = easeOut(clamp01(u / 0.6));
      const hilt = { x: p.x - s * 0.18, y: p.y - s * 0.08 }, len = s * 0.72 * (0.5 + 0.5 * k);
      // Raised a little further as it winds, then brought round at the end.
      const ang = raised - 0.3 * k + 0.9 * clamp01((u - 0.82) / 0.18);
      cutlass(g, hilt, ang, len, s, Math.min(1, u * 3), Math.random() < 0.6 ? k : 0);
      eyes(g, { x: p.x, y: p.y - s * 0.18 }, s, clamp01((u - 0.15) / 0.2) * (0.75 + 0.25 * Math.sin(time * 30)));
      acc += dt * 26 * t.quality;
      for (; acc >= 1; acc--) {
        const f = rand(0.3, 1);
        t.spark(hilt.x + Math.cos(ang) * len * f, hilt.y + Math.sin(ang) * len * f, rand(-20, 20) * (s / 90), -rand(10, 40) * (s / 90), rand(0.25, 0.4), WISP);
      }
    });
    t.charge(c, s * 0.9, GHOST, 0.22, S);
  },

  land(t: FxTools, m: SigMoment) {
    const c = centre(m.from), s = m.size;
    m.targets.forEach((r, i) => ambush(t, c, r, m.power[i] ?? 1, !!m.killed[i], s));
    // THE RETREAT: the fog rolling back in over its own square and closing on
    // it as its token comes home, its eyes glinting once in there.
    const D = 0.85;
    fog(t, c, s, D, false, (time) => clamp01((time - 0.05) / 0.2) * (1 - clamp01((time - 0.55) / 0.3)), 0.12);
    t.draw(D, (g, u) => {
      const time = u * D, q = clamp01((time - 0.42) / 0.25);
      if (q > 0 && q < 1) eyes(g, { x: c.x, y: c.y - s * 0.18 }, s, Math.sin(Math.PI * q) * 0.85);
    }, { delay: 0.12 });
  },
};

/** THE AMBUSH on a card: one spectral cut straight through it from where the
 *  lunge left the wraith and on out the far side, ghost-images of the blade
 *  trailing it; drowned water bursting out the way it went and bubbles
 *  streaming after; on a kill, the card's ghost going up. */
function ambush(t: FxTools, c: Pt, r: Box, power: number, killed: boolean, s: number) {
  const p = centre(r), d = Math.hypot(p.x - c.x, p.y - c.y) || 1, ux = (p.x - c.x) / d, uy = (p.y - c.y) / d;
  const k = Math.max(0.8, Math.min(1.6, power)), sc = s / 90;
  // The line of the cut: a little across the line of attack, the way a
  // drawn cutlass comes down, from short of the card to well past it.
  const tilt = 0.28 * (Math.random() < 0.5 ? -1 : 1), cx = Math.cos(tilt), sx = Math.sin(tilt);
  const dx = ux * cx - uy * sx, dy = ux * sx + uy * cx;
  const A = { x: p.x - dx * s * 0.55, y: p.y - dy * s * 0.55 }, B = { x: p.x + dx * s * 1.05, y: p.y + dy * s * 1.05 };
  const CUT = 0.08, HOLD = 0.08, GO = 0.3, D = CUT + HOLD + GO, W = s * 0.17 * (0.85 + 0.15 * k);
  const bow = s * 0.08 * (tilt > 0 ? 1 : -1);
  const slash = (f0: number, f1: number, off: number) => {
    const N = 16, top: number[] = [], bot: number[] = [];
    for (let i = 0; i <= N; i++) {
      const f = f0 + ((f1 - f0) * i) / N, q = (i / N), hw = (W / 2) * Math.pow(Math.sin(Math.PI * Math.min(1, q * 1.05)), 0.7);
      const b = bow * Math.sin(Math.PI * f) + off;
      const x = A.x + (B.x - A.x) * f + -dy * b, y = A.y + (B.y - A.y) * f + dx * b;
      top.push(x - dy * hw, y + dx * hw);
      bot.unshift(x + dy * hw * 0.5, y - dx * hw * 0.5);
    }
    return { outline: top.concat(bot), edge: top };
  };
  const head = (time: number) => easeOut(clamp01(time / CUT));
  const tail = (time: number) => (time < CUT + HOLD ? 0.08 * head(time) : 0.08 + 0.92 * easeOut(clamp01((time - CUT - HOLD) / GO)));
  t.draw(D, (g, u) => {
    const time = u * D, h = head(time), tl = tail(time), hot = 1 - clamp01((time - CUT) / 0.1);
    if (h - tl < 0.01) return;
    // Ghost-images of the blade, a hair behind it and to either side.
    for (const [off, lag] of [[-0.06, 0.035], [0.06, 0.06]] as const) {
      const hh = head(time - lag);
      if (hh - tl > 0.02) g.poly(slash(tl, hh, off * s).outline, true).fill({ color: GHOST, alpha: 0.18 });
    }
    const sl = slash(tl, h, 0);
    g.poly(sl.edge, false).stroke({ width: W * 1.4, color: GHOST, alpha: 0.18, cap: "round", join: "round" });
    g.poly(sl.outline, true).fill({ color: GHOST, alpha: 0.65 });
    g.poly(sl.edge, false).stroke({ width: 2, color: GHOST_HOT, alpha: 0.6 + 0.4 * hot, cap: "round", join: "round" });
  });
  // The wound it leaves across the card: a dark gash along the cut, rimmed
  // in the ghost's cyan, closing as the fog comes back.
  const G0 = { x: p.x - dx * s * 0.34, y: p.y - dy * s * 0.34 }, G1 = { x: p.x + dx * s * 0.34, y: p.y + dy * s * 0.34 };
  const gash = (g: Graphics, u: number) => {
    const w = s * 0.045 * (1 - 0.6 * u), mx = (G0.x + G1.x) / 2 - dy * bow * 0.5, my = (G0.y + G1.y) / 2 + dx * bow * 0.5;
    return g.moveTo(G0.x, G0.y).quadraticCurveTo(mx - dy * w, my + dx * w, G1.x, G1.y).quadraticCurveTo(mx + dy * w, my - dx * w, G0.x, G0.y);
  };
  t.draw(0.5, (g, u) => { gash(g, u).fill({ color: 0x02080c, alpha: 0.75 * (1 - u * u) }); }, { dark: true, delay: CUT * 0.6 });
  t.draw(0.5, (g, u) => { gash(g, u).stroke({ width: 1.2, color: GHOST, alpha: 0.85 * (1 - u) }); }, { delay: CUT * 0.6 });
  // Where it goes through: a cold flash, ghost-light crackling off the wound.
  t.later(CUT * 0.5, () => {
    t.flash(p, GHOST, 0.18 * k * (s / 80));
    t.arcs(p, [GHOST_HOT, GHOST, TEAL], 0.22 * k, 2);
    t.ring(r, GHOST, 0.3, 1.0, 0.3, 2);
  });
  // Out the far side: drowned water thrown on with the blade...
  t.later(CUT * 0.7, () => {
    const out = { x: p.x + dx * s * 0.35, y: p.y + dy * s * 0.35 }, ang = Math.atan2(dy, dx);
    for (let i = 0; i < Math.round(18 * k); i++) {
      const a = ang + rand(-0.55, 0.55), v = rand(150, 340) * sc;
      t.spark(out.x + rand(-4, 4), out.y + rand(-4, 4), Math.cos(a) * v, Math.sin(a) * v - 50 * sc, rand(0.3, 0.5), BRINE);
    }
    bubbles(t, out, ang, s, k);
  });
  if (killed) t.later(0.12, () => ghost(t, r, s));
}

/** Spectral bubbles streaming out of a card after the blade, along `ang`:
 *  thrown, slowing, then wobbling up and popping — each a ring with a glint. */
function bubbles(t: FxTools, at: Pt, ang: number, s: number, k: number) {
  const n = Math.max(6, Math.round(12 * k * t.quality)), D = 0.75;
  const bs = Array.from({ length: n }, () => {
    const a = ang + rand(-0.6, 0.6), v = s * rand(0.6, 1.4);
    return { vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: s * rand(0.03, 0.07), life: rand(0.4, 0.7), ph: rand(0, TAU), rise: s * rand(0.5, 0.9) };
  });
  const where = (b: (typeof bs)[number], time: number) => {
    const dd = 0.25 * (1 - Math.exp(-time / 0.25));
    return { x: at.x + b.vx * dd + Math.sin(time * 14 + b.ph) * s * 0.025, y: at.y + b.vy * dd - b.rise * time * time };
  };
  t.draw(D, (g, u) => {
    const time = u * D;
    for (const b of bs) {
      const q = time / b.life;
      if (q >= 1.12) continue;
      const p = where(b, Math.min(time, b.life));
      if (q < 1) {
        g.circle(p.x, p.y, b.r).fill({ color: GHOST, alpha: 0.12 }).stroke({ width: 1.2, color: BUBBLE, alpha: 0.85 * (1 - q * 0.4) });
        g.circle(p.x - b.r * 0.35, p.y - b.r * 0.35, Math.max(0.7, b.r * 0.25)).fill({ color: GHOST_HOT, alpha: 0.9 });
      } else {
        // Popped: a flick of a ring, gone.
        const pq = (q - 1) / 0.12;
        g.circle(p.x, p.y, b.r * (1 + 1.2 * pq)).stroke({ width: 1, color: BUBBLE, alpha: 0.8 * (1 - pq) });
      }
    }
  });
}

/** A card it killed giving up its ghost: a skull of pale light rising off it,
 *  swaying, its sockets burning, a wisp trailing under it — and a drowned
 *  ship's bell tolling twice over it. */
function ghost(t: FxTools, r: Box, s: number) {
  const p = centre(r), D = 0.85, sway = Math.random() < 0.5 ? -1 : 1;
  t.draw(D, (g, u) => {
    const time = u * D, a = Math.min(1, time * 6) * (1 - clamp01((time - 0.45) / 0.4));
    if (a <= 0.02) return;
    const x = p.x + Math.sin(time * 6) * s * 0.04 * sway, y = p.y - s * 0.05 - s * 0.55 * easeOut(time / D), R = s * 0.11;
    // The wisp it trails, back down to where it rose from.
    const tail: number[] = [];
    for (let i = 0; i <= 8; i++) {
      const f = i / 8;
      tail.push(x + Math.sin(f * 5 + time * 9) * s * 0.04 * f, y + R * 0.9 + f * s * 0.32);
    }
    g.poly(tail, false).stroke({ width: s * 0.06, color: GHOST, alpha: 0.12 * a, cap: "round", join: "round" });
    g.poly(tail, false).stroke({ width: 1.2, color: GHOST, alpha: 0.6 * a, cap: "round", join: "round" });
    // Cranium and jaw.
    g.circle(x, y, R).fill({ color: GHOST, alpha: 0.16 * a }).stroke({ width: 1.5, color: GHOST_HOT, alpha: 0.9 * a });
    g.roundRect(x - R * 0.6, y + R * 0.55, R * 1.2, R * 0.6, R * 0.2).fill({ color: GHOST, alpha: 0.16 * a }).stroke({ width: 1.2, color: GHOST_HOT, alpha: 0.85 * a });
    for (let i = -1; i <= 1; i++) g.moveTo(x + i * R * 0.25, y + R * 0.75).lineTo(x + i * R * 0.25, y + R * 1.1);
    g.stroke({ width: 1, color: GHOST_HOT, alpha: 0.7 * a });
    // Sockets: rings, each with a cold glint burning in it.
    for (const sd of [-1, 1]) {
      g.circle(x + sd * R * 0.4, y + R * 0.1, R * 0.27).stroke({ width: 1.2, color: GHOST_HOT, alpha: 0.85 * a });
      g.circle(x + sd * R * 0.4, y + R * 0.12, R * 0.09).fill({ color: GHOST_HOT, alpha: a });
    }
    g.moveTo(x, y + R * 0.38).lineTo(x - R * 0.1, y + R * 0.58).lineTo(x + R * 0.1, y + R * 0.58).closePath().stroke({ width: 1, color: GHOST_HOT, alpha: 0.7 * a });
  });
  // The toll: two rings of the bell going out over it, a beat apart.
  t.ring(r, BELL, 0.4, 1.5, 0.45, 2);
  t.later(0.22, () => t.ring(r, BELL, 0.4, 1.7, 0.5, 1.5));
  t.glow(r, GHOST, 0.2, 0.5, 1.0);
}
