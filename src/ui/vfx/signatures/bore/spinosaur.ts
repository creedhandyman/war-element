/** SPINOSAUR — Tail Spin. "Sweep the tail through everything in reach: 6 DMG
 *  (PEN) each, and every one of them is knocked back a space." Its tail
 *  sweeps everything in reach for 6 through plate and knocks it back.
 *
 *  Its art is a great sail-backed dinosaur, BLUE crystal spines down its
 *  sail, whipping its tail round through a river bed in a huge curling spray
 *  of mud, water and rock while the hyenas scatter.
 *
 *  The DELIVERY is the wind-up: its crystal sail flares blue along the top of
 *  its card, the ground under it goes wet and dark, and the tail comes round
 *  from behind it and draws back against the coming swing.
 *
 *  The LANDING is the TAIL SPIN: one great circular sweep round its square,
 *  the heavy scaled tail whipping a full turn with its tip trailing, and a
 *  curling WAVE of wet mud thrown off the tip — a crest of white water riding
 *  its outer edge, the wave rolling outward as it ages, spray and clots of mud
 *  flung off it. Each card is struck as the tail passes it: mud slapped
 *  across its face, spray and stones blown out AWAY from the Spinosaur, and a
 *  skid gouged outward from it — the knock-back. Behind the sweep a ring of
 *  churned, wet earth is left round its square.
 *
 *  Wet mud, not dry rock: the tail and the mud are SOLID on the normal-blend
 *  layer (a mid-tone body, a lit edge, a dark edge); light is the water — the
 *  white crest, the wet sheen on the mud, the spray — and the blue of the
 *  crystal spines. */
import type { Graphics } from "pixi.js";
import { centre, rand } from "../../looks/base";
import type { FxTools, Pt, SparkStyle } from "../../looks/types";
import type { Signature, SigMoment } from "../types";

type Box = SigMoment["from"];

const TAU = Math.PI * 2;
// The hide: grey-blue scale.
const HIDE = 0x56656e, HIDE_HI = 0xa6b6be, EDGE = 0x0f1418;
// The crystal of its sail and tail spines (additive: light).
const SPINE = 0x4cb0ff, SPINE_HI = 0xcdf0ff;
// Wet mud and river stone, on the normal-blend layer.
const MUD = 0x5e4832, MUD_HI = 0xa48664, MUD_LO = 0x30241a, STONE = 0x6f6a62, STONE_HI = 0xb4ab9c;
// Water (additive).
const WATER = 0x7fc8ee, FOAM = 0xeefaff;
/** Spray: heavy drops, white to river-blue, falling. */
const SPRAY: SparkStyle = { palette: [FOAM, 0xbfe8ff, WATER, 0x3a7aa8], gravity: 950, drag: 0.55, size: [6, 2], streak: false };
/** Fine spray off the crest: quick streaks. */
const MIST: SparkStyle = { palette: [FOAM, 0xbfe8ff, WATER], gravity: 600, drag: 0.5, size: [4, 1.5], streak: true };

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeOut = (x: number) => 1 - (1 - x) * (1 - x);

/** "Ahead", made safe to build on: a unit vector, up if it came in empty. */
function unit(v: Pt): Pt {
  const l = Math.hypot(v.x, v.y);
  return l > 1e-6 ? { x: v.x / l, y: v.y / l } : { x: 0, y: -1 };
}

/** The sweep: a full turn in `SWEEP` seconds, whipped — fastest as it starts,
 *  easing as the turn completes. `x` in 0..1 of the turn at `q` of the time. */
const SWEEP = 0.42, WHIP = 1.7;
const turnAt = (q: number) => 1 - Math.pow(1 - clamp01(q), WHIP);
const timeAt = (x: number) => SWEEP * (1 - Math.pow(1 - clamp01(x), 1 / WHIP));
/** How far the tip trails the root, rad, and the tail's reach. */
const CURL = 0.95, ROOT = 0.2, REACH = 1.08;

// ── The tail ─────────────────────────────────────────────────────────────────

/** The tail swept to `th` round `c`: a tapering curve out from the body, its
 *  tip trailing the sweep by `curl`. Returns its outline and its spine line. */
function tail(c: Pt, th: number, s: number, curl: number, len: number) {
  const N = 14, mid: Pt[] = [];
  for (let i = 0; i <= N; i++) {
    const l = i / N, a = th - curl * Math.pow(l, 1.5), r = s * (ROOT + REACH * len * l);
    mid.push({ x: c.x + Math.cos(a) * r, y: c.y + Math.sin(a) * r });
  }
  const left: number[] = [], right: number[] = [];
  for (let i = 0; i <= N; i++) {
    const a = mid[Math.max(0, i - 1)], b = mid[Math.min(N, i + 1)];
    const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
    const w = s * 0.17 * Math.min(1, 0.45 + (i / N) * 4) * Math.pow(1 - i / N, 0.75) + 0.8; // rounded off at the body
    left.push(mid[i].x + nx * w, mid[i].y + ny * w);
    right.unshift(mid[i].x - nx * w, mid[i].y - ny * w);
  }
  return { outline: left.concat(right), mid };
}

/** Its body: scaled hide, a dark edge. */
function tailDark(g: Graphics, tl: ReturnType<typeof tail>, alpha: number) {
  if (alpha <= 0.02) return;
  g.poly(tl.outline, true).fill({ color: HIDE, alpha }).stroke({ width: 1.5, color: EDGE, alpha, join: "round" });
  // Bands of scale across it.
  for (let i = 2; i < tl.mid.length - 2; i += 2) {
    const a = tl.mid[i - 1], b = tl.mid[i + 1], dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1;
    const p = tl.mid[i], hw = Math.hypot(tl.outline[i * 2] - p.x, tl.outline[i * 2 + 1] - p.y) * 0.8; // the left edge's offset
    g.moveTo(p.x - (dy / L) * hw, p.y + (dx / L) * hw).lineTo(p.x + (dy / L) * hw, p.y - (dx / L) * hw).stroke({ width: 1, color: EDGE, alpha: 0.5 * alpha });
  }
}

/** Its light: a lit rim, and blue crystal spines down its back, pointing
 *  out away from the body. */
function tailLit(g: Graphics, tl: ReturnType<typeof tail>, c: Pt, s: number, alpha: number, flare: number) {
  if (alpha <= 0.02) return;
  g.poly(tl.outline, true).stroke({ width: 1.2, color: HIDE_HI, alpha: 0.55 * alpha, join: "round" });
  for (let i = 3; i < tl.mid.length - 1; i += 2) {
    const p = tl.mid[i], a = Math.atan2(p.y - c.y, p.x - c.x), h = s * 0.09 * (1 - i / tl.mid.length) + s * 0.03, w = h * 0.45;
    const ox = Math.cos(a), oy = Math.sin(a), base = s * 0.08 * (1 - i / tl.mid.length);
    const bx = p.x + ox * base, by = p.y + oy * base;
    g.poly([bx - oy * w, by + ox * w, bx + ox * h, by + oy * h, bx + oy * w, by - ox * w], true)
      .fill({ color: SPINE, alpha: (0.45 + 0.4 * flare) * alpha }).stroke({ width: 1, color: SPINE_HI, alpha: 0.8 * alpha });
  }
}

// ── Mud ──────────────────────────────────────────────────────────────────────

/** A stone's outline: corners at uneven angles and radii, [angle, radius]. */
function rockShape(): number[] {
  const out: number[] = [], n = 5 + Math.floor(rand(0, 2)), a0 = rand(0, TAU);
  for (let i = 0; i < n; i++) out.push(a0 + (i / n) * TAU + rand(-0.25, 0.25), rand(0.72, 1));
  return out;
}

/** A wet river stone at (x, y), `size` its radius: body, a lit face, a dark
 *  edge. */
function stone(g: Graphics, x: number, y: number, size: number, rot: number, rk: number[], alpha: number) {
  if (alpha <= 0.02 || size < 1) return;
  const p: number[] = [], hi: number[] = [];
  for (let i = 0; i < rk.length; i += 2) {
    const a = rk[i] + rot, r = rk[i + 1] * size;
    p.push(x + Math.cos(a) * r, y + Math.sin(a) * r);
    hi.push(x - size * 0.2 + Math.cos(a) * r * 0.5, y - size * 0.22 + Math.sin(a) * r * 0.5);
  }
  g.poly(p, true).fill({ color: STONE, alpha });
  g.poly(hi, true).fill({ color: STONE_HI, alpha: 0.8 * alpha });
  g.poly(p, true).stroke({ width: Math.max(1, size * 0.14), color: EDGE, alpha });
}

interface Clot { x: number; y: number; vx: number; vy: number; r: number; age: number; life: number; rk?: number[]; rot: number }

/** Clots of mud (and the odd stone) thrown, falling, splatting flat as they
 *  land: a local particle set on the normal-blend layer, since mud is a
 *  colour and not a light. `spawn` adds to it; it draws for `D`. */
function clots(t: FxTools, D: number, sc: number) {
  const list: Clot[] = [];
  t.draw(D, (g, _v, dt) => {
    for (const c of list) {
      c.age += dt;
      if (c.age >= c.life) continue;
      c.vy += 1300 * sc * dt;
      c.vx *= Math.pow(0.5, dt);
      c.x += c.vx * dt; c.y += c.vy * dt;
      c.rot += dt * 8;
      const a = c.age > c.life * 0.65 ? 1 - (c.age - c.life * 0.65) / (c.life * 0.35) : 1;
      if (c.rk) { stone(g, c.x, c.y, c.r, c.rot, c.rk, a); continue; }
      const st = 1 + Math.min(0.6, Math.hypot(c.vx, c.vy) / (900 * sc)); // stretched by its speed
      g.ellipse(c.x, c.y, c.r * st, c.r / st).fill({ color: MUD, alpha: 0.95 * a });
      g.circle(c.x - c.r * 0.3, c.y - c.r * 0.35, c.r * 0.35).fill({ color: MUD_HI, alpha: 0.8 * a });
    }
  }, { dark: true });
  return (x: number, y: number, vx: number, vy: number, r: number, isStone = false) =>
    list.push({ x, y, vx, vy, r, age: 0, life: rand(0.4, 0.6), rk: isStone ? rockShape() : undefined, rot: rand(0, TAU) });
}

/** A lumpy blot, `r` across, its edge rolling with `time`. */
function blot(g: Graphics, c: Pt, r: number, time: number, seed: number): Graphics {
  const pts: number[] = [];
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * TAU;
    const rr = r * (1 + 0.12 * Math.sin(3 * a + seed) + 0.08 * Math.sin(5 * a + seed * 2 - time * 4));
    pts.push(c.x + Math.cos(a) * rr, c.y + Math.sin(a) * rr * 0.9);
  }
  return g.poly(pts, true);
}

export const SPINOSAUR: Signature = {
  shake: 1.4,
  // It does not step: it turns where it stands and the tail does the reaching.
  lunge: false,

  deliver(t: FxTools, m: SigMoment, seconds: number) {
    const c = centre(m.from), s = m.size, sc = s / 90, u = unit(m.ahead), S = seconds;
    const th0 = Math.atan2(-u.y, -u.x); // the tail lies behind it
    // THE SAIL: crystal spines along the top of its card flaring blue, the
    // tallest in the middle, as on its art.
    const spines = [-0.32, -0.19, -0.06, 0.07, 0.2, 0.32].map((f) => ({ f, h: 0.16 + 0.14 * (1 - Math.abs(f) / 0.34), lean: f * 0.5 }));
    t.draw(S, (g, v) => {
      const time = v * S, grow = easeOut(clamp01(v / 0.5)), base = c.y - s * 0.12;
      g.ellipse(c.x, base - s * 0.12, s * 0.42, s * 0.2).fill({ color: SPINE, alpha: 0.1 * grow });
      spines.forEach((sp, i) => {
        const fl = grow * (0.75 + 0.25 * Math.sin(time * 30 + i * 1.7)), h = s * sp.h * grow, w = s * 0.045, x = c.x + sp.f * s;
        g.poly([x - w, base, x + sp.lean * h * 0.3, base - h, x + w, base], true)
          .fill({ color: SPINE, alpha: 0.55 * fl }).stroke({ width: 1, color: SPINE_HI, alpha: 0.9 * fl });
        g.moveTo(x - w * 0.3, base - h * 0.15).lineTo(x + sp.lean * h * 0.25, base - h * 0.85).stroke({ width: 1, color: 0xffffff, alpha: 0.6 * fl });
      });
    });
    t.charge({ x: c.x, y: c.y - s * 0.2 }, s * 0.8, SPINE, 0.25, S);
    // The ground under it going wet and dark: a ring of mud welling up.
    const seed = rand(0, 100);
    t.draw(S, (g, v) => {
      const k = easeOut(v);
      blot(g, c, s * (0.5 + 0.18 * k), v * S, seed).stroke({ width: s * 0.14 * k, color: MUD_LO, alpha: 0.55 * k });
    }, { dark: true });
    t.draw(S, (g, v) => {
      const k = easeOut(v);
      blot(g, c, s * (0.57 + 0.2 * k), v * S, seed).stroke({ width: 1.3, color: WATER, alpha: 0.45 * k });
    });
    // THE WIND-UP: the tail comes round from behind and draws back.
    const at = (v: number) => th0 - 0.75 * easeOut(clamp01((v - 0.15) / 0.85));
    const len = (v: number) => 0.55 + 0.45 * easeOut(clamp01(v / 0.5));
    t.draw(S, (g, v) => tailDark(g, tail(c, at(v), s, -0.5, len(v)), clamp01(v * 5)), { dark: true });
    t.draw(S, (g, v) => tailLit(g, tail(c, at(v), s, -0.5, len(v)), c, s, clamp01(v * 5), v));
    let acc = 0;
    t.draw(S, (_g, v, dt) => {
      acc += dt * 20 * t.quality * v;
      for (; acc >= 1; acc--) {
        const a = rand(0, TAU), r = s * rand(0.5, 0.75);
        t.spark(c.x + Math.cos(a) * r, c.y + Math.sin(a) * r, rand(-20, 20) * sc, -rand(30, 90) * sc, rand(0.25, 0.4), SPRAY);
      }
    });
  },

  land(t: FxTools, m: SigMoment) {
    const c = centre(m.from), s = m.size, sc = s / 90, u = unit(m.ahead);
    const th0 = Math.atan2(-u.y, -u.x) - 0.75; // from where the wind-up left it
    const theta = (time: number) => th0 + TAU * turnAt(time / SWEEP);
    const TD = SWEEP + 0.14;
    const tailA = (time: number) => (time < SWEEP ? 1 : 1 - clamp01((time - SWEEP) / 0.14));

    // THE TAIL: one full turn, the tip trailing.
    t.draw(TD, (g, v) => {
      const time = v * TD;
      tailDark(g, tail(c, theta(time), s, CURL * (time < SWEEP ? 1 : 1 - (time - SWEEP) / 0.14), 1), tailA(time));
    }, { dark: true });
    t.draw(TD, (g, v) => {
      const time = v * TD;
      tailLit(g, tail(c, theta(time), s, CURL * (time < SWEEP ? 1 : 1 - (time - SWEEP) / 0.14), 1), c, s, tailA(time), 1);
    });

    // THE WAVE: a band of wet mud thrown off the tip, trailing behind it; the
    // older it is the farther out it has rolled and the thinner it runs.
    const LAG = 1.9, WD = SWEEP + 0.4, R_IN = s * 0.7;
    const waveFade = (time: number) => 1 - clamp01((time - SWEEP) / (WD - SWEEP));
    const band = (time: number) => {
      const head = theta(time) - CURL * 0.85, swept = head - th0, lag = Math.min(LAG, Math.max(0, swept));
      const K = 12, segs: { a: number; f: number; rIn: number; rOut: number }[] = [];
      for (let i = 0; i <= K; i++) {
        const f = i / K, a = head - lag * f;
        segs.push({ a, f, rIn: R_IN + s * 0.2 * f, rOut: s * (1.22 + 0.42 * f) + s * 0.04 * Math.sin(a * 9 + time * 20) });
      }
      return segs;
    };
    const P = (r: number, a: number) => ({ x: c.x + Math.cos(a) * r, y: c.y + Math.sin(a) * r });
    t.draw(WD, (g, v) => {
      const time = v * WD, segs = band(time), fade = waveFade(time);
      for (let i = 0; i < segs.length - 1; i++) {
        const a = segs[i], b = segs[i + 1], al = 0.72 * Math.pow(1 - a.f, 1.1) * fade;
        if (al <= 0.02) continue;
        const p1 = P(a.rIn, a.a), p2 = P(a.rOut, a.a), p3 = P(b.rOut, b.a), p4 = P(b.rIn, b.a);
        g.poly([p1.x, p1.y, p2.x, p2.y, p3.x, p3.y, p4.x, p4.y], true).fill({ color: MUD, alpha: Math.min(0.9, al * 1.2) });
        // The face of the wave darker where it curls over.
        const q1 = P(a.rOut - s * 0.1, a.a), q2 = P(b.rOut - s * 0.1, b.a);
        g.poly([q1.x, q1.y, p2.x, p2.y, p3.x, p3.y, q2.x, q2.y], true).fill({ color: MUD_LO, alpha: al * 0.8 });
      }
    }, { dark: true });
    // Its light: the white crest torn along the outer edge, a wet sheen on
    // the mud, spray flung off the crest as it goes.
    let spray = 0;
    const clot = clots(t, WD + 0.3, sc);
    t.draw(WD, (g, v, dt) => {
      const time = v * WD, segs = band(time), fade = waveFade(time);
      for (let i = 0; i < segs.length - 1; i++) {
        const a = segs[i], b = segs[i + 1], al = Math.pow(1 - a.f, 0.9) * fade;
        if (al <= 0.03 || (i % 3 === 2 && a.f > 0.3)) continue; // the crest breaks up as it ages
        const c1 = P(a.rOut, a.a), c2 = P(b.rOut, b.a);
        g.moveTo(c1.x, c1.y).lineTo(c2.x, c2.y).stroke({ width: 3.5 * (1 - a.f * 0.5), color: FOAM, alpha: 0.9 * al, cap: "round" });
        const w1 = P((a.rIn + a.rOut) / 2, a.a), w2 = P((b.rIn + b.rOut) / 2, b.a);
        g.moveTo(w1.x, w1.y).lineTo(w2.x, w2.y).stroke({ width: 1.2, color: WATER, alpha: 0.45 * al });
        // The lip curling over, a second line of white water just inside it.
        const l1 = P(a.rOut - s * 0.1, a.a), l2 = P(b.rOut - s * 0.1, b.a);
        g.moveTo(l1.x, l1.y).lineTo(l2.x, l2.y).stroke({ width: 1.6, color: 0xbfe8ff, alpha: 0.6 * al, cap: "round" });
      }
      if (time > SWEEP) return;
      const head = segs[0], dir = head.a + Math.PI / 2; // the way the tip is moving
      spray += dt * 150 * t.quality;
      for (; spray >= 1; spray--) {
        const r = rand(head.rIn, head.rOut + s * 0.05), a = head.a - rand(0, 0.35), p = P(r, a);
        const vt = rand(120, 300) * sc, vr = rand(40, 180) * sc;
        t.spark(p.x, p.y, Math.cos(dir) * vt + Math.cos(a) * vr, Math.sin(dir) * vt + Math.sin(a) * vr - rand(60, 160) * sc, rand(0.3, 0.5),
          Math.random() < 0.6 ? SPRAY : MIST);
        if (Math.random() < 0.28) {
          const isStone = Math.random() < 0.25;
          clot(p.x, p.y, Math.cos(dir) * vt * 0.8 + Math.cos(a) * vr, Math.sin(dir) * vt * 0.8 + Math.sin(a) * vr - rand(100, 220) * sc,
            s * rand(0.025, 0.045) * (isStone ? 1.2 : 1), isStone);
        }
      }
    });

    // THE CHURNED RING left behind the sweep, round its square.
    const seed = rand(0, 100), RD = 1.1;
    const swept = (time: number) => Math.min(TAU, theta(time) - th0);
    const ringArc = (g: Graphics, time: number, r: number) => {
      const end = swept(time), n = Math.max(2, Math.round((end / TAU) * 72));
      for (let i = 0; i <= n; i++) {
        const a = th0 + (end * i) / n, rr = r * (1 + 0.035 * Math.sin(a * 5 + seed) + 0.025 * Math.sin(a * 13 + seed * 3));
        if (i === 0) g.moveTo(c.x + Math.cos(a) * rr, c.y + Math.sin(a) * rr);
        else g.lineTo(c.x + Math.cos(a) * rr, c.y + Math.sin(a) * rr);
      }
      return g;
    };
    const ringFade = (time: number) => 1 - clamp01((time - 0.75) / (RD - 0.75));
    t.draw(RD, (g, v) => {
      const time = v * RD, a = ringFade(time);
      ringArc(g, time, s * 0.72).stroke({ width: s * 0.17, color: MUD_LO, alpha: 0.42 * a });
      ringArc(g, time, s * 0.72).stroke({ width: s * 0.06, color: MUD, alpha: 0.55 * a });
    }, { dark: true });
    t.draw(RD, (g, v) => {
      const time = v * RD, a = ringFade(time);
      ringArc(g, time, s * 0.82).stroke({ width: 1.3, color: WATER, alpha: 0.5 * a });
      ringArc(g, time, s * 0.63).stroke({ width: 1, color: MUD_HI, alpha: 0.4 * a });
    });

    // Each card struck as the tail comes round to it.
    m.targets.forEach((r, i) => {
      const p = centre(r), psi = Math.atan2(p.y - c.y, p.x - c.x);
      const lead = th0 + CURL * 0.3; // the heavy middle of the tail is what strikes
      const x = ((((psi - lead) % TAU) + TAU) % TAU) / TAU;
      t.later(timeAt(x), () => smack(t, r, p, psi, m.power[i] ?? 1, !!m.killed[i], clot));
    });
  },
};

/** A card the tail strikes: mud slapped across its face, spray and stones
 *  blown out away from the Spinosaur, and a skid gouged outward — the knock
 *  back. A kill throws it all farther. */
function smack(t: FxTools, r: Box, p: Pt, away: number, power: number, killed: boolean, clot: (x: number, y: number, vx: number, vy: number, r: number, st?: boolean) => void) {
  const s = Math.min(r.w, r.h), sc = s / 90, k = Math.max(0.8, Math.min(1.6, power)) * (killed ? 1.2 : 1);
  const ox = Math.cos(away), oy = Math.sin(away), swing = away + Math.PI / 2; // out, and the way the tail moves
  t.flash(p, FOAM, 0.2 * k * sc);
  t.ring(r, WATER, 0.3, 1.05 * Math.min(1.3, k), 0.3, 3);
  // The spray, blown out and along the swing.
  const n = Math.round(16 * k * t.quality);
  for (let i = 0; i < n; i++) {
    const a = away + rand(-0.7, 0.9), v = rand(160, 340) * sc;
    t.spark(p.x, p.y, Math.cos(a) * v + Math.cos(swing) * 60 * sc, Math.sin(a) * v + Math.sin(swing) * 60 * sc - rand(60, 160) * sc, rand(0.35, 0.55), SPRAY);
  }
  const nc = Math.round((4 + 2 * k) * t.quality);
  for (let i = 0; i < nc; i++) {
    const a = away + rand(-0.8, 0.8), v = rand(150, 300) * sc, st = i % 3 === 0;
    clot(p.x + rand(-0.15, 0.15) * s, p.y + rand(-0.15, 0.15) * s, Math.cos(a) * v, Math.sin(a) * v - rand(120, 240) * sc, s * rand(0.03, 0.05) * (st ? 1.3 : 1), st);
  }
  // Mud slapped across the face of the card, draining down it.
  const seed = rand(0, 100), D = 0.75;
  const splat = (g: Graphics, v: number) => {
    const drain = s * 0.1 * easeOut(clamp01((v - 0.3) / 0.7));
    return blot(g, { x: p.x + ox * s * 0.06, y: p.y + oy * s * 0.06 + drain }, s * (0.18 + 0.1 * easeOut(clamp01(v / 0.15))) * Math.min(1.3, k), v * D, seed);
  };
  const env = (v: number) => (v < 0.08 ? v / 0.08 : v > 0.45 ? Math.max(0, 1 - (v - 0.45) / 0.55) : 1);
  t.draw(D, (g, v) => { splat(g, v).fill({ color: MUD, alpha: 0.7 * env(v) }); }, { dark: true });
  t.draw(D, (g, v) => { splat(g, v).stroke({ width: 1.5, color: WATER, alpha: 0.55 * env(v) }); });
  // THE KNOCK-BACK: a skid gouged from the card out away from the Spinosaur,
  // mud heaped where it ends.
  const SK = 0.6, len = s * 0.55 * Math.min(1.3, k);
  const a0 = { x: p.x - ox * s * 0.1, y: p.y - oy * s * 0.1 };
  const skid = (g: Graphics, v: number, w: number, color: number, alpha: number) => {
    const e = easeOut(clamp01(v / 0.25)), b = { x: a0.x + ox * len * e, y: a0.y + oy * len * e };
    for (const side of [-1, 1]) {
      const sx = -oy * side * s * 0.08, sy = ox * side * s * 0.08;
      g.moveTo(a0.x + sx, a0.y + sy).lineTo(b.x + sx, b.y + sy).stroke({ width: w, color, alpha, cap: "round" });
    }
    return b;
  };
  t.draw(SK, (g, v) => {
    const a = 1 - clamp01((v - 0.5) / 0.5);
    const b = skid(g, v, 4, MUD_LO, 0.75 * a);
    g.ellipse(b.x, b.y, s * 0.13, s * 0.08).fill({ color: MUD, alpha: 0.75 * a * clamp01(v * 6) });
  }, { dark: true });
  t.draw(SK, (g, v) => {
    const a = 1 - clamp01((v - 0.5) / 0.5);
    const b = skid(g, v, 1.2, WATER, 0.5 * a);
    g.ellipse(b.x, b.y, s * 0.13, s * 0.08).stroke({ width: 1.2, color: WATER, alpha: 0.5 * a * clamp01(v * 6) });
    // The shove itself: three streaks of motion out along it.
    if (v < 0.35)
      for (const o of [-1, 0, 1]) {
        const q = v / 0.35, sx = -oy * o * s * 0.16, sy = ox * o * s * 0.16, st = { x: p.x + sx + ox * s * 0.25 * q, y: p.y + sy + oy * s * 0.25 * q };
        g.moveTo(st.x, st.y).lineTo(st.x + ox * s * 0.25, st.y + oy * s * 0.25).stroke({ width: 2, color: FOAM, alpha: 0.6 * (1 - q), cap: "round" });
      }
  });
  if (killed) t.ring(r, FOAM, 0.4, 1.35, 0.4, 2.5);
}
