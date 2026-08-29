// THE FIRST-RUN GUIDE IS A STATE MACHINE OVER THE SAVE, and that is the whole
// reason it can be trusted: it stores no cursor, so it cannot disagree with
// what the player has actually done. These tests are that claim, checked from
// both ends — the right step for each state, and no step at all once the state
// says the job is done.
//
// The component is React and belongs to the browser pass (this repo runs
// `environment: "node"` and has no component tests); the machine underneath it
// is where a regression would hide.
import { describe, expect, it } from "vitest";
import {
  FIRST_NODE, ONBOARDING_SKIP, ONBOARDING_STEPS, onboardingIndex, onboardingStep,
} from "../../ui/Onboarding";
import { CARDS } from "../../data/cards";
import { REGIONS, STARTER_DECK, deckCapFor, isFirstBattle, newSave, type StorySave } from "../../data/story";

/** A save with no free packs left — i.e. the pack step already done. */
const packOpened = (s: StorySave): StorySave => ({ ...s, hero: { ...s.hero!, freePacks: 0 } });
/** Cards owned but NOT in the deck — exactly what opening a pack leaves behind. */
const withBench = (s: StorySave, n: number): StorySave => {
  const extra = CARDS.filter((c) => !c.boss && !s.collection.includes(c.id)).slice(0, n).map((c) => c.id);
  return { ...s, collection: [...s.collection, ...extra] };
};

describe("the three steps, in the order a fresh save meets them", () => {
  it("a brand-new save is sent to its free pack first", () => {
    const step = onboardingStep(newSave());
    expect(step?.id).toBe("pack");
    expect(onboardingIndex(step)).toBe(0);
  });

  it("with the pack opened but its cards benched, it asks for a squad", () => {
    // The actual cliff this guide exists for: `applyPack` adds to `collection`
    // and NOT to `deck` (story.ts), so a player opens their one free pack and
    // the Home tile still reads "1 CARD". Nothing else in the app connects
    // those two facts.
    const s = withBench(packOpened(newSave()), 5);
    expect(s.deck.length, "the deck did not grow").toBe(STARTER_DECK.length);
    expect(onboardingStep(s)?.id).toBe("squad");
  });

  it("with the squad built, it points at the first battle", () => {
    const s = withBench(packOpened(newSave()), 5);
    const built = { ...s, deck: s.collection.slice(0, deckCapFor(s.cleared)) };
    expect(onboardingStep(built)?.id).toBe("fight");
  });

  it("clearing the first battle ends the guide for good", () => {
    const s = { ...packOpened(newSave()), cleared: [FIRST_NODE] };
    expect(onboardingStep(s)).toBeNull();
    // ...and it stays null however the rest of the save looks.
    expect(onboardingStep({ ...s, deck: [], collection: [] })).toBeNull();
  });

  it("Skip silences it immediately, from any step", () => {
    for (const base of [newSave(), packOpened(newSave()), withBench(packOpened(newSave()), 3)]) {
      const skipped = { ...base, taught: [ONBOARDING_SKIP] };
      expect(onboardingStep(skipped)).toBeNull();
    }
  });

  it("the coach's SKIP and the guide's are DIFFERENT decisions", () => {
    // Sharing one flag would make silencing the in-match lessons also silence
    // the screen that gets you to a match — two unrelated choices collapsed
    // into one tap.
    expect(ONBOARDING_SKIP).not.toBe("SKIP");
    expect(onboardingStep({ ...newSave(), taught: ["SKIP"] })?.id).toBe("pack");
  });
});

describe("it never nags an established player", () => {
  it("a mid-campaign save made before this existed sees nothing", () => {
    // No stored cursor means no migration: every condition is already
    // satisfied, so the guide is silent on an old save without being told.
    const s: StorySave = {
      ...packOpened(newSave()),
      cleared: [FIRST_NODE, "L2", "L3"],
      collection: CARDS.slice(0, 20).map((c) => c.id),
    };
    expect(onboardingStep(s)).toBeNull();
  });

  it("a player who opened the pack unprompted simply skips that step", () => {
    // The machine asks whether the DEED is done, never whether the card was
    // shown — so doing a step early is the same as being told to.
    expect(onboardingStep(packOpened(newSave()))?.id).not.toBe("pack");
  });

  it("does not demand a squad when there is nothing benched to add", () => {
    const s = packOpened(newSave()); // owns only the starter, and it is in the deck
    expect(s.collection.every((id) => s.deck.includes(id))).toBe(true);
    expect(onboardingStep(s)?.id, "nothing to add — go and fight").toBe("fight");
  });
});

describe("the curriculum is coherent", () => {
  it("is three steps with unique ids, each saying something", () => {
    expect(ONBOARDING_STEPS.length).toBe(3);
    const ids = ONBOARDING_STEPS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of ONBOARDING_STEPS) {
      expect(s.title.length, `${s.id} title`).toBeGreaterThan(3);
      expect(s.body.length, `${s.id} body`).toBeGreaterThan(40);
      expect(s.cta.length, `${s.id} cta`).toBeGreaterThan(2);
    }
  });

  it("every step id the machine can return is in the published list", () => {
    const known = new Set(ONBOARDING_STEPS.map((s) => s.id));
    const saves = [newSave(), packOpened(newSave()), withBench(packOpened(newSave()), 4)];
    for (const s of saves) {
      const step = onboardingStep(s);
      if (step) expect(known.has(step.id), step.id).toBe(true);
    }
  });
});

describe("it points at a node that really is the tutorial", () => {
  it("FIRST_NODE is the game's designed first battle, not a hardcoded guess", () => {
    // `isFirstBattle` identifies it structurally — the opening node of the one
    // region nothing gates. If the world is ever re-ordered, this fails here
    // rather than sending a new player to a level that no longer teaches.
    const hits = REGIONS.flatMap((r) => r.nodes.filter((n) => isFirstBattle(r, n)).map((n) => n.id));
    expect(hits, "exactly one designed first battle").toEqual([FIRST_NODE]);
  });

  it("that node exists and needs nothing cleared before it", () => {
    const node = REGIONS.flatMap((r) => r.nodes).find((n) => n.id === FIRST_NODE);
    expect(node, `${FIRST_NODE} is missing from the world`).toBeTruthy();
    expect(node!.requires, "the first battle cannot have a gate").toEqual([]);
  });
});
