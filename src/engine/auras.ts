// Element auras — a passive every card of that element carries. Fired from the
// existing hook points (summon / basic hit / death / Cleanup) keyed by element.
// The table below is the source of truth for the human-readable description
// (shown in the card inspector); the actual effects live at each hook site.

import { getDef } from "../data/cards";
import { MULTI_HIT_BONUS_MIN } from "./types";
import type { CardInstance, Element } from "./types";

export interface AuraDef {
  name: string;
  desc: string;
}

export const ELEMENT_AURA: Record<Element, AuraDef> = {
  LEAF: { name: "Photosynthesis", desc: "Basic attacks make a foe BLEED, and LEAF cards deal +3 DMG to a BLEEDing or ROOTed enemy. End of round, LEAF cards heal +2 HP, and gain +1 shield (max 3) if they were hit that round." },
  PYRO: { name: "Scorch", desc: "Basic attacks apply BURN, stacking up to BURN 4 on the same target." },
  BORE: { name: "Exostone", desc: "Enters play with +2 shields." },
  DUSK: { name: "Midnight Shade", desc: "On death, deals a third of its DMG back to the killer." },
  AQUA: { name: "Flow Change", desc: "On summon, choose a PERMANENT boost: Liquid +2 DMG (+1 hit if multi-hit) · Frozen +3 shields · Vapor +4 SP." },
  DAWN: { name: "Awakening", desc: "On summon, strikes the nearest enemy for half its DMG." },
  GALE: { name: "Zephyr", desc: "End of round, +1 SP (caps at SP 21)." },
  BOLT: { name: "Electrify", desc: "Basic attacks leave the target ELECTRIFIED, and BOLT cards deal +2 DMG to any opponent carrying a status." },
};

export const GALE_SP_CAP = 21;

/** Photosynthesis stores at most this much armour. Uncapped, a LEAF card under
 *  sustained fire would plate up faster than it could be chewed through and the
 *  aura would stop being a comeback mechanic and start being a stall engine. */
export const LEAF_SHIELD_CAP = 3;

/** Scorch stacks its BURN to here and no further. Uncapped, a multi-hit PYRO
 *  card would stack a lethal DOT off one attack and the aura would stop being
 *  chip damage. */
export const PYRO_BURN_STACK_CAP = 4;

// AQUA Flow Change — the three-way summon choice (all "for 1 turn").
export type FlowMode = "water" | "ice" | "steam";
export const FLOW_MODES: Record<FlowMode, { label: string; blurb: string }> = {
  water: { label: "Liquid", blurb: "+2 DMG" },
  ice: { label: "Frozen", blurb: "+3 shields" },
  steam: { label: "Vapor", blurb: "+4 SP" },
};

/** True when Liquid should grant an extra hit rather than +2 DMG — i.e. the
 *  card already strikes multiple times, so a flat per-hit bonus would balloon
 *  (Vaporem 2×5, Sapphire 3×2, …). */
export function liquidGivesHit(card: CardInstance): boolean {
  return getDef(card.defId).hits >= MULTI_HIT_BONUS_MIN;
}

/** Apply the chosen Flow Change buff (round-scoped — cleared each Cleanup;
 *  the shields are temporary and removed in Cleanup). */
/** Flow Change is PERMANENT, not a one-turn boost.
 *
 *  It used to write the `*Round` fields, which Cleanup wipes — so an AQUA card
 *  got its pick for the single round it landed and nothing ever again. Every
 *  other element's aura either persists (BORE's +2 shields) or re-fires every
 *  round (LEAF, GALE, PYRO, BOLT, DUSK). One turn, once, on summon made AQUA's
 *  the weakest aura in the game by structure, and it measured joint-worst on
 *  offence. The SUMMON pick now persists, which puts it on the same footing as
 *  BORE's entry shields.
 *
 *  `permanent` is opt-in for exactly that reason: Downpour re-picks Flow for
 *  every AQUA ally EVERY round, so a permanent grant there would stack +2 DMG a
 *  round without limit. That path keeps the round-scoped version it was
 *  designed around. */
export function applyFlow(card: CardInstance, mode: FlowMode, permanent = false): void {
  if (mode === "water") {
    // Liquid: +1 hit on multi-hit cards (avoids the per-hit +2 blowout),
    // otherwise +2 DMG.
    if (liquidGivesHit(card)) {
      if (permanent) card.hitsBonus += 1;
      else card.hitsBonusRound += 1;
    } else if (permanent) card.dmgBonus += 2;
    else card.dmgBonusRound += 2;
  } else if (mode === "ice") {
    card.curShields += 3;
    // tempShields is the refund marker: a permanent grant simply omits it.
    if (!permanent) card.tempShields += 3;
  } else if (mode === "steam") {
    if (permanent) card.spBonus += 4;
    else card.spBonusRound += 4;
  }
}
