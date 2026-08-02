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

export type NodeKind = "skirmish" | "warden" | "landmark" | "throne";

export interface StoryNode {
  id: string;
  name: string;
  kind: NodeKind;
  /** Recruitable roster — the cards this node can actually give you. */
  roster: string[];
  /** Non-recruitable filler. Tokens where the element has them; never rollable. */
  adds: string[];
  /** Nodes that must be cleared before this one opens. Empty = open from the start. */
  requires: string[];
  /** A required Throne opens the region's borders; an optional one is a detour. */
  required?: boolean;
  note?: string;
  /** Grid position on the region map, in abstract units (col, row). */
  at: { x: number; y: number };
}

export interface StoryRegion {
  id: string;
  name: string;
  element: string;
  /** The Field spell that runs permanently on every node in the region. */
  terrain: string;
  board: number;
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
  nodes: [
    { id: "L1", name: "Spring Village Outskirts", kind: "skirmish", at: { x: 0, y: 3 },
      requires: [], roster: ["leaf_nettle", "leaf_weeds", "leaf_stickers"], adds: [],
      note: "The tutorial. Three Cost-1 Rares and a scripted first padlock." },
    { id: "L2", name: "Cherry Grove Path", kind: "skirmish", at: { x: 1, y: 2 },
      requires: ["L1"], roster: ["leaf_birch", "leaf_leaf", "leaf_cactus"], adds: [] },
    { id: "L3", name: "Bloomwardens' Ring", kind: "warden", at: { x: 2, y: 2 },
      requires: ["L2"], roster: ["leaf_sprinu", "leaf_splint", "leaf_fallona"], adds: ["leaf_acorn_tok"] },
    { id: "L4", name: "Evergreen Plains", kind: "skirmish", at: { x: 1, y: 4 },
      requires: ["L1"], roster: ["leaf_oak", "leaf_python", "leaf_sticks", "leaf_guardian"], adds: [] },
    { id: "L5", name: "Summer's Embrace Grove", kind: "warden", at: { x: 2, y: 4 },
      requires: ["L4"], roster: ["leaf_alpha", "leaf_dande", "leaf_squanch"], adds: ["leaf_acorn_tok"] },
    { id: "L6", name: "Jungle Wilds", kind: "warden", at: { x: 3, y: 4 },
      requires: ["L5"], roster: ["leaf_stickviper", "leaf_gecko", "leaf_dartfrog"], adds: ["leaf_reptilian_tok"],
      note: "The Reptile node — fight the tribe before the warlord who buffs it." },
    { id: "L7", name: "Rustling Woods", kind: "skirmish", at: { x: 1, y: 1 },
      requires: ["L2"], roster: ["leaf_greegon", "leaf_walking_tree", "leaf_hunter"], adds: [] },
    { id: "L8", name: "The Rot Line", kind: "warden", at: { x: 2, y: 1 },
      requires: ["L7"], roster: ["leaf_nightshade", "leaf_darth", "leaf_bark_bushmen"], adds: [],
      note: "The mid-forest spike. Where a starter deck stops working." },
    { id: "L9", name: "Winter's Reach Treeline", kind: "skirmish", at: { x: 1, y: 0 },
      requires: ["L7"], roster: ["leaf_lumberjack", "leaf_whintey", "leaf_sakuroot"], adds: [] },
    { id: "L10", name: "Winter Village Sentinels", kind: "warden", at: { x: 2, y: 0 },
      requires: ["L9"], roster: ["leaf_sumerose", "leaf_rubyo", "leaf_citra"], adds: [] },
    { id: "L11", name: "Heart of Nature: Outer Roots", kind: "landmark", at: { x: 3, y: 2 },
      requires: ["L3", "L8"], roster: ["leaf_season", "leaf_thorn", "leaf_elderroot"], adds: [],
      note: "Elderroot is the game's only melee Support." },
    { id: "L12", name: "Heart of Nature: The Spirit Tree", kind: "landmark", at: { x: 4, y: 2 },
      requires: ["L11"], roster: ["leaf_warden", "leaf_efy", "leaf_fallow"], adds: [] },
    { id: "L13", name: "Jungle Throne", kind: "throne", at: { x: 4, y: 4 },
      requires: ["L6", "L12"], roster: ["leaf_trinezer"], adds: ["leaf_reptilian_tok"],
      note: "Optional. An early skill check with a Mythic reward." },
    { id: "L14", name: "The Spirit Tree Rises", kind: "throne", at: { x: 5, y: 2 },
      requires: ["L12"], roster: ["leaf_oakgre"], adds: ["leaf_acorn_tok"], required: true,
      note: "Required. Clearing it opens the borders to PYRO and AQUA." },
  ],
};

export const REGIONS: StoryRegion[] = [LEAF];

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

/** A card's live chance at a node, base + accumulated pity, clamped to 100. */
export function recruitChance(defId: string, pity: number): number {
  return Math.min(100, baseRateFor(defId) + pity * PITY_STEP);
}

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
}

const STORAGE_KEY = "we_story_v1";

export function newSave(): StorySave {
  return { cleared: [], collection: [...STARTER_DECK], pity: {}, deck: [...STARTER_DECK] };
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
export const isOpen = (save: StorySave, n: StoryNode): boolean =>
  n.requires.every((r) => save.cleared.includes(r));

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
  const eligible = node.roster.filter((id) => !save.collection.includes(id));
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
    if (rand() * 100 < recruitChance(pick, save.pity[key] ?? 0)) {
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
  return {
    cleared: save.cleared.includes(node.id) ? save.cleared : [...save.cleared, node.id],
    collection: [...save.collection, ...result.won.filter((id) => !save.collection.includes(id))],
    pity,
    deck: save.deck,
  };
}
