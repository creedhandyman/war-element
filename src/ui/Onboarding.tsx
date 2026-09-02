/** FIRST RUN — the walkthrough, and what it is allowed to skip.
 *
 *  The game had a tutorial already, and it was the wrong half of one.
 *  `TutorialCoach` explains the RULES beautifully — why you summon, what the
 *  Home row is, why speed decides the order — but it only ever speaks once a
 *  match has started. Nothing anywhere told a new player how to REACH that
 *  match, and the path is genuinely not guessable:
 *
 *    · A fresh save owns exactly ONE card (`STARTER_DECK` — `story.ts`) and is
 *      owed one free pack.
 *    · Opening that pack adds its cards to `collection` and **not** to `deck`
 *      (`applyPack` — `story.ts`). So you open your one free pack, watch five
 *      cards fly out, and the Home tile still reads "1 CARD · CAP 6". Nothing
 *      on screen connects the pack you just opened to the squad you are about
 *      to fight with.
 *    · The first battle is L1, Spring Village Outskirts — already designed as
 *      a teaching fight (`isFirstBattle`: free deployment, formation sized
 *      one-for-one against what you can field) and labelled "The tutorial" in
 *      its own node data since the day it was written. It was just never
 *      pointed at.
 *
 *  This file is the CURRICULUM. `GuideOverlay.tsx` is how it is shown — a
 *  spotlight on the real control rather than a card at the top of Home, which
 *  was the previous shape and the reason for this rewrite: "open your free
 *  pack" is only useful next to the pack.
 *
 *  TWO ARCS, and the difference between them is the whole skip rule.
 *
 *    THE CORE LOOP (pack -> squad -> first fight) cannot be skipped. It is not
 *    a lecture; it is the three actions without which the game does not start,
 *    and a player who dismisses it is left on a Home screen owning one card
 *    with no idea why. Each step still completes by DOING the deed, from
 *    anywhere, so "cannot skip" costs nothing to a player who already knows —
 *    they open the pack their own way and the step is simply already done.
 *
 *    THE TOUR (what the other tabs are for) can be skipped from its first step,
 *    because by then the player has played the game and has standing to say
 *    "I have got this". That is the line the owner drew: mandatory through the
 *    first pack opening and the first story fight, free after it.
 *
 *  DERIVED WHERE IT CAN BE. Core-loop steps are computed from the save every
 *  render rather than kept as a cursor, so they cannot desync from reality, and
 *  a save made before this existed satisfies all three and never sees them. The
 *  tour steps have no deed to test — "looked at the Arena" is not a thing the
 *  save records — so those advance by acknowledgement, into the same `taught`
 *  list `TutorialCoach` has always used.
 *
 *  IT DOES NOT BLOCK ANYTHING. See `GuideOverlay` — every dim panel is
 *  pointer-events:none. The posture is the coach's: this game's first node is a
 *  designed teaching fight, not a rail, and a tutorial that seizes the controls
 *  would be teaching a different game than the one being played.
 */
import type { StorySave } from "../data/story";
import { deckCapFor, freePacks } from "../data/story";

/** The sentinel written into `save.taught` when the player skips. Distinct
 *  from the coach's own "SKIP" — silencing the walkthrough and silencing the
 *  in-match lessons are two different decisions, and sharing one flag would
 *  make either choice turn off both. */
export const ONBOARDING_SKIP = "ONB_SKIP";

/** The first battle, by id. The node itself is found through the region data
 *  (`isFirstBattle` identifies it structurally), but the guide has to NAME it,
 *  and this is the id that owns the "The tutorial" note in `story.ts`. */
export const FIRST_NODE = "L1";

/** Where a step sends you, which is also where its anchor lives. */
export type GuideTab = "home" | "shop" | "story" | "arena" | "tower";

export interface OnboardStep {
  id: string;
  /** `data-guide` value of the control to spotlight. The element is found in
   *  the DOM at show time, so this file never encodes another one's layout. */
  anchor: string;
  /** The tab the anchor lives on. The guide switches to it before pointing —
   *  a spotlight on an element that is not rendered is a dimmed screen. */
  tab: GuideTab;
  /** The imperative. */
  title: string;
  /** WHY it is worth doing — the half a checklist leaves out. */
  body: string;
  /** The button. */
  cta: string;
  /** Core loop = cannot be skipped, and completes by doing the deed.
   *  Tour = skippable, and completes by acknowledgement. */
  core: boolean;
}

export const ONBOARDING_STEPS: OnboardStep[] = [
  // ── the core loop ──────────────────────────────────────────────────────
  {
    id: "pack",
    anchor: "shop-pack",
    tab: "shop",
    title: "Open your free pack",
    body: "You start with one card, and one pack waiting. Every pack holds an Epic or "
      + "better, so this is the squad you are about to fight with — open it first.",
    cta: "Take me to it",
    core: true,
  },
  {
    id: "squad",
    anchor: "home-builder",
    tab: "home",
    title: "Put those cards in your squad",
    body: "A pack fills your COLLECTION, not your squad — those are two different things, "
      + "and only the squad walks into a fight. Add your new cards, then come back.",
    cta: "Build the squad",
    core: true,
  },
  {
    id: "fight",
    anchor: "nav-story",
    tab: "story",
    title: "Fight Spring Village Outskirts",
    body: "Your first battle, and the one the game is built to teach you on: you place "
      + "your whole squad before it starts, and it is sized to whatever you bring. "
      + "The coach explains each idea as you meet it.",
    cta: "Go to the map",
    core: true,
  },

  // ── the tour, unlocked and skippable once the above is done ────────────
  {
    id: "purse",
    anchor: "home-purse",
    tab: "home",
    title: "Shards and essence",
    body: "Shards buy packs. Essence is per-element and crafts a specific card you want "
      + "instead of hoping for it. Both come out of fights, so the campaign pays for "
      + "the collection that fights it.",
    cta: "Next",
    core: false,
  },
  {
    id: "arena",
    anchor: "nav-arena",
    tab: "arena",
    title: "The Arena",
    body: "Duels against the AI or another player, with your own deck. There is a ladder "
      + "behind it that raises the opponent as you win, and a Gauntlet run of four in a "
      + "row when you want a real one.",
    cta: "Next",
    core: false,
  },
  {
    id: "tower",
    anchor: "nav-tower",
    tab: "tower",
    title: "The Void Tower",
    body: "Five floors of boss puzzles, each one a stated problem rather than a bigger "
      + "enemy — break the wall, survive the lock, reach the source. Beat one and you can "
      + "tame the boss and take it with you.",
    cta: "Next",
    core: false,
  },
  {
    id: "shop",
    anchor: "nav-shop",
    tab: "shop",
    title: "That is the loop",
    body: "Fight, earn, open, rebuild, fight something harder. The Shop is where the first "
      + "and last of those meet. How to play is in the menu whenever you want the rules "
      + "again.",
    cta: "Done",
    core: false,
  },
];

const CORE_STEPS = ONBOARDING_STEPS.filter((s) => s.core);

const step = (id: string) => ONBOARDING_STEPS.find((s) => s.id === id)!;

/** Has the first pack been opened? A fresh save is owed exactly one, so the
 *  count falling to zero IS the deed. */
export const packOpened = (save: StorySave): boolean => freePacks(save) <= 0;

/** Has the teaching fight been won? */
export const firstFightWon = (save: StorySave): boolean => save.cleared.includes(FIRST_NODE);

/** MAY the player dismiss the walkthrough yet?
 *
 *  Only once both milestones are behind them — the owner's rule, and the reason
 *  the core arc has no Skip button at all rather than a disabled one. Before
 *  this, the way past a step is to do it, which is never more than one tap away
 *  because the step's own button goes there. */
export const canSkipGuide = (save: StorySave): boolean =>
  packOpened(save) && firstFightWon(save);

/** Which step is due, or null when there is nothing left to teach. */
export function onboardingStep(save: StorySave): OnboardStep | null {
  const taught = save.taught ?? [];
  // THE GATE IS IN THE MODEL, not only in the missing button. `GuideOverlay`
  // is handed no `onSkip` during the core arc, so there is nothing to press —
  // but "cannot be skipped" that is enforced by a hidden control is a rule any
  // stale sentinel walks straight through, and this save field is written by
  // three different places. Honoured only once it may be honoured.
  if (taught.includes(ONBOARDING_SKIP) && canSkipGuide(save)) return null;

  // ── core loop. THE FIRST FIGHT CLOSES IT FOR GOOD, and that gate comes
  // FIRST rather than last: the conditions below describe a fresh save, and two
  // of them are also true of a perfectly healthy established one. A veteran
  // keeps cards in the collection that are not in the deck — that is what a
  // collection IS — so asking "is anything benched?" of a thirty-node save
  // answers yes and tells them to go and build a squad they built long ago.
  //
  // Each condition asks the SAVE whether the deed is done, never whether the
  // card was shown, so every step clears by simply doing it.
  if (!firstFightWon(save)) {
    if (!packOpened(save)) return step("pack");
    // "Has a squad worth fighting with" rather than "deck.length > 1": the
    // honest test is whether the player has cards sitting in the collection
    // that are not in the deck, which is exactly the state a pack leaves.
    const benched = save.collection.filter((id) => !save.deck.includes(id)).length;
    if (benched > 0 && save.deck.length < deckCapFor(save.cleared)) return step("squad");
    return step("fight");
  }

  // ── the tour: no deed to test, so these advance on acknowledgement.
  //
  // ONLY IN THE WINDOW RIGHT AFTER THE TUTORIAL. Without this the tour would
  // ambush every established player the day it shipped — a save with thirty
  // nodes cleared has `taught` empty for these ids and would be walked through
  // "this is the Arena" as though it were new. The core arc never had that
  // problem because all three of its conditions are already satisfied on an old
  // save; the tour has no deed to satisfy, so it needs the window stated.
  //
  // Clearing anything BEYOND the first battle closes it, which is also the
  // right rule for a new player: someone who has gone off and won a second node
  // has demonstrated they can find their way around, and finishing the tour at
  // them is answering a question they stopped asking.
  if (save.cleared.some((id) => id !== FIRST_NODE)) return null;
  return ONBOARDING_STEPS.find((s) => !s.core && !taught.includes(s.id)) ?? null;
}

/** How far along, for the pips. Returns -1 when nothing is due.
 *
 *  Counted over the WHOLE curriculum rather than per-arc: the pips are a "how
 *  much of this is left" and splitting them at the skip line would restart the
 *  count at the exact moment the player earned the right to stop. */
export const onboardingIndex = (s: OnboardStep | null): number =>
  s ? ONBOARDING_STEPS.findIndex((x) => x.id === s.id) : -1;

export const ONBOARDING_COUNT = ONBOARDING_STEPS.length;
export const ONBOARDING_CORE_COUNT = CORE_STEPS.length;

/** What stands where the Skip button will be, while it is still locked. Says
 *  which of the two milestones is outstanding, because "you cannot skip yet" on
 *  its own is a rule without a way to satisfy it. */
export function skipLockedNote(save: StorySave): string {
  if (!packOpened(save)) return "Skip unlocks after your first pack and first battle";
  if (!firstFightWon(save)) return "Skip unlocks after your first battle";
  return "";
}
