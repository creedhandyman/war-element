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
import { everCleared, type StorySave } from "./story";

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
  `/cards/${AVATAR_PLATE[cardId] ?? getDef(cardId).art ?? cardId}.webp`;

/** A head painted on a different plate than the card's own. Kato's first form is a
 *  vehicle with no head to frame; its Prowlform is a crystal panther with a
 *  snarling face, so that is the one worn as a profile picture. */
const AVATAR_PLATE: Record<string, string> = { boss_kato: "boss_kato_2" };

/** WHERE THE HEAD IS, per boss, and how far to zoom in on it.
 *
 *  A single crop rule cannot fit twenty paintings: Basilisk's head sits 34% down
 *  its plate, Thunderfangs' is 27% across, Kato is a tank with no head at all.
 *  Each was read off a percentage grid laid over the art, once, and recorded.
 *
 *  `x`/`y` are the CENTRE OF THE HEAD, as a percentage of the plate (0,0 is the
 *  top-left corner). They are NOT CSS `background-position` values - that was the
 *  bug in the first cut, which stored them as if they were: a background-position
 *  of y% lines the point y% down the image up with the point y% down the FRAME, so
 *  it only centres a point at infinite zoom. At the 200-600% used here it left
 *  every head several percent off and the frame on a chest or a shoulder.
 *  `avatarStyle` does the conversion, so what is recorded is what is seen.
 *
 *  `zoom` is `background-size`, so 300 means the art is drawn three frames wide.
 *  It varies because the SUBJECTS vary: Kheiringer's head is an eighth of her
 *  plate's width and Hoarfell's horns fill most of his. Aim for the head to fill
 *  a little over half the frame.
 */
export interface AvatarFocus { x: number; y: number; zoom: number }

export const AVATAR_FOCUS: Record<string, AvatarFocus> = {
  boss_rotroot:      { x: 52, y: 15, zoom: 300 },
  boss_skeleeze:     { x: 43, y: 21, zoom: 420 },
  boss_xilty:        { x: 53, y: 30, zoom: 260 },
  boss_permafrost:   { x: 47, y: 22, zoom: 210 },
  boss_overclock:    { x: 50, y: 22, zoom: 300 },
  boss_nightshrike:  { x: 56, y: 40, zoom: 240 },
  boss_basilisk:     { x: 62, y: 30, zoom: 230 },
  boss_helion:       { x: 41, y: 18, zoom: 330 },
  boss_hoarfell:     { x: 53, y: 34, zoom: 170 },
  boss_thunderfangs: { x: 27, y: 55, zoom: 210 },
  boss_vulcanyx:     { x: 78, y: 18, zoom: 260 },
  boss_umbranova:    { x: 50, y: 40, zoom: 200 },
  boss_cryovex:      { x: 62, y: 24, zoom: 300 },
  boss_kazehaya:     { x: 33, y: 27, zoom: 260 },
  boss_kato:         { x: 27, y: 53, zoom: 230 },
  boss_smolder:      { x: 37, y: 30, zoom: 260 },
  boss_spindle:      { x: 55, y: 27, zoom: 300 },
  boss_skybreaker:   { x: 47, y: 14, zoom: 280 },
  boss_continental:  { x: 63, y: 25, zoom: 260 },
  boss_kheiringer:   { x: 40, y: 11, zoom: 380 },
};

/** Plate height over width, where it is not the usual 4:3. Needed to centre a
 *  point VERTICALLY, since the art is drawn `zoom`% wide and its height follows. */
export const PLATE_ASPECT: Record<string, number> = {
  boss_thunderfangs: 1.249, boss_kato: 1.249,
  // 2:3 paintings from the 2026-10-08 art pass.
  boss_xilty: 1.5, boss_cryovex: 1.5, boss_kheiringer: 1.5, boss_skeleeze: 1.5,
  boss_nightshrike: 1.5, boss_basilisk: 1.5,
};

/** The focus for a head, with a sane fallback so a boss added tomorrow renders
 *  as a portrait crop rather than as nothing. */
export const avatarFocus = (cardId: string): AvatarFocus =>
  AVATAR_FOCUS[cardId] ?? { x: 50, y: 22, zoom: 380 };

/** The `background-position` percentage that puts the point `at` (0..1 along the
 *  art) in the MIDDLE of the frame, when the art is drawn `size` frames long on
 *  that axis. Clamped so the art always covers the frame. */
export function centreOn(at: number, size: number): number {
  if (size <= 1) return 50;
  const pos = ((at * size - 0.5) / (size - 1)) * 100;
  return Math.min(100, Math.max(0, pos));
}

/** The inline style that frames a head. One place, so the home row, the picker
 *  and anywhere else this lands cannot crop it three different ways. */
export function avatarStyle(cardId: string): Record<string, string> {
  const f = avatarFocus(cardId);
  const wide = f.zoom / 100;
  const tall = wide * (PLATE_ASPECT[cardId] ?? 4 / 3);
  const r = (n: number) => String(Math.round(n * 10) / 10);
  return {
    backgroundImage: `url(${avatarArt(cardId)})`,
    backgroundSize: `${f.zoom}% auto`,
    backgroundPosition: `${r(centreOn(f.x / 100, wide))}% ${r(centreOn(f.y / 100, tall))}%`,
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
    // EVER cleared, across a Hard run and the campaign before it.
    { label: "Nodes", value: everCleared(save).length, of: opts.totalNodes,
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
