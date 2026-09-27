/** PYROGON — Flame Engulf. "Deal 7 DMG + BURN 2 to the 3 opponents directly
 *  ahead and the row behind them (2 rows deep)" — and it is the breath he
 *  lands with, too: "He arrives already burning."
 *
 *  The DELIVERY is the dragon drawing breath. Air and embers are pulled in
 *  from all round into his maw at the front edge of his square, heating as
 *  they come; the maw swells from a red glow to white heat while the fire he
 *  carries licks up his flanks and leans toward it. Arriving, the square he
 *  is dropping onto is already alight before he is on it.
 *
 *  The LANDING is the breath: a fan of fire out of the maw, flung wide at once
 *  and rolling on two rows deep over the block in front of him. It is drawn
 *  as flame tongues laid BACKWARD — each one's bulb out at the rolling front,
 *  its tail thinning back into the mouth — so it is narrow and white-hot at
 *  the maw, where every tail meets, and wide and billowing at its front. The
 *  ground it rolls over catches behind the front, and where the front reaches
 *  a card the card goes up: flame from its footing and up its sides. When it
 *  stops pouring, the breath dies where it lies. And he "grows on what he
 *  kills": the embers of anything the breath killed stream home into him.
 *
 *  The fan is fitted to the rules' reach (three wide, two deep), stretched to
 *  take in any card it hit outside that, so it covers every target however
 *  the board lies. Fire climbs: whatever burns in place leans UP the screen,
 *  as every PYRO flame does (looks/fire.ts). */
import { centre, rand } from "../looks/base";
import {
  AMBER, F_CORE, F_MID, F_OUT, ORANGE, RED, SCORCH, WHITE,
  pyroBody, pyroEmbers, pyroEnv, pyroFire, pyroFlick, pyroLick, pyroTongue,
} from "../looks/fire";
import type { FxTools, Pt, SparkStyle } from "../looks/types";
import type { Signature, SigMoment } from "./types";

type Box = { x: number; y: number; w: number; h: number };

const TAU = Math.PI * 2;
/** Air and sparks drawn into the maw, heating as they come. */
const INHALE: SparkStyle = { palette: [ORANGE, AMBER, WHITE], gravity: 0, drag: 1, size: [4, 7], streak: true };
/** What he takes back from a kill: embers streaming home to him. */
const FEED: SparkStyle = { palette: [ORANGE, AMBER, WHITE], gravity: 0, drag: 1, size: [6, 3], streak: true };
/** Sparks spat out of the maw with the breath. */
const SPIT: SparkStyle = { palette: [WHITE, AMBER, ORANGE, RED], gravity: -140, drag: 0.35, size: [6, 2], streak: true };
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeOut = (x: number) => 1 - (1 - x) * (1 - x);

/** The breath's timing: its front rolls out to the far edge in RUN seconds,
 *  and it pours for POUR before it leaves the mouth. */
const POUR = 0.3, RUN = 0.24;

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

/** One jet of the breath's fan: its heading out of the maw (`phi` off ahead),
 *  how far it reaches, and its own flicker. */
interface Jet { ux: number; uy: number; reach: number; lag: number; seed: number }

/** The fan: jets spread ±SPREAD off ahead, each reaching the edge of the
 *  breath's block — long down the middle, short out to the sides, where the
 *  cards beside the ones in front of him are. */
function fan(f: Frame, D: number, W: number, n: number): Jet[] {
  const SPREAD = 1.08;
  return Array.from({ length: n }, (_, j) => {
    const phi = ((j / (n - 1)) * 2 - 1) * SPREAD + rand(-0.05, 0.05);
    const c = Math.cos(phi), sn = Math.sin(phi);
    const reach = Math.min(D / c, W / Math.max(0.05, Math.abs(sn))) * rand(0.86, 0.98);
    return { ux: f.A.x * c + f.P.x * sn, uy: f.A.y * c + f.P.y * sn, reach, lag: rand(0, 0.035), seed: rand(0, 100) };
  });
}

export const PYROGON: Signature = {
  shake: 1.3,
  // He does not close on anything: he rears where he is and breathes.
  lunge: false,

  deliver(t: FxTools, m: SigMoment, seconds: number) {
    const f = frame(m), { s, maw, A } = f;
    const T = seconds, seed = rand(0, 100), r = m.from;
    // Heat building in his throat.
    t.charge(maw, s * 1.25, ORANGE, 0.55, T);
    t.charge(maw, s * 0.55, AMBER, 0.5, T);

    // The fire he carries: flames up his flanks, leaning toward the maw more
    // as he draws breath. Arriving, it is the square he drops onto that is
    // burning, a ring of it round the floor, before he is there.
    const n = m.arriving ? 9 : 6;
    pyroFire(t, {
      seconds: T,
      wisp: () => ({ x: r.x + r.w * rand(0.1, 0.9), y: r.y + r.h * rand(0.2, 0.6) }), wispRate: m.arriving ? 24 : 16,
      wispSize: s * 0.08,
      body: (g, time, k) => {
        const grow = 0.35 + 0.65 * k, lit = Math.min(1, k * 5);
        for (let i = 0; i < n; i++) {
          // Round the back and sides of the square, from one front corner to
          // the other the long way round.
          const th = Math.atan2(-A.y, -A.x) + (i / (n - 1) - 0.5) * Math.PI * 1.5;
          const bx = r.x + r.w / 2 + Math.cos(th) * r.w * 0.44, by = r.y + r.h / 2 + Math.sin(th) * r.h * 0.44;
          const h = s * (m.arriving ? 0.48 : 0.4) * grow * (0.75 + 0.25 * Math.sin(seed + i * 2.3));
          const lean = (maw.x - bx) * 0.35 * k;
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
      g.poly(slit(f, maw, s * (0.2 + 0.18 * k) * throb, s * (0.08 + 0.07 * k) * throb)).fill({ color: F_OUT, alpha: 0.4 + 0.3 * k });
      g.poly(slit(f, maw, s * (0.1 + 0.14 * k) * throb, s * (0.04 + 0.045 * k) * throb)).fill({ color: F_MID, alpha: 0.45 + 0.45 * k });
      g.poly(slit(f, maw, s * 0.13 * k * throb, s * 0.04 * k * throb)).fill({ color: F_CORE, alpha: 0.95 * k });
      for (const side of [-1, 1]) {
        const cx = maw.x + f.P.x * side * s * (0.22 + 0.12 * k), cy = maw.y + f.P.y * side * s * (0.22 + 0.12 * k);
        pyroLick(g, cx, cy, s * (0.12 + 0.16 * k), s * 0.1, time, seed + side * 5, 0.5 + 0.5 * k);
      }
    });

    // THE INHALE: air and embers pulled into the maw from in front and round
    // the sides, each timed to reach it as it dies — and licks of flame torn
    // off the air with them, streaming out behind as they are drawn in.
    let acc = 0, lick = 0;
    const face = Math.atan2(A.y, A.x);
    const licks: { x: number; y: number; born: number; life: number; seed: number }[] = [];
    t.draw(T, (g, u, dt) => {
      const time = u * T;
      if (u < 0.9) {
        acc += dt * 120 * t.quality;
        for (; acc >= 1; acc--) {
          const a = face + rand(-2.1, 2.1), R = s * rand(0.6, 1.4), life = rand(0.16, 0.3);
          const x = maw.x + Math.cos(a) * R, y = maw.y + Math.sin(a) * R;
          t.spark(x, y, (maw.x - x) / life, (maw.y - y) / life, life, INHALE);
        }
        lick += dt * 26 * Math.max(0.5, t.quality);
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
        const a = Math.min(1, q * 5) * (1 - q * 0.5);
        pyroTongue(g, x, y, dx / dl, dy / dl, sz * (2.4 + 2.4 * q), sz, sz * 0.5 * pyroFlick(time, w.seed), F_MID, 0.75 * a);
        pyroTongue(g, x, y, dx / dl, dy / dl, sz * 1.2, sz * 0.5, 0, F_CORE, 0.8 * a);
      }
    });
  },

  land(t: FxTools, m: SigMoment) {
    const f = frame(m), { s, maw, A } = f;
    const { D, W } = reachOf(m, f);
    const seed = rand(0, 100);
    // When the rolling front has got `d` deep (it runs out on an ease-out).
    const reached = (d: number) => RUN * (1 - Math.sqrt(1 - Math.min(0.999, Math.max(0, d) / D)));
    const hits = m.targets.map((r, i) => {
      const p = centre(r), dx = p.x - maw.x, dy = p.y - maw.y;
      return { r, p, d: dx * A.x + dy * A.y, power: m.power[i] ?? 1, killed: !!m.killed[i] };
    });

    // THE BREATH: a fan of flame. Each jet is a tongue drawn BACKWARD — its
    // bulb out at the rolling front, its tail thinning back to the mouth — so
    // where every tail meets, at the maw, the fire runs hottest, and out at
    // the front it billows wide. The body is kept thin (deep orange the cards
    // show through); the heat is in the billowing heads along the front and
    // in the white core of the stream, a short forward tongue out of the
    // mouth. Once the front is out the body thins further, and once it stops
    // pouring the breath dies where it lies, its heads lifting as they go.
    const jets = fan(f, D, W, 8);
    const DUR = POUR + 0.22;
    const fronts: Pt[] = [];
    pyroFire(t, {
      seconds: DUR,
      body: (g, time) => {
        fronts.length = 0;
        const out = clamp01((time - POUR) / 0.22), pour = 1 - out;
        const thin = 1 - 0.5 * clamp01((time - RUN) / 0.2);
        for (const j of jets) {
          const fr = easeOut(clamp01((time - j.lag) / RUN)) * (1 + 0.05 * pyroFlick(time * 0.7, j.seed));
          // Dying, each jet burns back from the mouth into its head, and the
          // head shrinks to nothing as it lifts. It goes by SHRINKING, still
          // bright: faded instead, a big orange shape passes through a dull
          // brown on the dark board.
          const len = j.reach * fr * (1 - out);
          if (len < 2) continue;
          const bx = maw.x + j.ux * j.reach * fr, by = maw.y + j.uy * j.reach * fr - out * s * 0.3;
          const w = (s * 0.18 + j.reach * fr * 0.28) * (1 - out);
          const lean = w * 0.4 * pyroFlick(time * 1.3, j.seed);
          const a = Math.min(1, time * 25) * (1 - out * out);
          pyroTongue(g, bx, by, -j.ux, -j.uy, len, w, lean, F_OUT, 0.3 * a * thin);
          pyroTongue(g, bx, by, -j.ux, -j.uy, Math.min(len, w * 1.7), w * 0.72, lean * 0.6, F_MID, 0.4 * a);
          pyroTongue(g, bx, by, -j.ux, -j.uy, Math.min(len, w * 0.8), w * 0.34, lean * 0.3, F_CORE, 0.32 * a * pour);
          fronts.push({ x: bx, y: by });
        }
        // The stream's white core, and the mouth spewing it — shrinking back
        // into the mouth as the breath stops.
        if (pour > 0) {
          const th = (1 + 0.15 * pyroFlick(time * 1.3, seed)) * pour;
          const grow = Math.min(1, time * 12);
          pyroTongue(g, maw.x, maw.y, A.x, A.y, s * 0.95 * th * grow, s * 0.4 * th, s * 0.1 * pyroFlick(time, seed + 1), F_MID, 0.45);
          pyroTongue(g, maw.x, maw.y, A.x, A.y, s * 0.62 * th * grow, s * 0.22 * th, 0, F_CORE, 0.75);
          g.poly(slit(f, maw, s * 0.3 * th, s * 0.13 * th)).fill({ color: F_MID, alpha: 0.65 });
          g.poly(slit(f, maw, s * 0.17 * th, s * 0.06 * th)).fill({ color: F_CORE, alpha: 0.95 });
        }
      },
      wisp: () => (fronts.length ? fronts[Math.floor(Math.random() * fronts.length)] : null), wispRate: 40, wispSize: s * 0.12,
      puff: (k) => (k > 0.3 && fronts.length ? fronts[Math.floor(Math.random() * fronts.length)] : null), smokeRate: 8,
      smokeSize: s * 0.2,
    });

    // The ground it rolled over burning: flames catching wherever the front
    // passes and standing up off it — fire climbs — then burning down.
    const spots = Array.from({ length: Math.round(16 * Math.max(0.5, t.quality)) }, () => {
      const d = D * rand(0.12, 0.95), l = rand(-0.9, 0.9) * Math.min(W, s * 0.2 + d * 1.8);
      return { p: at(f, d, l), at: reached(d) + rand(0, 0.06), seed: rand(0, 100), h: rand(0.3, 0.46) };
    });
    t.draw(RUN + 0.75, (g, u) => {
      const time = u * (RUN + 0.75);
      for (const q of spots) {
        const env = pyroEnv(time - q.at, 0.55, 0.06);
        if (env > 0) pyroLick(g, q.p.x, q.p.y + s * 0.15, s * q.h * env, s * 0.2, time, q.seed, Math.min(1, env * 1.3));
      }
    });

    // Sparks spat out with it, flying on ahead of the fire.
    let spit = 0;
    t.draw(POUR, (_g, _u, dt) => {
      spit += dt * 60 * t.quality;
      for (; spit >= 1; spit--) {
        const j = jets[Math.floor(Math.random() * jets.length)], v = rand(2.6, 4) * j.reach;
        t.spark(maw.x, maw.y, j.ux * v + rand(-30, 30), j.uy * v + rand(-30, 30), rand(0.2, 0.3), SPIT);
      }
    });
    t.flash(maw, AMBER, 0.9 * (s / 90));

    // Where the front reaches a card, the card goes up.
    for (const h of hits) t.later(Math.max(0, reached(h.d) - 0.02), () => engulf(t, h.r, h.power, s));
    // "He grows on what he kills": a kill's embers stream home into him.
    for (const h of hits) if (h.killed) t.later(reached(h.d) + 0.24, () => feed(t, h.p, m.from, s));
  },
};

/** A card going up in the breath: flame from its footing and up its sides,
 *  sized by what it took, wisps and smoke off the top, embers, and a scorch
 *  under it — the card's face left clear enough to read. */
function engulf(t: FxTools, r: Box, power: number, s: number) {
  const k = Math.max(0.7, Math.min(1.5, power));
  const c = centre(r), foot = r.y + r.h * 0.9, seed = rand(0, 100);
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
