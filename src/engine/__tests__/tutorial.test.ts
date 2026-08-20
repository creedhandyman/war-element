// The tutorial's curriculum, checked as data. The component itself is React and
// belongs to the browser pass; what has to hold here is that the steps are a
// coherent, non-repeating set and that the save can carry them.

import { describe, expect, it } from "vitest";
import { TUTORIAL_STEPS } from "../../ui/TutorialCoach";
import { loadStory, newSave } from "../../data/story";

describe("the tutorial curriculum", () => {
  it("teaches a handful of ideas, each exactly once", () => {
    expect(TUTORIAL_STEPS.length).toBeGreaterThanOrEqual(4);
    // Short on purpose: a tutorial that teaches the whole rulebook IS the
    // rulebook, and that already exists under "How to play".
    expect(TUTORIAL_STEPS.length).toBeLessThanOrEqual(7);
    const ids = TUTORIAL_STEPS.map((s) => s.id);
    expect(new Set(ids).size, "no repeated id").toBe(ids.length);
    expect(ids, "SKIP is the opt-out sentinel, never a step").not.toContain("SKIP");
  });

  it("leads with the win condition, because everything else is downstream of it", () => {
    // A player who follows every in-game hint can still not know the game is a
    // race for the enemy Home row. That is the gap this exists to close, so it
    // is the first thing said.
    expect(TUTORIAL_STEPS[0].id).toBe("goal");
    expect(TUTORIAL_STEPS[0].body.toLowerCase()).toContain("home row");
  });

  it("says something in every step, and nothing card-specific", () => {
    for (const s of TUTORIAL_STEPS) {
      expect(s.title.length, `${s.id} title`).toBeGreaterThan(3);
      expect(s.body.length, `${s.id} body`).toBeGreaterThan(40);
      // Card names date instantly — a rebalance or a rename should never
      // silently make the tutorial wrong.
      expect(s.body, `${s.id} names a card`).not.toMatch(/\b(Sakuroot|Greegon|Gool|Imperator)\b/);
    }
  });

  it("starts a fresh save with nothing taught, and survives a round trip", () => {
    expect(newSave().taught ?? []).toEqual([]);
    // Same storage stub the shiny round-trip test uses — no DOM in this env.
    const store = new Map<string, string>();
    const g = globalThis as { localStorage?: unknown };
    const prior = g.localStorage;
    g.localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    };
    try {
      // The sanitizer keeps only strings — a hand-edited save must not put a
      // number where the component expects an id.
      store.set("we_story_v1", JSON.stringify({
        cleared: [], collection: [], pity: {}, deck: [], blight: {},
        taught: ["goal", 7, null, "SKIP"],
      }));
      expect(loadStory().taught).toEqual(["goal", "SKIP"]);
    } finally { g.localStorage = prior; }
  });
});
