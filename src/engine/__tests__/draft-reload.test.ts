import { describe, it, expect } from "vitest";
import { loadStory, saveStory } from "../../data/story";
import type { StorySave } from "../../data/story";
import { startDraft } from "../../data/draft";
import type { DraftRun } from "../../data/draft";

/** A throwaway localStorage, so a test never touches a real save. */
function withStorage(body: () => void) {
  const store = new Map<string, string>();
  const g = globalThis as { localStorage?: unknown };
  const prior = g.localStorage;
  g.localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };
  try { body(); } finally { g.localStorage = prior; }
}

/** Save, then load, the way closing and reopening the game does. */
function roundTrip(save: StorySave): StorySave {
  saveStory(save);
  return loadStory();
}

describe("a draft survives being reloaded mid-pick", () => {
  /* THE BUG: `loadStory` validated `draft.offer` with an is-array-of-strings
     check. `offer` stopped being ids when the warband rework made each one a
     {label, kind, cards} banner, and the validator did not move with it — so
     the whole run was dropped as malformed and the player lost it.

     It only bit MID-PICK, which is what made it look random: `[].every()` is
     true, so an empty offer passed and a run between phases came back fine.
     Three banners on the table is exactly the moment a player is deciding. */

  it("keeps a run with warband groups on the table", () => {
    withStorage(() => {
      const run = startDraft(4, () => 0.42);
      expect(run.offer.length, "there are banners on the table").toBeGreaterThan(0);
      expect(typeof run.offer[0], "and they are objects, not ids").toBe("object");

      const base = loadStory();
      const back = roundTrip({ ...base, draft: run });
      expect(back.draft, "the run must survive the reload").toBeTruthy();
      expect(back.draft?.offer.length).toBe(run.offer.length);
      expect(back.draft?.offer[0].label).toBe(run.offer[0].label);
      expect(back.draft?.offer[0].cards).toEqual(run.offer[0].cards);
      expect(back.draft?.picks).toEqual(run.picks);
      expect(back.draft?.board).toBe(run.board);
    });
  });

  it("still keeps a run BETWEEN phases, which always worked", () => {
    withStorage(() => {
      const run: DraftRun = { ...startDraft(4, () => 0.42), offer: [], cardOffer: ["leaf_weeds"] };
      const back = roundTrip({ ...loadStory(), draft: run });
      expect(back.draft, "an empty offer was never the broken case").toBeTruthy();
      expect(back.draft?.cardOffer).toEqual(["leaf_weeds"]);
    });
  });

  it("still DROPS a genuinely malformed run rather than trusting it", () => {
    // The validator's whole job. A hand-edited save must not strand a draft
    // that can never complete, so the fix must not become "accept anything".
    withStorage(() => {
      const base = loadStory();
      const bad: unknown[] = [
        { ...startDraft(4, () => 0.42), board: 9 },                                  // no such board
        { ...startDraft(4, () => 0.42), picks: [1, 2] },                             // picks are ids
        { ...startDraft(4, () => 0.42), offer: ["leaf_weeds"] },                     // ids, not groups
        { ...startDraft(4, () => 0.42), offer: [{ label: "x", kind: "nope", cards: [] }] }, // bad kind
        { ...startDraft(4, () => 0.42), offer: [{ label: 7, kind: "tribe", cards: [] }] },  // bad label
        { ...startDraft(4, () => 0.42), offer: [{ label: "x", kind: "tribe", cards: [1] }] }, // bad cards
        { ...startDraft(4, () => 0.42), cardOffer: [3] },                            // bad optional
        { ...startDraft(4, () => 0.42), won: -1 },                                   // negative
      ];
      for (const d of bad) {
        const back = roundTrip({ ...base, draft: d as DraftRun });
        expect(back.draft, `should have been dropped: ${JSON.stringify(d).slice(0, 70)}`)
          .toBeUndefined();
      }
    });
  });
});
