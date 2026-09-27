/** SKULLKING — King's SkullDrake. "Apply DOT 3 (3 rounds) to opponents in the
 *  row directly ahead and raise an attacking Risen Drake." He does not command
 *  an army so much as keep a register.
 *
 *  The King on his art holds up a sceptre crowned with a burning skull, and
 *  behind him the bone drake he keeps rears out of the fog. The DELIVERY is
 *  the King raising that sceptre: ghost-fire kindling on the skull at its
 *  head, his shadow pooling under his card, tendrils of it reaching in, and a
 *  sickly green drawn in to him from all round — the register opened. The
 *  LANDING is a name called: the ground of the Risen Drake's square cracks
 *  open, green light welling up through it, and ghost-fire rises out of the
 *  cracks and gathers into the drake's skull — horned, fanged, its sockets
 *  burning — which drops its jaw and breathes. The miasma pours out onto the
 *  row ahead and rolls along it both ways, breaking over every card in it and
 *  clinging there (the DOT).
 *
 *  The skull is face on and upright over its grave whichever way the board
 *  faces: a skull reads at a glance from the front, and at a square's size a
 *  drake's head in profile read as a beak. Darkness is drawn for real (`dark:
 *  true`) — the cracks, the hollow of the skull, the body of the miasma — and
 *  every dark shape is lit at its edge, because a dark shape over an empty
 *  square is invisible. The green is DUSK's rot, not LEAF's life: sickly,
 *  yellowed, and rimmed in DUSK's violet. */
import { centre, rand } from "../looks/base";
import { pyroFlick, pyroTongue } from "../looks/fire";
import type { Graphics } from "pixi.js";
import type { FxTools, Pt, SparkStyle } from "../looks/types";
import type { Signature, SigMoment } from "./types";

type Box = { x: number; y: number; w: number; h: number };

const TAU = Math.PI * 2;
/** The dark of it — the cracks, the skull's hollow, the miasma's body: a
 *  green-black, only ever on the dark layer. */
const INK = 0x050b07;
/** Ghost-fire and rot: a sickly, yellowed green. */
const BILE = 0xb8f25c, GREEN = 0x72d65c;
/** The skull's own lines: bone, lit green-white. */
const GHOST = 0xe6ffd6;
/** DUSK's violet, at the edges of its dark. */
const LILAC = 0xc9a6ff;
/** The sceptre's bone, and the ember eyes in every skull on his art. */
const BONE = 0xece2c8, AMBER = 0xffb347;
/** Ghost-fire's three layers: fire.ts's tongues, burning green. */
const GF_OUT = 0x3f9a3a, GF_MID = 0x8fe05a, GF_CORE = 0xeaffc8;

/** The green drawn in to the sceptre, spiralling as it comes. */
const MOTE: SparkStyle = { palette: [0xf2ffe4, BILE, GREEN], gravity: 0, drag: 1, size: [6, 2], streak: true, swirl: 240 };
/** The miasma itself, lit: soft, swelling as it rolls and thins. */
const MIASMA: SparkStyle = { palette: [0xe4ffcc, BILE, GREEN, 0x4f9a48], gravity: -30, drag: 0.3, size: [9, 28], streak: false, swirl: 50 };
/** Fumes lifting off what it touches: smaller, rising, curling. */
const FUME: SparkStyle = { palette: [0xdaffc0, GREEN, 0x4f9a48], gravity: -70, drag: 0.5, size: [5, 13], streak: false, swirl: 90 };
/** Cinders of ghost-fire, lifting and going out. */
const CINDER: SparkStyle = { palette: [GHOST, BILE, GREEN], gravity: -170, drag: 0.55, size: [5, 1.5], streak: false };

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeOut = (x: number) => 1 - (1 - x) * (1 - x);
/** 0 -> 1 as `x` runs from `a` to `b`. */
const span = (x: number, a: number, b: number) => clamp01((x - a) / (b - a));

/** A glow sized to the board's squares (`flash` is sized in px). */
function flare(t: FxTools, p: Pt, size: number, color: number, peak: number, seconds: number) {
  t.glow({ x: p.x - size / 2, y: p.y - size / 2, w: size, h: size }, color, peak, seconds, 1);
}

/** A path stroked from `w0` wide at its start to `w1` at its end, in three
 *  round-capped runs — a wisp, not a wire. */
function taper(g: Graphics, pts: number[], w0: number, w1: number, color: number, alpha: number) {
  const n = pts.length / 2 - 1;
  if (n < 1 || alpha <= 0.01) return;
  for (let k = 0; k < 3; k++) {
    const i0 = Math.floor((k * n) / 3), i1 = Math.floor(((k + 1) * n) / 3);
    if (i1 <= i0) continue;
    g.moveTo(pts[2 * i0], pts[2 * i0 + 1]);
    for (let i = i0 + 1; i <= i1; i++) g.lineTo(pts[2 * i], pts[2 * i + 1]);
    const f = (k + 0.5) / 3;
    g.stroke({ width: w0 + (w1 - w0) * f, color, alpha, cap: "round", join: "round" });
  }
}

/** A tongue of ghost-fire, upright: fire.ts's flame burning green — deep at
 *  its edge, a pale core low down. */
function ghostFlame(g: Graphics, x: number, y: number, len: number, w: number, lean: number, a: number) {
  pyroTongue(g, x, y, 0, -1, len, w, lean, GF_OUT, 0.46 * a);
  pyroTongue(g, x, y, 0, -1, len * 0.72, w * 0.66, lean * 0.78, GF_MID, 0.6 * a);
  pyroTongue(g, x, y, 0, -1, len * 0.42, w * 0.36, lean * 0.45, GF_CORE, 0.8 * a);
}

/** Traces flat points up to fraction `f` of their length. */
function trace(g: Graphics, p: number[], f = 1) {
  const n = p.length / 2, reach = f * (n - 1), full = Math.min(n - 1, Math.floor(reach));
  g.moveTo(p[0], p[1]);
  for (let i = 1; i <= full; i++) g.lineTo(p[i * 2], p[i * 2 + 1]);
  const frac = reach - full;
  if (frac > 0 && full + 1 < n) {
    const i = full * 2;
    g.lineTo(p[i] + (p[i + 2] - p[i]) * frac, p[i + 1] + (p[i + 3] - p[i + 1]) * frac);
  }
}

// ── The drake's skull ────────────────────────────────────────────────────────
// Face on: a great burning socket either side of a long snout narrowing to its
// fangs, the crown swept up into horns, spikes off the cheekbones, and a lower
// jaw that drops away when it breathes. x across, y down from its middle, in
// units of its size; the left half is given, the right is the mirror.

/** Where a skull is: its middle, its size (px), and how far its jaw has
 *  dropped (in its own units). */
interface Skull { x: number; y: number; k: number; drop: number }

/** Its outline's left half, crown to the tip of the snout. */
const HEAD = [0, -0.44, -0.16, -0.42, -0.3, -0.33, -0.37, -0.18, -0.44, -0.04, -0.36, 0.06, -0.24, 0.12, -0.19, 0.28,
  -0.15, 0.42, -0.08, 0.5, 0, 0.51];
/** The lower jaw's left half, hinge to chin: it swings down from the hinge. */
const JAW = [-0.36, 0.08, -0.33, 0.28, -0.22, 0.48, -0.1, 0.6, 0, 0.62];
const HINGE = 0.08, CHIN = 0.62;
/** Horns off the crown, and spikes off the cheekbones: root -> bend -> tip,
 *  and how wide at the root. */
const HORNS = [[-0.24, -0.35, -0.64, -0.58, -0.5, -1.0, 0.17], [-0.42, -0.02, -0.58, 0.0, -0.7, 0.14, 0.08]];

/** A point of the skull, pushed onto `out` (`sx` -1 mirrors it). */
function at(f: Skull, x: number, y: number, out: number[], sx = 1) {
  out.push(f.x + x * sx * f.k, f.y + y * f.k);
}

/** A jaw point, swung down: the hinge stays, the chin drops by `drop`. */
const jawY = (f: Skull, y: number) => y + (f.drop * (y - HINGE)) / (CHIN - HINGE);

/** The whole head's outline, both halves. */
function headPts(f: Skull): number[] {
  const out: number[] = [];
  for (let i = 0; i < HEAD.length; i += 2) at(f, HEAD[i], HEAD[i + 1], out);
  for (let i = HEAD.length - 4; i >= 2; i -= 2) at(f, HEAD[i], HEAD[i + 1], out, -1);
  return out;
}

/** The lower jaw: the U of it, hinge round the chin to hinge — stroked open,
 *  or filled shut across the top for its hollow. */
function jawPts(f: Skull): number[] {
  const out: number[] = [];
  for (let i = 0; i < JAW.length; i += 2) at(f, JAW[i], jawY(f, JAW[i + 1]), out);
  for (let i = JAW.length - 4; i >= 0; i -= 2) at(f, JAW[i], jawY(f, JAW[i + 1]), out, -1);
  return out;
}

/** A horn on side `sx`: a curved spike tapering from its root to its tip. */
function horn(f: Skull, h: number[], sx: number): number[] {
  const [rx, ry, bx, by, tx, ty, w] = h, fwd: number[] = [], back: number[] = [];
  for (let i = 0; i <= 6; i++) {
    const q = i / 6, m = 1 - q;
    const x = m * m * rx + 2 * m * q * bx + q * q * tx, y = m * m * ry + 2 * m * q * by + q * q * ty;
    const dx = 2 * m * (bx - rx) + 2 * q * (tx - bx), dy = 2 * m * (by - ry) + 2 * q * (ty - by);
    const dl = Math.hypot(dx, dy) || 1, hw = (w / 2) * (1 - q);
    at(f, x - (dy / dl) * hw, y + (dx / dl) * hw, fwd, sx);
    at(f, x + (dy / dl) * hw, y - (dx / dl) * hw, back, sx);
  }
  for (let i = back.length - 2; i >= 0; i -= 2) fwd.push(back[i], back[i + 1]);
  return fwd;
}

/** An eye socket on side `sx`: an oval tilted up at its outer corner — it
 *  glares. */
function socket(f: Skull, sx: number): number[] {
  const out: number[] = [], tilt = 0.38;
  for (let i = 0; i < 14; i++) {
    const th = (i / 14) * TAU, ex = 0.125 * Math.cos(th), ey = 0.085 * Math.sin(th);
    at(f, -0.18 + ex * Math.cos(tilt) - ey * Math.sin(tilt), -0.1 + ex * Math.sin(tilt) + ey * Math.cos(tilt), out, sx);
  }
  return out;
}

/** The skull's hollow, on the dark layer: head, jaw and horns. */
function skullDark(g: Graphics, f: Skull, a: number) {
  if (a <= 0.01) return;
  g.poly(jawPts(f), true).fill({ color: INK, alpha: 0.5 * a });
  g.poly(headPts(f), true).fill({ color: INK, alpha: 0.55 * a });
  for (const sx of [1, -1]) for (const h of HORNS) g.poly(horn(f, h, sx), true).fill({ color: INK, alpha: 0.6 * a });
}

/** ...and its bone, lit: every edge in ghost light rimmed with violet, the
 *  brows, the nose, the fangs, the breath's light in its open mouth
 *  (`breath`), and the sockets burning (`eye`, 0..1 — fiercest as it
 *  breathes). */
function skullLit(g: Graphics, f: Skull, a: number, eye: number, breath: number) {
  if (a <= 0.01) return;
  const bone = (pts: number[], fill: number, closed = true) => {
    g.poly(pts, closed).stroke({ width: 7, color: LILAC, alpha: 0.26 * a, join: "round" });
    if (closed) g.poly(pts, true).fill({ color: GREEN, alpha: fill * a });
    g.poly(pts, closed).stroke({ width: 2, color: GHOST, alpha: 0.95 * a, join: "round" });
  };
  // The breath's light between the jaws, under everything else.
  if (breath > 0.01) {
    const m: number[] = [];
    at(f, 0, 0.47 + f.drop * 0.55, m);
    g.ellipse(m[0], m[1], f.k * 0.2, f.k * (0.06 + f.drop * 0.5)).fill({ color: BILE, alpha: 0.55 * breath * a });
    g.ellipse(m[0], m[1], f.k * 0.1, f.k * (0.03 + f.drop * 0.3)).fill({ color: 0xf4ffe0, alpha: 0.7 * breath * a });
  }
  // The jaw: its U, and its fangs standing up out of it as it drops.
  bone(jawPts(f), 0, false);
  for (const sx of [1, -1]) {
    for (const h of HORNS) bone(horn(f, h, sx), 0.16);
    const open = clamp01(f.drop / 0.12), fang: number[] = [];
    at(f, 0.13, jawY(f, 0.55), fang, sx);
    at(f, 0.12, jawY(f, 0.55) - 0.13, fang, sx);
    if (open > 0.05) g.moveTo(fang[0], fang[1]).lineTo(fang[2], fang[3]).stroke({ width: 2, color: GHOST, alpha: 0.9 * a * open, cap: "round" });
  }
  bone(headPts(f), 0.07);
  for (const sx of [1, -1]) {
    // A brow set in a scowl over each socket.
    const brow: number[] = [];
    at(f, -0.05, -0.19, brow, sx);
    at(f, -0.35, -0.3, brow, sx);
    g.moveTo(brow[0], brow[1]).lineTo(brow[2], brow[3]).stroke({ width: 2.4, color: GHOST, alpha: 0.9 * a, cap: "round" });
    // The upper fangs, long, and the teeth between them.
    const fangs: number[] = [];
    at(f, 0.1, 0.44, fangs, sx);
    at(f, 0.085, 0.62, fangs, sx);
    at(f, 0.035, 0.49, fangs, sx);
    at(f, 0.035, 0.56, fangs, sx);
    g.moveTo(fangs[0], fangs[1]).lineTo(fangs[2], fangs[3]).moveTo(fangs[4], fangs[5]).lineTo(fangs[6], fangs[7])
      .stroke({ width: 2, color: GHOST, alpha: 0.95 * a, cap: "round" });
    // The nose.
    const nose: number[] = [];
    at(f, 0.055, 0.3, nose, sx);
    g.ellipse(nose[0], nose[1], f.k * 0.028, f.k * 0.05).fill({ color: BILE, alpha: 0.8 * a });
    // The socket, burning: ember, with a white-hot heart.
    const sk = socket(f, sx), c: number[] = [];
    at(f, -0.18, -0.1, c, sx);
    g.circle(c[0], c[1], f.k * 0.22).fill({ color: AMBER, alpha: 0.2 * a * (0.5 + 0.5 * eye) });
    g.poly(sk, true).fill({ color: AMBER, alpha: (0.55 + 0.45 * eye) * a }).stroke({ width: 1.5, color: GHOST, alpha: 0.85 * a });
    g.circle(c[0], c[1], f.k * 0.045).fill({ color: 0xfff4d6, alpha: a * eye });
  }
}

/** A crack in the ground from `c`: a jagged run out along `ang`, `len` long,
 *  and a branch off it — two paths, flat points. */
function crack(c: Pt, ang: number, len: number): number[][] {
  const main: number[] = [c.x, c.y];
  let x = c.x, y = c.y, a = ang;
  for (let i = 0; i < 5; i++) {
    a += rand(-0.5, 0.5);
    x += (Math.cos(a) * len) / 5;
    y += (Math.sin(a) * len) / 5;
    main.push(x, y);
  }
  const j = 2 * (1 + Math.floor(rand(0, 3))), b = ang + (Math.random() < 0.5 ? -1 : 1) * rand(0.6, 1.1), bl = len * rand(0.3, 0.5);
  return [main, [main[j], main[j + 1], main[j] + Math.cos(b + 0.2) * bl * 0.5, main[j + 1] + Math.sin(b + 0.2) * bl * 0.5,
    main[j] + Math.cos(b) * bl, main[j + 1] + Math.sin(b) * bl]];
}

/** THE MIASMA breaking over a card it reaches: a stain of it clinging, dark,
 *  lit sickly green, wisps curling up off it and fumes rising — what stays is
 *  the DOT. */
function engulf(t: FxTools, r: Box, power: number) {
  const c = centre(r), s = Math.min(r.w, r.h), k = Math.max(0.8, Math.min(1.4, 0.5 + power)), v = s / 90, seed = rand(0, TAU);
  const D = 0.62;
  t.draw(D, (g, u) => {
    const rr = s * 0.3 * k * (0.5 + 0.5 * easeOut(span(u, 0, 0.25))) * (1 - 0.3 * span(u, 0.5, 1));
    g.circle(c.x, c.y, rr * 0.6);
    for (let i = 0; i < 6; i++) {
      const a = seed + i * 1.05 + u * 1.2;
      g.circle(c.x + Math.cos(a) * rr * 0.5, c.y + Math.sin(a) * rr * 0.45, rr * (0.38 + 0.08 * (i % 3)));
    }
    g.fill({ color: INK, alpha: 0.42 * (1 - span(u, 0.4, 1)) });
  }, { dark: true });
  t.draw(D, (g, u) => {
    const fade = 1 - span(u, 0.35, 1);
    for (let i = 0; i < 3; i++) {
      const x0 = c.x + (i - 1) * s * 0.2, grow = easeOut(span(u, 0.06 * i, 0.5 + 0.06 * i));
      if (grow <= 0) continue;
      const pts: number[] = [];
      for (let j = 0; j <= 8; j++) {
        const q = (j / 8) * grow;
        pts.push(x0 + Math.sin(q * 6 + seed + i * 2 + u * 5) * s * 0.08, c.y + s * 0.18 - q * s * 0.7);
      }
      taper(g, pts, 3.2, 0.8, BILE, 0.8 * fade);
    }
  });
  flare(t, c, s * 1.2, BILE, 0.38, 0.45);
  for (let i = 0; i < 6; i++) {
    const a = rand(0, TAU), d = rand(0, 0.25) * s;
    t.spark(c.x + Math.cos(a) * d, c.y + Math.sin(a) * d, Math.cos(a) * 30 * v, Math.sin(a) * 30 * v - 20 * v, rand(0.45, 0.7), MIASMA);
  }
  for (let i = 0; i < Math.round(9 * k); i++) {
    const a = rand(0, TAU), d = rand(0, 0.3) * s;
    t.spark(c.x + Math.cos(a) * d, c.y + Math.sin(a) * d, rand(-30, 30) * v, -rand(40, 110) * v, rand(0.5, 0.85), FUME, c);
  }
}

export const SKULLKING: Signature = {
  shake: 1,
  // He does not close on anything: he raises the sceptre where he stands,
  // and what he raises does the rest.
  lunge: false,

  deliver(t: FxTools, m: SigMoment, seconds: number) {
    const s = m.size, c = centre(m.from), T = seconds, seed = rand(0, 100);
    // The sceptre: bone, in his right hand, RAISED — up out of the card, its
    // crowned skull high over it.
    const hand = { x: c.x + s * 0.26, y: c.y + s * 0.28 };
    const headAt = (u: number): Pt => {
      const r = easeOut(span(u, 0, 0.45));
      return { x: c.x + s * 0.33, y: c.y + s * (0.05 - 0.63 * r) };
    };
    t.draw(T, (g, u) => {
      const h = headAt(u), a = Math.min(1, u * 5), r = s * 0.08;
      g.moveTo(hand.x, hand.y).lineTo(h.x, h.y).stroke({ width: 7, color: LILAC, alpha: 0.28 * a, cap: "round" });
      g.moveTo(hand.x, hand.y).lineTo(h.x, h.y).stroke({ width: 2.8, color: BONE, alpha: 0.95 * a, cap: "round" });
      g.circle(h.x, h.y, r).fill({ color: BONE, alpha: 0.9 * a });
      g.moveTo(h.x - r * 0.9, h.y - r * 0.7).lineTo(h.x - r * 0.6, h.y - r * 1.6).lineTo(h.x, h.y - r * 0.9)
        .lineTo(h.x + r * 0.6, h.y - r * 1.6).lineTo(h.x + r * 0.9, h.y - r * 0.7).stroke({ width: 1.6, color: AMBER, alpha: 0.9 * a });
      g.circle(h.x - r * 0.38, h.y - r * 0.05, r * 0.25).fill({ color: AMBER, alpha: a });
      g.circle(h.x + r * 0.38, h.y - r * 0.05, r * 0.25).fill({ color: AMBER, alpha: a });
    });
    // Ghost-fire kindling on the skull, and growing — a torch of it by the
    // time he strikes.
    t.draw(T, (g, u) => {
      const h = headAt(u), time = u * T, k = easeOut(span(u, 0.1, 1));
      if (k <= 0) return;
      for (let i = 0; i < 3; i++) {
        const x = h.x + (i - 1) * s * 0.075, len = s * (0.22 + 0.26 * k) * (1 + 0.25 * pyroFlick(time, seed + i * 3));
        ghostFlame(g, x, h.y + s * 0.03, len * (i === 1 ? 1.25 : 0.8), s * 0.15, len * 0.2 * pyroFlick(time * 0.8, seed + i), k);
      }
    });
    t.charge(headAt(1), s * 1.1, BILE, 0.55, T);
    // The register opened: green drawn in to the sceptre from all round,
    // spiralling as it comes...
    let acc = 0;
    t.draw(T, (_g, u, dt) => {
      acc += 70 * dt;
      for (; acc >= 1; acc--) {
        const h = headAt(Math.min(1, u + 0.15)), a = rand(0, TAU), r = s * rand(0.55, 0.95), life = rand(0.22, 0.34);
        const ca = Math.cos(a), sa = Math.sin(a), sp = r / life;
        t.spark(h.x + ca * r, h.y + sa * r, (-ca - sa * 0.4) * sp, (-sa + ca * 0.4) * sp, life, MOTE, h);
      }
    });
    // ...his shadow pooling under him, lit at its rim, and tendrils of it
    // creeping in to him from round his square.
    t.draw(T, (g, u) => {
      const rr = s * 0.46 * easeOut(span(u, 0, 0.6));
      g.circle(c.x, c.y + s * 0.1, rr * 0.7);
      for (let i = 0; i < 5; i++) {
        const a = i * 1.26 + seed;
        g.circle(c.x + Math.cos(a) * rr * 0.4, c.y + s * 0.1 + Math.sin(a) * rr * 0.3, rr * 0.5);
      }
      g.fill({ color: INK, alpha: 0.55 });
    }, { dark: true });
    const base = rand(0, TAU);
    t.draw(T, (g, u) => {
      const rr = s * 0.46 * easeOut(span(u, 0, 0.6)), k = easeOut(u), a = Math.min(1, u * 4);
      if (rr > 1) g.ellipse(c.x, c.y + s * 0.1, rr * 1.05, rr * 0.85).stroke({ width: 2, color: GREEN, alpha: 0.7 * a });
      for (let i = 0; i < 4; i++) {
        const ang = base + (i / 4) * TAU + k * 1.1, root = s * (0.95 - 0.35 * k), tip = s * (0.9 - 0.7 * k), pts: number[] = [];
        for (let j = 0; j <= 7; j++) {
          const q = j / 7, r = root + (tip - root) * q, w = ang + 0.45 * q + 0.12 * Math.sin(q * 6 + u * 9 + i);
          pts.push(c.x + Math.cos(w) * r, c.y + Math.sin(w) * r);
        }
        taper(g, pts, 2.8, 0.8, GREEN, 0.75 * a);
      }
    });
  },

  land(t: FxTools, m: SigMoment) {
    const s = m.size, v = s / 90, seed = rand(0, 100);
    const home = centre(m.from), ax = m.ahead.x, ay = m.ahead.y, cx = -ay, cy = ax;
    // Where the drake rises: its own square — or, with no room to raise one,
    // the King's.
    const grave = m.spawned.length ? centre(m.spawned[0]) : home;

    // The row it breathes on: through the cards it reaches, or the row ahead
    // of the King when it reaches none — `along` it, and how far ahead.
    const proj = (p: Pt) => ({ along: (p.x - home.x) * cx + (p.y - home.y) * cy, depth: (p.x - home.x) * ax + (p.y - home.y) * ay });
    const hits = m.targets.map((r, i) => ({ r, ...proj(centre(r)), power: m.power[i] ?? 0.55, killed: !!m.killed[i] }));
    const depth = hits.length ? hits.reduce((n, h) => n + h.depth, 0) / hits.length : s * 1.08;
    let lo: number, hi: number;
    if (hits.length) {
      lo = Math.min(...hits.map((h) => h.along)) - s * 0.5;
      hi = Math.max(...hits.map((h) => h.along)) + s * 0.5;
    } else {
      const b = m.board, ends = [b.x, b.x + b.w].flatMap((x) => [b.y, b.y + b.h].map((y) => proj({ x, y }).along));
      lo = Math.min(...ends) + s * 0.1;
      hi = Math.max(...ends) - s * 0.1;
    }
    const row = (along: number): Pt => ({ x: home.x + cx * along + ax * depth, y: home.y + cy * along + ay * depth });
    // Where the breath falls on it: straight ahead of the grave.
    const j0 = Math.max(lo, Math.min(hi, proj(grave).along)), J = row(j0);

    // THE GROUND CRACKS: jagged runs out from the grave, dark, lit green from
    // below, the light welling up through them.
    const cracks: number[][] = [];
    const a0 = rand(0, TAU);
    for (let i = 0; i < 6; i++) cracks.push(...crack(grave, a0 + (i / 6) * TAU + rand(-0.3, 0.3), s * rand(0.34, 0.48)));
    const CR = 1.0;
    t.draw(CR, (g, u) => {
      const time = u * CR, f = easeOut(span(time, 0, 0.16)), fade = 1 - span(time, 0.6, CR);
      for (const p of cracks) trace(g, p, f);
      g.stroke({ width: 5, color: INK, alpha: 0.85 * fade, cap: "round", join: "round" });
    }, { dark: true });
    t.draw(CR, (g, u) => {
      const time = u * CR, f = easeOut(span(time, 0, 0.16)), fade = 1 - span(time, 0.6, CR);
      const pulse = 0.75 + 0.25 * Math.sin(time * 30);
      for (const p of cracks) trace(g, p, f);
      g.stroke({ width: 8, color: GREEN, alpha: 0.22 * fade, cap: "round", join: "round" });
      for (const p of cracks) trace(g, p, f);
      g.stroke({ width: 2, color: BILE, alpha: pulse * fade, cap: "round", join: "round" });
    });
    flare(t, grave, s * 1.2, BILE, 0.45, 0.4);

    // GHOST-FIRE rising out of the cracks and gathering into the skull, which
    // drops its jaw, breathes — its head thrown toward the row — and burns
    // away.
    const BREATH = 0.26;
    const tx = J.x - grave.x, ty = J.y - grave.y, tl = Math.hypot(tx, ty) || 1;
    const skull = (time: number): Skull => {
      const rise = easeOut(span(time, 0.05, 0.25)), lunge = Math.sin(Math.PI * span(time, BREATH - 0.04, BREATH + 0.32));
      return {
        x: grave.x + (tx / tl) * lunge * s * 0.1,
        y: grave.y + (ty / tl) * lunge * s * 0.1 + s * (0.12 - 0.24 * rise) - s * 0.12 * span(time, 0.85, 1.2),
        k: s * 0.52 * (0.7 + 0.3 * rise),
        drop: 0.26 * easeOut(span(time, BREATH - 0.05, BREATH + 0.05)) * (1 - span(time, 0.72, 0.98)),
      };
    };
    const shown = (time: number) => span(time, 0.07, 0.21) * (1 - span(time, 0.88, 1.2));
    const eye = (time: number) => 0.35 + 0.65 * span(time, BREATH - 0.08, BREATH) * (1 - span(time, 0.72, 1.0));
    const breath = (time: number) => span(time, BREATH - 0.02, BREATH + 0.06) * (1 - span(time, 0.6, 0.9));
    const D = 1.2;
    t.draw(D, (g, u) => { const time = u * D; skullDark(g, skull(time), shown(time)); }, { dark: true });
    t.draw(D, (g, u) => {
      const time = u * D, f = skull(time), a = shown(time);
      // The column of fire out of the grave, burning down as the skull forms...
      const col = span(time, 0.0, 0.07) * (1 - span(time, 0.17, 0.32));
      if (col > 0.01)
        for (let i = 0; i < 5; i++) {
          const x = grave.x + (i - 2) * s * 0.14, len = s * (0.42 + 0.25 * (1 - Math.abs(i - 2) / 2)) * (1 + 0.3 * pyroFlick(time, seed + i * 2));
          ghostFlame(g, x, grave.y + s * 0.24, len * col, s * 0.17, len * 0.25 * pyroFlick(time * 0.7, seed + i), col);
        }
      // ...and still licking up off its crown once it has.
      if (a > 0.01)
        for (const [x0, y0, n] of [[0, -0.42, 0], [-0.24, -0.36, 1], [0.24, -0.36, 2]]) {
          const b: number[] = [];
          at(f, x0, y0, b);
          const len = f.k * (n ? 0.3 : 0.42) * (1 + 0.3 * pyroFlick(time, seed + 7 + n));
          ghostFlame(g, b[0], b[1], len, f.k * 0.2, len * 0.3 * pyroFlick(time * 0.8, seed + n * 1.7), a * 0.75);
        }
      skullLit(g, f, a, eye(time), breath(time));
    });
    let cinder = 0;
    t.draw(0.95, (_g, u, dt) => {
      cinder += 26 * dt;
      for (; cinder >= 1; cinder--) {
        const f = skull(u * 0.95);
        t.spark(f.x + rand(-0.45, 0.45) * f.k, f.y + rand(-0.5, 0.3) * f.k, rand(-20, 20) * v, -rand(40, 100) * v, rand(0.4, 0.7), CINDER);
      }
    }, { delay: 0.05 });

    // THE BREATH: out of the skull and onto the row, where it falls — a
    // stream of miasma, dark in its body and sickly green lit through it.
    const POUR = 0.12, SPREAD = 0.28, far = Math.max(j0 - lo, hi - j0, 1);
    const reachAt = (w: number) => far * easeOut(clamp01(w / SPREAD));
    const stream = (g: Graphics, u: number, dark: boolean) => {
      const time = BREATH + u * 0.32, f = skull(time), o = { x: f.x, y: f.y + f.k * 0.3 };
      const reach = easeOut(span(u * 0.32, 0, POUR)), a = 1 - span(u, 0.55, 1);
      for (let i = 0; i <= 7; i++) {
        const q = (i / 7) * reach, px = o.x + (J.x - o.x) * q, py = o.y + (J.y - o.y) * q;
        const wob = Math.sin(i * 2.1 + seed + u * 8) * s * 0.05;
        g.circle(px - (ty / tl) * wob, py + (tx / tl) * wob, s * (0.1 + 0.16 * q));
      }
      g.fill({ color: dark ? INK : GREEN, alpha: (dark ? 0.3 : 0.14) * a });
    };
    t.draw(0.32, (g, u) => stream(g, u, true), { dark: true, delay: BREATH });
    let pour = 0;
    t.draw(0.32, (g, u, dt) => {
      stream(g, u, false);
      if (u > 0.7) return;
      const f = skull(BREATH + u * 0.32), o = { x: f.x, y: f.y + f.k * 0.3 }, d = Math.hypot(J.x - o.x, J.y - o.y);
      pour += 120 * dt;
      for (; pour >= 1; pour--) {
        const ang = Math.atan2(J.y - o.y, J.x - o.x) + rand(-0.25, 0.25), sp = (d / 0.22) * rand(0.7, 1.1);
        t.spark(o.x, o.y, Math.cos(ang) * sp, Math.sin(ang) * sp, rand(0.25, 0.45), MIASMA);
      }
    }, { delay: BREATH });

    // THE WAVE: from where it falls, a rolling bank of miasma running along
    // the row both ways — lumpy, never beads on a string — dark in its body,
    // lit green through it, a bright lip curling at each running front, and
    // miasma boiling off all of it.
    const W0 = BREATH + POUR, WD = 0.8;
    const bankN = Math.max(6, Math.round((hi - lo) / (s * 0.11)));
    const puffs = Array.from({ length: bankN }, (_, i) => ({
      al: lo + ((i + rand(-0.4, 0.4)) / (bankN - 1)) * (hi - lo), off: rand(-0.14, 0.14), r: rand(0.15, 0.27), ph: rand(0, TAU),
    }));
    const bank = (w: number, dark: boolean, g: Graphics) => {
      const d = reachAt(w), fade = 1 - span(w, 0.3, WD);
      if (fade <= 0) return;
      for (const p of puffs) {
        const past = d - Math.abs(p.al - j0);
        if (past <= 0) continue;
        const grow = 0.45 + 0.55 * clamp01(past / (s * 0.5)), pt = row(p.al), boil = 1 + 0.1 * Math.sin(p.ph + w * 11);
        const o = s * (p.off + 0.04 * Math.sin(p.ph + w * 6));
        g.circle(pt.x + ax * o, pt.y + ay * o, s * p.r * grow * boil * (dark ? 1 : 0.85));
      }
      g.fill({ color: dark ? INK : GREEN, alpha: (dark ? 0.26 : 0.12) * fade });
    };
    t.draw(WD, (g, u) => bank(u * WD, true, g), { dark: true, delay: W0 });
    let roll = 0, boil = 0;
    t.draw(WD, (g, u, dt) => {
      const w = u * WD, d = reachAt(w), fade = 1 - span(w, 0.3, WD);
      bank(w, false, g);
      for (const dir of [-1, 1]) {
        const room = dir < 0 ? j0 - lo : hi - j0;
        const lip = fade * (1 - span(d - room, 0, s * 0.3)) * (1 - span(w, SPREAD, SPREAD + 0.12));
        if (room < s * 0.3 || lip <= 0.01) continue;
        const p = row(j0 + dir * Math.min(d, room)), pts: number[] = [];
        for (let i = 0; i <= 8; i++) {
          const q = i / 8, th = q * 2.6, r = s * 0.3 * (1 - 0.45 * q);
          const X = Math.sin(th) * r * dir, Y = -Math.cos(th) * r;
          pts.push(p.x + cx * X + ax * Y, p.y + cy * X + ay * Y);
        }
        taper(g, pts, 5, 1.2, BILE, 0.9 * lip);
        // The front sheds miasma as it rolls.
        roll += 80 * lip * dt;
        for (; roll >= 1; roll--) {
          const sp = (far / SPREAD) * rand(0.2, 0.6);
          t.spark(p.x + ax * rand(-0.25, 0.25) * s, p.y + ay * rand(-0.25, 0.25) * s, cx * dir * sp, cy * dir * sp - rand(10, 40) * v, rand(0.35, 0.6), MIASMA);
        }
      }
      // Miasma boiling up off the whole length it covers.
      if (w < 0.55) {
        boil += 60 * dt;
        for (; boil >= 1; boil--) {
          const p = row(Math.max(lo, j0 - d) + rand(0, 1) * (Math.min(hi, j0 + d) - Math.max(lo, j0 - d)));
          t.spark(p.x + ax * rand(-0.2, 0.2) * s, p.y + ay * rand(-0.2, 0.2) * s, rand(-20, 20) * v, -rand(20, 50) * v, rand(0.4, 0.7), MIASMA);
        }
      }
    }, { delay: W0 });
    t.later(W0, () => flare(t, J, s * 1.1, BILE, 0.35, 0.35));

    // Where the bank reaches a card, it breaks over it and clings.
    for (const h of hits) {
      const d = Math.min(1, Math.abs(h.along - j0) / far);
      t.later(W0 + SPREAD * (1 - Math.sqrt(1 - d)), () => engulf(t, h.r, h.power + (h.killed ? 0.4 : 0)));
    }
  },
};
