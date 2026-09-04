// The claim under the placement change (ui/App.tsx `needsConfirm`): a summon is
// only worth a second press when it paints something the player has not already
// seen. That "something" is `previewOnSummonArea`, so this pins BOTH halves —
// that ordinary cards paint nothing, and that a card with a hostile on-summon
// still does. If the second half ever came back empty the UI would quietly
// start committing those blind, which is the one case the confirm is FOR.
//
// Measured against a board WITH ENEMIES ON IT, deliberately. The preview draws
// victims, not ground, so on an empty board every card in the game paints
// nothing and a version of this test that forgets to place anything passes
// while proving nothing at all.
import { describe, expect, it } from "vitest";
import { CARDS, getDef } from "../../data/cards";
import { previewOnSummonArea } from "../rules";
import { prepState, place } from "./helpers";
import type { GameState, Pos } from "../types";

/** P1's home row on the 4x4, and an enemy standing on every square of the two
 *  rows in front of it — the widest target picture a summon could ever have. */
function crowded(): GameState {
  const s = prepState();
  for (let col = 0; col < 4; col++) {
    place(s, "leaf_sumerose", "P2", 0, col);
    place(s, "leaf_sumerose", "P2", 1, col);
  }
  return s;
}

describe("which placements are worth confirming", () => {
  const game = crowded();
  const at = (id: string) => previewOnSummonArea(game, getDef(id), "P1", { row: 3, col: 2 } as Pos);

  it("a card with no hostile on-summon paints nothing, even with the board full of targets", () => {
    const plain = CARDS.filter((c) => !c.boss && !c.onSummon);
    expect(plain.length, "no plain cards at all?").toBeGreaterThan(20);
    for (const c of plain) expect(at(c.id), `${c.id} painted an area`).toEqual([]);
  });

  it("a card that DOES strike on summon paints its victims", () => {
    // Whatever the roster holds, at least one hostile on-summon must light up
    // against a board this crowded — otherwise the confirm has become dead code
    // and the red area it is guarding never appears.
    const strikers = CARDS.filter((c) => !c.boss && c.onSummon && c.onSummon.targetSide !== "ally");
    expect(strikers.length, "no on-summon strikers on the roster").toBeGreaterThan(0);
    const painted = strikers.filter((c) => at(c.id).length > 0);
    expect(painted.length, `none of ${strikers.length} strikers painted anything`).toBeGreaterThan(0);
  });

  it("...and the quiet ones are the majority, so skipping the confirm is the common case", () => {
    const draft = CARDS.filter((c) => !c.boss);
    const silent = draft.filter((c) => at(c.id).length === 0);
    expect(silent.length / draft.length).toBeGreaterThan(0.5);
  });
});
