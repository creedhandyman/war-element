// Post-match stat tracking. The reducer already fires every damage / heal /
// capture event (see resolveHit + spellHit + healCard + the Cleanup capture
// step); these helpers just tally them onto GameState.stats. Pure data — no
// randomness — so it stays deterministic and syncs cleanly online.

import { getDef } from "../data/cards";
import type { CardInstance, MatchStats, PlayerId } from "./types";

function zeroSide() {
  return { dmg: 0, heal: 0, captures: 0, kills: 0 };
}

export function emptyStats(): MatchStats {
  return { byCard: {}, byPlayer: { P1: zeroSide(), P2: zeroSide() } };
}

/** Lazily create (and return) the per-card row for a source card. */
function cardRow(stats: MatchStats, card: CardInstance) {
  let row = stats.byCard[card.instanceId];
  if (!row) {
    row = { defId: card.defId, name: getDef(card.defId).name, owner: card.owner, dmg: 0, heal: 0, captures: 0, kills: 0 };
    stats.byCard[card.instanceId] = row;
  }
  return row;
}

/** Credit HP damage. `source` is the dealing card (null for a spell — then only
 *  the player total moves). `player` is who to credit the side total to. */
export function creditDamage(stats: MatchStats, source: CardInstance | null, player: PlayerId, amount: number): void {
  if (amount <= 0) return;
  stats.byPlayer[player].dmg += amount;
  if (source) cardRow(stats, source).dmg += amount;
}

/** Credit HP healed. `by` is the healer — a card (self-sustain or support) or a
 *  bare PlayerId (a heal spell). Null = uncredited. */
export function creditHeal(stats: MatchStats, by: CardInstance | PlayerId | null, amount: number): void {
  if (amount <= 0 || by == null) return;
  if (typeof by === "string") {
    stats.byPlayer[by].heal += amount;
  } else {
    stats.byPlayer[by.owner].heal += amount;
    cardRow(stats, by).heal += amount;
  }
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
