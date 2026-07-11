// Test scaffolding: build bespoke states and place cards directly.

import { getDef } from "../../data/cards";
import { coin } from "../rng";
import { createInitialState, summonCard } from "../state";
import type {
  CardInstance,
  GameState,
  PlayerId,
  Pos,
  StatusEffect,
} from "../types";

/** The status entry of the given kind, or the first one. */
export function statusOf(card: CardInstance, kind?: string): StatusEffect | undefined {
  return kind ? card.statuses.find((s) => s.kind === kind) : card.statuses[0];
}

export function freshGame(seed = 42): GameState {
  return createInitialState(seed);
}

/** A state parked in the Prep Phase with both mulligans done. */
export function prepState(seed = 42, priority: PlayerId = "P1"): GameState {
  const s = freshGame(seed);
  s.players.P1.mulliganDone = true;
  s.players.P2.mulliganDone = true;
  s.round = 1;
  s.phase = "prep";
  s.firstPlayer = priority;
  s.prep = { priority, consecutivePasses: 0, movedThisTurn: false };
  return s;
}

/** Place a card directly on the board (bypasses summon rules; not summon-locked).
 *  Accepts a `status` shorthand override — it becomes the card's one entry in
 *  the `statuses` array. */
export function place(
  state: GameState,
  defId: string,
  owner: PlayerId,
  row: number,
  col: number,
  overrides: Partial<CardInstance> & { status?: StatusEffect } = {},
): CardInstance {
  const inst = summonCard(state, owner, defId, { row, col } as Pos);
  inst.summonedThisRound = false;
  const { status, ...rest } = overrides;
  Object.assign(inst, rest);
  if (status) inst.statuses = [status];
  return inst;
}

/** Park a state at the very end of a battle so advance() runs Cleanup next. */
export function atCleanup(state: GameState): GameState {
  state.phase = "battle";
  state.battle = { queue: [], index: 0, awaitingInput: null };
  return state;
}

/** Find an RNG cursor whose NEXT coin flip(s) match `wants`. */
export function seedForCoins(...wants: boolean[]): number {
  outer: for (let seed = 0; seed < 100_000; seed++) {
    const probe = { rngState: seed } as GameState;
    for (const want of wants) {
      if (coin(probe) !== want) continue outer;
    }
    return seed;
  }
  throw new Error("no seed found");
}

/** Give a player resources + a specific card in hand; returns the handId. */
export function giveHand(state: GameState, player: PlayerId, defId: string): string {
  const handId = `h${state.nextId++}`;
  state.players[player].hand.push({ handId, defId });
  return handId;
}

export function def(defId: string) {
  return getDef(defId);
}
