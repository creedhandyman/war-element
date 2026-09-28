/** PRINCESS KHEIRINGER — Rain of Fire. "12 DMG to every opponent and BURN 3
 *  for 3 rounds." Both hands are up and open on her plate, and the sky is
 *  already alight. Lore: "She has never once walked to a fight. The fights
 *  are brought to her, and what is left of them is swept out in the morning."
 *
 *  The DELIVERY is the gesture: both hands raised, fire standing up in them
 *  and going up out of them — two jets of flame torn off and rising — and the
 *  sky over the enemy side catching: embers hanging in it, twinkling, and the
 *  ground below lit warm. The first drops are falling before it lands.
 *
 *  The LANDING is the downpour: fire RAIN over the whole enemy side — many
 *  small burning drops, thin streaks falling steep and all on one slant, each
 *  flicking up a little flame where it hits the ground — heaviest on the cards
 *  it was aimed at, and each of those catches: flame standing up off its
 *  footing and licking up its sides (the BURN), embers rising. Then the sky
 *  goes out.
 *
 *  It is Umbranova's opposite on purpose: the sky goes BRIGHT, not dark, and
 *  what falls out of it is a curtain of small drops, not a few rocks — no
 *  rock, no crater, just everything set alight at once. */
import type { Graphics } from "pixi.js";
import { centre, rand } from "../looks/base";
import {
  AMBER, EMBER, F_CORE, F_MID, F_OUT, ORANGE,
  pyroBody, pyroEmbers, pyroFire, pyroFlame, pyroFlick, pyroLick, pyroTongue,
} from "../looks/fire";
import type { FxTools } from "../looks/types";
import type { Signature, SigMoment } from "./types";

type Box = { x: number; y: number; w: number; h: number };

const easeOut = (x: number) => 1 - (1 - x) * (1 - x);

/** How high the drops fall from (in squares), their slant (across per down),
 *  and how long the downpour lasts after the landing frame. */
const HIGH = 1.3, SLANT = 0.2, POUR = 0.55;

/** The enemy side: the box round every card she hit, with room — or, hitting
 *  nothing, the half of the board ahead of her. */
function side(m: SigMoment): Box {
  const s = m.size, b = m.board;
  if (!m.targets.length) {
    const down = m.ahead.y >= 0;
    return { x: b.x, y: down ? b.y + b.h / 2 : b.y, w: b.w, h: b.h / 2 };
  }
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const r of m.targets) { x0 = Math.min(x0, r.x); y0 = Math.min(y0, r.y); x1 = Math.max(x1, r.x + r.w); y1 = Math.max(y1, r.y + r.h); }
  x0 = Math.max(b.x, x0 - s * 0.4); x1 = Math.min(b.x + b.w, x1 + s * 0.4);
  y0 = Math.max(b.y, y0 - s * 0.3); y1 = Math.min(b.y + b.h, y1 + s * 0.2);
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/** One drop of the rain: where it lands, when, how long it falls, how big. */
interface Drop { x: number; y: number; at: number; fall: number; size: number }

/** The rain in `seconds`: drops born by `born(time, dt)`, each streaking down
 *  its slant onto its point and flicking a little flame up where it lands. */
function rain(t: FxTools, s: number, seconds: number, born: (time: number, dt: number, out: Drop[]) => void, delay = 0) {
  const drops: Drop[] = [];
  t.draw(seconds, (g, u, dt) => {
    const time = u * seconds;
    born(time, dt, drops);
    for (let i = drops.length - 1; i >= 0; i--) {
      const d = drops[i], age = time - (d.at - d.fall);
      if (age < 0) continue;
      const q = age / d.fall;
      if (q >= 1.8) { drops.splice(i, 1); continue; }
      const H = HIGH * s;
      if (q < 1) {
        // A streak: bright head, a tail of flame up its slant.
        const hx = d.x - SLANT * H * (1 - q), hy = d.y - H * (1 - q);
        const len = s * 0.34 * d.size, l = Math.hypot(SLANT, 1);
        const tx = hx - (SLANT / l) * len, ty = hy - (1 / l) * len;
        g.moveTo(tx, ty).lineTo(hx, hy).stroke({ width: 3.2 * d.size, color: F_OUT, alpha: 0.5 });
        g.moveTo(tx + (hx - tx) * 0.45, ty + (hy - ty) * 0.45).lineTo(hx, hy).stroke({ width: 1.6 * d.size, color: AMBER, alpha: 0.9 });
        g.circle(hx, hy, 1.7 * d.size).fill({ color: F_CORE, alpha: 0.95 });
      } else {
        // Where it hits: a little flame flicking up, and gone.
        const e = (q - 1) / 0.8;
        const h = s * 0.16 * d.size * Math.sin(Math.PI * Math.min(1, e * 1.4));
        pyroTongue(g, d.x, d.y, 0, -1, h, s * 0.09 * d.size, h * 0.3 * Math.sin(d.x), F_MID, 0.75 * (1 - e));
        g.circle(d.x, d.y, s * 0.05 * d.size).fill({ color: F_OUT, alpha: 0.5 * (1 - e) });
      }
    }
  }, { delay });
}

/** A card the rain sets alight: a cluster of drops onto it, then flame
 *  standing up off its footing and licking up its sides — sized by the hit —
 *  embers going up off it and a glow on it. */
function alight(t: FxTools, r: Box, power: number, s: number) {
  const c = centre(r), k = Math.max(0.8, Math.min(1.6, power)), foot = r.y + r.h * 0.9, seed = rand(0, 100);
  t.flash(c, ORANGE, 0.6 * k * (s / 90));
  t.glow(r, ORANGE, 0.45 * k, 0.7, 1.05);
  pyroFire(t, {
    seconds: 0.85,
    wisp: () => ({ x: r.x + r.w * rand(0.15, 0.85), y: r.y + r.h * rand(0.2, 0.55) }), wispRate: 22 * k, wispSize: s * 0.09,
    puff: (kk) => (kk > 0.25 ? { x: c.x + rand(-0.3, 0.3) * r.w, y: r.y + r.h * 0.2 } : null), smokeRate: 5, smokeSize: s * 0.16,
    body: (g, time, kk) => {
      const env = kk < 0.12 ? easeOut(kk / 0.12) : Math.pow(1 - (kk - 0.12) / 0.88, 1.1);
      pyroBody(g, r.x + r.w * 0.08, r.x + r.w * 0.92, foot, s * 0.5 * k * env, Math.min(1, env * 1.4), time, seed, 1);
      for (let i = 0; i < 4; i++) {
        const side = i % 2 ? 1 : -1, hgt = i < 2 ? 0.6 : 0.34;
        pyroLick(g, c.x + side * r.w * 0.46, r.y + r.h * hgt, s * 0.3 * k * env, s * 0.14, time, seed + i * 2.7, Math.min(1, env * 1.2));
      }
    },
  });
  pyroEmbers(t, { x: r.x, y: r.y + r.h * 0.3, w: r.w, h: r.h * 0.6 }, Math.round(8 * k), [60, 160], [0.45, 0.85]);
}

export const KHEIRINGER: Signature = {
  shake: 1.6,

  deliver(t: FxTools, m: SigMoment, seconds: number) {
    const c = centre(m.from), s = m.size, T = seconds, zone = side(m);
    // THE GESTURE: both hands up, and fire goes up out of them — two jets of
    // flame tongues torn off and flying up, spreading as they rise, into the
    // sky. Fire, not rock: nothing here is a ball.
    const hands = [{ x: c.x - s * 0.26, y: c.y - s * 0.1 }, { x: c.x + s * 0.26, y: c.y - s * 0.1 }];
    const seed = rand(0, 100);
    const rising: { x: number; y: number; vx: number; age: number; life: number; size: number; seed: number }[] = [];
    let jet = 0, last = 0;
    pyroFire(t, {
      seconds: T,
      body: (g, time, k) => {
        const dt = Math.max(0, time - last);
        last = time;
        const grow = Math.min(1, k * 3);
        hands.forEach((h, j) => pyroLick(g, h.x, h.y + s * 0.12, s * 0.46 * grow, s * 0.2, time, seed + j * 4, grow));
        if (k < 0.8) {
          jet += dt * 56 * Math.max(0.5, t.quality);
          for (; jet >= 1; jet--) {
            const h = hands[Math.floor(Math.random() * 2)];
            rising.push({ x: h.x + rand(-0.05, 0.05) * s, y: h.y, vx: rand(-0.6, 0.6) * s, age: 0, life: rand(0.3, 0.42), size: s * rand(0.13, 0.19), seed: rand(0, 100) });
          }
        }
        for (const w of rising) {
          w.age += dt;
          const q = w.age / w.life;
          if (q >= 1) continue;
          w.x += w.vx * dt;
          w.y -= s * 1.7 * (1 - 0.5 * q) * dt;
          const sz = w.size * (1 - 0.6 * q);
          pyroFlame(g, w.x, w.y, 0, -1, sz * (2.6 - q), sz, sz * 0.4 * pyroFlick(time, w.seed), 1 - q * q);
        }
      },
      wisp: () => hands[Math.floor(Math.random() * 2)], wispRate: 24, wispSize: s * 0.09,
    });
    t.charge(c, s * 1.3, ORANGE, 0.5, T);
    for (let i = 0; i < 16; i++)
      t.later(rand(0, T * 0.7), () => {
        const h = hands[Math.floor(Math.random() * 2)];
        t.spark(h.x, h.y, rand(-40, 40), -rand(280, 420) * (s / 90), rand(0.35, 0.55), EMBER);
      });
    // THE SKY ALIGHT over the enemy side, catching as the fire goes up.
    const motes = sky(zone, s);
    t.draw(T * 0.65, (g, u) => overcast(g, zone, s, easeOut(u), u * T * 0.65, motes), { delay: T * 0.35 });
    // And the first drops, a drizzle before the downpour.
    let acc = 0;
    rain(t, s, T * 0.45 + 0.3, (time, dt, out) => {
      if (time > T * 0.45) return;
      acc += dt * 45 * t.quality;
      for (; acc >= 1; acc--)
        out.push({ x: zone.x + rand(0, zone.w), y: zone.y + rand(0, zone.h), at: time + rand(0.18, 0.24), fall: rand(0.18, 0.24), size: rand(0.6, 0.9) });
    }, T * 0.55);
  },

  land(t: FxTools, m: SigMoment) {
    const s = m.size, zone = side(m);
    // THE DOWNPOUR over the whole side, thickest on the cards she hit. Its
    // drops are spawned on a rate (landing where they please); the cards get
    // their own drops, aimed.
    let acc = 0;
    rain(t, s, POUR + 0.45, (time, dt, out) => {
      if (time > POUR) return;
      const rate = 300 * (time < POUR * 0.7 ? 1 : 1 - (time - POUR * 0.7) / (POUR * 0.3));
      acc += dt * rate * Math.max(0.5, t.quality);
      for (; acc >= 1; acc--) {
        const fall = rand(0.16, 0.22);
        out.push({ x: zone.x + rand(0, zone.w), y: zone.y + rand(0, zone.h), at: time + fall, fall, size: rand(0.7, 1.25) });
      }
    });
    // Every card she hit: a cluster of drops aimed onto it (falling from the
    // landing frame on), and it catches as they land.
    m.targets.forEach((r, i) => {
      const at = 0.17 + 0.1 * ((i * 0.618034) % 1);
      let aimed = false;
      rain(t, s, at + 0.5, (_time, _dt, out) => {
        if (aimed) return;
        aimed = true;
        for (let j = 0; j < 6; j++)
          out.push({ x: r.x + r.w * rand(0.15, 0.85), y: r.y + r.h * rand(0.35, 0.95), at: at + rand(0, 0.08), fall: 0.17, size: rand(0.9, 1.3) });
      });
      t.later(at, () => alight(t, r, m.power[i] ?? 1, s));
    });
    // The overcast burns out as the rain eases.
    const H = HIGH * s;
    const motes = sky(zone, s);
    t.draw(POUR + 0.2, (g, u) => overcast(g, zone, s, u < 0.55 ? 1 : 1 - (u - 0.55) / 0.45, u * (POUR + 0.2), motes));
    for (let i = 0; i < 12; i++)
      t.spark(zone.x + rand(0, zone.w), zone.y - H * rand(0.1, 0.5), rand(-20, 20), rand(10, 50), rand(0.4, 0.8), EMBER);
  },
};

/** The sky the rain falls out of, alight: embers hanging and twinkling where
 *  the drops start, over the whole enemy side, and that side lit warm from
 *  above. `a` 0..1; `motes` from `sky`. */
function overcast(g: Graphics, zone: Box, s: number, a: number, time: number, motes: Mote[]) {
  if (a <= 0.01) return;
  const H = HIGH * s;
  // Feathered: centred slabs in small steps, so the light has no edge.
  const mid = zone.y + zone.h * 0.2 - H * 0.3, hh = H * 0.5 + zone.h * 0.3;
  for (let i = 1; i <= 4; i++) g.rect(zone.x, mid - (hh * i) / 4, zone.w, (hh * 2 * i) / 4).fill({ color: F_OUT, alpha: 0.02 * a });
  for (const p of motes) {
    const tw = 0.5 + 0.5 * Math.sin(time * p.rate + p.ph);
    g.circle(p.x, p.y + Math.sin(time * 2 + p.ph) * s * 0.03, s * p.r * (0.6 + 0.4 * tw)).fill({ color: tw > 0.7 ? AMBER : ORANGE, alpha: (0.35 + 0.6 * tw) * a });
  }
}

interface Mote { x: number; y: number; r: number; ph: number; rate: number }

/** Where the burning sky's embers hang: a scatter over the band the drops
 *  fall from, thickest low. Dealt from the zone alone, not by chance, so the
 *  landing's sky has its embers exactly where the delivery's had them. */
function sky(zone: Box, s: number): Mote[] {
  const H = HIGH * s;
  const hash = (n: number) => { const x = Math.sin(n * 12.9898 + zone.x * 0.017 + zone.y * 0.031) * 43758.5453; return x - Math.floor(x); };
  return Array.from({ length: Math.round((zone.w / s) * 9) }, (_, i) => ({
    x: zone.x + hash(i) * zone.w, y: zone.y - H + H * 0.9 * Math.sqrt(hash(i + 0.25)) + hash(i + 0.5) * zone.h * 0.4,
    r: 0.018 + 0.016 * hash(i + 0.75), ph: hash(i + 0.125) * 6.283, rate: 8 + 8 * hash(i + 0.375),
  }));
}
