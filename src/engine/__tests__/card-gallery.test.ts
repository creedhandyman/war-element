// THE GALLERY IS A PROMISE ABOUT COVERAGE, and coverage is the one thing a
// screen cannot assert about itself. Every other card grid in the app filters:
// the builder drops what you cannot draft, the collection drops bosses
// (`StoryCollection.tsx` — `CARDS.filter((d) => !d.boss)`) and neither has ever
// shown a token. This screen exists precisely because those two filters left 46
// finished paintings with nowhere to be looked at.
//
// So what is pinned here is the ABSENCE of a filter — that the gallery's set is
// the whole set, that nothing silently falls out of it, and that the three
// kinds it labels are labelled correctly. The rendering is not tested because
// this repo has no DOM test environment (`vite.config.ts` — `environment:
// "node"`) and no component tests at all; the data underneath it is where a
// regression would actually hide.
import { describe, expect, it } from "vitest";
import { CARDS, TOKENS } from "../../data/cards";
import { GALLERY_DEFS, SPAWNED_BY, kindOf, tileRule } from "../../ui/CardGallery";
import { BUILDABLE_ELEMENTS, ELEMENTS } from "../../ui/shared";
import { buildableCards } from "../../data/custom-decks";

describe("the gallery shows EVERYTHING", () => {
  it("covers every card and every token, with nothing invented", () => {
    expect(GALLERY_DEFS.length).toBe(CARDS.length + TOKENS.length);
    const ids = new Set(GALLERY_DEFS.map((d) => d.id));
    const missing = [...CARDS, ...TOKENS].filter((d) => !ids.has(d.id)).map((d) => d.id);
    expect(missing, `defs the gallery cannot show:\n  ${missing.join("\n  ")}`).toEqual([]);
  });

  it("includes the two categories every other grid hides", () => {
    // The reason the screen was built. If either count goes to zero, the
    // gallery has quietly become a second collection screen.
    expect(GALLERY_DEFS.filter((d) => kindOf(d) === "boss").length).toBeGreaterThan(0);
    expect(GALLERY_DEFS.filter((d) => kindOf(d) === "token").length).toBe(TOKENS.length);
  });

  it("lists each def exactly once — a duplicate is a duplicate React key", () => {
    const seen = new Set<string>();
    const dupes = GALLERY_DEFS.filter((d) => (seen.has(d.id) ? true : (seen.add(d.id), false)));
    expect(dupes.map((d) => d.id)).toEqual([]);
  });

  it("sorts every def into exactly one kind, and a boss is never a token", () => {
    for (const d of GALLERY_DEFS) {
      const k = kindOf(d);
      expect(["card", "token", "boss"], `${d.id}`).toContain(k);
      if (d.boss) expect(k, `${d.id} is a boss`).toBe("boss");
    }
    // Bosses live in CARDS, so "boss" and "token" must be disjoint by
    // construction — this catches a boss ever being moved into TOKENS.
    const tokenIds = new Set(TOKENS.map((t) => t.id));
    expect(CARDS.filter((c) => c.boss && tokenIds.has(c.id)).map((c) => c.id)).toEqual([]);
  });
});

describe("what the tiles and the detail panel can actually say", () => {
  it("every def has the art the tile points at — the grid can never be broken", () => {
    // `art.test.ts` already asserts this against the files on disk. Repeated
    // from the gallery's side because the gallery is the ONLY screen that
    // renders all 366 at once: a missing plate that was invisible everywhere
    // else is a hole in the middle of this grid.
    for (const d of GALLERY_DEFS) expect(typeof (d.art ?? d.id)).toBe("string");
    expect(GALLERY_DEFS.every((d) => (d.art ?? d.id).length > 0)).toBe(true);
  });

  it("tileRule never throws, and returns a string or nothing", () => {
    // It reaches into `special` and into `describeOwnPassives`, and it runs on
    // TOKENS — which mostly have no Special at all (1 of 27 does).
    for (const d of GALLERY_DEFS) {
      const r = tileRule(d);
      expect(r === null || typeof r === "string", `${d.id} produced ${typeof r}`).toBe(true);
      if (r !== null) expect(r.length, `${d.id} has an empty rule line`).toBeGreaterThan(0);
    }
  });

  it("most cards have something to say on the tile", () => {
    // Not "all" — a vanilla body with no Special and no passive is legitimate,
    // and the tile is simply blank there. But if this collapses, the rule line
    // has stopped working rather than the cards having gone plain.
    const withRule = GALLERY_DEFS.filter((d) => tileRule(d) !== null).length;
    expect(withRule).toBeGreaterThan(GALLERY_DEFS.length / 2);
  });
});

describe("a token says what puts it on the board", () => {
  it("the summoner index is derived, not authored, and finds real ones", () => {
    // Known pairs, from the defs: Lassos brings the Golden Bull on summon, and
    // the Void Tower's gates are spawned as scenery. If the deep-scan ever
    // stops matching, these are the first to go quiet.
    expect(SPAWNED_BY["dawn_golden_bull_tok"]).toBeTruthy();
    expect(SPAWNED_BY["dawn_golden_bull_tok"].join(" ")).toContain("Lassos");
  });

  it("credits a summoner for most tokens", () => {
    const credited = TOKENS.filter((t) => SPAWNED_BY[t.id]?.length).length;
    expect(credited, "the deep-scan found almost nothing — a field shape changed")
      .toBeGreaterThan(TOKENS.length / 2);
  });

  it("nothing summons itself", () => {
    for (const [tokenId, names] of Object.entries(SPAWNED_BY)) {
      const self = GALLERY_DEFS.find((d) => d.id === tokenId);
      if (self) expect(names, `${tokenId} lists itself`).not.toContain(self.name);
    }
  });
});

// ...AND THE BUILDER SHOWS ONLY WHAT YOU CAN DEPLOY, which is the other half of
// the same promise. The gallery filters nothing; a grid you build a deck out of
// filters plenty, and its CONTROLS have to agree with its contents.
//
// VOID is what made the two come apart. It is the Tower's element — one boss
// and six of its brood — so every VOID def is a token or `boss: true`, and both
// sit outside `buildableCards()` by construction. The deck builder still drew a
// ninth element chip from the shared nine-element list, and tapping it returned
// an empty grid: a control that reads as content you have not unlocked, and is
// in fact a control with nothing behind it.
describe("the builder offers no chip it cannot fill", () => {
  it("every element the builder lists has draftable cards behind it", () => {
    const empty = BUILDABLE_ELEMENTS
      .filter((el) => !buildableCards().some((c) => c.element === el));
    expect(empty, `builder chips with an empty grid behind them: ${empty.join(", ")}`).toEqual([]);
  });

  it("...and it drops no element that DOES have them", () => {
    // The list is derived, so this is the other direction: an element with
    // draftable cards must never fall out of the builder.
    const missing = ELEMENTS
      .filter((el) => buildableCards().some((c) => c.element === el))
      .filter((el) => !BUILDABLE_ELEMENTS.includes(el));
    expect(missing, `draftable elements the builder hides: ${missing.join(", ")}`).toEqual([]);
  });

  it("VOID is gallery-only, today", () => {
    // Pinned as a FACT about the current set rather than as a rule: if VOID is
    // ever given a draftable card this fails, and the right response is to
    // delete this test, not to special-case VOID. The two above are the rule.
    expect(buildableCards().some((c) => c.element === "VOID")).toBe(false);
    expect(BUILDABLE_ELEMENTS).not.toContain("VOID");
    expect(GALLERY_DEFS.filter((d) => d.element === "VOID").length).toBeGreaterThan(0);
    expect(ELEMENTS).toContain("VOID");
  });
});
