/** HARTWOOD — Justice. "Deal 4 hits of 2 DMG (PEN) to all opponents in range
 *  and drain from them." Hartwood shields his Grove, and when an ally falls
 *  he answers the killer.
 *
 *  His art is an antlered knight in bark-and-leaf plate under green forest
 *  light, a long sword raised and a round wooden shield bearing a golden
 *  tree. The DELIVERY is him taking up the sword: the blade rises over his
 *  card, bark-green steel catching the light, while the golden tree on his
 *  shield lights from its roots up — the light climbing the trunk and out
 *  along every branch, the shield's rim drawn round it — and a glint runs up
 *  the blade as it tops out.
 *
 *  The LANDING is the judgement: four strokes on every card in reach at once,
 *  a beat apart — golden-green cuts crossing on each card, two diagonals, a
 *  level stroke, and a last chop down the line of the blow, his sword flashing
 *  round him with each. With every stroke life is drawn off them: green-gold
 *  motes stream out of each card and into him, the tree brightening as each
 *  wave comes home, and as the last arrives it pulses in full — the drain
 *  healing him.
 *
 *  He stands his ground (no lunge): he is the Grove's shield, and what he
 *  takes has to come home to where he stands. The sword is solid steel on the
 *  normal-blend layer, lit along its edges; the tree, the cuts and the life
 *  are light. */
import { centre, rand } from "../../looks/base";
import type { Graphics } from "pixi.js";
import type { FxTools, Pt, SparkStyle } from "../../looks/types";
import type { Signature, SigMoment } from "../types";

type Box = SigMoment["from"];

const TAU = Math.PI * 2;
// Light (additive): the gold of the tree and the cuts, the forest's green.
const GOLD = 0xffd75a, AMBER = 0xe0a42a, PALE_GOLD = 0xfff2b8, WHITE = 0xffffff;
const PALE = 0xf4ffe6, LIME = 0xb6f27a, GREEN = 0x4caf6d;
// His sword: real colour, on the normal-blend layer.
const STEEL = 0x4a5e4c, STEEL_LO = 0x26332a, EDGE = 0x0b130d, BRONZE = 0x94702a, GRIP = 0x3a2a16;
/** Chips struck off a cut: gold, quick, falling. */
const CHIP: SparkStyle = { palette: [WHITE, PALE_GOLD, GOLD, AMBER], gravity: 380, drag: 0.4, size: [5, 1.5], streak: true };
/** The life come home to him: green-gold, rising, curling. */
const RISE: SparkStyle = { palette: [PALE, PALE_GOLD, LIME, GREEN], gravity: -100, drag: 0.6, size: [6, 2], streak: false, swirl: 120 };
const RISE_L: SparkStyle = { ...RISE, swirl: -120 };

/** The beat between his strokes, s, and how long a mote of life takes to
 *  come home to him. */
const BEAT = 0.09, HOME = 0.3;

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeOut = (x: number) => 1 - (1 - x) * (1 - x);

// ── The tree on his shield ──────────────────────────────────────────────────

/** A limb of the tree: a line, its width, and how far up the tree it sits
 *  (`a0`..`a1`: 0 at the roots, 1 at the twigs), so light can climb it. */
interface Limb { x0: number; y0: number; x1: number; y1: number; w: number; a0: number; a1: number }

/** THE TREE on his shield, as on his art: roots spreading under a trunk that
 *  forks into a crown, and forks again, and again. Upright on screen, as his
 *  art is, whichever side of the board he stands on. */
function treeOf(c: Pt, s: number): Limb[] {
  const out: Limb[] = [], base = { x: c.x, y: c.y + s * 0.2 }, fork = { x: c.x, y: c.y - s * 0.03 };
  out.push({ x0: base.x, y0: base.y, x1: fork.x, y1: fork.y, w: s * 0.05, a0: 0.1, a1: 0.4 });
  for (const r of [-1, -0.4, 0.4, 1]) {
    const a = Math.PI / 2 + r * 1.05, len = s * (0.1 + 0.035 * (1 - Math.abs(r)));
    out.push({ x0: base.x, y0: base.y, x1: base.x + Math.cos(a) * len, y1: base.y + Math.sin(a) * len * 0.8, w: s * 0.026, a0: 0, a1: 0.14 });
  }
  const grow = (x: number, y: number, ang: number, len: number, w: number, depth: number, a0: number) => {
    const x1 = x + Math.cos(ang) * len, y1 = y + Math.sin(ang) * len, a1 = a0 + 0.2;
    out.push({ x0: x, y0: y, x1, y1, w, a0, a1 });
    if (depth > 0) for (const d of [-1, 1]) grow(x1, y1, ang + d * 0.5, len * 0.7, w * 0.62, depth - 1, a1);
  };
  for (const d of [-1, 0, 1]) grow(fork.x, fork.y, -Math.PI / 2 + d * 0.66, s * (d ? 0.135 : 0.11), s * 0.033, 2, 0.4);
  return out;
}

/** The tree lit as far as `front` has climbed it (0..1, roots to twigs),
 *  gold on a green glow; `heat` whitens it as it pulses. The shield's rim is
 *  drawn round it as the light climbs. */
function tree(g: Graphics, limbs: Limb[], c: Pt, s: number, front: number, alpha: number, heat = 0) {
  if (alpha <= 0.01 || front <= 0) return;
  const lit = (L: Limb) => {
    const f = clamp01((front - L.a0) / (L.a1 - L.a0));
    return f > 0 ? { x: L.x0 + (L.x1 - L.x0) * f, y: L.y0 + (L.y1 - L.y0) * f } : null;
  };
  for (const L of limbs) {
    const e = lit(L);
    if (e) g.moveTo(L.x0, L.y0).lineTo(e.x, e.y).stroke({ width: L.w * 2.6 + 2, color: AMBER, alpha: 0.3 * alpha, cap: "round" });
  }
  for (const L of limbs) {
    const e = lit(L);
    if (e) g.moveTo(L.x0, L.y0).lineTo(e.x, e.y).stroke({ width: Math.max(1, L.w), color: heat > 0.4 ? PALE_GOLD : GOLD, alpha: 0.95 * alpha, cap: "round" });
  }
  const R = s * 0.4, sweep = clamp01(front) * TAU, a0 = Math.PI / 2;
  g.moveTo(c.x + Math.cos(a0) * R, c.y + Math.sin(a0) * R).arc(c.x, c.y, R, a0, a0 + sweep).stroke({ width: 1.6, color: AMBER, alpha: 0.55 * alpha });
  if (heat > 0.01) g.circle(c.x, c.y - s * 0.05, s * 0.3).fill({ color: GOLD, alpha: 0.12 * heat * alpha });
}

// ── His sword ───────────────────────────────────────────────────────────────

/** HIS SWORD, its guard at (x, y), pointing along `ang`, `len` long and `w`
 *  across: bark-green steel running to a point, a bronze guard and grip
 *  behind. Solid (the dark layer) — or, `lit`, its light: pale edges, the
 *  gold fuller down its middle, the guard's rim and the green stone in it. */
function sword(g: Graphics, x: number, y: number, ang: number, len: number, w: number, alpha: number, lit: boolean) {
  if (alpha <= 0.01) return;
  const ux = Math.cos(ang), uy = Math.sin(ang), nx = -uy, ny = ux, hw = w / 2;
  const P = (a: number, b: number) => [x + ux * a + nx * b, y + uy * a + ny * b];
  const blade = [...P(0, hw), ...P(len * 0.84, hw * 0.78), ...P(len, 0), ...P(len * 0.84, -hw * 0.78), ...P(0, -hw)];
  const guard = [...P(-w * 0.18, w * 1.7), ...P(w * 0.18, w * 1.55), ...P(w * 0.18, -w * 1.55), ...P(-w * 0.18, -w * 1.7)];
  const grip = [...P(-w * 0.18, w * 0.26), ...P(-w * 1.5, w * 0.22), ...P(-w * 1.5, -w * 0.22), ...P(-w * 0.18, -w * 0.26)];
  const pommel = P(-w * 1.75, 0);
  if (!lit) {
    g.poly(grip, true).fill({ color: GRIP, alpha }).stroke({ width: 1, color: EDGE, alpha });
    g.poly(blade, true).fill({ color: STEEL, alpha });
    g.poly([...P(0, 0), ...P(len * 0.84, 0), ...P(len, 0), ...P(len * 0.84, -hw * 0.78), ...P(0, -hw)], true).fill({ color: STEEL_LO, alpha: 0.85 * alpha });
    g.poly(blade, true).stroke({ width: 1.2, color: EDGE, alpha });
    g.poly(guard, true).fill({ color: BRONZE, alpha }).stroke({ width: 1, color: EDGE, alpha });
    g.circle(pommel[0], pommel[1], w * 0.32).fill({ color: BRONZE, alpha }).stroke({ width: 1, color: EDGE, alpha });
    return;
  }
  g.poly(blade, true).stroke({ width: 4, color: LIME, alpha: 0.18 * alpha, join: "round" });
  g.poly(blade, true).stroke({ width: 1.3, color: PALE, alpha: 0.9 * alpha, join: "miter" });
  const f0 = P(w * 0.4, 0), f1 = P(len * 0.72, 0);
  g.moveTo(f0[0], f0[1]).lineTo(f1[0], f1[1]).stroke({ width: Math.max(1, w * 0.2), color: GOLD, alpha: 0.85 * alpha });
  g.poly(guard, true).stroke({ width: 1.2, color: GOLD, alpha: 0.9 * alpha });
  g.circle(x, y, w * 0.28).fill({ color: LIME, alpha: 0.9 * alpha });
  g.circle(pommel[0], pommel[1], w * 0.32).stroke({ width: 1, color: GOLD, alpha: 0.8 * alpha });
}

/** Where his sword stands over his card once raised, and how long it is:
 *  point to the sky, leaning a little, as on his art. */
const hilt = (c: Pt, s: number) => ({ x: c.x - s * 0.17, y: c.y - s * 0.04, ang: -Math.PI / 2 - 0.24, len: s * 0.74, w: s * 0.1 });

// ── The cuts ────────────────────────────────────────────────────────────────

/** A sword-cut through `c` along `ang`, `reach` either side: a long thin
 *  lens, bowed a little the way a blade travels, drawn from its start to
 *  `prog` of the way along — white at its heart, gold, in a green glow. */
function cut(g: Graphics, c: Pt, ang: number, reach: number, w: number, prog: number, alpha: number, bow: number) {
  if (alpha <= 0.01 || prog <= 0.02) return;
  const ux = Math.cos(ang), uy = Math.sin(ang), nx = -uy, ny = ux, N = 12;
  const shape = (k: number) => {
    const l: number[] = [], r: number[] = [];
    for (let i = 0; i <= N; i++) {
      const q = (i / N) * prog, d = -reach + 2 * reach * q, b = bow * reach * Math.sin(Math.PI * q);
      const hw = (w / 2) * k * Math.pow(Math.sin((Math.PI * i) / N), 0.7);
      l.push(c.x + ux * d + nx * (b + hw), c.y + uy * d + ny * (b + hw));
      r.unshift(c.x + ux * d + nx * (b - hw), c.y + uy * d + ny * (b - hw));
    }
    return l.concat(r);
  };
  g.poly(shape(2.4), true).fill({ color: GREEN, alpha: 0.3 * alpha });
  g.poly(shape(1), true).fill({ color: GOLD, alpha: 0.95 * alpha });
  g.poly(shape(0.4), true).fill({ color: WHITE, alpha: 0.95 * alpha });
}

export const HARTWOOD: Signature = {
  shake: 1.2,
  // He stands his ground: the strokes go out to them, and their life comes
  // home to him.
  lunge: false,

  deliver(t: FxTools, m: SigMoment, seconds: number) {
    const c = centre(m.from), s = m.size, S = seconds, limbs = treeOf(c, s), h = hilt(c, s);
    // HE TAKES UP THE SWORD: it rises up out of his card, point first,
    // fading in as it comes...
    const pose = (u: number) => {
      const k = easeOut(clamp01(u / 0.7)), drop = (1 - k) * s * 0.45;
      return { x: h.x - Math.cos(h.ang) * drop, y: h.y - Math.sin(h.ang) * drop, a: clamp01(u / 0.25) };
    };
    t.draw(S, (g, u) => {
      const p = pose(u);
      sword(g, p.x, p.y, h.ang, h.len, h.w, p.a, false);
    }, { dark: true });
    t.draw(S, (g, u) => {
      // ...while the tree on his shield lights from the roots up.
      const front = 1.05 * easeOut(clamp01((u - 0.1) / 0.75));
      tree(g, limbs, c, s, front, clamp01(u / 0.15));
      const p = pose(u);
      sword(g, p.x, p.y, h.ang, h.len, h.w, p.a, true);
      // A glint runs up the blade as it tops out.
      const q = clamp01((u - 0.7) / 0.25);
      if (q > 0 && q < 1) {
        const d = h.len * (0.1 + 0.85 * q), x = p.x + Math.cos(h.ang) * d, y = p.y + Math.sin(h.ang) * d, r = s * 0.11 * Math.sin(Math.PI * q);
        g.moveTo(x - r, y).lineTo(x + r, y).moveTo(x, y - r * 1.3).lineTo(x, y + r * 1.3).stroke({ width: 1.5, color: WHITE, alpha: 0.95 });
        g.circle(x, y, r * 0.35).fill({ color: PALE_GOLD, alpha: 0.8 });
      }
    });
    t.charge(c, s * 1.3, GOLD, 0.3, S);
    // The forest's light drawn in to him.
    t.emit({ count: 14, palette: [PALE_GOLD, LIME, GREEN], from: m.from, at: "ring", speed: [70, 120], gravity: 0, drag: 1,
      life: [0.2, S * 0.8], size: [5, 2], swirl: 90 });
  },

  land(t: FxTools, m: SigMoment) {
    const c = centre(m.from), s = m.size, limbs = treeOf(c, s);
    // THE STROKES: four on every card, a beat apart, all of them at once.
    m.targets.forEach((r, i) => strokes(t, r, c, i * 0.012, m.power[i] ?? 1));
    // His sword flashing round his front with each stroke, back and forth.
    const aim = m.targets.length
      ? Math.atan2(m.targets.reduce((a, r) => a + centre(r).y, 0) / m.targets.length - c.y, m.targets.reduce((a, r) => a + centre(r).x, 0) / m.targets.length - c.x)
      : Math.atan2(m.ahead.y, m.ahead.x);
    for (let j = 0; j < 4; j++) t.later(j * BEAT, () => swing(t, c, s, aim, j % 2 ? 1 : -1, j === 3));
    // THE DRAIN: with each stroke, motes of life rising off every card and
    // streaming home into him, faster as they come.
    interface Mote { at: number; dur: number; p0: Pt; p1: Pt; ctrl: Pt; r: number }
    const motes: Mote[] = [];
    const per = Math.max(2, Math.round(3 * t.quality));
    m.targets.forEach((r, i) => {
      const p = centre(r), k = Math.max(0.7, Math.min(1.4, m.power[i] ?? 1));
      for (let j = 0; j < 4; j++)
        for (let n = 0; n < per; n++) {
          const p0 = { x: p.x + rand(-0.25, 0.25) * s, y: p.y + rand(-0.25, 0.2) * s }, p1 = { x: c.x + rand(-0.12, 0.12) * s, y: c.y + rand(-0.1, 0.15) * s };
          const dx = p1.x - p0.x, dy = p1.y - p0.y, d = Math.hypot(dx, dy) || 1, bow = d * rand(0.15, 0.35) * (Math.random() < 0.5 ? -1 : 1);
          motes.push({ at: j * BEAT + i * 0.012 + 0.03 + rand(0, 0.04), dur: HOME * rand(0.85, 1.1), p0, p1, r: s * 0.03 * k,
            ctrl: { x: (p0.x + p1.x) / 2 - (dy / d) * bow, y: (p0.y + p1.y) / 2 + (dx / d) * bow - s * 0.15 } });
        }
    });
    const along = (mo: Mote, q: number) => {
      const e = q * q * (1.6 - 0.6 * q), w = 1 - e;
      return { x: w * w * mo.p0.x + 2 * w * e * mo.ctrl.x + e * e * mo.p1.x, y: w * w * mo.p0.y + 2 * w * e * mo.ctrl.y + e * e * mo.p1.y };
    };
    let end = 0;
    for (const mo of motes) end = Math.max(end, mo.at + mo.dur);
    const HOMED = end;
    if (motes.length)
      t.draw(end, (g, v) => {
        const time = v * end;
        for (const mo of motes) {
          const q = (time - mo.at) / mo.dur;
          if (q <= 0 || q >= 1) continue;
          const trail: number[] = [];
          for (let k = 0; k <= 5; k++) {
            const p = along(mo, Math.max(0, q - 0.22 + (k / 5) * 0.22));
            trail.push(p.x, p.y);
          }
          const a = Math.min(1, q * 6), hd = along(mo, q);
          g.poly(trail, false).stroke({ width: mo.r * 1.4, color: GREEN, alpha: 0.45 * a, cap: "round", join: "round" });
          g.circle(hd.x, hd.y, mo.r * 2).fill({ color: LIME, alpha: 0.3 * a });
          g.circle(hd.x, hd.y, mo.r).fill({ color: PALE_GOLD, alpha: 0.95 * a });
        }
      });
    // THE TREE on his shield takes it in: brighter as each wave comes home,
    // then lit through in full as the last arrives.
    const waves = [0, 1, 2, 3].map((j) => j * BEAT + 0.05 + HOME);
    const D = HOMED + 0.35;
    t.draw(D, (g, v) => {
      const time = v * D;
      let glow = 0.4 * Math.min(1, time * 10);
      for (const w of waves) if (time > w) glow += 0.25 * Math.exp(-(time - w) / 0.1);
      const fin = time > HOMED ? (time - HOMED) / (D - HOMED) : -1;
      if (fin >= 0) {
        // The last pulse: the light run up the tree again from the roots,
        // white-hot, and out — then the tree fades.
        tree(g, limbs, c, s, 1.05, Math.max(0, 1 - fin * fin) * 0.6, 0);
        tree(g, limbs, c, s, 1.1 * easeOut(clamp01(fin / 0.35)), 1 - fin, 1 - fin);
        return;
      }
      tree(g, limbs, c, s, 1.05, Math.min(1, glow), glow > 0.75 ? 0.5 : 0);
    });
    t.later(HOMED, () => {
      t.glow(m.from, 0xd8f080, 0.42, 0.6, 1.1);
      t.ring(m.from, GOLD, 0.45, 1.2, 0.4, 2);
      for (let i = 0; i < Math.round(14 * t.quality); i++)
        t.spark(c.x + rand(-0.32, 0.32) * s, c.y + rand(0, 0.35) * s, rand(-15, 15) * (s / 90), -rand(60, 120) * (s / 90), rand(0.5, 0.75), i % 2 ? RISE : RISE_L);
    });
  },
};

/** His sword's sweep round his front toward `aim`, turning `dir`: an arc of
 *  gold light drawn in a flick, white at its heart — the stroke that lands on
 *  every card at the same beat. The last is the heaviest. */
function swing(t: FxTools, c: Pt, s: number, aim: number, dir: number, last: boolean) {
  const R = s * 0.64, half = 0.85, D = 0.2;
  t.draw(D, (g, u) => {
    const head = easeOut(clamp01(u / 0.35)), tail = clamp01((u - 0.3) / 0.7), a = 1 - u * u;
    const a0 = aim - dir * half, from = a0 + dir * 2 * half * tail * 0.8, to = a0 + dir * 2 * half * head;
    if (Math.abs(to - from) < 0.02) return;
    const arc = (w: number, color: number, al: number) =>
      g.moveTo(c.x + Math.cos(from) * R, c.y + Math.sin(from) * R).arc(c.x, c.y, R, from, to, dir < 0).stroke({ width: w, color, alpha: al, cap: "round" });
    arc(last ? 9 : 7, GOLD, 0.22 * a);
    arc(last ? 3 : 2.2, GOLD, 0.9 * a);
    arc(1, WHITE, 0.9 * a);
  });
}

/** Four strokes on a card, `BEAT` apart from `delay`: two crossing diagonals,
 *  a level stroke and a last chop down the line of the blow from `from` —
 *  each drawn in a flick and fading, chips of gold struck off it. */
function strokes(t: FxTools, r: Box, from: Pt, delay: number, power: number) {
  const p = centre(r), s = Math.min(r.w, r.h), k = Math.max(0.7, Math.min(1.4, power));
  const line = Math.atan2(p.y - from.y, p.x - from.x), across = line + Math.PI / 2;
  const plan = [
    { ang: across + 0.62, reach: 0.4, off: rand(-0.05, 0.05) },
    { ang: across - 0.62, reach: 0.4, off: rand(-0.05, 0.05) },
    { ang: across + rand(-0.1, 0.1), reach: 0.38, off: rand(-0.08, 0.08) },
    { ang: line + rand(-0.12, 0.12), reach: 0.46, off: 0 },
  ];
  const DRAW = 0.045, FADE = 0.24, D = 3 * BEAT + DRAW + FADE;
  t.draw(D, (g, v) => {
    const time = v * D;
    plan.forEach((st, j) => {
      const q = time - j * BEAT;
      if (q <= 0) return;
      const prog = easeOut(clamp01(q / DRAW)), a = q < DRAW ? 1 : 1 - (q - DRAW) / FADE;
      const big = j === 3 ? 1.25 : 1, c = { x: p.x - Math.sin(st.ang) * st.off * s, y: p.y + Math.cos(st.ang) * st.off * s };
      cut(g, c, st.ang, s * st.reach * (0.9 + 0.1 * k) * big, s * 0.075 * k * big, prog, a, 0.1 * (j % 2 ? 1 : -1));
    });
  }, { delay });
  for (let j = 0; j < 4; j++)
    t.later(delay + j * BEAT, () => {
      t.flash(p, j === 3 ? PALE_GOLD : GOLD, (j === 3 ? 0.14 : 0.09) * k * (s / 80));
      const st = plan[j];
      for (let n = 0; n < Math.round((j === 3 ? 5 : 3) * k); n++) {
        const a = st.ang + (n % 2 ? 0 : Math.PI) + rand(-0.5, 0.5), v = rand(90, 190) * (s / 90);
        t.spark(p.x, p.y, Math.cos(a) * v, Math.sin(a) * v - 40 * (s / 90), rand(0.2, 0.35), CHIP);
      }
    });
}
