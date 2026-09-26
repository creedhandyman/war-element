/** GALE — wind. Speed is its weapon, so everything it draws is FAST and it
 *  TURNS: nothing GALE throws flies straight and plain. Four shapes carry it,
 *  and every hook is built from them so it reads as wind even in grey:
 *   - the crescent wind-blade (a lune, tapering to two points),
 *   - the gust glyph (a long thin run that ends in a curl),
 *   - the whirl (streaks bent round a centre, spiralling in or out),
 *   - the dust-devil (a side-on funnel of spinning rings).
 *  Warm, not white: cream -> peach -> amber, sand and sunset, with dust in it
 *  that curls round where it was blown off rather than drifting like smoke. */
import type { Graphics } from "pixi.js";
import { centre, rand } from "./base";
import type { ElementLook, FxTools, Pt, SparkStyle, Throw } from "./types";

const CREAM = 0xfffaf0, PEACH = 0xffd9a0, APRICOT = 0xffc070, AMBER = 0xffa040, RUST = 0xd9701a;
const TAU = Math.PI * 2;

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
/** Fast then spent: a gust hits hardest at the start. */
const out2 = (k: number) => 1 - (1 - k) * (1 - k);
/** Up over the first `a` of 0..1, down over the last `b`. */
const env = (k: number, a: number, b: number) => Math.max(0, Math.min(1, k / a, (1 - k) / b));

// ── Spark styles (module constants: the layer caches a style per object) ─────

/** Dust caught in the wind. Its swirl turns it about the point it was born at,
 *  so a trail of it curls into little eddies instead of hanging like smoke. */
const EDDY: SparkStyle = { palette: [CREAM, PEACH, AMBER], gravity: -20, drag: 0.35, size: [6, 2], streak: true, swirl: 650 };
/** Air whipped round a point: a basic X's sparks, a touchdown's pinwheel. */
const WHIP: SparkStyle = { palette: [CREAM, PEACH, AMBER], gravity: 0, drag: 0.3, size: [6, 2], streak: true, swirl: 900 };
/** Sand flung out of a gust — rounder, warmer, falling out of it. */
const GRIT: SparkStyle = { palette: [PEACH, AMBER, RUST], gravity: 90, drag: 0.4, size: [5, 2], streak: false };

// ── Shapes ──────────────────────────────────────────────────────────────────

/** A crescent wind-blade: the lune between an arc of radius `r` and a swell
 *  of `thick` outside it, tapering to a point at both tips — the shape that
 *  says WIND where a stroked arc says sword. (x, y) is the middle of its inner
 *  edge, `rot` the way its convex side faces; [s0, s1] of its length is drawn,
 *  so a cut can sweep on and off. Its leading (outer) edge is the bright one. */
function galeBlade(g: Graphics, x: number, y: number, r: number, rot: number, span: number, thick: number,
  s0: number, s1: number, color: number, alpha: number) {
  if (s1 - s0 < 0.02 || alpha <= 0.01) return;
  const ox = x - Math.cos(rot) * r, oy = y - Math.sin(rot) * r;
  const n = 9;
  const body: number[] = [], edge: number[] = [];
  for (let i = 0; i <= n; i++) {
    const s = s0 + ((s1 - s0) * i) / n, a = rot + (s - 0.5) * span;
    body.push(ox + Math.cos(a) * r, oy + Math.sin(a) * r);
  }
  for (let i = n; i >= 0; i--) {
    const s = s0 + ((s1 - s0) * i) / n, a = rot + (s - 0.5) * span;
    const rr = r + thick * Math.sin(Math.PI * s);
    const px = ox + Math.cos(a) * rr, py = oy + Math.sin(a) * rr;
    body.push(px, py);
    edge.push(px, py);
  }
  g.poly(body).fill({ color, alpha: alpha * 0.6 });
  g.poly(edge, false).stroke({ width: 1.6, color: CREAM, alpha });
}

/** A streak of air bent round (x, y): from its tail (radius `rt`, angle `a`)
 *  on through `len` radians to its head (radius `rh`). Thin tail, bold head,
 *  so it reads as travelling round — clockwise on screen, the way the swirl
 *  pushes sparks. rt > rh spirals in; rt < rh flings out. */
function galeArc(g: Graphics, x: number, y: number, rt: number, rh: number, a: number, len: number,
  width: number, color: number, alpha: number) {
  if (alpha <= 0.01) return;
  const n = 10;
  const all: number[] = [], head: number[] = [];
  for (let i = 0; i <= n; i++) {
    const f = i / n, r = rt + (rh - rt) * f, th = a + len * f;
    const px = x + Math.cos(th) * r, py = y + Math.sin(th) * r;
    all.push(px, py);
    if (i >= 6) head.push(px, py);
  }
  g.poly(all, false).stroke({ width: width * 0.5, color, alpha: alpha * 0.55, cap: "round" });
  g.poly(head, false).stroke({ width, color, alpha, cap: "round" });
}

/** The wind glyph as a local point list: a run along +x of `len` (with one
 *  dying wave in it), then a curl that tightens as the gust spends itself —
 *  up (screen), or down with `flip`. Evenly spaced by point, not by length,
 *  so a head moving along it slows as it curls: the gust dies in its eddy. */
function galeGustPath(len: number, curl: number, turns: number, wave: number, flip: boolean): number[] {
  const pts: number[] = [];
  const sy = flip ? -1 : 1, n = 12, m = 14;
  for (let i = 0; i <= n; i++) {
    const f = i / n;
    pts.push(len * f, -sy * wave * Math.sin(f * TAU) * (1 - f));
  }
  if (curl > 0)
    for (let i = 1; i <= m; i++) {
      const f = i / m, phi = f * turns * TAU;
      const r = curl * (1 - 0.55 * f), th = sy * (Math.PI / 2 - phi);
      pts.push(len + Math.cos(th) * r, -sy * curl + Math.sin(th) * r);
    }
  return pts;
}

/** The stretch [u0, u1] (fractions, by point) of a local path, placed at
 *  (x, y) and turned by `rot`, in world space. */
function galeSlice(path: number[], u0: number, u1: number, x: number, y: number, rot: number): number[] {
  const N = path.length / 2 - 1;
  const cs = Math.cos(rot), sn = Math.sin(rot);
  const out: number[] = [];
  const i1 = clamp01(u1) * N;
  let i = clamp01(u0) * N;
  for (;;) {
    const a = Math.floor(i), b = Math.min(N, a + 1), f = i - a;
    const px = path[a * 2] + (path[b * 2] - path[a * 2]) * f;
    const py = path[a * 2 + 1] + (path[b * 2 + 1] - path[a * 2 + 1]) * f;
    out.push(x + px * cs - py * sn, y + px * sn + py * cs);
    if (i >= i1) break;
    i = Math.min(i1, Math.floor(i) + 1);
  }
  return out;
}

/** A gust travelling along a path: [u0, u1] of it drawn as a thin tail with
 *  its front 40% again, bolder — wind has a head and a thinning wake. */
function galeGust(g: Graphics, path: number[], u0: number, u1: number, x: number, y: number, rot: number,
  width: number, color: number, alpha: number) {
  if (u1 - u0 < 0.01 || alpha <= 0.01) return;
  g.poly(galeSlice(path, u0, u1, x, y, rot), false)
    .stroke({ width: width * 0.5, color, alpha: alpha * 0.5, cap: "round" });
  g.poly(galeSlice(path, u1 - (u1 - u0) * 0.4, u1, x, y, rot), false).stroke({ width, color, alpha, cap: "round" });
}

/** Where a gust's window is, `age` seconds into a run of `seconds`: the head
 *  races out (eased — it hits, then slows into its curl) and the tail follows
 *  after `lag`, so the whole line passes through and is gone. */
function galeWindow(age: number, seconds: number, lag: number): [number, number] {
  const head = out2(clamp01(age / seconds));
  const tail = clamp01((age - lag) / seconds);
  return [Math.min(tail * tail * (3 - 2 * tail), head), head];
}

/** A dust-devil seen side-on: rings stacked up from the ground, widening, each
 *  an OPEN ellipse whose gap turns with `spin`, the stack snaking by `sway`.
 *  (x, y) is where it touches down, `h` its height, `w` its width at the top. */
function galeFunnel(g: Graphics, x: number, y: number, h: number, w: number, spin: number, sway: number,
  alpha: number, levels = 5) {
  if (alpha <= 0.01 || h < 3) return;
  const left: number[] = [], right: number[] = [];
  for (let j = 0; j < levels; j++) {
    const f = j / (levels - 1);
    const cy = y - h * f;
    const rx = w * 0.5 * (0.14 + 0.86 * Math.pow(f, 1.3));
    const ry = rx * 0.3 + 1;
    const cx = x + sway * Math.sin(spin * 0.35 + f * 2.6) * f;
    const a0 = spin * (1.4 - 0.5 * f) + j * 1.9;
    const ring: number[] = [];
    for (let i = 0; i <= 8; i++) {
      const th = a0 + (i / 8) * TAU * 0.72;
      ring.push(cx + Math.cos(th) * rx, cy + Math.sin(th) * ry);
    }
    // Dust at the foot, air at the top.
    g.poly(ring, false).stroke({ width: 2.4 - f * 0.8, color: f < 0.3 ? AMBER : f < 0.7 ? PEACH : CREAM,
      alpha: alpha * (0.75 + 0.25 * f), cap: "round" });
    left.push(cx - rx, cy);
    right.push(cx + rx, cy);
  }
  g.poly(left, false).stroke({ width: 1, color: PEACH, alpha: alpha * 0.4 });
  g.poly(right, false).stroke({ width: 1, color: PEACH, alpha: alpha * 0.4 });
}

// ── Throws ──────────────────────────────────────────────────────────────────

/** Unit vector and its normal from `a` to `b`, and the distance. */
function galeLine(a: Pt, b: Pt) {
  const dx = b.x - a.x, dy = b.y - a.y, dist = Math.hypot(dx, dy) || 1;
  return { dx, dy, dist, ux: dx / dist, uy: dy / dist, nx: -dy / dist, ny: dx / dist, rot: Math.atan2(dy, dx) };
}

/** A basic ranged shot: a crescent wind-blade spinning as it flies, speed
 *  lines streaming behind it, dust curling off. It spins its last turn to
 *  land edge-first. Light — this happens every turn. */
function galeBladeShot(t: FxTools, s: Throw) {
  const L = galeLine(s.from, s.to);
  const R = s.size * 0.19;
  const turns = 2.5, a0 = L.rot - turns * TAU;
  let acc = 0;
  t.draw(s.seconds, (g, k, dt) => {
    const e = k * (0.6 + 0.4 * k); // a touch of ease-in: e(1) = 1, so it lands on time
    const x = s.from.x + L.dx * e, y = s.from.y + L.dy * e;
    const fade = Math.min(1, k * 5);
    // Speed lines, never reaching back past the thrower.
    const back = Math.min(L.dist * e, R * 4.5);
    for (let i = 0; i < 3; i++) {
      const off = (i - 1) * R * 0.6, len = back * (i === 1 ? 1 : 0.6);
      const bx = x + L.nx * off - L.ux * R * 0.4, by = y + L.ny * off - L.uy * R * 0.4;
      g.moveTo(bx - L.ux * len, by - L.uy * len).lineTo(bx, by)
        .stroke({ width: i === 1 ? 2 : 1.4, color: PEACH, alpha: 0.55 * fade });
    }
    const rot = a0 + k * turns * TAU;
    // Pinned at its middle, so it spins about itself rather than wobbling.
    galeBlade(g, x + Math.cos(rot) * R * 0.35, y + Math.sin(rot) * R * 0.35, R, rot, 2.5, R * 0.6, 0, 1, AMBER, fade);
    acc += 55 * dt;
    while (acc >= 1) {
      acc -= 1;
      const side = Math.random() < 0.5 ? -1 : 1, v = rand(40, 90);
      t.spark(x, y, -L.ux * v * 0.6 + L.nx * side * v, -L.uy * v * 0.6 + L.ny * side * v, rand(0.2, 0.35), EDDY);
    }
  }, { delay: s.delay });
}

/** A Special ranged shot: a small twister, weaving (corkscrewing) along the
 *  line and settling onto it as it lands, the path it cut left behind it. */
function galeTwister(t: FxTools, s: Throw) {
  const L = galeLine(s.from, s.to);
  const S = s.size, h = S * 0.66, w = S * 0.52;
  const amp = S * 0.24 * (Math.random() < 0.5 ? -1 : 1);
  const spin0 = rand(0, TAU);
  const trail: number[] = [];
  let acc = 0;
  t.draw(s.seconds, (g, k, dt) => {
    const e = k * (0.7 + 0.3 * k);
    // The weave dies out onto the line, so it arrives exactly on target.
    const wv = Math.sin(k * 1.5 * TAU) * amp * (1 - k);
    const x = s.from.x + L.dx * e + L.nx * wv, y = s.from.y + L.dy * e + L.ny * wv;
    const fade = Math.min(1, k * 6);
    trail.push(x, y + h * 0.35);
    if (trail.length > 28) { trail.shift(); trail.shift(); }
    if (trail.length >= 4) g.poly(trail, false).stroke({ width: 3, color: AMBER, alpha: 0.4 * fade, cap: "round" });
    galeFunnel(g, x, y + h * 0.35, h, w, spin0 + k * 34, S * 0.07, fade, 5);
    // Dust whipped off its foot, curling away.
    acc += 90 * dt;
    while (acc >= 1) {
      acc -= 1;
      const side = Math.random() < 0.5 ? -1 : 1, v = rand(70, 150);
      t.spark(x + side * w * 0.2, y + h * 0.35, side * v, -rand(10, 60), rand(0.25, 0.45), EDDY);
    }
  }, { delay: s.delay });
}

// ── The look ────────────────────────────────────────────────────────────────

export const GALE: ElementLook = {
  // Apricot, not the old pale peach: a warm orange X, GALE's rim colour,
  // that cannot be mistaken for DAWN's gold or a white hit.
  markColor: APRICOT,

  windUp(t, d) {
    // Air drawn in round the card, spiralling: streaks orbiting inward and
    // quickening as they close. A basic melee gets a breath of it (the lunge
    // is its wind-up); a Special pulls dust in with it.
    const dur = d.wind + (d.T - d.wind) * 0.3;
    const basicMelee = d.melee && !d.special;
    const n = d.special ? 4 : basicMelee ? 2 : 3;
    const peak = d.special ? 0.95 : basicMelee ? 0.45 : 0.75;
    const R0 = d.size * (d.special ? 0.95 : 0.78), R1 = d.size * 0.3;
    const spin = d.special ? 9 : 7, a0 = rand(0, TAU);
    const { x, y } = d.at;
    t.draw(dur, (g, k) => {
      const r = R0 + (R1 - R0) * k * k;
      const a = a0 + spin * k * k;
      const al = peak * env(k, 0.2, 0.2);
      for (let i = 0; i < n; i++)
        galeArc(g, x, y, r * 1.3, r, a + (i * TAU) / n, 1.4, d.special ? 3.2 : 2.2, i % 2 ? PEACH : CREAM, al);
    });
    if (d.special) {
      t.emit({ count: 22, palette: [CREAM, PEACH, AMBER], from: d.rect, at: "ring", speed: [120, 200], gravity: 0,
        drag: 1, life: [0.2, dur], size: [8, 2], streak: true, swirl: 900 });
      t.charge(d.at, d.size * 1.2, AMBER, 0.35, dur);
    } else if (!d.melee) t.charge(d.at, d.size * 0.85, AMBER, 0.2, dur);
  },

  gather(t, d) {
    // A dust-devil spinning up on the empty square, the dust round it drawn
    // in — the strike comes out of the twister.
    const S = d.size, h = S * (d.special ? 0.95 : 0.8), w = S * (d.special ? 0.85 : 0.7);
    const { x, y } = d.at;
    const spin0 = rand(0, TAU);
    t.draw(d.T, (g, k) => {
      const grow = out2(Math.min(1, k * 1.6));
      galeFunnel(g, x, y + h * 0.45, h * grow, w * (0.45 + 0.55 * grow), spin0 + k * 16, S * 0.08,
        0.9 * env(k, 0.12, 0.08), d.special ? 6 : 5);
    });
    t.emit({ count: d.special ? 34 : 20, palette: [CREAM, PEACH, AMBER], from: d.rect, at: "ring", speed: [100, 170],
      gravity: 0, drag: 1, life: [0.2, d.T], size: [8, 2], streak: true, swirl: 900 });
    t.charge(d.at, S * 1.3, AMBER, d.special ? 0.45 : 0.3, d.T);
  },

  projectile(t, s) {
    if (s.special) galeTwister(t, s);
    else galeBladeShot(t, s);
  },

  swing(t, s) {
    // Speed lines shadowing the lunge (eased in, as the token is). A basic
    // swing's is a whisper — two lines, no sparks; a Special's leads with a
    // crescent and throws dust off its wake.
    const L = galeLine(s.from, s.to);
    const lines = s.special ? 4 : 2;
    const R = s.size * 0.2;
    const peak = s.special ? 0.85 : 0.45;
    let acc = 0;
    t.draw(s.seconds, (g, k, dt) => {
      const e = k * k;
      const x = s.from.x + L.dx * e, y = s.from.y + L.dy * e;
      const back = Math.min(L.dist * e, s.size * (s.special ? 0.95 : 0.6));
      const al = peak * Math.min(1, k * 4);
      for (let i = 0; i < lines; i++) {
        const off = (i - (lines - 1) / 2) * s.size * (s.special ? 0.15 : 0.2);
        const len = back * (i % 2 ? 0.7 : 1);
        const bx = x + L.nx * off, by = y + L.ny * off;
        g.moveTo(bx - L.ux * len, by - L.uy * len).lineTo(bx, by)
          .stroke({ width: s.special ? 2 : 1.5, color: i % 2 ? PEACH : CREAM, alpha: al });
      }
      if (!s.special) return;
      galeBlade(g, x + L.ux * R * 0.3, y + L.uy * R * 0.3, R, L.rot, 2.3, R * 0.5, 0, 1, AMBER, al);
      acc += 70 * dt;
      while (acc >= 1) {
        acc -= 1;
        const side = Math.random() < 0.5 ? -1 : 1, v = rand(50, 110);
        t.spark(x, y, L.nx * side * v - L.ux * v * 0.3, L.ny * side * v - L.uy * v * 0.3, rand(0.2, 0.35), EDDY);
      }
    }, { delay: s.delay });
  },

  mark(t, m) {
    // A flurry: three crescent blades sweeping across the card, back and
    // forth, and gusts driving THROUGH it along the line of the blow, parting
    // round it and curling off beyond. All inside half a second.
    const { c, reach } = m;
    const ux = Math.cos(m.angle), uy = Math.sin(m.angle), nx = -uy, ny = ux;
    const R = reach * 1.1, thick = reach * 0.2;
    const cuts = [
      { rot: m.angle + 0.5, n: -0.28, u: -0.05, at: 0 },
      { rot: m.angle - 0.6, n: 0.28, u: 0.08, at: 0.06 },
      { rot: m.angle + 0.1, n: 0, u: 0.18, at: 0.12 },
    ];
    const gusts = [-0.5, 0, 0.5].map((o, i) => ({
      path: galeGustPath(reach * 2.3, o === 0 ? 0 : reach * 0.22, 1.1, reach * 0.05, o > 0),
      x: c.x - ux * reach * 1.3 + nx * o * reach, y: c.y - uy * reach * 1.3 + ny * o * reach,
      at: [0.03, 0, 0.06][i],
    }));
    const D = 0.5;
    t.draw(D, (g, k) => {
      const age = k * D;
      for (const gu of gusts) {
        const [u0, u1] = galeWindow(age - gu.at, 0.26, 0.12);
        galeGust(g, gu.path, u0, u1, gu.x, gu.y, m.angle, 3, PEACH, 0.9);
      }
      for (let i = 0; i < cuts.length; i++) {
        const cu = cuts[i], a = age - cu.at;
        if (a <= 0) continue;
        const s1 = clamp01(a / 0.07), s0 = clamp01((a - 0.05) / 0.16);
        // Alternate cuts sweep the other way: back and forth, a flurry.
        const f0 = i % 2 ? 1 - s1 : s0, f1 = i % 2 ? 1 - s0 : s1;
        galeBlade(g, c.x + nx * cu.n * reach + ux * cu.u * reach, c.y + ny * cu.n * reach + uy * cu.u * reach,
          R, cu.rot, 1.7, thick, f0, f1, AMBER, 1);
      }
    });
    // Dust driven on through, curling as it goes.
    const n = Math.round(18 * m.k);
    for (let i = 0; i < n; i++) {
      const a = m.angle + rand(-0.7, 0.7), v = rand(140, 300);
      t.spark(c.x + rand(-6, 6), c.y + rand(-6, 6), Math.cos(a) * v, Math.sin(a) * v, rand(0.25, 0.45), EDDY);
    }
    t.glow(m.rect, AMBER, 0.28, 0.3, 1.0);
  },

  xSparks(t, c, count) {
    // Whipped round the X in a little whirl: each leaves heading out and
    // round, and the swirl bends them all the same way — a spin, not a spray.
    const a0 = rand(0, TAU);
    for (let i = 0; i < count; i++) {
      const a = a0 + (i / count) * TAU + rand(-0.2, 0.2), v = rand(120, 210);
      const vx = (-Math.sin(a) * 0.85 + Math.cos(a) * 0.5) * v;
      const vy = (Math.cos(a) * 0.85 + Math.sin(a) * 0.5) * v;
      t.spark(c.x + Math.cos(a) * 5, c.y + Math.sin(a) * 5, vx, vy, rand(0.2, 0.32), WHIP, c);
    }
  },

  arrive(t, r) {
    // The dust-devil touches down: its funnel squashes into the square and
    // the spin flings out — arms unwinding, dust thrown round in a pinwheel.
    const c = centre(r), S = Math.min(r.w, r.h);
    const rot = rand(0, TAU);
    t.draw(0.5, (g, k) => {
      const e = out2(k);
      galeFunnel(g, c.x, c.y + S * 0.35, S * 0.75 * (1 - e), S * (0.7 + 0.5 * e), rot + k * 20, S * 0.05,
        0.9 * (1 - clamp01(k * 2.2)), 5);
      for (let i = 0; i < 4; i++)
        galeArc(g, c.x, c.y, S * (0.1 + 0.25 * e), S * (0.3 + 0.5 * e), rot + e * 3 + (i * TAU) / 4, 1.5,
          3, i % 2 ? PEACH : CREAM, 0.9 * (1 - k));
    });
    for (let i = 0; i < 34; i++) {
      const a = rand(0, TAU), v = rand(170, 320);
      t.spark(c.x + Math.cos(a) * 6, c.y + Math.sin(a) * 6, (-Math.sin(a) * 0.7 + Math.cos(a) * 0.7) * v,
        (Math.cos(a) * 0.7 + Math.sin(a) * 0.7) * v, rand(0.3, 0.55), WHIP, c);
    }
    t.glow(r, PEACH, 0.35, 0.4, 1.1);
  },

  impactAccent(t, at, k) {
    // The hit spins: three arms whirling off the burst, and a little sand
    // thrown sideways out of it. One draw and a handful of sparks — it plays
    // on every spell hit.
    const R = 30 * k, rot = rand(0, TAU);
    t.draw(0.35, (g, q) => {
      const e = out2(q);
      for (let i = 0; i < 3; i++)
        galeArc(g, at.x, at.y, R * (0.3 + 0.4 * e), R * (0.8 + 0.7 * e), rot + e * 3 + (i * TAU) / 3, 1.6,
          2.6, PEACH, 0.85 * (1 - q));
    });
    const n = Math.min(14, Math.round(8 * k));
    for (let i = 0; i < n; i++) {
      const side = i % 2 ? -1 : 1, v = rand(80, 200);
      t.spark(at.x, at.y, side * v, -rand(20, 90), rand(0.3, 0.5), GRIT);
    }
  },

  shield(t, r) {
    // A whirling ring of air round the card: streaks orbiting it on two
    // tracks, the inner one faster, settling in tight — wind as a wall.
    const c = centre(r), S = Math.min(r.w, r.h);
    const a0 = rand(0, TAU);
    t.draw(1.0, (g, k) => {
      const settle = out2(Math.min(1, k * 3));
      const Ro = S * (0.95 - 0.27 * settle), Ri = S * (0.72 - 0.18 * settle);
      const al = env(k, 0.1, 0.35);
      g.circle(c.x, c.y, Ro).stroke({ width: 1, color: AMBER, alpha: 0.2 * al });
      for (let i = 0; i < 3; i++) {
        galeArc(g, c.x, c.y, Ro, Ro, a0 + k * TAU * 1.5 + (i * TAU) / 3, 1.6, 3.2, PEACH, 0.9 * al);
        galeArc(g, c.x, c.y, Ri, Ri, a0 + 1 + k * TAU * 2.3 + (i * TAU) / 3, 1.1, 2, CREAM, 0.6 * al);
      }
    });
    // Dust flung off the ring's edge, tangent to it.
    for (let i = 0; i < 18; i++) {
      const a = rand(0, TAU), v = rand(90, 170), rr = S * 0.68;
      t.spark(c.x + Math.cos(a) * rr, c.y + Math.sin(a) * rr, -Math.sin(a) * v, Math.cos(a) * v, rand(0.4, 0.7), WHIP, c);
    }
  },

  heal(t, r, k) {
    // A warm breeze lifting off the card: two curls of air rising up its
    // sides and folding in over it, motes spiralling up — GALE's peach over
    // a living green, so it still reads as a heal.
    const kk = Math.max(0.7, Math.min(2.2, k));
    const c = centre(r), S = Math.min(r.w, r.h);
    const breezes = [-1, 1].map((side) => ({
      path: galeGustPath(S * 0.75, S * 0.13, 1.0, S * 0.05, side < 0),
      x: c.x + side * S * 0.33, y: r.y + r.h * 0.95, at: side < 0 ? 0 : 0.08,
    }));
    t.draw(0.95, (g, q) => {
      const age = q * 0.95;
      for (const b of breezes) {
        const [u0, u1] = galeWindow(age - b.at, 0.55, 0.3);
        galeGust(g, b.path, u0, u1, b.x, b.y, -Math.PI / 2, 2.6, PEACH, 0.85);
      }
    });
    t.emit({ count: Math.round(24 * kk), palette: [0xffffff, 0xe4ffd2, PEACH], from: r, at: "bottom", dir: [-100, -80],
      speed: [50, 130], gravity: -90, drag: 0.5, life: [0.7, 1.2], size: [10, 3], swirl: 120 });
    t.glow(r, 0xc8ffb0, 0.35, 0.8);
  },

  wall(t, r) {
    // An updraft along the row: gusts shooting straight up out of it and
    // curling off the top, streaks rising with them, the row's footing lit.
    const lines = Math.max(5, Math.round(r.w / 42));
    const H = r.h * 1.2;
    const ups = Array.from({ length: lines }, (_, i) => ({
      path: galeGustPath(H, r.h * 0.12, 0.9, r.w * 0.01, i % 2 === 0),
      x: r.x + ((i + 0.5) * r.w) / lines + rand(-5, 5), at: rand(0, 0.22),
    }));
    const D = 0.95;
    t.draw(D, (g, q) => {
      const fa = env(q, 0.1, 0.6);
      for (let j = 1; j <= 3; j++)
        g.rect(r.x, r.y + r.h * (1 - 0.3 * j), r.w, r.h * 0.3 * j).fill({ color: AMBER, alpha: 0.06 * fa });
      const age = q * D;
      for (const u of ups) {
        const [u0, u1] = galeWindow(age - u.at, 0.45, 0.2);
        galeGust(g, u.path, u0, u1, u.x, r.y + r.h, -Math.PI / 2, 2.6, PEACH, 0.85);
      }
    });
    t.emit({ count: Math.round(r.w / 3.5), palette: [CREAM, PEACH, AMBER, RUST], from: r, at: "bottom", dir: [-97, -83],
      speed: [260, 480], gravity: -150, drag: 0.35, life: [0.3, 0.6], size: [11, 3], streak: true });
    t.later(0.15, () => t.emit({ count: Math.round(r.w / 9), palette: [PEACH, AMBER, RUST], from: r, at: "bottom",
      dir: [-120, -60], speed: [60, 160], gravity: -60, drag: 0.5, life: [0.4, 0.7], size: [6, 2], swirl: 300 }));
  },

  field(t, r) {
    // The weather turns to wind: long gusts sweeping the whole board sideways
    // one after another, curling off the far side, sand streaming with them.
    const n = 9;
    const gusts = Array.from({ length: n }, (_, i) => ({
      path: galeGustPath(r.w * rand(0.8, 0.95), r.h * 0.035, 1.0, r.h * 0.015, i % 2 === 1),
      x: r.x - r.w * 0.04, y: r.y + (r.h * (i + 0.5)) / n + rand(-8, 8), at: rand(0, 0.45),
    }));
    const D = 1.1;
    t.draw(D, (g, q) => {
      const age = q * D;
      for (const gu of gusts) {
        const [u0, u1] = galeWindow(age - gu.at, 0.55, 0.22);
        galeGust(g, gu.path, u0, u1, gu.x, gu.y, 0, 2.6, PEACH, 0.8);
      }
    });
    for (let w = 0; w < 3; w++)
      t.later(w * 0.2, () => t.emit({ count: 48, palette: [CREAM, PEACH, AMBER, RUST], from: r, dir: [-6, 6],
        speed: [300, 560], gravity: 0, drag: 0.45, life: [0.4, 0.75], size: [10, 3], streak: true }));
    t.emit({ count: 30, palette: GRIT.palette, from: r, dir: [-20, 10], speed: [120, 260], gravity: 60, drag: 0.5,
      life: [0.5, 0.9], size: [5, 2] });
  },

  move(t, from, to) {
    // A gust carries the card: lines racing from where it stood to where it
    // lands, dust blown off after it, and a little whirl as it sets down.
    const a = centre(from), b = centre(to), L = galeLine(a, b);
    const S = Math.min(from.w, from.h);
    const lanes = [-0.28, 0, 0.28].map((o, i) => ({
      path: galeGustPath(L.dist + S * 0.25, S * (o === 0 ? 0.13 : 0.08), 1.0, S * 0.04, o > 0 || (o === 0 && L.nx < 0)),
      x: a.x - L.ux * S * 0.2 + L.nx * o * S, y: a.y - L.uy * S * 0.2 + L.ny * o * S, at: [0.04, 0, 0.07][i],
    }));
    t.draw(0.6, (g, q) => {
      const age = q * 0.6;
      for (const l of lanes) {
        const [u0, u1] = galeWindow(age - l.at, 0.38, 0.14);
        galeGust(g, l.path, u0, u1, l.x, l.y, L.rot, 2.6, PEACH, 0.85);
      }
    });
    const deg = (L.rot * 180) / Math.PI;
    t.emit({ count: 22, palette: [CREAM, PEACH, AMBER], from, dir: [deg - 15, deg + 15], speed: [150, 320], gravity: 0,
      drag: 0.35, life: [0.3, 0.55], size: [9, 3], streak: true });
    t.later(0.3, () => {
      const rot = rand(0, TAU);
      t.draw(0.4, (g, q) => {
        const e = out2(q);
        for (let i = 0; i < 3; i++)
          galeArc(g, b.x, b.y, S * (0.7 - 0.35 * e), S * (0.55 - 0.3 * e), rot + e * 4 + (i * TAU) / 3, 1.3, 2.4,
            PEACH, 0.8 * (1 - q));
      });
      t.emit({ count: 16, palette: [CREAM, PEACH, AMBER], from: to, at: "ring", speed: [100, 170], gravity: 0, drag: 0.9,
        life: [0.3, 0.5], size: [7, 2], streak: true, swirl: 700 });
    });
  },

  trapSet(t, r) {
    // A little dust-devil settling into the square: the funnel spins down
    // into the ground and is gone, dust spiralling in after it, a puff left.
    const c = centre(r), S = Math.min(r.w, r.h);
    const spin0 = rand(0, TAU);
    t.draw(0.8, (g, q) => {
      galeFunnel(g, c.x + Math.sin(q * 7) * S * 0.05, c.y + S * 0.28, S * 0.62 * (1 - q), S * 0.5 * (1 - 0.45 * q),
        spin0 + q * 24, S * 0.05, 0.85 * env(q, 0.1, 0.25), 4);
    });
    t.emit({ count: 18, palette: [CREAM, PEACH, AMBER], from: r, at: "ring", speed: [90, 150], gravity: 0, drag: 0.9,
      life: [0.3, 0.5], size: [7, 2], streak: true, swirl: 700 });
    t.later(0.6, () => t.emit({ count: 10, palette: GRIT.palette, from: { x: c.x - 8, y: c.y + S * 0.22, w: 16, h: 8 },
      dir: [-170, -10], speed: [40, 110], gravity: 60, drag: 0.5, life: [0.3, 0.5], size: [6, 2] }));
  },

  pulse(t, r) {
    // A gust down the row's length: three lines racing across it and curling
    // off the end, dust dragged along with them.
    const ys = [0.3, 0.52, 0.74];
    const gusts = ys.map((f, i) => ({
      path: galeGustPath(r.w * 0.9, r.h * 0.12, 1.0, r.h * 0.04, i === 1),
      x: r.x - r.w * 0.02, y: r.y + r.h * f, at: i * 0.06,
    }));
    t.draw(0.75, (g, q) => {
      const age = q * 0.75;
      for (const gu of gusts) {
        const [u0, u1] = galeWindow(age - gu.at, 0.42, 0.18);
        galeGust(g, gu.path, u0, u1, gu.x, gu.y, 0, 2.8, PEACH, 0.85);
      }
    });
    t.emit({ count: 40, palette: [CREAM, PEACH, AMBER, RUST], from: r, dir: [-5, 5], speed: [260, 480], gravity: 0,
      drag: 0.4, life: [0.35, 0.7], size: [10, 3], streak: true });
  },
};
