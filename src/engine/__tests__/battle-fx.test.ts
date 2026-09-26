import { describe, expect, it } from "vitest";
import { advance, applyIntent } from "../phases";
import type { GameState } from "../types";
import { battleAction, battleEffects } from "../../ui/vfx/spell-fx";
import { atBattle, place, prepState } from "./helpers";

// A card's attack is animated from what its battle turn DID: who acted (read
// off the battle queue), with what (melee or ranged, basic or Special — the
// Special's `specialCasts` rises), and at whom (the opposing cards it reached,
// or that dodged it). These drive real battle steps through the engine.

/** Step a battle until `seat`'s card has acted, returning that step. */
function firstTurnOf(s: GameState, seat: "P1" | "P2") {
  for (let i = 0; i < 16 && s.phase === "battle"; i++) {
    const next = advance(s);
    const act = battleAction(s, next);
    if (act?.seat === seat) return { before: s, after: next, act };
    s = next;
  }
  throw new Error(`${seat} never attacked`);
}

describe("a card's battle turn, read off what it did", () => {
  it("a melee card's basic attack: melee, not a Special, aimed at the card it hit", () => {
    let s = prepState(3);
    place(s, "aqua_blackice", "P2", 1, 1);
    place(s, "leaf_greegon", "P1", 2, 1, { curHp: 30, maxHp: 30, curShields: 0, autoMode: "full" });
    s.players.P2.magicPool = 0; // no Special to spend on: it swings
    s = atBattle(s);
    s.players.P2.magicPool = 0;
    const { act } = firstTurnOf(s, "P2");
    expect(act).toMatchObject({ seat: "P2", actor: { row: 1, col: 1 }, element: "AQUA", melee: true, special: false });
    expect(act.targets).toEqual([{ row: 2, col: 1 }]);
  });

  it("a ranged card's attack is ranged", () => {
    let s = prepState(3);
    place(s, "pyro_flamehound", "P2", 1, 1);
    place(s, "leaf_greegon", "P1", 2, 1, { curHp: 30, maxHp: 30, curShields: 0, autoMode: "full" });
    s.players.P2.magicPool = 0;
    s = atBattle(s);
    s.players.P2.magicPool = 0;
    const { act } = firstTurnOf(s, "P2");
    expect(act).toMatchObject({ element: "PYRO", melee: false });
    expect(act.targets).toEqual([{ row: 2, col: 1 }]);
  });

  it("a Special is a Special: Blackice's row sweep", () => {
    let s = prepState(3);
    place(s, "aqua_blackice", "P2", 1, 1);
    for (const col of [0, 1, 2]) place(s, "leaf_greegon", "P1", 2, col, { curHp: 2, curShields: 0, autoMode: "full" });
    s.players.P2.magicPool = 20;
    s = atBattle(s);
    s.players.P2.magicPool = 20;
    for (let i = 0; i < 16 && s.phase === "battle"; i++) {
      const next = advance(s);
      const act = battleAction(s, next);
      if (act?.special) {
        expect(act.seat).toBe("P2");
        expect(act.targets.length).toBeGreaterThanOrEqual(2);
        return;
      }
      s = next;
    }
    throw new Error("the Special never fired");
  });

  it("a card that DODGED was still the target", () => {
    const s = prepState(1);
    const a = place(s, "aqua_blackice", "P2", 1, 1);
    const v = place(s, "leaf_greegon", "P1", 2, 1);
    s.phase = "battle";
    s.battle = { queue: [a.instanceId], index: 0, awaitingInput: null };
    const after = structuredClone(s);
    after.battle!.index = 1;
    after.cards[v.instanceId].fxMiss = (after.cards[v.instanceId].fxMiss ?? 0) + 1; // nothing else changed
    expect(battleAction(s, after)?.targets).toEqual([{ row: 2, col: 1 }]);
    expect(battleEffects(s, after).some((f) => f.kind === "hit")).toBe(false); // nothing to hit
  });

  it("the landing: a hit on the card struck, none for a thorn biting back", () => {
    const s = prepState(1);
    const a = place(s, "aqua_blackice", "P2", 1, 1);
    const v = place(s, "leaf_greegon", "P1", 2, 1, { curHp: 30 });
    s.phase = "battle";
    s.battle = { queue: [a.instanceId], index: 0, awaitingInput: null };
    const after = structuredClone(s);
    after.battle!.index = 1;
    after.cards[v.instanceId].curHp -= 10;
    after.cards[a.instanceId].curHp -= 2; // retaliation
    const hits = battleEffects(s, after).filter((f) => f.kind === "hit");
    expect(hits).toEqual([{
      kind: "hit", at: { row: 2, col: 1 }, from: { row: 1, col: 1 }, element: "AQUA",
      strength: expect.any(Number), melee: true, special: false,
    }]);
  });

  it("a basic hit lands lighter than the same damage from a Special", () => {
    const make = (special: boolean) => {
      const s = prepState(1);
      const a = place(s, "aqua_blackice", "P2", 1, 1);
      const v = place(s, "leaf_greegon", "P1", 2, 1, { curHp: 30 });
      s.phase = "battle";
      s.battle = { queue: [a.instanceId], index: 0, awaitingInput: null };
      const after = structuredClone(s);
      after.battle!.index = 1;
      after.cards[v.instanceId].curHp -= 10;
      if (special) after.cards[a.instanceId].specialCasts += 1;
      return (battleEffects(s, after).find((f) => f.kind === "hit") as { strength: number }).strength;
    };
    expect(make(false)).toBeLessThan(make(true));
  });

  it("a player's own attack, sent as a BATTLE_ACTION, is read the same way", () => {
    let s = prepState(3);
    const mine = place(s, "aqua_blackice", "P1", 2, 1, { autoMode: "manual" });
    const foe = place(s, "leaf_greegon", "P2", 1, 1, { curHp: 30, curShields: 0 });
    s = atBattle(s);
    while (s.phase === "battle" && s.battle?.awaitingInput !== mine.instanceId) s = advance(s);
    const after = applyIntent(s, { type: "BATTLE_ACTION", player: "P1", action: "basic", targetIds: [foe.instanceId] });
    expect(battleAction(s, after)).toMatchObject({ seat: "P1", melee: true, targets: [{ row: 1, col: 1 }] });
  });

  it("a spell, or the round's end, is not a card's attack", () => {
    const s = prepState(1, "P2");
    s.players.P2.magicPool = 5;
    s.players.P2.spellbook = [{ defId: "pyro_spark", used: false }];
    const t = place(s, "leaf_greegon", "P1", 1, 2, { curHp: 9 });
    const cast = applyIntent(s, { type: "CAST_SPELL", player: "P2", spellId: "pyro_spark", targetId: t.instanceId });
    expect(battleAction(s, cast)).toBeNull();
    expect(battleEffects(s, cast)).toEqual([]);

    let b = prepState(2);
    place(b, "leaf_greegon", "P1", 2, 0, { curHp: 9, status: { kind: "BURN", duration: 2, power: 2 } as never });
    b = atBattle(b);
    b.battle!.index = b.battle!.queue.length;
    expect(battleAction(b, advance(b))).toBeNull();
  });
});
