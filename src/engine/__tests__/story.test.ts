// Story Mode campaign layer: node placement, progression gating, and the
// recruitment roll. The placement tests are the load-bearing ones — a card that
// is on no node is unobtainable, and a card on two nodes breaks the owned-card
// exclusion that makes repeat clears progressively targeted.

import { describe, expect, it } from "vitest";
import { CARDS, TOKENS, getDef } from "../../data/cards";
import {
  ALL_NODES, BLIGHT_ADDS, BLIGHT_MAX, CAP_LADDER, OVERFLOW_RATE, REGIONS, STARTER_DECK,
  applyClear, baseRateFor, blightAddsFor, blightLevel, canBlight, deckCapFor, isOpen, isOverflow,
  PLACED_CARDS, STARTER_DECK as STARTER, bestSource, isRegionCleared, isRegionOpen,
  newSave, nodeById, recruitChance, recruitablePool, rollRecruits, sourcesOf,
  terrainContested, type StoryNode, type StorySave,
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

  it("no node is dead on arrival — every one can recruit something at the start", () => {
    // The starter deck is 12 of LEAF's 16 Rares, so an early Rare node built
    // from cheap cards can trivially end up 100% already-owned. L1 and L2 both
    // shipped that way: the campaign's first two fights could not pay out, while
    // the design promised a guaranteed recruit on the very first padlock.
    const owned = new Set(STARTER_DECK);
    const dead = leaf.nodes
      .filter((n) => n.roster.every((id) => owned.has(id)))
      .map((n) => `${n.id} ${n.name}`);
    expect(dead).toEqual([]);
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


describe("story: map placement", () => {
  it("keeps every node on the art — coordinates are percentages, not grid units", () => {
    // Cheap guard against a stale grid coordinate surviving the switch to
    // percentage placement: a leftover `{x: 3, y: 1}` would silently pile every
    // node into the top-left corner rather than fail.
    for (const r of REGIONS)
      for (const n of r.nodes) {
        expect(n.at.x, `${n.id}.x`).toBeGreaterThan(0);
        expect(n.at.x, `${n.id}.x`).toBeLessThan(100);
        expect(n.at.y, `${n.id}.y`).toBeGreaterThan(0);
        expect(n.at.y, `${n.id}.y`).toBeLessThan(100);
      }
  });

  it("gives no two nodes the same spot", () => {
    for (const r of REGIONS) {
      const at = r.nodes.map((n) => `${n.at.x},${n.at.y}`);
      expect(new Set(at).size, `${r.id} has overlapping nodes`).toBe(at.length);
    }
  });

  it("puts a Blight Node somewhere real in every blight-capable region", () => {
    for (const r of REGIONS) {
      if (!canBlight(r)) continue;
      expect(r.blightAt, `${r.id} needs a border zone`).toBeTruthy();
      const at = r.nodes.map((n) => `${n.at.x},${n.at.y}`);
      expect(at).not.toContain(`${r.blightAt!.x},${r.blightAt!.y}`);
    }
  });
});

describe("story: Elemental Overflow", () => {
  it("only bleeds cheap Rares, and only from a neighbouring element", () => {
    for (const n of ALL_NODES)
      for (const id of n.overflow ?? []) {
        const d = getDef(id);
        expect(d.element, `${n.id}:${id} should be foreign`).not.toBe("LEAF");
        expect(d.rarity, `${n.id}:${id}`).toBe("rare");
        expect(d.cost, `${n.id}:${id}`).toBeLessThanOrEqual(2);
      }
  });

  it("never leaks DUSK or DAWN — one Blights, the other is sealed", () => {
    const leaked = ALL_NODES.flatMap((n) => (n.overflow ?? []).map((id) => getDef(id).element));
    expect(leaked).not.toContain("DUSK");
    expect(leaked).not.toContain("DAWN");
  });

  it("halves the base rate but still accrues pity at full step", () => {
    const id = "aqua_misty";
    expect(recruitChance(id, 0, true)).toBe(baseRateFor(id) * OVERFLOW_RATE);
    // Pity is NOT halved — a border card is slower to get, never unreachable.
    expect(recruitChance(id, 2, true)).toBe(baseRateFor(id) * OVERFLOW_RATE + 10);
  });

  it("is recruitable — the pool includes it, and the roll can win it", () => {
    // Derived, not hardcoded: overflow sits on whichever node fronts the border,
    // and re-placing a node against the map art must not quietly rot this test.
    const host = ALL_NODES.find((n) => (n.overflow ?? []).length > 0)!;
    const foreign = host.overflow![0];
    expect(isOverflow(host, foreign)).toBe(true);
    expect(recruitablePool(host)).toContain(foreign);
    const s: StorySave = { ...newSave(), collection: [], deck: [] };
    const r = rollRecruits(s, host, 9, () => 0); // every roll succeeds
    expect(r.won).toContain(foreign);
  });

  it("sits on the node that actually fronts that element's gate", () => {
    // The map art is the authority: AQUA is reached through Eastleaf Port in the
    // east, PYRO through the Southern Burn. Overflow must front the right border.
    expect(nodeById("L7")!.overflow).toContain("aqua_misty");   // Eastleaf Port
    expect(nodeById("L8")!.overflow).toContain("pyro_staph");   // Southern Burn
  });

  it("keeps its home node — the border is a copy, never a relocation", () => {
    // The foreign card is a COPY at the border; §10.5 requires the home node stay
    // the reliable full-odds farm. So once a card's OWN region is built, it must
    // still be placed there at full odds. (Before PYRO existed this test asserted
    // the opposite — that an overflow card appeared in no roster at all — which
    // was only ever true because the home region had not been built yet.)
    const built = new Set(REGIONS.map((r) => r.element));
    for (const n of ALL_NODES)
      for (const id of n.overflow ?? []) {
        if (!built.has(getDef(id).element)) continue;   // home region not built yet
        const homes = sourcesOf(id).filter((s) => !s.overflow);
        expect(homes.length, `${id} bleeds at ${n.id} but has no full-odds home`).toBe(1);
      }
  });
});

describe("story: the Blight", () => {
  const leafRegion = REGIONS.find((r) => r.id === "leaf")!;
  const cleared = (over: Partial<StorySave> = {}): StorySave =>
    ({ ...newSave(), cleared: ["L14"], ...over });

  it("never touches a region you have not finished", () => {
    // The whole safety property: difficulty rises BEHIND you, never in front.
    const fresh = newSave();
    expect(isRegionCleared(fresh, leafRegion)).toBe(false);
    expect(blightAddsFor(fresh, leafRegion, nodeById("L8")!)).toEqual([]);
    expect(terrainContested(fresh, leafRegion)).toBe(false);
  });

  it("applies LEAF's shipped baseline once the region is done", () => {
    // LEAF is the region DUSK has worked on longest — the Rot Line is painted in
    // at generation, not crept in later.
    expect(leafRegion.baseBlight).toBe(1);
    expect(blightLevel(cleared(), leafRegion)).toBe(1);
    expect(blightAddsFor(cleared(), leafRegion, nodeById("L8")!)).toEqual([BLIGHT_ADDS[0]]);
  });

  it("spares Skirmishes and Thrones — pressure lands on Warden tier and up", () => {
    const s = cleared({ blight: { leaf: 2 } });
    expect(blightAddsFor(s, leafRegion, nodeById("L1")!)).toEqual([]);  // skirmish
    expect(blightAddsFor(s, leafRegion, nodeById("L14")!)).toEqual([]); // throne
    expect(blightAddsFor(s, leafRegion, nodeById("L8")!)).toHaveLength(2);   // warden
    expect(blightAddsFor(s, leafRegion, nodeById("L11")!)).toHaveLength(2);  // landmark
  });

  it("contests the region's terrain from level 2", () => {
    expect(terrainContested(cleared({ blight: { leaf: 1 } }), leafRegion)).toBe(false);
    expect(terrainContested(cleared({ blight: { leaf: 2 } }), leafRegion)).toBe(true);
  });

  it("rises on Throne clears and caps at 3", () => {
    let s = cleared({ blight: { leaf: 0 } });
    for (let i = 0; i < 8; i++) s = applyClear(s, nodeById("L13")!, { won: [], missed: [], rolls: 1 });
    expect(blightLevel(s, leafRegion)).toBe(BLIGHT_MAX);
  });

  it("does not rise on ordinary clears — farming is never punished", () => {
    let s = cleared({ blight: { leaf: 1 } });
    const before = blightLevel(s, leafRegion);
    for (let i = 0; i < 5; i++) s = applyClear(s, nodeById("L8")!, { won: [], missed: [], rolls: 1 });
    expect(blightLevel(s, leafRegion)).toBe(before);
  });

  it("adds are never recruitable — only a Blight Node drops DUSK", () => {
    // Keeps one-card-one-node intact: a DUSK card seen as Blight filler is not
    // obtainable there, so it still has exactly one home.
    const s = cleared({ blight: { leaf: 2 } });
    const adds = blightAddsFor(s, leafRegion, nodeById("L8")!);
    for (const id of adds) expect(recruitablePool(nodeById("L8")!)).not.toContain(id);
  });
});

describe("story: where do I get this card", () => {
  it("points every placed card at a node that really lists it", () => {
    // The collection's whole promise is that "found at L7" is actionable. This
    // inverts the placement data, so a node move must never leave it stale.
    for (const id of PLACED_CARDS) {
      const src = sourcesOf(id);
      expect(src.length, `${id} is placed but has no source`).toBeGreaterThan(0);
      for (const s of src)
        expect([...s.node.roster, ...(s.node.overflow ?? [])]).toContain(id);
    }
  });

  it("lists a card's home node before any border that merely bleeds it", () => {
    // "Where do I farm this" is never the half-odds border node when a full-odds
    // home exists, so the home has to sort first.
    for (const id of PLACED_CARDS) {
      const src = sourcesOf(id);
      const firstOverflow = src.findIndex((s) => s.overflow);
      if (firstOverflow === -1) continue;
      expect(src.slice(firstOverflow).every((s) => s.overflow), id).toBe(true);
    }
  });

  it("counts cards, not placements — an overflow copy can't inflate the total", () => {
    expect(new Set(PLACED_CARDS).size).toBe(PLACED_CARDS.length);
    const overflowed = ALL_NODES.flatMap((n) => n.overflow ?? []);
    expect(overflowed.length).toBeGreaterThan(0); // guard: the check means nothing at zero
    for (const id of overflowed) expect(PLACED_CARDS.filter((x) => x === id)).toHaveLength(1);
  });

  it("offers no source until a node is actually reachable", () => {
    const fresh = newSave();
    // L8's Nightshade is real and placed, but deep in the region.
    expect(sourcesOf("leaf_nightshade").length).toBeGreaterThan(0);
    expect(bestSource(fresh, "leaf_nightshade")).toBeNull();
    // L1 is open from the start.
    expect(bestSource(fresh, "leaf_greegon")?.node.id).toBe("L1");
  });

  it("recommends the best odds when a card is reachable two ways", () => {
    // Misty's LEAF border node is half-odds; pity there still must not beat a
    // hypothetical better source. With only the border open, it is the answer.
    const s: StorySave = { ...newSave(), cleared: ["L1", "L2", "L9", "L10"] };
    expect(bestSource(s, "aqua_misty")?.node.id).toBe("L7");
    expect(bestSource(s, "aqua_misty")?.overflow).toBe(true);
  });

  it("says nothing rather than guessing for an unplaced card", () => {
    expect(sourcesOf("dusk_reaper")).toEqual([]);   // DUSK region isn't built yet
    expect(bestSource(newSave(), "dusk_reaper")).toBeNull();
  });
});

describe("story: PYRO", () => {
  const pyro = REGIONS.find((r) => r.id === "pyro")!;

  it("places every draftable PYRO card exactly once", () => {
    const placed = pyro.nodes.flatMap((n) => n.roster);
    expect(placed.filter((id, i) => placed.indexOf(id) !== i)).toEqual([]);
    expect([...placed].sort()).toEqual([...draftable("PYRO")].sort());
  });

  it("has one entry node, one required Throne, and nothing unreachable", () => {
    expect(pyro.nodes.filter((n) => n.requires.length === 0).map((n) => n.id)).toEqual(["P1"]);
    expect(pyro.nodes.filter((n) => n.kind === "throne" && n.required).map((n) => n.id)).toEqual(["P13"]);
    const seen = new Set<string>();
    for (let pass = 0; pass < pyro.nodes.length; pass++)
      for (const n of pyro.nodes)
        if (!seen.has(n.id) && n.requires.every((r) => seen.has(r))) seen.add(n.id);
    expect(pyro.nodes.filter((n) => !seen.has(n.id)).map((n) => n.id)).toEqual([]);
  });

  it("is sealed until the LEAF Throne falls", () => {
    // Every region's entry node has no prerequisites of its own, so without the
    // REGION gate P1 would read as open on turn one of the campaign.
    const fresh = newSave();
    expect(isRegionOpen(fresh, pyro)).toBe(false);
    expect(isOpen(fresh, nodeById("P1")!)).toBe(false);
    const after = { ...fresh, cleared: ["L14"] };
    expect(isRegionOpen(after, pyro)).toBe(true);
    expect(isOpen(after, nodeById("P1")!)).toBe(true);
  });

  it("raises the deck cap to the 4x4 format max on its Throne", () => {
    expect(deckCapFor(["L14"])).toBe(15);
    expect(deckCapFor(["L14", "P13"])).toBe(18);
    expect(deckCapFor(["L14", "P12"])).toBe(15); // the optional Throne unlocks nothing
  });

  it("keeps the escape hatch to AQUA early", () => {
    // The doc's reason for placing Sunfall Coast early: a player who finds PYRO
    // too punishing can sail out rather than be walled. Four nodes deep still
    // counts; twelve would not.
    const depth = (id: string, seen = new Set<string>()): number => {
      const n = nodeById(id)!;
      if (n.requires.length === 0) return 1;
      seen.add(id);
      return 1 + Math.min(...n.requires.map((r) => depth(r, seen)));
    };
    expect(depth("P2")).toBeLessThanOrEqual(4);
  });
});

describe("story: overflow points forward, not back", () => {
  it("never bleeds a card the starter deck already contains", () => {
    // Overflow is a taste of the NEXT element. Every LEAF card cheap enough to
    // qualify is already in the 12-card starter, so a LEAF overflow on PYRO's
    // northern border would hand the player something they own on day one.
    for (const n of ALL_NODES)
      for (const id of n.overflow ?? [])
        expect(STARTER, `${n.id} bleeds ${id}, which every player starts with`).not.toContain(id);
  });
});

describe("story: every region holds together", () => {
  // Generalised so a new region is covered the moment it lands, instead of
  // needing its own copy of these five checks.
  for (const r of REGIONS) {
    describe(r.id, () => {
      it("places every draftable card of its element exactly once", () => {
        const placed = r.nodes.flatMap((n) => n.roster);
        expect(placed.filter((id, i) => placed.indexOf(id) !== i)).toEqual([]);
        expect([...placed].sort()).toEqual([...draftable(r.element)].sort());
      });

      it("has one entry node, one required Throne, and nothing unreachable", () => {
        expect(r.nodes.filter((n) => n.requires.length === 0)).toHaveLength(1);
        expect(r.nodes.filter((n) => n.kind === "throne" && n.required)).toHaveLength(1);
        const seen = new Set<string>();
        for (let pass = 0; pass < r.nodes.length; pass++)
          for (const n of r.nodes)
            if (!seen.has(n.id) && n.requires.every((q) => seen.has(q))) seen.add(n.id);
        expect(r.nodes.filter((n) => !seen.has(n.id)).map((n) => n.id)).toEqual([]);
      });

      it("never gates a node on another region's node", () => {
        // Region gating is `region.requires`; a NODE reaching across regions
        // would make the map draw an edge to something that isn't on it.
        const mine = new Set(r.nodes.map((n) => n.id));
        for (const n of r.nodes)
          for (const q of n.requires) expect(mine.has(q), `${n.id} requires ${q}`).toBe(true);
      });

      it("declares the shape of its own art", () => {
        if (!r.art) return;
        expect(r.artRatio, `${r.id} has art but no ratio`).toBeGreaterThan(0.5);
        expect(r.artRatio).toBeLessThan(3);
      });

      it("keeps its nodes on the map and off each other", () => {
        for (const n of r.nodes) {
          expect(n.at.x, `${n.id}.x`).toBeGreaterThan(0);
          expect(n.at.x, `${n.id}.x`).toBeLessThan(100);
          expect(n.at.y, `${n.id}.y`).toBeGreaterThan(0);
          expect(n.at.y, `${n.id}.y`).toBeLessThan(100);
        }
        const at = r.nodes.map((n) => `${n.at.x},${n.at.y}`);
        expect(new Set(at).size).toBe(at.length);
      });
    });
  }

  it("gives both Act II regions the same entry gate and the same cap step", () => {
    // The doc's branch: PYRO or AQUA, player's choice, neither privileged.
    const pyro = REGIONS.find((x) => x.id === "pyro")!;
    const aqua = REGIONS.find((x) => x.id === "aqua")!;
    expect(pyro.requires).toEqual(aqua.requires);
    expect(deckCapFor(["L14", "P13"])).toBe(deckCapFor(["L14", "A13"]));
  });
});