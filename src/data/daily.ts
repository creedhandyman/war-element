/** DAILY LOGIN REWARDS — owner, 2026-09-28: a 7-day calendar. Days 1-6 pay
 *  escalating shards, day 7 a free pack; the day after day 7 starts the next week
 *  at day 1.
 *
 *  A MISSED DAY COSTS A STEP BACK, NOT THE WEEK (owner, 2026-10-17, from the
 *  retention review). It used to reset to day 1, which turns the first slip into
 *  "the streak is gone, why bother" at exactly the moment a returning player is
 *  deciding whether to come back at all. Now a miss drops you back to the day
 *  BEFORE the one you last took (day 5 -> day 4, day 2 -> day 1); a week that was
 *  already finished simply starts over; and only a long absence (`LAPSE_DAYS`
 *  missed in a row) starts the calendar from the top.
 *
 *  A DAY IS THE DEVICE'S LOCAL CALENDAR DATE, not a 24-hour window: "come back
 *  tomorrow" should mean tomorrow, and a player who claims at 23:50 can claim
 *  again at 00:10. Nothing here is anti-cheat — moving the clock is possible
 *  in a game that runs on the player's own device — but moving it BACKWARD
 *  cannot farm a day twice (see `dailyStatus`).
 *
 *  STORED IN THE GIFTS LEDGER, as one `daily:<YYYY-MM-DD>:<day>` entry, for the
 *  reason achievements are (achievements.ts): older builds keep every string
 *  there, so a claim survives a save rewritten by one. */
import { addFreePacks, addShards, type StorySave } from "./story";

export interface DailyReward {
  shards?: number;
  packs?: number;
}

/** The week, day 1 first. Owner-chosen shape; ~140 shards and a pack a week. */
export const DAILY_REWARDS: readonly DailyReward[] = [
  { shards: 10 }, { shards: 15 }, { shards: 20 }, { shards: 25 }, { shards: 30 }, { shards: 40 },
  { packs: 1 },
];

const PREFIX = "daily:";

/** This many MISSED days in a row and the calendar starts over: a lapse, not a
 *  slip. Two weeks is long enough that a returning player is better served by a
 *  fresh week than by a half-finished one they have forgotten. */
export const LAPSE_DAYS = 14;
const pad = (n: number) => String(n).padStart(2, "0");

/** A date as YYYY-MM-DD in LOCAL time. Sorts as text in date order. */
export const localDay = (d: Date = new Date()): string =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** The calendar day before `day`, via the Date constructor so month and year
 *  ends (and daylight-saving days) come out right. */
export function dayBefore(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  return localDay(new Date(y, m - 1, d - 1));
}

/** The last claim on the ledger, or null. The latest date wins if a hand-edit
 *  left more than one. */
export function dailyRecord(save: StorySave): { date: string; day: number } | null {
  let best: { date: string; day: number } | null = null;
  for (const g of save.gifts ?? []) {
    if (!g.startsWith(PREFIX)) continue;
    const [, date, dayStr] = g.split(":");
    const day = Number(dayStr);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? "") || !Number.isInteger(day) || day < 1 || day > DAILY_REWARDS.length) continue;
    if (!best || date > best.date) best = { date, day };
  }
  return best;
}

export interface DailyStatus {
  /** Today's reward has been taken. */
  claimed: boolean;
  /** The day of the week on offer — or, once claimed, the day just taken. */
  day: number;
  /** The calendar started over: a long absence (`LAPSE_DAYS` missed in a row). */
  reset: boolean;
  /** One or more days were missed and the week stepped back instead of ending.
   *  The screen says so, so nobody is left wondering why day 5 became day 4. */
  steppedBack?: boolean;
}

/** Whole calendar days from `a` to `b` (b later), by the Date constructor's own
 *  arithmetic so month ends and daylight-saving days come out right. */
export function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000);
}

export function dailyStatus(save: StorySave, today: string = localDay()): DailyStatus {
  const rec = dailyRecord(save);
  if (!rec) return { claimed: false, day: 1, reset: false };
  // Today, or a date AHEAD of today — the clock was moved back after a claim.
  // Either way nothing is owed until the real date passes the last claim.
  if (rec.date >= today) return { claimed: true, day: rec.day, reset: false };
  if (rec.date === dayBefore(today)) return { claimed: false, day: (rec.day % DAILY_REWARDS.length) + 1, reset: false };
  // At least one day missed. A finished week just starts the next one.
  if (rec.day >= DAILY_REWARDS.length) return { claimed: false, day: 1, reset: false };
  const missed = daysBetween(rec.date, today) - 1;
  if (missed >= LAPSE_DAYS) return { claimed: false, day: 1, reset: true };
  // One step back from the day last taken: it is still a day the player earned.
  return { claimed: false, day: Math.max(1, rec.day - 1), reset: false, steppedBack: rec.day > 1 };
}

/** Take today's reward. A no-op once taken, so a double tap pays once. */
export function claimDaily(save: StorySave, today: string = localDay()): StorySave {
  const st = dailyStatus(save, today);
  if (st.claimed) return save;
  const reward = DAILY_REWARDS[st.day - 1];
  let next = addShards(save, reward.shards ?? 0);
  next = addFreePacks(next, reward.packs ?? 0);
  const ledger = (next.gifts ?? []).filter((g) => !g.startsWith(PREFIX));
  return { ...next, gifts: [...ledger, `${PREFIX}${today}:${st.day}`] };
}
