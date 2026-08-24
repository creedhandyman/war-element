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
import { CARD_INDEX, getDef } from "./cards";
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
export const FLOOR1_BODY_CAP = 170;
export const BODY_CAP_PER_FLOOR = 60;
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
    // 4 + 4 + 3 + 1 = 12. The doc's list said Silkstalker 3 and totalled 13 —
    // Silkstalker is cost 4, so one Spider comes off.
    summons: ["dusk_sarachnid", "dusk_silkstalker", "dusk_widowbite", "dusk_spider"],
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
  return [...new Set([b.tribeElement, b.mechanicElement])];
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
  const els = new Set<string>([boss.tribeElement, boss.mechanicElement]);
  return Object.values(CARD_INDEX)
    .filter((d) => !d.boss && (inTribe(d.id, boss.tribe) || els.has(d.element)))
    .sort((a, b) => a.cost - b.cost || a.id.localeCompare(b.id))
    .map((d) => d.id);
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
    if (!inTribe(id, boss.tribe)
        && d.element !== boss.tribeElement && d.element !== boss.mechanicElement)
      out.push(`${id} is neither ${boss.tribe} nor ${boss.tribeElement}/${boss.mechanicElement}`);
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
export function reinforcementPool(boss: VoidBoss): string[] {
  const pool = tribePool(boss.tribe);
  const bench = pool.slice(0, Math.max(2, Math.min(4, Math.ceil(pool.length / 2))));
  if (bench.length < 4) {
    for (const id of bossSummonPool(boss)) {
      if (bench.length >= 4) break;
      if (!bench.includes(id)) bench.push(id);
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
  const params = d.special?.params ?? {};
  for (const k of ["statusChance", "doubleChance"]) {
    if (params[k] != null) out.push(`special.params.${k}`);
  }
  // getDef so a bad id throws loudly here rather than quietly passing.
  void getDef(d.id);
  return out;
}
