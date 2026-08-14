import { describe, expect, it } from "vitest";
import {
  RUN_LENGTH, RUN_REWARD, ladderProgress, nextSeat, recordResult, rewardFor,
  runComplete, runOver, startRun,
} from "../../data/gauntlet";
import { DECK_TIERS, decksForTier } from "../../data/custom-decks";
import { settleArena } from "../../data/gauntlet";
import { awardShards, newSave, type StorySave } from "../../data/story";

const seq = (...n: number[]) => { let i = 0; return () => n[i++ % n.length]; };

describe("the gauntlet", () => {
  it("deals a full rung, in an order the player did not choose", () => {
    for (const tier of DECK_TIERS) {
      const run = startRun(tier, 4, seq(0));
      expect(run.seats).toHaveLength(RUN_LENGTH);
      expect(new Set(run.seats).size, "no repeats").toBe(RUN_LENGTH);
      const rung = new Set(decksForTier(tier, 4).map((d) => d.id));
      for (const id of run.seats) expect(rung.has(id), `${id} is on ${tier}`).toBe(true);
    }
  });

  it("cannot be re-rolled — the seats are fixed at the start", () => {
    // This is the whole anti-farm property: leaving and coming back has to
    // resume the same run, not deal a kinder one. The run is data, so what the
    // test can check is that advancing never rewrites the sequence.
    const run = startRun("mid", 4, seq(0.9, 0.1, 0.5));
    const seats = [...run.seats];
    const after = recordResult(recordResult(run, true), true);
    expect(after.seats).toEqual(seats);
  });

  it("walks the seats in order and finishes on the fourth win", () => {
    let run = startRun("easy", 4, seq(0.3));
    const seen: string[] = [];
    for (let i = 0; i < RUN_LENGTH; i++) {
      const seat = nextSeat(run, 4);
      expect(seat, `seat ${i}`).toBeTruthy();
      seen.push(seat!.id);
      run = recordResult(run, true);
    }
    expect(seen).toEqual(run.seats);
    expect(runComplete(run)).toBe(true);
    expect(nextSeat(run, 4)).toBeNull();
  });

  it("ends the run on a single loss, whatever was banked", () => {
    let run = startRun("hard", 4, seq(0.2));
    run = recordResult(recordResult(run, true), true);
    expect(run.won).toBe(2);
    run = recordResult(run, false);
    expect(runOver(run)).toBe(true);
    expect(runComplete(run)).toBe(false);
    expect(nextSeat(run, 4)).toBeNull();
    expect(rewardFor(run)).toBe(0);
  });

  it("pays nothing for a partial run, and the rung's reward for a full one", () => {
    let run = startRun("hard", 4, seq(0.4));
    for (let i = 0; i < RUN_LENGTH - 1; i++) {
      run = recordResult(run, true);
      expect(rewardFor(run), `after ${i + 1} wins`).toBe(0);
    }
    run = recordResult(run, true);
    expect(rewardFor(run)).toBe(RUN_REWARD.hard);
    expect(RUN_REWARD.easy).toBeLessThan(RUN_REWARD.mid);
    expect(RUN_REWARD.mid).toBeLessThan(RUN_REWARD.hard);
  });

  it("ignores a result that arrives after the run is over", () => {
    // A replayed effect or a double render must not advance a finished run —
    // that is a free win, and on the last seat it would be a second payout.
    let run = startRun("mid", 4, seq(0.6));
    for (let i = 0; i < RUN_LENGTH; i++) run = recordResult(run, true);
    const done = { ...run };
    expect(recordResult(run, true)).toEqual(done);
    expect(recordResult(run, false)).toEqual(done);
    expect(rewardFor(recordResult(run, true))).toBe(RUN_REWARD.mid);

    let lost = recordResult(startRun("easy", 4, seq(0.1)), false);
    const stuck = { ...lost };
    lost = recordResult(lost, true);
    expect(lost).toEqual(stuck);   // a loss cannot be won back
  });

  it("reports the ladder in order", () => {
    expect(ladderProgress({ cleared: ["easy"] })).toEqual([
      { tier: "easy", cleared: true },
      { tier: "mid", cleared: false },
      { tier: "hard", cleared: false },
    ]);
    expect(ladderProgress(undefined).every((r) => !r.cleared)).toBe(true);
  });
});

describe("settling an arena match", () => {
  const save = (over?: Partial<StorySave>): StorySave => ({ ...newSave(), ...over });
  const pay = (s: StorySave) => awardShards(s, "arena");
  const shards = (s: StorySave) => s.hero?.shards ?? 0;

  it("pays a win over a premade and nothing over a deck you built", () => {
    // The farm this exists to close: a hand-built punching bag in the other
    // seat used to be two shards a match, forever.
    expect(shards(settleArena(save(), { won: true, againstPremade: true }, pay))).toBe(2);
    expect(shards(settleArena(save(), { won: true, againstPremade: false }, pay))).toBe(0);
    expect(shards(settleArena(save(), { won: false, againstPremade: true }, pay))).toBe(0);
  });

  it("advances a run on a win and pays the rung on the fourth", () => {
    let s = save({ gauntlet: { run: startRun("mid", 4, seq(0.3)), cleared: [] } });
    for (let i = 0; i < RUN_LENGTH - 1; i++) {
      s = settleArena(s, { won: true, againstPremade: true }, pay);
      expect(s.gauntlet!.run!.won, `after ${i + 1}`).toBe(i + 1);
      expect(shards(s), "only the per-win shards so far").toBe((i + 1) * 2);
    }
    s = settleArena(s, { won: true, againstPremade: true }, pay);
    expect(runComplete(s.gauntlet!.run)).toBe(true);
    expect(shards(s)).toBe(RUN_LENGTH * 2 + RUN_REWARD.mid);
    expect(s.gauntlet!.cleared).toEqual(["mid"]);
  });

  it("ends the run on a loss and pays nothing for it", () => {
    let s = save({ gauntlet: { run: startRun("hard", 4, seq(0.7)), cleared: [] } });
    s = settleArena(s, { won: true, againstPremade: true }, pay);
    s = settleArena(s, { won: false, againstPremade: true }, pay);
    expect(s.gauntlet!.run!.lost).toBe(true);
    expect(shards(s), "the one win still paid; the run did not").toBe(2);
    expect(s.gauntlet!.cleared).toEqual([]);
  });

  it("cannot be paid twice by a replayed settlement", () => {
    // The effect guards on the game object, but a pure function that pays again
    // when handed a finished run would turn any re-render into free shards.
    let s = save({ gauntlet: { run: startRun("easy", 4, seq(0.2)), cleared: [] } });
    for (let i = 0; i < RUN_LENGTH; i++) s = settleArena(s, { won: true, againstPremade: true }, pay);
    const banked = shards(s);
    expect(banked).toBe(RUN_LENGTH * 2 + RUN_REWARD.easy);
    const again = settleArena(s, { won: true, againstPremade: true }, pay);
    // The per-win shards still apply — that is an ordinary arena win — but the
    // RUN must not pay again.
    expect(shards(again) - banked).toBe(2);
    expect(again.gauntlet!.run).toEqual(s.gauntlet!.run);
  });

  it("leaves a save with no run completely alone apart from the win", () => {
    const before = save();
    const after = settleArena(before, { won: true, againstPremade: true }, pay);
    expect(after.gauntlet).toBeUndefined();
    expect(shards(after)).toBe(2);
  });
});
