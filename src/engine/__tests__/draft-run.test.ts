// DRAFT, phase 3 — the run the drafted deck is for, and the money path.
//
// gauntlet.ts already learned this lesson the hard way and wrote it down: a run
// in progress was advanced — and on a loss, ENDED — by any Arena match at all,
// because "a run is live" was being asked instead of "this match belongs to
// it". Draft has the same shape and therefore the same failure mode, so the
// same guard is here from the start, tested rather than commented.
//
// The rest is the money. Whether a win paid, and paid ONCE, is not a question
// to answer by playing ten matches in a browser.
import { describe, expect, it } from "vitest";
import { tierForStreak } from "../../data/matchmaker";
import { loadStory, newSave, saveStory, type StorySave } from "../../data/story";
import {
  DRAFT_ENTRY, DRAFT_LOSSES, DRAFT_MAX_WINS, DRAFT_PAY, dealDraftSeat, draftComplete,
  draftLosses, draftPlaying, draftReward, draftRunOver, draftTier, draftWins, pickCard,
  recordDraftResult, settleDraft, startDraft, type DraftRun,
} from "../../data/draft";
import { PREMADE_DECKS, decksForTier } from "../../data/custom-decks";

function seeded(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A run with its picking finished, ready to play. */
function drafted(seed = 4): DraftRun {
  const rand = seeded(seed);
  let run = startDraft(4, rand);
  while (!draftComplete(run)) run = pickCard(run, run.offer[0], rand);
  return run;
}

const addShards = (s: StorySave, n: number): StorySave =>
  ({ ...s, hero: { ...s.hero!, shards: (s.hero?.shards ?? 0) + n } });

/** A save mid-run, so the settle has something to settle. */
const saveWith = (run: DraftRun): StorySave => ({ ...newSave(), draft: run });

describe("a draft run only plays once the picking is done", () => {
  it("a half-picked run is not playing and cannot be scored", () => {
    const mid = startDraft(4, seeded(1));
    expect(draftPlaying(mid), "still choosing cards").toBe(false);
    expect(draftRunOver(mid), "and not over either").toBe(false);
    // The important half: a match settled against a run still picking must not
    // spend one of its three lives.
    expect(recordDraftResult(mid, false)).toBe(mid);
    expect(draftLosses(recordDraftResult(mid, false))).toBe(0);
  });

  it("a finished draft is playing, with a full three lives", () => {
    const run = drafted();
    expect(draftComplete(run)).toBe(true);
    expect(draftPlaying(run)).toBe(true);
    expect(draftWins(run)).toBe(0);
    expect(draftLosses(run)).toBe(0);
  });
});

describe("the run ends where it says it ends", () => {
  it("on the third loss", () => {
    let run = drafted();
    for (let i = 0; i < DRAFT_LOSSES - 1; i++) {
      run = recordDraftResult(run, false);
      expect(draftRunOver(run), `over after ${i + 1} losses`).toBe(false);
    }
    run = recordDraftResult(run, false);
    expect(draftRunOver(run)).toBe(true);
    // ...and stays ended. A settled match on a dead run must not resurrect it.
    expect(recordDraftResult(run, true)).toBe(run);
    expect(draftWins(run)).toBe(0);
  });

  it("or on the seventh win", () => {
    let run = drafted();
    for (let i = 0; i < DRAFT_MAX_WINS; i++) run = recordDraftResult(run, true);
    expect(draftWins(run)).toBe(DRAFT_MAX_WINS);
    expect(draftRunOver(run)).toBe(true);
    expect(recordDraftResult(run, true), "no eighth").toBe(run);
  });

  it("climbs the SAME ladder the matchmaker does", () => {
    // Read off tierForStreak rather than given its own table, so the two ways
    // to climb this game cannot describe different difficulties.
    let run = drafted();
    for (let w = 0; w < DRAFT_MAX_WINS; w++) {
      expect(draftTier(run), `at ${w} wins`).toBe(tierForStreak(w, run.board));
      run = recordDraftResult(run, true);
    }
  });
});

describe("the money path", () => {
  it("pays nothing until the run is actually over", () => {
    let run = drafted();
    expect(draftReward(run), "fresh").toBe(0);
    run = recordDraftResult(run, true);
    run = recordDraftResult(run, true);
    expect(draftReward(run), "two wins, still alive").toBe(0);
  });

  it("pays by wins on the way out", () => {
    let run = drafted();
    for (let i = 0; i < 3; i++) run = recordDraftResult(run, true);
    for (let i = 0; i < DRAFT_LOSSES; i++) run = recordDraftResult(run, false);
    expect(draftRunOver(run)).toBe(true);
    expect(draftReward(run)).toBe(DRAFT_PAY[3]);
  });

  it("pays the top only for a clean seven", () => {
    let run = drafted();
    for (let i = 0; i < DRAFT_MAX_WINS; i++) run = recordDraftResult(run, true);
    expect(draftReward(run)).toBe(DRAFT_PAY[DRAFT_MAX_WINS]);
    expect(DRAFT_PAY[DRAFT_MAX_WINS], "and it is the biggest rung")
      .toBe(Math.max(...DRAFT_PAY));
  });

  it("the table only ever goes up, and starts at nothing", () => {
    expect(DRAFT_PAY[0]).toBe(0);
    for (let i = 1; i < DRAFT_PAY.length; i++)
      expect(DRAFT_PAY[i], `rung ${i}`).toBeGreaterThan(DRAFT_PAY[i - 1]);
  });
});

describe("settleDraft", () => {
  it("ignores a match that was not a draft seat", () => {
    // THE GAUNTLET BUG, pre-empted. A casual match fought with a run armed must
    // not spend a life — "a run is live" is not "this match belongs to it".
    const save = saveWith(drafted());
    const after = settleDraft(save, { won: false }, addShards);
    expect(after, "untouched").toBe(save);
    expect(draftLosses(after.draft)).toBe(0);
  });

  it("records a seat, and pays exactly once on the way out", () => {
    let save = saveWith(drafted());
    const start = save.hero!.shards;
    // Two wins, then out on three losses.
    for (const won of [true, true, false, false]) {
      save = settleDraft(save, { won, draftSeat: true }, addShards);
      expect(save.hero!.shards, "nothing paid mid-run").toBe(start);
    }
    save = settleDraft(save, { won: false, draftSeat: true }, addShards);
    expect(draftRunOver(save.draft), "third loss ends it").toBe(true);
    expect(save.hero!.shards, "paid for two wins").toBe(start + DRAFT_PAY[2]);

    // ...and a stray settle after the run is dead pays nothing more.
    const again = settleDraft(save, { won: true, draftSeat: true }, addShards);
    expect(again.hero!.shards).toBe(save.hero!.shards);
  });

  it("cannot be scored against a run still picking", () => {
    const save = saveWith(startDraft(4, seeded(2)));
    expect(settleDraft(save, { won: true, draftSeat: true }, addShards)).toBe(save);
  });
});

describe("a run survives storage", () => {
  const withStorage = (fn: () => void) => {
    const store = new Map<string, string>();
    const g = globalThis as { localStorage?: unknown };
    const prior = g.localStorage;
    g.localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    };
    try { fn(); } finally { g.localStorage = prior; }
    return store;
  };

  it("round-trips picks, offer and record", () => {
    withStorage(() => {
      const run = recordDraftResult(drafted(9), true);
      saveStory(saveWith(run));
      const back = loadStory().draft;
      expect(back).toEqual(run);
      expect(back!.picks).toHaveLength(18);
      expect(draftWins(back)).toBe(1);
    });
  });

  it("drops a malformed run whole rather than repairing it", () => {
    // Same posture as the gauntlet run beside it. A junk `board` would strand a
    // draft that can never reach its own deck size — half a run is not a thing
    // the rest of the code should have to reason about.
    for (const bad of [
      { board: 99, picks: [], offer: [] },
      { board: 4, picks: "nope", offer: [] },
      { board: 4, picks: [], offer: [1, 2] },
      { board: 4, picks: [], offer: [], won: -3 },
    ]) {
      withStorage(() => {
        saveStory({ ...newSave(), draft: bad as unknown as DraftRun });
        expect(loadStory().draft, JSON.stringify(bad)).toBeUndefined();
      });
    }
  });
});

describe("the run deals its own opponent", () => {
  it("has one the moment the picking ends, and it is a real premade", () => {
    const run = drafted();
    expect(run.seat, "a playing run with no opponent").toBeTruthy();
    expect(PREMADE_DECKS.some((d) => d.id === run.seat)).toBe(true);
  });

  it("deals from the rung the win count has earned", () => {
    let run = drafted();
    for (let w = 0; w < 4; w++) {
      const tier = draftTier(run);
      expect(decksForTier(tier, run.board).some((d) => d.id === run.seat),
        `at ${w} wins the seat is off-rung`).toBe(true);
      run = recordDraftResult(run, true);
    }
  });

  it("does not deal the same deck twice in a row", () => {
    // The bug this fixes: the seat was `decksForTier(...)[0]`, so a run faced
    // the SAME deck at every rung and again on every rematch. `rollOpponent`'s
    // `avoid` is what makes a run a ladder rather than one deck four times.
    let run = drafted(21);
    for (let i = 0; i < 6; i++) {
      const before = run.seat;
      const after = recordDraftResult(run, true);
      if (!draftPlaying(after)) break;
      if (decksForTier(draftTier(after), after.board).length > 1)
        expect(after.seat, "same opponent twice running").not.toBe(before);
      run = after;
    }
  });

  it("holds no seat while still picking, or once the run is over", () => {
    // A seat on a run that cannot use it is a lie the lobby would render.
    expect(startDraft(4, seeded(3)).seat).toBeUndefined();
    let run = drafted();
    for (let i = 0; i < DRAFT_LOSSES; i++) run = recordDraftResult(run, false);
    expect(draftRunOver(run)).toBe(true);
    expect(dealDraftSeat(run), "a finished run must not be re-seated").toBe(run);
  });
});

describe("the economy holds its shape", () => {
  // The measured figures live on DRAFT_PAY — 150 simulated runs, mean 3.41
  // wins, EV 51.4 against a 50 entry. Simulating that here would be hundreds of
  // full matches, so what is pinned is the SHAPE those figures depend on: break
  // even in the middle of the distribution, and an entry the table can repay.
  it("breaks even around the middle of the run, not at the top", () => {
    const mid = DRAFT_PAY.findIndex((p) => p >= DRAFT_ENTRY);
    expect(mid, "no win count repays the entry").toBeGreaterThan(0);
    expect(mid, "break-even is too deep — most runs would be a loss")
      .toBeLessThanOrEqual(4);
    expect(mid, "break-even is too shallow — the entry stops meaning anything")
      .toBeGreaterThanOrEqual(3);
  });

  it("tops out well above the entry, so a clean run is worth chasing", () => {
    expect(DRAFT_PAY[DRAFT_MAX_WINS] / DRAFT_ENTRY).toBeGreaterThan(2);
  });
});
