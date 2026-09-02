/** THE PLAYER, as opposed to the hero they field or the campaign they walk.
 *
 *  Two things live here and they share one reason to exist: both are derived
 *  from progress the game already stores, so neither can drift out of sync with
 *  what the player has actually done and neither needs migrating into old saves.
 *
 *  WHY ITS OWN MODULE. `void-tower.ts` imports `story.ts` (for DUPLICATE_CAP),
 *  so story cannot import the tower back without closing a cycle — and a player
 *  level counting boss kills needs both. This file imports down into each of
 *  them and nothing imports it back.
 */
import { VOID_BOSSES, bossDefeated } from "./void-tower";
import { getDef } from "./cards";
import type { StorySave } from "./story";

/** Bosses this save has put down, by card id, in floor order. */
export function bossesBeaten(save: StorySave): string[] {
  const done = save.eventsDone ?? [];
  return VOID_BOSSES.filter((b) => bossDefeated(done, b.cardId)).map((b) => b.cardId);
}

/** PLAYER LEVEL = cards collected + bosses beaten.
 *
 *  Deliberately a plain sum of two things the player can point at, not an XP
 *  curve. Both halves are already the two long arcs of the game — the
 *  collection fills over the whole campaign and the tower is the thing you come
 *  back to — so the number goes up for the two reasons a player would expect it
 *  to and never for grinding a third.
 *
 *  A boss is worth exactly one card, which looks cheap and is not: there are
 *  eighteen of them against a set of hundreds, so the tower is a small, slow
 *  contribution that only a player who actually clears floors will have. It is
 *  a level, not a score — the point is that two people with the same number got
 *  there different ways.
 */
export function playerLevel(save: StorySave): number {
  return new Set(save.collection ?? []).size + bossesBeaten(save).length;
}

/** The profile pictures this save has EARNED: one per boss it has beaten.
 *
 *  A head is proof, which is the whole appeal — you cannot buy it, roll it or
 *  craft it, and there is exactly one way to be wearing Spindle's. */
export function earnedAvatars(save: StorySave): string[] {
  return bossesBeaten(save);
}

/** Is this avatar legal for this save right now? Used on the way IN (the picker)
 *  and on the way OUT (the save loader), so a hand-edited localStorage cannot
 *  hand someone a head they never took. */
export function ownsAvatar(save: StorySave, cardId: string | undefined): boolean {
  return !!cardId && earnedAvatars(save).includes(cardId);
}

/** The avatar actually in force: the chosen one if it is still legal, else none
 *  (the UI falls back to the hero's initial). */
export function activeAvatar(save: StorySave): string | undefined {
  const want = save.hero?.avatar;
  return ownsAvatar(save, want) ? want : undefined;
}

/** The art plate for an avatar — the boss's own card art, cropped by CSS to the
 *  head. Named from the id like every other plate. */
export const avatarArt = (cardId: string): string =>
  `/cards/${getDef(cardId).art ?? cardId}.webp`;
