// Element auras — a passive every card of that element carries. Fired from the
// existing hook points (summon / basic hit / death / Cleanup) keyed by element.
// The table below is the source of truth for the human-readable description
// (shown in the card inspector); the actual effects live at each hook site.

import { getDef } from "../data/cards";
import { MULTI_HIT_BONUS_MIN } from "./types";
import type { CardDef, CardInstance, Element } from "./types";

/** Does this card carry element `el`'s aura? True for its own element, plus any
 *  extra elements it borrows via `elementAuras` (SirCrest's PYRO/AQUA mastery). */
export function hasElementAura(def: CardDef, el: Element): boolean {
  return def.element === el || !!def.elementAuras?.includes(el);
}

export interface AuraDef {
  name: string;
  desc: string;
}

export const ELEMENT_AURA: Record<Element, AuraDef> = {
  LEAF: { name: "Photosynthesis", desc: "End of round, LEAF cards heal +2 HP — plus 1 more for every ROOTed opponent — and gain +1 shield per hit they took that round, up to 3 above their printed shields." },
  PYRO: { name: "Scorch", desc: "Basic attacks apply BURN, stacking up to BURN 5 on the same target." },
  BORE: { name: "Exostone", desc: "Enters play with shields by rarity — Rare 2, Epic 2, Legendary 3, Mythic 4. Never loses more than 1 shield to a single hit however heavy, and gains +1 shield whenever its attack breaks one off an opponent." },
  DUSK: { name: "Midnight Shade", desc: "On death, deals a third of its DMG back to the killer, and the shadows thicken — every DUSK card you control gains +5% dodge for a round, stacking with each fallen DUSK card (max 25%)." },
  AQUA: { name: "Flow Change", desc: "On summon, choose a boost for 3 rounds: Liquid +2 DMG · Frozen +3 shields · Vapor +4 SP." },
  DAWN: { name: "Awakening", desc: "On summon, strikes the nearest enemy for half its DMG. End of round, burns one negative status off itself and gains +1 SP (caps at SP 14)." },
  GALE: { name: "Zephyr", desc: "End of round, +2 SP (caps at SP 21); the first time it passes SP 15, a one-time +1 DMG." },
  BOLT: { name: "Electrify", desc: "Basic attacks leave the target ELECTRIFIED, and BOLT cards deal +2 DMG to any opponent carrying a status." },
};

/** Exostone's arrival plating, by rarity. It was a flat +2 for every BORE card,
 *  which handed the same slab to a 1-cost Rare and a 10-cost Mythic — most
 *  valuable on the cheapest body, where 2 shields is a large share of what the
 *  card is. Tiering it makes the aura scale with the card it is plating.
 *
 *  Rare and Epic both sit AT the old flat value; only the top two tiers climb.
 *  BORE's pool is rare-heavy — 18 Rare, 12 Epic, 7 Legendary, 2 Mythic — so a
 *  ladder centred on 2 (the first cut was 1/2/3/4) took a shield off 18 cards to
 *  give to 9, and measured as a small net loss for the element. Holding the
 *  bottom two flat means no card is worse off than before and the 9 rarest get
 *  the scaling. */
export const EXOSTONE_SHIELDS: Record<string, number> = {
  rare: 2, epic: 2, legendary: 3, mythic: 4,
};
/** Fallback for any rarity outside the table above. */
export const EXOSTONE_DEFAULT = 2;

export const GALE_SP_CAP = 21;

/** Where First Light (DAWN) stops quickening. Well under GALE's 21: speed is
 *  GALE's identity, and this exists to lift the game's most expensive, second
 *  slowest element off the floor of the capture race — not to make a second
 *  speed element. */
export const DAWN_SP_CAP = 14;

/** How much armour Photosynthesis may add ON TOP OF a card's printed shields.
 *  Uncapped, a LEAF card under sustained fire would plate up faster than it
 *  could be chewed through and the aura would stop being a comeback mechanic
 *  and start being a stall engine.
 *
 *  This is a BONUS cap, not a total. Read as a total it silently excluded every
 *  LEAF card printing 3+ shields from its own element aura. */
export const LEAF_SHIELD_CAP = 3;

/** Scorch stacks its BURN to here and no further. Uncapped, a multi-hit PYRO
 *  card would stack a lethal DOT off one attack and the aura would stop being
 *  chip damage. */
export const PYRO_BURN_STACK_CAP = 5;

/** Midnight Shade's second half: each DUSK card that falls thickens the shadows
 *  over its surviving DUSK allies by this much dodge chance. */
export const DUSK_SHADE_PCT = 5;

/** And no further. DUSK is the disposable-body element — 7 of its cards cost 2
 *  or less and two of them are spawnable tokens — so it can put more corpses on
 *  the board in a round than anything else. Uncapped, a bad round for DUSK would
 *  hand it a dodge chance that made the NEXT round unwinnable, which is the same
 *  losing-trade problem that got the death recoil cut from a half to a third
 *  (see the Midnight Shade block in combat.ts). Five stacks — a quarter of all
 *  incoming hits — is the ceiling. */
export const DUSK_SHADE_MAX_STACKS = 5;

// AQUA Flow Change — the three-way summon choice (the summon pick lasts 3 rounds).
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

/** Apply the chosen Flow Change buff.
 *
 *  `rounds > 0` (the SUMMON pick) grants a TIMED buff that lasts that many rounds
 *  then fades — the current design: on-summon Flow lasts 3 rounds. It used to be
 *  round-scoped (one round only, the weakest aura in the game), then permanent;
 *  3 rounds is the middle ground.
 *
 *  `permanent`/round-scoped remain for Downpour, which re-picks Flow for every
 *  AQUA ally EVERY round — a timed or permanent grant there would stack without
 *  limit, so that path keeps the one-round version it was designed around. */
export function applyFlow(card: CardInstance, mode: FlowMode, permanent = false, rounds = 0): void {
  // The SUMMON pick now grants a TIMED buff (rounds > 0) instead of a permanent
  // one — Flow Change lasts 3 rounds, then fades. Pushed straight onto the same
  // `buffs` array applyTimedBuff uses (avoids an auras→combat import cycle); the
  // Cleanup that ticks those handles the expiry.
  const timed = rounds > 0;
  if (mode === "water") {
    // Liquid: +1 hit on multi-hit cards (avoids the per-hit +2 blowout),
    // otherwise +2 DMG. The timed grant uses flat +2 DMG for all — on a
    // temporary buff the multi-hit blowout no longer needs guarding against.
    if (timed) card.buffs.push({ dmg: 2, sp: 0, rounds });
    else if (liquidGivesHit(card)) {
      if (permanent) card.hitsBonus += 1;
      else card.hitsBonusRound += 1;
    } else if (permanent) card.dmgBonus += 2;
    else card.dmgBonusRound += 2;
  } else if (mode === "ice") {
    card.curShields += 3;
    // tempShields is the round-scoped refund marker; a permanent OR timed grant
    // omits it (timed shields simply last until spent — no per-round shield timer).
    if (!permanent && !timed) card.tempShields += 3;
  } else if (mode === "steam") {
    if (timed) card.buffs.push({ dmg: 0, sp: 4, rounds });
    else if (permanent) card.spBonus += 4;
    else card.spBonusRound += 4;
  }
}
