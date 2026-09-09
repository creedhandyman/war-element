// THE PICKER SHOWS THE DECKS YOU CAN ACTUALLY FIELD.
//
// The sheet's own copy has always said so — "a deck absent from this list is
// absent because it is built for the other board" — while nothing filtered the
// custom half. The premades were filtered from the day they shipped
// (`premadeDecksFor`); the list a player actually scrolls was not, so a 4x4
// lobby showed every 30-card build they owned, each under a note reading
// "30/18 — not legal yet".
//
// Card text that lies is a bug class this repo has a whole section on. So is
// UI copy.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { customDecksFor, deckLimits, premadeDecksFor } from "../../data/custom-decks";

const deck = (name: string, n: number) =>
  ({ id: name, name, cards: Array.from({ length: n }, (_, i) => `c${i}`) });

const SMALL = deckLimits(4).target;   // 18
const LARGE = deckLimits(5).target;   // 30

describe("filtering your own squads to the battlefield", () => {
  it("hides a deck built for the OTHER board", () => {
    const mine = [deck("small", SMALL), deck("large", LARGE)];
    expect(customDecksFor(mine, 4).map((d) => d.name)).toEqual(["small"]);
    expect(customDecksFor(mine, 5).map((d) => d.name)).toEqual(["large"]);
  });

  it("KEEPS a deck that is merely unfinished for THIS board", () => {
    // The distinction that matters. A 12-card list on a 4x4 is not built for
    // the other format, it is this format's deck half-built — and hiding it
    // would lose a player their own work in progress with no way back to it.
    const wip = [deck("wip", SMALL - 6), deck("empty", 0), deck("over", SMALL + 1)];
    expect(customDecksFor(wip, 4).map((d) => d.name)).toEqual(["wip", "empty", "over"]);
  });

  it("sends the 7x7 to the large shelf, like the premades do", () => {
    // Domination runs the large board's economy, so a 30-card squad is legal
    // there and an 18-card one is not. Matching on 5 exactly would strand it.
    const mine = [deck("small", SMALL), deck("large", LARGE)];
    expect(customDecksFor(mine, 7).map((d) => d.name)).toEqual(["large"]);
    expect(premadeDecksFor(7).every((d) => d.boardSize === 5),
      "the premades already fold 7 into 5").toBe(true);
  });

  it("is wired into the picker, not just exported", () => {
    // The filter existing and the sheet not using it is the exact state this
    // fixes, so the wiring is the assertion.
    const APP = readFileSync(join(__dirname, "..", "..", "ui", "App.tsx"), "utf8");
    expect(APP).toMatch(/customDecksFor\(customDecks, boardSize\)/);
    expect(APP, "and the sheet is handed the filtered list").toMatch(/customs=\{modeCustoms\}/);
  });

  it("keeps the sheet's promise honest", () => {
    // If the copy is ever reworded away from this claim, fine — but while it
    // makes the claim, the filter has to exist.
    const SHEET = readFileSync(join(__dirname, "..", "..", "ui", "DeckPickerSheet.tsx"), "utf8");
    expect(SHEET).toContain("built for the other board");
  });
});
