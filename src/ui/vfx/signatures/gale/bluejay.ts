/** BLUEJAY — Twin Wind Strikes. "Two 7-DMG strikes — split across two
 *  opponents, or both onto one. Each WEAKENs and pushes 2."
 *
 *  Its art is an archer in dark armour on great COBALT wings, a long bow at
 *  full draw and an arrow trailing blue wind, the sky behind slashed with
 *  slanting wind-streaks. GALE is wind, and the wind is in the arrows: what
 *  makes these two different from any other volley is the wake each one
 *  drags behind it.
 *
 *  The DELIVERY is the draw: the cobalt wings flare open round the card, the
 *  bow is drawn across it with TWO arrows on the string together, and they
 *  are loosed a beat apart. Each flies a curve of its own — the pair part
 *  round either side when they go to two marks, and braid in onto one when
 *  both go to the same card — and each drags a wake of wind spiralling round
 *  its line, two strands twisting round each other and spreading behind it,
 *  wind-curls peeling off. The first is in on the landing frame; the second
 *  lands a beat behind it.
 *
 *  The LANDING is the shove. Each arrow strikes in a cobalt burst, and its
 *  wind does not stop at the card: a gust carries on past it along the
 *  arrow's line and back toward the enemy's home row (the push), gust lines
 *  racing on and curling over as they spend themselves, blue feathers blown
 *  along in them. Both on one card: the second lands on the first, bigger,
 *  and its gust runs twice as far (four spaces of shove).
 *
 *  Light is cobalt and sky (additive); the wings are dark for real, with a
 *  cobalt rim, so they read over an empty square. */
import { centre, rand } from "../../looks/base";
import type { Graphics } from "pixi.js";
import type { FxTools, Pt, SparkStyle } from "../../looks/types";
import type { Signature, SigMoment } from "../types";

const TAU = Math.PI * 2;
// Cobalt light: white at an arrow's point, sky through its wake, cobalt and
// deep blue at the edges.
const WHITE = 0xffffff, SKY_HI = 0xd8e8ff, SKY = 0x8db8ff, COBALT = 0x3d74ff, DEEP = 0x2a4fd8;
/** The wings (dark layer) and their lit edge. */
const WING = 0x081028, WING_RIM = 0x5f8fff;

/** Wind-curls peeling off a wake: turning round where they were shed. */
const CURL: SparkStyle = { palette: [SKY_HI, SKY, COBALT], gravity: 0, drag: 0.35, size: [5, 1.5], streak: true, swirl: 700 };
/** A strike's burst: fast, mostly on along the arrow's line. */
const BURST: SparkStyle = { palette: [WHITE, SKY_HI, SKY, COBALT], gravity: 120, drag: 0.4, size: [7, 2], streak: true };

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeOut = (x: number) => 1 - (1 - x) * (1 - x);
/** Up over the first `a` of 0..1, down over the last `b`. */
const env = (u: number, a: number, b: number) => Math.max(0, Math.min(1, u / a, (1 - u) / b));
/** The beat between the two arrows, s: loosed this far apart, landing this far apart. */
const GAP = 0.075;
/** How far along its flight the second arrow is on the landing frame: the
 *  landing flies it the rest of the way in GAP. */
const B_AT = 0.8;

// ── Feathers, the arrow, the bow ─────────────────────────────────────────────

/** A feather's outline, quill at (x, y), point along `ang`: a bare quill,
 *  then a vane swelling fast, near-parallel, rounded at the tip. */
function plume(x: number, y: number, ang: number, len: number, w: number): number[] {
  const c = Math.cos(ang), s = Math.sin(ang), left: number[] = [], right: number[] = [];
  for (let i = 0; i <= 10; i++) {
    const f = i / 10, hw = w * (f < 0.15 ? 0.1 : f < 0.8 ? Math.min(1, (f - 0.1) * 4) : Math.sqrt(Math.max(0, 1 - ((f - 0.8) / 0.2) ** 2)));
    left.push(x + f * len * c + hw * s, y + f * len * s - hw * c);
    right.unshift(x + f * len * c - hw * 0.8 * s, y + f * len * s + hw * 0.8 * c);
  }
  return left.concat(right);
}

/** A cobalt arrow, its point at (x, y) heading along `ang`, `len` long: a
 *  pale shaft in a cobalt glow, a white broadhead, blue fletching. */
function arrow(g: Graphics, x: number, y: number, ang: number, len: number, s: number, alpha: number) {
  if (alpha <= 0.02) return;
  const ux = Math.cos(ang), uy = Math.sin(ang), nx = -uy, ny = ux, hs = s * 0.11;
  const bx = x - ux * len, by = y - uy * len;
  g.moveTo(bx, by).lineTo(x, y).stroke({ width: Math.max(3, s * 0.07), color: COBALT, alpha: 0.35 * alpha, cap: "round" });
  g.moveTo(bx, by).lineTo(x - ux * hs * 0.5, y - uy * hs * 0.5).stroke({ width: Math.max(1.3, s * 0.022), color: SKY_HI, alpha: 0.95 * alpha, cap: "round" });
  for (const sd of [-1, 1])
    g.poly([bx + ux * len * 0.28, by + uy * len * 0.28, bx + ux * len * 0.04, by + uy * len * 0.04,
      bx - ux * s * 0.03 + nx * s * 0.065 * sd, by - uy * s * 0.03 + ny * s * 0.065 * sd], true).fill({ color: COBALT, alpha: 0.85 * alpha });
  g.poly([x, y, x - ux * hs + nx * hs * 0.42, y - uy * hs + ny * hs * 0.42, x - ux * hs * 0.65, y - uy * hs * 0.65,
    x - ux * hs - nx * hs * 0.42, y - uy * hs - ny * hs * 0.42], true).fill({ color: WHITE, alpha: alpha });
}

// ── The flights ──────────────────────────────────────────────────────────────

/** The two arrows: where each leaves the bow, the bend of its curve and its
 *  mark. Two marks: they part round either side. One mark: both go to it,
 *  bowing out opposite ways, so their wakes braid as they close. Fixed by the
 *  targets alone, so the landing knows exactly how each came in. */
function volley(m: SigMoment) {
  const c = centre(m.from), s = m.size;
  const marks = m.targets.length >= 2 ? [0, 1] : [0, 0];
  const p0s = marks.map((i) => centre(m.targets[i]));
  const mid = { x: (p0s[0].x + p0s[1].x) / 2, y: (p0s[0].y + p0s[1].y) / 2 };
  const aim = Math.atan2(mid.y - c.y, mid.x - c.x), ax = Math.cos(aim), ay = Math.sin(aim), nx = -ay, ny = ax;
  return marks.map((i, j) => {
    const sd = j === 0 ? -1 : 1, p2 = centre(m.targets[i]), r = m.targets[i];
    const p0 = { x: c.x + ax * s * 0.3 + nx * s * 0.065 * sd, y: c.y + ay * s * 0.3 + ny * s * 0.065 * sd };
    const d = Math.hypot(p2.x - p0.x, p2.y - p0.y);
    // Which side it bows to: away from the other mark when split, opposite
    // ways when they share one.
    const split = marks[0] !== marks[1], side = split ? Math.sign((p2.x - mid.x) * nx + (p2.y - mid.y) * ny) || sd : sd;
    const bow = d * 0.3 * side;
    const p1 = { x: (p0.x + p2.x) / 2 + nx * bow, y: (p0.y + p2.y) / 2 + ny * bow };
    return { r, p0, p1, p2, d, aim, power: m.power[i] ?? 1, killed: m.killed[i] ?? false, second: j === 1, same: !split };
  });
}
type Flight = ReturnType<typeof volley>[number];

/** The point `e` (0..1) along a flight, and its heading there. */
function along(f: Flight, e: number) {
  const q = 1 - e;
  return {
    x: q * q * f.p0.x + 2 * q * e * f.p1.x + e * e * f.p2.x, y: q * q * f.p0.y + 2 * q * e * f.p1.y + e * e * f.p2.y,
    a: Math.atan2(q * (f.p1.y - f.p0.y) + e * (f.p2.y - f.p1.y), q * (f.p1.x - f.p0.x) + e * (f.p2.x - f.p1.x)),
  };
}

/** An arrow `e` along its flight, `time` (s) since it was loosed, with its
 *  wake: two strands of wind spiralling round each other along the line it
 *  flew, spreading wider and fainter behind it, and a pale streak down the
 *  middle. `fade` dims the lot (the wake lingering after it lands). */
function flight(g: Graphics, f: Flight, e: number, time: number, s: number, fade: number, head: boolean) {
  const back = Math.min(e, 0.5), N = 18, twist = f.d / (s * 0.42);
  for (const ph of [0, Math.PI]) {
    const pts: number[] = [];
    for (let k = 0; k <= N; k++) {
      const ee = e - back + (back * k) / N, b = along(f, ee), lag = (e - ee) / 0.5;
      const amp = s * (0.03 + 0.13 * lag) * Math.min(1, (e - ee) * 12 + 0.15);
      const w = Math.sin(ee * twist * TAU - time * 28 + ph);
      pts.push(b.x - Math.sin(b.a) * amp * w, b.y + Math.cos(b.a) * amp * w);
    }
    // Tail to head, in three lengths, each brighter than the one behind.
    for (let k = 0; k < 3; k++) {
      const seg = pts.slice(k * 12, k * 12 + 14), w = (k + 1) / 3;
      g.poly(seg, false).stroke({ width: Math.max(2.5, s * 0.05 * w), color: DEEP, alpha: 0.3 * w * fade, cap: "round", join: "round" });
      g.poly(seg, false).stroke({ width: 1.7, color: ph ? SKY : SKY_HI, alpha: 0.85 * w * fade, cap: "round", join: "round" });
    }
  }
  const core: number[] = [];
  for (let k = 0; k <= 8; k++) {
    const b = along(f, e - back * 0.6 + (back * 0.6 * k) / 8);
    core.push(b.x, b.y);
  }
  g.poly(core, false).stroke({ width: 1, color: WHITE, alpha: 0.5 * fade });
  if (head) {
    const p = along(f, e);
    arrow(g, p.x, p.y, p.a, s * 0.5, s, fade);
  }
}

/** Wind-curls peeling off a wake, `rate` a second (call with each frame's dt). */
function shed(t: FxTools, f: Flight, e: number, s: number, dt: number, acc: { n: number }) {
  acc.n += dt * 45 * t.quality;
  for (; acc.n >= 1; acc.n--) {
    const b = along(f, Math.max(0, e - rand(0.02, 0.2))), sd = Math.random() < 0.5 ? -1 : 1, v = rand(30, 70) * (s / 90);
    t.spark(b.x, b.y, -Math.sin(b.a) * v * sd, Math.cos(b.a) * v * sd, rand(0.2, 0.35), CURL);
  }
}

export const BLUEJAY: Signature = {
  shake: 0.9,

  deliver(t: FxTools, m: SigMoment, seconds: number) {
    if (!m.targets.length) return;
    const c = centre(m.from), s = m.size, T = seconds, shots = volley(m), aim = shots[0].aim;
    const ax = Math.cos(aim), ay = Math.sin(aim), nx = -ay, ny = ax;
    const LA = T * 0.45, LB = LA + GAP;
    // THE WINGS: flaring open either side of the card, cobalt-edged, lifting
    // on the loose. Each a fan of long flight feathers from the shoulder.
    const wing = (u: number, fn: (pts: number[], a: number) => void) => {
      const open = easeOut(clamp01(u / 0.45)), a = env(u, 0.18, 0.15), beat = 0.15 * Math.sin(clamp01((u - 0.45) / 0.55) * Math.PI);
      for (const sd of [-1, 1]) {
        const sh = { x: c.x - ax * s * 0.12 + nx * s * 0.16 * sd, y: c.y - ay * s * 0.12 + ny * s * 0.16 * sd };
        for (let i = 0; i < 5; i++) {
          // From out to the side (i = 0) round to raised forward (i = 4):
          // wings flared up over his shoulders, as on the art.
          const fan = Math.atan2(ny * sd, nx * sd) - sd * (-0.1 + i * 0.27 * open + beat), len = s * (0.78 - i * 0.08) * (0.5 + 0.5 * open);
          fn(plume(sh.x, sh.y, fan, len, s * 0.075), a);
        }
      }
    };
    t.draw(T, (g, u) => wing(u, (pts, a) => { g.poly(pts, true).fill({ color: WING, alpha: 0.85 * a }); }), { dark: true });
    t.draw(T, (g, u) => wing(u, (pts, a) => { g.poly(pts, true).fill({ color: DEEP, alpha: 0.25 * a }).stroke({ width: 1.2, color: WING_RIM, alpha: 0.9 * a }); }));
    t.charge({ x: c.x + ax * s * 0.2, y: c.y + ay * s * 0.2 }, s, COBALT, 0.3, LA);
    // THE BOW: drawn across the card with both arrows on the string, loosed
    // one and then the other, the string ringing after.
    t.draw(T, (g, u) => {
      const time = u * T, a = env(u, 0.15, 0.12);
      const draw = time < LA ? easeOut(time / LA) : 0, since = time - (time < LB ? LA : LB);
      const ring = time >= LA ? s * 0.06 * Math.exp(-since * 22) * Math.sin(since * 90) : 0;
      const gx = c.x + ax * s * 0.22, gy = c.y + ay * s * 0.22, L = s * 0.42, bend = s * (0.1 + 0.08 * draw);
      const tx = gx + nx * L - ax * bend, ty = gy + ny * L - ay * bend, bx = gx - nx * L - ax * bend, by = gy - ny * L - ay * bend;
      const pull = s * 0.28 * draw + ring, nock = { x: (tx + bx) / 2 - ax * pull, y: (ty + by) / 2 - ay * pull };
      g.moveTo(tx, ty).quadraticCurveTo(2 * gx - (tx + bx) / 2, 2 * gy - (ty + by) / 2, bx, by).stroke({ width: Math.max(4, s * 0.08), color: DEEP, alpha: 0.35 * a, cap: "round" })
        .moveTo(tx, ty).quadraticCurveTo(2 * gx - (tx + bx) / 2, 2 * gy - (ty + by) / 2, bx, by).stroke({ width: Math.max(1.6, s * 0.03), color: SKY, alpha: 0.95 * a, cap: "round" });
      g.moveTo(tx, ty).lineTo(nock.x, nock.y).lineTo(bx, by).stroke({ width: 1, color: SKY_HI, alpha: 0.8 * a });
      // The two arrows nocked together, until each is loosed.
      for (const [j, at] of [[0, LA], [1, LB]] as const) {
        if (time >= at) continue;
        const sd = j ? 1 : -1, born = clamp01(time / (LA * 0.4)), len = s * 0.55;
        const hx = nock.x + ax * len + nx * s * 0.065 * sd, hy = nock.y + ay * len + ny * s * 0.065 * sd;
        arrow(g, hx, hy, aim, len, s, a * born);
      }
      if (draw > 0.6) g.circle(nock.x + ax * s * 0.55, nock.y + ay * s * 0.55, s * 0.09 * draw).fill({ color: COBALT, alpha: 0.25 * draw * a });
    });
    // THE ARROWS: each off the string on its beat and onto its curve, its
    // wake twisting behind it. The first lands on the landing frame; the
    // second is B_AT of the way there, and the landing brings it in.
    shots.forEach((sh) => {
      const L = sh.second ? LB : LA, F = T - L, reach = sh.second ? B_AT : 1, acc = { n: 0 };
      const e = (u: number) => reach * u * (0.7 + 0.3 * u);
      t.draw(F, (g, u, dt) => {
        flight(g, sh, e(u), u * F, s, clamp01(u * 8), true);
        shed(t, sh, e(u), s, dt, acc);
      }, { delay: L });
      t.later(L, () => {
        t.flash(sh.p0, SKY, 0.06 * (s / 80));
        for (let k = 0; k < 3; k++) {
          const a = aim + rand(-1.2, 1.2), v = rand(50, 110) * (s / 90);
          t.spark(sh.p0.x, sh.p0.y, Math.cos(a) * v, Math.sin(a) * v, rand(0.2, 0.3), CURL);
        }
      });
    });
  },

  land(t: FxTools, m: SigMoment) {
    if (!m.targets.length) return;
    const s = m.size;
    for (const sh of volley(m)) {
      // Its wake hangs a moment where it flew, untwisting as it fades.
      const at = sh.second ? GAP : 0;
      if (sh.second) {
        const acc = { n: 0 };
        t.draw(GAP, (g, u, dt) => {
          flight(g, sh, B_AT + (1 - B_AT) * u, 0.3 + u * GAP, s, 1, true);
          shed(t, sh, B_AT + (1 - B_AT) * u, s, dt, acc);
        });
      }
      t.draw(0.3, (g, u) => flight(g, sh, 1, 0.4 + u * 0.1, s, (1 - u) * (1 - u), false), { delay: at });
      t.later(at, () => strike(t, m, sh, s));
    }
  },
};

/** An arrow striking home: a cobalt burst on the card, and its wind going on
 *  through — gust lines racing on past the card along the arrow's line and
 *  back toward the enemy's home row (the push), curling over as they spend
 *  themselves, blue feathers blown along. The second of two on one card hits
 *  bigger, and its gust runs twice as far: four spaces of shove. */
function strike(t: FxTools, m: SigMoment, sh: Flight, s: number) {
  const p = centre(sh.r), arrive = along(sh, 1).a, big = sh.same && sh.second;
  const k = Math.max(0.7, Math.min(1.8, sh.power)) * (big ? 1.25 : 1);
  // The push: on along the arrow's line, bent back the way a shove goes.
  const gx0 = Math.cos(arrive) * 0.55 + m.ahead.x, gy0 = Math.sin(arrive) * 0.55 + m.ahead.y, gl = Math.hypot(gx0, gy0) || 1;
  const gx = gx0 / gl, gy = gy0 / gl, nx = -gy, ny = gx, gang = Math.atan2(gy, gx);
  t.flash(p, SKY, 0.11 * k * (s / 80));
  t.glow(sh.r, COBALT, 0.3, 0.35, 1.0);
  t.ring(sh.r, SKY, 0.25, 0.95 * Math.min(1.4, k), 0.32, big ? 4 : 3);
  const n = Math.round(9 * k);
  for (let i = 0; i < n; i++) {
    const on = i < n * 0.75, a = (on ? arrive : arrive + Math.PI) + rand(-0.6, 0.6), v = rand(140, 280) * (s / 90) * (on ? 1 : 0.5);
    t.spark(p.x, p.y, Math.cos(a) * v, Math.sin(a) * v, rand(0.18, 0.32), BURST);
  }
  // The arrow, driven in and shuddering, gone into the gust.
  const D0 = 0.32;
  t.draw(D0, (g, u) => {
    const sh2 = 0.12 * Math.exp(-u * 6) * Math.sin(u * 40), a = 1 - u * u;
    arrow(g, p.x + Math.cos(arrive) * s * 0.06, p.y + Math.sin(arrive) * s * 0.06, arrive + sh2, s * 0.45, s, a);
  });
  // THE GUST: three wind lines, the middle one longest, from just behind the
  // card on past it, a curl at the end of each.
  const reach = s * (big ? 3.4 : 1.9) * (0.85 + 0.15 * Math.min(1.4, k));
  const RUN = big ? 0.42 : 0.32, D = RUN + 0.3;
  const lines = [-1, 0, 1].map((o) => ({ off: o * s * 0.2, len: reach * (o ? 0.78 : 1), curl: s * rand(0.14, 0.2), flip: o > 0 || (o === 0 && Math.random() < 0.5), lag: Math.abs(o) * 0.04 }));
  t.draw(D, (g, u) => {
    const time = u * D;
    for (const l of lines) {
      const age = time - l.lag;
      if (age <= 0) continue;
      const head = easeOut(clamp01(age / RUN)), tail = clamp01((age - 0.12) / RUN), a = 1 - clamp01((age - RUN) / 0.3);
      const x0 = p.x - gx * s * 0.25 + nx * l.off, y0 = p.y - gy * s * 0.25 + ny * l.off;
      const pts: number[] = [];
      const N = 14;
      for (let i = 0; i <= N; i++) {
        const f = tail + ((head - tail) * i) / N, d = l.len * f;
        // The last fifth curls over: the gust spending itself.
        const c = clamp01((f - 0.78) / 0.22), th = c * Math.PI * 1.3 * (l.flip ? 1 : -1);
        const cx = d - l.curl * Math.sin(th) * c, cy = l.curl * (1 - Math.cos(th)) * c * (l.flip ? 1 : -1);
        pts.push(x0 + gx * cx + nx * cy, y0 + gy * cx + ny * cy);
      }
      if (head - tail < 0.01) continue;
      g.poly(pts, false).stroke({ width: Math.max(4, s * 0.1), color: DEEP, alpha: 0.32 * a, cap: "round", join: "round" });
      g.poly(pts, false).stroke({ width: 2.2, color: SKY_HI, alpha: 0.85 * a, cap: "round", join: "round" });
    }
  });
  // Blue feathers torn off and blown along in it.
  feathers(t, p, gang, reach, Math.round((big ? 6 : 4) * t.quality + 1), s);
  if (sh.killed) t.later(0.08, () => t.ring(sh.r, WHITE, 0.3, 1.3, 0.35, 2));
}

/** Blue feathers blown along a gust: thrown along `ang`, the gust bleeding off
 *  over `reach`, each rocking and turning over as it goes. Closed form. */
function feathers(t: FxTools, p: Pt, ang: number, reach: number, n: number, s: number) {
  const fs = Array.from({ length: n }, () => ({ a: ang + rand(-0.45, 0.45), go: reach * rand(0.35, 0.75), ph: rand(0, TAU), spin: rand(8, 14) * (Math.random() < 0.5 ? -1 : 1),
    len: s * rand(0.16, 0.22), life: rand(0.6, 0.85) }));
  const D = 0.85;
  t.draw(D, (g, u) => {
    const time = u * D;
    for (const f of fs) {
      const q = time / f.life;
      if (q >= 1) continue;
      const d = f.go * (1 - Math.exp(-time / 0.18)), sw = Math.sin(time * 9 + f.ph);
      const x = p.x + Math.cos(f.a) * d + sw * s * 0.05, y = p.y + Math.sin(f.a) * d + s * 0.25 * time;
      const rot = f.ph + f.spin * time * 0.4, a = Math.min(1, q * 10) * (1 - q * q);
      const pts = plume(x - Math.cos(rot) * f.len * 0.5, y - Math.sin(rot) * f.len * 0.5, rot, f.len, f.len * (0.12 + 0.08 * Math.abs(Math.cos(f.spin * time))));
      g.poly(pts, true).fill({ color: COBALT, alpha: 0.6 * a }).stroke({ width: 1, color: SKY_HI, alpha: 0.8 * a });
    }
  });
}
