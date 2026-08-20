// The tutorial, such as it is — a coach that teaches the game WHILE the first
// fight happens, rather than a scripted rail.
//
// The game already tells you what to DO: `hint` in App.tsx names the action for
// every phase ("click a glowing hand card to summon", "choose Basic, Special or
// Skip"). What nothing said is WHY — why you are summoning, what winning looks
// like, why the cards act in that order. A new player could follow every hint
// to the letter and still not know the game is a race for the enemy's Home row.
// That gap is what this fills, so it sits ABOVE the hint row and complements it
// instead of repeating it.
//
// Not a rail: it never blocks input, never forces an order, and never waits for
// the "right" move. A scripted tutorial would have to own the board, and this
// game's first node already IS a designed teaching fight (`isFirstBattle` —
// one card against two, free placement, measured to be unloseable but not
// automatic). The coach explains that fight; it does not replace it.
//
// Each step is shown ONCE, ever, and remembered in the save — so it teaches a
// player rather than nagging one. `taught` comes from `StorySave.taught`.
import { useEffect, useState } from "react";
import type { GameState, PlayerId } from "../engine";

export interface TutorialStep {
  id: string;
  title: string;
  body: string;
}

/** The curriculum, in the order the game itself introduces each idea.
 *
 *  Deliberately short: five ideas, one screen each, no card names. A tutorial
 *  that teaches the whole rulebook is the rulebook, and that already exists
 *  under "How to play" for anyone who wants it. */
export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: "goal",
    title: "How you win",
    body: "Get your cards onto the enemy's Home row — the far line — and hold those "
      + "squares. Killing everything works too, but almost every match is decided by "
      + "the race for that row. Play like it is a race, because it is one.",
  },
  {
    id: "mulligan",
    title: "Your opening hand",
    body: "Send back anything you cannot afford yet. Gold arrives slowly, so a hand of "
      + "expensive cards is a hand of cards you watch instead of play.",
  },
  {
    id: "summon",
    title: "Gold, and your Home row",
    body: "Cards arrive in YOUR Home row, and only there — so a full Home row means you "
      + "cannot summon until something moves forward. Income is one Gold a round, plus "
      + "one for every Home square you are still standing on.",
  },
  {
    id: "move",
    title: "One move a turn",
    body: "You may summon as much as you can afford, but you may move only ONE card each "
      + "turn. That single move is the whole tempo of the game — spend it on the card "
      + "that is closest to arriving.",
  },
  {
    id: "battle",
    title: "Speed decides the order",
    body: "When Prep ends, every card acts once, fastest first. That is what SP buys: not "
      + "just distance, but going before the card that was about to kill you.",
  },
];

export function TutorialCoach(props: {
  game: GameState;
  /** The seat the local player holds — steps only fire on your own turn. */
  me: PlayerId | null;
  taught: string[];
  onTaught: (id: string) => void;
  onSkipAll: () => void;
}) {
  const { game, me, taught } = props;
  const [dismissed, setDismissed] = useState<string | null>(null);

  /** Which idea does the board want explained right now?
   *
   *  Ordered by specificity, not by curriculum order: the goal leads because it
   *  is the frame for everything else, and the rest follow the phases as the
   *  player meets them. A step already taught falls through to the next. */
  const due = ((): TutorialStep | null => {
    const step = (id: string) => TUTORIAL_STEPS.find((s) => s.id === id)!;
    const untaught = (id: string) => !taught.includes(id);
    if (game.phase === "gameover") return null;
    if (untaught("goal")) return step("goal");
    if (game.phase === "mulligan" && untaught("mulligan")) return step("mulligan");
    // Deployment reuses the prep phase but nothing may move, so the move lesson
    // would be a lie during it — hold it until the ordinary prep turn.
    if (game.phase === "prep" && game.opening && untaught("summon")) return step("summon");
    if (game.phase === "prep" && !game.opening) {
      if (untaught("summon")) return step("summon");
      if (untaught("move")) return step("move");
    }
    if (game.phase === "battle" && untaught("battle")) return step("battle");
    return null;
  })();

  // A new step clears the local dismissal, so tapping "Got it" advances rather
  // than silencing the coach for the rest of the fight.
  useEffect(() => { setDismissed(null); }, [due?.id]);

  if (!due || dismissed === due.id) return null;
  // Online and two-player share a screen; the coach is for the local player's
  // own first fight, so it never talks over someone else's turn.
  if (me && game.humans.length > 1) return null;

  const idx = TUTORIAL_STEPS.findIndex((s) => s.id === due.id);
  return (
    <div className="tut-coach" role="note">
      <div className="tut-head">
        <span className="tut-step">Learning · {idx + 1} of {TUTORIAL_STEPS.length}</span>
        <button
          className="tut-skip"
          onClick={props.onSkipAll}
          title="Teach me nothing else — you can still read How to play any time"
        >
          Skip all
        </button>
      </div>
      <div className="tut-title">{due.title}</div>
      <p className="tut-body">{due.body}</p>
      <button
        className="tut-ok"
        onClick={() => { setDismissed(due.id); props.onTaught(due.id); }}
      >
        Got it
      </button>
    </div>
  );
}
