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

  // THE ADVICE USED TO BE WRONG, and wrong in the expensive direction. "Play
  // like it is a race, because it is one" was the whole of the opening lesson,
  // and a new player who took it at face value emptied their Home row in the
  // first two rounds — which is exactly how you go broke, because income is
  // `goldBase + homeSlotsHeld` (phases.ts, doResourcePhase): one Gold a round
  // per Home square you are STANDING on. Rushing does not merely risk the
  // bodies, it switches off the money that buys the next ones.
  describe("it teaches the economy before it teaches the march", () => {
    const byId = (id: string) => TUTORIAL_STEPS.find((s) => s.id === id);
    const at = (id: string) => TUTORIAL_STEPS.findIndex((s) => s.id === id);

    it("has a lesson about holding the Home row for income", () => {
      const income = byId("income");
      expect(income, "no income lesson").toBeTruthy();
      const body = income!.body.toLowerCase();
      expect(body).toContain("gold");
      // The specific fact a rushing player is missing: advancing COSTS income.
      expect(body, "does not say that advancing stops the money")
        .toMatch(/stops paying|stop paying|stops earning|stop earning/);
    });

    it("says it BEFORE the lesson that invites marching", () => {
      // "You may move one card a turn" is an invitation to start walking. Until
      // the player knows what the back line pays, walking is how they lose.
      expect(at("income")).toBeGreaterThan(-1);
      expect(at("move")).toBeGreaterThan(-1);
      expect(at("income"), "income must come first").toBeLessThan(at("move"));
    });

    it("no longer tells a new player to sprint", () => {
      const all = TUTORIAL_STEPS.map((s) => s.body).join(" ").toLowerCase();
      expect(all, "still coaching a rush").not.toContain("play like it is a race");
    });
  });

  // It used to sit in the `.controls` column, which on a phone reflows into the
  // bottom band — on top of the hand, i.e. on the cards the lesson was telling
  // the player to play. Each step now names the end of the screen that is clear
  // of its OWN subject.
  describe("it sits somewhere that is not in the way", () => {
    it("every step picks an end of the screen", () => {
      for (const s of TUTORIAL_STEPS) expect(["top", "bottom"], s.id).toContain(s.place);
    });

    it("hand lessons go up, so the fan stays visible", () => {
      // This one asks the player to use cards in hand.
      for (const id of ["summon"]) {
        const s = TUTORIAL_STEPS.find((x) => x.id === id);
        expect(s, id).toBeTruthy();
        expect(s!.place, `${id} would cover the hand`).toBe("top");
      }
    });

    it("the far-row lesson goes down, so the far row stays visible", () => {
      expect(TUTORIAL_STEPS.find((s) => s.id === "goal")!.place).toBe("bottom");
    });

    it("...and it does not always sit in the same place", () => {
      // The point of the field: if every step picked one end it would be a
      // constant, not a placement, and this file would be lying about why.
      expect(new Set(TUTORIAL_STEPS.map((s) => s.place)).size).toBe(2);
    });
  });

  // THE MULLIGAN IS A MODAL, and it teaches its own lesson in its own copy.
  // A coach card floating over it made the player's first two seconds of the
  // game two panels competing for the same moment, so the step was removed
  // rather than repositioned — there is no position over a modal that is not
  // over the modal. If a mulligan step ever comes back, this fails and the
  // reviewer has to justify the second surface.
  it("has no mulligan step, because the mulligan modal already has one", () => {
    expect(TUTORIAL_STEPS.map((s) => s.id)).not.toContain("mulligan");
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
