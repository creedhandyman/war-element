// Custom decks — a sandbox layer on top of the Cores. A deck is just a list of
// card ids (the engine's createInitialState already accepts string[]), so this
// never touches the Core pairing system. Persisted to localStorage so decks
// survive a reload. Browser-side only — safe to use Date.now here (this is not
// the deterministic engine reducer).

import { CARDS, CARD_INDEX } from "./cards";
import { isSpell, MAX_SPELLBOOK, MAX_SPELLBOOK_LARGE } from "../engine/spells";
import type { CardDef } from "../engine/types";

/** Deck-size rules for one battlefield. The bigger board holds more cards, so
 *  it wants a deeper deck — 25 slots and a longer game against 16 and a short
 *  one — AND a deeper spellbook (8 against the standard 5).
 *
 *  These are EXACT sizes, not a band: 4x4 is eighteen cards and 5x5 is thirty,
 *  no more and no less. `min`, `max` and `target` are all the same number and
 *  the three fields are kept only because every caller reads them by name.
 *  They used to be ranges (12-20 and 20-30) with a target inside, which meant
 *  two decks in the same format could differ by eight cards and the shorter one
 *  simply drew its best card more often — consistency IS the format. */
export interface DeckLimits {
  min: number;
  max: number;
  target: number;
  /** Spellbook cap for this battlefield. */
  spells: number;
}
const DECK_LIMITS: Record<number, DeckLimits> = {
  4: { min: 18, max: 18, target: 18, spells: MAX_SPELLBOOK },
  5: { min: 30, max: 30, target: 30, spells: MAX_SPELLBOOK_LARGE },
};
/** The one number a board's deck must be. Prefer this where the old code said
 *  `target` or `max` and meant "the size". */
export const deckSizeFor = (boardSize = 4): number => deckLimits(boardSize).target;
/** Limits for a board size; anything unrecognised falls back to the standard. */
export function deckLimits(boardSize = 4): DeckLimits {
  return DECK_LIMITS[boardSize] ?? DECK_LIMITS[4];
}
/** Spellbook cap for a battlefield — 5 on the standard board, 8 on the large one. */
export function maxSpellsFor(boardSize = 4): number {
  return deckLimits(boardSize).spells;
}

// Standard-board shorthands. Prefer deckLimits(boardSize) anywhere the mode is
// known — these are only the 4×4 numbers.
export const MIN_DECK = DECK_LIMITS[4].min;
export const MAX_DECK = DECK_LIMITS[4].max;
export const TARGET_DECK = DECK_LIMITS[4].target;
export const MAX_SPELLS = MAX_SPELLBOOK; // standard-board spellbook cap (5)

const STORAGE_KEY = "we_custom_decks_v1";

export interface CustomDeck {
  id: string;
  name: string;
  cards: string[]; // card ids (deck-eligible, no tokens, deduped)
  spells?: string[]; // hand-picked spellbook (0–5 spell ids); absent = auto-from-elements
}

/** Sanitize a spellbook: keep only real, deduped spell ids, capped for the board.
 *  The cap is board-size aware (5 standard / 8 large) — a flat 5 here silently
 *  truncated a legal large-board book of 8 back down on every load. */
export function sanitizeSpells(ids: string[] | undefined, boardSize = 5): string[] {
  if (!Array.isArray(ids)) return [];
  const cap = maxSpellsFor(boardSize);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    if (typeof id !== "string" || seen.has(id) || !isSpell(id)) continue;
    seen.add(id);
    out.push(id);
    if (out.length >= cap) break;
  }
  return out;
}

/** Ready-to-play decks that ship with the game — curated dual-element builds
 *  (low-to-high curve, one Mythic finisher each). They surface in the pre-game
 *  picker alongside the Cores and any custom decks, and can't be edited/deleted
 *  (they live in code, not localStorage). `premade: true` marks them so the UI
 *  can label them and the delete-cleanup never drops their selection. */
/** Matchmaker rungs. See `PremadeDeck.tier`. */
export type DeckTier = "easy" | "mid" | "hard";
export const DECK_TIERS: readonly DeckTier[] = ["easy", "mid", "hard"];

export interface PremadeDeck extends CustomDeck {
  premade: true;
  /** How hard this deck is to beat, for the Arena's matchmaker.
   *
   *  Difficulty is a property of the DECK, not of the opponent, because the
   *  opponent does not have a skill dial: `chooseBattleAction` is one rule set
   *  and it plays the same way behind every list. So the tiers are built out
   *  of the two things that actually change how hard a game is —
   *
   *    RARITY, which gates ability density. A repeatable Special requires
   *    epic-or-above and a Rare gets a one-shot Talent instead, so an
   *    all-rare deck has materially fewer things it can do to you.
   *    COST, and through it the stat budget (`5*cost + 10`). Cheap bodies are
   *    efficient per gold and small in absolute terms, so a board of 2-drops
   *    loses trades to a 7-drop however well it is played.
   *
   *  easy is rares only under a cost-5 cap (avg cost ~2.0); mid is
   *  rare/epic/legendary under 8 (~3.3); hard is epic-and-up with no cap
   *  (~5.0). Absent = untiered, which is how the six originals ship: they are
   *  hand-tuned archetypes rather than rungs on a ladder, and the matchmaker
   *  leaves them out rather than guessing where they sit. */
  tier?: DeckTier;
  /** One line on what this deck is trying to do, in the game's own voice.
   *
   *  Lifted out of the comment that already sat above every list — the best
   *  copy in this file, and it was never shown to a player. The deck picker
   *  reads it, so a row explains itself instead of being a name and a count. */
  note: string;
  /** Which battlefield this build is sized for. The picker only offers decks
   *  matching the selected mode, so a 30-card list never shows up for a 4×4. */
  boardSize: 4 | 5;
}

const STANDARD_DECKS: PremadeDeck[] = [
  {
    id: "pre_inferno_blitz",
    note: "PYRO + BOLT — fast burn and shock aggression.",
    name: "Inferno Blitz",
    premade: true,
    boardSize: 4,
    // PYRO + BOLT — fast burn & shock aggression. Aggressive curve topping out
    // in Volcanon/Magmaw/Stormcaller (lege) into Pyrogon (myth).
    // Cut for the new arrivals: Electricel (1x4 into 3 HP — Zap already holds the
    // fragile 1-drop), Ember Scorpion (no ability at all), Ricochet and Sarra (the
    // 3 and 4 slots were six and four deep).
    // Refresh: dropped bolt_electricel (a 1×4 on 3 HP that measured ~0 impact)
    // and pyro_baboom (rarely reached the board) for two on-theme cheap cards —
    // Stingray PENs an ELECTRIFIED foe (feeds the Jolt/Electrify plan), Staph
    // BURNs on summon.
    cards: [
      "bolt_zap", "bolt_jolt", "pyro_flamehound", "pyro_staph", "pyro_ash_boar",
      "bolt_jellyfish", "pyro_firebird", "bolt_lytning", "pyro_fenix", "pyro_sseerr",
      "bolt_thundercat", "bolt_thunder", "pyro_volcanon", "pyro_sarra", "bolt_shoksa",
      "pyro_pyrogon", "bolt_stingray", "bolt_drshock",
    ],
    // Spellbook reworked for the capture race: aggro was losing by round-7
    // capture (a tanky body parked on its home). This book clears invaders and
    // defends the home instead of buffing — Flare Push (4 PEN + shove it off the
    // slot), Ember Trap (punish the move-in), Overload Field (a PARALYZE wall),
    // Zap (PARALYZE removal), Lightning Storm (an 8-to-all + PARALYZE reset).
    // Out: the value field (Power Grid) and the redundant second wall (Firewall).
    spells: ["bolt_zap", "pyro_flare_push", "pyro_ember_trap", "bolt_overload_field", "bolt_lightning_storm"],
  },
  {
    id: "pre_frostkeep",
    note: "AQUA + BORE — tanky control that grinds you out.",
    name: "Frostkeep",
    premade: true,
    boardSize: 4,
    // AQUA + BORE — tanky control that grinds you out. Ramps through Dunewraith/
    // Polarking/Glacius/Bastion (lege) into Kraken (myth). Frost Patch → Maelstrom
    // (2× vs FROZEN) is the payoff.
    // Cut: Bullet Shrimp (12 DMG on 1 HP — dies to anything, and Piranha now
    // covers that slot), Rumbler and Sapphire (plain bodies in crowded slots), and
    // Bastion — with Polar King, Dunewraith, Glacius and Kraken the 6+ end was five
    // deep in a sixteen-card deck.
    // Refresh: dropped aqua_piranha (appeared constantly, measured ~0 impact) and
    // bore_armadillo (rarely reached the board) for Misty (Fog utility) and
    // Cragrider — a ranged 7 that gives the grind deck a backline poke it lacked.
    cards: [
      "bore_hillbilly", "aqua_misty", "aqua_subcool", "aqua_kinguin", "aqua_octoirate",
      "aqua_owlette", "bore_shift", "aqua_blackbeard", "bore_monger", "aqua_polarbear",
      "bore_rhe", "bore_obsidi", "aqua_polarking", "bore_sandman", "aqua_tide",
      "aqua_anglerfish", "bore_rohojohn", "bore_krysteel",
    ],
    spells: ["aqua_chill", "aqua_frost_patch", "bore_stone_wall", "bore_shatterpoint", "aqua_maelstrom"],
  },
  {
    id: "pre_radiant_host",
    note: "DAWN + LEAF — heals and buffs behind a wall of bodies.",
    name: "Radiant Host",
    premade: true,
    boardSize: 4,
    // DAWN + LEAF — heals & buffs behind a wall of bodies. Value engine through
    // Kosmos/Elderroot/Reveille (lege) into Imperator (myth).
    // Cut: Nettle, Star and Autumnal (the 3 slot ran six deep), and Kosmos to
    // thin a top end that was five cards at 6+. Lands 8 DAWN / 8 LEAF.
    // Refresh: dropped leaf_nettle and dawn_shine (both low-impact) for Birch
    // (a KILL flows into a 4×1 volley — recent) and Drakonbane, a real assassin
    // threat. (Birch not Stickviper here: Stickviper is already in this deck's
    // 5×5 extras, and adding it to the base would duplicate it there.)
    cards: [
      "dawn_beam", "leaf_splint", "leaf_leaf", "dawn_drakonbane", "dawn_amble",
      "leaf_dartfrog", "dawn_solara", "leaf_sprinu", "leaf_citra", "dawn_solstice",
      "leaf_sumerose", "dawn_clipsey", "leaf_elderroot", "dawn_aurelion", "leaf_fallow",
      "dawn_imperator", "leaf_fallona", "dawn_star",
    ],
    // Radiant Barrier out, Bramble Wall in — same cost, same slot, but ROOT now
    // has two payoffs in this deck: Fallow's Trapper hits every ROOTed opponent
    // at end of round, and Sprout already heals 5 instead of 3 while any
    // opponent is ROOTed.
    spells: ["leaf_sprout", "dawn_cleansing_light", "leaf_bramble_wall", "leaf_groves_blessing", "dawn_solar_flare"],
  },
  {
    id: "pre_nightfall",
    note: "DUSK + GALE — evasive assassins that hit and vanish.",
    name: "Nightfall",
    premade: true,
    boardSize: 4,
    // DUSK + GALE — evasive assassins that hit and vanish. Tempo into Tempest/
    // Nightfang/Klipso (lege) and Shadow Horsemen (myth).
    // Cut: Crow (3 DMG on 1 HP), Silkstalker and Rayfen (crowded 3 and 4 slots),
    // and Tempest to thin a five-card 6+ top. Lands 8 DUSK / 8 GALE.
    // Refresh: dropped gale_duster (~0 impact) and dusk_widowbite (low impact)
    // for Sirocco (Windfist knockback — recent) and SkullDrake, a ranged 7 that
    // gives the DUSK side a backline punch.
    cards: [
      "gale_sirocco", "gale_luna", "gale_tumbleweed", "gale_hawk", "dusk_reaper",
      "gale_vaga", "dusk_skulldrake", "gale_klouy", "dusk_ghastly", "dusk_haunt",
      "dusk_wedded_wraith", "gale_wolfbane", "dusk_ravven", "gale_omega", "dusk_nightfang",
      "dusk_shadowhorsemen", "gale_masala", "dusk_gravekeeper",
    ],
    // Shadow Step out, Nightfall in — the deck finally runs its namesake. Wedded
    // Wraith floods the board with Specters, so cloaking the whole DUSK side
    // beats cloaking one card, and it covers Ravven everywhere instead of only
    // on enemy ground where its own EVASION lives.
    // Spellbook reworked for the capture race (same problem as Inferno). GALE's
    // push is the answer: Gust shoves an invader off the home slot, Squall Line
    // is a push-wall on the home row. Bone Snare traps the move-in (FRIGHTEN),
    // Chill Touch is cheap removal, and Wake of the Dead (3-to-all, and kills
    // rise as Risen under your control) both clears invaders AND hands the deck
    // the bodies it needs to contest home. Out: the value field (Nightfall), the
    // soft WEAKEN (Downdraft), and Phantom Spikes.
    spells: ["gale_gust", "dusk_chill_touch", "dusk_bone_snare", "gale_squall_line", "dusk_wake_of_the_dead"],
  },
  {
    id: "pre_tempest",
    note: "AQUA + GALE + BOLT — three-element lockdown.",
    name: "Tempest",
    premade: true,
    boardSize: 4,
    // AQUA + GALE + BOLT — a three-element LOCKDOWN deck. Freeze (AQUA), knock-
    // back/stun (GALE) and paralyze/electrify (BOLT) stack disruption until the
    // board can't act, then Stormcaller/Glacius (lege) and Kraken (myth) close.
    // 6 of each element keeps every aura live on a third of the deck.
    // Rebuilt: the first cut ran TEN vanilla rares and five cards at 6+, so it
    // could neither trade early nor reliably deploy its finishers (35% measured).
    // Now 6 AQUA / 6 GALE / 6 BOLT, almost all carrying a Special, on a curve
    // that tops out at one 7 and the Kraken.
    cards: [
      "aqua_subcool", "aqua_kinguin", "gale_tumbleweed", "aqua_octoirate", "gale_vaga",
      "gale_angale", "bolt_zagphu", "bolt_lytning", "aqua_cryo", "gale_masala",
      "bolt_thundercat", "bolt_sentry", "bolt_striik", "gale_wista", "bolt_general",
      "aqua_polarking", "gale_klipso", "aqua_kraken",
    ],
    // Control package: Chill + Frost Patch set up FREEZE, Gust shoves invaders
    // off the home slot, Overload Field is a PARALYZE wall, Lightning Storm is an
    // 8-to-all reset. All three elements are represented.
    spells: ["aqua_chill", "aqua_frost_patch", "gale_gust", "bolt_overload_field", "bolt_lightning_storm"],
  },
  {
    id: "pre_blight",
    note: "LEAF + PYRO + DUSK — three-element attrition.",
    name: "Blight",
    premade: true,
    boardSize: 4,
    // LEAF + PYRO + DUSK — a three-element ATTRITION deck. BLEED (LEAF), BURN
    // (PYRO) and DRAIN/death (DUSK) grind HP from every angle while lifesteal
    // (Estival) and Transfusion keep the front line alive. Magmaw/Nightfang
    // (lege) top it. 6 of each element.
    cards: [
      "leaf_stickviper", "pyro_staph", "dusk_silkstalker", "leaf_dartfrog", "pyro_scully",
      "dusk_reaper", "leaf_greegon", "pyro_spitfire", "dusk_ghastly", "leaf_citra",
      "pyro_firebird", "dusk_haunt", "leaf_sumerose", "pyro_fenrir", "dusk_wedded_wraith",
      "leaf_elderroot", "pyro_magmaw", "dusk_nightfang",
    ],
    // Rot package: Ember Trap punishes the move-in with BURN, Chill Touch + Bone
    // Snare are cheap DUSK removal/traps, Wake of the Dead is a 3-to-all that
    // raises the fallen under your control, Bramble Wall gates the row.
    spells: ["pyro_ember_trap", "dusk_chill_touch", "dusk_bone_snare", "dusk_wake_of_the_dead", "leaf_bramble_wall"],
  },

  // ── THE MATCHMAKER LADDER ────────────────────────────────────────────────
  // Twelve decks in three rungs of four, built to be picked FOR you by
  // difficulty rather than chosen by name. Element pairings are all ones the
  // six originals do not use, so the ladder reads as new opponents rather
  // than reskins. DAWN is absent from `easy` on purpose: it has only 13
  // buildable rares under that tier's cost cap and an easy deck needs 15 per
  // element — the one place the pool could not supply the design.
  {
    id: "pre_sapling_creek",
    name: "Sapling Creek",
    note: "LEAF + AQUA — cheap bodies and small heals. A gentle first opponent.",
    premade: true,
    boardSize: 4,
    tier: "easy",
    cards: [
      "leaf_birch", "leaf_nettle", "leaf_stickers", "leaf_cactus", "leaf_leaf",
      "leaf_oak", "leaf_gecko", "leaf_greegon", "leaf_guardian", "aqua_blub",
      "aqua_buccaneers", "aqua_misty", "aqua_arctik", "aqua_bulletshrimp", "aqua_harp",
      "aqua_coralgolem", "aqua_krakler", "aqua_siphon",
    ],
    spells: ["leaf_sprout", "leaf_thorn_patch", "leaf_snare", "leaf_bramble_wall", "leaf_groves_blessing"],
  },
  {
    id: "pre_dust_patrol",
    name: "Dust Patrol",
    note: "BORE + GALE — slow shields and light skirmishers. Nothing that surprises you.",
    premade: true,
    boardSize: 4,
    tier: "easy",
    cards: [
      "bore_cavedweller", "bore_crock", "bore_hillbilly", "bore_clubber", "bore_old_timer",
      "bore_smith", "bore_armadillo", "bore_rock", "bore_stone", "gale_gastly",
      "gale_hawko", "gale_skyforce", "gale_megair", "gale_stormhide_bison", "gale_toxhawk",
      "gale_klouy", "gale_luna", "gale_wailverine",
    ],
    spells: ["gale_gust", "gale_downdraft", "bore_bulwark", "gale_squall_line", "bore_fortify"],
  },
  {
    id: "pre_ember_wake",
    name: "Ember Wake",
    note: "PYRO + DUSK — chip damage that trades and dies. Short reach.",
    premade: true,
    boardSize: 4,
    tier: "easy",
    cards: [
      "pyro_bbq", "pyro_canister", "pyro_ingit", "pyro_flamehound", "pyro_heatsink_golem",
      "pyro_smog_card", "pyro_dyna", "pyro_ember_scorpion", "pyro_slag_tortoise", "dusk_crow",
      "dusk_vamp", "dusk_zombie_husk", "dusk_harve", "dusk_jackl", "dusk_skeleton_knight",
      "dusk_scarlett", "dusk_skulldrake", "dusk_soul_wisp",
    ],
    spells: ["pyro_spark", "pyro_ember_trap", "dusk_shadow_step", "pyro_firewall", "pyro_ashfall"],
  },
  {
    id: "pre_static_shallows",
    name: "Static Shallows",
    note: "BOLT + AQUA — sparks and shallow water. Slow to close a game.",
    premade: true,
    boardSize: 4,
    tier: "easy",
    cards: [
      "bolt_junker", "bolt_rodd", "bolt_stingray", "bolt_zipp", "bolt_drshock",
      "bolt_electricel", "bolt_scrapper", "bolt_staticcloud", "bolt_buzz", "aqua_blub",
      "aqua_buccaneers", "aqua_misty", "aqua_arctik", "aqua_bootlegger", "aqua_bulletshrimp",
      "aqua_coralgolem", "aqua_krakler", "aqua_siphon",
    ],
    spells: ["aqua_chill", "aqua_frost_patch", "aqua_steam_vent", "aqua_ice_wall", "bolt_power_rebate"],
  },
  {
    id: "pre_tidal_gate",
    name: "Tidal Gate",
    note: "AQUA + DAWN — freeze it, then heal through whatever is left.",
    premade: true,
    boardSize: 4,
    tier: "mid",
    cards: [
      "aqua_blub", "aqua_piranha", "aqua_arctik", "aqua_icyninza", "aqua_blackice",
      "aqua_octoirate", "aqua_cryo", "aqua_polarbear", "aqua_blackbeard", "dawn_able",
      "dawn_beam", "dawn_roy", "dawn_golde", "dawn_goldeneagle", "dawn_musk_ox",
      "dawn_veil", "dawn_aurora", "dawn_heir_tok",
    ],
    spells: ["dawn_sunbeam", "aqua_frost_patch", "aqua_ice_wall", "dawn_dawns_grace", "dawn_judgment"],
  },
  {
    id: "pre_emberforge",
    name: "Emberforge",
    note: "PYRO + BORE — burn from behind a wall that does not move.",
    premade: true,
    boardSize: 4,
    tier: "mid",
    cards: [
      "pyro_bbq", "pyro_ingit", "pyro_staph", "pyro_smog_card", "pyro_ember_scorpion",
      "pyro_liza", "pyro_woof", "pyro_tiki", "pyro_fenrir", "bore_crock",
      "bore_iron", "bore_old_timer", "bore_ankylosaur", "bore_ufo", "bore_warthog",
      "bore_sheish", "bore_diam", "bore_prism",
    ],
    spells: ["pyro_spark", "bore_sand_trap", "pyro_firewall", "bore_fortify", "bore_shatterpoint"],
  },
  {
    id: "pre_thornwind",
    name: "Thornwind",
    note: "LEAF + GALE — bleed and evasion, winning the long turn.",
    premade: true,
    boardSize: 4,
    tier: "mid",
    cards: [
      "leaf_birch", "leaf_nettle", "leaf_stickers", "leaf_sticks", "leaf_bark_bushmen",
      "leaf_dartfrog", "leaf_walking_tree", "leaf_darth", "leaf_rubyo", "gale_gastly",
      "gale_hawko", "gale_skyforce", "gale_klouy", "gale_sway", "gale_vaga",
      "gale_vvulture", "gale_omega", "gale_eagon",
    ],
    spells: ["leaf_sprout", "leaf_thorn_patch", "leaf_bramble_wall", "leaf_groves_blessing", "gale_vortex_strike"],
  },
  {
    id: "pre_nightcircuit",
    name: "Nightcircuit",
    note: "DUSK + BOLT — status on everything, then take the empty slots.",
    premade: true,
    boardSize: 4,
    tier: "mid",
    cards: [
      "dusk_crow", "dusk_pumpkin", "dusk_spider", "dusk_skeleton_knight", "dusk_hix",
      "dusk_silkstalker", "dusk_ghastly", "dusk_sarachnid", "dusk_brute", "bolt_rodd",
      "bolt_twotales", "bolt_zap", "bolt_buzzard", "bolt_jellyfish", "bolt_static",
      "bolt_thundercat", "bolt_volta", "bolt_jack_arc",
    ],
    spells: ["dusk_chill_touch", "bolt_recon_ping", "bolt_overload_field", "bolt_power_rebate", "dusk_phantom_spikes"],
  },
  {
    id: "pre_solar_crown",
    name: "Solar Crown",
    note: "DAWN + PYRO — top-heavy and unforgiving. It builds to one big swing.",
    premade: true,
    boardSize: 4,
    tier: "hard",
    cards: [
      "dawn_golde", "dawn_lazor", "dawn_star", "dawn_ty", "dawn_veil",
      "dawn_clipsey", "dawn_warphant", "dawn_aurora", "dawn_kosmos", "pyro_firebird",
      "pyro_liza", "pyro_scorch", "pyro_sarra", "pyro_sseerr", "pyro_tiki",
      "pyro_aftermath", "pyro_sol", "pyro_volcanon",
    ],
    spells: ["pyro_spark", "pyro_flare_push", "dawn_dawns_grace", "dawn_judgment", "dawn_dawns_judgment"],
  },
  {
    id: "pre_titanfall",
    name: "Titanfall",
    note: "BORE + BOLT — armour that punishes every attack into it.",
    premade: true,
    boardSize: 4,
    tier: "hard",
    cards: [
      "bore_shift", "bore_valcana", "bore_krysteel", "bore_rhe", "bore_rollo",
      "bore_sheish", "bore_rohojohn", "bore_sandman", "bore_score", "bolt_lytning",
      "bolt_static", "bolt_storm", "bolt_sentry", "bolt_striik", "bolt_surge",
      "bolt_volta", "bolt_zoez", "bolt_voltogon",
    ],
    spells: ["bore_pebble_toss", "bore_bulwark", "bore_fortify", "bore_shatterpoint", "bore_tremor"],
  },
  {
    id: "pre_black_tide",
    name: "Black Tide",
    note: "DUSK + LEAF — attrition with a mythic finisher waiting behind it.",
    premade: true,
    boardSize: 4,
    tier: "hard",
    cards: [
      "dusk_silkstalker", "dusk_skrow", "dusk_spectra", "dusk_sarachnid", "dusk_brute",
      "dusk_ender", "dusk_ravven", "dusk_scar", "dusk_zombination", "leaf_bark_bushmen",
      "leaf_citra", "leaf_dande", "leaf_splint", "leaf_whintey", "leaf_squanch",
      "leaf_efy", "leaf_thorn", "leaf_nightshade",
    ],
    spells: ["leaf_sprout", "dusk_shadow_step", "leaf_groves_blessing", "dusk_phantom_spikes", "leaf_bloodroot_surge"],
  },
  {
    id: "pre_maelstrom",
    name: "Maelstrom",
    note: "GALE + AQUA — freeze, shove, and hit what cannot answer back.",
    premade: true,
    boardSize: 4,
    tier: "hard",
    cards: [
      "gale_angale", "gale_buf", "gale_vaga", "gale_vvulture", "gale_omega",
      "gale_wista", "gale_tempest", "gale_totem", "gale_klipso", "aqua_bahari",
      "aqua_blackice", "aqua_icynin", "aqua_blackbeard", "aqua_icewall", "aqua_vaporem",
      "aqua_glacius", "aqua_magalogoon", "aqua_siren",
    ],
    spells: ["gale_gust", "gale_tailwind", "aqua_dense_fog", "gale_vortex_strike", "aqua_maelstrom"],
  },];

/** The twelve cards each standard deck gains on the large board, keyed by its
 *  id. Six per element so every two-element build stays an even 15/15 (the
 *  three-element ones land on 10/10/10), and deliberately bottom-heavy: a
 *  30-card deck draws the same one-per-round, so padding the top would just
 *  mean more dead openers. Each list is drawn from that deck's own elements.
 *
 *  Twelve rather than ten because the 5x5 format is exactly thirty cards; at
 *  ten these decks were 28 and simply illegal once the format stopped being a
 *  range. The two added to each are the cheapest unused card of the elements
 *  that were short, which is also where a longer game wants them. */
const LARGE_EXTRAS: Record<string, string[]> = {
  // +5 BOLT / +5 PYRO, all 1–4 cost — the deck is an aggro shell and wants
  // early bodies, not a second wave of finishers.
  pre_inferno_blitz: [
    "bolt_twotales", "bolt_kore", "bolt_buzz", "bolt_static", "bolt_webster",
    "pyro_smog_card", "pyro_bbq", "pyro_ingit", "pyro_spitfire", "pyro_fenrir",
    "bolt_junker", "pyro_sparky",
  ],
  // +6 BORE / +4 AQUA — evens the 8/10 split the standard build carries.
  // Nothing above 5: it already tops out at 6,6,7,10.
  pre_frostkeep: [
    "bore_cavedweller", "bore_crock", "bore_clubber", "bore_smith", "bore_rockgoblin",
    "bore_rollo", "aqua_icyninza", "aqua_krakler", "aqua_bahari", "aqua_vaporem",
    "bore_kcor", "aqua_piranha",
  ],
  // +5 DAWN / +5 LEAF — more bodies to hide the healers behind, which is the
  // deck's whole plan.
  pre_radiant_host: [
    "dawn_sphere", "dawn_glime", "dawn_musk_ox", "dawn_lazor", "dawn_veil",
    "leaf_stickviper", "leaf_cactus", "leaf_greegon", "leaf_alpha", "leaf_squanch",
    "dawn_flash", "leaf_nettle",
  ],
  // +5 GALE / +5 DUSK — cheap evasive tempo, in keeping with the shell.
  pre_nightfall: [
    "gale_skyforce", "gale_toxhawk", "gale_whirlwolf", "gale_hawko", "gale_guan",
    "dusk_vamp", "dusk_spider", "dusk_skeleton_knight", "dusk_gool", "dusk_scarlett",
    "gale_syt_bird", "dusk_pumpkin",
  ],
  // +4 AQUA / +3 GALE / +3 BOLT — more cheap disruptors to keep the lock going
  // across the bigger board.
  pre_tempest: [
    "aqua_misty", "aqua_icyninza", "aqua_bahari", "aqua_vaporem",
    "gale_toxhawk", "gale_whirlwolf", "gale_hawko",
    "bolt_twotales", "bolt_static", "bolt_kore",
    "gale_skyforce", "bolt_zap",
  ],
  // +3 LEAF / +3 PYRO / +4 DUSK — extra early bodies + DOT appliers for the grind.
  pre_blight: [
    "leaf_cactus", "leaf_alpha", "leaf_nettle",
    "pyro_bbq", "pyro_smog_card", "pyro_sparky",
    "dusk_spider", "dusk_gool", "dusk_scarlett", "dusk_skeleton_knight",
    "leaf_birch", "pyro_ingit",
  ],
  // ── matchmaker ladder ──
  pre_sapling_creek: [
      "leaf_stickviper", "leaf_weeds", "leaf_python", "leaf_dartfrog", "leaf_hunter",
      "leaf_walking_tree", "aqua_piranha", "aqua_subcool", "aqua_icyninza", "aqua_kinguin",
      "aqua_spinefin", "aqua_tide",
  ],
  pre_dust_patrol: [
      "bore_iron", "bore_kcor", "bore_thorny_ripper", "bore_ankylosaur", "bore_ufo",
      "bore_warthog", "gale_swillow", "gale_breeze", "gale_tumbleweed", "gale_hawk",
      "gale_whirlwolf", "gale_windsor",
  ],
  pre_ember_wake: [
      "pyro_sparky", "pyro_baboom", "pyro_taper", "pyro_ash_boar", "pyro_spitfire",
      "pyro_wick", "dusk_doom", "dusk_gravekeeper", "dusk_gool", "dusk_hix",
      "dusk_widowbite", "dusk_zhunk",
  ],
  pre_static_shallows: [
      "bolt_twotales", "bolt_zap", "bolt_jolt", "bolt_ning", "bolt_buzzard",
      "bolt_jellyfish", "aqua_piranha", "aqua_subcool", "aqua_icyninza", "aqua_kinguin",
      "aqua_spinefin", "aqua_tide",
  ],
  pre_tidal_gate: [
      "aqua_bootlegger", "aqua_bulletshrimp", "aqua_siphon", "aqua_anos", "aqua_vaporem",
      "aqua_phrost", "dawn_sparkle", "dawn_glime", "dawn_star", "dawn_solara",
      "dawn_aurelion", "dawn_dawn",
  ],
  pre_emberforge: [
      "pyro_baboom", "pyro_flamehound", "pyro_scorch", "pyro_spitfire", "pyro_twins",
      "pyro_aftermath", "bore_sling", "bore_thorny_ripper", "bore_krysteel", "bore_rollo",
      "bore_bastion", "bore_steel",
  ],
  pre_thornwind: [
      "leaf_leaf", "leaf_oak", "leaf_greegon", "leaf_hunter", "leaf_season",
      "leaf_thorn", "gale_megair", "gale_tumbleweed", "gale_fano", "gale_masala",
      "gale_bluejay", "gale_kloud",
  ],
  pre_nightcircuit: [
      "dusk_harve", "dusk_jackl", "dusk_spectra", "dusk_widowbite", "dusk_ender",
      "dusk_ravven", "bolt_zipp", "bolt_staticcloud", "bolt_zagphu", "bolt_sentry",
      "bolt_gigavolt", "bolt_stormcaller",
  ],
  pre_solar_crown: [
      "dawn_ariel", "dawn_radiance", "dawn_drakonbane", "dawn_halo", "dawn_commander",
      "dawn_supernova", "pyro_woof", "pyro_fenix", "pyro_fenrir", "pyro_twins",
      "pyro_magmadon", "pyro_pyrogon",
  ],
  pre_titanfall: [
      "bore_lithara", "bore_monger", "bore_gemaga", "bore_obsidi", "bore_steel",
      "bore_deepest", "bolt_webster", "bolt_zagphu", "bolt_thundercat", "bolt_thunder",
      "bolt_velvolt_knight", "bolt_elecdroid",
  ],
  pre_black_tide: [
      "dusk_ghastly", "dusk_plaguecrow", "dusk_rip", "dusk_wedded_wraith", "dusk_nightfang",
      "dusk_skelider", "leaf_fallona", "leaf_sakuroot", "leaf_sumerose", "leaf_rubyo",
      "leaf_warden", "leaf_oakgre",
  ],
  pre_maelstrom: [
      "gale_fano", "gale_rayfen", "gale_wolfbane", "gale_eagon", "gale_stormfang",
      "gale_griffith", "aqua_owlette", "aqua_liquark", "aqua_polarking", "aqua_rain",
      "aqua_hydrogon", "aqua_kraken",
  ],};

/** The three extra spells each premade picks up on the big board.
 *
 *  The 5×5 spellbook cap is 8 (MAX_SPELLBOOK_LARGE) and every standard deck
 *  declares exactly 5, but largeVariant only ever extended `cards` — so every
 *  5×5 match, player and AI alike, was played three spell slots short of what
 *  the deck builder hands you for the same board. Nothing said so; the book
 *  just ended early.
 *
 *  Each set stays inside the deck's own elements and fills the gaps in its cost
 *  curve, leaning to the middle and upper rungs: a 5×5 game runs longer and
 *  generates more magic, so the slots that were missing are the ones a longer
 *  game would actually reach.
 */
const LARGE_SPELL_EXTRAS: Record<string, string[]> = {
  // BOLT/PYRO aggro: a board sweep at 5, the BOLT field at 6, a finisher at 9.
  pre_inferno_blitz: ["pyro_ashfall", "bolt_power_grid", "pyro_cataclysm"],
  // BORE/AQUA control: the shield rider it lacked, fog, and its own terrain.
  pre_frostkeep: ["bore_bulwark", "aqua_dense_fog", "bore_bedrock"],
  // DAWN/LEAF sustain: the +DMG heal, Blazing Sun, and a single-target answer.
  pre_radiant_host: ["dawn_grace", "dawn_blazing_sun", "dawn_judgment"],
  // GALE/DUSK tempo: repositioning at 3, the DUSK field, a mid-cost strike.
  pre_nightfall: ["dusk_shadow_step", "dusk_nightfall", "gale_vortex_strike"],
  // AQUA/GALE/BOLT lock: more disruption across all three of its elements.
  pre_tempest: ["gale_downdraft", "aqua_dense_fog", "gale_jetstream"],
  // LEAF/PYRO/DUSK grind: DOT and area, matching the shell's plan.
  pre_blight: ["leaf_thorn_patch", "pyro_ashfall", "dusk_grave_pit"],
  // ── matchmaker ladder ──
  pre_sapling_creek: ["aqua_steam_vent", "aqua_ice_wall", "leaf_lushfield"],
  pre_dust_patrol: ["gale_tailwind", "bore_stone_wall", "gale_jetstream"],
  pre_ember_wake: ["pyro_flare_push", "dusk_veil_of_shadows", "pyro_heatwave"],
  pre_static_shallows: ["bolt_rewire", "bolt_overload_field", "aqua_downpour"],
  pre_tidal_gate: ["aqua_steam_vent", "aqua_dense_fog", "aqua_pressure_crush"],
  pre_emberforge: ["bore_bulwark", "pyro_ashfall", "pyro_meltdown"],
  pre_thornwind: ["gale_tailwind", "gale_storm_front", "leaf_withering_grasp"],
  pre_nightcircuit: ["dusk_shadow_step", "dusk_wake_of_the_dead", "bolt_lightning_storm"],
  pre_solar_crown: ["pyro_firewall", "pyro_heatwave", "dawn_solar_flare"],
  pre_titanfall: ["bolt_overload_field", "bolt_power_grid", "bore_landslide"],
  pre_black_tide: ["leaf_bramble_wall", "leaf_lushfield", "leaf_overgrowth"],
  pre_maelstrom: ["aqua_ice_wall", "aqua_downpour", "aqua_glacial_wave"],
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
    spells: [...(base.spells ?? []), ...(LARGE_SPELL_EXTRAS[base.id] ?? [])],
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

/** The ladder's decks for one rung, sized for a battlefield. */
export const decksForTier = (tier: DeckTier, boardSize: number): PremadeDeck[] =>
  premadeDecksFor(boardSize).filter((d) => d.tier === tier);

/** Pick an opponent from a rung.
 *
 *  `avoid` is the deck currently in the seat: with four decks per rung, asking
 *  for the same difficulty twice and being handed the same list both times
 *  reads as a broken button rather than a roll. It only applies while there is
 *  something else to hand back. */
export function rollOpponent(
  tier: DeckTier,
  boardSize: number,
  avoid?: string,
  rand: () => number = Math.random,
): PremadeDeck | null {
  const pool = decksForTier(tier, boardSize);
  if (!pool.length) return null;
  const fresh = pool.filter((d) => d.id !== avoid);
  const from = fresh.length ? fresh : pool;
  return from[Math.min(from.length - 1, Math.floor(rand() * from.length))];
}

/** The rung a deck sits on, for showing which one the seat is currently at. */
export const tierOf = (deckId: string): DeckTier | null =>
  PREMADE_DECKS.find((d) => d.id === deckId)?.tier ?? null;

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

/** A deck is valid when it is exactly the board's size in unique, buildable
 *  cards — 18 on 4×4, 30 on 5×5. */
export function validateDeck(cards: string[], boardSize = 4): DeckValidation {
  const { min, max } = deckLimits(boardSize);
  const unique = new Set(cards);
  if (unique.size !== cards.length) return { ok: false, reason: "Duplicate cards" };
  if (cards.some((id) => !isBuildable(id))) return { ok: false, reason: "Unknown card" };
  // One message when the format is an exact size, because "need at least 30"
  // followed later by "at most 30" describes a range nobody can build in.
  if (min === max && cards.length !== min) {
    return { ok: false, reason: `A ${boardSize}×${boardSize} deck is exactly ${min} cards` };
  }
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
