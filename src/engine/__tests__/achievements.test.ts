// ACHIEVEMENTS (owner, 2026-09-28): Story, Void Tower and Collection; shards,
// more for harder ones, a free pack for the hardest; claimed once, ever.
import { describe, expect, it } from "vitest";
import {
  ACHIEVEMENTS, ACHIEVEMENT_CATEGORIES, achievementMark, achievementState, achievementsClaimed,
  claimAchievement, claimAllAchievements, claimableAchievements, pendingRewards,
} from "../../data/achievements";
import {
  ALL_NODES, PLACED_CARDS, REQUIRED_THRONES, applyPack, craftCard, newSave, startHardMode,
  type StorySave,
} from "../../data/story";
import { VOID_BOSSES, trialEventId } from "../../data/void-tower";

const shards = (s: StorySave) => s.hero?.shards ?? 0;
const packs = (s: StorySave) => s.hero?.freePacks ?? 0;
const ids = (list: readonly { id: string }[]) => list.map((a) => a.id);

/** A finished first campaign: every node, every placed card. */
const finished = (): StorySave => ({
  ...newSave(),
  cleared: ALL_NODES.map((n) => n.id),
  collection: [...PLACED_CARDS],
  hero: { ...newSave().hero!, shards: 0, freePacks: 0 },
});

describe("the achievement list", () => {
  it("has unique, stable ids, real categories and a reward on every entry", () => {
    expect(new Set(ids(ACHIEVEMENTS)).size).toBe(ACHIEVEMENTS.length);
    const cats = ACHIEVEMENT_CATEGORIES.map((c) => c.id);
    for (const a of ACHIEVEMENTS) {
      expect(cats, a.id).toContain(a.category);
      expect((a.reward.shards ?? 0) + (a.reward.packs ?? 0), a.id).toBeGreaterThan(0);
      expect(a.title.length, a.id).toBeGreaterThan(0);
    }
    // Every category the owner picked is covered.
    for (const c of cats) expect(ACHIEVEMENTS.some((a) => a.category === c), c).toBe(true);
  });

  it("pays packs only for the hardest", () => {
    const withPack = ACHIEVEMENTS.filter((a) => a.reward.packs).map((a) => a.id).sort();
    expect(withPack).toEqual(["col-all", "story-campaign", "story-hard-campaign", "tower-all"].sort());
  });

  it("a brand-new save has nothing to claim", () => {
    expect(claimableAchievements(newSave())).toEqual([]);
  });
});

describe("progress is read from the save, so the past counts", () => {
  it("a finished campaign already holds the Story set it earned", () => {
    const got = ids(claimableAchievements(finished()));
    for (const id of ["story-first", "story-50", "story-all", "story-gate", "story-throne",
      "story-4-thrones", "story-campaign", "col-50", "col-100", "col-200", "col-all",
      "col-element", "col-mythic", "col-throne-mythics"]) expect(got, id).toContain(id);
    // ...and not what it has not done.
    for (const id of ["story-hard", "story-hard-boss", "story-hard-campaign", "tower-first", "col-foil", "col-pack"])
      expect(got, id).not.toContain(id);
  });

  it("bars cap at the target, and count what is there", () => {
    const s: StorySave = { ...newSave(), cleared: ["L1", "L2", "L3"] };
    const seasoned = ACHIEVEMENTS.find((a) => a.id === "story-50")!;
    expect(achievementState(s, seasoned)).toMatchObject({ have: 3, target: 50, done: false });
    const first = ACHIEVEMENTS.find((a) => a.id === "story-first")!;
    expect(achievementState(s, first)).toMatchObject({ have: 1, target: 1, done: true, claimed: false });
  });

  it("Hard mode's own set reads the Hard run", () => {
    const hard = startHardMode(finished());
    const got = () => ids(claimableAchievements(hard));
    expect(got()).toContain("story-hard");
    expect(got()).not.toContain("story-hard-boss");
    const crossed: StorySave = { ...hard, cleared: ["L1", "L14", "GA"] };
    expect(ids(claimableAchievements(crossed))).toContain("story-hard-boss");
    const won: StorySave = { ...hard, cleared: [...REQUIRED_THRONES] };
    expect(ids(claimableAchievements(won))).toContain("story-hard-campaign");
  });

  it("the Tower set reads beaten bosses, floor by floor", () => {
    const f1 = VOID_BOSSES.filter((b) => b.floor === 1);
    const s: StorySave = { ...newSave(), eventsDone: f1.map((b) => trialEventId(b.cardId)) };
    const got = ids(claimableAchievements(s));
    expect(got).toContain("tower-first");
    expect(got).toContain("tower-floor-1");
    expect(got).not.toContain("tower-floor-2");
    const all: StorySave = { ...newSave(), eventsDone: VOID_BOSSES.map((b) => trialEventId(b.cardId)) };
    expect(ids(claimableAchievements(all))).toContain("tower-all");
    const tamed: StorySave = { ...newSave(), tamed: { boss_smolder: 3 } };
    expect(ids(claimableAchievements(tamed))).toContain("tower-tame");
  });

  it("opening packs and crafting are counted from now on", () => {
    let s = newSave();
    s = applyPack(s, { fresh: [], refund: {}, shiny: [] } as never);
    expect(s.tally?.packs).toBe(1);
    expect(ids(claimableAchievements(s))).toContain("col-pack");
    const target = PLACED_CARDS.find((id) => !s.collection.includes(id))!;
    const rich: StorySave = { ...s, hero: { ...s.hero!, essence: { LEAF: 999, PYRO: 999, AQUA: 999, GALE: 999, BOLT: 999, BORE: 999, DUSK: 999, DAWN: 999 } } };
    const crafted = craftCard(rich, target);
    expect(crafted.tally?.crafted).toBe(1);
    expect(ids(claimableAchievements(crafted))).toContain("col-craft");
  });
});

describe("claiming", () => {
  it("pays the reward and ledgers the claim, once", () => {
    const s = finished();
    const a = ACHIEVEMENTS.find((x) => x.id === "story-campaign")!;
    const once = claimAchievement(s, a.id);
    expect(shards(once)).toBe(a.reward.shards);
    expect(packs(once)).toBe(1);
    expect(once.gifts).toContain(achievementMark(a.id));
    const twice = claimAchievement(once, a.id);
    expect(twice).toBe(once);
    expect(achievementState(once, a).claimed).toBe(true);
  });

  it("will not pay what is not done", () => {
    const s = newSave();
    expect(claimAchievement(s, "story-campaign")).toBe(s);
    expect(claimAchievement(s, "no-such-achievement")).toBe(s);
  });

  it("claim all pays exactly what the button promised", () => {
    const s = finished();
    const owed = pendingRewards(s);
    const all = claimAllAchievements(s);
    expect(shards(all)).toBe(owed.shards);
    expect(packs(all)).toBe(owed.packs);
    expect(claimableAchievements(all)).toEqual([]);
    expect(achievementsClaimed(all)).toBe(claimableAchievements(s).length);
  });

  it("a claimed achievement stays earned when the save moves on", () => {
    // A tamed boss spent, or a Hard run started over, must not un-earn it.
    const tamed: StorySave = { ...newSave(), tamed: { boss_smolder: 1 } };
    const claimed = claimAchievement(tamed, "tower-tame");
    const spent: StorySave = { ...claimed, tamed: {} };
    const st = achievementState(spent, ACHIEVEMENTS.find((a) => a.id === "tower-tame")!);
    expect(st).toMatchObject({ done: true, claimed: true });
    expect(claimAchievement(spent, "tower-tame")).toBe(spent);
  });

  it("the claim outlives an older build rewriting the save", () => {
    // An older loader drops fields it does not know but keeps every string in
    // the gifts ledger — which is where the claim lives.
    const claimed = claimAllAchievements(finished());
    const raw = JSON.parse(JSON.stringify(claimed)) as Record<string, unknown>;
    delete raw.tally;
    const stripped = raw as unknown as StorySave;
    expect(claimableAchievements(stripped)).toEqual([]);
    expect(shards(claimAllAchievements(stripped))).toBe(shards(claimed));
  });
});
