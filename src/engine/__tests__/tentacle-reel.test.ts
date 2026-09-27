// Octoirate's Tentacle Reel (owner-reported: "tentacle reel is broken").
//
// It was `pullOnAttack`: the struck enemy was dragged down its OWN column
// toward Octoirate's side of the board. Octoirate is Ranged and usually swings
// from its home row, and that drag may not step onto the home row. So the
// enemy in the row in front, its commonest target, never moved at all, and a
// target further out only ever came straight down its column, never toward
// Octoirate. It is now `reelOnAttack`: a king-step toward Octoirate itself (the
// lasso's `reelToCaster`), which closes both axes, stops beside it, steps
// around a body in the way, and never ends on the home row.
import { describe, expect, it } from "vitest";
import { getDef } from "../../data/cards";
import { describePassives } from "../../ui/card-text";
import { advance, applyIntent } from "../phases";
import { atCleanup, place, prepState } from "./helpers";
import type { GameState, PlayerId } from "../types";

const OCTO = "aqua_octoirate";
const BODY = "dusk_gool"; // AQUA into DUSK is never dodged, so every swing lands

/** Octoirate swings once at the body, through the real intent path. */
function swing(
  octoAt: [number, number],
  foeAt: [number, number],
  owner: PlayerId = "P1",
  setup?: (s: GameState) => void,
) {
  const s = prepState();
  const octo = place(s, OCTO, owner, octoAt[0], octoAt[1]);
  const foe = place(s, BODY, owner === "P1" ? "P2" : "P1", foeAt[0], foeAt[1], {
    curHp: 40, maxHp: 40, curShields: 0,
  });
  setup?.(s);
  s.phase = "battle";
  s.prep = null;
  s.battle = { queue: [octo.instanceId], index: 0, awaitingInput: octo.instanceId };
  const n = applyIntent(s, {
    type: "BATTLE_ACTION", player: owner, action: "basic", targetId: foe.instanceId,
  } as never);
  return { n, foe: n.cards[foe.instanceId] };
}

describe("Tentacle Reel reels the struck enemy toward Octoirate", () => {
  it("the enemy in the row in front, off to one side, comes sideways (it used to stay put)", () => {
    // Octoirate on its home row (3,1); the target in the row in front, two
    // columns over. The column drag's only step was onto the home row, so it
    // never moved. The reel takes it sideways, beside Octoirate.
    const { n, foe } = swing([3, 1], [2, 3]);
    expect(foe.curHp, "the swing landed").toBeLessThan(40);
    expect(foe.pos).toEqual({ row: 2, col: 2 });
    expect(n.log.some((l) => /Octoirate .*reels .* in 1 slot/.test(l)), n.log.slice(-4).join(" | ")).toBe(true);
  });

  it("a target further out comes in diagonally, not straight down its own column", () => {
    expect(swing([3, 1], [1, 3]).foe.pos).toEqual({ row: 2, col: 2 });
  });

  it("one slot per swing", () => {
    // From two squares out on both axes it closes one king-step, not all the way.
    expect(swing([2, 1], [0, 3]).foe.pos).toEqual({ row: 1, col: 2 });
  });

  it("a target already beside it stays where it is", () => {
    expect(swing([3, 1], [2, 1]).foe.pos, "straight in front").toEqual({ row: 2, col: 1 });
    expect(swing([3, 1], [2, 2]).foe.pos, "diagonal").toEqual({ row: 2, col: 2 });
  });

  it("never onto Octoirate's own home row, so it never hands over a capture", () => {
    const { n, foe } = swing([3, 1], [2, 3]);
    expect(foe.pos!.row).not.toBe(3);
    const done = advance(atCleanup(n));
    for (let c = 0; c < 4; c++) expect(done.slots[3][c].capturedBy, `home slot ${c}`).toBeFalsy();
  });

  it("steps around a body in the way", () => {
    // The diagonal square (2,2) is taken (by Octoirate's own ally, which does
    // not screen the shot), so the reel takes the row axis to (2,3) instead.
    const { foe } = swing([3, 1], [1, 3], "P1", (s) => place(s, BODY, "P1", 2, 2));
    expect(foe.pos).toEqual({ row: 2, col: 3 });
  });

  it("works the same from P2's seat", () => {
    expect(swing([0, 1], [2, 3], "P2").foe.pos).toEqual({ row: 1, col: 2 });
  });

  it("the card says what it does, under its own name", () => {
    const def = getDef(OCTO);
    expect(def.reelOnAttack).toBe(1);
    expect(def.pullOnAttack, "the column drag is gone from Octoirate").toBeUndefined();
    const text = describePassives(def).join(" | ");
    expect(text).toContain("Tentacle Reel — a landed basic reels the struck enemy 1 slot toward it, from any side.");
    expect(text).not.toContain("Sucker Sword");
  });
});
