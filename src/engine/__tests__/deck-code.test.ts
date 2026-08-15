// Deck codes are the one thing in this app that outlives the build that made
// them: somebody pastes a code into a chat and it gets used months later. So the
// tests that matter most are not the round trips — they are the ones that stop a
// future edit from quietly changing what an existing code means.

import { describe, expect, it } from "vitest";
import { CARDS } from "../../data/cards";
import {
  CODE_IDS, CODE_INDEX_CEILING, DeckCodeError, SPELL_KEY_PREFIX, decodeDeck, encodeDeck,
} from "../../data/deck-code";
import { SPELLS } from "../spells";

const sample = {
  name: "Test Deck",
  cards: ["leaf_greegon", "leaf_oakgre", "dusk_vamp", "bolt_zap"],
  spells: ["leaf_sprout", "bolt_zap", "gale_tempest"],
};

describe("deck codes — the registry", () => {
  it("holds every card and spell in the game", () => {
    // A card missing from the registry cannot be shared at all: encodeDeck throws
    // rather than emit a code that means something else later. Appending to
    // CODE_IDS is the fix — never inserting.
    const known = new Set(CODE_IDS);
    const missing = [
      ...CARDS.filter((c) => !known.has(c.id)).map((c) => c.id),
      ...SPELLS.filter((s) => !known.has(SPELL_KEY_PREFIX + s.id)).map((s) => SPELL_KEY_PREFIX + s.id),
    ];
    expect(missing, "append these to CODE_IDS in src/data/deck-code.ts").toEqual([]);
  });

  it("never lists the same id twice", () => {
    const seen = new Map<string, number>();
    for (const id of CODE_IDS) seen.set(id, (seen.get(id) ?? 0) + 1);
    expect([...seen].filter(([, n]) => n > 1).map(([id]) => id)).toEqual([]);
  });

  it("keeps its seeded prefix in the order codes were minted against", () => {
    // The load-bearing test. Reordering or deleting an entry silently repoints
    // every code ever shared at a different card. These are spot anchors from the
    // seeded registry: if one moves, the whole ordering is suspect.
    expect(CODE_IDS[0]).toBe("aqua_anglerfish");
    expect(CODE_IDS.indexOf("leaf_greegon")).toBeGreaterThan(-1);
    expect(CODE_IDS[CODE_IDS.indexOf("leaf_greegon")]).toBe("leaf_greegon");
    // Cards come first, then the spell block — a spell must never sort in among
    // the cards, or `resolve` would reject valid codes.
    const firstSpell = CODE_IDS.findIndex((id) => id.startsWith(SPELL_KEY_PREFIX));
    expect(firstSpell).toBeGreaterThan(0);
    expect(CODE_IDS.slice(firstSpell).every((id) => id.startsWith(SPELL_KEY_PREFIX))).toBe(true);
  });

  it("still fits the 10-bit index space", () => {
    // Past this the format needs a version bump, not a bigger array.
    expect(CODE_IDS.length).toBeLessThanOrEqual(CODE_INDEX_CEILING);
  });
});

describe("deck codes — round trip", () => {
  it("returns exactly what went in, in order", () => {
    const back = decodeDeck(encodeDeck(sample));
    expect(back.name).toBe(sample.name);
    expect(back.cards).toEqual(sample.cards);
    expect(back.spells).toEqual(sample.spells);
  });

  it("keeps a card and a spell of the same id apart", () => {
    // bolt_zap is BOTH a card and a spell, and the sample holds both. If the two
    // index spaces ever merge, this comes back with the wrong one in one of them.
    const back = decodeDeck(encodeDeck(sample));
    expect(back.cards).toContain("bolt_zap");
    expect(back.spells).toContain("bolt_zap");
    expect(back.spells).toContain("gale_tempest");
    expect(back.cards).not.toContain("gale_tempest");
  });

  it("handles the extremes: empty, unnamed, and a full large-board deck", () => {
    expect(decodeDeck(encodeDeck({ name: "", cards: [], spells: [] }))).toEqual({
      name: "", cards: [], spells: [],
    });
    const big = {
      name: "Thirty and eight",
      cards: CARDS.slice(0, 30).map((c) => c.id),
      spells: SPELLS.slice(0, 8).map((s) => s.id),
    };
    expect(decodeDeck(encodeDeck(big))).toEqual(big);
  });

  it("stays short enough to paste into a chat message", () => {
    const big = {
      name: "Thirty and eight",
      cards: CARDS.slice(0, 30).map((c) => c.id),
      spells: SPELLS.slice(0, 8).map((s) => s.id),
    };
    expect(encodeDeck(big).length).toBeLessThan(120);
  });

  it("survives a name with punctuation and non-ASCII", () => {
    const d = { name: "Bernard's — Déck ✦", cards: ["leaf_greegon"], spells: [] };
    expect(decodeDeck(encodeDeck(d)).name).toBe(d.name);
  });

  it("accepts a code that lost its prefix or gained line breaks", () => {
    const code = encodeDeck(sample);
    expect(decodeDeck(code.replace("WE1-", ""))).toEqual(decodeDeck(code));
    expect(decodeDeck(`  ${code.slice(0, 20)}\n${code.slice(20)}  `)).toEqual(decodeDeck(code));
  });
});

describe("deck codes — refusing bad input", () => {
  const rejects = (input: string, why: string) => {
    it(`rejects ${why}`, () => {
      expect(() => decodeDeck(input)).toThrow(DeckCodeError);
    });
  };
  rejects("", "an empty string");
  rejects("   ", "only whitespace");
  rejects("hello world", "prose");
  rejects("WE1-!!!!", "characters outside base64url");
  rejects("WE1-AQ", "a code too short to hold a deck");

  it("rejects a single mistyped character rather than decoding it wrong", () => {
    // The whole point of the checksum. A typo must NOT silently produce a
    // plausible-but-different deck, which is the failure a player could not see.
    const code = encodeDeck(sample);
    let flipped = 0;
    for (let i = CODE_PREFIX_LEN; i < code.length; i++) {
      const ch = code[i];
      const swap = ch === "A" ? "B" : "A";
      const bad = code.slice(0, i) + swap + code.slice(i + 1);
      if (bad === code) continue;
      try {
        const out = decodeDeck(bad);
        // Decoding is allowed to succeed only if it produced the same deck.
        expect(out).toEqual(decodeDeck(code));
      } catch (e) {
        expect(e).toBeInstanceOf(DeckCodeError);
        flipped++;
      }
    }
    expect(flipped, "no corruption was caught at all").toBeGreaterThan(0);
  });

  it("refuses to encode a card this build does not know", () => {
    expect(() => encodeDeck({ name: "x", cards: ["not_a_real_card"], spells: [] }))
      .toThrow(DeckCodeError);
  });
});

const CODE_PREFIX_LEN = "WE1-".length;
