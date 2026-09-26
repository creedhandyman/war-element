/** THE EFFECTS LAYER — a WebGL canvas over the board, drawing spell impacts.
 *
 *  A PROTOTYPE, and deliberately a narrow one: it answers "can this game have
 *  real VFX without leaving the web?" with one effect done properly — the hit
 *  when a spell's damage lands — rather than a sketch of many.
 *
 *  THE DIVISION OF LABOUR is the whole design. React and the DOM stay the
 *  source of truth for the board: every card, number and tap target is exactly
 *  what it was. This layer only DRAWS, over the top, with `pointer-events:
 *  none`, and knows nothing about the game — it is handed a screen point, an
 *  element and a strength. Delete it and the game is unchanged.
 *
 *  WHY PIXI and not CSS: what a DOM element cannot do cheaply is be one of a
 *  thousand. Particles are the canonical case — every spark as a <div> is a
 *  layout box, a style recalc and a compositor layer. Here they are one draw
 *  call: a ParticleContainer batches every spark into a single buffer with
 *  additive blending, which is also what makes them glow where they overlap.
 *
 *  COST WHEN IDLE IS ZERO. The ticker only runs while something is alive and
 *  stops on the frame the last spark dies, so between spells there is no
 *  render loop at all. The module itself is a lazy chunk (see
 *  use-spell-impacts.ts): a player who never sees a spell hit never downloads
 *  Pixi. */
import { Application, Container, Graphics, Particle, ParticleContainer, Sprite, Texture } from "pixi.js";
import type { Element, StatusKind } from "../../engine";

/** A screen rectangle, CSS px — a square, a row, the board. */
export interface Rect { x: number; y: number; w: number; h: number }

/** Everything a spell can look like, in screen space. The game-side mapping
 *  (which change means which effect) lives in spell-fx.ts; this is only how
 *  each one is drawn. */
export type LayerFx =
  | { kind: "heal"; rect: Rect; element: Element; strength: number }
  | { kind: "shield"; rect: Rect; element: Element }
  | { kind: "status"; rect: Rect; status: StatusKind; element: Element }
  | { kind: "buff" | "debuff"; rect: Rect; element: Element }
  | { kind: "move"; from: Rect; to: Rect; element: Element }
  | { kind: "wall"; rect: Rect; element: Element }
  | { kind: "field"; rect: Rect; element: Element }
  | { kind: "trapSet"; rect: Rect; element: Element }
  | { kind: "pulse"; rect: Rect; element: Element }
  /** A whole-board spell's set piece, in two halves: INCOMING plays for
   *  exactly `seconds` before the spell lands, FINALE with the landing. The
   *  targets are the cards it reaches; `fromTop` is which edge the caster's
   *  side is on, for anything that should come from them. */
  | { kind: "boardIncoming"; rect: Rect; element: Element; targets: Rect[]; fromTop: boolean; seconds: number; strength: number }
  | { kind: "boardFinale"; rect: Rect; element: Element; targets: Rect[]; fromTop: boolean; strength: number }
  /** A card's attack being DELIVERED — the wind-up and the throw, or the
   *  swing — for exactly `seconds`, so it arrives as the turn lands. */
  | { kind: "attack"; from: Rect; targets: Rect[]; element: Element; melee: boolean; special: boolean; seconds: number;
      /** A summon striking as it lands: `from` is its square, still empty — the
       *  element gathers THERE, and a melee card pounces the whole way. */
      arriving?: boolean }
  /** A summon that struck, materialising on its square as the hits land. */
  | { kind: "arrive"; rect: Rect; element: Element }
  /** A melee card's blow landing: a cut across `angle`, the line of attack. */
  | { kind: "slash"; rect: Rect; element: Element; strength: number; special: boolean; angle: number };

export interface ImpactLayer {
  /** A spell's damage landing at a screen point (CSS px). `strength` ~0.7-2.2,
   *  scaled from the damage dealt: a 2-point chip and a 12-point nuke should
   *  not look the same. */
  impact(x: number, y: number, element: Element, strength?: number): void;
  /** Every other spell effect. */
  play(fx: LayerFx): void;
  /** Sparks alive right now — the lab's HUD reads it. */
  readonly live: number;
  /** Smoothed frames per second, while the ticker is running. */
  fps(): number;
  /** Hard ceiling on live sparks. A burst that would exceed it is thinned, not
   *  skipped, so a busy AoE still reads as a hit on every square. */
  setCap(n: number): void;
  destroy(): void;
}

/** Everything that differs between elements. One particle system; eight
 *  personalities, from these knobs rather than eight code paths. */
interface Style {
  /** Hot core -> outer colour -> cooling. A spark walks this list as it ages,
   *  which is what makes a burst read as heat rather than as confetti. */
  palette: number[];
  sparks: number;          // per unit of strength
  speed: [number, number]; // px/s at birth
  gravity: number;         // px/s², + falls, - rises
  drag: number;            // fraction of velocity kept per second
  life: [number, number];  // seconds
  size: [number, number];  // px at birth -> px at death
  streak: boolean;         // stretch along velocity (fast sparks) vs round (embers, petals)
  swirl?: number;          // tangential push, px/s² — GALE's spiral
  implode?: boolean;       // DUSK: draws in, THEN bursts
  arcs?: number;           // BOLT: jagged lightning branches
  rays?: number;           // DAWN: long radiant spokes
  embers?: number;         // slow second wave per unit strength
}

const STYLES: Record<Element, Style> = {
  PYRO: { palette: [0xfff4d6, 0xffc14a, 0xff6a2a, 0xc2261a], sparks: 170, speed: [220, 620],
          gravity: -260, drag: 0.08, life: [0.35, 0.9], size: [16, 4], streak: true, embers: 40 },
  AQUA: { palette: [0xf0fbff, 0x9fe3ff, 0x4d94e8, 0x1f4fa8], sparks: 150, speed: [180, 520],
          gravity: 900, drag: 0.25, life: [0.4, 0.9], size: [14, 5], streak: false },
  BOLT: { palette: [0xffffff, 0xe3d8ff, 0x9575ff, 0x5b3bd6], sparks: 130, speed: [420, 980],
          gravity: 0, drag: 0.02, life: [0.15, 0.4], size: [12, 2], streak: true, arcs: 6 },
  LEAF: { palette: [0xf4ffe6, 0xb6f27a, 0x4caf6d, 0x2c7a45], sparks: 110, speed: [120, 380],
          gravity: 120, drag: 0.3, life: [0.6, 1.3], size: [15, 8], streak: false, swirl: 140 },
  GALE: { palette: [0xfffaf0, 0xffd9a0, 0xffa040, 0xd9701a], sparks: 160, speed: [160, 460],
          gravity: -40, drag: 0.2, life: [0.45, 1.0], size: [13, 3], streak: true, swirl: 900 },
  BORE: { palette: [0xfff1dc, 0xd9b48a, 0xa1887f, 0x5d4a40], sparks: 120, speed: [180, 520],
          gravity: 1400, drag: 0.4, life: [0.5, 1.0], size: [18, 10], streak: false },
  DAWN: { palette: [0xffffff, 0xfff1b3, 0xffd54f, 0xe0a41c], sparks: 140, speed: [200, 560],
          gravity: -60, drag: 0.1, life: [0.4, 1.0], size: [14, 3], streak: true, rays: 12 },
  DUSK: { palette: [0xf3e8ff, 0xc9a6ff, 0x7b4fb0, 0x3a1f5c], sparks: 150, speed: [200, 560],
          gravity: 0, drag: 0.12, life: [0.4, 0.95], size: [15, 4], streak: true, implode: true },
  VOID: { palette: [0xffffff, 0xe3e7f1, 0xc2c8d8, 0x6b7285], sparks: 150, speed: [200, 600],
          gravity: 0, drag: 0.1, life: [0.35, 0.85], size: [14, 3], streak: true, implode: true },
};

interface Spark {
  p: Particle;
  vx: number; vy: number;
  ox: number; oy: number; // birth point, for swirl
  age: number; life: number;
  s0: number; s1: number;
  style: Style;
}

/** A short-lived drawn thing: flash, shockwave, lightning, rays. `tick`
 *  returns false when it is finished, and the layer disposes of it. */
interface Burst {
  node?: Graphics | Sprite;
  age: number;
  delay: number;
  tick(t: number, dt: number): boolean;
}

const TEX = 64; // the dot texture's side, px — every scale below is size / TEX

function dotTexture(): Texture {
  // White, soft-edged: tint does the colour and additive blending does the
  // glow, so one texture serves every element.
  const c = document.createElement("canvas");
  c.width = c.height = TEX;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(TEX / 2, TEX / 2, 0, TEX / 2, TEX / 2, TEX / 2);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.35, "rgba(255,255,255,0.65)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, TEX, TEX);
  return Texture.from(c);
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);

/** Clear in the middle, near-black at the edges: night closing in. Drawn with
 *  NORMAL blending, because additive light can brighten the board but never
 *  darken it. */
function vignetteTexture(): Texture {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(64, 64, 18, 64, 64, 64);
  grad.addColorStop(0, "rgba(6,0,16,0)");
  grad.addColorStop(0.55, "rgba(6,0,16,0.35)");
  grad.addColorStop(1, "rgba(6,0,16,0.95)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return Texture.from(c);
}

/** Resolves to a working layer, or to a no-op one when WebGL is unavailable
 *  (an old phone, a blocked context, a crashed GPU process). An effects layer
 *  that fails must fail SILENT: the game underneath is complete without it. */
export async function createImpactLayer(): Promise<ImpactLayer> {
  const app = new Application();
  try {
    await app.init({
      backgroundAlpha: 0,
      resizeTo: window,
      antialias: false,
      autoDensity: true,
      // 2x is the ceiling on purpose: a 3x phone would triple the pixels a
      // full-screen canvas fills for sparks that are soft-edged anyway.
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      preference: "webgl",
      autoStart: false,
      sharedTicker: false,
    });
  } catch {
    return noopLayer();
  }
  const canvas = app.canvas;
  canvas.className = "vfx-layer";
  canvas.setAttribute("aria-hidden", "true");
  document.body.appendChild(canvas);

  const tex = dotTexture();
  const vignette = vignetteTexture();
  const shade = new Container(); // normal blend: darkness goes here
  const bursts = new Container({ blendMode: "add" });
  const sparks = new ParticleContainer({
    texture: tex,
    blendMode: "add",
    dynamicProperties: { position: true, vertex: true, rotation: true, color: true },
  });
  app.stage.addChild(shade, bursts, sparks);

  const live: Spark[] = [];
  const pool: Spark[] = [];
  const effects: Burst[] = [];
  let cap = 6000;

  function spawnSpark(x: number, y: number, st: Style, strength: number, angle: number, inward: boolean) {
    if (live.length >= cap) return;
    const s = pool.pop() ?? {
      p: new Particle({ texture: tex, anchorX: 0.5, anchorY: 0.5 }),
      vx: 0, vy: 0, ox: 0, oy: 0, age: 0, life: 1, s0: 1, s1: 1, style: st,
    };
    const speed = rand(st.speed[0], st.speed[1]) * (0.75 + strength * 0.25);
    if (inward) {
      // DUSK/VOID: born on a ring, pulled to the centre.
      const r = rand(60, 110) * strength;
      s.p.x = x + Math.cos(angle) * r;
      s.p.y = y + Math.sin(angle) * r;
      s.vx = -Math.cos(angle) * speed * 0.9;
      s.vy = -Math.sin(angle) * speed * 0.9;
      s.life = r / (speed * 0.9) * 0.95;
    } else {
      s.p.x = x;
      s.p.y = y;
      s.vx = Math.cos(angle) * speed;
      s.vy = Math.sin(angle) * speed;
      s.life = rand(st.life[0], st.life[1]);
    }
    s.ox = x; s.oy = y;
    s.age = 0;
    s.s0 = st.size[0] * rand(0.7, 1.3) * (0.8 + strength * 0.2);
    s.s1 = st.size[1];
    s.style = st;
    s.p.tint = st.palette[0];
    s.p.alpha = 1;
    live.push(s);
    sparks.particleChildren.push(s.p);
  }

  function burst(x: number, y: number, st: Style, strength: number, count: number) {
    for (let i = 0; i < count; i++) spawnSpark(x, y, st, strength, rand(0, Math.PI * 2), false);
  }

  function addFlash(x: number, y: number, st: Style, strength: number, delay = 0) {
    const sp = new Sprite(tex);
    sp.anchor.set(0.5);
    sp.position.set(x, y);
    sp.tint = st.palette[1];
    sp.alpha = 0;
    bursts.addChild(sp);
    const size = 260 * strength;
    effects.push({
      node: sp, age: 0, delay, tick: wrap((t) => {
        // Fast in, slow out: the eye reads the peak as the moment of impact.
        const k = t < 0.12 ? t / 0.12 : 1 - (t - 0.12) / 0.88;
        sp.alpha = Math.max(0, k) * 0.95;
        sp.scale.set((size * (0.55 + 0.45 * Math.min(1, t * 4))) / TEX);
        return t < 1;
      }, 0.42),
    });
  }

  function addRing(x: number, y: number, st: Style, strength: number, delay = 0) {
    const g = new Graphics();
    g.position.set(x, y);
    bursts.addChild(g);
    const reach = 120 * strength;
    effects.push({
      node: g, age: 0, delay, tick: wrap((t) => {
        const ease = 1 - (1 - t) * (1 - t);
        g.clear()
          .circle(0, 0, 8 + reach * ease)
          .stroke({ width: 10 * (1 - t) + 1, color: st.palette[2], alpha: 0.9 * (1 - t) });
        return t < 1;
      }, 0.5),
    });
  }

  function addArcs(x: number, y: number, st: Style, strength: number, n: number) {
    const g = new Graphics();
    g.position.set(x, y);
    bursts.addChild(g);
    let frame = 0;
    effects.push({
      node: g, age: 0, delay: 0, tick: wrap((t) => {
        // Re-rolled every other frame: lightning that holds still reads as a
        // drawing of lightning.
        if (frame++ % 2 === 0) {
          g.clear();
          for (let i = 0; i < n; i++) {
            const a = rand(0, Math.PI * 2);
            const len = rand(70, 140) * strength;
            const pts: number[] = [0, 0];
            const steps = 6;
            for (let k = 1; k <= steps; k++) {
              const d = (len * k) / steps;
              const jitter = rand(-18, 18) * (k < steps ? 1 : 0.3);
              pts.push(Math.cos(a) * d - Math.sin(a) * jitter, Math.sin(a) * d + Math.cos(a) * jitter);
            }
            g.poly(pts, false).stroke({ width: 7, color: st.palette[2], alpha: 0.35 * (1 - t) });
            g.poly(pts, false).stroke({ width: 2, color: st.palette[0], alpha: 1 - t });
          }
        }
        return t < 1;
      }, 0.32),
    });
  }

  function addRays(x: number, y: number, st: Style, strength: number, n: number) {
    const g = new Graphics();
    g.position.set(x, y);
    bursts.addChild(g);
    const base = rand(0, Math.PI * 2);
    effects.push({
      node: g, age: 0, delay: 0, tick: wrap((t) => {
        g.clear();
        const len = (60 + 170 * (1 - (1 - t) * (1 - t))) * strength;
        for (let i = 0; i < n; i++) {
          const a = base + (i / n) * Math.PI * 2 + t * 0.4;
          g.moveTo(Math.cos(a) * 14, Math.sin(a) * 14)
            .lineTo(Math.cos(a) * len, Math.sin(a) * len)
            .stroke({ width: 5 * (1 - t) + 1, color: st.palette[1], alpha: 0.8 * (1 - t) });
        }
        return t < 1;
      }, 0.6),
    });
  }

  /** Turn a tick over normalised time into one over seconds. */
  function wrap(f: (t: number, dt: number) => boolean, seconds: number) {
    return (_t: number, dt: number) => f(Math.min(1, _t / seconds), dt);
  }

  // ── EVERY OTHER SPELL EFFECT ──────────────────────────────────────────────
  // One emitter, many looks. A spark is born somewhere in a rect (or on its
  // bottom edge, or on a ring around it), moving in a direction band, and the
  // rest is the same physics the impacts use — gravity, drag, swirl, palette.

  interface Emit {
    count: number;
    palette: number[];
    /** Where sparks are born: anywhere in the rect, along its bottom edge, on
     *  a ring around its centre moving INWARD (a gathering), or on its edges
     *  moving inward (something closing in). */
    from: Rect;
    at?: "area" | "bottom" | "ring" | "edge";
    /** Direction band in degrees (0 = right, -90 = up). Default: all round. */
    dir?: [number, number];
    speed: [number, number];
    gravity: number;
    drag: number;
    life: [number, number];
    size: [number, number];
    streak?: boolean;
    swirl?: number;
  }

  function emit(e: Emit) {
    const st: Style = {
      palette: e.palette, sparks: 0, speed: e.speed, gravity: e.gravity, drag: e.drag,
      life: e.life, size: e.size, streak: !!e.streak, swirl: e.swirl,
    };
    const cx = e.from.x + e.from.w / 2, cy = e.from.y + e.from.h / 2;
    const n = Math.min(e.count, Math.max(0, cap - live.length));
    for (let i = 0; i < n; i++) {
      if (e.at === "ring") {
        const a = rand(0, Math.PI * 2);
        const r = Math.min(e.from.w, e.from.h) * rand(0.35, 0.55);
        const speed = rand(e.speed[0], e.speed[1]);
        spawnRaw(cx + Math.cos(a) * r, cy + Math.sin(a) * r, -Math.cos(a) * speed, -Math.sin(a) * speed,
          (r / speed) * 0.9, st, cx, cy);
        continue;
      }
      if (e.at === "edge") {
        const side = Math.floor(rand(0, 4));
        const ex = side < 2 ? e.from.x + rand(0, e.from.w) : side === 2 ? e.from.x : e.from.x + e.from.w;
        const ey = side === 0 ? e.from.y : side === 1 ? e.from.y + e.from.h : e.from.y + rand(0, e.from.h);
        const dx = cx - ex, dy = cy - ey, d = Math.hypot(dx, dy) || 1;
        const speed = rand(e.speed[0], e.speed[1]);
        spawnRaw(ex, ey, (dx / d) * speed, (dy / d) * speed, Math.min((d / speed) * 0.85, e.life[1]), st, cx, cy);
        continue;
      }
      const x = e.from.x + rand(0, e.from.w);
      const y = e.at === "bottom" ? e.from.y + e.from.h - rand(0, e.from.h * 0.15) : e.from.y + rand(0, e.from.h);
      const [d0, d1] = e.dir ?? [0, 360];
      const a = (rand(d0, d1) * Math.PI) / 180;
      const speed = rand(e.speed[0], e.speed[1]);
      spawnRaw(x, y, Math.cos(a) * speed, Math.sin(a) * speed, rand(e.life[0], e.life[1]), st, cx, cy);
    }
  }

  function spawnRaw(x: number, y: number, vx: number, vy: number, life: number, st: Style, ox: number, oy: number) {
    if (live.length >= cap) return;
    const s = pool.pop() ?? {
      p: new Particle({ texture: tex, anchorX: 0.5, anchorY: 0.5 }),
      vx: 0, vy: 0, ox: 0, oy: 0, age: 0, life: 1, s0: 1, s1: 1, style: st,
    };
    s.p.x = x; s.p.y = y;
    s.vx = vx; s.vy = vy;
    s.ox = ox; s.oy = oy;
    s.age = 0;
    s.life = life;
    s.s0 = st.size[0] * rand(0.75, 1.25);
    s.s1 = st.size[1];
    s.style = st;
    s.p.tint = st.palette[0];
    s.p.alpha = 1;
    live.push(s);
    sparks.particleChildren.push(s.p);
  }

  /** Run `fn` after `seconds` on the layer's own clock. */
  function later(seconds: number, fn: () => void) {
    effects.push({ age: 0, delay: seconds, tick: () => { fn(); return false; } });
  }

  /** A soft glow over a rect: fast in, slow out. */
  function glow(r: Rect, color: number, peak: number, seconds: number, scale = 1.3) {
    const sp = new Sprite(tex);
    sp.anchor.set(0.5);
    sp.position.set(r.x + r.w / 2, r.y + r.h / 2);
    sp.tint = color;
    sp.alpha = 0;
    sp.scale.set((Math.max(r.w, r.h) * scale) / TEX);
    bursts.addChild(sp);
    effects.push({
      node: sp, age: 0, delay: 0, tick: wrap((t) => {
        sp.alpha = (t < 0.2 ? t / 0.2 : 1 - (t - 0.2) / 0.8) * peak;
        return t < 1;
      }, seconds),
    });
  }

  /** A ring around a rect's centre, from `r0` to `r1` times its size. */
  function ring(r: Rect, color: number, r0: number, r1: number, seconds: number, width = 4) {
    const g = new Graphics();
    g.position.set(r.x + r.w / 2, r.y + r.h / 2);
    bursts.addChild(g);
    const base = Math.min(r.w, r.h) / 2;
    effects.push({
      node: g, age: 0, delay: 0, tick: wrap((t) => {
        const ease = 1 - (1 - t) * (1 - t);
        g.clear().circle(0, 0, base * (r0 + (r1 - r0) * ease))
          .stroke({ width: width * (1 - t) + 1, color, alpha: 0.9 * (1 - t) });
        return t < 1;
      }, seconds),
    });
  }

  /** A band of light across a rect (a wall's footing, a pulse's line). */
  function band(r: Rect, color: number, seconds: number) {
    const g = new Graphics();
    bursts.addChild(g);
    effects.push({
      node: g, age: 0, delay: 0, tick: wrap((t) => {
        const k = t < 0.15 ? t / 0.15 : 1 - (t - 0.15) / 0.85;
        g.clear().rect(r.x, r.y, r.w, r.h).fill({ color, alpha: 0.28 * k });
        return t < 1;
      }, seconds),
    });
  }

  /** A statused card's look, by what the status IS rather than who cast it:
   *  a freeze reads as ice from any element's spell. */
  function status(r: Rect, kind: StatusKind, el: Style) {
    const small = (count: number) => Math.round(count * Math.max(0.8, Math.min(1.4, r.w / 90)));
    switch (kind) {
      case "FREEZE":
        emit({ count: small(46), palette: [0xffffff, 0xe6f8ff, 0x9fe3ff, 0x4d94e8], from: r, speed: [20, 90],
          gravity: 40, drag: 0.3, life: [0.6, 1.2], size: [13, 4] });
        ring(r, 0x9fe3ff, 1.2, 0.8, 0.5);
        glow(r, 0xbfeaff, 0.5, 0.6);
        return;
      case "SLEEP":
        emit({ count: small(18), palette: [0xd9ccff, 0xa894f0, 0x7b6bd6], from: r, at: "bottom", dir: [-110, -70],
          speed: [30, 70], gravity: -30, drag: 0.5, life: [1.1, 1.7], size: [14, 6], swirl: 70 });
        glow(r, 0x8f7be0, 0.3, 1.0);
        return;
      case "WEAKEN":
        emit({ count: small(34), palette: [0xf0e6dc, 0xa89484, 0x5c4a40], from: { ...r, h: r.h * 0.3 },
          dir: [80, 100], speed: [60, 140], gravity: 260, drag: 0.4, life: [0.6, 1.0], size: [11, 3], streak: true });
        return;
      case "PARALYZE":
      case "STUN":
      case "ELECTRIFIED":
        addArcs(r.x + r.w / 2, r.y + r.h / 2, { ...el, palette: [0xffffff, 0xfff6c4, 0xffd54f, 0xc79a1a] }, 0.6, 4);
        emit({ count: small(24), palette: [0xffffff, 0xfff3b0, 0xffd54f], from: r, speed: [200, 420],
          gravity: 0, drag: 0.05, life: [0.15, 0.35], size: [9, 2], streak: true });
        return;
      case "BLIND":
        glow(r, 0xfffbe0, 0.95, 0.55, 1.4);
        addRays(r.x + r.w / 2, r.y + r.h / 2, { ...el, palette: [0xffffff, 0xfff1b3, 0xffd54f] }, 0.4, 10);
        return;
      case "FRIGHTEN":
        emit({ count: small(30), palette: [0xf0e0ff, 0xa070d0, 0x4a2070], from: r, at: "bottom", dir: [-115, -65],
          speed: [140, 280], gravity: -80, drag: 0.3, life: [0.5, 0.9], size: [12, 3], streak: true });
        return;
      case "BURN":
      case "SCALD":
        emit({ count: small(34), palette: [0xfff4d6, 0xffc14a, 0xff6a2a, 0xc2261a], from: r, at: "bottom",
          dir: [-120, -60], speed: [60, 170], gravity: -160, drag: 0.4, life: [0.6, 1.2], size: [10, 3] });
        return;
      case "BLEED":
        emit({ count: small(26), palette: [0xffd0d0, 0xff4a4a, 0x9a0f1f], from: { x: r.x + r.w * 0.3, y: r.y + r.h * 0.3, w: r.w * 0.4, h: r.h * 0.2 },
          dir: [60, 120], speed: [40, 120], gravity: 700, drag: 0.6, life: [0.5, 0.9], size: [10, 5] });
        return;
      case "DOT":
        emit({ count: small(24), palette: [0xe8ffe0, 0x9be86a, 0x3c8a2a], from: r, at: "bottom", dir: [-100, -80],
          speed: [30, 80], gravity: -40, drag: 0.5, life: [0.9, 1.5], size: [13, 6], swirl: 40 });
        return;
      case "ROOT":
        // Vines: green curling up off the card's footing, which glows as it
        // takes hold.
        emit({ count: small(34), palette: [0xb6f27a, 0x6fbf4a, 0x3f8a3a], from: r, at: "bottom", dir: [-105, -75],
          speed: [40, 110], gravity: 0, drag: 0.8, life: [0.5, 0.9], size: [11, 4], swirl: 120 });
        band({ x: r.x, y: r.y + r.h * 0.82, w: r.w, h: r.h * 0.18 }, 0x6fbf4a, 0.9);
        return;
      case "MUTED":
      case "SEAL":
        ring(r, 0xb8bcc8, 1.5, 0.55, 0.55, 5);
        return;
      case "STEALTH":
      case "EVASION":
        // An afterimage: the card's outline shimmers and slips sideways.
        emit({ count: small(16), palette: [0xb0c0e8, 0x7f90c0, 0x4a5a80], from: r, dir: [170, 190],
          speed: [30, 80], gravity: 0, drag: 0.4, life: [0.4, 0.7], size: [12, 4] });
        glow(r, 0x9fb0d8, 0.4, 0.6);
        return;
      default:
        emit({ count: small(24), palette: el.palette, from: r, speed: [60, 160], gravity: 0, drag: 0.3,
          life: [0.4, 0.8], size: [11, 3] });
    }
  }

  // ── WHOLE-BOARD SPELLS ────────────────────────────────────────────────────
  // Two halves. INCOMING plays in the pause before the spell lands and lasts
  // exactly that long, so whatever it throws arrives on the frame the damage
  // numbers do. The FINALE plays with the landing, over each card's own
  // impact. One set piece per element; the spell's cost sets the weight.

  type Pt = { x: number; y: number };
  const centre = (r: Rect): Pt => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

  interface Shot {
    from: Pt;
    to: Pt;
    seconds: number;
    delay?: number;
    /** "in" accelerates (a meteor, a rock), "out" slows (a root creeping). */
    ease?: "in" | "out" | "linear";
    head: number;
    headSize: number;
    /** Stretch the head along its motion — a streaking meteor. */
    stretch?: boolean;
    /** Lob it: how high, in px, the path bows above the straight line. */
    arc?: number;
    trail: { palette: number[]; rate: number; size: [number, number]; life: [number, number]; drift: number; gravity?: number };
    onArrive?: () => void;
  }

  /** A projectile: a glowing head from `from` to `to` in exactly `seconds`,
   *  shedding a trail as it goes. */
  function shot(p: Shot) {
    const head = new Sprite(tex);
    head.anchor.set(0.5);
    head.tint = p.head;
    head.alpha = 0;
    bursts.addChild(head);
    const trail: Style = {
      palette: p.trail.palette, sparks: 0, speed: [0, 0], gravity: p.trail.gravity ?? 0, drag: 0.3,
      life: p.trail.life, size: p.trail.size, streak: false,
    };
    const ease = (t: number) => (p.ease === "in" ? t * t : p.ease === "out" ? 1 - (1 - t) * (1 - t) : t);
    let px = p.from.x, py = p.from.y, acc = 0;
    effects.push({
      node: head, age: 0, delay: p.delay ?? 0, tick: (age, dt) => {
        const t = Math.min(1, age / p.seconds);
        const e = ease(t);
        const x = p.from.x + (p.to.x - p.from.x) * e;
        const y = p.from.y + (p.to.y - p.from.y) * e - (p.arc ?? 0) * 4 * t * (1 - t);
        const vx = (x - px) / Math.max(dt, 1e-3), vy = (y - py) / Math.max(dt, 1e-3);
        px = x; py = y;
        const v = Math.hypot(vx, vy);
        head.position.set(x, y);
        head.alpha = Math.min(1, t * 6);
        head.rotation = Math.atan2(vy, vx);
        // Stretched with speed, but capped: uncapped, a fast dart drew two squares
        // long and read as a laser.
        head.scale.set((p.headSize * (p.stretch ? Math.min(3.2, 1 + v * 0.004) : 1)) / TEX, (p.headSize * (p.stretch ? 0.7 : 1)) / TEX);
        acc += p.trail.rate * dt;
        while (acc >= 1) {
          acc -= 1;
          const a = rand(0, Math.PI * 2), d = rand(0, p.trail.drift);
          spawnRaw(x + rand(-3, 3), y + rand(-3, 3), Math.cos(a) * d - vx * 0.05, Math.sin(a) * d - vy * 0.05,
            rand(p.trail.life[0], p.trail.life[1]), trail, x, y);
        }
        if (t >= 1) {
          p.onArrive?.();
          return false;
        }
        return true;
      },
    });
  }

  /** Forked lightning from `a` to `b`, re-rolled every other frame. */
  function bolt(a: Pt, b: Pt, core: number, halo: number, seconds: number) {
    const g = new Graphics();
    bursts.addChild(g);
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const nx = -(b.y - a.y) / len, ny = (b.x - a.x) / len;
    let frame = 0;
    effects.push({
      node: g, age: 0, delay: 0, tick: wrap((t) => {
        if (frame++ % 2 === 0) {
          const pts: number[] = [a.x, a.y];
          const steps = 9;
          for (let i = 1; i < steps; i++) {
            const f = i / steps, j = rand(-1, 1) * len * 0.07 * Math.sin(Math.PI * f);
            pts.push(a.x + (b.x - a.x) * f + nx * j, a.y + (b.y - a.y) * f + ny * j);
          }
          pts.push(b.x, b.y);
          const fade = 1 - t;
          g.clear();
          g.poly(pts, false).stroke({ width: 12, color: halo, alpha: 0.32 * fade });
          g.poly(pts, false).stroke({ width: 3, color: core, alpha: fade });
          const i = 2 * (2 + Math.floor(Math.random() * 5));
          const fa = Math.atan2(b.y - a.y, b.x - a.x) + rand(-0.9, 0.9), fl = len * rand(0.12, 0.25);
          g.moveTo(pts[i], pts[i + 1]).lineTo(pts[i] + Math.cos(fa) * fl, pts[i + 1] + Math.sin(fa) * fl)
            .stroke({ width: 2, color: core, alpha: 0.7 * fade });
        }
        return t < 1;
      }, seconds),
    });
  }

  /** A pillar of light from `topY` down onto a card. */
  function pillar(target: Rect, topY: number, color: number, seconds: number) {
    const c = centre(target);
    const g = new Graphics();
    bursts.addChild(g);
    const w = target.w * 0.62, h = Math.max(20, c.y - topY);
    effects.push({
      node: g, age: 0, delay: 0, tick: wrap((t) => {
        const k = t < 0.12 ? t / 0.12 : 1 - (t - 0.12) / 0.88;
        g.clear()
          .rect(c.x - w / 2, topY, w, h).fill({ color, alpha: 0.22 * k })
          .rect(c.x - w * 0.14, topY, w * 0.28, h).fill({ color: 0xffffff, alpha: 0.55 * k });
        return t < 1;
      }, seconds),
    });
    glow(target, color, 0.8, seconds, 1.1);
  }

  /** A band of water rolling from the caster's edge to the far one, throwing
   *  spray off its front. */
  function sweep(R: Rect, fromTop: boolean, seconds: number, color: number, spray: Style) {
    const g = new Graphics();
    bursts.addChild(g);
    const band = R.h * 0.22;
    let acc = 0;
    effects.push({
      node: g, age: 0, delay: 0, tick: (age, dt) => {
        const t = Math.min(1, age / seconds);
        const front = fromTop ? R.y + R.h * t : R.y + R.h * (1 - t);
        const y0 = Math.max(R.y, fromTop ? front - band : front);
        const y1 = Math.min(R.y + R.h, fromTop ? front : front + band);
        g.clear();
        if (y1 > y0) {
          // Brightest at the front, fading back into the body behind it.
          const depth = y1 - y0;
          for (let i = 0; i < 3; i++) {
            const d = (depth * (i + 1)) / 3;
            const top = fromTop ? y1 - d : y0;
            g.rect(R.x, top, R.w, d).fill({ color, alpha: 0.12 });
          }
          g.rect(R.x, fromTop ? y1 - 3 : y0, R.w, 3).fill({ color: 0xdff4ff, alpha: 0.85 });
        }
        acc += 300 * dt;
        while (acc >= 1) {
          acc -= 1;
          spawnRaw(R.x + rand(0, R.w), front, rand(-50, 50), (fromTop ? 1 : -1) * rand(60, 240) - rand(40, 140),
            rand(0.3, 0.6), spray, R.x + R.w / 2, front);
        }
        return t < 1;
      },
    });
  }

  /** Wind spinning round the middle of the board. */
  function vortex(R: Rect, seconds: number, st: Style) {
    const c = centre(R);
    const reach = Math.max(R.w, R.h) * 0.55;
    const spin: Style = { ...st, gravity: 0, drag: 0.6, swirl: 1400, streak: true, size: [11, 3], life: [0.35, 0.6] };
    let acc = 0;
    effects.push({
      age: 0, delay: 0, tick: (age, dt) => {
        acc += 320 * dt;
        while (acc >= 1) {
          acc -= 1;
          const a = rand(0, Math.PI * 2), r = rand(0.35, 1) * reach, v = rand(150, 320);
          spawnRaw(c.x + Math.cos(a) * r, c.y + Math.sin(a) * r,
            -Math.sin(a) * v - Math.cos(a) * v * 0.35, Math.cos(a) * v - Math.sin(a) * v * 0.35,
            rand(0.35, 0.6), spin, c.x, c.y);
        }
        return age < seconds;
      },
    });
  }

  /** A glow that BUILDS toward the landing rather than flashing and fading. */
  function charge(at: Pt, size: number, color: number, peak: number, seconds: number) {
    const sp = new Sprite(tex);
    sp.anchor.set(0.5);
    sp.position.set(at.x, at.y);
    sp.tint = color;
    sp.alpha = 0;
    bursts.addChild(sp);
    effects.push({
      node: sp, age: 0, delay: 0, tick: wrap((t) => {
        sp.alpha = peak * t;
        sp.scale.set((size * (0.6 + 0.4 * t)) / TEX);
        return t < 1;
      }, seconds),
    });
  }

  function boardIncoming(fx: Extract<LayerFx, { kind: "boardIncoming" }>) {
    const R = fx.rect, T = fx.seconds, k = fx.strength;
    const el = STYLES[fx.element] ?? STYLES.VOID;
    const mid = centre(R);
    const sky = R.y - R.h * 0.5;
    const casterY = fx.fromTop ? R.y : R.y + R.h;
    const big = Math.max(R.w, R.h) * 1.15;
    // Aimed at the cards it will reach; with none, at a few points on the far
    // half, so an empty board still sees the spell arrive.
    const aims: Rect[] = fx.targets.length ? fx.targets : Array.from({ length: 3 }, () => {
      const w = R.w / 4, h = R.h / 4;
      return { x: R.x + rand(0, R.w - w), y: (fx.fromTop ? mid.y : R.y) + rand(0, R.h / 2 - h), w, h };
    });
    switch (fx.element) {
      case "PYRO": {
        // Meteors, each timed to strike its card on the landing frame...
        for (const a of aims)
          shot({
            from: { x: centre(a).x + rand(-0.4, 0.4) * R.w, y: sky - rand(0, R.h * 0.25) }, to: centre(a),
            seconds: T, ease: "in", head: 0xffa050, headSize: 34 * k, stretch: true,
            trail: { palette: el.palette, rate: 150 * k, size: [15, 4], life: [0.35, 0.7], drift: 40, gravity: -120 },
          });
        // ...and a few that fall wide, for the sky's sake.
        for (let i = 0; i < Math.round(3 * k); i++) {
          const to = { x: R.x + rand(0.1, 0.9) * R.w, y: R.y + rand(0.1, 0.9) * R.h };
          shot({
            from: { x: to.x + rand(-0.3, 0.3) * R.w, y: sky }, to, seconds: T * rand(0.55, 0.9), ease: "in",
            head: 0xffc080, headSize: 18 * k, stretch: true,
            trail: { palette: el.palette, rate: 40, size: [9, 2], life: [0.25, 0.5], drift: 30, gravity: -100 },
            onArrive: () => emit({ count: 26, palette: el.palette, from: { x: to.x - 10, y: to.y - 10, w: 20, h: 20 },
              speed: [80, 220], gravity: -150, drag: 0.3, life: [0.3, 0.6], size: [10, 3] }),
          });
        }
        charge(mid, big, 0xff6a2a, 0.32 * k, T);
        return;
      }
      case "AQUA":
        // The wave, from the caster's side of the board to the far edge.
        sweep(R, fx.fromTop, T, 0x4d94e8, { ...el, drag: 0.4, gravity: 600, life: [0.3, 0.6], size: [10, 3], streak: false });
        charge(mid, big, 0x4d94e8, 0.22 * k, T);
        return;
      case "BOLT": {
        // The storm gathers: crackle along the board's edges, quickening.
        const n = Math.round(12 * k);
        const onEdge = (): Pt => {
          const side = Math.floor(rand(0, 4));
          return side < 2
            ? { x: R.x + rand(0, R.w), y: side === 0 ? R.y : R.y + R.h }
            : { x: side === 2 ? R.x : R.x + R.w, y: R.y + rand(0, R.h) };
        };
        for (let i = 0; i < n; i++)
          later(T * Math.sqrt(i / n), () => {
            const p = onEdge();
            addArcs(p.x, p.y, el, 0.8, 3);
          });
        for (let i = 1; i <= 3; i++) later(T * (0.3 + 0.2 * i) - 0.05, () => glow(R, 0xb9a6ff, 0.22, 0.12, 1.25));
        charge(mid, big, 0x9575ff, 0.28 * k, T);
        return;
      }
      case "GALE":
        vortex(R, T, el);
        charge(mid, big, 0xffa040, 0.18 * k, T);
        return;
      case "BORE":
        // Rocks, heavy and accelerating, onto each card.
        for (const a of aims)
          shot({
            from: { x: centre(a).x + rand(-0.1, 0.1) * R.w, y: R.y - R.h * rand(0.12, 0.22) }, to: centre(a),
            seconds: T, ease: "in", head: 0xd9b48a, headSize: 34 * k,
            trail: { palette: [0xfff1dc, 0xd9b48a, 0xa1887f], rate: 45 * k, size: [14, 6], life: [0.3, 0.7], drift: 25, gravity: 200 },
          });
        // Dust shaken loose above the board.
        emit({ count: Math.round(50 * k), palette: [0xfff1dc, 0xd9b48a, 0xa1887f], from: { x: R.x, y: R.y, w: R.w, h: R.h * 0.35 },
          dir: [80, 100], speed: [40, 120], gravity: 500, drag: 0.4, life: [0.4, 0.8], size: [9, 3] });
        return;
      case "DAWN": {
        // A sun gathering above the board, drawing the light in.
        const sun = { x: mid.x, y: R.y + R.h * 0.06 };
        charge(sun, R.w * 0.9 * k, 0xffd54f, 0.9, T);
        const s = R.w * 0.8;
        emit({ count: Math.round(70 * k), palette: [0xffffff, 0xfff1b3, 0xffd54f], from: { x: sun.x - s / 2, y: sun.y - s / 2, w: s, h: s },
          at: "ring", speed: [160, 260], gravity: 0, drag: 1, life: [0.4, T], size: [10, 3] });
        return;
      }
      case "DUSK": {
        // Night closing in from every edge of the board — real darkness, on
        // the normal-blend layer, deepening until the spell lands.
        const dark = new Sprite(vignette);
        dark.anchor.set(0.5);
        dark.position.set(mid.x, mid.y);
        dark.alpha = 0;
        shade.addChild(dark);
        effects.push({
          node: dark, age: 0, delay: 0, tick: wrap((t) => {
            dark.alpha = 0.9 * t;
            dark.scale.set((R.w * (1.6 - 0.45 * t)) / 128, (R.h * (1.6 - 0.45 * t)) / 128);
            return t < 1;
          }, T),
        });
        for (let i = 0; i < 3; i++)
          later((T * i) / 3, () => emit({ count: Math.round(60 * k), palette: el.palette.slice(1), from: R, at: "edge",
            speed: [120, 240], gravity: 0, drag: 1, life: [0.3, T], size: [14, 5] }));
        return;
      }
      case "LEAF":
        // Roots, from the caster's side of the board to each card they take.
        for (const a of aims) {
          const c = centre(a);
          shot({
            from: { x: c.x + rand(-0.15, 0.15) * R.w, y: casterY }, to: c, seconds: T, ease: "out",
            head: 0xb6f27a, headSize: 14,
            trail: { palette: [0xd8ffb0, 0x8fd66a, 0x3f8a3a], rate: 170, size: [12, 5], life: [0.5, 0.9], drift: 12 },
          });
        }
        emit({ count: Math.round(40 * k), palette: [0xd8ffb0, 0x8fd66a, 0x4caf6d], from: R, speed: [30, 90],
          gravity: 40, drag: 0.5, life: [0.8, 1.2], size: [12, 5], swirl: 200 });
        return;
      default:
        charge(mid, big, el.palette[2], 0.3 * k, T);
    }
  }

  function boardFinale(fx: Extract<LayerFx, { kind: "boardFinale" }>) {
    const R = fx.rect, k = fx.strength;
    const el = STYLES[fx.element] ?? STYLES.VOID;
    const mid = centre(R);
    const sky = R.y - R.h * 0.5;
    const casterY = fx.fromTop ? R.y : R.y + R.h;
    switch (fx.element) {
      case "PYRO":
        // The board left burning: embers lifting off all of it.
        glow(R, 0xff8a3a, 0.5 * k, 0.7, 1.3);
        emit({ count: Math.round(110 * k), palette: el.palette, from: R, dir: [-120, -60], speed: [40, 160],
          gravity: -120, drag: 0.4, life: [0.7, 1.4], size: [9, 2] });
        return;
      case "AQUA":
        // The wave breaks: a ripple out from the middle, spray thrown up.
        glow(R, 0x4d94e8, 0.45 * k, 0.7, 1.3);
        ring(R, 0x9fe3ff, 0.2, 1.25, 0.8, 6);
        emit({ count: Math.round(140 * k), palette: el.palette, from: R, dir: [-150, -30], speed: [120, 320],
          gravity: 900, drag: 0.5, life: [0.5, 1.0], size: [10, 4] });
        return;
      case "BOLT":
        // The strike: every card it reaches hit from the sky at once, in a flash.
        glow(R, 0xe8e0ff, 0.75, 0.28, 1.6);
        for (const a of fx.targets) {
          const c = centre(a);
          bolt({ x: c.x + rand(-0.15, 0.15) * R.w, y: sky }, c, 0xffffff, 0x9575ff, 0.4);
        }
        return;
      case "GALE":
        // The gust bursts outward from the eye.
        glow(R, 0xffd9a0, 0.3 * k, 0.6, 1.3);
        emit({ count: Math.round(120 * k), palette: el.palette, from: { x: mid.x - 12, y: mid.y - 12, w: 24, h: 24 },
          speed: [300, 700], gravity: 0, drag: 0.2, life: [0.4, 0.8], size: [12, 3], streak: true, swirl: 700 });
        return;
      case "BORE":
        // Dust rolling up off the whole board.
        glow(R, 0xa1887f, 0.35 * k, 0.8, 1.3);
        emit({ count: Math.round(70 * k), palette: [0xfff1dc, 0xd9b48a, 0xa1887f], from: R,
          dir: [-110, -70], speed: [20, 70], gravity: -20, drag: 0.5, life: [0.9, 1.5], size: [16, 7] });
        return;
      case "DAWN": {
        // The sun breaks: rays from it, a pillar of light onto every card.
        const sun = { x: mid.x, y: R.y + R.h * 0.06 };
        glow(R, 0xfff1b3, 0.6 * k, 0.8, 1.4);
        addRays(sun.x, sun.y, { ...el, palette: [0xffffff, 0xfff1b3, 0xffd54f] }, 1.4 * k, 16);
        for (const a of fx.targets) pillar(a, sun.y, 0xffe38a, 0.7);
        return;
      }
      case "DUSK":
        // What it takes rises off every card it struck, toward whoever cast it.
        glow(R, 0x7b4fb0, 0.45 * k, 0.8, 1.3);
        for (const a of fx.targets) {
          const c = centre(a);
          for (let i = 0; i < 3; i++)
            shot({
              from: c, to: { x: c.x + rand(-40, 40), y: casterY }, seconds: rand(0.6, 0.9), delay: rand(0, 0.2), ease: "in",
              head: 0xc9a6ff, headSize: 12,
              trail: { palette: [0xf3e8ff, 0xc9a6ff, 0x7b4fb0], rate: 50, size: [8, 2], life: [0.2, 0.45], drift: 10 },
            });
        }
        return;
      case "LEAF":
        // Leaves whirling over the whole board.
        glow(R, 0x4caf6d, 0.4 * k, 0.8, 1.3);
        emit({ count: Math.round(100 * k), palette: [0xd8ffb0, 0x8fd66a, 0x4caf6d], from: R, speed: [60, 180],
          gravity: 60, drag: 0.5, life: [0.8, 1.4], size: [12, 5], swirl: 260 });
        return;
      default:
        glow(R, el.palette[2], 0.4 * k, 0.7, 1.3);
    }
  }

  // ── CARD ATTACKS ──────────────────────────────────────────────────────────
  // DELIVERY plays in the pause before a battle turn lands and lasts exactly
  // that long: a ranged card winds up and throws, a melee card winds up while
  // the hook lunges its token, and either arrives on the landing frame. The
  // HIT plays at the landing: a burst where a shot lands, a SLASH where a
  // melee card struck. A Special winds up visibly and lands heavier.

  /** How each element's attacks look: what its ranged cards throw, and the
   *  mark its melee cards leave. */
  interface AttackLook {
    head: number;
    trail: number[];
    /** orb: a ball of it; streak: a fast dart; lob: thrown in an arc; zap:
     *  lightning does not travel — it crackles, then strikes. */
    shape: "orb" | "streak" | "lob" | "zap";
    /** arc: one sweeping cut; claw: three parallel rakes; cuts: several thin
     *  wind-cuts; smash: a blow into the ground. */
    mark: "arc" | "claw" | "cuts" | "smash";
    markColor: number;
  }
  const LOOKS: Record<Element, AttackLook> = {
    PYRO: { head: 0xffa050, trail: [0xfff4d6, 0xffc14a, 0xff6a2a, 0xc2261a], shape: "orb", mark: "arc", markColor: 0xff8a3a },
    AQUA: { head: 0xbfeaff, trail: [0xf0fbff, 0x9fe3ff, 0x4d94e8], shape: "orb", mark: "arc", markColor: 0x6ec3ff },
    BOLT: { head: 0xe3d8ff, trail: [0xffffff, 0xe3d8ff, 0x9575ff], shape: "zap", mark: "arc", markColor: 0xb9a6ff },
    GALE: { head: 0xffe8c8, trail: [0xfffaf0, 0xffd9a0, 0xffa040], shape: "streak", mark: "cuts", markColor: 0xffd9a0 },
    BORE: { head: 0xd9b48a, trail: [0xfff1dc, 0xd9b48a, 0xa1887f], shape: "lob", mark: "smash", markColor: 0xd9b48a },
    DAWN: { head: 0xfff1b3, trail: [0xffffff, 0xfff1b3, 0xffd54f], shape: "streak", mark: "arc", markColor: 0xffe38a },
    DUSK: { head: 0xc9a6ff, trail: [0xf3e8ff, 0xc9a6ff, 0x7b4fb0], shape: "orb", mark: "claw", markColor: 0xb07cff },
    LEAF: { head: 0xb6f27a, trail: [0xf4ffe6, 0xb6f27a, 0x4caf6d], shape: "streak", mark: "arc", markColor: 0x8fd66a },
    VOID: { head: 0xe3e7f1, trail: [0xffffff, 0xe3e7f1, 0xc2c8d8], shape: "orb", mark: "arc", markColor: 0xc2c8d8 },
  };

  const lerpPt = (a: Pt, b: Pt, t: number): Pt => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

  function attackIn(fx: Extract<LayerFx, { kind: "attack" }>) {
    const look = LOOKS[fx.element] ?? LOOKS.VOID;
    const T = fx.seconds;
    const wind = T * (fx.special ? 0.45 : 0.35);
    const travel = T - wind;
    const from = centre(fx.from);
    const size = Math.min(fx.from.w, fx.from.h);
    if (fx.arriving) {
      // Arriving: the square it will land on is still empty, so the element
      // GATHERS there — drawn in from around it, building — and the strike
      // comes out of that.
      charge(from, size * (fx.special ? 1.9 : 1.4), look.head, fx.special ? 0.95 : 0.6, T);
      emit({ count: fx.special ? 40 : 24, palette: look.trail, from: fx.from, at: "ring", speed: [100, 180], gravity: 0,
        drag: 1, life: [0.2, wind], size: [10, 3] });
    } else {
      // The wind-up: the attacker gathers itself — visibly more for a Special,
      // which also draws its element in around it.
      charge(from, size * (fx.special ? 1.7 : 1.1), look.head, fx.special ? 0.85 : 0.4, wind + travel * 0.3);
      if (fx.special)
        emit({ count: 28, palette: look.trail, from: fx.from, at: "ring", speed: [110, 190], gravity: 0, drag: 1,
          life: [0.2, wind], size: [9, 3] });
    }
    for (const t of fx.targets) {
      const to = centre(t);
      if (fx.melee) {
        // The swing's path, shadowing the token as the hook lunges it — or,
        // for a card arriving with no token yet, the whole pounce.
        shot({
          from, to: fx.arriving ? to : lerpPt(from, to, 0.55), seconds: travel, delay: wind, ease: "in",
          head: look.head, headSize: size * 0.2,
          trail: { palette: look.trail, rate: fx.special ? 130 : 60, size: [10, 3], life: [0.15, 0.35], drift: 20 },
        });
        continue;
      }
      if (look.shape === "zap") {
        // Lightning does not fly: it crackles on the caster, then strikes on
        // the landing frame.
        addArcs(from.x, from.y, STYLES.BOLT, fx.special ? 0.8 : 0.5, 3);
        later(Math.max(0, T - 0.06), () => bolt(from, to, 0xffffff, 0x9575ff, fx.special ? 0.35 : 0.22));
        continue;
      }
      const dist = Math.hypot(to.x - from.x, to.y - from.y);
      shot({
        from, to, seconds: travel, delay: wind,
        ease: look.shape === "lob" ? "linear" : "in",
        arc: look.shape === "lob" ? dist * 0.35 : 0,
        head: look.head, headSize: size * (fx.special ? 0.42 : 0.26), stretch: look.shape === "streak",
        trail: { palette: look.trail, rate: fx.special ? 170 : 80, size: fx.special ? [13, 4] : [9, 3], life: [0.2, 0.45], drift: 18 },
      });
    }
  }

  /** A curved cut drawn quickly through a point, then fading: a sweeping arc
   *  across `angle`, bulging to one side. */
  function arcCut(c: Pt, reach: number, angle: number, color: number, width: number, draw: number, hold: number, bulge = 0.35) {
    const g = new Graphics();
    bursts.addChild(g);
    const dx = Math.cos(angle) * reach, dy = Math.sin(angle) * reach;
    const p0 = { x: c.x - dx, y: c.y - dy }, p2 = { x: c.x + dx, y: c.y + dy };
    const ctrl = { x: c.x - dy * bulge * 2, y: c.y + dx * bulge * 2 };
    const at = (t: number): Pt => ({
      x: (1 - t) * (1 - t) * p0.x + 2 * (1 - t) * t * ctrl.x + t * t * p2.x,
      y: (1 - t) * (1 - t) * p0.y + 2 * (1 - t) * t * ctrl.y + t * t * p2.y,
    });
    effects.push({
      node: g, age: 0, delay: 0, tick: (age) => {
        const drawn = Math.min(1, age / draw);
        const fade = age <= draw ? 1 : Math.max(0, 1 - (age - draw) / hold);
        const pts: number[] = [];
        const n = 14;
        for (let i = 0; i <= n; i++) { const p = at((i / n) * drawn); pts.push(p.x, p.y); }
        g.clear();
        if (pts.length >= 4) {
          g.poly(pts, false).stroke({ width: width * 3, color, alpha: 0.25 * fade });
          g.poly(pts, false).stroke({ width, color, alpha: 0.9 * fade });
          g.poly(pts, false).stroke({ width: Math.max(1, width * 0.35), color: 0xffffff, alpha: fade });
        }
        return age < draw + hold;
      },
    });
  }

  /** Straight rakes drawn quickly, then fading — claw marks. */
  function rakes(c: Pt, reach: number, angle: number, color: number, count: number, gap: number, width: number) {
    const g = new Graphics();
    bursts.addChild(g);
    const ux = Math.cos(angle), uy = Math.sin(angle);
    const nx = -uy, ny = ux;
    const draw = 0.09, hold = 0.3;
    effects.push({
      node: g, age: 0, delay: 0, tick: (age) => {
        const drawn = Math.min(1, age / draw);
        const fade = age <= draw ? 1 : Math.max(0, 1 - (age - draw) / hold);
        g.clear();
        for (let i = 0; i < count; i++) {
          const off = (i - (count - 1) / 2) * gap;
          const sx = c.x - ux * reach + nx * off, sy = c.y - uy * reach + ny * off;
          const ex = sx + ux * reach * 2 * drawn, ey = sy + uy * reach * 2 * drawn;
          g.moveTo(sx, sy).lineTo(ex, ey).stroke({ width: width * 2.6, color, alpha: 0.25 * fade });
          g.moveTo(sx, sy).lineTo(ex, ey).stroke({ width, color, alpha: 0.95 * fade });
        }
        return age < draw + hold;
      },
    });
  }

  /** A summon materialising on its square as its strike lands: a burst of its
   *  element outward from where it gathered. */
  function arrive(fx: Extract<LayerFx, { kind: "arrive" }>) {
    const look = LOOKS[fx.element] ?? LOOKS.VOID;
    const c = centre(fx.rect);
    glow(fx.rect, look.head, 0.8, 0.45, 1.25);
    ring(fx.rect, look.markColor, 0.3, 1.3, 0.45, 5);
    emit({ count: 34, palette: look.trail, from: { x: c.x - 8, y: c.y - 8, w: 16, h: 16 }, speed: [120, 300],
      gravity: 0, drag: 0.3, life: [0.25, 0.5], size: [10, 3] });
  }

  function slash(fx: Extract<LayerFx, { kind: "slash" }>) {
    const look = LOOKS[fx.element] ?? LOOKS.VOID;
    const c = centre(fx.rect);
    const k = Math.max(0.6, Math.min(2.2, fx.strength));
    const reach = Math.min(fx.rect.w, fx.rect.h) * (fx.special ? 0.62 : 0.46) * (0.85 + k * 0.15);
    // The cut runs ACROSS the line of attack, a little off square so it
    // reads as a swing rather than a plus sign.
    const across = fx.angle + Math.PI / 2 + 0.45;
    const width = fx.special ? 7 : 5;
    switch (look.mark) {
      case "arc":
        arcCut(c, reach, across, look.markColor, width, 0.09, 0.28);
        if (fx.special) arcCut(c, reach, across + Math.PI / 2, look.markColor, width, 0.09, 0.32, -0.35);
        break;
      case "claw":
        rakes(c, reach * 0.9, across, look.markColor, fx.special ? 4 : 3, reach * 0.3, width * 0.7);
        break;
      case "cuts":
        for (let i = 0; i < (fx.special ? 5 : 3); i++)
          arcCut(c, reach * rand(0.7, 1.05), across + rand(-0.5, 0.5), look.markColor, width * 0.55, 0.07, 0.25, rand(-0.3, 0.3));
        break;
      case "smash":
        ring(fx.rect, look.markColor, 0.25, fx.special ? 1.3 : 0.95, 0.4, 6);
        emit({ count: Math.round((fx.special ? 34 : 18) * k), palette: look.trail, from: { x: c.x - 8, y: c.y - 8, w: 16, h: 16 },
          dir: [-160, -20], speed: [120, 300], gravity: 900, drag: 0.5, life: [0.35, 0.7], size: [11, 5] });
        break;
    }
    // Sparks thrown off the blow, in the element's colours.
    emit({ count: Math.round((fx.special ? 36 : 16) * k), palette: look.trail, from: { x: c.x - 6, y: c.y - 6, w: 12, h: 12 },
      speed: [120, 320], gravity: 300, drag: 0.4, life: [0.2, 0.45], size: [8, 2], streak: true });
    if (fx.special) {
      glow(fx.rect, look.markColor, 0.55, 0.4, 1.3);
      ring(fx.rect, look.markColor, 0.4, 1.35, 0.45, 5);
    }
  }

  function play(fx: LayerFx) {
    const el = STYLES[fx.element] ?? STYLES.VOID;
    switch (fx.kind) {
      case "heal": {
        // Light rising off the card — gentle, and in the caster's colour over
        // a living green, so a DAWN heal is gold and a LEAF one is leaf.
        const k = Math.max(0.7, Math.min(2.2, fx.strength));
        emit({ count: Math.round(28 * k), palette: [0xffffff, 0xe4ffd2, el.palette[2]], from: fx.rect, at: "bottom",
          dir: [-105, -75], speed: [50, 140], gravity: -90, drag: 0.5, life: [0.8, 1.4], size: [11, 3] });
        glow(fx.rect, 0xc8ffb0, 0.45, 0.8);
        break;
      }
      case "shield": {
        const color = el.palette[1];
        ring(fx.rect, color, 1.35, 0.95, 0.35, 5);
        later(0.18, () => ring(fx.rect, 0xffffff, 1.0, 1.05, 0.6, 3));
        emit({ count: 18, palette: [0xffffff, color], from: fx.rect, at: "ring", speed: [40, 80], gravity: 0,
          drag: 0.9, life: [0.4, 0.6], size: [8, 3] });
        break;
      }
      case "status":
        status(fx.rect, fx.status, el);
        break;
      case "buff":
        emit({ count: 22, palette: [0xffe38a, 0xffc14a, 0xff9a2a], from: fx.rect, at: "bottom", dir: [-95, -85],
          speed: [180, 320], gravity: 0, drag: 0.2, life: [0.35, 0.6], size: [10, 3], streak: true });
        break;
      case "debuff":
        // Purple, not grey: under additive blending a dark colour is no colour.
        emit({ count: 22, palette: [0xc070ff, 0x8a48d0, 0x5a2a90], from: { ...fx.rect, h: fx.rect.h * 0.2 },
          dir: [85, 95], speed: [160, 280], gravity: 0, drag: 0.2, life: [0.35, 0.6], size: [10, 3], streak: true });
        break;
      case "move": {
        // Dissolve where it stood, gather where it lands, a thread between.
        emit({ count: 26, palette: el.palette, from: fx.from, speed: [60, 160], gravity: 0, drag: 0.3,
          life: [0.3, 0.6], size: [10, 3] });
        const g = new Graphics();
        bursts.addChild(g);
        const a = { x: fx.from.x + fx.from.w / 2, y: fx.from.y + fx.from.h / 2 };
        const b = { x: fx.to.x + fx.to.w / 2, y: fx.to.y + fx.to.h / 2 };
        effects.push({
          node: g, age: 0, delay: 0, tick: wrap((t) => {
            g.clear().moveTo(a.x, a.y).lineTo(a.x + (b.x - a.x) * Math.min(1, t * 2), a.y + (b.y - a.y) * Math.min(1, t * 2))
              .stroke({ width: 3, color: el.palette[1], alpha: 0.7 * (1 - t) });
            return t < 1;
          }, 0.5),
        });
        later(0.18, () => emit({ count: 30, palette: el.palette, from: fx.to, at: "ring", speed: [120, 200],
          gravity: 0, drag: 0.9, life: [0.3, 0.5], size: [10, 3] }));
        break;
      }
      case "wall": {
        // A curtain rising off the whole row, in the wall's element.
        band(fx.rect, el.palette[2], 0.9);
        emit({ count: Math.round(fx.rect.w / 5), palette: el.palette, from: fx.rect, at: "bottom", dir: [-100, -80],
          speed: [140, 380], gravity: el.gravity > 0 ? 200 : -100, drag: 0.3, life: [0.4, 0.9], size: [12, 3],
          streak: el.streak });
        break;
      }
      case "field": {
        // The weather changes: three waves across the whole board.
        band(fx.rect, el.palette[2], 1.2);
        const rain = el.gravity > 500; // AQUA, BORE: it comes down
        for (let w = 0; w < 3; w++)
          later(w * 0.25, () => emit({
            count: 70, palette: el.palette, from: fx.rect,
            dir: rain ? [80, 100] : el.gravity < 0 ? [-110, -70] : [0, 360],
            speed: rain ? [300, 520] : [30, 120], gravity: rain ? 600 : el.gravity * 0.3, drag: 0.4,
            life: [0.6, 1.2], size: rain ? [9, 3] : [10, 3], streak: rain || el.streak, swirl: el.swirl,
          }));
        break;
      }
      case "trapSet":
        // Sinking into the square: gathered in, then a ring that closes.
        emit({ count: 22, palette: [0xffffff, el.palette[1], el.palette[2]], from: fx.rect, at: "ring",
          speed: [100, 170], gravity: 0, drag: 0.9, life: [0.3, 0.5], size: [9, 3] });
        later(0.3, () => ring(fx.rect, el.palette[2], 0.9, 0.2, 0.4, 3));
        break;
      case "attack":
        attackIn(fx);
        break;
      case "slash":
        slash(fx);
        break;
      case "arrive":
        arrive(fx);
        break;
      case "boardIncoming":
        boardIncoming(fx);
        break;
      case "boardFinale":
        boardFinale(fx);
        break;
      case "pulse":
        band(fx.rect, el.palette[1], 0.8);
        emit({ count: 40, palette: el.palette, from: fx.rect, speed: [80, 200], gravity: 0, drag: 0.3,
          life: [0.4, 0.8], size: [10, 3] });
        break;
    }
    if (!app.ticker.started) app.ticker.start();
  }

  let lastCount = 0;
  function update() {
    const dt = Math.min(app.ticker.deltaMS / 1000, 1 / 20); // a hitch must not teleport sparks
    for (let i = live.length - 1; i >= 0; i--) {
      const s = live[i];
      s.age += dt;
      if (s.age >= s.life) {
        // Swap-remove, keeping `live` and the container's child list aligned.
        const last = live.length - 1;
        live[i] = live[last];
        sparks.particleChildren[i] = sparks.particleChildren[last];
        live.pop();
        sparks.particleChildren.pop();
        pool.push(s);
        continue;
      }
      const st = s.style;
      if (st.swirl) {
        const dx = s.p.x - s.ox, dy = s.p.y - s.oy;
        const r = Math.hypot(dx, dy) || 1;
        s.vx += (-dy / r) * st.swirl * dt;
        s.vy += (dx / r) * st.swirl * dt;
      }
      s.vy += st.gravity * dt;
      const keep = Math.pow(st.drag, dt);
      s.vx *= keep;
      s.vy *= keep;
      s.p.x += s.vx * dt;
      s.p.y += s.vy * dt;
      const t = s.age / s.life;
      const size = s.s0 + (s.s1 - s.s0) * t;
      if (st.streak) {
        const v = Math.hypot(s.vx, s.vy);
        s.p.rotation = Math.atan2(s.vy, s.vx);
        s.p.scaleX = (size * (1 + v * 0.01)) / TEX;
        s.p.scaleY = (size * 0.5) / TEX;
      } else {
        s.p.scaleX = s.p.scaleY = size / TEX;
      }
      const pal = st.palette;
      s.p.tint = pal[Math.min(pal.length - 1, Math.floor(t * pal.length))];
      s.p.alpha = Math.pow(1 - t, 1.4);
    }
    for (let i = effects.length - 1; i >= 0; i--) {
      const e = effects[i];
      if (e.delay > 0) { e.delay -= dt; continue; }
      e.age += dt;
      if (!e.tick(e.age, dt)) {
        e.node?.destroy();
        effects.splice(i, 1);
      }
    }
    if (live.length !== lastCount) {
      sparks.update();
      lastCount = live.length;
    }
    // Idle -> no render loop at all. This frame still renders (the render
    // listener runs after this one), so the canvas is left empty, not frozen
    // on the last sparks.
    if (live.length === 0 && effects.length === 0) app.ticker.stop();
  }
  app.ticker.add(update);

  return {
    impact(x, y, element, strength = 1) {
      const st = STYLES[element] ?? STYLES.VOID;
      const k = Math.max(0.5, Math.min(2.4, strength));
      if (st.implode) {
        // Gather first, burst when they arrive — the one element whose hit
        // has a wind-up, because shadow collapsing IN is what DUSK is.
        const n = Math.round(st.sparks * 0.5 * k);
        for (let i = 0; i < n; i++) spawnSpark(x, y, st, k, rand(0, Math.PI * 2), true);
        const later = new Graphics();
        bursts.addChild(later);
        effects.push({
          node: later, age: 0, delay: 0.26, tick: () => {
            burst(x, y, st, k, Math.round(st.sparks * k));
            addFlash(x, y, st, k);
            addRing(x, y, st, k);
            return false;
          },
        });
      } else {
        burst(x, y, st, k, Math.round(st.sparks * k));
        addFlash(x, y, st, k);
        addRing(x, y, st, k);
        addRing(x, y, st, k * 0.6, 0.08);
      }
      if (st.arcs) addArcs(x, y, st, k, st.arcs);
      if (st.rays) addRays(x, y, st, k, st.rays);
      if (st.embers) {
        // The second wave: slow, rising, long-lived. It is what a hit leaves
        // behind, and it is most of why the burst feels like it had weight.
        const ember: Style = { ...st, speed: [40, 160], gravity: -120, life: [0.8, 1.6], size: [7, 2], streak: false };
        burst(x, y, ember, k, Math.round(st.embers * k));
      }
      if (!app.ticker.started) app.ticker.start();
    },
    play,
    get live() { return live.length; },
    fps: () => app.ticker.FPS,
    setCap(n) { cap = n; },
    destroy() {
      app.ticker.stop();
      app.destroy(true, { children: true });
    },
  };
}

function noopLayer(): ImpactLayer {
  return { impact() {}, play() {}, live: 0, fps: () => 0, setCap() {}, destroy() {} };
}
