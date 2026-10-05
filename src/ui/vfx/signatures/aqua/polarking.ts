/** POLAR KING — Polar Shift. "FREEZE up to 3 opponents anywhere for 2 rounds,
 *  and give allies 3 shields." His word freezes three foes anywhere and
 *  armours his own side.
 *
 *  On his art the Polar King stands before his ice castle in royal furs, a
 *  crown of ice on his brow, a tall sceptre crowned with a star of crystal in
 *  his hand. The DELIVERY is the decree being raised: the sceptre lifts beside
 *  him and its crystal blazes sapphire, cold drawn in to it, while a crown of
 *  ice forms over him and a glint runs along its points.
 *
 *  The LANDING is the decree spoken. The sceptre's star flares and a royal
 *  ring of cold goes out from it over the whole board — a faceted ring, cut
 *  like a crown's rim, pointed at every facet — and where it reaches each
 *  frozen foe, a BLOCK of cut ice SLAMS SHUT round the card: four bevelled
 *  walls driven in from all sides that lock square, a white seal running
 *  round their seams, a sheen crossing the face, splinters thrown. Where it
 *  reaches his own side, a crystal heraldic shield shimmers onto each ally
 *  (the shields). With no one to freeze there is no delivery, and the landing
 *  is the decree and the armour alone.
 *
 *  Of the three ice legendaries his is CUT ice — geometric, royal, sapphire
 *  and silver: Phrost's is breath and rime, Glacius's the glacier. All of it
 *  is light (additive), and the blocks are glass, so the cards read through. */
import { centre, rand } from "../../looks/base";
import type { Graphics } from "pixi.js";
import type { FxTools, Pt, SparkStyle } from "../../looks/types";
import type { Signature, SigMoment } from "../types";

type Box = SigMoment["from"];

const TAU = Math.PI * 2;
// His colours: silver and white for the cut edges, sapphire and a royal blue
// for the crystal's fire, a pale ice for the glass between.
const WHITE = 0xffffff, SILVER = 0xe2eaff, ICE = 0xa8ccff, ROYAL = 0x6f8fff, SAPPHIRE = 0x3d6bff;
/** Cold drawn in to the sceptre, and glitter off a block as it seals. */
const GLINT: SparkStyle = { palette: [WHITE, SILVER, ROYAL], gravity: 0, drag: 0.5, size: [4, 1.5], streak: false };
/** A splinter thrown off a block slamming shut. */
const SHARD: SparkStyle = { palette: [WHITE, SILVER, ICE, SAPPHIRE], gravity: 520, drag: 0.55, size: [7, 2.5], streak: true };

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeOut = (x: number) => 1 - (1 - x) * (1 - x);

// ── The regalia ──────────────────────────────────────────────────────────────

/** The sceptre beside him on the art's side, lifted `lift` (0..1): its shaft
 *  and, on top, where its crystal is. */
function sceptre(c: Pt, s: number, lift: number) {
  const x = c.x - s * 0.32, up = s * 0.14 * lift;
  return { x, y0: c.y + s * 0.44 - up, y1: c.y - s * 0.3 - up, star: { x, y: c.y - s * 0.44 - up } };
}

/** The sceptre drawn: a silver shaft banded at its grip and its head, and the
 *  star of crystal on top — four long points and four short, round a cut
 *  sapphire — blazing `blaze` (0..1). */
function drawSceptre(g: Graphics, c: Pt, s: number, lift: number, blaze: number, alpha: number) {
  if (alpha <= 0.02) return;
  const sc = sceptre(c, s, lift), st = sc.star;
  g.moveTo(sc.x, sc.y0).lineTo(sc.x, sc.y1).stroke({ width: Math.max(4, s * 0.08), color: ROYAL, alpha: 0.2 * alpha, cap: "round" });
  g.moveTo(sc.x, sc.y0).lineTo(sc.x, sc.y1).stroke({ width: Math.max(2, s * 0.036), color: SILVER, alpha: 0.95 * alpha, cap: "round" });
  for (const f of [0.35, 0.92]) {
    const y = sc.y0 + (sc.y1 - sc.y0) * f;
    g.moveTo(sc.x - s * 0.035, y).lineTo(sc.x + s * 0.035, y).stroke({ width: 1.5, color: WHITE, alpha: 0.85 * alpha });
  }
  const R = s * (0.19 + 0.04 * blaze);
  g.circle(st.x, st.y, R * 1.5).fill({ color: SAPPHIRE, alpha: (0.15 + 0.35 * blaze) * alpha });
  g.circle(st.x, st.y, R * 0.8).fill({ color: ROYAL, alpha: 0.35 * blaze * alpha });
  for (let i = 0; i < 8; i++) {
    const a = -Math.PI / 2 + (i * TAU) / 8, L = R * (i % 2 ? 0.5 : i % 4 === 0 ? 1.15 : 0.8), w = R * 0.16;
    const ca = Math.cos(a), sa = Math.sin(a);
    const pts = [st.x - sa * w, st.y + ca * w, st.x + ca * L, st.y + sa * L, st.x + sa * w, st.y - ca * w];
    g.poly(pts, true).fill({ color: ICE, alpha: 0.45 * alpha }).stroke({ width: 1.3, color: WHITE, alpha: 0.95 * alpha });
  }
  const gem: number[] = [];
  for (let i = 0; i < 6; i++) gem.push(st.x + Math.cos((i * TAU) / 6) * R * 0.32, st.y + Math.sin((i * TAU) / 6) * R * 0.32);
  g.poly(gem, true).fill({ color: SAPPHIRE, alpha: 0.7 * alpha }).stroke({ width: 1.2, color: WHITE, alpha: alpha });
  g.circle(st.x, st.y, R * 0.12).fill({ color: WHITE, alpha: (0.5 + 0.5 * blaze) * alpha });
}

/** The crown of ice over him: a band set with sapphires and five points, the
 *  middle one tallest, grown up out of the band `grow` (0..1); `glint` (0..1)
 *  is a gleam running along it from point to point. */
function drawCrown(g: Graphics, c: Pt, r: Box, s: number, grow: number, glint: number, alpha: number) {
  if (alpha <= 0.02 || grow <= 0.02) return;
  const base = r.y + s * 0.16, W = s * 0.56, band = s * 0.08, x0 = c.x + s * 0.04 - W / 2;
  const H = [0.15, 0.22, 0.32, 0.22, 0.15];
  const pts: number[] = [x0, base];
  for (let i = 0; i < 5; i++) {
    const xm = x0 + (W * (i + 0.5)) / 5;
    pts.push(x0 + (W * i) / 5, base - band, xm, base - band - s * H[i] * grow);
  }
  pts.push(x0 + W, base - band, x0 + W, base);
  g.poly(pts, true).fill({ color: ROYAL, alpha: 0.12 * alpha }).stroke({ width: s * 0.09, color: ROYAL, alpha: 0.1 * alpha, join: "round" });
  g.poly(pts, true).fill({ color: ICE, alpha: 0.3 * alpha }).stroke({ width: 1.8, color: WHITE, alpha: 0.95 * alpha, join: "miter" });
  g.moveTo(x0, base - band).lineTo(x0 + W, base - band).stroke({ width: 1, color: WHITE, alpha: 0.7 * alpha });
  for (let i = 0; i < 3; i++) g.circle(x0 + W * (0.25 + i * 0.25), base - band / 2, s * 0.022).fill({ color: SAPPHIRE, alpha: alpha }).stroke({ width: 0.8, color: WHITE, alpha: 0.8 * alpha });
  if (glint > 0 && glint < 1) {
    const i = Math.min(4, Math.floor(glint * 5)), q = glint * 5 - i;
    const gx = x0 + (W * (i + 0.5)) / 5, gy = base - band - s * H[i] * grow, k = Math.sin(Math.PI * q);
    g.moveTo(gx - s * 0.07 * k, gy).lineTo(gx + s * 0.07 * k, gy).moveTo(gx, gy - s * 0.07 * k).lineTo(gx, gy + s * 0.07 * k)
      .stroke({ width: 1.3, color: WHITE, alpha: alpha * k });
  }
}

// ── The decree ───────────────────────────────────────────────────────────────

/** The block of cut ice that slams shut round a frozen card: four bevelled
 *  walls, one off each side, driven in from beyond the card `drive` (1 out,
 *  0 locked) — the frame of a cut block, its inner face the card. */
function walls(r: Box, s: number, drive: number): number[][] {
  const o = s * 0.06, bev = s * 0.15, out = s * 0.55 * drive;
  const X0 = r.x - o, Y0 = r.y - o, X1 = r.x + r.w + o, Y1 = r.y + r.h + o;
  const x0 = X0 + bev, y0 = Y0 + bev, x1 = X1 - bev, y1 = Y1 - bev;
  return [
    [X0, Y0 - out, X1, Y0 - out, x1, y0 - out, x0, y0 - out],
    [X1 + out, Y0, X1 + out, Y1, x1 + out, y1, x1 + out, y0],
    [X1, Y1 + out, X0, Y1 + out, x0, y1 + out, x1, y1 + out],
    [X0 - out, Y1, X0 - out, Y0, x0 - out, y0, x0 - out, y1],
  ];
}

/** A block of ice slamming shut round a frozen card, `delay` in: the walls
 *  driven in hard and locked, a white seal running round their seams as they
 *  meet, a sheen sweeping the face, splinters thrown off the slam — then the
 *  block clears from the card, leaving the game's FREEZE to it. */
function seal(t: FxTools, r: Box, s: number, power: number, delay: number) {
  const p = centre(r), k = Math.max(0.6, Math.min(1.5, power)), SLAM = 0.11, D = 0.7;
  const o = s * 0.06, bev = s * 0.15, cut = [rand(0.25, 0.45), rand(0.4, 0.6), rand(0.55, 0.75), rand(0.3, 0.5)];
  t.draw(D, (g, u) => {
    const time = u * D, q = clamp01(time / SLAM), drive = 1 - q * q;
    const a = clamp01(time / 0.05) * (1 - clamp01((time - 0.42) / (D - 0.42)));
    for (const w of walls(r, s, drive))
      g.poly(w, true).fill({ color: ICE, alpha: 0.24 * a }).stroke({ width: 1.4, color: SILVER, alpha: 0.95 * a, join: "miter" });
    if (q < 1) return;
    // Locked: the inner face glassed over, and the seal running round the seams.
    const after = time - SLAM;
    const ix = r.x - o + bev, iy = r.y - o + bev, iw = r.w + 2 * o - 2 * bev, ih = r.h + 2 * o - 2 * bev;
    g.rect(ix, iy, iw, ih).fill({ color: SAPPHIRE, alpha: 0.14 * a });
    // The face cut in facets, as a gem's table is.
    g.moveTo(ix, iy + ih * cut[0]).lineTo(ix + iw * cut[1], iy).moveTo(ix + iw, iy + ih * cut[2]).lineTo(ix + iw * cut[3], iy + ih)
      .moveTo(ix + iw * cut[1], iy).lineTo(ix + iw, iy + ih * cut[2]).stroke({ width: 1, color: ICE, alpha: 0.55 * a });
    // Crystal points jutting off its corners.
    for (const [cx, cy, dx, dy] of [[r.x - o, r.y - o, -1, -1], [r.x + r.w + o, r.y - o, 1, -1], [r.x + r.w + o, r.y + r.h + o, 1, 1], [r.x - o, r.y + r.h + o, -1, 1]]) {
      const L = s * 0.17 * easeOut(clamp01(after / 0.08)), w = s * 0.06;
      g.poly([cx + dx * w, cy, cx + dx * L * 0.71, cy + dy * L * 0.71, cx, cy + dy * w], true).fill({ color: ICE, alpha: 0.4 * a }).stroke({ width: 1.2, color: WHITE, alpha: 0.9 * a });
    }
    const sealA = 1 - clamp01(after / 0.25);
    if (sealA > 0)
      g.rect(r.x - o, r.y - o, r.w + 2 * o, r.h + 2 * o).stroke({ width: 3, color: WHITE, alpha: 0.9 * sealA })
        .rect(r.x - o + bev, r.y - o + bev, r.w + 2 * o - 2 * bev, r.h + 2 * o - 2 * bev).stroke({ width: 1.5, color: WHITE, alpha: 0.8 * sealA });
    // The sheen: a band of light crossing the face corner to corner.
    const sw = clamp01((after - 0.05) / 0.3);
    if (sw > 0 && sw < 1) {
      const span = r.w + r.h, d = -r.h + span * sw, b = s * 0.08;
      const x0 = r.x + Math.max(0, d), y0 = r.y + Math.max(0, -d), x1 = r.x + Math.min(r.w, d + r.h), y1 = r.y + r.h - Math.max(0, d + r.h - r.w);
      g.moveTo(x0, y0).lineTo(x1, y1).stroke({ width: b, color: WHITE, alpha: 0.22 * Math.sin(Math.PI * sw) * a });
    }
  }, { delay });
  t.later(delay + SLAM, () => {
    t.flash(p, ROYAL, 0.14 * k * (s / 80));
    const n = Math.round(10 * k);
    for (let i = 0; i < n; i++) {
      // Off the seams: each splinter from a wall, out away from the card.
      const side = i % 4, f = rand(-0.5, 0.5), h = r.w / 2 + o;
      const x = side === 1 ? p.x + h : side === 3 ? p.x - h : p.x + f * r.w;
      const y = side === 0 ? p.y - h : side === 2 ? p.y + h : p.y + f * r.h;
      const a = Math.atan2(y - p.y, x - p.x) + rand(-0.6, 0.6), v = rand(120, 240) * (s / 90);
      t.spark(x, y, Math.cos(a) * v, Math.sin(a) * v - rand(20, 60) * (s / 90), rand(0.3, 0.5), SHARD);
    }
    t.emit({ count: Math.round(5 * k), palette: GLINT.palette, from: r, speed: [5, 20], gravity: 0, drag: 0.5, life: [0.3, 0.5], size: [4, 1.5] });
  });
}

/** A heraldic shield of crystal shimmering onto an ally, `delay` in: drawn in
 *  from a little larger than it ends, its facets cut from the boss, a sheen
 *  down it — the armour he gives his side — then fading to the board's pips. */
function plate(t: FxTools, r: Box, s: number, delay: number) {
  const p = centre(r), D = 0.75;
  const shape = (k: number) => [[-0.25, -0.3], [0.25, -0.3], [0.26, 0], [0.19, 0.17], [0, 0.33], [-0.19, 0.17], [-0.26, 0]]
    .flatMap(([x, y]) => [p.x + x * s * k, p.y + y * s * k]);
  t.draw(D, (g, u) => {
    const time = u * D, k = 1 + 0.3 * (1 - easeOut(clamp01(time / 0.16))), a = clamp01(time / 0.1) * (1 - clamp01((time - 0.45) / (D - 0.45)));
    const pts = shape(k);
    g.poly(pts, true).fill({ color: ICE, alpha: 0.2 * a }).stroke({ width: 1.6, color: SILVER, alpha: 0.95 * a, join: "miter" });
    // The facets: from the boss out to each corner, and its spine.
    for (let i = 0; i < pts.length; i += 2) g.moveTo(p.x, p.y - s * 0.03 * k).lineTo(pts[i], pts[i + 1]).stroke({ width: 0.9, color: ICE, alpha: 0.7 * a });
    g.circle(p.x, p.y - s * 0.03 * k, s * 0.035).fill({ color: SAPPHIRE, alpha: 0.8 * a }).stroke({ width: 1, color: WHITE, alpha: a });
    const sw = clamp01((time - 0.12) / 0.3);
    if (sw > 0 && sw < 1) {
      const y = p.y + (-0.3 + 0.63 * sw) * s * k;
      g.moveTo(p.x - s * 0.24 * k, y).lineTo(p.x + s * 0.24 * k, y - s * 0.06).stroke({ width: 2, color: WHITE, alpha: 0.6 * Math.sin(Math.PI * sw) * a });
    }
  }, { delay });
  t.later(delay + 0.1, () => t.emit({ count: 4, palette: GLINT.palette, from: r, speed: [5, 20], gravity: 0, drag: 0.5, life: [0.3, 0.5], size: [4, 1.5] }));
}

export const POLAR_KING: Signature = {
  shake: 0.9,
  // He does not close on anyone: his word does the reaching.
  lunge: false,

  deliver(t: FxTools, m: SigMoment, seconds: number) {
    const c = centre(m.from), s = m.size, T = seconds;
    // THE SCEPTRE raised, its star blazing; THE CROWN forming over him.
    t.draw(T, (g, u) => {
      const time = u * T, lift = easeOut(clamp01(time / (T * 0.4)));
      drawSceptre(g, c, s, lift, clamp01(time / T), clamp01(time / (T * 0.15)));
      drawCrown(g, c, m.from, s, easeOut(clamp01((time - T * 0.25) / (T * 0.4))), clamp01((time - T * 0.7) / (T * 0.3)), clamp01((time - T * 0.2) / (T * 0.15)));
    });
    const st = sceptre(c, s, 1).star;
    t.charge(st, s * 1.2, ROYAL, 0.45, T);
    // The cold drawn in to the crystal, glittering.
    const n = Math.round(10 * t.quality);
    for (let i = 0; i < n; i++)
      t.later(rand(0.1, 0.8) * T, () => {
        const a = rand(0, TAU), d = s * rand(0.45, 0.7), life = rand(0.18, 0.28);
        t.spark(st.x + Math.cos(a) * d, st.y + Math.sin(a) * d, (-Math.cos(a) * d) / life, (-Math.sin(a) * d) / life, life, GLINT);
      });
  },

  land(t: FxTools, m: SigMoment) {
    const c = centre(m.from), s = m.size, st = sceptre(c, s, 1).star;
    // Everything the decree reaches, foe or friend, and when the ring gets there.
    const reachOf = (r: Box) => {
      const p = centre(r);
      return Math.hypot(p.x - st.x, p.y - st.y);
    };
    const reach = Math.max(s * 1.6, ...m.targets.map((r) => reachOf(r) + s * 0.4), ...m.allies.map((r) => reachOf(r) + s * 0.4));
    const RUN = 0.36, R0 = s * 0.25;
    const radius = (time: number) => R0 + (reach - R0) * easeOut(clamp01(time / RUN));
    const when = (r: Box) => RUN * (1 - Math.sqrt(1 - clamp01((reachOf(r) - R0) / (reach - R0))));

    // The regalia, held high as he speaks, then gone.
    t.draw(0.7, (g, u) => {
      const time = u * 0.7, a = 1 - clamp01((time - 0.3) / 0.4), flare = Math.exp(-time * 9);
      drawSceptre(g, c, s, 1, 0.6 + 0.4 * flare, a);
      drawCrown(g, c, m.from, s, 1, 0, a);
    });
    t.flash(st, SILVER, 0.35 * (s / 80));

    // THE DECREE: a ring of cold out from the star over the whole board, cut
    // in facets like a crown's rim, a point at every facet.
    const D = RUN + 0.3, FACETS = 16, rot = rand(0, TAU);
    t.draw(D, (g, u) => {
      const time = u * D, R = radius(time), a = 1 - clamp01((time - RUN * 0.75) / (D - RUN * 0.75));
      const outer: number[] = [], inner: number[] = [];
      for (let i = 0; i < FACETS; i++) {
        const ang = rot + (i * TAU) / FACETS + time * 0.4;
        outer.push(st.x + Math.cos(ang) * R, st.y + Math.sin(ang) * R);
        inner.push(st.x + Math.cos(ang) * R * 0.9, st.y + Math.sin(ang) * R * 0.9);
      }
      g.poly(outer, true).stroke({ width: s * 0.14, color: ROYAL, alpha: 0.12 * a, join: "miter" });
      g.poly(outer, true).stroke({ width: 2.4, color: SILVER, alpha: 0.95 * a, join: "miter" });
      g.poly(inner, true).stroke({ width: 1, color: ICE, alpha: 0.6 * a, join: "miter" });
      for (let i = 0; i < FACETS; i++) {
        const ang = rot + (i * TAU) / FACETS + time * 0.4, ca = Math.cos(ang), sa = Math.sin(ang), L = s * 0.09;
        g.poly([st.x + ca * R - sa * L * 0.25, st.y + sa * R + ca * L * 0.25, st.x + ca * (R + L), st.y + sa * (R + L), st.x + ca * R + sa * L * 0.25, st.y + sa * R - ca * L * 0.25], true)
          .fill({ color: WHITE, alpha: 0.85 * a });
      }
    });

    // Where it reaches: the foes sealed in ice, his own side armoured.
    m.targets.forEach((r, i) => seal(t, r, s, m.power[i] ?? 0.55, when(r)));
    for (const r of m.allies) plate(t, r, s, when(r));
  },
};
