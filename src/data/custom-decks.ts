// Custom decks — a sandbox layer on top of the Cores. A deck is just a list of
// card ids (the engine's createInitialState already accepts string[]), so this
// never touches the Core pairing system. Persisted to localStorage so decks
// survive a reload. Browser-side only — safe to use Date.now here (this is not
// the deterministic engine reducer).

import { CARDS, CARD_INDEX } from "./cards";
import { isSpell, MAX_SPELLBOOK, MAX_SPELLBOOK_LARGE, spellCopyCap } from "../engine/spells";
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
  // Copies are allowed now, by cost tier — see `spellCopyCap`. This used to
  // dedupe outright, so a saved book with two Zaps came back with one.
  const taken = new Map<string, number>();
  const out: string[] = [];
  for (const id of ids) {
    if (typeof id !== "string" || !isSpell(id)) continue;
    const have = taken.get(id) ?? 0;
    if (have >= spellCopyCap(id)) continue;
    taken.set(id, have + 1);
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
export type DeckTier = "easy" | "mid" | "hard" | "elite";
export const DECK_TIERS: readonly DeckTier[] = ["easy", "mid", "hard", "elite"];

/** What each rung is CALLED. A map rather than the chained ternary this used to
 *  be in two places — `t === "easy" ? "Easy" : t === "mid" ? "Even" : "Hard"`
 *  has no branch for a fourth rung, so adding one silently labelled it "Hard"
 *  on both the opponent segment and the gauntlet button. */
export const TIER_LABEL: Record<DeckTier, string> = {
  easy: "Easy", mid: "Even", hard: "Hard", elite: "Elite",
};

/** The rungs that actually have decks on a battlefield, in ladder order.
 *
 *  Both boards carry all four today — elite was large-board only when it shipped
 *  and has a standard-board cut now. This still exists rather than being
 *  replaced by `DECK_TIERS`, because "which rungs does this board have" is a
 *  question about the DECK LIST and the answer has already changed once: while
 *  elite was 5x5-only, anything that walked DECK_TIERS blind put a fourth button
 *  on the standard board that dealt a run with no seats in it. */
export const tiersFor = (boardSize: number): DeckTier[] =>
  DECK_TIERS.filter((t) => decksForTier(t, boardSize).length > 0);

/** The scripted-opening depth for a deck id, if it has one. See
 *  `PremadeDeck.scriptedOpening`. */
export const scriptedOpeningFor = (deckId: string): number | undefined =>
  PREMADE_DECKS.find((d) => d.id === deckId)?.scriptedOpening;

/** How many of an elite deck's cheapest cards are hoisted at the deal.
 *
 *  One number for the whole rung, not a per-deck dial: the rung is supposed to
 *  read as one difficulty, and four separately-tuned depths would be four
 *  difficulties wearing one name. See `PremadeDeck.scriptedOpening`. */
export const ELITE_OPENING_STACK = 3;

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
   *    elite all of that, plus an opening it cannot stumble on — see
   *          `scriptedOpening`.
   *
   *  NOT rarity, which types.ts documents as cosmetic. See the ladder's own
   *  banner further down for why that was tried, how it backfired, and the
   *  win rates each rung actually posts against the six originals.
   *
   *  Absent = untiered, which is how those six ship: they are hand-tuned
   *  archetypes rather than rungs on a ladder, and the matchmaker leaves them
   *  out rather than guessing where they sit. */
  tier?: DeckTier;
  /** Hoist this deck's N cheapest cards to the top of its deck at the deal, so
   *  it can always act while gold is tight. Only ever applied to the OPPONENT
   *  seat — the player's own draw is never reordered.
   *
   *  The elite rung's difficulty is THIS rather than better cards, and that was
   *  a measurement, not a preference. Against every shipped 5×5 premade, 216
   *  matches each, the four elite lists posted 47.7 / 60.2 / 66.2 / 77.8% as
   *  built — an average no better than the hard rung's 60.2% and with three
   *  times its spread. Rebuilding them made it WORSE in both directions:
   *  swapping filler for the benched legendaries dropped Blazing Cyclone to
   *  31.0% and Tombstone to 37.5%, and swapping for cheap tough bodies dropped
   *  Chlorophyll to 44.9%. These lists are already near the best their pools
   *  allow, and hand-editing them mostly breaks the aura and tribe packages
   *  holding them together.
   *
   *  The opening is the dial that works: 71.8 / 85.6 / 81.9 / 88.9% at depth 3,
   *  every deck clear of the hard rung's best (65.7%). It also NARROWS the rung
   *  — spread 30.1 points down to 17.1 — because a scripted opening is worth
   *  most to the deck that was stumbling worst.
   *
   *  Depth 3 because that is where the curve flattens: 5 and 8 measure the same
   *  within noise (85.6 -> 87.5 on the one deck that moved at all). Same finding
   *  as `DARKEST_NIGHT.scriptedOpening`, which took the plateau at its cheapest
   *  for the same reason. */
  scriptedOpening?: number;
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
  // both seats, 288 games a rung — they win 31/47/60% on 4x4 and 27/36/60% on
  // 5x5. Monotone on both boards.
  //
  // NO MYTHICS ON `easy`. It shipped with seven — more than any other rung —
  // for the same reason `hard` shipped with none: rarity tracks cost here, and
  // easy's plan is the top-heavy one, so the expensive band it fills is exactly
  // where the Mythics live. The bottom of the ladder should not be the rung
  // showing off the rarest cards in the game. Excluded by RARITY rather than by
  // a cost ceiling, because cost >= 9 being exactly the Mythics is a property of
  // today's set and one cheap Mythic would undo it silently.
  //
  // Its curve leans further back to pay for that: dropping the Mythics made
  // easy CHEAPER, not weaker — the top band went from cost 9-10 to 7-8 — and
  // cheap-and-wide is the strongest thing a deck can do here, so it came level
  // with mid on the very axis the ladder is ordered by. [5,10,10,5] against the
  // old [8,10,8,4] puts it back.
  //
  // HARD KEEPS THE CHEAP CORE AND ITS TOP END. `costCap: 6` used to build it,
  // and rarity tracks cost in this pool — mythics are all 9-10, legendaries
  // 6-8 — so capping cost capped RARITY, and the top rung shipped as the only
  // one with no mythic in it while easy, being top-heavy, had the most. Hard
  // now spends its last curve band on legendaries and mythics instead of
  // leaving it empty, which measured level-to-better and reads like a top rung
  // instead of a pile of commons.
  //
  // THE 4x4 HARD DECKS ARE SYNERGY-BUILT; the 5x5 ones are not, and that is
  // the whole reason the two formats were decoupled. Picking cards that set up
  // and pay off each other's statuses measured +5.5 on the small board and
  // -5.9 on the large one over 528 games a cell — both real, and while a 5x5
  // build was `standard ++ extras` neither could be taken without the other.
  // A tight ten-round board rewards a combo; a wide fourteen-round one rewards
  // having an answer to more things.
  //
  // Everything else in card choice is spent: curve, comp, reach, cost cap,
  // rarity, melee bias and MONO-ELEMENT were all swept, and hard lands 55-62%
  // whatever they say. Mono was the clearest negative — 51-54%, because taking
  // 30 of an element's ~39 buildable cards forces its weak ones in and gives up
  // the other element's answers; its cohesion score went UP as it got worse.
  // Treat the cohesion number with suspicion generally: the six hand-tuned
  // originals, which are the reference everything here is measured against,
  // score LOWEST on it (Inferno Blitz and Frostkeep both 0.00).
  //
  // A rung harder than this wants a knob that is not the deck. §10.6's opening
  // allowance is the obvious one and it is strong: cutting the player from 2
  // opening slots to 1 took hard to 82% on 4x4 and 90% on 5x5 over 240 games
  // a cell. Not shipped — it changes how a match starts.
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

  // ── The new legends' decks ────────────────────────────────────────────────
  // Four more hand-tuned archetypes, one per pair of the eight legends added
  // after this file was written. Every one of those eight was unfielded: none
  // of them appeared in a single premade, so a player could meet Havoc or
  // Aranea only by building them, never by being hit with them.
  //
  // UNTIERED, like the six above and for the same reason — they are archetypes
  // rather than rungs, and the matchmaker's ladder is a fixed partition of four
  // decks per rung that a fifth would break. They show up where the six do: in
  // the deck picker, and in the Arena's hand-picked OPPONENT segment.
  //
  // Each is built AROUND its two legends rather than merely including them —
  // Scrapyard on contact damage, Deeproot on root-then-bite, Skydream on
  // displacement, Drowned Web on the spider swarm. A list that happened to
  // contain a new card would not have been worth adding.

  {
    id: "pre_scrapyard_reactor",
    name: "Scrapyard Reactor",
    note: "BOLT + PYRO — machines that punish contact. Everything you touch bites back.",
    premade: true,
    tier: "easy",
    boardSize: 4,
    // Havoc + Burnout — contact hurts (Spiked Conduit, Burning Frame, Surge's
    // Electro Surge) and Havoc shoots over the top of it.
    //
    // THE WEAKEST OF THE FOUR, measured rather than guessed. Against the eight
    // cores, 24 matches each: 37.5% here against 70.8 / 58.3 / 41.7 for the
    // other three, with the six shipped archetypes spanning 37.5-66.7 on the
    // same harness. It sits on that floor rather than under it.
    //
    // BOLT is why, and it is not fixable by editing the list. On a longer run
    // (48 matches each) the pure BOLT core measures 37.5% and EVERY pairing
    // tried came in under it — PYRO 29.2, AQUA 25.0, DUSK 16.7. Nine cards is
    // not enough BOLT to keep its tribe and Electrify packages running, so half
    // a BOLT deck is worth less than half of one.
    //
    // The first cut measured 0.0% over 24 matches. Two causes, both "cannot act
    // early": Canister is 0 DMG at SP 0 and Junker and Slag Tortoise sat at
    // SP 1, so a fifth of the deck could neither attack nor advance; and the
    // book opened at cost 4. Fast bodies and a 1-cost spell fixed both. Kept as
    // BOLT+PYRO because every alternative pairing measured worse, and because
    // this is the one that leaves LEAF+BORE and GALE+DAWN intact.
    cards: [
      "bolt_zap", "bolt_electricel", "bolt_scrapper", "bolt_storm", "bolt_voltcher",
      "bolt_zagphu", "bolt_thundercat", "bolt_zoez", "bolt_havoc", "pyro_sparky",
      "pyro_firecrack", "pyro_baboom", "pyro_dyna", "pyro_spitfire", "pyro_sarra",
      "pyro_fenix", "pyro_scully", "pyro_burnout",
    ],
    // A cheap SPELL matters as much as a cheap body. The first cut of this book
    // opened at cost 4; every other list here carries a 1-cost spell, and that
    // difference was most of the 0% below.
    spells: ["pyro_spark", "pyro_ember_trap", "bolt_overload_field", "pyro_firewall", "bolt_power_grid"],
  },
  {
    id: "pre_deeproot_ambush",
    name: "Deeproot Ambush",
    note: "LEAF + BORE — roots you to the spot, then bites what can no longer move.",
    premade: true,
    tier: "hard",
    boardSize: 4,
    // Snapmaw + Kobra: the two halves of the same trick. LEAF pins something
    // (ROOT), BORE puts it under (SLEEP), and both legends are paid double for
    // hitting a target in that state — Devour reaches any ROOTed card on the
    // board, Ambush Coil doubles into anything asleep.
    cards: [
      "leaf_stickviper", "leaf_oak", "leaf_python", "leaf_gecko", "leaf_hunter",
      "leaf_sumerose", "leaf_citra", "leaf_snapmaw", "leaf_season", "bore_cavedweller",
      "bore_thorny_ripper", "bore_old_timer", "bore_ankylosaur", "bore_rock", "bore_krysteel",
      "bore_bolder", "bore_kobra", "bore_sling",
    ],
    spells: ["leaf_snare", "leaf_thorn_patch", "bore_sand_trap", "leaf_withering_grasp", "bore_tremor"],
  },
  {
    id: "pre_skydream",
    name: "Skydream",
    note: "GALE + DAWN — drags you out of position, then lights up whatever is left standing.",
    premade: true,
    tier: "elite",
    scriptedOpening: ELITE_OPENING_STACK,
    boardSize: 4,
    // Dreamcatcher + Lassos — the displacement deck. Both legends move you
    // somewhere you did not choose, and everything else is built to punish a
    // card standing in the wrong square.
    cards: [
      "gale_sirocco", "gale_duster", "gale_megair", "gale_whirlwolf", "gale_vaga",
      "gale_sway", "gale_rayfen", "gale_dreamcatcher", "gale_bluejay", "dawn_beam",
      "dawn_shine", "dawn_stbern", "dawn_star", "dawn_oxin", "dawn_solstice",
      "dawn_raya", "dawn_lassos", "dawn_aurelion",
    ],
    spells: ["gale_gust", "dawn_sunbeam", "gale_tailwind", "dawn_radiant_barrier", "gale_cyclone"],
  },
  {
    id: "pre_drowned_web",
    name: "Drowned Web",
    note: "AQUA + DUSK — pulls you under the surface and fills the water with spiders.",
    premade: true,
    tier: "mid",
    boardSize: 4,
    // Killer Whale + Aranea. The AQUA half drags things under; the DUSK half is
    // a genuine spider package — Spider, Widowbite, Sarachnid, and Aranea's
    // Monstrous Spider splitting into two more when it dies.
    cards: [
      "aqua_piranha", "aqua_icyninza", "aqua_arctik", "aqua_siphon", "aqua_blackice",
      "aqua_anos", "aqua_vaporem", "aqua_killerwhale", "aqua_glacius", "dusk_spider",
      "dusk_harve", "dusk_jackl", "dusk_widowbite", "dusk_zhunk", "dusk_sarachnid",
      "dusk_violet", "dusk_aranea", "dusk_destro",
    ],
    spells: ["aqua_chill", "dusk_chill_touch", "aqua_ice_wall", "dusk_phantom_spikes", "aqua_maelstrom"],
  },
  // ── All four new decks are ON the ladder, one per rung, nothing displaced ──
  // Scrapyard -> easy · Drowned Web -> mid · Deeproot -> hard · Skydream -> elite.
  // Every rung holds FIVE now, and `startRun` shuffles before it slices
  // RUN_LENGTH, so a run is four fights drawn fresh from five: the same length
  // of run with a different fifth of the rung each time.
  //
  // Three bounded relaxations were needed, because a fifth deck is what makes
  // them necessary. Each keeps the property and gives up only the absolute:
  //
  //   ZERO SHARED CARDS -> at most 20% pairwise. The rule guards against decks
  //   "sharing half their list"; the sixteen originals still share nothing and
  //   the newcomers top out at 3/18 and 6/30.
  //
  //   EASY FIELDS NO FRONT LINE -> its four originals still field none, and at
  //   most ONE deck may carry one wall card. Scrapyard exists to show off
  //   Burnout, which is a Tank; every other wall slot was traded out.
  //
  //   ELITE'S EIGHT-ELEMENT TOUR -> coverage capped at two decks per element.
  //   Ten slots for eight elements means GALE and DAWN double, but nothing
  //   drops off the rung, which is what the tour was protecting.
  //
  // Two decks were retuned to their rung's PLAN, not just its band: Scrapyard
  // shed its front line and its Ranged density (on easy it would otherwise have
  // squeezed hard's required +0.1 reach margin to 0.01), and Deeproot was made
  // cheaper so hard still out-cheaps mid.
  //
  // Measured, 48 matches per deck against the eight cores (new / incumbents):
  //   4x4  easy 27.1 / 12.5-31.3 · mid 29.2 / 22.9-58.3
  //        hard 60.4 / 39.6-68.8 · elite 58.3 / 54.2-72.9
  //   5x5  easy 25.0 / 16.7-33.3 · mid 58.3 / 31.3-64.6
  //        hard 54.2 / 60.4-72.9 · elite 47.9 / 39.6-79.2
  //
  // AND 48 MATCHES CARRIES +-14 POINTS at 95%, which is most of a rung. Read
  // these as "lands in the right band", not as a ranking: Deeproot's 54.2 on
  // 5x5 is the only figure nominally outside its rung and it is under half the
  // noise band below the floor. Chasing it would be tuning on a coin flip.
  {
    id: "pre_sapling_creek",
    name: "Sapling Creek",
    note: "LEAF + AQUA — a wall of bodies with no wall. Nothing holds a square and nothing heals.",
    premade: true,
    boardSize: 4,
    tier: "easy",
    cards: [
      "leaf_nettle", "leaf_leaf", "leaf_nightshade", "leaf_birch", "leaf_dande",
      "leaf_guardian", "leaf_splint", "leaf_rubyo", "leaf_thorn", "aqua_bahari",
      "aqua_rain", "aqua_siren", "aqua_blub", "aqua_bulletshrimp", "aqua_krakler",
      "aqua_tide", "aqua_sapphire", "aqua_magalogoon",
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
      "bore_cosmic", "bore_sling", "bore_valcana", "bore_score", "bore_crock",
      "bore_warthog", "bore_sheish", "bore_obsidi", "bore_steel", "gale_hawk",
      "gale_kloud", "gale_gastly", "gale_tumbleweed", "gale_luna", "gale_wailverine",
      "gale_omega", "gale_eagon", "gale_klipso",
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
      "pyro_florence", "pyro_taper", "pyro_dynomight", "pyro_volcanon", "pyro_ash_boar",
      "pyro_firebird", "pyro_sseerr", "pyro_fenrir", "pyro_infernus_rex", "dusk_skrow",
      "dusk_ravven", "dusk_crow", "dusk_vamp", "dusk_silkstalker", "dusk_reaper",
      "dusk_brute", "dusk_hoax", "dusk_skelider",
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
      "bolt_stingray", "bolt_drshock", "bolt_general", "bolt_keeper", "bolt_stormcaller",
      "bolt_storm", "bolt_thundercat", "bolt_voltcher", "bolt_voltogon", "dawn_clipsey",
      "dawn_kosmos", "dawn_flash", "dawn_glime", "dawn_golde", "dawn_musk_ox",
      "dawn_radiance", "dawn_drakonbane", "dawn_leo",
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
      "dawn_reflection", "dawn_veil", "dawn_commander", "dawn_able", "dawn_amble",
      "dawn_solstice", "dawn_beam", "dawn_shine", "dawn_sircrest", "pyro_heatsink_golem",
      "pyro_canister", "pyro_florence", "pyro_scully", "pyro_sparky", "pyro_ember_scorpion",
      "pyro_woof", "pyro_fenrir", "pyro_infernus_rex",
    ],
    spells: ["pyro_spark", "pyro_ember_trap", "pyro_firewall", "pyro_ashfall", "pyro_heatwave"],
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
      "bore_lithara", "bore_deepest", "bore_cosmic", "bore_sandman", "bolt_junker",
      "bolt_surge", "bolt_gigavolt", "bolt_rodd", "bolt_stingray", "bolt_webster",
      "bolt_zap", "bolt_elecdroid", "bolt_jolt",
    ],
    spells: ["bore_sand_trap", "bore_landslide", "bore_pebble_toss", "bolt_zap", "bolt_recon_ping"],
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
      "dusk_pumpkin", "dusk_ravven", "dusk_skeleton_knight", "dusk_gravekeeper", "leaf_oak",
      "leaf_weeds", "leaf_nettle", "leaf_leaf", "leaf_citra", "leaf_fallow",
      "leaf_stickers", "leaf_gecko", "leaf_trinezer",
    ],
    spells: ["leaf_thorn_patch", "leaf_snare", "leaf_lushfield", "leaf_withering_grasp", "leaf_overgrowth"],
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
      "gale_fano", "gale_totem", "gale_skyforce", "gale_griffith", "aqua_kinguin",
      "aqua_polarbear", "aqua_polarking", "aqua_harp", "aqua_anglerfish", "aqua_cryo",
      "aqua_bootlegger", "aqua_icynin", "aqua_kraken",
    ],
    spells: ["aqua_chill", "aqua_frost_patch", "aqua_ice_wall", "aqua_glacial_wave", "aqua_maelstrom"],
  },
  // ───────────────────────── ELITE (standard board) ───────────────────────
  //
  // The 4x4 cut of the elite rung, one twin per large build: same name, same
  // note, same two elements, NINE cards a side instead of fifteen, and the five
  // cheapest of its eight spells.
  //
  // Elite shipped large-board only, which made it the one rung that broke the
  // both-boards symmetry every other premade keeps — the twin test needed it
  // named as an exception and `tiersFor` had a rung to hide. Both of those go
  // back to being ordinary now.
  //
  // The curve follows the shipped 4x4 HARD decks rather than the 5x5 lists
  // these came from: cheap-heavy with a pair of finishers, because a standard
  // board fight is shorter and a top-heavy 18 draws cards it cannot afford.
  // Same finding the Fill button rests on.
  {
    id: "pre_tombstone",
    name: "Tombstone",
    note: "DUSK + BORE — armour in front, the risen behind it, and it never runs out of bodies.",
    premade: true,
    boardSize: 4,
    tier: "elite",
    scriptedOpening: ELITE_OPENING_STACK,
    cards: [
      "dusk_pumpkin", "dusk_zombie_husk", "dusk_vamp", "dusk_skeleton_knight", "dusk_jackl",
      "dusk_zhunk", "dusk_gool", "dusk_haunt", "dusk_skullking", "bore_hillbilly",
      "bore_cavedweller", "bore_cosmic", "bore_rockgoblin", "bore_sling", "bore_ufo",
      "bore_rollo", "bore_bolder", "bore_deepest",
    ],
    spells: ["dusk_chill_touch", "dusk_bone_snare", "bore_stone_wall", "dusk_veil_of_shadows", "bore_bedrock"],
  },
  {
    id: "pre_chlorophyll",
    name: "Chlorophyll",
    note: "LEAF + DAWN — it out-heals what you can do to it, then out-reaches you.",
    premade: true,
    boardSize: 4,
    tier: "elite",
    scriptedOpening: ELITE_OPENING_STACK,
    cards: [
      "leaf_stickviper", "leaf_nettle", "leaf_oak", "leaf_sticks", "leaf_walking_tree",
      "leaf_dartfrog", "leaf_sumerose", "leaf_squanch", "leaf_trinezer", "dawn_beam",
      "dawn_glime", "dawn_shine", "dawn_reflection", "dawn_musk_ox", "dawn_amble",
      "dawn_golde", "dawn_drakonbane", "dawn_equestrian",
    ],
    spells: ["dawn_sunbeam", "leaf_snare", "leaf_bramble_wall", "dawn_radiant_barrier", "leaf_lushfield"],
  },
  {
    id: "pre_blazing_cyclone",
    name: "Blazing Cyclone",
    note: "PYRO + GALE — the fastest rung on the ladder. It is across the board before you have paid for a wall.",
    premade: true,
    boardSize: 4,
    tier: "elite",
    scriptedOpening: ELITE_OPENING_STACK,
    cards: [
      "pyro_bbq", "pyro_florence", "pyro_staph", "pyro_baboom", "pyro_flamehound",
      "pyro_liza", "pyro_sarra", "pyro_fenrir", "pyro_volcanon", "gale_sirocco",
      "gale_hawko", "gale_swillow", "gale_duster", "gale_tumbleweed", "gale_whirlwolf",
      "gale_masala", "gale_omega", "gale_stormfang",
    ],
    spells: ["pyro_spark", "pyro_flare_push", "pyro_firewall", "gale_squall_line", "pyro_heatwave"],
  },
  {
    id: "pre_thunderstorm",
    name: "Thunderstorm",
    note: "AQUA + BOLT — fat cheap bodies all the way up, and it never has a turn it cannot use.",
    premade: true,
    boardSize: 4,
    tier: "elite",
    scriptedOpening: ELITE_OPENING_STACK,
    cards: [
      "aqua_blub", "aqua_misty", "aqua_buccaneers", "aqua_bulletshrimp", "aqua_harp",
      "aqua_spinefin", "aqua_liquark", "aqua_sapphire", "aqua_hydrogon", "bolt_junker",
      "bolt_rodd", "bolt_zipp", "bolt_staticcloud", "bolt_scrapper", "bolt_buzz",
      "bolt_striik", "bolt_general", "bolt_velvolt_knight",
    ],
    spells: ["aqua_chill", "aqua_steam_vent", "aqua_ice_wall", "bolt_power_rebate", "aqua_downpour"],
  },
  // ── THREE-ELEMENT ARCHETYPES ────────────────────────────────────────────
  // Untiered on purpose. The ladder's rungs hold exactly four decks each and
  // the elite rung fields every element exactly once, so a three-element build
  // cannot join either without breaking a rule that is doing real work. These
  // are shelf decks — pickable, not laddered — which is what "hand-tuned
  // archetype" has meant here all along.
  //
  // Split 6/6/6 on the standard board and 10/10/10 on the large one: the
  // evenness rule the element test already anticipated for three.
  {
    id: "pre_verdant_tide",
    name: "Verdant Tide",
    note: "LEAF + AQUA + DAWN — heal, hold, and outlast.",
    // THREE ELEMENTS, and the shell is the point: LEAF regrows, AQUA holds
    // the line and DAWN puts the health back. Nothing here kills quickly and
    // everything here refuses to die — a different question to answer than any
    // two-element build on the shelf asks.
    premade: true,
    boardSize: 4,
    cards: [
      "leaf_birch", "leaf_leaf", "leaf_dartfrog", "leaf_walking_tree", "leaf_sumerose",
      "leaf_efy", "aqua_anglerfish", "aqua_arctik", "aqua_bahari", "aqua_siphon",
      "aqua_owlette", "aqua_driftwraith", "dawn_able", "dawn_glime", "dawn_lazor",
      "dawn_raya", "dawn_drakonbane", "dawn_kosmos",
    ],
    spells: ["leaf_sprout", "aqua_chill", "dawn_sunbeam", "leaf_thorn_patch", "aqua_frost_patch"],
  },
  {
    id: "pre_stormfront",
    name: "Stormfront",
    note: "PYRO + BOLT + GALE — speed and burst, nothing held back.",
    // The opposite build. PYRO burns, BOLT paralyses and GALE moves the board
    // out from under you, and none of the three has a plan past round eight. The
    // fastest thing in the picker, and it loses to whatever it cannot finish.
    premade: true,
    boardSize: 4,
    cards: [
      "pyro_bbq", "pyro_baboom", "pyro_ash_boar", "pyro_wick", "pyro_tiki",
      "pyro_aftermath", "bolt_junker", "bolt_drshock", "bolt_buzz", "bolt_sentry",
      "bolt_zagphu", "bolt_jack_arc", "gale_gastly", "gale_breeze", "gale_buf",
      "gale_windsor", "gale_vaga", "gale_dreamcatcher",
    ],
    spells: ["pyro_spark", "bolt_zap", "gale_gust", "pyro_ember_trap", "bolt_recon_ping"],
  },
  {
    id: "pre_deep_shade",
    name: "Deep Shade",
    note: "DUSK + BORE + AQUA — grind them down in the dark.",
    // Attrition from three directions: DUSK drains, BORE will not move and AQUA
    // freezes whatever is left. The slowest deck on the shelf and the one most
    // likely to still be standing on the last round.
    premade: true,
    boardSize: 4,
    cards: [
      "dusk_crow", "dusk_gravekeeper", "dusk_scarlett", "dusk_ghastly", "dusk_brute",
      "dusk_aranea", "bore_cavedweller", "bore_clubber", "bore_ankylosaur", "bore_krysteel",
      "bore_bolder", "bore_prism", "aqua_anglerfish", "aqua_arctik", "aqua_bahari",
      "aqua_siphon", "aqua_owlette", "aqua_driftwraith",
    ],
    spells: ["dusk_chill_touch", "bore_pebble_toss", "aqua_chill", "dusk_bone_snare", "bore_sand_trap"],
  },
  {
    id: "pre_eclipse_guard",
    name: "Eclipse Guard",
    note: "DAWN + DUSK + BOLT — light, shadow and the spark between.",
    // The pair the game keeps apart, plus the element that does not care which
    // wins. DAWN and DUSK counter each other card-for-card, so this build is
    // deliberately at war with itself and BOLT is what settles the argument.
    premade: true,
    boardSize: 4,
    cards: [
      "dawn_able", "dawn_glime", "dawn_lazor", "dawn_raya", "dawn_drakonbane",
      "dawn_kosmos", "dusk_crow", "dusk_gravekeeper", "dusk_scarlett", "dusk_ghastly",
      "dusk_brute", "dusk_aranea", "bolt_junker", "bolt_drshock", "bolt_buzz",
      "bolt_sentry", "bolt_zagphu", "bolt_jack_arc",
    ],
    spells: ["dawn_sunbeam", "dusk_chill_touch", "bolt_zap", "dawn_cleansing_light", "dusk_bone_snare"],
  },
];




/** The 5x5 builds, written out rather than derived.
 *
 *  These used to be `standard.cards ++ LARGE_EXTRAS[id]`, which kept the two
 *  formats honest at the cost of making them the same deck. They are not the
 *  same deck: synergy weighting — picking cards that set up and pay off each
 *  other's statuses — measured +5.5 on the small board and -5.9 on the large
 *  one over 528 games a cell, both real, and the coupling meant neither could
 *  be taken without the other. 4x4 is tight and short and rewards combos;
 *  5x5 is wide and long and rewards breadth.
 *
 *  The cost of writing them out is that a card changed in a 4x4 list no longer
 *  carries into its 5x5 twin. `premade-decks.test.ts` covers what the
 *  derivation used to guarantee for free: exact size, an even element split, a
 *  full book, real card ids, and one large build per standard one.
 *
 *  These lists are FROZEN from what the derivation produced, so decoupling
 *  moved nothing here — the only thing that changed is the 4x4 hard rung. */
const LARGE_DECKS: PremadeDeck[] = [
  {
    id: "pre_inferno_blitz_5",
    name: "Inferno Blitz",
    note: "PYRO + BOLT — fast burn and shock aggression.",
    premade: true,
    boardSize: 5,
    cards: [
      "bolt_zap", "bolt_jolt", "pyro_flamehound", "pyro_staph", "pyro_ash_boar",
      "bolt_jellyfish", "pyro_firebird", "bolt_lytning", "pyro_fenix", "pyro_sseerr",
      "bolt_thundercat", "bolt_thunder", "pyro_volcanon", "pyro_sarra", "bolt_shoksa",
      "pyro_pyrogon", "bolt_stingray", "bolt_drshock", "bolt_twotales", "bolt_kore",
      "bolt_buzz", "bolt_static", "bolt_webster", "pyro_smog_card", "pyro_bbq",
      "pyro_ingit", "pyro_spitfire", "pyro_fenrir", "bolt_junker", "pyro_sparky",
    ],
    spells: ["bolt_zap", "pyro_flare_push", "pyro_ember_trap", "bolt_overload_field", "bolt_lightning_storm", "pyro_ashfall", "bolt_power_grid", "pyro_cataclysm"],
  },
  {
    id: "pre_frostkeep_5",
    name: "Frostkeep",
    note: "AQUA + BORE — tanky control that grinds you out.",
    premade: true,
    boardSize: 5,
    cards: [
      "bore_hillbilly", "aqua_misty", "aqua_subcool", "aqua_kinguin", "aqua_octoirate",
      "aqua_owlette", "bore_shift", "aqua_blackbeard", "bore_monger", "aqua_polarbear",
      "bore_rhe", "bore_obsidi", "aqua_polarking", "bore_sandman", "aqua_tide",
      "aqua_anglerfish", "bore_rohojohn", "bore_krysteel", "bore_cavedweller", "bore_crock",
      "bore_clubber", "bore_smith", "bore_rockgoblin", "bore_rollo", "aqua_icyninza",
      "aqua_krakler", "aqua_bahari", "aqua_vaporem", "bore_kcor", "aqua_piranha",
    ],
    spells: ["aqua_chill", "aqua_frost_patch", "bore_stone_wall", "bore_shatterpoint", "aqua_maelstrom", "bore_bulwark", "aqua_dense_fog", "bore_bedrock"],
  },
  {
    id: "pre_radiant_host_5",
    name: "Radiant Host",
    note: "DAWN + LEAF — heals and buffs behind a wall of bodies.",
    premade: true,
    boardSize: 5,
    cards: [
      "dawn_beam", "leaf_splint", "leaf_leaf", "dawn_drakonbane", "dawn_amble",
      "leaf_dartfrog", "dawn_solara", "leaf_sprinu", "leaf_citra", "dawn_solstice",
      "leaf_sumerose", "dawn_clipsey", "leaf_elderroot", "dawn_aurelion", "leaf_fallow",
      "dawn_imperator", "leaf_fallona", "dawn_star", "dawn_sphere", "dawn_glime",
      "dawn_musk_ox", "dawn_lazor", "dawn_veil", "leaf_stickviper", "leaf_cactus",
      "leaf_greegon", "leaf_alpha", "leaf_squanch", "dawn_flash", "leaf_nettle",
    ],
    spells: ["leaf_sprout", "dawn_cleansing_light", "leaf_bramble_wall", "leaf_groves_blessing", "dawn_solar_flare", "dawn_grace", "dawn_blazing_sun", "dawn_judgment"],
  },
  {
    id: "pre_nightfall_5",
    name: "Nightfall",
    note: "DUSK + GALE — evasive assassins that hit and vanish.",
    premade: true,
    boardSize: 5,
    cards: [
      "gale_sirocco", "gale_luna", "gale_tumbleweed", "gale_hawk", "dusk_reaper",
      "gale_vaga", "dusk_skulldrake", "gale_klouy", "dusk_ghastly", "dusk_haunt",
      "dusk_wedded_wraith", "gale_wolfbane", "dusk_ravven", "gale_omega", "dusk_nightfang",
      "dusk_shadowhorsemen", "gale_masala", "dusk_gravekeeper", "gale_skyforce", "gale_toxhawk",
      "gale_whirlwolf", "gale_hawko", "gale_guan", "dusk_vamp", "dusk_spider",
      "dusk_skeleton_knight", "dusk_gool", "dusk_scarlett", "gale_syt_bird", "dusk_pumpkin",
    ],
    spells: ["gale_gust", "dusk_chill_touch", "dusk_bone_snare", "gale_squall_line", "dusk_wake_of_the_dead", "dusk_shadow_step", "dusk_nightfall", "gale_vortex_strike"],
  },
  {
    id: "pre_tempest_5",
    name: "Tempest",
    note: "AQUA + GALE + BOLT — three-element lockdown.",
    premade: true,
    boardSize: 5,
    cards: [
      "aqua_subcool", "aqua_kinguin", "gale_tumbleweed", "aqua_octoirate", "gale_vaga",
      "gale_angale", "bolt_zagphu", "bolt_lytning", "aqua_cryo", "gale_masala",
      "bolt_thundercat", "bolt_sentry", "bolt_striik", "gale_wista", "bolt_general",
      "aqua_polarking", "gale_klipso", "aqua_kraken", "aqua_misty", "aqua_icyninza",
      "aqua_bahari", "aqua_vaporem", "gale_toxhawk", "gale_whirlwolf", "gale_hawko",
      "bolt_twotales", "bolt_static", "bolt_kore", "gale_skyforce", "bolt_zap",
    ],
    spells: ["aqua_chill", "aqua_frost_patch", "gale_gust", "bolt_overload_field", "bolt_lightning_storm", "gale_downdraft", "aqua_dense_fog", "gale_jetstream"],
  },
  {
    id: "pre_blight_5",
    name: "Blight",
    note: "LEAF + PYRO + DUSK — three-element attrition.",
    premade: true,
    boardSize: 5,
    cards: [
      "leaf_stickviper", "pyro_staph", "dusk_silkstalker", "leaf_dartfrog", "pyro_scully",
      "dusk_reaper", "leaf_greegon", "pyro_spitfire", "dusk_ghastly", "leaf_citra",
      "pyro_firebird", "dusk_haunt", "leaf_sumerose", "pyro_fenrir", "dusk_wedded_wraith",
      "leaf_elderroot", "pyro_magmaw", "dusk_nightfang", "leaf_cactus", "leaf_alpha",
      "leaf_nettle", "pyro_bbq", "pyro_smog_card", "pyro_sparky", "dusk_spider",
      "dusk_gool", "dusk_scarlett", "dusk_skeleton_knight", "leaf_birch", "pyro_ingit",
    ],
    spells: ["pyro_ember_trap", "dusk_chill_touch", "dusk_bone_snare", "dusk_wake_of_the_dead", "leaf_bramble_wall", "leaf_thorn_patch", "pyro_ashfall", "dusk_grave_pit"],
  },
  {
    id: "pre_scrapyard_reactor_5",
    name: "Scrapyard Reactor",
    note: "BOLT + PYRO — machines that punish contact. Everything you touch bites back.",
    premade: true,
    tier: "easy",
    boardSize: 5,
    // The large cut trades none of that — it just has room for the second
    // rank of machines, and for Voltogon and Magmadon behind them.
    cards: [
      "bolt_zap", "bolt_twotales", "bolt_electricel", "bolt_scrapper", "bolt_zagphu",
      "bolt_webster", "bolt_storm", "bolt_thundercat", "bolt_voltcher", "bolt_sentry",
      "bolt_lytning", "bolt_buzzard", "bolt_zoez", "bolt_havoc", "bolt_voltogon",
      "pyro_ingit", "pyro_sparky", "pyro_baboom", "pyro_firecrack", "pyro_ember_scorpion",
      "pyro_ash_boar", "pyro_wick", "pyro_firebird", "pyro_fenix", "pyro_sarra",
      "pyro_scully", "pyro_firefly", "pyro_magmaw", "pyro_burnout", "pyro_spitfire",
    ],
    spells: ["bolt_overload_field", "pyro_firewall", "pyro_heatwave", "bolt_power_grid", "pyro_inferno_pit", "pyro_spark", "bolt_lightning_storm", "pyro_ember_trap"],
  },
  {
    id: "pre_deeproot_ambush_5",
    name: "Deeproot Ambush",
    note: "LEAF + BORE — roots you to the spot, then bites what can no longer move.",
    premade: true,
    tier: "hard",
    boardSize: 5,
    // Thirty cards is where the lock actually closes: more roots, more bodies
    // to hold the line while they take hold, and Warden behind it.
    cards: [
      "leaf_stickviper", "leaf_weeds", "leaf_oak", "leaf_python", "leaf_sticks",
      "leaf_gecko", "leaf_hunter", "leaf_walking_tree", "leaf_sumerose", "leaf_darth",
      "leaf_citra", "leaf_whintey", "leaf_snapmaw", "leaf_season", "leaf_leaf",
      "bore_cavedweller", "bore_iron", "bore_thorny_ripper", "bore_old_timer", "bore_rockgoblin",
      "bore_ankylosaur", "bore_rock", "bore_stone", "bore_krysteel", "bore_rhe",
      "bore_bolder", "bore_shift", "bore_diam", "bore_kobra", "bore_bastion",
    ],
    spells: ["leaf_snare", "leaf_thorn_patch", "bore_sand_trap", "leaf_withering_grasp", "bore_tremor", "leaf_overgrowth", "bore_bulwark", "leaf_bloodroot_surge"],
  },
  {
    id: "pre_skydream_5",
    name: "Skydream",
    note: "GALE + DAWN — drags you out of position, then lights up whatever is left standing.",
    premade: true,
    tier: "elite",
    scriptedOpening: ELITE_OPENING_STACK,
    boardSize: 5,
    // On the big board displacement is worth more, because there is further to
    // be moved and longer to spend getting back.
    cards: [
      "gale_sirocco", "gale_hawko", "gale_duster", "gale_megair", "gale_breeze",
      "gale_whirlwolf", "gale_windsor", "gale_klouy", "gale_vaga", "gale_sway",
      "gale_masala", "gale_rayfen", "gale_wista", "gale_dreamcatcher", "gale_bluejay",
      "dawn_beam", "dawn_roy", "dawn_shine", "dawn_stbern", "dawn_glime",
      "dawn_star", "dawn_oxin", "dawn_goldeneagle", "dawn_solstice", "dawn_raya",
      "dawn_ty", "dawn_halo", "dawn_warphant", "dawn_lassos", "dawn_aurelion",
    ],
    spells: ["gale_gust", "dawn_sunbeam", "gale_tailwind", "dawn_radiant_barrier", "gale_cyclone", "dawn_solar_flare", "gale_jetstream", "dawn_dawns_grace"],
  },
  {
    id: "pre_drowned_web_5",
    name: "Drowned Web",
    note: "AQUA + DUSK — pulls you under the surface and fills the water with spiders.",
    premade: true,
    tier: "mid",
    boardSize: 5,
    // More water and more web. Glacius and Nightfang cap it, and the swarm has
    // the squares to actually spread across.
    cards: [
      "aqua_piranha", "aqua_subcool", "aqua_icyninza", "aqua_arctik", "aqua_harp",
      "aqua_siphon", "aqua_blackice", "aqua_icynin", "aqua_anos", "aqua_cryo",
      "aqua_vaporem", "aqua_icewall", "aqua_driftwraith", "aqua_killerwhale", "aqua_glacius",
      "dusk_spider", "dusk_pumpkin", "dusk_harve", "dusk_jackl", "dusk_doom",
      "dusk_widowbite", "dusk_zhunk", "dusk_hix", "dusk_sarachnid", "dusk_ghastly",
      "dusk_violet", "dusk_ender", "dusk_aranea", "dusk_destro", "dusk_nightfang",
    ],
    spells: ["aqua_chill", "dusk_chill_touch", "aqua_ice_wall", "dusk_phantom_spikes", "aqua_maelstrom", "dusk_veil_of_shadows", "aqua_downpour", "dusk_grave_pit"],
  },
  {
    id: "pre_sapling_creek_5",
    name: "Sapling Creek",
    note: "LEAF + AQUA — a wall of bodies with no wall. Nothing holds a square and nothing heals.",
    premade: true,
    boardSize: 5,
    tier: "easy",
    cards: [
      "leaf_nettle", "leaf_leaf", "leaf_nightshade", "leaf_birch", "leaf_dande",
      "leaf_guardian", "leaf_splint", "leaf_rubyo", "leaf_thorn", "aqua_bahari",
      "aqua_rain", "aqua_siren", "aqua_blub", "aqua_bulletshrimp", "aqua_krakler",
      "aqua_tide", "aqua_sapphire", "aqua_magalogoon", "leaf_stickviper", "leaf_fallow",
      "leaf_alpha", "leaf_gecko", "leaf_sumerose", "leaf_efy", "aqua_blackbeard",
      "aqua_glacius", "aqua_bootlegger", "aqua_icynin", "aqua_liquark", "aqua_driftwraith",
    ],
    spells: ["leaf_thorn_patch", "leaf_bramble_wall", "leaf_lushfield", "leaf_withering_grasp", "aqua_maelstrom", "aqua_ice_wall", "aqua_downpour", "leaf_overgrowth"],
  },
  {
    id: "pre_dust_patrol_5",
    name: "Dust Patrol",
    note: "BORE + GALE — slow out of the gate and stuck in the front rank. Outlast it.",
    premade: true,
    boardSize: 5,
    tier: "easy",
    cards: [
      "bore_cosmic", "bore_sling", "bore_valcana", "bore_score", "bore_crock",
      "bore_warthog", "bore_sheish", "bore_obsidi", "bore_steel", "gale_hawk",
      "gale_kloud", "gale_gastly", "gale_tumbleweed", "gale_luna", "gale_wailverine",
      "gale_omega", "gale_eagon", "gale_klipso", "bore_kcor", "bore_rohojohn",
      "bore_rock", "bore_rollo", "bore_bolder", "bore_prism", "gale_bluejay",
      "gale_duster", "gale_buf", "gale_vaga", "gale_wolfbane", "gale_tempest",
    ],
    spells: ["gale_downdraft", "gale_squall_line", "gale_jetstream", "gale_vortex_strike", "bore_tremor", "bore_stone_wall", "bore_bedrock", "gale_gale_force"],
  },
  {
    id: "pre_ember_wake_5",
    name: "Ember Wake",
    note: "PYRO + DUSK — hits hard and dies fast. No front line to hit through and no one to patch it.",
    premade: true,
    boardSize: 5,
    tier: "easy",
    cards: [
      "pyro_florence", "pyro_taper", "pyro_dynomight", "pyro_volcanon", "pyro_ash_boar",
      "pyro_firebird", "pyro_sseerr", "pyro_fenrir", "pyro_infernus_rex", "dusk_skrow",
      "dusk_ravven", "dusk_crow", "dusk_vamp", "dusk_silkstalker", "dusk_reaper",
      "dusk_brute", "dusk_hoax", "dusk_skelider", "pyro_flamehound", "pyro_firefly",
      "pyro_sol", "pyro_ember_scorpion", "pyro_woof", "pyro_magmaw", "dusk_ender",
      "dusk_wedded_wraith", "dusk_spider", "dusk_widowbite", "dusk_sarachnid", "dusk_nightfang",
    ],
    spells: ["pyro_ember_trap", "pyro_firewall", "pyro_heatwave", "dusk_phantom_spikes", "pyro_cataclysm", "dusk_veil_of_shadows", "dusk_nightfall", "pyro_inferno_pit"],
  },
  {
    id: "pre_static_shallows_5",
    name: "Static Shallows",
    note: "BOLT + DAWN — a pile of bodies with no plan behind them.",
    premade: true,
    boardSize: 5,
    tier: "easy",
    cards: [
      "bolt_stingray", "bolt_drshock", "bolt_general", "bolt_keeper", "bolt_stormcaller",
      "bolt_storm", "bolt_thundercat", "bolt_voltcher", "bolt_voltogon", "dawn_clipsey",
      "dawn_kosmos", "dawn_flash", "dawn_glime", "dawn_golde", "dawn_musk_ox",
      "dawn_radiance", "dawn_drakonbane", "dawn_leo", "bolt_zipp", "bolt_striik",
      "bolt_thunder", "bolt_shock", "bolt_zagphu", "bolt_zoez", "dawn_sircrest",
      "dawn_aurora", "dawn_roy", "dawn_lazor", "dawn_ariel", "dawn_heir_tok",
    ],
    spells: ["dawn_cleansing_light", "bolt_overload_field", "bolt_power_grid", "dawn_judgment", "dawn_dawns_judgment", "dawn_radiant_barrier", "dawn_blazing_sun", "dawn_solar_flare"],
  },
  {
    id: "pre_tidal_gate_5",
    name: "Tidal Gate",
    note: "AQUA + DAWN — a front line, a healer behind it, and enough early bodies to keep pace.",
    premade: true,
    boardSize: 5,
    tier: "mid",
    cards: [
      "aqua_kinguin", "aqua_polarking", "aqua_misty", "aqua_buccaneers", "aqua_bahari",
      "aqua_octoirate", "aqua_rain", "aqua_sapphire", "aqua_magalogoon", "dawn_reflection",
      "dawn_commander", "dawn_sphere", "dawn_flash", "dawn_glime", "dawn_lazor",
      "dawn_musk_ox", "dawn_drakonbane", "dawn_equestrian", "aqua_coralgolem", "aqua_polarbear",
      "aqua_harp", "aqua_subcool", "aqua_cryo", "aqua_driftwraith", "dawn_veil",
      "dawn_warphant", "dawn_roy", "dawn_golde", "dawn_radiance", "dawn_heir_tok",
    ],
    spells: ["dawn_sunbeam", "aqua_steam_vent", "aqua_ice_wall", "aqua_downpour", "dawn_solar_flare", "dawn_grace", "dawn_dawns_grace", "dawn_judgment"],
  },
  {
    id: "pre_emberforge_5",
    name: "Emberforge",
    note: "PYRO + BORE — a wall that does not move, with burn coming over the top of it.",
    premade: true,
    boardSize: 5,
    tier: "mid",
    cards: [
      "pyro_bbq", "pyro_tiki", "pyro_magmadon", "pyro_canister", "pyro_aftermath",
      "pyro_flamehound", "pyro_wick", "pyro_firefly", "pyro_fenrir", "bore_hillbilly",
      "bore_armadillo", "bore_monger", "bore_the_coreborer", "bore_gemaga", "bore_crock",
      "bore_thorny_ripper", "bore_rollo", "bore_sheish", "pyro_heatsink_golem", "pyro_twins",
      "pyro_smog_card", "pyro_scorch", "pyro_scully", "pyro_sarra", "bore_rockgoblin",
      "bore_bearocks", "bore_clubber", "bore_warthog", "bore_obsidi", "bore_prism",
    ],
    spells: ["pyro_spark", "bore_bulwark", "pyro_firewall", "pyro_heatwave", "pyro_inferno_pit", "pyro_flare_push", "bore_fortify", "bore_shatterpoint"],
  },
  {
    id: "pre_thornwind_5",
    name: "Thornwind",
    note: "LEAF + GALE — trades on contact and keeps a healer behind the trade.",
    premade: true,
    boardSize: 5,
    tier: "mid",
    cards: [
      "leaf_oak", "leaf_lumberjack", "leaf_weeds", "leaf_elderroot", "leaf_nettle",
      "leaf_dartfrog", "leaf_rubyo", "leaf_trinezer", "leaf_python", "gale_sirocco",
      "gale_vvulture", "gale_gastly", "gale_tumbleweed", "gale_buf", "gale_wailverine",
      "gale_eagon", "gale_tempest", "gale_stormfang", "leaf_sprinu", "leaf_whintey",
      "leaf_stickviper", "leaf_bark_bushmen", "leaf_efy", "leaf_thorn", "gale_stormhide_bison",
      "gale_guan", "gale_duster", "gale_luna", "gale_wolfbane", "gale_klipso",
    ],
    spells: ["leaf_sprout", "gale_tailwind", "leaf_bramble_wall", "leaf_lushfield", "leaf_overgrowth", "leaf_snare", "leaf_groves_blessing", "gale_vortex_strike"],
  },
  {
    id: "pre_nightcircuit_5",
    name: "Nightcircuit",
    note: "DUSK + BOLT — status on your front rank while shooters take the squares.",
    premade: true,
    boardSize: 5,
    tier: "mid",
    cards: [
      "dusk_zombie_husk", "dusk_rip", "dusk_doom", "dusk_haunt", "dusk_harve",
      "dusk_skulldrake", "dusk_ghastly", "dusk_ravven", "dusk_brute", "bolt_junker",
      "bolt_kore", "bolt_keeper", "bolt_twotales", "bolt_scrapper", "bolt_zagphu",
      "bolt_voltcher", "bolt_voltogon", "bolt_jolt", "dusk_gravekeeper", "dusk_spectra",
      "dusk_gool", "dusk_jackl", "dusk_ender", "dusk_skelider", "bolt_buzz",
      "bolt_stormcaller", "bolt_electricel", "bolt_storm", "bolt_thundercat", "bolt_zoez",
    ],
    spells: ["dusk_chill_touch", "dusk_shadow_step", "bolt_overload_field", "bolt_power_grid", "dusk_grave_pit", "bolt_rewire", "bolt_power_rebate", "dusk_phantom_spikes"],
  },
  {
    id: "pre_solar_crown_5",
    name: "Solar Crown",
    note: "DAWN + PYRO — floods the board on round one, heals it, and shoots over the top.",
    premade: true,
    boardSize: 5,
    tier: "hard",
    cards: [
      "dawn_reflection", "dawn_veil", "dawn_imperator", "dawn_able", "dawn_amble",
      "dawn_solstice", "dawn_beam", "dawn_shine", "dawn_sircrest", "pyro_bbq",
      "pyro_twins", "pyro_canister", "pyro_flamehound", "pyro_firecrack", "pyro_ember_scorpion",
      "pyro_fenrir", "pyro_infernus_rex", "pyro_heatsink_golem", "dawn_oxin", "dawn_warphant",
      "dawn_stbern", "dawn_solara", "dawn_sparkle", "dawn_sphere", "pyro_tiki",
      "pyro_smog_card", "pyro_taper", "pyro_ash_boar", "pyro_firebird", "pyro_magmaw",
    ],
    spells: ["pyro_spark", "dawn_sunbeam", "dawn_cleansing_light", "pyro_flare_push", "dawn_dawns_grace", "pyro_ember_trap", "dawn_grace", "pyro_firewall"],
  },
  {
    id: "pre_titanfall_5",
    name: "Titanfall",
    note: "BORE + BOLT — cheap armour everywhere and shooters behind it. It takes squares first.",
    premade: true,
    boardSize: 5,
    tier: "hard",
    cards: [
      "bore_hillbilly", "bore_ankylosaur", "bore_armadillo", "bore_bastion", "bore_cavedweller",
      "bore_ufo", "bore_diam", "bore_cosmic", "bore_score", "bolt_jolt",
      "bolt_kore", "bolt_rodd", "bolt_stingray", "bolt_ning", "bolt_zap",
      "bolt_storm", "bolt_zoez", "bolt_elecdroid", "bore_rockgoblin", "bore_monger",
      "bore_smith", "bore_lithara", "bore_old_timer", "bore_sling", "bolt_buzz",
      "bolt_surge", "bolt_zipp", "bolt_electricel", "bolt_thundercat", "bolt_voltogon",
    ],
    spells: ["bore_pebble_toss", "bolt_zap", "bore_sand_trap", "bore_bulwark", "bore_fortify", "bolt_recon_ping", "bolt_rewire", "bolt_overload_field"],
  },
  {
    id: "pre_black_tide_5",
    name: "Black Tide",
    note: "DUSK + LEAF — never stops deploying, never stops healing, never stops trading.",
    premade: true,
    boardSize: 5,
    tier: "hard",
    cards: [
      "dusk_zombie_husk", "dusk_zhunk", "dusk_skullking", "dusk_doom", "dusk_scarlett",
      "dusk_haunt", "dusk_pumpkin", "dusk_ravven", "dusk_skeleton_knight", "leaf_oak",
      "leaf_greegon", "leaf_oakgre", "leaf_weeds", "leaf_nettle", "leaf_leaf",
      "leaf_hunter", "leaf_cactus", "leaf_efy", "dusk_gravekeeper", "dusk_rip",
      "dusk_gool", "dusk_soul_wisp", "dusk_harve", "dusk_jackl", "leaf_python",
      "leaf_warden", "leaf_stickviper", "leaf_bark_bushmen", "leaf_guardian", "leaf_rubyo",
    ],
    spells: ["leaf_sprout", "dusk_chill_touch", "leaf_thorn_patch", "dusk_shadow_step", "leaf_groves_blessing", "dusk_bone_snare", "leaf_snare", "leaf_bramble_wall"],
  },
  {
    id: "pre_maelstrom_5",
    name: "Maelstrom",
    note: "GALE + AQUA — freezes your opening and captures while you are still paying for it.",
    premade: true,
    boardSize: 5,
    tier: "hard",
    cards: [
      "gale_sirocco", "gale_windsor", "gale_guan", "gale_galeon", "gale_syt_bird",
      "gale_whirlwolf", "gale_fano", "gale_totem", "gale_skyforce", "aqua_blackice",
      "aqua_polarking", "aqua_misty", "aqua_anglerfish", "aqua_subcool", "aqua_bootlegger",
      "aqua_tide", "aqua_driftwraith", "aqua_kraken", "gale_stormhide_bison", "gale_vvulture",
      "gale_breeze", "gale_wista", "gale_swillow", "gale_toxhawk", "aqua_polarbear",
      "aqua_harp", "aqua_buccaneers", "aqua_bulletshrimp", "aqua_liquark", "aqua_hydrogon",
    ],
    spells: ["gale_gust", "aqua_chill", "aqua_frost_patch", "gale_tailwind", "aqua_dense_fog", "gale_downdraft", "aqua_steam_vent", "aqua_ice_wall"],
  },
  // ───────────────────────── ELITE (large board only) ─────────────────────
  //
  // Four two-element builds covering all eight elements exactly once, fifteen
  // cards each side. Imported from deck codes and kept AS BUILT — see
  // `scriptedOpening` for the measurements that say editing them makes them
  // worse, and for why the rung's difficulty is the opening rather than the
  // lists.
  {
    id: "pre_tombstone_5",
    name: "Tombstone",
    note: "DUSK + BORE — armour in front, the risen behind it, and it never runs out of bodies.",
    premade: true,
    boardSize: 5,
    tier: "elite",
    scriptedOpening: ELITE_OPENING_STACK,
    cards: [
      "dusk_reaper", "dusk_haunt", "dusk_pumpkin", "bore_rockgoblin", "bore_bearocks",
      "bore_sandman", "bore_deepest", "bore_krysteel", "bore_score", "bore_rollo",
      "bore_hillbilly", "dusk_zhunk", "dusk_rip", "dusk_hix", "dusk_violet",
      "dusk_zombie_husk", "bore_cavedweller", "bore_cosmic", "bore_thorny_ripper", "bore_sling",
      "bore_bolder", "bore_sheish", "bore_ufo", "dusk_vamp", "dusk_skeleton_knight",
      "dusk_jackl", "dusk_gool", "dusk_zombination", "dusk_skullking", "dusk_brute",
    ],
    spells: ["dusk_chill_touch", "bore_stone_wall", "dusk_veil_of_shadows", "bore_bedrock", "dusk_bone_snare", "bore_shatterpoint", "bore_mountains_fall", "dusk_endless_night"],
  },
  {
    id: "pre_chlorophyll_5",
    name: "Chlorophyll",
    note: "LEAF + DAWN — it out-heals what you can do to it, then out-reaches you.",
    premade: true,
    boardSize: 5,
    tier: "elite",
    scriptedOpening: ELITE_OPENING_STACK,
    cards: [
      "leaf_walking_tree", "leaf_sakuroot", "leaf_squanch", "dawn_glime", "dawn_beam",
      "dawn_shine", "dawn_musk_ox", "dawn_amble", "dawn_golde", "dawn_solara",
      "dawn_drakonbane", "dawn_leo", "dawn_equestrian", "dawn_sircrest", "leaf_sumerose",
      "leaf_trinezer", "leaf_fallow", "leaf_nightshade", "leaf_oak", "leaf_stickviper",
      "leaf_thorn", "leaf_darth", "leaf_dartfrog", "leaf_sticks", "leaf_nettle",
      "dawn_veil", "dawn_warphant", "dawn_ty", "leaf_sprinu", "dawn_reflection",
    ],
    spells: ["dawn_sunbeam", "leaf_lushfield", "dawn_eternal_dawn", "leaf_bramble_wall", "leaf_snare", "leaf_bloodroot_surge", "dawn_radiant_barrier", "leaf_withering_grasp"],
  },
  {
    id: "pre_blazing_cyclone_5",
    name: "Blazing Cyclone",
    note: "PYRO + GALE — the fastest rung on the ladder. It is across the board before you have paid for a wall.",
    premade: true,
    boardSize: 5,
    tier: "elite",
    scriptedOpening: ELITE_OPENING_STACK,
    cards: [
      "pyro_bbq", "pyro_florence", "pyro_staph", "pyro_baboom", "pyro_flamehound",
      "pyro_heatsink_golem", "pyro_firebird", "pyro_liza", "pyro_woof", "pyro_sarra",
      "pyro_fenix", "pyro_fenrir", "pyro_volcanon", "pyro_magmaw", "pyro_firefly",
      "gale_sirocco", "gale_hawko", "gale_swillow", "gale_duster", "gale_stormhide_bison",
      "gale_tumbleweed", "gale_luna", "gale_wailverine", "gale_guan", "gale_masala",
      "gale_vvulture", "gale_omega", "gale_stormfang", "gale_whirlwolf", "gale_totem",
    ],
    spells: ["pyro_cataclysm", "pyro_heatwave", "pyro_spark", "pyro_firewall", "pyro_flare_push", "gale_cyclone", "gale_jetstream", "gale_squall_line"],
  },
  {
    id: "pre_thunderstorm_5",
    name: "Thunderstorm",
    note: "AQUA + BOLT — fat cheap bodies all the way up, and it never has a turn it cannot use.",
    premade: true,
    boardSize: 5,
    tier: "elite",
    scriptedOpening: ELITE_OPENING_STACK,
    cards: [
      "aqua_hydrogon", "aqua_siren", "aqua_magalogoon", "aqua_driftwraith", "aqua_rain",
      "aqua_blackbeard", "aqua_sapphire", "aqua_liquark", "aqua_spinefin", "aqua_blub",
      "aqua_misty", "aqua_buccaneers", "aqua_bulletshrimp", "aqua_kinguin", "aqua_harp",
      "bolt_junker", "bolt_rodd", "bolt_zipp", "bolt_staticcloud", "bolt_scrapper",
      "bolt_ning", "bolt_buzzard", "bolt_striik", "bolt_surge", "bolt_general",
      "bolt_volta", "bolt_velvolt_knight", "bolt_shock", "bolt_voltcher", "bolt_buzz",
    ],
    spells: ["aqua_chill", "aqua_steam_vent", "aqua_ice_wall", "aqua_downpour", "bolt_lightning_storm", "bolt_power_rebate", "aqua_tsunami", "bolt_total_network_control"],
  },
  // ── THREE-ELEMENT ARCHETYPES ────────────────────────────────────────────
  // Untiered on purpose. The ladder's rungs hold exactly four decks each and
  // the elite rung fields every element exactly once, so a three-element build
  // cannot join either without breaking a rule that is doing real work. These
  // are shelf decks — pickable, not laddered — which is what "hand-tuned
  // archetype" has meant here all along.
  //
  // Split 6/6/6 on the standard board and 10/10/10 on the large one: the
  // evenness rule the element test already anticipated for three.
  {
    id: "pre_verdant_tide_5",
    name: "Verdant Tide",
    note: "LEAF + AQUA + DAWN — heal, hold, and outlast.",
    // THREE ELEMENTS, and the shell is the point: LEAF regrows, AQUA holds
    // the line and DAWN puts the health back. Nothing here kills quickly and
    // everything here refuses to die — a different question to answer than any
    // two-element build on the shelf asks.
    premade: true,
    boardSize: 5,
    cards: [
      "leaf_birch", "leaf_weeds", "leaf_python", "leaf_dartfrog", "leaf_hunter",
      "leaf_darth", "leaf_sumerose", "leaf_squanch", "leaf_snapmaw", "leaf_season",
      "aqua_anglerfish", "aqua_piranha", "aqua_bulletshrimp", "aqua_bahari", "aqua_krakler",
      "aqua_tide", "aqua_owlette", "aqua_sapphire", "aqua_polarking", "aqua_siren",
      "dawn_able", "dawn_sparkle", "dawn_shine", "dawn_lazor", "dawn_ariel",
      "dawn_solstice", "dawn_drakonbane", "dawn_warphant", "dawn_aurelion", "dawn_dawn",
    ],
    spells: ["leaf_sprout", "aqua_chill", "dawn_sunbeam", "leaf_thorn_patch", "aqua_frost_patch", "dawn_cleansing_light", "leaf_snare", "aqua_steam_vent"],
  },
  {
    id: "pre_stormfront_5",
    name: "Stormfront",
    note: "PYRO + BOLT + GALE — speed and burst, nothing held back.",
    // The opposite build. PYRO burns, BOLT paralyses and GALE moves the board
    // out from under you, and none of the three has a plan past round eight. The
    // fastest thing in the picker, and it loses to whatever it cannot finish.
    premade: true,
    boardSize: 5,
    cards: [
      "pyro_bbq", "pyro_sparky", "pyro_flamehound", "pyro_ash_boar", "pyro_slag_tortoise",
      "pyro_fenix", "pyro_tiki", "pyro_sseerr", "pyro_sol", "pyro_infernus_rex",
      "bolt_junker", "bolt_zap", "bolt_jolt", "bolt_buzz", "bolt_storm",
      "bolt_striik", "bolt_zagphu", "bolt_thunder", "bolt_zoez", "bolt_stormcaller",
      "gale_gastly", "gale_swillow", "gale_megair", "gale_buf", "gale_wailverine",
      "gale_fano", "gale_vaga", "gale_wista", "gale_totem", "gale_kloud",
    ],
    spells: ["pyro_spark", "bolt_zap", "gale_gust", "pyro_ember_trap", "bolt_recon_ping", "gale_downdraft", "pyro_flare_push", "bolt_rewire"],
  },
  {
    id: "pre_deep_shade_5",
    name: "Deep Shade",
    note: "DUSK + BORE + AQUA — grind them down in the dark.",
    // Attrition from three directions: DUSK drains, BORE will not move and AQUA
    // freezes whatever is left. The slowest deck on the shelf and the one most
    // likely to still be standing on the last round.
    premade: true,
    boardSize: 5,
    cards: [
      "dusk_crow", "dusk_zombie_husk", "dusk_jackl", "dusk_scarlett", "dusk_widowbite",
      "dusk_plaguecrow", "dusk_brute", "dusk_violet", "dusk_scar", "dusk_nightfang",
      "bore_cavedweller", "bore_iron", "bore_rockgoblin", "bore_ankylosaur", "bore_ufo",
      "bore_monger", "bore_bolder", "bore_shift", "bore_diam", "bore_bearocks",
      "aqua_anglerfish", "aqua_piranha", "aqua_bulletshrimp", "aqua_bahari", "aqua_krakler",
      "aqua_tide", "aqua_owlette", "aqua_sapphire", "aqua_polarking", "aqua_siren",
    ],
    spells: ["dusk_chill_touch", "bore_pebble_toss", "aqua_chill", "dusk_bone_snare", "bore_sand_trap", "aqua_frost_patch", "dusk_shadow_step", "bore_bulwark"],
  },
  {
    id: "pre_eclipse_guard_5",
    name: "Eclipse Guard",
    note: "DAWN + DUSK + BOLT — light, shadow and the spark between.",
    // The pair the game keeps apart, plus the element that does not care which
    // wins. DAWN and DUSK counter each other card-for-card, so this build is
    // deliberately at war with itself and BOLT is what settles the argument.
    premade: true,
    boardSize: 5,
    cards: [
      "dawn_able", "dawn_sparkle", "dawn_shine", "dawn_lazor", "dawn_ariel",
      "dawn_solstice", "dawn_drakonbane", "dawn_warphant", "dawn_aurelion", "dawn_dawn",
      "dusk_crow", "dusk_zombie_husk", "dusk_jackl", "dusk_scarlett", "dusk_widowbite",
      "dusk_plaguecrow", "dusk_brute", "dusk_violet", "dusk_scar", "dusk_nightfang",
      "bolt_junker", "bolt_zap", "bolt_jolt", "bolt_buzz", "bolt_storm",
      "bolt_striik", "bolt_zagphu", "bolt_thunder", "bolt_zoez", "bolt_stormcaller",
    ],
    spells: ["dawn_sunbeam", "dusk_chill_touch", "bolt_zap", "dawn_cleansing_light", "dusk_bone_snare", "bolt_recon_ping", "dawn_grace", "dusk_shadow_step"],
  },
];

export const PREMADE_DECKS: PremadeDeck[] = [...STANDARD_DECKS, ...LARGE_DECKS];

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
  return CARDS.filter((c) => !c.boss);
}

/** Is `id` a real, deck-eligible card (in CARDS, not a token, not a boss)? */
export function isBuildable(id: string): boolean {
  return CARDS.some((c) => c.id === id && !c.boss);
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
