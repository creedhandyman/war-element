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
 *  EVERY FUNCTION TAKES THE BOARD, and still should. Elite was large-board only
 *  when this was written, so 4x4 topped out at hard; it has a standard-board cut
 *  now and both boards run the full four rungs. The board argument stays because
 *  what a board offers is `tiersFor`'s to answer, not this file's to assume — a
 *  future rung that exists on one board only would need no change here.
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

/** Bonus shards a win pays ON TOP of the Arena's flat `SHARDS_PER_WIN.arena`.
 *
 *  Two axes, because a flat 2 a win made every opponent worth the same and the
 *  ladder worth nothing: climbing cost you the easy wins and paid you back in
 *  difficulty alone.
 *
 *  THE RUNG is what you are facing. Elite decks beat the shipped 5x5 field more
 *  than four times in five (see `PremadeDeck.scriptedOpening`), so a win there
 *  is not the same event as a win over Easy and should not settle the same.
 *
 *  THE STREAK is how long you have held it. Capped — see STREAK_BONUS_CAP.
 *
 *  Scale, against the 40-shard pack: Easy pays the old 2, and an elite win on a
 *  long streak pays 12, so the top of the ladder is roughly a pack every three
 *  or four matches and the bottom is one every twenty. The Gauntlet's four-win
 *  run still pays more per win at the same rung (a hard run is 30 + 4x2 across
 *  four matches), which is right: a run can be LOST outright, and this cannot. */
export const RUNG_BONUS: Record<DeckTier, number> = { easy: 0, mid: 1, hard: 3, elite: 5 };

/** Where the streak half stops paying.
 *
 *  Five, which is the streak that first reaches the top rung on a board that has
 *  one (6 = elite, and the bonus is read AFTER the win, so the win that arrives
 *  at elite is already paying the cap). Past that the ladder has nothing left to
 *  offer, so an uncapped bonus would just pay more and more for the same fight —
 *  and the fight is the thing that is supposed to get harder, not the number. */
export const STREAK_BONUS_CAP = 5;

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

/** Fold a settled match into the ladder and price it, in one call.
 *
 *  ONE function returning both, not two that each re-ask "did this count".
 *  They have to agree — a bonus paid for a match the streak ignored is a way to
 *  farm Easy for elite money — and two copies of that check is two chances for
 *  them to drift apart.
 *
 *  `ladder` is the SAME object when nothing moved, so a caller's `next !== prev`
 *  guard skips the write — the shape `completeEvent` uses for the same reason. */
export function recordLadderMatch(
  ladder: LadderState | undefined,
  opts: { won: boolean; tier: DeckTier | null | undefined; boardSize: number },
): { ladder: LadderState; bonus: number } {
  const cur = ladder ?? emptyLadder();
  if (!countsForStreak(opts.tier, cur.streak, opts.boardSize)) return { ladder: cur, bonus: 0 };
  const streak = afterMatch(cur.streak, opts.won, opts.boardSize);
  const next = { streak, best: Math.max(cur.best, streak) };
  // Losses pay nothing, and the rung is the one you actually FOUGHT — read off
  // the tier in the seat rather than recomputed from the new streak, which a
  // loss has already dropped a rung.
  const bonus = opts.won
    ? (RUNG_BONUS[opts.tier!] ?? 0) + Math.min(streak, STREAK_BONUS_CAP)
    : 0;
  return { ladder: next, bonus };
}
