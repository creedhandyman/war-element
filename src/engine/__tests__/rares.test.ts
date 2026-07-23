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
