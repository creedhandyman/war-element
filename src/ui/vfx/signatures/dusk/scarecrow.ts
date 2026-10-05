/** SCARECROW — Curtain Call. "Command the 4 closest allies that have a shot to
 *  each make their basic attack." Curtain Call makes the four nearest allies
 *  with a shot fire on cue.
 *
 *  Its art is a tattered scarecrow in a top hat working a puppeteer's
 *  crossbar, PUPPET STRINGS running down from it to scarecrow puppets that
 *  dance below, violet light and a pale moon. The allies' own attacks play
 *  their own effects afterwards: this move is the CUE, and it is drawn as a
 *  marionette show — not a banner or a signal, but strings, and a jerk on
 *  them.
 *
 *  The DELIVERY, when there is one, raises the crossbar: a dark wooden cross
 *  lifting up over the card, violet light along its edges, its own strings
 *  hanging slack to the card and swaying. It may not run at all (nothing may
 *  be in reach), so the LANDING carries the move: the crossbar stands over
 *  the card, and a thread runs out from its arms to above each of the four
 *  nearest allies, where a little control bar of its own hangs — and from
 *  each control the STRINGS DROP, straight down onto the puppet below, slack
 *  and swaying. Then the scarecrow JERKS the bar: it tips and lifts, straw
 *  flies off its card, every thread snaps taut, a kink of light runs out
 *  along each and down the strings, and each ally is yanked UP — its control
 *  bar lifting, a tug of light pulling up off the top of its card, the
 *  strings twitching. With foes in reach, a thin string-line whips out from
 *  each ally (whichever stands nearest that foe) and plucks it — the shot it
 *  is about to take. Last, the CURTAIN CALL: two halves of a dark velvet
 *  curtain sweep across the scarecrow's own card, meet, and part again as it
 *  takes its bow.
 *
 *  The strings are vertical marionette lines, never a radial web: the
 *  threads only carry the cue across the board, and every puppet hangs
 *  straight below its own control. The wood and the curtain are solid on the
 *  normal-blend layer, edged in violet so they read over an empty square. */
import { centre, rand } from "../../looks/base";
import type { Graphics } from "pixi.js";
import type { FxTools, Pt, SparkStyle } from "../../looks/types";
import type { Signature, SigMoment } from "../types";

type Box = SigMoment["from"];

const TAU = Math.PI * 2;
const WHITE = 0xffffff, STRING = 0xeee6ff, LILAC = 0xc9a6ff, VIOLET = 0x9a6ad8;
/** The crossbar's wood and the violet light along its edges (normal-blend
 *  layer), and the curtain's velvet. */
const WOOD = 0x2a1c16, WOOD_EDGE = 0x8f6ad8, VELVET = 0x1e0b30, VELVET_EDGE = 0xa77ef0;
/** Straw shaken off the scarecrow when it jerks the bar. */
const STRAW: SparkStyle = { palette: [0xfff0c0, 0xe8cf86, 0xb08a4a], gravity: 420, drag: 0.5, size: [5, 1.5], streak: true };
/** The tug of light pulled up off an ally as it is yanked. */
const TUG: SparkStyle = { palette: [WHITE, STRING, LILAC, VIOLET], gravity: -120, drag: 0.5, size: [7, 1.5], streak: true };
/** Violet drawn in to the crossbar as it is raised. */
const MOTE_IN: SparkStyle = { palette: [STRING, LILAC, VIOLET], gravity: 0, drag: 1, size: [6, 2], streak: true, swirl: 220 };

/** The landing's beats, s: the bar is in by BAR_IN; the threads run out over
 *  LINK0..LINK1 and the strings drop by DROP; the JERK; the kink runs along a
 *  thread at RUN squares per second and down the strings in DOWN; the
 *  string-lines whip out to the foes over WHIP from FLICK; the curtain closes
 *  over CURTAIN..SHUT and parts by BOW; everything is gone by END. */
const BAR_IN = 0.08, LINK0 = 0.06, LINK1 = 0.2, DROP = 0.3, JERK = 0.38, RUN = 9, DOWN = 0.05;
const FLICK = 0.6, WHIP = 0.12, CURTAIN = 0.68, SHUT = 0.82, BOW = 1.0, END = 1.08;

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeOut = (x: number) => 1 - (1 - x) * (1 - x);
/** A bump: 0 at the ends of `u`, 1 in its middle. */
const bump = (u: number) => (u <= 0 || u >= 1 ? 0 : Math.sin(Math.PI * u));
const rot = (p: Pt, c: Pt, a: number): Pt => {
  const dx = p.x - c.x, dy = p.y - c.y, ca = Math.cos(a), sa = Math.sin(a);
  return { x: c.x + dx * ca - dy * sa, y: c.y + dx * sa + dy * ca };
};

// ── Wood and string ──────────────────────────────────────────────────────────

/** A length of dark wood from `a` to `b` on the normal-blend layer: violet
 *  light along its edges, the wood over it. */
function wood(g: Graphics, a: Pt, b: Pt, w: number, alpha: number) {
  if (alpha <= 0.01) return;
  g.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ width: w + 2.4, color: WOOD_EDGE, alpha: 0.9 * alpha, cap: "round" })
    .moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ width: w, color: WOOD, alpha, cap: "round" });
}

/** A string from `a` to `b`: slack (swaying sideways by `sway` px, most at
 *  its middle) or sagging (`sag` px, screen-down), with a kink of light
 *  travelling along it at `kink` (0..1, outside = none). Returns its points
 *  and where the kink is. */
function string(a: Pt, b: Pt, sway: number, sag: number, phase: number, kink: number, kinkAmp: number, reach = 1) {
  const n = 14, dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len;
  const pts: number[] = [];
  let kp: Pt | null = null, best = 0.6 / n;
  for (let i = 0; i <= n; i++) {
    const f = (i / n) * reach, mid = Math.sin(Math.PI * f);
    const k = kink > 0 && kink < 1 ? kinkAmp * Math.exp(-Math.pow((f - kink) / 0.07, 2)) : 0;
    const off = sway * mid * Math.sin(phase + f * 4) + k;
    const x = a.x + dx * f + nx * off, y = a.y + dy * f + ny * off + sag * 4 * f * (1 - f);
    pts.push(x, y);
    if (k && Math.abs(f - kink) < best) { best = Math.abs(f - kink); kp = { x, y }; }
  }
  return { pts, kp };
}

/** Stroke a puppet string: a faint violet sheen, the fine silver line. */
function strung(g: Graphics, pts: number[], s: number, alpha: number) {
  if (alpha <= 0.01) return;
  g.poly(pts, false).stroke({ width: Math.max(2.5, s * 0.035), color: VIOLET, alpha: 0.16 * alpha, join: "round" })
    .poly(pts, false).stroke({ width: Math.max(1, s * 0.012), color: STRING, alpha: 0.9 * alpha, join: "round" });
}

/** The crossbar over a card: a long arm across and a short one up and down,
 *  standing at `K`, tipped by `tilt`. Its ends, as points. */
function cross(K: Pt, s: number, tilt: number) {
  return {
    l: rot({ x: K.x - s * 0.5, y: K.y }, K, tilt), r: rot({ x: K.x + s * 0.5, y: K.y }, K, tilt),
    t: rot({ x: K.x, y: K.y - s * 0.2 }, K, tilt), b: rot({ x: K.x, y: K.y + s * 0.24 }, K, tilt),
  };
}

/** Where the scarecrow's crossbar stands: over the top of its card. */
const barAt = (c: Pt, s: number): Pt => ({ x: c.x, y: c.y - s * 0.56 });

/** Where a string attaches on a card hung below a control: its two hands
 *  either side, its head between. */
const hands = (r: Box, s: number): Pt[] => {
  const c = centre(r);
  return [{ x: c.x - s * 0.24, y: c.y + s * 0.04 }, { x: c.x, y: r.y + r.h * 0.2 }, { x: c.x + s * 0.24, y: c.y + s * 0.04 }];
};

/** The four allies nearest it: the ones that take the cue. */
function cast(m: SigMoment): Box[] {
  const c = centre(m.from);
  return m.allies
    .map((r) => ({ r, d: Math.hypot(centre(r).x - c.x, centre(r).y - c.y) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, 4)
    .map((q) => q.r);
}

// ── The cue ──────────────────────────────────────────────────────────────────

/** A string-line WHIPPED from an ally to the foe it will hit: drawn out with
 *  a wave running down it that dies as it straightens, standing taut, a
 *  pluck at its end on the foe as it lands. */
function whip(t: FxTools, a: Pt, b: Pt, s: number, power: number, when: number) {
  const D = Math.max(0.25, END - when), ph = rand(0, TAU);
  t.draw(D, (g, u) => {
    const time = u * D, reach = easeOut(clamp01(time / WHIP)), fade = 1 - clamp01((time - (D - 0.22)) / 0.22);
    const amp = s * 0.1 * (1 - clamp01(time / (WHIP * 1.6)));
    const { pts } = string(a, b, amp, 0, ph - time * 40, -1, 0, reach);
    strung(g, pts, s, 0.9 * fade);
    if (reach < 1) g.circle(pts[pts.length - 2], pts[pts.length - 1], s * 0.03).fill({ color: WHITE, alpha: 0.95 });
  }, { delay: when });
  const k = Math.max(0.8, Math.min(1.4, power));
  // The pluck: the line's end snapping taut on the foe, a glint where it
  // catches.
  t.later(when + WHIP, () => t.flash(b, LILAC, 0.2 * k * (s / 80)));
  t.draw(0.3, (g, u) => {
    const L = s * 0.16 * k * Math.sin(Math.PI * Math.min(1, u * 1.4)), w = s * 0.02;
    if (L < 0.5) return;
    g.poly([b.x - L, b.y, b.x - w, b.y - w, b.x, b.y - L, b.x + w, b.y - w, b.x + L, b.y, b.x + w, b.y + w, b.x, b.y + L, b.x - w, b.y + w], true)
      .fill({ color: WHITE, alpha: 0.95 * (1 - u * 0.4) });
  }, { delay: when + WHIP });
}

/** An ally yanked up by its strings: its control bar's lift (0..1 over the
 *  jolt), a tug of light up off the top of its card. */
function yank(t: FxTools, r: Box, s: number) {
  const c = centre(r), top = { x: r.x, y: r.y, w: r.w, h: r.h * 0.5 };
  t.glow(top, LILAC, 0.32, 0.3, 0.9);
  const n = Math.max(3, Math.round(7 * t.quality));
  for (let i = 0; i < n; i++) {
    const x = c.x + rand(-0.32, 0.32) * s, v = rand(150, 230) * (s / 90);
    t.spark(x, r.y + r.h * 0.15, rand(-15, 15), -v, rand(0.18, 0.26), TUG);
  }
}

/** THE CURTAIN CALL over its own card: two halves of dark velvet sweep in
 *  from its sides, meet, and part again — pleats picked out in violet, a
 *  scalloped valance across the top. */
function curtain(t: FxTools, r: Box, s: number) {
  const D = END - CURTAIN;
  const shut = (time: number) => (time < SHUT ? easeOut(clamp01((time - CURTAIN) / (SHUT - CURTAIN))) : 1 - easeOut(clamp01((time - SHUT - 0.04) / (BOW - SHUT - 0.04))) * 0.85);
  const alive = (time: number) => clamp01((time - CURTAIN) / 0.03) * (1 - clamp01((time - (BOW - 0.02)) / (END - BOW + 0.02)));
  const x0 = r.x - s * 0.04, x1 = r.x + r.w + s * 0.04, y0 = r.y - s * 0.04, y1 = r.y + r.h + s * 0.02;
  /** One half: its outline, and where its pleats fall. */
  const half = (side: number, k: number) => {
    const edge = side < 0 ? x0 : x1, w = (r.w / 2 + s * 0.04) * k, inner = edge - side * w;
    // The hem gathers toward the outer edge, as a drawn curtain does.
    const hemIn = edge - side * w * 0.8;
    const pts = [edge, y0, inner, y0, inner + side * w * 0.05, (y0 + y1) / 2, hemIn, y1, edge, y1];
    const pleats: number[] = [];
    for (let i = 1; i <= 3; i++) pleats.push(edge - side * w * (i / 4));
    return { pts, pleats, inner };
  };
  t.draw(D, (g, u) => {
    const time = CURTAIN + u * D, k = shut(time), a = alive(time);
    for (const sd of [-1, 1]) g.poly(half(sd, k).pts, true).fill({ color: VELVET, alpha: 0.72 * a }).stroke({ width: 1.5, color: VELVET_EDGE, alpha: 0.85 * a });
  }, { dark: true, delay: CURTAIN });
  t.draw(D, (g, u) => {
    const time = CURTAIN + u * D, k = shut(time), a = alive(time);
    for (const sd of [-1, 1]) {
      const h = half(sd, k);
      for (const x of h.pleats) g.moveTo(x, y0 + s * 0.08).lineTo(x + sd * s * 0.03, y1 - s * 0.04);
      g.stroke({ width: 1, color: LILAC, alpha: 0.45 * a });
    }
    // The valance: a row of scallops along the top.
    const n = 5, w = (x1 - x0) / n;
    for (let i = 0; i < n; i++) g.moveTo(x0 + i * w, y0).quadraticCurveTo(x0 + (i + 0.5) * w, y0 + s * 0.12, x0 + (i + 1) * w, y0);
    g.stroke({ width: Math.max(1.5, s * 0.022), color: VELVET_EDGE, alpha: 0.9 * a });
  }, { delay: CURTAIN });
  t.later(SHUT, () => t.flash({ x: r.x + r.w / 2, y: r.y + r.h * 0.3 }, VIOLET, 0.3 * (s / 80)));
}

export const SCARECROW: Signature = {
  // A cue, not a blow.
  shake: 0.3,
  // It works the strings from where it stands.
  lunge: false,

  deliver(t: FxTools, m: SigMoment, seconds: number) {
    const c = centre(m.from), s = m.size, K = barAt(c, s), T = seconds;
    // THE CROSSBAR RAISED: up out of the card to stand over it, its strings
    // hanging slack to the card and swaying. It lingers a breath past the
    // landing, fading as the landing's bar fades in, so it does not blink.
    const D = T + 0.1;
    const at = (time: number) => {
      const up = easeOut(clamp01(time / (T * 0.6)));
      const k = { x: K.x, y: c.y + (K.y - c.y) * up };
      return { k, x: cross(k, s, 0.12 * Math.sin(time * 7)), a: clamp01(time / 0.06) * (1 - clamp01((time - T) / 0.1)) };
    };
    t.draw(D, (g, u) => {
      const { x, a } = at(u * D), w = Math.max(3, s * 0.06);
      wood(g, x.l, x.r, w, a);
      wood(g, x.t, x.b, w, a);
    }, { dark: true });
    t.draw(D, (g, u) => {
      const time = u * D, { x, a } = at(time);
      const ends = [x.l, x.b, x.r];
      hands(m.from, s).forEach((h, i) => strung(g, string(ends[i], h, s * 0.05, 0, time * 8 + i, -1, 0).pts, s, 0.8 * a * clamp01((time - T * 0.3) / 0.1)));
    });
    t.charge(K, s * 0.5, VIOLET, 0.5, T);
    const n = Math.round(10 * t.quality);
    for (let i = 0; i < n; i++)
      t.later(rand(0.15, 0.8) * T, () => {
        const a = rand(0, TAU), d = s * rand(0.3, 0.5), l = 0.2, v = d / l;
        t.spark(K.x + Math.cos(a) * d, K.y + Math.sin(a) * d, -Math.cos(a) * v - Math.sin(a) * v * 0.4, -Math.sin(a) * v + Math.cos(a) * v * 0.4, l, MOTE_IN, K);
      });
  },

  land(t: FxTools, m: SigMoment) {
    const c = centre(m.from), s = m.size, K = barAt(c, s);
    const troupe = cast(m);

    // The jerk: the bar tips and lifts hard, then settles back, rocking.
    const tilt = (time: number) => 0.1 * Math.sin(time * 7) - 0.32 * bump(clamp01((time - JERK) / 0.16)) + 0.08 * Math.sin(time * 13) * clamp01((time - JERK - 0.16) / 0.1);
    const lift = (time: number) => -s * 0.1 * bump(clamp01((time - JERK) / 0.16));
    const barX = (time: number) => cross({ x: K.x, y: K.y + lift(time) }, s, tilt(time));
    const alive = (time: number) => clamp01(time / BAR_IN) * (1 - clamp01((time - 0.92) / (END - 0.92)));

    // Each puppet: its control hung above it, the thread out to it from the
    // nearer arm of the crossbar, and when the kink reaches it.
    const puppets = troupe.map((r) => {
      const p = centre(r), Q = { x: p.x, y: r.y - s * 0.1 };
      const arm: "l" | "r" | "b" = Math.abs(p.x - c.x) < s * 0.3 ? "b" : p.x < c.x ? "l" : "r";
      const len = Math.hypot(Q.x - K.x, Q.y - K.y);
      const arrive = JERK + len / (RUN * s);
      return { r, Q, arm, len, arrive, ph: rand(0, TAU) };
    });
    // A puppet's own lift: its control yanked up as the kink comes down.
    const jolt = (time: number, at: number) => -s * 0.1 * bump(clamp01((time - at - DOWN) / 0.18));

    // THE WOOD: the crossbar, and each puppet's control.
    t.draw(END, (g, u) => {
      const time = u * END, a = alive(time), x = barX(time), w = Math.max(3, s * 0.06);
      wood(g, x.l, x.r, w, a);
      wood(g, x.t, x.b, w, a);
      for (const p of puppets) {
        const on = clamp01((time - LINK1) / 0.06) * a, y = p.Q.y + jolt(time, p.arrive), tt = 0.15 * Math.sin(time * 6 + p.ph);
        wood(g, rot({ x: p.Q.x - s * 0.27, y }, { x: p.Q.x, y }, tt), rot({ x: p.Q.x + s * 0.27, y }, { x: p.Q.x, y }, tt), Math.max(2.5, s * 0.045), on);
      }
    }, { dark: true });

    // THE STRINGS: the threads out to the controls, slack until the jerk and
    // then taut, a kink of light running along each; and from each control
    // the strings straight down onto its puppet, swaying until the kink
    // comes down them, then twitching.
    t.draw(END, (g, u) => {
      const time = u * END, a = alive(time), x = barX(time);
      // Its own strings, down to its own card.
      const own = hands(m.from, s), ends = [x.l, x.b, x.r];
      own.forEach((h, i) => {
        const slack = time < JERK ? s * 0.05 : s * 0.015;
        strung(g, string(ends[i], h, slack, 0, time * 9 + i, -1, 0).pts, s, 0.8 * a);
      });
      for (const p of puppets) {
        const from = x[p.arm];
        const out = easeOut(clamp01((time - LINK0) / (LINK1 - LINK0)));
        const taut = clamp01((time - JERK) / 0.05);
        const kink = time > JERK ? (time - JERK) / (p.arrive - JERK) : -1;
        const y = p.Q.y + jolt(time, p.arrive);
        const link = string(from, { x: p.Q.x, y }, 0, s * 0.22 * (1 - taut), 0, kink, s * 0.07, out);
        strung(g, link.pts, s, a);
        if (link.kp) g.circle(link.kp.x, link.kp.y, s * 0.035).fill({ color: WHITE, alpha: 0.9 });
        if (out < 1) g.circle(link.pts[link.pts.length - 2], link.pts[link.pts.length - 1], s * 0.03).fill({ color: WHITE, alpha: 0.95 });
        // The drop: from the control's ends and middle straight down.
        const drop = easeOut(clamp01((time - LINK1) / (DROP - LINK1)));
        if (drop <= 0) continue;
        const down = clamp01((time - p.arrive) / DOWN);
        const twitch = time > p.arrive ? s * 0.025 * Math.sin(time * 60 + p.ph) * (1 - clamp01((time - p.arrive) / 0.3)) : 0;
        hands(p.r, s).forEach((h, i) => {
          const top = { x: p.Q.x + (i - 1) * s * 0.24, y };
          const sway = time < p.arrive ? s * 0.06 : twitch;
          const st = string(top, { x: h.x, y: h.y + jolt(time, p.arrive) * 0.5 }, sway, 0, time * 8 + i + p.ph, down > 0 && down < 1 ? down : -1, s * 0.05, drop);
          strung(g, st.pts, s, a);
          if (st.kp) g.circle(st.kp.x, st.kp.y, s * 0.03).fill({ color: WHITE, alpha: 0.9 });
        });
      }
    });

    // THE JERK: straw shaken off the scarecrow, and each puppet yanked up as
    // the kink reaches it.
    t.later(JERK, () => {
      t.flash(K, LILAC, 0.2 * (s / 80));
      const n = Math.round(9 * t.quality);
      for (let i = 0; i < n; i++) {
        const a = -Math.PI / 2 + rand(-1.3, 1.3), v = rand(90, 190) * (s / 90);
        t.spark(c.x + rand(-0.25, 0.25) * s, c.y + rand(-0.2, 0.2) * s, Math.cos(a) * v, Math.sin(a) * v, rand(0.3, 0.45), STRAW);
      }
    });
    for (const p of puppets) t.later(p.arrive + DOWN, () => yank(t, p.r, s));

    // THE SHOTS CUED: from whichever puppet stands nearest each foe (the
    // scarecrow itself, with none), a string-line whips out and plucks it.
    m.targets.forEach((r, i) => {
      const fp = centre(r);
      let src = { p: c, at: JERK }, best = Infinity;
      for (const p of puppets) {
        const q = centre(p.r), d = Math.hypot(q.x - fp.x, q.y - fp.y);
        if (d < best) { best = d; src = { p: q, at: p.arrive }; }
      }
      const dx = fp.x - src.p.x, dy = fp.y - src.p.y, L = Math.hypot(dx, dy) || 1;
      const a = { x: src.p.x + (dx / L) * s * 0.4, y: src.p.y + (dy / L) * s * 0.4 };
      const b = { x: fp.x - (dx / L) * s * 0.3, y: fp.y - (dy / L) * s * 0.3 };
      whip(t, a, b, s, m.power[i] ?? 0.8, Math.max(FLICK, src.at + DOWN + 0.06) + i * 0.03);
    });

    curtain(t, m.from, s);
  },
};
