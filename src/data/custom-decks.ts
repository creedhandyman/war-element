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
   *  and it plays the same way behind every list. So the tiers are a matter of
   *  what the list is trying to do —
   *
   *    easy  a melee pile with a top-heavy curve, no front line and no healer.
   *    mid   a curve, a wall, a healer, and enough reach to use them.
   *    hard  cheap bodies everywhere, healed, with shooters over the top.
   *
   *  NOT rarity, which types.ts documents as cosmetic. See the ladder's own
   *  banner further down for why that was tried, how it backfired, and the
   *  win rates each rung actually posts against the six originals.
   *
   *  Absent = untiered, which is how those six ship: they are hand-tuned
   *  archetypes rather than rungs on a ladder, and the matchmaker leaves them
   *  out rather than guessing where they sit. */
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

  // ── THE MATCHMAKER LADDER ─────────────────────────────────────
  // Twelve decks in three rungs of four, picked FOR you by difficulty rather
  // than chosen by name. Element pairings are all ones the six originals do
  // not use, so the ladder reads as new opponents rather than reskins.
  //
  // DIFFICULTY IS THE PLAN, NOT THE RARITY, AND IT WAS MEASURED. The first
  // cut tiered on `rarity`, which types.ts documents as cosmetic with no
  // engine effect. It backfired exactly as a cosmetic lever should: no epic
  // in the set costs less than 3, so `hard` meant epic-and-up meant nothing
  // playable on round one, and the top rung was the one you could rush down
  // in four rounds. Tiering on a label produced the OPPOSITE of the
  // difficulty it named.
  //
  // The second cut tiered on a THEORY of good play — a front line, reach,
  // sustain, and cards with lots of triggers — and that was also wrong,
  // just less obviously. So this cut was tuned against a measurement: build
  // a rung, play all four decks against the six hand-tuned originals, both
  // seats, several seeds, and read the win rate. What that found:
  //
  //   CHEAP AND WIDE WINS. The stat budget is dmg*hits + hp + shields*2 + sp
  //     ~= 5*cost + 10, and the +10 is FLAT: a 1-cost body returns 15 points
  //     of stats per gold and a 9-cost returns 6.1. Nine gold is nine 1-drops
  //     or one 9-drop, and capture — which ends ~95% of games here — pays for
  //     having bodies on squares, so nine is not a close call.
  //   REACH IS THE SECOND LEVER, and what makes HARD hard on the small board,
  //     where there is no room for a flood to matter. Melee cannot answer
  //     anything standing behind a wall. It does NOT separate easy from mid:
  //     those two are level at 20 Ranged in 72 on 4x4, one card apart on 5x5.
  //     An early draft of this banner claimed it did, which was a claim about
  //     the plan rather than about the decks the plan produced. mid is harder
  //     than easy on curve and comp; hard is harder than both on all three.
  //   A FRONT LINE AND A HEALER HELP, so easy runs neither.
  //   TRIGGER DENSITY DOES NOT. Weighting it made decks measurably WORSE —
  //     a trigger is paid for out of that same budget, and the AI banks
  //     little of it. It is not a difficulty lever and is not used as one.
  //
  // So: easy is a clumsy melee pile with a top-heavy curve and no comp; mid
  // has a curve, a wall and a healer; hard floods cheap bodies, heals them,
  // and shoots over the top. Played against the six originals — every deck,
  // both seats, three seeds, 144 games a rung — they win 32/54/59% on 4x4 and
  // 19/35/56% on 5x5. Monotone on both boards, though mid and hard sit close
  // on the small one, where sixteen slots cap what a flood can be worth.
  //
  // EVERY RUNG USES EACH OF THE EIGHT ELEMENTS EXACTLY ONCE. `rollOpponent`
  // only avoids the deck already seated, so two decks on one rung sharing an
  // element share cards and a re-roll hands back the same fight. easy shipped
  // with AQUA twice, and BOLT+AQUA overlapped LEAF+AQUA by seven cards — 43% of
  // the list, the only overlapping pair in all eighteen. A Gauntlet run deals
  // the WHOLE rung, so it played both clones back to back. There is a test on
  // the partition now.
  //
  // EVERY rung still opens on round one. `poolGainForRound` pays 1 gold a
  // round for the first five, so round one buys a 1-drop and nothing else and
  // a deck whose cheapest card costs 3 stands there until round three. All
  // twelve carry a 1-cost card and at least four under three. That was the
  // bug, there is a test on it, and it is not coming back.
  {
    id: "pre_sapling_creek",
    name: "Sapling Creek",
    note: "LEAF + AQUA — a wall of bodies with no wall. Nothing holds a square and nothing heals.",
    premade: true,
    boardSize: 4,
    tier: "easy",
    cards: [
      "leaf_nettle", "leaf_fallow", "leaf_stickers", "leaf_alpha", "leaf_dande",
      "leaf_guardian", "leaf_rubyo", "leaf_efy", "leaf_trinezer", "aqua_spinefin",
      "aqua_rain", "aqua_blub", "aqua_bootlegger", "aqua_icynin", "aqua_tide",
      "aqua_liquark", "aqua_driftwraith", "aqua_hydrogon",
    ],
    spells: ["leaf_thorn_patch", "leaf_bramble_wall", "leaf_lushfield", "leaf_withering_grasp", "aqua_maelstrom"],
  },
  {
    id: "pre_dust_patrol",
    name: "Dust Patrol",
    note: "BORE + GALE — slow out of the gate and stuck in the front rank. Outlast it.",
    premade: true,
    boardSize: 4,
    tier: "easy",
    cards: [
      "bore_cosmic", "bore_sling", "bore_sandman", "bore_iron", "bore_rock",
      "bore_rollo", "bore_sheish", "bore_obsidi", "bore_steel", "gale_swillow",
      "gale_gastly", "gale_tumbleweed", "gale_buf", "gale_vaga", "gale_omega",
      "gale_eagon", "gale_tempest", "gale_stormfang",
    ],
    spells: ["gale_downdraft", "gale_squall_line", "gale_jetstream", "gale_vortex_strike", "bore_tremor"],
  },
  {
    id: "pre_ember_wake",
    name: "Ember Wake",
    note: "PYRO + DUSK — hits hard and dies fast. No front line to hit through and no one to patch it.",
    premade: true,
    boardSize: 4,
    tier: "easy",
    cards: [
      "pyro_florence", "pyro_taper", "pyro_firefly", "pyro_sol", "pyro_baboom",
      "pyro_ember_scorpion", "pyro_woof", "pyro_fenrir", "pyro_pyrogon", "dusk_hix",
      "dusk_ravven", "dusk_crow", "dusk_vamp", "dusk_skeleton_knight", "dusk_widowbite",
      "dusk_sarachnid", "dusk_brute", "dusk_shadowhorsemen",
    ],
    spells: ["pyro_ember_trap", "pyro_firewall", "pyro_heatwave", "dusk_phantom_spikes", "pyro_cataclysm"],
  },
  {
    id: "pre_static_shallows",
    name: "Static Shallows",
    note: "BOLT + DAWN — a pile of bodies with no plan behind them.",
    premade: true,
    boardSize: 4,
    tier: "easy",
    cards: [
      "bolt_stingray", "bolt_drshock", "bolt_thunder", "bolt_shock", "bolt_scrapper",
      "bolt_zagphu", "bolt_voltcher", "bolt_zoez", "bolt_elecdroid", "dawn_beam",
      "dawn_kosmos", "dawn_flash", "dawn_glime", "dawn_lazor", "dawn_ariel",
      "dawn_radiance", "dawn_heir_tok", "dawn_equestrian",
    ],
    spells: ["dawn_cleansing_light", "bolt_overload_field", "bolt_power_grid", "dawn_judgment", "dawn_dawns_judgment"],
  },
  {
    id: "pre_tidal_gate",
    name: "Tidal Gate",
    note: "AQUA + DAWN — a front line, a healer behind it, and enough early bodies to keep pace.",
    premade: true,
    boardSize: 4,
    tier: "mid",
    cards: [
      "aqua_kinguin", "aqua_polarking", "aqua_misty", "aqua_buccaneers", "aqua_bahari",
      "aqua_octoirate", "aqua_rain", "aqua_sapphire", "aqua_magalogoon", "dawn_reflection",
      "dawn_commander", "dawn_sphere", "dawn_flash", "dawn_glime", "dawn_lazor",
      "dawn_musk_ox", "dawn_drakonbane", "dawn_equestrian",
    ],
    spells: ["dawn_sunbeam", "aqua_steam_vent", "aqua_ice_wall", "aqua_downpour", "dawn_solar_flare"],
  },
  {
    id: "pre_emberforge",
    name: "Emberforge",
    note: "PYRO + BORE — a wall that does not move, with burn coming over the top of it.",
    premade: true,
    boardSize: 4,
    tier: "mid",
    cards: [
      "pyro_bbq", "pyro_tiki", "pyro_magmadon", "pyro_canister", "pyro_aftermath",
      "pyro_flamehound", "pyro_wick", "pyro_firefly", "pyro_fenrir", "bore_hillbilly",
      "bore_armadillo", "bore_monger", "bore_the_coreborer", "bore_gemaga", "bore_crock",
      "bore_thorny_ripper", "bore_rollo", "bore_sheish",
    ],
    spells: ["pyro_spark", "bore_bulwark", "pyro_firewall", "pyro_heatwave", "pyro_inferno_pit"],
  },
  {
    id: "pre_thornwind",
    name: "Thornwind",
    note: "LEAF + GALE — trades on contact and keeps a healer behind the trade.",
    premade: true,
    boardSize: 4,
    tier: "mid",
    cards: [
      "leaf_oak", "leaf_lumberjack", "leaf_weeds", "leaf_elderroot", "leaf_nettle",
      "leaf_dartfrog", "leaf_rubyo", "leaf_trinezer", "leaf_python", "gale_sirocco",
      "gale_vvulture", "gale_gastly", "gale_tumbleweed", "gale_buf", "gale_wailverine",
      "gale_eagon", "gale_tempest", "gale_stormfang",
    ],
    spells: ["leaf_sprout", "gale_tailwind", "leaf_bramble_wall", "leaf_lushfield", "leaf_overgrowth"],
  },
  {
    id: "pre_nightcircuit",
    name: "Nightcircuit",
    note: "DUSK + BOLT — status on your front rank while shooters take the squares.",
    premade: true,
    boardSize: 4,
    tier: "mid",
    cards: [
      "dusk_zombie_husk", "dusk_rip", "dusk_doom", "dusk_haunt", "dusk_harve",
      "dusk_skulldrake", "dusk_ghastly", "dusk_ravven", "dusk_brute", "bolt_junker",
      "bolt_kore", "bolt_keeper", "bolt_twotales", "bolt_scrapper", "bolt_zagphu",
      "bolt_voltcher", "bolt_voltogon", "bolt_jolt",
    ],
    spells: ["dusk_chill_touch", "dusk_shadow_step", "bolt_overload_field", "bolt_power_grid", "dusk_grave_pit"],
  },
  {
    id: "pre_solar_crown",
    name: "Solar Crown",
    note: "DAWN + PYRO — floods the board on round one, heals it, and shoots over the top.",
    premade: true,
    boardSize: 4,
    tier: "hard",
    cards: [
      "dawn_reflection", "dawn_warphant", "dawn_able", "dawn_amble", "dawn_solstice",
      "dawn_beam", "dawn_shine", "dawn_sircrest", "dawn_roy", "pyro_bbq",
      "pyro_slag_tortoise", "pyro_twins", "pyro_canister", "pyro_florence", "pyro_taper",
      "pyro_ingit", "pyro_ember_scorpion", "pyro_firebird",
    ],
    spells: ["pyro_spark", "dawn_sunbeam", "dawn_cleansing_light", "pyro_flare_push", "pyro_firewall"],
  },
  {
    id: "pre_titanfall",
    name: "Titanfall",
    note: "BORE + BOLT — cheap armour everywhere and shooters behind it. It takes squares first.",
    premade: true,
    boardSize: 4,
    tier: "hard",
    cards: [
      "bore_hillbilly", "bore_ankylosaur", "bore_monger", "bore_cavedweller", "bore_ufo",
      "bore_diam", "bore_cosmic", "bore_old_timer", "bore_score", "bolt_junker",
      "bolt_kore", "bolt_rodd", "bolt_stingray", "bolt_ning", "bolt_twotales",
      "bolt_storm", "bolt_thundercat", "bolt_zoez",
    ],
    spells: ["bore_pebble_toss", "bolt_zap", "bore_sand_trap", "bore_bulwark", "bolt_overload_field"],
  },
  {
    id: "pre_black_tide",
    name: "Black Tide",
    note: "DUSK + LEAF — never stops deploying, never stops healing, never stops trading.",
    premade: true,
    boardSize: 4,
    tier: "hard",
    cards: [
      "dusk_zombie_husk", "dusk_rip", "dusk_doom", "dusk_scarlett", "dusk_haunt",
      "dusk_pumpkin", "dusk_ender", "dusk_crow", "dusk_gravekeeper", "leaf_oak",
      "leaf_sakuroot", "leaf_weeds", "leaf_nettle", "leaf_darth", "leaf_stickers",
      "leaf_alpha", "leaf_thorn", "leaf_python",
    ],
    spells: ["leaf_sprout", "dusk_chill_touch", "leaf_thorn_patch", "dusk_shadow_step", "leaf_bramble_wall"],
  },
  {
    id: "pre_maelstrom",
    name: "Maelstrom",
    note: "GALE + AQUA — freezes your opening and captures while you are still paying for it.",
    premade: true,
    boardSize: 4,
    tier: "hard",
    cards: [
      "gale_sirocco", "gale_windsor", "gale_vvulture", "gale_syt_bird", "gale_whirlwolf",
      "gale_fano", "gale_totem", "gale_skyforce", "gale_toxhawk", "aqua_kinguin",
      "aqua_polarking", "aqua_anglerfish", "aqua_arctik", "aqua_piranha", "aqua_bulletshrimp",
      "aqua_tide", "aqua_driftwraith", "aqua_coralgolem",
    ],
    spells: ["gale_gust", "aqua_chill", "aqua_frost_patch", "gale_tailwind", "aqua_ice_wall"],
  },
];

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
    "leaf_stickviper", "leaf_leaf", "leaf_cactus", "leaf_gecko", "leaf_splint",
    "leaf_thorn", "aqua_blackbeard", "aqua_piranha", "aqua_bulletshrimp", "aqua_krakler",
    "aqua_sapphire", "aqua_magalogoon",
  ],
  pre_dust_patrol: [
    "bore_kcor", "bore_rhe", "bore_clubber", "bore_warthog", "bore_bolder",
    "bore_prism", "gale_sway", "gale_duster", "gale_luna", "gale_wailverine",
    "gale_wolfbane", "gale_klipso",
  ],
  pre_ember_wake: [
    "pyro_flamehound", "pyro_dynomight", "pyro_ash_boar", "pyro_firebird", "pyro_sseerr",
    "pyro_magmaw", "dusk_ender", "dusk_wedded_wraith", "dusk_spider", "dusk_silkstalker",
    "dusk_reaper", "dusk_skelider",
  ],
  pre_static_shallows: [
    "bolt_zipp", "bolt_lytning", "bolt_keeper", "bolt_storm", "bolt_thundercat",
    "bolt_voltogon", "dawn_clipsey", "dawn_roy", "dawn_golde", "dawn_musk_ox",
    "dawn_drakonbane", "dawn_leo",
  ],
  pre_tidal_gate: [
    "aqua_coralgolem", "aqua_polarbear", "aqua_harp", "aqua_subcool", "aqua_cryo",
    "aqua_driftwraith", "dawn_veil", "dawn_warphant", "dawn_roy", "dawn_golde",
    "dawn_radiance", "dawn_heir_tok",
  ],
  pre_emberforge: [
    "pyro_heatsink_golem", "pyro_twins", "pyro_smog_card", "pyro_scorch", "pyro_scully",
    "pyro_sarra", "bore_rockgoblin", "bore_bearocks", "bore_clubber", "bore_warthog",
    "bore_obsidi", "bore_prism",
  ],
  pre_thornwind: [
    "leaf_sprinu", "leaf_whintey", "leaf_stickviper", "leaf_bark_bushmen", "leaf_efy",
    "leaf_thorn", "gale_stormhide_bison", "gale_guan", "gale_duster", "gale_luna",
    "gale_wolfbane", "gale_klipso",
  ],
  pre_nightcircuit: [
    "dusk_gravekeeper", "dusk_spectra", "dusk_gool", "dusk_jackl", "dusk_ender",
    "dusk_skelider", "bolt_buzz", "bolt_stormcaller", "bolt_electricel", "bolt_storm",
    "bolt_thundercat", "bolt_zoez",
  ],
  pre_solar_crown: [
    "dawn_oxin", "dawn_veil", "dawn_stbern", "dawn_solara", "dawn_sparkle",
    "dawn_sphere", "pyro_heatsink_golem", "pyro_tiki", "pyro_staph", "pyro_sparky",
    "pyro_woof", "pyro_fenrir",
  ],
  pre_titanfall: [
    "bore_rockgoblin", "bore_armadillo", "bore_smith", "bore_lithara", "bore_kcor",
    "bore_sling", "bolt_jolt", "bolt_buzz", "bolt_drshock", "bolt_zap",
    "bolt_zagphu", "bolt_voltcher",
  ],
  pre_black_tide: [
    "dusk_zhunk", "dusk_gool", "dusk_soul_wisp", "dusk_harve", "dusk_jackl",
    "dusk_skeleton_knight", "leaf_lumberjack", "leaf_walking_tree", "leaf_stickviper", "leaf_leaf",
    "leaf_cactus", "leaf_rubyo",
  ],
  pre_maelstrom: [
    "gale_stormhide_bison", "gale_guan", "gale_breeze", "gale_wista", "gale_swillow",
    "gale_megair", "aqua_polarbear", "aqua_buccaneers", "aqua_subcool", "aqua_bootlegger",
    "aqua_krakler", "aqua_liquark",
  ],
};

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
  pre_sapling_creek: ["aqua_ice_wall", "aqua_downpour", "leaf_overgrowth"],
  pre_dust_patrol: ["bore_stone_wall", "bore_bedrock", "gale_gale_force"],
  pre_ember_wake: ["dusk_veil_of_shadows", "dusk_nightfall", "pyro_inferno_pit"],
  pre_static_shallows: ["dawn_radiant_barrier", "dawn_blazing_sun", "dawn_solar_flare"],
  pre_tidal_gate: ["dawn_grace", "dawn_dawns_grace", "dawn_judgment"],
  pre_emberforge: ["pyro_flare_push", "bore_fortify", "bore_shatterpoint"],
  pre_thornwind: ["leaf_snare", "leaf_groves_blessing", "gale_vortex_strike"],
  pre_nightcircuit: ["bolt_rewire", "bolt_power_rebate", "dusk_phantom_spikes"],
  pre_solar_crown: ["pyro_ember_trap", "dawn_grace", "dawn_radiant_barrier"],
  pre_titanfall: ["bolt_recon_ping", "bolt_rewire", "bore_stone_wall"],
  pre_black_tide: ["dusk_bone_snare", "leaf_snare", "dusk_veil_of_shadows"],
  pre_maelstrom: ["gale_downdraft", "aqua_steam_vent", "gale_squall_line"],
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
