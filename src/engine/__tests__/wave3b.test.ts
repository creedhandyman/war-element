import { describe, expect, it } from "vitest";
import { advance, applyIntent } from "../phases";
import { basicAttack, directDamage } from "../combat";
import { canFireSpecial, canSpellHitEnemy, canTarget } from "../rules";
import { boardCards, effectiveDmg, effectiveSp, spawnTokens } from "../state";
import { atCleanup, giveHand, place, prepState, statusOf } from "./helpers";
import { getDef } from "../../data/cards";
import type { GameState, Pos } from "../types";

function battleWith(s: GameState, activeId: string): GameState {
  s.phase = "battle";
  s.prep = null;
  s.battle = { queue: [activeId], index: 0, awaitingInput: activeId };
  return s;
}

describe("Magalogoon", () => {
  it("Swamp Monster hides it while still, and MOVING gives it up", () => {
    const s = prepState();
    const mag = place(s, "aqua_magalogoon", "P1", 2, 0);
    const foe = place(s, "dusk_gool", "P2", 1, 0, { curHp: 20, maxHp: 20 });
    expect(canTarget(s, s.cards[foe.instanceId], s.cards[mag.instanceId])).toBe(false);
    // The plain STEALTH keyword breaks on attacking; this one also breaks on
    // moving, which is the whole difference.
    s.cards[mag.instanceId].movedThisRound = true;
    expect(canTarget(s, s.cards[foe.instanceId], s.cards[mag.instanceId])).toBe(true);
  });

  it("...and a round spent still re-buries it", () => {
    const s = prepState();
    const mag = place(s, "aqua_magalogoon", "P1", 2, 0, { movedThisRound: true });
    const foe = place(s, "dusk_gool", "P2", 1, 0, { curHp: 20, maxHp: 20 });
    expect(canTarget(s, s.cards[foe.instanceId], s.cards[mag.instanceId])).toBe(true);
    const next = advance(atCleanup(s));
    expect(next.cards[mag.instanceId].movedThisRound).toBe(false);
    expect(canTarget(next, next.cards[foe.instanceId], next.cards[mag.instanceId])).toBe(false);
  });

  it("a real MOVE sets the flag (not just the test poking it)", () => {
    const s = prepState();
    const mag = place(s, "aqua_magalogoon", "P1", 3, 0);
    const next = applyIntent(s, {
      type: "MOVE", player: "P1", instanceId: mag.instanceId, to: { row: 2, col: 0 } as Pos,
    });
    expect(next.cards[mag.instanceId].movedThisRound).toBe(true);
  });

  it("stealth breaks EVERYWHERE once it moves — not just for attacks", () => {
    // The bug: two of the three stealth call sites ignored movedThisRound, so a
    // moved Magalogoon was still un-spell-targetable and un-corridor-hittable —
    // stealthed "all the time" from those angles. All three read one predicate
    // now, so a spell can hit it the instant it moves.
    const s = prepState();
    const mag = place(s, "aqua_magalogoon", "P1", 2, 0);
    expect(canSpellHitEnemy(s, "P2", s.cards[mag.instanceId])).toBe(false); // buried
    s.cards[mag.instanceId].movedThisRound = true;
    expect(canSpellHitEnemy(s, "P2", s.cards[mag.instanceId])).toBe(true); // surfaced
  });

  it("carries no STEALTH keyword — the hiding is purely the passive", () => {
    expect(getDef("aqua_magalogoon").keywords.STEALTH).toBeUndefined();
    expect(getDef("aqua_magalogoon").stealthWhenIdle).toBe(true);
  });

  it("Bog Ambush drags the target into Magalogoon's row, hits for 8, and blinds it", () => {
    const s = prepState();
    s.players.P1.magicPool = 9;
    const mag = place(s, "aqua_magalogoon", "P1", 2, 0);
    const foe = place(s, "dusk_gool", "P2", 1, 1, { curHp: 40, maxHp: 40, curShields: 0 });
    const next = applyIntent(battleWith(s, mag.instanceId), {
      type: "BATTLE_ACTION", player: "P1", action: "special", targetId: foe.instanceId,
    });
    const hit = next.cards[foe.instanceId];
    expect(hit.pos?.row).toBe(2); // hauled into the bog
    expect(hit.curHp).toBe(40 - 8);
    expect(hit.accuracyDebuffRounds).toBe(2);
    // Flat, untagged: it must NOT show up as a status (nothing cleanses it).
    expect(hit.statuses.length).toBe(0);
  });

  it("the murk actually makes basics whiff, and expires", () => {
    // Measured over many swings: a 25% miss chance has to move the landed count
    // off 100%, or the debuff is decorative.
    const s = prepState();
    const attacker = place(s, "dusk_gool", "P2", 1, 0, { accuracyDebuffRounds: 2 });
    let landed = 0;
    for (let i = 0; i < 200; i++) {
      const foe = place(s, "leaf_greegon", "P2", 2, 2, { curHp: 999, maxHp: 999, curShields: 0 });
      foe.owner = "P1";
      const before = foe.curHp;
      basicAttack(s, attacker.instanceId, foe.instanceId);
      if (foe.curHp < before) landed++;
      s.cards[attacker.instanceId].attackedThisRound = false;
      s.cards[attacker.instanceId].struckThisRound = {};
      delete s.cards[foe.instanceId];
    }
    expect(landed).toBeGreaterThan(100); // most land…
    expect(landed).toBeLessThan(200); // …but not all
  });

  it("the murk counts down each Cleanup", () => {
    const s = prepState();
    const c = place(s, "dusk_gool", "P1", 2, 0, { accuracyDebuffRounds: 2 });
    expect(advance(atCleanup(s)).cards[c.instanceId].accuracyDebuffRounds).toBe(1);
  });
});

describe("Keeper", () => {
  it("arrives with two Beebots, and Hive Command makes them worth having", () => {
    const s = prepState();
    s.players.P1.gold = 20;
    s.players.P1.hand = [{ handId: "h1", defId: "bolt_keeper" }];
    const next = applyIntent(s, { type: "SUMMON", player: "P1", handId: "h1", col: 0 });
    const bots = boardCards(next, "P1").filter((c) => c.defId === "bolt_beebot");
    expect(bots).toHaveLength(2);
    // Delta, not an absolute: whether the spawn slot is a Mid row (King of the
    // Hill, +1) is not what this test is about.
    const withKeeper = effectiveDmg(next, bots[0]);
    const keeper = boardCards(next, "P1").find((c) => c.defId === "bolt_keeper")!;
    delete next.cards[keeper.instanceId];
    expect(withKeeper - effectiveDmg(next, bots[0])).toBe(3); // Hive Command
  });

  it("Hive Mind puts half of Keeper's incoming damage into the swarm", () => {
    const s = prepState();
    const keep = place(s, "bolt_keeper", "P1", 3, 0, { curHp: 17, maxHp: 17, curShields: 0 });
    const bot = place(s, "bolt_beebot", "P1", 3, 1, { curHp: 3, maxHp: 3 });
    const hitter = place(s, "dusk_gool", "P2", 3, 2, { curHp: 30, maxHp: 30 });
    directDamage(s, s.cards[hitter.instanceId], s.cards[keep.instanceId], 6, true);
    // 50% of 6 = 3, and the Beebot has exactly 3 to give.
    expect(s.cards[bot.instanceId]?.curHp ?? 0).toBeLessThanOrEqual(0);
    expect(s.cards[keep.instanceId].curHp).toBe(17 - 3);
  });

  it("...and only as far as the swarm's own HP stretches", () => {
    // A 3 HP Beebot cannot eat 10. The overflow must land on Keeper, not vanish.
    const s = prepState();
    const keep = place(s, "bolt_keeper", "P1", 3, 0, { curHp: 17, maxHp: 17, curShields: 0 });
    place(s, "bolt_beebot", "P1", 3, 1, { curHp: 3, maxHp: 3 });
    const hitter = place(s, "dusk_gool", "P2", 3, 2, { curHp: 30, maxHp: 30 });
    directDamage(s, s.cards[hitter.instanceId], s.cards[keep.instanceId], 20, true);
    expect(s.cards[keep.instanceId]?.curHp ?? 0).toBe(17 - 17); // 20 − 3 absorbed
  });

  it("with no swarm alive Keeper eats it all", () => {
    const s = prepState();
    const keep = place(s, "bolt_keeper", "P1", 3, 0, { curHp: 17, maxHp: 17, curShields: 0 });
    const hitter = place(s, "dusk_gool", "P2", 3, 2, { curHp: 30, maxHp: 30 });
    directDamage(s, s.cards[hitter.instanceId], s.cards[keep.instanceId], 6, true);
    expect(s.cards[keep.instanceId].curHp).toBe(17 - 6);
  });

  it("Storm Swarm raises one Beebot per statused opponent and they all sting", () => {
    const s = prepState();
    s.players.P1.magicPool = 9;
    const keep = place(s, "bolt_keeper", "P1", 3, 0);
    const a = place(s, "dusk_gool", "P2", 2, 0, { curHp: 40, maxHp: 40, curShields: 0 });
    const b = place(s, "dusk_gool", "P2", 2, 1, { curHp: 40, maxHp: 40, curShields: 0 });
    a.statuses = [{ kind: "ELECTRIFIED", duration: 2, power: 0, source: "BOLT" }];
    b.statuses = [{ kind: "ELECTRIFIED", duration: 2, power: 0, source: "BOLT" }];
    const next = applyIntent(battleWith(s, keep.instanceId), {
      type: "BATTLE_ACTION", player: "P1", action: "special", targetId: a.instanceId,
    });
    expect(boardCards(next, "P1").filter((c) => c.defId === "bolt_beebot")).toHaveLength(2);
    // ...and the swarm actually attacked, rather than just being raised.
    const dealt = 40 - next.cards[a.instanceId].curHp + (40 - next.cards[b.instanceId].curHp);
    expect(dealt).toBeGreaterThan(0);
  });
});

describe("Prism", () => {
  const arm = (s: GameState, id: string, mode: "sharpen" | "burning" | "freezing" | "sleeping") =>
    applyIntent(battleWith(s, id), { type: "BATTLE_ACTION", player: "P1", action: "special", mode });

  it("Elemental Fury means the first Enchantment is free", () => {
    const s = prepState();
    s.players.P1.gold = 20;
    s.players.P1.magicPool = 0; // cannot pay for it
    s.players.P1.hand = [{ handId: "h1", defId: "bore_prism" }];
    const next = applyIntent(s, { type: "SUMMON", player: "P1", handId: "h1", col: 0 });
    const prism = boardCards(next, "P1").find((c) => c.defId === "bore_prism")!;
    expect(prism.freeSpecial).toBe(true);
  });

  it("...and the charge is usable the SAME turn it lands, past the summon lockout", () => {
    // The reported bug: freeSpecial was set on summon, but the summon-turn
    // lockout (checked first) blocked ALL specials, so "arrives charged" could
    // not actually be used until next round. Now the Fury charge bypasses it —
    // and ONLY the Fury charge (an ordinary summoned card stays locked out).
    const s = prepState();
    const prism = place(s, "bore_prism", "P1", 2, 0, { freeSpecial: true, summonedThisRound: true });
    s.players.P1.magicPool = 0;
    expect(canFireSpecial(battleWith(s, prism.instanceId), prism.instanceId).ok).toBe(true);
    const armed = applyIntent(battleWith(s, prism.instanceId), {
      type: "BATTLE_ACTION", player: "P1", action: "special", mode: "sharpen",
    });
    expect(armed.cards[prism.instanceId].enchant).toBe("sharpen");
    expect(armed.cards[prism.instanceId].freeSpecial).toBe(false); // charge spent

    // Control: a normal card summoned this round is still locked out of its Special.
    const ctrl = prepState();
    const oak = place(ctrl, "leaf_oakgre", "P1", 3, 0, { summonedThisRound: true });
    ctrl.players.P1.magicPool = 20;
    expect(canFireSpecial(battleWith(ctrl, oak.instanceId), oak.instanceId).ok).toBe(false);
  });

  it("Sharpen: cast-and-strike lands base+5 at once, then the next swing is ordinary", () => {
    const s = prepState();
    s.players.P1.magicPool = 9;
    const p = place(s, "bore_prism", "P1", 2, 0);
    const foe = place(s, "dusk_gool", "P2", 2, 1, { curHp: 90, maxHp: 90, curShields: 0 });
    const base = effectiveDmg(s, p);
    const armed = arm(s, p.instanceId, "sharpen"); // foe in range → strikes immediately
    expect(90 - armed.cards[foe.instanceId].curHp).toBe(base + 5);
    expect(armed.cards[p.instanceId].enchant).toBeUndefined(); // spent by the auto-strike
    // A later swing is ordinary again.
    armed.cards[p.instanceId].struckThisRound = {};
    const mid = armed.cards[foe.instanceId].curHp;
    basicAttack(armed, p.instanceId, foe.instanceId);
    expect(mid - armed.cards[foe.instanceId].curHp).toBe(base);
  });

  it("stores the charge when NO opponent is in range, then spends it on the next basic", () => {
    // Prism is melee; a foe two rows away is out of reach, so cast-and-strike
    // banks the enchant instead of wasting it. A later basic spends it.
    const s = prepState();
    s.players.P1.magicPool = 9;
    const p = place(s, "bore_prism", "P1", 3, 0); // home row
    const far = place(s, "dusk_gool", "P2", 0, 3, { curHp: 90, maxHp: 90, curShields: 0 }); // far
    const armed = arm(s, p.instanceId, "sharpen");
    expect(armed.cards[p.instanceId].enchant).toBe("sharpen"); // stored, not spent
    expect(armed.cards[far.instanceId].curHp).toBe(90); // nobody was hit
    // now put a foe in reach and swing — the stored Sharpen rides it
    const near = place(armed, "dusk_gool", "P2", 2, 0, { curHp: 90, maxHp: 90, curShields: 0 });
    const base = effectiveDmg(armed, armed.cards[p.instanceId]);
    basicAttack(armed, p.instanceId, near.instanceId);
    expect(90 - armed.cards[near.instanceId].curHp).toBe(base + 5);
    expect(armed.cards[p.instanceId].enchant).toBeUndefined();
  });

  it("Freezing / Sleeping / Burning each ride the cast-and-strike hit", () => {
    const cold = prepState();
    cold.players.P1.magicPool = 9;
    const p1 = place(cold, "bore_prism", "P1", 2, 0);
    const f1 = place(cold, "dusk_gool", "P2", 2, 1, { curHp: 90, maxHp: 90, curShields: 0 });
    const spBefore = effectiveSp(cold, f1);
    const a1 = arm(cold, p1.instanceId, "freezing"); // strikes at once
    expect(effectiveSp(a1, a1.cards[f1.instanceId])).toBe(spBefore - 5);

    const sleep = prepState();
    sleep.players.P1.magicPool = 9;
    const p2 = place(sleep, "bore_prism", "P1", 2, 0);
    const f2 = place(sleep, "dusk_gool", "P2", 2, 1, { curHp: 90, maxHp: 90, curShields: 0 });
    const a2 = arm(sleep, p2.instanceId, "sleeping");
    expect(statusOf(a2.cards[f2.instanceId], "SLEEP")).toBeTruthy();

    // Burning is a DOT: the strike deals base, and a DOT 2 (2 rounds) rides it.
    const burn = prepState();
    burn.players.P1.magicPool = 9;
    const p3 = place(burn, "bore_prism", "P1", 2, 0);
    const f3 = place(burn, "dusk_gool", "P2", 2, 1, { curHp: 90, maxHp: 90, curShields: 0 });
    const base = effectiveDmg(burn, p3);
    const a3 = arm(burn, p3.instanceId, "burning");
    expect(90 - a3.cards[f3.instanceId].curHp).toBe(base); // no flat bonus on the swing
    expect(statusOf(a3.cards[f3.instanceId], "DOT")?.power).toBe(2);
    expect(statusOf(a3.cards[f3.instanceId], "DOT")?.duration).toBe(2);
  });

  it("on death it hands its armed Enchantment to the strongest ally", () => {
    const s = prepState();
    s.players.P1.magicPool = 9;
    // Allies on the home row (3) so the Mid-row King of the Hill bonus doesn't
    // muddy the DMG comparison. Greegon (4) clearly out-hits Vamp (2).
    const p = place(s, "bore_prism", "P1", 2, 0, { curHp: 4, maxHp: 14, curShields: 0 });
    const weak = place(s, "dusk_vamp", "P1", 3, 2, { curHp: 30, maxHp: 30 });
    const strong = place(s, "leaf_greegon", "P1", 3, 3, { curHp: 30, maxHp: 30 });
    const armed = arm(s, p.instanceId, "burning");
    const killer = place(armed, "leaf_alpha", "P2", 1, 0, { curHp: 30, maxHp: 30 });
    directDamage(armed, armed.cards[killer.instanceId], armed.cards[p.instanceId], 50, true);
    expect(armed.cards[p.instanceId]?.curHp ?? 0).toBeLessThanOrEqual(0);
    expect(armed.cards[strong.instanceId].enchant).toBe("burning");
    expect(armed.cards[weak.instanceId].enchant).toBeUndefined();
  });
});

describe("Beebot's Stinger Buzz", () => {
  it("its sting leaves 2 DOT for 2 rounds", () => {
    const s = prepState();
    const bot = place(s, "bolt_beebot", "P1", 2, 0);
    const foe = place(s, "dusk_gool", "P2", 2, 1, { curHp: 30, maxHp: 30, curShields: 0 });
    basicAttack(s, bot.instanceId, foe.instanceId);
    expect(statusOf(s.cards[foe.instanceId], "DOT")?.power).toBe(2);
    expect(statusOf(s.cards[foe.instanceId], "DOT")?.duration).toBe(2);
  });

  it("dies at the Cleanup of the round it attacks — but its DOT stays behind", () => {
    const s = prepState();
    const bot = place(s, "bolt_beebot", "P1", 2, 0);
    const foe = place(s, "dusk_gool", "P2", 2, 1, { curHp: 30, maxHp: 30, curShields: 0 });
    basicAttack(s, bot.instanceId, foe.instanceId);
    expect(s.cards[bot.instanceId].attackedThisRound).toBe(true);
    const next = advance(atCleanup(s));
    // the bee is gone…
    expect(next.cards[bot.instanceId]?.curHp ?? 0).toBeLessThanOrEqual(0);
    // …and the poison it left is still ticking on the target.
    expect(statusOf(next.cards[foe.instanceId], "DOT")).toBeTruthy();
  });

  it("a Beebot that has NOT attacked survives the Cleanup", () => {
    const s = prepState();
    const bot = place(s, "bolt_beebot", "P1", 2, 0);
    const next = advance(atCleanup(s));
    expect(next.cards[bot.instanceId]?.curHp).toBeGreaterThan(0);
  });
});

describe("DrShock — Shocker ELECTRIFIES (no longer PARALYZE)", () => {
  it("marks a newcomer in range ELECTRIFIED, and never PARALYZE", () => {
    const s = prepState();
    s.players.P1.gold = 5;
    place(s, "bolt_drshock", "P2", 2, 1); // ranged, reaches the P1 home slot
    const handId = giveHand(s, "P1", "dusk_gool");
    const next = applyIntent(s, { type: "SUMMON", player: "P1", handId, col: 0 });
    const fresh = boardCards(next, "P1").find((c) => c.defId === "dusk_gool")!;
    expect(statusOf(fresh, "ELECTRIFIED")).toBeTruthy();
    expect(statusOf(fresh, "PARALYZE")).toBeUndefined();
  });

  it("its basic is a single 3-DMG hit", () => {
    const s = prepState();
    const dr = place(s, "bolt_drshock", "P1", 3, 0); // home row — no King-of-the-Hill bonus
    const foe = place(s, "dusk_gool", "P2", 3, 1, { curHp: 30, maxHp: 30, curShields: 0 });
    basicAttack(s, dr.instanceId, foe.instanceId);
    expect(30 - s.cards[foe.instanceId].curHp).toBe(3);
  });
});

describe("LEAF Overgrowth aura (offensive half)", () => {
  // LEAF's aura was purely defensive and it measured worst on BOTH axes. This
  // is its offence: +3 into anything BLEEDing or ROOTed, paid off by the LEAF
  // cards that apply those on their own. (An earlier self-BLEED-on-every-basic
  // was cut as overkill.)
  it("cuts +3 into a BLEEDing foe — and nothing extra into a clean one", () => {
    const bleeding = prepState();
    const l1 = place(bleeding, "leaf_greegon", "P1", 3, 0);
    const f1 = place(bleeding, "dusk_gool", "P2", 3, 1, { curHp: 40, maxHp: 40, curShields: 0 });
    f1.statuses = [{ kind: "BLEED", duration: 2, power: 1, source: "LEAF" }];
    basicAttack(bleeding, l1.instanceId, f1.instanceId);
    expect(40 - bleeding.cards[f1.instanceId].curHp).toBe(4 + 4); // Greegon 4 + aura 4

    const clean = prepState();
    const l2 = place(clean, "leaf_greegon", "P1", 3, 0);
    const f2 = place(clean, "dusk_gool", "P2", 3, 1, { curHp: 40, maxHp: 40, curShields: 0 });
    basicAttack(clean, l2.instanceId, f2.instanceId);
    expect(40 - clean.cards[f2.instanceId].curHp).toBe(4); // no bonus on the opening hit
  });

  it("is LEAF-only — a BORE card gets no bonus vs a BLEEDing foe", () => {
    const s = prepState();
    const bore = place(s, "bore_clubber", "P1", 3, 0);
    const foe = place(s, "dusk_gool", "P2", 3, 1, { curHp: 40, maxHp: 40, curShields: 0 });
    foe.statuses = [{ kind: "BLEED", duration: 2, power: 1, source: "LEAF" }];
    const base = getDef("bore_clubber").dmg;
    basicAttack(s, bore.instanceId, foe.instanceId);
    expect(40 - s.cards[foe.instanceId].curHp).toBe(base); // no aura, no +3
  });
});

describe("tokens never spawn on the opponent's summoning row", () => {
  it("a spawner ON the enemy home row raises its bodies elsewhere, not beside it there", () => {
    const s = prepState();
    const enemyHome = 0; // P2's home row, from P1's perspective
    // A P1 spawner standing on the enemy home row (mid-capture, say).
    const spawner = place(s, "dusk_zombination", "P1", enemyHome, 1);
    const raised = spawnTokens(s, spawner, "dusk_zombie_tok", 3);
    expect(raised.length).toBeGreaterThan(0);
    for (const tok of raised)
      expect(tok.pos!.row, `token at r${tok.pos!.row}`).not.toBe(enemyHome);
  });

  it("fills every OTHER open square before giving up, so the count still lands", () => {
    // Radius-less spawn opens to the whole board — minus the enemy home row.
    const s = prepState();
    const spawner = place(s, "bolt_keeper", "P1", 2, 2);
    const raised = spawnTokens(s, spawner, "bolt_beebot", 5);
    expect(raised.length).toBe(5);
    expect(raised.every((t) => t.pos!.row !== 0)).toBe(true); // none on P2's home row
  });
});
