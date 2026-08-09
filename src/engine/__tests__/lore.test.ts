// Lore is keyed by id in a file physically separate from the cards, which buys a
// readable diff and costs a way to be silently wrong: a mistyped key attaches
// prose to nothing, and nothing anywhere complains. These are that complaint.

import { describe, expect, it } from "vitest";
import { CARDS, TOKENS, getDef } from "../../data/cards";
import { LORE, LORE_SOURCES, SPELL_LORE_PREFIX, loreFor, loreForSpell } from "../../data/lore";
import { SPELLS } from "../spells";

const ids = new Set([...CARDS, ...TOKENS].map((c) => c.id).concat(SPELLS.map((s) => s.id)));

describe("lore", () => {
  it("keys only real cards, tokens and spells", () => {
    // The failure this exists for: `leaf_nightshde` looks fine, imports fine,
    // type-checks fine, and that card just never gets its line.
    const orphans = Object.keys(LORE)
      .map((k) => (k.startsWith(SPELL_LORE_PREFIX) ? k.slice(SPELL_LORE_PREFIX.length) : k))
      .filter((id) => !ids.has(id));
    expect(orphans, "lore keyed to ids that do not exist").toEqual([]);
  });

  it("makes the card/spell id collisions carry their own lines", () => {
    // `bolt_zap` and `gale_tempest` are each BOTH a card and a spell, of the same
    // name. Keyed by the bare id, one line would land on both — and the loser is
    // invisible, because the spell simply shows the card's prose. Any colliding id
    // that has lore at all must key the spell form explicitly.
    const cardIds = new Set([...CARDS, ...TOKENS].map((c) => c.id));
    const collisions = SPELLS.filter((s) => cardIds.has(s.id)).map((s) => s.id);
    expect(collisions.length, "collision list is stale — recheck the data").toBeGreaterThan(0);
    for (const id of collisions) {
      const bare = LORE[id];
      const prefixed = LORE[SPELL_LORE_PREFIX + id];
      // Either neither is written yet, or the spell has its own key. What is not
      // allowed is a bare line with no spell key, which silently doubles up.
      if (bare || prefixed)
        expect(prefixed, `${id} is a card AND a spell — key the spell as "${SPELL_LORE_PREFIX}${id}"`)
          .toBeTruthy();
    }
  });

  it("never lets two elements claim the same id", () => {
    // LORE is a spread of the per-element maps, so a duplicate id would resolve
    // to whichever file happens to be last in the list and the other line would
    // vanish with nothing to mark that it was ever written.
    const seen = new Map<string, number>();
    for (const src of LORE_SOURCES)
      for (const id of Object.keys(src)) seen.set(id, (seen.get(id) ?? 0) + 1);
    expect([...seen].filter(([, n]) => n > 1).map(([id]) => id)).toEqual([]);
  });

  it("lands on the definitions, not just in the map", () => {
    // The attach step runs at module load. If it were dropped, LORE would still
    // be perfectly correct and `def.lore` would be undefined everywhere — so the
    // roster and the card inspector would both show nothing while the tests above
    // stayed green.
    for (const key of Object.keys(LORE)) {
      if (key.startsWith(SPELL_LORE_PREFIX)) {
        const id = key.slice(SPELL_LORE_PREFIX.length);
        const spell = SPELLS.find((s) => s.id === id)!;
        expect(spell.lore, `${key} did not reach its spell`).toBe(LORE[key]);
        continue;
      }
      const spell = SPELLS.find((s) => s.id === key);
      // A spell with its own prefixed line resolves to that, not the bare key.
      const expected = spell ? loreForSpell(key) : LORE[key];
      const actual = spell ? spell.lore : getDef(key).lore;
      expect(actual, `${key} has lore in the map but not on its def`).toBe(expected);
    }
  });

  it("exposes the same text through loreFor", () => {
    expect(loreFor("leaf_oakgre")).toBe(LORE.leaf_oakgre);
    expect(loreFor("no_such_card")).toBeUndefined();
  });

  it("gives a colliding card and spell different lines", () => {
    // The concrete case the prefix exists for. `bolt_zap` and `gale_tempest` are
    // each a card AND a spell of the same name; if either collapses to one line,
    // the spell is wearing the card's prose and nothing would say so.
    //
    // Derived from the data rather than hardcoded, so a third collision is covered
    // the moment it appears — and only asserted once both sides are written, so an
    // unwritten element does not fail here.
    const cardIds = new Set([...CARDS, ...TOKENS].map((c) => c.id));
    for (const spell of SPELLS.filter((s) => cardIds.has(s.id))) {
      const card = getDef(spell.id);
      if (!card.lore && !spell.lore) continue; // neither written yet
      expect(card.lore, `${spell.id}: the card has no line`).toBeTruthy();
      expect(spell.lore, `${spell.id}: the spell has no line`).toBeTruthy();
      expect(spell.lore, `${spell.id}: the spell is showing the card's flavour`).not.toBe(card.lore);
    }
  });

  // Elements are listed here as their pass lands, so this goes red when a card is
  // ADDED to a finished element without a line — not merely because the elements
  // still to write have not been written.
  const DONE = ["LEAF", "PYRO", "GALE", "DUSK", "BOLT", "AQUA", "DAWN"] as const;
  for (const el of DONE)
    it(`covers all of ${el} — cards, tokens and spells`, () => {
      const missing = [
        ...[...CARDS, ...TOKENS].filter((c) => c.element === el).filter((c) => !LORE[c.id]),
        // Spells resolve through loreForSpell, not a bare LORE lookup. For a
        // colliding id (gale_tempest) the bare key holds the CARD's line, so
        // checking it would report the spell as covered when it has nothing.
        ...SPELLS.filter((s) => s.element === el).filter((s) => !loreForSpell(s.id)),
      ].map((e) => e.id);
      expect(missing, `${el} entries with no lore`).toEqual([]);
    });
});
