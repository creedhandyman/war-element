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
import type { CardDef } from "../engine/types";

/** Floor-1 boss body budget; grows per floor. A SOFT cap: the band below
 *  tolerates +5, the same shape as the card set's ±2 stat band (Xilty is 82
 *  against Floor 1's 80, held deliberately). */
export const FLOOR1_BODY_CAP = 80;
export const BODY_CAP_PER_FLOOR = 40;
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
  tribeElement: string;
  /** Element B — where the mechanic comes from. The boss's Special and
   *  passives express THIS element, not A; it is why the fight plays the way
   *  it does. */
  mechanicElement: string;
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

/** The encounter, shaped for `createInitialState`'s P2 seat.
 *
 *  The formation is the deck; `stacked` hoists the cheap half so the boss's
 *  opening never hinges on a draw (the same measured reasoning as Thrones and
 *  elite gauntlet decks). Spells `[]`, deliberately: the boss's threats are
 *  its body, its Special and its tribe — a spellbook on top is chaos the
 *  puzzles never priced in. The boss CARD is not in the deck: place it with
 *  `voidBossSeat` after construction, outside the economy. */
export function buildVoidEncounter(boss: VoidBoss): {
  deck: string[];
  spells: string[];
  boardSize: 4 | 5;
  stacked: { P2: number };
} {
  return {
    deck: [...boss.summons],
    spells: [],
    // The doc's board: the boss holds the centre of a 5-slot home row, with 4
    // free slots beside it — advance to summon more, the player's own maths.
    boardSize: 5,
    stacked: { P2: Math.min(3, boss.summons.length) },
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
