/** WHAT DO I DO NOW?
 *
 *  On a phone the hint line is hidden in every phase (it costs the board 28px),
 *  and the card readout only speaks once a card has been tapped. So between
 *  taps the screen said nothing: a new player with a lit hand and an empty
 *  board had to guess that the glowing cards were the thing to touch. This is
 *  the one short sentence for that gap — whose move it is, and the obvious
 *  thing to do with it. It is a status, not a lesson: no popup, no dismissal,
 *  and it is gone the moment a card is picked up.
 *
 *  Pure so a test can ask it about any state. Battle-phase prompts already say
 *  what to do (the action wheel, "X is up"), so this speaks in Prep only. */
import type { GameState, PlayerId } from "../engine";

export interface TurnCue {
  /** `go`: your move. `wait`: not yet. */
  tone: "go" | "wait";
  text: string;
}

export function turnCue(p: {
  game: GameState;
  player: PlayerId;
  /** Hand ids the engine says can be summoned right now. */
  summonable: number;
  /** Cards in hand. */
  handSize: number;
  /** Is any Home slot free? A full row has its own note on the hand. */
  homeRowOpen: boolean;
}): TurnCue | null {
  const { game, player } = p;
  if (game.phase !== "prep" || game.win) return null;
  if (game.prep?.priority !== player) return { tone: "wait", text: "Their move…" };
  // The campaign's first battle: one card is free before round one.
  if ((game.opening?.[player] ?? 0) > 0 && p.summonable > 0) {
    return { tone: "go", text: "Lead with a card — your first is free" };
  }
  if (p.summonable > 0) return { tone: "go", text: "Your move · tap a glowing card to play it" };
  if (p.handSize > 0 && !p.homeRowOpen) return null; // "Home row full" is already said
  if (p.handSize === 0) return { tone: "go", text: "Your move · move a card, or Pass" };
  return { tone: "go", text: "Not enough Gold yet · move a card, or Pass" };
}
