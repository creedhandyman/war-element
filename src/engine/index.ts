// Public engine API. The UI reads state, asks legality questions, and
// dispatches intents — it never computes a rule outcome itself.

export * from "./types";
export {
  createInitialState,
  boardCards,
  cardAt,
  isContested,
  isCaptured,
  effectiveSp,
  effectiveDmg,
  hasStatus,
  moveReach,
  isEliminated,
  hasCaptureWin,
} from "./state";
export {
  canSummon,
  canMove,
  legalMoves,
  canTarget,
  validTargets,
  validAllyTargets,
  canBasicAttack,
  canFireSpecial,
  plannedAction,
  isActionBlocked,
} from "./rules";
export type { PlannedAction } from "./rules";
export { applyIntent, advance, advanceUntilInput, needsP1Input } from "./phases";
export { aiMulligan, aiPrepIntent, chooseBattleAction } from "./ai";
export { CARDS, CARD_INDEX, getDef, DECK_P1, DECK_P2 } from "../data/cards";
