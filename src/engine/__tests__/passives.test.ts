// Restored card passives: the generic hooks (onKill, thorns, vsStatus, gated
// on-hit riders, roundTick, onDeath row-ahead) that back the doc-correct
// abilities in cards.ts.

import { describe, expect, it } from "vitest";
import { basicAttack, effectiveBasicHits, SPECIAL_HANDLERS } from "../combat";
import { applyFlow } from "../auras";
import { advance, applyIntent } from "../phases";
import { canFireSpecial } from "../rules";
import { boardCards, effectiveDmg, effectiveSp } from "../state";
import { getDef } from "../../data/cards";
import { atCleanup, giveHand, place, prepState } from "./helpers";

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

describe("King of the Hill: multi-hit cards get a hit, not per-hit DMG", () => {
  it("single-hit card in a mid row gains +1 DMG; multi-hit card gains +1 hit", () => {
    const s = prepState();
    const single = place(s, "pyro_firebird", "P1", 2, 0); // 5 dmg, 1 hit
    expect(effectiveDmg(s, single)).toBe(6); // +1 DMG in mid (unchanged)
    expect(effectiveBasicHits(single)).toBe(1);

    const multi = place(s, "aqua_vaporem", "P1", 2, 1); // 2 dmg × 5 hits
    expect(effectiveDmg(s, multi)).toBe(2); // NO per-hit +1
    expect(effectiveBasicHits(multi)).toBe(6); // +1 hit instead

    // Out of the mid rows, the multi-hit card is back to its printed hits.
    const home = place(s, "aqua_vaporem", "P1", 3, 2);
    expect(effectiveBasicHits(home)).toBe(5);
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
