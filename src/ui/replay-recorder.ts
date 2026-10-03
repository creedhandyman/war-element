/** RECORDING A MATCH AS IT IS PLAYED (engine/replay.ts holds the recipe).
 *
 *  The App moves a match in several places — the player's own dispatch, the
 *  AI's auto-advance, a spell that is staged and lands a beat later, the
 *  "all auto" sweep — and some computed steps never reach the screen (a staged
 *  cast the player quit out of). So steps are not logged where they are
 *  COMPUTED. Each one is tagged with the step that produced it (`recApply` /
 *  `recAdvance`), and the recorder logs a step only when its state is the one
 *  that actually lands on screen, and only if it follows on from the last state
 *  it logged. What was shown is exactly what is replayed.
 *
 *  A state that arrives from anywhere else is either a FRESH DEAL (a new
 *  recording starts) or something the recipe cannot explain — a state from the
 *  other player online, a rejoin — and the recording is marked unreplayable
 *  rather than saved as a recipe that plays out a different match.
 */
import { advance, applyIntent, seatsOf, type GameState, type Intent } from "../engine";
import { cloneState, makeReplay, pushStep, type Replay, type ReplayOp, type ReplayStep } from "../engine/replay";

const PRODUCED = new WeakMap<GameState, { prev: GameState; op: ReplayOp }>();

/** `applyIntent`, remembered. */
export function recApply(prev: GameState, intent: Intent): GameState {
  const next = applyIntent(prev, intent);
  PRODUCED.set(next, { prev, op: intent });
  return next;
}

/** `advance`, remembered. */
export function recAdvance(prev: GameState): GameState {
  const next = advance(prev);
  PRODUCED.set(next, { prev, op: "advance" });
  return next;
}

/** The opening of a match: mulligan, nobody has kept yet. */
const isFreshDeal = (s: GameState): boolean =>
  s.phase === "mulligan" && seatsOf(s).every((p) => !s.players[p].mulliganDone);

export class MatchRecorder {
  private initial: GameState | null = null;
  private steps: ReplayStep[] = [];
  private last: GameState | null = null;
  /** Something landed that the recipe cannot explain. */
  broken = false;
  /** Bumped for every new recording, so a save can tell matches apart. */
  matchNo = 0;

  /** Called with every state that lands on screen. */
  observe(s: GameState): void {
    if (s === this.last) return;
    // Walk back through what produced this state to the last one logged. React
    // can land two states in one tick and render only the second, so the state
    // on screen is not always ONE step on from the last one seen — but every
    // step in between is still on the chain, and is logged in order.
    if (this.last) {
      const chain: ReplayOp[] = [];
      let at: GameState | undefined = s;
      for (let guard = 0; at && at !== this.last && guard < 10_000; guard++) {
        const p = PRODUCED.get(at);
        if (!p) { at = undefined; break; }
        chain.push(p.op);
        at = p.prev;
      }
      if (at === this.last && chain.length) {
        if (!this.broken) for (let i = chain.length - 1; i >= 0; i--) pushStep(this.steps, chain[i]);
        this.last = s;
        return;
      }
    }
    if (isFreshDeal(s)) {
      this.initial = cloneState(s);
      this.steps = [];
      this.broken = false;
      this.matchNo++;
    } else if (this.initial) {
      this.broken = true;
    }
    this.last = s;
  }

  /** Mark the current recording as one that cannot be replayed (online). */
  markUnreplayable(): void { this.broken = true; }

  /** The finished replay, or null when there is none to give. */
  finish(final: GameState): Replay | null {
    if (!this.initial || this.broken || this.last !== final) return null;
    return makeReplay(this.initial, this.steps.slice(), final);
  }
}
