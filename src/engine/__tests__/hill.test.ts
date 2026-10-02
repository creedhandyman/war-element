// KING OF THE HILL is symmetric (owner, 2026-10-02). The hill was a flat
// `row 1 or 2`, written for the 4x4; on the 5x5 that put it one step from the
// top seat's Home and two from the bottom's. Domination's hill is a Point,
// and only one its owner has filled.
import { describe, expect, it } from "vitest";
import { createInitialState, effectiveDmg, fullHills, onHill } from "../state";
import { DOMINATION_7X7, newDomination, poiRing } from "../../data/domination";
import { place, prepState } from "./helpers";
import type { GameState } from "../types";

const big = (): GameState => createInitialState(42, undefined, undefined, ["P1"], undefined, undefined, 5);
const seven = (): GameState => {
  const s = createInitialState(42, undefined, undefined, ["P1", "P2"], undefined, [], 7);
  s.domination = newDomination(DOMINATION_7X7);
  return s;
};

describe("the hill on the duel boards", () => {
  it("4x4: rows 1 and 2, as before", () => {
    const s = prepState();
    for (const [row, hill] of [[0, false], [1, true], [2, true], [3, false]] as const)
      expect(onHill(s, place(s, "leaf_birch", "P1", row, row % 4)), `row ${row}`).toBe(hill);
  });

  it("5x5: every row between the Home rows — the same distance from both seats", () => {
    const s = big();
    for (const [row, hill] of [[0, false], [1, true], [2, true], [3, true], [4, false]] as const)
      expect(onHill(s, place(s, "leaf_birch", "P1", row, row)), `row ${row}`).toBe(hill);
    // One step out of either Home is the hill: row 3 for P1, row 1 for P2.
    const p1 = place(s, "leaf_birch", "P1", 3, 4);
    const p2 = place(s, "leaf_birch", "P2", 1, 4);
    expect(onHill(s, p1)).toBe(true);
    expect(onHill(s, p2)).toBe(true);
  });

  it("5x5: holding the whole row in front of P1's Home is a full lane now", () => {
    const s = big();
    const back = place(s, "leaf_birch", "P1", 4, 0);
    const before = effectiveDmg(s, back);
    for (let col = 0; col < 5; col++) place(s, "leaf_birch", "P1", 3, col);
    expect(fullHills(s, "P1")).toBe(1);
    expect(effectiveDmg(s, back)).toBe(before + 1);
  });
});

describe("the hill in Domination is a filled Point", () => {
  const A = DOMINATION_7X7.pois[0];

  it("rows 1-2 alone are not the hill any more", () => {
    const s = seven();
    expect(onHill(s, place(s, "leaf_birch", "P1", 2, 3))).toBe(false);
  });

  it("a part-filled Point gives nothing; a filled one lifts its ring and the whole side", () => {
    const s = seven();
    const ring = poiRing(A);
    const cards = ring.slice(0, 7).map((p) => place(s, "leaf_birch", "P1", p.row, p.col));
    const away = place(s, "leaf_birch", "P1", 6, 3);
    const base = effectiveDmg(s, away);
    expect(onHill(s, cards[0])).toBe(false);
    expect(fullHills(s, "P1")).toBe(0);
    // The eighth square closes the ring.
    place(s, "leaf_birch", "P1", ring[7].row, ring[7].col);
    expect(onHill(s, cards[0])).toBe(true);
    expect(fullHills(s, "P1")).toBe(1);
    expect(effectiveDmg(s, away)).toBe(base + 1);          // the whole side
    expect(effectiveDmg(s, cards[0])).toBe(base + 2);      // + its own hill
  });

  it("an enemy body on the ring keeps it from being filled", () => {
    const s = seven();
    const ring = poiRing(A);
    const mine = ring.slice(0, 7).map((p) => place(s, "leaf_birch", "P1", p.row, p.col));
    place(s, "leaf_birch", "P2", ring[7].row, ring[7].col);
    expect(onHill(s, mine[0])).toBe(false);
    expect(fullHills(s, "P1")).toBe(0);
  });
});
