// Story Mode campaign layer: node placement, progression gating, and the
// recruitment roll. The placement tests are the load-bearing ones — a card that
// is on no node is unobtainable, and a card on two nodes breaks the owned-card
// exclusion that makes repeat clears progressively targeted.

import { describe, expect, it } from "vitest";
import { CARDS, TOKENS, getDef } from "../../data/cards";
import {
  ALL_NODES, CAP_LADDER, REGIONS, STARTER_DECK, applyClear, baseRateFor, deckCapFor,
  isOpen, newSave, nodeById, recruitChance, rollRecruits, type StoryNode, type StorySave,
} from "../../data/story";

const leaf = REGIONS.find((r) => r.id === "leaf")!;
const draftable = (el: string) => CARDS.filter((c) => c.element === el).map((c) => c.id);
const tokenIds = new Set(TOKENS.map((t) => t.id));

describe("story: node placement", () => {
  it("places every draftable LEAF card exactly once", () => {
    const placed = leaf.nodes.flatMap((n) => n.roster);
    const dupes = placed.filter((id, i) => placed.indexOf(id) !== i);
    expect(dupes).toEqual([]);
    expect([...placed].sort()).toEqual([...draftable("LEAF")].sort());
  });

  it("never puts a token in a recruitable roster", () => {
    // A player cannot legally deck a token, so one in a roster is a card the
    // recruitment screen would offer and the deck builder would refuse.
    const bad = leaf.nodes.flatMap((n) => n.roster.filter((id) => tokenIds.has(id)).map((id) => `${n.id}:${id}`));
    expect(bad).toEqual([]);
  });

  it("only uses real card ids, in rosters and adds alike", () => {
    for (const n of ALL_NODES)
      for (const id of [...n.roster, ...n.adds])
        expect(() => getDef(id), `${n.id} references ${id}`).not.toThrow();
  });

  it("adds are always tokens — filler is never something you could have owned", () => {
    const bad = ALL_NODES.flatMap((n) => n.adds.filter((id) => !tokenIds.has(id)).map((id) => `${n.id}:${id}`));
    expect(bad).toEqual([]);
  });
});

describe("story: the node graph", () => {
  it("every prerequisite is a real node, and nothing requires itself", () => {
    for (const n of ALL_NODES) {
      expect(n.requires).not.toContain(n.id);
      for (const r of n.requires) expect(nodeById(r), `${n.id} requires ${r}`).toBeTruthy();
    }
  });

  it("has exactly one entry node and no unreachable ones", () => {
    const entries = leaf.nodes.filter((n) => n.requires.length === 0);
    expect(entries.map((n) => n.id)).toEqual(["L1"]);
    // Walk forward from the entry; everything must eventually open.
    const cleared = new Set<string>();
    for (let pass = 0; pass < leaf.nodes.length; pass++)
      for (const n of leaf.nodes)
        if (!cleared.has(n.id) && n.requires.every((r) => cleared.has(r))) cleared.add(n.id);
    const unreachable = leaf.nodes.filter((n) => !cleared.has(n.id)).map((n) => n.id);
    expect(unreachable).toEqual([]);
  });

  it("has exactly one required Throne, and it is the deepest node", () => {
    const thrones = leaf.nodes.filter((n) => n.kind === "throne");
    expect(thrones.map((n) => n.id).sort()).toEqual(["L13", "L14"]);
    expect(thrones.filter((n) => n.required).map((n) => n.id)).toEqual(["L14"]);
  });
});

describe("story: the deck cap ladder", () => {
  it("starts at 12 and rises only when its Throne is cleared", () => {
    expect(deckCapFor([])).toBe(12);
    expect(deckCapFor(["L1", "L13"])).toBe(12); // the optional Throne unlocks nothing
    expect(deckCapFor(["L14"])).toBe(15);
  });

  it("every ladder step names a node that exists", () => {
    for (const step of CAP_LADDER)
      if (step.unlockedBy) expect(nodeById(step.unlockedBy), step.unlockedBy).toBeTruthy();
  });

  it("the starter deck is legal at the starting cap and all LEAF", () => {
    expect(STARTER_DECK).toHaveLength(deckCapFor([]));
    expect(new Set(STARTER_DECK).size).toBe(STARTER_DECK.length); // no duplicates
    for (const id of STARTER_DECK) expect(getDef(id).element).toBe("LEAF");
    // Every class represented, so the tutorial deck can actually function.
    expect(new Set(STARTER_DECK.map((id) => getDef(id).cardClass)).size).toBe(6);
  });

  it("every starter card is findable again on a LEAF node", () => {
    const placed = new Set(leaf.nodes.flatMap((n) => n.roster));
    for (const id of STARTER_DECK) expect(placed.has(id), id).toBe(true);
  });
});

describe("story: availability", () => {
  it("opens a node only once all its prerequisites are cleared", () => {
    const save = newSave();
    const L11 = nodeById("L11")!;
    expect(isOpen(save, nodeById("L1")!)).toBe(true);
    expect(isOpen(save, L11)).toBe(false);
    expect(isOpen({ ...save, cleared: ["L3"] }, L11)).toBe(false); // needs L8 too
    expect(isOpen({ ...save, cleared: ["L3", "L8"] }, L11)).toBe(true);
  });
});

describe("story: recruitment", () => {
  const node = (over: Partial<StoryNode> = {}): StoryNode => ({
    id: "T1", name: "Test", kind: "skirmish", requires: [], adds: [], at: { x: 0, y: 0 },
    roster: ["leaf_nettle", "leaf_weeds", "leaf_stickers"], ...over,
  });
  const save = (over: Partial<StorySave> = {}): StorySave => ({ ...newSave(), collection: [], deck: [], ...over });
  const always = () => 0;      // every roll succeeds
  const never = () => 0.999;   // every roll fails

  it("rolls once per captured slot", () => {
    const r = rollRecruits(save(), node(), 3, always);
    expect(r.rolls).toBe(3);
    expect(r.won).toHaveLength(3);
  });

  it("floors at one roll, so an elimination win still pays something", () => {
    expect(rollRecruits(save(), node(), 0, always).rolls).toBe(1);
  });

  it("never rolls a card you already own", () => {
    const s = save({ collection: ["leaf_nettle", "leaf_weeds"] });
    const r = rollRecruits(s, node(), 5, always);
    expect(r.won).toEqual(["leaf_stickers"]); // the only one left
  });

  it("can't win the same card twice in one clear", () => {
    const r = rollRecruits(save(), node(), 9, always);
    expect(new Set(r.won).size).toBe(r.won.length);
  });

  it("guarantees a Throne's Mythic on first clear, but not on repeats", () => {
    const throne = node({ id: "L14", kind: "throne", roster: ["leaf_oakgre"] });
    // First clear: no RNG on a story-critical unlock, even with a hostile roll.
    expect(rollRecruits(save(), throne, 0, never).won).toEqual(["leaf_oakgre"]);
    // Already cleared: it rolls like anything else — and it's owned by then anyway.
    const after = { ...save(), cleared: ["L14"] };
    expect(rollRecruits(after, throne, 1, never).won).toEqual([]);
  });

  it("pays nothing when the node is exhausted", () => {
    const s = save({ collection: [...node().roster] });
    expect(rollRecruits(s, node(), 4, always).won).toEqual([]);
  });
});

describe("story: pity", () => {
  it("raises a card's chance by a step per dry clear", () => {
    expect(recruitChance("leaf_oakgre", 0)).toBe(baseRateFor("leaf_oakgre"));
    expect(recruitChance("leaf_oakgre", 2)).toBe(baseRateFor("leaf_oakgre") + 10);
    expect(recruitChance("leaf_oakgre", 99)).toBe(100); // clamped
  });

  it("a Legendary becomes certain within ~10 dry clears", () => {
    // 15% base + 5 a clear. Without this a 15% roll is a rage-quit generator.
    const lege = "leaf_thorn";
    expect(baseRateFor(lege)).toBe(15);
    expect(recruitChance(lege, 17)).toBe(100);
  });

  it("applyClear banks a miss and clears it on a win", () => {
    const n = { id: "T1", name: "T", kind: "skirmish" as const, requires: [], adds: [], at: { x: 0, y: 0 }, roster: ["leaf_thorn"] };
    let s = newSave();
    s = applyClear(s, n, { won: [], missed: ["leaf_thorn"], rolls: 1 });
    expect(s.pity["T1:leaf_thorn"]).toBe(1);
    s = applyClear(s, n, { won: [], missed: ["leaf_thorn"], rolls: 1 });
    expect(s.pity["T1:leaf_thorn"]).toBe(2);
    s = applyClear(s, n, { won: ["leaf_thorn"], missed: [], rolls: 1 });
    expect(s.pity["T1:leaf_thorn"]).toBeUndefined();
    expect(s.collection).toContain("leaf_thorn");
  });

  it("applyClear records the clear once and never duplicates a card", () => {
    const n = nodeById("L1")!;
    let s = newSave();
    s = applyClear(s, n, { won: ["leaf_nettle"], missed: [], rolls: 1 });
    s = applyClear(s, n, { won: ["leaf_nettle"], missed: [], rolls: 1 });
    expect(s.cleared.filter((c) => c === "L1")).toHaveLength(1);
    expect(s.collection.filter((c) => c === "leaf_nettle")).toHaveLength(1);
  });
});
