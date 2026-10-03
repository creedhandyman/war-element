// Owner, 2026-10-02: "Hawko passive not working" and "summoning attacks need
// to do a better job of telling the player the range of the attack".
import { describe, expect, it } from "vitest";
import { applyIntent } from "../phases";
import { allyShieldTargets, arrivalStrike, canFireSpecial, validTargets } from "../rules";
import { CARDS, getDef } from "../../data/cards";
import { giveHand, place, prepState } from "./helpers";
import type { Pos } from "../types";

const has = (list: Pos[], row: number, col: number) => list.some((p) => p.row === row && p.col === col);

describe("Hawko — Aerial Dominance", () => {
  function summonBeside(hawkoRow: number) {
    const s = prepState(42, "P2");
    const hawko = place(s, "gale_hawko", "P1", hawkoRow, 1);
    s.players.P2.gold = 9;
    const handId = giveHand(s, "P2", "dusk_zhunk");
    const g = applyIntent(s, { type: "SUMMON", player: "P2", handId, col: 1 });
    const zhunk = Object.values(g.cards).find((c) => c.defId === "dusk_zhunk")!;
    return { g, hawko: g.cards[hawko.instanceId], zhunk };
  }

  it("strikes an enemy summoned within its reach", () => {
    const { hawko, zhunk } = summonBeside(2);
    expect(zhunk.curHp).toBe(zhunk.maxHp - 1);
    expect(hawko.fxPassiveName).toBe("Aerial Dominance");
  });

  it("out of reach it does nothing, and no longer flashes its name as if it had", () => {
    const { hawko, zhunk } = summonBeside(3); // its own Home row: three rows off
    expect(zhunk.curHp).toBe(zhunk.maxHp);
    expect(hawko.fxPassive ?? 0).toBe(0);
  });
});

describe("arrivalStrike — the range a summon's arrival attack covers", () => {
  it("a card with no hostile arrival strike has none", () => {
    expect(arrivalStrike(prepState(), getDef("leaf_birch"), "P1", { row: 3, col: 0 } as Pos)).toBeNull();
  });

  it("DAWN's Awakening reaches the whole board and marks the NEAREST enemy", () => {
    const s = prepState();
    place(s, "dusk_gool", "P2", 0, 3);
    place(s, "dusk_gool", "P2", 1, 0);
    const a = arrivalStrike(s, getDef("dawn_glime"), "P1", { row: 3, col: 0 } as Pos)!;
    expect(a.says).toMatch(/nearest enemy/);
    expect(a.victims).toEqual([{ row: 1, col: 0 }]);
    expect(has(a.reach, 0, 3)).toBe(true);
    expect(has(a.reach, 3, 0)).toBe(false); // not its own square
  });

  it("reach is drawn even when nobody stands in it yet", () => {
    const s = prepState();
    const def = getDef("dawn_glime");
    const a = arrivalStrike(s, def, "P1", { row: 3, col: 1 } as Pos)!;
    expect(a.victims).toEqual([]);
    expect(a.reach.length).toBeGreaterThan(0);
  });

  it("answers for every card from every Home square, and a melee strike stays within its reach", () => {
    const s = prepState();
    place(s, "dusk_gool", "P2", 2, 1);
    place(s, "dusk_gool", "P2", 0, 2);
    for (const def of CARDS) {
      for (let col = 0; col < 4; col++) {
        const pos = { row: 3, col } as Pos;
        const a = arrivalStrike(s, def, "P1", pos);
        if (!a) continue;
        expect(a.says.length, def.id).toBeGreaterThan(0);
        const p = def.onSummon?.params ?? {};
        const plainMelee = !def.boss && def.element !== "DAWN" && def.attackType === "Melee"
          && !p.chargeFirst && !p.reachNearest && !p.onlyVsTarget && p.spread == null
          && !p.enemyHomeRow && !p.sameColumn && !p.reach;
        if (plainMelee)
          for (const q of a.reach)
            expect(Math.max(Math.abs(q.row - pos.row), Math.abs(q.col - pos.col)), def.id).toBeLessThanOrEqual(1);
      }
    }
  });

  it("never shades a square the summoner's own card stands on", () => {
    const s = prepState();
    place(s, "leaf_birch", "P1", 2, 0);
    const a = arrivalStrike(s, getDef("dawn_glime"), "P1", { row: 3, col: 0 } as Pos)!;
    expect(has(a.reach, 2, 0)).toBe(false);
  });
});

describe("Krakler — Abyssal Grasp skips a FROZEN target", () => {
  function summonKrakler(frozenNear: boolean, allFrozen = false) {
    const s = prepState(42, "P1");
    s.players.P1.gold = 9;
    const frozen = { kind: "FREEZE" as const, duration: 2, power: 0, source: "AQUA" as const };
    const near = place(s, "dusk_gool", "P2", 2, 0, frozenNear ? { status: frozen } : {});
    const far = place(s, "dusk_gool", "P2", 0, 3, allFrozen ? { status: frozen } : {});
    const handId = giveHand(s, "P1", "aqua_krakler");
    const g = applyIntent(s, { type: "SUMMON", player: "P1", handId, col: 0 });
    const scalded = (id: string) => g.cards[id].statuses.some((x) => x.kind === "SCALD");
    return { near: scalded(near.instanceId), far: scalded(far.instanceId) };
  }

  it("takes the nearest opponent when none is frozen", () => {
    expect(summonKrakler(false)).toEqual({ near: true, far: false });
  });

  it("passes over a frozen nearest opponent for the next one", () => {
    expect(summonKrakler(true)).toEqual({ near: false, far: true });
  });

  it("falls back to the nearest when every opponent is frozen", () => {
    expect(summonKrakler(true, true)).toEqual({ near: true, far: false });
  });
});

describe("Siren — Sea Terror bursts on every touching opponent", () => {
  it("SCALD 3 + FREEZE on each foe touching it as it becomes Krakler, nobody else", () => {
    const s = prepState();
    s.players.P1.magicPool = 6;
    const siren = place(s, "aqua_siren", "P1", 2, 1);
    const a = place(s, "dusk_gool", "P2", 1, 1, { curHp: 30, maxHp: 30 });
    const b = place(s, "dusk_gool", "P2", 1, 2, { curHp: 30, maxHp: 30 });
    const far = place(s, "dusk_gool", "P2", 0, 3, { curHp: 30, maxHp: 30 });
    s.phase = "battle"; s.prep = null;
    s.battle = { queue: [siren.instanceId], index: 0, awaitingInput: siren.instanceId };
    const g = applyIntent(s, { type: "BATTLE_ACTION", player: "P1", action: "special", targetId: siren.instanceId });
    expect(g.cards[siren.instanceId].defId).toBe("aqua_krakler");
    for (const id of [a.instanceId, b.instanceId]) {
      const st = g.cards[id].statuses;
      expect(st.find((x) => x.kind === "SCALD")?.power, id).toBe(3);
      expect(st.some((x) => x.kind === "FREEZE"), id).toBe(true);
    }
    expect(g.cards[far.instanceId].statuses).toEqual([]);
  });
});

describe("Polar King — Polar Shift shields the side", () => {
  it("FREEZEs up to 3 opponents and gives every ally (itself included) +3 shields", () => {
    const s = prepState();
    s.players.P1.magicPool = 6;
    const king = place(s, "aqua_polarking", "P1", 3, 0);
    const ally = place(s, "leaf_birch", "P1", 2, 2);
    const foes = [[1, 0], [1, 1], [1, 2], [1, 3]].map(([r, c]) => place(s, "dusk_gool", "P2", r, c));
    const kingSh = king.curShields, allySh = ally.curShields;
    s.phase = "battle"; s.prep = null;
    s.battle = { queue: [king.instanceId], index: 0, awaitingInput: king.instanceId };
    const g = applyIntent(s, { type: "BATTLE_ACTION", player: "P1", action: "special", targetId: foes[0].instanceId });
    expect(g.cards[king.instanceId].curShields).toBe(kingSh + 3);
    expect(g.cards[ally.instanceId].curShields).toBe(allySh + 3);
    const frozen = foes.filter((f) => g.cards[f.instanceId].statuses.some((x) => x.kind === "FREEZE")).length;
    expect(frozen).toBe(3);
  });
});

describe("Glacius — Ice Armor", () => {
  function setup() {
    const s = prepState();
    const gl = place(s, "aqua_glacius", "P1", 2, 1);
    const ally = place(s, "leaf_birch", "P1", 2, 2);
    const foe = place(s, "dusk_gool", "P2", 1, 1, { curHp: 30, maxHp: 30 });
    s.phase = "battle"; s.prep = null;
    s.battle = { queue: [gl.instanceId], index: 0, awaitingInput: gl.instanceId };
    return { s, gl, ally, foe };
  }

  it("aimed at an ally, it gives +2 shields and nothing else — no damage, no FREEZE", () => {
    const { s, gl, ally } = setup();
    const before = { hp: ally.curHp, sh: ally.curShields };
    const g = applyIntent(s, { type: "BATTLE_ACTION", player: "P1", action: "basic", targetIds: [ally.instanceId] });
    const a = g.cards[ally.instanceId];
    expect(a.curHp).toBe(before.hp);
    expect(a.curShields).toBe(before.sh + 2);
    expect(a.statuses.some((x) => x.kind === "FREEZE"), "the ally is NOT frozen (owner, 2026-10-03)").toBe(false);
    expect(a.statuses).toHaveLength(0);
    expect(g.cards[gl.instanceId]).toBeDefined();
  });

  it("allies are offered to the player only — never in validTargets, so the AI and Auto never pick them", () => {
    const { s, gl, ally } = setup();
    expect(validTargets(s, gl.instanceId).some((t) => t.instanceId === ally.instanceId)).toBe(false);
    expect(allyShieldTargets(s, gl.instanceId).map((t) => t.instanceId)).toContain(ally.instanceId);
    expect(allyShieldTargets(s, gl.instanceId).some((t) => t.instanceId === gl.instanceId)).toBe(false);
  });

  it("still attacks an enemy normally", () => {
    const { s, foe } = setup();
    const g = applyIntent(s, { type: "BATTLE_ACTION", player: "P1", action: "basic", targetIds: [foe.instanceId] });
    expect(g.cards[foe.instanceId].curHp).toBeLessThan(30);
  });
});

describe("BlackIce — Avalanche shields allies nearby", () => {
  it("strikes the row ahead and gives +3 shields to allies touching it, not to far ones or itself", () => {
    const s = prepState();
    s.players.P1.magicPool = 6;
    const bi = place(s, "aqua_blackice", "P1", 2, 1);
    const near = place(s, "leaf_birch", "P1", 3, 1);
    const far = place(s, "leaf_birch", "P1", 3, 3);
    const foe = place(s, "dusk_gool", "P2", 1, 1, { curHp: 30, maxHp: 30, curShields: 0 });
    const sh = { bi: bi.curShields, near: near.curShields, far: far.curShields };
    s.phase = "battle"; s.prep = null;
    s.battle = { queue: [bi.instanceId], index: 0, awaitingInput: bi.instanceId };
    const g = applyIntent(s, { type: "BATTLE_ACTION", player: "P1", action: "special", targetId: foe.instanceId });
    expect(g.cards[foe.instanceId].curHp).toBeLessThan(30);
    expect(g.cards[near.instanceId].curShields).toBe(sh.near + 3);
    expect(g.cards[far.instanceId].curShields).toBe(sh.far);
  });
});

describe("Killer Whale — Tidal Crush reaches the whole row and the row behind", () => {
  function cast(foes: [number, number][]) {
    const s = prepState();
    s.players.P1.magicPool = 9;
    const kw = place(s, "aqua_killerwhale", "P1", 3, 1);
    const fs = foes.map(([r, c]) => place(s, "dusk_gool", "P2", r, c, { curHp: 30, maxHp: 30, curShields: 0 }));
    s.phase = "battle"; s.prep = null;
    s.battle = { queue: [kw.instanceId], index: 0, awaitingInput: kw.instanceId };
    const ok = canFireSpecial(s, kw.instanceId).ok;
    const g = ok ? applyIntent(s, { type: "BATTLE_ACTION", player: "P1", action: "special" }) : s;
    return { ok, hp: fs.map((f) => g.cards[f.instanceId]?.curHp) };
  }

  it("hits an opponent two squares along the row ahead, not only the adjacent ones", () => {
    const r = cast([[2, 1], [2, 3]]);
    expect(r.ok).toBe(true);
    expect(r.hp[0]).toBeLessThan(30);
    expect(r.hp[1]).toBeLessThan(30);
  });

  it("can be cast with nobody beside it, for a foe two squares along the row", () => {
    const r = cast([[2, 3]]);
    expect(r.ok).toBe(true);
    expect(r.hp[0]).toBeLessThan(30);
  });

  it("can be cast when only the row behind holds anyone, and that row takes the wave", () => {
    const r = cast([[1, 1]]);
    expect(r.ok).toBe(true);
    expect(r.hp[0]).toBe(27); // the far row's 3 DMG
  });
});
