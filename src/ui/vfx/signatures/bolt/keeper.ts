/** KEEPER — Storm Swarm. "Raise one Beebot per opponent carrying a status,
 *  then every Beebot on the board stings." The hive is the armour.
 *
 *  Keeper is a queen bee in black-and-gold plate, a gold visored helm and
 *  honeycomb-veined wings, robot bees with red eyes swarming round her; her
 *  Beebot is a yellow-and-black robot hornet with a gold lightning stinger.
 *  This is BOLT's one move that is not weather: it is a HIVE. So the DELIVERY
 *  (when it runs) is the comb waking round her: gold hex cells lighting one by
 *  one about her card, and a few guard bees circling it, buzzing.
 *
 *  The LANDING carries the whole move, because the delivery may not run. The
 *  comb flares round her; on every new Beebot's square a big hex cell glows,
 *  cracks open into six wedges and a Beebot climbs out of it. Then the SWARM:
 *  small robot bees (black bodies banded gold, a blur of wings, a red eye, a
 *  gold stinger trail) pour out of her comb and out of each fresh cell, and
 *  stream to every target in jittery zigzags, the way bees fly and lightning
 *  never does. Each bee stings, backs off, darts in and stings again: little
 *  gold stinger stars peppering the card, the target glowing honey-gold under
 *  them. With no new Beebots (`m.spawned` empty) the whole swarm comes out of
 *  her comb.
 *
 *  Old Beebots sting too, but the game cannot say which allies they are, so
 *  the stings are launched from Keeper and the new cells only. Gold and black,
 *  not violet: the comb and the bees are machines, so they move like machines
 *  and insects (a buzz, a dart), never with lightning's stutter. */
import { centre, rand } from "../../looks/base";
import type { Graphics } from "pixi.js";
import type { FxTools, Pt, SparkStyle } from "../../looks/types";
import type { Signature, SigMoment } from "../types";

type Box = SigMoment["from"];

const TAU = Math.PI * 2;
// The hive: white-hot to pale honey to gold to amber.
const WHITE = 0xffffff, PALE = 0xfff1a8, GOLD = 0xffc72e, AMBER = 0xff9a1a;
// A bee's red machine eye, and the faint violet of its wings (the Beebot's).
const RED = 0xff3a3a, WING = 0xf4ecff;
// A bee's body: dark layer only.
const CHITIN = 0x080604;
/** A sting: a gold snap, darting off and stopping. */
const STING: SparkStyle = { palette: [WHITE, PALE, GOLD, AMBER], gravity: 0, drag: 0.002, size: [4.5, 1.2], streak: true };
/** Honey-gold dust shaken off a cracking cell. */
const WAX: SparkStyle = { palette: [PALE, GOLD, AMBER], gravity: 160, drag: 0.4, size: [4, 1.5], streak: false };

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeOut = (x: number) => 1 - (1 - x) * (1 - x);
const easeInOut = (x: number) => x * x * (3 - 2 * x);
/** 0 -> 1 as `x` runs from `a` to `b`. */
const span = (x: number, a: number, b: number) => clamp01((x - a) / (b - a));
/** A zigzag, -1..1, with corners: a bee's flight jinks, it does not wave. */
const zig = (x: number) => 4 * Math.abs(x - Math.floor(x + 0.5)) - 1;

/** The landing's beats, s: the comb flares, the cells crack, the last bee
 *  is gone. */
const CRACK = 0.22, END = 1.0;

// ── The comb ────────────────────────────────────────────────────────────────

/** A pointy-topped hexagon's corners. */
function hex(c: Pt, R: number, rot = 0): number[] {
  const pts: number[] = [];
  for (let i = 0; i < 6; i++) {
    const a = rot - Math.PI / 2 + (i * TAU) / 6;
    pts.push(c.x + Math.cos(a) * R, c.y + Math.sin(a) * R);
  }
  return pts;
}

/** Her comb: a cell over her card and six round it, as packed hexes. */
function combCells(c: Pt, s: number) {
  const R = s * 0.18, d = Math.sqrt(3) * R;
  const cells = [{ p: c, lag: 0 }];
  for (let i = 0; i < 6; i++) {
    const a = (i * TAU) / 6;
    cells.push({ p: { x: c.x + Math.cos(a) * d, y: c.y + Math.sin(a) * d }, lag: rand(0.1, 1) });
  }
  return { R, cells };
}

/** The comb lit for `dur` s, each cell at `lit(time, lag)` (lag 0..1, its
 *  place in the order they wake): a gold wall, a honey glow inside. */
function comb(t: FxTools, c: Pt, s: number, dur: number, lit: (time: number, lag: number) => number) {
  const { R, cells } = combCells(c, s);
  t.draw(dur, (g, u) => {
    const time = u * dur;
    for (const cell of cells) {
      const k = lit(time, cell.lag);
      if (k <= 0.01) continue;
      // A hive light hums: a slow uneven pulse, not a stutter.
      const hum = 0.85 + 0.15 * Math.sin(time * 23 + cell.lag * 9);
      g.poly(hex(cell.p, R * 0.9), true).fill({ color: GOLD, alpha: 0.14 * k * hum });
      g.poly(hex(cell.p, R * 0.94), true).stroke({ width: 4, color: AMBER, alpha: 0.25 * k, join: "miter" });
      g.poly(hex(cell.p, R * 0.94), true).stroke({ width: 1.5, color: PALE, alpha: 0.9 * k * hum, join: "miter" });
    }
  });
}

// ── A bee ───────────────────────────────────────────────────────────────────

/** A robot bee's body, `len` long, heading `ang`: a fat abdomen and a small
 *  head, as one closed outline. */
function beeBody(x: number, y: number, ang: number, len: number): number[] {
  const ux = Math.cos(ang), uy = Math.sin(ang), nx = -uy, ny = ux, pts: number[] = [];
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * TAU, ca = Math.cos(a), sa = Math.sin(a);
    // Fatter behind the middle (the abdomen), pinched toward the head.
    const w = len * (ca < 0 ? 0.3 : 0.22);
    pts.push(x + ux * ca * len * 0.5 + nx * sa * w, y + uy * ca * len * 0.5 + ny * sa * w);
  }
  return pts;
}

/** The lit parts of a bee: a gold rim and two gold bands round its black
 *  body, a blur of wings either side (beating: `beat` flips each frame), a
 *  red eye at the front and the gold stinger behind. */
function beeLit(g: Graphics, x: number, y: number, ang: number, len: number, beat: number, a: number) {
  const ux = Math.cos(ang), uy = Math.sin(ang), nx = -uy, ny = ux;
  // Wings: two pale lobes, swept back, flickering between up and down.
  const sweep = beat ? 0.55 : 1.0, wl = len * 0.55;
  for (const side of [-1, 1]) {
    const wa = ang + Math.PI + side * sweep, bx = x + ux * len * 0.08, by = y + uy * len * 0.08;
    const tx = bx + Math.cos(wa) * wl, ty = by + Math.sin(wa) * wl;
    const mx = (bx + tx) / 2 + nx * side * len * 0.12, my = (by + ty) / 2 + ny * side * len * 0.12;
    g.poly([bx, by, mx + Math.cos(wa + side * 1.4) * len * 0.15, my + Math.sin(wa + side * 1.4) * len * 0.15, tx, ty, mx - Math.cos(wa + side * 1.4) * len * 0.1, my - Math.sin(wa + side * 1.4) * len * 0.1], true)
      .fill({ color: WING, alpha: (beat ? 0.4 : 0.22) * a });
  }
  g.poly(beeBody(x, y, ang, len), true).stroke({ width: 1.2, color: GOLD, alpha: 0.9 * a, join: "round" });
  // The bands, across the abdomen.
  for (const f of [-0.08, -0.26]) {
    const cx = x + ux * len * f, cy = y + uy * len * f, w = len * 0.27;
    g.moveTo(cx + nx * w, cy + ny * w).lineTo(cx - nx * w, cy - ny * w).stroke({ width: Math.max(1.2, len * 0.09), color: GOLD, alpha: a });
  }
  g.circle(x + ux * len * 0.38, y + uy * len * 0.38, Math.max(1, len * 0.08)).fill({ color: RED, alpha: a });
  g.moveTo(x - ux * len * 0.48, y - uy * len * 0.48).lineTo(x - ux * len * 0.72, y - uy * len * 0.72).stroke({ width: 1.3, color: PALE, alpha: a });
}

/** One bee's errand: out of `from` at `t0`, a jinking flight onto a spot on
 *  the target, a sting, a back-off and a dart to a second spot, a second
 *  sting, then off and gone. `at(time)` gives where it is and which way it
 *  heads (or null before it sets out / after it is gone). */
function errand(from: Pt, tc: Pt, s: number, t0: number) {
  const p1 = { x: tc.x + rand(-0.3, 0.3) * s, y: tc.y + rand(-0.3, 0.3) * s };
  const p2 = { x: tc.x + rand(-0.3, 0.3) * s, y: tc.y + rand(-0.3, 0.3) * s };
  const d = Math.hypot(p1.x - from.x, p1.y - from.y);
  const fly = Math.min(0.3, 0.12 + d / (s * 15)), a1 = t0 + fly, a2 = a1 + rand(0.13, 0.18), gone = Math.min(END, a2 + rand(0.15, 0.25));
  const amp = s * rand(0.12, 0.2) * (Math.random() < 0.5 ? -1 : 1), zigs = rand(2.5, 4), ph = rand(0, 1);
  const back = rand(0, TAU), off = rand(0, TAU);
  const pos = (time: number): Pt | null => {
    if (time < t0 || time > gone) return null;
    if (time <= a1) {
      // The flight: along the line, eased, jinking across it.
      const q = (time - t0) / fly, e = easeInOut(q), dx = p1.x - from.x, dy = p1.y - from.y, L = Math.hypot(dx, dy) || 1;
      const j = (amp * zig(q * zigs + ph) + s * 0.035 * zig(time * 26 + ph)) * Math.sin(Math.PI * q);
      return { x: from.x + dx * e - (dy / L) * j, y: from.y + dy * e + (dx / L) * j };
    }
    if (time <= a2) {
      // Back off from the sting, then dart in on the second spot.
      const q = (time - a1) / (a2 - a1), out = Math.sin(Math.PI * q) * s * 0.18, e = easeInOut(q);
      return { x: p1.x + (p2.x - p1.x) * e + Math.cos(back) * out, y: p1.y + (p2.y - p1.y) * e + Math.sin(back) * out };
    }
    // Off it, wheeling away.
    const q = (time - a2) / (gone - a2);
    return { x: p2.x + Math.cos(off) * s * 0.5 * easeOut(q), y: p2.y + Math.sin(off) * s * 0.5 * easeOut(q) };
  };
  const at = (time: number) => {
    const p = pos(time);
    if (!p) return null;
    const q = pos(Math.max(t0, time - 0.02)) ?? p;
    const ang = p.x === q.x && p.y === q.y ? Math.atan2(tc.y - p.y, tc.x - p.x) : Math.atan2(p.y - q.y, p.x - q.x);
    const a = clamp01((time - t0) / 0.04) * (1 - span(time, gone - 0.08, gone));
    return { x: p.x, y: p.y, ang, a };
  };
  return { at, pos, p1, p2, a1, a2 };
}

/** A sting landing at `p`: a tiny four-point gold star and a few snaps. */
function sting(t: FxTools, p: Pt, s: number, k: number, delay: number) {
  const D = 0.14, rot = rand(0, Math.PI / 2), v = s / 90;
  t.draw(D, (g, u) => {
    const a = 1 - u, R = s * 0.13 * k * (0.6 + 0.4 * easeOut(clamp01(u * 5)));
    const pts: number[] = [];
    for (let i = 0; i < 8; i++) {
      const q = rot + (i * Math.PI) / 4, rr = i % 2 ? R * 0.25 : R;
      pts.push(p.x + Math.cos(q) * rr, p.y + Math.sin(q) * rr);
    }
    g.poly(pts, true).fill({ color: PALE, alpha: 0.95 * a });
    g.circle(p.x, p.y, R * 0.45).fill({ color: GOLD, alpha: 0.4 * a });
  }, { delay });
  t.later(delay, () => {
    for (let i = 0; i < 3; i++) {
      const a = rand(0, TAU), sp = rand(90, 200) * v;
      t.spark(p.x, p.y, Math.cos(a) * sp, Math.sin(a) * sp, rand(0.08, 0.16), STING);
    }
  });
}

/** A new Beebot's cell on its square: a big hex glowing up, comb inside it,
 *  then cracking into six wedges that fall away as the Beebot climbs out. */
function hatch(t: FxTools, r: Box, s: number) {
  const c = centre(r), R = s * 0.42, rot = rand(-0.2, 0.2);
  const corners = hex(c, R, rot);
  // The cell, glowing up until it cracks.
  t.draw(CRACK, (g, u) => {
    const k = easeOut(u), hum = 0.85 + 0.15 * Math.sin(u * 40);
    g.poly(corners, true).fill({ color: GOLD, alpha: 0.22 * k * hum });
    g.poly(corners, true).stroke({ width: 5, color: AMBER, alpha: 0.3 * k, join: "miter" });
    g.poly(corners, true).stroke({ width: 2, color: PALE, alpha: 0.95 * k, join: "miter" });
    // The comb inside it, small.
    const r0 = R * 0.24, d = Math.sqrt(3) * r0;
    for (let i = 0; i < 7; i++) {
      const p = i ? { x: c.x + Math.cos(rot + (i * TAU) / 6) * d, y: c.y + Math.sin(rot + (i * TAU) / 6) * d } : c;
      g.poly(hex(p, r0 * 0.9, rot), true).stroke({ width: 1.2, color: GOLD, alpha: 0.7 * k });
    }
    g.circle(c.x, c.y, R * 0.5 * k).fill({ color: PALE, alpha: 0.35 * k * k });
  });
  // The crack: six wedges, centre to edge, flung out and turning.
  const wedges = Array.from({ length: 6 }, (_, i) => ({
    i, spin: rand(-6, 6), go: rand(0.3, 0.5) * s,
  }));
  const D = 0.4;
  t.draw(D, (g, u) => {
    const e = easeOut(u), a = 1 - span(u, 0.3, 1);
    for (const w of wedges) {
      const i0 = w.i * 2, i1 = ((w.i + 1) % 6) * 2;
      const mx = (corners[i0] + corners[i1] + c.x) / 3, my = (corners[i0 + 1] + corners[i1 + 1] + c.y) / 3;
      const da = Math.atan2(my - c.y, mx - c.x), ox = Math.cos(da) * w.go * e, oy = Math.sin(da) * w.go * e, rt = w.spin * e * 0.3;
      const pts = [c.x, c.y, corners[i0], corners[i0 + 1], corners[i1], corners[i1 + 1]];
      const out: number[] = [];
      for (let j = 0; j < 6; j += 2) {
        const px = pts[j] - mx, py = pts[j + 1] - my, cr = Math.cos(rt), sr = Math.sin(rt);
        out.push(mx + ox + (px * cr - py * sr) * 0.6, my + oy + (px * sr + py * cr) * 0.6);
      }
      g.poly(out, true).fill({ color: GOLD, alpha: 0.2 * a }).stroke({ width: 1.5, color: GOLD, alpha: 0.85 * a, join: "miter" });
    }
  }, { delay: CRACK });
  t.later(CRACK, () => {
    t.glow(r, GOLD, 0.28, 0.25, 0.9);
    t.flash(c, PALE, 0.3 * (s / 80));
    for (let i = 0; i < Math.round(8 * t.quality) + 2; i++) {
      const a = rand(0, TAU), sp = rand(80, 200) * (s / 90);
      t.spark(c.x + Math.cos(a) * R * 0.5, c.y + Math.sin(a) * R * 0.5, Math.cos(a) * sp, Math.sin(a) * sp, rand(0.3, 0.5), WAX);
    }
  });
  // The Beebot climbing out: a hornet the size of the cell, wings already
  // going, there a moment and then the card itself.
  const ang = rand(0, TAU), BD = 0.38;
  const body = (u: number) => beeBody(c.x, c.y, ang, s * 0.5 * easeOut(clamp01(u * 4)));
  const ba = (u: number) => clamp01(u * 6) * (1 - span(u, 0.5, 1));
  t.draw(BD, (g, u) => { g.poly(body(u), true).fill({ color: CHITIN, alpha: 0.75 * ba(u) }); }, { dark: true, delay: CRACK });
  let flip = 0;
  t.draw(BD, (g, u) => {
    flip ^= 1;
    beeLit(g, c.x, c.y, ang, s * 0.5 * easeOut(clamp01(u * 4)), flip, ba(u));
  }, { delay: CRACK });
}

export const KEEPER: Signature = {
  shake: 0.6,
  // She stands in her comb; the bees go.
  lunge: false,

  deliver(t: FxTools, m: SigMoment, seconds: number) {
    const c = centre(m.from), s = m.size, T = seconds;
    // The comb waking round her, cell by cell.
    comb(t, c, s, T, (time, lag) => easeOut(span(time / T, lag * 0.7, lag * 0.7 + 0.25)));
    // Guard bees circling her card, buzzing.
    const guards = Array.from({ length: 4 }, (_, i) => ({ a0: (i / 4) * TAU + rand(-0.3, 0.3), r: s * rand(0.5, 0.62), w: rand(5, 7) * (i % 2 ? 1 : -1), ph: rand(0, TAU) }));
    const where = (gd: (typeof guards)[number], time: number) => {
      const a = gd.a0 + gd.w * time, rr = gd.r * (1 + 0.12 * zig(time * 4 + gd.ph));
      return { x: c.x + Math.cos(a) * rr, y: c.y + Math.sin(a) * rr, ang: a + Math.sign(gd.w) * Math.PI / 2 };
    };
    const fade = (time: number) => clamp01(time / 0.1);
    t.draw(T, (g, u) => {
      for (const gd of guards) {
        const b = where(gd, u * T);
        g.poly(beeBody(b.x, b.y, b.ang, s * 0.14), true).fill({ color: CHITIN, alpha: 0.85 * fade(u * T) });
      }
    }, { dark: true });
    let flip = 0;
    t.draw(T, (g, u) => {
      flip ^= 1;
      for (const gd of guards) {
        const b = where(gd, u * T);
        beeLit(g, b.x, b.y, b.ang, s * 0.14, flip, fade(u * T));
      }
    });
  },

  land(t: FxTools, m: SigMoment) {
    const c = centre(m.from), s = m.size;
    // THE COMB flares round her: up fast (whether or not it woke in the
    // delivery), held while the swarm pours out, then dark.
    comb(t, c, s, 0.7, (time, lag) => (0.55 + 0.45 * easeOut(span(time, lag * 0.06, lag * 0.06 + 0.05))) * (1 - span(time, 0.45, 0.7)));
    t.glow(m.from, GOLD, 0.35, 0.45, 1.3);
    t.ring(m.from, GOLD, 0.45, 1.35, 0.35, 2.5);

    // THE NEW CELLS hatching.
    for (const r of m.spawned) hatch(t, r, s);

    // THE SWARM: bees out of her comb from the first beat, and out of each
    // fresh cell once it has cracked, a share of them for every target.
    const { R, cells } = combCells(c, s);
    const sources: Array<{ p: () => Pt; t0: number }> = [
      { p: () => { const cell = cells[Math.floor(rand(0, cells.length))]; return { x: cell.p.x + rand(-R, R) * 0.5, y: cell.p.y + rand(-R, R) * 0.5 }; }, t0: 0.05 },
      ...m.spawned.map((r) => ({ p: () => { const q = centre(r); return { x: q.x + rand(-0.15, 0.15) * s, y: q.y + rand(-0.15, 0.15) * s }; }, t0: CRACK + 0.03 })),
    ];
    const bees: ReturnType<typeof errand>[] = [];
    const len = s * 0.22;
    m.targets.forEach((r, i) => {
      const tc = centre(r), k = Math.max(0.55, Math.min(2, m.power[i] ?? 1));
      const n = Math.max(3, Math.round((8 + 5 * k) * Math.max(0.5, t.quality)));
      for (let j = 0; j < n; j++) {
        const src = sources[(j + i) % sources.length];
        const b = errand(src.p(), tc, s, src.t0 + rand(0, 0.2));
        bees.push(b);
        sting(t, b.p1, s, k, b.a1);
        sting(t, b.p2, s, k, b.a2);
      }
      // The card under the swarm: a honey-gold glow from the first sting,
      // and a ring as the stings land, sized by what it took.
      const first = Math.min(...bees.slice(-n).map((b) => b.a1));
      t.later(first, () => {
        t.glow(r, GOLD, 0.3 + 0.15 * k, 0.55, 1.05);
        t.ring(r, GOLD, 0.35, 0.9 + 0.2 * k, 0.4, 2.5);
      });
    });

    // The bees themselves: black bodies on the dark layer, and their lit
    // parts with a short gold trail behind each one.
    t.draw(END, (g, u) => {
      const time = u * END;
      for (const b of bees) {
        const p = b.at(time);
        if (p) g.poly(beeBody(p.x, p.y, p.ang, len), true).fill({ color: CHITIN, alpha: 0.9 * p.a });
      }
    }, { dark: true });
    let flip = 0;
    t.draw(END, (g, u) => {
      const time = u * END;
      flip ^= 1;
      for (const b of bees) {
        const p = b.at(time);
        if (!p) continue;
        // The stinger trail: where it was over the last few hundredths.
        let first = true;
        for (let k = 2; k >= 0; k--) {
          const q = b.pos(Math.max(0, time - k * 0.01));
          if (!q) continue;
          if (first) { g.moveTo(q.x, q.y); first = false; } else g.lineTo(q.x, q.y);
        }
        g.stroke({ width: 1.6, color: GOLD, alpha: 0.4 * p.a, cap: "round", join: "round" });
        g.circle(p.x, p.y, len * 0.75).fill({ color: GOLD, alpha: 0.12 * p.a });
        beeLit(g, p.x, p.y, p.ang, len, flip, p.a);
      }
    });
  },
};
