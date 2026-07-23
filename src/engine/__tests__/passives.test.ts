// Restored card passives: the generic hooks (onKill, thorns, vsStatus, gated
// on-hit riders, roundTick, onDeath row-ahead) that back the doc-correct
// abilities in cards.ts.

import { describe, expect, it } from "vitest";
import { applyStatus, basicAttack, drainMaxHp, effectiveBasicHits, hasEvasion, SPECIAL_HANDLERS } from "../combat";
import { applyFlow, PYRO_BURN_STACK_CAP } from "../auras";
import { advance, applyIntent } from "../phases";
import { basicIsInert, canFireSpecial, canFireTalent, canMove, canTarget, effectiveSpecialCost, specialTargets, validTargets } from "../rules";
import { boardCards, effectiveDmg, effectiveSp, healCard } from "../state";
import { CARDS, getDef } from "../../data/cards";
import { atCleanup, giveHand, place, prepState, seedForCoins, statusOf } from "./helpers";
import type { GameState } from "../types";

/** Park the battle so `active` is the card awaiting P1's input. */
function battleFor(s: GameState, active: string): GameState {
  s.phase = "battle";
  s.prep = null;
  s.battle = { queue: [active], index: 0, awaitingInput: active };
  return s;
}

describe("on-kill triggers", () => {
  it("Fenrir gains a permanent +1 basic hit on a kill", () => {
    const s = prepState();
    const fenrir = place(s, "pyro_fenrir", "P1", 2, 0);
    place(s, "dusk_gool", "P2", 1, 0, { curHp: 3 }); // some enemy so we don't over-clean
    const prey = place(s, "dusk_vamp", "P2", 2, 1, { curHp: 1 });
    basicAttack(s, fenrir.instanceId, prey.instanceId);
    expect(s.cards[prey.instanceId]).toBeUndefined(); // killed
    expect(s.cards[fenrir.instanceId].hitsBonus).toBe(1);
  });
});

describe("clean-win passives (audit batch)", () => {
  it("Reptilian's Conspiracy grants +2 DMG/HP/SP on a kill", () => {
    const s = prepState();
    const rep = place(s, "leaf_reptilian_tok", "P1", 2, 0);
    place(s, "dusk_gool", "P2", 1, 0, { curHp: 20 }); // keep P2 alive
    const prey = place(s, "dusk_vamp", "P2", 2, 1, { curHp: 1 });
    const beforeMax = s.cards[rep.instanceId].maxHp;
    basicAttack(s, rep.instanceId, prey.instanceId);
    const r = s.cards[rep.instanceId];
    expect(r.dmgBonus).toBe(2);
    expect(r.spBonus).toBe(2);
    expect(r.maxHp).toBe(beforeMax + 2);
  });

  it("Heir's Royal Guard adds +1 shield each round", () => {
    const s = prepState();
    const heir = place(s, "dawn_heir_tok", "P1", 2, 0, { curShields: 2 });
    place(s, "dusk_gool", "P2", 1, 0); // keep both sides on the board
    const next = advance(atCleanup(s));
    expect(next.cards[heir.instanceId].curShields).toBe(3);
  });

  it("Sentry's Volt Turret zaps only a PARALYZED enemy in Cleanup", () => {
    const s = prepState();
    place(s, "bolt_sentry", "P1", 3, 0);
    place(s, "dawn_beam", "P1", 2, 0); // keep P1 alive
    const stunned = place(s, "dusk_gool", "P2", 1, 0, {
      curHp: 20, maxHp: 40, curShields: 0,
      status: { kind: "PARALYZE", duration: 2, power: 0, source: "BOLT" },
    });
    const healthy = place(s, "dusk_gool", "P2", 1, 1, { curHp: 20, maxHp: 40, curShields: 0 });
    const next = advance(atCleanup(s));
    expect(next.cards[stunned.instanceId].curHp).toBe(15); // −5 Volt Turret
    expect(next.cards[healthy.instanceId].curHp).toBe(20); // spared
  });

  it("Hillbilly's Hillside shields the row-ahead ally once, on its first landed hit", () => {
    const s = prepState();
    const hill = place(s, "bore_hillbilly", "P1", 3, 0);
    const ally = place(s, "dawn_beam", "P1", 2, 0, { curShields: 0 }); // row directly ahead
    const foe = place(s, "dusk_gool", "P2", 2, 1, { curHp: 40, maxHp: 40, curShields: 0 });
    basicAttack(s, hill.instanceId, foe.instanceId);
    expect(s.cards[ally.instanceId].curShields).toBe(1);
    basicAttack(s, hill.instanceId, foe.instanceId); // second hit — one-shot, no more
    expect(s.cards[ally.instanceId].curShields).toBe(1);
  });
});

describe("medium-tier passives (audit batch)", () => {
  it("Hawk's High Speed Impact adds +1 DMG per SP above 10", () => {
    const s = prepState();
    const slow = place(s, "gale_hawk", "P1", 3, 0); // SP 7 → no bonus
    expect(effectiveDmg(s, slow)).toBe(8);
    const fast = place(s, "gale_hawk", "P1", 3, 1, { spBonus: 6 }); // SP 13 → +3
    expect(effectiveSp(s, fast)).toBe(13);
    expect(effectiveDmg(s, fast)).toBe(11);
  });

  it("Lytning's Complete Circuit zaps every PARALYZED enemy in Cleanup", () => {
    const s = prepState();
    place(s, "bolt_lytning", "P1", 3, 0);
    place(s, "dawn_beam", "P1", 2, 0); // keep P1 alive
    const stunned = place(s, "dusk_gool", "P2", 1, 0, {
      curHp: 20, maxHp: 40, curShields: 0,
      status: { kind: "PARALYZE", duration: 2, power: 0, source: "BOLT" },
    });
    const free = place(s, "dusk_gool", "P2", 1, 1, { curHp: 20, maxHp: 40, curShields: 0 });
    const next = advance(atCleanup(s));
    expect(next.cards[stunned.instanceId].curHp).toBe(18); // −2 Complete Circuit
    expect(next.cards[free.instanceId].curHp).toBe(20); // not paralyzed → spared
  });

  it("Squanch's Regenerative banks enemy hits and cashes them in at Cleanup", () => {
    const s = prepState();
    // Squanch is LEAF as well as Regenerative, and Photosynthesis now also banks
    // a shield on a round it was hit — so a struck Squanch draws from BOTH. The
    // two are counted separately below rather than folded together.
    const sq = place(s, "leaf_squanch", "P1", 3, 0, { curShields: 0, curHp: 20, maxHp: 23 });
    const foe = place(s, "dusk_gool", "P2", 3, 1);
    basicAttack(s, foe.instanceId, sq.instanceId);
    basicAttack(s, foe.instanceId, sq.instanceId);
    expect(s.cards[sq.instanceId].hitsTakenThisRound).toBe(2);
    expect(s.cards[sq.instanceId].curShields).toBe(0); // nothing yet — it pays at end of round
    const next = advance(atCleanup(s));
    expect(next.cards[sq.instanceId].curShields).toBe(3); // 2 Regenerative + 1 Photosynthesis
    expect(next.cards[sq.instanceId].hitsTakenThisRound).toBe(0); // banked hits spent
  });

  it("UFO's inert basic is skipped, but Smog's still attacks (PYRO burns on hit)", () => {
    const s = prepState();
    // Home row on purpose: King of the Hill grants +1 DMG in a MID row, so a
    // mid-board UFO really does deal 1 and is correctly NOT inert there. The
    // check reads effective damage, not the printed number, so the skip is
    // positional — it only fires when the card genuinely cannot do anything.
    const ufo = place(s, "bore_ufo", "P1", 3, 0);
    const smog = place(s, "pyro_smog_card", "P1", 3, 1);
    place(s, "dusk_gool", "P2", 2, 0); // a reachable target for both
    expect(basicIsInert(s, s.cards[ufo.instanceId])).toBe(true);
    expect(basicIsInert(s, place(s, "bore_ufo", "P1", 2, 2))).toBe(false); // mid row: 1 DMG
    // Smog is PYRO, so Scorch burns whatever it touches — worth a turn.
    expect(basicIsInert(s, s.cards[smog.instanceId])).toBe(false);
    // The full census — the predicate must not be quietly silencing anything
    // else. UFO prints 0 DMG with no on-hit rider; RIP prints 0 DMG on purpose
    // and never swings at all (its Special is free, so it always has a real
    // action). Any OTHER name appearing here is a bug.
    const inert = CARDS.filter((d) => {
      const c = place(s, d.id, "P2", 0, 3);
      const r = basicIsInert(s, c);
      delete s.cards[c.instanceId];
      return r;
    }).map((d) => d.id);
    expect(inert.sort()).toEqual(["bore_ufo", "dusk_rip"]);
  });

  it("a card with only an inert basic takes no turn at all", () => {
    const s = prepState();
    const ufo = place(s, "bore_ufo", "P1", 3, 0); // home row — no King of the Hill bump
    place(s, "dusk_gool", "P2", 2, 0);
    s.phase = "battle";
    s.battle = { queue: [ufo.instanceId], index: 0, awaitingInput: null };
    const next = advance(s);
    // It never awaits input — the queue steps straight past it.
    expect(next.battle?.awaitingInput ?? null).toBeNull();
    expect(next.log.some((l) => /UFO.*no valid action/.test(l))).toBe(true);
  });

  it("Smog gains speed from its Black Smoke kills, which nothing else could grant it", () => {
    const s = prepState();
    const smog = place(s, "pyro_smog_card", "P1", 3, 0);
    expect(effectiveSp(s, s.cards[smog.instanceId])).toBe(0); // a cloud that can't move
    // Two enemies on 1 HP: Black Smoke's end-of-round tick finishes both.
    const a = place(s, "dusk_gool", "P2", 1, 0, { curHp: 1, curShields: 0 });
    const b = place(s, "dusk_vamp", "P2", 1, 1, { curHp: 1, curShields: 0 });
    place(s, "dusk_crow", "P2", 0, 3, { curHp: 20, maxHp: 20 }); // survivor, keeps P2 alive
    const next = advance(atCleanup(s));
    expect(next.cards[a.instanceId]).toBeUndefined();
    expect(next.cards[b.instanceId]).toBeUndefined();
    // The whole point: these are TICK kills. The ordinary death path only fires
    // onKill for basic/special kills, and Smog has 0 DMG so it can never land
    // one — without tickDamage feeding onKill, this passive would be dead.
    expect(next.cards[smog.instanceId].spBonus).toBe(2);
    expect(effectiveSp(next, next.cards[smog.instanceId])).toBe(2);
  });

  it("Crowned locks out for 3 rounds — the permanent buff can't compound every turn", () => {
    const s = prepState();
    s.players.P1.magicPool = 20;
    const heir = place(s, "dawn_heir_tok", "P1", 2, 0);
    place(s, "dusk_gool", "P2", 0, 0); // keep both boards alive through Cleanup
    let g = applyIntent(battleFor(s, heir.instanceId), {
      type: "BATTLE_ACTION",
      player: "P1",
      action: "special",
      targetId: heir.instanceId,
    });
    expect(g.cards[heir.instanceId].dmgBonus).toBe(5); // it fired
    expect(canFireSpecial(g, heir.instanceId).ok).toBe(false); // and locked
    // Count Cleanups until it frees up rather than hardcoding: the engine sets
    // cooldown+1 to absorb the cast round's own Cleanup, so a "3-round lockout"
    // is 4 ticks. Measuring it keeps the test honest about that quirk.
    let ticks = 0;
    while (!canFireSpecial(g, heir.instanceId).ok && ticks < 10) {
      g = advance(atCleanup(g));
      ticks++;
    }
    expect(ticks).toBe(4); // 3 full rounds skipped, plus the cast round's tick
    expect(g.players.P1.magicPool).toBeGreaterThanOrEqual(3); // affordable again too
  });

  it("Scarlett's Bat Swarm drains max HP from every opponent it hits", () => {
    const s = prepState();
    s.players.P1.magicPool = 2;
    const scarlett = place(s, "dusk_scarlett", "P1", 2, 0);
    const a = place(s, "leaf_greegon", "P2", 1, 0, { curHp: 20, maxHp: 20, curShields: 0 });
    const b = place(s, "leaf_alpha", "P2", 1, 1, { curHp: 20, maxHp: 20, curShields: 0 });
    const before = s.cards[scarlett.instanceId].maxHp;
    const next = applyIntent(battleFor(s, scarlett.instanceId), {
      type: "BATTLE_ACTION",
      player: "P1",
      action: "special",
      targetId: a.instanceId,
    });
    for (const t of [a, b]) expect(next.cards[t.instanceId].maxHp).toBe(19); // 1 stolen each
    expect(next.cards[scarlett.instanceId].maxHp).toBe(before + 2); // and banked
  });

  it("draining never takes an opponent's last point of max HP", () => {
    const s = prepState();
    const scarlett = place(s, "dusk_scarlett", "P1", 2, 0);
    // maxHp 1 already — there is nothing left to take without hitting zero.
    const husk = place(s, "leaf_greegon", "P2", 1, 0, { curHp: 1, maxHp: 1, curShields: 0 });
    const before = s.cards[scarlett.instanceId].maxHp;
    expect(drainMaxHp(s, s.cards[scarlett.instanceId], s.cards[husk.instanceId], 1)).toBe(0);
    expect(s.cards[husk.instanceId].maxHp).toBe(1);
    expect(s.cards[scarlett.instanceId].maxHp).toBe(before); // nothing banked either
  });

  it("Heir's King Me cheapens its OWN Crowned, stacking per kill", () => {
    const s = prepState();
    const heir = place(s, "dawn_heir_tok", "P1", 2, 0);
    const printed = getDef("dawn_heir_tok").special!.cost; // 3
    const cost = () => effectiveSpecialCost(s, s.cards[heir.instanceId], printed);
    // A second Heir must NOT get cheaper off the first one's kills — the
    // discount lives on the instance, not the player or the card def.
    const other = place(s, "dawn_heir_tok", "P1", 3, 0);
    expect(cost()).toBe(printed);
    for (let i = 0; i < 2; i++) {
      const prey = place(s, "dusk_gool", "P2", 1, i, { curHp: 1, curShields: 0 });
      place(s, "dusk_vamp", "P2", 0, i); // keep P2's board alive
      basicAttack(s, heir.instanceId, prey.instanceId);
      expect(s.cards[prey.instanceId]).toBeUndefined();
    }
    expect(s.cards[heir.instanceId].specialCostReduction).toBe(2);
    expect(cost()).toBe(printed - 2); // 3 → 1
    expect(effectiveSpecialCost(s, s.cards[other.instanceId], printed)).toBe(printed);
    // …and the discount is honoured at the gate, not just in the display.
    s.players.P1.magicPool = 1;
    expect(canFireSpecial(s, heir.instanceId).ok).toBe(true);
  });

  it("self-targeting Specials offer only the caster, never the whole team", () => {
    const s = prepState();
    s.players.P1.magicPool = 6;
    const ravven = place(s, "dusk_ravven", "P1", 2, 0); // Night Stalk: pure self-buff
    place(s, "dusk_gool", "P1", 3, 0); // allies that must NOT be offered
    place(s, "dusk_vamp", "P1", 3, 1);
    place(s, "dusk_crow", "P2", 1, 0);
    const offered = specialTargets(s, ravven.instanceId);
    expect(offered.map((t) => t.instanceId)).toEqual([ravven.instanceId]);
  });

  it("every self-only handler is marked self, and ally-target ones still aren't", () => {
    // The bug this guards: empower/spawn/burrow ignore `targets` entirely, so
    // marking them "ally" made the UI demand a pick from the whole board for an
    // effect that never touches anyone else.
    const SELF_ONLY = new Set(["empower", "spawn", "burrow"]);
    for (const def of CARDS) {
      const sp = def.special;
      if (!sp) continue;
      if (SELF_ONLY.has(sp.handler))
        expect(sp.targetSide, `${def.id} (${sp.handler}) should be self`).toBe("self");
      if (sp.targetSide === "ally")
        expect(SELF_ONLY.has(sp.handler), `${def.id} is ally but ignores targets`).toBe(false);
    }
  });

  it("Tumbleweed's Roll Through is a one-shot Talent: free, then spent", () => {
    const s = prepState();
    s.players.P1.magicPool = 0; // a Talent costs nothing — this must not block it
    const weed = place(s, "gale_tumbleweed", "P1", 2, 0);
    const foe = place(s, "dusk_gool", "P2", 1, 0, { curHp: 30, maxHp: 30, curShields: 0 });
    const next = applyIntent(battleFor(s, weed.instanceId), {
      type: "BATTLE_ACTION",
      player: "P1",
      action: "talent",
      targetId: foe.instanceId,
    });
    expect(next.cards[foe.instanceId].curHp).toBe(25); // 5 DMG landed
    expect(next.players.P1.magicPool).toBe(0); // nothing paid
    expect(next.cards[weed.instanceId].talentUsed).toBe(true);
    expect(canFireTalent(next, weed.instanceId).ok).toBe(false); // gone for the game
  });

  it("Sprinu's basic can be aimed at a hurt ally to heal it instead", () => {
    const s = prepState();
    const sprinu = place(s, "leaf_sprinu", "P1", 3, 0);
    const hurt = place(s, "leaf_greegon", "P1", 3, 1, { curHp: 5, maxHp: 20 });
    const full = place(s, "leaf_alpha", "P1", 2, 0, { curHp: 20, maxHp: 20 });
    place(s, "dusk_gool", "P2", 0, 0);
    // Only the WOUNDED ally is offered — healing a full-HP card wastes a turn.
    const offered = validTargets(s, sprinu.instanceId).map((t) => t.instanceId);
    expect(offered).toContain(hurt.instanceId);
    expect(offered).not.toContain(full.instanceId);
    basicAttack(s, sprinu.instanceId, hurt.instanceId);
    expect(s.cards[hurt.instanceId].curHp).toBe(9); // healed for its 4 DMG, not struck
  });

  it("Morning Dew waters LEAF allies only", () => {
    const s = prepState();
    place(s, "leaf_sprinu", "P1", 3, 0);
    const leafy = place(s, "leaf_greegon", "P1", 3, 1, { curHp: 5, maxHp: 20 });
    const other = place(s, "bore_armadillo", "P1", 2, 0, { curHp: 5, maxHp: 20 });
    place(s, "dusk_gool", "P2", 0, 0);
    const next = advance(atCleanup(s));
    // 5 + 2 (greegon's own REGEN) + 1 (Morning Dew) + 2 (LEAF Photosynthesis).
    // Drop the dew and this reads 9, so the number does pin the passive.
    expect(next.cards[leafy.instanceId].curHp).toBe(10);
    expect(next.cards[other.instanceId].curHp).toBe(5); // BORE gets neither dew nor Photosynthesis
  });

  it("Wedded Wraith raises a Specter on every kill", () => {
    const s = prepState();
    const wraith = place(s, "dusk_wedded_wraith", "P1", 2, 0);
    const prey = place(s, "leaf_greegon", "P2", 1, 0, { curHp: 2, curShields: 0 });
    place(s, "leaf_alpha", "P2", 0, 0); // keep P2 alive
    basicAttack(s, wraith.instanceId, prey.instanceId);
    expect(s.cards[prey.instanceId]).toBeUndefined();
    const risen = Object.values(s.cards).filter((c) => c.defId === "dusk_specter_tok");
    expect(risen).toHaveLength(1);
    expect(risen[0].owner).toBe("P1");
  });

  it("Last Waltz lifts surviving Ghosts and frightens the living", () => {
    const s = prepState();
    const wraith = place(s, "dusk_wedded_wraith", "P1", 2, 1, { curHp: 2, curShields: 0 });
    const ghost = place(s, "dusk_gool", "P1", 3, 0); // Ghost tribe ally
    const notGhost = place(s, "leaf_alpha", "P1", 3, 1);
    const killer = place(s, "leaf_greegon", "P2", 1, 1, { curHp: 30, maxHp: 30 });
    const ghostDmgBefore = effectiveDmg(s, s.cards[ghost.instanceId]);
    basicAttack(s, killer.instanceId, wraith.instanceId);
    expect(s.cards[wraith.instanceId]).toBeUndefined();
    expect(effectiveDmg(s, s.cards[ghost.instanceId])).toBe(ghostDmgBefore + 2);
    expect(s.cards[notGhost.instanceId].dmgBonus).toBe(0); // tribe-scoped
    expect(statusOf(s.cards[killer.instanceId], "FRIGHTEN")?.duration).toBe(1);
  });

  it("Kinguin lands with its guard on adjacent slots", () => {
    const s = prepState();
    s.players.P1.summonPool = 6;
    place(s, "dusk_gool", "P2", 0, 0); // keep P2 alive
    const handId = giveHand(s, "P1", "aqua_kinguin");
    const next = applyIntent(s, { type: "SUMMON", player: "P1", handId, col: 1 });
    const king = Object.values(next.cards).find((c) => c.defId === "aqua_kinguin")!;
    const guard = Object.values(next.cards).filter((c) => c.defId === "aqua_guin_tok");
    expect(guard).toHaveLength(2);
    for (const g of guard) {
      expect(g.owner).toBe("P1");
      // adjacentOnly — every escort is within a king's move of Kinguin.
      expect(Math.max(Math.abs(g.pos!.row - king.pos!.row), Math.abs(g.pos!.col - king.pos!.col))).toBe(1);
    }
  });

  it("SSeerr's arrival burns the WHOLE row ahead, edge column included", () => {
    const s = prepState();
    s.players.P1.summonPool = 8;
    // Summons into P1's home row at col 0; the row ahead is row 2. The far
    // corner is 3 columns away — spread 1 would have left it untouched.
    const near = place(s, "dusk_gool", "P2", 2, 0, { curHp: 30, maxHp: 30, curShields: 0 });
    const far = place(s, "dusk_vamp", "P2", 2, 3, { curHp: 30, maxHp: 30, curShields: 0 });
    const offRow = place(s, "dusk_crow", "P2", 1, 3, { curHp: 30, maxHp: 30, curShields: 0 });
    const handId = giveHand(s, "P1", "pyro_sseerr");
    const next = applyIntent(s, { type: "SUMMON", player: "P1", handId, col: 0 });
    expect(next.cards[near.instanceId].curHp).toBe(27);
    expect(next.cards[far.instanceId].curHp).toBe(27);
    expect(next.cards[offRow.instanceId].curHp).toBe(30); // depth 1 — one row only
  });

  it("SSeerr's Flaming Slasher strikes on cast and burns that hit and one more", () => {
    const s = prepState();
    s.players.P1.magicPool = 2;
    const sseerr = place(s, "pyro_sseerr", "P1", 2, 0);
    const foe = place(s, "dusk_gool", "P2", 1, 0, { curHp: 60, maxHp: 60, curShields: 0 });
    const next = applyIntent(battleFor(s, sseerr.instanceId), {
      type: "BATTLE_ACTION",
      player: "P1",
      action: "special",
      targetId: foe.instanceId,
    });
    // The cast swung: damage landed AND the burn is already on, from charge one.
    expect(next.cards[foe.instanceId].curHp).toBeLessThan(60);
    expect(statusOf(next.cards[foe.instanceId], "BURN")?.power).toBe(4);
    expect(next.cards[sseerr.instanceId].loadedOnHit?.attacks).toBe(1); // one left
    next.cards[foe.instanceId].statuses = [];
    basicAttack(next, sseerr.instanceId, foe.instanceId);
    expect(statusOf(next.cards[foe.instanceId], "BURN")?.power).toBe(4);
    expect(next.cards[sseerr.instanceId].loadedOnHit).toBeUndefined(); // both spent
    // The third attack still burns — but that's PYRO's Scorch aura (BURN 1),
    // not the Slasher's BURN 4. Power is what distinguishes them.
    next.cards[foe.instanceId].statuses = [];
    basicAttack(next, sseerr.instanceId, foe.instanceId);
    expect(statusOf(next.cards[foe.instanceId], "BURN")?.power).toBe(1);
  });

  it("Monger's missed boulders come back as shields", () => {
    const s = prepState();
    s.players.P1.magicPool = 2;
    // Force every one of the five coin flips to MISS — the worst roll should
    // still be worth casting: 5 misses × 2 = 10 shields on top of its printed 1.
    s.rngState = seedForCoins(false, false, false, false, false);
    const monger = place(s, "bore_monger", "P1", 2, 0, { curShields: 1 });
    const foe = place(s, "dusk_gool", "P2", 1, 0, { curHp: 60, maxHp: 60, curShields: 0 });
    const next = applyIntent(battleFor(s, monger.instanceId), {
      type: "BATTLE_ACTION",
      player: "P1",
      action: "special",
      targetId: foe.instanceId,
    });
    expect(next.cards[foe.instanceId].curHp).toBe(60); // every boulder whiffed
    expect(next.cards[monger.instanceId].curShields).toBe(11);
  });

  it("Monger's Pride Guardian shields each ally on its first hit only", () => {
    const s = prepState();
    place(s, "bore_monger", "P1", 3, 0);
    const ally = place(s, "bore_armadillo", "P1", 2, 0, { curHp: 20, maxHp: 20, curShields: 0 });
    const foe = place(s, "dusk_gool", "P2", 1, 0);
    basicAttack(s, foe.instanceId, ally.instanceId);
    expect(s.cards[ally.instanceId].curShields).toBe(2); // guarded
    s.cards[ally.instanceId].curShields = 0; // strip it and get hit again
    basicAttack(s, foe.instanceId, ally.instanceId);
    expect(s.cards[ally.instanceId].curShields).toBe(0); // the guard was one-time
  });

  it("Windsor's Right Through Me WEAKENs even a RANGED attacker", () => {
    const s = prepState();
    const windsor = place(s, "gale_windsor", "P1", 3, 0);
    // Ranged: classic melee-only thorns would never answer this one.
    const shooter = place(s, "dusk_gool", "P2", 1, 0);
    basicAttack(s, shooter.instanceId, windsor.instanceId);
    expect(statusOf(s.cards[shooter.instanceId], "WEAKEN")?.duration).toBe(2);
  });

  it("Jolt Electrifies everything in reach each round — and spares what's out of it", () => {
    const s = prepState();
    place(s, "bolt_jolt", "P1", 2, 1);
    // Melee, SP 3 → reach 1, so the zone is the 8 tiles around it.
    const near = place(s, "dusk_gool", "P2", 1, 1, { curHp: 30, maxHp: 30, curShields: 0 });
    const far = place(s, "dusk_vamp", "P2", 0, 3, { curHp: 20, maxHp: 20 });
    const next = advance(atCleanup(s));
    expect(statusOf(next.cards[near.instanceId], "ELECTRIFIED")?.duration).toBe(2);
    expect(statusOf(next.cards[far.instanceId], "ELECTRIFIED")).toBeUndefined();
  });

  it("Jolt's on-hit mark is the backstop for shooters the zone can't reach", () => {
    const s = prepState();
    const jolt = place(s, "bolt_jolt", "P1", 3, 0);
    // Two rows out: it can shoot Jolt, but it sits outside Jolt's reach-1 zone,
    // so ONLY the on-hit half can mark it.
    const sniper = place(s, "dusk_gool", "P2", 1, 0, { curHp: 30, maxHp: 30 });
    const next = advance(atCleanup(s));
    expect(statusOf(next.cards[sniper.instanceId], "ELECTRIFIED")).toBeUndefined(); // zone missed it
    basicAttack(next, sniper.instanceId, jolt.instanceId);
    expect(statusOf(next.cards[sniper.instanceId], "ELECTRIFIED")?.duration).toBe(2);
  });

  it("the Electrified mark is what BOLT allies actually cash in", () => {
    const s = prepState();
    const foe = place(s, "dusk_gool", "P2", 1, 0, { curHp: 30, maxHp: 30, curShields: 0 });
    const buzz = place(s, "bolt_buzz", "P1", 2, 1);
    // Unmarked: 2 DMG + 1 King of the Hill (buzz stands in a mid row) = 3.
    // The hit ALSO leaves the target ELECTRIFIED now — Electrify sets up its own
    // payoff rather than waiting on another card to apply a status.
    basicAttack(s, buzz.instanceId, foe.instanceId);
    expect(s.cards[foe.instanceId].curHp).toBe(27);
    expect(statusOf(s.cards[foe.instanceId], "ELECTRIFIED")).toBeTruthy();
    // Marked: Electrify adds +2 vs a statused target = 5.
    basicAttack(s, buzz.instanceId, foe.instanceId);
    expect(s.cards[foe.instanceId].curHp).toBe(22);
  });

  it("Shimmering Featherrows volleys three targets, then cloaks the eagle", () => {
    const s = prepState();
    const eagle = place(s, "dawn_goldeneagle", "P1", 2, 0);
    const a = place(s, "dusk_gool", "P2", 1, 0, { curHp: 20, maxHp: 20, curShields: 0 });
    const b = place(s, "dusk_vamp", "P2", 1, 1, { curHp: 20, maxHp: 20, curShields: 0 });
    const c = place(s, "dusk_crow", "P2", 1, 2, { curHp: 20, maxHp: 20, curShields: 0 });
    const next = applyIntent(battleFor(s, eagle.instanceId), {
      type: "BATTLE_ACTION",
      player: "P1",
      action: "talent",
      targetId: a.instanceId,
    });
    for (const t of [a, b, c]) expect(next.cards[t.instanceId].curHp).toBe(17); // 3 apiece
    expect(statusOf(next.cards[eagle.instanceId], "STEALTH")?.duration).toBe(2);
  });

  it("Shine's Brightling Ball answers the killer, once per game", () => {
    const s = prepState();
    place(s, "dawn_shine", "P1", 3, 0);
    // curShields:0 matters — armadillo ships with 4, which would eat the hit.
    const ally = place(s, "bore_armadillo", "P1", 2, 0, { curHp: 2, curShields: 0 }); // BLOCK 2, so 4−2 kills
    const killer = place(s, "dusk_gool", "P2", 1, 0, { curHp: 13 });
    basicAttack(s, killer.instanceId, ally.instanceId);
    expect(s.cards[ally.instanceId]).toBeUndefined();
    expect(s.cards[killer.instanceId].curHp).toBe(9); // 4 back from Shine
    expect(statusOf(s.cards[killer.instanceId], "BLIND")?.duration).toBe(3);
    // A second ally falls — the one-shot is already spent.
    s.cards[killer.instanceId].statuses = []; // clear that BLIND so the kill is reliable
    const ally2 = place(s, "bore_armadillo", "P1", 2, 1, { curHp: 2, curShields: 0 });
    basicAttack(s, killer.instanceId, ally2.instanceId);
    expect(s.cards[ally2.instanceId]).toBeUndefined();
    expect(s.cards[killer.instanceId].curHp).toBe(9); // no second answer
  });

  it("Dirt Driller hides Obsidi, speeds it underground, and erupts once", () => {
    const s = prepState();
    s.players.P1.magicPool = 3;
    const obsidi = place(s, "bore_obsidi", "P1", 2, 0);
    const foe = place(s, "dusk_gool", "P2", 1, 0, { curHp: 40, maxHp: 40, curShields: 0 });
    expect(effectiveSp(s, s.cards[obsidi.instanceId])).toBe(8); // above ground
    const next = applyIntent(battleFor(s, obsidi.instanceId), {
      type: "BATTLE_ACTION",
      player: "P1",
      action: "special",
      targetId: obsidi.instanceId, // self-targeted burrow
    });
    expect(statusOf(next.cards[obsidi.instanceId], "STEALTH")).toBeTruthy();
    expect(effectiveSp(next, next.cards[obsidi.instanceId])).toBe(11); // Obsidian Claws
    // The ambush overrides its printed 4×2 — 6×2 comes up out of the ground.
    basicAttack(next, obsidi.instanceId, foe.instanceId);
    expect(next.cards[foe.instanceId].curHp).toBe(28); // 40 − 12
    expect(statusOf(next.cards[obsidi.instanceId], "STEALTH")).toBeUndefined(); // cover broken
    // …and it's spent: the follow-up is its printed attack again. 4×2 plus
    // King of the Hill's mid-row +1 DMG = 10 — note the loaded 6×2 was FLAT and
    // took no such bonus, which is what "deal 6×2 DMG" should mean.
    basicAttack(next, obsidi.instanceId, foe.instanceId);
    expect(next.cards[foe.instanceId].curHp).toBe(18); // 28 − 10
  });

  it("Ash Boar's Charging Tusks hits what's in reach on arrival, then charges in", () => {
    const s = prepState();
    s.players.P1.summonPool = 6;
    const foe = place(s, "dusk_gool", "P2", 2, 1, { curHp: 20, maxHp: 20, curShields: 0 });
    const handId = giveHand(s, "P1", "pyro_ash_boar");
    const next = applyIntent(s, { type: "SUMMON", player: "P1", handId, col: 0 });
    const boar = Object.values(next.cards).find((c) => c.defId === "pyro_ash_boar")!;
    expect(next.cards[foe.instanceId].curHp).toBe(16); // took the 4 on arrival
    expect(boar.pos!.row).toBe(2); // charged off its home row (3 → 2)
  });

  it("Ravven's EVASION is dead on its own ground and live on the enemy's", () => {
    const s = prepState();
    // P1 home is row 3, so rows 0-1 are the enemy battlefield.
    const home = place(s, "dusk_ravven", "P1", 3, 0);
    const raiding = place(s, "dusk_ravven", "P1", 1, 0);
    expect(hasEvasion(s.cards[home.instanceId], s.boardSize)).toBe(false);
    expect(hasEvasion(s.cards[raiding.instanceId], s.boardSize)).toBe(true);
    // …and an unconditional evader is unaffected by the new gate.
    const plain = place(s, "gale_tumbleweed", "P1", 3, 2);
    expect(hasEvasion(s.cards[plain.instanceId], s.boardSize)).toBe(true);
  });

  it("Fallow's aura pins for the WHOLE side — on a CRIT, from any element", () => {
    const s = prepState();
    place(s, "leaf_fallow", "P1", 3, 0); // just standing there
    const leafAlly = place(s, "leaf_darth", "P1", 2, 0); // CRIT, LEAF
    const otherAlly = place(s, "aqua_icyninza", "P1", 2, 1); // CRIT, not even LEAF
    const a = place(s, "dusk_gool", "P2", 1, 0, { curHp: 60, maxHp: 60, curShields: 0 });
    const b = place(s, "dusk_vamp", "P2", 1, 1, { curHp: 60, maxHp: 60, curShields: 0 });
    s.rngState = seedForCoins(true, true); // both crit rolls land
    basicAttack(s, leafAlly.instanceId, a.instanceId);
    basicAttack(s, otherAlly.instanceId, b.instanceId);
    expect(statusOf(s.cards[a.instanceId], "ROOT")?.duration).toBe(2);
    expect(statusOf(s.cards[b.instanceId], "ROOT")?.duration).toBe(2); // any ally, any element
  });

  it("an ally with no CRIT of its own can never trigger the pin", () => {
    // The gate's real cost: the aura reaches the whole side, but only the part
    // of it that can roll a crit at all. Alpha has no CRIT keyword, so it never
    // rolls — no seed can make this one pin.
    const s = prepState();
    place(s, "leaf_fallow", "P1", 3, 0);
    const plain = place(s, "leaf_alpha", "P1", 2, 0); // keywords: {} — no CRIT
    const foe = place(s, "dusk_gool", "P2", 1, 0, { curHp: 60, maxHp: 60, curShields: 0 });
    s.rngState = seedForCoins(true, true, true, true, true); // every flip would succeed
    basicAttack(s, plain.instanceId, foe.instanceId);
    expect(statusOf(s.cards[foe.instanceId], "ROOT")).toBeUndefined();
  });

  it("a ROOT Fallow applies survives to feed Trapper — the engine connects", () => {
    // The whole point of the pair, and it was broken: Cleanup ticks statuses at
    // step 3 but runs Trapper at 4b, so the old 1-round ROOT expired first and
    // Trapper measured 0 damage. Duration 2 is what closes the loop.
    const s = prepState();
    const fallow = place(s, "leaf_fallow", "P1", 2, 0);
    const foe = place(s, "dusk_gool", "P2", 1, 0, { curHp: 60, maxHp: 60, curShields: 0 });
    s.rngState = seedForCoins(true); // the aura is crit-gated — land the roll
    basicAttack(s, fallow.instanceId, foe.instanceId);
    const afterHit = s.cards[foe.instanceId].curHp;
    const next = advance(atCleanup(s));
    expect(next.cards[foe.instanceId].curHp).toBe(afterHit - 1); // Trapper bit
    expect(statusOf(next.cards[foe.instanceId], "ROOT")?.duration).toBe(1); // still pinned for its Prep
  });

  it("the pin aura dies with Fallow — no Fallow on board, no ROOT", () => {
    const s = prepState();
    const ally = place(s, "leaf_alpha", "P1", 2, 0); // Fallow deliberately absent
    const foe = place(s, "dusk_gool", "P2", 1, 0, { curHp: 60, maxHp: 60, curShields: 0 });
    basicAttack(s, ally.instanceId, foe.instanceId);
    expect(statusOf(s.cards[foe.instanceId], "ROOT")).toBeUndefined();
  });

  it("Trapper's own tick can't re-pin its victims into a permanent lock", () => {
    const s = prepState();
    place(s, "leaf_fallow", "P1", 3, 0);
    const foe = place(s, "dusk_gool", "P2", 1, 0, { curHp: 60, maxHp: 60, curShields: 0 });
    applyStatus(s, foe, "ROOT", 2, 0, "LEAF");
    // Trapper's bite resolves as `reflect`, which the aura skips. Without that
    // guard the bite would re-pin its own victim every round and ROOT would
    // never expire — so after one Cleanup this must be 1, not back up to 2.
    const next = advance(atCleanup(s));
    expect(next.cards[foe.instanceId].curHp).toBe(59); // Trapper landed
    expect(statusOf(next.cards[foe.instanceId], "ROOT")?.duration).toBe(1); // ticked down, not renewed
  });

  it("shields are immune to the pin — the crit gate can't even roll through them", () => {
    // The blunt consequence of gating on the crit, recorded so it is a decision
    // and not a surprise: the crit roll is only attempted when curShields === 0,
    // so a shielded card cannot be ROOTed by the aura at any odds. Strip the
    // shields first and it pins normally.
    const s = prepState();
    const fallow = place(s, "leaf_fallow", "P1", 2, 0);
    const walled = place(s, "dusk_gool", "P2", 1, 0, { curHp: 30, maxHp: 30, curShields: 3 });
    s.rngState = seedForCoins(true, true, true, true); // every flip would succeed
    basicAttack(s, fallow.instanceId, walled.instanceId);
    expect(statusOf(s.cards[walled.instanceId], "ROOT")).toBeUndefined();

    // Trapper itself is unchanged: range-free, and it bites anything ROOTed
    // however that ROOT got there.
    const s2 = prepState();
    place(s2, "leaf_fallow", "P1", 2, 0);
    const distant = place(s2, "dusk_ghastly", "P2", 0, 3, { curHp: 20, maxHp: 20 });
    applyStatus(s2, distant, "ROOT", 3, 0, "LEAF");
    const next = advance(atCleanup(s2));
    expect(next.cards[distant.instanceId].curHp).toBe(19); // 1 from the traps
  });

  it("Hunting Season auto-hits through EVASION that a basic would whiff", () => {
    const s = prepState();
    s.players.P1.magicPool = 4;
    s.rngState = seedForCoins(true, true, true); // every dodge roll would succeed
    const fallow = place(s, "leaf_fallow", "P1", 2, 0);
    const dodger = place(s, "gale_tumbleweed", "P2", 1, 0, { curHp: 20, curShields: 0 });
    const next = applyIntent(battleFor(s, fallow.instanceId), {
      type: "BATTLE_ACTION",
      player: "P1",
      action: "special",
      targetId: dodger.instanceId,
    });
    expect(next.cards[dodger.instanceId].curHp).toBeLessThan(20); // the volley landed
  });

  it("Night Stalk's +3 DMG expires instead of ramping forever", () => {
    const s = prepState();
    s.players.P1.magicPool = 3;
    const ravven = place(s, "dusk_ravven", "P1", 2, 0);
    place(s, "dusk_gool", "P2", 1, 0); // keep both boards alive
    const base = effectiveDmg(s, s.cards[ravven.instanceId]);
    let next = applyIntent(battleFor(s, ravven.instanceId), {
      type: "BATTLE_ACTION",
      player: "P1",
      action: "special",
      targetId: ravven.instanceId,
    });
    expect(effectiveDmg(next, next.cards[ravven.instanceId])).toBe(base + 3);
    expect(next.cards[ravven.instanceId].dmgBonus).toBe(0); // timed, not permanent
    for (let i = 0; i < 3; i++) next = advance(atCleanup(next));
    expect(effectiveDmg(next, next.cards[ravven.instanceId])).toBe(base); // worn off
  });

  it("Jellyfish's Jelly Shock zaps a RANGED attacker that thorns would miss", () => {
    const s = prepState();
    const jelly = place(s, "bolt_jellyfish", "P1", 3, 0, { curHp: 15 });
    const sniper = place(s, "dusk_gool", "P2", 1, 0, { curHp: 13 }); // Ranged, far off
    basicAttack(s, sniper.instanceId, jelly.instanceId);
    expect(s.cards[sniper.instanceId].curHp).toBe(11); // 2 discharge, from across the board
  });

  it("Jelly Shock splashes every enemy beside it, not just the attacker", () => {
    const s = prepState();
    const jelly = place(s, "bolt_jellyfish", "P1", 2, 1, { curHp: 15 });
    const puncher = place(s, "dusk_gool", "P2", 2, 2, { curHp: 13 }); // adjacent attacker
    const beside = place(s, "dusk_vamp", "P2", 1, 0, { curHp: 12 }); // diagonal bystander
    const far = place(s, "dusk_crow", "P2", 0, 3, { curHp: 12 }); // out of the cluster
    basicAttack(s, puncher.instanceId, jelly.instanceId);
    expect(s.cards[puncher.instanceId].curHp).toBe(11); // zapped as the attacker
    expect(s.cards[beside.instanceId].curHp).toBe(10); // zapped for standing too close
    expect(s.cards[far.instanceId].curHp).toBe(12); // untouched
  });

  it("Jelly Shock stays quiet when the Jellyfish dies to the hit", () => {
    const s = prepState();
    const jelly = place(s, "bolt_jellyfish", "P1", 2, 1, { curHp: 2 });
    const killer = place(s, "dusk_gool", "P2", 2, 2, { curHp: 13 }); // 4 DMG → lethal
    basicAttack(s, killer.instanceId, jelly.instanceId);
    expect(s.cards[jelly.instanceId]).toBeUndefined(); // it died
    expect(s.cards[killer.instanceId].curHp).toBe(13); // no posthumous discharge
  });

  it("Regenerative counts a hit its shield soaked, and grows that shield back", () => {
    const s = prepState();
    const sq = place(s, "leaf_squanch", "P1", 3, 0, { curShields: 1 });
    const foe = place(s, "dusk_gool", "P2", 3, 1);
    basicAttack(s, foe.instanceId, sq.instanceId);
    expect(s.cards[sq.instanceId].curShields).toBe(0); // the shield ate the hit
    const next = advance(atCleanup(s));
    // 1 Regenerative + 1 Photosynthesis: being LEAF, a struck Squanch banks both.
    expect(next.cards[sq.instanceId].curShields).toBe(2);
  });

  it("Regenerative tops out at 5 shields", () => {
    const s = prepState();
    const sq = place(s, "leaf_squanch", "P1", 3, 0, { curShields: 4, hitsTakenThisRound: 3 });
    place(s, "dusk_gool", "P2", 3, 1); // keep P2's board alive
    const next = advance(atCleanup(s));
    expect(next.cards[sq.instanceId].curShields).toBe(5); // 4 + 3 clamped to the cap
  });

  it("Regenerative is defensive — Squanch's own landed attacks grow nothing", () => {
    const s = prepState();
    // Below max HP for the same reason as the test above: a full-health LEAF
    // card now hardens into +1 shield from Photosynthesis, which would read as
    // Regenerative firing off its own attack. Hurt, the aura heals instead.
    const sq = place(s, "leaf_squanch", "P1", 3, 0, { curShields: 0, curHp: 20, maxHp: 23 });
    const foe = place(s, "dusk_gool", "P2", 3, 1, { curHp: 40, maxHp: 40 });
    basicAttack(s, sq.instanceId, foe.instanceId);
    const next = advance(atCleanup(s));
    expect(next.cards[sq.instanceId].curShields).toBe(0);
  });

  it("Rhe's Rocky Force Field can deflect a ranged hit (but not melee)", () => {
    const s = prepState();
    const rhe = place(s, "bore_rhe", "P1", 2, 0, { curHp: 9, curShields: 0 });
    const ranged = place(s, "pyro_flamehound", "P2", 1, 0); // Ranged, 5 DMG
    s.rngState = seedForCoins(true); // force the 50% deflect
    basicAttack(s, ranged.instanceId, rhe.instanceId);
    expect(s.cards[rhe.instanceId].curHp).toBe(9); // deflected, no damage

    const s2 = prepState();
    const rhe2 = place(s2, "bore_rhe", "P1", 2, 0, { curHp: 9, curShields: 0 });
    const melee = place(s2, "dusk_vamp", "P2", 2, 1, { curHp: 20 }); // a REAL Melee attacker (Gool is Ranged)
    basicAttack(s2, melee.instanceId, rhe2.instanceId);
    expect(s2.cards[rhe2.instanceId].curHp).toBeLessThan(9); // field only deflects ranged, never melee
  });

  it("WolfBane's Hastened Assault CRITs only when faster, healing per crit", () => {
    const s = prepState();
    const wolf = place(s, "gale_wolfbane", "P1", 3, 0, { curHp: 10, maxHp: 17 }); // SP 4
    const slow = place(s, "bore_hillbilly", "P2", 3, 1, { curHp: 40, maxHp: 40, curShields: 0 }); // SP 2 < 4
    s.rngState = seedForCoins(true); // crit coin succeeds
    basicAttack(s, wolf.instanceId, slow.instanceId);
    expect(s.cards[slow.instanceId].curHp).toBe(40 - 18); // 9 DMG doubled by CRIT
    expect(s.cards[wolf.instanceId].curHp).toBe(13); // 10 + 3 heal per crit
  });
});

describe("Voltogon — Powertrip (electrified-only, once per round)", () => {
  it("only jolts statused enemies, and only on the first kill of the round", () => {
    const s = prepState();
    const volt = place(s, "bolt_voltogon", "P1", 2, 0); // dmg 7
    const shocked = place(s, "dusk_gool", "P2", 1, 0, {
      curHp: 20, maxHp: 40, curShields: 0,
      status: { kind: "BURN", duration: 2, power: 2, source: "PYRO" },
    });
    const clean = place(s, "dusk_gool", "P2", 1, 1, { curHp: 20, maxHp: 40, curShields: 0 });
    const prey1 = place(s, "dusk_vamp", "P2", 2, 1, { curHp: 1 }); // adjacent, dies
    basicAttack(s, volt.instanceId, prey1.instanceId);
    expect(s.cards[prey1.instanceId]).toBeUndefined();
    expect(s.cards[shocked.instanceId].curHp).toBe(15); // −5 Powertrip
    expect(s.cards[clean.instanceId].curHp).toBe(20); // not electrified → spared

    // A second kill in the SAME round does not re-fire Powertrip.
    const prey2 = place(s, "dusk_vamp", "P2", 2, 1, { curHp: 1 });
    basicAttack(s, volt.instanceId, prey2.instanceId);
    expect(s.cards[shocked.instanceId].curHp).toBe(15); // unchanged
  });
});

describe("complex-tier passives (audit batch)", () => {
  it("Sarra's Bluflame (SEAL) blocks all healing", () => {
    const s = prepState();
    const foe = place(s, "dusk_gool", "P2", 1, 0, { curHp: 5, maxHp: 20 });
    expect(healCard(s, foe, 4)).toBe(4); // heals normally first
    applyStatus(s, foe, "SEAL", 2, 0, "PYRO");
    expect(healCard(s, foe, 4)).toBe(0); // sealed — no healing
    expect(s.cards[foe.instanceId].curHp).toBe(9);
  });

  it("Vaga's Shadow lets only adjacent attackers reach it", () => {
    const s = prepState();
    const vaga = place(s, "gale_vaga", "P1", 2, 0);
    const farRanged = place(s, "pyro_flamehound", "P2", 0, 0); // ranged, 2 rows away
    const adjacent = place(s, "dusk_gool", "P2", 1, 1); // king-adjacent (ranged too)
    expect(canTarget(s, farRanged, vaga)).toBe(false); // can't reach through Shadow
    expect(canTarget(s, adjacent, vaga)).toBe(true); // adjacent reaches
  });

  it("Solstice's Radiant Ward absorbs one team status per round, then lets the next land", () => {
    const s = prepState();
    place(s, "dawn_solstice", "P1", 3, 0);
    const ally = place(s, "dawn_beam", "P1", 2, 0);
    const next = advance(atCleanup(s)); // roundTick raises the team ward
    expect(next.players.P1.statusWard).toBe(true);
    applyStatus(next, next.cards[ally.instanceId], "BURN", 2, 3, "PYRO"); // absorbed
    expect(next.cards[ally.instanceId].statuses).toHaveLength(0);
    expect(next.players.P1.statusWard).toBe(false); // ward spent
    applyStatus(next, next.cards[ally.instanceId], "ROOT", 2, 0, "LEAF"); // now lands
    expect(next.cards[ally.instanceId].statuses.some((st) => st.kind === "ROOT")).toBe(true);
  });

  it("the ward does NOT absorb once Solstice (its provider) has died", () => {
    const s = prepState();
    const sol = place(s, "dawn_solstice", "P1", 3, 0);
    const ally = place(s, "dawn_beam", "P1", 2, 0);
    const next = advance(atCleanup(s)); // ward raised while Solstice lives
    expect(next.players.P1.statusWard).toBe(true);
    next.cards[sol.instanceId].curHp = 0; // Solstice dies mid-round
    applyStatus(next, next.cards[ally.instanceId], "STUN", 2, 0, "BOLT");
    // With no living ward-holder, the STUN lands and the stale flag clears.
    expect(next.cards[ally.instanceId].statuses.some((st) => st.kind === "STUN")).toBe(true);
    expect(next.players.P1.statusWard).toBe(false);
  });

  it("Veil's Gate Keeper starts with the +8 golden shield and hardens on break", () => {
    const s = prepState();
    const veil = place(s, "dawn_veil", "P1", 2, 0); // base 3 + 8 grant = 11
    expect(s.cards[veil.instanceId].curShields).toBe(11);
    // Knock the shield to 0: place with 1 shield to see the break buff cleanly.
    const veil2 = place(s, "dawn_veil", "P1", 3, 0, { curShields: 1 });
    const hitter = place(s, "dusk_gool", "P2", 3, 1, { curHp: 20 });
    basicAttack(s, hitter.instanceId, veil2.instanceId);
    const v = s.cards[veil2.instanceId];
    expect(v.curShields).toBe(0);
    expect(v.dmgBonus).toBe(1); // Gate Keeper break buff
    expect(v.spBonus).toBe(2);
  });

  it("Imperator's Crowned cleanses negative statuses from allies each round", () => {
    const s = prepState();
    place(s, "dawn_imperator", "P1", 2, 0);
    const ally = place(s, "dawn_beam", "P1", 3, 0, {
      status: { kind: "BURN", duration: 3, power: 2, source: "PYRO" },
    });
    const next = advance(atCleanup(s));
    expect(next.cards[ally.instanceId].statuses.some((st) => st.kind === "BURN")).toBe(false);
  });
});

describe("vsStatus conditional keyword", () => {
  it("Alpha lifesteals only vs ROOTed targets (Gnashing Bite)", () => {
    const rooted = prepState();
    const alpha = place(rooted, "leaf_alpha", "P1", 3, 0, { curHp: 5 });
    const rootedFoe = place(rooted, "dusk_gool", "P2", 3, 1, {
      curHp: 20,
      status: { kind: "ROOT", duration: 2, power: 0, source: "LEAF" },
    });
    basicAttack(rooted, alpha.instanceId, rootedFoe.instanceId);
    expect(rooted.cards[alpha.instanceId].curHp).toBeGreaterThan(5); // healed

    const notRooted = prepState();
    const a2 = place(notRooted, "leaf_alpha", "P1", 3, 0, { curHp: 5 });
    const t2 = place(notRooted, "dusk_gool", "P2", 3, 1, { curHp: 20 });
    basicAttack(notRooted, a2.instanceId, t2.instanceId);
    expect(notRooted.cards[a2.instanceId].curHp).toBe(5); // no heal
  });
});

describe("thorns (onHitByMelee)", () => {
  it("Thorn's Transfusion BLEEDs a melee attacker", () => {
    const s = prepState();
    const attacker = place(s, "gale_duster", "P1", 2, 0); // Melee assassin
    const thorn = place(s, "leaf_thorn", "P2", 2, 1, { curHp: 18 });
    basicAttack(s, attacker.instanceId, thorn.instanceId);
    expect(s.cards[attacker.instanceId].statuses.some((x) => x.kind === "BLEED")).toBe(true);
  });
});

describe("gated on-hit riders", () => {
  it("Gool FRIGHTENs only on the first hit of a round", () => {
    const s = prepState();
    const gool = place(s, "dusk_gool", "P1", 2, 0);
    const target = place(s, "aqua_coralgolem", "P2", 2, 1, { curHp: 30 });
    basicAttack(s, gool.instanceId, target.instanceId);
    const afterFirst = s.cards[target.instanceId].statuses.filter((x) => x.kind === "FRIGHTEN").length;
    // clear the FRIGHTEN and hit again in the SAME round → no re-application
    s.cards[target.instanceId].statuses = [];
    basicAttack(s, gool.instanceId, target.instanceId);
    const afterSecond = s.cards[target.instanceId].statuses.filter((x) => x.kind === "FRIGHTEN").length;
    expect(afterFirst).toBe(1);
    expect(afterSecond).toBe(0); // gated: already struck this round
  });
});

describe("roundTick self effects", () => {
  it("Sandman's Sandstorm dings every enemy in Cleanup", () => {
    const s = prepState();
    place(s, "bore_sandman", "P1", 2, 0);
    place(s, "leaf_greegon", "P1", 3, 0); // keep P1 on the board
    const enemy = place(s, "dusk_gool", "P2", 1, 0, { curHp: 13 });
    const next = advance(atCleanup(s));
    expect(next.cards[enemy.instanceId].curHp).toBe(12); // −1 Sandstorm
  });

  it("Tiki's Sweeping Flames burns only the row directly ahead", () => {
    const s = prepState();
    const tiki = place(s, "pyro_tiki", "P1", 2, 0); // ahead = row 1
    const inFront = place(s, "dusk_gool", "P2", 1, 0, { curHp: 13 });
    const farBack = place(s, "dusk_gool", "P2", 0, 3, { curHp: 13 }); // not row ahead
    const next = advance(atCleanup(s));
    expect(next.cards[inFront.instanceId].curHp).toBe(12); // −1 Sweeping Flames
    expect(next.cards[farBack.instanceId].curHp).toBe(13); // untouched
    void tiki;
  });

  it("Smog's Black Smoke chokes every enemy in range, not just the row ahead", () => {
    const s = prepState();
    const smog = place(s, "pyro_smog_card", "P1", 2, 0); // ranged, mid row (clears the home-row rule)
    const near = place(s, "dusk_gool", "P2", 1, 0, { curHp: 13 }); // row directly ahead
    const far = place(s, "dusk_gool", "P2", 0, 3, { curHp: 13 }); // back home row — a ranged tick still reaches
    const next = advance(atCleanup(s));
    expect(next.cards[near.instanceId].curHp).toBe(12); // −1 Black Smoke
    expect(next.cards[far.instanceId].curHp).toBe(12); // whole board, unlike Sweeping Flames' row-ahead
    void smog;
  });
});

describe("Sol — Incinerate ramp", () => {
  it("consecutive hits on the same target climb +1 DMG each", () => {
    const s = prepState();
    const sol = place(s, "pyro_sol", "P1", 3, 0); // 3 DMG × 2 hits, home row (no mid bonus)
    const foe = place(s, "dusk_gool", "P2", 1, 0, { curHp: 40, maxHp: 40, curShields: 0 });
    basicAttack(s, sol.instanceId, foe.instanceId);
    // hit 1 = 3, hit 2 = 3+1 = 4  → 7 total this round
    expect(s.cards[foe.instanceId].curHp).toBe(40 - 7);
    // next attack on the SAME target keeps ramping (struckBefore = 2):
    // hit 3 = 3+2 = 5, hit 4 = 3+3 = 6 → 11 more
    basicAttack(s, sol.instanceId, foe.instanceId);
    expect(s.cards[foe.instanceId].curHp).toBe(40 - 7 - 11);
  });
});

describe("on-death row-ahead (Burnout)", () => {
  it("FireBird blasts the enemy row directly ahead when it dies", () => {
    const s = prepState();
    const fb = place(s, "pyro_firebird", "P1", 2, 0, { curHp: 1 });
    const killer = place(s, "dusk_gool", "P2", 2, 1); // adjacent, kills FireBird
    const victim = place(s, "dusk_vamp", "P2", 1, 0, { curHp: 6 }); // row ahead of FireBird
    basicAttack(s, killer.instanceId, fb.instanceId);
    expect(s.cards[fb.instanceId]).toBeUndefined();
    expect(s.cards[victim.instanceId].curHp).toBe(2); // −4 Burnout
  });
});

describe("King of the Hill: only 4+ hit cards trade the mid DMG for a hit", () => {
  it("1–3 hit cards gain +1 DMG in a mid row; 4+ hit cards gain +1 hit", () => {
    const s = prepState();
    const single = place(s, "pyro_firebird", "P1", 2, 0); // 5 dmg, 1 hit
    expect(effectiveDmg(s, single)).toBe(6); // +1 DMG in mid
    expect(effectiveBasicHits(single)).toBe(1);

    const twoHit = place(s, "gale_buf", "P1", 2, 1); // 2 dmg × 2 hits → below the 4 threshold
    expect(effectiveDmg(s, twoHit)).toBe(3); // +1 DMG
    expect(effectiveBasicHits(twoHit)).toBe(2); // NOT an extra hit

    const shredder = place(s, "aqua_vaporem", "P1", 2, 2); // 2 dmg × 5 hits
    expect(effectiveDmg(s, shredder)).toBe(2); // NO per-hit +1
    expect(effectiveBasicHits(shredder)).toBe(6); // +1 hit instead

    const home = place(s, "aqua_vaporem", "P1", 3, 3); // off the mid rows
    expect(effectiveBasicHits(home)).toBe(5);
  });

  it("assignable hits include bonuses — no false 'too many targets' rejection", () => {
    const s = prepState();
    // Fenrir base 2 hits + a permanent on-kill hit = 3 assignable.
    const fenrir = place(s, "pyro_fenrir", "P1", 1, 1, { hitsBonus: 1 });
    const a = place(s, "dusk_gool", "P2", 0, 0, { curHp: 20 });
    const b = place(s, "dusk_vamp", "P2", 0, 1, { curHp: 20 });
    const c = place(s, "dawn_flash", "P2", 0, 2, { curHp: 20 });
    s.phase = "battle";
    s.battle = { queue: [fenrir.instanceId], index: 0, awaitingInput: fenrir.instanceId };
    // 3 targets for a base-2-hit card would have thrown before the fix.
    const next = applyIntent(s, {
      type: "BATTLE_ACTION", player: "P1", action: "basic",
      targetIds: [a.instanceId, b.instanceId, c.instanceId],
    });
    expect(next.cards[a.instanceId].curHp).toBeLessThan(20);
    expect(next.cards[c.instanceId].curHp).toBeLessThan(20); // the 3rd hit landed
  });
});

describe("timed team buffs & −SP debuffs", () => {
  it("Golden Courage grants the team +1 DMG that lasts across a round", () => {
    const s = prepState();
    const dawn = place(s, "dawn_dawn", "P1", 3, 0);
    const ally = place(s, "gale_hawk", "P1", 3, 1); // 8 DMG, home row (no KotH)
    place(s, "dusk_gool", "P2", 0, 0); // keep P2 alive through Cleanup
    SPECIAL_HANDLERS.heal(s, dawn, [dawn, ally], { amount: 0, targets: 99, buffDmg: 1, buffRounds: 2 });
    expect(effectiveDmg(s, ally)).toBe(9); // 8 + 1
    const r1 = advance(atCleanup(s)); // one Cleanup: buff 2→1, still active
    expect(effectiveDmg(r1, r1.cards[ally.instanceId])).toBe(9);
  });

  it("Daybreak's +2 SP expires after one round", () => {
    const s = prepState();
    const sol = place(s, "dawn_solstice", "P1", 3, 0);
    const ally = place(s, "aqua_spinefin", "P1", 3, 1); // SP 7, no end-of-round SP change
    place(s, "dusk_gool", "P2", 0, 0);
    SPECIAL_HANDLERS.heal(s, sol, [sol, ally], { amount: 0, targets: 99, buffSp: 2, buffRounds: 1 });
    expect(effectiveSp(s, ally)).toBe(9); // 7 + 2
    const r1 = advance(atCleanup(s));
    expect(effectiveSp(r1, r1.cards[ally.instanceId])).toBe(7); // expired
  });

  it("Mighty Winds pushes enemies back and −8 SP for the round", () => {
    const s = prepState();
    const galeon = place(s, "gale_galeon", "P1", 3, 0);
    const foe = place(s, "dusk_gool", "P2", 2, 1, { curHp: 20 }); // SP 8, mid row
    SPECIAL_HANDLERS.statusNova(s, galeon, [foe], {
      statusKind: "WEAKEN", statusDuration: 2, targets: 99, push: 2, spDebuff: 8, spDebuffRounds: 1,
    });
    expect(s.cards[foe.instanceId].pos!.row).toBe(0); // pushed back 2 → P2 home row
    expect(effectiveSp(s, s.cards[foe.instanceId])).toBe(0); // 8 − 8
  });

  it("Purple Wind Surge applies −2 SP alongside its damage", () => {
    const s = prepState();
    const angale = place(s, "gale_angale", "P1", 2, 0);
    const foe = place(s, "dusk_gool", "P2", 1, 0, { curHp: 20 }); // SP 8
    SPECIAL_HANDLERS.barrage(s, angale, [foe], {
      dmg: 1, hits: 4, targets: 3, statusKind: "WEAKEN", statusDuration: 2, spDebuff: 2, spDebuffRounds: 2,
    });
    expect(effectiveSp(s, s.cards[foe.instanceId])).toBe(6); // 8 − 2
  });
});

describe("revive & transform", () => {
  it("Bearocks revives once at 24 HP with SLEEP, then can be killed", () => {
    const s = prepState();
    const bear = place(s, "bore_bearocks", "P1", 3, 0, { curHp: 5, curShields: 0 });
    const hawk = place(s, "gale_hawk", "P2", 0, 0); // 8 DMG
    basicAttack(s, hawk.instanceId, bear.instanceId);
    const b = s.cards[bear.instanceId];
    expect(b).toBeDefined(); // survived via revive
    expect(b.curHp).toBe(24);
    expect(b.revived).toBe(true);
    expect(b.statuses.some((x) => x.kind === "SLEEP")).toBe(true); // self-sleep bypasses immunity
    b.curHp = 3;
    basicAttack(s, hawk.instanceId, bear.instanceId);
    expect(s.cards[bear.instanceId]).toBeUndefined(); // no second revive
  });

  it("Skelider dismounts below 10 HP: loses its Special and 5 SP, deals 5", () => {
    const s = prepState();
    const skel = place(s, "dusk_skelider", "P1", 3, 0, { curHp: 12, curShields: 0 });
    const foe = place(s, "dusk_gool", "P2", 3, 1, { curHp: 20 }); // nearest enemy
    const hawk = place(s, "gale_hawk", "P2", 0, 0); // 8 DMG → drops Skelider to 4
    basicAttack(s, hawk.instanceId, skel.instanceId);
    const sk = s.cards[skel.instanceId];
    expect(sk.curHp).toBeLessThan(10);
    expect(sk.transformed).toBe(true);
    expect(canFireSpecial(s, sk.instanceId).ok).toBe(false); // Special lost
    expect(effectiveSp(s, sk)).toBe(5); // 10 − 5
    expect(s.cards[foe.instanceId].curHp).toBe(15); // 5 Dismount damage
  });
});

describe("Fallona's Fall's Emergence scales Leaf Storm", () => {
  it("Leaf Storm's per-hit damage grows with the accumulated DMG bonus", () => {
    const s = prepState();
    const fallona = place(s, "leaf_fallona", "P1", 3, 0, { dmgBonus: 2 }); // +2 from Fall's Emergence
    const foe = place(s, "dusk_gool", "P2", 0, 0, { curHp: 40 });
    SPECIAL_HANDLERS.barrage(s, fallona, [foe], { dmg: 1, hits: 3, targets: 99, scaleDmg: 1 });
    // each of 3 hits does 1 + 2 = 3 → 9 total (gool has no shields)
    expect(s.cards[foe.instanceId].curHp).toBe(31);
  });
});

describe("Klipso's Harsh Winds", () => {
  it("adds bonus DMG on the first strike vs an opponent, once", () => {
    const s = prepState();
    const klipso = place(s, "gale_klipso", "P1", 3, 0); // 9 DMG + 4 first-strike
    const foe = place(s, "dusk_gool", "P2", 3, 1, { curHp: 60 });
    basicAttack(s, klipso.instanceId, foe.instanceId);
    expect(s.cards[foe.instanceId].curHp).toBe(47); // 60 − (9 + 4)
    basicAttack(s, klipso.instanceId, foe.instanceId);
    expect(s.cards[foe.instanceId].curHp).toBe(38); // 47 − 9 (no bonus the 2nd time)
  });
});

describe("on-opponent-summon reactions", () => {
  it("react only to a newcomer IN RANGE: mid-row reactors zap, back-row ones don't", () => {
    const s = prepState(); // P1 has priority
    s.players.P1.summonPool = 5;
    // In range of the P1 home row (mid row = can reach it).
    place(s, "bore_rockgoblin", "P2", 2, 0); // Cave Guard: 4 DMG (adjacent to (3,0))
    place(s, "bolt_drshock", "P2", 2, 1); // Shocker: PARALYZE (ranged, from mid)
    const handId = giveHand(s, "P1", "dusk_gool"); // HP 13
    const next = applyIntent(s, { type: "SUMMON", player: "P1", handId, col: 0 });
    const fresh = boardCards(next, "P1").find((c) => c.defId === "dusk_gool")!;
    expect(fresh.curHp).toBe(9); // 13 − 4 Cave Guard
    expect(fresh.statuses.some((x) => x.kind === "PARALYZE")).toBe(true);

    // A reactor parked on its own home row can't reach the enemy home slot → no effect.
    const s2 = prepState();
    s2.players.P1.summonPool = 5;
    place(s2, "bolt_drshock", "P2", 0, 0); // back home row — out of range
    const h2 = giveHand(s2, "P1", "dusk_gool");
    const n2 = applyIntent(s2, { type: "SUMMON", player: "P1", handId: h2, col: 0 });
    const g2 = boardCards(n2, "P1").find((c) => c.defId === "dusk_gool")!;
    expect(g2.statuses.some((x) => x.kind === "PARALYZE")).toBe(false); // out of range
  });

  it("BaBoom's Swinging Sweep booms every enemy in king's reach on summon, sparing distant ones", () => {
    const s = prepState();
    s.players.P1.summonPool = 5;
    // BaBoom summons at (3,0); king's reach is the adjacent tiles (2,0),(2,1),(3,1).
    const near = place(s, "dusk_gool", "P2", 2, 1, { curHp: 20, maxHp: 40, curShields: 0 }); // adjacent
    const farCol = place(s, "dusk_gool", "P2", 2, 3, { curHp: 20, maxHp: 40, curShields: 0 }); // same row, too far
    const farRow = place(s, "dusk_gool", "P2", 1, 0, { curHp: 20, maxHp: 40, curShields: 0 }); // 2 rows away
    const handId = giveHand(s, "P1", "pyro_baboom");
    const next = applyIntent(s, { type: "SUMMON", player: "P1", handId, col: 0 });
    expect(next.cards[near.instanceId].curHp).toBe(18); // −2 boom (adjacent)
    expect(next.cards[farCol.instanceId].curHp).toBe(20); // out of king's reach
    expect(next.cards[farRow.instanceId].curHp).toBe(20);
  });

  it("Rock Goblin's Cave Guard stays silent for a summon out of its melee range", () => {
    const s = prepState();
    s.players.P1.summonPool = 5;
    place(s, "bore_rockgoblin", "P2", 0, 3); // far corner — nowhere near (3,0)
    const handId = giveHand(s, "P1", "dusk_gool"); // HP 13
    const next = applyIntent(s, { type: "SUMMON", player: "P1", handId, col: 0 });
    const fresh = boardCards(next, "P1").find((c) => c.defId === "dusk_gool")!;
    expect(fresh.curHp).toBe(13); // untouched — Rock Goblin couldn't reach it
  });
});

describe("FLYING melee targeting", () => {
  it("a flier dodges grounded melee but not a flying melee attacker", () => {
    const s = prepState();
    const flyingTarget = place(s, "dusk_crow", "P2", 2, 1); // FLYING
    const grounded = place(s, "gale_duster", "P1", 2, 0); // Melee, not flying
    const flyingMelee = place(s, "pyro_fenrir", "P1", 2, 2); // Melee AND FLYING
    expect(canTarget(s, grounded, flyingTarget)).toBe(false); // dodges grounded melee
    expect(canTarget(s, flyingMelee, flyingTarget)).toBe(true); // flier can hit a flier
  });
});

describe("FLYING diagonal movement", () => {
  it("a FLYING card moves diagonally for 1 space; a grounded one at reach 1 can't", () => {
    const s = prepState(); // Prep, P1 has priority
    const flyer = place(s, "pyro_fenrir", "P1", 3, 1); // FLYING, SP 7 → reach 1
    expect(canMove(s, "P1", flyer.instanceId, { row: 2, col: 0 }).ok).toBe(true); // diagonal

    const grounded = place(s, "leaf_squanch", "P1", 3, 3); // not FLYING, SP 3 → reach 1
    expect(canMove(s, "P1", grounded.instanceId, { row: 2, col: 2 }).ok).toBe(false); // diagonal = 2 for it
  });
});

describe("Star's Raising Star", () => {
  it("BLINDs ALL opponents each round, not just the closest", () => {
    const s = prepState();
    place(s, "dawn_star", "P1", 2, 0);
    const near = place(s, "dusk_gool", "P2", 1, 0, { curHp: 13 }); // closest
    const far = place(s, "dusk_gool", "P2", 1, 3, { curHp: 13 }); // far column
    const next = advance(atCleanup(s));
    expect(next.cards[near.instanceId].statuses.some((x) => x.kind === "BLIND")).toBe(true);
    expect(next.cards[far.instanceId].statuses.some((x) => x.kind === "BLIND")).toBe(true);
  });
});

describe("Sandman's Nightmare", () => {
  it("his hits don't wake a sleeper, and deal 2× DMG to a SLEEPING target", () => {
    const s = prepState();
    const sandman = place(s, "bore_sandman", "P1", 3, 0); // home row: no mid bonus
    const foe = place(s, "dusk_gool", "P2", 0, 0, {
      curHp: 40,
      status: { kind: "SLEEP", duration: 2, power: 0, source: "BORE" },
    });
    basicAttack(s, sandman.instanceId, foe.instanceId);
    const f = s.cards[foe.instanceId];
    expect(f.statuses.some((x) => x.kind === "SLEEP")).toBe(true); // never woke
    expect(f.curHp).toBe(20); // 5 hits × (2 DMG ×2 vs SLEEPING) = 20
  });

  it("the bonus escalates: +2 in a mid row and +3 when the mid lane is crowded", () => {
    const s = prepState();
    const sandman = place(s, "bore_sandman", "P1", 2, 0); // mid row
    const foe = place(s, "dusk_gool", "P2", 1, 0, { curHp: 80 });
    place(s, "leaf_greegon", "P1", 2, 1); // 4 cards across the mid rows
    place(s, "dusk_vamp", "P2", 1, 1);
    basicAttack(s, sandman.instanceId, foe.instanceId);
    // In a mid row a 5-hit card also gains the KotH +1 hit → 6×2 = 12,
    // + midLane 2 + midLaneFull 3 = 17.
    expect(s.cards[foe.instanceId].curHp).toBe(63);
  });
});

describe("element auras", () => {
  it("Exostone (BORE): a summoned card enters with +2 shields", () => {
    const s = prepState();
    s.players.P1.summonPool = 5;
    const handId = giveHand(s, "P1", "bore_rockgoblin"); // base 2 shields
    const next = applyIntent(s, { type: "SUMMON", player: "P1", handId, col: 0 });
    const goblin = boardCards(next, "P1").find((c) => c.defId === "bore_rockgoblin")!;
    expect(goblin.curShields).toBe(4); // 2 base + 2 Exostone
  });

  it("Zephyr (GALE): a GALE card gains +1 SP each Cleanup", () => {
    const s = prepState();
    const hawk = place(s, "gale_hawk", "P1", 2, 0);
    place(s, "leaf_greegon", "P1", 3, 0); // keep P1 alive
    place(s, "dusk_gool", "P2", 0, 0);
    const next = advance(atCleanup(s));
    expect(next.cards[hawk.instanceId].spBonus).toBe(1);
  });

  it("Scorch (PYRO): basic attacks apply BURN", () => {
    const s = prepState();
    const flame = place(s, "pyro_flamehound", "P1", 2, 0); // no BURN rider of its own
    const t = place(s, "dusk_gool", "P2", 2, 1, { curHp: 15 });
    basicAttack(s, flame.instanceId, t.instanceId);
    expect(s.cards[t.instanceId].statuses.some((x) => x.kind === "BURN")).toBe(true);
  });

  it("Midnight Shade (DUSK): a dying DUSK card hits its killer for a THIRD of its DMG", () => {
    // Cut from a half. It fired ~10 times a game — the only aura that pays out
    // for LOSING cards, which is exactly the disposable-body game DUSK is best
    // at (7 of its cards cost 2 or less, two of them spawnable tokens).
    const s = prepState();
    const killer = place(s, "gale_duster", "P1", 2, 0, { curHp: 9 });
    const dusk = place(s, "dusk_reaper", "P2", 2, 1, { curHp: 1 }); // DMG 7 → third 2
    basicAttack(s, killer.instanceId, dusk.instanceId);
    expect(s.cards[dusk.instanceId]).toBeUndefined();
    expect(s.cards[killer.instanceId].curHp).toBe(7); // 9 − 2 (was 3 at a half)
  });

  it("...and the cheapest bodies now lash out for nothing at all", () => {
    // A consequence worth pinning rather than discovering: at 2 DMG the third
    // floors to zero, so Vamp and Spider — the throwaway cards the aura most
    // rewarded losing — give their killer nothing back.
    const s = prepState();
    const killer = place(s, "gale_duster", "P1", 2, 0, { curHp: 5 });
    const vamp = place(s, "dusk_vamp", "P2", 2, 1, { curHp: 1 }); // DMG 2 → third 0
    basicAttack(s, killer.instanceId, vamp.instanceId);
    expect(s.cards[vamp.instanceId]).toBeUndefined();
    expect(s.cards[killer.instanceId].curHp).toBe(5); // untouched
  });

  it("Awakening (DAWN): summoning strikes the nearest enemy for half its DMG", () => {
    const s = prepState();
    s.players.P1.summonPool = 5;
    const foe = place(s, "dusk_gool", "P2", 2, 0, { curHp: 15 });
    const handId = giveHand(s, "P1", "dawn_solstice"); // DMG 5 → half 2
    const next = applyIntent(s, { type: "SUMMON", player: "P1", handId, col: 0 });
    expect(next.cards[foe.instanceId].curHp).toBe(13); // 15 − 2 Awakening
  });

  it("Flow Change (AQUA): a human summon defers the choice, then Liquid grants +2 DMG permanently", () => {
    const s = prepState();
    s.players.P1.summonPool = 5;
    const handId = giveHand(s, "P1", "aqua_spinefin");
    const summoned = applyIntent(s, { type: "SUMMON", player: "P1", handId, col: 0 });
    const fin = boardCards(summoned, "P1").find((c) => getDef(c.defId).element === "AQUA")!;
    expect(summoned.pendingFlow).toBe(fin.instanceId); // deferred to the human
    expect(fin.dmgBonus).toBe(0); // not applied until chosen
    const picked = applyIntent(summoned, {
      type: "FLOW_CHANGE", player: "P1", instanceId: fin.instanceId, mode: "water",
    });
    // dmgBonus, not dmgBonusRound: the SUMMON pick persists now. It used to be
    // wiped at the next Cleanup, so an AQUA card got its aura for one round and
    // never again — the weakest aura in the game by structure.
    expect(picked.cards[fin.instanceId].dmgBonus).toBe(2);
    expect(picked.cards[fin.instanceId].dmgBonusRound).toBe(0);
    expect(picked.pendingFlow).toBeNull();
  });

  it("Flow Change Liquid: +1 hit on a multi-hit card, +2 DMG on a single-hit card", () => {
    const s = prepState();
    // Vaporem strikes 2×5 — Liquid must add a HIT, not +2 to every hit.
    // Placed on the home row to isolate Liquid from the mid-lane hit bonus.
    const vap = place(s, "aqua_vaporem", "P1", 3, 0);
    applyFlow(vap, "water");
    expect(vap.hitsBonusRound).toBe(1);
    expect(vap.dmgBonusRound).toBe(0);
    expect(effectiveBasicHits(vap)).toBe(6); // base 5 + 1

    // Spinefin is single-hit — Liquid gives the flat +2 DMG.
    const fin = place(s, "aqua_spinefin", "P1", 3, 1);
    applyFlow(fin, "water");
    expect(fin.dmgBonusRound).toBe(2);
    expect(fin.hitsBonusRound).toBe(0);
  });

  it("Flow Change (AQUA): an AI summon auto-picks immediately (Tank → Frozen shields)", () => {
    const s = prepState(42, "P2"); // P2 (AI) has priority
    s.players.P2.summonPool = 5;
    const handId = giveHand(s, "P2", "aqua_coralgolem"); // Tank, base 4 shields
    const next = applyIntent(s, { type: "SUMMON", player: "P2", handId, col: 0 });
    const golem = boardCards(next, "P2").find((c) => c.defId === "aqua_coralgolem")!;
    expect(next.pendingFlow).toBeNull(); // no prompt for the AI
    expect(golem.curShields).toBe(7); // 4 base + 3 Frozen
    expect(golem.tempShields).toBe(0); // KEPT — tempShields is the refund marker
  });

  it("Electrify (BOLT): +2 DMG vs a statused opponent", () => {
    const withStatus = prepState();
    const zap = place(withStatus, "bolt_zap", "P1", 3, 0); // DMG 5, home row (no KotH)
    const t = place(withStatus, "dusk_gool", "P2", 3, 1, {
      curHp: 20,
      status: { kind: "ROOT", duration: 2, power: 0, source: "LEAF" },
    });
    basicAttack(withStatus, zap.instanceId, t.instanceId);
    expect(withStatus.cards[t.instanceId].curHp).toBe(13); // 20 − 7 (5 + Electrify 2)

    const noStatus = prepState();
    const z2 = place(noStatus, "bolt_zap", "P1", 3, 0);
    const t2 = place(noStatus, "dusk_gool", "P2", 3, 1, { curHp: 20 });
    basicAttack(noStatus, z2.instanceId, t2.instanceId);
    expect(noStatus.cards[t2.instanceId].curHp).toBe(15); // 20 − 5 (no bonus)
  });
});

describe("partial-effect fixes (Epic sweep)", () => {
  it("Bahari's Liquification heals +1 per landed basic hit", () => {
    const s = prepState();
    const b = place(s, "aqua_bahari", "P1", 3, 0, { curHp: 5, maxHp: 12 }); // 2×2 Ranged, home row
    const foe = place(s, "dusk_gool", "P2", 1, 0, { curHp: 20, curShields: 0 });
    basicAttack(s, b.instanceId, foe.instanceId);
    expect(s.cards[b.instanceId].curHp).toBe(7); // +1 × 2 landed hits
  });

  it("Twins' Rager halves its basic DMG while below 12 HP", () => {
    const s = prepState();
    const low = place(s, "pyro_twins", "P1", 3, 0, { curHp: 8, maxHp: 29 }); // home row, below 12
    const foe = place(s, "dusk_gool", "P2", 2, 0, { curHp: 20, curShields: 0 });
    basicAttack(s, low.instanceId, foe.instanceId);
    expect(s.cards[foe.instanceId].curHp).toBe(18); // 2×2 halved → 1×2 = 2 dmg
  });

  it("Zagphu's Precision Strike fires vs ANY statused (Electrified) foe, not just PARALYZED", () => {
    const s = prepState();
    const z = place(s, "bolt_zagphu", "P1", 3, 0, { curHp: 5, maxHp: 12 });
    const foe = place(s, "dusk_gool", "P2", 2, 0, {
      curHp: 30, curShields: 0,
      status: { kind: "BURN", duration: 2, power: 1, source: "PYRO" }, // statused, NOT paralyzed
    });
    basicAttack(s, z.instanceId, foe.instanceId);
    expect(s.cards[z.instanceId].curHp).toBe(9); // healOnHit +4 fired (anyStatus match)
  });

  it("Whirlwolf's Hastening Breeze gives +5 SP to ALL allies, not just the nearest", () => {
    const s = prepState();
    s.players.P1.summonPool = 5;
    const near = place(s, "leaf_greegon", "P1", 3, 0);
    const far = place(s, "leaf_greegon", "P1", 3, 3); // farther than the nearest ally
    const handId = giveHand(s, "P1", "gale_whirlwolf");
    const next = applyIntent(s, { type: "SUMMON", player: "P1", handId, col: 1 });
    expect(next.cards[near.instanceId].spBonus).toBe(5);
    expect(next.cards[far.instanceId].spBonus).toBe(5); // all-allies, not self+nearest
  });

  it("Static Charge (On Kill) extends PARALYZE on already-paralyzed foes by 1 round", () => {
    const s = prepState();
    const stat = place(s, "bolt_static", "P1", 3, 0); // Ranged, dmg 4
    const dying = place(s, "dusk_vamp", "P2", 1, 0, { curHp: 1, curShields: 0 });
    const paralyzed = place(s, "dusk_gool", "P2", 1, 1, {
      curHp: 20, curShields: 0,
      status: { kind: "PARALYZE", duration: 2, power: 0, source: "BOLT" },
    });
    basicAttack(s, stat.instanceId, dying.instanceId);
    expect(s.cards[dying.instanceId]).toBeUndefined(); // killed
    expect(s.cards[paralyzed.instanceId].statuses.find((x) => x.kind === "PARALYZE")?.duration).toBe(3); // 2 → 3
  });

  it("Clipsey's Hot Shot never misses — ignores the target's EVASION", () => {
    const s = prepState();
    const c = place(s, "dawn_clipsey", "P1", 3, 0); // 1×7 Ranged, alwaysHit
    const eva = place(s, "dusk_silkstalker", "P2", 1, 0, { curHp: 20, curShields: 0 }); // EVASION keyword
    basicAttack(s, c.instanceId, eva.instanceId);
    expect(s.cards[eva.instanceId].curHp).toBe(13); // all 7 hits land (no dodge)
  });

  it("Radiance's Brightest Warrior scales off the strongest foe on summon", () => {
    const s = prepState();
    s.players.P1.summonPool = 6;
    place(s, "leaf_squanch", "P2", 0, 0, { maxHp: 23 }); // strongest foe: 23 max HP
    const handId = giveHand(s, "P1", "dawn_radiance");
    const next = applyIntent(s, { type: "SUMMON", player: "P1", handId, col: 0 });
    const rad = Object.values(next.cards).find((c) => c.defId === "dawn_radiance")!;
    expect(rad.maxHp).toBe(20); // 17 + floor(23/7)=3
    expect(rad.dmgBonus).toBe(3); // +3 DMG
  });
});

describe("element-aura telegraphs (fx counters)", () => {
  it("DAWN's Awakening bumps fxLunge on the card that strikes", () => {
    // Fires on SUMMON, outside any battle turn — without a counter the victim
    // just loses HP with nothing on screen to explain it.
    const s = prepState();
    s.players.P1.summonPool = 9;
    const foe = place(s, "dusk_gool", "P2", 2, 0, { curHp: 40, maxHp: 40, curShields: 0 });
    // Musk Ox, not GoldenEagle: Awakening is floor(dmg / 2), and a 1-DMG card
    // deals 0, so the aura never fires and there'd be nothing to telegraph.
    const handId = giveHand(s, "P1", "dawn_musk_ox"); // DAWN, 6 DMG -> strikes for 3
    const next = applyIntent(s, { type: "SUMMON", player: "P1", handId, col: 0 });
    const summoned = boardCards(next, "P1").find((c) => c.defId === "dawn_musk_ox")!;
    expect(next.cards[foe.instanceId].curHp).toBe(37); // it really struck
    expect(summoned.fxLunge ?? 0).toBe(1);
  });

  it("DUSK's Midnight Shade bumps fxRecoil on the KILLER, not the corpse", () => {
    // The dying card is removed by defeatCard before the aura resolves, so the
    // telegraph has to live on the survivor or it can never be drawn.
    const s = prepState();
    const killer = place(s, "leaf_alpha", "P1", 2, 0, { curHp: 30, maxHp: 30 });
    const dusk = place(s, "dusk_gool", "P2", 1, 0, { curHp: 1, maxHp: 20, curShields: 0 });
    basicAttack(s, killer.instanceId, dusk.instanceId);
    expect(s.cards[dusk.instanceId]).toBeUndefined(); // corpse is gone
    expect(s.cards[killer.instanceId].fxRecoil ?? 0).toBe(1);
  });

  it("an ordinary kill leaves the counters alone", () => {
    // Guards against the telegraph firing on every death and becoming noise.
    const s = prepState();
    const killer = place(s, "leaf_alpha", "P1", 2, 0, { curHp: 30, maxHp: 30 });
    const plain = place(s, "leaf_greegon", "P2", 1, 0, { curHp: 1, maxHp: 20, curShields: 0 }); // not DUSK
    basicAttack(s, killer.instanceId, plain.instanceId);
    expect(s.cards[killer.instanceId].fxRecoil ?? 0).toBe(0);
    expect(s.cards[killer.instanceId].fxLunge ?? 0).toBe(0);
  });
});

describe("Hawko — Aerial Dominance", () => {
  it("clips an enemy summoned inside its range", () => {
    // P1 summons into its OWN home row (3); Hawko watches from P2's mid row.
    const s = prepState();
    s.players.P1.summonPool = 9;
    place(s, "gale_hawko", "P2", 2, 0);
    const handId = giveHand(s, "P1", "dusk_gool");
    const next = applyIntent(s, { type: "SUMMON", player: "P1", handId, col: 0 });
    const fresh = boardCards(next, "P1").find((c) => c.defId === "dusk_gool")!;
    expect(getDef("dusk_gool").hp - fresh.curHp).toBe(1);
  });

  it("...and stays silent for one summoned out of reach", () => {
    // The reaction is gated on canTarget, so it is a zone of control rather
    // than a free tax on every summon the opponent makes.
    const s = prepState();
    s.players.P1.summonPool = 9;
    place(s, "gale_hawko", "P2", 0, 3); // its own home row, far corner
    const handId = giveHand(s, "P1", "dusk_gool");
    const next = applyIntent(s, { type: "SUMMON", player: "P1", handId, col: 0 });
    const fresh = boardCards(next, "P1").find((c) => c.defId === "dusk_gool")!;
    expect(fresh.curHp).toBe(getDef("dusk_gool").hp); // untouched
  });

  it("is fast enough to act before almost anything (SP 14)", () => {
    // The whole point of the HP 11 -> 5 / SP 8 -> 14 rebuild. If the speed did
    // not translate into queue position, the trade bought nothing.
    const s = prepState();
    const hawko = place(s, "gale_hawko", "P1", 2, 0);
    const brute = place(s, "bore_clubber", "P2", 1, 0);
    expect(effectiveSp(s, s.cards[hawko.instanceId])).toBeGreaterThan(
      effectiveSp(s, s.cards[brute.instanceId]),
    );
  });
});

describe("Sphere — one heavy shot instead of a 2x2 volley", () => {
  it("BLOCK 2 only halves it now, where it used to blank the volley", () => {
    // BLOCK is flat and charged PER HIT. At 2x2 every shard was fully absorbed
    // (0 through), so armour was a hard counter. A single 4 pays BLOCK once.
    const s = prepState();
    const sphere = place(s, "dawn_sphere", "P1", 3, 0, { autoMode: "manual" });
    const armour = place(s, "bore_armadillo", "P2", 2, 0, {
      curHp: 40, maxHp: 40, curShields: 0, // shields off: BLOCK alone under test
    }); // BLOCK 2
    basicAttack(s, sphere.instanceId, armour.instanceId);
    expect(40 - s.cards[armour.instanceId].curHp).toBe(2); // 4 − BLOCK 2, once
  });

  it("the printed DMG also doubles its DAWN Awakening on summon", () => {
    // Awakening strikes for floor(printed DMG / 2) — it reads the printed
    // number, NOT dmg x hits, so moving 2x2 to 1x4 quietly doubles it from 1
    // to 2. Easy to ship without noticing.
    const s = prepState();
    s.players.P1.summonPool = 6;
    const foe = place(s, "dusk_gool", "P2", 2, 0, { curHp: 40, maxHp: 40, curShields: 0 });
    const handId = giveHand(s, "P1", "dawn_sphere");
    const next = applyIntent(s, { type: "SUMMON", player: "P1", handId, col: 0 });
    expect(40 - next.cards[foe.instanceId].curHp).toBe(2);
  });
});

describe("Electrify sets up its own payoff", () => {
  it("a BOLT basic leaves the target ELECTRIFIED", () => {
    // BOLT measured WORST on offence despite the second-best printed damage per
    // cost — the same shape LEAF had. "+1 vs a statused opponent" did nothing on
    // the opening hit of any exchange, while PYRO's equivalent has always done
    // its own setup.
    const s = prepState();
    const zap = place(s, "bolt_zap", "P1", 3, 0);
    const foe = place(s, "dusk_gool", "P2", 3, 1, { curHp: 30, maxHp: 30, curShields: 0 });
    basicAttack(s, zap.instanceId, foe.instanceId);
    expect(statusOf(s.cards[foe.instanceId], "ELECTRIFIED")).toBeTruthy();
  });

  it("...but never overwrites a real debuff with the inert marker", () => {
    // ELECTRIFIED exists only to BE a status. Stamping it over a ROOT would
    // trade a genuine effect for a bookkeeping mark.
    const s = prepState();
    const zap = place(s, "bolt_zap", "P1", 3, 0);
    const foe = place(s, "dusk_gool", "P2", 3, 1, {
      curHp: 30, maxHp: 30, curShields: 0,
      status: { kind: "ROOT", duration: 2, power: 0, source: "LEAF" },
    });
    basicAttack(s, zap.instanceId, foe.instanceId);
    expect(statusOf(s.cards[foe.instanceId], "ROOT")).toBeTruthy();
    expect(statusOf(s.cards[foe.instanceId], "ELECTRIFIED")).toBeUndefined();
  });

  it("non-BOLT cards mark nothing", () => {
    const s = prepState();
    const other = place(s, "gale_duster", "P1", 3, 0);
    const foe = place(s, "dusk_gool", "P2", 3, 1, { curHp: 30, maxHp: 30, curShields: 0 });
    basicAttack(s, other.instanceId, foe.instanceId);
    expect(statusOf(s.cards[foe.instanceId], "ELECTRIFIED")).toBeUndefined();
  });
});

describe("the reworked PYRO and AQUA auras", () => {
  it("Scorch STACKS: repeat basics deepen the burn instead of doing nothing", () => {
    // It used to skip a target that already had BURN, so PYRO's own repeat
    // attacks — and its card-specific BURN riders — did nothing for each other.
    const s = prepState();
    const pyro = place(s, "pyro_firebird", "P1", 3, 0, { autoMode: "manual" });
    const foe = place(s, "dusk_gool", "P2", 3, 1, { curHp: 99, maxHp: 99, curShields: 0 });
    basicAttack(s, pyro.instanceId, foe.instanceId);
    expect(statusOf(s.cards[foe.instanceId], "BURN")?.power).toBe(1);
    basicAttack(s, pyro.instanceId, foe.instanceId);
    expect(statusOf(s.cards[foe.instanceId], "BURN")?.power).toBe(2);
  });

  it("...and stops at the cap", () => {
    const s = prepState();
    const pyro = place(s, "pyro_firebird", "P1", 3, 0, { autoMode: "manual" });
    const foe = place(s, "dusk_gool", "P2", 3, 1, { curHp: 999, maxHp: 999, curShields: 0 });
    for (let i = 0; i < 8; i++) basicAttack(s, pyro.instanceId, foe.instanceId);
    expect(statusOf(s.cards[foe.instanceId], "BURN")?.power).toBe(PYRO_BURN_STACK_CAP);
  });

  it("...and builds ON a card's stronger BURN rider rather than replacing it", () => {
    const s = prepState();
    const pyro = place(s, "pyro_firebird", "P1", 3, 0, { autoMode: "manual" });
    const foe = place(s, "dusk_gool", "P2", 3, 1, { curHp: 99, maxHp: 99, curShields: 0 });
    applyStatus(s, s.cards[foe.instanceId], "BURN", 3, 3, "PYRO"); // a real rider
    basicAttack(s, pyro.instanceId, foe.instanceId);
    const b = statusOf(s.cards[foe.instanceId], "BURN")!;
    expect(b.power).toBe(4); // added to, never overwritten down to 1
    expect(b.duration).toBe(3); // and its duration survives
  });

  it("an AQUA summon pick survives Cleanup; a Downpour re-pick does not", () => {
    // Downpour re-picks Flow for every AQUA ally EVERY round, so a permanent
    // grant there would stack +2 DMG a round without limit. Only the summon
    // pick persists.
    const s = prepState();
    const fin = place(s, "aqua_spinefin", "P1", 3, 0);
    applyFlow(s.cards[fin.instanceId], "water", true); // summon pick
    applyFlow(s.cards[fin.instanceId], "water"); // Downpour re-pick
    expect(s.cards[fin.instanceId].dmgBonus).toBe(2);
    expect(s.cards[fin.instanceId].dmgBonusRound).toBe(2);
    place(s, "dusk_gool", "P2", 0, 1);
    const n = advance(atCleanup(s));
    expect(n.cards[fin.instanceId].dmgBonus).toBe(2); // kept
    expect(n.cards[fin.instanceId].dmgBonusRound).toBe(0); // wiped, as before
  });
});
