/** ACHIEVEMENTS — owner, 2026-09-28: "Could we start adding an achievement
 *  system?" Story, Void Tower and Collection for the first batch, then "add
 *  achievements for the Arena and online matches too"; paid in shards, more for
 *  harder ones, and a free pack for the hardest; claimed on the Achievements
 *  screen off Home.
 *
 *  PROGRESS IS DERIVED, NEVER STORED. Every achievement reads the save as it
 *  stands — cleared nodes, beaten bosses, the collection — so a player who did
 *  the thing before this shipped has already done it, and there is no second
 *  copy of the truth to drift. The two things the save could not otherwise
 *  answer, packs opened and cards crafted, are counted in `save.tally`.
 *
 *  CLAIMS ARE LEDGERED in `save.gifts` as `ach:<id>`, not in a field of their
 *  own. Older builds rebuild the save from the fields they know and would drop
 *  a new one — which is how Hard mode lost its flag — but they keep every
 *  string in the gifts ledger, so a claim can never be paid twice.
 *
 *  Ids are FOREVER: never reuse or remove one, or its ledger mark means
 *  something else. Retire an achievement by hiding it, not by deleting it. */
import { getDef } from "./cards";
import { bossesBeaten } from "./player";
import {
  ALL_NODES, PLACED_CARDS, REQUIRED_THRONES, THRONE_MYTHICS, addFreePacks, addShards, everCleared,
  isGate, isHard, nodeById, type StorySave,
} from "./story";
import { VOID_BOSSES, bossDefeated, bossesOnFloor, voidFloors } from "./void-tower";
import { DRAFT_MAX_WINS, draftWins } from "./draft";
import { EVENTS } from "./events";
import { RUN_LENGTH } from "./gauntlet";
import type { DeckTier } from "./custom-decks";

export type AchievementCategory = "story" | "tower" | "arena" | "online" | "collection";

export const ACHIEVEMENT_CATEGORIES: readonly { id: AchievementCategory; label: string }[] = [
  { id: "story", label: "Story" },
  { id: "tower", label: "Void Tower" },
  { id: "arena", label: "Arena" },
  { id: "online", label: "Online" },
  { id: "collection", label: "Collection" },
];

export interface AchievementReward {
  shards?: number;
  packs?: number;
}

export interface Achievement {
  /** Stable forever — it is the ledger key. */
  id: string;
  category: AchievementCategory;
  title: string;
  desc: string;
  /** How far along the save is, and how far it has to get. */
  measure: (save: StorySave) => { have: number; target: number };
  reward: AchievementReward;
}

// ── what the save already knows ─────────────────────────────────────────────

const lifetime = (save: StorySave): string[] => everCleared(save);
const thronesTaken = (ids: readonly string[]): number =>
  REQUIRED_THRONES.filter((id) => ids.includes(id)).length;
const gatesCrossed = (ids: readonly string[]): number =>
  ids.filter((id) => { const n = nodeById(id); return !!n && isGate(n); }).length;
const ownedPlaced = (save: StorySave): number => {
  const owned = new Set(save.collection);
  return PLACED_CARDS.filter((id) => owned.has(id)).length;
};
const foils = (save: StorySave): number => (save.hero?.shiny ?? []).length;
const done = (save: StorySave): string[] => save.eventsDone ?? [];

/** The element the player is closest to finishing, as owned / total. */
function bestElement(save: StorySave): { have: number; target: number } {
  const owned = new Set(save.collection);
  const byEl = new Map<string, { have: number; target: number }>();
  for (const id of PLACED_CARDS) {
    const el = getDef(id).element;
    const row = byEl.get(el) ?? { have: 0, target: 0 };
    row.target++;
    if (owned.has(id)) row.have++;
    byEl.set(el, row);
  }
  let best: { have: number; target: number } | null = null;
  for (const row of byEl.values())
    if (!best || row.have / row.target > best.have / best.target) best = row;
  return best ?? { have: 0, target: 1 };
}

const fixed = (target: number, have: (s: StorySave) => number) =>
  (save: StorySave) => ({ have: have(save), target });

/** Arena wins: the count kept since the Arena batch shipped, or — for a save
 *  that played before it — the least the save can PROVE: its best Streak, four
 *  wins for every Gauntlet rung it has cleared, and the wins of the draft run
 *  it holds. Three different modes, so no win is in two of them; and `max`
 *  rather than a sum with the count, which would add a win twice once the
 *  count had seen it too. */
function arenaWins(save: StorySave): number {
  const proven = (save.ladder?.best ?? 0)
    + RUN_LENGTH * (save.gauntlet?.cleared ?? []).length
    + draftWins(save.draft);
  return Math.max(save.tally?.arenaWins ?? 0, proven);
}
const bestStreak = (save: StorySave): number => save.ladder?.best ?? 0;
const gauntletRung = (rung: DeckTier) => (save: StorySave): number =>
  (save.gauntlet?.cleared ?? []).includes(rung) ? 1 : 0;
/** The most wins in one draft run — kept, or the run the save still holds. */
const bestDraft = (save: StorySave): number => Math.max(save.tally?.draftBest ?? 0, draftWins(save.draft));
/** The Arena's events — the one-time fights on Home. Void Trials are events
 *  too, but they are the Tower's, and count there. */
const ARENA_EVENTS = EVENTS.filter((e) => !e.bossId);
const eventsBeaten = (save: StorySave): number =>
  ARENA_EVENTS.filter((e) => (save.eventsDone ?? []).includes(e.id)).length;
const onlinePlayed = (save: StorySave): number => save.tally?.onlinePlayed ?? 0;
const onlineWins = (save: StorySave): number => save.tally?.onlineWins ?? 0;

// ── the list ────────────────────────────────────────────────────────────────

const FLOOR_ACHIEVEMENTS: Achievement[] = voidFloors().map((f) => ({
  id: `tower-floor-${f}`,
  category: "tower" as const,
  title: `Floor ${f}`,
  desc: `Beat every boss on Floor ${f} of the Void Tower.`,
  measure: (save: StorySave) => {
    const bosses = bossesOnFloor(f);
    return { have: bosses.filter((b) => bossDefeated(done(save), b.cardId)).length, target: bosses.length };
  },
  reward: { shards: 15 + 15 * f },
}));

export const ACHIEVEMENTS: readonly Achievement[] = [
  // ── Story ──────────────────────────────────────────────────────────────────
  { id: "story-first", category: "story", title: "First Steps",
    desc: "Clear your first node.",
    measure: fixed(1, (s) => lifetime(s).length), reward: { shards: 10 } },
  { id: "story-50", category: "story", title: "Seasoned",
    desc: "Clear 50 different nodes.",
    measure: fixed(50, (s) => lifetime(s).length), reward: { shards: 30 } },
  { id: "story-all", category: "story", title: "Every Stone Turned",
    desc: "Clear every node in the campaign.",
    measure: fixed(ALL_NODES.length, (s) => ALL_NODES.filter((n) => lifetime(s).includes(n.id)).length),
    reward: { shards: 100 } },
  { id: "story-gate", category: "story", title: "Over the Border",
    desc: "Cross a border gate.",
    measure: fixed(1, (s) => gatesCrossed(lifetime(s))), reward: { shards: 10 } },
  { id: "story-throne", category: "story", title: "Throne-Taker",
    desc: "Take a region's Throne.",
    measure: fixed(1, (s) => thronesTaken(lifetime(s))), reward: { shards: 15 } },
  { id: "story-4-thrones", category: "story", title: "Kingmaker",
    desc: "Take four regions' Thrones.",
    measure: fixed(4, (s) => thronesTaken(lifetime(s))), reward: { shards: 40 } },
  { id: "story-campaign", category: "story", title: "The War Is Won",
    desc: "Take every region's Throne.",
    measure: fixed(REQUIRED_THRONES.length, (s) => thronesTaken(lifetime(s))),
    reward: { shards: 100, packs: 1 } },
  { id: "story-hard", category: "story", title: "Harder Still",
    desc: "Start Hard mode.",
    measure: fixed(1, (s) => (isHard(s) ? 1 : 0)), reward: { shards: 25 } },
  { id: "story-hard-boss", category: "story", title: "Bossbreaker",
    desc: "Slay the Void Tower boss holding a border on Hard mode.",
    measure: fixed(1, (s) => (isHard(s) ? gatesCrossed(s.cleared) : 0)), reward: { shards: 50 } },
  { id: "story-hard-campaign", category: "story", title: "No Mercy",
    desc: "Take every region's Throne on Hard mode.",
    measure: fixed(REQUIRED_THRONES.length, (s) => (isHard(s) ? thronesTaken(s.cleared) : 0)),
    reward: { shards: 150, packs: 1 } },

  // ── Void Tower ─────────────────────────────────────────────────────────────
  { id: "tower-first", category: "tower", title: "Into the Void",
    desc: "Beat a Void Tower boss.",
    measure: fixed(1, (s) => bossesBeaten(s).length), reward: { shards: 15 } },
  ...FLOOR_ACHIEVEMENTS,
  { id: "tower-tame", category: "tower", title: "Beast Tamer",
    desc: "Have a boss tamed, fighting for you.",
    measure: fixed(1, (s) => Object.keys(s.tamed ?? {}).length), reward: { shards: 30 } },
  { id: "tower-all", category: "tower", title: "Master of the Tower",
    desc: "Beat every boss in the Void Tower.",
    measure: fixed(VOID_BOSSES.length, (s) => bossesBeaten(s).length),
    reward: { shards: 100, packs: 1 } },

  // ── Arena ──────────────────────────────────────────────────────────────────
  // Against the AI decks — the matches the Arena pays for. Not hot-seat: one
  // player can win both sides of it.
  { id: "arena-first", category: "arena", title: "First Blood",
    desc: "Win an Arena match against an AI deck.",
    measure: fixed(1, arenaWins), reward: { shards: 10 } },
  { id: "arena-25", category: "arena", title: "Arena Regular",
    desc: "Win 25 Arena matches.",
    measure: fixed(25, arenaWins), reward: { shards: 30 } },
  { id: "arena-100", category: "arena", title: "Gladiator",
    desc: "Win 100 Arena matches.",
    measure: fixed(100, arenaWins), reward: { shards: 80 } },
  { id: "arena-streak-4", category: "arena", title: "Hot Streak",
    desc: "Win 4 in a row in Streak.",
    measure: fixed(4, bestStreak), reward: { shards: 20 } },
  { id: "arena-streak-7", category: "arena", title: "Unstoppable",
    desc: "Win 7 in a row in Streak.",
    measure: fixed(7, bestStreak), reward: { shards: 60 } },
  { id: "arena-gauntlet", category: "arena", title: "Run the Gauntlet",
    desc: `Clear a Gauntlet run: ${RUN_LENGTH} wins without a loss.`,
    measure: fixed(1, (s) => (s.gauntlet?.cleared ?? []).length), reward: { shards: 20 } },
  { id: "arena-gauntlet-hard", category: "arena", title: "Iron Gauntlet",
    desc: "Clear the Gauntlet on the Hard rung.",
    measure: fixed(1, gauntletRung("hard")), reward: { shards: 40 } },
  { id: "arena-gauntlet-elite", category: "arena", title: "Elite Gauntlet",
    desc: "Clear the Gauntlet on the Elite rung.",
    measure: fixed(1, gauntletRung("elite")), reward: { shards: 100, packs: 1 } },
  { id: "arena-draft", category: "arena", title: "Drafted",
    desc: "Win a match with a drafted deck.",
    measure: fixed(1, bestDraft), reward: { shards: 15 } },
  { id: "arena-draft-4", category: "arena", title: "Good Picks",
    desc: "Win 4 matches in one draft run.",
    measure: fixed(4, bestDraft), reward: { shards: 40 } },
  { id: "arena-draft-7", category: "arena", title: "Perfect Draft",
    desc: `Take a draft run all the way: ${DRAFT_MAX_WINS} wins.`,
    measure: fixed(DRAFT_MAX_WINS, bestDraft), reward: { shards: 100, packs: 1 } },
  { id: "arena-dom", category: "arena", title: "King of the Table",
    desc: "Win a Domination match: three or more sides.",
    measure: fixed(1, (s) => s.tally?.domWins ?? 0), reward: { shards: 25 } },
  { id: "arena-event", category: "arena", title: "Main Event",
    desc: `Beat an event: ${ARENA_EVENTS.map((e) => e.name).join(" or ")}.`,
    measure: fixed(1, eventsBeaten), reward: { shards: 20 } },
  { id: "arena-events-all", category: "arena", title: "Headliner",
    desc: "Beat every event.",
    measure: fixed(ARENA_EVENTS.length, eventsBeaten), reward: { shards: 40 } },

  // ── Online ─────────────────────────────────────────────────────────────────
  // A match you surrendered does not count, the same rule that pays a
  // surrenderer nothing: two friends conceding to each other is not a game.
  { id: "online-first", category: "online", title: "Hello, Stranger",
    desc: "Play an online match to the finish.",
    measure: fixed(1, onlinePlayed), reward: { shards: 10 } },
  { id: "online-win", category: "online", title: "Worthy Opponent",
    desc: "Win an online match.",
    measure: fixed(1, onlineWins), reward: { shards: 20 } },
  { id: "online-25", category: "online", title: "Familiar Face",
    desc: "Play 25 online matches.",
    measure: fixed(25, onlinePlayed), reward: { shards: 30 } },
  { id: "online-10-wins", category: "online", title: "Contender",
    desc: "Win 10 online matches.",
    measure: fixed(10, onlineWins), reward: { shards: 50 } },
  { id: "online-25-wins", category: "online", title: "Duelist",
    desc: "Win 25 online matches.",
    measure: fixed(25, onlineWins), reward: { shards: 80 } },
  { id: "online-50-wins", category: "online", title: "Champion",
    desc: "Win 50 online matches.",
    measure: fixed(50, onlineWins), reward: { shards: 150, packs: 1 } },

  // ── Collection ─────────────────────────────────────────────────────────────
  { id: "col-50", category: "collection", title: "Collector",
    desc: "Own 50 cards.",
    measure: fixed(50, ownedPlaced), reward: { shards: 15 } },
  { id: "col-100", category: "collection", title: "Curator",
    desc: "Own 100 cards.",
    measure: fixed(100, ownedPlaced), reward: { shards: 30 } },
  { id: "col-200", category: "collection", title: "Archivist",
    desc: "Own 200 cards.",
    measure: fixed(200, ownedPlaced), reward: { shards: 60 } },
  { id: "col-all", category: "collection", title: "Complete Collection",
    desc: "Own every card the campaign can give you.",
    measure: fixed(PLACED_CARDS.length, ownedPlaced), reward: { shards: 150, packs: 1 } },
  { id: "col-element", category: "collection", title: "Element Master",
    desc: "Own every card of one element.",
    measure: bestElement, reward: { shards: 50 } },
  { id: "col-mythic", category: "collection", title: "Mythic",
    desc: "Own a Mythic card.",
    measure: fixed(1, (s) => s.collection.filter((id) => getDef(id).rarity === "mythic").length),
    reward: { shards: 20 } },
  { id: "col-throne-mythics", category: "collection", title: "Crowns of the War",
    desc: "Own every region's Throne Mythic.",
    measure: fixed(THRONE_MYTHICS.length, (s) => THRONE_MYTHICS.filter((id) => s.collection.includes(id)).length),
    reward: { shards: 50 } },
  { id: "col-foil", category: "collection", title: "Shiny!",
    desc: "Hold a foil card.",
    measure: fixed(1, foils), reward: { shards: 20 } },
  { id: "col-foil-10", category: "collection", title: "Foil Hoard",
    desc: "Hold 10 foil cards.",
    measure: fixed(10, foils), reward: { shards: 60 } },
  { id: "col-pack", category: "collection", title: "Pack Rat",
    desc: "Open a pack.",
    measure: fixed(1, (s) => s.tally?.packs ?? 0), reward: { shards: 10 } },
  { id: "col-pack-25", category: "collection", title: "Unboxing",
    desc: "Open 25 packs.",
    measure: fixed(25, (s) => s.tally?.packs ?? 0), reward: { shards: 50 } },
  { id: "col-craft", category: "collection", title: "Crafter",
    desc: "Craft a card.",
    measure: fixed(1, (s) => s.tally?.crafted ?? 0), reward: { shards: 15 } },
];

const BY_ID = new Map(ACHIEVEMENTS.map((a) => [a.id, a]));
export const achievementById = (id: string): Achievement | undefined => BY_ID.get(id);

/** The ledger mark a claim writes into `save.gifts`. */
export const achievementMark = (id: string): string => `ach:${id}`;

export interface AchievementState {
  /** Progress, capped at the target so a bar never overfills. */
  have: number;
  target: number;
  done: boolean;
  claimed: boolean;
}

export function achievementState(save: StorySave, a: Achievement): AchievementState {
  const m = a.measure(save);
  const target = Math.max(1, m.target);
  const claimed = (save.gifts ?? []).includes(achievementMark(a.id));
  // A claimed achievement stays done even if the save has since moved on
  // (a tamed boss spent, a Hard run started over): it was earned.
  const done = claimed || m.have >= target;
  return { have: done ? target : Math.max(0, Math.min(m.have, target)), target, done, claimed };
}

/** Done and not yet claimed, in list order. */
export const claimableAchievements = (save: StorySave): Achievement[] =>
  ACHIEVEMENTS.filter((a) => { const st = achievementState(save, a); return st.done && !st.claimed; });

export const achievementsClaimed = (save: StorySave): number =>
  ACHIEVEMENTS.filter((a) => achievementState(save, a).claimed).length;

/** Pay one achievement and ledger it. A no-op unless it is done and unclaimed,
 *  so a double tap, or a claim racing a re-render, cannot pay twice. */
export function claimAchievement(save: StorySave, id: string): StorySave {
  const a = achievementById(id);
  if (!a) return save;
  const st = achievementState(save, a);
  if (!st.done || st.claimed) return save;
  let next = addShards(save, a.reward.shards ?? 0);
  next = addFreePacks(next, a.reward.packs ?? 0);
  return { ...next, gifts: [...new Set([...(next.gifts ?? []), achievementMark(a.id)])] };
}

export function claimAllAchievements(save: StorySave): StorySave {
  return claimableAchievements(save).reduce((s, a) => claimAchievement(s, a.id), save);
}

/** One finished match, for `tallyMatch`. */
export type MatchTally =
  | {
      kind: "arena";
      won: boolean;
      /** The opponent was an AI premade — the only Arena win that pays. */
      againstPremade: boolean;
      /** Opponents at the table; more than one is Domination. */
      foes: number;
      /** A draft seat: the run's wins after this match. */
      draftWins?: number;
    }
  | {
      kind: "online";
      won: boolean;
      /** This side conceded. */
      surrendered: boolean;
    };

/** What a finished match adds to `save.tally`. App's settle path calls it once
 *  per match, on the `settledMatch` guard that pays the match, and leaves out
 *  what must not count at all: events (their own achievements) and hot-seat,
 *  where one player can win both sides. Returns the same object when nothing
 *  moved, so the caller can skip the write. */
export function tallyMatch(save: StorySave, m: MatchTally): StorySave {
  const t = save.tally ?? {};
  if (m.kind === "online") {
    if (m.surrendered) return save;
    return {
      ...save,
      tally: { ...t, onlinePlayed: (t.onlinePlayed ?? 0) + 1, onlineWins: (t.onlineWins ?? 0) + (m.won ? 1 : 0) },
    };
  }
  let next = t;
  if (m.won && m.againstPremade) {
    next = { ...next, arenaWins: (next.arenaWins ?? 0) + 1 };
    if (m.foes > 1) next = { ...next, domWins: (next.domWins ?? 0) + 1 };
  }
  if (m.draftWins != null && m.draftWins > (next.draftBest ?? 0)) next = { ...next, draftBest: m.draftWins };
  return next === t ? save : { ...save, tally: next };
}

/** What claiming everything claimable would pay, for the Claim all button. */
export function pendingRewards(save: StorySave): Required<AchievementReward> {
  return claimableAchievements(save).reduce(
    (sum, a) => ({ shards: sum.shards + (a.reward.shards ?? 0), packs: sum.packs + (a.reward.packs ?? 0) }),
    { shards: 0, packs: 0 },
  );
}
