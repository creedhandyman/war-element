// Two grants, both onto machinery that already existed.
//
// Trample Through is the TRAMPLE keyword now, not a `shoveWeaker` boolean. The
// rule and its gates are untouched — only where the flag lives changed — so
// these tests carried over as they were, which is the point of moving it.
//
// Trample Through (`shoveWeaker`) and heal-on-basic (`basicHealsAllies`) were
// each fully implemented and each carried by a card or four already, so what is
// worth testing is not the mechanic — it is that the RIGHT cards now have it,
// that the gates hold, and that the one interaction the new carriers created
// (a Bison that both tramples and cannot be trampled) resolves the way the
// rest of the game's pushes do.
import { describe, expect, it } from "vitest";
import { applyIntent } from "../phases";
import { canMove, validTargets } from "../rules";
import { basicAttack } from "../combat";
import { getDef } from "../../data/cards";
import { place, prepState } from "./helpers";
import type { GameState, Pos } from "../types";

const TRAMPLERS = [
  "leaf_oakgre", "gale_buf", "bore_bearocks",
  "bore_bastion", "dawn_musk_ox", "gale_stormhide_bison",
  "pyro_burnout",
] as const;

/** P1 has priority and may move; put `mover` at r2c1 with `victim` ahead of it. */
function facing(moverId: string, victimId: string, opts: { beyondBlocked?: boolean } = {}) {
  const s = prepState();
  const mover = place(s, moverId, "P1", 2, 1);
  const victim = place(s, victimId, "P2", 1, 1);
  if (opts.beyondBlocked) place(s, "dusk_gool", "P2", 0, 1);
  // Oakgre is rooted at SP 0 and cannot move at all until Uprooted; give it the
  // legs so this measures the trample rule rather than the root.
  mover.spBonus = 6;
  return { s, mover, victim, to: { row: 1, col: 1 } as Pos };
}

const moveTo = (s: GameState, id: string, to: Pos) =>
  applyIntent(s, { type: "MOVE", player: "P1", instanceId: id, to } as never);

describe("Trample Through", () => {
  it("is a KEYWORD on every carrier, and they are the heavy ones", () => {
    // A keyword rather than a def field, so it reads as a chip on the card the
    // way FLYING and BLOCK do — the ability was always printed to the player as
    // "Trample Through" and now the data says the same thing.
    for (const id of TRAMPLERS) expect(getDef(id).keywords.TRAMPLE, id).toBe(true);
    // The gate is max HP, so a trampler has to outweigh something for the grant
    // to be worth anything. The club runs 16 (Stormhide Bison) to 55 (Oakgre)
    // and Burnout joins at 24 — comfortably mid-pack, and above the median.
    // 16 is the floor rather than a round number because that is what the
    // lightest carrier actually is; a trampler under it would be a card
    // carrying an ability it could almost never use.
    for (const id of TRAMPLERS) expect(getDef(id).hp, `${id} too light to shove anything`).toBeGreaterThanOrEqual(16);
    expect(getDef("pyro_burnout").hp).toBe(24);
  });

  it("Burnout tramples, and its own kit is what it walks into", () => {
    // Not just the flag: the reason it was given. Trample puts Burning Frame's
    // owner in contact on purpose, so the shove and the punish are one move.
    const s = prepState();
    const burn = place(s, "pyro_burnout", "P1", 2, 1);
    const victim = place(s, "dusk_gool", "P2", 1, 1);
    burn.spBonus = 6;
    const to = { row: 1, col: 1 } as Pos;
    expect(canMove(s, "P1", burn.instanceId, to).ok, "steps onto a lighter card").toBe(true);
    const n = moveTo(s, burn.instanceId, to);
    expect(n.cards[burn.instanceId].pos).toEqual({ row: 1, col: 1 });
    expect(n.cards[victim.instanceId].pos, "driven back a slot").toEqual({ row: 0, col: 1 });
    expect(getDef("pyro_burnout").onHitByMelee?.status?.kind, "and melee into it still burns").toBe("BURN");
  });

  it("does not trample something as big as it", () => {
    // 24 HP is the lower end of the club: Polar King at 22 moves, Burnout's own
    // 24 does not move a 24. The gate is strictly-less, not less-or-equal.
    const s = prepState();
    const burn = place(s, "pyro_burnout", "P1", 2, 1);
    place(s, "pyro_burnout", "P2", 1, 1);
    burn.spBonus = 6;
    expect(canMove(s, "P1", burn.instanceId, { row: 1, col: 1 } as Pos).ok).toBe(false);
  });

  it("steps onto a weaker enemy and drives it back a slot", () => {
    const { s, mover, victim, to } = facing("bore_bearocks", "dusk_gool"); // 30 HP vs less
    expect(canMove(s, "P1", mover.instanceId, to).ok).toBe(true);
    const n = moveTo(s, mover.instanceId, to);
    expect(n.cards[mover.instanceId].pos).toEqual({ row: 1, col: 1 });
    expect(n.cards[victim.instanceId].pos, "driven straight back, same line").toEqual({ row: 0, col: 1 });
  });

  it("refuses an enemy that is not weaker", () => {
    // The gate is effective MAX HP, and Bastion at 31 does not move Bearocks 30
    // …but Bearocks does not move Bastion either. Same-or-bigger is a wall.
    const { s, mover, to } = facing("bore_bearocks", "bore_bastion");
    expect(canMove(s, "P1", mover.instanceId, to).ok).toBe(false);
  });

  it("refuses when the slot behind the victim is taken", () => {
    // Nothing is crushed against another body.
    const { s, mover, to } = facing("bore_bearocks", "dusk_gool", { beyondBlocked: true });
    expect(canMove(s, "P1", mover.instanceId, to).ok).toBe(false);
  });

  it("Braced Stance stops a trample like it stops every other push", () => {
    // The interaction the new carriers created: Stormhide Bison both tramples
    // and is pushImmune. `pushBack` and `pull` already refused to move these;
    // a trample that shoved one anyway would have been the only push in the
    // game that ignores "it doesn't budge".
    const { s, mover, to } = facing("bore_bearocks", "gale_stormhide_bison");
    expect(getDef("gale_stormhide_bison").pushImmune).toBe(true);
    expect(canMove(s, "P1", mover.instanceId, to).ok).toBe(false);
  });

  it("does not trample an ALLY", () => {
    const s = prepState();
    const mover = place(s, "bore_bearocks", "P1", 2, 1);
    place(s, "dusk_gool", "P1", 1, 1);
    expect(canMove(s, "P1", mover.instanceId, { row: 1, col: 1 } as Pos).ok).toBe(false);
  });
});

describe("Amble's basic can heal", () => {
  it("carries the ability", () => {
    expect(getDef("dawn_amble").basicHealsAllies).toBe(true);
  });

  it("aimed at a hurt ally, it heals for its DMG and strikes nothing", () => {
    const s = prepState();
    const amble = place(s, "dawn_amble", "P1", 2, 1);
    const hurt = place(s, "dawn_musk_ox", "P1", 2, 2, { curHp: 4, maxHp: 18 });
    const before = s.cards[hurt.instanceId].curHp;
    const r = basicAttack(s, amble.instanceId, hurt.instanceId);
    expect(s.cards[hurt.instanceId].curHp, "healed, not hit").toBeGreaterThan(before);
    expect(r?.landedHits, "and it was not an attack").toBe(0);
    expect(s.log.some((l) => /tends/.test(l))).toBe(true);
  });

  it("still attacks enemies normally", () => {
    // The half that keeps it a card rather than a heal button.
    const s = prepState();
    const amble = place(s, "dawn_amble", "P1", 2, 1);
    const foe = place(s, "dusk_gool", "P2", 1, 1, { curHp: 40, maxHp: 40, curShields: 0 });
    basicAttack(s, amble.instanceId, foe.instanceId);
    expect(s.cards[foe.instanceId].curHp).toBeLessThan(40);
  });

  it("offers hurt allies and never itself", () => {
    // The rule lives in the TARGET LIST, not in the swing: a lone Amble must
    // not be able to top itself up every round for free, and a full-HP ally is
    // a wasted turn the AI should not be offered either.
    const s = prepState();
    const amble = place(s, "dawn_amble", "P1", 2, 1, { curHp: 3, maxHp: 10 });
    const hurt = place(s, "dawn_musk_ox", "P1", 2, 2, { curHp: 4, maxHp: 18 });
    const whole = place(s, "dawn_star", "P1", 2, 0);
    const foe = place(s, "dusk_gool", "P2", 1, 1);
    const ids = validTargets(s, amble.instanceId).map((c) => c.instanceId);
    expect(ids, "the wounded ally").toContain(hurt.instanceId);
    expect(ids, "and the enemy").toContain(foe.instanceId);
    expect(ids, "never itself, however hurt").not.toContain(amble.instanceId);
    expect(ids, "and not an ally at full HP").not.toContain(whole.instanceId);
  });
});
