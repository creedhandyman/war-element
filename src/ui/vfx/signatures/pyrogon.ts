/** PYROGON — Flame Engulf. "Deal 7 DMG + BURN 2 to the 3 opponents directly
 *  ahead and the row behind them (2 rows deep)" — and it is the breath he
 *  lands with, too: "He arrives already burning."
 *
 *  The DELIVERY is the dragon drawing breath. The air round him turns into a
 *  whirl — embers spiralling in from all sides, heating from red to white as
 *  they close on his maw at the front edge of his square — and rings of heat
 *  pull in after them. The maw swells from a red glow to white heat while the
 *  fire he carries licks up his flanks and leans toward it. Arriving, the
 *  square he is dropping onto is already alight before he is on it.
 *
 *  The LANDING is the breath: a TORRENT, not a spray. Gouts of fire pour out
 *  of the maw in a stream, each one born white-hot and small, swelling and
 *  cooling through amber and orange to red as it slows — so the stream runs
 *  white where it leaves the mouth and piles up into billowing orange where it
 *  breaks over the block in front of him, three wide and two deep. Its light
 *  falls on the board under it. The ground catches behind the rolling front;
 *  where the front reaches a card, fire blooms off it and the card goes up,
 *  flame from its footing and up its sides. When it stops pouring, smoke curls
 *  out of his mouth and embers drift up off everything it touched. And he
 *  "grows on what he kills": the embers of anything the breath killed stream
 *  home into him.
 *
 *  It used to be drawn as a fan of flame tongues laid backward, bulbs out at
 *  the front — which read as a bouquet of orange balloons more than as fire.
 *  The stream is particles now (soft, additive: where the gouts crowd, at the
 *  mouth, they add up to white), and the drawn tongues are kept for what
 *  tongues are good at: fire standing UP off the ground and the cards, since
 *  fire climbs (looks/fire.ts).
 *
 *  The breath is fitted to the rules' reach (three wide, two deep), stretched
 *  to take in any card it hit outside that, so it covers every target however
 *  the board lies. */
import { centre, rand } from "../looks/base";
import {
  AMBER, F_CORE, F_MID, F_OUT, ORANGE, RED, SCORCH, WHITE,
  pyroBody, pyroEmbers, pyroEnv, pyroFire, pyroFlick, pyroLick, pyroTongue,
} from "../looks/fire";
import type { FxTools, Pt, SparkStyle } from "../looks/types";
import type { Signature, SigMoment } from "./types";

type Box = { x: number; y: number; w: number; h: number };

const TAU = Math.PI * 2;
/** What he takes back from a kill: embers streaming home to him. */
const FEED: SparkStyle = { palette: [ORANGE, AMBER, WHITE], gravity: 0, drag: 1, size: [6, 3], streak: true };
/** A gout's colour through its life, in even steps: white-hot only for the
 *  first eighth, then amber and orange, cooling to red. Where the gouts crowd
 *  — out of the mouth — additive light runs them to white anyway; a palette
 *  that STARTED white for longer drew the stream as a white cloud. */
const GOUT_PAL = [WHITE, AMBER, AMBER, ORANGE, ORANGE, ORANGE, RED, RED];
/** Sparks spat out of the maw with the breath, flying on ahead of it. */
const SPIT: SparkStyle = { palette: [WHITE, AMBER, ORANGE, RED], gravity: -140, drag: 0.35, size: [6, 2], streak: true };
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeOut = (x: number) => 1 - (1 - x) * (1 - x);

/** How long the breath pours out of the mouth, s. */
const POUR = 0.42;
/** How far off straight ahead the stream spreads, radians: enough to take in
 *  the cards beside the one in front of him (~58° off ahead from the maw). */
const SPREAD = 1.08;

// ── The torrent's gouts ──────────────────────────────────────────────────────
/** The fraction of its speed a gout keeps each second. Hard, so every gout
 *  slows as it goes and the stream piles up and billows at its front instead
 *  of streaking past it. */
const DRAG = 0.03;
const LN_DRAG = Math.log(DRAG);
/** A gout's life, s, and the share of it spent getting out to the front. */
const GOUT_LIFE: [number, number] = [0.36, 0.5];
const FRONT_AT = 0.55;
/** The speed that carries a gout `dist` px in `tau` s under DRAG:
 *  x(τ) = v (DRAG^τ − 1) / ln DRAG. */
const speedFor = (dist: number, tau: number) => (dist * LN_DRAG) / (Math.pow(DRAG, tau) - 1);
/** When the stream's front is `q` (0..1) of the way out: the same curve,
 *  inverted, for a gout of average life — the moment each card is reached. */
const TAU_FRONT = FRONT_AT * (GOUT_LIFE[0] + GOUT_LIFE[1]) / 2;
const frontAt = (q: number) => Math.log(1 + clamp01(q) * (Math.pow(DRAG, TAU_FRONT) - 1)) / LN_DRAG;

/** His frame: the maw at the front edge of his square, "ahead" and "across". */
function frame(m: SigMoment) {
  const c = centre(m.from), s = m.size;
  const A = m.ahead, P = { x: -m.ahead.y, y: m.ahead.x };
  const maw = { x: c.x + A.x * s * 0.42, y: c.y + A.y * s * 0.42 };
  return { c, s, A, P, maw };
}
type Frame = ReturnType<typeof frame>;

/** A point `d` ahead of the maw and `l` across. */
const at = (f: Frame, d: number, l: number): Pt => ({ x: f.maw.x + f.A.x * d + f.P.x * l, y: f.maw.y + f.A.y * d + f.P.y * l });

/** How far the breath reaches: depth `D` out of the maw and half-width `W` —
 *  the block three wide and two deep in front of him, stretched to take in
 *  any card it hit outside that. */
function reachOf(m: SigMoment, f: Frame) {
  const pitch = f.s * 1.08; // a square and the gap to the next
  let D = pitch * 2 - f.s * 0.42 + f.s * 0.5, W = pitch + f.s * 0.5;
  for (const r of m.targets) {
    const p = centre(r), dx = p.x - f.maw.x, dy = p.y - f.maw.y;
    D = Math.max(D, dx * f.A.x + dy * f.A.y + f.s * 0.5);
    W = Math.max(W, Math.abs(dx * f.P.x + dy * f.P.y) + f.s * 0.5);
  }
  return { D, W };
}

/** How far a heading `phi` off ahead reaches before it leaves the block. */
const reachAlong = (D: number, W: number, phi: number) =>
  Math.min(D / Math.cos(phi), W / Math.max(0.05, Math.abs(Math.sin(phi))));

/** The screen box round the block the breath covers. */
function blockBox(f: Frame, D: number, W: number): Box {
  const pts = [at(f, 0, -W), at(f, 0, W), at(f, D, -W), at(f, D, W)];
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  const x = Math.min(...xs), y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

/** An ellipse `rx` across and `ry` along `ahead`, as points (the maw is a
 *  slit across his front, whichever way he faces). */
function slit(f: Frame, c: Pt, rx: number, ry: number): number[] {
  const pts: number[] = [];
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * TAU, u = Math.cos(a) * rx, v = Math.sin(a) * ry;
    pts.push(c.x + f.P.x * u + f.A.x * v, c.y + f.P.y * u + f.A.y * v);
  }
  return pts;
}

/** A heading for one gout: most spread evenly over the fan, the rest crowded
 *  toward straight ahead, so the stream has a spine and still reaches the
 *  cards out to the sides. */
const heading = () => SPREAD * (Math.random() < 0.55 ? rand(-1, 1) : (rand(-1, 1) + rand(-1, 1)) * 0.5);

export const PYROGON: Signature = {
  shake: 1.5,
  // He does not close on anything: he rears where he is and breathes.
  lunge: false,

  deliver(t: FxTools, m: SigMoment, seconds: number) {
    const f = frame(m), { s, maw, A } = f;
    const T = seconds, seed = rand(0, 100), r = m.from;
    // Heat building in his throat: a wide red-orange halo, the fire, and a
    // white core that only really comes in at the end.
    t.charge(maw, s * 1.6, ORANGE, 0.5, T);
    t.charge(maw, s * 0.7, AMBER, 0.55, T);
    t.charge(maw, s * 0.42, WHITE, 0.7, T);

    // The fire he carries: flames up his flanks, leaning toward the maw more
    // as he draws breath. Arriving, it is the square he drops onto that is
    // burning, a ring of it round the floor, before he is there.
    const n = m.arriving ? 9 : 7;
    pyroFire(t, {
      seconds: T,
      wisp: () => ({ x: r.x + r.w * rand(0.1, 0.9), y: r.y + r.h * rand(0.2, 0.6) }), wispRate: m.arriving ? 24 : 18,
      wispSize: s * 0.08,
      body: (g, time, k) => {
        const grow = 0.35 + 0.75 * k, lit = Math.min(1, k * 5);
        for (let i = 0; i < n; i++) {
          // Round the back and sides of the square, from one front corner to
          // the other the long way round.
          const th = Math.atan2(-A.y, -A.x) + (i / (n - 1) - 0.5) * Math.PI * 1.5;
          const bx = r.x + r.w / 2 + Math.cos(th) * r.w * 0.44, by = r.y + r.h / 2 + Math.sin(th) * r.h * 0.44;
          const h = s * (m.arriving ? 0.5 : 0.44) * grow * (0.75 + 0.25 * Math.sin(seed + i * 2.3));
          const lean = (maw.x - bx) * 0.4 * k;
          const hh = h * (1 + 0.24 * pyroFlick(time, seed + i * 1.9));
          pyroTongue(g, bx, by, 0, -1, hh, s * 0.19, lean + hh * 0.15 * pyroFlick(time * 0.8, seed + i), F_OUT, 0.46 * lit);
          pyroTongue(g, bx, by, 0, -1, hh * 0.72, s * 0.125, lean * 0.8, F_MID, 0.6 * lit);
          pyroTongue(g, bx, by, 0, -1, hh * 0.42, s * 0.07, lean * 0.45, F_CORE, 0.8 * lit);
        }
      },
    });

    // THE MAW: a slit of heat across his front, red to white as it fills,
    // fire already leaking from its corners.
    t.draw(T, (g, u) => {
      const time = u * T, k = easeOut(u);
      const throb = 1 + 0.12 * pyroFlick(time * 1.4, seed);
      g.poly(slit(f, maw, s * (0.2 + 0.2 * k) * throb, s * (0.08 + 0.08 * k) * throb)).fill({ color: F_OUT, alpha: 0.4 + 0.3 * k });
      g.poly(slit(f, maw, s * (0.1 + 0.16 * k) * throb, s * (0.04 + 0.05 * k) * throb)).fill({ color: F_MID, alpha: 0.45 + 0.45 * k });
      g.poly(slit(f, maw, s * 0.15 * k * throb, s * 0.045 * k * throb)).fill({ color: F_CORE, alpha: 0.95 * k });
      for (const side of [-1, 1]) {
        const cx = maw.x + f.P.x * side * s * (0.22 + 0.14 * k), cy = maw.y + f.P.y * side * s * (0.22 + 0.14 * k);
        pyroLick(g, cx, cy, s * (0.12 + 0.18 * k), s * 0.1, time, seed + side * 5, 0.5 + 0.5 * k);
      }
    });

    // THE WHIRL: embers spiralling in on the maw from all round him — a log
    // spiral each, winding faster as it closes — red where they are caught
    // up, white by the time they are swallowed. One way round for the whole
    // breath, so it reads as one draught of air and not as noise.
    const turn = Math.random() < 0.5 ? -1 : 1;
    const motes: { a: number; R: number; born: number; life: number; spin: number; w: number }[] = [];
    let macc = 0;
    const spiral = (p: (typeof motes)[number], q: number): Pt => {
      const rr = p.R * Math.pow(1 - q, 1.5), aa = p.a + p.spin * q;
      return { x: maw.x + Math.cos(aa) * rr, y: maw.y + Math.sin(aa) * rr };
    };
    t.draw(T, (g, u, dt) => {
      const time = u * T;
      if (u < 0.86) {
        macc += dt * 110 * t.quality;
        for (; macc >= 1; macc--)
          motes.push({ a: rand(0, TAU), R: s * rand(0.7, 1.75), born: time, life: rand(0.2, 0.3), spin: turn * rand(2.4, 3.6), w: rand(1.3, 2.4) });
      }
      for (let i = motes.length - 1; i >= 0; i--) {
        const p = motes[i], q = (time - p.born) / p.life;
        if (q >= 1) { motes.splice(i, 1); continue; }
        if (q <= 0) continue;
        const a = Math.min(1, q * 4);
        const color = q < 0.4 ? RED : q < 0.75 ? ORANGE : q < 0.9 ? AMBER : WHITE;
        // A short tail behind it along the same spiral.
        const pts: number[] = [];
        for (let k = 0; k <= 4; k++) {
          const pt = spiral(p, Math.max(0, q - 0.2 + k * 0.05));
          pts.push(pt.x, pt.y);
        }
        g.poly(pts, false).stroke({ width: p.w * 3, color: ORANGE, alpha: 0.2 * a });
        g.poly(pts, false).stroke({ width: p.w, color, alpha: 0.9 * a });
      }
    });

    // Licks of flame torn off the air as it is drawn in, streaming out behind
    // as they go.
    let lick = 0;
    const face = Math.atan2(A.y, A.x);
    const licks: { x: number; y: number; born: number; life: number; seed: number }[] = [];
    t.draw(T, (g, u, dt) => {
      const time = u * T;
      if (u < 0.9) {
        lick += dt * 22 * Math.max(0.5, t.quality);
        for (; lick >= 1; lick--) {
          const a = face + rand(-1.9, 1.9), R = s * rand(0.8, 1.4);
          licks.push({ x: maw.x + Math.cos(a) * R, y: maw.y + Math.sin(a) * R, born: time, life: rand(0.2, 0.28), seed: rand(0, 100) });
        }
      }
      for (const w of licks) {
        const q = (time - w.born) / w.life;
        if (q < 0 || q >= 1) continue;
        const e = q * q; // accelerating in
        const x = w.x + (maw.x - w.x) * e, y = w.y + (maw.y - w.y) * e;
        const dx = w.x - maw.x, dy = w.y - maw.y, dl = Math.hypot(dx, dy) || 1;
        const sz = s * 0.13 * (1 - 0.5 * q);
        const al = Math.min(1, q * 5) * (1 - q * 0.5);
        pyroTongue(g, x, y, dx / dl, dy / dl, sz * (2.4 + 2.4 * q), sz, sz * 0.5 * pyroFlick(time, w.seed), F_MID, 0.75 * al);
        pyroTongue(g, x, y, dx / dl, dy / dl, sz * 1.2, sz * 0.5, 0, F_CORE, 0.8 * al);
      }
    });

    // Rings of heat pulled in after the air: the breath is nearly drawn.
    const mawBox = { x: maw.x - s / 2, y: maw.y - s / 2, w: s, h: s };
    t.later(T * 0.45, () => t.ring(mawBox, ORANGE, 2.3, 0.35, T * 0.35, 1.5));
    t.later(T * 0.72, () => t.ring(mawBox, AMBER, 1.7, 0.25, T * 0.26, 1.2));
  },

  land(t: FxTools, m: SigMoment) {
    const f = frame(m), { s, maw, A } = f;
    const { D, W } = reachOf(m, f);
    const seed = rand(0, 100);
    // When the rolling front has got `d` deep.
    const reached = (d: number) => frontAt(Math.max(0, d) / D);
    const hits = m.targets.map((r, i) => {
      const p = centre(r), dx = p.x - maw.x, dy = p.y - maw.y;
      return { r, p, d: dx * A.x + dy * A.y, power: m.power[i] ?? 1, killed: !!m.killed[i] };
    });

    // The breath leaving his mouth, and its light falling on the board it
    // pours over.
    t.flash(maw, WHITE, 0.9 * (s / 90));
    t.flash(maw, AMBER, 0.8 * (s / 90), 0.04);
    const box = blockBox(f, D, W);
    t.glow(box, ORANGE, 0.34, POUR + 0.55, 1.15);
    t.glow({ x: maw.x - s, y: maw.y - s, w: s * 2, h: s * 2 }, AMBER, 0.3, POUR + 0.2, 1.1);

    // THE TORRENT: gouts poured out of the maw for POUR, each born small and
    // white-hot, swelling and cooling as DRAG slows it, timed to be out at the
    // edge of the block when it has lived FRONT_AT of its life. Additive, so
    // where the stream runs thick — out of the mouth — they add up to white.
    const gout: SparkStyle = { palette: GOUT_PAL, gravity: -120, drag: DRAG, size: [s * 0.16, s * 0.8], streak: false };
    let acc = 0;
    t.draw(POUR, (_g, u, dt) => {
      // Thinning as it stops, so the breath tails off rather than cutting out.
      acc += dt * 250 * t.quality * (1 - 0.75 * u * u);
      for (; acc >= 1; acc--) {
        const phi = heading(), c = Math.cos(phi), sn = Math.sin(phi);
        const ux = f.A.x * c + f.P.x * sn, uy = f.A.y * c + f.P.y * sn;
        const life = rand(GOUT_LIFE[0], GOUT_LIFE[1]);
        const v = speedFor(reachAlong(D, W, phi) * rand(0.78, 1), life * FRONT_AT);
        const l = rand(-0.08, 0.08) * s;
        t.spark(maw.x + ux * s * 0.1 + f.P.x * l, maw.y + uy * s * 0.1 + f.P.y * l, ux * v, uy * v, life, gout);
      }
    });

    // THE JETS: long flame tongues shooting out of the mouth along the fan,
    // hot at the mouth and licking out to their tips — what gives the stream
    // its direction, where the gouts give it its bulk. Each has its own
    // flicker and dies back into the mouth as the breath stops.
    const jets = Array.from({ length: 5 }, (_, j) => {
      const phi = (j / 4 - 0.5) * SPREAD * 1.1 + rand(-0.06, 0.06);
      return { phi, reach: reachAlong(D, W, phi) * rand(0.6, 0.78), seed: rand(0, 100), lag: rand(0, 0.04) };
    });
    // The stream's white core, and the mouth spewing it — shrinking back into
    // the mouth as the breath stops.
    const DUR = POUR + 0.18;
    pyroFire(t, {
      seconds: DUR,
      body: (g, time) => {
        const pour = 1 - clamp01((time - POUR) / 0.18);
        if (pour <= 0) return;
        for (const j of jets) {
          const out = easeOut(clamp01((time - j.lag) / 0.14));
          const len = j.reach * out * pour * (1 + 0.08 * pyroFlick(time, j.seed));
          const c = Math.cos(j.phi + 0.05 * pyroFlick(time * 0.6, j.seed + 3)), sn = Math.sin(j.phi + 0.05 * pyroFlick(time * 0.6, j.seed + 3));
          const ux = A.x * c + f.P.x * sn, uy = A.y * c + f.P.y * sn;
          const w = s * 0.34 * pour, lean = w * 0.5 * pyroFlick(time * 1.2, j.seed);
          pyroTongue(g, maw.x, maw.y, ux, uy, len, w, lean, F_OUT, 0.34);
          pyroTongue(g, maw.x, maw.y, ux, uy, len * 0.74, w * 0.62, lean * 0.7, F_MID, 0.42);
          pyroTongue(g, maw.x, maw.y, ux, uy, len * 0.42, w * 0.3, lean * 0.35, F_CORE, 0.5);
        }
        const th = (1 + 0.15 * pyroFlick(time * 1.3, seed)) * pour;
        const grow = Math.min(1, time * 12);
        pyroTongue(g, maw.x, maw.y, A.x, A.y, s * 1.05 * th * grow, s * 0.42 * th, s * 0.1 * pyroFlick(time, seed + 1), F_MID, 0.45);
        pyroTongue(g, maw.x, maw.y, A.x, A.y, s * 0.7 * th * grow, s * 0.24 * th, 0, F_CORE, 0.8);
        g.poly(slit(f, maw, s * 0.32 * th, s * 0.14 * th)).fill({ color: F_MID, alpha: 0.65 });
        g.poly(slit(f, maw, s * 0.18 * th, s * 0.065 * th)).fill({ color: F_CORE, alpha: 0.95 });
      },
      // Wisps tearing off the stream, all along it.
      wisp: (k) => (k < 0.9 ? at(f, D * rand(0.2, 0.9), rand(-0.6, 0.6) * W) : null), wispRate: 34, wispSize: s * 0.12,
    });

    // The ground it rolls over catching: flames standing up off it wherever
    // the front passes — fire climbs — then burning down.
    const spots = Array.from({ length: Math.round(22 * Math.max(0.5, t.quality)) }, () => {
      const d = D * rand(0.1, 0.96), l = rand(-0.92, 0.92) * Math.min(W, s * 0.25 + d * 1.8);
      return { p: at(f, d, l), at: reached(d) + rand(0, 0.07), seed: rand(0, 100), h: rand(0.32, 0.52) };
    });
    t.draw(TAU_FRONT + 0.8, (g, u) => {
      const time = u * (TAU_FRONT + 0.8);
      for (const q of spots) {
        const env = pyroEnv(time - q.at, 0.6, 0.06);
        if (env > 0) pyroLick(g, q.p.x, q.p.y + s * 0.15, s * q.h * env, s * 0.2, time, q.seed, Math.min(1, env * 1.3));
      }
    });

    // Sparks spat out with it, flying on ahead of the fire.
    let spit = 0;
    t.draw(POUR, (_g, _u, dt) => {
      spit += dt * 55 * t.quality;
      for (; spit >= 1; spit--) {
        const phi = heading(), c = Math.cos(phi), sn = Math.sin(phi);
        const ux = f.A.x * c + f.P.x * sn, uy = f.A.y * c + f.P.y * sn;
        const v = rand(2.6, 4) * reachAlong(D, W, phi);
        t.spark(maw.x, maw.y, ux * v + rand(-30, 30), uy * v + rand(-30, 30), rand(0.2, 0.3), SPIT);
      }
    });

    // Where the front reaches a card, fire blooms off it and the card goes up.
    for (const h of hits) t.later(Math.max(0, reached(h.d) - 0.02), () => engulf(t, h.r, h.power, s));
    // "He grows on what he kills": a kill's embers stream home into him.
    for (const h of hits) if (h.killed) t.later(reached(h.d) + 0.24, () => feed(t, h.p, m.from, s));

    // When it stops pouring: smoke curling out of his mouth, and embers
    // drifting up off everything the breath touched.
    pyroFire(t, {
      seconds: 0.4, delay: POUR - 0.05,
      body: () => {},
      puff: () => ({ x: maw.x + rand(-0.12, 0.12) * s, y: maw.y - s * 0.05 }), smokeRate: 16, smokeSize: s * 0.13,
    });
    t.later(POUR * 0.8, () => pyroEmbers(t, box, 28, [40, 140], [0.55, 1.0]));
  },
};

/** A card going up in the breath: fire blooming off it as the front breaks
 *  over it, then flame from its footing and up its sides, sized by what it
 *  took, wisps and smoke off the top, embers, and a scorch under it — the
 *  card's face left clear enough to read. */
function engulf(t: FxTools, r: Box, power: number, s: number) {
  const k = Math.max(0.7, Math.min(1.5, power));
  const c = centre(r), foot = r.y + r.h * 0.9, seed = rand(0, 100);
  // The bloom: the stream's own gouts thrown off the card as it hits.
  t.emit({
    count: Math.round(8 * k), palette: [AMBER, ORANGE, ORANGE, RED], from: { x: c.x - s * 0.15, y: c.y - s * 0.15, w: s * 0.3, h: s * 0.3 },
    speed: [50, 150], gravity: -220, drag: 0.15, life: [0.24, 0.4], size: [s * 0.22, s * 0.5],
  });
  const D = 0.62;
  pyroFire(t, {
    seconds: D,
    wisp: () => ({ x: r.x + r.w * rand(0.15, 0.85), y: r.y + r.h * rand(0.15, 0.45) }), wispRate: 26 * k, wispSize: s * 0.09,
    puff: (kk) => (kk > 0.2 ? { x: c.x + rand(-0.3, 0.3) * r.w, y: r.y + r.h * 0.15 } : null), smokeRate: 6, smokeSize: s * 0.17,
    body: (g, time, kk) => {
      const env = kk < 0.14 ? easeOut(kk / 0.14) : Math.pow(1 - (kk - 0.14) / 0.86, 1.15);
      pyroBody(g, r.x + r.w * 0.06, r.x + r.w * 0.94, foot, s * 0.62 * k * env, Math.min(1, env * 1.4), time, seed, 1.1);
      // Up its sides, lower and later than the foot.
      for (let i = 0; i < 4; i++) {
        const side = i % 2 ? 1 : -1, hgt = i < 2 ? 0.62 : 0.36;
        const x = c.x + side * r.w * 0.47, y = r.y + r.h * hgt;
        pyroLick(g, x, y, s * 0.34 * k * env, s * 0.15, time, seed + i * 2.9, Math.min(1, env * 1.2));
      }
    },
  });
  t.draw(0.8, (g, u) => {
    g.ellipse(c.x, foot, r.w * 0.46, r.h * 0.12).fill({ color: SCORCH, alpha: 0.45 * Math.min(1, u * 6) * (1 - u) });
  }, { dark: true });
  t.glow(r, ORANGE, 0.42 * k, 0.6, 1.05);
  t.flash(c, AMBER, 0.55 * k * (s / 90));
  pyroEmbers(t, { x: r.x, y: r.y + r.h * 0.3, w: r.w, h: r.h * 0.6 }, Math.round(12 * k), [60, 170], [0.4, 0.8]);
}

/** A kill's embers pulled home into him, and the fire in him flaring as they
 *  land: he grows on what he kills. */
function feed(t: FxTools, from: Pt, home: Box, s: number) {
  const c = centre(home);
  const n = Math.round(14 * Math.max(0.5, t.quality));
  for (let i = 0; i < n; i++) {
    const life = rand(0.34, 0.46);
    const x = from.x + rand(-0.3, 0.3) * s, y = from.y + rand(-0.3, 0.3) * s;
    t.later(rand(0, 0.12), () => t.spark(x, y, (c.x - x) / life, (c.y - y) / life, life, FEED));
  }
  t.later(0.46, () => {
    t.glow(home, ORANGE, 0.5, 0.45, 1.1);
    pyroEmbers(t, home, 14, [70, 170], [0.35, 0.6]);
    const seed = rand(0, 100);
    t.draw(0.4, (g, u) => {
      const env = u < 0.2 ? u / 0.2 : 1 - (u - 0.2) / 0.8;
      for (let i = 0; i < 3; i++)
        pyroLick(g, c.x + (i - 1) * s * 0.26, home.y + home.h * 0.85, s * (i === 1 ? 0.62 : 0.42) * env, s * 0.2, u * 0.4, seed + i * 3, env);
    });
  });
}
