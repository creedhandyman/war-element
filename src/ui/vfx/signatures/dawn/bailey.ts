/** BAILEY — Volley Fire. "3 DMG x2 to the 3 NEAREST opponents in range. Aimed:
 *  it cannot miss." Up to three foes, each shot twice.
 *
 *  His art is a gunslinger in a wide hat and a navy coat firing a heavy golden
 *  rifle, its shot a blazing white-gold BEAM with a starburst at the muzzle;
 *  his card is "Riflemen", and the lore says every rifle is already laid on a
 *  man. So the DELIVERY is the aim, drawn as a firing line: a rifle barrel per
 *  target laid across the front of his card, each with a thin gold sight line
 *  drawing out dead straight to its man, and on each target an aim-diamond
 *  closing in, turning square and LOCKING with a click of light. Nothing is
 *  left to chance: that is the "cannot miss".
 *
 *  The LANDING is two volleys, a beat apart, every rifle on the word at once:
 *  a starburst at each muzzle and a dead-straight white-gold shot-beam to each
 *  target in the same frame, held for an instant and burning down; each hit a
 *  sharp gold impact flare, needles flung on along the shot. The second volley
 *  breaks the locks — the diamonds burst apart — and a target it kills gets a
 *  cross of light struck over it.
 *
 *  Disciplined and simultaneous: a firing line, not a barrage — kept apart from
 *  Kosmos's staggered night-blue meteor shower and Goldspur's tracer rounds.
 *  The barrels are dark for real (`dark: true`), edged in gold so they read
 *  over the card; the sights, shots and flares are sunlight. */
import { centre, rand } from "../../looks/base";
import type { Graphics } from "pixi.js";
import type { FxTools, Pt, SparkStyle } from "../../looks/types";
import type { Signature, SigMoment } from "../types";

// Sunlight, white-hot to deep gold.
const WHITE = 0xffffff, PALE = 0xfff2c0, GOLD = 0xffd04a, DEEP = 0xe8a020;
// The barrels' steel: dark layer only.
const STEEL = 0x0c0a14;
/** Needles of light off a hit, flung on along the shot. */
const NEEDLE: SparkStyle = { palette: [WHITE, PALE, GOLD, DEEP], gravity: 0, drag: 0.05, size: [5.5, 1.5], streak: true };
/** Shards of a lock bursting. */
const SHARD: SparkStyle = { palette: [PALE, GOLD, DEEP], gravity: 0, drag: 0.3, size: [4, 1.5], streak: true };

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeOut = (x: number) => 1 - (1 - x) * (1 - x);

/** The beat between the volleys, s; how long a beam takes to lay itself out
 *  (all but instant — it is a shot); how long it burns. */
const BEAT = 0.22, LAY = 0.035, BURN = 0.2;

// ── The firing line ─────────────────────────────────────────────────────────

/** His rifles: one per target (up to three), muzzles spaced across the front
 *  of his card, each laid on the target on its own side of the line, so no
 *  two sight lines cross. With no target, nothing to lay on. */
function line(m: SigMoment) {
  const c = centre(m.from), s = m.size;
  const ts = m.targets.slice(0, 3).map((r, i) => ({ r, p: centre(r), power: m.power[i] ?? 1, killed: m.killed[i] ?? false }));
  let ax = 0, ay = 0;
  for (const tg of ts) {
    const d = Math.hypot(tg.p.x - c.x, tg.p.y - c.y) || 1;
    ax += (tg.p.x - c.x) / d;
    ay += (tg.p.y - c.y) / d;
  }
  const ang = Math.hypot(ax, ay) > 0.3 ? Math.atan2(ay, ax) : Math.atan2(m.ahead.y, m.ahead.x);
  const ux = Math.cos(ang), uy = Math.sin(ang), nx = -uy, ny = ux;
  const side = (p: Pt) => (p.x - c.x) * nx + (p.y - c.y) * ny;
  ts.sort((a, b) => side(a.p) - side(b.p));
  const n = ts.length;
  return {
    c, s, ux, uy,
    rifles: ts.map((tg, i) => {
      const off = n > 1 ? (i / (n - 1) - 0.5) * s * 0.7 : 0;
      const m0 = { x: c.x + ux * s * 0.36 + nx * off, y: c.y + uy * s * 0.36 + ny * off };
      const dx = tg.p.x - m0.x, dy = tg.p.y - m0.y, d = Math.hypot(dx, dy) || 1;
      return { ...tg, m0, dx, dy, d, vx: dx / d, vy: dy / d };
    }),
  };
}
type Rifle = ReturnType<typeof line>["rifles"][number];

/** A rifle barrel laid on its man: from behind the muzzle out to it, along
 *  the shot. Flat points. */
function barrel(rf: Rifle, s: number): number[] {
  const L = s * 0.34, w = s * 0.03, nx = -rf.vy, ny = rf.vx;
  const b = { x: rf.m0.x - rf.vx * L, y: rf.m0.y - rf.vy * L };
  return [b.x + nx * w * 1.5, b.y + ny * w * 1.5, rf.m0.x + nx * w, rf.m0.y + ny * w, rf.m0.x - nx * w, rf.m0.y - ny * w, b.x - nx * w * 1.5, b.y - ny * w * 1.5];
}

/** An aim-diamond round `p`: a square turned on its point, `R` from centre to
 *  corner, with crosshair ticks standing off its four corners. */
function diamond(g: Graphics, p: Pt, R: number, rot: number, color: number, alpha: number, width: number) {
  if (alpha <= 0.01) return;
  const pts: number[] = [];
  for (let i = 0; i < 4; i++) {
    const a = rot + (i * Math.PI) / 2;
    pts.push(p.x + Math.cos(a) * R, p.y + Math.sin(a) * R);
  }
  g.poly(pts, true).stroke({ width, color, alpha, join: "miter" });
  for (let i = 0; i < 4; i++) {
    const a = rot + (i * Math.PI) / 2, ca = Math.cos(a), sa = Math.sin(a);
    g.moveTo(p.x + ca * R * 1.12, p.y + sa * R * 1.12).lineTo(p.x + ca * R * 1.4, p.y + sa * R * 1.4);
  }
  g.stroke({ width, color, alpha });
}

/** A four-point star: arms `r` along `rot` and `r2` across, waist `w`. */
function star4(g: Graphics, x: number, y: number, r: number, r2: number, w: number, rot: number, color: number, alpha: number) {
  if (alpha <= 0.01 || (r < 0.5 && r2 < 0.5)) return;
  const pts: number[] = [];
  for (let i = 0; i < 8; i++) {
    const a = rot + (i * Math.PI) / 4, d = i % 2 ? w : i % 4 === 0 ? r : r2;
    pts.push(x + Math.cos(a) * d, y + Math.sin(a) * d);
  }
  g.poly(pts).fill({ color, alpha });
}

// ── A shot ──────────────────────────────────────────────────────────────────

/** One rifle FIRING: the muzzle starburst (an eight-point burst, its forward
 *  arm long, as on his art), the beam laid dead straight to the target in
 *  `LAY` and burning down over `BURN`, then the hit — a sharp gold flare
 *  turned to the shot, needles flung on along it. */
function fire(t: FxTools, rf: Rifle, s: number, delay: number, volley: number) {
  const k = Math.max(0.75, Math.min(1.5, rf.power)) * (volley ? 1.1 : 1), ang = Math.atan2(rf.vy, rf.vx), m0 = rf.m0;
  // THE MUZZLE STARBURST.
  t.draw(0.16, (g, u) => {
    const a = 1 - u, R = s * (0.38 + 0.12 * k) * (0.7 + 0.3 * easeOut(clamp01(u * 5)));
    g.circle(m0.x, m0.y, s * 0.14 * (1 + u)).fill({ color: GOLD, alpha: 0.35 * a });
    star4(g, m0.x, m0.y, R * 0.6, R * 0.6, R * 0.08, ang + Math.PI / 4, PALE, 0.8 * a);
    star4(g, m0.x, m0.y, R * 1.3, R * 0.55, R * 0.1, ang, WHITE, a);
    g.circle(m0.x, m0.y, s * 0.05).fill({ color: WHITE, alpha: a });
  }, { delay });
  // THE BEAM: a gold body round a white-hot core, laid out all but at once
  // and held, then thinning away from the muzzle end first.
  const D = LAY + BURN;
  t.draw(D, (g, u) => {
    const time = u * D, e = easeOut(clamp01(time / LAY)), burn = clamp01((time - LAY) / BURN);
    const from = { x: m0.x + rf.dx * burn * 0.85, y: m0.y + rf.dy * burn * 0.85 }, to = { x: m0.x + rf.dx * e, y: m0.y + rf.dy * e };
    const w = s * 0.085 * k * (1 - 0.7 * burn), a = 1 - burn * burn;
    g.moveTo(from.x, from.y).lineTo(to.x, to.y).stroke({ width: w * 2.6, color: GOLD, alpha: 0.2 * a })
      .moveTo(from.x, from.y).lineTo(to.x, to.y).stroke({ width: w, color: PALE, alpha: 0.65 * a })
      .moveTo(from.x, from.y).lineTo(to.x, to.y).stroke({ width: Math.max(1, w * 0.35), color: WHITE, alpha: a });
  }, { delay });

  // THE HIT.
  const hit = delay + LAY;
  t.draw(0.3, (g, u) => {
    const grow = easeOut(clamp01(u / 0.12)), a = 1 - clamp01((u - 0.15) / 0.85), R = s * 0.48 * k * grow;
    star4(g, rf.p.x, rf.p.y, R * 1.25, R * 0.7, R * 0.2, ang, GOLD, 0.4 * a);
    star4(g, rf.p.x, rf.p.y, R, R * 0.55, R * 0.06, ang, WHITE, a);
    star4(g, rf.p.x, rf.p.y, R * 0.5, R * 0.5, R * 0.05, ang + Math.PI / 4, PALE, 0.8 * a);
    g.circle(rf.p.x, rf.p.y, s * 0.07 * k).fill({ color: WHITE, alpha: a });
  }, { delay: hit });
  t.later(hit, () => {
    t.flash(rf.p, GOLD, 0.2 * k * (s / 80));
    t.ring(rf.r, PALE, 0.25, 0.95, 0.25, 2.5);
    const n = Math.round(6 * k);
    for (let i = 0; i < n; i++) {
      const on = i < n * 0.7, q = (on ? ang : ang + Math.PI / 2 * (i % 2 ? 1 : -1)) + rand(-0.12, 0.12), v = rand(180, 320) * (s / 90);
      t.spark(rf.p.x, rf.p.y, Math.cos(q) * v, Math.sin(q) * v, rand(0.15, 0.28), NEEDLE);
    }
  });
}

/** The second volley breaking a lock: the diamond's four sides flung out from
 *  the card and fading — and, on a kill, a cross of light struck over it. */
function breakLock(t: FxTools, rf: Rifle, s: number, delay: number) {
  const R = s * 0.34;
  t.draw(0.35, (g, u) => {
    const out = s * 0.4 * easeOut(u), a = 1 - u;
    for (let i = 0; i < 4; i++) {
      const a0 = (i * Math.PI) / 2, a1 = a0 + Math.PI / 2, mid = a0 + Math.PI / 4;
      const ox = Math.cos(mid) * out, oy = Math.sin(mid) * out;
      g.moveTo(rf.p.x + Math.cos(a0) * R + ox, rf.p.y + Math.sin(a0) * R + oy).lineTo(rf.p.x + Math.cos(a1) * R + ox, rf.p.y + Math.sin(a1) * R + oy);
    }
    g.stroke({ width: 2, color: GOLD, alpha: a });
  }, { delay });
  t.later(delay, () => {
    for (let i = 0; i < Math.round(4 * t.quality) + 1; i++) {
      const q = Math.PI / 4 + (i % 4) * (Math.PI / 2) + rand(-0.2, 0.2), v = rand(80, 150) * (s / 90);
      t.spark(rf.p.x + Math.cos(q) * R * 0.7, rf.p.y + Math.sin(q) * R * 0.7, Math.cos(q) * v, Math.sin(q) * v, rand(0.2, 0.35), SHARD);
    }
  });
  if (!rf.killed) return;
  // The kill: an upright cross of light over the card, struck and held.
  t.draw(0.55, (g, u) => {
    const grow = easeOut(clamp01(u / 0.15)), a = 1 - clamp01((u - 0.3) / 0.7);
    star4(g, rf.p.x, rf.p.y, s * 0.75 * grow, s * 0.5 * grow, s * 0.05, -Math.PI / 2, GOLD, 0.45 * a);
    star4(g, rf.p.x, rf.p.y, s * 0.62 * grow, s * 0.4 * grow, s * 0.025, -Math.PI / 2, WHITE, 0.9 * a);
  }, { delay: delay + 0.04 });
  t.later(delay + 0.04, () => t.ring(rf.r, GOLD, 0.4, 1.3, 0.4, 3));
}

export const BAILEY: Signature = {
  shake: 1.0,
  // A firing line holds its ground.
  lunge: false,

  deliver(t: FxTools, m: SigMoment, seconds: number) {
    const T = seconds, L = line(m), { s } = L;
    if (!L.rifles.length) return;
    const D = T + 0.03, LOCK = T * 0.82;
    const fade = (time: number) => clamp01(time / 0.08);
    // THE RIFLES coming level, one per man, dark steel edged in gold.
    t.draw(D, (g, u) => {
      const a = fade(u * D);
      for (const rf of L.rifles) g.poly(barrel(rf, s), true).fill({ color: STEEL, alpha: 0.85 * a });
    }, { dark: true });
    t.draw(D, (g, u) => {
      const a = fade(u * D);
      for (const rf of L.rifles) {
        g.poly(barrel(rf, s), true).stroke({ width: 1.3, color: GOLD, alpha: 0.9 * a, join: "round" });
        g.circle(rf.m0.x, rf.m0.y, s * 0.03).fill({ color: PALE, alpha: a });
      }
    });
    // THE SIGHTS: a thin gold line drawn out dead straight from each muzzle
    // to its man, a bright bead running at its tip; then the aim-diamond
    // closing in on him, turning square, and LOCKING.
    t.draw(D, (g, u) => {
      const time = u * D;
      L.rifles.forEach((rf, i) => {
        const t0 = T * (0.08 + 0.1 * i), e = easeOut(clamp01((time - t0) / (T * 0.3)));
        if (e <= 0) return;
        const tx = rf.m0.x + rf.dx * e, ty = rf.m0.y + rf.dy * e;
        g.moveTo(rf.m0.x, rf.m0.y).lineTo(tx, ty).stroke({ width: 1, color: GOLD, alpha: 0.75 });
        if (e < 1) g.circle(tx, ty, Math.max(1.5, s * 0.025)).fill({ color: WHITE, alpha: 0.9 });
        const arrive = t0 + T * 0.3, q = clamp01((time - arrive) / Math.max(0.05, LOCK - arrive)), locked = time >= LOCK;
        if (time < arrive) return;
        const R = s * (0.72 - 0.38 * easeOut(q)), rot = (Math.PI / 4) * (1 - easeOut(q));
        const pulse = locked ? 0.8 + 0.2 * Math.sin((time - LOCK) * 40) : 1;
        diamond(g, rf.p, R, rot, locked ? PALE : GOLD, (locked ? 1 : 0.4 + 0.5 * q) * pulse, locked ? 2 : 1.3);
        if (locked) g.circle(rf.p.x, rf.p.y, s * 0.035).fill({ color: WHITE, alpha: 0.9 });
      });
    });
    // The click of each lock.
    t.later(LOCK, () => { for (const rf of L.rifles) t.flash(rf.p, PALE, 0.12 * (s / 80)); });
    for (const rf of L.rifles) t.charge(rf.m0, s * 0.35, GOLD, 0.35, T);
  },

  land(t: FxTools, m: SigMoment) {
    const L = line(m), { s } = L;
    if (!L.rifles.length) return;
    // The locks and the laid lines hold through the first volley; the second
    // breaks them.
    t.draw(BEAT + 0.02, (g, u) => {
      const a = 1 - 0.4 * u;
      for (const rf of L.rifles) {
        g.moveTo(rf.m0.x, rf.m0.y).lineTo(rf.p.x, rf.p.y).stroke({ width: 1, color: GOLD, alpha: 0.4 * a });
        diamond(g, rf.p, s * 0.34, 0, PALE, a, 2);
      }
    });
    // The barrels kick back between volleys and are gone after the second.
    const BD = BEAT + 0.3;
    const kick = (time: number) => s * 0.06 * (Math.exp(-time * 25) + (time > BEAT ? Math.exp(-(time - BEAT) * 25) : 0));
    const laid = (rf: Rifle, time: number) => {
      const kb = kick(time), sh = { ...rf, m0: { x: rf.m0.x - rf.vx * kb, y: rf.m0.y - rf.vy * kb } };
      return barrel(sh, s);
    };
    const ba = (time: number) => 1 - clamp01((time - BEAT - 0.1) / 0.2);
    t.draw(BD, (g, u) => {
      for (const rf of L.rifles) g.poly(laid(rf, u * BD), true).fill({ color: STEEL, alpha: 0.85 * ba(u * BD) });
    }, { dark: true });
    t.draw(BD, (g, u) => {
      for (const rf of L.rifles) g.poly(laid(rf, u * BD), true).stroke({ width: 1.3, color: GOLD, alpha: 0.9 * ba(u * BD), join: "round" });
    });
    // TWO VOLLEYS, every rifle on the same frame.
    for (let v = 0; v < 2; v++) for (const rf of L.rifles) fire(t, rf, s, v * BEAT, v);
    for (const rf of L.rifles) breakLock(t, rf, s, BEAT + LAY);
  },
};
