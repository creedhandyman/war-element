// Milestone 5: Cleanup order — DOT -> REGEN -> tick durations -> flags.

import { describe, expect, it } from "vitest";
import { advance } from "../phases";
import { atCleanup, place, prepState } from "./helpers";
import { MAX_ROUNDS } from "../types";

describe("cleanup phase", () => {
  it("DOT bypasses shields, hits HP directly, strips nothing", () => {
    const s = prepState();
    const t = place(s, "bore_armadillo", "P2", 0, 0, {
      curHp: 15,
      maxHp: 15,
      curShields: 4,
      status: { kind: "DOT", duration: 2, power: 3, source: "DUSK" },
    });
    place(s, "leaf_alpha", "P1", 3, 0); // keep both boards non-empty
    const next = advance(atCleanup(s));
    const after = next.cards[t.instanceId];
    expect(after.curHp).toBe(12);
    expect(after.curShields).toBe(4);
  });

  it("different DOTs coexist and BOTH tick (BLEED + BURN)", () => {
    const s = prepState();
    const t = place(s, "bore_armadillo", "P2", 0, 0, {
      curHp: 15,
      maxHp: 15,
      curShields: 2,
    });
    t.statuses = [
      { kind: "BLEED", duration: 2, power: 2, source: "LEAF" },
      { kind: "BURN", duration: 2, power: 3, source: "PYRO" },
    ];
    place(s, "leaf_alpha", "P1", 3, 0);
    const next = advance(atCleanup(s));
    const after = next.cards[t.instanceId];
    expect(after.curHp).toBe(10); // 15 − 2 (BLEED) − 3 (BURN)
    expect(after.curShields).toBe(1); // only BURN melts a shield
    expect(after.statuses).toHaveLength(2); // both ticked down to 1 round left
  });

  it("Thorn's Transfusion heals for the total BLEED its enemies take", () => {
    const s = prepState();
    const thorn = place(s, "leaf_thorn", "P1", 3, 0, { curHp: 10, maxHp: 18 });
    place(s, "bore_armadillo", "P2", 0, 0, {
      curHp: 15,
      maxHp: 15,
      status: { kind: "BLEED", duration: 2, power: 2, source: "LEAF" },
    });
    place(s, "bore_armadillo", "P2", 0, 1, {
      curHp: 15,
      maxHp: 15,
      status: { kind: "BLEED", duration: 2, power: 3, source: "LEAF" },
    });
    const next = advance(atCleanup(s));
    // 2 + 3 = 5 BLEED dealt to P2 → Thorn drains 5 (10 → 15), then LEAF
    // Photosynthesis adds its usual +1 (→ 16).
    expect(next.cards[thorn.instanceId].curHp).toBe(16);
  });

  it("Thorn's Transfusion heal is capped at maxHp", () => {
    const s = prepState();
    const thorn = place(s, "leaf_thorn", "P1", 3, 0, { curHp: 17, maxHp: 18 });
    place(s, "bore_armadillo", "P2", 0, 0, {
      curHp: 15,
      maxHp: 15,
      status: { kind: "BLEED", duration: 2, power: 6, source: "LEAF" },
    });
    const next = advance(atCleanup(s));
    expect(next.cards[thorn.instanceId].curHp).toBe(18); // 17 + min(1, 6)
  });

  it("BURN is the exception: its tick also melts 1 shield", () => {
    const s = prepState();
    const t = place(s, "bore_armadillo", "P2", 0, 0, {
      curHp: 15,
      maxHp: 15,
      curShields: 4,
      status: { kind: "BURN", duration: 2, power: 3, source: "PYRO" },
    });
    place(s, "leaf_alpha", "P1", 3, 0);
    const next = advance(atCleanup(s));
    const after = next.cards[t.instanceId];
    expect(after.curHp).toBe(12); // damage still bypasses the gate
    expect(after.curShields).toBe(3); // and one shield melts
  });

  it("DOT can kill; the card is removed", () => {
    const s = prepState();
    const t = place(s, "dusk_vamp", "P2", 0, 0, {
      curHp: 2,
      maxHp: 6,
      status: { kind: "BLEED", duration: 3, power: 3, source: "LEAF" },
    });
    place(s, "leaf_alpha", "P1", 3, 0);
    place(s, "dusk_gool", "P2", 0, 1); // so P2 isn't eliminated
    const next = advance(atCleanup(s));
    expect(next.cards[t.instanceId]).toBeUndefined();
  });

  it("REGEN heals after DOT (a regen tank survives its burn)", () => {
    const s = prepState();
    const t = place(s, "leaf_greegon", "P1", 3, 0, {
      curHp: 2,
      maxHp: 17,
      status: { kind: "BURN", duration: 1, power: 1, source: "PYRO" },
    });
    place(s, "dusk_gool", "P2", 0, 1);
    const next = advance(atCleanup(s));
    // 2 -1 (BURN) +2 (REGEN) +1 (LEAF Photosynthesis aura) = 4
    expect(next.cards[t.instanceId].curHp).toBe(4);
  });

  it("the LEAF alpha aura gives +1 HP at end of round (LEAF cards only)", () => {
    const s = prepState();
    const leaf = place(s, "leaf_alpha", "P1", 3, 0, { curHp: 5, maxHp: 14 });
    const pyro = place(s, "pyro_firebird", "P1", 3, 1, { curHp: 5, maxHp: 11 });
    place(s, "dusk_gool", "P2", 0, 1);
    const next = advance(atCleanup(s));
    expect(next.cards[leaf.instanceId].curHp).toBe(6);
    expect(next.cards[pyro.instanceId].curHp).toBe(5);
  });

  it("status durations tick down and expire", () => {
    const s = prepState();
    const oneRound = place(s, "leaf_alpha", "P1", 3, 0, {
      status: { kind: "FRIGHTEN", duration: 1, power: 0, source: "DUSK" },
    });
    const twoRounds = place(s, "leaf_greegon", "P1", 3, 1, {
      status: { kind: "SLEEP", duration: 2, power: 0, source: "BORE" },
    });
    place(s, "dusk_gool", "P2", 0, 1);
    const next = advance(atCleanup(s));
    expect(next.cards[oneRound.instanceId].statuses).toHaveLength(0);
    expect(next.cards[twoRounds.instanceId].statuses[0]?.duration).toBe(1);
  });

  it("clears summonedThisRound and re-engages STEALTH (attackedThisRound)", () => {
    const s = prepState();
    const c = place(s, "dusk_widowbite", "P2", 0, 0, {
      summonedThisRound: true,
      attackedThisRound: true,
    });
    place(s, "leaf_alpha", "P1", 3, 0);
    const next = advance(atCleanup(s));
    expect(next.cards[c.instanceId].summonedThisRound).toBe(false);
    expect(next.cards[c.instanceId].attackedThisRound).toBe(false);
  });

  it("rolls into the next round's draw phase when nobody has won", () => {
    const s = prepState();
    place(s, "leaf_alpha", "P1", 3, 0);
    place(s, "dusk_gool", "P2", 0, 1);
    const beforeRound = s.round;
    const next = advance(atCleanup(s));
    expect(next.round).toBe(beforeRound + 1);
    expect(next.phase).toBe("draw");
  });
});

describe("the round cap", () => {
  /** A live board parked on the final round, so the next Cleanup decides it. */
  function atFinalRound() {
    const s = prepState();
    s.round = MAX_ROUNDS;
    return s;
  }

  it("ends the match at MAX_ROUNDS instead of starting another round", () => {
    const s = atFinalRound();
    place(s, "leaf_alpha", "P1", 3, 0);
    place(s, "dusk_gool", "P2", 0, 1);
    const next = advance(atCleanup(s));
    expect(next.phase).toBe("gameover");
    expect(next.win?.by).toBe("timeout");
    expect(next.round).toBe(MAX_ROUNDS); // no further round was started
  });

  it("decides on captured home slots before anything else", () => {
    const s = atFinalRound();
    // P2 is far ahead on the board but P1 holds a home slot — the slot wins it,
    // because that IS the win condition.
    place(s, "leaf_alpha", "P1", 3, 0, { curHp: 1 });
    place(s, "dusk_gool", "P2", 0, 1, { curHp: 40, maxHp: 40 });
    place(s, "dusk_vamp", "P2", 0, 2, { curHp: 40, maxHp: 40 });
    s.slots[0][3].capturedBy = "P1";
    const next = advance(atCleanup(s));
    expect(next.win).toEqual({ winner: "P1", by: "timeout" });
  });

  it("falls through to cards standing, then to total HP", () => {
    const byCount = atFinalRound();
    place(byCount, "leaf_alpha", "P1", 3, 0, { curHp: 1 });
    place(byCount, "leaf_greegon", "P1", 3, 1, { curHp: 1 });
    place(byCount, "dusk_gool", "P2", 0, 1, { curHp: 40, maxHp: 40 });
    expect(advance(atCleanup(byCount)).win?.winner).toBe("P1"); // 2 cards vs 1

    const byHp = atFinalRound();
    place(byHp, "leaf_alpha", "P1", 3, 0, { curHp: 5 });
    place(byHp, "dusk_gool", "P2", 0, 1, { curHp: 12, maxHp: 40 });
    expect(advance(atCleanup(byHp)).win?.winner).toBe("P2"); // level on cards, 12 > 5
  });

  it("calls a dead-level board a draw rather than inventing a winner", () => {
    const s = atFinalRound();
    // Neither BORE nor DUSK heals at Cleanup — a LEAF card here would take
    // Photosynthesis's +1 HP first and break the tie before it was judged.
    place(s, "bore_armadillo", "P1", 3, 0, { curHp: 9, maxHp: 40 });
    place(s, "dusk_gool", "P2", 0, 1, { curHp: 9, maxHp: 40 });
    const next = advance(atCleanup(s));
    expect(next.phase).toBe("gameover");
    expect(next.win).toEqual({ winner: null, by: "timeout" });
  });
});
