/** A foil is a fact about the PLAYER, so every builder shows it.
 *
 *  DeckBuilder has had the whole foil treatment for a long time — the shiny
 *  thumb, the corner tag, the finish on the expanded card — and the squad
 *  builder off the main menu drew every card plain anyway. Nothing was broken
 *  inside the component: the foil set was a field on `StoryBuildMode`, that prop
 *  is only passed from the CAMPAIGN entrance, and the other call site simply had
 *  nowhere to put it. So the collection screen one tap away shone a card that
 *  the builder rendered flat, and the two read as different cards.
 *
 *  A source-level guard because that is where the bug was. Every unit test of
 *  the component would have passed: give it foils and it shines them. The
 *  failure was one call site not passing any, which only the CALLER can show.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const APP = readFileSync(join(__dirname, "..", "..", "ui", "App.tsx"), "utf8");
const BUILDER = readFileSync(join(__dirname, "..", "..", "ui", "DeckBuilder.tsx"), "utf8");

/** Each `<DeckBuilder ... />` element's attribute text. */
function callSites(src: string): string[] {
  const out: string[] = [];
  for (let at = src.indexOf("<DeckBuilder"); at !== -1; at = src.indexOf("<DeckBuilder", at + 1)) {
    // To the matching close of the element, tracking brace depth so a nested
    // object prop (`story={{ ... }}`) cannot end the scan early.
    let depth = 0;
    for (let i = at; i < src.length; i++) {
      if (src[i] === "{") depth++;
      else if (src[i] === "}") depth--;
      else if (src[i] === ">" && depth === 0) { out.push(src.slice(at, i)); break; }
    }
  }
  return out;
}

describe("every builder is told which cards are foil", () => {
  it("finds both call sites", () => {
    expect(callSites(APP).length, "DeckBuilder is mounted twice in App.tsx").toBe(2);
  });

  it("passes a foil set to each of them", () => {
    const missing = callSites(APP).filter(
      (s) => !/\bfoils\s*[=:]/.test(s),
    );
    expect(missing.map((s) => s.slice(0, 120)), "a builder with no foils").toEqual([]);
  });

  it("and the component reads them from either place", () => {
    // Top-level `foils` for the squad builder, `story.foils` for the campaign,
    // and story wins so a campaign build cannot be handed two different sets.
    expect(BUILDER).toContain("const foils = story?.foils ?? props.foils;");
    // Nothing may go back to reading the story-only path directly — that is the
    // shape of the original bug, and it renders plain instead of failing.
    expect(BUILDER.includes("story?.foils?.has"), "story-only foil read").toBe(false);
  });
});
