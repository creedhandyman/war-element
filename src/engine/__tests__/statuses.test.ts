// Reworked status semantics (updated rules doc) + King of the Hill.

import { describe, expect, it } from "vitest";
import { applyStatus } from "../combat";
import { canMove, isActionBlocked } from "../rules";
import { effectiveDmg, effectiveSp } from "../state";
import { place, prepState } from "./helpers";

describe("status effects on stats", () => {
  it("WEAKEN cuts damage by 25% (round down)", () => {
    const s = prepState();
    const c = place(s, "pyro_ember_scorpion", "P1", 3, 0, {
      status: { kind: "WEAKEN", duration: 1, power: 0, source: "GALE" },
    });
    expect(effectiveDmg(s, c)).toBe(6); // floor(9 × 0.75)
  });

  it("FREEZE pins SP to 0 and halves damage (round down) — but the card still acts", () => {
    const s = prepState();
    const c = place(s, "leaf_greegon", "P1", 3, 0, {
      status: { kind: "FREEZE", duration: 1, power: 0, source: "AQUA" },
    });
    expect(effectiveSp(s, c)).toBe(0);
    expect(effectiveDmg(s, c)).toBe(2); // floor(4 × 0.5)
    expect(isActionBlocked(c)).toBe(false);
    expect(canMove(s, "P1", c.instanceId, { row: 2, col: 0 }).ok).toBe(false); // SP 0
  });

  it("STUN blocks movement; FRIGHTEN blocks movement but not attacks", () => {
    const s = prepState();
    const stunned = place(s, "leaf_alpha", "P1", 3, 0, {
      status: { kind: "STUN", duration: 1, power: 0, source: "GALE" },
    });
    const scared = place(s, "leaf_greegon", "P1", 3, 1, {
      status: { kind: "FRIGHTEN", duration: 1, power: 0, source: "DUSK" },
    });
    expect(canMove(s, "P1", stunned.instanceId, { row: 2, col: 0 }).ok).toBe(false);
    expect(canMove(s, "P1", scared.instanceId, { row: 2, col: 1 }).ok).toBe(false);
    expect(isActionBlocked(stunned)).toBe(true);
    expect(isActionBlocked(scared)).toBe(false); // frighten ≠ action denial
  });
});

describe("FRIGHTEN forced retreat", () => {
  it("pushes the target 1 slot back toward its own home row when open", () => {
    const s = prepState();
    const c = place(s, "leaf_alpha", "P1", 2, 0); // P1 retreats toward row 3
    applyStatus(s, c, "FRIGHTEN", 1, 0, "DUSK");
    expect(c.pos).toEqual({ row: 3, col: 0 });
  });

  it("stays put when the retreat slot is blocked, and can shove an invader off a home slot", () => {
    const s = prepState();
    const blocked = place(s, "leaf_alpha", "P1", 2, 0);
    place(s, "leaf_greegon", "P1", 3, 0); // retreat square occupied
    applyStatus(s, blocked, "FRIGHTEN", 1, 0, "DUSK");
    expect(blocked.pos).toEqual({ row: 2, col: 0 });

    const invader = place(s, "dusk_vamp", "P2", 3, 2); // P2 on P1's home slot
    applyStatus(s, invader, "FRIGHTEN", 1, 0, "DUSK");
    expect(invader.pos).toEqual({ row: 2, col: 2 }); // repelled without a kill
  });
});

describe("King of the Hill", () => {
  it("+1 DMG while sitting in a Mid row", () => {
    const s = prepState();
    const home = place(s, "leaf_squanch", "P1", 3, 0); // 4 dmg
    const mid = place(s, "pyro_firebird", "P1", 2, 1); // 5 dmg
    expect(effectiveDmg(s, home)).toBe(4); // printed
    expect(effectiveDmg(s, mid)).toBe(6); // printed 5 + mid-row 1
  });

  it("holding all 4 slots of one Mid row gives +1 DMG to the whole board", () => {
    const s = prepState();
    const home = place(s, "leaf_squanch", "P1", 3, 0); // not in mid
    place(s, "leaf_greegon", "P1", 1, 0);
    place(s, "pyro_tiki", "P1", 1, 1);
    place(s, "pyro_fenrir", "P1", 1, 2);
    const inRow = place(s, "pyro_firebird", "P1", 1, 3);
    expect(effectiveDmg(s, home)).toBe(5); // 4 + full-row 1
    expect(effectiveDmg(s, inRow)).toBe(7); // 5 + mid-row 1 + full-row 1
    // the enemy gets nothing from OUR row control
    const foe = place(s, "dusk_vamp", "P2", 0, 0);
    expect(effectiveDmg(s, foe)).toBe(2);
  });
});
