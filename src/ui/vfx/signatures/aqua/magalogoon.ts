/** MAGALOGOON — Bog Ambush. "Drag an opponent from anywhere on the board into
 *  this row (never onto its home row), deal 10 DMG, and root them for 3
 *  rounds." It drags one foe out of its row, hits it for ten, and roots it in
 *  the bog.
 *
 *  Its art is a monstrous swamp crocodile, murky green and black, moss on its
 *  hide, jaws gaping red with long yellowed teeth, half sunk in fetid water
 *  under a wrecked ship, lit by a sickly teal glow. The DELIVERY is the
 *  ambush: the bog spreads dark round its square, bubbling, and a channel of
 *  swamp water snakes out of it across the board to the target — black water,
 *  a slimy green rim, scum and bubbles along it — and at its head the
 *  crocodile's maw lunges up out of the water round the card, jaws gaping, and
 *  clamps shut on it as the delivery ends.
 *
 *  The LANDING is the drag. Jaws locked, the crocodile hauls the card back
 *  through a churned wake of mud to its own row (the target's column, the
 *  crocodile's row — where the token lands), then bites down again there: a
 *  hard snap, two rows of tooth punctures across the card, murky spray. Then it
 *  sinks back and the bog takes the card — a pool of mud under it, weed rising
 *  and swaying round it (the ROOT), mud bubbling up and popping.
 *
 *  The crocodile and the bog are SOLID — murky green hide, blood-red gullet,
 *  yellowed teeth, black water, on the normal-blend layer — each edged in
 *  the art's moss-green and teal glow so it reads over an empty square. It
 *  draws its own reach across the board, so it does not lunge. */
import { centre, rand } from "../../looks/base";
import type { Graphics } from "pixi.js";
import type { FxTools, Pt, SparkStyle } from "../../looks/types";
import type { Signature, SigMoment } from "../types";

const TAU = Math.PI * 2;
// Solid (normal blend): the hide, its dark edge, the gullet, the teeth; bog
// water, mud, weed.
const HIDE = 0x34461f, HIDE_DARK = 0x0b1206, GULLET = 0x6a1712, TOOTH = 0xe6dcb4, BOG = 0x0a1208, MUD = 0x1a130a, WEED = 0x1f3a12;
// Light (additive): the moss along its hide, the art's sickly teal glow, the
// eye, scum.
const MOSS = 0x8fc04a, TEAL = 0x6fe0b8, EYE = 0xd8ff5a, SCUM = 0xb8d070, PALE = 0xe0f5c8;
/** Murky water and mud flung off a bite or a drag: heavy, falling. */
const MUCK: SparkStyle = { palette: [PALE, SCUM, 0x6f8a3a, 0x3a3018], gravity: 950, drag: 0.55, size: [6, 2.5], streak: false };
/** Slime dripping off the jaws. */
const SLIME: SparkStyle = { palette: [PALE, MOSS, 0x4f7a22], gravity: 650, drag: 0.6, size: [5, 2], streak: false };

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeOut = (x: number) => 1 - (1 - x) * (1 - x);

// ── Paths ────────────────────────────────────────────────────────────────────

/** A channel's course from `a` to `b`, snaking: flat points. */
function course(a: Pt, b: Pt, s: number, wiggle: number): number[] {
  const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d;
  const amp = Math.min(s * 0.35, d * wiggle) * (Math.random() < 0.5 ? -1 : 1), waves = rand(1.6, 2.4), ph = rand(0, TAU), pts: number[] = [];
  for (let i = 0; i <= 24; i++) {
    const f = i / 24, off = amp * Math.sin(Math.PI * f) * Math.sin(Math.PI * f * waves + ph);
    pts.push(a.x + dx * f - uy * off, a.y + dy * f + ux * off);
  }
  return pts;
}

/** The point `f` (0..1) of the way along a sampled path, and its heading. */
function at(pts: number[], f: number) {
  const n = pts.length / 2 - 1, i = Math.max(0, Math.min(n - 1e-6, f * n)), j = Math.floor(i), r = i - j;
  const x0 = pts[2 * j], y0 = pts[2 * j + 1], x1 = pts[2 * j + 2], y1 = pts[2 * j + 3];
  return { x: x0 + (x1 - x0) * r, y: y0 + (y1 - y0) * r, a: Math.atan2(y1 - y0, x1 - x0) };
}

/** A ribbon of water along a path from `f0` to `f1`, `w` wide, tapering at
 *  its tail: its outline, and its two banks. */
function ribbon(pts: number[], f0: number, f1: number, w: number) {
  const left: number[] = [], right: number[] = [], N = 16;
  for (let i = 0; i <= N; i++) {
    const f = f0 + ((f1 - f0) * i) / N, p = at(pts, f), hw = (w / 2) * (0.45 + 0.55 * Math.sin(Math.PI * Math.min(1, (i / N) * 1.6 + 0.08)) ** 0.5);
    const nx = -Math.sin(p.a), ny = Math.cos(p.a);
    left.push(p.x + nx * hw, p.y + ny * hw);
    right.push(p.x - nx * hw, p.y - ny * hw);
  }
  const rev: number[] = [];
  for (let k = right.length - 2; k >= 0; k -= 2) rev.push(right[k], right[k + 1]);
  return { body: left.concat(rev), left, right };
}

// ── The crocodile ────────────────────────────────────────────────────────────

/** The crocodile's maw, from its hinge `h` along `ang`, `J` long, each jaw
 *  `open` radians off the line: the two long jaws — broad at the hinge,
 *  tapering to the snout, a knob at the end for the nostrils — the red of the
 *  gullet between them while it gapes, a row of teeth along each rim pointing
 *  across at the other (they show over the other jaw when it shuts, as a
 *  crocodile's do), and behind the hinge its flat head, the eyes raised on
 *  top, a ridge of scutes running back down its neck into the water. */
function maw(h: Pt, ang: number, J: number, open: number) {
  const jaws = [-1, 1].map((side) => {
    const a = ang + side * open, dx = Math.cos(a), dy = Math.sin(a), nx = -dy * side, ny = dx * side;
    const rim: number[] = [], back: number[] = [], teeth: number[][] = [];
    for (let k = 0; k <= 12; k++) {
      const v = k / 12, x = h.x + dx * J * v, y = h.y + dy * J * v;
      const bulge = J * (0.22 * (1 - 0.72 * v) + 0.045 * Math.exp(-(((v - 0.9) / 0.07) ** 2))) * Math.min(1, (1 - v) * 12 + 0.25);
      rim.push(x, y);
      back.push(x + nx * bulge, y + ny * bulge);
    }
    for (let k = 0; k < 9; k++) {
      const v = 0.12 + (k + (side > 0 ? 0.5 : 0)) * 0.09, x = h.x + dx * J * v, y = h.y + dy * J * v;
      const len = J * (k === 1 || k === 5 ? 0.12 : 0.075), w = J * 0.02;
      teeth.push([x - dx * w, y - dy * w, x - nx * len + dx * len * 0.2, y - ny * len + dy * len * 0.2, x + dx * w, y + dy * w]);
    }
    const rev: number[] = [];
    for (let k = back.length - 2; k >= 0; k -= 2) rev.push(back[k], back[k + 1]);
    return { body: rim.concat(rev), rim, back, teeth };
  });
  const dx = Math.cos(ang), dy = Math.sin(ang), nx = -dy, ny = dx;
  const L = (lx: number, ly: number): Pt => ({ x: h.x + (dx * lx + nx * ly) * J, y: h.y + (dy * lx + ny * ly) * J });
  const outline: Array<[number, number]> = [[0.02, 0.23], [-0.08, 0.26], [-0.13, 0.31], [-0.2, 0.31], [-0.26, 0.26], [-0.45, 0.24], [-0.75, 0.2], [-1.05, 0.15]];
  const skull: number[] = [];
  for (const [x, y] of outline) {
    const p = L(x, y);
    skull.push(p.x, p.y);
  }
  for (let i = outline.length - 1; i >= 0; i--) {
    const p = L(outline[i][0], -outline[i][1]);
    skull.push(p.x, p.y);
  }
  const eyes = [-1, 1].map((sd) => L(-0.165, sd * 0.24));
  const scutes = [0, 1, 2, 3, 4, 5].flatMap((i) => [-1, 1].map((sd) => L(-0.36 - 0.12 * i, sd * 0.075)));
  // The gullet: the gape between the jaws' rims while they are apart.
  const r1 = jaws[1].rim, gape = jaws[0].rim.slice();
  for (let k = r1.length - 2; k >= 0; k -= 2) gape.push(r1[k], r1[k + 1]);
  return { jaws, skull, eyes, scutes, gape };
}

/** The maw's solid half: head and neck, gape, jaws, teeth. */
function mawSolid(g: Graphics, q: ReturnType<typeof maw>, open: number, a: number) {
  if (a <= 0.02) return;
  g.poly(q.skull, true).fill({ color: HIDE, alpha: a }).stroke({ width: 1.3, color: HIDE_DARK, alpha: 0.9 * a });
  if (open > 0.04) g.poly(q.gape, true).fill({ color: GULLET, alpha: a * clamp01(open / 0.2) });
  for (const j of q.jaws) g.poly(j.body, true).fill({ color: HIDE, alpha: a }).stroke({ width: 1.3, color: HIDE_DARK, alpha: 0.9 * a });
  for (const j of q.jaws) for (const t of j.teeth) g.poly(t, true).fill({ color: TOOTH, alpha: a });
}

/** ...and its light: moss along the jaws' backs and the head's edge, the
 *  teal glow on the art, a pale line along each rim, the scutes catching the
 *  light, and two sickly glowing eyes with slit pupils. */
function mawLight(g: Graphics, q: ReturnType<typeof maw>, J: number, a: number) {
  if (a <= 0.02) return;
  for (const j of q.jaws) {
    g.poly(j.back, false).stroke({ width: Math.max(3, J * 0.08), color: TEAL, alpha: 0.18 * a, cap: "round", join: "round" });
    g.poly(j.back, false).stroke({ width: 1.4, color: MOSS, alpha: 0.85 * a, cap: "round", join: "round" });
    g.poly(j.rim, false).stroke({ width: 1, color: PALE, alpha: 0.3 * a });
  }
  g.poly(q.skull, true).stroke({ width: 1.3, color: MOSS, alpha: 0.6 * a });
  for (const sc of q.scutes) g.circle(sc.x, sc.y, J * 0.025).fill({ color: MOSS, alpha: 0.55 * a });
  for (const e of q.eyes) {
    g.circle(e.x, e.y, J * 0.06).fill({ color: EYE, alpha: 0.3 * a }).circle(e.x, e.y, J * 0.035).fill({ color: EYE, alpha: a });
    g.ellipse(e.x, e.y, J * 0.008 + 0.6, J * 0.03).fill({ color: 0x1a2a00, alpha: a });
  }
}

/** Bubbles welling up in bog water and popping. */
interface Bub { x: number; y: number; at: number; r: number; life: number }

function bubbles(g: Graphics, list: Bub[], now: number, alpha: number) {
  for (const b of list) {
    const q = (now - b.at) / b.life;
    if (q < 0 || q >= 1) continue;
    const pop = q > 0.8 ? (q - 0.8) / 0.2 : 0, r = b.r * (0.4 + 0.6 * Math.min(1, q * 3)) * (1 + 0.6 * pop);
    g.circle(b.x, b.y, r).stroke({ width: 1.3, color: pop > 0 ? PALE : SCUM, alpha: 0.85 * (1 - pop) * alpha });
    if (pop === 0) g.circle(b.x - r * 0.35, b.y - r * 0.35, Math.max(0.8, r * 0.25)).fill({ color: PALE, alpha: 0.8 * alpha });
  }
}

/** Where the dragged card ends: in its own column, the crocodile's row. */
const draggedTo = (m: SigMoment, p: Pt): Pt => ({ x: p.x, y: centre(m.from).y });

export const MAGALOGOON: Signature = {
  shake: 1.4,
  // It reaches across the board through its own channel; it never leaves its
  // square.
  lunge: false,

  deliver(t: FxTools, m: SigMoment, seconds: number) {
    const s = m.size, T = seconds, c = centre(m.from), sc = s / 90;
    const prey = m.targets.length ? centre(m.targets[0]) : { x: c.x + m.ahead.x * s * 2, y: c.y + m.ahead.y * s * 2 };
    const dx = prey.x - c.x, dy = prey.y - c.y, d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d;
    // The channel runs from its square's edge to just short of the card,
    // where the maw comes up.
    const start = { x: c.x + ux * s * 0.3, y: c.y + uy * s * 0.3 }, end = { x: prey.x - ux * s * 0.45, y: prey.y - uy * s * 0.45 };
    const path = course(start, end, s, 0.14);
    const GO = T * 0.15, RUN = T * 0.55, head = (time: number) => easeOut(clamp01((time - GO) / RUN));
    const D = T + 0.35, gone = (time: number) => 1 - clamp01((time - T) / 0.35);
    // THE BOG spreads round its square: black water, a slimy rim.
    const pool = (g: Graphics, time: number) => {
      const r = s * (0.3 + 0.32 * easeOut(clamp01(time / (T * 0.4)))), pts: number[] = [];
      for (let i = 0; i < 20; i++) {
        const a = (i / 20) * TAU, rr = r * (1 + 0.08 * Math.sin(3 * a + time * 4) + 0.05 * Math.sin(5 * a - time * 6));
        pts.push(c.x + Math.cos(a) * rr, c.y + Math.sin(a) * rr * 0.75);
      }
      return g.poly(pts, true);
    };
    t.draw(D, (g, u) => {
      const time = u * D, a = gone(time);
      pool(g, time).fill({ color: BOG, alpha: 0.7 * a });
      const e = head(time);
      if (e > 0.01) g.poly(ribbon(path, 0, e, s * 0.34).body, true).fill({ color: BOG, alpha: 0.85 * a });
    }, { dark: true });
    const bub: Bub[] = [];
    let acc = 0;
    t.draw(D, (g, u, dt) => {
      const time = u * D, a = gone(time), e = head(time);
      pool(g, time).stroke({ width: 1.6, color: MOSS, alpha: 0.75 * a });
      if (e > 0.01) {
        const rb = ribbon(path, 0, e, s * 0.34);
        g.poly(rb.left, false).stroke({ width: 1.5, color: MOSS, alpha: 0.8 * a });
        g.poly(rb.right, false).stroke({ width: 1.5, color: MOSS, alpha: 0.8 * a });
        g.poly(rb.body, true).fill({ color: TEAL, alpha: 0.05 * a });
        // Scum: short pale streaks drifting on it.
        for (let k = 0; k < 5; k++) {
          const f = ((k + 0.5) / 5) * e, p = at(path, f), L = s * 0.06;
          g.moveTo(p.x - Math.cos(p.a) * L, p.y - Math.sin(p.a) * L).lineTo(p.x + Math.cos(p.a) * L, p.y + Math.sin(p.a) * L).stroke({ width: 1.2, color: SCUM, alpha: 0.5 * a });
        }
      }
      if (time < T) {
        acc += dt * 26 * t.quality;
        for (; acc >= 1; acc--) {
          const onPool = Math.random() < 0.35, p = onPool ? { x: c.x + rand(-0.4, 0.4) * s, y: c.y + rand(-0.3, 0.3) * s } : at(path, rand(0, Math.max(0.05, e)));
          bub.push({ x: p.x + rand(-0.08, 0.08) * s, y: p.y + rand(-0.08, 0.08) * s, at: time, r: s * rand(0.025, 0.05), life: rand(0.25, 0.4) });
        }
      }
      bubbles(g, bub, time, a);
    });
    // THE MAW lunges up out of the channel's head round the card, jaws
    // gaping, and clamps shut on it as the delivery ends.
    const M0 = GO + RUN * 0.75, ang = Math.atan2(uy, ux), J = s * 0.95;
    const pose = (time: number) => {
      const q = clamp01((time - M0) / (T - M0));
      const open = q < 0.75 ? 0.4 * easeOut(q / 0.75) : 0.4 * (1 - ((q - 0.75) / 0.25) ** 2);
      const reach = easeOut(Math.min(1, q / 0.75));
      return { open, a: clamp01(q * 6), h: { x: end.x - ux * s * 0.25 * (1 - reach), y: end.y - uy * s * 0.25 * (1 - reach) }, J: J * (0.6 + 0.4 * reach) };
    };
    t.draw(T - M0, (g, u) => {
      const q = pose(M0 + u * (T - M0));
      mawSolid(g, maw(q.h, ang, q.J, q.open), q.open, q.a);
    }, { dark: true, delay: M0 });
    t.draw(T - M0, (g, u) => {
      const q = pose(M0 + u * (T - M0));
      mawLight(g, maw(q.h, ang, q.J, q.open), q.J, q.a);
    }, { delay: M0 });
    t.later(M0, () => {
      for (let i = 0; i < Math.round(8 * t.quality); i++) {
        const a = ang + rand(-1.4, 1.4), v = rand(80, 180) * sc;
        t.spark(end.x, end.y, Math.cos(a) * v, Math.sin(a) * v - 60 * sc, rand(0.3, 0.45), MUCK);
      }
    });
    t.later(T - 0.02, () => t.flash(prey, MOSS, 0.15 * (s / 80)));
  },

  land(t: FxTools, m: SigMoment) {
    if (!m.targets.length) return;
    const s = m.size, sc = s / 90, p = centre(m.targets[0]), c = centre(m.from), dest = draggedTo(m, p), k = Math.max(0.8, Math.min(1.6, m.power[0] ?? 1));
    const dragLen = Math.hypot(dest.x - p.x, dest.y - p.y);
    // It faces the card it holds: back along the way the card is hauled, or,
    // when it is not moved, out from the crocodile toward it.
    const back = dragLen > 2 ? Math.atan2(p.y - dest.y, p.x - dest.x) : Math.atan2(p.y - c.y, p.x - c.x);
    const J = s * 0.9;
    const DRAG = dragLen > 2 ? 0.3 : 0, path = dragLen > 2 ? course(p, dest, s, 0.08) : [p.x, p.y, p.x, p.y];
    // It comes out of the delivery facing along its channel and swings round
    // to face back the way it hauls; going under, it slides back and sinks.
    const ang0 = Math.atan2(p.y - c.y, p.x - c.x);
    let turn = back - ang0;
    while (turn > Math.PI) turn -= TAU;
    while (turn < -Math.PI) turn += TAU;
    const heading = (time: number) => ang0 + turn * easeOut(clamp01(time / 0.1));
    const held = (time: number, sink: number) => {
      const q = at(path, easeOut(clamp01(time / Math.max(1e-3, DRAG)))) as Pt, h = heading(time), r = s * 0.5 + J * 0.3 + s * 0.35 * sink;
      return { x: q.x - Math.cos(h) * r, y: q.y - Math.sin(h) * r };
    };
    // THE DRAG: jaws locked, hauled back through a churned wake of mud.
    const BITE = DRAG + 0.04, SNAP = 0.1, SINK = BITE + SNAP + 0.06, END = SINK + 0.18;
    const pose = (time: number) => {
      let open = 0.08;
      if (time >= BITE && time < BITE + SNAP) {
        const q = (time - BITE) / SNAP;
        open = q < 0.55 ? 0.08 + 0.27 * easeOut(q / 0.55) : 0.35 * (1 - ((q - 0.55) / 0.45) ** 2);
      } else if (time >= BITE + SNAP) open = 0;
      const sink = clamp01((time - SINK) / (END - SINK));
      return { h: held(time, sink), ang: heading(time), open, a: 1 - sink, J: J * (1 - 0.25 * sink) };
    };
    if (DRAG > 0) {
      const W = DRAG + 0.35;
      t.draw(W, (g, u) => {
        const time = u * W, e = easeOut(clamp01(time / DRAG)), a = 1 - clamp01((time - DRAG) / 0.35);
        if (e > 0.02) g.poly(ribbon(path, 0, e, s * 0.5).body, true).fill({ color: MUD, alpha: 0.75 * a });
      }, { dark: true });
      let mud = 0;
      t.draw(W, (g, u, dt) => {
        const time = u * W, e = easeOut(clamp01(time / DRAG)), a = 1 - clamp01((time - DRAG) / 0.35);
        if (e <= 0.02) return;
        const rb = ribbon(path, 0, e, s * 0.5);
        g.poly(rb.left, false).stroke({ width: 1.6, color: MOSS, alpha: 0.75 * a });
        g.poly(rb.right, false).stroke({ width: 1.6, color: MOSS, alpha: 0.75 * a });
        // Furrows dragged through the mud by the card's weight.
        for (const o of [-0.1, 0.1]) {
          const ln: number[] = [];
          for (let i = 0; i <= 10; i++) {
            const q = at(path, (e * i) / 10);
            ln.push(q.x - Math.sin(q.a) * o * s, q.y + Math.cos(q.a) * o * s);
          }
          g.poly(ln, false).stroke({ width: 1.2, color: SCUM, alpha: 0.45 * a });
        }
        if (time < DRAG) {
          mud += dt * 70 * t.quality;
          for (; mud >= 1; mud--) {
            const q = at(path, e), sd = Math.random() < 0.5 ? -1 : 1, v = rand(70, 160) * sc, nx = -Math.sin(q.a) * sd, ny = Math.cos(q.a) * sd;
            t.spark(q.x, q.y, (nx * 0.8 - Math.cos(q.a) * 0.3) * v, (ny * 0.8 - Math.sin(q.a) * 0.3) * v - 50 * sc, rand(0.3, 0.45), MUCK);
          }
        }
      });
    }
    t.draw(END, (g, u) => {
      const q = pose(u * END);
      mawSolid(g, maw(q.h, q.ang, q.J, q.open), q.open, q.a);
    }, { dark: true });
    t.draw(END, (g, u) => {
      const time = u * END, q = pose(time);
      mawLight(g, maw(q.h, q.ang, q.J, q.open), q.J, q.a);
      // The card in its jaws, hauled along with it: a pale ghost of its face
      // until it is set down where it lands.
      if (DRAG > 0 && time < DRAG + 0.05) {
        const c0 = at(path, easeOut(clamp01(time / DRAG))), a = 1 - clamp01((time - DRAG) / 0.05), hw = s * 0.36;
        g.roundRect(c0.x - hw, c0.y - hw, hw * 2, hw * 2, s * 0.06).fill({ color: SCUM, alpha: 0.1 * a }).stroke({ width: 1.5, color: PALE, alpha: 0.6 * a });
      }
    });
    // THE BITE where it lands: a hard snap, tooth punctures, murky spray.
    t.later(BITE + SNAP * 0.9, () => {
      t.flash(dest, MOSS, 0.15 * k * (s / 80));
      punctures(t, dest, back, s, k);
      for (let i = 0; i < Math.round(14 * k); i++) {
        const a = back + Math.PI / 2 * (i % 2 ? 1 : -1) + rand(-0.7, 0.7), v = rand(120, 260) * sc;
        t.spark(dest.x + rand(-0.15, 0.15) * s, dest.y + rand(-0.15, 0.15) * s, Math.cos(a) * v, Math.sin(a) * v - 60 * sc, rand(0.3, 0.5), MUCK);
      }
      for (let i = 0; i < Math.round(5 * t.quality); i++)
        t.spark(dest.x + rand(-0.2, 0.2) * s, dest.y + rand(-0.1, 0.1) * s, rand(-15, 15) * sc, rand(0, 30) * sc, rand(0.35, 0.5), SLIME);
    });
    // THE BOG takes it: the root.
    t.later(BITE + SNAP, () => bogged(t, dest, s));
  },
};

/** Two rows of tooth punctures across the bitten card, one per jaw: dark
 *  holes rimmed red and moss. */
function punctures(t: FxTools, p: Pt, ang: number, s: number, k: number) {
  const dx = Math.cos(ang), dy = Math.sin(ang), nx = -dy, ny = dx, holes: Pt[] = [];
  for (const side of [-1, 1])
    for (let i = 0; i < 6; i++) {
      const along = (-0.32 + i * 0.13 + (side > 0 ? 0.06 : 0)) * s, off = side * s * (0.17 + 0.03 * Math.sin(i * 1.7));
      holes.push({ x: p.x + dx * along + nx * off, y: p.y + dy * along + ny * off });
    }
  const R = s * 0.022 * Math.min(1.3, k), D = 0.55;
  const fade = (u: number) => (u < 0.5 ? 1 : 1 - (u - 0.5) / 0.5);
  t.draw(D, (g, u) => {
    const a = fade(u), r = R * easeOut(clamp01(u / 0.1));
    for (const h of holes) g.ellipse(h.x, h.y, r * 1.2, r).fill({ color: 0x080404, alpha: 0.9 * a });
  }, { dark: true });
  t.draw(D, (g, u) => {
    const a = fade(u), r = R * easeOut(clamp01(u / 0.1));
    for (const h of holes) g.ellipse(h.x, h.y, r * 1.2 + 1, r + 1).stroke({ width: 1.1, color: 0xc8483a, alpha: 0.55 * a });
  });
}

/** The bog taking a card: a pool of mud spreading under it, weed rising and
 *  swaying round it, mud bubbling up and popping. */
function bogged(t: FxTools, p: Pt, s: number) {
  const D = 0.65, seed = rand(0, 10);
  const fade = (u: number) => clamp01(u / 0.1) * (u < 0.65 ? 1 : 1 - (u - 0.65) / 0.35);
  const pool = (g: Graphics, u: number) => {
    const r = s * (0.25 + 0.27 * easeOut(clamp01(u / 0.3))), pts: number[] = [], cy = p.y + s * 0.18;
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * TAU, rr = r * (1 + 0.08 * Math.sin(3 * a + seed + u * 5));
      pts.push(p.x + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.42);
    }
    return g.poly(pts, true);
  };
  // Weed strands round the card's foot: each a tapering frond rising and
  // swaying, rooted on the pool's rim.
  const fronds = Array.from({ length: Math.max(6, Math.round(10 * t.quality)) }, (_, i) => {
    const a = Math.PI * (0.05 + (0.9 * (i + rand(0, 0.6))) / 10);
    return { x: p.x + Math.cos(a) * s * 0.45 * (i % 2 ? 1 : -1) * rand(0.6, 1), y: p.y + s * 0.18 + Math.sin(a) * s * 0.08, h: s * rand(0.45, 0.75), ph: rand(0, TAU), at: rand(0, 0.15) };
  });
  const frond = (f: (typeof fronds)[number], u: number) => {
    const grow = easeOut(clamp01((u * D - f.at) / 0.25)), H = f.h * grow, pts: number[] = [], back: number[] = [];
    for (let i = 0; i <= 8; i++) {
      const v = i / 8, sway = Math.sin(v * 3 + u * D * 7 + f.ph) * s * 0.07 * v, w = s * 0.035 * (1 - v);
      pts.push(f.x + sway - w, f.y - H * v);
      back.unshift(f.x + sway + w, f.y - H * v);
    }
    return pts.concat(back);
  };
  t.draw(D, (g, u) => {
    const a = fade(u);
    pool(g, u).fill({ color: MUD, alpha: 0.8 * a });
    for (const f of fronds) g.poly(frond(f, u), true).fill({ color: WEED, alpha: 0.95 * a });
  }, { dark: true });
  const bub: Bub[] = [];
  let acc = 0;
  t.draw(D, (g, u, dt) => {
    const a = fade(u), time = u * D;
    pool(g, u).stroke({ width: 1.6, color: MOSS, alpha: 0.7 * a });
    for (const f of fronds) g.poly(frond(f, u), true).stroke({ width: 1.1, color: MOSS, alpha: 0.75 * a });
    if (u < 0.7) {
      acc += dt * 20 * t.quality;
      for (; acc >= 1; acc--) bub.push({ x: p.x + rand(-0.4, 0.4) * s, y: p.y + s * 0.18 + rand(-0.08, 0.08) * s, at: time, r: s * rand(0.03, 0.06), life: rand(0.25, 0.4) });
    }
    bubbles(g, bub, time, a);
  });
}
