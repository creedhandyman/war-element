import { describe, expect, it } from "vitest";
import { advance, applyIntent } from "../phases";
import type { GameState } from "../types";
import { cardAttack, cardAttackEffects, spellEffects, type SpellFx } from "../../ui/vfx/spell-fx";
import { atBattle, place, prepState } from "./helpers";

// SHIELDS KNOCKED OFF. Shields are armour: a hit they soak changes no HP and
// floats no damage number, so on the board it looked like nothing happened.
// The step that broke them is read off the shield count, like everything else
// in spell-fx.ts, and drawn as the plate that took the blow (shield-hit.ts).

/** A battle step by `attackerId`, with `after` left for the test to shape. */
function step(s: GameState, attackerId: string) {
  s.phase = "battle";
  s.battle = { queue: [attackerId], index: 0, awaitingInput: null };
  const after = structuredClone(s);
  after.battle!.index = 1;
  return after;
}
const shieldHits = (fx: SpellFx[]) => fx.filter((f): f is Extract<SpellFx, { kind: "shieldHit" }> => f.kind === "shieldHit");
const hitOn = (fx: SpellFx[], row: number, col: number) =>
  fx.find((f): f is Extract<SpellFx, { kind: "hit" }> => f.kind === "hit" && f.at.row === row && f.at.col === col);

describe("a hit the shields soaked", () => {
  it("breaks the plate, facing the attacker, and stops the shot on it", () => {
    const s = prepState(1);
    const a = place(s, "pyro_flamehound", "P2", 0, 1);
    const t = place(s, "leaf_greegon", "P1", 3, 1, { curHp: 20, curShields: 3 });
    const after = step(s, a.instanceId);
    after.cards[t.instanceId].curShields = 2; // all of it on the shields: no HP, no number
    const fx = cardAttackEffects(s, after);
    expect(shieldHits(fx)).toEqual([
      { kind: "shieldHit", at: { row: 3, col: 1 }, element: "PYRO", had: 3, lost: 1, soaked: true, from: { row: 0, col: 1 } },
    ]);
    // Not drawn as damage: the blow lands on the plate, and the attack aims there.
    expect(hitOn(fx, 3, 1)?.soaked).toBe(true);
    expect(cardAttack(s, after)?.soaked).toEqual([true]);
  });

  it("the last shield going is the plate shattering: nothing left", () => {
    const s = prepState(1);
    const a = place(s, "pyro_flamehound", "P2", 0, 1);
    const t = place(s, "leaf_greegon", "P1", 3, 1, { curHp: 20, curShields: 1 });
    const after = step(s, a.instanceId);
    after.cards[t.instanceId].curShields = 0;
    expect(shieldHits(cardAttackEffects(s, after))[0]).toMatchObject({ had: 1, lost: 1, soaked: true });
  });

  it("one that broke through still chips the plate, but lands on the card", () => {
    const s = prepState(1);
    const a = place(s, "pyro_flamehound", "P2", 0, 1);
    const t = place(s, "leaf_greegon", "P1", 3, 1, { curHp: 20, curShields: 3 });
    const after = step(s, a.instanceId);
    const v = after.cards[t.instanceId];
    v.curShields = 2;
    v.curHp -= 2;
    v.fxDmgHits = [...(v.fxDmgHits ?? []), 2];
    v.fxDmgSeq = (v.fxDmgSeq ?? 0) + 1;
    const fx = cardAttackEffects(s, after);
    expect(shieldHits(fx)[0]).toMatchObject({ had: 3, lost: 1, soaked: false });
    expect(hitOn(fx, 3, 1)?.soaked).toBeUndefined();
    expect(cardAttack(s, after)?.soaked).toEqual([false]);
  });

  it("a card it killed, or one that became another card, has no plate to break", () => {
    const s = prepState(1);
    const a = place(s, "pyro_flamehound", "P2", 0, 1);
    const killed = place(s, "leaf_greegon", "P1", 3, 0, { curHp: 2, curShields: 1 });
    const turned = place(s, "leaf_greegon", "P1", 3, 2, { curHp: 20, curShields: 4 });
    const after = step(s, a.instanceId);
    delete after.cards[killed.instanceId];
    // A transform's new body wears other plating: fewer shields is not a hit.
    const n = after.cards[turned.instanceId];
    n.defId = "pyro_flamehound";
    n.curShields = 0;
    n.curHp -= 1;
    expect(shieldHits(cardAttackEffects(s, after))).toEqual([]);
  });

  it("the attacker's own shields lost to a thorn are the numbers' job, not a plate", () => {
    const s = prepState(1);
    const a = place(s, "pyro_flamehound", "P2", 0, 1, { curShields: 2 });
    const t = place(s, "leaf_greegon", "P1", 3, 1, { curHp: 20 });
    const after = step(s, a.instanceId);
    after.cards[t.instanceId].curHp -= 3;
    after.cards[a.instanceId].curShields = 1;
    expect(shieldHits(cardAttackEffects(s, after))).toEqual([]);
  });

  it("through the real engine: a basic into heavy plating takes one shield and no HP", () => {
    let s = prepState(3);
    place(s, "pyro_flamehound", "P2", 1, 1);
    const t = place(s, "leaf_greegon", "P1", 2, 1, { curHp: 30, maxHp: 30, curShields: 20, autoMode: "full" });
    s.players.P2.magicPool = 0; // no Special to spend on: a basic
    s = atBattle(s);
    s.players.P2.magicPool = 0;
    for (let i = 0; i < 16 && s.phase === "battle"; i++) {
      const next = advance(s);
      const act = cardAttack(s, next);
      if (act?.seat === "P2") {
        expect(next.cards[t.instanceId].curHp).toBe(30);
        expect(next.cards[t.instanceId].curShields).toBe(19);
        expect(act.soaked).toEqual([true]);
        expect(shieldHits(cardAttackEffects(s, next))).toEqual([
          { kind: "shieldHit", at: { row: 2, col: 1 }, element: "PYRO", had: 20, lost: 1, soaked: true, from: { row: 1, col: 1 } },
        ]);
        return;
      }
      s = next;
    }
    throw new Error("P2 never attacked");
  });
});

describe("a spell the shields soaked", () => {
  it("lights the whole plate — a spell has no side it came from — and is not drawn as damage", () => {
    const s = prepState(1, "P2");
    s.players.P2.magicPool = 20;
    s.players.P2.spellbook = [{ defId: "pyro_spark", used: false }];
    const t = place(s, "leaf_greegon", "P1", 1, 2, { curHp: 9, curShields: 20 });
    const after = applyIntent(s, { type: "CAST_SPELL", player: "P2", spellId: "pyro_spark", targetId: t.instanceId });
    expect(after.cards[t.instanceId].curHp).toBe(9);
    const fx = spellEffects(s, after, "P1");
    const sh = shieldHits(fx)[0];
    expect(sh).toMatchObject({ at: { row: 1, col: 2 }, element: "PYRO", had: 20, soaked: true });
    expect(sh.from).toBeUndefined();
    expect(fx.find((f) => f.kind === "impact")).toMatchObject({ soaked: true });
  });
});
