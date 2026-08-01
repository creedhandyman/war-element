// Element matchups (matchups.ts) — the eight cross-element rules. The DAWN↔DUSK
// damage swing also has live coverage in the WarPhant / Star Shower / Bird Bomb
// / Shine tests, which assert the +25% through real attacks; this file pins the
// rules themselves plus the paths those don't reach.

import { describe, expect, it } from "vitest";
import { applyStatus, basicAttack, defeatCard, directDamage, shieldsBrokenBy, SPECIAL_HANDLERS } from "../combat";
import { advance, applyIntent } from "../phases";
import { boardCards, effectiveDmg, healCard } from "../state";
import { getDef } from "../../data/cards";
import {
  LEAF_WATER_HEAL,
  applyMatchupDamage,
  dodgesByMatchup,
  matchupStatusDuration,
} from "../matchups";
import { atCleanup, place, prepState, statusOf } from "./helpers";

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

describe("Exostone (BORE): stone chips one plate at a time", () => {
  it("a heavy hit takes ONE shield off a BORE card, not two or three", () => {
    const s = prepState();
    // 25 damage would break 3 shields off anyone else (shieldsBrokenBy: 1 / 2 at
    // 10+ / 3 at 21+) — which fell hardest on the element made of shields.
    expect(shieldsBrokenBy(25)).toBe(3);
    const bore = place(s, "bore_armadillo", "P1", 2, 0, { curHp: 60, maxHp: 60, curShields: 5 });
    const foe = place(s, "dusk_gool", "P2", 2, 1, { curHp: 40, maxHp: 40 });
    directDamage(s, s.cards[foe.instanceId], s.cards[bore.instanceId], 25, false);
    expect(s.cards[bore.instanceId].curShields).toBe(4);
  });

  it("...while a non-BORE card still loses the full sliding-scale amount", () => {
    const s = prepState();
    const other = place(s, "leaf_hunter", "P1", 2, 0, { curHp: 60, maxHp: 60, curShields: 5 });
    const foe = place(s, "dusk_gool", "P2", 2, 1, { curHp: 40, maxHp: 40 });
    directDamage(s, s.cards[foe.instanceId], s.cards[other.instanceId], 25, false);
    expect(s.cards[other.instanceId].curShields).toBe(5 - shieldsBrokenBy(25));
  });

  it("a small hit is unchanged — it only ever took one anyway", () => {
    const s = prepState();
    const bore = place(s, "bore_armadillo", "P1", 2, 0, { curHp: 60, maxHp: 60, curShields: 5 });
    const foe = place(s, "dusk_gool", "P2", 2, 1, { curHp: 40, maxHp: 40 });
    directDamage(s, s.cards[foe.instanceId], s.cards[bore.instanceId], 3, false);
    expect(s.cards[bore.instanceId].curShields).toBe(4);
  });
});

describe("Exostone (BORE): the stone takes what it breaks", () => {
  it("gains a shield when its attack breaks one off an opponent", () => {
    const s = prepState();
    const bore = place(s, "bore_armadillo", "P1", 2, 0, { curShields: 2 });
    const foe = place(s, "dusk_gool", "P2", 2, 1, { curHp: 40, maxHp: 40, curShields: 3 });
    basicAttack(s, bore.instanceId, foe.instanceId);
    expect(s.cards[foe.instanceId].curShields).toBe(2); // the gate's usual strip
    expect(s.cards[bore.instanceId].curShields).toBe(3); // ...worn by the attacker
  });

  it("takes nothing off an unarmoured target — it loots breaks, not bodies", () => {
    const s = prepState();
    const bore = place(s, "bore_armadillo", "P1", 2, 0, { curShields: 2 });
    const bare = place(s, "dusk_gool", "P2", 2, 1, { curHp: 40, maxHp: 40, curShields: 0 });
    basicAttack(s, bore.instanceId, bare.instanceId);
    expect(s.cards[bore.instanceId].curShields).toBe(2);
  });

  it("costs the target no MORE than it always did", () => {
    // The gain rides the break the shield gate was already making; it does not
    // pry off an extra plate. A non-BORE attacker is the control.
    const s = prepState();
    const bore = place(s, "bore_armadillo", "P1", 2, 0, { curShields: 0 });
    const other = place(s, "leaf_hunter", "P1", 3, 0, { curShields: 0 });
    const a = place(s, "dusk_gool", "P2", 2, 1, { curHp: 40, maxHp: 40, curShields: 4 });
    const b = place(s, "dusk_gool", "P2", 3, 1, { curHp: 40, maxHp: 40, curShields: 4 });
    basicAttack(s, bore.instanceId, a.instanceId);
    basicAttack(s, other.instanceId, b.instanceId);
    expect(s.cards[a.instanceId].curShields).toBe(s.cards[b.instanceId].curShields);
  });
});

describe("Photosynthesis feeds on the roots", () => {
  it("heals +1 per ROOTed opponent on top of its base +2", () => {
    const s = prepState();
    const leaf = place(s, "leaf_alpha", "P1", 3, 0, { curHp: 5, maxHp: 40, curShields: 0 });
    const a = place(s, "dusk_gool", "P2", 1, 0, { curHp: 30, maxHp: 30 });
    const b = place(s, "dusk_gool", "P2", 1, 1, { curHp: 30, maxHp: 30 });
    place(s, "dusk_gool", "P2", 1, 2, { curHp: 30, maxHp: 30 }); // left free
    applyStatus(s, a, "ROOT", 3, 0, "LEAF");
    applyStatus(s, b, "ROOT", 3, 0, "LEAF");
    const n = advance(atCleanup(s));
    expect(n.cards[leaf.instanceId].curHp).toBe(5 + 2 + 2); // base 2, +1 per rooted foe
  });

  it("...and only counts OPPONENTS, not rooted allies", () => {
    const s = prepState();
    const leaf = place(s, "leaf_alpha", "P1", 3, 0, { curHp: 5, maxHp: 40, curShields: 0 });
    const ally = place(s, "leaf_hunter", "P1", 3, 1, { curHp: 20, maxHp: 20 });
    place(s, "dusk_gool", "P2", 1, 0, { curHp: 30, maxHp: 30 });
    applyStatus(s, ally, "ROOT", 3, 0, "DUSK");
    const n = advance(atCleanup(s));
    expect(n.cards[leaf.instanceId].curHp).toBe(5 + 2); // base only
  });
});

describe("Gemaga's Magnetic Shield", () => {
  it("plates every ally in range, not just the row ahead", () => {
    // Fired end-to-end so rules.ts supplies the targets — the point of the
    // change is that reach now comes from the normal ally-AOE path instead of a
    // hardcoded rowAhead sweep, which missed allies beside and behind Gemaga.
    const s = prepState();
    s.players.P1.magicPool = 4;
    const gem = place(s, "bore_gemaga", "P1", 3, 1);
    const beside = place(s, "bore_armadillo", "P1", 3, 0); // same row — was missed before
    const ahead = place(s, "bore_valcana", "P1", 2, 1); // row directly ahead
    place(s, "dusk_gool", "P2", 0, 0);
    s.phase = "battle";
    s.prep = null;
    s.battle = { queue: [gem.instanceId], index: 0, awaitingInput: gem.instanceId };
    const next = applyIntent(s, { type: "BATTLE_ACTION", player: "P1", action: "special" });
    for (const id of [beside.instanceId, ahead.instanceId]) {
      expect(next.cards[id].reflectPower).toBe(1);
      expect(next.cards[id].reflectRoundsLeft).toBe(2);
    }
  });

  it("the granted REFLECT actually bounces damage back", () => {
    const s = prepState();
    const ally = place(s, "bore_armadillo", "P1", 2, 0, { curHp: 20, maxHp: 20, curShields: 0 });
    const foe = place(s, "dusk_gool", "P2", 1, 0, { curHp: 30, maxHp: 30, curShields: 0 });
    ally.reflectPower = 1;
    ally.reflectRoundsLeft = 2;
    basicAttack(s, foe.instanceId, ally.instanceId);
    expect(30 - s.cards[foe.instanceId].curHp).toBe(1); // bitten back
  });
});

describe("Score's Toxic Contagion — the death burst", () => {
  /** Infect `victim` with Score's Special, straight through the handler. */
  function infect(s: ReturnType<typeof prepState>, score: { instanceId: string }, victim: { instanceId: string }) {
    SPECIAL_HANDLERS.toxicContagion(s, s.cards[score.instanceId], [s.cards[victim.instanceId]], {
      sleep: 1, dotDuration: 2, dotPower: 3, deathSplash: 3,
    });
  }

  it("bursts for 3 onto the victim's OWN neighbours when it dies poisoned", () => {
    const s = prepState();
    const score = place(s, "bore_score", "P1", 3, 0);
    const victim = place(s, "dusk_gool", "P2", 1, 1, { curHp: 5, maxHp: 20, curShields: 0 });
    const neighbour = place(s, "dusk_vamp", "P2", 1, 2, { curHp: 20, maxHp: 20, curShields: 0 });
    const ally = place(s, "bore_armadillo", "P1", 2, 1, { curHp: 20, maxHp: 20, curShields: 0 });
    infect(s, score, victim);
    defeatCard(s, s.cards[victim.instanceId], "test");
    // The splash spreads through the victim's own ranks...
    expect(20 - s.cards[neighbour.instanceId].curHp).toBe(3);
    // ...and never back onto the caster's side, even standing adjacent.
    expect(s.cards[ally.instanceId].curHp).toBe(20);
  });

  it("stays quiet when the poison has already worn off", () => {
    const s = prepState();
    const score = place(s, "bore_score", "P1", 3, 0);
    const victim = place(s, "dusk_gool", "P2", 1, 1, { curHp: 5, maxHp: 20, curShields: 0 });
    const neighbour = place(s, "dusk_vamp", "P2", 1, 2, { curHp: 20, maxHp: 20, curShields: 0 });
    infect(s, score, victim);
    // Outlived the DOT — "dies while affected" is the whole gate.
    s.cards[victim.instanceId].statuses = [];
    defeatCard(s, s.cards[victim.instanceId], "test");
    expect(s.cards[neighbour.instanceId].curHp).toBe(20);
  });

  it("still bursts when the poison itself lands the kill", () => {
    // Armed at the death choke-point rather than on the cast, so it pays out
    // however the body finally drops — here, the DOT tick at Cleanup.
    const s = prepState();
    const score = place(s, "bore_score", "P1", 3, 0);
    const victim = place(s, "dusk_gool", "P2", 1, 1, { curHp: 2, maxHp: 20, curShields: 0 });
    const neighbour = place(s, "dusk_vamp", "P2", 1, 2, { curHp: 20, maxHp: 20, curShields: 0 });
    infect(s, score, victim);
    const next = advance(atCleanup(s));
    expect(next.cards[victim.instanceId]).toBeUndefined(); // poisoned to death
    expect(20 - next.cards[neighbour.instanceId].curHp).toBe(3);
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
