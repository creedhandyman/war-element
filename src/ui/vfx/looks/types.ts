/** THE CONTRACT BETWEEN THE EFFECTS LAYER AND AN ELEMENT'S LOOK.
 *
 *  impact-layer.ts owns the canvas, the particle system and the clock; it knows
 *  WHEN something happens and WHERE. An element's look (one file per element in
 *  this folder) decides what it looks LIKE — what a PYRO card throws, the mark a
 *  BORE blow leaves, how an AQUA shield goes up — composed from the drawing
 *  primitives below. A look never touches Pixi's stage directly: everything it
 *  draws goes through `FxTools`, so the layer can still count, cap and dispose
 *  of it, and an idle board still costs nothing. */
import type { Graphics } from "pixi.js";
import type { Element } from "../../../engine";
import type { Rect } from "../impact-layer";

export type Pt = { x: number; y: number };

/** A card that looks unlike the rest of its element: an AQUA card that is
 *  ice rather than water (see spell-fx.ts `lookVariant`). */
export type LookVariant = "ice";

/** How a spark moves and ages: born at palette[0], walking the list as it
 *  ages, so a burst reads as heat cooling rather than confetti. */
export interface SparkStyle {
  palette: number[];
  gravity: number;          // px/s², + falls, - rises
  drag: number;             // fraction of velocity kept per second
  size: [number, number];   // px at birth -> px at death
  streak: boolean;          // stretched along its velocity (fast) vs round (embers, drops)
  swirl?: number;           // tangential push around its origin, px/s²
}

/** A batch of sparks born in (or around) a rect. */
export interface Emit {
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

/** A glowing head flown from `from` to `to` in exactly `seconds`, shedding a
 *  trail as it goes. */
export interface Shot {
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

/** The drawing primitives a look composes. Every one is fire-and-forget: it
 *  schedules itself on the layer's clock and disposes of itself when done. */
export interface FxTools {
  /** The element this look is drawing — and its impact style, for anything
   *  that should match the element's standard hit (see STYLES). */
  readonly element: Element;
  readonly style: SparkStyle & { speed: [number, number]; life: [number, number] };
  emit(e: Emit): void;
  /** One spark with an exact velocity: for shapes `emit` cannot make (a fan,
   *  a spray along a line, a ring of drops). `origin` is what `swirl` turns
   *  around; default the birth point. */
  spark(x: number, y: number, vx: number, vy: number, life: number, style: SparkStyle, origin?: Pt): void;
  shot(p: Shot): void;
  /** A soft glow over a rect: fast in, slow out. `scale` is its size against
   *  the rect's longer side. */
  glow(r: Rect, color: number, peak: number, seconds: number, scale?: number): void;
  /** A ring around a rect's centre, from `r0` to `r1` times its half-size. */
  ring(r: Rect, color: number, r0: number, r1: number, seconds: number, width?: number): void;
  /** A band of light filling a rect: fast in, slow out. */
  band(r: Rect, color: number, seconds: number): void;
  /** A glow at a point that BUILDS toward the end rather than flashing. */
  charge(at: Pt, size: number, color: number, peak: number, seconds: number): void;
  /** A flash at a point, sized by `strength` (~1 = a normal hit). */
  flash(at: Pt, color: number, strength: number, delay?: number): void;
  /** Run `fn` after `seconds` on the layer's clock. */
  later(seconds: number, fn: () => void): void;
  /** A curved cut drawn quickly through `c` across `angle`, then fading. */
  arcCut(c: Pt, reach: number, angle: number, color: number, width: number, draw: number, hold: number, bulge?: number): void;
  /** Straight parallel rakes (claw marks) through `c` along `angle`. */
  rakes(c: Pt, reach: number, angle: number, color: number, count: number, gap: number, width: number): void;
  /** Forked lightning from `a` to `b`, re-rolled every other frame. */
  bolt(a: Pt, b: Pt, core: number, halo: number, seconds: number): void;
  /** Jagged lightning branches crackling out of a point. `palette` [core, _, halo]. */
  arcs(at: Pt, palette: number[], strength: number, n: number): void;
  /** Long radiant spokes out of a point, turning slowly. `palette[1]` colours them. */
  rays(at: Pt, palette: number[], strength: number, n: number): void;
  /** Anything else, drawn by hand: `fn` runs every frame for `seconds` with
   *  `t` in 0..1, on a Graphics cleared before each call. ADDITIVE by default
   *  (light: a dark colour draws nothing); `dark: true` draws on the normal-
   *  blend layer beneath, which is the only way to put shadow on the board. */
  draw(seconds: number, fn: (g: Graphics, t: number, dt: number) => void, opts?: { delay?: number; dark?: boolean }): void;
}

// ── What each hook is handed ─────────────────────────────────────────────────

/** An attack's delivery, before the landing. It lasts exactly `T` seconds —
 *  the landing (and the hit effects) come on the frame it ends. The first
 *  `wind` seconds are the wind-up; the throw or swing takes the rest. */
export interface Delivery {
  /** The attacker's square — or, for a summon striking as it lands, the
   *  empty square it is landing on. */
  rect: Rect;
  at: Pt;
  /** The square's side, px: scale everything to it. */
  size: number;
  T: number;
  wind: number;
  special: boolean;
  melee: boolean;
}

export interface Throw {
  from: Pt;
  to: Pt;
  /** Leaves after `delay`, and MUST arrive at `to` exactly `seconds` later —
   *  delay + seconds is the landing frame. */
  delay: number;
  seconds: number;
  special: boolean;
  /** The attacker's square side, px. */
  size: number;
}

export interface Swing extends Throw {
  /** The target's centre. `to` is where the swing's path ends: most of the
   *  way there for a card on the board (the token lunges along it), the whole
   *  way for a summon pouncing as it lands. */
  target: Pt;
  arriving: boolean;
}

/** A Special melee blow landing. */
export interface Mark {
  rect: Rect;
  c: Pt;
  /** Half-length of the mark, px — sized to sit inside the square. */
  reach: number;
  /** The line of attack (screen radians, attacker -> target)... */
  angle: number;
  /** ...and across it, a little off square, which is where a cut runs. */
  across: number;
  /** ~0.6-2.2, from the damage dealt. */
  k: number;
}

// ── A look ───────────────────────────────────────────────────────────────────

export interface ElementLook {
  /** The element's signature colour for marks — the basic melee X is drawn
   *  in it. Must read on a near-black board under additive light. */
  readonly markColor: number;
  /** The attacker gathering itself for `wind + (T - wind) * 0.3` — visibly more
   *  for a Special, least for a basic melee swing, where the token's own lunge
   *  is the wind-up. */
  windUp(t: FxTools, d: Delivery): void;
  /** A summon's strike gathering on the EMPTY square it lands on, for all of
   *  `T` — the element drawn in there, and the strike comes out of it. */
  gather(t: FxTools, d: Delivery): void;
  /** What a ranged card throws, at one target. */
  projectile(t: FxTools, s: Throw): void;
  /** A melee card's swing path, shadowing the lunge. */
  swing(t: FxTools, s: Swing): void;
  /** The mark a Special melee blow leaves on the card it hits. (A BASIC melee
   *  hit is a small upright X for every element — the owner's call — drawn by
   *  the layer; see `xSparks`.) */
  mark(t: FxTools, m: Mark): void;
  /** The few sparks thrown off a basic melee X, `count` of them: the X stays
   *  small and plain, but its sparks can move like the element does. */
  xSparks(t: FxTools, c: Pt, count: number): void;
  /** A summon that struck, materialising on its square as the hits land. */
  arrive(t: FxTools, r: Rect): void;
  /** Extra character on the element's standard damage burst (a spell's damage
   *  or a ranged hit), which is already the element's own — so keep it light. */
  impactAccent?(t: FxTools, at: Pt, k: number): void;
  shield(t: FxTools, r: Rect): void;
  heal(t: FxTools, r: Rect, k: number): void;
  /** A wall raised along a row. */
  wall(t: FxTools, r: Rect): void;
  /** A card crossing this element's wall and paying for it. Optional: without
   *  one, the element's standard damage burst plays on the card. */
  wallBite?(t: FxTools, r: Rect): void;
  /** The whole board's weather changing. */
  field(t: FxTools, r: Rect): void;
  /** A card moved (pushed, pulled, swapped) from one square to another. */
  move(t: FxTools, from: Rect, to: Rect): void;
  /** The viewer's own trap going into a square. */
  trapSet(t: FxTools, r: Rect): void;
  /** A row effect's line. */
  pulse(t: FxTools, r: Rect): void;
}
