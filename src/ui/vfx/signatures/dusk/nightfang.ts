/** NIGHTFANG — Soul Slash. "Delete 15 max HP from an opponent (destroying it
 *  outright if it has 15 or less), then slip into STEALTH." One foe beside
 *  it, and what it takes is not health but the room to have any.
 *
 *  Its art is a shadow beast of black, tattered smoke and fur, huge clawed
 *  arms reaching out of the dark, violet eyes and fangs, a graveyard under a
 *  pale moon. So the DELIVERY is the beast waking: shadow swells over its
 *  card, ragged with fur, two slanted violet eyes open in it over a pair of
 *  pale fangs, and two clawed hands rise either side of it and draw back.
 *
 *  The LANDING is the Soul Slash. Three huge claw rakes tear through the
 *  card one after another — black wounds edged in violet, the talon that cut
 *  each one visible at its head as it goes — and out of the wounds a pale
 *  SOUL is torn: a wailing ghost of cold white light, hollow-eyed, pulled
 *  out of the card and dragged back through the air into Nightfang, which
 *  swallows it (the light pulled IN, as DUSK always takes). A thread of it
 *  stays tied to the card and snaps — it lost the part, not the whole. Then
 *  the shadow folds in over Nightfang's own card from every side, strands of
 *  it closing like fur over the face, and it is gone (the STEALTH). On a kill
 *  the whole soul comes out, larger, with nothing left holding it, and the
 *  card it came out of goes grey.
 *
 *  The soul is the one cold, pale-blue light in the move, so it reads as
 *  something TAKEN against all that violet. Darkness is drawn for real
 *  (`dark: true`) and every dark shape keeps a violet edge. */
import { centre, rand } from "../../looks/base";
import type { Graphics } from "pixi.js";
import type { FxTools, Pt, SparkStyle } from "../../looks/types";
import type { Signature, SigMoment } from "../types";

type Box = SigMoment["from"];

const TAU = Math.PI * 2;
const PALE = 0xf3e8ff, LILAC = 0xc9a6ff, VIOLET = 0x9a6ad8, PURPLE = 0x7b4fb0, DEEP = 0x4a2a78;
/** The shadow itself — only ever on the dark layer. */
const INK = 0x0b0418;
/** The soul: cold white, ice-blue, a grey-blue as it thins. */
const SOUL = 0xf4fbff, ICE = 0xbfe2ff, FROST = 0x86b4e8;
/** A card with its soul gone: ash grey, normal blend. */
const ASH = 0x77737f;

/** Shadow torn off the claws, streaking on along the rake. */
const SHRED: SparkStyle = { palette: [PALE, LILAC, VIOLET, PURPLE], gravity: 0, drag: 0.4, size: [7, 2.5], streak: true };
/** What the soul sheds as it is dragged: cold motes trailing behind. */
const WISP: SparkStyle = { palette: [SOUL, ICE, FROST], gravity: -20, drag: 0.5, size: [5, 1.5], streak: false };
/** Motes of shadow drawn in as it wakes. */
const MOTE_IN: SparkStyle = { palette: [PALE, LILAC, VIOLET], gravity: 0, drag: 1, size: [6, 2], streak: true, swirl: 240 };
/** Smoke off it as it folds into the dark. */
const SMOKE: SparkStyle = { palette: [LILAC, VIOLET, PURPLE, DEEP], gravity: -55, drag: 0.4, size: [4, 11], streak: false };

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeOut = (x: number) => 1 - (1 - x) * (1 - x);
const easeIn = (x: number) => x * x;
/** 0 -> 1 as `u` runs from `a` to `b`. */
const span = (u: number, a: number, b: number) => clamp01((u - a) / (b - a));
const unit = (x: number, y: number, fb: Pt): Pt => {
  const l = Math.hypot(x, y);
  return l > 1e-6 ? { x: x / l, y: y / l } : fb;
};

// ── Shadow ──────────────────────────────────────────────────────────────────

/** A shadow stain: overlapping discs, so its edge is ragged, densest in the
 *  middle where they stack. */
function blot(g: Graphics, x: number, y: number, r: number, alpha: number, seed: number) {
  if (r < 0.5 || alpha <= 0.01) return;
  g.circle(x, y, r * 0.62);
  for (let i = 0; i < 6; i++) {
    const a = seed + i * 1.1;
    g.circle(x + Math.cos(a) * r * 0.4, y + Math.sin(a) * r * 0.4, r * (0.42 + 0.08 * (i % 3)));
  }
  g.fill({ color: INK, alpha });
}

/** A tapered strand: wide at `a`, a point at `b`, bowed `bow` px to its
 *  side — a tuft of the beast's fur, a talon, a fold of shadow. */
function strand(g: Graphics, a: Pt, b: Pt, w: number, bow: number): Graphics {
  const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, nx = -dy / d, ny = dx / d;
  const mx = (a.x + b.x) / 2 + nx * bow, my = (a.y + b.y) / 2 + ny * bow;
  return g.moveTo(a.x + nx * w / 2, a.y + ny * w / 2)
    .quadraticCurveTo(mx + nx * w * 0.3, my + ny * w * 0.3, b.x, b.y)
    .quadraticCurveTo(mx - nx * w * 0.3, my - ny * w * 0.3, a.x - nx * w / 2, a.y - ny * w / 2)
    .closePath();
}

/** A clawed hand: three hooked talons fanned from `base` toward `aim`
 *  (radians), `len` long. Filled dark by the caller, rimmed in violet. */
function hand(g: Graphics, base: Pt, aim: number, len: number, hook: number, fill: boolean, a: number) {
  for (let i = -1; i <= 1; i++) {
    const q = aim + i * 0.32, o = { x: base.x - Math.sin(aim) * i * len * 0.12, y: base.y + Math.cos(aim) * i * len * 0.12 };
    const tip = { x: o.x + Math.cos(q) * len * (1 - 0.12 * Math.abs(i)), y: o.y + Math.sin(q) * len * (1 - 0.12 * Math.abs(i)) };
    strand(g, o, tip, len * 0.24, len * 0.22 * hook);
    if (fill) g.fill({ color: INK, alpha: 0.9 * a });
    else g.stroke({ width: 1.5, color: LILAC, alpha: 0.85 * a, join: "round" });
  }
}

/** A claw wound along a curve (`c` = p0, control, p2): sharp at both ends,
 *  widest mid-way, laid down up to `drawn` of its length so it tears across
 *  rather than appearing. Returns the point it has reached. */
function gash(g: Graphics, c: number[], w: number, drawn: number, color: number, alpha: number) {
  if (drawn <= 0 || alpha <= 0.01) return;
  const n = 12, left: number[] = [], right: number[] = [];
  for (let i = 0; i <= n; i++) {
    const s = (i / n) * drawn, q = 1 - s;
    const x = q * q * c[0] + 2 * q * s * c[2] + s * s * c[4], y = q * q * c[1] + 2 * q * s * c[3] + s * s * c[5];
    const tx = q * (c[2] - c[0]) + s * (c[4] - c[2]), ty = q * (c[3] - c[1]) + s * (c[5] - c[3]), tl = Math.hypot(tx, ty) || 1;
    const hw = (w / 2) * Math.pow(Math.sin(Math.PI * Math.min(1, s * 0.9 + 0.05)), 0.6);
    left.push(x - (ty / tl) * hw, y + (tx / tl) * hw);
    right.push(x + (ty / tl) * hw, y - (tx / tl) * hw);
  }
  for (let i = n; i >= 0; i--) left.push(right[2 * i], right[2 * i + 1]);
  g.poly(left).fill({ color, alpha });
}
const onCurve = (c: number[], s: number): Pt => {
  const q = 1 - s;
  return { x: q * q * c[0] + 2 * q * s * c[2] + s * s * c[4], y: q * q * c[1] + 2 * q * s * c[3] + s * s * c[5] };
};

// ── The soul ────────────────────────────────────────────────────────────────

/** A wailing ghost at `head`, its body streaming back toward `tail`: a
 *  round head with hollow eyes and an open mouth, a shroud tapering into a
 *  wavering tail, two arms reaching back for what it was torn out of.
 *  `r` is the head's radius. */
function ghost(g: Graphics, head: Pt, tail: Pt, r: number, time: number, a: number) {
  if (a <= 0.01 || r < 1) return;
  const dx = tail.x - head.x, dy = tail.y - head.y, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, nx = -uy, ny = ux;
  // The shroud: wide under the head, narrowing down a waving spine.
  const N = 10, left: number[] = [], right: number[] = [];
  for (let i = 0; i <= N; i++) {
    const f = i / N, wave = r * 0.5 * f * Math.sin(time * 14 - f * 6);
    const x = head.x + dx * f + nx * wave, y = head.y + dy * f + ny * wave, w = r * 1.05 * (1 - f) + r * 0.1;
    left.push(x + nx * w, y + ny * w);
    right.unshift(x - nx * w, y - ny * w);
  }
  const body = left.concat(right);
  g.poly(body).fill({ color: FROST, alpha: 0.35 * a });
  g.poly(body).stroke({ width: 1.5, color: ICE, alpha: 0.8 * a, join: "round" });
  // Arms, reaching back.
  for (const sd of [-1, 1]) {
    const o = { x: head.x + ux * r * 1.1 + nx * sd * r * 0.9, y: head.y + uy * r * 1.1 + ny * sd * r * 0.9 };
    const h = { x: o.x + ux * r * 1.3 + nx * sd * r * (0.9 + 0.3 * Math.sin(time * 18 + sd)), y: o.y + uy * r * 1.3 + ny * sd * r * (0.9 + 0.3 * Math.sin(time * 18 + sd)) };
    g.moveTo(o.x, o.y).lineTo(h.x, h.y).stroke({ width: r * 0.32, color: ICE, alpha: 0.7 * a, cap: "round" });
  }
  // The head, cold white, the face cut out of it: hollow eyes, a wailing
  // mouth, set on the side away from its tail.
  const fx = -ux, fy = -uy, side = { x: -fy, y: fx };
  const eye = (k: number): Pt => ({ x: head.x + fx * r * 0.12 + side.x * k * r * 0.36, y: head.y + fy * r * 0.12 + side.y * k * r * 0.36 });
  g.circle(head.x, head.y, r * 1.6).fill({ color: ICE, alpha: 0.18 * a });
  g.circle(head.x, head.y, r).fill({ color: SOUL, alpha: 0.9 * a });
  const e1 = eye(-1), e2 = eye(1), mo = { x: head.x - fx * r * 0.42, y: head.y - fy * r * 0.42 };
  g.circle(e1.x, e1.y, r * 0.22).cut();
  g.circle(e2.x, e2.y, r * 0.22).cut();
  g.ellipse(mo.x, mo.y, r * 0.18, r * 0.28).cut();
}

export const NIGHTFANG: Signature = {
  shake: 1.1,
  // It does not close: the claws reach, and the soul is dragged back to it.
  lunge: false,

  deliver(t: FxTools, m: SigMoment, seconds: number) {
    const T = seconds, s = m.size, c = centre(m.from), seed = rand(0, TAU);
    const p = m.targets.length ? centre(m.targets[0]) : { x: c.x + m.ahead.x * s, y: c.y + m.ahead.y * s };
    const dir = unit(p.x - c.x, p.y - c.y, m.ahead), aim = Math.atan2(dir.y, dir.x), nx = -dir.y, ny = dir.x;

    // THE SHADOW swells over its card, ragged with fur round its edge.
    const tufts = Array.from({ length: 11 }, (_, i) => ({ a: seed + (i / 11) * TAU + rand(-0.2, 0.2), len: rand(0.22, 0.36), ph: rand(0, TAU) }));
    const R = (u: number) => s * 0.52 * easeOut(span(u, 0, 0.45));
    const tuft = (u: number, f: (typeof tufts)[number]) => {
      const r = R(u), q = f.a + 0.12 * Math.sin(u * T * 9 + f.ph);
      return { a: { x: c.x + Math.cos(f.a) * r * 0.75, y: c.y + Math.sin(f.a) * r * 0.75 },
        b: { x: c.x + Math.cos(q) * (r + s * f.len * span(u, 0.1, 0.6)), y: c.y + Math.sin(q) * (r + s * f.len * span(u, 0.1, 0.6)) } };
    };
    // The hands: either side of it, rising and drawing back from the target.
    const handAt = (u: number, sd: number) => {
      const k = easeOut(span(u, 0.15, 0.85));
      return {
        base: { x: c.x + nx * sd * s * (0.3 + 0.12 * k) - dir.x * s * (0.05 + 0.22 * k), y: c.y + ny * sd * s * (0.3 + 0.12 * k) - dir.y * s * (0.05 + 0.22 * k) },
        aim: aim + sd * (0.25 + 0.35 * k), len: s * (0.24 + 0.22 * span(u, 0.15, 0.6)), a: span(u, 0.15, 0.35),
      };
    };
    t.draw(T, (g, u) => {
      blot(g, c.x, c.y, R(u), 0.62, seed);
      for (const f of tufts) { const q = tuft(u, f); strand(g, q.a, q.b, s * 0.09, s * 0.04).fill({ color: INK, alpha: 0.75 }); }
      for (const sd of [-1, 1]) { const h = handAt(u, sd); hand(g, h.base, h.aim, h.len, sd, true, h.a); }
    }, { dark: true });
    t.draw(T, (g, u) => {
      const time = u * T, r = R(u);
      if (r > 1) g.circle(c.x, c.y, r * 0.95).stroke({ width: 1.5, color: VIOLET, alpha: 0.55 });
      for (const f of tufts) { const q = tuft(u, f); strand(g, q.a, q.b, s * 0.09, s * 0.04).stroke({ width: 1, color: LILAC, alpha: 0.45 }); }
      for (const sd of [-1, 1]) { const h = handAt(u, sd); hand(g, h.base, h.aim, h.len, sd, false, h.a); }
      // The eyes open in it — slanted, burning — over a pair of fangs.
      const open = easeOut(span(u, 0.2, 0.55)) * (0.85 + 0.15 * Math.sin(time * 20));
      if (open > 0.02) {
        const ey = c.y - s * 0.1, ew = s * 0.13, eh = s * 0.06 * open;
        for (const sd of [-1, 1]) {
          const ex = c.x + sd * s * 0.13, inner = ex - sd * ew * 0.5, outer = ex + sd * ew * 0.5;
          g.circle(ex, ey, s * 0.13).fill({ color: VIOLET, alpha: 0.3 * open });
          g.poly([inner, ey + eh * 0.6, ex, ey - eh * 0.9, outer, ey - eh * 1.2, ex, ey + eh * 0.7]).fill({ color: PALE, alpha: 0.95 });
        }
        const fy = c.y + s * 0.06, fl = s * 0.13 * open;
        for (const sd of [-1, 1]) g.poly([c.x + sd * s * 0.1, fy, c.x + sd * s * 0.04, fy, c.x + sd * s * 0.075, fy + fl]).fill({ color: PALE, alpha: 0.85 * open });
      }
    });
    // Shadow drawn in round it as it wakes.
    for (let i = 0; i < Math.round(14 * t.quality); i++) {
      const a = rand(0, TAU), r = s * rand(0.55, 0.8), l = rand(0.2, T * 0.6), v = r / l;
      t.later(rand(0, T * 0.3), () => t.spark(c.x + Math.cos(a) * r, c.y + Math.sin(a) * r, -Math.cos(a) * v - Math.sin(a) * v * 0.4,
        -Math.sin(a) * v + Math.cos(a) * v * 0.4, l, MOTE_IN, c));
    }
  },

  land(t: FxTools, m: SigMoment) {
    const s = m.size, k = s / 90, c = centre(m.from), seed = rand(0, TAU);
    if (!m.targets.length) { fold(t, m.from, seed); return; }
    const r = m.targets[0], p = centre(r), kk = Math.max(0.8, Math.min(1.6, m.power[0] ?? 1)), killed = !!m.killed[0];
    const dir = unit(p.x - c.x, p.y - c.y, m.ahead);

    // THE RAKES: three talons torn through the card one after another,
    // along the line of the blow and a little across it.
    const ra = Math.atan2(dir.y, dir.x) + 0.55, ux = Math.cos(ra), uy = Math.sin(ra), nx = -uy, ny = ux;
    const L = s * 0.5 * Math.min(1.25, kk), gap = s * 0.17, bow = L * 0.18;
    const cuts = [-1, 0, 1].map((j) => {
      const mx = p.x + nx * gap * j - ux * s * 0.04 * j, my = p.y + ny * gap * j - uy * s * 0.04 * j;
      return [mx - ux * L, my - uy * L, mx + nx * bow, my + ny * bow, mx + ux * L, my + uy * L];
    });
    const STAG = 0.045, DRAW = 0.09;
    const drawn = (time: number, j: number) => easeOut(span(time, j * STAG, j * STAG + DRAW));
    const RD = 0.75;
    t.draw(RD, (g, u) => {
      const time = u * RD, f = 1 - span(time, 0.4, RD);
      cuts.forEach((cut, j) => gash(g, cut, s * 0.15 * kk, drawn(time, j), INK, 0.78 * f));
      // The talon at the head of each cut while it is cutting.
      cuts.forEach((cut, j) => {
        const d = drawn(time, j), a = span(time, j * STAG, j * STAG + 0.02) * (1 - span(time, j * STAG + DRAW, j * STAG + DRAW + 0.08));
        if (a <= 0.01) return;
        const h = onCurve(cut, d), b = onCurve(cut, Math.max(0, d - 0.3));
        strand(g, b, h, s * 0.11, s * 0.05).fill({ color: INK, alpha: 0.9 * a });
      });
    }, { dark: true });
    t.draw(RD, (g, u) => {
      const time = u * RD, f = 1 - span(time, 0.3, RD);
      cuts.forEach((cut, j) => {
        gash(g, cut, s * 0.065 * kk, drawn(time, j), VIOLET, 0.95 * f);
        gash(g, cut, 2, drawn(time, j), PALE, f);
        const d = drawn(time, j), a = span(time, j * STAG, j * STAG + 0.02) * (1 - span(time, j * STAG + DRAW, j * STAG + DRAW + 0.08));
        if (a > 0.01) {
          const h = onCurve(cut, d), b = onCurve(cut, Math.max(0, d - 0.3));
          strand(g, b, h, s * 0.11, s * 0.05).stroke({ width: 1.5, color: LILAC, alpha: 0.9 * a });
        }
      });
    });
    cuts.forEach((cut, j) => t.later(j * STAG + DRAW * 0.8, () => {
      const e = onCurve(cut, 0.9);
      for (let i = 0; i < Math.round(5 * kk * t.quality); i++) {
        const a = ra + rand(-0.3, 0.3), v = rand(120, 260) * k;
        t.spark(e.x, e.y, Math.cos(a) * v, Math.sin(a) * v, rand(0.2, 0.4), SHRED);
      }
    }));
    t.later(0.05, () => t.flash(p, VIOLET, 0.35 + 0.1 * kk));

    // THE SOUL: torn out of the wounds, hanging a beat over the card, then
    // dragged back through the air into Nightfang — the light pulled in.
    const OUT = 0.12, HANG = 0.27, HOME = 0.52;
    const size = s * (killed ? 0.17 : 0.125) * Math.min(1.2, kk);
    const lift = { x: p.x - dir.x * s * 0.15, y: p.y - dir.y * s * 0.15 - s * 0.3 };
    const ctrl = { x: (lift.x + c.x) / 2 - dir.y * s * 0.35, y: (lift.y + c.y) / 2 + dir.x * s * 0.35 - s * 0.2 };
    const headAt = (time: number): Pt => {
      if (time < HANG) {
        const e = easeOut(span(time, OUT, HANG));
        return { x: p.x + (lift.x - p.x) * e, y: p.y + (lift.y - p.y) * e };
      }
      const w = span(time, HANG, HOME), v = w * w * (3 - 2 * w) * 0.6 + easeIn(w) * 0.4, q = 1 - v;
      return { x: q * q * lift.x + 2 * q * v * ctrl.x + v * v * c.x, y: q * q * lift.y + 2 * q * v * ctrl.y + v * v * c.y };
    };
    const SD = HOME + 0.02;
    let shed = 0;
    t.draw(SD, (g, u, dt) => {
      const time = u * SD;
      if (time < OUT) return;
      const h = headAt(time), back = headAt(Math.max(OUT, time - 0.07));
      // The tail streams behind it — out of the card at first, then along
      // the way it has come — longer the faster it goes.
      const tl = unit(back.x - h.x, back.y - h.y, { x: p.x - h.x, y: p.y - h.y });
      const stretch = time < HANG ? Math.max(size * 3, Math.hypot(p.x - h.x, p.y - h.y)) : size * (3 + 4 * span(time, HANG, HOME));
      const tail = { x: h.x + tl.x * stretch, y: h.y + tl.y * stretch };
      const a = span(time, OUT, OUT + 0.06) * (1 - span(time, HOME - 0.05, HOME));
      const sz = size * (0.5 + 0.5 * easeOut(span(time, OUT, HANG))) * (1 - 0.45 * span(time, HOME - 0.12, HOME));
      // The thread that still ties it to the card — and snaps (on a kill
      // there is none: nothing is left holding it).
      if (!killed && time < HANG + 0.08) {
        const ta = 1 - span(time, HANG, HANG + 0.08);
        g.moveTo(tail.x, tail.y).lineTo(p.x, p.y).stroke({ width: 1.5, color: ICE, alpha: 0.75 * ta });
      }
      ghost(g, h, tail, sz, time, a);
      if (time > HANG) {
        shed += dt * 50 * t.quality;
        for (; shed >= 1; shed--) t.spark(tail.x + rand(-1, 1) * sz, tail.y + rand(-1, 1) * sz, rand(-20, 20) * k, rand(-20, 20) * k, rand(0.25, 0.45), WISP);
      }
    });
    // Where the thread snapped, a cold flick off the card.
    if (!killed) t.later(HANG + 0.02, () => t.ring(r, ICE, 0.25, 0.7, 0.25, 2));
    // Swallowed: a cold ring closing on Nightfang, and a glint.
    t.later(HOME - 0.04, () => {
      t.ring(m.from, ICE, 1.0, 0.2, 0.22, 2.5);
      t.flash(c, ICE, 0.35);
    });

    // On a kill, the card it came out of goes grey: nothing left in it.
    if (killed) {
      t.draw(0.95, (g, u) => {
        const a = span(u, 0.2, 0.4) * (1 - span(u, 0.75, 1));
        g.roundRect(r.x + 2, r.y + 2, r.w - 4, r.h - 4, Math.min(r.w, r.h) * 0.08).fill({ color: ASH, alpha: 0.55 * a });
      }, { dark: true });
      t.later(0.4, () => t.emit({ count: 8, palette: [0xd8d4e0, 0xa8a4b4, 0x6e6a7a], from: { x: r.x + r.w * 0.2, y: r.y + r.h * 0.2, w: r.w * 0.6, h: r.h * 0.6 },
        dir: [-110, -70], speed: [15, 45], gravity: -30, drag: 0.5, life: [0.4, 0.6], size: [3, 8] }));
    }

    // THE FOLD: the shadow closes over Nightfang's own card, and it is gone.
    t.later(HOME - 0.02, () => fold(t, m.from, seed));
  },
};

/** STEALTH: shadow folds in over the card from every side — strands of it
 *  closing like fur over a face, a ragged violet edge shrinking to nothing —
 *  holds a beat and thins away to smoke, its violet eyes the last to go. */
function fold(t: FxTools, r: Box, seed: number) {
  const c = centre(r), s = Math.min(r.w, r.h), k = s / 90, R = s * 0.64;
  const strands = Array.from({ length: 14 }, (_, i) => ({ a: seed + (i / 14) * TAU + rand(-0.1, 0.1), bow: rand(-1, 1) }));
  const D = 0.48;
  const reach = (u: number) => R * (1 - easeOut(span(u, 0, 0.32)));
  const fade = (u: number) => 1 - span(u, 0.5, 1);
  /** The closing edge: ragged, turning as it shrinks. */
  const edge = (u: number) => {
    const out: number[] = [], rr = reach(u);
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * TAU, w = rr * (1 + 0.16 * Math.sin(7 * a + seed + u * 9) + 0.08 * Math.sin(13 * a - u * 14));
      out.push(c.x + Math.cos(a + u * 2) * w, c.y + Math.sin(a + u * 2) * w);
    }
    return out;
  };
  t.draw(D, (g, u) => {
    const a = fade(u);
    if (a <= 0.01) return;
    const inner = reach(u);
    for (const st of strands) {
      const p0 = { x: c.x + Math.cos(st.a) * R, y: c.y + Math.sin(st.a) * R };
      const p1 = { x: c.x + Math.cos(st.a + 0.35) * inner, y: c.y + Math.sin(st.a + 0.35) * inner };
      strand(g, p0, p1, s * 0.48, st.bow * s * 0.08).fill({ color: INK, alpha: 0.55 * a });
    }
    blot(g, c.x, c.y, s * 0.55 * span(u, 0.22, 0.4), 0.5 * a, seed);
  }, { dark: true });
  t.draw(D, (g, u) => {
    const a = fade(u);
    if (a <= 0.01) return;
    g.circle(c.x, c.y, R).stroke({ width: 1.5, color: LILAC, alpha: 0.5 * a });
    if (u < 0.32) g.poly(edge(u)).stroke({ width: 2, color: VIOLET, alpha: 0.85 * (1 - span(u, 0.22, 0.32)), join: "round" });
    // The eyes, last, in the dark.
    const e = span(u, 0.28, 0.42) * (1 - span(u, 0.6, 0.95));
    if (e > 0.01) for (const sd of [-1, 1]) {
      g.circle(c.x + sd * s * 0.12, c.y - s * 0.08, s * 0.06).fill({ color: VIOLET, alpha: 0.35 * e });
      g.circle(c.x + sd * s * 0.12, c.y - s * 0.08, s * 0.025).fill({ color: PALE, alpha: e });
    }
  });
  t.later(D * 0.5, () => {
    for (let i = 0; i < Math.round(10 * t.quality); i++)
      t.spark(c.x + rand(-0.35, 0.35) * s, c.y + rand(-0.3, 0.3) * s, rand(-20, 20) * k, -rand(20, 60) * k, rand(0.35, 0.6), SMOKE);
  });
}
