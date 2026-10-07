// Hard mode: a story foil roll on a card you OWN is 5% (owner, 2026-10-06);
// everything else keeps 1%.
import { describe, expect, it } from "vitest";
import {
  HARD_OWNED_FOIL_CHANCE, SHINY_CHANCE, foilChanceFor, newSave, nodeById, recruitablePool, rollRecruits,
} from "../../data/story";

describe("Hard mode foil odds on owned cards", () => {
  const node = nodeById("L2")!;
  const pool = recruitablePool(node);
  const owned = { ...newSave(), collection: [...new Set([...newSave().collection, ...pool])] };
  const hard = { ...owned, hardRun: 1 };
  const roll3 = () => 0.03; // every draw: pick the first card, a 3% roll

  it("is 5% on an owned card in Hard mode, 1% otherwise", () => {
    expect(HARD_OWNED_FOIL_CHANCE).toBe(5);
    expect(foilChanceFor(hard, pool[0])).toBe(5);
    expect(foilChanceFor(owned, pool[0])).toBe(SHINY_CHANCE);
    expect(foilChanceFor({ ...newSave(), hardRun: 1 }, "not_owned_card")).toBe(SHINY_CHANCE);
  });

  it("a 3% roll on a finished node drops a foil in Hard mode, not on a normal run", () => {
    expect(rollRecruits(hard, node, 1, roll3).shiny).toHaveLength(1);
    expect(rollRecruits(owned, node, 1, roll3).shiny).toHaveLength(0);
  });
});
