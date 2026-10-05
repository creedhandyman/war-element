/** GOLDSPUR — Both Barrels. "7 DMG to the 2 nearest opponents, both shots
 *  rolling for a CRIT, and each one it hits is shoved back 1." Both barrels go
 *  at the two nearest foes before the challenge is finished.
 *
 *  Its art is a gunslinger in a wide hat and a long coat of brown-and-gold
 *  feathers, a falcon landing on his arm, wind-swept desert mesas at dusk. So
 *  the DELIVERY is the draw: the falcon on his arm spreads its wings and lifts
 *  off, wheeling away, while the double barrel comes level on the two nearest
 *  foes, both muzzles charging gold.
 *
 *  The LANDING is two gunshots, a beat apart. Each is a gold muzzle flash at
 *  Goldspur and a hot gold TRACER — straight and fast, the one thing in GALE
 *  that flies straight, because it is a bullet — with little curls of wind
 *  peeling off its wake where it tore the air. Where it hits, a gold crit
 *  star (a lawman's six-point star, the crit every shot rolls for), sparks
 *  spraying on along the shot, and a puff of desert dust blown back one
 *  square: the shove. A kill sends a gold feather spinning down over the card.
 *
 *  Gold and dust, not cobalt: kept apart from Bluejay's arrows. The gun and
 *  the falcon are dusk silhouettes, dark for real (`dark: true`) and lit gold
 *  along their edges; the shots, the flashes and the dust are light. */
import { centre, rand } from "../../looks/base";
import type { Graphics } from "pixi.js";
import type { FxTools, Pt, SparkStyle } from "../../looks/types";
import type { Signature, SigMoment } from "../types";

type Box = SigMoment["from"];

const TAU = Math.PI * 2;
// The gunfire: white-hot to gold to amber.
const WHITE = 0xffffff, GOLD_HI = 0xfff0b0, GOLD = 0xffc838, AMBER = 0xffa030;
// Desert dust, lit by the dusk: sand and ochre.
const SAND = 0xf0d098, OCHRE = 0xd8a060;
// The gun's steel and the falcon against the sunset: dark layer only.
const SILHOUETTE = 0x140c06;
/** Sparks off a hit: fast gold, flung on along the shot. */
const RICOCHET: SparkStyle = { palette: [WHITE, GOLD_HI, GOLD, AMBER], gravity: 260, drag: 0.45, size: [6, 1.5], streak: true };
/** Grit blown back off a hit card. */
const GRIT: SparkStyle = { palette: [SAND, OCHRE, 0xa06a30], gravity: 120, drag: 0.5, size: [4, 1.5], streak: false };
/** Gold drawn into the muzzles as they charge. */
const INTAKE: SparkStyle = { palette: [AMBER, GOLD, GOLD_HI], gravity: 0, drag: 1, size: [2, 4], streak: false };
/** Feathers shaken off the falcon as it takes off. */
const DOWN: SparkStyle = { palette: [GOLD_HI, GOLD, AMBER, 0xb06a28], gravity: 60, drag: 0.5, size: [3.5, 1.5], streak: false };

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeOut = (x: number) => 1 - (1 - x) * (1 - x);

/** The bullet's flight, s, and the beat between the barrels. */
const FLY = 0.06, BEAT = 0.08;

// ── The aim ─────────────────────────────────────────────────────────────────

/** Where the gun points (at the pair as a whole), its two muzzles side by
 *  side, and the two shots: barrel i at target i — or, with one foe in
 *  reach, both barrels at it. */
function aim(m: SigMoment) {
  const c = centre(m.from), s = m.size;
  const ts = m.targets.slice(0, 2).map((r, i) => ({ r, p: centre(r), power: m.power[i] ?? 1, killed: m.killed[i] ?? false }));
  let ax = 0, ay = 0;
  for (const tg of ts) {
    const d = Math.hypot(tg.p.x - c.x, tg.p.y - c.y) || 1;
    ax += (tg.p.x - c.x) / d;
    ay += (tg.p.y - c.y) / d;
  }
  const ang = Math.hypot(ax, ay) > 0.3 ? Math.atan2(ay, ax) : Math.atan2(m.ahead.y, m.ahead.x);
  const ux = Math.cos(ang), uy = Math.sin(ang), nx = -uy, ny = ux;
  const muzzle = (i: number): Pt => ({ x: c.x + ux * s * 0.42 + nx * s * 0.04 * (i ? 1 : -1), y: c.y + uy * s * 0.42 + ny * s * 0.04 * (i ? 1 : -1) });
  // Which barrel takes which foe: the one on its own side of the line.
  if (ts.length === 2) {
    const side = (p: Pt) => (p.x - c.x) * nx + (p.y - c.y) * ny;
    if (side(ts[0].p) > side(ts[1].p)) ts.reverse();
  }
  // One foe: both barrels into it, the kill (if it dies) on the second.
  const one = ts.length === 1, shots = one ? [{ ...ts[0], killed: false }, ts[0]] : ts;
  return { c, s, ang, ux, uy, nx, ny, muzzle, shots: shots.map((tg, i) => ({ ...tg, m0: muzzle(i), second: one && i === 1 })) };
}

// ── The gun and the falcon ──────────────────────────────────────────────────

/** The double barrel: two parallel barrels from his grip out to the muzzles
 *  along `ang`, a stock behind. Flat points for the caller to fill. */
function barrels(c: Pt, s: number, ang: number): number[][] {
  const ux = Math.cos(ang), uy = Math.sin(ang), nx = -uy, ny = ux;
  const bar = (off: number) => {
    const a = { x: c.x + ux * s * 0.02 + nx * off, y: c.y + uy * s * 0.02 + ny * off }, w = s * 0.022;
    const b = { x: c.x + ux * s * 0.42 + nx * off, y: c.y + uy * s * 0.42 + ny * off };
    return [a.x - nx * w, a.y - ny * w, b.x - nx * w, b.y - ny * w, b.x + nx * w, b.y + ny * w, a.x + nx * w, a.y + ny * w];
  };
  const k = { x: c.x - ux * s * 0.02, y: c.y - uy * s * 0.02 }, w = s * 0.06;
  const stock = [k.x + nx * w, k.y + ny * w, k.x - ux * s * 0.2 + nx * w * 0.6, k.y - uy * s * 0.2 + ny * w * 0.6 + s * 0.04,
    k.x - ux * s * 0.22 - nx * w * 0.9, k.y - uy * s * 0.22 - ny * w * 0.9 + s * 0.06, k.x - nx * w, k.y - ny * w];
  return [bar(-s * 0.04), bar(s * 0.04), stock];
}

/** A falcon seen from above: body along `head`, a fanned tail, and two
 *  pointed wings out to the side — folded back along the body at `spread` 0,
 *  out at 1, and beating (`flap`, a phase) as it flies. Flat points. */
function falcon(x: number, y: number, head: number, size: number, spread: number, flap: number): number[][] {
  const ux = Math.cos(head), uy = Math.sin(head), nx = -uy, ny = ux;
  const P = (a: number, b: number) => [x + ux * a * size + nx * b * size, y + uy * a * size + ny * b * size];
  const body = [...P(0.42, 0), ...P(0.3, 0.07), ...P(0.05, 0.1), ...P(-0.25, 0.06), ...P(-0.48, 0.17), ...P(-0.5, 0), ...P(-0.48, -0.17),
    ...P(-0.25, -0.06), ...P(0.05, -0.1), ...P(0.3, -0.07)];
  const beat = 0.65 + 0.35 * Math.cos(flap);
  const wing = (side: number) => {
    // Swept from folded (back along the body) to out (across it), the beat
    // foreshortening the span. In body space: `dir` out along the wing,
    // `bk` back from its leading edge toward the tail.
    const sweep = (1 - spread) * 1.2, span = (0.25 + 0.75 * spread) * beat;
    const dir = [-Math.sin(sweep), side * Math.cos(sweep)], bk = [-Math.cos(sweep), -side * Math.sin(sweep)];
    const out = (along: number, back: number) => P(0.12 + dir[0] * along + bk[0] * back, side * 0.06 + dir[1] * along + bk[1] * back);
    // The leading edge out to a pointed tip, then the primaries' notched
    // trailing edge back in to the body.
    return [...P(0.18, side * 0.06), ...out(span * 0.55, -0.05), ...out(span, 0.1), ...out(span * 0.86, 0.2), ...out(span * 0.76, 0.15),
      ...out(span * 0.64, 0.25), ...out(span * 0.5, 0.2), ...out(span * 0.32, 0.27), ...P(-0.12, side * 0.06)];
  };
  return [body, wing(-1), wing(1)];
}

// ── The shot ────────────────────────────────────────────────────────────────

/** A lawman's star, the crit: six points with a ball on each tip, struck out
 *  in an instant and drawn back in as it fades, turning a little. */
function sheriffStar(t: FxTools, p: Pt, R: number, s: number, delay: number) {
  const D = 0.42, rot0 = rand(0, TAU);
  const star = (g: Graphics, len: number, rot: number) => {
    const pts: number[] = [];
    for (let i = 0; i < 12; i++) {
      const a = rot + (i * Math.PI) / 6, rr = i % 2 ? len * 0.48 : len;
      pts.push(p.x + Math.cos(a) * rr, p.y + Math.sin(a) * rr);
    }
    return g.poly(pts, true);
  };
  t.draw(D, (g, u) => {
    const time = u * D, grow = easeOut(clamp01(time / 0.06)), len = R * grow * (1 - 0.35 * clamp01((time - 0.12) / 0.3));
    const a = 1 - clamp01((time - 0.16) / 0.26), rot = rot0 + 0.5 * u;
    star(g, len * 1.25, rot).fill({ color: GOLD, alpha: 0.25 * a });
    star(g, len, rot).fill({ color: GOLD, alpha: 0.38 * a }).stroke({ width: 1.6, color: GOLD_HI, alpha: a, join: "miter" });
    for (let i = 0; i < 6; i++) {
      const q = rot + (i * Math.PI) / 3;
      g.circle(p.x + Math.cos(q) * len, p.y + Math.sin(q) * len, Math.max(1.5, s * 0.025)).fill({ color: GOLD_HI, alpha: a });
    }
    g.circle(p.x, p.y, len * 0.3).stroke({ width: 1.2, color: GOLD_HI, alpha: 0.8 * a });
    g.circle(p.x, p.y, s * 0.05 * (1 - 0.5 * u)).fill({ color: WHITE, alpha: a });
  }, { delay });
}

/** A gold feather, spinning down over the card: a vane either side of a
 *  quill, rocking and turning over as it falls. */
function goldFeather(t: FxTools, p: Pt, s: number, delay: number) {
  const D = 0.9, ph = rand(0, TAU), side = Math.random() < 0.5 ? -1 : 1;
  t.draw(D, (g, u) => {
    const time = u * D, a = clamp01(u * 6) * (1 - clamp01((u - 0.7) / 0.3));
    const x = p.x + side * s * 0.16 * Math.sin(time * 7 + ph), y = p.y - s * 0.35 + s * 0.65 * u;
    const ang = Math.PI / 2 + 0.7 * Math.sin(time * 7 + ph), turn = 0.25 + 0.75 * Math.abs(Math.cos(time * 9 + ph));
    const L = s * 0.42, ux = Math.cos(ang), uy = Math.sin(ang), nx = -uy * turn, ny = ux * turn;
    const pts: number[] = [];
    for (let i = 0; i <= 8; i++) {
      const f = i / 8, w = s * 0.09 * Math.sin(Math.PI * Math.pow(f, 0.7));
      pts.push(x + ux * L * (f - 0.5) + nx * w, y + uy * L * (f - 0.5) + ny * w);
    }
    for (let i = 8; i >= 0; i--) {
      const f = i / 8, w = s * 0.08 * Math.sin(Math.PI * Math.pow(f, 0.7));
      pts.push(x + ux * L * (f - 0.5) - nx * w, y + uy * L * (f - 0.5) - ny * w);
    }
    g.poly(pts, true).fill({ color: GOLD, alpha: 0.6 * a }).stroke({ width: 1.5, color: GOLD_HI, alpha: 0.9 * a, join: "round" });
    g.moveTo(x - ux * L * 0.6, y - uy * L * 0.6).lineTo(x + ux * L * 0.5, y + uy * L * 0.5).stroke({ width: 1.2, color: WHITE, alpha: 0.8 * a });
  }, { delay });
}

/** One barrel FIRING at `p`: the muzzle flash, the tracer laid straight to
 *  the card in `FLY`, curls of wind peeling off its wake — then the hit: the
 *  crit star, sparks on along the shot, and desert dust blown back a square
 *  along `push`. */
function fire(t: FxTools, m0: Pt, r: Box, s: number, power: number, killed: boolean, push: Pt, delay: number, big: number) {
  const p = centre(r), k = Math.max(0.7, Math.min(1.6, power)) * big;
  const dx = p.x - m0.x, dy = p.y - m0.y, d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d, nx = -uy, ny = ux;
  const ang = Math.atan2(uy, ux);
  // THE MUZZLE FLASH: a forward-thrust star of fire and a bloom, gone at once.
  t.draw(0.14, (g, u) => {
    const a = 1 - u, L = s * (0.42 + 0.18 * k) * (0.6 + 0.4 * easeOut(clamp01(u * 4)));
    g.circle(m0.x, m0.y, s * 0.16 * (1 + u)).fill({ color: GOLD, alpha: 0.4 * a });
    for (const [off, len, w] of [[0, 1, 0.07], [0.5, 0.5, 0.05], [-0.5, 0.5, 0.05], [1.4, 0.3, 0.04], [-1.4, 0.3, 0.04]]) {
      const q = ang + off, cq = Math.cos(q), sq = Math.sin(q), W = s * w;
      g.poly([m0.x - sq * W, m0.y + cq * W, m0.x + cq * L * len, m0.y + sq * L * len, m0.x + sq * W, m0.y - cq * W], true)
        .fill({ color: off === 0 ? GOLD_HI : GOLD, alpha: 0.9 * a });
    }
    g.circle(m0.x, m0.y, s * 0.05).fill({ color: WHITE, alpha: a });
  }, { delay });
  // Gun smoke off the muzzle: a little dust-gold, drifting up.
  t.later(delay, () => {
    t.flash(m0, GOLD_HI, 0.22 * (s / 80));
    for (let i = 0; i < Math.round(4 * t.quality) + 1; i++) {
      const a = ang + rand(-0.9, 0.9), v = rand(30, 80) * (s / 90);
      t.spark(m0.x, m0.y, Math.cos(a) * v, Math.sin(a) * v - 30 * (s / 90), rand(0.3, 0.5), GRIT);
    }
  });
  // THE TRACER: a white-hot head with a gold streak behind it, laid dead
  // straight to the card; the line it burned left hanging and thinning.
  const TD = 0.32;
  t.draw(TD, (g, u) => {
    const time = u * TD, e = clamp01(time / FLY), hx = m0.x + dx * e, hy = m0.y + dy * e;
    const tl = Math.max(0, e - (s * 0.9) / d), tx = m0.x + dx * tl, ty = m0.y + dy * tl;
    const burn = 1 - clamp01((time - FLY) / (TD - FLY));
    g.moveTo(m0.x, m0.y).lineTo(hx, hy).stroke({ width: Math.max(1, s * 0.02 * burn), color: GOLD, alpha: 0.5 * burn });
    if (e < 1 || time < FLY + 0.03) {
      g.moveTo(tx, ty).lineTo(hx, hy).stroke({ width: Math.max(3, s * 0.08 * k), color: GOLD, alpha: 0.4, cap: "round" })
        .moveTo(tx, ty).lineTo(hx, hy).stroke({ width: Math.max(1.5, s * 0.03 * k), color: GOLD_HI, alpha: 0.95, cap: "round" });
      g.circle(hx, hy, s * 0.035 * k).fill({ color: WHITE, alpha: 1 });
    }
  }, { delay });
  // The wake: curls of wind peeling off either side where it tore the air.
  const curls = Math.max(3, Math.round((d / s) * 2.2 * t.quality));
  const CD = 0.38;
  const cs = Array.from({ length: curls }, (_, i) => ({ f: (i + 0.6) / (curls + 0.4), side: i % 2 ? 1 : -1, rot: rand(0, TAU) }));
  t.draw(CD + FLY, (g, u) => {
    const time = u * (CD + FLY);
    for (const cl of cs) {
      const q = (time - cl.f * FLY) / CD;
      if (q <= 0 || q >= 1) continue;
      const bx = m0.x + dx * cl.f + nx * cl.side * s * (0.05 + 0.12 * easeOut(q)), by = m0.y + dy * cl.f + ny * cl.side * s * (0.05 + 0.12 * easeOut(q));
      const R = s * (0.07 + 0.09 * easeOut(q)), a0 = ang + Math.PI + cl.side * 0.3;
      g.moveTo(bx + Math.cos(a0) * R, by + Math.sin(a0) * R);
      for (let n = 1; n <= 10; n++) {
        const f = n / 10, th = a0 + cl.side * f * 4.2, rr = R * (1 - 0.7 * f);
        g.lineTo(bx + Math.cos(th) * rr, by + Math.sin(th) * rr);
      }
      g.stroke({ width: 1.6, color: GOLD_HI, alpha: 0.85 * (1 - q), cap: "round" });
    }
  }, { delay });

  // THE HIT.
  const hit = delay + FLY;
  sheriffStar(t, p, s * 0.42 * (0.85 + 0.2 * k), s, hit);
  t.later(hit, () => {
    t.flash(p, GOLD, 0.3 * k * (s / 80));
    t.ring(r, GOLD, 0.25, 1.0 * (0.85 + 0.15 * k), 0.3, 3);
    const n = Math.round(6 + 5 * k);
    for (let i = 0; i < n; i++) {
      const on = i < n * 0.75, a = (on ? ang : ang + Math.PI) + rand(-0.6, 0.6), v = rand(150, 320) * (s / 90) * (on ? 1 : 0.5);
      t.spark(p.x, p.y, Math.cos(a) * v, Math.sin(a) * v, rand(0.18, 0.32), RICOCHET);
    }
    // Grit kicked back off it along the shove.
    const pa = Math.atan2(push.y, push.x);
    for (let i = 0; i < Math.round(5 * k); i++) {
      const a = pa + rand(-0.5, 0.5), v = rand(120, 240) * (s / 90);
      t.spark(p.x + rand(-0.2, 0.2) * s, p.y + rand(-0.2, 0.2) * s, Math.cos(a) * v, Math.sin(a) * v, rand(0.3, 0.5), GRIT);
    }
  });
  // THE DUST: a puff blown back off the card one square along the shove,
  // spreading and thinning as it goes.
  const puffs = Array.from({ length: 5 }, () => ({ off: rand(-0.25, 0.25), lag: rand(0, 0.08), r: rand(0.8, 1.2), go: rand(0.75, 1.05) }));
  const DD = 0.6;
  t.draw(DD, (g, u) => {
    const time = u * DD;
    for (const pf of puffs) {
      const q = clamp01((time - pf.lag) / (DD - pf.lag));
      if (q <= 0) continue;
      const e = easeOut(q), x = p.x + push.x * s * pf.go * e - push.y * s * pf.off, y = p.y + push.y * s * pf.go * e + push.x * s * pf.off;
      const a = Math.min(1, q * 6) * (1 - q);
      g.circle(x, y, s * (0.1 + 0.2 * e) * pf.r).fill({ color: OCHRE, alpha: 0.22 * a }).stroke({ width: 1.2, color: SAND, alpha: 0.35 * a });
    }
  }, { delay: hit });
  if (killed) goldFeather(t, p, s, hit + 0.1);
}

export const GOLDSPUR: Signature = {
  shake: 0.9,
  // He stands and fires; the draw is the wind-up.
  lunge: false,

  deliver(t: FxTools, m: SigMoment, seconds: number) {
    const A = aim(m), { c, s, ang, ux, uy, nx, ny } = A, T = seconds;
    if (!A.shots.length) return;
    // THE GUN coming level: swung up from his hip onto the pair.
    const swing = (u: number) => ang + 0.9 * (1 - easeOut(clamp01(u / 0.45)));
    t.draw(T + 0.15, (g, u) => {
      const time = u * (T + 0.15), a = clamp01(time / 0.08) * (1 - clamp01((time - T) / 0.15));
      for (const pts of barrels(c, s, swing(time / T))) g.poly(pts, true).fill({ color: SILHOUETTE, alpha: 0.85 * a });
    }, { dark: true });
    t.draw(T + 0.15, (g, u) => {
      const time = u * (T + 0.15), a = clamp01(time / 0.08) * (1 - clamp01((time - T) / 0.15));
      for (const pts of barrels(c, s, swing(time / T))) g.poly(pts, true).stroke({ width: 1.3, color: GOLD, alpha: 0.85 * a, join: "round" });
    });
    // Both muzzles charging gold, gold drawn into them.
    for (const i of [0, 1]) t.charge(A.muzzle(i), s * 0.5, GOLD, 0.4, T);
    for (let i = 0; i < Math.round(10 * t.quality); i++) {
      const life = rand(0.12, 0.2), at = rand(0.45, 0.95) * T - life, mz = A.muzzle(i % 2), th = rand(0, TAU), dd = s * rand(0.18, 0.3);
      const sx = mz.x + Math.cos(th) * dd, sy = mz.y + Math.sin(th) * dd;
      t.later(Math.max(0, at), () => t.spark(sx, sy, (mz.x - sx) / life, (mz.y - sy) / life, life, INTAKE));
    }

    // THE FALCON: on his arm beside the gun, wings spreading, then off —
    // wheeling up and away over the card on beating wings.
    const side = -1, perch = { x: c.x + nx * side * s * 0.32 - ux * s * 0.05, y: c.y + ny * side * s * 0.32 - uy * s * 0.05 };
    const LIFT = T * 0.4, FD = T + 0.35;
    const where = (time: number) => {
      const q = clamp01((time - LIFT) / (FD - LIFT)), e = q * q * (3 - 2 * q);
      // Out to its side and forward, curving round: a bird, not a bullet.
      const out = s * 0.9 * e, fwd = s * 0.8 * Math.sin(e * Math.PI * 0.8);
      return {
        x: perch.x + nx * side * out + ux * fwd, y: perch.y + ny * side * out + uy * fwd,
        head: ang + side * (0.4 + 1.6 * e), q,
      };
    };
    const bird = (time: number) => {
      const w = where(time), spread = easeOut(clamp01(time / LIFT)), flap = time < LIFT * 0.6 ? 0 : (time - LIFT * 0.6) * 26;
      return falcon(w.x, w.y, w.head, s * 0.42 * (1 + 0.25 * w.q), spread, flap);
    };
    const fa = (time: number) => clamp01(time / 0.08) * (1 - clamp01((time - (FD - 0.15)) / 0.15));
    t.draw(FD, (g, u) => {
      const time = u * FD, a = fa(time);
      for (const pts of bird(time)) g.poly(pts, true).fill({ color: SILHOUETTE, alpha: 0.85 * a });
    }, { dark: true });
    t.draw(FD, (g, u) => {
      const time = u * FD, a = fa(time);
      for (const pts of bird(time)) g.poly(pts, true).fill({ color: AMBER, alpha: 0.12 * a }).stroke({ width: 1.3, color: GOLD_HI, alpha: 0.85 * a, join: "round" });
    });
    // A few feathers shaken loose as it beats off.
    t.later(LIFT, () => {
      for (let i = 0; i < Math.round(5 * t.quality) + 1; i++) {
        const a = rand(0, TAU), v = rand(30, 90) * (s / 90);
        t.spark(perch.x, perch.y, Math.cos(a) * v, Math.sin(a) * v, rand(0.35, 0.55), DOWN);
      }
    });
  },

  land(t: FxTools, m: SigMoment) {
    const A = aim(m), push = { x: m.ahead.x, y: m.ahead.y };
    A.shots.forEach((sh, i) => fire(t, sh.m0, sh.r, A.s, sh.power, sh.killed, push, i * BEAT, sh.second ? 1.15 : 1));
  },
};
