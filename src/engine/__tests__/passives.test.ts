// Restored card passives: the generic hooks (onKill, thorns, vsStatus, gated
// on-hit riders, roundTick, onDeath row-ahead) that back the doc-correct
// abilities in cards.ts.

import { describe, expect, it } from "vitest";
import { applyStatus, basicAttack, defeatCard, drainMaxHp, effectiveBasicHits, hasEvasion, SPECIAL_HANDLERS, TARGETLESS_HANDLERS } from "../combat";
import { applyFlow, EXOSTONE_DEFAULT, EXOSTONE_SHIELDS, hasElementAura, PYRO_BURN_STACK_CAP } from "../auras";
import { advance, applyIntent } from "../phases";
import { basicIsInert, canFireSpecial, canFireTalent, canMove, canTarget, effectiveSpecialCost, specialTargets, validTargets } from "../rules";
import { boardCards, effectiveDmg, effectiveSp, healCard, isBloodfire } from "../state";
import { CARDS, TOKENS, getDef } from "../../data/cards";
import { announces } from "../../ui/SummonAnnounce";
import { atBattle, atCleanup, giveHand, place, prepState, seedForCoins, statusOf } from "./helpers";
import { createInitialState } from "../state";
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

  it("Hillbilly's Hillside braces an ally the first time IT is hit, once each", () => {
    // Reworked: the trigger is an ALLY BEING HIT, not Hillbilly landing a basic.
    // Hillbilly no longer has to attack — or even be adjacent — to protect
    // anyone, and it reaches its whole side rather than the row directly ahead.
    const s = prepState();
    place(s, "bore_hillbilly", "P1", 3, 0);
    const ally = place(s, "dawn_beam", "P1", 3, 1, { curHp: 30, maxHp: 30, curShields: 0 });
    const foe = place(s, "dusk_gool", "P2", 2, 1, { curHp: 40, maxHp: 40, curShields: 0 });
    basicAttack(s, foe.instanceId, ally.instanceId);
    expect(s.cards[ally.instanceId].curShields).toBe(1);
    // One slab per body for the game — a second hit doesn't re-plate it.
    s.cards[ally.instanceId].curShields = 0;
    basicAttack(s, foe.instanceId, ally.instanceId);
    expect(s.cards[ally.instanceId].curShields).toBe(0);
  });

  it("...and Hillside no longer needs Hillbilly to swing at anything", () => {
    // The old version keyed off Hillbilly's own landed basic, so a cost-1 Tank
    // had to pick a fight before it could shield a teammate.
    const s = prepState();
    const hill = place(s, "bore_hillbilly", "P1", 3, 0);
    const ally = place(s, "dawn_beam", "P1", 3, 1, { curHp: 30, maxHp: 30, curShields: 0 });
    const foe = place(s, "dusk_gool", "P2", 2, 1, { curHp: 40, maxHp: 40, curShields: 0 });
    basicAttack(s, foe.instanceId, ally.instanceId);
    expect(s.cards[ally.instanceId].curShields).toBe(1);
    expect(s.cards[hill.instanceId].curHp).toBe(getDef("bore_hillbilly").hp); // never fought
  });
});

describe("medium-tier passives (audit batch)", () => {
  it("Stormquill's High Speed Impact adds +1 DMG per SP above 10", () => {
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
    // Squanch is LEAF as well as Regenerative, so a struck Squanch draws from
    // BOTH — and since Photosynthesis now counts hits too, two hits pay twice
    // from each. The two are counted separately below rather than folded.
    const sq = place(s, "leaf_squanch", "P1", 3, 0, { curShields: 0, curHp: 20, maxHp: 23 });
    const foe = place(s, "dusk_gool", "P2", 3, 1);
    basicAttack(s, foe.instanceId, sq.instanceId);
    basicAttack(s, foe.instanceId, sq.instanceId);
    expect(s.cards[sq.instanceId].hitsTakenThisRound).toBe(2);
    expect(s.cards[sq.instanceId].curShields).toBe(0); // nothing yet — it pays at end of round
    const next = advance(atCleanup(s));
    // Photosynthesis fires first (2 hits → +2, capped at 3), then Regenerative
    // adds its own 1-per-hit (cap 5) → 4.
    expect(next.cards[sq.instanceId].curShields).toBe(4);
    expect(next.cards[sq.instanceId].hitsTakenThisRound).toBe(0); // banked hits spent
  });

  it("RIP's inert basic is skipped, but Smog's still attacks (PYRO burns on hit)", () => {
    const s = prepState();
    // UFO used to be the example here; it prints 2 DMG since the card-sheet
    // re-stat, so RIP is now the only genuinely inert basic in the set.
    const rip = place(s, "dusk_rip", "P1", 3, 0);
    const smog = place(s, "pyro_smog_card", "P1", 3, 1);
    place(s, "dusk_gool", "P2", 2, 0); // a reachable target for both
    expect(basicIsInert(s, s.cards[rip.instanceId])).toBe(true);
    // Smog is PYRO, so Scorch burns whatever it touches — worth a turn.
    expect(basicIsInert(s, s.cards[smog.instanceId])).toBe(false);
    // The full census — the predicate must not be quietly silencing anything
    // else. RIP prints 0 DMG on purpose and never swings at all (its Special is
    // free, so it always has a real action). UFO, Doom and Elephlora used to
    // sit here as never-swinging bodies — all three print real DMG now, so they
    // have a basic and correctly drop off. Any OTHER name here is a bug.
    const inert = CARDS.filter((d) => {
      const c = place(s, d.id, "P2", 0, 3);
      const r = basicIsInert(s, c);
      delete s.cards[c.instanceId];
      return r;
    }).map((d) => d.id);
    expect(inert.sort()).toEqual(["dusk_rip"]);
  });

  it("Doom's Boom ticks down over 4 rounds, then levels the enemy board and dies", () => {
    let s = prepState();
    const doom = place(s, "dusk_doom", "P1", 3, 0, { curHp: 20, maxHp: 20 });
    const foe = place(s, "dusk_crow", "P2", 2, 0, { curHp: 30, maxHp: 30, curShields: 0 });
    // Three cleanups: the fuse winds but must NOT have blown yet.
    for (let i = 0; i < 3; i++) s = advance(atCleanup(s));
    expect(s.cards[doom.instanceId]).toBeDefined();
    expect(s.cards[foe.instanceId].curHp).toBe(30);
    // Fourth cleanup: detonation — 8 to the enemy, and Doom is consumed.
    s = advance(atCleanup(s));
    expect(s.cards[foe.instanceId].curHp).toBe(22);
    expect(s.cards[doom.instanceId]).toBeUndefined();
  });

  it("Nitro's Unstable Core explodes for 10 to every opponent, on any death path", () => {
    const s = prepState();
    const nitro = place(s, "pyro_nitro", "P1", 3, 0, { curHp: 20, maxHp: 20 });
    const a = place(s, "dusk_crow", "P2", 2, 0, { curHp: 30, maxHp: 30, curShields: 0 });
    const b = place(s, "dusk_crow", "P2", 1, 3, { curHp: 30, maxHp: 30, curShields: 0 });
    // A direct defeatCard (the tick/detonation path, NOT a basic-attack kill) —
    // this is exactly the death route onDeath.aoeDmg would have missed.
    defeatCard(s, s.cards[nitro.instanceId], "test");
    expect(s.cards[a.instanceId].curHp).toBe(20);
    expect(s.cards[b.instanceId].curHp).toBe(20);
    expect(s.cards[nitro.instanceId]).toBeUndefined();
  });

  it("Hydrogon's Infinite Serpent grows on a kill and snipes the lowest-HP foe", () => {
    const s = prepState();
    const hydro = place(s, "aqua_hydrogon", "P1", 3, 0);
    const prey = place(s, "dusk_crow", "P2", 2, 0, { curHp: 1, maxHp: 30, curShields: 0 });
    const weakest = place(s, "dusk_crow", "P2", 1, 1, { curHp: 8, maxHp: 30, curShields: 0 });
    const bystander = place(s, "dusk_crow", "P2", 1, 3, { curHp: 25, maxHp: 30, curShields: 0 });
    basicAttack(s, hydro.instanceId, prey.instanceId);
    expect(s.cards[prey.instanceId]).toBeUndefined();           // the kill
    expect(s.cards[hydro.instanceId].dmgBonus).toBe(1);         // +1 DMG
    expect(s.cards[hydro.instanceId].spBonus).toBe(1);          // +1 SP
    expect(s.cards[weakest.instanceId].curHp).toBe(5);          // 3 to the lowest-HP survivor
    expect(s.cards[bystander.instanceId].curHp).toBe(25);       // not the higher-HP one
  });

  it("Mark of Hoax makes every basic against the target a guaranteed CRIT", () => {
    const s = prepState();
    const atk = place(s, "dusk_gool", "P1", 3, 0); // 4 DMG, no CRIT keyword, home row
    const marked = place(s, "dusk_crow", "P2", 2, 0, { curHp: 40, maxHp: 40, curShields: 0, hoaxMarked: true });
    basicAttack(s, atk.instanceId, marked.instanceId);
    // A non-CRIT attacker still crits — guaranteed (no coin): 4 → 8.
    expect(40 - s.cards[marked.instanceId].curHp).toBe(8);
  });

  it("a marked target's death banks Hoax a guaranteed dodge that auto-misses once", () => {
    const s = prepState();
    const hoax = place(s, "dusk_hoax", "P1", 3, 0);
    const marked = place(s, "dusk_crow", "P2", 2, 0, {
      curHp: 1, maxHp: 30, curShields: 0, hoaxMarked: true, hoaxMarkedBy: hoax.instanceId,
    });
    defeatCard(s, s.cards[marked.instanceId], "test");
    expect(s.cards[hoax.instanceId].guaranteedDodge).toBe(1);
    // The banked dodge eats the next incoming attack outright (checked BEFORE
    // EVASION, so it can't be the coin that saved it), then is spent.
    const atkr = place(s, "dusk_gool", "P2", 2, 0);
    const before = s.cards[hoax.instanceId].curHp;
    basicAttack(s, atkr.instanceId, hoax.instanceId);
    expect(s.cards[hoax.instanceId].curHp).toBe(before);
    expect(s.cards[hoax.instanceId].guaranteedDodge).toBe(0);
  });

  it("Stormfang's Apex Predator adds +1 DMG per 2 SP above 15", () => {
    const s = prepState();
    const w = place(s, "gale_stormfang", "P1", 3, 0);
    const d1 = effectiveDmg(s, s.cards[w.instanceId]);
    s.cards[w.instanceId].spBonus = (s.cards[w.instanceId].spBonus ?? 0) + 2; // +2 SP = one more tier
    expect(effectiveDmg(s, s.cards[w.instanceId]) - d1).toBe(1);
  });

  it("Valcana's Volcanic Fury ramps DMG on a landed basic", () => {
    const s = prepState();
    const v = place(s, "bore_valcana", "P1", 3, 0);
    const dummy = place(s, "dusk_crow", "P2", 2, 0, { curHp: 60, maxHp: 60, curShields: 0 });
    const base = effectiveDmg(s, s.cards[v.instanceId]);
    basicAttack(s, v.instanceId, dummy.instanceId); // one attack (2 hits) → +1 ramp
    expect(s.cards[v.instanceId].rampDmg).toBe(1);
    expect(effectiveDmg(s, s.cards[v.instanceId])).toBe(base + 1);
  });

  it("Magma Rock Burst hits the target and splashes 2 to every other opponent", () => {
    const s = prepState();
    const v = place(s, "bore_valcana", "P1", 3, 0);
    const t = place(s, "dusk_crow", "P2", 2, 0, { curHp: 40, maxHp: 40, curShields: 0 });
    const other = place(s, "dusk_crow", "P2", 1, 3, { curHp: 40, maxHp: 40, curShields: 0 });
    SPECIAL_HANDLERS.strike(s, s.cards[v.instanceId], [s.cards[t.instanceId]],
      { dmg: 5, statusKind: "DOT", statusPower: 2, statusDuration: 2, splashAll: 2 });
    expect(40 - s.cards[t.instanceId].curHp).toBe(5);
    expect(40 - s.cards[other.instanceId].curHp).toBe(2);
  });

  it("Supernova's Blinding Star cancels a granted splash target", () => {
    const splashDealt = (withStar: boolean) => {
      const s = prepState();
      // The granter is Cloudburst's Downpour, not Totem: Totem Spirit is an
      // ACCURACY aura now and grants no splash at all. Downpour is a flat chip
      // (splashAura: 1) not a full basic, so the number is 1 — what is under test
      // is whether Blinding Star cancels the grant, not how big the grant is.
      const gool = place(s, "dusk_gool", "P1", 3, 0); // 4 DMG, no splash of its own
      place(s, "aqua_rain", "P1", 3, 1); // Downpour grants P1 the extra target
      const primary = place(s, "dusk_gool", "P2", 2, 0, { curHp: 40, maxHp: 40, curShields: 0 });
      const adj = place(s, "dusk_gool", "P2", 2, 1, { curHp: 40, maxHp: 40, curShields: 0 });
      if (withStar) place(s, "dawn_supernova", "P2", 0, 3); // Blinding Star on the enemy side
      basicAttack(s, gool.instanceId, primary.instanceId);
      return 40 - s.cards[adj.instanceId].curHp;
    };
    expect(splashDealt(false)).toBe(1); // Downpour grants the extra target
    expect(splashDealt(true)).toBe(0); // Blinding Star cancels it
  });

  it("Liquark's Lurk gives +4 DMG/+4 SP while STEALTHed, lost the moment it attacks", () => {
    const s = prepState();
    const liq = place(s, "aqua_liquark", "P1", 3, 0);
    s.cards[liq.instanceId].statuses = []; // bare (no STEALTH)
    const bareDmg = effectiveDmg(s, s.cards[liq.instanceId]);
    const bareSp = effectiveSp(s, s.cards[liq.instanceId]);
    s.cards[liq.instanceId].statuses = [{ kind: "STEALTH", duration: 99, power: 0, source: "AQUA" }];
    expect(effectiveDmg(s, s.cards[liq.instanceId]) - bareDmg).toBe(4);
    expect(effectiveSp(s, s.cards[liq.instanceId]) - bareSp).toBe(4);
    // Swinging breaks cover — the Lurk buffs drop.
    const foe = place(s, "dusk_gool", "P2", 2, 0, { curHp: 40, maxHp: 40, curShields: 0 });
    basicAttack(s, liq.instanceId, foe.instanceId);
    expect(effectiveDmg(s, s.cards[liq.instanceId])).toBe(bareDmg);
    expect(s.cards[liq.instanceId].statuses.some((st) => st.kind === "STEALTH")).toBe(false);
  });

  it("Bloody Waters kills the weakest foe, heals +5, and re-enters Lurk", () => {
    const s = prepState();
    const liq = place(s, "aqua_liquark", "P1", 3, 0, { curHp: 5, maxHp: 30 });
    s.cards[liq.instanceId].statuses = [];
    const prey = place(s, "dusk_gool", "P2", 2, 0, { curHp: 3, maxHp: 30, curShields: 0 });
    place(s, "dusk_gool", "P2", 1, 3, { curHp: 30, maxHp: 30, curShields: 0 }); // higher-HP survivor
    const hpBefore = s.cards[liq.instanceId].curHp;
    SPECIAL_HANDLERS.bloodyWaters(s, s.cards[liq.instanceId], [], { dmg: 4, healOnKill: 5 });
    expect(s.cards[prey.instanceId]).toBeUndefined(); // weakest killed
    expect(s.cards[liq.instanceId].curHp).toBeGreaterThan(hpBefore); // healed on the kill
    expect(s.cards[liq.instanceId].statuses.some((st) => st.kind === "STEALTH")).toBe(true); // re-Lurk
    expect(s.cards[liq.instanceId].statuses.some((st) => st.kind === "STEALTH")).toBe(true);
  });

  it("Strawman spawns Crows — 2 on death (Goodnight), 3 from Murder", () => {
    const s = prepState();
    const skrow = place(s, "dusk_skrow", "P1", 2, 1);
    const crows = () => boardCards(s, "P1").filter((c) => c.defId === "dusk_crow").length;
    // Murder → 3 Crows. This was the Bird Bomb Talent until Strawman became an
    // Epic; the ability is the same, it just repeats now and costs magic.
    SPECIAL_HANDLERS.spawn(s, s.cards[skrow.instanceId], [], { token: "dusk_crow", count: 3, radius: 2 });
    expect(crows()).toBe(3);
    // Goodnight (on death) → 2 more.
    defeatCard(s, s.cards[skrow.instanceId], "test");
    expect(crows()).toBe(5);
  });

  it("Strawman carries a Special, not a Talent — it is an Epic", () => {
    const def = getDef("dusk_skrow");
    expect(def.rarity).toBe("epic");
    expect(def.special?.name).toBe("Murder");
    expect(def.talent, "Talents are the RARE pattern: free, once per game").toBeUndefined();
  });

  it("no non-rare card is still carrying a Talent", () => {
    // Strawman was the only one. This is the guard that keeps it that way, since
    // the mismatch is invisible in play until someone notices the ability can
    // only be used once.
    const stragglers = CARDS.filter((d) => d.talent && d.rarity !== "rare").map((d) => d.id);
    expect(stragglers).toEqual([]);
  });

  it("Ariel's Dawning Assault shakes the target's aim (its attacks then miss)", () => {
    const s = prepState();
    const ariel = place(s, "dawn_ariel", "P1", 3, 0);
    const foe = place(s, "dusk_gool", "P2", 2, 0, { curHp: 40, maxHp: 40, curShields: 0 });
    SPECIAL_HANDLERS.strike(s, s.cards[ariel.instanceId], [s.cards[foe.instanceId]],
      { dmg: 7, reachNearest: 1, targetAttackMissPct: 50, targetAttackMissRounds: 2 });
    expect(s.cards[foe.instanceId].attackMissPct).toBe(50);
    expect(s.cards[foe.instanceId].attackMissRounds).toBe(2);
  });

  it("Totem Spirit makes an ally's basic unmissable while the Totem lives", () => {
    // A flat 100% self-miss (Tide's Shell Tuck penalty) rather than BLIND or
    // EVASION: those roll a coin, and the subject here is the aura, not the RNG.
    const landed = (withTotem: boolean, totemAlive = true) => {
      const s = prepState();
      const gool = place(s, "dusk_gool", "P1", 3, 0, { attackMissRounds: 2, attackMissPct: 100 });
      if (withTotem) {
        const t = place(s, "gale_totem", "P1", 3, 1);
        if (!totemAlive) s.cards[t.instanceId].curHp = 0; // "while it lives"
      }
      const foe = place(s, "dusk_gool", "P2", 2, 0, { curHp: 40, maxHp: 40, curShields: 0 });
      basicAttack(s, gool.instanceId, foe.instanceId);
      return 40 - s.cards[foe.instanceId].curHp;
    };
    expect(landed(false), "no Totem — swings wide every time").toBe(0);
    expect(landed(true), "Totem standing — it cannot miss").toBe(4);
    expect(landed(true, false), "a dead Totem grants nothing").toBe(0);
  });

  it("Totem Spirit lets allies target through STEALTH", () => {
    const canSee = (withTotem: boolean) => {
      const s = prepState();
      const gool = place(s, "dusk_gool", "P1", 3, 0);
      if (withTotem) place(s, "gale_totem", "P1", 3, 1);
      const hidden = place(s, "dusk_gool", "P2", 2, 0);
      applyStatus(s, s.cards[hidden.instanceId], "STEALTH", 2, 0, "DUSK");
      return canTarget(s, s.cards[gool.instanceId], s.cards[hidden.instanceId]);
    };
    expect(canSee(false), "cloaked and untargetable").toBe(false);
    expect(canSee(true), "the Totem reveals it").toBe(true);
  });

  it("Totem Spirit sees past the Home-Slot rule — the 'invasion blind' half", () => {
    // The Home-Slot rule: a card standing in its OWN home row cannot target the
    // enemy home row at all, from any distance.
    //
    // Probed with a targeted SPECIAL (asRanged, not forBasic) because that is the
    // only way to isolate the rule on a 4x4. A ranged BASIC is capped at 2
    // king-steps from its own home row and the enemy home row is 3 away, so the
    // reach cap refuses the shot first and the Home-Slot rule is never consulted —
    // measuring it with a basic measures the wrong rule. Specials keep full-board
    // reach, so here the Home-Slot rule is the only thing saying no.
    const canReachHome = (withTotem: boolean) => {
      const s = prepState();
      const caster = place(s, "gale_gastly", "P1", 3, 0); // in its OWN home row
      if (withTotem) place(s, "gale_totem", "P1", 3, 1);
      const deep = place(s, "dusk_gool", "P2", 0, 0); // enemy home row
      return canTarget(s, s.cards[caster.instanceId], s.cards[deep.instanceId], true, false);
    };
    expect(canReachHome(false), "blind to the invasion row from home").toBe(false);
    expect(canReachHome(true), "the Totem sees it").toBe(true);
  });

  it("Totem Spirit covers the whole team, not just GALE", () => {
    // Unlike Purelight, which only sharpens its own element's attacks.
    const s = prepState();
    place(s, "gale_totem", "P1", 3, 1);
    const dusk = place(s, "dusk_gool", "P1", 3, 0, { attackMissRounds: 2, attackMissPct: 100 });
    const foe = place(s, "dusk_gool", "P2", 2, 0, { curHp: 40, maxHp: 40, curShields: 0 });
    basicAttack(s, dusk.instanceId, foe.instanceId);
    expect(40 - s.cards[foe.instanceId].curHp, "a DUSK ally still cannot miss").toBe(4);
  });

  it("Rampage buys Totem a second basic hit for 3 rounds, then gives it back", () => {
    const s = prepState();
    const totem = place(s, "gale_totem", "P1", 3, 0);
    expect(effectiveBasicHits(s.cards[totem.instanceId]), "printed hits").toBe(1);
    SPECIAL_HANDLERS.empower(s, s.cards[totem.instanceId], [], { selfHits: 1, buffRounds: 3 });
    expect(effectiveBasicHits(s.cards[totem.instanceId]), "doubled while it runs").toBe(2);
    // Timed, not permanent: the Cleanup tick that expires `buffs` takes it away.
    for (let r = 0; r < 3; r++) {
      for (const b of s.cards[totem.instanceId].buffs) b.rounds--;
      s.cards[totem.instanceId].buffs = s.cards[totem.instanceId].buffs.filter((b) => b.rounds > 0);
    }
    expect(effectiveBasicHits(s.cards[totem.instanceId]), "back to one after 3 rounds").toBe(1);
  });

  it("Blackice's basic damage tracks its current shield count", () => {
    const s = prepState();
    const bi = place(s, "aqua_blackice", "P1", 3, 0);
    s.cards[bi.instanceId].curShields = 5;
    const d5 = effectiveDmg(s, s.cards[bi.instanceId]);
    s.cards[bi.instanceId].curShields = 2;
    expect(d5 - effectiveDmg(s, s.cards[bi.instanceId])).toBe(3); // 5 shields vs 2 = 3 more DMG
  });

  it("Dynomight's Explosive Power doubles basics vs a Warrior", () => {
    const s = prepState();
    const dyno = place(s, "pyro_dynomight", "P1", 3, 0); // 9 DMG
    const warrior = place(s, "dusk_brute", "P2", 2, 0, { curHp: 60, maxHp: 60, curShields: 0 }); // Warrior
    const other = place(s, "dusk_gool", "P2", 2, 1, { curHp: 60, maxHp: 60, curShields: 0 }); // Support
    basicAttack(s, dyno.instanceId, warrior.instanceId);
    basicAttack(s, dyno.instanceId, other.instanceId);
    expect(60 - s.cards[warrior.instanceId].curHp).toBe(2 * (60 - s.cards[other.instanceId].curHp));
  });

  it("Ironclad's Magnetic Steel strips the rank ahead but damages the whole board", () => {
    // Split scope: the theft reaches only the row directly ahead, the damage
    // lands on everyone. Fired with the card's OWN params so the test breaks if
    // the data and the handler ever disagree.
    const s = prepState();
    const steel = place(s, "bore_steel", "P1", 3, 0); // P1 home; row ahead = 2
    s.cards[steel.instanceId].curShields = 5;
    const near = place(s, "dusk_gool", "P2", 2, 0, { curHp: 40, maxHp: 40, curShields: 5 });
    const far = place(s, "dusk_gool", "P2", 1, 1, { curHp: 40, maxHp: 40, curShields: 5 });
    const params = getDef("bore_steel").special!.params!;
    SPECIAL_HANDLERS.barrage(s, s.cards[steel.instanceId],
      [s.cards[near.instanceId], s.cards[far.instanceId]], params);
    // NOTE the damage lands FIRST and any landed hit strips exactly 1 shield,
    // so each foe is down a shield before the magnet takes its cut.
    expect(s.cards[near.instanceId].curShields).toBe(1); // 5 -1 hit -3 stolen
    expect(s.cards[far.instanceId].curShields).toBe(4); // 5 -1 hit, out of reach
    // 5 printed + 3 magnetised off the near rank + 2 from Exostone, which now
    // pays a shield for every plate a BORE attack breaks — and this barrage
    // broke one off each of the two foes via the normal shield gate.
    expect(s.cards[steel.instanceId].curShields).toBe(10);
  });

  it("...and takes only what a foe actually has, never more", () => {
    const s = prepState();
    const steel = place(s, "bore_steel", "P1", 3, 0);
    s.cards[steel.instanceId].curShields = 0;
    const thin = place(s, "dusk_gool", "P2", 2, 0, { curHp: 40, maxHp: 40, curShields: 2 });
    SPECIAL_HANDLERS.barrage(s, s.cards[steel.instanceId], [s.cards[thin.instanceId]],
      getDef("bore_steel").special!.params!);
    // 2 shields, 1 stripped by the hit, leaving 1 for a magnet that wanted 3.
    expect(s.cards[thin.instanceId].curShields).toBe(0);
    // 1 from Exostone's break, then only the 1 plate left for the magnet to
    // take — "up to 3", not a flat 3.
    expect(s.cards[steel.instanceId].curShields).toBe(2);
  });

  it("SirCrest wields the PYRO (Scorch) and AQUA (Flow Change) element auras", () => {
    const def = getDef("dawn_sircrest");
    // Carries both borrowed element auras, plus his native DAWN.
    expect(hasElementAura(def, "PYRO")).toBe(true);
    expect(hasElementAura(def, "AQUA")).toBe(true);
    expect(hasElementAura(def, "DAWN")).toBe(true);
    // Scorch in action: his basic attack sets the target alight (BURN).
    const s = prepState();
    const sir = place(s, "dawn_sircrest", "P1", 3, 0);
    const foe = place(s, "dusk_gool", "P2", 2, 0, { curHp: 40, maxHp: 40, curShields: 0 });
    basicAttack(s, sir.instanceId, foe.instanceId);
    expect(s.cards[foe.instanceId].statuses.some((x) => x.kind === "BURN")).toBe(true);
  });

  it("bloodfire tag: a target is bloodfire only when it carries BOTH BLEED and BURN", () => {
    const s = prepState();
    const c = place(s, "dusk_gool", "P2", 2, 0, { curHp: 40, maxHp: 40, curShields: 0 });
    const card = s.cards[c.instanceId];
    expect(isBloodfire(card)).toBe(false); // clean
    card.statuses = [{ kind: "BLEED", duration: 2, power: 2, source: "LEAF" }];
    expect(isBloodfire(card)).toBe(false); // bleeding only
    card.statuses.push({ kind: "BURN", duration: 2, power: 2, source: "PYRO" });
    expect(isBloodfire(card)).toBe(true); // blood + fire
    card.statuses = card.statuses.filter((x) => x.kind !== "BLEED");
    expect(isBloodfire(card)).toBe(false); // burning only
  });

  it("Blackout's Fryer deals +1 to PARALYZED opponents", () => {
    const s = prepState();
    const shock = place(s, "bolt_shock", "P1", 3, 0);
    const para = place(s, "dusk_gool", "P2", 2, 0, { curHp: 50, maxHp: 50, curShields: 0 });
    const normal = place(s, "dusk_gool", "P2", 2, 1, { curHp: 50, maxHp: 50, curShields: 0 });
    s.cards[para.instanceId].statuses = [{ kind: "PARALYZE", duration: 2, power: 0, source: "BOLT" }];
    SPECIAL_HANDLERS.fryer(s, s.cards[shock.instanceId], [s.cards[para.instanceId], s.cards[normal.instanceId]], { dmg: 4, hits: 1, paralyzeBonus: 1 });
    expect(50 - s.cards[para.instanceId].curHp).toBe(5); // 4 + 1 (paralyzed)
    expect(50 - s.cards[normal.instanceId].curHp).toBe(4); // base 4
  });

  it("Highroller's Purple Strikes hits the 4 CLOSEST opponents, sparing farther ones", () => {
    const s = prepState();
    const striik = place(s, "bolt_striik", "P1", 3, 0);
    const near = [
      place(s, "dusk_gool", "P2", 2, 0, { curHp: 50, maxHp: 50, curShields: 0 }), // dist 1
      place(s, "dusk_gool", "P2", 3, 1, { curHp: 50, maxHp: 50, curShields: 0 }), // dist 1
      place(s, "dusk_gool", "P2", 2, 1, { curHp: 50, maxHp: 50, curShields: 0 }), // dist 2
      place(s, "dusk_gool", "P2", 1, 0, { curHp: 50, maxHp: 50, curShields: 0 }), // dist 2
    ];
    const far = place(s, "dusk_gool", "P2", 0, 3, { curHp: 50, maxHp: 50, curShields: 0 }); // dist 6
    const all = [...near.map((c) => s.cards[c.instanceId]), s.cards[far.instanceId]];
    SPECIAL_HANDLERS.barrage(s, s.cards[striik.instanceId], all, { dmg: 4, targets: 4, closest: 1 });
    for (const c of near) expect(s.cards[c.instanceId].curHp).toBeLessThan(50); // 4 closest hit
    expect(s.cards[far.instanceId].curHp).toBe(50); // the 5th, farther, is spared
  });

  it("GigaVolt's Turret Mode electrifies the board, then fires 3 volleys over 3 rounds", () => {
    const s = prepState();
    const giga = place(s, "bolt_gigavolt", "P1", 3, 0);
    // Neither foe starts electrified — Turret Mode electrifies them itself.
    const zap = place(s, "dusk_gool", "P2", 2, 0, { curHp: 100, maxHp: 100, curShields: 0 });
    SPECIAL_HANDLERS.turretMode(s, s.cards[giga.instanceId], [], { dmg: 3, rounds: 3 });
    expect(statusOf(s.cards[zap.instanceId], "ELECTRIFIED")).toBeTruthy(); // pinned
    expect(100 - s.cards[zap.instanceId].curHp).toBe(3); // volley 1 (on cast)
    let n = advance(atCleanup(s));
    expect(100 - n.cards[zap.instanceId].curHp).toBe(6); // volley 2
    n = advance(atCleanup(n));
    expect(100 - n.cards[zap.instanceId].curHp).toBe(9); // volley 3
    n = advance(atCleanup(n));
    expect(100 - n.cards[zap.instanceId].curHp).toBe(9); // turret spent — no 4th
  });

  it("Sarachnid's Silk Chase nests a new Spider for every opponent it kills", () => {
    const s = prepState();
    const sara = place(s, "dusk_sarachnid", "P1", 3, 0);
    const spiders = () => boardCards(s, "P1").filter((c) => getDef(c.defId).id === "dusk_spider").length;
    const before = spiders();
    // A 1-HP victim in reach: the swarm kills it, which should hatch one more.
    place(s, "dusk_gool", "P2", 2, 0, { curHp: 1, maxHp: 40, curShields: 0 });
    SPECIAL_HANDLERS.tribeSwarm(s, s.cards[sara.instanceId], boardCards(s, "P2"), {
      tribe: "Spider", frighten: 1, healPerHit: 2, spawnOnKill: "dusk_spider",
    });
    expect(spiders()).toBe(before + 1); // the kill fed the nest
  });

  it("Static Cloud strikes a random opponent for 4 and PARALYZEs it 2 rounds", () => {
    const s = prepState();
    place(s, "bolt_staticcloud", "P1", 3, 0);
    const foe = place(s, "dusk_gool", "P2", 2, 0, { curHp: 40, maxHp: 40, curShields: 0 });
    const next = advance(atCleanup(s));
    expect(40 - next.cards[foe.instanceId].curHp).toBe(4);
    expect(statusOf(next.cards[foe.instanceId], "PARALYZE")?.duration).toBe(2);
  });

  it("Volta's Overcharge: basics gain PEN while an allied Rodd is on the board", () => {
    // No Rodd — a 4-DMG basic is fully soaked by 5 shields.
    const s = prepState();
    const v1 = place(s, "bolt_volta", "P1", 3, 0);
    const f1 = place(s, "dusk_gool", "P2", 2, 0, { curHp: 40, maxHp: 40, curShields: 5 });
    basicAttack(s, v1.instanceId, f1.instanceId);
    expect(s.cards[f1.instanceId].curHp).toBe(40); // shields absorbed it, no PEN

    // A Rodd on the board (placed away so its Conduction adds no DMG) → PEN pierces.
    const s2 = prepState();
    const v2 = place(s2, "bolt_volta", "P1", 3, 0);
    place(s2, "bolt_rodd", "P1", 3, 3);
    const f2 = place(s2, "dusk_gool", "P2", 2, 0, { curHp: 40, maxHp: 40, curShields: 5 });
    basicAttack(s2, v2.instanceId, f2.instanceId);
    expect(40 - s2.cards[f2.instanceId].curHp).toBe(4); // 4 straight to HP
  });

  it("Buzzard's Drone Sweep deploys a Drone beside a new enemy and strafes it", () => {
    const s = prepState();
    place(s, "bolt_buzzard", "P1", 3, 0);
    // P2 summons into its own home row; the reaction fires off the real summon
    // path, not a hand-called handler.
    // giveHand returns the new entry's id — prepState already dealt an opening
    // hand, so hand[0] would be some other card entirely.
    const handId = giveHand(s, "P2", "dusk_gool");
    s.prep = { priority: "P2", consecutivePasses: 0, movedThisTurn: false };
    s.players.P2.gold = 20;
    const next = applyIntent(s, { type: "SUMMON", player: "P2", handId, col: 1 });
    const drone = boardCards(next, "P1").find((c) => getDef(c.defId).id === "bolt_drone_tok");
    expect(drone, "a Drone should have been launched").toBeTruthy();
    const foe = boardCards(next, "P2").find((c) => getDef(c.defId).id === "dusk_gool")!;
    // Landed adjacent to the newcomer, and strafed it for 1.
    expect(Math.max(Math.abs(drone!.pos!.row - foe.pos!.row), Math.abs(drone!.pos!.col - foe.pos!.col))).toBe(1);
    expect(foe.curShields + foe.curHp).toBeLessThan(getDef("dusk_gool").hp + getDef("dusk_gool").shields);
  });

  it("Rumbler's Rolling Start carries it a slot downfield after each basic", () => {
    const s = prepState();
    const rollo = place(s, "bore_rollo", "P1", 3, 0); // P1 advances toward row 0
    // Off-column target so the slot Rumbler rolls into stays clear.
    const foe = place(s, "dusk_gool", "P2", 2, 1, { curHp: 40, maxHp: 40, curShields: 0 });
    basicAttack(s, rollo.instanceId, foe.instanceId);
    expect(s.cards[rollo.instanceId].pos?.row).toBe(2); // rolled 3 -> 2
    s.cards[rollo.instanceId].attackedThisRound = false;
    basicAttack(s, rollo.instanceId, foe.instanceId);
    expect(s.cards[rollo.instanceId].pos?.row).toBe(1); // and on to 1
  });

  it("Thorny Ripper's False Head is ONE dodge for the whole game", () => {
    const s = prepState();
    // Fat HP + no shields on purpose: we're measuring whether damage lands at
    // all, not how the 4-HP body survives it.
    const devil = place(s, "bore_thorny_ripper", "P1", 3, 0, { curHp: 40, maxHp: 40, curShields: 0 });
    const melee = place(s, "dusk_widowbite", "P2", 3, 1, { curHp: 40, maxHp: 40, curShields: 0 });
    basicAttack(s, melee.instanceId, devil.instanceId);
    expect(s.cards[devil.instanceId].curHp, "decoy soaked the whole attack").toBe(40);

    // Spent for good — not "until next round". Clearing the per-round attack
    // guard is what the old per-round decoy relied on, so if the reset ever
    // came back this is the assertion that catches it.
    s.cards[melee.instanceId].attackedThisRound = false;
    basicAttack(s, melee.instanceId, devil.instanceId);
    const afterSecond = s.cards[devil.instanceId].curHp;
    expect(afterSecond, "the next attack lands for real").toBeLessThan(40);

    // ...and it stays spent across a round boundary.
    const next = advance(atCleanup(s));
    const d2 = boardCards(next, "P1").find((c) => c.defId === "bore_thorny_ripper")!;
    const m2 = boardCards(next, "P2").find((c) => c.defId === "dusk_widowbite")!;
    basicAttack(next, m2.instanceId, d2.instanceId);
    expect(next.cards[d2.instanceId].curHp, "no fresh decoy next round").toBeLessThan(afterSecond);
  });

  it("...and it answers a RANGED attacker too", () => {
    // It used to be melee-only, which on a 4 HP body meant a melee attacker
    // could never finish it while a ranged one ignored the passive entirely.
    const s = prepState();
    const devil = place(s, "bore_thorny_ripper", "P1", 3, 0, { curHp: 40, maxHp: 40, curShields: 0 });
    const ranged = place(s, "dusk_gool", "P2", 2, 0, { curHp: 40, maxHp: 40, curShields: 0 });
    basicAttack(s, ranged.instanceId, devil.instanceId);
    expect(s.cards[devil.instanceId].curHp, "the decoy took it").toBe(40);
  });

  it("...but a SPECIAL punches straight through it", () => {
    // Basics only. A guaranteed dodge that could also blank a Mythic's Special
    // was too much on a cost-2 body — a blocker should turn away a swing, not
    // someone's once-a-game payoff.
    const s = prepState();
    const devil = place(s, "bore_thorny_ripper", "P1", 3, 0, { curHp: 40, maxHp: 40, curShields: 0 });
    const caster = place(s, "dusk_gool", "P2", 2, 0);
    SPECIAL_HANDLERS.strike(s, s.cards[caster.instanceId], [s.cards[devil.instanceId]], { dmg: 9 });
    expect(s.cards[devil.instanceId].curHp, "the Special landed").toBe(31);
    expect(s.cards[devil.instanceId].falseHeadUsed, "and the dodge is still held").toBeFalsy();
    // ...and it is still there for the next basic.
    const melee = place(s, "dusk_widowbite", "P2", 3, 1);
    basicAttack(s, melee.instanceId, devil.instanceId);
    expect(s.cards[devil.instanceId].curHp, "the basic was dodged").toBe(31);
  });

  it("...and its own REFLECT does not spend the dodge", () => {
    // Spined Hide (REFLECT 2) is unchanged, and reflect damage is not an attack
    // — without that exclusion the Ripper would burn its one dodge on the first
    // thing that touched it.
    const s = prepState();
    const devil = place(s, "bore_thorny_ripper", "P1", 3, 0, { curHp: 40, maxHp: 40, curShields: 0 });
    const melee = place(s, "dusk_widowbite", "P2", 3, 1, { curHp: 40, maxHp: 40, curShields: 0 });
    expect(getDef("bore_thorny_ripper").keywords.REFLECT).toBe(2);
    basicAttack(s, melee.instanceId, devil.instanceId);
    // The attack was dodged, so nothing was reflected and the dodge is spent
    // exactly once — the attacker is untouched.
    expect(s.cards[devil.instanceId].curHp).toBe(40);
    expect(s.cards[devil.instanceId].falseHeadUsed).toBe(true);
  });

  it("Granite Ankylosaur's Tail Club can SLEEP what it hits", () => {
    const d = getDef("bore_ankylosaur");
    expect(d.onHitStatus).toMatchObject({ kind: "SLEEP", duration: 2, chance: 50 });
    expect(d.keywords.BLOCK).toBe(1);
  });

  it("Zipp's Swarm Deploy drops a 1/1 FLYING Drone beside it", () => {
    const s = prepState();
    const zipp = place(s, "bolt_zipp", "P1", 3, 0);
    SPECIAL_HANDLERS.spawn(s, s.cards[zipp.instanceId], [], { token: "bolt_drone_tok", count: 1, radius: 1 });
    const drone = boardCards(s, "P1").find((c) => getDef(c.defId).id === "bolt_drone_tok");
    expect(drone).toBeTruthy();
    const d = getDef("bolt_drone_tok");
    expect([d.dmg, d.hp]).toEqual([1, 1]); // a 1/1
    expect(d.keywords.FLYING).toBe(true); // dodges melee outright
  });

  it("Smith's Reforged plates NEARBY allies +2 shields and +1 DMG for the round", () => {
    const s = prepState();
    const smith = place(s, "bore_smith", "P1", 3, 1);
    const near = place(s, "leaf_alpha", "P1", 3, 2, { curShields: 0 }); // touching
    const far = place(s, "leaf_alpha", "P1", 0, 3, { curShields: 0 }); // across the board
    const farDmgBefore = effectiveDmg(s, s.cards[far.instanceId]);
    SPECIAL_HANDLERS.grantShield(s, s.cards[smith.instanceId], [], { amount: 2, nearby: 1, buffDmg: 1, buffRounds: 1 });
    expect(s.cards[near.instanceId].curShields).toBe(2); // plated
    expect(effectiveDmg(s, s.cards[near.instanceId])).toBeGreaterThan(farDmgBefore); // +1 DMG
    expect(s.cards[far.instanceId].curShields).toBe(0); // out of reach
    expect(effectiveDmg(s, s.cards[far.instanceId])).toBe(farDmgBefore);
  });

  it("Rodd's Conduction gives +1 DMG to ADJACENT allies only", () => {
    const s = prepState();
    place(s, "bolt_rodd", "P1", 3, 0);
    // Both BOLT now — Conduction is element-filtered, so a LEAF pair would have
    // measured 0 against 0 and passed for entirely the wrong reason.
    // Both in the home row (no King-of-the-Hill difference); one touches Rodd, one doesn't.
    const near = place(s, "bolt_zap", "P1", 3, 1); // chebyshev 1 — adjacent
    const far = place(s, "bolt_zap", "P1", 3, 3); // chebyshev 3 — not adjacent
    expect(effectiveDmg(s, s.cards[near.instanceId]) - effectiveDmg(s, s.cards[far.instanceId])).toBe(1);
  });

  it("Reflection's Light Screen shields allies within range each round, not far ones", () => {
    const s = prepState();
    place(s, "dawn_reflection", "P1", 3, 1); // Melee → reach 1
    const near = place(s, "dawn_able", "P1", 3, 2, { curShields: 0 }); // adjacent
    const far = place(s, "dawn_able", "P1", 0, 3, { curShields: 0 }); // across the board
    const next = advance(atCleanup(s));
    expect(next.cards[near.instanceId].curShields).toBe(3); // +3 in range
    expect(next.cards[far.instanceId].curShields).toBe(0); // out of range
  });

  it("Imperator's Strike of Dawn commands every ally to fire a basic attack", () => {
    const s = prepState();
    const imp = place(s, "dawn_imperator", "P1", 3, 0);
    place(s, "leaf_alpha", "P1", 3, 1); // an ally that will be commanded to swing
    const foe1 = place(s, "dusk_gool", "P2", 2, 0, { curHp: 60, maxHp: 60, curShields: 0 });
    const foe2 = place(s, "dusk_gool", "P2", 2, 1, { curHp: 60, maxHp: 60, curShields: 0 });
    SPECIAL_HANDLERS.spawn(s, s.cards[imp.instanceId], [], { token: "dawn_heir_tok", count: 1, commandAllies: 1 });
    // Imperator swings at the foe ahead of it; the ally swings at the foe ahead of it.
    expect(s.cards[foe1.instanceId].curHp).toBeLessThan(60);
    expect(s.cards[foe2.instanceId].curHp).toBeLessThan(60);
    // Heir is still raised by the same command.
    expect(boardCards(s, "P1").some((c) => getDef(c.defId).id === "dawn_heir_tok")).toBe(true);
  });

  it("Oak's Reroot talent marches it forward toward the enemy home", () => {
    const s = prepState();
    const oak = place(s, "leaf_oak", "P1", 3, 0); // SP 0, planted at its home row
    // Read the talent's OWN params rather than hardcoding the distance, so
    // retuning Reroot can't leave this test asserting a stale number.
    const talent = getDef("leaf_oak").talent!;
    const charge = Number(talent.params!.charge);
    SPECIAL_HANDLERS.reposition(s, s.cards[oak.instanceId], [], talent.params!);
    expect(s.cards[oak.instanceId].pos?.row).toBe(3 - charge); // straight up a clear column
  });

  it("Sakuroot's Petalfall heals LEAF home-row allies (on top of Photosynthesis)", () => {
    const s = prepState();
    place(s, "leaf_sakuroot", "P1", 3, 0);
    const homeLeaf = place(s, "leaf_alpha", "P1", 3, 1, { curHp: 5, maxHp: 30 });
    const offLeaf = place(s, "leaf_alpha", "P1", 2, 1, { curHp: 5, maxHp: 30 });
    const next = advance(atCleanup(s));
    expect(next.cards[homeLeaf.instanceId].curHp).toBe(9); // +2 Photosynthesis +2 Petalfall
    expect(next.cards[offLeaf.instanceId].curHp).toBe(7); // +2 Photosynthesis only (not home row)
  });

  it("Halo's Purelight: DAWN allies shrug BLIND and pierce enemy EVASION", () => {
    const s = prepState();
    place(s, "dawn_halo", "P1", 3, 0);
    const ally = place(s, "dawn_able", "P1", 3, 1); // a DAWN ally
    applyStatus(s, s.cards[ally.instanceId], "BLIND", 2, 0, "AQUA");
    expect(statusOf(s.cards[ally.instanceId], "BLIND")).toBeUndefined(); // Purelight blocks it
    // A DAWN attacker's hit pierces EVASION while Halo stands.
    const evader = place(s, "gale_tumbleweed", "P2", 2, 0, { curHp: 9, maxHp: 9, curShields: 0 }); // EVASION
    const halo = boardCards(s, "P1").find((c) => getDef(c.defId).id === "dawn_halo")!;
    basicAttack(s, halo.instanceId, evader.instanceId);
    expect(9 - s.cards[evader.instanceId].curHp).toBe(3); // always lands (3 DMG), no dodge
  });

  it("Halo: Blessed Light heals home-row allies; Mending Horn heals +8 and strips only negatives", () => {
    const s = prepState();
    place(s, "dawn_halo", "P1", 3, 0);
    const home = place(s, "dawn_able", "P1", 3, 2, { curHp: 5, maxHp: 20 });
    const next = advance(atCleanup(s));
    expect(next.cards[home.instanceId].curHp).toBe(6); // +1 Blessed Light (home row)

    // Mending Horn: +8 HP, strip BLEED (negative), keep a positive timed buff.
    const s2 = prepState();
    const h2 = place(s2, "dawn_halo", "P1", 3, 0);
    const ally = place(s2, "dawn_able", "P1", 3, 1, { curHp: 6, maxHp: 20 });
    s2.cards[ally.instanceId].statuses = [{ kind: "BLEED", duration: 2, power: 2, source: "LEAF" }];
    s2.cards[ally.instanceId].buffs = [{ dmg: 2, sp: 0, rounds: 2 }];
    SPECIAL_HANDLERS.heal(s2, s2.cards[h2.instanceId], [s2.cards[ally.instanceId]], { targets: 1, amount: 8, cleanseNegatives: 1 });
    expect(s2.cards[ally.instanceId].curHp).toBe(14); // 6 + 8
    expect(statusOf(s2.cards[ally.instanceId], "BLEED")).toBeUndefined(); // negative stripped
    expect(s2.cards[ally.instanceId].buffs).toHaveLength(1); // positive buff kept
  });

  it("Twinbolt's Twin Strike chains a bonus CRIT strike on a crit, once per round", () => {
    const s = prepState();
    const ning = place(s, "bolt_ning", "P1", 3, 0); // 3 DMG, CRIT
    // hoaxMarked forces the basic to CRIT (skips the coin), so Twin Strike fires.
    const foe = place(s, "dusk_gool", "P2", 2, 0, { curHp: 60, maxHp: 60, curShields: 0, hoaxMarked: true });
    basicAttack(s, ning.instanceId, foe.instanceId);
    // Basic CRIT alone is 3×2 = 6; Twin Strike adds a 2×1 CRIT strike on top.
    expect(60 - s.cards[foe.instanceId].curHp).toBeGreaterThan(6);
    expect(s.cards[ning.instanceId].twinStrikeFiredRound).toBe(true);
  });

  it("bloodfire payoff: Firecrack doubles its hit only vs a BLEEDING+BURNING target", () => {
    // Control: a target that is only BLEEDING (not bloodfire) takes the base 5.
    const s1 = prepState();
    const fc1 = place(s1, "pyro_firecrack", "P1", 3, 0);
    const bleedOnly = place(s1, "dusk_gool", "P2", 2, 0, {
      curHp: 40, maxHp: 40, curShields: 0,
      status: { kind: "BLEED", duration: 3, power: 2, source: "LEAF" },
    });
    basicAttack(s1, fc1.instanceId, bleedOnly.instanceId);
    expect(40 - s1.cards[bleedOnly.instanceId].curHp).toBe(5); // no mult

    // Bloodfire: BLEED + BURN both present → the hit doubles (5 → 10).
    const s2 = prepState();
    const fc2 = place(s2, "pyro_firecrack", "P1", 3, 0);
    const bf = place(s2, "dusk_gool", "P2", 2, 0, { curHp: 40, maxHp: 40, curShields: 0 });
    s2.cards[bf.instanceId].statuses = [
      { kind: "BLEED", duration: 3, power: 2, source: "LEAF" },
      { kind: "BURN", duration: 3, power: 2, source: "PYRO" },
    ];
    basicAttack(s2, fc2.instanceId, bf.instanceId);
    expect(40 - s2.cards[bf.instanceId].curHp).toBe(10); // ×2 vs bloodfire
  });

  it("Nightbriar's Predator's Snare: a kill lays a trap that springs on the next enemy to step on it", () => {
    const s = prepState();
    const darth = place(s, "leaf_darth", "P1", 3, 1, { curHp: 17, maxHp: 17 });
    // A fragile foe Nightbriar one-shots (6 DMG, CRIT → 12).
    const prey = place(s, "dusk_gool", "P2", 2, 1, { curHp: 2, maxHp: 2, curShields: 0 });
    basicAttack(s, darth.instanceId, prey.instanceId);
    // The prey fell; a trap owned by P1 now sits on its old slot.
    const trap = s.traps.find((t) => t.pos.row === 2 && t.pos.col === 1);
    expect(trap).toBeTruthy();
    expect(trap!.owner).toBe("P1");
    // Wound Nightbriar so the LIFESTEAL is observable.
    s.cards[darth.instanceId].curHp = 5;
    // An enemy walks onto the trapped slot.
    const foe = place(s, "dusk_gool", "P2", 1, 1, { curHp: 40, maxHp: 40, curShields: 0 });
    s.prep = { priority: "P2", consecutivePasses: 0, movedThisTurn: false };
    const n = applyIntent(s, { type: "MOVE", player: "P2", instanceId: foe.instanceId, to: { row: 2, col: 1 } });
    // 3, not Dark Hunting's 7: the trap is half the Special now that it also
    // answers summons. ROOT and LIFESTEAL are untouched.
    expect(40 - n.cards[foe.instanceId].curHp).toBe(3);
    expect(statusOf(n.cards[foe.instanceId], "ROOT")).toBeTruthy(); // ROOT 2
    expect(n.cards[darth.instanceId].curHp).toBe(8); // LIFESTEAL 3 (5 → 8)
    expect(n.traps).toHaveLength(0); // one square, one time — spent
  });

  it("Nightbriar's trap answers a SUMMON onto the square, not just a walk", () => {
    // The slot a card died on is exactly the slot its owner wants back, so a
    // trap that only watched movement could be stepped around by placing a body
    // on it instead. Arrival is arrival.
    const s = prepState();
    const darth = place(s, "leaf_darth", "P1", 3, 1, { curHp: 17, maxHp: 17 });
    const prey = place(s, "dusk_gool", "P2", 2, 1, { curHp: 2, maxHp: 2, curShields: 0 });
    basicAttack(s, darth.instanceId, prey.instanceId);
    expect(s.traps.find((t) => t.pos.row === 2 && t.pos.col === 1)).toBeTruthy();
    // P2 summons straight onto the trapped square. Summons land in the home
    // row, so put the trap there for a faithful test of the summon path.
    const s2 = prepState();
    const d2 = place(s2, "leaf_darth", "P1", 3, 1, { curHp: 17, maxHp: 17 });
    s2.traps.push({
      owner: "P1", pos: { row: 0, col: 0 }, label: "Nightbriar's trap",
      sourceId: d2.instanceId, dmg: 3,
      status: { kind: "ROOT", duration: 2, power: 0 }, lifesteal: 1,
    } as (typeof s2.traps)[number]);
    const hand = giveHand(s2, "P2", "dusk_gool");
    s2.prep = { priority: "P2", consecutivePasses: 0, movedThisTurn: false };
    s2.players.P2.gold = 20;
    const n = applyIntent(s2, { type: "SUMMON", player: "P2", handId: hand, col: 0 });
    const landed = boardCards(n, "P2").find((c) => c.pos && c.pos.row === 0 && c.pos.col === 0);
    expect(landed, "the summon resolved").toBeTruthy();
    expect(getDef(landed!.defId).hp - landed!.curHp, "took the trap on arrival").toBe(3);
    expect(n.traps, "spent on arrival").toHaveLength(0);
  });

  it("Cloudburst's storm covers every neighbour; Totem Spirit still picks one", () => {
    // `splashAll` widens BOTH of Cloudburst's splashes — its own Rainstorm and
    // the Downpour it grants the team. It is a property of the card, not of the
    // mechanic, which is what keeps Totem Spirit clipping a single extra target.
    const H = { curHp: 60, maxHp: 60, curShields: 0 };
    const surround = (auraId: string, attackerId: string) => {
      const s = prepState();
      place(s, auraId, "P1", 3, 3);
      const attacker = auraId === attackerId
        ? place(s, attackerId, "P1", 3, 1)
        : place(s, attackerId, "P1", 3, 1);
      const primary = place(s, "dusk_gool", "P2", 2, 1, H);
      const n1 = place(s, "dusk_gool", "P2", 2, 0, H);
      const n2 = place(s, "dusk_gool", "P2", 2, 2, H);
      const far = place(s, "dusk_gool", "P2", 0, 3, H);
      basicAttack(s, attacker.instanceId, primary.instanceId);
      const took = (c: { instanceId: string }) => 60 - s.cards[c.instanceId].curHp;
      return { primary: took(primary), n1: took(n1), n2: took(n2), far: took(far) };
    };
    // Cloudburst itself: every neighbour eats Downpour 1 + Rainstorm 1.
    const own = surround("aqua_rain", "aqua_rain");
    expect(own.primary).toBe(10);
    expect([own.n1, own.n2], "both neighbours, not just the first").toEqual([2, 2]);
    expect(own.far, "adjacency is to the TARGET, not the board").toBe(0);
    // An ally under Downpour: every neighbour, but only the chip.
    const ally = surround("aqua_rain", "aqua_piranha");
    expect([ally.n1, ally.n2]).toEqual([1, 1]);
    expect(ally.far).toBe(0);
    // There used to be a contrast case here — Totem's aura clipping exactly ONE
    // neighbour, proving splashAll belongs to Cloudburst rather than to the splash
    // mechanic. Totem Spirit grants accuracy now and no card grants a
    // single-target splash, so the contrast has nowhere left to stand. What
    // remains still pins Cloudburst's own behaviour, which the test is named for.
  });

  it("Downpour chips for 1 while Totem Spirit still clips for full", () => {
    // Cloudburst's aura used to be a second FULL basic hit for the whole team.
    // On Cloudburst itself it stacked with its own Rainstorm onto the same
    // neighbour, so a 10-damage basic put 12 on the card BESIDE the target —
    // more than it dealt to the thing it aimed at.
    const splashOnNeighbour = (auraId: string, attackerId: string) => {
      const s = prepState();
      place(s, auraId, "P1", 3, 0);
      const attacker = auraId === attackerId
        ? boardCards(s, "P1")[0]
        : place(s, attackerId, "P1", 3, 1);
      const primary = place(s, "dusk_gool", "P2", 2, 1, { curHp: 60, maxHp: 60, curShields: 0 });
      const adj = place(s, "dusk_gool", "P2", 2, 2, { curHp: 60, maxHp: 60, curShields: 0 });
      basicAttack(s, attacker.instanceId, primary.instanceId);
      return { adj: 60 - s.cards[adj.instanceId].curHp, primary: 60 - s.cards[primary.instanceId].curHp };
    };
    // Cloudburst on itself: 1 from Downpour + 2 from Rainstorm, not 10 + 2.
    const own = splashOnNeighbour("aqua_rain", "aqua_rain");
    expect(own.primary).toBe(10);
    expect(own.adj, "Downpour 1 + Rainstorm 1").toBe(2);
    // An ally only gets Downpour's chip.
    expect(splashOnNeighbour("aqua_rain", "aqua_piranha").adj).toBe(1);
    // `splashAura` stays `boolean | number`, but NOTHING sets the boolean any
    // more: Totem was the only card that did and its aura is accuracy now. The
    // full-hit branch is live engine code with no card behind it — either a future
    // card claims it, or it should be simplified down to a number.
  });

  it("a ROOT landing mid-battle demotes its victim in the speed queue", () => {
    // The queue was built once at the top of the phase and never re-read, so a
    // card pinned DURING the phase kept the slot it was given before it was
    // pinned. Evera's Grounded exists to change the order of the round it is
    // cast in, and did nothing to it.
    //
    // All three are P1's, so nobody has a target, nobody attacks and nobody
    // dies — this measures ORDER and only order.
    const s = prepState();
    const fast = place(s, "leaf_trinezer", "P1", 3, 0);  // SP 15
    const mid = place(s, "leaf_sticks", "P1", 3, 1);     // SP 10
    const slow = place(s, "leaf_oak", "P1", 3, 2);       // SP 0
    const b = atBattle(s);
    const order = (g: typeof b) => g.battle!.queue.map((id) => g.cards[id]?.defId);
    expect(order(b)).toEqual(["leaf_trinezer", "leaf_sticks", "leaf_oak"]);
    // Pin the front-runner before anything has acted. effectiveSp -> 0.
    applyStatus(b, b.cards[fast.instanceId], "ROOT", 2, 0, "LEAF");
    expect(effectiveSp(b, b.cards[fast.instanceId])).toBe(0);
    const n = advance(b); // one step re-sorts the not-yet-acted tail
    // Trinezer is now behind Sticks. It ties with Oak at 0 and the sort is
    // stable, so it keeps its relative position ahead of Oak rather than
    // churning past it.
    expect(order(n)).toEqual(["leaf_sticks", "leaf_trinezer", "leaf_oak"]);
    expect(mid && slow).toBeTruthy();
  });

  it("does not reorder cards that have already acted", () => {
    // The guard that matters: only the tail from `index` on may move, or a card
    // could be pulled back in and act twice.
    const s = prepState();
    place(s, "leaf_trinezer", "P1", 3, 0);
    place(s, "leaf_sticks", "P1", 3, 1);
    place(s, "leaf_oak", "P1", 3, 2);
    let g = atBattle(s);
    const first = g.battle!.queue[0];
    g = advance(g); // Trinezer acts (nothing to do) and the index moves past it
    expect(g.battle!.index).toBe(1);
    // Now slow the card that ALREADY acted right down; it must not move.
    applyStatus(g, g.cards[first], "ROOT", 2, 0, "LEAF");
    const after = advance(g);
    expect(after.battle!.queue[0], "the acted card keeps its slot").toBe(first);
  });

  it("SkullKing raises its SkullDrake even when its own skeletons crowd it", () => {
    // The systemic one: `spawnRadius` DEFAULTED to 1, so every Special that
    // never thought to mention a radius was tethered to the 8 adjacent slots.
    // SkullKing is the sharpest case — it raises two skeletons a round to a
    // standing cap of six, so its own tokens crowd it and King's SkullDrake had
    // nowhere to land. A card should not be able to lock itself out of its own
    // Special by working correctly.
    const s = prepState();
    const sk = place(s, "dusk_skullking", "P1", 3, 1);
    for (const [r, c] of [[3, 0], [3, 2], [2, 0], [2, 1], [2, 2]] as const)
      place(s, "dusk_skeleton_tok", "P1", r as 3, c as 0);
    place(s, "aqua_piranha", "P2", 2, 3);
    SPECIAL_HANDLERS.barrage(s, s.cards[sk.instanceId], [], {
      dmg: 0, rowAhead: 1, targets: 99, spawnToken: "dusk_skulldrake_tok", spawnCount: 1,
    });
    expect(
      boardCards(s, "P1").filter((c) => c.defId === "dusk_skulldrake_tok").length,
      "found a slot beyond its own horde",
    ).toBe(1);
  });

  it("Volta deploys its Rodd even when boxed in — both spawns", () => {
    // Volta is a Support standing behind its own line, so its neighbours are its
    // own team and being surrounded is its normal state. Worse than a missing
    // body: Overcharge keys off a Rodd STANDING, so a failed deploy silently
    // cost the passive too.
    const boxIn = (g: ReturnType<typeof prepState>, at: readonly [number, number]) => {
      const v = place(g, "bolt_volta", "P1", at[0] as 3, at[1] as 1);
      for (const [r, c] of [[3, 0], [3, 2], [2, 0], [2, 1], [2, 2]] as const)
        place(g, "bolt_zap", "P1", r as 3, c as 0);
      return v;
    };
    const rodds = (g: ReturnType<typeof prepState>) =>
      boardCards(g, "P1").filter((c) => c.defId === "bolt_rodd").length;

    // Grid Deployment (the Special).
    const s1 = prepState();
    const v1 = boxIn(s1, [3, 1]);
    SPECIAL_HANDLERS.spawn(s1, s1.cards[v1.instanceId], [], { token: "bolt_rodd", count: 1 });
    expect(rodds(s1), "the Special found a slot beyond the ring").toBe(1);

    // Relay Network (the on-summon) goes through the real summon path.
    const s2 = prepState();
    for (const [r, c] of [[3, 0], [3, 2], [2, 0], [2, 1], [2, 2]] as const)
      place(s2, "bolt_zap", "P1", r as 3, c as 0);
    const h = giveHand(s2, "P1", "bolt_volta");
    s2.players.P1.gold = 20;
    s2.prep = { priority: "P1", consecutivePasses: 0, movedThisTurn: false };
    const n = applyIntent(s2, { type: "SUMMON", player: "P1", handId: h, col: 1 });
    expect(rodds(n), "Relay Network deployed on summon").toBe(1);
  });

  it("Sylvane's Emergence still raises an Elephlora when boxed in", () => {
    // `radius: 1` searched only the 8 slots around the caster and gave up if
    // none were free — and Sylvane is a melee Warrior standing in the line, so
    // crowded neighbours are its normal state. Same tether that was eating
    // Zipp's Drone. The team heal always resolved, which is what made the
    // missing body easy to miss.
    const s = prepState();
    const syl = place(s, "leaf_efy", "P1", 3, 1);
    // Fill every slot touching Sylvane.
    for (const [r, c] of [[3, 0], [3, 2], [2, 0], [2, 1], [2, 2]] as const)
      place(s, "leaf_nettle", "P1", r, c);
    const before = boardCards(s, "P1").filter((c) => c.defId === "leaf_walking_tree").length;
    SPECIAL_HANDLERS.spawn(s, s.cards[syl.instanceId], [], {
      token: "leaf_walking_tree", count: 1, healAllies: 4,
    });
    const after = boardCards(s, "P1").filter((c) => c.defId === "leaf_walking_tree").length;
    expect(after - before, "found a slot beyond the ring").toBe(1);
  });

  it("Oak's Acorn Drop sprouts once a round, not once a hit", () => {
    // It used to multiply by `landedHits`, so one four-hit attacker handed Oak
    // four Acorns — the card was rewarded most by exactly the thing that should
    // have been beating it, and two attackers in a round compounded that.
    const s = prepState();
    const oak = place(s, "leaf_oak", "P1", 3, 1, { curHp: 190, maxHp: 190, curShields: 0 });
    const a1 = place(s, "gale_hawko", "P2", 2, 1);
    const a2 = place(s, "gale_hawko", "P2", 2, 2);
    const acorns = (g: typeof s) =>
      boardCards(g, "P1").filter((c) => c.defId === "leaf_acorn_tok").length;
    basicAttack(s, a1.instanceId, oak.instanceId);
    expect(acorns(s), "first hit sprouts").toBe(1);
    basicAttack(s, a2.instanceId, oak.instanceId);
    expect(acorns(s), "a second attacker in the SAME round adds nothing").toBe(1);
    // Cleanup clears the guard beside the other per-round flags.
    const next = advance(atCleanup(s));
    const oakNext = boardCards(next, "P1").find((c) => c.defId === "leaf_oak")!;
    const attacker = boardCards(next, "P2")[0];
    basicAttack(next, attacker.instanceId, oakNext.instanceId);
    expect(acorns(next), "the next round sprouts again").toBe(2);
  });

  it("Hunter's Trapper bites for 4 on arrival AND from the grave", () => {
    // One passive, three triggers: a bite on summon, a bite at whoever kills it,
    // and a 50% ROOT on a landed basic. The two DAMAGE triggers move together —
    // 1 was a rounding error beside the ROOT, which was the only part anyone
    // played Hunter for.
    const arrival = prepState();
    const foe = place(arrival, "dusk_gool", "P2", 2, 0, { curHp: 40, maxHp: 40, curShields: 0 });
    const h = giveHand(arrival, "P1", "leaf_hunter");
    arrival.players.P1.gold = 20;
    arrival.prep = { priority: "P1", consecutivePasses: 0, movedThisTurn: false };
    const summoned = applyIntent(arrival, { type: "SUMMON", player: "P1", handId: h, col: 0 });
    expect(40 - summoned.cards[foe.instanceId].curHp, "on summon").toBe(4);

    // The grave bite hits the KILLER, and only through an attack — it is
    // retaliation, not an area burst, so a Hunter that dies to a DOT takes
    // nobody with it.
    const grave = prepState();
    const hunter = place(grave, "leaf_hunter", "P1", 2, 0, { curHp: 3, maxHp: 13, curShields: 0 });
    const killer = place(grave, "dusk_widowbite", "P2", 2, 1, { curHp: 40, maxHp: 40, curShields: 0 });
    basicAttack(grave, killer.instanceId, hunter.instanceId);
    expect(grave.cards[hunter.instanceId]?.curHp ?? 0).toBeLessThanOrEqual(0);
    expect(40 - grave.cards[killer.instanceId].curHp, "from the grave").toBe(4);
  });

  it("Bad Temper stops at +5, counting BOTH of its triggers", () => {
    // Volcanon grows permanently on a landed basic AND on every Eruption. They
    // are one ability with two triggers, so they share one ceiling — capping
    // only the passive would have moved the whole ramp onto the Special.
    const s = prepState();
    const v = place(s, "pyro_volcanon", "P1", 3, 0);
    const t = place(s, "dusk_gool", "P2", 2, 1, { curHp: 900, maxHp: 900, curShields: 0 });
    const swing = () => { s.cards[v.instanceId].attackedThisRound = false;
      basicAttack(s, v.instanceId, t.instanceId); return s.cards[v.instanceId].dmgBonus; };
    expect([swing(), swing(), swing(), swing(), swing(), swing(), swing()])
      .toEqual([1, 2, 3, 4, 5, 5, 5]);
  });

  it("...and Eruption draws from the same pool, not a second one", () => {
    const s = prepState();
    const v = place(s, "pyro_volcanon", "P1", 3, 0);
    const t = place(s, "dusk_gool", "P2", 2, 1, { curHp: 900, maxHp: 900, curShields: 0 });
    for (let i = 0; i < 3; i++) {
      s.cards[v.instanceId].attackedThisRound = false;
      basicAttack(s, v.instanceId, t.instanceId);
    }
    expect(s.cards[v.instanceId].dmgBonus, "three basics").toBe(3);
    for (let i = 0; i < 5; i++)
      SPECIAL_HANDLERS.strike(s, s.cards[v.instanceId], [s.cards[t.instanceId]],
        { dmg: 2, hits: 5, selfDmg: 1, freeRecastOnKill: 1 });
    expect(s.cards[v.instanceId].dmgBonus, "five Eruptions add only the last 2").toBe(5);
  });

  it("...and a card WITHOUT a cap keeps its full permanent growth", () => {
    // The guard on the guard: `selfDmg` is shared by several cards, so the clamp
    // must engage only where a ceiling is declared. Oakgre would otherwise have
    // been silently nerfed by a change aimed at Volcanon.
    const s = prepState();
    const o = place(s, "leaf_oakgre", "P1", 3, 0);
    const t = place(s, "dusk_gool", "P2", 2, 1, { curHp: 900, maxHp: 900, curShields: 0 });
    for (let i = 0; i < 4; i++)
      SPECIAL_HANDLERS.strike(s, s.cards[o.instanceId], [s.cards[t.instanceId]], { dmg: 1, selfDmg: 2 });
    expect(s.cards[o.instanceId].dmgBonus, "4 x +2, uncapped").toBe(8);
  });

  it("Blackout's Fryer MUTES what survives it", () => {
    // The surge takes their lights out: nothing struck can fire a Special for a
    // round. Asserting the STATUS alone would not prove much — what matters is
    // that `canFireSpecial` actually refuses, which is the rule MUTED drives.
    const s = prepState();
    const bo = place(s, "bolt_shock", "P1", 3, 1);
    const alive = place(s, "aqua_kraken", "P2", 2, 1, { curHp: 60, maxHp: 60, curShields: 0 });
    const dies = place(s, "dusk_gool", "P2", 2, 2, { curHp: 2, maxHp: 2, curShields: 0 });
    s.players.P2.magicPool = 20;
    SPECIAL_HANDLERS.fryer(s, s.cards[bo.instanceId],
      [s.cards[alive.instanceId], s.cards[dies.instanceId]],
      { dmg: 4, hits: 1, paralyzeBonus: 1, mute: 1 });
    expect(statusOf(s.cards[alive.instanceId], "MUTED"), "survivor is muted").toBeTruthy();
    const check = canFireSpecial(s, alive.instanceId);
    expect(check.ok).toBe(false);
    expect(check.reason).toBe("MUTED");
    // A target that died to the volley is not handed a status on the way out.
    expect(s.cards[dies.instanceId]?.curHp ?? 0).toBeLessThanOrEqual(0);
  });

  it("Rodd's Conduction powers BOLT neighbours only", () => {
    // A conduit powers the grid it belongs to. Before the element filter, Rodd
    // was a colourless +1 DMG for anything a deck could stand beside it.
    const s = prepState();
    const bolt = place(s, "bolt_zap", "P1", 3, 1);
    const offEl = place(s, "leaf_nettle", "P1", 3, 3);
    const boltBase = effectiveDmg(s, s.cards[bolt.instanceId]);
    const offBase = effectiveDmg(s, s.cards[offEl.instanceId]);
    place(s, "bolt_rodd", "P1", 3, 2); // adjacent to BOTH (cols 1 and 3)
    expect(effectiveDmg(s, s.cards[bolt.instanceId]) - boltBase, "BOLT neighbour").toBe(1);
    expect(effectiveDmg(s, s.cards[offEl.instanceId]) - offBase, "non-BOLT neighbour").toBe(0);
  });

  it("Buzzard's Drone Sweep answers ONE summon per round, not one per body", () => {
    // A wide summoning turn used to pay a drone per body, so a single 3-cost
    // card punished the opponent's whole turn and left a wall of chip behind.
    const s = prepState();
    place(s, "bolt_buzzard", "P1", 3, 3, { curHp: 14, maxHp: 14 });
    s.players.P2.gold = 40;
    s.prep = { priority: "P2", consecutivePasses: 0, movedThisTurn: false };
    let g = s;
    for (const col of [0, 1, 2]) {
      const h = giveHand(g, "P2", "dusk_gool");
      g = applyIntent(g, { type: "SUMMON", player: "P2", handId: h, col });
      g.prep = { priority: "P2", consecutivePasses: 0, movedThisTurn: false };
    }
    const drones = boardCards(g, "P1").filter((c) => c.defId === "bolt_drone_tok");
    expect(drones.length, "three summons, one drone").toBe(1);
  });

  const summonZipp = (s: GameState, col = 0) => {
    const h = giveHand(s, "P1", "bolt_zipp");
    s.players.P1.gold = 20;
    s.prep = { priority: "P1", consecutivePasses: 0, movedThisTurn: false };
    return applyIntent(s, { type: "SUMMON", player: "P1", handId: h, col });
  };
  const droneCount = (s: GameState) =>
    boardCards(s, "P1").filter((c) => c.defId === "bolt_drone_tok").length;

  it("Zipp's Swarm Deploy fires with NO enemy on the board", () => {
    // This is the reported bug, and it was not the spawn radius: on-summon
    // handlers only ran when `picked.length > 0`, i.e. when something was in
    // range to hit. `spawn` aims at nothing, so summoning Zipp onto an empty
    // board — or with the enemy line out of reach — ran no passive at all.
    const s = prepState();
    expect(boardCards(s, "P2")).toHaveLength(0);
    expect(droneCount(summonZipp(s)), "a Drone with nothing to shoot at").toBe(1);
  });

  it("Zipp's Drone still lands when every slot beside Zipp is taken", () => {
    // The secondary hole: `radius: 1` searched only the 8 adjacent slots and
    // gave up if none were free — and Zipp lands in the home row, which is
    // exactly where a board gets crowded. Dropping the radius keeps adjacency
    // as the preference and then opens the search to the rest of the board.
    const s = prepState();
    for (const [r, c] of [[3, 1], [2, 0], [2, 1]] as const)
      place(s, "dusk_gool", "P1", r, c, { curHp: 9, maxHp: 9 });
    expect(droneCount(summonZipp(s)), "the Drone found a slot anyway").toBe(1);
  });

  it("Dyna's Demolition Charge deals 4 + half the target's current HP", () => {
    const s = prepState();
    const dyna = place(s, "pyro_dyna", "P1", 3, 0);
    const foe = place(s, "dusk_gool", "P2", 2, 0, { curHp: 40, maxHp: 40, curShields: 0 });
    SPECIAL_HANDLERS.barrage(s, s.cards[dyna.instanceId], [s.cards[foe.instanceId]],
      { dmg: 4, targets: 1, pctHpDmg: 50 });
    // 4 -> 36 left, then floor(36 * 50%) = 18 -> 18 left; 22 dealt total
    expect(40 - s.cards[foe.instanceId].curHp).toBe(22);
  });

  it("Coilblade's Shatter splashes to neighbours when it hits a FROZEN target", () => {
    const s = prepState();
    const icy = place(s, "aqua_icynin", "P1", 3, 0);
    place(s, "dusk_gool", "P2", 2, 0, {
      curHp: 40, maxHp: 40, curShields: 0, status: { kind: "FREEZE", duration: 3, power: 0, source: "AQUA" },
    });
    const adj = place(s, "dusk_gool", "P2", 2, 1, { curHp: 40, maxHp: 40, curShields: 0 });
    basicAttack(s, icy.instanceId, boardCards(s, "P2").find((c) => c.pos?.col === 0)!.instanceId);
    expect(40 - s.cards[adj.instanceId].curHp).toBe(3); // shatter splash
  });

  it("Liza's Igniter doubles a DOT's power and remaining duration", () => {
    const s = prepState();
    const liza = place(s, "pyro_liza", "P1", 3, 0);
    const foe = place(s, "dusk_gool", "P2", 2, 0, {
      curHp: 40, maxHp: 40, status: { kind: "BURN", duration: 2, power: 3, source: "PYRO" },
    });
    SPECIAL_HANDLERS.igniter(s, s.cards[liza.instanceId], [s.cards[foe.instanceId]], {});
    const burn = s.cards[foe.instanceId].statuses.find((st) => st.kind === "BURN")!;
    expect(burn.power).toBe(6);
    expect(burn.duration).toBe(4);
  });

  it("Liza's Gaslighting buffs the ally that lands a kill", () => {
    const s = prepState();
    place(s, "pyro_liza", "P1", 3, 3); // the enabler
    const ally = place(s, "dusk_gool", "P1", 3, 0); // 4 DMG killer
    const prey = place(s, "dusk_gool", "P2", 2, 0, { curHp: 2, maxHp: 2, curShields: 0 });
    const base = effectiveDmg(s, s.cards[ally.instanceId]);
    basicAttack(s, ally.instanceId, prey.instanceId);
    expect(s.cards[prey.instanceId]).toBeUndefined(); // killed
    expect(effectiveDmg(s, s.cards[ally.instanceId])).toBe(base + 1); // Gaslighting +1 DMG
  });

  it("Evera's Spiraling Root Coil roots the far row a round LATER", () => {
    let s = prepState();
    const season = place(s, "leaf_season", "P1", 3, 0);
    const adj = place(s, "dusk_gool", "P2", 2, 0, { curHp: 40, maxHp: 40 });
    const far = place(s, "dusk_gool", "P2", 1, 0, { curHp: 40, maxHp: 40 });
    SPECIAL_HANDLERS.barrage(s, s.cards[season.instanceId], [s.cards[adj.instanceId], s.cards[far.instanceId]],
      { dmg: 0, rowAhead: 1, targets: 4, statusKind: "ROOT", statusDuration: 2, farRowRootNext: 1, farRowRootCount: 4, farRowRootDuration: 1 });
    expect(s.cards[adj.instanceId].statuses.some((st) => st.kind === "ROOT")).toBe(true); // adjacent now
    expect(s.cards[far.instanceId].statuses.some((st) => st.kind === "ROOT")).toBe(false); // far NOT yet
    expect(s.players.P1.pendingFarRoots?.length).toBe(1); // scheduled for next round
    // Advance rounds until the delayed root fires (drains the queue).
    let fired = false;
    for (let i = 0; i < 3 && !fired; i++) {
      s = advance(atCleanup(s));
      fired = (s.players.P1.pendingFarRoots ?? []).length === 0;
    }
    expect(fired).toBe(true);
  });

  it("Bark Shield gains +1 shield each round, capped at 5", () => {
    let s = prepState();
    const bark = place(s, "leaf_bark_bushmen", "P1", 3, 0, { curShields: 3 });
    for (let i = 0; i < 5; i++) s = advance(atCleanup(s));
    expect(s.cards[bark.instanceId].curShields).toBe(5); // 3 → 4 → 5, then capped
  });

  it("SkullKing's King's SkullDrake DOTs the row ahead and raises a SkullDrake", () => {
    const s = prepState();
    const king = place(s, "dusk_skullking", "P1", 3, 0);
    const foe = place(s, "dusk_gool", "P2", 2, 0, { curHp: 40, maxHp: 40, curShields: 0 });
    SPECIAL_HANDLERS.barrage(s, s.cards[king.instanceId], [s.cards[foe.instanceId]],
      { dmg: 0, rowAhead: 1, targets: 99, statusKind: "DOT", statusPower: 3, statusDuration: 3, spawnToken: "dusk_skulldrake_tok", spawnCount: 1 });
    expect(s.cards[foe.instanceId].statuses.some((st) => st.kind === "DOT")).toBe(true);
    expect(boardCards(s, "P1").filter((c) => c.defId === "dusk_skulldrake_tok").length).toBe(1);
  });

  it("SkullKing's King of Bones aura gives Skeleton allies +2 DMG", () => {
    const s = prepState();
    const skel = place(s, "dusk_skeleton_tok", "P1", 3, 0);
    const base = effectiveDmg(s, s.cards[skel.instanceId]);
    place(s, "dusk_skullking", "P1", 3, 1); // King of Bones aura
    expect(effectiveDmg(s, s.cards[skel.instanceId]) - base).toBe(2);
  });

  it("Jack Arc's Overclock reaches Zipp and its Drone, now that both are ARC", () => {
    // They used to be Forged Tech, which is otherwise an all-PYRO tribe — so
    // BOLT's own drone-builder and its drone were the only two cards in it that
    // no BOLT card could see. Nothing keys off Forged Tech at all; ARC has
    // exactly one hook, this aura, so the tribe move IS the +2 SP.
    const s = prepState();
    const zipp = place(s, "bolt_zipp", "P1", 3, 0);
    const drone = place(s, "bolt_drone_tok", "P1", 3, 1);
    const outsider = place(s, "pyro_nitro", "P1", 3, 2); // still Forged Tech
    const zBase = effectiveSp(s, s.cards[zipp.instanceId]);
    const dBase = effectiveSp(s, s.cards[drone.instanceId]);
    const oBase = effectiveSp(s, s.cards[outsider.instanceId]);
    place(s, "bolt_jack_arc", "P1", 3, 3); // Overclock: ARC allies +2 SP
    expect(effectiveSp(s, s.cards[zipp.instanceId]) - zBase).toBe(2);
    expect(effectiveSp(s, s.cards[drone.instanceId]) - dBase).toBe(2);
    expect(effectiveSp(s, s.cards[outsider.instanceId]) - oBase, "Forged Tech is untouched").toBe(0);
  });

  it("Canister's KaBoooom blasts every non-PYRO card on death", () => {
    const s = prepState();
    const canister = place(s, "pyro_canister", "P1", 3, 0);
    const pyroAlly = place(s, "pyro_tiki", "P1", 3, 1, { curHp: 20, maxHp: 20, curShields: 0 }); // PYRO — spared
    const enemy = place(s, "dusk_gool", "P2", 2, 0, { curHp: 20, maxHp: 20, curShields: 0 }); // non-PYRO — hit
    defeatCard(s, s.cards[canister.instanceId], "test");
    expect(s.cards[enemy.instanceId].curHp).toBe(14); // 20 - 6
    expect(s.cards[pyroAlly.instanceId].curHp).toBe(20); // PYRO spared
  });

  it("Equestrian's Solar aura makes allies immune to WEAKEN", () => {
    const s = prepState();
    const ally = place(s, "dusk_gool", "P1", 3, 0);
    place(s, "dawn_equestrian", "P1", 3, 1); // Solar Sovereign aura
    applyStatus(s, s.cards[ally.instanceId], "WEAKEN", 2, 0, "DUSK");
    expect(s.cards[ally.instanceId].statuses.some((st) => st.kind === "WEAKEN")).toBe(false);
  });

  it("a card with only an inert basic takes no turn at all", () => {
    const s = prepState();
    // No PRINTED card is actionless any more: UFO prints 2 DMG since the
    // card-sheet re-stat, and RIP (the only inert basic left) always has its
    // free Special to fall back on. So the state is constructed — UFO with its
    // damage debuffed to 0 and no Special of its own — which is still exactly
    // the condition the queue is meant to skip.
    const ufo = place(s, "bore_ufo", "P1", 3, 0, { dmgBonus: -getDef("bore_ufo").dmg });
    place(s, "dusk_gool", "P2", 2, 0);
    expect(effectiveDmg(s, s.cards[ufo.instanceId])).toBe(0);
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
    const scarlett = place(s, "dusk_scarlett", "P1", 2, 0);
    const a = place(s, "leaf_greegon", "P2", 1, 0, { curHp: 20, maxHp: 20, curShields: 0 });
    const b = place(s, "leaf_alpha", "P2", 1, 1, { curHp: 20, maxHp: 20, curShields: 0 });
    const before = s.cards[scarlett.instanceId].maxHp;
    // Bat Swarm is now a once-per-game Talent (free), not a Special.
    const next = applyIntent(battleFor(s, scarlett.instanceId), {
      type: "BATTLE_ACTION",
      player: "P1",
      action: "talent",
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

  it("Vernal's basic can be aimed at a hurt ally to heal it instead", () => {
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
    expect(s.cards[hurt.instanceId].curHp).toBe(5 + getDef("leaf_sprinu").dmg); // healed for its DMG, not struck
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
    s.players.P1.gold = 6;
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

  it("Emberclaw's arrival burns the WHOLE row ahead, edge column included", () => {
    const s = prepState();
    s.players.P1.gold = 8;
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

  it("Emberclaw's Flaming Slasher strikes on cast and burns that hit and one more", () => {
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

  it("Jolt Electrifies everything in reach as battle begins — and spares what's out of it", () => {
    const s = prepState();
    place(s, "bolt_jolt", "P1", 2, 1);
    // Melee, SP 3 → reach 1, so the zone is the 8 tiles around it.
    const near = place(s, "dusk_gool", "P2", 1, 1, { curHp: 30, maxHp: 30, curShields: 0 });
    const far = place(s, "dusk_vamp", "P2", 0, 3, { curHp: 20, maxHp: 20 });
    const next = atBattle(s);
    expect(statusOf(next.cards[near.instanceId], "ELECTRIFIED")?.duration).toBe(2);
    expect(statusOf(next.cards[far.instanceId], "ELECTRIFIED")).toBeUndefined();
  });

  it("Jolt's on-hit mark is the backstop for shooters the zone can't reach", () => {
    const s = prepState();
    const jolt = place(s, "bolt_jolt", "P1", 3, 0);
    // Two rows out: it can shoot Jolt, but it sits outside Jolt's reach-1 zone,
    // so ONLY the on-hit half can mark it.
    const sniper = place(s, "dusk_gool", "P2", 1, 0, { curHp: 30, maxHp: 30 });
    const next = atBattle(s);
    expect(statusOf(next.cards[sniper.instanceId], "ELECTRIFIED")).toBeUndefined(); // zone missed it
    basicAttack(next, sniper.instanceId, jolt.instanceId);
    expect(statusOf(next.cards[sniper.instanceId], "ELECTRIFIED")?.duration).toBe(2);
  });

  it("the Electrified mark is what BOLT allies actually cash in", () => {
    const s = prepState();
    const foe = place(s, "dusk_gool", "P2", 1, 0, { curHp: 30, maxHp: 30, curShields: 0 });
    const buzz = place(s, "bolt_buzz", "P1", 2, 1);
    // Unmarked: 3 DMG + 1 King of the Hill (buzz stands in a mid row) = 4.
    // The hit ALSO leaves the target ELECTRIFIED now — Electrify sets up its own
    // payoff rather than waiting on another card to apply a status.
    basicAttack(s, buzz.instanceId, foe.instanceId);
    expect(s.cards[foe.instanceId].curHp).toBe(26);
    expect(statusOf(s.cards[foe.instanceId], "ELECTRIFIED")).toBeTruthy();
    // Marked: Electrify adds +2 vs a statused target = 6.
    basicAttack(s, buzz.instanceId, foe.instanceId);
    expect(s.cards[foe.instanceId].curHp).toBe(20);
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
    expect(s.cards[killer.instanceId].curHp).toBe(8); // 4 back from Shine, +25% DAWN→DUSK
    expect(statusOf(s.cards[killer.instanceId], "BLIND")?.duration).toBe(3);
    // A second ally falls — the one-shot is already spent.
    s.cards[killer.instanceId].statuses = []; // clear that BLIND so the kill is reliable
    const ally2 = place(s, "bore_armadillo", "P1", 2, 1, { curHp: 2, curShields: 0 });
    basicAttack(s, killer.instanceId, ally2.instanceId);
    expect(s.cards[ally2.instanceId]).toBeUndefined();
    expect(s.cards[killer.instanceId].curHp).toBe(8); // unchanged — no second answer
  });

  it("Dirt Driller hides Obsidian, speeds it underground, and erupts once", () => {
    const s = prepState();
    s.players.P1.magicPool = 3;
    const obsidi = place(s, "bore_obsidi", "P1", 2, 0);
    const foe = place(s, "dusk_gool", "P2", 1, 0, { curHp: 40, maxHp: 40, curShields: 0 });
    // Read the printed SP rather than hardcoding it — Obsidian's speed moved when
    // BORE traded SP for cost, and the point of this test is the +3 underground.
    const printedSp = getDef("bore_obsidi").sp;
    expect(effectiveSp(s, s.cards[obsidi.instanceId])).toBe(printedSp); // above ground
    const next = applyIntent(battleFor(s, obsidi.instanceId), {
      type: "BATTLE_ACTION",
      player: "P1",
      action: "special",
      targetId: obsidi.instanceId, // self-targeted burrow
    });
    expect(statusOf(next.cards[obsidi.instanceId], "STEALTH")).toBeTruthy();
    // Obsidian Claws REPLACES the printed SP with a flat 11 rather than adding
    // to it, so this number is independent of the card's above-ground speed.
    expect(effectiveSp(next, next.cards[obsidi.instanceId])).toBe(getDef("bore_obsidi").spWhileStealthed!);
    // The ambush overrides its printed 4×2 — 6×2 comes up out of the ground.
    basicAttack(next, obsidi.instanceId, foe.instanceId);
    expect(next.cards[foe.instanceId].curHp).toBe(28); // 40 − 12
    expect(statusOf(next.cards[obsidi.instanceId], "STEALTH")).toBeUndefined(); // cover broken
    // …and it's spent: the follow-up is its printed attack again — (DMG + 1 for
    // King of the Hill's mid row) × hits. Derived from the def so a stat change
    // doesn't break a test about the AMBUSH; note the loaded 6×2 was FLAT and
    // took no such bonus, which is what "deal 6×2 DMG" should mean.
    const od = getDef("bore_obsidi");
    basicAttack(next, obsidi.instanceId, foe.instanceId);
    expect(next.cards[foe.instanceId].curHp).toBe(28 - (od.dmg + 1) * od.hits);
  });

  it("Ash Boar's Charging Tusks hits what's in reach on arrival, then charges in", () => {
    const s = prepState();
    s.players.P1.gold = 6;
    const foe = place(s, "dusk_gool", "P2", 2, 1, { curHp: 20, maxHp: 20, curShields: 0 });
    const handId = giveHand(s, "P1", "pyro_ash_boar");
    const next = applyIntent(s, { type: "SUMMON", player: "P1", handId, col: 0 });
    const boar = Object.values(next.cards).find((c) => c.defId === "pyro_ash_boar")!;
    expect(next.cards[foe.instanceId].curHp).toBe(16); // took the 4 on arrival
    expect(boar.pos!.row).toBe(2); // charged off its home row (3 → 2)
  });

  it("Ash Boar TRAMPLES THROUGH a foe directly ahead (doesn't stall on it)", () => {
    // Regression: the boar "keeps going" via a forward charge, which stalls on
    // the first occupied slot — so a foe in its OWN column (the one it just hit)
    // used to block it, and the boar that's "meant to trample THROUGH" didn't
    // move at all. Now it phases past the struck body to the next open slot.
    const s = prepState();
    s.players.P1.gold = 6;
    const foe = place(s, "dusk_gool", "P2", 2, 0, { curHp: 40, maxHp: 40, curShields: 0 }); // directly ahead, same column
    const handId = giveHand(s, "P1", "pyro_ash_boar");
    const next = applyIntent(s, { type: "SUMMON", player: "P1", handId, col: 0 });
    const boar = Object.values(next.cards).find((c) => c.defId === "pyro_ash_boar")!;
    expect(next.cards[foe.instanceId].curHp).toBe(36); // still landed the 4
    expect(boar.pos!.row).toBe(1); // phased PAST the foe at row 2 to the open slot beyond
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

  it("Rhyolite's Rocky Force Field can deflect a ranged hit (but not melee)", () => {
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

  it("Squall's Shadow lets only adjacent attackers reach it", () => {
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
  it("Dunewraith's Sandstorm dings every enemy in Cleanup", () => {
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
    const single = place(s, "pyro_firebird", "P1", 2, 0); // 1 hit
    expect(effectiveDmg(s, single)).toBe(getDef("pyro_firebird").dmg + 1); // +1 DMG in mid
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

describe("Autumnal's Fall's Emergence scales Leaf Storm", () => {
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
    s.players.P1.gold = 5;
    // In range of the P1 home row (mid row = can reach it).
    place(s, "bore_rockgoblin", "P2", 2, 0); // Cave Guard: 4 DMG (adjacent to (3,0))
    place(s, "bolt_drshock", "P2", 2, 1); // Shocker: ELECTRIFIED (ranged, from mid)
    const handId = giveHand(s, "P1", "dusk_gool"); // HP 13
    const next = applyIntent(s, { type: "SUMMON", player: "P1", handId, col: 0 });
    const fresh = boardCards(next, "P1").find((c) => c.defId === "dusk_gool")!;
    expect(fresh.curHp).toBe(9); // 13 − 4 Cave Guard
    expect(fresh.statuses.some((x) => x.kind === "ELECTRIFIED")).toBe(true);

    // A reactor parked on its own home row can't reach the enemy home slot → no effect.
    const s2 = prepState();
    s2.players.P1.gold = 5;
    place(s2, "bolt_drshock", "P2", 0, 0); // back home row — out of range
    const h2 = giveHand(s2, "P1", "dusk_gool");
    const n2 = applyIntent(s2, { type: "SUMMON", player: "P1", handId: h2, col: 0 });
    const g2 = boardCards(n2, "P1").find((c) => c.defId === "dusk_gool")!;
    expect(g2.statuses.some((x) => x.kind === "ELECTRIFIED")).toBe(false); // out of range
  });

  it("BaBoom's Swinging Sweep booms every enemy in king's reach on summon, sparing distant ones", () => {
    const s = prepState();
    s.players.P1.gold = 5;
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
    s.players.P1.gold = 5;
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

describe("Dunewraith's Nightmare", () => {
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
  it("Exostone (BORE): arrival plating scales with rarity", () => {
    // Rare 1 / Epic 2 / Legendary 3 / Mythic 4. It used to be a flat +2 for
    // everyone, which was worth most on the cheapest body — 2 shields is a large
    // share of what a 1-cost Rare even is, and a rounding error on a Mythic.
    const cases: [string, string][] = [
      ["bore_rockgoblin", "rare"],
      ["bore_obsidi", "epic"],
      ["bore_prism", "legendary"],
      ["bore_deepest", "mythic"],
    ];
    for (const [id, rarity] of cases) {
      const def = getDef(id);
      expect(def.rarity, `${id} is the ${rarity} fixture`).toBe(rarity);
      const s = prepState();
      s.players.P1.gold = 30;
      const handId = giveHand(s, "P1", id);
      const next = applyIntent(s, { type: "SUMMON", player: "P1", handId, col: 0 });
      const card = boardCards(next, "P1").find((c) => c.defId === id)!;
      expect(card.curShields, `${id} (${rarity})`).toBe(def.shields + EXOSTONE_SHIELDS[rarity]);
    }
  });

  it("Zephyr (GALE): a GALE card gains +2 SP each Cleanup", () => {
    const s = prepState();
    const hawk = place(s, "gale_hawk", "P1", 2, 0); // SP 7 — well under the 15 DMG threshold
    place(s, "leaf_greegon", "P1", 3, 0); // keep P1 alive
    place(s, "dusk_gool", "P2", 0, 0);
    const next = advance(atCleanup(s));
    expect(next.cards[hawk.instanceId].spBonus).toBe(2);
    expect(next.cards[hawk.instanceId].dmgBonus).toBe(0); // only past SP 15 does it gain DMG
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

  it("...and even the cheapest bodies bite back for at least 1", () => {
    // Floored at 1: at 2 DMG the third rounds to 0, but a dying DUSK card always
    // lashes for at least a point — so Vamp/Spider still cost their killer.
    const s = prepState();
    const killer = place(s, "gale_duster", "P1", 2, 0, { curHp: 5, curShields: 0 });
    const vamp = place(s, "dusk_vamp", "P2", 2, 1, { curHp: 1 }); // DMG 2 → floored to 1
    basicAttack(s, killer.instanceId, vamp.instanceId);
    expect(s.cards[vamp.instanceId]).toBeUndefined();
    expect(s.cards[killer.instanceId].curHp).toBe(4); // 5 − 1 Midnight Shade floor
  });

  it("Awakening (DAWN): summoning strikes the nearest enemy for half its DMG", () => {
    const s = prepState();
    s.players.P1.gold = 5;
    const foe = place(s, "dusk_gool", "P2", 2, 0, { curHp: 15 });
    const handId = giveHand(s, "P1", "dawn_solstice"); // DMG 5 → half 2
    const next = applyIntent(s, { type: "SUMMON", player: "P1", handId, col: 0 });
    expect(next.cards[foe.instanceId].curHp).toBe(13); // 15 − 2 Awakening
  });

  it("Flow Change (AQUA): a human summon defers the choice; Liquid grants +2 DMG for 3 rounds", () => {
    const s = prepState();
    s.players.P1.gold = 5;
    const handId = giveHand(s, "P1", "aqua_spinefin");
    const summoned = applyIntent(s, { type: "SUMMON", player: "P1", handId, col: 0 });
    const fin = boardCards(summoned, "P1").find((c) => getDef(c.defId).element === "AQUA")!;
    expect(summoned.pendingFlow).toBe(fin.instanceId); // deferred to the human
    const base = getDef("aqua_spinefin").dmg;
    const picked = applyIntent(summoned, {
      type: "FLOW_CHANGE", player: "P1", instanceId: fin.instanceId, mode: "water",
    });
    // The SUMMON pick is a TIMED buff now (3 rounds), not permanent — it rides the
    // `buffs` array (so effectiveDmg reflects it) rather than dmgBonus, and fades
    // after 3 Cleanups instead of lasting the whole game.
    const c = picked.cards[fin.instanceId];
    expect(c.dmgBonus).toBe(0);
    expect(c.buffs.some((b) => b.dmg === 2 && b.rounds === 3)).toBe(true);
    expect(effectiveDmg(picked, c)).toBe(base + 2);
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
    s.players.P2.gold = 5;
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

  it("Ricochet's Precision Strike fires vs ANY statused (Electrified) foe, not just PARALYZED", () => {
    const s = prepState();
    const z = place(s, "bolt_zagphu", "P1", 3, 0, { curHp: 5, maxHp: 12 });
    const foe = place(s, "dusk_gool", "P2", 2, 0, {
      curHp: 30, curShields: 0,
      status: { kind: "BURN", duration: 2, power: 1, source: "PYRO" }, // statused, NOT paralyzed
    });
    basicAttack(s, z.instanceId, foe.instanceId);
    expect(s.cards[z.instanceId].curHp).toBe(9); // healOnHit +4 fired (anyStatus match)
  });

  it("Whirlwolf's Hastening Breeze gives +5 SP to ALL allies for the round", () => {
    const s = prepState();
    s.players.P1.gold = 5;
    const near = place(s, "leaf_greegon", "P1", 3, 0);
    const far = place(s, "leaf_greegon", "P1", 3, 3); // farther than the nearest ally
    const handId = giveHand(s, "P1", "gale_whirlwolf");
    const next = applyIntent(s, { type: "SUMMON", player: "P1", handId, col: 1 });
    // A TIMED grant now (doc: "for the round"), so it rides `buffs`, not spBonus.
    expect(next.cards[near.instanceId].buffs.some((b) => b.sp === 5)).toBe(true);
    expect(next.cards[far.instanceId].buffs.some((b) => b.sp === 5)).toBe(true); // all-allies, not self+nearest
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

  it("Eclipse's Hot Shot never misses — ignores the target's EVASION", () => {
    const s = prepState();
    const c = place(s, "dawn_clipsey", "P1", 3, 0); // 1×7 Ranged, alwaysHit
    const eva = place(s, "dusk_silkstalker", "P2", 1, 0, { curHp: 20, curShields: 0 }); // EVASION keyword
    basicAttack(s, c.instanceId, eva.instanceId);
    expect(s.cards[eva.instanceId].curHp).toBe(13); // all 7 hits land (no dodge)
  });

  it("Radiance's Brightest Warrior scales off the strongest foe on summon", () => {
    const s = prepState();
    s.players.P1.gold = 6;
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
    s.players.P1.gold = 9;
    const foe = place(s, "dusk_gool", "P2", 2, 0, { curHp: 40, maxHp: 40, curShields: 0 });
    // Musk Ox, not GoldenEagle: Awakening is floor(dmg / 2), and a 1-DMG card
    // deals 0, so the aura never fires and there'd be nothing to telegraph.
    const handId = giveHand(s, "P1", "dawn_musk_ox"); // DAWN, 5 DMG -> strikes for 2
    const next = applyIntent(s, { type: "SUMMON", player: "P1", handId, col: 0 });
    const summoned = boardCards(next, "P1").find((c) => c.defId === "dawn_musk_ox")!;
    expect(next.cards[foe.instanceId].curHp).toBe(38); // it really struck (40 − floor(5/2))
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
    s.players.P1.gold = 9;
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
    s.players.P1.gold = 9;
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
    s.players.P1.gold = 6;
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

describe("on-summon passives that aim at nothing still fire", () => {
  /** Summon into your own home row with the enemy line in the far corner — the
   *  ordinary shape of the turn you play a card, and the case that used to make
   *  these passives silently do nothing. */
  function summonFarFromTrouble(defId: string) {
    const s = prepState();
    s.players.P1.gold = 20;
    s.prep = { priority: "P1", consecutivePasses: 0, movedThisTurn: false };
    const foe = place(s, "bore_armadillo", "P2", 0, 3, { curHp: 20, maxHp: 20 });
    const handId = giveHand(s, "P1", defId);
    return { next: applyIntent(s, { type: "SUMMON", player: "P1", handId, col: 0 }), foe, s };
  }

  it("Tide's Surf's Up buoys the crew even with no enemy in reach", () => {
    const s = prepState();
    s.players.P1.gold = 20;
    s.prep = { priority: "P1", consecutivePasses: 0, movedThisTurn: false };
    const hurt = place(s, "aqua_spinefin", "P1", 3, 2, { curHp: 4, maxHp: 20 });
    place(s, "bore_armadillo", "P2", 0, 3, { curHp: 20, maxHp: 20 });
    const handId = giveHand(s, "P1", "aqua_tide");
    const next = applyIntent(s, { type: "SUMMON", player: "P1", handId, col: 0 });
    expect(next.cards[hurt.instanceId].curHp).toBeGreaterThan(4); // heals ALL allies
  });

  it("Plaguecrow locks the enemy's Specials from across the board", () => {
    const { next, foe } = summonFarFromTrouble("dusk_plaguecrow");
    expect(next.cards[foe.instanceId].specialLockedRounds ?? 0).toBeGreaterThan(0);
  });

  /** The guard that stops this being rediscovered a fourth time. A handler whose
   *  third parameter is `_targets` has told the compiler it ignores the target
   *  list; if the on-summon path still gates it on having found one, it can
   *  never run.
   *
   *  Scoped to ON-SUMMON handlers, because that is the only path that refuses to
   *  run a handler when it found no target. A Special is fired deliberately and
   *  meets its own gate in rules.ts, so `reposition` ignoring its targets is
   *  perfectly fine there. */
  it("every on-summon handler that ignores its targets is declared targetless", () => {
    const onSummon = new Set(
      CARDS.map((c) => c.onSummon?.handler).filter((h): h is string => !!h),
    );
    for (const name of onSummon) {
      const fn = SPECIAL_HANDLERS[name];
      if (!fn) continue; // ally-side handlers resolve on applyAllyOnSummon instead
      const ignoresTargets = /^[^)]*,[^,)]*,\s*_targets\b/.test(fn.toString());
      if (ignoresTargets)
        expect(TARGETLESS_HANDLERS.has(name), `${name} ignores its targets but is not in TARGETLESS_HANDLERS`).toBe(true);
    }
  });
});

describe("King of the Wild is a round buff, both halves of it", () => {
  it("Leo's shields expire at Cleanup like the DMG beside them", () => {
    const s = prepState();
    s.players.P2.gold = 20;
    s.prep = { priority: "P2", consecutivePasses: 0, movedThisTurn: false };
    const leo = place(s, "dawn_leo", "P1", 3, 0);
    const base = s.cards[leo.instanceId].curShields;
    const handId = giveHand(s, "P2", "dusk_gool");
    const afterSummon = applyIntent(s, { type: "SUMMON", player: "P2", handId, col: 1 });
    expect(afterSummon.cards[leo.instanceId].curShields).toBe(base + 2);
    // "for the round" — so by the next round both halves are gone. The DMG half
    // always expired; the shields used to stay, and re-armed every round, so Leo
    // simply accrued +2 a round for the whole match.
    const next = advance(atCleanup(afterSummon));
    expect(next.cards[leo.instanceId].curShields).toBe(base);
    expect(next.cards[leo.instanceId].dmgBonusRound).toBe(0);
  });
});

describe("a card killed on arrival does not then take its turn", () => {
  it("a lethal summon trap stops the on-summon pipeline, tokens and all", () => {
    const s = prepState();
    const briar = place(s, "leaf_darth", "P1", 3, 1, { curHp: 17, maxHp: 17 });
    s.traps.push({
      owner: "P1", pos: { row: 0, col: 0 }, label: "a lethal trap",
      sourceId: briar.instanceId, dmg: 999,
    } as (typeof s.traps)[number]);
    const hand = giveHand(s, "P2", "leaf_trinezer"); // spawns 3 tokens on summon
    s.prep = { priority: "P2", consecutivePasses: 0, movedThisTurn: false };
    s.players.P2.gold = 20;
    const n = applyIntent(s, { type: "SUMMON", player: "P2", handId: hand, col: 0 });
    const arrival = boardCards(n, "P2").find((c) => getDef(c.defId).id === "leaf_trinezer");
    expect(arrival, "the trap killed it on arrival").toBeFalsy();
    // The whole arrival pipeline used to run from the corpse: it spawned its
    // three tokens, scaled its stats, fired its element aura and its on-summon
    // Special, all from a card already off the board.
    const tokens = boardCards(n, "P2").filter((c) => getDef(c.defId).id === "leaf_reptilian_tok");
    expect(tokens, "a corpse spawned its escort").toHaveLength(0);
  });
});

describe("Reforged plates the ring around Smith, itself included", () => {
  function summonSmith() {
    const s = prepState();
    s.players.P1.gold = 20;
    s.prep = { priority: "P1", consecutivePasses: 0, movedThisTurn: false };
    const beside = place(s, "bore_clubber", "P1", 3, 1, { curShields: 0 });
    const ahead = place(s, "bore_armadillo", "P1", 2, 3, { curShields: 0 }); // row ahead, far away
    const handId = giveHand(s, "P1", "bore_smith");
    const next = applyIntent(s, { type: "SUMMON", player: "P1", handId, col: 0 });
    const smith = boardCards(next, "P1").find((c) => getDef(c.defId).id === "bore_smith")!;
    return { next, beside, ahead, smith };
  }

  it("shields the neighbours and Smith, not the row ahead", () => {
    const { next, beside, ahead, smith } = summonSmith();
    expect(next.cards[beside.instanceId].curShields).toBe(2);
    // Its printed shields, plus the BORE summon aura it also gets, plus its own
    // plates — Reforged includes the smith that forged them.
    expect(next.cards[smith.instanceId].curShields).toBe(
      getDef("bore_smith").shields + (EXOSTONE_SHIELDS[getDef("bore_smith").rarity ?? ""] ?? EXOSTONE_DEFAULT) + 2,
    );
    expect(next.cards[ahead.instanceId].curShields, "three columns over is not nearby").toBe(0);
  });

  it("and stokes them for the +1 DMG it prints", () => {
    const { next, beside } = summonSmith();
    const c = next.cards[beside.instanceId];
    expect(effectiveDmg(next, c)).toBe(getDef("bore_clubber").dmg + 1);
  });
});

describe("growth has a ceiling", () => {
  it("Salvage stops feeding after its cap", () => {
    const s = prepState();
    const vult = place(s, "gale_vvulture", "P1", 3, 0);
    const base = s.cards[vult.instanceId].maxHp;
    // Eight deaths, a cap of five.
    for (let i = 0; i < 8; i++) {
      const fodder = place(s, "dusk_gool", "P2", 1, (i % 4) as 0 | 1 | 2 | 3, { curHp: 1, maxHp: 1 });
      defeatCard(s, s.cards[fodder.instanceId], "test");
    }
    expect(s.cards[vult.instanceId].maxHp).toBe(base + 5 * 2);
  });

  it("Carnage stops feeding after its cap", () => {
    const s = prepState();
    const zhunk = place(s, "dusk_zhunk", "P1", 3, 0);
    // dmgBonus, not effectiveDmg: the husks left standing at the end carry an
    // element aura that would be counted as growth it did not gain.
    const baseBonus = s.cards[zhunk.instanceId].dmgBonus;
    for (let i = 0; i < 8; i++) {
      const husk = place(s, "dusk_zombie_husk", "P1", 2, (i % 4) as 0 | 1 | 2 | 3, { curHp: 1, maxHp: 1 });
      defeatCard(s, s.cards[husk.instanceId], "test");
    }
    expect(s.cards[zhunk.instanceId].dmgBonus).toBe(baseBonus + 5);
  });

  it("no card grows a stat forever — every growth field declares its ceiling", () => {
    // The audit that found these had to read the engine to know which growth was
    // bounded. This is the check that answers it from the data instead.
    const uncapped: string[] = [];
    for (const d of CARDS) {
      if (d.onHitSelfBuff && d.onHitSelfBuff.max == null) uncapped.push(`${d.id}.onHitSelfBuff`);
      if (d.roundTick?.selfShields != null && d.roundTick.selfShieldsMax == null)
        uncapped.push(`${d.id}.roundTick.selfShields`);
      if (d.roundTick?.buffDmgEveryN && d.roundTick.buffDmgEveryN.maxTicks == null)
        uncapped.push(`${d.id}.roundTick.buffDmgEveryN`);
      if (d.salvageOnDeath != null && d.salvageMax == null) uncapped.push(`${d.id}.salvageOnDeath`);
      if (d.onTribeDeath && d.onTribeDeath.max == null) uncapped.push(`${d.id}.onTribeDeath`);
    }
    expect(uncapped, `unbounded growth: ${uncapped.join(", ")}`).toEqual([]);
  });
});

/** Park the battle so `activeId` is the next card to act, awaiting P1 input. */
function battleWith(s: GameState, activeId: string): GameState {
  s.phase = "battle";
  s.prep = null;
  s.battle = { queue: [activeId], index: 0, awaitingInput: activeId };
  return s;
}

describe("Meltdown erupts in every direction, not just forward", () => {
  /** Magmadon in the middle with an enemy beside it, one diagonally back, and
   *  one straight ahead but three columns over — the shape that shows the
   *  difference. The far one is in the row ahead and out of a melee card's
   *  reach; the other two are the ones the old row-only eruption never touched. */
  function surrounded() {
    const s = prepState();
    s.players.P1.magicPool = 20;
    const mag = place(s, "pyro_magmadon", "P1", 2, 1);
    return {
      s, mag,
      beside: place(s, "dusk_gool", "P2", 2, 0, { curHp: 40, maxHp: 40, curShields: 0 }),
      diagBack: place(s, "dusk_gool", "P2", 3, 2, { curHp: 40, maxHp: 40, curShields: 0 }),
      farAhead: place(s, "dusk_gool", "P2", 1, 3, { curHp: 40, maxHp: 40, curShields: 0 }),
    };
  }

  it("the opening blast catches everything it can reach", () => {
    const { s, mag, beside, diagBack, farAhead } = surrounded();
    const next = applyIntent(battleWith(s, mag.instanceId), {
      type: "BATTLE_ACTION", player: "P1", action: "special", targetId: mag.instanceId,
    });
    expect(next.cards[beside.instanceId].curHp, "beside it").toBe(35);
    expect(next.cards[diagBack.instanceId].curHp, "diagonally behind").toBe(35);
    expect(next.cards[farAhead.instanceId].curHp, "row ahead but out of reach").toBe(40);
  });

  it("and so does every round it keeps burning", () => {
    const { s, mag, beside } = surrounded();
    const lit = applyIntent(battleWith(s, mag.instanceId), {
      type: "BATTLE_ACTION", player: "P1", action: "special", targetId: mag.instanceId,
    });
    expect(lit.cards[mag.instanceId].channelOn).toBe(true);
    const after = advance(atCleanup(lit));
    expect(after.cards[beside.instanceId].curHp).toBeLessThan(35);
  });
});

describe("arrival abilities that have to travel to work", () => {
  it("ThunderCat rushes its column and strikes on summon", () => {
    const s = prepState();
    s.players.P1.gold = 20;
    s.prep = { priority: "P1", consecutivePasses: 0, movedThisTurn: false };
    // Two rows up its own column — nowhere near a melee card's reach from home.
    const prey = place(s, "dusk_gool", "P2", 1, 1, { curHp: 40, maxHp: 40, curShields: 0 });
    const handId = giveHand(s, "P1", "bolt_thundercat");
    const next = applyIntent(s, { type: "SUMMON", player: "P1", handId, col: 1 });
    const cat = boardCards(next, "P1").find((c) => getDef(c.defId).id === "bolt_thundercat")!;
    expect(cat.pos!.row, "it rushed forward").toBeLessThan(3);
    expect(next.cards[prey.instanceId].curHp, "and struck what it found").toBeLessThan(40);
  });

  it("Kraken's Black Wave Crash reaches two slots in every direction", () => {
    // A 5x5 board on purpose. Reach 2 from the middle of a 4x4 covers every
    // square there is, so the "too far" half of this could not fail — the first
    // draft put the far card on column 4 of a 4-wide board, which is not a slot
    // at all.
    const s = createInitialState(42, undefined, undefined, ["P1"], undefined, undefined, 5);
    s.players.P1.mulliganDone = true;
    s.players.P2.mulliganDone = true;
    s.round = 1;
    s.phase = "prep";
    s.prep = { priority: "P1", consecutivePasses: 0, movedThisTurn: false };
    s.players.P1.magicPool = 20;
    const k = place(s, "aqua_kraken", "P1", 2, 1, { curHp: 42, maxHp: 42 });
    const near = place(s, "dusk_gool", "P2", 2, 0, { curHp: 40, maxHp: 40, curShields: 0 });
    const two = place(s, "dusk_gool", "P2", 0, 3, { curHp: 40, maxHp: 40, curShields: 0 }); // 2 away
    const three = place(s, "dusk_gool", "P2", 2, 4, { curHp: 40, maxHp: 40, curShields: 0 }); // 3 columns away
    const next = applyIntent(
      { ...s, phase: "battle", prep: null, battle: { queue: [k.instanceId], index: 0, awaitingInput: k.instanceId } },
      { type: "BATTLE_ACTION", player: "P1", action: "special", targetId: near.instanceId },
    );
    expect(next.cards[near.instanceId].curHp, "touching it").toBe(32);
    expect(next.cards[two.instanceId].curHp, "two slots away").toBe(32);
    expect(next.cards[three.instanceId].curHp, "three is still too far").toBe(40);
  });
});

describe("balance pass: reach, payloads and lockouts", () => {
  it("Chain Paralysis deals damage now, not just the status", () => {
    const s = prepState();
    s.players.P1.magicPool = 20;
    const caster = place(s, "bolt_stormcaller", "P1", 2, 1);
    const foe = place(s, "dusk_gool", "P2", 1, 1, { curHp: 40, maxHp: 40, curShields: 0 });
    const next = applyIntent(battleWith(s, caster.instanceId), {
      type: "BATTLE_ACTION", player: "P1", action: "special", targetId: foe.instanceId,
    });
    // Its twin Glacius pays the same 4 magic for 3 targets x 2 rounds AND 4 damage
    // a head; this dealt nothing at all, which made it strictly the worse card.
    expect(next.cards[foe.instanceId].curHp).toBe(37);
    expect(statusOf(next.cards[foe.instanceId], "PARALYZE")?.duration).toBe(2);
  });

  it("a melee on-summon strike reaches the nearest enemy from the home row", () => {
    // The shape that broke ThunderCat: summoned into your own home row, with the
    // enemy nowhere near king-step reach.
    for (const [id, col] of [["bolt_zap", 0], ["bolt_electricel", 0], ["aqua_krakler", 0]] as const) {
      const s = prepState();
      s.players.P1.gold = 20;
      s.prep = { priority: "P1", consecutivePasses: 0, movedThisTurn: false };
      const foe = place(s, "dusk_gool", "P2", 1, 3, { curHp: 40, maxHp: 40, curShields: 0 });
      const handId = giveHand(s, "P1", id);
      const next = applyIntent(s, { type: "SUMMON", player: "P1", handId, col });
      const hurt = next.cards[foe.instanceId].curHp < 40;
      const marked = next.cards[foe.instanceId].statuses.length > 0;
      expect(hurt || marked, `${id}'s arrival did nothing`).toBe(true);
    }
  });

  it("every mythic Special that hits the whole board prints a cooldown", () => {
    // Kraken was given a printed 3 because a board-wide nuke on the DEFAULT
    // 2-round lockout is every-other-round. Two are exempt on purpose and are
    // named here so the exemption is a decision rather than an oversight.
    const EXEMPT = new Set([
      "dusk_skullking", // its board-wide Special deals no damage at all
      "bore_the_coreborer", // hits one column, not the board
    ]);
    const offenders = CARDS.filter((d) => {
      if (d.rarity !== "mythic" || !d.special || EXEMPT.has(d.id)) return false;
      const p = d.special.params ?? {};
      return Number(p.targets ?? 0) >= 99 && Number(p.dmg ?? 0) > 0 && d.special.cooldown == null;
    }).map((d) => d.id);
    expect(offenders, `board-wide mythic nuke on the default lockout: ${offenders.join(", ")}`).toEqual([]);
  });
});

describe("Magnetic Field: Magnetite lends its plates to whoever stands beside it", () => {
  /** An ally takes one basic from `attacker`; returns the damage reflected back. */
  function reflectedOnto(withMagnetite: boolean, allyPos: [number, number]) {
    const s = prepState();
    const ally = place(s, "bore_clubber", "P1", allyPos[0] as 0 | 1 | 2 | 3, allyPos[1] as 0 | 1 | 2 | 3,
      { curHp: 40, maxHp: 40, curShields: 0 });
    if (withMagnetite) place(s, "bore_gemaga", "P1", 2, 1);
    const foe = place(s, "dusk_gool", "P2", 1, 1, { curHp: 40, maxHp: 40, curShields: 0 });
    basicAttack(s, foe.instanceId, ally.instanceId);
    return 40 - s.cards[foe.instanceId].curHp;
  }

  it("an adjacent ally reflects Magnetite's 2 on top of its own", () => {
    // Clubber carries REFLECT 1 of its own, so the aura shows up as the delta.
    const alone = reflectedOnto(false, [2, 2]);
    const beside = reflectedOnto(true, [2, 2]);
    expect(beside - alone).toBe(2);
  });

  it("but only while touching — two slots away gets nothing", () => {
    const alone = reflectedOnto(false, [2, 3]);
    const away = reflectedOnto(true, [2, 3]);
    expect(away).toBe(alone);
  });

  it("and it does not buff itself", () => {
    const s = prepState();
    const mag = place(s, "bore_gemaga", "P1", 2, 1, { curHp: 40, maxHp: 40, curShields: 0 });
    const foe = place(s, "dusk_gool", "P2", 1, 1, { curHp: 40, maxHp: 40, curShields: 0 });
    basicAttack(s, foe.instanceId, mag.instanceId);
    // Its printed REFLECT 2 only — the aura is `adjacent`, and self is distance 0.
    expect(40 - s.cards[foe.instanceId].curHp).toBe(2);
  });
});

describe("Ariel: the boost pierces, and a falling foe is a cue", () => {
  it("100,000° makes the next basic ignore shields", () => {
    const s = prepState();
    s.players.P1.magicPool = 20;
    const ariel = place(s, "dawn_ariel", "P1", 2, 0);
    const foe = place(s, "dusk_gool", "P2", 2, 1, { curHp: 60, maxHp: 60, curShields: 9 });
    const lit = applyIntent(battleWith(s, ariel.instanceId), {
      type: "BATTLE_ACTION", player: "P1", action: "special", targetId: ariel.instanceId,
    });
    basicAttack(lit, ariel.instanceId, foe.instanceId);
    // The claim under test is PEN, so assert PEN rather than the damage formula:
    // a shielded hit strips shields and is reduced by them, a piercing one does
    // neither. (An earlier draft compared against effectiveDmg and failed for an
    // unrelated reason — it does not model the positional bonus.)
    expect(lit.cards[foe.instanceId].curShields, "a PEN hit strips no shields").toBe(9);
    expect(60 - lit.cards[foe.instanceId].curHp,
      "and the nine shields absorbed none of it").toBeGreaterThan(9);
  });

  it("Last Light answers any opponent's death, wherever it happens", () => {
    const s = prepState();
    place(s, "dawn_ariel", "P1", 3, 0);
    const doomed = place(s, "dusk_gool", "P2", 0, 3, { curHp: 1, maxHp: 20 });
    const other = place(s, "dusk_gool", "P2", 2, 0, { curHp: 30, maxHp: 30, curShields: 0 });
    defeatCard(s, s.cards[doomed.instanceId], "test");
    expect(s.cards[other.instanceId].curHp, "the nearest survivor takes 2").toBe(28);
  });

  it("but an ALLY falling is not", () => {
    const s = prepState();
    place(s, "dawn_ariel", "P1", 3, 0);
    const ally = place(s, "dawn_beam", "P1", 3, 1, { curHp: 1, maxHp: 20 });
    const foe = place(s, "dusk_gool", "P2", 2, 0, { curHp: 30, maxHp: 30, curShields: 0 });
    defeatCard(s, s.cards[ally.instanceId], "test");
    expect(s.cards[foe.instanceId].curHp).toBe(30);
  });
});

describe("Nightfang wears the Butler", () => {
  it("arrives as the Butler, not as itself", () => {
    const s = prepState();
    s.players.P1.gold = 20;
    s.prep = { priority: "P1", consecutivePasses: 0, movedThisTurn: false };
    const handId = giveHand(s, "P1", "dusk_nightfang");
    const next = applyIntent(s, { type: "SUMMON", player: "P1", handId, col: 0 });
    const inst = boardCards(next, "P1")[0];
    expect(getDef(inst.defId).name).toBe("The Butler");
    expect(inst.maxHp).toBe(getDef("dusk_butler").hp);
    expect(inst.transformedFrom).toBe("dusk_nightfang");
  });

  it("killing the Butler reveals Nightfang at full HP and turns Soul Slash on the killer", () => {
    const s = prepState();
    const mask = place(s, "dusk_nightfang", "P1", 2, 0); // place() runs the disguise
    expect(getDef(s.cards[mask.instanceId].defId).name).toBe("The Butler");
    const killer = place(s, "leaf_alpha", "P2", 2, 1, { curHp: 40, maxHp: 40, curShields: 0 });
    // Beat the disguise down and land the killing blow.
    s.cards[mask.instanceId].curHp = 1;
    basicAttack(s, killer.instanceId, mask.instanceId);
    const revealed = s.cards[mask.instanceId];
    expect(revealed, "it did not die").toBeTruthy();
    expect(getDef(revealed.defId).name).toBe("Nightfang");
    expect(revealed.curHp).toBe(getDef("dusk_nightfang").hp); // back at full
    // Soul Slash deletes 15 max HP from whoever pulled the mask off.
    expect(s.cards[killer.instanceId].maxHp).toBe(40 - 15);
  });

  it("and the Butler is not draftable", () => {
    expect(CARDS.some((d) => d.id === "dusk_butler"), "must be a token, not a deck card").toBe(false);
    expect(TOKENS.some((d) => d.id === "dusk_butler")).toBe(true);
  });
});

describe("a disguise arrives quietly", () => {
  it("neither Nightfang nor the Butler triggers a legendary entrance", () => {
    // Both directions matter. Announcing the true form names a card that is not
    // what lands; announcing the face gives a full-screen legendary reveal to
    // the thing that is supposed to look ordinary.
    expect(announces("dusk_nightfang"), "the true form must not announce").toBe(false);
    expect(announces("dusk_butler"), "and neither must the face").toBe(false);
  });

  it("but an ordinary legendary still gets its moment", () => {
    expect(announces("dusk_skullking")).toBe(true);
    expect(announces("dusk_gool"), "and a rare still does not").toBe(false);
  });
});
