import { describe, expect, it } from "vitest";
import { advance, applyIntent } from "../phases";
import type { GameState } from "../types";
import { cardAttack, cardAttackEffects } from "../../ui/vfx/spell-fx";
import { atBattle, giveHand, place, prepState } from "./helpers";

// A card's attack is animated from what its battle turn DID: who acted (read
// off the battle queue), with what (melee or ranged, basic or Special — the
// Special's `specialCasts` rises), and at whom (the opposing cards it reached,
// or that dodged it). These drive real battle steps through the engine.

/** Step a battle until `seat`'s card has acted, returning that step. */
function firstTurnOf(s: GameState, seat: "P1" | "P2") {
  for (let i = 0; i < 16 && s.phase === "battle"; i++) {
    const next = advance(s);
    const act = cardAttack(s, next);
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
      const act = cardAttack(s, next);
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
    expect(cardAttack(s, after)?.targets).toEqual([{ row: 2, col: 1 }]);
    expect(cardAttackEffects(s, after).some((f) => f.kind === "hit")).toBe(false); // nothing to hit
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
    const hits = cardAttackEffects(s, after).filter((f) => f.kind === "hit");
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
      return (cardAttackEffects(s, after).find((f) => f.kind === "hit") as { strength: number }).strength;
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
    expect(cardAttack(s, after)).toMatchObject({ seat: "P1", melee: true, targets: [{ row: 1, col: 1 }] });
  });

  it("a spell, or the round's end, is not a card's attack", () => {
    const s = prepState(1, "P2");
    s.players.P2.magicPool = 5;
    s.players.P2.spellbook = [{ defId: "pyro_spark", used: false }];
    const t = place(s, "leaf_greegon", "P1", 1, 2, { curHp: 9 });
    const cast = applyIntent(s, { type: "CAST_SPELL", player: "P2", spellId: "pyro_spark", targetId: t.instanceId });
    expect(cardAttack(s, cast)).toBeNull();
    expect(cardAttackEffects(s, cast)).toEqual([]);

    let b = prepState(2);
    place(b, "leaf_greegon", "P1", 2, 0, { curHp: 9, status: { kind: "BURN", duration: 2, power: 2 } as never });
    b = atBattle(b);
    b.battle!.index = b.battle!.queue.length;
    expect(cardAttack(b, advance(b))).toBeNull();
  });
});

describe("a card striking as it is summoned", () => {
  /** P1 summons `defId` into its Home row, column `col`, with gold to spare. */
  function summon(defId: string, col: number, setup: (s: GameState) => void) {
    const s = prepState(1, "P1");
    s.players.P1.gold = 20;
    setup(s);
    const handId = giveHand(s, "P1", defId);
    const after = applyIntent(s, { type: "SUMMON", player: "P1", handId, col });
    return { s, after };
  }

  it("Piranha's bite on arrival is an attack FROM its landing square, at the two nearest", () => {
    const { s, after } = summon("aqua_piranha", 1, (st) => {
      place(st, "leaf_greegon", "P2", 2, 1, { curHp: 30, maxHp: 30 });
      place(st, "leaf_greegon", "P2", 1, 2, { curHp: 30, maxHp: 30 });
      place(st, "leaf_greegon", "P2", 0, 3, { curHp: 30, maxHp: 30 }); // the far one
    });
    const act = cardAttack(s, after)!;
    expect(act).toMatchObject({ seat: "P1", actor: { row: 3, col: 1 }, element: "AQUA", melee: true, arriving: true, special: true });
    expect(act.targets.map((t) => `${t.row},${t.col}`).sort()).toEqual(["1,2", "2,1"]);
  });

  it("DAWN's Awakening strikes as the card lands — at basic weight, not a designed entrance", () => {
    const { s, after } = summon("dawn_quasar", 0, (st) => {
      place(st, "leaf_greegon", "P2", 2, 0, { curHp: 30, maxHp: 30 });
    });
    const act = cardAttack(s, after);
    expect(act).toMatchObject({ arriving: true, special: false, element: "DAWN", targets: [{ row: 2, col: 0 }] });
  });

  it("it materialises on its square as its hits land", () => {
    const { s, after } = summon("aqua_piranha", 1, (st) => {
      place(st, "leaf_greegon", "P2", 2, 1, { curHp: 30, maxHp: 30 });
    });
    const fx = cardAttackEffects(s, after);
    expect(fx[0]).toEqual({ kind: "arrive", at: { row: 3, col: 1 }, element: "AQUA" });
    expect(fx.filter((f) => f.kind === "hit").map((f) => ("at" in f ? `${f.at.row},${f.at.col}` : ""))).toEqual(["2,1"]);
  });

  it("a summon that strikes nothing is not an attack, and does not materialise", () => {
    const { s, after } = summon("leaf_greegon", 1, () => {});
    expect(cardAttack(s, after)).toBeNull();
    expect(cardAttackEffects(s, after).some((f) => f.kind === "arrive")).toBe(false);
  });
});
