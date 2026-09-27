// IN DOMINATION, THERE IS NO HOME ROW TO DEFEND.
//
// The AI kills "an invader standing on our own Home row" first — right in a
// duel, where that invader is about to capture. Domination captures nothing,
// and `homeRow` is row 0 for every seat but P1: the row P1's top shrine is on.
// So in a four-way match every AI treated P1's fresh arrivals as invaders and
// focused them. Measured over 30 all-AI four-seat matches: P1 won 3 and the
// other seats 8-10; with the rule held to non-Domination play, 7 / 7 / 9 / 7.
// P1 is the seat the player sits in.
import { describe, expect, it } from "vitest";
import { premadeDecksFor } from "../../data/custom-decks";
import { DOMINATION_7X7, newDomination } from "../../data/domination";
import { chooseBattleAction } from "../ai";
import { createInitialState } from "../state";
import type { GameState } from "../types";
import { place } from "./helpers";

function fourWay(): GameState {
  const decks = premadeDecksFor(DOMINATION_7X7.boardSize);
  const s = createInitialState(7, decks[0].cards, decks[1].cards, [], decks[0].spells, decks[1].spells,
    DOMINATION_7X7.boardSize, undefined, undefined, undefined,
    [{ id: "P3", deck: decks[2].cards, spells: decks[2].spells }]);
  s.domination = newDomination(DOMINATION_7X7);
  s.phase = "battle";
  s.aiSkill = "sharp";
  return s;
}

/** A P2 card with two opponents beside it: P1's on row 0 (P2's "Home row"),
 *  and a P3 Assassin — the higher threat — on row 1. Neither can be killed. */
function standoff(s: GameState) {
  const me = place(s, "bore_clubber", "P2", 1, 3);
  const onRowZero = place(s, "leaf_greegon", "P1", 0, 3, { curHp: 900, maxHp: 900, curShields: 0 });
  const assassin = place(s, "gale_vaga", "P3", 1, 4, { curHp: 900, maxHp: 900, curShields: 0 });
  return { me, onRowZero, assassin };
}

describe("Domination has no Home row to defend", () => {
  it("an AI swings at the bigger threat, not at P1 for standing on row 0", () => {
    const s = fourWay();
    const { me, assassin } = standoff(s);
    expect(chooseBattleAction(s, me.instanceId).targetId).toBe(assassin.instanceId);
  });

  it("...while in a duel an invader on the Home row still dies first", () => {
    const s = fourWay();
    s.domination = undefined;
    const { me, onRowZero } = standoff(s);
    expect(chooseBattleAction(s, me.instanceId).targetId).toBe(onRowZero.instanceId);
  });
});
