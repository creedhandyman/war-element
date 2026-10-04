// Spellbooks follow the difficulty rung (owner, 2026-10-04): cheap spells on
// easy decks, the big ones on elite. Prism and Four Winds once carried books
// of 1-costs indistinguishable from the auto default; never again.
import { describe, expect, it } from "vitest";
import { DECK_TIERS, PREMADE_DECKS } from "../../data/custom-decks";
import { getSpell } from "../spells";

const avg = (ids: readonly string[]) => ids.reduce((n, id) => n + getSpell(id).cost, 0) / ids.length;

describe("premade spellbooks", () => {
  it("no tiered book is a pile of 1-costs", () => {
    for (const d of PREMADE_DECKS.filter((x) => x.tier))
      expect((d.spells ?? []).filter((id) => getSpell(id).cost === 1).length, d.id).toBeLessThanOrEqual(2);
  });

  it("the average spell cost rises with the rung, on both boards", () => {
    for (const board of [4, 5]) {
      const byTier = DECK_TIERS.map((t) => {
        const books = PREMADE_DECKS.filter((d) => d.tier === t && (d.boardSize ?? 4) === board).map((d) => avg(d.spells ?? []));
        return books.reduce((a, b) => a + b, 0) / books.length;
      });
      for (let i = 1; i < byTier.length; i++) expect(byTier[i], `board ${board} ${DECK_TIERS[i]}`).toBeGreaterThan(byTier[i - 1]);
    }
  });
});
