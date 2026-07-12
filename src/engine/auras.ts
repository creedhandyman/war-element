// Element auras — a passive every card of that element carries. Fired from the
// existing hook points (summon / basic hit / death / Cleanup) keyed by element.
// The table below is the source of truth for the human-readable description
// (shown in the card inspector); the actual effects live at each hook site.

import type { CardInstance, Element } from "./types";

export interface AuraDef {
  name: string;
  desc: string;
}

export const ELEMENT_AURA: Record<Element, AuraDef> = {
  LEAF: { name: "Photosynthesis", desc: "End of round, LEAF cards heal +1 HP." },
  PYRO: { name: "Scorch", desc: "Basic attacks apply BURN 1 (1 round, non-stacking)." },
  BORE: { name: "Exostone", desc: "Enters play with +2 shields." },
  DUSK: { name: "Midnight Shade", desc: "On death, deals half its DMG back to the killer." },
  AQUA: { name: "Flow Change", desc: "On summon, choose a 1-turn boost: Liquid +2 DMG · Frozen +3 shields · Vapor +4 SP." },
  DAWN: { name: "Awakening", desc: "On summon, strikes the nearest enemy for half its DMG." },
  GALE: { name: "Zephyr", desc: "End of round, +1 SP (caps at SP 21)." },
  BOLT: { name: "Electrify", desc: "+1 DMG against any opponent that has a status." },
};

export const GALE_SP_CAP = 21;

// AQUA Flow Change — the three-way summon choice (all "for 1 turn").
export type FlowMode = "water" | "ice" | "steam";
export const FLOW_MODES: Record<FlowMode, { label: string; blurb: string }> = {
  water: { label: "Liquid", blurb: "+2 DMG" },
  ice: { label: "Frozen", blurb: "+3 shields" },
  steam: { label: "Vapor", blurb: "+4 SP" },
};

/** Apply the chosen Flow Change buff (round-scoped — cleared each Cleanup;
 *  the shields are temporary and removed in Cleanup). */
export function applyFlow(card: CardInstance, mode: FlowMode): void {
  if (mode === "water") card.dmgBonusRound += 2;
  else if (mode === "ice") {
    card.curShields += 3;
    card.tempShields += 3;
  } else if (mode === "steam") card.spBonusRound += 4;
}
