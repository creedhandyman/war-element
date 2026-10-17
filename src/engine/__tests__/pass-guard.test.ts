// THE PASS GUARD (ui/pass-guard.ts): ask before the one pass that is almost never
// meant — an empty board of yours with something in hand you could put down.
import { describe, expect, it } from "vitest";
import type { GameState } from "..";
import { shouldConfirmPass } from "../../ui/pass-guard";
import { place, prepState } from "./helpers";

const rich = (): GameState => {
  const s = prepState(42, "P1");
  s.players.P1.gold = 10; // anything in hand is affordable
  return s;
};

describe("shouldConfirmPass", () => {
  it("asks when the board is empty and a card could be played", () => {
    const s = rich();
    expect(s.players.P1.hand.length).toBeGreaterThan(0);
    expect(shouldConfirmPass(s, "P1")).toBe(true);
  });

  it("does not ask when nothing in hand is playable", () => {
    const s = prepState(42, "P1");
    s.players.P1.gold = 0;
    expect(shouldConfirmPass(s, "P1")).toBe(false);
    const empty = rich();
    empty.players.P1.hand = [];
    expect(shouldConfirmPass(empty, "P1")).toBe(false);
  });

  it("does not ask once a card of yours is out — passing is then an ordinary choice", () => {
    const s = rich();
    place(s, s.players.P1.hand[0].defId, "P1", 3, 1);
    expect(shouldConfirmPass(s, "P1")).toBe(false);
  });

  it("an enemy card on the board changes nothing", () => {
    const s = rich();
    place(s, s.players.P1.hand[0].defId, "P2", 0, 1);
    expect(shouldConfirmPass(s, "P1")).toBe(true);
  });

  it("is silent when it is not your Prep turn", () => {
    const theirs = rich();
    theirs.prep!.priority = "P2";
    expect(shouldConfirmPass(theirs, "P1")).toBe(false);
    const battle = rich();
    battle.phase = "battle";
    expect(shouldConfirmPass(battle, "P1")).toBe(false);
  });
});
