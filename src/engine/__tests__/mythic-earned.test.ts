// MYTHICS ARE EARNED BY WINNING (owner, 2026-10-06): no recruit %, and any
// win of its node hands over a Mythic you still lack.
import { describe, expect, it } from "vitest";
import { getDef } from "../../data/cards";
import { earnedByWin, newSave, nodeById, recruitLabel, recruitablePool, rollRecruits } from "../../data/story";

describe("Mythics are earned by winning", () => {
  it("label 'win' with no percentage; everything else keeps its odds", () => {
    expect(recruitLabel("leaf_trinezer", 0)).toBe("win");
    expect(recruitLabel("leaf_trinezer", 9)).toBe("win");
    expect(recruitLabel("leaf_nettle", 0)).toMatch(/^\d+%$/);
    expect(earnedByWin("leaf_trinezer")).toBe(getDef("leaf_trinezer").rarity === "mythic");
  });

  it("a repeat win of a Throne still hands over a Mythic you lack, whatever the dice", () => {
    const throne = nodeById("L13")!;
    const mythic = recruitablePool(throne).find(earnedByWin)!;
    expect(mythic).toBeTruthy();
    const save = { ...newSave(), cleared: [throne.id] }; // not a first clear
    const res = rollRecruits(save, throne, 1, () => 0.999); // every roll misses
    expect(res.won).toContain(mythic);
  });
});
