/** DOMINATION IN THE SCORED MODES — Streak and Gauntlet on the 7×7.
 *
 *  The 7×7 was Domination's alone: a free-for-all with its own screen, casual
 *  only, because the scored modes are "you versus this deck" and a table of
 *  four is a different shape. Now either scored mode can be played on it — the
 *  FORMAT toggle on their screens — and pays more for it, and SOMETIMES the
 *  table is bigger than a duel: two or three decks from the same rung at once.
 *
 *  THE PAY, in one rule a screen can say out loud:
 *
 *      Domination pays double, and every opponent past the first adds half again.
 *
 *  The half-again is not generosity, it is the table's odds. Against F equally
 *  strong opponents a player wins about one game in F + 1, and (F + 1) / 2 —
 *  1, 1.5, 2 — is exactly what a win has to be worth for the expected shards
 *  per MATCH to stay level. So a big table is never the worse deal and never
 *  the farm; the double is what Domination itself adds.
 *
 *  HOW OFTEN: half the tables are a duel, three in ten seat one more deck, one
 *  in five seat two. Dealt, never picked — the matchmaker's reroll re-deals the
 *  whole table, and a gauntlet deals every seat's table when the run is lined
 *  up and stores it, so a run's big tables cannot be rerolled away.
 */
import { decksForTier, type DeckTier } from "./custom-decks";

/** What Domination multiplies a scored win by. */
export const DOM_WIN_PAY = 2;

/** What each opponent past the first adds on top of that: half again. */
export const EXTRA_FOE_PAY = 0.5;

/** The multiplier on a scored win for the table it was won at: 1 on a duel
 *  board, and on the 7×7 double, plus half again per extra opponent. */
export function tablePay(board: number, foes: number): number {
  if (board < 7) return 1;
  return DOM_WIN_PAY * (1 + EXTRA_FOE_PAY * Math.max(0, foes - 1));
}

/** A win's duel price — the flat Arena win plus whatever the mode adds —
 *  scaled to its table. The one number the screens quote and the settlement
 *  pays, so the two cannot disagree. */
export const tableWinPay = (duelPay: number, board: number, foes: number): number =>
  Math.round(duelPay * tablePay(board, foes));

/** The odds of 0, 1 and 2 EXTRA decks at a scored Domination table. */
export const EXTRA_FOE_ODDS: readonly number[] = [0.5, 0.3, 0.2];

/** How many extra decks join a table. `rand` is injectable so tests are not at
 *  the mercy of a roll. */
export function rollExtraFoes(rand: () => number = Math.random): number {
  let r = rand();
  for (let n = 0; n < EXTRA_FOE_ODDS.length; n++) {
    if (r < EXTRA_FOE_ODDS[n]) return n;
    r -= EXTRA_FOE_ODDS[n];
  }
  return EXTRA_FOE_ODDS.length - 1;
}

/** The rest of a scored Domination table: the decks sitting beside the seat's
 *  own, from the same rung, never the seat's own deck and never one twice.
 *  Empty on a duel board, which is how a duel stays a duel. */
export function dealExtras(
  tier: DeckTier, board: number, mainId: string, rand: () => number = Math.random,
): string[] {
  if (board < 7) return [];
  const want = rollExtraFoes(rand);
  const pool = decksForTier(tier, board).map((d) => d.id).filter((id) => id !== mainId);
  const out: string[] = [];
  while (out.length < want && pool.length) {
    const i = Math.min(pool.length - 1, Math.floor(rand() * pool.length));
    out.push(pool.splice(i, 1)[0]);
  }
  return out;
}

/** Can this rung and board still seat a stored table? A table dealt for another
 *  rung or board — the streak moved, the format changed — is dealt again rather
 *  than fielded. */
export function extrasFit(
  ids: readonly string[], tier: DeckTier, board: number, mainId: string,
): boolean {
  if (board < 7) return ids.length === 0;
  const rung = new Set(decksForTier(tier, board).map((d) => d.id));
  return ids.every((id) => id !== mainId && rung.has(id)) && new Set(ids).size === ids.length;
}
