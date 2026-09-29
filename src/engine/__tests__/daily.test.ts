// DAILY LOGIN (owner, 2026-09-28): a 7-day calendar that resets on a missed
// day — 10, 15, 20, 25, 30, 40 shards, then a free pack on day 7.
import { describe, expect, it } from "vitest";
import { DAILY_REWARDS, claimDaily, dailyRecord, dailyStatus, dayBefore, localDay } from "../../data/daily";
import { newSave, type StorySave } from "../../data/story";

const fresh = (): StorySave => ({ ...newSave(), hero: { ...newSave().hero!, shards: 0, freePacks: 0 } });
const shards = (s: StorySave) => s.hero?.shards ?? 0;
const packs = (s: StorySave) => s.hero?.freePacks ?? 0;

/** Claim on each of these dates in turn. */
const run = (dates: string[], from: StorySave = fresh()) =>
  dates.reduce((s, d) => claimDaily(s, d), from);

describe("the week", () => {
  it("pays the owner's calendar: six days of shards, then a pack", () => {
    expect(DAILY_REWARDS.map((r) => r.shards ?? 0)).toEqual([10, 15, 20, 25, 30, 40, 0]);
    expect(DAILY_REWARDS[6].packs).toBe(1);
  });

  it("walks day 1 to day 7 on consecutive days, then starts the next week", () => {
    const days = ["2026-09-01", "2026-09-02", "2026-09-03", "2026-09-04", "2026-09-05", "2026-09-06", "2026-09-07"];
    const week = run(days);
    expect(shards(week)).toBe(10 + 15 + 20 + 25 + 30 + 40);
    expect(packs(week)).toBe(1);
    expect(dailyRecord(week)).toEqual({ date: "2026-09-07", day: 7 });
    expect(dailyStatus(week, "2026-09-08")).toMatchObject({ claimed: false, day: 1, reset: false });
  });

  it("a missed day starts the week over", () => {
    const s = run(["2026-09-01", "2026-09-02", "2026-09-03"]);
    expect(dailyStatus(s, "2026-09-05")).toMatchObject({ claimed: false, day: 1, reset: true });
    expect(dailyRecord(claimDaily(s, "2026-09-05"))).toEqual({ date: "2026-09-05", day: 1 });
  });

  it("pays once a day, however many times it is pressed", () => {
    const once = claimDaily(fresh(), "2026-09-01");
    expect(claimDaily(once, "2026-09-01")).toBe(once);
    expect(dailyStatus(once, "2026-09-01")).toMatchObject({ claimed: true, day: 1 });
  });

  it("a clock moved back after a claim cannot farm a day", () => {
    const s = claimDaily(fresh(), "2026-09-10");
    expect(dailyStatus(s, "2026-09-09").claimed).toBe(true);
    expect(claimDaily(s, "2026-09-09")).toBe(s);
  });

  it("counts calendar days across month and year ends", () => {
    expect(dayBefore("2026-03-01")).toBe("2026-02-28");
    expect(dayBefore("2028-03-01")).toBe("2028-02-29");
    expect(dayBefore("2027-01-01")).toBe("2026-12-31");
    const s = claimDaily(fresh(), "2026-12-31");
    expect(dailyStatus(s, "2027-01-01")).toMatchObject({ day: 2, reset: false });
    expect(localDay(new Date(2026, 0, 5))).toBe("2026-01-05");
  });

  it("keeps one ledger entry, and ignores junk", () => {
    const s = run(["2026-09-01", "2026-09-02"]);
    expect((s.gifts ?? []).filter((g) => g.startsWith("daily:"))).toEqual(["daily:2026-09-02:2"]);
    const junk: StorySave = { ...fresh(), gifts: ["daily:nope:3", "daily:2026-09-01:9", "tame-continental-1"] };
    expect(dailyRecord(junk)).toBeNull();
    expect(claimDaily(junk, "2026-09-01").gifts).toContain("tame-continental-1");
  });

  it("the streak outlives an older build rewriting the save", () => {
    // It lives in the gifts ledger, which older loaders keep.
    const s = run(["2026-09-01", "2026-09-02"]);
    const raw = JSON.parse(JSON.stringify(s)) as StorySave;
    expect(dailyStatus(raw, "2026-09-03")).toMatchObject({ day: 3 });
  });
});
