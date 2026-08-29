/** The Gauntlet — earning against the AI without the AI being free money.
 *
 *  The Arena already paid shards for a win, and that was farmable in about ten
 *  seconds: put a deck of the eighteen worst cards you own in the opponent's
 *  seat, beat it, repeat. The fix is not a bigger number — it is making the
 *  opponent something you do not choose.
 *
 *  A RUN is four opponents from one rung of the matchmaker ladder, dealt in an
 *  order fixed when the run starts. Beat all four and it pays. Lose one and the
 *  run is over, recorded the moment it happens.
 *
 *  What that buys, and what it does not:
 *
 *    You cannot cherry-pick. The run deals the seats, so the softest deck on
 *    the rung is one of four rather than all four — and with five on a rung it
 *    may not be dealt at all.
 *    You cannot re-roll. The sequence is stored, so quitting and coming back
 *    resumes the same run rather than dealing a kinder one.
 *    You cannot un-lose. The loss is written before the result screen, so
 *    closing the tab on a bad game does not rewind it.
 *    Surrender is a loss, because otherwise it is a re-roll button.
 *
 *  What it is NOT is tamper-proof. This is a local save in a browser; anyone
 *  who wants to edit `we_story_v1` can give themselves shards and no amount of
 *  client code changes that. The goal is narrower and worth stating plainly:
 *  the honest path should not be the slow one. Farming a hand-built punching
 *  bag now pays nothing, and the fastest legitimate way to earn is to beat
 *  four decks you did not pick.
 */
import { DECK_TIERS, decksForTier, type DeckTier, type PremadeDeck } from "./custom-decks";
import type { StorySave } from "./story";

/** Opponents in a run.
 *
 *  The LENGTH OF A RUN, not the size of a rung. Every rung holds five now, and
 *  `startRun` shuffles before it slices — so a run is four fights drawn fresh
 *  from five, and two runs at the same difficulty are not the same four
 *  opponents in a different order. Raising this above the smallest rung would
 *  deal a SHORT run, which `runComplete` would treat as cleared early; there is
 *  a test on that floor. */
export const RUN_LENGTH = 4;

/** Paid once, on completing a run. On top of the per-win shards the Arena
 *  already gives, so a finished hard run is roughly a booster pack (30 + 4x2
 *  against a 40-shard pack) and a finished easy run is about half of one.
 *  Deliberately steep between rungs: the point of a ladder is that the top of
 *  it is worth climbing to.
 *
 *  `elite` pays 50, so 75 on the large board — a shade under two packs for four
 *  wins against decks that beat the shipped 5x5 field better than four times in
 *  five. Its 4x4 figure was notional while elite existed on the large board
 *  alone; the rung has a standard-board cut now, so 50 is a rate that actually
 *  gets paid. */
export const RUN_REWARD: Record<DeckTier, number> = { easy: 10, mid: 18, hard: 30, elite: 50 };

/** What the LARGE board multiplies that by.
 *
 *  A 5x5 run is a bigger ask on every axis: thirty-card decks, an eight-spell
 *  book, and matches that run about a third longer than the standard board's.
 *  Paying both boards the same made the 4x4 rung strictly the better earner per
 *  minute, which is the wrong incentive to put on the harder format. */
export const BIG_BOARD_PAY = 1.5;

/** ...and what DOMINATION's 7x7 multiplies it by.
 *
 *  Above the large board's rate because it is a bigger ask again on every axis
 *  the 5x5 was: forty-nine slots instead of twenty-five, an objective that has
 *  to be held for three consecutive rounds rather than a line to reach, and a
 *  mode where a run's opponent is playing the map as well as the deck.
 *
 *  Without a rate of its own a 7x7 run fell through this to the 4x4 figure —
 *  the hardest format in the game paying the standard board's rung price, which
 *  is the wrong incentive pointed at the wrong format. */
export const DOM_BOARD_PAY = 2;

/** Shards for CLEARING a rung on a board. The table above is the 4x4 figure. */
export const runReward = (tier: DeckTier, board: number): number =>
  Math.round(RUN_REWARD[tier]
    * (board >= 7 ? DOM_BOARD_PAY : board === 5 ? BIG_BOARD_PAY : 1));

export interface GauntletRun {
  tier: DeckTier;
  /** The battlefield this run was dealt for. Stored rather than derived because
   *  the PAYOUT depends on it: a run started on 5x5 has to pay the 5x5 rate
   *  when it finishes, whatever board the Arena happens to be showing by then.
   *  Absent on a run written before this existed — those read as 4x4, which is
   *  what they were dealt at if their seat ids carry no `_5`. */
  board?: number;
  /** The dealt order, by deck id. Fixed at the start so the run cannot be
   *  re-rolled by leaving and coming back. */
  seats: string[];
  /** How many of `seats` have been beaten. */
  won: number;
  /** Set when a seat is lost. A finished run stays in the save so the screen
   *  can say what happened rather than silently resetting. */
  lost?: boolean;
}

export interface GauntletState {
  /** The run in progress, or the one that just ended. */
  run?: GauntletRun;
  /** Rungs cleared at least once, for the badge on the ladder. */
  cleared?: DeckTier[];
}

/** Deal a run. `rand` is injectable so tests are not at the mercy of a shuffle.
 *
 *  Shuffle THEN slice, which is what lets a rung be bigger than a run: five
 *  decks means the player faces a random four of them. */
export function startRun(tier: DeckTier, boardSize: number, rand: () => number = Math.random): GauntletRun {
  const pool = decksForTier(tier, boardSize);
  const seats = [...pool];
  for (let i = seats.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [seats[i], seats[j]] = [seats[j], seats[i]];
  }
  return { tier, board: boardSize, seats: seats.slice(0, RUN_LENGTH).map((d) => d.id), won: 0 };
}

export const runOver = (run?: GauntletRun): boolean =>
  !!run && (!!run.lost || run.won >= run.seats.length);

export const runComplete = (run?: GauntletRun): boolean =>
  !!run && !run.lost && run.won >= run.seats.length;

/** The deck in the next seat, or null when the run is over. */
export function nextSeat(run: GauntletRun | undefined, boardSize: number): PremadeDeck | null {
  if (!run || runOver(run)) return null;
  const id = run.seats[run.won];
  return decksForTier(run.tier, boardSize).find((d) => d.id === id) ?? null;
}

/** Record a result. Returns the run unchanged once it is over, so a stray
 *  second call — a re-render, a replayed effect — cannot advance it twice. */
export function recordResult(run: GauntletRun, won: boolean): GauntletRun {
  if (runOver(run)) return run;
  return won ? { ...run, won: run.won + 1 } : { ...run, lost: true };
}

/** The board a run was dealt for. Falls back to reading the seat ids, which
 *  carry a `_5` suffix on the large builds, so a run saved before `board`
 *  existed still pays the right rate. */
export const boardOfRun = (run: GauntletRun): number =>
  run.board ?? (run.seats.some((id) => id.endsWith("_5")) ? 5 : 4);

/** Shards owed for a run, and zero unless it was actually completed. */
export const rewardFor = (run?: GauntletRun): number =>
  runComplete(run) ? runReward(run!.tier, boardOfRun(run!)) : 0;

/** Rungs in ladder order with whether each has ever been cleared. */
export const ladderProgress = (g: GauntletState | undefined) =>
  DECK_TIERS.map((tier) => ({ tier, cleared: (g?.cleared ?? []).includes(tier) }));

/** Settle an Arena match against the save: shards for the win, and the run
 *  advanced or ended.
 *
 *  Pure, and separate from the effect that calls it, because this is the money
 *  path — "did a win actually pay, and did it pay once" is not a question to
 *  answer by playing four matches in a browser.
 *
 *  `againstPremade` is the anti-farm rule. A win over a deck you BUILT pays
 *  nothing: eighteen of your worst cards in the opponent's seat was two shards
 *  a match for as long as you cared to click, and that made the honest path the
 *  slow one. A premade is an opponent somebody else chose. */
export function settleArena(
  save: StorySave,
  opts: {
    won: boolean;
    againstPremade: boolean;
    /** Was this match actually a GAUNTLET SEAT?
     *
     *  The bug this exists to kill, reported from play: a run in progress was
     *  advanced — and on a loss, ENDED — by any Arena match at all. Fight one
     *  casual game with a run armed and the run was over, scored against a deck
     *  it never dealt you. `runOver` was the only guard, and "a run is live" is
     *  not the same question as "this match belongs to it".
     *
     *  So the caller now states it, and a run survives every other mode: the
     *  Arena is a place you can leave and come back to. */
    gauntletSeat?: boolean;
  },
  award: (s: StorySave) => StorySave,
): StorySave {
  let next = opts.won && opts.againstPremade ? award(save) : save;
  const run = save.gauntlet?.run;
  if (opts.gauntletSeat && run && !runOver(run)) {
    const after = recordResult(run, opts.won);
    const reward = rewardFor(after);
    const cleared = runComplete(after)
      ? [...new Set([...(save.gauntlet?.cleared ?? []), after.tier])]
      : (save.gauntlet?.cleared ?? []);
    next = {
      ...next,
      gauntlet: { run: after, cleared },
      hero: reward && next.hero
        ? { ...next.hero, shards: next.hero.shards + reward }
        : next.hero,
    };
  }
  return next;
}
