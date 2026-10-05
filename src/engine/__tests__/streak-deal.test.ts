// NO REROLLS IN STREAK (owner, 2026-10-04: "You're not supposed to be able to
// re-roll your streak opponent. Only you're supposed to be able to re-roll a
// casual match."). The dealt fight lives in the save, per board, so a reload
// cannot shake it loose either.
import { describe, expect, it } from "vitest";
import { loadStory, newSave, saveStory } from "../../data/story";

function withStorage(run: () => void) {
  const g = globalThis as { localStorage?: unknown };
  const prior = g.localStorage;
  const mem = new Map<string, string>();
  g.localStorage = {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => { mem.set(k, v); },
    removeItem: (k: string) => { mem.delete(k); },
  };
  try { run(); } finally { g.localStorage = prior; }
}

describe("the streak's dealt fight survives a reload", () => {
  it("keeps each board's deal, with its table, through save and load", () => {
    withStorage(() => {
      saveStory({
        ...newSave(),
        streakDeal: { 4: { id: "deck_a" }, 7: { id: "deck_b", extras: ["deck_c", "deck_d"] } },
      });
      expect(loadStory().streakDeal).toEqual({
        4: { id: "deck_a" }, 7: { id: "deck_b", extras: ["deck_c", "deck_d"] },
      });
    });
  });

  it("drops junk rather than crashing, and reads an older save as no deal", () => {
    withStorage(() => {
      saveStory({ ...newSave(), streakDeal: { 4: { id: 7 }, 5: null, 7: { id: "x", extras: [1, "y"] } } as never });
      expect(loadStory().streakDeal).toEqual({ 7: { id: "x", extras: ["y"] } });
      saveStory(newSave());
      expect(loadStory().streakDeal).toBeUndefined();
    });
  });
});
