// STORY HARD MODE (owner, 2026-09-27): finish the campaign — every region's
// required Throne — and it offers a second run. The MAP starts over, the CARDS
// stay; every squad is bigger and heavier; and a Void Tower boss holds every
// border instead of a patrol, fought under the tower's rules.
//
// Pinned here: what the reset takes and what it leaves (including the things
// that READ node clears but are the player's history — spells, the tutorial,
// the profile's count, the cloud-save summary), the formations, and the border
// bosses and how they are seated.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getDef } from "../../data/cards";
import {
  ALL_NODES, BIG_BOARD_CAP, BORDER_BOSS_BOARD, BORDER_BOSS_DECK, HARD_BORDER_BOSS, REGIONS,
  REQUIRED_THRONES, boardForNode,
  borderBossFor, buildFormation, campaignComplete, canStartHard, capForNode, deckCapFor,
  everCleared, fightBoardFor, fightCap, gateCheck, hardFormationSize, heroSpellShelf, isGate,
  isHard, isOpen, loadStory, newSave, packSquad, poolForRegion, regionOfNode, saveStory,
  SQUAD_BASE, bookForLoadout, heroBookFor, spellsUnlockedIn, squadIsOfferable, squadLimitFor,
  startHardMode, HARD_MARK, THRONE_MYTHICS, canResumeHard, resumeHardMode,
  HARD_BORDER_SCALE, borderBossScale,
  type StoryNode, type StorySave,
} from "../../data/story";
import {
  VOID_BOSSES, VOID_GATE, buildVoidEncounter, tameScaleFor, voidBossById, voidBossSeat, voidGateSeats,
} from "../../data/void-tower";
import { playerStats } from "../../data/player";
import { summarize } from "../../net/account";
import { firstFightWon, onboardingStep } from "../../ui/Onboarding";
import { broodOf, seatTamedAlly, seatVoidBoss } from "../../ui/void-seat";
import { SPELLS, getSpell, spellCapForBoard } from "../spells";
import { cardAt, createInitialState, summonCard } from "../state";
import { centreHomeSeat } from "../types";

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

  it("plays with the whole collection, in every region, from the first node", () => {
    // Owner, 2026-09-27: no travelling squad on a Hard run. Every region is home
    // ground, the way the first run only makes it once DUSK's Throne falls.
    const hard = startHardMode(finished());
    const owned = [...hard.collection].sort();
    for (const region of REGIONS) {
      expect(squadLimitFor(hard, region), region.id).toBeNull();
      expect([...poolForRegion(hard, region)].sort(), region.id).toEqual(owned);
      expect(squadIsOfferable(hard, region), region.id).toBe(false);
      expect(packSquad(hard, region, owned.slice(0, 3)), `${region.id}: nothing to pack`).toBe(hard);
    }
    // The first run keeps its limit: away from home, before any Throne, the
    // twelve it packed and nothing else from abroad.
    const firstRun: StorySave = { ...finished(), cleared: [] };
    const away = REGIONS[1];
    expect(squadLimitFor(firstRun, away)).toBe(SQUAD_BASE);
    expect(poolForRegion(firstRun, away).length).toBeLessThan(firstRun.collection.length);
  });

  it("keeps every spell the hero earned — spells unlock off clears, and the map reset", () => {
    const done = finished();
    const hard = startHardMode(done);
    expect(heroSpellShelf(done).length).toBeGreaterThan(0);
    expect(heroSpellShelf(hard)).toEqual(heroSpellShelf(done));
  });

  it("unlocks every spell in the game, not only the ones the first run walked for", () => {
    // Owner, 2026-09-27: the whole collection, spells included. A campaign can
    // be finished on the required Thrones alone, a region's depth short of its
    // top spells; this save walked ONE node per region, so its first-run shelf
    // is the eight cost-1s.
    const beeline: StorySave = { ...newSave(), cleared: [...REQUIRED_THRONES] };
    expect(heroSpellShelf(beeline).every((id) => getSpell(id).cost === 1)).toBe(true);
    const hard = startHardMode(beeline);
    expect(isHard(hard)).toBe(true);
    const all = SPELLS.map((sp) => sp.id);
    expect([...heroSpellShelf(hard)].sort()).toEqual([...all].sort());
    // Still cheapest first, which is what the automatic book fills from.
    const costs = heroSpellShelf(hard).map((id) => getSpell(id).cost);
    expect(costs).toEqual([...costs].sort((a, b) => a - b));
    for (const region of REGIONS)
      expect(spellsUnlockedIn(hard, region).length, region.id).toBe(
        SPELLS.filter((sp) => sp.element === region.element).length);
    // A team's book keeps a finisher the first run never walked far enough for,
    // and the board's cap still trims it.
    const finisher = SPELLS.find((sp) => sp.cost === 10)!.id;
    expect(bookForLoadout(hard, { id: "t", name: "t", cards: [], spells: [finisher] }, 4)).toEqual([finisher]);
    expect(bookForLoadout(beeline, { id: "t", name: "t", cards: [], spells: [finisher] }, 4)).not.toContain(finisher);
    expect(heroBookFor(hard, 4).length).toBe(spellCapForBoard(4));
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
      // The junk flag is not trusted — but the save is a Hard run, and the
      // first-run record and the ledger's mark both say so, so it comes back
      // as a real one rather than being dropped to a first run.
      expect(junk.hardRun).toBe(1);
      expect(junk.firstRunCleared).toEqual(["L1"]);
    } finally { g.localStorage = prior; }
  });
});

describe("Hard mode survives an older build (owner-reported 2026-09-28)", () => {
  // "After completing the leaf region on hard, I left and then came back, and
  // now it is reset to the normal mode without a method to go back." A build
  // from before Hard mode rebuilds the save from the fields it knows: `cleared`
  // stays, `hardRun` and `firstRunCleared` go. These pin both halves of the
  // fix — the save heals itself, and one that already lost everything can go
  // back.
  const withStorage = (run: (store: Map<string, string>) => void) => {
    const store = new Map<string, string>();
    const g = globalThis as { localStorage?: unknown };
    const prior = g.localStorage;
    g.localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    };
    try { run(store); } finally { g.localStorage = prior; }
  };
  /** The Hard run LEAF was cleared on — then written back by an older build. */
  const leafOnHard = (): StorySave => ({
    ...startHardMode(finished()),
    cleared: REGIONS[0].nodes.filter((n) => !isGate(n)).map((n) => n.id),
  });
  const stripped = (s: StorySave, keep: Partial<Record<"hardRun" | "firstRunCleared" | "gifts", boolean>> = {}) => {
    const raw = JSON.parse(JSON.stringify(s)) as Record<string, unknown>;
    if (!keep.hardRun) delete raw.hardRun;
    if (!keep.firstRunCleared) delete raw.firstRunCleared;
    if (!keep.gifts) raw.gifts = (raw.gifts as string[]).filter((x) => x !== HARD_MARK);
    return JSON.stringify(raw);
  };

  it("starting Hard writes a mark into the ledger an older build keeps", () => {
    expect(startHardMode(finished()).gifts).toContain(HARD_MARK);
  });

  it("a save stripped by an older build loads as Hard again, its map intact", () => {
    withStorage((store) => {
      const before = leafOnHard();
      saveStory(before);
      const key = [...store.keys()][0];
      store.set(key, stripped(before, { gifts: true }));
      const back = loadStory();
      expect(isHard(back)).toBe(true);
      expect(back.cleared).toEqual(before.cleared);
      expect(back.gifts).toContain(HARD_MARK);
    });
  });

  it("...and so does one that lost only the flag, from its first-run record", () => {
    withStorage((store) => {
      const before = leafOnHard();
      saveStory(before);
      const key = [...store.keys()][0];
      store.set(key, stripped(before, { firstRunCleared: true }));
      expect(isHard(loadStory())).toBe(true);
    });
  });

  it("a first run is never mistaken for one", () => {
    withStorage(() => {
      saveStory({ ...finished(), cleared: ["L1", "L2"] });
      expect(isHard(loadStory())).toBe(false);
    });
  });

  it("a save that lost every trace can go back to Hard, where it stands", () => {
    withStorage((store) => {
      const before = leafOnHard();
      saveStory(before);
      const key = [...store.keys()][0];
      store.set(key, stripped(before));   // no flag, no record, no mark
      const lost = loadStory();
      expect(isHard(lost)).toBe(false);
      expect(THRONE_MYTHICS.length).toBe(REQUIRED_THRONES.length);
      expect(canResumeHard(lost)).toBe(true);
      const back = resumeHardMode(lost);
      expect(isHard(back)).toBe(true);
      expect(back.cleared, "the map is kept, not reset").toEqual(before.cleared);
      expect(back.gifts).toContain(HARD_MARK);
      for (const id of REQUIRED_THRONES) expect(back.firstRunCleared).toContain(id);
      expect(canResumeHard(back), "offered once").toBe(false);
    });
  });

  it("offers the way back only where it belongs", () => {
    // A first run without the Thrones' Mythics: nothing to go back to.
    const early: StorySave = { ...newSave(), cleared: ["L1"] };
    expect(canResumeHard(early)).toBe(false);
    // A finished first run gets the ordinary offer, not this one.
    expect(canResumeHard(finished())).toBe(false);
    expect(canStartHard(finished())).toBe(true);
    // A Hard run already is one.
    expect(canResumeHard(leafOnHard())).toBe(false);
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
    // walls — Hoarfell and Spindle won 5% and 0%. The exceptions are the
    // owner's own picks for the last two borders (2026-09-28), fought below
    // their Tower strength (HARD_BORDER_SCALE). Any other floor-3+ border is a
    // mistake.
    const OWNER_PICKS: Record<string, string> = { GF: "boss_hoarfell", GS: "boss_spindle" };
    for (const [gate, id] of Object.entries(HARD_BORDER_BOSS)) {
      const boss = voidBossById(id);
      expect(boss, `${gate}: ${id}`).not.toBeNull();
      if (OWNER_PICKS[gate] !== id) expect(boss!.floor, `${gate}: ${id}`).toBeLessThanOrEqual(2);
      expect(VOID_BOSSES.some((b) => b.cardId === id)).toBe(true);
    }
    expect(HARD_BORDER_BOSS.GF).toBe("boss_hoarfell");
    expect(HARD_BORDER_BOSS.GS).toBe("boss_spindle");
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

  it("takes a full Tower deck at every border, whatever the Hard ladder says", () => {
    // Owner, 2026-09-28: "not allowing you to use a full deck to be able to
    // defeat the boss". The Tower fights these bosses with a full 5x5 deck and
    // builds each encounter as half of one; the Hard ladder is 15 at the first
    // borders.
    for (const gate of GATES) {
      const region = regionOfNode(gate.id)!;
      const standing: StorySave = { ...hard, cleared: [...gate.requires] };
      expect(fightCap(standing, region, gate), gate.id).toBe(BORDER_BOSS_DECK);
      expect(BORDER_BOSS_DECK).toBe(BIG_BOARD_CAP);
    }
    const first = GATES[0];
    expect(deckCapFor([...first.requires]), "the ladder there is lower").toBeLessThan(BORDER_BOSS_DECK);
  });

  it("lets any deck up to a full one cross, and asks no composition", () => {
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
    expect(unfit.length).toBe(cap);
    expect(gateCheck({ ...hardRun, deck: unfit }, gate).ok, "a full deck").toBe(true);
    expect(gateCheck({ ...hardRun, deck: unfit.slice(0, 12) }, gate).ok, "less than full may cross").toBe(true);
    expect(gateCheck({ ...hardRun, deck: [] }, gate).ok, "but not nothing").toBe(false);
    const capFirst = fightCap(firstRun, region, gate);
    expect(gateCheck({ ...firstRun, deck: unfit.slice(0, capFirst) }, gate).ok, "the first run still asks").toBe(false);
  });

  it("every border boss fights at its full Tower strength; the side scale still works", () => {
    // Owner, 2026-10-04: "increase the power of the hard mode bosses. Back to a
    // hundred percent" — tamed bosses can now come to a Story fight instead.
    for (const g of GATES) expect(borderBossScale(g), g.id).toBe(1);
    expect(Object.keys(HARD_BORDER_SCALE)).toEqual([]);
    // The dial stays, and still scales the WHOLE enemy side when it is set.
    const id = HARD_BORDER_BOSS.GS;
    const scale = 0.5;
    const fresh = () => {
      const enc = buildVoidEncounter(voidBossById(id)!);
      return {
        enc,
        s: createInitialState(7, ["leaf_sakuroot"], enc.deck, ["P1"], [], enc.spells, enc.boardSize,
          undefined, undefined, { P2: enc.stacked.P2 }),
      };
    };
    const { enc, s } = fresh();
    seatVoidBoss(s, id, { scale });
    const seat = voidBossSeat(s.boardSize);
    const boss = cardAt(s, seat.row, seat.col)!;
    expect(boss.statScale).toBe(scale);
    expect(boss.maxHp).toBe(Math.round(getDef(id).hp * scale));
    const brood = summonCard(s, "P2", enc.stacked.P2[0], { row: 0, col: 0 } as never);
    expect(brood.statScale).toBe(scale);
    const mine = summonCard(s, "P1", "leaf_sakuroot", { row: s.boardSize - 1, col: 0 } as never);
    expect(mine.statScale ?? 1).toBe(1);
    // At scale 1 nothing is touched.
    const full = fresh().s;
    seatVoidBoss(full, id, { scale: 1 });
    expect(full.sideScale).toBeUndefined();
    expect(cardAt(full, seat.row, seat.col)!.maxHp).toBe(getDef(id).hp);
    const app = readFileSync(join(__dirname, "..", "..", "ui", "App.tsx"), "utf8");
    expect(app).toContain("seatVoidBoss(trial, borderBoss, { scale: borderBossScale(node) });");
  });

  it("a tamed boss can be brought to any Story fight", () => {
    // Owner, 2026-10-04: "use the bosses captured in the tower to be able to
    // defeat the story mode". Seated like a Void Trial's ally — the player's
    // centre home slot, free, acting from round one, at its tamed strength —
    // and a battle is spent only when it was actually seated.
    const ally = "boss_smolder";
    const s = createInitialState(7, ["leaf_sakuroot"], ["leaf_sakuroot"], ["P1"], [], [], 5);
    expect(seatTamedAlly(s, ally)).toBe(true);
    const at = centreHomeSeat("P1", s.boardSize);
    const c = cardAt(s, at.row, at.col)!;
    expect(c.defId).toBe(ally);
    expect(c.owner).toBe("P1");
    expect(c.tamed).toBe(true);
    expect(c.summonedThisRound).toBe(false);
    expect(c.statScale).toBe(tameScaleFor(ally));
    expect(seatTamedAlly(s, ally), "the square is taken").toBe(false);
    const app = readFileSync(join(__dirname, "..", "..", "ui", "App.tsx"), "utf8");
    expect(app).toContain("spendAlly(!!ally && seatTamedAlly(trial, ally));");
    expect(app).toContain("spendAlly(!!ally && seatTamedAlly(fresh, ally));");
    const prep = readFileSync(join(__dirname, "..", "..", "ui", "StoryPrep.tsx"), "utf8");
    expect(prep).toContain("tamedRoster(save.tamed).filter((t) => t.boss.cardId !== boss)");
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
