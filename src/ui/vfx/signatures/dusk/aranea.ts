/** ARANEA — Brood Summon. "Raise a Monstrous Spider and FRIGHTEN every
 *  opponent in range for a round." Aranea raises a Monstrous Spider and
 *  frightens everyone in range.
 *
 *  Her art is a dark spider-queen with red eyes, great spider legs arching up
 *  behind her and a violet orb in her hand, spiders and egg-sacs all round;
 *  the Monstrous Spider she raises is a violet-black giant with a cluster of
 *  red eyes. So this move is SILK and EYES, never smoke.
 *
 *  The DELIVERY, when there is one, is the queen stirring: her spider legs
 *  unfold up behind her card, the orb in her hand condenses (a dark core in a
 *  violet ring) and a cluster of red eyes glints over her head. It may not run
 *  at all (the Special can frighten nobody), so the LANDING carries the move
 *  on its own: the orb flares and threads of silk shoot from her to the
 *  square where the brood will stand, sagging as silk does. A web SPINS there
 *  — spokes out, then the spiral wound round them — and an EGG-SAC swells at
 *  its heart, throbs, and SPLITS; out of it the great spider rises, its body
 *  swelling up and its legs unfolding, its red eyes lighting, while
 *  spiderlings scatter from the broken sac. Then the fright: from the spider
 *  a fine line of silk flicks out to every foe in range, a web splays across
 *  each card, and a cluster of red spider-EYES opens over it and glares,
 *  little spiders skittering off it.
 *
 *  Silk and the eyes are light. The spider, its legs and the spiderlings are
 *  solid on the normal-blend layer — violet-black, each with a lilac edge so
 *  they read over an empty square — and no light is laid over their bodies
 *  but the sheen stripe and the eyes, as on the card. */
import { centre, rand } from "../../looks/base";
import type { Graphics } from "pixi.js";
import type { FxTools, Pt, SparkStyle } from "../../looks/types";
import type { Signature, SigMoment } from "../types";

type Box = SigMoment["from"];

const TAU = Math.PI * 2;
/** Silk: silver-white to silver-violet. */
const SILK = 0xf2ecff, SILK2 = 0xbfaeff, VIOLET = 0x9a6ad8, PURPLE = 0x7b4fb0;
/** Spider red: the eyes, and their hot highlight. */
const RED = 0xff2238, EYE_HOT = 0xffc0c8;
/** The spider's body (normal-blend layer): violet-black, its sheen, its edge. */
const BODY = 0x150a24, BODY_HI = 0x3a2160, EDGE = 0x9c80e6;
/** Shreds of silk off the splitting sac. */
const SHRED: SparkStyle = { palette: [SILK, SILK2, VIOLET], gravity: 60, drag: 0.35, size: [4, 1.5], streak: true };
/** Violet motes drawn in to her orb. */
const MOTE_IN: SparkStyle = { palette: [SILK, SILK2, VIOLET], gravity: 0, drag: 1, size: [6, 2], streak: true, swirl: 240 };

/** The landing's beats, s: threads reach the nest by THREAD, the web is spun
 *  by SPUN, the sac splits at SPLIT, the spider stands by RISEN and fades
 *  from GONE to END; the frightening lines leave the spider at FLICK, one
 *  STAGGER apart, each taking FLY. */
const THREAD = 0.1, SPUN = 0.3, SPLIT = 0.34, RISEN = 0.56, GONE = 0.86, END = 1.05;
const FLICK = 0.48, STAGGER = 0.05, FLY = 0.1;

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeOut = (x: number) => 1 - (1 - x) * (1 - x);
/** Overshoots and settles. */
const snap = (x: number) => 1 + 2.7 * Math.pow(x - 1, 3) + 1.7 * Math.pow(x - 1, 2);
const add = (p: Pt, d: Pt, k: number): Pt => ({ x: p.x + d.x * k, y: p.y + d.y * k });

// ── Silk ─────────────────────────────────────────────────────────────────────

/** A strand of silk from `a` toward `b`, sagging (screen-down: silk hangs)
 *  by `sag` px at its middle, laid out only up to `reach` of its length. */
function strand(a: Pt, b: Pt, sag: number, reach: number): number[] {
  const out: number[] = [];
  const n = 10;
  for (let i = 0; i <= n; i++) {
    const f = (i / n) * reach;
    out.push(a.x + (b.x - a.x) * f, a.y + (b.y - a.y) * f + sag * 4 * f * (1 - f));
  }
  return out;
}

/** Stroke silk: a faint violet sheen, then the fine bright thread. */
function silk(g: Graphics, pts: number[], s: number, alpha: number) {
  if (alpha <= 0.01 || pts.length < 4) return;
  g.poly(pts, false).stroke({ width: Math.max(2.5, s * 0.04), color: VIOLET, alpha: 0.14 * alpha, join: "round" })
    .poly(pts, false).stroke({ width: Math.max(1, s * 0.012), color: SILK, alpha: 0.85 * alpha, join: "round" });
}

/** An orb web round `c`: `n` spokes out to `R` (drawn out by `spokes`, 0..1),
 *  then the spiral wound round them from the outside in (`spiral`, 0..1) —
 *  each turn a ring of straight threads from spoke to spoke, sagging a
 *  little toward the hub, as a real web's do. */
function web(g: Graphics, c: Pt, R: number, n: number, rot: number, spokes: number, spiral: number, s: number, alpha: number) {
  if (alpha <= 0.01) return;
  const sp = (i: number, r: number): Pt => { const a = rot + (i / n) * TAU + 0.12 * Math.sin(i * 2.3); return { x: c.x + Math.cos(a) * r, y: c.y + Math.sin(a) * r }; };
  const wPx = Math.max(1, s * 0.011);
  for (let i = 0; i < n; i++) {
    const e = sp(i, R * easeOut(spokes) * (0.88 + 0.12 * Math.sin(i * 1.7)));
    g.moveTo(c.x, c.y).lineTo(e.x, e.y);
  }
  g.stroke({ width: wPx, color: SILK, alpha: 0.75 * alpha });
  const turns = 4, segs = n * turns, drawn = Math.floor(segs * spiral);
  for (let k = 0; k < drawn; k++) {
    // From the outside in: the radius steps down a little every segment.
    const r0 = R * (0.92 - (0.7 * k) / segs), r1 = R * (0.92 - (0.7 * (k + 1)) / segs);
    const a = sp(k % n, r0), b = sp((k + 1) % n, r1);
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, pull = 0.12;
    g.moveTo(a.x, a.y).quadraticCurveTo(mid.x + (c.x - mid.x) * pull, mid.y + (c.y - mid.y) * pull, b.x, b.y);
  }
  if (drawn) g.stroke({ width: wPx, color: SILK2, alpha: 0.7 * alpha });
}

// ── Spiders ──────────────────────────────────────────────────────────────────

/** An oval round `c`, `along` the heading `f` and `across` it, as points —
 *  so it turns with the spider. */
function oval(c: Pt, f: Pt, along: number, across: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * TAU, u = Math.cos(a) * along, v = Math.sin(a) * across;
    out.push(c.x + f.x * u - f.y * v, c.y + f.y * u + f.x * v);
  }
  return out;
}

/** The great spider, `S` its size (a square), facing `f`, risen by `k` (its
 *  body swelling up from small) with its legs unfolded by `unf`: eight
 *  jointed legs, each out to a raised knee and down to a foot, the front
 *  pairs reaching forward and the back pairs back; a big abdomen with a
 *  violet sheen stripe down it, as on the card; and the head the eyes sit on.
 *  Solid on `g` (the dark layer), lilac-edged. */
function bigSpider(g: Graphics, c: Pt, f: Pt, S: number, k: number, unf: number, alpha: number, time: number) {
  const n = { x: -f.y, y: f.x }, z = S * k;
  const legs: number[][] = [];
  for (const sd of [-1, 1])
    for (let i = 0; i < 4; i++) {
      const ang = [0.85, 1.35, 1.9, 2.45][i] + 0.06 * Math.sin(time * 14 + i * 1.3 + sd);
      const u = { x: f.x * Math.cos(ang) + n.x * sd * Math.sin(ang), y: f.y * Math.cos(ang) + n.y * sd * Math.sin(ang) };
      const root = add(add(c, f, z * (0.08 - 0.05 * i)), n, sd * z * 0.07);
      const knee = add(add(root, u, z * (0.12 + 0.24 * unf)), n, sd * z * 0.05 * unf);
      // The lower leg bends back toward the body's line, forward legs forward.
      const bend = (i < 2 ? -1 : 1) * sd * 0.38 * unf;
      const lu = { x: u.x * Math.cos(bend) - u.y * Math.sin(bend), y: u.x * Math.sin(bend) + u.y * Math.cos(bend) };
      const foot = add(knee, lu, z * (0.06 + 0.3 * unf));
      legs.push([root.x, root.y, knee.x, knee.y, foot.x, foot.y]);
    }
  const lw = Math.max(2, z * 0.045);
  for (const l of legs) g.poly(l, false).stroke({ width: lw + 1.6, color: EDGE, alpha: 0.85 * alpha, join: "round", cap: "round" });
  for (const l of legs) g.poly(l, false).stroke({ width: lw, color: BODY, alpha, join: "round", cap: "round" });
  const abd = add(c, f, -z * 0.16), head = add(c, f, z * 0.1);
  g.poly(oval(abd, f, z * 0.24, z * 0.19), true).fill({ color: BODY, alpha }).stroke({ width: 1.5, color: EDGE, alpha: 0.9 * alpha });
  g.poly(oval(add(abd, n, -z * 0.05), f, z * 0.15, z * 0.07), true).fill({ color: BODY_HI, alpha: 0.8 * alpha });
  g.poly(oval(head, f, z * 0.13, z * 0.12), true).fill({ color: BODY, alpha }).stroke({ width: 1.5, color: EDGE, alpha: 0.9 * alpha });
}

/** The spider's eyes, lit (light layer): a cluster at the front of its head
 *  — two big, two beside them, two small and two tiny — each a hot red dot
 *  in a red glow. */
function spiderEyes(g: Graphics, head: Pt, f: Pt, n: Pt, z: number, alpha: number) {
  if (alpha <= 0.01) return;
  const eyes: [number, number, number][] = [[0.032, 0.07, 0.03], [0.075, 0.045, 0.022], [0.05, 0.11, 0.016], [0.1, 0.015, 0.014]];
  for (const [x, y, r] of eyes)
    for (const sd of [-1, 1]) {
      const p = add(add(head, n, sd * x * z), f, y * z);
      g.circle(p.x, p.y, r * z * 1.8).fill({ color: RED, alpha: 0.2 * alpha });
      g.circle(p.x, p.y, r * z).fill({ color: RED, alpha: 0.95 * alpha });
      g.circle(p.x - r * z * 0.3, p.y - r * z * 0.3, r * z * 0.4).fill({ color: EYE_HOT, alpha: 0.9 * alpha });
    }
}

/** Little spiders skittering out from `p`: each runs a zig-zag line off and
 *  out, its legs scrabbling, and is gone. Solid, lilac-edged. */
function skitter(t: FxTools, p: Pt, s: number, n: number, delay: number) {
  const runs = Array.from({ length: n }, () => {
    const a = rand(0, TAU), d = s * rand(0.35, 0.6);
    return { a, d, zig: rand(0.25, 0.5) * (Math.random() < 0.5 ? -1 : 1), ph: rand(0, TAU), r: s * rand(0.028, 0.038) };
  });
  const D = 0.42;
  t.draw(D, (g, u) => {
    const time = u * D, alpha = clamp01(time / 0.04) * (1 - clamp01((u - 0.7) / 0.3));
    for (const k of runs) {
      const q = easeOut(u), heading = k.a + k.zig * Math.sign(Math.sin(time * 22 + k.ph));
      const x = p.x + Math.cos(k.a) * k.d * q + Math.cos(heading) * k.r * 0.6, y = p.y + Math.sin(k.a) * k.d * q + Math.sin(heading) * k.r * 0.6;
      const fx = Math.cos(heading), fy = Math.sin(heading);
      for (let i = 0; i < 4; i++)
        for (const sd of [-1, 1]) {
          const la = heading + sd * (0.7 + i * 0.5) + 0.3 * Math.sin(time * 40 + i + sd), L = k.r * 2.1;
          g.moveTo(x, y).lineTo(x + Math.cos(la) * L, y + Math.sin(la) * L);
        }
      g.stroke({ width: 1, color: EDGE, alpha: 0.85 * alpha });
      g.circle(x - fx * k.r * 0.5, y - fy * k.r * 0.5, k.r).fill({ color: BODY, alpha }).stroke({ width: 1, color: EDGE, alpha: 0.9 * alpha });
    }
  }, { dark: true, delay });
}

// ── The fright ───────────────────────────────────────────────────────────────

/** A FRIGHTENED FOE: a web splays across its card, and a cluster of red
 *  spider-eyes opens over it out of a patch of dark — they glare, flare once,
 *  then narrow and go out — while spiderlings run off it. Sized by `power`. */
function fright(t: FxTools, r: Box, s: number, power: number, when: number) {
  const c = centre(r), k = Math.max(0.9, Math.min(1.35, 0.75 + 0.5 * power)), rot = rand(0, TAU);
  const D = Math.max(0.3, END + 0.08 - when);
  const at = { x: c.x, y: c.y - s * 0.06 };
  // The splayed web.
  t.draw(D, (g, u) => {
    const time = u * D, a = 1 - clamp01((time - (D - 0.22)) / 0.22);
    web(g, c, s * 0.5 * k, 7, rot, clamp01(time / 0.07), clamp01((time - 0.04) / 0.14) * 0.45, s, 0.65 * a);
  }, { delay: when });
  // The dark the eyes open out of.
  const open = (time: number) => clamp01((time - 0.05) / 0.08) * (1 - clamp01((time - (D - 0.2)) / 0.12));
  t.draw(D, (g, u) => {
    const o = open(u * D);
    if (o > 0.01) g.ellipse(at.x, at.y, s * 0.3 * k, s * 0.17 * k * o).fill({ color: BODY, alpha: 0.6 * o });
  }, { dark: true, delay: when });
  t.draw(D, (g, u) => {
    const time = u * D, o = open(time);
    if (o <= 0.01) return;
    const flare = 1 + 0.35 * Math.exp(-Math.max(0, time - 0.13) / 0.06) * clamp01((time - 0.1) / 0.03);
    g.ellipse(at.x, at.y, s * 0.3 * k, s * 0.17 * k * o).stroke({ width: 1.2, color: VIOLET, alpha: 0.6 * o });
    const eyes: [number, number, number][] = [[0.085, -0.01, 0.052], [0.19, -0.06, 0.034], [0.15, 0.075, 0.028], [0.045, -0.115, 0.022]];
    for (const [x, y, rr] of eyes)
      for (const sd of [-1, 1]) {
        const ex = at.x + sd * x * s * k, ey = at.y + y * s * k, R = rr * s * k * flare;
        g.ellipse(ex, ey, R * 2, R * 2 * o).fill({ color: RED, alpha: 0.22 });
        g.ellipse(ex, ey, R, R * o).fill({ color: RED, alpha: 0.95 });
        g.ellipse(ex - R * 0.3, ey - R * 0.3 * o, R * 0.38, R * 0.38 * o).fill({ color: EYE_HOT, alpha: 0.9 });
      }
  }, { delay: when });
  t.later(when + 0.12, () => t.flash(at, RED, 0.18 * k * (s / 80)));
  skitter(t, c, s, Math.max(2, Math.round(3 * t.quality)), when + 0.08);
}

/** Where the nest is: the Monstrous Spider's square — or, should the game
 *  hand none, the square ahead of her. */
function nestOf(m: SigMoment): Box {
  return m.spawned[0] ?? { x: m.from.x + m.ahead.x * m.size * 1.08, y: m.from.y + m.ahead.y * m.size * 1.08, w: m.from.w, h: m.from.h };
}

/** Her orb: held low at her right hand. */
const orbOf = (c: Pt, s: number): Pt => ({ x: c.x + s * 0.2, y: c.y + s * 0.08 });

export const ARANEA: Signature = {
  // A summoning and a scare, not a blow.
  shake: 0.4,
  lunge: false,

  deliver(t: FxTools, m: SigMoment, seconds: number) {
    const c = centre(m.from), s = m.size, T = seconds, orb = orbOf(c, s);
    // THE QUEEN STIRS: her spider legs unfold up behind her card, arching
    // out and down — lingering a breath past the landing, fading.
    const D = T + 0.12;
    const legs = (time: number) => {
      const unf = easeOut(clamp01(time / (T * 0.8)));
      const out: number[][] = [];
      for (const sd of [-1, 1])
        for (let i = 0; i < 4; i++) {
          const root = { x: c.x + sd * s * 0.1, y: c.y - s * 0.12 };
          const up = -Math.PI / 2 + sd * (0.35 + 0.32 * i) * (0.4 + 0.6 * unf) + 0.04 * Math.sin(time * 9 + i);
          const knee = { x: root.x + Math.cos(up) * s * (0.2 + 0.28 * unf), y: root.y + Math.sin(up) * s * (0.2 + 0.28 * unf) };
          const down = up + sd * (1.5 + 0.2 * i) * unf;
          const foot = { x: knee.x + Math.cos(down) * s * 0.3 * unf, y: knee.y + Math.sin(down) * s * 0.3 * unf };
          out.push([root.x, root.y, knee.x, knee.y, foot.x, foot.y]);
        }
      return out;
    };
    t.draw(D, (g, u) => {
      const time = u * D, a = clamp01(time / 0.08) * (1 - clamp01((time - T) / 0.12)), w = Math.max(2, s * 0.04);
      const ls = legs(time);
      for (const l of ls) g.poly(l, false).stroke({ width: w + 2.2, color: EDGE, alpha: 0.75 * a, join: "round", cap: "round" });
      for (const l of ls) g.poly(l, false).stroke({ width: w, color: BODY, alpha: 0.95 * a, join: "round", cap: "round" });
      // The orb's dark heart.
      g.circle(orb.x, orb.y, s * 0.07 * easeOut(clamp01(time / T))).fill({ color: BODY, alpha: 0.9 * a });
    }, { dark: true });
    t.draw(D, (g, u) => {
      const time = u * D, a = 1 - clamp01((time - T) / 0.12), r = s * 0.07 * easeOut(clamp01(time / T));
      // The orb's violet ring, and red eyes glinting over her head.
      if (r > 0.5) g.circle(orb.x, orb.y, r * 1.4).stroke({ width: r * 0.6, color: PURPLE, alpha: 0.4 * a })
        .circle(orb.x, orb.y, r * 1.05).stroke({ width: 1.5, color: SILK, alpha: 0.9 * a });
      const e = clamp01((time - T * 0.4) / 0.08) * a;
      for (const [x, y, rr] of [[0.03, 0, 0.022], [0.07, -0.02, 0.015]])
        for (const sd of [-1, 1]) {
          g.circle(c.x + sd * x * s, c.y - s * 0.3 + y * s, rr * s * 2).fill({ color: RED, alpha: 0.25 * e });
          g.circle(c.x + sd * x * s, c.y - s * 0.3 + y * s, rr * s).fill({ color: RED, alpha: 0.95 * e });
        }
    });
    const n = Math.round(12 * t.quality);
    for (let i = 0; i < n; i++)
      t.later(rand(0.1, 0.8) * T, () => {
        const a = rand(0, TAU), d = s * rand(0.3, 0.45), l = 0.2, v = d / l;
        t.spark(orb.x + Math.cos(a) * d, orb.y + Math.sin(a) * d, -Math.cos(a) * v - Math.sin(a) * v * 0.4, -Math.sin(a) * v + Math.cos(a) * v * 0.4, l, MOTE_IN, orb);
      });
  },

  land(t: FxTools, m: SigMoment) {
    const c = centre(m.from), s = m.size, orb = orbOf(c, s);
    const nest = nestOf(m), N = centre(nest);
    const f = Math.hypot(m.ahead.x, m.ahead.y) > 0.1 ? m.ahead : { x: 0, y: -1 };
    t.flash(orb, VIOLET, 0.35 * (s / 80));

    // THE THREADS: silk shot from her to the nest, sagging, standing until
    // the spider is up.
    const ends = [{ x: -0.3, y: -0.25 }, { x: 0.32, y: -0.1 }, { x: -0.05, y: 0.3 }].map((o) => ({ x: N.x + o.x * s, y: N.y + o.y * s }));
    const starts = [orb, { x: c.x - s * 0.15, y: c.y - s * 0.1 }, { x: c.x + s * 0.05, y: c.y + s * 0.15 }];
    t.draw(END, (g, u) => {
      const time = u * END, a = 1 - clamp01((time - GONE) / (END - GONE));
      ends.forEach((e, i) => {
        const reach = easeOut(clamp01((time - i * 0.025) / THREAD));
        if (reach <= 0) return;
        const pts = strand(starts[i], e, s * 0.08 * (1 + i * 0.3), reach);
        silk(g, pts, s, a);
        if (reach < 1) g.circle(pts[pts.length - 2], pts[pts.length - 1], s * 0.03).fill({ color: SILK, alpha: 0.95 });
      });
    });

    // THE WEB spun at the nest, and the EGG-SAC swelling at its heart.
    const rot = rand(0, TAU);
    t.draw(END, (g, u) => {
      // The web dims as the spider stands in it, so no light lies over its body.
      const time = u * END, a = (1 - 0.65 * clamp01((time - SPLIT) / 0.1)) * (1 - clamp01((time - GONE) / (END - GONE)));
      web(g, N, s * 0.62, 9, rot, clamp01((time - THREAD + 0.02) / 0.1), clamp01((time - THREAD - 0.04) / (SPUN - THREAD - 0.04)), s, a);
      // The sac: pale silk, wound round and throbbing, until it splits.
      const grow = easeOut(clamp01((time - 0.16) / 0.14));
      if (grow > 0 && time < SPLIT) {
        const throb = 1 + 0.08 * Math.sin(time * 45) * clamp01((time - 0.3) / 0.05);
        const rx = s * 0.17 * grow * throb, ry = s * 0.22 * grow * throb;
        g.ellipse(N.x, N.y, rx, ry).fill({ color: SILK2, alpha: 0.3 }).stroke({ width: 1.5, color: SILK, alpha: 0.9 });
        for (let i = 1; i <= 3; i++) g.ellipse(N.x, N.y + ry * (i - 2) * 0.45, rx * Math.sqrt(1 - Math.pow((i - 2) * 0.45, 2)), ry * 0.12);
        g.stroke({ width: 1, color: SILK, alpha: 0.55 });
      }
      // ...splitting: the two halves of its shell thrown apart and gone.
      const q = clamp01((time - SPLIT) / 0.2);
      if (q > 0 && q < 1) {
        const n = { x: -f.y, y: f.x }, o = s * 0.2 * easeOut(q), al = 1 - q;
        for (const sd of [-1, 1]) {
          const h = add(N, n, sd * o), pts: number[] = [];
          for (let i = 0; i <= 10; i++) {
            const a2 = -Math.PI / 2 + (i / 10) * Math.PI, rx = s * 0.17, ry = s * 0.22;
            pts.push(h.x + sd * Math.cos(a2) * rx * (1 - 0.3 * q), h.y + Math.sin(a2) * ry);
          }
          g.poly(pts, false).stroke({ width: 1.5, color: SILK, alpha: 0.85 * al });
        }
      }
    });
    t.later(SPLIT, () => {
      t.flash(N, SILK2, 0.3 * (s / 80));
      const n = Math.round(12 * t.quality);
      for (let i = 0; i < n; i++) {
        const a = rand(0, TAU), v = rand(80, 170) * (s / 90);
        t.spark(N.x, N.y, Math.cos(a) * v, Math.sin(a) * v, rand(0.25, 0.4), SHRED);
      }
    });
    skitter(t, N, s, Math.max(3, Math.round(5 * t.quality)), SPLIT + 0.02);

    // THE SPIDER rising out of the broken sac: solid, then its eyes lit.
    const rise = (time: number) => Math.max(0.3, snap(clamp01((time - SPLIT) / (RISEN - SPLIT))));
    const unfold = (time: number) => easeOut(clamp01((time - SPLIT - 0.06) / (RISEN - SPLIT)));
    const alive = (time: number) => clamp01((time - SPLIT) / 0.04) * (1 - clamp01((time - GONE) / (END - GONE)));
    t.draw(END, (g, u) => {
      const time = u * END;
      if (time < SPLIT) return;
      bigSpider(g, N, f, s * 1.05, rise(time), unfold(time), alive(time), time);
    }, { dark: true });
    t.draw(END, (g, u) => {
      const time = u * END;
      if (time < SPLIT) return;
      const k = rise(time), z = s * 1.05 * k, n = { x: -f.y, y: f.x }, a = alive(time);
      const abd = add(N, f, -z * 0.16), head = add(N, f, z * 0.1);
      // The sheen down its back, as on the card.
      g.moveTo(abd.x - f.x * z * 0.17, abd.y - f.y * z * 0.17).lineTo(abd.x + f.x * z * 0.17, abd.y + f.y * z * 0.17)
        .stroke({ width: Math.max(1.2, z * 0.018), color: VIOLET, alpha: 0.55 * a, cap: "round" });
      spiderEyes(g, head, f, n, z, a * clamp01((time - RISEN + 0.12) / 0.06));
    });

    // THE FRIGHT: silk flicked from the spider to every foe, and the eyes.
    m.targets.forEach((r, i) => {
      const p = centre(r), when = FLICK + i * STAGGER;
      const from = add(N, f, s * 0.15);
      const D = END + 0.05 - when;
      t.draw(D, (g, u) => {
        const time = u * D, reach = easeOut(clamp01(time / FLY)), a = 1 - clamp01((time - (D - 0.25)) / 0.25);
        const pts = strand(from, p, s * 0.1, reach);
        silk(g, pts, s, 0.85 * a);
        if (reach < 1) g.circle(pts[pts.length - 2], pts[pts.length - 1], s * 0.03).fill({ color: SILK, alpha: 0.95 });
      }, { delay: when });
      fright(t, r, s, m.power[i] ?? 0.55, when + FLY);
    });
  },
};
