/** SKELIDER — Piercing Charge. "Ride up to 4 slots in any direction toward
 *  your target and deal 15 DMG (PEN) to it." It rides up to four slots to put
 *  a lance through its target.
 *
 *  Its art is a skeletal knight in black plate on a SKELETON HORSE, a long
 *  lance couched, violet fire in the eye sockets, charging over a field of
 *  skulls. So the DELIVERY is the ride: violet ghost-fire flares under its
 *  card and the bone horse comes up out of it, then gallops the line from
 *  where it stood to where it pulls up — a horse's skull in profile with fire
 *  in the socket, a neck of vertebrae, a ribcage with nothing in it, legs of
 *  bare bone reaching at the gallop, and the black-armoured rider hunched
 *  over the withers with the lance levelled at the target the whole way.
 *  Every stride stamps a hoofprint of violet ghost-fire that burns on behind
 *  it; grave dust and chips of bone kick up off the line. It rides the REAL
 *  line, `m.from` to `m.to` — up the board, down it, or across it — so a
 *  sideways charge is drawn sideways.
 *
 *  The LANDING is the lance going through: one long violet-white lance driven
 *  straight THROUGH the card and out of its far side (PEN: the armour is not
 *  consulted), a hard punch where it enters, splinters of bone sprayed out of
 *  the exit, and a skull of violet smoke bursting off the card and rising as
 *  it comes apart. On a kill the card cracks like old bone and shatters.
 *
 *  One rider, one lance, one straight line. Where the Shadow Horsemen are a
 *  stampede of smoke, Skelider is BONE: pale, hard-edged and exact. Darkness
 *  is drawn for real (`dark: true`) and every dark shape carries a lit edge,
 *  so the rider reads over an empty square. */
import { centre, rand } from "../../looks/base";
import { pyroFlick, pyroTongue } from "../../looks/fire";
import type { Graphics } from "pixi.js";
import type { FxTools, Pt, SparkStyle } from "../../looks/types";
import type { Signature, SigMoment } from "../types";

type Box = SigMoment["from"];

const TAU = Math.PI * 2;
const PALE = 0xf3e8ff, LILAC = 0xc9a6ff, VIOLET = 0x9a6ad8, PURPLE = 0x7b4fb0, DEEP = 0x4a2a78;
/** The shadow itself — only ever on the dark layer. */
const INK = 0x0b0418;
/** Old bone, warm against all that violet, and its shade. */
const BONE = 0xf0e6d6, BONE_DIM = 0xbcb0c4;
/** The hottest of the ghost-fire. */
const GHOST = 0xe0b8ff;

/** Grave dust kicked off the line: grey-violet, swelling as it hangs. */
const DUST: SparkStyle = { palette: [BONE_DIM, 0x9a8eae, 0x6a5e84], gravity: -25, drag: 0.45, size: [3, 8], streak: false };
/** Chips of bone flicked up by the hooves, and splinters out of a wound. */
const CHIP: SparkStyle = { palette: [0xffffff, BONE, BONE_DIM], gravity: 760, drag: 0.6, size: [4, 1.5], streak: true };
/** What a shattered card comes apart into: heavier, tumbling. */
const SHARD: SparkStyle = { palette: [BONE, BONE, BONE_DIM, 0x8a7e98], gravity: 900, drag: 0.7, size: [5.5, 2.5], streak: false };
/** Torn out of the far side of the card the lance went through. */
const THROUGH: SparkStyle = { palette: [PALE, LILAC, VIOLET, PURPLE], gravity: 0, drag: 0.35, size: [8, 3], streak: true };
/** The smoke the skull comes apart into. */
const SMOKE: SparkStyle = { palette: [LILAC, VIOLET, PURPLE, DEEP], gravity: -60, drag: 0.4, size: [4, 12], streak: false };
/** Cinders off the ghost-fire, rising. */
const CINDER = [PALE, GHOST, VIOLET, PURPLE];

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeOut = (x: number) => 1 - (1 - x) * (1 - x);
/** 0 -> 1 as `u` runs from `a` to `b`. */
const span = (u: number, a: number, b: number) => clamp01((u - a) / (b - a));
const unit = (x: number, y: number, fb: Pt): Pt => {
  const l = Math.hypot(x, y);
  return l > 1e-6 ? { x: x / l, y: y / l } : fb;
};

// ── The ride ────────────────────────────────────────────────────────────────

/** Fraction of the delivery spent coming up out of the ghost-fire. */
const RISE = 0.16;
/** The gallop: radians of stride per second. */
const GALLOP = 24;

/** Everything the delivery and the landing agree on: the line it rides
 *  (`a` to `stop`), which way it faces, where the target is and how long the
 *  lance is. When it was already beside its target there is no ride to draw,
 *  so it surges a third of a square at it instead — still a charge. */
function ride(m: SigMoment) {
  const s = m.size, a = centre(m.from), cT = centre(m.to);
  const p = m.targets.length ? centre(m.targets[0]) : { x: cT.x + m.ahead.x * s * 1.08, y: cT.y + m.ahead.y * s * 1.08 };
  let stop = cT, L = Math.hypot(cT.x - a.x, cT.y - a.y);
  if (L < s * 0.3) {
    const at = unit(p.x - a.x, p.y - a.y, m.ahead);
    stop = { x: a.x + at.x * s * 0.3, y: a.y + at.y * s * 0.3 };
    L = s * 0.3;
  }
  const dir = unit(stop.x - a.x, stop.y - a.y, m.ahead);
  const aim = unit(p.x - stop.x, p.y - stop.y, dir);
  // A horse reads in profile — the way a chess knight is drawn — so it faces
  // the side it rides to (straight up or down the board: right), its nose
  // tipped into the charge. Picked once, so it never flips mid-ride.
  const side = dir.x < -0.05 ? -1 : dir.x > 0.05 ? 1 : aim.x < -0.05 ? -1 : 1;
  const U = s * 0.5;
  // The lance reaches from the horse to the target's near edge as it pulls up.
  const lance = Math.max(s * 0.32, Math.hypot(p.x - stop.x, p.y - stop.y) - s * 0.46);
  /** Distance along the line, `u` into the delivery: still while it rises,
   *  then quickening all the way to the stop. */
  const along = (u: number) => { const f = span(u, RISE, 1); return L * f * (0.35 + 0.65 * f); };
  const at = (d: number): Pt => ({ x: a.x + dir.x * d, y: a.y + dir.y * d });
  return { s, a, stop, p, L, dir, aim, side, U, lance, along, at };
}

type Ride = ReturnType<typeof ride>;
type Frame = (f: number, h: number) => Pt;

/** The horse's own frame at `o`: `f` forward along its nose, `h` up its
 *  back, in units of U. Nose tipped toward the ride, pitched by the gallop. */
function frame(R: Ride, o: Pt, pitch: number): Frame {
  let fx = R.side + R.dir.x * 0.8, fy = R.dir.y * 0.8;
  const fl = Math.hypot(fx, fy) || 1;
  fx /= fl;
  fy /= fl;
  const c = Math.cos(pitch), sn = Math.sin(pitch);
  const gx = fx * c - fy * sn, gy = fx * sn + fy * c;
  // Its back is whichever side of it faces up the screen.
  const hx = gx > 0 ? gy : -gy, hy = gx > 0 ? -gx : gx;
  return (f, h) => ({ x: o.x + gx * (f + 0.05) * R.U + hx * (h - 0.4) * R.U, y: o.y + gy * (f + 0.05) * R.U + hy * (h - 0.4) * R.U });
}

/** The horse's skull in profile, muzzle forward: a long face off a rounded
 *  cranium, the jaw under it. */
const SKULL = [0.56, 0.62, 0.68, 0.76, 0.86, 0.7, 1.02, 0.54, 1.16, 0.4, 1.22, 0.32, 1.16, 0.26, 1.0, 0.27, 0.86, 0.31, 0.74, 0.36, 0.62, 0.46];
/** The rider: a hunched back of black plate, shoulders over the withers. */
const RIDER = [-0.5, 0.5, -0.12, 0.52, 0.04, 0.82, -0.04, 1.0, -0.26, 1.02, -0.44, 0.8];
/** Its tattered cloak, streaming back off the shoulders. */
const CLOAK = [-0.2, 1.0, -0.62, 0.98, -1.0, 0.82, -1.18, 0.62, -0.86, 0.66, -0.66, 0.56, -0.44, 0.6];

const pts = (P: Frame, list: number[]) => {
  const out: number[] = [];
  for (let i = 0; i < list.length; i += 2) { const q = P(list[i], list[i + 1]); out.push(q.x, q.y); }
  return out;
};

/** A leg at the gallop: hip, knee, hoof, in the horse's frame. Each pair
 *  reaches and folds a little out of step, the hind pair half a stride off
 *  the fore. */
function leg(hipF: number, hipH: number, ph: number, fore: boolean): number[] {
  const swing = Math.sin(ph), fold = Math.max(0, Math.sin(ph + 1.7));
  const a1 = fore ? 0.3 + 0.7 * swing : -0.15 + 0.6 * swing;
  const a2 = fore ? a1 - 1.1 * fold : a1 + 0.9 * fold - 0.35;
  const kf = hipF + Math.sin(a1) * 0.4, kh = hipH - Math.cos(a1) * 0.4;
  return [hipF, hipH, kf, kh, kf + Math.sin(a2) * 0.42, kh - Math.cos(a2) * 0.42];
}

/** The pose `time` into the gallop, at `o`: the frame and the four legs.
 *  `gallop` 0..1 is how hard it runs (0: standing). */
function pose(R: Ride, o: Pt, time: number, gallop: number) {
  const ph = time * GALLOP * gallop;
  const lift = 0.07 * Math.abs(Math.sin(ph)) * gallop;
  const P0 = frame(R, o, 0.07 * Math.sin(ph + 0.6) * gallop);
  const P: Frame = (f, h) => P0(f, h + lift);
  const legs = [
    leg(0.02, 0.24, ph, true), leg(0.1, 0.24, ph + 0.7, true),
    leg(-0.82, 0.3, ph + Math.PI, false), leg(-0.74, 0.3, ph + Math.PI + 0.7, false),
  ];
  return { P, legs };
}

type Pose = ReturnType<typeof pose>;

/** The dark of the horse and its rider: the skull, the ghost of a body round
 *  the bones, the rider's plate and cloak. */
function horseShadow(g: Graphics, q: Pose, U: number, a: number) {
  if (a <= 0.01) return;
  const P = q.P;
  // The body it no longer has: a smudge of dark round the ribs and spine.
  const b = P(-0.4, 0.32), n = P(0.32, 0.52), hd = P(-0.08, 1.1);
  g.circle(b.x, b.y, U * 0.5).fill({ color: INK, alpha: 0.5 * a });
  g.circle(n.x, n.y, U * 0.26).fill({ color: INK, alpha: 0.45 * a });
  g.poly(pts(P, SKULL)).fill({ color: INK, alpha: 0.85 * a });
  g.poly(pts(P, CLOAK)).fill({ color: INK, alpha: 0.8 * a });
  g.poly(pts(P, RIDER)).fill({ color: INK, alpha: 0.92 * a });
  g.circle(hd.x, hd.y, U * 0.15).fill({ color: INK, alpha: 0.92 * a });
}

/** The light of it: bone, rimmed plate, the eyes, the ghost-fire mane and
 *  tail, and the lance from the rider's hands to `tip`. */
function horseLight(g: Graphics, q: Pose, U: number, tip: Pt, lw: number, time: number, a: number) {
  if (a <= 0.01) return;
  const P = q.P;
  const line = (list: number[], w: number, color: number, al: number) =>
    g.poly(pts(P, list), false).stroke({ width: w, color, alpha: al * a, cap: "round", join: "round" });

  // The ghost-fire: a mane down the neck and a tail off the croup, streaming
  // back from the charge and licking up the screen.
  const back = P(-1, 0.25), base = P(0, 0.25);
  const bl = Math.hypot(back.x - base.x, back.y - base.y) || 1;
  const fx = ((back.x - base.x) / bl) * 0.75, fy = ((back.y - base.y) / bl) * 0.75 - 0.55, fl = Math.hypot(fx, fy) || 1;
  const fire = (f: number, h: number, len: number, seed: number) => {
    const o = P(f, h), hh = len * U * (1 + 0.3 * pyroFlick(time, seed)), lean = hh * 0.3 * pyroFlick(time * 0.8, seed + 2);
    pyroTongue(g, o.x, o.y, fx / fl, fy / fl, hh, U * 0.22, lean, PURPLE, 0.55 * a);
    pyroTongue(g, o.x, o.y, fx / fl, fy / fl, hh * 0.65, U * 0.13, lean * 0.7, GHOST, 0.6 * a);
  };
  for (let i = 0; i < 4; i++) fire(0.12 + 0.12 * i, 0.5 + 0.03 * i, 0.55 - 0.05 * i, i * 1.9);
  fire(-0.92, 0.42, 0.8, 7.3);

  // The body's ghost, faintly lit from within.
  const b = P(-0.4, 0.32);
  g.circle(b.x, b.y, U * 0.5).fill({ color: DEEP, alpha: 0.22 * a });

  // Bone: spine, ribs, pelvis, neck, legs.
  line([0.04, 0.46, -0.3, 0.5, -0.6, 0.48, -0.9, 0.42], lw * 1.3, BONE, 0.95);
  for (let i = 0; i < 4; i++) {
    const f = -0.12 - 0.15 * i;
    line([f, 0.49, f - 0.08, 0.3, f + 0.02, 0.1, f + 0.12, 0.04], lw, BONE, 0.85);
  }
  line([0.06, 0.06, -0.5, 0.08], lw * 0.8, BONE_DIM, 0.7);
  g.poly(pts(P, [-0.7, 0.5, -0.98, 0.5, -1.0, 0.3, -0.8, 0.26]), true).stroke({ width: lw, color: BONE, alpha: 0.85 * a, join: "round" });
  for (let i = 0; i < 5; i++) {
    const v = P(0.06 + 0.12 * i, 0.47 + 0.03 * i + 0.02 * Math.sin(i * 1.3));
    g.circle(v.x, v.y, U * 0.055).fill({ color: BONE, alpha: 0.9 * a });
  }
  for (const L of q.legs) {
    line(L, lw * 1.35, BONE, 0.95);
    const k = P(L[2], L[3]), h = P(L[4], L[5]);
    g.circle(k.x, k.y, U * 0.05).fill({ color: BONE, alpha: 0.9 * a });
    g.circle(h.x, h.y, U * 0.06).fill({ color: GHOST, alpha: 0.9 * a });
  }

  // The skull: lit bone round the dark, two spikes off the crown, teeth.
  g.poly(pts(P, SKULL)).fill({ color: DEEP, alpha: 0.25 * a }).stroke({ width: lw * 1.3, color: BONE, alpha: 0.95 * a, join: "round" });
  line([0.62, 0.72, 0.5, 0.95], lw, BONE, 0.9);
  line([0.72, 0.75, 0.66, 0.98], lw, BONE, 0.9);
  for (let i = 0; i < 4; i++) {
    const t0 = P(0.98 + 0.055 * i, 0.28), t1 = P(0.98 + 0.055 * i, 0.21);
    g.moveTo(t0.x, t0.y).lineTo(t1.x, t1.y);
  }
  g.stroke({ width: Math.max(1, lw * 0.7), color: BONE, alpha: 0.8 * a });
  // Violet fire in the socket.
  const e = P(0.76, 0.58);
  g.circle(e.x, e.y, U * 0.13).fill({ color: VIOLET, alpha: 0.45 * a });
  g.circle(e.x, e.y, U * 0.06).fill({ color: PALE, alpha: a });

  // The rider: black plate with a violet edge, the cloak's rim, a spiked
  // helm with fire where the eyes should be.
  g.poly(pts(P, CLOAK)).stroke({ width: lw * 0.8, color: VIOLET, alpha: 0.75 * a, join: "round" });
  g.poly(pts(P, RIDER)).stroke({ width: lw, color: LILAC, alpha: 0.9 * a, join: "round" });
  const hd = P(-0.08, 1.1);
  g.circle(hd.x, hd.y, U * 0.15).stroke({ width: lw, color: LILAC, alpha: 0.9 * a });
  line([-0.1, 1.24, -0.16, 1.46], lw, PALE, 0.9);
  const ey = P(0.02, 1.11);
  g.circle(ey.x, ey.y, U * 0.09).fill({ color: VIOLET, alpha: 0.5 * a });
  g.circle(ey.x, ey.y, U * 0.04).fill({ color: PALE, alpha: a });

  // The lance, couched under the arm and levelled at `tip`.
  const h0 = P(-0.05, 0.82), dx = tip.x - h0.x, dy = tip.y - h0.y, dl = Math.hypot(dx, dy) || 1;
  lanceShape(g, { x: h0.x - (dx / dl) * U * 0.45, y: h0.y - (dy / dl) * U * 0.45 }, tip, lw * 1.2, a);
  line([-0.06, 0.92, 0.06, 0.8], lw * 1.2, LILAC, 0.9);
}

/** A lance from `a` to its point at `b`: a violet glow, a pale shaft, a long
 *  leaf-shaped head, and the vamplate (the hand-guard cone) near the grip. */
function lanceShape(g: Graphics, a: Pt, b: Pt, w: number, alpha: number) {
  const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy);
  if (len < 2 || alpha <= 0.01) return;
  const ux = dx / len, uy = dy / len, nx = -uy, ny = ux, head = Math.min(len * 0.3, w * 9);
  const hx = b.x - ux * head, hy = b.y - uy * head, hw = w * 1.7;
  g.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ width: w * 4, color: VIOLET, alpha: 0.28 * alpha });
  g.moveTo(a.x, a.y).lineTo(hx, hy).stroke({ width: w * 1.5, color: LILAC, alpha: 0.95 * alpha });
  g.moveTo(a.x, a.y).lineTo(hx, hy).stroke({ width: Math.max(0.8, w * 0.5), color: PALE, alpha });
  g.poly([b.x, b.y, hx + ux * head * 0.4 + nx * hw, hy + uy * head * 0.4 + ny * hw, hx, hy,
    hx + ux * head * 0.4 - nx * hw, hy + uy * head * 0.4 - ny * hw]).fill({ color: PALE, alpha });
  const vx = a.x + ux * len * 0.22, vy = a.y + uy * len * 0.22, vw = w * 2.6;
  g.poly([vx + ux * w * 4, vy + uy * w * 4, vx + nx * vw, vy + ny * vw, vx - nx * vw, vy - ny * vw]).fill({ color: LILAC, alpha: 0.9 * alpha });
}

/** A hoofprint of ghost-fire, `age` s after it was stamped: a horseshoe
 *  burnt into the ground, its toe to the charge, with a violet flame standing
 *  up off it and dying down. */
function hoofprint(g: Graphics, x: number, y: number, ang: number, r: number, age: number, seed: number) {
  const a = span(age, 0, 0.04) * (1 - span(age, 0.2, 0.55));
  if (a <= 0.01) return;
  g.circle(x, y, r * 1.8).fill({ color: VIOLET, alpha: 0.2 * a });
  g.moveTo(x + Math.cos(ang - 1.9) * r, y + Math.sin(ang - 1.9) * r).arc(x, y, r, ang - 1.9, ang + 1.9)
    .stroke({ width: Math.max(1.5, r * 0.45), color: GHOST, alpha: 0.95 * a, cap: "round" });
  const h = r * 4.2 * (1 - span(age, 0.05, 0.55) * 0.6) * (1 + 0.25 * pyroFlick(age, seed));
  const lean = h * 0.25 * pyroFlick(age * 0.8, seed + 3);
  pyroTongue(g, x, y, 0, -1, h, r * 1.9, lean, PURPLE, 0.5 * a);
  pyroTongue(g, x, y, 0, -1, h * 0.65, r * 1.15, lean * 0.7, VIOLET, 0.65 * a);
  pyroTongue(g, x, y, 0, -1, h * 0.32, r * 0.6, lean * 0.4, PALE, 0.85 * a);
}

/** A skull, `r` across, at `c`: a cranium, a jaw, two sockets and a nose. */
function skullParts(c: Pt, r: number) {
  return {
    cranium: { x: c.x, y: c.y - r * 0.12, r: r * 0.5 },
    jaw: [c.x - r * 0.3, c.y + r * 0.2, c.x + r * 0.3, c.y + r * 0.2, c.x + r * 0.22, c.y + r * 0.56, c.x - r * 0.22, c.y + r * 0.56],
    eyes: [{ x: c.x - r * 0.19, y: c.y - r * 0.04 }, { x: c.x + r * 0.19, y: c.y - r * 0.04 }],
    nose: [c.x, c.y + r * 0.12, c.x - r * 0.07, c.y + r * 0.26, c.x + r * 0.07, c.y + r * 0.26],
  };
}

/** A round of smoke: a circle at (x, y), `r` across, its edge rolling. */
function smoky(x: number, y: number, r: number, time: number, seed: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * TAU, rr = r * (1 + 0.07 * Math.sin(5 * a + seed + time * 7) + 0.045 * Math.sin(9 * a - time * 11));
    out.push(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  return out;
}

export const SKELIDER: Signature = {
  shake: 1.4,
  // The ride is drawn, the whole way; the token jumps to `m.to` as it lands.
  lunge: false,

  deliver(t: FxTools, m: SigMoment, seconds: number) {
    const T = seconds, R = ride(m), s = R.s, k = s / 90, lw = Math.max(1, s / 52);
    const place = (u: number): Pt => R.at(R.along(u));
    const tipAt = (o: Pt): Pt => {
      const d = unit(R.p.x - o.x, R.p.y - o.y, R.aim);
      return { x: o.x + d.x * R.lance, y: o.y + d.y * R.lance };
    };
    const gallop = (u: number) => span(u, RISE * 0.5, RISE + 0.1);

    // THE RISE: ghost-fire flares under its card, and the horse comes up out
    // of it — dark first, its bones lit a beat later.
    const seeds = [0, 1, 2, 3, 4].map(() => rand(0, 100));
    const FD = T * 0.55;
    t.draw(FD, (g, u) => {
      const time = u * FD, a = span(u, 0, 0.15) * (1 - span(u, 0.45, 1));
      seeds.forEach((sd, i) => {
        const x = R.a.x + (i - 2) * s * 0.17, y = R.a.y + s * 0.34, h = s * (0.42 + 0.12 * (i % 2)) * (1 + 0.3 * pyroFlick(time, sd));
        const lean = h * 0.25 * pyroFlick(time * 0.8, sd + 1);
        pyroTongue(g, x, y, 0, -1, h, s * 0.2, lean, PURPLE, 0.5 * a);
        pyroTongue(g, x, y, 0, -1, h * 0.6, s * 0.11, lean * 0.6, GHOST, 0.6 * a);
      });
    });
    t.emit({ count: 8, palette: CINDER, from: { x: R.a.x - s * 0.4, y: R.a.y + s * 0.1, w: s * 0.8, h: s * 0.3 },
      dir: [-110, -70], speed: [40, 110], gravity: -150, drag: 0.5, life: [0.3, 0.55], size: [4, 1.5] });

    // THE RIDE: the horse along the line, the lance on the target.
    t.draw(T, (g, u) => {
      horseShadow(g, pose(R, place(u), u * T, gallop(u)), R.U, span(u, 0.02, RISE));
    }, { dark: true });
    let dust = 0;
    t.draw(T, (g, u, dt) => {
      const time = u * T, o = place(u), q = pose(R, o, time, gallop(u));
      horseLight(g, q, R.U, tipAt(o), lw, time, span(u, 0.06, RISE + 0.04));
      // Grave dust and bone chips thrown back off the hooves.
      if (u > RISE) {
        dust += dt * 70 * t.quality;
        for (; dust >= 1; dust--) {
          const L = q.legs[Math.floor(rand(0, 4))], h = q.P(L[4], L[5]);
          if (Math.random() < 0.7)
            t.spark(h.x, h.y, -R.dir.x * rand(20, 70) * k + rand(-20, 20) * k, -R.dir.y * rand(20, 70) * k - rand(10, 40) * k, rand(0.3, 0.55), DUST);
          else
            t.spark(h.x, h.y, -R.dir.x * rand(60, 140) * k + rand(-50, 50) * k, -R.dir.y * rand(60, 140) * k - rand(80, 160) * k, rand(0.25, 0.4), CHIP);
        }
      }
    });

    // THE HOOFPRINTS: one each stride, left and right of the line, stamped
    // as the horse passes over them and burning on behind it.
    const STRIDE = s * 0.3, prints: { x: number; y: number; at: number; seed: number }[] = [];
    const when = (d: number) => {
      // The moment the horse is `d` along: the ride only goes forward, so
      // halve the interval.
      let lo = RISE, hi = 1;
      for (let j = 0; j < 16; j++) { const mid = (lo + hi) / 2; if (R.along(mid) < d) lo = mid; else hi = mid; }
      return hi;
    };
    const ang = Math.atan2(R.dir.y, R.dir.x);
    for (let d = s * 0.15, n = 0; d <= R.L + 1e-3; d += STRIDE, n++) {
      const o = R.at(d), off = (n % 2 ? 1 : -1) * s * 0.1;
      prints.push({ x: o.x - R.dir.y * off, y: o.y + R.dir.x * off + s * 0.2, at: when(d) * T, seed: rand(0, 100) });
    }
    const PD = T + 0.6;
    t.draw(PD, (g, u) => {
      const time = u * PD;
      for (const pr of prints) if (time >= pr.at) hoofprint(g, pr.x, pr.y, ang, s * 0.055, time - pr.at, pr.seed);
    });
  },

  land(t: FxTools, m: SigMoment) {
    const R = ride(m), s = R.s, k = s / 90, lw = Math.max(1, s / 52), seed = rand(0, TAU);
    const p = R.p, ux = R.aim.x, uy = R.aim.y, nx = -uy, ny = ux;
    const kk = m.targets.length ? Math.max(0.8, Math.min(1.8, m.power[0] ?? 1)) : 0.8;
    const killed = m.targets.length > 0 && !!m.killed[0];

    // THE HORSE pulls up, lurches into the thrust and comes apart into its
    // own ghost-fire.
    const HD = 0.3;
    const at = (u: number): Pt => {
      const e = s * 0.12 * easeOut(span(u, 0, 0.3));
      return { x: R.stop.x + ux * e, y: R.stop.y + uy * e };
    };
    t.draw(HD, (g, u) => horseShadow(g, pose(R, at(u), 0.5 + u * HD, 1 - u), R.U, Math.pow(1 - u, 1.6)), { dark: true });
    t.draw(HD, (g, u) => {
      const o = at(u);
      horseLight(g, pose(R, o, 0.5 + u * HD, 1 - u), R.U, { x: o.x + ux * R.lance, y: o.y + uy * R.lance }, lw, 0.5 + u * HD, Math.pow(1 - u, 1.3));
    });
    t.later(0.12, () => t.emit({ count: 10, palette: CINDER, from: { x: R.stop.x - s * 0.3, y: R.stop.y - s * 0.2, w: s * 0.6, h: s * 0.5 },
      dir: [-120, -60], speed: [40, 120], gravity: -160, drag: 0.5, life: [0.35, 0.6], size: [4, 1.5] }));

    if (!m.targets.length) return;

    // THE LANCE goes through: its point driven from the near edge of the card
    // to well out past the far side, the shaft following it in.
    const tip0 = { x: R.stop.x + ux * R.lance, y: R.stop.y + uy * R.lance };
    const far = { x: p.x + ux * s * (0.8 + 0.15 * kk), y: p.y + uy * s * (0.8 + 0.15 * kk) };
    const reach = Math.hypot(far.x - tip0.x, far.y - tip0.y);
    const LD = 0.5;
    t.draw(LD, (g, u) => {
      const time = u * LD, push = easeOut(span(time, 0, 0.075)), a = 1 - span(time, 0.22, LD);
      const tip = { x: tip0.x + ux * reach * push, y: tip0.y + uy * reach * push };
      const rear = { x: R.stop.x - ux * s * 0.35 + ux * reach * push * 0.6, y: R.stop.y - uy * s * 0.35 + uy * reach * push * 0.6 };
      lanceShape(g, rear, tip, lw * 1.6 * Math.min(1.3, kk), a);
      // The rush of it: pale speed-lines along the shaft as it goes in.
      const sa = (1 - span(time, 0.05, 0.2)) * push;
      if (sa > 0.01) {
        for (const o of [-1, 1]) {
          const w = s * 0.09 * o;
          g.moveTo(tip.x - ux * s * 0.9 + nx * w, tip.y - uy * s * 0.9 + ny * w).lineTo(tip.x - ux * s * 0.25 + nx * w, tip.y - uy * s * 0.25 + ny * w);
        }
        g.stroke({ width: 1.5, color: PALE, alpha: 0.7 * sa });
      }
    });

    // THE PUNCH, as the point goes in: a hard flash and a shock squashed
    // along the thrust — the card took it end-on.
    t.later(0.03, () => t.flash(p, VIOLET, 0.35 + 0.12 * kk));
    const ang = Math.atan2(uy, ux);
    t.draw(0.35, (g, u) => {
      const e = easeOut(u), f = 1 - u;
      for (const [rr, w, c] of [[0.5, 3, VIOLET], [0.42, 1.5, PALE]] as const) {
        const ra = s * (0.12 + rr * e) * Math.min(1.3, kk), rb = ra * 0.45;
        const ring: number[] = [];
        for (let i = 0; i < 24; i++) {
          const q = (i / 24) * TAU, x = Math.cos(q) * rb, y = Math.sin(q) * ra;
          ring.push(p.x + x * Math.cos(ang) - y * Math.sin(ang), p.y + x * Math.sin(ang) + y * Math.cos(ang));
        }
        g.poly(ring, true).stroke({ width: w * f + 0.5, color: c, alpha: 0.85 * f });
      }
    }, { delay: 0.03 });

    // What it tears out of the far side: violet streaks and splinters of
    // bone, in a narrow cone along the lance.
    t.later(0.05, () => {
      const exit = { x: p.x + ux * s * 0.32, y: p.y + uy * s * 0.32 };
      const n1 = Math.round(14 * kk * t.quality), n2 = Math.round(12 * kk * t.quality);
      for (let i = 0; i < n1; i++) {
        const a = ang + rand(-0.35, 0.35), v = rand(170, 340) * k;
        t.spark(exit.x, exit.y, Math.cos(a) * v, Math.sin(a) * v, rand(0.25, 0.45), THROUGH);
      }
      for (let i = 0; i < n2; i++) {
        const a = ang + rand(-0.8, 0.8), v = rand(110, 260) * k;
        t.spark(exit.x, exit.y, Math.cos(a) * v, Math.sin(a) * v - rand(40, 120) * k, rand(0.35, 0.6), CHIP);
      }
    });

    // THE SKULL of violet smoke bursting off the card and rising as it comes
    // apart: its outline rolling like smoke, dark inside, fire in its
    // sockets, a tail of smoke still tying it to the wound.
    const SD = 0.8, rise = s * 0.42;
    const skullAt = (u: number) => {
      const grow = easeOut(span(u, 0, 0.2));
      return skullParts({ x: p.x, y: p.y - s * 0.08 - rise * easeOut(u) }, s * (0.36 + 0.22 * grow) * Math.min(1.3, kk) * (killed ? 1.15 : 1));
    };
    const skA = (u: number) => span(u, 0, 0.1) * (1 - span(u, 0.4, 1));
    const crown = (sk: ReturnType<typeof skullAt>, time: number, swell: number) =>
      smoky(sk.cranium.x, sk.cranium.y, sk.cranium.r * (1 + 0.15 * swell), time, seed);
    t.draw(SD, (g, u) => {
      const sk = skullAt(u), a = skA(u);
      if (a <= 0.01) return;
      g.poly(crown(sk, u * SD, u)).fill({ color: INK, alpha: 0.6 * a });
      g.poly(sk.jaw).fill({ color: INK, alpha: 0.6 * a });
    }, { dark: true, delay: 0.08 });
    t.draw(SD, (g, u) => {
      const sk = skullAt(u), a = skA(u), time = u * SD;
      if (a <= 0.01) return;
      // The smoke tail, from the wound up into the jaw.
      const j = sk.jaw, jx = (j[4] + j[6]) / 2, jy = j[5];
      g.moveTo(p.x, p.y).quadraticCurveTo(p.x + Math.sin(time * 9 + seed) * s * 0.1, (p.y + jy) / 2, jx, jy)
        .stroke({ width: s * 0.09, color: PURPLE, alpha: 0.35 * a * (1 - u), cap: "round" });
      g.poly(crown(sk, time, u)).stroke({ width: 2, color: LILAC, alpha: 0.75 * a, join: "round" });
      g.poly(sk.jaw).stroke({ width: 1.5, color: LILAC, alpha: 0.65 * a, join: "round" });
      // Teeth: the jaw's top edge ticked.
      const tw = (j[2] - j[0]) / 5;
      for (let i = 1; i < 5; i++) g.moveTo(j[0] + tw * i, j[1]).lineTo(j[0] + tw * i, j[1] + (j[5] - j[1]) * 0.35);
      g.stroke({ width: 1.2, color: LILAC, alpha: 0.55 * a });
      for (const e of sk.eyes) {
        const fl = 1 + 0.2 * pyroFlick(time, e.x);
        g.circle(e.x, e.y, sk.cranium.r * 0.26 * fl).fill({ color: VIOLET, alpha: 0.5 * a });
        g.circle(e.x, e.y, sk.cranium.r * 0.1).fill({ color: PALE, alpha: 0.95 * a });
      }
      g.poly(sk.nose).fill({ color: VIOLET, alpha: 0.6 * a });
    }, { delay: 0.08 });
    // ...and it thins to smoke off its edge as it goes.
    let puff = 0;
    t.draw(SD, (_g, u, dt) => {
      if (u < 0.3 || u > 0.85) return;
      const sk = skullAt(u);
      puff += dt * 26 * t.quality;
      for (; puff >= 1; puff--) {
        const a = rand(0, TAU), r = sk.cranium.r * rand(0.7, 1);
        t.spark(sk.cranium.x + Math.cos(a) * r, sk.cranium.y + Math.sin(a) * r, Math.cos(a) * rand(15, 40) * k,
          Math.sin(a) * rand(15, 40) * k - rand(20, 50) * k, rand(0.4, 0.65), SMOKE);
      }
    }, { delay: 0.08 });

    if (killed) shatter(t, m.targets[0], p, R.aim, seed);
  },
};

/** A card killed by the lance cracks like old bone from where it went in —
 *  pale fissures running out across it — and then comes apart: shards of
 *  bone flung out and falling, and a puff of grave dust where it stood. */
function shatter(t: FxTools, r: Box, p: Pt, aim: Pt, seed: number) {
  const s = Math.min(r.w, r.h), k = s / 90;
  // The cracks: jagged, out from the wound.
  const cracks = Array.from({ length: 7 }, (_, i) => {
    const a = seed + (i / 7) * TAU + rand(-0.2, 0.2), pts: number[] = [p.x, p.y], L = s * rand(0.32, 0.48);
    let x = p.x, y = p.y;
    for (let j = 1; j <= 4; j++) {
      const q = a + rand(-0.45, 0.45);
      x += Math.cos(q) * (L / 4);
      y += Math.sin(q) * (L / 4);
      pts.push(x, y);
    }
    return pts;
  });
  const lay = (g: Graphics, grow: number) => {
    for (const c of cracks) {
      const n = Math.max(1, Math.round((c.length / 2 - 1) * grow));
      g.moveTo(c[0], c[1]);
      for (let j = 1; j <= n; j++) g.lineTo(c[2 * j], c[2 * j + 1]);
    }
  };
  const CD = 0.42;
  t.draw(CD, (g, u) => {
    const time = u * CD, grow = span(time, 0.06, 0.16), a = 1 - span(time, 0.26, CD);
    if (a <= 0.01 || grow <= 0) return;
    lay(g, grow);
    g.stroke({ width: 3.5, color: VIOLET, alpha: 0.5 * a, join: "round" });
    lay(g, grow);
    g.stroke({ width: 1.4, color: BONE, alpha: 0.95 * a, join: "round" });
  }, { delay: 0.02 });
  // ...and it goes: bone flung out and falling, a little more of it along
  // the way the lance went.
  t.later(0.24, () => {
    t.flash(p, BONE, 0.32);
    const n = Math.round(26 * t.quality);
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU), v = rand(90, 240) * k;
      t.spark(p.x + rand(-0.3, 0.3) * s, p.y + rand(-0.3, 0.3) * s, Math.cos(a) * v + aim.x * 60 * k, Math.sin(a) * v + aim.y * 60 * k - rand(60, 160) * k,
        rand(0.45, 0.75), SHARD);
    }
    t.emit({ count: 10, palette: DUST.palette, from: { x: r.x + r.w * 0.15, y: r.y + r.h * 0.45, w: r.w * 0.7, h: r.h * 0.45 },
      dir: [-160, -20], speed: [20, 60], gravity: -30, drag: 0.5, life: [0.45, 0.75], size: [4, 10] });
  });
}
