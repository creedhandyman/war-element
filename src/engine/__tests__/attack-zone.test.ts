import { describe, expect, it } from "vitest";
import { advance } from "../phases";
import type { GameState } from "../types";
import { strikeZone } from "../../ui/attack-zone";
import { atBattle, place, prepState } from "./helpers";

// The row/column highlight is found by stepping the engine ahead and looking at
// what the step DID (a Special's `specialCasts` rose, or a card arrived), not by
// predicting it. These pin the geometry of each line shape and that a real
// battle step through `advance` is detected.
const squaresOf = (z: ReturnType<typeof strikeZone>) =>
  (z?.squares ?? []).map((s) => `${s.row},${s.col}`).sort();

/** `after` = `before` with this card's Special marked as fired. */
function fired(before: GameState, id: string): GameState {
  const after = structuredClone(before);
  after.cards[id].specialCasts += 1;
  return after;
}

describe("the line a row or column attack sweeps", () => {
  it("rowAhead lights the whole row in front, toward the enemy", () => {
    const s = prepState(1);
    const p2 = place(s, "aqua_blackice", "P2", 1, 1); // P2 faces down the board
    expect(squaresOf(strikeZone(s, fired(s, p2.instanceId)))).toEqual(["2,0", "2,1", "2,2", "2,3"]);
    const p1 = place(s, "aqua_blackice", "P1", 2, 3); // P1 faces up
    expect(squaresOf(strikeZone(s, fired(s, p1.instanceId)))).toEqual(["1,0", "1,1", "1,2", "1,3"]);
  });

  it("the sweep starts at the attacker and travels outward", () => {
    const s = prepState(1);
    const c = place(s, "aqua_blackice", "P2", 1, 0);
    const z = strikeZone(s, fired(s, c.instanceId))!;
    expect(z.owner).toBe("P2");
    expect(z.squares.map((q) => [q.col, q.order])).toEqual([[0, 0], [1, 1], [2, 2], [3, 3]]);
  });

  it("sameColumn lights the lane, both ways, but not the attacker's own square", () => {
    const s = prepState(1);
    const c = place(s, "bore_the_coreborer", "P1", 2, 1);
    expect(squaresOf(strikeZone(s, fired(s, c.instanceId)))).toEqual(["0,1", "1,1", "3,1"]);
  });

  it("enemyHomeRow lights the opponent's home row", () => {
    const s = prepState(1);
    const c = place(s, "gale_eagon", "P1", 3, 2);
    expect(squaresOf(strikeZone(s, fired(s, c.instanceId)))).toEqual(["0,0", "0,1", "0,2", "0,3"]);
  });

  it("an on-summon line attack is caught as the card arrives", () => {
    const s = prepState(1);
    const after = structuredClone(s);
    place(after, "aqua_buccaneers", "P2", 0, 2); // sameColumn on summon
    expect(squaresOf(strikeZone(s, after))).toEqual(["1,2", "2,2", "3,2"]);
  });

  it("a row sweep from the last row has nothing ahead of it and lights nothing", () => {
    const s = prepState(1);
    const c = place(s, "aqua_blackice", "P1", 0, 1);
    expect(strikeZone(s, fired(s, c.instanceId))).toBeNull();
  });

  it("a step with no line attack in it lights nothing", () => {
    const s = prepState(1);
    const c = place(s, "aqua_blackice", "P2", 1, 1);
    const after = structuredClone(s);
    after.cards[c.instanceId].curHp -= 3; // took a hit; fired nothing
    expect(strikeZone(s, after)).toBeNull();
  });

  it("a real battle step: the AI's row sweep is detected from advance()", () => {
    let s = prepState(3);
    const sweeper = place(s, "aqua_blackice", "P2", 1, 1);
    for (const col of [0, 1, 2]) place(s, "leaf_greegon", "P1", 2, col, { curHp: 2, curShields: 0, autoMode: "full" });
    s.players.P2.magicPool = 20;
    s = atBattle(s);
    s.players.P2.magicPool = 20;
    let found: ReturnType<typeof strikeZone> = null;
    for (let i = 0; i < 12 && !found && s.phase === "battle"; i++) {
      const next = advance(s);
      found = strikeZone(s, next);
      if (found) expect(next.cards[sweeper.instanceId]?.specialCasts ?? 1).toBeGreaterThan(0);
      s = next;
    }
    expect(found?.owner).toBe("P2");
    expect(squaresOf(found)).toEqual(["2,0", "2,1", "2,2", "2,3"]);
  });
});
