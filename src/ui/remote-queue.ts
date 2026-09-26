/** STATES FROM THE OTHER PLAYER, shown before they land.
 *
 *  The online half of the look-ahead App's auto-advance loop does locally.
 *  Only the host steps the shared battle, so a guest used to receive each step
 *  as a finished fact — and the host received the guest's own attacks and
 *  spells the same way. Now each arriving state is diffed against the one on
 *  screen exactly as a local step is (`strikeZone`), lit, and then applied; a
 *  spell plays its flash first, through the same staged path the AI's use.
 *
 *  One at a time and in order, because they are consecutive steps. Kept out of
 *  App.tsx and free of React so it can be tested without two live clients: App
 *  hands it the few things it does to the screen. */
import type { GameState } from "../engine";
import { spellCast, strikeZone, type StrikeZone } from "./attack-zone";

export interface RemoteScreen {
  /** The game currently on screen. */
  shown(): GameState | null;
  /** Put a state on screen. */
  land(next: GameState): void;
  /** Light a zone, or clear it with null. */
  light(zone: StrikeZone | null): void;
  /** Play a spell's flash, light its zone, land `next`, then call `landed`.
   *  `before` is the state on screen — what the spell's effects are read
   *  against. */
  stageSpell(before: GameState, next: GameState, zone: StrikeZone | null, spellId: string, landed: () => void): void;
  /** Run `fn` after `ms`; returns a cancel. */
  wait(ms: number, fn: () => void): () => void;
  /** How long a zone stays lit. */
  holdFor(zone: StrikeZone): number;
  /** Deliver the step's attack — a shot, a lunge — to arrive in `ms`, as the
   *  lit pause runs. Optional: a screen with no effects simply skips it. */
  animate?(before: GameState, next: GameState, ms: number): void;
}

export interface RemoteQueue {
  receive(next: GameState): void;
  /** Leaving the match: drop everything, cancel anything in flight. */
  clear(): void;
}

/** Is `next` the next step of the match on screen, rather than a new deal or a
 *  resync? `nextId` only grows within a match and restarts for a new one, and a
 *  rejoin can jump rounds — a rematch or a catch-up is not an attack to show. */
export function isNextStep(before: GameState | null, next: GameState): before is GameState {
  return before !== null && before.phase !== "mulligan" &&
    next.nextId >= before.nextId && next.round >= before.round && next.round - before.round <= 1;
}

export function createRemoteQueue(screen: RemoteScreen): RemoteQueue {
  let queue: GameState[] = [];
  let busy = false;
  let cancel: (() => void) | null = null;

  function pump() {
    if (busy) return;
    const next = queue.shift();
    if (!next) return;
    const before = screen.shown();
    // A backlog — a slow link catching up — lands at once rather than
    // replaying every step at the sender's pace; so does anything that is not
    // the next step of this match.
    if (!isNextStep(before, next) || queue.length > 1) {
      screen.land(next);
      pump();
      return;
    }
    const zone = strikeZone(before, next);
    const cast = spellCast(before, next);
    const done = () => {
      busy = false;
      cancel = null;
      pump();
    };
    if (cast) {
      busy = true;
      screen.stageSpell(before, next, zone, cast.spellId, done);
      return;
    }
    if (!zone) {
      screen.land(next);
      pump();
      return;
    }
    busy = true;
    screen.light(zone);
    screen.animate?.(before, next, screen.holdFor(zone));
    cancel = screen.wait(screen.holdFor(zone), () => {
      screen.light(null);
      screen.land(next);
      done();
    });
  }

  return {
    receive(next) {
      queue.push(next);
      pump();
    },
    clear() {
      cancel?.();
      cancel = null;
      queue = [];
      busy = false;
    },
  };
}
