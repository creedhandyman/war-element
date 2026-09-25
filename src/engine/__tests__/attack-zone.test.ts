import { describe, expect, it } from "vitest";
import { advance, applyIntent } from "../phases";
import type { GameState } from "../types";
import { spellCast, strikeZone } from "../../ui/attack-zone";
import { atBattle, place, prepState } from "./helpers";

// The row/column highlight is found by stepping the engine ahead and looking at
// what the step DID (a Special's `specialCasts` rose, or a card arrived), not by
// predicting it. These pin the geometry of each line shape and that a real
// battle step through `advance` is detected.
const squaresOf = (z: ReturnType<typeof strikeZone>) =>
  (z?.squares ?? []).map((s) => `${s.row},${s.col}`).sort();

/** `after` = `before` with this card's Special marked as fired. */
function fired(before: GameState, id: string): GameState {
  const after = structuredClone(before);
  after.cards[id].specialCasts += 1;
  return after;
}

describe("the line a row or column attack sweeps", () => {
  it("rowAhead lights the whole row in front, toward the enemy", () => {
    const s = prepState(1);
    const p2 = place(s, "aqua_blackice", "P2", 1, 1); // P2 faces down the board
    expect(squaresOf(strikeZone(s, fired(s, p2.instanceId)))).toEqual(["2,0", "2,1", "2,2", "2,3"]);
    const p1 = place(s, "aqua_blackice", "P1", 2, 3); // P1 faces up
    expect(squaresOf(strikeZone(s, fired(s, p1.instanceId)))).toEqual(["1,0", "1,1", "1,2", "1,3"]);
  });

  it("the sweep starts at the attacker and travels outward", () => {
    const s = prepState(1);
    const c = place(s, "aqua_blackice", "P2", 1, 0);
    const z = strikeZone(s, fired(s, c.instanceId))!;
    expect(z.owner).toBe("P2");
    expect(z.squares.map((q) => [q.col, q.order])).toEqual([[0, 0], [1, 1], [2, 2], [3, 3]]);
  });

  it("sameColumn lights the lane, both ways, but not the attacker's own square", () => {
    const s = prepState(1);
    const c = place(s, "bore_the_coreborer", "P1", 2, 1);
    expect(squaresOf(strikeZone(s, fired(s, c.instanceId)))).toEqual(["0,1", "1,1", "3,1"]);
  });

  it("enemyHomeRow lights the opponent's home row", () => {
    const s = prepState(1);
    const c = place(s, "gale_eagon", "P1", 3, 2);
    expect(squaresOf(strikeZone(s, fired(s, c.instanceId)))).toEqual(["0,0", "0,1", "0,2", "0,3"]);
  });

  it("an on-summon line attack is caught as the card arrives", () => {
    const s = prepState(1);
    const after = structuredClone(s);
    place(after, "aqua_buccaneers", "P2", 0, 2); // sameColumn on summon
    expect(squaresOf(strikeZone(s, after))).toEqual(["1,2", "2,2", "3,2"]);
  });

  it("a row sweep from the last row has nothing ahead of it and lights nothing", () => {
    const s = prepState(1);
    const c = place(s, "aqua_blackice", "P1", 0, 1);
    expect(strikeZone(s, fired(s, c.instanceId))).toBeNull();
  });

  it("a step with no line attack in it lights nothing", () => {
    const s = prepState(1);
    const c = place(s, "aqua_blackice", "P2", 1, 1);
    const after = structuredClone(s);
    after.cards[c.instanceId].curHp -= 3; // took a hit; fired nothing
    expect(strikeZone(s, after)).toBeNull();
  });

  it("a real battle, stepped through advance(): the sweep is a line, the answer a target", () => {
    let s = prepState(3);
    const sweeper = place(s, "aqua_blackice", "P2", 1, 1);
    for (const col of [0, 1, 2]) place(s, "leaf_greegon", "P1", 2, col, { curHp: 2, curShields: 0, autoMode: "full" });
    s.players.P2.magicPool = 20;
    s = atBattle(s);
    s.players.P2.magicPool = 20;
    const zones: NonNullable<ReturnType<typeof strikeZone>>[] = [];
    for (let i = 0; i < 12 && s.phase === "battle"; i++) {
      const next = advance(s);
      const z = strikeZone(s, next);
      if (z) zones.push(z);
      s = next;
    }
    const line = zones.find((z) => z.kind === "line");
    expect(line?.owner).toBe("P2");
    expect(squaresOf(line!)).toEqual(["2,0", "2,1", "2,2", "2,3"]);
    expect(s.cards[sweeper.instanceId]?.specialCasts ?? 1).toBeGreaterThan(0);
    // Any Greegon that swung first was aiming at the one card it could: Blackice.
    for (const z of zones.filter((q) => q.kind === "target")) {
      expect(z.owner).toBe("P1");
      expect(squaresOf(z)).toEqual(["1,1"]);
    }
  });
});

describe("where anything else is aimed — the cards the step reached", () => {
  it("an AI spell lights the card it was cast at", () => {
    const s = prepState(1, "P2");
    s.players.P2.magicPool = 5;
    s.players.P2.spellbook = [{ defId: "pyro_spark", used: false }];
    const target = place(s, "leaf_greegon", "P1", 2, 3, { curHp: 9, curShields: 0 });
    const after = applyIntent(s, { type: "CAST_SPELL", player: "P2", spellId: "pyro_spark", targetId: target.instanceId });
    const z = strikeZone(s, after);
    expect(z).toMatchObject({ owner: "P2", kind: "target" });
    expect(squaresOf(z)).toEqual(["2,3"]);
    expect(spellCast(s, after)).toEqual({ spellId: "pyro_spark", seat: "P2" });
  });

  it("a battle attack lights only the opposing side — not a thorn biting the attacker", () => {
    const s = prepState(1);
    const attacker = place(s, "aqua_blackice", "P2", 1, 1);
    const victim = place(s, "leaf_greegon", "P1", 2, 1);
    s.phase = "battle";
    s.battle = { queue: [attacker.instanceId], index: 0, awaitingInput: null };
    const after = structuredClone(s);
    after.battle!.index = 1;
    after.cards[victim.instanceId].curHp -= 3;
    after.cards[attacker.instanceId].curHp -= 1; // retaliation
    expect(squaresOf(strikeZone(s, after))).toEqual(["2,1"]);
  });

  it("a dodged, statused or shoved card was still aimed at", () => {
    const s = prepState(1);
    const attacker = place(s, "aqua_blackice", "P2", 1, 1);
    const a = place(s, "leaf_greegon", "P1", 2, 0);
    const b = place(s, "leaf_greegon", "P1", 2, 2);
    const c = place(s, "leaf_greegon", "P1", 3, 3);
    s.phase = "battle";
    s.battle = { queue: [attacker.instanceId], index: 0, awaitingInput: null };
    const after = structuredClone(s);
    after.battle!.index = 1;
    after.cards[a.instanceId].fxMiss = (after.cards[a.instanceId].fxMiss ?? 0) + 1;
    after.cards[b.instanceId].statuses.push({ kind: "ROOT", duration: 2, power: 0 } as never);
    after.cards[c.instanceId].pos = { row: 3, col: 2 };
    expect(squaresOf(strikeZone(s, after))).toEqual(["2,0", "2,2", "3,3"]);
  });

  it("a card arriving and pouncing lights its prey", () => {
    const s = prepState(1);
    const prey = place(s, "leaf_greegon", "P1", 2, 2, { curHp: 9 });
    const after = structuredClone(s);
    place(after, "leaf_greegon", "P2", 0, 2);
    after.cards[prey.instanceId].curHp -= 2;
    expect(strikeZone(s, after)).toMatchObject({ owner: "P2", kind: "target" });
    expect(squaresOf(strikeZone(s, after))).toEqual(["2,2"]);
  });

  it("a spell that only helps its caster's own side aims at nothing", () => {
    const s = prepState(1, "P2");
    const own = place(s, "leaf_greegon", "P2", 1, 1, { curHp: 3 });
    const after = structuredClone(s);
    after.players.P2.spellbook = [{ defId: "pyro_spark", used: true }];
    s.players.P2.spellbook = [{ defId: "pyro_spark", used: false }];
    after.cards[own.instanceId].curHp += 3;
    expect(strikeZone(s, after)).toBeNull();
  });

  it("a splash lights nearest-first", () => {
    const s = prepState(1);
    const attacker = place(s, "aqua_blackice", "P2", 0, 0);
    const near = place(s, "leaf_greegon", "P1", 1, 0);
    const far = place(s, "leaf_greegon", "P1", 3, 3);
    s.phase = "battle";
    s.battle = { queue: [attacker.instanceId], index: 0, awaitingInput: null };
    const after = structuredClone(s);
    after.battle!.index = 1;
    after.cards[near.instanceId].curHp -= 2;
    after.cards[far.instanceId].curHp -= 2;
    const z = strikeZone(s, after)!;
    const order = Object.fromEntries(z.squares.map((q) => [`${q.row},${q.col}`, q.order]));
    expect(order).toEqual({ "1,0": 0, "3,3": 1 });
  });
});
