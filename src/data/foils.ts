/** WHAT A FOIL IS WORTH — one extra point of one stat, decided by the card.
 *
 *  DERIVED FROM THE CARD ID, not rolled and stored, and that is the whole
 *  design. Three things fall out of it that a stored roll cannot give:
 *
 *    RETROACTIVE. A foil pulled a year ago has a bonus the moment this ships.
 *    There is nothing to migrate, nothing to backfill, and no save that can be
 *    missing it — the answer is computed from the id every time it is asked.
 *
 *    STABLE. The same foil always has the same bonus, across sessions, devices
 *    and a restored backup. A roll banked in the save would survive a reload
 *    and not a cloud restore; a roll made at summon would make the card a
 *    different card every match.
 *
 *    AGREED. In an online match both clients simulate the same board, so both
 *    have to arrive at identical stats for the other player's foils. A hash of
 *    the id needs no wire message and cannot desync; a stored roll would have
 *    to be relayed and trusted.
 *
 *  The cost is that every player's foil Oakgre gains the same stat. That reads
 *  as a property of the CARD rather than of the copy, which is the honest way
 *  round: a foil is the card printed better, not a card with a random roll
 *  stapled to it.
 */

/** The four things a foil can gain. */
export type FoilStat = "dmg" | "hp" | "shield" | "sp";

/** How much of it, per the print. NOT equal in stat-budget terms — the budget
 *  is `dmg*hits + hp + shields*2 + sp`, so +2 HP and +1 shield are both worth
 *  two points while +1 SP is worth one, and +1 DMG is worth `hits` points,
 *  which is four on a card that strikes four times. Stated rather than
 *  smoothed: these are the printed numbers, and a foil is meant to feel like a
 *  small gift rather than a balanced one. */
export const FOIL_BONUS: Readonly<Record<FoilStat, number>> = {
  dmg: 1, hp: 2, shield: 1, sp: 1,
};

/** In a fixed order, so the hash maps onto them the same way forever. Changing
 *  this array reassigns every foil in the game. */
export const FOIL_STATS: readonly FoilStat[] = ["dmg", "hp", "shield", "sp"];

/** FNV-1a over the id. Any stable hash would do; what matters is that it is
 *  written down here rather than borrowed from a runtime whose implementation
 *  could differ between platforms — `String.prototype.hashCode` does not exist,
 *  and anything involving `Math.random` or object order would break the three
 *  properties above. */
function hashId(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Which stat a foil of this card gains. */
export const foilStatFor = (defId: string): FoilStat =>
  FOIL_STATS[hashId(defId) % FOIL_STATS.length]!;

/** The stat and the amount together, for a UI that wants to print it. */
export const foilBonusFor = (defId: string): { stat: FoilStat; amount: number } => {
  const stat = foilStatFor(defId);
  return { stat, amount: FOIL_BONUS[stat] };
};

/** How a card face says it. */
export const FOIL_STAT_LABEL: Readonly<Record<FoilStat, string>> = {
  dmg: "DMG", hp: "max HP", shield: "shield", sp: "SP",
};
