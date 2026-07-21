// Custom decks — a sandbox layer on top of the Cores. A deck is just a list of
// card ids (the engine's createInitialState already accepts string[]), so this
// never touches the Core pairing system. Persisted to localStorage so decks
// survive a reload. Browser-side only — safe to use Date.now here (this is not
// the deterministic engine reducer).

import { CARDS, CARD_INDEX } from "./cards";
import { isSpell, MAX_SPELLBOOK } from "../engine/spells";
import type { CardDef } from "../engine/types";

/** Deck-size rules for one battlefield. The bigger board holds more cards, so
 *  it wants a deeper deck — 25 slots and a longer game against 16 and a short
 *  one. Spellbooks are unchanged (MAX_SPELLBOOK) at either size. */
export interface DeckLimits {
  min: number;
  max: number;
  target: number;
}
const DECK_LIMITS: Record<number, DeckLimits> = {
  4: { min: 12, max: 20, target: 18 },
  5: { min: 20, max: 30, target: 28 },
};
/** Limits for a board size; anything unrecognised falls back to the standard. */
export function deckLimits(boardSize = 4): DeckLimits {
  return DECK_LIMITS[boardSize] ?? DECK_LIMITS[4];
}

// Standard-board shorthands. Prefer deckLimits(boardSize) anywhere the mode is
// known — these are only the 4×4 numbers.
export const MIN_DECK = DECK_LIMITS[4].min;
export const MAX_DECK = DECK_LIMITS[4].max;
export const TARGET_DECK = DECK_LIMITS[4].target;
export const MAX_SPELLS = MAX_SPELLBOOK; // a deck's spellbook holds up to 5

const STORAGE_KEY = "we_custom_decks_v1";

export interface CustomDeck {
  id: string;
  name: string;
  cards: string[]; // card ids (deck-eligible, no tokens, deduped)
  spells?: string[]; // hand-picked spellbook (0–5 spell ids); absent = auto-from-elements
}

/** Sanitize a spellbook: keep only real, deduped spell ids, capped at MAX_SPELLS. */
export function sanitizeSpells(ids: string[] | undefined): string[] {
  if (!Array.isArray(ids)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    if (typeof id !== "string" || seen.has(id) || !isSpell(id)) continue;
    seen.add(id);
    out.push(id);
    if (out.length >= MAX_SPELLS) break;
  }
  return out;
}

/** Ready-to-play decks that ship with the game — curated dual-element builds
 *  (low-to-high curve, one Mythic finisher each). They surface in the pre-game
 *  picker alongside the Cores and any custom decks, and can't be edited/deleted
 *  (they live in code, not localStorage). `premade: true` marks them so the UI
 *  can label them and the delete-cleanup never drops their selection. */
export interface PremadeDeck extends CustomDeck {
  premade: true;
  /** Which battlefield this build is sized for. The picker only offers decks
   *  matching the selected mode, so a 28-card list never shows up for a 4×4. */
  boardSize: 4 | 5;
}

const STANDARD_DECKS: PremadeDeck[] = [
  {
    id: "pre_inferno_blitz",
    name: "Inferno Blitz",
    premade: true,
    boardSize: 4,
    // PYRO + BOLT — fast burn & shock aggression. Aggressive curve topping out
    // in Volcanon/Magmaw/Stormcaller (lege) into Pyrogon (myth).
    // Cut for the new arrivals: Electricel (1x4 into 3 HP — Zap already holds the
    // fragile 1-drop), Ember Scorpion (no ability at all), Zagphu and Sarra (the
    // 3 and 4 slots were six and four deep).
    cards: [
      "bolt_zap", "bolt_jolt", "pyro_flamehound", "pyro_baboom", "pyro_ash_boar",
      "bolt_jellyfish", "pyro_firebird", "bolt_lytning", "pyro_fenix", "pyro_sseerr",
      "bolt_thundercat", "bolt_thunder", "pyro_volcanon", "pyro_magmaw", "bolt_stormcaller",
      "pyro_pyrogon", "bolt_electricel", "bolt_drshock",
    ],
    // Spark out, Power Grid in. The deck now runs Jolt, whose whole job is
    // marking foes ELECTRIFIED — Power Grid turns that mark from +1 into +2 for
    // the entire BOLT side and discounts their Specials. Spark was also the
    // second of two Cost-1 damage spells alongside Zap.
    spells: ["bolt_zap", "pyro_firewall", "bolt_overload_field", "bolt_power_grid", "bolt_lightning_storm"],
  },
  {
    id: "pre_frostkeep",
    name: "Frostkeep",
    premade: true,
    boardSize: 4,
    // AQUA + BORE — tanky control that grinds you out. Ramps through Sandman/
    // Polarking/Glacius/Bastion (lege) into Kraken (myth). Frost Patch → Maelstrom
    // (2× vs FROZEN) is the payoff.
    // Cut: Bullet Shrimp (12 DMG on 1 HP — dies to anything, and Piranha now
    // covers that slot), Rollo and Sapphire (plain bodies in crowded slots), and
    // Bastion — with Polar King, Sandman, Glacius and Kraken the 6+ end was five
    // deep in a sixteen-card deck.
    cards: [
      "bore_hillbilly", "aqua_piranha", "aqua_subcool", "aqua_kinguin", "aqua_octoirate",
      "aqua_owlette", "bore_shift", "aqua_blackbeard", "bore_monger", "aqua_polarbear",
      "bore_rhe", "bore_obsidi", "aqua_polarking", "bore_sandman", "aqua_glacius",
      "aqua_kraken", "bore_armadillo", "bore_krysteel",
    ],
    spells: ["aqua_chill", "aqua_frost_patch", "bore_stone_wall", "bore_shatterpoint", "aqua_maelstrom"],
  },
  {
    id: "pre_radiant_host",
    name: "Radiant Host",
    premade: true,
    boardSize: 4,
    // DAWN + LEAF — heals & buffs behind a wall of bodies. Value engine through
    // Kosmos/Elderroot/Aurelion (lege) into Imperator (myth).
    // Cut: Nettle, Star and Fallona (the 3 slot ran six deep), and Kosmos to
    // thin a top end that was five cards at 6+. Lands 8 DAWN / 8 LEAF.
    cards: [
      "dawn_beam", "leaf_guardian", "leaf_leaf", "dawn_shine", "dawn_amble",
      "leaf_dartfrog", "dawn_goldeneagle", "leaf_sprinu", "leaf_citra", "dawn_solstice",
      "leaf_sumerose", "dawn_clipsey", "leaf_elderroot", "dawn_aurelion", "leaf_fallow",
      "dawn_imperator", "leaf_nettle", "dawn_star",
    ],
    // Radiant Barrier out, Bramble Wall in — same cost, same slot, but ROOT now
    // has two payoffs in this deck: Fallow's Trapper hits every ROOTed opponent
    // at end of round, and Sprout already heals 5 instead of 3 while any
    // opponent is ROOTed.
    spells: ["leaf_sprout", "dawn_cleansing_light", "leaf_bramble_wall", "leaf_groves_blessing", "dawn_solar_flare"],
  },
  {
    id: "pre_nightfall",
    name: "Nightfall",
    premade: true,
    boardSize: 4,
    // DUSK + GALE — evasive assassins that hit and vanish. Tempo into Tempest/
    // Nightfang/Klipso (lege) and Shadow Horsemen (myth).
    // Cut: Crow (3 DMG on 1 HP), Silkstalker and Rayfen (crowded 3 and 4 slots),
    // and Tempest to thin a five-card 6+ top. Lands 8 DUSK / 8 GALE.
    cards: [
      "gale_duster", "gale_luna", "gale_tumbleweed", "gale_hawk", "dusk_reaper",
      "gale_vaga", "dusk_widowbite", "gale_windsor", "dusk_ghastly", "dusk_haunt",
      "dusk_wedded_wraith", "gale_wolfbane", "dusk_ravven", "gale_klipso", "dusk_nightfang",
      "dusk_shadowhorsemen", "gale_rayfen", "dusk_silkstalker",
    ],
    // Shadow Step out, Nightfall in — the deck finally runs its namesake. Wedded
    // Wraith floods the board with Specters, so cloaking the whole DUSK side
    // beats cloaking one card, and it covers Ravven everywhere instead of only
    // on enemy ground where its own EVASION lives.
    spells: ["dusk_chill_touch", "gale_downdraft", "dusk_veil_of_shadows", "dusk_nightfall", "dusk_phantom_spikes"],
  },
];

/** The ten cards each standard deck gains on the large board, keyed by its id.
 *  Five per element so every build stays an even 14/14, and deliberately
 *  bottom-heavy: a 28-card deck draws the same one-per-round, so padding the
 *  top would just mean more dead openers. Each list is drawn from that deck's
 *  own two elements. */
const LARGE_EXTRAS: Record<string, string[]> = {
  // +5 BOLT / +5 PYRO, all 1–4 cost — the deck is an aggro shell and wants
  // early bodies, not a second wave of finishers.
  pre_inferno_blitz: [
    "bolt_twotales", "bolt_kore", "bolt_buzz", "bolt_static", "bolt_webster",
    "pyro_smog_card", "pyro_bbq", "pyro_ingit", "pyro_spitfire", "pyro_fenrir",
  ],
  // +6 BORE / +4 AQUA — evens the 8/10 split the standard build carries.
  // Nothing above 5: it already tops out at 6,6,7,10.
  pre_frostkeep: [
    "bore_cavedweller", "bore_crock", "bore_clubber", "bore_smith", "bore_rockgoblin",
    "bore_rollo", "aqua_icyninza", "aqua_krakler", "aqua_bahari", "aqua_vaporem",
  ],
  // +5 DAWN / +5 LEAF — more bodies to hide the healers behind, which is the
  // deck's whole plan.
  pre_radiant_host: [
    "dawn_sphere", "dawn_glime", "dawn_musk_ox", "dawn_lazor", "dawn_veil",
    "leaf_stickviper", "leaf_cactus", "leaf_greegon", "leaf_alpha", "leaf_squanch",
  ],
  // +5 GALE / +5 DUSK — cheap evasive tempo, in keeping with the shell.
  pre_nightfall: [
    "gale_skyforce", "gale_toxhawk", "gale_whirlwolf", "gale_hawko", "gale_guan",
    "dusk_vamp", "dusk_spider", "dusk_skeleton_knight", "dusk_gool", "dusk_scarlett",
  ],
};

/** The large-board build of a standard deck: the same shell plus its extras.
 *  Derived rather than written out again, so editing a standard list can't
 *  leave its 5×5 twin behind. */
function largeVariant(base: PremadeDeck): PremadeDeck {
  return {
    ...base,
    id: `${base.id}_5`,
    boardSize: 5,
    cards: [...base.cards, ...(LARGE_EXTRAS[base.id] ?? [])],
  };
}

export const PREMADE_DECKS: PremadeDeck[] = [
  ...STANDARD_DECKS,
  ...STANDARD_DECKS.map(largeVariant),
];

/** The premade builds sized for a given battlefield. */
export function premadeDecksFor(boardSize: number): PremadeDeck[] {
  return PREMADE_DECKS.filter((d) => d.boardSize === (boardSize === 5 ? 5 : 4));
}

/** Every card a player may put in a deck — the real CARDS list (tokens are
 *  excluded from CARDS by construction, so they can never be built with). */
export function buildableCards(): CardDef[] {
  return CARDS;
}

/** Is `id` a real, deck-eligible card (in CARDS, not a token)? */
export function isBuildable(id: string): boolean {
  return CARDS.some((c) => c.id === id);
}

export interface DeckValidation {
  ok: boolean;
  reason?: string;
}

/** A deck is valid when it's 12–20 unique, buildable cards. */
export function validateDeck(cards: string[], boardSize = 4): DeckValidation {
  const { min, max } = deckLimits(boardSize);
  const unique = new Set(cards);
  if (unique.size !== cards.length) return { ok: false, reason: "Duplicate cards" };
  if (cards.some((id) => !isBuildable(id))) return { ok: false, reason: "Unknown card" };
  if (cards.length < min) return { ok: false, reason: `Need at least ${min} cards` };
  if (cards.length > max) return { ok: false, reason: `At most ${max} cards` };
  return { ok: true };
}

/** Read all saved decks, dropping any that reference cards that no longer exist
 *  (so removing a card from the game can't brick the picker). */
export function loadCustomDecks(): CustomDeck[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CustomDeck[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((d) => d && typeof d.id === "string" && typeof d.name === "string" && Array.isArray(d.cards))
      .map((d) => ({
        ...d,
        cards: d.cards.filter((id) => CARD_INDEX[id] && isBuildable(id)),
        spells: sanitizeSpells(d.spells),
      }));
  } catch {
    return [];
  }
}

function persist(decks: CustomDeck[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(decks));
  } catch {
    /* storage full / unavailable — decks stay in-memory for the session */
  }
}

let idCounter = 0;
function newDeckId(): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  return uuid ?? `deck_${Date.now()}_${idCounter++}`;
}

/** Insert or update a deck (matched by id). Returns the updated list. */
export function saveCustomDeck(deck: { id?: string; name: string; cards: string[]; spells?: string[] }): CustomDeck[] {
  const decks = loadCustomDecks();
  const id = deck.id ?? newDeckId();
  const entry: CustomDeck = {
    id,
    name: deck.name.trim() || "Untitled deck",
    cards: deck.cards.slice(),
    spells: sanitizeSpells(deck.spells),
  };
  const idx = decks.findIndex((d) => d.id === id);
  if (idx >= 0) decks[idx] = entry;
  else decks.push(entry);
  persist(decks);
  return decks;
}

export function deleteCustomDeck(id: string): CustomDeck[] {
  const decks = loadCustomDecks().filter((d) => d.id !== id);
  persist(decks);
  return decks;
}

/** Look up a saved deck's cards by id (empty if missing). */
export function customDeckCards(id: string): string[] {
  return loadCustomDecks().find((d) => d.id === id)?.cards.slice() ?? [];
}
