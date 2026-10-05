/** ZOMBINATION — Toxic Eruption. "Deal 4 DOT for 3 rounds to every opponent
 *  in range. Anything that dies while it runs rises as your Zombie." Whatever
 *  dies of it rises as a Zombie.
 *
 *  The art is a hulking corpse-giant of rotten flesh and spikes, vomiting a
 *  torrent of toxic GREEN plague-gas, zombies clawing up out of the ground at
 *  its feet under a blood moon. So the DELIVERY is the giant filling up: its
 *  body SWELLS (a lumpy green outline bulging round its card, throbbing
 *  twice), cracks split open across it with plague-light seeping out of them,
 *  and bubbles of gas rise off it.
 *
 *  The LANDING is the ERUPTION. A burst of plague-gas blows out of it — a
 *  green flash and a shock ring, then thick rolling clouds (dark green-black
 *  bodies, a sickly bright rim along their tops) that boil out round it and
 *  ROLL over every opponent in reach, settling on each card as a green miasma
 *  that bubbles and fumes (the DOT). And at each target's feet rotten zombie
 *  HANDS claw up out of the ground — dark, green-lit, fingers hooked — grasp
 *  at the card and sink back: the zombies to come. A kill drags up a third.
 *
 *  Plague green, never DUSK's violet, and not SkullKing's yellowed ghost-fire
 *  either: this is a neon, toxic green, heavy rolling gas rather than wisps.
 *  The clouds' bodies and the hands are dark for real (`dark: true`) with a
 *  green rim, so they read over an empty square. The hands always reach UP
 *  the screen from the bottom edge of the card, whichever way the board faces
 *  — a hand reaching up out of the ground only reads one way up. */
import { centre, rand } from "../../looks/base";
import type { Graphics } from "pixi.js";
import type { FxTools, Pt, SparkStyle } from "../../looks/types";
import type { Signature, SigMoment } from "../types";

type Box = SigMoment["from"];

const TAU = Math.PI * 2;
/** Plague-light: a near-white green, bile, a toxic neon, a deeper green. */
const PALE = 0xf0ffd2, BILE = 0xd4ff6a, TOX = 0x8cff3a, GREEN = 0x4ccf3a;
/** The gas's body and the rotten hands: a green-black. Dark layer only. */
const INK = 0x061206;
/** Gas fuming up off a poisoned card: swelling as it thins. */
const FUME: SparkStyle = { palette: [PALE, BILE, TOX, GREEN], gravity: -70, drag: 0.5, size: [4, 11], streak: false, swirl: 60 };
/** Bubbles seeping off the swelling giant. */
const BUBBLE: SparkStyle = { palette: [PALE, TOX, GREEN], gravity: -110, drag: 0.6, size: [3.5, 2], streak: false };
/** Clods of grave dirt thrown up by a hand breaking the ground. */
const CLOD: SparkStyle = { palette: [0xc8e6a0, 0x7aa05a, 0x4a6a34], gravity: 650, drag: 0.6, size: [3.5, 2], streak: false };

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeOut = (x: number) => 1 - (1 - x) * (1 - x);
/** 0 -> 1 as `u` runs from `a` to `b`. */
const span = (u: number, a: number, b: number) => clamp01((u - a) / (b - a));

/** A glow sized to the board's squares (`flash` is sized in px). */
function flare(t: FxTools, p: Pt, size: number, color: number, peak: number, seconds: number) {
  t.glow({ x: p.x - size / 2, y: p.y - size / 2, w: size, h: size }, color, peak, seconds, 1);
}

/** A lumpy closed outline round `c`, `r` across, its lumps rolling with
 *  `time`: a swollen body, or a cloud. Flat points. */
function blob(c: Pt, r: number, time: number, seed: number, lumps = 5, depth = 0.09): number[] {
  const pts: number[] = [];
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * TAU;
    const rr = r * (1 + depth * Math.sin(lumps * a + seed + time * 4) + depth * 0.6 * Math.sin((lumps + 3) * a - seed - time * 6));
    pts.push(c.x + Math.cos(a) * rr, c.y + Math.sin(a) * rr);
  }
  return pts;
}

// ── The swelling ────────────────────────────────────────────────────────────

/** A crack across the giant: a jagged run out from near its middle. */
function crackPts(c: Pt, ang: number, len: number): number[] {
  const pts = [c.x + Math.cos(ang) * len * 0.12, c.y + Math.sin(ang) * len * 0.12];
  let x = pts[0], y = pts[1], a = ang;
  for (let i = 0; i < 4; i++) {
    a += rand(-0.55, 0.55);
    x += (Math.cos(a) * len) / 4;
    y += (Math.sin(a) * len) / 4;
    pts.push(x, y);
  }
  return pts;
}

/** Traces flat points up to fraction `f` of their length. */
function trace(g: Graphics, p: number[], f: number) {
  const n = p.length / 2, reach = f * (n - 1), full = Math.min(n - 1, Math.floor(reach));
  g.moveTo(p[0], p[1]);
  for (let i = 1; i <= full; i++) g.lineTo(p[i * 2], p[i * 2 + 1]);
  const frac = reach - full;
  if (frac > 0 && full + 1 < n) {
    const i = full * 2;
    g.lineTo(p[i] + (p[i + 2] - p[i]) * frac, p[i + 1] + (p[i + 3] - p[i + 1]) * frac);
  }
}

// ── The gas ─────────────────────────────────────────────────────────────────

/** One rolling puff of plague-gas: where it starts and comes to rest, when
 *  it leaves and how long it flies, and how big it grows. */
interface Puff { a: Pt; b: Pt; go: number; fly: number; r0: number; r1: number; seed: number; end: number }

/** Where a puff is at `time`, how big and how thick (0 before it leaves). */
function puffAt(p: Puff, time: number): { x: number; y: number; r: number; a: number } {
  const q = (time - p.go) / p.fly;
  if (q <= 0) return { x: p.a.x, y: p.a.y, r: 0, a: 0 };
  const e = easeOut(clamp01(q)), settle = Math.max(0, time - p.go - p.fly);
  // Rolling in, then drifting a little and rising as it settles and thins.
  const x = p.a.x + (p.b.x - p.a.x) * e + Math.sin(p.seed + time * 3) * p.r1 * 0.1;
  const y = p.a.y + (p.b.y - p.a.y) * e - settle * p.r1 * 0.5;
  const r = p.r0 + (p.r1 - p.r0) * easeOut(clamp01(q * 0.8)) + settle * p.r1 * 0.25;
  return { x, y, r, a: clamp01(q * 5) * (1 - span(time, p.end - 0.3, p.end)) };
}

/** The gas, dark half: each puff's green-black body. */
function gasDark(g: Graphics, puffs: Puff[], time: number) {
  for (const p of puffs) {
    const q = puffAt(p, time);
    if (q.a <= 0.01) continue;
    // Soft at the edge, thick in the middle: gas, not a ball.
    g.poly(blob(q, q.r, time, p.seed, 4, 0.08), true).fill({ color: INK, alpha: 0.3 * q.a });
    g.poly(blob(q, q.r * 0.72, time, p.seed + 1, 4, 0.08), true).fill({ color: INK, alpha: 0.3 * q.a });
  }
}

/** ...and lit: a sickly green through each body, a bright rim along its top
 *  (lit from the plague-light above), turning as the cloud rolls. */
function gasLit(g: Graphics, puffs: Puff[], time: number) {
  for (const p of puffs) {
    const q = puffAt(p, time);
    if (q.a <= 0.01) continue;
    g.poly(blob(q, q.r * 1.08, time, p.seed, 4, 0.08), true).fill({ color: GREEN, alpha: 0.1 * q.a });
    g.poly(blob(q, q.r * 0.8, time, p.seed + 1, 4, 0.08), true).fill({ color: GREEN, alpha: 0.11 * q.a });
    g.poly(blob(q, q.r * 0.5, time, p.seed + 2, 4, 0.08), true).fill({ color: TOX, alpha: 0.1 * q.a });
    // The rim: an arc over its top, rolling as it turns. (Move to its start
    // first, or the arc is joined to wherever the pen last was.)
    const roll = p.seed + time * 2.2, a0 = Math.PI + 0.35 + Math.sin(roll) * 0.35, a1 = a0 + Math.PI * 0.75, rr = q.r * 0.95;
    g.moveTo(q.x + Math.cos(a0) * rr, q.y + Math.sin(a0) * rr).arc(q.x, q.y, rr, a0, a1)
      .stroke({ width: Math.max(1.5, q.r * 0.08), color: BILE, alpha: 0.6 * q.a, cap: "round" });
  }
}

// ── The hands ───────────────────────────────────────────────────────────────

/** A rotten hand reaching up out of the ground: flat points round forearm,
 *  palm, thumb and four fingers, palm to the viewer. `base` is where it
 *  breaks the ground, `H` its height out (px), `up` how far it has come up
 *  (0..1, squashed into the ground below that), `curl` (0..1) hooks the
 *  fingers into claws, `lean` tilts it, `sx` mirrors it (a left hand). */
function handPts(base: Pt, H: number, up: number, curl: number, lean: number, sx: number): number[] {
  const R = { x: Math.cos(lean), y: Math.sin(lean) }, U = { x: Math.sin(lean), y: -Math.cos(lean) };
  const out: number[] = [];
  const put = (u: number, v: number) => out.push(base.x + (R.x * u * sx + U.x * v * up) * H, base.y + (R.y * u * sx + U.y * v * up) * H);
  put(-0.11, 0); put(-0.09, 0.3); put(-0.15, 0.44);
  // The thumb, hooking in.
  const ta = 2.3 - curl * 0.7;
  put(-0.21, 0.48); put(-0.21 + Math.cos(ta) * 0.18, 0.48 + Math.sin(ta) * 0.18); put(-0.14, 0.58);
  // Four fingers off the top of the palm, splayed, each bent at the knuckle
  // and hooked at the tip as it claws.
  const lens = [0.3, 0.36, 0.33, 0.26];
  for (let i = 0; i < 4; i++) {
    const bx = -0.11 + i * 0.075, w = 0.036, v0 = 0.64, spread = (i - 1.5) * 0.16;
    const a1 = Math.PI / 2 - spread, a2 = a1 + 0.5 + curl * 1.1, L = lens[i] * (1 - 0.25 * curl);
    const kx = bx + Math.cos(a1) * L * 0.55, ky = v0 + Math.sin(a1) * L * 0.55;
    const tx = kx + Math.cos(a2) * L * 0.5, ty = ky + Math.sin(a2) * L * 0.5;
    put(bx - w, v0); put(kx - w * 0.8, ky); put(tx, ty); put(kx + w * 0.8, ky - w * 0.3); put(bx + w, v0 - 0.01);
  }
  put(0.15, 0.46); put(0.09, 0.3); put(0.11, 0);
  return out;
}

/** A zombie hand at a card's feet: it breaks the ground (a burst of grave
 *  dirt and a dark mound), comes up open and reaching, CLAWS, and sinks
 *  back. Dark, rimmed in plague-green. */
function hand(t: FxTools, base: Pt, s: number, H: number, sx: number, delay: number) {
  const RISE = 0.16, CLAW = 0.3, SINK = 0.2, D = RISE + CLAW + SINK, lean = rand(-0.25, 0.25) * sx, v = s / 90;
  const state = (u: number) => {
    const time = u * D;
    const up = time < RISE ? easeOut(time / RISE) : 1 - easeOut(span(time, RISE + CLAW, D)) * 0.92;
    const curl = Math.sin(Math.PI * span(time, RISE * 0.7, RISE + CLAW)) * 0.9 + 0.1;
    const sway = Math.sin(time * 18) * 0.06 * (1 - span(time, RISE + CLAW, D));
    return { up, curl, lean: lean + sway, a: 1 - span(time, D - 0.08, D) };
  };
  const mound = (g: Graphics, a: number) => g.ellipse(base.x, base.y, s * 0.13, s * 0.04).fill({ color: INK, alpha: 0.8 * a });
  t.draw(D, (g, u) => {
    const st = state(u);
    mound(g, st.a);
    g.poly(handPts(base, H, st.up, st.curl, st.lean, sx), true).fill({ color: INK, alpha: 0.92 * st.a });
  }, { dark: true, delay });
  t.draw(D, (g, u) => {
    const st = state(u), pts = handPts(base, H, st.up, st.curl, st.lean, sx);
    g.ellipse(base.x, base.y, s * 0.13, s * 0.04).stroke({ width: 1.2, color: GREEN, alpha: 0.7 * st.a });
    g.poly(pts, true).stroke({ width: 4, color: GREEN, alpha: 0.28 * st.a, join: "round" });
    g.poly(pts, true).stroke({ width: 1.4, color: BILE, alpha: 0.95 * st.a, join: "round" });
  }, { delay });
  t.later(delay, () => {
    for (let i = 0; i < Math.round(5 * t.quality) + 2; i++) {
      const a = -Math.PI / 2 + rand(-1, 1), sp = rand(70, 160) * v;
      t.spark(base.x + rand(-0.08, 0.08) * s, base.y, Math.cos(a) * sp, Math.sin(a) * sp, rand(0.3, 0.45), CLOD);
    }
  });
}

// ── The miasma settling on a card ──────────────────────────────────────────

/** A card the gas reached: a green bloom over it, plague bubbles swelling
 *  and popping on it, fumes rising off it — and the hands clawing up at its
 *  feet. */
function poison(t: FxTools, r: Box, s: number, k: number, killed: boolean, at: number) {
  const p = centre(r), v = s / 90;
  t.later(at, () => {
    flare(t, p, s * 1.15, TOX, 0.4 * k, 0.5);
    for (let i = 0; i < Math.round(8 * k); i++) {
      const a = rand(0, TAU), d = rand(0, 0.3) * s;
      t.spark(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, rand(-25, 25) * v, -rand(40, 100) * v, rand(0.45, 0.75), FUME, p);
    }
  });
  // Bubbles of plague swelling on the card and popping.
  const bubbles = Array.from({ length: 3 }, () => ({ x: rand(-0.3, 0.3) * s, y: rand(-0.3, 0.2) * s, go: at + rand(0.05, 0.3), r: s * rand(0.05, 0.08) }));
  t.draw(0.75, (g, u) => {
    const time = at + u * 0.75;
    for (const b of bubbles) {
      const q = span(time, b.go, b.go + 0.22);
      if (q <= 0 || q >= 1) continue;
      const rr = b.r * (0.4 + 0.6 * q), a = q < 0.85 ? 1 : 1 - (q - 0.85) / 0.15;
      g.circle(p.x + b.x, p.y + b.y, rr * (q > 0.85 ? 1.4 : 1)).stroke({ width: 1.4, color: BILE, alpha: 0.9 * a });
      g.circle(p.x + b.x - rr * 0.3, p.y + b.y - rr * 0.3, rr * 0.25).fill({ color: PALE, alpha: 0.8 * a });
    }
  }, { delay: at });
  // The hands, out of the ground along the card's bottom edge.
  const foot = p.y + s * 0.42, H = s * 0.68;
  hand(t, { x: p.x - s * 0.22, y: foot }, s, H, -1, at + 0.04);
  hand(t, { x: p.x + s * 0.22, y: foot }, s, H * 0.9, 1, at + 0.12);
  if (killed) hand(t, { x: p.x, y: foot + s * 0.02 }, s, H * 1.2, 1, at + 0.2);
}

export const ZOMBINATION: Signature = {
  shake: 1.1,
  // It erupts where it stands; the gas does the travelling.
  lunge: false,

  deliver(t: FxTools, m: SigMoment, seconds: number) {
    const T = seconds, c = centre(m.from), s = m.size, seed = rand(0, TAU), v = s / 90;
    // The body swelling, throbbing twice as the gas builds in it.
    const swell = (time: number) => {
      const u = time / T;
      return 0.44 + 0.1 * easeOut(u) + 0.035 * Math.max(0, Math.sin(u * Math.PI * 4 - 0.5));
    };
    t.draw(T, (g, u) => {
      const time = u * T, a = clamp01(time / 0.1);
      g.poly(blob(c, s * swell(time), time, seed, 5, 0.06), true).fill({ color: INK, alpha: 0.28 * a });
    }, { dark: true });
    // The cracks splitting open across it, plague-light in them.
    const cracks = Array.from({ length: 5 }, (_, i) => ({ pts: crackPts(c, seed + (i / 5) * TAU + rand(-0.3, 0.3), s * rand(0.32, 0.46)), at: rand(0, 0.35) }));
    let acc = 0;
    t.draw(T, (g, u, dt) => {
      const time = u * T, a = clamp01(time / 0.1);
      const outline = blob(c, s * swell(time), time, seed, 5, 0.06);
      g.poly(outline, true).stroke({ width: 6, color: GREEN, alpha: 0.22 * a, join: "round" });
      g.poly(outline, true).stroke({ width: 2, color: TOX, alpha: 0.85 * a, join: "round" });
      for (const cr of cracks) {
        const f = easeOut(span(u, cr.at, cr.at + 0.5));
        if (f <= 0) continue;
        trace(g, cr.pts, f);
        g.stroke({ width: 5, color: GREEN, alpha: 0.35, join: "round", cap: "round" });
        trace(g, cr.pts, f);
        g.stroke({ width: 1.6, color: PALE, alpha: 0.95, join: "round", cap: "round" });
      }
      // Gas seeping out of the cracks as bubbles, more as it fills.
      acc += dt * 30 * t.quality * (0.3 + u);
      for (; acc >= 1; acc--) {
        const cr = cracks[Math.floor(rand(0, cracks.length))], j = 2 * Math.floor(rand(1, cr.pts.length / 2));
        t.spark(cr.pts[j], cr.pts[j + 1], rand(-20, 20) * v, -rand(20, 60) * v, rand(0.3, 0.55), BUBBLE);
      }
    });
    t.charge(c, s * 1.2, TOX, 0.4, T);
  },

  land(t: FxTools, m: SigMoment) {
    const c = centre(m.from), s = m.size, END = 1.0;
    // THE BURST: a green flash and a shock ring off the giant.
    t.flash(c, BILE, 0.5 * (s / 80));
    t.ring(m.from, TOX, 0.4, 1.6, 0.3, 4);
    flare(t, c, s * 1.6, TOX, 0.5, 0.35);

    // THE GAS: clouds boiling out round it on every side...
    const n0 = Math.max(4, Math.round(7 * t.quality));
    const puffs: Puff[] = Array.from({ length: n0 }, (_, i) => {
      const a = (i / n0) * TAU + rand(-0.3, 0.3), d = s * rand(0.5, 0.75);
      return { a: c, b: { x: c.x + Math.cos(a) * d, y: c.y + Math.sin(a) * d }, go: rand(0, 0.04), fly: rand(0.25, 0.35), r0: s * 0.1, r1: s * rand(0.2, 0.27), seed: rand(0, TAU), end: END * rand(0.75, 0.9) };
    });
    // ...and rolling on over every card in reach, a few puffs to each, the
    // lead puff landing on the card's face.
    const per = Math.max(3, Math.round(5 * t.quality));
    const hits = m.targets.map((r, i) => {
      const p = centre(r), d = Math.hypot(p.x - c.x, p.y - c.y), fly = Math.min(0.34, 0.16 + 0.06 * (d / s));
      for (let j = 0; j < per; j++) {
        // The lead puff lands on the card's face; the rest roll in behind it,
        // strung back along the way it came, so the gas reads as one stream.
        const lead = j === 0, f = lead ? 1 : 1 - (j / per) * 0.6, off = lead ? 0 : rand(0.08, 0.2) * s, a = rand(0, TAU);
        puffs.push({ a: { x: c.x + (p.x - c.x) * 0.2, y: c.y + (p.y - c.y) * 0.2 },
          b: { x: c.x + (p.x - c.x) * f + Math.cos(a) * off, y: c.y + (p.y - c.y) * f + Math.sin(a) * off },
          go: 0.02 + j * 0.03, fly: fly * f + j * 0.02, r0: s * 0.14, r1: s * (lead ? 0.38 : rand(0.24, 0.32)), seed: rand(0, TAU), end: END * (lead ? 1 : rand(0.8, 0.95)) });
      }
      return { r, p, at: 0.02 + fly * 0.8, k: Math.max(0.8, Math.min(1.4, (m.power[i] ?? 1) + 0.35)), killed: m.killed[i] ?? false };
    });
    t.draw(END, (g, u) => gasDark(g, puffs, u * END), { dark: true });
    t.draw(END, (g, u) => gasLit(g, puffs, u * END));

    // Where the gas settles: the miasma on each card, and the hands.
    for (const h of hits) poison(t, h.r, s, h.k, h.killed, h.at);
  },
};
