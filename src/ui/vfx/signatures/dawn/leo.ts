/** LEO — Golden Guardian. "Gain +5 HP every round for 7 rounds." The old
 *  lion, king of the wild: Golden Guardian mends him every round.
 *
 *  On its art Leo is a great lion in gold plate, a lush golden mane, a
 *  glowing golden SWORD held crosswise in its jaws, a sun emblem on its
 *  shoulder and a navy-and-gold caparison. The Special is his own, so there is
 *  no delivery: the LANDING is the whole move, on his card.
 *
 *  It is a ROAR. A mane of golden fire flares out all round his card — locks
 *  of amber flame swept back and down like a lion's ruff, gold at the heart, a
 *  bright strand down each, flickering, his eyes blazing in the middle of it —
 *  and the roar goes out of him as a shock of gold: a rippling sound-ring
 *  and a second on its heels, grit and light blown off the card. In the same
 *  breath the sword in his jaws gleams across the card, a glint running down
 *  the blade from the guard to the point, where it strikes a star. Then the
 *  mane draws back in and the guardian settles: a card-shaped aura of gold
 *  hugs his card and BEATS, slowly, twice — the regeneration to come, round
 *  after round — each beat a soft square pulse going out and a few motes
 *  lifting, the sun emblem on his shoulder glowing with it.
 *
 *  Leonine and fierce first, then patient: the mane is the only flame in
 *  DAWN's kit, and the aura is square to the card (a guardian's ward), never
 *  a halo. All of it is light. */
import { centre, rand } from "../../looks/base";
import type { Graphics } from "pixi.js";
import type { FxTools, Pt, SparkStyle } from "../../looks/types";
import type { Signature, SigMoment } from "../types";

const TAU = Math.PI * 2;
// DAWN's light, and the mane's amber: white-hot, pale, gold, deep gold, warm.
const WHITE = 0xffffff, PALE = 0xfff1b3, GOLD = 0xffd54f, DEEP = 0xe0a41c, WARM = 0xffe38a, AMBER = 0xffa53a;
/** Glitter: a mote walks it as it ages, flicking white to deep gold. */
const GLINT = [WHITE, DEEP, WHITE, GOLD, PALE, DEEP, WHITE, DEEP];
/** Light and grit blown off the card by the roar: fast, straight, slowing. */
const BLAST: SparkStyle = { palette: [WHITE, WARM, GOLD, AMBER], gravity: 0, drag: 0.12, size: [6, 1.5], streak: true };
/** Motes lifting off him with each beat of the guardian: slow, twinkling. */
const MEND: SparkStyle = { palette: GLINT, gravity: -60, drag: 0.6, size: [5, 1.5], streak: false };

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeOut = (x: number) => 1 - (1 - x) * (1 - x);
/** Overshoots and settles: a mane flung out. */
const flung = (x: number) => { const k = 1.8; return 1 + (k + 1) * Math.pow(x - 1, 3) + k * Math.pow(x - 1, 2); };

/** The roar's beats, s from the landing: the mane's flare and how long it
 *  burns, the sword's gleam, the two beats of the guardian, and its end. */
const MANE = 0.55, GLEAM = 0.12, BEATS = [0.5, 0.8], END = 1.1;

// ── The mane ─────────────────────────────────────────────────────────────────

/** The locks of the mane round the head: all the way round, each swept down
 *  its own side (a ruff parted at the crown), shortest over the brow and
 *  longest at the cheeks and under the jaw, where a lion's mane falls to its
 *  chest. Two rings, the outer between the inner's locks. */
function locks(n: number) {
  return Array.from({ length: n }, (_, i) => {
    const outer = i % 2, a = -Math.PI / 2 + ((i + 0.5 * outer) / n) * TAU + rand(-0.05, 0.05);
    const up = Math.max(0, -Math.sin(a)); // 1 straight over the brow
    const side = Math.cos(a) > 0.04 ? 1 : Math.cos(a) < -0.04 ? -1 : i % 4 < 2 ? 1 : -1;
    return { a, side, outer, len: rand(0.85, 1.1) * (1 - 0.4 * up) * (outer ? 1.15 : 0.8), phase: rand(0, TAU) };
  });
}

/** One lock of the mane: rooted on the head's ellipse (`rx`, `ry`) at `a`,
 *  `len` long and `w` wide at its root, swept by `bend` and hooking at the
 *  tip (`hook`), its line rippling with `lick`. Its outline as flat points,
 *  and its centre line (a strand). */
function lock(c: Pt, a: number, rx: number, ry: number, len: number, w: number, bend: number, hook: number, lick: number) {
  const N = 8, left: number[] = [], right: number[] = [], spine: number[] = [];
  let x = c.x + Math.cos(a) * rx, y = c.y + Math.sin(a) * ry;
  for (let i = 0; i <= N; i++) {
    const u = i / N, h = a + bend * u + hook * u * u * u + lick * Math.sin(u * Math.PI * 1.5);
    const ww = (w / 2) * Math.pow(1 - u, 0.8);
    const nx = -Math.sin(h), ny = Math.cos(h);
    left.push(x + nx * ww, y + ny * ww);
    right.unshift(x - nx * ww, y - ny * ww);
    spine.push(x, y);
    x += Math.cos(h) * (len / N);
    y += Math.sin(h) * (len / N);
  }
  return { outline: left.concat(right), spine };
}

/** Two glints of a lion's eyes, slanted, at `head`: `k` how fierce. */
function eyes(g: Graphics, head: Pt, s: number, k: number) {
  if (k <= 0.01) return;
  for (const side of [-1, 1]) {
    const x = head.x + side * s * 0.1, y = head.y - s * 0.01, L = s * 0.075, H = s * 0.034, tilt = side * 0.35;
    const ca = Math.cos(tilt), sa = Math.sin(tilt);
    const P = (u: number, v: number) => [x + u * ca - v * sa, y + u * sa + v * ca];
    g.poly([...P(-L * 1.4, 0), ...P(0, -H * 1.6), ...P(L * 1.4, 0), ...P(0, H)], true).fill({ color: GOLD, alpha: 0.35 * k });
    g.poly([...P(-L, 0), ...P(0, -H), ...P(L, 0), ...P(0, H * 0.6)], true).fill({ color: WARM, alpha: 0.95 * k });
    g.circle(x, y, H * 0.5).fill({ color: WHITE, alpha: k });
  }
}

// ── The sword and the sun ────────────────────────────────────────────────────

/** The sword in his jaws, laid across the card: the grip and pommel out to
 *  the left (as on the art), the guard, and the blade running across to its
 *  point on the right. `y` the line it lies on. */
function jawSword(g: Graphics, c: Pt, y: number, s: number, alpha: number) {
  if (alpha <= 0.01) return;
  const guard = c.x - s * 0.28, tip = c.x + s * 0.52, w = s * 0.075, taper = w * 1.6;
  g.poly([guard, y - w * 1.4, tip - taper, y - w * 1.4, tip + w * 1.2, y, tip - taper, y + w * 1.4, guard, y + w * 1.4], true).fill({ color: GOLD, alpha: 0.18 * alpha });
  g.poly([guard, y - w / 2, tip - taper, y - w / 2, tip, y, tip - taper, y + w / 2, guard, y + w / 2], true).fill({ color: GOLD, alpha: 0.6 * alpha })
    .stroke({ width: 1.4, color: WHITE, alpha: 0.85 * alpha });
  g.moveTo(guard + w * 0.4, y).lineTo(tip - taper * 0.8, y).stroke({ width: Math.max(1, w * 0.22), color: WHITE, alpha: 0.8 * alpha });
  // The guard across it, the grip and the pommel out past his jaw.
  g.roundRect(guard - w * 0.3, y - w * 2.1, w * 0.6, w * 4.2, w * 0.2).fill({ color: DEEP, alpha: 0.85 * alpha }).stroke({ width: 1.2, color: WARM, alpha: 0.9 * alpha });
  g.rect(guard - w * 1.9, y - w * 0.25, w * 1.6, w * 0.5).fill({ color: DEEP, alpha: 0.8 * alpha });
  g.circle(guard - w * 2.2, y, w * 0.38).fill({ color: GOLD, alpha: 0.9 * alpha }).stroke({ width: 1, color: WHITE, alpha: 0.8 * alpha });
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

/** The sun emblem on his shoulder: a disc in a ring of twelve flame-rays,
 *  long and short in turn, `r` the disc, `glow` 0..1 how hot it burns. */
function emblem(g: Graphics, p: Pt, r: number, glow: number, alpha: number) {
  if (alpha <= 0.01) return;
  g.circle(p.x, p.y, r * 3).fill({ color: GOLD, alpha: 0.12 * alpha * (0.5 + glow) });
  for (let i = 0; i < 12; i++) {
    const a = (i * TAU) / 12, L = r * (i % 2 ? 1.7 : 2.3) * (0.9 + 0.2 * glow), w = r * 0.3;
    const ca = Math.cos(a), sa = Math.sin(a);
    g.poly([p.x + ca * r - sa * w, p.y + sa * r + ca * w, p.x + ca * L, p.y + sa * L, p.x + ca * r + sa * w, p.y + sa * r - ca * w])
      .fill({ color: i % 2 ? GOLD : WARM, alpha: 0.8 * alpha });
  }
  g.circle(p.x, p.y, r).fill({ color: GOLD, alpha: 0.7 * alpha }).stroke({ width: 1.2, color: WHITE, alpha: 0.85 * alpha });
  g.circle(p.x, p.y, r * 0.5).fill({ color: WHITE, alpha: (0.5 + 0.4 * glow) * alpha });
}

/** A rounded square round `c`, `half` its half-side. */
function ward(g: Graphics, c: Pt, half: number) {
  return g.roundRect(c.x - half, c.y - half, half * 2, half * 2, half * 0.28);
}

export const LEO: Signature = {
  // The roar shakes the board; the guardian after it is still.
  shake: 0.9,
  lunge: false,

  land(t: FxTools, m: SigMoment) {
    const c = centre(m.from), s = m.size;
    // His head, high on the card, and his jaws, where the sword lies.
    const head = { x: c.x, y: c.y - s * 0.08 }, jaw = c.y + s * 0.1;
    const mane = locks(Math.max(18, Math.round(30 * (0.6 + 0.4 * t.quality))));
    const RX = s * 0.25, RY = s * 0.28;

    // THE MANE FLARES: flung out all round him, flickering like fire, and
    // drawn back in — locks of amber with a gold-white heart and a bright
    // strand down each, the outer ring first so the inner lies over it. And
    // in the middle of it his eyes, blazing as he roars.
    const reach = (time: number) => {
      const out = flung(clamp01(time / 0.16));
      return time < 0.3 ? out : out * (1 - 0.6 * easeOut(clamp01((time - 0.3) / (MANE - 0.3))));
    };
    t.draw(MANE, (g, u) => {
      const time = u * MANE, k = reach(time), a = clamp01(time / 0.04) * (1 - clamp01((time - (MANE - 0.2)) / 0.2));
      if (a <= 0.01) return;
      // The mass of the mane under its locks, so it reads as a ruff, not rays.
      g.ellipse(head.x, head.y + s * 0.03, RX + s * 0.1 * k, RY + s * 0.12 * k).stroke({ width: s * 0.2 * k, color: AMBER, alpha: 0.35 * a });
      for (const pass of [1, 0])
        for (const lk of mane) {
          if (lk.outer !== pass) continue;
          const flick = 1 + 0.12 * Math.sin(time * 30 + lk.phase);
          const L = s * 0.48 * lk.len * k * flick, bend = 1.15 * lk.side, hook = -0.7 * lk.side, lick = 0.12 * Math.sin(time * 20 + lk.phase);
          const w = s * (pass ? 0.24 : 0.2);
          const body = lock(head, lk.a, RX, RY, L, w, bend, hook, lick), heart = lock(head, lk.a, RX, RY, L * 0.62, w * 0.55, bend, hook * 0.6, lick);
          g.poly(body.outline, true).fill({ color: pass ? AMBER : DEEP, alpha: 0.5 * a });
          g.poly(heart.outline, true).fill({ color: GOLD, alpha: 0.55 * a });
          g.poly(body.spine, false).stroke({ width: 1.2, color: PALE, alpha: 0.8 * a });
        }
      eyes(g, head, s, a * Math.min(1, 0.4 + k));
    });

    // THE ROAR: a shock of gold out of his jaws, its edge rippling like
    // sound — and a second on its heels.
    for (const [delay, k] of [[0.04, 1], [0.13, 0.6]] as const) {
      const RD = 0.4;
      t.draw(RD, (g, u) => {
        const e = easeOut(u), R = s * (0.45 + 1.15 * e), a = (1 - u) * k;
        const pts: number[] = [];
        for (let i = 0; i < 48; i++) {
          const q = (i / 48) * TAU, rr = R * (1 + 0.02 * Math.sin(q * 18 + u * 20));
          pts.push(head.x + Math.cos(q) * rr, jaw + Math.sin(q) * rr * 0.92);
        }
        g.poly(pts, true).stroke({ width: s * 0.12 * (1 - 0.6 * u), color: GOLD, alpha: 0.22 * a });
        g.poly(pts, true).stroke({ width: 2.5, color: WARM, alpha: 0.9 * a });
      }, { delay });
    }
    t.later(0.04, () => {
      t.flash({ x: head.x, y: jaw }, WARM, 0.45 * (s / 90));
      const n = Math.round(18 * t.quality);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU + rand(-0.15, 0.15), v = rand(220, 380) * (s / 90), r0 = s * 0.35;
        t.spark(head.x + Math.cos(a) * r0, jaw + Math.sin(a) * r0, Math.cos(a) * v, Math.sin(a) * v, rand(0.2, 0.32), BLAST);
      }
    });

    // THE SWORD IN HIS JAWS gleams across the card: the blade lit, a glint
    // running from the guard to the point, where it strikes a star.
    const SD = 0.62;
    t.draw(SD, (g, u) => {
      const time = u * SD, a = clamp01(time / 0.06) * (1 - clamp01((time - 0.4) / 0.22));
      jawSword(g, c, jaw, s, a);
      const run = clamp01((time - 0.05) / 0.2), tipX = c.x + s * 0.52;
      if (run > 0 && run < 1) {
        const x = c.x - s * 0.24 + (tipX - c.x + s * 0.24) * easeOut(run);
        star(g, x, jaw, s * 0.2, s * 0.12, s * 0.025, 0, WHITE, 0.9);
      }
      const strike = Math.max(0, 1 - Math.abs(time - 0.26) / 0.12);
      if (strike > 0) {
        star(g, tipX, jaw, s * 0.5 * strike, s * 0.32 * strike, s * 0.05 * strike, 0, GOLD, 0.45 * strike);
        star(g, tipX, jaw, s * 0.38 * strike, s * 0.24 * strike, s * 0.02, 0, WHITE, strike);
      }
    }, { delay: GLEAM });

    // THE GUARDIAN settles round him: a ward of gold square to his card that
    // beats twice, slowly, the sun on his shoulder glowing with each beat.
    const sunAt = { x: c.x + s * 0.24, y: c.y + s * 0.28 };
    const GD = END - 0.38, beat = (time: number) => Math.max(...BEATS.map((b) => Math.max(0, 1 - Math.abs(time - b) / 0.13)));
    t.draw(GD, (g, u) => {
      const time = 0.38 + u * GD, a = clamp01((time - 0.38) / 0.12) * (1 - clamp01((time - (END - 0.22)) / 0.22)), b = beat(time);
      if (a <= 0.01) return;
      ward(g, c, s * 0.48).stroke({ width: s * 0.1, color: GOLD, alpha: (0.12 + 0.16 * b) * a });
      ward(g, c, s * 0.48).stroke({ width: 1.8 + 1.2 * b, color: WARM, alpha: (0.55 + 0.4 * b) * a });
      // The beat going out: a square pulse spreading off the ward.
      for (const bt of BEATS) {
        const q = (time - bt + 0.05) / 0.38;
        if (q <= 0 || q >= 1) continue;
        ward(g, c, s * (0.48 + 0.3 * easeOut(q))).stroke({ width: 2, color: GOLD, alpha: 0.6 * (1 - q) * a });
      }
      emblem(g, sunAt, s * 0.06 * (1 + 0.15 * b), b, a);
    }, { delay: 0.38 });
    for (const bt of BEATS)
      t.later(bt, () => {
        t.glow(m.from, GOLD, 0.22, 0.4, 0.9);
        for (let i = 0; i < Math.round(5 * t.quality) + 1; i++)
          t.spark(c.x + rand(-0.4, 0.4) * s, c.y + rand(-0.1, 0.4) * s, rand(-10, 10), -rand(30, 70) * (s / 90), rand(0.35, 0.55), MEND);
      });
  },
};
