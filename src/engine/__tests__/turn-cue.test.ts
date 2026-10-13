// THE TURN CUE (ui/turn-cue.ts): the one line on a phone between taps that says
// whose move it is and the obvious thing to do with it.
import { describe, expect, it } from "vitest";
import type { GameState } from "..";
import { turnCue } from "../../ui/turn-cue";
import { prepState } from "./helpers";

const clone = (s: GameState): GameState => structuredClone(s);
const ask = (game: GameState, o: Partial<{ summonable: number; handSize: number; homeRowOpen: boolean }> = {}) =>
  turnCue({ game, player: "P1", summonable: 2, handSize: 3, homeRowOpen: true, ...o });

describe("turnCue", () => {
  const mine = prepState(42, "P1");

  it("says to tap a glowing card when there is one to play", () => {
    expect(ask(mine)).toEqual({ tone: "go", text: "Your move · tap a glowing card to play it" });
  });

  it("says why nothing glows, and what is still worth doing", () => {
    expect(ask(mine, { summonable: 0 })?.text).toMatch(/Not enough Gold/);
    expect(ask(mine, { summonable: 0, handSize: 0 })?.text).toMatch(/move a card, or Pass/);
  });

  it("stays quiet when the Home row is full: the hand already says so", () => {
    expect(ask(mine, { summonable: 0, homeRowOpen: false })).toBeNull();
  });

  it("names the free first card in the campaign's opening deployment", () => {
    const g = clone(mine);
    g.opening = { P1: 1 };
    expect(ask(g)?.text).toMatch(/first is free/);
    // ...but only while a card can actually be placed.
    expect(ask(g, { summonable: 0 })?.text).not.toMatch(/first is free/);
  });

  it("waits calmly while the other side holds priority", () => {
    const g = clone(mine);
    g.prep!.priority = "P2";
    expect(ask(g)).toEqual({ tone: "wait", text: "Their move…" });
  });

  it("is silent outside Prep and once the game is over", () => {
    const battle = clone(mine);
    battle.phase = "battle";
    expect(ask(battle)).toBeNull();
    const over = clone(mine);
    over.win = { winner: "P1", by: "elimination" };
    expect(ask(over)).toBeNull();
  });
});
