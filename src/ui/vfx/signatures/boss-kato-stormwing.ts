/** KATO, STORMWING — Thunderhead. "16 DMG through shields to the nearest 4
 *  opponents in range, and ELECTRIFIED for 2 rounds — then it breaks off 2
 *  slots back toward its own lines" — nothing left to armour, nothing left to
 *  catch, either.
 *
 *  The DELIVERY is the storm building. Stone wings spread from the card —
 *  slabs of rock, lit along their leading edges, lightning in their seams —
 *  and beat once; over them a thunderhead heaps up out of nothing, a dark
 *  churning tower of cloud lit from inside by the lightning moving in it.
 *  In the last stretch the leaders come down: faint forked lines stepping out
 *  of the cloud's base, one to each of the four nearest cards, feeling their
 *  way there and touching them as the delivery ends.
 *
 *  The LANDING is the strike: the four bolts, nearest first — each the whole
 *  channel lit at once, forked, stuttering hard on and off — with a
 *  thunderclap off the cloud and the field lit up for a blink. Each card hit
 *  crackles (the ELECTRIFIED) and is scorched where the bolt went in. Then the
 *  jet breaks off: cloud and wings bank away back to the square it ends on,
 *  thinning out behind as it goes.
 *
 *  Lightning is BOLT's (a white-hot core in a violet halo, re-kinked on a fast
 *  beat, never a smooth fade); the stone is BORE's (real colour on the
 *  normal-blend layer). The cloud towers up the screen — height, not "ahead" —
 *  and the bolts come down from its base to wherever the cards are. */
import { centre, rand } from "../looks/base";
import type { Graphics } from "pixi.js";
import type { FxTools, Pt, SparkStyle } from "../looks/types";
import type { Signature, SigMoment } from "./types";

type Box = { x: number; y: number; w: number; h: number };

const TAU = Math.PI * 2;
// Stone, on the normal-blend layer: real colour, as BORE draws it.
const ROCK = 0x8a7461, ROCK_HI = 0xcfb592, EDGE = 0x241a13;
/** Storm cloud, and a scorch — only ever on the dark layer. */
const CLOUD = 0x171a2a, SCORCH = 0x0a0810;
const WHITE = 0xffffff, LAV = 0xe3d8ff, VIO = 0x9575ff;

/** Static: darts out hard and stops dead. */
const SNAP: SparkStyle = { palette: [WHITE, LAV, VIO], gravity: 0, drag: 0.001, size: [6, 1.5], streak: true };
/** Grit blown off a scorched card: small, heavy, falling. */
const GRIT: SparkStyle = { palette: [0xfff1dc, 0xe8cfa8, 0xd9b48a, 0xa1887f], gravity: 950, drag: 0.6, size: [5, 2], streak: false };

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeOut = (x: number) => 1 - (1 - x) * (1 - x);
/** 0 -> 1 as `u` runs from `a` to `b`. */
const span = (u: number, a: number, b: number) => clamp01((u - a) / (b - a));
/** One flicker beat, s — lightning changes on this clock, not the frame's. */
const BEAT = 0.035;
/** A strike's brightness beat by beat: re-strokes, not a fade. */
const FLICKER = [1, 0.3, 1, 0.8, 0.25, 0.95, 0.5, 0.15, 0.7, 0.35, 0.1, 0.5];

/** The cards it fires on, nearest first (the engine picks the nearest four). */
function aims(m: SigMoment) {
  const c0 = centre(m.from);
  return m.targets.map((r, i) => ({ r, i, p: centre(r) }))
    .sort((a, b) => Math.hypot(a.p.x - c0.x, a.p.y - c0.y) - Math.hypot(b.p.x - c0.x, b.p.y - c0.y));
}

/** The thunderhead's size. It heaps up along `up` — AWAY from what it fires
 *  on (the reverse of `ahead`), so the cloud never sits over the cards it is
 *  striking; for the boss, facing down the board, that is up the screen. */
const cloudW = (s: number) => s * 2.3, cloudH = (s: number) => s * 1.3;
/** Where its base hangs: just past the card's middle, on the cloud's side. */
const baseOf = (c: Pt, s: number, up: Pt): Pt => ({ x: c.x + up.x * s * 0.22, y: c.y + up.y * s * 0.22 });
/** Where a bolt leaves the cloud for a card at `p`: on its base, toward it. */
function boltRoot(base: Pt, p: Pt, s: number, up: Pt): Pt {
  const W = cloudW(s), ax = -up.y, ay = up.x;
  const off = Math.max(-W * 0.36, Math.min(W * 0.36, ((p.x - base.x) * ax + (p.y - base.y) * ay) * 0.5));
  return { x: base.x + ax * off - up.x * s * 0.06, y: base.y + ay * off - up.y * s * 0.06 };
}

// ── Lightning ───────────────────────────────────────────────────────────────

/** A channel from a to b, kinked by up to `jag` px mid-way, pinned at both
 *  ends. */
function channel(ax: number, ay: number, bx: number, by: number, segs: number, jag: number): number[] {
  const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len, out = [ax, ay];
  let off = 0;
  for (let i = 1; i < segs; i++) {
    off = off * 0.5 + rand(-1, 1);
    const f = (i + rand(-0.3, 0.3)) / segs, o = off * jag * Math.sqrt(Math.sin(Math.PI * Math.min(1, Math.max(0, f))));
    out.push(ax + dx * f + nx * o, ay + dy * f + ny * o);
  }
  out.push(bx, by);
  return out;
}

/** `base` re-kinked slightly: the same channel, crackling. */
function shaken(base: number[], amp: number): number[] {
  return base.map((v, i) => (i < 2 || i >= base.length - 2 ? v : v + rand(-amp, amp)));
}

/** Traces the first `f` of `p` (by vertex). Traced, never handed to `poly`. */
function trace(g: Graphics, p: number[], f = 1) {
  const n = p.length / 2, upto = Math.max(1, Math.floor(f * (n - 1)));
  g.moveTo(p[0], p[1]);
  for (let i = 1; i <= upto && i < n; i++) g.lineTo(p[2 * i], p[2 * i + 1]);
}

/** Lightning stroked: a violet halo under a white-hot core. */
function lightning(g: Graphics, paths: number[][], width: number, alpha: number, f = 1) {
  if (alpha <= 0.02 || !paths.length) return;
  for (const p of paths) trace(g, p, f);
  g.stroke({ width: width * 4, color: VIO, alpha: 0.3 * Math.min(1, alpha), join: "round", cap: "round" });
  for (const p of paths) trace(g, p, f);
  g.stroke({ width, color: WHITE, alpha: Math.min(1, alpha), join: "bevel", cap: "round" });
}

// ── The thunderhead ─────────────────────────────────────────────────────────

/** The cloud's puffs: (across, up, radius) in units of its width / height /
 *  width — a flat base, a heaped body, a tower. */
const PUFFS = [
  -0.42, 0, 0.13, -0.22, 0.02, 0.15, 0, 0.03, 0.16, 0.22, 0.02, 0.15, 0.42, 0, 0.13,
  -0.3, -0.3, 0.16, -0.08, -0.34, 0.18, 0.14, -0.32, 0.17, 0.34, -0.26, 0.14,
  -0.14, -0.62, 0.15, 0.08, -0.66, 0.16, 0, -0.9, 0.13,
];

/** Each puff of the cloud on `base`, heaped along `up`, grown to `grow`,
 *  churning with `time`. */
function puffs(base: Pt, s: number, grow: number, time: number, up: Pt): number[] {
  const W = cloudW(s) * grow, H = cloudH(s) * grow, ax = -up.y, ay = up.x, out: number[] = [];
  for (let i = 0; i < PUFFS.length; i += 3) {
    const j = i / 3, across = PUFFS[i] * W + Math.sin(time * 2.3 + j) * s * 0.03, rise = -PUFFS[i + 1] * H;
    out.push(base.x + ax * across + up.x * rise, base.y + ay * across + up.y * rise, PUFFS[i + 2] * W * (1 + 0.07 * Math.sin(time * 3.1 + j * 1.7)));
  }
  return out;
}

/** The cloud's silhouette: the outline of its heaped puffs, found ray by ray
 *  out from its middle (the farthest puff edge along each), so it fills and
 *  rims as ONE mass — drawn puff by puff it read as a heap of bubbles. */
function outline(pf: number[]): number[] {
  let cx = 0, cy = 0;
  const n = pf.length / 3;
  for (let i = 0; i < pf.length; i += 3) { cx += pf[i] / n; cy += pf[i + 1] / n; }
  const out: number[] = [];
  let last = 0;
  for (let k = 0; k < 48; k++) {
    const a = (k / 48) * TAU, dx = Math.cos(a), dy = Math.sin(a);
    let far = 0;
    for (let i = 0; i < pf.length; i += 3) {
      const ox = pf[i] - cx, oy = pf[i + 1] - cy, along = ox * dx + oy * dy, off2 = ox * ox + oy * oy - along * along, R = pf[i + 2];
      if (off2 <= R * R) far = Math.max(far, along + Math.sqrt(R * R - off2));
    }
    last = far > 0 ? far : last;
    out.push(cx + dx * last, cy + dy * last);
  }
  return out;
}

/** The cloud's dark: its one heaped mass. */
function cloudDark(g: Graphics, pf: number[], a: number) {
  if (a > 0.01) g.poly(outline(pf)).fill({ color: CLOUD, alpha: 0.88 * a });
}

/** The cloud's light: a faint storm-grey body so it reads over an empty
 *  square, a cool rim round it, and the lightning moving inside — a few
 *  puffs lit from within, changing every beat. */
function cloudLight(g: Graphics, pf: number[], a: number, lit: number[]) {
  if (a <= 0.01) return;
  g.poly(outline(pf)).fill({ color: 0x2c3150, alpha: 0.45 * a }).stroke({ width: 1.8, color: LAV, alpha: 0.5 * a, join: "round" });
  for (const j of lit) g.circle(pf[3 * j], pf[3 * j + 1], pf[3 * j + 2] * 0.75).fill({ color: LAV, alpha: 0.22 * a });
}

/** A stone wing, root to tip along +x (mirrored for `side` -1), leading
 *  edge up: slabs of rock stepping back along its trailing edge. */
const WING = [0, 0.08, 0.35, 0.18, 0.7, 0.14, 1, -0.02, 0.86, -0.12, 0.78, -0.06, 0.62, -0.18, 0.52, -0.1, 0.36, -0.2, 0.22, -0.1, 0, -0.08];

function wingPts(root: Pt, ang: number, len: number, side: number): number[] {
  const ux = Math.cos(ang) * side, uy = Math.sin(ang), out: number[] = [];
  // "Up" for a wing is up the screen, turned with it.
  const nx = uy * side, ny = -Math.cos(ang);
  for (let i = 0; i < WING.length; i += 2) out.push(root.x + (ux * WING[i] + nx * WING[i + 1]) * len, root.y + (uy * WING[i] + ny * WING[i + 1]) * len);
  return out;
}

/** A pair of stone wings off the card at `c`: body, a lit leading edge, a
 *  dark edge. `ang` spreads them (0 flat out, negative raised); `bank` tips
 *  one up and one down as it turns. */
function wingsStone(g: Graphics, c: Pt, s: number, ang: number, bank: number, scale: number, a: number) {
  if (a <= 0.01) return;
  for (const side of [1, -1]) {
    const pts = wingPts({ x: c.x + side * s * 0.18, y: c.y }, ang + side * bank, s * 1.25 * scale, side);
    g.poly(pts).fill({ color: ROCK, alpha: a });
    g.moveTo(pts[0], pts[1]).lineTo(pts[2], pts[3]).lineTo(pts[4], pts[5]).lineTo(pts[6], pts[7])
      .stroke({ width: 3, color: ROCK_HI, alpha: 0.85 * a, cap: "round", join: "round" });
    g.poly(pts).stroke({ width: 1.6, color: EDGE, alpha: a, join: "round" });
  }
}

/** The storm in its wings: lightning down each one's seam. */
function wingVeins(c: Pt, s: number, ang: number, bank: number, scale: number): number[][] {
  return [1, -1].map((side) => {
    const pts = wingPts({ x: c.x + side * s * 0.18, y: c.y }, ang + side * bank, s * 1.25 * scale, side);
    return channel(pts[0], pts[1], pts[6], pts[7], 5, s * 0.06);
  });
}

// ── A strike ────────────────────────────────────────────────────────────────

/** A bolt from the cloud at `a` onto the card at `b`: the whole channel lit
 *  at once with its forks, stuttering hard for a few beats and leaving a
 *  violet afterglow; the card scorched where it went in, crackling, grit
 *  and static thrown off it. */
function strike(t: FxTools, a: Pt, r: Box, s: number, power: number) {
  const b = centre(r), k = s / 90, kk = Math.max(0.8, Math.min(1.8, power));
  const dist = Math.hypot(b.x - a.x, b.y - a.y), segs = Math.max(6, Math.min(14, Math.round(dist / 22)));
  const base = channel(a.x, a.y, b.x, b.y, segs, Math.min(s * 0.35, dist * 0.08));
  const forks: number[][] = [];
  for (let i = 0; i < 3; i++) {
    const v = 1 + Math.floor(rand(0.15, 0.75) * (segs - 1)), x = base[2 * v], y = base[2 * v + 1];
    const d = Math.atan2(b.y - a.y, b.x - a.x) + (i % 2 ? 1 : -1) * rand(0.4, 0.9), l = dist * rand(0.12, 0.22);
    forks.push(channel(x, y, x + Math.cos(d) * l, y + Math.sin(d) * l, 3, l * 0.2));
  }
  const D = 0.42;
  let beat = -1, main = base, fk = forks;
  t.draw(D, (g, u) => {
    const time = u * D, bt = Math.floor(time / BEAT);
    if (bt !== beat) {
      beat = bt;
      main = shaken(base, 2);
      fk = forks.map((f) => shaken(f, 1.5));
    }
    // The afterglow first, under it: what the eye keeps of the channel.
    const ag = 1 - u;
    trace(g, base);
    g.stroke({ width: 6 * kk, color: VIO, alpha: 0.3 * ag * ag, join: "round", cap: "round" });
    const lit = FLICKER[bt % FLICKER.length] * Math.sqrt(1 - Math.min(1, time / 0.34));
    lightning(g, [main], 3 * kk, lit);
    lightning(g, fk, 1.4 * kk, lit * 0.85);
  });
  t.flash(b, LAV, 0.9 * kk);
  t.arcs(b, [WHITE, LAV, VIO], 0.55 * kk, 6);
  t.ring(r, LAV, 0.35, 1.3 * kk, 0.35, 3);
  // The scorch where it went in: dark, rimmed where it still glows.
  const seed = rand(0, TAU), rr = s * 0.24 * Math.min(1.3, kk);
  t.draw(0.8, (g, u) => {
    g.circle(b.x, b.y, rr * 0.6);
    for (let i = 0; i < 5; i++) g.circle(b.x + Math.cos(seed + i * 1.3) * rr * 0.4, b.y + Math.sin(seed + i * 1.3) * rr * 0.4, rr * 0.4);
    g.fill({ color: SCORCH, alpha: 0.55 * (1 - span(u, 0.4, 1)) });
  }, { dark: true });
  t.draw(0.8, (g, u) => {
    g.circle(b.x, b.y, s * 0.26 * Math.min(1.3, kk)).stroke({ width: 1.5, color: VIO, alpha: 0.7 * (1 - span(u, 0.3, 1)) });
  });
  for (let i = 0; i < Math.round(10 * kk * t.quality); i++) {
    const ang = rand(0, TAU), v = rand(220, 420) * k;
    t.spark(b.x, b.y, Math.cos(ang) * v, Math.sin(ang) * v, rand(0.1, 0.22), SNAP);
  }
  t.emit({ count: Math.round(6 * kk), palette: GRIT.palette, from: { x: b.x - s * 0.2, y: b.y - s * 0.05, w: s * 0.4, h: s * 0.1 },
    dir: [-150, -30], speed: [80, 200], gravity: 950, drag: 0.6, life: [0.3, 0.5], size: [5, 2] });
}

export const KATO_STORMWING: Signature = {
  shake: 1.9,
  // It never closes to melee: it fires from above and breaks off.
  lunge: false,

  deliver(t: FxTools, m, seconds) {
    const T = seconds, s = m.size, c0 = centre(m.from), up = { x: -m.ahead.x, y: -m.ahead.y }, base = baseOf(c0, s, up), list = aims(m).slice(0, 4);
    const LEAD = 0.62; // the leaders step down from here

    // THE WINGS: stone spreading off the card, beating once, held spread.
    const pose = (u: number) => {
      const spread = easeOut(span(u, 0, 0.25)), beat = span(u, 0.25, 0.38), settle = span(u, 0.38, 0.55);
      return { ang: -0.35 * spread + 0.6 * beat * beat - 0.25 * settle, scale: 0.4 + 0.6 * spread };
    };
    t.draw(T, (g, u) => { const w = pose(u); wingsStone(g, c0, s, w.ang, 0, w.scale, Math.min(1, u * 6)); }, { dark: true });
    // THE THUNDERHEAD heaping up over it, churning, lit from inside.
    const grow = (u: number) => 0.3 + 0.7 * easeOut(span(u, 0.05, 0.6));
    t.draw(T, (g, u) => cloudDark(g, puffs(base, s, grow(u), u * T, up), Math.min(1, u * 5)), { dark: true });
    let beat = -1, lit: number[] = [], veins: number[][] = [];
    t.draw(T, (g, u) => {
      const time = u * T, b = Math.floor(time / BEAT), w = pose(u);
      if (b !== beat) {
        beat = b;
        lit = [];
        for (let j = 0; j < PUFFS.length / 3; j++) if (Math.random() < 0.18 + 0.2 * u) lit.push(j);
        veins = wingVeins(c0, s, w.ang, 0, w.scale);
      }
      cloudLight(g, puffs(base, s, grow(u), time, up), Math.min(1, u * 5), lit);
      lightning(g, veins, 1.2, 0.8 * Math.min(1, u * 6) * rand(0.5, 1));
    });

    // THE LEADERS: faint forked lines stepping down out of the cloud's base,
    // one to each card, touching them as the delivery ends.
    list.forEach((a, n) => {
      const root = boltRoot(base, a.p, s, up), dist = Math.hypot(a.p.x - root.x, a.p.y - root.y);
      const segs = Math.max(6, Math.min(14, Math.round(dist / 22))), path = channel(root.x, root.y, a.p.x, a.p.y, segs, Math.min(s * 0.35, dist * 0.08));
      const D = T * (1 - LEAD), lag = n * 0.06;
      let bt = -1, twig: number[] = [];
      t.draw(D, (g, u) => {
        const f = clamp01((u - lag) / (1 - lag));
        if (f <= 0) return;
        const upto = Math.max(1, Math.floor(f * segs)), b = Math.floor((u * D) / BEAT);
        if (b !== bt) {
          bt = b;
          const x = path[2 * upto], y = path[2 * upto + 1], d = Math.atan2(a.p.y - y, a.p.x - x) + rand(-1.2, 1.2), l = rand(6, 14);
          twig = channel(x, y, x + Math.cos(d) * l, y + Math.sin(d) * l, 2, 3);
        }
        const la = 0.5 * rand(0.6, 1);
        lightning(g, [path], 1.2, la, upto / segs);
        lightning(g, [twig], 1, la * 0.8);
        g.circle(path[2 * upto], path[2 * upto + 1], 2.4).fill({ color: WHITE, alpha: Math.min(1, la * 2) });
      }, { delay: T * LEAD });
    });
  },

  land(t: FxTools, m) {
    const s = m.size, c0 = centre(m.from), cTo = centre(m.to), up = { x: -m.ahead.x, y: -m.ahead.y }, base = baseOf(c0, s, up), list = aims(m);

    // THE STRIKE: every bolt, nearest first, a thunderclap off the cloud and
    // the field lit up for a blink.
    list.forEach((a, n) => {
      if (n === 0) strike(t, boltRoot(base, a.p, s, up), a.r, s, m.power[a.i] ?? 1);
      else t.later(n * 0.05, () => strike(t, boltRoot(base, a.p, s, up), a.r, s, m.power[a.i] ?? 1));
    });
    if (list.length) {
      // The field lit up for a blink — soft, and gone fast: the cards under it
      // are what the player is reading.
      t.glow(m.board, LAV, 0.16, 0.2, 1.1);
      t.draw(0.5, (g, u) => {
        const e = easeOut(u);
        g.circle(base.x + up.x * s * 0.4, base.y + up.y * s * 0.4, s * (1 + 2.2 * e)).stroke({ width: 5 * (1 - u) + 1, color: LAV, alpha: 0.6 * (1 - u) });
      });
    }

    // THE BREAK: cloud and wings bank away to the square it ends on, thinning
    // behind it as it goes — or, held where it is, the storm simply spends
    // itself there.
    const away = Math.hypot(cTo.x - c0.x, cTo.y - c0.y) > s * 0.3;
    const side = cTo.x >= c0.x ? 1 : -1;
    const ctl = { x: (c0.x + cTo.x) / 2 + side * s * 0.9, y: (c0.y + cTo.y) / 2 };
    const where = (f: number): Pt => {
      if (!away) return c0;
      const q = 1 - f;
      return { x: q * q * c0.x + 2 * q * f * ctl.x + f * f * cTo.x, y: q * q * c0.y + 2 * q * f * ctl.y + f * f * cTo.y };
    };
    const D = 0.95, GO = 0.25;
    const state = (u: number) => {
      const time = u * D, f = easeOut(span(time, GO, D - 0.1)), c = where(f);
      return { time, f, c, a: 1 - span(time, GO + 0.2, D), bank: away ? side * 0.5 * Math.sin(Math.PI * f) : 0 };
    };
    t.draw(D, (g, u) => {
      const st = state(u);
      cloudDark(g, puffs(baseOf(st.c, s, up), s, 1 - 0.45 * st.f, st.time, up), st.a);
      wingsStone(g, st.c, s, -0.25 - 0.2 * st.f, st.bank, 1 - 0.3 * st.f, st.a);
      // The cloud it leaves behind, thinning where it was.
      if (away && st.f > 0) {
        const tail = where(Math.max(0, st.f - 0.35));
        g.circle(tail.x, tail.y - s * 0.3, s * 0.45 * (1 - st.f)).fill({ color: CLOUD, alpha: 0.4 * st.a });
      }
    }, { dark: true });
    let beat = -1, lit: number[] = [], veins: number[][] = [];
    t.draw(D, (g, u) => {
      const st = state(u), b = Math.floor(st.time / BEAT);
      if (b !== beat) {
        beat = b;
        lit = [];
        for (let j = 0; j < PUFFS.length / 3; j++) if (Math.random() < 0.3 * (1 - st.f)) lit.push(j);
        veins = wingVeins(st.c, s, -0.25 - 0.2 * st.f, st.bank, 1 - 0.3 * st.f);
      }
      cloudLight(g, puffs(baseOf(st.c, s, up), s, 1 - 0.45 * st.f, st.time, up), st.a, lit);
      lightning(g, veins, 1.1, 0.7 * st.a * rand(0.5, 1));
    });
  },
};
