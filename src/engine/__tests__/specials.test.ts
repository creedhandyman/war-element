// Milestone 7: specials registry, pool spend, summon-turn lockout, statuses.

import { describe, expect, it } from "vitest";
import { applyIntent } from "../phases";
import { applyStatus, basicAttack } from "../combat";
import { canBasicAttack, canFireSpecial, isActionBlocked } from "../rules";
import { effectiveDmg, effectiveSp } from "../state";
import { atCleanup, giveHand, place, prepState, seedForCoins } from "./helpers";
import { advance } from "../phases";
import type { GameState } from "../types";

/** Park the battle so `active` is the next card to act, awaiting P1 input. */
function battleWith(s: GameState, activeId: string): GameState {
  s.phase = "battle";
  s.prep = null;
  s.battle = { queue: [activeId], index: 0, awaitingInput: activeId };
  return s;
}

describe("firing specials", () => {
  it("strike: damage + status + self-heal, and the pool is spent", () => {
    const s = prepState();
    s.players.P1.magicPool = 5;
    const a = place(s, "leaf_sumerose", "P1", 2, 0, { curHp: 8, maxHp: 13 }); // Siphoning Slash cost 3
    const t = place(s, "bore_armadillo", "P2", 1, 0, { curHp: 15, curShields: 4 });
    const next = applyIntent(battleWith(s, a.instanceId), {
      type: "BATTLE_ACTION",
      player: "P1",
      action: "special",
      targetId: t.instanceId,
    });
    // 5 dmg PEN − BLOCK 2 = 3 straight to HP; shields untouched; BLEED 3 applied
    const target = next.cards[t.instanceId];
    expect(target.curHp).toBe(12);
    expect(target.curShields).toBe(4);
    expect(target.statuses[0]?.kind).toBe("BLEED");
    expect(next.cards[a.instanceId].curHp).toBe(11); // healed 3
    expect(next.players.P1.magicPool).toBe(2);
  });

  it("barrage: hits every target (Leaf Storm = 3×1 to all)", () => {
    const s = prepState();
    s.players.P1.magicPool = 5;
    const a = place(s, "leaf_fallona", "P1", 2, 0); // Leaf Storm: 1 dmg × 3, all targets
    const t1 = place(s, "dusk_gool", "P2", 1, 0, { curHp: 13 });
    const t2 = place(s, "dusk_ghastly", "P2", 1, 1, { curHp: 19 });
    const t3 = place(s, "bore_smith", "P2", 1, 2, { curHp: 11, curShields: 0 });
    const next = applyIntent(battleWith(s, a.instanceId), {
      type: "BATTLE_ACTION",
      player: "P1",
      action: "special",
      targetId: t1.instanceId,
    });
    expect(next.cards[t1.instanceId].curHp).toBe(10); // 13 − 3
    expect(next.cards[t2.instanceId].curHp).toBe(16); // 19 − 3
    expect(next.cards[t3.instanceId].curHp).toBe(8); // 11 − 3
  });

  it("barrage multi-selection: strikes exactly the picked targets, stacking repeats", () => {
    const s = prepState();
    s.players.P1.magicPool = 5;
    const sol = place(s, "pyro_sol", "P1", 2, 0); // Pyro Ball Barrage: 3 dmg, up to 4 targets
    const t1 = place(s, "dusk_gool", "P2", 1, 0, { curHp: 13 });
    const t2 = place(s, "dusk_ghastly", "P2", 1, 1, { curHp: 19 });
    place(s, "bore_smith", "P2", 1, 2, { curHp: 11 }); // NOT picked — must be untouched
    const next = applyIntent(battleWith(s, sol.instanceId), {
      type: "BATTLE_ACTION",
      player: "P1",
      action: "special",
      targetIds: [t1.instanceId, t1.instanceId, t1.instanceId, t2.instanceId], // stack 3 on t1
    });
    expect(next.cards[t1.instanceId].curHp).toBe(4); // 3 strikes × 3
    expect(next.cards[t2.instanceId].curHp).toBe(16); // 1 strike
    expect(next.cards[sol.instanceId]).toBeTruthy();
    expect(next.log.filter((l) => l.includes("Smith")).length).toBe(0);
  });

  it("barrage rejects more picks than the special allows", () => {
    const s = prepState();
    s.players.P1.magicPool = 5;
    const sol = place(s, "pyro_sol", "P1", 2, 0); // Pyro Ball Barrage: up to 4 targets
    const t = place(s, "dusk_gool", "P2", 1, 0, { curHp: 13 });
    expect(() =>
      applyIntent(battleWith(s, sol.instanceId), {
        type: "BATTLE_ACTION",
        player: "P1",
        action: "special",
        targetIds: [t.instanceId, t.instanceId, t.instanceId, t.instanceId, t.instanceId],
      }),
    ).toThrow(/Too many targets/);
  });

  it("multi-hit basic can split hits across targets (and still gate per target)", () => {
    const s = prepState();
    // home row: printed damage (a mid-row attacker would get the +1 hill bonus)
    const krysteel = place(s, "bore_krysteel", "P1", 3, 0, { autoMode: "manual" }); // 3 dmg × 3, CRIT
    const t1 = place(s, "dusk_gool", "P2", 1, 0, { curHp: 13 });
    const t2 = place(s, "dusk_ghastly", "P2", 1, 1, { curHp: 19, curShields: 1 });
    s.rngState = seedForCoins(false, false, false); // no CRITs muddying the math
    const next = applyIntent(battleWith(s, krysteel.instanceId), {
      type: "BATTLE_ACTION",
      player: "P1",
      action: "basic",
      targetIds: [t1.instanceId, t1.instanceId, t2.instanceId], // 2 hits + 1 hit
    });
    expect(next.cards[t1.instanceId].curHp).toBe(7); // 13 − 3 − 3
    // t2: 3 − 1 shield = 2 to HP, shield stripped
    expect(next.cards[t2.instanceId].curHp).toBe(17);
    expect(next.cards[t2.instanceId].curShields).toBe(0);
  });

  it("basic rejects more picks than the card has hits", () => {
    const s = prepState();
    const single = place(s, "leaf_greegon", "P1", 2, 0); // 1 hit
    const t = place(s, "dusk_gool", "P2", 1, 0);
    expect(() =>
      applyIntent(battleWith(s, single.instanceId), {
        type: "BATTLE_ACTION",
        player: "P1",
        action: "basic",
        targetIds: [t.instanceId, t.instanceId],
      }),
    ).toThrow(/Too many targets/);
  });

  it("a single pick still takes the full volley (AI / one-click path)", () => {
    const s = prepState();
    const sol = place(s, "pyro_sol", "P1", 3, 0); // 3 dmg × 2 hits, home row (no hill bonus)
    const t = place(s, "dusk_gool", "P2", 1, 0, { curHp: 13 });
    const next = applyIntent(battleWith(s, sol.instanceId), {
      type: "BATTLE_ACTION",
      player: "P1",
      action: "basic",
      targetId: t.instanceId,
    });
    expect(next.cards[t.instanceId].curHp).toBe(7); // both hits landed on it
  });

  it("statusNova: SLEEPs up to 2 targets; sleepers skip their turns", () => {
    const s = prepState();
    s.players.P2.magicPool = 9;
    const sandman = place(s, "bore_sandman", "P2", 1, 0); // Nightmare cost 4
    const v1 = place(s, "leaf_alpha", "P1", 2, 0);
    const v2 = place(s, "leaf_greegon", "P1", 2, 1);
    s.phase = "battle";
    s.battle = { queue: [sandman.instanceId, v1.instanceId], index: 0, awaitingInput: null };
    let next = advance(s); // AI acts: Nightmare is its best opener vs 2 fresh targets
    expect(next.cards[v1.instanceId].statuses[0]?.kind).toBe("SLEEP");
    expect(next.cards[v2.instanceId].statuses[0]?.kind).toBe("SLEEP");
    // the sleeper's turn: full skip, no wake coin — SLEEP persists
    next = advance(next);
    expect(next.battle?.index).toBe(2);
    expect(next.cards[v1.instanceId].statuses[0]?.kind).toBe("SLEEP");
  });

  it("any hit jolts a sleeper awake (SLEEP removed)", () => {
    const s = prepState();
    const sleeper = place(s, "leaf_greegon", "P1", 2, 0, {
      curHp: 17,
      status: { kind: "SLEEP", duration: 2, power: 0, source: "BORE" },
    });
    const striker = place(s, "dusk_vamp", "P2", 1, 0);
    s.phase = "battle";
    s.battle = { queue: [striker.instanceId], index: 0, awaitingInput: null };
    const next = advance(s); // vamp attacks the sleeping Greegon
    expect(next.cards[sleeper.instanceId].curHp).toBeLessThan(17);
    expect(next.cards[sleeper.instanceId].statuses).toHaveLength(0);
    expect(next.log.some((l) => l.includes("jolted awake"))).toBe(true);
  });

  it("drainMax: Haunt permanently steals max HP and gains shields", () => {
    const s = prepState();
    s.players.P2.magicPool = 4;
    const haunt = place(s, "dusk_haunt", "P2", 1, 0); // Jacked: drain 5, +3 shields
    const fat = place(s, "leaf_greegon", "P1", 2, 0, { curHp: 15, maxHp: 17 });
    place(s, "leaf_nettle", "P1", 2, 1, { curHp: 7, maxHp: 7 }); // skinnier bystander
    s.phase = "battle";
    s.battle = { queue: [haunt.instanceId], index: 0, awaitingInput: null };
    const next = advance(s); // the AI drains the highest-max-HP target
    const target = next.cards[fat.instanceId];
    expect(target.maxHp).toBe(12);
    expect(target.curHp).toBe(12); // clamped down to the new max
    expect(next.cards[haunt.instanceId].maxHp).toBe(18); // 13 + 5 stolen
    expect(next.cards[haunt.instanceId].curShields).toBe(3);
    expect(next.players.P2.magicPool).toBe(2);
  });

  it("onSummon ally buff: Smith reinforces the row directly ahead on summon", () => {
    const s = prepState();
    s.players.P1.summonPool = 5;
    const ally = place(s, "leaf_greegon", "P1", 2, 0, { curShields: 0 }); // row ahead
    const handId = giveHand(s, "P1", "bore_smith");
    const next = applyIntent(s, { type: "SUMMON", player: "P1", handId, col: 0 });
    // Reforged fires on summon and shields allies in the row ahead (Greegon).
    expect(next.cards[ally.instanceId].curShields).toBe(2);
  });
});

describe("ranged specials on melee cards", () => {
  it("WolfBane's Whirlwind Slasher (melee Warrior) hits a far target his basic can't", () => {
    const s = prepState();
    s.players.P1.magicPool = 5;
    const wolf = place(s, "gale_wolfbane", "P1", 2, 0); // Melee, ranged AOE special
    const near = place(s, "dusk_gool", "P2", 1, 0, { curHp: 13 }); // melee-reachable
    const far = place(s, "dusk_vamp", "P2", 1, 3, { curHp: 6 }); // 3 cols away — melee can't reach
    const next = applyIntent(battleWith(s, wolf.instanceId), {
      type: "BATTLE_ACTION",
      player: "P1",
      action: "special",
      targetIds: [near.instanceId, far.instanceId],
    });
    expect(next.cards[near.instanceId].curHp).toBe(8); // 13 − 5
    expect(next.cards[far.instanceId].curHp).toBe(1); // 6 − 5, reached despite distance
  });

  it("ThunderCat's Claw Surge reaches at range, then charges the caster forward", () => {
    const s = prepState();
    s.players.P1.magicPool = 5;
    const tc = place(s, "bolt_thundercat", "P1", 3, 0); // melee, ranged charge-2 special
    const far = place(s, "dusk_gool", "P2", 1, 3, { curHp: 13 }); // far + off-column
    expect(canBasicAttack(s, tc.instanceId)).toBe(false); // melee can't reach it
    const next = applyIntent(battleWith(s, tc.instanceId), {
      type: "BATTLE_ACTION",
      player: "P1",
      action: "special",
      targetIds: [far.instanceId],
    });
    expect(next.cards[far.instanceId].curHp).toBe(5); // 13 − 8 (reached via ranged)
    expect(next.cards[tc.instanceId].pos).toEqual({ row: 1, col: 0 }); // charged 2 forward
  });

  it("BlackBeard's Vapor Shark Cannon reaches a far target his melee basic can't", () => {
    const s = prepState();
    s.players.P1.magicPool = 6;
    const bb = place(s, "aqua_blackbeard", "P1", 2, 0); // Melee Warrior, ranged special
    const far = place(s, "dusk_gool", "P2", 0, 3, { curHp: 13, curShields: 0 }); // enemy mid... row 0 col 3
    // (row 0 = P2 home, but BlackBeard in a Mid row can target the enemy home)
    expect(canBasicAttack(s, bb.instanceId)).toBe(false); // melee can't reach it
    expect(canFireSpecial(s, bb.instanceId).ok).toBe(true); // ranged special can
    const next = applyIntent(battleWith(s, bb.instanceId), {
      type: "BATTLE_ACTION",
      player: "P1",
      action: "special",
      targetIds: [far.instanceId],
    });
    expect(next.cards[far.instanceId].curHp).toBe(8); // 13 − 5
    expect(next.cards[far.instanceId].statuses[0]?.kind).toBe("SCALD");
  });
});

describe("card-text audit fixes", () => {
  it("Krysteel's Krystal Rain CRITs every unshielded target (barrage crit)", () => {
    const s = prepState();
    s.players.P1.magicPool = 5;
    s.rngState = seedForCoins(true, true, true); // all crits land
    const krysteel = place(s, "bore_krysteel", "P1", 2, 0); // 3 dmg CRIT, all targets
    const t1 = place(s, "dusk_gool", "P2", 1, 0, { curHp: 13, curShields: 0 });
    const t2 = place(s, "dusk_vamp", "P2", 1, 1, { curHp: 13, curShields: 0 });
    const next = applyIntent(battleWith(s, krysteel.instanceId), {
      type: "BATTLE_ACTION",
      player: "P1",
      action: "special",
    });
    expect(next.cards[t1.instanceId].curHp).toBe(7); // 3 → doubled to 6
    expect(next.cards[t2.instanceId].curHp).toBe(7);
  });

  it("Gool's Spook FRIGHTENs on a basic hit (passive rider, no Special)", () => {
    const s = prepState();
    const gool = place(s, "dusk_gool", "P1", 2, 0);
    const foe = place(s, "bore_smith", "P2", 1, 1, { curHp: 11 }); // beside → gets pushed back
    basicAttack(s, gool.instanceId, foe.instanceId);
    expect(foe.statuses.some((x) => x.kind === "FRIGHTEN")).toBe(true);
  });
});

describe("GALE / BOLT lockdown & disruption", () => {
  it("Klipso's Tranq Feather Blade STUNs (full skip) the target", () => {
    const s = prepState();
    s.players.P1.magicPool = 5;
    const klipso = place(s, "gale_klipso", "P1", 2, 0);
    const foe = place(s, "dusk_gool", "P2", 1, 0, { curHp: 13, curShields: 4 });
    const next = applyIntent(battleWith(s, klipso.instanceId), {
      type: "BATTLE_ACTION",
      player: "P1",
      action: "special",
    });
    expect(next.cards[foe.instanceId].curHp).toBe(3); // 10 PEN ignores shields
    expect(next.cards[foe.instanceId].curShields).toBe(4);
    expect(isActionBlocked(next.cards[foe.instanceId])).toBe(true); // STUN = can't act
  });

  it("Guan's Vision of Fear WEAKENs every reachable opponent", () => {
    const s = prepState();
    s.players.P1.magicPool = 5;
    const guan = place(s, "gale_guan", "P1", 2, 0);
    const f1 = place(s, "dusk_gool", "P2", 1, 0); // adjacent to Guan (melee reach)
    const f2 = place(s, "dusk_vamp", "P2", 1, 1); // adjacent (diagonal)
    const next = applyIntent(battleWith(s, guan.instanceId), {
      type: "BATTLE_ACTION",
      player: "P1",
      action: "special",
    });
    expect(next.cards[f1.instanceId].statuses[0]?.kind).toBe("WEAKEN");
    expect(next.cards[f2.instanceId].statuses[0]?.kind).toBe("WEAKEN");
    // (WEAKEN's −25% damage math is covered in statuses.test.ts)
  });

  it("Zagphu's Static Toss PARALYZEs; a paralyzed card coin-flips to act", () => {
    const s = prepState();
    s.players.P1.magicPool = 5;
    const zagphu = place(s, "bolt_zagphu", "P1", 2, 0);
    const foe = place(s, "dusk_gool", "P2", 1, 0, { curHp: 13 });
    const next = applyIntent(battleWith(s, zagphu.instanceId), {
      type: "BATTLE_ACTION",
      player: "P1",
      action: "special",
    });
    expect(next.cards[foe.instanceId].curHp).toBe(5); // 13 − 8
    expect(next.cards[foe.instanceId].statuses[0]?.kind).toBe("PARALYZE");
  });

  it("Webster's basic MUTES the target (no Specials)", () => {
    const s = prepState();
    const webster = place(s, "bolt_webster", "P1", 2, 0); // MUTED on hit
    const foe = place(s, "dusk_gool", "P2", 1, 0, { curHp: 13 });
    basicAttack(s, webster.instanceId, foe.instanceId);
    expect(foe.statuses.some((x) => x.kind === "MUTED")).toBe(true);
  });
});

describe("AQUA / DAWN handlers", () => {
  it("barrage applies a status to each target (Owl Hail freezes the row)", () => {
    const s = prepState();
    s.players.P1.magicPool = 5;
    const owlette = place(s, "aqua_owlette", "P1", 2, 0); // 4 dmg, FREEZE 1, 3 targets
    const a = place(s, "dusk_gool", "P2", 1, 0, { curHp: 13 });
    const b = place(s, "dusk_vamp", "P2", 1, 1, { curHp: 6 });
    const next = applyIntent(battleWith(s, owlette.instanceId), {
      type: "BATTLE_ACTION",
      player: "P1",
      action: "special",
    });
    expect(next.cards[a.instanceId].curHp).toBe(9);
    expect(next.cards[b.instanceId].curHp).toBe(2);
    expect(next.cards[a.instanceId].statuses[0]?.kind).toBe("FREEZE");
    expect(next.cards[b.instanceId].statuses[0]?.kind).toBe("FREEZE");
  });

  it("a targets:99 AOE special hits every reachable target at once (Star Shower)", () => {
    const s = prepState();
    s.players.P1.magicPool = 5;
    const star = place(s, "dawn_star", "P1", 2, 0); // Star Shower: 4 dmg, BLIND, targets 99
    const t1 = place(s, "dusk_gool", "P2", 1, 0, { curHp: 13 });
    const t2 = place(s, "dusk_vamp", "P2", 1, 1, { curHp: 6 });
    const t3 = place(s, "dusk_ghastly", "P2", 1, 2, { curHp: 19 });
    // The UI fires an AOE special with the full target list in one action.
    const next = applyIntent(battleWith(s, star.instanceId), {
      type: "BATTLE_ACTION",
      player: "P1",
      action: "special",
      targetIds: [t1.instanceId, t2.instanceId, t3.instanceId],
    });
    expect(next.cards[t1.instanceId].curHp).toBe(9);
    expect(next.cards[t2.instanceId].curHp).toBe(2);
    expect(next.cards[t3.instanceId].curHp).toBe(15);
    for (const t of [t1, t2, t3])
      expect(next.cards[t.instanceId].statuses[0]?.kind).toBe("BLIND");
    expect(next.players.P1.magicPool).toBe(3); // fired exactly once (cost 2)
  });

  it("Clipsey's High Noon Revolver is a 7×1 volley on every target (shreds shields)", () => {
    const s = prepState();
    s.players.P1.magicPool = 5;
    const clipsey = place(s, "dawn_clipsey", "P1", 2, 0); // 1 dmg × 7, targets 99
    const t1 = place(s, "dusk_gool", "P2", 1, 0, { curHp: 13, curShields: 3 });
    const t2 = place(s, "dusk_vamp", "P2", 1, 1, { curHp: 6 });
    const next = applyIntent(battleWith(s, clipsey.instanceId), {
      type: "BATTLE_ACTION",
      player: "P1",
      action: "special",
      targetIds: [t1.instanceId, t2.instanceId],
    });
    // t1: 3 shields eat the first 3 hits (0 to HP each, stripped), then 4 hits × 1 = 4
    expect(next.cards[t1.instanceId].curShields).toBe(0);
    expect(next.cards[t1.instanceId].curHp).toBe(9); // 13 − 4
    // t2: no shields, 7 × 1 = 7 to a 6-HP body → dies
    expect(next.cards[t2.instanceId]).toBeUndefined();
  });

  it("heal restores allies (Solstice's Daybreak heals the team)", () => {
    const s = prepState();
    s.players.P1.magicPool = 4;
    const solstice = place(s, "dawn_solstice", "P1", 2, 0);
    const hurt1 = place(s, "leaf_greegon", "P1", 3, 0, { curHp: 5, maxHp: 17 });
    const hurt2 = place(s, "pyro_tiki", "P1", 3, 1, { curHp: 3, maxHp: 16 });
    place(s, "dusk_gool", "P2", 0, 0);
    const next = applyIntent(battleWith(s, solstice.instanceId), {
      type: "BATTLE_ACTION",
      player: "P1",
      action: "special",
    });
    expect(next.cards[hurt1.instanceId].curHp).toBe(10); // +5
    expect(next.cards[hurt2.instanceId].curHp).toBe(8); // +5
  });

  it("Dawn's Golden Courage heals AND cleanses the team", () => {
    const s = prepState();
    s.players.P1.magicPool = 5;
    const dawn = place(s, "dawn_dawn", "P1", 2, 0);
    const ally = place(s, "leaf_greegon", "P1", 3, 0, {
      curHp: 10,
      maxHp: 17,
      status: { kind: "FREEZE", duration: 2, power: 0, source: "AQUA" },
    });
    place(s, "dusk_gool", "P2", 0, 0);
    const next = applyIntent(battleWith(s, dawn.instanceId), {
      type: "BATTLE_ACTION",
      player: "P1",
      action: "special",
    });
    expect(next.cards[ally.instanceId].curHp).toBe(15); // +5
    expect(next.cards[ally.instanceId].statuses).toHaveLength(0); // cleansed
  });

  it("Polar King's nova FREEZEs reachable opponents", () => {
    const s = prepState();
    s.players.P1.magicPool = 5;
    const polarKing = place(s, "aqua_polarking", "P1", 2, 0);
    const foe = place(s, "pyro_ember_scorpion", "P2", 1, 0, { curHp: 8 });
    const next = applyIntent(battleWith(s, polarKing.instanceId), {
      type: "BATTLE_ACTION",
      player: "P1",
      action: "special",
    });
    expect(next.cards[foe.instanceId].statuses[0]?.kind).toBe("FREEZE");
  });

  it("FREEZE halves damage (round down) and pins SP", () => {
    const s = prepState();
    // home row: isolate FREEZE from the Mid-row King-of-the-Hill +1
    const foe = place(s, "pyro_ember_scorpion", "P2", 0, 0, { curHp: 8 }); // 9 dmg base
    applyStatus(s, foe, "FREEZE", 2, 0, "AQUA");
    expect(effectiveSp(s, foe)).toBe(0);
    expect(effectiveDmg(s, foe)).toBe(4); // floor(9 × 0.5)
  });
});

describe("legendaries", () => {
  it("Volcanon's Eruption is a 5-hit shred that strips a full shield stack", () => {
    const s = prepState();
    s.players.P1.magicPool = 5;
    const volcanon = place(s, "pyro_volcanon", "P1", 2, 0);
    const t = place(s, "dusk_vamp", "P2", 1, 0, { curHp: 15, maxHp: 15, curShields: 4 });
    const next = applyIntent(battleWith(s, volcanon.instanceId), {
      type: "BATTLE_ACTION",
      player: "P1",
      action: "special",
    });
    // 5 hits of 2 vs 4 shields: hits 1-3 gated to 0, hit 4 lands 1, hit 5 lands 2;
    // all 4 shields stripped. 3 total to HP.
    expect(next.cards[t.instanceId].curShields).toBe(0);
    expect(next.cards[t.instanceId].curHp).toBe(12);
    expect(next.players.P1.magicPool).toBe(2);
  });

  it("Skelider's Piercing Charge is a 15 PEN nuke (ignores shields)", () => {
    const s = prepState();
    s.players.P2.magicPool = 6;
    const skelider = place(s, "dusk_skelider", "P2", 1, 0);
    const t = place(s, "leaf_greegon", "P1", 2, 0, { curHp: 17, maxHp: 17, curShields: 5 });
    const next = applyIntent(battleWith(s, skelider.instanceId), {
      type: "BATTLE_ACTION",
      player: "P2",
      action: "special",
    });
    expect(next.cards[t.instanceId].curHp).toBe(2); // 17 − 15, shields untouched
    expect(next.cards[t.instanceId].curShields).toBe(5);
  });

  it("Bearocks' Hibernation makes every negative status fizzle", () => {
    const s = prepState();
    const bearocks = place(s, "bore_bearocks", "P2", 1, 0);
    applyStatus(s, bearocks, "ROOT", 3, 0, "LEAF");
    applyStatus(s, bearocks, "BURN", 2, 3, "PYRO");
    expect(bearocks.statuses).toHaveLength(0);
    expect(s.log.some((l) => l.includes("immune to status"))).toBe(true);
  });

  it("Bearocks' Blunt Bash still SLEEPs a normal target", () => {
    const s = prepState();
    s.players.P2.magicPool = 6;
    const bearocks = place(s, "bore_bearocks", "P2", 1, 0);
    const t = place(s, "leaf_greegon", "P1", 2, 0, { curHp: 17, maxHp: 17 });
    const next = applyIntent(battleWith(s, bearocks.instanceId), {
      type: "BATTLE_ACTION",
      player: "P2",
      action: "special",
    });
    expect(next.cards[t.instanceId].curHp).toBe(12); // 17 − 5
    expect(next.cards[t.instanceId].statuses[0]?.kind).toBe("SLEEP");
  });
});

describe("on-summon passives (forward-area projection)", () => {
  it("Flamehound (ranged) blasts a 3-wide corridor reaching forward into the mid rows", () => {
    const s = prepState();
    s.players.P1.summonPool = 5;
    s.players.P1.magicPool = 4;
    // Summoned to P1 home col 1. Corridor = cols 0/1/2, reaching forward.
    const leftMid = place(s, "dusk_gool", "P2", 2, 0, { curHp: 13 }); // col 0, near mid
    const rightMid = place(s, "dusk_ghastly", "P2", 2, 2, { curHp: 19 }); // col 2, near mid
    const deep = place(s, "dusk_vamp", "P2", 1, 1, { curHp: 6 }); // col 1, far mid — reached
    const wide = place(s, "dusk_silkstalker", "P2", 2, 3, { curHp: 7 }); // col 3 — outside spread
    const handId = giveHand(s, "P1", "pyro_flamehound");
    const next = applyIntent(s, { type: "SUMMON", player: "P1", handId, col: 1 });
    expect(next.cards[leftMid.instanceId].curHp).toBe(10); // 3 dmg (side hit)
    expect(next.cards[rightMid.instanceId].curHp).toBe(16); // 3 dmg (side hit)
    expect(next.cards[deep.instanceId].curHp).toBe(3); // 3 dmg (reached far)
    expect(next.cards[wide.instanceId].curHp).toBe(7); // untouched (too wide)
    expect(next.players.P1.magicPool).toBe(4); // free — a passive, not a Special
  });

  it("the Home-Slot rule still gates the enemy home row from your own home", () => {
    const s = prepState();
    s.players.P1.summonPool = 5;
    const homeSitter = place(s, "dusk_gool", "P2", 0, 1, { curHp: 13 }); // enemy home, col 1
    const handId = giveHand(s, "P1", "pyro_flamehound");
    const next = applyIntent(s, { type: "SUMMON", player: "P1", handId, col: 1 });
    expect(next.cards[homeSitter.instanceId].curHp).toBe(13); // can't reach enemy home from home
    expect(next.log.some((l) => l.includes("on-summon"))).toBe(false);
  });

  it("Spitfire's Spit Shot (on summon) hits its own column, up to 2 spaces ahead", () => {
    const s = prepState();
    s.players.P1.summonPool = 5;
    const near = place(s, "dusk_gool", "P2", 2, 1, { curHp: 13 }); // 1 ahead, same col → hit
    const far = place(s, "dusk_gool", "P2", 0, 1, { curHp: 13 }); // 3 ahead, same col → out of reach
    const side = place(s, "dusk_vamp", "P2", 2, 0, { curHp: 6 }); // adjacent col → out of the lane
    const handId = giveHand(s, "P1", "pyro_spitfire");
    const next = applyIntent(s, { type: "SUMMON", player: "P1", handId, col: 1 });
    expect(next.cards[near.instanceId].curHp).toBe(10); // 3 dmg
    expect(next.cards[far.instanceId].curHp).toBe(13); // depth 2 doesn't reach 3 ahead
    expect(next.cards[side.instanceId].curHp).toBe(6); // off the column
  });

  it("a melee on-summon (Fenrir) reaches only one row ahead, but 3 wide", () => {
    const s = prepState();
    s.players.P1.summonPool = 5;
    const near = place(s, "dusk_gool", "P2", 2, 1, { curHp: 13 }); // adjacent row, side col
    const deep = place(s, "dusk_vamp", "P2", 1, 0, { curHp: 6 }); // two rows ahead — melee can't reach
    const handId = giveHand(s, "P1", "pyro_fenrir");
    const next = applyIntent(s, { type: "SUMMON", player: "P1", handId, col: 0 });
    expect(next.cards[near.instanceId].curHp).toBe(10); // hit (row ahead, within spread)
    expect(next.cards[deep.instanceId].curHp).toBe(6); // melee depth 1 — not reached
  });
});

describe("special legality", () => {
  it("multiple cards may each fire a Special in the same round if the pool affords it", () => {
    const s = prepState();
    s.players.P1.magicPool = 3; // Web Snare (1) + Leaf Storm (2) = exactly affordable
    const silk = place(s, "dusk_silkstalker", "P1", 2, 0); // Web Snare, cost 1
    const fallona = place(s, "leaf_fallona", "P1", 2, 1); // Leaf Storm, cost 2
    const t = place(s, "bore_smith", "P2", 1, 0, { curHp: 11, curShields: 0 });
    s.phase = "battle";
    s.battle = {
      queue: [silk.instanceId, fallona.instanceId],
      index: 0,
      awaitingInput: silk.instanceId,
    };
    let g = applyIntent(s, {
      type: "BATTLE_ACTION",
      player: "P1",
      action: "special",
      targetId: t.instanceId,
    });
    expect(g.players.P1.magicPool).toBe(2);
    // second card, same round: its own Special is fresh — only the pool gates it
    g.battle!.awaitingInput = fallona.instanceId;
    expect(canFireSpecial(g, fallona.instanceId).ok).toBe(true);
    g = applyIntent(g, {
      type: "BATTLE_ACTION",
      player: "P1",
      action: "special",
      targetId: t.instanceId,
    });
    expect(g.players.P1.magicPool).toBe(0);
    expect(g.cards[t.instanceId].curHp).toBe(1); // 11 − 7 (Web Snare) − 3 (Leaf Storm 3×1)
    // and both cards are now individually recharging
    expect(g.cards[silk.instanceId].specialCooldown).toBe(2);
    expect(g.cards[fallona.instanceId].specialCooldown).toBe(2);
  });

  it("one-round cooldown: fire -> blocked next round -> available the round after", () => {
    const s = prepState();
    s.players.P1.magicPool = 9;
    const a = place(s, "leaf_fallona", "P1", 2, 0); // Leaf Storm cost 2
    place(s, "dusk_gool", "P2", 1, 0, { curHp: 13 });
    place(s, "leaf_alpha", "P1", 3, 0); // keeps P1 alive on board
    let g = applyIntent(battleWith(s, a.instanceId), {
      type: "BATTLE_ACTION",
      player: "P1",
      action: "special",
    });
    expect(g.cards[a.instanceId].specialCooldown).toBe(2);
    // Cleanup of the round it fired: cooldown ticks to 1 -> still blocked next round.
    g = advance(atCleanup(g));
    expect(g.cards[a.instanceId].specialCooldown).toBe(1);
    expect(canFireSpecial(g, a.instanceId).ok).toBe(false);
    expect(canFireSpecial(g, a.instanceId).reason).toMatch(/recharging/i);
    // Next Cleanup: cooldown expires -> available again.
    g = advance(atCleanup(g));
    expect(g.cards[a.instanceId].specialCooldown).toBe(0);
    expect(canFireSpecial(g, a.instanceId).ok).toBe(true);
  });

  it("summon-turn lockout: no Special the round a card lands", () => {
    const s = prepState();
    s.players.P1.magicPool = 9;
    const a = place(s, "leaf_fallona", "P1", 3, 0, { summonedThisRound: true });
    place(s, "dusk_gool", "P2", 1, 0);
    expect(canFireSpecial(s, a.instanceId).ok).toBe(false);
    // ...and the lockout clears at Cleanup
    place(s, "leaf_alpha", "P1", 3, 1);
    const next = advance(atCleanup(s));
    expect(canFireSpecial(next, a.instanceId).ok).toBe(true);
  });

  it("rejects when the pool can't cover the cost", () => {
    const s = prepState();
    s.players.P1.magicPool = 1;
    const a = place(s, "leaf_fallona", "P1", 3, 0); // Leaf Storm cost 2
    place(s, "dusk_gool", "P2", 1, 0);
    expect(canFireSpecial(s, a.instanceId).ok).toBe(false);
  });

  it("rejects when MUTED and when no valid target exists", () => {
    const s = prepState();
    s.players.P1.magicPool = 9;
    const muted = place(s, "leaf_fallona", "P1", 3, 0, {
      status: { kind: "MUTED", duration: 1, power: 0, source: "BOLT" },
    });
    place(s, "dusk_gool", "P2", 1, 0);
    expect(canFireSpecial(s, muted.instanceId).ok).toBe(false);

    const s2 = prepState();
    s2.players.P1.magicPool = 9;
    const alone = place(s2, "leaf_fallona", "P1", 3, 0);
    place(s2, "dusk_gool", "P2", 0, 0); // enemy home camper — unreachable from own home
    expect(canFireSpecial(s2, alone.instanceId).ok).toBe(false);
  });

  it("STUN blocks acting entirely (attack, Special — and movement in prep)", () => {
    const s = prepState();
    s.players.P1.magicPool = 9;
    const stunned = place(s, "leaf_fallona", "P1", 2, 0, {
      status: { kind: "STUN", duration: 1, power: 0, source: "GALE" },
    });
    place(s, "dusk_gool", "P2", 1, 0);
    expect(canFireSpecial(s, stunned.instanceId).ok).toBe(false);
    s.phase = "battle";
    s.battle = { queue: [stunned.instanceId], index: 0, awaitingInput: null };
    const next = advance(s); // auto-skips, never awaits input
    expect(next.battle?.index).toBe(1);
    expect(next.log.some((l) => l.includes("can't act"))).toBe(true);
  });
});

describe("Ghastly — Ethereal Trade (on attack: +3 DMG, −2 HP)", () => {
  it("basic attack deals +3 and Ghastly pays 2 HP", () => {
    const s = prepState();
    const g = place(s, "dusk_ghastly", "P1", 3, 0, { curHp: 19, maxHp: 19 }); // home row (no mid +1)
    const t = place(s, "dusk_gool", "P2", 1, 0, { curHp: 20, maxHp: 20, curShields: 0 });
    const next = applyIntent(battleWith(s, g.instanceId), {
      type: "BATTLE_ACTION",
      player: "P1",
      action: "basic",
      targetId: t.instanceId,
    });
    expect(next.cards[t.instanceId].curHp).toBe(10); // 20 − (7 + 3)
    expect(next.cards[g.instanceId].curHp).toBe(17); // paid 2
  });

  it("Phantom Gouge also gets +3 to every target, and pays 2 HP once", () => {
    const s = prepState();
    s.players.P1.magicPool = 5;
    const g = place(s, "dusk_ghastly", "P1", 3, 0, { curHp: 19, maxHp: 19 });
    const t1 = place(s, "dusk_gool", "P2", 1, 0, { curHp: 20, maxHp: 20, curShields: 3 });
    const t2 = place(s, "dusk_gool", "P2", 1, 1, { curHp: 20, maxHp: 20, curShields: 0 });
    const next = applyIntent(battleWith(s, g.instanceId), {
      type: "BATTLE_ACTION",
      player: "P1",
      action: "special",
      targetId: t1.instanceId,
    });
    expect(next.cards[t1.instanceId].curHp).toBe(14); // 20 − 6 (PEN ignores shields)
    expect(next.cards[t1.instanceId].curShields).toBe(3); // PEN strips nothing
    expect(next.cards[t2.instanceId].curHp).toBe(14); // 20 − 6
    expect(next.cards[g.instanceId].curHp).toBe(17); // paid 2 once, not per target
    expect(next.players.P1.magicPool).toBe(3); // 5 − 2 Special cost
  });

  it("the self-cost can be lethal — the attack still lands first", () => {
    const s = prepState();
    const g = place(s, "dusk_ghastly", "P1", 3, 0, { curHp: 2, maxHp: 19 });
    const t = place(s, "dusk_gool", "P2", 1, 0, { curHp: 20, maxHp: 20, curShields: 0 });
    const next = applyIntent(battleWith(s, g.instanceId), {
      type: "BATTLE_ACTION",
      player: "P1",
      action: "basic",
      targetId: t.instanceId,
    });
    expect(next.cards[t.instanceId].curHp).toBe(10); // the hit resolves before the cost
    expect(next.cards[g.instanceId]).toBeUndefined(); // Ghastly paid 2 and died
  });
});
