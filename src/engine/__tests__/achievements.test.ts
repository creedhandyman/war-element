// ACHIEVEMENTS (owner, 2026-09-28): Story, Void Tower and Collection, then the
// Arena and online matches; shards, more for harder ones, a free pack for the
// hardest; claimed once, ever.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ACHIEVEMENTS, ACHIEVEMENT_CATEGORIES, achievementMark, achievementState, achievementsClaimed,
  claimAchievement, claimAllAchievements, claimableAchievements, pendingRewards, tallyMatch,
} from "../../data/achievements";
import {
  ALL_NODES, PLACED_CARDS, REQUIRED_THRONES, applyPack, craftCard, loadStory, newSave, saveStory,
  startHardMode, type StorySave,
} from "../../data/story";
import { VOID_BOSSES, trialEventId } from "../../data/void-tower";
import { EVENTS } from "../../data/events";
import type { DraftRun } from "../../data/draft";

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
    expect(withPack).toEqual([
      "arena-draft-7", "arena-gauntlet-elite", "col-all", "online-50-wins",
      "story-campaign", "story-hard-campaign", "tower-all",
    ].sort());
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

// ── the Arena and online batch ───────────────────────────────────────────────

const got = (s: StorySave) => ids(claimableAchievements(s));
const stateOf = (s: StorySave, id: string) => achievementState(s, ACHIEVEMENTS.find((a) => a.id === id)!);
const run = (won: number, lost = 0) => ({ board: 4, picks: [], offer: [], won, lost }) as DraftRun;

describe("Arena achievements", () => {
  it("read what the save already proves: streaks, Gauntlet rungs, the draft run, events", () => {
    const s: StorySave = {
      ...newSave(),
      ladder: { streak: 0, best: 7 },
      gauntlet: { cleared: ["easy", "hard"] },
      draft: run(4, 3),
      eventsDone: [EVENTS.find((e) => !e.bossId)!.id],
    };
    const g = got(s);
    for (const id of ["arena-first", "arena-streak-4", "arena-streak-7", "arena-gauntlet",
      "arena-gauntlet-hard", "arena-draft", "arena-draft-4", "arena-event"]) expect(g, id).toContain(id);
    for (const id of ["arena-gauntlet-elite", "arena-draft-7", "arena-events-all", "arena-dom", "arena-25"])
      expect(g, id).not.toContain(id);
  });

  it("proves a floor of wins from three different modes, and never double counts the tally", () => {
    const s: StorySave = { ...newSave(), ladder: { streak: 0, best: 3 }, gauntlet: { cleared: ["easy"] }, draft: run(2) };
    expect(stateOf(s, "arena-25").have).toBe(3 + 4 + 2);
    // The count kept since the batch shipped includes those same wins once it
    // has seen them: the larger of the two, never the sum.
    expect(stateOf({ ...s, tally: { arenaWins: 5 } }, "arena-25").have).toBe(9);
    expect(stateOf({ ...s, tally: { arenaWins: 20 } }, "arena-25").have).toBe(20);
  });

  it("a Void Trial is the Tower's, not an Arena event", () => {
    const s: StorySave = { ...newSave(), eventsDone: VOID_BOSSES.map((b) => trialEventId(b.cardId)) };
    expect(got(s)).not.toContain("arena-event");
    const all: StorySave = { ...newSave(), eventsDone: EVENTS.filter((e) => !e.bossId).map((e) => e.id) };
    expect(got(all)).toEqual(expect.arrayContaining(["arena-event", "arena-events-all"]));
  });

  it("a Perfect Draft is read off the run the save still holds", () => {
    expect(got({ ...newSave(), draft: run(7, 2) })).toContain("arena-draft-7");
  });
});

describe("counting a finished match", () => {
  const arena = (won: boolean, o: Partial<{ againstPremade: boolean; foes: number; draftWins: number }> = {}) =>
    ({ kind: "arena" as const, won, againstPremade: true, foes: 1, ...o });

  it("counts an Arena win against an AI deck, and nothing else", () => {
    const s = newSave();
    expect(tallyMatch(s, arena(true)).tally?.arenaWins).toBe(1);
    expect(tallyMatch(s, arena(false))).toBe(s);
    expect(tallyMatch(s, arena(true, { againstPremade: false })), "a deck you built").toBe(s);
  });

  it("a win at a table of three or more is a Domination win as well", () => {
    const t = tallyMatch(newSave(), arena(true, { foes: 3 })).tally!;
    expect(t).toMatchObject({ arenaWins: 1, domWins: 1 });
    expect(tallyMatch(newSave(), arena(true)).tally?.domWins).toBeUndefined();
  });

  it("keeps the best draft run, and only ever raises it", () => {
    let s = tallyMatch(newSave(), arena(true, { draftWins: 3 }));
    expect(s.tally?.draftBest).toBe(3);
    s = tallyMatch(s, arena(false, { draftWins: 1 }));
    expect(s.tally?.draftBest).toBe(3);
  });

  it("an online match counts when it is played out, won or lost", () => {
    let s = tallyMatch(newSave(), { kind: "online", won: true, surrendered: false });
    s = tallyMatch(s, { kind: "online", won: false, surrendered: false });
    expect(s.tally).toMatchObject({ onlinePlayed: 2, onlineWins: 1 });
    expect(got(s)).toEqual(expect.arrayContaining(["online-first", "online-win"]));
  });

  it("a match you surrendered does not count, as it pays nothing", () => {
    const s = newSave();
    expect(tallyMatch(s, { kind: "online", won: false, surrendered: true })).toBe(s);
  });

  it("every count survives a save and a load, and junk does not", () => {
    const store = new Map<string, string>();
    const g = globalThis as { localStorage?: unknown };
    const prior = g.localStorage;
    g.localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    };
    try {
      const tally = { packs: 3, crafted: 1, arenaWins: 12, domWins: 2, draftBest: 5, onlinePlayed: 9, onlineWins: 4 };
      saveStory({ ...newSave(), tally });
      expect(loadStory().tally).toMatchObject(tally);
      saveStory({ ...newSave(), tally: { arenaWins: -4, onlineWins: Number.NaN, draftBest: "7" as never } });
      expect(loadStory().tally).toMatchObject({ arenaWins: undefined, onlineWins: undefined, draftBest: undefined });
    } finally { g.localStorage = prior; }
  });
});

describe("the wiring", () => {
  const ui = (f: string) => readFileSync(join(__dirname, "..", "..", "ui", f), "utf8");
  const APP = ui("App.tsx");
  const CSS = ui("styles.css");

  it("App counts both kinds of match, and leaves events and hot-seat out of the Arena's", () => {
    expect(APP).toMatch(/tallyMatch\([^;]*kind: "online"/);
    expect(APP).toMatch(/event \|\| twoPlayer\s*\?\s*paidOut\s*:\s*tallyMatch\(paidOut, \{\s*kind: "arena"/);
  });

  it("styles every class the achievement screens put on the page", () => {
    for (const f of ["Achievements.tsx", "AchievementToast.tsx", "DailyReward.tsx"]) {
      const src = ui(f);
      const names = new Set<string>();
      for (const m of src.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g))
        for (const tok of (m[1] ?? m[2] ?? "").split(/[\s${}]+/))
          if (/^[a-z][a-z0-9-]*$/.test(tok)) names.add(tok);
      expect(names.size, `${f}: no classes found`).toBeGreaterThan(3);
      const missing = [...names].filter((n) => !CSS.includes(`.${n}`)).sort();
      expect(missing, `${f}: classes with no rule`).toEqual([]);
    }
  });
});
