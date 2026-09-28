// THE SQUAD CHECK AND THE FILL.
//
// The check is only allowed to say what the engine guarantees or what a squad
// can do that no tuned list does — its first draft was a checklist of good
// habits, and measured, most of those habits lost games (see squad-check.ts).
// So the thresholds here are pinned to the premade shelf they were read from,
// and the fill is pinned to the check: the builder's own Auto-fill must never
// be the thing the check complains about.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getDef } from "../../data/cards";
import { PREMADE_DECKS, buildableCards, deckLimits } from "../../data/custom-decks";
import { autoDeck } from "../../data/story";
import {
  CHECK_PRED, checkSquad, fillElements, fillSquad, squadElements, squadTargets,
} from "../../data/squad-check";
import type { Element } from "../types";

const ALL = buildableCards().map((c) => c.id);
const of = (...els: Element[]) => ALL.filter((id) => els.includes(getDef(id).element));
const ELS: Element[] = ["LEAF", "PYRO", "AQUA", "GALE", "BOLT", "BORE", "DUSK", "DAWN"];
const PAIRS: [Element, Element][] = ELS.flatMap((a, i) => ELS.slice(i + 1).map((b) => [a, b] as [Element, Element]));
/** A seeded stand-in for Math.random, so a "random pair" test is repeatable. */
const seeded = (seed: number) => () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x80000000);
const state = (cards: string[], size: number, id: string) => checkSquad(cards, size).find((c) => c.id === id)!.state;
const split = (cards: string[]) => {
  const n: Record<string, number> = {};
  for (const id of cards) n[getDef(id).element] = (n[getDef(id).element] ?? 0) + 1;
  return n;
};

describe("the squad check reads a squad on its way as on its way", () => {
  it("says nothing is wrong with an empty squad", () => {
    expect(checkSquad([], 18).some((c) => c.state === "warn")).toBe(false);
  });

  it("only calls 1-drops missing once the empty slots can no longer hold them", () => {
    const ones = of("LEAF").filter((id) => getDef(id).cost === 1);
    const dear = of("LEAF").filter((id) => getDef(id).cost >= 3);
    // Seventeen cards, one 1-drop, one slot left: still reachable.
    expect(state([ones[0], ...dear.slice(0, 16)], 18, "opening")).toBe("short");
    // Full, with one: now it is a warning.
    expect(state([ones[0], ...dear.slice(0, 17)], 18, "opening")).toBe("warn");
    expect(state([ones[0], ones[1], ...dear.slice(0, 16)], 18, "opening")).toBe("ok");
  });

  it("flags a heavy top end at once — adding cards cannot fix it", () => {
    const top = ALL.filter((id) => CHECK_PRED.topEnd(getDef(id))).slice(0, squadTargets(18).topEnd + 1);
    expect(state(top, 18, "topEnd")).toBe("warn");
    expect(state(top.slice(1), 18, "topEnd")).toBe("ok");
  });

  it("waits for a one-element squad to finish before calling it one", () => {
    const leaf = of("LEAF");
    expect(state(leaf.slice(0, 10), 18, "elements")).toBe("short");
    expect(state(leaf.slice(0, 18), 18, "elements")).toBe("warn");
    expect(state([...leaf.slice(0, 9), ...of("AQUA").slice(0, 9)], 18, "elements")).toBe("ok");
  });

  it("scales to the squad's size, so a campaign cap gets its own numbers", () => {
    expect(squadTargets(18)).toEqual({ opening: 2, topEnd: 4 });
    expect(squadTargets(30)).toEqual({ opening: 2, topEnd: 6 });
    expect(squadTargets(12)).toEqual({ opening: 2, topEnd: 2 });
  });
});

describe("the thresholds are the shelf's own", () => {
  for (const board of [4, 5] as const) {
    const shelf = PREMADE_DECKS.filter((d) => d.boardSize === board);
    const size = deckLimits(board).target;

    it(`the ${board}x${board} top-end ceiling is exactly the heaviest premade`, () => {
      // The comment on squadTargets claims this; the day a heavier list ships
      // or the formula moves, the claim has to be re-made on purpose.
      const heaviest = Math.max(...shelf.map((d) => d.cards.filter((id) => CHECK_PRED.topEnd(getDef(id))).length));
      expect(squadTargets(size).topEnd).toBe(heaviest);
    });

    it(`every ${board}x${board} ladder premade clears every line`, () => {
      // The ladder lists are built to carry 1-drops (premade-decks.test.ts);
      // the hand-tuned originals are exempt — Tempest runs a single one.
      for (const d of shelf.filter((x) => x.tier)) {
        expect(checkSquad(d.cards, size).filter((c) => c.state !== "ok").map((c) => c.id), d.name).toEqual([]);
      }
    });
  }
});

describe("the fill", () => {
  it("builds an empty squad around a pair, not across all eight", () => {
    for (const [board, size] of [[4, 18], [5, 30]] as const) {
      const { cards, elements } = fillSquad([], ALL, size, { rand: seeded(board) });
      expect(elements, `${board}x${board}`).toHaveLength(2);
      expect(new Set(cards).size).toBe(size);
      expect(Object.keys(split(cards)).sort(), `${board}x${board}`).toEqual([...elements].sort());
    }
  });

  it("strides the pair's cards exactly as the campaign's fill does", () => {
    // NOT an even share per element: that measured -7.0 on 5x5. The fill is
    // `autoDeck` over the chosen elements and nothing else.
    const { cards, elements } = fillSquad([], ALL, 18, { rand: seeded(7) });
    expect(cards).toEqual(autoDeck(of(...elements), 18));
  });

  it("tops up without touching a single pick, inside the squad's own elements", () => {
    const picked = [...of("LEAF").slice(0, 5), of("AQUA")[0]];
    const { cards, elements } = fillSquad(picked, ALL, 18, { rand: seeded(1) });
    expect(cards.some((id) => picked.includes(id))).toBe(false);
    expect(cards).toHaveLength(12);
    expect(elements.sort()).toEqual(["AQUA", "LEAF"]);
    expect(Object.keys(split(cards)).every((e) => e === "LEAF" || e === "AQUA")).toBe(true);
  });

  it("uses the elements the player picked, however many", () => {
    const four: Element[] = ["LEAF", "PYRO", "AQUA", "GALE"];
    const { elements, cards } = fillSquad([], of(...four), 18, { elements: four, rand: seeded(2) });
    expect(elements.sort()).toEqual([...four].sort());
    expect(cards).toHaveLength(18);
    expect(cards.every((id) => four.includes(getDef(id).element))).toBe(true);
  });

  it("partners a one-element squad rather than finishing it mono", () => {
    const els = fillElements(of("DUSK").slice(0, 4), ALL, 14, { rand: seeded(3) });
    expect(els).toHaveLength(2);
    expect(els[0]).toBe("DUSK");
  });

  it("uses a pool the filters already narrowed exactly as it stands", () => {
    expect(fillElements([], of("BOLT", "BORE", "DAWN"), 18).sort()).toEqual(["BOLT", "BORE", "DAWN"]);
  });

  it("widens rather than leave a squad short", () => {
    // A campaign-sized collection: plenty of one element, a handful of two.
    const pool = [...of("LEAF").slice(0, 3), ...of("AQUA").slice(0, 3), ...of("BORE"), ...of("GALE")];
    const picked = [of("LEAF")[3], of("AQUA")[3]];
    const { cards } = fillSquad(picked, pool, 18, { rand: seeded(4) });
    expect(picked.length + cards.length).toBe(18);
  });

  it("never builds a squad its own check complains about", () => {
    // The two halves of the builder must agree: a player who presses Auto-fill
    // and is told the result is wrong has been handed a contradiction.
    for (const [a, b] of PAIRS) for (const size of [18, 30]) {
      const { cards } = fillSquad([], of(a, b), size);
      expect(checkSquad(cards, size).filter((c) => c.state === "warn").map((c) => c.id), `${a}+${b} ${size}`).toEqual([]);
    }
  });

  it("names its elements most-carried first", () => {
    expect(squadElements([...of("GALE").slice(0, 3), of("PYRO")[0]])).toEqual(["GALE", "PYRO"]);
  });
});

describe("the builder is wired to all of it", () => {
  const DB = readFileSync(join(__dirname, "..", "..", "ui", "DeckBuilder.tsx"), "utf8");

  it("hands the element row to the fill", () => {
    expect(DB).toContain("fillSquad(picked, candidates, limits.target, { elements: els, region })");
  });

  it("in the campaign, fills for the region unless the element row says otherwise", () => {
    // `regionFill` (story.ts): the region's element plus the heaviest imports.
    expect(DB).toContain("const region = story?.element && els.length === 0 ? story.element : undefined;");
  });

  it("fills from every filter but the check's lens", () => {
    // "Show me 1-drops" is a question; a fill that read it would answer with a
    // squad of nothing but 1-drops.
    expect(DB).toMatch(/const candidates = lensless\.map/);
  });

  it("reads the check against the size being built to, not the cards held", () => {
    expect(DB).toContain("checkSquad(picked, limits.target)");
  });

  it("is tabs on a phone, not a drawer over the cards", () => {
    // The phone builder was a card pool with a drawer rising over it, and the
    // drawer held a whole desktop rail — the crowding that was reported. One
    // view at a time behind tabs, and the drawer's handle is gone.
    expect(DB).toContain('role="tablist"');
    expect(DB).not.toContain("db-handle");
    // What every tab needs rides in the bar under the thumb.
    expect(DB).toMatch(/className="db-bar"[\s\S]*fillToCap[\s\S]*\{saveButton\}/);
  });
});
