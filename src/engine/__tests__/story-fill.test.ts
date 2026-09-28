// THE CAMPAIGN'S FILL favors the region it is building for (owner, 2026-09-28:
// "make the Fill button favor the region's element"): the region's own element
// plus the twelve heaviest cards from elsewhere, then the cost stride. Prep's
// Fill, prep's automatic top-up and the squad builder's Auto-fill all use it.
import { describe, expect, it } from "vitest";
import { getDef } from "../../data/cards";
import { PLACED_CARDS, REGIONS, SQUAD_BASE, autoDeck, regionFill } from "../../data/story";
import { fillSquad } from "../../data/squad-check";

/** A whole collection: what the pool is at home, and everywhere on a Hard run. */
const everything = [...PLACED_CARDS];
const el = (id: string) => getDef(id).element;
const heaviestFrom = (pool: readonly string[], element: string) =>
  new Set(pool.filter((id) => el(id) !== element)
    .sort((a, b) => getDef(b).cost - getDef(a).cost || a.localeCompare(b))
    .slice(0, SQUAD_BASE));

describe("the campaign's Fill favors the region's element", () => {
  it("is mostly the region's own element, whatever the pool holds", () => {
    for (const region of REGIONS) {
      for (const cap of [6, 15, 30]) {
        const deck = regionFill(everything, cap, region.element);
        expect(deck.length, `${region.id} @${cap}`).toBe(cap);
        expect(new Set(deck).size, `${region.id} @${cap}: no repeats`).toBe(cap);
        const local = deck.filter((id) => el(id) === region.element).length;
        expect(local, `${region.id} @${cap}`).toBeGreaterThan(cap / 2);
      }
    }
  });

  it("imports only the heaviest cards from elsewhere", () => {
    for (const region of REGIONS) {
      const heaviest = heaviestFrom(everything, region.element);
      for (const id of regionFill(everything, 30, region.element).filter((c) => el(c) !== region.element))
        expect(heaviest.has(id), `${region.id}: ${id}`).toBe(true);
    }
  });

  it("no longer spreads a deck across every element", () => {
    // What it replaced: a stride over the whole collection.
    expect(new Set(autoDeck(everything, 30).map(el)).size).toBeGreaterThanOrEqual(7);
    for (const region of REGIONS)
      expect(new Set(regionFill(everything, 30, region.element).map(el)).size, region.id)
        .toBeLessThan(new Set(autoDeck(everything, 30).map(el)).size);
  });

  it("tops up from the rest of the pool when the region runs short", () => {
    const region = REGIONS[0];
    const fewLocal = [
      ...everything.filter((id) => el(id) === region.element).slice(0, 3),
      ...everything.filter((id) => el(id) !== region.element),
    ];
    const deck = regionFill(fewLocal, 30, region.element);
    expect(deck.length).toBe(30);
    expect(new Set(deck).size).toBe(30);
    for (const id of fewLocal.filter((c) => el(c) === region.element)) expect(deck).toContain(id);
  });

  it("never invents a card, and never overfills a small pool", () => {
    const small = everything.slice(0, 5);
    expect([...regionFill(small, 30, "LEAF")].sort()).toEqual([...small].sort());
    expect(regionFill(everything, 0, "LEAF")).toEqual([]);
    for (const id of regionFill(everything, 30, "DUSK")) expect(everything).toContain(id);
  });

  it("the squad builder fills the same way in the campaign, and the element row still wins", () => {
    expect(fillSquad([], everything, 20, { region: "PYRO" }).cards).toEqual(regionFill(everything, 20, "PYRO"));
    const chips = fillSquad([], everything, 20, { region: "PYRO", elements: ["AQUA"] });
    expect(chips.cards.length).toBe(20);
    expect(chips.cards.every((id) => el(id) === "AQUA")).toBe(true);
    // It tops up around what is already picked, never over it.
    const picked = everything.filter((id) => el(id) === "BOLT").slice(0, 5);
    const topped = fillSquad(picked, everything, 20, { region: "PYRO" });
    expect(topped.cards.length).toBe(15);
    for (const id of picked) expect(topped.cards).not.toContain(id);
    // The Arena passes no region and keeps its pairs.
    const arena = fillSquad([], everything, 20, { rand: () => 0 });
    expect(new Set(arena.cards.map(el)).size).toBeLessThanOrEqual(3);
  });
});
