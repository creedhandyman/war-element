/** SIREN — Sea Terror. "Transform into Krakler (9/8/SP8), applying SCALD 3 +
 *  FREEZE to all touching opponents." She can become a Krakler; kill that,
 *  and the Siren returns at full health.
 *
 *  Her art is a sea witch with pale-blue hair lifting off her like current,
 *  violet sea magic spiralling round her and a glowing orange orb in her
 *  hand. The DELIVERY is her song: rings of sound in violet and sea-blue
 *  rippling out of her card one after another, each one wavering the way a
 *  sung note does and brightest where it runs toward the cards she is about
 *  to touch, while the orb in her hand burns up orange and her magic motes
 *  circle her.
 *
 *  The LANDING is the change. A whirlpool of dark sea water opens on her
 *  square and swallows her — foam spiralling down into it, spray flung off
 *  its rim — and down in it an eye opens: Krakler's, violet, slit-pupilled.
 *  Then Krakler's arms burst up out of the water. Purple, sucker-lined, the
 *  thick mauve tentacles of its art and not the Kraken's black: one whips out
 *  to every card touching her and SLAPS onto it, its tip curling over the
 *  card, and where it lands the sea scalds (a burst of steam, a flash of
 *  heat) and then freezes (frost crusting in from the card's corners) —
 *  SCALD and FREEZE. The rest rise round her and unfurl, swaying. Then they
 *  sink back and the water closes over a Krakler. Alone, the whirlpool and
 *  the arms unfurling are the move.
 *
 *  The whirlpool's water and the arms' flesh are dark for real (`dark: true`),
 *  and every one of them is lit — foam, a violet rim, pale suckers — so they
 *  read over an empty square as well as over a card. */
import { centre, rand } from "../../looks/base";
import type { Graphics } from "pixi.js";
import type { FxTools, Pt, SparkStyle } from "../../looks/types";
import type { Signature, SigMoment } from "../types";

type Box = SigMoment["from"];

const TAU = Math.PI * 2;
// Her song and her magic: violet, lilac, the sea's blue, her hair's white-blue.
const VIOLET = 0x9a6cff, LILAC = 0xd2bcff, SEA = 0x3f9be8, PALE = 0xa8e4ff, FOAM = 0xeef8ff;
// The orb in her hand.
const ORB = 0xff9a3c, ORB_HOT = 0xffe2b0;
// The whirlpool's water and Krakler's flesh: only ever on the dark layer.
const ABYSS = 0x06041a, FLESH = 0x1e0824;
// Krakler lit: its mauve body, the pink-violet of its rim, pale suckers, its eye.
const MAUVE = 0x8a3a9a, RIM = 0xe28ae8, SUCKER = 0xffd0f0, EYE = 0x8f86ff;
// Where it touches: steam, a flash of scald, frost.
const STEAM = 0xdcecf4, SCALD = 0xffb48a, ICE = 0xbfeeff, GLINT = 0xffffff;

/** Spray flung off the whirlpool's rim: white water cooling to deep. */
const SPRAY: SparkStyle = { palette: [FOAM, PALE, SEA, 0x1f4fa8], gravity: 900, drag: 0.55, size: [6, 2.5], streak: false };
/** Drops running off a rising arm: the sea, tinged with its violet. */
const DRIP: SparkStyle = { palette: [LILAC, PALE, SEA], gravity: 700, drag: 0.6, size: [5, 2], streak: false };
/** Steam off a scalded card: soft, swelling, lifting. */
const VAPOR: SparkStyle = { palette: [FOAM, STEAM, 0x8aa8bc], gravity: -140, drag: 0.5, size: [7, 15], streak: false };
/** Her magic, circling her as she sings. */
const MOTE: SparkStyle = { palette: [FOAM, LILAC, VIOLET], gravity: -20, drag: 0.6, size: [5, 1.5], streak: false, swirl: 190 };
/** Ice glittering off the frost as it sets. */
const RIME: SparkStyle = { palette: [GLINT, ICE, PALE], gravity: 120, drag: 0.5, size: [4, 1], streak: false };

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeOut = (x: number) => 1 - (1 - x) * (1 - x);

/** The landing's beats, s: the whirlpool opening, the arms bursting out of it
 *  and reaching their cards, how long they hold, and the water closing. */
const OPEN = 0.14, BURST = 0.1, REACH = 0.17, HOLD = 0.3, SINK = 0.24, D = 1.0;

// ── Krakler's arms ───────────────────────────────────────────────────────────

/** An arm: a curve from `base` out along `ang`, `len` long, fat at the root
 *  and pointed at the tip, its heading snaking (`wave`, travelling with
 *  `phase`) and hooking over at the end (`curl`). Its OUTLINE, and its spine
 *  — each point with its heading and half-width — for the suckers. */
function arm(base: Pt, ang: number, len: number, width: number, curl: number, wave: number, phase: number) {
  const N = 16, left: number[] = [], right: number[] = [], spine: { x: number; y: number; h: number; w: number }[] = [];
  let x = base.x, y = base.y;
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    const h = ang + wave * Math.sin(u * Math.PI * 1.7 + phase) * u + curl * u * u * u;
    const w = (width / 2) * Math.pow(1 - u, 0.7);
    const nx = -Math.sin(h), ny = Math.cos(h);
    left.push(x + nx * w, y + ny * w);
    right.unshift(x - nx * w, y - ny * w);
    spine.push({ x, y, h, w });
    x += Math.cos(h) * (len / N);
    y += Math.sin(h) * (len / N);
  }
  return { outline: left.concat(right), spine };
}

type Arm = ReturnType<typeof arm>;

/** An arm's flesh, dark, on the dark layer. */
function flesh(g: Graphics, a: Arm, alpha: number) {
  if (alpha > 0.01) g.poly(a.outline, true).fill({ color: FLESH, alpha: 0.9 * alpha });
}

/** An arm lit: mauve through its body, a pink-violet rim, and a row of pale
 *  suckers down its inner side — the side it curls toward, as an octopus's
 *  do — which is what makes it Krakler's arm and not a ribbon. */
function lit(g: Graphics, a: Arm, side: number, alpha: number) {
  if (alpha <= 0.01) return;
  g.poly(a.outline, true).fill({ color: MAUVE, alpha: 0.45 * alpha }).stroke({ width: 1.8, color: RIM, alpha: 0.8 * alpha, join: "round" });
  for (let i = 3; i < a.spine.length - 2; i += 2) {
    const p = a.spine[i], off = p.w * 0.5 * side, r = Math.max(0.8, p.w * 0.28);
    g.circle(p.x - Math.sin(p.h) * off, p.y + Math.cos(p.h) * off, r).stroke({ width: 1, color: SUCKER, alpha: 0.7 * alpha });
  }
}

// ── The whirlpool ────────────────────────────────────────────────────────────

/** Its water: a lumpy disc, its edge churning. */
function disc(g: Graphics, c: Pt, r: number, time: number, seed: number): Graphics {
  const pts: number[] = [];
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * TAU;
    const rr = r * (1 + 0.06 * Math.sin(4 * a + seed - time * 9) + 0.04 * Math.sin(7 * a + time * 6));
    pts.push(c.x + Math.cos(a) * rr, c.y + Math.sin(a) * rr);
  }
  return g.poly(pts, true);
}

/** Krakler's eye opening in the deep: an almond of violet light with a
 *  slit pupil left dark through it, `open` 0..1 how wide the lids are. */
function eye(g: Graphics, c: Pt, s: number, open: number, alpha: number) {
  if (open <= 0.02 || alpha <= 0.02) return;
  const W = s * 0.15, H = s * 0.065 * open, slit = s * 0.012, N = 8;
  g.ellipse(c.x, c.y, W * 1.5, Math.max(1, H * 2.4)).fill({ color: VIOLET, alpha: 0.22 * alpha });
  // The iris as two halves either side of the pupil, so the slit stays dark.
  for (const sd of [-1, 1]) {
    const pts: number[] = [];
    for (let i = 0; i <= N; i++) {
      const x = sd * (W - ((W - slit) * i) / N), k = 1 - (x / W) * (x / W);
      pts.push(c.x + x, c.y - H * k);
    }
    for (let i = 0; i <= N; i++) {
      const x = sd * (slit + ((W - slit) * i) / N), k = 1 - (x / W) * (x / W);
      pts.push(c.x + x, c.y + H * k);
    }
    g.poly(pts, true).fill({ color: EYE, alpha: 0.85 * alpha });
  }
  const lid: number[] = [], low: number[] = [];
  for (let i = 0; i <= 12; i++) {
    const x = -W + (2 * W * i) / 12, k = 1 - (x / W) * (x / W);
    lid.push(c.x + x, c.y - H * k);
    low.push(c.x + x, c.y + H * k);
  }
  g.poly(lid, false).stroke({ width: 1.5, color: LILAC, alpha: 0.95 * alpha });
  g.poly(low, false).stroke({ width: 1, color: VIOLET, alpha: 0.8 * alpha });
  g.circle(c.x - W * 0.35, c.y - H * 0.3, Math.max(0.8, s * 0.012)).fill({ color: GLINT, alpha: 0.9 * alpha });
}

/** THE WHIRLPOOL swallowing her square: dark water opening out over it,
 *  foam spiralling down into it, its rim churning and throwing spray — and
 *  Krakler's eye opening at the bottom of it. Closes over the new card. */
function whirlpool(t: FxTools, c: Pt, s: number) {
  const seed = rand(0, 100), spin = Math.random() < 0.5 ? -1 : 1, R = s * 0.6;
  const rad = (time: number) => R * easeOut(clamp01(time / OPEN)) * (1 - 0.25 * clamp01((time - 0.75) / 0.25));
  const fade = (time: number) => 1 - clamp01((time - 0.7) / 0.3);
  t.draw(D, (g, u) => {
    const time = u * D;
    disc(g, c, rad(time), time, seed).fill({ color: ABYSS, alpha: 0.72 * fade(time) });
  }, { dark: true });
  let acc = 0;
  t.draw(D, (g, u, dt) => {
    const time = u * D, r = rad(time), a = fade(time);
    if (r < 1) return;
    g.circle(c.x, c.y, r * 0.5).fill({ color: VIOLET, alpha: 0.12 * a });
    disc(g, c, r, time, seed).stroke({ width: 2.2, color: SEA, alpha: 0.8 * a });
    // Foam drawn down in spirals, turning faster the deeper it goes.
    for (let j = 0; j < 4; j++) {
      const pts: number[] = [];
      for (let k = 0; k <= 14; k++) {
        const f = k / 14, rr = r * (0.96 - 0.82 * f);
        const th = seed + (j / 4) * TAU + spin * (time * 7 + f * 2.6);
        pts.push(c.x + Math.cos(th) * rr, c.y + Math.sin(th) * rr);
      }
      g.poly(pts, false).stroke({ width: 2, color: j % 2 ? LILAC : PALE, alpha: 0.7 * a, cap: "round", join: "round" });
    }
    // The eye, opening down in it as the arms come up, and shut as it closes.
    const open = clamp01((time - 0.16) / 0.12) * (1 - clamp01((time - 0.66) / 0.1));
    eye(g, c, s, easeOut(open), a);
    if (time < 0.45) {
      acc += dt * 60 * t.quality;
      for (; acc >= 1; acc--) {
        const th = rand(0, TAU), v = rand(60, 140) * (s / 90);
        t.spark(c.x + Math.cos(th) * r, c.y + Math.sin(th) * r, -Math.sin(th) * v * spin + Math.cos(th) * v * 0.4,
          Math.cos(th) * v * spin + Math.sin(th) * v * 0.4 - rand(40, 110) * (s / 90), rand(0.25, 0.4), SPRAY);
      }
    }
  });
  t.flash(c, VIOLET, 0.35 * (s / 80));
}

// ── The move ─────────────────────────────────────────────────────────────────

export const SIREN: Signature = {
  shake: 1.0,
  // She does not close on anything: she changes where she stands.
  lunge: false,

  deliver(t: FxTools, m: SigMoment, seconds: number) {
    const c = centre(m.from), s = m.size, S = seconds;
    const aims = m.targets.map((r) => { const p = centre(r); return Math.atan2(p.y - c.y, p.x - c.x); });
    const far = Math.max(s * 1.25, ...m.targets.map((r) => { const p = centre(r); return Math.hypot(p.x - c.x, p.y - c.y) + s * 0.25; }));
    // THE SONG: rings going out one after another, each wavering like a held
    // note, violet and sea-blue in turn, brightest toward her targets.
    const GAP = 0.1, LIFE = 0.42, n = Math.max(3, Math.floor((S - 0.02) / GAP));
    const ph = rand(0, TAU);
    t.draw(S + LIFE, (g, u) => {
      const time = u * (S + LIFE);
      for (let i = 0; i < n; i++) {
        const q = (time - i * GAP) / LIFE;
        if (q <= 0 || q >= 1) continue;
        const R = s * 0.3 + (far - s * 0.3) * easeOut(q), a = (1 - q) * Math.min(1, q * 6);
        const pts: number[] = [];
        for (let k = 0; k < 56; k++) {
          const th = (k / 56) * TAU;
          pts.push(c.x + Math.cos(th) * R * (1 + 0.035 * Math.sin(9 * th + ph + time * 24 + i)), c.y + Math.sin(th) * R * (1 + 0.035 * Math.sin(9 * th + ph + time * 24 + i)));
        }
        g.poly(pts, true).stroke({ width: 2.4 - q, color: i % 2 ? SEA : VIOLET, alpha: 0.45 * a });
        // Where it runs toward a card it is about to touch, the note is louder.
        for (const at of aims) {
          const seg: number[] = [];
          for (let k = -6; k <= 6; k++) {
            const th = at + k * 0.07, wv = 1 + 0.035 * Math.sin(9 * th + ph + time * 24 + i);
            seg.push(c.x + Math.cos(th) * R * wv, c.y + Math.sin(th) * R * wv);
          }
          g.poly(seg, false).stroke({ width: 2.6, color: LILAC, alpha: 0.85 * a, cap: "round" });
        }
      }
    });
    // THE ORB in her hand, burning up orange as she sings, her magic turning
    // round it.
    const orb = { x: m.from.x + m.from.w * 0.8, y: m.from.y + m.from.h * 0.7 };
    t.charge(orb, s * 0.55, ORB, 0.45, S);
    t.draw(S, (g, u) => {
      const k = easeOut(u), r = s * (0.04 + 0.035 * k), spin = u * S * 8;
      g.circle(orb.x, orb.y, r * 2.4).fill({ color: ORB, alpha: 0.2 * k });
      g.circle(orb.x, orb.y, r).fill({ color: ORB, alpha: 0.75 * Math.min(1, u * 4) });
      g.circle(orb.x, orb.y, r * 0.5).fill({ color: ORB_HOT, alpha: 0.95 * Math.min(1, u * 4) });
      for (let j = 0; j < 2; j++) {
        const a0 = spin + j * Math.PI, R = r * 2;
        g.moveTo(orb.x + Math.cos(a0) * R, orb.y + Math.sin(a0) * R).arc(orb.x, orb.y, R, a0, a0 + 1.6)
          .stroke({ width: 1.4, color: LILAC, alpha: 0.8 * k });
      }
    });
    let acc = 0;
    t.draw(S, (_g, _u, dt) => {
      acc += dt * 22 * t.quality;
      for (; acc >= 1; acc--) {
        const a = rand(0, TAU), r = s * rand(0.32, 0.5);
        t.spark(c.x + Math.cos(a) * r, c.y + Math.sin(a) * r, -Math.sin(a) * 30 * (s / 90), Math.cos(a) * 30 * (s / 90) - 20 * (s / 90), rand(0.3, 0.5), MOTE, c);
      }
    });
  },

  land(t: FxTools, m: SigMoment) {
    const c = centre(m.from), s = m.size;
    whirlpool(t, c, s);
    // THE ARMS. One to every card touching her, aimed so its curling tip
    // comes down across the card...
    const reachers = m.targets.map((r, i) => {
      const p = centre(r), d = Math.hypot(p.x - c.x, p.y - c.y) || 1, at = Math.atan2(p.y - c.y, p.x - c.x);
      const curl = rand(1.0, 1.5) * (Math.random() < 0.5 ? -1 : 1);
      return { r, power: m.power[i] ?? 1, at, len: d - s * 0.12, curl, aim: at - curl * 0.22, phase: rand(0, TAU), when: BURST + rand(0, 0.04) };
    });
    // ...and the rest rising round her into the gaps between them, so there
    // are always a handful: alone, they are the move.
    const dirs = reachers.map((h) => h.at), free: number[] = [];
    for (let k = 0; k < Math.max(2, 5 - reachers.length); k++) {
      let best = 0, bestGap = -1;
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * TAU + 0.13, gap = Math.min(Math.PI, ...dirs.concat(free).map((d) => Math.abs(Math.atan2(Math.sin(a - d), Math.cos(a - d)))));
        if (gap > bestGap) { bestGap = gap; best = a; }
      }
      free.push(best + rand(-0.4, 0.4));
    }
    // Curling either way in turn, so they never wheel round like a pinwheel.
    const risers = free.map((a, i) => ({
      at: a, len: s * rand(0.55, 1.05), curl: rand(1.8, 2.8) * (i % 2 ? -1 : 1), phase: rand(0, TAU), when: BURST + rand(0, 0.1),
    }));
    const base = (a: number) => ({ x: c.x + Math.cos(a) * s * 0.18, y: c.y + Math.sin(a) * s * 0.18 });
    // How far out an arm is (bursting, holding, sinking back) and how lit.
    const out = (time: number, when: number) => {
      const up = easeOut(clamp01((time - when) / REACH)), down = clamp01((time - when - REACH - HOLD) / SINK);
      return { k: up * (1 - down * down), a: clamp01((time - when) / 0.04) * (1 - down) };
    };
    const reachShape = (h: (typeof reachers)[number], time: number) => {
      const { k } = out(time, h.when), q = clamp01((time - h.when) / REACH);
      // It whips out snaking and straightens as it lands, then its tip
      // tightens round the card while it holds.
      const grip = clamp01((time - h.when - REACH) / 0.12);
      return arm(base(h.at), h.aim, h.len * k, s * 0.28, h.curl * (0.7 + 0.5 * grip), 0.6 * (1 - q), h.phase + time * 5);
    };
    const riseShape = (h: (typeof risers)[number], time: number) => {
      // Coming up rolled tight, as an octopus's arm is, and unrolling as it
      // rises â€” then swaying, its tip still hooked.
      const { k } = out(time, h.when), sway = 0.45 * Math.sin(time * (5 + h.len / s * 3) + h.phase);
      return arm(base(h.at), h.at + sway * 0.4, h.len * (0.35 + 0.65 * k), s * 0.27, h.curl * (2.6 - 1.6 * k), 0.6, h.phase + time * 6);
    };
    t.draw(D, (g, u) => {
      const time = u * D;
      for (const h of risers) flesh(g, riseShape(h, time), out(time, h.when).a);
      for (const h of reachers) flesh(g, reachShape(h, time), out(time, h.when).a);
    }, { dark: true });
    let acc = 0;
    t.draw(D, (g, u, dt) => {
      const time = u * D;
      for (const h of risers) lit(g, riseShape(h, time), Math.sign(h.curl), out(time, h.when).a);
      for (const h of reachers) lit(g, reachShape(h, time), Math.sign(h.curl), out(time, h.when).a);
      // Water streaming off them as they come up.
      if (time < 0.6) {
        acc += dt * 30 * t.quality;
        for (; acc >= 1; acc--) {
          const all = [...risers.map((h) => riseShape(h, time)), ...reachers.map((h) => reachShape(h, time))];
          const a = all[Math.floor(rand(0, all.length))], p = a.spine[Math.floor(rand(4, 13))];
          t.spark(p.x, p.y, rand(-25, 25) * (s / 90), rand(-50, 0) * (s / 90), rand(0.3, 0.45), DRIP);
        }
      }
    });
    // Where an arm comes down on a card, the sea scalds it and freezes it.
    for (const h of reachers) t.later(h.when + REACH * 0.85, () => touch(t, h.r, h.at, h.power));
  },
};

/** An arm slapping onto a card along `along`: a slap of water and a flash of
 *  heat, steam boiling up off it (the SCALD) — and then frost crusting in
 *  from its corners, ice glittering off it as it sets (the FREEZE). */
function touch(t: FxTools, r: Box, along: number, power: number) {
  const p = centre(r), s = Math.min(r.w, r.h), sc = s / 90, k = Math.max(0.6, Math.min(1.5, power * 1.4));
  t.flash(p, SCALD, 0.16 * k * (s / 80));
  t.ring(r, RIM, 0.3, 1.0, 0.3, 2);
  for (let i = 0; i < Math.round(8 * k); i++) {
    const a = along + rand(-1.3, 1.3), v = rand(120, 240) * sc;
    t.spark(p.x, p.y, Math.cos(a) * v, Math.sin(a) * v - 60 * sc, rand(0.3, 0.45), SPRAY);
  }
  // Steam: wisps of it curling up off the card as the scald takes, soft
  // puffs swelling round their feet.
  const wisps = Array.from({ length: 4 }, (_, i) => ({ x: p.x + ((i + 0.5) / 4 - 0.5) * s * 0.6, at: rand(0, 0.08), ph: rand(0, TAU), h: s * rand(0.45, 0.65) }));
  t.draw(0.6, (g, u) => {
    const time = u * 0.6;
    for (const w of wisps) {
      const q = clamp01((time - w.at) / 0.5);
      if (q <= 0 || q >= 1) continue;
      const a = (1 - q) * Math.min(1, q * 5), top = w.h * easeOut(q), y0 = p.y + s * 0.15 - s * 0.2 * q, pts: number[] = [];
      for (let j = 0; j <= 8; j++) {
        const f = j / 8;
        pts.push(w.x + Math.sin(f * 5 + w.ph + q * 6) * s * 0.06 * f, y0 - top * f);
      }
      g.poly(pts, false).stroke({ width: s * 0.07, color: STEAM, alpha: 0.12 * a, cap: "round", join: "round" });
      g.poly(pts, false).stroke({ width: 1.4, color: FOAM, alpha: 0.6 * a, cap: "round", join: "round" });
      g.circle(w.x, y0, s * (0.06 + 0.08 * q)).fill({ color: STEAM, alpha: 0.12 * a });
    }
  });
  for (let i = 0; i < Math.round(5 * k * t.quality); i++)
    t.spark(p.x + rand(-0.3, 0.3) * s, p.y + rand(-0.1, 0.25) * s, rand(-15, 15) * sc, -rand(40, 90) * sc, rand(0.45, 0.65), VAPOR);
  t.later(0.14, () => frost(t, r, s, along));
}

/** Frost crusting over a card: a glaze of ice over its face, crystal shards
 *  growing in from all round its edge, hairline cracks run across it from
 *  where the arm struck — holding a beat, then thawing to nothing. */
function frost(t: FxTools, r: Box, s: number, along: number) {
  const inset = s * 0.09, D2 = 0.62, c = centre(r);
  const x0 = r.x + inset, y0 = r.y + inset, w = r.w - inset * 2, h = r.h - inset * 2;
  // Shards round the edge, each a long thin crystal pointing in.
  const n = Math.round(14 * Math.max(0.6, t.quality));
  const shards = Array.from({ length: n }, (_, i) => {
    const f = (i + rand(0.2, 0.8)) / n, side = Math.floor(f * 4), q = f * 4 - side;
    const at = [{ x: x0 + w * q, y: y0 }, { x: x0 + w, y: y0 + h * q }, { x: x0 + w * (1 - q), y: y0 + h }, { x: x0, y: y0 + h * (1 - q) }][side];
    const inward = [Math.PI / 2, Math.PI, -Math.PI / 2, 0][side] + rand(-0.6, 0.6);
    return { ...at, ang: inward, len: s * rand(0.08, 0.2), w: s * rand(0.018, 0.03), when: rand(0, 0.08) };
  });
  // Cracks from the side the arm came in, across the face.
  const cracks = [-0.5, 0, 0.5].map((off) => {
    const a = along + off + rand(-0.15, 0.15), pts = [c.x - Math.cos(along) * s * 0.3, c.y - Math.sin(along) * s * 0.3];
    let x = pts[0], y = pts[1];
    for (let j = 0; j < 4; j++) {
      const aa = a + rand(-0.5, 0.5);
      x += Math.cos(aa) * s * 0.13;
      y += Math.sin(aa) * s * 0.13;
      pts.push(x, y);
    }
    return pts;
  });
  const fade = (time: number) => 1 - clamp01((time - 0.35) / (D2 - 0.35));
  t.draw(D2, (g, u) => {
    const time = u * D2, a = fade(time), k = easeOut(clamp01(time / 0.14));
    if (a <= 0.02) return;
    g.rect(x0, y0, w, h).fill({ color: ICE, alpha: 0.06 * a * k }).stroke({ width: 1.5, color: ICE, alpha: 0.6 * a * k });
    for (const sh of shards) {
      const L = sh.len * easeOut(clamp01((time - sh.when) / 0.14)), ca = Math.cos(sh.ang), sa = Math.sin(sh.ang);
      if (L < 1) continue;
      const mx = sh.x + ca * L * 0.35, my = sh.y + sa * L * 0.35;
      const pts = [sh.x, sh.y, mx - sa * sh.w, my + ca * sh.w, sh.x + ca * L, sh.y + sa * L, mx + sa * sh.w, my - ca * sh.w];
      g.poly(pts, true).fill({ color: ICE, alpha: 0.35 * a }).stroke({ width: 1, color: GLINT, alpha: 0.8 * a, join: "miter" });
    }
    const cr = clamp01((time - 0.04) / 0.12);
    if (cr > 0)
      for (const pts of cracks) {
        const m = Math.max(2, Math.round((pts.length / 2) * cr));
        g.poly(pts.slice(0, m * 2), false).stroke({ width: 1, color: GLINT, alpha: 0.65 * a, join: "miter" });
      }
  });
  t.glow(r, ICE, 0.14, 0.45, 0.9);
  for (let i = 0; i < 4; i++) t.spark(x0 + rand(0, w), y0 + rand(0, h), rand(-30, 30) * (s / 90), -rand(20, 60) * (s / 90), rand(0.3, 0.45), RIME);
}
