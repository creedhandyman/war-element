import { describe, expect, it } from "vitest";
import { advance, applyIntent } from "../phases";
import { boardCards, effectiveDmg, effectiveMaxHp, effectiveSp } from "../state";
import { atCleanup, place, prepState, statusOf } from "./helpers";
import type { GameState } from "../types";

function battleWith(s: GameState, activeId: string): GameState {
  s.phase = "battle";
  s.prep = null;
  s.battle = { queue: [activeId], index: 0, awaitingInput: activeId };
  return s;
}
const fire = (s: GameState, id: string, targetId?: string) =>
  applyIntent(battleWith(s, id), { type: "BATTLE_ACTION", player: "P1", action: "special", targetId });

describe("Bluejay", () => {
  it("Gustarrows shoots an opponent the moment it is summoned", () => {
    const s = prepState(1, "P2");
    place(s, "gale_bluejay", "P1", 2, 0); // off its own home row — see the Home Slot rule
    s.players.P2.gold = 20;
    s.players.P2.hand = [{ handId: "h99", defId: "leaf_greegon" }];
    const next = applyIntent(s, { type: "SUMMON", player: "P2", handId: "h99", col: 0 });
    const newcomer = boardCards(next, "P2").find((c) => c.defId === "leaf_greegon")!;
    expect(newcomer.curHp).toBeLessThan(15); // 2, or 4 if the CRIT coin landed
  });

  it("Twin Wind Strikes lands WEAKEN and saps 5 SP", () => {
    const s = prepState();
    s.players.P1.magicPool = 9;
    const jay = place(s, "gale_bluejay", "P1", 3, 0);
    const foe = place(s, "leaf_greegon", "P2", 2, 0, { curHp: 40, maxHp: 40, curShields: 0 });
    const before = effectiveSp(s, foe);
    const next = fire(s, jay.instanceId, foe.instanceId);
    const hit = next.cards[foe.instanceId];
    expect(hit.curHp).toBe(40 - 14); // 2x7
    expect(statusOf(hit, "WEAKEN")).toBeTruthy();
    expect(effectiveSp(next, hit)).toBe(before - 5);
  });
});

describe("Drakonbane", () => {
  it("Dragon's Bane adds +2 to BASICS against a big target, not a small one", () => {
    // effectiveDmg is target-independent, so this has to be measured through a
    // real attack rather than read off the attacker.
    const s = prepState();
    const dk = place(s, "dawn_drakonbane", "P1", 3, 0);
    const big = place(s, "leaf_greegon", "P2", 2, 0, { curHp: 30, maxHp: 30, curShields: 0 });
    const small = place(s, "leaf_greegon", "P2", 2, 1, { curHp: 10, maxHp: 30, curShields: 0 });
    const hitBig = applyIntent(battleWith(s, dk.instanceId), {
      type: "BATTLE_ACTION", player: "P1", action: "basic", targetId: big.instanceId,
    });
    const hitSmall = applyIntent(battleWith(s, dk.instanceId), {
      type: "BATTLE_ACTION", player: "P1", action: "basic", targetId: small.instanceId,
    });
    expect(30 - hitBig.cards[big.instanceId].curHp).toBe(9); // 7 + 2, over 25 HP
    expect(10 - hitSmall.cards[small.instanceId].curHp).toBe(7); // no bonus
  });

  it("Sunlight Strike is 14 into a Dragon and 10 into anything else", () => {
    const dragon = prepState();
    dragon.players.P1.magicPool = 9;
    const a = place(dragon, "dawn_drakonbane", "P1", 3, 0);
    const drg = place(dragon, "pyro_pyrogon", "P2", 2, 0, { curHp: 60, maxHp: 60, curShields: 0 });
    expect(60 - fire(dragon, a.instanceId, drg.instanceId).cards[drg.instanceId].curHp).toBe(14);

    const plain = prepState();
    plain.players.P1.magicPool = 9;
    const b = place(plain, "dawn_drakonbane", "P1", 3, 0);
    const foe = place(plain, "leaf_greegon", "P2", 2, 0, { curHp: 20, maxHp: 20, curShields: 0 });
    expect(20 - fire(plain, b.instanceId, foe.instanceId).cards[foe.instanceId].curHp).toBe(10);
  });

  it("the on-summon ambush fires at a bane target and NOT at a small one", () => {
    const worthy = prepState();
    worthy.players.P1.gold = 20;
    place(worthy, "leaf_greegon", "P2", 2, 0, { curHp: 30, maxHp: 30, curShields: 0 });
    worthy.players.P1.hand = [{ handId: "h1", defId: "dawn_drakonbane" }];
    const w = applyIntent(worthy, { type: "SUMMON", player: "P1", handId: "h1", col: 0 });
    expect(boardCards(w, "P2")[0].curHp).toBe(30 - 7 - 3); // 7 ambush + 3 DAWN Awakening

    const spared = prepState();
    spared.players.P1.gold = 20;
    place(spared, "leaf_greegon", "P2", 2, 0, { curHp: 10, maxHp: 30, curShields: 0 });
    spared.players.P1.hand = [{ handId: "h1", defId: "dawn_drakonbane" }];
    const sp = applyIntent(spared, { type: "SUMMON", player: "P1", handId: "h1", col: 0 });
    expect(boardCards(sp, "P2")[0].curHp).toBe(10 - 3); // Awakening only — no ambush
  });
});

describe("Zombination", () => {
  it("Toxic Eruption poisons every opponent in range", () => {
    const s = prepState();
    s.players.P1.magicPool = 9;
    const z = place(s, "dusk_zombination", "P1", 3, 0);
    const a = place(s, "leaf_greegon", "P2", 2, 0, { curHp: 30, maxHp: 30 });
    const b = place(s, "leaf_greegon", "P2", 2, 1, { curHp: 30, maxHp: 30 });
    const next = fire(s, z.instanceId, a.instanceId);
    expect(statusOf(next.cards[a.instanceId], "DOT")?.power).toBe(4);
    expect(statusOf(next.cards[b.instanceId], "DOT")?.power).toBe(4);
  });

  it("a Zombie bursting damages opponents beside it (Contagion)", () => {
    const s = prepState();
    const zom = place(s, "dusk_zombie_tok", "P1", 2, 1, { curHp: 1, maxHp: 3 });
    const beside = place(s, "leaf_greegon", "P2", 2, 2, { curHp: 30, maxHp: 30, curShields: 0 });
    const killer = place(s, "leaf_greegon", "P2", 1, 1, { curHp: 30, maxHp: 30 });
    const next = applyIntent(battleWith(s, killer.instanceId), {
      type: "BATTLE_ACTION", player: "P2", action: "basic", targetId: zom.instanceId,
    });
    expect(next.cards[zom.instanceId]?.curHp ?? 0).toBeLessThanOrEqual(0);
    expect(next.cards[beside.instanceId].curHp).toBeLessThan(30); // caught the burst
  });
});

describe("Magmadon", () => {
  it("Scorched Fury bleeds 1 HP a round and runs hotter for it", () => {
    const s = prepState();
    const mag = place(s, "pyro_magmadon", "P1", 3, 0, { curHp: 38, maxHp: 38 });
    const base = effectiveDmg(s, mag);
    const next = advance(atCleanup(s));
    const after = next.cards[mag.instanceId];
    expect(after.curHp).toBe(37);
    expect(effectiveDmg(next, after)).toBe(base + 2);
  });

  it("below 5 HP it gains a further flat +2", () => {
    const s = prepState();
    const hurt = place(s, "pyro_magmadon", "P1", 3, 0, { curHp: 4, maxHp: 38 });
    const well = prepState();
    const fine = place(well, "pyro_magmadon", "P1", 3, 0, { curHp: 38, maxHp: 38 });
    expect(effectiveDmg(s, hurt) - effectiveDmg(well, fine)).toBe(2);
  });

  it("Meltdown keeps erupting each round, and FREEZE smothers it", () => {
    const s = prepState();
    s.players.P1.magicPool = 9;
    const mag = place(s, "pyro_magmadon", "P1", 3, 0, { curHp: 38, maxHp: 38 });
    place(s, "bore_clubber", "P2", 2, 0, { curHp: 40, maxHp: 40, curShields: 0 }); // no REGEN to mask it
    const lit = fire(s, mag.instanceId);
    expect(lit.cards[mag.instanceId].channelOn).toBe(true);

    // Nobody attacks this round — the channel alone keeps hitting.
    const foeBefore = boardCards(lit, "P2")[0].curHp;
    const ticked = advance(atCleanup(lit));
    expect(boardCards(ticked, "P2")[0].curHp).toBeLessThan(foeBefore);
    expect(ticked.cards[mag.instanceId].channelOn).toBe(true);

    ticked.cards[mag.instanceId].statuses.push({ kind: "FREEZE", duration: 2, power: 0, source: "AQUA" });
    const frozen = advance(atCleanup(ticked));
    expect(frozen.cards[mag.instanceId].channelOn).toBe(false);
  });

  it("Trial by Fire tithes PYRO allies only", () => {
    const s = prepState();
    s.players.P1.gold = 20;
    const pyro = place(s, "pyro_firebird", "P1", 3, 1, { curHp: 20, maxHp: 20 });
    const other = place(s, "leaf_greegon", "P1", 3, 2, { curHp: 20, maxHp: 20 });
    const pyroDmg = effectiveDmg(s, pyro);
    const otherDmg = effectiveDmg(s, other);
    s.players.P1.hand = [{ handId: "h1", defId: "pyro_magmadon" }];
    const next = applyIntent(s, { type: "SUMMON", player: "P1", handId: "h1", col: 0 });
    expect(next.cards[pyro.instanceId].curHp).toBe(19); // paid a point
    expect(effectiveDmg(next, next.cards[pyro.instanceId])).toBe(pyroDmg + 2);
    expect(next.cards[other.instanceId].curHp).toBe(20); // spared
    expect(effectiveDmg(next, next.cards[other.instanceId])).toBe(otherDmg);
  });
});

describe("Krakler joins SeaC", () => {
  it("picks up Kraken's SeaC aura (+4 max HP) it never got as a tribe of one", () => {
    const alone = prepState();
    const solo = place(alone, "aqua_krakler", "P1", 3, 0);
    const base = effectiveMaxHp(alone, solo);

    const schooled = prepState();
    const kra = place(schooled, "aqua_krakler", "P1", 3, 0);
    place(schooled, "aqua_kraken", "P1", 3, 1);
    expect(effectiveMaxHp(schooled, schooled.cards[kra.instanceId])).toBe(base + 4);
  });
});

describe("Zombie Husk raises a Zombie instead of getting back up", () => {
  it("the chain terminates — a Zombie leaves nothing behind when IT falls", () => {
    // The worry with a death-spawns-a-body rule is an unkillable loop. A husk
    // yields exactly one Zombie; a Zombie yields none (it bursts instead).
    const s = prepState();
    const zom = place(s, "dusk_zombie_tok", "P1", 2, 1, { curHp: 1, maxHp: 3 });
    const killer = place(s, "leaf_alpha", "P2", 1, 1, { curHp: 30, maxHp: 30 });
    const next = applyIntent(battleWith(s, killer.instanceId), {
      type: "BATTLE_ACTION", player: "P2", action: "basic", targetId: zom.instanceId,
    });
    expect(boardCards(next, "P1").filter((c) => c.defId === "dusk_zombie_tok")).toHaveLength(0);
  });

  it("...and it rises however the husk died, not only to a basic attack", () => {
    // spawnToken sits outside the retaliation branch, so a DOT / tick kill
    // raises one just the same. Worth pinning: the horde's whole point is that
    // clearing it by attrition does not work.
    const s = prepState();
    const husk = place(s, "dusk_zombie_husk", "P1", 2, 0, { curHp: 2, maxHp: 8 });
    husk.statuses = [{ kind: "DOT", duration: 2, power: 5, source: "DUSK" }];
    const next = advance(atCleanup(s));
    expect(next.cards[husk.instanceId]?.curHp ?? 0).toBeLessThanOrEqual(0);
    expect(boardCards(next, "P1").filter((c) => c.defId === "dusk_zombie_tok")).toHaveLength(1);
  });
});
