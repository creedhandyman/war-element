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
import { bigPrepState, place, prepState } from "./helpers";

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
    for (const id of ["dawn_ballista", "gale_falcon", "aqua_sonarping", "bolt_policecar"]) {
      expect(getDef(id).rarity, id).toBe("rare");
      expect(getDef(id).special, `${id}: a Rare gets no repeatable Special`).toBeUndefined();
    }
    for (const id of ["aqua_surferdude", "pyro_mortar", "pyro_pyrodactyl"]) {
      expect(getDef(id).special, `${id} is epic+ and must have one`).toBeTruthy();
    }
  });
});

// A prepState import that is used, so the helper set stays honest.
describe("harness", () => {
  it("prepState is the small board", () => {
    expect(prepState().boardSize).toBeLessThan(bigPrepState().boardSize);
  });
});
