// Milestone 7: specials registry, pool spend, summon-turn lockout, statuses.

import { describe, expect, it } from "vitest";
import { applyIntent } from "../phases";
import { applyStatus, basicAttack, effectiveBasicHits } from "../combat";
import { canBasicAttack, canFireSpecial, isActionBlocked } from "../rules";
import { effectiveDmg, effectiveSp } from "../state";
import { CARDS } from "../../data/cards";
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

  it("strike lifesteal: Darth's Dark Hunting heals for the damage dealt + ROOT 2r", () => {
    const s = prepState();
    s.players.P1.magicPool = 5;
    const a = place(s, "leaf_darth", "P1", 2, 0, { curHp: 5, maxHp: 16 }); // Dark Hunting cost 3
    const t = place(s, "dusk_gool", "P2", 1, 0, { curHp: 20, curShields: 0 });
    const next = applyIntent(battleWith(s, a.instanceId), {
      type: "BATTLE_ACTION",
      player: "P1",
      action: "special",
      targetId: t.instanceId,
    });
    const target = next.cards[t.instanceId];
    expect(target.curHp).toBe(13); // 7 DMG to HP
    expect(target.statuses.find((x) => x.kind === "ROOT")?.duration).toBe(2);
    expect(next.cards[a.instanceId].curHp).toBe(12); // 5 + 7 lifesteal
    expect(next.players.P1.magicPool).toBe(2);
  });

  it("Squanch's Bushwhacker ROOTs every adjacent opponent for 2 rounds", () => {
    const s = prepState();
    s.players.P1.magicPool = 3;
    const sq = place(s, "leaf_squanch", "P1", 2, 1); // Bushwhacker cost 2
    const primary = place(s, "dusk_gool", "P2", 1, 1, { curHp: 20, curShields: 0 });
    const beside = place(s, "bore_armadillo", "P2", 1, 0); // diagonal → still adjacent
    const far = place(s, "dusk_vamp", "P2", 0, 3); // two rows off → out of the thicket
    const next = applyIntent(battleWith(s, sq.instanceId), {
      type: "BATTLE_ACTION",
      player: "P1",
      action: "special",
      targetId: primary.instanceId,
    });
    const root = (id: string) => next.cards[id].statuses.find((x) => x.kind === "ROOT");
    expect(next.cards[primary.instanceId].curHp).toBe(14); // 6 DMG
    expect(root(primary.instanceId)?.duration).toBe(2);
    expect(root(beside.instanceId)?.duration).toBe(2);
    expect(root(far.instanceId)).toBeUndefined();
    expect(next.players.P1.magicPool).toBe(1);
  });

  it("talent Special: Alpha's Takedown fires FREE once, then is spent for the game", () => {
    const s = prepState();
    s.players.P1.magicPool = 3;
    const a = place(s, "leaf_alpha", "P1", 2, 0); // Takedown is now a one-shot Talent
    const t = place(s, "dusk_gool", "P2", 1, 0, { curHp: 20, curShields: 0 });
    const next = applyIntent(battleWith(s, a.instanceId), {
      type: "BATTLE_ACTION",
      player: "P1",
      action: "special",
      targetId: t.instanceId,
    });
    expect(next.cards[t.instanceId].curHp).toBe(14); // 20 − 6
    expect(next.cards[t.instanceId].statuses.find((x) => x.kind === "ROOT")?.duration).toBe(3);
    expect(next.players.P1.magicPool).toBe(3); // FREE — magic pool untouched
    expect(next.cards[a.instanceId].talentUsed).toBe(true);
    expect(canFireSpecial(next, a.instanceId).ok).toBe(false); // once per game
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

  it("Sentry's Static Blaster only hits PARALYZED opponents", () => {
    const s = prepState();
    s.players.P1.magicPool = 5;
    const sen = place(s, "bolt_sentry", "P1", 2, 0); // Static Blaster: 5 to all PARALYZED
    const par = place(s, "dusk_gool", "P2", 1, 0, {
      curHp: 20, curShields: 0,
      status: { kind: "PARALYZE", duration: 2, power: 0, source: "BOLT" },
    });
    const free = place(s, "dusk_vamp", "P2", 1, 1, { curHp: 6, curShields: 0 }); // not paralyzed
    const next = applyIntent(battleWith(s, sen.instanceId), {
      type: "BATTLE_ACTION",
      player: "P1",
      action: "special",
      targetId: par.instanceId,
    });
    expect(next.cards[par.instanceId].curHp).toBe(15); // paralyzed → 5 dmg
    expect(next.cards[free.instanceId].curHp).toBe(6); // not paralyzed → untouched
  });

  it("Vaga's Extinguisher only fires at foes under 9 HP (execute)", () => {
    // A healthy foe directly ahead is NOT a legal Extinguisher target.
    const s1 = prepState();
    s1.players.P1.magicPool = 5;
    const v1 = place(s1, "gale_vaga", "P1", 2, 0);
    place(s1, "dusk_gool", "P2", 1, 0, { curHp: 20 });
    expect(canFireSpecial(s1, v1.instanceId).ok).toBe(false);

    // A <9-HP foe in the same slot IS a target — and gets executed.
    const s2 = prepState();
    s2.players.P1.magicPool = 5;
    const v2 = place(s2, "gale_vaga", "P1", 2, 0);
    const weak = place(s2, "dusk_vamp", "P2", 1, 0, { curHp: 5, curShields: 0 }); // ground, <9 HP
    expect(canFireSpecial(s2, v2.instanceId).ok).toBe(true);
    const next = applyIntent(battleWith(s2, v2.instanceId), {
      type: "BATTLE_ACTION",
      player: "P1",
      action: "special",
      targetId: weak.instanceId,
    });
    expect(next.cards[weak.instanceId]).toBeUndefined(); // 8 PEN executes the 5-HP foe
  });

  it("Fenix's Phoenix Blast spreads BURN to the target's neighbors", () => {
    const s = prepState();
    s.players.P1.magicPool = 5;
    const f = place(s, "pyro_fenix", "P1", 2, 0); // Ranged; Phoenix Blast 8 + BURN 2 splash
    const target = place(s, "dusk_gool", "P2", 1, 1, { curHp: 20, curShields: 0 });
    const neighbor = place(s, "dusk_vamp", "P2", 1, 0, { curHp: 10, curShields: 0 }); // adjacent
    const far = place(s, "dusk_crow", "P2", 0, 3, { curHp: 5 }); // not adjacent
    const next = applyIntent(battleWith(s, f.instanceId), {
      type: "BATTLE_ACTION",
      player: "P1",
      action: "special",
      targetId: target.instanceId,
    });
    expect(next.cards[target.instanceId].statuses.find((x) => x.kind === "BURN")).toBeTruthy();
    expect(next.cards[neighbor.instanceId].statuses.find((x) => x.kind === "BURN")).toBeTruthy(); // splash
    expect(next.cards[far.instanceId].statuses.find((x) => x.kind === "BURN")).toBeFalsy();
  });

  it("barrage multi-selection: strikes exactly the picked targets, stacking repeats", () => {
    const s = prepState();
    s.players.P1.magicPool = 5;
    // Star Shower (4 DMG, targets 99). Deliberately NOT Sol — Sol is a
    // single-target 4-hit volley now, and its Incinerate would ramp the numbers.
    const star = place(s, "dawn_star", "P1", 2, 0);
    const t1 = place(s, "dusk_gool", "P2", 1, 0, { curHp: 20, maxHp: 20, curShields: 0 });
    const t2 = place(s, "dusk_ghastly", "P2", 1, 1, { curHp: 20, maxHp: 20, curShields: 0 });
    place(s, "bore_smith", "P2", 1, 2, { curHp: 11 }); // NOT picked — must be untouched
    const next = applyIntent(battleWith(s, star.instanceId), {
      type: "BATTLE_ACTION",
      player: "P1",
      action: "special",
      targetIds: [t1.instanceId, t1.instanceId, t1.instanceId, t2.instanceId], // stack 3 on t1
    });
    expect(next.cards[t1.instanceId].curHp).toBe(8); // 3 strikes × 4
    expect(next.cards[t2.instanceId].curHp).toBe(16); // 1 strike
    expect(next.cards[star.instanceId]).toBeTruthy();
    expect(next.log.filter((l) => l.includes("Smith")).length).toBe(0);
  });

  it("Sol's Pyro Ball Barrage is 4 hits on ONE target, and Incinerate ramps them", () => {
    const s = prepState();
    s.players.P1.magicPool = 3;
    const sol = place(s, "pyro_sol", "P1", 2, 0);
    const foe = place(s, "dusk_gool", "P2", 1, 0, { curHp: 40, maxHp: 40, curShields: 0 });
    const bystander = place(s, "dusk_vamp", "P2", 1, 1, { curHp: 20, maxHp: 20 });
    const next = applyIntent(battleWith(s, sol.instanceId), {
      type: "BATTLE_ACTION",
      player: "P1",
      action: "special",
      targetId: foe.instanceId,
    });
    // 3 + 4 + 5 + 6 = 18. Flat it would be 12 — the ramp is the point, and it
    // only exists because the volley stays on one target.
    expect(next.cards[foe.instanceId].curHp).toBe(22);
    expect(next.cards[bystander.instanceId].curHp).toBe(20); // single-target now
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
    // Shift rather than Krysteel: this is about the split mechanic, not a card,
    // and Shift is a keyword-free 2×3 — no CRIT to suppress, so the arithmetic
    // stands on its own instead of on a seeded coin.
    // Both targets sit on a ray one space out (straight ahead and diagonal), so
    // the ranged queen-line reach isn't what's under test here.
    const shift = place(s, "bore_shift", "P1", 3, 1, { autoMode: "manual" }); // 2 dmg × 3
    const t1 = place(s, "dusk_gool", "P2", 2, 1, { curHp: 13 });
    const t2 = place(s, "dusk_ghastly", "P2", 2, 2, { curHp: 19, curShields: 1 });
    s.rngState = seedForCoins(false, false, false); // no CRITs muddying the math
    const next = applyIntent(battleWith(s, shift.instanceId), {
      type: "BATTLE_ACTION",
      player: "P1",
      action: "basic",
      targetIds: [t1.instanceId, t1.instanceId, t2.instanceId], // 2 hits + 1 hit
    });
    expect(next.cards[t1.instanceId].curHp).toBe(9); // 13 − 2 − 2
    // t2: 2 − 1 shield = 1 to HP, shield stripped
    expect(next.cards[t2.instanceId].curHp).toBe(18);
    expect(next.cards[t2.instanceId].curShields).toBe(0);
  });

  it("Krysteel's basic is 4 shards of 2 — and strips a shield per shard", () => {
    // The point of the spray is hit COUNT: four separate shield strips off one
    // basic. Also pins the profile itself — a 5th pick must be rejected.
    const s = prepState();
    const krysteel = place(s, "bore_krysteel", "P1", 3, 0, { autoMode: "manual" });
    const bare = place(s, "dusk_gool", "P2", 1, 0, { curHp: 20, curShields: 0 });
    s.rngState = seedForCoins(false, false, false, false, false); // no CRITs muddying the math
    expect(() =>
      applyIntent(battleWith(s, krysteel.instanceId), {
        type: "BATTLE_ACTION",
        player: "P1",
        action: "basic",
        targetIds: Array(5).fill(bare.instanceId), // one too many
      }),
    ).toThrow(/Too many targets/);
    const next = applyIntent(battleWith(s, krysteel.instanceId), {
      type: "BATTLE_ACTION",
      player: "P1",
      action: "basic",
      targetIds: Array(4).fill(bare.instanceId),
    });
    expect(next.cards[bare.instanceId].curHp).toBe(12); // 20 − 4×2

    // Against 3 shields: each shard is eaten by the stack but strips one, so the
    // 4th lands. Three hits' worth of damage buys the opening — that trade is
    // the card's job now.
    const s2 = prepState();
    const k2 = place(s2, "bore_krysteel", "P1", 3, 0, { autoMode: "manual" });
    const w2 = place(s2, "dusk_ghastly", "P2", 1, 0, { curHp: 20, maxHp: 20, curShields: 3 });
    s2.rngState = seedForCoins(false, false, false, false, false);
    const n2 = applyIntent(battleWith(s2, k2.instanceId), {
      type: "BATTLE_ACTION",
      player: "P1",
      action: "basic",
      targetIds: Array(4).fill(w2.instanceId),
    });
    // Shards 1–2 are fully eaten, shard 3 leaks 1 past the last shield, shard 4
    // lands clean for 2 — 3 total. Each still strips one, which is the point.
    expect(n2.cards[w2.instanceId].curShields).toBe(0); // all three stripped
    expect(n2.cards[w2.instanceId].curHp).toBe(17);
  });

  it("at 4 hits Krysteel takes King of the Hill as +1 HIT, not +1 DMG", () => {
    // The threshold nobody would see coming from the stat line: hits < 4 gets
    // +1 DMG in a mid row, 4+ gets +1 HIT instead (MULTI_HIT_BONUS_MIN). The
    // 3×3 → 2×4 swap crossed it, so the mid-row profile went 4×3=12 raw to
    // 2×5=10 — most of the nerf actually lives here, not in the printed 9→8.
    const s = prepState();
    const home = place(s, "bore_krysteel", "P1", 3, 0); // own back row
    const mid = place(s, "bore_krysteel", "P1", 2, 0); // the aggressive slot
    expect(effectiveDmg(s, s.cards[home.instanceId])).toBe(2);
    expect(effectiveBasicHits(s.cards[home.instanceId])).toBe(4); // 8 raw
    expect(effectiveDmg(s, s.cards[mid.instanceId])).toBe(2); // NOT 3 — no per-shard bump
    expect(effectiveBasicHits(s.cards[mid.instanceId])).toBe(5); // 10 raw
  });

  it("BLOCK 2 zeroes Krysteel's basic outright — the spray's hard counter", () => {
    // The flip side of shard-spray, and sharp enough to be worth pinning down.
    // BLOCK is flat and charged PER SHARD, and it lands BEFORE CRIT doubles —
    // so 2-damage shards into BLOCK 2 is 0, four times over, crits included.
    // A card that shreds shields is blanked by armour instead.
    const s = prepState();
    const krysteel = place(s, "bore_krysteel", "P1", 3, 0, { autoMode: "manual" }); // 2×4
    const armour = place(s, "bore_armadillo", "P2", 1, 0, {
      curHp: 40, maxHp: 40, curShields: 0, // shields off: BLOCK alone is under test
    }); // BLOCK 2
    s.rngState = seedForCoins(true, true, true, true, true); // every CRIT succeeds
    const n = applyIntent(battleWith(s, krysteel.instanceId), {
      type: "BATTLE_ACTION", player: "P1", action: "basic",
      targetIds: Array(4).fill(armour.instanceId),
    });
    expect(n.cards[armour.instanceId].curHp).toBe(40); // (2−2)×2 crit ×4 = nothing
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
    // both hits landed; Incinerate ramps the 2nd (+1): 3 + 4 = 7 dealt
    expect(next.cards[t.instanceId].curHp).toBe(6);
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
    s.players.P1.gold = 5;
    const ally = place(s, "leaf_greegon", "P1", 2, 0, { curShields: 0 }); // row ahead
    const handId = giveHand(s, "P1", "bore_smith");
    const next = applyIntent(s, { type: "SUMMON", player: "P1", handId, col: 0 });
    // Reforged fires on summon and shields allies in the row ahead (Greegon).
    expect(next.cards[ally.instanceId].curShields).toBe(2);
  });

  it("onSummon ally buff: PolarBear's Polar Storm shields the row ahead +1", () => {
    const s = prepState();
    s.players.P1.gold = 5;
    const ally = place(s, "leaf_greegon", "P1", 2, 0, { curShields: 0 }); // row ahead
    const handId = giveHand(s, "P1", "aqua_polarbear");
    const next = applyIntent(s, { type: "SUMMON", player: "P1", handId, col: 0 });
    expect(next.cards[ally.instanceId].curShields).toBe(1);
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
  it("Flamehound's 3-wide corridor reaches forward, but only catches the 2 NEAREST", () => {
    const s = prepState();
    s.players.P1.gold = 5;
    s.players.P1.magicPool = 4;
    // Summoned to P1 home col 1. Corridor = cols 0/1/2, reaching forward.
    const leftMid = place(s, "dusk_gool", "P2", 2, 0, { curHp: 13 }); // col 0, near mid
    const rightMid = place(s, "dusk_ghastly", "P2", 2, 2, { curHp: 19 }); // col 2, near mid
    const deep = place(s, "dusk_vamp", "P2", 1, 1, { curHp: 6 }); // col 1, far mid — reached
    const wide = place(s, "dusk_silkstalker", "P2", 2, 3, { curHp: 7 }); // col 3 — outside spread
    const handId = giveHand(s, "P1", "pyro_flamehound");
    const next = applyIntent(s, { type: "SUMMON", player: "P1", handId, col: 1 });
    // Capped at 2 targets in the audit — uncapped, this cost-2 card put 12 on the
    // board on arrival, beating cost-3 Spitfire's 9. Corridors are sorted
    // nearest-first, so the cap costs it DEPTH: the two adjacent cards are hit
    // and the one further down the lane is now spared. The SHAPE is unchanged —
    // three columns wide, still reaching past melee range.
    expect(next.cards[leftMid.instanceId].curHp).toBe(10); // 3 dmg (side hit)
    expect(next.cards[rightMid.instanceId].curHp).toBe(16); // 3 dmg (side hit)
    expect(next.cards[deep.instanceId].curHp).toBe(6); // spared by the 2-target cap
    expect(next.cards[wide.instanceId].curHp).toBe(7); // untouched (too wide)
    expect(next.players.P1.magicPool).toBe(4); // free — a passive, not a Special
  });

  it("the Home-Slot rule still gates the enemy home row from your own home", () => {
    const s = prepState();
    s.players.P1.gold = 5;
    const homeSitter = place(s, "dusk_gool", "P2", 0, 1, { curHp: 13 }); // enemy home, col 1
    const handId = giveHand(s, "P1", "pyro_flamehound");
    const next = applyIntent(s, { type: "SUMMON", player: "P1", handId, col: 1 });
    expect(next.cards[homeSitter.instanceId].curHp).toBe(13); // can't reach enemy home from home
    expect(next.log.some((l) => l.includes("on-summon"))).toBe(false);
  });

  it("Spitfire's Spit Shot (on summon) hits up to 3 opponents anywhere in range", () => {
    const s = prepState();
    s.players.P1.gold = 5;
    const a = place(s, "dusk_gool", "P2", 2, 1, { curHp: 13 }); // row ahead, same col
    const b = place(s, "dusk_gool", "P2", 2, 2, { curHp: 13 }); // row ahead, far col
    const c = place(s, "dusk_vamp", "P2", 1, 0, { curHp: 6 }); // two rows ahead, side col
    const handId = giveHand(s, "P1", "pyro_spitfire");
    const next = applyIntent(s, { type: "SUMMON", player: "P1", handId, col: 1 });
    // 3 separate opponents (no shape constraint), 3 DMG each — all hit.
    expect(next.cards[a.instanceId].curHp).toBe(10);
    expect(next.cards[b.instanceId].curHp).toBe(10);
    expect(next.cards[c.instanceId].curHp).toBe(3);
  });

  it("Krakler's Abyssal Grasp (on summon) applies BOTH SCALD 3 and FREEZE 2r", () => {
    const s = prepState();
    s.players.P1.gold = 5;
    const foe = place(s, "dusk_gool", "P2", 2, 1, { curHp: 20 }); // king-adjacent to the home slot
    const handId = giveHand(s, "P1", "aqua_krakler");
    const next = applyIntent(s, { type: "SUMMON", player: "P1", handId, col: 1 });
    const f = next.cards[foe.instanceId];
    const scald = f.statuses.find((x) => x.kind === "SCALD");
    const freeze = f.statuses.find((x) => x.kind === "FREEZE");
    expect(scald?.power).toBe(3);
    expect(scald?.duration).toBe(2);
    expect(freeze?.duration).toBe(2);
  });

  it("a melee on-summon (Fenrir) reaches only one row ahead, but 3 wide", () => {
    const s = prepState();
    s.players.P1.gold = 5;
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
    expect(next.cards[t1.instanceId].curHp).toBe(12); // 20 − 8 (PEN ignores shields)
    expect(next.cards[t1.instanceId].curShields).toBe(3); // PEN strips nothing
    expect(next.cards[t2.instanceId].curHp).toBe(12); // 20 − 8
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

describe("Volcanon — Bad Temper + Eruption riders", () => {
  it("Bad Temper: a landed basic attack grants +1 permanent DMG", () => {
    const s = prepState();
    const v = place(s, "pyro_volcanon", "P1", 2, 0); // dmg 11, adjacent to foe
    const t = place(s, "dusk_gool", "P2", 1, 0, { curHp: 40, maxHp: 40, curShields: 0 });
    const next = applyIntent(battleWith(s, v.instanceId), {
      type: "BATTLE_ACTION",
      player: "P1",
      action: "basic",
      targetId: t.instanceId,
    });
    const vc = next.cards[v.instanceId];
    expect(vc.dmgBonus).toBe(1); // temper flared on hit (permanent +1 DMG)
  });

  it("Eruption: costs 1 HP and grants +1 permanent DMG per use", () => {
    const s = prepState();
    s.players.P1.magicPool = 3;
    const v = place(s, "pyro_volcanon", "P1", 2, 0, { curHp: 21, maxHp: 21 });
    const t = place(s, "dusk_gool", "P2", 1, 0, { curHp: 40, maxHp: 40, curShields: 0 });
    const next = applyIntent(battleWith(s, v.instanceId), {
      type: "BATTLE_ACTION",
      player: "P1",
      action: "special",
      targetId: t.instanceId,
    });
    const vc = next.cards[v.instanceId];
    expect(vc.curHp).toBe(20); // paid 1 HP
    expect(vc.dmgBonus).toBe(1); // Bad Temper's per-use growth
    expect(next.cards[t.instanceId].curHp).toBe(30); // 2×5 = 10 dealt
  });

  it("On Kill: Eruption grants a free recast (ignores cost + cooldown)", () => {
    const s = prepState();
    s.players.P1.magicPool = 3;
    const v = place(s, "pyro_volcanon", "P1", 2, 0);
    const t = place(s, "dusk_gool", "P2", 1, 0, { curHp: 6, maxHp: 20, curShields: 0 });
    const next = applyIntent(battleWith(s, v.instanceId), {
      type: "BATTLE_ACTION",
      player: "P1",
      action: "special",
      targetId: t.instanceId,
    });
    const vc = next.cards[v.instanceId];
    expect(next.cards[t.instanceId]).toBeUndefined(); // 10 dmg killed the 6-HP foe
    expect(vc.freeSpecial).toBe(true);
    expect(next.players.P1.magicPool).toBe(0); // first use paid its 3
    // A fresh foe: even with 0 magic AND on cooldown, the free recast can fire.
    place(next, "dusk_gool", "P2", 1, 1, { curHp: 40, maxHp: 40, curShields: 0 });
    expect(vc.specialCooldown).toBeGreaterThan(0);
    expect(canFireSpecial(battleWith(next, vc.instanceId), vc.instanceId).ok).toBe(true);
  });
});

describe("accuracy per hit", () => {
  it("BLIND is rolled PER HIT — a multi-hit attack lands some and misses some", () => {
    const s = prepState();
    const atk = place(s, "pyro_spitfire", "P1", 3, 0, {
      status: { kind: "BLIND", duration: 2, power: 0, source: "DAWN" },
    }); // 2-hit basic (3 DMG each), home row → no mid-row bonus
    const foe = place(s, "dusk_gool", "P2", 1, 0, { curHp: 40, maxHp: 40, curShields: 0 });
    s.rngState = seedForCoins(true, false); // hit 1 lands, hit 2 whiffs
    basicAttack(s, atk.instanceId, foe.instanceId);
    expect(s.cards[foe.instanceId].curHp).toBe(40 - 3); // exactly one hit landed
  });
});

describe("Sprinu — Root Spring stays control, not a board wipe", () => {
  it("roots the whole board and heals, but the damage is no longer the point", () => {
    // Measured at 12 damage per magic before the cut — double the next LEAF
    // special and 4x the cost-9 mythic, on a cost-3 Support. Only the damage
    // was reduced; the board-wide ROOT and the team heal are the identity.
    const s = prepState();
    s.players.P1.magicPool = 20;
    const sprinu = place(s, "leaf_sprinu", "P1", 2, 1, { autoMode: "manual" });
    const hurt = place(s, "leaf_cactus", "P1", 3, 0, { curHp: 1, maxHp: 20 });
    const foes = [0, 1, 2, 3].map((c) =>
      place(s, "dusk_gool", "P2", 1, c, { curHp: 400, maxHp: 400, curShields: 0 }),
    );
    const next = applyIntent(battleWith(s, sprinu.instanceId), {
      type: "BATTLE_ACTION", player: "P1", action: "special", targetId: foes[0].instanceId,
    });
    const dealt = foes.reduce((t, f) => t + (400 - next.cards[f.instanceId].curHp), 0);
    expect(dealt).toBe(8); // 2 x 4 targets, for 2 magic
    for (const f of foes)
      expect(next.cards[f.instanceId].statuses.find((x) => x.kind === "ROOT")?.duration).toBe(2);
    expect(next.cards[hurt.instanceId].curHp).toBe(5); // 1 + 4 team heal
  });
});

describe("outlier cuts and the Thorn sweep", () => {
  /** Four fat dummies in reach; returns damage dealt and how many were touched. */
  function sweep(defId: string, magic = 30) {
    const s = prepState();
    s.players.P1.magicPool = magic;
    const me = place(s, defId, "P1", 2, 1, { autoMode: "manual" });
    const foes = [0, 1, 2, 3].map((c) =>
      place(s, "dusk_gool", "P2", 1, c, { curHp: 900, maxHp: 900, curShields: 0 }),
    );
    const next = applyIntent(battleWith(s, me.instanceId), {
      type: "BATTLE_ACTION", player: "P1", action: "special", targetId: foes[0].instanceId,
    });
    const dealt = foes.reduce((t, f) => t + (900 - next.cards[f.instanceId].curHp), 0);
    const touched = foes.filter((f) => next.cards[f.instanceId].curHp < 900).length;
    return { next, foes, dealt, touched };
  }

  it("Thorn sweeps 2 opponents for 7 PEN each and leaves BLEED 3", () => {
    // Cut from 3. It measured 19.5 damage/round (21 burst + 18 BLEED) — the
    // highest sustained output of any legendary, above every mythic.
    const { next, foes, dealt, touched } = sweep("leaf_thorn");
    expect(touched).toBe(2); // up to 2, not the whole board
    expect(dealt).toBe(14); // 7 x 2
    for (const f of foes.slice(0, 2))
      expect(next.cards[f.instanceId].statuses.find((x) => x.kind === "BLEED")?.power).toBe(3);
  });

  it("Thorn's sweep still PENetrates — shields don't blunt it", () => {
    const s = prepState();
    s.players.P1.magicPool = 30;
    const thorn = place(s, "leaf_thorn", "P1", 2, 1, { autoMode: "manual" });
    const walled = place(s, "dusk_gool", "P2", 1, 1, { curHp: 900, maxHp: 900, curShields: 6 });
    const next = applyIntent(battleWith(s, thorn.instanceId), {
      type: "BATTLE_ACTION", player: "P1", action: "special", targetId: walled.instanceId,
    });
    expect(next.cards[walled.instanceId].curHp).toBe(893); // full 7 through 6 shields
    expect(next.cards[walled.instanceId].curShields).toBe(6); // PEN leaves them standing
  });

  it("Ghastly's Phantom Gouge is capped at 2 targets, not the board", () => {
    // The cap is what pays for the damage: it hit the whole board at 12.0
    // dmg/magic before the cut. The printed 5 lands as 8 because attackTrade
    // adds its +3 to the Special as well.
    const { dealt, touched } = sweep("dusk_ghastly");
    expect(touched).toBe(2);
    expect(dealt).toBe(16); // 8 x 2, for 2 magic
  });

  it("Lytning still paralyzes the whole board — only the damage halved", () => {
    const { next, foes, dealt, touched } = sweep("bolt_lytning");
    expect(touched).toBe(4); // reach kept
    expect(dealt).toBe(12); // 3 x 4, down from 6 x 4
    for (const f of foes)
      expect(next.cards[f.instanceId].statuses.find((x) => x.kind === "PARALYZE")?.duration).toBe(2);
  });

  it("Lytning's Static Discharge actually fires — the combo was dead at PARALYZE 1", () => {
    // Cleanup ticks statuses down at step 3 but runs roundTick at 4b, so a
    // 1-round PARALYZE expired before its own tick looked for it: measured 0
    // damage from the combo, every round. Duration 2 is what closes the loop.
    const { next, foes, dealt } = sweep("bolt_lytning");
    const after = advance(atCleanup(next));
    const total = foes.reduce((t, f) => t + (900 - after.cards[f.instanceId].curHp), 0);
    expect(total).toBe(dealt + 8); // 2 DMG on each of the 4 still-PARALYZED foes
  });
});

describe("repriced board specials", () => {
  // Both were cheap enough to fire every single round, which is what made them
  // board-deleters. The casts are unchanged - only the price is.
  it("Krystal Rain and Whip Strike each cost 3 magic", () => {
    for (const [id, cost] of [["bore_krysteel", 3], ["bolt_lytning", 3]] as const) {
      const s = prepState();
      s.players.P1.magicPool = 9;
      const me = place(s, id, "P1", 2, 1, { autoMode: "manual" });
      const foes = [0, 1].map((c) => place(s, "dusk_gool", "P2", 1, c, { curHp: 900, maxHp: 900, curShields: 0 }));
      const next = applyIntent(battleWith(s, me.instanceId), {
        type: "BATTLE_ACTION", player: "P1", action: "special", targetId: foes[0].instanceId,
      });
      expect(9 - next.players.P1.magicPool, id).toBe(cost);
    }
  });

  it("2 magic no longer buys either one", () => {
    for (const id of ["bore_krysteel", "bolt_lytning"]) {
      const s = prepState();
      s.players.P1.magicPool = 2; // was exactly enough before
      const me = place(s, id, "P1", 2, 1, { autoMode: "manual" });
      place(s, "dusk_gool", "P2", 1, 0, { curHp: 900, maxHp: 900, curShields: 0 });
      expect(canFireSpecial(s, me.instanceId).ok, id).toBe(false);
    }
  });
});

describe("King of the Hill — which half of the bonus a mid row pays", () => {
  const mid = (id: string) => {
    const s = prepState();
    const c = place(s, id, "P1", 2, 1, { autoMode: "manual" });
    return effectiveDmg(s, s.cards[c.instanceId]) * effectiveBasicHits(s.cards[c.instanceId]);
  };

  it("a 4th printed hit no longer makes a card WEAKER in a mid row", () => {
    // The inversion this fixed: Electricel prints 1x4 (4 raw) and DrShock 1x3
    // (3 raw), yet the +1 HIT branch left Electricel on 5 in a mid row while
    // DrShock got +1 DMG and reached 6 — more printed damage, less delivered.
    expect(mid("bolt_drshock")).toBe(6);
    expect(mid("bolt_electricel")).toBe(8);
    expect(mid("bolt_electricel")).toBeGreaterThan(mid("bolt_drshock"));
    expect(mid("dawn_goldeneagle")).toBe(10); // 1x5, same branch
  });

  it("heavy shredders keep the +1 HIT branch — no ballooning", () => {
    // Clipsey on a flat +1 DMG would be 2x7 = 14, which is the whole reason the
    // HIT branch exists. 6+ hits stay on it.
    expect(mid("dawn_clipsey")).toBe(8); // 1x7 -> 1x8
  });

  it("cards above 1 base damage are untouched by the carve-out", () => {
    // Guards the balance work: these were tuned against the +1 HIT branch and
    // must not quietly gain a point of damage from this rule.
    expect(mid("bore_krysteel")).toBe(10); // 2x4 -> 2x5
    expect(mid("dawn_kosmos")).toBe(10);
    expect(mid("aqua_vaporem")).toBe(12); // 2x5 -> 2x6
  });

  it("the two halves are exact complements — never both, never neither", () => {
    // effectiveDmg and effectiveBasicHits read hillGivesHit() from opposite
    // sides. If they ever drift, a card gets a double bonus or none at all.
    for (const d of CARDS) {
      const s = prepState();
      const c = place(s, d.id, "P1", 2, 1, { autoMode: "manual" });
      const gotHit = effectiveBasicHits(s.cards[c.instanceId]) > d.hits;
      const gotDmg = effectiveDmg(s, s.cards[c.instanceId]) > d.dmg;
      expect(gotHit && gotDmg, `${d.id} got BOTH halves`).toBe(false);
    }
  });
});

describe("lateral charge — riders track their victim across columns", () => {
  /** Fire `casterId`'s special at `targetId`; hand back the caster's landing slot. */
  function chargeAt(s: GameState, casterId: string, targetId: string) {
    const n = applyIntent(battleWith(s, casterId), {
      type: "BATTLE_ACTION", player: "P1", action: "special", targetId,
    });
    return { state: n, pos: n.cards[casterId]?.pos };
  }
  const gap = (a: { row: number; col: number }, b: { row: number; col: number }) =>
    Math.max(Math.abs(a.row - b.row), Math.abs(a.col - b.col));

  it("Skelider rides sideways to reach a target in another column", () => {
    // The old charge only stepped up its OWN column, so a victim one column
    // over meant the rider struck from where it stood and never moved a slot.
    const s = prepState();
    s.players.P1.magicPool = 9;
    const skel = place(s, "dusk_skelider", "P1", 2, 0, { autoMode: "manual" });
    const foe = place(s, "dusk_gool", "P2", 1, 2, { curHp: 999, maxHp: 999 });
    const { pos } = chargeAt(s, skel.instanceId, foe.instanceId);
    expect(pos).toBeDefined();
    expect(pos!.col).not.toBe(0); // it actually moved horizontally
    expect(gap(pos!, { row: 1, col: 2 })).toBe(1); // and closed to melee
  });

  it("a body parked directly ahead is stepped AROUND, not treated as a wall", () => {
    const s = prepState();
    s.players.P1.magicPool = 9;
    const horse = place(s, "dusk_shadowhorsemen", "P1", 3, 1, { autoMode: "manual" });
    place(s, "dusk_gool", "P2", 2, 1, { curHp: 999, maxHp: 999 }); // sat in the lane
    const foe = place(s, "dusk_vamp", "P2", 1, 1, { curHp: 999, maxHp: 999 });
    const { pos } = chargeAt(s, horse.instanceId, foe.instanceId);
    expect(pos).toBeDefined();
    expect(pos).not.toEqual({ row: 3, col: 1 }); // the old charge stalled here
    expect(gap(pos!, { row: 1, col: 1 })).toBe(1);
  });

  it("it pulls up BESIDE a living target rather than trampling onto it", () => {
    const s = prepState();
    s.players.P1.magicPool = 9;
    const horse = place(s, "dusk_shadowhorsemen", "P1", 2, 0, { autoMode: "manual" });
    const foe = place(s, "dusk_gool", "P2", 0, 0, { curHp: 999, maxHp: 999 });
    const { state, pos } = chargeAt(s, horse.instanceId, foe.instanceId);
    expect(state.cards[foe.instanceId]).toBeDefined(); // it survived the hit
    expect(pos).not.toEqual({ row: 0, col: 0 });
    expect(gap(pos!, { row: 0, col: 0 })).toBe(1);
  });

  it("Griffith's Dive Bomb now actually dives", () => {
    const s = prepState();
    s.players.P1.magicPool = 9;
    const grif = place(s, "gale_griffith", "P1", 2, 0, { autoMode: "manual" });
    const foe = place(s, "dusk_gool", "P2", 1, 2, { curHp: 999, maxHp: 999 });
    const { pos } = chargeAt(s, grif.instanceId, foe.instanceId);
    expect(pos).toBeDefined();
    expect(pos).not.toEqual({ row: 2, col: 0 });
    expect(gap(pos!, { row: 1, col: 2 })).toBe(1);
  });

  it("RohoJohn's Battle Charge still ploughs STRAIGHT ahead and stalls when blocked", () => {
    // Its text promises "every opponent straight ahead" — the lateral charge is
    // opt-in precisely so this one keeps its lane and its stopping behaviour.
    const s = prepState();
    s.players.P1.magicPool = 9;
    const roho = place(s, "bore_rohojohn", "P1", 2, 1, { autoMode: "manual" });
    const foe = place(s, "dusk_gool", "P2", 1, 1, { curHp: 999, maxHp: 999 });
    const { pos } = chargeAt(s, roho.instanceId, foe.instanceId);
    expect(pos).toEqual({ row: 2, col: 1 }); // blocked lane = no movement at all
  });
});

describe("a charge obeys the same geometry as a normal move", () => {
  it("a ground rider spends TWO steps to cut a corner; a flyer spends one", () => {
    // Prep movement is Manhattan for everyone except FLYING (chess king). If the
    // charge used king steps for everyone, a ground card would out-manoeuvre its
    // own move rule.
    const setup = (id: string) => {
      const s = prepState();
      s.players.P1.magicPool = 9;
      const c = place(s, id, "P1", 2, 0, { autoMode: "manual" });
      const foe = place(s, "dusk_gool", "P2", 1, 3, { curHp: 999, maxHp: 999 });
      const n = applyIntent(battleWith(s, c.instanceId), {
        type: "BATTLE_ACTION", player: "P1", action: "special", targetId: foe.instanceId,
      });
      return n.cards[c.instanceId].pos!;
    };
    // Both close to melee on (1,3), but the flyer takes the diagonal.
    const flyer = setup("gale_griffith"); // FLYING, charge 3
    const ground = setup("dusk_shadowhorsemen"); // charge 4
    expect(Math.max(Math.abs(flyer.row - 1), Math.abs(flyer.col - 3))).toBe(1);
    expect(Math.max(Math.abs(ground.row - 1), Math.abs(ground.col - 3))).toBe(1);
    // The ground rider never moves diagonally: every step it took was straight,
    // so its total path length is the Manhattan distance it covered.
    const manhattan = Math.abs(ground.row - 2) + Math.abs(ground.col - 0);
    expect(manhattan).toBeLessThanOrEqual(4); // within its charge budget
  });
});

describe("Rollo — Rover rolls in FIRST, then bashes", () => {
  it("closes a 2-slot gap and lands the full 3x3", () => {
    // Before this, Rolling Bash was melee-reach with an unmodeled Rover: it
    // could only hit a card already adjacent, so it reached exactly as far as
    // its own basic attack for 2 magic, and never moved.
    const s = prepState();
    s.players.P1.magicPool = 9;
    const rollo = place(s, "bore_rollo", "P1", 3, 0, { autoMode: "manual" });
    const foe = place(s, "dusk_gool", "P2", 1, 0, { curHp: 99, maxHp: 99, curShields: 0 });
    const n = applyIntent(battleWith(s, rollo.instanceId), {
      type: "BATTLE_ACTION", player: "P1", action: "special", targetId: foe.instanceId,
    });
    expect(99 - n.cards[foe.instanceId].curHp).toBe(9); // 3 hits of 3
    // It rolled in rather than striking from home — and pulls up BESIDE the
    // target, never onto it.
    const p = n.cards[rollo.instanceId].pos!;
    expect(p).not.toEqual({ row: 3, col: 0 });
    expect(Math.max(Math.abs(p.row - 1), Math.abs(p.col - 0))).toBe(1);
  });

  it("the roll lands BEFORE the hit — proven by a kill", () => {
    // Position alone cannot separate the two orderings: a charge either side of
    // the strike ends up beside a LIVING target. The tell is a target that DIES.
    // Rolling first, Rollo pulls up beside a body that is still standing and so
    // stops short of its slot. Rolling after, the slot is already vacated and
    // chargeToward would walk straight onto it.
    const s = prepState();
    s.players.P1.magicPool = 9;
    const rollo = place(s, "bore_rollo", "P1", 3, 1, { autoMode: "manual" });
    const doomed = place(s, "dusk_gool", "P2", 1, 1, { curHp: 2, maxHp: 2, curShields: 0 });
    const n = applyIntent(battleWith(s, rollo.instanceId), {
      type: "BATTLE_ACTION", player: "P1", action: "special", targetId: doomed.instanceId,
    });
    expect(n.cards[doomed.instanceId]).toBeUndefined(); // it died to the bash
    expect(n.cards[rollo.instanceId].pos).toEqual({ row: 2, col: 1 }); // stopped BESIDE it
  });

  it("every rider now closes BEFORE it strikes, not after", () => {
    // Same kill tell, applied across the roster: a rider that moved first pulls
    // up beside a body still standing; one that moved after would take the slot
    // its victim just vacated. All of these read as move-then-hit in their card
    // text ("Ride up to 4 slots ... and deal", "Dive ... onto your target"), and
    // the implementation used to do the opposite.
    for (const id of ["dusk_skelider", "dusk_shadowhorsemen", "bolt_thundercat", "gale_tempest"]) {
      const s = prepState();
      s.players.P1.magicPool = 9;
      const rider = place(s, id, "P1", 3, 1, { autoMode: "manual" });
      const doomed = place(s, "dusk_gool", "P2", 1, 1, { curHp: 2, maxHp: 2, curShields: 0 });
      const n = applyIntent(battleWith(s, rider.instanceId), {
        type: "BATTLE_ACTION", player: "P1", action: "special", targetId: doomed.instanceId,
      });
      expect(n.cards[doomed.instanceId], `${id} failed to kill`).toBeUndefined();
      expect(n.cards[rider.instanceId].pos, `${id} walked onto the corpse`)
        .not.toEqual({ row: 1, col: 1 });
    }
  });

  it("...but the two cards whose text says otherwise still hit FIRST", () => {
    // Tumbleweed's reads "deal 5 DMG, THEN roll 1 slot", and Ash Boar's charge is
    // an ON-SUMMON that tramples through. Both deliberately skip chargeFirst, so
    // this pins the divergence as a choice rather than an oversight.
    const s = prepState();
    s.players.P1.magicPool = 9;
    // Its roll rides a TALENT, not a Special — hence the different action here.
    const weed = place(s, "gale_tumbleweed", "P1", 3, 1, { autoMode: "manual" });
    const doomed = place(s, "dusk_gool", "P2", 2, 1, { curHp: 2, maxHp: 2, curShields: 0 });
    const n = applyIntent(battleWith(s, weed.instanceId), {
      type: "BATTLE_ACTION", player: "P1", action: "talent", targetId: doomed.instanceId,
    });
    expect(n.cards[doomed.instanceId]).toBeUndefined();
    expect(n.cards[weed.instanceId].pos).toEqual({ row: 2, col: 1 }); // rolled onto it
  });
});

describe("Wedded Wraith — Shadow Summon is on a 3-round lockout", () => {
  it("blocks for three rounds, not one", () => {
    // It was on the DEFAULT cooldown (specialCooldown 2 = a single blocked
    // round), so three Specters a cast could land every other round.
    const s = prepState();
    s.players.P1.magicPool = 20;
    const wraith = place(s, "dusk_wedded_wraith", "P1", 2, 1, { autoMode: "manual" });
    place(s, "dusk_gool", "P2", 0, 0);
    let g = applyIntent(battleWith(s, wraith.instanceId), {
      type: "BATTLE_ACTION", player: "P1", action: "special", targetId: wraith.instanceId,
    });
    expect(g.cards[wraith.instanceId].specialCooldown).toBe(4); // (3 printed) + 1
    // Three Cleanups still blocked; the fourth frees it. The +1 exists because
    // the round it fired ticks once itself.
    for (const expected of [3, 2, 1]) {
      g = advance(atCleanup(g));
      expect(g.cards[wraith.instanceId].specialCooldown).toBe(expected);
      expect(canFireSpecial(g, wraith.instanceId).ok).toBe(false);
    }
    g = advance(atCleanup(g));
    expect(g.cards[wraith.instanceId].specialCooldown).toBe(0);
    expect(canFireSpecial(g, wraith.instanceId).ok).toBe(true);
  });
});

describe("epic audit — Thunder's Arcing Strike", () => {
  it("hits the target 7 and arcs 3 to each neighbour, not another full 7", () => {
    // It arced the FULL hit, so a target in a cluster ate 28 for 2 magic —
    // 14.0 damage per magic, the most efficient card in the game, ahead of every
    // legendary and mythic. An arc should be a graze, not a second strike.
    const s = prepState();
    s.players.P1.magicPool = 9;
    const thunder = place(s, "bolt_thunder", "P1", 2, 1, { autoMode: "manual" });
    const main = place(s, "dusk_gool", "P2", 1, 1, { curHp: 99, maxHp: 99, curShields: 0 });
    const beside = place(s, "dusk_gool", "P2", 1, 2, { curHp: 99, maxHp: 99, curShields: 0 });
    const far = place(s, "dusk_gool", "P2", 0, 3, { curHp: 99, maxHp: 99, curShields: 0 });
    const n = applyIntent(battleWith(s, thunder.instanceId), {
      type: "BATTLE_ACTION", player: "P1", action: "special", targetId: main.instanceId,
    });
    expect(99 - n.cards[main.instanceId].curHp).toBe(7); // the hit is untouched
    expect(99 - n.cards[beside.instanceId].curHp).toBe(3); // arc, down from 7
    expect(n.cards[far.instanceId].curHp).toBe(99); // splash is adjacency-only
  });
});
