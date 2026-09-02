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

/** WHERE THE HEAD IS, per boss, and how far to zoom in on it.
 *
 *  A single crop rule cannot fit twenty paintings. The first cut used one
 *  (`object-position: 50% 14%`) and it worked for exactly the boss it was
 *  written against: Basilisk's head sits at 60% DOWN the canvas, so the frame
 *  showed swamp canopy; Thunderfangs is at 27% ACROSS; Kato is a tank with no
 *  head at all. Read off each plate by eye, once, and recorded.
 *
 *  `x`/`y` are the point in the ART that should land in the middle of the frame,
 *  as a percentage — the exact semantics of `background-position` when the image
 *  is larger than its box. That is why this renders as a background rather than
 *  an <img>: with `object-fit: cover` on a SQUARE frame, a 3:4 plate is scaled
 *  until the width fits exactly, so the horizontal crop is a no-op and
 *  `object-position`'s X is silently ignored. Half the control was missing.
 *
 *  `zoom` is `background-size`, so 400 means the art is drawn four frames wide.
 *  It varies because the SUBJECTS vary: Kheiringer's face is a twentieth of her
 *  plate and Kato's prow is a third of its.
 */
export interface AvatarFocus { x: number; y: number; zoom: number }

export const AVATAR_FOCUS: Record<string, AvatarFocus> = {
  boss_rotroot:      { x: 45, y: 13, zoom: 520 },
  boss_skeleeze:     { x: 37, y: 31, zoom: 560 },
  boss_xilty:        { x: 48, y: 30, zoom: 470 },
  boss_permafrost:   { x: 32, y: 18, zoom: 430 },
  boss_overclock:    { x: 44, y: 23, zoom: 520 },
  boss_nightshrike:  { x: 48, y: 41, zoom: 520 },
  boss_basilisk:     { x: 47, y: 56, zoom: 330 },
  boss_helion:       { x: 44, y: 18, zoom: 520 },
  boss_hoarfell:     { x: 50, y: 26, zoom: 400 },
  boss_thunderfangs: { x: 26, y: 56, zoom: 360 },
  boss_vulcanyx:     { x: 72, y: 17, zoom: 300 },
  boss_umbranova:    { x: 48, y: 44, zoom: 380 },
  boss_cryovex:      { x: 61, y: 30, zoom: 430 },
  boss_kazehaya:     { x: 37, y: 22, zoom: 480 },
  boss_kato:         { x: 32, y: 58, zoom: 260 },
  boss_smolder:      { x: 38, y: 30, zoom: 480 },
  boss_spindle:      { x: 52, y: 26, zoom: 380 },
  boss_skybreaker:   { x: 47, y: 17, zoom: 560 },
  boss_continental:  { x: 60, y: 19, zoom: 480 },
  boss_kheiringer:   { x: 60, y: 18, zoom: 650 },
};

/** The focus for a head, with a sane fallback so a boss added tomorrow renders
 *  as a portrait crop rather than as nothing. */
export const avatarFocus = (cardId: string): AvatarFocus =>
  AVATAR_FOCUS[cardId] ?? { x: 50, y: 22, zoom: 450 };

/** The inline style that frames a head. One place, so the home row, the picker
 *  and anywhere else this lands cannot crop it three different ways. */
export function avatarStyle(cardId: string): Record<string, string> {
  const f = avatarFocus(cardId);
  return {
    backgroundImage: `url(${avatarArt(cardId)})`,
    backgroundSize: `${f.zoom}% auto`,
    backgroundPosition: `${f.x}% ${f.y}%`,
    backgroundRepeat: "no-repeat",
  };
}

// ── all-time stats ──────────────────────────────────────────────────────────

/** One line of the profile panel. `of` is present when the stat is a fraction
 *  of a known total, which is most of them — "34 cards" says less than
 *  "34 / 381", and a completion percentage is the whole appeal of a collection. */
export interface PlayerStat { label: string; value: number; of?: number; hint: string }

/** EVERY NUMBER THE SAVE ALREADY KNOWS, in one place.
 *
 *  Derived, never stored: each of these is counted off the save at read time, so
 *  there is no second copy to drift and no migration for a save written before
 *  the panel existed. A stat that cannot be computed from what the game already
 *  persists does not belong here — it would mean adding a counter that only this
 *  screen reads, and counters like that are how two screens end up disagreeing.
 */
export function playerStats(save: StorySave, opts: {
  totalCards: number; totalNodes: number;
}): PlayerStat[] {
  const beaten = bossesBeaten(save).length;
  const hero = save.hero;
  return [
    { label: "Level", value: playerLevel(save),
      hint: "Cards collected plus bosses beaten" },
    { label: "Cards", value: new Set(save.collection ?? []).size, of: opts.totalCards,
      hint: "Unique cards in your collection" },
    { label: "Bosses", value: beaten, of: VOID_BOSSES.length,
      hint: "Void Tower bosses put down — each one is a head you may wear" },
    { label: "Nodes", value: new Set(save.cleared ?? []).size, of: opts.totalNodes,
      hint: "Campaign nodes cleared at least once" },
    { label: "Shinies", value: (hero?.shiny ?? []).length,
      hint: "Foil cards pulled" },
    { label: "Tamed", value: Object.keys(save.tamed ?? {}).length,
      hint: "Bosses that now fight for you" },
    { label: "Best streak", value: save.ladder?.best ?? 0,
      hint: "Longest Arena win streak" },
    { label: "Shards", value: hero?.shards ?? 0,
      hint: "Booster currency, earned by winning anywhere" },
    { label: "Essence", value: Object.values(hero?.essence ?? {}).reduce((a, b) => a + b, 0),
      hint: "Crafting currency, across every element" },
  ];
}
