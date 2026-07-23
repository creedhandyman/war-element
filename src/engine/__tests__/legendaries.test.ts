// The 8 new element Legendaries — fires each Special and checks a headline
// passive, proving the abilities actually resolve (not just typecheck).

import { describe, expect, it } from "vitest";
import { applyIntent, advance } from "../phases";
import { effectiveDmg } from "../state";
import { atCleanup, place, prepState, statusOf } from "./helpers";
import type { GameState } from "../types";

/** Park the battle so `activeId` is the card awaiting P1's action. */
function battleWith(s: GameState, activeId: string): GameState {
  s.phase = "battle";
  s.prep = null;
  s.battle = { queue: [activeId], index: 0, awaitingInput: activeId };
  return s;
}

describe("legendary specials", () => {
  it("LEAF Elderroot — Grove's Embrace heals every ally and cleanses them", () => {
    const s = prepState();
    s.players.P1.magicPool = 4;
    const root = place(s, "leaf_elderroot", "P1", 3, 0);
    const hurt = place(s, "pyro_tiki", "P1", 3, 1, {
      curHp: 5,
      maxHp: 16,
      status: { kind: "BURN", duration: 3, power: 3, source: "PYRO" },
    });
    place(s, "dusk_gool", "P2", 0, 0);
    const next = applyIntent(battleWith(s, root.instanceId), {
      type: "BATTLE_ACTION",
      player: "P1",
      action: "special",
    });
    expect(next.cards[hurt.instanceId].curHp).toBe(12); // +7 HP
    expect(next.cards[hurt.instanceId].statuses).toHaveLength(0); // BURN cleansed
  });

  it("PYRO Magmaw — Molten Rampage lands 4 combo hits of 4 on one target", () => {
    const s = prepState();
    s.players.P1.magicPool = 4;
    const mag = place(s, "pyro_magmaw", "P1", 2, 0);
    const foe = place(s, "dusk_gool", "P2", 1, 0, { curHp: 40, maxHp: 40, curShields: 0 });
    const next = applyIntent(battleWith(s, mag.instanceId), {
      type: "BATTLE_ACTION",
      player: "P1",
      action: "special",
      targetId: foe.instanceId,
    });
    expect(next.cards[foe.instanceId].curHp).toBe(40 - 16); // 4 × 4 DMG
  });

  it("AQUA Glacius — Deep Freeze deals 4 DMG and FREEZEs its targets", () => {
    const s = prepState();
    s.players.P1.magicPool = 4;
    const gl = place(s, "aqua_glacius", "P1", 2, 0);
    const f1 = place(s, "dusk_gool", "P2", 1, 0, { curHp: 20, curShields: 0 });
    const f2 = place(s, "dusk_gool", "P2", 1, 1, { curHp: 20, curShields: 0 });
    const f3 = place(s, "dusk_gool", "P2", 1, 2, { curHp: 20, curShields: 0 });
    const next = applyIntent(battleWith(s, gl.instanceId), {
      type: "BATTLE_ACTION",
      player: "P1",
      action: "special",
      targetIds: [f1.instanceId, f2.instanceId, f3.instanceId],
    });
    expect(next.cards[f1.instanceId].curHp).toBe(16); // 4 DMG
    expect(statusOf(next.cards[f1.instanceId], "FREEZE")).toBeTruthy();
    expect(statusOf(next.cards[f2.instanceId], "FREEZE")).toBeTruthy();
  });

  it("DAWN Aurelion — Dawn's Rally heals allies and grants +2 DMG", () => {
    const s = prepState();
    s.players.P1.magicPool = 4;
    const au = place(s, "dawn_aurelion", "P1", 2, 0);
    const ally = place(s, "leaf_greegon", "P1", 3, 0, { curHp: 5, maxHp: 17 });
    place(s, "dusk_gool", "P2", 0, 0);
    const baseDmg = effectiveDmg(s, s.cards[ally.instanceId]);
    const next = applyIntent(battleWith(s, au.instanceId), {
      type: "BATTLE_ACTION",
      player: "P1",
      action: "special",
    });
    expect(next.cards[ally.instanceId].curHp).toBe(10); // +5 HP
    expect(effectiveDmg(next, next.cards[ally.instanceId])).toBe(baseDmg + 2); // +2 DMG buff
  });

  it("GALE Tempest — Cyclone Strike hits for 8 PEN; High Speed Impact boosts its basic", () => {
    const s = prepState();
    s.players.P1.magicPool = 3;
    const t = place(s, "gale_tempest", "P1", 3, 0); // SP 14 → +4 High Speed Impact
    expect(effectiveDmg(s, s.cards[t.instanceId])).toBeGreaterThanOrEqual(10); // base 6 + 4
    const foe = place(s, "dusk_gool", "P2", 2, 1, { curHp: 20, curShields: 3 });
    const next = applyIntent(battleWith(s, t.instanceId), {
      type: "BATTLE_ACTION",
      player: "P1",
      action: "special",
      targetId: foe.instanceId,
    });
    expect(next.cards[foe.instanceId].curHp).toBe(12); // 8 PEN straight through
    expect(next.cards[foe.instanceId].curShields).toBe(3); // shields untouched by PEN
  });

  it("BOLT Stormcaller — Chain Paralysis PARALYZEs its targets", () => {
    const s = prepState();
    s.players.P1.magicPool = 4;
    const sc = place(s, "bolt_stormcaller", "P1", 2, 0);
    const f1 = place(s, "dusk_gool", "P2", 1, 0);
    const f2 = place(s, "dusk_gool", "P2", 1, 1);
    const f3 = place(s, "dusk_gool", "P2", 1, 2);
    const next = applyIntent(battleWith(s, sc.instanceId), {
      type: "BATTLE_ACTION",
      player: "P1",
      action: "special",
      targetIds: [f1.instanceId, f2.instanceId, f3.instanceId],
    });
    expect(statusOf(next.cards[f1.instanceId], "PARALYZE")).toBeTruthy();
    expect(statusOf(next.cards[f2.instanceId], "PARALYZE")).toBeTruthy();
  });

  it("DUSK Nightfang — Soul Drain steals 6 max HP and cloaks in STEALTH", () => {
    const s = prepState();
    s.players.P1.magicPool = 4;
    const nf = place(s, "dusk_nightfang", "P1", 2, 0);
    const baseMax = s.cards[nf.instanceId].maxHp;
    const foe = place(s, "dusk_gool", "P2", 1, 0, { curHp: 20, maxHp: 20 });
    const next = applyIntent(battleWith(s, nf.instanceId), {
      type: "BATTLE_ACTION",
      player: "P1",
      action: "special",
      targetId: foe.instanceId,
    });
    expect(next.cards[foe.instanceId].maxHp).toBe(14); // −6 max HP
    expect(next.cards[nf.instanceId].maxHp).toBe(baseMax + 6); // stolen onto Nightfang
    expect(statusOf(next.cards[nf.instanceId], "STEALTH")).toBeTruthy();
  });

  it("BORE Bastion — Boulder Barrage reaches a far enemy (ranged) and WEAKENs it", () => {
    const s = prepState();
    s.players.P1.magicPool = 5;
    const b = place(s, "bore_bastion", "P1", 2, 0); // mid row (clears the Home rule); Melee card
    const far = place(s, "dusk_gool", "P2", 0, 3, { curHp: 20, curShields: 0 }); // enemy home, far off
    const next = applyIntent(battleWith(s, b.instanceId), {
      type: "BATTLE_ACTION",
      player: "P1",
      action: "special",
      targetIds: [far.instanceId],
    });
    expect(next.cards[far.instanceId].curHp).toBe(14); // 6 DMG lobbed across the board
    expect(statusOf(next.cards[far.instanceId], "WEAKEN")).toBeTruthy();
  });

  it("BORE Bastion — rebuilds +2 shields each Cleanup (selfShields tick)", () => {
    const s = prepState();
    const b = place(s, "bore_bastion", "P1", 3, 0, { curShields: 0 });
    const next = advance(atCleanup(s));
    expect(next.cards[b.instanceId].curShields).toBe(2);
  });
});

describe("legendary audit — Flashing Barrage", () => {
  it("is 3 hits of 2 to every opponent in range, with a board-wide BLIND", () => {
    // It was 4 hits: 8 damage to EVERY reachable card for 3 magic, measured at
    // 10.7 per magic across a cluster — higher than any MYTHIC special, off a
    // cost-6 body. The BLIND was always the point; the volley outgrew it.
    const s = prepState();
    s.players.P1.magicPool = 9;
    const kosmos = place(s, "dawn_kosmos", "P1", 2, 1, { autoMode: "manual" });
    const a = place(s, "dusk_gool", "P2", 1, 1, { curHp: 99, maxHp: 99, curShields: 0 });
    const b = place(s, "dusk_gool", "P2", 1, 2, { curHp: 99, maxHp: 99, curShields: 0 });
    const n = applyIntent(battleWith(s, kosmos.instanceId), {
      type: "BATTLE_ACTION", player: "P1", action: "special", targetId: a.instanceId,
    });
    expect(99 - n.cards[a.instanceId].curHp).toBe(6); // 3 x 2, down from 8
    expect(99 - n.cards[b.instanceId].curHp).toBe(6); // it still hits everyone
    expect(statusOf(n.cards[a.instanceId], "BLIND")?.duration).toBe(1);
    expect(statusOf(n.cards[b.instanceId], "BLIND")?.duration).toBe(1);
  });

  it("every hit still strips a shield — the volley is unchanged in kind", () => {
    // Cutting a hit costs it a shield strip too; worth pinning, since that is
    // what the multi-hit shape is FOR.
    const s = prepState();
    s.players.P1.magicPool = 9;
    const kosmos = place(s, "dawn_kosmos", "P1", 2, 1, { autoMode: "manual" });
    const armoured = place(s, "dusk_gool", "P2", 1, 1, { curHp: 99, maxHp: 99, curShields: 5 });
    const n = applyIntent(battleWith(s, kosmos.instanceId), {
      type: "BATTLE_ACTION", player: "P1", action: "special", targetId: armoured.instanceId,
    });
    expect(n.cards[armoured.instanceId].curShields).toBe(2); // 5 − 3 hits
  });
});
