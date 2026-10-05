/** TOTEM — Rampage. "Gain 1 basic attack hit for 3 rounds." Nothing the band
 *  shoots misses under its eye.
 *
 *  Its art is a carved wooden totem pole on a rune altar: great carved eyes
 *  one above another down its length, blue irises ringed in amber, a winged
 *  owl-wolf head on top, the whole pole wrapped in ribbons of glowing BLUE
 *  spirit-wind. The Special aims at nothing, so there is no delivery: the
 *  LANDING is the whole move, and it is the spirit in the pole waking up.
 *
 *  The rune under it lights first. Then the carved eyes OPEN, one above the
 *  other from the bottom up — each a carved socket whose lids part on a slit
 *  of blue light and then the full iris. Spirit-blue wind ribbons climb the
 *  pole in a double helix as they open (brighter where they pass in front of
 *  it), and when they reach the top the winged head spreads its wings in
 *  light, its own eyes flashing. Then the war-cry: two quick pulses beat out
 *  from the pole, a beat apart, every eye flaring with each — the hit it adds.
 *
 *  Not weather: nothing here is a storm or a gust. It is carved and sacred and
 *  symmetric, a spirit keeping watch. The pole stands up the screen like the
 *  card's art does, whichever way the card faces. The sockets are dark for
 *  real (`dark: true`), each ringed by a lit carved rim; everything else is
 *  light. */
import { centre, rand } from "../../looks/base";
import type { FxTools, Pt, SparkStyle } from "../../looks/types";
import type { Signature, SigMoment } from "../types";

type Box = SigMoment["from"];

const TAU = Math.PI * 2;
// The spirit-wind: blue from deep to white.
const SPIRIT = 0x3a9cff, SPIRIT_HI = 0x9ad8ff, SPIRIT_WHITE = 0xeaf8ff;
// The carved wood: the socket's shadow (dark layer only), its lit rim, and
// the amber ring round every iris on the art.
const WOOD = 0x160b04, CARVE = 0xd98a3c, AMBER = 0xffb050;
/** Spirit motes shed off the ribbons as they climb: rising, slowing. */
const MOTE: SparkStyle = { palette: [SPIRIT_WHITE, SPIRIT_HI, SPIRIT, 0x2a5fc0], gravity: -90, drag: 0.5, size: [4, 1.5], streak: false };
/** Thrown off an eye as it opens: a few quick blue glints. */
const GLINT: SparkStyle = { palette: [SPIRIT_WHITE, SPIRIT_HI, SPIRIT], gravity: 0, drag: 0.3, size: [4, 1], streak: true };

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeOut = (x: number) => 1 - (1 - x) * (1 - x);
/** Overshoots and settles: a lid snapping open, a wing flung out. */
const snap = (x: number) => 1 + 2.7 * Math.pow(x - 1, 3) + 1.7 * Math.pow(x - 1, 2);

/** The whole move, s, and when it starts to fade. */
const D = 1.0, FADE = 0.76;
/** The eyes down the pole (offset from the card's centre, in squares), bottom
 *  first, and when each opens. */
const EYES = [0.24, 0.0, -0.24], OPEN = [0.06, 0.16, 0.26];
/** When the wings begin to spread, and the war-cry's two beats. */
const WINGS = 0.4, PULSES = [0.56, 0.7];

const fadeAll = (time: number) => 1 - clamp01((time - FADE) / (D - FADE));
/** How hard the war-cry is beating at `time`: a spike at each pulse. */
const beat = (time: number) => PULSES.reduce((a, p) => a + (time >= p ? Math.exp(-(time - p) / 0.07) : 0), 0);

/** An almond, `w` wide, its upper lid `h` above the line and its lower lid a
 *  little less below: a carved eye's outline. */
function almond(x: number, y: number, w: number, h: number): number[] {
  const pts: number[] = [], N = 10;
  for (let i = 0; i <= N; i++) {
    const f = i / N;
    pts.push(x - w / 2 + w * f, y - h * Math.sin(Math.PI * f));
  }
  for (let i = N - 1; i >= 1; i--) {
    const f = i / N;
    pts.push(x - w / 2 + w * f, y + h * 0.8 * Math.sin(Math.PI * f));
  }
  return pts;
}

// ── The eyes ─────────────────────────────────────────────────────────────────

/** THE CARVED EYES opening one above another: each socket's shadow (dark),
 *  its carved rim, and inside it the lids parting — a slit of blue light,
 *  then the iris, blue within an amber ring, flaring with every beat. */
function eyes(t: FxTools, c: Pt, s: number) {
  const w = s * 0.3, H = s * 0.085;
  const lids = (time: number, i: number) => snap(clamp01((time - OPEN[i]) / 0.11));
  t.draw(D, (g, u) => {
    const time = u * D, a = clamp01(time / 0.05) * fadeAll(time);
    for (const dy of EYES) g.poly(almond(c.x, c.y + dy * s, w * 1.08, H * 1.2), true).fill({ color: WOOD, alpha: 0.6 * a });
  }, { dark: true });
  t.draw(D, (g, u) => {
    const time = u * D, a = clamp01(time / 0.05) * fadeAll(time), b = beat(time);
    EYES.forEach((dy, i) => {
      const y = c.y + dy * s, open = lids(time, i);
      // The carving round it: there from the first frame, a ridge of lit wood.
      g.poly(almond(c.x, y, w * 1.22, H * 1.45), true).stroke({ width: 1.6, color: CARVE, alpha: 0.75 * a, join: "round" });
      if (open <= 0) return;
      const h = H * Math.max(0.05, open);
      // Blue light inside the lids, a slit at first and brightest then.
      g.circle(c.x, y, s * (0.13 + 0.09 * b)).fill({ color: SPIRIT, alpha: (0.1 + 0.2 * b) * Math.min(1, open) * a });
      g.poly(almond(c.x, y, w * 0.95, h), true).fill({ color: SPIRIT, alpha: 0.35 * a }).stroke({ width: 1.3, color: SPIRIT_HI, alpha: 0.9 * a });
      if (open < 0.45)
        g.moveTo(c.x - w * 0.42, y).lineTo(c.x + w * 0.42, y).stroke({ width: 2, color: SPIRIT_WHITE, alpha: (1 - open / 0.45) * a, cap: "round" });
      // The iris, no bigger than the lids let it be: amber ring, blue, a
      // white heart.
      const r = Math.min(s * 0.068, h * 0.95);
      g.circle(c.x, y, r).fill({ color: SPIRIT, alpha: 0.55 * a }).stroke({ width: Math.max(1.2, s * 0.02), color: AMBER, alpha: 0.85 * a });
      g.circle(c.x, y, r * 0.45).fill({ color: SPIRIT_WHITE, alpha: (0.75 + 0.25 * Math.min(1, b)) * a });
    });
  });
  // Each eye opening: a blue flash and a few glints flicked off its corners.
  EYES.forEach((dy, i) => t.later(OPEN[i] + 0.05, () => {
    const p = { x: c.x, y: c.y + dy * s };
    t.flash(p, SPIRIT_HI, 0.16 * (s / 80));
    const n = Math.max(2, Math.round(4 * t.quality));
    for (let k = 0; k < n; k++) {
      const side = k % 2 ? 1 : -1, ang = (side > 0 ? 0 : Math.PI) + rand(-0.4, 0.4), v = rand(70, 130) * (s / 90);
      t.spark(p.x + side * w * 0.5, p.y, Math.cos(ang) * v, Math.sin(ang) * v, rand(0.2, 0.3), GLINT);
    }
  }));
}

// ── The spirit-wind ──────────────────────────────────────────────────────────

/** THE RIBBONS: two bands of spirit-wind climbing the pole in a double helix,
 *  bright and broad where they pass in front of it, thin behind — up from
 *  the altar and drained into the top, where the wings take them. */
function ribbons(t: FxTools, c: Pt, s: number) {
  const y0 = c.y + s * 0.46, y1 = c.y - s * 0.5;
  const at = (k: number, v: number, time: number) => {
    const th = v * TAU * 1.35 + k * Math.PI + time * 5, R = s * (0.44 - 0.12 * v);
    return { x: c.x + R * Math.sin(th), y: y0 + (y1 - y0) * v + R * 0.16 * Math.cos(th), z: Math.cos(th) };
  };
  const head = (time: number) => Math.max(0, (time - 0.03) / 0.42);
  let motes = 0;
  t.draw(D, (g, u, dt) => {
    const time = u * D, h = head(time), tail = Math.max(0, h - 0.6), top = Math.min(1, h), a = fadeAll(time);
    if (top <= tail) return;
    const N = 22;
    for (let k = 0; k < 2; k++) {
      let prev = at(k, tail, time);
      for (let i = 1; i <= N; i++) {
        const v = tail + ((top - tail) * i) / N, p = at(k, v, time);
        // Along the ribbon: thin at its tail, full at its head; in front of
        // the pole, broad and bright.
        const f = clamp01((v - (h - 0.6)) / 0.6), front = (p.z + prev.z) / 4 + 0.5;
        g.moveTo(prev.x, prev.y).lineTo(p.x, p.y)
          .stroke({ width: Math.max(2, s * (0.05 + 0.05 * front) * f), color: SPIRIT, alpha: (0.15 + 0.3 * front) * f * a, cap: "round" })
          .moveTo(prev.x, prev.y).lineTo(p.x, p.y)
          .stroke({ width: Math.max(1, s * 0.016 * (0.5 + front)), color: front > 0.5 ? SPIRIT_WHITE : SPIRIT_HI, alpha: (0.3 + 0.65 * front) * f * a, cap: "round" });
        prev = p;
      }
    }
    // Motes shed off each ribbon's head as it climbs.
    if (h < 1.05) {
      motes += dt * 46 * t.quality;
      for (; motes >= 1; motes--) {
        const p = at(Math.random() < 0.5 ? 0 : 1, Math.max(0, Math.min(1, h) - rand(0, 0.15)), time);
        t.spark(p.x, p.y, rand(-20, 20) * (s / 90), -rand(40, 110) * (s / 90), rand(0.3, 0.5), MOTE);
      }
    }
  });
}

/** THE ALTAR'S RUNE: a ring laid flat under the pole, glyph ticks turning in
 *  it, lit first and fading as the spirit climbs out of it. */
function altar(t: FxTools, c: Pt, s: number) {
  const y = c.y + s * 0.44, rx = s * 0.46, ry = s * 0.12, D2 = 0.75;
  t.draw(D2, (g, u) => {
    const time = u * D2, a = clamp01(time / 0.06) * (1 - clamp01((time - 0.35) / (D2 - 0.35)));
    const grow = 0.6 + 0.4 * easeOut(clamp01(time / 0.15));
    g.ellipse(c.x, y, rx * grow, ry * grow).stroke({ width: 5, color: SPIRIT, alpha: 0.22 * a })
      .ellipse(c.x, y, rx * grow, ry * grow).stroke({ width: 1.5, color: SPIRIT_HI, alpha: 0.9 * a })
      .ellipse(c.x, y, rx * grow * 0.66, ry * grow * 0.66).stroke({ width: 1, color: SPIRIT, alpha: 0.6 * a });
    for (let i = 0; i < 8; i++) {
      const th = (i / 8) * TAU + time * 1.4, ca = Math.cos(th), sa = Math.sin(th);
      g.moveTo(c.x + ca * rx * grow * 0.72, y + sa * ry * grow * 0.72).lineTo(c.x + ca * rx * grow * 0.94, y + sa * ry * grow * 0.94);
    }
    g.stroke({ width: 1.4, color: SPIRIT_WHITE, alpha: 0.8 * a });
  });
}

// ── The winged head ──────────────────────────────────────────────────────────

/** THE WINGED HEAD on top spreading its wings in light: five feathers a side
 *  flung out from folded to spread, white-blue edged with an amber tip (the
 *  carved wood showing through), the head's own eyes flashing as they open —
 *  and flexing with each beat of the war-cry. */
function wings(t: FxTools, c: Pt, s: number) {
  const hx = c.x, hy = c.y - s * 0.5;
  t.draw(D - WINGS, (g, u) => {
    const time = WINGS + u * (D - WINGS), e = snap(clamp01((time - WINGS) / 0.18)), b = beat(time), a = clamp01((time - WINGS) / 0.05) * fadeAll(time);
    if (a <= 0.02) return;
    for (const side of [-1, 1]) {
      for (let j = 0; j < 5; j++) {
        // From straight up (folded) out toward level (spread); the upper
        // feathers longest.
        const ang = -Math.PI / 2 + side * (0.12 + (0.5 + j * 0.24) * e + 0.08 * b), L = s * (0.64 - j * 0.06) * (0.45 + 0.55 * Math.min(1, e));
        const ux = Math.cos(ang), uy = Math.sin(ang), nx = -uy, ny = ux, W = s * 0.06;
        const rx = hx + side * s * 0.05, r0 = { x: rx + ux * s * 0.04, y: hy + uy * s * 0.04 }, tip = { x: rx + ux * L, y: hy + uy * L };
        const mid = { x: rx + ux * L * 0.45, y: hy + uy * L * 0.45 };
        g.poly([r0.x, r0.y, mid.x + nx * W, mid.y + ny * W, tip.x, tip.y, mid.x - nx * W * 0.6, mid.y - ny * W * 0.6], true)
          .fill({ color: SPIRIT, alpha: (0.4 + 0.2 * b) * a }).stroke({ width: 1.4, color: SPIRIT_WHITE, alpha: 0.85 * a, join: "round" });
        g.circle(tip.x, tip.y, s * 0.018).fill({ color: AMBER, alpha: 0.9 * a });
      }
    }
    // The head: a carved crown lit along its edge, two eyes in it.
    g.circle(hx, hy, s * 0.09).fill({ color: SPIRIT, alpha: 0.18 * a }).stroke({ width: 1.4, color: CARVE, alpha: 0.85 * a });
    const flash = Math.exp(-Math.max(0, time - WINGS - 0.08) / 0.1) + b;
    for (const side of [-1, 1])
      g.circle(hx + side * s * 0.035, hy - s * 0.01, s * (0.018 + 0.012 * Math.min(1.5, flash))).fill({ color: SPIRIT_WHITE, alpha: a });
    g.poly([hx - s * 0.015, hy + s * 0.02, hx + s * 0.015, hy + s * 0.02, hx, hy + s * 0.05], true).fill({ color: AMBER, alpha: 0.8 * a });
  }, { delay: WINGS });
  t.later(WINGS + 0.08, () => t.flash({ x: hx, y: hy }, SPIRIT_HI, 0.22 * (s / 80)));
}

// ── The war-cry ──────────────────────────────────────────────────────────────

/** THE WAR-CRY: two quick pulses beating out from the pole a beat apart —
 *  a ring of spirit-blue and a crown of short strokes flung outward with it,
 *  the second a little wider. Two beats: the extra hit. */
function warCry(t: FxTools, r: Box, c: Pt, s: number) {
  PULSES.forEach((p, i) => t.later(p, () => {
    const k = 1 + 0.18 * i;
    t.ring(r, SPIRIT, 0.45, 1.75 * k, 0.36, 7);
    t.ring(r, SPIRIT_WHITE, 0.5, 1.7 * k, 0.32, 2.5);
    t.glow(r, SPIRIT, 0.22, 0.25, 1.1);
    const D2 = 0.32, n = 14, rot = rand(0, TAU);
    t.draw(D2, (g, u) => {
      const e = easeOut(u), r0 = s * (0.55 + 0.75 * e) * k, a = 1 - u;
      for (let j = 0; j < n; j++) {
        const th = rot + (j / n) * TAU, ca = Math.cos(th), sa = Math.sin(th);
        g.moveTo(c.x + ca * r0, c.y + sa * r0).lineTo(c.x + ca * (r0 + s * 0.22 * (1 - u)), c.y + sa * (r0 + s * 0.22 * (1 - u)));
      }
      g.stroke({ width: 2.5, color: SPIRIT_WHITE, alpha: 0.95 * a, cap: "round" });
    });
  }));
}

export const TOTEM: Signature = {
  // A spirit waking, not a blow: the board barely stirs.
  shake: 0.3,
  lunge: false,

  land(t: FxTools, m: SigMoment) {
    const c = centre(m.from), s = m.size;
    altar(t, c, s);
    eyes(t, c, s);
    ribbons(t, c, s);
    wings(t, c, s);
    warCry(t, m.from, c, s);
  },
};
