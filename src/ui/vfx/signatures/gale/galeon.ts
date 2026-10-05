/** GALEON — Mighty Winds. "Deal 4 DMG, push every opponent back 2, WEAKEN
 *  them (2r), and -8 SP for the round." It never needs to reach you: its
 *  wingbeat does, and Mighty Winds adds two squares.
 *
 *  On its art Galeon is a violet storm-griffin crouched in an orange dust
 *  field, its huge wings of violet lightning-feathers thrown up, and the whole
 *  sky behind it whipped into a vortex by one beat of them, soldiers flung
 *  back across the ground. The DELIVERY is that beat: the two wings rise off
 *  its shoulders and swing up and back, feather by feather, violet storm-light
 *  crackling along the quills as they go; then ONE huge downbeat — both wings
 *  thrown forward together — and the air it throws leaves the card.
 *
 *  The LANDING is the wind that beat makes: a WALL of it, not a shot. A broad
 *  front rolls out from Galeon along "ahead", unrolling sideways as it goes
 *  until it spans the whole board, bowed a little where the beat came from —
 *  a violet-edged crest of light with a haze of violet behind it, dozens of
 *  gust streaks riding it, orange dust and violet feathers carried in it.
 *  Where it passes a card it strikes it and blasts its square BACKWARD: gusts
 *  shoving past the card on both sides and running on two squares before they
 *  curl and die, a violet wind-blade across its face, the dust thrown back
 *  the way the card is about to slide. The game slides each token itself; the
 *  hit is anchored on the square the card stood on.
 *
 *  The wings carry a dark body (`dark: true`) so they read as wings over an
 *  empty square, lit along every feather in violet. The wind itself is light:
 *  violet and lilac, with the art's orange dust in it, never GALE's plain
 *  peach — this is the one front in GALE that crosses the whole board. */
import { centre, rand } from "../../looks/base";
import type { Graphics } from "pixi.js";
import type { FxTools, Pt, SparkStyle } from "../../looks/types";
import type { Signature, SigMoment } from "../types";

type Box = SigMoment["from"];

const TAU = Math.PI * 2;
// The storm-light of its feathers: deep violet to a near-white lilac.
const DEEP = 0x5a2fc0, VIOLET = 0x9a62ff, LILAC = 0xc9a8ff, PALE = 0xf1e6ff;
// The wing's body, on the dark layer only.
const PLUME = 0x1a0a36;
// The orange dust of its field, carried in the wind.
const SAND = 0xffd39a, DUST = 0xf0a050, RUST = 0xb8662a;
/** Dust lifted by the front: thrown along with it, slowing, curling a little. */
const DRIFT: SparkStyle = { palette: [SAND, DUST, RUST], gravity: 0, drag: 0.35, size: [5, 2], streak: true, swirl: 160 };
/** Violet storm motes in the wind. */
const MOTE: SparkStyle = { palette: [PALE, LILAC, VIOLET, DEEP], gravity: 0, drag: 0.4, size: [4, 1.5], streak: true };
/** A card's dust blasted back off its square: fast, then spent. */
const BLOWN: SparkStyle = { palette: [SAND, DUST, RUST], gravity: 0, drag: 0.22, size: [6, 2], streak: true };

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeOut = (x: number) => 1 - (1 - x) * (1 - x);
const easeIn = (x: number) => x * x;

/** The card's own frame: `ahead` and the normal to it, and a way to place a
 *  point `d` along ahead and `l` across from `o`. */
function frame(m: SigMoment) {
  const A = m.ahead, N = { x: -A.y, y: A.x };
  const at = (o: Pt, d: number, l: number): Pt => ({ x: o.x + A.x * d + N.x * l, y: o.y + A.y * d + N.y * l });
  return { A, N, rot: Math.atan2(A.y, A.x), at };
}

// ── The wings ───────────────────────────────────────────────────────────────

/** One flight feather from `b` out along `ang`: a long pointed vane, broad a
 *  third of the way out. Continues the current path. */
function quill(g: Graphics, b: Pt, ang: number, len: number, wid: number) {
  const ux = Math.cos(ang), uy = Math.sin(ang), nx = -uy, ny = ux;
  const mx = b.x + ux * len * 0.38, my = b.y + uy * len * 0.38;
  g.moveTo(b.x, b.y)
    .quadraticCurveTo(mx + nx * wid, my + ny * wid, b.x + ux * len, b.y + uy * len)
    .quadraticCurveTo(mx - nx * wid * 0.6, my - ny * wid * 0.6, b.x, b.y);
}

/** A wing's feathers: seven flight feathers fanned from the shoulder `b`
 *  round `ang`, longest at the leading edge, and four short coverts over their
 *  roots — so the body and its light are drawn from the same feathers. */
function wingFeathers(b: Pt, ang: number, side: number, len: number) {
  const flight = Array.from({ length: 7 }, (_, i) => {
    const f = i / 6;
    return { b, ang: ang + side * (0.55 - f) * 1.25, len: len * (1 - 0.42 * f), wid: len * 0.13 };
  });
  const coverts = Array.from({ length: 4 }, (_, i) => {
    const f = i / 3;
    return { b, ang: ang + side * (0.45 - f) * 1.1, len: len * 0.45, wid: len * 0.11 };
  });
  return flight.concat(coverts);
}

/** A jagged run of storm-light along a feather, re-rolled every call. */
function crackle(g: Graphics, b: Pt, ang: number, len: number, a: number) {
  const ux = Math.cos(ang), uy = Math.sin(ang), nx = -uy, ny = ux, pts: number[] = [];
  for (let i = 0; i <= 6; i++) {
    const f = 0.15 + (0.8 * i) / 6, j = i === 0 || i === 6 ? 0 : rand(-1, 1) * len * 0.05;
    pts.push(b.x + ux * len * f + nx * j, b.y + uy * len * f + ny * j);
  }
  g.poly(pts, false).stroke({ width: 1.4, color: PALE, alpha: a, join: "round" });
}

// ── Wind ────────────────────────────────────────────────────────────────────

/** A gust as a local path along +x: a run of `len` then a curl of radius
 *  `curl`, turning one way or the other with `flip`. */
function gustPath(len: number, curl: number, flip: boolean): number[] {
  const pts: number[] = [], sy = flip ? -1 : 1;
  for (let i = 0; i <= 10; i++) pts.push((len * i) / 10, 0);
  for (let i = 1; i <= 10; i++) {
    const f = i / 10, phi = f * 1.15 * TAU, r = curl * (1 - 0.55 * f), th = sy * (Math.PI / 2 - phi);
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

/** A gust passing along its path, `age` into a run of `dur`: a thin wake and a
 *  bold head, the head racing out and the tail chasing it off. */
function gust(g: Graphics, path: number[], age: number, dur: number, o: Pt, rot: number, width: number, color: number, alpha: number) {
  const head = easeOut(clamp01(age / dur)), tl = clamp01((age - dur * 0.45) / dur), tail = Math.min(head, tl * tl * (3 - 2 * tl));
  if (head - tail < 0.02 || alpha <= 0.01) return;
  g.poly(slice(path, tail, head, o, rot), false).stroke({ width: width * 0.5, color, alpha: alpha * 0.5, cap: "round" });
  g.poly(slice(path, head - (head - tail) * 0.4, head, o, rot), false).stroke({ width, color, alpha, cap: "round" });
}

/** A loose feather riding the wind: a violet vane round a pale quill. */
function plume(g: Graphics, x: number, y: number, rot: number, len: number, a: number) {
  const ux = Math.cos(rot), uy = Math.sin(rot), nx = -uy, ny = ux, h = len / 2, w = len * 0.18;
  g.poly([x - ux * h, y - uy * h, x + nx * w, y + ny * w, x + ux * h, y + uy * h, x - nx * w * 0.7, y - ny * w * 0.7])
    .fill({ color: VIOLET, alpha: 0.6 * a });
  g.moveTo(x - ux * h * 1.1, y - uy * h * 1.1).lineTo(x + ux * h, y + uy * h).stroke({ width: 1, color: PALE, alpha: 0.9 * a });
}

export const GALEON: Signature = {
  shake: 1.4,
  // It never closes on anyone: it beats its wings where it stands.
  lunge: false,

  deliver(t: FxTools, m: SigMoment, seconds: number) {
    const c = centre(m.from), s = m.size, T = seconds, F = frame(m);
    // When the beat comes, as fractions of the delivery: up slow, down fast.
    const UP = 0.62, DOWN = 0.88, D = T + 0.18;
    const pose = (time: number, side: number) => {
      const u = time / T;
      // Seen from above, a wing raised is a wing spread: folded back along
      // its flank, it opens out wide and a little back, then the downbeat
      // throws it forward.
      const folded = F.rot + side * (Math.PI / 2 + 1.2), raised = F.rot + side * (Math.PI / 2 + 0.3);
      const low = F.rot + side * (Math.PI / 2 - 0.85);
      const ang = u < UP ? folded + (raised - folded) * easeOut(u / UP)
        : low + (raised - low) * (1 - easeIn(clamp01((u - UP) / (DOWN - UP))));
      const len = s * (0.45 + 0.62 * easeOut(clamp01(u / UP)));
      const a = clamp01(time / 0.08) * (1 - clamp01((time - T) / 0.18));
      return { b: F.at(c, -s * 0.06, side * s * 0.14), ang, len, a };
    };
    // THE WINGS: a dark body each...
    t.draw(D, (g, u) => {
      for (const side of [-1, 1]) {
        const p = pose(u * D, side);
        for (const f of wingFeathers(p.b, p.ang, side, p.len)) quill(g, f.b, f.ang, f.len, f.wid);
        g.fill({ color: PLUME, alpha: 0.75 * p.a });
      }
    }, { dark: true });
    // ...lit through in violet, a lilac edge on every feather, and storm-light
    // crackling along the quills — more of it as the wings climb.
    t.draw(D, (g, u) => {
      const time = u * D, charge = clamp01(time / (T * UP));
      for (const side of [-1, 1]) {
        const p = pose(time, side), fs = wingFeathers(p.b, p.ang, side, p.len);
        for (const f of fs) quill(g, f.b, f.ang, f.len, f.wid);
        g.fill({ color: DEEP, alpha: 0.35 * p.a });
        for (const f of fs) quill(g, f.b, f.ang, f.len, f.wid);
        g.stroke({ width: 1.4, color: LILAC, alpha: 0.85 * p.a, join: "round" });
        for (const f of fs) if (Math.random() < 0.25 + 0.4 * charge) crackle(g, f.b, f.ang, f.len, 0.9 * p.a);
      }
    });
    t.charge(F.at(c, -s * 0.05, 0), s * 1.1, VIOLET, 0.32, T * DOWN);

    // THE DOWNBEAT: air thrown off both wingtips, forward, and the field's dust
    // kicked up ahead of the card.
    t.later(T * (UP + 0.12), () => {
      t.flash(F.at(c, s * 0.2, 0), LILAC, 0.45);
      const paths = [-1, 1].flatMap((side) => [0.35, 0.6].map((o) => ({ side, o, path: gustPath(s * 1.5, 0, side > 0) })));
      t.draw(0.4, (g, u) => {
        for (const p of paths)
          gust(g, p.path, u * 0.4, 0.3, F.at(c, -s * 0.05, p.side * s * p.o), F.rot - p.side * 0.25, 2.6, LILAC, 0.85);
      });
      const deg = (F.rot * 180) / Math.PI;
      t.emit({ count: 16, palette: DRIFT.palette, from: m.from, dir: [deg - 35, deg + 35], speed: [220, 380], gravity: 0,
        drag: 0.35, life: [0.25, 0.45], size: [6, 2], streak: true });
    });
  },

  land(t: FxTools, m: SigMoment) {
    const c = centre(m.from), s = m.size, F = frame(m);
    // The board in the card's frame: how far ahead it runs, how wide it is.
    const b = m.board;
    const corners = [{ x: b.x, y: b.y }, { x: b.x + b.w, y: b.y }, { x: b.x, y: b.y + b.h }, { x: b.x + b.w, y: b.y + b.h }];
    const along = (p: Pt) => (p.x - c.x) * F.A.x + (p.y - c.y) * F.A.y;
    const across = (p: Pt) => (p.x - c.x) * F.N.x + (p.y - c.y) * F.N.y;
    const lMin = Math.min(...corners.map(across)) - s * 0.15, lMax = Math.max(...corners.map(across)) + s * 0.15;
    const W = Math.max(-lMin, lMax, s);
    const dEnd = Math.max(s * 1.5, ...corners.map(along)) + s * 0.25;
    // THE FRONT: bowed back toward its edges by BOW, unrolling sideways as it
    // runs out, pressing on steadily — a wall, not a bullet.
    const RUN = 0.62, BOW = s * 0.55, d0 = s * 0.4;
    const dist = (time: number) => d0 + (dEnd + BOW - d0) * (1 - Math.pow(1 - clamp01(time / RUN), 1.5));
    const front = (time: number, l: number) => dist(time) - BOW * (l / W) * (l / W);
    const width = (time: number) => s * 0.7 + W * 2.2 * easeOut(clamp01(time / (RUN * 0.55)));
    const fade = (time: number) => clamp01(time / 0.05) * (1 - clamp01((time - RUN * 0.8) / 0.28));
    const D = RUN + 0.3;

    // The gusts riding it, one lane each across the board, and the feathers
    // and dust it carries.
    const lanes = Array.from({ length: Math.round(((lMax - lMin) / (s * 0.2)) * (0.6 + 0.4 * t.quality)) }, () => ({
      l: rand(lMin, lMax), len: s * rand(0.45, 1.25), lead: s * rand(-0.22, 0.04), ph: rand(0, TAU),
      color: Math.random() < 0.3 ? SAND : Math.random() < 0.5 ? PALE : LILAC, w: rand(1.6, 3),
    }));
    const plumes = Array.from({ length: Math.round(7 * t.quality) + 2 }, () => ({
      l: rand(lMin, lMax), lead: s * rand(-0.35, 0.05), rot: rand(0, TAU), spin: rand(-9, 9), len: s * rand(0.16, 0.24),
    }));
    let acc = 0;
    t.draw(D, (g, u, dt) => {
      const time = u * D, a = fade(time), half = width(time) / 2;
      if (a <= 0.01) return;
      const l0 = Math.max(lMin, -half), l1 = Math.min(lMax, half), K = 26;
      const wave = (l: number) => front(time, l) + s * 0.035 * Math.sin(l * 0.07 + time * 22);
      const line = (back: number): number[] => {
        const pts: number[] = [];
        for (let i = 0; i <= K; i++) {
          const l = l0 + ((l1 - l0) * i) / K, p = F.at(c, wave(l) - back, l);
          pts.push(p.x, p.y);
        }
        return pts;
      };
      const rev = (pts: number[]) => {
        const out: number[] = [];
        for (let i = pts.length - 2; i >= 0; i -= 2) out.push(pts[i], pts[i + 1]);
        return out;
      };
      // The violet haze of moving air behind the crest, thinning away behind
      // it: thickest at the front, where the wind is.
      const edge = line(0);
      for (const [depth, al] of [[1.1, 0.07], [0.7, 0.08], [0.38, 0.1], [0.16, 0.12]])
        g.poly(edge.concat(rev(line(s * depth)))).fill({ color: depth > 0.5 ? DEEP : VIOLET, alpha: al * a });
      // The gusts: each a streak bent by the turning air behind the crest,
      // bold at its head.
      for (const ln of lanes) {
        if (ln.l < l0 || ln.l > l1) continue;
        const d = front(time, ln.l) + ln.lead, bend = Math.sin(time * 6 + ln.ph) * s * 0.14;
        const h = F.at(c, d, ln.l), tl = F.at(c, d - ln.len, ln.l + bend), ctl = F.at(c, d - ln.len * 0.45, ln.l - bend * 0.2);
        const mid = F.at(c, d - ln.len * 0.3, ln.l - bend * 0.05);
        g.moveTo(tl.x, tl.y).quadraticCurveTo(ctl.x, ctl.y, h.x, h.y).stroke({ width: ln.w * 0.5, color: ln.color, alpha: 0.4 * a, cap: "round" });
        g.moveTo(mid.x, mid.y).lineTo(h.x, h.y).stroke({ width: ln.w, color: ln.color, alpha: 0.85 * a, cap: "round" });
      }
      // The crest: a soft violet swell under one bright lilac edge, with
      // whiter runs flickering along it.
      g.poly(edge, false).stroke({ width: s * 0.18, color: VIOLET, alpha: 0.25 * a, join: "round" });
      g.poly(edge, false).stroke({ width: 2.2, color: LILAC, alpha: 0.85 * a, join: "round" });
      for (let i = 0; i < K; i += 4) {
        const j = i + Math.floor((time * 30 + i) % 2), seg = edge.slice(j * 2, Math.min(K, j + 2) * 2 + 2);
        if (seg.length >= 4) g.poly(seg, false).stroke({ width: 3.4, color: PALE, alpha: 0.95 * a, cap: "round" });
      }
      for (const side of [-1, 1]) {
        const l = side < 0 ? l0 : l1;
        if (Math.abs(l) < half - 2) continue;
        const d = front(time, l), pts: number[] = [];
        for (let i = 0; i <= 8; i++) {
          const th = (i / 8) * 3.2, r = s * 0.16 * (1 - i / 14);
          const p = F.at(c, d - s * 0.2 + Math.cos(th) * r, l + side * Math.sin(th) * r);
          pts.push(p.x, p.y);
        }
        g.poly(pts, false).stroke({ width: 2, color: LILAC, alpha: 0.5 * a, cap: "round" });
      }
      // Feathers tumbling in the front.
      for (const p of plumes) {
        if (p.l < l0 || p.l > l1) continue;
        const at = F.at(c, front(time, p.l) + p.lead, p.l + Math.sin(time * 6 + p.rot) * s * 0.08);
        plume(g, at.x, at.y, p.rot + p.spin * time, p.len, a);
      }
      // Dust and storm motes torn up along the crest, thrown on with it.
      acc += dt * 110 * t.quality * a;
      for (; acc >= 1; acc--) {
        const l = rand(l0, l1), p = F.at(c, front(time, l), l), v = rand(260, 480) * (s / 90), side = rand(-1, 1) * 70 * (s / 90);
        t.spark(p.x, p.y, F.A.x * v + F.N.x * side, F.A.y * v + F.N.y * side, rand(0.25, 0.45), Math.random() < 0.6 ? DRIFT : MOTE);
      }
    });

    // Where the crest reaches a card, it strikes it and blasts its square back.
    m.targets.forEach((r, i) => {
      const p = centre(r), d = along(p), l = across(p);
      let when = RUN;
      for (let k = 0; k <= 60; k++) if (front((k / 60) * RUN, l) >= d - s * 0.15) { when = (k / 60) * RUN; break; }
      t.later(when, () => blast(t, r, m, m.power[i] ?? 0.8, !!m.killed[i]));
    });
  },
};

/** The wall striking one card: a violet wind-blade swept across its face,
 *  gusts shoving past it on both sides and running on two squares before they
 *  curl, and its dust blasted back the way it is about to slide. */
function blast(t: FxTools, r: Box, m: SigMoment, power: number, killed: boolean) {
  const c = centre(r), s = m.size, F = frame(m), k = Math.max(0.6, Math.min(1.6, power));
  t.flash(c, LILAC, 0.35 * k);
  t.glow(r, VIOLET, 0.22, 0.4, 1.0);
  // The shove: five gusts from behind the card on through it and two squares
  // on, the outer ones parting round it.
  const lanes = [-0.4, -0.2, 0, 0.2, 0.4].map((o, i) => ({
    o, at: Math.abs(o) * 0.12, path: gustPath(s * (2.1 + 0.3 * (1 - Math.abs(o) * 2)), s * 0.12, o > 0 || (o === 0 && i % 2 === 0)),
  }));
  const R = s * 0.5, hub = F.at(c, -R + s * 0.1, 0);
  const D = 0.6;
  t.draw(D, (g, u) => {
    const age = u * D;
    for (const ln of lanes)
      gust(g, ln.path, age - ln.at, 0.42, F.at(c, -s * 0.55, ln.o * s), F.rot, ln.o === 0 ? 3.2 : 2.4, ln.o === 0 ? PALE : LILAC, 0.9);
    // A crescent of wind across its face, swept on by the front.
    const q = clamp01(age / 0.18), fa = 1 - clamp01((age - 0.15) / 0.2);
    if (fa <= 0 || q < 0.05) return;
    const inner: number[] = [], outer: number[] = [];
    for (let i = 0; i <= 12; i++) {
      const f = (i / 12) * q, a = F.rot + (f - 0.5) * 1.9, rr = R + s * 0.13 * Math.sin(Math.PI * f);
      inner.push(hub.x + Math.cos(a) * R, hub.y + Math.sin(a) * R);
      outer.unshift(hub.x + Math.cos(a) * rr, hub.y + Math.sin(a) * rr);
    }
    g.poly(inner.concat(outer)).fill({ color: VIOLET, alpha: 0.45 * fa });
    g.poly(outer, false).stroke({ width: 2, color: PALE, alpha: fa, cap: "round" });
  });
  // The dust off its square, thrown back two squares' worth.
  const n = Math.round((12 + 8 * k) * Math.max(0.5, t.quality));
  for (let i = 0; i < n; i++) {
    const v = rand(220, 400) * (s / 90), side = rand(-1, 1) * 90 * (s / 90);
    const o = F.at(c, rand(-0.3, 0.3) * s, rand(-0.35, 0.35) * s);
    t.spark(o.x, o.y, F.A.x * v + F.N.x * side, F.A.y * v + F.N.y * side, rand(0.3, 0.55), i % 3 ? BLOWN : MOTE);
  }
  if (killed)
    t.later(0.08, () => {
      t.ring(r, VIOLET, 0.2, 1.4, 0.45, 3);
      t.arcs(c, [PALE, LILAC, VIOLET], 0.8, 4);
    });
}
