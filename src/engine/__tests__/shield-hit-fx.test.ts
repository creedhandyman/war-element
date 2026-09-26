import { describe, expect, it } from "vitest";
import { advance, applyIntent } from "../phases";
import type { CardInstance, GameState } from "../types";
import { cardAttack, cardAttackEffects, spellEffects, type SpellFx } from "../../ui/vfx/spell-fx";
import { atBattle, place, prepState } from "./helpers";

// SHIELDS KNOCKED OFF. Shields are armour: a hit they soak changes no HP and
// floats no damage number, so on the board it looked like nothing happened.
// The engine counts every shield a blow knocks off (`fxShieldsKnocked`), and
// the step that broke them is drawn as the plate that took the blow
// (shield-hit.ts) — only for what a blow took, never for plating that ran out
// or melted.

/** A battle step by `attackerId`, with `after` left for the test to shape. */
function step(s: GameState, attackerId: string) {
  s.phase = "battle";
  s.battle = { queue: [attackerId], index: 0, awaitingInput: null };
  const after = structuredClone(s);
  after.battle!.index = 1;
  return after;
}
/** A blow knocking `n` shields off, as the engine records it (`noteShieldFx`). */
function knock(c: CardInstance, n: number) {
  c.curShields -= n;
  c.fxShieldsKnocked = (c.fxShieldsKnocked ?? 0) + n;
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
    knock(after.cards[t.instanceId], 1); // all of it on the shields: no HP, no number
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
    knock(after.cards[t.instanceId], 1);
    expect(shieldHits(cardAttackEffects(s, after))[0]).toMatchObject({ had: 1, lost: 1, soaked: true });
  });

  it("one that broke through still chips the plate, but lands on the card", () => {
    const s = prepState(1);
    const a = place(s, "pyro_flamehound", "P2", 0, 1);
    const t = place(s, "leaf_greegon", "P1", 3, 1, { curHp: 20, curShields: 3 });
    const after = step(s, a.instanceId);
    const v = after.cards[t.instanceId];
    knock(v, 1);
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
    knock(n, 4);
    n.curHp -= 1;
    expect(shieldHits(cardAttackEffects(s, after))).toEqual([]);
  });

  it("the attacker's own shields lost to a thorn are the numbers' job, not a plate", () => {
    const s = prepState(1);
    const a = place(s, "pyro_flamehound", "P2", 0, 1, { curShields: 2 });
    const t = place(s, "leaf_greegon", "P1", 3, 1, { curHp: 20 });
    const after = step(s, a.instanceId);
    after.cards[t.instanceId].curHp -= 3;
    knock(after.cards[a.instanceId], 1);
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
        expect(next.cards[t.instanceId].fxShieldsKnocked).toBe(1);
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
    expect(after.cards[t.instanceId].fxShieldsKnocked ?? 0).toBeGreaterThan(0);
    const fx = spellEffects(s, after, "P1");
    const sh = shieldHits(fx)[0];
    expect(sh).toMatchObject({ at: { row: 1, col: 2 }, element: "PYRO", had: 20, soaked: true });
    expect(sh.from).toBeUndefined();
    expect(fx.find((f) => f.kind === "impact")).toMatchObject({ soaked: true });
  });
});

describe("only plating a blow knocked off plays it", () => {
  it("shields gone with no blow counted break no plate and stop no shot", () => {
    const s = prepState(1);
    const a = place(s, "pyro_flamehound", "P2", 0, 1);
    const t = place(s, "leaf_greegon", "P1", 3, 1, { curHp: 20, curShields: 3 });
    const after = step(s, a.instanceId);
    const v = after.cards[t.instanceId];
    v.curShields = 0; // gone — but the engine counted no blow taking them
    v.curHp -= 2;
    v.fxDmgHits = [...(v.fxDmgHits ?? []), 2];
    v.fxDmgSeq = (v.fxDmgSeq ?? 0) + 1;
    const fx = cardAttackEffects(s, after);
    expect(shieldHits(fx)).toEqual([]);
    expect(hitOn(fx, 3, 1)?.soaked).toBeUndefined();
    expect(cardAttack(s, after)?.soaked).toEqual([false]);
  });

  /** Stand the battle at its end, so the next advance() runs Cleanup. */
  const endOfRound = (s: GameState) => {
    const b = atBattle(s);
    b.battle!.index = b.battle!.queue.length;
    return b;
  };

  it("a \"for the round\" plate expiring at the round's end is not knocked off", () => {
    // Downpour's Frozen Flow, Leo's King of the Wild: plating marked
    // `tempShields`, which Cleanup takes back. Nothing hit it.
    const s = prepState(1);
    const t = place(s, "leaf_greegon", "P1", 2, 1, { curHp: 20, curShields: 3, tempShields: 3 });
    const next = advance(endOfRound(s));
    const c = next.cards[t.instanceId];
    expect(c.tempShields).toBe(0);
    expect(c.curShields).toBeLessThan(3); // it went...
    expect(c.fxShieldsKnocked ?? 0).toBe(0); // ...but no blow took it
  });

  it("BURN melting plating at the round's end is its tick's to draw, not a knock-off", () => {
    const s = prepState(1);
    const t = place(s, "leaf_greegon", "P1", 2, 1, {
      curHp: 20, maxHp: 20, curShields: 3, status: { kind: "BURN", duration: 2, power: 1, source: "PYRO" },
    });
    const next = advance(endOfRound(s));
    const c = next.cards[t.instanceId];
    expect(c.curShields).toBe(1); // melted 2...
    expect(c.fxShieldsKnocked ?? 0).toBe(0); // ...knocked off none
  });

  it("a wall crossed counts what it strips and what its blow breaks", () => {
    const s = prepState(42, "P2");
    s.walls = [
      { owner: "P1", spellId: "bore_stone_wall", element: "BORE", row: 3, dmg: 3, stripShields: 1, allyBuff: { block: 2 }, roundsLeft: 3 },
    ];
    const foe = place(s, "leaf_alpha", "P2", 2, 0, { curHp: 14, maxHp: 14, curShields: 2 });
    const next = applyIntent(s, { type: "MOVE", player: "P2", instanceId: foe.instanceId, to: { row: 3, col: 0 } });
    expect(next.cards[foe.instanceId].curShields).toBe(0);
    expect(next.cards[foe.instanceId].fxShieldsKnocked).toBe(2);
  });

  it("Shell Cracker counts the plating it cracks off on top of the hit's", () => {
    let s = prepState(3);
    place(s, "pyro_firecrack", "P2", 1, 1, { curHp: 40, maxHp: 40 });
    const t = place(s, "leaf_greegon", "P1", 2, 1, { curHp: 60, maxHp: 60, curShields: 20, autoMode: "full" });
    s.players.P2.magicPool = 0;
    s = atBattle(s);
    s.players.P2.magicPool = 0;
    for (let i = 0; i < 16 && s.phase === "battle"; i++) {
      const next = advance(s);
      const was = s.cards[t.instanceId], now = next.cards[t.instanceId];
      if (cardAttack(s, next)?.seat === "P2" && now.curShields < was.curShields) {
        const knocked = (now.fxShieldsKnocked ?? 0) - (was.fxShieldsKnocked ?? 0);
        expect(knocked).toBe(was.curShields - now.curShields);
        expect(knocked).toBeGreaterThan(1); // the hit's plate AND the cracked ones
        return;
      }
      s = next;
    }
    throw new Error("Firecrack never cracked the plating");
  });
});
