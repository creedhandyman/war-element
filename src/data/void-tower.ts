/** Void Tower — the boss framework's data layer.
 *
 *  ── WHAT THIS IS ──────────────────────────────────────────────────────────
 *  Every Void Tower boss is built the same way: Element A gives the TRIBE,
 *  Element B gives the MECHANIC, and the boss summons its tribe on a 12-Gold
 *  budget. This file holds the floor-scaling maths, the boss roster, and the
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
 *  from. TOKENS of the tribe are legal summons — story `adds` are tokens by
 *  the same logic, and "a nest of identical spiders" is the fantasy.
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
  /** The tribe every summon must belong to. */
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
    floor: 1,
    tribeElement: "BOLT",
    mechanicElement: "PYRO",
    tribe: "ARC",
    // 1×3 + 2×3 + 1×3 = 12 — the whole budget in cost-1/2 machines, wide and
    // cheap, exactly the tide the puzzle wants. Wisps are ARC tokens, legal by
    // the stated rule. (The doc's Forged Tech is mono-PYRO; ARC is BOLT's real
    // machine tribe, so the formula's A/B flips against the doc here too.)
    summons: [
      "bolt_zipp", "bolt_zipp", "bolt_zipp",
      "bolt_staticcloud", "bolt_staticcloud", "bolt_staticcloud",
      "bolt_static_wisp_tok", "bolt_static_wisp_tok", "bolt_static_wisp_tok",
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
    floor: 1,
    tribeElement: "LEAF",
    mechanicElement: "AQUA",
    tribe: "Reptile",
    // 1×3 + 2×3 + 3 = 12.
    summons: [
      "leaf_stickviper", "leaf_stickviper", "leaf_stickviper",
      "leaf_python", "leaf_python", "leaf_python",
      "leaf_gecko",
    ],
    puzzle: "Attrition: out-sustain it, or race the clock.",
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
export function summonProblems(boss: VoidBoss): string[] {
  const out: string[] = [];
  const budget = summonBudget(boss.floor);
  const spend = boss.summons.reduce((n, id) => n + (CARD_INDEX[id]?.cost ?? 999), 0);
  if (spend > budget) out.push(`spends ${spend} of a ${budget} budget`);
  const copies = new Map<string, number>();
  for (const id of boss.summons) {
    const d = CARD_INDEX[id];
    if (!d) { out.push(`unknown card ${id}`); continue; }
    if (!inTribe(id, boss.tribe)) out.push(`${id} is not ${boss.tribe}`);
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
export function reinforcementPool(tribe: string): string[] {
  const pool = tribePool(tribe);
  // The CHEAP HALF, at least two and AT MOST FOUR.
  //
  // Cheap, because cycling the whole pool would put Rotroot's cost-7 legendary
  // in the rotation and hand it a Zombination every other round — the elite is
  // what the 12-Gold budget buys once, not what turns up forever afterwards.
  //
  // Capped, because "half the tribe" made a boss's bench a function of how many
  // cards its tribe happens to own, and that turned out to be the single
  // biggest thing separating these fights. Avian is 20 cards deep, so
  // Nightshrike fielded a curated ten-card GALE toolbox; Zombie is 5, so
  // Rotroot fielded three weak bodies. It was not the bosses that were
  // mismatched, it was their armies — Nightshrike won 97% of its fights with
  // the player holding an average of 0.1 cards alive, having never reached a
  // boss still sitting on two thirds of its HP. Four apiece puts every boss on
  // the same bench and hands the fight back to the boss.
  return pool.slice(0, Math.max(2, Math.min(4, Math.ceil(pool.length / 2))));
}

export function paddedFormation(boss: VoidBoss, deckSize: number): string[] {
  const deck = [...boss.summons];
  const pool = reinforcementPool(boss.tribe);
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

/** Where the boss stands: centre of P2's home row (row 0 on every board). */
export function voidBossSeat(boardSize: number): { row: number; col: number } {
  return { row: 0, col: Math.floor(boardSize / 2) };
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
