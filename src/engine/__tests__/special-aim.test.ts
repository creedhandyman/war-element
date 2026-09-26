import { describe, expect, it } from "vitest";
import { advance, applyIntent } from "../phases";
import { specialIsPicked, specialShotsStack, specialTargets } from "../rules";
import { getDef } from "../../data/cards";
import type { GameState } from "../types";
import { atBattle, place, prepState } from "./helpers";

// EVERY SHOT IS THE PLAYER'S TO PLACE (owner's call). A Special that fires a
// counted number of shots asks where each one goes, and still asks when there
// are no more targets in reach than shots; that case used to be an area, each
// target hit once on a Confirm. Only a Special with nothing to place keeps the
// one-tap Confirm.

const special = (id: string) => getDef(id).special;

describe("which Specials ask where their shots go", () => {
  it("a counted volley does, and its shots can stack on one card", () => {
    for (const id of ["gale_rayfen", "gale_goldspur", "gale_bluejay"]) {
      expect(specialIsPicked(special(id)), id).toBe(true);
      expect(specialShotsStack(special(id)), id).toBe(true);
    }
  });

  it("so does a single-target strike, and a heal on allies", () => {
    expect(specialIsPicked(special("leaf_sumerose"))).toBe(true);
    expect(specialIsPicked(special("dawn_amble"))).toBe(true);
  });

  it("a status nova asks too, but lands once per card", () => {
    expect(specialIsPicked(special("bore_sandman"))).toBe(true);
    expect(specialShotsStack(special("bore_sandman"))).toBe(false);
  });

  it("nothing to place keeps the one-tap Confirm", () => {
    for (const id of [
      "gale_kloud",   // self: raises a storm
      "bolt_storm",   // a zone: every ELECTRIFIED opponent
      "pyro_mortar",  // an anchored area, aimed by its own one-pick flow
      "gale_eagon",   // everyone in the far row
      "leaf_sprinu",  // Vernal: eight shots is the whole board
      "pyro_firefly", // RANDOM shots
      "bolt_general", // the nearest three, whatever is picked
      "dusk_brute",   // a sweep that reads no target
    ]) expect(specialIsPicked(special(id)), id).toBe(false);
  });
});

/** P1's `defId` at its turn in battle, awaiting the player's input. */
function myTurn(defId: string, foes: [number, number][], at: [number, number] = [3, 1]) {
  let s = prepState(3);
  const me = place(s, defId, "P1", at[0] as never, at[1] as never, { autoMode: "manual" });
  const ids = foes.map(([r, c]) =>
    place(s, "dusk_gool", "P2", r as never, c as never, { curHp: 900, maxHp: 900, curShields: 0 }).instanceId);
  s.players.P1.magicPool = 20;
  s = atBattle(s);
  s.players.P1.magicPool = 20;
  s.players.P2.magicPool = 0;
  while (s.phase === "battle" && s.battle?.awaitingInput !== me.instanceId) s = advance(s);
  expect(s.battle?.awaitingInput, "my card's turn").toBe(me.instanceId);
  return { s, me: me.instanceId, foes: ids };
}

const lost = (before: GameState, after: GameState, id: string) =>
  before.cards[id].curHp - after.cards[id].curHp;

describe("placing the shots", () => {
  it("two picks on one card land twice there, beside the one elsewhere", () => {
    // Rayfen's Ambush reaches anywhere, so both foes glow; stacking two of its
    // three shots on one of them is the choice the Confirm used to take away.
    const { s, me, foes: [a, b] } = myTurn("gale_rayfen", [[1, 1], [2, 2]]);
    const lit = specialTargets(s, me).map((t) => t.instanceId);
    expect(lit, "both foes glow").toEqual(expect.arrayContaining([a, b]));
    const after = applyIntent(s, { type: "BATTLE_ACTION", player: "P1", action: "special", targetIds: [a, a, b] });
    expect(lost(s, after, b)).toBeGreaterThan(0);
    expect(lost(s, after, a)).toBe(2 * lost(s, after, b));
  });

  it("a Special that picks its own victims fires with no picks named", () => {
    // Brute's sweep reads no target list. The board sends it none: naming every
    // lit card would count as too many for its one `targets`.
    const { s, me } = myTurn("dusk_brute", [[2, 0], [2, 1], [2, 2]], [3, 1]);
    const lit = specialTargets(s, me).map((t) => t.instanceId);
    expect(lit.length, "several cards in reach").toBeGreaterThan(1);
    expect(() => applyIntent(s, { type: "BATTLE_ACTION", player: "P1", action: "special", targetIds: lit }))
      .toThrow(/Too many targets/);
    expect(() => applyIntent(s, { type: "BATTLE_ACTION", player: "P1", action: "special", targetIds: [] }))
      .not.toThrow();
  });
});
