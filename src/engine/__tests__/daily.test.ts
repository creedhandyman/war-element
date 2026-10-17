// DAILY LOGIN (owner, 2026-09-28): a 7-day calendar — 10, 15, 20, 25, 30, 40
// shards, then a free pack on day 7. A missed day steps the week BACK one day
// instead of ending it (retention review, 2026-10-17); only a long absence
// starts over.
import { describe, expect, it } from "vitest";
import {
  DAILY_REWARDS, LAPSE_DAYS, claimDaily, dailyRecord, dailyStatus, dayBefore, daysBetween, localDay,
} from "../../data/daily";
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

  it("a missed day steps the week back one day instead of ending it", () => {
    // Took days 1-3, missed the 4th, back on the 5th: day 3 was the last taken, so day 2 is on offer.
    const s = run(["2026-09-01", "2026-09-02", "2026-09-03"]);
    expect(dailyStatus(s, "2026-09-05")).toMatchObject({ claimed: false, day: 2, reset: false, steppedBack: true });
    expect(dailyRecord(claimDaily(s, "2026-09-05"))).toEqual({ date: "2026-09-05", day: 2 });
    // ...and the week carries on from there on consecutive days.
    expect(dailyStatus(claimDaily(s, "2026-09-05"), "2026-09-06")).toMatchObject({ day: 3, reset: false });
  });

  it("a longer slip costs the same one step, not more", () => {
    const s = run(["2026-09-01", "2026-09-02", "2026-09-03", "2026-09-04", "2026-09-05"]);
    expect(dailyStatus(s, "2026-09-09")).toMatchObject({ day: 4, reset: false, steppedBack: true });
  });

  it("never steps below day 1, and day 1 or 2 are not 'stepped back' from a streak", () => {
    const one = run(["2026-09-01"]);
    expect(dailyStatus(one, "2026-09-04")).toMatchObject({ day: 1, reset: false });
    expect(dailyStatus(one, "2026-09-04").steppedBack).toBeFalsy();
    const two = run(["2026-09-01", "2026-09-02"]);
    expect(dailyStatus(two, "2026-09-05")).toMatchObject({ day: 1, steppedBack: true });
  });

  it("a finished week just starts the next one after a gap", () => {
    const days = ["2026-09-01", "2026-09-02", "2026-09-03", "2026-09-04", "2026-09-05", "2026-09-06", "2026-09-07"];
    const week = run(days);
    expect(dailyStatus(week, "2026-09-12")).toMatchObject({ day: 1, reset: false });
  });

  it("only a long absence starts the calendar over", () => {
    const s = run(["2026-09-01", "2026-09-02", "2026-09-03"]);
    // LAPSE_DAYS missed in a row: the 3rd + 1 + 14 = the 18th is the first day that counts as a lapse.
    const justShort = `2026-09-${String(3 + LAPSE_DAYS).padStart(2, "0")}`;
    const lapsed = `2026-09-${String(3 + LAPSE_DAYS + 1).padStart(2, "0")}`;
    expect(dailyStatus(s, justShort)).toMatchObject({ day: 2, reset: false });
    expect(dailyStatus(s, lapsed)).toMatchObject({ day: 1, reset: true });
  });

  it("counts whole calendar days across month and year ends", () => {
    expect(daysBetween("2026-12-30", "2027-01-02")).toBe(3);
    expect(daysBetween("2028-02-28", "2028-03-01")).toBe(2);
    expect(daysBetween("2026-09-05", "2026-09-05")).toBe(0);
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
