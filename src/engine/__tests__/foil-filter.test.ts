// THE FOIL FILTER IS WIRED INTO EVERY PLACE A FILTER HAS TO BE.
//
// A filter in these grids is not one line, it is five: the predicate that
// narrows the grid, the counts every OTHER row shows, the summary chip on the
// collapsed bar, the Clear button, and the control itself. Miss the counts and
// every pill beside it promises cards the grid then refuses to show; miss Clear
// and "Clear" leaves a filter on that the player cannot see.
//
// Same source-level approach as deck-filter.test.ts, and for the same reason:
// the wiring lives inside React components this suite does not render.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const src = (f: string) => readFileSync(join(__dirname, "..", "..", "ui", f), "utf8");

describe("the Deck Builder's foil filter", () => {
  const DB = src("DeckBuilder.tsx");

  it("narrows the grid", () => {
    expect(DB).toMatch(/\(!foilOnly \|\| isFoil\(c\.id\)\)/);
  });

  it("narrows the counts on every OTHER row too", () => {
    // The one that is easy to forget and silently wrong when you do.
    expect(DB).toMatch(/skip === "foil" \|\| !foilOnly \|\| isFoil\(c\.id\)/);
  });

  it("shows on the collapsed bar, and Clear turns it off", () => {
    expect(DB).toMatch(/foilOnly \? "Foil" : null/);
    expect(DB).toMatch(/setFoilOnly\(false\)/);
  });

  it("re-runs the grid when it changes", () => {
    // Left out of the memo's deps, the toggle would flip and the grid would
    // not move until something else re-ran it.
    const deps = DB.match(/\}, \[pool, filter, classFilter[^\]]*\]\);/)?.[0] ?? "";
    expect(deps, "foilOnly is a dependency of `shown`").toContain("foilOnly");
    expect(deps, "and so is the foil set").toContain("foils");
  });

  it("only appears once there is a foil to find", () => {
    // An always-empty filter reads as broken, not as "you have none yet".
    expect(DB).toMatch(/\(foils\?\.size \?\? 0\) > 0 &&/);
  });
});

describe("the Collection's foil scope", () => {
  const COL = src("StoryCollection.tsx");

  it("is a scope, and it means owned AND foil", () => {
    expect(COL).toMatch(/type Scope = "all" \| "owned" \| "missing" \| "foil"/);
    expect(COL).toMatch(/scope === "foil"\) return owned\.has\(d\.id\) && isShiny\(save, d\.id\)/);
  });

  it("only appears once there is a foil to find", () => {
    expect(COL).toMatch(/foils > 0 \? \[\["foil"/);
  });

  it("clears with the others", () => {
    // Scope already resets to "all" in clearFilters, so a foil scope clears for
    // free — assert it rather than assume it.
    expect(COL).toMatch(/clearFilters = \(\) => \{\s*setScope\("all"\)/);
  });
});
