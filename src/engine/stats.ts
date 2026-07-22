// Post-match stat tracking. The reducer already fires every damage / heal /
// status / capture event (see resolveHit + spellHit + healCard + applyStatus +
// defeatCard + the Cleanup capture step); these helpers just tally them onto
// GameState.stats. Pure data — no randomness — so it stays deterministic and
// syncs cleanly online.
//
// Every event has TWO sides and both are now recorded: damage credits the
// dealer AND the card that absorbed it; healing credits the healer AND the
// recipient. Folding those together is what left the report unable to tell a
// medic from a patient.

import { getDef } from "../data/cards";
import type { CardInstance, MatchStats, PlayerId } from "./types";

function zeroSide() {
  return { dmg: 0, heal: 0, captures: 0, kills: 0, taken: 0, healRecv: 0, debuffs: 0, deaths: 0 };
}

export function emptyStats(): MatchStats {
  return { byCard: {}, byPlayer: { P1: zeroSide(), P2: zeroSide() } };
}

/** Lazily create (and return) the per-card row for a card. */
function cardRow(stats: MatchStats, card: CardInstance) {
  let row = stats.byCard[card.instanceId];
  if (!row) {
    row = {
      defId: card.defId,
      name: getDef(card.defId).name,
      owner: card.owner,
      dmg: 0, heal: 0, captures: 0, kills: 0,
      taken: 0, healRecv: 0, debuffs: 0, deaths: 0,
    };
    stats.byCard[card.instanceId] = row;
  }
  return row;
}

/** Credit HP damage. `source` is the dealing card (null for a spell — then only
 *  the player total moves). `player` is who to credit the side total to.
 *  `target` is the card that ate it, so defence is recorded as well as offence. */
export function creditDamage(
  stats: MatchStats,
  source: CardInstance | null,
  player: PlayerId,
  amount: number,
  target?: CardInstance | null,
): void {
  if (amount <= 0) return;
  stats.byPlayer[player].dmg += amount;
  if (source) cardRow(stats, source).dmg += amount;
  if (target) {
    stats.byPlayer[target.owner].taken += amount;
    cardRow(stats, target).taken += amount;
  }
}

/** Credit HP healed. `by` is the HEALER — a card (support or self-sustain) or a
 *  bare PlayerId (a heal spell); null leaves it unattributed rather than
 *  blaming the patient. `target` is the card that received it.
 *
 *  There is deliberately NO "default to the recipient" fallback. That fallback
 *  credited whoever GOT healed as the healer, so any effect which forgot to
 *  name its source (Morning Dew did) was filed as the patient's self-sustain. */
export function creditHeal(
  stats: MatchStats,
  by: CardInstance | PlayerId | null,
  amount: number,
  target?: CardInstance | null,
): void {
  if (amount <= 0) return;
  if (typeof by === "string") {
    stats.byPlayer[by].heal += amount;
  } else if (by) {
    stats.byPlayer[by.owner].heal += amount;
    cardRow(stats, by).heal += amount;
  }
  if (target) {
    stats.byPlayer[target.owner].healRecv += amount;
    cardRow(stats, target).healRecv += amount;
  }
}

/** Credit a negative status landing on `target`. applyStatus carries an Element
 *  rather than a source card, so this records who got CONTROLLED — in a
 *  two-sided match the opposing side's control output is its mirror. */
export function creditDebuff(stats: MatchStats, target: CardInstance): void {
  stats.byPlayer[target.owner].debuffs += 1;
  cardRow(stats, target).debuffs += 1;
}

/** Credit a card being put down. A reviving card can rack up more than one. */
export function creditDeath(stats: MatchStats, card: CardInstance): void {
  stats.byPlayer[card.owner].deaths += 1;
  cardRow(stats, card).deaths += 1;
}

/** Credit an enemy Home-slot capture to the surviving card. */
export function creditCapture(stats: MatchStats, source: CardInstance): void {
  stats.byPlayer[source.owner].captures += 1;
  cardRow(stats, source).captures += 1;
}

/** Credit an enemy kill. `source` is null for a spell kill (player total only). */
export function creditKill(stats: MatchStats, source: CardInstance | null, player: PlayerId): void {
  stats.byPlayer[player].kills += 1;
  if (source) cardRow(stats, source).kills += 1;
}
