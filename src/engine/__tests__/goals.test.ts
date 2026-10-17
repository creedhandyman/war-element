// DAILY GOALS (data/goals.ts): three goals chosen by the date, progress and claims
// kept in the gifts ledger for today only, a bonus for all three.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  GOAL_BONUS, GOAL_POOL, claimGoal, goalCounts, goalEventsFor, goalsForDay, goalsToday, recordGoalEvent,
} from "../../data/goals";
import { navAttention } from "../../ui/nav-attention";
import { newSave, type StorySave } from "../../data/story";

const fresh = (): StorySave => ({ ...newSave(), hero: { ...newSave().hero!, shards: 0, freePacks: 0 } });
const shards = (s: StorySave) => s.hero?.shards ?? 0;
const D1 = "2026-10-17", D2 = "2026-10-18";

/** Record `n` of an event. */
const times = (s: StorySave, ev: Parameters<typeof recordGoalEvent>[1], n: number, day = D1) => {
  for (let i = 0; i < n; i++) s = recordGoalEvent(s, ev, day);
  return s;
};

describe("which three", () => {
  it("is the same on every device on a given day", () => {
    expect(goalsForDay(D1).map((g) => g.id)).toEqual(goalsForDay(D1).map((g) => g.id));
  });

  it("is one easy, one medium, one hard, never two on the same event — on any day", () => {
    for (let d = 1; d <= 300; d++) {
      const day = `2026-${String(1 + Math.floor((d - 1) / 28)).padStart(2, "0")}-${String(1 + ((d - 1) % 28)).padStart(2, "0")}`;
      const g = goalsForDay(day);
      expect(g.map((x) => x.tier), day).toEqual(["easy", "medium", "hard"]);
      expect(new Set(g.map((x) => x.event)).size, day).toBe(3);
    }
  });

  it("changes from day to day (the pool is not stuck on one answer)", () => {
    const seen = new Set<string>();
    for (let d = 1; d <= 28; d++) seen.add(goalsForDay(`2026-11-${String(d).padStart(2, "0")}`).map((g) => g.id).join());
    expect(seen.size).toBeGreaterThan(4);
  });

  it("every tier has more than one choice, and the prices rise with the tier", () => {
    for (const tier of ["easy", "medium", "hard"] as const) expect(GOAL_POOL.filter((g) => g.tier === tier).length).toBeGreaterThan(1);
    const r = (t: string) => GOAL_POOL.filter((g) => g.tier === t).map((g) => g.reward);
    expect(Math.max(...r("easy"))).toBeLessThan(Math.min(...r("hard")));
  });
});

describe("progress", () => {
  it("counts events for today only", () => {
    let s = times(fresh(), "won", 2);
    expect(goalCounts(s, D1).won).toBe(2);
    expect(goalCounts(s, D2).won).toBeUndefined();
    s = recordGoalEvent(s, "won", D2);
    // Tomorrow's first write swept yesterday's entries.
    expect(goalCounts(s, D2).won).toBe(1);
    expect(goalCounts(s, D1).won).toBeUndefined();
  });

  it("leaves unrelated ledger entries alone (daily reward, gifts)", () => {
    const s: StorySave = { ...fresh(), gifts: ["daily:2026-10-16:3", "tame-continental-1"] };
    const t = recordGoalEvent(s, "played", D1);
    expect(t.gifts).toContain("daily:2026-10-16:3");
    expect(t.gifts).toContain("tame-continental-1");
  });

  it("a goal is done when its event count reaches the target, and no further", () => {
    const g = goalsForDay(D1)[0];
    let s = times(fresh(), g.event, g.target - 1);
    expect(goalsToday(s, D1).goals[0]).toMatchObject({ done: false, progress: g.target - 1 });
    s = recordGoalEvent(s, g.event, D1);
    expect(goalsToday(s, D1).goals[0]).toMatchObject({ done: true, progress: g.target });
    s = times(s, g.event, 5);
    expect(goalsToday(s, D1).goals[0].progress).toBe(g.target);
  });
});

describe("what counts (goalEventsFor)", () => {
  const base = { won: true, by: "capture", round: 8, story: false, online: false, tower: false, event: false };

  it("a played win is played + won, and an Arena win is also an Arena win", () => {
    expect(goalEventsFor(base)).toEqual(["played", "won", "arena_won"]);
  });

  it("a story win is a story win, not an Arena win", () => {
    expect(goalEventsFor({ ...base, story: true })).toEqual(["played", "won", "story_won"]);
  });

  it("a loss is only played", () => {
    expect(goalEventsFor({ ...base, won: false })).toEqual(["played"]);
  });

  it("online, a Void Tower floor and an event win are wins but not Arena wins", () => {
    for (const k of ["online", "tower", "event"] as const)
      expect(goalEventsFor({ ...base, [k]: true }), k).toEqual(["played", "won"]);
  });

  it("a concession, either way, and a match that never got going count for nothing", () => {
    expect(goalEventsFor({ ...base, by: "surrender" })).toEqual([]);
    expect(goalEventsFor({ ...base, won: false, by: "surrender" })).toEqual([]);
    expect(goalEventsFor({ ...base, round: 2 })).toEqual([]);
    expect(goalEventsFor({ ...base, round: 3 })).toEqual(["played", "won", "arena_won"]);
  });
});

describe("the wiring", () => {
  const read = (...p: string[]) => readFileSync(join(__dirname, "..", "..", ...p), "utf8").replace(/\r\n/g, "\n");

  it("App records events once per match, never in a lesson, the tutorial or hot-seat", () => {
    const app = read("ui", "App.tsx");
    expect(app).toContain("goalSettled.current === game");
    expect(app).toContain("if (tutorialRun || trainingRun || twoPlayer || !game.win) return;");
    expect(app).toContain("goalEventsFor({");
    expect(app).toContain("payOut((s) => claimGoal(s, id))");
  });

  it("Home shows the card only after the first node is cleared, and the tab lights when one is claimable", () => {
    expect(read("ui", "HomeScreen.tsx")).toContain("save.cleared.length > 0 && <DailyGoals");
    const s: StorySave = { ...fresh(), cleared: ["L1"] };
    const today = "2026-10-17";
    const first = goalsForDay(today)[0];
    const ready = times(s, first.event, first.target, today);
    // Daily reward is claimed so only the goal can be what lights Home.
    const claimedDaily: StorySave = { ...ready, gifts: [...(ready.gifts ?? []), "daily:2026-10-17:1"] };
    expect(navAttention(claimedDaily, today).home).toBe(true);
    expect(navAttention({ ...claimedDaily, cleared: [] }, today).home).toBe(false);
  });
});

describe("claiming", () => {
  /** Enough of every event that all three of today's goals are done. */
  const allDone = () => times(times(times(times(fresh(), "played", 3), "won", 3), "story_won", 2), "arena_won", 2);

  it("pays a finished goal once, and not an unfinished one", () => {
    const g = goalsForDay(D1)[0];
    expect(claimGoal(fresh(), g.id, D1)).toEqual(fresh());
    const s = times(fresh(), g.event, g.target);
    const paid = claimGoal(s, g.id, D1);
    expect(shards(paid)).toBe(g.reward);
    expect(claimGoal(paid, g.id, D1)).toBe(paid);
    expect(goalsToday(paid, D1).goals[0].claimed).toBe(true);
  });

  it("refuses a goal that is not one of today's", () => {
    const todays = new Set(goalsForDay(D1).map((g) => g.id));
    const other = GOAL_POOL.find((g) => !todays.has(g.id))!;
    const s = times(fresh(), other.event, other.target);
    expect(claimGoal(s, other.id, D1)).toBe(s);
  });

  it("the bonus opens only when all three are claimed, and pays once", () => {
    let s = allDone();
    expect(goalsToday(s, D1).bonusOpen).toBe(false);
    expect(claimGoal(s, "bonus", D1)).toBe(s);
    for (const g of goalsForDay(D1)) s = claimGoal(s, g.id, D1);
    const total = goalsForDay(D1).reduce((n, g) => n + g.reward, 0);
    expect(shards(s)).toBe(total);
    expect(goalsToday(s, D1)).toMatchObject({ bonusOpen: true, bonusClaimed: false, claimable: true });
    s = claimGoal(s, "bonus", D1);
    expect(shards(s)).toBe(total + GOAL_BONUS);
    expect(claimGoal(s, "bonus", D1)).toBe(s);
    expect(goalsToday(s, D1).claimable).toBe(false);
  });

  it("is claimable the moment something is finished (this lights the Home tab)", () => {
    const g = goalsForDay(D1)[0];
    expect(goalsToday(fresh(), D1).claimable).toBe(false);
    expect(goalsToday(times(fresh(), g.event, g.target), D1).claimable).toBe(true);
  });

  it("an unclaimed goal is gone tomorrow: new day, new three, nothing carried", () => {
    const g = goalsForDay(D1)[0];
    const s = times(fresh(), g.event, g.target);
    const next = goalsToday(s, D2);
    expect(next.goals.every((x) => x.progress === 0)).toBe(true);
    expect(next.claimable).toBe(false);
  });

  it("survives junk in the ledger", () => {
    const s: StorySave = { ...fresh(), gifts: ["gc:nope", "gc:2026-10-17:won:x", "gk:", "gc:2026-10-17:other:4"] };
    expect(goalCounts(s, D1)).toEqual({});
    expect(() => goalsToday(s, D1)).not.toThrow();
  });
});
