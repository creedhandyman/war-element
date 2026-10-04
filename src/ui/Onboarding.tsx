/** FIRST RUN — the guide from the free pack to the first story fight.
 *
 *  The scripted first battle (ui/tutorial.ts) teaches the rules by playing
 *  them. What it cannot do is show the way from there to a real match, and the
 *  path is not guessable:
 *
 *    · A fresh save owns ONE card (`STARTER_DECK` — `story.ts`) and is owed one
 *      free pack.
 *    · The first battle is L1, Spring Village Outskirts (`isFirstBattle`: free
 *      deployment, formation sized against what you can field).
 *
 *  So the guide is two steps — open the pack, fight L1 — with a third, "put
 *  them in your squad", only when a pack leaves cards benched (`foldIntoSquad`
 *  in story.ts puts the first pack straight in whenever it fits, so that is
 *  rare). `GuideOverlay.tsx` shows each as a spotlight on the real control.
 *
 *  AND THEN IT STOPS (owner, 2026-10-04). After L1 there used to be a five-card
 *  tour of the tabs (shards, Arena, Tower, the loop, "now train"), and an
 *  in-match coach explaining each idea as it came up. Playing it, the owner:
 *  "a pop-up for every single thing you do, making it hard to focus on
 *  battling." The first node lets the player fight; help comes as one line
 *  when they are stuck (StruggleTip.tsx), and the teaching is the Training
 *  Ground's, which loss screens point at.
 *
 *  DERIVED, NEVER STORED. Each step is computed from the save every render, so
 *  it cannot desync, doing a step early skips it, and a save made before this
 *  existed satisfies all three and never sees them.
 *
 *  NO SKIP. Every step is the one action without which the game does not
 *  start, its button goes straight there, and it clears by doing the deed —
 *  so there is nothing to skip and no "Skip unlocks after…" to explain.
 */
import type { StorySave } from "../data/story";
import { deckCapFor, everCleared, freePacks } from "../data/story";

/** The first battle, by id. The node itself is found through the region data
 *  (`isFirstBattle` identifies it structurally), but the guide has to NAME it. */
export const FIRST_NODE = "L1";

/** Where a step sends you, which is also where its anchor lives. */
export type GuideTab = "home" | "shop" | "story";

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
  /** One short line: what it is for. */
  body: string;
  /** The button, which goes there. */
  cta: string;
}

export const ONBOARDING_STEPS: OnboardStep[] = [
  {
    id: "pack",
    anchor: "shop-pack",
    tab: "shop",
    title: "Open your free pack",
    // SHORT, AND ONLY WHAT TO DO (owner, 2026-10-04). The first battle has
    // already taught the rules; these cards say where to go next.
    body: "Five new cards for your squad, at least one of them Epic or better.",
    cta: "Take me to it",
  },
  {
    id: "squad",
    anchor: "home-builder",
    tab: "home",
    title: "Put those cards in your squad",
    body: "Only your squad goes into battle. Add your new cards to it, then come back.",
    cta: "Build the squad",
  },
  {
    id: "fight",
    // The node panel's Fight button (StoryMap.tsx), not the Story tab: once the
    // map is up, ringing the nav docked this card over the button it describes.
    anchor: "story-fight",
    tab: "story",
    title: "Fight Spring Village Outskirts",
    // "Lead with one card": the opening deployment is ONE free card
    // (OPENING_SLOTS, phases.ts). This used to promise "you place your whole
    // squad before it starts", which stopped being true when that cap landed.
    body: "Your first story battle. Lead with one card, then buy the rest with Gold as it comes in.",
    cta: "Go to the map",
  },
];

const step = (id: string) => ONBOARDING_STEPS.find((s) => s.id === id)!;

/** Has the first pack been opened? A fresh save is owed exactly one, so the
 *  count falling to zero IS the deed. */
export const packOpened = (save: StorySave): boolean => freePacks(save) <= 0;

/** Has the teaching fight been won? EVER won: a veteran starting Hard mode has
 *  an empty map and a first fight far behind them, and must not be walked
 *  through it again. */
export const firstFightWon = (save: StorySave): boolean => everCleared(save).includes(FIRST_NODE);

/** Which step is due, or null when there is nothing left to show.
 *
 *  THE FIRST FIGHT CLOSES IT FOR GOOD, and that gate comes first: the
 *  conditions below describe a fresh save, and two of them are also true of a
 *  healthy established one. A veteran keeps cards in the collection that are
 *  not in the deck — that is what a collection IS — so asking "is anything
 *  benched?" of a thirty-node save would send them to build a squad they built
 *  long ago. Each condition asks the SAVE whether the deed is done, never
 *  whether the card was shown, so every step clears by simply doing it. */
export function onboardingStep(save: StorySave): OnboardStep | null {
  if (firstFightWon(save)) return null;
  if (!packOpened(save)) return step("pack");
  // "Has cards sitting in the collection that are not in the deck", rather
  // than "deck.length > 1": exactly the state a pack can leave.
  const benched = save.collection.filter((id) => !save.deck.includes(id)).length;
  if (benched > 0 && save.deck.length < deckCapFor(save.cleared)) return step("squad");
  return step("fight");
}

/** How far along, for the pips. Returns -1 when nothing is due. */
export const onboardingIndex = (s: OnboardStep | null): number =>
  s ? ONBOARDING_STEPS.findIndex((x) => x.id === s.id) : -1;

export const ONBOARDING_COUNT = ONBOARDING_STEPS.length;
