/** EAGON — Dark Wind Wave. "Deal 5 DMG to opponents in the far row, pulling
 *  them toward the near row." His Dark Wind Wave drags the far row in toward
 *  your side.
 *
 *  On his art Eagon is a dark storm-gryphon — an eagle's head, black feathers
 *  shot through with violet, purple lightning breaking behind him — wings
 *  spread over a grey field of ash. The DELIVERY is the wind going OUT: his
 *  black wings open wide and hold, dark air spiralling in under them, and then
 *  it is let go — black-violet streaks running low across the whole board,
 *  fanning out past the enemy's back row and gone over it.
 *
 *  The LANDING is that wind coming BACK. Beyond the far row a dark wave stands
 *  up — a black body lit violet along its crest, purple lightning flickering
 *  in it — cupped toward Eagon, its ends reaching round the row like arms,
 *  its lip a line of curling crescents. It rolls back over the far row TOWARD
 *  him (against "ahead"), breaking over every card in it: violet rakes torn
 *  across each one the way it is being dragged, dark streaks hauled off it
 *  toward the near row, grey ash pulled after them. A card it kills is
 *  swallowed: a dark eddy closing over it. The game slides each token itself;
 *  the hit is anchored on the square the card stood on.
 *
 *  It is drawn as the opposite of Galeon's Mighty Winds on purpose: Galeon's
 *  wall is LIGHT and starts at Galeon, bowed away, pushing; Eagon's wave is
 *  DARK, starts at the far edge, cupped inward, and hooks back. Darkness is
 *  drawn for real (`dark: true`) and every dark shape carries a violet rim, so
 *  it reads over an empty square as well as over a card. */
import { centre, rand } from "../../looks/base";
import type { Graphics } from "pixi.js";
import type { FxTools, Pt, SparkStyle } from "../../looks/types";
import type { Signature, SigMoment } from "../types";

type Box = SigMoment["from"];

const TAU = Math.PI * 2;
// The dark wind and his feathers, on the dark layer only.
const INK = 0x07040e, PLUME = 0x120a1e;
// Its light: a deep violet sheen, the violet rim, lilac and the lightning's white.
const DEEP = 0x4a1f9a, VIOLET = 0x9050f0, LILAC = 0xc29cff, PALE = 0xf0e2ff;
/** Grey ash off his field, hauled in behind a dragged card. */
const ASH: SparkStyle = { palette: [0xe6dcf2, 0xa898bc, 0x6a5c7c], gravity: 0, drag: 0.3, size: [5, 2], streak: true };
/** Violet motes torn off the crest. */
const MOTE: SparkStyle = { palette: [PALE, LILAC, VIOLET, DEEP], gravity: 0, drag: 0.45, size: [4, 1.5], streak: true, swirl: -220 };

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeOut = (x: number) => 1 - (1 - x) * (1 - x);
const smooth = (x: number) => x * x * (3 - 2 * x);

/** The card's own frame: `ahead` and the normal to it, and a way to place a
 *  point `d` along ahead and `l` across from `o`. */
function frame(m: SigMoment) {
  const A = m.ahead, N = { x: -A.y, y: A.x };
  const at = (o: Pt, d: number, l: number): Pt => ({ x: o.x + A.x * d + N.x * l, y: o.y + A.y * d + N.y * l });
  return { A, N, rot: Math.atan2(A.y, A.x), at };
}

// ── The wings ───────────────────────────────────────────────────────────────

/** One flight feather from `b` along `ang`. Continues the current path. */
function quill(g: Graphics, b: Pt, ang: number, len: number, wid: number) {
  const ux = Math.cos(ang), uy = Math.sin(ang), nx = -uy, ny = ux;
  const mx = b.x + ux * len * 0.4, my = b.y + uy * len * 0.4;
  g.moveTo(b.x, b.y)
    .quadraticCurveTo(mx + nx * wid, my + ny * wid, b.x + ux * len, b.y + uy * len)
    .quadraticCurveTo(mx - nx * wid * 0.5, my - ny * wid * 0.5, b.x, b.y);
}

/** A great dark wing: eight long flight feathers fanned wide from the
 *  shoulder, longest at the leading edge, ragged at the tips. */
function wingFeathers(b: Pt, ang: number, side: number, len: number) {
  return Array.from({ length: 8 }, (_, i) => {
    const f = i / 7;
    return { b, ang: ang + side * (0.5 - f) * 1.5, len: len * (1 - 0.45 * f) * (i % 2 ? 0.92 : 1), wid: len * 0.12 };
  });
}

// ── Wind ────────────────────────────────────────────────────────────────────

/** A gust as a local path along +x: a run of `len`, then a hook of radius
 *  `curl`, one way or the other with `flip`. */
function gustPath(len: number, curl: number, flip: boolean): number[] {
  const pts: number[] = [], sy = flip ? -1 : 1;
  for (let i = 0; i <= 10; i++) pts.push((len * i) / 10, 0);
  if (curl > 0)
    for (let i = 1; i <= 10; i++) {
      const f = i / 10, phi = f * 0.7 * TAU, r = curl * (1 - 0.3 * f), th = sy * (Math.PI / 2 - phi);
      pts.push(len + Math.cos(th) * r, -sy * curl + Math.sin(th) * r);
    }
  return pts;
}

/** The stretch [u0, u1] (fractions, by point) of a local path, placed at `o`
 *  and turned by `rot`. */
function slice(path: number[], u0: number, u1: number, o: Pt, rot: number): number[] {
  const n = path.length / 2 - 1, cs = Math.cos(rot), sn = Math.sin(rot), out: number[] = [];
  let i = clamp01(u0) * n;
  const i1 = clamp01(u1) * n;
  for (;;) {
    const a = Math.floor(i), b = Math.min(n, a + 1), f = i - a;
    const px = path[a * 2] + (path[b * 2] - path[a * 2]) * f, py = path[a * 2 + 1] + (path[b * 2 + 1] - path[a * 2 + 1]) * f;
    out.push(o.x + px * cs - py * sn, o.y + px * sn + py * cs);
    if (i >= i1) break;
    i = Math.min(i1, Math.floor(i) + 1);
  }
  return out;
}

/** Where a gust is `age` into a run of `dur`: its head racing out, its tail
 *  chasing it off. */
function windowOf(age: number, dur: number): [number, number] {
  const head = easeOut(clamp01(age / dur)), tl = clamp01((age - dur * 0.45) / dur);
  return [Math.min(head, smooth(tl)), head];
}

/** A crescent lip over `c`, its convex side facing `rot`: the lune between an
 *  arc of radius `r` and a swell `thick` outside it. Returns the outline and
 *  its bright outer edge. */
function lip(c: Pt, r: number, rot: number, span: number, thick: number) {
  const ox = c.x - Math.cos(rot) * r, oy = c.y - Math.sin(rot) * r, body: number[] = [], edge: number[] = [];
  for (let i = 0; i <= 8; i++) {
    const a = rot + (i / 8 - 0.5) * span;
    body.push(ox + Math.cos(a) * r, oy + Math.sin(a) * r);
  }
  for (let i = 8; i >= 0; i--) {
    const f = i / 8, a = rot + (f - 0.5) * span, rr = r + thick * Math.sin(Math.PI * f);
    body.push(ox + Math.cos(a) * rr, oy + Math.sin(a) * rr);
    edge.push(ox + Math.cos(a) * rr, oy + Math.sin(a) * rr);
  }
  return { body, edge };
}

export const EAGON: Signature = {
  shake: 1.0,
  // He stays where he is: the wind goes out and comes back to him.
  lunge: false,

  deliver(t: FxTools, m: SigMoment, seconds: number) {
    const c = centre(m.from), s = m.size, T = seconds, F = frame(m), D = T + 0.15;
    // THE WINGS: opened wide and held, looming — not beaten.
    const pose = (time: number, side: number) => {
      const k = easeOut(clamp01(time / (T * 0.4)));
      return {
        b: F.at(c, -s * 0.04, side * s * 0.12), ang: F.rot + side * (Math.PI / 2 + 0.75 - 0.6 * k) + side * 0.04 * Math.sin(time * 9),
        len: s * (0.5 + 0.55 * k), a: clamp01(time / 0.08) * (1 - clamp01((time - T) / 0.15)),
      };
    };
    t.draw(D, (g, u) => {
      for (const side of [-1, 1]) {
        const p = pose(u * D, side);
        for (const f of wingFeathers(p.b, p.ang, side, p.len)) quill(g, f.b, f.ang, f.len, f.wid);
        g.fill({ color: PLUME, alpha: 0.88 * p.a });
      }
    }, { dark: true });
    t.draw(D, (g, u) => {
      for (const side of [-1, 1]) {
        const p = pose(u * D, side), fs = wingFeathers(p.b, p.ang, side, p.len);
        for (const f of fs) quill(g, f.b, f.ang, f.len, f.wid);
        g.fill({ color: DEEP, alpha: 0.16 * p.a });
        for (const f of fs) quill(g, f.b, f.ang, f.len, f.wid);
        g.stroke({ width: 1.2, color: VIOLET, alpha: 0.85 * p.a, join: "round" });
        // The violet sheen along the leading edge, as on his art.
        const lead = fs[0];
        g.moveTo(lead.b.x, lead.b.y).lineTo(lead.b.x + Math.cos(lead.ang) * lead.len * 0.9, lead.b.y + Math.sin(lead.ang) * lead.len * 0.9)
          .stroke({ width: 2, color: LILAC, alpha: 0.7 * p.a, cap: "round" });
      }
    });
    // Purple lightning cracking over him as the wings open.
    t.later(T * 0.22, () => t.bolt(F.at(c, -s * 0.5, -s * 0.7), F.at(c, s * 0.1, s * 0.15), PALE, VIOLET, 0.12));
    t.later(T * 0.5, () => t.bolt(F.at(c, -s * 0.45, s * 0.75), F.at(c, s * 0.05, -s * 0.1), PALE, VIOLET, 0.1));

    // DARK AIR spiralling in under the wings: thick black streaks, rimmed.
    const a0 = rand(0, TAU), GATHER = T * 0.6;
    const swirl = (g: Graphics, u: number, w: number, color: number, al: number) => {
      const r = s * (0.95 - 0.55 * u), a = a0 - 7 * u * u, fa = al * Math.min(1, u * 5) * (1 - clamp01((u - 0.8) / 0.2));
      for (let i = 0; i < 3; i++) {
        const pts: number[] = [];
        for (let k = 0; k <= 10; k++) {
          const f = k / 10, rr = r * (1.35 - 0.35 * f), th = a + (i * TAU) / 3 - 1.5 * f;
          pts.push(c.x + Math.cos(th) * rr, c.y + Math.sin(th) * rr * 0.85);
        }
        g.poly(pts, false).stroke({ width: w, color, alpha: fa, cap: "round" });
      }
    };
    t.draw(GATHER, (g, u) => swirl(g, u, s * 0.1, INK, 0.6), { dark: true });
    t.draw(GATHER, (g, u) => swirl(g, u, 1.6, LILAC, 0.75));

    // THE SWEEP OUT: let go, low over the board, fanning to beyond the far
    // row — that is where the wave will stand up.
    if (!m.targets.length) return;
    const along = (p: Pt) => (p.x - c.x) * F.A.x + (p.y - c.y) * F.A.y;
    const across = (p: Pt) => (p.x - c.x) * F.N.x + (p.y - c.y) * F.N.y;
    const far = Math.max(...m.targets.map((r) => along(centre(r)))) + s * 0.75;
    const ls = m.targets.map((r) => across(centre(r)));
    const l0 = Math.min(...ls) - s * 0.5, l1 = Math.max(...ls) + s * 0.5;
    const OUT = T * 0.42, RUN = T - OUT;
    const lanes = Array.from({ length: 5 }, (_, i) => ({ l: l0 + ((l1 - l0) * i) / 4 + rand(-0.1, 0.1) * s, bow: (i % 2 ? 1 : -1) * rand(0.25, 0.5) * s }));
    const pathOf = (ln: (typeof lanes)[number]) => {
      const pts: number[] = [];
      for (let k = 0; k <= 16; k++) {
        const f = k / 16, p = F.at(c, s * 0.3 + (far - s * 0.3) * f, ln.l * f + ln.bow * Math.sin(Math.PI * f));
        pts.push(p.x, p.y);
      }
      return pts;
    };
    const paths = lanes.map(pathOf);
    const part = (pts: number[], u0: number, u1: number) => slice(pts.map((v, i) => (i % 2 ? v - c.y : v - c.x)), u0, u1, c, 0);
    const sweep = (g: Graphics, u: number, light: boolean) => {
      const [u0, u1] = windowOf(u * (RUN + 0.15), RUN);
      if (u1 - u0 < 0.02) return;
      for (const pts of paths) {
        const seg = part(pts, u0, u1);
        // Dark air, lit violet through: a broad soft sheen, a thin lilac edge,
        // and only its head bright.
        if (light) {
          g.poly(seg, false).stroke({ width: s * 0.16, color: DEEP, alpha: 0.3, cap: "round", join: "round" });
          g.poly(seg, false).stroke({ width: 1.3, color: LILAC, alpha: 0.6, cap: "round", join: "round" });
          g.poly(part(pts, u1 - (u1 - u0) * 0.25, u1), false).stroke({ width: 2.6, color: LILAC, alpha: 0.9, cap: "round" });
        } else g.poly(seg, false).stroke({ width: s * 0.16, color: INK, alpha: 0.6, cap: "round", join: "round" });
      }
    };
    t.draw(RUN + 0.15, (g, u) => sweep(g, u, false), { dark: true, delay: OUT });
    t.draw(RUN + 0.15, (g, u) => sweep(g, u, true), { delay: OUT });
  },

  land(t: FxTools, m: SigMoment) {
    const c = centre(m.from), s = m.size, F = frame(m);
    if (!m.targets.length) return;
    const along = (p: Pt) => (p.x - c.x) * F.A.x + (p.y - c.y) * F.A.y;
    const across = (p: Pt) => (p.x - c.x) * F.N.x + (p.y - c.y) * F.N.y;
    const b = m.board;
    const corners = [{ x: b.x, y: b.y }, { x: b.x + b.w, y: b.y }, { x: b.x, y: b.y + b.h }, { x: b.x + b.w, y: b.y + b.h }];
    // The far row, and the board's width across it: the wave spans the row.
    const dFar = Math.max(...m.targets.map((r) => along(centre(r))));
    const lMin = Math.min(...corners.map(across)) + s * 0.1, lMax = Math.max(...corners.map(across)) - s * 0.1;
    const W = Math.max(-lMin, lMax, s);
    // THE WAVE: stands up beyond the row, then rolls back over it toward him,
    // its ends reaching in ahead of its middle (HOOK) — cupped round the row.
    const RUN = 0.55, HOOK = s * 0.85, start = dFar + s * 0.55, stop = dFar - s * 1.3;
    const crest = (time: number, l: number) => start - (start - stop) * smooth(clamp01(time / RUN)) - HOOK * (l / W) * (l / W);
    const thick = (time: number) => s * (0.3 + 0.55 * easeOut(clamp01(time / 0.16))) * (1 - 0.6 * clamp01((time - RUN) / 0.35));
    const fade = (time: number) => clamp01(time / 0.06) * (1 - clamp01((time - RUN * 0.85) / 0.35));
    const D = RUN + 0.45, K = 24;
    const shape = (time: number, part = 1) => {
      const front: number[] = [], back: number[] = [], th = thick(time) * part;
      for (let i = 0; i <= K; i++) {
        const l = lMin + ((lMax - lMin) * i) / K, d = crest(time, l) + s * 0.04 * Math.sin(l * 0.09 - time * 14);
        // The ends are thinner: the wave tapers off round the row.
        const e = 1 - Math.pow(Math.abs(l) / W, 4) * 0.7;
        const p = F.at(c, d, l), q = F.at(c, d + th * e, l);
        front.push(p.x, p.y);
        back.unshift(q.x, q.y);
      }
      return { front, body: front.concat(back) };
    };
    // Its lip: crescents curling over along the crest, facing him and each
    // hooked in toward the middle — the wave's claws, gathering the row.
    const nLips = Math.max(3, Math.round((lMax - lMin) / (s * 0.7)));
    const lips = Array.from({ length: nLips }, (_, i) => ({ l: lMin + ((lMax - lMin) * (i + 0.5)) / nLips, ph: rand(0, TAU) }));
    const lipAt = (time: number, lp: (typeof lips)[number]) => {
      const roll = Math.sin(time * 10 + lp.ph);
      const p = F.at(c, crest(time, lp.l) - s * (0.04 + 0.03 * roll), lp.l), inward = lp.l > 0 ? -1 : 1;
      return lip(p, s * 0.26, F.rot + Math.PI + inward * (0.55 + 0.1 * roll), 1.6, s * 0.15 * (0.8 + 0.2 * roll));
    };
    t.draw(D, (g, u) => {
      const time = u * D, a = fade(time);
      if (a <= 0.01) return;
      g.poly(shape(time).body).fill({ color: INK, alpha: 0.72 * a });
      for (const lp of lips) g.poly(lipAt(time, lp).body).fill({ color: INK, alpha: 0.8 * a });
    }, { dark: true });
    let acc = 0;
    const rush = Array.from({ length: Math.round(16 * (0.6 + 0.4 * t.quality)) }, () => ({ l: rand(lMin, lMax), f: rand(0, 1), len: rand(0.3, 0.6) }));
    t.draw(D, (g, u, dt) => {
      const time = u * D, a = fade(time);
      if (a <= 0.01) return;
      const sh = shape(time), th = thick(time);
      // The violet sheen through it, the glow and the lit rim on its crest.
      g.poly(sh.body).fill({ color: DEEP, alpha: 0.3 * a });
      g.poly(shape(time, 0.35).body).fill({ color: VIOLET, alpha: 0.16 * a });
      g.poly(sh.front, false).stroke({ width: s * 0.14, color: VIOLET, alpha: 0.3 * a, join: "round" });
      g.poly(sh.front, false).stroke({ width: 2.2, color: LILAC, alpha: 0.9 * a, join: "round" });
      // The air in it rushing toward him: streaks from its back to its crest.
      for (const r of rush) {
        const d = crest(time, r.l), f = (r.f + time * 2.2) % 1;
        const h = F.at(c, d + th * (1 - f) * 0.9, r.l), tl = F.at(c, d + th * (1 - f) * 0.9 + s * r.len * 0.6, r.l);
        g.moveTo(tl.x, tl.y).lineTo(h.x, h.y).stroke({ width: 1.4, color: LILAC, alpha: 0.55 * a * Math.sin(Math.PI * f), cap: "round" });
      }
      for (const lp of lips) {
        const L = lipAt(time, lp);
        g.poly(L.body).fill({ color: DEEP, alpha: 0.25 * a });
        g.poly(L.edge, false).stroke({ width: 2, color: PALE, alpha: 0.85 * a, cap: "round" });
      }
      // Motes torn off the crest, thrown in toward him.
      acc += dt * 60 * t.quality * a;
      for (; acc >= 1; acc--) {
        const l = rand(lMin, lMax), p = F.at(c, crest(time, l), l), v = rand(150, 300) * (s / 90);
        t.spark(p.x, p.y, -F.A.x * v + F.N.x * rand(-40, 40), -F.A.y * v + F.N.y * rand(-40, 40), rand(0.25, 0.45), MOTE);
      }
    });
    // Purple lightning flickering in the wave as it rolls.
    for (const [when, f] of [[0.08, 0.25], [0.24, 0.7], [0.4, 0.45]]) {
      t.later(when, () => {
        const l = lMin + (lMax - lMin) * f, l2 = l + (Math.random() < 0.5 ? -1 : 1) * s * 1.1;
        t.bolt(F.at(c, crest(when, l) + s * 0.25, l), F.at(c, crest(when, l2) + s * 0.1, l2), PALE, VIOLET, 0.12);
      });
    }

    // Where the crest breaks over a card, it rakes it and drags it in.
    m.targets.forEach((r, i) => {
      const p = centre(r), d = along(p), l = across(p);
      let when = RUN;
      for (let k = 0; k <= 60; k++) if (crest((k / 60) * RUN, l) <= d + s * 0.1) { when = (k / 60) * RUN; break; }
      t.later(when, () => haul(t, r, m, m.power[i] ?? 0.8, !!m.killed[i]));
    });
  },
};

/** The wave breaking over one card: three violet rakes torn across it the way
 *  it is dragged, dark streaks hauled off it toward the near row, grey ash
 *  pulled after them; a card it kills is swallowed by a dark eddy. */
function haul(t: FxTools, r: Box, m: SigMoment, power: number, killed: boolean) {
  const c = centre(r), s = m.size, F = frame(m), k = Math.max(0.6, Math.min(1.6, power));
  const back = F.rot + Math.PI;
  t.rakes(c, s * 0.4, back, VIOLET, 3, s * 0.17, 2 * k);
  t.glow(r, VIOLET, 0.26, 0.45, 1.0);
  t.arcs(c, [PALE, LILAC, VIOLET], 0.5 * k, 3);
  // The drag: four streaks from the card's far side, through it, and on
  // toward the near row, curling as they spend.
  const lanes = [-0.32, -0.11, 0.11, 0.32].map((o, i) => ({ o, at: [0.05, 0, 0.02, 0.07][i], path: gustPath(s * 1.75, s * 0.06, o > 0) }));
  const D = 0.6;
  const draw = (g: Graphics, u: number, light: boolean) => {
    const age = u * D;
    for (const ln of lanes) {
      const [u0, u1] = windowOf(age - ln.at, 0.4);
      if (u1 - u0 < 0.02) continue;
      const pts = slice(ln.path, u0, u1, F.at(c, s * 0.45, ln.o * s), back);
      if (light) {
        g.poly(pts, false).stroke({ width: s * 0.09, color: DEEP, alpha: 0.3, cap: "round" });
        g.poly(pts, false).stroke({ width: 1.2, color: LILAC, alpha: 0.6, cap: "round" });
        g.poly(slice(ln.path, u1 - (u1 - u0) * 0.3, u1, F.at(c, s * 0.45, ln.o * s), back), false).stroke({ width: 2.4, color: LILAC, alpha: 0.9, cap: "round" });
      } else g.poly(pts, false).stroke({ width: s * 0.09, color: INK, alpha: 0.55, cap: "round" });
    }
  };
  t.draw(D, (g, u) => draw(g, u, false), { dark: true });
  t.draw(D, (g, u) => draw(g, u, true));
  const n = Math.round((10 + 6 * k) * Math.max(0.5, t.quality));
  for (let i = 0; i < n; i++) {
    const v = rand(180, 360) * (s / 90), o = F.at(c, rand(-0.2, 0.4) * s, rand(-0.35, 0.35) * s);
    t.spark(o.x, o.y, -F.A.x * v + F.N.x * rand(-50, 50), -F.A.y * v + F.N.y * rand(-50, 50), rand(0.3, 0.5), ASH);
  }
  if (!killed) return;
  // Swallowed: a dark eddy closing over the card, its rim spiralling in.
  const E = 0.55, a0 = rand(0, TAU);
  t.draw(E, (g, u) => {
    const R = s * 0.5 * (1 - 0.75 * easeOut(u)), al = Math.min(1, u * 6) * (1 - clamp01((u - 0.7) / 0.3));
    g.circle(c.x, c.y, R).fill({ color: INK, alpha: 0.75 * al });
  }, { dark: true, delay: 0.05 });
  t.draw(E, (g, u) => {
    const R = s * 0.5 * (1 - 0.75 * easeOut(u)), al = Math.min(1, u * 6) * (1 - clamp01((u - 0.7) / 0.3));
    for (let i = 0; i < 3; i++) {
      const pts: number[] = [];
      for (let j = 0; j <= 8; j++) {
        const f = j / 8, th = a0 + u * 9 + (i * TAU) / 3 + f * 1.8, rr = R * (1.15 - 0.5 * f);
        pts.push(c.x + Math.cos(th) * rr, c.y + Math.sin(th) * rr);
      }
      g.poly(pts, false).stroke({ width: 2, color: LILAC, alpha: 0.9 * al, cap: "round" });
    }
  }, { delay: 0.05 });
}
