// DRAFT, phase 2 — guards on the pick screen.
//
// `vite.config.ts` sets `environment: "node"`, so there is no DOM and nothing
// here renders. That is not a reason to ship a screen untested, it is a reason
// to test the things that actually break in an unrenderable component: a class
// name that matches no rule, and a size or a completion check hardcoded where
// the draft module should have been asked.
//
// The same shape as builder-foils.test.ts, and for the same reason — the bug
// that test catches was also invisible to every unit test of the component.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ui = (f: string) => readFileSync(join(__dirname, "..", "..", "ui", f), "utf8");
const SCREEN = ui("DraftScreen.tsx");
const CSS = ui("styles.css");

describe("the draft pick screen", () => {
  it("styles every class it puts on the page", () => {
    // A className typo in a component nothing can render is invisible until a
    // human opens the screen and finds it unstyled. This is the cheap version
    // of opening it.
    const names = new Set<string>();
    for (const m of SCREEN.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g))
      for (const tok of (m[1] ?? m[2] ?? "").split(/[\s${}]+/))
        if (/^[a-z][a-z0-9-]*$/.test(tok)) names.add(tok);

    expect(names.size, "no classes found — the scanner is broken, not the screen")
      .toBeGreaterThan(10);
    const missing = [...names].filter((n) => !CSS.includes(`.${n}`)).sort();
    expect(missing, `classes with no rule: ${missing.join(", ")}`).toEqual([]);
  });

  it("asks the draft module for the size instead of hardcoding 18", () => {
    // The whole point of `deckSizeFor` is that 5x5 is 30. A screen that prints
    // "of 18" would be quietly wrong the day phase 5 turns the big board on,
    // and it would still look right on every screenshot until then.
    expect(SCREEN, "should read draftSize(run)").toContain("draftSize(run)");
    expect(SCREEN, "should read draftComplete(run)").toContain("draftComplete(run)");
    expect(SCREEN, "and the book's cap, which is 5 or 8").toContain("draftSpellCap(run)");
    expect(/\bof 18\b/.test(SCREEN), "a hardcoded 18 in the copy").toBe(false);
  });

  it("owns no run state — the parent does", () => {
    // Phase 2 is deliberately dumb: the run arrives as a prop and every pick
    // leaves through onPick. If this screen ever starts a draft or rolls an
    // offer itself, two things own the run and they will disagree.
    expect(SCREEN.includes("startDraft"), "screen must not start its own draft").toBe(false);
    expect(SCREEN.includes("rollGroups"), "screen must not roll its own offer").toBe(false);
    expect(SCREEN.includes("rollSpellOffer"), "nor its own spells").toBe(false);
    expect(SCREEN.includes("rollCardOffer"), "nor its own single cards").toBe(false);
    expect(SCREEN).toContain("props.onPickGroup");
    expect(SCREEN).toContain("props.onPickCard");
    expect(SCREEN).toContain("props.onPickSpell");
  });

  it("asks the run which card stage it is in, rather than counting picks", () => {
    // The boundary between warbands and singles is `groupCards`'s to own. A
    // screen that worked it out from `picks.length` would be a second copy of
    // the format, and the two would disagree the day the split moves.
    expect(SCREEN, "should read inGroupPhase(run)").toContain("inGroupPhase(run)");
    expect(/picks\.length\s*[<>]=?\s*\d/.test(SCREEN), "a hardcoded phase boundary").toBe(false);
    expect(/SINGLE_PICKS|of 6/.test(SCREEN), "a hardcoded single count in the copy").toBe(false);
  });

  it("shows the class breakdown, gaps included, at every stage of the draft", () => {
    // The row used to be hidden behind `compact`, and the draft was the only
    // caller that passed it — the one screen where the reader cannot go looking
    // for a Tank. `gaps` is what puts the classes they do NOT have on the row.
    expect(SCREEN.includes("compact"), "the class row is hidden again").toBe(false);
    const stats = SCREEN.match(/<DeckStats[^/]*\/>/g) ?? [];
    expect(stats.length, "no DeckStats on the draft screen at all").toBeGreaterThan(0);
    for (const tag of stats) expect(tag, `${tag} does not ask for gaps`).toContain("gaps");
  });

  it("renders one card the same way in both stages", () => {
    // The trio inside a banner and the five on a single table are the same
    // object in two containers. Written out twice, the ⓘ stops opening the
    // reader in one of them and nobody notices.
    expect((SCREEN.match(/className="dt-info"/g) ?? []).length, "two copies of the ⓘ").toBe(1);
    expect((SCREEN.match(/function DraftCard\(/g) ?? []).length).toBe(1);
  });

  it("closes the card reader before the offer changes underneath it", () => {
    // Tapping a card's ⓘ and then taking a banner leaves the reader open over
    // three cards it was not opened from. Both stages route through a closer.
    expect(SCREEN).toMatch(/const takeGroup = [\s\S]{0,80}setDetailId\(null\)/);
    expect(SCREEN).toMatch(/const takeCard = [\s\S]{0,80}setDetailId\(null\)/);
    expect(SCREEN).toMatch(/const takeSpell = [\s\S]{0,80}setDetailId\(null\)/);
  });

  it("adds no always-on animation to a screen that sits still", () => {
    // The board's slot cues were just converted off animated `box-shadow`
    // because a dozen of them repainted at 60fps while the player thought. A
    // pick screen is the same situation: three cards and a person reading them.
    const block = CSS.slice(CSS.indexOf(".draft-screen"));
    expect(block, "no infinite animation in the draft block").not.toContain("infinite");
    expect(/\.dr-[a-z]+[^{]*\{[^}]*animation:/.test(block), "a .dr- rule animates").toBe(false);
  });
});
