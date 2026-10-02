// AN AURA LANDING, SEEN. A card that projects an aura arrived like any other:
// the numbers on its allies changed and nothing said why. Now the card glows as
// it lands, the glow spreads to every card its aura reaches, nearest first, and
// then all of it fades. Owner, 2026-10-02: "Glow animation when a card with an
// aura shows up. Allow that card to glow and the card that it affects glows as
// well. Only for a moment."
//
// WHICH cards is the engine's answer (`hasAura`, `auraReach` in state.ts), not
// this file's: what an aura touches is a rule, and the UI never computes one.
import type { CardInstance, Element, GameState } from "../engine";
import { auraReach, getDef, hasAura } from "../engine";

/** One card's part in an aura landing. */
export interface AuraLight {
  /** `source` is the card that landed; `ally` a card its aura strengthens;
   *  `foe` an opponent it weighs on (Blinding Star, Intimidation). */
  role: "source" | "ally" | "foe";
  /** How long after the source this card lights (ms). */
  delay: number;
  /** The landing card's element: its aura's colour. */
  element: Element;
}

/** An AuraLight as the board holds it: `key` is the landing it belongs to (a
 *  second landing restarts the glow on a card the first one lit) and `start`
 *  when that landing began, so a card that moves mid-glow — a new token on a
 *  new square — picks the glow up where it was instead of playing it again. */
export interface AuraGlow extends AuraLight {
  key: number;
  start: number;
}

/** The glow travels: each king-step from the holder lights a beat later... */
export const AURA_STEP_MS = 110;
/** ...up to here, so a board-wide aura reaches its far edge while the source
 *  is still lit. */
const AURA_MAX_DELAY_MS = 440;
/** Everything has faded by then: the source's glow is the longest, 1.4s, and
 *  the last card starts at most AURA_MAX_DELAY_MS in. */
export const AURA_GLOW_MS = 1900;

const steps = (a: CardInstance, b: CardInstance): number =>
  a.pos && b.pos ? Math.max(Math.abs(a.pos.row - b.pos.row), Math.abs(a.pos.col - b.pos.col)) : 1;

/** Every card that lights up between two states of one match: each aura card
 *  that arrived (summoned, spawned, or back on the board) and every card its
 *  aura reaches as the board stands now. A card two landing auras both reach
 *  lights once, from the nearer; a holder stays a source even when another
 *  holder's aura reaches it. */
export function auraArrivals(before: GameState, after: GameState): Map<string, AuraLight> {
  const out = new Map<string, AuraLight>();
  const landed = Object.values(after.cards).filter(
    (c) => c.pos && c.curHp > 0 && !before.cards[c.instanceId]?.pos && hasAura(getDef(c.defId)),
  );
  for (const holder of landed) out.set(holder.instanceId, { role: "source", delay: 0, element: getDef(holder.defId).element });
  for (const holder of landed) {
    const { allies, foes } = auraReach(after, holder);
    const element = getDef(holder.defId).element;
    for (const [cards, role] of [[allies, "ally"], [foes, "foe"]] as const)
      for (const c of cards) {
        const delay = Math.min(AURA_MAX_DELAY_MS, steps(holder, c) * AURA_STEP_MS);
        const had = out.get(c.instanceId);
        if (!had || (had.role !== "source" && delay < had.delay)) out.set(c.instanceId, { role, delay, element });
      }
  }
  return out;
}
