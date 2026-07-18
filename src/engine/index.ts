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
  effectiveMaxHp,
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
  canFireTalent,
  plannedAction,
  isActionBlocked,
  validSpecialTargets,
  specialTargets,
  previewOnSummonArea,
  canCastSpell,
  canSpellHitEnemy,
  spellEnemyTargets,
  canPlaceWallRow,
  legalWallRows,
} from "./rules";
export type { PlannedAction } from "./rules";
export { SPELLS, SPELL_INDEX, getSpell, isSpell, spellbookFor, spellbookFromIds, MAX_SPELLBOOK } from "./spells";
export { applyIntent, advance, advanceUntilInput, needsP1Input, needsInput } from "./phases";
export { effectiveBasicHits } from "./combat";
export { aiMulligan, aiPrepIntent, chooseBattleAction } from "./ai";
export { CARDS, CARD_INDEX, getDef, DECK_P1, DECK_P2, DECKS, deckById, CORES, coreById, pairingCards } from "../data/cards";
export type { DeckDef, CoreDef } from "../data/cards";
export { ELEMENT_AURA, GALE_SP_CAP, FLOW_MODES, liquidGivesHit } from "./auras";
export type { AuraDef, FlowMode } from "./auras";
