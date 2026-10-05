/** IRONCLAD — Magnetic Steel. "Deal 3 DMG to every adjacent opponent, and
 *  steal up to 3 shields from each one in front of it, equipping them." It
 *  pulls the shields off the enemies in front of it and wears them.
 *
 *  Its art is a knight in heavy silver plate under a horned helm, a crystal
 *  spear in his hand, crackling BLUE MAGNETIC current all over him — and
 *  pieces of armour and shields flying through the air toward him.
 *
 *  The DELIVERY is the magnet waking: his plate charges, a blue rim crawling
 *  round his card, and the curved FIELD LINES of a magnet bloom out of it —
 *  the loops of a dipole, pole to pole through the knight, wider and wider,
 *  current flowing along them.
 *
 *  The LANDING is the pull. A magnetic pulse runs out from him and SNAPS onto
 *  every adjacent opponent — a blue field ring clamping tight on the card, a
 *  jolt. Then from each opponent in FRONT of him (the ones robbed) three steel
 *  shield-plates are wrenched loose, rattle, and fly to him along bowed field
 *  lines, tumbling and accelerating as the pull takes them, to CLANK onto his
 *  card's facing side as armour — each landing with a burst of struck sparks
 *  — and the whole suit takes a last blue sheen. Steel and magnetism, never
 *  lightning forks: the current is smooth field, not a bolt.
 *
 *  The plates are SOLID steel on the normal-blend layer (mid grey, a lit
 *  face, a shadowed face, a dark edge, a boss), each with a blue magnetised
 *  rim of light over it so it reads over an empty square. */
import type { Graphics } from "pixi.js";
import { centre, rand } from "../../looks/base";
import type { FxTools, Pt, SparkStyle } from "../../looks/types";
import type { Signature, SigMoment } from "../types";

type Box = SigMoment["from"];


// Steel, on the normal-blend layer: real colour.
const STEEL = 0x8792a0, STEEL_HI = 0xe2eaf4, STEEL_LO = 0x434c58, EDGE = 0x10141a;
// The field (additive): blue current, pale at its heart.
const FIELD = 0x2f86ff, FIELD_HI = 0x9cd2ff, WHITE = 0xeef8ff;
/** Blue motes crawling over his charging plate. */
const CURRENT: SparkStyle = { palette: [WHITE, FIELD_HI, FIELD, 0x1a4aa0], gravity: 0, drag: 0.3, size: [3, 1], streak: true };
/** Struck off steel as a plate clanks home: hot white-gold streaks, falling. */
const CLANK: SparkStyle = { palette: [0xffffff, 0xfff0c0, 0xffc860, 0x9a7040], gravity: 800, drag: 0.5, size: [4, 1.5], streak: true };
/** The jolt through a card the pulse snaps onto. */
const JOLT: SparkStyle = { palette: [WHITE, FIELD_HI, FIELD], gravity: 0, drag: 0.25, size: [4, 1], streak: true };

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeOut = (x: number) => 1 - (1 - x) * (1 - x);
const easeIn = (x: number) => x * x;

/** "Ahead", made safe to build on: a unit vector, up if it came in empty. */
function unit(v: Pt): Pt {
  const l = Math.hypot(v.x, v.y);
  return l > 1e-6 ? { x: v.x / l, y: v.y / l } : { x: 0, y: -1 };
}

// ── The field ────────────────────────────────────────────────────────────────

/** One loop of a magnet's field round `c`, its axis along `u`: the dipole's
 *  r = L sin²(phi), out of the front pole, round on `side`, back into the
 *  rear. `f` in 0..1 runs along it, front to back. */
function loopPt(c: Pt, u: Pt, L: number, side: number, f: number): Pt {
  const phi = 0.2 + f * (Math.PI - 0.4), r = L * Math.sin(phi) * Math.sin(phi);
  const a = Math.cos(phi) * r, b = Math.sin(phi) * r * side;
  return { x: c.x + u.x * a - u.y * b, y: c.y + u.y * a + u.x * b };
}

/** The field lines, `alpha` bright, sized by `grow`: three loops a side, and
 *  current flowing along each (`time` moves it), front pole to rear. */
function field(g: Graphics, c: Pt, u: Pt, s: number, grow: number, alpha: number, time: number) {
  if (alpha <= 0.02 || grow <= 0.02) return;
  [0.62, 0.95, 1.3].forEach((k, j) => {
    const L = s * k * grow, a = alpha * (1 - j * 0.2);
    for (const side of [-1, 1]) {
      const pts: number[] = [];
      for (let i = 0; i <= 24; i++) {
        const p = loopPt(c, u, L, side, i / 24);
        pts.push(p.x, p.y);
      }
      g.poly(pts, false).stroke({ width: 5, color: FIELD, alpha: 0.12 * a });
      g.poly(pts, false).stroke({ width: 1.5, color: FIELD_HI, alpha: 0.55 * a });
      for (let d = 0; d < 3; d++) {
        const f = (time * 1.6 + d / 3 + j * 0.17) % 1, p = loopPt(c, u, L, side, f);
        g.circle(p.x, p.y, 2.2).fill({ color: WHITE, alpha: 0.9 * a * Math.sin(f * Math.PI) });
      }
    }
  });
}

/** His plate charging: a blue rim round his card, its brightness crawling. */
function rim(g: Graphics, r: Box, alpha: number, time: number) {
  if (alpha <= 0.02) return;
  const m = 2;
  g.roundRect(r.x - m, r.y - m, r.w + m * 2, r.h + m * 2, 5).stroke({ width: 4, color: FIELD, alpha: 0.25 * alpha });
  g.roundRect(r.x - m, r.y - m, r.w + m * 2, r.h + m * 2, 5).stroke({ width: 1.3, color: FIELD_HI, alpha: (0.55 + 0.25 * Math.sin(time * 30)) * alpha });
}

// ── Steel ────────────────────────────────────────────────────────────────────

/** A heater shield's outline at (x, y), `w` wide, its top edge facing along
 *  `rot` (screen radians): flat top, straight sides, curving to a point. */
function shieldPts(x: number, y: number, w: number, rot: number, half?: -1 | 1): number[] {
  const h = w * 1.18, ux = Math.cos(rot), uy = Math.sin(rot); // "up" (the top edge's outward side)
  const p = (a: number, b: number) => [x + ux * b - uy * a, y + uy * b + ux * a]; // a across, b up
  const all = [[-w / 2, h * 0.5], [w / 2, h * 0.5], [w / 2, 0], [w * 0.36, -h * 0.28], [0, -h * 0.5], [-w * 0.36, -h * 0.28], [-w / 2, 0]];
  const side = half === undefined ? all : half < 0 ? [[-w / 2, h * 0.5], [0, h * 0.5], [0, -h * 0.5], [-w * 0.36, -h * 0.28], [-w / 2, 0]]
    : [[0, h * 0.5], [w / 2, h * 0.5], [w / 2, 0], [w * 0.36, -h * 0.28], [0, -h * 0.5]];
  return side.flatMap(([a, b]) => p(a, b));
}

/** A steel shield-plate: the plate, a lit half, a shadowed half (the light
 *  stays top-left however it turns), a dark edge and a boss. */
function plateDark(g: Graphics, x: number, y: number, w: number, rot: number, alpha: number) {
  if (alpha <= 0.02) return;
  const body = shieldPts(x, y, w, rot);
  const ux = Math.cos(rot), uy = Math.sin(rot);
  const litHalf: -1 | 1 = ux - uy > 0 ? -1 : 1; // the half nearer top-left
  g.poly(body, true).fill({ color: STEEL, alpha });
  g.poly(shieldPts(x, y, w, rot, litHalf), true).fill({ color: STEEL_HI, alpha: 0.32 * alpha });
  g.poly(shieldPts(x, y, w, rot, (-litHalf) as -1 | 1), true).fill({ color: STEEL_LO, alpha: 0.55 * alpha });
  g.poly(body, true).stroke({ width: 1.5, color: EDGE, alpha, join: "round" });
  g.circle(x + ux * w * 0.08, y + uy * w * 0.08, w * 0.12).fill({ color: STEEL_LO, alpha }).stroke({ width: 1, color: EDGE, alpha });
}

/** Its light: the blue magnetised rim, and a white glint along its top. */
function plateLit(g: Graphics, x: number, y: number, w: number, rot: number, alpha: number, glow: number) {
  if (alpha <= 0.02) return;
  const body = shieldPts(x, y, w, rot);
  if (glow > 0.02) g.circle(x, y, w * 0.85).fill({ color: FIELD, alpha: 0.14 * glow * alpha });
  g.poly(body, true).stroke({ width: 1.2, color: FIELD_HI, alpha: (0.35 + 0.4 * glow) * alpha, join: "round" });
  const top = shieldPts(x, y, w * 0.88, rot);
  g.moveTo(top[0], top[1]).lineTo(top[2], top[3]).stroke({ width: 1.2, color: WHITE, alpha: 0.55 * alpha });
  const ux = Math.cos(rot), uy = Math.sin(rot);
  g.circle(x + ux * w * 0.1 - uy * w * 0.03, y + uy * w * 0.1 + ux * w * 0.03, w * 0.04).fill({ color: WHITE, alpha: 0.8 * alpha });
}

/** A point on a quadratic curve. */
const quad = (a: Pt, k: Pt, b: Pt, q: number): Pt => ({
  x: (1 - q) * (1 - q) * a.x + 2 * (1 - q) * q * k.x + q * q * b.x,
  y: (1 - q) * (1 - q) * a.y + 2 * (1 - q) * q * k.y + q * q * b.y,
});

/** One plate's trip: where it tears off, the field line it rides (bowed out
 *  to one side), where it docks on Ironclad and which way it faces there. */
interface Plate { from: Pt; ctrl: Pt; dock: Pt; rot0: number; rot1: number; spin: number; tear: number }

/** The wrench (rattling loose) and the flight, s. */
const WRENCH = 0.08, FLY = 0.26;

export const IRONCLAD: Signature = {
  shake: 0.9,
  // He does not step in: he stands and pulls.
  lunge: false,

  deliver(t: FxTools, m: SigMoment, seconds: number) {
    const c = centre(m.from), s = m.size, sc = s / 90, u = unit(m.ahead), S = seconds;
    t.draw(S, (g, v) => {
      const time = v * S;
      rim(g, m.from, easeOut(clamp01(v * 3)), time);
      field(g, c, u, s, easeOut(clamp01((v - 0.1) / 0.8)), clamp01((v - 0.05) * 5), time);
      // The poles, brightening as it charges.
      for (const sgn of [1, -1]) {
        const p = { x: c.x + u.x * s * 0.3 * sgn, y: c.y + u.y * s * 0.3 * sgn };
        g.circle(p.x, p.y, s * 0.07).fill({ color: FIELD, alpha: 0.3 * v });
        g.circle(p.x, p.y, s * 0.025).fill({ color: WHITE, alpha: 0.8 * v });
      }
    });
    t.charge(c, s * 0.9, FIELD, 0.28, S);
    // Current crawling over the plate: short blue streaks running along the
    // card's edge, never forking.
    let acc = 0;
    t.draw(S, (_g, v, dt) => {
      acc += dt * 40 * t.quality * (0.3 + v);
      for (; acc >= 1; acc--) {
        const side = Math.floor(rand(0, 4)), f = rand(0, 1), r = m.from;
        const x = side === 0 ? r.x + f * r.w : side === 1 ? r.x + r.w : side === 2 ? r.x + f * r.w : r.x;
        const y = side === 0 ? r.y : side === 1 ? r.y + f * r.h : side === 2 ? r.y + r.h : r.y + f * r.h;
        const along = side % 2 ? { x: 0, y: 1 } : { x: 1, y: 0 }, dir = Math.random() < 0.5 ? -1 : 1, vv = rand(80, 160) * sc;
        t.spark(x, y, along.x * dir * vv, along.y * dir * vv, rand(0.12, 0.22), CURRENT);
      }
    });
  },

  land(t: FxTools, m: SigMoment) {
    const c = centre(m.from), s = m.size, sc = s / 90, u = unit(m.ahead);
    const hits = m.targets.map((r, i) => {
      const p = centre(r), d = Math.hypot(p.x - c.x, p.y - c.y) || 1;
      const dir = { x: (p.x - c.x) / d, y: (p.y - c.y) / d };
      // In front of him: within ~60 degrees of "ahead" (straight on, or the
      // diagonals of the row he faces).
      return { r, p, d, dir, ahead: dir.x * u.x + dir.y * u.y > 0.5, power: m.power[i] ?? 1, killed: !!m.killed[i] };
    });
    const reach = Math.max(s * 1.3, ...hits.map((h) => h.d + s * 0.3));
    const PULSE = 0.16;
    const when = (d: number) => PULSE * clamp01((d - s * 0.5) / Math.max(1, reach - s * 0.5));

    // THE PULSE: a ring of field running out to everything in reach, and the
    // field lines still standing round him, slowly drawing back in.
    t.flash(c, FIELD_HI, 0.35 * sc);
    t.draw(PULSE + 0.18, (g, v) => {
      const time = v * (PULSE + 0.18), r = s * 0.5 + (reach - s * 0.5) * easeOut(clamp01(time / PULSE)), a = 1 - clamp01((time - PULSE * 0.6) / 0.24);
      g.circle(c.x, c.y, r).stroke({ width: 7, color: FIELD, alpha: 0.22 * a });
      g.circle(c.x, c.y, r).stroke({ width: 2.2, color: FIELD_HI, alpha: 0.85 * a });
      g.circle(c.x, c.y, r * 0.8).stroke({ width: 1.2, color: FIELD_HI, alpha: 0.35 * a });
    });
    const LD = 1.0;
    t.draw(LD, (g, v) => {
      const time = v * LD;
      field(g, c, u, s, 1 - 0.45 * easeOut(v), 0.75 * (1 - clamp01((v - 0.55) / 0.45)), 0.6 + time);
      rim(g, m.from, 1 - clamp01((v - 0.7) / 0.3), time);
    });

    // Every adjacent opponent: the field snaps onto it.
    for (const h of hits) t.later(when(h.d), () => snap(t, h.r, h.p, h.dir, h.power));

    // The ones in front: three shield-plates each, torn off and pulled home.
    const plates: Plate[] = [];
    for (const h of hits.filter((x) => x.ahead)) {
      const n = { x: -h.dir.y, y: h.dir.x }, face = Math.atan2(h.dir.y, h.dir.x);
      for (let i = 0; i < 3; i++) {
        const o = i - 1;
        const from = { x: h.p.x + n.x * o * s * 0.24 - h.dir.x * s * 0.08, y: h.p.y + n.y * o * s * 0.24 - h.dir.y * s * 0.08 };
        const dock = { x: c.x + h.dir.x * s * (0.36 - Math.abs(o) * 0.05) + n.x * o * s * 0.25, y: c.y + h.dir.y * s * (0.36 - Math.abs(o) * 0.05) + n.y * o * s * 0.25 };
        const mid = { x: (from.x + dock.x) / 2, y: (from.y + dock.y) / 2 }, bow = (o === 0 ? (i % 2 ? 0.12 : -0.12) : o * 0.42) * s;
        plates.push({ from, dock, ctrl: { x: mid.x + n.x * bow, y: mid.y + n.y * bow }, rot0: face + rand(-0.6, 0.6) + Math.PI,
          rot1: face + o * 0.35, spin: rand(4, 7) * (Math.random() < 0.5 ? -1 : 1), tear: when(h.d) + 0.05 + i * 0.05 });
      }
    }
    if (!plates.length) return;
    const W = s * 0.27, END = Math.max(...plates.map((p) => p.tear)) + WRENCH + FLY, D = Math.max(LD, END + 0.38);
    /** Where a plate is at `time`, which way it faces, and how far through
     *  its flight (0 still on its owner, 1 docked). */
    const state = (p: Plate, time: number) => {
      const q = clamp01((time - p.tear - WRENCH) / FLY), e = easeIn(q);
      if (time < p.tear + WRENCH) {
        // Rattling loose: shaking where it hangs, lifting off the card.
        const w = clamp01((time - p.tear) / WRENCH), j = Math.sin(time * 140) * s * 0.025 * w;
        return { at: { x: p.from.x + j, y: p.from.y - j * 0.5 }, rot: p.rot0 + Math.sin(time * 90) * 0.25 * w, q: 0, w };
      }
      const turn = q < 1 ? p.spin * q * (1 - q) : 0;
      return { at: quad(p.from, p.ctrl, p.dock, e), rot: p.rot0 + (p.rot1 - p.rot0) * e + turn, q, w: 1 };
    };
    const alpha = (p: Plate, time: number) => (time < p.tear ? 0 : time < END + 0.12 ? clamp01((time - p.tear) * 25) : 1 - clamp01((time - END - 0.12) / (D - END - 0.12)));
    t.draw(D, (g, v) => {
      const time = v * D;
      for (const p of plates) {
        const st = state(p, time);
        plateDark(g, st.at.x, st.at.y, W * (st.q < 1 ? 1 : 0.92), st.rot, alpha(p, time));
      }
    }, { dark: true });
    t.draw(D, (g, v) => {
      const time = v * D;
      for (const p of plates) {
        const st = state(p, time), a = alpha(p, time);
        if (a <= 0.02) continue;
        // The field line it rides, lit while it is pulled along it.
        if (st.q < 1) {
          const la = (time < p.tear + WRENCH ? st.w : 1) * 0.7, pts: number[] = [];
          for (let i = 0; i <= 16; i++) {
            const pt = quad(p.from, p.ctrl, p.dock, i / 16);
            pts.push(pt.x, pt.y);
          }
          g.poly(pts, false).stroke({ width: 4, color: FIELD, alpha: 0.15 * la });
          g.poly(pts, false).stroke({ width: 1.2, color: FIELD_HI, alpha: 0.55 * la });
          // The rush behind it as it accelerates.
          if (st.q > 0.05) {
            const tail: number[] = [];
            for (let i = 0; i <= 6; i++) {
              const pt = quad(p.from, p.ctrl, p.dock, easeIn(Math.max(0, st.q - 0.3 + (0.3 * i) / 6)));
              tail.push(pt.x, pt.y);
            }
            g.poly(tail, false).stroke({ width: 3, color: WHITE, alpha: 0.5 * st.q, cap: "round" });
          }
        }
        // Docked: a blue glint sweeps over the new armour as the field settles.
        const glow = st.q < 1 ? 1 : clamp01(1 - (time - END) / 0.3);
        plateLit(g, st.at.x, st.at.y, W * (st.q < 1 ? 1 : 0.92), st.rot, a, glow);
      }
    });
    // Each one CLANKS home: struck sparks, a small flash.
    for (const p of plates)
      t.later(p.tear + WRENCH + FLY, () => {
        t.flash(p.dock, 0xfff4dc, 0.14 * sc);
        const out = Math.atan2(p.dock.y - c.y, p.dock.x - c.x), n = Math.round(6 * t.quality) + 1;
        for (let i = 0; i < n; i++) {
          const a = out + rand(-1.3, 1.3), vv = rand(110, 240) * sc;
          t.spark(p.dock.x, p.dock.y, Math.cos(a) * vv, Math.sin(a) * vv - rand(30, 90) * sc, rand(0.2, 0.35), CLANK);
        }
      });
    // The suit, complete: a last blue-steel sheen over the knight.
    t.later(END + 0.02, () => {
      t.ring(m.from, FIELD_HI, 0.95, 1.12, 0.3, 2.5);
      t.glow(m.from, 0x9cc8f0, 0.25, 0.4, 0.95);
    });
  },
};

/** The pulse snapping onto a card: a blue field ring clamping in tight on it,
 *  its edge flickering blue, and a jolt through it — short blue streaks
 *  thrown out sideways off the line from Ironclad. */
function snap(t: FxTools, r: Box, p: Pt, dir: Pt, power: number) {
  const s = Math.min(r.w, r.h), sc = s / 90, k = Math.max(0.8, Math.min(1.5, power));
  const D = 0.3;
  t.draw(D, (g, v) => {
    const rr = s * (0.74 - 0.26 * easeOut(clamp01(v / 0.4))) * Math.min(1.15, k), a = 1 - clamp01((v - 0.35) / 0.65);
    g.circle(p.x, p.y, rr).stroke({ width: 6, color: FIELD, alpha: 0.25 * a });
    g.circle(p.x, p.y, rr).stroke({ width: 2.2, color: FIELD_HI, alpha: 0.9 * a });
    const fl = Math.sin(v * 60) > 0 ? 1 : 0.4;
    g.roundRect(r.x, r.y, r.w, r.h, 4).stroke({ width: 1.5, color: FIELD_HI, alpha: 0.6 * a * fl });
  });
  t.flash(p, WHITE, 0.2 * k * sc);
  const n = Math.round(8 * k * t.quality), nx = -dir.y, ny = dir.x;
  for (let i = 0; i < n; i++) {
    const side = i % 2 ? 1 : -1, vv = rand(140, 260) * sc, back = rand(-40, 60) * sc;
    t.spark(p.x + rand(-0.2, 0.2) * s, p.y + rand(-0.2, 0.2) * s, nx * side * vv + dir.x * back, ny * side * vv + dir.y * back, rand(0.12, 0.22), JOLT);
  }
}
