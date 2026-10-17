/** DAILY GOALS — three small things to do today, each worth a few shards, and a
 *  bonus for all three (retention review, 2026-10-17).
 *
 *  The login reward asks for ONE tap a day; a goal asks the player to play. That
 *  is the difference between a reason to open the app and a reason to stay in it,
 *  and "what should I do today?" is the question a returning player otherwise
 *  answers by closing the app.
 *
 *  WHICH THREE is a pure function of the date, so there is nothing to store, roll
 *  or lose: every device that opens the game on the same day sees the same goals,
 *  one easy, one medium, one hard, never two on the same event.
 *
 *  PROGRESS AND CLAIMS LIVE IN THE GIFTS LEDGER, like the daily reward and the
 *  achievements (see daily.ts): older builds keep every string there, so a save
 *  rewritten by one does not erase today. Two kinds of entry, both for TODAY ONLY
 *  and swept the next time anything is written:
 *      gc:<day>:<event>:<count>      how many times that thing happened today
 *      gk:<day>:<goalId | bonus>     that goal (or the all-three bonus) was claimed
 *
 *  WHAT COUNTS (App's `useGoalEvents`): real matches against someone — the AI or a
 *  person — and never the tutorial, the Training Ground, a hot-seat game (one
 *  player can win both sides) or a match that was conceded or lasted under three
 *  rounds, so the fastest way to a goal is not to concede repeatedly. The prices
 *  are deliberately small: a full day is 55 shards, about one pack, on top of what
 *  the matches themselves pay. */
import { addShards, type StorySave } from "./story";
import { localDay } from "./daily";

export type GoalEvent = "played" | "won" | "story_won" | "arena_won";
export type GoalTier = "easy" | "medium" | "hard";

export interface GoalDef {
  id: string;
  tier: GoalTier;
  event: GoalEvent;
  target: number;
  reward: number;
  text: string;
}

/** Paid on top, once every goal of the day has been claimed. */
export const GOAL_BONUS = 15;

export const GOAL_POOL: readonly GoalDef[] = [
  { id: "play2", tier: "easy", event: "played", target: 2, reward: 10, text: "Play 2 matches" },
  { id: "win1", tier: "easy", event: "won", target: 1, reward: 10, text: "Win a match" },

  { id: "story1", tier: "medium", event: "story_won", target: 1, reward: 15, text: "Win a story fight" },
  { id: "arena1", tier: "medium", event: "arena_won", target: 1, reward: 15, text: "Win an Arena match" },
  { id: "win2", tier: "medium", event: "won", target: 2, reward: 15, text: "Win 2 matches" },

  { id: "win3", tier: "hard", event: "won", target: 3, reward: 20, text: "Win 3 matches" },
  { id: "story2", tier: "hard", event: "story_won", target: 2, reward: 20, text: "Win 2 story fights" },
  { id: "arena2", tier: "hard", event: "arena_won", target: 2, reward: 20, text: "Win 2 Arena matches" },
];

/** A small stable hash of text (FNV-1a), so a date picks the same goals everywhere. */
function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/** Today's three goals: one of each tier, no two on the same event. */
export function goalsForDay(day: string): GoalDef[] {
  const taken = new Set<GoalEvent>();
  return (["easy", "medium", "hard"] as const).map((tier) => {
    const pool = GOAL_POOL.filter((g) => g.tier === tier);
    const start = hash(`${day}:${tier}`) % pool.length;
    // First one from the seeded start whose event is not already used today; the
    // pool of each tier has an alternative on a different event, so one exists.
    for (let i = 0; i < pool.length; i++) {
      const g = pool[(start + i) % pool.length];
      if (!taken.has(g.event)) { taken.add(g.event); return g; }
    }
    const g = pool[start];
    taken.add(g.event);
    return g;
  });
}

/** What a finished match adds to today's goals. Pure, so the rules for what COUNTS
 *  are tested rather than buried in an effect: a conceded match, or one that never
 *  got past round 2, counts for nothing (conceding on round 1 must not be the
 *  fastest way to a goal); a win in a story fight is also a story win; a win in the
 *  Arena against the AI is also an Arena win — not online, not a Void Tower floor
 *  and not an event, which have their own achievements. */
export function goalEventsFor(m: {
  won: boolean;
  /** `GameState.win.by`. */
  by?: string;
  round: number;
  story: boolean;
  online: boolean;
  tower: boolean;
  event: boolean;
}): GoalEvent[] {
  if (m.by === "surrender" || m.round < 3) return [];
  const out: GoalEvent[] = ["played"];
  if (!m.won) return out;
  out.push("won");
  if (m.story) out.push("story_won");
  else if (!m.online && !m.tower && !m.event) out.push("arena_won");
  return out;
}

const COUNT = "gc:";
const CLAIM = "gk:";

/** How many times each thing happened on `day`. */
export function goalCounts(save: StorySave, day: string = localDay()): Partial<Record<GoalEvent, number>> {
  const out: Partial<Record<GoalEvent, number>> = {};
  for (const g of save.gifts ?? []) {
    if (!g.startsWith(COUNT)) continue;
    const [, d, ev, n] = g.split(":");
    const count = Number(n);
    if (d !== day || !Number.isInteger(count) || count < 0) continue;
    if (ev === "played" || ev === "won" || ev === "story_won" || ev === "arena_won") out[ev] = Math.max(out[ev] ?? 0, count);
  }
  return out;
}

function claimedSet(save: StorySave, day: string): Set<string> {
  const out = new Set<string>();
  for (const g of save.gifts ?? []) {
    if (!g.startsWith(CLAIM)) continue;
    const [, d, id] = g.split(":");
    if (d === day && id) out.add(id);
  }
  return out;
}

/** The ledger with everything from other days swept out, plus whatever `keep` adds. */
function withLedger(save: StorySave, day: string, edit: (entries: string[]) => string[]): StorySave {
  const keepToday = (save.gifts ?? []).filter((g) => {
    if (!g.startsWith(COUNT) && !g.startsWith(CLAIM)) return true;
    return g.split(":")[1] === day;
  });
  return { ...save, gifts: edit(keepToday) };
}

/** Something that happened that a goal might be asking for. Returns a new save. */
export function recordGoalEvent(save: StorySave, event: GoalEvent, today: string = localDay()): StorySave {
  const n = Math.min(99, (goalCounts(save, today)[event] ?? 0) + 1);
  return withLedger(save, today, (entries) => [
    ...entries.filter((g) => !g.startsWith(`${COUNT}${today}:${event}:`)),
    `${COUNT}${today}:${event}:${n}`,
  ]);
}

export interface GoalState {
  goal: GoalDef;
  progress: number;
  done: boolean;
  claimed: boolean;
}

export interface GoalsToday {
  goals: GoalState[];
  /** Every goal claimed: the bonus is on offer (or already taken). */
  bonusOpen: boolean;
  bonusClaimed: boolean;
  /** Something is waiting to be collected — what lights the Home tab. */
  claimable: boolean;
}

export function goalsToday(save: StorySave, today: string = localDay()): GoalsToday {
  const counts = goalCounts(save, today);
  const claimed = claimedSet(save, today);
  const goals = goalsForDay(today).map((goal) => {
    const progress = Math.min(goal.target, counts[goal.event] ?? 0);
    return { goal, progress, done: progress >= goal.target, claimed: claimed.has(goal.id) };
  });
  const bonusOpen = goals.every((g) => g.claimed);
  const bonusClaimed = claimed.has("bonus");
  return {
    goals,
    bonusOpen,
    bonusClaimed,
    claimable: goals.some((g) => g.done && !g.claimed) || (bonusOpen && !bonusClaimed),
  };
}

/** Take a finished goal's reward (or the all-three bonus, id "bonus"). A no-op
 *  unless it is today's, finished and not yet taken, so a double tap pays once. */
export function claimGoal(save: StorySave, id: string, today: string = localDay()): StorySave {
  const st = goalsToday(save, today);
  let reward = 0;
  if (id === "bonus") {
    if (!st.bonusOpen || st.bonusClaimed) return save;
    reward = GOAL_BONUS;
  } else {
    const g = st.goals.find((x) => x.goal.id === id);
    if (!g || !g.done || g.claimed) return save;
    reward = g.goal.reward;
  }
  const paid = addShards(save, reward);
  return withLedger(paid, today, (entries) => [...entries, `${CLAIM}${today}:${id}`]);
}
