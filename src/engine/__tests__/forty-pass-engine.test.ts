// THE SEVEN MECHANICS THE FORTY-CARD PASS NEEDED.
//
// Eight cards were held back from the first drop because their abilities were
// written but had nothing behind them. This file is what stops each of them
// quietly becoming that again — every one of these fields is the kind that
// fails SILENTLY when it is unread: the card text still prints, the param still
// parses, and nothing happens on the board.
import { describe, expect, it } from "vitest";
import type { GameState } from "../types";
import { getDef } from "../../data/cards";
import { SPECIAL_HANDLERS, basicAttack } from "../combat";
import { effectiveDmg } from "../state";
import { applyIntent } from "../phases";
import { canPlummet, plummetTargets, canTarget, validTargets, rangedReachFor, RANGED_REACH } from "../rules";
import { bigPrepState, giveHand, place, prepState } from "./helpers";

function battleWith(s: GameState, activeId: string): GameState {
  s.phase = "battle";
  s.prep = null;
  s.battle = { queue: [activeId], index: 0, awaitingInput: activeId };
  return s;
}

// ─────────────────────────────────────────────── PLUMMET (Falcon)
describe("PLUMMET — a fourth battle action", () => {
  const FALCON = "gale_falcon";
  const dive = () => getDef(FALCON).plummet!;

  it("the card declares it, and it is not TRAMPLE wearing a costume", () => {
    expect(dive().selfDmg).toBe(1);
    // TRAMPLE compares MAX-HP weight and SHOVES; this compares DMG to CURRENT HP
    // and KILLS. A Falcon carrying both would be two rules fighting over one move.
    expect(getDef(FALCON).keywords.TRAMPLE).toBeFalsy();
    expect(getDef(FALCON).tramplesAnything).toBeFalsy();
  });

  it("finishes a body under its DMG, takes the square, and pays for the landing", () => {
    const s = bigPrepState();
    const falcon = place(s, FALCON, "P1", 3, 2);
    const prey = place(s, "leaf_stickviper", "P2", 2, 2, { curHp: 4, maxHp: 30, curShields: 9 });
    const where = { ...s.cards[prey.instanceId].pos! };
    const hpBefore = s.cards[falcon.instanceId].curHp;
    const next = applyIntent(battleWith(s, falcon.instanceId), {
      type: "BATTLE_ACTION", player: "P1", action: "plummet", targetId: prey.instanceId,
    });
    expect(next.cards[prey.instanceId], "destroyed outright — shields do not save it").toBeUndefined();
    expect(next.cards[falcon.instanceId].pos, "and it took the ground").toEqual(where);
    expect(next.cards[falcon.instanceId].curHp, "the landing costs HP")
      .toBe(hpBefore - dive().selfDmg);
  });

  it("the landing is UNPREVENTABLE — shields do not absorb it", () => {
    const s = bigPrepState();
    const falcon = place(s, FALCON, "P1", 3, 2, { curShields: 5 });
    place(s, "leaf_stickviper", "P2", 2, 2, { curHp: 1, maxHp: 30, curShields: 0 });
    const before = s.cards[falcon.instanceId].curHp;
    const next = applyIntent(battleWith(s, falcon.instanceId), {
      type: "BATTLE_ACTION", player: "P1", action: "plummet",
    });
    expect(next.cards[falcon.instanceId].curShields, "shields untouched").toBe(5);
    expect(next.cards[falcon.instanceId].curHp, "HP paid it").toBe(before - dive().selfDmg);
  });

  it("refuses a body it cannot finish — STRICTLY under, so an equal one lives", () => {
    const s = bigPrepState();
    const falcon = place(s, FALCON, "P1", 3, 2);
    // EFFECTIVE, not printed: auras and the lane bonus move it, and the rule is
    // written against what the card actually hits for.
    const dmg = effectiveDmg(s, s.cards[falcon.instanceId]);
    place(s, "leaf_stickviper", "P2", 2, 2, { curHp: dmg, maxHp: 30, curShields: 0 });
    expect(plummetTargets(s, falcon.instanceId), "equal HP is not under it").toEqual([]);
    expect(canPlummet(s, falcon.instanceId).ok).toBe(false);
  });

  it("refuses when the dive would kill the diver", () => {
    const s = bigPrepState();
    const falcon = place(s, FALCON, "P1", 3, 2, { curHp: dive().selfDmg });
    place(s, "leaf_stickviper", "P2", 2, 2, { curHp: 1, maxHp: 30, curShields: 0 });
    expect(canPlummet(s, falcon.instanceId).reason).toMatch(/too hurt/i);
  });

  it("refuses out of reach", () => {
    const s = bigPrepState();
    const falcon = place(s, FALCON, "P1", 4, 0);
    place(s, "leaf_stickviper", "P2", 0, 4, { curHp: 1, maxHp: 30, curShields: 0 });
    expect(plummetTargets(s, falcon.instanceId)).toEqual([]);
  });

  it("only cards that print it can do it", () => {
    const s = bigPrepState();
    const plain = place(s, "leaf_stickviper", "P1", 3, 2);
    place(s, "dusk_gool", "P2", 2, 2, { curHp: 1, maxHp: 20, curShields: 0 });
    expect(canPlummet(s, plain.instanceId).ok).toBe(false);
  });
});

// ─────────────────────────────────────── attackEveryOtherRound (Ballista)
describe("Crank and Loose — a basic every OTHER round", () => {
  const BALLISTA = "dawn_ballista";

  it("the card declares it", () => {
    expect(getDef(BALLISTA).attackEveryOtherRound).toBe(true);
  });

  it("fires, reloads, fires again — and the gate is on the TARGET LIST", () => {
    // Gated in validTargets on purpose: the AI reads that list directly, so a
    // gate living only in canBasicAttack would stop the player and not the AI.
    const s = bigPrepState();
    s.round = 4;
    const b = place(s, BALLISTA, "P1", 4, 2);
    place(s, "leaf_stickviper", "P2", 3, 2, { curHp: 99, maxHp: 99, curShields: 0 });
    expect(validTargets(s, b.instanceId).length, "round 4: loaded").toBeGreaterThan(0);
    basicAttack(s, b.instanceId, validTargets(s, b.instanceId)[0].instanceId);
    expect(s.cards[b.instanceId].lastBasicRound).toBe(4);
    s.round = 5;
    expect(validTargets(s, b.instanceId), "round 5: reloading").toEqual([]);
    s.round = 6;
    expect(validTargets(s, b.instanceId).length, "round 6: loaded again").toBeGreaterThan(0);
  });

  it("bounds BASICS only — it can still move, cast and use a Talent while reloading", () => {
    const s = bigPrepState();
    s.round = 5;
    const b = place(s, BALLISTA, "P1", 4, 2);
    s.cards[b.instanceId].lastBasicRound = 4;
    place(s, "leaf_stickviper", "P2", 3, 2, { curHp: 99, maxHp: 99, curShields: 0 });
    expect(validTargets(s, b.instanceId), "no shot").toEqual([]);
    // Not scenery: it keeps its battle turn, so it can still MOVE on the round it
    // cannot shoot, which is the whole point of the gate being basics-only. (It
    // carries no Talent — the set rule puts those on cost-3 Rares and this is a
    // 2-drop — so the reload round is spent repositioning, not casting.)
    expect(getDef(BALLISTA).noBattleTurn).toBeFalsy();
    expect(getDef(BALLISTA).talent, "a 2-cost Rare gets no Talent").toBeUndefined();
  });
});

// ─────────────────────────────────────────────── reachBonus (Ballista)
describe("reachBonus — printed range", () => {
  it("adds to the ordinary ranged reach and stacks with King of the Hill", () => {
    const s = bigPrepState();
    const home = place(s, "dawn_ballista", "P1", 4, 2);           // on its home row
    expect(rangedReachFor(s, s.cards[home.instanceId]))
      .toBe(RANGED_REACH + getDef("dawn_ballista").reachBonus!);
    const out = place(s, "dawn_ballista", "P1", 2, 0);            // advanced
    expect(rangedReachFor(s, s.cards[out.instanceId]),
      "the siege engine that walked forward still sees further")
      .toBe(RANGED_REACH + getDef("dawn_ballista").reachBonus! + 1);
  });

  it("a card without it is unchanged", () => {
    const s = bigPrepState();
    const plain = place(s, "gale_rayfen", "P1", 4, 2);
    expect(rangedReachFor(s, s.cards[plain.instanceId])).toBe(RANGED_REACH);
  });
});

// ─────────────────────────────────────────── revealsStealth (Sonar Ping)
describe("Echo Return — nothing hides from a side that pings", () => {
  it("a hidden card is untargetable, and the ping gives it up", () => {
    const s = bigPrepState();
    const shooter = place(s, "gale_rayfen", "P1", 3, 2);
    const hidden = place(s, "leaf_grizzly", "P2", 2, 2);          // stealthWhenIdle
    const target = s.cards[hidden.instanceId];
    expect(canTarget(s, s.cards[shooter.instanceId], target, false, true),
      "cloaked while it has neither moved nor attacked").toBe(false);
    // ...now put a Sonar Ping on the shooter's side.
    place(s, "aqua_sonarping", "P1", 4, 0);
    expect(canTarget(s, s.cards[shooter.instanceId], target, false, true),
      "the ping reveals it").toBe(true);
  });

  it("it has to be ALIVE and on your side", () => {
    const s = bigPrepState();
    const shooter = place(s, "gale_rayfen", "P1", 3, 2);
    const hidden = place(s, "leaf_grizzly", "P2", 2, 2);
    place(s, "aqua_sonarping", "P1", 4, 0, { curHp: 0 });
    expect(canTarget(s, s.cards[shooter.instanceId], s.cards[hidden.instanceId], false, true),
      "a dead pinger reveals nothing").toBe(false);
  });
});

// ───────────────────────────── onAllyHitSpawn + the spawnOnHitTaken ceiling
describe("Police Car — two taps, both capped", () => {
  const CAR = "bolt_policecar";

  it("calls a unit in when an ALLY is hit and survives", () => {
    const s = bigPrepState();
    const car = place(s, CAR, "P1", 4, 0);
    const ally = place(s, "leaf_stickviper", "P1", 4, 2, { curHp: 99, maxHp: 99, curShields: 0 });
    const foe = place(s, "dusk_gool", "P2", 3, 2);
    const before = countOfficers(s);
    basicAttack(s, foe.instanceId, ally.instanceId);
    expect(countOfficers(s), "an ally took a hit").toBeGreaterThan(before);
    expect(s.cards[car.instanceId].allyHitSpawnFiredRound, "and the gate is on the HOLDER").toBe(true);
  });

  it("...once per round however many allies are hit", () => {
    const s = bigPrepState();
    place(s, CAR, "P1", 4, 0);
    const a1 = place(s, "leaf_stickviper", "P1", 4, 2, { curHp: 99, maxHp: 99, curShields: 0 });
    const a2 = place(s, "leaf_stickviper", "P1", 4, 3, { curHp: 99, maxHp: 99, curShields: 0 });
    const f1 = place(s, "dusk_gool", "P2", 3, 2);
    const f2 = place(s, "dusk_gool", "P2", 3, 3);
    basicAttack(s, f1.instanceId, a1.instanceId);
    const afterFirst = countOfficers(s);
    basicAttack(s, f2.instanceId, a2.instanceId);
    expect(countOfficers(s), "the second ally does not call a second car").toBe(afterFirst);
  });

  it("both taps declare a ceiling — an uncapped body engine is the Buzzard problem", () => {
    expect(getDef(CAR).onAllyHitSpawn!.maxAlive).toBeGreaterThan(0);
    expect(getDef(CAR).spawnOnHitTaken!.maxAlive, "this one had NO cap before").toBeGreaterThan(0);
  });

  it("and the ceiling actually binds", () => {
    const s = bigPrepState();
    const car = place(s, CAR, "P1", 4, 0);
    const cap = getDef(CAR).onAllyHitSpawn!.maxAlive!;
    for (let i = 0; i < cap; i++) place(s, "bolt_police_tok", "P1", 2, i);
    const ally = place(s, "leaf_stickviper", "P1", 4, 2, { curHp: 99, maxHp: 99, curShields: 0 });
    const foe = place(s, "dusk_gool", "P2", 3, 2);
    basicAttack(s, foe.instanceId, ally.instanceId);
    expect(countOfficers(s), "full is full").toBe(cap);
    expect(s.cards[car.instanceId]).toBeTruthy();
  });

  function countOfficers(s: GameState) {
    return Object.values(s.cards).filter((c) => c.defId === "bolt_police_tok" && c.curHp > 0).length;
  }
});

// ────────────────────────────────────── surfsUp push + barrage vsFlyingDmg
describe("the two handler params that were printed and unread", () => {
  it("Surfs Up SHOVES — the printed 2 spaces used to do nothing", () => {
    const s = bigPrepState();
    const surfer = place(s, "aqua_surferdude", "P1", 3, 2);
    const foe = place(s, "leaf_stickviper", "P2", 2, 2, { curHp: 99, maxHp: 99, curShields: 0 });
    const rowBefore = s.cards[foe.instanceId].pos!.row;
    SPECIAL_HANDLERS.surfsUp(s, s.cards[surfer.instanceId], [],
      getDef("aqua_surferdude").special!.params as Record<string, number>);
    expect(s.cards[foe.instanceId].curHp, "the wave hit it").toBeLessThan(99);
    expect(s.cards[foe.instanceId].pos!.row, "and shoved it back").not.toBe(rowBefore);
  });

  it("Airburst pays vsFlyingDmg only against a FLIER, per target", () => {
    const s = bigPrepState();
    const mortar = place(s, "pyro_mortar", "P1", 4, 0);
    const params = getDef("pyro_mortar").special!.params as Record<string, number>;
    const flier = place(s, "gale_angale", "P2", 3, 0, { curHp: 99, maxHp: 99, curShields: 0 });
    const ground = place(s, "leaf_stickviper", "P2", 3, 1, { curHp: 99, maxHp: 99, curShields: 0 });
    expect(getDef("gale_angale").keywords.FLYING, "the control really flies").toBe(true);
    SPECIAL_HANDLERS.barrage(s, s.cards[mortar.instanceId],
      [s.cards[flier.instanceId], s.cards[ground.instanceId]], params);
    const onFlier = 99 - s.cards[flier.instanceId].curHp;
    const onGround = 99 - s.cards[ground.instanceId].curHp;
    expect(onFlier, "the shell brings it down").toBe(onGround + params.vsFlyingDmg);
  });

  it("...and a volley with no vsFlyingDmg is unchanged", () => {
    const s = bigPrepState();
    const caster = place(s, "pyro_mortar", "P1", 4, 0);
    const flier = place(s, "gale_angale", "P2", 3, 0, { curHp: 99, maxHp: 99, curShields: 0 });
    SPECIAL_HANDLERS.barrage(s, s.cards[caster.instanceId], [s.cards[flier.instanceId]],
      { dmg: 5, targets: 1 });
    expect(99 - s.cards[flier.instanceId].curHp).toBe(5);
  });
});

// ─────────────────────────────────────────────────── the eight, on budget
describe("the held-back eight are on the curve like everything else", () => {
  it("every one is exact on 5*cost+10", () => {
    for (const id of ["dawn_ballista", "gale_falcon", "aqua_surferdude", "aqua_sonarping",
                      "bolt_policecar", "bolt_police_tok", "pyro_mortar", "pyro_pyrodactyl"]) {
      const d = getDef(id);
      expect(d.dmg * d.hits + d.hp + d.shields * 2 + d.sp, id).toBe(5 * d.cost + 10);
    }
  });

  it("and they kept the rarity contract", () => {
    // bolt_policecar MOVED to epic (owner's call), and the contract follows it
    // rather than being relaxed: it now has to HAVE the repeatable Special its
    // Talent became, and it must no longer carry a Talent at all -- those are
    // legal only on a cost-3 Rare. bolt_handyman came the other way, epic cost
    // 5 -> rare cost 3, so it is checked on the Rare side for the mirror.
    for (const id of ["dawn_ballista", "gale_falcon", "aqua_sonarping", "bolt_handyman"]) {
      expect(getDef(id).rarity, id).toBe("rare");
      expect(getDef(id).special, `${id}: a Rare gets no repeatable Special`).toBeUndefined();
    }
    for (const id of ["aqua_surferdude", "pyro_mortar", "pyro_pyrodactyl", "bolt_policecar"]) {
      expect(getDef(id).special, `${id} is epic+ and must have one`).toBeTruthy();
      expect(getDef(id).talent, `${id}: a Talent is cost-3-Rare only`).toBeUndefined();
    }
  });
});

// A prepState import that is used, so the helper set stays honest.
describe("harness", () => {
  it("prepState is the small board", () => {
    expect(prepState().boardSize).toBeLessThan(bigPrepState().boardSize);
  });
});

// ─────────────────────────────────────────── Falconer (Goldspur -> Falcon)
describe("Falconer — the bird comes with the cowboy", () => {
  it("puts one Falcon on the board on arrival", () => {
    // Through the SUMMON INTENT, not `summonCard` and not `place`. This is the
    // whole point of the test: `summonSpawn` fires in the summon path in
    // phases.ts, so both shortcuts leave the falcon un-hatched while the data
    // still reads perfectly — the first version of this test used summonCard and
    // reported zero falcons on a card that works.
    const s = prepState();
    s.players.P1.gold = 12;
    const before = Object.values(s.cards).filter((c) => c.defId === "gale_falcon").length;
    const handId = giveHand(s, "P1", "gale_goldspur");
    const next = applyIntent(s, { type: "SUMMON", player: "P1", handId, col: 1 });
    const after = Object.values(next.cards).filter((c) => c.defId === "gale_falcon" && c.curHp > 0);
    expect(after.length - before, "one falcon, on the fist").toBe(1);
    expect(after[0].owner, "and it is his").toBe("P1");
  });

  it("the falcon it brings is the real card, not a stripped token", () => {
    // gale_falcon is a draftable cost-3 Rare. Kobra spawns a draftable card the
    // same way, and dawn_heir_tok is draftable despite its id — so a summoned
    // body being a full card is precedent, not a special case. It matters here
    // because the thing arriving carries PLUMMET.
    const d = getDef("gale_falcon");
    expect(d.rarity).toBe("rare");
    expect(d.cost).toBe(3);
    expect(d.plummet, "and it can still dive").toBeTruthy();
  });

  it("Goldspur is paid for: under budget AND recosted", () => {
    // The stat-budget formula cannot see a summon, so a free body has to be paid
    // for deliberately or the card is simply undercosted. Both halves, the way
    // Kobra's note prescribes.
    const d = getDef("gale_goldspur");
    const body = d.dmg * d.hits + d.hp + d.shields * 2 + d.sp;
    expect(body, "six under").toBeLessThan(5 * d.cost + 10);
    expect(d.cost, "and recosted into the Legendary band").toBe(6);
    expect(d.rarity).toBe("legendary");
  });
});

// ─────────────────────────────────────── Hot Pursuit (Police Car)
// Shot from range, the car closes. The mirror of `onHitByMelee`: that answers
// an attacker where it stands, this one refuses to stay shot at.
describe("Hot Pursuit — the car chases whoever shoots it", () => {
  const CAR = "bolt_policecar";
  const RANGED = "bolt_hacker";   // attackType "Ranged"
  const MELEE = "leaf_alpha";     // attackType "Melee"

  it("is declared as a once-a-round, 2-space chase", () => {
    const hp = getDef(CAR).onHitByRangedAdvance!;
    expect(hp, "the passive is printed on the card").toBeTruthy();
    expect(hp.steps).toBe(2);
    // Per hit-EVENT a multi-hit volley would tow the car once per shot, so the
    // gate is the whole reason this is safe to print.
    expect(hp.oncePerRound, "a volley must not drag it once per shot").toBe(true);
  });

  it("closes on a RANGED attacker that hits it", () => {
    const s = bigPrepState();
    const car = place(s, CAR, "P2", 0, 0, { curHp: 40, maxHp: 40, curShields: 0 });
    const shooter = place(s, RANGED, "P1", 4, 0, { curHp: 40, maxHp: 40 });
    const before = { ...car.pos! };
    basicAttack(s, shooter.instanceId, car.instanceId);
    const after = s.cards[car.instanceId].pos!;
    expect(s.cards[car.instanceId].curHp, "it has to survive to give chase").toBeGreaterThan(0);
    const closed = Math.abs(before.row - shooter.pos!.row) - Math.abs(after.row - shooter.pos!.row);
    expect(closed, "it drove toward the shooter").toBeGreaterThan(0);
    expect(closed, "and no further than its printed 2").toBeLessThanOrEqual(2);
  });

  it("does NOT chase a MELEE attacker — it is already in its face", () => {
    const s = bigPrepState();
    const car = place(s, CAR, "P2", 2, 0, { curHp: 40, maxHp: 40, curShields: 0 });
    const brawler = place(s, MELEE, "P1", 3, 0, { curHp: 40, maxHp: 40 });
    const before = { ...car.pos! };
    basicAttack(s, brawler.instanceId, car.instanceId);
    expect(s.cards[car.instanceId].pos).toEqual(before);
  });

  it("chases once a round, however many shots land", () => {
    const s = bigPrepState();
    const car = place(s, CAR, "P2", 0, 0, { curHp: 60, maxHp: 60, curShields: 0 });
    const a = place(s, RANGED, "P1", 4, 0, { curHp: 40, maxHp: 40 });
    const b = place(s, RANGED, "P1", 4, 2, { curHp: 40, maxHp: 40 });
    basicAttack(s, a.instanceId, car.instanceId);
    const afterFirst = { ...s.cards[car.instanceId].pos! };
    basicAttack(s, b.instanceId, car.instanceId);
    expect(s.cards[car.instanceId].pos, "the second shot this round moves it nothing")
      .toEqual(afterFirst);
  });
});

// ─────────────────────────────────────── Payout (Kingpin)
describe("Payout — the contract pays when it is filled", () => {
  const BOSS = "bolt_kingpin";
  const GOON = "bolt_hacker";
  const MARK = "leaf_oak";

  function scene() {
    const s = bigPrepState();
    const boss = place(s, BOSS, "P1", 0, 0, { curHp: 40, maxHp: 40 });
    const goon = place(s, GOON, "P1", 2, 2, { curHp: 40, maxHp: 40, dmgBonus: 99 });
    const victim = place(s, MARK, "P2", 2, 3, { curHp: 1, maxHp: 20, curShields: 0 });
    s.players.P1.gold = 0;
    return { s, boss, goon, victim };
  }

  it("pays the player when a MARKED opponent dies", () => {
    const { s, goon, victim } = scene();
    victim.hoaxMarked = true;
    basicAttack(s, goon.instanceId, victim.instanceId);
    expect(s.cards[victim.instanceId], "the mark has to actually die").toBeUndefined();
    expect(s.players.P1.gold).toBe(getDef(BOSS).contractPayout);
  });

  it("pays nothing for a kill that was never under contract", () => {
    const { s, goon, victim } = scene();
    basicAttack(s, goon.instanceId, victim.instanceId);
    expect(s.cards[victim.instanceId]).toBeUndefined();
    expect(s.players.P1.gold, "an ordinary kill is not a contract").toBe(0);
  });

  it("pays nothing with no boss left standing — no boss, no payroll", () => {
    const { s, boss, goon, victim } = scene();
    victim.hoaxMarked = true;
    delete s.cards[boss.instanceId];
    basicAttack(s, goon.instanceId, victim.instanceId);
    expect(s.players.P1.gold).toBe(0);
  });
});

// ─────────────────────────────────────── Mortar, the emplacement
describe("Mortar is an emplacement", () => {
  const M = "pyro_mortar";

  it("cannot move at all, and reaches 3 because of it", () => {
    const d = getDef(M);
    expect(d.sp, "SP 0 is the tier moveReach reads as immobile").toBe(0);
    const s = bigPrepState();
    const m = place(s, M, "P1", 4, 2);
    // Emplaced on its own home row and unable to leave it, so it never earns
    // the +1 that standing forward would give a mobile ranged card.
    expect(rangedReachFor(s, m)).toBe(3);
  });

  it("reloads — it cannot fire on consecutive rounds", () => {
    const s = bigPrepState();
    const m = place(s, M, "P1", 4, 2);
    place(s, "leaf_oak", "P2", 2, 2, { curHp: 30, maxHp: 30 });
    expect(getDef(M).attackEveryOtherRound).toBe(true);
    s.round = 5;
    expect(validTargets(s, m.instanceId).length, "round it fires").toBeGreaterThan(0);
    m.lastBasicRound = 5;
    s.round = 6;
    expect(validTargets(s, m.instanceId).length, "the round after, it is reloading").toBe(0);
    s.round = 7;
    expect(validTargets(s, m.instanceId).length, "and it is back").toBeGreaterThan(0);
  });

  it("its shell STUNS what it lands on", () => {
    const s = bigPrepState();
    const m = place(s, M, "P1", 4, 2);
    const foe = place(s, "leaf_oak", "P2", 2, 2, { curHp: 40, maxHp: 40, curShields: 0 });
    basicAttack(s, m.instanceId, foe.instanceId);
    expect(s.cards[foe.instanceId].statuses.some((x) => x.kind === "STUN")).toBe(true);
  });
});

// ─────────────────────────────────────── the two smaller retunes
describe("Divebill scalds, Warkiln plates the forge", () => {
  it("Spearpoint Dive leaves SCALD with real power, not FREEZE", () => {
    const p = getDef("aqua_divebill").talent!.params as Record<string, unknown>;
    expect(p.statusKind).toBe("SCALD");
    expect(p.statusPower, "a scald with no power burns for nothing").toBeGreaterThan(0);
  });

  it("Warkiln plates Forged Tech and nothing else", () => {
    const a = getDef("pyro_warkiln").aura!;
    expect(a.scope).toBe("tribe");
    expect(a.match).toBe("Forged Tech");
    expect(a.shields).toBe(2);
  });
});

// ─────────────────────────────────────── Hose Down (Firefighter)
describe("Hose Down — the line is charged when it lands", () => {
  it("shoves every opponent in range back a space, and damages none", () => {
    const s = bigPrepState();
    // Two foes inside a Ranged card's reach, one well outside it.
    const near = place(s, "leaf_oak", "P2", 2, 2, { curHp: 30, maxHp: 30 });
    const alsoNear = place(s, "leaf_oak", "P2", 2, 1, { curHp: 30, maxHp: 30 });
    const far = place(s, "leaf_oak", "P2", 0, 4, { curHp: 30, maxHp: 30 });
    const rows = {
      near: near.pos!.row, alsoNear: alsoNear.pos!.row, far: far.pos!.row,
    };
    s.players.P1.gold = 20;
    const handId = giveHand(s, "P1", "aqua_firefighter");
    const next = applyIntent(s, { type: "SUMMON", player: "P1", handId, col: 2 });

    const after = (id: string) => next.cards[id];
    expect(after(near.instanceId).pos!.row, "the near foe was shoved")
      .not.toBe(rows.near);
    expect(after(alsoNear.instanceId).pos!.row, "and so was the other one in range")
      .not.toBe(rows.alsoNear);
    expect(after(far.instanceId).pos!.row, "the one out of reach was not touched")
      .toBe(rows.far);
    // A PURE shove: statusNova was chosen over a zero-damage barrage precisely
    // so no card takes a "hit" for nothing.
    for (const f of [near, alsoNear, far])
      expect(after(f.instanceId).curHp, `${f.instanceId} took no damage`).toBe(30);
  });
});
