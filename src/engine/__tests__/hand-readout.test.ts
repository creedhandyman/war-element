import { describe, expect, it } from "vitest";
import { readoutStatus } from "../../ui/Hand";
import { getDef } from "../../data/cards";
import type { GameState } from "../types";
import { prepState } from "./helpers";

// THE HIGHLIGHTED HAND CARD'S READOUT says what to do with the card next, or
// why it cannot be summoned yet. On a desktop the hint line beside the Pass
// button says so; the phone layouts hide that line, so a tap on a card you
// could not afford used to answer with nothing at all.
describe("the hand readout's status line", () => {
  const withHand = (gold: number): GameState => {
    const s = prepState(1, "P1");
    s.players.P1.hand = [{ handId: "h1", defId: "leaf_greegon" }];
    s.players.P1.gold = gold;
    return s;
  };
  const cost = getDef("leaf_greegon").cost;
  const status = (s: GameState, o: Partial<{ armed: boolean; staged: boolean; summonable: boolean; homeRowOpen: boolean }> = {}) =>
    readoutStatus({ game: s, player: "P1", handId: "h1", armed: false, staged: false, summonable: false, homeRowOpen: true, ...o });

  it("armed: where to put it; staged: that it waits on Confirm", () => {
    expect(status(withHand(9), { armed: true, summonable: true })).toEqual({ kind: "armed", text: "Tap a glowing Home slot" });
    expect(status(withHand(9), { armed: true, staged: true, summonable: true }).kind).toBe("staged");
  });

  it("Domination deploys at shrines, and says so", () => {
    const s = withHand(9);
    s.domination = {} as GameState["domination"];
    expect(status(s, { armed: true }).text).toBe("Tap a glowing shrine");
    expect(status(s, { homeRowOpen: false }).text).toBe("All shrines taken");
  });

  it("not your prep turn: when you can", () => {
    const s = withHand(9);
    s.prep!.priority = "P2";
    expect(status(s, { summonable: true })).toEqual({ kind: "turn", text: "Summon on your prep turn" });
  });

  it("a full Home row, before the Gold", () => {
    expect(status(withHand(0), { homeRowOpen: false })).toEqual({ kind: "room", text: "Home row full" });
  });

  it("short of Gold: the price it would take", () => {
    expect(status(withHand(cost - 1))).toEqual({ kind: "gold", text: `Need ${cost} Gold` });
  });

  it("summonable and not yet armed: tap it; refused for another reason: can't now", () => {
    expect(status(withHand(9), { summonable: true }).kind).toBe("ready");
    expect(status(withHand(9)).kind).toBe("other");
  });
});
