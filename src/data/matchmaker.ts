/** The matchmaker — one button, an opponent you did not pick, and a rung that
 *  moves with you.
 *
 *  The Arena already had two ways to choose a fight and both ask something of
 *  the player first: the OPPONENT segment asks which difficulty you want, and
 *  the Gauntlet asks you to commit to four matches where one loss ends the run.
 *  Neither answers "I just want a match". This does — and because the rung is
 *  derived from your streak rather than chosen, the answer gets harder as you
 *  get better without anyone deciding to make it harder.
 *
 *  THE LADDER. Two wins buys the next rung:
 *
 *      streak 0-1  easy      wins 1 and 2 are fought here
 *      streak 2-3  even      wins 3 and 4
 *      streak 4-5  hard      wins 5 and 6
 *      streak 6+   elite     the seventh win in a row is an elite deck
 *
 *  A LOSS DROPS ONE RUNG, not the whole ladder. Falling from elite to easy on a
 *  single bad game would mean six wins to get back to the fight you just had,
 *  and the climb stops being the point of playing. Losing at elite puts you on
 *  hard; lose again and it is even. So trading wins and losses at the top walks
 *  you back and forth across the last two rungs, which is where a matchmaker
 *  should settle: at the difficulty you can ALMOST beat.
 *
 *  ON FARMING. The streak only moves when the deck in the seat is on the rung
 *  the ladder is asking for — see `countsForStreak`. Hand-picking Easy from the
 *  OPPONENT segment and beating it does nothing, because otherwise the fastest
 *  route to an elite match is six wins against the softest decks in the game,
 *  and the number would stop meaning "I beat six opponents at my level".
 *
 *  ELITE IS LARGE-BOARD ONLY, so on 4x4 the ladder tops out at hard and a long
 *  streak simply stays there. Every function here takes the board for that
 *  reason rather than assuming four rungs exist.
 */
import { DECK_TIERS, tiersFor, type DeckTier } from "./custom-decks";

/** Wins needed on a rung before the next one opens. */
export const WINS_PER_RUNG = 2;

/** The state the feature needs, which is one number and a souvenir.
 *
 *  `best` is not used by any rule — it exists because a streak that resets to
 *  nothing and leaves no trace gives a player who just lost at elite no reason
 *  to press the button again. */
export interface LadderState {
  streak: number;
  best: number;
}

export const emptyLadder = (): LadderState => ({ streak: 0, best: 0 });

/** The rungs this board actually offers, in ladder order. */
const rungs = (boardSize: number): DeckTier[] => tiersFor(boardSize);

/** Which rung a streak has reached, as an index into `rungs(boardSize)`.
 *  Clamped at the top, so a streak of 40 on a board with three rungs is hard
 *  rather than a fifth tier that does not exist. */
function rungIndex(streak: number, boardSize: number): number {
  const n = rungs(boardSize).length;
  return Math.max(0, Math.min(n - 1, Math.floor(Math.max(0, streak) / WINS_PER_RUNG)));
}

/** The difficulty the ladder is asking for right now. */
export function tierForStreak(streak: number, boardSize: number): DeckTier {
  const list = rungs(boardSize);
  return list[rungIndex(streak, boardSize)] ?? DECK_TIERS[0];
}

/** The streak a rung begins at — what a demotion lands on. */
export const rungFloor = (index: number): number => Math.max(0, index) * WINS_PER_RUNG;

/** Wins still owed before the next rung opens, or 0 when already at the top. */
export function winsToNextRung(streak: number, boardSize: number): number {
  const i = rungIndex(streak, boardSize);
  if (i >= rungs(boardSize).length - 1) return 0;
  return rungFloor(i + 1) - Math.max(0, streak);
}

/** Does a match against this opponent move the streak?
 *
 *  Only when the seat holds a deck from the rung the ladder asked for. `tier`
 *  is the opponent deck's rung — `tierOf(deckId)`, which is null for the six
 *  untiered originals and for anything the player built, so those never count
 *  either. That is deliberate: a deck you assembled is not an opponent somebody
 *  else chose, which is the same rule `settleArena` uses to decide whether a
 *  win pays shards. */
export const countsForStreak = (
  tier: DeckTier | null | undefined,
  streak: number,
  boardSize: number,
): boolean => !!tier && tier === tierForStreak(streak, boardSize);

/** The streak after a match on the ladder. Win: one higher. Loss: down to the
 *  floor of the rung below, so exactly one rung is given back.
 *
 *  Demotion is computed from the CLAMPED rung, which is what the player was
 *  actually shown: on a three-rung board a streak of 12 reads as hard, and
 *  losing there has to land on even rather than on some invisible fifth rung's
 *  floor. */
export function afterMatch(streak: number, won: boolean, boardSize: number): number {
  if (won) return Math.max(0, streak) + 1;
  return rungFloor(rungIndex(streak, boardSize) - 1);
}

/** Fold a settled match into the ladder, `best` included. Returns the SAME
 *  object when nothing moved, so a caller's `next !== prev` guard skips the
 *  write — the same shape `completeEvent` uses for the same reason. */
export function recordLadderMatch(
  ladder: LadderState | undefined,
  opts: { won: boolean; tier: DeckTier | null | undefined; boardSize: number },
): LadderState {
  const cur = ladder ?? emptyLadder();
  if (!countsForStreak(opts.tier, cur.streak, opts.boardSize)) return cur;
  const streak = afterMatch(cur.streak, opts.won, opts.boardSize);
  return { streak, best: Math.max(cur.best, streak) };
}
