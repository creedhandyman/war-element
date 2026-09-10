/** LEVELLING UP — noticing it, paying for it, and only saying so once.
 *
 *  `playerLevel` is DERIVED (`collection.size + bossesBeaten.length`), not
 *  stored, so there has never been a moment the game could point at and call a
 *  level-up: a pack that adds five new cards moves the number five times
 *  between one render and the next. That is why this keeps a HIGH-WATER MARK
 *  rather than an event — `levelSeen` is the last level the player was actually
 *  shown and paid for, and everything above it is owed.
 *
 *  ONE POPUP, however many levels. A five-card pack that crosses two levels is
 *  one thing that happened, not two, and a queue of modals to dismiss is a
 *  worse reward than the shards. So the span is claimed whole: 12 -> 15 pays
 *  for 13, 14 and 15 together and says so on one screen.
 *
 *  AND THE PAST IS PAID, ONCE. This originally owed nothing retroactively —
 *  a save predating the feature started counting from wherever it stood, on
 *  the reasoning that a player at level 300 should not be handed six hundred
 *  shards for a popup that did not exist when they earned them.
 *
 *  That reasoning protected the economy and shortchanged the player, and it
 *  is the player who did the levelling. Every one of those levels was earned:
 *  a card collected, a boss beaten. `RETRO_LEVEL_FLOOR` is the one-time
 *  rewind that pays for them, delivered through the `GIFTS` ledger in
 *  story.ts so it fires exactly once per save and never for a new one.
 *
 *  It is smaller than it sounds, and self-limiting: the level IS the
 *  collection (`collection.size + bossesBeaten.length`), so the players owed
 *  the most are the ones who already own the most cards, and packs are worth
 *  least to exactly them. Level 20 pays 48 shards — one pack. Level 100 pays
 *  248 and two free packs. A full collection at 360 pays 898 and seven, to
 *  somebody with nothing left to open.
 */

import { playerLevel } from "./player";
import { addFreePacks, addShards, type StorySave } from "./story";

/** Shards for each level crossed. */
export const LEVEL_SHARDS = 2;
/** Every Nth level pays a bonus on top of the per-level shards. */
export const MILESTONE_EVERY = 10;
export const MILESTONE_SHARDS = 5;
/** Every Nth level is worth a free pack. */
export const PACK_EVERY = 50;

export interface LevelReward {
  /** Levels actually crossed. Zero means nothing is owed. */
  levels: number;
  from: number;
  to: number;
  shards: number;
  packs: number;
  /** The milestone levels inside the span, for the popup to name. */
  milestones: number[];
  /** The pack levels inside the span. A subset of the above at these numbers,
   *  but listed separately because a pack is the rarer thing to shout about. */
  packLevels: number[];
}

/** The level this save has already been shown.
 *
 *  Absent = the save predates the feature, and the answer is the CURRENT level:
 *  everything earned before there was a popup is already spent, and paying for
 *  it now would be a windfall nobody played for.
 *
 *  That fallback is right exactly ONCE, which is why `loadStory` writes the
 *  mark on the way out when a save has none. Left unwritten it would follow the
 *  level upward forever and no level-up would ever fire — the feature would be
 *  silently dead rather than wrong. A new save starts at level 1 (one starter
 *  card), so a new player's first level-up is the SECOND card they collect;
 *  the starter is a gift, not a level they earned. */
export const seenLevel = (save: StorySave): number =>
  save.levelSeen ?? playerLevel(save);

/** Where a one-time retroactive rewind starts counting from.
 *
 *  ONE, not zero. A new save is level 1 off its single starter card, and
 *  that card is a gift rather than a level anybody earned — the same line
 *  `loadStory` draws when it stamps a brand-new save. Paying from 0 would
 *  hand every player two shards for being given a card.
 *
 *  Used by the `retro-levels` gift, which rewinds `levelSeen` to this and
 *  lets the ordinary popup do the paying. Deliberately NOT a second payment
 *  path: `claimLevelUp` stays the only thing that ever moves the mark, so
 *  there is still exactly one place a level can be paid for twice, and it
 *  is already idempotent. */
export const RETRO_LEVEL_FLOOR = 1;

/** Rewind the mark so everything since `RETRO_LEVEL_FLOOR` is owed again.
 *
 *  A no-op on a save already at or below the floor, so a brand-new player
 *  cannot be handed a popup that pays nothing. */
export const rewindLevelSeen = (save: StorySave): StorySave =>
  seenLevel(save) <= RETRO_LEVEL_FLOOR
    ? save
    : { ...save, levelSeen: RETRO_LEVEL_FLOOR };

/** What crossing `from` -> `to` is worth. Pure, and exported on its own so the
 *  popup can price a span without a save in hand. */
export function levelRewards(from: number, to: number): LevelReward {
  const lo = Math.max(0, Math.floor(from));
  const hi = Math.max(lo, Math.floor(to));
  const milestones: number[] = [];
  const packLevels: number[] = [];
  for (let n = lo + 1; n <= hi; n++) {
    if (n % MILESTONE_EVERY === 0) milestones.push(n);
    if (n % PACK_EVERY === 0) packLevels.push(n);
  }
  const levels = hi - lo;
  return {
    levels,
    from: lo,
    to: hi,
    // The milestone pays ON TOP of the per-level shards rather than instead of
    // them — level 10 is worth 2 + 5, not 5. "Every 10 levels" reads as a bonus
    // and a bonus that replaced the base would make level 10 worth less than
    // level 11.
    shards: levels * LEVEL_SHARDS + milestones.length * MILESTONE_SHARDS,
    packs: packLevels.length,
    milestones,
    packLevels,
  };
}

/** Levels owed to this save, or null when it is square. */
export function pendingLevelUp(save: StorySave): LevelReward | null {
  const r = levelRewards(seenLevel(save), playerLevel(save));
  return r.levels > 0 ? r : null;
}

/** Pay for every level owed and mark them seen.
 *
 *  Idempotent by construction: it writes `levelSeen` to the level it just paid
 *  up to, so a second call finds nothing owed. That matters because the popup
 *  can be dismissed by a skip, a claim or a route change, and all three land
 *  here — paying twice for one pack of cards is the failure this shape
 *  prevents rather than guards against.
 *
 *  SKIPPING STILL PAYS. The button closes a message, not an envelope; a reward
 *  you have to sit through an animation to receive is a toll. */
export function claimLevelUp(save: StorySave): StorySave {
  const owed = pendingLevelUp(save);
  if (!owed) return save;
  let next: StorySave = { ...save, levelSeen: owed.to };
  if (owed.shards > 0) next = addShards(next, owed.shards);
  if (owed.packs > 0) next = addFreePacks(next, owed.packs);
  return next;
}

/** Mark the current level seen WITHOUT paying — for a save being created or
 *  migrated, where the levels were never earned under this feature. */
export const settleLevelSeen = (save: StorySave): StorySave =>
  save.levelSeen === playerLevel(save) ? save : { ...save, levelSeen: playerLevel(save) };
