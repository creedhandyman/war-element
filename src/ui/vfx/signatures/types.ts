/** A MYTHIC CARD'S SIGNATURE — the one move it is known for, drawn as itself.
 *
 *  Every other attack is drawn in its element's look (looks/): a PYRO card
 *  throws fire, a BORE card hurls rock. A mythic is the card a player chased,
 *  and its Special is the move on its art — Kraken's Black Wave Crash,
 *  Skyrend's Dive Bomb, the Shadow Horsemen riding through a line. So a
 *  mythic's Special, and the strike it makes as it lands when it has one, is
 *  drawn by its own module here, from the same primitives the looks use.
 *
 *  What happened is still read off the state change (spell-fx.ts, the
 *  "signature" effect): a signature is handed where the card stood and where
 *  it ended, what it reached (what each took, and whether it died), what it
 *  raised, its allies, and which way is "ahead" for it. It decides only what
 *  that LOOKS like. Statuses, shields knocked off and the damage numbers still
 *  play over it: those are meaning-coded, the same for every card. */
import type { Rect } from "../impact-layer";
import type { FxTools, Pt } from "../looks/types";

export interface SigMoment {
  /** The card's square as it acted — for a summon, the square it lands on. */
  from: Rect;
  /** Where it ends the step: a charge, a dive or a ride moves it; otherwise
   *  the same square as `from`. */
  to: Rect;
  /** Opposing cards it reached (hurt, statused, or that dodged it)... */
  targets: Rect[];
  /** ...what each took, as a scale (spell-fx.ts `shotPower`: 1 for a typical
   *  Special hit, 0.55 for a graze or a miss, up to 2)... */
  power: number[];
  /** ...and whether it died. Known at the landing; all false in a delivery. */
  killed: boolean[];
  /** Cards it brought onto the board this step (an Heir, a Risen Drake).
   *  Known at the landing; empty in a delivery. */
  spawned: Rect[];
  /** Its side's other cards on the board. Known at the landing. */
  allies: Rect[];
  /** Unit vector, screen space: "ahead" for this card, toward the enemy's
   *  home row. The board flips for a P2 viewer, so never assume "up". */
  ahead: Pt;
  /** The whole board, for a set piece that spans it. */
  board: Rect;
  /** Summoned this step: the strike it makes as it lands (Pyrogon arriving
   *  already burning, Supernova's first light), from its landing square. */
  arriving: boolean;
  /** A square's side, px — scale everything to it (phones are ~55-90px). */
  size: number;
}

export interface Signature {
  /** THE DELIVERY, in place of the element's wind-up and throw. It lasts
   *  exactly `seconds` (0.45 for a player's own turn, 0.6-0.75 for the AI's),
   *  and the landing comes on the frame it ends. Optional: without it the
   *  element's delivery plays and only the landing is the card's own. Not
   *  called for a Special that aims at nothing (a self-buff): that one is all
   *  landing. */
  deliver?(t: FxTools, m: SigMoment, seconds: number): void;
  /** THE LANDING, drawn instead of the per-target hit marks. Keep it to about
   *  1.2s: the game waits for effects to play out before its next step, and
   *  that wait is capped. */
  land(t: FxTools, m: SigMoment): void;
  /** Board shake on landing: 0 for none, 1-2 for a Special's weight. Default
   *  1.2. */
  shake?: number;
  /** A melee card's token lunges toward its target during the delivery. False
   *  for a signature that draws its own charge, or that keeps its card still.
   *  Default true. */
  lunge?: boolean;
}
