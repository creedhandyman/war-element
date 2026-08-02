// A card on BASIC auto with nothing in reach used to skip its turn forever.
// For Oakgre that was a trap rather than an inconvenience: it is printed at SP 0
// and Uprooted (+3 SP) is the only thing that ever unpins it, so a melee body
// that cannot reach anyone could never attack, never fire the buff, and never
// move — for the whole game.

import { describe, expect, it } from "vitest";
import { advance, applyIntent, canFireSpecial, createInitialState } from "../index";
import { summonCard } from "../state";
import type { GameState } from "../index";

const DECK = [
  "leaf_oak", "leaf_python", "leaf_birch", "leaf_stickers", "leaf_nettle", "leaf_weeds",
  "leaf_sticks", "leaf_cactus", "leaf_leaf", "leaf_stickviper", "leaf_hunter", "leaf_walking_tree",
];

/** A live game with Oakgre parked in P1's home row on the given auto mode.
 *  P1 must be HUMAN-owned: an AI-driven side runs chooseBattleAction instead of
 *  the auto-mode policy, and fires the Special anyway — so testing against an AI
 *  side would prove nothing about this fix. */
function withOakgre(mode: "basic" | "manual") {
  let s: GameState = createInitialState(5, DECK, DECK, ["P1"], [], [], 4);
  s.players.P1.mulliganDone = true;
  for (let i = 0; i < 40 && s.phase === "mulligan"; i++) s = advance(s);
  const oak = summonCard(s, "P1", "leaf_oakgre", { row: 3, col: 0 });
  oak.autoMode = mode;
  oak.summonedThisRound = false;      // past the summon-turn lockout
  s.players.P1.magicPool = 20;
  return { s, id: oak.instanceId };
}

/** Play P1 as a player who only ever passes, so the only P1 card on the board is
 *  the Oakgre under test. Stops early if the battle asks P1 for input. Reports
 *  the PEAK spBonus seen, because a long run can end with Oakgre already dead
 *  and the final state would then read 0 for the wrong reason. */
function drive(s: GameState, watch: string, steps = 2000): { end: GameState; peakSp: number } {
  let peakSp = s.cards[watch]?.spBonus ?? 0;
  for (let i = 0; i < steps && s.phase !== "gameover"; i++) {
    if (s.battle?.awaitingInput) break;
    if (s.phase === "prep" && s.prep?.priority === "P1") {
      s = applyIntent(s, { type: "PASS", player: "P1" });
    } else {
      s = advance(s);
    }
    peakSp = Math.max(peakSp, s.cards[watch]?.spBonus ?? 0);
  }
  return { end: s, peakSp };
}

describe("self-buff on basic auto", () => {
  it("fires Uprooted rather than skipping the turn away", () => {
    const { s, id } = withOakgre("basic");
    const before = s.cards[id].spBonus ?? 0;
    const { end, peakSp } = drive(s, id);
    expect(end.battle?.awaitingInput ?? null, "basic auto should never prompt").toBeNull();
    expect(end.log.some((l) => /Uprooted/i.test(l)), "Uprooted never fired").toBe(true);
    // SP 0 -> above 0 is the whole point: moveReach(0) is 0, so this is the
    // difference between a card that can move and one that never can.
    expect(peakSp, "Uprooted fired but never granted SP").toBeGreaterThan(before);
  });

  it("still asks a manual card rather than deciding for it", () => {
    // Narrowness matters: auto-firing only ever replaces a WASTED turn. A player
    // who asked to be prompted still gets prompted.
    const { s, id } = withOakgre("manual");
    const { end } = drive(s, id);
    expect(end.battle?.awaitingInput).toBe(id);
    expect(end.log.some((l) => /Uprooted/i.test(l))).toBe(false);
  });
});


describe("Uprooted stacks three times and stops", () => {
  it("never grows past three casts however long the game runs", () => {
    // Left out of reach with magic to burn, Oakgre used to cast every round for
    // the rest of the game. The cap is what makes it a boss rather than a
    // runaway, and it is on the LIFETIME cast count, not per round. It may well
    // die before reaching the ceiling — the bound is the assertion, not the
    // arrival.
    const { s, id } = withOakgre("basic");
    const { end, peakSp } = drive(s, id);
    expect(peakSp, "Uprooted never fired at all").toBeGreaterThan(0);
    expect(peakSp % 3, "SP moved by something other than whole casts").toBe(0);
    expect(peakSp, "SP grew past three casts").toBeLessThanOrEqual(9);
    expect(end.cards[id]?.specialCasts ?? 0).toBeLessThanOrEqual(3);
  });

  it("stops exactly at the third cast when it does get there", () => {
    // Deterministic version of the bound: two casts in, it may fire once more
    // and then never again.
    const { s, id } = withOakgre("basic");
    s.cards[id].specialCasts = 2;
    expect(canFireSpecial(s, id).ok).toBe(true);
    s.cards[id].specialCasts = 3;
    expect(canFireSpecial(s, id).ok).toBe(false);
  });

  it("refuses once fully grown, with a reason a player can read", () => {
    const { s, id } = withOakgre("basic");
    s.cards[id].specialCasts = 3;
    const check = canFireSpecial(s, id);
    expect(check.ok).toBe(false);
    expect(check.reason).toMatch(/fully grown/i);
  });

  it("leaves Specials without a limit alone", () => {
    // maxStacks is opt-in: a card that never declared one must not be capped.
    const { s } = withOakgre("basic");
    const other = summonCard(s, "P1", "leaf_oak", { row: 3, col: 2 });
    other.summonedThisRound = false;
    other.specialCasts = 99;
    expect(canFireSpecial(s, other.instanceId).reason ?? "").not.toMatch(/fully grown/i);
  });
});