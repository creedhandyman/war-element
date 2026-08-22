// Test scaffolding: build bespoke states and place cards directly.

import { getDef } from "../../data/cards";
import { coin } from "../rng";
import { applyIntent } from "../phases";
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

/** The same, on the LARGE board. Rules that name rows by number rather than by
 *  their relation to the board's edges tend to be right on 4x4 and wrong here —
 *  the 5x5 has a third row between the home rows — so anything row-shaped wants
 *  a test at both sizes. */
export function bigPrepState(seed = 42, priority: PlayerId = "P1"): GameState {
  const s = createInitialState(seed, undefined, undefined, ["P1"], undefined, undefined, 5);
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

/** Drive the state into the Battle phase through the real prep→battle
 *  transition, so startBattle() runs (electrify auras, speed queue, …). */
export function atBattle(state: GameState): GameState {
  state.phase = "prep";
  state.prep = { priority: "P1", consecutivePasses: 1, movedThisTurn: false };
  return applyIntent(state, { type: "PASS", player: "P1" }); // 2nd pass → startBattle
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

/** Drop a card's disguise, restoring its true form and stat line.
 *
 *  Nightfang enters play wearing the Butler, so a test that wants to exercise
 *  Nightfang ITSELF — its Special, its keywords — has to take the mask off
 *  first. The reveal path in defeatCard does this for real; this is the same
 *  thing without needing to kill it. */
export function unmask(state: GameState, card: CardInstance): CardInstance {
  const inst = state.cards[card.instanceId];
  if (!inst.transformedFrom) return inst;
  const real = getDef(inst.transformedFrom);
  inst.defId = inst.transformedFrom;
  inst.transformedFrom = undefined;
  inst.maxHp = real.hp;
  inst.curHp = real.hp;
  inst.curShields = real.shields;
  return inst;
}

export function def(defId: string) {
  return getDef(defId);
}
