/** DESTRO — Phantom Chains. "DRAIN 2 max HP from all opponents and WEAKEN
 *  them." No damage: every opponent is bound, and a little of what it is
 *  taken. Phantom Chains weaken every opponent and take two max HP from each.
 *
 *  The art is a skeletal lich in white robes, a red gem burning at his chest,
 *  swinging glowing violet PHANTOM CHAINS round himself, wailing ghost skulls
 *  drifting in the dark round him. So the DELIVERY is the chains rising: two
 *  loops of linked violet chain swirling round his card, turning the way a
 *  chain swung overhead does, the gem lighting red at their centre, and ghost
 *  skulls drifting in round him.
 *
 *  The LANDING is the binding. From the gem a chain LASHES out to EVERY
 *  opponent at once — whipping out on a curve and straightening as it flies —
 *  and WRAPS it: the links coil twice round the card (the far side of each
 *  coil dim, behind it). Then the chains go TAUT with a jerk, the coils biting
 *  in (the WEAKEN), and a pale wisp of life is drawn out of each card and
 *  along its chain back to the gem (the DRAIN), which flares red as each one
 *  arrives. As the life leaves, a ghost skull rises wailing off every card and
 *  fades — and the chains let go and dissolve.
 *
 *  Chains and ghosts, not smoke: every chain is drawn as real LINKS, open
 *  rings alternating with links turned edge-on, so it reads as iron at a
 *  glance. The skulls' eyes and mouths are dark for real (`dark: true`) and
 *  cut out of their pale light, so they stay dark; the skulls are upright on
 *  the screen whichever way the board faces. */
import { centre, rand } from "../../looks/base";
import type { Graphics } from "pixi.js";
import type { FxTools, Pt, SparkStyle } from "../../looks/types";
import type { Signature, SigMoment } from "../types";

const TAU = Math.PI * 2;
/** The phantom chain: a white-violet sheen on lilac links, a violet glow. */
const SHEEN = 0xf6eeff, LILAC = 0xc9a6ff, VIOLET = 0x9a6ad8, DEEP = 0x6a3fc0;
/** The gem at his chest. */
const GEM = 0xff3550, GEM_HI = 0xffc0c8;
/** Ghosts, and the life drawn out: a cold pale white, a breath of green. */
const GHOST = 0xe8e6ff, LIFE = 0xe6fff0, MINT = 0xb8ffd4;
/** The hollow of a skull's eyes and mouth. Dark layer only. */
const INK = 0x0b0418;
/** Motes off a chain as it dissolves. */
const MOTE: SparkStyle = { palette: [SHEEN, LILAC, VIOLET, DEEP], gravity: -40, drag: 0.5, size: [3.5, 1.5], streak: false };
/** Life streaming off the wisp as it is dragged home. */
const STREAM: SparkStyle = { palette: [0xffffff, LIFE, MINT, LILAC], gravity: 0, drag: 0.4, size: [5, 1.5], streak: true };

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeOut = (x: number) => 1 - (1 - x) * (1 - x);
const easeIn = (x: number) => x * x;
/** 0 -> 1 as `u` runs from `a` to `b`. */
const span = (u: number, a: number, b: number) => clamp01((u - a) / (b - a));
/** Overshoots and settles: a coil biting in. */
const snap = (x: number) => (x >= 1 ? 1 : 1 + 2.7 * Math.pow(x - 1, 3) + 1.7 * Math.pow(x - 1, 2));

/** A glow sized to the board's squares (`flash` is sized in px). */
function flare(t: FxTools, p: Pt, size: number, color: number, peak: number, seconds: number) {
  t.glow({ x: p.x - size / 2, y: p.y - size / 2, w: size, h: size }, color, peak, seconds, 1);
}

// ── The chain ───────────────────────────────────────────────────────────────

/** One link of chain, where it sits and which way it lies. */
interface Link { x: number; y: number; ang: number; edge: boolean }

/** Links laid along a path (flat points), `L` px apart, the first `off` px
 *  in — every other one turned edge-on, the way a real chain hangs. */
function linksAlong(pts: number[], L: number, off = 0): Link[] {
  const out: Link[] = [];
  let next = off, run = 0, n = Math.floor(off / L);
  for (let i = 2; i < pts.length; i += 2) {
    const x0 = pts[i - 2], y0 = pts[i - 1], dx = pts[i] - x0, dy = pts[i + 1] - y0, l = Math.hypot(dx, dy);
    if (l < 1e-6) continue;
    while (next <= run + l) {
      const f = (next - run) / l;
      out.push({ x: x0 + dx * f, y: y0 + dy * f, ang: Math.atan2(dy, dx), edge: n % 2 === 1 });
      next += L;
      n++;
    }
    run += l;
  }
  return out;
}

/** A link as flat points: an oval `L` long along `ang` — open for a link
 *  seen face on, a slim bar for one turned edge-on. */
function linkPts(k: Link, L: number): number[] {
  const rx = L * 0.66, ry = k.edge ? L * 0.1 : L * 0.3, c = Math.cos(k.ang), s = Math.sin(k.ang), out: number[] = [];
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * TAU, x = Math.cos(a) * rx, y = Math.sin(a) * ry;
    out.push(k.x + x * c - y * s, k.y + x * s + y * c);
  }
  return out;
}

/** Stroke a run of links: a violet glow under them, the lilac iron, and a
 *  white sheen when the chain is drawn tight (`hot`). */
function chain(g: Graphics, ls: Link[], L: number, a: number, hot = 0) {
  if (a <= 0.01 || ls.length === 0) return;
  for (const k of ls) g.poly(linkPts(k, L), true);
  g.stroke({ width: Math.max(3, L * 0.45), color: DEEP, alpha: (0.3 + 0.2 * hot) * a, join: "round" });
  for (const k of ls) g.poly(linkPts(k, L), true);
  g.stroke({ width: Math.max(1.3, L * 0.16), color: hot > 0.5 ? SHEEN : LILAC, alpha: 0.95 * a, join: "round" });
}

/** Points round an ellipse about `p` (rx by ry, tilted `tilt`), from angle
 *  `a0` to `a1`: a coil of chain round a card. */
function coilPts(p: Pt, rx: number, ry: number, tilt: number, a0: number, a1: number): number[] {
  const out: number[] = [], n = Math.max(2, Math.ceil(Math.abs(a1 - a0) / 0.2)), c = Math.cos(tilt), s = Math.sin(tilt);
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n, x = Math.cos(a) * rx, y = Math.sin(a) * ry;
    out.push(p.x + x * c - y * s, p.y + x * s + y * c);
  }
  return out;
}

// ── Ghost skulls ────────────────────────────────────────────────────────────

/** A ghost skull's outline, in units of its size from its middle: a high
 *  round crown, the cheekbones, the face narrowing to the jaw — and a wisp of
 *  a tail trailing below it instead of a neck. `wail` (0..1) stretches the
 *  jaw down. */
function skullPts(x: number, y: number, k: number, wail: number, sway: number): number[] {
  const out: number[] = [];
  for (let i = 0; i <= 12; i++) {
    const a = Math.PI + (i / 12) * Math.PI;
    out.push(x + Math.cos(a) * k * 0.4, y - k * 0.05 + Math.sin(a) * k * 0.42);
  }
  const jaw = 0.3 + 0.18 * wail;
  out.push(x + k * 0.38, y + k * 0.12, x + k * 0.24, y + k * jaw);
  // The tail: down to a point, swaying.
  out.push(x + k * 0.1 + sway * k * 0.3, y + k * (jaw + 0.3), x + sway * k * 0.6, y + k * (jaw + 0.6));
  out.push(x - k * 0.1 + sway * k * 0.3, y + k * (jaw + 0.3));
  out.push(x - k * 0.24, y + k * jaw, x - k * 0.38, y + k * 0.12);
  return out;
}

/** Its hollows: two eye sockets slanting down at the outer corners (grief,
 *  not anger) and the mouth, a long open O when it wails. */
function hollows(x: number, y: number, k: number, wail: number): { eyes: [number, number, number, number][]; mouth: [number, number, number, number] } {
  return {
    eyes: [[x - k * 0.15, y - k * 0.04, k * 0.12, k * 0.11], [x + k * 0.15, y - k * 0.04, k * 0.12, k * 0.11]],
    mouth: [x, y + k * (0.18 + 0.06 * wail), k * (0.08 + 0.03 * wail), k * (0.05 + 0.1 * wail)],
  };
}

/** A ghost skull, dark half: its hollows, so they stay dark under its light. */
function skullDark(g: Graphics, x: number, y: number, k: number, wail: number, a: number) {
  if (a <= 0.01) return;
  const h = hollows(x, y, k, wail);
  for (const [ex, ey, rx, ry] of [...h.eyes, h.mouth]) g.ellipse(ex, ey, rx, ry);
  g.fill({ color: INK, alpha: 0.95 * a });
}

/** ...and its light: a pale ghostly body with the hollows cut out of it, a
 *  violet rim, and a faint cold glint in each socket. */
function skullLit(g: Graphics, x: number, y: number, k: number, wail: number, sway: number, a: number) {
  if (a <= 0.01) return;
  const pts = skullPts(x, y, k, wail, sway), h = hollows(x, y, k, wail);
  g.poly(pts, true).fill({ color: GHOST, alpha: 0.5 * a });
  for (const [ex, ey, rx, ry] of [...h.eyes, h.mouth]) g.ellipse(ex, ey, rx, ry).cut();
  g.poly(pts, true).stroke({ width: 4, color: VIOLET, alpha: 0.3 * a, join: "round" });
  g.poly(pts, true).stroke({ width: 1.4, color: GHOST, alpha: 0.85 * a, join: "round" });
  for (const [ex, ey] of h.eyes) g.circle(ex, ey + k * 0.01, Math.max(0.8, k * 0.025)).fill({ color: MINT, alpha: 0.8 * a });
}

// ── The landing at one card ─────────────────────────────────────────────────

/** A ghost skull rising wailing off a card as its life is taken, and
 *  fading. */
function wailOff(t: FxTools, p: Pt, s: number, delay: number) {
  const D = 0.6, k0 = s * 0.55, side = rand(-0.2, 0.2) * s, ph = rand(0, TAU);
  const where = (u: number) => ({
    x: p.x + side + Math.sin(u * 7 + ph) * s * 0.05,
    y: p.y - s * 0.05 - s * 0.5 * easeOut(u),
    k: k0 * (0.75 + 0.35 * u), wail: easeOut(span(u, 0.05, 0.4)),
    a: clamp01(u / 0.15) * (1 - span(u, 0.5, 1)), sway: Math.sin(u * 9 + ph) * 0.4,
  });
  t.draw(D, (g, u) => { const w = where(u); skullDark(g, w.x, w.y, w.k, w.wail, w.a); }, { dark: true, delay });
  t.draw(D, (g, u) => { const w = where(u); skullLit(g, w.x, w.y, w.k, w.wail, w.sway, w.a); }, { delay });
}

export const DESTRO: Signature = {
  shake: 0.6,
  // He binds from where he stands; the chains do the reaching.
  lunge: false,

  deliver(t: FxTools, m: SigMoment, seconds: number) {
    const T = seconds, c = centre(m.from), s = m.size, L = s * 0.12, gem = gemOf(c, s);
    // Two chains swung round him, each a coil turning on its own tilt, rising
    // up his card as they spin up, the near side bright and the far side dim.
    const loops = [{ tilt: 0.16, w: 9, a0: rand(0, TAU), y0: 0.3 }, { tilt: -0.16, w: -8, a0: rand(0, TAU), y0: 0.02 }];
    t.draw(T, (g, u) => {
      const time = u * T, grow = easeOut(span(time, 0, T * 0.6)), a = clamp01(time / 0.08);
      for (const lp of loops) {
        const o = { x: c.x, y: c.y + s * (lp.y0 - 0.25 * grow) };
        const rx = s * (0.5 + 0.28 * grow), ry = rx * 0.32, sweep = TAU * (0.45 + 0.4 * grow);
        const a0 = lp.a0 + lp.w * time;
        // Split at the far side so the coil's back half sits dimmer.
        const pts = coilPts(o, rx, ry, lp.tilt, a0, a0 + sweep * Math.sign(lp.w));
        const ls = linksAlong(pts, L, (lp.w * time * s * 0.8) % L + L);
        const back = ls.filter((k) => Math.sin(Math.atan2((k.y - o.y), (k.x - o.x)) - lp.tilt) < 0);
        const front = ls.filter((k) => !back.includes(k));
        chain(g, back, L, a * 0.4);
        chain(g, front, L, a);
      }
      gemLit(g, gem, s, 0.4 + 0.6 * easeOut(span(time, 0, T)));
    });
    // The ghosts gathering round him.
    const ghosts = [0, 1, 2].map((i) => ({ a0: (i / 3) * TAU + rand(-0.4, 0.4), w: rand(1.5, 2.5) * (i % 2 ? 1 : -1), born: T * (0.1 + 0.2 * i), ph: rand(0, TAU) }));
    const ghostAt = (gh: typeof ghosts[number], time: number) => {
      const age = time - gh.born, ang = gh.a0 + gh.w * time;
      return { x: c.x + Math.cos(ang) * s * 0.72, y: c.y - s * 0.1 + Math.sin(ang) * s * 0.4 + Math.sin(time * 5 + gh.ph) * s * 0.04, k: s * 0.36, a: 0.9 * clamp01(age / 0.15), sway: Math.sin(time * 8 + gh.ph) * 0.4 };
    };
    t.draw(T, (g, u) => { for (const gh of ghosts) { const q = ghostAt(gh, u * T); skullDark(g, q.x, q.y, q.k, 0.3, q.a); } }, { dark: true });
    t.draw(T, (g, u) => { for (const gh of ghosts) { const q = ghostAt(gh, u * T); skullLit(g, q.x, q.y, q.k, 0.3, q.sway, q.a); } });
    t.glow(m.from, VIOLET, 0.25, T, 1.3);
  },

  land(t: FxTools, m: SigMoment) {
    const c = centre(m.from), s = m.size, L = s * 0.12, gem = gemOf(c, s), v = s / 90;
    const LASH = 0.2, WRAP = 0.16, TAUT = LASH + WRAP, PULL = 0.34, D = 1.0;
    const hits = m.targets.map((r, i) => {
      const p = centre(r), dx = p.x - gem.x, dy = p.y - gem.y, d = Math.hypot(dx, dy) || 1;
      return { r, p, d, ux: dx / d, uy: dy / d, go: i * 0.025, side: i % 2 ? 1 : -1, k: Math.max(0.8, Math.min(1.3, (m.power[i] ?? 1) + 0.3)), killed: m.killed[i] ?? false };
    });
    t.flash(gem, GEM, 0.3 * (s / 80));
    flare(t, gem, s * 0.9, GEM, 0.4, 0.25);

    // Where a card's coils sit, how far round they have wound, and how tight.
    const coilOf = (h: typeof hits[number], time: number) => {
      const w = easeOut(span(time, h.go + LASH, h.go + TAUT)), bite = snap(span(time, h.go + TAUT, h.go + TAUT + 0.18));
      const rx = s * (0.6 - 0.1 * bite), ry = rx * 0.3;
      // Start winding on the side facing him, so the chain runs on into it.
      const a0 = Math.atan2(-h.uy, -h.ux) + Math.PI / 2;
      return { w, rx, ry, a0 };
    };
    const fadeOf = (time: number) => 1 - span(time, 0.78, D);

    t.draw(D, (g, u) => {
      const time = u * D, fade = fadeOf(time);
      for (const h of hits) {
        const q = span(time, h.go, h.go + LASH);
        if (q <= 0) continue;
        const hot = span(time, h.go + TAUT, h.go + TAUT + 0.05) * (1 - span(time, h.go + TAUT + 0.12, h.go + TAUT + 0.3));
        // THE LASH: the chain whipping out on a curve that straightens as it
        // flies — and, once it holds, dead straight and thrumming.
        const e = easeOut(q), head = { x: gem.x + (h.p.x - gem.x) * e, y: gem.y + (h.p.y - gem.y) * e };
        const bow = h.d * 0.28 * (1 - e) * h.side, thrum = s * 0.03 * Math.sin(time * 80) * hot;
        const pts: number[] = [];
        for (let i = 0; i <= 16; i++) {
          const f = i / 16, o = Math.sin(Math.PI * f) * (bow + thrum);
          pts.push(gem.x + (head.x - gem.x) * f - h.uy * o, gem.y + (head.y - gem.y) * f + h.ux * o);
        }
        chain(g, linksAlong(pts, L, L * 0.5), L, fade, hot);
        // THE WRAP: twice round the card, the far half of each coil dimmer.
        const cl = coilOf(h, time);
        if (cl.w > 0) {
          for (const [dy, lag] of [[-0.12, 0], [0.16, 0.25]] as const) {
            const w = clamp01(cl.w * 1.25 - lag);
            if (w <= 0) continue;
            const o = { x: h.p.x, y: h.p.y + s * dy }, tilt = -0.18;
            const ls = linksAlong(coilPts(o, cl.rx, cl.ry, tilt, cl.a0, cl.a0 + TAU * w), L, L * 0.5);
            const back = ls.filter((k) => Math.sin(Math.atan2(k.y - o.y, k.x - o.x) - tilt) < 0);
            chain(g, back, L, fade * 0.38);
            chain(g, ls.filter((k) => !back.includes(k)), L, fade, hot);
          }
        } else if (q < 1) {
          // The shackle at its head, flying open.
          g.circle(head.x, head.y, L * 0.7).stroke({ width: 2, color: SHEEN, alpha: fade });
        }
      }
      // The gem, burning brighter with each life it takes in.
      gemLit(g, gem, s, (1 - span(time, 0.85, D)) * (0.7 + 0.3 * Math.sin(time * 20)));
    });

    // THE DRAIN at each card: a jerk as the chain goes taut, then the life
    // drawn out along it to the gem, a ghost wailing off the card.
    for (const h of hits) {
      const at = h.go + TAUT;
      t.later(at, () => {
        t.ring(h.r, LILAC, 0.95, 0.6, 0.18, 2.5);
        flare(t, h.p, s, VIOLET, 0.35 * h.k, 0.3);
      });
      wailOff(t, h.p, s, at + 0.02);
      // The wisp: a pale comet riding the chain home, its tail streaming,
      // slowing off the card and quickening as the gem takes it.
      const W0 = at + 0.06;
      let acc = 0;
      t.draw(PULL, (g, u, dt) => {
        const e = easeIn(u) * 0.7 + u * 0.3, x = h.p.x + (gem.x - h.p.x) * e, y = h.p.y + (gem.y - h.p.y) * e;
        const back = Math.min(e, 0.22 * (0.4 + u)), tx = h.p.x + (gem.x - h.p.x) * (e - back), ty = h.p.y + (gem.y - h.p.y) * (e - back);
        g.moveTo(tx, ty).lineTo(x, y).stroke({ width: s * 0.14, color: MINT, alpha: 0.3, cap: "round" });
        g.moveTo(tx, ty).lineTo(x, y).stroke({ width: s * 0.05, color: LIFE, alpha: 0.95, cap: "round" });
        g.circle(x, y, s * 0.17).fill({ color: MINT, alpha: 0.25 });
        g.circle(x, y, s * 0.1).fill({ color: LIFE, alpha: 0.7 });
        g.circle(x, y, s * 0.055).fill({ color: 0xffffff, alpha: 1 });
        acc += dt * 45 * t.quality;
        for (; acc >= 1; acc--) t.spark(x, y, (-h.ux * 40 + rand(-30, 30)) * v, (-h.uy * 40 + rand(-30, 30)) * v, rand(0.15, 0.3), STREAM);
      }, { delay: W0 });
      // Home: the gem flares red.
      t.later(W0 + PULL, () => {
        t.flash(gem, GEM_HI, 0.18 * (s / 80));
        flare(t, gem, s * 0.8, GEM, 0.35, 0.22);
      });
      // A kill: the chain drags the whole of it out — a second, bigger ghost.
      if (h.killed) wailOff(t, h.p, s * 1.3, at + 0.2);
    }

    // The chains let go: motes of violet shed along them as they dissolve.
    t.later(0.8, () => {
      for (const h of hits) {
        const n = Math.round(6 * t.quality) + 2;
        for (let i = 0; i < n; i++) {
          const f = rand(0.1, 1), x = gem.x + (h.p.x - gem.x) * f, y = gem.y + (h.p.y - gem.y) * f;
          t.spark(x, y, rand(-25, 25) * v, rand(-50, -15) * v, rand(0.3, 0.5), MOTE);
        }
      }
    });
    t.later(TAUT + 0.4, () => t.ring(m.from, GEM, 0.35, 0.9, 0.3, 2.5));
  },
};

/** The gem at his chest: a little below his card's centre. */
const gemOf = (c: Pt, s: number): Pt => ({ x: c.x, y: c.y + s * 0.06 });

/** The gem, lit: a red heart with a white-pink core, burning `a`. */
function gemLit(g: Graphics, p: Pt, s: number, a: number) {
  if (a <= 0.01) return;
  g.circle(p.x, p.y, s * 0.12).fill({ color: GEM, alpha: 0.25 * a });
  g.poly([p.x, p.y - s * 0.07, p.x + s * 0.045, p.y, p.x, p.y + s * 0.07, p.x - s * 0.045, p.y], true)
    .fill({ color: GEM, alpha: 0.9 * a }).stroke({ width: 1.2, color: GEM_HI, alpha: 0.9 * a });
  g.circle(p.x, p.y - s * 0.012, s * 0.015).fill({ color: 0xffffff, alpha: a });
}
