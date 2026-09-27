/** EQUESTRIAN — Solar Horse Power. "Charge straight ahead, dealing 15 DMG to
 *  opponents in the column and pushing the leader to the farthest slot.
 *  Opponents it passes in the columns beside it take 4 DMG" — the order does
 *  not permit its people to be diminished.
 *
 *  The DELIVERY is a charge with the sun behind it. The sun comes up at the
 *  card's back — a disc cresting there, its rays fanning, a flare across it —
 *  while hooves paw the ground, golden sparks kicked back off every strike.
 *  Then the sun itself goes forward: straight ahead, a blazing disc at the head
 *  of the rush with a bow of light before it, a wake of gold burning down the
 *  lane behind it and hoofprints struck into the ground either side. Whatever
 *  it rides past in the columns beside it is showered with sparks as it goes
 *  by. The disc meets the front of the square it ends on as the delivery ends.
 *
 *  The LANDING is the impact: a sunburst on every card in the column, nearest
 *  first — and the leader, the one it hit, SHOVED: a golden shockwave off it
 *  and a streak of light driving on down the column to the farthest slot,
 *  where it is going. The cards it rode past take a spray of needles of light.
 *  Where it stands, its hooves strike a ring of light into the ground. Nothing
 *  it does is taken in: the light only ever goes out from it.
 *
 *  Straight ahead is `m.ahead`, never "up": the board is drawn flipped for the
 *  other player. A charge that reached nothing gets no delivery, so its landing
 *  draws the whole rush. */
import { centre, rand } from "../looks/base";
import type { Graphics } from "pixi.js";
import type { FxTools, Pt, SparkStyle } from "../looks/types";
import type { Signature, SigMoment } from "./types";

type Box = { x: number; y: number; w: number; h: number };

const TAU = Math.PI * 2;
const WHITE = 0xffffff, PALE = 0xfff1b3, GOLD = 0xffd54f, DEEP = 0xe0a41c, WARM = 0xffe38a;
/** The sun's radius, in squares. */
const SUN = 0.26;

/** Glitter's palette: a mote walks it as it ages, flicking between white-hot
 *  and deep gold — the walk is the twinkle. */
const GLINT = [WHITE, DEEP, WHITE, GOLD, PALE, DEEP, WHITE, DEEP];
/** A needle of light: dead straight and fast. Light does not fall. */
const NEEDLE: SparkStyle = { palette: [WHITE, PALE, GOLD], gravity: 0, drag: 0.03, size: [6, 2], streak: true };
/** Sparks struck off a hoof: hot, thrown back, and — being struck metal, not
 *  light — dropping as they cool. */
const STRUCK: SparkStyle = { palette: [WHITE, WARM, GOLD, DEEP], gravity: 420, drag: 0.35, size: [6, 2], streak: true };

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeOut = (x: number) => 1 - (1 - x) * (1 - x);
/** 0 -> 1 as `u` runs from `a` to `b`. */
const span = (u: number, a: number, b: number) => clamp01((u - a) / (b - a));

// ── DAWN's shapes ───────────────────────────────────────────────────────────

/** A four-point star: two long arms (`r` along `rot`, `r2` across it) pinched
 *  to a waist `w` — DAWN's own mark. */
function star(g: Graphics, x: number, y: number, r: number, r2: number, w: number, rot: number, color: number, alpha: number) {
  if (alpha <= 0.01 || (r < 0.5 && r2 < 0.5)) return;
  const pts: number[] = [];
  for (let i = 0; i < 8; i++) {
    const a = rot + (i * Math.PI) / 4, d = i % 2 ? w : i % 4 === 0 ? r : r2;
    pts.push(x + Math.cos(a) * d, y + Math.sin(a) * d);
  }
  g.poly(pts).fill({ color, alpha });
}

/** A lens flare: a soft gold star behind a white one, a hot dot at its heart;
 *  `wide` stretches it along `rot`. */
function flare(g: Graphics, x: number, y: number, r: number, alpha: number, rot = 0, wide = 1) {
  if (alpha <= 0.01 || r < 0.5) return;
  star(g, x, y, r * 1.3 * wide, r * 1.3, r * 0.2, rot, GOLD, alpha * 0.4);
  star(g, x, y, r * wide, r, r * 0.07, rot, WHITE, alpha);
  g.circle(x, y, r * 0.16).fill({ color: PALE, alpha: alpha * 0.8 });
}

/** The sun: a white-hot disc in gold, ringed by a corona of rays, long and
 *  short in turn, turning with `spin`. */
function sun(g: Graphics, c: Pt, R: number, spin: number, alpha: number) {
  if (alpha <= 0.01 || R < 0.5) return;
  g.circle(c.x, c.y, R * 1.6).fill({ color: GOLD, alpha: 0.12 * alpha });
  g.circle(c.x, c.y, R).fill({ color: GOLD, alpha: 0.45 * alpha });
  g.circle(c.x, c.y, R * 0.72).fill({ color: PALE, alpha: 0.7 * alpha });
  g.circle(c.x, c.y, R * 0.42).fill({ color: WHITE, alpha });
  g.circle(c.x, c.y, R * 1.08).stroke({ width: 1.8, color: WARM, alpha: 0.9 * alpha });
  for (let i = 0; i < 12; i++) {
    const a = spin + (i / 12) * TAU, l = R * (i % 2 ? 0.35 : 0.7), ca = Math.cos(a), sa = Math.sin(a);
    g.moveTo(c.x + ca * R * 1.2, c.y + sa * R * 1.2).lineTo(c.x + ca * (R * 1.2 + l), c.y + sa * (R * 1.2 + l));
  }
  g.stroke({ width: 2, color: PALE, alpha: 0.75 * alpha });
}

/** The sun cresting a horizon — the line through `h` square to `a`: only the
 *  part of the disc (centre `c`, radius `R`) that has cleared it, and its rays
 *  fanning out from it over the side it is rising on, `len` long. */
function sunrise(g: Graphics, c: Pt, R: number, h: Pt, a: Pt, len: number, alpha: number) {
  if (alpha <= 0.01) return;
  const up = (c.x - h.x) * a.x + (c.y - h.y) * a.y, base = Math.atan2(a.y, a.x);
  if (up <= -R) return;
  const half = Math.PI / 2 + Math.asin(Math.max(-0.98, Math.min(0.98, up / R)));
  const rays = 9;
  for (let i = 0; i < rays; i++) {
    const t = base + (-1 + (2 * (i + 0.5)) / rays) * 1.3, l = len * (i % 2 ? 0.62 : 1), hw = i % 2 ? 0.03 : 0.045;
    g.poly([c.x, c.y, c.x + Math.cos(t - hw) * l, c.y + Math.sin(t - hw) * l, c.x + Math.cos(t + hw) * l, c.y + Math.sin(t + hw) * l])
      .fill({ color: i % 2 ? PALE : GOLD, alpha: 0.3 * alpha });
  }
  const disc: number[] = [];
  for (let i = 0; i <= 18; i++) {
    const t = base - half + (2 * half * i) / 18;
    disc.push(c.x + Math.cos(t) * R, c.y + Math.sin(t) * R);
  }
  g.poly(disc).fill({ color: PALE, alpha: 0.7 * alpha }).stroke({ width: 3, color: GOLD, alpha: 0.5 * alpha });
}

/** A horseshoe struck into the ground: open to the heel (behind it), toe to
 *  `ang` — gold, with a glint on it as it is struck. */
function horseshoe(g: Graphics, x: number, y: number, ang: number, r: number, alpha: number, glint: number) {
  if (alpha <= 0.01) return;
  g.moveTo(x + Math.cos(ang - 2) * r, y + Math.sin(ang - 2) * r).arc(x, y, r, ang - 2, ang + 2)
    .stroke({ width: 2.2, color: WARM, alpha, cap: "round" });
  if (glint > 0.01) star(g, x + Math.cos(ang) * r, y + Math.sin(ang) * r, r * 1.6 * glint, r * 1.6 * glint, r * 0.12, 0, WHITE, glint);
}

// ── The charge ──────────────────────────────────────────────────────────────

/** Everything the delivery and the landing agree on. The charge runs along a
 *  straight line from the card, `ahead`: `P(d)` is the point `d` px along it
 *  (negative behind the card). The column is the targets on that line — the
 *  leader the nearest past where the charge stops — and the flanks the ones it
 *  rode past beside it. The sun rises over the card's back edge (`horizon`),
 *  goes from `from`, and the charge hits at `hit`: where the square it ends on
 *  meets the leader, or just past that square's middle when nothing stood in
 *  the lane. */
function charge(m: SigMoment) {
  const s = m.size, a = m.ahead, c0 = centre(m.from), cTo = centre(m.to);
  const P = (d: number): Pt => ({ x: c0.x + a.x * d, y: c0.y + a.y * d });
  const along = (q: Pt) => (q.x - c0.x) * a.x + (q.y - c0.y) * a.y;
  const across = (q: Pt) => (q.x - c0.x) * -a.y + (q.y - c0.y) * a.x;
  const stop = along(cTo);
  const column: number[] = [], flank: number[] = [];
  m.targets.forEach((r, i) => (Math.abs(across(centre(r))) < s * 0.5 ? column : flank).push(i));
  column.sort((i, j) => along(centre(m.targets[i])) - along(centre(m.targets[j])));
  const lead: number | undefined = column.find((i) => along(centre(m.targets[i])) > stop + s * 0.2) ?? column[0];
  const hit = lead !== undefined ? Math.max(stop + s * 0.2, (stop + along(centre(m.targets[lead]))) / 2) : stop + s * 0.32;
  return { s, a, c0, P, along, horizon: -s * 0.46, from: -s * 0.46 + SUN * s * 0.5, hit, column, flank, lead };
}

/** Where the sun is along the line, `v` (0..1) into the rush: faster every
 *  frame — a charge gathers — and at the point of impact at the end. */
const rush = (from: number, hit: number, v: number) => from + (hit - from) * v * (0.25 + 0.75 * v);

/** The blazing wake down the lane behind the sun, from `d0` to `d1` along
 *  the line: a gold band tapering to nothing behind, a paler core, a white-hot
 *  line down its middle. */
function wake(g: Graphics, C: ReturnType<typeof charge>, d0: number, d1: number, w: number, alpha: number) {
  if (d1 - d0 < 2 || alpha <= 0.01) return;
  const a = C.a, nx = -a.y, ny = a.x, t0 = C.P(d0), t1 = C.P(d1);
  const band = (half: number, color: number, al: number) =>
    g.poly([t0.x + nx * half * 0.12, t0.y + ny * half * 0.12, t1.x + nx * half, t1.y + ny * half,
      t1.x - nx * half, t1.y - ny * half, t0.x - nx * half * 0.12, t0.y - ny * half * 0.12]).fill({ color, alpha: al });
  band(w, GOLD, 0.22 * alpha);
  band(w * 0.45, PALE, 0.4 * alpha);
  g.moveTo(t0.x, t0.y).lineTo(t1.x, t1.y).stroke({ width: 2, color: WHITE, alpha: 0.8 * alpha });
}

/** How far to the farthest slot down the line from `p`: to the board's edge,
 *  less half a square. */
function toFarSlot(p: Pt, a: Pt, b: Box, s: number): number {
  let d = Infinity;
  if (a.x > 1e-3) d = Math.min(d, (b.x + b.w - p.x) / a.x);
  if (a.x < -1e-3) d = Math.min(d, (b.x - p.x) / a.x);
  if (a.y > 1e-3) d = Math.min(d, (b.y + b.h - p.y) / a.y);
  if (a.y < -1e-3) d = Math.min(d, (b.y - p.y) / a.y);
  return Number.isFinite(d) ? Math.max(0, d - s * 0.5) : 0;
}

export const EQUESTRIAN: Signature = {
  shake: 1.4,
  // It does not lunge: the charge is drawn, the whole way.
  lunge: false,

  deliver(t: FxTools, m, seconds) {
    const T = seconds, C = charge(m), s = C.s, k = s / 90, a = C.a, nx = -a.y, ny = a.x;
    const GO = 0.36; // the fraction of the delivery at which the charge goes
    const H = C.P(C.horizon), R = s * SUN;

    // THE SUN RISING over the card's back edge, as over a horizon: the disc
    // cresting it, its rays fanning out over the card and lengthening, a flare
    // struck along the horizon as it clears...
    t.draw(T * GO + T * 0.04, (g, u) => {
      const e = easeOut(clamp01(u * 1.08)), up = -R * 0.8 + R * 1.3 * e, c = { x: H.x + a.x * up, y: H.y + a.y * up };
      const al = Math.min(1, u * 4);
      sunrise(g, c, R, H, a, s * (0.35 + 0.75 * e), al);
      const fl = span(u, 0.45, 1);
      g.moveTo(H.x - nx * s * 0.55 * fl, H.y - ny * s * 0.55 * fl).lineTo(H.x + nx * s * 0.55 * fl, H.y + ny * s * 0.55 * fl)
        .stroke({ width: 2, color: WHITE, alpha: 0.8 * fl });
      flare(g, c.x, c.y, R * 1.3 * fl, 0.8 * fl, Math.atan2(ny, nx), 1.8);
    });
    t.charge(C.P(C.from), s * 1.3, GOLD, 0.45, T * GO);
    // ...while the hooves paw the ground at its back: each strike a horseshoe
    // in gold and sparks kicked off it, back and out to the side.
    [0.04, 0.15, 0.26].forEach((at, i) => t.later(at * T, () => {
      const side = i % 2 ? 1 : -1, hx = C.c0.x - a.x * s * 0.22 + nx * side * s * 0.22, hy = C.c0.y - a.y * s * 0.22 + ny * side * s * 0.22;
      const out = Math.atan2(-a.y, -a.x) + side * -1.05;
      t.draw(0.3, (g, u) => horseshoe(g, hx, hy, Math.atan2(a.y, a.x), s * 0.08, 1 - u, 1 - span(u, 0, 0.5)));
      for (let j = 0; j < Math.round(7 * t.quality); j++) {
        const ang = out + rand(-0.45, 0.45), v = rand(140, 260) * k;
        t.spark(hx, hy, Math.cos(ang) * v, Math.sin(ang) * v - rand(40, 110) * k, rand(0.25, 0.4), STRUCK);
      }
    }));

    // THE CHARGE: the sun goes forward, straight ahead — the disc at the head
    // of the rush with a bow of light before it and the wake burning down the
    // lane behind it — onto the point of impact as the delivery ends.
    const D = T * (1 - GO);
    const head = (u: number) => rush(C.from, C.hit, u);
    t.draw(D, (g, u) => {
      const d = head(u), c = C.P(d), time = u * D, al = Math.min(1, u * 8);
      wake(g, C, Math.max(C.from, d - s * 1.9), d - s * 0.1, s * 0.24, al);
      // The bow: a crescent of light pushed ahead of it.
      const rot = Math.atan2(a.y, a.x), bow = s * 0.38;
      g.moveTo(c.x + Math.cos(rot - 1.1) * bow, c.y + Math.sin(rot - 1.1) * bow).arc(c.x, c.y, bow, rot - 1.1, rot + 1.1)
        .stroke({ width: 3, color: WARM, alpha: 0.8 * al, cap: "round" });
      sun(g, c, s * SUN, time * 3, al);
    }, { delay: T * GO });
    // Hoofprints struck into the ground either side of the lane as it passes,
    // each with a glint as it strikes, going out behind.
    const prints: { x: number; y: number; at: number }[] = [];
    const when = (d: number) => {
      let lo = 0, hi = 1;
      for (let j = 0; j < 18; j++) { const mid = (lo + hi) / 2; if (head(mid) < d) lo = mid; else hi = mid; }
      return T * GO + hi * D;
    };
    for (let d = s * 0.3, n = 0; d < C.hit - s * 0.25; d += s * 0.34, n++) {
      const side = n % 2 ? 1 : -1, q = C.P(d);
      prints.push({ x: q.x + nx * side * s * 0.17, y: q.y + ny * side * s * 0.17, at: when(d + s * 0.35) });
    }
    t.draw(T + 0.5, (g, u) => {
      const time = u * (T + 0.5), ang = Math.atan2(a.y, a.x);
      for (const pr of prints) {
        const age = time - pr.at;
        if (age >= 0) horseshoe(g, pr.x, pr.y, ang, s * 0.065, 0.85 * (1 - span(age, 0.2, 0.5)), 1 - span(age, 0, 0.14));
      }
    });
    // Whatever it rides past beside it is showered with sparks as it goes by.
    for (const i of C.flank) {
      const r = m.targets[i], q = centre(r);
      t.later(when(C.along(q)), () => {
        const c = C.P(C.along(q)), ang = Math.atan2(q.y - c.y, q.x - c.x);
        for (let j = 0; j < Math.round(10 * t.quality); j++) {
          const aa = ang + rand(-0.35, 0.35), v = rand(260, 420) * k;
          t.spark(c.x, c.y, Math.cos(aa) * v, Math.sin(aa) * v, rand(0.18, 0.3), NEEDLE);
        }
      });
    }
  },

  land(t: FxTools, m) {
    const C = charge(m), s = C.s, k = s / 90, a = C.a, I = C.P(C.hit);

    // Nothing in the lane: no delivery was drawn, so the whole rush is drawn
    // here — the sun streaking down the lane to where it stops.
    let at = 0;
    if (!m.targets.length) {
      at = 0.26;
      t.draw(at + 0.2, (g, u) => {
        const time = u * (at + 0.2), v = span(time, 0, at), d = rush(C.from, C.hit, v), c = C.P(d);
        const al = Math.min(1, time * 12) * (1 - span(time, at, at + 0.2));
        wake(g, C, Math.max(C.from, d - s * 1.9), d - s * 0.1, s * 0.24, al);
        sun(g, c, s * SUN, time * 3, al);
      });
    }

    // THE IMPACT: the sun meets the front of the square it stops on and
    // bursts — a flare across the line, needles of light off it...
    t.later(at, () => {
      t.flash(I, GOLD, 0.45);
      t.draw(0.45, (g, u) => {
        const f = Math.pow(1 - u, 1.3);
        sun(g, I, s * (0.24 + 0.2 * easeOut(u)), u * 2, f * 0.8);
        flare(g, I.x, I.y, s * 0.5 * (1 - 0.4 * u), f, Math.atan2(-a.x, a.y), 1.6);
      });
      for (let j = 0; j < Math.round(14 * t.quality); j++) {
        const ang = Math.atan2(a.y, a.x) + (j % 4) * (Math.PI / 2) + rand(-0.12, 0.12), v = rand(240, 420) * k;
        t.spark(I.x, I.y, Math.cos(ang) * v, Math.sin(ang) * v, rand(0.18, 0.32), NEEDLE);
      }
      // ...and its hooves strike a ring of light into the ground where it
      // stands.
      const to = centre(m.to);
      t.draw(0.5, (g, u) => {
        const e = easeOut(u);
        g.ellipse(to.x, to.y + s * 0.2, s * (0.3 + 0.45 * e), s * (0.12 + 0.18 * e)).stroke({ width: 3 * (1 - u) + 1, color: WARM, alpha: 0.85 * (1 - u) });
      });
    });

    // THE COLUMN: a sunburst on every card in it, nearest first.
    C.column.forEach((i, rank) => {
      const r = m.targets[i];
      t.later(at + 0.03 + rank * 0.06, () => sunburst(t, r, m.power[i] ?? 1, Math.atan2(a.y, a.x)));
    });
    // THE LEADER, SHOVED: a golden shockwave off it, and a streak of light
    // driving on down the column to the farthest slot, where it is going.
    if (C.lead !== undefined && !m.killed[C.lead]) {
      const r = m.targets[C.lead], L = centre(r), far = toFarSlot(L, a, m.board, s);
      t.later(at + 0.05, () => {
        t.draw(0.5, (g, u) => {
          const e = easeOut(u), f = 1 - u;
          g.circle(L.x, L.y, s * (0.35 + 0.8 * e)).stroke({ width: 7 * f + 1, color: WARM, alpha: 0.85 * f });
          g.circle(L.x, L.y, s * (0.3 + 0.55 * e)).stroke({ width: 2, color: WHITE, alpha: 0.7 * f });
        });
        if (far > s * 0.4) {
          const end = { x: L.x + a.x * far, y: L.y + a.y * far };
          t.draw(0.5, (g, u) => {
            const age = u * 0.5, reach = easeOut(clamp01(age / 0.12)), f = 1 - span(age, 0.2, 0.5);
            const tip = { x: L.x + a.x * far * reach, y: L.y + a.y * far * reach };
            g.moveTo(L.x, L.y).lineTo(tip.x, tip.y).stroke({ width: s * 0.3, color: GOLD, alpha: 0.18 * f });
            g.moveTo(L.x, L.y).lineTo(tip.x, tip.y).stroke({ width: s * 0.1, color: PALE, alpha: 0.55 * f });
            g.moveTo(L.x, L.y).lineTo(tip.x, tip.y).stroke({ width: 2, color: WHITE, alpha: 0.95 * f });
            if (reach > 0.95) flare(g, end.x, end.y, s * 0.3 * (1 - 0.4 * span(age, 0.12, 0.5)), f, Math.atan2(-a.x, a.y), 1.4);
          });
        }
      });
    }
    // THE FLANKS: the cards it rode past, each caught by a spray of light.
    C.flank.forEach((i, n) => {
      const r = m.targets[i];
      t.later(at + 0.02 + n * 0.03, () => glance(t, r, m.power[i] ?? 0.7, C.P(C.along(centre(r)))));
    });
  },
};

/** A card in the column taking the charge: a four-point star struck into it,
 *  a fainter diagonal one behind (an eight-point sparkle), a halo ring opening
 *  round it, needles flung out along the star's arms, and glitter hanging. */
function sunburst(t: FxTools, r: Box, power: number, rot: number) {
  const c = centre(r), s = Math.min(r.w, r.h), k = s / 90, kk = Math.max(0.6, Math.min(1.8, power));
  const reach = s * 0.5 * (0.8 + 0.2 * kk) * Math.min(1.4, kk);
  t.glow(r, PALE, 0.32, 0.4, 1.0);
  t.draw(0.5, (g, u) => {
    const age = u * 0.5, g1 = easeOut(clamp01(age / 0.07)), g2 = easeOut(clamp01((age - 0.05) / 0.08));
    const fade = age < 0.14 ? 1 : Math.pow(1 - (age - 0.14) / 0.36, 1.3);
    star(g, c.x, c.y, reach * g1, reach * 0.85 * g1, reach * 0.16, rot, GOLD, 0.5 * fade);
    star(g, c.x, c.y, reach * 0.95 * g1, reach * 0.8 * g1, reach * 0.055, rot, WHITE, 0.95 * fade);
    star(g, c.x, c.y, reach * 0.5 * g2, reach * 0.5 * g2, reach * 0.04, rot + Math.PI / 4, PALE, 0.7 * fade);
    if (age > 0.04) g.circle(c.x, c.y, reach * (0.45 + 0.4 * easeOut(u))).stroke({ width: 3 * fade + 1, color: WARM, alpha: 0.8 * fade });
  });
  const n = Math.round(16 * kk * t.quality);
  for (let i = 0; i < n; i++) {
    const a = rot + (i % 4) * (Math.PI / 2) + rand(-0.12, 0.12), v = rand(220, 400) * k;
    t.spark(c.x + Math.cos(a) * reach * 0.2, c.y + Math.sin(a) * reach * 0.2, Math.cos(a) * v, Math.sin(a) * v, rand(0.18, 0.32), NEEDLE);
  }
  t.emit({ count: Math.round(8 * kk), palette: GLINT, from: { x: c.x - reach * 0.6, y: c.y - reach * 0.6, w: reach * 1.2, h: reach * 1.2 },
    dir: [-110, -70], speed: [10, 30], gravity: -20, drag: 0.5, life: [0.4, 0.7], size: [6, 2] });
}

/** A card it rode past beside it: a glint struck on the side facing the lane
 *  and needles of light driven across it, away from the charge. */
function glance(t: FxTools, r: Box, power: number, from: Pt) {
  const c = centre(r), s = Math.min(r.w, r.h), k = s / 90, kk = Math.max(0.55, Math.min(1.3, power));
  const away = Math.atan2(c.y - from.y, c.x - from.x);
  const gx = c.x - Math.cos(away) * s * 0.18, gy = c.y - Math.sin(away) * s * 0.18;
  t.glow(r, PALE, 0.22, 0.3, 0.9);
  t.draw(0.4, (g, u) => {
    const q = Math.sin(Math.PI * Math.min(1, u * 1.6)), rr = s * 0.45 * kk * q;
    star(g, gx, gy, rr * 1.2, rr * 1.2, rr * 0.2, 0, GOLD, 0.45 * (1 - u));
    star(g, gx, gy, rr, rr * 0.8, rr * 0.08, 0, WHITE, 0.95 * (1 - u));
    g.circle(c.x, c.y, s * (0.3 + 0.22 * easeOut(u)) * kk).stroke({ width: 3 * (1 - u) + 1, color: WARM, alpha: 0.8 * (1 - u) });
  });
  const n = Math.round(10 * kk * t.quality);
  for (let i = 0; i < n; i++) {
    const a = away + rand(-0.5, 0.5), v = rand(200, 360) * k;
    t.spark(gx, gy, Math.cos(a) * v, Math.sin(a) * v, rand(0.16, 0.28), NEEDLE);
  }
}
