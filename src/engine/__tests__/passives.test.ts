// Restored card passives: the generic hooks (onKill, thorns, vsStatus, gated
// on-hit riders, roundTick, onDeath row-ahead) that back the doc-correct
// abilities in cards.ts.

import { describe, expect, it } from "vitest";
import { applyStatus, basicAttack, defeatCard, drainMaxHp, effectiveBasicHits, hasEvasion, shadeDodgePct, SPECIAL_HANDLERS, TARGETLESS_HANDLERS } from "../combat";
import { weakenStacks } from "../auras";
import { applyFlow, DAWN_STRIKE_PCT, DUSK_DRAIN, DUSK_SHADE_DEATH_DIVISOR, DUSK_SHADE_MAX_STACKS, DUSK_SHADE_PCT, EXOSTONE_DEFAULT, EXOSTONE_SHIELDS, FOG_MISS_PCT, hasElementAura, MISTY_FOG_MISS_PCT, PYRO_BURN_STACK_CAP } from "../auras";
import { advance, applyIntent } from "../phases";
import { basicIsInert, canFireSpecial, canFireTalent, canMove, canTarget, effectiveSpecialCost, specialTargets, validTargets } from "../rules";
import { boardCards, effectiveDmg, effectiveSp, healCard, isBloodfire, notePassive, spawnTokens , cardAt} from "../state";
import { CARDS, CORES, TOKENS, getDef } from "../../data/cards";
import { DEFAULT_SPECIAL_COOLDOWN } from "../types";
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
    // Kept OUT of Sentry's reach even though it no longer matters: Sentry is an
    // EPIC ARC card and Discharge is the mythic/legendary half of the tribe now,
    // so this measures Volt Turret alone. The placement stays because the claim
    // under test is "only a PARALYZED enemy", and a control the turret could
    // reach is a stronger check than one it could not.
    const healthy = place(s, "dusk_gool", "P2", 0, 3, { curHp: 20, maxHp: 40, curShields: 0 });
    const next = advance(atCleanup(s));
    // +DUSK_DRAIN throughout this file: a DUSK card in contact with a P1 body
    // drains one off it and keeps it every Cleanup, so a DUSK punching bag is
    // no longer inert. Written as the mechanic PLUS the heal so the number
    // under test stays legible instead of becoming a magic constant.
    expect(next.cards[stunned.instanceId].curHp).toBe(20 - 5 + DUSK_DRAIN); // Volt Turret + drain
    expect(next.cards[healthy.instanceId].curHp).toBe(20);     // not PARALYZED — spared, and out of contact
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
    expect(next.cards[stunned.instanceId].curHp).toBe(18 + DUSK_DRAIN); // −2 Complete Circuit, +1 Creeping Dark
    expect(next.cards[free.instanceId].curHp).toBe(20 + DUSK_DRAIN); // not paralyzed → spared, but still drinks
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

  /** One Gool basic into a wall of HP, with the option of a Supernova watching
   *  from the far corner. `seed` drives the miss roll; the primary's HP loss is
   *  what comes back. */
  function goolSwing(seed: number, withStar: boolean): { primary: number; adjacent: number } {
    const s = prepState();
    const gool = place(s, "dusk_gool", "P1", 3, 0); // 4 DMG, no splash of its own
    place(s, "aqua_rain", "P1", 3, 1); // Downpour grants P1 an extra adjacent target
    const primary = place(s, "dusk_gool", "P2", 2, 0, { curHp: 40, maxHp: 40, curShields: 0 });
    const adj = place(s, "dusk_gool", "P2", 2, 1, { curHp: 40, maxHp: 40, curShields: 0 });
    if (withStar) place(s, "dawn_supernova", "P2", 0, 3); // out of everyone's reach
    s.rngState = seed;
    basicAttack(s, gool.instanceId, primary.instanceId);
    return { primary: 40 - s.cards[primary.instanceId].curHp, adjacent: 40 - s.cards[adj.instanceId].curHp };
  }

  it("Supernova's Blinding Star makes enemy basics miss", () => {
    // Statistical rather than seed-pinned: the accuracy chain is a sequence of
    // guarded rolls, and pinning a seed asserts the ORDER of that sequence as
    // much as the aura. Over 300 swings a 10% miss chance is unmistakable and
    // cannot be flaky — the alternative hypothesis is that the star does
    // nothing at all, which reads as an exact tie.
    let clean = 0;
    let dazzled = 0;
    for (let seed = 0; seed < 300; seed++) {
      clean += goolSwing(seed, false).primary;
      dazzled += goolSwing(seed, true).primary;
    }
    expect(clean, "nothing else in this setup can cause a miss").toBe(300 * 4);
    expect(dazzled).toBeLessThan(clean);
    // ~10% of the damage lost. Wide bands: this asserts the magnitude is the one
    // the constant names, not that the RNG hit its expectation exactly.
    const lost = (clean - dazzled) / clean;
    expect(lost).toBeGreaterThan(0.02);
    expect(lost).toBeLessThan(0.25);
  });

  it("Blinding Star no longer cancels a granted splash target", () => {
    // It used to, and that was the whole aura. Losing the counter is a real
    // (if narrow) cost of the rewrite, so it is asserted rather than left to be
    // rediscovered — with the star standing, Downpour's grant still lands.
    const swings = Array.from({ length: 120 }, (_, seed) => goolSwing(seed, true));
    // Without it, the grant is unconditional: every swing splashes for 1.
    expect(Array.from({ length: 120 }, (_, seed) => goolSwing(seed, false))
      .every((r) => r.primary === 4 && r.adjacent === 1)).toBe(true);
    // With it, the clip is a basic attack in its own right (it goes back through
    // resolveHit), so it rolls its own miss — but it is suppressed by the ROLL,
    // never by the aura. Most connect.
    const landed = swings.filter((r) => r.primary > 0);
    expect(landed.length, "most swings still connect").toBeGreaterThan(90);
    expect(landed.filter((r) => r.adjacent === 1).length / landed.length).toBeGreaterThan(0.75);
    // And the ordering invariant holds in both directions: no clip without a
    // landed primary, and the clip is never bigger than the grant.
    expect(swings.some((r) => r.primary === 0 && r.adjacent > 0)).toBe(false);
    expect(swings.every((r) => r.adjacent <= 1)).toBe(true);
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
    expect(100 - n.cards[zap.instanceId].curHp).toBe(6 - DUSK_DRAIN); // volley 2, less one Creeping Dark heal
    n = advance(atCleanup(n));
    expect(100 - n.cards[zap.instanceId].curHp).toBe(9 - DUSK_DRAIN * 2); // volley 3, less two Cleanups of drain-heal
    n = advance(atCleanup(n));
    // Turret spent — no 4th volley. The number still moves because Creeping
    // Dark does not stop when the turret does, which is the point of it.
    expect(100 - n.cards[zap.instanceId].curHp).toBe(9 - DUSK_DRAIN * 3);
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
    expect(next.cards[near.instanceId].curShields).toBe(1); // +1 in range
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

  it("Halo: Blessed Light heals home-row allies; Mending Horn mends the WHOLE side", () => {
    const s = prepState();
    place(s, "dawn_halo", "P1", 3, 0);
    const home = place(s, "dawn_able", "P1", 3, 2, { curHp: 5, maxHp: 20 });
    const next = advance(atCleanup(s));
    expect(next.cards[home.instanceId].curHp).toBe(6); // +1 Blessed Light (home row)

    // Mending Horn, driven by the CARD's own params rather than a copy of them.
    // This used to pass `{ targets: 1, amount: 8, cleanseNegatives: 1 }` inline,
    // so it never read Halo at all: it tested the shared `heal` handler while
    // claiming Mending Horn in its title, and went on passing when the Special
    // widened to the whole side and dropped to 7.
    const horn = getDef("dawn_halo").special!;
    const heal = Number(horn.params!.amount);
    const s2 = prepState();
    const h2 = place(s2, "dawn_halo", "P1", 3, 0);
    // TWO allies, because "targets: 99" is the point of the card now.
    const a1 = place(s2, "dawn_able", "P1", 3, 1, { curHp: 6, maxHp: 20 });
    const a2 = place(s2, "dawn_beam", "P1", 2, 1, { curHp: 4, maxHp: 20 });
    for (const a of [a1, a2]) {
      s2.cards[a.instanceId].statuses = [{ kind: "BLEED", duration: 2, power: 2, source: "LEAF" }];
      s2.cards[a.instanceId].buffs = [{ dmg: 2, sp: 0, rounds: 2 }];
    }
    SPECIAL_HANDLERS.heal(
      s2, s2.cards[h2.instanceId],
      [s2.cards[a1.instanceId], s2.cards[a2.instanceId]], horn.params!,
    );
    expect(s2.cards[a1.instanceId].curHp).toBe(6 + heal);
    expect(s2.cards[a2.instanceId].curHp, "the second ally too").toBe(4 + heal);
    for (const a of [a1, a2]) {
      expect(statusOf(s2.cards[a.instanceId], "BLEED")).toBeUndefined(); // negative stripped
      expect(s2.cards[a.instanceId].buffs, "positive buff kept").toHaveLength(1);
    }
    // And it prints a longer lockout than the default, which is what pays for
    // the reach.
    expect(horn.cooldown!).toBeGreaterThan(DEFAULT_SPECIAL_COOLDOWN);
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

  it("Dyna's Demolition Charge deals 4 + 20% of the target's MAX HP", () => {
    const s = prepState();
    const dyna = place(s, "pyro_dyna", "P1", 3, 0);
    const foe = place(s, "dusk_gool", "P2", 2, 0, { curHp: 40, maxHp: 40, curShields: 0 });
    SPECIAL_HANDLERS.barrage(s, s.cards[dyna.instanceId], [s.cards[foe.instanceId]],
      { dmg: 4, targets: 1, pctMaxHpDmg: 20 });
    // 4, then floor(40 * 20%) = 8; 12 dealt total (was 22 off current HP)
    expect(40 - s.cards[foe.instanceId].curHp).toBe(12);
  });

  it("Demolition Charge reads MAX HP, so a wounded target takes the same bonus", () => {
    // The point of the max-HP read: identical bonus on a full and a nearly-dead
    // body. Off CURRENT HP the second number here would have been 4 + 3.
    const s = prepState();
    const dyna = place(s, "pyro_dyna", "P1", 3, 0);
    const hurt = place(s, "dusk_gool", "P2", 2, 0, { curHp: 30, maxHp: 40, curShields: 0 });
    SPECIAL_HANDLERS.barrage(s, s.cards[dyna.instanceId], [s.cards[hurt.instanceId]],
      { dmg: 4, targets: 1, pctMaxHpDmg: 20 });
    expect(30 - s.cards[hurt.instanceId].curHp).toBe(12);
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

  it("Canister's KaBoooom blasts every non-PYRO card beside it", () => {
    const s = prepState();
    const canister = place(s, "pyro_canister", "P1", 3, 0);
    const pyroAlly = place(s, "pyro_tiki", "P1", 3, 1, { curHp: 20, maxHp: 20, curShields: 0 }); // PYRO — spared
    const enemy = place(s, "dusk_gool", "P2", 2, 0, { curHp: 20, maxHp: 20, curShields: 0 }); // adjacent — hit
    defeatCard(s, s.cards[canister.instanceId], "test");
    expect(s.cards[enemy.instanceId].curHp).toBe(15); // 20 - 5
    expect(s.cards[pyroAlly.instanceId].curHp).toBe(20); // PYRO spared
  });

  it("...and nothing outside the blast radius, however far the board reaches", () => {
    // The whole point of the 6-to-everything cut: a 1-cost body that wants to
    // die should not be paid for parking in a corner. Diagonal neighbours still
    // count (king-move), so this checks a true out-of-range card as well.
    const s = prepState();
    const canister = place(s, "pyro_canister", "P1", 3, 0);
    const beside = place(s, "dusk_gool", "P2", 2, 1, { curHp: 20, maxHp: 20, curShields: 0 }); // diagonal
    const across = place(s, "dusk_gool", "P2", 0, 3, { curHp: 20, maxHp: 20, curShields: 0 }); // far corner
    defeatCard(s, s.cards[canister.instanceId], "test");
    expect(s.cards[beside.instanceId].curHp).toBe(15); // diagonals are adjacent
    expect(s.cards[across.instanceId].curHp).toBe(20); // untouched
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

  // Both of these keep Firecrack on its HOME row (3) on purpose. King of the
  // Hill hands any card standing in a Mid row +1 DMG, which quietly turns its
  // printed 5 into a 6 and every figure below into an off-by-one.
  it("Shell Cracker: Firecrack's basic doubles into a shielded target", () => {
    const s = prepState();
    const fc = place(s, "pyro_firecrack", "P1", 3, 0);
    // 2 shields subtract flat from the hit, so the doubling shows in HP: 5 DMG
    // would put 3 through, 10 puts 8. No statuses, so Bloodfire Detonator is not
    // also firing; shielded, so the CRIT coin can't fire either.
    const t = place(s, "dusk_gool", "P2", 2, 0, { curHp: 40, maxHp: 40, curShields: 2 });
    basicAttack(s, fc.instanceId, t.instanceId);
    expect(s.cards[t.instanceId].curHp).toBe(32); // 40 − (5×2 − 2)
  });

  it("...and it does NOT compound with Bloodfire Detonator — the best one wins", () => {
    // Both amplifiers apply here (bleeding + burning + shielded). Multiplying
    // them gave 5 -> 10 -> 20, the largest single basic in the game off a 2-cost
    // 4 HP body. Amplifiers now take the largest instead of the product, so this
    // is 2x, the same as either one alone.
    const s = prepState();
    const fc = place(s, "pyro_firecrack", "P1", 3, 0);
    const t = place(s, "dusk_gool", "P2", 2, 0, { curHp: 40, maxHp: 40, curShields: 2 });
    applyStatus(s, s.cards[t.instanceId], "BLEED", 3, 1, "DUSK");
    applyStatus(s, s.cards[t.instanceId], "BURN", 3, 1, "PYRO");
    basicAttack(s, fc.instanceId, t.instanceId);
    expect(s.cards[t.instanceId].curHp).toBe(32); // 40 − (5×2 − 2), not 5×2×2
  });

  it("Explosive Power is 2x vs a shielded target OR a Tank, never 4x for both", () => {
    // Dynomight's own text reads "OR" and the engine was quietly doing both.
    // Same rule, same fix as Firecrack above — this is the card that proves the
    // rule is general rather than a patch aimed at one card.
    // Armadillo is a Tank AND shielded, so both amplifiers match at once.
    const s = prepState();
    const dyno = place(s, "pyro_dynomight", "P1", 3, 0);
    const t = place(s, "bore_armadillo", "P2", 2, 0, { curHp: 60, maxHp: 60, curShields: 3 });
    basicAttack(s, dyno.instanceId, t.instanceId);
    expect(60 - s.cards[t.instanceId].curHp).toBe(13); // 9×2 = 18, −2 BLOCK, −3 shields
    // Stacked it was 9×2×2 = 36 → 31 through the same armour. Nearly triple.

    // And a shielded NON-Tank takes the same 2x, so the fix didn't turn "OR"
    // into "only when both" — either condition alone still pays in full.
    const b = prepState();
    const d2 = place(b, "pyro_dynomight", "P1", 3, 0);
    const g = place(b, "dusk_gool", "P2", 2, 0, { curHp: 60, maxHp: 60, curShields: 3 });
    basicAttack(b, d2.instanceId, g.instanceId);
    expect(60 - b.cards[g.instanceId].curHp).toBe(15); // 9×2 = 18, −3 shields, no BLOCK
  });

  it("Slag Field burns what stands beside the Tortoise — and only that", () => {
    // The same inRangeDmg field that gives Smog the whole enemy board gives the
    // Tortoise eight squares, because it reads canTarget and the Tortoise is
    // Melee. That difference is the entire point of the passive, so it is what
    // this pins: a Ranged reading here would catch the far card too.
    const s = prepState();
    place(s, "pyro_slag_tortoise", "P1", 2, 1);
    const beside = place(s, "dusk_gool", "P2", 1, 1, { curHp: 20, maxHp: 20, curShields: 0 });
    const diagonal = place(s, "dusk_vamp", "P2", 1, 2, { curHp: 20, maxHp: 20, curShields: 0 });
    const across = place(s, "dusk_crow", "P2", 0, 3, { curHp: 20, maxHp: 20, curShields: 0 });
    const next = advance(atCleanup(s));
    expect(next.cards[beside.instanceId].curHp).toBe(19);
    expect(next.cards[diagonal.instanceId].curHp).toBe(19);
    expect(next.cards[across.instanceId].curHp).toBe(20); // out of a Melee card's reach
  });

  it("...and the Tortoise can finally take a step", () => {
    // The other half of the fix: at SP 0 it was welded to the slot it was
    // summoned into, so a wall you could not position was a wall in your own
    // home row. One point is one king-step a round.
    const s = prepState();
    const tort = place(s, "pyro_slag_tortoise", "P1", 3, 1);
    expect(effectiveSp(s, s.cards[tort.instanceId])).toBe(1);
    expect(canMove(s, "P1", tort.instanceId, { row: 2, col: 1 }).ok).toBe(true);
    // Still a tortoise — one step, not a charge across the board.
    expect(canMove(s, "P1", tort.instanceId, { row: 1, col: 1 }).ok).toBe(false);
  });

  it("Black Smoke chokes the enemy and mends the ally in the same breath", () => {
    const s = prepState();
    // Smog itself starts hurt, so its own line proves inclusion rather than
    // passing for free on a card that was already full.
    const smog = place(s, "pyro_smog_card", "P1", 3, 0, { curHp: 12, maxHp: 20 });
    const ally = place(s, "pyro_tiki", "P1", 3, 1, { curHp: 10, maxHp: 20, curShields: 0 });
    const foe = place(s, "dusk_gool", "P2", 1, 0, { curHp: 20, maxHp: 20, curShields: 0 });
    const next = advance(atCleanup(s));
    expect(next.cards[foe.instanceId].curHp).toBe(19); // choked for 1
    expect(next.cards[ally.instanceId].curHp).toBe(11); // mended for 1
    expect(next.cards[smog.instanceId].curHp).toBe(13); // the cloud sustains itself too
  });

  it("...and the mend never overfills a healthy ally", () => {
    const s = prepState();
    place(s, "pyro_smog_card", "P1", 3, 0);
    const full = place(s, "pyro_tiki", "P1", 3, 1, { curHp: 20, maxHp: 20, curShields: 0 });
    place(s, "dusk_gool", "P2", 1, 0, { curHp: 20, maxHp: 20, curShields: 0 }); // keep P2 alive
    const next = advance(atCleanup(s));
    expect(next.cards[full.instanceId].curHp).toBe(20);
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
      // BORE prey, deliberately. A DUSK one made this test a COIN FLIP: Midnight
      // Shade hands every DUSK card dodge per FALLEN DUSK ally, so the first kill
      // armed the second victim, and whether the second attack landed depended on
      // where the shared seeded RNG happened to be. Adding cards to the default
      // decks moves that stream, so the test failed for a reason that had nothing
      // to do with Heir. The prey's element was always incidental here.
      const prey = place(s, "bore_rockgoblin", "P2", 1, i, { curHp: 1, curShields: 0 });
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
    // TWO ticks, which is one round of fear from the chair. A death resolves in
    // BATTLE and Cleanup runs straight after, so at 1 this expired before the
    // Prep it exists to freeze — everyone stepped back and then moved freely.
    // See frighten-duration.test.ts for the rule and the other two carriers.
    expect(statusOf(s.cards[killer.instanceId], "FRIGHTEN")?.duration).toBe(2);
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

  it("Emberclaw's Flaming Slasher sweeps every opponent in range and burns them", () => {
    // A sweep now, not a loaded blade: one swing across everything in reach
    // rather than two charges spent one target at a time.
    const s = prepState();
    s.players.P1.magicPool = 2;
    const sseerr = place(s, "pyro_sseerr", "P1", 2, 0);
    const a = place(s, "dusk_gool", "P2", 1, 0, { curHp: 60, maxHp: 60, curShields: 0 });
    const b = place(s, "dusk_gool", "P2", 1, 1, { curHp: 60, maxHp: 60, curShields: 0 });
    const next = applyIntent(battleFor(s, sseerr.instanceId), {
      type: "BATTLE_ACTION",
      player: "P1",
      action: "special",
      targetId: a.instanceId,
    });
    for (const t of [a, b]) {
      expect(next.cards[t.instanceId].curHp, "both were caught").toBeLessThan(60);
      expect(statusOf(next.cards[t.instanceId], "BURN")?.power).toBe(4);
    }
    // Nothing is loaded onto the next basic — the whole special resolved now.
    expect(next.cards[sseerr.instanceId].loadedOnHit).toBeUndefined();
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
    // spBonus -9 zeroes its effective SP, and with it Slipstream: a GALE card's
    // dodge chance is read off its own speed, so this assertion used to ride an
    // ~18% coin on the shared RNG stream and broke the moment the default decks
    // changed size. The dodge is not what is under test — the thorns are.
    const windsor = place(s, "gale_windsor", "P1", 3, 0, { spBonus: -9 });
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
    // Marked: Electrify adds +1 vs a statused target = 5.
    basicAttack(s, buzz.instanceId, foe.instanceId);
    expect(s.cards[foe.instanceId].curHp).toBe(21);
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
    expect(next.cards[foe.instanceId].curHp).toBe(afterHit - 1 + DUSK_DRAIN); // Trapper bit, Creeping Dark gave it back
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
    const wolf = place(s, "gale_wolfbane", "P1", 3, 0, { curHp: 10, maxHp: 17 }); // SP 9
    const slow = place(s, "bore_hillbilly", "P2", 3, 1, { curHp: 40, maxHp: 40, curShields: 0 }); // SP 2 < 9
    s.rngState = seedForCoins(true); // crit coin succeeds
    // 9 printed + 1 Tailwind (GALE aura, +1 DMG per 6 SP — floor(9/6) = 1),
    // then doubled by the CRIT.
    expect(effectiveDmg(s, s.cards[wolf.instanceId])).toBe(10);
    basicAttack(s, wolf.instanceId, slow.instanceId);
    expect(s.cards[slow.instanceId].curHp).toBe(40 - 20);
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

describe("Violet's max-HP cap", () => {
  // Violet banks max HP three separate ways and none of them used to stop, so
  // the cap is tested on each route rather than once on the helper — a cap that
  // only guards two of three is not a cap.
  const CAP = getDef("dusk_violet").maxHpCap!;

  it("is a real ceiling, not a formality", () => {
    // Derived everywhere below so a re-tune does not break four tests — which
    // leaves those four unable to notice if the number goes missing or turns
    // absurd, because they would place Violet at cap-1 and pass against any
    // value at all. This is the one assertion that reads it as a NUMBER: a
    // band, not the literal, so moving 60 to 50 or 70 is still fine.
    expect(CAP).toBeGreaterThan(getDef("dusk_violet").hp);
    expect(CAP).toBeLessThan(100);
  });

  /** Violet already fattened to one point under the ceiling. */
  const nearCap = (s: GameState) =>
    place(s, "dusk_violet", "P1", 2, 0, { curHp: CAP - 1, maxHp: CAP - 1 });

  it("stops the DRAIN keyword on basics at the ceiling", () => {
    const s = prepState();
    const violet = nearCap(s);
    const prey = place(s, "dusk_gool", "P2", 1, 0, { curHp: 40, maxHp: 40 });
    // Three points offered, one seat left under the cap.
    drainMaxHp(s, violet, prey, 3);
    expect(violet.maxHp).toBe(CAP);
    // The theft still HURTS: the cap bounds what Violet banks, not what the
    // attack costs its target. Draining is an attack before it is a ramp.
    expect(prey.maxHp).toBe(37);
  });

  it("stops Draining Siphon's round tick at the ceiling", () => {
    const s = prepState();
    const violet = nearCap(s);
    place(s, "dusk_gool", "P2", 1, 0, { curHp: 40, maxHp: 40 });
    place(s, "dusk_gool", "P2", 1, 1, { curHp: 40, maxHp: 40 });
    const next = advance(atCleanup(s));
    expect(next.cards[violet.instanceId].maxHp).toBe(CAP);
  });

  it("stops Bloody Exchange, which takes from the whole board at once", () => {
    const s = prepState();
    const violet = nearCap(s);
    // Six bodies × 2 = twelve points on offer against a single seat of room.
    for (let c = 0; c < 3; c++) {
      place(s, "dusk_gool", "P2", 1, c, { curHp: 40, maxHp: 40 });
      place(s, "dusk_gool", "P1", 3, c, { curHp: 40, maxHp: 40 });
    }
    SPECIAL_HANDLERS.bloodyExchange(s, violet, [], { amount: 2 });
    expect(violet.maxHp).toBe(CAP);
    // curHp cannot be left above the ceiling either. It is the pairing that
    // used to break: every growth site added the REQUESTED amount to curHp
    // beside the granted one, so a capped card floated above its own maximum
    // until Cleanup clawed it back.
    expect(violet.curHp).toBeLessThanOrEqual(CAP);
  });

  it("leaves an UNCAPPED drainer growing exactly as before", () => {
    const s = prepState();
    // Nightfang has no maxHpCap, so routing every growth site through the same
    // helper must be invisible to it.
    const other = place(s, "dusk_nightfang", "P1", 2, 0, { curHp: 200, maxHp: 200 });
    expect(getDef("dusk_nightfang").maxHpCap).toBeUndefined();
    const prey = place(s, "dusk_gool", "P2", 1, 0, { curHp: 40, maxHp: 40 });
    drainMaxHp(s, other, prey, 5);
    expect(other.maxHp).toBe(205);
  });
});

describe("roundTick self effects", () => {
  // Gool's printed HP, for the round-tick tests below. They used to write 13 by
  // hand into `curHp` and leave maxHp at the default — so when Gool's line
  // changed, Cleanup's clamp to effectiveMaxHp pulled the dummy down to the new
  // maximum BEFORE the tick landed, and three tests failed over a card none of
  // them are about.
  const GOOL_HP = getDef("dusk_gool").hp;
  const gool = (s: GameState, row: number, col: number) =>
    place(s, "dusk_gool", "P2", row, col, { curHp: GOOL_HP, maxHp: GOOL_HP });

  it("Dunewraith's Sandstorm dings every enemy in Cleanup", () => {
    const s = prepState();
    place(s, "bore_sandman", "P1", 2, 0);
    place(s, "leaf_greegon", "P1", 3, 0); // keep P1 on the board
    const enemy = gool(s, 1, 0);
    const next = advance(atCleanup(s));
    expect(next.cards[enemy.instanceId].curHp).toBe(GOOL_HP - 1); // −1 Sandstorm
  });

  // Sweeping Flames was a single point of direct damage to the ONE row directly
  // ahead, which on a board where the enemy stood anywhere else was nothing at
  // all. It is a BURN on everything the torch can reach now, laid as the Battle
  // phase opens (`startBattle` reads `roundTick.inRangeStatus`, not the Cleanup
  // tick), so the fire is on them for the battle it was meant to affect.
  it("Tiki's Sweeping Flames burns everything it can reach, as battle opens", () => {
    const s = prepState();
    const tiki = place(s, "pyro_tiki", "P1", 2, 0); // melee, reach 1
    const inFront = gool(s, 1, 0); // in reach
    const beside = gool(s, 2, 1); // in reach, and NOT the row ahead — the whole fix
    const farBack = gool(s, 0, 3); // out of reach: a torch is not a cannon
    // Prep → Battle by the only route there is: both seats pass. The Cleanup
    // tick is deliberately NOT what carries this, so a test that ticked Cleanup
    // would be checking the wrong hook.
    const next = applyIntent(
      applyIntent(s, { type: "PASS", player: "P1" }),
      { type: "PASS", player: "P2" },
    );
    expect(next.phase).toBe("battle");
    for (const t of [inFront, beside]) {
      const burn = next.cards[t.instanceId].statuses.find((st) => st.kind === "BURN");
      expect(burn, `${t.instanceId} was not set alight`).toBeTruthy();
      expect(burn!.power).toBe(1);
      expect(burn!.duration).toBe(2);
    }
    expect(next.cards[farBack.instanceId].statuses.some((st) => st.kind === "BURN")).toBe(false);
    // The mark is a DoT, not an instant — nothing has ticked yet.
    expect(next.cards[inFront.instanceId].curHp).toBe(GOOL_HP);
    void tiki;
  });

  it("Smog's Black Smoke chokes every enemy in range, not just the row ahead", () => {
    const s = prepState();
    const smog = place(s, "pyro_smog_card", "P1", 2, 0); // ranged, mid row (clears the home-row rule)
    const near = gool(s, 1, 0); // row directly ahead
    const far = gool(s, 0, 3); // back home row — a ranged tick still reaches
    const next = advance(atCleanup(s));
    expect(next.cards[near.instanceId].curHp).toBe(GOOL_HP - 1); // −1 Black Smoke
    expect(next.cards[far.instanceId].curHp).toBe(GOOL_HP - 1); // whole board, unlike Sweeping Flames' row-ahead
    void smog;
  });
});

describe("Sol — Incinerate ramp", () => {
  it("consecutive hits on the same target climb +1 DMG each", () => {
    const s = prepState();
    const sol = place(s, "pyro_sol", "P1", 3, 0); // 3 DMG × 3 hits, home row (no mid bonus)
    const foe = place(s, "dusk_gool", "P2", 1, 0, { curHp: 60, maxHp: 60, curShields: 0 });
    basicAttack(s, sol.instanceId, foe.instanceId);
    // hit 1 = 3, hit 2 = 3+1 = 4, hit 3 = 3+2 = 5  → 12 total this round
    expect(s.cards[foe.instanceId].curHp).toBe(60 - 12);
    // next attack on the SAME target keeps ramping (struckBefore = 3):
    // hit 4 = 3+3 = 6, hit 5 = 3+4 = 7, hit 6 = 3+5 = 8 → 21 more
    basicAttack(s, sol.instanceId, foe.instanceId);
    expect(s.cards[foe.instanceId].curHp).toBe(60 - 12 - 21);
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
    const foe = place(s, "dusk_gool", "P2", 2, 1, { curHp: 20 }); // mid row
    SPECIAL_HANDLERS.statusNova(s, galeon, [foe], {
      statusKind: "WEAKEN", statusDuration: 2, targets: 99, push: 2, spDebuff: 8, spDebuffRounds: 1,
    });
    expect(s.cards[foe.instanceId].pos!.row).toBe(0); // pushed back 2 → P2 home row
    // Derived: this read a flat 0 with "8 - 8" written beside it, which is the
    // DUMMY's printed speed hand-copied into a test about Galeon.
    const sap = Number(getDef("gale_galeon").special!.params!.spDebuff ?? 0);
    expect(effectiveSp(s, s.cards[foe.instanceId])).toBe(Math.max(0, getDef("dusk_gool").sp - sap));
  });

  it("barrage's spDebuff rider saps the speed of every target it hits", () => {
    // RETITLED. This was "Purple Wind Surge applies -2 SP", but it calls the
    // barrage handler with INLINE params rather than the card's — so it never
    // read Angale at all, and went on passing after Purple Wind Surge dropped
    // its sap for a push. A test named after a card should use that card's
    // params or not claim to be about it; this one is really about the rider,
    // which Galeon still carries, so it is named for the rider now.
    const s = prepState();
    const angale = place(s, "gale_angale", "P1", 2, 0);
    const foe = place(s, "dusk_gool", "P2", 1, 0, { curHp: 20 });
    SPECIAL_HANDLERS.barrage(s, angale, [foe], {
      dmg: 1, hits: 4, targets: 3, statusKind: "WEAKEN", statusDuration: 2, spDebuff: 2, spDebuffRounds: 2,
    });
    expect(effectiveSp(s, s.cards[foe.instanceId])).toBe(getDef("dusk_gool").sp - 2);
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
    // 8 printed + 2 Tailwind (GALE aura, +1 DMG per 6 SP — Klipso is SP 13, so
    // floor(13/6) = 2) = 10, plus the 4 first-strike bonus on the opener.
    const klipso = place(s, "gale_klipso", "P1", 3, 0);
    const foe = place(s, "dusk_gool", "P2", 3, 1, { curHp: 60 });
    expect(effectiveDmg(s, s.cards[klipso.instanceId])).toBe(10);
    basicAttack(s, klipso.instanceId, foe.instanceId);
    expect(s.cards[foe.instanceId].curHp).toBe(46); // 60 − (10 + 4)
    basicAttack(s, klipso.instanceId, foe.instanceId);
    expect(s.cards[foe.instanceId].curHp).toBe(36); // 46 − 10 (no bonus the 2nd time)
  });
});

describe("Thunder rides the SP, it does not print it", () => {
  it("is SP 11 on the card and 15 on the bike", () => {
    const d = getDef("bolt_thunder");
    expect(d.sp, "the printed line").toBe(11);
    expect(d.mountedSp, "and what the mount adds").toBe(4);
    // The printed line is what the cost is computed from, so it must be the one
    // on the curve: 4*2 + 16 + 0 + 11 = 35 = 5*5+10.
    expect(d.dmg * d.hits + d.hp + d.shields * 2 + d.sp, "on the curve").toBe(5 * d.cost + 10);

    const s = prepState();
    const t = place(s, "bolt_thunder", "P1", 3, 0);
    expect(effectiveSp(s, s.cards[t.instanceId]), "mounted, in play").toBe(15);
  });

  it("...and loses it when it comes off the bike", () => {
    // `transformed` is the dismount flag — the same one that takes the
    // king-move away. Both halves of riding go together, which is the whole
    // reason the 4 lives on the mount instead of in the stat line.
    const s = prepState();
    const t = place(s, "bolt_thunder", "P1", 3, 0);
    expect(effectiveSp(s, s.cards[t.instanceId])).toBe(15);
    s.cards[t.instanceId].transformed = true;
    expect(effectiveSp(s, s.cards[t.instanceId]), "back on its own legs").toBe(11);
  });
});

describe("The Voltis — Kingpin's gang aura", () => {
  it("gives the gang +1 DMG and +2 SP, and nobody else", () => {
    const s = prepState();
    const made = place(s, "bolt_hacker", "P1", 3, 0);       // Voltis
    const outsider = place(s, "bolt_zap", "P1", 3, 3);      // BOLT, not Voltis
    const baseD = effectiveDmg(s, s.cards[made.instanceId]);
    const baseS = effectiveSp(s, s.cards[made.instanceId]);
    const outD = effectiveDmg(s, s.cards[outsider.instanceId]);
    const outS = effectiveSp(s, s.cards[outsider.instanceId]);

    place(s, "bolt_kingpin", "P1", 3, 1);
    expect(effectiveDmg(s, s.cards[made.instanceId])).toBe(baseD + 1);
    expect(effectiveSp(s, s.cards[made.instanceId])).toBe(baseS + 2);
    // Scope is the TRIBE, not the element — the gang, not all of BOLT.
    expect(effectiveDmg(s, s.cards[outsider.instanceId])).toBe(outD);
    expect(effectiveSp(s, s.cards[outsider.instanceId])).toBe(outS);
  });

  it("and the boss paid for it out of its own speed", () => {
    // SP 5 -> 3 is the price of the aura, and the +2 it hands out is exactly
    // what it gave up: the stat moves from one body to ten rather than being
    // conjured. Pinned so a later "restore Kingpin's speed" cannot quietly make
    // the aura free.
    expect(getDef("bolt_kingpin").sp, "the boss is slow now").toBe(3);
    expect(getDef("bolt_kingpin").aura?.sp, "and hands out what it lost").toBe(2);
    const d = getDef("bolt_kingpin");
    expect(d.dmg * d.hits + d.hp + d.shields * 2 + d.sp, "48, two under a cost-8 budget of 50").toBe(48);
  });
});

describe("Kloud's Twisted Rage raises a storm", () => {
  function cast() {
    const s = prepState();
    s.players.P1.magicPool = 9;
    const kloud = place(s, "gale_kloud", "P1", 3, 1);
    const prey = place(s, "dusk_gool", "P2", 2, 1, { curHp: 90, maxHp: 90, curShields: 0 });
    SPECIAL_HANDLERS.spawn(s, s.cards[kloud.instanceId], [s.cards[prey.instanceId]],
      getDef("gale_kloud").special!.params!);
    return { s, storms: Object.values(s.cards).filter((c) => c.defId === STORM && c.curHp > 0) };
  }
  const STORM = "gale_thundering_hurricane_tok";

  it("deals NO damage — the summons is the whole Special", () => {
    // The chain is gone, so the one thing that could regress quietly is a
    // handler that still touches the enemy. Checked against a body standing in
    // range of everything Kloud has.
    const s = prepState();
    s.players.P1.magicPool = 9;
    const kloud = place(s, "gale_kloud", "P1", 3, 1);
    const prey = place(s, "dusk_gool", "P2", 2, 1, { curHp: 900, maxHp: 900, curShields: 0 });
    SPECIAL_HANDLERS.spawn(s, s.cards[kloud.instanceId], [s.cards[prey.instanceId]],
      getDef("gale_kloud").special!.params!);
    expect(s.cards[prey.instanceId].curHp, "untouched").toBe(900);
    expect(Object.values(s.cards).filter((c) => c.defId === STORM && c.curHp > 0), "storm still rises")
      .toHaveLength(1);
  });

  it("arrives on the caster's side at HALF its card", () => {
    const { s, storms } = cast();
    expect(storms, "one storm").toHaveLength(1);
    const st = storms[0];
    const printed = getDef(STORM);
    expect(st.owner, "it fights for Kloud").toBe("P1");
    // The stat line is halved on the instance...
    expect(st.maxHp).toBe(Math.round(printed.hp * 0.5));
    expect(st.statScale).toBe(0.5);

    // ...and `statScale` is what makes the DAMAGE follow, which a plain HP cut
    // would not — a 20-DMG body conjured free is the thing being avoided.
    //
    // COMPARED AGAINST AN UNSCALED TWIN rather than against `printed.dmg * 0.5`,
    // because the printed number is not what either of them hits for: this
    // token is a MAGE, so Kloud's own Mage aura feeds it +1, GALE's tailwind
    // adds more on top, and a mid row would add more again. The twin sits in
    // the same ROW so every one of those applies identically and the only
    // difference left is the scaling.
    const twinCol = [0, 1, 2, 3].find((c) => c !== st.pos!.col && !cardAt(s, st.pos!.row, c))!;
    const twin = place(s, STORM, "P1", st.pos!.row as never, twinCol as never);
    const full = effectiveDmg(s, s.cards[twin.instanceId]);
    expect(effectiveDmg(s, st), "half power means half the punch")
      .toBe(Math.floor(full * 0.5));
  });

  it("and only one at a time, however often the Special fires", () => {
    // Twisted Rage is repeatable on a cooldown; without the ceiling a long game
    // is a sky full of them.
    const s = prepState();
    s.players.P1.magicPool = 30;
    const kloud = place(s, "gale_kloud", "P1", 3, 1);
    const prey = place(s, "dusk_gool", "P2", 2, 1, { curHp: 900, maxHp: 900, curShields: 0 });
    for (let i = 0; i < 3; i++)
      SPECIAL_HANDLERS.spawn(s, s.cards[kloud.instanceId], [s.cards[prey.instanceId]],
        getDef("gale_kloud").special!.params!);
    expect(Object.values(s.cards).filter((c) => c.defId === STORM && c.curHp > 0)).toHaveLength(1);
  });
});

describe("the two Dark Wind auras", () => {
  it("compose, because they are on different stats", () => {
    // Auras of the SAME stat do not stack — the best one wins (`auraPick`). These
    // two are deliberately not the same stat, so a flock flying under both is
    // faster AND harder rather than one-or-the-other. That is the whole reason
    // the tribe can carry two.
    const s = prepState();
    const bird = place(s, "gale_duster", "P1", 3, 0);
    const bareSp = effectiveSp(s, s.cards[bird.instanceId]);
    const bareDmg = effectiveDmg(s, s.cards[bird.instanceId]);

    place(s, "gale_galeon", "P1", 3, 1);        // Dark Wind: +3 SP
    place(s, "gale_dreamcatcher", "P1", 3, 2);  // Ill Wind:  +1 DMG
    expect(effectiveSp(s, s.cards[bird.instanceId]), "Galeon's wind").toBe(bareSp + 3);
    expect(effectiveDmg(s, s.cards[bird.instanceId]), "Dreamcatcher's").toBe(bareDmg + 1);
  });

  it("reach nothing outside the flock", () => {
    const s = prepState();
    // GALE, and Avian — but not Dark Wind. Scope is the tribe, not the element.
    const outsider = place(s, "gale_hawk", "P1", 3, 0);
    const sp = effectiveSp(s, s.cards[outsider.instanceId]);
    const dmg = effectiveDmg(s, s.cards[outsider.instanceId]);
    place(s, "gale_galeon", "P1", 3, 1);
    place(s, "gale_dreamcatcher", "P1", 3, 2);
    expect(effectiveSp(s, s.cards[outsider.instanceId])).toBe(sp);
    expect(effectiveDmg(s, s.cards[outsider.instanceId])).toBe(dmg);
  });
});

describe("Dunewraith's Sandstorm", () => {
  /** Attacker at r2c1 hitting r1c1, with a neighbour at r1c2 to catch the chip. */
  function field(withWraith: boolean) {
    const s = prepState();
    const hog = place(s, "bore_warthog", "P1", 2, 1);
    const prey = place(s, "dusk_gool", "P2", 1, 1, { curHp: 60, maxHp: 60, curShields: 0 });
    const beside = place(s, "dusk_gool", "P2", 1, 2, { curHp: 60, maxHp: 60, curShields: 0 });
    if (withWraith) place(s, "bore_sandman", "P1", 3, 1);
    return { s, hog, prey, beside };
  }

  it("a Sand Village basic chips the neighbour for 2 — and only with the wraith up", () => {
    const bare = field(false);
    basicAttack(bare.s, bare.hog.instanceId, bare.prey.instanceId);
    expect(60 - bare.s.cards[bare.beside.instanceId].curHp, "no aura, no splash").toBe(0);

    const storm = field(true);
    basicAttack(storm.s, storm.hog.instanceId, storm.prey.instanceId);
    expect(60 - storm.s.cards[storm.beside.instanceId].curHp, "the sand gets in").toBe(2);
  });

  it("does not reach an ally outside the tribe", () => {
    // The whole reason this goes through the generic aura system rather than
    // `splashAura`, which has no scope and would have handed it to the team.
    const s = prepState();
    const outsider = place(s, "bore_smith", "P1", 2, 1); // BORE, not Sand Village
    const prey = place(s, "dusk_gool", "P2", 1, 1, { curHp: 60, maxHp: 60, curShields: 0 });
    const beside = place(s, "dusk_gool", "P2", 1, 2, { curHp: 60, maxHp: 60, curShields: 0 });
    place(s, "bore_sandman", "P1", 3, 1);
    basicAttack(s, outsider.instanceId, prey.instanceId);
    expect(60 - s.cards[beside.instanceId].curHp, "not in the village, not in the storm").toBe(0);
  });
});

describe("Smith's Forge Work", () => {
  it("arms the STRONGEST ally in reach each round, and never itself", () => {
    const s = prepState();
    const smith = place(s, "bore_smith", "P1", 3, 1);
    // Two allies in reach; only the harder hitter should be worked on.
    // STRONGEST IS PER-HIT DMG, which is `effectiveDmg` and the same measure
    // Dreamweaver's mirror uses. Greegon is 4x1 and Alpha is 2x4 — equal output,
    // and Greegon wins because the buff is +1 per hit. Worth pinning: the naive
    // reading picks the 4-hit body, and it would be a different card.
    const weak = place(s, "leaf_alpha", "P1", 3, 0);
    const strong = place(s, "leaf_greegon", "P1", 2, 1);
    const n = advance(atCleanup(s));
    expect(n.cards[strong.instanceId].dmgBonus, "the biggest asset gets the steel").toBe(1);
    expect(n.cards[strong.instanceId].curShields - s.cards[strong.instanceId].curShields).toBe(1);
    expect(n.cards[weak.instanceId].dmgBonus, "not the weaker one").toBe(0);
    // A smith arms the line, not itself — and the selection would otherwise pick
    // it whenever it happened to be the hardest hitter on the board.
    expect(n.cards[smith.instanceId].dmgBonus, "never itself").toBe(0);
  });

  it("stops at five, because an uncapped ramp is the thing this roster avoids", () => {
    const s = prepState();
    place(s, "bore_smith", "P1", 3, 1);
    const ally = place(s, "leaf_alpha", "P1", 2, 1, { curHp: 200, maxHp: 200 });
    let g = s;
    for (let i = 0; i < 9; i++) g = advance(atCleanup(g));
    // Nine rounds of anvil, five ticks of output. The cap is on the SMITH's
    // ramp counter, so it is the forge that runs out rather than the ally.
    expect(g.cards[ally.instanceId].dmgBonus, "capped at maxTicks, not at rounds").toBe(5);
  });
});

describe("on-opponent-summon reactions", () => {
  it("react only to a newcomer IN RANGE: mid-row reactors zap, back-row ones don't", () => {
    const s = prepState(); // P1 has priority
    s.players.P1.gold = 5;
    // In range of the P1 home row (mid row = can reach it). Rock Goblin used to
    // stand here too: its Cave Guard was an on-SUMMON reaction and is now a zone
    // of control that fires when an opponent MOVES into reach, so it is tested
    // where it now belongs (below) rather than here.
    place(s, "bolt_drshock", "P2", 2, 1); // Shocker: ELECTRIFIED (ranged, from mid)
    const handId = giveHand(s, "P1", "dusk_gool");
    const next = applyIntent(s, { type: "SUMMON", player: "P1", handId, col: 0 });
    const fresh = boardCards(next, "P1").find((c) => c.defId === "dusk_gool")!;
    expect(fresh.curHp).toBe(getDef("dusk_gool").hp); // nothing reacts with damage now
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

  it("Rock Goblin's Cave Guard is a ZONE now: it hits what walks into reach", () => {
    // It used to react to a SUMMON, which happens on the far side of the board
    // and has nothing to do with guarding ground. It holds a line instead.
    const s = prepState(42, "P2");
    // ON ITS OWN HOME ROW (3 on a 4x4) — the zone is gated on the guard
    // standing where a guard stands. See the card.
    const gob = place(s, "bore_rockgoblin", "P1", 3, 1);
    const foe = place(s, "dusk_gool", "P2", 1, 1);
    gob.summonedThisRound = false; foe.summonedThisRound = false;
    const hp0 = foe.curHp;
    // Step to (2,1) — now adjacent to the goblin, which is its Melee reach.
    const next = applyIntent(s, { type: "MOVE", player: "P2", instanceId: foe.instanceId, to: { row: 2, col: 1 } });
    expect(next.cards[foe.instanceId].curHp, "walked into reach and was not hit").toBe(hp0 - 2);
  });

  it("...and switches OFF the moment the guard leaves its home row", () => {
    // The condition that makes the name true: a guard holds a line, and the
    // trade for stepping forward is giving the zone up. Same geometry as above,
    // one row further up the board.
    const s = prepState(42, "P2");
    const gob = place(s, "bore_rockgoblin", "P1", 2, 1); // NOT the home row
    const foe = place(s, "dusk_gool", "P2", 0, 1);
    gob.summonedThisRound = false; foe.summonedThisRound = false;
    const hp0 = foe.curHp;
    const next = applyIntent(s, { type: "MOVE", player: "P2", instanceId: foe.instanceId, to: { row: 1, col: 1 } });
    expect(next.cards[foe.instanceId].curHp, "a chaser, not a guard").toBe(hp0);
  });

  it("...and stays silent for a step it cannot reach", () => {
    const s = prepState(42, "P2");
    const gob = place(s, "bore_rockgoblin", "P1", 3, 3); // far corner
    const foe = place(s, "dusk_gool", "P2", 0, 0);
    gob.summonedThisRound = false; foe.summonedThisRound = false;
    const hp0 = foe.curHp;
    const next = applyIntent(s, { type: "MOVE", player: "P2", instanceId: foe.instanceId, to: { row: 1, col: 0 } });
    expect(next.cards[foe.instanceId].curHp, "hit from clear across the board").toBe(hp0);
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

  it("Midnight Shade (DUSK): a dying DUSK card hits its killer for HALF its DMG", () => {
    // Cut to a third once and restored — the nerf had the right shape (an aura
    // that pays out for LOSING cards rewards the disposable-body element for
    // what it already does) and the wrong size; DUSK measured last by six and a
    // half points afterwards. Derived from the constant rather than typed, so
    // the next move of that dial does not need this test edited to agree.
    const s = prepState();
    const killer = place(s, "gale_duster", "P1", 2, 0, { curHp: 9 });
    const dusk = place(s, "dusk_reaper", "P2", 2, 1, { curHp: 1 });
    const back = Math.max(1, Math.floor(getDef("dusk_reaper").dmg / DUSK_SHADE_DEATH_DIVISOR));
    expect(back, "Reaper is big enough that the floor is not what is under test").toBeGreaterThan(1);
    basicAttack(s, killer.instanceId, dusk.instanceId);
    expect(s.cards[dusk.instanceId]).toBeUndefined();
    expect(s.cards[killer.instanceId].curHp).toBe(9 - back);
  });

  it("...and even the cheapest bodies bite back for at least 1", () => {
    // The floor's band has narrowed every time the divisor has: at a third it
    // caught printed 0-2, at a half 0-1, and at FULL damage only 0. So this
    // uses RIP, the one DUSK-aura carrier printing 0 DMG and therefore the only
    // card whose recoil is still the floor rather than its own number.
    //
    // Vamp used to stand here and would now pass for the wrong reason: it
    // prints 1, which at a divisor of 1 comes out as 1 whether the floor exists
    // or not, so it would assert nothing.
    const s = prepState();
    expect(getDef("dusk_rip").dmg, "RIP is the 0-DMG case the floor exists for").toBe(0);
    const killer = place(s, "gale_duster", "P1", 2, 0, { curHp: 5, curShields: 0 });
    const rip = place(s, "dusk_rip", "P2", 2, 1, { curHp: 1 });
    basicAttack(s, killer.instanceId, rip.instanceId);
    expect(s.cards[rip.instanceId]).toBeUndefined();
    expect(s.cards[killer.instanceId].curHp).toBe(4); // 5 − 1 Midnight Shade floor
  });

  /** One Weeds swing on a given seed. Returns the state afterwards. 15% is not
   *  reachable through the coin helper, so these sweep seeds instead. */
  const weedsSwing = (seed: number, foeHp = 60) => {
    const s = prepState();
    s.rngState = seed;
    const w = place(s, "leaf_weeds", "P1", 3, 0);
    const foe = place(s, "dusk_gool", "P2", 2, 0, { curHp: foeHp, maxHp: foeHp, curShields: 0 });
    basicAttack(s, w.instanceId, foe.instanceId);
    return { s, w };
  };

  it("Spread (Weeds): a landed basic can put another Weeds on the board", () => {
    // ~15% of seeds should spread. Sweeping proves it fires without pinning the
    // test to one lucky seed, and the bounds prove it is a CHANCE, not always.
    let spread = 0;
    for (let seed = 0; seed < 200; seed++) {
      const { s } = weedsSwing(seed);
      if (s.log.some((l) => l.includes("spreads"))) spread++;
    }
    expect(spread, "never spread in 200 swings").toBeGreaterThan(0);
    expect(spread, "spread on every swing — not a 15% roll").toBeLessThan(200);
  });

  it("...and the copy is sterile, so it cannot compound", () => {
    // The whole reason this is safe. A copy that could spread would turn a 15%
    // roll into a board full of Weeds — the runaway this set has fixed twice.
    const max = getDef("leaf_weeds").onHitSpawn!.max;
    let checked = 0;
    for (let seed = 0; seed < 200 && checked === 0; seed++) {
      const { s, w } = weedsSwing(seed);
      const copies = boardCards(s, "P1").filter((c) => c.instanceId !== w.instanceId);
      if (!copies.length) continue;
      checked++;
      for (const c of copies) expect(c.spawnedOnHit, "a copy was born fertile").toBe(max);
    }
    expect(checked, "no seed in 200 produced a copy to inspect").toBe(1);
  });

  it("...and one Weeds can never put up more than its cap, however long it swings", () => {
    const max = getDef("leaf_weeds").onHitSpawn!.max;
    for (const seed of [0, 7, 42, 123]) {
      const s = prepState();
      s.rngState = seed;
      const w = place(s, "leaf_weeds", "P1", 3, 0);
      const foe = place(s, "dusk_gool", "P2", 2, 0, { curHp: 9999, maxHp: 9999, curShields: 0 });
      for (let i = 0; i < 60; i++) {
        s.cards[w.instanceId].struckThisRound = {};
        basicAttack(s, w.instanceId, foe.instanceId);
      }
      expect(s.cards[w.instanceId].spawnedOnHit ?? 0, `seed ${seed}`).toBeLessThanOrEqual(max);
      // The original plus at most `max` copies, and nothing the copies added.
      expect(boardCards(s, "P1").length, `seed ${seed} board`).toBeLessThanOrEqual(1 + max);
    }
  });

  it("Twister (Spindrift): the second hit STUNs for 1 round, not 2", () => {
    // Both of Spindrift's hits land on the one target here, so the rider fires
    // on its own volley. At duration 2 the victim lost this round's action AND
    // next round's; at 1 it loses only the action it still had this round.
    const s = prepState();
    const spin = place(s, "gale_klouy", "P1", 2, 0);
    const victim = place(s, "dusk_reaper", "P2", 2, 1, { curHp: 40, curShields: 0 });
    basicAttack(s, spin.instanceId, victim.instanceId);
    const stun = s.cards[victim.instanceId].statuses.find((x) => x.kind === "STUN");
    expect(stun).toBeDefined();
    expect(stun!.duration).toBe(1);
    // Cleanup ends it, so it never reaches the following round's battle.
    const next = advance(atCleanup(s));
    expect(next.cards[victim.instanceId].statuses.some((x) => x.kind === "STUN")).toBe(false);
  });

  it("Midnight Shade: a fallen DUSK card thickens the shadows over its DUSK allies", () => {
    const s = prepState();
    const killer = place(s, "gale_duster", "P1", 2, 0, { curHp: 20 });
    const ally = place(s, "dusk_reaper", "P2", 1, 1);
    const vamp = place(s, "dusk_vamp", "P2", 2, 1, { curHp: 1 });
    expect(shadeDodgePct(s, ally)).toBe(0); // nothing has fallen yet
    basicAttack(s, killer.instanceId, vamp.instanceId);
    expect(s.players.P2.shadeStacks).toBe(1);
    expect(shadeDodgePct(s, s.cards[ally.instanceId])).toBe(DUSK_SHADE_PCT);
  });

  it("...stacking per death, and no further than the cap", () => {
    const s = prepState();
    const ally = place(s, "dusk_reaper", "P2", 1, 1);
    // More corpses than the cap allows — DUSK can genuinely field this many.
    for (let i = 0; i < DUSK_SHADE_MAX_STACKS + 3; i++) {
      const body = place(s, "dusk_vamp", "P2", 2, 1, { curHp: 1 });
      defeatCard(s, body, "test");
    }
    expect(s.players.P2.shadeStacks).toBe(DUSK_SHADE_MAX_STACKS);
    expect(shadeDodgePct(s, s.cards[ally.instanceId])).toBe(DUSK_SHADE_MAX_STACKS * DUSK_SHADE_PCT);
  });

  it("...only covers DUSK, and only the side that lost the card", () => {
    const s = prepState();
    const duskAlly = place(s, "dusk_reaper", "P2", 1, 1);
    const galeAlly = place(s, "gale_klouy", "P2", 1, 2); // same owner, wrong element
    const enemyDusk = place(s, "dusk_reaper", "P1", 3, 1); // right element, wrong side
    defeatCard(s, place(s, "dusk_vamp", "P2", 2, 1, { curHp: 1 }), "test");
    expect(shadeDodgePct(s, duskAlly)).toBe(DUSK_SHADE_PCT);
    expect(shadeDodgePct(s, galeAlly)).toBe(0);
    expect(shadeDodgePct(s, enemyDusk)).toBe(0);
  });

  it("...lifts after its one round", () => {
    const s = prepState();
    const ally = place(s, "dusk_reaper", "P2", 1, 1);
    defeatCard(s, place(s, "dusk_vamp", "P2", 2, 1, { curHp: 1 }), "test");
    const fell = s.round;
    // Cover holds for the rest of the round the card fell in...
    expect(shadeDodgePct(s, ally)).toBe(DUSK_SHADE_PCT);
    const next = advance(atCleanup(s));
    expect(next.round).toBe(fell + 1);
    // ...and through the whole round after it — that is the round a player gets.
    expect(shadeDodgePct(next, next.cards[ally.instanceId])).toBe(DUSK_SHADE_PCT);
    const after = advance(atCleanup(next));
    expect(shadeDodgePct(after, after.cards[ally.instanceId])).toBe(0);
  });

  it("...and a death rounds later counts alone, not on top of the lapsed ones", () => {
    // The read guard hides a lapsed stack, but the COUNT has to be cleared too:
    // otherwise a card lost in round 2 is still on the tally in round 9, and one
    // fresh corpse would draw the cover that two are supposed to.
    const s = prepState();
    const ally = place(s, "dusk_reaper", "P2", 1, 1);
    defeatCard(s, place(s, "dusk_vamp", "P2", 2, 1, { curHp: 1 }), "test");
    expect(s.players.P2.shadeStacks).toBe(1);
    const lapsed = advance(atCleanup(advance(atCleanup(s))));
    expect(lapsed.players.P2.shadeStacks ?? 0).toBe(0);
    defeatCard(lapsed, place(lapsed, "dusk_vamp", "P2", 2, 1, { curHp: 1 }), "test");
    expect(lapsed.players.P2.shadeStacks).toBe(1);
    expect(shadeDodgePct(lapsed, lapsed.cards[ally.instanceId])).toBe(DUSK_SHADE_PCT);
  });

  it("...and the shadows actually eat hits, but only for shaded cards", () => {
    // pctChance is a 25% roll at full stacks, so no single seed proves it. Sweep
    // a fixed seed range instead: with no stacks the count must be exactly zero,
    // and with stacks it must be neither zero nor everything.
    const runs = (stacks: number) => {
      let dodges = 0;
      for (let seed = 0; seed < 200; seed++) {
        const s = prepState();
        s.rngState = seed;
        s.players.P2.shadeStacks = stacks;
        s.players.P2.shadeUntilRound = s.round + 1;
        const attacker = place(s, "gale_duster", "P1", 2, 0);
        const target = place(s, "dusk_reaper", "P2", 2, 1, { curHp: 40, curShields: 0 });
        basicAttack(s, attacker.instanceId, target.instanceId);
        if (s.log.some((l) => l.includes("melts into the shadows"))) dodges++;
      }
      return dodges;
    };
    expect(runs(0)).toBe(0);
    const shaded = runs(DUSK_SHADE_MAX_STACKS);
    expect(shaded).toBeGreaterThan(0);
    expect(shaded).toBeLessThan(200);
  });

  it("Awakening (DAWN): summoning strikes the nearest enemy for a share of its DMG", () => {
    const s = prepState();
    s.players.P1.gold = 5;
    const foe = place(s, "dusk_gool", "P2", 2, 0, { curHp: 15 });
    const handId = giveHand(s, "P1", "dawn_solstice"); // DMG 5
    const next = applyIntent(s, { type: "SUMMON", player: "P1", handId, col: 0 });
    // 5 printed, cut to DAWN_STRIKE_PCT and floored, THEN the DAWN->DUSK matchup
    // bonus (x1.25, floored). The strike is a real attack and takes the matchup
    // like one. DERIVED rather than written out, because the dial moves: it was
    // a flat 100% until DAWN measured 61.0/68.7 and ran away with both boards.
    const struck = Math.floor(Math.floor((5 * DAWN_STRIKE_PCT) / 100) * 1.25);
    expect(next.cards[foe.instanceId].curHp).toBe(15 - struck);
  });

  it("Flow Change (AQUA): a human summon defers the choice; Liquid grants +2 DMG for good", () => {
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
    // The SUMMON pick is PERMANENT — it banks into `dmgBonus` rather than riding
    // the `buffs` array that Cleanup ticks down. Asserting the STORAGE and not
    // just the effective number is the point: a 3-round buff shows the same
    // effectiveDmg on the round it is granted, so `dmgBonus` is what tells the
    // permanent version apart from the timed one it replaced.
    const c = picked.cards[fin.instanceId];
    expect(c.dmgBonus, "banked, not timed").toBe(2);
    expect(c.buffs.some((b) => b.dmg === 2), "and not on the expiry list").toBe(false);
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

  it("Electrify (BOLT): +1 DMG vs a statused opponent", () => {
    const withStatus = prepState();
    const zap = place(withStatus, "bolt_zap", "P1", 3, 0); // DMG 5, home row (no KotH)
    const t = place(withStatus, "dusk_gool", "P2", 3, 1, {
      curHp: 20,
      status: { kind: "ROOT", duration: 2, power: 0, source: "LEAF" },
    });
    basicAttack(withStatus, zap.instanceId, t.instanceId);
    expect(withStatus.cards[t.instanceId].curHp).toBe(14); // 20 − 6 (5 + Electrify 1)

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
    // Both the gold and the expected HP come from the card, not from numbers
    // typed here: this test asserts the SCALING, and pinning Radiance's printed
    // 17 meant a re-cost broke it while the passive it covers was untouched.
    const def = getDef("dawn_radiance");
    const s = prepState();
    s.players.P1.gold = def.cost + 1;
    place(s, "leaf_squanch", "P2", 0, 0, { maxHp: 23 }); // strongest foe: 23 max HP
    const handId = giveHand(s, "P1", "dawn_radiance");
    const next = applyIntent(s, { type: "SUMMON", player: "P1", handId, col: 0 });
    const rad = Object.values(next.cards).find((c) => c.defId === "dawn_radiance")!;
    const step = Math.floor(23 / def.summonScaleFromEnemy!.per); // 23 max HP / per 7 = 3
    expect(step, "the foe is big enough for the passive to have something to do").toBe(3);
    expect(rad.maxHp).toBe(def.hp + step);
    expect(rad.dmgBonus).toBe(step);
  });
});

describe("element-aura telegraphs (fx counters)", () => {
  it("DAWN's Awakening bumps fxLunge on the card that strikes", () => {
    // Fires on SUMMON, outside any battle turn — without a counter the victim
    // just loses HP with nothing on screen to explain it.
    const s = prepState();
    s.players.P1.gold = 9;
    const foe = place(s, "dusk_gool", "P2", 2, 0, { curHp: 40, maxHp: 40, curShields: 0 });
    const handId = giveHand(s, "P1", "dawn_musk_ox"); // DAWN, 5 DMG
    const next = applyIntent(s, { type: "SUMMON", player: "P1", handId, col: 0 });
    const summoned = boardCards(next, "P1").find((c) => c.defId === "dawn_musk_ox")!;
    // 5 printed, cut to DAWN_STRIKE_PCT, then +25% into DUSK. It really struck.
    const struck = Math.floor(Math.floor((5 * DAWN_STRIKE_PCT) / 100) * 1.25);
    expect(next.cards[foe.instanceId].curHp).toBe(40 - struck);
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

describe("Sphere — a 2-DMG PEN Tank", () => {
  it("PEN carries its basic past shields, which is most of what it has", () => {
    // The whole case for a 2-DMG attacker: shields never blunt it. A 4-shield
    // body takes the full printed number, where an unpierced 2 would land 0.
    const s = prepState();
    const sphere = place(s, "dawn_sphere", "P1", 3, 0, { autoMode: "manual" });
    const plated = place(s, "dusk_gool", "P2", 2, 0, { curHp: 40, maxHp: 40, curShields: 4 });
    basicAttack(s, sphere.instanceId, plated.instanceId);
    const printed = getDef("dawn_sphere").dmg;
    // +25% into DUSK (Daybreak) is the only matchup DAWN has.
    expect(40 - s.cards[plated.instanceId].curHp).toBe(Math.floor(printed * 1.25));
    expect(s.cards[plated.instanceId].curShields, "PEN never strips plate either").toBe(4);
  });

  it("…but BLOCK 2 now blanks it outright, where 4 DMG used to punch through", () => {
    // Worth pinning rather than discovering. BLOCK is a flat reduction taken
    // BEFORE shields and it applies even to PEN, so at a printed 2 an armoured
    // body with BLOCK 2 takes literally nothing. At the old printed 4 the same
    // card took 2. Dropping the DMG did not halve this matchup, it ended it.
    const s = prepState();
    const sphere = place(s, "dawn_sphere", "P1", 3, 0, { autoMode: "manual" });
    const armour = place(s, "bore_armadillo", "P2", 2, 0, {
      curHp: 40, maxHp: 40, curShields: 0, // shields off: BLOCK alone under test
    }); // BLOCK 2
    basicAttack(s, sphere.instanceId, armour.instanceId);
    expect(40 - s.cards[armour.instanceId].curHp).toBe(0);
  });

  it("its DAWN Awakening strike on summon is a share of the PRINTED DMG", () => {
    // Awakening reads printed DMG, not dmg x hits. Measured against a NON-DUSK
    // foe on purpose: Daybreak's +25% is DAWN's only matchup, and including it
    // would make this test assert the matchup table as much as the strike.
    //
    // Sphere is the sharpest case for the FLOOR, which is why it earns its own
    // test: at 2 printed DMG on a 75% dial it strikes for 1, so the cheapest
    // DAWN bodies pay proportionally more of the cut than the big ones do.
    const s = prepState();
    s.players.P1.gold = 6;
    const foe = place(s, "bore_clubber", "P2", 2, 0, { curHp: 40, maxHp: 40, curShields: 0 });
    const handId = giveHand(s, "P1", "dawn_sphere");
    const next = applyIntent(s, { type: "SUMMON", player: "P1", handId, col: 0 });
    expect(40 - next.cards[foe.instanceId].curHp)
      .toBe(Math.floor((getDef("dawn_sphere").dmg * DAWN_STRIKE_PCT) / 100));
  });

  it("lands behind its own 2-shield barrier", () => {
    const s = prepState();
    s.players.P1.gold = 6;
    place(s, "bore_clubber", "P2", 2, 0, { curHp: 40, maxHp: 40 });
    const handId = giveHand(s, "P1", "dawn_sphere");
    const next = applyIntent(s, { type: "SUMMON", player: "P1", handId, col: 0 });
    const sphere = boardCards(next, "P1").find((c) => c.defId === "dawn_sphere")!;
    expect(getDef("dawn_sphere").shields, "the barrier is off-curve — printed shields stay 0").toBe(0);
    expect(sphere.curShields).toBe(2);
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

  /** The eruption is 5 PLUS whatever Magmadon's damage has gained over its
   *  printed 7 — so the expected number is derived, not typed. Written flat as
   *  `35` this test broke the moment the blast started scaling, for the mundane
   *  reason that row 2 is a mid row and King of the Hill was quietly adding a
   *  point. Deriving it measures the eruption; hardcoding it measured the board
   *  the test happened to set up. */
  function blast(s: GameState, mag: { instanceId: string }): number {
    return 5 + Math.max(0, effectiveDmg(s, s.cards[mag.instanceId]) - getDef("pyro_magmadon").dmg);
  }

  it("the opening blast catches everything it can reach", () => {
    const { s, mag, beside, diagBack, farAhead } = surrounded();
    const hit = blast(s, mag);
    expect(hit, "the hill is stoking it").toBeGreaterThan(5);
    const next = applyIntent(battleWith(s, mag.instanceId), {
      type: "BATTLE_ACTION", player: "P1", action: "special", targetId: mag.instanceId,
    });
    expect(next.cards[beside.instanceId].curHp, "beside it").toBe(40 - hit);
    expect(next.cards[diagBack.instanceId].curHp, "diagonally behind").toBe(40 - hit);
    expect(next.cards[farAhead.instanceId].curHp, "row ahead but out of reach").toBe(40);
  });

  it("and so does every round it keeps burning", () => {
    const { s, mag, beside } = surrounded();
    const lit = applyIntent(battleWith(s, mag.instanceId), {
      type: "BATTLE_ACTION", player: "P1", action: "special", targetId: mag.instanceId,
    });
    expect(lit.cards[mag.instanceId].channelOn).toBe(true);
    const after = advance(atCleanup(lit));
    expect(after.cards[beside.instanceId].curHp).toBeLessThan(40 - blast(lit, mag));
  });

  it("Scorched Fury feeds the eruption it is bleeding to sustain", () => {
    // The point of the change. A channel that erupted for a flat 5 ignored every
    // point of damage Magmadon had paid HP to buy — the passive and the Special
    // it sustains ran on separate books.
    //
    // Measured as two real Cleanups rather than against a pre-tick reading of
    // blast(): selfBurnForDmg resolves BEFORE the channel in the same tick, so
    // the eruption already carries that round's +2 by the time it fires, and a
    // number computed beforehand is short by exactly that.
    const tickDealt = (startHp?: number) => {
      const { s, mag, beside } = surrounded();
      const lit = applyIntent(battleWith(s, mag.instanceId), {
        type: "BATTLE_ACTION", player: "P1", action: "special", targetId: mag.instanceId,
      });
      if (startHp != null) lit.cards[mag.instanceId].curHp = startHp;
      const before = lit.cards[beside.instanceId].curHp;
      const after = advance(atCleanup(lit));
      return before - after.cards[beside.instanceId].curHp;
    };
    // 9 HP: under furyBelowHp's threshold of 10, so the wounded volcano adds its
    // +2 on top of the round buff both cases get.
    expect(tickDealt(9) - tickDealt()).toBe(2);
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
    // A CLOCK counts as a printed schedule, and a stricter one. Void Tower
    // bosses cannot cast by hand at all (`canFireSpecial` refuses them), so
    // `fireSpecialEveryN` is not "a cooldown they might beat" — it is exactly
    // how often the Special can ever land. Held to Kraken's printed 3, so the
    // exemption cannot be used to smuggle in a faster board-wide nuke.
    const CLOCK_FLOOR = 3;
    const offenders = CARDS.filter((d) => {
      if (d.rarity !== "mythic" || !d.special || EXEMPT.has(d.id)) return false;
      const p = d.special.params ?? {};
      const boardWideNuke = Number(p.targets ?? 0) >= 99 && Number(p.dmg ?? 0) > 0;
      if (!boardWideNuke) return false;
      const clock = d.roundTick?.fireSpecialEveryN ?? 0;
      if (clock >= CLOCK_FLOOR) return false;
      return d.special.cooldown == null;
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
    // The face is a RARE as well — the card prints its tier, so a Butler stamped
    // LEGEND reads correctly to anyone looking and the disguise is only skin
    // deep. Belt and braces: it would not announce at either rarity.
    expect(getDef("dusk_butler").rarity).toBe("rare");
    expect(getDef("dusk_nightfang").rarity, "the true form keeps its own").toBe("legendary");
  });

  it("but an ordinary legendary still gets its moment", () => {
    expect(announces("dusk_skullking")).toBe(true);
    expect(announces("dusk_gool"), "and a rare still does not").toBe(false);
  });
});

describe("the disguise holds in the shared battle log too", () => {
  it("the summon line never names the true form", () => {
    // The log is read by BOTH players, so naming Nightfang here undoes the
    // disguise entirely — which is exactly what it did until an in-game test
    // caught it: the board showed a Butler while the log said
    // "P1 summons Nightfang (cost 8) into column 2."
    const s = prepState();
    s.players.P1.gold = 20;
    s.prep = { priority: "P1", consecutivePasses: 0, movedThisTurn: false };
    const handId = giveHand(s, "P1", "dusk_nightfang");
    const next = applyIntent(s, { type: "SUMMON", player: "P1", handId, col: 0 });
    const log = next.log.join("\n");
    expect(log.includes("Nightfang"), "the log gave the disguise away").toBe(false);
    expect(log).toContain("summons The Butler");
    // The cost is honest: you paid 8 and the log says so.
    expect(log).toContain("cost 8");
  });
});

describe("Rubyscale opens a wound", () => {
  it("its basic applies BLEED 2 for 2 rounds", () => {
    const s = prepState();
    const ruby = place(s, "leaf_rubyo", "P1", 2, 0);
    const foe = place(s, "dusk_gool", "P2", 2, 1, { curHp: 40, maxHp: 40, curShields: 0 });
    basicAttack(s, ruby.instanceId, foe.instanceId);
    const bleed = statusOf(s.cards[foe.instanceId], "BLEED");
    expect(bleed?.power).toBe(2);
    expect(bleed?.duration).toBe(2);
  });

  it("and still plants a Greegon on arrival", () => {
    const s = prepState();
    s.players.P1.gold = 20;
    s.prep = { priority: "P1", consecutivePasses: 0, movedThisTurn: false };
    const handId = giveHand(s, "P1", "leaf_rubyo");
    const next = applyIntent(s, { type: "SUMMON", player: "P1", handId, col: 0 });
    expect(boardCards(next, "P1").some((c) => c.defId === "leaf_greegon")).toBe(true);
  });
});

describe("the fog mechanic, and the two very differently priced cards that lay it", () => {
  /** N swings at a fogged card, returning how much damage actually landed.
   *  Gool is the control attacker: 4 DMG, one hit, and with no miss source on
   *  the board it lands all 4 on every seed (asserted below), so any shortfall
   *  here is the fog and only the fog. */
  function dealt(trials: number, pct: number | undefined, rounds = 1): number {
    let total = 0;
    for (let seed = 0; seed < trials; seed++) {
      const s = prepState();
      // Attacker OFF the hill: row 2 is a Mid row and King of the Hill would
      // quietly make every swing a 5, which is how the first draft of this test
      // failed. Row 3 is the same geometry the splash tests above rely on.
      const gool = place(s, "dusk_gool", "P1", 3, 0);
      const victim = place(s, "dusk_gool", "P2", 2, 0, { curHp: 40, maxHp: 40, curShields: 0 });
      s.players.P2.foggedRounds = rounds;
      if (pct != null) s.players.P2.foggedPct = pct;
      s.rngState = seed;
      basicAttack(s, gool.instanceId, victim.instanceId);
      total += 40 - s.cards[victim.instanceId].curHp;
    }
    return total;
  }

  it("Misty's Fog Settlement is a quarter, not a coin", () => {
    const clear = dealt(400, undefined, 0); // no fog at all — the control
    expect(clear, "nothing else in this setup causes a miss").toBe(400 * 4);
    const thin = 1 - dealt(400, MISTY_FOG_MISS_PCT) / clear;
    const thick = 1 - dealt(400, FOG_MISS_PCT) / clear;
    // Wide bands — this pins the MAGNITUDE each constant names, not the RNG's
    // luck on 400 draws.
    expect(thin).toBeGreaterThan(0.15);
    expect(thin).toBeLessThan(0.35);
    expect(thick).toBeGreaterThan(0.40);
    expect(thick).toBeLessThan(0.60);
    expect(thin).toBeLessThan(thick);
  });

  it("Misty lays the thin one; Aftermath's paid Smog still lays the coin", () => {
    // The reason the rate lives on the player rather than in the roll: these two
    // buy the same mechanic at wildly different prices — a cost-1 body that fogs
    // free on arrival, against a cost-4 Special off a cost-6 card.
    const s = prepState();
    s.players.P1.gold = 20;
    place(s, "dusk_gool", "P2", 0, 0); // keep P2 non-empty
    const handId = giveHand(s, "P1", "aqua_misty");
    const next = applyIntent(s, { type: "SUMMON", player: "P1", handId, col: 1 });
    expect(next.players.P1.foggedRounds).toBe(1);
    expect(next.players.P1.foggedPct).toBe(MISTY_FOG_MISS_PCT);

    const after = { ...next, players: { ...next.players } };
    const aftermath = place(after, "pyro_aftermath", "P1", 4, 3);
    SPECIAL_HANDLERS.smokeScreen(after, after.cards[aftermath.instanceId], [], { rounds: 2 });
    expect(after.players.P1.foggedPct, "a paid Smog never inherits Misty's thin fog").toBe(FOG_MISS_PCT);
    expect(after.players.P1.foggedRounds).toBe(2);
  });
});

describe("Sunbanner's Flash Squad", () => {
  /** Sunbanner mid-board with an ally BESIDE it and an ally AHEAD of it, plus a
   *  third well behind that should never be called. P1 advances toward row 0,
   *  so "ahead" of row 3 is row 2. */
  function squad() {
    const s = prepState();
    s.players.P1.magicPool = 10;
    const banner = place(s, "dawn_commander", "P1", 3, 1, { autoMode: "manual" });
    return {
      s, banner,
      beside: place(s, "dusk_gool", "P1", 3, 2),
      ahead: place(s, "dusk_gool", "P1", 2, 1),
      behind: place(s, "dusk_gool", "P1", 4, 0),
      foe: place(s, "dusk_gool", "P2", 2, 0, { curHp: 99, maxHp: 99, curShields: 0 }),
    };
  }
  const fire = (s: GameState, id: string) =>
    applyIntent(battleWith(s, id), { type: "BATTLE_ACTION", player: "P1", action: "special", targetId: id });

  it("commands the row Sunbanner stands in as well as the row ahead", () => {
    // The scope change. Commanding only the row ahead meant the further forward
    // this Melee Tank pushed, the fewer allies were left ahead of it to
    // command — the Special did least exactly when the card was doing its job.
    const { s, banner, beside, ahead, behind, foe } = squad();
    const before = s.cards[foe.instanceId].curHp;
    // Summed per ally, not doubled: the forward one stands on a Mid row and
    // King of the Hill gives it +1, so the two do NOT hit for the same number.
    const expected = effectiveDmg(s, s.cards[beside.instanceId]) + effectiveDmg(s, s.cards[ahead.instanceId]);
    expect(effectiveDmg(s, s.cards[ahead.instanceId])).toBeGreaterThan(effectiveDmg(s, s.cards[beside.instanceId]));
    const n = fire(s, banner.instanceId);
    expect(before - n.cards[foe.instanceId].curHp, "both the ally beside and the ally ahead swung").toBe(expected);
    // …and no further. A card two rows back is not in the squad.
    expect(n.cards[behind.instanceId]).toBeDefined();
  });

  it("does not order Sunbanner itself to swing", () => {
    // It is spending its turn on the order. If the caster were included, the
    // Special would be a basic attack plus a squad command for the same magic.
    const { s, banner, foe } = squad();
    const bannerDmg = effectiveDmg(s, s.cards[banner.instanceId]);
    const before = s.cards[foe.instanceId].curHp;
    const n = fire(s, banner.instanceId);
    const dealt = before - n.cards[foe.instanceId].curHp;
    expect(dealt % bannerDmg === 0 && dealt / bannerDmg === 3).toBe(false);
    expect(dealt).toBeLessThan(3 * bannerDmg);
  });

  it("each ally picks the NEAREST foe it can reach, not the first one listed", () => {
    // Arbitrary target order matters more now the squad is twice the size, and
    // the sibling mechanic (Imperator's commandAllies) already sorts by
    // distance — two "order your army to swing" effects should aim alike.
    const s = prepState();
    s.players.P1.magicPool = 10;
    const banner = place(s, "dawn_commander", "P1", 3, 1, { autoMode: "manual" });
    const ally = place(s, "dusk_gool", "P1", 2, 3);
    // Listed first, but far from the ally; the near one is added second.
    const far = place(s, "dusk_gool", "P2", 2, 0, { curHp: 99, maxHp: 99, curShields: 0 });
    const near = place(s, "dusk_gool", "P2", 1, 3, { curHp: 99, maxHp: 99, curShields: 0 });
    const n = fire(s, banner.instanceId);
    expect(n.cards[near.instanceId].curHp, "the near foe took the shot").toBeLessThan(99);
    expect(n.cards[far.instanceId].curHp, "the far one was not chosen just for being listed first").toBe(99);
    void ally;
  });
});

describe("Saltjacks' Back-ups reaches down the whole column", () => {
  /** Summon Saltjacks into column 2 with one foe in that column at `row`, and
   *  report what the on-summon volley actually dealt. */
  function shoot(row: number): number {
    const s = prepState();
    s.players.P1.gold = 10;
    const foe = place(s, "dusk_gool", "P2", row, 2, { curHp: 40, maxHp: 40, curShields: 0 });
    const handId = giveHand(s, "P1", "aqua_buccaneers");
    const next = applyIntent(s, { type: "SUMMON", player: "P1", handId, col: 2 });
    return 40 - next.cards[foe.instanceId].curHp;
  }

  it("hits a foe standing on its own HOME row — the case that silently did nothing", () => {
    // The bug: Saltjacks summons into ITS home row, and the Home Slot rule
    // blocks a home-row card from targeting the enemy's home row. validTargets
    // came back empty, and an empty list means the on-summon gate never calls
    // the handler — so this was not a weaker shot, it was NO shot and no log
    // line. Worst in the opening, where every enemy card is on its home row by
    // definition and a cost-1 body is most likely to be played.
    expect(shoot(0)).toBe(getDef("aqua_buccaneers").dmg);
  });

  it("…and still hits everywhere else it always did", () => {
    // The fix widens what reaches the handler; it must not change these.
    expect(shoot(1)).toBe(getDef("aqua_buccaneers").dmg);
    expect(shoot(2)).toBe(getDef("aqua_buccaneers").dmg);
  });

  it("does not spray outside its column", () => {
    // `targets: 99` with the column sourced from the board is only safe because
    // barrage re-filters by column. Pinned, since the sourcing now hands it the
    // whole enemy side rather than a pre-narrowed reach list.
    const s = prepState();
    s.players.P1.gold = 10;
    const inLine = place(s, "dusk_gool", "P2", 0, 2, { curHp: 40, maxHp: 40, curShields: 0 });
    const beside = place(s, "dusk_gool", "P2", 0, 3, { curHp: 40, maxHp: 40, curShields: 0 });
    const handId = giveHand(s, "P1", "aqua_buccaneers");
    const next = applyIntent(s, { type: "SUMMON", player: "P1", handId, col: 2 });
    expect(next.cards[inLine.instanceId].curHp).toBeLessThan(40);
    expect(next.cards[beside.instanceId].curHp, "the next column over is untouched").toBe(40);
  });
});

describe("token spawns are mirror-symmetric between the seats", () => {
  /** A clean 5x5 with one spawner, returning where its tokens landed. P1's
   *  spawner sits at row 3 and P2's at row 1 — mirrored positions, so a
   *  seat-neutral spawner must put both sets on the same row. */
  function spawnFor(owner: "P1" | "P2", count: number): { row: number; col: number }[] {
    const s = prepState();
    s.boardSize = 5;
    s.slots = Array.from({ length: 5 }, () => Array.from({ length: 5 }, () => ({ capturedBy: null })));
    const sp = place(s, "leaf_trinezer", owner, owner === "P1" ? 3 : 1, 2);
    spawnTokens(s, s.cards[sp.instanceId], "leaf_reptilian_tok", count, 1);
    return boardCards(s, owner)
      .filter((c) => c.defId === "leaf_reptilian_tok")
      .map((c) => ({ row: c.pos!.row, col: c.pos!.col }))
      .sort((a, b) => a.row - b.row || a.col - b.col);
  }

  it("both sides screen FORWARD, not just the player", () => {
    // The bug: the ring search scanned dr from -ring upward, so it always
    // filled the lowest row index first. That is toward the enemy for P1 and
    // toward its own back line for P2 — the player's spawns screened forward
    // while the AI's fell in BEHIND the spawner, often onto its own summoning
    // row, clogging the slots it needed to summon into. Same card, same code,
    // opposite behaviour purely from which seat asked.
    expect(spawnFor("P1", 1)[0].row, "P1 advances toward row 0").toBe(2);
    expect(spawnFor("P2", 1)[0].row, "P2 advances toward row 4").toBe(2);
  });

  it("and land in the same shape as each other", () => {
    // Mirrored spawners, so the full three-body footprint should be identical
    // — not merely 'also forward'.
    expect(spawnFor("P2", 3)).toEqual(spawnFor("P1", 3));
  });

  it("a single token lands directly ahead rather than off to a corner", () => {
    // The forwardness sort is tie-broken by column distance, so a horde packs
    // beside its spawner instead of fanning to the ring's corners.
    for (const owner of ["P1", "P2"] as const) {
      expect(spawnFor(owner, 1)[0].col, `${owner} keeps the spawner's column`).toBe(2);
    }
  });
});

describe("Double Trouble (Twins) and Moving Forest (Elephlora)", () => {
  it("Double Trouble hits twice for 4 and raises the CEILING, not just the pool", () => {
    // selfMaxHp is not a heal: it lifts maxHp AND curHp together, so it works
    // at full health where healSelf did nothing. That matters on this card
    // specifically — Rager Twins switches OFF below 12 HP, so a bigger pool
    // moves the floor it must not fall through rather than climbing back to it.
    const s = prepState();
    s.players.P1.magicPool = 10;
    const twins = place(s, "pyro_twins", "P1", 3, 0, { autoMode: "manual" });
    const foe = place(s, "dusk_gool", "P2", 2, 0, { curHp: 99, maxHp: 99, curShields: 0 });
    const maxBefore = s.cards[twins.instanceId].maxHp;
    const hpBefore = s.cards[twins.instanceId].curHp;
    expect(hpBefore, "at FULL health, so a heal would be wasted here").toBe(maxBefore);

    const n = applyIntent(battleWith(s, twins.instanceId), {
      type: "BATTLE_ACTION", player: "P1", action: "special", targetId: foe.instanceId,
    });
    const p = getDef("pyro_twins").special!.params!;
    expect(99 - n.cards[foe.instanceId].curHp).toBe(Number(p.dmg) * Number(p.hits));
    expect(n.cards[twins.instanceId].maxHp - maxBefore).toBe(Number(p.selfMaxHp));
    expect(n.cards[twins.instanceId].curHp - hpBefore).toBe(Number(p.selfMaxHp));
  });

  it("…and the max-HP gain STACKS with every cast — it has no lifetime cap", () => {
    // Pinned deliberately rather than left implicit. selfMaxHp does not go
    // through cappedSelfGrowth (only selfDmg does) and this Special declares no
    // `maxStacks`, so on the default 2-round cooldown the gain repeats for as
    // long as the game runs. The one other permanently-stacking Special in the
    // pool pairs selfMaxHp with `maxStacks: 3`. If that limit is ever wanted
    // here, this test is where the change will show up.
    const s = prepState();
    s.players.P1.magicPool = 30;
    const twins = place(s, "pyro_twins", "P1", 3, 0, { autoMode: "manual" });
    const foe = place(s, "dusk_gool", "P2", 2, 0, { curHp: 999, maxHp: 999, curShields: 0 });
    const gain = Number(getDef("pyro_twins").special!.params!.selfMaxHp);
    let cur = s;
    for (let i = 0; i < 3; i++) {
      cur = applyIntent(battleWith(cur, twins.instanceId), {
        type: "BATTLE_ACTION", player: "P1", action: "special", targetId: foe.instanceId,
      });
      cur.cards[twins.instanceId].specialCooldown = 0; // skip the wait, not the rule
    }
    expect(cur.cards[twins.instanceId].maxHp).toBe(getDef("pyro_twins").hp + 3 * gain);
    expect(getDef("pyro_twins").special!.params!.maxStacks, "no lifetime cap declared").toBeUndefined();
  });

  it("Moving Forest drops 2 damage and 2 healing a round", () => {
    // Down from 3/3. It is unconditional, needs no target, no magic and no
    // cooldown, and fires every round off a cost-3 body — free value that
    // compounds with how long the card lives, which Root Growth is built to
    // extend.
    // DIFFERENCED against a control board with no Elephlora on it. The first
    // draft asserted the healing directly and read 6 for a printed 2, because
    // LEAF's own Photosynthesis aura tops the same wounded ally up in the same
    // Cleanup. Subtracting a control measures Moving Forest; a raw reading
    // measures every LEAF heal on the board at once.
    const build = (withTree: boolean) => {
      const s = prepState();
      if (withTree) place(s, "leaf_walking_tree", "P1", 3, 0);
      const hurt = place(s, "leaf_greegon", "P1", 3, 2, { curHp: 5, maxHp: 40 });
      const foe = place(s, "dusk_gool", "P2", 1, 0, { curHp: 40, maxHp: 40, curShields: 0 });
      const after = advance(atCleanup(s));
      return {
        healed: after.cards[hurt.instanceId].curHp - 5,
        dealt: 40 - after.cards[foe.instanceId].curHp,
      };
    };
    const tick = getDef("leaf_walking_tree").roundTick!;
    const withTree = build(true);
    const without = build(false);
    expect(withTree.dealt - without.dealt).toBe(tick.randomEnemyDmg);
    expect(withTree.healed - without.healed).toBe(tick.healLowestAlly);
  });
});

describe("King of Sunfall Harbor (Scallywag)", () => {
  /** Kill a 1-HP victim with Scallywag on `seed` and report what the coin paid.
   *
   *  The victim is deliberately NOT a DUSK card. Midnight Shade makes a dying
   *  DUSK body deal its full DMG back to its killer, and a landed hit strips a
   *  plate — so killing a DUSK card and winning the SHIELD side of this coin
   *  nets nothing, the recoil takes the plate straight back off. That is the
   *  two mechanics working, not a fault, but it makes DUSK useless as a probe:
   *  the first draft of this test read "the coin never pays a shield". */
  function spoils(seed: number) {
    const s = prepState(seed);
    const sc = place(s, "pyro_scully", "P1", 3, 0, { curShields: 0 });
    const prey = place(s, "bore_iron", "P2", 2, 0, { curHp: 1, maxHp: 40, curShields: 0 });
    const before = { sh: s.cards[sc.instanceId].curShields, dmg: s.cards[sc.instanceId].dmgBonus };
    basicAttack(s, sc.instanceId, prey.instanceId);
    expect(s.cards[prey.instanceId], "the victim actually died").toBeUndefined();
    return {
      shield: s.cards[sc.instanceId].curShields - before.sh,
      dmg: s.cards[sc.instanceId].dmgBonus - before.dmg,
    };
  }

  it("pays exactly one of the two, never both and never neither", () => {
    const def = getDef("pyro_scully").onKill!.coinShieldOrDmg!;
    for (let seed = 0; seed < 40; seed++) {
      const got = spoils(seed);
      const gotShield = got.shield === def.shields && got.dmg === 0;
      const gotDmg = got.dmg === def.dmg && got.shield === 0;
      expect(gotShield || gotDmg, `seed ${seed} paid ${JSON.stringify(got)}`).toBe(true);
    }
  });

  it("and both outcomes actually occur — it is a coin, not a constant", () => {
    // The failure this guards is a coin wired to one branch: every seed paying
    // the same stat would satisfy the test above completely.
    const outcomes = new Set(
      Array.from({ length: 40 }, (_, seed) => (spoils(seed).shield > 0 ? "shield" : "dmg")),
    );
    expect(outcomes, "both sides of the coin turn up over 40 kills").toEqual(new Set(["shield", "dmg"]));
  });

  it("is permanent — a second kill stacks on the first", () => {
    const s = prepState();
    const sc = place(s, "pyro_scully", "P1", 3, 0, { curShields: 0 });
    for (let i = 0; i < 2; i++) {
      const prey = place(s, "bore_iron", "P2", 2, i, { curHp: 1, maxHp: 40, curShields: 0 });
      basicAttack(s, sc.instanceId, prey.instanceId);
    }
    const c = s.cards[sc.instanceId];
    expect(c.curShields + c.dmgBonus, "two kills, two payouts").toBe(2);
  });
});

describe("Anglerfish's Lure is a bite now", () => {
  const bite = () => Number(getDef("aqua_anglerfish").onSummon!.params!.dmg);

  it("hits the CLOSEST opponent, not the first one listed", () => {
    const s = prepState();
    s.players.P1.gold = 6;
    // Far one placed first, so board order and distance order disagree.
    const far = place(s, "dusk_gool", "P2", 0, 4, { curHp: 40, maxHp: 40, curShields: 0 });
    const near = place(s, "dusk_gool", "P2", 2, 1, { curHp: 40, maxHp: 40, curShields: 0 });
    const handId = giveHand(s, "P1", "aqua_anglerfish");
    const n = applyIntent(s, { type: "SUMMON", player: "P1", handId, col: 1 });
    expect(40 - n.cards[near.instanceId].curHp).toBe(bite());
    expect(n.cards[far.instanceId].curHp, "only one target").toBe(40);
  });

  it("still fires when the only foe stands on its own HOME row", () => {
    // The Saltjacks failure, guarded up front: a summoning card lands in ITS
    // home row and the Home Slot rule blocks home-row-to-home-row targeting, so
    // a range-gated on-summon does nothing at all in the opening — which is
    // exactly when a cost-1 body gets played. `reachNearest` scans the board.
    const s = prepState();
    s.players.P1.gold = 6;
    const foe = place(s, "dusk_gool", "P2", 0, 2, { curHp: 40, maxHp: 40, curShields: 0 });
    const handId = giveHand(s, "P1", "aqua_anglerfish");
    const n = applyIntent(s, { type: "SUMMON", player: "P1", handId, col: 2 });
    expect(40 - n.cards[foe.instanceId].curHp).toBe(bite());
  });

  it("no card carries the old lure mechanic any more", () => {
    // Retired rather than deleted: `lure` is still wired end to end, so this
    // records that nothing uses it rather than asserting it is gone. If a card
    // takes it up again, this test is the place that says so.
    expect(CARDS.filter((c) => c.lure).map((c) => c.id)).toEqual([]);
  });
});

describe("Driftwraith's Perpetual Fog", () => {
  it("a kill leaves it EVASIVE for 2 rounds", () => {
    const s = prepState();
    const dw = place(s, "aqua_driftwraith", "P1", 3, 0);
    const prey = place(s, "bore_iron", "P2", 2, 0, { curHp: 1, maxHp: 40, curShields: 0 });
    expect(statusOf(s.cards[dw.instanceId], "EVASION")).toBeUndefined();
    basicAttack(s, dw.instanceId, prey.instanceId);
    expect(s.cards[prey.instanceId], "the kill actually landed").toBeUndefined();
    const ev = statusOf(s.cards[dw.instanceId], "EVASION");
    expect(ev?.duration).toBe(getDef("aqua_driftwraith").onKill!.grantEvasion);
  });

  it("cloaks itself only — the same-row STEALTH half is gone", () => {
    // It used to grant STEALTH to itself AND same-row AQUA kin. The self half
    // was nearly a no-op (Driftwraith PRINTS the STEALTH keyword permanently),
    // and the ally half is what this change gives up — asserted so that loss is
    // recorded rather than assumed.
    const s = prepState();
    const dw = place(s, "aqua_driftwraith", "P1", 3, 0);
    const kin = place(s, "aqua_spinefin", "P1", 3, 1);
    const prey = place(s, "bore_iron", "P2", 2, 0, { curHp: 1, maxHp: 40, curShields: 0 });
    basicAttack(s, dw.instanceId, prey.instanceId);
    expect(statusOf(s.cards[kin.instanceId], "EVASION"), "allies get nothing now").toBeUndefined();
    expect(statusOf(s.cards[kin.instanceId], "STEALTH"), "and no cloak either").toBeUndefined();
  });
});

describe("Skelider rides in heavier than it walks away", () => {
  it("arrives at printed HP + the mount's 10", () => {
    const s = prepState();
    s.players.P1.gold = 12;
    place(s, "dusk_gool", "P2", 0, 0); // keep P2 non-empty
    const handId = giveHand(s, "P1", "dusk_skelider");
    const next = applyIntent(s, { type: "SUMMON", player: "P1", handId, col: 1 });
    const sk = boardCards(next, "P1").find((c) => c.defId === "dusk_skelider")!;
    const def = getDef("dusk_skelider");
    const mount = def.summonSelfBuff!.hp;
    expect(mount).toBe(10);
    expect(sk.maxHp, "the horse counts toward the ceiling").toBe(def.hp + mount);
    expect(sk.curHp, "and it arrives on it, not below").toBe(def.hp + mount);
  });

  it("the mount is off-curve — the printed line alone is what the budget reads", () => {
    // Equestrian carries its 24K Stallion the same way. The formula prices the
    // rider; the horse rides free, which is why this card's printed 21 HP looks
    // low for a cost-8 legendary and plays like 31.
    const def = getDef("dusk_skelider");
    const printed = def.dmg * def.hits + def.hp + def.shields * 2 + def.sp;
    expect(printed, "same total it carried at 5 DMG / 26 HP").toBe(45);
    expect(printed + def.summonSelfBuff!.hp, "what it actually fields").toBeGreaterThan(printed);
  });
});

describe("Bird Bomb detonates rather than holding a grudge", () => {
  const blast = () => getDef("dusk_crow").onDeath!.inRangeDmg!;

  it("catches every opponent in reach, not just the killer", () => {
    const s = prepState();
    const bomb = place(s, "dusk_crow", "P1", 2, 1, { curHp: 1, curShields: 0 });
    // The killer, plus a BYSTANDER that never touched it.
    const killer = place(s, "gale_hawk", "P2", 2, 0, { curHp: 40, maxHp: 40, curShields: 0 });
    const bystander = place(s, "gale_hawk", "P2", 1, 2, { curHp: 40, maxHp: 40, curShields: 0 });
    basicAttack(s, killer.instanceId, bomb.instanceId);
    expect(s.cards[bomb.instanceId], "it died").toBeUndefined();
    expect(40 - s.cards[killer.instanceId].curHp, "killer eats the blast").toBeGreaterThanOrEqual(blast());
    expect(40 - s.cards[bystander.instanceId].curHp, "and so does the bystander").toBe(blast());
  });

  it("spares anything standing outside its reach", () => {
    // The reach rule is unchanged — king-move for a Melee body, measured from
    // the slot it fell on. What changed is WHO inside that reach is hit.
    const s = prepState();
    const bomb = place(s, "dusk_crow", "P1", 3, 0, { curHp: 1, curShields: 0 });
    const killer = place(s, "gale_hawk", "P2", 3, 1, { curHp: 40, maxHp: 40, curShields: 0 });
    const far = place(s, "gale_hawk", "P2", 0, 3, { curHp: 40, maxHp: 40, curShields: 0 });
    basicAttack(s, killer.instanceId, bomb.instanceId);
    expect(s.cards[far.instanceId].curHp, "across the board, untouched").toBe(40);
  });
});

describe("General's Spraying Thunder hits the three closest", () => {
  it("picks the nearest three anywhere on the board, not a row", () => {
    const s = prepState();
    s.players.P1.magicPool = 10;
    const gen = place(s, "bolt_general", "P1", 3, 0, { autoMode: "manual" });
    // Four foes at increasing distance, none of them in the row directly ahead
    // — the arrangement that used to make this Special hit nobody at all.
    const foes = [
      place(s, "dusk_gool", "P2", 3, 1, { curHp: 60, maxHp: 60, curShields: 0 }), // 1
      place(s, "dusk_gool", "P2", 3, 2, { curHp: 60, maxHp: 60, curShields: 0 }), // 2
      place(s, "dusk_gool", "P2", 3, 3, { curHp: 60, maxHp: 60, curShields: 0 }), // 3
      place(s, "dusk_gool", "P2", 0, 3, { curHp: 60, maxHp: 60, curShields: 0 }), // farthest
    ];
    // targetSide is "enemy", so the intent still needs an enemy pick even though
    // the handler computes its own three — the pick is the aim, not the list.
    const n = applyIntent(battleWith(s, gen.instanceId), {
      type: "BATTLE_ACTION", player: "P1", action: "special", targetId: foes[0].instanceId,
    });
    const hurt = foes.map((f) => 60 - n.cards[f.instanceId].curHp);
    expect(hurt.slice(0, 3).every((h) => h > 0), "the three nearest were struck").toBe(true);
    expect(hurt[3], "the farthest was spared").toBe(0);
  });

  it("fires with the CURRENT weapon, not the printed line", () => {
    // Power Grab cycles dmg x hits; the spray has always used whatever is
    // equipped, and that must survive the retarget.
    const s = prepState();
    s.players.P1.magicPool = 10;
    const gen = place(s, "bolt_general", "P1", 3, 0, { autoMode: "manual", weaponMode: 3 }); // ThunderRPG 10x1
    const foe = place(s, "dusk_gool", "P2", 3, 1, { curHp: 60, maxHp: 60, curShields: 0 });
    const n = applyIntent(battleWith(s, gen.instanceId), {
      type: "BATTLE_ACTION", player: "P1", action: "special", targetId: foe.instanceId,
    });
    const heavy = getDef("bolt_general").weaponModes![3];
    expect(60 - n.cards[foe.instanceId].curHp).toBeGreaterThanOrEqual(heavy.dmg);
  });
});

describe("GALE's WEAKEN kit", () => {
  it("Whirling Missile weakens the splash, not just the card it was aimed at", () => {
    // splashStatus is opt-in: every other splash in the game is damage-only, so
    // applying the rider to all of them would have re-tuned cards nobody
    // touched. Without it a board-clearing missile debuffs exactly one body.
    const s = prepState();
    s.players.P1.magicPool = 12;
    const fang = place(s, "gale_stormfang", "P1", 3, 1, { autoMode: "manual" });
    const aimed = place(s, "dusk_gool", "P2", 2, 1, { curHp: 99, maxHp: 99, curShields: 0 });
    const beside = place(s, "dusk_gool", "P2", 2, 2, { curHp: 99, maxHp: 99, curShields: 0 });
    const n = applyIntent(battleWith(s, fang.instanceId), {
      type: "BATTLE_ACTION", player: "P1", action: "special", targetId: aimed.instanceId,
    });
    expect(statusOf(n.cards[aimed.instanceId], "WEAKEN")?.duration).toBe(3);
    expect(statusOf(n.cards[beside.instanceId], "WEAKEN"), "the splash carries it").toBeTruthy();
  });

  it("Totem Pole weakens everything in reach the moment it plants", () => {
    // An SP-0 body that can never reposition — its arrival has to matter where
    // it lands, because it will never land anywhere else.
    const s = prepState();
    s.players.P1.gold = 10;
    const foe = place(s, "dusk_gool", "P2", 2, 1, { curHp: 40, maxHp: 40 });
    const handId = giveHand(s, "P1", "gale_totem_pole");
    const n = applyIntent(s, { type: "SUMMON", player: "P1", handId, col: 1 });
    expect(statusOf(n.cards[foe.instanceId], "WEAKEN")).toBeTruthy();
    expect(n.cards[foe.instanceId].curHp, "no damage — the debuff IS the arrival").toBe(40);
  });

  it("Spirit Ward plates the pole and every ally beside it — and nothing further", () => {
    // Replaced Totem Rampage, which was a fourth source of damage on a SUPPORT
    // and shared a name with the Totem's own Rampage. `nearby` is the 8 slots
    // around the pole, itself included, which is exactly the ground an SP-0
    // body that can never move is committed to.
    const s = prepState();
    s.players.P1.magicPool = 8;
    const pole = place(s, "gale_totem_pole", "P1", 3, 2, { autoMode: "manual" });
    const beside = place(s, "leaf_stickviper", "P1", 3, 1, { curHp: 5, maxHp: 20, curShields: 0 });
    const away = place(s, "leaf_stickviper", "P1", 0, 0, { curHp: 5, maxHp: 20, curShields: 0 });
    const amount = Number(getDef("gale_totem_pole").special!.params!.amount);
    const n = applyIntent(battleWith(s, pole.instanceId), {
      type: "BATTLE_ACTION", player: "P1", action: "special", targetId: beside.instanceId,
    });
    expect(n.cards[beside.instanceId].curShields, "the ally beside it").toBe(amount);
    expect(n.cards[beside.instanceId].curHp, "and healed").toBeGreaterThan(5);
    expect(n.cards[pole.instanceId].curShields, "itself, it planted the ward")
      .toBeGreaterThan(pole.curShields);
    expect(n.cards[away.instanceId].curShields, "not the far side of the board").toBe(0);
  });

  it("the element's WEAKEN stacks on a body two GALE cards both hit", () => {
    // The point of the whole kit. WEAKEN deepens rather than refreshing, so a
    // second GALE source compounds (25% -> 44%) instead of doing nothing.
    const s = prepState();
    const foe = place(s, "dusk_gool", "P2", 2, 0, { curHp: 99, maxHp: 99, curShields: 0 });
    applyStatus(s, s.cards[foe.instanceId], "WEAKEN", 2, 0, "GALE");
    const once = weakenStacks(s.cards[foe.instanceId]);
    applyStatus(s, s.cards[foe.instanceId], "WEAKEN", 2, 0, "GALE");
    expect(weakenStacks(s.cards[foe.instanceId])).toBe(once + 1);
  });
});

describe("Purple Wind Surge shoves rather than saps", () => {
  it("weakens and pushes every opponent in range, once each", () => {
    // The push rides applyDebuffRiders, which runs once per TARGET and not per
    // hit — so a 4-hit surge shoves one space, not four. Worth pinning: the
    // handler loops hits inside the target loop, and the opposite reading is
    // the obvious mistake to make when adding a rider to a multi-hit barrage.
    const s = prepState();
    s.players.P1.magicPool = 8;
    const angale = place(s, "gale_angale", "P1", 3, 1, { autoMode: "manual" });
    const a = place(s, "dusk_gool", "P2", 2, 1, { curHp: 40, maxHp: 40, curShields: 0 });
    const b = place(s, "dusk_gool", "P2", 2, 2, { curHp: 40, maxHp: 40, curShields: 0 });
    const n = applyIntent(battleWith(s, angale.instanceId), {
      type: "BATTLE_ACTION", player: "P1", action: "special", targetId: a.instanceId,
    });
    for (const foe of [a, b]) {
      expect(statusOf(n.cards[foe.instanceId], "WEAKEN"), "weakened").toBeTruthy();
      // pushBack shoves a card toward its OWN home row, and P2's is row 0 — so
      // "back" here is a LOWER row: 2 -> 1, exactly one step of it.
      expect(n.cards[foe.instanceId].pos!.row, "shoved one space, not four").toBe(1);
    }
  });

  it("no longer saps speed", () => {
    const p = getDef("gale_angale").special!.params!;
    expect(p.spDebuff, "the -SP is gone").toBeUndefined();
    expect(p.push).toBe(1);
  });
});

describe("SEAL rides the reaper and the frenzy", () => {
  it("Death's Approach seals what it cuts, so the wound cannot be healed", () => {
    // PEN puts the 7 through armour; SEAL stops it being repaired. The two
    // halves answer the two ways a target survives a sniper.
    const s = prepState();
    s.players.P1.magicPool = 6;
    const reaper = place(s, "dusk_reaper", "P1", 3, 0, { autoMode: "manual" });
    const foe = place(s, "dusk_gool", "P2", 1, 2, { curHp: 40, maxHp: 40, curShields: 6 });
    const n = applyIntent(battleWith(s, reaper.instanceId), {
      type: "BATTLE_ACTION", player: "P1", action: "special", targetId: foe.instanceId,
    });
    const hit = n.cards[foe.instanceId];
    expect(statusOf(hit, "SEAL")?.duration).toBe(2);
    expect(hit.curShields, "PEN went straight past the plate").toBe(6);
    // And the seal actually bites: healCard is the single choke-point for every
    // heal in the game and refuses outright while SEAL is up.
    expect(healCard(n, hit, 10)).toBe(0);
  });

  it("Moon Frenzy seals the whole board it drains", () => {
    // DRAIN moves HP to the caster; SEAL stops them putting it back. Draining a
    // board that can heal through it is a wash — this is what makes it stick.
    const s = prepState();
    s.players.P1.magicPool = 8;
    const caster = place(s, "dusk_scar", "P1", 3, 1, { autoMode: "manual" });
    const a = place(s, "dusk_gool", "P2", 2, 1, { curHp: 40, maxHp: 40, curShields: 0 });
    const b = place(s, "dusk_gool", "P2", 2, 2, { curHp: 40, maxHp: 40, curShields: 0 });
    const n = applyIntent(battleWith(s, caster.instanceId), {
      type: "BATTLE_ACTION", player: "P1", action: "special", targetId: a.instanceId,
    });
    for (const foe of [a, b]) {
      expect(statusOf(n.cards[foe.instanceId], "SEAL")?.duration, "every one of them").toBe(2);
      expect(healCard(n, n.cards[foe.instanceId], 10)).toBe(0);
    }
  });
});

describe("Phantom Gouge seals what it pierces", () => {
  it("both targets are sealed, and PEN still ignores their plate", () => {
    const s = prepState();
    s.players.P1.magicPool = 6;
    const ghast = place(s, "dusk_ghastly", "P1", 3, 1, { autoMode: "manual" });
    const a = place(s, "bore_iron", "P2", 2, 1, { curHp: 40, maxHp: 40, curShields: 5 });
    const b = place(s, "bore_iron", "P2", 2, 2, { curHp: 40, maxHp: 40, curShields: 5 });
    const n = applyIntent(battleWith(s, ghast.instanceId), {
      type: "BATTLE_ACTION", player: "P1", action: "special", targetIds: [a.instanceId, b.instanceId],
    });
    for (const foe of [a, b]) {
      const hit = n.cards[foe.instanceId];
      expect(statusOf(hit, "SEAL")?.duration).toBe(2);
      expect(hit.curShields, "PEN neither spends nor strips the plate").toBe(5);
      expect(healCard(n, hit, 10), "and the seal refuses the repair").toBe(0);
    }
  });
});

describe("Mark of Hoax brands and seals", () => {
  it("marks for the CRIT and seals for the rest of the match", () => {
    // The seal has to outlast a 2-round timer: the mark is a FLAG with no
    // duration — it holds until the target dies — so a short seal would expire
    // while the thing it rides was still on the card.
    const s = prepState();
    s.players.P1.magicPool = 8;
    const hoax = place(s, "dusk_hoax", "P1", 3, 1, { autoMode: "manual" });
    const foe = place(s, "dusk_gool", "P2", 1, 1, { curHp: 40, maxHp: 40, curShields: 0 });
    const n = applyIntent(battleWith(s, hoax.instanceId), {
      type: "BATTLE_ACTION", player: "P1", action: "special", targetId: foe.instanceId,
    });
    const hit = n.cards[foe.instanceId];
    expect(hit.hoaxMarked, "still branded").toBe(true);
    expect(statusOf(hit, "SEAL")?.duration).toBeGreaterThan(10);
    expect(healCard(n, hit, 12), "and it refuses every heal").toBe(0);
  });

  it("the seal is declared by the CARD, not baked into the handler", () => {
    // markTarget routes through maybeStatus now, so what a brand carries lives
    // in the card data. A later marker can carry something else without the
    // handler being taught about it.
    const p = getDef("dusk_hoax").special!.params!;
    expect(p.statusKind).toBe("SEAL");
  });
});

describe("a Talent is a cost-3 Rare's trick, and nothing else's", () => {
  // The set rule, owner's call: only a cost-3 Rare carries a Talent.
  //
  // It is a real design line rather than bookkeeping. A Talent is FREE and fires
  // once per game, so it costs nothing against the stat budget — which makes it
  // the cheapest possible way to bolt interest onto any card, and therefore the
  // one that most needs a home. Pinning it to the 3-drop Rare makes "what does
  // this 3-cost do?" a question with a real answer, and stops the mechanic
  // becoming a free rider on every rarity and every rung of the curve.
  //
  // Rares at other costs are NOT meant to be blank: they earn their texture from
  // PASSIVES, which is what passives were always for and which the budget prices
  // the same way.
  const talented = [...CARDS, ...TOKENS].filter((c) => c.talent);

  // The cards the rule does not cover. Listed rather than waived silently, so
  // the decision to keep each one stays visible and arguable.
  //
  //   gale_tumbleweed, leaf_oak, pyro_canister — three that PRE-DATE the rule.
  //   dawn_quasar — an owner's call taken AFTER it, and the first of its kind:
  //     Quasar was re-costed 3 -> 2 and keeps Starfall anyway, because the
  //     Talent is worth more on that card than the gold was. Noted apart from
  //     the other three on purpose — "it was here first" and "we decided to"
  //     are different arguments, and only the second one can be made again.
  const EXCEPTIONS = new Set(["gale_tumbleweed", "leaf_oak", "pyro_canister", "dawn_quasar"]);

  it("every Talent sits on a cost-3 Rare", () => {
    const wrong = talented
      .filter((c) => !EXCEPTIONS.has(c.id))
      .filter((c) => c.rarity !== "rare" || c.cost !== 3)
      .map((c) => `${c.id} (${c.rarity} cost ${c.cost})`);
    expect(wrong, "a Talent outside the cost-3 Rare slot").toEqual([]);
  });

  it("...and the listed exceptions are still the only ones", () => {
    // If one of them is ever re-costed onto the 3-drop or loses its Talent,
    // this fails and the list shrinks — an exception set that cannot quietly
    // grow, and cannot quietly keep a name it has stopped earning either.
    const stillWrong = [...EXCEPTIONS].filter((id) => {
      const d = CARDS.find((c) => c.id === id);
      return d && d.talent && (d.rarity !== "rare" || d.cost !== 3);
    });
    expect(stillWrong.sort()).toEqual([...EXCEPTIONS].sort());
  });

  it("a Rare that gave up its Talent did not become a blank body", () => {
    // The point of the pass was that 115 of 132 Rares had no ability at all.
    // Moving a Talent off a card must not put it back in that pile.
    const ABIL = ["onHitStatus", "onKill", "vsStatus", "onDeath", "roundTick", "onHitPush",
      "trampleDmg", "aura", "onHeavyHit", "pushImmune", "falseHead", "stealthWhenIdle",
      "evadeVsSlower", "onShieldBreak", "onOppSummon", "onSummon", "advanceOnBasic",
      "firstStrikeBonus", "critIfFaster", "onCritBonus", "deathSave", "plummet",
      "attackEveryOtherRound", "reachBonus", "revealsStealth", "onAllyHitSpawn",
      "spawnOnHitTaken"];
    const FROM_THE_PASS = ["dawn_sunspot", "dusk_grafft", "gale_goldspur", "gale_leeward",
      "bore_rhino", "leaf_forestdeer", "leaf_monkey", "pyro_komodo",
      "pyro_chopper", "aqua_bluewhale", "aqua_divebill", "dawn_ballista", "aqua_sonarping"];
    const blank = FROM_THE_PASS.filter((id) => {
      const d = getDef(id) as unknown as Record<string, unknown>;
      return !ABIL.some((k) => d[k] != null);
    });
    expect(blank, "gave up a Talent and got nothing back").toEqual([]);
  });
});



describe("a cheap Rare is never a blank body", () => {
  // A Rare below cost 3 cannot have a Talent — that slot belongs to the 3-drop —
  // so a passive is the ONLY thing it has to be interesting with. This asserts
  // every cost-1 and cost-2 Rare carries one.
  //
  // The check is INVERTED on purpose: anything outside the core stat/identity
  // fields counts as an ability. A hand-kept list of ability names silently goes
  // stale — the first version of this audit missed `onHitSpawn` and `summonFog`
  // and reported ten blank cards that were not blank at all.
  const CORE = new Set(["id", "name", "rarity", "element", "cardClass", "tribe", "attackType",
    "cost", "dmg", "hits", "hp", "sp", "shields", "keywords", "art", "lore", "passiveNames",
    "boss"]);
  // NOTE `special` and `talent` are NOT in CORE: a card carrying either is not a
  // blank body. Leaving `talent` in there made this fail on gale_tumbleweed, a
  // grandfathered cost-2 Rare whose whole point is the Talent it has.

  it("every cost-1 and cost-2 Rare has a passive, not just a keyword", () => {
    const cheap = CARDS.filter((c) => !c.boss && c.rarity === "rare" && c.cost <= 2);
    expect(cheap.length, "the band is populated").toBeGreaterThan(50);
    const bare = cheap.filter((c) => {
      const d = c as unknown as Record<string, unknown>;
      return !Object.keys(d).some((k) => !CORE.has(k) && d[k] != null);
    }).map((c) => `${c.id} (cost ${c.cost})`);
    expect(bare, "a cheap Rare with nothing but a stat line and maybe a keyword").toEqual([]);
  });
});

describe("rarity is a cost band, not a mood", () => {
  // Owner's ladder. Rare and Epic OVERLAP at 3 on purpose — that is the rung
  // where the set can offer either a cheap trick or a real Special, and it is
  // also the only rung a Talent may sit on.
  //
  //   rare 1-3 · epic 3-5 · legendary 6-8 · mythic 9-10
  //
  // Every one of these was already true across the set when it was written down;
  // the only cards ever out of band were from the forty-card pass. So this guard
  // pins a convention rather than imposing one.
  const BAND: Record<string, [number, number]> = {
    rare: [1, 3], epic: [3, 5], legendary: [6, 8], mythic: [9, 10],
  };

  it("every card's cost sits inside its rarity's band", () => {
    const out = CARDS.filter((c) => !c.boss).filter((c) => {
      const b = BAND[c.rarity ?? ""];
      return b && (c.cost < b[0] || c.cost > b[1]);
    }).map((c) => `${c.id} (${c.rarity} cost ${c.cost})`);
    expect(out, "out of band").toEqual([]);
  });

  it("the bands cover the whole curve with no gap", () => {
    // A cost with no legal rarity would be a card nobody could print.
    const costs = new Set(CARDS.filter((c) => !c.boss).map((c) => c.cost));
    for (const cost of [...costs].sort((a, b) => a - b)) {
      const legal = Object.entries(BAND).filter(([, [lo, hi]]) => cost >= lo && cost <= hi);
      expect(legal.length, `cost ${cost} has no legal rarity`).toBeGreaterThan(0);
    }
  });

  it("...and the rarity contract survives the promotion", () => {
    // Moving a card UP a band is not free: Epic and above owe a repeatable
    // Special, and a Rare may never have one. Seven cards crossed that line when
    // the bands were written down and each had to be given an ability to cross it.
    const noSpecial = CARDS.filter((c) => !c.boss
      && ["epic", "legendary", "mythic"].includes(c.rarity ?? "") && !c.special).map((c) => c.id);
    expect(noSpecial, "epic+ without a Special").toEqual([]);
    const rareSpecial = CARDS.filter((c) => !c.boss && c.rarity === "rare" && c.special)
      .map((c) => c.id);
    expect(rareSpecial, "a Rare with a repeatable Special").toEqual([]);
  });
});

describe("an ability name means one thing", () => {
  // Nothing checked this, and two names shipped twice in one pass: "Windbreak"
  // on a GALE Tank and a LEAF Support, and "Death Roll" on a BORE Warrior and a
  // PYRO Assassin. Both read as the same card in the log, the gallery and the
  // action wheel, which is exactly the confusion `state.test.ts` already refuses
  // to allow for card NAMES.
  const SHARED_ON_PURPOSE = new Map<string, string[]>([
    // One boss, two forms. Stormform keeps the move it grew out of.
    ["Thunder Run", ["boss_thunderfangs", "boss_thunderfangs_2"]],
    // Pre-dates the rule: Buzz and Surge both print Surge's signature. Listed
    // rather than silently allowed — if it was a copy-paste it is visible here.
    ["Electro Surge", ["bolt_buzz", "bolt_surge"]],
  ]);

  it("no two cards print the same Special or Talent name", () => {
    const seen = new Map<string, string[]>();
    for (const c of [...CARDS, ...TOKENS])
      for (const n of [c.special?.name, c.talent?.name])
        if (n) seen.set(n, [...(seen.get(n) ?? []), c.id]);
    const clashes = [...seen]
      .filter(([, ids]) => ids.length > 1)
      .filter(([name, ids]) => {
        const allowed = SHARED_ON_PURPOSE.get(name);
        return !allowed || [...ids].sort().join() !== [...allowed].sort().join();
      })
      .map(([name, ids]) => `"${name}" on ${ids.join(" + ")}`);
    expect(clashes, "two cards claiming one ability name").toEqual([]);
  });
});

describe("the set is even across the eight elements", () => {
  // 45 draftable cards per element, 360 in total. The forty-card pass added
  // exactly five to each, and even-ness is the invariant worth pinning — the
  // TOTAL will grow, but an element quietly drifting ahead of the others is a
  // deck-building advantage nobody chose to give it.
  //
  // "Draftable" means non-boss cards in CARDS, and it deliberately INCLUDES the
  // three token-shaped ids that live there (dawn_heir_tok, bore_kingcobra_tok,
  // dusk_monstrous_spider_tok). Filtering on the `_tok` suffix is what made an
  // earlier audit report 319 cards and call DAWN one short when it never was.
  const draftable = CARDS.filter((c) => !c.boss);

  it("every element has the same number of cards", () => {
    const ELS = ["LEAF", "PYRO", "AQUA", "DAWN", "GALE", "BOLT", "DUSK", "BORE"];
    const counts = ELS.map((e) => [e, draftable.filter((c) => c.element === e).length] as const);
    const first = counts[0][1];
    expect(Object.fromEntries(counts.filter(([, n]) => n !== first)),
      "an element has drifted ahead of the others").toEqual({});
    expect(first * ELS.length, "and the total follows from it").toBe(draftable.length);
  });

  it("every element's deck pool is the whole element", () => {
    // `deckFor` returns every non-boss card of an element, so the pools and the
    // counts above cannot disagree — this is the check that they don't.
    for (const core of CORES) {
      const own = draftable.filter((c) => c.element === core.element).length;
      expect(core.cards.length, `${core.id} pool`).toBe(own);
    }
  });
});

// A PASSIVE YOU CAN SEE FIRE.
//
// Passives are the one part of a card that happens TO the board rather than
// being played: an ability triggers, some numbers move, and the only record was
// a line in a log nobody reads mid-fight. The engine now bumps `fxPassive` and
// stamps the passive's PRINTED name, and the renderer floats it off that card —
// which answers both halves of "what just happened": what fired, and who fired.
describe("a passive flashes on the card that fired it", () => {
  it("names the passive, using the card's own wording", () => {
    const s = prepState();
    // Firefighter prints High Pressure (onHitPush) — a rider on its basic.
    const ff = place(s, "aqua_firefighter", "P1", 2, 1);
    const foe = place(s, "leaf_alpha", "P2", 1, 1);
    basicAttack(s, ff.instanceId, foe.instanceId);
    expect(s.cards[ff.instanceId].fxPassive, "nothing flashed").toBeGreaterThan(0);
    expect(s.cards[ff.instanceId].fxPassiveName)
      .toBe(getDef("aqua_firefighter").passiveNames!.onHitPush);
  });

  it("flashes on the GUARD when its zone fires, not on what walked in", () => {
    const s = prepState(42, "P2");
    const gob = place(s, "bore_rockgoblin", "P1", 3, 1); // home row — the zone's condition
    const mover = place(s, "leaf_alpha", "P2", 1, 1);
    gob.summonedThisRound = false; mover.summonedThisRound = false;
    const n = applyIntent(s, {
      type: "MOVE", player: "P2", instanceId: mover.instanceId, to: { row: 2, col: 1 },
    });
    expect(n.cards[gob.instanceId].fxPassiveName).toBe("Cave Guard");
    expect(n.cards[mover.instanceId].fxPassive ?? 0, "the victim claimed the passive").toBe(0);
  });

  it("says nothing for a passive the card never named", () => {
    // `passiveNames` is the set of abilities the cards themselves advertise, so
    // it is exactly the set worth announcing — floating a raw field name at the
    // player would be worse than silence.
    const s = prepState();
    const c = place(s, "leaf_alpha", "P1", 2, 1);
    notePassive(s, c, "somePassiveThisCardDoesNotPrint");
    expect(c.fxPassive ?? 0).toBe(0);
    expect(c.fxPassiveName).toBeUndefined();
  });
});

// PRISM'S WEAPON IS NEVER COLD.
//
// It armed 1.50 Enchantments a game and spent only 0.83 of them, while making
// 1.90 basic attacks in total (measured, forced onto the board over 48 games) —
// so it paid a whole battle action to arm a charge, swung about twice a match,
// and wasted nearly half of what it armed. A bigger bonus on a swing that never
// happens is worth nothing, so the frequency is what changed: an enchanter
// holding no charge re-arms at the top of the round, in its last chosen mode.
describe("an enchanter rekindles between rounds", () => {
  it("re-arms when it is carrying nothing", () => {
    const s = prepState();
    const p = place(s, "bore_prism", "P1", 2, 1);
    p.enchant = undefined;
    const next = advance(atCleanup(s));
    expect(next.cards[p.instanceId].enchant, "went into the round unarmed").toBeTruthy();
  });

  it("...in the mode it last CHOSE, not always Sharpen", () => {
    const s = prepState();
    const p = place(s, "bore_prism", "P1", 2, 1);
    p.enchant = undefined;
    p.lastEnchant = "burning";
    const next = advance(atCleanup(s));
    expect(next.cards[p.instanceId].enchant).toBe("burning");
  });

  it("does not overwrite a charge it is already holding", () => {
    // The round hands one BACK; it does not reset the one you picked this turn.
    const s = prepState();
    const p = place(s, "bore_prism", "P1", 2, 1);
    p.enchant = "sleeping";
    p.lastEnchant = "sharpen";
    const next = advance(atCleanup(s));
    expect(next.cards[p.instanceId].enchant).toBe("sleeping");
  });
});

describe("the doc riders that shipped as notes", () => {
  // Three cards printed an ability and modelled part of it, each carrying an
  // inline "not modeled" note. What the player read was not what the card did.
  const inBattle = (st: GameState, active: string): GameState => {
    st.phase = "battle";
    st.prep = null;
    st.battle = { queue: [active], index: 0, awaitingInput: active };
    return st;
  };

  it("Vaporizer: Sapphire pokes the weakest, then steps in front of it", () => {
    const s = prepState();
    const sapphire = place(s, "aqua_sapphire", "P1", 3, 0);
    const victim = place(s, "dusk_gool", "P2", 3, 1, { curHp: 1, maxHp: 40, curShields: 0 });
    // The prey: lowest HP of the SURVIVORS, far away, square in front of it free.
    const prey = place(s, "dusk_gool", "P2", 1, 2, { curHp: 9, maxHp: 40, curShields: 0 });
    const spBefore = effectiveSp(s, s.cards[sapphire.instanceId]);
    basicAttack(s, sapphire.instanceId, victim.instanceId);
    expect(s.cards[victim.instanceId]?.curHp ?? 0, "the kill that triggers it").toBeLessThanOrEqual(0);
    // ...the +1 SP half it already had...
    expect(effectiveSp(s, s.cards[sapphire.instanceId])).toBe(spBefore + 1);
    // ...and the two halves that were only ever a comment.
    expect(9 - s.cards[prey.instanceId].curHp, "1 DMG to the lowest-HP opponent").toBe(1);
    expect(s.cards[sapphire.instanceId].pos, "and it closes on what it marked")
      .toEqual({ row: 2, col: 2 });
  });

  it("Burning Ashes: Fenix comes back armoured, and loses the turn getting up", () => {
    const s = prepState();
    const fenix = place(s, "pyro_fenix", "P1", 3, 0, { curHp: 4, maxHp: 10, curShields: 0 });
    const killer = place(s, "dusk_gool", "P2", 3, 1, { curHp: 40, maxHp: 40 });
    basicAttack(s, killer.instanceId, fenix.instanceId);
    const back = s.cards[fenix.instanceId];
    expect(back, "it is still on the board").toBeTruthy();
    expect(back.curHp, "up at 1 HP").toBe(1);
    expect(back.curShields, "but not naked — the ash is armour").toBe(4);
    expect(statusOf(back, "SLEEP")?.duration, "and it skips the turn").toBe(1);
  });

  it("Magnitude Shift: every Quaking Comet leaves Shift heavier", () => {
    const s = prepState();
    const shift = place(s, "bore_shift", "P1", 3, 0);
    const foe = place(s, "dusk_gool", "P2", 2, 0, { curHp: 200, maxHp: 200, curShields: 0 });
    s.players.P1.magicPool = 20;
    const before = effectiveDmg(s, s.cards[shift.instanceId]);
    const next = applyIntent(inBattle(s, shift.instanceId), {
      type: "BATTLE_ACTION", player: "P1", action: "special", targetId: foe.instanceId,
    });
    expect(effectiveDmg(next, next.cards[shift.instanceId]), "+1 DMG per cast").toBe(before + 1);
  });
});
