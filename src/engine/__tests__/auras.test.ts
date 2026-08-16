// The eight element auras, exercised through the real phase machinery rather
// than by calling the hooks directly. There was no dedicated aura test: the
// pieces were scattered across passives.test.ts and several auras (LEAF's heal,
// DAWN's cleanse, BOLT's damage rider, DUSK's shade) had no end-to-end coverage
// at all. The last block is the one that matters most — a BORROWED aura has to
// fire at every hook, because the card inspector prints that it will.

import { describe, expect, it } from "vitest";
import { CARDS, getDef } from "../../data/cards";
import {
  DAWN_SP_CAP, DUSK_SHADE_MAX_STACKS, DUSK_SHADE_PCT, ELEMENT_AURA, EXOSTONE_DEFAULT,
  EXOSTONE_SHIELDS, GALE_SP_CAP, LEAF_SHIELD_CAP, PYRO_BURN_STACK_CAP, hasElementAura,
  slipstreamPct, tailwindDmg,
} from "../auras";
import { applyStatus, basicAttack, defeatCard, shadeDodgePct, slipstreamDodgePct } from "../combat";
import { advance, applyIntent, openFlowRepick } from "../phases";
import { basicIsInert } from "../rules";
import { boardCards, effectiveDmg, effectiveSp } from "../state";
import type { Element } from "../types";
import { atCleanup, giveHand, place, prepState, statusOf } from "./helpers";

/** Cheapest real card of an element — a valid id by construction, so this file
 *  cannot rot against a rename the way a hardcoded list would. */
const cheapest = (el: Element) =>
  CARDS.filter((c) => c.element === el).sort((a, b) => a.cost - b.cost)[0];

/** Distinct DUSK bodies, for the stacking tests — one per death. */
const DUSK_POOL = CARDS.filter((c) => c.element === "DUSK").map((c) => c.id);

describe("every element has an aura and a card to carry it", () => {
  it("all 8 elements are in the table and represented in the pool", () => {
    for (const el of Object.keys(ELEMENT_AURA) as Element[]) {
      expect(ELEMENT_AURA[el].name, el).toBeTruthy();
      expect(CARDS.some((c) => c.element === el), `${el} has cards`).toBe(true);
    }
  });
});

describe("LEAF — Photosynthesis", () => {
  it("heals +2 at end of round, +1 per ROOTed opponent", () => {
    const s = prepState();
    const leaf = place(s, cheapest("LEAF").id, "P1", 3, 0, { curHp: 3, maxHp: 30 });
    place(s, cheapest("DUSK").id, "P2", 0, 0);
    expect(advance(atCleanup(s)).cards[leaf.instanceId].curHp).toBe(5);

    const s2 = prepState();
    const leaf2 = place(s2, cheapest("LEAF").id, "P1", 3, 0, { curHp: 3, maxHp: 30 });
    const foe = place(s2, cheapest("DUSK").id, "P2", 0, 0);
    applyStatus(s2, s2.cards[foe.instanceId], "ROOT", 3, 1, "LEAF");
    expect(advance(atCleanup(s2)).cards[leaf2.instanceId].curHp, "+2 base, +1 per root").toBe(6);
  });

  it("banks +1 shield PER HIT taken, capped above PRINTED shields", () => {
    const def = cheapest("LEAF");
    const s = prepState();
    const leaf = place(s, def.id, "P1", 3, 0, { curHp: 30, maxHp: 30, hitsTakenThisRound: 2 });
    expect(advance(atCleanup(s)).cards[leaf.instanceId].curShields).toBe(def.shields + 2);

    // The ceiling is printed + cap, not a flat total — read as a total it would
    // lock every LEAF card printing 3+ shields out of half its own aura.
    const s2 = prepState();
    const l2 = place(s2, def.id, "P1", 3, 0, { curHp: 30, maxHp: 30, hitsTakenThisRound: 99 });
    expect(advance(atCleanup(s2)).cards[l2.instanceId].curShields).toBe(def.shields + LEAF_SHIELD_CAP);
  });
});

describe("PYRO — Scorch", () => {
  it("a basic attack sets the target alight, and stacks to the cap", () => {
    const s = prepState();
    const pyro = place(s, cheapest("PYRO").id, "P1", 3, 0);
    const foe = place(s, cheapest("DUSK").id, "P2", 2, 0, { curHp: 500, maxHp: 500, curShields: 0 });
    basicAttack(s, pyro.instanceId, foe.instanceId);
    expect(statusOf(s.cards[foe.instanceId], "BURN")).toBeTruthy();

    for (let i = 0; i < 20; i++) {
      s.cards[pyro.instanceId].attackedThisRound = false;
      basicAttack(s, pyro.instanceId, foe.instanceId);
    }
    expect(statusOf(s.cards[foe.instanceId], "BURN")!.power).toBe(PYRO_BURN_STACK_CAP);
  });
});

describe("BORE — Exostone", () => {
  it("every BORE card arrives plated by its rarity", () => {
    for (const def of CARDS.filter((c) => c.element === "BORE")) {
      const s = prepState();
      s.players.P1.gold = 30;
      const handId = giveHand(s, "P1", def.id);
      const next = applyIntent(s, { type: "SUMMON", player: "P1", handId, col: 0 });
      const card = boardCards(next, "P1").find((c) => c.defId === def.id);
      if (!card) continue; // a body that transforms on arrival — covered elsewhere
      const plate = EXOSTONE_SHIELDS[def.rarity ?? ""] ?? EXOSTONE_DEFAULT;
      expect(card.curShields, `${def.id} (${def.rarity})`).toBeGreaterThanOrEqual(def.shields + plate);
    }
  });

  it("never loses more than one shield to a single hit, however heavy", () => {
    const s = prepState();
    const heavy = CARDS.filter((c) => c.element === "PYRO").sort((a, b) => b.dmg - a.dmg)[0];
    const hitter = place(s, heavy.id, "P1", 3, 0);
    const bore = place(s, cheapest("BORE").id, "P2", 2, 0, { curShields: 5, curHp: 500, maxHp: 500 });
    basicAttack(s, hitter.instanceId, bore.instanceId);
    expect(s.cards[bore.instanceId].curShields).toBeGreaterThanOrEqual(4);
  });

  it("does NOT wear the plate it breaks off an opponent", () => {
    // Exostone's offensive half is gone. It gave a shield for every plate a
    // BORE hit broke, which meant attacking into BORE and being attacked by it
    // both fed the same stat on the element that already carries the most
    // armour in the game and already caps its own losses at one plate a hit.
    // BORE measured 60.1% at the top of an otherwise 15.8-point field.
    const s = prepState();
    const bore = place(s, cheapest("BORE").id, "P1", 3, 0, { curShields: 0 });
    const foe = place(s, cheapest("DUSK").id, "P2", 2, 0, { curShields: 3, curHp: 500, maxHp: 500 });
    basicAttack(s, bore.instanceId, foe.instanceId);
    expect(s.cards[foe.instanceId].curShields, "the break itself is unchanged").toBeLessThan(3);
    expect(s.cards[bore.instanceId].curShields, "and nothing is looted from it").toBe(0);
  });
});

describe("DUSK — Midnight Shade", () => {
  /** Kill a fresh DUSK body on `P1`. */
  const kill = (s: ReturnType<typeof prepState>, i: number) => {
    const f = place(s, DUSK_POOL[i], "P1", 3, i % 4);
    defeatCard(s, s.cards[f.instanceId], "test");
  };

  it("a fallen DUSK card thickens the shadows over its surviving allies", () => {
    const s = prepState();
    const survivor = place(s, DUSK_POOL[0], "P1", 3, 0);
    s.round = 1;
    kill(s, 1);
    expect(s.players.P1.shadeStacks).toBe(1);
    expect(shadeDodgePct(s, s.cards[survivor.instanceId])).toBe(DUSK_SHADE_PCT);
  });

  it("stacks +5% per death, to a ceiling", () => {
    const s = prepState();
    const survivor = place(s, DUSK_POOL[0], "P1", 3, 0);
    s.round = 1;
    const seen: number[] = [];
    for (let i = 1; i <= 7; i++) { kill(s, i); seen.push(shadeDodgePct(s, s.cards[survivor.instanceId])); }
    expect(seen).toEqual([5, 10, 15, 20, 25, 25, 25].map((n) => (n / 5) * DUSK_SHADE_PCT));
    expect(s.players.P1.shadeStacks).toBe(DUSK_SHADE_MAX_STACKS);
  });

  it("starts over at +5% once the shadow has lifted", () => {
    // The bug this pins: `shadeStacks` only ever climbed, so it was a LIFETIME
    // tally. Once five DUSK cards had died, a single death many rounds later
    // handed back the whole ceiling instead of one stack — "+5% per death"
    // silently became "+25% on any death for the rest of the match". The dodge
    // did drop to 0 in between, which is exactly what hid it.
    const s = prepState();
    const survivor = place(s, DUSK_POOL[0], "P1", 3, 0);
    s.round = 1;
    for (let i = 1; i <= 5; i++) kill(s, i);
    expect(shadeDodgePct(s, s.cards[survivor.instanceId])).toBe(DUSK_SHADE_MAX_STACKS * DUSK_SHADE_PCT);

    // Rounds pass with nothing dying — the shadow lifts.
    s.round = 5;
    expect(shadeDodgePct(s, s.cards[survivor.instanceId]), "lifted").toBe(0);

    // One death now is ONE stack, not the old ceiling.
    kill(s, 6);
    expect(s.players.P1.shadeStacks).toBe(1);
    expect(shadeDodgePct(s, s.cards[survivor.instanceId])).toBe(DUSK_SHADE_PCT);
  });

  it("keeps stacking while the shadow is still up", () => {
    // The reset is on the shadow LAPSING, not on the round turning — deaths in
    // consecutive rounds still compound, which is the aura working as written.
    const s = prepState();
    const survivor = place(s, DUSK_POOL[0], "P1", 3, 0);
    s.round = 1;
    kill(s, 1);
    s.round = 2; // still inside the window (shadeUntilRound === 2)
    kill(s, 2);
    expect(s.players.P1.shadeStacks).toBe(2);
    expect(shadeDodgePct(s, s.cards[survivor.instanceId])).toBe(2 * DUSK_SHADE_PCT);
  });
});

describe("AQUA — Flow Change", () => {
  it("an AI-side AQUA card takes a boost on summon", () => {
    const s = prepState(42, "P2"); // P2 must hold priority to summon
    s.players.P2.gold = 30;
    s.humans = ["P1"]; // P2 is the AI, so it picks for itself immediately
    const def = cheapest("AQUA");
    const handId = giveHand(s, "P2", def.id);
    const next = applyIntent(s, { type: "SUMMON", player: "P2", handId, col: 0 });
    const card = boardCards(next, "P2").find((c) => c.defId === def.id)!;
    const boosted =
      card.buffs.length > 0 || card.curShields > def.shields ||
      card.dmgBonus > 0 || card.dmgBonusRound > 0 || card.spBonus > 0 || card.spBonusRound > 0 ||
      card.hitsBonus > 0 || card.hitsBonusRound > 0;
    expect(boosted, "Flow Change granted something").toBe(true);
  });

  it("a human-side AQUA card gates on the choice instead of picking for them", () => {
    const s = prepState();
    s.players.P1.gold = 30;
    const handId = giveHand(s, "P1", cheapest("AQUA").id);
    expect(applyIntent(s, { type: "SUMMON", player: "P1", handId, col: 0 }).pendingFlow).toBeTruthy();
  });
});

describe("AQUA — Downpour's per-round Flow re-pick", () => {
  /** A Downpour field standing over `owner`'s side. */
  const downpour = (s: ReturnType<typeof prepState>, owner: "P1" | "P2") =>
    s.fields.push({ owner, spellId: "aqua_downpour", element: "AQUA", roundsLeft: 3, flowRepick: true });

  it("re-shapes every AQUA ally on an AI side, and nothing else", () => {
    const s = prepState();
    s.humans = ["P1"]; // P2 resolves instantly
    downpour(s, "P2");
    const aqua = place(s, cheapest("AQUA").id, "P2", 0, 0);
    const other = place(s, cheapest("BORE").id, "P2", 0, 1);
    const otherShields = s.cards[other.instanceId].curShields;
    openFlowRepick(s);
    const a = s.cards[aqua.instanceId];
    expect(
      a.dmgBonusRound > 0 || a.spBonusRound > 0 || a.hitsBonusRound > 0 || a.curShields > getDef(aqua.defId).shields,
      "the AQUA ally was re-shaped",
    ).toBe(true);
    expect(s.cards[other.instanceId].curShields, "a non-AQUA ally is untouched").toBe(otherShields);
  });

  it("offers a human ONE prompt for the whole element", () => {
    const s = prepState();
    downpour(s, "P1");
    place(s, cheapest("AQUA").id, "P1", 3, 0);
    place(s, cheapest("AQUA").id, "P1", 3, 1);
    openFlowRepick(s);
    expect(s.pendingFlow, "a prompt is open").toBeTruthy();
    expect(s.pendingFlowAll, "flagged as the whole-element pick").toBe(true);
  });

  it("applies the human's one pick to every AQUA ally", () => {
    const s = prepState();
    downpour(s, "P1");
    const one = place(s, cheapest("AQUA").id, "P1", 3, 0);
    const two = place(s, cheapest("AQUA").id, "P1", 3, 1);
    openFlowRepick(s);
    const next = applyIntent(s, {
      type: "FLOW_CHANGE", player: "P1", instanceId: s.pendingFlow!, mode: "ice",
    });
    for (const c of [one, two])
      expect(next.cards[c.instanceId].curShields, "both got Frozen").toBeGreaterThan(getDef(c.defId).shields);
    expect(next.pendingFlow, "and the prompt closed").toBeNull();
  });

  it("targets the FIELD's element, not the prompted card's", () => {
    // The re-pick reads `field.element` when it gathers the kin, then the
    // FLOW_CHANGE handler re-derives the element from the prompted card. Those
    // agree only because the kin filter guarantees it. Pinned because the
    // obvious extension of Downpour to borrowed auras (SirCrest carries AQUA's
    // Flow Change but is DAWN) would put a DAWN card at the head of the kin
    // list and silently re-flow the DAWN side instead.
    const s = prepState();
    downpour(s, "P1");
    const aqua = place(s, cheapest("AQUA").id, "P1", 3, 0);
    const dawn = place(s, cheapest("DAWN").id, "P1", 3, 1);
    const dawnShields = s.cards[dawn.instanceId].curShields;
    openFlowRepick(s);
    expect(s.pendingFlow, "the prompt opens on an AQUA card").toBe(aqua.instanceId);
    const next = applyIntent(s, {
      type: "FLOW_CHANGE", player: "P1", instanceId: s.pendingFlow!, mode: "ice",
    });
    expect(next.cards[dawn.instanceId].curShields, "the DAWN ally is not swept up").toBe(dawnShields);
  });
});

describe("DAWN — Awakening", () => {
  it("strikes the nearest enemy on summon", () => {
    const s = prepState();
    s.players.P1.gold = 30;
    const def = CARDS.filter((c) => c.element === "DAWN" && c.dmg >= 2).sort((a, b) => a.cost - b.cost)[0];
    const foe = place(s, cheapest("DUSK").id, "P2", 2, 0, { curHp: 500, maxHp: 500, curShields: 0 });
    const handId = giveHand(s, "P1", def.id);
    const next = applyIntent(s, { type: "SUMMON", player: "P1", handId, col: 0 });
    expect(next.cards[foe.instanceId].curHp, "took half its DMG").toBeLessThan(500);
  });

  it("burns ONE negative status off each round, and quickens to a cap", () => {
    const s = prepState();
    const def = cheapest("DAWN");
    const dawn = place(s, def.id, "P1", 3, 0);
    applyStatus(s, s.cards[dawn.instanceId], "BURN", 3, 2, "PYRO");
    applyStatus(s, s.cards[dawn.instanceId], "ROOT", 3, 1, "LEAF");
    const before = s.cards[dawn.instanceId].statuses.length;
    const after = advance(atCleanup(s));
    expect(after.cards[dawn.instanceId].statuses.length, "peeled, not wiped").toBe(before - 1);
    expect(after.cards[dawn.instanceId].spBonus).toBeGreaterThan(0);
    expect(def.sp + after.cards[dawn.instanceId].spBonus).toBeLessThanOrEqual(DAWN_SP_CAP);
  });
});

describe("GALE — Zephyr's Tailwind and Slipstream", () => {
  it("converts SP into damage, on a curve with a ceiling", () => {
    expect([0, 5, 6, 11, 12, 17, 18, 30].map(tailwindDmg)).toEqual([0, 0, 1, 1, 2, 2, 3, 3]);
  });

  it("converts SP into dodge, on a curve with a ceiling", () => {
    expect([0, 6, 8, 9, 12, 15, 18, 40].map(slipstreamPct)).toEqual([0, 0, 0, 5, 10, 15, 20, 20]);
  });

  it("a GALE card's printed damage is raised by its own speed", () => {
    const s = prepState();
    // Klipso is SP 13, so floor(13/6) = +2 on top of its printed 9.
    const k = place(s, "gale_klipso", "P1", 3, 0);
    expect(effectiveDmg(s, s.cards[k.instanceId])).toBe(getDef("gale_klipso").dmg + 2);
  });

  it("does NOT stack on the two cards that already convert SP to damage", () => {
    // Stormquill and Tempest have High Speed Impact. Tailwind exists to give
    // the other GALE cards what those two always had; stacking would re-buff
    // the pair that never needed it — one of which is already capped for
    // being too strong.
    const s = prepState();
    for (const id of ["gale_hawk", "gale_tempest"]) {
      const def = getDef(id);
      expect(def.highSpeedImpact, `${id} has HSI`).toBeTruthy();
      const c = place(s, id, "P1", 3, id === "gale_hawk" ? 0 : 1);
      // Below SP 10 HSI contributes nothing, so effective === printed proves
      // Tailwind stayed out of it.
      const hsi = Math.max(0, def.sp - 10);
      expect(effectiveDmg(s, s.cards[c.instanceId]), id).toBe(def.dmg + Math.min(def.highSpeedImpact!.cap ?? hsi, hsi));
    }
  });

  it("gives non-GALE cards neither half", () => {
    const s = prepState();
    for (const el of ["LEAF", "BORE", "DUSK"] as Element[]) {
      const def = cheapest(el);
      const c = place(s, def.id, "P1", 3, 0);
      expect(effectiveDmg(s, s.cards[c.instanceId]), `${def.id} dmg`).toBe(def.dmg);
      expect(slipstreamDodgePct(s, s.cards[c.instanceId]), `${def.id} dodge`).toBe(0);
      s.cards[c.instanceId].pos = null; // clear the slot for the next one
    }
  });

  it("a fast GALE card carries a real dodge chance", () => {
    const s = prepState();
    const k = place(s, "gale_klipso", "P1", 3, 0); // SP 13 -> floor((13-6)/3)=2 -> 10%
    expect(slipstreamDodgePct(s, s.cards[k.instanceId])).toBe(10);
  });
});

describe("GALE — Zephyr", () => {
  it("+2 SP a round, capped, with a one-time +1 DMG past 15", () => {
    const def = cheapest("GALE");
    let s = prepState();
    const gale = place(s, def.id, "P1", 3, 0);
    s = advance(atCleanup(s));
    expect(s.cards[gale.instanceId].spBonus).toBe(2);

    for (let i = 0; i < 20; i++) s = advance(atCleanup(s));
    const card = s.cards[gale.instanceId];
    expect(def.sp + card.spBonus, "capped").toBeLessThanOrEqual(GALE_SP_CAP);
    expect(card.zephyrBoosted, "crossed 15 and banked the one-time DMG").toBe(true);
    expect(card.dmgBonus, "ONE time, not a per-round ramp").toBe(1);
  });
});

describe("BOLT — Electrify", () => {
  it("a basic hit leaves the target carrying a status", () => {
    const s = prepState();
    const bolt = place(s, cheapest("BOLT").id, "P1", 3, 0);
    const foe = place(s, cheapest("DUSK").id, "P2", 2, 0, { curHp: 500, maxHp: 500, curShields: 0 });
    basicAttack(s, bolt.instanceId, foe.instanceId);
    expect(s.cards[foe.instanceId].statuses.length).toBeGreaterThan(0);
  });

  it("hits harder into a target that already carries one", () => {
    const def = cheapest("BOLT");
    const plain = prepState();
    const b1 = place(plain, def.id, "P1", 3, 0);
    const f1 = place(plain, cheapest("DUSK").id, "P2", 2, 0, { curHp: 500, maxHp: 500, curShields: 0 });
    basicAttack(plain, b1.instanceId, f1.instanceId);
    const clean = 500 - plain.cards[f1.instanceId].curHp;

    const s = prepState();
    const b2 = place(s, def.id, "P1", 3, 0);
    const f2 = place(s, cheapest("DUSK").id, "P2", 2, 0, { curHp: 500, maxHp: 500, curShields: 0 });
    applyStatus(s, s.cards[f2.instanceId], "ROOT", 3, 1, "LEAF");
    basicAttack(s, b2.instanceId, f2.instanceId);
    expect(500 - s.cards[f2.instanceId].curHp, "+2 into a statused target").toBeGreaterThan(clean);
  });
});

describe("borrowed auras (elementAuras) reach every hook", () => {
  const borrowers = CARDS.filter((c) => c.elementAuras?.length);

  it("there is at least one borrower to check", () => {
    expect(borrowers.length).toBeGreaterThan(0);
  });

  it("hasElementAura agrees with what the card claims", () => {
    // The card inspector PRINTS every borrowed aura (card-text.tsx), so a
    // borrowed aura no hook honours is a card lying about what it does.
    const gaps: string[] = [];
    for (const def of borrowers)
      for (const el of def.elementAuras!)
        if (!hasElementAura(def, el)) gaps.push(`${def.id} claims ${el}, hasElementAura says no`);
    expect(gaps).toEqual([]);
  });

  it("a borrower gets the borrowed SUMMON aura end-to-end", () => {
    // SirCrest is DAWN and borrows AQUA. The suite already checked that
    // `hasElementAura` says so and that Scorch (PYRO, an on-hit hook) works,
    // but nothing pinned that Flow Change — a different hook entirely, on the
    // summon path — actually reaches him.
    for (const def of borrowers.filter((c) => c.elementAuras!.includes("AQUA"))) {
      const s = prepState();
      s.players.P1.gold = 30;
      const handId = giveHand(s, "P1", def.id);
      const next = applyIntent(s, { type: "SUMMON", player: "P1", handId, col: 0 });
      expect(next.pendingFlow, `${def.id} is offered Flow Change`).toBeTruthy();
    }
  });

  it("a borrower's basic is never inert while it carries an on-hit aura", () => {
    // basicIsInert gates whether the AI bothers swinging a 0-DMG attack. It
    // listed PYRO and BOLT by raw element, so a borrower debuffed to 0 DMG read
    // as inert even though its basic would still set the target alight.
    for (const def of borrowers) {
      if (!def.elementAuras!.some((el) => el === "PYRO" || el === "BOLT")) continue;
      const s = prepState();
      const card = place(s, def.id, "P1", 3, 0, { dmgBonus: -999 });
      expect(basicIsInert(s, s.cards[card.instanceId]), `${def.id} still burns`).toBe(false);
    }
  });
});

describe("DAWN's two tribes cover the whole element", () => {
  // Suns and Stars split DAWN by CLASS — Tanks/Warriors/Supports hold the line,
  // Assassins/Mages/Rangers shoot over it. Written as a rule rather than a
  // roster so it needs no upkeep, and asserted because the failure mode is
  // silent: a new DAWN card with no tribe simply never receives either aura,
  // and nothing in the game says so.
  const SUNS_CLASSES = ["Tank", "Warrior", "Support"];
  const STARS_CLASSES = ["Assassin", "Mage", "Ranger"];
  const dawn = CARDS.filter((c) => c.element === "DAWN");
  const tribesOf = (c: { tribe?: string | string[] }) =>
    c.tribe == null ? [] : Array.isArray(c.tribe) ? c.tribe : [c.tribe];

  // Sphere is a deliberate exception: it was remodelled from a Mage into a Tank
  // and kept its Stars tag rather than being dragged across to Suns by the
  // remodel. Named here rather than loosening the rule, so the rule still
  // catches an untagged newcomer — which is the failure this test exists for.
  const CLASS_RULE_EXCEPTIONS = new Set(["dawn_sphere"]);

  it("every DAWN card is a Sun or a Star, and which one follows from its class", () => {
    expect(dawn.length).toBeGreaterThan(30);
    for (const c of dawn) {
      const tribes = tribesOf(c);
      const want = SUNS_CLASSES.includes(c.cardClass) ? "Suns"
        : STARS_CLASSES.includes(c.cardClass) ? "Stars"
        : null;
      expect(want, `${c.id} has class ${c.cardClass}, which belongs to neither half`).toBeTruthy();
      // The exceptions still have to be in ONE of the two — they just get to
      // pick the other one. Only the class MAPPING is waived, not membership.
      if (!CLASS_RULE_EXCEPTIONS.has(c.id)) expect(tribes, `${c.id} (${c.cardClass})`).toContain(want);
      // Exactly one of the two — a card cannot be both halves of the element.
      expect(tribes.filter((t) => t === "Suns" || t === "Stars")).toHaveLength(1);
    }
  });

  it("both aura holders actually have a side to lead", () => {
    // The reason this exists: when the tribes were introduced each had exactly
    // ONE member — its own aura holder — so both auras buffed nobody but
    // themselves and read on the card as an ability the card did not have.
    const count = (t: string) => CARDS.filter((c) => tribesOf(c).includes(t)).length;
    expect(count("Suns")).toBeGreaterThan(10);
    expect(count("Stars")).toBeGreaterThan(10);
    const equestrian = getDef("dawn_equestrian");
    const aurora = getDef("dawn_aurora");
    expect(equestrian.aura?.match).toBe("Suns");
    expect(aurora.aura?.match).toBe("Stars");
    // And each holder is a member of the tribe it leads (auras include the
    // holder when it matches), so neither buffs a side it does not stand in.
    expect(tribesOf(equestrian)).toContain("Suns");
    expect(tribesOf(aurora)).toContain("Stars");
  });

  it("Supernova keeps Dragon, so Drakonbane still hunts it", () => {
    // Tribes may be arrays, so the class split cost nothing here: Supernova is
    // a Dragon by shape and a Star by what it is. Drakonbane's Dragon's Bane
    // reads the tribe list, and this is the only DAWN Dragon.
    const nova = getDef("dawn_supernova");
    expect(tribesOf(nova)).toContain("Dragon");
    expect(tribesOf(nova)).toContain("Stars");
    expect(getDef("dawn_drakonbane").vsTarget?.tribe).toBe("Dragon");
  });
});

describe("Vapor has a tribe to buff", () => {
  // Hydrogon's Vapor aura (+4 SP) reached two other cards, which was easy to
  // miss twice over: a count that does not unpack ARRAY tribes reads Vapor as
  // having a single member, because Hydrogon's and Sapphire's tags are inside
  // ["Dragon", "Vapor"]. Both halves of that are asserted here — the real
  // membership, and that the aura is scoped to it.
  const tribesOf = (t: string | string[] | undefined) =>
    t == null ? [] : Array.isArray(t) ? t : [t];
  const vapor = CARDS.filter((c) => tribesOf(c.tribe).includes("Vapor"));

  it("the fog-workers are all in it, however their tribe tag is shaped", () => {
    const ids = vapor.map((c) => c.id);
    for (const id of [
      "aqua_hydrogon",    // the aura holder itself
      "aqua_sapphire",    // ["Dragon", "Vapor"] — already there
      "aqua_vaporem",     // "Vapor" — the only plain-string tag
      "aqua_blackbeard",  // ["SeaC", "Vapor"]
      "aqua_driftwraith", // ["Deep Creatures", "SeaC", "Vapor"]
      "aqua_misty",       // the fog itself
    ]) expect(ids, id).toContain(id);
    expect(vapor.length).toBeGreaterThanOrEqual(6);
  });

  it("Hydrogon's aura is Vapor-scoped and buffs somebody other than itself", () => {
    const hydro = getDef("aqua_hydrogon");
    expect(hydro.aura?.match).toBe("Vapor");
    expect(hydro.aura?.sp).toBe(4);
    expect(tribesOf(hydro.tribe)).toContain("Vapor");
    // End-to-end: a Vapor ally gains the SP, a non-Vapor AQUA ally does not.
    const s = prepState();
    const mate = place(s, "aqua_misty", "P1", 3, 1);
    const outsider = place(s, "aqua_coralgolem", "P1", 3, 2); // AQUA, no tribe
    const mateBefore = effectiveSp(s, s.cards[mate.instanceId]);
    const outsiderBefore = effectiveSp(s, s.cards[outsider.instanceId]);
    place(s, "aqua_hydrogon", "P1", 4, 1);
    expect(effectiveSp(s, s.cards[mate.instanceId]) - mateBefore).toBe(4);
    expect(effectiveSp(s, s.cards[outsider.instanceId])).toBe(outsiderBefore);
  });
});

describe("the Pirate crew", () => {
  const tribesOf = (t: string | string[] | undefined) =>
    t == null ? [] : Array.isArray(t) ? t : [t];
  const crew = CARDS.filter((c) => tribesOf(c.tribe).includes("Pirate"));

  it("is six strong and crosses elements", () => {
    const ids = crew.map((c) => c.id);
    for (const id of [
      "pyro_scully",      // Scallywag — PYRO, so the tribe is not AQUA-only
      "aqua_buccaneers",  // Saltjacks
      "aqua_octoirate",   // Octoirate — keeps SeaC alongside
      "aqua_blackbeard",  // BlackBeard — the aura holder
      "aqua_bootlegger",  // Bootlegger — keeps Avian alongside
      "aqua_driftwraith", // Driftwraith
    ]) expect(ids, id).toContain(id);
    expect(new Set(crew.map((c) => c.element)).size, "not a single-element tribe").toBeGreaterThan(1);
  });

  it("BlackBeard's aura pays the crew +1 DMG, across elements and including himself", () => {
    const bb = getDef("aqua_blackbeard");
    expect(bb.aura?.match).toBe("Pirate");
    expect(bb.aura?.dmg).toBe(1);
    expect(bb.aura?.element, "no element filter — Scallywag is PYRO").toBeUndefined();

    const s = prepState();
    // A PYRO crewmate and a non-Pirate AQUA control, both on BlackBeard's side.
    const mate = place(s, "pyro_scully", "P1", 3, 1);
    const outsider = place(s, "aqua_coralgolem", "P1", 3, 2);
    const mateBefore = effectiveDmg(s, s.cards[mate.instanceId]);
    const outsiderBefore = effectiveDmg(s, s.cards[outsider.instanceId]);
    const bbCard = place(s, "aqua_blackbeard", "P1", 4, 1);
    expect(effectiveDmg(s, s.cards[mate.instanceId]) - mateBefore).toBe(1);
    expect(effectiveDmg(s, s.cards[outsider.instanceId])).toBe(outsiderBefore);
    expect(effectiveDmg(s, s.cards[bbCard.instanceId])).toBe(getDef("aqua_blackbeard").dmg + 1);
  });

  it("BlackBeard and Driftwraith really did leave Kraken's school", () => {
    // Not incidental — SeaC is tribe-matched by Kraken's +4 max HP aura, so
    // trading it for Pirate is a live cost, and Octoirate deliberately kept
    // SeaC to avoid paying it. Pinned so the trade is a decision on the record.
    expect(getDef("aqua_kraken").aura?.match).toBe("SeaC");
    for (const id of ["aqua_blackbeard", "aqua_driftwraith"])
      expect(tribesOf(getDef(id).tribe), `${id} left SeaC`).not.toContain("SeaC");
    expect(tribesOf(getDef("aqua_octoirate").tribe), "Octoirate kept it").toContain("SeaC");
  });
});
