/** FIRST RUN — the three things to do before you understand this game.
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
 *      (`applyPack` — `story.ts:1664`). So you open your one free pack, watch
 *      five cards fly out, and the Home tile still reads "1 CARD · CAP 6".
 *      Nothing on screen connects the pack you just opened to the squad you
 *      are about to fight with.
 *    · The first battle is L1, Spring Village Outskirts — already designed as
 *      a teaching fight (`isFirstBattle`: free deployment, formation sized
 *      one-for-one against what you can field) and labelled "The tutorial" in
 *      its own node data since the day it was written. It was just never
 *      pointed at.
 *
 *  So this is the missing half: open the pack, put the cards in your squad,
 *  go and fight the tutorial level. Three steps, then it is gone forever.
 *
 *  DERIVED, NEVER STORED. The current step is computed from the save every
 *  render rather than kept as a cursor, so it cannot desync from reality: open
 *  the pack from the Shop without being told to and the step is simply already
 *  done. That also means it self-heals for a save made before this existed —
 *  a player mid-campaign has all three conditions satisfied and never sees it.
 *
 *  It does NOT block anything. There is no modal, no forced order, no "you
 *  must tap here" — it is a card at the top of Home with the next step written
 *  on it and a button that takes you there, plus a Skip. That is the same
 *  posture `TutorialCoach` takes and for the same reason: this game's first
 *  node is a designed teaching fight, not a rail, and a tutorial that seizes
 *  the controls would be teaching a different game than the one being played.
 */
import type { StorySave } from "../data/story";
import { deckCapFor, freePacks } from "../data/story";

/** The sentinel written into `save.taught` when the player skips. Distinct
 *  from the coach's own "SKIP" — silencing the first-run guide and silencing
 *  the in-match lessons are two different decisions, and sharing one flag
 *  would make either choice turn off both. */
export const ONBOARDING_SKIP = "ONB_SKIP";

/** The first battle, by id. The node itself is found through the region data
 *  (`isFirstBattle` identifies it structurally), but the guide has to NAME it,
 *  and this is the id that owns the "The tutorial" note in `story.ts`. */
export const FIRST_NODE = "L1";

export interface OnboardStep {
  id: string;
  /** The imperative, on the card. */
  title: string;
  /** WHY it is worth doing — the half a checklist leaves out. */
  body: string;
  /** The button. It goes there; it does not merely point. */
  cta: string;
}

export const ONBOARDING_STEPS: OnboardStep[] = [
  {
    id: "pack",
    title: "Open your free pack",
    body: "You start with one card, and one pack waiting. Every pack holds an Epic or "
      + "better, so this is the squad you are about to fight with — open it first.",
    cta: "Open the pack",
  },
  {
    id: "squad",
    title: "Put those cards in your squad",
    body: "A pack fills your COLLECTION, not your squad — those are two different things, "
      + "and only the squad walks into a fight. Add your new cards, then come back.",
    cta: "Build the squad",
  },
  {
    id: "fight",
    title: "Fight Spring Village Outskirts",
    body: "Your first battle, and the one the game is built to teach you on: you place "
      + "your whole squad before it starts, and it is sized to whatever you bring. "
      + "The coach explains each idea as you meet it.",
    cta: "Go to the map",
  },
];

/** Which step is due, or null when there is nothing left to teach.
 *
 *  Each condition asks the SAVE whether the deed is done, never whether the
 *  card was shown — so every step is skippable by simply doing the thing.
 */
export function onboardingStep(save: StorySave): OnboardStep | null {
  if ((save.taught ?? []).includes(ONBOARDING_SKIP)) return null;
  // Cleared the first battle => the whole point of the guide has happened,
  // whatever route the player took to it.
  if (save.cleared.includes(FIRST_NODE)) return null;
  const step = (id: string) => ONBOARDING_STEPS.find((s) => s.id === id)!;

  if (freePacks(save) > 0) return step("pack");
  // "Has a squad worth fighting with" rather than "deck.length > 1": the honest
  // test is whether the player has cards sitting in the collection that are not
  // in the deck, which is exactly the state opening a pack leaves them in.
  const cap = deckCapFor(save.cleared);
  const benched = save.collection.filter((id) => !save.deck.includes(id)).length;
  if (benched > 0 && save.deck.length < cap) return step("squad");
  return step("fight");
}

/** How far along, for the pips. Returns -1 when nothing is due. */
export const onboardingIndex = (step: OnboardStep | null): number =>
  step ? ONBOARDING_STEPS.findIndex((s) => s.id === step.id) : -1;

export function Onboarding(props: {
  save: StorySave;
  onShop: () => void;
  onBuilder: () => void;
  /** Open the story map focused on the first node. */
  onFightFirst: () => void;
  onSkip: () => void;
}) {
  const step = onboardingStep(props.save);
  if (!step) return null;
  const i = onboardingIndex(step);
  const go = step.id === "pack" ? props.onShop
    : step.id === "squad" ? props.onBuilder
    : props.onFightFirst;

  return (
    <div className="onb" role="note">
      <div className="onb-head">
        <span className="onb-tag">Getting started</span>
        {/* Pips rather than "1 of 3": three steps is few enough to SHOW, and a
            filled pip says "done" in a way a numerator cannot. */}
        <span className="onb-pips" aria-label={`Step ${i + 1} of ${ONBOARDING_STEPS.length}`}>
          {ONBOARDING_STEPS.map((s, n) => (
            <i key={s.id} className={n < i ? "done" : n === i ? "on" : ""} aria-hidden="true" />
          ))}
        </span>
        <button className="onb-skip" onClick={props.onSkip} title="Hide this — you can still read How to play any time">
          Skip
        </button>
      </div>
      <div className="onb-title">{step.title}</div>
      <p className="onb-body">{step.body}</p>
      <button className="lockin onb-go" onClick={go}>{step.cta}</button>
    </div>
  );
}
