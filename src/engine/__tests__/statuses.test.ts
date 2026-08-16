// Reworked status semantics (updated rules doc) + King of the Hill.

import { describe, expect, it } from "vitest";
import { applyStatus } from "../combat";
import { WEAKEN_MAX_STACKS, weakenMult, weakenStacks } from "../auras";
import { canMove, isActionBlocked, legalMoves } from "../rules";
import { getDef } from "../../data/cards";
import { SP_SLOW_MAX } from "../state";
import { effectiveDmg, effectiveSp, moveReachFor } from "../state";
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
    // Printed values read off the defs: this test is about the MID-ROW bonus,
    // not about either card's numbers, and hardcoding them made a PYRO stat
    // sweep fail a King-of-the-Hill test.
    const home = place(s, "leaf_squanch", "P1", 3, 0);
    const mid = place(s, "pyro_firebird", "P1", 2, 1);
    expect(effectiveDmg(s, home)).toBe(getDef("leaf_squanch").dmg); // printed
    expect(effectiveDmg(s, mid)).toBe(getDef("pyro_firebird").dmg + 1); // + mid-row 1
  });

  it("holding all 4 slots of one Mid row gives +1 DMG to the whole board", () => {
    const s = prepState();
    const home = place(s, "leaf_squanch", "P1", 3, 0); // not in mid
    place(s, "leaf_greegon", "P1", 1, 0);
    place(s, "pyro_tiki", "P1", 1, 1);
    place(s, "pyro_fenrir", "P1", 1, 2);
    const inRow = place(s, "pyro_firebird", "P1", 1, 3);
    expect(effectiveDmg(s, home)).toBe(getDef("leaf_squanch").dmg + 1); // + full-row 1
    expect(effectiveDmg(s, inRow)).toBe(getDef("pyro_firebird").dmg + 2); // + mid-row + full-row
    // the enemy gets nothing from OUR row control
    const foe = place(s, "dusk_vamp", "P2", 0, 0);
    expect(effectiveDmg(s, foe)).toBe(getDef("dusk_vamp").dmg);
  });
});

describe("PARALYZE — mobility", () => {
  /** Legal move count for a card, optionally paralysed. */
  const moves = (defId: string, paralysed: boolean) => {
    const s = prepState();
    const c = place(s, defId, "P1", 2, 1);
    if (paralysed) applyStatus(s, c, "PARALYZE", 2, 0, "BOLT");
    return { reach: moveReachFor(s, s.cards[c.instanceId]), sp: effectiveSp(s, s.cards[c.instanceId]) };
  };

  it("cuts a quick card to a single step, whatever tier it was in", () => {
    // PARALYZE caps movement at 1, so it costs a mid card one slot and a FAST
    // card two. Klipso sits above the slow band and normally strides at least 2.
    const before = moves("gale_klipso", false);
    const after = moves("gale_klipso", true);
    expect(before.sp).toBeGreaterThan(SP_SLOW_MAX);
    expect(before.reach).toBeGreaterThanOrEqual(2);
    expect(after.reach).toBe(1);
  });

  it("a slow card feels nothing — it already moved 1", () => {
    // The point of pinning it to mobility: PARALYZE is a tax on speed, not a
    // second ROOT. Anything in the SLOW band already moves 1 and feels nothing.
    const s = prepState();
    const slow = place(s, "bore_armadillo", "P1", 2, 1);
    expect(effectiveSp(s, s.cards[slow.instanceId])).toBeLessThanOrEqual(SP_SLOW_MAX);
    const before = moveReachFor(s, s.cards[slow.instanceId]);
    applyStatus(s, slow, "PARALYZE", 2, 0, "BOLT");
    expect(moveReachFor(s, s.cards[slow.instanceId])).toBe(before);
  });

  it("it slows, it does not pin — SP is untouched and the card can still move", () => {
    // ROOT and FREEZE zero SP outright; PARALYZE must stay distinct from both,
    // or the three statuses collapse into one.
    const s = prepState();
    const c = place(s, "gale_klipso", "P1", 2, 1);
    const spBefore = effectiveSp(s, s.cards[c.instanceId]);
    applyStatus(s, c, "PARALYZE", 2, 0, "BOLT");
    expect(effectiveSp(s, s.cards[c.instanceId])).toBe(spBefore); // not zeroed
    expect(moveReachFor(s, s.cards[c.instanceId])).toBe(1); // still mobile
    expect(legalMoves(s, "P1", c.instanceId).length).toBeGreaterThan(0);
  });

  it("the legality check agrees — a 2-step move is refused while paralysed", () => {
    // The AI and canMove both read moveReachFor; if they disagreed the AI would
    // offer moves the rules then reject.
    const s = prepState();
    const c = place(s, "gale_klipso", "P1", 2, 1);
    const twoAway = { row: 0, col: 1 };
    expect(canMove(s, "P1", c.instanceId, twoAway).ok).toBe(true);
    applyStatus(s, c, "PARALYZE", 2, 0, "BOLT");
    expect(canMove(s, "P1", c.instanceId, twoAway).ok).toBe(false);
    expect(canMove(s, "P1", c.instanceId, { row: 1, col: 1 }).ok).toBe(true); // one step still fine
  });
});

describe("WEAKEN stacks", () => {
  /** A clean body plus its printed damage, so every expectation below is
   *  derived from the card rather than typed. */
  function subject() {
    const s = prepState();
    const c = place(s, "pyro_ember_scorpion", "P1", 3, 0);
    return { s, c, base: effectiveDmg(s, s.cards[c.instanceId]) };
  }
  const weaken = (s: ReturnType<typeof subject>["s"], id: string, rounds = 2) =>
    applyStatus(s, s.cards[id], "WEAKEN", rounds, 0, "GALE");

  it("a second application deepens instead of refreshing", () => {
    const { s, c, base } = subject();
    weaken(s, c.instanceId);
    const once = effectiveDmg(s, s.cards[c.instanceId]);
    expect(once).toBe(Math.floor(base * weakenMult(1)));

    weaken(s, c.instanceId);
    expect(s.cards[c.instanceId].statuses.filter((x) => x.kind === "WEAKEN")).toHaveLength(1);
    expect(weakenStacks(s.cards[c.instanceId])).toBe(2);
    const twice = effectiveDmg(s, s.cards[c.instanceId]);
    expect(twice).toBe(Math.floor(base * weakenMult(2)));
    expect(twice, "the whole point — the old flag re-applied to no effect").toBeLessThan(once);
  });

  it("stacks compound rather than adding, and cap", () => {
    const { s, c, base } = subject();
    for (let i = 0; i < WEAKEN_MAX_STACKS + 3; i++) weaken(s, c.instanceId);
    expect(weakenStacks(s.cards[c.instanceId])).toBe(WEAKEN_MAX_STACKS);
    expect(effectiveDmg(s, s.cards[c.instanceId])).toBe(Math.floor(base * weakenMult(WEAKEN_MAX_STACKS)));
    // Compounding never reaches zero, which is the reason it is not additive:
    // an additive 25 per stack is exactly 0 damage at four stacks, and a card
    // dealing 0 has been removed from the game by a status rather than debuffed.
    expect(weakenMult(WEAKEN_MAX_STACKS)).toBeGreaterThan(0);
    expect(effectiveDmg(s, s.cards[c.instanceId])).toBeGreaterThan(0);
  });

  it("a shorter re-application deepens the stack without shortening the timer", () => {
    const { s, c } = subject();
    weaken(s, c.instanceId, 4);
    weaken(s, c.instanceId, 1);
    const st = s.cards[c.instanceId].statuses.find((x) => x.kind === "WEAKEN")!;
    expect(st.duration, "a fresh hit must never cut a debuff already running short").toBe(4);
    expect(weakenStacks(s.cards[c.instanceId])).toBe(2);
  });

  it("Equestrian's Solar Sovereign still blocks it outright, at any depth", () => {
    // The immunity gate sits ahead of the stacking branch; if stacking had been
    // wired in before it, a WEAKEN-immune ally would have started collecting
    // stacks it is supposed to be untouchable by.
    const { s, c } = subject();
    place(s, "dawn_equestrian", "P1", 4, 0);
    for (let i = 0; i < 3; i++) weaken(s, c.instanceId);
    expect(weakenStacks(s.cards[c.instanceId])).toBe(0);
  });
});
