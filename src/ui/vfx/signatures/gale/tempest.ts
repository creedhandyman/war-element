/** TEMPEST — Cyclone Strike. "Charge up to 3 slots and strike one opponent for
 *  8 DMG (PEN). A kill leaves Tempest standing in its place." Three slots of
 *  open ground mean nothing to it; half your swings find only the place it
 *  was.
 *
 *  Its art is a feathered warrior spinning inside an AMBER WHIRLWIND of curved
 *  blades and wind-ribbons, steel glinting white in it, a fiery sunset field
 *  under it. So Tempest is not drawn as a figure at all: it IS the cyclone.
 *  Seen from above — not GALE's side-on dust-devil, and not Stormfang's
 *  funnel laid on its side — a disc of spiralling wind-ribbons with a ring of
 *  crescent blades riding its rim.
 *
 *  The DELIVERY is the charge. It spins up where it stands — the ribbons
 *  winding in, the blades coming round faster — and then tears across from
 *  `m.from` toward its mark, still spinning, carving its track into the
 *  ground behind it: the looping spiral a blade on its rim scores as the whole
 *  thing travels, dust and grass kicked off it. It draws its own charge (no
 *  lunge); the token jumps to `m.to` as the step lands.
 *
 *  The LANDING is the strike: the cyclone drives onto the card and its blades
 *  rake through it — crescent cuts whipping round and through the card on
 *  different radii, white steel in an amber wake — and two blades fly on OUT
 *  the far side (PEN). Dust and grass are blasted outward. Then it pulls back
 *  to where Tempest stands and spins down; on a kill it has the square: the
 *  cyclone settles on it and unwinds, its ribbons opening out and the dust
 *  coming down.
 *
 *  Everything is light (additive) — sunset amber, peach and cream, white steel
 *  on the blades — except the scored track, which is ground for real (dark),
 *  lit along its edge. */
import { centre, rand } from "../../looks/base";
import type { Graphics } from "pixi.js";
import type { FxTools, Pt, SparkStyle } from "../../looks/types";
import type { Signature, SigMoment } from "../types";

const TAU = Math.PI * 2;
// The sunset in it: cream to peach to amber to burnt orange; steel on the blades.
const CREAM = 0xfff4e0, PEACH = 0xffd9a0, AMBER = 0xffa040, SUNSET = 0xff7426, STEEL = 0xeef6ff;
/** The track it scores (dark layer) and the dust lit along it. */
const SCAR = 0x1a0e06, SCAR_LIT = 0xe0a060;
const RIBBONS = [PEACH, AMBER, CREAM, SUNSET];

/** Dust whipped off its rim: turning round where it was flung. */
const DUST: SparkStyle = { palette: [CREAM, PEACH, AMBER, SUNSET], gravity: 0, drag: 0.35, size: [6, 2], streak: true, swirl: 800 };
/** Grass cut and thrown: gold-green blades, falling out of the wind. */
const GRASS: SparkStyle = { palette: [0xf6e690, 0xd8c860, 0xb0a040, 0x8a6a28], gravity: 260, drag: 0.5, size: [6, 2], streak: true };
/** Sparks off the steel as the blades go through. */
const STRIKE: SparkStyle = { palette: [0xffffff, STEEL, PEACH, AMBER], gravity: 150, drag: 0.4, size: [7, 2], streak: true };

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeOut = (x: number) => 1 - (1 - x) * (1 - x);
const easeIn = (x: number) => x * x;
/** Up over the first `a` of 0..1, down over the last `b`. */
const env = (u: number, a: number, b: number) => Math.max(0, Math.min(1, u / a, (1 - u) / b));

/** Its run: from its square to where its rim meets the card it strikes (the
 *  centre stopping `R` short of the card's middle), and the line of it. Worked
 *  out the same for the delivery and the landing. */
function runOf(m: SigMoment) {
  const s = m.size, c0 = centre(m.from);
  const p = m.targets.length ? centre(m.targets[0]) : { x: centre(m.to).x + m.ahead.x * s, y: centre(m.to).y + m.ahead.y * s };
  const dx = p.x - c0.x, dy = p.y - c0.y, d = Math.hypot(dx, dy) || 1, u = { x: dx / d, y: dy / d };
  const end = { x: p.x - u.x * s * 0.55, y: p.y - u.y * s * 0.55 };
  return { c0, p, u, end, R: s * 0.46 };
}

/** The cyclone seen from above, centred on `c`, `R` across its rim, turned to
 *  `spin`: four wind-ribbons spiralling out from the eye (bold at their outer
 *  heads, thin where they wind in), a ring of three crescent blades riding the
 *  rim with white steel on their leading edges, and amber light in the eye.
 *  `open` (0..1) unwinds it: the ribbons loosen and spread as it dies. */
function cyclone(g: Graphics, c: Pt, R: number, spin: number, alpha: number, open = 0) {
  if (alpha <= 0.02 || R < 2) return;
  g.circle(c.x, c.y, R * 1.05).fill({ color: SUNSET, alpha: 0.1 * alpha });
  g.circle(c.x, c.y, R * 0.3).fill({ color: AMBER, alpha: 0.22 * alpha });
  for (let j = 0; j < 4; j++) {
    const a0 = spin + (j * TAU) / 4, len = 2.6 * (1 - 0.55 * open), rOut = R * (0.95 + 0.4 * open), pts: number[] = [];
    for (let i = 0; i <= 12; i++) {
      const f = i / 12, r = R * 0.12 + (rOut - R * 0.12) * f, th = a0 + len * (1 - f);
      pts.push(c.x + Math.cos(th) * r, c.y + Math.sin(th) * r);
    }
    g.poly(pts, false).stroke({ width: Math.max(1, R * 0.05), color: RIBBONS[j], alpha: 0.45 * alpha, cap: "round", join: "round" });
    g.poly(pts.slice(12), false).stroke({ width: Math.max(1.8, R * 0.1), color: RIBBONS[j], alpha: 0.9 * alpha, cap: "round", join: "round" });
  }
  if (open >= 0.95) return;
  const ba = alpha * (1 - open);
  for (let j = 0; j < 3; j++) blade(g, c, R * 0.82, spin * 1.3 + (j * TAU) / 3, 0.95, R * 0.24, ba);
}

/** A crescent blade riding round `c` at radius `r`, its middle at angle `a`,
 *  `span` radians long and `thick` at its belly: a lune bulging outward, amber
 *  through, white steel along its outer edge, leading point first. */
function blade(g: Graphics, c: Pt, r: number, a: number, span: number, thick: number, alpha: number) {
  if (alpha <= 0.02) return;
  const inner: number[] = [], outer: number[] = [], back: number[] = [];
  for (let i = 0; i <= 10; i++) {
    const f = i / 10, th = a + (f - 0.5) * span, ro = r + thick * Math.sin(Math.PI * Math.pow(f, 0.8));
    inner.push(c.x + Math.cos(th) * r, c.y + Math.sin(th) * r);
    outer.push(c.x + Math.cos(th) * ro, c.y + Math.sin(th) * ro);
    back.unshift(c.x + Math.cos(th) * ro, c.y + Math.sin(th) * ro);
  }
  const body = inner.concat(back);
  g.poly(body, true).fill({ color: AMBER, alpha: 0.55 * alpha });
  g.poly(outer, false).stroke({ width: 1.6, color: STEEL, alpha: 0.95 * alpha });
}

/** Grass and dust kicked off the rim, tangential, rate-based. */
function kick(t: FxTools, c: Pt, R: number, spin: number, s: number, dt: number, rate: number, acc: { n: number }) {
  acc.n += dt * rate * t.quality;
  for (; acc.n >= 1; acc.n--) {
    const a = spin + rand(0, TAU), v = rand(70, 150) * (s / 90), x = c.x + Math.cos(a) * R, y = c.y + Math.sin(a) * R;
    // Tangential to the spin, a little outward: thrown off the rim.
    const tx = -Math.sin(a) + Math.cos(a) * 0.4, ty = Math.cos(a) + Math.sin(a) * 0.4;
    t.spark(x, y, tx * v, ty * v, rand(0.25, 0.45), Math.random() < 0.3 ? GRASS : DUST, c);
  }
}

export const TEMPEST: Signature = {
  shake: 1.1,
  // It is the charge: the token jumps to `m.to` as the step lands.
  lunge: false,

  deliver(t: FxTools, m: SigMoment, seconds: number) {
    const s = m.size, T = seconds, { c0, end, R } = runOf(m);
    const WIND = T * 0.32, RUN = T - WIND;
    /** Where its eye is, how big and how far round it has turned, `time` in. */
    const at = (time: number) => {
      const k = clamp01((time - WIND) / RUN), e = easeIn(k) * 0.55 + k * 0.45;
      const spin = 12 * time + 40 * time * time; // spinning up the whole way
      return { x: c0.x + (end.x - c0.x) * e, y: c0.y + (end.y - c0.y) * e, R: R * (0.45 + 0.55 * easeOut(clamp01(time / WIND))), spin, k };
    };
    t.charge(c0, s * 1.1, AMBER, 0.3, WIND);
    // THE TRACK: the looping spiral a rim blade scores as the whole thing
    // travels — ground, dark, its edge lit with dust — laid as it goes.
    const track = (time: number) => {
      const pts: number[] = [], n = 48;
      for (let i = 0; i <= n; i++) {
        const q = at(WIND * 0.6 + ((time - WIND * 0.6) * i) / n), th = q.spin * 1.3;
        pts.push(q.x + Math.cos(th) * q.R * 0.82, q.y + Math.sin(th) * q.R * 0.82);
      }
      return pts;
    };
    const FADE = 0.35, D = T + FADE;
    const gone = (time: number) => 1 - clamp01((time - T) / FADE);
    t.draw(D, (g, v) => {
      const time = Math.min(v * D, T);
      if (time <= WIND * 0.6) return;
      g.poly(track(time), false).stroke({ width: Math.max(3, s * 0.08), color: SCAR, alpha: 0.65 * gone(v * D), cap: "round", join: "round" });
    }, { dark: true });
    t.draw(D, (g, v) => {
      const time = Math.min(v * D, T);
      if (time <= WIND * 0.6) return;
      const pts = track(time), a = gone(v * D);
      g.poly(pts, false).stroke({ width: Math.max(4, s * 0.07), color: AMBER, alpha: 0.16 * a, cap: "round", join: "round" });
      g.poly(pts, false).stroke({ width: 1.5, color: SCAR_LIT, alpha: 0.8 * a, cap: "round", join: "round" });
    });
    // THE CYCLONE: spinning up, then tearing across, throwing dust and grass.
    const acc = { n: 0 };
    t.draw(T, (g, v, dt) => {
      const time = v * T, q = at(time);
      cyclone(g, q, q.R, q.spin, clamp01(time / (WIND * 0.4)));
      kick(t, q, q.R, q.spin, s, dt, 25 + 45 * q.k, acc);
    });
    // Wind drawn in as it spins up: streaks curling in to the eye.
    t.emit({ count: 10, palette: [CREAM, PEACH, AMBER], from: { x: c0.x - s * 0.7, y: c0.y - s * 0.7, w: s * 1.4, h: s * 1.4 }, at: "ring",
      speed: [90, 160], gravity: 0, drag: 0.5, life: [0.25, 0.35], size: [5, 1.5], streak: true, swirl: 600 });
  },

  land(t: FxTools, m: SigMoment) {
    if (!m.targets.length) return;
    const s = m.size, { p, u, end, R } = runOf(m), r = m.targets[0], killed = !!m.killed[0];
    const k = Math.max(0.8, Math.min(1.6, m.power[0] ?? 1)), home = killed ? p : centre(m.to);
    const IN = 0.08, HOLD = 0.3, D = killed ? 1.0 : 0.62;
    // THE CYCLONE: driven onto the card, spinning flat out as its blades go
    // through; then back to where Tempest stands and spun down — or, on a
    // kill, settled on the square and unwinding.
    const acc = { n: 0 };
    t.draw(D, (g, v, dt) => {
      const time = v * D;
      let c: Pt, a = 1, open = 0, rr = R;
      if (time < IN) c = { x: end.x + (p.x - end.x) * easeOut(time / IN), y: end.y + (p.y - end.y) * easeOut(time / IN) };
      else if (time < HOLD) { c = p; a = 0.6; rr = R * (1 - 0.35 * easeOut(clamp01((time - IN) / 0.08))); }
      else {
        const f = clamp01((time - HOLD) / (D - HOLD));
        c = { x: p.x + (home.x - p.x) * easeOut(clamp01(f * 2)), y: p.y + (home.y - p.y) * easeOut(clamp01(f * 2)) };
        // Out of the card it swells back to size: to unwind on a kill, or to
        // spin down where Tempest stands.
        if (killed) { open = easeOut(f); rr = R * (0.65 + 0.5 * easeOut(f)); a = 0.75 * (1 - f * f); }
        else { rr = R * (0.65 + 0.3 * Math.sin(Math.PI * f)) * (1 - 0.4 * f); a = 0.75 * (1 - f); }
      }
      // Flat out through the strike, then the spin bleeding off as it dies.
      const ang = 30 * Math.min(time, HOLD) + (time > HOLD ? 7.5 * (1 - Math.exp(-(time - HOLD) / 0.25)) : 0);
      cyclone(g, c, rr, ang, a, open);
      if (time < HOLD + 0.1) kick(t, c, rr, ang, s, dt, 60, acc);
    });
    // THE RAKE: crescent cuts whipping round and through the card, one after
    // another round the clock — each a scythe-swing on a circle centred off
    // the card, so its arc runs across the card's face and out again.
    const n = 5, dir = Math.random() < 0.5 ? 1 : -1, phi0 = rand(0, TAU);
    for (let i = 0; i < n; i++) {
      const phi = phi0 + (i * TAU * dir) / n, cc = { x: p.x + Math.cos(phi) * s * 0.42, y: p.y + Math.sin(phi) * s * 0.5 };
      rakeCut(t, cc, s * 0.6, phi + Math.PI - 1.0 * dir, 2.0 * dir, s, IN * 0.5 + i * 0.04);
    }
    t.later(IN * 0.7, () => {
      t.flash(p, PEACH, 0.12 * k * (s / 80));
      t.glow(r, AMBER, 0.3, 0.45, 1.05);
      t.ring(r, CREAM, 0.3, 1.1 * Math.min(1.3, k), 0.35, 3);
      // Dust and grass blasted outward.
      for (let i = 0; i < Math.round(20 * k); i++) {
        const a = rand(0, TAU), v = rand(120, 260) * (s / 90);
        t.spark(p.x, p.y, Math.cos(a) * v, Math.sin(a) * v - 40 * (s / 90), rand(0.3, 0.5), i % 3 ? DUST : GRASS, p);
      }
      for (let i = 0; i < Math.round(8 * k); i++) {
        const a = rand(0, TAU), v = rand(160, 300) * (s / 90);
        t.spark(p.x + Math.cos(a) * s * 0.2, p.y + Math.sin(a) * s * 0.2, -Math.sin(a) * v * dir, Math.cos(a) * v * dir, rand(0.18, 0.3), STRIKE);
      }
    });
    // PEN: two blades fly on out the far side, still spinning.
    for (const sd of [-1, 1]) {
      const a = Math.atan2(u.y, u.x) + sd * 0.32, ux = Math.cos(a), uy = Math.sin(a), FLY = 0.38, go = s * 1.25;
      t.draw(FLY, (g, v) => {
        const d = s * 0.15 + go * easeOut(v), c = { x: p.x + ux * d, y: p.y + uy * d }, al = 1 - v * v;
        blade(g, c, s * 0.12, v * 22 * dir + sd, 2.2, s * 0.13, al);
        g.moveTo(p.x + ux * s * 0.15, p.y + uy * s * 0.15).lineTo(c.x, c.y).stroke({ width: 2, color: PEACH, alpha: 0.55 * al * (1 - v) });
      }, { delay: IN + 0.06 });
    }
    // A kill: the dust it raised coming down round the square as it settles.
    if (killed)
      t.later(0.45, () => t.emit({ count: 10, palette: [PEACH, AMBER, SUNSET], from: { x: p.x - s * 0.5, y: p.y - s * 0.5, w: s, h: s * 0.6 },
        at: "area", speed: [5, 20], gravity: 60, drag: 0.6, life: [0.45, 0.6], size: [4, 1.5], swirl: 120 }));
  },
};

/** One blade's cut whipping round `c` at radius `rad`: its head (a crescent,
 *  white steel) sweeping `sweep` radians in a blink, an amber-and-white arc
 *  left in its wake, which fades. */
function rakeCut(t: FxTools, c: Pt, rad: number, a0: number, sweep: number, s: number, delay: number) {
  const D = 0.42, GO = 0.12;
  t.draw(D, (g, v) => {
    const time = v * D, h = easeOut(clamp01(time / GO)), head = a0 + sweep * h, tail = a0 + sweep * Math.max(0, h - 0.75);
    const a = time < GO ? 1 : 1 - (time - GO) / (D - GO);
    const lo = Math.min(head, tail), hi = Math.max(head, tail);
    if (hi - lo > 0.01) {
      g.moveTo(c.x + Math.cos(lo) * rad, c.y + Math.sin(lo) * rad).arc(c.x, c.y, rad, lo, hi).stroke({ width: Math.max(5, s * 0.1), color: AMBER, alpha: 0.35 * a });
      g.moveTo(c.x + Math.cos(lo) * rad, c.y + Math.sin(lo) * rad).arc(c.x, c.y, rad, lo, hi).stroke({ width: Math.max(2, s * 0.032), color: STEEL, alpha: 0.95 * a });
    }
    if (time < GO + 0.04) blade(g, c, rad, head - Math.sign(sweep) * 0.3, 0.8, s * 0.09, env(clamp01(time / (GO + 0.04)), 0.1, 0.4));
  }, { delay });
}
