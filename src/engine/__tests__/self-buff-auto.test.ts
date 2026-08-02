// A card on BASIC auto with nothing in reach used to skip its turn forever.
// For Oakgre that was a trap rather than an inconvenience: it is printed at SP 0
// and Uprooted (+3 SP) is the only thing that ever unpins it, so a melee body
// that cannot reach anyone could never attack, never fire the buff, and never
// move — for the whole game.

import { describe, expect, it } from "vitest";
import { advance, applyIntent, createInitialState } from "../index";
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
