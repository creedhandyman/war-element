// LEVELLING UP — the payout, and the two ways it could go badly wrong.
//
// `playerLevel` is derived from the collection, so there is no level-up event
// to catch and no natural "once". Both failure modes are about that:
//
//   PAYING TWICE. A pack of five new cards moves the level several times
//   between renders, and the popup can close through a claim, a skip or a route
//   change. The claim writes the high-water mark it just paid up to, so a
//   second call finds nothing owed rather than being guarded against.
//
//   PAYING FOR HISTORY. A save that predates this arrives with no `levelSeen`,
//   and reading that as zero hands a player at level 300 six hundred shards for
//   levels earned before the feature existed.
import { describe, expect, it } from "vitest";
import { newSave, type StorySave } from "../../data/story";
import { playerLevel } from "../../data/player";
import {
  LEVEL_SHARDS, MILESTONE_EVERY, MILESTONE_SHARDS, PACK_EVERY,
  claimLevelUp, levelRewards, pendingLevelUp, seenLevel, settleLevelSeen,
} from "../../data/levels";
import { CARDS } from "../../data/cards";

/** A save at exactly `level`, by giving it that many distinct cards. */
function atLevel(level: number, extra: Partial<StorySave> = {}): StorySave {
  return {
    ...newSave(),
    collection: CARDS.slice(0, level).map((c) => c.id),
    ...extra,
  };
}

const shardsOf = (s: StorySave) => s.hero?.shards ?? 0;
const packsOf = (s: StorySave) => s.hero?.freePacks ?? 0;

describe("what a span of levels is worth", () => {
  it("pays per level", () => {
    const r = levelRewards(0, 3);
    expect(r.levels).toBe(3);
    expect(r.shards).toBe(3 * LEVEL_SHARDS);
    expect(r.packs).toBe(0);
  });

  it("adds the milestone ON TOP, not instead", () => {
    // Level 10 is worth 2 + 5. A milestone that REPLACED the per-level shards
    // would make level 10 pay less than level 11, which is not a bonus.
    const one = levelRewards(9, 10);
    expect(one.milestones).toEqual([MILESTONE_EVERY]);
    expect(one.shards).toBe(LEVEL_SHARDS + MILESTONE_SHARDS);
    expect(levelRewards(10, 11).shards, "the level after is the plain rate")
      .toBe(LEVEL_SHARDS);
  });

  it("counts every milestone inside a long span", () => {
    const r = levelRewards(5, 25);
    expect(r.milestones).toEqual([10, 20]);
    expect(r.shards).toBe(20 * LEVEL_SHARDS + 2 * MILESTONE_SHARDS);
  });

  it("pays a pack on the fifties, and the milestone with it", () => {
    // 50 is both, so it pays 2 + 5 + a pack. They stack because they are
    // different rewards on the same level, not two names for one.
    const r = levelRewards(49, 50);
    expect(r.packs).toBe(1);
    expect(r.packLevels).toEqual([PACK_EVERY]);
    expect(r.milestones).toEqual([PACK_EVERY]);
    expect(r.shards).toBe(LEVEL_SHARDS + MILESTONE_SHARDS);
  });

  it("handles a span that crosses several of everything", () => {
    const r = levelRewards(0, 100);
    expect(r.levels).toBe(100);
    expect(r.milestones).toHaveLength(10);
    expect(r.packs).toBe(2);
    expect(r.shards).toBe(100 * LEVEL_SHARDS + 10 * MILESTONE_SHARDS);
  });

  it("is empty going nowhere, and never negative going backwards", () => {
    expect(levelRewards(7, 7).levels).toBe(0);
    expect(levelRewards(7, 7).shards).toBe(0);
    // A level can FALL — nothing removes cards today, but a restored save can
    // be behind the mark. Owing nothing is the answer; owing minus-six is not.
    const back = levelRewards(12, 5);
    expect(back.levels).toBe(0);
    expect(back.shards).toBe(0);
    expect(back.packs).toBe(0);
  });
});

describe("what a save is owed", () => {
  it("owes a new player from their starter card onward", () => {
    // A new save holds one card, so it starts at level 1 and that level is a
    // gift rather than something earned. `loadStory` stamps the mark there; the
    // second card is the first real level-up.
    expect(playerLevel(newSave()), "one starter card").toBe(1);
    const started: StorySave = { ...newSave(), levelSeen: 1 };
    expect(pendingLevelUp(started), "nothing owed for the starter").toBeNull();
    expect(pendingLevelUp(atLevel(3, { levelSeen: 1 }))?.levels).toBe(2);
  });

  it("an unwritten mark owes nothing — and loadStory is what writes it", () => {
    // The fallback is right exactly once. If it were the only thing holding the
    // mark it would follow the level upward forever and no level-up would fire,
    // so the feature would be silently dead. `loadStory` stamps it; this pins
    // the half that lives here.
    const s = atLevel(9);
    expect(s.levelSeen, "the fixture has no mark").toBeUndefined();
    expect(seenLevel(s)).toBe(9);
    expect(pendingLevelUp(s)).toBeNull();
  });

  it("owes an OLD save nothing for levels it earned before this existed", () => {
    // The windfall this prevents. Absent `levelSeen` on a stocked save means
    // "start from here", not "start from zero".
    const veteran = atLevel(300);
    expect(playerLevel(veteran)).toBe(300);
    expect(seenLevel(veteran), "reads as the current level").toBe(300);
    expect(pendingLevelUp(veteran), "and owes nothing").toBeNull();
    expect(shardsOf(claimLevelUp(veteran))).toBe(shardsOf(veteran));
  });

  it("owes exactly the span since it was last shown", () => {
    const s = atLevel(14, { levelSeen: 9 });
    const owed = pendingLevelUp(s)!;
    expect(owed.from).toBe(9);
    expect(owed.to).toBe(14);
    expect(owed.levels).toBe(5);
    expect(owed.milestones).toEqual([10]);
  });
});

describe("claiming", () => {
  it("pays the shards and the packs, and marks the span seen", () => {
    const s = atLevel(50, { levelSeen: 48 });
    const after = claimLevelUp(s);
    expect(shardsOf(after) - shardsOf(s)).toBe(2 * LEVEL_SHARDS + MILESTONE_SHARDS);
    expect(packsOf(after) - packsOf(s)).toBe(1);
    expect(after.levelSeen).toBe(50);
  });

  it("pays ONCE — a second claim finds nothing", () => {
    // Not a guard, a consequence: the mark is written to what was just paid.
    // The popup closes through claim, skip and route change; all three land
    // here, and a five-card pack moves the level several times on the way.
    const s = atLevel(12, { levelSeen: 8 });
    const once = claimLevelUp(s);
    const twice = claimLevelUp(once);
    expect(twice).toBe(once);
    expect(shardsOf(twice)).toBe(shardsOf(once));
    expect(pendingLevelUp(once)).toBeNull();
  });

  it("condenses many levels into one payment", () => {
    // The whole reason the span is claimed rather than each level: one pack
    // that crosses three levels is one thing that happened.
    const s = atLevel(15, { levelSeen: 12 });
    const after = claimLevelUp(s);
    expect(after.levelSeen).toBe(15);
    expect(shardsOf(after) - shardsOf(s)).toBe(3 * LEVEL_SHARDS);
  });

  it("mints a hero rather than dropping the reward on the floor", () => {
    // addShards/addFreePacks both do this; claiming through them means a save
    // with no hero yet still banks what it earned.
    const s: StorySave = { ...atLevel(4), hero: undefined, levelSeen: 0 };
    const after = claimLevelUp(s);
    expect(after.hero, "no hero was minted").toBeTruthy();
    expect(shardsOf(after)).toBe(4 * LEVEL_SHARDS);
  });
});

describe("settleLevelSeen", () => {
  it("marks the current level without paying anything", () => {
    const s = atLevel(30, { levelSeen: 0 });
    const after = settleLevelSeen(s);
    expect(after.levelSeen).toBe(30);
    expect(shardsOf(after), "settling is not claiming").toBe(shardsOf(s));
    expect(pendingLevelUp(after)).toBeNull();
  });

  it("is a no-op when already square, so it cannot churn the save", () => {
    const s = atLevel(30, { levelSeen: 30 });
    expect(settleLevelSeen(s)).toBe(s);
  });
});
