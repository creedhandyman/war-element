/** SUNBANNER — Flash Squad. "Command allies in the same row and the row
 *  directly ahead to each use their basic attack." Its order "sends the nearby
 *  rows in to strike together."
 *
 *  Its art is a commander in gold plate, sun-emblem shield on its arm, one
 *  arm flung out POINTING the way, a great NAVY-and-gold SUN BANNER planted
 *  behind it and gold helms all round. The squad's own attacks play their own
 *  effects afterwards: this move is the ORDER, and it reads like a drill —
 *  a standard raised, a signal relayed, the way pointed out.
 *
 *  The DELIVERY, when there is one, plants the standard: the pole rises up
 *  the back of the card, the cloth still furled and stirring, gold gathering
 *  at its finial. It may not run at all (the Special can aim at nobody), so
 *  the LANDING carries the whole move on its own: the pole stands, and the
 *  banner UNFURLS off it — navy cloth with a gold border and a swallowtail,
 *  rippling, a gold sun on its face that flares as the cloth snaps out. From
 *  that sun the command goes out as a signal PASSED DOWN THE LINE: a straight
 *  flash of light to the nearest ally in the commanded rows, then on from
 *  that one to the next, each lighting a gold chevron as it hears, pointing
 *  forward. Then, from the line, the way is shown: toward each foe a "charge"
 *  line of marching gold chevrons runs dead straight, and gold brackets close
 *  on the foe it picks out. With no foe in reach, the order is still given:
 *  the banner, the signal, and a march of chevrons pointing straight ahead.
 *
 *  The cloth is navy for real (`dark: true`), always with its gold border and
 *  a blue sheen of light over it, so it reads as a banner on any square. */
import { centre, rand } from "../../looks/base";
import type { Graphics } from "pixi.js";
import type { FxTools, Pt, SparkStyle } from "../../looks/types";
import type { Signature, SigMoment } from "../types";

type Box = SigMoment["from"];

const TAU = Math.PI * 2;
const WHITE = 0xffffff, PALE = 0xfff1b3, GOLD = 0xffd54f, DEEP = 0xe0a41c, WARM = 0xffe38a;
/** The banner's cloth (dark layer), and the light caught in its folds. */
const NAVY = 0x14215a, SHEEN = 0x4a6fd8;
/** Gold drawn in to the finial while the standard is planted. */
const GATHER: SparkStyle = { palette: [DEEP, GOLD, PALE, WHITE], gravity: 0, drag: 1, size: [3, 5], streak: true };
/** Needles struck off a chevron as it lights. */
const NEEDLE: SparkStyle = { palette: [WHITE, PALE, GOLD], gravity: 0, drag: 0.04, size: [5, 1.5], streak: true };

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeOut = (x: number) => 1 - (1 - x) * (1 - x);
/** Overshoots and settles: cloth snapping out. */
const snap = (x: number) => 1 + 2.7 * Math.pow(x - 1, 3) + 1.7 * Math.pow(x - 1, 2);

/** The banner: unfurled by, how long it flies, and when it starts to fade. */
const UNFURL = 0.2, BANNER_D = 1.02, BANNER_FADE = 0.76;
/** The signal leaves the sun at SIGNAL; a relay's leg takes LEG0 plus LEG
 *  per square; a lit ally passes it on after RELAY. */
const SIGNAL = 0.16, LEG0 = 0.03, LEG = 0.045, RELAY = 0.02;
/** A charge line runs out over RUN and is gone by END (from the landing). */
const RUN = 0.13, END = 1.08;

// ── The standard ─────────────────────────────────────────────────────────────

/** Where the standard stands on a card: the pole up its back-left edge from
 *  near its foot to above its head, and the cloth hung off the pole's top. */
function standard(r: Box, s: number) {
  const x = r.x + r.w * 0.1, foot = r.y + r.h * 0.94, top = r.y - r.h * 0.42;
  return { x, foot, top, clothTop: top + s * 0.05, clothH: s * 0.54, clothL: s * 0.92 };
}

/** The cloth's outline, unfurled to `L`, rippling at `time`: its top edge out
 *  from the pole, a swallowtail at the fly end, its bottom edge back — the
 *  ripple growing toward the fly, where cloth moves most. Also where its sun
 *  sits. */
function cloth(st: ReturnType<typeof standard>, L: number, time: number, s: number) {
  const N = 12, top: number[] = [], bot: number[] = [];
  const wave = (f: number, lag: number) => s * 0.04 * f * Math.sin(f * 5.5 - time * 11 + lag);
  for (let i = 0; i <= N; i++) {
    const f = i / N, x = st.x + L * f;
    top.push(x, st.clothTop + wave(f, 0));
    bot.unshift(x, st.clothTop + st.clothH + wave(f, 0.6));
  }
  // The swallowtail's notch, in from the fly between the two tails.
  const notch = [st.x + L * 0.8, st.clothTop + st.clothH / 2 + wave(0.8, 0.3)];
  const pts = top.concat(notch, bot);
  const sun = { x: st.x + L * 0.42, y: st.clothTop + st.clothH / 2 + wave(0.42, 0.3) };
  return { pts, top, sun };
}

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

/** The pole and its finial: a gold staff rimmed in light, a gold point on
 *  top in a small sun. */
function pole(g: Graphics, st: ReturnType<typeof standard>, top: number, s: number, a: number) {
  if (a <= 0.01) return;
  g.moveTo(st.x, st.foot).lineTo(st.x, top).stroke({ width: Math.max(3, s * 0.045), color: DEEP, alpha: 0.75 * a, cap: "round" })
    .moveTo(st.x, st.foot).lineTo(st.x, top).stroke({ width: Math.max(1, s * 0.014), color: WHITE, alpha: 0.85 * a, cap: "round" });
  g.circle(st.x, top, s * 0.04).fill({ color: GOLD, alpha: 0.85 * a }).stroke({ width: 1, color: WHITE, alpha: 0.9 * a });
  g.poly([st.x - s * 0.025, top - s * 0.02, st.x, top - s * 0.11, st.x + s * 0.025, top - s * 0.02], true).fill({ color: WARM, alpha: 0.95 * a });
}

/** A sun emblem: a gold disc with a crown of twelve rays, a white heart. */
function sunEmblem(g: Graphics, c: Pt, R: number, spin: number, a: number) {
  if (a <= 0.01 || R < 0.5) return;
  for (let i = 0; i < 12; i++) {
    const th = spin + (i / 12) * TAU, l = R * (i % 2 ? 0.55 : 0.9), ca = Math.cos(th), sa = Math.sin(th);
    g.moveTo(c.x + ca * R * 1.1, c.y + sa * R * 1.1).lineTo(c.x + ca * (R * 1.1 + l), c.y + sa * (R * 1.1 + l));
  }
  g.stroke({ width: Math.max(1.2, R * 0.22), color: GOLD, alpha: 0.95 * a });
  g.circle(c.x, c.y, R).fill({ color: GOLD, alpha: 0.85 * a }).stroke({ width: 1.2, color: WHITE, alpha: 0.9 * a });
  g.circle(c.x, c.y, R * 0.45).fill({ color: WHITE, alpha: 0.9 * a });
}

/** THE BANNER unfurling off the standing pole and flying: navy cloth (dark),
 *  its sheen and gold border (light), and the sun on it — flaring the moment
 *  the cloth snaps out. `fadeIn` lets the pole take over from the delivery's
 *  without a blink. */
function banner(t: FxTools, r: Box, s: number, fadeIn: number) {
  const st = standard(r, s);
  const alive = (time: number) => (1 - clamp01((time - BANNER_FADE) / (BANNER_D - BANNER_FADE)));
  const length = (time: number) => st.clothL * Math.max(0.08, snap(clamp01(time / UNFURL)));
  t.draw(BANNER_D, (g, u) => {
    const time = u * BANNER_D, a = alive(time);
    g.poly(cloth(st, length(time), time, s).pts, true).fill({ color: NAVY, alpha: 0.88 * a });
  }, { dark: true });
  t.draw(BANNER_D, (g, u) => {
    const time = u * BANNER_D, a = alive(time), L = length(time), cl = cloth(st, L, time, s);
    pole(g, st, st.top, s, a * (fadeIn > 0 ? clamp01(time / fadeIn) : 1));
    g.poly(cl.pts, true).fill({ color: SHEEN, alpha: 0.16 * a }).stroke({ width: Math.max(1.5, s * 0.022), color: GOLD, alpha: 0.95 * a, join: "round" });
    // The light running along the top of each ripple.
    g.poly(cl.top, false).stroke({ width: Math.max(1, s * 0.012), color: PALE, alpha: 0.7 * a });
    const lit = clamp01((time - UNFURL * 0.7) / 0.08);
    const flare = Math.exp(-Math.max(0, time - UNFURL) / 0.12) * lit;
    sunEmblem(g, cl.sun, s * 0.085 * (L / st.clothL) * (1 + 0.25 * flare), time * 0.8, a);
    if (flare > 0.02) {
      g.circle(cl.sun.x, cl.sun.y, s * 0.24 * flare).fill({ color: GOLD, alpha: 0.25 * flare });
      star(g, cl.sun.x, cl.sun.y, s * 0.42 * flare, s * 0.3 * flare, s * 0.025, 0, WHITE, 0.95 * flare);
    }
  });
  t.later(UNFURL, () => t.flash(cloth(st, st.clothL, UNFURL, s).sun, WARM, 0.25 * (s / 80)));
}

// ── The order ────────────────────────────────────────────────────────────────

/** Which of its allies the order reaches: those in its own row and the row
 *  directly ahead, measured along `ahead`. */
function commanded(m: SigMoment): Box[] {
  const c = centre(m.from), s = m.size;
  return m.allies.filter((r) => {
    const p = centre(r), along = ((p.x - c.x) * m.ahead.x + (p.y - c.y) * m.ahead.y) / s;
    return along > -0.5 && along < 1.5;
  });
}

/** The relay: from the banner's sun to the nearest commanded ally, then on
 *  from each to the nearest not yet told — a signal passed down the line,
 *  each leg's start and end, and when its ally hears. */
function relay(from: Pt, squad: Box[], s: number) {
  const left = squad.map((r) => ({ r, p: centre(r) }));
  const legs: { a: Pt; b: Pt; r: Box; at: number; dur: number }[] = [];
  let here = from, time = SIGNAL;
  while (left.length) {
    let k = 0;
    left.forEach((q, i) => { if (Math.hypot(q.p.x - here.x, q.p.y - here.y) < Math.hypot(left[k].p.x - here.x, left[k].p.y - here.y)) k = i; });
    const next = left.splice(k, 1)[0], d = Math.hypot(next.p.x - here.x, next.p.y - here.y) / s;
    const dur = LEG0 + LEG * d;
    legs.push({ a: here, b: next.p, r: next.r, at: time, dur });
    time += dur + RELAY;
    here = next.p;
  }
  return legs;
}

/** THE SIGNAL along the relay: each leg a straight line of light drawn out
 *  from the last ally to the next with a white-hot head, standing once it
 *  arrives, all of them fading together at the end. */
function signal(t: FxTools, legs: ReturnType<typeof relay>, s: number) {
  if (!legs.length) return;
  const D = END;
  t.draw(D, (g, u) => {
    const time = u * D, fade = 1 - clamp01((time - 0.7) / (D - 0.7));
    for (const l of legs) {
      const q = clamp01((time - l.at) / l.dur);
      if (q <= 0) continue;
      const hx = l.a.x + (l.b.x - l.a.x) * q, hy = l.a.y + (l.b.y - l.a.y) * q;
      g.moveTo(l.a.x, l.a.y).lineTo(hx, hy).stroke({ width: Math.max(4, s * 0.07), color: GOLD, alpha: 0.18 * fade })
        .moveTo(l.a.x, l.a.y).lineTo(hx, hy).stroke({ width: Math.max(1.4, s * 0.02), color: WARM, alpha: 0.9 * fade });
      if (q < 1) {
        g.circle(hx, hy, s * 0.06).fill({ color: GOLD, alpha: 0.35 });
        star(g, hx, hy, s * 0.11, s * 0.11, s * 0.015, Math.PI / 4, WHITE, 1);
      }
    }
  });
}

/** A chevron (or two, nested) pointing along `dir` from `c`: gold body,
 *  white core. */
function chevron(g: Graphics, c: Pt, dir: Pt, size: number, alpha: number, width: number) {
  if (alpha <= 0.01) return;
  const nx = -dir.y, ny = dir.x;
  const tip = { x: c.x + dir.x * size * 0.5, y: c.y + dir.y * size * 0.5 };
  const b = { x: c.x - dir.x * size * 0.5, y: c.y - dir.y * size * 0.5 };
  const pts = [b.x + nx * size * 0.7, b.y + ny * size * 0.7, tip.x, tip.y, b.x - nx * size * 0.7, b.y - ny * size * 0.7];
  g.poly(pts, false).stroke({ width: width * 2.4, color: GOLD, alpha: 0.4 * alpha, join: "miter", cap: "round" })
    .poly(pts, false).stroke({ width, color: WHITE, alpha, join: "miter", cap: "round" });
}

/** AN ALLY HEARING THE ORDER: a double chevron flashing on its card,
 *  pointing forward, struck big and settling, a gold frame tick round it and
 *  needles struck off forward. */
function hears(t: FxTools, r: Box, ahead: Pt, s: number) {
  const c = centre(r), D = 0.55;
  t.glow(r, WARM, 0.28, 0.4, 1.0);
  t.ring(r, GOLD, 0.6, 1.05, 0.3, 2);
  t.draw(D, (g, u) => {
    const time = u * D, k = 1 + 0.5 * Math.exp(-time / 0.06), a = clamp01(time / 0.03) * (1 - clamp01((time - 0.3) / (D - 0.3)));
    for (const off of [-0.12, 0.1]) chevron(g, { x: c.x + ahead.x * s * off * k, y: c.y + ahead.y * s * off * k }, ahead, s * 0.3 * k, a, Math.max(1.8, s * 0.028));
  });
  const n = Math.max(2, Math.round(4 * t.quality)), base = Math.atan2(ahead.y, ahead.x);
  for (let i = 0; i < n; i++) {
    const ang = base + rand(-0.35, 0.35), v = rand(140, 220) * (s / 90);
    t.spark(c.x + ahead.x * s * 0.2, c.y + ahead.y * s * 0.2, Math.cos(ang) * v, Math.sin(ang) * v, rand(0.15, 0.24), NEEDLE);
  }
}

/** A CHARGE LINE: marching gold chevrons running dead straight from `a`
 *  toward `b`, drawn out over RUN from `when` and marching on along it until
 *  END, an arrowhead at its front. */
function chargeLine(t: FxTools, a: Pt, b: Pt, s: number, when: number) {
  const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy);
  if (L < 1) return;
  const dir = { x: dx / L, y: dy / L }, gap = s * 0.2, D = Math.max(0.2, END - when);
  t.draw(D, (g, u) => {
    const time = u * D, reach = L * easeOut(clamp01(time / RUN)), fade = 1 - clamp01((time - (D - 0.25)) / 0.25);
    g.moveTo(a.x, a.y).lineTo(a.x + dir.x * reach, a.y + dir.y * reach).stroke({ width: Math.max(1, s * 0.012), color: GOLD, alpha: 0.5 * fade });
    // The march: chevrons stepping forward along the line, brighter toward
    // the front, none past its drawn end.
    const step = (time * 2.2 * s) % gap;
    for (let d = step; d < reach - gap * 0.5; d += gap) {
      const f = d / L, p = { x: a.x + dir.x * d, y: a.y + dir.y * d };
      chevron(g, p, dir, s * 0.12, (0.35 + 0.6 * f) * fade, Math.max(1.4, s * 0.02));
    }
    chevron(g, { x: a.x + dir.x * reach, y: a.y + dir.y * reach }, dir, s * 0.2, fade, Math.max(2, s * 0.03));
  }, { delay: when });
}

/** GOLD BRACKETS closing on a foe the line picks out: four corners drawn in
 *  from outside the card to just round it, a four-point glint at its heart,
 *  sized by `power`. */
function pickOut(t: FxTools, r: Box, s: number, power: number, when: number) {
  const c = centre(r), k = Math.max(0.75, Math.min(1.5, power)), D = Math.max(0.2, END - when);
  t.later(when, () => t.flash(c, WARM, 0.22 * k * (s / 80)));
  t.draw(D, (g, u) => {
    const time = u * D, close = easeOut(clamp01(time / 0.14)), a = clamp01(time / 0.03) * (1 - clamp01((time - (D - 0.25)) / 0.25));
    const hw = r.w * (0.85 - 0.3 * close), hh = r.h * (0.85 - 0.3 * close), arm = s * 0.16 * k;
    for (const sx of [-1, 1])
      for (const sy of [-1, 1]) {
        const x = c.x + sx * hw, y = c.y + sy * hh;
        g.moveTo(x - sx * arm, y).lineTo(x, y).lineTo(x, y - sy * arm);
      }
    g.stroke({ width: Math.max(4, s * 0.06), color: GOLD, alpha: 0.3 * a, join: "miter" });
    for (const sx of [-1, 1])
      for (const sy of [-1, 1]) {
        const x = c.x + sx * hw, y = c.y + sy * hh;
        g.moveTo(x - sx * arm, y).lineTo(x, y).lineTo(x, y - sy * arm);
      }
    g.stroke({ width: Math.max(1.6, s * 0.024), color: WHITE, alpha: a, join: "miter" });
    const q = clamp01(time / 0.3), L = s * 0.22 * k * Math.sin(Math.PI * q);
    star(g, c.x, c.y, L, L, s * 0.02, 0, WHITE, 0.9 * (1 - q * 0.3));
  }, { delay: when });
}

/** Where a line leaves a card toward `to`: just off its edge. */
function edge(c: Pt, to: Pt, s: number): Pt {
  const dx = to.x - c.x, dy = to.y - c.y, L = Math.hypot(dx, dy) || 1;
  return { x: c.x + (dx / L) * s * 0.45, y: c.y + (dy / L) * s * 0.45 };
}

export const SUNBANNER: Signature = {
  // A word of command, not a blow.
  shake: 0.3,
  // It gives the order from where it stands.
  lunge: false,

  deliver(t: FxTools, m: SigMoment, seconds: number) {
    const s = m.size, st = standard(m.from, s), T = seconds;
    // THE STANDARD PLANTED: the pole rising up the back of the card, the
    // cloth furled and stirring on it, gold drawn in to the finial. It
    // lingers a breath past the landing, fading as the landing's pole fades
    // in, so the hand-over does not blink.
    const D = T + 0.1;
    t.draw(D, (g, u) => {
      const time = u * D, rise = easeOut(clamp01(time / (T * 0.5))), a = 1 - clamp01((time - T) / 0.1);
      const top = st.foot + (st.top - st.foot) * rise;
      const furl: number[] = [];
      for (let i = 0; i <= 8; i++) {
        const f = i / 8, sway = Math.sin(f * 4 - time * 8) * s * 0.025 * f;
        furl.push(st.x + s * 0.04 + sway, top + s * 0.05 + st.clothH * 0.9 * f);
      }
      if (rise > 0.6) g.poly(furl, false).stroke({ width: Math.max(4, s * 0.07), color: SHEEN, alpha: 0.5 * a * (rise - 0.6) / 0.4, cap: "round" })
        .poly(furl, false).stroke({ width: 1.2, color: GOLD, alpha: 0.9 * a * (rise - 0.6) / 0.4, cap: "round" });
      pole(g, st, top, s, a);
    });
    t.charge({ x: st.x, y: st.top }, s * 0.5, GOLD, 0.7, T);
    const n = Math.round(10 * t.quality);
    for (let i = 0; i < n; i++)
      t.later(rand(0.2, 0.85) * T, () => {
        const ang = rand(0, TAU), d = s * rand(0.35, 0.55), v = d / 0.2;
        t.spark(st.x + Math.cos(ang) * d, st.top + Math.sin(ang) * d, -Math.cos(ang) * v, -Math.sin(ang) * v, 0.2, GATHER);
      });
  },

  land(t: FxTools, m: SigMoment) {
    const c = centre(m.from), s = m.size, st = standard(m.from, s);
    banner(t, m.from, s, 0.1);
    // The order relayed from the banner's sun down the commanded line.
    const sun = cloth(st, st.clothL, UNFURL, s).sun;
    const legs = relay(sun, commanded(m), s);
    signal(t, legs, s);
    for (const l of legs) t.later(l.at + l.dur, () => hears(t, l.r, m.ahead, s));
    // The way shown: each foe pointed out from whoever of the line (or the
    // commander itself) stands nearest it, as soon as that one has heard.
    const squad = [{ p: c, at: SIGNAL }, ...legs.map((l) => ({ p: l.b, at: l.at + l.dur }))];
    m.targets.forEach((r, i) => {
      const p = centre(r);
      let src = squad[0];
      for (const q of squad) if (Math.hypot(q.p.x - p.x, q.p.y - p.y) < Math.hypot(src.p.x - p.x, src.p.y - p.y)) src = q;
      const when = src.at + 0.04, a = edge(src.p, p, s), b = edge(p, src.p, s * 1.1);
      chargeLine(t, a, b, s, when);
      pickOut(t, r, s, m.power[i] ?? 1, when + RUN);
    });
    // With nobody in reach the order is still given: the way straight ahead.
    if (!m.targets.length) {
      const a = { x: c.x + m.ahead.x * s * 0.5, y: c.y + m.ahead.y * s * 0.5 };
      chargeLine(t, a, { x: a.x + m.ahead.x * s * 1.8, y: a.y + m.ahead.y * s * 1.8 }, s, SIGNAL + 0.06);
    }
  },
};
