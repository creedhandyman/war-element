/** ROTROOT — Rotten Grasp. "Deal 7 DMG and ROOT for 2 rounds to every
 *  opponent within 2 spaces." It does not raise the dead. It declines their
 *  resignation.
 *
 *  Rotroot on its art is a graveyard stood up: a giant of rotted root and moss,
 *  violet grave-light in its hollows, hands of root the size of a man. The
 *  DELIVERY is the ground round it going bad: a grave-black rot spreading out
 *  from its square, root-tips worming up out of it, two hands of root breaking
 *  the soil on the side it faces, the light in its heart pulsing. The LANDING
 *  is the grasp. The rot heaves — a ring of it running out across the ground,
 *  a crown of short thick roots bursting up all round Rotroot — and from its
 *  square a gnarled root tears along the ground to every card within reach,
 *  throwing up grave-dirt as it runs; at each card it opens into a hand of
 *  roots that closes round it and drags at it — clutching it where it stands
 *  (the ROOT) — before the roots let go and sink back into the ground.
 *
 *  The roots are real darkness (`dark: true`): bark a shade above the board,
 *  so a root over an empty square still has a body, with moss along its edges
 *  and violet grave-light down its vein — black on near-black is nothing. A
 *  boss's move, so it is the heaviest thing on the board while it plays: every
 *  card in reach is taken hold of at once. */
import { centre, rand } from "../looks/base";
import type { Graphics } from "pixi.js";
import type { FxTools, Pt, SparkStyle } from "../looks/types";
import type { Signature, SigMoment } from "./types";

const TAU = Math.PI * 2;
/** Bark: grave-black with the moss still on it, a step above the board. The
 *  rot in the ground is darker. Both only ever on the dark layer. */
const BARK = 0x1f2a1b, ROT = 0x070a06;
/** Moss on its edges; the violet grave-light of its hollows. */
const MOSS = 0x8fbf5a, VIOLET = 0xb07cff, LILAC = 0xd9c2ff;
/** The hook of bone at a finger's end. */
const BONE = 0xe8e0cc;
/** Grave-dirt thrown up where a root breaks the ground. */
const SOIL: SparkStyle = { palette: [0xcfc3a3, 0x9a8a68, 0x7a6a50], gravity: 900, drag: 0.5, size: [6, 3], streak: false };
/** Spores and grave-mist lifting off the rot. */
const SPORE: SparkStyle = { palette: [0xefe4ff, LILAC, VIOLET, 0x7fa860], gravity: -45, drag: 0.5, size: [4, 9], streak: false, swirl: 80 };

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeOut = (x: number) => 1 - (1 - x) * (1 - x);
/** 0 -> 1 as `x` runs from `a` to `b`. */
const span = (x: number, a: number, b: number) => clamp01((x - a) / (b - a));

/** A glow sized to the board's squares (`flash` is sized in px). */
function flare(t: FxTools, p: Pt, size: number, color: number, peak: number, seconds: number) {
  t.glow({ x: p.x - size / 2, y: p.y - size / 2, w: size, h: size }, color, peak, seconds, 1);
}

// ── A root ───────────────────────────────────────────────────────────────────

/** A root's course: sampled points, the arc length to each, and its thorns. */
interface Root { pts: number[]; cum: number[]; total: number; w: number; thorns: { at: number; side: number }[] }

/** A root from `s` to `e`: a meander of two waves that dies out at both ends,
 *  so it leaves the ground at Rotroot and reaches its card dead on. */
function rootPath(s: Pt, e: Pt, w: number): Root {
  const dx = e.x - s.x, dy = e.y - s.y, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
  const a1 = rand(0.08, 0.14) * L * (Math.random() < 0.5 ? -1 : 1), a2 = rand(0.02, 0.05) * L;
  const f1 = rand(1.2, 2), f2 = rand(3, 5), ph = rand(0, TAU);
  const N = 20, pts: number[] = [], cum: number[] = [0];
  for (let i = 0; i <= N; i++) {
    const f = i / N, off = (a1 * Math.sin(f * Math.PI * f1 + ph) + a2 * Math.sin(f * TAU * f2 + ph * 2)) * Math.sin(Math.PI * f);
    pts.push(s.x + dx * f + nx * off, s.y + dy * f + ny * off);
    if (i) cum.push(cum[i - 1] + Math.hypot(pts[i * 2] - pts[i * 2 - 2], pts[i * 2 + 1] - pts[i * 2 - 1]));
  }
  const total = cum[N];
  return { pts, cum, total, w, thorns: Array.from({ length: 5 }, (_, i) => ({ at: ((i + 0.6) / 5.4) * total, side: i % 2 ? 1 : -1 })) };
}

const RA = { x: 0, y: 0, a: 0 };
/** Where arc length `u` lies along a root, and which way it runs there. */
function rootAt(p: Root, u: number) {
  let i = 1;
  while (i < p.cum.length - 1 && p.cum[i] < u) i++;
  const f = clamp01((u - p.cum[i - 1]) / (p.cum[i] - p.cum[i - 1] || 1));
  const x0 = p.pts[i * 2 - 2], y0 = p.pts[i * 2 - 1], x1 = p.pts[i * 2], y1 = p.pts[i * 2 + 1];
  RA.x = x0 + (x1 - x0) * f;
  RA.y = y0 + (y1 - y0) * f;
  RA.a = Math.atan2(y1 - y0, x1 - x0);
}

/** A root grown `upto` px along: thick where it broke the ground, thinning,
 *  drawn to a point over its growing tip. Its outline, flat points. */
function rootBody(p: Root, upto: number, tip: number): number[] {
  const steps = Math.max(4, Math.round(upto / 6)), left: number[] = [], right: number[] = [];
  for (let i = 0; i <= steps; i++) {
    const u = (upto * i) / steps;
    rootAt(p, u);
    const hw = (p.w / 2) * Math.max(0.32, 1 - 0.68 * (u / p.total)) * Math.min(1, (upto - u) / tip + 0.1);
    const nx = -Math.sin(RA.a), ny = Math.cos(RA.a);
    left.push(RA.x + nx * hw, RA.y + ny * hw);
    right.push(RA.x - nx * hw, RA.y - ny * hw);
  }
  for (let i = right.length - 2; i >= 0; i -= 2) left.push(right[i], right[i + 1]);
  return left;
}

/** Its thorns, up to `upto`: small hooked spikes off alternate flanks. */
function rootThorns(p: Root, upto: number): number[][] {
  const out: number[][] = [];
  for (const th of p.thorns) {
    if (th.at > upto - 6) continue;
    rootAt(p, th.at);
    const hw = (p.w / 2) * Math.max(0.32, 1 - 0.68 * (th.at / p.total)), ux = Math.cos(RA.a), uy = Math.sin(RA.a);
    const nx = -uy * th.side, ny = ux * th.side, bx = RA.x + nx * hw, by = RA.y + ny * hw, l = p.w * 0.45;
    out.push([bx - ux * 3, by - uy * 3, bx + nx * l + ux * l * 0.6, by + ny * l + uy * l * 0.6, bx + ux * 3, by + uy * 3]);
  }
  return out;
}

// ── A hand of roots ──────────────────────────────────────────────────────────

/** A hand of roots at `e`, reaching along `h`: five knotted fingers fanned out
 *  over the card, `reach` of their full length, each bent twice and hooked at
 *  its tip; `grip` 0 (splayed open) -> 1 (closed round it: the fan narrows,
 *  the hooks bite). Each finger's outline, and where its tip is. */
function hand(e: Pt, h: number, s: number, reach: number, grip: number): { fingers: number[][]; tips: Pt[] } {
  const fingers: number[][] = [], tips: Pt[] = [];
  const SPREAD = [-1, -0.5, 0, 0.5, 1];
  for (let i = 0; i < 5; i++) {
    const f = SPREAD[i], a0 = h + f * (1.1 - 0.5 * grip), curl = -Math.sign(f || 0.2) * (0.35 + 1.0 * grip) * (0.55 + 0.45 * Math.abs(f));
    const L = s * (i === 2 ? 0.6 : Math.abs(f) < 1 ? 0.54 : 0.42) * reach;
    const segs = [0.45, 0.33, 0.22], left: number[] = [], right: number[] = [];
    let x = e.x, y = e.y, a = a0, run = 0;
    for (let k = 0; k <= 3; k++) {
      const w = s * 0.075 * (1 - 0.78 * (run / (L || 1)));
      left.push(x - Math.sin(a) * w * 0.5, y + Math.cos(a) * w * 0.5);
      right.push(x + Math.sin(a) * w * 0.5, y - Math.cos(a) * w * 0.5);
      if (k === 3) break;
      x += Math.cos(a) * L * segs[k];
      y += Math.sin(a) * L * segs[k];
      run += L * segs[k];
      a += curl * (k === 0 ? 0.45 : 0.55);
    }
    // The hooked tip: bone, curling on past the last knuckle.
    left.push(x + Math.cos(a) * s * 0.05, y + Math.sin(a) * s * 0.05);
    for (let k = right.length - 2; k >= 0; k -= 2) left.push(right[k], right[k + 1]);
    fingers.push(left);
    tips.push({ x: x + Math.cos(a) * s * 0.05, y: y + Math.sin(a) * s * 0.05 });
  }
  return { fingers, tips };
}

/** Rot spreading in the ground: overlapping discs round `c`, so its edge is
 *  ragged and it is darkest in the middle. */
function rotBlot(g: Graphics, c: Pt, r: number, seed: number) {
  g.circle(c.x, c.y, r * 0.62);
  for (let i = 0; i < 6; i++) {
    const a = seed + i * 1.1;
    g.circle(c.x + Math.cos(a) * r * 0.42, c.y + Math.sin(a) * r * 0.36, r * (0.42 + 0.1 * (i % 3)));
  }
}

export const ROTROOT: Signature = {
  shake: 1.6,
  // It does not close on anything: the roots do the reaching.
  lunge: false,

  deliver(t: FxTools, m: SigMoment, seconds: number) {
    const s = m.size, c = centre(m.from), T = seconds, seed = rand(0, 100), v = s / 90;
    const ax = m.ahead.x, ay = m.ahead.y;
    // The rot spreading under it, lit at its edge by moss and grave-light.
    t.draw(T, (g, u) => { rotBlot(g, c, s * 0.62 * easeOut(span(u, 0, 0.7)), seed); g.fill({ color: ROT, alpha: 0.6 }); }, { dark: true });
    t.draw(T, (g, u) => {
      const r = s * 0.62 * easeOut(span(u, 0, 0.7));
      if (r > 1) g.ellipse(c.x, c.y, r * 1.02, r * 0.9).stroke({ width: 2, color: MOSS, alpha: 0.55 }).ellipse(c.x, c.y, r * 1.1, r * 0.98)
        .stroke({ width: 1.5, color: VIOLET, alpha: 0.4 });
    });
    // Root-tips worming up out of it round the card, twitching...
    const tips = Array.from({ length: 7 }, (_, i) => ({ a: seed + (i / 7) * TAU + rand(-0.25, 0.25), l: rand(0.18, 0.28), ph: rand(0, TAU) }));
    const spike = (u: number, p: { a: number; l: number; ph: number }) => {
      const grow = easeOut(span(u, 0.1, 0.8)), sway = 0.35 * Math.sin(u * T * 12 + p.ph);
      const bx = c.x + Math.cos(p.a) * s * 0.42, by = c.y + Math.sin(p.a) * s * 0.4, a = p.a + sway, l = s * p.l * grow;
      const nx = -Math.sin(a) * s * 0.035, ny = Math.cos(a) * s * 0.035;
      return [bx + nx, by + ny, bx + Math.cos(a) * l, by + Math.sin(a) * l, bx - nx, by - ny];
    };
    // ...and two hands of root breaking the soil on the side it faces.
    const hands = [-1, 1].map((sd) => ({
      e: { x: c.x + ax * s * 0.36 - ay * sd * s * 0.3, y: c.y + ay * s * 0.36 + ax * sd * s * 0.3 },
      h: Math.atan2(ay, ax) + sd * 0.5,
    }));
    t.draw(T, (g, u) => {
      for (const p of tips) g.poly(spike(u, p), true).fill({ color: BARK, alpha: 0.9 });
      const open = easeOut(span(u, 0.35, 1));
      if (open > 0.02) for (const hd of hands) for (const f of hand(hd.e, hd.h, s * 0.62, open, 0.1 * open).fingers) g.poly(f, true).fill({ color: BARK, alpha: 0.9 });
    }, { dark: true });
    t.draw(T, (g, u) => {
      for (const p of tips) g.poly(spike(u, p), true).stroke({ width: 1.3, color: MOSS, alpha: 0.75 });
      const open = easeOut(span(u, 0.35, 1));
      if (open > 0.02)
        for (const hd of hands) {
          const { fingers, tips: ends } = hand(hd.e, hd.h, s * 0.62, open, 0.1 * open);
          for (const f of fingers) g.poly(f, true).stroke({ width: 1.3, color: MOSS, alpha: 0.8 });
          for (const p of ends) g.circle(p.x, p.y, 1.6).fill({ color: BONE, alpha: 0.9 });
        }
    });
    // The grave-light in its heart, swelling, and spores lifting off the rot.
    t.charge(c, s * 1.3, VIOLET, 0.5, T);
    let acc = 0;
    t.draw(T, (_g, u, dt) => {
      acc += 40 * dt;
      for (; acc >= 1; acc--) {
        const a = rand(0, TAU), r = s * rand(0.1, 0.6) * easeOut(u);
        t.spark(c.x + Math.cos(a) * r, c.y + Math.sin(a) * r * 0.9, rand(-15, 15) * v, -rand(20, 60) * v, rand(0.5, 0.9), SPORE);
      }
    });
  },

  land(t: FxTools, m: SigMoment) {
    const s = m.size, c = centre(m.from), v = s / 90, seed = rand(0, 100);
    // THE ROT HEAVES: the grave-light flares in its heart, the ground round it
    // bursts, the rot spreads wide under it while the roots are out, and a
    // ring of it runs out across the ground.
    flare(t, c, s * 1.7, VIOLET, 0.55, 0.4);
    for (let i = 0; i < 18; i++) {
      const a = rand(0, TAU), sp = rand(80, 200) * v;
      t.spark(c.x + Math.cos(a) * s * 0.4, c.y + Math.sin(a) * s * 0.36, Math.cos(a) * sp * 0.6, -rand(160, 320) * v, rand(0.4, 0.7), SOIL);
    }
    const D = 1.3;
    const fade = (time: number) => 1 - span(time, 0.95, D);
    t.draw(D, (g, u) => {
      const time = u * D;
      rotBlot(g, c, s * (0.62 + 0.36 * easeOut(span(time, 0, 0.3))), seed);
      g.fill({ color: ROT, alpha: 0.62 * fade(time) });
    }, { dark: true });
    const ringR = (u: number) => s * (0.6 + 1.3 * easeOut(u));
    t.draw(0.6, (g, u) => { g.circle(c.x, c.y, ringR(u)).stroke({ width: s * 0.2 * (1 - 0.5 * u), color: ROT, alpha: 0.45 * (1 - u) }); }, { dark: true });
    t.draw(0.6, (g, u) => { g.circle(c.x, c.y, ringR(u) + s * 0.1 * (1 - 0.5 * u)).stroke({ width: 1.6, color: MOSS, alpha: 0.55 * (1 - u) }); });

    // THE ROOTS ERUPT round it — short and thick, bursting out of the rot on
    // every side — and the long ones tear along the ground to every card in
    // reach, each opening into a hand that closes round its card and drags at
    // it.
    const crown = Array.from({ length: 8 }, (_, i) => {
      const a = seed + (i / 8) * TAU + rand(-0.2, 0.2), l = s * rand(0.62, 0.82);
      return rootPath({ x: c.x + Math.cos(a) * s * 0.22, y: c.y + Math.sin(a) * s * 0.2 },
        { x: c.x + Math.cos(a) * l, y: c.y + Math.sin(a) * l * 0.92 }, s * 0.22);
    });
    const crownUpto = (p: Root, time: number) => p.total * easeOut(span(time, 0.0, 0.12)) * (1 - easeOut(span(time, 0.62, 1.0)));
    const hits = m.targets.map((r, i) => {
      const p = centre(r), d = Math.hypot(p.x - c.x, p.y - c.y) || 1, ux = (p.x - c.x) / d, uy = (p.y - c.y) / d;
      const pw = Math.max(0.55, Math.min(2, m.power[i] ?? 1));
      const root = rootPath({ x: c.x + ux * s * 0.3, y: c.y + uy * s * 0.3 }, { x: p.x - ux * s * 0.32, y: p.y - uy * s * 0.32 }, s * 0.27 * (0.85 + 0.15 * pw));
      return { r, p, d, ux, uy, root, pw, killed: !!m.killed[i] };
    });
    const dmax = Math.max(s, ...hits.map((h) => h.d));
    const arrive = hits.map((h) => 0.1 + 0.22 * (h.d / dmax));
    /** How far each root has run, its hand's reach and grip, and the tug. */
    const pose = (i: number, time: number) => {
      const h = hits[i], at = arrive[i];
      const upto = h.root.total * easeOut(span(time, 0.02, at)) * (1 - 0.45 * span(time, 0.95, D));
      const reach = easeOut(span(time, at - 0.02, at + 0.1)), grip = easeOut(span(time, at + 0.08, at + 0.26));
      const tug = Math.sin(Math.PI * span(time, at + 0.26, at + 0.5)) * s * 0.08;
      const end = { x: h.p.x - h.ux * (s * 0.32 + tug), y: h.p.y - h.uy * (s * 0.32 + tug) };
      return { upto, reach, grip, end, h: Math.atan2(h.uy, h.ux) };
    };
    const HAND = s * 1.15;
    t.draw(D, (g, u) => {
      const time = u * D, a = fade(time);
      for (const p of crown) {
        const upto = crownUpto(p, time);
        if (upto > 2) g.poly(rootBody(p, upto, s * 0.12), true).fill({ color: BARK, alpha: 0.92 });
      }
      hits.forEach((h, i) => {
        const o = pose(i, time);
        if (o.upto < 2) return;
        g.poly(rootBody(h.root, o.upto, s * 0.15), true).fill({ color: BARK, alpha: 0.92 * a });
        for (const th of rootThorns(h.root, o.upto)) g.poly(th, true).fill({ color: BARK, alpha: 0.92 * a });
        if (o.reach > 0.02) {
          for (const f of hand(o.end, o.h, HAND, o.reach, o.grip).fingers) g.poly(f, true).fill({ color: BARK, alpha: 0.92 * a });
          // The rot it leaves on the card it holds.
          if (o.grip > 0.1) {
            rotBlot(g, h.p, s * 0.32 * o.grip, seed + i);
            g.fill({ color: ROT, alpha: 0.4 * o.grip * a });
          }
        }
      });
    }, { dark: true });
    t.draw(D, (g, u) => {
      const time = u * D, a = fade(time), pulse = 0.7 + 0.3 * Math.sin(time * 18);
      /** Lit, a root is moss at its edges over a body gone mossy, with the
       *  grave-light down its vein. */
      const lit = (p: Root, upto: number, al: number) => {
        const body = rootBody(p, upto, s * 0.15);
        g.poly(body, true).fill({ color: 0x33462a, alpha: 0.3 * al }).stroke({ width: 1.3, color: MOSS, alpha: 0.4 * al, join: "round" });
        const vein: number[] = [];
        for (let k = 0; k <= 12; k++) { rootAt(p, (upto * 0.94 * k) / 12); vein.push(RA.x, RA.y); }
        g.moveTo(vein[0], vein[1]);
        for (let k = 2; k < vein.length; k += 2) g.lineTo(vein[k], vein[k + 1]);
        g.stroke({ width: 2.2, color: VIOLET, alpha: 0.75 * pulse * al, cap: "round", join: "round" });
      };
      for (const p of crown) {
        const upto = crownUpto(p, time);
        if (upto > 2) lit(p, upto, 1);
      }
      hits.forEach((h, i) => {
        const o = pose(i, time);
        if (o.upto < 2) return;
        lit(h.root, o.upto, a);
        for (const th of rootThorns(h.root, o.upto)) g.poly(th, true).stroke({ width: 1.1, color: MOSS, alpha: 0.45 * a });
        if (o.reach > 0.02) {
          const { fingers, tips } = hand(o.end, o.h, HAND, o.reach, o.grip);
          for (const f of fingers) g.poly(f, true).fill({ color: 0x33462a, alpha: 0.3 * a }).stroke({ width: 1.4, color: MOSS, alpha: 0.6 * a, join: "round" });
          for (const p of tips) g.circle(p.x, p.y, Math.max(1.6, s * 0.024)).fill({ color: BONE, alpha: 0.95 * a });
        }
      });
    });
    // Grave-dirt thrown up where each root breaks the ground as it runs...
    let dirt = 0;
    t.draw(0.36, (_g, u, dt) => {
      dirt += 110 * dt;
      for (; dirt >= 1; dirt--) {
        const i = Math.floor(rand(0, hits.length)), o = pose(i, u * 0.36);
        if (o.upto < 4 || o.upto >= hits[i].root.total - 1) continue;
        rootAt(hits[i].root, o.upto);
        t.spark(RA.x, RA.y, rand(-60, 60) * v, -rand(80, 200) * v, rand(0.3, 0.5), SOIL);
      }
    });
    // ...and where each hand closes, the card is clutched: grave-light, spores.
    hits.forEach((h, i) => {
      t.later(arrive[i] + 0.22, () => {
        flare(t, h.p, s * 1.1, VIOLET, 0.4, 0.3);
        for (let k = 0; k < Math.round(8 + 4 * h.pw + (h.killed ? 8 : 0)); k++) {
          const a = rand(0, TAU), r = s * rand(0.1, 0.35);
          t.spark(h.p.x + Math.cos(a) * r, h.p.y + Math.sin(a) * r, rand(-20, 20) * v, -rand(30, 80) * v, rand(0.5, 0.8), SPORE);
        }
      });
    });
  },
};
