// Custom decks — a sandbox layer on top of the Cores. A deck is just a list of
// card ids (the engine's createInitialState already accepts string[]), so this
// never touches the Core pairing system. Persisted to localStorage so decks
// survive a reload. Browser-side only — safe to use Date.now here (this is not
// the deterministic engine reducer).

import { CARDS, CARD_INDEX } from "./cards";
import { isSpell, MAX_SPELLBOOK } from "../engine/spells";
import type { CardDef } from "../engine/types";

export const MIN_DECK = 12;
export const MAX_DECK = 20;
export const TARGET_DECK = 16;
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
}

export const PREMADE_DECKS: PremadeDeck[] = [
  {
    id: "pre_inferno_blitz",
    name: "Inferno Blitz",
    premade: true,
    // PYRO + BOLT — fast burn & shock aggression. Aggressive curve topping out
    // in Volcanon/Magmaw/Stormcaller (lege) into Pyrogon (myth).
    cards: [
      "bolt_zap", "bolt_electricel", "pyro_flamehound", "pyro_baboom", "pyro_firebird",
      "pyro_ember_scorpion", "bolt_zagphu", "bolt_lytning", "pyro_fenix", "bolt_thundercat",
      "pyro_sarra", "bolt_thunder", "pyro_volcanon", "pyro_magmaw", "bolt_stormcaller", "pyro_pyrogon",
    ],
    spells: ["pyro_spark", "bolt_zap", "pyro_firewall", "bolt_overload_field", "bolt_lightning_storm"],
  },
  {
    id: "pre_frostkeep",
    name: "Frostkeep",
    premade: true,
    // AQUA + BORE — tanky control that grinds you out. Ramps through Sandman/
    // Polarking/Glacius/Bastion (lege) into Kraken (myth). Frost Patch → Maelstrom
    // (2× vs FROZEN) is the payoff.
    cards: [
      "aqua_subcool", "bore_hillbilly", "aqua_bulletshrimp", "aqua_octoirate", "bore_rollo",
      "aqua_owlette", "bore_shift", "aqua_polarbear", "bore_rhe", "aqua_blackbeard",
      "aqua_sapphire", "bore_sandman", "aqua_polarking", "aqua_glacius", "bore_bastion", "aqua_kraken",
    ],
    spells: ["aqua_chill", "aqua_frost_patch", "bore_stone_wall", "bore_shatterpoint", "aqua_maelstrom"],
  },
  {
    id: "pre_radiant_host",
    name: "Radiant Host",
    premade: true,
    // DAWN + LEAF — heals & buffs behind a wall of bodies. Value engine through
    // Kosmos/Elderroot/Aurelion (lege) into Imperator (myth).
    cards: [
      "dawn_beam", "leaf_nettle", "leaf_guardian", "leaf_leaf", "dawn_star",
      "dawn_amble", "leaf_fallona", "leaf_dartfrog", "dawn_solstice", "leaf_citra",
      "leaf_sumerose", "dawn_clipsey", "dawn_kosmos", "leaf_elderroot", "dawn_aurelion", "dawn_imperator",
    ],
    spells: ["leaf_sprout", "dawn_cleansing_light", "dawn_radiant_barrier", "leaf_groves_blessing", "dawn_solar_flare"],
  },
  {
    id: "pre_nightfall",
    name: "Nightfall",
    premade: true,
    // DUSK + GALE — evasive assassins that hit and vanish. Tempo into Tempest/
    // Nightfang/Klipso (lege) and Shadow Horsemen (myth).
    cards: [
      "dusk_crow", "gale_duster", "gale_luna", "dusk_reaper", "dusk_silkstalker",
      "dusk_widowbite", "gale_hawk", "gale_vaga", "dusk_ghastly", "dusk_haunt",
      "gale_rayfen", "gale_wolfbane", "gale_tempest", "dusk_nightfang", "gale_klipso", "dusk_shadowhorsemen",
    ],
    spells: ["dusk_chill_touch", "gale_downdraft", "dusk_shadow_step", "dusk_veil_of_shadows", "dusk_soul_rend"],
  },
];

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
export function validateDeck(cards: string[]): DeckValidation {
  const unique = new Set(cards);
  if (unique.size !== cards.length) return { ok: false, reason: "Duplicate cards" };
  if (cards.some((id) => !isBuildable(id))) return { ok: false, reason: "Unknown card" };
  if (cards.length < MIN_DECK) return { ok: false, reason: `Need at least ${MIN_DECK} cards` };
  if (cards.length > MAX_DECK) return { ok: false, reason: `At most ${MAX_DECK} cards` };
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
