/** SHIELDS KNOCKED OFF — the plate a blow meets.
 *
 *  Shields are armour, not a second health bar: each one comes off every hit,
 *  and every hit chips one away (two at 10+, three at 21+). So a blow the
 *  shields soak changes no HP and floats no number — and on the board it
 *  looked as if nothing had happened to the card at all.
 *
 *  Drawn by what it MEANS, like a status or a buff, not by who struck or who
 *  wears it: in the shield stat's steel (the HP bar's grey head), a curved
 *  plate flares up in front of the card, facing the blow. It is made of one
 *  piece per shield the card wore, up to six, so the pieces the blow takes
 *  are the shields it cost: their seams flash, and they break off and tumble
 *  away. When the last one goes, the whole plate shatters.
 *
 *  A blow the plate soaked entirely never reached the card, so it is not drawn
 *  as damage: the shot is stopped on the plate (impact-layer.ts `attackIn`)
 *  and splashes there in its element's colours, drawn here — no damage burst.
 *  One that broke through gets a fainter plate, behind the damage it did. A
 *  spell has no side it came from, so it lights all of the plate — a ring
 *  round the card — and chips it from the top. */
import type { Rect } from "./impact-layer";
import { centre, plateRadius, rand } from "./looks/base";
import type { FxTools, Pt, SparkStyle } from "./looks/types";

export interface ShieldHitArgs {
  rect: Rect;
  /** Shields worn before the blow, and how many it took. */
  had: number;
  lost: number;
  /** The shields took all of it. */
  soaked: boolean;
  /** The line of the blow (attacker to card, screen radians) — the plate
   *  faces back along it. None for a spell. */
  angle?: number;
}

/** A soaked blow's splash: its element's spark style (impact-layer.ts STYLES). */
export type Splash = SparkStyle & { speed: [number, number]; life: [number, number] };

const TAU = Math.PI * 2;
/** The shield stat's steel, lit: under additive light a grey reads as a pale
 *  glow, so the plate is drawn a little cooler and brighter than the stat. */
const RIM = 0xe2eaf8, STEEL = 0x8e9cb8, WHITE = 0xffffff;
/** The clang: fast white streaks that die almost at once. */
const CLANG: SparkStyle = { palette: [0xffffff, 0xeef3ff, 0xb4c2dc, 0x6c7a96], gravity: 300, drag: 0.02, size: [6, 1.5], streak: true };
/** What is left of a shattered plate: fine glints, falling. */
const GLINT: SparkStyle = { palette: [0xffffff, 0xe2eaf8, 0x8e9cb8], gravity: 380, drag: 0.35, size: [4, 1.5], streak: false };
/** Past six pieces a plate's pieces are too thin to count. */
const MAX_PIECES = 6;
/** Shortest signed turn from `a` to `b`. */
const turn = (a: number, b: number) => ((((b - a) % TAU) + TAU * 1.5) % TAU) - Math.PI;
const easeOut = (x: number) => 1 - (1 - x) * (1 - x);

interface Piece {
  /** Its outline, relative to its centre `o`. */
  pts: number[];
  o: Pt;
  /** Knocked off: velocity px/s and spin rad/s. Null for one the blow left. */
  v: { x: number; y: number; spin: number } | null;
  /** How near the point of impact, 0-1 (1 = where it struck). */
  near: number;
}

export function drawShieldHit(t: FxTools, a: ShieldHitArgs, splash: Splash) {
  const r = a.rect, c = centre(r), s = Math.min(r.w, r.h);
  const R = plateRadius(r), th = s * 0.15;
  /** Speeds are for a 90px square; a phone's squares are smaller. */
  const px = s / 90;
  const whole = a.angle === undefined;
  // The plate faces the blow: back along its line, toward the attacker. A
  // spell's comes from above.
  const facing = whole ? -Math.PI / 2 : a.angle! + Math.PI;
  const span = whole ? TAU : 2.3; // ~130° in front of the card
  const n = Math.max(1, Math.min(MAX_PIECES, a.had));
  const shatter = a.lost >= a.had;
  // The pieces it took: all of them when the last shield goes; otherwise its
  // share of the plate — never the whole of it while any shield is left.
  const knocked = shatter ? n : Math.max(1, Math.min(n - 1, Math.round((a.lost / a.had) * n)));
  const step = span / n, gap = n > 1 ? 0.08 : 0;
  const mids = Array.from({ length: n }, (_, i) => facing - span / 2 + (i + 0.5) * step);
  // Nearest the point of impact first: those are the ones it breaks.
  const order = mids.map((m, i) => ({ i, d: Math.abs(turn(facing, m)) })).sort((p, q) => p.d - q.d || p.i - q.i);
  const broken = new Set(order.slice(0, knocked).map((p) => p.i));

  const pieces: Piece[] = [];
  const piece = (a0: number, a1: number, near: number, knockedOff: boolean) => {
    const mid = (a0 + a1) / 2, ro = R + th / 2, ri = R - th / 2;
    const o = { x: c.x + Math.cos(mid) * R, y: c.y + Math.sin(mid) * R };
    const pts: number[] = [];
    const k = Math.max(2, Math.ceil((a1 - a0) / 0.2));
    for (let j = 0; j <= k; j++) {
      const q = a0 + ((a1 - a0) * j) / k;
      pts.push(c.x + Math.cos(q) * ro - o.x, c.y + Math.sin(q) * ro - o.y);
    }
    for (let j = k; j >= 0; j--) {
      const q = a0 + ((a1 - a0) * j) / k;
      pts.push(c.x + Math.cos(q) * ri - o.x, c.y + Math.sin(q) * ri - o.y);
    }
    let v: Piece["v"] = null;
    if (knockedOff) {
      // Knocked outward and off to the side it was struck from, then down —
      // a piece of plate falling away, not a spark.
      const side = Math.sign(turn(facing, mid)) || (Math.random() < 0.5 ? -1 : 1);
      const out = rand(45, 95) * px * (shatter ? 1.35 : 1), sideways = rand(35, 85) * px;
      v = {
        x: Math.cos(mid) * out + Math.cos(mid + (side * Math.PI) / 2) * sideways,
        y: Math.sin(mid) * out + Math.sin(mid + (side * Math.PI) / 2) * sideways - rand(60, 120) * px,
        spin: rand(3, 7) * side,
      };
    }
    pieces.push({ pts, o, v, near });
  };
  mids.forEach((m, i) => {
    const a0 = m - step / 2 + gap / 2, a1 = m + step / 2 - gap / 2;
    const near = Math.max(0, 1 - Math.abs(turn(facing, m)) / (span / 2));
    if (!broken.has(i)) return piece(a0, a1, near, false);
    // A shattering plate breaks smaller than it was made: each piece in two.
    if (shatter && a1 - a0 > 0.3) {
      const cut = (a0 + a1) / 2 + rand(-0.08, 0.08);
      piece(a0, cut, near, true);
      piece(cut, a1, near, true);
    } else piece(a0, a1, near, true);
  });

  // How bright: the full flare for a blow it stopped; about half for one that
  // broke through, which has its own damage burst to read.
  const peak = a.soaked ? 1 : 0.55;
  const D = 0.7, BREAK = 0.08, FALL = 800 * px;
  const hit = { x: c.x + Math.cos(facing) * R, y: c.y + Math.sin(facing) * R };
  t.draw(D, (g, u) => {
    const time = u * D;
    // Up at once — it is the blow's answer, not a spell going up — held a
    // moment, then gone: the plating left is the bar's grey head again.
    const body = peak * (time < 0.22 ? 1 : Math.max(0, 1 - (time - 0.22) / 0.3));
    for (const p of pieces) {
      let ox = p.o.x, oy = p.o.y, rot = 0, alpha = body;
      if (p.v && time > BREAK) {
        const f = time - BREAK;
        ox += p.v.x * f;
        oy += p.v.y * f + 0.5 * FALL * f * f;
        rot = p.v.spin * f;
        alpha = peak * Math.pow(Math.max(0, 1 - f / (D - BREAK)), 1.2);
      }
      if (alpha <= 0.01) continue;
      const cos = Math.cos(rot), sin = Math.sin(rot), P: number[] = [];
      for (let j = 0; j < p.pts.length; j += 2)
        P.push(ox + p.pts[j] * cos - p.pts[j + 1] * sin, oy + p.pts[j] * sin + p.pts[j + 1] * cos);
      // The pieces nearest the blow take its light first.
      const lit = Math.max(0, 1 - time / 0.16) * p.near * p.near;
      g.poly(P, true).stroke({ width: th * 0.7, color: STEEL, alpha: 0.16 * alpha }); // its glow
      g.poly(P, true).fill({ color: STEEL, alpha: (0.4 + 0.45 * lit) * alpha })
        .stroke({ width: 1.8, color: RIM, alpha: Math.min(1, (0.8 + 0.2 * lit) * alpha) });
      // The seams of a piece about to go flash white: the crack before it breaks.
      if (p.v && time < BREAK + 0.06)
        g.poly(P, true).stroke({ width: 2.6, color: WHITE, alpha: peak * (1 - time / (BREAK + 0.06)) });
    }
    // The blow's force running out along the plate from where it struck.
    const front = Math.min(1, time / 0.16), fade = Math.max(0, 1 - time / 0.24);
    if (fade > 0)
      for (const side of [-1, 1]) {
        const q = facing + side * front * (span / 2);
        g.moveTo(c.x + Math.cos(q - 0.22) * R, c.y + Math.sin(q - 0.22) * R).arc(c.x, c.y, R, q - 0.22, q + 0.22)
          .stroke({ width: th * 0.75, color: WHITE, alpha: 0.55 * fade * peak });
      }
    // All of it gone: a shock of light off the plate, outward as it goes.
    if (shatter && time < 0.32) {
      const k = time / 0.32, rr = R + s * 0.4 * easeOut(k);
      const a0 = whole ? 0 : facing - span / 2, a1 = whole ? TAU : facing + span / 2;
      g.moveTo(c.x + Math.cos(a0) * rr, c.y + Math.sin(a0) * rr).arc(c.x, c.y, rr, a0, a1)
        .stroke({ width: 3 * (1 - k) + 1, color: RIM, alpha: 0.75 * (1 - k) });
    }
  });

  // The clang: sparks skating off the plate from where it was struck, mostly
  // along it — a blow turned aside — and a hard white point at the contact.
  t.flash(hit, WHITE, (shatter ? 0.65 : a.soaked ? 0.45 : 0.28) * (whole ? 0.8 : 1));
  const sparks = shatter ? 16 : a.soaked ? 10 : 5;
  for (let i = 0; i < sparks; i++) {
    const side = i % 2 ? 1 : -1;
    const q = facing + side * rand(0.35, 1.75);
    const v = rand(240, 520) * px;
    t.spark(hit.x, hit.y, Math.cos(q) * v, Math.sin(q) * v, rand(0.16, 0.34), CLANG);
  }
  // What it was stopped from doing: the shot's own element, splashed back off
  // the plate — the colour says whose blow it was.
  if (a.soaked) {
    t.flash(hit, splash.palette[1] ?? splash.palette[0], 0.32);
    for (let i = 0; i < 9; i++) {
      const q = facing + rand(-1.2, 1.2), v = rand(splash.speed[0], splash.speed[1]) * 0.5 * px;
      t.spark(hit.x, hit.y, Math.cos(q) * v, Math.sin(q) * v, rand(splash.life[0], splash.life[1]) * 0.5, splash);
    }
  }
  if (shatter)
    for (let i = 0; i < 12; i++) {
      const q = facing + rand(-span / 2, span / 2), v = rand(40, 130) * px;
      t.spark(c.x + Math.cos(q) * R, c.y + Math.sin(q) * R, Math.cos(q) * v, Math.sin(q) * v - 40 * px, rand(0.3, 0.5), GLINT);
    }
}
