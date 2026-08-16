// Element matchups — how the eight elements answer each other, on top of the
// per-element auras in auras.ts. The table below is the human-readable source
// of truth; the effects live at four hook sites:
//
//   resolveHit  — the DAWN/DUSK damage swing, GALE's dodge, LEAF's water-fed heal
//   applyStatus — the status resistances (AQUA/BORE/GALE)
//   healCard    — BURN's healing penalty
//
// Design note on why these are resistances rather than immunities: a flat
// immunity blanks a whole aura in one matchup. BOLT's Electrify is "basics
// leave the target ELECTRIFIED, and BOLT deals +2 to anything carrying a
// status" — an ELECTRIFIED-immune BORE would erase both halves of BOLT's
// identity rather than answer it. Halving the duration answers it instead.

import type { Element, StatusKind } from "./types";

export interface MatchupDef {
  name: string;
  desc: string;
}

/** BOLT is deliberately absent: its edge is already the Electrify aura, which
 *  answers any status-carrying target. Giving it a matchup bonus on top would
 *  push the element the measurements put at the TOP of the ladder. */
export const ELEMENT_MATCHUP: Partial<Record<Element, MatchupDef>> = {
  LEAF: { name: "Well Watered", desc: "Heals +1 HP whenever an AQUA attack lands on it." },
  PYRO: { name: "Searing", desc: "A BURNing card heals at 75% — wounds don't close while they cook." },
  AQUA: { name: "Quenching", desc: "BURN on an AQUA card lasts half as long (rounded up)." },
  DAWN: { name: "Daybreak", desc: "Deals +25% DMG to DUSK." },
  DUSK: { name: "Nightfall", desc: "Deals +25% DMG to DAWN." },
  GALE: { name: "Untouchable", desc: "20% chance to dodge a BORE attack." },
  BORE: { name: "Grounded Stone", desc: "ELECTRIFIED and PARALYZE on a BORE card last half as long (rounded up)." },
};

/** HP a LEAF card drinks back from each landed AQUA hit. */
export const LEAF_WATER_HEAL = 1;

/** How much a BURNing card heals. Deliberately 0.75 rather than the 0.5 this
 *  started as: LEAF is the game's healing element and measured LAST by a wide
 *  margin, so a half-strength anti-heal was a hard counter aimed squarely at
 *  the element that could least afford one. */
export const BURN_HEAL_MULT = 0.75;

/** The DAWN/DUSK swing. Mutual, so it nets out on the ladder — it's here for
 *  the flavour and to make that matchup decisive, not to move balance. */
export const OPPOSED_DMG_MULT = 1.25;

/** GALE's chance to slip a BORE attack. */
export const GALE_DODGE_VS_BORE_PCT = 20;

/** The damage multiplier `attacker` gets against `target` (1 = no matchup). */
export function matchupDamageMult(attacker: Element, target: Element): number {
  if (attacker === "DAWN" && target === "DUSK") return OPPOSED_DMG_MULT;
  if (attacker === "DUSK" && target === "DAWN") return OPPOSED_DMG_MULT;
  return 1;
}

/** `dmg` after the matchup swing. The bonus is FLOORED, not rounded: damage is
 *  an integer, and rounding 2×1.25 up to 3 is a +50% swing, not +25% — which a
 *  3-hit attack then compounds into +50% on the whole volley. Flooring means a
 *  1–3 DMG hit gets nothing and the bonus starts biting at 4, which keeps the
 *  swing honest on exactly the multi-hit cards it would otherwise distort. */
export function applyMatchupDamage(attacker: Element, target: Element, dmg: number): number {
  const mult = matchupDamageMult(attacker, target);
  if (mult === 1 || dmg <= 0) return dmg;
  return dmg + Math.floor(dmg * (mult - 1));
}

/** Does `target`'s element let it slip this attacker entirely? Caller rolls. */
export function dodgesByMatchup(attacker: Element, target: Element): number {
  if (target === "GALE" && attacker === "BORE") return GALE_DODGE_VS_BORE_PCT;
  return 0;
}

/** Halve a duration but never below 1 — a resisted status still lands, it just
 *  doesn't stick. Rounded UP so a 3-round status resists to 2, not 1. */
function halved(duration: number): number {
  return Math.max(1, Math.ceil(duration / 2));
}

/** The duration `kind` actually gets when applied to a card of `element`. */
export function matchupStatusDuration(element: Element, kind: StatusKind, duration: number): number {
  if (duration <= 0) return duration;
  // Quenching: water puts fires out.
  if (element === "AQUA" && kind === "BURN") return halved(duration);
  // Grounded Stone: stone earths a charge.
  if (element === "BORE" && (kind === "ELECTRIFIED" || kind === "PARALYZE")) return halved(duration);
  // GALE has NO status resistance. It used to shed ELECTRIFIED a round early
  // under Untouchable — removed, because that half was never meant to be here:
  // Untouchable is a DODGE matchup against BORE, and a second, unrelated
  // resistance against BOLT had been filed under the same name.
  //
  // It also cut across the design note at the top of this file. BOLT's whole
  // identity is "basics leave the target ELECTRIFIED, and BOLT hits statused
  // cards harder"; BORE answers that deliberately and pays for it in the
  // matchup table. GALE was answering it too, for free, as a rider on a
  // completely different matchup.
  return duration;
}
