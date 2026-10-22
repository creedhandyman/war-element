// THE CARD COUNTER. One squad is now built for three measurements — 18 on a
// 4×4, 30 on a 5×5, and a campaign node's own cap — so what the counter says
// is the only thing standing between the player and building something legal
// nowhere. It is pure for that reason: the wording is the feature.

import { describe, expect, it } from "vitest";
import { BUILD_CEILING, sizeGuide, deckSizeFor } from "../../data/custom-decks";

describe("the ceiling", () => {
  it("is the biggest board's deck — 30", () => {
    expect(BUILD_CEILING).toBe(30);
    expect(BUILD_CEILING).toBe(deckSizeFor(5));
  });
});

describe("building with no node in front of you", () => {
  it("marks both formats, and marks neither as met while the count is between", () => {
    const g = sizeGuide(24);
    expect(g.marks.map((m) => m.at)).toEqual([18, 30]);
    expect(g.marks.every((m) => !m.met)).toBe(true);
    expect(g.ceiling).toBe(30);
    expect(g.over).toBe(0);
  });

  it("an exact 18 is READY for 4×4, and says what the other format needs", () => {
    const g = sizeGuide(18);
    expect(g.marks.find((m) => m.at === 18)!.met).toBe(true);
    expect(g.marks.find((m) => m.at === 30)!.met).toBe(false);
    expect(g.note).toContain("Ready for 4×4");
    expect(g.note).toContain("12 more");
  });

  it("an exact 30 is READY for 5×5", () => {
    const g = sizeGuide(30);
    expect(g.marks.find((m) => m.at === 30)!.met).toBe(true);
    expect(g.note).toBe("Ready for 5×5");
  });

  it("19 is legal nowhere, and the counter says so in both directions", () => {
    // The one state the old builder could not produce and the new one can —
    // so it is the one the counter has to explain rather than merely allow.
    const g = sizeGuide(19);
    expect(g.marks.every((m) => !m.met)).toBe(true);
    expect(g.note).toContain("11 more for a 5×5 squad");
    expect(g.note).toContain("1 over a 4×4 one");
  });

  it("counts what is still needed while the squad is short", () => {
    expect(sizeGuide(6).note).toBe("12 more for a 4×4 squad");
    expect(sizeGuide(0).note).toBe("Pick your first card");
  });

  it("past 30 it stops counting up and starts counting back", () => {
    const g = sizeGuide(33);
    expect(g.over).toBe(3);
    expect(g.note).toContain("3 over the 30-card ceiling");
  });
});

describe("standing on a campaign node with a cap", () => {
  it("shows the node FIRST, and the formats behind it", () => {
    const g = sizeGuide(10, { nodeCap: 14, node: "Titanfall" });
    expect(g.marks[0]).toMatchObject({ at: 14, cap: true, met: true });
    expect(g.marks[0].label).toContain("Titanfall");
    expect(g.ceiling).toBe(14);
    expect(g.note).toBe("4 more will fit this fight");
  });

  it("drops a format mark the node could never reach", () => {
    // A cap of 12 cannot hold an 18-card squad; marking 18 on a 12-cell ruler
    // would be a promise the fight refuses.
    const g = sizeGuide(9, { nodeCap: 12 });
    expect(g.marks.map((m) => m.at)).toEqual([12]);
  });

  it("keeps the formats when the cap is big enough to reach them", () => {
    const g = sizeGuide(20, { nodeCap: 22 });
    expect(g.marks.map((m) => m.at)).toEqual([22, 18]);
    expect(g.marks.find((m) => m.at === 18)!.met, "20 is not an 18-card squad").toBe(false);
  });

  it("is FULL at the cap, and over it past the cap", () => {
    expect(sizeGuide(14, { nodeCap: 14 }).note).toContain("Full for this fight");
    const over = sizeGuide(16, { nodeCap: 14 });
    expect(over.over).toBe(2);
    expect(over.note).toContain("2 over this fight's cap of 14");
  });

  it("an empty squad at a node still asks for the first card", () => {
    expect(sizeGuide(0, { nodeCap: 14 }).note).toBe("Pick your first card");
    expect(sizeGuide(0, { nodeCap: 14 }).marks[0].met, "nothing is not 'fits'").toBe(false);
  });
});
