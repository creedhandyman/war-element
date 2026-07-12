// Element auras — a passive every card of that element carries. Fired from the
// existing hook points (summon / basic hit / death / Cleanup) keyed by element.
// The table below is the source of truth for the human-readable description
// (shown in the card inspector); the actual effects live at each hook site.

import type { Element } from "./types";

export interface AuraDef {
  name: string;
  desc: string;
}

export const ELEMENT_AURA: Record<Element, AuraDef> = {
  LEAF: { name: "Photosynthesis", desc: "End of round, LEAF cards heal +1 HP." },
  PYRO: { name: "Scorch", desc: "Basic attacks apply BURN 1 (1 round, non-stacking)." },
  BORE: { name: "Exostone", desc: "Enters play with +2 shields." },
  DUSK: { name: "Midnight Shade", desc: "On death, deals half its DMG back to the killer." },
  AQUA: { name: "Flow Change", desc: "On summon, +2 DMG for the turn." },
  DAWN: { name: "Awakening", desc: "On summon, strikes the nearest enemy for half its DMG." },
  GALE: { name: "Zephyr", desc: "End of round, +1 SP (caps at SP 21)." },
  BOLT: { name: "Electrify", desc: "+1 DMG against any opponent that has a status." },
};

export const GALE_SP_CAP = 21;
