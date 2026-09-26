/** AQUA — water, and the ice and vapour it turns into. The patient element:
 *  the tide comes in late.
 *
 *  Everything here is drawn to read as water by its SHAPE and MOTION before
 *  its colour. Water FALLS and SPLASHES: drops arc up and drop back under
 *  gravity, drips fall off whatever is moving, crests curl over, bubbles rise
 *  and pop. Its rings are flat ELLIPSES — the board is a surface seen at a
 *  slant — which is what tells a ripple from the round shockwave every other
 *  element throws. The board set piece is a tidal wave sweeping the board;
 *  the wall, the Special cut and the Special swing are the same wave, smaller. */
import type { Graphics } from "pixi.js";
import { centre, rand } from "./base";
import type { ElementLook, FxTools, Pt, SparkStyle } from "./types";

const TAU = Math.PI * 2;
const WHITE = 0xf0fbff, PALE = 0x9fe3ff, BLUE = 0x4d94e8, DEEP = 0x1f4fa8, SEAFOAM = 0xa8ffe4;
/** The basic X: a pale cyan, brighter than the rim so it reads on a near-black board. */
const MARK = 0x7fd4ff;

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeOut = (x: number) => 1 - (1 - x) * (1 - x);

/** A palette for sparks born INSIDE a running effect (a trail, a splash on a
 *  timer). The layer places such a spark before it has sized it, so a fresh
 *  particle shows for one frame at the dot texture's full 64px; starting it
 *  black — which draws nothing under additive light — hides that frame.
 *  Stretched to 12 steps so the black is only the first ~8% of its life. */
function aquaLate(p: number[]): number[] {
  const out = [0x000000];
  for (let i = 0; i < 11; i++) out.push(p[Math.floor((i / 11) * p.length)]);
  return out;
}

const WATER = [WHITE, PALE, BLUE, DEEP];
/** A drop thrown off a splash: round, heavy, cooling white -> deep as it falls. */
const DROP: SparkStyle = { palette: WATER, gravity: 1150, drag: 0.6, size: [7, 3], streak: false };
const DROP_LATE: SparkStyle = { ...DROP, palette: aquaLate(WATER) };
/** A drip shed by something in flight: smaller, and falling off behind it. */
const DRIP_LATE: SparkStyle = { palette: aquaLate(WATER), gravity: 900, drag: 0.5, size: [6, 2], streak: false };
/** The basic X's droplets: tiny, flicked up and straight back down. */
const FLICK: SparkStyle = { palette: WATER, gravity: 1300, drag: 0.5, size: [5, 2], streak: false };
/** Water drawn in to a point: brightening as it gathers. */
const RISE: SparkStyle = { palette: [BLUE, PALE, WHITE], gravity: 0, drag: 1, size: [4, 7], streak: false };
/** Rain: thin, fast, slanted streaks. */
const RAIN_LATE: SparkStyle = { palette: aquaLate([WHITE, PALE, BLUE]), gravity: 900, drag: 0.9, size: [5, 3], streak: true };
/** Heal fizz: fine bubbles lifting. */
const FIZZ: SparkStyle = { palette: [WHITE, 0xc8fff0, PALE], gravity: -70, drag: 0.6, size: [5, 2], streak: false };

// ── Drawing helpers ──────────────────────────────────────────────────────────

/** An arc on its own subpath. After a fill or stroke Pixi keeps the last
 *  point as the pen, so a bare `arc` would draw a stray line from it. */
function aquaArc(g: Graphics, x: number, y: number, r: number, a0: number, a1: number, width: number, color: number, alpha: number) {
  g.moveTo(x + Math.cos(a0) * r, y + Math.sin(a0) * r).arc(x, y, r, a0, a1).stroke({ width, color, alpha });
}

/** Flat rings on a water surface, `n` of them staggered. `inward` runs them
 *  backward, closing on the spot (water being drawn in) to `end` of `reach`. */
function aquaRipples(t: FxTools, c: Pt, reach: number, seconds: number, n: number,
  o: { delay?: number; inward?: boolean; end?: number; flat?: number; width?: number } = {}) {
  const gap = 0.3, flat = o.flat ?? 0.38, w = o.width ?? 2.5, end = o.end ?? 0.2;
  t.draw(seconds, (g, u) => {
    for (let i = 0; i < n; i++) {
      const q = u * (1 + gap * (n - 1)) - i * gap;
      if (q <= 0 || q >= 1) continue;
      const rx = o.inward ? reach * (1 - (1 - end) * easeOut(q)) : reach * (0.12 + 0.88 * easeOut(q));
      const a = o.inward ? Math.min(1, q * 4) * (1 - q * 0.5) : 1 - q;
      g.ellipse(c.x, c.y, rx, rx * flat).stroke({ width: w * (1 - 0.5 * q) + 0.5, color: i === 0 ? PALE : BLUE, alpha: 0.85 * a });
    }
  }, { delay: o.delay });
}

/** A crown splash: drops launched UP and out from a small flat ring, falling
 *  back — the shape a drop makes landing in water. */
function aquaCrown(t: FxTools, c: Pt, n: number, spread: number, lift: number, style: SparkStyle, life: [number, number]) {
  for (let i = 0; i < n; i++) {
    const th = (i / n) * TAU + rand(-0.25, 0.25);
    const cx = Math.cos(th), sy = Math.sin(th);
    t.spark(c.x + cx * spread, c.y + sy * spread * 0.35, cx * lift * rand(0.12, 0.45),
      -lift * rand(0.6, 1) + sy * lift * 0.1, rand(life[0], life[1]), style);
  }
}

/** Water drawn in to `c` from around it (`lower`: only from below — drawn UP
 *  out of the square), each drop arriving as its life ends. */
function aquaDrawIn(t: FxTools, c: Pt, size: number, n: number, seconds: number, lower: boolean) {
  for (let i = 0; i < n; i++) {
    const th = lower ? rand(0.12, 0.88) * Math.PI : rand(0, TAU);
    const d = size * rand(0.42, 0.62), life = seconds * rand(0.55, 1);
    const sx = c.x + Math.cos(th) * d, sy = c.y + Math.sin(th) * d;
    t.spark(sx, sy, (c.x - sx) / life, (c.y - sy) / life, life, RISE);
  }
}

/** A bead of water with a tail: round at the front, tapering behind, with a
 *  glint lit from the upper left. */
function aquaTear(g: Graphics, x: number, y: number, a: number, r: number, tail: number, alpha: number) {
  if (r < 0.5 || alpha <= 0) return;
  const ca = Math.cos(a), sa = Math.sin(a);
  g.circle(x, y, r * 2.3).fill({ color: BLUE, alpha: 0.16 * alpha });
  g.moveTo(x - ca * r * tail, y - sa * r * tail).arc(x, y, r, a - Math.PI / 2, a + Math.PI / 2).closePath()
    .fill({ color: PALE, alpha: 0.55 * alpha }).stroke({ width: 1.5, color: WHITE, alpha: 0.85 * alpha });
  g.circle(x - r * 0.3, y - r * 0.35, r * 0.32).fill({ color: WHITE, alpha });
}

/** A ball of water: a wobbling skin, a current turning inside it (what makes
 *  it a spinning ball of water rather than a bubble), and a fixed glint. */
function aquaSphere(g: Graphics, x: number, y: number, r: number, spin: number, alpha: number) {
  if (r < 0.5 || alpha <= 0) return;
  g.circle(x, y, r * 1.7).fill({ color: BLUE, alpha: 0.13 * alpha });
  const pts: number[] = [];
  for (let i = 0; i < 22; i++) {
    const th = (i / 22) * TAU;
    const rr = r * (1 + 0.07 * Math.sin(3 * th + spin * 1.3) + 0.04 * Math.sin(5 * th - spin * 2.1));
    pts.push(x + Math.cos(th) * rr, y + Math.sin(th) * rr);
  }
  g.poly(pts, true).fill({ color: BLUE, alpha: 0.3 * alpha }).stroke({ width: 2, color: PALE, alpha: 0.9 * alpha });
  aquaArc(g, x, y, r * 0.62, spin, spin + 2.0, 2.2, WHITE, 0.8 * alpha);
  aquaArc(g, x, y, r * 0.36, spin + Math.PI, spin + Math.PI + 1.5, 1.6, PALE, 0.7 * alpha);
  g.circle(x - r * 0.4, y - r * 0.42, r * 0.16).fill({ color: WHITE, alpha: 0.95 * alpha });
}

/** A wave's lip curling over: a short tightening spiral from (x, y), setting
 *  off along (hx, hy) and turning to `side` (+1 = screen-clockwise). */
function aquaCurl(g: Graphics, x: number, y: number, hx: number, hy: number, len: number, side: number, alpha: number) {
  const pts = [x, y];
  const d = 0.6 * side, cs = Math.cos(d), sn = Math.sin(d);
  let step = len * 0.3;
  for (let i = 0; i < 8; i++) {
    x += hx * step; y += hy * step;
    pts.push(x, y);
    const nx = hx * cs - hy * sn;
    hy = hx * sn + hy * cs; hx = nx;
    step *= 0.8;
  }
  g.poly(pts, false).stroke({ width: 4.5, color: PALE, alpha: 0.35 * alpha });
  g.poly(pts, false).stroke({ width: 1.8, color: WHITE, alpha: 0.95 * alpha });
}

/** A crest of water: a crescent between two curves that share their tips —
 *  fat in the middle, thin at the ends — across the chord (dx, dy) through
 *  (cx, cy), bulging forward along (fx, fy). Revealed from one tip to `u`,
 *  with a foam line along its leading edge and, once whole, its lip curling. */
function aquaCrest(g: Graphics, cx: number, cy: number, reach: number, dx: number, dy: number, fx: number, fy: number,
  bulge: number, thick: number, u: number, alpha: number, curl: boolean) {
  if (u <= 0 || alpha <= 0) return;
  const ax = cx - dx * reach, ay = cy - dy * reach, bx = cx + dx * reach, by = cy + dy * reach;
  const ox = cx + fx * reach * bulge * 2, oy = cy + fy * reach * bulge * 2;
  const ix = cx + fx * reach * (bulge - thick) * 2, iy = cy + fy * reach * (bulge - thick) * 2;
  const N = 12, outer: number[] = [], body: number[] = [];
  for (let i = 0; i <= N; i++) {
    const s = (i / N) * u, m = 1 - s;
    outer.push(m * m * ax + 2 * m * s * ox + s * s * bx, m * m * ay + 2 * m * s * oy + s * s * by);
  }
  for (let i = 0; i <= N; i++) body.push(outer[2 * i], outer[2 * i + 1]);
  for (let i = N; i >= 0; i--) {
    const s = (i / N) * u, m = 1 - s;
    body.push(m * m * ax + 2 * m * s * ix + s * s * bx, m * m * ay + 2 * m * s * iy + s * s * by);
  }
  g.poly(body, true).fill({ color: BLUE, alpha: 0.42 * alpha });
  g.poly(outer, false).stroke({ width: 3, color: PALE, alpha: 0.9 * alpha });
  g.poly(outer, false).stroke({ width: 1.2, color: WHITE, alpha });
  if (curl) {
    // Carry on along the outer curve's tangent at the tip, turning back
    // toward the concave side — over and into the wave.
    let hx = bx - ox, hy = by - oy;
    const hl = Math.hypot(hx, hy) || 1;
    hx /= hl; hy /= hl;
    const side = hx * -fy - hy * -fx > 0 ? 1 : -1;
    aquaCurl(g, outer[2 * N], outer[2 * N + 1], hx, hy, reach * 0.55, side, alpha);
  }
}

// ── The look ─────────────────────────────────────────────────────────────────

export const AQUA: ElementLook = {
  markColor: MARK,

  windUp(t, d) {
    const dur = d.wind + (d.T - d.wind) * 0.3;
    const feet = { x: d.at.x, y: d.at.y + d.size * 0.2 };
    if (d.melee && !d.special) {
      // The lunge is the wind-up: only the surface stirs under it.
      aquaRipples(t, feet, d.size * 0.42, 0.35, 1, { width: 2 });
      return;
    }
    if (!d.special) {
      // A bead of water drawn up out of a ripple — and flung (the shot takes
      // over from it on the frame it leaves).
      aquaRipples(t, feet, d.size * 0.45, dur + 0.1, 2, { width: 2 });
      aquaDrawIn(t, d.at, d.size, 6, d.wind, true);
      const r0 = d.size * 0.085;
      t.draw(d.wind, (g, u) => aquaTear(g, d.at.x, d.at.y, -Math.PI / 2, r0 * easeOut(u), 1 + u, Math.min(1, u * 3)));
      return;
    }
    // A Special pulls the water up out of its square...
    aquaRipples(t, feet, d.size * 0.55, dur + 0.15, 3);
    aquaDrawIn(t, d.at, d.size, 18, d.wind, true);
    t.charge(d.at, d.size * 1.3, BLUE, 0.4, dur);
    if (d.melee) {
      // ...a melee one coils it round itself, tightening as it lunges.
      t.draw(dur, (g, u) => {
        const r = d.size * (0.52 - 0.14 * u), spin = u * 9, len = 0.5 + 1.8 * easeOut(u), a = Math.min(1, u * 4);
        for (let j = 0; j < 2; j++) {
          const a0 = spin + j * Math.PI;
          aquaArc(g, d.at.x, d.at.y, r, a0, a0 + len, 6, BLUE, 0.3 * a);
          aquaArc(g, d.at.x, d.at.y, r, a0, a0 + len, 2.4, PALE, 0.9 * a);
        }
      });
    } else {
      // ...a ranged one balls it up, spinning, and that ball is the shot.
      const R = d.size * 0.17;
      t.draw(d.wind, (g, u) => aquaSphere(g, d.at.x, d.at.y, R * easeOut(u), u * 8, Math.min(1, u * 3)));
    }
  },

  gather(t, d) {
    // The square is still empty: rings run INWARD across it and a ball of
    // water wells up where they close. The strike leaves it at `wind`; what
    // is left of it bursts when the card lands (see `arrive`).
    const s = d.size, R = s * (d.special ? 0.19 : 0.15), uw = d.wind / d.T;
    aquaRipples(t, { x: d.at.x, y: d.at.y + s * 0.18 }, s * 0.62, d.T, 3, { inward: true });
    aquaDrawIn(t, d.at, s, d.special ? 26 : 16, d.T * 0.9, false);
    t.charge(d.at, s * 1.3, BLUE, d.special ? 0.45 : 0.32, d.T);
    t.draw(d.T, (g, u) => {
      const grow = u < uw ? easeOut(u / uw) : 1 - (0.35 * (u - uw)) / (1 - uw);
      aquaSphere(g, d.at.x, d.at.y, R * grow, u * 10, Math.min(1, u * 3));
    });
  },

  projectile(t, s) {
    const dx = s.to.x - s.from.x, dy = s.to.y - s.from.y;
    const a = Math.atan2(dy, dx), ca = Math.cos(a), sa = Math.sin(a);
    let acc = 0;
    if (!s.special) {
      // A bolt of water: a bead with a tail, wobbling as it flies and DRIPPING
      // — the drips fall off behind it under gravity, which no other shot does.
      const r = s.size * 0.085;
      t.draw(s.seconds, (g, u, dt) => {
        const e = u * (0.6 + 0.4 * u);
        const x = s.from.x + dx * e, y = s.from.y + dy * e, w = Math.sin(u * 30);
        aquaTear(g, x, y, a, r * (1 + 0.1 * w), 2.4 + 0.5 * u - 0.4 * w, Math.min(1, u * 6));
        acc += 70 * dt;
        while (acc >= 1) {
          acc -= 1;
          t.spark(x - ca * r * 1.8 + rand(-2, 2), y - sa * r * 1.8 + rand(-2, 2),
            -ca * 40 + rand(-20, 20), -sa * 40 + rand(-30, 0), rand(0.25, 0.45), DRIP_LATE);
        }
      }, { delay: s.delay });
      return;
    }
    // A Special: the ball of water from the wind-up, spinning, flinging drops
    // off its rim that arc away and fall.
    const R = s.size * 0.17;
    let px = s.from.x, py = s.from.y;
    t.draw(s.seconds, (g, u, dt) => {
      const e = u * u;
      const x = s.from.x + dx * e, y = s.from.y + dy * e;
      const vx = (x - px) / Math.max(dt, 1e-3), vy = (y - py) / Math.max(dt, 1e-3);
      px = x; py = y;
      aquaSphere(g, x, y, R, 8 + u * 14, 1);
      acc += 150 * dt;
      while (acc >= 1) {
        acc -= 1;
        const th = rand(0, TAU), v = rand(80, 170);
        t.spark(x + Math.cos(th) * R, y + Math.sin(th) * R, -Math.sin(th) * v + vx * 0.06, Math.cos(th) * v + vy * 0.06,
          rand(0.3, 0.5), DROP_LATE);
      }
    }, { delay: s.delay });
  },

  swing(t, s) {
    const dx = s.to.x - s.from.x, dy = s.to.y - s.from.y, len = Math.hypot(dx, dy) || 1;
    const fx = dx / len, fy = dy / len;
    let acc = 0;
    if (!s.special) {
      // A basic swing is a whisper: a few drips shaken off the token as it
      // lunges — the lunge is the motion, and a basic happens every turn.
      t.draw(s.seconds, (_g, u, dt) => {
        const e = u * u, x = s.from.x + dx * e, y = s.from.y + dy * e;
        acc += 40 * dt;
        while (acc >= 1) {
          acc -= 1;
          t.spark(x + rand(-5, 5), y + rand(-5, 5), rand(-30, 30), rand(-60, 0), rand(0.2, 0.35), DRIP_LATE);
        }
      }, { delay: s.delay });
      return;
    }
    // A Special rides a crest of water in front of it, spray peeling off the
    // crest's tips — the wave the mark breaks on the card.
    const reach = s.size * 0.3;
    t.draw(s.seconds, (g, u, dt) => {
      const e = u * u, grow = 0.55 + 0.45 * easeOut(Math.min(1, u * 2));
      const cx = s.from.x + dx * e + fx * s.size * 0.14, cy = s.from.y + dy * e + fy * s.size * 0.14;
      const rr = reach * grow;
      aquaCrest(g, cx, cy, rr, -fy, fx, fx, fy, 0.34, 0.26, 1, Math.min(1, u * 5), true);
      acc += 110 * dt;
      while (acc >= 1) {
        acc -= 1;
        const side = Math.random() < 0.5 ? -1 : 1;
        t.spark(cx - fy * rr * side, cy + fx * rr * side,
          -fy * side * rand(40, 120) + fx * rand(0, 80), fx * side * rand(40, 120) + fy * rand(0, 80) - rand(80, 200),
          rand(0.3, 0.5), DROP_LATE);
      }
    }, { delay: s.delay });
  },

  mark(t, m) {
    // A wave breaking over the card: a crescent of water swept across it —
    // fat in the middle, its lip curling over at the end — throwing drops
    // that arc up and fall back as the crest passes, and a ripple under it.
    const dirx = Math.cos(m.across), diry = Math.sin(m.across);
    let fx = -diry, fy = dirx;
    if (fx * Math.cos(m.angle) + fy * Math.sin(m.angle) < 0) { fx = -fx; fy = -fy; }
    const reach = m.reach * 0.92;
    // Set back a little, so the bulge (not the chord) sits over the card's middle.
    const cx = m.c.x - fx * m.reach * 0.18, cy = m.c.y - fy * m.reach * 0.18;
    const ox = cx + fx * reach * 0.72, oy = cy + fy * reach * 0.72; // the outer curve's control point
    const n = Math.round(14 + 10 * m.k);
    let thrown = 0, rev0 = 0;
    t.draw(0.5, (g, u) => {
      const time = u * 0.5, rev = easeOut(clamp01(time / 0.1));
      const fade = time < 0.2 ? 1 : 1 - (time - 0.2) / 0.3;
      aquaCrest(g, cx, cy, reach, dirx, diry, fx, fy, 0.36, 0.26, rev, fade, rev >= 1);
      // Drops leave the crest where it has just passed.
      for (; thrown < Math.round(n * rev); thrown++) {
        const s = rand(rev0, rev), q = 1 - s;
        const ax = cx - dirx * reach, ay = cy - diry * reach, bx = cx + dirx * reach, by = cy + diry * reach;
        t.spark(q * q * ax + 2 * q * s * ox + s * s * bx, q * q * ay + 2 * q * s * oy + s * s * by,
          fx * rand(40, 150) + dirx * rand(-50, 50), fy * rand(40, 150) + diry * rand(-50, 50) - rand(150, 320),
          rand(0.4, 0.7), DROP_LATE);
      }
      rev0 = rev;
    });
    aquaRipples(t, { x: m.c.x, y: m.c.y + m.reach * 0.3 }, m.reach * 1.05, 0.55, 2);
    t.glow(m.rect, BLUE, 0.28 + 0.08 * m.k, 0.35, 1.05);
  },

  xSparks(t, c, count) {
    // Flicked droplets: up a little and straight back down.
    for (let i = 0; i < count; i++)
      t.spark(c.x + rand(-4, 4), c.y + rand(-4, 4), rand(-110, 110), rand(-240, -90), rand(0.22, 0.34), FLICK);
  },

  arrive(t, r) {
    // The ball of water it gathered bursts: its skin flies apart in arcs, and
    // the water comes down — a crown thrown up and out, a ripple across the square.
    const c = centre(r), s = Math.min(r.w, r.h);
    t.draw(0.35, (g, u) => {
      const rr = s * (0.16 + 0.42 * easeOut(u)), a = 1 - u;
      for (let i = 0; i < 6; i++) {
        const a0 = (i * TAU) / 6 + 0.3;
        aquaArc(g, c.x, c.y, rr, a0, a0 + 0.55 * (1 - 0.5 * u), 3 * a + 0.5, PALE, 0.9 * a);
      }
    });
    aquaCrown(t, { x: c.x, y: c.y + s * 0.05 }, 30, s * 0.12, 330, DROP, [0.5, 0.8]);
    aquaRipples(t, { x: c.x, y: c.y + s * 0.2 }, s * 0.7, 0.65, 2);
    t.glow(r, PALE, 0.5, 0.35, 1.1);
  },

  impactAccent(t, at, k) {
    // What makes any hit read as water: a crown of drops thrown straight UP
    // that falls back, and a flat ripple under it. It plays on every spell
    // hit too, so: ~20 sparks and one draw.
    aquaCrown(t, at, Math.round(8 + 6 * k), 6 * k, 250 + 70 * k, DROP, [0.45, 0.7]);
    aquaRipples(t, { x: at.x, y: at.y + 8 * k }, 26 + 24 * k, 0.6, 2);
  },

  shield(t, r) {
    // A bubble: it inflates over the card with an elastic wobble, its skin
    // settling as it goes taut, a highlight sliding over the top of it.
    const c = centre(r), R = Math.min(r.w, r.h) * 0.58, ph = rand(0, TAU);
    t.draw(1.05, (g, u) => {
      const time = u * 1.05;
      const inflate = time < 0.3 ? 1 - Math.exp(-time * 14) * Math.cos(time * 22) : 1;
      const Rn = R * (0.62 + 0.38 * inflate);
      const a = Math.min(1, time * 10) * (u < 0.7 ? 1 : (1 - u) / 0.3);
      const wob = 0.08 * Math.exp(-time * 4) + 0.018;
      const pts: number[] = [];
      for (let i = 0; i < 28; i++) {
        const th = (i / 28) * TAU;
        const rr = Rn * (1 + wob * Math.sin(3 * th + ph + time * 13) + wob * 0.6 * Math.sin(5 * th - time * 17));
        pts.push(c.x + Math.cos(th) * rr, c.y + Math.sin(th) * rr);
      }
      g.poly(pts, true).fill({ color: BLUE, alpha: 0.1 * a }).stroke({ width: 6, color: BLUE, alpha: 0.28 * a });
      g.poly(pts, true).stroke({ width: 1.8, color: PALE, alpha: 0.9 * a });
      const h0 = -2.55 + time * 1.1;
      aquaArc(g, c.x, c.y, Rn * 0.8, h0, h0 + 0.85, 3, WHITE, 0.85 * a);
      aquaArc(g, c.x, c.y, Rn * 0.8, h0 + Math.PI, h0 + Math.PI + 0.45, 2, PALE, 0.45 * a);
      g.circle(c.x + Math.cos(h0 + 1.15) * Rn * 0.62, c.y + Math.sin(h0 + 1.15) * Rn * 0.62, 2.4).fill({ color: WHITE, alpha: a });
    });
    // A few drops shaken off the skin as it snaps taut.
    for (let i = 0; i < 12; i++) {
      const th = rand(-Math.PI, 0);
      t.spark(c.x + Math.cos(th) * R, c.y + Math.sin(th) * R, Math.cos(th) * rand(30, 80), Math.sin(th) * rand(30, 80),
        rand(0.4, 0.6), DROP);
    }
  },

  heal(t, r, k) {
    // Bubbles rising through the card, wobbling, and popping as they reach
    // the top — over a faint sea-green, so it still reads as a heal.
    const kk = Math.max(0.7, Math.min(2.2, k));
    const n = Math.round(7 + 4 * kk);
    const bx: number[] = [], b0: number[] = [], bv: number[] = [], br: number[] = [], bl: number[] = [], bp: number[] = [];
    for (let i = 0; i < n; i++) {
      bx.push(r.x + r.w * rand(0.14, 0.86)); b0.push(rand(0, 0.45)); bv.push(rand(60, 120));
      br.push(rand(2.5, 5.5)); bl.push(rand(0.5, 0.75)); bp.push(rand(0, TAU));
    }
    const floor = r.y + r.h * 0.95;
    t.draw(1.25, (g, u) => {
      const time = u * 1.25;
      for (let i = 0; i < n; i++) {
        const age = time - b0[i];
        if (age < 0 || age > bl[i]) continue;
        const q = age / bl[i];
        const pop = q > 0.85 ? (q - 0.85) / 0.15 : 0;
        const rr = br[i] * (1 + 0.5 * q) * (1 + 0.8 * pop), a = Math.min(1, q * 6) * (1 - pop);
        const x = bx[i] + Math.sin(bp[i] + age * 10) * 3, y = floor - bv[i] * age;
        g.circle(x, y, rr).stroke({ width: 1.5, color: PALE, alpha: 0.9 * a });
        g.circle(x - rr * 0.35, y - rr * 0.35, Math.max(0.8, rr * 0.28)).fill({ color: WHITE, alpha: a });
      }
    });
    t.glow(r, SEAFOAM, 0.32, 0.9);
    t.emit({ count: Math.round(12 * kk), palette: FIZZ.palette, from: r, at: "bottom", dir: [-100, -80], speed: [30, 90],
      gravity: FIZZ.gravity, drag: FIZZ.drag, life: [0.6, 1.1], size: FIZZ.size });
  },

  wall(t, r) {
    // A wave runs the length of the row, a wall of water standing up behind
    // its curling crest — then it crashes back down in a line of spray.
    const dir = Math.random() < 0.5 ? 1 : -1;
    const start = dir > 0 ? r.x : r.x + r.w;
    const base = r.y + r.h * 0.97, H = r.h * 0.92, stand = r.h * 0.6, cw = r.h * 0.95;
    const D = 1.15, RUN = 0.5, CRASH = 0.66;
    let acc = 0, crashed = false;
    t.draw(D, (g, u, dt) => {
      const time = u * D;
      const run = clamp01(time / RUN);
      const F = (r.w + cw * 0.3) * easeOut(run);          // the front, as distance from the start
      const peak = F - cw * 0.3;                          // where the crest stands
      const fall = clamp01((time - CRASH) / 0.32);
      const hold = 1 - fall * fall;
      const a = Math.min(1, time * 12) * (1 - fall);
      const dE = Math.min(F, r.w);
      if (dE > 2 && a > 0) {
        const surf: number[] = [];
        for (let i = 0; i <= 22; i++) {
          const dist = (dE * i) / 22;
          const z = (dist - peak) / (cw * 0.32);
          const h = (stand + (H - stand) * Math.exp(-z * z)) * hold + 3 * Math.sin(dist * 0.09 - time * 10) * (1 - fall);
          surf.push(start + dir * dist, base - Math.max(0, h));
        }
        const body = surf.slice();
        body.push(start + dir * dE, base, start, base);
        g.poly(body, true).fill({ color: BLUE, alpha: 0.2 * a });
        g.poly(surf, false).stroke({ width: 3, color: PALE, alpha: 0.9 * a });
        g.poly(surf, false).stroke({ width: 1.2, color: WHITE, alpha: 0.8 * a });
        if (peak > 0 && peak < r.w && fall === 0)
          aquaCurl(g, start + dir * peak, base - H, dir, 0, cw * 0.4, dir, a);
      }
      // Spray peeling off the crest as it runs...
      if (run < 1) {
        acc += 120 * dt;
        const x = start + dir * Math.max(0, Math.min(r.w, peak));
        while (acc >= 1) {
          acc -= 1;
          t.spark(x + rand(-8, 8), base - H + rand(0, 8), dir * rand(30, 150), -rand(100, 260), rand(0.35, 0.6), DROP_LATE);
        }
      }
      // ...and a line of it thrown up the whole row where it crashes.
      if (!crashed && time >= CRASH) {
        crashed = true;
        for (let i = 0; i < 55; i++)
          t.spark(r.x + rand(0, r.w), base - stand * rand(0.5, 0.9), rand(-50, 50), -rand(160, 380), rand(0.45, 0.75), DROP_LATE);
      }
    });
  },

  field(t, r) {
    // The weather turns: the board dims under cloud, rain slants across it,
    // and its surface pocks with ripples where the rain lands.
    t.draw(1.3, (g, u) => {
      const a = u < 0.15 ? u / 0.15 : u > 0.7 ? (1 - u) / 0.3 : 1;
      g.rect(r.x, r.y, r.w, r.h).fill({ color: 0x010714, alpha: 0.3 * a });
    }, { dark: true });
    let acc = 0;
    t.draw(1.0, (_g, u, dt) => {
      acc += 340 * dt * (u < 0.75 ? 1 : (1 - u) * 4);
      while (acc >= 1) {
        acc -= 1;
        t.spark(r.x + rand(-0.12, 1) * r.w, r.y + rand(-0.1, 0.8) * r.h, 90, rand(560, 720), rand(0.2, 0.35), RAIN_LATE);
      }
    });
    const n = 20, px: number[] = [], py: number[] = [], pt: number[] = [], pr: number[] = [];
    for (let i = 0; i < n; i++) {
      px.push(r.x + rand(0.06, 0.94) * r.w); py.push(r.y + rand(0.06, 0.94) * r.h);
      pt.push(0.12 + (0.75 * (i + rand(0, 1))) / n); pr.push(rand(9, 16));
    }
    let fired = 0;
    t.draw(1.3, (g, u) => {
      const time = u * 1.3;
      for (; fired < n && time >= pt[fired]; fired++)
        aquaCrown(t, { x: px[fired], y: py[fired] }, 3, 2, 150, DROP_LATE, [0.25, 0.4]);
      for (let i = 0; i < n; i++) {
        const q = (time - pt[i]) / 0.45;
        if (q <= 0 || q >= 1) continue;
        const rx = pr[i] * (0.15 + 0.85 * easeOut(q));
        g.ellipse(px[i], py[i], rx, rx * 0.4).stroke({ width: 1.6, color: PALE, alpha: 0.8 * (1 - q) });
      }
    });
  },

  move(t, from, to) {
    // It lifts out of the water where it stood, runs across as a stream —
    // the head racing ahead, the tail draining after it, dripping as it goes
    // — and pours into its new square.
    const a = centre(from), b = centre(to);
    const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len;
    aquaRipples(t, { x: a.x, y: a.y + from.h * 0.2 }, from.w * 0.5, 0.5, 2);
    aquaCrown(t, a, 10, 8, 220, DROP, [0.35, 0.55]);
    let acc = 0;
    t.draw(0.62, (g, u, dt) => {
      const head = easeOut(clamp01(u / 0.55)), tq = clamp01((u - 0.25) / 0.75), tail = tq * tq;
      if (head - tail < 0.01) return;
      const pts: number[] = [];
      for (let i = 0; i <= 16; i++) {
        const f = tail + (head - tail) * (i / 16);
        const wv = Math.sin(f * 18 - u * 16) * 4 * Math.sin(Math.PI * f);
        pts.push(a.x + dx * f + nx * wv, a.y + dy * f + ny * wv);
      }
      g.poly(pts, false).stroke({ width: 9, color: BLUE, alpha: 0.28 });
      g.poly(pts, false).stroke({ width: 3, color: PALE, alpha: 0.85 });
      g.poly(pts, false).stroke({ width: 1, color: WHITE, alpha: 0.8 });
      if (head < 1) {
        acc += 55 * dt;
        while (acc >= 1) {
          acc -= 1;
          t.spark(a.x + dx * head + rand(-3, 3), a.y + dy * head + rand(-3, 3), rand(-30, 30), rand(-50, 10), rand(0.3, 0.45), DRIP_LATE);
        }
      }
    });
    t.later(0.33, () => aquaCrown(t, b, 14, 8, 260, DROP_LATE, [0.4, 0.6]));
    aquaRipples(t, { x: b.x, y: b.y + to.h * 0.2 }, to.w * 0.55, 0.6, 2, { delay: 0.3 });
  },

  trapSet(t, r) {
    // Rings closing in on the square until they settle into a still puddle,
    // a glint sliding across it — a surface waiting to be stepped in.
    const c = centre(r), s = Math.min(r.w, r.h);
    const py = c.y + s * 0.1, prx = s * 0.26, pry = s * 0.1;
    aquaRipples(t, { x: c.x, y: py }, s * 0.56, 0.5, 3, { inward: true, end: 0.46, flat: 0.4 });
    for (let i = 0; i < 14; i++) {
      const th = rand(0, TAU), d = s * rand(0.45, 0.6), life = rand(0.25, 0.4);
      const sx = c.x + Math.cos(th) * d, sy = py + Math.sin(th) * d * 0.45;
      t.spark(sx, sy, (c.x - sx) / life, (py - sy) / life, life, RISE);
    }
    t.draw(1.2, (g, u) => {
      const time = u * 1.2;
      if (time < 0.35) return;
      const q = (time - 0.35) / 0.85;
      const a = q < 0.15 ? q / 0.15 : 1 - (q - 0.15) / 0.85;
      g.ellipse(c.x, py, prx, pry).fill({ color: BLUE, alpha: 0.22 * a }).stroke({ width: 1.8, color: PALE, alpha: 0.85 * a });
      const g0 = -2.6 + q * 1.6, pts: number[] = [];
      for (let i = 0; i <= 6; i++) {
        const th = g0 + (0.7 * i) / 6;
        pts.push(c.x + Math.cos(th) * prx * 0.82, py + Math.sin(th) * pry * 0.7);
      }
      g.poly(pts, false).stroke({ width: 2.2, color: WHITE, alpha: 0.9 * a });
    });
  },

  pulse(t, r) {
    // A single drop falls onto the row and rings out along it.
    const c = centre(r), top = r.y - r.h * 0.6, FALL = 0.2;
    t.draw(FALL, (g, u) => aquaTear(g, c.x, top + (c.y - top) * u * u, Math.PI / 2, 5, 2.2 + u * 1.5, Math.min(1, u * 5)));
    t.later(FALL, () => aquaCrown(t, c, 18, 6, 280, DROP_LATE, [0.4, 0.65]));
    aquaRipples(t, c, r.w * 0.5, 1.0, 3, { delay: FALL, flat: Math.min(0.38, (r.h * 0.45) / (r.w * 0.5)) });
  },
};
