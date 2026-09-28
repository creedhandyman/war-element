/** KATO — Shattercharge. "Rolls a slot forward and ploughs the lane: 14 DMG
 *  through shields to the first opponent ahead and 8 to everything packed
 *  behind it, shoving the front one back." You will beat it. That is not the
 *  same as it being over.
 *
 *  Kato is the war machine on its art: a stone hull on great wheels, violet
 *  crystals set in it, lightning crawling over it. The DELIVERY is the charge:
 *  its wheels spin up throwing sparks and grit back, lightning crackling over
 *  it, then it rolls — its crystal-spiked ram driving forward the slot it
 *  moves, wheel ruts gouged behind it, and reaches the lane as the delivery
 *  ends (its card jumps there on the landing). The LANDING is the plough: a
 *  bow wave of shattered rock heaves up either side of the lane as the ram
 *  runs on down it, the ground split behind, sparks spraying; the first card
 *  in the way takes the crunch — lightning, rubble — and is SHOVED back along
 *  the lane, and everything packed behind it is heaved up as the wave passes.
 *
 *  Stone is SOLID, on the normal-blend layer; the light is the crystals'
 *  violet, the lightning's yellow and the sparks. */
import { centre, rand } from "../looks/base";
import type { Graphics } from "pixi.js";
import type { FxTools, Pt, SparkStyle } from "../looks/types";
import type { Signature, SigMoment } from "./types";

type Box = SigMoment["from"];

const TAU = Math.PI * 2;
// The hull and the rock it ploughs: real colour, on the normal-blend layer.
const HULL = 0x34303a, HULL_HI = 0x736b7c, HULL_LO = 0x16141a, ROCK = 0x7a6e66, ROCK_HI = 0xc0b4a4, ROCK_LO = 0x40382f;
const EDGE = 0x0e0c0e, CRACK = 0x0b090a, DUST = 0xa89c90;
// Light (additive): its crystals, its lightning.
const VIOLET = 0x9a6cff, LILAC = 0xd6c4ff, BOLT_Y = 0xffd84a, BOLT_W = 0xfff6cc;
/** Sparks off the wheels and the ram: hot, fast, falling. */
const SPARK: SparkStyle = { palette: [0xffffff, BOLT_W, BOLT_Y, 0xd08a20], gravity: 700, drag: 0.4, size: [6, 2], streak: true };
/** Violet crystal chips knocked loose. */
const SHARD: SparkStyle = { palette: [0xffffff, LILAC, VIOLET], gravity: 800, drag: 0.5, size: [6, 2], streak: true };
/** Grit off the rock. */
const GRIT: SparkStyle = { palette: [0xfff1dc, 0xd9c8b0, 0x9a8c80], gravity: 950, drag: 0.6, size: [5, 2], streak: false };

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeOut = (x: number) => 1 - (1 - x) * (1 - x);

/** "Ahead", made safe to build on. */
function unit(v: Pt): Pt {
  const l = Math.hypot(v.x, v.y);
  return l > 1e-6 ? { x: v.x / l, y: v.y / l } : { x: 0, y: -1 };
}

/** THE RAM at the front of the hull, as on the art: a heavy stone wedge, its
 *  back `w` either side of `p`, driving along `u` — lit cheek, shadowed
 *  cheek, a seam across it — with violet crystal spikes jutting from its
 *  face. The stone on the normal-blend layer, or (`lit`) its light: the
 *  crystals glowing, and lightning crawling between their points. */
function ram(g: Graphics, p: Pt, u: Pt, w: number, lit: boolean, glow = 1) {
  const nx = -u.y, ny = u.x, D = w * 0.8;
  const at = (f: number, side: number) => ({ x: p.x + u.x * D * f + nx * w * side, y: p.y + u.y * D * f + ny * w * side });
  const bl = at(0, 1), br = at(0, -1), cl = at(0.62, 0.62), cr = at(0.62, -0.62), nose = at(1, 0);
  const body = [bl.x, bl.y, cl.x, cl.y, nose.x, nose.y, cr.x, cr.y, br.x, br.y];
  // Spikes from its face: the nose and both front corners, jutting forward.
  const spikes = [{ b: nose, len: w * 0.62 }, { b: cl, len: w * 0.46 }, { b: cr, len: w * 0.46 }];
  const spike = (sp: (typeof spikes)[number], k: number) => {
    const tip = { x: sp.b.x + u.x * sp.len * k, y: sp.b.y + u.y * sp.len * k }, hw = w * 0.13 * k;
    return { tip, pts: [sp.b.x + nx * hw, sp.b.y + ny * hw, tip.x, tip.y, sp.b.x - nx * hw, sp.b.y - ny * hw] };
  };
  const litSide = nx + ny < 0 ? 1 : -1;
  if (!lit) {
    g.poly(body, true).fill({ color: HULL, alpha: 1 });
    const hi = at(0.62, 0.62 * litSide), lo = at(0.62, -0.62 * litSide);
    g.poly([at(0, litSide).x, at(0, litSide).y, hi.x, hi.y, nose.x, nose.y, p.x, p.y], true).fill({ color: HULL_HI, alpha: 0.75 });
    g.poly([at(0, -litSide).x, at(0, -litSide).y, lo.x, lo.y, nose.x, nose.y, p.x, p.y], true).fill({ color: HULL_LO, alpha: 0.8 });
    const s0 = at(0.3, 0.85), s1 = at(0.3, -0.85);
    g.moveTo(s0.x, s0.y).lineTo(s1.x, s1.y).stroke({ width: 1.5, color: EDGE, alpha: 0.9 });
    g.poly(body, true).stroke({ width: 2, color: EDGE, alpha: 1 });
    for (const sp of spikes) g.poly(spike(sp, 1).pts, true).fill({ color: 0x2a1858, alpha: 1 });
    return;
  }
  g.poly(body, true).stroke({ width: 1.2, color: VIOLET, alpha: 0.5 * glow });
  for (const sp of spikes) {
    const { tip, pts } = spike(sp, 1);
    g.poly(pts, true).fill({ color: VIOLET, alpha: 0.55 * glow });
    g.poly(spike(sp, 0.7).pts, true).fill({ color: LILAC, alpha: 0.85 * glow });
    g.circle(tip.x, tip.y, w * 0.12).fill({ color: LILAC, alpha: 0.5 * glow });
  }
  // Lightning between the spike points, flickering: never the same twice.
  if (Math.random() < 0.7 * glow) {
    const a = spike(spikes[0], 1).tip, b = spike(spikes[Math.random() < 0.5 ? 1 : 2], 1).tip;
    zap(g, a, b, w * 0.2, glow);
  }
}

/** A shard of rock standing on `base` along `up`, `h` tall, leaning `lean`:
 *  jagged, lit on one face and shadowed on the other. */
function shard(g: Graphics, x: number, y: number, w: number, h: number, lean: number, alpha: number) {
  if (h < 2 || alpha <= 0.02) return;
  const tx = x + lean * h, ty = y - h;
  const body = [x - w, y, x - w * 0.5 + lean * h * 0.5, y - h * 0.55, tx, ty, x + w * 0.6 + lean * h * 0.5, y - h * 0.4, x + w, y];
  g.poly(body, true).fill({ color: ROCK, alpha });
  g.poly([x - w, y, x - w * 0.5 + lean * h * 0.5, y - h * 0.55, tx, ty, x - w * 0.1 + lean * h * 0.3, y - h * 0.2], true).fill({ color: ROCK_HI, alpha: alpha * 0.7 });
  g.poly([tx, ty, x + w * 0.6 + lean * h * 0.5, y - h * 0.4, x + w, y, x + w * 0.2, y], true).fill({ color: ROCK_LO, alpha: alpha * 0.7 });
  g.poly(body, true).stroke({ width: 1.3, color: EDGE, alpha });
}

function rockShape(): number[] {
  const out: number[] = [], n = 5 + Math.floor(rand(0, 3)), a0 = rand(0, TAU);
  for (let i = 0; i < n; i++) out.push(a0 + (i / n) * TAU + rand(-0.25, 0.25), rand(0.72, 1));
  return out;
}

/** A rock at (x, y), `size` its radius, turned `rot`. */
function rock(g: Graphics, x: number, y: number, size: number, rot: number, rk: number[], alpha: number) {
  if (alpha <= 0.02 || size < 1) return;
  const face = (k: number, dx: number, dy: number) => {
    const p: number[] = [];
    for (let i = 0; i < rk.length; i += 2) p.push(x + dx + Math.cos(rk[i] + rot) * rk[i + 1] * size * k, y + dy + Math.sin(rk[i] + rot) * rk[i + 1] * size * k);
    return p;
  };
  const body = face(1, 0, 0);
  g.poly(body, true).fill({ color: ROCK, alpha });
  g.poly(face(0.62, size * 0.16, size * 0.18), true).fill({ color: ROCK_LO, alpha: alpha * 0.75 });
  g.poly(face(0.5, -size * 0.2, -size * 0.22), true).fill({ color: ROCK_HI, alpha: alpha * 0.85 });
  g.poly(body, true).stroke({ width: Math.max(1, size * 0.12), color: EDGE, alpha });
}

/** Rubble thrown from `at`, up and out — or, given `out`, flung out that way
 *  and up, as off a plough's blade — bouncing once on `floor`. */
function rubble(t: FxTools, at: Pt, n: number, size: [number, number], s: number, floor: number, out?: Pt) {
  const sc = s / 90;
  const bits = Array.from({ length: Math.max(1, Math.round(n * t.quality)) }, () => {
    const a = (rand(-165, -15) * Math.PI) / 180, v = rand(180, 340) * sc;
    const vx = out ? out.x * v * rand(0.6, 1) : Math.cos(a) * v, vy = out ? out.y * v * rand(0.6, 1) - rand(120, 220) * sc : Math.sin(a) * v;
    return { x: at.x, y: at.y, vx, vy, rot: rand(0, TAU), vr: rand(-9, 9), size: rand(size[0], size[1]), rk: rockShape(), age: 0, life: rand(0.5, 0.7) };
  });
  t.draw(0.7, (g, _u, dt) => {
    for (const b of bits) {
      b.age += dt;
      if (b.age >= b.life) continue;
      b.vy += 1500 * sc * dt;
      b.x += b.vx * dt; b.y += b.vy * dt; b.rot += b.vr * dt;
      if (b.y > floor && b.vy > 0) { b.y = floor; b.vy *= -0.3; b.vx *= 0.55; b.vr *= 0.5; }
      rock(g, b.x, b.y, b.size, b.rot, b.rk, b.age > b.life * 0.7 ? 1 - (b.age - b.life * 0.7) / (b.life * 0.3) : 1);
    }
  }, { dark: true });
}

/** Dust churned up low from a point. */
function dust(t: FxTools, at: Pt, n: number, size: number, spread: number, life = 0.8) {
  const puffs = Array.from({ length: Math.max(1, Math.round(n * t.quality)) }, (_, i) => ({
    x: at.x + rand(-4, 4), y: at.y + rand(-3, 3), r: size * rand(0.6, 1),
    vx: (i % 2 ? 1 : -1) * rand(0.35, 1) * spread, vy: -size * rand(0.4, 1.8), age: 0, life: life * rand(0.8, 1.2),
  }));
  t.draw(life * 1.2, (g, _u, dt) => {
    for (const p of puffs) {
      p.age += dt;
      if (p.age >= p.life) continue;
      const q = p.age / p.life;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= Math.pow(0.12, dt);
      const rr = p.r * (1 + q * 1.6), a = q < 0.15 ? q / 0.15 : 1 - (q - 0.15) / 0.85;
      g.circle(p.x, p.y, rr).fill({ color: DUST, alpha: 0.15 * a }).circle(p.x, p.y, rr * 0.62).fill({ color: DUST, alpha: 0.2 * a });
    }
  }, { dark: true });
}

/** Lightning from `a` to `b`: a jagged line re-rolled each call, a violet
 *  halo round a yellow-white core. */
function zap(g: Graphics, a: Pt, b: Pt, jag: number, alpha: number) {
  const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L, pts = [a.x, a.y];
  for (let i = 1; i < 6; i++) {
    const f = i / 6, j = rand(-1, 1) * jag * Math.sin(Math.PI * f);
    pts.push(a.x + dx * f + nx * j, a.y + dy * f + ny * j);
  }
  pts.push(b.x, b.y);
  g.poly(pts, false).stroke({ width: 4, color: VIOLET, alpha: 0.35 * alpha });
  g.poly(pts, false).stroke({ width: 1.5, color: BOLT_W, alpha: 0.95 * alpha });
}

export const KATO: Signature = {
  shake: 1.8,
  // It does not lunge: it drives, and draws its own charge.
  lunge: false,

  deliver(t: FxTools, m: SigMoment, seconds: number) {
    const a = centre(m.from), b = centre(m.to), s = m.size, S = seconds, u = unit(m.ahead), nx = -u.y, ny = u.x;
    const W = s * 0.46, REV = S * 0.4;
    // Where the ram is: at its own front edge while it revs, then driven
    // forward the slot it rolls into.
    const pos = (time: number) => {
      const q = time < REV ? 0 : easeOut((time - REV) / (S - REV)), shake = time < REV ? Math.sin(time * 90) * s * 0.012 : 0;
      return { x: a.x + (b.x - a.x) * q + u.x * s * 0.3 + nx * shake, y: a.y + (b.y - a.y) * q + u.y * s * 0.3 + ny * shake };
    };
    // WHEEL RUTS gouged behind it as it rolls, the tread printed in them.
    const ruts = (g: Graphics, time: number, lit: boolean) => {
      const q = time < REV ? 0 : easeOut((time - REV) / (S - REV));
      if (q <= 0.02) return;
      const L = Math.hypot(b.x - a.x, b.y - a.y) * q + s * 0.6, tw = s * 0.07;
      for (const side of [-1, 1]) {
        const o = side * s * 0.32, x0 = a.x + nx * o - u.x * s * 0.3, y0 = a.y + ny * o - u.y * s * 0.3;
        if (lit) {
          g.moveTo(x0 + nx * tw - 1, y0 + ny * tw - 1).lineTo(x0 + nx * tw + u.x * L - 1, y0 + ny * tw + u.y * L - 1).stroke({ width: 1, color: ROCK_HI, alpha: 0.5 });
          continue;
        }
        g.moveTo(x0, y0).lineTo(x0 + u.x * L, y0 + u.y * L).stroke({ width: tw * 2, color: CRACK, alpha: 0.8 });
        for (let d = s * 0.05; d < L; d += s * 0.11)
          g.moveTo(x0 + u.x * d + nx * tw, y0 + u.y * d + ny * tw).lineTo(x0 + u.x * d - nx * tw, y0 + u.y * d - ny * tw)
            .stroke({ width: 1.5, color: ROCK_LO, alpha: 0.9 });
      }
    };
    t.draw(S, (g, v) => {
      ruts(g, v * S, false);
      ram(g, pos(v * S), u, W, false);
    }, { dark: true });
    let spark = 0;
    t.draw(S, (g, v, dt) => {
      const time = v * S, rev = clamp01(time / REV);
      ruts(g, time, true);
      // Its crystals' light smeared out behind it as it goes: the charge.
      if (time > REV) {
        const p = pos(time), back = Math.hypot(p.x - a.x, p.y - a.y) + s * 0.3;
        for (const [w, col, al] of [[s * 0.7, VIOLET, 0.16], [s * 0.3, LILAC, 0.22]] as const)
          g.moveTo(p.x, p.y).lineTo(p.x - u.x * back, p.y - u.y * back).stroke({ width: w, color: col, alpha: al * clamp01((time - REV) / 0.08) });
      }
      ram(g, pos(time), u, W, true, 0.5 + 0.5 * rev);
      // Lightning crawling over it, more as it winds up.
      if (Math.random() < 0.35 + 0.4 * rev) {
        const p = pos(time), q = { x: p.x - u.x * s * rand(0.3, 0.8) + nx * rand(-1, 1) * s * 0.4, y: p.y - u.y * s * rand(0.3, 0.8) + ny * rand(-1, 1) * s * 0.4 };
        zap(g, p, q, s * 0.1, 0.8);
      }
      // Its wheels: sparks and grit thrown back off both sides.
      spark += dt * (time < REV ? 70 : 110) * t.quality;
      for (; spark >= 1; spark--) {
        const p = pos(time), side = Math.random() < 0.5 ? -1 : 1, wx = p.x - u.x * s * 0.75 + nx * side * s * 0.32, wy = p.y - u.y * s * 0.75 + ny * side * s * 0.32;
        const v1 = rand(120, 280) * (s / 90);
        t.spark(wx, wy, -u.x * v1 + nx * side * rand(0, 80) * (s / 90), -u.y * v1 + ny * side * rand(0, 80) * (s / 90) - rand(40, 120) * (s / 90),
          rand(0.2, 0.4), Math.random() < 0.6 ? SPARK : GRIT);
      }
    });
    t.glow(m.from, VIOLET, 0.35, S, 1.05);
    // Dust thrown up off its wheels as it pulls away, and as it rolls.
    t.later(REV, () => dust(t, { x: a.x - u.x * s * 0.3, y: a.y - u.y * s * 0.3 + s * 0.1 }, 7, s * 0.2, 90 * (s / 90), 0.8));
    t.later((REV + S) / 2, () => dust(t, { x: (a.x + b.x) / 2 - u.x * s * 0.2, y: (a.y + b.y) / 2 - u.y * s * 0.2 + s * 0.1 }, 5, s * 0.18, 80 * (s / 90), 0.7));
  },

  land(t: FxTools, m: SigMoment) {
    const at = centre(m.to), s = m.size, u = unit(m.ahead), nx = -u.y, ny = u.x;
    // THE LANE: the cards in it, nearest first, and how far down it each lies.
    const hits = m.targets.map((r, i) => {
      const p = centre(r);
      return { r, p, d: (p.x - at.x) * u.x + (p.y - at.y) * u.y, power: m.power[i] ?? 1, killed: !!m.killed[i] };
    }).sort((p, q) => p.d - q.d);
    const start = s * 0.42, end = Math.max(s * 1.6, (hits.length ? hits[hits.length - 1].d : s) + s * 0.6);
    const RUN = 0.42, D = 1.25;
    const front = (time: number) => start + (end - start) * easeOut(clamp01(time / RUN));
    const when = (d: number) => RUN * (1 - Math.sqrt(clamp01(1 - (d - start) / (end - start))));
    const fade = (time: number) => 1 - clamp01((time - 0.8) / 0.45);
    // THE CRASH as it hits the lane: a burst of its lightning, a flash off
    // the crystals, dust shoved out round the ram.
    const hit = { x: at.x + u.x * s * 0.5, y: at.y + u.y * s * 0.5 };
    t.flash(hit, LILAC, 0.3 * (s / 80));
    t.arcs(hit, [BOLT_W, BOLT_Y, VIOLET], 0.45 * (s / 80), 6);
    t.ring({ x: hit.x - s * 0.5, y: hit.y - s * 0.5, w: s, h: s }, LILAC, 0.3, 1.5, 0.35, 4);
    dust(t, { x: hit.x, y: hit.y + s * 0.15 }, 8, s * 0.2, 130 * (s / 90), 0.9);
    // The bow wave: rock shards heaved up either side of the lane as the ram
    // passes, leaning out, and settling back.
    const shards: { d: number; side: number; h: number; w: number; lean: number }[] = [];
    for (let d = start + s * 0.1; d < end; d += s * 0.15)
      for (const side of [-1, 1])
        shards.push({ d: d + rand(-0.04, 0.04) * s, side, h: s * rand(0.3, 0.48), w: s * rand(0.08, 0.13), lean: rand(0.25, 0.55) });
    const split: number[] = [];
    for (let d = start; d <= end; d += s * 0.14) {
      const j = rand(-1, 1) * s * 0.04;
      split.push(at.x + u.x * d + nx * j, at.y + u.y * d + ny * j);
    }
    t.draw(D, (g, v) => {
      const time = v * D, f = front(time), a = fade(time);
      const n = Math.max(2, Math.min(split.length / 2, Math.ceil((f - start) / (s * 0.14)) + 1));
      g.poly(split.slice(0, n * 2), false).stroke({ width: s * 0.06, color: CRACK, alpha: 0.9 * a, join: "round" });
      for (const sh of shards) {
        const q = (time - when(sh.d)) / 0.5;
        if (q <= 0) continue;
        const rise = q < 0.2 ? easeOut(q / 0.2) : 1 - 0.55 * clamp01((q - 0.2) / 0.8);
        const off = sh.side * s * (0.34 + 0.1 * clamp01(q * 3));
        shard(g, at.x + u.x * sh.d + nx * off, at.y + u.y * sh.d + ny * off, sh.w, sh.h * rise, sh.side * nx * sh.lean, a);
      }
      // The ram itself, driving on down the lane.
      if (time < RUN) ram(g, { x: at.x + u.x * (f - s * 0.3), y: at.y + u.y * (f - s * 0.3) }, u, s * 0.46, false);
    }, { dark: true });
    let spray = 0;
    t.draw(D, (g, v, dt) => {
      const time = v * D, f = front(time);
      if (time >= RUN) return;
      const p = { x: at.x + u.x * f, y: at.y + u.y * f };
      ram(g, { x: p.x - u.x * s * 0.3, y: p.y - u.y * s * 0.3 }, u, s * 0.46, true, 1);
      // Sparks and grit sprayed off the ram either side, like a bow wave.
      spray += dt * 120 * t.quality;
      for (; spray >= 1; spray--) {
        const side = Math.random() < 0.5 ? -1 : 1, v1 = rand(140, 300) * (s / 90);
        t.spark(p.x + u.x * s * 0.3 + nx * side * s * 0.2, p.y + u.y * s * 0.3 + ny * side * s * 0.2,
          nx * side * v1 + u.x * v1 * 0.4, ny * side * v1 + u.y * v1 * 0.4 - rand(60, 160) * (s / 90), rand(0.25, 0.45), Math.random() < 0.5 ? SPARK : GRIT);
      }
    });
    // Each card in the lane, as the ram reaches it: the first takes the
    // crunch and is shoved on down the lane; the rest are heaved as it passes.
    hits.forEach((h, i) => t.later(when(Math.max(start, h.d - s * 0.35)), () => (i === 0 ? crunch(t, h.r, u, h.power, h.killed, s) : heave(t, h.r, h.power, s))));
    // Chunks thrown out to either side of the lane as it ploughs, like earth
    // off a plough's blade.
    for (let i = 0; i < 4; i++) {
      const d = start + ((end - start) * (i + 0.5)) / 4;
      t.later(when(d), () => {
        for (const side of [-1, 1])
          rubble(t, { x: at.x + u.x * d + nx * side * s * 0.3, y: at.y + u.y * d + ny * side * s * 0.3 }, 2, [s * 0.04, s * 0.07], s,
            at.y + u.y * d + s * 0.35, { x: nx * side, y: ny * side });
      });
    }
    dust(t, { x: at.x + u.x * s * 0.4, y: at.y + u.y * s * 0.4 + s * 0.1 }, 6, s * 0.18, 90 * (s / 90), 0.9);
  },
};

/** The front card takes the ram: a crunch of rock and crystal, lightning
 *  forking over it — and it is SHOVED on down the lane: a crescent of force
 *  driven on from it, and dust thrown up where it stops. */
function crunch(t: FxTools, r: Box, u: Pt, power: number, killed: boolean, s: number) {
  const c = centre(r), k = Math.max(0.9, Math.min(1.6, power)), floor = r.y + r.h * 0.95, nx = -u.y, ny = u.x;
  t.flash(c, BOLT_W, 0.28 * k * (s / 80));
  rubble(t, c, Math.round(5 + 2 * k) + (killed ? 3 : 0), [s * 0.05, s * 0.09], s, floor);
  dust(t, { x: c.x, y: floor - s * 0.1 }, 6, s * 0.18, 110 * (s / 90), 0.8);
  // The shove: a crescent of force driven a slot on down the lane.
  const push = s * 1.05, D = 0.45;
  t.draw(D, (g, v) => {
    const q = easeOut(clamp01(v / 0.55)), a = 1 - clamp01((v - 0.45) / 0.55), f = s * 0.4 + push * q, R = s * 0.5;
    const arc: number[] = [];
    for (let i = 0; i <= 10; i++) {
      const w = -1 + i / 5, back = (1 - Math.sqrt(1 - w * w * 0.9)) * R * 0.8;
      arc.push(c.x + u.x * (f - back) + nx * w * R, c.y + u.y * (f - back) + ny * w * R);
    }
    g.poly(arc, false).stroke({ width: s * 0.16, color: VIOLET, alpha: 0.3 * a });
    g.poly(arc, false).stroke({ width: s * 0.05, color: LILAC, alpha: 0.85 * a });
    g.poly(arc, false).stroke({ width: 1.5, color: BOLT_W, alpha: 0.95 * a });
    for (let i = 0; i < 3; i++) zap(g, c, { x: c.x + rand(-0.5, 0.5) * s, y: c.y + rand(-0.5, 0.5) * s }, s * 0.08, 0.9 * (1 - v));
  });
  t.later(0.2, () => dust(t, { x: c.x + u.x * push, y: c.y + u.y * push + s * 0.2 }, 5, s * 0.16, 80 * (s / 90), 0.7));
  for (let i = 0; i < Math.round(12 * k); i++) {
    const a = rand(0, TAU), v = rand(160, 320) * (s / 90);
    t.spark(c.x, c.y, Math.cos(a) * v + u.x * v * 0.5, Math.sin(a) * v + u.y * v * 0.5, rand(0.25, 0.45), i % 3 ? SPARK : SHARD);
  }
}

/** A card further down the lane, heaved as the plough's wave passes under
 *  it: rock thrown up round it, grit, a lick of lightning. */
function heave(t: FxTools, r: Box, power: number, s: number) {
  const c = centre(r), k = Math.max(0.7, Math.min(1.4, power)), floor = r.y + r.h * 0.95;
  t.flash(c, LILAC, 0.18 * k * (s / 80));
  rubble(t, c, Math.round(3 + 2 * k), [s * 0.04, s * 0.07], s, floor);
  dust(t, { x: c.x, y: floor - s * 0.1 }, 4, s * 0.15, 80 * (s / 90), 0.7);
  t.draw(0.3, (g, v) => {
    for (let i = 0; i < 2; i++) zap(g, c, { x: c.x + rand(-0.45, 0.45) * s, y: c.y + rand(-0.45, 0.45) * s }, s * 0.07, 0.85 * (1 - v));
  });
  for (let i = 0; i < Math.round(8 * k); i++) {
    const a = (rand(-165, -15) * Math.PI) / 180, v = rand(120, 260) * (s / 90);
    t.spark(c.x + rand(-6, 6), c.y + rand(-6, 6), Math.cos(a) * v, Math.sin(a) * v, rand(0.25, 0.45), i % 2 ? GRIT : SPARK);
  }
}
