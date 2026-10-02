// Flow Change, read ahead of the pick.
//
// The menu shows what each form would do to THIS card — its DMG, shields or
// speed before and after — and it gets those numbers by running the same
// `applyFlow` the reducer runs, on a copy, then asking the same effective-stat
// questions the board asks. So a card at half scale, a Frozen body, a multi-hit
// card taking Liquid's extra hit: the preview is whatever the engine delivers,
// never a UI re-derivation of it.
//
// A leaf module on purpose: it reads auras, combat and state, and nothing in
// the engine imports it back.

import { getDef } from "../data/cards";
import { applyFlow, AQUA_TIDE_EVERY, type FlowMode } from "./auras";
import { effectiveBasicHits } from "./combat";
import { boardCards, effectiveDmg, effectiveSp } from "./state";
import type { CardInstance, GameState } from "./types";

export interface FlowStats { dmg: number; hits: number; shields: number; sp: number }
export interface FlowPreview { before: FlowStats; after: FlowStats }

function statsOf(state: GameState, card: CardInstance): FlowStats {
  return {
    dmg: effectiveDmg(state, card),
    hits: effectiveBasicHits(card, state),
    shields: card.curShields,
    sp: effectiveSp(state, card),
  };
}

/** What taking `mode` would leave `card` with. `permanent` is the summon pick;
 *  false is Downpour's round-scoped re-pick (same numbers today, different
 *  lifetime — kept apart so the two can never silently diverge here). */
export function flowPreview(state: GameState, card: CardInstance, mode: FlowMode, permanent = true): FlowPreview {
  const after = structuredClone(card);
  applyFlow(after, mode, permanent);
  const next: GameState = { ...state, cards: { ...state.cards, [card.instanceId]: after } };
  return { before: statsOf(state, card), after: statsOf(next, after) };
}

/** The round whose Cleanup brings the next tide (see AQUA_TIDE_EVERY).
 *
 *  The tide is keyed off the round, not the card: every AQUA card with a form
 *  surges together at the end of each even round, so a card summoned in an even
 *  round catches that same round's tide. Deployment happens in round 0 and has
 *  no Cleanup, which is why the count starts from round 1. */
export function nextTideRound(state: GameState): number {
  const r = Math.max(1, state.round);
  const rest = r % AQUA_TIDE_EVERY;
  return rest === 0 ? r : r + (AQUA_TIDE_EVERY - rest);
}

/** Every card a Downpour re-pick lands on, when `card` holds the prompt: its
 *  owner's living cards of its element — the FLOW_CHANGE reducer's set, which
 *  flow-menu.test.ts holds this to. */
export function downpourKin(state: GameState, card: CardInstance): CardInstance[] {
  const el = getDef(card.defId).element;
  return boardCards(state, card.owner).filter((c) => c.curHp > 0 && getDef(c.defId).element === el);
}
