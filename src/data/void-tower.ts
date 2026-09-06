/** Void Tower — the boss framework's data layer.
 *
 *  ── WHAT THIS IS ──────────────────────────────────────────────────────────
 *  Every Void Tower boss is built the same way: Element A gives the TRIBE,
 *  Element B gives the MECHANIC, and the boss fields a formation on its floor's
 *  gold budget. That formation is its tribe FIRST and either of its elements
 *  after — a boss is two elements, so it builds a proper two-element deck
 *  rather than whatever one tribe list happened to allow (see
 *  `bossSummonPool`). This file holds the floor-scaling maths, the boss roster, and the
 *  encounter builder. The boss CARDS themselves live in cards.ts, flagged
 *  `boss: true` (fought, never owned — see the flag's doc in types.ts).
 *
 *  Spec: `Downloads\War_Element_Void_Tower_Bosses.md`. Its companion mode doc
 *  (floors, run rules, rewards) was never written, so THE MODE IS NOT HERE —
 *  no screen, no run state, no reward loop. What is here is everything a fight
 *  needs, playable through the Void Trial events and headless tests.
 *
 *  ── THE 12-GOLD BUDGET IS A BUILD-TIME RULE ───────────────────────────────
 *  The boss has no second wallet. Its summons ARE its deck: the encounter
 *  hands `createInitialState` a formation whose total cost obeys the floor's
 *  budget, and the ordinary AI plays it on the ordinary income. What the
 *  budget buys is decided here, once, and validated by void-tower.test.ts —
 *  which is the difference between a validator (this) and a second economy.
 *
 *  Duplicates are allowed to the FULL formation caps (Rare ×3, Epic ×2,
 *  Legendary/Mythic ×1 — story.ts's DUPLICATE_CAP), unconditionally: the
 *  campaign's "epics stay unique until cap 18" refinement is a pacing rule for
 *  Act I skirmishes, and a boss fight is what that rule exists to save you
 *  from. TOKENS are legal summons — story `adds` are tokens by the same logic,
 *  and "a nest of identical spiders" is the fantasy.
 *
 *  ── NO RANDOM PERCENTAGES ─────────────────────────────────────────────────
 *  A puzzle is solved once and then executed; every dice roll converts skill
 *  into retry-until-lucky. Boss defs carry no chance-based field — enforced by
 *  test, not convention. The one sanctioned exception (per the doc's §6):
 *  randomness whose deterministic ANSWER is buildable, e.g. PARALYZE, because
 *  cleanse and immunity are real cards.
 */
import { CARD_INDEX, TOKENS, getDef } from "./cards";
import { DUPLICATE_CAP } from "./story";
import { deckSizeFor } from "./custom-decks";
import type { CardDef, Element } from "../engine/types";

/** Floor-1 boss body budget; grows per floor. A SOFT cap: the band below
 *  tolerates +5, the same shape as the card set's ±2 stat band (Xilty is 82
 *  against Floor 1's 80, held deliberately). */
/** 80 was calibrated for a fight that ended by CAPTURE in six to sixteen
 *  rounds. It does not survive the mode it is in now: a boss has to hold out
 *  against a whole 30-card deck for the length of the fight, and 80 body points
 *  is under two mythic cards. Measured, a Floor-1 boss at 80 dies around round
 *  16 against an AI-piloted premade — two thirds of the way through a clock it
 *  is supposed to be able to run out. */
// 170 -> 300, for the same reason BODY_CAP_PER_FLOOR moved: this was the
// ceiling for a 24-round bare fight at ~50% boss win, and the targets are now
// a 30-round clock at 50/60/60-70/80-90 by floor. Measured, Floor 1 sat at
// 22.4% against a 50% target — the bodies needed roughly doubling and the old
// ceiling forbade it.
export const FLOOR1_BODY_CAP = 300;
// 60 -> 90. The cap is a CEILING, not a target, and it was set when the goal
// was a 24-round clock and a bare fight. The goal is now a 30-round clock and
// floors 3-4 that expect the player to bring a tamed boss, which measured out
// at x1.85-2.2 body on most of the top two floors — straight through the old
// ceiling. Raising the ceiling is the honest move; pretending the target fits
// under it is not.
export const BODY_CAP_PER_FLOOR = 90;
export const BODY_CAP_TOLERANCE = 5;
export const bodyCap = (floor: number): number =>
  FLOOR1_BODY_CAP + BODY_CAP_PER_FLOOR * (floor - 1);

/** Gold the boss's formation may spend on summons, by floor. */
export const FLOOR1_SUMMON_BUDGET = 12;
export const SUMMON_BUDGET_PER_FLOOR = 8;
export const summonBudget = (floor: number): number =>
  FLOOR1_SUMMON_BUDGET + SUMMON_BUDGET_PER_FLOOR * (floor - 1);

/** The stat total a body actually fields — the same axes as the cost curve. */
export const bodyTotal = (d: CardDef): number =>
  d.dmg * d.hits + d.hp + d.shields * 2 + d.sp;

export interface VoidBoss {
  /** The boss's card id in CARDS (flagged `boss: true`). */
  cardId: string;
  /** Which floor's caps this fight is tuned to. */
  floor: number;
  /** Element A — where the tribe comes from. */
  tribeElement: Element;
  /** Element B — where the mechanic comes from. The boss's Special and
   *  passives express THIS element, not A; it is why the fight plays the way
   *  it does. */
  mechanicElement: Element;
  /** A THIRD element, Floor 5 and up.
   *
   *  Floors 1-4 are two-element designs on purpose — tribe from one, mechanic
   *  from the other, and the fight reads as the collision of exactly two ideas.
   *  Floor 5 lifts that: the giants are big enough to be three things at once,
   *  which widens both what they may field (`bossSummonPool`) and, on the card
   *  itself, which element auras they run (`elementAuras`).
   *
   *  Optional and floor-gated, so nothing below Floor 5 can quietly acquire a
   *  third element — `elementProblems` fails the build if one does. */
  thirdElement?: Element;
  /** A WALL this boss opens standing behind: a token pre-placed in the row in
   *  front of its own home row, the mirror of the Fortress Gates the player
   *  gets. Placed at SETUP and not summoned.
   *
   *  It has to be setup rather than a `summons` entry, and that is the whole
   *  reason this field exists: a summon lands on the summoner's HOME ROW, which
   *  is the row the boss is already standing in. She would have played her own
   *  gates beside herself instead of in front, which is not a wall, it is
   *  company. */
  wall?: string;
  /** The boss's tribe — its identity, what the brood is called, and what the
   *  reinforcement bench leads with. NOT the whole roster: a formation may also
   *  draw on either of the boss's two elements (see `bossSummonPool`). */
  tribe: string;
  /** The formation, priced against `summonBudget(floor)`. Duplicates listed
   *  explicitly — the list IS the spend. Tokens of the tribe are legal. */
  summons: string[];
  /** The lesson, in one line. Every Floor-1 boss teaches a different one. */
  puzzle: string;
}

/** Floor 1 — seven puzzles, each teaching a different lesson, so the floor is
 *  a tutorial for the whole tower. Skeleeze and Xilty are the doc's Floor 2/3
 *  bosses; their floor assignment is data, and they are authored now so the
 *  framework is proven against every mechanic it claims to support. */
export const VOID_BOSSES: VoidBoss[] = [
  {
    cardId: "boss_rotroot",
    floor: 1,
    tribeElement: "DUSK",
    mechanicElement: "LEAF",
    tribe: "Zombie",
    // 7 + 5 = 12, exact — the list that landed on the budget unprompted and
    // convinced the doc the number was right.
    summons: ["dusk_zombination", "dusk_rip"],
    puzzle: "The engine: kill the source, ignore the tokens.",
  },
  {
    cardId: "boss_skeleeze",
    floor: 2,
    tribeElement: "DUSK",
    mechanicElement: "GALE",
    tribe: "Skeleton",
    // 5 + 5 + 2 = 12. The cost-2 "Skeleton" is dusk_skeleton_tok — a TOKEN,
    // legal by the stated rule above, not by accident. (The doc's original
    // list also carried Gastly, which is a tribeless GALE card; GALE's
    // contribution is Skeleeze's mobility, not its board.)
    summons: ["dusk_brute", "dusk_ender", "dusk_skeleton_tok"],
    puzzle: "Positional: read the telegraph, clear the kill-column.",
  },
  {
    cardId: "boss_xilty",
    floor: 3,
    tribeElement: "DUSK",
    mechanicElement: "BOLT",
    tribe: "Spider",
    // 4 + 4 + 2 + 1 + 1 = 12. The doc's list said Silkstalker 3 and totalled 13
    // — Silkstalker is cost 4, so one Spider came off. The SECOND Spider went
    // back on when Widowbite was re-costed 3 -> 2 and left the formation a point
    // short: a brood is the right way for a Spider boss to spend a spare gold,
    // and it is a body already in the formation rather than a new face.
    summons: ["dusk_sarachnid", "dusk_silkstalker", "dusk_widowbite", "dusk_spider", "dusk_spider"],
    puzzle: "The status lock: bring cleanse or immunity.",
  },
  {
    cardId: "boss_permafrost",
    floor: 1,
    tribeElement: "AQUA",
    mechanicElement: "BORE",
    tribe: "Ice",
    // 2×3 + 3×2 = 12. The doc paired Wall with BORE's Cavernous, whose four
    // cards (5/6/9/10) cannot land on 12 at all — so the formula flips: tribe
    // from AQUA's Ice, the armour mechanic from BORE.
    summons: ["aqua_arctik", "aqua_arctik", "aqua_arctik", "aqua_icynin", "aqua_icynin"],
    puzzle: "The wall: break through, or go around.",
  },
  {
    cardId: "boss_overclock",
    // FLOOR 2. The swarm reads as a harder lesson than the four it stood beside
    // — "AoE it, or choke the approach" wants a collection with answers already
    // in it — and the line it stamps out now burns what it shoots and detonates
    // when it falls, which is not a Floor-1 tutorial any more.
    floor: 2,
    tribeElement: "BOLT",
    mechanicElement: "PYRO",
    tribe: "ARC",
    // 1×3 + 2×3 + 1×3 + 4 + 4 = 20, Floor 2's budget exactly. Still the wide
    // cheap tide the puzzle is built on — Sentry and Dynamo are line
    // supervisors, not a change of plan. Wisps are ARC tokens, legal by the
    // stated rule. (The doc's Forged Tech is mono-PYRO; ARC is BOLT's real
    // machine tribe, so the formula's A/B flips against the doc here too.)
    summons: [
      "bolt_zipp", "bolt_zipp", "bolt_zipp",
      "bolt_staticcloud", "bolt_staticcloud", "bolt_staticcloud",
      "bolt_static_wisp_tok", "bolt_static_wisp_tok", "bolt_static_wisp_tok",
      "bolt_sentry", "bolt_shoksa",
    ],
    puzzle: "The swarm: AoE it, or choke the approach.",
  },
  {
    cardId: "boss_nightshrike",
    floor: 1,
    tribeElement: "GALE",
    mechanicElement: "DUSK",
    tribe: "Avian",
    // 6 + 2×3 = 12 — and the one dual-element pool on the floor: Ravven is the
    // DUSK Avian, so the sky tribe genuinely crosses into shadow.
    summons: ["dusk_ravven", "gale_toxhawk", "gale_toxhawk", "gale_toxhawk"],
    puzzle: "The glass cannon: kill it first, or survive one round.",
  },
  {
    cardId: "boss_basilisk",
    // FLOOR 2. Attrition is a patience lesson, and patience is a poor first
    // thing to teach. Reptile is Basilisk's alone again now that Smolder leads
    // the Grove, so the list below is simply the best of the tribe rather than
    // the half Smolder left.
    floor: 2,
    tribeElement: "LEAF",
    mechanicElement: "AQUA",
    tribe: "Reptile",
    // 6 + 3×3 + 1×3 + 1×2 = 20, Floor 2's budget exactly, with LEAF's legend at
    // the head of it.
    summons: [
      "leaf_snapmaw",
      "leaf_gecko", "leaf_gecko", "leaf_gecko",
      "leaf_stickviper", "leaf_stickviper", "leaf_stickviper",
      "leaf_reptilian_tok", "leaf_reptilian_tok",
    ],
    puzzle: "Attrition: out-sustain it, or race the clock.",
  },
  {
    cardId: "boss_helion",
    floor: 2,
    tribeElement: "DAWN",
    mechanicElement: "BORE",
    tribe: "Suns",
    // 3x2 + 3x3 + 2x2 + 1 = 20, exact.
    //
    // NOT the guards it started with. Radiant Guardian x2 + Solstice x2 held 92%
    // of its fights with Helion at BLOCK 0 and a lance cut to 12 — the boss's
    // own kit measured irrelevant because the BROOD was winning, which is the
    // exact flaw the bench cap exists to prevent. Solstice carries a team-wide
    // status ward and Radiant Guardian is a dedicated screen; two of each is a
    // fortress the player never gets through, and a boss you never reach is not
    // a puzzle whatever its Special says.
    //
    // BORE is the MECHANIC and not the tribe on purpose: Cavernous is four
    // cards whose cheapest is 5 gold, so a BORE-tribe boss would field a bench
    // of two expensive bodies and deploy roughly one every three rounds.
    summons: [
      "dawn_amble", "dawn_amble",
      "dawn_musk_ox", "dawn_musk_ox", "dawn_musk_ox",
      "dawn_glime", "dawn_glime",
      "dawn_able",
    ],
    puzzle: "The siege: read the lane, and pay to leave it.",
  },
  {
    cardId: "boss_hoarfell",
    floor: 3,
    tribeElement: "AQUA",
    mechanicElement: "DAWN",
    tribe: "Ice",
    // 6 + 4×2 + 4×2 + 2×3 = 28, exact.
    //
    // ICE, not SeaC. It was SeaC on a funding claim that was simply wrong —
    // "Ice cannot fund a floor-2 budget, its four dearest total under 20" reads
    // the pool as if duplicates did not exist, and with the caps applied Ice
    // spends up to 48. The cost of that error was a frozen bison leading a
    // school of fish. It leads polar bears and frost elementals now, which is
    // what it looked like all along.
    //
    // Permafrost also holds Ice, on Floor 1, and that is a shape rather than a
    // clash: the frost tribe you met at the bottom of the tower turns up again
    // near the top with something much larger in front of it.
    summons: [
      "aqua_phrost",
      "aqua_polarbear", "aqua_polarbear",
      "aqua_cryo", "aqua_cryo",
      "aqua_arctik", "aqua_arctik", "aqua_arctik",
    ],
    puzzle: "The juggernaut: stop it once, or let it arrive.",
  },
  {
    cardId: "boss_thunderfangs",
    floor: 3,
    tribeElement: "GALE",
    mechanicElement: "BOLT",
    tribe: "Wolf",
    // 6 + 5x2 + 3x3 + 3 = 28, exact, and all GALE — Wolf spans GALE, PYRO and
    // LEAF, so an all-GALE pack is a choice rather than an accident.
    //
    // GALE is the TRIBE half because Wolf is a GALE tribe (five of its eight),
    // and BOLT has no wolves at all — so the storm has to be the mechanic. It
    // is the pairing the other way round from what the tribe list would let
    // you build.
    summons: [
      "gale_totem",
      "gale_omega", "gale_omega",
      "gale_luna", "gale_luna", "gale_luna",
      "gale_whirlwolf",
    ],
    puzzle: "The pack: for once, kill the escorts first.",
  },
  {
    cardId: "boss_vulcanyx",
    floor: 3,
    tribeElement: "BORE",
    mechanicElement: "PYRO",
    tribe: "Mountain Beasts",
    // 8 + 8 + 3x2 + 3x2 = 28, exact. TWO tribes' worth of identity and no
    // filler: PYRO's two 8-gold Volcanic legendaries out front — Infernus Rex
    // and Magmadon, the fire rex and the lava tank a lava rex ought to be
    // leading — behind them four Mountain Beasts, which is the whole of that
    // tribe twice over (it is two cards, both stone dinosaurs, both cost 3).
    //
    // THIS COSTS ABOUT 23 POINTS OF WIN RATE and is worth knowing before anyone
    // "fixes" it. The first draft spent the same 28 on six different cards —
    // Infernus Rex, Volcanon, Valcana, both dinosaurs, a Thorny Ripper — and on
    // an identical body it measured 62.5% where this reads 39.6%. The two are
    // even on paper (Volcanon + Valcana + Ripper is 100 stat points for 14 gold;
    // Magmadon + a dinosaur + a dinosaur is 100 points for 14) and the doubles
    // have MORE cards under the free-opening cost cap, so it is kit quality,
    // not stats or tempo: Magmadon is a passive Tank where the other two bring
    // something. The war party was chosen anyway and Vulcanyx's body pays for
    // it — which is why it is the heaviest boss on the tower.
    summons: [
      "pyro_infernus_rex", "pyro_magmadon",
      "bore_ankylosaur", "bore_ankylosaur",
      "bore_armadillo", "bore_armadillo",
    ],
    puzzle: "The apex: every body you feed it comes back as teeth.",
  },
  {
    cardId: "boss_umbranova",
    floor: 4,
    tribeElement: "PYRO",
    mechanicElement: "DAWN",
    tribe: "Dragon",
    // 10 + 9 + 7 + 5 + 5 = 36, exact. Five heavies rather than a swarm, which
    // is what a floor-4 formation should feel like next to floor 3's packs of
    // seven — and Dragon is the one tribe deep enough in BIG cards to do it.
    //
    // Dragon also spans all eight elements, so a mixed flight is the tribe
    // behaving normally rather than a compromise; it is led by the PYRO and
    // DAWN mythics the boss is named after either half of. Pyrogon STAYS here:
    // Cryovex takes the AQUA dragons, not the fire one.
    summons: [
      "pyro_pyrogon", "dawn_supernova", "gale_eagon", "pyro_sseerr", "pyro_fenrir",
    ],
    puzzle: "The rain: position buys nothing — outlast it or outrun it.",
  },
  {
    cardId: "boss_cryovex",
    floor: 4,
    tribeElement: "AQUA",
    mechanicElement: "DUSK",
    tribe: "Dragon",
    // 9 + 8 + 6 + 5 + 3 + 3 + 2 = 36, exact. THE AQUA DRAGONS, which is the whole
    // brief: every ice dragon the set owns — Hydrogon, Phrost, Sapphire,
    // Coilblade — plus DUSK's SkullDrake for the mechanic half, Glacius for
    // weight and an Arctik to round it out. Five of the seven are Dragons.
    //
    // HYDROGON is the aura carrier here (+4 SP to the Vapor half), and it is the
    // reason this reads as a flight rather than a pile: AQUA's dragons are all
    // slow and Hydrogon is what gets them moving. Umbranova keeps Pyrogon — the
    // fire aura dragon belongs with the fire boss.
    summons: [
      "aqua_hydrogon", "aqua_glacius", "aqua_phrost", "aqua_sapphire",
      "aqua_icynin", "dusk_skulldrake", "aqua_arctik",
    ],
    puzzle: "The deep freeze: break it early — every round held hits harder.",
  },
  {
    cardId: "boss_kazehaya",
    floor: 4,
    tribeElement: "LEAF",
    mechanicElement: "GALE",
    tribe: "Grove",
    // 8 + 8 + 4x2 + 3x2 + 3x2 = 36, exact. A RETINUE rather than a swarm, which
    // is the shape Floor 4 wants — seven bodies, every one of them wood or wind.
    //
    // The two TOKENS are the point of the formation rather than filler. The
    // Guardians hook what they hit one slot closer and the Warriors shove what
    // they hit one slot away, which between them means a player's line stops
    // being a line — and the hooking half is doing Kazehaya's own job for it,
    // twice a round, against a boss whose Special only closes distance once
    // every three. Warden and Galeon are the weight they work in front of.
    //
    // Grove is Smolder's tribe too, one floor down, and that repeat is
    // deliberate rather than a shortage: Umbranova and Cryovex already split
    // Dragon between them on this same floor. Smolder takes the BURNING grove;
    // this one takes the grove that learned to hold a line.
    summons: [
      "leaf_warden", "gale_galeon",
      "leaf_leafwind_guardian_tok", "leaf_leafwind_guardian_tok",
      "gale_whirlwind_warrior_tok", "gale_whirlwind_warrior_tok",
      "leaf_sakuroot", "leaf_sakuroot",
    ],
    puzzle: "The duellist: hit it small and often — one big swing and it throws your line back.",
  },
  {
    cardId: "boss_kato",
    floor: 4,
    tribeElement: "BORE",
    mechanicElement: "BOLT",
    tribe: "Cavernous",
    // 10 + 9 + 6 + 5x2 + 1 = 36, exact — the WHOLE of Cavernous, which is a
    // four-card tribe costing 5/6/9/10 and could not fund a floor below this
    // one. It has waited three floors for a budget that fits it.
    //
    // Cavernous is also the only tribe that reads as what Kato is: things grown
    // in the deep out of crystal and rock. The Zipp is the BOLT half showing up
    // in person, and the cheapest thing on the board next to a 10-gold mythic —
    // which is what a spark looks like beside a mountain.
    summons: [
      "bore_deepest", "bore_the_coreborer", "bore_score",
      "bore_obsidi", "bore_obsidi", "bolt_zipp",
    ],
    puzzle: "The thing that won't stay dead: kill it three times, differently each time.",
  },
  {
    cardId: "boss_smolder",
    floor: 1,
    tribeElement: "LEAF",
    mechanicElement: "PYRO",
    tribe: "Grove",
    // 1×3 + 1×3 + 2×3 = 12, exact — undergrowth, which is what catches first.
    //
    // GROVE, a tribe that did not exist until Smolder needed one. LEAF is the
    // plant element and had exactly one tribe, Reptile, so a burning tree ended
    // up leading a litter of lizards — which is what the tribe list allowed and
    // not what the card is. Seventeen of LEAF's thirty-three untribed cards are
    // plainly flora (Acorn, Birch, Nettle, Oak, Sticks, Elderroot, Thorn,
    // Hartwood…), so the gap was in the data rather than in the design.
    // 1x3 + 1x3 + 2x2 + 2 = 12, exact. An Oak traded for SMOG.
    //
    // Smolder was the only boss on the tower fielding a single element, and
    // every card in that army was cost-1-or-2 melee flora — which left the
    // puzzle ("everything that touches it burns, so fight it at RANGE") with no
    // answer at all to the range it was telling you to use. Smog is PYRO, the
    // mechanic half of the pairing and legal on that basis, and it is Ranged:
    // Black Smoke ticks 1 to the whole enemy board and heals the brood 1, every
    // round. Smoke off a burning tree, punishing exactly the stand-off the
    // fight demands, and the one engine an all-flora deck cannot otherwise hold.
    // 1 + 1x3 + 2x2 + 2x2 = 12, exact. A SECOND Smog, paid for with TWO Birches:
    // swapping a 1-cost Birch for a 2-cost Smog costs a gold the budget does not
    // have, so a second Birch came out rather than thinning the Nettles.
    // Eight bodies instead of nine, and a fair trade for doubling the only
    // ranged thing in the formation — two Smogs tick 2 a round across the whole
    // enemy board and heal the undergrowth 2, which is attrition an all-melee
    // grove cannot otherwise apply. Smog is rare, so x2 is inside its x3 cap.
    summons: [
      "leaf_birch",
      "leaf_nettle", "leaf_nettle", "leaf_nettle",
      "leaf_oak", "leaf_oak",
      "pyro_smog_card", "pyro_smog_card",
    ],
    puzzle: "The bonfire: everything that touches it burns — fight it at range.",
  },
  {
    cardId: "boss_spindle",
    // FLOOR 5. The tower's own element finally stands in it: every other boss
    // borrows two of the eight, and this one IS the ninth -- the thing the
    // building is named after, kept for the top.
    floor: 5,
    // VOID is the tribe, which is what makes `boss_oculus` the first card in
    // the game printed VOID and closes the auras.test.ts hole ("an element with
    // no cards is incomplete"). Its brood are the six Watcher tokens.
    tribeElement: "VOID",
    // DUSK is the mechanic the Special expresses -- Unblinking Gaze is a stare
    // that blinds.
    mechanicElement: "DUSK",
    // ...and BOLT is the lock in it. Three elements, which Floor 5 allows and
    // `elementProblems` enforces below it.
    thirdElement: "BOLT",
    tribe: "Watcher",
    // 8 + 6 + 6 + 5 + 5 + 4 + 4 + 3 + 3 = 44, exact -- Floor 5's budget.
    // Entirely its own brood, which no other boss can say: the Watchers are the
    // only VOID cards that exist, so the formation is the element.
    //
    // Duplicates are inside the formation caps (Rare x3, Epic x2,
    // Legendary/Mythic x1): Watcher and Lidless are Rare and appear twice,
    // Scryer and Sentinel are Epic and appear twice, Occulith is Legendary and
    // appears once.
    summons: [
      "void_occulith_tok",
      "void_sentinel_tok", "void_sentinel_tok",
      "void_scryer_tok", "void_scryer_tok",
      "void_lidless_tok", "void_lidless_tok",
      "void_watcher_tok", "void_watcher_tok",
    ],
    puzzle: "Attrition inverted: every swing you take feeds them. Kill the brood, not the eye.",
  },
  {
    cardId: "boss_skybreaker",
    // FLOOR 5, and the first boss to stand on it. `voidFloors()` is derived
    // from this array, so the floor exists because this line does — there is no
    // constant to bump and no gap to leave.
    floor: 5,
    tribeElement: "GALE",
    // BOLT, not AQUA. The design names three elements and the card can only
    // carry one, so the split is: GALE is the tribe (wind), BOLT is the
    // MECHANIC the Special expresses (the PARALYZE in the eye), and AQUA rides
    // on the basics as SCALD. `mechanicElement` is documented as "the element
    // the Special and passives express", and that is the thunder.
    mechanicElement: "BOLT",
    // THE THIRD, now that Floor 5 allows one. A hurricane is wind over warm
    // water with lightning in it, and it can finally be all three: GALE is the
    // tribe, BOLT is the mechanic the Special expresses (the PARALYZE in the
    // eye), AQUA is the SCALD its basics leave. It also widens what the boss may
    // field — see `bossSummonPool`.
    thirdElement: "AQUA",
    tribe: "Hurricane",
    // 7 + 6 + 6 + 5 + 5 + 7 + 5 + 1x3 = 44, exact — Floor 5's budget.
    //
    // A STORM FRONT, and the formation is chosen to rhyme with the boss rather
    // than to pad it. Zephyra carries the ORIGINAL Wind Wake (`onHitPush`,
    // named that on its own card) so the passive the fight is built on is
    // already on the field in its small form. The Thundering Hurricane is in
    // the formation as well as on the round-6 clock: the boss can be met by a
    // storm it did not have to wait for. The three Siroccos are the cheap wind
    // that fills the gaps a stationary boss cannot cover itself — Sirocco is
    // rare, so x3 is exactly its cap.
    summons: [
      "bolt_stormcaller", "gale_klipso", "gale_tempest",
      "gale_thundering_hurricane_tok",
      "gale_wista", "bolt_thunder", "gale_rayfen",
      "gale_sirocco", "gale_sirocco", "gale_sirocco",
      // Sightwing is the gold Klipso gave back when it moved 7 -> 6. Floor 5's
      // budget is asserted EXACTLY, so a re-cost anywhere in the set has to be
      // answered here; another Sirocco was not available (rare, and x3 is
      // already its cap), and a cost-1 scout is the cheapest thing that keeps
      // the front a wind formation rather than padding it with a stranger.
      "gale_syt_bird",
    ],
    puzzle: "The storm has legs: kill the hurricane and it is stranded, leave it and it blinks into your line.",
  },
  {
    cardId: "boss_continental",
    floor: 5,
    tribeElement: "BORE",
    mechanicElement: "LEAF",
    // TWO elements, not three. Floor 5 ALLOWS a third; it does not require one,
    // and a landmass with things growing on it is complete as two.
    tribe: "Cavernous",
    // 8 + 8 + 8 + 6 + 6 + 4x2 = 44, exact — Floor 5's budget.
    //
    // Sharing Cavernous with Kato is deliberate and not a clash: Kazehaya and
    // Smolder already share Grove, and a tribe is what a boss IS rather than
    // something it owns. The formation is drawn from the two ELEMENTS instead
    // of from the tribe, so it does not restage Kato's list — this is masonry
    // and old growth, the two things a continent is made of.
    //
    // It fields its own boulders, the way Skybreaker fields its own hurricane:
    // the rockfall can be met already in progress rather than only on the clock.
    summons: [
      "bore_bastion", "bore_bearocks", "leaf_warden",
      "bore_prism", "leaf_elderroot",
      "bore_rolling_boulder_tok", "bore_rolling_boulder_tok",
    ],
    puzzle: "The one you cannot out-damage: shields block per hit, so bring one big swing, not ten small ones.",
  },
  {
    cardId: "boss_kheiringer",
    floor: 5,
    tribeElement: "PYRO",
    mechanicElement: "BORE",
    tribe: "Volcanic",
    // 8x2 + 8 + 7 + 7 + 6 = 44, exact — Floor 5's budget.
    //
    // The WALL IS NOT IN HERE, and that is deliberate twice over. It costs her
    // nothing, the same way the player's Fortress Gates cost them nothing; and
    // it is placed at SETUP rather than summoned, because a summon lands on the
    // summoner's home row — the row she is already standing in. Carried in the
    // deck she would have played her gates BESIDE herself, which is not a wall.
    //
    // She opens standing behind masonry with giants in front of it and does not
    // come out. Killing her means getting through, around, or over.
    wall: "pyro_lava_gate_tok",
    summons: [
      "pyro_fire_giant_tok", "pyro_fire_giant_tok",
      "pyro_magmadon", "pyro_volcanon", "pyro_magmaw", "pyro_aftermath",
    ],
    puzzle: "The queen behind the wall: she never comes to you, so bring the wall down or go over it.",
  },
];

export const voidBossById = (cardId: string): VoidBoss | null =>
  VOID_BOSSES.find((b) => b.cardId === cardId) ?? null;

// ── Floor progression ────────────────────────────────────────────────────────
//
// DERIVED, not stored. A boss's defeat is already recorded by the trial-event
// settle path (`completeEvent` writes `void_<cardId>` into StorySave.eventsDone
// in the same save-write that pays the first-clear pack), so the tower's whole
// progression state is a pure function of `eventsDone` — one source of truth,
// no second field that can disagree with it, and nothing new to migrate. The
// price is that these helpers take the eventsDone ARRAY rather than the save,
// which also keeps this file free of a StorySave import cycle.

/** The event id a boss's trial writes on a win. The single definition —
 *  events.ts builds its trial ids from this, so the two cannot drift. */
/** The two elements a boss's fight is pitched on, tribe first, deduped. The UI
 *  shows this in place of a chip-count of the summons — see `ElChips.only`. */
export const voidBossElements = (cardId: string): Element[] | undefined => {
  const b = voidBossById(cardId);
  if (!b) return undefined;
  return [...bossElementSet(b)];
};

export const trialEventId = (cardId: string): string => `void_${cardId}`;

/** Every floor that has at least one boss, ascending. */
export const voidFloors = (): number[] =>
  [...new Set(VOID_BOSSES.map((b) => b.floor))].sort((a, b) => a - b);

export const bossesOnFloor = (floor: number): VoidBoss[] =>
  VOID_BOSSES.filter((b) => b.floor === floor);

export const bossDefeated = (eventsDone: string[], cardId: string): boolean =>
  eventsDone.includes(trialEventId(cardId));

/** A floor is cleared when EVERY boss on it is down. Floor 1 is seven lessons
 *  and the tower should not open its second act to someone who skipped five of
 *  them — the floor is the unit of progress, not the boss. */
export const floorCleared = (eventsDone: string[], floor: number): boolean =>
  bossesOnFloor(floor).every((b) => bossDefeated(eventsDone, b.cardId));

/** A floor is open when every floor BELOW it (that exists) is cleared. Ground
 *  floor is always open. Checked against the floors that actually hold bosses
 *  rather than `floor - 1`, so a gap in the numbering can never wall off the
 *  content above it. */
export const floorOpen = (eventsDone: string[], floor: number): boolean =>
  voidFloors().filter((f) => f < floor).every((f) => floorCleared(eventsDone, f));

// ── BOSS TAMING ──────────────────────────────────────────────────────────────
//
// Clear a floor and every boss on it turns ENRAGED. Go back, beat one while it
// is enraged, and it fights FOR you in the next three battles at a fraction of
// everything it has (`TAME_SCALE`).
//
// The shape of the loop is deliberate: it points BACKWARD. The reward for
// finishing a floor is a reason to return to it, and the thing you earn there
// is spent upstairs — so a floor you have cleared stops being finished content
// and becomes the armoury for the one above it.

/** What a tamed boss fights at — every stat AND its Special's damage, scaled by
 *  this. See `CardInstance.statScale`, read in `effectiveDmg`, `effectiveSp` and
 *  `resolveHit` so the Special is covered too; the body is scaled once at
 *  placement by `scaleInstance`.
 *
 *  0.5 -> 0.7 at the owner's call. NOTHING IN THE UI HARD-CODES "half" any
 *  more: every line that quotes a number reads it from here, because the first
 *  version had "half strength" written into three separate strings and a
 *  re-tune would have left the game describing a card it no longer fielded. */
export const TAME_SCALE = 0.7;

/** Battles a taming is good for. Spent on ENTERING a fight with it, win or
 *  lose — the honest reading, and the one that cannot be farmed by conceding. */
export const TAME_USES = 3;

/** What ENRAGED does. The taming trial has to be harder than the fight you
 *  already won, or "enraged" is a label rather than a state. Applied through
 *  the same `statScale` the taming uses, pointed the other way — so the Special
 *  scales with it, not just the body.
 *
 *  1.25 -> 1.5 -> 1.35, each at the owner's call. Half again on every line was
 *  a genuinely different fight, which was the point, and it turned out to be
 *  more than half again in practice: `statScale` multiplies the TOTAL, so a
 *  boss carrying a per-kill ramp gets the multiplier applied to the ramp as
 *  well as the printed line. The note beside `buffDmg` in combat.ts has the
 *  measurement — enraged Vulcanyx reaching a mean peak of +54 on a printed 41,
 *  a top swing of 223 into a 366 HP pool — and records that the WIN RATE never
 *  showed it, because the fight is lost to one swing rather than to an average.
 *
 *  135% keeps the trial harder than the fight already won, which is the whole
 *  requirement, without the compounding cases turning it into a different
 *  genre. Every reader derives from this constant — the two tests, the
 *  scaling in App, and the copy in BossDetail — so this line is the only
 *  place the number lives. */
export const ENRAGE_SCALE = 1.35;

/** A boss is ENRAGED once its floor is cleared.
 *
 *  Derived, like every other piece of tower progression — no stored flag that
 *  can disagree with `eventsDone`. Clearing a floor requires beating every boss
 *  on it, so "defeated" is implied and is not checked again here.
 *
 *  It STAYS enraged after taming. Re-beating it refills the uses rather than
 *  being refused, so running a stable dry is a setback and never a dead end. */
export const bossEnraged = (eventsDone: string[], cardId: string): boolean => {
  const b = voidBossById(cardId);
  return !!b && floorCleared(eventsDone, b.floor);
};

/** Battles left on a taming. 0 = not tamed (or spent). */
export const tameUsesLeft = (
  tamed: Record<string, number> | undefined, cardId: string,
): number => Math.max(0, Math.floor(tamed?.[cardId] ?? 0));

/** The boss's PRINTED card, scaled by `TAME_SCALE` — what the reveal and the
 *  picker show.
 *
 *  Rounded the way the real thing is: HP and shields rounded (they are
 *  rewritten on the instance by `scaleInstance`), damage and speed floored
 *  (they run through the effective-stat readers).
 *
 *  IT IS THE CARD, NOT THE BOARD, and that gap is real rather than sloppy.
 *  On the board a card also carries its element's aura — GALE's Zephyr grants
 *  up to +3 DMG off SP — and that lands BEFORE the scaling, so a tamed card can
 *  swing for more than its printed number scaled. A preview cannot know that
 *  without a GameState it does not have.
 *
 *  So the guarantee is one-directional and the test enforces exactly that: this
 *  never OVER-promises. A tamed boss is always at least as good as the numbers
 *  the player was shown, never worse. */
export function tamedStats(def: CardDef): { dmg: number; hp: number; shields: number; sp: number } {
  return {
    dmg: Math.floor(def.dmg * TAME_SCALE),
    hp: Math.max(1, Math.round(def.hp * TAME_SCALE)),
    shields: Math.max(0, Math.round(def.shields * TAME_SCALE)),
    sp: def.sp > 0 ? Math.max(1, Math.floor(def.sp * TAME_SCALE)) : 0,
  };
}

/** Every boss currently available to bring, with its remaining uses. */
export const tamedRoster = (
  tamed: Record<string, number> | undefined,
): { boss: VoidBoss; uses: number }[] =>
  VOID_BOSSES
    .map((boss) => ({ boss, uses: tameUsesLeft(tamed, boss.cardId) }))
    .filter((t) => t.uses > 0);

export const towerProgress = (eventsDone: string[]): { defeated: number; total: number } => ({
  defeated: VOID_BOSSES.filter((b) => bossDefeated(eventsDone, b.cardId)).length,
  total: VOID_BOSSES.length,
});

/** Does this card belong to the boss's tribe? Accepts multi-tribe cards and
 *  TOKENS — the summon rule is tribe membership, not deck legality. */
export function inTribe(defId: string, tribe: string): boolean {
  const d = CARD_INDEX[defId];
  if (!d) return false;
  const tribes = d.tribe == null ? [] : Array.isArray(d.tribe) ? d.tribe : [d.tribe];
  return tribes.includes(tribe);
}

/** Everything wrong with a boss's formation, or [] when it is legal. A list
 *  rather than a boolean so the test's failure names every violation at once. */
/** Everything a boss may legally summon: its TRIBE, plus anything of either of
 *  its two elements.
 *
 *  The framework started stricter — tribe members only — and that turned out to
 *  be a rule about tribe lists rather than about fights. Two elements is what a
 *  boss IS, so two elements is what it should be able to field, and the strict
 *  version kept forcing formations that were wrong in the fiction because they
 *  were the only thing legal: a burning tree leading lizards because LEAF owned
 *  exactly one tribe, a frozen bison leading fish, a siege engine that could not
 *  be BORE at all because Cavernous is four cards whose cheapest is 5 gold.
 *
 *  The tribe stays the boss's IDENTITY — it is what the brood is called and what
 *  the bench leads with — but it is no longer the whole roster. */
export function bossSummonPool(boss: VoidBoss): string[] {
  const els = bossElementSet(boss);
  return Object.values(CARD_INDEX)
    .filter((d) => !d.boss && (inTribe(d.id, boss.tribe) || els.has(d.element)))
    .sort((a, b) => a.cost - b.cost || a.id.localeCompare(b.id))
    .map((d) => d.id);
}

/** Every element this boss is pitched on — two below Floor 5, three at and
 *  above it. The single definition; the summon pool, the legality check and the
 *  UI chips all read it, so they cannot disagree about what a boss IS. */
export function bossElementSet(boss: VoidBoss): Set<Element> {
  const els = new Set<Element>([boss.tribeElement, boss.mechanicElement]);
  if (boss.thirdElement) els.add(boss.thirdElement);
  return els;
}

/** THE FLOOR GATE on a third element, as data. Floors 1-4 are two-element
 *  designs and a third arriving on one would be a silent power creep, so it is
 *  a build failure rather than a review note. */
export const THIRD_ELEMENT_FROM_FLOOR = 5;
export function elementProblems(boss: VoidBoss): string[] {
  const out: string[] = [];
  if (boss.tribeElement === boss.mechanicElement)
    out.push(`${boss.cardId}: tribe and mechanic elements are the same`);
  if (boss.thirdElement) {
    if (boss.floor < THIRD_ELEMENT_FROM_FLOOR)
      out.push(`${boss.cardId}: a third element is Floor ${THIRD_ELEMENT_FROM_FLOOR}+ only`);
    if (bossElementSet(boss).size !== 3)
      out.push(`${boss.cardId}: its third element repeats one it already has`);
  }
  return out;
}

export function summonProblems(boss: VoidBoss): string[] {
  const out: string[] = [];
  const budget = summonBudget(boss.floor);
  const spend = boss.summons.reduce((n, id) => n + (CARD_INDEX[id]?.cost ?? 999), 0);
  if (spend > budget) out.push(`spends ${spend} of a ${budget} budget`);
  const copies = new Map<string, number>();
  for (const id of boss.summons) {
    const d = CARD_INDEX[id];
    if (!d) { out.push(`unknown card ${id}`); continue; }
    // Tribe OR either element — see `bossSummonPool`.
    if (!inTribe(id, boss.tribe) && !bossElementSet(boss).has(d.element))
      out.push(`${id} is neither ${boss.tribe} nor ${[...bossElementSet(boss)].join("/")}`);
    copies.set(id, (copies.get(id) ?? 0) + 1);
  }
  for (const [id, n] of copies) {
    const cap = DUPLICATE_CAP[CARD_INDEX[id]?.rarity ?? ""] ?? 1;
    if (n > cap) out.push(`${id} ×${n} exceeds its cap of ${cap}`);
  }
  return out;
}

/** The tribe's rank and file, cheapest first — everything in CARDS that belongs
 *  to the tribe, tokens included, bosses never. The reinforcement pool. */
export function tribePool(tribe: string): string[] {
  return Object.values(CARD_INDEX)
    .filter((d) => !d.boss && inTribe(d.id, tribe))
    .sort((a, b) => a.cost - b.cost || a.id.localeCompare(b.id))
    .map((d) => d.id);
}

/** The formation padded out to a full deck.
 *
 *  THE BUG THIS FIXES: the summons were the whole P2 deck, so a boss brought
 *  2-9 cards to a fight where the player brings 30. It emptied its hand in the
 *  opening rounds and then stood there for the rest of the match with a rising
 *  gold pool and nothing to spend it on. Every Floor-1 puzzle was trivially
 *  won by outlasting an opponent that had already stopped playing.
 *
 *  So the budget keeps its real job and loses the one it was never meant to
 *  have. It still decides the OPENING — that is the promise the doc makes, and
 *  `stacked` hoists exactly those cards to the top of the deck. What follows is
 *  reinforcements: the tribe's cheapest bodies, cycled, so the boss can always
 *  afford the next one and the fight stays a fight. It is the same shape as the
 *  campaign's `formationSize(cap) === cap` — the enemy brings a whole deck
 *  matched to your card count — arrived at for the same reason.
 *
 *  Cheapest-first and cycled rather than the budgeted list repeated: repeating
 *  it would hand Rotroot fifteen Zombinations, turning a 12-Gold opening into a
 *  7-cost legendary every other round. Reinforcements should be the rank and
 *  file, not the elite, and a wave of chaff is what a tribe boss is for.
 *
 *  Duplicate caps deliberately do not apply here. They are a deckbuilding rule
 *  about variety; this is one tribe throwing bodies at you, and several tribes
 *  are too small to fill 30 slots without repeats anyway (Zombie has five). */
/** Ids of everything that is SPAWNED rather than drafted. */
const TOKEN_IDS = new Set(TOKENS.map((t) => t.id));

export function reinforcementPool(boss: VoidBoss): string[] {
  // A TOKEN IS NOT A REINFORCEMENT unless the boss asked for it by name.
  //
  // Tokens are what other cards PUT on the board — Continental's rockfall, the
  // tower's own Fortress Gates — and `tribePool` returns them alongside real
  // cards, cheapest first. Cavernous is Kato's tribe and Continental's, so its
  // cheapest member is Continental's 4-gold Rolling Boulder, which sat at the
  // front of Kato's bench; the element top-up below then reached into BORE and
  // added `void_fortress_gate_tok`, which is the wall the PLAYER stands behind.
  // Both were padded into the deck and duly summoned, on Kato's side, in a
  // fight that has nothing to do with either — measured at 3 boulders and 2
  // gates in a 12-card deck.
  //
  // Authored tokens still count: Skeleeze's cost-2 Skeleton is in its `summons`
  // on purpose, and reinforcing with more of them is the fight working.
  const authored = new Set<string>(boss.summons);
  const drafted = (id: string) => !TOKEN_IDS.has(id) || authored.has(id);
  const pool = tribePool(boss.tribe).filter(drafted);
  const bench = pool.slice(0, Math.max(2, Math.min(4, Math.ceil(pool.length / 2))));
  // THE TRIBE FIRST, TO EXHAUSTION. The bench wants four names and the slice
  // above takes only half the tribe, so a six-member tribe handed over three
  // and then went shopping in another element for the fourth while three of its
  // own stood unused. Reaching outside a tribe that is not empty is the bug,
  // and it is most visible on Spindle: VOID's entire existence is six Watchers,
  // and the bench pulled a BOLT card into a fight whose whole point is that the
  // brood has no allies.
  // ...but the bench is the CHEAP END, and that rule outranks this one. Kato's
  // tribe holds a card as dear as anything it can field, so exhausting the
  // tribe blindly promoted the elite onto the reinforcement bench -- which is
  // the exact failure the padding rule exists to stop (Rotroot with fifteen
  // Zombinations). Anything at or above the dearest thing the boss may field is
  // not rank and file, whoever it is related to.
  const dearest = Math.max(...bossSummonPool(boss).map((id) => getDef(id).cost));
  for (const id of pool) {
    if (bench.length >= 4) break;
    if (!bench.includes(id) && getDef(id).cost < dearest) bench.push(id);
  }
  // ...and only then outside it, for the tribes genuinely too small to field a
  // bench of four on their own.
  if (bench.length < 4) {
    for (const id of bossSummonPool(boss)) {
      if (bench.length >= 4) break;
      if (!bench.includes(id) && drafted(id)) bench.push(id);
    }
  }
  return bench;
}

export function paddedFormation(boss: VoidBoss, deckSize: number): string[] {
  const deck = [...boss.summons];
  const pool = reinforcementPool(boss);
  if (!pool.length) return deck; // no tribe to draw on; the formation stands alone
  for (let i = 0; deck.length < deckSize; i++) deck.push(pool[i % pool.length]);
  return deck;
}

/** The encounter, shaped for `createInitialState`'s P2 seat.
 *
 *  The budgeted formation opens the fight and `stacked` hoists it to the top of
 *  the deck, so the opening never hinges on a draw (the same measured reasoning
 *  as Thrones and elite gauntlet decks); `paddedFormation` fills the rest with
 *  tribe reinforcements so the boss does not run out of cards while the player
 *  still holds twenty. Spells `[]`, deliberately: the boss's threats are its
 *  body, its Special and its tribe — a spellbook on top is chaos the puzzles
 *  never priced in. The boss CARD is not in the deck: place it with
 *  `voidBossSeat` after construction, outside the economy. */
export function buildVoidEncounter(boss: VoidBoss): {
  deck: string[];
  spells: string[];
  boardSize: 4 | 5;
  stacked: { P2: readonly string[] };
} {
  // The doc's board: the boss holds the centre of a 5-slot home row, with 4
  // free slots beside it — advance to summon more, the player's own maths.
  const boardSize = 5 as const;
  return {
    // HALF the player's deck, not parity. The boss also brings a free 12-cost
    // body that never passes through the economy and a Special that fires free
    // every three rounds, so card-for-card parity was overshooting — and it
    // showed on the board rather than in the win column: a padded-to-30 boss
    // held seventeen to twenty-one bodies on a twenty-five slot board, which is
    // not a fight, it is a wall with a boss somewhere behind it. Halving it
    // costs nothing measurable in outcomes and gives the board back.
    deck: paddedFormation(boss, Math.round(deckSizeFor(boardSize) / 2)),
    spells: [],
    boardSize,
    // Hoist the BUDGETED cards BY NAME. The cheapest-first stack every other
    // scripted deck uses would do the opposite of what is wanted here: the
    // formation is the expensive half of a deck padded with cost-1 chaff, so
    // "three cheapest" is three pieces of chaff and the fight's centrepiece
    // sinks into the bottom twenty. What the puzzle promises is that the
    // formation SHOWS UP.
    stacked: { P2: [...boss.summons] },
  };
}

/** The head start the PLAYER gets in a boss fight, in gold, paid as round-1
 *  income.
 *
 *  A boss is placed outside the economy — a body standing there on round one,
 *  for nothing, while the player is still affording their first card. That
 *  asymmetry was never paid for, and this pays it.
 *
 *  TWO, and not the boss's 12-gold cost, because the boss does not HOLD twelve
 *  gold — it holds one body, which earns its side about a gold a round off the
 *  home slot it stands on. Twelve gold in the player's hand on round one is a
 *  different object entirely: it buys three or four bodies at once, against the
 *  boss's one. Measured across seven bosses and three decks:
 *
 *    +0g   53-83%      +4g   11-69%
 *    +2g   44-69%      +6g    3-56%
 *                      +12g   0-22%
 *
 *  At +12 the mode stops existing — Skeleeze and Permafrost win nothing at all
 *  — and putting the fights back in band from there would need every boss
 *  scaled between 1.5x and 4x, which is not compensating for a free body, it is
 *  rebuilding the tower around the compensation. +2 is the size that is a real
 *  head start and still leaves seven fights worth having.
 *
 *  One constant, so going back to "the boss's whole cost" is a one-line change
 *  followed by a re-tune, rather than a hunt. */
export const VOID_PLAYER_HEAD_START = 2;
export const voidPlayerHeadStart = (_bossCost: number): number => VOID_PLAYER_HEAD_START;

/** Where the boss stands: centre of P2's home row (row 0 on every board). */
export function voidBossSeat(boardSize: number): { row: number; col: number } {
  return { row: 0, col: Math.floor(boardSize / 2) };
}
/** Where a boss's own WALL stands: the three centre columns of the row directly
 *  in front of its home row — the mirror of `voidGateSeats`, narrower on
 *  purpose. Five would seal the board and a boss that cannot be reached at all
 *  is not a puzzle; three is wide enough to have to answer and narrow enough
 *  that going around the end is a real line of play. */
export function bossWallSeats(boardSize: number): { row: number; col: number }[] {
  const mid = Math.floor(boardSize / 2);
  return [mid - 1, mid, mid + 1]
    .filter((col) => col >= 0 && col < boardSize)
    .map((col) => ({ row: 1, col })); // the boss's home row is 0; this is in front of it
}

/** The id of the wall that stands in front of the player when a floor opens. */
export const VOID_GATE = "void_fortress_gate_tok";

/** Where the Fortress Gates stand: the WHOLE row directly in front of the
 *  player's home row — one gate per column, a wall between them and whatever is
 *  coming down the board.
 *
 *  In front of the home row rather than in it, deliberately. The home row is
 *  where the player summons from, and gates parked in those five slots would be
 *  taking every deployment square from the side they are meant to protect.
 *
 *  A full line rather than a single gate is what makes the screening rule read
 *  cleanly: each gate covers the square behind IT, so the line holds while it
 *  stands and every gate broken opens exactly one lane. Choosing which one to
 *  break, and living with the hole, is the decision the wall exists to create. */
export function voidGateSeats(boardSize: number): { row: number; col: number }[] {
  const home = boardSize - 1; // P1's home row
  return Array.from({ length: boardSize }, (_, col) => ({ row: home - 1, col }));
}


/** The determinism rule as data: fields no boss def may carry. Kept beside the
 *  bosses so adding a chance mechanic to one is a one-line diff AWAY from this
 *  list — visible, arguable, and test-breaking. */
export function chanceProblems(d: CardDef): string[] {
  const out: string[] = [];
  if (d.keywords.CRIT) out.push("CRIT keyword (a coin)");
  if (d.keywords.EVASION) out.push("EVASION keyword (a roll)");
  if (d.onHitStatus?.chance != null) out.push("onHitStatus.chance");
  if (d.basicMissPct) out.push("basicMissPct");
  if (d.blocksRangedChance) out.push("blocksRangedChance");
  if (d.onRevive?.secondChance) out.push("onRevive.secondChance");
  if (d.critIfFaster) out.push("critIfFaster");
  // Level Up rolls a d3 for which stat. No Super Squad member is a boss today;
  // this is here so the day one is promoted, the build says so.
  if (d.onKill?.randomStat) out.push("onKill.randomStat (a roll)");
  const params = d.special?.params ?? {};
  for (const k of ["statusChance", "doubleChance"]) {
    if (params[k] != null) out.push(`special.params.${k}`);
  }
  // getDef so a bad id throws loudly here rather than quietly passing.
  void getDef(d.id);
  return out;
}
