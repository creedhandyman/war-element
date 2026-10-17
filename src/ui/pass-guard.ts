/** "ARE YOU SURE YOU WANT TO PASS?" — for the one pass that is almost never meant.
 *
 *  Pass is the biggest button on the screen and sits where a thumb rests, and two
 *  consecutive passes start the Battle. A new player who taps it before they have
 *  worked out the hand walks into a fight with an EMPTY board and a hand they
 *  could have played — the commonest way to lose round one for no reason.
 *
 *  So it asks, but only in that case and only once a round: your side of the board
 *  is empty AND something in your hand could be put down right now. Anyone with a
 *  card out, or nothing playable, passes without a word, and a veteran who really
 *  does want to pass an empty board answers one tap. Pure so a test can ask it
 *  about any state; the two-tap ask itself lives in App beside the button. */
import { summonSquare, type GameState, type PlayerId } from "../engine";

export function shouldConfirmPass(game: GameState, me: PlayerId): boolean {
  if (game.phase !== "prep" || game.prep?.priority !== me) return false;
  // Any card of mine standing on the board and passing is an ordinary choice.
  for (const c of Object.values(game.cards)) if (c.owner === me && c.pos) return false;
  return game.players[me].hand.some((h) => summonSquare(game, me, h.handId) !== null);
}
