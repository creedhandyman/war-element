// Lore is keyed by id in a file physically separate from the cards, which buys a
// readable diff and costs a way to be silently wrong: a mistyped key attaches
// prose to nothing, and nothing anywhere complains. These are that complaint.

import { describe, expect, it } from "vitest";
import { CARDS, TOKENS, getDef } from "../../data/cards";
import { LORE, LORE_SOURCES, loreFor } from "../../data/lore";
import { SPELLS } from "../spells";

const ids = new Set([...CARDS, ...TOKENS].map((c) => c.id).concat(SPELLS.map((s) => s.id)));

describe("lore", () => {
  it("keys only real cards, tokens and spells", () => {
    // The failure this exists for: `leaf_nightshde` looks fine, imports fine,
    // type-checks fine, and that card just never gets its line.
    const orphans = Object.keys(LORE).filter((id) => !ids.has(id));
    expect(orphans, "lore keyed to ids that do not exist").toEqual([]);
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
    for (const [id, line] of Object.entries(LORE)) {
      const spell = SPELLS.find((s) => s.id === id);
      const actual = spell ? spell.lore : getDef(id).lore;
      expect(actual, `${id} has lore in the map but not on its def`).toBe(line);
    }
  });

  it("exposes the same text through loreFor", () => {
    expect(loreFor("leaf_oakgre")).toBe(LORE.leaf_oakgre);
    expect(loreFor("no_such_card")).toBeUndefined();
  });

  // Elements are listed here as their pass lands, so this goes red when a card is
  // ADDED to a finished element without a line — not merely because the elements
  // still to write have not been written.
  const DONE = ["LEAF", "PYRO"] as const;
  for (const el of DONE)
    it(`covers all of ${el} — cards, tokens and spells`, () => {
      const entries = [
        ...[...CARDS, ...TOKENS].filter((c) => c.element === el).map((c) => c.id),
        ...SPELLS.filter((s) => s.element === el).map((s) => s.id),
      ];
      expect(entries.filter((id) => !LORE[id]), `${el} entries with no lore`).toEqual([]);
    });
});
