// TALENTS ARE AIMED (owner's call, 2026-10-02: "Talents should be aimable").
// A Talent is a Special you get once, and it is placed the way a Special is:
// the player picks where each shot goes, and a corridor Talent is pointed on
// Domination's board. Self-buffs and hit-everyone Talents stay one press.
import { describe, expect, it } from "vitest";
import { DOMINATION_7X7, newDomination } from "../../data/domination";
import { getDef } from "../../data/cards";
import { advance, applyIntent, createInitialState } from "../index";
import { talentIsPicked, talentPickCap, talentShotsStack, talentTargets } from "../rules";
import { summonCard } from "../state";
import { bigPrepState, place } from "./helpers";
import type { GameState, PlayerId } from "../types";

function battleWith(s: GameState, activeId: string): GameState {
  s.phase = "battle";
  s.prep = null;
  s.battle = { queue: [activeId], index: 0, awaitingInput: activeId };
  return s;
}
const talent = (s: GameState, id: string, targetIds: string[]) =>
  applyIntent(battleWith(s, id), { type: "BATTLE_ACTION", player: "P1", action: "talent", targetIds } as never);

describe("which Talents are picked", () => {
  const s = bigPrepState();
  it("targeted Talents are, self-buffs and hit-everyone Talents are not", () => {
    for (const id of ["dawn_quasar", "pyro_komodo", "dawn_goldeneagle", "gale_gyre", "pyro_wick"])
      expect(talentIsPicked(s, getDef(id).talent), id).toBe(true);
    for (const id of ["gale_hawk", "bolt_buzz", "leaf_oak", "aqua_tide", "bore_dunebuggy", "bolt_handyman",
                      "gale_whirlwolf", "dusk_scarlett", "aqua_siphon", "bolt_hacker"])
      expect(talentIsPicked(s, getDef(id).talent), id).toBe(false);
    // A corridor is a Confirm on a board you cross: forward is the only way.
    expect(talentIsPicked(s, getDef("pyro_chopper").talent)).toBe(false);
  });
  it("a three-shot volley takes three picks that can stack; a nova's cannot", () => {
    expect(talentPickCap(getDef("dawn_goldeneagle").talent)).toBe(3);
    expect(talentShotsStack(getDef("dawn_goldeneagle").talent)).toBe(true);
    expect(talentShotsStack(getDef("gale_gyre").talent)).toBe(false);
  });
});

describe("every shot lands where it was placed", () => {
  it("Golden Eagle can put all three shots on one card", () => {
    const s = bigPrepState();
    const eagle = place(s, "dawn_goldeneagle", "P1", 3, 2);
    const a = place(s, "leaf_oak", "P2", 2, 1, { curHp: 40, maxHp: 40, curShields: 0 });
    const b = place(s, "leaf_oak", "P2", 2, 3, { curHp: 40, maxHp: 40, curShields: 0 });
    const next = talent(s, eagle.instanceId, [a.instanceId, a.instanceId, a.instanceId]);
    expect(next.cards[a.instanceId].curHp, "all three shots on the one picked").toBe(31);
    expect(next.cards[b.instanceId].curHp, "none spilled onto the other").toBe(40);
  });
  it("more picks than it has shots is refused", () => {
    const s = bigPrepState();
    const eagle = place(s, "dawn_goldeneagle", "P1", 3, 2);
    const a = place(s, "leaf_oak", "P2", 2, 1);
    expect(() => talent(s, eagle.instanceId, [a.instanceId, a.instanceId, a.instanceId, a.instanceId])).toThrow();
  });
});

// ── Domination: the corridor points any of the four ways ─────────────────────
const DECK = [
  "leaf_oak", "leaf_python", "leaf_birch", "leaf_stickers", "leaf_nettle", "leaf_weeds",
  "leaf_sticks", "leaf_cactus", "leaf_leaf", "leaf_stickviper", "leaf_hunter", "leaf_walking_tree",
];
function domState(): GameState {
  let s: GameState = createInitialState(7, DECK, DECK, ["P1", "P2"], undefined, [], DOMINATION_7X7.boardSize);
  s.domination = newDomination(DOMINATION_7X7);
  s.players.P1.mulliganDone = true;
  s.players.P2.mulliganDone = true;
  for (let i = 0; i < 40 && s.phase === "mulligan"; i++) s = advance(s);
  s.phase = "prep";
  s.prep = { priority: "P1", consecutivePasses: 0, movedThisTurn: false };
  return s;
}

describe("Chopper's Peel Out on Domination", () => {
  it("is picked there, reaches sideways, and burns and rolls the way it was pointed", () => {
    const s = domState();
    const bike = summonCard(s, "P1", "pyro_chopper", { row: 3, col: 2 } as never);
    bike.summonedThisRound = false;
    const side = summonCard(s, "P2" as PlayerId, "leaf_weeds", { row: 3, col: 3 } as never);
    side.curHp = 40; side.maxHp = 40; side.curShields = 0;
    const ahead = summonCard(s, "P2" as PlayerId, "leaf_weeds", { row: 2, col: 2 } as never);
    ahead.curHp = 40; ahead.maxHp = 40; ahead.curShields = 0;

    expect(talentIsPicked(s, getDef("pyro_chopper").talent)).toBe(true);
    const offered = talentTargets(s, bike.instanceId).map((t) => t.instanceId);
    expect(offered).toContain(side.instanceId);
    expect(offered).toContain(ahead.instanceId);

    const next = talent(s, bike.instanceId, [side.instanceId]);
    expect(next.cards[side.instanceId].curHp, "the corridor it was pointed down").toBeLessThan(40);
    expect(next.cards[ahead.instanceId].curHp, "not the one ahead").toBe(40);
    expect(next.cards[bike.instanceId].pos?.row, "it rolled along the row, not up the board").toBe(3);
    expect(next.specialAim, "the aim is transient").toBeUndefined();
  });
});
