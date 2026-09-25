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
  | { kind: "pulse"; rect: Rect; element: Element };

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
  const bursts = new Container({ blendMode: "add" });
  const sparks = new ParticleContainer({
    texture: tex,
    blendMode: "add",
    dynamicProperties: { position: true, vertex: true, rotation: true, color: true },
  });
  app.stage.addChild(bursts, sparks);

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
    /** Where sparks are born: anywhere in the rect, along its bottom edge, or
     *  on a ring around its centre moving INWARD (a gathering). */
    from: Rect;
    at?: "area" | "bottom" | "ring";
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
