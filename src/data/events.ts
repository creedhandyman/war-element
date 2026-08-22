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
import { type StorySave, addFreePacks, addShards } from "./story";
import type { CustomDeck } from "./custom-decks";
import { getDef } from "./cards";
import { VOID_TOWER_ROUNDS, type Element } from "../engine/types";
import { VOID_BOSSES, buildVoidEncounter, trialEventId } from "./void-tower";

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
  /** How many of the deck's cheapest cards are dealt first — a pre-orchestrated
   *  opening. The rest of the deck stays shuffled.
   *
   *  An event is a designed fight, and a designed fight should not hinge on
   *  whether the opponent happened to draw something it could afford. Gold is
   *  tight early, so a top-heavy list drawn at random simply stands there for
   *  the first few rounds and hands the player a free board.
   *
   *  A DEPTH rather than a flag, because sorting the WHOLE deck is not
   *  universally better and the measurement says so — see `restackByCost`.
   *
   *  A LIST of card ids instead of a number names the exact cards to hoist, for
   *  a fight that cares WHICH ones arrive. Void Trials use it: a boss's deck is
   *  its budgeted formation padded out with cheap tribe reinforcements, so
   *  "hoist the cheapest" would bury the formation the puzzle is about. */
  scriptedOpening?: number | readonly string[];
  /** The element this event's deck is. Asserted against the deck's actual
   *  contents by test — a mono-element event whose `el` drifted would be
   *  advertising the wrong fight. */
  el: Element;
  /** The accent it is dressed in: the tile border on Home, and the colour of
   *  the "Led by" line written over the art.
   *
   *  There used to be an `art` beside this, a region map from `/maps`. Home
   *  shows the LEADER of the deck now — see `homeEvents` in HomeScreen — which
   *  is derived from the card list rather than authored, so a deck that changed
   *  cannot keep advertising a face it no longer runs. The map field went with
   *  it rather than staying as config nothing reads. */
  rim: string;
  /** Packs owed on the FIRST clear.
   *
   *  Packs, not their price in shards. The first cut paid `PACK_COST` shards on
   *  the grounds that a pack is priced in shards so paying its price is the same
   *  thing — it is not. Shards are fungible: they read as currency rather than a
   *  prize, they can be spent in the crafter instead, they make the NEXT pack
   *  cheaper rather than free, and a later price change would silently re-value
   *  a gift that was supposed to be one pack. */
  rewardPacks: number;
  /** Shards paid the FIRST time this event is cleared, on top of the packs. */
  rewardShards?: number;
  /** Shards paid for clearing it AGAIN, every time after the first.
   *
   *  Most events cannot pay this because they cannot be replayed — they are
   *  one-time-only and leave the Home band once beaten. Void Tower trials can:
   *  the tower offers a Refight, and a floor you have already cleared is the
   *  only repeatable fight in the game that is genuinely hard. Lower than the
   *  first clear on purpose, so beating a boss for the first time stays the
   *  moment and the rest is a grind you chose. */
  replayShards?: number;
  deck: CustomDeck;
  /** A VOID TOWER TRIAL: this card id is placed on the opponent's home row at
   *  match start, outside the economy — the deck above is only its summons.
   *  The boss framework's test surface until the tower has a screen of its
   *  own; the fights are real, the mode around them is not here yet.
   *  See src/data/void-tower.ts. */
  bossId?: string;
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
  el: "DUSK", rim: "rgba(149,117,255,.5)",
  // One opening hand's worth. Measured across all eighteen 5x5 builds, 720
  // matches per depth: shuffled 42.8%, then 74.7 / 75.0 / 75.0 / 74.7% at
  // depths 3 / 5 / 8 / 30. The whole effect arrives by the third card and the
  // curve is flat after it, so this takes the plateau at its cheapest — the
  // opening hand is scripted and the other twenty-five cards are not.
  scriptedOpening: 5,
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

/** The Brightest Day — Darkest Night's opposite number, and deliberately its
 *  MIRROR rather than a second idea: 5×5, thirty mono-DAWN cards, eight spells,
 *  the same scripted opening and the same one pack. Two events that differ in
 *  difficulty as well as element give the player no way to read which one is
 *  the harder fight, so the only variable here is the element.
 *
 *  Written by hand rather than imported from a deck code, so unlike its sibling
 *  this list IS sorted by cost — there is no source transcript to check it
 *  against, and the curve is the thing worth being able to see.
 *
 *  ON THE CURVE. It is Darkest Night's, card for card: 4/4/4/5/5/2/3/1/1/1 from
 *  1 to 10. DAWN prints 39 buildable cards and the deck takes 30, and the nine
 *  that had to go happen to be exactly the nine that make the two curves match
 *  — so the comparison between the events is about the CARDS, not about which
 *  one ramps faster.
 *
 *  ON THE NINE DROPPED. Redundant halves of near-identical pairs — Oxin beside
 *  Musk Ox (both SP-2 BLOCK), Star beside Amble (Star's 2×2 is the half that
 *  shields eat), Zenith beside Ariel (7×1, SH2, SP7 both), Aurora beside
 *  Empyrean (Empyrean FLIES), Equestrian beside Supernova — plus the three
 *  cards that cannot cross a board: Vigil (SP 2, 1 DMG), Veil (SP 2) and
 *  WarPhant (SP 1, a 29 HP statue).
 *
 *  THAT LAST CUT IS WRONG AND THE MEASUREMENT SAYS SO. "99% of matches end by
 *  capture, so speed beats bulk" is true of the PLAYER's seat and backwards in
 *  this one. Putting the statues back, one cost-for-cost swap at a time, made
 *  the boss STRONGER every time — 87.5% as written, 91.2% with three of them
 *  back, 92.1% with all six swaps. The boss defends the home row it is already
 *  standing on; it does not need to cross anything, and a wall that will not
 *  die is exactly what a race wants parked on the contested slot. The list is
 *  left as written because it is the WEAKEST arrangement of this curve, which
 *  is the direction this event needed to go — see below.
 *
 *  ON DIFFICULTY, WHICH IS NOT ITS SIBLING'S. Against the same field — every
 *  5×5 premade, 20 seeds, 360 matches — Darkest Night wins 75.8% and this wins
 *  86.4%. That gap is the ELEMENT, not the build, and it is not tunable from
 *  here: every curve-preserving swap moved it the wrong way (above), and the
 *  scripted opening is a cliff rather than a slope (58.3 / 63.9 / 86.1 / 87.5 /
 *  87.5 / 87.5 at depths 0-5 — DAWN's plateau lands at 2 where DUSK's landed at
 *  3, and there is nothing between 64% and 86% to pick). Shuffled, with no help
 *  at all, this deck still wins 58.3% where its sibling won 42.8%.
 *
 *  So the inputs are mirrored and the element is allowed to be the difference,
 *  which is the whole point of an all-one-element event. It also agrees with
 *  what the balance table already says — DAWN 51.1%, DUSK 46.6%, the strongest
 *  and the weakest — and a mono build amplifies its element rather than hiding
 *  it. Faking parity here would mean deliberately building DAWN badly. */
export const BRIGHTEST_DAY: GameEvent = {
  id: "ev_brightest_day",
  name: "The Brightest Day",
  tag: "Event · one time only",
  blurb: "Thirty shades of DAWN on the large board, with eight spells and "
    + "every battle command. Beat it once and a free booster pack is yours.",
  boardSize: 5,
  el: "DAWN", rim: "rgba(240,200,90,.5)",
  // Five, because its sibling is five and mirroring is the point — not because
  // this deck needs it. Its plateau arrives at 2 (see the header); 3, 4 and 5
  // all measure the same, so this is the plateau taken at one opening hand's
  // worth, which is the same sentence Darkest Night's number is written in.
  scriptedOpening: 5,
  rewardPacks: 1,
  deck: {
    id: "ev_brightest_day_deck",
    name: "Brightest day",
    cards: [
      "dawn_sparkle", "dawn_sphere", "dawn_beam", "dawn_roy",
      "dawn_glime", "dawn_reflection", "dawn_shine", "dawn_stbern",
      "dawn_musk_ox", "dawn_amble", "dawn_lazor", "dawn_goldeneagle",
      "dawn_solstice", "dawn_golde", "dawn_ty", "dawn_solara", "dawn_ariel",
      "dawn_clipsey", "dawn_drakonbane", "dawn_radiance", "dawn_sircrest", "dawn_halo",
      "dawn_heir_tok", "dawn_kosmos",
      "dawn_aurelion", "dawn_commander", "dawn_leo",
      "dawn_dawn", "dawn_supernova", "dawn_imperator",
    ],
    // Costs 1 through 8, contiguous. DAWN prints ten spells and the two left
    // out are the top two, which is the same trim Darkest Night made — but for
    // a different reason, and it is worth being clear about which. Its cut was
    // redundancy; this one is that costs 2, 3, 7 and 8 are the four BATTLE
    // COMMANDS, and a book that reaches for Dawn's Judgment or Eternal Dawn has
    // to drop two of them to get there. The commands are what makes this book
    // DAWN's rather than eight assorted spells, so they set the ceiling.
    spells: [
      "dawn_sunbeam", "dawn_cleansing_light", "dawn_grace", "dawn_radiant_barrier",
      "dawn_dawns_grace", "dawn_blazing_sun", "dawn_judgment", "dawn_solar_flare",
    ],
  },
};

/** The Void Trials — one event per Floor-1 boss, generated FROM the boss data
 *  so the two can never disagree about a formation. These are the framework's
 *  playable test surface: real fights, one pack on a first clear, and no tower
 *  around them yet. When the mode ships its own screen, these come off the
 *  Home band and the bosses keep working unchanged. */
const VOID_TRIALS: GameEvent[] = VOID_BOSSES.map((b) => {
  const boss = getDef(b.cardId);
  const enc = buildVoidEncounter(b);
  return {
    id: trialEventId(b.cardId),
    name: boss.name,
    tag: "VOID TOWER TRIAL",
    // The puzzle AND the rule, because the seat's blurb is the last thing read
    // before the fight starts and the clock is not visible until it has.
    blurb: `${b.puzzle} Slay it within ${VOID_TOWER_ROUNDS} rounds.`,
    boardSize: enc.boardSize,
    scriptedOpening: enc.stacked.P2,
    el: boss.element,
    rim: "rgba(139,125,201,.5)",
    rewardPacks: 1,
    // A boss is the hardest fight in the game and, once cleared, the only hard
    // one you can go back to. 25 for the kill and 10 a refight — against the
    // Arena's 2 a win, which is the rate this is deliberately beating: the
    // Arena is infinite and a tower boss is not, so paying the tower better is
    // the same argument that makes an online win worth 10.
    rewardShards: 25,
    replayShards: 10,
    bossId: b.cardId,
    deck: { id: `void_deck_${b.cardId}`, name: `${boss.name}'s brood`, cards: enc.deck, spells: enc.spells },
  };
});

export const EVENTS: GameEvent[] = [DARKEST_NIGHT, BRIGHTEST_DAY, ...VOID_TRIALS];

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

/** Record the clear and pay for it.
 *
 *  The FIRST clear records the event and pays packs plus `rewardShards`. Both
 *  halves happen here rather than at the call site because they must not be
 *  able to happen separately.
 *
 *  A REPEAT clear records nothing — it is already recorded — and pays only
 *  `replayShards`, for the events that have one. This used to return the save
 *  untouched, and the safety of paying twice rested on that: a settle that ran
 *  again was a no-op. It no longer is, so the guard that matters is the
 *  caller's `settledMatch` ref, which fires this exactly once per match. That
 *  is the same guard the Arena's per-win shards have always relied on.
 *
 *  An event with no `replayShards` still returns the identical object on a
 *  repeat, so nothing changes for the one-time-only events. */
export function completeEvent(save: StorySave, id: string): StorySave {
  const event = EVENTS.find((e) => e.id === id);
  if (!event) return save;
  if (eventDone(save, id)) {
    return event.replayShards ? addShards(save, event.replayShards) : save;
  }
  const cleared = addFreePacks(
    { ...save, eventsDone: [...(save.eventsDone ?? []), id] }, event.rewardPacks,
  );
  return event.rewardShards ? addShards(cleared, event.rewardShards) : cleared;
}
