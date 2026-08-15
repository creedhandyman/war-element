/** Events — a fixed opponent posted on Home, beaten once, paid once.
 *
 *  HomeScreen's own header explains why its middle band takes its content from
 *  live state instead of inventing a timed-events system: hardcoded copy for
 *  content that never changes and never expires is "a live dot next to a lie".
 *  This is the smallest thing that earns that dot honestly. It is not a timed
 *  system and deliberately does not pretend to be one — there is no clock, no
 *  window and no expiry. What makes it an event rather than another Arena seat
 *  is that it is available ONCE: beat it and it leaves the band for good.
 *
 *  So the only state it needs is a set of ids that are done, which is why there
 *  is no `events` table here — `StorySave.eventsDone` is a string[] and the
 *  whole feature is that array plus a deck.
 *
 *  ON PAYING EXACTLY ONCE. The reward is granted inside the same set-membership
 *  check that records the clear, in one write: `completeEvent` returns the save
 *  UNCHANGED if the id is already there, so re-entering the effect, a double
 *  render or a reloaded tab replaying the settle cannot pay twice. There is no
 *  separate "claim" step for the same reason — two flags is two chances to
 *  disagree, and a reward you have to go and collect is a reward you can lose.
 *
 *  ON THE DECK. Not a `PremadeDeck`. It must not reach `premadeDecksFor`, or it
 *  would be pickable as an ordinary opponent and the event would be farmable
 *  from the Arena's own deck sheet; and it must not reach `PREMADE_DECKS`, or
 *  the Arena's `againstPremade` check would pay win-shards for it on top of the
 *  pack. It is a `CustomDeck` that lives in code, reachable only through the
 *  Home card that starts it.
 */
import { type StorySave, addFreePacks } from "./story";
import type { CustomDeck } from "./custom-decks";

export interface GameEvent {
  id: string;
  /** Shown as the card's title. */
  name: string;
  /** The card's eyebrow — where this sits, in the band's own voice. */
  tag: string;
  /** One line on what you are walking into. */
  blurb: string;
  /** The battlefield this is fought on. The deck is sized for it. */
  boardSize: 4 | 5;
  /** Draw this deck ON CURVE — cheapest first — instead of shuffled.
   *
   *  An event is a designed fight, and a designed fight should not hinge on
   *  whether the opponent happened to draw something it could afford. Gold is
   *  tight early, and a top-heavy list drawn at random simply stands there for
   *  the first few rounds and hands the player a free board. Scripted, it ramps:
   *  1-drops on round one, then up the curve as the gold arrives.
   *
   *  It also makes the fight REPEATABLE in the sense a boss should be — the
   *  same opponent every attempt, so losing teaches you something. */
  scriptedOpening?: boolean;
  /** Packs owed on the FIRST clear.
   *
   *  Packs, not their price in shards. The first cut paid `PACK_COST` shards on
   *  the grounds that a pack is priced in shards so paying its price is the same
   *  thing — it is not. Shards are fungible: they read as currency rather than a
   *  prize, they can be spent in the crafter instead, they make the NEXT pack
   *  cheaper rather than free, and a later price change would silently re-value
   *  a gift that was supposed to be one pack. */
  rewardPacks: number;
  deck: CustomDeck;
}

/** Darkest Night — 30 mono-DUSK cards and the full eight-spell book.
 *
 *  Imported from a deck code rather than written here by hand, which is why the
 *  list is in the code's own order instead of by cost: it is a transcription,
 *  and re-sorting it would make it harder to check against the source. Two ids
 *  do not match their display names and are the reason this was verified card
 *  by card against `cards.ts` — Harrow is `dusk_harve`, Vesper is `dusk_scar`,
 *  and the Shadow Horsemen are `dusk_shadowhorsemen` with no second underscore.
 *
 *  Mono-element is a measured WEAKNESS in this pool, not a strength — taking 30
 *  of an element's ~39 buildable cards forces its weak cards in, and mono builds
 *  ran 51–54% against the mixed 57–63%. It is here because it is the deck the
 *  code carries and because a themed one-off should look like its theme; the
 *  difficulty is 5×5 and a full book, not the element. */
export const DARKEST_NIGHT: GameEvent = {
  id: "ev_darkest_night",
  name: "Darkest Night",
  tag: "Event · one time only",
  blurb: "Thirty shades of DUSK on the large board, with all eight spells. "
    + "Beat it once and a free booster pack is yours.",
  boardSize: 5,
  scriptedOpening: true,
  rewardPacks: 1,
  deck: {
    id: "ev_darkest_night_deck",
    name: "Darkest night",
    cards: [
      "dusk_pumpkin", "dusk_spider", "dusk_vamp", "dusk_zombie_husk", "dusk_gravekeeper",
      "dusk_harve", "dusk_jackl", "dusk_skeleton_knight", "dusk_silkstalker", "dusk_gool",
      "dusk_scarlett", "dusk_skulldrake", "dusk_zhunk", "dusk_ghastly", "dusk_haunt",
      "dusk_plaguecrow", "dusk_reaper", "dusk_brute", "dusk_ender", "dusk_rip",
      "dusk_violet", "dusk_wedded_wraith", "dusk_ravven", "dusk_scar", "dusk_destro",
      "dusk_hoax", "dusk_zombination", "dusk_nightfang", "dusk_skullking", "dusk_shadowhorsemen",
    ],
    // The full eight the large board allows — five carried by the deck code and
    // three added to fill it, because a 5×5 book is eight and walking in with
    // five is fighting the format rather than the deck. DUSK prints exactly ten
    // spells, so this is eight of ten: the cost curve runs 1-2-3-4-5-6-7 and
    // then Endless Night on top. Left out: Grave Pit and Harvest, the two that
    // sat redundantly beside Phantom Spikes at the top end.
    spells: [
      "dusk_chill_touch", "dusk_bone_snare", "dusk_shadow_step", "dusk_veil_of_shadows",
      "dusk_wake_of_the_dead", "dusk_nightfall", "dusk_phantom_spikes", "dusk_endless_night",
    ],
  },
};

export const EVENTS: GameEvent[] = [DARKEST_NIGHT];

/** Every event deck, for the resolver that turns a seat's deck id into cards.
 *  Kept apart from `PREMADE_DECKS` on purpose — see the header. */
export const EVENT_DECKS: CustomDeck[] = EVENTS.map((e) => e.deck);

/** The event a given opponent deck id belongs to, if any. This is how the
 *  settle path recognises an event match without a second piece of state
 *  saying which one is running: the deck in the seat IS the answer. */
export const eventForDeck = (deckId: string): GameEvent | undefined =>
  EVENTS.find((e) => e.deck.id === deckId);

/** Has this event been beaten? */
export const eventDone = (save: StorySave, id: string): boolean =>
  (save.eventsDone ?? []).includes(id);

/** Events still open to the player, in listing order. */
export const openEvents = (save: StorySave): GameEvent[] =>
  EVENTS.filter((e) => !eventDone(save, e.id));

/** Record the clear and pay the reward, exactly once.
 *
 *  Returns the SAME object when the event is already done, so the caller's
 *  `next !== prev` guard skips the write and nothing is paid a second time.
 *  Both halves happen here rather than at the call site because they must not
 *  be able to happen separately. */
export function completeEvent(save: StorySave, id: string): StorySave {
  const event = EVENTS.find((e) => e.id === id);
  if (!event || eventDone(save, id)) return save;
  return addFreePacks({ ...save, eventsDone: [...(save.eventsDone ?? []), id] }, event.rewardPacks);
}
