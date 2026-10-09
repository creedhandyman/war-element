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

import type { Element } from "./types";

export interface MatchupDef {
  name: string;
  desc: string;
}

/** BOLT is deliberately absent: its edge is already the Electrify aura, which
 *  answers any status-carrying target. Giving it a matchup bonus on top would
 *  push the element the measurements put at the TOP of the ladder. */
/** THE ELEMENT WHEEL (owner, 2026-10-08): one rule for every element. Each
 *  element deals +25% DMG to the one it BEATS and takes +25% from the one
 *  that beats it — one advantage and one weakness each, so the table is fair
 *  by construction and a player can read any matchup off the card.
 *
 *  The six natural elements make a circle — PYRO burns LEAF, LEAF roots BORE,
 *  BORE grounds BOLT, BOLT strikes GALE, GALE churns AQUA, AQUA douses PYRO —
 *  and DAWN and DUSK beat each other, the rivalry they already had.
 *
 *  It REPLACES seven one-off matchups (LEAF drinking AQUA hits, AQUA halving
 *  BURN, GALE dodging BORE, BORE immune to ELECTRIFIED, …): hard to learn, and
 *  uneven — BOLT had none. Two survivors moved where they belong: BURN's heal
 *  penalty is a rule of the BURN status (BURN_HEAL_MULT, below), and BORE's
 *  paralysis immunity is part of its aura (auras.ts). */
export const ELEMENT_BEATS: Readonly<Partial<Record<Element, Element>>> = {
  PYRO: "LEAF",
  LEAF: "BORE",
  BORE: "BOLT",
  BOLT: "GALE",
  GALE: "AQUA",
  AQUA: "PYRO",
  DAWN: "DUSK",
  DUSK: "DAWN",
};
/** The element that beats `el`, if any. */
export const beatenBy = (el: Element): Element | undefined =>
  (Object.keys(ELEMENT_BEATS) as Element[]).find((k) => ELEMENT_BEATS[k] === el);

/** The swing, both ways round the wheel. */
export const WHEEL_DMG_MULT = 1.25;

/** Each element's line, as the rules book and the card panel print it. */
export const ELEMENT_MATCHUP: Partial<Record<Element, MatchupDef>> = Object.fromEntries(
  (Object.keys(ELEMENT_BEATS) as Element[]).map((el) => [el, {
    name: `Strong vs ${ELEMENT_BEATS[el]}`,
    desc: `Deals +${Math.round((WHEEL_DMG_MULT - 1) * 100)}% DMG to ${ELEMENT_BEATS[el]}, and takes +${Math.round((WHEEL_DMG_MULT - 1) * 100)}% DMG from ${beatenBy(el)}.`,
  }]),
);

/** How much a BURNing card heals: HALF since 2026-10-01 (owner: "make the burn
 *  more effective against healing targets"). It was 0.75 to spare LEAF, the
 *  healing element; measured with additive BURN stacking, LEAF moved 41.3 ->
 *  39.6 (about noise) while PYRO went 32.4 -> 38.8. */
export const BURN_HEAL_MULT = 0.5;

/** The damage multiplier `attacker` gets against `target` (1 = no matchup). */
export function matchupDamageMult(attacker: Element, target: Element): number {
  return ELEMENT_BEATS[attacker] === target ? WHEEL_DMG_MULT : 1;
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
