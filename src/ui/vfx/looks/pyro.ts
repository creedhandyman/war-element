/** PYRO — fire.
 *
 *  Told apart from every other element by SHAPE and MOTION, not only colour:
 *  fire is drawn as FLAME TONGUES — a round hot bulb tapering to a licking tip,
 *  always leaning UP, flickering in height — and what it sheds are embers that
 *  rise and wink out. Where it has been it leaves a scorch (real darkness, on
 *  the normal-blend layer). Everything below is composed from those three:
 *  tongues, rising embers, scorch. Colours walk hot white -> amber -> orange ->
 *  deep red as they cool, matching the standard PYRO burst and the meteors of
 *  its whole-board set piece. The flame itself — tongues, a burning body,
 *  wisps tearing off, smoke — is fire.ts, shared with the BURN tick. */
import type { Graphics } from "pixi.js";
import { centre, rand } from "./base";
import {
  AMBER, EMBER, F_CORE, F_MID, F_OUT, ORANGE, PAL, RED, SCORCH, WHITE,
  pyroEmbers, pyroEnv, pyroFire, pyroFlame, pyroFlick, pyroLick, pyroTongue,
} from "./fire";
import type { ElementLook, FxTools, Pt, SparkStyle } from "./types";

/** Sparks flicked off a blow: fast streaks that curl upward. */
const FLICK: SparkStyle = { palette: [WHITE, AMBER, ORANGE], gravity: -480, drag: 0.3, size: [6, 1.5], streak: true };
/** Embers settling: they keep their velocity (drag 1, no gravity) so each
 *  lands on its point of a ring exactly as it dies, cooling on the way. */
const SETTLE: SparkStyle = { palette: [AMBER, ORANGE, RED], gravity: 0, drag: 1, size: [7, 3], streak: false };

// ── Drawing fire ─────────────────────────────────────────────────────────────

/** A point on the quadratic p0 -> p2 bowed through `c`, into `out`. */
function pyroQuad(p0: Pt, c: Pt, p2: Pt, s: number, out: Pt) {
  const a = (1 - s) * (1 - s), b = 2 * (1 - s) * s, d = s * s;
  out.x = a * p0.x + b * c.x + d * p2.x;
  out.y = a * p0.y + b * c.y + d * p2.y;
}

/** A blade-stroke along that curve: fat in the middle, tapered at both ends,
 *  heavier on the outside of the bow. Drawn to `upto` (0..1) as it sweeps. */
function pyroCrescent(g: Graphics, p0: Pt, c: Pt, p2: Pt, upto: number, th: number, color: number, alpha: number, tmp: Pt) {
  if (alpha <= 0.01 || upto <= 0.02) return;
  const N = 12;
  for (let pass = 0; pass < 2; pass++) {
    for (let j = 0; j <= N; j++) {
      const i = pass === 0 ? j : N - j;
      const s = (upto * i) / N;
      // Tangent from the derivative; the normal swings with the curve.
      const tx = 2 * (1 - s) * (c.x - p0.x) + 2 * s * (p2.x - c.x);
      const ty = 2 * (1 - s) * (c.y - p0.y) + 2 * s * (p2.y - c.y);
      const tl = Math.hypot(tx, ty) || 1;
      const w = th * Math.sin(Math.PI * s) * (pass === 0 ? 1 : -0.35);
      pyroQuad(p0, c, p2, s, tmp);
      const x = tmp.x - (ty / tl) * w, y = tmp.y + (tx / tl) * w;
      if (pass === 0 && j === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
  }
  g.closePath().fill({ color, alpha });
}

/** A ball of fire flown from `from` to `to`, arriving exactly `delay +
 *  seconds` in. `shot` carries its heat-glow and the embers it sheds (it owns
 *  the timing contract); the fire is drawn over it on the same clock and the
 *  same ease — a white-hot head WRAPPED in licking flame, tongues streaming
 *  behind (bent upward, longer the faster it goes), wisps tearing off the
 *  tail and a trail of smoke left hanging in the air. A Special's also leaves
 *  fire burning on the path it crossed. */
function pyroComet(t: FxTools, o: {
  from: Pt; to: Pt; delay: number; seconds: number;
  r: number; tongues: number; shed: number; trailRate: number; glow: number; wisps: number; smoke: number;
}) {
  const dx = o.to.x - o.from.x, dy = o.to.y - o.from.y;
  const dist = Math.hypot(dx, dy) || 1, ux = dx / dist, uy = dy / dist;
  t.shot({
    from: o.from, to: o.to, seconds: o.seconds, delay: o.delay, ease: "in",
    head: 0xff7a2a, headSize: o.r * o.glow,
    trail: { palette: PAL, rate: o.trailRate, size: [Math.max(5, o.r * 0.6), 2], life: [0.22, 0.5], drift: 18, gravity: -260 },
  });
  // The tail streams behind, but fire rises even in flight: bend it up.
  let tx = -ux, ty = -uy - 0.5;
  const tl = Math.hypot(tx, ty) || 1;
  tx /= tl; ty /= tl;
  const back = Math.atan2(ty, tx);
  const seed = rand(0, 100);
  const D = o.seconds + (o.shed ? 0.42 : 0);
  let head: Pt | null = null, tip: Pt | null = null;
  pyroFire(t, {
    seconds: D, delay: o.delay,
    body: (g, time) => {
      for (let j = 0; j < o.shed; j++) {
        // Each catches as the head passes (ease "in": the head is at f when
        // k = sqrt(f)), licks up off the path and lifts away.
        const f = ((j + 1) / (o.shed + 1)) * 0.85;
        const age = time - Math.sqrt(f) * o.seconds;
        const env = pyroEnv(age, 0.4, 0.05);
        if (env <= 0) continue;
        pyroLick(g, o.from.x + dx * f + (j % 2 ? 1 : -1) * o.r * 0.5, o.from.y + dy * f - age * 55,
          o.r * 2 * env, o.r * 1.15, time, seed + j * 3.3, env);
      }
      const k = time / o.seconds;
      if (k >= 1) { head = tip = null; return; } // landed: the element's burst takes it from here
      const e = k * k;
      const x = o.from.x + dx * e, y = o.from.y + dy * e;
      const speed = (2 * k * dist) / o.seconds;
      const fade = Math.min(1, k * 6);
      const len = o.r * (2.6 + Math.min(2.6, speed / 400));
      const mid = (o.tongues - 1) / 2;
      for (let i = 0; i < o.tongues; i++) {
        const off = (i - mid) * 0.4 + 0.14 * pyroFlick(time, seed + i * 5);
        const cs = Math.cos(off), sn = Math.sin(off);
        const vx = tx * cs - ty * sn, vy = tx * sn + ty * cs;
        const l = len * (i === mid ? 1.1 : 0.8) * (1 + 0.28 * pyroFlick(time * 1.3, seed + i * 2.3));
        pyroFlame(g, x + ux * o.r * 0.3, y + uy * o.r * 0.3, vx, vy, l, o.r * 1.8, o.r * 0.5 * pyroFlick(time * 1.7, seed + i), fade);
      }
      // Flame wrapping the head: short licks off its back half, each on its
      // own flicker — what makes it a ball of FIRE and not a glowing dot.
      for (let i = 0; i < 6; i++) {
        const a = back + (i - 2.5) * 0.55;
        const lx = Math.cos(a), ly = Math.sin(a);
        pyroFlame(g, x + lx * o.r * 0.45, y + ly * o.r * 0.45, lx, ly, o.r * (1.3 + 0.4 * pyroFlick(time * 1.4, seed + i * 3.3)),
          o.r * 0.95, o.r * 0.35 * pyroFlick(time, seed + i * 1.1), fade);
      }
      // Orange through, white only at the heart: a ball of fire, not a light.
      g.circle(x, y, o.r * 1.35).fill({ color: F_OUT, alpha: 0.3 * fade });
      g.circle(x, y, o.r).fill({ color: F_MID, alpha: 0.6 * fade });
      g.circle(x, y, o.r * 0.45).fill({ color: F_CORE, alpha: 0.85 * fade });
      head = { x, y };
      tip = { x: x + tx * len, y: y + ty * len };
    },
    wisp: () => (tip ? { x: tip.x + rand(-4, 4), y: tip.y + rand(-4, 4) } : null), wispRate: o.wisps, wispSize: o.r * 0.9,
    puff: () => (head ? { x: head.x + rand(-3, 3), y: head.y } : null), smokeRate: o.smoke, smokeSize: o.r * 0.75,
  });
}

// ── The look ─────────────────────────────────────────────────────────────────

export const PYRO: ElementLook = {
  markColor: 0xff8a3a,

  windUp(t, d) {
    // Flames lick up around the card as it gathers itself: a few low ones
    // for a basic throw, a U of them climbing its sides for a Special, and
    // barely a flicker for a basic swing, where the lunge is the wind-up.
    const dur = d.wind + (d.T - d.wind) * 0.3;
    const basicMelee = d.melee && !d.special;
    const s = d.size, r = d.rect, c = d.at;
    t.charge(c, s * (d.special ? 1.5 : basicMelee ? 0.7 : 1.0), ORANGE, d.special ? 0.6 : basicMelee ? 0.18 : 0.3, dur);
    const n = d.special ? 7 : basicMelee ? 2 : 3;
    const seed = rand(0, 100);
    pyroFire(t, {
      seconds: dur,
      wisp: basicMelee ? undefined : () => ({ x: r.x + r.w * rand(0.1, 0.9), y: r.y + r.h * rand(0.25, 0.6) }),
      wispRate: d.special ? 26 : 10, wispSize: s * 0.075,
      body: (g, time, kk) => {
      // A Special builds to the release; a basic flares and is already
      // dying as the shot leaves.
      const grow = d.special ? 0.35 + 0.65 * kk : Math.min(1, kk * 3) * (1 - 0.5 * Math.max(0, kk - 0.6) / 0.4);
      for (let i = 0; i < n; i++) {
        const f = i / (n - 1);
        // Round the lower half of the card: bottom edge, then up the sides.
        const th = Math.PI * (0.92 - 0.84 * f);
        const bx = c.x + Math.cos(th) * r.w * 0.44, by = c.y + Math.sin(th) * r.h * 0.44;
        const edge = Math.abs(f - 0.5) * 2;
        const h = s * (basicMelee ? 0.16 : d.special ? 0.5 - 0.14 * edge : 0.3) * grow;
        pyroLick(g, bx, by, h, s * (d.special ? 0.17 : 0.15), time, seed + i * 2.2, Math.min(1, kk * 4));
      }
    } });
    if (!basicMelee) pyroEmbers(t, { x: r.x + r.w * 0.1, y: r.y + r.h * 0.5, w: r.w * 0.8, h: r.h * 0.45 },
      d.special ? 16 : 5, [40, 120], [0.3, 0.6]);
  },

  gather(t, d) {
    // The square is still empty: fire kindles on its floor and draws its air
    // in — embers pulled in from round it, lifting as they come — building
    // until the strike comes out of it.
    const s = d.size;
    const floorY = d.at.y + s * 0.2;
    t.charge({ x: d.at.x, y: d.at.y + s * 0.08 }, s * (d.special ? 1.6 : 1.2), ORANGE, d.special ? 0.7 : 0.5, d.T);
    t.emit({ count: d.special ? 30 : 18, palette: [AMBER, ORANGE, RED], from: d.rect, at: "ring", speed: [90, 160],
      gravity: -110, drag: 1, life: [0.2, d.wind], size: [8, 2] });
    const seed = rand(0, 100);
    t.draw(d.T, (g, kk) => {
      const time = kk * d.T;
      for (let i = 0; i < 3; i++)
        pyroLick(g, d.at.x + (i - 1) * s * 0.17, floorY, s * (i === 1 ? 0.58 : 0.38) * (0.2 + 0.8 * kk), s * 0.2,
          time, seed + i * 3, Math.min(1, kk * 4));
    });
  },

  projectile(t, s) {
    // A fireball: a white-hot head with flame streaming off it and embers
    // rising from its wake. A Special is a bigger comet that leaves fire
    // burning along its path.
    pyroComet(t, {
      from: s.from, to: s.to, delay: s.delay, seconds: s.seconds,
      r: s.size * (s.special ? 0.18 : 0.12), tongues: s.special ? 4 : 3, shed: s.special ? 4 : 0,
      trailRate: s.special ? 120 : 65, glow: s.special ? 2.6 : 2.4, wisps: s.special ? 30 : 16, smoke: s.special ? 26 : 14,
    });
  },

  swing(t, s) {
    // The weapon trails fire along the lunge — a single wisp of it for a
    // basic swing (every turn), a streaming flame that leaves the path
    // alight for a Special or a pounce.
    const heavy = s.special || s.arriving;
    pyroComet(t, {
      from: s.from, to: s.to, delay: s.delay, seconds: s.seconds,
      r: s.size * (heavy ? 0.12 : 0.065), tongues: heavy ? 3 : 1, shed: heavy ? 3 : 0,
      trailRate: heavy ? 100 : 22, glow: heavy ? 2.4 : 2, wisps: heavy ? 18 : 0, smoke: heavy ? 10 : 0,
    });
  },

  mark(t, m) {
    // A FLAMING CLEAVE: one fat, white-hot crescent swept through the card
    // along the blow's follow-through, which cools as you watch (core first,
    // then the orange, the deep red last) while flames catch along the cut and
    // lick UP off it, embers rising, and a scorch is left where it ran.
    const R = m.reach, k = m.k;
    const ax = Math.cos(m.across), ay = Math.sin(m.across);
    let nx = -ay, ny = ax;
    if (nx * Math.cos(m.angle) + ny * Math.sin(m.angle) < 0) { nx = -nx; ny = -ny; }
    const p0 = { x: m.c.x - ax * R * 0.95, y: m.c.y - ay * R * 0.95 };
    const p2 = { x: m.c.x + ax * R * 0.95, y: m.c.y + ay * R * 0.95 };
    const cc = { x: m.c.x + nx * R * 0.5, y: m.c.y + ny * R * 0.5 };
    const th = R * 0.22;
    const tmp = { x: 0, y: 0 };
    const seed = rand(0, 100);
    const SWEEP = 0.07;
    const flames = 5;
    const along = (): Pt => { const p = { x: 0, y: 0 }; pyroQuad(p0, cc, p2, rand(0.1, 0.9), p); return p; };
    pyroFire(t, {
      seconds: 0.5,
      wisp: () => { const p = along(); p.y -= R * rand(0.15, 0.5); return p; }, wispRate: 34, wispSize: R * 0.16,
      puff: (kk) => (kk > 0.2 ? along() : null), smokeRate: 14, smokeSize: R * 0.2,
      body: (g, time) => {
      const upto = Math.min(1, time / SWEEP);
      const after = Math.max(0, time - SWEEP);
      pyroCrescent(g, p0, cc, p2, upto, th, F_OUT, 0.6 * Math.max(0, 1 - after / 0.33), tmp);
      pyroCrescent(g, p0, cc, p2, upto, th * 0.55, F_MID, 0.85 * Math.max(0, 1 - after / 0.2), tmp);
      pyroCrescent(g, p0, cc, p2, upto, th * 0.22, F_CORE, Math.max(0, 1 - after / 0.1), tmp);
      for (let i = 0; i < flames; i++) {
        const sAt = 0.14 + (0.72 * i) / (flames - 1);
        const age = time - (SWEEP * sAt + 0.02);
        const env = pyroEnv(age, 0.4, 0.07);
        if (env <= 0) continue;
        pyroQuad(p0, cc, p2, sAt, tmp);
        pyroLick(g, tmp.x, tmp.y - age * 30, R * (0.62 - 0.5 * Math.abs(sAt - 0.5)) * env, R * 0.3,
          time, seed + i * 2.6, Math.min(1, env * 1.4));
      }
    } });
    // The scorch it leaves, underneath: real darkness, gone as the embers go.
    t.draw(0.6, (g, kk) => {
      pyroCrescent(g, p0, cc, p2, 1, th * 0.8, SCORCH, 0.5 * Math.min(1, kk * 8) * Math.pow(1 - kk, 1.3), tmp);
    }, { dark: true });
    const n = Math.round(20 * k);
    for (let i = 0; i < n; i++) {
      pyroQuad(p0, cc, p2, rand(0.06, 0.94), tmp);
      t.spark(tmp.x, tmp.y, rand(-25, 25), -rand(50, 150), rand(0.35, 0.65), EMBER);
    }
    // Hot sparks flung on along the swing, curling up.
    const f = Math.round(9 * k);
    for (let i = 0; i < f; i++) {
      const a = m.angle + rand(-0.6, 0.6), v = rand(180, 380);
      t.spark(m.c.x, m.c.y, Math.cos(a) * v, Math.sin(a) * v, rand(0.15, 0.3), FLICK);
    }
    t.glow(m.rect, ORANGE, 0.32, 0.35, 1.0);
  },

  xSparks(t, c, count) {
    // Flicked out, then curling UP: sparks off a fire, not grit off a blade.
    for (let i = 0; i < count; i++) {
      const a = rand(0, Math.PI * 2), v = rand(70, 170);
      t.spark(c.x + rand(-3, 3), c.y + rand(-3, 3), Math.cos(a) * v, Math.sin(a) * v - 40, rand(0.18, 0.32), FLICK);
    }
  },

  arrive(t, r) {
    // Fire erupts from the ground up where it gathered: tongues shoot up off
    // the square's floor and fall back, embers thrown up with them, the
    // ground scorched under it.
    const s = Math.min(r.w, r.h), c = centre(r);
    const baseY = r.y + r.h * 0.86;
    const seed = rand(0, 100);
    pyroFire(t, {
      seconds: 0.6,
      wisp: (kk) => ({ x: c.x + rand(-0.4, 0.4) * r.w, y: baseY - s * rand(0.4, 0.95) * (1 - kk) }), wispRate: 40, wispSize: s * 0.1,
      puff: (kk) => (kk > 0.1 ? { x: c.x + rand(-0.35, 0.35) * r.w, y: baseY - s * 0.85 } : null), smokeRate: 16, smokeSize: s * 0.16,
      body: (g, time, kk) => {
      const env = kk < 0.16 ? 1 - (1 - kk / 0.16) * (1 - kk / 0.16) : Math.pow(1 - (kk - 0.16) / 0.84, 1.2);
      for (let i = 0; i < 5; i++) {
        const f = (i - 2) / 2;
        const h = s * (0.95 - 0.35 * Math.abs(f)) * env;
        const hh = h * (1 + 0.2 * pyroFlick(time, seed + i * 2.4));
        pyroFlame(g, c.x + f * r.w * 0.34, baseY, f * 0.28, -1, hh, s * 0.28, hh * 0.12 * pyroFlick(time, seed + i), Math.min(1, env * 1.3));
      }
    } });
    t.draw(0.8, (g, kk) => {
      g.ellipse(c.x, baseY, r.w * 0.44, r.h * 0.13).fill({ color: SCORCH, alpha: 0.45 * Math.min(1, kk * 6) * (1 - kk) });
    }, { dark: true });
    t.glow(r, ORANGE, 0.5, 0.45, 1.1);
    t.emit({ count: 34, palette: PAL, from: { x: r.x + r.w * 0.1, y: r.y, w: r.w * 0.8, h: r.h * 0.9 }, at: "bottom",
      dir: [-112, -68], speed: [140, 320], gravity: -80, drag: 0.35, life: [0.35, 0.7], size: [8, 2] });
  },

  impactAccent(t, at, k) {
    // The hit goes up in FIRE: a bloom of flame bursting out of the point and
    // lifting as it burns down — fire climbs, even out of an explosion — a
    // ball of it swelling and cooling at the heart, wisps torn off the tips
    // and smoke rolling up after. The standard burst under it is smaller for
    // PYRO (STYLES), so this, not a white flash, is what the eye gets.
    const R = 13 + 13 * k, n = 7, seed = rand(0, 100);
    const tips: Pt[] = [];
    pyroFire(t, {
      seconds: 0.6,
      body: (g, time, kk) => {
        const grow = kk < 0.18 ? 1 - Math.pow(1 - kk / 0.18, 2) : 1;
        const fade = kk < 0.3 ? 1 : 1 - (kk - 0.3) / 0.7;
        const lift = kk * R * 0.55;
        g.circle(at.x, at.y - lift, R * (0.5 + 0.5 * grow) * (1 - 0.35 * kk)).fill({ color: F_OUT, alpha: 0.32 * fade });
        g.circle(at.x, at.y - lift, R * 0.5 * (1 - kk)).fill({ color: F_CORE, alpha: 0.6 * fade });
        tips.length = 0;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2 + seed;
          let ux = Math.cos(a), uy = Math.sin(a) - 0.75;
          const l = Math.hypot(ux, uy) || 1;
          ux /= l; uy /= l;
          const len = R * (0.95 + 0.3 * Math.sin(seed + i * 2.3)) * grow * (1 - 0.45 * kk) * (1 + 0.22 * pyroFlick(time, seed + i));
          const bx = at.x + ux * R * 0.2, by = at.y - lift + uy * R * 0.2;
          pyroFlame(g, bx, by, ux, uy, len, R * 0.5, len * 0.2 * pyroFlick(time * 0.8, seed + i * 1.7), fade);
          tips.push({ x: bx + ux * len, y: by + uy * len });
        }
      },
      wisp: () => (tips.length ? tips[Math.floor(Math.random() * tips.length)] : null), wispRate: 22, wispSize: R * 0.35,
      puff: (kk) => (kk > 0.15 ? { x: at.x + rand(-R * 0.4, R * 0.4), y: at.y - R * 0.55 } : null), smokeRate: 12, smokeSize: R * 0.45,
    });
  },

  shield(t, r) {
    // A ring of fire around the card: flames catch from the bottom of the
    // ring and run up both sides, lick upward (never outward — fire does not
    // push, it climbs), hold, and sink back into the ring they stand on.
    const c = centre(r), s = Math.min(r.w, r.h);
    const rad = s * 0.6, n = 11;
    const seed = rand(0, 100);
    const D = 1.0;
    pyroFire(t, {
      seconds: D,
      wisp: (kk) => { const a = rand(0, Math.PI * 2); return { x: c.x + Math.cos(a) * rad, y: c.y + Math.sin(a) * rad - s * 0.2 * (1 - kk) }; },
      wispRate: 18, wispSize: s * 0.07,
      body: (g, time, kk) => {
      const out = kk < 0.62 ? 1 : Math.max(0, 1 - (kk - 0.62) / 0.38);
      const lit = Math.min(1, time / 0.1) * out;
      g.circle(c.x, c.y, rad).stroke({ width: 8, color: F_OUT, alpha: 0.3 * lit });
      g.circle(c.x, c.y, rad).stroke({ width: 2.5, color: F_MID, alpha: 0.8 * lit });
      for (let i = 0; i < n; i++) {
        const th = Math.PI / 2 + (i / n) * Math.PI * 2;
        // Distance round from the bottom of the ring, 0..1: where it catches last.
        const round = Math.abs(((i / n + 0.5) % 1) - 0.5) * 2;
        const grow = Math.min(1, Math.max(0, time - 0.02 - round * 0.16) / 0.1);
        if (grow <= 0) continue;
        const cs = Math.cos(th), sn = Math.sin(th);
        const ul = Math.hypot(cs * 0.35, 1);
        const back = sn < 0 ? 0.75 : 1; // the far side a touch lower
        const h = s * 0.28 * back * grow * (0.35 + 0.65 * out) * (1 + 0.25 * pyroFlick(time, seed + i * 1.9));
        pyroFlame(g, c.x + cs * rad, c.y + sn * rad, (cs * 0.35) / ul, -1 / ul, h, s * 0.16,
          h * 0.15 * pyroFlick(time * 0.8, seed + i), grow * out);
      }
    } });
    const ember = () => {
      for (let i = 0; i < 11; i++) {
        const a = rand(0, Math.PI * 2);
        t.spark(c.x + Math.cos(a) * rad, c.y + Math.sin(a) * rad, rand(-15, 15), -rand(40, 110), rand(0.45, 0.8), EMBER);
      }
    };
    ember();
    t.later(0.28, ember);
  },

  heal(t, r, k) {
    // A healing fire is the hearth, not the blaze: soft, slow, pale-gold
    // flames that lift off the card whole and float up and away, a warm glow
    // with life-green in it, and motes rising that cool to green, not red.
    const kk = Math.max(0.7, Math.min(2.2, k));
    const seed = rand(0, 100);
    const s = Math.min(r.w, r.h);
    t.draw(1.15, (g, q) => {
      const time = q * 1.15;
      for (let i = 0; i < 3; i++) {
        const age = time - i * 0.14;
        const env = pyroEnv(age, 0.85, 0.2);
        if (env <= 0) continue;
        const x = r.x + r.w * (0.3 + 0.2 * i) + Math.sin(age * 5 + i) * s * 0.03;
        const y = r.y + r.h * 0.84 - age * r.h * 0.55;
        // Lazy flicker (a quarter speed), two pale layers: warmth, not heat.
        const h = s * 0.3 * (0.6 + 0.4 * env) * (1 + 0.15 * pyroFlick(time * 0.25, seed + i));
        pyroTongue(g, x, y, 0, -1, h, s * 0.17, h * 0.1 * pyroFlick(time * 0.3, seed + i), 0xffc870, 0.4 * env);
        pyroTongue(g, x, y, 0, -1, h * 0.55, s * 0.09, 0, 0xfff6dc, 0.6 * env);
      }
    });
    t.glow(r, 0xffd98a, 0.3, 0.9, 1.1);
    t.glow(r, 0xb8f0a0, 0.2, 0.9, 0.9);
    t.emit({ count: Math.round(22 * kk), palette: [0xffffff, 0xfff0c0, 0xffd27a, 0xa8e890], from: r, at: "bottom",
      dir: [-100, -80], speed: [30, 90], gravity: -60, drag: 0.6, life: [0.8, 1.2], size: [9, 3] });
  },

  wall(t, r) {
    // A curtain of flame along the row: it whooshes up from the middle out,
    // an uneven line of tall tongues licking up off a bed of coals, holds,
    // and burns down (shorter, not just fainter).
    const n = Math.max(6, Math.round(r.w / 22));
    const seed = rand(0, 100);
    const baseY = r.y + r.h * 0.96;
    const D = 1.15;
    pyroFire(t, {
      seconds: D,
      wisp: (kk) => ({ x: r.x + r.w * rand(0.04, 0.96), y: baseY - r.h * rand(0.45, 0.85) * (kk < 0.6 ? 1 : 1.6 - kk) }),
      wispRate: r.w / 9, wispSize: r.h * 0.12,
      puff: () => ({ x: r.x + r.w * rand(0.04, 0.96), y: baseY - r.h * rand(0.8, 1.0) }), smokeRate: r.w / 26, smokeSize: r.h * 0.22,
      body: (g, time) => {
      const out = time < 0.7 ? 1 : Math.max(0, 1 - (time - 0.7) / 0.45);
      const lit = Math.min(1, time / 0.08) * out;
      g.rect(r.x, baseY - r.h * 0.12, r.w, r.h * 0.14).fill({ color: RED, alpha: 0.3 * lit });
      g.rect(r.x, baseY - 3, r.w, 4).fill({ color: F_MID, alpha: 0.75 * lit });
      for (let i = 0; i < n; i++) {
        const f = (i + 0.5) / n;
        const a = time - Math.abs(f - 0.5) * 0.3;
        if (a <= 0) continue;
        const grow = 1 - Math.pow(1 - Math.min(1, a / 0.14), 2);
        const tall = 0.62 + (0.38 * ((i * 7 + 3) % 5)) / 4; // uneven, but fixed
        pyroLick(g, r.x + r.w * f, baseY, r.h * 0.9 * tall * grow * (0.3 + 0.7 * out), (r.w / n) * 1.5,
          time, seed + i * 2.7, 0.55 + 0.45 * out);
      }
    } });
    t.emit({ count: Math.round(r.w / 4.5), palette: PAL, from: r, at: "bottom", dir: [-102, -78], speed: [120, 300],
      gravity: -110, drag: 0.4, life: [0.4, 0.85], size: [8, 2] });
    t.later(0.4, () => t.emit({ count: Math.round(r.w / 8), palette: PAL, from: r, at: "bottom", dir: [-105, -75],
      speed: [80, 200], gravity: -110, drag: 0.45, life: [0.4, 0.7], size: [7, 2] }));
  },

  field(t, r) {
    // The whole board turns HOT: heat welling up from below (brightest at
    // the bottom), heat-shimmer squiggles rising off it — the sign for heat
    // that reads even in grey — and embers and pale ash lifting everywhere.
    const seed = rand(0, 100);
    const sq = Array.from({ length: 8 }, (_, j) => ({
      x: r.x + (r.w * ((j % 4) + 0.5)) / 4 + rand(-0.08, 0.08) * r.w,
      y: r.y + r.h * (j < 4 ? 0.42 : 0.9) + rand(-0.06, 0.06) * r.h,
      at: (j * 0.13) % 0.4,
    }));
    const D = 1.3;
    t.draw(D, (g, kk) => {
      const time = kk * D;
      const env = kk < 0.15 ? kk / 0.15 : Math.max(0, 1 - (kk - 0.15) / 0.85);
      for (let i = 1; i <= 4; i++) {
        const h = (r.h * i) / 4;
        g.rect(r.x, r.y + r.h - h, r.w, h).fill({ color: RED, alpha: 0.055 * env });
      }
      g.rect(r.x, r.y + r.h - 4, r.w, 4).fill({ color: F_MID, alpha: 0.5 * env });
      for (let j = 0; j < sq.length; j++) {
        const q = sq[j];
        const a = time - q.at;
        if (a <= 0 || a >= 0.85) continue;
        const e = Math.sin((Math.PI * a) / 0.85);
        const y0 = q.y - a * 70, len = r.h * 0.16;
        g.moveTo(q.x + 4 * Math.sin(time * 9 + j + seed), y0);
        for (let p = 1; p <= 10; p++)
          g.lineTo(q.x + 4 * Math.sin(p * 1.3 + time * 9 + j + seed), y0 - (len * p) / 10);
        g.stroke({ width: 3, color: AMBER, alpha: 0.4 * e });
      }
    });
    const wave = (n: number) => {
      pyroEmbers(t, r, n, [30, 110], [0.5, 0.9], [7, 2]);
      t.emit({ count: Math.round(n * 0.3), palette: [0xe8dccf, 0x9a8c80, 0x5a4e48], from: r, dir: [-150, -30],
        speed: [15, 50], gravity: -40, drag: 0.6, life: [0.6, 0.95], size: [5, 3] });
    };
    wave(70);
    t.later(0.2, () => wave(60));
    t.later(0.4, () => wave(50));
  },

  move(t, from, to) {
    // It leaves a trail of fire: flames catch along the path as it goes and
    // burn down behind it, the ground singed under them, embers lifting where
    // it stood and flames catching round where it lands.
    const a = centre(from), b = centre(to);
    const s = Math.min(from.w, from.h);
    const dx = b.x - a.x, dy = b.y - a.y;
    const n = Math.max(3, Math.round(Math.hypot(dx, dy) / (s * 0.3)));
    const run = 0.3;
    const foot = s * 0.14;
    const seed = rand(0, 100);
    let acc = 0;
    t.draw(0.8, (g, kk, dt) => {
      const time = kk * 0.8;
      for (let i = 0; i < n; i++) {
        const f = (i + 0.5) / n;
        const age = time - run * (1 - Math.sqrt(1 - f)); // an easing-out front reaches f then
        const env = pyroEnv(age, 0.42, 0.06);
        if (env <= 0) continue;
        pyroLick(g, a.x + dx * f, a.y + dy * f + foot, s * 0.34 * env, s * 0.17, time, seed + i * 2.1, Math.min(1, env * 1.5));
      }
      if (time < run) {
        const fr = 1 - Math.pow(1 - time / run, 2);
        acc += 80 * dt;
        while (acc >= 1) {
          acc -= 1;
          t.spark(a.x + dx * fr + rand(-6, 6), a.y + dy * fr + foot, rand(-20, 20), -rand(60, 140), rand(0.3, 0.55), EMBER);
        }
      }
    });
    t.draw(0.8, (g, kk) => {
      const fr = 1 - Math.pow(1 - Math.min(1, (kk * 0.8) / run), 2);
      g.moveTo(a.x, a.y + foot).lineTo(a.x + dx * fr, a.y + dy * fr + foot)
        .stroke({ width: 7, color: SCORCH, alpha: 0.4 * (1 - kk) });
    }, { dark: true });
    pyroEmbers(t, from, 14, [50, 140], [0.35, 0.7], [8, 2]);
    t.later(run * 0.9, () => {
      t.emit({ count: 20, palette: PAL, from: to, at: "bottom", dir: [-125, -55], speed: [80, 200], gravity: -150,
        drag: 0.45, life: [0.35, 0.65], size: [8, 2] });
      t.glow(to, ORANGE, 0.35, 0.4, 1.0);
    });
  },

  trapSet(t, r) {
    // Embers settle out of the air and sink into the square, where they
    // gather into a smouldering ring: a dull red circle breathing with a few
    // low flames and a char at its heart, which banks down and hides.
    const c = centre(r), s = Math.min(r.w, r.h);
    const rad = s * 0.3;
    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * Math.PI * 2 + rand(-0.1, 0.1);
      const px = c.x + Math.cos(a) * rad, py = c.y + Math.sin(a) * rad;
      const sx = px + rand(-12, 12), sy = py - rand(35, 60), life = rand(0.3, 0.42);
      t.spark(sx, sy, (px - sx) / life, (py - sy) / life, life, SETTLE);
    }
    const seed = rand(0, 100);
    t.draw(0.9, (g, kk) => {
      const time = kk * 0.9;
      const env = kk < 0.1 ? kk / 0.1 : Math.max(0, 1 - (kk - 0.1) / 0.9);
      const breathe = 0.7 + 0.3 * Math.sin(time * 16);
      const rr = rad * (1 - 0.18 * kk);
      g.circle(c.x, c.y, rr).stroke({ width: 9, color: RED, alpha: 0.35 * env });
      g.circle(c.x, c.y, rr).stroke({ width: 3, color: ORANGE, alpha: 0.9 * env * breathe });
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + 0.3;
        pyroLick(g, c.x + Math.cos(a) * rr, c.y + Math.sin(a) * rr, s * 0.13 * env, s * 0.08, time, seed + i * 1.7, env);
      }
    }, { delay: 0.3 });
    t.draw(0.9, (g, kk) => {
      g.circle(c.x, c.y, rad * (1 - 0.18 * kk)).fill({ color: SCORCH, alpha: 0.4 * Math.min(1, kk * 8) * (1 - kk) });
    }, { delay: 0.3, dark: true });
  },

  pulse(t, r) {
    // A line of fire racing both ways from the middle of the row, flames
    // catching up behind each running front and burning down.
    const cx = r.x + r.w / 2, y = r.y + r.h * 0.62;
    const half = r.w / 2;
    const n = 10;
    const run = 0.28;
    const seed = rand(0, 100);
    let acc = 0;
    t.draw(0.85, (g, kk, dt) => {
      const time = kk * 0.85;
      const fr = 1 - Math.pow(1 - Math.min(1, time / run), 2);
      const fade = Math.max(0, 1 - Math.max(0, time - run) / 0.5);
      g.moveTo(cx - half * fr, y).lineTo(cx + half * fr, y).stroke({ width: 3, color: F_MID, alpha: 0.8 * fade });
      if (time < run) {
        g.circle(cx - half * fr, y, 6).fill({ color: F_CORE, alpha: 0.9 });
        g.circle(cx + half * fr, y, 6).fill({ color: F_CORE, alpha: 0.9 });
        acc += 150 * dt;
        while (acc >= 1) {
          acc -= 1;
          const side = Math.random() < 0.5 ? -1 : 1;
          t.spark(cx + side * half * fr, y, side * rand(20, 70), -rand(60, 150), rand(0.3, 0.55), EMBER);
        }
      }
      for (let i = 0; i < n; i++) {
        const f = (i + 0.5) / n;
        const d = Math.abs(f - 0.5) * 2;
        const age = time - run * (1 - Math.sqrt(1 - d));
        const env = pyroEnv(age, 0.45, 0.06);
        if (env <= 0) continue;
        pyroLick(g, r.x + r.w * f, y, r.h * 0.44 * env, (r.w / n) * 0.8, time, seed + i * 2.3, Math.min(1, env * 1.4));
      }
    });
    t.emit({ count: 16, palette: PAL, from: { x: cx - 10, y: y - 6, w: 20, h: 12 }, dir: [-140, -40], speed: [80, 200],
      gravity: -150, drag: 0.45, life: [0.3, 0.6], size: [8, 2] });
  },
};
