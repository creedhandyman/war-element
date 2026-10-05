/** THORN — Blood on the Petals. "Sweep up to 2 opponents in range for 7 DMG
 *  (PEN) each and stack BLEED 3 (basics keep deepening it)." Every thorn she
 *  lands deepens the bleed, and every drop her enemies lose heals her.
 *
 *  Her art is a hooded assassin in black thorn-plate with a long curved blade
 *  of thorn, crimson roses all round her and their petals falling through a
 *  blood-dark light. The DELIVERY is the blade drawn back: rose petals whirl
 *  up round her, faster as she winds, while the thorn blade — a black crescent
 *  rimmed in crimson, barbed along its back — swings round behind her, and a
 *  glint runs down its edge as it tops out. It goes with her token as she
 *  lunges, because she is holding it.
 *
 *  The LANDING is the sweep: ONE crescent cut swung round her through every
 *  card it takes, in turn — a black blade-arc edged in crimson, thorns barbed
 *  along its back. Where it passes through a card the card bleeds: blood flung
 *  off along the cut, a burst of rose petals that drift and fall, a thorny
 *  tendril whipping across its face, and drops still running off it after
 *  (the BLEED). Then the cut itself comes apart into petals. A card that dies
 *  under it has a rose open on it, which scatters.
 *
 *  The blade and the stems are dark for real (`dark: true`), each rimmed in
 *  crimson light so it reads over an empty square; the petals are their own
 *  deep red on the normal-blend layer, so they stay rose-coloured over a
 *  card's art, lit along their lips. */
import { centre, rand } from "../../looks/base";
import type { Graphics } from "pixi.js";
import type { FxTools, Pt, SparkStyle } from "../../looks/types";
import type { Signature, SigMoment } from "../types";

type Box = SigMoment["from"];

const TAU = Math.PI * 2;
// The blade and the stems: black, only ever on the dark layer.
const INK = 0x0b0206, STEM = 0x170609;
// The roses: real colour, on the normal-blend layer.
const PETAL = 0xb3122a, PETAL_DEEP = 0x860b20, PETAL_LIT = 0xd2203a, HEART = 0x4c0412;
// Light (additive): the crimson that rims it all, a rose's pink, the edge's glint.
const CRIMSON = 0xe8223e, ROSE = 0xff5a6e, BLUSH = 0xffc4cc, GLINT = 0xfff0f2;
/** Blood flung off the cut: fast, streaking, falling. */
const SPRAY: SparkStyle = { palette: [BLUSH, ROSE, 0xc8102c, 0x700818], gravity: 520, drag: 0.45, size: [6, 2], streak: true };
/** Drops: round, heavy, running down. */
const DROP: SparkStyle = { palette: [0xffb8c0, 0xf0283e, 0xa00c22, 0x5a0410], gravity: 760, drag: 0.6, size: [5, 2.5], streak: false };
/** Motes of her wind-up: crimson, curling round her. */
const MOTE: SparkStyle = { palette: [BLUSH, ROSE, CRIMSON], gravity: -30, drag: 0.5, size: [5, 1.5], streak: false, swirl: 170 };

/** How far the lunge carries her token toward her targets' middle, and how
 *  long it takes coming home: use-spell-impacts.ts `lunge` — drawn back a
 *  tenth, then driven this far by the landing frame on a CSS ease-in. */
const LUNGE = 0.42, RETURN = 0.22;
/** How far the cut runs on before its first card and past its last, rad. */
const LEAD = 0.75, FOLLOW = 0.55;

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeOut = (x: number) => 1 - (1 - x) * (1 - x);
const smooth = (x: number) => x * x * (3 - 2 * x);

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

/** Where her lunge has her token `time` into a delivery of `seconds`, as a
 *  fraction of its full reach: so the blade she holds goes where she goes. */
function lungeK(time: number, seconds: number): number {
  const total = seconds + RETURN, strike = seconds / total, back = strike * 0.4, p = easeInCss(time / total);
  if (p <= back) return (-0.1 * p) / back;
  if (p <= strike) return -0.1 + (1.1 * (p - back)) / (strike - back);
  return 1 - (p - strike) / (1 - strike);
}

// ── The cut ──────────────────────────────────────────────────────────────────

/** HER CUT: an arc swung round where she stands as it lands (`P`, the end of
 *  her lunge), from `a0` through `span` radians — always turning clockwise on
 *  screen, which a board turned round for P2 keeps — passing every target in
 *  turn. Its radius eases from one target's distance to the next, so it runs
 *  through the middle of each: `d[k]`, reached `f[k]` of the way round, for
 *  `m.targets[order[k]]`. */
interface Cut { P: Pt; a0: number; span: number; d: number[]; f: number[]; order: number[] }

function cutOf(m: SigMoment): Cut {
  const c = centre(m.from), s = m.size, pts = m.targets.map(centre);
  const ahead = Math.atan2(m.ahead.y, m.ahead.x);
  if (!pts.length) return { P: c, a0: ahead - LEAD, span: LEAD + FOLLOW, d: [s * 0.8], f: [LEAD / (LEAD + FOLLOW)], order: [] };
  const mid = { x: pts.reduce((a, p) => a + p.x, 0) / pts.length, y: pts.reduce((a, p) => a + p.y, 0) / pts.length };
  const P = { x: c.x + (mid.x - c.x) * LUNGE, y: c.y + (mid.y - c.y) * LUNGE };
  const ang = pts.map((p) => Math.atan2(p.y - P.y, p.x - P.x));
  const dist = pts.map((p) => Math.max(s * 0.45, Math.hypot(p.x - P.x, p.y - P.y)));
  // Through all of them the short way: round the arc that leaves out the
  // widest gap between them — and when two gaps tie (a card either side of
  // her), the one behind her, so the blade comes round her front.
  const order = ang.map((_, i) => i).sort((i, j) => ang[i] - ang[j]);
  const n = order.length, back = ahead + Math.PI;
  let best = -1, gapAt = n - 1;
  for (let k = 0; k < n && n > 1; k++) {
    const a = ang[order[k]], g = (k + 1 < n ? ang[order[k + 1]] : ang[order[0]] + TAU) - a;
    const behind = (((back - a) % TAU) + TAU) % TAU < g ? 0.3 : 0;
    if (g + behind > best) { best = g + behind; gapAt = k; }
  }
  const seq = [...order.slice(gapAt + 1), ...order.slice(0, gapAt + 1)];
  const rel = seq.map((i) => (((ang[i] - ang[seq[0]]) % TAU) + TAU) % TAU);
  const span = rel[rel.length - 1] + LEAD + FOLLOW;
  return { P, a0: ang[seq[0]] - LEAD, span, d: seq.map((i) => dist[i]), f: rel.map((a) => (a + LEAD) / span), order: seq };
}

/** The cut's radius `f` of the way round. */
function radius(cut: Cut, f: number): number {
  const { d, f: at } = cut;
  if (f <= at[0]) return d[0];
  for (let k = 1; k < at.length; k++)
    if (f <= at[k]) return d[k - 1] + (d[k] - d[k - 1]) * smooth((f - at[k - 1]) / (at[k] - at[k - 1]));
  return d[d.length - 1];
}

/** The point `f` of the way round the cut, `off` px out from its line. */
function onCut(cut: Cut, f: number, off = 0): Pt {
  const th = cut.a0 + cut.span * f, R = radius(cut, f) + off;
  return { x: cut.P.x + Math.cos(th) * R, y: cut.P.y + Math.sin(th) * R };
}

/** The crescent of the cut from `f0` to `f1` of the way round, `w` across at
 *  its heaviest (just behind its head) and drawn to a point at both ends: its
 *  OUTLINE, its back and inner edges as lines, and the thorns barbed along its
 *  back — each a triangle swept back against the swing, as a rose's are. */
function crescent(cut: Cut, f0: number, f1: number, w: number, thorn: number) {
  const N = 26, outer: number[] = [], inner: number[] = [], barbs: number[][] = [];
  const hwAt = (q: number) => (w / 2) * Math.pow(Math.max(0, Math.sin(Math.PI * Math.pow(clamp01(q), 1.3))), 0.6);
  for (let i = 0; i <= N; i++) {
    const q = i / N, f = f0 + (f1 - f0) * q, hw = hwAt(q);
    const o = onCut(cut, f, hw), n = onCut(cut, f, -hw * 0.8);
    outer.push(o.x, o.y);
    inner.push(n.x, n.y);
  }
  // A thorn every so far along the whole cut, wherever the crescent is.
  const K = 8;
  for (let k = 0; k < K && f1 - f0 > 0.02; k++) {
    const fb = (k + 0.5) / K;
    if (fb < f0 + (f1 - f0) * 0.08 || fb > f0 + (f1 - f0) * 0.9) continue;
    const hw = hwAt((fb - f0) / (f1 - f0)), R = radius(cut, fb), th = cut.a0 + cut.span * fb;
    const L = thorn * (hw / (w / 2)), da = (L * 0.55) / R;
    const b0 = onCut(cut, fb - da / cut.span, hw * 0.9), b1 = onCut(cut, fb + da / cut.span, hw * 0.9);
    const tipA = th - da * 1.6, tipR = R + hw + L;
    barbs.push([b0.x, b0.y, cut.P.x + Math.cos(tipA) * tipR, cut.P.y + Math.sin(tipA) * tipR, b1.x, b1.y]);
  }
  const outline = outer.slice();
  for (let i = inner.length - 2; i >= 0; i -= 2) outline.push(inner[i], inner[i + 1]);
  return { outline, outer, inner, barbs };
}

/** The blade drawn: its black on the dark layer (`dark`), else its light —
 *  crimson along its back with a glow, a thin rim inside, the thorns rimmed,
 *  and `hot` (0..1) whitening its leading edge while it moves. */
function blade(g: Graphics, b: ReturnType<typeof crescent>, alpha: number, dark: boolean, hot = 0) {
  if (alpha <= 0.01 || b.outline.length < 8) return;
  if (dark) {
    g.poly(b.outline, true).fill({ color: INK, alpha: 0.88 * alpha });
    for (const tr of b.barbs) g.poly(tr, true).fill({ color: INK, alpha: 0.88 * alpha });
    return;
  }
  g.poly(b.outer, false).stroke({ width: 7, color: CRIMSON, alpha: 0.22 * alpha, cap: "round", join: "round" });
  g.poly(b.outer, false).stroke({ width: 2.2, color: CRIMSON, alpha: 0.95 * alpha, cap: "round", join: "round" });
  g.poly(b.inner, false).stroke({ width: 1, color: ROSE, alpha: 0.5 * alpha, join: "round" });
  for (const tr of b.barbs) g.poly(tr, true).stroke({ width: 1, color: ROSE, alpha: 0.8 * alpha, join: "miter" });
  if (hot > 0.01) g.poly(b.outer.slice(Math.floor(b.outer.length * 0.275) * 2), false)
    .stroke({ width: 1.4, color: GLINT, alpha: 0.95 * hot * alpha, cap: "round", join: "round" });
}

// ── Petals ───────────────────────────────────────────────────────────────────

/** A rose petal round (x, y): `len` long along `ang`, broad and round at its
 *  lip and pinched at its base; `open` is how face-on it is, so a tumbling
 *  petal thins to a sliver and back. A fresh list each time: Pixi keeps the
 *  points it is handed until it draws them. */
function petal(x: number, y: number, len: number, ang: number, open: number): number[] {
  const c = Math.cos(ang), s = Math.sin(ang), w = len * 0.44 * Math.max(0.14, open), pts: number[] = [];
  for (let i = 0; i < 12; i++) {
    const p = (i / 12) * TAU, u = (1 + Math.cos(p)) / 2;
    const lx = len * 0.5 * Math.cos(p), ly = w * Math.sin(p) * (0.32 + 0.68 * Math.sqrt(u));
    pts.push(x + c * lx - s * ly, y + s * lx + c * ly);
  }
  return pts;
}

/** A petal let loose: flung, its fling bleeding off, then drifting down at
 *  its own pace, rocking and turning over — all in closed form from its
 *  birth, so a whole fall of them is one Graphics. */
interface Fall { x: number; y: number; vx: number; vy: number; at: number; life: number; len: number; fall: number; sway: number; spin: number; ph: number; rot: number; tone: number }

function fall(x: number, y: number, vx: number, vy: number, at: number, life: number, len: number, s: number): Fall {
  const r = Math.random();
  return { x, y, vx, vy, at, life, len, fall: rand(22, 42) * (s / 90), sway: rand(2, 6) * (s / 90), spin: rand(5, 10) * (Math.random() < 0.5 ? -1 : 1),
    ph: rand(0, TAU), rot: rand(0, TAU), tone: r < 0.5 ? PETAL : r < 0.75 ? PETAL_DEEP : PETAL_LIT };
}

/** Where a falling petal is `a` seconds after its birth, and how it shows. */
function fallAt(p: Fall, a: number) {
  const u = a / p.life, d = 0.2 * (1 - Math.exp(-a / 0.2)), w = a * 6 + p.ph, turn = Math.cos(p.spin * a + p.ph);
  return {
    x: p.x + p.vx * d + p.sway * (Math.sin(w) - Math.sin(p.ph)), y: p.y + p.vy * d + p.fall * a,
    ang: p.rot + p.spin * a * 0.3 + 0.5 * Math.cos(w), open: 0.2 + 0.8 * Math.abs(turn),
    alpha: Math.min(1, u * 10) * (1 - u * u),
  };
}

/** A fall of petals: their red on the normal-blend layer, their lips lit. */
function petals(t: FxTools, ps: Fall[], delay = 0) {
  let end = 0;
  for (const p of ps) end = Math.max(end, p.at + p.life);
  if (end <= 0) return;
  t.draw(end, (g, k) => {
    const now = k * end;
    for (const p of ps) {
      const a = now - p.at;
      if (a < 0 || a >= p.life) continue;
      const q = fallAt(p, a);
      g.poly(petal(q.x, q.y, p.len, q.ang, q.open), true).fill({ color: p.tone, alpha: 0.95 * q.alpha });
    }
  }, { dark: true, delay });
  t.draw(end, (g, k) => {
    const now = k * end;
    for (const p of ps) {
      const a = now - p.at;
      if (a < 0 || a >= p.life) continue;
      const q = fallAt(p, a);
      g.poly(petal(q.x, q.y, p.len, q.ang, q.open), true).stroke({ width: 1, color: ROSE, alpha: 0.7 * q.alpha });
    }
  }, { delay });
}

// ── The move ─────────────────────────────────────────────────────────────────

export const THORN: Signature = {
  shake: 1.1,
  // She keeps her lunge: the blade is drawn back as she closes, and the cut
  // is swung from where the lunge leaves her.

  deliver(t: FxTools, m: SigMoment, seconds: number) {
    const c = centre(m.from), s = m.size, S = seconds, cut = cutOf(m);
    const lx = cut.P.x - c.x, ly = cut.P.y - c.y;
    const her = (time: number) => {
      const k = lungeK(time, S);
      return { x: c.x + lx * k, y: c.y + ly * k };
    };
    // THE BLADE DRAWN BACK: the same crescent the cut will be, held close —
    // round her at arm's length, swinging back from where the cut will start
    // to well past it, then still, a glint running down its edge.
    const held = (time: number): Cut => {
      const swing = easeOut(clamp01(time / S / 0.8)), th = cut.a0 + 0.35 - 1.3 * swing, arm = 1.2;
      return { P: her(time), a0: th - arm / 2, span: arm, d: [s * 0.56], f: [0.5], order: [] };
    };
    const drawn = (time: number) => crescent(held(time), 0, clamp01(time / S / 0.3), s * 0.21, s * 0.075);
    t.draw(S, (g, u) => blade(g, drawn(u * S), clamp01(u * 5), true), { dark: true });
    t.draw(S, (g, u) => {
      const time = u * S, at = her(time);
      // The blood-dark light gathering under her.
      const k = easeOut(u);
      for (const [r, a] of [[0.5, 0.05], [0.36, 0.06], [0.22, 0.07]]) g.circle(at.x, at.y, s * r).fill({ color: CRIMSON, alpha: a * k });
      blade(g, drawn(time), clamp01(u * 5), false);
      // The glint, running down the edge as it tops out.
      const q = clamp01((u - 0.68) / 0.26);
      if (q > 0 && q < 1) {
        const p = onCut(held(time), q, s * 0.07), r = s * 0.08 * Math.sin(Math.PI * q);
        g.moveTo(p.x - r, p.y).lineTo(p.x + r, p.y).moveTo(p.x, p.y - r).lineTo(p.x, p.y + r).stroke({ width: 1.5, color: GLINT, alpha: 0.95 });
        g.circle(p.x, p.y, r * 0.45).fill({ color: ROSE, alpha: 0.6 });
      }
    });
    // THE WHIRL: petals rising round her in a turning helix, faster as she
    // winds — dimmer as they pass behind her.
    const n = Math.max(5, Math.round(10 * t.quality)), ph = rand(0, TAU), dir = Math.random() < 0.5 ? -1 : 1;
    const ring = Array.from({ length: n }, (_, i) => ({ th: ph + (i / n) * TAU, h: i / n, len: s * rand(0.15, 0.19), tone: i % 3 ? PETAL : PETAL_LIT }));
    const whirl = (time: number, p: (typeof ring)[number]) => {
      const u = time / S, at = her(time), th = p.th + dir * (u * 4.5 + u * u * 6);
      const h = (p.h + u * 1.1) % 1, rad = s * (0.62 - 0.16 * u);
      return { x: at.x + Math.cos(th) * rad, y: at.y + s * 0.4 - h * s * 0.85 + Math.sin(th) * rad * 0.3,
        ang: th + (dir * Math.PI) / 2, open: 0.35 + 0.65 * Math.abs(Math.cos(th * 2 + u * 7)),
        a: Math.min(1, u * 6) * Math.sin(Math.PI * h) * (Math.sin(th) > 0 ? 1 : 0.55) };
    };
    t.draw(S, (g, u) => {
      for (const p of ring) {
        const q = whirl(u * S, p);
        if (q.a > 0.02) g.poly(petal(q.x, q.y, p.len, q.ang, q.open), true).fill({ color: p.tone, alpha: 0.95 * q.a });
      }
    }, { dark: true });
    let acc = 0;
    t.draw(S, (g, u, dt) => {
      for (const p of ring) {
        const q = whirl(u * S, p);
        if (q.a > 0.02) g.poly(petal(q.x, q.y, p.len, q.ang, q.open), true).stroke({ width: 1, color: ROSE, alpha: 0.75 * q.a });
      }
      acc += dt * 26 * t.quality;
      for (; acc >= 1; acc--) {
        const at = her(u * S), a = rand(0, TAU), r = s * rand(0.35, 0.6);
        t.spark(at.x + Math.cos(a) * r, at.y + Math.sin(a) * r, -Math.sin(a) * 40 * dir * (s / 90), -rand(20, 60) * (s / 90), rand(0.3, 0.5), MOTE, at);
      }
    });
  },

  land(t: FxTools, m: SigMoment) {
    const s = m.size, cut = cutOf(m);
    // THE SWEEP: the head of the cut goes round in a blink, the crescent
    // heavy behind it; it holds a beat, then comes apart from its tail.
    const SWEEP = 0.17, HOLD = 0.08, GO = 0.32, D = SWEEP + HOLD + GO;
    const k = Math.max(0.8, Math.min(1.5, Math.max(0, ...m.power)));
    const W = s * 0.26 * (0.85 + 0.15 * k), THORN_L = s * 0.085;
    const head = (time: number) => 1 - Math.pow(1 - clamp01(time / SWEEP), 2.2);
    const tail = (time: number) => (time < SWEEP + HOLD ? head(time) * 0.12 : 0.12 + 0.88 * easeOut(clamp01((time - SWEEP - HOLD) / GO)));
    const shape = (time: number) => crescent(cut, tail(time), head(time), W, THORN_L);
    const alpha = (time: number) => 1 - clamp01((time - SWEEP - HOLD - GO * 0.5) / (GO * 0.5));
    t.draw(D, (g, v) => blade(g, shape(v * D), alpha(v * D), true), { dark: true });
    t.draw(D, (g, v) => {
      const time = v * D;
      // The wake of the swing: a faint fan of red between her and the cut.
      if (time < SWEEP + 0.06) {
        const h = head(time), f0 = Math.max(0, h - 0.35), a = 0.1 * (1 - clamp01((time - SWEEP) / 0.06));
        const fan: number[] = [cut.P.x, cut.P.y];
        for (let i = 0; i <= 8; i++) {
          const p = onCut(cut, f0 + ((h - f0) * i) / 8);
          fan.push(p.x, p.y);
        }
        g.poly(fan, true).fill({ color: CRIMSON, alpha: a });
      }
      blade(g, shape(time), alpha(time), false, 1 - clamp01((time - SWEEP) / 0.08));
    });
    // The cut coming apart into petals, from its tail, as it goes.
    const shed: Fall[] = [];
    const nShed = Math.max(4, Math.round(9 * t.quality));
    for (let i = 0; i < nShed; i++) {
      const f = (i + 0.5) / nShed, e = clamp01((f - 0.12) / 0.88), born = SWEEP + HOLD + GO * (1 - Math.sqrt(1 - Math.min(0.98, e)));
      const p = onCut(cut, f), th = cut.a0 + cut.span * f, v = rand(30, 70) * (s / 90);
      shed.push(fall(p.x, p.y, Math.cos(th) * v - Math.sin(th) * v * 0.6, Math.sin(th) * v + Math.cos(th) * v * 0.6, born, rand(0.45, 0.6), s * rand(0.12, 0.16), s));
    }
    petals(t, shed);
    // Where the head passes each card, the card bleeds.
    cut.order.forEach((i, j) => {
      const when = SWEEP * (1 - Math.pow(1 - cut.f[j], 1 / 2.2)), along = cut.a0 + cut.span * cut.f[j] + Math.PI / 2;
      t.later(when, () => {
        bleed(t, m.targets[i], along, m.power[i] ?? 1);
        if (m.killed[i]) bloom(t, m.targets[i], s);
      });
    });
  },
};

/** What the cut leaves on a card it passes through, along `along` (the way
 *  the blade was going): blood flung off with it, rose petals bursting off
 *  the wound and drifting down, a thorny tendril whipping across its face,
 *  and drops still running off it after — the BLEED. Sized by the hit. */
function bleed(t: FxTools, r: Box, along: number, power: number) {
  const p = centre(r), s = Math.min(r.w, r.h), k = Math.max(0.6, Math.min(1.6, power)), sc = s / 90;
  t.flash(p, ROSE, 0.17 * k * (s / 80));
  for (let i = 0; i < Math.round(9 * k); i++) {
    const a = along + rand(-0.45, 0.45), v = rand(150, 300) * sc;
    t.spark(p.x + rand(-4, 4), p.y + rand(-4, 4), Math.cos(a) * v, Math.sin(a) * v - 40 * sc, rand(0.3, 0.45), SPRAY);
  }
  for (let i = 0; i < Math.round(6 * k); i++) {
    const a = along + rand(-1.2, 1.2), v = rand(40, 120) * sc;
    t.spark(p.x + rand(-6, 6), p.y + rand(-6, 6), Math.cos(a) * v, Math.sin(a) * v - 60 * sc, rand(0.35, 0.55), DROP);
  }
  // Petals off the wound, thrown on with the blade and falling.
  const ps: Fall[] = [];
  for (let i = 0; i < Math.round(5 + 2 * k); i++) {
    const a = along + rand(-0.9, 0.9), v = rand(90, 200) * sc;
    ps.push(fall(p.x, p.y, Math.cos(a) * v, Math.sin(a) * v - 40 * sc, rand(0, 0.05), rand(0.6, 0.85), s * rand(0.12, 0.17), s));
  }
  petals(t, ps);
  tendril(t, p, s, along + rand(0.9, 1.3) * (Math.random() < 0.5 ? -1 : 1), k);
  // The BLEED: drops running off it for a while after.
  let acc = 0;
  t.draw(0.6, (_g, _u, dt) => {
    acc += dt * 14 * t.quality;
    for (; acc >= 1; acc--)
      t.spark(p.x + rand(-0.3, 0.3) * s, p.y + rand(0, 0.3) * s, rand(-10, 10) * sc, rand(10, 40) * sc, rand(0.3, 0.45), DROP);
  }, { delay: 0.08 });
}

/** A thorny rose-stem lashed across a card along `ang`: cracked out from one
 *  side to the other, its tip hooking over, thorns along it — then whipped
 *  back and gone. Black on the dark layer, rimmed in crimson. */
function tendril(t: FxTools, p: Pt, s: number, ang: number, k: number) {
  const ux = Math.cos(ang), uy = Math.sin(ang), nx = -uy, ny = ux, side = Math.random() < 0.5 ? -1 : 1;
  const L = s * 0.5 * Math.min(1.2, 0.85 + 0.15 * k), LASH = 0.08, D = 0.46;
  const path = (time: number) => {
    const f = easeOut(clamp01(time / LASH)), whip = Math.sin(Math.PI * clamp01((time - LASH) / 0.25)) * s * 0.08 * side;
    const pts: number[] = [];
    for (let i = 0; i <= 10; i++) {
      const q = (i / 10) * f, x = -L + 2 * L * q, bow = Math.sin(Math.PI * q) * s * 0.12 * side + whip * q * q;
      pts.push(p.x + ux * x + nx * bow, p.y + uy * x + ny * bow);
    }
    // The tip hooks over as it cracks.
    const ex = pts[20], ey = pts[21], ha = ang + side * (1.2 + 1.6 * f);
    pts.push(ex + Math.cos(ha) * s * 0.06, ey + Math.sin(ha) * s * 0.06, ex + Math.cos(ha + side * 1.4) * s * 0.09, ey + Math.sin(ha + side * 1.4) * s * 0.09);
    return pts;
  };
  const thorns = (pts: number[]) => {
    const out: number[][] = [];
    for (let i = 2; i < 10; i += 2) {
      const x = pts[i * 2], y = pts[i * 2 + 1], tx = pts[i * 2 + 2] - pts[i * 2 - 2], ty = pts[i * 2 + 3] - pts[i * 2 - 1];
      const l = Math.hypot(tx, ty) || 1, sd = i % 4 ? 1 : -1, bx = (tx / l) * s * 0.022, by = (ty / l) * s * 0.022;
      out.push([x - bx, y - by, x - (ty / l) * sd * s * 0.06 - bx * 1.4, y + (tx / l) * sd * s * 0.06 - by * 1.4, x + bx, y + by]);
    }
    return out;
  };
  const alpha = (time: number) => 1 - clamp01((time - 0.2) / (D - 0.2));
  t.draw(D, (g, v) => {
    const time = v * D, a = alpha(time), pts = path(time);
    g.poly(pts, false).stroke({ width: Math.max(2.5, s * 0.045), color: STEM, alpha: 0.9 * a, cap: "round", join: "round" });
    if (time > LASH * 0.6) for (const tr of thorns(pts)) g.poly(tr, true).fill({ color: STEM, alpha: 0.9 * a });
  }, { dark: true });
  t.draw(D, (g, v) => {
    const time = v * D, a = alpha(time), pts = path(time);
    g.poly(pts, false).stroke({ width: 5, color: CRIMSON, alpha: 0.28 * a, cap: "round", join: "round" });
    g.poly(pts, false).stroke({ width: 1.6, color: ROSE, alpha: 0.95 * a, cap: "round", join: "round" });
    if (time > LASH * 0.6) for (const tr of thorns(pts)) g.poly(tr, true).stroke({ width: 1, color: CRIMSON, alpha: 0.85 * a });
  });
}

/** A card the cut killed: a rose opens on it, ring by ring from a tight bud,
 *  holds a beat, and scatters — its petals blown off and falling. */
function bloom(t: FxTools, r: Box, s: number) {
  const p = centre(r), rot = rand(0, TAU), OPEN = 0.24, HOLD = 0.16, BLOW = OPEN + HOLD, D = BLOW + 0.5;
  const rings = [
    { n: 6, len: 0.3, at: 0.06, off: 0, tone: PETAL },
    { n: 5, len: 0.22, at: 0.03, off: 0.6, tone: PETAL_LIT },
    { n: 4, len: 0.14, at: 0, off: 1.1, tone: PETAL_DEEP },
  ];
  // Each petal of the rose as it opens, then flung from where it sat.
  const each = (time: number, fn: (x: number, y: number, len: number, ang: number, open: number, a: number, tone: number) => void) => {
    for (const rg of rings) {
      const o = easeOut(clamp01((time - rg.at) / (OPEN - rg.at)));
      for (let i = 0; i < rg.n; i++) {
        const ang = rot + rg.off + (i / rg.n) * TAU - (1 - o) * 0.9, len = s * rg.len * (0.35 + 0.65 * o);
        let x = p.x + Math.cos(ang) * len * 0.45, y = p.y + Math.sin(ang) * len * 0.45, a = Math.min(1, time * 12), spin = 0;
        if (time > BLOW && rg.len > 0.2) {
          const q = time - BLOW, v = s * (1.6 + (i % 2)), d = 0.3 * (1 - Math.exp(-q / 0.3));
          x += Math.cos(ang) * v * d;
          y += Math.sin(ang) * v * d + s * 0.5 * q * q;
          spin = q * 9 * (i % 2 ? 1 : -1);
          a *= 1 - q / (D - BLOW);
        } else if (time > BLOW) a *= 1 - clamp01((time - BLOW) / 0.2);
        fn(x, y, len, ang + spin, 0.55 + 0.45 * o * Math.abs(Math.cos(spin)), a, rg.tone);
      }
    }
  };
  t.draw(D, (g, v) => {
    const time = v * D, heart = (1 - clamp01((time - BLOW) / 0.2)) * Math.min(1, time * 12);
    each(time, (x, y, len, ang, open, a, tone) => {
      if (a > 0.02) g.poly(petal(x, y, len, ang, open), true).fill({ color: tone, alpha: 0.95 * a });
    });
    if (heart > 0.02) g.circle(p.x, p.y, s * 0.05).fill({ color: HEART, alpha: 0.9 * heart });
  }, { dark: true });
  t.draw(D, (g, v) => {
    const time = v * D, heart = (1 - clamp01((time - BLOW) / 0.2)) * Math.min(1, time * 12);
    each(time, (x, y, len, ang, open, a) => {
      if (a > 0.02) g.poly(petal(x, y, len, ang, open), true).stroke({ width: 1, color: ROSE, alpha: 0.75 * a });
    });
    // The bud's curl: a spiral at its heart, turning as it opens.
    if (heart > 0.02) {
      const turn = rot + time * 3;
      g.moveTo(p.x, p.y);
      for (let i = 1; i <= 12; i++) {
        const q = i / 12, a = turn + q * TAU * 1.4, rr = s * 0.075 * q;
        g.lineTo(p.x + Math.cos(a) * rr, p.y + Math.sin(a) * rr);
      }
      g.stroke({ width: 1.2, color: BLUSH, alpha: 0.8 * heart });
    }
  });
  t.later(0.02, () => t.glow(r, CRIMSON, 0.4, 0.6, 0.9));
  t.later(BLOW, () => t.ring(r, ROSE, 0.3, 1.0, 0.35, 2));
}
