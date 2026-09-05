import { describe, expect, it } from "vitest";
import { getDef } from "../../data/cards";
import { DAWN_STRIKE_PCT } from "../auras";
import { advance, applyIntent } from "../phases";
import { boardCards, effectiveDmg, effectiveMaxHp } from "../state";
import { canTarget } from "../rules";
import { atCleanup, place, prepState, statusOf, bigPrepState } from "./helpers";
import type { GameState } from "../types";

function battleWith(s: GameState, activeId: string): GameState {
  s.phase = "battle";
  s.prep = null;
  s.battle = { queue: [activeId], index: 0, awaitingInput: activeId };
  return s;
}
const fire = (s: GameState, id: string, targetId?: string) =>
  applyIntent(battleWith(s, id), { type: "BATTLE_ACTION", player: "P1", action: "special", targetId });

describe("Bluejay", () => {
  it("Gustarrows shoots an opponent the moment it is summoned", () => {
    const s = prepState(1, "P2");
    place(s, "gale_bluejay", "P1", 2, 0); // off its own home row — see the Home Slot rule
    s.players.P2.gold = 20;
    s.players.P2.hand = [{ handId: "h99", defId: "leaf_greegon" }];
    const next = applyIntent(s, { type: "SUMMON", player: "P2", handId: "h99", col: 0 });
    const newcomer = boardCards(next, "P2").find((c) => c.defId === "leaf_greegon")!;
    // Compared against the DEF's stats, not a literal. This used to say 15, which
    // was Greegon's max HP written out by hand — so re-cutting an unrelated LEAF
    // card failed a Bluejay test. Measured across the whole health pool, HP plus
    // shields, so it stays honest no matter which half the damage comes out of:
    // a LEAF arrival-armour aura was trialled here and would have absorbed this
    // arrow entirely, leaving curHp untouched at full.
    const greegon = getDef("leaf_greegon");
    expect(newcomer.curHp + newcomer.curShields).toBeLessThan(greegon.hp + greegon.shields);
  });

  it("Twin Wind Strikes DOUBLE-tapped: 14 DMG, WEAKEN, and a 4-space shove", () => {
    // A 5x5, because a push now travels away from the JAY rather than toward the
    // victim's home row, and a genuine 4-space run needs board to run across.
    const s = bigPrepState();
    s.players.P1.magicPool = 9;
    const jay = place(s, "gale_bluejay", "P1", 2, 0);
    const foe = place(s, "leaf_greegon", "P2", 2, 1, { curHp: 40, maxHp: 40, curShields: 0 });
    // Both strikes onto one target — the focus play.
    const next = applyIntent(battleWith(s, jay.instanceId), {
      type: "BATTLE_ACTION", player: "P1", action: "special", targetIds: [foe.instanceId, foe.instanceId],
    });
    const hit = next.cards[foe.instanceId];
    expect(hit.curHp).toBe(40 - 14); // 7 + 7
    expect(statusOf(hit, "WEAKEN")).toBeTruthy();
    // The push rides EACH strike, so focusing shoves 2 twice — due east, away
    // from the jay, until the wall stops it. Not even five squares is enough
    // board to show all four, which is the honest shape of this Special: focus
    // outruns split and then runs out of map.
    expect(hit.pos!.row, "shoved along the row it was hit down").toBe(2);
    expect(hit.pos!.col, "driven into the east wall").toBe(s.boardSize - 1);
  });

  it("...or SPLIT across two foes: 7 and a 2-space shove to each", () => {
    // The two ways to aim this are now genuinely different rather than one
    // simply larger: SPLIT moves two separate bodies back 2, FOCUS moves one
    // back 4 — which can put a card out of its own reach entirely.
    const s = bigPrepState();
    s.players.P1.magicPool = 9;
    const jay = place(s, "gale_bluejay", "P1", 2, 0);
    // Placed on separate rows: two bodies in a line down the push would have the
    // near one shoved into the far one and stopped, which is a true fact about
    // pushes and a poor way to measure the shove.
    const a = place(s, "leaf_greegon", "P2", 2, 1, { curHp: 40, maxHp: 40, curShields: 0 });
    const b = place(s, "leaf_greegon", "P2", 0, 1, { curHp: 40, maxHp: 40, curShields: 0 });
    const next = applyIntent(battleWith(s, jay.instanceId), {
      type: "BATTLE_ACTION", player: "P1", action: "special", targetIds: [a.instanceId, b.instanceId],
    });
    expect(next.cards[a.instanceId].curHp).toBe(40 - 7);
    expect(next.cards[b.instanceId].curHp).toBe(40 - 7);
    // One strike each, so one 2-space shove each — both away from the jay, and
    // both a full two squares rather than the focus play's run to the wall.
    expect(next.cards[a.instanceId].pos, "driven due east").toEqual({ row: 2, col: 3 });
    // `b` is up and to the side, so the shove leaves on the diagonal and then
    // slides along the one axis the board still allows.
    expect(next.cards[b.instanceId].pos, "shoved out and around").toEqual({ row: 0, col: 3 });
  });
});

describe("Drakonbane", () => {
  it("Dragon's Bane adds +2 to BASICS by MAX HP, wounded or not", () => {
    // effectiveDmg is target-independent, so this has to be measured through a
    // real attack rather than read off the attacker.
    //
    // The rule reads MAX HP, inclusively. It used to read CURRENT, and the
    // wounded giant below is exactly the case that changed: at 10 of 30 it was
    // spared, which meant the counter-play to a bane hunter was to let it hit
    // the giant once. A hunter that stops working on a bleeding target is a
    // strange kind of hunter.
    const s = prepState();
    const dk = place(s, "dawn_drakonbane", "P1", 3, 0);
    const big = place(s, "leaf_greegon", "P2", 2, 0, { curHp: 30, maxHp: 30, curShields: 0 });
    // 20 of 30: under the OLD current-HP rule this was below the line and got
    // no bonus; under the new one its maximum keeps it bane-worthy. High enough
    // to survive the 11 and be measured.
    const wounded = place(s, "leaf_greegon", "P2", 2, 1, { curHp: 20, maxHp: 30, curShields: 0 });
    const hit = (id: string) => applyIntent(battleWith(s, dk.instanceId), {
      type: "BATTLE_ACTION", player: "P1", action: "basic", targetId: id,
    });
    expect(30 - hit(big.instanceId).cards[big.instanceId].curHp).toBe(11); // 9 + 2
    expect(20 - hit(wounded.instanceId).cards[wounded.instanceId].curHp, "still bane-worthy at 20/30")
      .toBe(11);
  });

  it("Dragon's Bane spares a genuinely small body", () => {
    // The negative case has to be small by MAX HP now, not merely hurt. 25 is
    // inclusive, so this checks the card one under the line.
    const s = prepState();
    const dk = place(s, "dawn_drakonbane", "P1", 3, 0);
    const small = place(s, "leaf_greegon", "P2", 2, 0, { curHp: 24, maxHp: 24, curShields: 0 });
    const after = applyIntent(battleWith(s, dk.instanceId), {
      type: "BATTLE_ACTION", player: "P1", action: "basic", targetId: small.instanceId,
    });
    expect(24 - after.cards[small.instanceId].curHp).toBe(9); // base, no bonus
  });

  it("Sunlight Strike is 14 into a Dragon and 10 into anything else", () => {
    const dragon = prepState();
    dragon.players.P1.magicPool = 9;
    const a = place(dragon, "dawn_drakonbane", "P1", 3, 0);
    const drg = place(dragon, "pyro_pyrogon", "P2", 2, 0, { curHp: 60, maxHp: 60, curShields: 0 });
    expect(60 - fire(dragon, a.instanceId, drg.instanceId).cards[drg.instanceId].curHp).toBe(14);

    const plain = prepState();
    plain.players.P1.magicPool = 9;
    const b = place(plain, "dawn_drakonbane", "P1", 3, 0);
    const foe = place(plain, "leaf_greegon", "P2", 2, 0, { curHp: 20, maxHp: 20, curShields: 0 });
    expect(20 - fire(plain, b.instanceId, foe.instanceId).cards[foe.instanceId].curHp).toBe(10);
  });

  // THE DRAGONS FLY NOW, and Drakonbane is Melee. Without `antiAir` on Sunlight
  // Strike the game's dedicated dragon-slayer cannot target the two biggest
  // Dragons in it at all — the test above catches that, but it reports only
  // "No valid target", which does not say why. This one says why.
  it("still reaches a FLYING Dragon with its Special, and not with its basic", () => {
    const flier = getDef("pyro_pyrogon");
    expect(flier.keywords.FLYING, "Pyrogon is the flier this is about").toBe(true);
    expect(getDef("dawn_drakonbane").attackType, "and Drakonbane is on the ground").toBe("Melee");

    const s = prepState();
    s.players.P1.magicPool = 9;
    const bane = place(s, "dawn_drakonbane", "P1", 3, 0);
    const drg = place(s, "pyro_pyrogon", "P2", 2, 0, { curHp: 60, maxHp: 60, curShields: 0 });
    // The Special lands its full anti-Dragon number through the wings.
    expect(60 - fire(s, bane.instanceId, drg.instanceId).cards[drg.instanceId].curHp).toBe(14);

    // The BASIC is deliberately still grounded: a flying Dragon costs Drakonbane
    // its Special rather than being farmed by its ordinary attack.
    const b = prepState();
    const ground = place(b, "dawn_drakonbane", "P1", 3, 0);
    const air = place(b, "pyro_pyrogon", "P2", 2, 0, { curHp: 60, maxHp: 60, curShields: 0 });
    expect(canTarget(b, b.cards[ground.instanceId], b.cards[air.instanceId]),
      "melee must not reach a flier").toBe(false);
  });

  it("the on-summon ambush fires at a bane target and NOT at a small one", () => {
    const worthy = prepState();
    worthy.players.P1.gold = 20;
    place(worthy, "leaf_greegon", "P2", 2, 0, { curHp: 30, maxHp: 30, curShields: 0 });
    worthy.players.P1.hand = [{ handId: "h1", defId: "dawn_drakonbane" }];
    const w = applyIntent(worthy, { type: "SUMMON", player: "P1", handId: "h1", col: 0 });
    // 7 ambush + Awakening, which is a SHARE of its printed 9 rather than all of
    // it — derived from the dial so this does not have to be re-cut by hand the
    // next time DAWN is tuned.
    const awaken = Math.floor((getDef("dawn_drakonbane").dmg * DAWN_STRIKE_PCT) / 100);
    expect(boardCards(w, "P2")[0].curHp).toBe(30 - 7 - awaken);

    // Small by MAX HP, not merely wounded — a hurt giant is still a giant now,
    // and this used to place one at 10/30 and expect to be spared.
    const spared = prepState();
    spared.players.P1.gold = 20;
    place(spared, "leaf_greegon", "P2", 2, 0, { curHp: 24, maxHp: 24, curShields: 0 });
    spared.players.P1.hand = [{ handId: "h1", defId: "dawn_drakonbane" }];
    const sp = applyIntent(spared, { type: "SUMMON", player: "P1", handId: "h1", col: 0 });
    expect(boardCards(sp, "P2")[0].curHp).toBe(24 - awaken); // Awakening only — no ambush
  });

  it("Sunlight Strike pays a kill in shields AND health", () => {
    const s = prepState();
    s.players.P1.magicPool = 9;
    const dk = place(s, "dawn_drakonbane", "P1", 3, 0, { curHp: 4, curShields: 0 });
    const prey = place(s, "leaf_greegon", "P2", 2, 0, { curHp: 3, maxHp: 30, curShields: 0 });
    const after = fire(s, dk.instanceId, prey.instanceId);
    const me = after.cards[dk.instanceId];
    expect(me.curShields).toBe(2);
    expect(me.curHp, "4 + 7, and its maximum is well clear of that").toBe(11);
  });

  it("pays nothing when the strike does not kill", () => {
    // The rider is ON KILL. A strike that only wounds must leave both alone.
    const s = prepState();
    s.players.P1.magicPool = 9;
    const dk = place(s, "dawn_drakonbane", "P1", 3, 0, { curHp: 4, curShields: 0 });
    const tank = place(s, "leaf_greegon", "P2", 2, 0, { curHp: 40, maxHp: 40, curShields: 0 });
    const me = fire(s, dk.instanceId, tank.instanceId).cards[dk.instanceId];
    expect(me.curShields).toBe(0);
    expect(me.curHp).toBe(4);
  });

  it("the ambush REACHES a bane target across the board, not just an adjacent one", () => {
    // The reported bug: gated to melee king's-reach the ambush effectively never
    // fired — Drakonbane lands on its home row and a big enemy is rarely sitting
    // next to it. It pounces the nearest bane-worthy foe at any range now, the
    // same way DAWN's own Awakening reaches the nearest enemy.
    const s = prepState();
    s.players.P1.gold = 20;
    const far = place(s, "leaf_greegon", "P2", 0, 2, { curHp: 30, maxHp: 30, curShields: 0 }); // far corner, out of melee reach
    s.players.P1.hand = [{ handId: "h1", defId: "dawn_drakonbane" }];
    const n = applyIntent(s, { type: "SUMMON", player: "P1", handId: "h1", col: 0 });
    expect(n.cards[far.instanceId].curHp).toBeLessThanOrEqual(30 - 7); // the 7 ambush landed
  });
});

describe("Zombination", () => {
  it("Toxic Eruption poisons every opponent in range", () => {
    const s = prepState();
    s.players.P1.magicPool = 9;
    const z = place(s, "dusk_zombination", "P1", 3, 0);
    const a = place(s, "leaf_greegon", "P2", 2, 0, { curHp: 30, maxHp: 30 });
    const b = place(s, "leaf_greegon", "P2", 2, 1, { curHp: 30, maxHp: 30 });
    const next = fire(s, z.instanceId, a.instanceId);
    expect(statusOf(next.cards[a.instanceId], "DOT")?.power).toBe(4);
    expect(statusOf(next.cards[b.instanceId], "DOT")?.power).toBe(4);
  });

  it("a Zombie bursting damages opponents beside it (Contagion), while Zombination lives", () => {
    const s = prepState();
    place(s, "dusk_zombination", "P1", 3, 0); // the aura holder
    const zom = place(s, "dusk_zombie_tok", "P1", 2, 1, { curHp: 1, maxHp: 3 });
    const beside = place(s, "dusk_gool", "P2", 2, 2, { curHp: 30, maxHp: 30, curShields: 0 });
    const killer = place(s, "leaf_greegon", "P2", 1, 1, { curHp: 30, maxHp: 30 });
    const next = applyIntent(battleWith(s, killer.instanceId), {
      type: "BATTLE_ACTION", player: "P2", action: "basic", targetId: zom.instanceId,
    });
    expect(next.cards[zom.instanceId]?.curHp ?? 0).toBeLessThanOrEqual(0);
    expect(next.cards[beside.instanceId].curHp).toBe(30 - 2); // caught the burst
  });

  it("...but NOT once Zombination is gone — it is strictly the aura", () => {
    // No Zombination on the board: the same Zombie death sprays nothing.
    const s = prepState();
    const zom = place(s, "dusk_zombie_tok", "P1", 2, 1, { curHp: 1, maxHp: 3 });
    const beside = place(s, "dusk_gool", "P2", 2, 2, { curHp: 30, maxHp: 30, curShields: 0 });
    const killer = place(s, "leaf_greegon", "P2", 1, 1, { curHp: 30, maxHp: 30 });
    const next = applyIntent(battleWith(s, killer.instanceId), {
      type: "BATTLE_ACTION", player: "P2", action: "basic", targetId: zom.instanceId,
    });
    expect(next.cards[beside.instanceId].curHp).toBe(30); // untouched — no aura holder
  });

  it("...and it bursts however the body falls — a DOT kill triggers it too", () => {
    // In defeatCard (the single death choke-point), so a Zombie finished by
    // poison bursts just like one killed by an attack.
    const s = prepState();
    place(s, "dusk_zombination", "P1", 3, 0);
    const zom = place(s, "dusk_zombie_tok", "P1", 2, 1, { curHp: 2, maxHp: 3 });
    zom.statuses = [{ kind: "DOT", duration: 2, power: 5, source: "DUSK" }];
    const beside = place(s, "dusk_gool", "P2", 2, 2, { curHp: 30, maxHp: 30, curShields: 0 });
    const next = advance(atCleanup(s));
    expect(next.cards[zom.instanceId]?.curHp ?? 0).toBeLessThanOrEqual(0);
    expect(next.cards[beside.instanceId].curHp).toBe(30 - 2); // Contagion still fired
  });
});

describe("Magmadon", () => {
  it("Scorched Fury bleeds 1 HP a round and runs hotter for it", () => {
    const s = prepState();
    const mag = place(s, "pyro_magmadon", "P1", 3, 0, { curHp: 38, maxHp: 38 });
    const base = effectiveDmg(s, mag);
    const next = advance(atCleanup(s));
    const after = next.cards[mag.instanceId];
    // Derived, because Magmadon now stands in its OWN Volcanic aura and that
    // aura COSTS 1 max HP. Cleanup clamps curHp to the effective ceiling, so a
    // card printed at 38 sits at 37 before Scorched Fury takes its point — this
    // read a flat 37 and broke on the aura, not on the passive it tests.
    expect(after.curHp).toBe(effectiveMaxHp(next, after) - 1);
    expect(effectiveDmg(next, after)).toBe(base + 2);
  });

  it("below 5 HP it gains a further flat +2", () => {
    const s = prepState();
    const hurt = place(s, "pyro_magmadon", "P1", 3, 0, { curHp: 4, maxHp: 38 });
    const well = prepState();
    const fine = place(well, "pyro_magmadon", "P1", 3, 0, { curHp: 38, maxHp: 38 });
    expect(effectiveDmg(s, hurt) - effectiveDmg(well, fine)).toBe(2);
  });

  it("Meltdown keeps erupting each round, and FREEZE smothers it", () => {
    const s = prepState();
    s.players.P1.magicPool = 9;
    const mag = place(s, "pyro_magmadon", "P1", 3, 0, { curHp: 38, maxHp: 38 });
    place(s, "bore_clubber", "P2", 2, 0, { curHp: 40, maxHp: 40, curShields: 0 }); // no REGEN to mask it
    const lit = fire(s, mag.instanceId);
    expect(lit.cards[mag.instanceId].channelOn).toBe(true);

    // Nobody attacks this round — the channel alone keeps hitting.
    const foeBefore = boardCards(lit, "P2")[0].curHp;
    const ticked = advance(atCleanup(lit));
    expect(boardCards(ticked, "P2")[0].curHp).toBeLessThan(foeBefore);
    expect(ticked.cards[mag.instanceId].channelOn).toBe(true);

    ticked.cards[mag.instanceId].statuses.push({ kind: "FREEZE", duration: 2, power: 0, source: "AQUA" });
    const frozen = advance(atCleanup(ticked));
    expect(frozen.cards[mag.instanceId].channelOn).toBe(false);
  });

  it("Volcanic charges the line 1 max HP for +2 DMG", () => {
    // Replaces Trial by Fire, which did this ONCE on arrival for a single round.
    // As a standing aura it is the same trade, always on, and — being the first
    // aura in the game with a NEGATIVE component — the half that had to be made
    // to work: the aura fold kept the highest value from a floor of 0, so the
    // -1 was silently discarded and this would have been a free +2.
    const s = prepState();
    const kin = place(s, "pyro_fenrir", "P1", 3, 1);      // Volcanic
    const other = place(s, "pyro_firebird", "P1", 3, 2);  // PYRO, not Volcanic
    const kinDmg = effectiveDmg(s, s.cards[kin.instanceId]);
    const kinHp = effectiveMaxHp(s, s.cards[kin.instanceId]);
    const otherDmg = effectiveDmg(s, s.cards[other.instanceId]);
    const otherHp = effectiveMaxHp(s, s.cards[other.instanceId]);

    place(s, "pyro_magmadon", "P1", 4, 1);
    expect(effectiveDmg(s, s.cards[kin.instanceId])).toBe(kinDmg + 2);
    expect(effectiveMaxHp(s, s.cards[kin.instanceId]), "the aura charges for it").toBe(kinHp - 1);
    // Element is no longer the scope — a PYRO card outside the tribe gets nothing.
    expect(effectiveDmg(s, s.cards[other.instanceId])).toBe(otherDmg);
    expect(effectiveMaxHp(s, s.cards[other.instanceId])).toBe(otherHp);
  });
});

describe("Krakler schools with SeaC", () => {
  // It used to carry "Kraken" alongside SeaC — the brief's identity tag, a tribe
  // of exactly one that no aura matched and no node named. That is retired, and
  // this title said "carries BOTH" for a while after it stopped being true,
  // because nothing here ever asserted the tag. It does now, one line down, so
  // the claim and the test agree.
  it("carries SeaC and nothing else, and picks up its +4 max HP", () => {
    expect(getDef("aqua_krakler").tribe, "one tribe, the one that pays").toBe("SeaC");
    const alone = prepState();
    const solo = place(alone, "aqua_krakler", "P1", 3, 0);
    const base = effectiveMaxHp(alone, solo);

    const schooled = prepState();
    const kra = place(schooled, "aqua_krakler", "P1", 3, 0);
    place(schooled, "aqua_kraken", "P1", 3, 1);
    expect(effectiveMaxHp(schooled, schooled.cards[kra.instanceId])).toBe(base + 4);
  });
});

describe("Zombie Husk raises a Zombie instead of getting back up", () => {
  it("the chain terminates — a Zombie leaves nothing behind when IT falls", () => {
    // The worry with a death-spawns-a-body rule is an unkillable loop. A husk
    // yields exactly one Zombie; a Zombie yields none (it bursts instead).
    const s = prepState();
    const zom = place(s, "dusk_zombie_tok", "P1", 2, 1, { curHp: 1, maxHp: 3 });
    const killer = place(s, "leaf_alpha", "P2", 1, 1, { curHp: 30, maxHp: 30 });
    const next = applyIntent(battleWith(s, killer.instanceId), {
      type: "BATTLE_ACTION", player: "P2", action: "basic", targetId: zom.instanceId,
    });
    expect(boardCards(next, "P1").filter((c) => c.defId === "dusk_zombie_tok")).toHaveLength(0);
  });

  it("...and it rises however the husk died, not only to a basic attack", () => {
    // spawnToken sits outside the retaliation branch, so a DOT / tick kill
    // raises one just the same. Worth pinning: the horde's whole point is that
    // clearing it by attrition does not work.
    const s = prepState();
    const husk = place(s, "dusk_zombie_husk", "P1", 2, 0, { curHp: 2, maxHp: 8 });
    husk.statuses = [{ kind: "DOT", duration: 2, power: 5, source: "DUSK" }];
    const next = advance(atCleanup(s));
    expect(next.cards[husk.instanceId]?.curHp ?? 0).toBeLessThanOrEqual(0);
    expect(boardCards(next, "P1").filter((c) => c.defId === "dusk_zombie_tok")).toHaveLength(1);
  });
});
