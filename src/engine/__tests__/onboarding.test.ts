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
  FIRST_NODE, ONBOARDING_CORE_COUNT, ONBOARDING_SKIP, ONBOARDING_STEPS,
  canSkipGuide, firstFightWon, onboardingIndex, onboardingStep,
  packOpened as packIsOpened, skipLockedNote,
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

  it("clearing the first battle ends the CORE arc and opens the tour", () => {
    // It used to end the guide outright. The tour is what makes "skippable
    // after the first fight" mean anything — there has to be something left to
    // skip — so the first battle now hands over rather than closing up.
    const s = { ...packOpened(newSave()), cleared: [FIRST_NODE] };
    const next = onboardingStep(s);
    expect(next?.core, "the core arc is done").toBe(false);
    expect(next?.id).toBe("purse");
  });

  it("Skip does NOT silence the core arc — that is the point of it", () => {
    // The owner's rule: mandatory through the first pack and the first fight.
    // Enforced HERE and not only by withholding the button, because a rule kept
    // by a hidden control is one that any stale sentinel walks through, and
    // `taught` is written from three places.
    for (const base of [newSave(), packOpened(newSave()), withBench(packOpened(newSave()), 3)]) {
      const skipped = { ...base, taught: [ONBOARDING_SKIP] };
      expect(onboardingStep(skipped)?.core, "still on the core arc").toBe(true);
    }
  });

  it("...and silences the tour, which is what it is for", () => {
    const done = { ...packOpened(newSave()), cleared: [FIRST_NODE] };
    expect(onboardingStep(done)?.core).toBe(false);
    expect(onboardingStep({ ...done, taught: [ONBOARDING_SKIP] })).toBeNull();
  });

  it("the coach's SKIP and the guide's are DIFFERENT decisions", () => {
    // Sharing one flag would make silencing the in-match lessons also silence
    // the screen that gets you to a match — two unrelated choices collapsed
    // into one tap.
    expect(ONBOARDING_SKIP).not.toBe("SKIP");
    expect(onboardingStep({ ...newSave(), taught: ["SKIP"] })?.id).toBe("pack");
  });
});

// THE SKIP GATE, which is the rule this rewrite was asked for: the walkthrough
// is mandatory through the first pack opening and the first story fight, and
// free afterwards. Both milestones, not either.
describe("when the player is allowed to dismiss it", () => {
  const fresh = newSave();
  const packed = packOpened(fresh);
  const fought = { ...fresh, cleared: [FIRST_NODE] };
  const both = { ...packed, cleared: [FIRST_NODE] };

  it("needs BOTH milestones, not one", () => {
    expect(canSkipGuide(fresh), "fresh save").toBe(false);
    expect(canSkipGuide(packed), "pack opened, never fought").toBe(false);
    expect(canSkipGuide(fought), "fought, but the pack is still owed").toBe(false);
    expect(canSkipGuide(both), "both done").toBe(true);
  });

  it("the two milestones read the save, not a flag", () => {
    expect(packIsOpened(fresh)).toBe(false);
    expect(packIsOpened(packed)).toBe(true);
    expect(firstFightWon(fresh)).toBe(false);
    expect(firstFightWon(fought)).toBe(true);
  });

  it("says which milestone is outstanding while Skip is missing", () => {
    // A button that is simply absent, with nothing in its place, reads as a
    // broken screen rather than as a rule.
    expect(skipLockedNote(fresh)).toMatch(/pack/i);
    expect(skipLockedNote(packed)).toMatch(/battle/i);
    expect(skipLockedNote(both), "nothing to say once it is unlocked").toBe("");
  });
});

// Every step names a control by `data-guide`. The elements live in four other
// components and cannot be asserted here (no DOM), but the CURRICULUM's half of
// the contract can be: a step with no anchor, or two steps fighting over one,
// is a spotlight that lands on the wrong thing.
describe("every step points somewhere", () => {
  it("names an anchor and a tab", () => {
    for (const s of ONBOARDING_STEPS) {
      expect(s.anchor, `${s.id} has no anchor`).toBeTruthy();
      expect(["home", "shop", "story", "arena", "tower"]).toContain(s.tab);
    }
  });

  it("no two steps spotlight the same control", () => {
    const anchors = ONBOARDING_STEPS.map((s) => s.anchor);
    expect(new Set(anchors).size, anchors.join(", ")).toBe(anchors.length);
  });
});

describe("it never nags an established player", () => {
  it("a mid-campaign save made before this existed sees nothing", () => {
    // No stored cursor means no migration for the CORE arc: every condition is
    // already satisfied, so it is silent on an old save without being told.
    //
    // The TOUR needed the rule stated, because it has no deed to satisfy — its
    // ids are simply absent from `taught` on every save that predates it, so
    // without a window it would have walked thirty-node veterans through "this
    // is the Arena" the day it shipped. Clearing anything beyond the first
    // battle closes it.
    const s: StorySave = {
      ...packOpened(newSave()),
      cleared: [FIRST_NODE, "L2", "L3"],
      collection: CARDS.slice(0, 20).map((c) => c.id),
    };
    expect(onboardingStep(s)).toBeNull();
  });

  it("...and the tour closes the moment a second node falls", () => {
    const justWon = { ...packOpened(newSave()), cleared: [FIRST_NODE] };
    expect(onboardingStep(justWon), "the window is open right after the tutorial").toBeTruthy();
    expect(onboardingStep({ ...justWon, cleared: [FIRST_NODE, "L2"] })).toBeNull();
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
  it("is a core arc plus a tour, with unique ids, each saying something", () => {
    expect(ONBOARDING_CORE_COUNT, "pack, squad, fight").toBe(3);
    expect(ONBOARDING_STEPS.filter((s) => s.core).length).toBe(ONBOARDING_CORE_COUNT);
    expect(ONBOARDING_STEPS.length, "and a tour after them").toBeGreaterThan(ONBOARDING_CORE_COUNT);
    // The core arc comes FIRST in the list, so the pips count up rather than
    // jumping about when the guide crosses from one arc to the other.
    const firstTour = ONBOARDING_STEPS.findIndex((s) => !s.core);
    expect(ONBOARDING_STEPS.slice(0, firstTour).every((s) => s.core)).toBe(true);
    expect(ONBOARDING_STEPS.slice(firstTour).every((s) => !s.core)).toBe(true);
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
