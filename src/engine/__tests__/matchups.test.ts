// Element matchups (matchups.ts) — the eight cross-element rules. The DAWN↔DUSK
// damage swing also has live coverage in the WarPhant / Star Shower / Bird Bomb
// / Shine tests, which assert the +25% through real attacks; this file pins the
// rules themselves plus the paths those don't reach.

import { describe, expect, it } from "vitest";
import { applyStatus, basicAttack, defeatCard } from "../combat";
import { boardCards, effectiveDmg, healCard } from "../state";
import { getDef } from "../../data/cards";
import {
  LEAF_WATER_HEAL,
  applyMatchupDamage,
  dodgesByMatchup,
  matchupStatusDuration,
} from "../matchups";
import { place, prepState, statusOf } from "./helpers";

describe("element matchups — the damage swing", () => {
  it("DAWN and DUSK each hit the other 25% harder", () => {
    expect(applyMatchupDamage("DAWN", "DUSK", 4)).toBe(5);
    expect(applyMatchupDamage("DUSK", "DAWN", 4)).toBe(5);
    expect(applyMatchupDamage("DAWN", "DUSK", 10)).toBe(12);
    expect(applyMatchupDamage("DUSK", "DAWN", 8)).toBe(10);
  });

  it("floors the bonus, so a small hit is never inflated", () => {
    // The reason this is floored rather than rounded: Math.round(2 * 1.25) is 3,
    // a 50% swing — and a 3-hit volley would compound that into +50% on the
    // whole attack. Under 4 DMG the matchup simply doesn't bite.
    expect(applyMatchupDamage("DAWN", "DUSK", 1)).toBe(1);
    expect(applyMatchupDamage("DAWN", "DUSK", 2)).toBe(2);
    expect(applyMatchupDamage("DAWN", "DUSK", 3)).toBe(3);
  });

  it("leaves every other pairing alone", () => {
    expect(applyMatchupDamage("DAWN", "DAWN", 8)).toBe(8);
    expect(applyMatchupDamage("LEAF", "PYRO", 8)).toBe(8);
    expect(applyMatchupDamage("BOLT", "GALE", 8)).toBe(8);
    expect(applyMatchupDamage("DAWN", "DUSK", 0)).toBe(0);
  });
});

describe("element matchups — status resistance", () => {
  it("AQUA halves BURN, rounding up so it still lands", () => {
    expect(matchupStatusDuration("AQUA", "BURN", 4)).toBe(2);
    expect(matchupStatusDuration("AQUA", "BURN", 3)).toBe(2);
    expect(matchupStatusDuration("AQUA", "BURN", 1)).toBe(1);
  });

  it("BORE earths ELECTRIFIED and PARALYZE", () => {
    expect(matchupStatusDuration("BORE", "ELECTRIFIED", 4)).toBe(2);
    expect(matchupStatusDuration("BORE", "PARALYZE", 3)).toBe(2);
    // ...and nothing else.
    expect(matchupStatusDuration("BORE", "BURN", 4)).toBe(4);
  });

  it("GALE sheds ELECTRIFIED a round early, never to nothing", () => {
    expect(matchupStatusDuration("GALE", "ELECTRIFIED", 3)).toBe(2);
    expect(matchupStatusDuration("GALE", "ELECTRIFIED", 1)).toBe(1);
    expect(matchupStatusDuration("GALE", "PARALYZE", 3)).toBe(3);
  });

  it("resistance is real through applyStatus, not just the helper", () => {
    const s = prepState();
    const aqua = place(s, "aqua_piranha", "P1", 2, 0);
    const other = place(s, "leaf_hunter", "P1", 2, 1);
    applyStatus(s, aqua, "BURN", 4, 2, "PYRO");
    applyStatus(s, other, "BURN", 4, 2, "PYRO");
    expect(statusOf(s.cards[aqua.instanceId], "BURN")?.duration).toBe(2); // quenched
    expect(statusOf(s.cards[other.instanceId], "BURN")?.duration).toBe(4); // full
  });
});

describe("element matchups — GALE's dodge vs BORE", () => {
  it("is 20% against BORE and nothing against anyone else", () => {
    expect(dodgesByMatchup("BORE", "GALE")).toBe(20);
    expect(dodgesByMatchup("GALE", "BORE")).toBe(0); // one-directional
    expect(dodgesByMatchup("PYRO", "GALE")).toBe(0);
  });
});

describe("element matchups — healing", () => {
  it("a BURNing card heals at 75%", () => {
    const s = prepState();
    const c = place(s, "leaf_hunter", "P1", 2, 0, { curHp: 5, maxHp: 40 });
    expect(healCard(s, c, 8)).toBe(8); // clean
    applyStatus(s, c, "BURN", 3, 2, "PYRO");
    expect(healCard(s, c, 8)).toBe(6); // floor(8 * 0.75)
  });

  it("never taxes a heal down to nothing", () => {
    const s = prepState();
    const c = place(s, "leaf_hunter", "P1", 2, 0, { curHp: 5, maxHp: 40 });
    applyStatus(s, c, "BURN", 3, 2, "PYRO");
    expect(healCard(s, c, 1)).toBe(1); // floor would be 0 — clamped to 1
  });

  it("LEAF drinks in an AQUA attack (Well Watered)", () => {
    const s = prepState();
    // Attacker in ITS home row (P2 = row 0) so no King-of-the-Hill bonus muddies
    // the arithmetic; the LEAF target sits one row up, inside melee reach.
    const atk = place(s, "aqua_piranha", "P2", 0, 0);
    const tgt = place(s, "leaf_hunter", "P1", 1, 0, { curHp: 30, maxHp: 40, curShields: 0 });
    const hits = getDef("aqua_piranha").hits ?? 1;
    const dmg = effectiveDmg(s, s.cards[atk.instanceId]);
    basicAttack(s, atk.instanceId, tgt.instanceId);
    // Every landed hit deals its damage and then waters the plant back 1.
    expect(s.cards[tgt.instanceId].curHp).toBe(30 - dmg * hits + LEAF_WATER_HEAL * hits);
  });

  it("...but a killing blow doesn't water a corpse back up", () => {
    const s = prepState();
    const atk = place(s, "aqua_piranha", "P2", 0, 0);
    const tgt = place(s, "leaf_hunter", "P1", 1, 0, { curHp: 1, maxHp: 40, curShields: 0 });
    basicAttack(s, atk.instanceId, tgt.instanceId);
    expect(s.cards[tgt.instanceId]).toBeUndefined();
  });
});

describe("Kore's Meltdown", () => {
  it("dies into a Static Wisp on its owner's side", () => {
    const s = prepState();
    const kore = place(s, "bolt_kore", "P1", 2, 0, { curHp: 3, curShields: 0 });
    place(s, "dusk_gool", "P2", 0, 3); // someone for the board to be legal
    defeatCard(s, kore, "test");
    const wisps = boardCards(s, "P1").filter((c) => c.defId === "bolt_static_wisp_tok");
    expect(wisps).toHaveLength(1);
    expect(wisps[0].curHp).toBe(getDef("bolt_static_wisp_tok").hp);
  });

  it("leaves the WISP, not the full Static Cloud card", () => {
    // Meltdown used to spawn bolt_staticcloud — a real cost-2 rare with double
    // the body and double the discharge. Pinning the weakened token here so a
    // future edit can't quietly hand a cost-5 epic a whole extra card again.
    const wisp = getDef("bolt_static_wisp_tok");
    const cloud = getDef("bolt_staticcloud");
    expect(wisp.hp).toBeLessThan(cloud.hp);
    expect(wisp.roundTick?.randomEnemyDmg).toBeLessThan(cloud.roundTick!.randomEnemyDmg!);
    expect(wisp.roundTick?.randomEnemyStatus?.duration)
      .toBeLessThan(cloud.roundTick!.randomEnemyStatus!.duration);
  });
});
