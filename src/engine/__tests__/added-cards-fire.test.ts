// Every ability on the cards added this pass must actually DO something when
// fired. Static checks catch a dead param or a missing handler; they cannot
// catch an ability that dispatches and then affects nothing — which is exactly
// how Storm Conduit shipped inert (talents only dispatched two handlers) and how
// Fallow's aura sat behind a crit roll it could almost never win.

import { describe, expect, it } from "vitest";
import { applyStatus, basicAttack } from "../combat";
import { advance, applyIntent } from "../phases";
import { boardCards, effectiveDmg, effectiveSp } from "../state";
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
    expect(next.cards[foe.instanceId].curHp).toBe(28); // 2 DMG (cut from 3x2 — see the card)
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

  it("Star's Raising Star blinds the board once, not every round", () => {
    const s = prepState();
    place(s, "dawn_star", "P1", 3, 0);
    const foe = place(s, "dusk_gool", "P2", 0, 0, { curHp: 40, maxHp: 40 });
    // First Cleanup: it fires.
    let g = advance(atCleanup(s));
    expect(statusOf(g.cards[foe.instanceId], "BLIND")?.duration).toBe(1);
    // Second: BLIND ticks off and is NOT reapplied. Before firstRoundOnly this
    // renewed every round, so the enemy board never saw a clear turn.
    g = advance(atCleanup(g));
    expect(statusOf(g.cards[foe.instanceId], "BLIND")).toBeUndefined();
    g = advance(atCleanup(g));
    expect(statusOf(g.cards[foe.instanceId], "BLIND")).toBeUndefined();
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

describe("wave 1: RohoJohn, Shoksa, Lumberjack, Bootlegger", () => {
  it("RohoJohn's War Mount arrives armoured and mauls at melee range", () => {
    const s = prepState();
    s.players.P1.summonPool = 9;
    const near = place(s, "dusk_gool", "P2", 2, 0, { curHp: 60, maxHp: 60, curShields: 0 });
    const handId = giveHand(s, "P1", "bore_rohojohn");
    const next = applyIntent(s, { type: "SUMMON", player: "P1", handId, col: 0 });
    const roho = boardCards(next, "P1").find((c) => c.defId === "bore_rohojohn")!;
    expect(roho.curShields).toBe(7); // War Mount +5, plus BORE's Exostone aura +2
    basicAttack(next, roho.instanceId, near.instanceId);
    // 7 printed + 6 War Mount, because the target is adjacent.
    expect(60 - next.cards[near.instanceId].curHp).toBe(13);
  });

  it("...but the mount bonus needs the target BESIDE it, not just in range", () => {
    const s = prepState();
    const roho = place(s, "bore_rohojohn", "P1", 3, 0, { autoMode: "manual" });
    const far = place(s, "dusk_gool", "P2", 1, 0, { curHp: 60, maxHp: 60, curShields: 0 });
    basicAttack(s, roho.instanceId, far.instanceId);
    expect(60 - s.cards[far.instanceId].curHp).toBe(7); // printed only
  });

  it("Cougar Pounce lands 10 and puts the target to SLEEP", () => {
    const s = prepState();
    s.players.P1.magicPool = 6;
    const roho = place(s, "bore_rohojohn", "P1", 2, 1, { autoMode: "manual" });
    const prey = place(s, "dusk_gool", "P2", 1, 1, { curHp: 60, maxHp: 60, curShields: 0 });
    const next = applyIntent(battleFor(s, roho.instanceId), {
      type: "BATTLE_ACTION", player: "P1", action: "special", targetId: prey.instanceId,
    });
    expect(60 - next.cards[prey.instanceId].curHp).toBe(10);
    expect(statusOf(next.cards[prey.instanceId], "SLEEP")?.duration).toBe(2);
  });

  it("Shoksa fires its Special on summon: marks the clean, deepens the held", () => {
    const s = prepState();
    s.players.P1.summonPool = 9;
    const held = place(s, "dusk_gool", "P2", 2, 0, { curHp: 60, maxHp: 60 });
    const clean = place(s, "dusk_vamp", "P2", 2, 1, { curHp: 60, maxHp: 60 });
    applyStatus(s, held, "PARALYZE", 1, 0, "BOLT");
    const handId = giveHand(s, "P1", "bolt_shoksa");
    const next = applyIntent(s, { type: "SUMMON", player: "P1", handId, col: 0 });
    expect(statusOf(next.cards[held.instanceId], "PARALYZE")?.duration).toBe(2); // 1 -> 2
    expect(statusOf(next.cards[clean.instanceId], "ELECTRIFIED")).toBeDefined();
    expect(statusOf(next.cards[clean.instanceId], "PARALYZE")).toBeUndefined();
  });

  it("Shoksa discharges into what it marked at end of round", () => {
    const s = prepState();
    const shoksa = place(s, "bolt_shoksa", "P1", 2, 1, { autoMode: "manual" });
    const marked = place(s, "dusk_gool", "P2", 1, 1, { curHp: 60, maxHp: 60, curShields: 0 });
    const clean = place(s, "dusk_vamp", "P2", 1, 0, { curHp: 60, maxHp: 60, curShields: 0 });
    applyStatus(s, marked, "ELECTRIFIED", 3, 0, "BOLT");
    void shoksa;
    const next = advance(atCleanup(s));
    expect(60 - next.cards[marked.instanceId].curHp).toBe(2);
    expect(next.cards[clean.instanceId].curHp).toBe(60); // unmarked, untouched
  });

  it("Lumberjack fells the row AHEAD only, ROOTs the first, and braces", () => {
    const s = prepState();
    s.players.P1.magicPool = 6;
    const jack = place(s, "leaf_lumberjack", "P1", 2, 1, { autoMode: "manual", curShields: 0 });
    const a = place(s, "dusk_gool", "P2", 1, 0, { curHp: 60, maxHp: 60, curShields: 9 });
    const b = place(s, "dusk_vamp", "P2", 1, 1, { curHp: 60, maxHp: 60, curShields: 9 });
    const behind = place(s, "dusk_crow", "P2", 0, 1, { curHp: 60, maxHp: 60, curShields: 0 });
    const next = applyIntent(battleFor(s, jack.instanceId), {
      type: "BATTLE_ACTION", player: "P1", action: "special", targetId: a.instanceId,
    });
    // PEN: the 9 shields do not stop it.
    expect(60 - next.cards[a.instanceId].curHp).toBe(4);
    expect(60 - next.cards[b.instanceId].curHp).toBe(4);
    expect(next.cards[behind.instanceId].curHp).toBe(60); // a row further back — untouched
    // ROOT lands on exactly one of the two.
    const rooted = [a, b].filter((t) => statusOf(next.cards[t.instanceId], "ROOT"));
    expect(rooted).toHaveLength(1);
    expect(next.cards[jack.instanceId].curShields).toBe(3);
  });

  it("Bootlegger stomps on the crossing into enemy ground — once", () => {
    const s = prepState();
    s.prep = { priority: "P1", consecutivePasses: 0, movedThisTurn: false };
    const boot = place(s, "aqua_bootlegger", "P1", 2, 0); // own half (P1 home = 3)
    const foe = place(s, "dusk_gool", "P2", 0, 0, { curHp: 60, maxHp: 60, curShields: 0 });
    let n = applyIntent(s, { type: "MOVE", player: "P1", instanceId: boot.instanceId, to: { row: 1, col: 0 } });
    expect(60 - n.cards[foe.instanceId].curHp).toBe(1); // crossed → stomped
    // Shuffling around once already there must NOT stomp again.
    n.prep = { priority: "P1", consecutivePasses: 0, movedThisTurn: false };
    n = applyIntent(n, { type: "MOVE", player: "P1", instanceId: boot.instanceId, to: { row: 1, col: 1 } });
    expect(60 - n.cards[foe.instanceId].curHp).toBe(1); // still 1
  });
});
