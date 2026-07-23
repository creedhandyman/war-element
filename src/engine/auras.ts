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
  LEAF: { name: "Photosynthesis", desc: "End of round, LEAF cards heal +2 HP, and gain +1 shield (max 3) if they were hit that round." },
  PYRO: { name: "Scorch", desc: "Basic attacks apply BURN 1 (1 round, non-stacking)." },
  BORE: { name: "Exostone", desc: "Enters play with +2 shields." },
  DUSK: { name: "Midnight Shade", desc: "On death, deals a third of its DMG back to the killer." },
  AQUA: { name: "Flow Change", desc: "On summon, choose a 1-turn boost: Liquid +2 DMG (+1 hit if multi-hit) · Frozen +3 shields · Vapor +4 SP." },
  DAWN: { name: "Awakening", desc: "On summon, strikes the nearest enemy for half its DMG." },
  GALE: { name: "Zephyr", desc: "End of round, +1 SP (caps at SP 21)." },
  BOLT: { name: "Electrify", desc: "Basic attacks leave the target ELECTRIFIED, and BOLT cards deal +2 DMG to any opponent carrying a status." },
};

export const GALE_SP_CAP = 21;

/** Photosynthesis stores at most this much armour. Uncapped, a LEAF card under
 *  sustained fire would plate up faster than it could be chewed through and the
 *  aura would stop being a comeback mechanic and start being a stall engine. */
export const LEAF_SHIELD_CAP = 3;

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
export function applyFlow(card: CardInstance, mode: FlowMode): void {
  if (mode === "water") {
    // Liquid: +1 hit on multi-hit cards (avoids the per-hit +2 blowout),
    // otherwise +2 DMG.
    if (liquidGivesHit(card)) card.hitsBonusRound += 1;
    else card.dmgBonusRound += 2;
  } else if (mode === "ice") {
    card.curShields += 3;
    card.tempShields += 3;
  } else if (mode === "steam") card.spBonusRound += 4;
}
