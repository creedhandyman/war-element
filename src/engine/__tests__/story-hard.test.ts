// STORY HARD MODE (owner, 2026-09-27): finish the campaign — every region's
// required Throne — and it offers a second run. The MAP starts over, the CARDS
// stay; every squad is bigger and heavier; and a Void Tower boss holds every
// border instead of a patrol, fought under the tower's rules.
//
// Pinned here: what the reset takes and what it leaves (including the things
// that READ node clears but are the player's history — spells, the tutorial,
// the profile's count, the cloud-save summary), the formations, and the border
// bosses and how they are seated.
import { describe, expect, it } from "vitest";
import { getDef } from "../../data/cards";
import {
  ALL_NODES, BORDER_BOSS_BOARD, HARD_BORDER_BOSS, REGIONS, REQUIRED_THRONES, boardForNode,
  borderBossFor, buildFormation, campaignComplete, canStartHard, capForNode, deckCapFor,
  everCleared, fightBoardFor, fightCap, gateCheck, hardFormationSize, heroSpellShelf, isGate,
  isHard, isOpen, loadStory, newSave, regionOfNode, saveStory, startHardMode,
  type StoryNode, type StorySave,
} from "../../data/story";
import {
  VOID_BOSSES, VOID_GATE, buildVoidEncounter, voidBossById, voidBossSeat, voidGateSeats,
} from "../../data/void-tower";
import { playerStats } from "../../data/player";
import { summarize } from "../../net/account";
import { firstFightWon, onboardingStep } from "../../ui/Onboarding";
import { broodOf, seatVoidBoss } from "../../ui/void-seat";
import { cardAt, createInitialState } from "../state";

const GATES = ALL_NODES.filter(isGate);
const rarityOf = (id: string) => getDef(id).rarity ?? "rare";
const heavy = (ids: string[]) =>
  ids.filter((id) => ["mythic", "legendary", "epic"].includes(rarityOf(id))).length;

/** A finished first campaign, with everything a run accumulates beside the
 *  map: cards, a wallet, a chosen book, saved teams, per-region decks and
 *  squads, pity, Blight. */
function finished(): StorySave {
  const base = newSave();
  const collection = [...new Set(ALL_NODES.flatMap((n) => n.roster))];
  const cleared = ALL_NODES.map((n) => n.id);
  return {
    ...base,
    cleared,
    collection,
    deck: collection.slice(0, 30),
    pity: { "L3:leaf_stickers": 2 },
    hero: { ...base.hero!, shards: 1234, freePacks: 0, essence: { LEAF: 9 } },
    loadouts: [{ id: "t1", name: "Grove", cards: collection.slice(0, 18), spells: [] }],
    lastTeamId: "t1",
    decks: { leaf: collection.slice(0, 12) },
    squads: { pyro: collection.slice(0, 12) },
    blight: { leaf: 2 },
  } as StorySave;
}

describe("starting Hard mode", () => {
  it("is offered only once every required Throne has fallen, and only once", () => {
    expect(canStartHard(newSave())).toBe(false);
    const done = finished();
    expect(campaignComplete(done)).toBe(true);
    expect(canStartHard(done)).toBe(true);
    for (const throne of REQUIRED_THRONES) {
      const short = { ...done, cleared: done.cleared.filter((id) => id !== throne) };
      expect(canStartHard(short), `missing ${throne}`).toBe(false);
      expect(startHardMode(short), "refused without touching the save").toBe(short);
    }
    const hard = startHardMode(done);
    expect(isHard(hard)).toBe(true);
    expect(canStartHard(hard), "a Hard run does not offer itself again").toBe(false);
  });

  it("resets the map — clears, the deck-size ladder, Blight, packed squads", () => {
    const hard = startHardMode(finished());
    expect(hard.cleared).toEqual([]);
    expect(hard.blight).toEqual({});
    expect(hard.squads).toBeUndefined();
    expect(deckCapFor(hard.cleared)).toBe(deckCapFor([]));
    // The campaign opens where it always did: one node, the first.
    expect(ALL_NODES.filter((n) => isOpen(hard, n)).map((n) => n.id)).toEqual([REGIONS[0].nodes[0].id]);
  });

  it("keeps the cards and everything else the player owns", () => {
    const done = finished();
    const hard = startHardMode(done);
    expect(hard.collection).toEqual(done.collection);
    expect(hard.hero).toEqual(done.hero);
    expect(hard.loadouts).toEqual(done.loadouts);
    expect(hard.lastTeamId).toBe(done.lastTeamId);
    expect(hard.decks).toEqual(done.decks);
    expect(hard.pity).toEqual(done.pity);
    expect(hard.deck).toEqual(done.deck);
    // ...and the finished campaign stays on the record.
    expect([...(hard.firstRunCleared ?? [])].sort()).toEqual([...done.cleared].sort());
  });

  it("keeps every spell the hero earned — spells unlock off clears, and the map reset", () => {
    const done = finished();
    const hard = startHardMode(done);
    expect(heroSpellShelf(done).length).toBeGreaterThan(0);
    expect(heroSpellShelf(hard)).toEqual(heroSpellShelf(done));
  });

  it("never walks a veteran through the first fight again", () => {
    const hard = startHardMode(finished());
    expect(firstFightWon(hard)).toBe(true);
    expect(onboardingStep(hard)).toBeNull();
  });

  it("counts the player's history across runs: the profile and the save summary", () => {
    const done = finished();
    const hard = startHardMode(done);
    const hardAgain = { ...hard, cleared: ["L1", "L2"] };
    expect(everCleared(hardAgain).length).toBe(ALL_NODES.length);
    const nodes = playerStats(hardAgain, { totalCards: 1, totalNodes: ALL_NODES.length })
      .find((s) => s.label === "Nodes");
    expect(nodes?.value).toBe(ALL_NODES.length);
    // The cloud-save chooser must not read a finished campaign as a new one.
    const s = summarize({ keys: { we_story_v1: JSON.stringify(hardAgain) }, savedAt: "" });
    expect(s.cleared).toBe(ALL_NODES.length);
  });

  it("survives a round trip through storage, rejecting junk", () => {
    const store = new Map<string, string>();
    const g = globalThis as { localStorage?: unknown };
    const prior = g.localStorage;
    g.localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    };
    try {
      const hard = { ...startHardMode(finished()), cleared: ["L1"] };
      saveStory(hard);
      const back = loadStory();
      expect(back.hardRun).toBe(1);
      expect(back.cleared).toEqual(["L1"]);
      expect([...(back.firstRunCleared ?? [])].sort()).toEqual([...(hard.firstRunCleared ?? [])].sort());

      store.set([...store.keys()][0], JSON.stringify({
        ...JSON.parse([...store.values()][0]), hardRun: "yes", firstRunCleared: ["L1", "NOPE", 7],
      }));
      const junk = loadStory();
      expect(junk.hardRun).toBeUndefined();
      expect(junk.firstRunCleared).toEqual(["L1"]);
    } finally { g.localStorage = prior; }
  });
});

describe("Hard squads", () => {
  /** The same node, the same ladder, first run against Hard. */
  const pair = (node: StoryNode, cleared: string[]) => {
    const region = regionOfNode(node.id)!;
    const first: StorySave = { ...newSave(), cleared };
    const hard: StorySave = { ...first, hardRun: 1 };
    return {
      region,
      first: buildFormation(first, region, node),
      hard: buildFormation(hard, region, node),
      cap: capForNode(cleared, region, node),
    };
  };
  const everything = ALL_NODES.map((n) => n.id);
  const fights = ALL_NODES.filter((n) => !isGate(n));

  it("are bigger than the first run's at every node, on every ladder", () => {
    for (const cleared of [[], everything]) {
      for (const node of fights) {
        const { first, hard } = pair(node, cleared);
        expect(hard.length, `${node.id} at ${cleared.length} clears`).toBeGreaterThan(first.length);
      }
    }
  });

  it("aim for half as many cards again as the player may bring", () => {
    for (const node of fights) {
      const { hard, cap } = pair(node, everything);
      expect(hard.length, node.id).toBeLessThanOrEqual(hardFormationSize(cap));
      // A region's pool can run dry of legal copies, but never by much.
      expect(hard.length, node.id).toBeGreaterThanOrEqual(Math.floor(hardFormationSize(cap) * 0.9));
    }
  });

  it("are heavier: never fewer Epics-and-up than the first run's", () => {
    for (const cleared of [[], everything]) {
      for (const node of fights) {
        const { first, hard } = pair(node, cleared);
        expect(heavy(hard), `${node.id} at ${cleared.length} clears`).toBeGreaterThanOrEqual(heavy(first));
      }
    }
  });

  it("the opening battle is a full squad, not the first run's one-for-one welcome", () => {
    const leaf = REGIONS[0];
    const opener = leaf.nodes.find((n) => n.id === leaf.opening.node)!;
    const { first, hard, cap } = pair(opener, []);
    expect(first.length).toBeLessThan(cap);
    expect(hard.length).toBe(hardFormationSize(cap));
  });

  it("a first run's squads are exactly what they were", () => {
    // Everything Hard does is behind `isHard`; a save without `hardRun` must
    // build the same formation with or without a record of earlier runs.
    for (const node of fights) {
      const region = regionOfNode(node.id)!;
      const plain = { ...newSave(), cleared: everything };
      const recorded = { ...plain, firstRunCleared: everything };
      expect(buildFormation(recorded, region, node), node.id).toEqual(buildFormation(plain, region, node));
    }
  });
});

describe("Hard borders: a Void Tower boss on every crossing", () => {
  const hard = startHardMode(finished());

  it("every gate has one, and only in Hard", () => {
    expect(Object.keys(HARD_BORDER_BOSS).sort()).toEqual(GATES.map((g) => g.id).sort());
    for (const gate of GATES) {
      expect(borderBossFor(newSave(), gate), gate.id).toBeNull();
      expect(borderBossFor(hard, gate), gate.id).toBe(HARD_BORDER_BOSS[gate.id]);
    }
    for (const node of ALL_NODES.filter((n) => !isGate(n)))
      expect(borderBossFor(hard, node), node.id).toBeNull();
  });

  it("each is a real tower boss, from the floors a campaign deck can meet", () => {
    // Floors 3 and up are tuned around a TAMED ALLY fighting beside the player
    // (see void-tower.ts); a campaign fight has none, and measured they were
    // walls — Hoarfell and Spindle won 5% and 0%.
    for (const [gate, id] of Object.entries(HARD_BORDER_BOSS)) {
      const boss = voidBossById(id);
      expect(boss, `${gate}: ${id}`).not.toBeNull();
      expect(boss!.floor, `${gate}: ${id}`).toBeLessThanOrEqual(2);
      expect(VOID_BOSSES.some((b) => b.cardId === id)).toBe(true);
    }
  });

  it("each fights for one side of its border", () => {
    for (const gate of GATES) {
      const boss = voidBossById(HARD_BORDER_BOSS[gate.id])!;
      const bossEls = [boss.tribeElement, boss.mechanicElement, boss.thirdElement].filter(Boolean);
      const sides = [
        regionOfNode(gate.id)!.element,
        ...(gate.opens ?? []).map((r) => REGIONS.find((x) => x.id === r)!.element),
        // The Arctic Gate and the Shadow Border sit on AQUA's and BORE's maps
        // but are reached from the whole Gray Continent.
        ...(gate.requiresCount ? ["GALE", "BOLT", "BORE"] : []),
      ];
      expect(bossEls.some((e) => sides.includes(e as never)), `${gate.id}: ${boss.cardId}`).toBe(true);
    }
  });

  it("is fought on the tower's own board", () => {
    for (const gate of GATES) {
      const region = regionOfNode(gate.id)!;
      const enc = buildVoidEncounter(voidBossById(HARD_BORDER_BOSS[gate.id])!);
      expect(fightBoardFor(hard, region, gate)).toBe(BORDER_BOSS_BOARD);
      expect(enc.boardSize).toBe(BORDER_BOSS_BOARD);
      expect(fightBoardFor(newSave(), region, gate)).toBe(boardForNode(region, gate));
    }
  });

  it("asks for a full deck but no composition", () => {
    const gate = GATES.find((g) => g.demand)!;
    const region = regionOfNode(gate.id)!;
    // Open it: the gate's prerequisites cleared on both runs.
    const open = (s: StorySave): StorySave => ({ ...s, cleared: [...gate.requires] });
    const firstRun = open({ ...finished(), firstRunCleared: undefined });
    const hardRun = open(hard);
    const cap = fightCap(hardRun, region, gate);
    const unfit = hardRun.collection.filter((id) => {
      const d = getDef(id);
      return gate.demand!.kind === "class" ? d.cardClass !== gate.demand!.value : d.attackType !== gate.demand!.value;
    }).slice(0, cap);
    expect(gateCheck({ ...hardRun, deck: unfit }, gate).ok).toBe(true);
    expect(gateCheck({ ...hardRun, deck: unfit.slice(1) }, gate).ok, "the deck size still counts").toBe(false);
    const capFirst = fightCap(firstRun, region, gate);
    expect(gateCheck({ ...firstRun, deck: unfit.slice(0, capFirst) }, gate).ok, "the first run still asks").toBe(false);
  });

  it("is seated like a Void Trial: the boss, its board and the Fortress Gates", () => {
    for (const id of new Set(Object.values(HARD_BORDER_BOSS))) {
      const enc = buildVoidEncounter(voidBossById(id)!);
      const s = createInitialState(7, ["leaf_sakuroot"], enc.deck, ["P1"], [], enc.spells, enc.boardSize,
        undefined, undefined, { P2: enc.stacked.P2 });
      seatVoidBoss(s, id);
      expect(s.voidTower).toBe(true);
      const seat = voidBossSeat(s.boardSize);
      expect(cardAt(s, seat.row, seat.col)?.defId).toBe(id);
      expect(cardAt(s, seat.row, seat.col)?.owner).toBe("P2");
      for (const g of voidGateSeats(s.boardSize)) {
        expect(cardAt(s, g.row, g.col)?.defId).toBe(VOID_GATE);
        expect(cardAt(s, g.row, g.col)?.owner).toBe("P1");
      }
      expect(broodOf(id)[0], "the read-out leads with the boss").toBe(id);
    }
  });
});
