// Milestone 5: Cleanup order — DOT -> REGEN -> tick durations -> flags.

import { describe, expect, it } from "vitest";
import { advance } from "../phases";
import { atCleanup, place, prepState } from "./helpers";
import { DAWN_SP_CAP, GALE_SP_CAP, LEAF_SHIELD_CAP } from "../auras";
import { effectiveSp } from "../state";
import { basicAttack } from "../combat";
import { getDef } from "../../data/cards";
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
    expect(after.curShields).toBe(0); // only BURN melts shields (−2)
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
    // Photosynthesis adds its +2 (→ 17).
    expect(next.cards[thorn.instanceId].curHp).toBe(17);
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

  it("BURN is the exception: its tick also melts shields", () => {
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
    expect(after.curShields).toBe(2); // and shields melt (−2)
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
    // 2 -1 (BURN) +1 (REGEN 2, taxed to 1) +1 (LEAF aura 2, taxed to 1) = 3.
    // Searing (PYRO matchup): a BURNing card heals at 75%, and both heals here
    // land while the burn is still on it — the tank still survives, but the
    // burn now genuinely outpaces part of its regen.
    expect(next.cards[t.instanceId].curHp).toBe(3);
  });

  it("the LEAF alpha aura gives +2 HP at end of round (LEAF cards only)", () => {
    const s = prepState();
    const leaf = place(s, "leaf_alpha", "P1", 3, 0, { curHp: 5, maxHp: 14 });
    const pyro = place(s, "pyro_firebird", "P1", 3, 1, { curHp: 5, maxHp: 11 });
    place(s, "dusk_gool", "P2", 0, 1);
    const next = advance(atCleanup(s));
    expect(next.cards[leaf.instanceId].curHp).toBe(7); // +2, raised from +1
    expect(next.cards[pyro.instanceId].curHp).toBe(5); // non-LEAF untouched
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

describe("Sticky (Stickers): four jabs build one wound", () => {
  it("stacks BLEED across its own volley instead of overwriting it", () => {
    // A same-kind status REPLACES rather than adds, so before `stack` all four
    // of Stickers' jabs left a single BLEED 1 — 1 damage total from a card whose
    // whole identity is feeding bleed.
    const s = prepState();
    const st = place(s, "leaf_stickers", "P1", 3, 0);
    const foe = place(s, "dusk_gool", "P2", 2, 0, { curHp: 40, maxHp: 40, curShields: 0 });
    basicAttack(s, st.instanceId, foe.instanceId);
    const bleed = s.cards[foe.instanceId].statuses.find((x) => x.kind === "BLEED");
    expect(bleed?.power).toBeGreaterThan(1); // built, not overwritten
    expect(bleed?.duration).toBe(2);
  });

  it("...but never past its stack cap", () => {
    const s = prepState();
    const st = place(s, "leaf_stickers", "P1", 3, 0);
    const foe = place(s, "dusk_gool", "P2", 2, 0, { curHp: 99, maxHp: 99, curShields: 0 });
    for (let i = 0; i < 4; i++) basicAttack(s, st.instanceId, foe.instanceId);
    const cap = getDef("leaf_stickers").onHitStatus!.stackCap!;
    expect(s.cards[foe.instanceId].statuses.find((x) => x.kind === "BLEED")!.power).toBe(cap);
  });
});

describe("First Light (DAWN): +1 SP a round, to a low cap", () => {
  it("quickens a DAWN card each round", () => {
    const s = prepState();
    const dawn = place(s, "dawn_beam", "P1", 3, 0);
    place(s, "dusk_gool", "P2", 0, 3);
    const before = effectiveSp(s, s.cards[dawn.instanceId]);
    const n = advance(atCleanup(s));
    expect(effectiveSp(n, n.cards[dawn.instanceId])).toBe(before + 1);
  });

  it("stops at the cap, which is well under GALE's", () => {
    expect(DAWN_SP_CAP).toBeLessThan(GALE_SP_CAP); // speed stays GALE's identity
    const s = prepState();
    const dawn = place(s, "dawn_beam", "P1", 3, 0);
    place(s, "dusk_gool", "P2", 0, 3);
    let n = s;
    for (let i = 0; i < 20; i++) n = advance(atCleanup(n));
    const def = getDef("dawn_beam");
    expect(def.sp + n.cards[dawn.instanceId].spBonus).toBeLessThanOrEqual(DAWN_SP_CAP);
  });

  it("non-DAWN cards are not quickened", () => {
    const s = prepState();
    const pyro = place(s, "pyro_firebird", "P1", 3, 1);
    place(s, "dusk_gool", "P2", 0, 3);
    const before = effectiveSp(s, s.cards[pyro.instanceId]);
    const n = advance(atCleanup(s));
    expect(effectiveSp(n, n.cards[pyro.instanceId])).toBe(before);
  });
});

describe("Photosynthesis: heal 2, and bark up where it was struck", () => {
  it("a LEAF card that was HIT banks a shield", () => {
    // The trigger is damage TAKEN, not full health. Full-health was tried first
    // and measured almost nothing: in the seat where LEAF needed the help it was
    // under fire every round, so it never reached full health to bank anything.
    const s = prepState();
    const leaf = place(s, "leaf_alpha", "P1", 3, 0, { curShields: 0, curHp: 10, maxHp: 14 });
    const foe = place(s, "dusk_gool", "P2", 3, 1);
    basicAttack(s, foe.instanceId, leaf.instanceId);
    const n = advance(atCleanup(s));
    expect(n.cards[leaf.instanceId].curShields).toBe(1);
  });

  it("...one shield PER HIT, so a heavy round armours harder", () => {
    // The whole point of the trigger. It used to bank a flat +1 however many
    // times the card was struck, so three hits armoured exactly as well as one
    // — which read from the outside as the aura not firing.
    const s = prepState();
    const leaf = place(s, "leaf_alpha", "P1", 3, 0, { curShields: 0, curHp: 40, maxHp: 40 });
    const foe = place(s, "dusk_gool", "P2", 3, 1);
    for (let i = 0; i < 3; i++) basicAttack(s, foe.instanceId, leaf.instanceId);
    expect(s.cards[leaf.instanceId].hitsTakenThisRound).toBe(3);
    const n = advance(atCleanup(s));
    expect(n.cards[leaf.instanceId].curShields).toBe(3);
  });

  it("...but never past the cap, however many hits land", () => {
    const s = prepState();
    const leaf = place(s, "leaf_alpha", "P1", 3, 0, { curShields: 2, curHp: 40, maxHp: 40 });
    const foe = place(s, "dusk_gool", "P2", 3, 1);
    for (let i = 0; i < 4; i++) basicAttack(s, foe.instanceId, leaf.instanceId);
    const n = advance(atCleanup(s));
    expect(n.cards[leaf.instanceId].curShields).toBe(LEAF_SHIELD_CAP); // 2 + 4 clamped to 3
  });

  it("a LEAF card that PRINTS shields can still earn bark", () => {
    // The regression this guards: the cap used to test TOTAL shields, so every
    // LEAF card printing 3+ (Thorn, Trinezer, Dandelion, Sakuroot, Warden,
    // Elderroot — the whole top of the element) started at or over the line and
    // could never gain anything from half its own element aura. The ceiling is
    // printed shields + cap, so every LEAF card has the same 3 bark to earn.
    const s = prepState();
    const printed = getDef("leaf_sakuroot").shields; // 4
    expect(printed).toBeGreaterThanOrEqual(LEAF_SHIELD_CAP); // else this proves nothing
    const leaf = place(s, "leaf_sakuroot", "P1", 3, 0, { curShields: printed, curHp: 40, maxHp: 40 });
    const foe = place(s, "dusk_gool", "P2", 3, 1);
    for (let i = 0; i < 2; i++) basicAttack(s, foe.instanceId, leaf.instanceId);
    const n = advance(atCleanup(s));
    // Two hits strip 2 shields (one per landed hit), then Photosynthesis banks
    // 2 back — so what matters is that it grew at all above where it landed.
    expect(n.cards[leaf.instanceId].curShields).toBeGreaterThan(printed - 2);
    expect(n.cards[leaf.instanceId].curShields).toBeLessThanOrEqual(printed + LEAF_SHIELD_CAP);
  });

  it("...and the ceiling rides on printed shields, not a flat total", () => {
    const s = prepState();
    const printed = getDef("leaf_sakuroot").shields;
    // Parked at the ceiling already: no amount of punishment adds more.
    const leaf = place(s, "leaf_sakuroot", "P1", 3, 0, {
      curShields: printed + LEAF_SHIELD_CAP, curHp: 40, maxHp: 40, hitsTakenThisRound: 5,
    });
    place(s, "dusk_gool", "P2", 0, 3);
    const n = advance(atCleanup(s));
    expect(n.cards[leaf.instanceId].curShields).toBe(printed + LEAF_SHIELD_CAP);
  });

  it("an untouched LEAF card banks nothing — it only heals", () => {
    const s = prepState();
    const leaf = place(s, "leaf_alpha", "P1", 3, 0, { curShields: 0, curHp: 5, maxHp: 14 });
    place(s, "dusk_gool", "P2", 0, 1);
    const n = advance(atCleanup(s));
    expect(n.cards[leaf.instanceId].curHp).toBe(7); // +2
    expect(n.cards[leaf.instanceId].curShields).toBe(0); // never struck
  });

  it("the armour stops at 3 — a comeback aura, not a stall engine", () => {
    const s = prepState();
    const leaf = place(s, "leaf_alpha", "P1", 3, 0, { curShields: 0, curHp: 99, maxHp: 99 });
    const foe = place(s, "dusk_gool", "P2", 3, 1);
    let n = s;
    for (let i = 0; i < 6; i++) {
      basicAttack(n, foe.instanceId, leaf.instanceId);
      n = advance(atCleanup(n));
    }
    expect(n.cards[leaf.instanceId].curShields).toBeLessThanOrEqual(LEAF_SHIELD_CAP);
  });

  it("non-LEAF cards get neither half", () => {
    const s = prepState();
    const pyro = place(s, "pyro_firebird", "P1", 3, 1, { curShields: 0 });
    const foe = place(s, "dusk_gool", "P2", 3, 2);
    basicAttack(s, foe.instanceId, pyro.instanceId);
    const n = advance(atCleanup(s));
    expect(n.cards[pyro.instanceId].curShields).toBe(0);
  });
});

describe("cleanup does not kill a card twice", () => {
  it("a card blown up by another card's death does not then tick its own DOT into a second defeat", () => {
    const s = prepState();
    // Canister ticks first (insertion order drives the Cleanup sweep) and its
    // own BURN finishes it. KaBoooom then kills the victim standing beside it.
    // The victim is still in the snapshot the loop is walking, and still holds a
    // DOT — which is exactly the shape that used to defeat it a second time.
    const bomb = place(s, "pyro_canister", "P1", 3, 0, {
      curHp: 2, maxHp: 15,
      status: { kind: "BURN", duration: 3, power: 5, source: "PYRO" },
    });
    // Genuinely beside the bomb. It used to sit in P2's home row three squares
    // away and still get caught, because KaBoooom hit the whole board; now the
    // blast has a radius, so the position has to match what this test says it is.
    const victim = place(s, "bore_armadillo", "P2", 2, 0, {
      curHp: 3, maxHp: 15, curShields: 0,
      status: { kind: "BLEED", duration: 3, power: 1, source: "DUSK" },
    });
    const next = advance(atCleanup(s));
    expect(next.cards[bomb.instanceId]?.pos ?? null).toBe(null); // the bomb went off
    const defeats = next.log.filter((l) => l.includes("Armadillo") && l.includes("is defeated")).length;
    expect(defeats).toBe(1);
    // Deaths are what the match report counts; a double defeat inflated it.
    expect(next.players.P2.deaths).toBe(1);
    expect(next.cards[victim.instanceId]?.pos ?? null).toBe(null);
  });
});
