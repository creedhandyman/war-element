/** WHAT IS WAITING FOR YOU.
 *
 *  Home holds a daily reward and a stack of achievements to claim, the Shop
 *  holds free packs — and none of it said so from the bar. A player who opened
 *  the game, fought, and left never learned a reward had been sitting there,
 *  which is the cheapest reason to come back that the game already owns. A dot
 *  on the tab, no number: it says "something here", and the screen says what.
 *
 *  Pure, so a test can hand it any save. */
import type { StorySave } from "../data/story";
import { freePacks } from "../data/story";
import { dailyStatus, localDay } from "../data/daily";
import { claimableAchievements } from "../data/achievements";

export function navAttention(save: StorySave, today: string = localDay()): { home: boolean; shop: boolean } {
  return {
    home: !dailyStatus(save, today).claimed || claimableAchievements(save).length > 0,
    shop: freePacks(save) > 0,
  };
}
