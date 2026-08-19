// The matchmaker ladder: which rung a streak asks for, what a loss gives back,
// and the one rule that stops the number being farmed.

import { describe, expect, it } from "vitest";
import {
  afterMatch, countsForStreak, emptyLadder, recordLadderMatch, rungFloor,
  RUNG_BONUS, STREAK_BONUS_CAP, tierForStreak, WINS_PER_RUNG, winsToNextRung,
} from "../../data/matchmaker";
import type { DeckTier } from "../../data/custom-decks";
import { tiersFor } from "../../data/custom-decks";

describe("the matchmaker ladder", () => {
  it("puts the seventh win in a row against an elite deck", () => {
    // The spec, walked one win at a time on the large board. Read it as "the
    // rung the Nth match is fought on", which is the rung BEFORE that win lands.
    const rungOfMatch = (n: number) => tierForStreak(n - 1, 5);
    expect([1, 2].map(rungOfMatch)).toEqual(["easy", "easy"]);
    expect([3, 4].map(rungOfMatch)).toEqual(["mid", "mid"]);
    expect([5, 6].map(rungOfMatch)).toEqual(["hard", "hard"]);
    expect(rungOfMatch(7)).toBe("elite");
    expect(rungOfMatch(30), "and it stays there").toBe("elite");
  });

  it("tops out at whatever the board's last rung is, however long the streak", () => {
    // Not a special case here — `tiersFor` is what knows. This used to read
    // "tops out at hard on the standard board, where elite has no decks", which
    // was true while elite was 5x5-only and is a fact about the DECK LIST rather
    // than about the ladder. Asked of the last rung instead, it survives elite
    // gaining a standard-board cut and would survive a fifth rung too.
    for (const board of [4, 5] as const) {
      const last = tiersFor(board)[tiersFor(board).length - 1];
      expect(tierForStreak(99, board), `${board}x${board}`).toBe(last);
      expect(tierForStreak(rungFloor(tiersFor(board).length - 1), board)).toBe(last);
    }
  });

  it("gives back ONE rung on a loss, not the whole ladder", () => {
    // The rule the feature rests on. Dropping to zero would mean six wins to
    // get back to the fight you just lost, and nobody presses the button again.
    expect(afterMatch(6, false, 5), "elite -> hard").toBe(rungFloor(2));
    expect(tierForStreak(afterMatch(6, false, 5), 5)).toBe("hard");
    expect(tierForStreak(afterMatch(4, false, 5), 5)).toBe("mid");
    expect(tierForStreak(afterMatch(2, false, 5), 5)).toBe("easy");
    expect(afterMatch(0, false, 5), "and never below zero").toBe(0);
  });

  it("walks back and forth across the top when you trade wins and losses", () => {
    // What the ladder is FOR: it settles at the difficulty you can almost beat.
    let s = 6; // elite
    const seen: string[] = [];
    for (const won of [false, true, false, false, true, true]) {
      s = afterMatch(s, won, 5);
      seen.push(tierForStreak(s, 5));
    }
    expect(seen).toEqual(["hard", "hard", "mid", "easy", "easy", "mid"]);
  });

  it("demotes from the rung the player was SHOWN, not an invisible one", () => {
    // A streak of 12 is well past the top rung's floor of 6, so the index is
    // CLAMPED and reads elite. Losing there has to land on hard; computing the
    // drop from the unclamped index would have put it on some seventh rung's
    // floor and left the player still on elite.
    expect(tierForStreak(12, 4)).toBe("elite");
    expect(tierForStreak(afterMatch(12, false, 4), 4)).toBe("hard");
  });

  it("counts nothing won off-rung, which is what stops it being farmed", () => {
    // Six wins against the softest decks in the game must not deal an elite
    // match, or the number stops meaning "I beat six opponents at my level".
    expect(countsForStreak("easy", 0, 5)).toBe(true);
    expect(countsForStreak("easy", 4, 5), "beating easy while on hard").toBe(false);
    expect(countsForStreak("elite", 0, 5), "nor jumping the queue upward").toBe(false);
    // Untiered decks — the six hand-tuned originals, and anything the player
    // built — carry no rung at all and so can never move it.
    expect(countsForStreak(null, 0, 5)).toBe(false);
    expect(countsForStreak(undefined, 0, 5)).toBe(false);
  });

  it("returns the SAME object for an off-rung match, so no write happens", () => {
    // The caller's `next !== prev` guard is what skips the save; this is the
    // identity that guard reads.
    const at4 = { streak: 4, best: 9 };
    expect(recordLadderMatch(at4, { won: true, tier: "easy", boardSize: 5 }).ladder).toBe(at4);
    expect(recordLadderMatch(at4, { won: false, tier: null, boardSize: 5 }).ladder).toBe(at4);
  });

  it("pays nothing for a win the streak did not count", () => {
    // The whole point of tying the money to the same check: hand-picking Easy
    // while on Hard must not pay Hard money, or the fastest route to a pack is
    // the softest deck in the game.
    const at4 = { streak: 4, best: 9 };
    expect(recordLadderMatch(at4, { won: true, tier: "easy", boardSize: 5 }).bonus).toBe(0);
    expect(recordLadderMatch(at4, { won: true, tier: null, boardSize: 5 }).bonus).toBe(0);
  });

  it("pays more for a harder rung, and more again for a longer streak", () => {
    const pay = (streak: number, tier: DeckTier) =>
      recordLadderMatch({ streak, best: streak }, { won: true, tier, boardSize: 5 }).bonus;
    // Same streak, harder opponent — the rung half.
    expect(pay(0, "easy")).toBeLessThan(pay(2, "mid"));
    expect(RUNG_BONUS.easy).toBeLessThan(RUNG_BONUS.mid);
    expect(RUNG_BONUS.mid).toBeLessThan(RUNG_BONUS.hard);
    expect(RUNG_BONUS.hard).toBeLessThan(RUNG_BONUS.elite);
    // Same rung, longer streak — the streak half. It has to be measured INSIDE
    // one rung, and only the bottom rung is wide enough to hold two streaks
    // that are both under the cap: elite does not begin until 6, by which point
    // the streak half is already capped at 5.
    expect(pay(1, "easy")).toBeGreaterThan(pay(0, "easy"));
    // Easy pays the rung nothing, so the first win is the streak half alone.
    expect(RUNG_BONUS.easy).toBe(0);
    expect(pay(0, "easy")).toBe(1); // 0 + min(1, cap)
  });

  it("stops the streak half at the cap", () => {
    // Elite only, because elite is the only rung a capped streak can be on.
    const pay = (streak: number) =>
      recordLadderMatch({ streak, best: streak }, { won: true, tier: "elite", boardSize: 5 }).bonus;
    const capped = RUNG_BONUS.elite + STREAK_BONUS_CAP;
    expect(pay(6), "the win that arrives at elite is already at the cap").toBe(capped);
    expect(pay(40), "and forty in a row pays exactly the same").toBe(capped);
  });

  it("prices the rung you FOUGHT, not the one a streak lands on", () => {
    // A tier is only paid when it matches the streak going in, so every payout
    // is priced by the deck that was actually in the seat.
    const onHard = recordLadderMatch({ streak: 4, best: 4 }, { won: true, tier: "hard", boardSize: 5 });
    expect(onHard.bonus).toBe(RUNG_BONUS.hard + Math.min(5, STREAK_BONUS_CAP));
    expect(tierForStreak(4, 5)).toBe("hard");
  });

  it("pays nothing for a loss, however long the streak was", () => {
    expect(recordLadderMatch({ streak: 9, best: 9 }, { won: false, tier: "elite", boardSize: 5 }).bonus)
      .toBe(0);
  });

  it("records a best that a later loss cannot take away", () => {
    let l = emptyLadder();
    for (let i = 0; i < 7; i++)
      l = recordLadderMatch(l, { won: true, tier: tierForStreak(l.streak, 5), boardSize: 5 }).ladder;
    expect(l.streak).toBe(7);
    expect(l.best).toBe(7);
    l = recordLadderMatch(l, { won: false, tier: "elite", boardSize: 5 }).ladder;
    expect(l.streak, "one rung back").toBe(rungFloor(2));
    expect(l.best, "the souvenir survives").toBe(7);
  });

  it("counts down to the next rung, and stops counting at the top", () => {
    expect(winsToNextRung(0, 5)).toBe(WINS_PER_RUNG);
    expect(winsToNextRung(1, 5)).toBe(1);
    expect(winsToNextRung(5, 5)).toBe(1);
    expect(winsToNextRung(6, 5), "already elite").toBe(0);
    expect(winsToNextRung(6, 4), "already hard, on a board with no elite").toBe(0);
  });
});

describe("what the lobby tells you", () => {
  it("names the rung a loss ACTUALLY drops you to", () => {
    // The bug this caught: the lobby derived the drop as `streak - 2` instead
    // of asking `afterMatch`, so on 4x4 at the top it read "a loss drops you to
    // Hard" while you were standing on Hard. Any view that re-derives a rule
    // gets it wrong exactly where the rule has a special case — here, the clamp.
    const shown = (streak: number, board: number) =>
      tierForStreak(afterMatch(streak, false, board), board);
    // Read at the TOP of each board, which is where the clamp bites: a streak
    // past the last rung's floor still reads as that rung, so the drop has to
    // be computed from the clamped index rather than from `streak - 2`.
    for (const board of [4, 5] as const) {
      const rungs = tiersFor(board);
      const top = rungs[rungs.length - 1];
      const deep = rungFloor(rungs.length - 1) + 6; // well past the last floor
      expect(tierForStreak(deep, board), `${board}x${board} top`).toBe(top);
      expect(shown(deep, board), `${board}x${board} drop`).toBe(rungs[rungs.length - 2]);
      // The naive version, kept as the thing that must NOT be used: at a deep
      // streak `streak - 2` is still inside the top rung and reports no drop.
      expect(tierForStreak(deep - WINS_PER_RUNG, board)).toBe(top);
    }
  });
});
