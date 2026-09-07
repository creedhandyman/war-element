// DRAFT, phase 3b — guards on the App.tsx wiring.
//
// Source-level, because the wiring IS the thing that breaks and none of it is
// reachable from a unit test: App.tsx is one 5,000-line component with no DOM
// environment to render it in. Every assertion here is a bug that has actually
// happened in this file — to the Gauntlet, which draft is modelled on — rather
// than a style rule.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const APP = readFileSync(join(__dirname, "..", "..", "ui", "App.tsx"), "utf8");
const CSS = readFileSync(join(__dirname, "..", "..", "ui", "styles.css"), "utf8");

describe("the draft wiring", () => {
  it("states whether a match was a draft seat instead of inferring it", () => {
    // THE GAUNTLET BUG. A run in progress was advanced — and on a loss ENDED —
    // by any Arena match at all, because `runOver` was the only guard and "a
    // run is live" is not "this match belongs to it". settleDraft takes the
    // flag from the caller for exactly that reason; this is the caller.
    expect(APP).toContain("draftSeat: arenaGame === \"draft\"");
    // ...and an event never touches a run, in either direction.
    expect(APP).toMatch(/const drafted = event\s*\?\s*settled/);
  });

  it("charges the entry in the same write that creates the run", () => {
    // Two writes is how a draft exists unpaid: create it, then charge, and any
    // early return between them is a free run.
    const at = APP.indexOf("draft: startDraft(boardSize)");
    expect(at, "no draft is started anywhere").toBeGreaterThan(-1);
    const literal = APP.slice(Math.max(0, at - 220), at);
    expect(literal, "the entry is not charged alongside the run")
      .toContain("addShards(story, -DRAFT_ENTRY)");
  });

  it("registers the drafted deck in the pool rather than special-casing a seat", () => {
    // The label, the derived spellbook, validation and match start all read
    // `deckPool`. A deck that lives outside it has to teach every one of them
    // what a draft is.
    expect(APP).toMatch(/const deckPool: CustomDeck\[\] = \[[^\]]*draftDeck \? \[draftDeck\] : \[\]/);
    // Only while it is PLAYING, so it cannot be chosen out of a picker between
    // runs, and never with a spellbook of its own — absent means derived from
    // its own elements, which is the right answer for a mixed draft.
    expect(APP).toContain("draftPlaying(draftRun)");
    expect(APP).not.toMatch(/id: DRAFT_DECK_ID[^}]*spells:/);
  });

  it("gates the opponent seat exactly the way the gauntlet's is", () => {
    // vs-AI only, never over an event, and only in the mode the run belongs to
    // — so a draft parked mid-run neither seizes the opponent chair nor is
    // scored by whatever gets played instead.
    expect(APP).toMatch(
      /const draftSeat = arenaGame === "draft" && arenaMode === "ai" && !eventRun && draftPlaying\(draftRun\)/,
    );
  });

  it("only mounts the pick screen while the draft is still picking", () => {
    // Once the eighteenth card lands the run is a deck in your chair like any
    // other; a screen still mounted over it would block the match it exists for.
    expect(APP).toMatch(/\{draftRun && !draftComplete\(draftRun\) && \(\s*<DraftScreen/);
  });

  it("writes every pick to the save as it happens", () => {
    // A draft interrupted by a closed tab resumes on the pick it was on. The
    // run is the save's, not the component's.
    const at = APP.indexOf("<DraftScreen");
    const block = APP.slice(at, at + 1400);
    expect(block).toContain("pickCard(prev.draft, id)");
    expect(block, "a pick that is not persisted").toContain("saveStory(next)");
  });

  it("re-deals a seat for a run that has none", () => {
    // A run saved before the seat existed (phase 3 wrote none), or one holding
    // an id that no longer names a premade, would sit in the lobby with no
    // opponent and no way to get one — a dead save rather than a bad match.
    expect(APP).toContain("PREMADE_DECKS.some((d) => d.id === draftRun!.seat)");
    expect(APP).toContain("dealDraftSeat(prev.draft!)");
  });

  it("reads the opponent off the run instead of rolling it in render", () => {
    // A roll evaluated during render re-rolls on every render: the opponent
    // would change while you looked at it.
    expect(APP).toContain("PREMADE_DECKS.find((d) => d.id === draftRun!.seat)");
    expect(APP.includes("decksForTier(draftTier"), "seat rolled at render time").toBe(false);
  });

  it("styles the entry control it adds", () => {
    for (const c of ["ar-gauntlet", "gt-start", "gt-start-main", "gt-sub", "gt-pay"])
      expect(CSS.includes(`.${c}`), `no rule for .${c}`).toBe(true);
  });
});
