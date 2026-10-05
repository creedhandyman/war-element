/** FALLOW — Hunting Season. "Deal 3 DMG CRIT to 4 opponents. Auto-hits —
 *  ignores BLIND and EVASION." In Fallow's hunting season every crit pins its
 *  target.
 *
 *  The DELIVERY is the ranger at the draw, as on its art: a longbow drawn in
 *  gold light across the card, a golden arrow of light nocked and pulled back
 *  while autumn leaves stir round him. Then four arrows, one after another:
 *  the bow swings a little toward each mark as it looses, the string snapping
 *  home with the next arrow already on it, and every arrow leaves along the
 *  bow and then BENDS onto its own target. They cannot miss, so they do not
 *  fly as if they could. Each shot blows leaves off him; every arrow lands on
 *  the landing frame.
 *
 *  The LANDING is the tally. Each arrow drives in and STAYS — pinned in its
 *  card and quivering, the crit that pins (Fallow's crits ROOT) — with a sharp
 *  golden crit star bursting where it went in and the autumn leaves round the
 *  card thrown up off it to drift down. A kill gets a second, bigger star.
 *
 *  All of it is light (additive): gold on the near-black board, and the leaves
 *  lit amber, so nothing here paints dark. */
import { centre, rand } from "../../looks/base";
import type { Graphics } from "pixi.js";
import type { FxTools, Pt, SparkStyle } from "../../looks/types";
import type { Signature, SigMoment } from "../types";

type Box = SigMoment["from"];

const TAU = Math.PI * 2;
// The arrow's light: white-hot at the point, gold through, amber at the edge.
const WHITE = 0xffffff, GOLD_HI = 0xfff1b8, GOLD = 0xffcc48, AMBER = 0xffa12e;
/** The autumn he stands in: amber, orange and rust leaves, lit. */
const AUTUMN = [0xffb040, 0xff8a26, 0xec6a1e, 0xffc860];
/** Motes shed off an arrow in flight, hanging where it passed. */
const GLINT: SparkStyle = { palette: [WHITE, GOLD_HI, GOLD, AMBER], gravity: 0, drag: 0.35, size: [5, 1.5], streak: false };
/** Thrown off a crit: fast gold streaks, mostly on along the arrow's line. */
const SPARK: SparkStyle = { palette: [WHITE, GOLD_HI, GOLD, AMBER], gravity: 300, drag: 0.4, size: [7, 2], streak: true };

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeOut = (x: number) => 1 - (1 - x) * (1 - x);
/** An angle folded into -PI..PI. */
const fold = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

// ── The leaf ─────────────────────────────────────────────────────────────────

/** A maple leaf's outline, round from the stem: [angle from the tip, reach] —
 *  five broad lobes, each a point with a tooth either side, and shallow
 *  notches between them, so it reads as a leaf and not a flame. */
const LOBES: [number, number][] = [[Math.PI, 0.12], [-2.55, 0.3], [-2.1, 0.6], [-1.75, 0.42], [-1.4, 0.64], [-1.1, 0.94],
  [-0.85, 0.78], [-0.5, 0.5], [-0.22, 0.74], [0, 1], [0.22, 0.74], [0.5, 0.5], [0.85, 0.78], [1.1, 0.94], [1.4, 0.64],
  [1.75, 0.42], [2.1, 0.6], [2.55, 0.3]];

/** A maple leaf, the autumn on the art: five pointed lobes round a stem, `len`
 *  from stem to tip, the tip along `ang`. `open` is how face-on it is, so a
 *  turning leaf thins to a sliver and back — the flicker that reads as flutter
 *  (and five points, not LEAF's teardrop, read as autumn). */
function maple(g: Graphics, x: number, y: number, len: number, ang: number, open: number, color: number, alpha: number) {
  if (alpha <= 0.02 || len < 2) return;
  const R = len * 0.55, c = Math.cos(ang), s = Math.sin(ang), o = Math.max(0.15, open), pts: number[] = [];
  for (const [a, r] of LOBES) {
    const lx = Math.cos(a) * r * R, ly = Math.sin(a) * r * R * o;
    pts.push(x + lx * c - ly * s, y + lx * s + ly * c);
  }
  g.poly(pts, true).fill({ color, alpha });
  g.moveTo(x - c * R * 0.1, y - s * R * 0.1).lineTo(x - c * R * 0.7, y - s * R * 0.7).stroke({ width: 1, color, alpha });
  if (len > 10 && o > 0.45)
    g.moveTo(x - c * R * 0.15, y - s * R * 0.15).lineTo(x + c * R * 0.75, y + s * R * 0.75).stroke({ width: 1, color: GOLD_HI, alpha: alpha * 0.45 });
}

/** Leaves thrown off `at` and let go: the throw bleeding off fast, then each
 *  drifting down at its own pace, rocking and turning over — closed form from
 *  birth, so a flurry is one Graphics and no state. */
function flurry(t: FxTools, at: Pt, n: number, len: number, speed: number, life: number, dir: number, spread: number, delay = 0) {
  const ls = Array.from({ length: Math.max(1, Math.round(n)) }, (_, i) => {
    const a = dir + rand(-spread, spread), v = speed * rand(0.5, 1);
    return { vx: Math.cos(a) * v, vy: Math.sin(a) * v, spin: rand(7, 12) * (Math.random() < 0.5 ? -1 : 1), ph: rand(0, TAU),
      len: len * rand(0.8, 1.2), life: life * rand(0.8, 1), color: AUTUMN[i % AUTUMN.length] };
  });
  t.draw(life, (g, u) => {
    const time = u * life, d = 0.16 * (1 - Math.exp(-time / 0.16));
    for (const l of ls) {
      const q = time / l.life;
      if (q >= 1) continue;
      const turn = Math.cos(l.spin * time + l.ph);
      maple(g, at.x + l.vx * d + l.len * 0.5 * Math.sin(time * 6 + l.ph), at.y + l.vy * d + l.len * 2.6 * time, l.len,
        l.ph + l.spin * time * 0.25, 0.2 + 0.8 * Math.abs(turn), l.color, Math.min(1, q * 12) * (1 - q * q) * 0.95);
    }
  }, { delay });
}

// ── The bow and the arrow ────────────────────────────────────────────────────

/** A golden arrow of light, its point at (x, y) heading along `ang`, `len`
 *  from nock to point: a bright shaft in a gold halo, a broadhead, fletching.
 *  `head` false leaves the point off — it is buried in a card. */
function arrow(g: Graphics, x: number, y: number, ang: number, len: number, s: number, alpha: number, head = true) {
  if (alpha <= 0.02) return;
  const ux = Math.cos(ang), uy = Math.sin(ang), nx = -uy, ny = ux, hs = s * 0.12;
  const bx = x - ux * len, by = y - uy * len, ex = head ? x - ux * hs * 0.5 : x, ey = head ? y - uy * hs * 0.5 : y;
  g.moveTo(bx, by).lineTo(ex, ey).stroke({ width: Math.max(3, s * 0.065), color: GOLD, alpha: 0.3 * alpha, cap: "round" });
  g.moveTo(bx, by).lineTo(ex, ey).stroke({ width: Math.max(1.3, s * 0.024), color: GOLD_HI, alpha: 0.95 * alpha, cap: "round" });
  // The fletching: a vane either side at the nock end, swept back.
  const f0 = len * 0.03, f1 = len * 0.26, fw = s * 0.06;
  for (const side of [-1, 1])
    g.poly([bx + ux * f1, by + uy * f1, bx + ux * f0, by + uy * f0, bx - ux * fw * 0.35 + nx * fw * side, by - uy * fw * 0.35 + ny * fw * side,
      bx + ux * f1 * 0.55 + nx * fw * 0.7 * side, by + uy * f1 * 0.55 + ny * fw * 0.7 * side], true).fill({ color: GOLD, alpha: 0.7 * alpha });
  if (!head) return;
  g.circle(x - ux * hs * 0.3, y - uy * hs * 0.3, hs * 0.75).fill({ color: GOLD, alpha: 0.28 * alpha });
  g.poly([x, y, x - ux * hs + nx * hs * 0.45, y - uy * hs + ny * hs * 0.45, x - ux * hs * 0.6, y - uy * hs * 0.6,
    x - ux * hs - nx * hs * 0.45, y - uy * hs - ny * hs * 0.45], true).fill({ color: WHITE, alpha: 0.95 * alpha });
}

/** The longbow drawn in light across the card, facing `aim`: two limbs bent
 *  back through the grip with recurved tips, the string pulled `pull` px
 *  behind its rest, a rune glowing on each limb as on the art. Returns where
 *  the string's nock is. */
function bow(g: Graphics, c: Pt, s: number, aim: number, draw: number, pull: number, alpha: number): Pt {
  const ux = Math.cos(aim), uy = Math.sin(aim), vx = -uy, vy = ux;
  const gx = c.x + ux * s * 0.1, gy = c.y + uy * s * 0.1, L = s * 0.46, bend = s * (0.12 + 0.1 * draw);
  const ax = gx + vx * L - ux * bend, ay = gy + vy * L - uy * bend, bx = gx - vx * L - ux * bend, by = gy - vy * L - uy * bend;
  const cx = 2 * gx - (ax + bx) / 2, cy = 2 * gy - (ay + by) / 2;
  const nock = { x: (ax + bx) / 2 - ux * pull, y: (ay + by) / 2 - uy * pull };
  if (alpha <= 0.02) return nock;
  const r = s * 0.07;
  const limb = () => g.moveTo(ax + ux * r + vx * r * 0.3, ay + uy * r + vy * r * 0.3).lineTo(ax, ay).quadraticCurveTo(cx, cy, bx, by)
    .lineTo(bx + ux * r - vx * r * 0.3, by + uy * r - vy * r * 0.3);
  limb().stroke({ width: Math.max(4, s * 0.09), color: GOLD, alpha: 0.24 * alpha, join: "round", cap: "round" });
  limb().stroke({ width: Math.max(1.8, s * 0.032), color: GOLD_HI, alpha: 0.95 * alpha, join: "round", cap: "round" });
  g.moveTo(ax, ay).lineTo(nock.x, nock.y).lineTo(bx, by).stroke({ width: 1, color: WHITE, alpha: 0.75 * alpha });
  // The runes: a hot point part way up each limb.
  for (const f of [0.3, 0.7]) {
    const q = 1 - f, x = q * q * ax + 2 * q * f * cx + f * f * bx, y = q * q * ay + 2 * q * f * cy + f * f * by;
    g.circle(x, y, s * 0.035).fill({ color: AMBER, alpha: 0.5 * alpha }).circle(x, y, s * 0.014).fill({ color: WHITE, alpha: 0.9 * alpha });
  }
  return nock;
}

// ── The volley ───────────────────────────────────────────────────────────────

/** Each arrow's flight: where it leaves the bow, the bow's heading as it
 *  looses (the control point of its curve), and its mark — in the order the
 *  bow sweeps them. Fixed by the targets alone, so the landing knows exactly
 *  how each arrow came in. */
function volley(m: SigMoment) {
  const c = centre(m.from), s = m.size;
  let ax = 0, ay = 0;
  for (const r of m.targets) {
    const p = centre(r), d = Math.hypot(p.x - c.x, p.y - c.y) || 1;
    ax += (p.x - c.x) / d;
    ay += (p.y - c.y) / d;
  }
  // Drawn on the pack as a whole; spread all round him, on whatever is ahead.
  const mean = Math.hypot(ax, ay) > 0.35 * m.targets.length ? Math.atan2(ay, ax) : Math.atan2(m.ahead.y, m.ahead.x);
  return m.targets.map((r, i) => {
    const p2 = centre(r);
    return { r, p2, off: fold(Math.atan2(p2.y - c.y, p2.x - c.x) - mean), power: m.power[i] ?? 1, killed: m.killed[i] ?? false };
  }).sort((a, b) => a.off - b.off).map((sh) => {
    // The bow swings only part way to each mark: the arrow does the rest.
    const aim = mean + sh.off * 0.18, ux = Math.cos(aim), uy = Math.sin(aim);
    const p0 = { x: c.x + ux * s * 0.25, y: c.y + uy * s * 0.25 };
    const d = Math.hypot(sh.p2.x - p0.x, sh.p2.y - p0.y);
    return { ...sh, aim, p0, p1: { x: p0.x + ux * d * 0.62, y: p0.y + uy * d * 0.62 } };
  });
}
type Flight = ReturnType<typeof volley>[number];

/** The point `e` (0..1) along an arrow's curve, and its heading there. */
function along(f: Flight, e: number) {
  const q = 1 - e;
  return {
    x: q * q * f.p0.x + 2 * q * e * f.p1.x + e * e * f.p2.x, y: q * q * f.p0.y + 2 * q * e * f.p1.y + e * e * f.p2.y,
    a: Math.atan2(q * (f.p1.y - f.p0.y) + e * (f.p2.y - f.p1.y), q * (f.p1.x - f.p0.x) + e * (f.p2.x - f.p1.x)),
  };
}

export const FALLOW: Signature = {
  shake: 0.7,

  deliver(t: FxTools, m: SigMoment, seconds: number) {
    const c = centre(m.from), s = m.size, T = seconds;
    const shots = volley(m), n = shots.length;
    if (!n) return;
    // On the string by a third of the way in; the rest loosed in a quick
    // sweep, the last with a fair stretch of flight still to make.
    const DRAW = T * 0.34, gap = n > 1 ? Math.min(Math.max(0.045, T * 0.11), (T * 0.74 - DRAW) / (n - 1)) : 1;
    const loose = (i: number) => DRAW + i * gap, END = T + 0.12, SNAP = 0.3, LAST = loose(n - 1);
    /** The bow at `time`: where it faces, how far drawn, which arrow is on
     *  the string (-1: none), how long since the string last snapped, and how
     *  far through the gap between shots it is. */
    const state = (time: number) => {
      if (time < DRAW) return { aim: shots[0].aim, draw: easeOut(time / DRAW), on: 0, since: -1, f: 0 };
      const j = Math.min(n - 1, Math.floor((time - DRAW) / gap)), since = time - loose(j);
      if (j >= n - 1) return { aim: shots[j].aim, draw: 0, on: -1, since, f: 0 };
      const f = since / gap, aim = shots[j].aim + fold(shots[j + 1].aim - shots[j].aim) * easeOut(clamp01(f / 0.8));
      if (f < SNAP) return { aim, draw: 0, on: -1, since, f };
      return { aim, draw: 0.9 * easeOut((f - SNAP) / (1 - SNAP)), on: j + 1, since, f };
    };
    t.charge({ x: c.x + Math.cos(shots[0].aim) * s * 0.15, y: c.y + Math.sin(shots[0].aim) * s * 0.15 }, s * 1.1, GOLD, 0.35, DRAW);

    // THE BOW: drawn, loosed, nocked again, the string ringing after the last.
    t.draw(END, (g, u) => {
      const time = u * END, st = state(time);
      const a = clamp01(time / (T * 0.12)) * (1 - clamp01((time - LAST - 0.08) / (END - LAST - 0.08)));
      const ring = st.since >= 0 ? s * 0.07 * Math.exp(-st.since * 20) * Math.sin(st.since * 95) : 0;
      const nock = bow(g, c, s, st.aim, st.draw, s * 0.27 * st.draw + ring, a);
      // The loose: a flare off the bow where the arrow left it, gone at once.
      if (st.since >= 0 && st.since < 0.08) {
        const fl = 1 - st.since / 0.08, x = c.x + Math.cos(st.aim) * s * 0.25, y = c.y + Math.sin(st.aim) * s * 0.25;
        g.circle(x, y, s * (0.08 + 0.1 * (1 - fl))).fill({ color: GOLD, alpha: 0.35 * fl }).circle(x, y, s * 0.04).fill({ color: WHITE, alpha: 0.8 * fl });
      }
      if (st.on < 0) return;
      // A fresh arrow condenses on the string out of the light, nocked.
      const born = st.on === 0 ? clamp01(time / (DRAW * 0.4)) : clamp01((st.f - SNAP) / 0.25), len = s * 0.6;
      const hx = nock.x + Math.cos(st.aim) * len, hy = nock.y + Math.sin(st.aim) * len;
      arrow(g, hx, hy, st.aim, len, s, a * born);
      g.circle(hx, hy, s * (0.06 + 0.06 * st.draw)).fill({ color: GOLD, alpha: 0.3 * st.draw * a });
    });

    // THE ARROWS: each off the bow on its loose, bending onto its mark and in
    // on the landing frame — a gold trail laid along the curve it flew.
    shots.forEach((sh, i) => {
      const L = loose(i), F = T - L;
      let acc = 0;
      t.draw(F, (g, u, dt) => {
        const e = u * (0.8 + 0.2 * u), p = along(sh, e), fin = clamp01(u * 8);
        const pts: number[] = [];
        for (let k = 0; k <= 10; k++) {
          const q = along(sh, Math.max(0, e - 0.4) + (Math.min(e, 0.4) * k) / 10);
          pts.push(q.x, q.y);
        }
        // The trail thins and dims toward its tail: three lengths.
        for (let k = 0; k < 3; k++) {
          const seg = pts.slice(k * 6, k * 6 + 10), w = (k + 1) / 3;
          g.poly(seg, false).stroke({ width: Math.max(2, s * 0.1 * w), color: GOLD, alpha: 0.2 * w * fin, cap: "round", join: "round" });
          g.poly(seg, false).stroke({ width: 1.3, color: GOLD_HI, alpha: 0.75 * w * fin, cap: "round", join: "round" });
        }
        arrow(g, p.x, p.y, p.a, s * 0.55, s, fin);
        acc += dt * 50 * t.quality;
        for (; acc >= 1; acc--) {
          const b = along(sh, Math.max(0, e - rand(0, 0.1)));
          t.spark(b.x, b.y, rand(-25, 25) * (s / 90), rand(-25, 25) * (s / 90), rand(0.2, 0.35), GLINT);
        }
      }, { delay: L });
      t.later(L, () => {
        for (let k = 0; k < 3; k++) {
          const a = sh.aim + rand(-1, 1), v = rand(60, 120) * (s / 90);
          t.spark(sh.p0.x, sh.p0.y, Math.cos(a) * v, Math.sin(a) * v, rand(0.2, 0.3), GLINT);
        }
      });
    });

    // THE LEAVES: stirring round him on the draw, each blown off along a
    // shot as it is loosed.
    const leaves = Array.from({ length: Math.max(3, Math.round(6 * t.quality)) }, (_, i) => ({
      th: rand(-0.4, 0.4) + (i / 6) * TAU, r: s * rand(0.48, 0.62), w: rand(1.2, 2) * (i % 2 ? 1 : -1), ph: rand(0, TAU),
      k: i % n, color: AUTUMN[i % AUTUMN.length], len: s * rand(0.22, 0.27),
    }));
    const LD = T + 0.3;
    t.draw(LD, (g, u) => {
      const time = u * LD;
      for (const l of leaves) {
        const th = l.th + l.w * time, sh = shots[l.k], go = Math.max(0, time - loose(l.k));
        const push = s * (1 - Math.exp(-go / 0.22)), ux = Math.cos(sh.aim), uy = Math.sin(sh.aim);
        const turn = Math.cos(time * 11 + l.ph), a = clamp01(time / 0.12) * (1 - clamp01(go / 0.35));
        maple(g, c.x + Math.cos(th) * l.r + ux * push, c.y + Math.sin(th) * l.r * 0.85 + uy * push, l.len,
          th + (l.w > 0 ? 1 : -1) * Math.PI / 2 + 0.5 * turn, 0.25 + 0.75 * Math.abs(turn), l.color, 0.9 * a);
      }
    });
  },

  land(t: FxTools, m: SigMoment) {
    const s = m.size;
    for (const sh of volley(m)) strike(t, sh.r, Math.atan2(sh.p2.y - sh.p1.y, sh.p2.x - sh.p1.x), sh.power, sh.killed, s);
  },
};

/** An arrow striking home along `ang`: pinned in the card and quivering, a
 *  sharp golden crit star where it went in, gold flung on along its line and
 *  the card's autumn leaves thrown up off it. A kill: a second, bigger star. */
function strike(t: FxTools, r: Box, ang: number, power: number, killed: boolean, s: number) {
  const p = centre(r), k = Math.max(0.55, Math.min(1.6, power)), f = 0.8 + 0.25 * k;
  const ux = Math.cos(ang), uy = Math.sin(ang), tip = { x: p.x + ux * s * 0.08, y: p.y + uy * s * 0.08 };
  // PINNED: the shaft left standing out of the card, ringing as it settles —
  // the point buried, a glow where it went in.
  const D = 0.85;
  t.draw(D, (g, u) => {
    const time = u * D, a = time < 0.45 ? 1 : 1 - (time - 0.45) / (D - 0.45);
    const shiver = 0.14 * Math.exp(-time * 7) * Math.sin(time * 70);
    g.circle(tip.x, tip.y, s * 0.07).fill({ color: GOLD, alpha: 0.4 * a }).circle(tip.x, tip.y, s * 0.03).fill({ color: WHITE, alpha: 0.9 * a });
    arrow(g, tip.x, tip.y, ang + shiver, s * 0.5 * f, s, a, false);
  });
  star(t, p, ang, s * 0.6 * f, s, 0);
  t.flash(p, GOLD, 0.13 * f * (s / 80));
  t.ring(r, GOLD, 0.25, 1.05 * f, 0.35, 3);
  const n = Math.round(7 * k + 3);
  for (let i = 0; i < n; i++) {
    const on = i < n * 0.7, a = (on ? ang : ang + Math.PI) + rand(-0.7, 0.7), v = rand(140, 300) * (s / 90) * (on ? 1 : 0.6);
    t.spark(tip.x, tip.y, Math.cos(a) * v, Math.sin(a) * v - rand(20, 60) * (s / 90), rand(0.2, 0.38), SPARK);
  }
  flurry(t, p, 4 + 2.5 * k, s * 0.25, 280 * (s / 90), 0.95, -Math.PI / 2, 1.5);
  if (killed)
    t.later(0.12, () => {
      star(t, p, ang + Math.PI / 4, s * 0.85 * f, s, 0);
      t.ring(r, GOLD_HI, 0.4, 1.4 * f, 0.4, 4);
      flurry(t, p, 4, s * 0.27, 320 * (s / 90), 0.95, -Math.PI / 2, 2.4);
    });
}

/** The crit star: four long points (one down the arrow's line) and four short
 *  ones between, white at the heart and gold out to the tips — struck out in
 *  an instant, drawn back in as it fades, turning a little. */
function star(t: FxTools, p: Pt, ang: number, R: number, s: number, delay: number) {
  const D = 0.38;
  const spikes = (g: Graphics, u: number, wide: number) => {
    const time = u * D, grow = easeOut(clamp01(time / 0.05)), len = R * grow * (1 - 0.55 * clamp01((time - 0.1) / 0.28));
    const rot = ang + 0.35 * u, w = s * 0.05 * wide;
    for (let i = 0; i < 8; i++) {
      const a = rot + (i * Math.PI) / 4, L = len * (i % 2 ? 0.45 : 1), ca = Math.cos(a), sa = Math.sin(a);
      g.poly([p.x - sa * w, p.y + ca * w, p.x + ca * L, p.y + sa * L, p.x + sa * w, p.y - ca * w, p.x - ca * w * 0.8, p.y - sa * w * 0.8], true);
    }
  };
  t.draw(D, (g, u) => {
    const a = 1 - clamp01((u * D - 0.12) / 0.26);
    spikes(g, u, 2.2);
    g.fill({ color: GOLD, alpha: 0.35 * a });
    spikes(g, u, 1);
    g.fill({ color: GOLD_HI, alpha: 0.95 * a });
    g.circle(p.x, p.y, s * 0.075 * (1 - 0.4 * u)).fill({ color: WHITE, alpha: a });
  }, { delay });
}
