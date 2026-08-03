// Story Mode campaign layer: node placement, progression gating, and the
// recruitment roll. The placement tests are the load-bearing ones — a card that
// is on no node is unobtainable, and a card on two nodes breaks the owned-card
// exclusion that makes repeat clears progressively targeted.

import { describe, expect, it } from "vitest";
import { CARDS, TOKENS, getDef } from "../../data/cards";
import { SPELLS } from "../../engine/spells";
import {
  ALL_NODES, BLIGHT_ADDS, BLIGHT_MAX, CAP_LADDER, OVERFLOW_RATE, REGIONS, STARTER_DECK,
  applyClear, baseRateFor, blightAddsFor, blightLevel, canBlight, deckCapFor, isOpen, isOverflow,
  DUPLICATE_CAP, EPIC_DUPLICATE_FROM_CAP, PLACED_CARDS, copyCapFor, STARTER_DECK as STARTER, bestSource, buildFormation,
  demandMet, gateCheck, isGate, regionOfNode, boardForNode, boardsLegalFor,
  formationSize, isRegionCleared, isRegionOpen,
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

  it("filler never makes a card unobtainable", () => {
    // The rule started as "adds are always tokens", which was really a proxy for
    // this: filler must never be the ONLY place a card appears, or it would be
    // permanently unrecruitable. Real cards as filler are fine and deliberate —
    // a gate's border patrol, a Throne's escorts — so long as each one is
    // farmable somewhere. Tokens satisfy it by being undeckable in the first
    // place.
    const bad = ALL_NODES.flatMap((n) =>
      n.adds
        .filter((id) => !tokenIds.has(id) && sourcesOf(id).length === 0)
        .map((id) => `${n.id}:${id}`),
    );
    expect(bad).toEqual([]);
  });

  it("gives every Throne an escort, so a boss is not alone on the board", () => {
    // A Throne's roster is one Mythic that can never duplicate, so without
    // escorts the fill had nothing to work with and a boss fight was two bodies.
    for (const n of ALL_NODES.filter((x) => x.kind === "throne"))
      expect(n.adds.length, `${n.id} has no escort`).toBeGreaterThanOrEqual(2);
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

  it("every ladder step names nodes that exist", () => {
    for (const step of CAP_LADDER) {
      if (!step.unlockedBy) continue;
      const ids = typeof step.unlockedBy === "string" ? [step.unlockedBy] : step.unlockedBy;
      for (const id of ids) expect(nodeById(id), id).toBeTruthy();
    }
  });

  it("makes Act IV wait for BOTH Green Thrones, not either", () => {
    // §2's revision: a player arriving on the 5x5 board with only LEAF plus one
    // other element cannot field a functional 22-card list, and the aura maths
    // gets ugly. The choice is route order, not content.
    expect(deckCapFor(["L14", "P13"])).toBe(18);
    expect(deckCapFor(["L14", "A13"])).toBe(18);
    expect(deckCapFor(["L14", "P13", "A13"])).toBe(22);
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
      .filter((n) => !isGate(n))          // a gate never pays recruits by design
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

  it("spares border gates — a checkpoint is not territory", () => {
    const s = { ...newSave(), cleared: ["L14"], blight: { leaf: 2 } };
    for (const g of ALL_NODES.filter(isGate))
      expect(blightAddsFor(s, regionOfNode(g.id)!, g), g.id).toEqual([]);
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
    // Derived from whichever elements have no region yet, so this stops being
    // true one region at a time instead of failing when that region lands.
    const built = new Set(REGIONS.map((r) => r.element));
    const orphan = CARDS.find((c) => !built.has(c.element));
    if (!orphan) return;                     // every element built — nothing to assert
    expect(sourcesOf(orphan.id), orphan.id).toEqual([]);
    expect(bestSource(newSave(), orphan.id)).toBeNull();
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

  it("is sealed until a border gate is crossed", () => {
    // Every region's entry node has no prerequisites of its own, so without the
    // REGION gate P1 would read as open on turn one of the campaign. Clearing
    // the LEAF Throne is no longer enough on its own — it only OPENS the gate.
    const fresh = newSave();
    expect(isRegionOpen(fresh, pyro)).toBe(false);
    expect(isOpen(fresh, nodeById("P1")!)).toBe(false);
    expect(isRegionOpen({ ...fresh, cleared: ["L14"] }, pyro)).toBe(false);
    const after = { ...fresh, cleared: ["L14", "GA"] };
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
        const own = r.nodes.filter((n) => !isGate(n)); // gates may wait on another region
        expect(own.filter((n) => n.requires.length === 0)).toHaveLength(1);
        expect(own.filter((n) => n.kind === "throne" && n.required)).toHaveLength(1);
        const seen = new Set<string>();
        for (let pass = 0; pass < own.length; pass++)
          for (const n of own)
            if (!seen.has(n.id) && n.requires.every((q) => seen.has(q))) seen.add(n.id);
        expect(own.filter((n) => !seen.has(n.id)).map((n) => n.id)).toEqual([]);
      });

      it("never gates an ordinary node on another region's node", () => {
        // A NODE reaching across regions would make the map draw an edge to
        // something that isn't on it. GATES are the deliberate exception — Gate E
        // waits on both Green Thrones, one of which is in PYRO — and the map's
        // edge derivation already drops any prerequisite it cannot find locally.
        const mine = new Set(r.nodes.map((n) => n.id));
        for (const n of r.nodes.filter((x) => !isGate(x)))
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

  it("gives both Act II regions two ways in and the same cap step", () => {
    // The doc's branch: PYRO or AQUA, player's choice, neither privileged. Each
    // is reachable from LEAF or from its sibling, so route order is free.
    const pyro = REGIONS.find((x) => x.id === "pyro")!;
    const aqua = REGIONS.find((x) => x.id === "aqua")!;
    expect(pyro.requires).toHaveLength(2);
    expect(aqua.requires).toHaveLength(2);
    expect(deckCapFor(["L14", "P13"])).toBe(deckCapFor(["L14", "A13"]));
    // Neither sibling's gate is reachable before LEAF is finished.
    expect(nodeById("GA")!.requires).toEqual(["L14"]);
    expect(nodeById("GB")!.requires).toEqual(["L14"]);
  });
});

describe("story: formations (10.7)", () => {
  const leafRegion = REGIONS.find((r) => r.id === "leaf")!;
  const count = (a: string[], id: string) => a.filter((x) => x === id).length;

  it("fills a 3-card roster up to the tier target", () => {
    // The whole point: a node's pool never changes, only how many bodies it
    // puts up, so a Skirmish still fields a board at every deck tier.
    const s = newSave();
    const f = buildFormation(s, leafRegion, nodeById("L1")!);
    expect(f.length).toBe(formationSize(12));
    expect(f.length).toBeGreaterThan(nodeById("L1")!.roster.length);
  });

  it("grows with the deck tier without changing what you can FARM", () => {
    // §6's promise is "you always know exactly what you're farming for", which is
    // about the recruitable roster — not the rank and file behind it. A bigger
    // target pulls in more of the region's Rares as non-recruitable filler, and
    // that must never move the recruit pool.
    const node = nodeById("L1")!;
    const early = buildFormation(newSave(), leafRegion, node);
    const late = buildFormation({ ...newSave(), cleared: ["L14", "P13"] }, leafRegion, node);
    expect(late.length).toBeGreaterThan(early.length);
    expect(recruitablePool(node)).toEqual(node.roster);
    for (const id of node.roster) {
      expect(early).toContain(id);
      expect(late).toContain(id);
    }
  });

  it("fields a whole deck, matched to the player's own card count", () => {
    for (const cleared of [[], ["L14"], ["L14", "P13", "A13"]]) {
      const save = { ...newSave(), cleared };
      const f = buildFormation(save, leafRegion, nodeById("L1")!);
      expect(f.length, `cap ${deckCapFor(cleared)}`).toBe(deckCapFor(cleared));
    }
  });

  it("fills that deck mostly with Rares", () => {
    const save = { ...newSave(), cleared: ["L14", "P13", "A13"] };
    for (const n of leafRegion.nodes) {
      const f = buildFormation(save, leafRegion, n);
      const rares = f.filter((id) => getDef(id).rarity === "rare").length;
      expect(rares / f.length, `${n.id} is only ${rares}/${f.length} Rare`).toBeGreaterThan(0.5);
    }
  });

  it("puts every unique card in before any duplicate", () => {
    // Four identical cards reads as a bug, not a boss.
    const f = buildFormation(newSave(), leafRegion, nodeById("L1")!);
    const uniques = nodeById("L1")!.roster;
    const firstDupeAt = f.findIndex((id, i) => f.indexOf(id) !== i);
    expect(f.slice(0, uniques.length).sort()).toEqual([...uniques].sort());
    expect(firstDupeAt).toBeGreaterThanOrEqual(uniques.length);
  });

  it("respects the per-rarity copy cap at every tier", () => {
    for (const cleared of [[], ["L14"], ["L14", "P13"]]) {
      const save = { ...newSave(), cleared };
      const cap = deckCapFor(cleared);
      for (const r of REGIONS)
        for (const n of r.nodes) {
          const f = buildFormation(save, r, n);
          for (const id of new Set(f))
            expect(count(f, id), `${n.id} fields ${count(f, id)}x ${id} at cap ${cap}`)
              .toBeLessThanOrEqual(copyCapFor(id, cap));
        }
    }
  });

  it("keeps Epics unique until the campaign has scaled", () => {
    // A second copy of an Epic is a second copy of a real Special every round.
    // Rares carry the early fill; Epics join once difficulty has somewhere to go.
    const epic = CARDS.find((c) => c.rarity === "epic")!.id;
    expect(copyCapFor(epic, 12)).toBe(1);
    expect(copyCapFor(epic, 15)).toBe(1);
    expect(copyCapFor(epic, EPIC_DUPLICATE_FROM_CAP)).toBe(DUPLICATE_CAP.epic);
    expect(copyCapFor(epic, 28)).toBe(DUPLICATE_CAP.epic);
    // Rares are never gated — they are what fills a board at Act I.
    const rare = CARDS.find((c) => c.rarity === "rare")!.id;
    expect(copyCapFor(rare, 12)).toBe(DUPLICATE_CAP.rare);
  });

  it("never doubles an Epic at Act I, even to hit the target", () => {
    const early = { ...newSave(), cleared: [] };
    for (const r of REGIONS)
      for (const n of r.nodes) {
        const f = buildFormation(early, r, n);
        for (const id of new Set(f))
          if (getDef(id).rarity === "epic")
            expect(count(f, id), `${n.id} doubled ${id} at Act I`).toBe(1);
      }
  });

  it("fills a Throne from its tokens rather than leaving the boss alone", () => {
    // A Throne's roster is one Mythic, which can never duplicate — so without
    // drawing the fill from `adds` too, a boss fight was two bodies.
    const s = { ...newSave(), cleared: ["L12"] };
    const throne = nodeById("L14")!;
    const f = buildFormation(s, REGIONS[0], throne);
    expect(f.length).toBeGreaterThan(throne.roster.length + throne.adds.length);
    expect(count(f, "leaf_oakgre")).toBe(1);   // the boss stays singular
  });

  it("never duplicates a boss", () => {
    for (const r of REGIONS)
      for (const n of r.nodes.filter((x) => x.kind === "throne")) {
        const f = buildFormation({ ...newSave(), cleared: ["L14", "P13"] }, r, n);
        for (const id of n.roster) expect(count(f, id), `${n.id}:${id}`).toBe(1);
      }
  });

  it("never drops a roster card to hit the target", () => {
    // A trimmed roster card would be unrecruitable that run.
    for (const r of REGIONS)
      for (const n of r.nodes) {
        const f = buildFormation(newSave(), r, n);
        for (const id of recruitablePool(n)) expect(f, `${n.id} dropped ${id}`).toContain(id);
      }
  });

  it("rolls ONCE per unique card however many copies are on the board", () => {
    // The load-bearing guardrail: duplicates are a difficulty knob, not a loot
    // knob. If they ever reached the roll, drop rates and pity would both lie.
    const s: StorySave = { ...newSave(), collection: [], deck: [] };
    const node = nodeById("L1")!;
    const f = buildFormation(s, leafRegion, node);
    expect(f.length).toBeGreaterThan(node.roster.length); // duplicates present
    const r = rollRecruits(s, node, 99, () => 0);         // every roll succeeds
    expect(r.won.sort()).toEqual([...node.roster].sort());
    expect(new Set(r.won).size).toBe(r.won.length);
  });
});

describe("story: border gates (7)", () => {
  const gates = ALL_NODES.filter(isGate);
  const full = (cleared: string[]): StorySave => ({ ...newSave(), cleared });

  it("exists on every border that needs one", () => {
    // Derived rather than listed: a hardcoded roll-call needed updating for every
    // region that landed, which made it a chore rather than a check. What
    // actually matters is that every region past LEAF is reachable and no gate
    // id collides.
    expect(gates.length).toBeGreaterThan(0);
    expect(new Set(gates.map((g) => g.id)).size).toBe(gates.length);
    for (const r of REGIONS) {
      if (r.id === "leaf") { expect(r.requires ?? []).toEqual([]); continue; }
      expect(r.requires?.length, `${r.id} has no way in`).toBeGreaterThan(0);
    }
    // Every gate lives on a map, and never on the map of a region it opens.
    for (const g of gates) {
      const home = regionOfNode(g.id)!;
      expect(home, `${g.id} is on no map`).toBeTruthy();
      expect(g.opens, `${g.id} opens its own region`).not.toContain(home.id);
    }
  });

  it("never places a card — a gate is a checkpoint, not a farm", () => {
    for (const g of gates) {
      expect(g.roster, `${g.id} has a recruitable roster`).toEqual([]);
      expect(g.adds.length, `${g.id} has no patrol`).toBeGreaterThan(0);
    }
  });

  it("patrols both sides of the border it sits on", () => {
    for (const g of gates) {
      const els = new Set(g.adds.map((id) => getDef(id).element));
      expect(els.size, `${g.id} patrol is single-element`).toBe(2);
      expect([...els], `${g.id}`).toContain(regionOfNode(g.id)!.element);
    }
  });

  it("opens regions that actually name it", () => {
    // `opens` is a list because one gate can open several — Gate E is the Gray
    // Continent ports, and GALE and BOLT both hang off it.
    for (const g of gates) {
      expect(g.opens?.length, `${g.id} opens nothing`).toBeGreaterThan(0);
      for (const id of g.opens!) {
        const target = REGIONS.find((r) => r.id === id)!;
        expect(target, `${g.id} opens unknown region ${id}`).toBeTruthy();
        expect(target.requires, `${id} does not accept ${g.id}`).toContain(g.id);
      }
    }
  });

  it("leaves no region unreachable", () => {
    // The mirror of the above: a region whose gates nobody opens is dead content.
    for (const r of REGIONS) {
      if (!r.requires?.length) continue;              // LEAF is open from the start
      for (const gid of r.requires)
        expect(nodeById(gid)?.opens, `${gid} does not claim to open ${r.id}`).toContain(r.id);
    }
  });

  it("accepts EITHER route into a region, not both", () => {
    // An AQUA-first player must be able to reach PYRO through Sunfall Harbor
    // without walking back to LEAF for Gate A.
    const pyro = REGIONS.find((r) => r.id === "pyro")!;
    expect(isRegionOpen(full(["GA"]), pyro)).toBe(true);
    expect(isRegionOpen(full(["GC2"]), pyro)).toBe(true);
    expect(isRegionOpen(full([]), pyro)).toBe(false);
  });

  it("refuses a deck that is not exactly at the cap", () => {
    const g = nodeById("GA")!;
    const short = { ...full(["L14"]), deck: STARTER.slice(0, 8) };
    expect(gateCheck(short, g).ok).toBe(false);
    expect(gateCheck(short, g).reasons.join(" ")).toMatch(/8\/15/);
  });

  it("refuses a full deck that ignores the composition demand", () => {
    const g = nodeById("GA")!;                    // wants 3 Ranged
    const melee = CARDS.filter((c) => c.attackType === "Melee").slice(0, 15).map((c) => c.id);
    const s = { ...full(["L14"]), deck: melee };
    expect(s.deck).toHaveLength(15);
    expect(gateCheck(s, g).ok).toBe(false);
    expect(gateCheck(s, g).reasons.join(" ")).toMatch(/Ranged/);
  });

  it("passes a deck that meets both halves", () => {
    const g = nodeById("GA")!;
    const ranged = CARDS.filter((c) => c.attackType === "Ranged").slice(0, 5).map((c) => c.id);
    const rest = CARDS.filter((c) => !ranged.includes(c.id)).slice(0, 10).map((c) => c.id);
    const s = { ...full(["L14"]), deck: [...ranged, ...rest] };
    expect(s.deck).toHaveLength(15);
    expect(gateCheck(s, g)).toEqual({ ok: true, reasons: [] });
  });

  it("demands nothing a player could not already field", () => {
    // §7's promise: recruitment is broad enough that the cards always exist, so
    // a gate only forces the player to SLOT them. If a demand outran what the
    // region before it can even drop, the campaign would dead-end.
    for (const g of gates) {
      const region = regionOfNode(g.id)!;
      const reachable = region.nodes.flatMap((n) => n.roster);
      expect(demandMet(reachable, g.demand!), `${g.id}: ${g.demand!.value}`)
        .toBeGreaterThanOrEqual(g.demand!.count);
    }
  });

  it("is never the thing that gates itself", () => {
    // A gate whose own prerequisites are unreachable would seal the campaign.
    for (const g of gates)
      for (const req of g.requires) expect(nodeById(req), `${g.id} requires ${req}`).toBeTruthy();
  });

  it("fills a formation from its patrol", () => {
    // Gates have no roster, so the duplicate fill has nothing to draw on unless
    // it falls back to the patrol.
    for (const g of gates) {
      const f = buildFormation(full(["L14"]), regionOfNode(g.id)!, g);
      expect(f.length, `${g.id} fielded ${f.length}`).toBeGreaterThanOrEqual(g.adds.length);
      for (const id of g.adds) expect(f).toContain(id);
    }
  });
});

describe("story: board size is welded to deck size", () => {
  it("gives every cap in the ladder exactly one legal board", () => {
    // The reason a region cannot run small nodes on 4x4 and big ones on 5x5:
    // the format ranges (4x4 = 12-20, 5x5 = 20-30) overlap at exactly 20 cards,
    // and no rung of the ladder lands there. Mixing boards inside an Act would
    // mean playing off-format in one direction or the other.
    for (const step of CAP_LADDER)
      expect(boardsLegalFor(step.cap), `cap ${step.cap}`).toHaveLength(1);
  });

  it("names 20 as the only deck size that could ever mix boards", () => {
    expect(boardsLegalFor(20).sort()).toEqual([4, 5]);
    expect(boardsLegalFor(19)).toEqual([4]);
    expect(boardsLegalFor(21)).toEqual([5]);
  });

  it("fights every node on a board its deck cap is legal for", () => {
    // The guard that matters now Act IV content exists: a node whose tier's deck
    // cannot legally field its board is caught here rather than in play. The cap
    // on entry is whatever clearing the region's gates ALSO required — GALE is
    // reached through Gate E, which itself needs both Green Thrones, so a player
    // standing in GALE is necessarily at cap 22 and legal on 5x5.
    for (const r of REGIONS) {
      const gates = r.requires ?? [];
      const onEntry = [...gates, ...gates.flatMap((g) => nodeById(g)?.requires ?? [])];
      const cap = deckCapFor(onEntry);
      for (const n of r.nodes) {
        const board = boardForNode(r, n);
        expect([4, 5], `${n.id} board ${board}`).toContain(board);
        expect(boardsLegalFor(cap),
          `${n.id} is fought on ${board} at cap ${cap}, where that board is illegal`)
          .toContain(board);
      }
    }
  });
});

describe("story: N-of-M gating", () => {
  it("opens the Shadow Border on ANY two Gray Thrones", () => {
    // §2 makes the Gray Continent order-free, so naming a specific third Throne
    // would quietly put an order back on a set that is supposed to have none.
    const gs = nodeById("GS")!;
    expect(gs.requiresCount).toBe(2);
    const base = ["L14", "GA", "GB", "P13", "A13", "GE"];
    for (const pair of [["G14", "B14"], ["G14", "R14"], ["B14", "R14"]])
      expect(isOpen({ ...newSave(), cleared: [...base, ...pair] }, gs), pair.join("+")).toBe(true);
    expect(isOpen({ ...newSave(), cleared: [...base, "G14"] }, gs), "one is not enough").toBe(false);
  });

  it("raises the cap to 28 on any two, and not on one", () => {
    const base = ["L14", "P13", "A13"];
    expect(deckCapFor([...base, "G14"])).toBe(22);
    expect(deckCapFor([...base, "G14", "B14"])).toBe(28);
    expect(deckCapFor([...base, "B14", "R14"])).toBe(28);
  });

  it("leaves DUSK unblightable — it is the source", () => {
    const dusk = REGIONS.find((r) => r.id === "dusk")!;
    expect(canBlight(dusk)).toBe(false);
    expect(dusk.blightAt, "DUSK should have no blight zone").toBeUndefined();
  });
});

describe("story: DAWN is sealed", () => {
  const dawn = REGIONS.find((r) => r.id === "dawn")!;

  it("neither bleeds Overflow nor receives it", () => {
    // §10.5: the Veil holds, in both directions. DAWN is the one region the
    // player reaches having seen none of its cards.
    for (const n of dawn.nodes) expect(n.overflow ?? [], `${n.id}`).toEqual([]);
    const bled = ALL_NODES.flatMap((n) => n.overflow ?? []);
    for (const id of bled) expect(getDef(id).element, id).not.toBe("DAWN");
  });

  it("cannot be Blighted — the shadow does not reach it", () => {
    expect(canBlight(dawn)).toBe(false);
    expect(dawn.blightAt).toBeUndefined();
  });

  it("seats all three of its Mythics, which no other region does", () => {
    const mythics = dawn.nodes.flatMap((n) => n.roster).filter((id) => getDef(id).rarity === "mythic");
    expect(mythics).toHaveLength(3);
    const thrones = dawn.nodes.filter((n) => n.kind === "throne");
    expect(thrones).toHaveLength(3);
    expect(thrones.filter((t) => t.required)).toHaveLength(1);
  });
});

describe("story: the campaign is complete", () => {
  it("names a real Field spell as every region's terrain", () => {
    // DAWN shipped as "Daybreak", which is not a spell in the game — its field
    // is Blazing Sun. A terrain that names nothing means the region's standing
    // rule (§4) does not exist.
    for (const r of REGIONS) {
      const field = SPELLS.find((sp) => sp.name === r.terrain);
      expect(field, `${r.id} terrain "${r.terrain}" is not a spell`).toBeTruthy();
      expect(field!.element, `${r.terrain} belongs to ${field!.element}`).toBe(r.element);
    }
  });

  it("has all eight elements", () => {
    expect(REGIONS).toHaveLength(8);
    expect(new Set(REGIONS.map((r) => r.element)).size).toBe(8);
  });

  it("places every draftable card in the game exactly once", () => {
    // The whole point of pillar 3, checked across the finished set rather than
    // one element at a time: nothing in the game is unobtainable.
    const placed = REGIONS.flatMap((r) => r.nodes.flatMap((n) => n.roster));
    expect(placed.filter((id, i) => placed.indexOf(id) !== i)).toEqual([]);
    expect([...placed].sort()).toEqual([...CARDS.map((c) => c.id)].sort());
  });

  it("can be walked from the starting deck to the last Throne", () => {
    // Clear everything reachable, over and over, until nothing new opens. If the
    // campaign has a dead end, the final Throne will not be in the set.
    let save: StorySave = newSave();
    for (let pass = 0; pass < ALL_NODES.length + 4; pass++) {
      const next = ALL_NODES.filter((n) => !save.cleared.includes(n.id) && isOpen(save, n));
      if (next.length === 0) break;
      save = { ...save, cleared: [...save.cleared, ...next.map((n) => n.id)] };
    }
    const unreached = ALL_NODES.filter((n) => !save.cleared.includes(n.id)).map((n) => n.id);
    expect(unreached, "unreachable nodes").toEqual([]);
    expect(deckCapFor(save.cleared)).toBe(28);
  });
});