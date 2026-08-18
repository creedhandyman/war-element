// The matchmaker ladder: which rung a streak asks for, what a loss gives back,
// and the one rule that stops the number being farmed.

import { describe, expect, it } from "vitest";
import {
  afterMatch, countsForStreak, emptyLadder, recordLadderMatch, rungFloor,
  tierForStreak, WINS_PER_RUNG, winsToNextRung,
} from "../../data/matchmaker";
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

  it("tops out at hard on the standard board, where elite has no decks", () => {
    // Not a special case here — `tiersFor` is what knows, and a long streak
    // simply sits on the last rung the board actually offers.
    expect(tiersFor(4)).not.toContain("elite");
    expect(tierForStreak(6, 4)).toBe("hard");
    expect(tierForStreak(99, 4)).toBe("hard");
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
    // On a three-rung board a streak of 12 reads as hard. Losing there has to
    // land on even; computing the drop from the unclamped index would have put
    // it on some fifth rung's floor and left the player still on hard.
    expect(tierForStreak(12, 4)).toBe("hard");
    expect(tierForStreak(afterMatch(12, false, 4), 4)).toBe("mid");
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
    expect(recordLadderMatch(at4, { won: true, tier: "easy", boardSize: 5 })).toBe(at4);
    expect(recordLadderMatch(at4, { won: false, tier: null, boardSize: 5 })).toBe(at4);
  });

  it("records a best that a later loss cannot take away", () => {
    let l = emptyLadder();
    for (let i = 0; i < 7; i++)
      l = recordLadderMatch(l, { won: true, tier: tierForStreak(l.streak, 5), boardSize: 5 });
    expect(l.streak).toBe(7);
    expect(l.best).toBe(7);
    l = recordLadderMatch(l, { won: false, tier: "elite", boardSize: 5 });
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
  it("names the rung a loss ACTUALLY drops you to on a three-rung board", () => {
    // The bug this caught: the lobby derived the drop as `streak - 2` instead
    // of asking `afterMatch`, so on 4x4 at the top it read "a loss drops you to
    // Hard" while you were standing on Hard. Any view that re-derives a rule
    // gets it wrong exactly where the rule has a special case — here, the clamp.
    const shown = (streak: number, board: number) =>
      tierForStreak(afterMatch(streak, false, board), board);
    expect(tierForStreak(6, 4), "top rung on the standard board").toBe("hard");
    expect(shown(6, 4), "and a loss really lands on even").toBe("mid");
    expect(shown(6, 5), "elite drops to hard on the large board").toBe("hard");
    // The naive version, kept as the thing that must NOT be used.
    expect(tierForStreak(6 - WINS_PER_RUNG, 4)).toBe("hard");
  });
});
