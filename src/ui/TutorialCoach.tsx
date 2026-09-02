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
import { useEffect, useLayoutEffect, useState } from "react";
import { TEACHER_ART, TEACHER_NAME } from "./shared";
import type { GameState, PlayerId } from "../engine";

export interface TutorialStep {
  id: string;
  title: string;
  body: string;
  /** WHICH END OF THE SCREEN to sit at, chosen against what this step asks the
   *  player to look at. The coach used to live in the `.controls` column, which
   *  on a phone reflows into the bottom band — directly over the hand, i.e. over
   *  the exact cards the lesson was telling them to play. It floats now, and it
   *  moves as the lesson does:
   *
   *    a HAND lesson (mulligan, summon) sits at the top, clear of the fan;
   *    a BOARD lesson (the far row, moving, the battle order) sits at the
   *    bottom, clear of the squares.
   *
   *  Either way the middle of the board — where the fight actually happens — is
   *  never covered by anything. */
  place: "top" | "bottom";
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
    body: "Two ways: hold the squares on the enemy's Home row — the far line — or kill "
      + "everything they have. Most matches end on that row. But it is a march, not a "
      + "sprint: read the next card before you run at it.",
    place: "bottom",
  },
  {
    id: "mulligan",
    title: "Your opening hand",
    body: "Send back anything you cannot afford yet. Gold arrives slowly, so a hand of "
      + "expensive cards is a hand of cards you watch instead of play.",
    place: "top",
  },
  {
    id: "summon",
    title: "Cards arrive at Home",
    body: "Your cards enter on YOUR Home row, and only there — so a full Home row means "
      + "you cannot summon again until something moves forward. That row is your door, "
      + "and it is also your wallet.",
    place: "top",
  },
  {
    id: "income",
    title: "Your back line pays you",
    body: "Every Home square you are STANDING on is one extra Gold a round, on top of the "
      + "base. So a card that walks forward stops paying for the next one, and an empty "
      + "Home row earns you almost nothing. Keep bodies home early, bank the Gold, and "
      + "push when you can afford to stop earning.",
    place: "top",
  },
  {
    id: "move",
    title: "One move a turn",
    body: "You may summon as much as you can afford, but you may move only ONE card each "
      + "turn. That single move is the whole tempo of the game — spend it on the card "
      + "that is closest to arriving.",
    place: "bottom",
  },
  {
    id: "battle",
    title: "Speed decides the order",
    body: "When Prep ends, every card acts once, fastest first. That is what SP buys: not "
      + "just distance, but going before the card that was about to kill you.",
    place: "bottom",
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
  /** HOW FAR UP THE BOTTOM EDGE ACTUALLY IS.
   *
   *  A bottom-docked card at `bottom: 8px` sits ON the hand, which is the whole
   *  complaint this is fixing — the coach was covering the exact cards the
   *  lesson was telling the player to play. Rather than hard-code a guess at the
   *  hand's height (it changes with the fan size, the phone, and the safe-area
   *  inset), measure the bottom furniture and dock above it.
   *
   *  Measured, not assumed, for the same reason `GuideOverlay` measures its
   *  anchors: this file must not carry a second copy of another component's
   *  layout. Nothing found — desktop, or a phase with no hand — leaves the
   *  offset at zero and the card sits at the ordinary bottom edge.
   */
  const [bottomGap, setBottomGap] = useState(0);

  /** The player's override of the step's own end of the screen. Each step picks
   *  the end that is clear of what IT is about, which is right for the lesson
   *  and cannot be right for every board — a card mid-fight can be anywhere.
   *  So there is a button, and it is one tap, and it costs nothing to be wrong. */
  const [flipped, setFlipped] = useState(false);

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
      // BEFORE the move lesson, and that order is the correction: "you may move
      // one card a turn" invites a player to start marching, and until they know
      // the back line is what pays for the march, marching is how they go broke.
      if (untaught("income")) return step("income");
      if (untaught("move")) return step("move");
    }
    if (game.phase === "battle" && untaught("battle")) return step("battle");
    return null;
  })();

  // Re-measured on every step and every phase, because the bottom furniture is
  // not the same in Deploy, Prep and Battle — which is also what makes the card
  // move as the player works rather than only when the lesson changes.
  useLayoutEffect(() => {
    const measure = () => {
      if (typeof document === "undefined") return;
      // Everything that docks to the bottom of a fight. The highest top edge
      // among them is where the free screen ends.
      const sels = [".hand-float", ".hand-fan", ".controls", ".battle-log", ".log-rail"];
      let highest = Infinity;
      for (const sel of sels) {
        for (const el of Array.from(document.querySelectorAll<HTMLElement>(sel))) {
          const r = el.getBoundingClientRect();
          // Only things actually sitting in the lower half: `.controls` is a
          // side column on desktop and must not push the card to mid-screen.
          if (r.height < 1) continue;
          if (r.top < window.innerHeight * 0.5) continue;
          highest = Math.min(highest, r.top);
        }
      }
      setBottomGap(Number.isFinite(highest) ? Math.max(0, window.innerHeight - highest + 8) : 0);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [due?.id, game.phase]);

  // A new step clears the local dismissal, so tapping "Got it" advances rather
  // than silencing the coach for the rest of the fight. It also clears the flip:
  // the next lesson has its own idea of which end is clear, and inheriting the
  // last one would undo the whole point of choosing per step.
  useEffect(() => { setDismissed(null); setFlipped(false); }, [due?.id]);

  if (!due || dismissed === due.id) return null;
  // Online and two-player share a screen; the coach is for the local player's
  // own first fight, so it never talks over someone else's turn.
  if (me && game.humans.length > 1) return null;

  const idx = TUTORIAL_STEPS.findIndex((s) => s.id === due.id);
  const place = flipped ? (due.place === "top" ? "bottom" : "top") : due.place;
  return (
    <div
      className={`tut-coach tut-${place}`}
      role="note"
      style={place === "bottom" && bottomGap > 0 ? { bottom: bottomGap } : undefined}
    >
      <div className="tut-head">
        <img className="tut-face" src={TEACHER_ART} alt="" draggable={false}
          onError={(e) => { e.currentTarget.style.display = "none"; }} />
        <span className="tut-step">{TEACHER_NAME} · {idx + 1} of {TUTORIAL_STEPS.length}</span>
        <button
          className="tut-move"
          onClick={() => setFlipped((f) => !f)}
          aria-label={place === "top" ? "Move this to the bottom" : "Move this to the top"}
          title={place === "top" ? "Move this out of the way — to the bottom" : "Move this out of the way — to the top"}
        >
          {place === "top" ? "↓" : "↑"}
        </button>
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
