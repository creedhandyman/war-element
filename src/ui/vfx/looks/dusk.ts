/** DUSK — shadow. Everything it does CREEPS and DRAINS: light is pulled in
 *  rather than thrown out, what it throws is a dark core ringed in violet (an
 *  eclipse, not a glowing ball), its claws leave a stain, and what it takes
 *  curls back toward it as smoke.
 *
 *  Darkness is drawn for real — `draw(..., { dark: true })`, the normal-blend
 *  layer — because under additive light a shadow is nothing. Even then, on a
 *  near-black board a dark shape only reads against something lit, so every
 *  one here comes with a violet edge, and the light is kept OFF the dark
 *  parts (a corona is a ring, never a filled glow) so they stay dark. */
import type { Graphics } from "pixi.js";
import { centre, rand } from "./base";
import type { ElementLook, FxTools, Pt, SparkStyle } from "./types";

const PALE = 0xf3e8ff;   // the lit edge of a shadow
const LILAC = 0xc9a6ff;
const VIOLET = 0x9a6ad8;
const PURPLE = 0x7b4fb0;
const DEEP = 0x4a2a78;
const INK = 0x0b0418;    // the shadow itself — only ever on the dark layer
const MINT = 0xdcffe4;   // life, as a heal draws it through the shadow
const TAU = Math.PI * 2;

const clamp01 = (u: number) => (u < 0 ? 0 : u > 1 ? 1 : u);
/** 0 -> 1 as `u` runs from `a` to `b`. */
const span = (u: number, a: number, b: number) => clamp01((u - a) / (b - a));
const easeOut = (u: number) => 1 - (1 - u) * (1 - u);

// ── How its sparks move ──────────────────────────────────────────────────────
// Shared constants: the layer caches a style per object, so a hundred sparks
// from one of these cost one style.

/** Smoke: round, SWELLING as it thins, drifting up — the opposite of a spark
 *  that shrinks as it cools. */
const SMOKE: SparkStyle = { palette: [LILAC, VIOLET, PURPLE, DEEP], gravity: -50, drag: 0.4, size: [4, 12], streak: false };
/** Wisps that curl round where they were born. */
const CURL: SparkStyle = { palette: [PALE, LILAC, VIOLET, PURPLE], gravity: -20, drag: 0.45, size: [8, 3], streak: false, swirl: 320 };
/** Motes drawn IN, streaked toward where they are going and turned as they
 *  come, so a gathering spirals rather than shrinks. */
const MOTE_IN: SparkStyle = { palette: [PALE, LILAC, VIOLET], gravity: 0, drag: 1, size: [7, 2], streak: true, swirl: 260 };
/** What a claw took, streaming back toward whoever struck. */
const SIPHON: SparkStyle = { palette: [PALE, LILAC, VIOLET, PURPLE], gravity: 0, drag: 0.45, size: [8, 3], streak: true, swirl: 90 };
/** Life drawn in by a heal: pale green through the violet. */
const DRAIN: SparkStyle = { palette: [PALE, MINT, LILAC], gravity: 0, drag: 1, size: [8, 2], streak: true, swirl: 220 };
/** ...and rising off the healed card as smoke. */
const LIFE: SparkStyle = { palette: [0xffffff, MINT, LILAC, PURPLE], gravity: -60, drag: 0.5, size: [5, 12], streak: false, swirl: 180 };

// ── Drawing helpers ──────────────────────────────────────────────────────────

/** The orb a DUSK card throws (and condenses before it throws), px. */
const duskOrb = (size: number, special: boolean) => size * (special ? 0.17 : 0.11);

/** Points along a line from a to b that SWAYS: `amp` px sideways, `waves`
 *  half-waves along it, `phase` rolled with time so it writhes. Free at the b
 *  end (it sways most there, like a tendril's tip) unless `pinned`, which holds
 *  both ends still. Only the first `reach` (0..1) is laid out, so it can grow. */
function duskPath(ax: number, ay: number, bx: number, by: number, n: number, amp: number, waves: number,
  phase: number, reach = 1, pinned = false): number[] {
  const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len;
  const out: number[] = [];
  for (let i = 0; i <= n; i++) {
    const s = (i / n) * reach;
    const off = amp * (pinned ? Math.sin(Math.PI * s) : s) * Math.sin(waves * Math.PI * s + phase);
    out.push(ax + dx * s + nx * off, ay + dy * s + ny * off);
  }
  return out;
}

/** Stroke a path from `w0` wide at its start to `w1` at its end, fading
 *  along it — a wisp, not a wire. Three round-capped chunks, so it reads as
 *  one line. */
function duskTaper(g: Graphics, pts: number[], w0: number, w1: number, color: number, alpha: number) {
  const n = pts.length / 2 - 1;
  if (n < 1 || alpha <= 0.01) return;
  for (let k = 0; k < 3; k++) {
    const i0 = Math.floor((k * n) / 3), i1 = Math.floor(((k + 1) * n) / 3);
    if (i1 <= i0) continue;
    g.moveTo(pts[2 * i0], pts[2 * i0 + 1]);
    for (let i = i0 + 1; i <= i1; i++) g.lineTo(pts[2 * i], pts[2 * i + 1]);
    const f = (k + 0.5) / 3;
    g.stroke({ width: w0 + (w1 - w0) * f, color, alpha: alpha * (1 - f * 0.45), cap: "round", join: "round" });
  }
}

/** The lit half of an eclipse: a violet corona and a pale rim round a core
 *  left UNLIT, so the dark disc drawn beneath it stays dark. */
function duskCorona(g: Graphics, x: number, y: number, r: number, a: number) {
  if (r < 0.5 || a <= 0.01) return;
  g.circle(x, y, r * 1.5).stroke({ width: r * 0.9, color: PURPLE, alpha: 0.3 * a });
  g.circle(x, y, r * 1.2).stroke({ width: r * 0.45, color: VIOLET, alpha: 0.5 * a });
  g.circle(x, y, r * 1.02).stroke({ width: Math.max(1.5, r * 0.16), color: PALE, alpha: 0.95 * a });
}

/** A shadow stain: overlapping discs, so its edge is ragged rather than a coin
 *  and it is densest in the middle (the overlaps stack). */
function duskBlot(g: Graphics, x: number, y: number, r: number, alpha: number, seed: number) {
  if (r < 0.5 || alpha <= 0.01) return;
  g.circle(x, y, r * 0.62);
  for (let i = 0; i < 4; i++) {
    const a = seed + i * 1.9;
    g.circle(x + Math.cos(a) * r * 0.38, y + Math.sin(a) * r * 0.38, r * (0.46 + 0.1 * (i % 3)));
  }
  g.fill({ color: INK, alpha });
}

/** A claw gash along a quadratic curve (`c` = p0, control, p2): filled as a
 *  crescent, sharp at both ends and widest mid-way, and laid down only up to
 *  `drawn` (0..1) of its length, so it TEARS across rather than appearing. */
function duskGash(g: Graphics, c: number[], w: number, drawn: number, color: number, alpha: number) {
  const n = 10, left: number[] = [], right: number[] = [];
  for (let i = 0; i <= n; i++) {
    const s = (i / n) * drawn, m = 1 - s;
    const x = m * m * c[0] + 2 * m * s * c[2] + s * s * c[4];
    const y = m * m * c[1] + 2 * m * s * c[3] + s * s * c[5];
    const tx = m * (c[2] - c[0]) + s * (c[4] - c[2]), ty = m * (c[3] - c[1]) + s * (c[5] - c[3]);
    const tl = Math.hypot(tx, ty) || 1;
    const hw = (w / 2) * Math.pow(Math.sin(Math.PI * s), 0.7);
    left.push(x - (ty / tl) * hw, y + (tx / tl) * hw);
    right.push(x + (ty / tl) * hw, y - (tx / tl) * hw);
  }
  for (let i = n; i >= 0; i--) left.push(right[2 * i], right[2 * i + 1]);
  g.poly(left).fill({ color, alpha });
}

/** `n` motes born on a ring round `c` and drawn into it, turning as they come
 *  — the gathering nearly every DUSK effect starts from. */
function duskDrawIn(t: FxTools, c: Pt, n: number, r0: number, r1: number, life: [number, number], style: SparkStyle) {
  for (let i = 0; i < n; i++) {
    const a = rand(0, TAU), r = rand(r0, r1), l = rand(life[0], life[1]);
    const v = r / l, ca = Math.cos(a), sa = Math.sin(a);
    t.spark(c.x + ca * r, c.y + sa * r, (-ca - sa * 0.4) * v, (-sa + ca * 0.4) * v, l, style, c);
  }
}

/** An eclipse CONDENSING at a point over `secs`: the dark core swelling under
 *  its corona — what a ranged card is about to throw. */
function duskEclipse(t: FxTools, at: Pt, r: number, secs: number) {
  t.draw(secs, (g, u) => {
    g.circle(at.x, at.y, r * easeOut(u)).fill({ color: INK, alpha: 0.9 });
  }, { dark: true });
  t.draw(secs, (g, u) => duskCorona(g, at.x, at.y, r * easeOut(u), Math.min(1, u * 1.5)));
}

/** A card's shadow POOLING under it: a stain spreading with a lit rim, then
 *  thinning out at the end. */
function duskPool(t: FxTools, at: Pt, r: number, secs: number, alpha: number) {
  const seed = rand(0, TAU);
  const grow = (u: number) => easeOut(span(u, 0, 0.6));
  const fade = (u: number) => 1 - span(u, 0.75, 1);
  t.draw(secs, (g, u) => duskBlot(g, at.x, at.y, r * grow(u), alpha * fade(u), seed), { dark: true });
  t.draw(secs, (g, u) => {
    const rr = r * grow(u) * 0.9;
    if (rr > 1) g.circle(at.x, at.y, rr).stroke({ width: 1.5, color: LILAC, alpha: 0.55 * grow(u) * fade(u) });
  });
}

/** Tendrils of shadow creeping IN from `reach` round a point, turning as they
 *  close — the darkness being called, not light gathering. */
function duskReachIn(t: FxTools, at: Pt, reach: number, n: number, secs: number) {
  const base = rand(0, TAU);
  t.draw(secs, (g, u) => {
    const k = easeOut(u), a = Math.min(1, u * 5) * (1 - span(u, 0.7, 1));
    for (let i = 0; i < n; i++) {
      const ang = base + (i / n) * TAU + k * 1.2;
      const root = reach * (1 - 0.4 * k), tip = reach * (1 - 0.88 * k);
      const pts = duskPath(at.x + Math.cos(ang) * root, at.y + Math.sin(ang) * root,
        at.x + Math.cos(ang + 0.4) * tip, at.y + Math.sin(ang + 0.4) * tip, 7, reach * 0.09, 1.5, u * 9 + i);
      duskTaper(g, pts, 2.6, 0.8, LILAC, 0.75 * a);
    }
  });
}

// ── The look ─────────────────────────────────────────────────────────────────

export const DUSK: ElementLook = {
  markColor: 0xb07cff,

  windUp(t, d) {
    const dur = d.wind + (d.T - d.wind) * 0.3;
    if (d.melee && !d.special) {
      // A basic swing: the lunge is the wind-up, and it comes every turn —
      // only a few motes of shadow drawn into the card.
      duskDrawIn(t, d.at, 6, d.size * 0.35, d.size * 0.5, [0.14, 0.2], MOTE_IN);
      return;
    }
    // A ranged card condenses the eclipse it will throw, gone on the frame it
    // leaves; a melee Special's own shadow deepens under it instead.
    if (d.melee) duskPool(t, d.at, d.size * 0.4, dur, 0.5);
    else duskEclipse(t, d.at, duskOrb(d.size, d.special), d.wind);
    duskDrawIn(t, d.at, d.special ? 22 : 9, d.size * 0.4, d.size * 0.62, [0.18, Math.max(0.2, dur)], MOTE_IN);
    if (d.special) duskReachIn(t, d.at, d.size * 0.85, 4, dur);
  },

  gather(t, d) {
    // The square it lands on is still empty: shadow POOLS there, darkness
    // spirals into it, and a ranged strike leaves from the eclipse at its heart.
    duskPool(t, d.at, d.size * 0.42, d.T, 0.55);
    duskDrawIn(t, d.at, d.special ? 28 : 16, d.size * 0.45, d.size * 0.7, [0.2, d.T * 0.8], MOTE_IN);
    duskReachIn(t, d.at, d.size * 0.9, d.special ? 5 : 3, d.T);
    if (!d.melee) duskEclipse(t, d.at, duskOrb(d.size, d.special), d.wind);
  },

  projectile(t, s) {
    // An eclipse in flight: a DARK core in a violet corona, a smoky tail
    // tapering behind it and wisps twisting round each other in its wake.
    // Hand-drawn, eased in like `shot` (shadow gathers speed), and at `to`
    // on exactly delay + seconds; for a beat after, the orb and its tail sink
    // INTO the target while the hit implodes on it.
    const r = duskOrb(s.size, s.special);
    const sink = 0.1, total = s.seconds + sink;
    const ax = s.from.x, ay = s.from.y, dx = s.to.x - ax, dy = s.to.y - ay;
    const len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len;
    const gap = (r * 0.8) / len;
    const lash = s.special ? 3 : 2, wisp = r * (s.special ? 7 : 5.5), seed = rand(0, TAU);
    const along = (sec: number) => { const k = clamp01(sec / s.seconds); return k * k; };
    t.draw(total, (g, u) => {
      const sec = u * total, e = along(sec), gone = span(sec, s.seconds, total);
      for (let k = 1; k <= 5; k++) {
        const ek = Math.max(0, e - k * gap * (1 - gone));
        g.circle(ax + dx * ek, ay + dy * ek, r * (1 - k * 0.14));
      }
      g.fill({ color: INK, alpha: 0.4 * (1 - gone) });
      g.circle(ax + dx * e, ay + dy * e, r * (1 - 0.7 * gone)).fill({ color: INK, alpha: 0.92 * (1 - gone) });
    }, { delay: s.delay, dark: true });
    let acc = 0;
    t.draw(total, (g, u, dt) => {
      const sec = u * total, e = along(sec), gone = span(sec, s.seconds, total);
      const hx = ax + dx * e, hy = ay + dy * e;
      const a = (1 - gone) * Math.min(1, sec / 0.05);
      // Wisps no longer than the way it has come, so none trail off behind
      // the card that threw it.
      const L = Math.min(wisp, e * len) * (1 - gone);
      if (L > 4)
        for (let i = 0; i < lash; i++) {
          const pts = duskPath(hx - ux * r * 1.05, hy - uy * r * 1.05, hx - ux * (r + L), hy - uy * (r + L), 9,
            r * (s.special ? 1.0 : 0.7), 1.6, seed + sec * 22 + (i * TAU) / lash);
          duskTaper(g, pts, s.special ? 3.2 : 2.2, 0.6, LILAC, 0.8 * a);
        }
      duskCorona(g, hx, hy, r * (1 - 0.7 * gone), a);
      if (gone > 0) return;
      // Smoke shed from BEHIND the core, never on it: light there would fill it.
      acc += (s.special ? 150 : 70) * dt;
      while (acc >= 1) {
        acc -= 1;
        const j = rand(-0.6, 0.6) * r, back = rand(10, 40), side = rand(-25, 25);
        t.spark(hx - ux * r * 1.4 - uy * j, hy - uy * r * 1.4 + ux * j, -ux * back - uy * side, -uy * back + ux * side,
          rand(0.25, 0.45), SMOKE);
      }
    }, { delay: s.delay });
  },

  swing(t, s) {
    const ax = s.from.x, ay = s.from.y, bx = s.to.x, by = s.to.y;
    const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1, px = -dy / len, py = dx / len;
    const hold = 0.1, total = s.seconds + hold, seed = rand(0, TAU);
    const along = (sec: number) => { const k = clamp01(sec / s.seconds); return k * k; };
    if (!s.special) {
      // A basic swing: one thin tendril of shadow reaching ahead of the lunge
      // and let go as the blow lands — a whisper, every turn.
      t.draw(total, (g, u) => {
        const sec = u * total, e = along(sec), fade = 1 - span(sec, s.seconds, total);
        if (e * len < 4) return;
        duskTaper(g, duskPath(ax, ay, bx, by, 8, s.size * 0.06, 2, seed + sec * 18, e), 2.2, 0.8, LILAC, 0.6 * fade);
      }, { delay: s.delay });
      return;
    }
    // A Special: the attacker's shadow reaches ahead of it — three tendrils
    // splayed like fingers, closing on the target as the claws land. Dark
    // bodies under lit edges, so they read as shadow, not as light.
    const spread = s.size * 0.3;
    const finger = (sec: number, i: number) => {
      const e = along(sec), off = (i - 1) * spread * Math.sin(Math.PI * e);
      const rx = ax + px * (i - 1) * s.size * 0.1, ry = ay + py * (i - 1) * s.size * 0.1;
      return duskPath(rx, ry, ax + dx * e + px * off, ay + dy * e + py * off, 10, s.size * 0.08, 2,
        seed + sec * 16 + i * 2.1, 1, true);
    };
    t.draw(total, (g, u) => {
      const sec = u * total, fade = 1 - span(sec, s.seconds, total);
      if (along(sec) * len < 6) return;
      for (let i = 0; i < 3; i++) duskTaper(g, finger(sec, i), 10, 4, INK, 0.55 * fade);
    }, { delay: s.delay, dark: true });
    let acc = 0;
    t.draw(total, (g, u, dt) => {
      const sec = u * total, fade = 1 - span(sec, s.seconds, total);
      if (along(sec) * len < 6) return;
      for (let i = 0; i < 3; i++) {
        const pts = finger(sec, i);
        duskTaper(g, pts, 3.4, 1.2, LILAC, 0.85 * fade);
        if (fade < 1) continue;
        // Smoke shed off the fingertips as they reach.
        acc += 30 * dt;
        while (acc >= 1) {
          acc -= 1;
          t.spark(pts[pts.length - 2], pts[pts.length - 1], rand(-30, 30), rand(-40, 10), rand(0.25, 0.45), SMOKE);
        }
      }
    }, { delay: s.delay });
  },

  mark(t, m) {
    // Three curved talons TEAR across the card one after another: lit violet
    // gashes over wider dark wounds that outlast them — the stain a claw
    // leaves — then what it took curls back out of the card toward whoever
    // struck it. All inside the square, all gone by ~0.55s.
    const ux = Math.cos(m.across), uy = Math.sin(m.across);
    const nx = -uy, ny = ux;
    const L = m.reach * 0.82, gap = m.reach * 0.34, bow = L * 0.28;
    const kk = Math.max(0.8, Math.min(1.5, m.k));
    const claws: number[][] = [];
    for (let i = -1; i <= 1; i++) {
      const len = L * (i === 0 ? 1 : 0.85);
      const mx = m.c.x + nx * gap * i + ux * L * 0.08 * i, my = m.c.y + ny * gap * i + uy * L * 0.08 * i;
      claws.push([mx - ux * len, my - uy * len, mx - nx * bow, my - ny * bow, mx + ux * len, my + uy * len]);
    }
    const tear = (sec: number, j: number) => span(sec, j * 0.025, j * 0.025 + 0.08);
    const seed = rand(0, TAU);
    t.draw(0.55, (g, u) => {
      const sec = u * 0.55, fade = 1 - span(sec, 0.28, 0.55);
      duskBlot(g, m.c.x, m.c.y, m.reach * 0.62 * easeOut(span(sec, 0, 0.15)), 0.32 * fade, seed);
      for (let j = 0; j < 3; j++) {
        const d = tear(sec, j);
        if (d > 0) duskGash(g, claws[j], 15 * kk, d, INK, 0.72 * fade);
      }
    }, { dark: true });
    const back = m.angle + Math.PI, bx = Math.cos(back), by = Math.sin(back);
    t.draw(0.5, (g, u) => {
      const sec = u * 0.5, fade = 1 - span(sec, 0.12, 0.4);
      for (let j = 0; j < 3; j++) {
        const d = tear(sec, j);
        if (d <= 0 || fade <= 0) continue;
        duskGash(g, claws[j], 6.5 * kk, d, VIOLET, 0.95 * fade);
        duskGash(g, claws[j], 2.4, d, PALE, fade);
      }
      const grow = easeOut(span(sec, 0.1, 0.32)), wf = 1 - span(sec, 0.3, 0.5);
      if (grow > 0 && wf > 0)
        for (let i = 0; i < 2; i++) {
          const sx = m.c.x + ux * m.reach * (i ? 0.35 : -0.35), sy = m.c.y + uy * m.reach * (i ? 0.35 : -0.35);
          const pts = duskPath(sx, sy, sx + bx * m.reach * 1.6, sy + by * m.reach * 1.6, 9, m.reach * 0.18, 2,
            seed + sec * 14 + i * 3, grow);
          duskTaper(g, pts, 2.6, 0.8, LILAC, 0.7 * wf);
        }
    });
    t.later(0.1, () => {
      const n = Math.round(14 * m.k);
      for (let i = 0; i < n; i++) {
        const c = claws[i % 3], s = rand(0.2, 0.8), q = 1 - s;
        const a = back + rand(-0.4, 0.4), v = rand(140, 250);
        t.spark(q * q * c[0] + 2 * q * s * c[2] + s * s * c[4], q * q * c[1] + 2 * q * s * c[3] + s * s * c[5],
          Math.cos(a) * v, Math.sin(a) * v, rand(0.3, 0.5), SIPHON);
      }
    });
  },

  xSparks(t, c, count) {
    // The X's few sparks are drawn IN, spiralling into the cross — DUSK's
    // imploding hit at a whisper.
    for (let i = 0; i < count; i++) {
      const a = (i / count) * TAU + rand(-0.3, 0.3), r = rand(14, 22), l = rand(0.16, 0.26);
      const v = r / l, ca = Math.cos(a), sa = Math.sin(a);
      t.spark(c.x + ca * r, c.y + sa * r, (-ca - sa * 0.4) * v, (-sa + ca * 0.4) * v, l, MOTE_IN, c);
    }
  },

  arrive(t, r) {
    // The shadow that pooled here BREAKS: dark smoke thrown out in a ring of
    // puffs, tendrils lashing out and falling slack, the card left standing
    // where the eclipse was.
    const c = centre(r), h = Math.min(r.w, r.h) / 2, seed = rand(0, TAU);
    t.draw(0.6, (g, u) => {
      const e = easeOut(u), f = Math.pow(1 - u, 1.3);
      for (let i = 0; i < 7; i++) {
        const a = seed + (i / 7) * TAU, d = h * (0.2 + 0.85 * e);
        g.circle(c.x + Math.cos(a) * d, c.y + Math.sin(a) * d, h * (0.2 + 0.22 * e));
      }
      g.fill({ color: INK, alpha: 0.5 * f });
      if (e < 0.98) g.circle(c.x, c.y, h * 0.45 * (1 - e)).fill({ color: INK, alpha: 0.7 * f });
    }, { dark: true });
    t.draw(0.45, (g, u) => {
      const e = easeOut(Math.min(1, u * 1.6)), f = 1 - u;
      for (let i = 0; i < 6; i++) {
        const a = seed + 0.45 + (i / 6) * TAU, tip = h * (0.3 + 1.05 * e);
        const pts = duskPath(c.x + Math.cos(a) * h * 0.2, c.y + Math.sin(a) * h * 0.2,
          c.x + Math.cos(a + 0.4) * tip, c.y + Math.sin(a + 0.4) * tip, 8, h * 0.14, 1.5, seed + u * 12 + i);
        duskTaper(g, pts, 3, 0.7, LILAC, 0.8 * f);
      }
      g.circle(c.x, c.y, h * (0.25 + 0.95 * easeOut(u))).stroke({ width: 2, color: PALE, alpha: 0.5 * f });
    });
    for (let i = 0; i < 24; i++) {
      const a = rand(0, TAU), v = rand(130, 260);
      t.spark(c.x, c.y, Math.cos(a) * v, Math.sin(a) * v, rand(0.3, 0.5), CURL);
    }
  },

  impactAccent(t, at, k) {
    // Shadow condensing into the wound as DUSK's hit draws in, left behind
    // as a stain that thins out — dark UNDER the burst, so the burst reads
    // brighter against it — and a few wisps curling up off it after. Every
    // spell hit plays this: one draw, a handful of sparks.
    const R = Math.min(30, 12 + 11 * k), seed = rand(0, TAU);
    t.draw(0.95, (g, u) => {
      duskBlot(g, at.x, at.y, R * easeOut(span(u, 0, 0.28)), 0.5 * (1 - span(u, 0.35, 1)), seed);
    }, { dark: true });
    t.later(0.3, () => t.emit({
      count: Math.min(20, Math.round(9 * k)), palette: [LILAC, VIOLET, PURPLE, DEEP],
      from: { x: at.x - R * 0.5, y: at.y - R * 0.5, w: R, h: R }, dir: [-125, -55], speed: [25, 70],
      gravity: -60, drag: 0.5, life: [0.5, 0.8], size: [5, 12], swirl: 120,
    }));
  },

  shield(t, r) {
    // A veil of shadow WRAPPED round the card: three bands of smoke swirl in
    // and close into one ring, the card veiled a moment inside it, then the
    // veil thins away — a shroud, not a bubble.
    const c = centre(r), h = Math.min(r.w, r.h) / 2, seed = rand(0, TAU);
    const radius = (u: number) => h * (1.5 - 0.42 * easeOut(span(u, 0, 0.5)));
    const length = (u: number) => 0.5 + 1.62 * easeOut(span(u, 0, 0.5));
    const turn = (u: number) => seed + 4.5 * easeOut(span(u, 0, 0.6)) + u * 0.8;
    const fade = (u: number) => 1 - span(u, 0.6, 1);
    t.draw(1.0, (g, u) => {
      const rr = radius(u), L = length(u), ro = turn(u), f = fade(u);
      for (let i = 0; i < 3; i++) {
        const a0 = ro + (i * TAU) / 3;
        g.moveTo(c.x + Math.cos(a0) * rr, c.y + Math.sin(a0) * rr).arc(c.x, c.y, rr, a0, a0 + L)
          .stroke({ width: h * 0.34, color: INK, alpha: 0.5 * f });
      }
      const veil = span(u, 0.3, 0.5) * f;
      if (veil > 0) g.circle(c.x, c.y, rr * 0.9).fill({ color: INK, alpha: 0.2 * veil });
    }, { dark: true });
    t.draw(1.0, (g, u) => {
      const rr = radius(u), L = length(u), ro = turn(u), f = fade(u);
      // Each band thin at its tail and brightest at the leading edge it
      // swirls on.
      for (let i = 0; i < 3; i++) {
        const a0 = ro + (i * TAU) / 3;
        for (let j = 0; j < 3; j++) {
          const s0 = a0 + (L * j) / 3, s1 = a0 + (L * (j + 1)) / 3;
          g.moveTo(c.x + Math.cos(s0) * rr, c.y + Math.sin(s0) * rr).arc(c.x, c.y, rr, s0, s1)
            .stroke({ width: 1 + j * 1.2, color: j === 2 ? PALE : LILAC, alpha: (0.35 + 0.25 * j) * f });
        }
      }
      // The moment the veil closes, the whole ring catches the light once.
      const shut = span(u, 0.45, 0.55) * (1 - span(u, 0.55, 0.85));
      if (shut > 0) g.circle(c.x, c.y, rr).stroke({ width: 2.5, color: PALE, alpha: 0.7 * shut });
    });
    for (let i = 0; i < 18; i++) {
      const a = rand(0, TAU), rr = h * rand(1.3, 1.6), v = rand(140, 200);
      t.spark(c.x + Math.cos(a) * rr, c.y + Math.sin(a) * rr, -Math.sin(a) * v - Math.cos(a) * 45,
        Math.cos(a) * v - Math.sin(a) * 45, rand(0.4, 0.65), MOTE_IN, c);
    }
  },

  heal(t, r, k) {
    // Shadow heals by TAKING: life drawn in from all round the card, curling
    // as it comes, then rising off it as pale smoke — its aura, siphon and
    // mend, in one breath. Pale green through the violet, so it still reads
    // as a heal.
    const kk = Math.max(0.7, Math.min(2.2, k));
    const c = centre(r), h = Math.min(r.w, r.h) / 2, seed = rand(0, TAU);
    duskDrawIn(t, c, Math.round(16 * kk), h * 1.1, h * 1.6, [0.3, 0.45], DRAIN);
    t.later(0.3, () => {
      t.glow(r, MINT, 0.3, 0.7, 1.1);
      const n = Math.round(14 * kk);
      for (let i = 0; i < n; i++)
        t.spark(c.x + rand(-0.7, 0.7) * h, c.y + rand(-0.2, 0.8) * h, rand(-15, 15), -rand(40, 90),
          rand(0.6, 0.9), LIFE);
    });
    t.draw(0.8, (g, u) => {
      const grow = easeOut(span(u, 0, 0.55)), f = 1 - span(u, 0.5, 1);
      for (let i = 0; i < 2; i++) {
        const x = c.x + (i ? 0.3 : -0.3) * h, y = c.y + h * 0.6;
        const pts = duskPath(x, y, x + (i ? 0.2 : -0.2) * h, y - h * 2.1, 10, h * 0.2, 2.2, seed + u * 7 + i * 2, grow);
        duskTaper(g, pts, 2.4, 0.6, i ? MINT : LILAC, 0.7 * f);
      }
    }, { delay: 0.25 });
  },

  wall(t, r) {
    // Shadow smoke rising off the whole row out of a dark footing — a wall
    // you cannot see through, not one that shines. Dark bands stacked up
    // from the bottom stand in for a gradient; the one lit line is its foot.
    const bottom = r.y + r.h, seed = rand(0, TAU);
    const cols = Math.max(5, Math.round(r.w / 32));
    const xs: number[] = [], ph: number[] = [];
    for (let i = 0; i < cols; i++) { xs.push(r.x + ((i + 0.5) / cols) * r.w + rand(-6, 6)); ph.push(rand(0, 1)); }
    t.draw(1.1, (g, u) => {
      const rise = easeOut(span(u, 0, 0.3)), f = 1 - span(u, 0.55, 1);
      const bh = r.h * 0.22 * rise;
      if (bh > 0.5)
        for (let i = 0; i < 4; i++)
          g.rect(r.x, bottom - (i + 1) * bh, r.w, bh).fill({ color: INK, alpha: (0.5 - 0.12 * i) * f });
      // Dark smoke rolling up each column.
      for (let i = 0; i < cols; i++) {
        const p = (u * 1.4 + ph[i]) % 1;
        g.circle(xs[i] + Math.sin(p * 5 + i) * 5, bottom - r.h * 1.15 * p * rise, r.h * (0.1 + 0.16 * p))
          .fill({ color: INK, alpha: 0.35 * (1 - p) * f });
      }
    }, { dark: true });
    t.draw(1.1, (g, u) => {
      const f = 1 - span(u, 0.55, 1);
      g.moveTo(r.x, bottom - 1).lineTo(r.x + r.w, bottom - 1)
        .stroke({ width: 2, color: LILAC, alpha: 0.75 * easeOut(span(u, 0, 0.15)) * f });
      for (let i = 0; i < cols; i += 2) {
        const grow = easeOut(span(u, ph[i] * 0.25, ph[i] * 0.25 + 0.5));
        if (grow <= 0) continue;
        const pts = duskPath(xs[i], bottom, xs[i] + (i % 4 ? 12 : -12), bottom - r.h * 1.2, 10, r.h * 0.12, 2.5,
          seed + u * 8 + i, grow);
        duskTaper(g, pts, 3, 0.6, VIOLET, 0.8 * f);
      }
    });
    const wave = (n: number) => {
      for (let i = 0; i < n; i++)
        t.spark(r.x + rand(0, r.w), bottom - rand(0, r.h * 0.15), rand(-15, 15), -rand(60, 150), rand(0.6, 1.0), CURL);
    };
    wave(Math.round(r.w / 5));
    t.later(0.25, () => wave(Math.round(r.w / 9)));
  },

  field(t, r) {
    // Darkness closing in: the board's edges go dark and the dark CREEPS
    // inward, tendrils reaching ahead of it for the middle, then the night
    // lifts. The same night DUSK's board spell draws, at a gentler pitch.
    const m = Math.min(r.w, r.h), c = centre(r), seed = rand(0, TAU);
    const close = (u: number) => easeOut(span(u, 0, 0.5));
    const lift = (u: number) => 1 - span(u, 0.7, 1);
    t.draw(1.3, (g, u) => {
      const D = m * 0.34 * close(u), f = lift(u), n = 6, step = D / n;
      if (step < 0.5) return;
      // Stepped bands inset from the edge, darkest outermost: a vignette that
      // stays on the board.
      for (let i = 0; i < n; i++) {
        const inset = (i + 0.5) * step;
        g.rect(r.x + inset, r.y + inset, r.w - 2 * inset, r.h - 2 * inset)
          .stroke({ width: step, color: INK, alpha: 0.62 * (1 - i / n) * f });
      }
      g.rect(r.x, r.y, r.w, r.h).fill({ color: INK, alpha: 0.12 * close(u) * f });
    }, { dark: true });
    // Two tendrils creeping in off each side.
    const roots: number[] = [];
    for (let side = 0; side < 4; side++)
      for (let i = 0; i < 2; i++) {
        const s = (i + rand(0.25, 0.75)) / 2;
        roots.push(side < 2 ? r.x + s * r.w : side === 2 ? r.x : r.x + r.w,
          side === 0 ? r.y : side === 1 ? r.y + r.h : r.y + s * r.h, rand(0, 0.2));
      }
    t.draw(1.2, (g, u) => {
      const f = 1 - span(u, 0.6, 1);
      for (let i = 0; i < 8; i++) {
        const x = roots[3 * i], y = roots[3 * i + 1], d = roots[3 * i + 2];
        const grow = easeOut(span(u, d, d + 0.55));
        if (grow <= 0) continue;
        const pts = duskPath(x, y, x + (c.x - x) * 0.55, y + (c.y - y) * 0.55, 10, m * 0.05, 2.5, seed + u * 6 + i, grow);
        duskTaper(g, pts, 3.2, 0.6, VIOLET, 0.8 * f);
      }
    });
    for (let w = 0; w < 3; w++)
      t.later(w * 0.2, () => t.emit({
        count: 45, palette: [PALE, LILAC, VIOLET, PURPLE], from: r, at: "edge", speed: [60, 140], gravity: 0,
        drag: 1, life: [0.5, 1.0], size: [9, 3], swirl: 60,
      }));
  },

  move(t, from, to) {
    // A shadow-step: it comes apart into smoke where it stood, slides across
    // the floor as a shadow, and pulls itself together where it lands.
    const a = centre(from), b = centre(to), h = Math.min(from.w, from.h) / 2, seed = rand(0, TAU);
    const slide = (u: number) => { const p = span(u, 0.1, 0.5); return p * p * (3 - 2 * p); };
    t.draw(0.85, (g, u) => {
      // Dissolving: dark puffs lifting and swelling off the square it left.
      const d = span(u, 0, 0.6);
      if (d < 1) {
        for (let i = 0; i < 5; i++) {
          const ang = seed + i * 1.3;
          g.circle(a.x + Math.cos(ang) * h * 0.4, a.y + Math.sin(ang) * h * 0.3 - h * 0.7 * d, h * 0.28 * (1 + d));
        }
        g.fill({ color: INK, alpha: 0.45 * (1 - d) });
      }
      // Sliding: a low dark smear, fast in the middle of the step.
      const p = slide(u), on = Math.sin(Math.PI * span(u, 0.1, 0.5));
      if (on > 0.01)
        g.ellipse(a.x + (b.x - a.x) * p, a.y + (b.y - a.y) * p + h * 0.3, h * 0.6, h * 0.22)
          .fill({ color: INK, alpha: 0.65 * on });
      // Reforming: the shadow sinking back into the card.
      const s = span(u, 0.4, 0.85);
      if (s > 0 && s < 1) duskBlot(g, b.x, b.y, h * 0.75 * (1 - s), 0.55 * Math.sin(Math.PI * Math.min(1, s * 1.6)), seed);
    }, { dark: true });
    t.draw(0.85, (g, u) => {
      const p = slide(u), on = Math.sin(Math.PI * span(u, 0.1, 0.5));
      if (on > 0.01) {
        const x = a.x + (b.x - a.x) * p, y = a.y + (b.y - a.y) * p + h * 0.3;
        const dx = b.x - a.x, dy = b.y - a.y, dl = Math.hypot(dx, dy) || 1;
        const tail = Math.min(h * 1.6, p * dl);
        duskTaper(g, duskPath(x, y, x - (dx / dl) * tail, y - (dy / dl) * tail, 8, h * 0.12, 2, seed + u * 20),
          2.6, 0.6, LILAC, 0.8 * on);
      }
      const s = span(u, 0.55, 0.85);
      if (s > 0 && s < 1) g.circle(b.x, b.y, h * (1.05 - 0.55 * s)).stroke({ width: 2, color: PALE, alpha: 0.7 * (1 - s) });
    });
    for (let i = 0; i < 16; i++)
      t.spark(a.x + rand(-0.8, 0.8) * h, a.y + rand(-0.8, 0.8) * h, rand(-20, 20), -rand(30, 70), rand(0.45, 0.7), SMOKE);
    t.later(0.3, () => duskDrawIn(t, b, 20, h * 0.6, h * 1.1, [0.25, 0.35], MOTE_IN));
  },

  trapSet(t, r) {
    // A pool of shadow spreads on the square, then SINKS into it — drains
    // away to a point, its rim closing after it — and the square looks as it
    // did. Only the viewer ever sees this.
    const c = centre(r), h = Math.min(r.w, r.h) / 2, seed = rand(0, TAU);
    const size = (u: number) => {
      const sink = span(u, 0.45, 0.9);
      return h * 0.62 * easeOut(span(u, 0, 0.3)) * (1 - sink * sink);
    };
    t.draw(0.95, (g, u) => duskBlot(g, c.x, c.y, size(u), 0.7, seed), { dark: true });
    t.draw(0.95, (g, u) => {
      const rr = size(u);
      if (rr < 1) return;
      g.circle(c.x, c.y, rr).stroke({ width: 2, color: LILAC, alpha: 0.8 });
      const ripple = span(u, 0.2, 0.9);
      if (ripple > 0) g.circle(c.x, c.y, rr * (1 - ripple * 0.8)).stroke({ width: 1.5, color: VIOLET, alpha: 0.6 * (1 - ripple) });
    });
    t.later(0.4, () => duskDrawIn(t, c, 14, h * 0.4, h * 0.7, [0.3, 0.45], MOTE_IN));
  },

  pulse(t, r) {
    // The row's shadows drawn in to its centre line, and the line itself: a
    // dark seam with a writhing violet edge closing from both ends — a row of
    // shadow pulled taut.
    const cy = r.y + r.h / 2, seed = rand(0, TAU);
    for (let i = 0; i < 36; i++) {
      const side = i % 2 ? 1 : -1, d = r.h * rand(0.35, 0.6), v = rand(120, 200);
      t.spark(r.x + rand(0, r.w), cy + side * d, rand(-15, 15), -side * v, d / v, MOTE_IN);
    }
    t.draw(0.9, (g, u) => {
      const close = easeOut(span(u, 0, 0.4)), f = 1 - span(u, 0.5, 1);
      const hh = r.h * 0.3 * (1 - 0.6 * close);
      g.rect(r.x, cy - hh, r.w, hh * 2).fill({ color: INK, alpha: 0.45 * close * f });
    }, { dark: true });
    t.draw(0.9, (g, u) => {
      const grow = easeOut(span(u, 0, 0.35)), f = 1 - span(u, 0.5, 1), half = r.w / 2;
      const glow = 1 + 0.6 * span(u, 0.3, 0.4) * (1 - span(u, 0.4, 0.7));
      duskTaper(g, duskPath(r.x, cy, r.x + half, cy, 12, r.h * 0.08, 3, seed + u * 10, grow), 1, 3, LILAC, 0.8 * f * glow);
      duskTaper(g, duskPath(r.x + r.w, cy, r.x + half, cy, 12, r.h * 0.08, 3, seed + 1 + u * 10, grow), 1, 3, LILAC, 0.8 * f * glow);
    });
  },
};
