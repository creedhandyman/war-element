// Story Mode — campaign data, save state, and the recruitment roll.
//
// The map IS the progression system: there is no XP and no character level, so
// everything here is (a) where the nodes are, (b) which nodes you've cleared,
// and (c) which cards you own. Deck size is unlocked by clearing Thrones.
//
// This module is pure data + pure functions. It never imports from the engine's
// runtime or from React, so the whole campaign layer stays testable headlessly.

import { CARD_INDEX, getDef } from "./cards";

// ── shape ───────────────────────────────────────────────────────────────────

export type NodeKind = "skirmish" | "warden" | "landmark" | "throne" | "blight";

export interface StoryNode {
  id: string;
  name: string;
  kind: NodeKind;
  /** Recruitable roster — the cards this node can actually give you. */
  roster: string[];
  /** Non-recruitable filler. Tokens where the element has them; never rollable. */
  adds: string[];
  /** Elemental Overflow (§10.5): cheap Rares from the NEIGHBOURING region that
   *  bleed across this border node. Recruitable, but at half rate — a taste of
   *  the next element, not a shortcut past walking there. Each keeps its home
   *  node, which stays the reliable place to farm it at full odds. */
  overflow?: string[];
  /** Nodes that must be cleared before this one opens. Empty = open from the start. */
  requires: string[];
  /** A required Throne opens the region's borders; an optional one is a detour. */
  required?: boolean;
  note?: string;
  /** Position on the region's painted map, as a PERCENTAGE of its width and
   *  height. Percentages rather than pixels so the map scales to any viewport
   *  and the art can be re-exported at a different size without moving a node. */
  at: { x: number; y: number };
}

export interface StoryRegion {
  id: string;
  name: string;
  element: string;
  /** The Field spell that runs permanently on every node in the region. */
  terrain: string;
  board: number;
  /** Blight the region ships with, painted into the map at generation rather
   *  than creeping in later. LEAF's Rot Line is the template: it is simply the
   *  region DUSK has been working on longest. */
  baseBlight?: number;
  /** Where a Blight Node materialises at level 3 — the region's blight-capable
   *  border zone. A region without one can never host the node. */
  blightAt?: { x: number; y: number };
  /** The painted region map this node layout is placed against. */
  art?: string;
  /** Node ids that must be cleared before this region is reachable at all.
   *  Empty/absent = open from the start (LEAF). */
  requires?: string[];
  nodes: StoryNode[];
}

// ── the LEAF slice ──────────────────────────────────────────────────────────
// Act I. Full vertical slice: every draftable LEAF card is placed exactly once,
// which `story.test.ts` enforces rather than trusting.

const LEAF: StoryRegion = {
  id: "leaf",
  name: "Four Seasons Mega Forest",
  element: "LEAF",
  terrain: "Lushfield",
  board: 4,
  art: "/maps/leaf.webp",
  baseBlight: 1, // the Rot Line — see L8
  // The violet band the art paints across the southern treeline, between the Rot
  // Line and the Southern Burn. This is where the shadow already pools.
  blightAt: { x: 62, y: 87 },
  nodes: [
    // Placed against the painted map. The north arc runs west -> north -> east
    // (Spring Bloom -> Winter's Reach -> Autumn's Gold); the south arc runs
    // west -> south -> east (Evergreen Plains -> the Rot Line / Jungle Wilds).
    // Both converge on the Heart of Nature in the centre.
    { id: "L1", name: "Spring Village Outskirts", kind: "skirmish", at: { x: 15, y: 41 },
      requires: [], roster: ["leaf_nettle", "leaf_weeds", "leaf_greegon"], adds: [],
      note: "The tutorial. Greegon is a REGEN tank you cannot out-race — capture the slot." },
    { id: "L2", name: "Cherry Grove Path", kind: "skirmish", at: { x: 19, y: 24 },
      requires: ["L1"], roster: ["leaf_birch", "leaf_leaf", "leaf_guardian"], adds: [] },
    { id: "L3", name: "Bloomwardens' Ring", kind: "warden", at: { x: 32, y: 40 },
      requires: ["L2"], roster: ["leaf_stickers", "leaf_splint", "leaf_fallona"], adds: ["leaf_acorn_tok"] },
    { id: "L4", name: "Evergreen Plains", kind: "skirmish", at: { x: 25, y: 62 },
      requires: ["L1"], roster: ["leaf_oak", "leaf_python", "leaf_sticks", "leaf_sprinu"], adds: [] },
    { id: "L5", name: "Summer's Embrace Grove", kind: "warden", at: { x: 40, y: 74 },
      requires: ["L4"], roster: ["leaf_alpha", "leaf_dande", "leaf_squanch"], adds: ["leaf_acorn_tok"] },
    { id: "L6", name: "Jungle Wilds", kind: "warden", at: { x: 83, y: 60 },
      requires: ["L5"], roster: ["leaf_stickviper", "leaf_gecko", "leaf_cactus"], adds: ["leaf_reptilian_tok"],
      note: "The Reptile node — StickViper and Gecko are the tribe. Fight it before the warlord who buffs it." },
    // Gated off L10, not L2: the art puts Rustling Woods at Autumn's Gold in the
    // far north-east, so the approach is along the northern treeline.
    { id: "L7", name: "Rustling Woods", kind: "skirmish", at: { x: 78, y: 38 },
      requires: ["L10"], roster: ["leaf_walking_tree", "leaf_hunter", "leaf_dartfrog"], adds: [],
      overflow: ["aqua_misty"], // fronts Eastleaf Port — the Gateway to Aqua
      note: "Autumn's Gold. Eastleaf Port and the sea road to AQUA lie just east." },
    // Gated off L5, not L7: the Rot Line is painted across the SOUTHERN treeline,
    // a step past Summer's Embrace — nowhere near the northern woods.
    { id: "L8", name: "The Rot Line", kind: "warden", at: { x: 41, y: 84 },
      requires: ["L5"], roster: ["leaf_nightshade", "leaf_darth", "leaf_bark_bushmen"], adds: [],
      overflow: ["pyro_staph"], // fronts the Southern Burn — the open road to PYRO
      note: "The mid-forest spike, and the scar DUSK left. Where a starter deck stops working." },
    { id: "L9", name: "Winter's Reach Treeline", kind: "skirmish", at: { x: 40, y: 21 },
      requires: ["L2"], roster: ["leaf_lumberjack", "leaf_whintey", "leaf_sakuroot"], adds: [] },
    { id: "L10", name: "Winter Village Sentinels", kind: "warden", at: { x: 58, y: 23 },
      requires: ["L9"], roster: ["leaf_sumerose", "leaf_rubyo", "leaf_citra"], adds: [],
      note: "Under the Arctic Veil. The ice wall north is DAWN's border — sealed all campaign." },
    { id: "L11", name: "Heart of Nature: Outer Roots", kind: "landmark", at: { x: 40, y: 60 },
      requires: ["L3", "L8"], roster: ["leaf_season", "leaf_thorn", "leaf_elderroot"], adds: [],
      note: "Elderroot is the game's only melee Support." },
    { id: "L12", name: "Heart of Nature: The Spirit Tree", kind: "landmark", at: { x: 56, y: 56 },
      requires: ["L11"], roster: ["leaf_warden", "leaf_efy", "leaf_fallow"], adds: [] },
    { id: "L13", name: "Jungle Throne", kind: "throne", at: { x: 67, y: 81 },
      requires: ["L6", "L12"], roster: ["leaf_trinezer"], adds: ["leaf_reptilian_tok"],
      note: "Deep Grove. Optional — an early skill check with a Mythic reward." },
    { id: "L14", name: "The Spirit Tree Rises", kind: "throne", at: { x: 48, y: 45 },
      requires: ["L12"], roster: ["leaf_oakgre"], adds: ["leaf_acorn_tok"], required: true,
      note: "Required. Clearing it opens the borders to PYRO and AQUA." },
  ],
};


// ── the PYRO slice ──────────────────────────────────────────────────────────
// Act II, the land march. Reached through Gate A, the Southern Burn. Placed
// against `public/maps/pyro.webp`; where the doc's flow chart and the painting
// disagreed about adjacency, the painting won — same rule as LEAF.

const PYRO: StoryRegion = {
  id: "pyro",
  name: "Pyro — The Burning South",
  element: "PYRO",
  terrain: "Heatwave",
  board: 4,
  art: "/maps/pyro.webp",
  requires: ["L14"], // the Spirit Tree opens the borders
  // The Veil Gate: the art paints DUSK's corruption already bleeding through it.
  blightAt: { x: 80, y: 87 },
  nodes: [
    // Two arms out of Ashfall — the city road south-east and the forge road
    // west — converging on the Inner Keep and then the Dragon's Lair.
    { id: "P1", name: "Ashfall Approach", kind: "skirmish", at: { x: 52, y: 17 },
      requires: [], roster: ["pyro_staph", "pyro_sparky", "pyro_florence"], adds: [],
      note: "Where the forest dies. The road back to LEAF is right behind you." },
    { id: "P3", name: "Cinder Road", kind: "skirmish", at: { x: 61, y: 27 },
      requires: ["P1"], roster: ["pyro_ingit", "pyro_bbq", "pyro_baboom", "pyro_taper"], adds: [] },
    { id: "P4", name: "Dessaer District: Forge of Fire", kind: "skirmish", at: { x: 30, y: 31 },
      requires: ["P1"], roster: ["pyro_smog_card", "pyro_heatsink_golem", "pyro_spitfire", "pyro_dyna"], adds: [],
      note: "Forged Tech works. Fight the tribe here before you meet its Mythic at the Forge Core." },
    { id: "P5", name: "The Slagfields", kind: "skirmish", at: { x: 84, y: 31 },
      requires: ["P3"], roster: ["pyro_ash_boar", "pyro_slag_tortoise", "pyro_ember_scorpion", "pyro_wick"], adds: [],
      note: "Cooled lava badlands. Four Rares and no champion — the heaviest Skirmish in the region." },
    { id: "P6", name: "Pyro City Gates", kind: "warden", at: { x: 46, y: 55 },
      requires: ["P3"], roster: ["pyro_firebird", "pyro_liza", "pyro_scully"], adds: [] },
    { id: "P9", name: "Firespine Foothills", kind: "warden", at: { x: 16, y: 34 },
      requires: ["P4"], roster: ["pyro_fenrir", "pyro_firefly", "pyro_twins"], adds: [],
      note: "The whole Cost-5 band on one node. The last gate before the Landmarks." },
    { id: "P7", name: "Ember Fortress Drill Yard", kind: "warden", at: { x: 68, y: 41 },
      requires: ["P6"], roster: ["pyro_woof", "pyro_scorch", "pyro_tiki"], adds: [] },
    { id: "P8", name: "Forgotten Ruins", kind: "warden", at: { x: 88, y: 57 },
      requires: ["P5"], roster: ["pyro_sarra", "pyro_sseerr", "pyro_fenix"], adds: [],
      note: "Half-buried civilization. Where a LEAF-only deck stops working — three BURN Epics with real Specials." },
    // Gated off the city, not off P1: the painted road to the harbour runs
    // through Pyro City. Still only four nodes deep, which keeps the doc's
    // point that a player finding PYRO too punishing can sail out early.
    { id: "P2", name: "Sunfall Coast", kind: "skirmish", at: { x: 34, y: 88 },
      requires: ["P6"], roster: ["pyro_flamehound", "pyro_firecrack", "pyro_canister"], adds: [],
      overflow: ["aqua_buccaneers"], // pirate haven — the sea road to AQUA
      note: "Pirate haven. Gate C opens the sea route to AQUA from here." },
    { id: "P10", name: "Ember Fortress: Inner Keep", kind: "landmark", at: { x: 74, y: 49 },
      requires: ["P7", "P8"], roster: ["pyro_infernus_rex", "pyro_magmadon", "pyro_magmaw"], adds: [],
      note: "The three heavy bruisers. Magmaw exists only in the live build — no project doc has it." },
    { id: "P11", name: "Sunfall Watch", kind: "landmark", at: { x: 62, y: 72 },
      requires: ["P2", "P10"], roster: ["pyro_volcanon", "pyro_sol", "pyro_aftermath", "pyro_dynomight"], adds: [],
      note: "The Cost-6 utility tier, all four on one node." },
    { id: "P13", name: "Firespine Peaks: Dragon's Lair", kind: "throne", at: { x: 10, y: 53 },
      requires: ["P9", "P10"], roster: ["pyro_pyrogon"], adds: [], required: true,
      note: "Required. Clearing it opens Gate D — the Veil Gate, and the DUSK reach." },
    { id: "P12", name: "The Forge Core", kind: "throne", at: { x: 23, y: 66 },
      requires: ["P13"], roster: ["pyro_nitro"], adds: [],
      note: "Optional. Where the first flame burns — Forged Tech's Mythic." },
  ],
};

export const REGIONS: StoryRegion[] = [LEAF, PYRO];

/** A region is reachable once every node gating it is cleared. */
export const isRegionOpen = (save: StorySave, r: StoryRegion): boolean =>
  (r.requires ?? []).every((id) => save.cleared.includes(id));

export const ALL_NODES: StoryNode[] = REGIONS.flatMap((r) => r.nodes);
export const nodeById = (id: string): StoryNode | undefined => ALL_NODES.find((n) => n.id === id);
export const regionOfNode = (id: string): StoryRegion | undefined =>
  REGIONS.find((r) => r.nodes.some((n) => n.id === id));

// ── the starter deck ────────────────────────────────────────────────────────
// Fixed and non-optional, handed over at Spring Village. All six classes, a
// bottom-heavy curve, and every card is a draftable Rare the player will meet
// again on a LEAF node — nothing in it is a dead end.

export const STARTER_DECK: string[] = [
  "leaf_oak", "leaf_python",           // Tank
  "leaf_birch", "leaf_cactus",         // Warrior
  "leaf_stickers", "leaf_sticks",      // Assassin
  "leaf_nettle", "leaf_leaf",          // Mage
  "leaf_stickviper", "leaf_hunter",    // Ranger
  "leaf_weeds", "leaf_walking_tree",   // Support
];

// ── deck cap ladder ─────────────────────────────────────────────────────────
// Every cap below a format's maximum is a CAMPAIGN restriction, not a rule
// change: 18 on 4x4 and 28 on 5x5 are legal everywhere else in the game. Story
// Mode is gating access to full-size list building, nothing more.

export const CAP_LADDER = [
  { cap: 12, board: 4, unlockedBy: null, label: "Starting deck" },
  { cap: 15, board: 4, unlockedBy: "L14", label: "LEAF Throne" },
  { cap: 18, board: 4, unlockedBy: "P13", label: "PYRO Throne" }, // 4x4 format max
] as const;

export function deckCapFor(cleared: readonly string[]): number {
  let cap: number = CAP_LADDER[0].cap;
  for (const step of CAP_LADDER)
    if (step.unlockedBy && cleared.includes(step.unlockedBy)) cap = Math.max(cap, step.cap);
  return cap;
}

// ── recruitment ─────────────────────────────────────────────────────────────

export const DROP_RATE: Record<string, number> = {
  mythic: 5, legendary: 15, epic: 30, rare: 50,
};
/** Each clear that drops nothing adds this much to that card's chance here. */
export const PITY_STEP = 5;

export const baseRateFor = (defId: string): number => DROP_RATE[getDef(defId).rarity ?? "rare"] ?? 50;

/** A card's live chance at a node, base + accumulated pity, clamped to 100.
 *  `overflow` halves the BASE only — pity still accrues at full step, so a
 *  border card is slower to get but never unreachable. */
export function recruitChance(defId: string, pity: number, overflow = false): number {
  const base = overflow ? baseRateFor(defId) * OVERFLOW_RATE : baseRateFor(defId);
  return Math.min(100, base + pity * PITY_STEP);
}

// ── the Blight (§10.4) ──────────────────────────────────────────────────────
// DUSK does not wait in its region; it spreads across territory you have
// already taken. The load-bearing constraint is that Blight ONLY touches
// CLEARED regions — difficulty rises behind you, never in front of you — which
// is what lets it be aggressive without ever blocking progress or spiking a
// first-time route.

export const BLIGHT_MAX = 3;

/** Non-recruitable DUSK filler joining Warden-tier and higher squads at level
 *  1-2. Deliberately the cheap end: the Blight is pressure, not a power spike,
 *  and only a Blight NODE ever drops DUSK cards. */
export const BLIGHT_ADDS = ["dusk_crow", "dusk_pumpkin", "dusk_spider", "dusk_zombie_husk"];

/** DUSK is the source and can never be Blighted; DAWN is sealed behind the
 *  Arctic Veil and is the one place the shadow cannot reach. */
export const canBlight = (region: StoryRegion): boolean =>
  region.element !== "DUSK" && region.element !== "DAWN";

/** A region's live Blight: whatever the world has pushed onto it, never below
 *  the baseline it shipped with, never above the cap. */
export function blightLevel(save: StorySave, region: StoryRegion): number {
  if (!canBlight(region)) return 0;
  const earned = save.blight?.[region.id] ?? 0;
  return Math.min(BLIGHT_MAX, Math.max(region.baseBlight ?? 0, earned));
}

/** Blight only reaches a region you have finished — its required Throne down. */
export function isRegionCleared(save: StorySave, region: StoryRegion): boolean {
  if (!canBlight(region)) return false;
  const req = region.nodes.filter((n) => n.required);
  return req.length > 0 && req.every((n) => save.cleared.includes(n.id));
}

/** How many DUSK bodies join this node's squad. Skirmishes are never Blighted —
 *  the pressure lands on Warden tier and up, so the region's easy nodes stay
 *  farmable at the difficulty they were designed for. */
export function blightAddsFor(save: StorySave, region: StoryRegion, node: StoryNode): string[] {
  if (!isRegionCleared(save, region)) return [];
  // A Blight Node is already a pure DUSK squad — adding shadow to shadow is
  // double-counting, not pressure.
  if (node.kind === "skirmish" || node.kind === "throne" || node.kind === "blight") return [];
  const lvl = blightLevel(save, region);
  return lvl <= 0 ? [] : BLIGHT_ADDS.slice(0, Math.min(lvl, 2));
}

/** At level 2 the region's own Field spell is contested by Nightfall. */
export const terrainContested = (save: StorySave, region: StoryRegion): boolean =>
  isRegionCleared(save, region) && blightLevel(save, region) >= 2;

/** Every Throne cleared anywhere pushes Blight into one cleared region. Rises on
 *  WORLD PROGRESS, never on idle time or turn count, so farming and exploring
 *  are never punished. */
export function advanceBlight(save: StorySave, clearedNode: StoryNode): StorySave {
  if (clearedNode.kind !== "throne") return save;
  const target = REGIONS.find(
    (r) => isRegionCleared(save, r) && blightLevel(save, r) < BLIGHT_MAX,
  );
  if (!target) return save;
  return { ...save, blight: { ...save.blight, [target.id]: (save.blight?.[target.id] ?? 0) + 1 } };
}

/** The full DUSK squad that occupies a region at Blight 3. These cards ALSO
 *  live in the Realm of Shadows — the one deliberate break in one-card-one-node,
 *  and the point of the whole system: pushing the shadow out is the only way to
 *  field DUSK before you reach it. */
export const BLIGHT_NODE_ROSTER = ["dusk_reaper", "dusk_plaguecrow", "dusk_gool"];

/** The Blight Node itself — a map marker that exists only while the region is at
 *  the cap. It is generated, not authored, so it can appear in any region that
 *  has a border zone. */
export function blightNodeFor(save: StorySave, region: StoryRegion): StoryNode | null {
  if (!region.blightAt || blightLevel(save, region) < BLIGHT_MAX) return null;
  return {
    id: `${region.id.toUpperCase()}-B`,
    name: `${region.name}: The Blight`,
    kind: "blight",
    roster: [...BLIGHT_NODE_ROSTER],
    adds: [],
    requires: [],
    at: region.blightAt,
    note: "A full DUSK squad holding ground you already took. Clearing it pushes the shadow back a level — and DUSK cards join you.",
  };
}

export const isBlightNode = (node: StoryNode): boolean => node.kind === "blight";

/** Clearing a Blight Node is the counter-play: the shadow drops a level. This is
 *  what makes the Blight a choice rather than a tax. */
export function pushBackBlight(save: StorySave, node: StoryNode): StorySave {
  if (!isBlightNode(node)) return save;
  const region = REGIONS.find((r) => node.id === `${r.id.toUpperCase()}-B`);
  if (!region) return save;
  // Floor at the region's OWN baseline — you can drive out what the world pushed
  // in, but the Rot Line was painted into the map and does not wash off.
  const floor = region.baseBlight ?? 0;
  const now = blightLevel(save, region);
  return { ...save, blight: { ...save.blight, [region.id]: Math.max(floor, now - 1) } };
}

// ── Elemental Overflow (§10.5) ──────────────────────────────────────────────

/** Overflow cards roll at HALF base — a taste of the neighbour, not a shortcut
 *  past walking there. The card's home node stays the reliable farm. */
export const OVERFLOW_RATE = 0.5;

export const isOverflow = (node: StoryNode, defId: string): boolean =>
  !!node.overflow?.includes(defId);

/** Everything a node can actually give you: its own roster plus any bleed. */
export const recruitablePool = (node: StoryNode): string[] => [...node.roster, ...(node.overflow ?? [])];

// ── save state ──────────────────────────────────────────────────────────────

export interface StorySave {
  /** Node ids cleared at least once. */
  cleared: string[];
  /** Card ids owned. Starts as the starter deck. */
  collection: string[];
  /** `${nodeId}:${defId}` -> dry clears since the last recruit of that card. */
  pity: Record<string, number>;
  /** The player's current story deck. */
  deck: string[];
  /** Region id -> Blight earned from world progress. The region's own baseline
   *  is applied on read, so it can never be saved away. */
  blight: Record<string, number>;
}

const STORAGE_KEY = "we_story_v1";

export function newSave(): StorySave {
  return { cleared: [], collection: [...STARTER_DECK], pity: {}, deck: [...STARTER_DECK], blight: {} };
}

/** Read the save, dropping anything that no longer exists — so removing a card
 *  or renaming a node can never brick a campaign the way it could a deck. */
export function loadStory(): StorySave {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return newSave();
    const p = JSON.parse(raw) as Partial<StorySave>;
    const known = (ids: unknown): string[] =>
      Array.isArray(ids) ? ids.filter((i): i is string => typeof i === "string" && !!CARD_INDEX[i]) : [];
    const collection = known(p.collection);
    const save: StorySave = {
      cleared: Array.isArray(p.cleared) ? p.cleared.filter((c) => typeof c === "string" && !!nodeById(c)) : [],
      collection: collection.length ? collection : [...STARTER_DECK],
      pity: p.pity && typeof p.pity === "object" ? (p.pity as Record<string, number>) : {},
      // A deck can only hold cards you own — a stale entry silently drops out.
      deck: known(p.deck).filter((id) => collection.includes(id)),
      blight: p.blight && typeof p.blight === "object" ? (p.blight as Record<string, number>) : {},
    };
    if (!save.deck.length) save.deck = save.collection.slice(0, deckCapFor(save.cleared));
    return save;
  } catch {
    return newSave();
  }
}

export function saveStory(save: StorySave): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(save));
  } catch {
    /* storage full or unavailable — the campaign stays in memory for the session */
  }
}

export function clearStory(): void {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}

// ── node availability ───────────────────────────────────────────────────────

export const isCleared = (save: StorySave, id: string): boolean => save.cleared.includes(id);

/** A node is open when its own prerequisites AND its region's gate are cleared.
 *  The region check matters because every region's entry node has no
 *  prerequisites of its own — without it, PYRO's P1 would read as open from the
 *  first turn of the campaign. */
export const isOpen = (save: StorySave, n: StoryNode): boolean => {
  const home = regionOfNode(n.id);
  if (home && !isRegionOpen(save, home)) return false;
  return n.requires.every((r) => save.cleared.includes(r));
};

// ── where do I get this card? ───────────────────────────────────────────────
// Pillar 3 is "you fight what you want to own" — which is only true if the
// collection can actually answer "so where is it?". These invert the placement
// data rather than duplicating it, so a node move can never desync the answer.

export interface CardSource {
  node: StoryNode;
  region: StoryRegion;
  /** True when this node only bleeds the card across a border at half odds. */
  overflow: boolean;
}

/** Every node that can recruit a card. Empty = it lives in a region that has
 *  not been built yet, which is a content gap, not a locked door. */
export function sourcesOf(defId: string): CardSource[] {
  const out: CardSource[] = [];
  for (const region of REGIONS)
    for (const node of region.nodes) {
      if (node.roster.includes(defId)) out.push({ node, region, overflow: false });
      else if (node.overflow?.includes(defId)) out.push({ node, region, overflow: true });
    }
  // Full-odds homes first: the answer to "where do I farm this" is never the
  // border node when a home node exists.
  return out.sort((a, b) => Number(a.overflow) - Number(b.overflow));
}

/** The best odds available for a card right now, and where. Null when the card
 *  is unplaced or every source is still locked. */
export function bestSource(save: StorySave, defId: string): CardSource | null {
  const open = sourcesOf(defId).filter((s) => isOpen(save, s.node));
  if (open.length === 0) return null;
  return open.reduce((best, s) =>
    recruitChance(defId, save.pity[`${s.node.id}:${defId}`] ?? 0, s.overflow) >
    recruitChance(defId, save.pity[`${best.node.id}:${defId}`] ?? 0, best.overflow) ? s : best,
  );
}

/** Everything placed anywhere — the denominator for "N of M collected". Counts
 *  cards, not placements, so an overflow copy never inflates the total. */
export const PLACED_CARDS: string[] = [...new Set(
  REGIONS.flatMap((r) => r.nodes.flatMap((n) => [...n.roster, ...(n.overflow ?? [])])),
)];

// ── the recruitment roll ────────────────────────────────────────────────────

export interface RecruitResult {
  /** Cards newly added to the collection. */
  won: string[];
  /** Cards that rolled and missed, with their pity now one step higher. */
  missed: string[];
  rolls: number;
}

/**
 * Roll recruitment for a cleared node.
 *
 * Rolls are earned by CAPTURE: a sloppy win that padlocks two slots gets two
 * rolls, a dominant win that padlocks five gets five. That makes the win
 * condition the collection engine rather than a separate reward table.
 *
 * A win by elimination padlocks nothing, so it would otherwise pay zero — it is
 * floored at one roll, since "you won and got nothing to even roll on" reads as
 * a bug however it is documented.
 *
 * Cards already owned do not roll. The eligible pool shrinks as you clear a
 * node repeatedly, so late runs are increasingly targeted at the one card you
 * still want — and duplicates can never occur.
 *
 * `rand` is injected so this is deterministic under test.
 */
export function rollRecruits(
  save: StorySave,
  node: StoryNode,
  capturedSlots: number,
  rand: () => number = Math.random,
): RecruitResult {
  const eligible = recruitablePool(node).filter((id) => !save.collection.includes(id));
  const rolls = Math.max(1, capturedSlots);
  const won: string[] = [];
  const missed: string[] = [];
  if (!eligible.length) return { won, missed, rolls };

  // A Throne's Mythic is a guaranteed recruit on first clear: no RNG on a
  // story-critical unlock.
  if (node.kind === "throne" && !isCleared(save, node.id)) {
    return { won: [...eligible], missed, rolls };
  }

  const pool = [...eligible];
  for (let i = 0; i < rolls && pool.length; i++) {
    const pick = pool[Math.floor(rand() * pool.length) % pool.length];
    const key = `${node.id}:${pick}`;
    if (rand() * 100 < recruitChance(pick, save.pity[key] ?? 0, isOverflow(node, pick))) {
      won.push(pick);
      pool.splice(pool.indexOf(pick), 1); // can't win the same card twice in one clear
    } else if (!missed.includes(pick)) {
      missed.push(pick);
    }
  }
  return { won, missed, rolls };
}

/** Fold a clear + its recruits into the save. Pure — returns a new save. */
export function applyClear(save: StorySave, node: StoryNode, result: RecruitResult): StorySave {
  const pity = { ...save.pity };
  for (const id of result.won) delete pity[`${node.id}:${id}`];
  for (const id of result.missed) {
    const key = `${node.id}:${id}`;
    pity[key] = (pity[key] ?? 0) + 1;
  }
  const next: StorySave = {
    // A Blight Node is never banked as "cleared" — it can come back, and a stale
    // tick would make the returning node render as already beaten.
    cleared: isBlightNode(node) || save.cleared.includes(node.id)
      ? save.cleared
      : [...save.cleared, node.id],
    collection: [...save.collection, ...result.won.filter((id) => !save.collection.includes(id))],
    pity,
    deck: save.deck,
    blight: save.blight ?? {},
  };
  // Blight is read AFTER the clear is banked, so finishing a region's Throne can
  // immediately push shadow into it.
  return advanceBlight(pushBackBlight(next, node), node);
}
