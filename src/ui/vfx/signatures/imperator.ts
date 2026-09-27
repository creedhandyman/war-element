/** IMPERATOR — Strike of Dawn. "Spawn Heir (10/10/2 shields/SP10) — or, if an
 *  Heir already stands, a random DAWN Epic instead — then command the charge:
 *  every ally immediately fires a basic attack." Keeper of the Eternal Vigil:
 *  "He names a successor, gives one order, and the whole line answers it at
 *  once."
 *
 *  He strikes nothing himself, so nothing leaves him in the DELIVERY: he
 *  raises his blade. A sword of dawn light rises up out of his card, point to
 *  the sky, as gold gathers in to him, and a glint runs up the blade as it
 *  tops out.
 *
 *  The LANDING is the order, in the rules' own sequence. The blade flares
 *  white, a tall glint struck off its point, and a ring goes out from him. A
 *  pillar of light comes down on the square where the Heir (or the Epic) is
 *  named, crowned with a halo. Golden rays race from him to every ally, each
 *  lit as the order reaches it; and the moment the last has heard, the whole
 *  line answers at once — from each ally a lance of light to the nearest
 *  enemy it could have struck, a small sunburst where it lands. The targets
 *  here are what the ALLIES' attacks hit, not his, so every one of them is
 *  given a lance: each ally takes its nearest, and any target none chose is
 *  taken by the ally nearest it (by him, if he stands alone). */
import type { Graphics } from "pixi.js";
import { centre, lerpPt, rand } from "../looks/base";
import type { FxTools, Pt, SparkStyle } from "../looks/types";
import type { Signature, SigMoment } from "./types";

type Box = { x: number; y: number; w: number; h: number };

const TAU = Math.PI * 2;
const WHITE = 0xffffff, PALE = 0xfff1b3, GOLD = 0xffd54f, DEEP = 0xe0a41c, WARM = 0xffe38a;
/** Glitter: a mote walks it as it ages, flicking white to deep gold. */
const GLINT = [WHITE, DEEP, WHITE, GOLD, PALE, DEEP, WHITE, DEEP];
/** A needle of light off a strike: dead straight and fast. */
const NEEDLE: SparkStyle = { palette: [WHITE, PALE, GOLD], gravity: 0, drag: 0.03, size: [6, 2], streak: true };
/** Gold gathering in to him while he raises the blade. */
const GATHER: SparkStyle = { palette: [DEEP, GOLD, PALE, WHITE], gravity: 0, drag: 1, size: [3, 6], streak: true };
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeOut = (x: number) => 1 - (1 - x) * (1 - x);

/** When the order leaves him, how long it takes to reach the farthest ally,
 *  the beat before the line answers, and a lance's flight. */
const ORDER = 0.06, RUN = 0.15, ANSWER = 0.05, THRUST = 0.11;

/** A four-point star: two long arms (`r` along `rot`, `r2` across it) pinched
 *  to a waist `w`. */
function star(g: Graphics, x: number, y: number, r: number, r2: number, w: number, rot: number, color: number, alpha: number) {
  if (alpha <= 0.01 || (r < 0.5 && r2 < 0.5)) return;
  const pts: number[] = [];
  for (let i = 0; i < 8; i++) {
    const a = rot + (i * Math.PI) / 4;
    const d = i % 2 ? w : i % 4 === 0 ? r : r2;
    pts.push(x + Math.cos(a) * d, y + Math.sin(a) * d);
  }
  g.poly(pts).fill({ color, alpha });
}

/** A flare: a gold star behind a white one, a hot dot at its heart. */
function flare(g: Graphics, x: number, y: number, r: number, alpha: number, rot = 0, wide = 1) {
  if (alpha <= 0.01 || r < 0.5) return;
  star(g, x, y, r * 1.3 * wide, r * 1.3, r * 0.2, rot, GOLD, alpha * 0.45);
  star(g, x, y, r * wide, r, r * 0.07, rot, WHITE, alpha);
  g.circle(x, y, r * 0.16).fill({ color: PALE, alpha: alpha * 0.85 });
}

/** THE SWORD OF DAWN, standing point-up from its crossguard at (x, y): a
 *  blade `len` long and `w` wide in a glow of its own, a white fuller down
 *  it, the guard, the grip and the pommel below. `heat` 0..1 whitens it. */
function sword(g: Graphics, x: number, y: number, len: number, w: number, alpha: number, heat = 0) {
  if (alpha <= 0.01 || len < 2) return;
  const tip = y - len, hw = w / 2, taper = Math.min(len * 0.3, w * 1.8);
  const blade = [x - hw, y, x - hw, tip + taper, x, tip, x + hw, tip + taper, x + hw, y];
  const halo = [x - hw * 2.4, y + w * 0.3, x - hw * 2.4, tip + taper, x, tip - w * 1.3, x + hw * 2.4, tip + taper, x + hw * 2.4, y + w * 0.3];
  g.poly(halo).fill({ color: GOLD, alpha: 0.24 * alpha });
  g.poly(blade).fill({ color: heat > 0.5 ? PALE : GOLD, alpha: (0.55 + 0.3 * heat) * alpha }).stroke({ width: 1.5, color: WHITE, alpha: 0.9 * alpha });
  g.moveTo(x, y - w * 0.4).lineTo(x, tip + taper * 0.6).stroke({ width: Math.max(1, w * 0.22), color: WHITE, alpha: (0.7 + 0.3 * heat) * alpha });
  // Guard, grip and pommel: gold, rimmed in light.
  g.roundRect(x - w * 2.1, y - w * 0.28, w * 4.2, w * 0.56, w * 0.2).fill({ color: DEEP, alpha: 0.85 * alpha })
    .stroke({ width: 1.2, color: WARM, alpha: 0.9 * alpha });
  g.rect(x - w * 0.24, y + w * 0.28, w * 0.48, w * 1.5).fill({ color: DEEP, alpha: 0.8 * alpha });
  g.circle(x, y + w * 2.0, w * 0.34).fill({ color: GOLD, alpha: 0.9 * alpha }).stroke({ width: 1, color: WHITE, alpha: 0.8 * alpha });
}

/** A shaft of light standing from `top` down onto `bottom`, brightest at its
 *  foot: stacked slabs, each lower one adding to those above it. */
function pillar(g: Graphics, x: number, top: number, bottom: number, w: number, alpha: number) {
  if (alpha <= 0.01 || w < 0.5) return;
  const h = bottom - top;
  for (let i = 0; i < 5; i++) g.rect(x - w / 2, top + (h * i) / 5, w, h * (1 - i / 5)).fill({ color: GOLD, alpha: alpha * 0.1 });
  g.rect(x - w * 0.12, top, w * 0.24, h).fill({ color: WHITE, alpha: alpha * 0.4 });
}

/** A crown of light: a gold ring wearing short rays, long and short in turn. */
function crown(g: Graphics, c: Pt, R: number, rays: number, rayLen: number, spin: number, alpha: number) {
  if (alpha <= 0.01) return;
  g.circle(c.x, c.y, R).stroke({ width: 6, color: GOLD, alpha: alpha * 0.25 });
  g.circle(c.x, c.y, R).stroke({ width: 2, color: WARM, alpha: alpha * 0.95 });
  for (let i = 0; i < rays; i++) {
    const a = spin + (i / rays) * TAU, l = rayLen * (i % 2 ? 0.5 : 1);
    g.moveTo(c.x + Math.cos(a) * (R + 3), c.y + Math.sin(a) * (R + 3)).lineTo(c.x + Math.cos(a) * (R + 3 + l), c.y + Math.sin(a) * (R + 3 + l));
  }
  g.stroke({ width: 2, color: PALE, alpha: alpha * 0.8 });
}

/** Who strikes whom: each ally at the enemy nearest it, and any target none
 *  of them chose by the ally nearest it — every target is struck. With no
 *  ally on the board, the strikes are his. */
function charges(m: SigMoment): { from: Pt; target: number }[] {
  const allies = m.allies.map(centre), foes = m.targets.map(centre);
  if (!foes.length) return [];
  const from = allies.length ? allies : [centre(m.from)];
  const d = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);
  const out: { from: Pt; target: number }[] = [];
  const struck = new Set<number>();
  for (const p of from) {
    let best = 0;
    foes.forEach((q, ti) => { if (d(p, q) < d(p, foes[best])) best = ti; });
    out.push({ from: p, target: best });
    struck.add(best);
  }
  foes.forEach((q, ti) => {
    if (struck.has(ti)) return;
    let best = from[0];
    for (const p of from) if (d(p, q) < d(best, q)) best = p;
    out.push({ from: best, target: ti });
  });
  return out;
}

export const IMPERATOR: Signature = {
  shake: 1.1,
  // He gives the order; he does not charge with it.
  lunge: false,

  deliver(t: FxTools, m: SigMoment, seconds: number) {
    const c = centre(m.from), s = m.size, T = seconds;
    const guard = { x: c.x, y: c.y + s * 0.14 };
    // HE RAISES HIS BLADE: it rises out of his card point-first and tops out
    // with a glint running up it.
    t.draw(T, (g, u) => {
      const rise = easeOut(clamp01(u / 0.75));
      sword(g, guard.x, guard.y, s * 1.15 * rise, s * 0.16, Math.min(1, u * 5));
      const q = clamp01((u - 0.72) / 0.28);
      if (q > 0 && q < 1) {
        const y = guard.y - s * 1.1 * q;
        star(g, guard.x, y, s * 0.2 * Math.sin(Math.PI * q), s * 0.2 * Math.sin(Math.PI * q), s * 0.02, 0, WHITE, 1);
      }
    });
    t.charge(c, s * 1.3, GOLD, 0.45, T);
    // Gold gathering in to him, timed to reach him as it dies.
    let acc = 0;
    t.draw(T, (_g, u, dt) => {
      if (u > 0.9) return;
      acc += dt * 60 * t.quality;
      for (; acc >= 1; acc--) {
        const a = rand(0, TAU), R = s * rand(0.7, 1.3), life = rand(0.18, 0.32);
        const x = c.x + Math.cos(a) * R, y = c.y + Math.sin(a) * R;
        t.spark(x, y, (c.x - x) / life, (c.y - y) / life, life, GATHER);
      }
    });
  },

  land(t: FxTools, m: SigMoment) {
    const c = centre(m.from), s = m.size;
    const guard = { x: c.x, y: c.y + s * 0.14 }, tipY = guard.y - s * 1.15;

    // THE BLADE FLARES: white-hot for a moment, a tall glint struck off its
    // point (a blade catching the sun, not a pillar — the pillar is the
    // Heir's), and the order going out from him as a ring.
    t.draw(0.5, (g, u) => {
      const a = Math.pow(1 - u, 1.2), heat = clamp01(1 - u * 2.5);
      sword(g, guard.x, guard.y, s * 1.15, s * 0.16 * (1 + 0.2 * heat), a, heat);
      const glint = easeOut(clamp01(u / 0.12));
      flare(g, guard.x, tipY, s * 0.42 * glint * (1 - 0.45 * u), a, -Math.PI / 2, 2.4);
      flare(g, guard.x, tipY, s * 0.3 * glint * (1 - 0.45 * u), a, -Math.PI / 4, 1);
    });
    t.flash({ x: guard.x, y: tipY }, PALE, 0.4 * (s / 90));
    t.ring(m.from, WARM, 0.5, 1.7, 0.45, 4);
    t.emit({ count: 10, palette: GLINT, from: { x: guard.x - s * 0.15, y: tipY, w: s * 0.3, h: s * 0.9 }, dir: [-100, -80],
      speed: [20, 60], gravity: -20, drag: 0.5, life: [0.5, 0.9], size: [6, 2] });

    // THE HEIR NAMED: a pillar of light down on the square it stands on,
    // crowned with a halo as it lands.
    for (const r of m.spawned) {
      const p = centre(r), top = r.y - s * 1.4, foot = p.y + s * 0.3;
      t.draw(0.6, (g, u) => {
        const drop = easeOut(clamp01(u / 0.14));
        const a = u < 0.2 ? 1 : Math.pow(1 - (u - 0.2) / 0.8, 1.2);
        pillar(g, p.x, top, top + (foot - top) * drop, s * (0.75 - 0.35 * u), a);
        const cr = clamp01((u - 0.1) / 0.2);
        if (cr > 0) crown(g, p, s * (0.62 - 0.14 * easeOut(cr)), 12, s * 0.13, u * 0.8, a * cr);
        flare(g, p.x, p.y, s * 0.4 * (1 - 0.4 * u), a * clamp01((u - 0.08) * 8), 0, 1.2);
      }, { delay: 0.04 });
      t.later(0.1, () => t.glow(r, GOLD, 0.45, 0.55, 1.1));
      t.emit({ count: 14, palette: [WHITE, PALE, GOLD], from: { x: p.x - s * 0.2, y: top, w: s * 0.4, h: s * 1.2 }, dir: [88, 92],
        speed: [300, 420], gravity: 0, drag: 1, life: [0.15, 0.3], size: [6, 2], streak: true });
    }

    // THE ORDER: a ray racing from him to every ally, each lit as it lands.
    const allies = m.allies.map(centre);
    const far = Math.max(1, ...allies.map((p) => Math.hypot(p.x - c.x, p.y - c.y)));
    const heard = allies.map((p) => ORDER + RUN * Math.sqrt(Math.hypot(p.x - c.x, p.y - c.y) / far));
    // ...and the whole line answers AT ONCE, the moment the last has heard.
    const answer = Math.max(ORDER, ...heard) + ANSWER;
    allies.forEach((p, i) => {
      const at = heard[i], run = Math.max(0.02, at - ORDER), D = run + 0.25;
      t.draw(D, (g, u) => {
        const time = u * D, f = clamp01(time / run);
        const head = lerpPt(c, p, f * f * (3 - 2 * f));
        const fade = time < run ? 1 : 1 - (time - run) / 0.25;
        g.moveTo(c.x, c.y).lineTo(head.x, head.y).stroke({ width: 6, color: GOLD, alpha: 0.22 * fade });
        g.moveTo(c.x, c.y).lineTo(head.x, head.y).stroke({ width: 2.2, color: PALE, alpha: 0.9 * fade });
        if (f < 1) star(g, head.x, head.y, s * 0.15, s * 0.15, s * 0.022, 0, WHITE, 1);
      }, { delay: ORDER });
      t.later(at, () => {
        t.ring(m.allies[i], WARM, 0.45, 1.0, 0.3, 3);
        t.draw(0.3, (g, u) => star(g, p.x, p.y - s * 0.38, s * 0.16 * (1 - u), s * 0.16 * (1 - u), s * 0.02, 0, WHITE, 1 - u));
      });
    });

    // THE LINE ANSWERS: from each ally a lance of light at its enemy, and a
    // small sunburst where it lands.
    for (const ch of charges(m)) {
      const to = centre(m.targets[ch.target]);
      const power = m.power[ch.target] ?? 1;
      t.draw(THRUST + 0.12, (g, u) => {
        const time = u * (THRUST + 0.12), f = clamp01(time / THRUST);
        const head = lerpPt(ch.from, to, f * f);
        const tail = lerpPt(ch.from, to, Math.max(0, f * f - 0.45) + clamp01((time - THRUST) / 0.12) * 0.45);
        const a = time < THRUST ? 1 : 1 - (time - THRUST) / 0.12;
        g.moveTo(tail.x, tail.y).lineTo(head.x, head.y).stroke({ width: 9, color: GOLD, alpha: 0.22 * a });
        g.moveTo(tail.x, tail.y).lineTo(head.x, head.y).stroke({ width: 3, color: WHITE, alpha: 0.9 * a });
        if (f < 1) {
          // A spear-point of light: needle-sharp at the head, swelling just
          // behind it.
          const dx = to.x - ch.from.x, dy = to.y - ch.from.y, dl = Math.hypot(dx, dy) || 1;
          const ux = dx / dl, uy = dy / dl, back = s * 0.34, hw = s * 0.055;
          const bx = head.x - ux * back, by = head.y - uy * back, sx = head.x - ux * back * 0.35, sy = head.y - uy * back * 0.35;
          g.poly([bx, by, sx - uy * hw, sy + ux * hw, head.x, head.y, sx + uy * hw, sy - ux * hw]).fill({ color: PALE, alpha: 0.9 });
          flare(g, head.x, head.y, s * 0.13, 1, Math.atan2(dy, dx), 1.6);
        }
      }, { delay: answer });
      t.later(answer + THRUST, () => sunburst(t, m.targets[ch.target], power, s, !!m.killed[ch.target]));
    }
  },
};

/** A small sunburst where a lance lands: a flare with rays thrown out past it,
 *  a thin gold ring and needles of light, sized by the hit. A kill gets a
 *  shaft of light over it besides. */
function sunburst(t: FxTools, r: Box, power: number, s: number, killed: boolean) {
  const c = centre(r), k = Math.max(0.55, Math.min(1.6, power)), spin = rand(0, TAU);
  t.draw(0.42, (g, u) => {
    const a = Math.pow(1 - u, 1.3), grow = 0.5 + 0.5 * Math.min(1, u * 6);
    const R = s * 0.3 * k * grow;
    // Rays thrown well past the flare, long and short in turn: a sunburst.
    for (let i = 0; i < 12; i++) {
      const q = spin + (i / 12) * TAU, l = R * (i % 2 ? 1.5 : 2.4) * (0.55 + 0.45 * easeOut(Math.min(1, u * 3)));
      g.moveTo(c.x + Math.cos(q) * R * 0.3, c.y + Math.sin(q) * R * 0.3).lineTo(c.x + Math.cos(q) * l, c.y + Math.sin(q) * l);
    }
    g.stroke({ width: 2, color: GOLD, alpha: 0.85 * a });
    flare(g, c.x, c.y, R, a, 0, 1.4);
    if (killed) pillar(g, c.x, r.y - s * 0.9 * easeOut(Math.min(1, u * 4)), c.y + s * 0.2, s * 0.45 * (1 - u), a);
  });
  t.ring(r, WARM, 0.5, 1.5 * k, 0.3, 2);
  t.glow(r, GOLD, 0.3 * Math.min(1.2, k), 0.4, 1.0);
  const n = Math.round(10 * k);
  for (let i = 0; i < n; i++) {
    const a = spin + (i % 4) * (Math.PI / 2) + rand(-0.2, 0.2), v = rand(200, 380) * (s / 90);
    t.spark(c.x, c.y, Math.cos(a) * v, Math.sin(a) * v, rand(0.15, 0.3), NEEDLE);
  }
}
