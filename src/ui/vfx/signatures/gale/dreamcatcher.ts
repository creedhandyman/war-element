/** DREAMCATCHER — Soul Snare. "Every opponent in range falls asleep for a
 *  round and is WEAKENed for 3. No damage." Soul Snare puts the rest to
 *  sleep.
 *
 *  On her art Dreamcatcher is a feathered mystic in a coat of amber and
 *  violet feathers, a staff in her hand topped by a dreamcatcher — a hoop
 *  strung with a spiral web, feathers and beads hanging from it — and violet
 *  dream-smoke curling all round her. The DELIVERY is the staff waking: the
 *  hoop at its head glows, its web spinning violet light, smoke curling up
 *  off it; then, slowly, a thread of dream drifts out of the web to every
 *  opponent in range, a mote of violet light at its end, wavering as it goes.
 *
 *  The LANDING is the snare, and it never strikes. Over every card a thread
 *  reached, a dreamcatcher hoop comes down out of the air, turning, and
 *  settles round it, and its web is strung in front of your eyes — the thread
 *  spiralling in from the hoop to the bead at its heart. Its feathers and
 *  beads sway beneath it. A soft violet mist sinks over the card and the card
 *  dims under it (the sleep), and pale wisps lift off it and drift back toward
 *  Dreamcatcher: the soul snared. Then the hoop fades and the mist with it.
 *
 *  It is the quietest move in GALE on purpose: no flash, no burst, no shake,
 *  nothing fast — wind only as the slow drift that carries smoke and threads.
 *  The dimming is drawn for real (`dark: true`) under the hoop's light, so it
 *  reads as sleep over a card and still shows a lit hoop over an empty one. */
import { centre, rand } from "../../looks/base";
import type { Graphics } from "pixi.js";
import type { FxTools, Pt, SparkStyle } from "../../looks/types";
import type { Signature, SigMoment } from "../types";

type Box = SigMoment["from"];

const TAU = Math.PI * 2;
// Dream-light: deep violet to a near-white lilac, and the orchid of her smoke.
const DEEP = 0x5e34b8, VIOLET = 0xa274ff, LILAC = 0xd2b6ff, PALE = 0xf6efff, ORCHID = 0xd890ff;
// The hoop's wrapped wood and her amber feathers, warm against the violet.
const AMBER = 0xffb060, HONEY = 0xffd8a0;
/** The sleep's shadow, on the dark layer only. */
const DUSK = 0x0a0618;
/** Motes of a snared soul, drifting back to her: slow, curling, fading. */
const SOUL: SparkStyle = { palette: [PALE, LILAC, VIOLET, DEEP], gravity: -20, drag: 0.75, size: [4, 1.5], streak: false, swirl: 90 };
const SOUL_L: SparkStyle = { ...SOUL, swirl: -90 };

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeOut = (x: number) => 1 - (1 - x) * (1 - x);
const smooth = (x: number) => x * x * (3 - 2 * x);
/** In over `a`, held, out over the last `b` of 0..1. */
const env = (u: number, a: number, b: number) => Math.max(0, Math.min(1, u / a, (1 - u) / b));

// ── The dreamcatcher ────────────────────────────────────────────────────────

/** The web: one thread spiralling in from the hoop, each turn's knots at the
 *  middles of the turn outside it — the way a dreamcatcher is strung. `done`
 *  0..1 is how much of it is strung, from the hoop inward. */
function web(g: Graphics, c: Pt, R: number, rot: number, done: number, a: number) {
  // Seven knots a turn, each turn's knots half a step on and pulled in, until
  // the thread leaves an open heart with the bead in it.
  const K = 7, M = K * 4, n = Math.max(1, Math.floor(done * M)), pts: number[] = [];
  for (let j = 0; j <= n; j++) {
    const ang = rot + (j * TAU) / K + ((j / K) * TAU) / (2 * K), rr = R * 0.98 * Math.pow(0.66, j / K);
    pts.push(c.x + Math.cos(ang) * rr, c.y + Math.sin(ang) * rr);
  }
  g.poly(pts, false).stroke({ width: 1.1, color: LILAC, alpha: 0.85 * a, join: "round" });
  if (done >= 0.98) g.circle(c.x, c.y, Math.max(1.5, R * 0.1)).fill({ color: ORCHID, alpha: 0.9 * a }).circle(c.x, c.y, Math.max(1, R * 0.05)).fill({ color: PALE, alpha: a });
}

/** The hoop itself: a soft violet glow under a lilac ring, wrapped in amber
 *  thread. */
function hoop(g: Graphics, c: Pt, R: number, rot: number, a: number) {
  g.circle(c.x, c.y, R).stroke({ width: Math.max(4, R * 0.22), color: VIOLET, alpha: 0.25 * a });
  g.circle(c.x, c.y, R).stroke({ width: 2, color: LILAC, alpha: 0.9 * a });
  for (let i = 0; i < 14; i++) {
    const ang = rot * 0.5 + (i / 14) * TAU, x = c.x + Math.cos(ang) * R, y = c.y + Math.sin(ang) * R;
    const ox = Math.cos(ang + 0.6) * R * 0.08, oy = Math.sin(ang + 0.6) * R * 0.08;
    g.moveTo(x - ox, y - oy).lineTo(x + ox, y + oy);
  }
  g.stroke({ width: 1.4, color: AMBER, alpha: 0.75 * a });
}

/** A hanging feather, its quill at (x, y), hanging along `ang`. */
function feather(g: Graphics, x: number, y: number, ang: number, len: number, color: number, a: number) {
  const ux = Math.cos(ang), uy = Math.sin(ang), nx = -uy, ny = ux, w = len * 0.2;
  g.poly([x, y, x + ux * len * 0.35 + nx * w, y + uy * len * 0.35 + ny * w, x + ux * len, y + uy * len,
    x + ux * len * 0.35 - nx * w, y + uy * len * 0.35 - ny * w]).fill({ color, alpha: 0.6 * a });
  g.moveTo(x, y).lineTo(x + ux * len * 0.95, y + uy * len * 0.95).stroke({ width: 1, color: HONEY, alpha: 0.8 * a });
}

/** Strands hanging from the hoop's bottom, swaying: a bead or two on each and
 *  a feather at its end — amber, violet, amber, like the ones on her staff. */
function strands(g: Graphics, c: Pt, R: number, time: number, a: number, ph: number) {
  for (let i = 0; i < 3; i++) {
    const base = Math.PI / 2 + (i - 1) * 0.45, x0 = c.x + Math.cos(base) * R, y0 = c.y + Math.sin(base) * R;
    const sway = Math.PI / 2 + 0.22 * Math.sin(time * 3.2 + ph + i * 1.3), len = R * (i === 1 ? 0.95 : 0.7);
    const ux = Math.cos(sway), uy = Math.sin(sway);
    g.moveTo(x0, y0).lineTo(x0 + ux * len, y0 + uy * len).stroke({ width: 1, color: LILAC, alpha: 0.6 * a });
    for (const f of i === 1 ? [0.35, 0.65] : [0.5])
      g.circle(x0 + ux * len * f, y0 + uy * len * f, Math.max(1.5, R * 0.07)).fill({ color: ORCHID, alpha: 0.9 * a });
    feather(g, x0 + ux * len, y0 + uy * len, sway + 0.1 * Math.sin(time * 4 + i), R * 0.55, i === 1 ? VIOLET : AMBER, a);
  }
}

/** Where the staff's hoop hangs on her card: up and to the left, as on her
 *  art (the art is never turned, so this is screen space, not "ahead"). */
const staffHead = (r: Box, s: number): Pt => ({ x: r.x + r.w / 2 - s * 0.26, y: r.y + r.h / 2 - s * 0.26 });

/** A thread of dream's way from her hoop to a card: drifting, wavering, dead
 *  on the card at the end. */
function drift(from: Pt, to: Pt) {
  const dx = to.x - from.x, dy = to.y - from.y, d = Math.hypot(dx, dy) || 1, nx = -dy / d, ny = dx / d;
  const amp = d * rand(0.06, 0.11) * (Math.random() < 0.5 ? -1 : 1), ph = rand(0, TAU);
  return (q: number): Pt => {
    const off = amp * Math.sin(Math.PI * q) * Math.sin(Math.PI * q * 2 + ph);
    return { x: from.x + dx * q + nx * off, y: from.y + dy * q + ny * off };
  };
}

export const DREAMCATCHER: Signature = {
  // No impact at all: it does not strike, it lulls.
  shake: 0,
  lunge: false,

  deliver(t: FxTools, m: SigMoment, seconds: number) {
    const s = m.size, T = seconds, h = staffHead(m.from, s), R = s * 0.17, D = T + 0.2;
    const rot0 = rand(0, TAU);
    // THE HOOP waking: glowing, its web spinning violet, strung and turning.
    t.charge(h, s * 0.8, VIOLET, 0.32, T);
    t.draw(D, (g, u) => {
      const time = u * D, a = clamp01(time / 0.12) * (1 - clamp01((time - T) / 0.2)), rot = rot0 + time * 4;
      // The staff below it, a faint warm line.
      g.moveTo(h.x, h.y + R).lineTo(h.x + s * 0.06, m.from.y + m.from.h * 0.92).stroke({ width: 2, color: AMBER, alpha: 0.35 * a });
      hoop(g, h, R, rot, a);
      web(g, h, R, rot, 1, a * (0.5 + 0.5 * clamp01(time / (T * 0.5))));
      strands(g, h, R, time, a, rot0);
    });
    // DREAM-SMOKE curling up off it: soft violet puffs, rising and turning.
    const puffs: { x: number; y: number; born: number; ph: number; dir: number }[] = [];
    let acc = 0;
    t.draw(D + 0.4, (g, u, dt) => {
      const time = u * (D + 0.4);
      if (time < T) {
        acc += dt * 16 * t.quality;
        for (; acc >= 1; acc--) puffs.push({ x: h.x + rand(-0.5, 0.5) * R, y: h.y + rand(-0.3, 0.6) * R, born: time, ph: rand(0, TAU), dir: Math.random() < 0.5 ? -1 : 1 });
      }
      for (const p of puffs) {
        const age = time - p.born, q = age / 0.9;
        if (q < 0 || q >= 1) continue;
        const x = p.x + p.dir * Math.sin(age * 3 + p.ph) * s * 0.08 * q, y = p.y - s * 0.4 * q, rr = s * (0.05 + 0.08 * q);
        const al = Math.sin(Math.PI * q);
        g.circle(x, y, rr).fill({ color: DEEP, alpha: 0.2 * al }).circle(x, y, rr * 0.5).fill({ color: ORCHID, alpha: 0.14 * al });
      }
    });
    // THE THREADS: let out slowly from the web to every card in range, each
    // with a mote of dream at its end that reaches its card on the landing
    // frame.
    const LET = T * 0.3, F = T - LET;
    m.targets.forEach((r) => {
      const path = drift(h, centre(r));
      t.draw(F + 0.25, (g, u) => {
        const time = u * (F + 0.25), q = smooth(clamp01(time / F)), fin = clamp01(time / 0.1) * (1 - clamp01((time - F) / 0.25));
        const pts: number[] = [];
        for (let k = 0; k <= 16; k++) {
          const p = path((q * k) / 16);
          pts.push(p.x, p.y);
        }
        g.poly(pts, false).stroke({ width: 1, color: LILAC, alpha: 0.45 * fin, join: "round" });
        const p = path(q);
        g.circle(p.x, p.y, s * 0.08).fill({ color: VIOLET, alpha: 0.25 * fin }).circle(p.x, p.y, s * 0.035).fill({ color: PALE, alpha: 0.9 * fin });
      }, { delay: LET });
    });
  },

  land(t: FxTools, m: SigMoment) {
    const s = m.size, home = staffHead(m.from, s);
    m.targets.forEach((r, i) => snare(t, r, home, s, m.power[i] ?? 0.55, i * 0.06));
  },
};

/** The snare on one card, `delay` in: a hoop settling round it, turning to
 *  rest as its web is strung inward; feathers and beads swaying under it; a
 *  violet mist sinking over the card as it dims; pale wisps lifting off it and
 *  drifting back toward Dreamcatcher (`home`). */
function snare(t: FxTools, r: Box, home: Pt, s: number, power: number, delay: number) {
  const c = centre(r), k = Math.max(0.55, Math.min(1.3, power)), R0 = s * 0.33 * (0.9 + 0.2 * k);
  const hc = { x: c.x, y: c.y - s * 0.07 }, rot0 = rand(0, TAU), ph = rand(0, TAU), D = 1.05;
  const at = (time: number) => {
    const settle = easeOut(clamp01(time / 0.42));
    return { R: R0 * (1.5 - 0.5 * settle), rot: rot0 + 1.8 * (1 - settle), a: clamp01(time / 0.16) * (1 - clamp01((time - 0.72) / 0.33)) };
  };
  // The sleep: the card dimmed under a soft shadow, deepest in the middle.
  t.draw(D, (g, u) => {
    const a = env(u, 0.3, 0.35);
    g.ellipse(c.x, c.y, s * 0.44, s * 0.46).fill({ color: DUSK, alpha: 0.22 * a }).ellipse(c.x, c.y, s * 0.3, s * 0.32).fill({ color: DUSK, alpha: 0.2 * a });
  }, { dark: true, delay });
  // The mist, sinking down over the card from above and spreading as it
  // settles.
  const mist = Array.from({ length: 5 }, (_, j) => ({ x: (j - 2) * s * 0.15 + rand(-4, 4), y0: -s * rand(0.35, 0.5), ph: rand(0, TAU), r: s * rand(0.12, 0.17) }));
  t.draw(D, (g, u) => {
    const time = u * D, a = env(u, 0.3, 0.4);
    for (const p of mist) {
      const q = easeOut(clamp01(time / 0.7)), y = c.y + p.y0 + (s * 0.42) * q, x = c.x + p.x * (1 + 0.3 * q) + Math.sin(time * 2 + p.ph) * s * 0.03;
      const rr = p.r * (1 + 0.5 * q);
      g.circle(x, y, rr).fill({ color: DEEP, alpha: 0.26 * a }).circle(x, y, rr * 0.55).fill({ color: VIOLET, alpha: 0.16 * a });
    }
  }, { delay });
  // THE HOOP, coming down turning and settling round the card, strung inward.
  t.draw(D, (g, u) => {
    const time = u * D, st = at(time);
    if (st.a <= 0.01) return;
    hoop(g, hc, st.R, st.rot, st.a);
    web(g, hc, st.R, st.rot, easeOut(clamp01((time - 0.05) / 0.45)), st.a);
    strands(g, hc, st.R, time, st.a, ph);
  }, { delay });
  t.glow(r, VIOLET, 0.18, 0.9, 1.05);
  // THE SOUL SNARED: wisps lifting off the card and drifting back toward
  // her, curling, thinning as they go.
  const dx = home.x - c.x, dy = home.y - c.y, d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d;
  const wisps = [-1, 0, 1].map((o) => ({ o, ph: rand(0, TAU), at: 0.3 + Math.abs(o) * 0.06 }));
  t.draw(D, (g, u) => {
    const time = u * D;
    for (const w of wisps) {
      const age = time - w.at;
      if (age <= 0) continue;
      const q = clamp01(age / 0.65), head = Math.min(d * 0.5, s * 1.4) * easeOut(q), tail = head * Math.max(0, (q - 0.25) / 0.75);
      const a = Math.sin(Math.PI * q), pts: number[] = [];
      for (let j = 0; j <= 10; j++) {
        const f = tail + ((head - tail) * j) / 10, wave = Math.sin(f / (s * 0.18) + w.ph + age * 5) * s * 0.07 + w.o * s * 0.14;
        pts.push(c.x + ux * f - uy * wave, c.y + uy * f + ux * wave);
      }
      if (head - tail > 1) g.poly(pts, false).stroke({ width: 1.6, color: PALE, alpha: 0.6 * a, cap: "round", join: "round" });
    }
  }, { delay });
  const n = Math.round(6 * t.quality) + 1;
  for (let j = 0; j < n; j++)
    t.later(delay + rand(0.3, 0.6), () => {
      const v = rand(50, 90) * (s / 90);
      t.spark(c.x + rand(-0.2, 0.2) * s, c.y + rand(-0.2, 0.2) * s, ux * v, uy * v, rand(0.6, 0.9), j % 2 ? SOUL : SOUL_L);
    });
}
