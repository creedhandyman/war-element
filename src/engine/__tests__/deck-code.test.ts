// Deck codes are the one thing in this app that outlives the build that made
// them: somebody pastes a code into a chat and it gets used months later. So the
// tests that matter most are not the round trips — they are the ones that stop a
// future edit from quietly changing what an existing code means.

import { describe, expect, it } from "vitest";
import { CARDS } from "../../data/cards";
import {
  CODE_IDS, CODE_INDEX_CEILING, DECK_LINK_PARAM, DeckCodeError, SPELL_KEY_PREFIX,
  deckCodeFromUrl, deckLinkFor, decodeDeck, encodeDeck,
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
    // The seeded registry was written cards-then-spells, and this used to assert
    // that everything after the first spell IS a spell. That is stricter than
    // the format needs, and it collided with the rule that actually protects
    // shared codes: `resolve` reads the id AT AN INDEX and branches on its
    // `spell:` prefix, never on where it sits, so a card appended after the
    // spell block decodes correctly. Keeping the old assertion would have meant
    // inserting new cards ahead of the spells — which shifts every spell index
    // and silently repoints every code ever shared that carried one.
    //
    // So: append-only wins, and what is checked here is what `resolve` relies
    // on — that a spell is always distinguishable from a card by prefix alone.
    const firstSpell = CODE_IDS.findIndex((id) => id.startsWith(SPELL_KEY_PREFIX));
    expect(firstSpell).toBeGreaterThan(0);
    // The seeded spell block is still contiguous where it was written.
    const lastSpell = CODE_IDS.map((id) => id.startsWith(SPELL_KEY_PREFIX)).lastIndexOf(true);
    expect(
      CODE_IDS.slice(firstSpell, lastSpell + 1).every((id) => id.startsWith(SPELL_KEY_PREFIX)),
      "a card was inserted INTO the spell block — append instead",
    ).toBe(true);
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

describe("deck codes — sharing by link", () => {
  it("survives the whole trip: deck -> link -> query string -> deck", () => {
    const link = deckLinkFor(encodeDeck(sample), "https://war.example.com/play");
    const back = decodeDeck(deckCodeFromUrl(new URL(link).search)!);
    expect(back).toEqual(sample);
  });

  it("builds a link that is actually a URL", () => {
    const link = deckLinkFor(encodeDeck(sample), "https://war.example.com/play");
    expect(() => new URL(link)).not.toThrow();
    expect(new URL(link).searchParams.get(DECK_LINK_PARAM)).toBeTruthy();
  });

  it("does not double up on an origin that already has a query or hash", () => {
    // location.origin + pathname is the normal input, but a caller passing the
    // whole href would otherwise produce ...?deck=x?deck=y.
    const link = deckLinkFor("WE1-abc", "https://war.example.com/play/?deck=old#frag");
    expect(link).toBe("https://war.example.com/play/?deck=WE1-abc");
    expect(link.match(/deck=/g)).toHaveLength(1);
  });

  it("does not care about a trailing slash", () => {
    expect(deckLinkFor("WE1-abc", "https://x.dev/")).toBe(deckLinkFor("WE1-abc", "https://x.dev"));
  });

  it("finds no code when there is none, and ignores empty ones", () => {
    expect(deckCodeFromUrl("")).toBeNull();
    expect(deckCodeFromUrl("?other=1")).toBeNull();
    expect(deckCodeFromUrl(`?${DECK_LINK_PARAM}=`)).toBeNull();
    expect(deckCodeFromUrl(`?${DECK_LINK_PARAM}=%20%20`)).toBeNull();
  });

  it("reads the code with or without a leading question mark", () => {
    expect(deckCodeFromUrl(`?${DECK_LINK_PARAM}=WE1-abc`)).toBe("WE1-abc");
    expect(deckCodeFromUrl(`${DECK_LINK_PARAM}=WE1-abc`)).toBe("WE1-abc");
  });

  it("hands a bad code back intact rather than swallowing it", () => {
    // The caller decodes, so the failure can be shown next to the deck it failed
    // to load rather than vanishing into a null here.
    expect(deckCodeFromUrl(`?${DECK_LINK_PARAM}=nonsense`)).toBe("nonsense");
    expect(() => decodeDeck("nonsense")).toThrow(DeckCodeError);
  });
});

describe("deck codes — board size", () => {
  it("carries the battlefield through a round trip", () => {
    for (const boardSize of [4, 5] as const) {
      const back = decodeDeck(encodeDeck({ ...sample, boardSize }));
      expect(back.boardSize).toBe(boardSize);
    }
  });

  it("omits the field entirely when the deck does not say", () => {
    // Story teams are built to a node's cap, not a battlefield, so they encode
    // no board — and an importer must be able to tell "no opinion" from "4x4".
    expect(decodeDeck(encodeDeck(sample)).boardSize).toBeUndefined();
    expect("boardSize" in decodeDeck(encodeDeck(sample))).toBe(false);
  });

  it("ignores a board size that is not a real battlefield", () => {
    expect(decodeDeck(encodeDeck({ ...sample, boardSize: 9 })).boardSize).toBeUndefined();
    expect(decodeDeck(encodeDeck({ ...sample, boardSize: 0 })).boardSize).toBeUndefined();
  });

  it("still reads v1 codes minted before the field existed", () => {
    // These two were generated by the previous release and copied by real people
    // on the day it shipped. A format change that broke codes already in
    // circulation would defeat the entire point of having codes.
    const v1Four = "WE1-AQpPd25lZCBGb3VyBABAj8Q89ww";
    const four = decodeDeck(v1Four);
    expect(four.name).toBe("Owned Four");
    expect(four.cards).toEqual(["leaf_sakuroot", "leaf_nettle", "leaf_weeds", "leaf_greegon"]);
    expect(four.spells).toEqual([]);
    expect(four.boardSize, "v1 said nothing about the board").toBeUndefined();

    const v1Frostkeep = "WE1-AQlGcm9zdGtlZXASBQjAkHQaBsHgECACgmBcFAkBkFQDA0GE4T1O0-Totg";
    const fk = decodeDeck(v1Frostkeep);
    expect(fk.name).toBe("Frostkeep");
    expect(fk.cards).toHaveLength(18);
    expect(fk.spells).toHaveLength(5);
    expect(fk.boardSize).toBeUndefined();
  });

  it("refuses a version it does not know rather than guessing", () => {
    // A v3 code reaching an old build must say so, not silently misread the byte
    // layout and hand back a deck that is subtly wrong.
    const code = encodeDeck({ ...sample, boardSize: 4 });
    const bytes = Array.from(atob(code.slice(4).replace(/-/g, "+").replace(/_/g, "/")),
      (c) => c.charCodeAt(0));
    bytes[0] = 3;
    // Re-checksum so it fails on the VERSION, not on corruption.
    let h = 0x811c9dc5;
    for (const b of bytes.slice(0, -1)) { h ^= b; h = Math.imul(h, 0x01000193) >>> 0; }
    bytes[bytes.length - 1] = (h ^ (h >>> 16) ^ (h >>> 24)) & 0xff;
    let bin = ""; for (const b of bytes) bin += String.fromCharCode(b);
    const v3 = "WE1-" + btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    expect(() => decodeDeck(v3)).toThrow(/version 3/);
  });
});
