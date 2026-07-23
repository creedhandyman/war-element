// The 8 new element rares — exercises each card's passive (and the new engine
// hooks) so a wrong param, status kind, or cost can't slip through.

import { describe, expect, it } from "vitest";
import { advance, applyIntent } from "../phases";
import { basicAttack, directDamage, applyStatus } from "../combat";
import { canTarget } from "../rules";
import { atCleanup, giveHand, place, prepState, seedForCoins, statusOf } from "./helpers";

describe("rare passives", () => {
  it("BORE UFO — Radiation deals 2 PEN each Cleanup, straight through shields", () => {
    const s = prepState();
    place(s, "bore_ufo", "P1", 2, 0);
    const foe = place(s, "dusk_gool", "P2", 1, 0, { curHp: 13, curShields: 5 });
    const next = advance(atCleanup(s));
    expect(next.cards[foe.instanceId].curHp).toBe(11); // −2 to HP…
    expect(next.cards[foe.instanceId].curShields).toBe(5); // …shields untouched (PEN)
  });

  it("LEAF Sticks — Boon Striker hits for 7 on summon and saps the target's next attack", () => {
    const s = prepState();
    s.players.P1.summonPool = 5;
    const foe = place(s, "dusk_gool", "P2", 2, 0, { curHp: 20, curShields: 0 }); // adjacent to home (3,0)
    const handId = giveHand(s, "P1", "leaf_sticks");
    const next = applyIntent(s, { type: "SUMMON", player: "P1", handId, col: 0 });
    expect(next.cards[foe.instanceId].curHp).toBe(13); // 20 − 7
    expect(next.cards[foe.instanceId].nextAttackDmgDebuff).toBe(2); // −2 on its next basic
  });

  it("AQUA IcyNinza — Icy Mist cloaks it in STEALTH for 1 round on summon", () => {
    const s = prepState();
    s.players.P1.summonPool = 5;
    const handId = giveHand(s, "P1", "aqua_icyninza");
    const next = applyIntent(s, { type: "SUMMON", player: "P1", handId, col: 0 });
    const ninja = Object.values(next.cards).find((c) => c.defId === "aqua_icyninza")!;
    expect(statusOf(ninja, "STEALTH")?.duration).toBe(1); // cut from 2
    const foe = place(next, "dusk_gool", "P2", 1, 0);
    expect(canTarget(next, next.cards[foe.instanceId], ninja)).toBe(false); // untargetable
  });

  it("...and it opens with a 3 DMG attack that can CRIT, before vanishing", () => {
    // The opener asks for `crit` explicitly: IcyNinza's CRIT keyword only rides
    // BASIC attacks, so an on-summon handler lands uncritted without it. CRIT is
    // a coin flip on an unshielded target, so the roll is seeded — asserting a
    // flat 6 would pass or fail on the RNG.
    const s = prepState();
    s.rngState = seedForCoins(true); // the crit connects
    s.players.P1.summonPool = 5;
    const foe = place(s, "dusk_gool", "P2", 2, 0, { curHp: 40, maxHp: 40, curShields: 0 });
    const handId = giveHand(s, "P1", "aqua_icyninza");
    const next = applyIntent(s, { type: "SUMMON", player: "P1", handId, col: 0 });
    expect(40 - next.cards[foe.instanceId].curHp).toBe(6); // 3, doubled
    // ...and the cloak still lands, because the handler resolves first.
    const ninja = Object.values(next.cards).find((c) => c.defId === "aqua_icyninza")!;
    expect(statusOf(ninja, "STEALTH")?.duration).toBe(1);
  });

  it("...and lands its flat 3 when the crit misses", () => {
    const s = prepState();
    s.rngState = seedForCoins(false); // no crit
    s.players.P1.summonPool = 5;
    const foe = place(s, "dusk_gool", "P2", 2, 0, { curHp: 40, maxHp: 40, curShields: 0 });
    const handId = giveHand(s, "P1", "aqua_icyninza");
    const next = applyIntent(s, { type: "SUMMON", player: "P1", handId, col: 0 });
    expect(40 - next.cards[foe.instanceId].curHp).toBe(3);
  });

  it("PYRO Ingit — Hot Hot doubles the BURN on a melee attacker", () => {
    const s = prepState();
    const ingit = place(s, "pyro_ingit", "P1", 2, 0);
    const attacker = place(s, "leaf_alpha", "P2", 2, 1, { curHp: 20 });
    applyStatus(s, s.cards[attacker.instanceId], "BURN", 2, 2, "PYRO"); // power 2
    basicAttack(s, attacker.instanceId, ingit.instanceId);
    expect(statusOf(s.cards[attacker.instanceId], "BURN")?.power).toBe(4);
  });

  it("DAWN Glime — +2 barrier that surges (+1 DMG/+1 SP) when it breaks", () => {
    const s = prepState();
    const glime = place(s, "dawn_glime", "P1", 3, 0);
    expect(s.cards[glime.instanceId].curShields).toBe(2); // summonSelfShields
    const attacker = place(s, "leaf_alpha", "P2", 3, 1, { curHp: 20 });
    basicAttack(s, attacker.instanceId, glime.instanceId);
    expect(s.cards[glime.instanceId].curShields).toBe(0);
    expect(s.cards[glime.instanceId].dmgBonus).toBe(1);
    expect(s.cards[glime.instanceId].spBonus).toBe(1);
  });

  it("GALE Toxhawk — basic attacks leave a DOT on the target", () => {
    const s = prepState();
    const tox = place(s, "gale_toxhawk", "P1", 2, 0);
    const foe = place(s, "dusk_gool", "P2", 1, 0, { curHp: 20, curShields: 0 });
    basicAttack(s, tox.instanceId, foe.instanceId);
    expect(statusOf(s.cards[foe.instanceId], "DOT")).toBeTruthy();
  });

  it("DUSK Zombie Husk — Reanimation revives it weaker (−1 all stats) on death", () => {
    const s = prepState();
    const husk = place(s, "dusk_zombie_husk", "P1", 2, 0, { curHp: 7, maxHp: 7 });
    const src = place(s, "leaf_alpha", "P2", 1, 0);
    directDamage(s, src, s.cards[husk.instanceId], 20, false); // lethal
    const h = s.cards[husk.instanceId];
    expect(h).toBeTruthy(); // still on the board (reanimated)
    expect(h.curHp).toBe(6); // maxHp 7 − 1
    expect(h.reviveDecay).toBe(1);
    expect(h.dmgBonus).toBe(-1); // −1 DMG too
  });

  it("BOLT Buzz — its Electro Shield PARALYZEs the attacker when it breaks", () => {
    const s = prepState();
    const buzz = place(s, "bolt_buzz", "P1", 2, 0);
    expect(s.cards[buzz.instanceId].curShields).toBe(1); // summonSelfShields
    const attacker = place(s, "leaf_alpha", "P2", 2, 1, { curHp: 20 }); // breaks the 1 shield
    basicAttack(s, attacker.instanceId, buzz.instanceId);
    expect(statusOf(s.cards[attacker.instanceId], "PARALYZE")).toBeTruthy();
  });
});

describe("rare audit — uncapped on-summon corridors", () => {
  /** Summon `id` into a packed enemy cluster; return the immediate damage. */
  function arrival(id: string): number {
    const s = prepState();
    s.players.P1.summonPool = 20;
    const foes = [[2, 0], [2, 1], [2, 2], [1, 1]].map(([r, c]) =>
      place(s, "dusk_gool", "P2", r, c, { curHp: 500, maxHp: 500, curShields: 0 }));
    const handId = giveHand(s, "P1", id);
    const n = applyIntent(s, { type: "SUMMON", player: "P1", handId, col: 1 });
    return foes.reduce((a, f) => a + (500 - (n.cards[f.instanceId]?.curHp ?? 0)), 0);
  }

  it("Flamehound's corridor is capped, so a cost-2 no longer beats a cost-3", () => {
    // Both cards do the same job. Flamehound's corridor was uncapped and
    // Spitfire's was capped at 3, so the CHEAPER card hit for more: 12 vs 9.
    const hound = arrival("pyro_flamehound");
    const spitfire = arrival("pyro_spitfire");
    expect(hound).toBe(6); // 2 x 3
    expect(hound / 2).toBeLessThanOrEqual(spitfire / 3); // per cost, no longer ahead
  });

  it("Warthog's corridor is capped too", () => {
    // 15 on arrival off a cost-2 body was the most of any rare by some way.
    // Still 5 per target — its corridor reaches only ONE row, so it has to be
    // in contact, unlike Flamehound's shot.
    expect(arrival("bore_warthog")).toBe(10); // 2 x 5
  });

  it("a rare's on-summon stays under a cost-3 special's output", () => {
    // The tier line worth holding: free arrival damage should not rival what an
    // epic pays magic for. Piranha at 6 off a 1-cost is the top of the tier.
    for (const id of ["pyro_flamehound", "bore_warthog", "aqua_piranha", "bolt_zap"])
      expect(arrival(id), `${id} arrives too hot`).toBeLessThanOrEqual(10);
  });
});
