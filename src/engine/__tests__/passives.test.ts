// Restored card passives: the generic hooks (onKill, thorns, vsStatus, gated
// on-hit riders, roundTick, onDeath row-ahead) that back the doc-correct
// abilities in cards.ts.

import { describe, expect, it } from "vitest";
import { basicAttack, effectiveBasicHits, SPECIAL_HANDLERS } from "../combat";
import { applyFlow } from "../auras";
import { advance, applyIntent } from "../phases";
import { canFireSpecial, canMove, canTarget } from "../rules";
import { boardCards, effectiveDmg, effectiveSp } from "../state";
import { getDef } from "../../data/cards";
import { atCleanup, giveHand, place, prepState, seedForCoins } from "./helpers";

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

  it("Squanch's Regenerative grows a shield on hit, capped at 5", () => {
    const s = prepState();
    const sq = place(s, "leaf_squanch", "P1", 3, 0, { curShields: 0 });
    const foe = place(s, "dusk_gool", "P2", 3, 1, { curHp: 40, maxHp: 40, curShields: 0 });
    basicAttack(s, sq.instanceId, foe.instanceId);
    expect(s.cards[sq.instanceId].curShields).toBe(1);
    s.cards[sq.instanceId].curShields = 5; // already at cap
    basicAttack(s, sq.instanceId, foe.instanceId);
    expect(s.cards[sq.instanceId].curShields).toBe(5); // no overflow
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
    const melee = place(s2, "dusk_gool", "P2", 2, 1, { curHp: 20 }); // Melee — unaffected
    basicAttack(s2, melee.instanceId, rhe2.instanceId);
    expect(s2.cards[rhe2.instanceId].curHp).toBeLessThan(9); // field doesn't stop melee
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

  it("Spitfire's Hot Hot doubles the BURN on a melee attacker", () => {
    const s = prepState();
    const spit = place(s, "pyro_spitfire", "P1", 2, 0, { curHp: 11 });
    const melee = place(s, "bore_hillbilly", "P2", 2, 1, {
      curHp: 20,
      status: { kind: "BURN", duration: 2, power: 2, source: "PYRO" },
    });
    basicAttack(s, melee.instanceId, spit.instanceId);
    const burn = s.cards[melee.instanceId].statuses.find((st) => st.kind === "BURN");
    expect(burn?.power).toBe(4); // 2 → doubled
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

describe("Sandman's Nightmare", () => {
  it("his hits don't wake a sleeper, and add +5 vs a SLEEPING target (once)", () => {
    const s = prepState();
    const sandman = place(s, "bore_sandman", "P1", 3, 0); // home row: no mid bonus
    const foe = place(s, "dusk_gool", "P2", 0, 0, {
      curHp: 40,
      status: { kind: "SLEEP", duration: 2, power: 0, source: "BORE" },
    });
    basicAttack(s, sandman.instanceId, foe.instanceId);
    const f = s.cards[foe.instanceId];
    expect(f.statuses.some((x) => x.kind === "SLEEP")).toBe(true); // never woke
    expect(f.curHp).toBe(25); // 5×2 volley (10) + 5 Nightmare bonus
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

  it("Midnight Shade (DUSK): a dying DUSK card hits its killer for half its DMG", () => {
    const s = prepState();
    const killer = place(s, "gale_duster", "P1", 2, 0, { curHp: 5 });
    const dusk = place(s, "dusk_vamp", "P2", 2, 1, { curHp: 1 }); // DMG 2 → half 1
    basicAttack(s, killer.instanceId, dusk.instanceId);
    expect(s.cards[dusk.instanceId]).toBeUndefined();
    expect(s.cards[killer.instanceId].curHp).toBe(4); // 5 − 1 Midnight Shade
  });

  it("Awakening (DAWN): summoning strikes the nearest enemy for half its DMG", () => {
    const s = prepState();
    s.players.P1.summonPool = 5;
    const foe = place(s, "dusk_gool", "P2", 2, 0, { curHp: 15 });
    const handId = giveHand(s, "P1", "dawn_solstice"); // DMG 5 → half 2
    const next = applyIntent(s, { type: "SUMMON", player: "P1", handId, col: 0 });
    expect(next.cards[foe.instanceId].curHp).toBe(13); // 15 − 2 Awakening
  });

  it("Flow Change (AQUA): a human summon defers the choice, then Liquid grants +2 DMG", () => {
    const s = prepState();
    s.players.P1.summonPool = 5;
    const handId = giveHand(s, "P1", "aqua_spinefin");
    const summoned = applyIntent(s, { type: "SUMMON", player: "P1", handId, col: 0 });
    const fin = boardCards(summoned, "P1").find((c) => getDef(c.defId).element === "AQUA")!;
    expect(summoned.pendingFlow).toBe(fin.instanceId); // deferred to the human
    expect(fin.dmgBonusRound).toBe(0); // not applied until chosen
    const picked = applyIntent(summoned, {
      type: "FLOW_CHANGE", player: "P1", instanceId: fin.instanceId, mode: "water",
    });
    expect(picked.cards[fin.instanceId].dmgBonusRound).toBe(2);
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
    expect(golem.tempShields).toBe(3); // temporary — removed in Cleanup
  });

  it("Electrify (BOLT): +1 DMG vs a statused opponent", () => {
    const withStatus = prepState();
    const zap = place(withStatus, "bolt_zap", "P1", 3, 0); // DMG 5, home row (no KotH)
    const t = place(withStatus, "dusk_gool", "P2", 3, 1, {
      curHp: 20,
      status: { kind: "ROOT", duration: 2, power: 0, source: "LEAF" },
    });
    basicAttack(withStatus, zap.instanceId, t.instanceId);
    expect(withStatus.cards[t.instanceId].curHp).toBe(14); // 20 − 6 (5 + Electrify)

    const noStatus = prepState();
    const z2 = place(noStatus, "bolt_zap", "P1", 3, 0);
    const t2 = place(noStatus, "dusk_gool", "P2", 3, 1, { curHp: 20 });
    basicAttack(noStatus, z2.instanceId, t2.instanceId);
    expect(noStatus.cards[t2.instanceId].curHp).toBe(15); // 20 − 5 (no bonus)
  });
});
