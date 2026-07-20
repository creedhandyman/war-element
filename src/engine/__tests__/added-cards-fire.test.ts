// Every ability on the cards added this pass must actually DO something when
// fired. Static checks catch a dead param or a missing handler; they cannot
// catch an ability that dispatches and then affects nothing — which is exactly
// how Storm Conduit shipped inert (talents only dispatched two handlers) and how
// Fallow's aura sat behind a crit roll it could almost never win.

import { describe, expect, it } from "vitest";
import { basicAttack } from "../combat";
import { advance, applyIntent } from "../phases";
import { effectiveDmg, effectiveSp } from "../state";
import { atCleanup, giveHand, place, prepState, statusOf } from "./helpers";
import type { GameState } from "../types";

/** Park the battle so `active` is the card awaiting P1's input. */
function battleFor(s: GameState, active: string): GameState {
  s.phase = "battle";
  s.prep = null;
  s.battle = { queue: [active], index: 0, awaitingInput: active };
  return s;
}

describe("added cards: every ability fires", () => {
  it("Piranha's Chomp bites everything in reach on arrival, with BLEED", () => {
    const s = prepState();
    s.players.P1.summonPool = 6;
    // Melee reach 1 from P1's home row, so row 2 is in range.
    const near = place(s, "dusk_gool", "P2", 2, 0, { curHp: 20, maxHp: 20, curShields: 0 });
    const far = place(s, "dusk_vamp", "P2", 0, 3, { curHp: 20, maxHp: 20 });
    const handId = giveHand(s, "P1", "aqua_piranha");
    const next = applyIntent(s, { type: "SUMMON", player: "P1", handId, col: 0 });
    expect(next.cards[near.instanceId].curHp).toBe(18); // two 1-DMG bites
    expect(statusOf(next.cards[near.instanceId], "BLEED")?.power).toBe(2);
    expect(next.cards[far.instanceId].curHp).toBe(20); // out of reach
  });

  it("Jellyfish's Storm Conduit talent lands damage AND the PARALYZE", () => {
    const s = prepState();
    s.players.P1.magicPool = 0; // a Talent is free — this must not block it
    const jelly = place(s, "bolt_jellyfish", "P1", 2, 0);
    const foe = place(s, "dusk_gool", "P2", 1, 0, { curHp: 30, maxHp: 30, curShields: 0 });
    const next = applyIntent(battleFor(s, jelly.instanceId), {
      type: "BATTLE_ACTION", player: "P1", action: "talent", targetId: foe.instanceId,
    });
    expect(next.cards[foe.instanceId].curHp).toBeLessThan(30);
    expect(statusOf(next.cards[foe.instanceId], "PARALYZE")?.duration).toBe(3);
  });

  it("Soaring Sun and Dragon's Blade actually tick their stacking buffs", () => {
    // Both ride roundTick.buffDmgEveryN, which only fires on a round divisible
    // by n — a card parked on the wrong round would look broken.
    const s = prepState();
    const eagle = place(s, "dawn_goldeneagle", "P1", 3, 0); // every 3 rounds: +1 DMG
    const sseerr = place(s, "pyro_sseerr", "P1", 3, 1); // every 2: +1 DMG, +1 SP
    place(s, "dusk_gool", "P2", 0, 0);
    const eDmg = effectiveDmg(s, s.cards[eagle.instanceId]);
    const sDmg = effectiveDmg(s, s.cards[sseerr.instanceId]);
    const sSp = effectiveSp(s, s.cards[sseerr.instanceId]);
    let g = s;
    for (let i = 0; i < 6; i++) g = advance(atCleanup(g)); // six rounds of ticks
    // 6 rounds → eagle gains on rounds divisible by 3, SSeerr on even rounds.
    expect(effectiveDmg(g, g.cards[eagle.instanceId])).toBeGreaterThan(eDmg);
    expect(effectiveDmg(g, g.cards[sseerr.instanceId])).toBeGreaterThan(sDmg);
    expect(effectiveSp(g, g.cards[sseerr.instanceId])).toBeGreaterThan(sSp);
  });

  it("Sprinu's Root Spring damages, ROOTs, and waters LEAF allies in one cast", () => {
    const s = prepState();
    s.players.P1.magicPool = 2;
    const sprinu = place(s, "leaf_sprinu", "P1", 2, 0);
    const hurtLeaf = place(s, "leaf_greegon", "P1", 2, 1, { curHp: 5, maxHp: 20 });
    const notLeaf = place(s, "bore_armadillo", "P1", 3, 0, { curHp: 5, maxHp: 20 });
    const foe = place(s, "dusk_gool", "P2", 1, 0, { curHp: 30, maxHp: 30, curShields: 0 });
    const next = applyIntent(battleFor(s, sprinu.instanceId), {
      type: "BATTLE_ACTION", player: "P1", action: "special", targetId: foe.instanceId,
    });
    expect(next.cards[foe.instanceId].curHp).toBe(24); // 3 DMG x2 bites
    expect(statusOf(next.cards[foe.instanceId], "ROOT")?.duration).toBe(2);
    expect(next.cards[hurtLeaf.instanceId].curHp).toBe(9); // +4, LEAF only
    expect(next.cards[notLeaf.instanceId].curHp).toBe(5); // BORE ally untouched
  });

  it("Wedded Wraith's Shadow Summon actually raises three Specters", () => {
    const s = prepState();
    s.players.P1.magicPool = 3;
    const wraith = place(s, "dusk_wedded_wraith", "P1", 2, 1);
    place(s, "dusk_gool", "P2", 0, 0);
    const next = applyIntent(battleFor(s, wraith.instanceId), {
      type: "BATTLE_ACTION", player: "P1", action: "special", targetId: wraith.instanceId,
    });
    const risen = Object.values(next.cards).filter((c) => c.defId === "dusk_specter_tok");
    expect(risen).toHaveLength(3);
    for (const r of risen) expect(r.owner).toBe("P1");
  });

  it("Tumbleweed's EVASION is real — a volley into it whiffs some hits", () => {
    const s = prepState();
    const weed = place(s, "gale_tumbleweed", "P1", 2, 0, { curHp: 99, maxHp: 99, curShields: 0 });
    const shooter = place(s, "dusk_gool", "P2", 1, 0);
    let dodged = 0;
    for (let i = 0; i < 40; i++) {
      const r = basicAttack(s, shooter.instanceId, weed.instanceId);
      dodged += r?.dodgedHits ?? 0;
      s.cards[weed.instanceId].curHp = 99; // keep it alive for the sample
    }
    expect(dodged).toBeGreaterThan(0); // ~50% expected; any dodge proves it's wired
  });
});
