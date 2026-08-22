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
  auraSources,
  hasStatus,
  isBloodfire,
  moveReach,
  moveReachFor,
  isEliminated,
  hasCaptureWin,
  // The two never-miss sources, for the token: a BLIND that cannot cost this
  // card anything has to LOOK different from one that can.
  fieldFlag,
  hasTotemSpirit,
} from "./state";
export {
  canSummon,
  openHomeSlots,
  canMove,
  legalMoves,
  canTarget,
  validTargets,
  validAllyTargets,
  canBasicAttack,
  canFireSpecial,
  canFireTalent,
  effectiveSpecialCost,
  plannedAction,
  isActionBlocked,
  validSpecialTargets,
  specialTargets,
  previewOnSummonArea,
  canCastSpell,
  canSpellHitEnemy,
  spellEnemyTargets,
  spellAllyTargets,
  canPlaceWallRow,
  legalWallRows,
  canAoeRow,
} from "./rules";
export type { PlannedAction } from "./rules";
export { SPELLS, SPELL_INDEX, getSpell, isSpell, spellPickKind, spellbookFor, spellbookFromIds, MAX_SPELLBOOK } from "./spells";
export { applyIntent, advance, advanceUntilInput, needsP1Input, needsInput, distributeBasicHits } from "./phases";
export { effectiveBasicHits } from "./combat";
export { aiMulligan, aiPrepIntent, chooseBattleAction } from "./ai";
export { CARDS, CARD_INDEX, getDef, DECK_P1, DECK_P2, DECKS, deckById, CORES, coreById, pairingCards } from "../data/cards";
export type { DeckDef, CoreDef } from "../data/cards";
export { BLINDING_STAR_MISS_PCT, ELEMENT_AURA, FOG_MISS_PCT, GALE_SP_CAP, MISTY_FOG_MISS_PCT, WEAKEN_MAX_STACKS, WEAKEN_PCT_PER_STACK, FLOW_MODES, hasArcDischarge, liquidGivesHit, weakenMult, weakenStacks } from "./auras";
export type { AuraDef, FlowMode } from "./auras";
export { ELEMENT_MATCHUP } from "./matchups";
export type { MatchupDef } from "./matchups";
