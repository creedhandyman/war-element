// Story Mode campaign layer: node placement, progression gating, and the
// recruitment roll. The placement tests are the load-bearing ones — a card that
// is on no node is unobtainable, and a card on two nodes breaks the owned-card
// exclusion that makes repeat clears progressively targeted.

import { describe, expect, it } from "vitest";
import { CARDS, TOKENS, getDef } from "../../data/cards";
import { SPELLS, getSpell } from "../../engine/spells";
import {
  ALL_NODES, BLIGHT_ADDS, BLIGHT_MAX, CAP_LADDER, OVERFLOW_RATE, REGIONS, STARTER_DECK,
  applyClear, baseRateFor, blightAddsFor, blightLevel, canBlight, deckCapFor, isOpen, isOverflow,
  DUPLICATE_CAP, EPIC_DUPLICATE_FROM_CAP, PLACED_CARDS, copyCapFor, STARTER_DECK as STARTER, bestSource, buildFormation,
  demandMet, doublesEpics, gateCheck, isGate, regionOfNode, boardForNode, BIG_BATTLE_KINDS,
  capForNode, STANDARD_CAP, BIG_BOARD_CAP, preferredLoadout, type Loadout,
  formationSize, isRegionCleared, isRegionOpen,
  SQUAD_BASE, SQUAD_PER_THRONE, guaranteedDrops, isRegionConquered, squadCapFor, squadCapInRegion,
  isOpeningNode, autoSquad, newHero, canCraft, craftCard, craftCostOf, CRAFT_COST, spellsUnlockedIn, heroSpellShelf, heroBookFor, ESSENCE_PER_CLEAR, deckForRegion, rememberDeck, squadIsExplicit, squadIsOfferable, packSquad, packableFor, poolForRegion, loadStory, saveStory, fightCap, isFirstBattle,
  newSave, nodeById, recruitChance, recruitablePool, rollRecruits, sourcesOf,
  terrainContested, type StoryNode, type StorySave,
} from "../../data/story";

const leaf = REGIONS.find((r) => r.id === "leaf")!;
/** Real cards, by element. The squad pool reads each card's element, so a
 *  fabricated id has nowhere to belong and getDef throws on it. */
const ofElement = (el: string) => CARDS.filter((c) => c.element === el).map((c) => c.id);
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
    // §2's revision still holds, but the CAP no longer carries it: the ladder
    // tops out at 18 in Act II, so both routes leave you at the same size and
    // the requirement lives entirely in Gate E, which is where it reads better
    // anyway — "the border is shut until both Thrones fall" is a map fact, not
    // a deckbuilding one.
    expect(deckCapFor(["L14", "P13"])).toBe(18);
    expect(deckCapFor(["L14", "A13"])).toBe(18);
    expect(deckCapFor(["L14", "P13", "A13"])).toBe(22);
    expect(nodeById("GE")!.requires).toEqual(expect.arrayContaining(["P13", "A13"]));
  });

  it("the campaign starts at rags — one LEAF Epic and nothing else", () => {
    // Was twelve curated Rares handed over before the first fight. The deck is
    // now something you assemble by winning, starting from this one card.
    expect(STARTER_DECK).toEqual(["leaf_sakuroot"]);
    const sak = getDef("leaf_sakuroot");
    expect(sak.element).toBe("LEAF");
    expect(sak.rarity).toBe("epic");
    // It has to be able to hold a board alone, which means surviving: a Tank
    // with shields, not a glass cannon. This is the whole premise of the opener.
    expect(sak.cardClass).toBe("Tank");
    expect(sak.shields).toBeGreaterThan(0);
  });

  it("every node tells you where you are standing", () => {
    // Lore was on 57 of 108 nodes, so half the campaign was a place with no
    // sense of place. Now that all of them carry one, this is what stops the
    // next batch of nodes shipping bare.
    const bare = ALL_NODES.filter((n) => !n.lore?.trim()).map((n) => n.id);
    expect(bare, `${bare.length} node(s) have no lore`).toEqual([]);
  });

  it("lore stays lore — it never leaks the tactical read that belongs to `note`", () => {
    // The two fields have different jobs: `note` tells you what to expect from
    // the fight, `lore` tells you where you are standing. Game vocabulary in a
    // lore line means the split has started to collapse.
    // Only vocabulary that is unambiguously the GAME's. Ordinary English words
    // that double as game terms are excluded on purpose: an early draft banned
    // "turn" and flagged L7's "where the leaves turn fire-coloured", which is
    // exactly the kind of false positive that gets a guard deleted.
    const banned = /\b(deck|squad|rarity|cooldown|REGEN|DMG|\bSP\b|Mythic|Legendary|hit points)\b/;
    const leaks = ALL_NODES
      .filter((n) => n.lore && banned.test(n.lore))
      .map((n) => `${n.id}: ${n.lore!.match(banned)![0]}`);
    expect(leaks).toEqual([]);
  });

  it("every region has an opening battle, and it is that region's first node", () => {
    for (const r of REGIONS) {
      const node = nodeById(r.opening.node);
      expect(node, `${r.id} opening points at nothing`).toBeDefined();
      expect(regionOfNode(r.opening.node)!.id).toBe(r.id);
      expect(node!.requires, `${r.id}'s opener is not reachable first`).toEqual([]);
      // The reward has to be a real Epic of that region, or "one Epic per
      // region" quietly becomes "whatever id was typed here".
      const epic = getDef(r.opening.epic);
      expect(epic.element, `${r.id} opening Epic is the wrong element`).toBe(r.element);
      expect(epic.rarity, `${r.id} opening Epic is not an Epic`).toBe("epic");
    }
  });

  it("the opener fields one more than the player brings, cheapest first", () => {
    // Measured: a lone Sakuroot against all three of Spring Village's cards was
    // 57% across 34.6 rounds with 26 of 60 timing out, because the third is
    // Greegon — the REGEN tank the node's note says you cannot out-race. Two of
    // the cheapest is 100% across 13.5 rounds: unloseable, but you play it.
    const leaf = REGIONS.find((r) => r.id === "leaf")!;
    const l1 = nodeById("L1")!;
    expect(buildFormation(newSave(), leaf, l1)).toEqual(["leaf_nettle", "leaf_weeds"]);
    expect(l1.roster).toHaveLength(3); // Greegon is on the roster, just not fielded
    // And it stays small however far the ladder has climbed — coming back later
    // with the same one card must not turn the tutorial into a 28-card fight.
    const late = { ...newSave(), cleared: ["L14", "P13", "A13", "G14", "B14"] };
    expect(buildFormation(late, leaf, l1)).toHaveLength(2);
    // The node after it is an ordinary fight again.
    expect(buildFormation(newSave(), leaf, nodeById("L2")!).length).toBe(12);
  });

  it("...but an opener reached with a real squad is a real fight, not a walkover", () => {
    // The other half of "match the player". Arriving in PYRO having packed 14,
    // its opener must not still put up three cards. Fielding exactly the roster
    // was the first version of this rule and it made every region past LEAF
    // open with a free win.
    const pyro = REGIONS.find((r) => r.id === "pyro")!;
    const p1 = nodeById(pyro.opening.node)!;
    const leafAll = ofElement("LEAF");
    const packed = packSquad(
      { ...newSave(), cleared: ["L14"], collection: leafAll },
      pyro,
      leafAll.slice(0, 14),
    );
    expect(buildFormation(packed, pyro, p1)).toHaveLength(15); // squad + 1
    // And a player who really is in rags still gets the small fight.
    // Rags: one LEAF card, no PYRO cards. Auto-pack can only carry that one, so
    // the opener meets it one-for-one plus the +1.
    const rags = { ...newSave(), cleared: ["L14"], collection: ["leaf_sakuroot"] };
    expect(poolForRegion(rags, pyro)).toEqual(["leaf_sakuroot"]);
    expect(buildFormation(rags, pyro, p1)).toHaveLength(2);
  });

  it("winning an opener hands over its roster and Epic, no roll", () => {
    for (const r of REGIONS) {
      const node = nodeById(r.opening.node)!;
      const got = guaranteedDrops(r, node);
      for (const id of node.roster) expect(got, `${r.id} withheld ${id}`).toContain(id);
      expect(got, `${r.id} withheld its Epic`).toContain(r.opening.epic);
      expect(new Set(got).size, `${r.id} duplicates a drop`).toBe(got.length);
    }
    // Nowhere else grants anything for free.
    const leaf = REGIONS.find((r) => r.id === "leaf")!;
    expect(guaranteedDrops(leaf, nodeById("L2")!)).toEqual([]);
    expect(guaranteedDrops(leaf, nodeById("L14")!)).toEqual([]);
  });

  it("clearing the opener actually banks the roster and the Epic", () => {
    // The end-to-end shape of "rags to riches": start owning one card, win L1,
    // come out owning four. Goes through the real roll + apply path, so a
    // guarantee that never reaches the save would fail here.
    const l1 = nodeById("L1")!;
    const start = newSave();
    expect(start.collection).toEqual(["leaf_sakuroot"]);
    // rand() = 0.99 would miss every ordinary roll; the opener must not care.
    const after = applyClear(start, l1, rollRecruits(start, l1, 1, () => 0.99));
    for (const id of l1.roster) expect(after.collection, `L1 withheld ${id}`).toContain(id);
    expect(after.collection).toHaveLength(4); // Sakuroot + the three Rares
    expect(after.cleared).toContain("L1");
  });

  it("a PYRO opener hands over its Epic, which is not on that node's roster", () => {
    // The Epic lives deeper in the region, so it can never come from the
    // recruitable pool — this is the case the empty-pool early return used to eat.
    const pyro = REGIONS.find((r) => r.id === "pyro")!;
    const p1 = nodeById(pyro.opening.node)!;
    const save: StorySave = { ...newSave(), collection: [...p1.roster] }; // Rares already owned
    const got = rollRecruits(save, p1, 1, () => 0.99);
    expect(got.won).toEqual([pyro.opening.epic]);
  });

  it("crafting spends the right essence and hands over the card", () => {
    const save: StorySave = {
      ...newSave(), collection: ["leaf_sakuroot"],
      hero: { ...newHero(), essence: { LEAF: 20 } },
    };
    const target = "leaf_oak"; // a LEAF rare
    expect(canCraft(save, target).ok).toBe(true);
    const after = craftCard(save, target);
    expect(after.collection).toContain(target);
    expect(after.hero!.essence.LEAF).toBe(20 - craftCostOf(target));
  });

  it("...and refuses what you cannot afford, already own, or is not a card", () => {
    const poor: StorySave = {
      ...newSave(), collection: ["leaf_sakuroot"], hero: { ...newHero(), essence: { LEAF: 1 } },
    };
    expect(canCraft(poor, "leaf_oak").ok).toBe(false);
    expect(craftCard(poor, "leaf_oak")).toBe(poor);            // untouched, not negative
    expect(canCraft(poor, "leaf_sakuroot").ok).toBe(false);    // already owned
    expect(canCraft(poor, "not_a_card").ok).toBe(false);
    expect(poor.hero!.essence.LEAF).toBe(1);
  });

  it("...and essence buys a targeted card, never a collection", () => {
    // The ratio IS the design: one full region walk must not be a shortcut past
    // the recruitment game. A complete clear banks ~29-38 essence and every
    // element has 39 cards, so a walk buys a handful, not a set.
    const leaf = REGIONS.find((r) => r.id === "leaf")!;
    const fullWalk = leaf.nodes.reduce((n, node) => n + (ESSENCE_PER_CLEAR[node.kind] ?? 1), 0);
    const leafCards = CARDS.filter((c) => c.element === "LEAF").length;
    const cheapest = CRAFT_COST.rare;
    expect(Math.floor(fullWalk / cheapest), "a single walk buys too much of the set")
      .toBeLessThan(leafCards / 3);
    expect(CRAFT_COST.mythic).toBeGreaterThan(CRAFT_COST.legendary);
    expect(CRAFT_COST.legendary).toBeGreaterThan(CRAFT_COST.epic);
    expect(CRAFT_COST.epic).toBeGreaterThan(CRAFT_COST.rare);
  });

  it("a new campaign has a hero, and the hero starts with nothing", () => {
    const h = newSave().hero!;
    expect(h).toBeDefined();
    expect(h.affinity).toBe(REGIONS[0].element); // wherever the campaign opens
    expect(h.spells).toEqual([]);
    expect(h.essence).toEqual({});
  });

  it("spells unlock by walking the region that owns them", () => {
    // 80 spells, ten per element, one per cost rung 1-10 — so depth in a region
    // maps straight onto how expensive a spell of theirs answers to you.
    const leaf = REGIONS.find((r) => r.id === "leaf")!;
    expect(spellsUnlockedIn(newSave(), leaf)).toEqual([]); // nothing cleared
    const three = { ...newSave(), cleared: leaf.nodes.slice(0, 3).map((n) => n.id) };
    const got = spellsUnlockedIn(three, leaf);
    expect(got.length).toBe(3);
    for (const id of got) {
      expect(getSpell(id).element).toBe("LEAF");
      expect(getSpell(id).cost).toBeLessThanOrEqual(3);
    }
    // Ten nodes is the whole element's book, and every region has more than ten.
    const ten = { ...newSave(), cleared: leaf.nodes.slice(0, 10).map((n) => n.id) };
    expect(spellsUnlockedIn(ten, leaf)).toHaveLength(10);
    for (const r of REGIONS) expect(r.nodes.length, `${r.id} is too small`).toBeGreaterThanOrEqual(10);
  });

  it("...and only that region's element, however deep you go", () => {
    const leaf = REGIONS.find((r) => r.id === "leaf")!;
    const pyro = REGIONS.find((r) => r.id === "pyro")!;
    const deep = { ...newSave(), cleared: leaf.nodes.map((n) => n.id) };
    expect(spellsUnlockedIn(deep, pyro)).toEqual([]); // never set foot in PYRO
    expect(heroSpellShelf(deep).every((id) => getSpell(id).element === "LEAF")).toBe(true);
  });

  it("the book taken into a fight is trimmed to the board's cap, never refused", () => {
    // A hero holding thirty spells and a five-slot book walks in with five.
    const leaf = REGIONS.find((r) => r.id === "leaf")!;
    const deep = { ...newSave(), cleared: leaf.nodes.map((n) => n.id) };
    expect(heroSpellShelf(deep).length).toBeGreaterThan(5);
    expect(heroBookFor(deep, 4)).toHaveLength(5);
    expect(heroBookFor(deep, 5)).toHaveLength(8);
    // Every id handed to the engine is a real spell.
    for (const id of heroBookFor(deep, 5)) expect(() => getSpell(id)).not.toThrow();
  });

  it("...and a hand-picked book wins over the shelf, but cannot invent spells", () => {
    const leaf = REGIONS.find((r) => r.id === "leaf")!;
    const shelf = heroSpellShelf({ ...newSave(), cleared: leaf.nodes.map((n) => n.id) });
    const save: StorySave = {
      ...newSave(), cleared: leaf.nodes.map((n) => n.id),
      hero: { ...newHero(), spells: [shelf[0], shelf[1], "not_a_spell", "pyro_something"] },
    };
    expect(heroBookFor(save, 4)).toEqual([shelf[0], shelf[1]]); // unearned ids dropped
  });

  it("clearing a node pays essence in that region's element", () => {
    // The map has been promising this since before it existed — the
    // exhausted-node copy in StoryMap says a clear "still pays Gold and essence".
    const l1 = nodeById("L1")!;
    const start = newSave();
    expect(start.hero!.essence.LEAF ?? 0).toBe(0);
    const after = applyClear(start, l1, rollRecruits(start, l1, 1, () => 0.99));
    expect(after.hero!.essence.LEAF).toBe(ESSENCE_PER_CLEAR[l1.kind]);
    // A Throne is worth more than a skirmish.
    expect(ESSENCE_PER_CLEAR.throne).toBeGreaterThan(ESSENCE_PER_CLEAR.skirmish);
  });

  it("...and a hero survives a round-trip through storage", () => {
    const save: StorySave = {
      ...newSave(),
      hero: { name: "Bernard", affinity: "LEAF", spells: ["leaf_1"], essence: { LEAF: 7 } },
    };
    const store = new Map<string, string>();
    const g = globalThis as { localStorage?: unknown };
    const prior = g.localStorage;
    g.localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    };
    try {
      saveStory(save);
      const back = loadStory();
      expect(back.hero!.name).toBe("Bernard");
      expect(back.hero!.essence.LEAF).toBe(7);
      // A save written before heroes existed still gets one.
      store.set("we_story_v1", JSON.stringify({ cleared: [], collection: ["leaf_oak"], pity: {}, deck: [], blight: {} }));
      expect(loadStory().hero, "a pre-hero save was left without a player").toBeDefined();
      // A poisoned wallet cannot survive the load.
      store.set("we_story_v1", JSON.stringify({
        cleared: [], collection: ["leaf_oak"], pity: {}, deck: [], blight: {},
        hero: { name: "", affinity: 3, spells: [1, "leaf_1"], essence: { LEAF: "lots", PYRO: -5 } },
      }));
      const fixed = loadStory().hero!;
      expect(fixed.name).toBe(newHero().name);      // blank name replaced
      expect(fixed.spells).toEqual(["leaf_1"]);     // non-strings dropped
      expect(fixed.essence).toEqual({});            // NaN and negatives dropped
    } finally { g.localStorage = prior; }
  });

  it("never blocks a fight — an unpacked region auto-packs instead", () => {
    // The worst thing the campaign did: standing in LEAF holding eighteen LEAF
    // cards, it stopped and demanded you choose twelve FOREIGN ones before you
    // could play, and it did that the first time you entered every region.
    const pyro = REGIONS.find((r) => r.id === "pyro")!;
    const leafAll = ofElement("LEAF");
    const save: StorySave = { ...newSave(), cleared: ["L14"], collection: leafAll };
    expect(save.squads?.pyro).toBeUndefined();       // nothing chosen
    expect(squadIsExplicit(save, pyro)).toBe(false);
    // ...and yet there is a full squad to field, without touching a picker.
    const pool = poolForRegion(save, pyro);
    expect(pool.length).toBe(squadCapInRegion(save.cleared, pyro));
    expect(pool).toEqual(autoSquad(save, pyro));
  });

  it("...auto-pack takes the strongest foreign cards, and is stable", () => {
    const pyro = REGIONS.find((r) => r.id === "pyro")!;
    const leafAll = ofElement("LEAF");
    const save: StorySave = { ...newSave(), cleared: ["L14"], collection: leafAll };
    const a = autoSquad(save, pyro);
    expect(a).toEqual(autoSquad(save, pyro)); // deterministic, not a shuffle
    const costs = a.map((id) => getDef(id).cost);
    expect(costs).toEqual([...costs].sort((x, y) => y - x)); // strongest first
    expect(Math.min(...costs)).toBeGreaterThanOrEqual(
      Math.max(...packableFor(save, pyro).filter((id) => !a.includes(id)).map((id) => getDef(id).cost)),
    );
  });

  it("...and an explicit squad always beats the automatic one", () => {
    const pyro = REGIONS.find((r) => r.id === "pyro")!;
    const leafAll = ofElement("LEAF");
    const base: StorySave = { ...newSave(), cleared: ["L14"], collection: leafAll };
    const mine = leafAll.slice(-3); // deliberately NOT the auto pick
    const packed = packSquad(base, pyro, mine);
    expect(squadIsExplicit(packed, pyro)).toBe(true);
    expect(poolForRegion(packed, pyro).sort()).toEqual([...mine].sort());
  });

  it("a region remembers the team you last fought there with", () => {
    // `deck` alone is one global team, so LEAF -> PYRO -> LEAF handed back the
    // PYRO team and the LEAF one had to be rebuilt from memory every time.
    const leaf = REGIONS.find((r) => r.id === "leaf")!;
    const pyro = REGIONS.find((r) => r.id === "pyro")!;
    const all = [...ofElement("LEAF"), ...ofElement("PYRO")];
    let save: StorySave = { ...newSave(), cleared: ["L14"], collection: all };
    const leafTeam = ofElement("LEAF").slice(0, 6);
    const pyroTeam = ofElement("PYRO").slice(0, 6);
    save = rememberDeck(save, leaf, leafTeam);
    save = rememberDeck(save, pyro, pyroTeam);
    expect(deckForRegion(save, leaf)).toEqual(leafTeam);
    expect(deckForRegion(save, pyro).length).toBeGreaterThan(0);
    // A remembered team is filtered to what is actually fieldable there.
    for (const id of deckForRegion(save, pyro))
      expect(poolForRegion(save, pyro)).toContain(id);
  });

  it("...and a remembered team survives a round-trip through storage", () => {
    const leaf = REGIONS.find((r) => r.id === "leaf")!;
    const team = ["leaf_oak", "leaf_python", "leaf_birch"];
    const save = rememberDeck(
      { ...newSave(), cleared: ["L14"], collection: [...team, "leaf_nettle"] }, leaf, team,
    );
    const store = new Map<string, string>();
    const g = globalThis as { localStorage?: unknown };
    const prior = g.localStorage;
    g.localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    };
    try {
      saveStory(save);
      expect(deckForRegion(loadStory(), leaf)).toEqual(team);
    } finally { g.localStorage = prior; }
  });

  it("the region's own element always fights for you, packed or not", () => {
    // You are in their homeland. Every card of theirs you have unlocked answers
    // the call, so the squad is only ever a question about what you bring from
    // ELSEWHERE — and the picker only offers those.
    const pyro = REGIONS.find((r) => r.id === "pyro")!;
    const pyroOwned = ofElement("PYRO").slice(0, 9);
    const leafOwned = ofElement("LEAF").slice(0, 20);
    const save: StorySave = { ...newSave(), cleared: ["L14"], collection: [...pyroOwned, ...leafOwned] };
    // Nothing packed, yet every PYRO card is already available here — and the
    // picker only ever offers the FOREIGN ones, because locals never need
    // carrying.
    for (const id of pyroOwned) expect(poolForRegion(save, pyro)).toContain(id);
    expect(packableFor(save, pyro).sort()).toEqual([...leafOwned].sort());
    // Packing adds the foreign cards on top rather than replacing the locals.
    const packed = packSquad(save, pyro, leafOwned.slice(0, 5));
    expect(poolForRegion(packed, pyro)).toHaveLength(pyroOwned.length + 5);
  });

  it("...and you are only asked to pack once per region, ever", () => {
    // The picker used to reopen on every return, because one travelling squad
    // meant arriving anywhere else overwrote it. Squads are per region now.
    const pyro = REGIONS.find((r) => r.id === "pyro")!;
    const aqua = REGIONS.find((r) => r.id === "aqua")!;
    const leafAll = ofElement("LEAF");
    let save: StorySave = { ...newSave(), cleared: ["L14"], collection: leafAll };
    expect(squadIsOfferable(save, pyro)).toBe(true);
    save = packSquad(save, pyro, leafAll.slice(0, 14));
    save = packSquad(save, aqua, leafAll.slice(4, 18)); // a trip somewhere else
    // Coming back to PYRO finds it exactly as it was left.
    expect(squadIsExplicit(save, pyro)).toBe(true);
    expect(save.squads!.pyro).toEqual(leafAll.slice(0, 14));
    expect(save.squads!.aqua).toEqual(leafAll.slice(4, 18));
  });

  it("...and an empty squad still counts as answered", () => {
    // Deliberately crossing with nothing but the locals must not re-open the
    // picker every time you step back in.
    const pyro = REGIONS.find((r) => r.id === "pyro")!;
    const save = packSquad(
      { ...newSave(), cleared: ["L14"], collection: ofElement("LEAF") }, pyro, [],
    );
    expect(save.squads!.pyro).toEqual([]);
    expect(squadIsExplicit(save, pyro)).toBe(true);
  });

  it("the free opening placement is the campaign's first fight and nothing else", () => {
    // A head start for one Sakuroot against three. Everywhere else it is an
    // unearned edge on top of a deck the player built.
    const leaf = REGIONS.find((r) => r.id === "leaf")!;
    expect(isFirstBattle(leaf, nodeById("L1")!)).toBe(true);
    expect(isFirstBattle(leaf, nodeById("L2")!)).toBe(false);
    expect(isFirstBattle(leaf, nodeById("L14")!)).toBe(false);
    // Every OTHER region's opener is reached with a full squad — no head start.
    for (const r of REGIONS.filter((x) => x.id !== "leaf"))
      expect(isFirstBattle(r, nodeById(r.opening.node)!), `${r.id} opener`).toBe(false);
    // Exactly one node in the whole campaign qualifies.
    const firsts = REGIONS.flatMap((r) => r.nodes.filter((n) => isFirstBattle(r, n)).map((n) => n.id));
    expect(firsts).toEqual(["L1"]);
  });

  it("the squad is a commitment — away, you may only field what you packed", () => {
    // Capping the SIZE alone would let a player re-pick from the whole
    // collection at every node, which makes "choose twelve and live with it"
    // mean nothing. The pool itself has to narrow.
    const pyro = REGIONS.find((r) => r.id === "pyro")!;
    const leafAll = ofElement("LEAF");
    const save: StorySave = { ...newSave(), cleared: ["L14"], collection: leafAll };
    expect(squadIsOfferable(save, pyro)).toBe(true);
    // Unpacked, the pool is whatever auto-pack chose — never empty, never more
    // than the limit.
    expect(poolForRegion(save, pyro)).toHaveLength(squadCapInRegion(save.cleared, pyro)!);
    const packed = packSquad(save, pyro, leafAll.slice(0, 20));
    expect(packed.squads!.pyro).toHaveLength(14); // clamped to the limit
    expect(poolForRegion(packed, pyro)).toEqual(packed.squads!.pyro);
    expect(squadIsExplicit(packed, pyro)).toBe(true);
  });

  it("...a squad packed for one region does not travel to another", () => {
    const pyro = REGIONS.find((r) => r.id === "pyro")!;
    const aqua = REGIONS.find((r) => r.id === "aqua")!;
    const leafAll = ofElement("LEAF");
    const chosen = leafAll.slice(-14); // deliberately not what auto-pack would take
    const save = packSquad({ ...newSave(), cleared: ["L14"], collection: leafAll }, pyro, chosen);
    expect(poolForRegion(save, pyro).sort()).toEqual([...chosen].sort());
    // AQUA gets its own auto-pack, NOT the team chosen for PYRO.
    expect(poolForRegion(save, aqua).sort()).not.toEqual([...chosen].sort());
    expect(poolForRegion(save, aqua)).toEqual(autoSquad(save, aqua));
    expect(squadIsOfferable(save, aqua)).toBe(true);
    // ...and PYRO's squad is still remembered, untouched by the trip to AQUA.
    expect(save.squads!.pyro).toHaveLength(14);
  });

  it("...but home is the whole collection, and packing there is a no-op", () => {
    const leaf = REGIONS.find((r) => r.id === "leaf")!;
    const all = [...ofElement("LEAF"), ...ofElement("PYRO")];
    const save: StorySave = { ...newSave(), cleared: ["L14"], collection: all }; // LEAF conquered
    expect(squadIsOfferable(save, leaf)).toBe(false);
    expect(poolForRegion(save, leaf)).toHaveLength(all.length);
    expect(packSquad(save, leaf, all.slice(0, 5)).squads).toBeUndefined();
  });

  it("...and it never asks you to pack when you own no more than you can carry", () => {
    // The campaign's FIRST fight: LEAF is unconquered and the collection is one
    // card. Demanding a squad there would be a question with one answer.
    const leaf = REGIONS.find((r) => r.id === "leaf")!;
    const start = newSave();
    expect(squadIsOfferable(start, leaf)).toBe(false);
    expect(poolForRegion(start, leaf)).toEqual(["leaf_sakuroot"]);
  });

  it("...and never lets an unowned card into a packed squad", () => {
    const pyro = REGIONS.find((r) => r.id === "pyro")!;
    const save: StorySave = { ...newSave(), cleared: ["L14"], collection: ["leaf_oak", "leaf_python", "leaf_birch"] };
    const packed = packSquad(save, pyro, ["leaf_oak", "ghost", "leaf_python", "leaf_oak"]);
    expect(packed.squads!.pyro).toEqual(["leaf_oak", "leaf_python"]); // de-duped, unowned dropped
  });

  it("...and a packed squad survives a round-trip through storage", () => {
    // Caught in the live app, not by the unit tests above: packSquad wrote the
    // squad and loadStory never read it back, so reloading the map asked the
    // player to pack again every single time. Every field of StorySave is
    // reconstructed by hand on load, so a new one is invisible until listed.
    const pyro = REGIONS.find((r) => r.id === "pyro")!;
    const coll = ["leaf_oak", "leaf_python", "leaf_birch"];
    const packed = packSquad(
      { ...newSave(), cleared: ["L14"], collection: coll },
      pyro,
      ["leaf_oak", "leaf_python"],
    );
    const store = new Map<string, string>();
    const g = globalThis as { localStorage?: unknown };
    const prior = g.localStorage;
    g.localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    };
    try {
      saveStory(packed);
      const back = loadStory();
      expect(back.squads).toBeDefined();
      expect(back.squads!.pyro).toEqual(["leaf_oak", "leaf_python"]);
      expect(squadIsExplicit(back, pyro)).toBe(true);
    } finally {
      g.localStorage = prior;
    }
  });

  it("the fight is sized by the ladder, not by how thin the player travels", () => {
    // An earlier version clamped every fight to the player's pool, which meant
    // an early node fielded four cards because the player owned four — the whole
    // difficulty curve rewritten by a squad rule. The ladder decides the fight;
    // the pool only ever constrains a GATE, so borders stay passable.
    const leaf = REGIONS.find((r) => r.id === "leaf")!;
    const pyro = REGIONS.find((r) => r.id === "pyro")!;
    const cleared = ["L14"];
    expect(deckCapFor(cleared)).toBe(15);
    expect(capForNode(cleared, pyro, nodeById("P2")!)).toBe(15);
    expect(capForNode(cleared, leaf, nodeById("L2")!)).toBe(15);
    const thin = { ...newSave(), cleared, collection: ["leaf_sakuroot"] };
    expect(buildFormation(thin, pyro, nodeById("P2")!)).toHaveLength(15);
  });

  it("a gate can never demand a fuller deck than the player can field", () => {
    // A gate wants a FULL deck. If it asked for the ladder's number while the
    // player could only field fewer, that border would be shut forever — so
    // gateCheck reads fightCap, which is bounded by the pool.
    for (const r of REGIONS)
      for (const g of r.nodes.filter(isGate))
        for (const cleared of [[], ["L14"], ["L14", "P13"], ["L14", "P13", "A13"]]) {
          const save = { ...newSave(), cleared, collection: ofElement(r.element) };
          const pool = poolForRegion(save, r).length;
          const cap = fightCap(save, r, g);
          expect(cap, `${g.id} demands ${cap} from a pool of ${pool}`).toBeLessThanOrEqual(pool);
        }
  });

  it("the squad starts at 12, widens per conquered region, and lifts at DUSK", () => {
    expect(squadCapFor([])).toBe(SQUAD_BASE);
    expect(squadCapFor(["L14"])).toBe(SQUAD_BASE + SQUAD_PER_THRONE);
    expect(squadCapFor(["L14", "P13"])).toBe(SQUAD_BASE + 2 * SQUAD_PER_THRONE);
    // Optional Thrones are not conquests — L13 unlocks nothing.
    expect(squadCapFor(["L13"])).toBe(SQUAD_BASE);
    // DUSK's Throne is the answer to "when do I get my collection back".
    expect(squadCapFor(["L14", "P13", "A13", "D13"])).toBeNull();
  });

  it("a conquered region is home — no squad limit there, limit still applies away", () => {
    const leaf = REGIONS.find((r) => r.id === "leaf")!;
    const pyro = REGIONS.find((r) => r.id === "pyro")!;
    // Nothing taken yet: both are away, both capped.
    expect(squadCapInRegion([], leaf)).toBe(SQUAD_BASE);
    expect(squadCapInRegion([], pyro)).toBe(SQUAD_BASE);
    // Take LEAF: it becomes home (full collection), PYRO is still a trip.
    expect(squadCapInRegion(["L14"], leaf)).toBeNull();
    expect(squadCapInRegion(["L14"], pyro)).toBe(SQUAD_BASE + SQUAD_PER_THRONE);
    expect(isRegionConquered(["L14"], leaf)).toBe(true);
    expect(isRegionConquered(["L14"], pyro)).toBe(false);
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
    // L2, not L1: the region OPENER fields exactly its roster by design now,
    // so the generic fill rule has to be read off an ordinary skirmish.
    const f = buildFormation(s, leafRegion, nodeById("L2")!);
    expect(f.length).toBe(formationSize(12));
    expect(f.length).toBeGreaterThan(nodeById("L2")!.roster.length);
  });

  it("grows with the deck tier without changing what you can FARM", () => {
    // §6's promise is "you always know exactly what you're farming for", which is
    // about the recruitable roster — not the rank and file behind it. A bigger
    // target pulls in more of the region's Rares as non-recruitable filler, and
    // that must never move the recruit pool.
    const node = nodeById("L2")!; // an ordinary skirmish — L1 is the fixed-size opener
    const early = buildFormation(newSave(), leafRegion, node);
    const late = buildFormation({ ...newSave(), cleared: ["L14", "P13"] }, leafRegion, node);
    expect(late.length).toBeGreaterThan(early.length);
    expect(recruitablePool(node)).toEqual(node.roster);
    for (const id of node.roster) {
      expect(early).toContain(id);
      expect(late).toContain(id);
    }
  });

  it("fields a whole deck, matched to what the PLAYER may bring to that node", () => {
    // Both sides read `capForNode`, so a set piece is a bigger fight on both
    // sides of the board rather than a bigger enemy across from the same deck.
    const skirmish = nodeById("L2")!;   // 4x4, clamped to 18 (L1 is the opener)
    const throne = nodeById("L14")!;    // 5x5, opens to 28
    for (const cleared of [[], ["L14"], ["L14", "P13", "A13"], ["L14", "P13", "A13", "G14", "B14"]]) {
      const save = { ...newSave(), cleared };
      for (const n of [skirmish, throne]) {
        const want = capForNode(cleared, leafRegion, n);
        expect(buildFormation(save, leafRegion, n).length, `${n.id} at ladder ${deckCapFor(cleared)}`).toBe(want);
      }
    }
  });

  it("fills the rank-and-file nodes mostly with Rares", () => {
    // Skirmishes and Wardens are the bulk of the campaign and stay Rare-heavy.
    // Gates, Landmarks and Thrones deliberately do NOT — see FILL_PROFILE. A
    // Throne that was mostly Rares is the thing this quota exists to fix.
    const save = { ...newSave(), cleared: ["L14", "P13", "A13"] };
    for (const n of leafRegion.nodes.filter((x) => x.kind === "skirmish" || x.kind === "warden")) {
      const f = buildFormation(save, leafRegion, n);
      const rares = f.filter((id) => getDef(id).rarity === "rare").length;
      expect(rares / f.length, `${n.id} is only ${rares}/${f.length} Rare`).toBeGreaterThan(0.5);
    }
  });

  it("eases the Act I Throne without flattening it", () => {
    // The starting deck is 12 fixed Rares with no rebuilding done, so the full
    // quota landed as a wall. It runs at three quarters until Act II — still a
    // Mythic with real support behind it, just not the late-game share.
    const l14 = nodeById("L14")!;
    const early = buildFormation(newSave(), leafRegion, l14);
    const later = buildFormation({ ...newSave(), cleared: ["L14"] }, leafRegion, l14);
    const c = (f: string[], r: string) => f.filter((id) => getDef(id).rarity === r).length;
    expect(c(early, "legendary")).toBeLessThan(c(later, "legendary"));
    expect(c(early, "epic")).toBeLessThan(c(later, "epic"));
    expect(c(early, "mythic"), "the boss is still the boss").toBe(1);
    expect(c(early, "legendary"), "still not a Skirmish").toBeGreaterThanOrEqual(1);
  });

  it("makes a Throne a real fight, not a Mythic behind rank and file", () => {
    // The Mythic is a guaranteed recruit on a first clear, so the fight has to
    // be worth it: the boss arrives with its region's Legendaries and Epics.
    for (const cleared of [[], ["L14", "P13", "A13", "G14", "B14"]]) {
      const save = { ...newSave(), cleared };
      for (const r of REGIONS)
        for (const n of r.nodes.filter((x) => x.kind === "throne")) {
          const f = buildFormation(save, r, n);
          const c = (rr: string) => f.filter((id) => getDef(id).rarity === rr).length;
          expect(c("mythic"), `${n.id} lost its boss`).toBe(1);
          expect(c("legendary"), `${n.id} has no Legendaries`).toBeGreaterThanOrEqual(1);
          expect(c("epic"), `${n.id} has no Epics`).toBeGreaterThanOrEqual(2);
          expect(c("rare"), `${n.id} has no rank and file`).toBeGreaterThanOrEqual(1);
        }
    }
  });

  it("keeps a Skirmish rank-and-file at every tier", () => {
    // The contrast is the point — if every node fielded Legendaries, a Throne
    // would stop reading as a boss.
    for (const r of REGIONS)
      for (const n of r.nodes.filter((x) => x.kind === "skirmish")) {
        const f = buildFormation({ ...newSave(), cleared: ["L14", "P13", "A13"] }, r, n);
        const heavy = f.filter((id) => ["legendary", "mythic"].includes(getDef(id).rarity ?? ""));
        expect(heavy.map((id) => `${n.id}:${id}`)).toEqual([]);
      }
  });

  it("puts every unique card in before any duplicate", () => {
    // Four identical cards reads as a bug, not a boss.
    const f = buildFormation(newSave(), leafRegion, nodeById("L2")!);
    const uniques = nodeById("L2")!.roster;
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
              .toBeLessThanOrEqual(copyCapFor(id, cap, doublesEpics(n)));
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
    expect(copyCapFor(epic, 18)).toBe(DUPLICATE_CAP.epic); // 18 is the ceiling now
    // Rares are never gated — they are what fills a board at Act I.
    const rare = CARDS.find((c) => c.rarity === "rare")!.id;
    expect(copyCapFor(rare, 12)).toBe(DUPLICATE_CAP.rare);
  });

  it("never doubles an Epic at Act I on an ordinary node", () => {
    // Gates, Landmarks and Thrones may — that is `doublesEpics`, and it is why
    // a checkpoint feels different from the road up to it.
    const early = { ...newSave(), cleared: [] };
    for (const r of REGIONS)
      for (const n of r.nodes.filter((x) => !doublesEpics(x))) {
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

  it("never drops a roster card to hit the target, except on an opener", () => {
    // A trimmed roster card would be unrecruitable that run — everywhere except
    // an opening battle, where `guaranteedDrops` hands over the whole roster and
    // the region's Epic however few of them actually stood on the board. That is
    // what lets the opener field two of three without costing the player Greegon.
    for (const r of REGIONS)
      for (const n of r.nodes) {
        if (isOpeningNode(r, n)) continue;
        const f = buildFormation(newSave(), r, n);
        for (const id of recruitablePool(n)) expect(f, `${n.id} dropped ${id}`).toContain(id);
      }
  });

  it("...and an opener still pays out every roster card it did not field", () => {
    const leaf = REGIONS.find((r) => r.id === "leaf")!;
    const l1 = nodeById("L1")!;
    const fielded = buildFormation(newSave(), leaf, l1);
    expect(fielded).not.toContain("leaf_greegon"); // not on the board
    const start = newSave();
    const after = applyClear(start, l1, rollRecruits(start, l1, 1, () => 0.99));
    expect(after.collection).toContain("leaf_greegon"); // paid out anyway
    for (const id of l1.roster) expect(after.collection).toContain(id);
  });

  it("rolls ONCE per unique card however many copies are on the board", () => {
    // The load-bearing guardrail: duplicates are a difficulty knob, not a loot
    // knob. If they ever reached the roll, drop rates and pity would both lie.
    const s: StorySave = { ...newSave(), collection: [], deck: [] };
    const node = nodeById("L2")!; // needs duplicates, so not the opener
    const f = buildFormation(s, leafRegion, node);
    expect(f.length).toBeGreaterThan(node.roster.length); // duplicates present
    const r = rollRecruits(s, node, 99, () => 0);         // every roll succeeds
    expect(r.won.sort()).toEqual([...node.roster].sort());
    expect(new Set(r.won).size).toBe(r.won.length);
  });
});

describe("story: border gates (7)", () => {
  const gates = ALL_NODES.filter(isGate);
  // A gate asks for a full deck and gateCheck bounds that by what the player can
  // actually field, so the fixture needs a real collection — the one-card
  // starter would cap every gate in the suite at one card.
  const full = (cleared: string[]): StorySave =>
    ({ ...newSave(), cleared, collection: CARDS.filter((c) => c.element === "LEAF").map((c) => c.id) });
  /** A pile of real LEAF Rares to build test decks from. The starter is one
   *  card now, so it can no longer stand in for "a deck of some size". */
  const LEAF_RARES = CARDS.filter((c) => c.element === "LEAF" && c.rarity === "rare").map((c) => c.id);

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
    // STARTER is a single card now, so the "8 of 15" case needs a real 8.
    const short = { ...full(["L14"]), deck: LEAF_RARES.slice(0, 8) };
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
  it("clamps the ladder to the board the fight is actually on", () => {
    // The ladder says how far the campaign has come; the board says how much of
    // it this fight takes. 18 on 4x4, 28 on 5x5 — and the clamp can only ever
    // LOWER the ladder, never raise it, or the first Throne on the map would
    // field 28 against a starter deck.
    const leaf = REGIONS.find((r) => r.id === "leaf")!;
    const small = nodeById("L1")!;
    const big = nodeById("L14")!;
    expect(boardForNode(leaf, small)).toBe(4);
    expect(boardForNode(leaf, big)).toBe(5);
    for (const step of CAP_LADDER) expect(step.cap).toBeLessThanOrEqual(BIG_BOARD_CAP);
    // Act I: the clamp does nothing, because the ladder is below both ceilings.
    expect(capForNode([], leaf, small)).toBe(12);
    expect(capForNode([], leaf, big)).toBe(12);
    // Act V: the small board holds at 18 while the set piece opens to 28.
    const late = ["L14", "P13", "A13", "G14", "B14"];
    expect(deckCapFor(late)).toBe(28);
    expect(capForNode(late, leaf, small)).toBe(STANDARD_CAP);
    expect(capForNode(late, leaf, big)).toBe(BIG_BOARD_CAP);
  });

  it("sends set pieces to 5x5 and everything else to 4x4", () => {
    // The campaign is a 4x4 game that opens up for the fight an Act builds to.
    for (const r of REGIONS) {
      for (const n of r.nodes) {
        const board = boardForNode(r, n);
        const big = BIG_BATTLE_KINDS.includes(n.kind);
        expect(board, `${n.id} (${n.kind})`).toBe(n.board ?? (big ? 5 : 4));
        expect([4, 5], `${n.id} board ${board}`).toContain(board);
      }
    }
  });

  it("offers back the team you last used, then the NEWEST match", () => {
    // The bug this replaces: prep searched loadouts FORWARDS for an element
    // match, and teams are appended — so saving a new team and returning to the
    // node silently fought with the oldest one instead. The save was fine; the
    // recall was wrong, which reads from the player's side as "teams not saving".
    const team = (id: string, element: string, n: number): Loadout =>
      ({ id, name: id, element, cards: Array.from({ length: n }, () => "leaf_nettle") });
    const base = { ...newSave(), loadouts: [team("old", "LEAF", 3), team("new", "LEAF", 5)] };
    const anyLegal = () => true;

    // No memory yet -> the NEWEST element match, not the first.
    expect(preferredLoadout(base, "LEAF", anyLegal)?.id).toBe("new");
    // With a memory -> exactly what was last used, even though it is older.
    expect(preferredLoadout({ ...base, lastTeamId: "old" }, "LEAF", anyLegal)?.id).toBe("old");
    // A remembered team that is no longer LEGAL here falls through rather than
    // being offered and then refused.
    expect(preferredLoadout({ ...base, lastTeamId: "old" }, "LEAF", (l) => l.cards.length > 4)?.id)
      .toBe("new");
    // A remembered id that no longer exists is simply ignored.
    expect(preferredLoadout({ ...base, lastTeamId: "deleted" }, "LEAF", anyLegal)?.id).toBe("new");
    // Nothing for this element -> undefined, and prep keeps the current deck.
    expect(preferredLoadout(base, "PYRO", anyLegal)).toBeUndefined();
  });

  it("keeps every lore line short enough to read before a fight", () => {
    // Lore is Story Bible flavour shown on the node panel and the prep screen.
    // It has to survive a phone, so it is a line or two — not a page.
    const lored = REGIONS.flatMap((r) => r.nodes).filter((n) => n.lore);
    expect(lored.length, "lore was written for a good share of the map").toBeGreaterThan(40);
    for (const n of lored) {
      expect(n.lore!.length, `${n.id} lore is ${n.lore!.length} chars`).toBeLessThanOrEqual(260);
      expect(n.lore!.trim(), `${n.id}`).toBe(n.lore);
    }
  });

  it("keeps lore and note as separate jobs", () => {
    // The two are allowed to coexist on a node — one says where you are, the
    // other what to expect — but neither should be a copy of the other.
    for (const n of REGIONS.flatMap((r) => r.nodes)) {
      if (n.lore && n.note) expect(n.lore, `${n.id}`).not.toBe(n.note);
    }
  });

  it("keeps the large board rare enough to stay an event", () => {
    const all = REGIONS.flatMap((r) => r.nodes.map((n) => boardForNode(r, n)));
    const big = all.filter((b) => b === 5).length;
    // Landmarks and Thrones only — a third of the map at most, or "important
    // battle" stops meaning anything.
    expect(big).toBeGreaterThan(0);
    expect(big / all.length).toBeLessThan(0.35);
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

  it("raises the cap to 28 on any two Gray Thrones, and not on one", () => {
    const base = ["L14", "P13", "A13"];
    expect(deckCapFor([...base, "G14"])).toBe(22);
    expect(deckCapFor([...base, "G14", "B14"])).toBe(28);
    expect(deckCapFor([...base, "B14", "R14"])).toBe(28);
    // ...but an ordinary 4x4 node never sees a card of it.
    const leaf = REGIONS.find((r) => r.id === "leaf")!;
    expect(capForNode([...base, "G14", "B14"], leaf, nodeById("L1")!)).toBe(STANDARD_CAP);
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
    // The walk ends at the ceiling — and reaches it in Act II, because that is
    // where the ladder now stops. Everything after is a better eighteen, not a
    // bigger one, so this asserts the ceiling rather than a late-game number.
    const ceiling = Math.max(...CAP_LADDER.map((r) => r.cap));
    expect(ceiling).toBe(BIG_BOARD_CAP);
    expect(deckCapFor(save.cleared)).toBe(ceiling);
  });
});