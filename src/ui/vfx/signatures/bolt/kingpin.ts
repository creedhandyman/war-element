/** KINGPIN — Contract Out. "Mark one opponent anywhere on the board and
 *  PARALYZE it 2 rounds; while marked, every basic against it is a guaranteed
 *  CRIT." One card, anywhere, and no damage of his own: he names it, and the
 *  rest of the table collects.
 *
 *  Kingpin's art is a heavy-set crime boss in black-and-gold power armour,
 *  cigar and sunglasses, sat at a table in the Bolt City casino among stacks
 *  of cash, poker chips and playing cards. So the DELIVERY is a dealer's
 *  flick: a gold coin thumbed up off his card, turning over and over, while a
 *  black playing card is drawn and flicked away — spinning flat across the
 *  board, a gold glint trailing it — to land on its mark.
 *
 *  The LANDING is the contract, not a blast. The card THUNKS into the target
 *  and sticks there at a slant (a gold-edged ace of spades: the death card),
 *  and a gold crosshair closes in round the target, turning, and LOCKS with a
 *  snap — the mark every basic will crit on. A bounty glint flares off the
 *  pinned card, a handful of gold coins and green bills spill and flutter
 *  off it (gold goes to whoever fills it), and a short violet current runs
 *  out of the card into the target's frame, pinning it in place: the
 *  paralyze, the only lightning in it.
 *
 *  Casino gold and money green: the one gold-and-green move in BOLT. The card
 *  is black for real (`dark: true`) under a gold rim and pip, so it reads on
 *  the near-black board and over a card's art alike. */
import { centre, rand } from "../../looks/base";
import type { Graphics } from "pixi.js";
import type { FxTools, SparkStyle } from "../../looks/types";
import type { Signature, SigMoment } from "../types";

type Box = SigMoment["from"];

const TAU = Math.PI * 2;
/** Casino gold: white-gold, gold, old gold. */
const WHITE = 0xffffff, GOLD_HI = 0xfff0b0, GOLD = 0xffc838, OLD_GOLD = 0xc8921e;
/** Money green: a light note, the note, its ink. */
const NOTE_HI = 0xc8ffd6, NOTE = 0x5ee08a, NOTE_INK = 0x2a9a58;
/** The current that pins it: BOLT's violet. */
const LAV = 0xe3d8ff, VIO = 0x9575ff;
/** The card's black face: dark layer only. */
const FELT = 0x07050a;
/** One flicker beat, s, and the pin's brightness beat by beat: a stutter. */
const BEAT = 0.035;
const FLICKER = [1, 0.35, 1, 0.8, 0.3, 0.95, 0.5, 0.2, 0.75, 0.35, 0.15, 0.55];
/** Where the thrown card sticks: a touch off the target's centre, at a slant. */
const PIN_OFF = { x: 0.06, y: -0.05 }, SLANT = -0.38;

/** Glitter shed by the flying card and the glint. */
const GLITTER: SparkStyle = { palette: [WHITE, GOLD_HI, GOLD, OLD_GOLD], gravity: 40, drag: 0.3, size: [3.5, 1], streak: false };
/** Static off the pin. */
const SNAP: SparkStyle = { palette: [WHITE, LAV, VIO], gravity: 0, drag: 0.0008, size: [5, 1.5], streak: true };

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeOut = (x: number) => 1 - (1 - x) * (1 - x);

/** A lightning channel from a to b, pinned at both ends. */
function channel(ax: number, ay: number, bx: number, by: number, segs: number, jag: number): number[] {
  const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len;
  const out = [ax, ay];
  let off = 0;
  for (let i = 1; i < segs; i++) {
    off = off * 0.5 + rand(-1, 1);
    const f = (i + rand(-0.3, 0.3)) / segs, o = off * jag * Math.sqrt(Math.sin((Math.PI * i) / segs));
    out.push(ax + dx * f + nx * o, ay + dy * f + ny * o);
  }
  out.push(bx, by);
  return out;
}

/** A playing card at (x, y) turned `rot`, `scale` its size, flipped `flip`
 *  (1 face on, 0 edge on): its outline, an inner gold border, and the ace's
 *  spade pip. Flat points; the card is drawn about s*0.32 by s*0.45. */
function playingCard(x: number, y: number, rot: number, s: number, scale: number, flip = 1) {
  const W = s * 0.16 * scale * Math.max(0.08, flip), H = s * 0.225 * scale;
  const cr = Math.cos(rot), sr = Math.sin(rot);
  // Local (lx right, ly down) into the screen.
  const P = (lx: number, ly: number) => [x + lx * cr - ly * sr, y + lx * sr + ly * cr];
  const rect = (w: number, h: number) => [...P(-w, -h), ...P(w, -h), ...P(w, h), ...P(-w, h)];
  // The spade: a heart turned point-up (the classic curve), then a flared stem.
  const pip: number[] = [], ps = H * 0.026;
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * TAU, sa = Math.sin(a);
    const hx = 16 * sa * sa * sa, hy = 13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a);
    pip.push(...P(hx * ps * 0.8 * Math.max(0.08, flip), hy * ps - H * 0.08));
  }
  const stem = [...P(0, H * 0.08), ...P(W * 0.28, H * 0.42), ...P(-W * 0.28, H * 0.42)];
  return { body: rect(W, H), inner: rect(W * 0.8, H * 0.86), pip, stem, corner: P(-W * 0.62, -H * 0.7), corner2: P(W * 0.62, H * 0.7) };
}

/** A card drawn: black face (dark layer) or its gold work (light layer). */
function drawCard(g: Graphics, k: ReturnType<typeof playingCard>, dark: boolean, a: number, hot = 0) {
  if (dark) {
    g.poly(k.body, true).fill({ color: FELT, alpha: 0.9 * a });
    return;
  }
  g.poly(k.body, true).stroke({ width: 2, color: GOLD, alpha: a, join: "round" });
  g.poly(k.inner, true).stroke({ width: 1, color: OLD_GOLD, alpha: 0.8 * a });
  g.poly(k.pip, true).fill({ color: GOLD, alpha: 0.95 * a });
  g.poly(k.stem, true).fill({ color: GOLD, alpha: 0.95 * a });
  // The A's in the corners, as gold dots: at this size a letter is a speck.
  g.circle(k.corner[0], k.corner[1], 1.4).fill({ color: GOLD_HI, alpha: a });
  g.circle(k.corner2[0], k.corner2[1], 1.4).fill({ color: GOLD_HI, alpha: a });
  if (hot > 0.01) g.poly(k.body, true).stroke({ width: 5, color: GOLD_HI, alpha: 0.4 * hot * a, join: "round" });
}

/** A coin seen turning over: a gold disc squashed by its spin, with a rim. */
function coin(g: Graphics, x: number, y: number, r: number, spin: number, tilt: number, a: number) {
  const sq = Math.max(0.12, Math.abs(Math.cos(spin)));
  const cr = Math.cos(tilt), sr = Math.sin(tilt), pts: number[] = [];
  for (let i = 0; i < 14; i++) {
    const q = (i / 14) * TAU, lx = Math.cos(q) * r, ly = Math.sin(q) * r * sq;
    pts.push(x + lx * cr - ly * sr, y + lx * sr + ly * cr);
  }
  const face = Math.cos(spin) > 0;
  g.poly(pts, true).fill({ color: face ? GOLD : OLD_GOLD, alpha: 0.85 * a }).stroke({ width: 1.2, color: GOLD_HI, alpha: a });
}

/** A banknote: a green slip with a lighter border and the portrait oval. */
function bill(g: Graphics, x: number, y: number, s: number, rot: number, turn: number, a: number) {
  const w = s * 0.14, h = s * 0.065 * Math.max(0.15, Math.abs(Math.cos(turn)));
  const cr = Math.cos(rot), sr = Math.sin(rot);
  const P = (lx: number, ly: number) => [x + lx * cr - ly * sr, y + lx * sr + ly * cr];
  g.poly([...P(-w, -h), ...P(w, -h), ...P(w, h), ...P(-w, h)], true)
    .fill({ color: NOTE_INK, alpha: 0.75 * a }).stroke({ width: 1.2, color: NOTE_HI, alpha: 0.9 * a });
  const o = P(0, 0);
  g.ellipse(o[0], o[1], w * 0.28, h * 0.6).fill({ color: NOTE, alpha: 0.9 * a });
}

/** Where the card is thrown from and where it sticks. */
function contract(m: SigMoment) {
  const c = centre(m.from), s = m.size;
  const r: Box | undefined = m.targets[0];
  const p = r ? centre(r) : { x: c.x + m.ahead.x * s * 3, y: c.y + m.ahead.y * s * 3 };
  const pin = { x: p.x + PIN_OFF.x * s, y: p.y + PIN_OFF.y * s };
  const hand = { x: c.x + m.ahead.x * s * 0.22 + m.ahead.y * s * 0.2, y: c.y + m.ahead.y * s * 0.22 - m.ahead.x * s * 0.2 };
  return { c, s, r, p, pin, hand };
}

export const KINGPIN: Signature = {
  // A contract, not a hit: the table barely rattles.
  shake: 0.3,
  lunge: false,

  deliver(t: FxTools, m: SigMoment, seconds: number) {
    const K = contract(m), { c, s, hand, pin } = K, T = seconds;
    // THE COIN: thumbed up off his card, over and over, and caught — tossed
    // out over the board, so it stays on it whichever side he sits.
    const CT = T * 0.95, toss = { x: c.x - (hand.x - c.x) * 0.6, y: c.y - (hand.y - c.y) * 0.6 };
    const coinAt = (time: number) => {
      const q = clamp01(time / CT), h = s * 0.48 * 4 * q * (1 - q);
      return { x: toss.x + m.ahead.x * h, y: toss.y + m.ahead.y * h, spin: time * 26 };
    };
    t.draw(CT, (g, u) => {
      const time = u * CT, k = coinAt(time), a = clamp01(time / 0.05) * (1 - clamp01((u - 0.9) / 0.1));
      g.circle(k.x, k.y, s * 0.1).fill({ color: GOLD, alpha: 0.12 * a });
      coin(g, k.x, k.y, s * 0.08, k.spin, 0, a);
    });
    t.later(CT, () => {
      const k = coinAt(CT);
      for (let i = 0; i < 3; i++) t.spark(k.x, k.y, rand(-40, 40) * (s / 90), rand(-40, 40) * (s / 90), rand(0.15, 0.25), GLITTER);
    });

    // THE CARD: drawn at his hand and held a beat (a gold glint on it), then
    // flicked — spinning flat, a little lob, landing square on the slant.
    const HOLD = T * 0.38, FLY = T - HOLD;
    const dx = pin.x - hand.x, dy = pin.y - hand.y, d = Math.hypot(dx, dy) || 1;
    const bow = Math.min(s * 0.5, d * 0.18), nx = -dy / d, ny = dx / d;
    const spins = Math.max(2, Math.round(d / (s * 0.9)));
    const where = (time: number) => {
      if (time < HOLD) {
        const q = easeOut(clamp01(time / HOLD));
        return { x: hand.x, y: hand.y, rot: SLANT - spins * TAU - 0.9 * (1 - q), scale: 0.6 + 0.4 * q };
      }
      const q = clamp01((time - HOLD) / FLY), e = q * (0.35 + 0.65 * q); // quickening
      return {
        x: hand.x + dx * e + nx * bow * Math.sin(Math.PI * e), y: hand.y + dy * e + ny * bow * Math.sin(Math.PI * e),
        rot: SLANT - spins * TAU * (1 - easeOut(q)), scale: 1,
      };
    };
    t.draw(T, (g, u) => {
      const w = where(u * T);
      drawCard(g, playingCard(w.x, w.y, w.rot, s, w.scale), true, clamp01(u * T / 0.05));
    }, { dark: true });
    let acc = 0;
    t.draw(T, (g, u, dt) => {
      const time = u * T, w = where(time), a = clamp01(time / 0.05);
      // The flick's blur: two ghosts of it just behind, fading.
      if (time > HOLD) for (const lag of [0.03, 0.06]) {
        const gw = where(time - lag);
        g.poly(playingCard(gw.x, gw.y, gw.rot, s, gw.scale).body, true).stroke({ width: 1.2, color: GOLD, alpha: 0.35 * (1 - lag / 0.08) });
      }
      drawCard(g, playingCard(w.x, w.y, w.rot, s, w.scale), false, a, time < HOLD ? clamp01(time / HOLD) : 0.5);
      if (time > HOLD) {
        acc += dt * 60 * t.quality;
        for (; acc >= 1; acc--) t.spark(w.x + rand(-0.08, 0.08) * s, w.y + rand(-0.08, 0.08) * s, rand(-20, 20), rand(-20, 20), rand(0.18, 0.32), GLITTER);
      }
    });
    t.charge(hand, s * 0.45, GOLD, 0.35, HOLD);
  },

  land(t: FxTools, m: SigMoment) {
    const K = contract(m), { s, r, p, pin } = K, v = s / 90;
    const half = r ? Math.min(r.w, r.h) * 0.5 : s * 0.5;

    // THE PIN: the card thunks in — a jolt bigger and back — and stays,
    // stuck on its slant, until the contract is written; then it burns off
    // gold from the edges in.
    const PD = 1.0;
    const scaleAt = (time: number) => 1 + 0.22 * Math.exp(-time * 30) * Math.cos(time * 60);
    const fade = (u: number) => 1 - clamp01((u - 0.78) / 0.22);
    t.draw(PD, (g, u) => {
      drawCard(g, playingCard(pin.x, pin.y, SLANT, s, scaleAt(u * PD)), true, fade(u));
    }, { dark: true });
    t.draw(PD, (g, u) => {
      const time = u * PD;
      drawCard(g, playingCard(pin.x, pin.y, SLANT, s, scaleAt(time)), false, fade(u), Math.max(0, 1 - time * 6) + (u > 0.78 ? 0.8 : 0));
    });
    t.flash(pin, GOLD_HI, 0.22 * v);

    // THE MARK: a gold crosshair closing in round the target, turning, and
    // LOCKING with a snap — then holding, and blinking out like a sight
    // switched off.
    const RD = 0.95, LOCK = 0.28;
    t.draw(RD, (g, u) => {
      const time = u * RD, q = easeOut(clamp01(time / LOCK)), locked = time >= LOCK;
      let a = clamp01(time / 0.06);
      if (u > 0.78) a *= Math.floor(time / BEAT) % 2 ? 0.15 : 0.9 * (1 - clamp01((u - 0.78) / 0.22) * 0.6);
      const R = half * (1.9 - 0.85 * q), rot = 0.9 * (1 - q), snap = locked ? Math.exp(-(time - LOCK) * 18) : 0;
      const col = locked ? GOLD_HI : GOLD;
      // The ring, broken at the four ticks.
      for (let i = 0; i < 4; i++) {
        const a0 = rot + (i * Math.PI) / 2 + 0.22, a1 = a0 + Math.PI / 2 - 0.44;
        g.moveTo(p.x + Math.cos(a0) * R, p.y + Math.sin(a0) * R);
        for (let j = 1; j <= 8; j++) {
          const q2 = a0 + ((a1 - a0) * j) / 8;
          g.lineTo(p.x + Math.cos(q2) * R, p.y + Math.sin(q2) * R);
        }
      }
      g.stroke({ width: 2 + 2 * snap, color: col, alpha: a });
      // The ticks in from the ring, pointing at the card's heart.
      for (let i = 0; i < 4; i++) {
        const q2 = rot + (i * Math.PI) / 2, cq = Math.cos(q2), sq = Math.sin(q2);
        g.moveTo(p.x + cq * R * 1.18, p.y + sq * R * 1.18).lineTo(p.x + cq * R * 0.62, p.y + sq * R * 0.62);
      }
      g.stroke({ width: 2, color: col, alpha: a });
      // Corner brackets, clamping in on the lock.
      const B = R * (1.12 - 0.08 * snap), L = R * 0.28;
      for (let i = 0; i < 4; i++) {
        const q2 = rot + Math.PI / 4 + (i * Math.PI) / 2, cx = p.x + Math.cos(q2) * B, cy = p.y + Math.sin(q2) * B;
        const t1 = q2 + Math.PI * 0.75, t2 = q2 - Math.PI * 0.75;
        g.moveTo(cx + Math.cos(t1) * L, cy + Math.sin(t1) * L).lineTo(cx, cy).lineTo(cx + Math.cos(t2) * L, cy + Math.sin(t2) * L);
      }
      g.stroke({ width: 2.4, color: GOLD, alpha: a, join: "miter" });
      if (snap > 0.02) g.circle(p.x, p.y, R * (1 + 0.25 * (1 - snap))).stroke({ width: 3, color: GOLD_HI, alpha: 0.7 * snap });
    });

    // THE BOUNTY: a four-point glint flaring off the pinned card as the
    // sight locks, turning a little.
    t.draw(0.32, (g, u) => {
      const a = Math.sin(Math.PI * u), L = s * 0.32 * a, w = s * 0.03 * a, rot = 0.3 + u * 0.6;
      const at = { x: pin.x - s * 0.08, y: pin.y - s * 0.12 };
      for (let i = 0; i < 4; i++) {
        const q = rot + (i * Math.PI) / 2, ln = i % 2 ? L * 0.6 : L, cq = Math.cos(q), sq = Math.sin(q);
        g.poly([at.x - sq * w, at.y + cq * w, at.x + cq * ln, at.y + sq * ln, at.x + sq * w, at.y - cq * w], true).fill({ color: GOLD_HI, alpha: 0.95 * a });
      }
      g.circle(at.x, at.y, s * 0.04 * a + 0.5).fill({ color: WHITE, alpha: a });
    }, { delay: LOCK - 0.04 });
    t.later(LOCK, () => {
      for (let i = 0; i < Math.round(8 * t.quality) + 2; i++) {
        const a = rand(0, TAU), sp = rand(40, 120) * v;
        t.spark(pin.x, pin.y, Math.cos(a) * sp, Math.sin(a) * sp - 20 * v, rand(0.3, 0.5), GLITTER);
      }
    });

    // THE PAYOUT: coins and bills spilling off the card — the coins thrown
    // up and tumbling down, the bills drifting and see-sawing as they fall.
    const nCoins = Math.round(5 * t.quality) + 1, nBills = Math.round(4 * t.quality) + 1;
    const loot = [
      ...Array.from({ length: nCoins }, () => {
        const a = -Math.PI / 2 + rand(-1.1, 1.1), sp = rand(150, 280) * v;
        return { bill: false, x: pin.x, y: pin.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, spin: rand(0, TAU), sw: rand(14, 22), ph: 0, lag: rand(0, 0.08) };
      }),
      ...Array.from({ length: nBills }, (_, i) => {
        const side = i % 2 ? 1 : -1, sp = rand(90, 170) * v;
        return { bill: true, x: pin.x, y: pin.y, vx: side * sp, vy: -rand(60, 130) * v, spin: rand(0, TAU), sw: rand(5, 8), ph: rand(0, TAU), lag: rand(0.02, 0.12) };
      }),
    ];
    const LD = 1.0;
    t.draw(LD, (g, u, dt) => {
      const time = u * LD;
      for (const o of loot) {
        if (time < o.lag) continue;
        const life = (time - o.lag) / (LD - o.lag), a = clamp01(life * 8) * (1 - clamp01((life - 0.7) / 0.3));
        if (o.bill) {
          // Paper: heavy drag, a slow fall, swinging side to side.
          o.vx *= Math.pow(0.15, dt);
          o.vy = o.vy * Math.pow(0.2, dt) + 160 * v * dt;
          o.x += (o.vx + Math.cos(time * 7 + o.ph) * 45 * v) * dt;
          o.y += o.vy * dt;
          bill(g, o.x, o.y, s, 0.5 * Math.sin(time * 7 + o.ph), time * o.sw, a);
        } else {
          o.vy += 520 * v * dt;
          o.x += o.vx * dt;
          o.y += o.vy * dt;
          coin(g, o.x, o.y, s * 0.06, o.spin + time * o.sw, 0.3, a);
        }
      }
    }, { delay: 0.08 });

    // THE PIN'S CURRENT: short violet channels out of the card into the
    // target's frame, stuttering — it is held where it stands.
    if (r) {
      const PCD = 0.5, ends = [0, 1, 2, 3].map((i) => {
        const q = SLANT + Math.PI / 4 + (i * Math.PI) / 2 + rand(-0.25, 0.25);
        const k = 1 / Math.max(Math.abs(Math.cos(q)), Math.abs(Math.sin(q)));
        return { x: p.x + Math.cos(q) * half * 0.9 * k, y: p.y + Math.sin(q) * half * 0.9 * k, q };
      });
      let paths: number[][] = [], beat = -1;
      t.draw(PCD, (g, u) => {
        const time = u * PCD, b = Math.floor(time / BEAT);
        if (b !== beat) {
          beat = b;
          paths = ends.map((e) => channel(pin.x + Math.cos(e.q) * s * 0.14, pin.y + Math.sin(e.q) * s * 0.14, e.x, e.y, 4, s * 0.05));
        }
        const lit = FLICKER[b % FLICKER.length] * Math.sqrt(1 - u);
        if (lit < 0.03) return;
        for (const pth of paths) {
          g.moveTo(pth[0], pth[1]);
          for (let i = 2; i < pth.length; i += 2) g.lineTo(pth[i], pth[i + 1]);
        }
        g.stroke({ width: 5, color: VIO, alpha: 0.3 * lit, join: "round" });
        for (const pth of paths) {
          g.moveTo(pth[0], pth[1]);
          for (let i = 2; i < pth.length; i += 2) g.lineTo(pth[i], pth[i + 1]);
        }
        g.stroke({ width: 1.3, color: LAV, alpha: lit, join: "bevel" });
      }, { delay: 0.06 });
      t.later(0.06, () => {
        for (const e of ends) {
          const sp = rand(80, 150) * v;
          t.spark(e.x, e.y, Math.cos(e.q) * sp, Math.sin(e.q) * sp, rand(0.1, 0.18), SNAP);
        }
      });
    }
  },
};
