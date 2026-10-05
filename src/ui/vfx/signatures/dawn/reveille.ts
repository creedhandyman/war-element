/** REVEILLE — Dawn's Rally. "Heal all allies 3 HP and grant them +2 DMG and +2
 *  speed for 2 rounds." The herald: "Reveille sounds and the line wakes healed,
 *  faster and hitting harder."
 *
 *  His art is a herald in gold-and-white plate raising a long golden WAR-HORN
 *  to the sky, sun-disc shields and banners round him, a host at his back. The
 *  Special aims at nothing, so there is no delivery: the LANDING is the whole
 *  move, and it is a call, not a blessing — SOUND going OUT across the board,
 *  where Empyrean's light comes DOWN.
 *
 *  The horn lifts at his card: a long flared bell swung up from his lips to
 *  the sky. It SOUNDS three times, and with each blast the bell flares and a
 *  wave of sound leaves it: three close, trembling rings, broken like the
 *  arcs drawn round a struck bell, that roll out over the whole board. As the
 *  first wave passes each ally the ally STANDS TO — its edge flares bright
 *  (the damage), golden chevrons climb up the card with streaks of light
 *  shooting up past them (the speed), and two little sun discs glint at its
 *  shoulders, the sun-disc shields of the art. Each later blast rolls over it
 *  again and its edge flares again, a chevron with it: the line answering the
 *  call, beat by beat.
 *
 *  The horn carries a dark underlay so it reads over a bright card; every
 *  other stroke is light. */
import { centre, rand } from "../../looks/base";
import type { Graphics } from "pixi.js";
import type { FxTools, Pt, SparkStyle } from "../../looks/types";
import type { Signature, SigMoment } from "../types";

type Box = SigMoment["from"];

const TAU = Math.PI * 2;
const WHITE = 0xffffff, PALE = 0xfff1b3, GOLD = 0xffd54f, DEEP = 0xe0a41c, WARM = 0xffe38a;
/** The shadow under the horn's brass, on the dark layer only. */
const BRASS_SHADOW = 0x1a1004;
/** Needles of light blown off the bell with each blast. */
const NEEDLE: SparkStyle = { palette: [WHITE, PALE, GOLD], gravity: 0, drag: 0.04, size: [5, 1.5], streak: true };
/** Glitter lifting off a card that stands to: up, quickly — it is ready. */
const LIFT: SparkStyle = { palette: [WHITE, WARM, GOLD, DEEP], gravity: -160, drag: 0.6, size: [4, 1], streak: true };

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeOut = (x: number) => 1 - (1 - x) * (1 - x);

/** The horn lifts over LIFT_T; the three blasts; how long a wave rolls, and
 *  the whole horn's life. */
const LIFT_T = 0.1, BLASTS = [0.1, 0.24, 0.38], ROLL = 0.42, HORN_D = 0.8;
/** A wave's rings: how many, and how far apart (squares). */
const RINGS = 3, GAP = 0.09;

// ── The horn ─────────────────────────────────────────────────────────────────

/** The horn's pose at `time`: its mouthpiece at his lips, swung up from
 *  pointing out level to raised at the sky (up and to his left, as on his
 *  art), recoiling a little with each blast. */
function hornPose(c: Pt, s: number, time: number) {
  const lift = easeOut(clamp01(time / LIFT_T));
  const kick = BLASTS.reduce((a, p) => a + (time >= p ? Math.exp(-(time - p) / 0.05) : 0), 0);
  const ang = Math.PI * (0.98 + 0.37 * lift) + 0.04 * kick;
  const M = { x: c.x + s * 0.12, y: c.y - s * 0.02 };
  return { M, ang, len: s * (0.78 + 0.04 * kick), kick };
}

/** The horn's outline: a long tube from the mouthpiece, curving gently,
 *  flaring hard at the end into the bell. Also its bell's centre and the two
 *  lips of the mouth. */
function hornShape(M: Pt, ang: number, len: number, s: number) {
  const ux = Math.cos(ang), uy = Math.sin(ang), nx = -uy, ny = ux, N = 16;
  const left: number[] = [], right: number[] = [], spine: Pt[] = [];
  for (let i = 0; i <= N; i++) {
    const u = i / N, bend = Math.sin(Math.PI * u) * s * 0.05;
    const x = M.x + ux * len * u + nx * bend, y = M.y + uy * len * u + ny * bend;
    const hw = s * (0.024 + 0.022 * u + 0.15 * Math.pow(u, 6));
    spine.push({ x, y });
    left.push(x + nx * hw, y + ny * hw);
    right.unshift(x - nx * hw, y - ny * hw);
  }
  const bell = spine[N], hw = s * 0.196;
  return { pts: left.concat(right), spine, bell, lipA: { x: bell.x + nx * hw, y: bell.y + ny * hw }, lipB: { x: bell.x - nx * hw, y: bell.y - ny * hw } };
}

/** THE HORN at his card: lifted, sounded three times, lowered out. Dark brass
 *  shadow under it (so it reads over his bright card), gold brass over that,
 *  a white highlight down its length, two bands round the tube and a white
 *  rim round the bell's mouth, which flares with every blast. */
function horn(t: FxTools, r: Box, s: number) {
  const c = centre(r);
  const fade = (time: number) => clamp01(time / 0.05) * (1 - clamp01((time - 0.58) / (HORN_D - 0.58)));
  t.draw(HORN_D, (g, u) => {
    const time = u * HORN_D, p = hornPose(c, s, time), h = hornShape(p.M, p.ang, p.len, s);
    g.poly(h.pts, true).fill({ color: BRASS_SHADOW, alpha: 0.55 * fade(time) }).stroke({ width: 4, color: BRASS_SHADOW, alpha: 0.45 * fade(time), join: "round" });
  }, { dark: true });
  t.draw(HORN_D, (g, u) => {
    const time = u * HORN_D, a = fade(time);
    if (a <= 0.02) return;
    const p = hornPose(c, s, time), h = hornShape(p.M, p.ang, p.len, s), hot = Math.min(1, p.kick);
    g.poly(h.pts, true).fill({ color: GOLD, alpha: (0.5 + 0.25 * hot) * a }).stroke({ width: 1.4, color: WARM, alpha: 0.95 * a, join: "round" });
    // The highlight along the brass, and the bands round the tube.
    const ux = Math.cos(p.ang), uy = Math.sin(p.ang), nx = -uy, ny = ux;
    for (let i = 1; i < 14; i++) {
      const q = h.spine[i], hw = s * (0.024 + 0.022 * (i / 16)) * 0.45;
      if (i === 1) g.moveTo(q.x + nx * hw, q.y + ny * hw);
      else g.lineTo(q.x + nx * hw, q.y + ny * hw);
    }
    g.stroke({ width: 1.2, color: WHITE, alpha: 0.85 * a });
    for (const i of [5, 10]) {
      const q = h.spine[i], hw = s * (0.028 + 0.022 * (i / 16));
      g.moveTo(q.x + nx * hw, q.y + ny * hw).lineTo(q.x - nx * hw, q.y - ny * hw);
    }
    g.stroke({ width: 2, color: DEEP, alpha: 0.95 * a });
    // The bell's mouth: a rim of white, and with each blast a flare of
    // light out of it, along the horn.
    g.moveTo(h.lipA.x, h.lipA.y).lineTo(h.lipB.x, h.lipB.y).stroke({ width: 2.6, color: WHITE, alpha: a, cap: "round" });
    if (p.kick > 0.05) {
      const f = Math.min(1.2, p.kick), bx = h.bell.x + ux * s * 0.04, by = h.bell.y + uy * s * 0.04;
      g.ellipse(bx, by, s * 0.2 * f, s * 0.2 * f).fill({ color: GOLD, alpha: 0.22 * f * a });
      star(g, bx, by, s * 0.34 * f, s * 0.2 * f, s * 0.025, p.ang, WHITE, 0.9 * f * a);
    }
    // The mouthpiece at his lips.
    g.circle(p.M.x, p.M.y, s * 0.03).fill({ color: WARM, alpha: 0.9 * a });
  });
  t.glow(r, WARM, 0.28, 0.7, 1.2);
  // Each blast throws needles of light straight out of the bell.
  BLASTS.forEach((b) => t.later(b, () => {
    const p = hornPose(c, s, b), h = hornShape(p.M, p.ang, p.len, s);
    const n = Math.max(3, Math.round(7 * t.quality));
    for (let i = 0; i < n; i++) {
      const a = p.ang + rand(-0.5, 0.5), v = rand(160, 260) * (s / 90);
      t.spark(h.bell.x, h.bell.y, Math.cos(a) * v, Math.sin(a) * v, rand(0.16, 0.26), NEEDLE);
    }
  }));
}

/** A four-point star: two long arms (`r` along `rot`, `r2` across it) pinched
 *  to a waist `w`. */
function star(g: Graphics, x: number, y: number, r: number, r2: number, w: number, rot: number, color: number, alpha: number) {
  if (alpha <= 0.01 || (r < 0.5 && r2 < 0.5)) return;
  const pts: number[] = [];
  for (let i = 0; i < 8; i++) {
    const a = rot + (i * Math.PI) / 4;
    const d = i % 2 ? w : i % 4 === 0 ? r : r2;
    pts.push(x + Math.cos(a) * d, y + Math.sin(a) * d);
  }
  g.poly(pts).fill({ color, alpha });
}

// ── The call ─────────────────────────────────────────────────────────────────

/** THE WAVES OF SOUND: with each blast, three close rings leave the bell and
 *  roll out over the board at a steady pace — trembling as they go and broken
 *  into arcs, like the lines drawn round a struck bell — brightest toward
 *  where the horn points, thinning and fading as they reach the far allies. */
function waves(t: FxTools, B: Pt, dir: number, reach: number, s: number) {
  const r0 = s * 0.18, speed = (reach - r0) / ROLL, D = ROLL + 0.12;
  BLASTS.forEach((b, k) => {
    const rot = rand(0, TAU);
    t.draw(D, (g, u) => {
      const time = u * D, lead = r0 + speed * time * (1 - 0.15 * (time / D));
      const fade = 1 - clamp01(time / D);
      for (let ring = 0; ring < RINGS; ring++) {
        const R = lead - ring * GAP * s;
        if (R < r0 * 0.6) continue;
        const a = fade * (1 - ring * 0.25) * (k === 0 ? 1 : 0.85);
        const dashes = 26;
        for (let d = 0; d < dashes; d++) {
          const a0 = rot + (d / dashes) * TAU + ring * 0.11, a1 = a0 + (TAU / dashes) * 0.62;
          const face = 0.55 + 0.45 * Math.max(0, Math.cos((a0 + a1) / 2 - dir));
          const arc: number[] = [];
          for (let j = 0; j <= 4; j++) {
            const th = a0 + ((a1 - a0) * j) / 4;
            const rr = R + s * 0.02 * Math.min(1, R / (s * 0.8)) * Math.sin(th * 9 + time * 40 + ring);
            arc.push(B.x + Math.cos(th) * rr, B.y + Math.sin(th) * rr);
          }
          // The leading ring is the loudest: a warm body round a white core.
          if (ring === 0) g.poly(arc, false).stroke({ width: 6, color: WARM, alpha: 0.4 * a * face, cap: "round" });
          g.poly(arc, false).stroke({ width: ring === 0 ? 2.4 : 2, color: ring === 0 ? WHITE : WARM, alpha: a * face, cap: "round" });
        }
        g.circle(B.x, B.y, R).stroke({ width: s * (ring === 0 ? 0.1 : 0.06), color: WARM, alpha: (ring === 0 ? 0.14 : 0.08) * a });
      }
    }, { delay: b });
  });
  /** When blast `k`'s leading ring reaches distance `d` from the bell. */
  return (k: number, d: number) => {
    // Solve r0 + speed * x * (1 - 0.15 x / D) = d for x: a quadratic.
    const A = (speed * 0.15) / D, Bq = -speed, C = d - r0;
    const x = A > 0 ? (-Bq - Math.sqrt(Math.max(0, Bq * Bq - 4 * A * C))) / (2 * A) : C / speed;
    return BLASTS[k] + Math.max(0, x);
  };
}

/** AN ALLY STANDING TO as the call reaches it. On the first blast: the card's
 *  edge flares bright (the damage), three golden chevrons climb up it with
 *  streaks of light shooting up past them (the speed), two small sun discs
 *  glint at its shoulders, and glitter lifts off it. On each later blast:
 *  the edge flares again and one more chevron climbs. */
function standTo(t: FxTools, r: Box, s: number, first: boolean) {
  const c = centre(r);
  const D = first ? 0.55 : 0.4;
  const chevrons = first ? [0, 0.06, 0.12] : [0];
  const streaks = first ? [0.18, 0.4, 0.62, 0.84].map((f) => ({ x: r.x + r.w * f + rand(-0.04, 0.04) * r.w, at: rand(0, 0.08), len: rand(0.22, 0.32) })) : [];
  const discs = first ? [{ x: r.x + r.w * 0.16, y: r.y + r.h * 0.18 }, { x: r.x + r.w * 0.84, y: r.y + r.h * 0.18 }] : [];
  t.draw(D, (g, u) => {
    const time = u * D;
    // The edge: a frame of light round the card, struck bright and easing
    // out a touch as it fades.
    const e = clamp01(time / 0.03) * Math.exp(-time / (first ? 0.18 : 0.12)), grow = 1 + 0.06 * easeOut(clamp01(time / 0.25));
    const w = r.w * grow, h = r.h * grow, rad = s * 0.08;
    g.roundRect(c.x - w / 2, c.y - h / 2, w, h, rad).stroke({ width: 7, color: GOLD, alpha: 0.3 * e * (first ? 1 : 0.7) })
      .roundRect(c.x - w / 2, c.y - h / 2, w, h, rad).stroke({ width: 2.2, color: WHITE, alpha: e * (first ? 1 : 0.75) });
    // The chevrons climbing: ^ shapes rising from its foot to its head.
    for (const at of chevrons) {
      const q = (time - at) / 0.34;
      if (q <= 0 || q >= 1) continue;
      const y = r.y + r.h * (0.82 - 0.7 * easeOut(q)), cw = r.w * 0.26, ch = s * 0.1, a = Math.sin(Math.PI * Math.min(1, q * 1.4)) * (1 - q * 0.3);
      g.moveTo(c.x - cw, y + ch).lineTo(c.x, y).lineTo(c.x + cw, y + ch).stroke({ width: Math.max(4, s * 0.07), color: GOLD, alpha: 0.4 * a, join: "miter", cap: "round" })
        .moveTo(c.x - cw, y + ch).lineTo(c.x, y).lineTo(c.x + cw, y + ch).stroke({ width: Math.max(1.8, s * 0.025), color: WHITE, alpha: 0.95 * a, join: "miter", cap: "round" });
    }
    // Streaks shooting up the card and off its head.
    for (const k of streaks) {
      const q = (time - k.at) / 0.28;
      if (q <= 0 || q >= 1) continue;
      const head = r.y + r.h * 0.95 - (r.h * 1.3) * easeOut(q), tail = head + s * k.len * (1 - q * 0.5);
      g.moveTo(k.x, tail).lineTo(k.x, head).stroke({ width: 1.6, color: PALE, alpha: 0.85 * (1 - q) });
    }
    // The sun discs at its shoulders: popping, a glint across each.
    for (const d of discs) {
      const q = (time - 0.06) / 0.4;
      if (q <= 0 || q >= 1) continue;
      const k = Math.sin(Math.PI * q), R = s * 0.05 * (0.6 + 0.4 * k);
      g.circle(d.x, d.y, R).fill({ color: WARM, alpha: 0.55 * k }).stroke({ width: 1.2, color: WHITE, alpha: 0.9 * k });
      for (let i = 0; i < 8; i++) {
        const th = (i / 8) * TAU + q, ca = Math.cos(th), sa = Math.sin(th);
        g.moveTo(d.x + ca * R * 1.3, d.y + sa * R * 1.3).lineTo(d.x + ca * R * 1.9, d.y + sa * R * 1.9);
      }
      g.stroke({ width: 1.2, color: GOLD, alpha: 0.9 * k });
      star(g, d.x, d.y, R * 2.4, R * 2.4, R * 0.18, 0, WHITE, 0.7 * k);
    }
  });
  if (first) {
    t.glow(r, WARM, 0.3, 0.45, 1.0);
    const n = Math.max(3, Math.round(6 * t.quality));
    for (let i = 0; i < n; i++)
      t.spark(r.x + rand(0.15, 0.85) * r.w, r.y + rand(0.4, 0.9) * r.h, rand(-10, 10) * (s / 90), -rand(90, 160) * (s / 90), rand(0.25, 0.4), LIFT);
  }
}

export const REVEILLE: Signature = {
  // A horn blast: the board feels it, lightly.
  shake: 0.3,
  // He stands and sounds; he does not go anywhere.
  lunge: false,

  land(t: FxTools, m: SigMoment) {
    const c = centre(m.from), s = m.size;
    horn(t, m.from, s);
    // Where the waves leave from: the bell, raised.
    const p = hornPose(c, s, LIFT_T + 0.01), B = hornShape(p.M, p.ang, p.len, s).bell;
    const dist = m.allies.map((r) => Math.hypot(centre(r).x - B.x, centre(r).y - B.y));
    const reach = Math.max(s * 2.6, ...dist.map((d) => d + s * 0.6));
    const reaches = waves(t, B, p.ang, reach, s);
    m.allies.forEach((r, i) => BLASTS.forEach((_, k) => t.later(reaches(k, dist[i]), () => standTo(t, r, s, k === 0))));
  },
};
