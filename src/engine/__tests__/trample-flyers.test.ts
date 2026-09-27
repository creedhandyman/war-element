// Trample cannot touch a FLYING creature (owner's call, 2026-09-27) — unless a
// status has grounded it (ROOT, FREEZE, STUN, SLEEP, PARALYZE), the same line
// melee draws. Three things run a body down, and all three honour it:
//  - the TRAMPLE shove (WarPhant's Trample Through, a juggernaut's gait),
//  - a rider trampling what it passes (Shadow Horsemen's Shadow Charge),
//  - a stampede up the lane (the Golden Bull's Wild Charge).
import { describe, expect, it } from "vitest";
import { getDef } from "../../data/cards";
import { applyIntent, chargeOnArrival } from "../phases";
import { canMove, isAirborne, shoveTarget } from "../rules";
import { place, prepState } from "./helpers";
import type { Pos } from "../types";

const TRAMPLER = "dawn_warphant"; // TRAMPLE, 29 HP
const FLIER = "dawn_halo"; // FLYING, 18 HP: lighter, so weight is not what stops it
const WALKER = "leaf_alpha"; // on the ground, 15 HP

const ROOT = { kind: "ROOT", duration: 2, power: 0 } as never;

describe("the TRAMPLE shove", () => {
  it("cannot take a flier's square, and says why", () => {
    const s = prepState();
    const phant = place(s, TRAMPLER, "P1", 2, 1);
    place(s, FLIER, "P2", 1, 1);
    const to = { row: 1, col: 1 } as Pos;
    expect(shoveTarget(s, phant, to)).toBeNull();
    const r = canMove(s, "P1", phant.instanceId, to);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("Halo is flying — TRAMPLE can't reach it");
  });

  it("the same step onto a body on the ground still tramples it (the control)", () => {
    const s = prepState();
    const phant = place(s, TRAMPLER, "P1", 2, 1);
    place(s, WALKER, "P2", 1, 1);
    expect(shoveTarget(s, phant, { row: 1, col: 1 } as Pos)).not.toBeNull();
    expect(canMove(s, "P1", phant.instanceId, { row: 1, col: 1 } as Pos).ok).toBe(true);
  });

  it("a grounded flier is on the ground, and can be trampled", () => {
    const s = prepState();
    const phant = place(s, TRAMPLER, "P1", 2, 1);
    const halo = place(s, FLIER, "P2", 1, 1, { status: ROOT });
    expect(isAirborne(halo)).toBe(false);
    expect(shoveTarget(s, phant, { row: 1, col: 1 } as Pos)).not.toBeNull();
  });

  it("granted flight counts as flying too (FireFly's BlastOff)", () => {
    const s = prepState();
    const phant = place(s, TRAMPLER, "P1", 2, 1);
    place(s, WALKER, "P2", 1, 1, { flyingRoundsLeft: 1 });
    expect(shoveTarget(s, phant, { row: 1, col: 1 } as Pos)).toBeNull();
  });
});

describe("a rider trampling what it passes (Shadow Charge)", () => {
  it("hurts the walker beside its path and not the flier", () => {
    // Horsemen at (3,0) ride the diagonal to (2,1), beside the mark at (1,2).
    // The walker at (1,0) and the flier at (3,2) both sit beside (2,1).
    const s = prepState();
    s.players.P1.magicPool = 10;
    const rider = place(s, "dusk_shadowhorsemen", "P1", 3, 0);
    const body = { curHp: 60, maxHp: 60, curShields: 0 };
    const mark = place(s, WALKER, "P2", 1, 2, body);
    const walker = place(s, WALKER, "P2", 1, 0, body);
    const flier = place(s, FLIER, "P2", 3, 2, body);
    s.phase = "battle";
    s.prep = null;
    s.battle = { queue: [rider.instanceId], index: 0, awaitingInput: rider.instanceId };
    const n = applyIntent(s, {
      type: "BATTLE_ACTION", player: "P1", action: "special", targetId: mark.instanceId,
    } as never);
    expect(n.cards[rider.instanceId].pos).toEqual({ row: 2, col: 1 });
    expect(n.cards[walker.instanceId].curHp, "trampled on the way past").toBe(55);
    expect(n.cards[flier.instanceId].curHp, "overhead, untouched").toBe(60);
  });
});

describe("a stampede up the lane (Wild Charge)", () => {
  it("runs on under a flier without trampling it, and still tramples a walker", () => {
    const s = prepState();
    const bull = place(s, "dawn_golden_bull_tok", "P1", 3, 1);
    const body = { curHp: 40, maxHp: 40, curShields: 0 };
    const flier = place(s, FLIER, "P2", 2, 1, body);
    const walker = place(s, WALKER, "P2", 1, 1, body);
    chargeOnArrival(s, bull);
    const dmg = getDef("dawn_golden_bull_tok").summonCharge!.dmg;
    expect(s.cards[flier.instanceId].curHp, "under it, untouched").toBe(40);
    expect(s.cards[walker.instanceId].curHp).toBe(40 - dmg);
    expect(bull.pos, "and on past both").toEqual({ row: 0, col: 1 });
  });
});

describe("what the player reads", () => {
  it("the Shadow Charge text says so", () => {
    expect(getDef("dusk_shadowhorsemen").special!.text).toContain("every opponent you pass that isn't flying");
  });
});
