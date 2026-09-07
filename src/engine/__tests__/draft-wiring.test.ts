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

  it("is not a dead end once a run is over", () => {
    // THE BUG THIS FIXES, and it was mine. The start button hides whenever
    // `draftRun` exists — and a run that is over is still a run — so after the
    // third loss there was no draft to play, no deck in your chair, and no
    // button to start another. The mode was unusable until the save was wiped.
    expect(APP).toContain("draftRunOver(draftRun) ? \"Draft again\"");
    // ...and "Draft again" is the CLEAR, which is what brings the start button
    // back. A panel that only reports the run would still be a dead end.
    // Anchored on the BUTTON's expression, not the words: "Draft again" also
    // appears in the start-gate message, and matching that one proved nothing.
    const at = APP.indexOf("draftRunOver(draftRun) ? \"Draft again\"");
    expect(at, "no Draft again button").toBeGreaterThan(-1);
    expect(APP.slice(Math.max(0, at - 400), at), "the button must clear the run")
      .toContain("draft: undefined");
  });

  it("locks the battlefield to the one the run was drafted for", () => {
    // A run drafted on 4x4 holds eighteen cards and the big board wants thirty:
    // a size change mid-run does not make the match harder, it makes the deck
    // illegal.
    expect(APP).toContain("const draftLocked = arenaGame === \"draft\"");
    expect(APP).toContain("draftLocked && draftRun!.board !== boardSize");
    expect(APP).toMatch(/const boardLocked = [^;]*draftLocked/);
  });

  it("will not start a match the run cannot supply a deck for", () => {
    // Draft has one state more than the other modes: a run that exists but is
    // still CHOOSING has no deck to seat. Without its own sentence it fell
    // through to "your squad is not a 4x4 squad", which is true and useless.
    expect(APP).toContain("Draft a squad above to begin a run.");
    expect(APP).toContain("Finish your draft");
    expect(APP).toContain("That run is over. Draft again above.");
  });

  it("locks YOUR seat too — a run owns both chairs", () => {
    // The opponent chair has been locked since the mode was written; this one
    // was left changeable, so the lobby offered a deck sheet over a squad you
    // are not allowed to swap. Picking from it did nothing either, because the
    // effect that seats the drafted deck put it straight back — a control that
    // fights an effect is worse than no control.
    expect(APP).toContain("const draftOwnsMySeat");
    // `DeckSeat` draws an ABSENT onChange as a locked panel; that is the lock.
    expect(APP).toMatch(/onChange=\{draftOwnsMySeat[\s\S]{0,30}\?\s*undefined/);
    // ...and it says why, rather than just going dead.
    expect(APP).toContain('"YOU · P1 · DRAFT"');
  });

  it("only takes the seat while the run is actually playing", () => {
    // A draft parked while you play Casual leaves your own deck yours, the same
    // way it leaves the opponent chair alone — and online/hot-seat are neither.
    expect(APP).toMatch(
      /const draftOwnsMySeat = arenaGame === "draft" && !!draftDeck && !onlineMode && !twoPlayer/,
    );
  });

  it("styles the entry control it adds", () => {
    for (const c of ["ar-gauntlet", "gt-start", "gt-start-main", "gt-sub", "gt-pay",
                     "gt-head", "gt-pips", "gt-quit", "ar-flabel"])
      expect(CSS.includes(`.${c}`), `no rule for .${c}`).toBe(true);
  });
});
