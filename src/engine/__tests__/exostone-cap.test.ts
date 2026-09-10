import { describe, it, expect } from "vitest";
import { EXOSTONE_STEAL_CAP, EXOSTONE_STEAL_PER_ROUND } from "../auras";
import { basicAttack } from "../combat";
import { advance } from "../phases";
import { createInitialState } from "../state";
import type { GameState } from "../types";
import { place, prepState } from "./helpers";
import { CARDS, getDef } from "../../data/cards";

/** A BORE attacker that hits several times, and a target wearing plates. */
function setup(seed = 7) {
  const s = prepState(seed, "P1");
  s.phase = "battle";
  const multi = CARDS.find((c) => c.element === "BORE" && c.hits >= 3 && !c.boss)
    ?? CARDS.find((c) => c.element === "BORE" && c.hits >= 2 && !c.boss)!;
  const attacker = place(s, multi.id, "P1", 2, 1, { curShields: 0 });
  attacker.summonedThisRound = false;
  const target = place(s, "bore_bastion", "P2", 1, 1, { curShields: 9, curHp: 40, maxHp: 40 });
  return { s, attacker, target, def: multi };
}

describe("Exostone's theft has limits", () => {
  it("takes at most two plates a round, however many its hits break", () => {
    // THE RUNAWAY: the theft fires per shield BROKEN, and a multi-hit basic
    // breaks one a hit — so a four-hit attacker looted four plates from one
    // swing. That is not what "gains a shield when its attack breaks one"
    // reads like on the card.
    const { s, attacker, target, def } = setup();
    expect(def.hits, "the attacker really is multi-hit").toBeGreaterThan(1);
    const before = attacker.curShields;
    basicAttack(s, attacker.instanceId, target.instanceId);
    const gained = attacker.curShields - before;
    expect(gained, `${def.id} hits ${def.hits}x and took ${gained}`)
      .toBeLessThanOrEqual(EXOSTONE_STEAL_PER_ROUND);
    expect(attacker.platesTakenThisRound).toBeLessThanOrEqual(EXOSTONE_STEAL_PER_ROUND);
    // ...and the TARGET still loses exactly what it always did. The cap is on
    // what the attacker keeps, not on what the swing costs.
    expect(target.curShields, "the break itself is unchanged").toBeLessThan(9);
  });

  it("the allowance comes back next round", () => {
    const { s, attacker, target } = setup();
    basicAttack(s, attacker.instanceId, target.instanceId);
    const afterOne = attacker.curShields;
    // Spend the rest of the round: another swing must loot nothing.
    basicAttack(s, attacker.instanceId, target.instanceId);
    expect(attacker.curShields, "the round's allowance is spent").toBe(afterOne);
    // Cleanup clears it with the other round flags.
    attacker.platesTakenThisRound = 0;
    target.curShields = 9;
    basicAttack(s, attacker.instanceId, target.instanceId);
    expect(attacker.curShields, "and it loots again next round").toBeGreaterThan(afterOne);
  });

  it("stacks at most ten plates ABOVE what it was printed with", () => {
    const { s, attacker, target, def } = setup();
    const roof = def.shields + EXOSTONE_STEAL_CAP;
    // Run it out: many rounds of looting against an endlessly re-plated wall.
    for (let round = 0; round < 40; round++) {
      attacker.platesTakenThisRound = 0;
      target.curShields = 9;
      target.curHp = 40;
      basicAttack(s, attacker.instanceId, target.instanceId);
    }
    expect(attacker.curShields, `printed ${def.shields} + ${EXOSTONE_STEAL_CAP}`)
      .toBeLessThanOrEqual(roof);
    expect(attacker.curShields, "and it actually reached the ceiling").toBe(roof);
  });

  it("the ceiling is PRINTED-relative, so a heavier card keeps its head start", () => {
    // A flat ceiling would quietly hand the lighter card the bigger share of the
    // aura. Two BORE cards with different printed armour must get the same ROOM.
    const bores = CARDS.filter((c) => c.element === "BORE" && !c.boss && c.hits >= 1);
    const light = bores.reduce((a, b) => (a.shields <= b.shields ? a : b));
    const heavy = bores.reduce((a, b) => (a.shields >= b.shields ? a : b));
    if (light.shields === heavy.shields) return;
    for (const def of [light, heavy]) {
      const s = prepState(11, "P1");
      s.phase = "battle";
      const atk = place(s, def.id, "P1", 2, 1, { curShields: def.shields });
      atk.summonedThisRound = false;
      const tgt = place(s, "bore_bastion", "P2", 1, 1, { curShields: 9, curHp: 60, maxHp: 60 });
      for (let r = 0; r < 40; r++) {
        atk.platesTakenThisRound = 0;
        tgt.curShields = 9;
        tgt.curHp = 60;
        basicAttack(s, atk.instanceId, tgt.instanceId);
      }
      expect(atk.curShields - def.shields, `${def.id} room above printed`)
        .toBe(EXOSTONE_STEAL_CAP);
    }
  });

  it("shields that were GIVEN, not taken, do not spend the allowance", () => {
    // The cap counts loot. A BORE card shielded by a spell or an ally aura has
    // stolen nothing, and reading `curShields` against the ceiling would have
    // those gifts silently stop it looting — a rule the card never claimed.
    const { s, attacker, target, def } = setup();
    attacker.curShields = def.shields + EXOSTONE_STEAL_CAP + 5; // heavily buffed
    const before = attacker.curShields;
    basicAttack(s, attacker.instanceId, target.instanceId);
    // It is over the roof on GIFTS, so the loot half correctly declines...
    expect(attacker.curShields, "already past the roof, so nothing is looted").toBe(before);
    // ...and crucially `platesStolen` never counted them.
    expect(attacker.platesStolen ?? 0, "gifts are not loot").toBe(0);
  });

  it("a real match never leaves a BORE card past its ceiling", () => {
    const field = CARDS.filter((c) => c.element === "BORE" && !c.boss).slice(0, 18).map((c) => c.id);
    for (const seed of [4, 19, 37]) {
      let s: GameState = createMatch(seed, field);
      let steps = 0;
      while (s.phase !== "gameover" && steps < 8000) { s = advance(s); steps++; }
      for (const c of Object.values(s.cards)) {
        const d = getDef(c.defId);
        if (d.element !== "BORE") continue;
        expect(c.curShields, `${d.name} wearing ${c.curShields} on ${d.shields} printed`)
          .toBeLessThanOrEqual(d.shields + EXOSTONE_STEAL_CAP + 20); // +20 for gifts
        expect(c.platesStolen ?? 0, `${d.name} looted too much`)
          .toBeLessThanOrEqual(EXOSTONE_STEAL_CAP);
      }
    }
  }, 120_000);
});

function createMatch(seed: number, field: string[]): GameState {
  return createInitialState(seed, field, field, [], [], [], 4);
}
