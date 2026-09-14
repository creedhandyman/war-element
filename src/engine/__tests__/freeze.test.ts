import { describe, it, expect } from "vitest";
import { advance } from "../phases";
import { createInitialState } from "../state";
import type { GameState } from "../types";
import { CARDS } from "../../data/cards";

describe("the prep-phase watchdog", () => {
  it("stays INERT through real matches", () => {
    // WHAT THIS DOES AND DOES NOT TEST, stated plainly. The watchdog in the
    // prep branch of advance() passes a turn whose intent changed nothing. The
    // intent that once did that was a hero power, since fixed at the source and
    // since removed, so the FIRE path has nothing to trigger it — it is a
    // backstop for a class of bug that currently has no instance.
    //
    // What IS testable is the risk of HAVING it: a watchdog that misreads a
    // legitimate turn as no-progress would silently eat it. So this asserts it
    // never fires in ordinary play. If it ever does, something either really is
    // stuck or `progressKey` is blind to a real action — both worth knowing.
    const field = CARDS.filter((c) => c.element === "DUSK" && !c.boss).slice(0, 18).map((c) => c.id);
    for (const seed of [5, 21, 44]) {
      let s: GameState = createInitialState(seed, field, field, [], [], [], 4);
      let steps = 0;
      while (s.phase !== "gameover" && steps < 8000) { s = advance(s); steps++; }
      expect(s.phase, `seed ${seed} did not finish`).toBe("gameover");
      const fired = s.log.filter((l) => /had nothing it could do/.test(l));
      expect(fired, `seed ${seed}: watchdog fired on a real turn`).toEqual([]);
    }
  }, 120_000);

  it("a match between two hearts seats runs to completion instead of stalling", () => {
    // The end-to-end guard, kept from the freeze that first needed it: the
    // hearts seat's prep turn is where the board once stopped for good. The
    // suit still decides how each AI plays, so the matchup still earns a run.
    const field = CARDS.filter((c) => c.element === "AQUA" && !c.boss).slice(0, 18).map((c) => c.id);
    for (const seed of [3, 7, 11]) {
      let s: GameState = createInitialState(seed, field, field, [], [], [], 4);
      s.seatSuits = { P1: "heart", P2: "heart", P3: "club", P4: "spade" } as never;
      let steps = 0;
      while (s.phase !== "gameover" && steps < 8000) { s = advance(s); steps++; }
      expect(s.phase, `seed ${seed} stalled at round ${s.round} after ${steps} steps`)
        .toBe("gameover");
      // ...and it got there by PLAYING, not by the round cap timing out on a
      // board nobody could move.
      expect(steps, `seed ${seed} used the whole step budget`).toBeLessThan(8000);
    }
  }, 120_000);
});
