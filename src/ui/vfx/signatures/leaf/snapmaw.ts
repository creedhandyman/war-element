/** SNAPMAW — Devour. "4 DMG to EVERY ROOTed opponent on the board. Each one
 *  that dies gives Snapmaw +2 DMG permanently, up to +6." She feeds on the
 *  rooted: she devours every pinned enemy on the board.
 *
 *  The DELIVERY is her snare garden waking. The flytrap that tops her staff
 *  opens, venom-green light pooling in its red throat and dripping off its
 *  teeth; and from under her square the garden's roots go out UNDERGROUND to
 *  every rooted card — a ridge of earth snaking across the board to each one,
 *  green light leaking up through the split it leaves, grit kicked up at its
 *  head — reaching under each on the landing frame.
 *
 *  The LANDING is the meal. Under every one of them a giant Venus flytrap
 *  bursts up out of the ground, earth flung off it, and rears open round the
 *  card — blood-red throat, pale teeth — then SNAPS SHUT on it, the teeth
 *  locking across it and green sap squirting out of the seam. It chews, lets
 *  go and sinks back. One that dies is swallowed instead: the trap goes down
 *  with it still shut, and a pulse of green power runs back across the board
 *  to Snapmaw, whose staff gulps it down (+2 DMG). Her staff snaps with them.
 *
 *  The traps are SOLID — leaf-green bodies, blood-red throats, cream teeth on
 *  the normal-blend layer, edged acid-green like the art — so they read as
 *  plants over a card and over an empty square, and never as light. */
import { centre, rand } from "../../looks/base";
import type { Graphics } from "pixi.js";
import type { FxTools, Pt, SparkStyle } from "../../looks/types";
import type { Signature, SigMoment } from "../types";

type Box = SigMoment["from"];

const TAU = Math.PI * 2;
// The trap, solid (normal blend): a leaf-green body, a blood-red throat, pale
// teeth, a dark edge to hold its shape; earth.
const BODY = 0x3f7d22, EDGE = 0x0c1e06, THROAT = 0x9c0d1a, TOOTH = 0xf3ead0, SOIL = 0x1e150b, CLOD = 0x3a2a18, CLOD_LIT = 0xb89468;
// Light (additive): the acid glow along its edges, its throat's glow, venom.
const ACID = 0xb8ff3a, PALE = 0xeeffb0, SAPG = 0x6fd12a, RED_GLOW = 0xff4a3a;
/** Sap squirted out of a trap's seam as it bites: bright, heavy, falling. */
const SAP: SparkStyle = { palette: [PALE, ACID, SAPG, 0x2f7a18], gravity: 800, drag: 0.55, size: [6, 2.5], streak: false };
/** Venom dripping off the staff's teeth. */
const DRIP: SparkStyle = { palette: [PALE, ACID, SAPG], gravity: 500, drag: 0.7, size: [4, 2], streak: false };
/** Grit kicked up where a root runs under the ground and where a trap breaks out. */
const GRIT: SparkStyle = { palette: [0xe8d8b0, 0xb89468, 0x6e5a40], gravity: 900, drag: 0.6, size: [5, 2], streak: false };
/** Green power coming off Snapmaw as a meal comes home. */
const FED: SparkStyle = { palette: [PALE, ACID, SAPG], gravity: -90, drag: 0.6, size: [6, 2], streak: false, swirl: 140 };

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeOut = (x: number) => 1 - (1 - x) * (1 - x);

// ── The trap ─────────────────────────────────────────────────────────────────

/** How wide a trap rears open, radians each jaw leans out from upright. */
const OPEN = 0.56;
/** A trap's beats, s: up out of the ground; cocked wide; shut; let go. */
const RISE = 0.11, BITE = 0.19, SHUT = 0.055, GO = 0.5, END = 0.85;

/** One jaw of a flytrap, from its hinge `h`, `J` long, leaning `lean` out
 *  from upright on `side` (-1 left, 1 right) with its rim facing in: the
 *  lobe's outline, the red of its throat along the inside of the rim, its back
 *  (the edge that glows), and its teeth — thin spikes off the rim pointing
 *  across at the other jaw, set half a tooth apart on the two so they lock. */
function jaw(h: Pt, J: number, side: number, lean: number) {
  const a = -Math.PI / 2 + side * lean, dx = Math.cos(a), dy = Math.sin(a), ix = side * Math.sin(a), iy = -side * Math.cos(a);
  const N = 10, rim: number[] = [], back: number[] = [], mid: number[] = [];
  for (let k = 0; k <= N; k++) {
    const v = k / N, x = h.x + dx * J * v, y = h.y + dy * J * v, sv = Math.sin(Math.PI * v);
    const bin = J * 0.05 * sv, bout = J * 0.3 * Math.pow(sv, 0.6);
    rim.push(x + ix * bin, y + iy * bin);
    back.push(x - ix * bout, y - iy * bout);
    mid.push(x - ix * bout * 0.5, y - iy * bout * 0.5);
  }
  const rev = (p: number[]) => {
    const o: number[] = [];
    for (let k = p.length - 2; k >= 0; k -= 2) o.push(p[k], p[k + 1]);
    return o;
  };
  const teeth: number[][] = [], TN = 6, tx = ix + dx * 0.45, ty = iy + dy * 0.45, tl = Math.hypot(tx, ty);
  for (let j = 0; j < TN; j++) {
    const v = 0.13 + ((j + (side > 0 ? 0.5 : 0)) / TN) * 0.8, sv = Math.sin(Math.PI * v);
    const bx = h.x + dx * J * v + ix * J * 0.05 * sv, by = h.y + dy * J * v + iy * J * 0.05 * sv;
    const len = J * 0.24 * (0.65 + 0.35 * sv), w = J * 0.026;
    teeth.push([bx - dx * w, by - dy * w, bx + (tx / tl) * len, by + (ty / tl) * len, bx + dx * w, by + dy * w]);
  }
  return { body: rim.concat(rev(back)), throat: rim.concat(rev(mid)), back, rim, teeth };
}

/** A flytrap's solid half: its stalk going down into the ground, both jaws'
 *  bodies, the red of their throats while they gape (`open`), then all the
 *  teeth over both — so as the jaws lock, each set shows across the other. */
function trapSolid(g: Graphics, h: Pt, J: number, lean: number, open: number, a: number) {
  if (a <= 0.02 || J < 2) return;
  const jaws = [jaw(h, J, -1, lean), jaw(h, J, 1, lean)];
  g.moveTo(h.x, h.y - J * 0.05).quadraticCurveTo(h.x + J * 0.06, h.y + J * 0.1, h.x, h.y + J * 0.2)
    .stroke({ width: J * 0.13, color: BODY, alpha: a, cap: "round" });
  for (const j of jaws) g.poly(j.body, true).fill({ color: BODY, alpha: a }).stroke({ width: 1.3, color: EDGE, alpha: 0.9 * a });
  if (open > 0.02) for (const j of jaws) g.poly(j.throat, true).fill({ color: THROAT, alpha: a * open });
  for (const j of jaws) for (const tooth of j.teeth) g.poly(tooth, true).fill({ color: TOOTH, alpha: a });
}

/** ...and its light: the acid glow along each jaw's back, as on the art, the
 *  red throat glowing out of the gape, and a pale line along each rim. */
function trapLight(g: Graphics, h: Pt, J: number, lean: number, open: number, a: number) {
  if (a <= 0.02 || J < 2) return;
  for (const side of [-1, 1]) {
    const j = jaw(h, J, side, lean);
    g.poly(j.back, false).stroke({ width: Math.max(3, J * 0.09), color: ACID, alpha: 0.22 * a, cap: "round", join: "round" });
    g.poly(j.back, false).stroke({ width: Math.max(1.5, J * 0.03), color: ACID, alpha: 0.85 * a, cap: "round", join: "round" });
    g.poly(j.rim, false).stroke({ width: 1, color: PALE, alpha: 0.35 * a });
    if (open > 0.02) g.poly(j.throat, true).fill({ color: RED_GLOW, alpha: 0.14 * a * open });
  }
}

/** A trap at `time` into its strike: rising out of the ground as it opens;
 *  cocked a little wider; slammed shut, accelerating; chewing; then — a meal
 *  it keeps — going down still shut, or letting go and sinking back. */
function pose(time: number, killed: boolean) {
  if (time < RISE) {
    const k = easeOut(time / RISE);
    return { grow: 0.35 + 0.65 * k, lean: 0.25 + (OPEN - 0.25) * k, a: clamp01(time / 0.03), sink: 0 };
  }
  if (time < BITE) return { grow: 1, lean: OPEN + 0.1 * easeOut((time - RISE) / (BITE - RISE)), a: 1, sink: 0 };
  if (time < BITE + SHUT) {
    const k = (time - BITE) / SHUT;
    return { grow: 1, lean: (OPEN + 0.1) * (1 - k * k), a: 1, sink: 0 };
  }
  const after = time - BITE - SHUT, chew = 0.06 * Math.max(0, Math.sin(after * 26)) * Math.exp(-after * 4);
  if (time < GO) return { grow: 1, lean: chew, a: 1, sink: 0 };
  const q = clamp01((time - GO) / (END - GO));
  if (killed) return { grow: 1 - 0.7 * q * q, lean: 0, a: 1 - q * q, sink: q };
  return { grow: 1 - 0.55 * q, lean: 0.4 * easeOut(clamp01(q * 2.5)), a: 1 - q, sink: q };
}

// ── Earth ────────────────────────────────────────────────────────────────────

/** Clods of earth flung up from `at` — lumpy dark bodies lit on their rims,
 *  falling back. */
function clods(t: FxTools, at: Pt, n: number, s: number, delay: number) {
  const bits = Array.from({ length: Math.max(1, Math.round(n * t.quality)) }, () => {
    const a = -Math.PI / 2 + rand(-1.25, 1.25), v = rand(120, 230) * (s / 90);
    return { vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: s * rand(0.03, 0.05), rot: rand(0, TAU), vr: rand(-8, 8),
      shape: Array.from({ length: 6 }, () => rand(0.7, 1)), life: rand(0.4, 0.55) };
  });
  t.draw(0.55, (g, u) => {
    const time = u * 0.55;
    for (const b of bits) {
      if (time >= b.life) continue;
      const x = at.x + b.vx * time, y = at.y + b.vy * time + 700 * (s / 90) * time * time, a = 1 - Math.pow(time / b.life, 3), p: number[] = [];
      for (let i = 0; i < 6; i++) {
        const ang = b.rot + b.vr * time + (i / 6) * TAU;
        p.push(x + Math.cos(ang) * b.r * b.shape[i], y + Math.sin(ang) * b.r * b.shape[i]);
      }
      g.poly(p, true).fill({ color: CLOD, alpha: a }).stroke({ width: Math.max(1, b.r * 0.3), color: CLOD_LIT, alpha: 0.85 * a });
    }
  }, { dark: true, delay });
}

/** A root's course under the ground from Snapmaw's square to a card: out of
 *  her edge toward it, snaking, and dead on the card at the end. */
function burrowPath(c: Pt, to: Pt, s: number): number[] {
  const dx = to.x - c.x, dy = to.y - c.y, d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d;
  const sx = c.x + ux * s * 0.4, sy = c.y + uy * s * 0.4, L = Math.max(1, d - s * 0.4);
  const amp = Math.min(s * 0.35, L * rand(0.1, 0.15)) * (Math.random() < 0.5 ? -1 : 1), waves = rand(2.4, 3.2), ph = rand(0, TAU), pts: number[] = [];
  for (let i = 0; i <= 24; i++) {
    const f = i / 24, off = amp * Math.sin(Math.PI * f) * Math.sin(Math.PI * f * waves + ph);
    pts.push(sx + ux * L * f - uy * off, sy + uy * L * f + ux * off);
  }
  return pts;
}

/** The point `f` (0..1) of the way along a sampled path, and its heading. */
function at(pts: number[], f: number) {
  const n = pts.length / 2 - 1, i = Math.max(0, Math.min(n - 1e-6, f * n)), j = Math.floor(i), r = i - j;
  const x0 = pts[2 * j], y0 = pts[2 * j + 1], x1 = pts[2 * j + 2], y1 = pts[2 * j + 3];
  return { x: x0 + (x1 - x0) * r, y: y0 + (y1 - y0) * r, a: Math.atan2(y1 - y0, x1 - x0) };
}

/** The part of a sampled path from `f0` to `f1`, as flat points. */
function part(pts: number[], f0: number, f1: number): number[] {
  const out: number[] = [], a = at(pts, f0), n = pts.length / 2 - 1;
  out.push(a.x, a.y);
  for (let j = Math.floor(f0 * n) + 1; j < f1 * n; j++) out.push(pts[2 * j], pts[2 * j + 1]);
  const b = at(pts, f1);
  out.push(b.x, b.y);
  return out;
}

/** The trap on her staff: its hinge, on the art's side of her card. */
const staffAt = (c: Pt, s: number): Pt => ({ x: c.x - s * 0.2, y: c.y + s * 0.06 });

export const SNAPMAW: Signature = {
  shake: 1.1,

  deliver(t: FxTools, m: SigMoment, seconds: number) {
    const c = centre(m.from), s = m.size, T = seconds, h = staffAt(c, s), J = s * 0.36;
    // HER STAFF: the trap on it opening, venom-light pooling in its throat.
    const staff = (time: number) => ({ grow: easeOut(clamp01(time / (T * 0.3))), lean: 0.6 * easeOut(clamp01(time / (T * 0.7))) });
    t.draw(T, (g, u) => {
      const st = staff(u * T);
      trapSolid(g, h, J * st.grow, st.lean, st.lean / 0.6, 1);
    }, { dark: true });
    t.draw(T, (g, u) => {
      const st = staff(u * T), k = st.lean / 0.6;
      trapLight(g, h, J * st.grow, st.lean, k, 1);
      g.circle(h.x, h.y - J * 0.5, J * (0.2 + 0.2 * k)).fill({ color: ACID, alpha: 0.35 * k }).circle(h.x, h.y - J * 0.5, J * 0.1 * k).fill({ color: PALE, alpha: 0.8 * k });
    });
    t.charge({ x: h.x, y: h.y - J * 0.5 }, s * 0.9, ACID, 0.45, T);
    const drips = Math.round(6 * t.quality);
    for (let i = 0; i < drips; i++)
      t.later(rand(0.35, 0.95) * T, () => t.spark(h.x + rand(-0.25, 0.25) * J, h.y - J * rand(0.3, 0.6), rand(-10, 10), rand(0, 30), rand(0.3, 0.45), DRIP));

    // THE ROOTS: out from under her, underground, to every rooted card.
    const GO0 = T * 0.18, RUN = T - GO0, TAIL = 0.3;
    const roots = m.targets.map((r) => burrowPath(c, centre(r), s));
    const head = (time: number) => {
      const q = clamp01((time - GO0) / RUN);
      return 0.5 * q + 0.5 * q * q;
    };
    /** The split behind a root's head, in four lengths, older ones fainter. */
    const seam = (g: Graphics, pts: number[], e: number, fade: number, w: number, color: number, alpha: number) => {
      for (let k = 0; k < 4; k++) {
        const f0 = Math.max(0, e - 0.6 + k * 0.15), f1 = Math.max(0, e - 0.6 + (k + 1) * 0.15);
        if (f1 - f0 > 0.005) g.poly(part(pts, f0, f1), false).stroke({ width: w, color, alpha: alpha * ((k + 1) / 4) * fade, cap: "round", join: "round" });
      }
    };
    t.draw(T + TAIL, (g, u) => {
      const time = u * (T + TAIL), e = head(time), fade = 1 - clamp01((time - T) / TAIL);
      if (time < GO0) return;
      for (const pts of roots) {
        seam(g, pts, e, fade, Math.max(2.5, s * 0.06), SOIL, 0.85);
        // The ridge it pushes up, riding its head.
        if (time > T) continue;
        const hd = at(pts, e), ca = Math.cos(hd.a), sa = Math.sin(hd.a), rr: number[] = [];
        for (let i = 0; i < 12; i++) {
          const q = (i / 12) * TAU, lx = Math.cos(q) * s * 0.12, ly = Math.sin(q) * s * 0.065;
          rr.push(hd.x + lx * ca - ly * sa, hd.y + lx * sa + ly * ca);
        }
        g.poly(rr, true).fill({ color: SOIL, alpha: 0.9 }).stroke({ width: 1.2, color: CLOD_LIT, alpha: 0.8 });
      }
    }, { dark: true });
    let grit = 0;
    t.draw(T + TAIL, (g, u, dt) => {
      const time = u * (T + TAIL), e = head(time), fade = 1 - clamp01((time - T) / TAIL);
      if (time < GO0) return;
      for (const pts of roots) {
        seam(g, pts, e, fade, Math.max(3, s * 0.08), SAPG, 0.25);
        seam(g, pts, e, fade, 1.3, ACID, 0.9);
        if (time > T) continue;
        const hd = at(pts, e);
        g.circle(hd.x, hd.y, s * 0.11).fill({ color: ACID, alpha: 0.22 }).circle(hd.x, hd.y, s * 0.04).fill({ color: PALE, alpha: 0.85 });
      }
      if (time > T || !roots.length) return;
      grit += dt * 30 * roots.length * t.quality;
      for (; grit >= 1; grit--) {
        const hd = at(roots[Math.floor(rand(0, roots.length))], e), a = hd.a + Math.PI + rand(-0.9, 0.9), v = rand(40, 110) * (s / 90);
        t.spark(hd.x, hd.y, Math.cos(a) * v, Math.sin(a) * v - rand(60, 140) * (s / 90), rand(0.25, 0.4), GRIT);
      }
    });
  },

  land(t: FxTools, m: SigMoment) {
    const s = m.size, c = centre(m.from), h = staffAt(c, s), J = s * 0.36, FEED = 0.36;
    const gulps: number[] = [];
    m.targets.forEach((r, i) => {
      const delay = i * 0.035;
      devour(t, r, m.power[i] ?? 1, !!m.killed[i], s, delay);
      if (m.killed[i]) {
        const go = delay + BITE + SHUT + 0.1;
        t.later(go, () => feed(t, centre(r), { x: h.x, y: h.y - J * 0.5 }, s, FEED));
        gulps.push(go + FEED);
      }
    });
    // HER STAFF snaps shut with the traps — and gulps each meal that comes
    // home, lit by it.
    const last = Math.max(BITE + SHUT, ...gulps), D = last + 0.35;
    const staff = (time: number) => {
      const lean = time < BITE ? 0.6 : time < BITE + SHUT ? 0.6 * (1 - ((time - BITE) / SHUT) ** 2) : 0;
      let swell = 0;
      for (const gt of gulps) swell = Math.max(swell, Math.exp(-(((time - gt) / 0.06) ** 2)));
      return { lean, swell, a: 1 - clamp01((time - last - 0.1) / 0.25) };
    };
    t.draw(D, (g, u) => {
      const st = staff(u * D);
      trapSolid(g, h, J * (1 + 0.18 * st.swell), st.lean, st.lean / 0.6, st.a);
    }, { dark: true });
    t.draw(D, (g, u) => {
      const st = staff(u * D);
      trapLight(g, h, J * (1 + 0.18 * st.swell), st.lean, st.lean / 0.6, st.a);
      if (st.swell > 0.02) g.circle(h.x, h.y - J * 0.5, J * 0.55).fill({ color: ACID, alpha: 0.4 * st.swell * st.a });
    });
  },
};

/** A giant flytrap's strike on one card, `delay` in: it bursts up out of the
 *  ground under the card, rears open round it, snaps shut — teeth locking,
 *  sap squirting from the seam — chews, and lets go and sinks back, or, on a
 *  kill, goes down with its meal still shut. */
function devour(t: FxTools, r: Box, power: number, killed: boolean, s: number, delay: number) {
  const p = centre(r), k = Math.max(0.55, Math.min(1.5, power)), J = s * (0.82 + 0.12 * k);
  const hinge = { x: p.x, y: r.y + r.h * 0.93 };
  const now = (time: number) => {
    const ps = pose(time, killed);
    // Shut, a line of red still shows down the seam: the teeth across it read
    // as jaws clamped, not as the veins of a leaf.
    return { h: { x: hinge.x, y: hinge.y + s * 0.12 * ps.sink }, J: J * ps.grow, lean: ps.lean, a: ps.a,
      open: Math.max(clamp01(ps.lean / OPEN), time >= BITE ? 0.45 : 0) };
  };
  t.draw(END, (g, u) => {
    const q = now(u * END);
    trapSolid(g, q.h, q.J, q.lean, q.open, q.a);
  }, { dark: true, delay });
  t.draw(END, (g, u) => {
    const q = now(u * END);
    trapLight(g, q.h, q.J, q.lean, q.open, q.a);
  }, { delay });
  // BURSTING OUT: earth flung off it as it comes up.
  clods(t, hinge, 5, s, delay);
  t.later(delay, () => {
    for (let i = 0; i < Math.round(6 * t.quality); i++) {
      const a = -Math.PI / 2 + rand(-1.3, 1.3), v = rand(80, 200) * (s / 90);
      t.spark(hinge.x + rand(-0.3, 0.3) * s, hinge.y, Math.cos(a) * v, Math.sin(a) * v, rand(0.3, 0.45), GRIT);
    }
  });
  // THE BITE: a flash down the seam, and sap squirted out of it both ways.
  t.later(delay + BITE + SHUT, () => {
    t.flash({ x: hinge.x, y: hinge.y - J * 0.6 }, ACID, 0.1 * (s / 80));
    const n = Math.round(10 * Math.min(1.4, 0.6 + k * 0.6));
    for (let i = 0; i < n; i++) {
      const y = hinge.y - J * rand(0.25, 0.9), side = i % 2 ? 1 : -1, a = (side > 0 ? 0 : Math.PI) + side * rand(-0.9, -0.1), v = rand(90, 210) * (s / 90);
      t.spark(hinge.x, y, Math.cos(a) * v, Math.sin(a) * v - rand(30, 90) * (s / 90), rand(0.3, 0.5), SAP);
    }
  });
}

/** A meal coming home: a pulse of green power out of the swallowed card,
 *  arcing back across the board to the trap on Snapmaw's staff in `secs`, and
 *  her card lit by it. */
function feed(t: FxTools, from: Pt, to: Pt, s: number, secs: number) {
  const dx = to.x - from.x, dy = to.y - from.y, d = Math.hypot(dx, dy) || 1, bow = d * 0.2 * (dx >= 0 ? 1 : -1);
  const mx = (from.x + to.x) / 2 - (dy / d) * bow, my = (from.y + to.y) / 2 + (dx / d) * bow;
  const along = (q: number) => {
    const e = q * q * (3 - 2 * q), w = 1 - e;
    return { x: w * w * from.x + 2 * w * e * mx + e * e * to.x, y: w * w * from.y + 2 * w * e * my + e * e * to.y };
  };
  const D = secs + 0.15;
  t.draw(D, (g, u) => {
    const time = u * D, q = clamp01(time / secs), a = time < secs ? 1 : 1 - (time - secs) / (D - secs), pts: number[] = [];
    for (let j = 0; j <= 10; j++) {
      const p = along(Math.max(0, q - 0.4) + (j / 10) * Math.min(q, 0.4));
      pts.push(p.x, p.y);
    }
    g.poly(pts, false).stroke({ width: Math.max(3, s * 0.08), color: SAPG, alpha: 0.3 * a, cap: "round", join: "round" });
    g.poly(pts, false).stroke({ width: 2, color: ACID, alpha: 0.9 * a, cap: "round", join: "round" });
    if (time >= secs) return;
    const hd = along(q);
    g.circle(hd.x, hd.y, s * 0.11).fill({ color: ACID, alpha: 0.4 }).circle(hd.x, hd.y, s * 0.05).fill({ color: PALE, alpha: 1 });
  });
  t.later(secs, () => {
    const home = { x: to.x - s * 0.3, y: to.y - s * 0.3, w: s * 0.6, h: s * 0.6 };
    t.glow(home, ACID, 0.5, 0.5, 1.5);
    t.ring(home, ACID, 0.4, 1.6, 0.35, 3);
    for (let i = 0; i < Math.round(8 * t.quality); i++)
      t.spark(to.x + rand(-0.3, 0.6) * s, to.y + rand(0, 0.4) * s, rand(-15, 15) * (s / 90), -rand(50, 100) * (s / 90), rand(0.45, 0.7), FED);
  });
}
