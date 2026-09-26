/** DAWN — light. Light is STRAIGHT and RADIANT, so every DAWN effect is built
 *  from the few shapes that say so, whatever the colour: a beam that EXTENDS
 *  in a dead-straight line, the four-point star of a lens flare, a halo, a
 *  pillar of light, and motes that glitter in place rather than drift. Where
 *  another element throws a ball or sweeps an arc, DAWN draws a line — and
 *  its whole-board set piece (a sun gathering, then pillars of light onto
 *  every card) is the same vocabulary at full size.
 *
 *  Every spark here is born when the hook is called, never from inside a
 *  running draw: a spark spawned mid-effect is drawn for one frame at the dot
 *  texture's full size before the particle loop scales it (a white blob
 *  whenever the pool is cold). Glitter that must appear DURING an effect — a
 *  beam's, a streak's — is drawn as points instead. */
import type { Graphics } from "pixi.js";
import { centre, lerpPt, rand } from "./base";
import type { ElementLook, FxTools, Pt, SparkStyle } from "./types";

type Box = { x: number; y: number; w: number; h: number };

const WHITE = 0xffffff;
const PALE = 0xfff1b3;
const GOLD = 0xffd54f;
const DEEP = 0xe0a41c;
const WARM = 0xffe38a;

/** Glitter's palette: a mote walks it as it ages, flicking between white-hot
 *  and deep gold — the walk IS the twinkle, and costs nothing. */
const GLINT = [WHITE, DEEP, WHITE, GOLD, PALE, DEEP, WHITE, DEEP];
/** A needle of light: dead straight and fast. Light does not fall. */
const NEEDLE: SparkStyle = { palette: [WHITE, PALE, GOLD], gravity: 0, drag: 0.03, size: [6, 2], streak: true };
/** A mote strung on a halo: drifting along it, not rising off it. */
const HALO_MOTE: SparkStyle = { palette: GLINT, gravity: 0, drag: 0.6, size: [6, 2], streak: false };
/** The basic X's needles: the same, smaller. */
const X_NEEDLE: SparkStyle = { palette: [WHITE, PALE, GOLD], gravity: 0, drag: 0.02, size: [5, 1.5], streak: true };

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeOut = (x: number) => 1 - (1 - x) * (1 - x);

// ── DAWN's shapes ────────────────────────────────────────────────────────────

/** The signature shape: a four-point star, two long arms (`r` along `rot`,
 *  `r2` across it) pinched to a waist `w` — one 8-point polygon. */
function dawnStar(g: Graphics, x: number, y: number, r: number, r2: number, w: number, rot: number, color: number, alpha: number) {
  if (alpha <= 0.01 || (r < 0.5 && r2 < 0.5)) return;
  const pts: number[] = [];
  for (let i = 0; i < 8; i++) {
    const a = rot + (i * Math.PI) / 4;
    const d = i % 2 ? w : i % 4 === 0 ? r : r2;
    pts.push(x + Math.cos(a) * d, y + Math.sin(a) * d);
  }
  g.poly(pts).fill({ color, alpha });
}

/** A lens flare: a soft gold star behind a white one, a hot dot at its heart.
 *  `wide` stretches the arms along `rot` — the anamorphic streak of a flare. */
function dawnFlare(g: Graphics, x: number, y: number, r: number, alpha: number, rot = 0, wide = 1) {
  if (alpha <= 0.01 || r < 0.5) return;
  dawnStar(g, x, y, r * 1.3 * wide, r * 1.3, r * 0.2, rot, GOLD, alpha * 0.4);
  dawnStar(g, x, y, r * wide, r, r * 0.07, rot, WHITE, alpha);
  g.circle(x, y, r * 0.16).fill({ color: PALE, alpha: alpha * 0.8 });
}

/** A beam: a soft gold body round a white-hot core, dead straight. */
function dawnBeam(g: Graphics, a: Pt, b: Pt, w: number, alpha: number) {
  if (alpha <= 0.01) return;
  g.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ width: w * 2.6, color: GOLD, alpha: alpha * 0.16 });
  g.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ width: w, color: PALE, alpha: alpha * 0.55 });
  g.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ width: Math.max(1, w * 0.32), color: WHITE, alpha });
}

/** A spear of light: needle-pointed at `b`, swelling just behind the point,
 *  thinning to nothing at `a`. */
function dawnLance(g: Graphics, a: Pt, b: Pt, w: number, color: number, alpha: number) {
  const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy);
  if (len < 1 || alpha <= 0.01) return;
  const ux = dx / len, uy = dy / len;
  const back = Math.min(len * 0.3, w * 2.5);
  const sx = b.x - ux * back, sy = b.y - uy * back;
  const hx = (-uy * w) / 2, hy = (ux * w) / 2;
  g.poly([a.x, a.y, sx + hx, sy + hy, b.x, b.y, sx - hx, sy - hy]).fill({ color, alpha });
}

/** A halo: a gold ring wearing a crown of short rays, long and short in turn
 *  — a sun's corona, not a bubble. */
function dawnHalo(g: Graphics, c: Pt, R: number, rays: number, rayLen: number, spin: number, alpha: number) {
  if (alpha <= 0.01) return;
  g.circle(c.x, c.y, R).stroke({ width: 6, color: GOLD, alpha: alpha * 0.22 });
  g.circle(c.x, c.y, R).stroke({ width: 1.8, color: WARM, alpha: alpha * 0.95 });
  if (rays <= 0) return;
  for (let i = 0; i < rays; i++) {
    const a = spin + (i / rays) * Math.PI * 2;
    const l = rayLen * (i % 2 ? 0.55 : 1);
    const ca = Math.cos(a), sa = Math.sin(a);
    g.moveTo(c.x + ca * (R + 3), c.y + sa * (R + 3)).lineTo(c.x + ca * (R + 3 + l), c.y + sa * (R + 3 + l));
  }
  g.stroke({ width: 2, color: PALE, alpha: alpha * 0.7 });
}

/** A shaft of light standing from `top` down to `bottom`, brightest at its
 *  foot and `taper` times as wide at its top: stacked slabs, each lower one
 *  adding to those above it — a vertical gradient with no texture. The slabs
 *  share one straight-sided silhouette (the width is linear in height), so it
 *  reads as a single shaft, not a stack of boxes. */
function dawnPillar(g: Graphics, x: number, top: number, bottom: number, w: number, alpha: number, taper = 1) {
  if (alpha <= 0.01 || w < 0.5) return;
  const h = bottom - top;
  const slab = (f: number, ww: number, color: number, a: number) => {
    const y0 = top + h * f, wt = ww * (taper + (1 - taper) * f);
    g.poly([x - wt / 2, y0, x + wt / 2, y0, x + ww / 2, bottom, x - ww / 2, bottom]).fill({ color, alpha: a });
  };
  for (let i = 0; i < 5; i++) slab(i / 5, w, GOLD, alpha * 0.1);
  slab(0.25, w * 0.24, WHITE, alpha * 0.22);
  slab(0.55, w * 0.24, WHITE, alpha * 0.22);
}

/** Needles of light flung out along a star's four arms: light leaves a point
 *  in straight lines, so its sparks do too. */
function dawnNeedles(t: FxTools, c: Pt, n: number, rot: number, start: number, speed: [number, number], life: [number, number], st: SparkStyle) {
  for (let i = 0; i < n; i++) {
    const a = rot + (i % 4) * (Math.PI / 2) + rand(-0.12, 0.12);
    const v = rand(speed[0], speed[1]);
    const ca = Math.cos(a), sa = Math.sin(a);
    t.spark(c.x + ca * start, c.y + sa * start, ca * v, sa * v, rand(life[0], life[1]), st);
  }
}

/** Glitter over a box: motes that hang and twinkle, lifting slowly. */
function dawnMotes(t: FxTools, r: Box, count: number, life: [number, number], lift = 30) {
  t.emit({ count, palette: GLINT, from: r, dir: [-110, -70], speed: [lift * 0.3, lift], gravity: -20, drag: 0.5,
    life, size: [6, 2] });
}

/** Glitter along a line, DRAWN (see the note at the top): points picked once,
 *  each lit as a beam's point passes it, then twinkling out. */
interface DawnGlitter { u: number[]; off: number[]; born: number[] }

function dawnGlitter(n: number, spread: number): DawnGlitter {
  const gl: DawnGlitter = { u: [], off: [], born: [] };
  for (let i = 0; i < n; i++) {
    gl.u.push(1 - Math.random() * Math.random()); // thickest toward the point
    gl.off.push(rand(-spread, spread));
    gl.born.push(-1);
  }
  return gl;
}

/** `reach` is how far along a->b the light has got (0..1); a lit point lives
 *  `life` seconds, lifting a few px, one in four a tiny star. */
function dawnGlitterDraw(g: Graphics, gl: DawnGlitter, a: Pt, b: Pt, reach: number, age: number, life: number, size: number) {
  const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len;
  for (let i = 0; i < gl.u.length; i++) {
    if (gl.born[i] < 0) {
      if (reach < gl.u[i]) continue;
      gl.born[i] = age;
    }
    const q = (age - gl.born[i]) / life;
    if (q >= 1) continue;
    const al = (1 - q) * (0.4 + 0.6 * (0.5 + 0.5 * Math.sin(age * 38 + i * 2.1)));
    const x = a.x + dx * gl.u[i] + nx * gl.off[i], y = a.y + dy * gl.u[i] + ny * gl.off[i] - q * 9;
    if (i % 4 === 0) {
      const r = size * 2.4 * (1 - 0.4 * q);
      dawnStar(g, x, y, r, r, r * 0.14, 0, WHITE, al);
    } else g.circle(x, y, size * (1 - 0.4 * q)).fill({ color: i % 2 ? PALE : WHITE, alpha: al });
  }
}

export const DAWN: ElementLook = {
  markColor: WARM,

  windUp(t, d) {
    const dur = d.wind + (d.T - d.wind) * 0.3;
    if (d.melee && !d.special) {
      // The lunge is the wind-up: only a glint catching on the card.
      t.draw(dur, (g, k) => dawnStar(g, d.at.x, d.at.y, d.size * 0.3 * k, d.size * 0.3 * k, d.size * 0.025, 0, WHITE, 0.55 * k));
      return;
    }
    // A halo CLOSES on the card — light gathering to the point the beam will
    // fire from — while a star kindles at its heart. A Special's halo wears a
    // crown of rays and draws glitter in with it.
    const R0 = d.size * (d.special ? 0.85 : 0.62), R1 = d.size * 0.3;
    const rays = d.special ? 12 : 0;
    t.draw(dur, (g, k) => {
      const e = easeOut(k);
      const a = Math.min(1, k * 4);
      dawnHalo(g, d.at, R0 + (R1 - R0) * e, rays, d.size * 0.14, k * 0.9, a * (d.special ? 0.95 : 0.75));
      const s = d.size * (d.special ? 0.42 : 0.28) * k;
      dawnStar(g, d.at.x, d.at.y, s, s, s * 0.09, 0, WHITE, 0.9 * k);
    });
    t.charge(d.at, d.size * (d.special ? 1.3 : 0.85), GOLD, d.special ? 0.5 : 0.25, dur);
    if (d.special)
      t.emit({ count: 16, palette: GLINT, from: d.rect, at: "ring", speed: [70, 120], gravity: 0, drag: 1,
        life: [0.2, 0.4], size: [6, 2] });
  },

  gather(t, d) {
    // The square is still empty, so light comes DOWN onto it: a shaft from
    // above, wide and faint at first, narrowing to a bright column as the
    // strike gathers, a halo closing on the square. 'Awakening' — a DAWN card
    // strikes as it lands, and the strike comes out of this light.
    const top = d.rect.y - d.size * 1.35;
    const foot = d.at.y + d.size * 0.12;
    t.draw(d.T, (g, k) => {
      const e = k * k;
      dawnPillar(g, d.at.x, top, foot, d.size * (0.8 - 0.5 * e), 0.25 + 0.6 * e);
      dawnHalo(g, d.at, d.size * (0.62 - 0.3 * easeOut(k)), 0, 0, 0, Math.min(1, k * 3) * 0.8);
    });
    t.charge(d.at, d.size * (d.special ? 1.5 : 1.15), GOLD, d.special ? 0.7 : 0.5, d.T);
    // Needles of light falling down the shaft into the square.
    t.emit({ count: d.special ? 26 : 16, palette: [WHITE, PALE, GOLD],
      from: { x: d.at.x - d.size * 0.22, y: top, w: d.size * 0.44, h: d.size * 0.9 },
      dir: [88, 92], speed: [260, 380], gravity: 0, drag: 1, life: [0.2, 0.4], size: [6, 2], streak: true });
  },

  projectile(t, s) {
    // Light does not arc or tumble: it FIRES. The throw's first stretch is
    // still the halo closing on the caster; then a beam extends from caster to
    // target in a straight line, its point landing on the landing frame, and
    // after the hit the beam drains into the target, leaving glitter hanging
    // along the line. A basic is a thin ray with a bright lance-point; a
    // Special is a sunbeam that thickens into a spear, with a flare and a
    // halo thrown off the caster as it fires.
    const hold = s.seconds * 0.22;
    const fly = s.seconds - hold;
    const after = s.special ? 0.2 : 0.11;
    const total = fly + 0.45;
    const len = Math.hypot(s.to.x - s.from.x, s.to.y - s.from.y) || 1;
    const tip = len * (s.special ? 0.34 : 0.24);
    const gl = dawnGlitter(s.special ? 20 : 10, s.special ? 7 : 4);
    t.draw(total, (g, k) => {
      const age = k * total;
      const f = Math.min(1, age / fly);
      const e = f * (0.55 + 0.45 * f); // fired, then quickening
      const drain = clamp01((age - fly) / after);
      dawnGlitterDraw(g, gl, s.from, s.to, e, age, 0.4, s.special ? 2.2 : 1.7);
      if (drain >= 1) return;
      const head = lerpPt(s.from, s.to, e);
      const tail = lerpPt(s.from, s.to, easeOut(drain));
      const fade = 1 - drain;
      const back = lerpPt(head, tail, Math.min(1, tip / Math.max(1, Math.hypot(head.x - tail.x, head.y - tail.y))));
      // The release: a flare on the caster as the light leaves it.
      const cf = clamp01(1 - age / (s.special ? 0.3 : 0.14));
      if (s.special) {
        const w = (3 + 9 * e) * (0.4 + 0.6 * fade);
        dawnBeam(g, tail, head, w, 0.85 * fade);
        dawnLance(g, back, head, w * 2, PALE, 0.65 * fade);
        dawnFlare(g, head.x, head.y, s.size * 0.22, fade);
        if (cf > 0) {
          dawnFlare(g, s.from.x, s.from.y, s.size * 0.45 * (0.5 + 0.5 * cf), 0.55 * cf, 0, 1.7);
          g.circle(s.from.x, s.from.y, s.size * (0.3 + 0.45 * (1 - cf)))
            .stroke({ width: 3 * cf + 1, color: WARM, alpha: 0.6 * cf });
        }
      } else {
        g.moveTo(tail.x, tail.y).lineTo(head.x, head.y).stroke({ width: 5, color: GOLD, alpha: 0.14 * fade });
        g.moveTo(tail.x, tail.y).lineTo(head.x, head.y).stroke({ width: 1.5, color: PALE, alpha: 0.6 * fade });
        dawnLance(g, back, head, 5, WHITE, 0.85 * fade);
        dawnFlare(g, head.x, head.y, s.size * 0.13, fade);
        if (cf > 0) dawnFlare(g, s.from.x, s.from.y, s.size * 0.24, 0.7 * cf);
      }
    }, { delay: s.delay + hold });
  },

  swing(t, s) {
    // A DAWN card moves like light: its lunge leaves a straight streak, not a
    // swept arc, and the streak snaps shut behind it. A basic's is a thread —
    // the token's own lunge is the motion — a Special's a lance with a star
    // at its point, leaving glitter on the line.
    const after = s.special ? 0.12 : 0.07;
    const total = s.seconds + (s.special ? 0.4 : after);
    const lag = s.special ? 0.55 : 0.32;
    const gl = s.special ? dawnGlitter(10, 5) : null;
    t.draw(total, (g, k) => {
      const age = k * total;
      const f = Math.min(1, age / s.seconds);
      const e = f * f;
      if (gl) dawnGlitterDraw(g, gl, s.from, s.to, e, age, 0.35, 2);
      const drain = clamp01((age - s.seconds) / after);
      if (drain >= 1) return;
      const head = lerpPt(s.from, s.to, e);
      const te = Math.max(0, e - lag);
      const tail = lerpPt(s.from, s.to, te + (e - te) * easeOut(drain));
      const a = Math.min(1, f * 4) * (1 - drain);
      if (s.special) {
        dawnBeam(g, tail, head, 4, 0.7 * a);
        dawnLance(g, lerpPt(tail, head, 0.45), head, 9, PALE, 0.6 * a);
        dawnFlare(g, head.x, head.y, s.size * 0.16, a);
      } else {
        g.moveTo(tail.x, tail.y).lineTo(head.x, head.y).stroke({ width: 4, color: GOLD, alpha: 0.14 * a });
        g.moveTo(tail.x, tail.y).lineTo(head.x, head.y).stroke({ width: 1.5, color: WHITE, alpha: 0.6 * a });
        const r = s.size * 0.09;
        dawnStar(g, head.x, head.y, r, r, r * 0.12, 0, WHITE, 0.8 * a);
      }
    }, { delay: s.delay });
  },

  mark(t, m) {
    // A radiant cross-cut: a four-point star of light struck into the card.
    // Two STRAIGHT cuts, crossing — the first along the swing, the second a
    // beat later across it — each flaring out from the centre; a fainter
    // diagonal star behind them makes it an eight-point sparkle, a halo ring
    // opens round it, and needles fly out along the star's own arms.
    const { c, reach } = m;
    const rot = m.across;
    const dur = 0.46;
    t.draw(dur, (g, k) => {
      const age = k * dur;
      const g1 = easeOut(clamp01(age / 0.07));
      const g2 = easeOut(clamp01((age - 0.04) / 0.07));
      const g3 = easeOut(clamp01((age - 0.08) / 0.08));
      const fade = age < 0.13 ? 1 : Math.pow(1 - (age - 0.13) / (dur - 0.13), 1.3);
      dawnStar(g, c.x, c.y, reach * g1, reach * 0.85 * g2, reach * 0.16, rot, GOLD, 0.5 * fade);
      dawnStar(g, c.x, c.y, reach * 0.95 * g1, reach * 0.8 * g2, reach * 0.055, rot, WHITE, 0.95 * fade);
      dawnStar(g, c.x, c.y, reach * 0.5 * g3, reach * 0.5 * g3, reach * 0.04, rot + Math.PI / 4, PALE, 0.7 * fade);
      if (age > 0.05)
        g.circle(c.x, c.y, reach * (0.42 + 0.3 * easeOut(k)))
          .stroke({ width: 3 * fade + 1, color: WARM, alpha: 0.75 * fade });
      g.circle(c.x, c.y, reach * 0.1).fill({ color: WHITE, alpha: 0.9 * fade });
    });
    t.glow(m.rect, PALE, 0.3, 0.35, 0.95);
    dawnNeedles(t, c, Math.round(20 * m.k), rot, reach * 0.2, [220, 420], [0.18, 0.32], NEEDLE);
    dawnMotes(t, { x: c.x - reach * 0.6, y: c.y - reach * 0.6, w: reach * 1.2, h: reach * 1.2 }, Math.round(8 * m.k), [0.4, 0.7]);
  },

  xSparks(t, c, count) {
    // Light off a basic blow flies dead straight: needles out along the four
    // compass points, so with the X they make an eight-point glint.
    dawnNeedles(t, c, count, -Math.PI / 2, 4, [170, 280], [0.16, 0.3], X_NEEDLE);
  },

  arrive(t, r) {
    // The pillar it gathered in flares and collapses to a thread, a halo
    // opens on the square and a star flares at its heart: the card has come
    // down in a column of light.
    const c = centre(r), s = Math.min(r.w, r.h);
    const top = r.y - s * 1.35;
    t.draw(0.55, (g, k) => {
      const a = Math.pow(1 - k, 1.3);
      dawnPillar(g, c.x, top, c.y + s * 0.12, s * 0.4 * (1 - k) * (1 - k) + 2, a);
      g.circle(c.x, c.y, s * (0.28 + 0.4 * easeOut(k))).stroke({ width: 4 * (1 - k) + 1, color: WARM, alpha: 0.85 * a });
      dawnFlare(g, c.x, c.y, s * 0.5 * (1 - 0.5 * k), a, 0, 1.3);
    });
    t.glow(r, PALE, 0.5, 0.4, 1.0);
    dawnNeedles(t, c, 12, 0, s * 0.15, [240, 360], [0.2, 0.32], NEEDLE);
    dawnMotes(t, { x: r.x + s * 0.15, y: r.y + s * 0.15, w: s * 0.7, h: s * 0.7 }, 18, [0.5, 0.9]);
  },

  impactAccent(t, at, k) {
    // DAWN's burst already throws rays; the accent is the lens flare over it
    // — a four-point star, wider than tall, flashing on the hit point — and a
    // few motes of glitter left hanging where it struck. Grows gently with
    // the hit: the burst under it already scales, and a big one whites out.
    const r = 20 + 9 * k;
    t.draw(0.36, (g, e) => {
      const a = Math.pow(1 - e, 1.5);
      const grow = 0.6 + 0.4 * Math.min(1, e * 6);
      dawnFlare(g, at.x, at.y, r * grow, 0.9 * a, 0, 1.6);
    });
    dawnMotes(t, { x: at.x - r * 0.8, y: at.y - r * 0.8, w: r * 1.6, h: r * 1.6 }, Math.round(6 + 5 * k), [0.5, 0.9]);
  },

  shield(t, r) {
    // A halo settles on the card: a gold ring wearing a crown of rays — an
    // aureole, not a bubble — with a glint at each compass point. It turns a
    // little as it settles, the way a halo would.
    const c = centre(r), s = Math.min(r.w, r.h);
    const dur = 0.95;
    t.draw(dur, (g, k) => {
      const settle = 1 - Math.pow(1 - Math.min(1, k / 0.35), 3);
      const R = s * (0.8 - 0.2 * settle);
      const fade = k < 0.55 ? 1 : 1 - (k - 0.55) / 0.45;
      const a = Math.min(1, k * 8) * fade;
      const spin = k * 0.5;
      dawnHalo(g, c, R, 16, s * 0.16, spin, a);
      const gr = s * 0.13 * (0.6 + 0.4 * settle);
      for (let i = 0; i < 4; i++) {
        const q = spin + Math.PI / 16 + (i * Math.PI) / 2;
        dawnStar(g, c.x + Math.cos(q) * R, c.y + Math.sin(q) * R, gr, gr, gr * 0.12, 0, WHITE, a);
      }
    });
    t.glow(r, PALE, 0.22, 0.6, 1.2);
    // Glitter strung round the halo, drifting along it.
    for (let i = 0; i < 18; i++) {
      const q = (i / 18) * Math.PI * 2 + rand(-0.1, 0.1);
      const R = s * rand(0.58, 0.66), v = rand(10, 25);
      t.spark(c.x + Math.cos(q) * R, c.y + Math.sin(q) * R, -Math.sin(q) * v, Math.cos(q) * v, rand(0.5, 0.9), HALO_MOTE);
    }
  },

  heal(t, r, k) {
    // Morning light on the card: a soft sun glow, golden motes rising slow
    // and glittering, and a few four-point glints catching here and there —
    // gentle, no burst, because a heal is not a hit.
    const kk = Math.max(0.7, Math.min(2.2, k));
    const s = Math.min(r.w, r.h);
    t.glow(r, GOLD, 0.32, 0.95, 1.15);
    t.emit({ count: Math.round(24 * kk), palette: GLINT, from: r, at: "bottom", dir: [-100, -80], speed: [30, 90],
      gravity: -60, drag: 0.6, life: [0.7, 1.2], size: [7, 2] });
    // Glints: fixed places and times, chosen once, popping in turn.
    const n = Math.round(3 + kk);
    const gx: number[] = [], gy: number[] = [], g0: number[] = [];
    for (let i = 0; i < n; i++) {
      gx.push(r.x + r.w * rand(0.15, 0.85));
      gy.push(r.y + r.h * rand(0.1, 0.8));
      g0.push(0.1 + (i / n) * 0.55 + rand(0, 0.08));
    }
    const cx = r.x + r.w / 2;
    const dur = 1.0;
    t.draw(dur, (g, e) => {
      const age = e * dur;
      // A small sun rising out of the card as the light lifts it: soft-edged
      // (three discs stacked), with a thin ring round it.
      const a = Math.sin(Math.PI * Math.min(1, e * 1.15));
      const sy = r.y + r.h * (0.72 - 0.34 * e);
      for (let i = 0; i < 3; i++) g.circle(cx, sy, s * (0.1 + 0.06 * i)).fill({ color: GOLD, alpha: 0.1 * a });
      g.circle(cx, sy, s * 0.24).stroke({ width: 1.2, color: WARM, alpha: 0.4 * a });
      for (let i = 0; i < n; i++) {
        const u = (age - g0[i]) / 0.3;
        if (u <= 0 || u >= 1) continue;
        const gr = s * 0.13 * Math.sin(Math.PI * u);
        dawnStar(g, gx[i], gy[i], gr, gr, gr * 0.1, 0, WHITE, 0.9);
      }
    });
  },

  wall(t, r) {
    // Pillars of light rise off the row, from the middle outward — a
    // colonnade, not a curtain: light stands in straight shafts, each
    // capped with a glint, over a lit footing.
    const n = Math.max(4, Math.round(r.w / 46));
    const pw = (r.w / n) * 0.46;
    const foot = r.y + r.h;
    const H = r.h * 1.45;
    const dur = 1.0;
    t.draw(dur, (g, k) => {
      const age = k * dur;
      const fade = k < 0.55 ? 1 : 1 - (k - 0.55) / 0.45;
      g.rect(r.x, foot - 3, r.w, 3).fill({ color: WARM, alpha: 0.8 * fade * Math.min(1, age * 10) });
      for (let i = 0; i < n; i++) {
        const lag = Math.abs(i - (n - 1) / 2) * 0.05;
        const u = clamp01((age - lag) / 0.22);
        if (u <= 0) continue;
        const h = H * easeOut(u);
        const x = r.x + ((i + 0.5) * r.w) / n;
        dawnPillar(g, x, foot - h, foot, pw, fade * (0.75 + 0.25 * (1 - u)));
        const gr = pw * 0.55 * (1 - 0.5 * u);
        dawnStar(g, x, foot - h, gr, gr * 1.4, gr * 0.12, 0, WHITE, fade * (1 - 0.6 * u));
      }
    });
    // Needles running UP each shaft, glitter hanging in the row.
    for (let i = 0; i < n; i++) {
      const x = r.x + ((i + 0.5) * r.w) / n;
      for (let j = 0; j < 7; j++)
        t.spark(x + rand(-pw * 0.3, pw * 0.3), foot - rand(0, 6), 0, -rand(260, 420), rand(0.25, 0.45), NEEDLE);
    }
    dawnMotes(t, r, Math.round(r.w / 8), [0.6, 1.0]);
  },

  field(t, r) {
    // Sunrise over the whole board: a sun cresting the bottom edge — the
    // horizon — its rays fanning up across the board with warm light climbing
    // behind them, and motes of light hanging in the air. DAWN's weather is a
    // sky getting light, straight rays from one point, not a thing blowing
    // through. Everything is clipped to the board, rays included.
    const sx = r.x + r.w / 2, horizon = r.y + r.h;
    const R = r.w * 0.2;
    const dur = 1.25;
    const nRays = 11;
    t.draw(dur, (g, k) => {
      const rise = easeOut(Math.min(1, k / 0.45));
      const fade = k < 0.5 ? 1 : Math.pow(1 - (k - 0.5) / 0.5, 1.2);
      const sy = horizon + R * (0.85 - 0.75 * rise); // the sun's centre, climbing to just under the horizon
      // Warm light climbing up from the horizon: stacked slabs, brightest low.
      const hh = r.h * 0.75 * rise;
      for (let i = 1; i <= 4; i++)
        g.rect(r.x, horizon - (hh * i) / 4, r.w, (hh * i) / 4).fill({ color: DEEP, alpha: 0.05 * fade });
      // The rays: long thin wedges fanned from the sun, swaying a touch, each
      // cut off where it would leave the board.
      const L = r.h * 1.15 * rise;
      for (let i = 0; i < nRays; i++) {
        const a = -Math.PI + ((i + 0.5) / nRays) * Math.PI + Math.sin(k * 3 + i) * 0.02;
        const ca = Math.cos(a), sa = Math.sin(a);
        const toTop = (sy - r.y) / Math.max(0.05, -sa);
        const toSide = Math.abs(ca) < 1e-3 ? L : (ca > 0 ? r.x + r.w - sx : sx - r.x) / Math.abs(ca);
        const l = Math.min(L, toTop, toSide);
        const hw = (i % 2 ? 0.018 : 0.03) * Math.min(1, 300 / Math.max(1, l));
        g.poly([sx, sy, sx + Math.cos(a - hw) * l, sy + Math.sin(a - hw) * l, sx + Math.cos(a + hw) * l, sy + Math.sin(a + hw) * l])
          .fill({ color: i % 2 ? PALE : GOLD, alpha: 0.17 * fade });
      }
      // The sun: only what has cleared the horizon — a disc cut by it.
      const d = sy - horizon;
      if (d < R * 0.98) {
        const phi = Math.asin(Math.max(-0.98, Math.min(0.98, d / R)));
        const pts: number[] = [];
        for (let i = 0; i <= 16; i++) {
          const q = Math.PI + phi + ((Math.PI - 2 * phi) * i) / 16;
          pts.push(sx + Math.cos(q) * R, sy + Math.sin(q) * R);
        }
        g.poly(pts).fill({ color: PALE, alpha: 0.55 * fade });
        g.poly(pts).stroke({ width: 5, color: GOLD, alpha: 0.3 * fade });
      }
    });
    // Motes of light: hanging low where the light first reaches, rising with
    // it, and a thinner scatter over the rest of the sky.
    t.emit({ count: 90, palette: GLINT, from: { x: r.x, y: r.y + r.h * 0.45, w: r.w, h: r.h * 0.55 }, dir: [-100, -80],
      speed: [30, 110], gravity: -40, drag: 0.6, life: [0.8, 1.25], size: [6, 2] });
    dawnMotes(t, { x: r.x, y: r.y, w: r.w, h: r.h * 0.5 }, 45, [0.6, 1.1], 25);
  },

  move(t, from, to) {
    // Light moves in a straight line, all at once: the card bursts into
    // light where it stood, a streak snaps across, and it flares back in
    // where it lands — a teleport, not a slide.
    const a = centre(from), b = centre(to), s = Math.min(from.w, from.h);
    const dur = 0.62;
    const t0 = 0.06, t1 = 0.24, t2 = 0.34; // streak leaves, lands, snaps shut
    const gl = dawnGlitter(10, 5);
    t.draw(dur, (g, k) => {
      const age = k * dur;
      const out = clamp01(1 - age / 0.22);
      if (out > 0) dawnFlare(g, a.x, a.y, s * 0.42 * (0.4 + 0.6 * out), out, 0, 1.3);
      const f = clamp01((age - t0) / (t1 - t0));
      dawnGlitterDraw(g, gl, a, b, f * f, age, 0.3, 1.8);
      if (f > 0 && age < t2) {
        const head = lerpPt(a, b, f * f);
        const tail = lerpPt(a, b, easeOut(clamp01((age - t1) / (t2 - t1))));
        dawnBeam(g, tail, head, 4, 0.85);
        if (age < t1) dawnFlare(g, head.x, head.y, s * 0.14, 1);
      }
      const inn = clamp01((age - t1) / (dur - t1));
      if (inn > 0) {
        const fa = Math.pow(1 - inn, 1.4);
        dawnFlare(g, b.x, b.y, s * 0.42 * (1 - 0.5 * inn), fa, 0, 1.3);
        g.circle(b.x, b.y, s * (0.25 + 0.35 * easeOut(inn))).stroke({ width: 3 * (1 - inn) + 1, color: WARM, alpha: 0.8 * fa });
      }
    });
    dawnNeedles(t, a, 12, 0, s * 0.12, [200, 320], [0.18, 0.3], NEEDLE);
    dawnMotes(t, from, 14, [0.4, 0.7]);
  },

  trapSet(t, r) {
    // A sigil of light inscribed on the square — a ring drawn round, a
    // four-point star inside it, eight ticks like a sundial's — that then
    // dims INTO the square, shrinking as it sinks, so the trap reads as
    // hidden there rather than gone.
    const c = centre(r), s = Math.min(r.w, r.h);
    const dur = 1.0;
    t.draw(dur, (g, k) => {
      const age = k * dur;
      const sink = clamp01((age - 0.42) / (dur - 0.42));
      const sc = 1 - 0.45 * sink * sink;
      const a = 1 - sink;
      const R = s * 0.36 * sc;
      const ring = clamp01(age / 0.22);
      g.moveTo(c.x, c.y - R).arc(c.x, c.y, R, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ring)
        .stroke({ width: 2, color: WARM, alpha: 0.9 * a });
      const st = easeOut(clamp01((age - 0.12) / 0.18));
      dawnStar(g, c.x, c.y, R * 0.8 * st, R * 0.8 * st, R * 0.1, 0, WHITE, 0.85 * a);
      dawnStar(g, c.x, c.y, R * 0.45 * st, R * 0.45 * st, R * 0.08, Math.PI / 4, GOLD, 0.6 * a);
      const tk = clamp01((age - 0.2) / 0.12);
      if (tk > 0) {
        for (let i = 0; i < 8; i++) {
          const q = (i * Math.PI) / 4 + Math.PI / 8;
          const ca = Math.cos(q), sa = Math.sin(q);
          g.moveTo(c.x + ca * R * 1.08, c.y + sa * R * 1.08).lineTo(c.x + ca * R * (1.08 + 0.2 * tk), c.y + sa * R * (1.08 + 0.2 * tk));
        }
        g.stroke({ width: 1.5, color: PALE, alpha: 0.8 * a });
      }
    });
    t.emit({ count: 14, palette: GLINT, from: r, at: "ring", speed: [80, 130], gravity: 0, drag: 0.9,
      life: [0.3, 0.5], size: [6, 2] });
  },

  pulse(t, r) {
    // A row effect is a ray of light fired straight along the row: a beam
    // racing end to end with a star at its point, the line left lit behind
    // it with glitter on it, and a glint on each square as the point passes.
    const cy = r.y + r.h / 2;
    const dur = 0.85, travel = 0.3;
    const n = Math.max(1, Math.round(r.w / r.h));
    const a: Pt = { x: r.x, y: cy }, b: Pt = { x: r.x + r.w, y: cy };
    const gl = dawnGlitter(18, r.h * 0.14);
    t.draw(dur, (g, k) => {
      const age = k * dur;
      const f = clamp01(age / travel);
      const reach = f * (0.5 + 0.5 * f);
      const fade = age < travel ? 1 : Math.pow(1 - (age - travel) / (dur - travel), 1.2);
      const head: Pt = { x: r.x + r.w * reach, y: cy };
      g.rect(r.x, cy - r.h * 0.3, head.x - r.x, r.h * 0.6).fill({ color: GOLD, alpha: 0.07 * fade });
      dawnBeam(g, a, head, 5 * fade + 1, 0.85 * fade);
      dawnGlitterDraw(g, gl, a, b, reach, age, 0.45, 2);
      if (f < 1) dawnFlare(g, head.x, head.y, r.h * 0.26, 1, 0, 1.4);
      for (let i = 0; i < n; i++) {
        const x = r.x + ((i + 0.5) * r.w) / n;
        const u = (head.x >= x ? age - (travel * (i + 0.5)) / n : -1) / 0.3;
        if (u <= 0 || u >= 1) continue;
        const gr = r.h * 0.3 * Math.sin(Math.PI * Math.min(1, u * 1.5));
        dawnStar(g, x, cy, gr, gr, gr * 0.1, 0, WHITE, 0.9 * (1 - u));
      }
    });
  },
};
