// A deck's hand-picked spellbook — the builder helper + how it flows into a
// fresh game (explicit book wins; empty falls back to auto-from-elements).

import { describe, expect, it } from "vitest";
import { SPELLS, spellbookFromIds, spellbookFor, getSpell, spellPickKind, MAX_SPELLBOOK, MAX_SPELLBOOK_LARGE, spellCapForBoard, spellCopyCap } from "../spells";
import { CORES, deckById } from "../../data/cards";
import { createInitialState } from "../state";
import { canCastSpell } from "../rules";
import { applyIntent } from "../phases";
import { place, prepState } from "./helpers";

describe("spellbookFromIds", () => {
  it("keeps order, drops unknowns, HONOURS COPY CAPS, and caps at MAX_SPELLBOOK", () => {
    // Books used to be deduped outright — one of anything, always. Copies are
    // allowed now by COST tier (see `spellCopyCap`), so a cheap spell listed
    // twice is two slots and two casts.
    const ids = [
      "pyro_spark", "not_a_spell", "aqua_chill", "pyro_spark",
      "gale_gust", "dawn_sunbeam", "bore_pebble_toss", "dusk_chill_touch",
    ];
    const book = spellbookFromIds(ids);
    expect(book.length).toBe(MAX_SPELLBOOK);
    expect(book.every((s) => s.used === false), "every slot casts on its own").toBe(true);
    const sparkCap = spellCopyCap("pyro_spark");
    const sparks = book.filter((s) => s.defId === "pyro_spark").length;
    expect(sparks, "the second Spark survives if its cost allows it")
      .toBe(Math.min(2, sparkCap));
    expect(book[0].defId, "order is preserved").toBe("pyro_spark");
    expect(book.some((s) => s.defId === "not_a_spell"), "unknowns dropped").toBe(false);
  });

  it("the copy cap is a COST tier, and the tiers are the printed ones", () => {
    for (const sp of SPELLS) {
      const cap = spellCopyCap(sp.id);
      if (sp.cost >= 6) expect(cap, `${sp.id} costs ${sp.cost}`).toBe(1);
      else if (sp.cost >= 3) expect(cap, `${sp.id} costs ${sp.cost}`).toBe(2);
      else expect(cap, `${sp.id} costs ${sp.cost}`).toBe(Infinity);
    }
  });

  it("an expensive spell is held to ONE however many times it is listed", () => {
    const dear = SPELLS.find((sp) => sp.cost >= 6)!;
    const book = spellbookFromIds([dear.id, dear.id, dear.id], 8);
    expect(book.length, `${dear.id} costs ${dear.cost}`).toBe(1);
  });

  it("a mid-cost spell is held to TWO", () => {
    const mid = SPELLS.find((sp) => sp.cost >= 3 && sp.cost <= 5)!;
    const book = spellbookFromIds([mid.id, mid.id, mid.id, mid.id], 8);
    expect(book.length, `${mid.id} costs ${mid.cost}`).toBe(2);
  });

  it("a cheap spell is limited only by the size of the book", () => {
    const cheap = SPELLS.find((sp) => sp.cost <= 2)!;
    expect(spellCopyCap(cheap.id)).toBe(Infinity);
    const book = spellbookFromIds(Array(20).fill(cheap.id), 8);
    expect(book.length, "the book's own cap is the only limit").toBe(8);
  });

  it("empty input yields an empty book", () => {
    expect(spellbookFromIds([])).toEqual([]);
  });

  it("the large board carries a DEEPER book — 8 spells, not 5", () => {
    // Board-size rule: 5 on the standard 4×4, 8 on the large 5×5. A flat cap
    // silently cut a legal large-board book back to 5 at match setup.
    const ids = [
      "pyro_spark", "aqua_chill", "gale_gust", "dawn_sunbeam", "bore_pebble_toss",
      "dusk_chill_touch", "bolt_zap", "leaf_sprout", "pyro_ember_trap", // 9 valid
    ];
    expect(spellCapForBoard(4)).toBe(MAX_SPELLBOOK);
    expect(spellCapForBoard(5)).toBe(MAX_SPELLBOOK_LARGE);
    expect(spellbookFromIds(ids, spellCapForBoard(5)).length).toBe(8);
    expect(spellbookFromIds(ids, spellCapForBoard(4)).length).toBe(5);
  });

  it("createInitialState gives a 5×5 match the 8-spell book", () => {
    const ids = [
      "pyro_spark", "aqua_chill", "gale_gust", "dawn_sunbeam", "bore_pebble_toss",
      "dusk_chill_touch", "bolt_zap", "leaf_sprout",
    ];
    const large = createInitialState(1, ["leaf_alpha"], ["leaf_nettle"], ["P1"], ids, ids, 5);
    expect(large.players.P1.spellbook.length).toBe(8);
    const small = createInitialState(1, ["leaf_alpha"], ["leaf_nettle"], ["P1"], ids, ids, 4);
    expect(small.players.P1.spellbook.length).toBe(5);
  });
});

describe("createInitialState spellbook wiring", () => {
  const deck = ["leaf_alpha", "leaf_nettle"]; // all-LEAF: auto-book would be LEAF spells only

  it("uses a deck's explicit spellbook verbatim (any element allowed)", () => {
    const spells = ["pyro_spark", "aqua_chill"]; // off-element on purpose
    const g = createInitialState(1, deck, deck, ["P1"], spells, undefined);
    expect(g.players.P1.spellbook.map((s) => s.defId)).toEqual(spells);
    // P2 got no explicit book → auto-derived from its (LEAF) deck, so no PYRO/AQUA.
    expect(g.players.P2.spellbook.map((s) => s.defId)).toEqual(
      spellbookFor(deck).map((s) => s.defId),
    );
  });

  it("falls back to the auto-derived book when none is supplied", () => {
    const g = createInitialState(1, deck, deck, ["P1"]);
    expect(g.players.P1.spellbook.map((s) => s.defId)).toEqual(
      spellbookFor(deck).map((s) => s.defId),
    );
  });
});

describe("a deck that chose NO spells plays with none", () => {
  it("an empty spell list is honoured, not treated as 'unspecified'", () => {
    // The reported bug: a deck saved with no spells showed the whole elemental
    // set in battle and crowded the tray. `[]` fell through to the auto-derive
    // branch because the guard tested `.length`, so "chose none" and "never
    // chose" were the same thing to the engine.
    const s = createInitialState(1, "leaf_pyro", "bore_dusk", ["P1"], [], []);
    expect(s.players.P1.spellbook).toHaveLength(0);
    expect(s.players.P2.spellbook).toHaveLength(0);
  });

  it("...while UNDEFINED still auto-derives from the deck's elements", () => {
    // The distinction has to survive: premades without a spells key rely on it.
    const s = createInitialState(1, "leaf_pyro", "bore_dusk", ["P1"], undefined, undefined);
    expect(s.players.P1.spellbook.length).toBeGreaterThan(0);
  });

  it("a derived book is capped like a hand-picked one", () => {
    // Uncapped, a two-element deck derived up to THIRTEEN spells — over twice
    // the limit a player is allowed to build, and unusable in the tray.
    for (const deck of ["leaf_pyro", "bore_dusk", "aqua_dawn"]) {
      const s = createInitialState(1, deck, deck, ["P1"], undefined, undefined);
      expect(s.players.P1.spellbook.length, `${deck} derived too many`)
        .toBeLessThanOrEqual(MAX_SPELLBOOK);
    }
  });

  it("a hand-picked book is unaffected", () => {
    const s = createInitialState(1, "leaf_pyro", "bore_dusk", ["P1"], ["leaf_sprout"], []);
    expect(s.players.P1.spellbook.map((x) => x.defId)).toEqual(["leaf_sprout"]);
  });
});

describe("a derived book samples the element, not the file", () => {
  it("takes one of each KIND before doubling up", () => {
    // A plain slice(0, 5) took the first five in DECLARATION order, and SPELLS
    // is grouped by kind — so books came out as damage,damage,wall,wall,wall
    // and the later kinds could never appear. The game's only `convert` spell
    // is declared at index 42 and was unreachable in every derived book.
    const book = spellbookFor(deckById("gale_bolt").cards).map((s) => getSpell(s.defId).kind);
    expect(new Set(book).size).toBe(book.length); // no kind repeats while others wait
  });

  it("a single-element BOLT deck can now derive its convert spell", () => {
    // The game's only convert spell. A two-element PAIR has more kinds than the
    // 5 slots, so convert can still lose the draw there — this asserts it is
    // REACHABLE, which under the old first-five slice it never was.
    const bolt = CORES.find((c) => c.id === "bolt")!;
    const book = spellbookFor(bolt.cards).map((s) => s.defId);
    expect(book).toContain("bolt_power_rebate");
  });

  it("...and the cap still holds", () => {
    for (const deck of ["leaf_pyro", "bore_dusk", "aqua_dawn", "gale_bolt"])
      expect(spellbookFor(deckById(deck).cards).length).toBeLessThanOrEqual(MAX_SPELLBOOK);
  });
});

describe("a SECOND copy of a spell is a second cast", () => {
  /** A prep state holding `n` copies of a cheap damage spell and magic to burn. */
  function twoSparks(n = 2) {
    const s = prepState();
    s.prep = { priority: "P1", consecutivePasses: 0, movedThisTurn: false };
    s.players.P1.magicPool = 30;
    s.players.P1.spellbook = Array.from({ length: n }, () => ({ defId: "pyro_spark", used: false }));
    const foe = place(s, "dusk_vamp", "P2", 1, 1, { curHp: 40, maxHp: 40, curShields: 0 });
    return { s, foe };
  }

  it("casting the first copy does NOT retire the second", () => {
    // The bug the copy rule would have shipped with. Legality asked "is the
    // spell spent" by finding the FIRST slot with that id and reading its
    // `used` — so the moment copy #1 was cast, copy #2 sat in the book, in the
    // tray, unspent, and refused with "Already cast this game".
    const { s, foe } = twoSparks();
    s.players.P1.spellbook[0].used = true;
    expect(canCastSpell(s, "P1", "pyro_spark", { targetId: foe.instanceId }).ok,
      "the unspent copy is still castable").toBe(true);
  });

  it("...and the last copy DOES retire it", () => {
    const { s, foe } = twoSparks();
    for (const sl of s.players.P1.spellbook) sl.used = true;
    const check = canCastSpell(s, "P1", "pyro_spark", { targetId: foe.instanceId });
    expect(check.ok).toBe(false);
    expect(check.reason).toBe("Already cast this game");
  });

  it("each cast spends its OWN slot and its OWN magic", () => {
    // The spend used the same first-match `find`, so the second cast re-marked
    // the already-used slot: the spell fired, nothing was consumed, and it was
    // castable again — a cheap spell with infinite uses.
    const { s, foe } = twoSparks();
    const before = s.players.P1.magicPool;
    const cost = getSpell("pyro_spark").cost;
    const a = applyIntent(s, { type: "CAST_SPELL", player: "P1", spellId: "pyro_spark", targetId: foe.instanceId });
    expect(a.players.P1.spellbook.filter((x) => x.used).length, "one spent").toBe(1);
    expect(a.players.P1.magicPool).toBe(before - cost);

    a.prep = { priority: "P1", consecutivePasses: 0, movedThisTurn: false };
    const b = applyIntent(a, { type: "CAST_SPELL", player: "P1", spellId: "pyro_spark", targetId: foe.instanceId });
    expect(b.players.P1.spellbook.filter((x) => x.used).length, "then the other").toBe(2);
    expect(b.players.P1.magicPool, "paid for twice").toBe(before - cost * 2);
    expect(b.cards[foe.instanceId].curHp, "and it landed twice").toBeLessThan(40 - 1);
  });

  it("the third cast is refused — the book is out of copies", () => {
    const { s, foe } = twoSparks();
    let g = s;
    for (let i = 0; i < 2; i++) {
      g.prep = { priority: "P1", consecutivePasses: 0, movedThisTurn: false };
      g = applyIntent(g, { type: "CAST_SPELL", player: "P1", spellId: "pyro_spark", targetId: foe.instanceId });
    }
    g.prep = { priority: "P1", consecutivePasses: 0, movedThisTurn: false };
    expect(canCastSpell(g, "P1", "pyro_spark", { targetId: foe.instanceId }).ok).toBe(false);
  });
});

describe("every spell is castable by hand", () => {
  it("spellPickKind classifies all 80, and matches what canCastSpell demands", () => {
    // The UI decides three things from this — arm or fire immediately, which
    // squares glow, and what a click does. Each was derived separately and each
    // got it wrong: traps had their column dropped in the reducer, and Rewire /
    // Full Reroute auto-fired with no picks, so the multi-pick flow could never
    // be reached at all. This walks the whole set and proves the classification
    // agrees with the legality rules.
    const wrong: string[] = [];
    for (const spell of SPELLS) {
      const kind = spellPickKind(spell);
      const s = prepState();
      s.prep = { priority: "P1", consecutivePasses: 0, movedThisTurn: false };
      s.players.P1.magicPool = 30;
      s.players.P1.spellbook = [{ defId: spell.id, used: false }];
      // A board of every element, so element-gated riders always have a target.
      for (const [i, id] of ["leaf_greegon", "pyro_firebird", "aqua_spinefin", "bolt_zap"].entries())
        place(s, id, "P1", 3, i, { curHp: 5, maxHp: 20 });
      for (const [i, id] of ["dusk_gool", "dawn_sparkle", "gale_duster", "bore_clubber"].entries())
        place(s, id, "P1", 2, i, { curHp: 5, maxHp: 20 });
      place(s, "dusk_vamp", "P2", 1, 1, { curHp: 40, maxHp: 40 });
      // A spell classified "none" MUST be legal with no picks at all — that is
      // exactly the promise the tray relies on when it fires immediately.
      if (kind === "none" && !canCastSpell(s, "P1", spell.id, {}).ok)
        wrong.push(`${spell.id}: classified "none" but needs ${canCastSpell(s, "P1", spell.id, {}).reason}`);
      // ...and one that DOES need picks must be refused without them, or the
      // tray would fire it into a no-op.
      if (kind !== "none" && kind !== "mode" && canCastSpell(s, "P1", spell.id, {}).ok)
        wrong.push(`${spell.id}: classified "${kind}" but casts with no picks`);
    }
    expect(wrong, `pick classification disagrees with legality:\n  ${wrong.join("\n  ")}`).toEqual([]);
  });

  it("the two multi-pick spells are classified as such", () => {
    // Regression guard for the specific bug: both ride kind "convert", which the
    // tray fires on sight. Only the swapAllies / rerouteCount flags separate them.
    expect(spellPickKind(getSpell("bolt_rewire"))).toBe("cards");
    expect(spellPickKind(getSpell("bolt_full_reroute"))).toBe("cards");
    // ...while the genuinely targetless converts still resolve on the spot.
    expect(spellPickKind(getSpell("bolt_recon_ping"))).toBe("none");
    expect(spellPickKind(getSpell("bolt_system_override"))).toBe("none");
    expect(spellPickKind(getSpell("bolt_power_rebate"))).toBe("none");
  });

  it("every trap asks for a SLOT, not a row", () => {
    // Traps take row AND col. Classifying one as "row" would drop the column and
    // the cast would fail with "Pick a slot" — which is exactly what the reducer
    // did before it threaded col through.
    for (const s of SPELLS.filter((x) => x.kind === "trap"))
      expect(spellPickKind(s), `${s.id}`).toBe("slot");
  });
});

describe("a derived spellbook obeys the same cap as a hand-picked one", () => {
  it("fills to the LARGE cap on a 5x5 board", () => {
    // The bug: emptyPlayer computed spellCapForBoard() and handed it to the
    // hand-picked branch only, while the derived branch hard-capped at 5. Every
    // story, arena and AI match without a custom book therefore fought three
    // spells short of its allowance on the large board, and the two halves of
    // one ternary disagreed about the rules.
    const large = createInitialState(1, CORES[0].cards, CORES[1].cards, ["P1"], undefined, undefined, 5);
    expect(large.players.P1.spellbook.length).toBe(MAX_SPELLBOOK_LARGE);
    const small = createInitialState(1, CORES[0].cards, CORES[1].cards, ["P1"], undefined, undefined, 4);
    expect(small.players.P1.spellbook.length).toBe(MAX_SPELLBOOK);
  });
});
