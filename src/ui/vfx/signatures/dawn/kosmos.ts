/** KOSMOS — Flashing Barrage. "Deal 2 DMG x3 and BLIND every opponent in range
 *  for 1 round." Every foe in reach, three times over: the whole sky at once.
 *
 *  His art is a hooded archer whose cloak IS the night — deep navy, full of
 *  stars — drawing a golden bow, his arrows shooting stars streaking over a
 *  gold city. So the DELIVERY is night falling round his card: a navy dark
 *  welling up under it, the stars of his cloak lighting one by one into a
 *  constellation over the card, the lines of the figure drawn between them,
 *  while the golden bow bends and a star-tipped arrow is drawn to the cheek.
 *
 *  The LANDING is a meteor shower loosed from that constellation: three waves,
 *  a beat apart, every wave a shooting star to every target — a white-gold
 *  head on a long thin tail, dead straight as DAWN's light always is, wrapped
 *  in a deep-blue night glow. A brief starfield hangs over the field while it
 *  falls. Each strike is a four-point star; the third wave's is a blinding
 *  white burst over the card (the BLIND), gone again at once.
 *
 *  Night-blue and starlight, not sunlight: kept apart from Bailey's sunlit
 *  rifle beams and from every gold flare in DAWN. The night under the card is
 *  dark for real (`dark: true`) and rimmed in blue so it reads over an empty
 *  square; the stars and the shower are light. */
import { centre, rand } from "../../looks/base";
import type { Graphics } from "pixi.js";
import type { FxTools, Pt, SparkStyle } from "../../looks/types";
import type { Signature, SigMoment } from "../types";

type Box = SigMoment["from"];

const TAU = Math.PI * 2;
// The night: drawn on the dark layer only.
const NIGHT = 0x040a26;
// Night light, from deep to starlight.
const NAVY = 0x22348f, BLUE = 0x4673f2, SKY = 0x9ab9ff, ICE = 0xdde9ff, WHITE = 0xffffff;
// The bow, and the warm heart of a falling star.
const GOLD = 0xffcc55, STAR_GOLD = 0xffeab0;

/** Starlight shed where a star strikes: hanging, twinkling, not falling. */
const STARDUST: SparkStyle = { palette: [WHITE, ICE, SKY, WHITE, BLUE], gravity: 0, drag: 0.45, size: [4, 1.5], streak: false };
/** Needles of light flung along a strike's four arms. */
const SHARD: SparkStyle = { palette: [WHITE, ICE, SKY, BLUE], gravity: 0, drag: 0.06, size: [5, 1.5], streak: true };

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeOut = (x: number) => 1 - (1 - x) * (1 - x);

/** The waves of the shower, s apart; a star's flight; the slight ripple
 *  between the stars of one wave, so a wave reads as a shower, not a salvo. */
const WAVE = 0.17, FLY = 0.12, RIPPLE = 0.02;

/** HIS CONSTELLATION: seven stars in a fixed figure over his card, as
 *  (across, ahead) in squares. Fixed rather than random so the stars the
 *  delivery lights are the stars the landing looses the shower from. */
const FIGURE: [number, number][] = [[-0.72, 0.36], [-0.42, 0.62], [-0.14, 0.42], [0.08, 0.74], [0.36, 0.48], [0.7, 0.64], [0.16, 0.12]];
const LINES: [number, number][] = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [2, 6], [6, 4]];

/** His aim: at the targets as a whole, else straight ahead. */
function aimOf(m: SigMoment) {
  const c = centre(m.from);
  let ax = 0, ay = 0;
  for (const r of m.targets) {
    const p = centre(r), d = Math.hypot(p.x - c.x, p.y - c.y) || 1;
    ax += (p.x - c.x) / d;
    ay += (p.y - c.y) / d;
  }
  const ang = Math.hypot(ax, ay) > 0.3 ? Math.atan2(ay, ax) : Math.atan2(m.ahead.y, m.ahead.x);
  return { ang, ux: Math.cos(ang), uy: Math.sin(ang) };
}

/** The figure's stars on the board for a card at `c` aiming along `u`. */
function figure(c: Pt, s: number, ux: number, uy: number): Pt[] {
  const nx = -uy, ny = ux;
  return FIGURE.map(([a, f]) => ({ x: c.x + nx * a * s + ux * f * s, y: c.y + ny * a * s + uy * f * s }));
}

/** A four-point star: arms `r` along `rot` and `r2` across, pinched to a
 *  waist `w` — DAWN's lens-flare shape, one 8-point polygon. */
function star4(g: Graphics, x: number, y: number, r: number, r2: number, w: number, rot: number, color: number, alpha: number) {
  if (alpha <= 0.01 || (r < 0.5 && r2 < 0.5)) return;
  const pts: number[] = [];
  for (let i = 0; i < 8; i++) {
    const a = rot + (i * Math.PI) / 4, d = i % 2 ? w : i % 4 === 0 ? r : r2;
    pts.push(x + Math.cos(a) * d, y + Math.sin(a) * d);
  }
  g.poly(pts).fill({ color, alpha });
}

/** A star as it twinkles: a blue halo star behind a white one, a hot dot. */
function twinkle(g: Graphics, x: number, y: number, r: number, rot: number, alpha: number) {
  star4(g, x, y, r * 1.5, r * 1.5, r * 0.3, rot, BLUE, alpha * 0.5);
  star4(g, x, y, r, r, r * 0.12, rot, WHITE, alpha);
  g.circle(x, y, r * 0.2).fill({ color: STAR_GOLD, alpha });
}

// ── The shower ──────────────────────────────────────────────────────────────

/** A shooting star from `L` to the card at `p`: a white-gold head on a long,
 *  thin, dead-straight tail in its night-blue glow, accelerating in. After it
 *  strikes, its tail runs on into the card and goes out. Then the strike: a
 *  four-point star (turned on each wave, so three read as three), needles of
 *  light along its arms; the third wave's a blinding white burst. */
function shootingStar(t: FxTools, L: Pt, r: Box, s: number, power: number, wave: number, delay: number) {
  const p = centre(r), k = Math.max(0.75, Math.min(1.5, power));
  const dx = p.x - L.x, dy = p.y - L.y, d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d, nx = -uy, ny = ux;
  const TAIL = Math.min(d, s * 1.8), W = s * 0.075 * k, D = FLY + 0.16;
  const at = (f: number): Pt => ({ x: L.x + dx * f, y: L.y + dy * f });
  /** The comet: a sliver from the tail's point to the head, `w` wide there. */
  const comet = (g: Graphics, a: Pt, b: Pt, w: number, color: number, alpha: number) => {
    g.poly([a.x, a.y, b.x + (nx * w) / 2, b.y + (ny * w) / 2, b.x + ux * w * 0.5, b.y + uy * w * 0.5, b.x - (nx * w) / 2, b.y - (ny * w) / 2], true)
      .fill({ color, alpha });
  };
  t.draw(D, (g, u) => {
    const time = u * D, q = clamp01(time / FLY), e = q * (0.45 + 0.55 * q);
    const hd = d * e;
    // In flight the tail trails TAIL behind; once it strikes, the tail runs on
    // into the card and the star goes out.
    const after = clamp01((time - FLY) / (D - FLY));
    const td = time < FLY ? Math.max(0, hd - TAIL) : Math.max(0, d - TAIL) + Math.min(d, TAIL) * easeOut(after);
    const a = time < FLY ? clamp01(time / 0.03) : 1 - after;
    const H = at(hd / d), T0 = at(td / d);
    comet(g, T0, H, W * 3.2, NAVY, 0.45 * a);
    comet(g, T0, H, W * 1.9, BLUE, 0.55 * a);
    comet(g, T0, H, W, SKY, 0.8 * a);
    comet(g, T0, H, W * 0.38, WHITE, a);
    if (time < FLY) {
      star4(g, H.x, H.y, W * 2.6, W * 1.6, W * 0.35, Math.atan2(uy, ux), STAR_GOLD, 0.6);
      g.circle(H.x, H.y, W * 0.75).fill({ color: WHITE, alpha: 1 });
    }
  }, { delay });

  // THE STRIKE.
  const hit = delay + FLY, last = wave === 2;
  const rot0 = wave === 1 ? Math.PI / 4 : 0;
  const SD = last ? 0.36 : 0.26;
  t.draw(SD, (g, u) => {
    const grow = easeOut(clamp01(u / 0.15)), a = 1 - clamp01((u - 0.2) / 0.8);
    const R = s * (last ? 0.85 : 0.42 + 0.06 * wave) * k * grow, rot = rot0 + 0.25 * u;
    if (last) g.circle(p.x, p.y, s * 0.46 * grow).fill({ color: WHITE, alpha: 0.5 * (1 - clamp01(u / 0.55)) });
    star4(g, p.x, p.y, R * 1.25, R * 1.25, R * 0.22, rot, BLUE, 0.4 * a);
    star4(g, p.x, p.y, R, R, R * 0.07, rot, last ? WHITE : ICE, a);
    g.circle(p.x, p.y, s * 0.06 * k).fill({ color: WHITE, alpha: a });
  }, { delay: hit });
  t.later(hit, () => {
    t.flash(p, last ? WHITE : SKY, (last ? 0.34 : 0.16) * k * (s / 80));
    const n = Math.round((last ? 8 : 4) * k);
    for (let i = 0; i < n; i++) {
      const q = rot0 + (i % 4) * (Math.PI / 2) + rand(-0.1, 0.1), v = rand(160, 300) * (s / 90);
      t.spark(p.x + Math.cos(q) * s * 0.1, p.y + Math.sin(q) * s * 0.1, Math.cos(q) * v, Math.sin(q) * v, rand(0.18, 0.3), SHARD);
    }
    for (let i = 0; i < (last ? 4 : 2); i++)
      t.spark(p.x + rand(-0.3, 0.3) * s, p.y + rand(-0.3, 0.3) * s, rand(-15, 15), rand(-25, -5), rand(0.35, 0.6), STARDUST);
    if (last) {
      t.glow(r, WHITE, 0.45, 0.3, 1.0);
      t.ring(r, ICE, 0.3, 1.15, 0.35, 3);
    }
  });
}

/** Night over the field while the shower falls: small stars pricked out over
 *  everything between Kosmos and his targets, twinkling in and out — the sky
 *  his cloak is made of, opened over the board. */
function starfield(t: FxTools, c: Pt, s: number, ps: Pt[]) {
  let x0 = c.x, y0 = c.y, x1 = c.x, y1 = c.y;
  for (const p of ps) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); }
  const pad = s * 0.45;
  const n = Math.round(26 * t.quality) + 6, D = 1.0;
  const stars = Array.from({ length: n }, () => ({
    x: rand(x0 - pad, x1 + pad), y: rand(y0 - pad, y1 + pad), born: rand(0, 0.35), ph: rand(0, TAU), r: s * rand(0.025, 0.055),
  }));
  t.draw(D, (g, u) => {
    const time = u * D;
    for (const st of stars) {
      const age = time - st.born;
      if (age <= 0) continue;
      const a = clamp01(age / 0.1) * (1 - clamp01((time - 0.6) / 0.4)) * (0.55 + 0.45 * Math.sin(time * 22 + st.ph));
      star4(g, st.x, st.y, st.r, st.r, st.r * 0.15, 0, ICE, a);
      g.circle(st.x, st.y, Math.max(0.8, st.r * 0.25)).fill({ color: WHITE, alpha: a });
    }
  });
}

/** A stray in the shower: a thin, faint shooting star crossing the open sky
 *  near the targets, roughly along his aim, and burning out before it lands
 *  anywhere — so the falling sky reads as a shower, not only as shots. */
function stray(t: FxTools, c: Pt, s: number, ux: number, uy: number, ps: Pt[], delay: number) {
  const p = ps[Math.floor(rand(0, ps.length))];
  const a = Math.atan2(uy, ux) + rand(-0.35, 0.35), vx = Math.cos(a), vy = Math.sin(a);
  const mid = { x: c.x + (p.x - c.x) * rand(0.35, 0.8) + -uy * s * rand(-0.9, 0.9), y: c.y + (p.y - c.y) * rand(0.35, 0.8) + ux * s * rand(-0.9, 0.9) };
  const L = s * rand(0.9, 1.4), D = 0.22, W = s * 0.035;
  t.draw(D, (g, u) => {
    const hx = mid.x + vx * L * (u - 0.5), hy = mid.y + vy * L * (u - 0.5);
    const tl = L * 0.6 * Math.min(1, u * 2), tx = hx - vx * tl, ty = hy - vy * tl;
    const al = Math.sin(Math.PI * u);
    g.poly([tx, ty, hx - vy * W, hy + vx * W, hx + vx * W, hy + vy * W, hx + vy * W, hy - vx * W], true).fill({ color: SKY, alpha: 0.5 * al });
    g.circle(hx, hy, W * 0.7).fill({ color: WHITE, alpha: 0.8 * al });
  }, { delay });
}

/** Night pooled on a card the shower is falling on: a dark navy disc, rimmed
 *  in blue so it reads over an empty square, while the three stars strike. */
function nightOn(t: FxTools, p: Pt, s: number, D: number) {
  const env = (u: number) => clamp01(u / 0.12) * (1 - clamp01((u - 0.6) / 0.4));
  t.draw(D, (g, u) => { g.circle(p.x, p.y, s * 0.58).fill({ color: NIGHT, alpha: 0.32 * env(u) }); }, { dark: true });
  t.draw(D, (g, u) => {
    g.circle(p.x, p.y, s * 0.58).fill({ color: NAVY, alpha: 0.18 * env(u) }).stroke({ width: 1.5, color: BLUE, alpha: 0.55 * env(u) });
  });
}

export const KOSMOS: Signature = {
  shake: 0.8,
  // He stands and looses; the bow drawing is the wind-up.
  lunge: false,

  deliver(t: FxTools, m: SigMoment, seconds: number) {
    const T = seconds, c = centre(m.from), s = m.size, { ang, ux, uy } = aimOf(m);
    const stars = figure(c, s, ux, uy), N = stars.length, D = T + 0.12;
    const fade = (time: number) => clamp01(time / 0.1) * (1 - clamp01((time - T) / 0.12));
    // The night opens over his card and the sky just ahead of it, where the
    // figure hangs.
    const nc = { x: c.x + ux * s * 0.32, y: c.y + uy * s * 0.32 };
    const night = (time: number) => s * (0.45 + 0.37 * easeOut(clamp01(time / (T * 0.6))));
    // NIGHT FALLING round his card: dark welling up under it...
    t.draw(D, (g, u) => {
      const time = u * D;
      g.circle(nc.x, nc.y, night(time)).fill({ color: NIGHT, alpha: 0.42 * fade(time) });
    }, { dark: true });
    t.glow(m.from, BLUE, 0.28, T + 0.25, 1.5);

    // ...and the stars of his cloak lighting into a constellation over it,
    // one by one, the figure's lines drawn between them as they light; at the
    // end every star swells, ready to fall.
    const lit = (i: number) => T * (0.05 + (0.5 * i) / (N - 1));
    t.draw(D, (g, u) => {
      const time = u * D, k = fade(time);
      g.circle(nc.x, nc.y, night(time)).fill({ color: NAVY, alpha: 0.2 * k }).stroke({ width: 1.5, color: BLUE, alpha: 0.6 * k });
      for (const [i, j] of LINES) {
        const on = lit(Math.max(i, j));
        if (time < on) continue;
        const q = easeOut(clamp01((time - on) / 0.08)), a = stars[i], b = stars[j];
        g.moveTo(a.x, a.y).lineTo(a.x + (b.x - a.x) * q, a.y + (b.y - a.y) * q).stroke({ width: 1.3, color: ICE, alpha: 0.6 * k });
      }
      const swell = 1 + 0.6 * clamp01((time - T * 0.75) / (T * 0.25));
      stars.forEach((p, i) => {
        if (time < lit(i)) return;
        const age = time - lit(i), tw = 0.75 + 0.25 * Math.sin(time * 30 + i * 2.1);
        twinkle(g, p.x, p.y, s * (0.03 + 0.05 * easeOut(clamp01(age / 0.07))) * tw * swell, 0, k);
      });
    });
    for (let i = 0; i < N; i++)
      t.later(lit(i), () => {
        for (let j = 0; j < 2; j++) t.spark(stars[i].x, stars[i].y, rand(-15, 15), rand(-25, -5), rand(0.3, 0.5), STARDUST);
      });

    // THE BOW: a golden arc bending across his aim, the string drawn back to
    // the cheek and a star-tipped arrow of light nocked on it.
    const bc = { x: c.x - ux * s * 0.14, y: c.y - uy * s * 0.14 }, BR = s * 0.42, SPAN = 0.95;
    const tip = (sg: number): Pt => ({ x: bc.x + Math.cos(ang + sg * SPAN) * BR, y: bc.y + Math.sin(ang + sg * SPAN) * BR });
    t.draw(D, (g, u) => {
      const time = u * D, k = fade(time), pull = easeOut(clamp01(time / (T * 0.85)));
      const t1 = tip(-1), t2 = tip(1), mid = { x: (t1.x + t2.x) / 2, y: (t1.y + t2.y) / 2 };
      g.moveTo(t1.x, t1.y);
      for (let i = 1; i <= 16; i++) {
        const a = ang - SPAN + (2 * SPAN * i) / 16;
        g.lineTo(bc.x + Math.cos(a) * BR, bc.y + Math.sin(a) * BR);
      }
      g.stroke({ width: Math.max(2, s * 0.04), color: GOLD, alpha: 0.85 * k, cap: "round" });
      const nock = { x: mid.x - ux * s * 0.24 * pull, y: mid.y - uy * s * 0.24 * pull };
      g.moveTo(t1.x, t1.y).lineTo(nock.x, nock.y).lineTo(t2.x, t2.y).stroke({ width: 1, color: ICE, alpha: 0.8 * k });
      const head = { x: nock.x + ux * s * 0.66, y: nock.y + uy * s * 0.66 };
      g.moveTo(nock.x, nock.y).lineTo(head.x, head.y).stroke({ width: Math.max(1.5, s * 0.022), color: STAR_GOLD, alpha: 0.9 * k });
      twinkle(g, head.x, head.y, s * (0.07 + 0.05 * pull), ang, k);
    });
    t.charge({ x: c.x + ux * s * 0.42, y: c.y + uy * s * 0.42 }, s * 0.45, ICE, 0.4, T);
  },

  land(t: FxTools, m: SigMoment) {
    const c = centre(m.from), s = m.size, { ux, uy } = aimOf(m), stars = figure(c, s, ux, uy), N = stars.length;
    const ps = m.targets.map(centre);
    if (!ps.length) return;
    starfield(t, c, s, ps);
    ps.forEach((p) => nightOn(t, p, s, WAVE * 2 + FLY + 0.45));
    // Three waves; in each, every target gets a star loosed from a different
    // star of the figure, so the shower comes from the whole sky at once.
    for (let w = 0; w < 3; w++) {
      for (let j = 0; j < Math.round(2 * t.quality); j++) stray(t, c, s, ux, uy, ps, w * WAVE + rand(0, WAVE));
      m.targets.forEach((r, i) => {
        const L = stars[(w * 3 + i * 2 + w) % N];
        shootingStar(t, L, r, s, m.power[i] ?? 1, w, w * WAVE + i * RIPPLE);
      });
    }
  },
};
