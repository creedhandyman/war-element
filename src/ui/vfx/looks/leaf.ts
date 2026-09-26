/** LEAF — growth. Nature CURLS and FLUTTERS: where fire streaks and water
 *  drops, a leaf tumbles, a vine grows along a curve and hooks at its tip,
 *  and a thorn barbs. Every hook here is built from three drawn shapes — a
 *  LEAF (thinning to a sliver as it turns over, which is what reads as
 *  flutter), a VINE (a grown curve with its thorns in the same stroke) and a
 *  tendril's CURL — so a LEAF effect is recognisable in grey, by shape and
 *  motion, not just by being green. Sparks are only ever the pollen and motes
 *  around them, and they curl too. */
import type { Graphics } from "pixi.js";
import { centre, rand } from "./base";
import type { Delivery, ElementLook, FxTools, Pt, SparkStyle, Swing, Throw } from "./types";

type Box = Delivery["rect"];

// Pale green-white -> lime -> leaf -> deep: the same ramp as LEAF's impact
// burst (STYLES), so a look and the hit it lands read as one plant.
const PALE = 0xf4ffe6, LIME = 0xb6f27a, GREEN = 0x4caf6d, DEEP = 0x2c7a45;
const TWO_PI = Math.PI * 2;
const flip = () => (Math.random() < 0.5 ? -1 : 1);

// ── Sparks: pollen and motes, and they CURL ─────────────────────────────────
// `swirl` turns a spark around its own birth point, so a mote let go drifts off
// in a curl instead of a straight line. Half turn each way, or a flurry reads
// as one spinning wheel.
const MOTE: SparkStyle = { palette: [PALE, LIME, GREEN, DEEP], gravity: 25, drag: 0.5, size: [6, 2], streak: false, swirl: 170 };
const MOTE_L: SparkStyle = { ...MOTE, swirl: -170 };
const RISE: SparkStyle = { palette: [PALE, LIME, GREEN], gravity: -70, drag: 0.6, size: [7, 2], streak: false, swirl: 120 };
const RISE_L: SparkStyle = { ...RISE, swirl: -120 };
const POLLEN: SparkStyle = { palette: [PALE, LIME, GREEN], gravity: 0, drag: 0.85, size: [6, 2], streak: false, swirl: 150 };
const POLLEN_L: SparkStyle = { ...POLLEN, swirl: -150 };
// The basic X's few sparks: popped up off the blow, then curling down like
// leaf-bits rather than flying out straight like chips.
const XS: SparkStyle = { palette: [PALE, LIME, GREEN], gravity: 380, drag: 0.3, size: [6, 2], streak: false, swirl: 280 };
const XS_L: SparkStyle = { ...XS, swirl: -280 };

/** `leafAlong`'s out-param, reused: no per-frame allocation. */
const AT = { x: 0, y: 0, a: 0 };

// ── The leaf ────────────────────────────────────────────────────────────────

/** One leaf: a teardrop of two quadratic curves — round at the stem, pointed
 *  at the tip — with a pale midrib. `open` 0..1 is how face-on it is: a
 *  tumbling leaf thins to a sliver and opens again, and that flicker is what
 *  reads as FLUTTER rather than as a spinning dot. */
function leafShape(g: Graphics, x: number, y: number, len: number, ang: number, open: number, color: number, alpha: number) {
  if (alpha <= 0.02 || len < 2) return;
  const c = Math.cos(ang), s = Math.sin(ang);
  const hx = c * len * 0.5, hy = s * len * 0.5;
  const w = len * 0.46 * Math.max(0.12, open);
  // The controls sit back toward the stem, so the widest point is there.
  const mx = x - hx * 0.3, my = y - hy * 0.3;
  g.moveTo(x - hx, y - hy)
    .quadraticCurveTo(mx - s * w, my + c * w, x + hx, y + hy)
    .quadraticCurveTo(mx + s * w, my - c * w, x - hx, y - hy)
    .fill({ color, alpha });
  if (len >= 11 && open > 0.4)
    g.moveTo(x - hx * 1.2, y - hy * 1.2).lineTo(x + hx * 0.8, y + hy * 0.8)
      .stroke({ width: 1, color: PALE, alpha: alpha * 0.6 });
}

/** A leaf let loose: launched, its launch bleeding off, then settling at its
 *  own pace while it rocks side to side and turns over — a falling leaf's
 *  pendulum, not a spark's straight line. All in closed form from its birth,
 *  so a flurry is one Graphics and no per-frame state. */
interface LeafMote {
  x: number; y: number; vx: number; vy: number;
  at: number; life: number; len: number;
  fall: number;   // settle speed, px/s: + drifts down, - rises
  sway: number;   // px either side
  spin: number;   // turn-over rate, rad/s
  ph: number;
  rot: number;
  color: number;
}

function leafMote(x: number, y: number, vx: number, vy: number, at: number, life: number, len: number,
  fall = 30, color = LIME): LeafMote {
  return { x, y, vx, vy, at, life, len, fall, sway: rand(3, 8), spin: rand(6, 12) * flip(),
    ph: rand(0, TWO_PI), rot: rand(0, TWO_PI), color };
}

function leafMoteDraw(g: Graphics, m: LeafMote, a: number, tau: number) {
  if (a < 0 || a >= m.life) return;
  const u = a / m.life;
  const d = tau * (1 - Math.exp(-a / tau));
  const w = a * 7 + m.ph;
  const x = m.x + m.vx * d + m.sway * (Math.sin(w) - Math.sin(m.ph));
  const y = m.y + m.vy * d + m.fall * a;
  const turn = Math.cos(m.spin * a + m.ph);
  leafShape(g, x, y, m.len, m.rot + m.spin * a * 0.3 + 0.5 * Math.cos(w), 0.2 + 0.8 * Math.abs(turn),
    turn > 0 ? m.color : GREEN, Math.min(1, u * 10) * (1 - u * u) * 0.95);
}

/** A set of leaves, one Graphics. `tau` is how long a launch takes to bleed
 *  off: short for leaves torn loose by a blow, long for leaves on a breeze. */
function leafFlurry(t: FxTools, ms: LeafMote[], delay = 0, tau = 0.2) {
  let end = 0;
  for (const m of ms) end = Math.max(end, m.at + m.life);
  if (end <= 0) return;
  t.draw(end, (g, k) => {
    const now = k * end;
    for (const m of ms) leafMoteDraw(g, m, now - m.at, tau);
  }, { delay });
}

/** Leaves whirling in on a point: the element drawn in around a card, where
 *  fire would glow and water pool. They ride the orbit nose-first. */
function leafSpiralIn(t: FxTools, at: Pt, n: number, r0: number, len: number, seconds: number) {
  const a0 = rand(0, TWO_PI), dir = flip();
  t.draw(seconds, (g, k) => {
    const r = r0 * (1 - 0.8 * k * k);
    const alpha = Math.min(1, k * 5) * (k > 0.8 ? (1 - k) / 0.2 : 1) * 0.9;
    for (let i = 0; i < n; i++) {
      const a = a0 + (i / n) * TWO_PI + dir * k * 2.6;
      const turn = Math.cos(k * 14 + i * 1.7);
      leafShape(g, at.x + Math.cos(a) * r, at.y + Math.sin(a) * r, len, a + dir * Math.PI / 2 + 0.4 * turn,
        0.3 + 0.7 * Math.abs(turn), turn > 0 ? LIME : GREEN, alpha);
    }
  });
}

// ── The vine ────────────────────────────────────────────────────────────────

/** A cubic bezier sampled once into a flat point list, so a vine growing
 *  along it each frame costs a walk, not a re-solve. */
function leafCurve(a: Pt, c1: Pt, c2: Pt, b: Pt, n: number): number[] {
  const out: number[] = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n, v = 1 - u;
    const A = v * v * v, B = 3 * v * v * u, C = 3 * v * u * u, D = u * u * u;
    out.push(A * a.x + B * c1.x + C * c2.x + D * b.x, A * a.y + B * c1.y + C * c2.y + D * b.y);
  }
  return out;
}

/** The point `f` (0..1) of the way along a sampled curve, and its heading. */
function leafAlong(pts: number[], f: number, out: { x: number; y: number; a: number }) {
  const n = pts.length / 2 - 1;
  const i = Math.max(0, Math.min(n - 1e-6, f * n));
  const j = Math.floor(i), r = i - j;
  const x0 = pts[2 * j], y0 = pts[2 * j + 1], x1 = pts[2 * j + 2], y1 = pts[2 * j + 3];
  out.x = x0 + (x1 - x0) * r;
  out.y = y0 + (y1 - y0) * r;
  out.a = Math.atan2(y1 - y0, x1 - x0);
  return out;
}

/** The part of a sampled curve from `f0` to `f1` as one path, ready to
 *  stroke. With `thorn` > 0 every other sample throws a barb, swept back the
 *  way a rose's are, out to alternate sides — thorns in the SAME path, so a
 *  thorny vine is still one stroke. */
function leafVine(g: Graphics, pts: number[], f0: number, f1: number, thorn: number): boolean {
  const n = pts.length / 2 - 1;
  const i0 = Math.max(0, f0) * n, i1 = Math.min(1, f1) * n;
  if (i1 - i0 < 0.05) return false;
  leafAlong(pts, f0, AT);
  g.moveTo(AT.x, AT.y);
  for (let j = Math.floor(i0) + 1; j < i1; j++) {
    const x = pts[2 * j], y = pts[2 * j + 1];
    g.lineTo(x, y);
    if (thorn > 0 && j % 2 === 0) {
      let tx = pts[2 * j + 2] - pts[2 * j - 2], ty = pts[2 * j + 3] - pts[2 * j - 1];
      const l = Math.hypot(tx, ty) || 1;
      tx /= l; ty /= l;
      const side = j % 4 === 0 ? 1 : -1;
      g.lineTo(x - ty * side * thorn - tx * thorn * 0.55, y + tx * side * thorn - ty * thorn * 0.55);
      g.lineTo(x + tx * 2, y + ty * 2);
    }
  }
  leafAlong(pts, f1, AT);
  g.lineTo(AT.x, AT.y);
  return true;
}

/** A tendril's hook: from (x, y) heading `a`, winding tighter through about a
 *  turn, `grown` 0..1 of it. Continues the current path. */
function leafCurl(g: Graphics, x: number, y: number, a: number, r: number, side: number, grown: number) {
  const steps = 8, total = TWO_PI * 0.95;
  const m = Math.round(steps * Math.max(0, Math.min(1, grown)));
  for (let i = 1; i <= m; i++) {
    const s = i / steps;
    const d = (total / steps) * (0.6 + 0.8 * s);
    a += side * d;
    const step = r * d * (1.15 - 0.75 * s);
    x += Math.cos(a) * step;
    y += Math.sin(a) * step;
    g.lineTo(x, y);
  }
}

/** A stem, root or tendril that GROWS: a sampled curve from its base, with a
 *  hooked tip and leaves that open once the growing point has passed them. */
interface Stem {
  pts: number[];
  at: number;         // starts growing, s
  grow: number;       // s to full length
  curl: number;       // tip hook radius, px (0 = none)
  side: number;       // which way the hook winds; leaves alternate from it
  leaves: number[];   // fractions along it that bear a leaf
  len: number;        // leaf length, px
  thorn: number;      // barb length, px (0 = smooth)
}

function leafStem(base: Pt, tip: Pt, bow: number, at: number, grow: number,
  o: { curl?: number; side?: number; leaves?: number[]; len?: number; thorn?: number; n?: number } = {}): Stem {
  const dx = tip.x - base.x, dy = tip.y - base.y, d = Math.hypot(dx, dy) || 1;
  const nx = -dy / d, ny = dx / d;
  const pts = leafCurve(base,
    { x: base.x + dx * 0.33 + nx * bow, y: base.y + dy * 0.33 + ny * bow },
    { x: base.x + dx * 0.7 + nx * bow * 0.3, y: base.y + dy * 0.7 + ny * bow * 0.3 }, tip, o.n ?? 14);
  // By default the hook keeps turning the way the stem already bends.
  return { pts, at, grow, curl: o.curl ?? 0, side: o.side ?? (bow >= 0 ? -1 : 1), leaves: o.leaves ?? [],
    len: o.len ?? 12, thorn: o.thorn ?? 0 };
}

/** Stems growing (fast, then slowing — growth, not a throw), standing, then
 *  withering from `fadeFrom`. `retract` draws them in toward their tips as
 *  they go, the way a root pulls down into the ground. */
function leafStems(t: FxTools, stems: Stem[], seconds: number, fadeFrom: number,
  o: { width: number; core?: number; halo?: number; retract?: boolean; delay?: number }) {
  const core = o.core ?? LIME, halo = o.halo ?? GREEN;
  t.draw(seconds, (g, k) => {
    const now = k * seconds;
    const out = now < fadeFrom ? 0 : (now - fadeFrom) / (seconds - fadeFrom);
    const alpha = o.retract ? 1 - out * out : 1 - out;
    const f0 = o.retract ? out : 0;
    for (const s of stems) {
      const u = (now - s.at) / s.grow;
      if (u <= 0) continue;
      const f = u >= 1 ? 1 : 1 - (1 - u) * (1 - u);
      if (halo >= 0 && leafVine(g, s.pts, f0, f, 0))
        g.stroke({ width: o.width * 2.8, color: halo, alpha: 0.28 * alpha });
      if (leafVine(g, s.pts, f0, f, s.thorn)) {
        if (s.curl > 0) {
          leafAlong(s.pts, f, AT);
          leafCurl(g, AT.x, AT.y, AT.a, s.curl, s.side, u * 1.4);
        }
        g.stroke({ width: o.width, color: core, alpha: 0.95 * alpha, join: "bevel" });
      }
      for (let i = 0; i < s.leaves.length; i++) {
        const lf = s.leaves[i];
        if (f < lf + 0.03 || lf < f0) continue;
        const L = s.len * Math.min(1, (f - lf) * 4);
        leafAlong(s.pts, lf, AT);
        const la = AT.a + (i % 2 ? 1 : -1) * s.side * 0.95;
        leafShape(g, AT.x + Math.cos(la) * L * 0.5, AT.y + Math.sin(la) * L * 0.5, L, la, 0.85, LIME, 0.9 * alpha);
      }
    }
  }, { delay: o.delay });
}

/** Twinkles: a four-point glint that pops and shrinks — the sparkle in a
 *  heal, which a soft dot cannot draw. */
function leafGlints(t: FxTools, r: Box, n: number, seconds: number) {
  const gs: number[] = [];
  for (let i = 0; i < n; i++) gs.push(r.x + rand(0.15, 0.85) * r.w, r.y + rand(0.1, 0.75) * r.h, rand(0.05, seconds - 0.3));
  t.draw(seconds, (g, k) => {
    const now = k * seconds;
    for (let i = 0; i < n; i++) {
      const a = (now - gs[3 * i + 2]) / 0.28;
      if (a <= 0 || a >= 1) continue;
      const L = 7 * Math.sin(Math.PI * a), x = gs[3 * i], y = gs[3 * i + 1];
      g.moveTo(x - L, y).lineTo(x + L, y).moveTo(x, y - L).lineTo(x, y + L)
        .stroke({ width: 1.5, color: 0xffffff, alpha: 0.9 });
    }
  });
}

// ── Attacks ─────────────────────────────────────────────────────────────────

/** A basic shot: one leaf, spinning end over end and fluttering, on a gentle
 *  bow with a flutter in it — shedding a few small leaves as it goes. Ends
 *  exactly on `to` at delay + seconds. */
function leafThrow(t: FxTools, s: Throw) {
  const { from, to } = s;
  const dx = to.x - from.x, dy = to.y - from.y, dist = Math.hypot(dx, dy) || 1;
  const nx = -dy / dist, ny = dx / dist, bow = dist * 0.13 * flip();
  const len = s.size * 0.28;
  const p = { x: 0, y: 0 };
  const path = (u: number) => {
    const e = u * (0.75 + 0.25 * u);
    const b = bow * Math.sin(Math.PI * u) + dist * 0.03 * Math.sin(3 * Math.PI * u);
    p.x = from.x + dx * e + nx * b;
    p.y = from.y + dy * e + ny * b;
    return p;
  };
  const shed: LeafMote[] = [];
  for (const u of [0.3, 0.6, 0.85]) {
    path(u);
    shed.push(leafMote(p.x, p.y, rand(-40, 40), rand(-40, 40), u * s.seconds, rand(0.4, 0.55), len * 0.5, 30));
  }
  const total = s.seconds + 0.55;
  let acc = 0, n = 0;
  t.draw(total, (g, k, dt) => {
    const age = k * total;
    for (const m of shed) leafMoteDraw(g, m, age - m.at, 0.2);
    if (age >= s.seconds) return;
    const u = age / s.seconds, fin = Math.min(1, u * 6);
    path(u);
    // A faint halo, so one small leaf still reads at a glance across the board.
    g.circle(p.x, p.y, len * 0.62).fill({ color: GREEN, alpha: 0.28 * fin });
    const turn = Math.cos(age * 26);
    leafShape(g, p.x, p.y, len, age * 19 + 1, 0.3 + 0.7 * Math.abs(turn), turn > 0 ? LIME : PALE, fin);
    acc += 50 * dt;
    while (acc >= 1) {
      acc -= 1;
      t.spark(p.x, p.y, rand(-30, 30), rand(-30, 30), rand(0.3, 0.5), n++ % 2 ? MOTE : MOTE_L);
    }
  }, { delay: s.delay });
}

/** A Special shot: a thorned vine GROWS to the target along an S-curve, a
 *  seed pod spinning in a pinwheel of leaves at its tip, leaves budding off
 *  it as it passes. It trails behind the pod rather than spanning the board,
 *  and once the pod lands the vine draws itself in after it. */
function leafLash(t: FxTools, s: Throw) {
  const { from, to } = s;
  const dx = to.x - from.x, dy = to.y - from.y, dist = Math.hypot(dx, dy) || 1;
  const nx = -dy / dist, ny = dx / dist;
  // Bow toward the side the target is on, so two lashes fan apart.
  const side = dx > 8 ? 1 : -1;
  const pts = leafCurve(from,
    { x: from.x + dx * 0.3 + nx * dist * 0.3 * side, y: from.y + dy * 0.3 + ny * dist * 0.3 * side },
    { x: from.x + dx * 0.68 - nx * dist * 0.14 * side, y: from.y + dy * 0.68 - ny * dist * 0.14 * side }, to, 26);
  const buds = [0.2, 0.38, 0.56, 0.74];
  const len = s.size * 0.16;
  const land = s.seconds, total = land + 0.28;
  let acc = 0, n = 0;
  t.draw(total, (g, k, dt) => {
    const age = k * total;
    const u = Math.min(1, age / land);
    const head = u * (0.45 + 0.55 * u);
    const after = age > land ? (age - land) / (total - land) : 0;
    const tail = Math.max(0, head - 0.7) + 0.7 * after;
    const alpha = 1 - after * after;
    if (leafVine(g, pts, tail, head, 0)) g.stroke({ width: 7, color: GREEN, alpha: 0.3 * alpha });
    if (leafVine(g, pts, tail, head, 4)) g.stroke({ width: 2.4, color: LIME, alpha: 0.95 * alpha, join: "bevel" });
    for (let b = 0; b < buds.length; b++) {
      const f = buds[b];
      if (head < f + 0.03 || f < tail) continue;
      const L = len * 0.85 * Math.min(1, (head - f) * 5);
      leafAlong(pts, f, AT);
      const la = AT.a + (b % 2 ? 1 : -1) * 0.95;
      leafShape(g, AT.x + Math.cos(la) * L * 0.5, AT.y + Math.sin(la) * L * 0.5, L, la, 0.85, LIME, 0.9 * alpha);
    }
    if (age >= land) return;
    // The seed pod: a bright bud in a pinwheel of three leaves.
    leafAlong(pts, head, AT);
    const fin = Math.min(1, u * 5);
    const px = AT.x, py = AT.y;
    g.circle(px, py, len * 0.95).fill({ color: GREEN, alpha: 0.3 * fin });
    for (let j = 0; j < 3; j++) {
      const a = age * 15 + (j * TWO_PI) / 3;
      leafShape(g, px + Math.cos(a) * len * 0.5, py + Math.sin(a) * len * 0.5, len, a, 0.9, LIME, fin);
    }
    g.circle(px, py, len * 0.28).fill({ color: PALE, alpha: fin });
    acc += 70 * dt;
    while (acc >= 1) {
      acc -= 1;
      t.spark(px, py, rand(-35, 35), rand(-35, 35), rand(0.3, 0.55), n++ % 2 ? MOTE : MOTE_L);
    }
  }, { delay: s.delay });
}

/** A Special melee swing: a thorny vine WHIP lashing out along the lunge,
 *  accelerating to a crack, its tip hooked; it snaps back as the mark lands. */
function leafWhip(t: FxTools, s: Swing) {
  const { from, to } = s;
  const dx = to.x - from.x, dy = to.y - from.y, dist = Math.hypot(dx, dy) || 1;
  const nx = -dy / dist, ny = dx / dist, side = flip();
  const pts = leafCurve(from,
    { x: from.x + dx * 0.2 + nx * dist * 0.5 * side, y: from.y + dy * 0.2 + ny * dist * 0.5 * side },
    { x: from.x + dx * 0.7 - nx * dist * 0.3 * side, y: from.y + dy * 0.7 - ny * dist * 0.3 * side }, to, 18);
  const land = s.seconds, total = land + 0.12;
  const thorn = Math.min(5, 2.5 + dist * 0.012), hook = Math.min(9, 4 + dist * 0.02);
  let acc = 0, n = 0;
  t.draw(total, (g, k, dt) => {
    const age = k * total;
    const u = Math.min(1, age / land);
    const head = u * u;
    const tail = age > land ? (age - land) / (total - land) : Math.max(0, head - 0.85);
    const alpha = Math.min(1, u * 4);
    if (leafVine(g, pts, tail, head, 0)) g.stroke({ width: 7, color: GREEN, alpha: 0.28 * alpha });
    if (leafVine(g, pts, tail, head, thorn)) {
      leafAlong(pts, head, AT);
      leafCurl(g, AT.x, AT.y, AT.a, hook, side, 1);
      g.stroke({ width: 2.4, color: LIME, alpha: 0.95 * alpha, join: "bevel" });
    }
    if (age >= land) return;
    acc += 45 * dt;
    while (acc >= 1) {
      acc -= 1;
      leafAlong(pts, head, AT);
      t.spark(AT.x, AT.y, rand(-30, 30), rand(-30, 30), rand(0.25, 0.4), n++ % 2 ? MOTE : MOTE_L);
    }
  }, { delay: s.delay });
  const shed: LeafMote[] = [];
  for (const f of [0.45, 0.8]) {
    leafAlong(pts, f, AT);
    shed.push(leafMote(AT.x, AT.y, rand(-60, 60), rand(-40, 20), Math.sqrt(f) * land, rand(0.45, 0.55), s.size * 0.15, 35));
  }
  leafFlurry(t, shed, s.delay);
}

// ── The look ────────────────────────────────────────────────────────────────

export const LEAF: ElementLook = {
  markColor: 0x9fe874,

  windUp(t, d) {
    // Leaves whirl in around the card as it gathers itself — two for a basic
    // swing (the lunge is the wind-up), a full whirl and pollen for a Special.
    const dur = d.wind + (d.T - d.wind) * 0.3;
    const basicMelee = d.melee && !d.special;
    t.charge(d.at, d.size * (d.special ? 1.5 : basicMelee ? 0.7 : 1.0), LIME, d.special ? 0.7 : basicMelee ? 0.18 : 0.34, dur);
    leafSpiralIn(t, d.at, d.special ? 6 : basicMelee ? 2 : 3, d.size * (d.special ? 0.85 : 0.6),
      d.size * (d.special ? 0.2 : 0.15), dur);
    if (d.special)
      t.emit({ count: 16, palette: [PALE, LIME, GREEN], from: d.rect, at: "ring", speed: [90, 150], gravity: 0,
        drag: 1, life: [0.2, d.wind], size: [7, 2], swirl: 120 });
  },

  gather(t, d) {
    // The empty square it lands on SPROUTS: shoots push up out of the ground
    // and hook over while leaves whirl in, building to the strike.
    const r = d.rect, s = d.size;
    const ground = r.y + r.h * 0.84;
    t.charge({ x: d.at.x, y: d.at.y + s * 0.1 }, s * (d.special ? 1.7 : 1.3), LIME, d.special ? 0.8 : 0.55, d.T);
    const stems: Stem[] = [];
    for (let i = -1; i <= 1; i++)
      stems.push(leafStem({ x: d.at.x + i * s * 0.16, y: ground }, { x: d.at.x + i * s * 0.26, y: ground - s * (i ? 0.38 : 0.52) },
        (i || flip()) * s * 0.08, 0.05 + Math.abs(i) * 0.06, d.T * 0.7, { curl: s * 0.05, leaves: [0.5, 0.75], len: s * 0.12 }));
    leafStems(t, stems, d.T + 0.08, d.T, { width: 2 });
    leafSpiralIn(t, d.at, d.special ? 5 : 3, s * 0.8, s * 0.17, d.T);
    t.emit({ count: d.special ? 22 : 12, palette: [PALE, LIME, GREEN], from: r, at: "ring", speed: [80, 150], gravity: 0,
      drag: 1, life: [0.2, d.wind], size: [8, 2], swirl: 120 });
  },

  projectile(t, s) {
    if (s.special) leafLash(t, s);
    else leafThrow(t, s);
  },

  swing(t, s) {
    if (s.special) {
      leafWhip(t, s);
      return;
    }
    // A basic swing's trail is a whisper: two leaves peeling off the lunge.
    const shed: LeafMote[] = [];
    for (const u of [0.35, 0.7]) {
      const x = s.from.x + (s.to.x - s.from.x) * u, y = s.from.y + (s.to.y - s.from.y) * u;
      shed.push(leafMote(x, y, rand(-50, 50), rand(-30, 10), u * s.seconds, 0.45, s.size * 0.13, 35));
    }
    leafFlurry(t, shed, s.delay);
  },

  mark(t, m) {
    // A thorny vine WHIP cracked across the card: an S of vine with barbs
    // along it, its tip hooking into a curl, and leaves torn off the lash
    // tumbling away. Sized to the square, gone inside half a second.
    const k = Math.max(0.6, Math.min(2.2, m.k));
    const ux = Math.cos(m.across), uy = Math.sin(m.across), nx = -uy, ny = ux;
    const R = m.reach * 0.85, c = m.c;
    const pts = leafCurve({ x: c.x - ux * R, y: c.y - uy * R },
      { x: c.x - ux * R * 0.3 + nx * R * 0.75, y: c.y - uy * R * 0.3 + ny * R * 0.75 },
      { x: c.x + ux * R * 0.3 - nx * R * 0.75, y: c.y + uy * R * 0.3 - ny * R * 0.75 },
      { x: c.x + ux * R, y: c.y + uy * R }, 20);
    const lash = 0.09, hold = 0.14, fade = 0.24, total = lash + hold + fade;
    const thorn = 4 + k * 1.5, hook = R * 0.16;
    t.draw(total, (g, kk) => {
      const age = kk * total;
      const f = Math.min(1, age / lash);
      const alpha = age < lash + hold ? 1 : 1 - (age - lash - hold) / fade;
      if (leafVine(g, pts, 0, f, 0)) g.stroke({ width: 11, color: GREEN, alpha: 0.28 * alpha });
      if (leafVine(g, pts, 0, f, thorn)) {
        leafAlong(pts, f, AT);
        leafCurl(g, AT.x, AT.y, AT.a, hook, 1, (age - lash * 0.6) / 0.08);
        g.stroke({ width: 3.5, color: LIME, alpha, join: "bevel" });
      }
      if (leafVine(g, pts, 0, f, 0)) g.stroke({ width: 1.2, color: PALE, alpha: 0.85 * alpha });
    });
    const n = Math.min(8, 4 + Math.round(k * 2));
    const ms: LeafMote[] = [];
    for (let i = 0; i < n; i++) {
      const f = (i + 0.5) / n, sd = i % 2 ? 1 : -1, v = rand(80, 150);
      leafAlong(pts, f, AT);
      ms.push(leafMote(AT.x, AT.y, (nx * sd + ux * rand(-0.4, 0.4)) * v, (ny * sd + uy * rand(-0.4, 0.4)) * v - 30,
        f * lash, rand(0.42, 0.55), rand(10, 14), 45));
    }
    leafFlurry(t, ms);
    t.glow(m.rect, GREEN, 0.4, 0.35, 1.05);
    t.emit({ count: Math.round(14 * k), palette: [PALE, LIME, GREEN], from: { x: c.x - 6, y: c.y - 6, w: 12, h: 12 },
      speed: [60, 180], gravity: 120, drag: 0.4, life: [0.25, 0.45], size: [7, 2], swirl: 200 });
  },

  xSparks(t, c, count) {
    for (let i = 0; i < count; i++) {
      const a = (rand(-160, -20) * Math.PI) / 180, v = rand(70, 150);
      t.spark(c.x + rand(-3, 3), c.y + rand(-3, 3), Math.cos(a) * v, Math.sin(a) * v, rand(0.22, 0.33), i % 2 ? XS : XS_L, c);
    }
  },

  arrive(t, r) {
    // SPROUTING: shoots burst up out of the ground and hook over, and a
    // flurry of leaves is thrown up that then flutters back down.
    const c = centre(r), s = Math.min(r.w, r.h), ground = r.y + r.h * 0.86;
    t.glow(r, LIME, 0.5, 0.45, 1.1);
    const stems: Stem[] = [];
    for (let i = 0; i < 5; i++) {
      const x = c.x + (i - 2) * s * 0.17 + rand(-3, 3), lean = (i - 2) * s * 0.12;
      stems.push(leafStem({ x, y: ground }, { x: x + lean, y: ground - s * rand(0.5, 0.78) },
        (i === 2 ? flip() : Math.sign(lean)) * s * 0.07, rand(0, 0.04), 0.16, { curl: s * 0.05, leaves: [0.45, 0.72], len: s * 0.14 }));
    }
    leafStems(t, stems, 0.62, 0.3, { width: 2 });
    const ms: LeafMote[] = [];
    for (let i = 0; i < 8; i++) {
      const a = (rand(-150, -30) * Math.PI) / 180, v = rand(220, 340);
      ms.push(leafMote(c.x + rand(-10, 10), ground - 6, Math.cos(a) * v, Math.sin(a) * v, rand(0, 0.06), rand(0.65, 0.85),
        s * rand(0.13, 0.17), 45));
    }
    leafFlurry(t, ms);
    t.emit({ count: 26, palette: [PALE, LIME, GREEN], from: { x: r.x + r.w * 0.15, y: ground - 8, w: r.w * 0.7, h: 10 },
      dir: [-120, -60], speed: [90, 220], gravity: 90, drag: 0.4, life: [0.4, 0.7], size: [7, 2], swirl: 150 });
  },

  impactAccent(t, at, k) {
    // Leaves blown out of the hit, then fluttering — the one thing the
    // standard burst cannot draw. One Graphics, no sparks: it fires on every
    // spell hit.
    const n = Math.min(8, Math.round(3 + 2.5 * k));
    const ms: LeafMote[] = [];
    for (let i = 0; i < n; i++) {
      const a = rand(0, TWO_PI), v = rand(120, 240) * (0.7 + 0.3 * k);
      ms.push(leafMote(at.x, at.y, Math.cos(a) * v, Math.sin(a) * v - 40, 0, rand(0.55, 0.8), rand(11, 15) * (0.8 + 0.2 * k), 40,
        i % 3 ? LIME : PALE));
    }
    leafFlurry(t, ms);
  },

  shield(t, r) {
    // A WREATH: leaves flutter in from outside and lock, overlapping like
    // scales, into a ring round the card as a vine draws round to bind them.
    // Fluttering in, flat and still once home — that change is the "closing".
    const c = centre(r), s = Math.min(r.w, r.h);
    const n = 10, R = s * 0.56, len = s * 0.36;
    const a0 = rand(0, TWO_PI), dir = flip();
    const fly = 0.28, hold = 0.32, fade = 0.3, total = fly + hold + fade;
    t.draw(total, (g, k) => {
      const now = k * total;
      const u = Math.min(1, now / fly), e = 1 - (1 - u) * (1 - u) * (1 - u);
      const alpha = now < fly + hold ? Math.min(1, u * 4) : 1 - (now - fly - hold) / fade;
      const sweep = Math.min(1, Math.max(0, (now - fly * 0.6) / (fly * 0.9)));
      if (sweep > 0) {
        const b = a0 + dir * sweep * TWO_PI;
        g.moveTo(c.x + Math.cos(a0) * R, c.y + Math.sin(a0) * R)
          .arc(c.x, c.y, R, a0, b, dir < 0)
          .stroke({ width: 2, color: LIME, alpha: 0.85 * alpha });
      }
      for (let i = 0; i < n; i++) {
        const ta = a0 + (i / n) * TWO_PI;
        const a = ta - dir * (1 - e) * 1.2;
        const rr = R + (1 - e) * s * 0.55;
        const turn = Math.cos(now * 18 + i * 1.3);
        const open = 1 - (1 - e) * (1 - Math.abs(turn)) * 0.8;
        leafShape(g, c.x + Math.cos(a) * rr, c.y + Math.sin(a) * rr, len, a + dir * Math.PI / 2 + (1 - e) * turn * 0.6,
          open, i % 2 ? LIME : GREEN, 0.8 * alpha);
      }
    });
    t.later(fly, () => {
      t.glow(r, GREEN, 0.3, 0.5, 1.25);
      for (let i = 0; i < 12; i++) {
        const a = rand(0, TWO_PI), v = rand(20, 50);
        t.spark(c.x + Math.cos(a) * R, c.y + Math.sin(a) * R, Math.cos(a) * v, Math.sin(a) * v, rand(0.4, 0.6), i % 2 ? MOTE : MOTE_L);
      }
    });
  },

  heal(t, r, k) {
    // Growth rising off the card: leaves lifting and rocking, green motes
    // curling up, and glints twinkling — gentle, and green whatever cast it.
    const kk = Math.max(0.7, Math.min(2.2, k));
    const s = Math.min(r.w, r.h);
    t.glow(r, 0xc8ffb0, 0.35, 0.8);
    const n = Math.round(22 * kk);
    for (let i = 0; i < n; i++)
      t.spark(r.x + rand(0.1, 0.9) * r.w, r.y + r.h * rand(0.7, 1), rand(-20, 20), rand(-90, -40), rand(0.7, 1.1), i % 2 ? RISE : RISE_L);
    const ms: LeafMote[] = [];
    const nl = 3 + Math.round(kk * 1.5);
    for (let i = 0; i < nl; i++)
      ms.push(leafMote(r.x + ((i + 0.5) / nl) * r.w, r.y + r.h * 0.85, rand(-15, 15), rand(-50, -25), i * 0.07, rand(0.8, 1.0),
        s * rand(0.15, 0.19), -45, i % 2 ? LIME : PALE));
    leafFlurry(t, ms);
    leafGlints(t, r, 5, 1.0);
  },

  wall(t, r) {
    // A THORN HEDGE growing up out of the row: thorned stems leaning
    // alternately so they cross into a lattice, hooked at the top, leafing
    // as they climb.
    const n = Math.max(4, Math.round(r.w / 34));
    const stems: Stem[] = [];
    for (let i = 0; i < n; i++) {
      const x = r.x + ((i + 0.5) / n) * r.w + rand(-6, 6);
      const lean = (i % 2 ? 1 : -1) * (r.w / n) * rand(0.8, 1.3);
      const h = r.h * rand(0.72, 0.95);
      stems.push(leafStem({ x, y: r.y + r.h }, { x: x + lean, y: r.y + r.h - h }, lean * 0.5, i * 0.025 + rand(0, 0.05), 0.3,
        { curl: 6, leaves: [0.35, 0.6, 0.85], len: 13, thorn: 4 }));
    }
    leafStems(t, stems, 1.15, 0.7, { width: 2.2 });
    t.band({ x: r.x, y: r.y + r.h * 0.8, w: r.w, h: r.h * 0.2 }, GREEN, 0.9);
    t.emit({ count: 40, palette: [PALE, LIME, GREEN], from: r, at: "bottom", dir: [-110, -70], speed: [60, 160], gravity: 30,
      drag: 0.5, life: [0.5, 0.9], size: [7, 2], swirl: 90 });
  },

  field(t, r) {
    // The weather turns to spring: pollen and petals carried across the
    // board on a breeze, each mote curling as it drifts.
    t.band(r, DEEP, 1.2);
    for (let w = 0; w < 3; w++)
      t.later(w * 0.22, () => {
        for (let i = 0; i < 60; i++)
          t.spark(r.x + rand(-0.1, 0.9) * r.w, r.y + rand(0, 1) * r.h, rand(50, 120), rand(-20, 20), rand(0.6, 0.9), i % 2 ? POLLEN : POLLEN_L);
      });
    const ms: LeafMote[] = [];
    for (let i = 0; i < 14; i++)
      ms.push(leafMote(r.x + rand(-0.05, 0.5) * r.w, r.y + rand(0.05, 0.95) * r.h, rand(150, 220), rand(-15, 20), rand(0, 0.35),
        rand(0.8, 1.0), rand(11, 16), 12, i % 3 ? LIME : PALE));
    leafFlurry(t, ms, 0, 2);
  },

  move(t, from, to) {
    // A trail of leaves: they peel off where it stood, stream along a curve
    // to where it lands, and settle there.
    const a = centre(from), b = centre(to);
    const dx = b.x - a.x, dy = b.y - a.y, dist = Math.hypot(dx, dy) || 1;
    const nx = -dy / dist, ny = dx / dist, side = flip();
    const n = 7, dur = 0.36, settle = 0.2;
    const lv: number[] = []; // per leaf: start x, y, bow, born, landing jitter x, y
    for (let i = 0; i < n; i++)
      lv.push(a.x + rand(-0.3, 0.3) * from.w, a.y + rand(-0.3, 0.3) * from.h, dist * rand(0.18, 0.34) * side, i * 0.035,
        rand(-12, 12), rand(-12, 12));
    const total = (n - 1) * 0.035 + dur + settle;
    t.draw(total, (g, k) => {
      const now = k * total;
      for (let i = 0; i < n; i++) {
        const o = i * 6, age = now - lv[o + 3];
        if (age < 0 || age > dur + settle) continue;
        const u = Math.min(1, age / dur), e = u * u * (3 - 2 * u), v = 1 - e;
        const mx = (lv[o] + b.x) / 2 + nx * lv[o + 2], my = (lv[o + 1] + b.y) / 2 + ny * lv[o + 2];
        const ex = b.x + lv[o + 4], ey = b.y + lv[o + 5];
        let x = v * v * lv[o] + 2 * v * e * mx + e * e * ex, y = v * v * lv[o + 1] + 2 * v * e * my + e * e * ey;
        const late = Math.max(0, age - dur) / settle;
        x += Math.sin(age * 9 + i) * 4 * late;
        y += late * 6;
        const turn = Math.cos(age * 16 + i * 1.9);
        const alpha = Math.min(1, age * 12) * (1 - late) * 0.9;
        leafShape(g, x, y, 13, age * 8 * side + i, 0.25 + 0.75 * Math.abs(turn), turn > 0 ? LIME : GREEN, alpha);
      }
    });
    t.emit({ count: 16, palette: [PALE, LIME, GREEN], from, speed: [30, 90], gravity: 20, drag: 0.4, life: [0.3, 0.5],
      size: [7, 2], swirl: 150 });
    t.later(dur, () => t.emit({ count: 18, palette: [PALE, LIME, GREEN], from: to, at: "ring", speed: [90, 150], gravity: 0,
      drag: 0.9, life: [0.3, 0.5], size: [7, 2], swirl: 150 }));
  },

  trapSet(t, r) {
    // Roots curl in from the square's edges, knot at its heart, and then
    // pull down into the ground — the square darkening where they went.
    const c = centre(r), s = Math.min(r.w, r.h);
    const a0 = rand(0, TWO_PI), dir = flip();
    const stems: Stem[] = [];
    for (let i = 0; i < 5; i++) {
      const a = a0 + (i / 5) * TWO_PI;
      stems.push(leafStem({ x: c.x + Math.cos(a) * s * 0.52, y: c.y + Math.sin(a) * s * 0.52 },
        { x: c.x + Math.cos(a + dir * 1.3) * s * 0.07, y: c.y + Math.sin(a + dir * 1.3) * s * 0.07 },
        dir * s * 0.22, i * 0.04, 0.3, { curl: 4, side: dir, n: 12 }));
    }
    leafStems(t, stems, 0.85, 0.42, { width: 2, core: GREEN, halo: DEEP, retract: true });
    t.draw(0.85, (g, k) => {
      const a = k < 0.45 ? k / 0.45 : 1 - (k - 0.45) / 0.55;
      g.ellipse(c.x, c.y, s * 0.26, s * 0.2).fill({ color: 0x020503, alpha: 0.5 * a });
    }, { dark: true });
    t.emit({ count: 14, palette: [PALE, LIME, GREEN], from: r, at: "edge", speed: [60, 110], gravity: 0, drag: 0.9,
      life: [0.3, 0.5], size: [6, 2] });
  },

  pulse(t, r) {
    // A vine runs the length of the row, weaving through its middle, leafing
    // at every turn.
    const n = 28, waves = 2.5, amp = r.h * 0.2, y = r.y + r.h / 2, ph = rand(0, TWO_PI);
    const pts: number[] = [];
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      pts.push(r.x + u * r.w, y + Math.sin(u * waves * TWO_PI + ph) * amp);
    }
    const leaves: number[] = [];
    for (let i = 0; i < waves * 2; i++) leaves.push((i + 0.5) / (waves * 2) - 0.02);
    leafStems(t, [{ pts, at: 0, grow: 0.4, curl: 7, side: 1, leaves, len: 15, thorn: 4 }], 1.0, 0.55, { width: 2.4 });
    t.band(r, DEEP, 0.8);
    t.emit({ count: 36, palette: [PALE, LIME, GREEN], from: { x: r.x, y: y - amp, w: r.w, h: amp * 2 }, speed: [20, 70],
      gravity: -20, drag: 0.5, life: [0.5, 0.9], size: [7, 2] });
  },
};
